import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CatalogImportProgress } from "@/components/CatalogImportProgress";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PafProduct {
  code: string;
  description: string;
  category?: string;
  width?: number;
  height?: number;
  depth?: number;
  numberOfDoors?: number;
  numberOfDrawers?: number;
  listPrice?: number;
  imageUrl?: string;
  catalogImageUrl?: string; // S3 URL after upload
}

// ---------------------------------------------------------------------------
// NAC DataPack format detection and parsing
// ---------------------------------------------------------------------------

function isDataPackFormat(zipContent: InstanceType<typeof import("jszip")>): boolean {
  const fileNames = Object.keys(zipContent.files);
  const hasCatInfo = fileNames.some(
    (n) => n === "CatInfo.Xml" || n.toLowerCase() === "catinfo.xml"
  );
  const hasProductsCsv = fileNames.some((n) =>
    n.toLowerCase().includes("conversiondata/pricing/10_products.csv")
  );
  return hasCatInfo && hasProductsCsv;
}

async function parseDataPackZip(zipContent: InstanceType<typeof import("jszip")>): Promise<PafProduct[]> {
  const fileNames = Object.keys(zipContent.files);
  const productsCsvPath = fileNames.find((n) =>
    n.toLowerCase().includes("conversiondata/pricing/10_products.csv")
  );
  if (!productsCsvPath) return [];
  const catalogPrefix = productsCsvPath.substring(
    0,
    productsCsvPath.toLowerCase().indexOf("conversiondata/")
  );
  const productsCsvText = await zipContent.files[productsCsvPath].async("text");
  const productRows = parseSimpleCsv(productsCsvText);
  const priceCsvPath = fileNames.find(
    (n) =>
      n.startsWith(catalogPrefix) &&
      n.toLowerCase().includes("conversiondata/pricing/72_pricetags_default.csv")
  );
  const priceMap: Record<string, number> = {};
  if (priceCsvPath) {
    const priceCsvText = await zipContent.files[priceCsvPath].async("text");
    const priceRows = parseSimpleCsv(priceCsvText);
    for (const row of priceRows) {
      if (row[1] === "PR00011" && row[5] === "O.PG02") {
        const sku = row[4];
        const price = parseFloat(row[7]);
        if (sku && !isNaN(price)) priceMap[sku] = price;
      }
    }
  }
  const products: PafProduct[] = [];
  for (const row of productRows) {
    if (row[0] !== "Product") continue;
    const sku = row[2];
    const description = row[3] || sku;
    if (!sku) continue;
    const product: PafProduct = {
      code: sku.toUpperCase(),
      description,
      category: inferCategoryFromNacSku(sku),
    };
    if (priceMap[sku] !== undefined) product.listPrice = priceMap[sku];
    products.push(product);
  }
  return products;
}

function parseSimpleCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let isFirst = true;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isFirst) { isFirst = false; continue; }
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    parts.push(current.trim());
    rows.push(parts);
  }
  return rows;
}

function inferCategoryFromNacSku(sku: string): string {
  const upper = sku.toUpperCase();
  if (upper.includes("WALL")) return "Wall Cabinet";
  if (upper.includes("TALL")) return "Tall Cabinet";
  if (upper.includes("ISLAND")) return "Island";
  if (upper.includes("CORNER")) return "Corner Cabinet";
  return "Base Cabinet";
}

// ---------------------------------------------------------------------------
// PAF XML parsing (simple DOM-based)
// ---------------------------------------------------------------------------

