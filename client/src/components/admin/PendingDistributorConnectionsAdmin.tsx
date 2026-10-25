import { useMemo, useState } from "react";
import { CheckCircle2, CircleDotDashed, FilePenLine, Plus, RefreshCw, Save, Send, Unlink, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const ALL_LINES = "__all_lines__";
const ALL_STATUSES = "all";

type EditorState = {
  skuId?: number;
  distributorId: string;
  styleId: string;
  distributorSku: string;
  supplierCabinetName: string;
  masterCode: string;
  listPrice: string;
  yourCost: string;
  isAvailable: boolean;
};

const EMPTY_EDITOR: EditorState = {
  distributorId: "",
  styleId: "",
  distributorSku: "",
  supplierCabinetName: "",
  masterCode: "",
  listPrice: "",
  yourCost: "",
  isAvailable: true,
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "—";
}

function statusBadge(status: string, isPublished: boolean) {
  if (status === "approved" && isPublished) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

export default function PendingDistributorConnectionsAdmin() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lineId, setLineId] = useState(ALL_LINES);
  const [status, setStatus] = useState(ALL_STATUSES);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const utils = trpc.useUtils();
  const distributorId = lineId === ALL_LINES ? undefined : Number(lineId);
  const listInput = useMemo(() => ({
    distributorId,
    status: status as "all" | "pending" | "approved" | "rejected",
    search: search || undefined,
    limit: 100,
    offset: 0,
  }), [distributorId, search, status]);
  const { data, isLoading, error, refetch } = trpc.distributorPortal.adminProductList.useQuery(listInput);
  const { data: distributors = [] } = trpc.distributors.list.useQuery();
  const { data: allStyles = [] } = trpc.doorStyles.list.useQuery();
  const styles = useMemo(
    () => editor?.distributorId ? allStyles.filter((style) => style.distributorId === Number(editor.distributorId)) : [],
    [allStyles, editor?.distributorId],
  );

  const invalidateProducts = () => {
    utils.distributorPortal.adminProductList.invalidate();
    utils.distributorPortal.catalog.invalidate();
    utils.cabinets.adminListPendingDistributorConnections.invalidate();
  };
  const saveProduct = trpc.distributorPortal.adminSaveProduct.useMutation({
    onSuccess: (result) => {
      toast.success(result.isPublished ? "Product published." : "Product saved as a draft.");
      setEditor(null);
      invalidateProducts();
    },
    onError: (error) => toast.error(error.message),
  });
  const changeStatus = trpc.distributorPortal.adminSetProductStatus.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.status === "approved" ? "Product published." : variables.status === "pending" ? "Product moved to drafts." : "Product rejected.");
      invalidateProducts();
    },
    onError: (error) => toast.error(error.message),
  });

  const openNewProduct = () => setEditor({ ...EMPTY_EDITOR, distributorId: distributorId ? String(distributorId) : "" });
  const openEditProduct = (item: NonNullable<typeof data>["items"][number]) => setEditor({
    skuId: item.skuId,
    distributorId: String(item.distributorId),
    styleId: String(item.styleId),
    distributorSku: item.distributorSku,
    supplierCabinetName: item.supplierCabinetName ?? "",
    masterCode: item.masterCode ?? "",
    listPrice: item.listPrice == null ? "" : String(item.listPrice),
    yourCost: item.yourCost == null ? "" : String(item.yourCost),
    isAvailable: item.isAvailable,
  });
  const saveEditor = (mode: "draft" | "publish") => {
    if (!editor?.distributorId || !editor.styleId || !editor.distributorSku.trim()) {
      toast.error("Supplier line, door style, and supplier SKU are required.");
      return;
    }
    const parseMoney = (value: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
    };
    const listPrice = parseMoney(editor.listPrice);
    const yourCost = parseMoney(editor.yourCost);
    if (Number.isNaN(listPrice) || Number.isNaN(yourCost)) {
      toast.error("Use a valid non-negative amount for List Price and Your Cost.");
      return;
    }
    saveProduct.mutate({
      ...(editor.skuId ? { skuId: editor.skuId } : {}),
      distributorId: Number(editor.distributorId),
      styleId: Number(editor.styleId),
      distributorSku: editor.distributorSku.trim(),
      supplierCabinetName: editor.supplierCabinetName.trim() || undefined,
      masterCode: editor.masterCode.trim() || undefined,
      listPrice,
      yourCost,
      isAvailable: editor.isAvailable,
      mode,
    });
  };
  const items = data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilePenLine className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Supplier Product Manager</h2>
          <p className="text-sm text-muted-foreground">Add and manage products directly, like a WordPress product editor.</p>
        </div>
        <Badge variant="secondary">{data?.total ?? 0} products</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button className="gap-1.5" size="sm" onClick={openNewProduct}><Plus className="h-4 w-4" /> Add Product</Button>
          <Button className="gap-1.5" size="sm" variant="outline" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Simple workflow:</strong> add an item, save it as a draft while you work, then publish when ready. A Master Product Code is optional. Items without one remain supplier products and do not enter customer cabinet catalog or 3D Designer cabinet placement until they are linked to a master cabinet.
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={lineId} onValueChange={setLineId}>
          <SelectTrigger className="h-9 w-52 text-sm"><SelectValue placeholder="All supplier lines" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LINES}>All supplier lines</SelectItem>
            {distributors.map((line) => <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Drafts</SelectItem>
            <SelectItem value="approved">Published</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-9 min-w-56 flex-1 text-sm"
          placeholder="Search product name, master code, or supplier SKU…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") setSearch(searchInput); }}
        />
        <Button className="h-9" size="sm" variant="outline" onClick={() => setSearch(searchInput)}>Search</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load supplier products: {error.message}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <CircleDotDashed className="mx-auto mb-2 h-8 w-8 text-primary" />
          No products match these filters. Use <strong>Add Product</strong> to create one directly.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="px-3 py-2 text-left font-medium">Supplier / Style</th>
                <th className="px-3 py-2 text-left font-medium">Supplier SKU</th>
                <th className="px-3 py-2 text-left font-medium">Prices</th>
                <th className="px-3 py-2 text-left font-medium">Mapping</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.skuId} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <div className="font-medium">{item.description ?? item.supplierCabinetName ?? item.distributorSku}</div>
                    <div className="text-xs text-muted-foreground">{item.category ?? "Supplier item"}</div>
                  </td>
                  <td className="px-3 py-3 text-xs"><div className="font-medium">{item.distributorBrandName || item.distributorName}</div><div className="text-muted-foreground">{item.styleName}{item.styleCode ? ` (${item.styleCode})` : ""}</div></td>
                  <td className="px-3 py-3"><div className="font-mono text-xs font-semibold">{item.distributorSku}</div><div className="text-[10px] text-muted-foreground">{item.platformSku}</div></td>
                  <td className="px-3 py-3 text-xs"><div>List: {money(item.listPrice)}</div><div className="text-muted-foreground">Cost: {money(item.yourCost)}</div></td>
                  <td className="px-3 py-3 text-xs">
                    {item.cabinetId ? <Badge variant="outline" className="font-mono">{item.masterCode}</Badge> : <span className="inline-flex items-center gap-1 text-amber-700"><Unlink className="h-3.5 w-3.5" /> Standalone</span>}
                  </td>
                  <td className="px-3 py-3">{statusBadge(item.status, item.isPublished)}</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-1.5">
                    <Button className="h-7 gap-1 px-2 text-xs" size="sm" variant="outline" onClick={() => openEditProduct(item)}><FilePenLine className="h-3 w-3" /> Edit</Button>
                    {item.isPublished ? (
                      <Button className="h-7 gap-1 px-2 text-xs" size="sm" variant="outline" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ distributorId: item.distributorId, skuId: item.skuId, status: "pending" })}><Save className="h-3 w-3" /> Unpublish</Button>
                    ) : (
                      <Button className="h-7 gap-1 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" size="sm" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ distributorId: item.distributorId, skuId: item.skuId, status: "approved" })}><CheckCircle2 className="h-3 w-3" /> Publish</Button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.skuId ? "Edit Supplier Product" : "Add Supplier Product"}</DialogTitle>
            <DialogDescription>Enter the information you have now. You may save as a draft at any point, then publish when the product is ready.</DialogDescription>
          </DialogHeader>
          {editor && <div className="space-y-5 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Supplier line <span className="text-destructive">*</span></Label>
                <Select value={editor.distributorId} onValueChange={(value) => setEditor({ ...editor, distributorId: value, styleId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier line" /></SelectTrigger>
                  <SelectContent>{distributors.map((line) => <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Door style <span className="text-destructive">*</span></Label>
                <Select value={editor.styleId} onValueChange={(value) => setEditor({ ...editor, styleId: value })} disabled={!editor.distributorId}>
                  <SelectTrigger><SelectValue placeholder={editor.distributorId ? "Select door style" : "Choose supplier first"} /></SelectTrigger>
                  <SelectContent>{styles.map((style) => <SelectItem key={style.id} value={String(style.id)}>{style.ourName || style.styleCode}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Supplier SKU <span className="text-destructive">*</span></Label><Input placeholder="e.g. 3DB24" value={editor.distributorSku} onChange={(event) => setEditor({ ...editor, distributorSku: event.target.value })} /></div>
              <div className="space-y-1.5"><Label>Supplier product name</Label><Input placeholder="e.g. 24 in three-drawer base" value={editor.supplierCabinetName} onChange={(event) => setEditor({ ...editor, supplierCabinetName: event.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Master Product Code <span className="text-muted-foreground">(optional)</span></Label>
              <Input className="font-mono" placeholder="Leave blank for a standalone supplier item" value={editor.masterCode} onChange={(event) => setEditor({ ...editor, masterCode: event.target.value.toUpperCase() })} />
              <p className="text-xs text-muted-foreground">Use this only when the item already exists in the master cabinet catalog. Standalone items remain safely outside cabinet-only customer and Designer workflows until mapped.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>List Price</Label><Input inputMode="decimal" placeholder="0.00" value={editor.listPrice} onChange={(event) => setEditor({ ...editor, listPrice: event.target.value })} /></div>
              <div className="space-y-1.5"><Label>Your Cost</Label><Input inputMode="decimal" placeholder="0.00" value={editor.yourCost} onChange={(event) => setEditor({ ...editor, yourCost: event.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="product-available">Available from supplier</Label><p className="text-xs text-muted-foreground">Turn this off when the item should stay in your records but cannot be ordered.</p></div><Switch id="product-available" checked={editor.isAvailable} onCheckedChange={(isAvailable) => setEditor({ ...editor, isAvailable })} /></div>
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="button" variant="outline" disabled={saveProduct.isPending} onClick={() => saveEditor("draft")}><Save className="mr-1.5 h-4 w-4" /> Save Draft</Button>
              <Button type="button" disabled={saveProduct.isPending} onClick={() => saveEditor("publish")}><Send className="mr-1.5 h-4 w-4" /> {saveProduct.isPending ? "Saving…" : "Publish Product"}</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
