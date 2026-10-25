import { useState, useMemo, useCallback, useRef, useEffect, FormEvent, createContext, useContext } from "react";
import {
  LayoutDashboard, Package, Palette, Star, ClipboardList, Upload,
  Eye, EyeOff, Search, DollarSign, ImageIcon, Check, X, AlertTriangle, Loader2,
	  PlusCircle, Plus, ArrowLeft, ArrowUp, ArrowDown, GripVertical, Truck, MapPin, FileSpreadsheet, Download, BarChart3, Pencil, Trash2, RotateCcw,
	  Sparkles, Clock, CheckCircle2, Send, Link2, CreditCard, FileText, ExternalLink, Ruler, PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { csvEscape } from "@shared/inventoryForecast";
import { VendorOtherProducts } from "@/components/vendor/VendorOtherProducts";
import { VendorFulfillmentQueue } from "@/components/vendor/VendorFulfillmentQueue";
import { VendorCodeUpload } from "@/components/vendor/VendorCodeUpload";
import { PelicanShippingProfilesPanel } from "@/components/admin/ShippingAdmin";
import { designerFrameCompliance } from "@/lib/doorFrameMetrics";
import { US_CABINET_DEPOT_AVAILABILITY_SOURCES, US_CABINET_DEPOT_WAREHOUSES } from "@/lib/vendorWarehouseNetwork";

// ─── Admin Distributor Context ───────────────────────────────────────────────
const AdminDistributorContext = createContext<number | undefined>(undefined);
function useAdminDistributorId(): number | undefined {
  return useContext(AdminDistributorContext);
}
const AdminApprovedVendorContext = createContext<number | undefined>(undefined);
function useAdminApprovedVendorLineId(): number | undefined {
  return useContext(AdminApprovedVendorContext);
}
// Carries the distributor code (e.g. "PEL") so sub-pages can branch on it
const AdminDistributorCodeContext = createContext<string | undefined>(undefined);
function useAdminDistributorCode(): string | undefined {
  return useContext(AdminDistributorCodeContext);
}
// Pelican is a special distributor whose products live in a separate table
const PEL_DIST_CODE = "PEL";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL = "__all__";
const MAX_PICKS = 8;
const CATALOG_PAGE_SIZE = 100;
function money(v: string | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}
function supplierCatalogLineLabel(line: { code: string; name: string }) {
  if (line.code === "USCD") return `Framed — ${line.name}`;
  if (line.code === "AEF") return `Frameless — ${line.name}`;
  return line.name;
}
const MAX_SUPPLIER_RESOURCE_BYTES = 12 * 1024 * 1024;

async function readSupplierPdfAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The PDF could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────
type VendorPage = "overview" | "supplier-profile" | "catalog" | "other-products" | "styles" | "featured-styles" | "shipping" | "picks" | "orders" | "fulfillment" | "promotions" | "gallery" | "analytics" | "ai-services" | "integrations" | "payments";

const NAV_ITEMS: { id: VendorPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "supplier-profile", label: "Supplier Profile", icon: FileText },
  { id: "catalog", label: "My Catalog", icon: Package },
  { id: "other-products", label: "Other Products", icon: Package },
  { id: "styles", label: "Door Styles", icon: Palette },
  { id: "featured-styles", label: "Featured Styles", icon: Star },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "picks", label: "3D Designer Picks", icon: Star },
  { id: "promotions", label: "Promotions", icon: DollarSign },
  { id: "gallery", label: "Gallery", icon: ImageIcon },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "fulfillment", label: "Fulfillment", icon: PackageCheck },
  { id: "ai-services", label: "AI Services", icon: Sparkles },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "payments", label: "Payments", icon: CreditCard },
];