function parseSimplePafXml(xmlContent: string): PafProduct[] {
  const products: PafProduct[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error("Invalid XML format");
    const productElements = xmlDoc.getElementsByTagName("Product");
    for (let i = 0; i < productElements.length; i++) {
      const elem = productElements[i];
      const product: PafProduct = {
        code: elem.getAttribute("Code") || `PROD_${i}`,
        description: elem.getAttribute("Description") || "",
      };
      const categoryElem = elem.getElementsByTagName("Category")[0];
      if (categoryElem) product.category = categoryElem.textContent || undefined;
      const widthElem = elem.getElementsByTagName("Width")[0];
      if (widthElem?.textContent) product.width = parseFloat(widthElem.textContent);
      const heightElem = elem.getElementsByTagName("Height")[0];
      if (heightElem?.textContent) product.height = parseFloat(heightElem.textContent);
      const depthElem = elem.getElementsByTagName("Depth")[0];
      if (depthElem?.textContent) product.depth = parseFloat(depthElem.textContent);
      const priceElem = elem.getElementsByTagName("ListPrice")[0];
      if (priceElem?.textContent) product.listPrice = parseFloat(priceElem.textContent);
      const imageElem = elem.getElementsByTagName("ImageUrl")[0];
      if (imageElem?.textContent) product.imageUrl = imageElem.textContent;
      if (product.code && product.description) products.push(product);
    }
  } catch (err) {
    console.error("Error parsing PAF XML:", err);
  }
  return products;
}

