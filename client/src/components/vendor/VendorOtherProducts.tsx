import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Image as ImageIcon, Loader2, PackagePlus, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { GENERIC_SUPPLIER_PRODUCT_IMAGE } from "@/lib/genericSupplierProductImage";
import { splitCsvLine, splitCsvRows } from "@shared/distributorImport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALL = "__all__";
const SKIP = "__skip__";

type ProductRow = {
  id: number;
  distributorId: number;
  vendorSku: string;
  name: string;
  description: string | null;
  category: string | null;
  listPrice: string | null;
  yourCost: string | null;
  imageUrl: string | null;
  pkgLength: string | null;
  pkgWidth: string | null;
  pkgHeight: string | null;
  pkgWeight: string | null;
  isAvailable: boolean;
  status: "approved" | "pending" | "rejected";
  isPublished: boolean;
};

type Editor = {
  id?: number;
  vendorSku: string;
  name: string;
  description: string;
  category: string;
  listPrice: string;
  yourCost: string;
  pkgLength: string;
  pkgWidth: string;
  pkgHeight: string;
  pkgWeight: string;
  isAvailable: boolean;
  imageUrl?: string | null;
};

type MappingRole = "vendorSku" | "name" | "description" | "category" | "listPrice" | "yourCost" | "pkgLength" | "pkgWidth" | "pkgHeight" | "pkgWeight" | "isAvailable";
type Mapping = Record<MappingRole, string>;

const ROLES: Array<{ role: MappingRole; label: string; required?: boolean }> = [
  { role: "vendorSku", label: "SKU / product code", required: true },
  { role: "name", label: "Product name", required: true },
  { role: "description", label: "Description" },
  { role: "category", label: "Category" },
  { role: "listPrice", label: "List / regular price" },
  { role: "yourCost", label: "Cost" },
  { role: "pkgLength", label: "Package length (in)" },
  { role: "pkgWidth", label: "Package width (in)" },
  { role: "pkgHeight", label: "Package height (in)" },
  { role: "pkgWeight", label: "Package weight (lb)" },
  { role: "isAvailable", label: "Available / stock status" },
];

const EMPTY_EDITOR: Editor = {
  vendorSku: "", name: "", description: "", category: "", listPrice: "", yourCost: "",
  pkgLength: "", pkgWidth: "", pkgHeight: "", pkgWeight: "", isAvailable: true,
};

function money(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : "—";
}

