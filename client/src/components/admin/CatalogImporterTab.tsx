import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import JSZip from "jszip";
import { CheckCircle, Upload, Eye, RefreshCw } from "lucide-react";

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
}

export default function CatalogImporterTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [distributorId, setDistributorId] = useState<number | "">("");
  const [preservePricing, setPreservePricing] = useState(true);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    message: string;
  } | null>(null);

  // ── Apply Master Catalog CSV ─────────────────────────────────────────────
  const [masterCsvFile, setMasterCsvFile] = useState<File | null>(null);
  const [masterCsvText, setMasterCsvText] = useState<string | null>(null);
  const [masterPreview, setMasterPreview] = useState<{
    updated: number; notFound: number; skipped: number; notFoundCodes: string[];
  } | null>(null);
  const [masterApplying, setMasterApplying] = useState(false);
  const [masterResult, setMasterResult] = useState<{
    updated: number; notFound: number; skipped: number;
  } | null>(null);
  const applyMasterCatalog = trpc.catalogImport.applyMasterCatalog.useMutation();
  const handleMasterCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { toast.error("Please select a .csv file"); return; }
    setMasterCsvFile(file); setMasterPreview(null); setMasterResult(null);
    setMasterCsvText(await file.text());
    toast.success(`Loaded: ${file.name} — click Preview to check before applying`);
  };
  const handleMasterPreview = async () => {
    if (!masterCsvText) return;
    setMasterApplying(true);
    try { setMasterPreview(await applyMasterCatalog.mutateAsync({ csvText: masterCsvText, dryRun: true })); }
    catch (err) { toast.error(`Preview failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setMasterApplying(false); }
  };
  const handleMasterApply = async () => {
    if (!masterCsvText) return;
    setMasterApplying(true); setMasterResult(null);
    try {
      const result = await applyMasterCatalog.mutateAsync({ csvText: masterCsvText, dryRun: false });
      setMasterResult(result); setMasterPreview(null); setMasterCsvFile(null); setMasterCsvText(null);
      toast.success(`✅ Applied! ${result.updated} cabinets updated.`);
    } catch (err) { toast.error(`Apply failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setMasterApplying(false); }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const initializeImport = trpc.catalogImport.initializeImport.useMutation();
  const executeImport = trpc.catalogImport.executeImport.useMutation();
  const listImports = trpc.catalogImport.listImports.useQuery(
    { distributorId: Number(distributorId) },
    { enabled: distributorId !== "" }
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
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
    setImportProgress({ status: "extracting", message: "Extracting zip file..." });

    try {
      // Extract zip file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(selectedFile);

      setImportProgress({ status: "parsing", message: "Detecting catalog format..." });

      // Detect format: NAC DataPack (has CatInfo.Xml + ConversionData CSVs) vs classic PAF XML
      let parsedProducts: PafProduct[];
      if (isDataPackFormat(zipContent)) {
        setImportProgress({ status: "parsing", message: "Parsing NAC DataPack catalog (CSV format)..." });
        parsedProducts = await parseDataPackZip(zipContent);
      } else {
        // Classic PAF XML path
        const pafFile = Object.keys(zipContent.files).find((name) =>
          name.toLowerCase().endsWith("paf.xml")
        );
        if (!pafFile) {
          toast.error("No recognized catalog format found (expected paf.xml or NAC DataPack CSVs)");
          setIsProcessing(false);
          return;
        }
        setImportProgress({ status: "parsing", message: "Parsing PAF XML..." });
        const xmlContent = await zipContent.files[pafFile].async("text");
        parsedProducts = parseSimplePafXml(xmlContent);
      }

      // Initialize import record
      setImportProgress({ status: "initializing", message: "Initializing import..." });
      const initResult = await initializeImport.mutateAsync({
        distributorId: Number(distributorId),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        preservePricing,
      });

      if (parsedProducts.length === 0) {
        throw new Error("No products found in catalog file");
      }

      setImportProgress({
        status: "importing",
        message: `Found ${parsedProducts.length} products. Importing to database...`,
      });

      // Execute import with real parsed products
      const importResult = await executeImport.mutateAsync({
        importId: initResult.importId,
        distributorId: Number(distributorId),
        products: parsedProducts,
        preservePricing,
      });

      setImportProgress({
        status: "completed",
        message: `Import complete! Created: ${importResult.stats.created}, Updated: ${importResult.stats.updated}, Skipped: ${importResult.stats.skipped}`,
      });

      toast.success("Import completed successfully");
      setSelectedFile(null);
      setDistributorId("");

      // Refresh import list
      listImports.refetch();

      // Reset after 10 seconds (give user time to read the result)
      setTimeout(() => {
        setImportProgress(null);
        setIsProcessing(false);
      }, 10000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${errorMsg}`);
      setImportProgress({
        status: "failed",
        message: errorMsg,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Apply Master Catalog CSV ── */}
      <Card className="p-6 space-y-5 border-2 border-amber-200 bg-amber-50/40">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Apply Master Catalog CSV</h3>
            <p className="text-sm text-amber-700 mt-0.5">Upload the master catalog CSV to update descriptions, categories, dimensions, door/drawer counts, and graphic types for all matching cabinets.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="master-csv-file" className="text-amber-900 font-medium">Master Catalog CSV File</Label>
          <Input id="master-csv-file" type="file" accept=".csv" onChange={handleMasterCsvSelect} disabled={masterApplying} className="bg-white border-amber-300" />
          {masterCsvFile && <p className="text-sm text-amber-700">📄 {masterCsvFile.name} ({(masterCsvFile.size / 1024).toFixed(1)} KB)</p>}
        </div>
        {masterPreview && (
          <div className="rounded-lg border border-amber-300 bg-white p-4 space-y-3">
            <p className="font-semibold text-amber-900">Preview — no changes made yet</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-green-50 border border-green-200 p-3"><p className="text-2xl font-bold text-green-700">{masterPreview.updated}</p><p className="text-xs text-green-600 mt-0.5">Will update</p></div>
              <div className="rounded-md bg-red-50 border border-red-200 p-3"><p className="text-2xl font-bold text-red-700">{masterPreview.notFound}</p><p className="text-xs text-red-600 mt-0.5">Not in DB</p></div>
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3"><p className="text-2xl font-bold text-gray-600">{masterPreview.skipped}</p><p className="text-xs text-gray-500 mt-0.5">Skipped</p></div>
            </div>
            {masterPreview.notFoundCodes.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                <span className="font-medium">Not found: </span>{masterPreview.notFoundCodes.slice(0, 10).join(", ")}{masterPreview.notFoundCodes.length > 10 && ` … +${masterPreview.notFoundCodes.length - 10} more`}
              </div>
            )}
          </div>
        )}
        {masterResult && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <div><p className="font-semibold text-green-800">Applied successfully</p><p className="text-sm text-green-700">{masterResult.updated} updated · {masterResult.notFound} not found · {masterResult.skipped} skipped</p></div>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleMasterPreview} disabled={!masterCsvFile || masterApplying} className="flex-1 border-amber-400 text-amber-800 hover:bg-amber-100">
            {masterApplying && !masterPreview ? <><Spinner className="h-4 w-4 mr-2" />Previewing…</> : <><Eye className="h-4 w-4 mr-2" />Preview Changes</>}
          </Button>
          <Button onClick={handleMasterApply} disabled={!masterCsvFile || masterApplying || !masterPreview} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
            {masterApplying && masterPreview ? <><Spinner className="h-4 w-4 mr-2" />Applying…</> : <><Upload className="h-4 w-4 mr-2" />Apply to Database</>}
          </Button>
        </div>
        <p className="text-xs text-amber-600">Always preview before applying. Updates all matching cabinets by their Code.</p>
      </Card>

      {/* Upload Form */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Upload 20/20 Catalog</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload distributor catalogs to automatically sync products and pricing
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="distributor">Distributor ID</Label>
          <Input
            id="distributor"
            type="number"
            placeholder="Enter distributor ID"
            value={distributorId}
            onChange={(e) => setDistributorId(e.target.value ? Number(e.target.value) : "")}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">Catalog Zip File</Label>
          <Input
            id="file"
            type="file"
            accept=".zip,.ZIP"
            onChange={handleFileSelect}
            disabled={isProcessing}
          />
          {selectedFile && (
            <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
          )}
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

        {importProgress && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              {importProgress.status === "completed" ? (
                <div className="text-green-600">✓</div>
              ) : importProgress.status === "failed" ? (
                <div className="text-red-600">✗</div>
              ) : (
                <Spinner className="h-4 w-4" />
              )}
              <div>
                <p className="font-semibold capitalize">{importProgress.status}</p>
                <p className="text-sm text-gray-600">{importProgress.message}</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!selectedFile || !distributorId || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              Processing...
            </>
          ) : (
            "Start Import"
          )}
        </Button>
      </Card>

      {/* Import History */}
      {distributorId && listImports.data && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Import History</h3>
          {listImports.data.length === 0 ? (
            <p className="text-gray-500">No imports yet for this distributor</p>
          ) : (
            <div className="space-y-3">
              {listImports.data.map((imp) => (
                <div
                  key={imp.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{imp.fileName}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(imp.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        imp.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : imp.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : imp.status === "processing"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {imp.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Cabinets: {imp.cabinetCount} | SKUs: {imp.skuCount} | Images: {imp.imageCount}</p>
                    {imp.errorLog && imp.errorLog.length > 0 && (
                      <p className="text-red-600">
                        Errors: {imp.errorLog.length}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NAC DataPack format detection and parsing
// ---------------------------------------------------------------------------

/**
 * Detect whether a ZIP file is an NAC DataPack format.
 * DataPack ZIPs contain a CatInfo.Xml at the root and at least one
 * {catalog}/ConversionData/Pricing/10_Products.csv file.
 */
function isDataPackFormat(zipContent: InstanceType<typeof JSZip>): boolean {
  const fileNames = Object.keys(zipContent.files);
  const hasCatInfo = fileNames.some(
    (n) => n === "CatInfo.Xml" || n.toLowerCase() === "catinfo.xml"
  );
  const hasProductsCsv = fileNames.some((n) =>
    n.toLowerCase().includes("conversiondata/pricing/10_products.csv")
  );
  return hasCatInfo && hasProductsCsv;
}

/**
 * Parse an NAC DataPack ZIP file.
 *
 * Structure:
 *   CatInfo.Xml                                          — lists catalog directories
 *   {catalog}/ConversionData/Pricing/10_Products.csv    — SKU list
 *   {catalog}/ConversionData/Pricing/72_PriceTags_Default.csv — prices
 *
 * We use the first catalog directory found (NAC1 and NAC2 are identical).
 * Price rule PR00011 = base price; we use price group PG02 as the list price.
 */
async function parseDataPackZip(zipContent: InstanceType<typeof JSZip>): Promise<PafProduct[]> {
  const fileNames = Object.keys(zipContent.files);

  // Find the first catalog directory that has the products CSV
  const productsCsvPath = fileNames.find((n) =>
    n.toLowerCase().includes("conversiondata/pricing/10_products.csv")
  );
  if (!productsCsvPath) return [];

  // Derive the catalog prefix (e.g. "NAC1/")
  const catalogPrefix = productsCsvPath.substring(
    0,
    productsCsvPath.toLowerCase().indexOf("conversiondata/")
  );

  // Read products CSV (columns: ProductGroup,Code,Name_en-US,Description_en-US)
  const productsCsvText = await zipContent.files[productsCsvPath].async("text");
  const productRows = parseSimpleCsv(productsCsvText);

  // Read pricing CSV (columns: PriceListRef,PriceRuleRef,Rank,Key1,KeyTxt1,Key2,KeyTxt2,Value,...)
  const priceCsvPath = fileNames.find(
    (n) =>
      n.startsWith(catalogPrefix) &&
      n.toLowerCase().includes("conversiondata/pricing/72_pricetags_default.csv")
  );
  const priceMap: Record<string, number> = {};
  if (priceCsvPath) {
    const priceCsvText = await zipContent.files[priceCsvPath].async("text");
    const priceRows = parseSimpleCsv(priceCsvText);
    // We want rows where PriceRuleRef=PR00011 and Key2=O.PG02 (base price group)
    for (const row of priceRows) {
      if (row[1] === "PR00011" && row[5] === "O.PG02") {
        const sku = row[4]; // KeyTxt1 = SKU code (e.g. "BT09-R")
        const price = parseFloat(row[7]);
        if (sku && !isNaN(price)) {
          priceMap[sku] = price;
        }
      }
    }
  }

  const products: PafProduct[] = [];
  for (const row of productRows) {
    // Columns (0-indexed): ProductGroup, Code, Name_en-US, Description_en-US
    if (row[0] !== "Product") continue;
    const sku = row[2]; // Name_en-US = the SKU code (e.g. "BT09-R")
    const description = row[3] || sku;
    if (!sku) continue;

    const product: PafProduct = {
      code: sku.toUpperCase(),
      description,
      category: inferCategoryFromNacSku(sku),
    };

    if (priceMap[sku] !== undefined) {
      product.listPrice = priceMap[sku];
    }

    products.push(product);
  }

  return products;
}

/**
 * Parse a CSV string into an array of string arrays (rows × columns).
 * Handles quoted fields. Skips the header row.
 */
function parseSimpleCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let isFirst = true;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isFirst) {
      isFirst = false;
      continue; // skip header row
    }
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

/**
 * Infer cabinet category from NAC SKU code patterns.
 */
function inferCategoryFromNacSku(sku: string): string {
  const s = sku.toUpperCase();
  if (/^W\d/.test(s) || s.startsWith("WDC") || s.startsWith("WBC") || s.startsWith("WEC") || s.startsWith("WB")) return "Wall Cabinet";
  if (/^T\d/.test(s) || s.startsWith("OT") || s.startsWith("UT") || s.startsWith("PT")) return "Tall Cabinet";
  if (/^V\d/.test(s) || s.startsWith("VDB") || s.startsWith("VB")) return "Vanity";
  if (s.startsWith("BT") || s.startsWith("BS") || /^B\d/.test(s) || s.startsWith("SB") || s.startsWith("DB") || s.startsWith("3DB") || s.startsWith("2DB")) return "Base Cabinet";
  return "Base Cabinet";
}

// ---------------------------------------------------------------------------
// Classic PAF XML parser (kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Simple PAF XML parser for browser-side parsing.
 * Extracts basic product information from 20/20 PAF XML format.
 */
function parseSimplePafXml(xmlContent: string): PafProduct[] {
  const products: PafProduct[] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Invalid XML format");
    }

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

      if (product.code && product.description) {
        products.push(product);
      }
    }
  } catch (err) {
    console.error("Error parsing PAF XML:", err);
  }

  return products;
}