export default function AdminCatalogImport() {
  const auth = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [distributorId, setDistributorId] = useState<number | "">("");
  const [preservePricing, setPreservePricing] = useState(true);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    message: string;
    progress?: number; // 0-100
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    fileName: string;
  } | null>(null);

  // New vendor creation state
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorBrand, setNewVendorBrand] = useState("");

  const utils = trpc.useUtils();
  const { data: distList, isLoading: distsLoading } = trpc.distributorAdmin.adminList.useQuery();

  const addDistributor = trpc.distributorAdmin.addDistributor.useMutation({
    onSuccess: (d) => {
      toast.success(`Vendor "${d.name}" created (ID: ${d.id})`);
      utils.distributorAdmin.adminList.invalidate();
      setDistributorId(d.id);
      setShowNewVendor(false);
      setNewVendorName("");
      setNewVendorBrand("");
    },
    onError: (e) => toast.error(e.message),
  });

  const initializeImport = trpc.catalogImport.initializeImport.useMutation();
  const executeImport = trpc.catalogImport.executeImport.useMutation();
  const uploadImage = trpc.catalogImport.uploadImage.useMutation();
  const importMasterCsv = trpc.catalogImport.importMasterCsv.useMutation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvProcessing, setCsvProcessing] = useState(false);

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCsvFile(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile || !distributorId) return;
    setCsvProcessing(true);
    setImportResult(null);
    try {
      const csvText = await csvFile.text();
      const result = await importMasterCsv.mutateAsync({
        csvText,
        distributorId: Number(distributorId),
        preservePricing,
      });
      setImportResult({
        created: result.stats.created,
        updated: result.stats.updated,
        skipped: result.stats.skipped,
        errors: result.stats.errors.length,
        fileName: csvFile.name,
      });
      toast.success("CSV import complete!");
    } catch (err: any) {
      toast.error(err.message ?? "CSV import failed");
    } finally {
      setCsvProcessing(false);
    }
  };

  const listImports = trpc.catalogImport.listImports.useQuery(
    { distributorId: Number(distributorId) },
    { enabled: distributorId !== "" }
  );

  // Check if user is admin
  if (!auth.user || auth.user.role !== "admin") {
    return (
      <div className="container py-12">
        <Card className="p-6">
          <p className="text-red-600">Access denied. Admin privileges required.</p>
        </Card>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".zip")) {
        toast.error("Please select a .zip file");
        return;
      }
      setSelectedFile(file);
      toast.success(`Selected: ${file.name}`);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !distributorId) {
      toast.error("Please select a file and distributor");
      return;
    }

    setIsProcessing(true);
    setImportProgress({ status: "extracting", message: "Extracting zip file...", progress: 10 });

    try {
      // Extract zip file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(selectedFile);

      setImportProgress({ status: "parsing", message: "Detecting catalog format...", progress: 20 });

      // Detect format: NAC DataPack (CatInfo.Xml + ConversionData CSVs) vs classic PAF XML
      let parsedProducts: PafProduct[];
      if (isDataPackFormat(zipContent)) {
        setImportProgress({ status: "parsing", message: "Parsing NAC DataPack catalog (CSV format)...", progress: 30 });
        parsedProducts = await parseDataPackZip(zipContent);
      } else {
        const pafFile = Object.keys(zipContent.files).find((name) =>
          name.toLowerCase().endsWith("paf.xml")
        );
        if (!pafFile) {
          toast.error("No recognized catalog format found (expected paf.xml or NAC DataPack CSVs)");
          setIsProcessing(false);
          return;
        }
        setImportProgress({ status: "parsing", message: "Parsing PAF XML...", progress: 30 });
        const xmlContent = await zipContent.files[pafFile].async("text");
        parsedProducts = parseSimplePafXml(xmlContent);
      }

      // Initialize import record
      setImportProgress({ status: "initializing", message: "Initializing import...", progress: 40 });
      const initResult = await initializeImport.mutateAsync({
        distributorId: Number(distributorId),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        preservePricing,
      });

      if (parsedProducts.length === 0) {
        throw new Error("No products found in catalog file");
      }

      // Extract and upload images from ZIP
      const productsWithImages = parsedProducts.filter(p => p.imageUrl).length;
      if (productsWithImages > 0) {
        setImportProgress({
          status: "uploading",
          message: `Uploading ${productsWithImages} product images...`,
          progress: 50,
        });

        for (const product of parsedProducts) {
          if (product.imageUrl) {
            try {
              // Try to find the image file in the ZIP
              const imageFile = Object.keys(zipContent.files).find((name) =>
                name.toLowerCase().endsWith(product.imageUrl!.toLowerCase())
              );

              if (imageFile) {
                const imageData = await zipContent.files[imageFile].async("arraybuffer");
                // Convert to base64 for transmission
                const base64Data = btoa(
                  new Uint8Array(imageData).reduce((data, byte) => data + String.fromCharCode(byte), "")
                );

                // Upload via tRPC
                const uploadResult = await uploadImage.mutateAsync({
                  productCode: product.code,
                  imageData: base64Data,
                  mimeType: "image/jpeg",
                });

                if (uploadResult.success) {
                  product.catalogImageUrl = uploadResult.url; // Store S3 URL
                }
              }
            } catch (err) {
              console.warn(`Failed to upload image for ${product.code}:`, err);
              // Continue without image if upload fails
            }
          }
        }
      }

      setImportProgress({
        status: "importing",
        message: `Found ${parsedProducts.length} products. Importing to database...`,
        progress: 60,
      });

      // Execute import
      const importResult = await executeImport.mutateAsync({
        importId: initResult.importId,
        distributorId: Number(distributorId),
        products: parsedProducts,
        preservePricing,
      });

      setImportProgress({
        status: "completed",
        message: `Import complete! Created: ${importResult.stats.created}, Updated: ${importResult.stats.updated}, Skipped: ${importResult.stats.skipped}`,
        progress: 100,
      });

      toast.success("Import completed successfully");
      setSelectedFile(null);

      // Refresh import list
      listImports.refetch();

      // Save result for persistent display and reset progress
      setImportResult({
        created: importResult.stats.created,
        updated: importResult.stats.updated,
        skipped: importResult.stats.skipped,
        errors: importResult.stats.errors?.length ?? 0,
        fileName: selectedFile.name,
      });
      setImportProgress(null);
      setIsProcessing(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${errorMsg}`);
      setImportProgress({
        status: "failed",
        message: errorMsg,
        progress: 0,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">20/20 Catalog Importer</h1>
          <p className="text-gray-500 mt-2">
            Upload distributor catalogs to automatically sync products and pricing
          </p>
        </div>

        {/* Upload Form */}
        <Card className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="distributor">Distributor</Label>
            {distsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Spinner className="h-4 w-4" /> Loading vendors…
              </div>
            ) : (
              <Select
                value={distributorId !== "" ? String(distributorId) : ""}
                onValueChange={(v) => setDistributorId(Number(v))}
                disabled={isProcessing}
              >
                <SelectTrigger id="distributor" className="w-full">
                  <SelectValue placeholder="Choose a vendor…" />
                </SelectTrigger>
                <SelectContent>
                  {(distList ?? []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {`${d.brandName || d.name}  (ID: ${d.id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Add New Vendor */}
            {!showNewVendor ? (
              <button
                type="button"
                onClick={() => setShowNewVendor(true)}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                disabled={isProcessing}
              >
                <Plus className="h-3.5 w-3.5" /> Add new vendor
              </button>
            ) : (
              <div className="border border-border rounded-lg p-4 space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">New Vendor</h3>
                  <button type="button" onClick={() => setShowNewVendor(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company Name *</Label>
                  <Input
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="e.g. Acme Cabinets"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Brand Name (optional)</Label>
                  <Input
                    value={newVendorBrand}
                    onChange={(e) => setNewVendorBrand(e.target.value)}
                    placeholder="e.g. Acme"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newVendorName.trim() || addDistributor.isPending}
                    onClick={() => addDistributor.mutate({ name: newVendorName.trim(), brandName: newVendorBrand.trim() || undefined })}
                  >
                    {addDistributor.isPending ? <Spinner className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    Create Vendor
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewVendor(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Catalog Zip File</Label>
            <Input
              id="file"
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
            )}
          </div>

          {/* ── Master Catalog CSV upload ── */}
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="csvfile" className="font-semibold">
              Or upload Master Catalog CSV
            </Label>
            <p className="text-xs text-gray-500">
              Upload the CSV exported from this site (Admin → Export Catalog). Columns: Code, Description, Category, Width, Height, Depth, Doors, Drawers.
            </p>
            <Input
              id="csvfile"
              type="file"
              accept=".csv"
              onChange={handleCsvSelect}
              disabled={csvProcessing || isProcessing}
            />
            {csvFile && (
              <p className="text-sm text-gray-600">Selected: {csvFile.name}</p>
            )}
            <Button
              onClick={handleCsvImport}
              disabled={!csvFile || !distributorId || csvProcessing || isProcessing}
              variant="outline"
              className="w-full"
            >
              {csvProcessing ? "Importing CSV..." : "Import Master Catalog CSV"}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="preserve"
              checked={preservePricing}
              onChange={(e) => setPreservePricing(e.target.checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="preserve" className="cursor-pointer">
              Preserve existing pricing (don't overwrite)
            </Label>
          </div>

          <Button
            onClick={handleImport}
            disabled={!selectedFile || !distributorId || isProcessing}
            className="w-full"
          >
            {isProcessing ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {isProcessing ? "Importing..." : "Import Catalog"}
          </Button>

         {importProgress && (
           <CatalogImportProgress
             status={importProgress.status}
             message={importProgress.message}
             progress={importProgress.progress}
           />
         )}

          {/* Persistent result card — stays until dismissed */}
          {importResult && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-green-900">Import Successful</p>
                  <p className="text-sm text-green-800 mt-1">
                    {importResult.fileName}
                  </p>
                  <div className="text-sm text-green-700 mt-2 space-y-1">
                    <p>✓ Created: {importResult.created}</p>
                    <p>✓ Updated: {importResult.updated}</p>
                    <p>✓ Skipped: {importResult.skipped}</p>
                    {importResult.errors > 0 && <p>⚠ Errors: {importResult.errors}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setImportResult(null)}
                  className="text-green-600 hover:text-green-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Import History */}
        {listImports.data && listImports.data.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Imports</h2>
            <div className="space-y-3">
              {listImports.data.map((imp) => (
                <div key={imp.id} className="p-3 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{imp.fileName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(imp.uploadedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {imp.cabinetCount} cabinets, {imp.skuCount} SKUs
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${
                      imp.status === "completed" ? "bg-green-100 text-green-800" :
                      imp.status === "failed" ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {imp.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