function numberOrUndefined(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function statusBadge(status: ProductRow["status"], published: boolean) {
  if (status === "approved" && published) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function suggestMapping(headers: string[]): Mapping {
  const find = (...terms: string[]) => {
    const index = headers.findIndex((header) => terms.some((term) => header.toLowerCase().replace(/[^a-z0-9]/g, "").includes(term)));
    return index >= 0 ? String(index) : SKIP;
  };
  return {
    vendorSku: find("sku", "productcode", "itemcode", "model", "partnumber"),
    name: find("productname", "itemname", "name", "title"),
    description: find("description", "desc"),
    category: find("category", "producttype", "type"),
    listPrice: find("listprice", "regularprice", "msrp", "retail", "price"),
    yourCost: find("cost", "dealerprice", "net"),
    pkgLength: find("packagelength", "length"),
    pkgWidth: find("packagewidth", "width"),
    pkgHeight: find("packageheight", "height"),
    pkgWeight: find("packageweight", "weight"),
    isAvailable: find("availability", "available", "instock", "stockstatus"),
  };
}

function cell(cells: string[], mapping: Mapping, role: MappingRole) {
  const mapped = mapping[role];
  return mapped !== SKIP ? (cells[Number(mapped)] ?? "").trim() : "";
}

function yesNo(raw: string) {
  return ["true", "1", "yes", "y", "in stock", "instock", "available"].includes(raw.trim().toLowerCase());
}

function editorFrom(row?: ProductRow): Editor {
  if (!row) return { ...EMPTY_EDITOR };
  return {
    id: row.id,
    vendorSku: row.vendorSku,
    name: row.name,
    description: row.description ?? "",
    category: row.category ?? "",
    listPrice: row.listPrice ?? "",
    yourCost: row.yourCost ?? "",
    pkgLength: row.pkgLength ?? "",
    pkgWidth: row.pkgWidth ?? "",
    pkgHeight: row.pkgHeight ?? "",
    pkgWeight: row.pkgWeight ?? "",
    isAvailable: row.isAvailable,
    imageUrl: row.imageUrl,
  };
}

/** WooCommerce/Magento-style supplier import for non-cabinet merchandise. */
export function VendorOtherProducts({ distributorId }: { distributorId?: number }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>(() => suggestMapping([]));
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const input = useMemo(() => ({
    ...(distributorId ? { distributorId } : {}),
    search: search.trim() || undefined,
    category: category === ALL ? undefined : category,
    status,
    limit: 300,
  }), [category, distributorId, search, status]);
  const products = trpc.distributorPortal.vendorProducts.useQuery(input);
  const save = trpc.distributorPortal.saveVendorProduct.useMutation({
    onSuccess: () => {
      toast.success("Product saved.");
      setEditor(null);
      void utils.distributorPortal.vendorProducts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const bulkImport = trpc.distributorPortal.importVendorProducts.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.created} new and updated ${result.updated} products. Nothing was deleted.`);
      setImportOpen(false);
      void utils.distributorPortal.vendorProducts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const upload = trpc.distributorPortal.updateVendorProductImage.useMutation({
    onSuccess: () => {
      toast.success("Verified product image uploaded.");
      setUploadTarget(null);
      void utils.distributorPortal.vendorProducts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const preview = useMemo(() => csvRows.slice(0, 5).map((cells) => ({
    vendorSku: cell(cells, mapping, "vendorSku"),
    name: cell(cells, mapping, "name"),
    category: cell(cells, mapping, "category"),
    price: cell(cells, mapping, "listPrice") || cell(cells, mapping, "yourCost"),
  })), [csvRows, mapping]);

  const importRows = useMemo(() => csvRows.map((cells) => {
    const listPrice = numberOrUndefined(cell(cells, mapping, "listPrice"));
    const yourCost = numberOrUndefined(cell(cells, mapping, "yourCost"));
    const pkgLength = numberOrUndefined(cell(cells, mapping, "pkgLength"));
    const pkgWidth = numberOrUndefined(cell(cells, mapping, "pkgWidth"));
    const pkgHeight = numberOrUndefined(cell(cells, mapping, "pkgHeight"));
    const pkgWeight = numberOrUndefined(cell(cells, mapping, "pkgWeight"));
    return {
      vendorSku: cell(cells, mapping, "vendorSku"),
      name: cell(cells, mapping, "name"),
      ...(cell(cells, mapping, "description") ? { description: cell(cells, mapping, "description") } : {}),
      ...(cell(cells, mapping, "category") ? { category: cell(cells, mapping, "category") } : {}),
      ...(listPrice !== undefined ? { listPrice } : {}),
      ...(yourCost !== undefined ? { yourCost } : {}),
      ...(pkgLength !== undefined ? { pkgLength } : {}),
      ...(pkgWidth !== undefined ? { pkgWidth } : {}),
      ...(pkgHeight !== undefined ? { pkgHeight } : {}),
      ...(pkgWeight !== undefined ? { pkgWeight } : {}),
      ...(mapping.isAvailable !== SKIP ? { isAvailable: yesNo(cell(cells, mapping, "isAvailable")) } : {}),
    };
  }), [csvRows, mapping]);

  const loadCsv = async (file: File) => {
    try {
      const lines = splitCsvRows(await file.text()).filter((line) => line.trim());
      if (lines.length < 2) throw new Error("The file needs one header row and at least one product row.");
      const nextHeaders = splitCsvLine(lines[0]);
      setHeaders(nextHeaders);
      setCsvRows(lines.slice(1).map(splitCsvLine));
      setMapping(suggestMapping(nextHeaders));
      setFileName(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that CSV file.");
    }
  };

  const submitEditor = (mode: "draft" | "publish") => {
    if (!editor) return;
    const numeric = [editor.listPrice, editor.yourCost, editor.pkgLength, editor.pkgWidth, editor.pkgHeight, editor.pkgWeight].map(numberOrUndefined);
    if (numeric.some(Number.isNaN)) {
      toast.error("Use valid numbers for prices and package measurements.");
      return;
    }
    save.mutate({
      ...(distributorId ? { distributorId } : {}),
      ...(editor.id ? { id: editor.id } : {}),
      vendorSku: editor.vendorSku.trim(),
      name: editor.name.trim(),
      description: editor.description.trim() || null,
      category: editor.category.trim() || null,
      listPrice: numberOrUndefined(editor.listPrice) ?? null,
      yourCost: numberOrUndefined(editor.yourCost) ?? null,
      pkgLength: numberOrUndefined(editor.pkgLength) ?? null,
      pkgWidth: numberOrUndefined(editor.pkgWidth) ?? null,
      pkgHeight: numberOrUndefined(editor.pkgHeight) ?? null,
      pkgWeight: numberOrUndefined(editor.pkgWeight) ?? null,
      isAvailable: editor.isAvailable,
      mode,
    });
  };

  const uploadImage = async (file: File) => {
    if (!uploadTarget) return;
    try {
      const base64 = (await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));
      upload.mutate({ ...(distributorId ? { distributorId } : {}), id: uploadTarget, imageBase64: base64, contentType: file.type || "image/jpeg", fileName: file.name });
    } catch {
      toast.error("Could not read that image file.");
      setUploadTarget(null);
    }
  };

  const canImport = mapping.vendorSku !== SKIP && mapping.name !== SKIP && importRows.length > 0
    && importRows.every((row) => row.vendorSku && row.name && !Object.values(row).some(Number.isNaN));

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h2 className="text-xl font-bold">Other Products</h2>
        <p className="text-sm text-muted-foreground">For non-cabinet merchandise—appliances, hardware, fixtures, flooring, and other supplier products.</p>
      </div>
      <Badge variant="outline">{products.data?.items.length ?? 0} products</Badge>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Import spreadsheet</Button>
        <Button onClick={() => setEditor(editorFrom())}><Plus className="mr-2 h-4 w-4" />Add product</Button>
      </div>
    </div>

    <Card className="border-sky-200 bg-sky-50/40">
      <CardContent className="p-4 text-sm text-sky-950">
        <strong>Familiar catalog-import workflow:</strong> upload a CSV, map its columns, preview the first rows, then import. Existing matching SKUs are updated; no product is deleted. New rows begin as drafts until their source details are complete and intentionally published.
      </CardContent>
    </Card>

    <div className="flex flex-wrap gap-2">
      <Input className="h-9 w-60" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, name, or category…" />
      <Select value={category} onValueChange={setCategory}><SelectTrigger className="h-9 w-44"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{products.data?.categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Drafts</SelectItem><SelectItem value="approved">Published</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
    </div>

	    {products.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : products.data?.items.length ? <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Image</TableHead><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">List</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Package</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Manage</TableHead></TableRow></TableHeader><TableBody>{(products.data.items as ProductRow[]).map((product) => <TableRow key={product.id}><TableCell><div className="space-y-1"><img src={product.imageUrl || GENERIC_SUPPLIER_PRODUCT_IMAGE} alt={product.imageUrl ? product.name : "Generic supplier product—verified image pending"} className="h-11 w-11 rounded border object-cover" />{!product.imageUrl && <span className="block max-w-16 text-[9px] leading-tight text-amber-700">Generic placeholder</span>}</div></TableCell><TableCell><div className="font-medium">{product.name}</div><div className="font-mono text-xs text-muted-foreground">{product.vendorSku}</div></TableCell><TableCell>{product.category || <span className="text-muted-foreground">Uncategorized</span>}</TableCell><TableCell className="text-right">{money(product.listPrice)}</TableCell><TableCell className="text-right">{money(product.yourCost)}</TableCell><TableCell className="text-xs text-muted-foreground">{product.pkgLength && product.pkgWidth && product.pkgHeight && product.pkgWeight ? `${product.pkgLength} × ${product.pkgWidth} × ${product.pkgHeight} in · ${product.pkgWeight} lb` : "Details needed"}</TableCell><TableCell>{statusBadge(product.status, product.isPublished)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" title="Edit product" onClick={() => setEditor(editorFrom(product))}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" title="Upload verified product image" disabled={upload.isPending} onClick={() => { setUploadTarget(product.id); imageRef.current?.click(); }}>{upload.isPending && uploadTarget === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><PackagePlus className="mx-auto mb-2 h-8 w-8" />No non-cabinet products match these filters. Add one or import a spreadsheet.</CardContent></Card>}

    <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} />

    <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editor?.id ? "Edit other product" : "Add other product"}</DialogTitle></DialogHeader>{editor && <div className="space-y-4"><p className="text-sm text-muted-foreground">A generic carton image is shown until the vendor uploads an exact product image. Publishing requires source description, source price, and package dimensions/weight.</p><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>SKU <span className="text-destructive">*</span></Label><Input value={editor.vendorSku} onChange={(event) => setEditor({ ...editor, vendorSku: event.target.value })} /></div><div className="space-y-1"><Label>Product name <span className="text-destructive">*</span></Label><Input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></div><div className="space-y-1 sm:col-span-2"><Label>Source description</Label><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></div><div className="space-y-1"><Label>Category</Label><Input value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} placeholder="e.g. Appliances" /></div><div className="flex items-center justify-between rounded-md border px-3 py-2"><div><Label>Available from supplier</Label><p className="text-xs text-muted-foreground">Keep in records if unavailable.</p></div><Switch checked={editor.isAvailable} onCheckedChange={(isAvailable) => setEditor({ ...editor, isAvailable })} /></div><div className="space-y-1"><Label>List price</Label><Input inputMode="decimal" value={editor.listPrice} onChange={(event) => setEditor({ ...editor, listPrice: event.target.value })} /></div><div className="space-y-1"><Label>Your cost</Label><Input inputMode="decimal" value={editor.yourCost} onChange={(event) => setEditor({ ...editor, yourCost: event.target.value })} /></div></div><div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><h3 className="font-medium text-amber-950">Shipping package information</h3><p className="mb-3 text-xs text-amber-900">Required before this product can be published or quoted for freight.</p><div className="grid gap-3 sm:grid-cols-4">{([ ["pkgLength", "Length (in)"], ["pkgWidth", "Width (in)"], ["pkgHeight", "Height (in)"], ["pkgWeight", "Weight (lb)"] ] as const).map(([key, label]) => <div className="space-y-1" key={key}><Label className="text-xs">{label}</Label><Input inputMode="decimal" value={editor[key]} onChange={(event) => setEditor({ ...editor, [key]: event.target.value })} /></div>)}</div></div></div>}<DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button><Button variant="outline" disabled={save.isPending} onClick={() => submitEditor("draft")}>Save draft</Button><Button disabled={save.isPending} onClick={() => submitEditor("publish")}>{save.isPending ? "Saving…" : "Publish product"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Import other products</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">This mirrors a WooCommerce/Magento CSV import: upload, map columns, preview, then import. CSV export is supported. No current product is deleted; new rows remain Draft.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{fileName ? `Replace ${fileName}` : "Choose CSV file"}</Button><Button size="sm" variant="ghost" onClick={() => { const csv = "SKU,Name,Description,Category,Regular price,Cost,Package length,Package width,Package height,Weight,In stock\nEXAMPLE-001,Example accessory,Source description,Hardware,99.00,55.00,12,8,4,3,true\n"; const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "other-products-template.csv"; anchor.click(); URL.revokeObjectURL(url); }}><FileSpreadsheet className="mr-2 h-4 w-4" />Download template</Button></div><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadCsv(file); event.target.value = ""; }} />{headers.length > 0 && <><div className="grid gap-3 sm:grid-cols-2">{ROLES.map(({ role, label, required }) => <div className="space-y-1" key={role}><Label className="text-xs">{label}{required ? " *" : ""}</Label><Select value={mapping[role]} onValueChange={(value) => setMapping({ ...mapping, [role]: value })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={SKIP}>Do not import</SelectItem>{headers.map((header, index) => <SelectItem key={`${index}-${header}`} value={String(index)}>{header || `Column ${index + 1}`}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead></TableRow></TableHeader><TableBody>{preview.map((row, index) => <TableRow key={index}><TableCell>{row.vendorSku || "—"}</TableCell><TableCell>{row.name || "—"}</TableCell><TableCell>{row.category || "—"}</TableCell><TableCell>{row.price || "—"}</TableCell></TableRow>)}</TableBody></Table></div></>}</div><DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button><Button disabled={!canImport || bulkImport.isPending} onClick={() => bulkImport.mutate({ ...(distributorId ? { distributorId } : {}), rows: importRows })}>{bulkImport.isPending ? "Importing…" : `Import ${importRows.length || ""} products`}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