// Pelican has no cabinet supply line, so its portal is limited to the pages that
// apply to surfaces and fixtures.
const PELICAN_NAV_IDS: ReadonlySet<VendorPage> = new Set<VendorPage>(["overview", "supplier-profile", "catalog", "shipping", "fulfillment"]);
// ─── Pelican Vendor Catalog Page ─────────────────────────────────────────────
function PelicanVendorCatalogPage({ initialCategory }: { initialCategory?: string } = {}) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<string>(initialCategory ?? ALL);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", imageUrl: "", yourCost: "", retailPrice: "" });
  const input = useMemo(
    () => ({
      category: category === ALL ? undefined : (category as any),
      search: search.trim() || undefined,
      limit: 200,
      offset: 0,
    }),
    [category, search]
  );
  const { data, isLoading, error } = trpc.pelican.adminList.useQuery(input);
  const setVisibility = trpc.pelican.setVisibility.useMutation({
    onSuccess: () => utils.pelican.adminList.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const setPopular = trpc.pelican.setPopular.useMutation({
    onSuccess: () => utils.pelican.adminList.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const setCoverage = trpc.pelican.setCoverage.useMutation({
    onSuccess: () => utils.pelican.adminList.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const updateProduct = trpc.pelican.updateProduct.useMutation({
    onSuccess: () => { void utils.pelican.adminList.invalidate(); setEditingProduct(null); toast.success("Pelican item saved."); },
    onError: (e) => toast.error(e.message || "Failed to save Pelican item"),
  });

  const openEditor = (item: any) => {
    setEditingProduct(item);
    setDraft({ name: item.name ?? "", description: item.description ?? "", imageUrl: item.imageUrl ?? "", yourCost: item.yourCost == null ? "" : String(item.yourCost), retailPrice: item.retailPrice == null ? "" : String(item.retailPrice) });
  };
  const parseMoney = (value: string, label: string): number | null | undefined => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) { toast.error(`${label} must be a non-negative number.`); return undefined; }
    return Math.round(parsed * 100) / 100;
  };
  const saveEditor = () => {
    if (!editingProduct) return;
    const yourCost = parseMoney(draft.yourCost, "Our cost");
    const retailPrice = parseMoney(draft.retailPrice, "Retail price");
    if (yourCost === undefined || retailPrice === undefined) return;
    if (draft.imageUrl.trim() && !/^https?:\/\//i.test(draft.imageUrl.trim())) { toast.error("Image URL must start with http:// or https://."); return; }
    updateProduct.mutate({ id: editingProduct.id, name: draft.name.trim(), description: draft.description.trim(), imageUrl: draft.imageUrl.trim() || null, yourCost, retailPrice });
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    (data?.items ?? []).forEach((i: any) => { if (i.category) cats.add(i.category); });
    return Array.from(cats).sort();
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <h2 className="text-xl font-bold">Pelican Catalog</h2>
        <Badge variant="outline">{data?.total ?? 0} products</Badge>
        <div className="flex gap-2 ml-auto flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              className="pl-8 h-9 w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CatalogTransferTools />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : error ? (
        <div className="text-destructive p-4">Could not load Pelican products: {error.message}</div>
      ) : !data?.items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No Pelican items match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Sell</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Catalog</TableHead>
                <TableHead className="text-center">Designer</TableHead>
                <TableHead className="text-center">Featured</TableHead>
                <TableHead className="text-right">Sq ft/Box</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell className="p-1.5">
                    {it.imageUrl ? (
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        className="h-10 w-10 object-cover rounded border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded border border-border flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.pelicanCode}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{it.category}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{money(it.yourCost ?? it.listPrice)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {money(it.sellPrice)}
                    {typeof it.markupBps === "number" && (
                      <Badge variant="outline" className="ml-1 text-[10px]">{(it.markupBps / 100).toFixed(0)}%</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={!!it.isActive} onCheckedChange={(v) => setVisibility.mutate({ id: it.id, isActive: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={!!it.showInCatalog} onCheckedChange={(v) => setVisibility.mutate({ id: it.id, showInCatalog: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={!!it.showInDesigner} onCheckedChange={(v) => setVisibility.mutate({ id: it.id, showInDesigner: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm" variant={it.isPopular ? "default" : "outline"}
                      className="h-8 w-8 p-0"
                      onClick={() => setPopular.mutate({ id: it.id, isPopular: !it.isPopular, popularRank: it.popularRank ?? 0 })}
                      title={it.isPopular ? "Unfeature" : "Feature"}
                    >
                      <Star className={`h-4 w-4 ${it.isPopular ? "fill-current" : ""}`} />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {it.coverageSqFt
                      ? <span className="font-medium">{parseFloat(String(it.coverageSqFt)).toFixed(2)}</span>
                      : it.size
                        ? <span className="text-muted-foreground text-xs">{it.size}</span>
                        : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditor(it)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Pelican item</DialogTitle>
            <p className="text-sm text-muted-foreground">{editingProduct?.pelicanCode} · Changes apply to the shared catalog and Designer.</p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-[128px_1fr] sm:items-start">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {draft.imageUrl ? <img src={draft.imageUrl} alt="Preview" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pelican-edit-image">Image URL</Label>
                <Input id="pelican-edit-image" value={draft.imageUrl} placeholder="https://…" onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Paste the approved product image URL. Leave blank to remove it.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pelican-edit-name">Product name</Label>
              <Input id="pelican-edit-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pelican-edit-description">Description</Label>
              <Textarea id="pelican-edit-description" rows={5} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pelican-edit-cost">Our cost</Label>
                <Input id="pelican-edit-cost" inputMode="decimal" placeholder="0.00" value={draft.yourCost} onChange={(e) => setDraft((d) => ({ ...d, yourCost: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pelican-edit-retail">Selling price / retail</Label>
                <Input id="pelican-edit-retail" inputMode="decimal" placeholder="Leave blank to use category markup" value={draft.retailPrice} onChange={(e) => setDraft((d) => ({ ...d, retailPrice: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Blank uses the existing category markup calculation.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
            <Button onClick={saveEditor} disabled={updateProduct.isPending || !draft.name.trim()}>
              {updateProduct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Pelican Vendor Overview Page ─────────────────────────────────────────────
function PelicanVendorOverviewPage({ onNavigateToCatalog }: { onNavigateToCatalog?: (category?: string) => void } = {}) {
  const { data, isLoading } = trpc.pelican.adminList.useQuery({ limit: 1, offset: 0 });
  const categories = trpc.pelican.categories.useQuery({ scope: "catalog" });
  const active = trpc.pelican.adminList.useQuery({ limit: 500, offset: 0 });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
      </div>
    );
  }

  const totalProducts = data?.total ?? 0;
  const activeCount = (active.data?.items ?? []).filter((i: any) => i.isActive).length;
  const categoryCount = categories.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stone Creek Collection (Pelican)</h2>
        <p className="text-muted-foreground">Manage surfaces, fixtures, and tile products.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className={onNavigateToCatalog ? "cursor-pointer hover:border-primary transition-colors" : ""}
          onClick={() => onNavigateToCatalog?.()}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalProducts}</div></CardContent>
        </Card>
        <Card
          className={onNavigateToCatalog ? "cursor-pointer hover:border-primary transition-colors" : ""}
          onClick={() => onNavigateToCatalog?.()}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{categoryCount}</div></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product Categories</CardTitle>
          {onNavigateToCatalog && (
            <p className="text-xs text-muted-foreground">Click a category to filter the catalog</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(categories.data ?? []).map((c: any) => (
              onNavigateToCatalog ? (
                <button
                  key={c.category}
                  onClick={() => onNavigateToCatalog(c.category)}
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  {c.category} ({c.count})
                </button>
              ) : (
                <Badge key={c.category} variant="secondary">{c.category} ({c.count})</Badge>
              )
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Overview Page ────────────────────────────────────────────────────────────
function OverviewPage({ onNavigate }: { onNavigate: (page: VendorPage) => void }) {
  const adminDistId = useAdminDistributorId();
  const myLine = trpc.distributorPortal.myLine.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);

  if (myLine.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (myLine.error) {
    return <div className="text-destructive p-4">Error loading line info: {myLine.error.message}</div>;
  }

  if (!myLine.data) {
    return <div className="p-4 text-muted-foreground">Your vendor line is not available yet. You can still use the portal navigation while the line information is prepared.</div>;
  }

  const { line, counts, styles, approvedVendor } = myLine.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{line.name}</h2>
        <p className="text-muted-foreground">Manage your product line, pricing, and 3D Designer presence.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.pending}</div>
          </CardContent>
        </Card>
	      </div>

	      <div data-testid="vendor-editing-shortcuts" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	        <Card className="border-amber-200 bg-amber-50/40">
	          <CardHeader className="pb-2">
	            <CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-amber-600" />Feature your cabinet styles</CardTitle>
	          </CardHeader>
	          <CardContent className="space-y-3">
	            <p className="text-sm text-muted-foreground">Choose the cabinet-backed door styles to promote, then edit their customer-facing materials, photos, profile details, and style-specific freight origins.</p>
	            <Button onClick={() => onNavigate("featured-styles")}><Pencil className="mr-2 h-4 w-4" />Manage Featured Styles</Button>
	          </CardContent>
	        </Card>
	        <Card className="border-sky-200 bg-sky-50/40">
	          <CardHeader className="pb-2">
	            <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-sky-600" />Manage shipping &amp; warehouses</CardTitle>
	          </CardHeader>
	          <CardContent className="space-y-3">
	            <p className="text-sm text-muted-foreground">Set the warehouse origins, freight rule, lead time, ZIP rates, notes, and pickup details used for your cabinet line.</p>
	            <Button onClick={() => onNavigate("shipping")}><Pencil className="mr-2 h-4 w-4" />Edit Shipping &amp; Warehouses</Button>
	          </CardContent>
	        </Card>
	        <Card className="border-violet-200 bg-violet-50/40">
	          <CardHeader className="pb-2">
	            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-violet-600" />Supplier account &amp; resources</CardTitle>
	          </CardHeader>
	          <CardContent className="space-y-3">
	            <p className="text-sm text-muted-foreground">
	              {approvedVendor
	                ? "View the approved supplier contact record, catalog, specification book, and portal account details for this supply line."
	                : "The approved supplier record has not been linked to this supply line yet. An administrator can link it from Approved Vendors."}
	            </p>
	            <Button variant="outline" onClick={() => onNavigate("supplier-profile")}><Pencil className="mr-2 h-4 w-4" />Edit Supplier Profile</Button>
	          </CardContent>
	        </Card>
	      </div>

	      <Card>
	        <CardHeader>
	          <CardTitle>Door Styles ({styles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <Badge key={s.id} variant="secondary">{s.ourName}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lead Time</span>
            <span>{line.leadTimeDays ?? "—"} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Warehouse Zips</span>
            <span>{(line.warehouseZips as string[] | null)?.join(", ") || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">3D Designer Picks</span>
            <span>{(line.designToolPicks as number[] | null)?.length ?? 0} / {MAX_PICKS}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Supplier Profile & Resources ─────────────────────────────────────────────
type SupplierProfileVendor = {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  notes: string | null;
  catalogPdfUrl: string | null;
  specBookPdfUrl: string | null;
};

function SupplierProfileEditor({
  vendor,
  adminDistributorId,
  adminApprovedVendorLineId,
}: {
  vendor: SupplierProfileVendor;
  adminDistributorId?: number;
  adminApprovedVendorLineId?: number;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contactName: vendor.contactName ?? "",
    contactEmail: vendor.contactEmail ?? "",
    contactPhone: vendor.contactPhone ?? "",
    websiteUrl: vendor.websiteUrl ?? "",
    notes: vendor.notes ?? "",
    catalogPdfUrl: vendor.catalogPdfUrl ?? "",
    specBookPdfUrl: vendor.specBookPdfUrl ?? "",
  });
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const specBookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      contactName: vendor.contactName ?? "",
      contactEmail: vendor.contactEmail ?? "",
      contactPhone: vendor.contactPhone ?? "",
      websiteUrl: vendor.websiteUrl ?? "",
      notes: vendor.notes ?? "",
      catalogPdfUrl: vendor.catalogPdfUrl ?? "",
      specBookPdfUrl: vendor.specBookPdfUrl ?? "",
    });
  }, [open, vendor]);

  const withScope = <T extends Record<string, unknown>>(input: T) => ({
    ...input,
    ...(adminDistributorId ? { distributorId: adminDistributorId } : {}),
    ...(adminApprovedVendorLineId ? { approvedVendorLineId: adminApprovedVendorLineId } : {}),
  });
  const save = trpc.distributorPortal.updateSupplierProfile.useMutation({
    onSuccess: () => {
      void utils.distributorPortal.myLine.invalidate();
      void utils.distributorPortal.supplierProfile.invalidate();
      toast.success("Supplier profile updated");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message || "Could not update supplier profile."),
  });
  const upload = trpc.distributorPortal.uploadSupplierResourcePdf.useMutation({
    onSuccess: (result) => {
      setForm((current) => result.resource === "catalog"
        ? { ...current, catalogPdfUrl: result.url }
        : { ...current, specBookPdfUrl: result.url });
      void utils.distributorPortal.myLine.invalidate();
      void utils.distributorPortal.supplierProfile.invalidate();
      toast.success(result.resource === "catalog" ? "PDF catalog uploaded" : "PDF spec book uploaded");
    },
    onError: (error) => toast.error(error.message || "Could not upload the PDF."),
  });

  const uploadPdf = async (resource: "catalog" | "specBook", file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Choose a PDF file.");
      return;
    }
    if (file.size === 0 || file.size > MAX_SUPPLIER_RESOURCE_BYTES) {
      toast.error("PDF files must be between 1 byte and 12 MB.");
      return;
    }
    try {
      await upload.mutateAsync(withScope({
        resource,
        fileBase64: await readSupplierPdfAsBase64(file),
        contentType: "application/pdf",
        fileName: file.name,
      }));
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)} data-testid="edit-supplier-profile">
        <Pencil className="h-4 w-4" /> Edit supplier profile
      </Button>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {vendor.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Update the public supplier contact, website, notes, catalog, and specification resources for your own approved vendor record. Supply-line identity, approval, and pricing stay protected.
        </p>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-contact-name">Contact name</Label>
            <Input id="supplier-contact-name" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-contact-email">Contact email / portal login</Label>
            <Input id="supplier-contact-email" type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} placeholder="supplier-contact@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-contact-phone">Contact phone</Label>
            <Input id="supplier-contact-phone" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-website">Website</Label>
            <Input id="supplier-website" type="url" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://www.supplier.com" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="supplier-notes">Notes</Label>
            <Textarea id="supplier-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Lead-time, ordering, or source notes for CabinetDealz." />
          </div>
          <SupplierProfilePdfField
            id="supplier-catalog-pdf"
            label="PDF catalog"
            value={form.catalogPdfUrl}
            inputRef={catalogInputRef}
            uploading={upload.isPending}
            onChange={(catalogPdfUrl) => setForm({ ...form, catalogPdfUrl })}
            onUpload={(file) => void uploadPdf("catalog", file)}
          />
          <SupplierProfilePdfField
            id="supplier-spec-book-pdf"
            label="PDF spec book"
            value={form.specBookPdfUrl}
            inputRef={specBookInputRef}
            uploading={upload.isPending}
            onChange={(specBookPdfUrl) => setForm({ ...form, specBookPdfUrl })}
            onUpload={(file) => void uploadPdf("specBook", file)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={save.isPending || upload.isPending}
            onClick={() => save.mutate(withScope(form))}
          >
            {save.isPending ? "Saving…" : "Save supplier profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProfilePdfField({
  id,
  label,
  value,
  inputRef,
  uploading,
  onChange,
  onUpload,
}: {
  id: string;
  label: string;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file?: File) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label htmlFor={`${id}-url`}>{label}</Label>
      <Input id={`${id}-url`} type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Paste a verified PDF URL" />
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          onUpload(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" className="gap-1" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload PDF"}
      </Button>
      <p className="text-xs text-muted-foreground">PDF only · max 12 MB</p>
    </div>
  );
}

function SupplierProfilePage() {
  const { user } = useAuth();
  const adminDistId = useAdminDistributorId();
  const adminApprovedVendorLineId = useAdminApprovedVendorLineId();
  const profileInput = adminApprovedVendorLineId
    ? { approvedVendorLineId: adminApprovedVendorLineId, ...(adminDistId ? { distributorId: adminDistId } : {}) }
    : adminDistId ? { distributorId: adminDistId } : undefined;
  const profile = trpc.distributorPortal.supplierProfile.useQuery(profileInput);
  const myLine = trpc.distributorPortal.myLine.useQuery(
    adminDistId ? { distributorId: adminDistId } : undefined,
    { enabled: Boolean(adminDistId || user?.distributorId) }
  );

  if (profile.isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }
  if (profile.error || !profile.data) {
    return <div className="p-4 text-destructive">The supplier profile could not be loaded.</div>;
  }

  const approvedVendor = profile.data.vendor;
  const line = myLine.data?.line ?? null;
  const linkedLines = profile.data.linkedDistributors ?? [];
  const canSwitchLinkedLine = Boolean(user?.role === "admin" && adminApprovedVendorLineId && linkedLines.length > 1);
  const switchLinkedLine = (distributorId: string) => {
    if (!adminApprovedVendorLineId) return;
    const id = Number(distributorId);
    if (!Number.isSafeInteger(id) || !linkedLines.some((candidate) => candidate.id === id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("vendor", String(adminApprovedVendorLineId));
    url.searchParams.set("as", String(id));
    url.searchParams.set("section", "supplier-profile");
    window.location.assign(url.toString());
  };
  return (
    <div data-testid="supplier-profile-page" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Supplier Profile &amp; Resources</h2>
          <p className="text-muted-foreground">View and update your approved supplier contact, resource, and profile details.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portal account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div><p className="text-muted-foreground">Signed-in account</p><p className="font-medium break-all">{user?.email || "—"}</p></div>
          <div>
            <p className="text-muted-foreground">Catalog / supply line</p>
            {canSwitchLinkedLine ? (
              <Select value={String(line?.id ?? "")} onValueChange={switchLinkedLine}>
                <SelectTrigger aria-label="Switch supplier catalog line" className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {linkedLines.map((candidate) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.code} — {supplierCatalogLineLabel(candidate)}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : <p className="font-medium">{line?.name ?? "Pending source-line link"}</p>}
            {linkedLines.length > 1 && <p className="mt-1 text-xs text-muted-foreground">Framed and Frameless stay separate catalog, pricing, and order lines.</p>}
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">For security, passwords are never displayed or stored in readable form.</p>
        </CardContent>
      </Card>

      <>
	          <Card>
	            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
	              <div>
	                <CardTitle>{approvedVendor.name}</CardTitle>
	                <CardDescription className="mt-1">Keep your supplier profile current for Cabinet Dealz.</CardDescription>
	              </div>
	              <SupplierProfileEditor vendor={approvedVendor} adminDistributorId={adminDistId} adminApprovedVendorLineId={adminApprovedVendorLineId} />
	            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div><p className="text-muted-foreground">Category</p><p className="font-medium">{approvedVendor.category || "—"}</p></div>
              <div><p className="text-muted-foreground">Contact</p><p className="font-medium">{approvedVendor.contactName || "—"}</p></div>
              <div><p className="text-muted-foreground">Contact email</p><p className="font-medium break-all">{approvedVendor.contactEmail || "—"}</p></div>
              <div><p className="text-muted-foreground">Contact phone</p><p className="font-medium">{approvedVendor.contactPhone || "—"}</p></div>
              <div className="lg:col-span-2"><p className="text-muted-foreground">Website</p>{approvedVendor.websiteUrl ? <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline break-all" href={approvedVendor.websiteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />{approvedVendor.websiteUrl}</a> : <p className="font-medium">—</p>}</div>
	              {approvedVendor.notes && <div className="rounded-md bg-muted/50 p-3 md:col-span-2 lg:col-span-3"><p className="text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap">{approvedVendor.notes}</p></div>}
	            </CardContent>
	          </Card>

          <VendorProfileCatalogPanel
            distributorId={line?.id ?? null}
            distributorName={line?.name ?? null}
            lineCode={line?.code ?? null}
            adminDistributorId={adminDistId}
          />

	          <Card>
            <CardHeader>
              <CardTitle>Catalog &amp; specification resources</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <SupplierPdfResource label="PDF Catalog" url={approvedVendor.catalogPdfUrl} />
              <SupplierPdfResource label="PDF Spec Book" url={approvedVendor.specBookPdfUrl} />
            </CardContent>
          </Card>
      </>
    </div>
  );
}

function VendorProfileCatalogPanel({
  distributorId,
  distributorName,
  lineCode,
  adminDistributorId,
}: {
  distributorId: number | null;
  distributorName: string | null;
  lineCode: string | null;
  adminDistributorId?: number;
}) {
  const isHardwareVendor = lineCode === "HRDW";
  const [offset, setOffset] = useState(0);
  const input = useMemo(() => ({
    ...(adminDistributorId ? { distributorId: adminDistributorId } : {}),
    limit: 100,
    offset,
  }), [adminDistributorId, offset]);
  const catalog = trpc.distributorPortal.catalog.useQuery(input, { enabled: distributorId != null && !isHardwareVendor });
  const total = catalog.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + (catalog.data?.items.length ?? 0), total);

  if (distributorId == null) {
    return (
      <Card data-testid="vendor-profile-catalog-unlinked">
        <CardHeader><CardTitle>Your vendor catalog</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No catalog line is linked to this supplier profile yet.</p></CardContent>
      </Card>
    );
  }

  if (isHardwareVendor) {
    return <HardwareVendorProfileCatalogPanel adminDistributorId={adminDistributorId} />;
  }

  return (
    <Card data-testid="vendor-profile-catalog">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Your vendor catalog</CardTitle>
          <CardDescription>Read-only view of all SKUs linked to {distributorName ?? "this vendor"}.</CardDescription>
        </div>
        <Badge variant="outline">{total} SKUs</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {catalog.isLoading ? <Skeleton className="h-32 w-full" /> : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Description</TableHead><TableHead>Style</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {catalog.data?.items.map((item) => (
                  <TableRow key={item.skuId}>
                    <TableCell className="font-mono text-xs">{item.masterCode ?? item.distributorSku ?? item.platformSku ?? "—"}</TableCell>
                    <TableCell className="max-w-[360px] truncate text-sm">{item.description ?? item.supplierCabinetName ?? "Pending master-cabinet mapping"}</TableCell>
                    <TableCell>{item.styleName ?? "Unassigned style"}</TableCell>
                    <TableCell>{item.category ?? "Unmapped"}</TableCell>
                    <TableCell><Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>{item.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {catalog.data?.items.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No SKUs are linked to this vendor line.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        )}
        {total > 0 && <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Showing {pageStart}–{pageEnd} of {total} SKUs</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" aria-label="Previous page" disabled={offset === 0 || catalog.isFetching} onClick={() => setOffset((current) => Math.max(0, current - 100))}>Previous page</Button>
            <Button variant="outline" size="sm" aria-label="Next page" disabled={offset + 100 >= total || catalog.isFetching} onClick={() => setOffset((current) => current + 100)}>Next page</Button>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}

function HardwareVendorProfileCatalogPanel({ adminDistributorId }: { adminDistributorId?: number }) {
  const [offset, setOffset] = useState(0);
  const catalog = trpc.hardware.vendorCatalog.useQuery({
    ...(adminDistributorId ? { distributorId: adminDistributorId } : {}),
    limit: 100,
    offset,
  });
  const total = catalog.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + (catalog.data?.items.length ?? 0), total);
  return (
    <Card data-testid="vendor-profile-hardware-catalog">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div><CardTitle>Your vendor catalog</CardTitle><CardDescription>Read-only view of every handle and hardware SKU on this supplier line.</CardDescription></div>
        <Badge variant="outline">{total} SKUs</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {catalog.isLoading ? <Skeleton className="h-32 w-full" /> : <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Description</TableHead><TableHead>Collection</TableHead><TableHead>Finish</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {catalog.data?.items.map((item) => <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="max-w-[360px] truncate text-sm">{item.description ?? item.name}</TableCell>
                <TableCell>{item.collection ?? item.productType ?? "—"}</TableCell>
                <TableCell>{item.finish ?? "—"}</TableCell>
                <TableCell><Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>{item.status}</Badge></TableCell>
              </TableRow>)}
              {catalog.data?.items.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No hardware SKUs are linked to this vendor line.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>}
        {total > 0 && <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Showing {pageStart}–{pageEnd} of {total} SKUs</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" aria-label="Previous page" disabled={offset === 0 || catalog.isFetching} onClick={() => setOffset((current) => Math.max(0, current - 100))}>Previous page</Button>
            <Button variant="outline" size="sm" aria-label="Next page" disabled={offset + 100 >= total || catalog.isFetching} onClick={() => setOffset((current) => current + 100)}>Next page</Button>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}

function SupplierPdfResource({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex min-h-24 items-center justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{url ? "Verified resource supplied by the approved vendor record." : "No resource has been added yet."}</p>
      </div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" title={`Open or download ${label}`}><Button variant="outline" size="sm"><FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />PDF<Download className="ml-1.5 h-4 w-4" aria-hidden="true" /></Button></a>}
    </div>
  );
}

// ─── Catalog Page ─────────────────────────────────────────────────────────────
function CatalogTransferTools() {
  const adminDistId = useAdminDistributorId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const history = trpc.distributorPortal.catalogFileHistory.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const exportCatalog = trpc.distributorPortal.exportCatalog.useQuery(adminDistId ? { distributorId: adminDistId } : undefined, { enabled: false });
  const upload = trpc.distributorPortal.uploadCatalogFile.useMutation({
    onSuccess: () => { toast.success("Catalog file uploaded and archived"); void history.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const download = async () => {
    try {
      const result = await exportCatalog.refetch();
      if (!result.data) throw new Error("No catalog data returned");
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.data.fileName; anchor.click(); URL.revokeObjectURL(url);
      toast.success(`Downloaded ${result.data.rowCount.toLocaleString()} catalog rows`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download catalog"); }
  };
  const handleUpload = async (file: File) => {
    if (file.size > 24 * 1024 * 1024) { toast.error("Catalog files must be 24 MB or smaller"); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(new Error("Could not read catalog file")); reader.readAsDataURL(file); });
      await upload.mutateAsync({ ...(adminDistId ? { distributorId: adminDistId } : {}), fileName: file.name, contentType: file.type || "application/octet-stream", fileBase64: base64, preservePricing: true });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload catalog"); }
    finally { setUploading(false); }
  };
  return <Card className="border-sky-200 bg-sky-50/40"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4 text-sky-700" />Catalog transfer center</CardTitle><CardDescription>Upload the source CSV or workbook for your distributor line, download the current catalog, and keep an audit history. Uploads are archived; the existing validated price update flow remains separate.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || upload.isPending}><Upload className="mr-1.5 h-4 w-4" />{uploading ? "Uploading…" : "Upload catalog"}</Button><Button size="sm" variant="outline" onClick={download} disabled={exportCatalog.isFetching}><Download className="mr-1.5 h-4 w-4" />{exportCatalog.isFetching ? "Preparing…" : "Download current CSV"}</Button><input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.zip,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void handleUpload(file); }} /></div>{history.data && history.data.length > 0 && <div className="space-y-1"><p className="text-xs font-semibold text-sky-950">Recent uploads</p>{history.data.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded border bg-background px-2.5 py-2 text-xs"><span className="truncate">{item.fileName}<span className="ml-2 text-muted-foreground">{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : ""}</span></span>{item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline">Download</a>}</div>)}</div>}</CardContent></Card>;
}

function CatalogPage() {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const myLine = trpc.distributorPortal.myLine.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const [styleId, setStyleId] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [catalogPage, setCatalogPage] = useState(0);
  const [editingPrice, setEditingPrice] = useState<{ skuId: number; field: string; value: string } | null>(null);
  const [editingOnHand, setEditingOnHand] = useState<{ skuId: number; value: string } | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [showCodeUpload, setShowCodeUpload] = useState(false);
  const catalogInput = useMemo(
    () => ({
      ...(adminDistId ? { distributorId: adminDistId } : {}),
      styleId: styleId === ALL ? undefined : Number(styleId),
      category: category === ALL ? undefined : category,
      search: search.trim() || undefined,
      onlyHidden: onlyHidden || undefined,
      limit: CATALOG_PAGE_SIZE,
      offset: catalogPage * CATALOG_PAGE_SIZE,
    }),
    [styleId, category, search, onlyHidden, catalogPage, adminDistId]
  );

  const catalog = trpc.distributorPortal.catalog.useQuery(catalogInput, {
    enabled: !!myLine.data,
  });

  const toggleVis = trpc.distributorPortal.setVisibility.useMutation({
    onSuccess: () => {
      utils.distributorPortal.catalog.invalidate();
      utils.distributorPortal.myLine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePrice = trpc.distributorPortal.updatePrice.useMutation({
    onSuccess: () => {
      utils.distributorPortal.catalog.invalidate();
      toast.success("Price updated");
      setEditingPrice(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateOnHand = trpc.distributorPortal.updateOnHandInventory.useMutation({
    onSuccess: () => {
      void utils.distributorPortal.catalog.invalidate();
      void utils.distributorPortal.inventoryForecast.invalidate();
      toast.success("On-hand inventory updated");
      setEditingOnHand(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateImage = trpc.distributorPortal.updateImage.useMutation({
    onSuccess: () => {
      utils.distributorPortal.catalog.invalidate();
      toast.success("Image uploaded");
    },
    onError: (err) => toast.error(err.message),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSkuId, setUploadingSkuId] = useState<number | null>(null);

  const handleImageUpload = useCallback(async (skuId: number, file: File) => {
    setUploadingSkuId(skuId);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await updateImage.mutateAsync({
        ...(adminDistId ? { distributorId: adminDistId } : {}),
        skuId,
        imageBase64: base64,
        contentType: file.type,
        fileName: file.name,
      });
    } finally {
      setUploadingSkuId(null);
    }
  }, [updateImage]);

  const styles = myLine.data?.styles ?? [];
  const categories = useMemo(() => {
    const cats = new Set<string>();
    catalog.data?.items.forEach((i) => { if (i.category) cats.add(i.category); });
    return Array.from(cats).sort();
  }, [catalog.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <h2 className="text-xl font-bold">My Catalog</h2>
        <Badge variant="outline">{catalog.data?.total ?? 0} products</Badge>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" onClick={() => setShowCodeUpload(!showCodeUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload by code
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCsvUpload(!showCsvUpload)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Spreadsheet Upload
          </Button>
          <Button size="sm" onClick={() => setShowNewProduct(!showNewProduct)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Product
          </Button>
        </div>
      </div>

      {showCodeUpload && <VendorCodeUpload distributorId={adminDistId} onDone={() => setCatalogPage(0)} />}
      {showCsvUpload && <CsvUploadSection />}
      <CatalogTransferTools />

      {showNewProduct && (
        <Card>
          <CardHeader><CardTitle>Submit New Product</CardTitle></CardHeader>
          <CardContent>
            <NewProductForm onClose={() => setShowNewProduct(false)} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU or description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCatalogPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={styleId} onValueChange={(value) => { setStyleId(value); setCatalogPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Styles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Styles</SelectItem>
            {styles.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.ourName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(value) => { setCategory(value); setCatalogPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyHidden} onCheckedChange={(value) => { setOnlyHidden(value); setCatalogPage(0); }} />
          Hidden only
        </label>
      </div>

      {/* Table */}
      {catalog.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">List</TableHead>
                <TableHead className="text-right">Wholesale</TableHead>
                <TableHead className="text-right">Contractor</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.data?.items.map((item) => (
                <TableRow key={item.skuId}>
                  <TableCell>
                    {item.imageUrl || item.catalogImageUrl ? (
                      <img src={item.imageUrl || item.catalogImageUrl!} alt="" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.masterCode ?? item.distributorSku ?? item.platformSku}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{item.description ?? item.supplierCabinetName ?? "Pending master-cabinet mapping"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{item.styleName}</Badge></TableCell>
                  <TableCell className="text-xs">{item.category ?? <span className="text-muted-foreground">Unmapped</span>}</TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm hover:underline cursor-pointer"
                      onClick={() => setEditingPrice({ skuId: item.skuId, field: "listPrice", value: item.listPrice ?? "" })}
                    >
                      {money(item.listPrice)}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm hover:underline cursor-pointer"
                      onClick={() => setEditingPrice({ skuId: item.skuId, field: "wholesalePrice", value: item.wholesalePrice ?? "" })}
                    >
                      {money(item.wholesalePrice)}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm hover:underline cursor-pointer"
                      onClick={() => setEditingPrice({ skuId: item.skuId, field: "contractorPrice", value: item.contractorPrice ?? "" })}
                    >
                      {money(item.contractorPrice)}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm hover:underline cursor-pointer"
                      onClick={() => setEditingOnHand({ skuId: item.skuId, value: item.onHandQty == null ? "" : String(item.onHandQty) })}
                      title="Set current on-hand inventory for this vendor SKU"
                    >
                      {item.onHandQty == null ? "—" : item.onHandQty.toLocaleString()}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={item.isPublished}
                      onCheckedChange={(checked) => {
                        toggleVis.mutate({
                          ...(adminDistId ? { distributorId: adminDistId } : {}),
                          skuId: item.skuId,
                          isPublished: checked,
                        });
                      }}
                      disabled={toggleVis.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setUploadingSkuId(item.skuId);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploadingSkuId === item.skuId}
                    >
                      {uploadingSkuId === item.skuId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {catalog.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    No products found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {(catalog.data?.total ?? 0) > 0 && <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Page {catalogPage + 1} of {Math.max(1, Math.ceil((catalog.data?.total ?? 0) / CATALOG_PAGE_SIZE))}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" aria-label="Previous page" disabled={catalogPage === 0 || catalog.isFetching} onClick={() => setCatalogPage((page) => Math.max(0, page - 1))}>Previous page</Button>
          <Button variant="outline" size="sm" aria-label="Next page" disabled={(catalogPage + 1) * CATALOG_PAGE_SIZE >= (catalog.data?.total ?? 0) || catalog.isFetching} onClick={() => setCatalogPage((page) => page + 1)}>Next page</Button>
        </div>
      </div>}

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingSkuId) {
            handleImageUpload(uploadingSkuId, file);
          }
          e.target.value = "";
        }}
      />

      {/* Price edit dialog */}
      {editingPrice && (
        <Dialog open onOpenChange={() => setEditingPrice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update {editingPrice.field.replace("Price", " Price")}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={editingPrice.value}
                  onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPrice(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  updatePrice.mutate({
                    ...(adminDistId ? { distributorId: adminDistId } : {}),
                    skuId: editingPrice.skuId,
                    [editingPrice.field]: editingPrice.value || undefined,
                  });
                }}
                disabled={updatePrice.isPending}
              >
                {updatePrice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingOnHand && (
        <Dialog open onOpenChange={() => setEditingOnHand(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Set on-hand inventory</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Leave blank when this vendor has no inventory feed. Zero is a valid reported quantity.</p>
            <Input
              type="number"
              min="0"
              step="1"
              value={editingOnHand.value}
              onChange={(event) => setEditingOnHand({ ...editingOnHand, value: event.target.value })}
              placeholder="No inventory feed"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingOnHand(null)}>Cancel</Button>
              <Button
                disabled={updateOnHand.isPending}
                onClick={() => updateOnHand.mutate({
                  ...(adminDistId ? { distributorId: adminDistId } : {}),
                  skuId: editingOnHand.skuId,
                  onHandQty: editingOnHand.value.trim() === "" ? null : Number(editingOnHand.value),
                })}
              >
                {updateOnHand.isPending ? "Saving…" : "Save inventory"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── CSV Upload Section ──────────────────────────────────────────────────────
function CsvUploadSection() {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvResult, setCsvResult] = useState<{ updated: number; notFound: number; total: number; errors: string[] } | null>(null);

  const bulkUpdate = trpc.vendor.bulkCatalogUpdate.useMutation({
    onSuccess: (result) => {
      setCsvResult(result);
      utils.distributorPortal.catalog.invalidate();
      utils.distributorPortal.myLine.invalidate();
      toast.success(`Updated ${result.updated} of ${result.total} rows`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCsvUpload = useCallback(async (file: File) => {
    setCsvParsing(true);
    setCsvResult(null);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }
      // Parse header
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
      const skuIdx = headers.findIndex(h => h === "distributorsku" || h === "sku" || h === "distributor_sku");
      if (skuIdx === -1) {
        toast.error("CSV must have a 'distributorSku' or 'sku' column");
        return;
      }
      const listIdx = headers.findIndex(h => h === "listprice" || h === "list_price" || h === "list");
      const wholeIdx = headers.findIndex(h => h === "wholesaleprice" || h === "wholesale_price" || h === "wholesale");
      const contIdx = headers.findIndex(h => h === "contractorprice" || h === "contractor_price" || h === "contractor");
      const homeIdx = headers.findIndex(h => h === "homeownerprice" || h === "homeowner_price" || h === "homeowner");
      const availIdx = headers.findIndex(h => h === "isavailable" || h === "is_available" || h === "available");

      const rows = lines.slice(1).filter(l => l.trim()).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const row: any = { distributorSku: cols[skuIdx] };
        if (listIdx >= 0 && cols[listIdx]) row.listPrice = cols[listIdx];
        if (wholeIdx >= 0 && cols[wholeIdx]) row.wholesalePrice = cols[wholeIdx];
        if (contIdx >= 0 && cols[contIdx]) row.contractorPrice = cols[contIdx];
        if (homeIdx >= 0 && cols[homeIdx]) row.homeownerPrice = cols[homeIdx];
        if (availIdx >= 0 && cols[availIdx]) row.isAvailable = cols[availIdx].toLowerCase() === "true" || cols[availIdx] === "1";
        return row;
      });

      if (rows.length === 0) {
        toast.error("No valid data rows found in CSV");
        return;
      }

      bulkUpdate.mutate({ rows, ...(adminDistId ? { distributorId: adminDistId } : {}) });
    } catch (err: any) {
      toast.error(`CSV parse error: ${err.message}`);
    } finally {
      setCsvParsing(false);
    }
  }, [bulkUpdate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Spreadsheet Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a CSV file to bulk-update prices and availability for your existing products.
          The CSV must have a <code className="bg-muted px-1 rounded">distributorSku</code> column,
          plus any of: <code className="bg-muted px-1 rounded">listPrice</code>,{" "}
          <code className="bg-muted px-1 rounded">wholesalePrice</code>,{" "}
          <code className="bg-muted px-1 rounded">contractorPrice</code>,{" "}
          <code className="bg-muted px-1 rounded">homeownerPrice</code>,{" "}
          <code className="bg-muted px-1 rounded">isAvailable</code>.
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={csvParsing || bulkUpdate.isPending}
          >
            {(csvParsing || bulkUpdate.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const csv = "distributorSku,listPrice,wholesalePrice,contractorPrice,homeownerPrice,isAvailable\nEXAMPLE-SKU-1,199.99,149.99,129.99,219.99,true\n";
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "catalog-template.csv"; a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvUpload(file);
            e.target.value = "";
          }}
        />

        {csvResult && (
          <div className="rounded-md border p-4 space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">Updated: {csvResult.updated}</span>
              <span className="text-muted-foreground">Total rows: {csvResult.total}</span>
              {csvResult.notFound > 0 && (
                <span className="text-destructive">Not found: {csvResult.notFound}</span>
              )}
            </div>
            {csvResult.errors.length > 0 && (
              <div className="text-xs text-destructive space-y-1">
                {csvResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── New Product Submission ──────────────────────────────────────────────────
function NewProductForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const myLine = trpc.distributorPortal.myLine.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const [form, setForm] = useState({
    styleId: "",
    distributorSku: "",
    listPrice: "",
    yourCost: "",
    supplierCabinetName: "",
  });

  const submit = trpc.distributorPortal.submitNewProduct.useMutation({
    onSuccess: () => {
      utils.distributorPortal.catalog.invalidate();
      utils.distributorPortal.myLine.invalidate();
      toast.success("Product submitted for approval");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const styles = myLine.data?.styles ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Door Style *</label>
          <Select value={form.styleId} onValueChange={(v) => setForm({ ...form, styleId: v })}>
            <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
            <SelectContent>
              {styles.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.ourName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Your SKU *</label>
          <Input
            placeholder="Your internal SKU code"
            value={form.distributorSku}
            onChange={(e) => setForm({ ...form, distributorSku: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">Enter any supplier SKU. Master-cabinet matching is optional and can be completed during approval.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Supplier Cabinet Name</label>
          <Input
            placeholder="Optional display name"
            value={form.supplierCabinetName}
            onChange={(e) => setForm({ ...form, supplierCabinetName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">List Price <span className="text-muted-foreground">(optional if Cost is entered)</span></label>
          <Input
            type="number" step="0.01" placeholder="0.00"
            value={form.listPrice}
            onChange={(e) => setForm({ ...form, listPrice: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Your Cost <span className="text-muted-foreground">(optional if List Price is entered)</span></label>
          <Input
            type="number" step="0.01" placeholder="0.00"
            value={form.yourCost}
            onChange={(e) => setForm({ ...form, yourCost: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => {
            if (!form.styleId || !form.distributorSku) {
              toast.error("Style and SKU are required");
              return;
            }
            if (!form.listPrice && !form.yourCost) {
              toast.error("Enter a List Price or Your Cost");
              return;
            }
            submit.mutate({
              ...(adminDistId ? { distributorId: adminDistId } : {}),
              styleId: Number(form.styleId),
              distributorSku: form.distributorSku,
              listPrice: form.listPrice || undefined,
              yourCost: form.yourCost || undefined,
              supplierCabinetName: form.supplierCabinetName || undefined,
            });
          }}
          disabled={submit.isPending}
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
          Submit for Approval
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Design Tool Picks Page ───────────────────────────────────────────────────
function DesignToolPicksPage() {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const picks = trpc.distributorPortal.getDesignToolPicks.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const catalog = trpc.distributorPortal.catalog.useQuery({ ...(adminDistId ? { distributorId: adminDistId } : {}), limit: 500, offset: 0 });
  const setPicks = trpc.distributorPortal.setDesignToolPicks.useMutation({
    onSuccess: () => {
      utils.distributorPortal.getDesignToolPicks.invalidate();
      utils.distributorPortal.myLine.invalidate();
      toast.success("Design tool picks updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const currentPicks = picks.data?.picks ?? [];
  const pickSet = useMemo(() => new Set(currentPicks), [currentPicks]);

  const togglePick = useCallback((skuId: number) => {
    const newPicks = pickSet.has(skuId)
      ? currentPicks.filter((id) => id !== skuId)
      : [...currentPicks, skuId];
    if (newPicks.length > MAX_PICKS) {
      toast.error(`Maximum ${MAX_PICKS} picks allowed`);
      return;
    }
    setPicks.mutate({ skuIds: newPicks, ...(adminDistId ? { distributorId: adminDistId } : {}) });
  }, [currentPicks, pickSet, setPicks]);

  if (picks.isLoading || catalog.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">3D Designer Picks</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Select up to {MAX_PICKS} products to feature in the 3D Designer.
          These are your best items that customers will see when designing their kitchen.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={currentPicks.length >= MAX_PICKS ? "destructive" : "secondary"}>
          {currentPicks.length} / {MAX_PICKS} selected
        </Badge>
        {currentPicks.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPicks.mutate({ skuIds: [], ...(adminDistId ? { distributorId: adminDistId } : {}) })}
            disabled={setPicks.isPending}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Current picks */}
      {picks.data?.items && picks.data.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {picks.data.items.map((item) => (
                <div
                  key={item.skuId}
                  className="relative border rounded-lg p-3 bg-primary/5 border-primary/30"
                >
                  <button
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 transition-colors"
                    onClick={() => togglePick(item.skuId)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-16 w-full object-cover rounded mb-2" />
                  ) : (
                    <div className="h-16 w-full bg-muted rounded mb-2 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs font-medium truncate">{item.masterCode}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.styleName}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available products to pick from */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.data?.items
              .filter((item) => item.isPublished && item.status === "approved")
              .map((item) => {
                const isPicked = pickSet.has(item.skuId);
                return (
                  <div
                    key={item.skuId}
                    className={`relative border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                      isPicked ? "bg-primary/5 border-primary/30" : "hover:border-primary/20"
                    }`}
                    onClick={() => togglePick(item.skuId)}
                  >
                    {isPicked && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-14 w-full object-cover rounded mb-2" />
                    ) : (
                      <div className="h-14 w-full bg-muted rounded mb-2 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs font-medium truncate">{item.masterCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    <div className="flex justify-between items-center mt-1">
                      <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                      <span className="text-xs font-medium">{money(item.contractorPrice)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Door Styles Page ─────────────────────────────────────────────────────────
function DoorStylesPage() {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const myLine = trpc.distributorPortal.myLine.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const updateImage = trpc.distributorPortal.updateDoorStyleImage.useMutation({
    onSuccess: () => {
      utils.distributorPortal.myLine.invalidate();
      toast.success("Style image updated");
    },
    onError: (err) => toast.error(err.message),
  });

	  const fileInputRef = useRef<HTMLInputElement>(null);
	  const [uploadTarget, setUploadTarget] = useState<{ styleId: number; imageType: "doorSample" | "roomScene" | "thumbnail" } | null>(null);
	  const [measurementStyle, setMeasurementStyle] = useState<{ id: number; styleCode: string; ourName: string; distributorName: string } | null>(null);

	  const handleUpload = useCallback(async (file: File) => {
    if (!uploadTarget) return;
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await updateImage.mutateAsync({
      ...(adminDistId ? { distributorId: adminDistId } : {}),
      styleId: uploadTarget.styleId,
      imageType: uploadTarget.imageType,
      imageBase64: base64,
      contentType: file.type,
    });
    setUploadTarget(null);
  }, [uploadTarget, updateImage]);

  const styles = myLine.data?.styles ?? [];

  return (
    <div className="space-y-6">
	      <div>
	        <h2 className="text-xl font-bold">Door Styles</h2>
	        <p className="text-muted-foreground text-sm mt-1">
	          Manage images for your door styles. Upload room scenes, door samples, and thumbnails.
	        </p>
	      </div>
	      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
	        <p className="font-semibold">Sample-door measurements</p>
	        <p className="mt-1 text-amber-900/80">Use <strong>Submit sample measurements</strong> on a Door Style card to record the supplied measurement sheet. Check every style made with that same profile; CabinetDealz measures the sample once before the verified dimensions become available to Designer.</p>
	      </div>

	      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {styles.map((style) => (
          <Card key={style.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-medium">{style.ourName}</h3>
                <p className="text-xs text-muted-foreground">{style.doorStyle}</p>
              </div>

              {/* Image previews */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "doorSample" as const, label: "Door Sample", url: style.doorSampleImageUrl },
                  { key: "roomScene" as const, label: "Room Scene", url: style.roomSceneImageUrl },
                  { key: "thumbnail" as const, label: "Thumbnail", url: style.thumbnailImageUrl },
                ] as { key: "doorSample" | "roomScene" | "thumbnail"; label: string; url?: string | null }[]).map(({ key, label, url }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setUploadTarget({ styleId: style.id, imageType: key });
                      fileInputRef.current?.click();
                    }}
                    disabled={updateImage.isPending}
                    className="group relative rounded-md overflow-hidden border border-border bg-muted/30 aspect-square flex flex-col items-center justify-center hover:border-primary transition-colors"
                    title={url ? `Replace ${label}` : `Upload ${label}`}
                  >
                    {url ? (
                      <>
                        <img
                          src={url}
                          alt={label}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <Upload className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-4 w-4" />
                        <span className="text-[10px] font-medium text-center leading-tight px-1">{label}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Status badges */}
	              <div className="flex gap-1 flex-wrap">
	                {style.doorSampleImageUrl && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">Door ✓</span>}
	                {style.roomSceneImageUrl && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">Scene ✓</span>}
	                {style.thumbnailImageUrl && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">Thumb ✓</span>}
	                {!style.doorSampleImageUrl && !style.roomSceneImageUrl && !style.thumbnailImageUrl && (
	                  <span className="text-[10px] text-muted-foreground">No images yet — click a slot to upload</span>
	                )}
	              </div>

	              <Button
	                type="button"
	                variant="outline"
	                size="sm"
	                className="w-full border-amber-300 text-amber-900 hover:bg-amber-50"
	                onClick={() => setMeasurementStyle({
	                  id: style.id,
	                  styleCode: style.styleCode,
	                  ourName: style.ourName,
	                  distributorName: style.distributorName,
	                })}
	              >
	                <Ruler className="mr-1.5 h-3.5 w-3.5" />Submit sample measurements
	              </Button>
	            </CardContent>
          </Card>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
	        onChange={(e) => {
	          const file = e.target.files?.[0];
	          if (file) handleUpload(file);
	          e.target.value = "";
	        }}
	      />
	      {measurementStyle && (
	        <VendorDoorMeasurementDialog
	          style={measurementStyle}
	          styles={styles.map((item) => ({ id: item.id, styleCode: item.styleCode, ourName: item.ourName, distributorName: item.distributorName }))}
	          distributorId={adminDistId}
	          onClose={() => setMeasurementStyle(null)}
	        />
	      )}
	    </div>
  );
}

type DoorMeasurementStyle = {
  id: number;
  styleCode: string;
  ourName: string;
  distributorName: string;
};

type MeasurementFields = Record<
  | "sampleWidth" | "sampleHeight" | "doorThickness"
  | "topRailWidth" | "bottomRailWidth" | "leftStileWidth" | "rightStileWidth" | "centerRailWidth"
  | "drawerRailWidth" | "drawerStileWidth" | "slabBelowHeight" | "drawerFrontThickness"
  | "doorGap" | "faceFrameWidth",
  string
>;

type MeasurementReferencePhoto = {
  photoType: "door" | "drawer" | "edge" | "back";
  url: string;
  fileName: string;
  uploadedAt: string;
};

const EMPTY_MEASUREMENT_FIELDS: MeasurementFields = {
  sampleWidth: "", sampleHeight: "", doorThickness: "",
  topRailWidth: "", bottomRailWidth: "", leftStileWidth: "", rightStileWidth: "", centerRailWidth: "",
  drawerRailWidth: "", drawerStileWidth: "", slabBelowHeight: "", drawerFrontThickness: "",
  doorGap: "", faceFrameWidth: "",
};

/** Mirrors the owner-supplied CabinetDealz Sample Door Measuring Sheet. */
function VendorDoorMeasurementDialog({
	  style,
	  styles,
	  distributorId,
	  onClose,
}: {
	  style: DoorMeasurementStyle;
	  styles: DoorMeasurementStyle[];
  distributorId?: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [measuredBy, setMeasuredBy] = useState("");
  const [measuredOn, setMeasuredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [doorStyle, setDoorStyle] = useState("Shaker");
  const [doorStyleOther, setDoorStyleOther] = useState("");
  const [colorFinish, setColorFinish] = useState("");
  const [panel, setPanel] = useState("Flat");
  const [outsideEdgeProfile, setOutsideEdgeProfile] = useState("");
  const [insideFrameProfile, setInsideFrameProfile] = useState("");
  const [drawerConstruction, setDrawerConstruction] = useState("5-piece (frame and panel)");
  const [cabinetConstruction, setCabinetConstruction] = useState("Face frame");
  const [overlay, setOverlay] = useState("Full overlay");
	  const [fields, setFields] = useState<MeasurementFields>(EMPTY_MEASUREMENT_FIELDS);
	  const [appliesToStyleIds, setAppliesToStyleIds] = useState<number[]>([style.id]);
	  const [photos, setPhotos] = useState({
	    doorPhotoProvided: false,
	    drawerPhotoProvided: false,
	    edgeProfilePhotoProvided: false,
	    backPhotoProvided: false,
	  });
	  const [referencePhotos, setReferencePhotos] = useState<MeasurementReferencePhoto[]>([]);
	  const photoInputRef = useRef<HTMLInputElement>(null);
	  const [photoUploadType, setPhotoUploadType] = useState<MeasurementReferencePhoto["photoType"] | null>(null);
	  const draftInput = useMemo(() => ({
	    styleId: style.id,
	    ...(distributorId ? { distributorId } : {}),
	  }), [style.id, distributorId]);
	  const draft = trpc.distributorPortal.doorMeasurementDraft.useQuery(draftInput);
	  const [draftHydrated, setDraftHydrated] = useState(false);
	  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
	  useEffect(() => {
	    if (draftHydrated || !draft.data) return;
	    const saved = draft.data.measurementData ?? {};
	    const textValue = (key: string) => saved[key] == null ? "" : String(saved[key]);
	    setMeasuredBy(draft.data.measuredBy ?? "");
	    setMeasuredOn(draft.data.measuredOn || new Date().toISOString().slice(0, 10));
	    setAppliesToStyleIds(draft.data.appliesToStyleIds.length ? draft.data.appliesToStyleIds : [style.id]);
	    setDoorStyle(String(saved.doorStyle ?? "Shaker"));
	    setDoorStyleOther(textValue("doorStyleOther"));
	    setColorFinish(textValue("colorFinish"));
	    setPanel(String(saved.panel ?? "Flat"));
	    setOutsideEdgeProfile(textValue("outsideEdgeProfile"));
	    setInsideFrameProfile(textValue("insideFrameProfile"));
	    setDrawerConstruction(String(saved.drawerConstruction ?? "5-piece (frame and panel)"));
	    setCabinetConstruction(String(saved.cabinetConstruction ?? "Face frame"));
	    setOverlay(String(saved.overlay ?? "Full overlay"));
	    setFields({
	      sampleWidth: textValue("sampleWidth"), sampleHeight: textValue("sampleHeight"), doorThickness: textValue("doorThickness"),
	      topRailWidth: textValue("topRailWidth"), bottomRailWidth: textValue("bottomRailWidth"), leftStileWidth: textValue("leftStileWidth"), rightStileWidth: textValue("rightStileWidth"), centerRailWidth: textValue("centerRailWidth"),
	      drawerRailWidth: textValue("drawerRailWidth"), drawerStileWidth: textValue("drawerStileWidth"), slabBelowHeight: textValue("slabBelowHeight"), drawerFrontThickness: textValue("drawerFrontThickness"),
	      doorGap: textValue("doorGap"), faceFrameWidth: textValue("faceFrameWidth"),
	    });
	    setPhotos({
      doorPhotoProvided: saved.doorPhotoProvided === true,
      drawerPhotoProvided: saved.drawerPhotoProvided === true,
      edgeProfilePhotoProvided: saved.edgeProfilePhotoProvided === true,
	      backPhotoProvided: saved.backPhotoProvided === true,
	    });
	    setReferencePhotos(Array.isArray(saved.referencePhotos) ? saved.referencePhotos.filter((photo): photo is MeasurementReferencePhoto => Boolean(photo && typeof photo === "object" && "photoType" in photo && "url" in photo)) : []);
    setDraftSavedAt(draft.data.updatedAt ? new Date(draft.data.updatedAt).toLocaleString() : null);
    setDraftHydrated(true);
  }, [draft.data, draftHydrated, style.id]);
	  const requiredMeasurementKeys = ["topRailWidth", "bottomRailWidth", "leftStileWidth", "rightStileWidth"] as const;
	  const completedRequiredMeasurements = requiredMeasurementKeys.filter((key) => fields[key].trim()).length;
	  const sourceCitationPreview = `Measured from sample door: ${style.distributorName} ${style.styleCode}, measured by ${measuredBy.trim() || "[name]"} on ${measuredOn || "[date]"}.`;
	  const buildMeasurements = () => ({
	    doorStyle: doorStyle as "Shaker" | "Slim Shaker" | "Double Shaker" | "Raised Panel" | "Beaded" | "Slab" | "Other",
	    doorStyleOther: doorStyleOther.trim() || undefined,
	    colorFinish: colorFinish.trim() || undefined,
	    sampleWidth: numeric(fields.sampleWidth), sampleHeight: numeric(fields.sampleHeight), doorThickness: numeric(fields.doorThickness),
	    topRailWidth: numeric(fields.topRailWidth), bottomRailWidth: numeric(fields.bottomRailWidth),
	    leftStileWidth: numeric(fields.leftStileWidth), rightStileWidth: numeric(fields.rightStileWidth), centerRailWidth: numeric(fields.centerRailWidth),
	    panel: panel as "Flat" | "Raised" | "Beadboard",
	    outsideEdgeProfile: outsideEdgeProfile.trim() || undefined,
	    insideFrameProfile: insideFrameProfile.trim() || undefined,
	    drawerConstruction: drawerConstruction as "5-piece (frame and panel)" | "Slab",
	    drawerRailWidth: numeric(fields.drawerRailWidth), drawerStileWidth: numeric(fields.drawerStileWidth),
	    slabBelowHeight: numeric(fields.slabBelowHeight), drawerFrontThickness: numeric(fields.drawerFrontThickness),
	    cabinetConstruction: cabinetConstruction as "Face frame" | "Frameless",
	    overlay: overlay as "Full overlay" | "Partial overlay" | "Inset",
	    doorGap: numeric(fields.doorGap), faceFrameWidth: numeric(fields.faceFrameWidth),
	    referencePhotos,
	    ...photos,
	  });
	  const saveDraft = trpc.distributorPortal.saveDoorMeasurementDraft.useMutation({
	    onSuccess: () => {
	      void utils.distributorPortal.doorMeasurementDraft.invalidate(draftInput);
	      setDraftSavedAt(new Date().toLocaleString());
	      toast.success("Measuring sheet draft saved. You can resume it later.");
	    },
	    onError: (error) => toast.error(error.message || "Could not save the measuring sheet draft."),
	  });
	  const uploadReferencePhoto = trpc.distributorPortal.uploadDoorMeasurementDraftPhoto.useMutation({
	    onError: (error) => toast.error(error.message || "Could not upload the reference photo."),
	  });
	  const submit = trpc.distributorPortal.submitDoorMeasurement.useMutation({
	    onSuccess: () => {
	      utils.distributorPortal.myLine.invalidate();
	      void utils.distributorPortal.doorMeasurementDraft.invalidate(draftInput);
      toast.success("Sample-door measurements submitted for CabinetDealz verification.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
	  const numeric = (value: string) => value.trim() ? Number(value) : null;
	  const updateField = (key: keyof MeasurementFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
	  const toggleStyle = (styleId: number, checked: boolean) => setAppliesToStyleIds((current) => {
	    if (styleId === style.id) return current.includes(styleId) ? current : [styleId, ...current];
	    return checked ? Array.from(new Set([...current, styleId])) : current.filter((id) => id !== styleId);
	  });
  const numberField = (label: string, key: keyof MeasurementFields, required = false) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}{required ? " *" : ""}</Label>
      <Input type="number" min="0" max="120" step="0.0625" inputMode="decimal" value={fields[key]} onChange={(event) => updateField(key, event.target.value)} />
    </div>
  );
	  const submitMeasurements = () => {
    const required = ["topRailWidth", "bottomRailWidth", "leftStileWidth", "rightStileWidth"] as const;
    if (!measuredBy.trim()) {
      toast.error("Enter the name of the person who measured the sample.");
      return;
    }
    if (required.some((key) => !fields[key].trim())) {
      toast.error("Enter top and bottom rails plus left and right stiles from the sample door.");
      return;
    }
    const numericValues = Object.values(fields).filter((value) => value.trim()).map((value) => Number(value));
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0 || value > 120)) {
      toast.error("Measurements must be valid inch values.");
      return;
    }
	    submit.mutate({
		      ...(distributorId ? { distributorId } : {}),
	      styleId: style.id,
	      appliesToStyleIds,
      measuredBy: measuredBy.trim(),
      measuredOn,
	      measurements: buildMeasurements(),
	    });
	  };
	  const saveDraftNow = () => {
	    const numericValues = Object.values(fields).filter((value) => value.trim()).map((value) => Number(value));
	    if (numericValues.some((value) => !Number.isFinite(value) || value < 0 || value > 120)) {
	      toast.error("Measurements must be valid inch values before saving the draft.");
	      return;
	    }
	    saveDraft.mutate({
	      ...(distributorId ? { distributorId } : {}),
	      styleId: style.id,
	      appliesToStyleIds,
	      measuredBy: measuredBy.trim() || undefined,
	      measuredOn,
	      measurements: buildMeasurements(),
	    });
	  };
	  const handleReferencePhotoUpload = async (file: File) => {
	    if (!photoUploadType) return;
	    if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
	      toast.error("Use a JPG, PNG, or WebP reference image.");
	      return;
	    }
	    if (file.size > 8 * 1024 * 1024) {
	      toast.error("Reference images must be smaller than 8 MB.");
	      return;
	    }
	    try {
	      await saveDraft.mutateAsync({
	        ...(distributorId ? { distributorId } : {}),
	        styleId: style.id,
	        appliesToStyleIds,
	        measuredBy: measuredBy.trim() || undefined,
	        measuredOn,
	        measurements: buildMeasurements(),
	      });
	      const reader = new FileReader();
	      const base64 = await new Promise<string>((resolve, reject) => {
	        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
	        reader.onerror = reject;
	        reader.readAsDataURL(file);
	      });
	      const result = await uploadReferencePhoto.mutateAsync({
	        ...(distributorId ? { distributorId } : {}),
	        styleId: style.id,
	        photoType: photoUploadType,
	        imageBase64: base64,
	        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
	        fileName: file.name,
	      });
	      setReferencePhotos((current) => [...current.filter((photo) => photo.photoType !== photoUploadType), result.photo]);
	      setDraftSavedAt(new Date().toLocaleString());
	      toast.success("Reference photo attached to this draft.");
	    } catch {
	      // The mutation surfaces its own error toast; keep the dialog open so the user can retry.
	    } finally {
	      setPhotoUploadType(null);
	    }
	  };

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="!flex h-[min(92dvh,900px)] max-h-[calc(100dvh-1rem)] w-[min(54rem,calc(100vw-1rem))] flex-col overflow-hidden p-5 sm:max-w-none">
	      <DialogHeader className="shrink-0">
	        <DialogTitle className="flex items-center gap-2"><Ruler className="h-5 w-5 text-amber-600" />Interactive sample-door measuring sheet</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-2 pr-2">
	        <div data-testid="interactive-door-measuring-sheet" className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
	          <p className="font-semibold">{style.distributorName} · {style.ourName} · {style.styleCode}</p>
	          <p className="mt-1 text-muted-foreground">Fill out one sheet per door profile. Every entry below is carried into the door-specification review record. Designer geometry changes only after CabinetDealz verifies the physical sample.</p>
	          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
	            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-amber-900">Required frame measurements: {completedRequiredMeasurements}/4</span>
	            {completedRequiredMeasurements === 4 ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Ready for review</span> : <span className="text-amber-900/80">Enter top, bottom, left, and right frame measurements to submit.</span>}
	            {draft.isLoading && <span className="text-muted-foreground">Checking for saved draft…</span>}
	            {draftSavedAt && <span className="text-emerald-700">Draft saved {draftSavedAt}</span>}
	          </div>
	        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label className="text-xs">Measured by *</Label><Input value={measuredBy} onChange={(event) => setMeasuredBy(event.target.value)} placeholder="Name" /></div>
          <div className="space-y-1"><Label className="text-xs">Measurement date</Label><Input type="date" value={measuredOn} onChange={(event) => setMeasuredOn(event.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Color / finish</Label><Input value={colorFinish} onChange={(event) => setColorFinish(event.target.value)} placeholder="e.g. Natural maple" /></div>
        </div>
        <section className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
          <div><Label className="text-sm font-semibold">Apply this same measured profile to checked door styles</Label><p className="text-xs text-muted-foreground">Check only styles made with this same physical door profile. CabinetDealz will verify the delivered sample once before these values can render any checked style in Designer.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {styles.map((candidate) => <label key={candidate.id} className="flex items-center gap-2 rounded border border-sky-100 bg-background px-2.5 py-2 text-sm">
              <input type="checkbox" checked={appliesToStyleIds.includes(candidate.id)} disabled={candidate.id === style.id} onChange={(event) => toggleStyle(candidate.id, event.target.checked)} />
              <span className="min-w-0"><span className="block truncate font-medium">{candidate.ourName}</span><span className="block text-xs text-muted-foreground">{candidate.styleCode}{candidate.id === style.id ? " · measured sample" : ""}</span></span>
            </label>)}
          </div>
          <p className="text-xs font-medium text-sky-800">{appliesToStyleIds.length} style{appliesToStyleIds.length === 1 ? "" : "s"} selected for this measurement profile.</p>
        </section>
        <section className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-semibold">Door</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Door style</Label><Select value={doorStyle} onValueChange={setDoorStyle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Shaker", "Slim Shaker", "Double Shaker", "Raised Panel", "Beaded", "Slab", "Other"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            {doorStyle === "Other" && <div className="space-y-1"><Label className="text-xs">Other style</Label><Input value={doorStyleOther} onChange={(event) => setDoorStyleOther(event.target.value)} /></div>}
            {numberField("Sample width (in)", "sampleWidth")}{numberField("Sample height (in)", "sampleHeight")}{numberField("Door thickness (in)", "doorThickness")}
            {numberField("Top rail (in)", "topRailWidth", true)}{numberField("Bottom rail (in)", "bottomRailWidth", true)}
            {numberField("Left stile (in)", "leftStileWidth", true)}{numberField("Right stile (in)", "rightStileWidth", true)}{numberField("Center rail, if any (in)", "centerRailWidth")}
          </div>
	          <div className="grid gap-3 sm:grid-cols-3">
	            <div className="space-y-1"><Label className="text-xs">Panel</Label><Select value={panel} onValueChange={setPanel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Flat", "Raised", "Beadboard"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
	            <div className="space-y-1"><Label className="text-xs">Outside edge profile</Label><Input value={outsideEdgeProfile} onChange={(event) => setOutsideEdgeProfile(event.target.value)} /></div>
	            <div className="space-y-1"><Label className="text-xs">Inside frame profile</Label><Input value={insideFrameProfile} onChange={(event) => setInsideFrameProfile(event.target.value)} /></div>
	          </div>
	        </section>
	        <section data-testid="door-specification-preview" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
	          <div>
	            <h3 className="font-semibold text-emerald-950">Live door specification preview</h3>
	            <p className="text-xs text-emerald-900/75">This is the specification CabinetDealz will review from your completed sheet. It updates as you type.</p>
	          </div>
	          <div className="grid gap-2 text-xs sm:grid-cols-3">
	            <div><span className="text-muted-foreground">Door profile</span><p className="font-medium">{doorStyle === "Other" ? doorStyleOther || "Other" : doorStyle}</p></div>
	            <div><span className="text-muted-foreground">Panel</span><p className="font-medium">{panel}</p></div>
	            <div><span className="text-muted-foreground">Mount</span><p className="font-medium">{cabinetConstruction} · {overlay}</p></div>
	            <div><span className="text-muted-foreground">Top / bottom rail</span><p className="font-medium">{fields.topRailWidth || "—"} / {fields.bottomRailWidth || "—"} in</p></div>
	            <div><span className="text-muted-foreground">Left / right stile</span><p className="font-medium">{fields.leftStileWidth || "—"} / {fields.rightStileWidth || "—"} in</p></div>
	            <div><span className="text-muted-foreground">Center rail</span><p className="font-medium">{fields.centerRailWidth || "None"} {fields.centerRailWidth ? "in" : ""}</p></div>
	          </div>
	          <div className="rounded-md border border-emerald-200 bg-white p-2.5 text-xs text-emerald-950">
	            <span className="font-medium">Source citation preview:</span> {sourceCitationPreview}
	          </div>
	        </section>
	        <section className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-semibold">Drawer front and mount</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Drawer construction</Label><Select value={drawerConstruction} onValueChange={setDrawerConstruction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["5-piece (frame and panel)", "Slab"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            {numberField("Drawer rail (in)", "drawerRailWidth")}{numberField("Drawer stile (in)", "drawerStileWidth")}{numberField("Slab below this height (in)", "slabBelowHeight")}{numberField("Drawer front thickness (in)", "drawerFrontThickness")}
            <div className="space-y-1"><Label className="text-xs">Cabinet construction</Label><Select value={cabinetConstruction} onValueChange={setCabinetConstruction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Face frame", "Frameless"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Overlay</Label><Select value={overlay} onValueChange={setOverlay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Full overlay", "Partial overlay", "Inset"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            {numberField("Gap between doors (in)", "doorGap")}{numberField("Face frame width (in)", "faceFrameWidth")}
          </div>
        </section>
	        <section data-testid="measurement-reference-photos" className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
	          <div>
	            <h3 className="font-semibold text-violet-950">Reference photos</h3>
	            <p className="text-xs text-violet-900/75">Attach one clear image for each view. Photos are saved with this draft and can be replaced later.</p>
	          </div>
	          <div className="grid gap-3 sm:grid-cols-2">
	            {([
	              ["door", "Door, straight on"],
	              ["drawer", "Drawer front, straight on"],
	              ["edge", "Edge profile close-up"],
	              ["back", "Back of door"],
	            ] as const).map(([photoType, label]) => {
	              const photo = referencePhotos.find((item) => item.photoType === photoType);
	              return <div key={photoType} className="rounded-md border border-violet-200 bg-background p-2">
	                <div className="flex items-center justify-between gap-2">
	                  <p className="text-xs font-medium">{label}</p>
	                  <button
	                    type="button"
	                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
	                    onClick={() => { setPhotoUploadType(photoType); photoInputRef.current?.click(); }}
	                    disabled={saveDraft.isPending || uploadReferencePhoto.isPending}
	                  >
	                    <Upload className="h-3.5 w-3.5" />{photo ? "Replace" : "Attach"}
	                  </button>
	                </div>
	                {photo ? <div className="mt-2 flex items-center gap-2">
	                  <img src={photo.url} alt={label} className="h-16 w-20 rounded border object-cover" />
	                  <div className="min-w-0 text-[11px] text-muted-foreground"><p className="truncate">{photo.fileName}</p><a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open image</a></div>
	                </div> : <p className="mt-2 text-[11px] text-muted-foreground">No photo attached yet.</p>}
              </div>;
            })}
          </div>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleReferencePhotoUpload(file); event.target.value = ""; }} />
	        </section>
	        <section className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="font-semibold">Photos supplied with a ruler or tape in frame</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([['doorPhotoProvided', 'Door, straight on'], ['drawerPhotoProvided', 'Drawer front, straight on'], ['edgeProfilePhotoProvided', 'Edge profile close-up'], ['backPhotoProvided', 'Back of door']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={photos[key]} onChange={(event) => setPhotos((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
          </div>
          <p className="text-xs text-muted-foreground">Upload the actual photos in the Door Styles card; these checkmarks document what accompanied this measurement submission.</p>
        </section>
      </div>
	      <DialogFooter className="shrink-0 border-t border-border pt-3">
	        <Button variant="outline" onClick={onClose} disabled={submit.isPending}>Cancel</Button>
	        <Button variant="secondary" onClick={saveDraftNow} disabled={saveDraft.isPending || submit.isPending}>{saveDraft.isPending ? "Saving draft…" : "Save Draft"}</Button>
	        <Button onClick={submitMeasurements} disabled={submit.isPending || saveDraft.isPending} className="bg-amber-600 text-white hover:bg-amber-700">{submit.isPending ? "Submitting…" : "Submit for CabinetDealz verification"}</Button>
	      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

// ─── Featured Styles Page ─────────────────────────────────────────────────────
// This deliberately mirrors the Featured Door Styles workflow used by the
// administrator, but its procedure only returns styles that have actual cabinet
// SKU rows in the current vendor's supply line. The client never receives a
// different vendor's styles as a fallback.
type VendorFeaturedStyle = {
  id: number;
	  distributorId: number;
  styleCode: string;
  ourName: string;
  distributorName: string;
	  aliasName: string | null;
	  featuredLabel: string | null;
  doorStyle: string | null;
  color: string | null;
  finish: string | null;
  woodSpecies: string | null;
  doorSampleImageUrl: string | null;
	  drawerSampleImageUrl: string | null;
  roomSceneImageUrl: string | null;
  thumbnailImageUrl: string | null;
	  cornerSwatchImageUrl: string | null;
  doorSampleVerified: boolean;
  isFeatured: boolean;
  featuredRank: number;
	  warehouseZips: string[] | null;
	  flatFreightFeeCents: number | null;
	  railWidth: string | null;
	  stileWidth: string | null;
	  centerRailWidth: string | null;
	  profileNotes: string | null;
	  profileDescription: string | null;
	  sourceSpecification: string | null;
  isActive: boolean;
	  skuCount: number;
	  catalogCategories: string[];
	  matchingCabinetCount: number;
	  matchingCabinets: Array<{ masterCode: string; description: string; category: string }>;
	  designerCabinets: Array<{
	    masterCode: string;
	    description: string;
	    category: string;
	    distributorSku: string;
	    platformSku: string;
	    isCompliant: boolean;
	    reason: string | null;
	    canonicalMasterCode: string | null;
	  }>;
	  designerNoncompliantCabinetCount: number;
	  roomScenes: Array<{ id: number; imageUrl: string; sortOrder: number; isVerified: boolean; isActive: boolean; sourceNote: string | null; sourceDistributorId: number | null }>;
};

type VendorFeaturedCategory = { category: string; cabinetCount: number };

function vendorStyleThumb(style: VendorFeaturedStyle): string | null {
  return style.roomSceneImageUrl
    || style.roomScenes.find((scene) => scene.isActive)?.imageUrl
    || style.doorSampleImageUrl
    || style.thumbnailImageUrl
    || null;
}

/** Cabinet source-SKU holds are independent from a style's door-frame profile. */
function FeaturedCabinetDesignerReadiness({ style }: { style: VendorFeaturedStyle }) {
  const hasIssues = style.designerNoncompliantCabinetCount > 0;
  return (
    <details
      data-testid={hasIssues ? "vendor-featured-cabinets-designer-noncompliant" : "vendor-featured-cabinets-designer-compliant"}
      className={`mt-2 rounded-md border px-2.5 py-1.5 text-xs ${hasIssues ? "border-red-300 bg-red-50/80 text-red-900" : "border-emerald-200 bg-emerald-50/60 text-emerald-900"}`}
      open={hasIssues}
    >
	  <summary className="cursor-pointer select-none font-medium">
	        {hasIssues
	          ? `${style.designerNoncompliantCabinetCount} of ${style.designerCabinets.length} featured cabinet${style.designerCabinets.length === 1 ? " is" : "s are"} not Designer-compliant`
	          : `All ${style.designerCabinets.length} featured cabinet${style.designerCabinets.length === 1 ? " is" : "s are"} Designer-compliant`}
      </summary>
      <ul className="mt-2 space-y-1.5 border-t border-current/15 pt-2" aria-label={`${style.ourName} cabinet Designer readiness`}>
        {style.designerCabinets.map((cabinet) => (
          <li
            key={cabinet.platformSku}
            data-testid={cabinet.isCompliant ? "vendor-featured-cabinet-designer-compliant" : "vendor-featured-cabinet-designer-noncompliant"}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-1.5 py-1 ${cabinet.isCompliant ? "bg-white/60" : "bg-red-100 text-red-950"}`}
          >
            <span className="font-mono font-semibold">{cabinet.masterCode}</span>
            <span className="truncate text-muted-foreground">{cabinet.description}</span>
            {cabinet.isCompliant ? (
              <span className="ml-auto shrink-0 font-medium text-emerald-700">Designer ready</span>
            ) : (
              <span className="ml-auto shrink-0 font-medium text-red-800">Not Designer-compliant: {cabinet.reason}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The vendor-facing merchandising editor mirrors the internal Featured Styles
 * materials while intentionally omitting global-only identity and other-line controls. */
function VendorFeaturedStyleEditor({
  style,
  open,
  onClose,
  onSaved,
}: {
  style: VendorFeaturedStyle;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const adminDistId = useAdminDistributorId();
  const [featuredLabel, setFeaturedLabel] = useState(style.featuredLabel ?? "");
  const [aliasName, setAliasName] = useState(style.aliasName ?? "");
  const [doorStyle, setDoorStyle] = useState(style.doorStyle ?? "");
  const [color, setColor] = useState(style.color ?? "");
  const [finish, setFinish] = useState(style.finish ?? "");
  const [woodSpecies, setWoodSpecies] = useState(style.woodSpecies ?? "");
  const [warehouseZips, setWarehouseZips] = useState<string[]>(style.warehouseZips ?? []);
  const [newZip, setNewZip] = useState("");
  const [flatFreight, setFlatFreight] = useState(style.flatFreightFeeCents == null ? "" : (style.flatFreightFeeCents / 100).toFixed(2));
  const [railWidth, setRailWidth] = useState(style.railWidth ?? "");
  const [stileWidth, setStileWidth] = useState(style.stileWidth ?? "");
  const [centerRailWidth, setCenterRailWidth] = useState(style.centerRailWidth ?? "");
  const [profileNotes, setProfileNotes] = useState(style.profileNotes ?? "");
  const [profileDescription, setProfileDescription] = useState(style.profileDescription ?? "");
  const [sourceSpecification, setSourceSpecification] = useState(style.sourceSpecification ?? "");
  const [doorSampleImageUrl, setDoorSampleImageUrl] = useState(style.doorSampleImageUrl ?? "");
  const [drawerSampleImageUrl, setDrawerSampleImageUrl] = useState(style.drawerSampleImageUrl ?? "");
  const [roomSceneImageUrl, setRoomSceneImageUrl] = useState(style.roomSceneImageUrl ?? "");
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState(style.thumbnailImageUrl ?? "");
  const [cornerSwatchImageUrl, setCornerSwatchImageUrl] = useState(style.cornerSwatchImageUrl ?? "");
  const [newSceneUrl, setNewSceneUrl] = useState("");
  const [newSceneNote, setNewSceneNote] = useState("");
  const [uploadTarget, setUploadTarget] = useState<"doorSample" | "drawerSample" | "roomScene" | "thumbnail" | "cornerSwatch" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFeaturedLabel(style.featuredLabel ?? ""); setAliasName(style.aliasName ?? "");
    setDoorStyle(style.doorStyle ?? ""); setColor(style.color ?? ""); setFinish(style.finish ?? ""); setWoodSpecies(style.woodSpecies ?? "");
    setWarehouseZips(style.warehouseZips ?? []); setNewZip("");
    setFlatFreight(style.flatFreightFeeCents == null ? "" : (style.flatFreightFeeCents / 100).toFixed(2));
    setRailWidth(style.railWidth ?? ""); setStileWidth(style.stileWidth ?? ""); setCenterRailWidth(style.centerRailWidth ?? "");
    setProfileNotes(style.profileNotes ?? ""); setProfileDescription(style.profileDescription ?? ""); setSourceSpecification(style.sourceSpecification ?? "");
    setDoorSampleImageUrl(style.doorSampleImageUrl ?? ""); setDrawerSampleImageUrl(style.drawerSampleImageUrl ?? "");
    setRoomSceneImageUrl(style.roomSceneImageUrl ?? ""); setThumbnailImageUrl(style.thumbnailImageUrl ?? ""); setCornerSwatchImageUrl(style.cornerSwatchImageUrl ?? "");
    setNewSceneUrl(""); setNewSceneNote("");
  }, [style, open]);

  const withLine = <T extends Record<string, unknown>>(input: T) => ({ ...input, ...(adminDistId ? { distributorId: adminDistId } : {}) });
  const saved = () => { toast.success("Featured Style materials saved"); onSaved(); };
  const update = trpc.distributorPortal.updateFeaturedStyleMaterials.useMutation({ onSuccess: saved, onError: (error) => toast.error(error.message) });
  const addScene = trpc.distributorPortal.addFeaturedStyleScene.useMutation({ onSuccess: () => { toast.success("Verified room scene added"); setNewSceneUrl(""); setNewSceneNote(""); onSaved(); }, onError: (error) => toast.error(error.message) });
  const deleteScene = trpc.distributorPortal.deleteFeaturedStyleScene.useMutation({ onSuccess: () => { toast.success("Your room scene was removed"); onSaved(); }, onError: (error) => toast.error(error.message) });
  const upload = trpc.distributorPortal.updateDoorStyleImage.useMutation({ onSuccess: () => { toast.success("Style image uploaded"); onSaved(); }, onError: (error) => toast.error(error.message) });

  const addZip = () => {
    const zip = newZip.replace(/\D/g, "").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) { toast.error("Shipping origin ZIP must be exactly 5 digits"); return; }
    if (warehouseZips.includes(zip)) { toast.message("This warehouse ZIP is already listed"); return; }
    setWarehouseZips((current) => [...current, zip]); setNewZip("");
  };
  const requestUpload = (target: typeof uploadTarget) => { setUploadTarget(target); requestAnimationFrame(() => fileInputRef.current?.click()); };
  const handleUpload = async (file: File) => {
    if (!uploadTarget) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await upload.mutateAsync(withLine({ styleId: style.id, imageType: uploadTarget, imageBase64: base64, contentType: file.type || "image/jpeg" }));
    setUploadTarget(null);
  };
	  const save = () => {
	    const freight = flatFreight.trim() ? Number(flatFreight) : null;
    if (freight != null && (!Number.isFinite(freight) || freight < 0)) { toast.error("Fallback freight must be a valid non-negative dollar amount"); return; }
    update.mutate(withLine({
	      styleId: style.id, featuredLabel: featuredLabel.trim() || null, aliasName: aliasName.trim() || null,
	      doorStyle: doorStyle.trim() || null, color: color.trim() || null, finish: finish.trim() || null, woodSpecies: woodSpecies.trim() || null,
	      warehouseZips: warehouseZips.length ? warehouseZips : null, flatFreightFeeCents: freight == null ? null : Math.round(freight * 100),
	      profileNotes: profileNotes.trim() || null, profileDescription: profileDescription.trim() || null,
      doorSampleImageUrl: doorSampleImageUrl.trim() || null, drawerSampleImageUrl: drawerSampleImageUrl.trim() || null, roomSceneImageUrl: roomSceneImageUrl.trim() || null,
      thumbnailImageUrl: thumbnailImageUrl.trim() || null, cornerSwatchImageUrl: cornerSwatchImageUrl.trim() || null,
    }));
  };
  const imageField = (label: string, hint: string, value: string, setValue: (value: string) => void, target: NonNullable<typeof uploadTarget>) => (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2"><Label className="text-xs font-semibold">{label}</Label><Button type="button" size="sm" variant="outline" className="h-7" disabled={upload.isPending} onClick={() => requestUpload(target)}><Upload className="mr-1 h-3.5 w-3.5" />Upload</Button></div>
      {value && <img src={value} alt={`${label} preview`} className="h-24 w-full rounded border border-border object-cover" />}
      <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://… or upload an image" className="h-8 text-xs" />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );

  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent className="!flex h-[min(92dvh,900px)] max-h-[calc(100dvh-1rem)] w-[min(48rem,calc(100vw-1rem))] flex-col overflow-hidden p-5 sm:max-w-none">
      <DialogHeader className="shrink-0"><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-amber-600" />Edit Featured Door Style <span className="font-normal text-muted-foreground">— {style.ourName}</span></DialogTitle></DialogHeader>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ""; }} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-2 pr-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3"><div><Label>Customer-facing names</Label><p className="text-xs text-muted-foreground">These names promote this vendor’s own cabinet line in the catalog, featured row, and Designer.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Alias name</Label><Input value={aliasName} onChange={(event) => setAliasName(event.target.value)} placeholder={style.ourName} /></div><div className="space-y-1"><Label className="text-xs">Featured label</Label><Input value={featuredLabel} onChange={(event) => setFeaturedLabel(event.target.value)} placeholder={aliasName || style.ourName} /></div></div><p className="text-xs text-muted-foreground">Leave a field blank to use the vendor’s standard Door Style name.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Door style type</Label><Input value={doorStyle} onChange={(event) => setDoorStyle(event.target.value)} placeholder="e.g. Shaker" /></div><div className="space-y-1"><Label className="text-xs">Color</Label><Input value={color} onChange={(event) => setColor(event.target.value)} placeholder="e.g. White" /></div><div className="space-y-1"><Label className="text-xs">Finish</Label><Input value={finish} onChange={(event) => setFinish(event.target.value)} placeholder="e.g. Painted" /></div><div className="space-y-1"><Label className="text-xs">Wood species</Label><Input value={woodSpecies} onChange={(event) => setWoodSpecies(event.target.value)} placeholder="e.g. Maple" /></div></div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-3"><div><Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-sky-700" />Shipping Origin ZIPs</Label><p className="text-xs text-muted-foreground">Same per-style origin controls as Featured Styles. Saved ZIPs become the style’s private freight origins.</p></div><div className="flex gap-2"><Input value={newZip} onChange={(event) => setNewZip(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addZip(); } }} inputMode="numeric" placeholder="5-digit warehouse ZIP" maxLength={5} /><Button type="button" variant="outline" onClick={addZip}><Plus className="mr-1 h-4 w-4" />Add</Button></div><div className="flex flex-wrap gap-2">{warehouseZips.map((zip) => <Badge key={zip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">{zip}<button type="button" onClick={() => setWarehouseZips((current) => current.filter((item) => item !== zip))} aria-label={`Remove warehouse ZIP ${zip}`}><X className="h-3.5 w-3.5" /></button></Badge>)}</div><div className="space-y-1"><Label className="text-xs">Plan B fallback freight fee (optional)</Label><div className="flex items-center gap-2"><span>$</span><Input value={flatFreight} onChange={(event) => setFlatFreight(event.target.value)} inputMode="decimal" placeholder="Used only if live freight is unavailable" /></div></div></div>
	        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3"><div><Label className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" />Verified frame profile</Label><p className="text-xs text-muted-foreground">Designer geometry is controlled by a submitted physical sample door and a CabinetDealz team measurement. Use <strong>Door Styles → Submit sample measurements</strong> to record the vendor source and select every style with the same profile.</p></div><div className="grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Rail</p><p className="font-medium">{style.railWidth ?? "Pending"}</p></div><div><p className="text-xs text-muted-foreground">Stile</p><p className="font-medium">{style.stileWidth ?? "Pending"}</p></div><div><p className="text-xs text-muted-foreground">Center rail</p><p className="font-medium">{style.centerRailWidth ?? "—"}</p></div></div><p className="text-xs text-muted-foreground">{style.sourceSpecification ?? "No CabinetDealz-verified sample measurement yet — Designer uses a neutral face."}</p><div className="space-y-1"><Label className="text-xs">Profile notes</Label><Input value={profileNotes} onChange={(event) => setProfileNotes(event.target.value)} placeholder="e.g. Beaded inner edge" /></div><div className="space-y-1"><Label className="text-xs">Profile description</Label><textarea value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} rows={4} placeholder="Customer-facing educational description of this style" className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" /></div></div>
        <div className="space-y-3"><div><Label>Image materials</Label><p className="text-xs text-muted-foreground">Upload or paste the exact verified image for this vendor’s Door Style. Saving updates only this vendor’s line.</p></div><div className="grid gap-3 sm:grid-cols-2">{imageField("Room scene photo", "Primary Featured Styles and cabinet-line scene.", roomSceneImageUrl, setRoomSceneImageUrl, "roomScene")}{imageField("Door sample photo", "Door panel material for the Designer and catalog.", doorSampleImageUrl, setDoorSampleImageUrl, "doorSample")}{imageField("Drawer sample photo", "Drawer-front material; blank falls back to the door sample.", drawerSampleImageUrl, setDrawerSampleImageUrl, "drawerSample")}{imageField("Corner swatch", "Angled profile/grain close-up for Featured Styles.", cornerSwatchImageUrl, setCornerSwatchImageUrl, "cornerSwatch")}{imageField("Thumbnail override", "Optional small-card thumbnail override.", thumbnailImageUrl, setThumbnailImageUrl, "thumbnail")}</div></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3"><div><Label>Verified room scene library ({style.roomScenes.length}/6)</Label><p className="text-xs text-muted-foreground">Vendor submissions are verified and can feature this cabinet line. You can only remove scenes submitted by your own line.</p></div>{style.roomScenes.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{style.roomScenes.map((scene) => <div key={scene.id} className="relative overflow-hidden rounded border border-border bg-background"><img src={scene.imageUrl} alt={`Room scene for ${style.ourName}`} className="h-20 w-full object-cover" /><p className="truncate p-1.5 text-[10px] text-muted-foreground">{scene.isVerified ? "Verified" : "Unverified"}{scene.sourceNote ? ` · ${scene.sourceNote}` : ""}</p>{scene.sourceDistributorId === style.distributorId && <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1 h-6 w-6 bg-background/90 text-destructive" disabled={deleteScene.isPending} onClick={() => deleteScene.mutate(withLine({ sceneId: scene.id }))} aria-label="Remove my room scene"><Trash2 className="h-3.5 w-3.5" /></Button>}</div>)}</div>}{style.roomScenes.length < 6 && <div className="border-t border-emerald-200 pt-3 space-y-2"><Input value={newSceneUrl} onChange={(event) => setNewSceneUrl(event.target.value)} placeholder="Verified room scene URL" /><Input value={newSceneNote} onChange={(event) => setNewSceneNote(event.target.value)} placeholder="Private source note (optional)" /><Button type="button" size="sm" disabled={!newSceneUrl.trim() || addScene.isPending} onClick={() => addScene.mutate(withLine({ styleId: style.id, imageUrl: newSceneUrl, sourceNote: newSceneNote.trim() || null }))}><Plus className="mr-1 h-3.5 w-3.5" />Add verified scene</Button></div>}</div>
      </div>
      <DialogFooter className="shrink-0 border-t border-border pt-3"><Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button><Button onClick={save} disabled={update.isPending} className="bg-amber-600 text-white hover:bg-amber-700">{update.isPending ? "Saving…" : "Save Featured Style"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function VendorFeaturedStylesPage() {
  const utils = trpc.useUtils();
  const adminDistId = useAdminDistributorId();
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
	  const [editingStyle, setEditingStyle] = useState<VendorFeaturedStyle | null>(null);
  const featuredQueryInput = useMemo(() => ({
    ...(adminDistId ? { distributorId: adminDistId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(selectedCategories.length > 0 ? { categories: selectedCategories } : {}),
  }), [adminDistId, search, selectedCategories]);
  const stylesQuery = trpc.distributorPortal.featuredStyles.useQuery(
    featuredQueryInput,
  );
  const setFeatured = trpc.distributorPortal.setFeaturedStyle.useMutation({
    onSuccess: () => {
      utils.distributorPortal.featuredStyles.invalidate();
      utils.distributorPortal.myLine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const reorder = trpc.distributorPortal.reorderFeaturedStyles.useMutation({
    onSuccess: () => utils.distributorPortal.featuredStyles.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const styles = useMemo(
    () => (stylesQuery.data?.styles ?? []) as VendorFeaturedStyle[],
    [stylesQuery.data],
  );
  const categories = useMemo(
    () => (stylesQuery.data?.categories ?? []) as VendorFeaturedCategory[],
    [stylesQuery.data],
  );
  const hasActiveFilters = search.trim().length > 0 || selectedCategories.length > 0;
  const featured = useMemo(
    () => styles
      .filter((style) => style.isFeatured)
      .sort((left, right) => left.featuredRank - right.featuredRank || left.ourName.localeCompare(right.ourName)),
    [styles],
  );
  const available = useMemo(
    () => styles
      .filter((style) => style.isActive && !style.isFeatured)
      .sort((left, right) => left.ourName.localeCompare(right.ourName)),
    [styles],
  );

  const hasVerifiedScene = (style: VendorFeaturedStyle) =>
    style.roomScenes.some((scene) => scene.isActive && scene.isVerified);
  const mutateInput = (input: { styleId: number; featured: boolean }) => ({
    ...input,
    ...(adminDistId ? { distributorId: adminDistId } : {}),
  });
  const move = (index: number, direction: -1 | 1) => {
    if (hasActiveFilters) return;
    const next = [...featured];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({
      orderedIds: next.map((style) => style.id),
      ...(adminDistId ? { distributorId: adminDistId } : {}),
    });
  };

  if (stylesQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>;
  }
  if (stylesQuery.error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load Featured Styles: {stylesQuery.error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
	          <h2 className="flex items-center gap-2 text-2xl font-bold"><Star className="h-5 w-5 text-primary" /> Featured Door Styles</h2>
	          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
	            Curate and edit the materials for cabinet lines featured from your vendor portal. This copy of Featured Styles only includes door styles that have cabinets in your catalog.
	          </p>
	        </div>
	        <Badge variant="secondary" className="self-start text-sm sm:self-auto">{featured.length} matching featured line{featured.length === 1 ? "" : "s"}</Badge>
	      </div>

	      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search cabinet SKUs and descriptions"
              placeholder="Search cabinet SKU or description…"
              className="h-10 pl-9 pr-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setSearch("")} aria-label="Clear cabinet search"><X className="h-4 w-4" /></Button>}
          </div>
          {hasActiveFilters && <Button variant="outline" size="sm" className="w-full lg:w-auto" onClick={() => { setSearch(""); setSelectedCategories([]); }}>Clear filters</Button>}
          <span className="text-xs text-muted-foreground">{styles.length} matching cabinet line{styles.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Cabinet categories">
          <Button size="sm" variant={selectedCategories.length === 0 ? "default" : "outline"} className="h-8" onClick={() => setSelectedCategories([])} aria-pressed={selectedCategories.length === 0}>All categories</Button>
          {categories.map(({ category, cabinetCount }) => {
            const selected = selectedCategories.includes(category);
            return <Button key={category} size="sm" variant={selected ? "default" : "outline"} className="h-8 gap-1.5" onClick={() => setSelectedCategories((current) => selected ? current.filter((item) => item !== category) : [...current, category])} aria-pressed={selected}>{category} <span className="text-[10px] opacity-75">{cabinetCount}</span></Button>;
          })}
        </div>
	        <p className="mt-3 text-xs text-muted-foreground">Search matches cabinet master codes, vendor/platform SKUs, and descriptions. Category filters apply to the actual cabinets carried by this vendor.</p>
	      </div>

	      <div data-testid="vendor-featured-style-edit-help" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
	        <div><span className="font-semibold">Edit your line directly.</span> Use <span className="font-semibold">Edit materials</span> beside any cabinet-backed door style to update its customer-facing name, photos, frame details, featured materials, and style-specific freight origins.</div>
	        <span className="shrink-0 text-xs text-amber-800">Only your vendor line changes.</span>
	      </div>

	      <div>
	        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured Door Styles ({featured.length})</h3>{hasActiveFilters && <span className="text-xs text-muted-foreground">Clear filters to reorder the complete list.</span>}</div>
	        {featured.length === 0 ? (
	          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
	            {hasActiveFilters ? "No featured cabinet lines match these cabinet filters." : "No featured cabinet lines yet. Add a room-scene-ready style from your cabinet catalog below."}
          </div>
        ) : (
	          <ul className="space-y-2">
	            {featured.map((style, index) => {
	              const image = vendorStyleThumb(style);
	              const designerCompliance = designerFrameCompliance(style);
	              const cabinetCompliance = style.designerNoncompliantCabinetCount === 0;
	              return (
	                <li
	                  key={style.id}
	                  data-testid={designerCompliance.isCompliant && cabinetCompliance ? "vendor-featured-style-designer-compliant" : "vendor-featured-style-designer-noncompliant"}
	                  className={`flex items-center gap-3 rounded-lg border p-2.5 ${designerCompliance.isCompliant && cabinetCompliance ? "border-border bg-card" : "border-red-400 bg-red-50/80"}`}
	                >
	                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
	                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
	                  {image ? <img src={image} alt={style.ourName} className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-border" /> : <div className="h-12 w-12 shrink-0 rounded bg-muted" />}
	                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{style.ourName}</p>
	                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
	                      <Badge variant="outline" className="border-blue-300 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700"><Package className="mr-0.5 h-2.5 w-2.5" /> {style.skuCount} cabinet SKU{style.skuCount === 1 ? "" : "s"}</Badge>
	                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700"><ImageIcon className="mr-0.5 h-2.5 w-2.5" /> Room scene ready</Badge>
	                      <Badge
	                        variant="outline"
	                        className={designerCompliance.isCompliant
	                          ? "border-sky-300 bg-sky-50 px-1.5 py-0 text-[10px] text-sky-700"
	                          : "border-red-400 bg-red-100 px-1.5 py-0 text-[10px] font-semibold text-red-800"}
	                        title={designerCompliance.isCompliant
	                          ? "Verified rail, stile, and official citation will drive the Designer frame for this style."
	                          : `Not Designer-compliant: ${designerCompliance.reason}`}
	                      >
	                        {!designerCompliance.isCompliant && <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />}
	                        {designerCompliance.isCompliant ? "Designer compliant" : "Not Designer-compliant"}
	                      </Badge>
	                      {style.catalogCategories.slice(0, 2).map((category) => <Badge key={category} variant="secondary" className="px-1.5 py-0 text-[10px]">{category}</Badge>)}
	                      <span className="text-xs text-muted-foreground">{[style.doorStyle, style.color, style.finish].filter(Boolean).join(" · ")}</span>
	                    </div>
	                    {!designerCompliance.isCompliant && <p className="mt-1 text-xs font-medium text-red-800">Designer requirement: {designerCompliance.reason}</p>}
	                    <FeaturedCabinetDesignerReadiness style={style} />
	                    {hasActiveFilters && style.matchingCabinets.length > 0 && <p className="mt-1 truncate text-[11px] text-primary">Matches: {style.matchingCabinets.map((cabinet) => cabinet.masterCode).join(", ")} {style.matchingCabinetCount > style.matchingCabinets.length ? `+${style.matchingCabinetCount - style.matchingCabinets.length} more` : ""}</p>}
	                  </div>
			                  <div className="flex shrink-0 items-center gap-1">
			                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingStyle(style)} aria-label={`Edit ${style.ourName} Featured Style materials`} title="Edit Featured Style materials"><Pencil className="h-3.5 w-3.5" />Edit materials</Button>
	                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0 || reorder.isPending || hasActiveFilters} onClick={() => move(index, -1)} aria-label={`Move ${style.ourName} up`} title={hasActiveFilters ? "Clear filters to reorder" : "Move up"}><ArrowUp className="h-4 w-4" /></Button>
	                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={index === featured.length - 1 || reorder.isPending || hasActiveFilters} onClick={() => move(index, 1)} aria-label={`Move ${style.ourName} down`} title={hasActiveFilters ? "Clear filters to reorder" : "Move down"}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" disabled={setFeatured.isPending} onClick={() => setFeatured.mutate(mutateInput({ styleId: style.id, featured: false }))} aria-label={`Remove ${style.ourName} from featured`}><X className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

	      <div>
	        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">My cabinet lines <span className="font-normal normal-case text-muted-foreground/60">({available.length})</span></h3>
	        </div>
	        {available.length === 0 ? (
	          <p className="text-sm text-muted-foreground">{styles.length === 0 ? hasActiveFilters ? "No cabinet-backed door styles match these cabinet filters." : "No cabinet-backed door styles are available in this vendor catalog." : "No matching cabinet lines."}</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((style) => {
              const image = vendorStyleThumb(style);
              const sceneReady = hasVerifiedScene(style);
              return (
                <div key={style.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                  {image ? <img src={image} alt={style.ourName} className="h-11 w-11 shrink-0 rounded object-cover ring-1 ring-border" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground/40" /></div>}
                  <div className="min-w-0 flex-1">
	                    <p className="truncate text-sm font-medium">{style.ourName}</p>
	                    <p className="truncate text-xs text-muted-foreground">{style.skuCount} cabinet SKU{style.skuCount === 1 ? "" : "s"} {[style.doorStyle, style.color].filter(Boolean).length > 0 ? `· ${[style.doorStyle, style.color].filter(Boolean).join(" · ")}` : ""}</p>
	                    {hasActiveFilters && style.matchingCabinets.length > 0 && <p className="truncate text-[11px] text-primary">Matches: {style.matchingCabinets.map((cabinet) => cabinet.masterCode).join(", ")}{style.matchingCabinetCount > style.matchingCabinets.length ? ` +${style.matchingCabinetCount - style.matchingCabinets.length}` : ""}</p>}
	                    <p className={`mt-1 text-[10px] ${sceneReady ? "text-emerald-700" : "text-amber-700"}`}>{sceneReady ? "Verified room scene ready" : "Add a verified room scene in Door Styles first"}</p>
	                  </div>
		                  <div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingStyle(style)} aria-label={`Edit ${style.ourName} Featured Style materials`} title="Edit Featured Style materials"><Pencil className="h-3.5 w-3.5" />Edit materials</Button><Button size="icon" variant="ghost" className="h-8 w-8" disabled={setFeatured.isPending || !sceneReady} onClick={() => setFeatured.mutate(mutateInput({ styleId: style.id, featured: true }))} aria-label={`Feature ${style.ourName}`} title={sceneReady ? "Feature this cabinet line" : "Add a verified matching room scene in Door Styles first"}><Star className="h-4 w-4 text-muted-foreground/60" /></Button></div>
                </div>
              );
            })}
          </div>
        )}
	      </div>
	      {editingStyle && <VendorFeaturedStyleEditor style={editingStyle} open={Boolean(editingStyle)} onClose={() => setEditingStyle(null)} onSaved={() => { utils.distributorPortal.featuredStyles.invalidate(); utils.distributorPortal.myLine.invalidate(); }} />}
	    </div>
	  );
}

// ─── Shipping Page ────────────────────────────────────────────────────────────
function centsToDollars(value: number | null | undefined): string | null {
  return value == null ? null : `$${(value / 100).toFixed(2)}`;
}

type VendorShippingLine = {
  id: number; name: string; code?: string | null; warehouseName: string | null; warehouseAddress: string | null; warehouseZips: string[] | null;
  leadTimeDays: number | null; shippingRuleMode: "live" | "fixed" | "threshold"; shippingFlatFreightFeeCents: number | null;
  shippingFreeFreightThresholdCents: number | null; shippingZipRates: Array<{ zipPrefix: string; feeCents: number }> | null; shippingExceptions: string | null;
  pickupEnabled: boolean; pickupZip: string | null; pickupAddress: string | null; pickupRadiusMiles: number | null;
};

function VendorShippingSettingsEditor({ line, open, onClose, onSaved }: { line: VendorShippingLine; open: boolean; onClose: () => void; onSaved: () => void }) {
  const adminDistId = useAdminDistributorId();
  const [warehouseName, setWarehouseName] = useState(line.warehouseName ?? "");
  const [warehouseAddress, setWarehouseAddress] = useState(line.warehouseAddress ?? "");
  const [zips, setZips] = useState<string[]>(line.warehouseZips ?? []);
  const [newZip, setNewZip] = useState("");
  const [leadTime, setLeadTime] = useState(line.leadTimeDays == null ? "" : String(line.leadTimeDays));
  const [ruleMode, setRuleMode] = useState<"live" | "fixed" | "threshold">(line.shippingRuleMode);
  const [flatFee, setFlatFee] = useState(line.shippingFlatFreightFeeCents == null ? "" : (line.shippingFlatFreightFeeCents / 100).toFixed(2));
  const [freeThreshold, setFreeThreshold] = useState(line.shippingFreeFreightThresholdCents == null ? "" : (line.shippingFreeFreightThresholdCents / 100).toFixed(2));
  const [zipRates, setZipRates] = useState((line.shippingZipRates ?? []).map((rate) => `${rate.zipPrefix}:${(rate.feeCents / 100).toFixed(2)}`).join("\n"));
  const [exceptions, setExceptions] = useState(line.shippingExceptions ?? "");
  const [pickupEnabled, setPickupEnabled] = useState(line.pickupEnabled);
  const [pickupZip, setPickupZip] = useState(line.pickupZip ?? "");
  const [pickupAddress, setPickupAddress] = useState(line.pickupAddress ?? "");
  const [pickupRadius, setPickupRadius] = useState(line.pickupRadiusMiles == null ? "100" : String(line.pickupRadiusMiles));
  useEffect(() => {
    if (!open) return;
    setWarehouseName(line.warehouseName ?? ""); setWarehouseAddress(line.warehouseAddress ?? ""); setZips(line.warehouseZips ?? []); setNewZip("");
    setLeadTime(line.leadTimeDays == null ? "" : String(line.leadTimeDays)); setRuleMode(line.shippingRuleMode);
    setFlatFee(line.shippingFlatFreightFeeCents == null ? "" : (line.shippingFlatFreightFeeCents / 100).toFixed(2)); setFreeThreshold(line.shippingFreeFreightThresholdCents == null ? "" : (line.shippingFreeFreightThresholdCents / 100).toFixed(2)); setZipRates((line.shippingZipRates ?? []).map((rate) => `${rate.zipPrefix}:${(rate.feeCents / 100).toFixed(2)}`).join("\n")); setExceptions(line.shippingExceptions ?? "");
    setPickupEnabled(line.pickupEnabled); setPickupZip(line.pickupZip ?? ""); setPickupAddress(line.pickupAddress ?? ""); setPickupRadius(line.pickupRadiusMiles == null ? "100" : String(line.pickupRadiusMiles));
  }, [line, open]);
  const save = trpc.distributorPortal.updateShippingSettings.useMutation({ onSuccess: () => { toast.success("Shipping settings saved"); onSaved(); onClose(); }, onError: (error) => toast.error(error.message) });
  const addZip = () => { const zip = newZip.replace(/\D/g, "").slice(0, 5); if (!/^\d{5}$/.test(zip)) { toast.error("Warehouse ZIP must be exactly 5 digits"); return; } if (zips.includes(zip)) return; setZips((current) => [...current, zip]); setNewZip(""); };
  const parseDollars = (value: string, label: string) => { if (!value.trim()) return null; const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative amount`); return Math.round(parsed * 100); };
  const parseZipRates = () => zipRates.split("\n").map((lineValue) => lineValue.trim()).filter(Boolean).map((lineValue) => { const [prefix, dollars] = lineValue.split(":").map((part) => part.trim()); if (!/^\d{3,5}$/.test(prefix ?? "") || !dollars) throw new Error("ZIP rates must use one entry per line: 3–5 digit ZIP prefix: dollar amount"); const amount = Number(dollars); if (!Number.isFinite(amount) || amount < 0) throw new Error("Each ZIP rate must be a non-negative dollar amount"); return { zipPrefix: prefix, feeCents: Math.round(amount * 100) }; });
  const submit = () => {
    try {
      if (zips.length === 0) throw new Error("Add at least one warehouse ZIP");
      const lead = leadTime.trim() ? Number(leadTime) : null; if (lead != null && (!Number.isInteger(lead) || lead < 0 || lead > 365)) throw new Error("Lead time must be a whole number from 0 to 365 days");
      const radius = pickupEnabled ? Number(pickupRadius) : 0; if (pickupEnabled && (!Number.isInteger(radius) || radius < 1 || radius > 1000)) throw new Error("Pickup radius must be a whole number from 1 to 1,000 miles");
      const normalizedPickupZip = pickupZip.replace(/\D/g, ""); if (pickupEnabled && normalizedPickupZip && !/^\d{5}$/.test(normalizedPickupZip)) throw new Error("Pickup ZIP must be exactly 5 digits");
      save.mutate({ ...(adminDistId ? { distributorId: adminDistId } : {}), warehouseName: warehouseName.trim() || null, warehouseAddress: warehouseAddress.trim() || null, warehouseZips: zips, leadTimeDays: lead, shippingRuleMode: ruleMode, shippingFlatFreightFeeCents: parseDollars(flatFee, "Fixed freight"), shippingFreeFreightThresholdCents: parseDollars(freeThreshold, "Free-freight threshold"), shippingZipRates: parseZipRates(), shippingExceptions: exceptions.trim() || null, pickupEnabled, pickupZip: normalizedPickupZip || null, pickupAddress: pickupAddress.trim() || null, pickupRadiusMiles: pickupEnabled ? radius : null });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review shipping settings"); }
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="!flex h-[min(90dvh,850px)] max-h-[calc(100dvh-1rem)] w-[min(44rem,calc(100vw-1rem))] flex-col overflow-hidden p-5 sm:max-w-none"><DialogHeader className="shrink-0"><DialogTitle className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />Edit Shipping & Warehouses <span className="font-normal text-muted-foreground">— {line.name}</span></DialogTitle></DialogHeader><div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-2 pr-2"><div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-3"><div><Label>Warehouse origins</Label><p className="text-xs text-muted-foreground">These ZIPs are the automatic freight origins and power the all-warehouses check.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Warehouse name</Label><Input value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Warehouse or branch name" /></div><div className="space-y-1"><Label className="text-xs">Lead time (days)</Label><Input value={leadTime} onChange={(event) => setLeadTime(event.target.value)} type="number" min="0" max="365" placeholder="e.g. 7" /></div></div><div className="space-y-1"><Label className="text-xs">Warehouse address</Label><Input value={warehouseAddress} onChange={(event) => setWarehouseAddress(event.target.value)} placeholder="Street address for reference" /></div><div className="flex gap-2"><Input value={newZip} onChange={(event) => setNewZip(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addZip(); } }} inputMode="numeric" maxLength={5} placeholder="5-digit warehouse ZIP" /><Button type="button" variant="outline" onClick={addZip}><Plus className="mr-1 h-4 w-4" />Add ZIP</Button></div><div className="flex flex-wrap gap-2">{zips.map((zip) => <Badge key={zip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">{zip}<button type="button" onClick={() => setZips((current) => current.filter((item) => item !== zip))} aria-label={`Remove warehouse ZIP ${zip}`}><X className="h-3.5 w-3.5" /></button></Badge>)}</div></div><div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3"><div><Label>Freight rule</Label><p className="text-xs text-muted-foreground">Live quotes remain the preferred method. Fixed and threshold rules need a configured fee or ZIP rate.</p></div><Select value={ruleMode} onValueChange={(value) => setRuleMode(value as typeof ruleMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live carrier quote</SelectItem><SelectItem value="fixed">Fixed freight</SelectItem><SelectItem value="threshold">Free-freight threshold / ZIP rate</SelectItem></SelectContent></Select><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Fixed freight ($)</Label><Input value={flatFee} onChange={(event) => setFlatFee(event.target.value)} inputMode="decimal" placeholder="Optional fallback or fixed charge" /></div><div className="space-y-1"><Label className="text-xs">Free-freight threshold ($)</Label><Input value={freeThreshold} onChange={(event) => setFreeThreshold(event.target.value)} inputMode="decimal" placeholder="Optional order threshold" /></div></div><div className="space-y-1"><Label className="text-xs">ZIP rates</Label><textarea value={zipRates} onChange={(event) => setZipRates(event.target.value)} rows={4} placeholder={"Example:\n900:125.00\n10001:200.00"} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" /><p className="text-[11px] text-muted-foreground">One line per rate: 3–5 digit ZIP prefix: dollar amount.</p></div><div className="space-y-1"><Label className="text-xs">Shipping note / exception</Label><textarea value={exceptions} onChange={(event) => setExceptions(event.target.value)} rows={3} placeholder="Delivery restrictions or freight policy note" className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" /></div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3"><div className="flex items-center justify-between gap-3"><div><Label>Local pickup</Label><p className="text-xs text-muted-foreground">Offer pickup from this vendor’s own location.</p></div><Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} aria-label="Enable local pickup" /></div>{pickupEnabled && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Pickup ZIP</Label><Input value={pickupZip} onChange={(event) => setPickupZip(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" maxLength={5} placeholder={zips[0] ?? "5-digit ZIP"} /></div><div className="space-y-1"><Label className="text-xs">Pickup radius (miles)</Label><Input value={pickupRadius} onChange={(event) => setPickupRadius(event.target.value)} type="number" min="1" max="1000" /></div><div className="space-y-1 sm:col-span-2"><Label className="text-xs">Pickup address</Label><Input value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} placeholder="Customer-facing pickup address" /></div></div>}</div></div><DialogFooter className="shrink-0 border-t border-border pt-3"><Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save Shipping Settings"}</Button></DialogFooter></DialogContent></Dialog>;
}

type VendorShippingStyle = {
  id: number;
  ourName: string;
  originZips: string[];
  originMode: "style" | "line";
  allWarehousesCovered: boolean;
};

function VendorStyleOriginsEditor({ style, warehouseZips, open, onClose, onSaved }: { style: VendorShippingStyle; warehouseZips: string[]; open: boolean; onClose: () => void; onSaved: () => void }) {
  const adminDistId = useAdminDistributorId();
  const [origins, setOrigins] = useState<string[]>(style.originMode === "style" ? style.originZips : []);
  const [newZip, setNewZip] = useState("");
  const update = trpc.distributorPortal.updateFeaturedStyleMaterials.useMutation({
    onSuccess: () => { toast.success(`Shipping origins saved for ${style.ourName}`); onSaved(); onClose(); },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    if (!open) return;
    setOrigins(style.originMode === "style" ? style.originZips : []);
    setNewZip("");
  }, [open, style]);
  const addZip = () => {
    const zip = newZip.replace(/\D/g, "").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) { toast.error("Shipping origin ZIP must be exactly 5 digits"); return; }
    if (!origins.includes(zip)) setOrigins((current) => [...current, zip]);
    setNewZip("");
  };
  const save = () => {
    if (origins.length === 0 && warehouseZips.length === 0) {
      toast.error("Add a shipping origin or configure a vendor warehouse origin first");
      return;
    }
    update.mutate({ ...(adminDistId ? { distributorId: adminDistId } : {}), styleId: style.id, warehouseZips: origins });
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent className="w-[min(32rem,calc(100vw-1rem))] p-5">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Edit shipping origins <span className="font-normal text-muted-foreground">— {style.ourName}</span></DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm text-sky-950">
          {style.originMode === "line"
            ? "This cabinet line currently inherits every vendor warehouse origin. Add ZIPs below only when this style ships from a different subset of warehouses."
            : "This cabinet line has its own shipping-origin assignment. Remove all ZIPs to inherit every vendor warehouse origin again."}
        </div>
        <div className="flex gap-2"><Input value={newZip} onChange={(event) => setNewZip(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addZip(); } }} inputMode="numeric" maxLength={5} placeholder="5-digit shipping origin ZIP" /><Button type="button" variant="outline" onClick={addZip}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
        {origins.length > 0 && <div className="flex flex-wrap gap-2">{origins.map((zip) => <Badge key={zip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">{zip}<button type="button" onClick={() => setOrigins((current) => current.filter((item) => item !== zip))} aria-label={`Remove ${zip} from ${style.ourName} shipping origins`}><X className="h-3.5 w-3.5" /></button></Badge>)}</div>}
        <Button type="button" variant="outline" className="w-full" onClick={() => setOrigins([])} disabled={origins.length === 0 || warehouseZips.length === 0}>Use all {warehouseZips.length || "vendor"} warehouse origin{warehouseZips.length === 1 ? "" : "s"}</Button>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button><Button onClick={save} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save origins"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AdminWarehouseTemplateCard() {
  const template = trpc.distributorPortal.warehouseTemplate.useQuery();
  const save = trpc.distributorPortal.saveWarehouseTemplate.useMutation({
    onSuccess: (result) => { setZips(result.warehouseTemplateZips); toast.success("Warehouse template saved for new distributor accounts"); void template.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const [zips, setZips] = useState<string[]>([]);
  const [newZip, setNewZip] = useState("");
  useEffect(() => { setZips(template.data?.warehouseTemplateZips ?? []); }, [template.data?.warehouseTemplateZips]);
  const addZip = () => {
    if (!/^\d{5}$/.test(newZip)) { toast.error("Enter a five-digit warehouse ZIP."); return; }
    if (!zips.includes(newZip)) setZips((current) => [...current, newZip]);
    setNewZip("");
  };
  return <Card data-testid="admin-warehouse-template" className="border-indigo-200 bg-indigo-50/40">
    <CardHeader className="pb-3"><CardTitle className="text-base">Shared warehouse template</CardTitle><CardDescription>These verified origins are copied only when a new distributor account is created. Existing accounts are not changed; a vendor can still override its own origins.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex gap-2"><Input value={newZip} onChange={(event) => setNewZip(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addZip(); } }} inputMode="numeric" maxLength={5} placeholder="5-digit warehouse ZIP" /><Button type="button" variant="outline" onClick={addZip}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
      <div className="flex min-h-8 flex-wrap gap-2">{zips.length === 0 ? <span className="text-sm text-muted-foreground">No shared origins configured.</span> : zips.map((zip) => <Badge key={zip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">{zip}<button type="button" onClick={() => setZips((current) => current.filter((item) => item !== zip))} aria-label={`Remove template warehouse ZIP ${zip}`}><X className="h-3.5 w-3.5" /></button></Badge>)}</div>
      <Button onClick={() => save.mutate({ warehouseTemplateZips: zips })} disabled={save.isPending || template.isLoading}>{save.isPending ? "Saving…" : "Save shared template"}</Button>
    </CardContent>
  </Card>;
}

function VendorShippingPage() {
  const adminDistId = useAdminDistributorId();
	  const { user } = useAuth();
	  const [editingShipping, setEditingShipping] = useState(false);
  const [editingStyleOrigins, setEditingStyleOrigins] = useState<VendorShippingStyle | null>(null);
  const shipping = trpc.distributorPortal.shippingOverview.useQuery(
    adminDistId ? { distributorId: adminDistId } : undefined,
  );
  const integrations = trpc.distributorPortal.listIntegrations.useQuery(
    adminDistId ? { distributorId: adminDistId } : undefined,
  );

  if (shipping.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (shipping.error || !shipping.data) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load shipping readiness: {shipping.error?.message ?? "No supply-line data returned."}</div>;
  }

  const { line, styles, allCabinetsCovered } = shipping.data;
  const warehouses = line.warehouseZips ?? [];
  const flatFee = centsToDollars(line.shippingFlatFreightFeeCents);
  const freeThreshold = centsToDollars(line.shippingFreeFreightThresholdCents);
  const policyLabel = line.shippingRuleMode === "fixed"
    ? `Fixed freight${flatFee ? ` · ${flatFee}` : ""}`
    : line.shippingRuleMode === "threshold"
      ? `Free freight threshold${freeThreshold ? ` · ${freeThreshold}` : ""}`
      : "Live freight quote";

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
	        <div>
	          <h2 className="flex items-center gap-2 text-2xl font-bold"><Truck className="h-6 w-6 text-primary" /> Shipping & Warehouses</h2>
	          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Shipping origins and cabinet-line readiness for {line.name}. The freight engine uses these same origin assignments when it quotes a shipment.</p>
	        </div>
		        <div className="flex items-center gap-2"><Badge variant="secondary" className="w-fit">{styles.length} cabinet line{styles.length === 1 ? "" : "s"}</Badge><Button data-testid="vendor-edit-shipping" variant="default" size="sm" onClick={() => setEditingShipping(true)}><Pencil className="mr-1.5 h-4 w-4" />Edit shipping &amp; warehouses</Button></div>
	      </div>

      <Card className={allCabinetsCovered ? "border-emerald-300 bg-emerald-50/50" : "border-amber-300 bg-amber-50/50"}>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {allCabinetsCovered ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" /> : <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />}
            <div>
              <h3 className="font-semibold">{allCabinetsCovered ? "All cabinet lines cover every configured warehouse" : "Warehouse-origin coverage needs attention"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {allCabinetsCovered
                  ? `Every cabinet line inherits or explicitly lists all ${warehouses.length} configured warehouse origin${warehouses.length === 1 ? "" : "s"}.`
                  : warehouses.length === 0
                    ? "Add a verified warehouse origin before freight can use the line automatically."
                    : "At least one cabinet line has a limited origin assignment. Review the checkmarks below before quoting freight."}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={allCabinetsCovered ? "border-emerald-400 bg-white text-emerald-700" : "border-amber-400 bg-white text-amber-700"}>{warehouses.length} configured warehouse origin{warehouses.length === 1 ? "" : "s"}</Badge>
        </CardContent>
	      </Card>

	      <div data-testid="vendor-shipping-edit-help" className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-950">
	        <span className="font-semibold">Vendor-controlled shipping.</span> Select <span className="font-semibold">Edit shipping &amp; warehouses</span> above to save your warehouse origins, lead time, freight rule, ZIP rates, delivery notes, and local-pickup settings. Every cabinet style inherits these same warehouse origins unless you explicitly assign a different subset, so new catalog styles use the same locations automatically.
	      </div>

      <Card data-testid="vendor-carrier-connections" className="border-violet-200 bg-violet-50/40">
	        <CardHeader className="pb-3">
	          <CardTitle className="text-base">Inventory and carrier connections</CardTitle>
	          <CardDescription>These account connections are attached to {line.name}. Configure them once; the warehouse origins above remain the default for every new cabinet style.</CardDescription>
	        </CardHeader>
	        <CardContent className="grid gap-3 sm:grid-cols-3">
	          {[{ type: "inventory", provider: "netsuite", label: "NetSuite inventory", detail: "Inventory and order routing" }, { type: "shipping", provider: "ups", label: "UPS / parcel", detail: "UPS shipper account" }, { type: "shipping", provider: "fedex", label: "FedEx / parcel", detail: "FedEx account" }].map((connection) => {
	            const row = integrations.data?.find((item) => item.integrationType === connection.type && item.provider === connection.provider);
	            const configured = Boolean(row?.isEnabled && (row?.hasApiKey || row?.hasClientSecret || row?.accountNumber));
            return <div key={connection.provider} className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{connection.label}</p><Badge variant={configured ? "default" : "outline"}>{configured ? "Enabled" : "Not configured"}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{connection.detail}</p>
              {row?.accountNumber && <p className="mt-2 text-xs text-muted-foreground">Account {row.accountNumber}</p>}
            </div>;
          })}
        </CardContent>
      </Card>

      {user?.role === "admin" && <AdminWarehouseTemplateCard />}

	      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Configured warehouses</CardTitle></CardHeader>
          <CardContent>
            {warehouses.length === 0 ? <p className="text-sm text-muted-foreground">No verified warehouse origin ZIPs are configured yet.</p> : (
              <div className="flex flex-wrap gap-2">
                {warehouses.map((zip) => <Badge key={zip} variant="outline" className="gap-1.5 border-sky-300 bg-sky-50 px-2.5 py-1 text-sky-800"><MapPin className="h-3.5 w-3.5" /> {zip}</Badge>)}
              </div>
            )}
            {(line.warehouseName || line.warehouseAddress) && <p className="mt-3 text-xs text-muted-foreground">{[line.warehouseName, line.warehouseAddress].filter(Boolean).join(" · ")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Shipping rule</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{policyLabel}</p>
            <p className="text-muted-foreground">Lead time: {line.leadTimeDays ?? "—"} days</p>
            {line.pickupEnabled && <p className="text-muted-foreground">Local pickup: {line.pickupZip ?? warehouses[0] ?? "origin pending"} · {line.pickupRadiusMiles ?? 100} mile radius</p>}
            {line.shippingExceptions && <p className="text-xs text-amber-700">Shipping note: {line.shippingExceptions}</p>}
          </CardContent>
        </Card>
        {line.code === "USCD" && <Card className="lg:col-span-2" data-testid="vendor-warehouse-network">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">U.S. Cabinet Depot shipping locations</CardTitle>
            <CardDescription>Verified warehouse locations from the supplied 2026 location workbook. These are shipping and pickup reference points; the availability PDFs are not a live on-hand inventory feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {US_CABINET_DEPOT_WAREHOUSES.map((warehouse) => <div key={warehouse.zip} className="rounded-lg border border-sky-200 bg-sky-50/40 p-3 text-sm">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold">{warehouse.state} warehouse</p><Badge variant="outline" className="border-sky-300 bg-white text-sky-800">{warehouse.zip}</Badge></div>
                <p className="mt-1 text-muted-foreground">{warehouse.address}, {warehouse.city}, {warehouse.state} {warehouse.zip}</p>
                <p className="mt-1 text-muted-foreground">{warehouse.phone}</p>
                <p className="mt-2 text-xs text-slate-700">{warehouse.stockNote}</p>
              </div>)}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950">
              <p className="font-semibold">Availability source and lead times</p>
              <p className="mt-1">Warehouse availability sheets supplied for 2026 generally state 3–5 business days when stocked and 10–15 business days for transfer items. Availability can change; confirm the current item and finish before promising a ship date.</p>
              <p className="mt-2 text-amber-800">Sources: {US_CABINET_DEPOT_AVAILABILITY_SOURCES.join(", ")}. The configured ZIPs above remain the freight-engine origins; this reference does not change catalog pricing, inventory counts, or checkout.</p>
            </div>
          </CardContent>
        </Card>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cabinet-line warehouse coverage</CardTitle>
          <p className="text-xs text-muted-foreground">A check means this style's cabinet catalog uses every configured warehouse origin, either through its own origin ZIPs or its distributor warehouse fallback. It does not represent a live on-hand inventory count.</p>
          <p data-testid="vendor-catalog-status-legend" className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-emerald-700">Green</span> means every cabinet SKU is available and published. <span className="font-semibold text-amber-700">Yellow</span> means one or more SKUs need availability or publishing review.</p>
        </CardHeader>
        <CardContent className="p-0">
          {styles.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No cabinet-backed styles are available to assess.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Cabinet line</TableHead><TableHead>Catalog status</TableHead><TableHead>Shipping origins</TableHead><TableHead className="text-right">All warehouses</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {styles.map((style) => {
                    const image = style.roomSceneImageUrl || style.doorSampleImageUrl || style.thumbnailImageUrl;
                    const publishable = style.availableCount === style.catalogCount && style.publishedCount === style.catalogCount;
                    return (
                      <TableRow key={style.id}>
                        <TableCell>
                          <div className="flex min-w-48 items-center gap-2.5">
                            {image ? <img src={image} alt={style.ourName} className="h-9 w-9 rounded object-cover ring-1 ring-border" /> : <div className="flex h-9 w-9 items-center justify-center rounded bg-muted"><Palette className="h-4 w-4 text-muted-foreground" /></div>}
                            <div className="min-w-0"><p className="truncate font-medium">{style.ourName}</p><p className="truncate text-xs text-muted-foreground">{[style.doorStyle, style.color, style.finish].filter(Boolean).join(" · ")}</p></div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" aria-label={publishable ? `${style.ourName}: every cabinet SKU is available and published` : `${style.ourName}: availability or publishing review is needed`} title={publishable ? "All catalog SKUs are available and customer-published" : "One or more catalog SKUs are unavailable or not customer-published"} className={publishable ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>{style.availableCount}/{style.catalogCount} available · {style.publishedCount}/{style.catalogCount} published</Badge></TableCell>
                        <TableCell><div className="flex min-w-48 flex-wrap items-center gap-1">{style.originZips.map((zip) => <Badge key={zip} variant="secondary" className="text-[10px]">{zip}</Badge>)}{style.originZips.length === 0 && <span className="text-xs text-amber-700">Origin needed</span>}<Button data-testid={`vendor-edit-style-origins-${style.id}`} size="sm" variant="outline" className="ml-1 h-7 gap-1 px-2 text-xs" onClick={() => setEditingStyleOrigins(style as VendorShippingStyle)}><Pencil className="h-3 w-3" />Edit</Button></div></TableCell>
                        <TableCell className="text-right">{style.allWarehousesCovered ? <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Covered</span> : <Button size="sm" variant="outline" className="h-7 gap-1 border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => setEditingStyleOrigins(style as VendorShippingStyle)}><MapPin className="h-3.5 w-3.5" />Review &amp; edit</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
	        </CardContent>
	      </Card>
	      <VendorShippingSettingsEditor line={line as VendorShippingLine} open={editingShipping} onClose={() => setEditingShipping(false)} onSaved={() => shipping.refetch()} />
	      {editingStyleOrigins && <VendorStyleOriginsEditor style={editingStyleOrigins} warehouseZips={warehouses} open={Boolean(editingStyleOrigins)} onClose={() => setEditingStyleOrigins(null)} onSaved={() => shipping.refetch()} />}
	    </div>
	  );
}

// ─── Promotions Page ─────────────────────────────────────────────────────────
function PromotionsPage() {
  const adminDistId = useAdminDistributorId();
  const promos = trpc.promotions.list.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const createMut = trpc.promotions.create.useMutation({
    onSuccess: () => { promos.refetch(); toast.success("Promotion created"); setShowCreate(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleMut = trpc.promotions.update.useMutation({
    onSuccess: () => promos.refetch(),
    onError: (e: any) => toast.error(e.message),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    discountType: "percent" as "percent" | "fixed_price",
    discountValue: "",
    targetType: "all" as "all" | "sku" | "category",
    targetValue: "",
    startsAt: "",
    endsAt: "",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promotions</h2>
          <p className="text-muted-foreground">Create sales and discounts for your products.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Promotion
        </Button>
      </div>

      {promos.isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : promos.data?.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <DollarSign className="mx-auto h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">No promotions yet</p>
          <p className="text-sm">Create your first promotion to offer discounts to customers.</p>
        </CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  {p.discountType === "percent" ? `${p.discountValue}% off` : `$${Number(p.discountValue).toFixed(2)} off`}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {p.category ? `Category: ${p.category}` : p.skuIds?.length ? `${p.skuIds.length} SKU(s)` : "All Products"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.startsAt ? new Date(p.startsAt).toLocaleDateString() : "—"}
                  {" → "}
                  {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : "Ongoing"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={() => toggleMut.mutate({ id: p.id, isActive: !p.isActive, ...(adminDistId ? { distributorId: adminDistId } : {}) })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Promotion Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Sale 20% Off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Discount Type</label>
                <Select value={form.discountType} onValueChange={(v) => setForm(f => ({ ...f, discountType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage Off</SelectItem>
                    <SelectItem value="fixed_price">Fixed Amount Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Value</label>
                <Input type="number" value={form.discountValue} onChange={(e) => setForm(f => ({ ...f, discountValue: e.target.value }))} placeholder={form.discountType === "percent" ? "20" : "5.00"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Target</label>
                <Select value={form.targetType} onValueChange={(v) => setForm(f => ({ ...f, targetType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All My Products</SelectItem>
                    <SelectItem value="sku">Specific SKU</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.targetType !== "all" && (
                <div>
                  <label className="text-sm font-medium">{form.targetType === "sku" ? "SKU Code" : "Category Name"}</label>
                  <Input value={form.targetValue} onChange={(e) => setForm(f => ({ ...f, targetValue: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Date (optional)</label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">End Date (optional)</label>
                <Input type="date" value={form.endsAt} onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!form.name || !form.discountValue || createMut.isPending}
              onClick={() => createMut.mutate({
                ...(adminDistId ? { distributorId: adminDistId } : {}),
                name: form.name,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                category: form.targetType === "category" ? form.targetValue : undefined,
                startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
                endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
              })}
            >
              {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Gallery Page ─────────────────────────────────────────────────────────────
function GalleryPage() {
  const adminDistId = useAdminDistributorId();
  const gallery = trpc.gallery.listByDistributor.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const uploadMut = trpc.gallery.upload.useMutation();
  const deleteMut = trpc.gallery.delete.useMutation();
  const utils = trpc.useUtils();
  const [selectedSku, setSelectedSku] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Get catalog for SKU selector
  const catalog = trpc.distributorPortal.catalog.useQuery({ ...(adminDistId ? { distributorId: adminDistId } : {}), limit: 500, offset: 0 });
  const skuOptions = (catalog.data?.items ?? []).map((item: any) => ({
    id: item.id as number,
    label: `${item.masterCode ?? ""} — ${item.styleName ?? "SKU"} #${item.id}`,
  }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSku) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        await uploadMut.mutateAsync({
          ...(adminDistId ? { distributorId: adminDistId } : {}),
          skuId: selectedSku,
          imageBase64: base64,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
        });
        utils.gallery.listByDistributor.invalidate();
      } catch (err: any) {
        alert(err.message || "Upload failed");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this image?")) return;
    await deleteMut.mutateAsync({ id, ...(adminDistId ? { distributorId: adminDistId } : {}) });
    utils.gallery.listByDistributor.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Product Gallery</h2>
      </div>

      {/* Upload section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Upload lifestyle photos, detail shots, or room scenes for your products.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="border rounded px-3 py-2 text-sm bg-background"
              value={selectedSku ?? ""}
              onChange={(e) => setSelectedSku(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a product...</option>
              {skuOptions.map((s: { id: number; label: string }) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!selectedSku || uploadMut.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploadMut.isPending ? "Uploading..." : "Upload Image"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </CardContent>
      </Card>

      {/* Gallery grid */}
      {gallery.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square w-full" />)}
        </div>
      ) : (gallery.data?.length ?? 0) === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No gallery images yet. Upload your first product photo above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(gallery.data ?? []).map((img: any) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
              <img src={img.s3Url} alt={img.caption || "Product"} className="w-full aspect-square object-cover" />
              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                  {img.caption}
                </div>
              )}
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vendor Analytics Page ───────────────────────────────────────────────────
function VendorAnalyticsPage() {
  const adminDistId = useAdminDistributorId();
  const { user } = useAuth();
  const [days, setDays] = useState(60);
  const [inventoryDays, setInventoryDays] = useState<30 | 90 | 180>(180);
  const [showDeadDesigns, setShowDeadDesigns] = useState(false);
  const [baseRatePercent, setBaseRatePercent] = useState("");
  const [lowRatePercent, setLowRatePercent] = useState("");
  const [highRatePercent, setHighRatePercent] = useState("");
  const summary = trpc.analytics.summary.useQuery({ days, ...(adminDistId ? { distributorId: adminDistId } : {}) });
  const forecast = trpc.analytics.savedPlanForecast.useQuery({ days, ...(adminDistId ? { distributorId: adminDistId } : {}) });
  const inventoryForecast = trpc.distributorPortal.inventoryForecast.useQuery({
    days: inventoryDays,
    includeDead: showDeadDesigns,
    ...(adminDistId ? { distributorId: adminDistId } : {}),
  });
  const utils = trpc.useUtils();
  const updateRates = trpc.distributorPortal.updateInventoryForecastRates.useMutation({
    onSuccess: () => {
      void utils.distributorPortal.inventoryForecast.invalidate();
      toast.success("Inventory forecast rate saved");
    },
    onError: (error) => toast.error(error.message || "Could not save the forecast rate"),
  });

  useEffect(() => {
    const rates = inventoryForecast.data?.rates;
    if (!rates) return;
    setBaseRatePercent(rates.baseRateBps == null ? "" : String(rates.baseRateBps / 100));
    setLowRatePercent(rates.lowRateBps == null ? "" : String(rates.lowRateBps / 100));
    setHighRatePercent(rates.highRateBps == null ? "" : String(rates.highRateBps / 100));
  }, [inventoryForecast.data?.rates.baseRateBps, inventoryForecast.data?.rates.lowRateBps, inventoryForecast.data?.rates.highRateBps]);

  const exportInventoryForecast = useCallback(() => {
    const inventory = inventoryForecast.data;
    if (!inventory) return;
    const header = ["Master SKU", "Vendor ordering SKU", "Open designs (qty)", "Open designs", "Affiliates", "Projected sell-through", "Low", "High", "Suggested stock", "On hand", "Status", "Notes"];
    const rows = inventory.rows.map((row) => [
      row.masterCode,
      row.vendorSku,
      row.openDesignQty,
      row.openDesignCount,
      row.affiliateCount,
      row.projectedSellThrough,
      row.lowProjectedSellThrough,
      row.highProjectedSellThrough,
      row.suggestedStock,
      row.onHandQty,
      row.stockStatus,
      row.stockStatus === "demand_only" ? "Vendor inventory feed not provided" : row.stockStatus === "rate_tbd" ? "Close rate TBD by administrator" : "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-forecast-${inventory.lineName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${inventoryDays}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [inventoryForecast.data, inventoryDays]);

  if (summary.isLoading || forecast.isLoading || inventoryForecast.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const data = summary.data;
  const savedPlanForecast = forecast.data;
  const inventory = inventoryForecast.data;
  if (!data || !savedPlanForecast || !inventory) return <p className="text-muted-foreground">No analytics data available.</p>;
  const isAdmin = user?.role === "admin";
  const toBps = (value: string) => value.trim() === "" ? null : Math.round(Number(value) * 100);
  const statusLabel: Record<string, string> = { short: "Short", ok: "OK", over: "Over", demand_only: "Demand only", rate_tbd: "Rate TBD" };
  const statusClass: Record<string, string> = {
    short: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    over: "border-amber-200 bg-amber-50 text-amber-800",
    demand_only: "border-slate-200 bg-slate-50 text-slate-700",
    rate_tbd: "border-violet-200 bg-violet-50 text-violet-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Product Analytics</h2>
        <select
          className="border rounded px-3 py-1.5 text-sm bg-background"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <section className="space-y-4" aria-labelledby="saved-plan-demand-heading">
        <div>
          <h3 id="saved-plan-demand-heading" className="text-lg font-semibold">Saved-plan demand forecast</h3>
          <p className="text-sm text-muted-foreground">A demand signal from saved plans in the last {days} days. It does not use submitted orders or represent a sales commitment.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Saved plans</p>
              <p className="text-3xl font-bold">{savedPlanForecast.savedPlanCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Projected cabinet units</p>
              <p className="text-3xl font-bold">{savedPlanForecast.projectedCabinetQty.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Latest saved-plan activity</p>
              <p className="text-base font-semibold">{savedPlanForecast.latestSavedAt ? new Date(savedPlanForecast.latestSavedAt).toLocaleDateString() : "No recent plans"}</p>
            </CardContent>
          </Card>
        </div>

        {savedPlanForecast.topSkus.length > 0 ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Leading SKU demand</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Style</TableHead><TableHead className="text-right">Units in plans</TableHead><TableHead className="text-right">Plans</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {savedPlanForecast.topSkus.map((row) => (
                      <TableRow key={`${row.platformSku}-${row.styleId}`}>
                        <TableCell className="font-medium">{row.sku}</TableCell>
                        <TableCell>{row.style}</TableCell>
                        <TableCell className="text-right">{row.units.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.planCount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">No vendor-matched cabinet selections appear in saved plans for this period yet.</CardContent></Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Styles in the pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {savedPlanForecast.topStyles.length > 0 ? savedPlanForecast.topStyles.map((row) => (
                <div key={row.styleId} className="flex items-center justify-between text-sm gap-3">
                  <span className="truncate">{row.style}</span>
                  <Badge variant="secondary">{row.units} units · {row.planCount} plans</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">No matched styles in the selected period.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Recent saved-plan timing</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {savedPlanForecast.activity.length > 0 ? savedPlanForecast.activity.slice(-8).map((row) => (
                <div key={row.day} className="flex items-center justify-between text-sm gap-3"><span>{new Date(`${row.day}T00:00:00Z`).toLocaleDateString()}</span><Badge variant="outline">{row.planCount} saved</Badge></div>
              )) : <p className="text-sm text-muted-foreground">No saved-plan activity in the selected period.</p>}
            </CardContent>
          </Card>
        </div>

        {savedPlanForecast.unresolvedCabinetQty > 0 && (
          <p className="text-xs text-muted-foreground">{savedPlanForecast.unresolvedCabinetQty.toLocaleString()} cabinet unit{savedPlanForecast.unresolvedCabinetQty === 1 ? "" : "s"} could not be matched to a current vendor SKU and are excluded from the SKU demand list.</p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="inventory-forecast-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 id="inventory-forecast-heading" className="text-lg font-semibold">Design → Inventory forecast</h3>
            <p className="text-sm text-muted-foreground">Master-SKU demand from active open designs only. Designs closed by a confirmed or paid order are excluded; unsold designs at least seven months old are dead and never inflate the forecast.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={String(inventoryDays)} onValueChange={(value) => setInventoryDays(Number(value) as 30 | 90 | 180)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="180">Last 180 days</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportInventoryForecast} disabled={inventory.rows.length === 0}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Open active designs</p><p className="text-3xl font-bold">{inventory.openDesignCount}</p><p className="mt-1 text-xs text-muted-foreground">Since {new Date(inventory.activeSince).toLocaleDateString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Closed designs excluded</p><p className="text-3xl font-bold">{inventory.closedDesignCount}</p><p className="mt-1 text-xs text-muted-foreground">Confirmed or paid orders are not pipeline demand.</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Close-rate factor</p><p className="text-3xl font-bold">{inventory.rateConfigured ? `${(inventory.rates.baseRateBps! / 100).toFixed(1)}%` : "TBD"}</p><p className="mt-1 text-xs text-muted-foreground">{inventory.rateConfigured ? "Administrator-configured, not assumed." : "Set by an administrator before projected units are calculated."}</p></CardContent></Card>
        </div>

        {isAdmin && adminDistId && <Card className="border-violet-200 bg-violet-50/40"><CardHeader className="pb-3"><CardTitle className="text-base">Administrator forecast rate</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4 md:items-end"><Label className="space-y-1"><span>Low close rate (%)</span><Input type="number" min="0" max="100" step="0.1" value={lowRatePercent} onChange={(event) => setLowRatePercent(event.target.value)} placeholder="Optional" /></Label><Label className="space-y-1"><span>Base close rate (%)</span><Input type="number" min="0" max="100" step="0.1" value={baseRatePercent} onChange={(event) => setBaseRatePercent(event.target.value)} placeholder="TBD" /></Label><Label className="space-y-1"><span>High close rate (%)</span><Input type="number" min="0" max="100" step="0.1" value={highRatePercent} onChange={(event) => setHighRatePercent(event.target.value)} placeholder="Optional" /></Label><Button disabled={updateRates.isPending} onClick={() => updateRates.mutate({ distributorId: adminDistId, baseRateBps: toBps(baseRatePercent), lowRateBps: toBps(lowRatePercent), highRateBps: toBps(highRatePercent) })}>{updateRates.isPending ? "Saving…" : "Save rates"}</Button></CardContent></Card>}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><div><CardTitle className="text-base">Vendor inventory requirements</CardTitle><p className="mt-1 text-xs text-muted-foreground">Vendor ordering SKU is an alias for the master nomenclature code. On-hand is shown only when the vendor has supplied inventory.</p></div><Button variant="ghost" size="sm" onClick={() => setShowDeadDesigns((value) => !value)}>{showDeadDesigns ? "Hide dead designs" : "View dead designs"}</Button></CardHeader>
          <CardContent className="p-0">
            {inventory.rows.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No open vendor-matched designs in this active window. Dead designs are excluded from demand.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Master SKU</TableHead><TableHead>Vendor ordering SKU</TableHead><TableHead className="text-right">Open designs (qty)</TableHead><TableHead className="text-right">Projected sell-through</TableHead><TableHead className="text-right">Suggested stock</TableHead><TableHead className="text-right">On hand</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{inventory.rows.map((row) => <TableRow key={row.masterCode}><TableCell className="font-medium">{row.masterCode}</TableCell><TableCell className="font-mono text-xs">{row.vendorSku}</TableCell><TableCell className="text-right">{row.openDesignQty} <span className="text-xs text-muted-foreground">({row.openDesignCount})</span></TableCell><TableCell className="text-right">{row.projectedSellThrough == null ? "TBD" : <><span>{row.projectedSellThrough}</span>{row.lowProjectedSellThrough != null && row.highProjectedSellThrough != null && <span className="block text-xs text-muted-foreground">{row.lowProjectedSellThrough}–{row.highProjectedSellThrough}</span>}</>}</TableCell><TableCell className="text-right">{row.suggestedStock ?? "TBD"}</TableCell><TableCell className="text-right">{row.onHandQty ?? "—"}</TableCell><TableCell><Badge variant="outline" className={statusClass[row.stockStatus]}>{statusLabel[row.stockStatus]}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{row.stockStatus === "demand_only" ? "On-hand feed not provided" : row.stockStatus === "rate_tbd" ? "Administrator rate is TBD" : `${row.affiliateCount} affiliate${row.affiliateCount === 1 ? "" : "s"} in pipeline`}</TableCell></TableRow>)}</TableBody></Table></div>}
          </CardContent>
        </Card>

        {showDeadDesigns && <Card className="border-slate-200"><CardHeader className="pb-3"><CardTitle className="text-base">Dead designs — excluded from forecast</CardTitle><p className="text-xs text-muted-foreground">Unsold designs with last activity on or before {new Date(inventory.deadBefore).toLocaleDateString()}.</p></CardHeader><CardContent>{inventory.deadDesigns.length === 0 ? <p className="text-sm text-muted-foreground">No unsold designs meet the seven-month dead cutoff.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Design</TableHead><TableHead>Last activity</TableHead><TableHead className="text-right">Placed cabinets</TableHead></TableRow></TableHeader><TableBody>{inventory.deadDesigns.map((design) => <TableRow key={design.id}><TableCell>{design.name}</TableCell><TableCell>{new Date(design.lastActivityAt).toLocaleDateString()}</TableCell><TableCell className="text-right">{design.placedCabinetCount}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>}
      </section>

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Product Views</p>
          <p className="text-3xl font-bold">{data.totalViews.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Avg. Daily Views</p>
          <p className="text-3xl font-bold">
            {days > 0 ? Math.round(data.totalViews / days).toLocaleString() : 0}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Top Referrers</p>
          <p className="text-3xl font-bold">{data.topReferrers?.length ?? 0}</p>
        </div>
      </div>

      {/* Daily views chart (simple bar representation) */}
      {data.dailyViews.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Daily Views</h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyViews.map((d: any) => {
              const max = Math.max(...data.dailyViews.map((x: any) => x.count));
              const height = max > 0 ? (d.count / max) * 100 : 0;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{d.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t min-h-[2px]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top products */}
      {data.topProducts.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Top Products</h3>
          <div className="space-y-2">
            {data.topProducts.map((p: any, i: number) => (
              <div key={p.pageSlug} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">#{i + 1}</span>
                <span className="flex-1 ml-3 truncate">{p.pageSlug}</span>
                <Badge variant="secondary">{p.count} views</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top referrers */}
      {(data.topReferrers?.length ?? 0) > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Traffic Sources</h3>
          <div className="space-y-2">
            {data.topReferrers!.map((r: any, i: number) => (
              <div key={r.referrer ?? i} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{r.referrer || "Direct"}</span>
                <Badge variant="outline">{r.count} visits</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalViews === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No product views recorded in the last {days} days. Views will appear here as customers browse your products.
        </p>
      )}
    </div>
  );
}

// ─── Orders Page ──────────────────────────────────────────────────────────────
function OrdersPage() {
  const adminDistId = useAdminDistributorId();
  const orders = trpc.distributorPortal.orders.useQuery({ limit: 50, ...(adminDistId ? { distributorId: adminDistId } : {}) });

  if (orders.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const rows = orders.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Orders</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Orders containing your products that have been submitted.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No submitted orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.requestNumber}</TableCell>
                  <TableCell>{order.styleName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{order.tier}</Badge></TableCell>
                  <TableCell className="text-right">{order.itemCount}</TableCell>
                  <TableCell className="text-right font-medium">{money(order.totalAmount)}</TableCell>
                  <TableCell className="text-xs">{order.source}</TableCell>
                  <TableCell className="text-xs">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><Badge className="text-xs">{order.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── AI Catalog Services Page ────────────────────────────────────────────────
function AICatalogServicesPage() {
  const [requestType, setRequestType] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [estimate, setEstimate] = useState<{ skus: number; hours: number; cost: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [approved, setApproved] = useState(false);

  const services = [
    {
      title: "Catalog Onboarding",
      description: "Upload your ProKitchen or 2020 Design catalog file — we'll parse, map SKUs, set pricing, and organize categories.",
      icon: Package,
    },
    {
      title: "Photo & Image Processing",
      description: "AI-generated product photos, background removal, and consistent catalog imagery across your line.",
      icon: ImageIcon,
    },
    {
      title: "Trim & Accessory Audit",
      description: "Cross-reference your catalog against the database, identify missing items, fix conflicts, and fill gaps.",
      icon: CheckCircle2,
    },
    {
      title: "Price Sheet Import",
      description: "Upload your price sheet and we'll map it to the system — style coverage, pricing tiers, and availability.",
      icon: FileSpreadsheet,
    },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setEstimate(null);
    setApproved(false);
    // Estimate based on file size (rough heuristic: ~1KB per SKU for XML/CSV)
    setEstimating(true);
    setTimeout(() => {
      const fileSizeKB = file.size / 1024;
      let estimatedSkus = 0;
      if (file.name.endsWith('.xml') || file.name.endsWith('.mfr')) {
        estimatedSkus = Math.max(50, Math.round(fileSizeKB / 2));
      } else {
        estimatedSkus = Math.max(20, Math.round(fileSizeKB / 0.5));
      }
      const skusPerHour = 150;
      const hours = Math.max(0.25, Math.ceil((estimatedSkus / skusPerHour) * 4) / 4);
      const cost = hours * 100;
      setEstimate({ skus: estimatedSkus, hours, cost });
      setEstimating(false);
    }, 1500);
  };

  const handleApproveEstimate = () => {
    setApproved(true);
    toast.success("Estimate approved! Processing will begin shortly. You'll be notified when complete.");
  };

  const handleSubmit = () => {
    if (!requestType) {
      toast.error("Please select a service type");
      return;
    }
    toast.success("Service request submitted! We'll be in touch within 24 hours.");
    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Catalog Services
        </h2>
        <p className="text-muted-foreground mt-1">
          Let our AI-powered team get your products online fast. Professional catalog management at <span className="font-semibold text-foreground">$100/hour</span>.
        </p>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">1</div>
              <div>
                <p className="font-medium text-sm">Upload & Describe</p>
                <p className="text-xs text-muted-foreground">Upload your catalog file (ProKitchen, 2020 Design, CSV, Excel) and describe your needs.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">2</div>
              <div>
                <p className="font-medium text-sm">Get Estimate</p>
                <p className="text-xs text-muted-foreground">See the estimated time and cost instantly. The more info you provide, the lower the cost.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">3</div>
              <div>
                <p className="font-medium text-sm">Approve & Process</p>
                <p className="text-xs text-muted-foreground">Approve the estimate and our AI handles the heavy lifting — mapping SKUs, pricing, images.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">4</div>
              <div>
                <p className="font-medium text-sm">Review & Go Live</p>
                <p className="text-xs text-muted-foreground">Review the results in your portal, approve, and your products go live.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((service) => (
          <Card key={service.title} className={`cursor-pointer transition-all ${
            requestType === service.title ? "ring-2 ring-primary" : "hover:border-primary/50"
          }`} onClick={() => setRequestType(service.title)}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{service.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload & Request form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Catalog & Request Service</CardTitle>
          <p className="text-xs text-muted-foreground">Upload your file AND describe what you need. The more information you provide, the faster and cheaper the AI processing.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="font-semibold text-lg">{approved ? "Approved & Processing" : "Request Submitted"}</h3>
              <p className="text-muted-foreground text-sm">{approved ? "Your catalog is being processed. You'll be notified when it's ready for review." : "We'll review your request and get back to you within 24 hours."}</p>
              <Button variant="outline" onClick={() => { setSubmitted(false); setApproved(false); setRequestType(""); setDetails(""); setUploadedFile(null); setEstimate(null); }}>
                Submit Another Request
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Type</label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.title} value={s.title}>{s.title}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other (describe below)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload Catalog File</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".xml,.mfr,.csv,.xlsx,.xls,.json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="catalog-upload"
                  />
                  <label htmlFor="catalog-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">{uploadedFile ? uploadedFile.name : "Click to upload catalog file"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports: ProKitchen (.xml), 2020 Design (.mfr, .xml), CSV, Excel (.xlsx)</p>
                  </label>
                </div>
                {uploadedFile && (
                  <p className="text-xs text-muted-foreground">File: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>

              {/* Estimate display */}
              {estimating && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">Analyzing file and estimating cost...</span>
                </div>
              )}
              {estimate && !approved && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    Cost Estimate
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">~{estimate.skus}</p>
                      <p className="text-xs text-muted-foreground">Estimated SKUs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{estimate.hours}h</p>
                      <p className="text-xs text-muted-foreground">Estimated Time</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">${estimate.cost.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Estimated Cost</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Providing detailed descriptions below can reduce processing time by up to 40%.</p>
                  <Button onClick={handleApproveEstimate} className="w-full">
                    <Check className="h-4 w-4 mr-2" />
                    Approve Estimate & Start Processing
                  </Button>
                </div>
              )}
              {approved && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                  <p className="text-sm font-medium text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Estimate approved — ${estimate?.cost.toFixed(0)} for ~{estimate?.hours}h of processing
                  </p>
                </div>
              )}

              {/* Details */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Details & Instructions</label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="The more detail you provide, the faster and cheaper the processing:\n\n• How many door styles / colors?\n• What pricing tiers do you use?\n• Any special SKU naming conventions?\n• Which categories (base, wall, tall, vanity, accessories)?\n• Any items to exclude?"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
                <p className="text-xs text-muted-foreground italic">Tip: The better the information you provide, the quicker AI processes your catalog and the less it costs.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Billed at <span className="font-semibold text-foreground">$100/hr</span> · Typical turnaround: 24–48 hours</span>
                </div>
                <Button onClick={handleSubmit} disabled={!requestType}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Accepted formats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accepted Catalog Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-sm">ProKitchen Export</p>
                <p className="text-xs text-muted-foreground">.xml catalog export from ProKitchen software</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <FileSpreadsheet className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="font-medium text-sm">2020 Design Export</p>
                <p className="text-xs text-muted-foreground">.mfr or .xml manufacturer files from 2020 Design</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-sm">CSV / Excel</p>
                <p className="text-xs text-muted-foreground">.csv or .xlsx spreadsheet with your product data</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <FileSpreadsheet className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-sm">PDF Price Sheet</p>
                <p className="text-xs text-muted-foreground">Scanned or digital PDF price lists — AI extracts the data</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing note */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="font-medium text-sm">Pricing & Billing</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> $100/hour — billed in 15-minute increments</li>
          <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Free estimate before work begins — no surprises</li>
          <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> The more info you provide, the less time (and money) it takes</li>
          <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> No charge if you're not satisfied with the results</li>
          <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Most catalog imports completed in 2–4 hours ($200–$400)</li>
        </ul>
      </div>

      {/* History Log */}
      <ServiceHistoryLog />
    </div>
  );
}

function ServiceHistoryLog() {
  const adminDistId = useAdminDistributorId();
  const { data: history, isLoading } = trpc.distributorPortal.aiServiceHistory.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Request History</CardTitle></CardHeader>
        <CardContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading history...</div></CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Request History</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No previous service requests. Submit your first request above!</p></CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    estimated: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
    pending: "bg-orange-100 text-orange-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request History</CardTitle>
        <p className="text-xs text-muted-foreground">Your previously submitted catalog processing requests and their outcomes.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((req: any) => (
            <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{req.serviceType}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status] || "bg-gray-100 text-gray-600"}`}>
                    {req.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {req.fileName && <span>{req.fileName}</span>}
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                {req.status === "completed" && req.actualCost ? (
                  <div>
                    <p className="font-semibold text-sm text-green-700">${Number(req.actualCost).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">{Number(req.actualHours).toFixed(1)}h actual</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-sm">${Number(req.estimatedCost).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">~{Number(req.estimatedHours).toFixed(1)}h est.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Integrations Page ───────────────────────────────────────────────────────
const INTEGRATIONS = [
  { type: "inventory" as const, id: "netsuite", name: "Oracle NetSuite", description: "Inventory, pricing, and order routing through NetSuite.", fields: ["accountNumber", "clientId", "apiKey", "clientSecret", "username", "password"] },
  { type: "inventory" as const, id: "epicor", name: "Epicor", description: "Real-time inventory and order management.", fields: ["baseUrl", "accountNumber", "apiKey"] },
  { type: "inventory" as const, id: "quickbooks", name: "QuickBooks Commerce", description: "Inventory and order management for smaller distributors.", fields: ["baseUrl", "accountNumber", "clientId", "clientSecret"] },
  { type: "inventory" as const, id: "generic-inventory", name: "Custom Inventory REST API", description: "Connect another inventory system to the standard feed.", fields: ["baseUrl", "apiKey", "authHeaderName"] },
  { type: "shipping" as const, id: "ups", name: "UPS Rating API", description: "Use your UPS shipper account for live package rates.", fields: ["accountNumber", "clientId", "clientSecret"] },
  { type: "shipping" as const, id: "fedex", name: "FedEx Rate API", description: "Use your FedEx account and project for live rates.", fields: ["accountNumber", "clientId", "clientSecret"] },
  { type: "shipping" as const, id: "generic-shipping", name: "Custom Shipping API", description: "Connect another carrier or broker rate service.", fields: ["baseUrl", "accountNumber", "apiKey", "authHeaderName"] },
];
const INTEGRATION_LABELS: Record<string, string> = { baseUrl: "API base URL", accountNumber: "Account / shipper number", clientId: "Client ID", apiKey: "API key", clientSecret: "Client secret", username: "Username", password: "Password", authHeaderName: "Auth header name" };

function IntegrationsPage() {
  const adminDistId = useAdminDistributorId();
  const utils = trpc.useUtils();
  const integrations = trpc.distributorPortal.listIntegrations.useQuery(adminDistId ? { distributorId: adminDistId } : undefined);
  const [selected, setSelected] = useState<typeof INTEGRATIONS[number] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const existing = selected ? integrations.data?.find((item) => item.integrationType === selected.type && item.provider === selected.id) : undefined;
  const history = trpc.distributorPortal.integrationHistory.useQuery(
    existing?.id ? { ...(adminDistId ? { distributorId: adminDistId } : {}), integrationId: existing.id, limit: 10 } : undefined,
    { enabled: Boolean(existing?.id) },
  );
  const save = trpc.distributorPortal.saveIntegration.useMutation({
    onSuccess: () => { toast.success("Integration settings saved"); void integrations.refetch(); setSelected(null); },
    onError: (error) => toast.error(error.message),
  });
  const testConnection = trpc.distributorPortal.testIntegrationConnection.useMutation({
    onSuccess: (result) => { if (result.ok) toast.success(result.message); else toast.error(result.message); void integrations.refetch(); void utils.distributorPortal.integrationHistory.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const open = (item: typeof INTEGRATIONS[number]) => {
    const row = integrations.data?.find((entry) => entry.integrationType === item.type && entry.provider === item.id);
    setSelected(item);
    setValues({ id: row ? String(row.id) : "", baseUrl: row?.baseUrl ?? "", accountNumber: row?.accountNumber ?? "", clientId: row?.clientId ?? "", authHeaderName: row?.authHeaderName ?? "", environment: row?.environment ?? "production", isEnabled: row?.isEnabled ? "true" : "false" });
  };
  const saveSelected = () => {
    if (!selected) return;
    const payload: Record<string, unknown> = { ...(adminDistId ? { distributorId: adminDistId } : {}), ...(values.id ? { id: Number(values.id) } : {}), integrationType: selected.type, provider: selected.id, displayName: selected.name, baseUrl: values.baseUrl || null, accountNumber: values.accountNumber || null, clientId: values.clientId || null, authHeaderName: values.authHeaderName || null, environment: values.environment === "sandbox" ? "sandbox" : "production", isEnabled: values.isEnabled === "true" };
    for (const field of ["apiKey", "clientSecret", "password", "username"] as const) if (values[field]?.trim()) payload[field] = values[field];
    save.mutate(payload as any);
  };
  return <div className="space-y-6">
    <div><h2 className="text-xl font-bold">Inventory &amp; Shipping Integrations</h2><p className="mt-1 text-sm text-muted-foreground">Every distributor, including Pelican, can connect inventory systems and supply shipper account details for live rates. Secrets are encrypted on the server and shown only as configured/not configured.</p></div>
    {!selected ? <>
      <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inventory / ERP</h3><div className="grid gap-4 sm:grid-cols-2">{INTEGRATIONS.filter((item) => item.type === "inventory").map((item) => { const row = integrations.data?.find((entry) => entry.integrationType === item.type && entry.provider === item.id); return <Card key={item.id} className="cursor-pointer hover:border-primary/50" onClick={() => open(item)}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div><Badge variant={row?.isEnabled ? "default" : "outline"}>{row?.isEnabled ? "Enabled" : "Not configured"}</Badge></div><p className="mt-3 text-xs text-muted-foreground"><Link2 className="mr-1 inline h-3 w-3" />{row?.hasApiKey || row?.hasClientSecret ? "Credentials saved securely" : "Add credentials"}</p></CardContent></Card>; })}</div></div>
      <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shipping / live rates</h3><div className="grid gap-4 sm:grid-cols-2">{INTEGRATIONS.filter((item) => item.type === "shipping").map((item) => { const row = integrations.data?.find((entry) => entry.integrationType === item.type && entry.provider === item.id); return <Card key={item.id} className="cursor-pointer hover:border-primary/50" onClick={() => open(item)}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div><Badge variant={row?.isEnabled ? "default" : "outline"}>{row?.isEnabled ? "Enabled" : "Not configured"}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{row?.accountNumber ? `Account ${row.accountNumber}` : "Add shipper account details"}</p></CardContent></Card>; })}</div></div>
    </> : <Card className="max-w-2xl">
      <CardHeader><Button variant="ghost" size="sm" className="w-fit" onClick={() => setSelected(null)}><ArrowLeft className="mr-2 h-4 w-4" />Back to integrations</Button><CardTitle>{selected.name}</CardTitle><CardDescription>{selected.description}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {selected.fields.map((field) => { const label = selected.id === "netsuite" ? ({ accountNumber: "NetSuite account ID", clientId: "Consumer key", apiKey: "API key (optional)", clientSecret: "Consumer secret", username: "Token ID", password: "Token secret" } as Record<string, string>)[field] : INTEGRATION_LABELS[field] ?? field; return <div key={field} className="space-y-1"><Label>{label}</Label><Input type={["apiKey", "clientSecret", "password"].includes(field) ? "password" : "text"} placeholder={existing && ["apiKey", "clientSecret", "password"].includes(field) ? "Leave blank to keep the saved value" : `Enter ${label}`} value={values[field] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} /></div>; })}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label>Environment</Label><Select value={values.environment ?? "production"} onValueChange={(value) => setValues((current) => ({ ...current, environment: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sandbox">Sandbox / test</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select></div><div className="flex items-end gap-2 pb-1"><Switch checked={values.isEnabled === "true"} onCheckedChange={(checked) => setValues((current) => ({ ...current, isEnabled: String(checked) }))} /><Label>Enable connection</Label></div></div>
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950">Credentials are encrypted before storage. Cabinet Dealz will not display or export secret values.</div>
        {existing?.lastError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span className="font-semibold">Last test error:</span> {existing.lastError}</div>}
        <div className="flex flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={saveSelected} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save integration settings"}</Button><Button variant="outline" className="flex-1" onClick={() => testConnection.mutate({ ...(adminDistId ? { distributorId: adminDistId } : {}), integrationId: existing?.id ?? 0 })} disabled={!existing?.id || testConnection.isPending}>{testConnection.isPending ? "Testing…" : "Test connection"}</Button></div>
        {existing?.id && <div className="rounded-md border bg-muted/30 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Recent connection attempts</p>{existing.lastVerifiedAt && <span className="text-xs text-muted-foreground">Last passed {new Date(existing.lastVerifiedAt).toLocaleString()}</span>}</div>{history.isLoading ? <p className="mt-2 text-xs text-muted-foreground">Loading history…</p> : history.data?.length ? <div className="mt-2 space-y-2">{history.data.map((attempt) => <div key={attempt.id} className="flex items-start justify-between gap-3 text-xs"><div><Badge variant={attempt.status === "success" ? "default" : "destructive"}>{attempt.status}</Badge><span className="ml-2 text-muted-foreground">{attempt.message}</span></div><span className="shrink-0 text-muted-foreground">{new Date(attempt.createdAt).toLocaleString()} · {attempt.responseMs ?? "—"} ms</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No connection tests recorded yet.</p>}</div>}
      </CardContent>
    </Card>}
  </div>;
}

// ─── Payments Page ───────────────────────────────────────────────────────────
function PaymentsPage() {
  const [connected, setConnected] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Payment Connection</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your Stripe account to receive automatic payouts when orders are fulfilled.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-[#635BFF]" />
            </div>
            <div>
              <h3 className="font-semibold">Stripe Connect</h3>
              <p className="text-xs text-muted-foreground">Receive your split of each order automatically</p>
            </div>
          </div>

          {connected ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Stripe account connected. Payouts are active.</span>
            </div>
          ) : (
            <>
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-sm font-medium">How split payments work:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Customer places an order through an affiliate storefront</li>
                  <li>Payment is collected by Cabinet Dealz via Stripe</li>
                  <li>Your fulfillment cost is automatically transferred to your Stripe account</li>
                  <li>Affiliate commission and broker fee are deducted</li>
                </ol>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  toast.info("Stripe Connect onboarding will be available once Cabinet Dealz activates Stripe integration.");
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Connect Stripe Account
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You'll be redirected to Stripe to create or connect your account.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No payouts yet. Connect your Stripe account to start receiving payments.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Vendor Login Form ────────────────────────────────────────────────────────
function VendorLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  // Check for invite token in URL
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const [inviteVendor, setInviteVendor] = useState<string | null>(null);

  useEffect(() => {
    if (inviteToken) {
      setMode("register");
      // Fetch vendor info from invite token
      fetch(`/api/trpc/vendors.getByInvite?input=${encodeURIComponent(JSON.stringify({ token: inviteToken }))}`)
        .then(r => r.json())
        .then(data => {
          if (data?.result?.data) {
            setInviteVendor(data.result.data.name);
          }
        })
        .catch(() => {});
    }
  }, [inviteToken]);

  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }
    setNotice("");
    setIsPending(true);
    // The server creates/links the vendor account on the first authenticated
    // request; a supplier setup link travels as signup metadata.
    const { data, error: authError } = mode === "register"
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.href,
            data: inviteToken ? { inviteToken } : undefined,
          },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsPending(false);
    if (authError) {
      setError(authError.message || (mode === "register" ? "Registration failed." : "Invalid email or password."));
      return;
    }
    if (!data.session) {
      setNotice("Check your email to confirm your address, then sign in here.");
      return;
    }
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Vendor Portal</CardTitle>
          {inviteVendor && mode === "register" ? (
            <p className="text-muted-foreground text-sm mt-1">
              You have a private setup link for <strong>{inviteVendor}</strong>. Choose the supplier login email and password below; the link works even if no email has been preloaded by Cabinet Dealz.
            </p>
          ) : mode === "register" ? (
            <p className="text-muted-foreground text-sm mt-1">
              Use the contact email saved on your approved vendor record, or ask Cabinet Dealz for a private supplier setup link.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">
              Approved vendors can sign in here to manage their own catalog, shipping, resources, and orders.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-password">Password</Label>
              <div className="relative">
                <Input
                  id="vendor-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "register" ? "Create a password (8+ chars)" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="vendor-confirm-password">Confirm Password</Label>
                <Input
                  id="vendor-confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {notice && (
              <p className="text-sm text-muted-foreground">{notice}</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {mode === "register" ? "Creating account..." : "Signing in..."}</>
              ) : (
                mode === "register" ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>
          <div className="text-center mt-4">
            {mode === "login" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  New approved vendor? Create your password
                </button>
                <p className="text-xs text-muted-foreground">
                  If your contact email is not on the Approved Vendor record, ask Cabinet Dealz for the private one-time setup link for your company.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Already have an account? Sign in
                </button>
                {!inviteVendor && (
                  <p className="text-xs text-muted-foreground">
                    Use the approved contact email, or use the private one-time setup link provided by Cabinet Dealz. Either route opens only your supplier portal.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Vendor Portal Component ─────────────────────────────────────────────
export default function VendorPortal() {
  const { user, loading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("section");
  const initialPage: VendorPage = NAV_ITEMS.some((item) => item.id === requestedPage)
    ? requestedPage as VendorPage
    : "overview";
  const [page, setPage] = useState<VendorPage>(initialPage);

  // Admin bypass: detect ?as=<distributorId> in URL
  const asParam = params.get("as");
  const vendorParam = params.get("vendor");
  const [adminDistributorId, setAdminDistributorId] = useState<number | null>(
    asParam ? Number(asParam) : null
  );
  const [adminApprovedVendorLineId, setAdminApprovedVendorLineId] = useState<number | null>(
    vendorParam ? Number(vendorParam) : null
  );

  // Fetch distributors list for admin selector
  const isAdmin = user?.role === "admin";
  // An approved Pelican vendor has no supply line, but it does own catalog,
  // shipping and fulfillment. Identity comes from the server, which resolves it
  // from the approved vendor record's source key, never from a display name.
  const fulfillmentScopes = trpc.vendorFulfillment.scopes.useQuery(
    {
      approvedVendorLineId: isAdmin ? adminApprovedVendorLineId ?? undefined : undefined,
      distributorId: isAdmin ? adminDistributorId ?? undefined : undefined,
    },
    { enabled: Boolean(user) && (isAdmin === true || user?.role === "distributor") },
  );
  const isPelicanVendor = (fulfillmentScopes.data ?? []).some((option) => option.scope === "pelican");
  const supplierProfileOnly = Boolean(
    !isPelicanVendor
    && ((isAdmin && adminApprovedVendorLineId != null && adminDistributorId == null)
    || (!isAdmin
      && user?.role === "distributor"
      && user.distributorId == null
      && user.approvedVendorLineId != null))
  );
  const distList = trpc.distributors.list.useQuery(undefined, { enabled: isAdmin === true || user?.role === "distributor" });
  const approvedVendors = trpc.vendors.list.useQuery(undefined, { enabled: isAdmin === true });

  useEffect(() => {
    if (!isAdmin || !adminApprovedVendorLineId) return;
    const selected = approvedVendors.data?.find((vendor) => vendor.id === adminApprovedVendorLineId);
    if (selected) setAdminDistributorId(selected.linkedDistributor?.id ?? null);
  }, [adminApprovedVendorLineId, approvedVendors.data, isAdmin]);
  const navigateToPage = useCallback((nextPage: VendorPage) => {
    setPage(nextPage);
    const url = new URL(window.location.href);
    if (nextPage === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", nextPage);
    window.history.replaceState({}, "", url.toString());
  }, []);
  const switchAdminVendor = useCallback((vendor: PortalApprovedVendorOption) => {
    if (!Number.isSafeInteger(vendor.id) || vendor.id <= 0) return;
    const distributorId = vendor.linkedDistributor?.id ?? null;
    setAdminApprovedVendorLineId(vendor.id);
    setAdminDistributorId(distributorId);
    if (!distributorId) setPage("supplier-profile");
    const url = new URL(window.location.href);
    url.searchParams.set("vendor", String(vendor.id));
    if (distributorId) url.searchParams.set("as", String(distributorId));
    else {
      url.searchParams.delete("as");
      url.searchParams.set("section", "supplier-profile");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <VendorLoginForm />;
  }

  if (user.role !== "distributor" && user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            The Vendor Portal is only available to distributor accounts.
          </p>
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Admin must select a vendor to view as
  if (isAdmin && !adminDistributorId && !adminApprovedVendorLineId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Vendor Portal — Admin View</h1>
          <p className="text-muted-foreground">
            Select a vendor to view their portal as:
          </p>
          <div className="flex flex-col gap-2">
            {approvedVendors.isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
            {(approvedVendors.data ?? []).filter((vendor) => vendor.isApproved).map((vendor) => (
              <Button
                key={vendor.id}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => switchAdminVendor(vendor)}
              >
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{vendor.linkedDistributor?.code ?? "PROFILE"}</span>
                <span>{vendor.name}</span>
                {!vendor.linkedDistributor && <span className="ml-auto text-xs text-muted-foreground">Profile only</span>}
              </Button>
            ))}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => { window.location.href = "/"; }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <VendorPortalDashboard
      user={user}
      page={supplierProfileOnly ? "supplier-profile" : isPelicanVendor && !PELICAN_NAV_IDS.has(page) ? "overview" : page}
      isPelicanVendor={isPelicanVendor}
      setPage={navigateToPage}
      isAdmin={isAdmin}
      adminDistributorId={adminDistributorId}
      adminApprovedVendorLineId={adminApprovedVendorLineId}
      onSwitchVendor={switchAdminVendor}
      distList={distList.data ?? []}
      approvedVendorList={approvedVendors.data ?? []}
      supplierProfileOnly={supplierProfileOnly}
    />
  );
}

type PortalDistributorOption = { id: number; code: string; name: string };
type PortalApprovedVendorOption = {
  id: number;
  name: string;
  isApproved: boolean;
  portalReadiness: "not-approved" | "email-required" | "profile-only" | "ready";
  linkedDistributor: PortalDistributorOption | null;
};

function AdminVendorQuickSwitch({
  adminApprovedVendorLineId,
  approvedVendorList,
  onSwitchVendor,
  className = "",
  mobile = false,
}: {
  adminApprovedVendorLineId: number;
  approvedVendorList: PortalApprovedVendorOption[];
  onSwitchVendor: (vendor: PortalApprovedVendorOption) => void;
  className?: string;
  mobile?: boolean;
}) {
  const activeVendor = approvedVendorList.find((vendor) => vendor.id === adminApprovedVendorLineId);
  return (
    <section
      data-testid="admin-vendor-quick-switcher"
      aria-label="Administrator vendor account switcher"
      className={`rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 ${className}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Admin quick switch</p>
          <p className="truncate text-xs font-medium text-violet-950" title={activeVendor?.name}>
            {activeVendor ? `${activeVendor.linkedDistributor?.code ?? "PROFILE"} — ${activeVendor.name}` : "Selected vendor"}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 border border-violet-200 bg-white text-[10px] text-violet-800">Admin preview</Badge>
      </div>
      <Select
        value={String(adminApprovedVendorLineId)}
        onValueChange={(value) => {
          const selected = approvedVendorList.find((vendor) => vendor.id === Number(value));
          if (selected) onSwitchVendor(selected);
        }}
      >
        <SelectTrigger
          aria-label="Quick switch vendor account"
          className={`${mobile ? "h-10" : "h-9"} w-full bg-background text-xs`}
        >
          <SelectValue placeholder="Select vendor account" />
        </SelectTrigger>
        <SelectContent>
          {approvedVendorList.filter((vendor) => vendor.isApproved).map((vendor) => (
            <SelectItem key={vendor.id} value={String(vendor.id)}>
              {vendor.linkedDistributor?.code ?? "PROFILE"} — {vendor.name}{vendor.linkedDistributor ? "" : " (profile only)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-[10px] leading-snug text-violet-800">Keeps this portal section open while switching accounts.</p>
    </section>
  );
}

function VendorPortalDashboard({
  user,
  page,
  setPage,
  isAdmin,
  adminDistributorId,
  adminApprovedVendorLineId,
  onSwitchVendor,
  distList,
  approvedVendorList,
  supplierProfileOnly = false,
  isPelicanVendor = false,
}: {
  user: any;
  page: VendorPage;
  isPelicanVendor?: boolean;
  setPage: (p: VendorPage) => void;
  isAdmin: boolean;
  adminDistributorId: number | null;
  adminApprovedVendorLineId: number | null;
  onSwitchVendor: (vendor: PortalApprovedVendorOption) => void;
  distList: PortalDistributorOption[];
  approvedVendorList: PortalApprovedVendorOption[];
  supplierProfileOnly?: boolean;
}) {
  const activeDistributorId = isAdmin ? adminDistributorId : user.distributorId;
  const activeDistCode = activeDistributorId
    ? (distList.find((d: any) => d.id === activeDistributorId)?.code ?? undefined)
    : undefined;
  const isPelican = activeDistCode === PEL_DIST_CODE || isPelicanVendor;
  const portalItems = supplierProfileOnly
    ? NAV_ITEMS.filter((item) => item.id === "supplier-profile")
    : isPelicanVendor
      ? NAV_ITEMS.filter((item) => PELICAN_NAV_IDS.has(item.id))
      : NAV_ITEMS;
  const [pelicanCategoryFilter, setPelicanCategoryFilter] = useState<string | undefined>(undefined);

  const handleNavigateToCatalog = useCallback((category?: string) => {
    setPelicanCategoryFilter(category);
    setPage("catalog");
  }, [setPage]);

  return (
    <AdminDistributorContext.Provider value={isAdmin && adminDistributorId ? adminDistributorId : undefined}>
    <AdminApprovedVendorContext.Provider value={isAdmin && adminApprovedVendorLineId ? adminApprovedVendorLineId : undefined}>
    <AdminDistributorCodeContext.Provider value={activeDistCode}>
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:block">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">Vendor Portal</h1>
          <p className="text-xs text-muted-foreground mt-1">{user.name}</p>
          {isAdmin && adminApprovedVendorLineId && (
            <AdminVendorQuickSwitch
              adminApprovedVendorLineId={adminApprovedVendorLineId}
              approvedVendorList={approvedVendorList}
              onSwitchVendor={onSwitchVendor}
              className="mt-3"
            />
          )}
        </div>
        <nav className="p-2 space-y-1">
          {portalItems.map((item) => {
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
	      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50">
	        <nav aria-label="Vendor portal sections" className="flex gap-1 overflow-x-auto px-2 py-2">
          {portalItems.map((item) => {
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
	                className={`flex shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
	        </nav>
	      </div>

      {/* Main content */}
	      <main className="flex-1 p-6 pb-20 md:pb-6 overflow-y-auto">
        {isAdmin && adminApprovedVendorLineId && (
          <AdminVendorQuickSwitch
            adminApprovedVendorLineId={adminApprovedVendorLineId}
            approvedVendorList={approvedVendorList}
	            onSwitchVendor={onSwitchVendor}
	            className="mb-4 md:hidden"
	            mobile
	          />
	        )}
	        {page === "overview" && (isPelican ? <PelicanVendorOverviewPage onNavigateToCatalog={handleNavigateToCatalog} /> : <OverviewPage onNavigate={setPage} />)}
	        {page === "supplier-profile" && <SupplierProfilePage />}
	        {page === "catalog" && (isPelican ? <PelicanVendorCatalogPage initialCategory={pelicanCategoryFilter} /> : <CatalogPage />)}
	        {page === "other-products" && <VendorOtherProducts distributorId={adminDistributorId ?? undefined} />}
	        {page === "styles" && <DoorStylesPage />}
	        {page === "featured-styles" && <VendorFeaturedStylesPage />}
        {page === "shipping" && (isPelican ? <PelicanShippingProfilesPanel isAdmin={isAdmin} /> : <VendorShippingPage />)}
	        {page === "picks" && <DesignToolPicksPage />}
        {page === "promotions" && <PromotionsPage />}
        {page === "gallery" && <GalleryPage />}
        {page === "analytics" && <VendorAnalyticsPage />}
        {page === "orders" && <OrdersPage />}
        {page === "fulfillment" && (
          <VendorFulfillmentQueue
            approvedVendorLineId={isAdmin ? adminApprovedVendorLineId ?? undefined : undefined}
            distributorId={isAdmin ? adminDistributorId ?? undefined : undefined}
          />
        )}
        {page === "ai-services" && <AICatalogServicesPage />}
        {page === "integrations" && <IntegrationsPage />}
        {page === "payments" && <PaymentsPage />}
      </main>
    </div>
    </AdminDistributorCodeContext.Provider>
    </AdminApprovedVendorContext.Provider>
    </AdminDistributorContext.Provider>
  );
}
