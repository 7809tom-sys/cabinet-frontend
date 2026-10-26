import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, PackagePlus, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

type CatalogItemFormDialogProps = {
  cabinetId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SourceDraft = {
  skuId?: number;
  distributorId: string;
  styleId: string;
  distributorSku: string;
  listPrice: string;
  yourCost: string;
  isAvailable: boolean;
};

type FormDraft = {
  masterCode: string;
  description: string;
  category: string;
  subCategory: string;
  width: string;
  height: string;
  depth: string;
  physicalWidth: string;
  weight: string;
  placementType: string;
  numberOfDoors: string;
  numberOfDrawers: string;
  numberOfFixedShelves: string;
  numberOfAdjShelves: string;
  hingeSide: string;
  toeKickHeight: string;
  graphicType: string;
  designerEligible: boolean;
  isCornerCabinet: boolean;
  cornerSide: string;
  cornerType: string;
  catalogImageUrl: string;
  specNotes: string;
  pkgLength: string;
  pkgWidth: string;
  pkgHeight: string;
  pkgWeight: string;
  sku: string;
  vendorSku: string;
  altSku1: string;
  altSku2: string;
  altSku3: string;
  source: SourceDraft;
};

const EMPTY_SOURCE: SourceDraft = {
  distributorId: "",
  styleId: "",
  distributorSku: "",
  listPrice: "",
  yourCost: "",
  isAvailable: true,
};

const EMPTY_DRAFT: FormDraft = {
  masterCode: "",
  description: "",
  category: "",
  subCategory: "",
  width: "",
  height: "",
  depth: "",
  physicalWidth: "",
  weight: "",
  placementType: "base",
  numberOfDoors: "0",
  numberOfDrawers: "0",
  numberOfFixedShelves: "",
  numberOfAdjShelves: "",
  hingeSide: "none",
  toeKickHeight: "",
  graphicType: "",
  designerEligible: true,
  isCornerCabinet: false,
  cornerSide: "",
  cornerType: "",
  catalogImageUrl: "",
  specNotes: "",
  pkgLength: "",
  pkgWidth: "",
  pkgHeight: "",
  pkgWeight: "",
  sku: "",
  vendorSku: "",
  altSku1: "",
  altSku2: "",
  altSku3: "",
  source: { ...EMPTY_SOURCE },
};

function decimalString(value: unknown) {
  return value == null ? "" : String(value);
}

function draftFromDetail(detail: { item: Record<string, any>; sources: Array<Record<string, any>> }) : FormDraft {
  const item = detail.item;
  const source = detail.sources[0];
  return {
    masterCode: item.masterCode,
    description: item.description ?? "",
    category: item.category ?? "",
    subCategory: item.subCategory ?? "",
    width: decimalString(item.width),
    height: decimalString(item.height),
    depth: decimalString(item.depth),
    physicalWidth: decimalString(item.physicalWidth),
    weight: decimalString(item.weight),
    placementType: item.placementType ?? "base",
    numberOfDoors: decimalString(item.numberOfDoors ?? 0),
    numberOfDrawers: decimalString(item.numberOfDrawers ?? 0),
    numberOfFixedShelves: decimalString(item.numberOfFixedShelves),
    numberOfAdjShelves: decimalString(item.numberOfAdjShelves),
    hingeSide: item.hingeSide ?? "none",
    toeKickHeight: decimalString(item.toeKickHeight),
    graphicType: item.graphicType ?? "",
    designerEligible: Boolean(item.designerEligible),
    isCornerCabinet: item.isCornerCabinet,
    cornerSide: item.cornerSide ?? "",
    cornerType: item.cornerType ?? "",
    catalogImageUrl: item.catalogImageUrl ?? "",
    specNotes: item.specNotes ?? "",
    pkgLength: decimalString(item.pkgLength),
    pkgWidth: decimalString(item.pkgWidth),
    pkgHeight: decimalString(item.pkgHeight),
    pkgWeight: decimalString(item.pkgWeight),
    sku: item.sku ?? "",
    vendorSku: item.vendorSku ?? "",
    altSku1: item.altSku1 ?? "",
    altSku2: item.altSku2 ?? "",
    altSku3: item.altSku3 ?? "",
    source: source ? {
      skuId: source.skuId,
      distributorId: String(source.distributorId),
      styleId: String(source.styleId),
      distributorSku: source.distributorSku,
      listPrice: decimalString(source.listPrice),
      yourCost: decimalString(source.yourCost),
      isAvailable: source.isAvailable,
    } : { ...EMPTY_SOURCE },
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalText(value: string) {
  return value.trim() || null;
}

const numberFields = [
  "width", "height", "depth", "physicalWidth", "weight", "toeKickHeight",
  "pkgLength", "pkgWidth", "pkgHeight", "pkgWeight",
] as const;

export function CatalogItemFormDialog({ cabinetId, open, onOpenChange }: CatalogItemFormDialogProps) {
  const isEdit = cabinetId != null;
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const detail = trpc.genericCabinets.itemEditorDetail.useQuery(
    { id: cabinetId ?? 0 },
    { enabled: open && cabinetId != null },
  );
  const { data: catalogOptions } = trpc.genericCabinets.list.useQuery({ page: 1, pageSize: 1 });
  const { data: distributors = [] } = trpc.distributors.list.useQuery();
  const { data: styles = [] } = trpc.doorStyles.listForAdmin.useQuery();
  const matchingStyles = useMemo(
    () => draft.source.distributorId ? styles.filter((style) => style.distributorId === Number(draft.source.distributorId)) : [],
    [draft.source.distributorId, styles],
  );

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    if (!isEdit) setDraft({ ...EMPTY_DRAFT, source: { ...EMPTY_SOURCE } });
  }, [isEdit, open]);

  useEffect(() => {
    if (open && detail.data) {
      setDraft(draftFromDetail(detail.data));
      setErrors({});
      setServerError(null);
    }
  }, [detail.data, open]);

  const save = trpc.genericCabinets.saveCatalogItem.useMutation({
    onSuccess: (result) => {
      utils.genericCabinets.list.invalidate();
      utils.genericCabinets.itemEditorDetail.invalidate({ id: result.id });
      utils.doorStyles.list.invalidate();
      utils.doorStyles.listForAdmin.invalidate();
      utils.distributorPortal.catalog.invalidate();
      toast.success(result.isPublished ? "Product published to the catalog and 3D Designer." : "Product saved as a draft.");
      onOpenChange(false);
    },
    onError: (error) => setServerError(error.message),
  });

  const set = <K extends keyof Omit<FormDraft, "source">>(key: K, value: FormDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const setSource = <K extends keyof SourceDraft>(key: K, value: SourceDraft[K]) => {
    setDraft((current) => ({ ...current, source: { ...current.source, [key]: value } }));
    setErrors((current) => ({ ...current, [`source.${String(key)}`]: "" }));
  };

  const chooseExistingSource = (skuId: string) => {
    const source = detail.data?.sources.find((item) => item.skuId === Number(skuId));
    if (!source) return;
    setDraft((current) => ({
      ...current,
      source: {
        skuId: source.skuId,
        distributorId: String(source.distributorId),
        styleId: String(source.styleId),
        distributorSku: source.distributorSku,
        listPrice: decimalString(source.listPrice),
        yourCost: decimalString(source.yourCost),
        isAvailable: source.isAvailable,
      },
    }));
  };

  const validate = (mode: "draft" | "publish") => {
    const next: Record<string, string> = {};
    if (!draft.masterCode.trim()) next.masterCode = "SKU is required.";
    if (!draft.category.trim()) next.category = "Category is required.";
    if (mode === "publish" && !draft.description.trim()) next.description = "Product name or description is required to publish.";
    for (const field of numberFields) {
      if (Number.isNaN(optionalNumber(draft[field]))) next[field] = "Enter a valid non-negative number.";
    }
    if (Number.isNaN(optionalNumber(draft.numberOfDoors))) next.numberOfDoors = "Enter a whole number.";
    if (Number.isNaN(optionalNumber(draft.numberOfDrawers))) next.numberOfDrawers = "Enter a whole number.";
    if (Number.isNaN(optionalNumber(draft.numberOfFixedShelves))) next.numberOfFixedShelves = "Enter a whole number.";
    if (Number.isNaN(optionalNumber(draft.numberOfAdjShelves))) next.numberOfAdjShelves = "Enter a whole number.";
    if (mode === "publish") {
      if (!draft.source.distributorId) next["source.distributorId"] = "Choose a supplier line before publishing.";
      if (!draft.source.styleId) next["source.styleId"] = "Choose a door style before publishing.";
      if (!draft.source.distributorSku.trim()) next["source.distributorSku"] = "Supplier SKU is required before publishing.";
      const listPrice = optionalNumber(draft.source.listPrice);
      const yourCost = optionalNumber(draft.source.yourCost);
      if (Number.isNaN(listPrice) || Number.isNaN(yourCost)) next["source.price"] = "Use a valid non-negative price.";
      if (listPrice == null && yourCost == null) next["source.price"] = "Enter List Price or Your Cost before publishing.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (mode: "draft" | "publish") => {
    setServerError(null);
    if (!validate(mode)) return;
    const sourceStarted = Boolean(
      draft.source.distributorId && draft.source.styleId && draft.source.distributorSku.trim(),
    );
    const source = sourceStarted ? {
      ...(draft.source.skuId ? { skuId: draft.source.skuId } : {}),
      distributorId: Number(draft.source.distributorId),
      styleId: Number(draft.source.styleId),
      distributorSku: draft.source.distributorSku.trim(),
      listPrice: optionalNumber(draft.source.listPrice),
      yourCost: optionalNumber(draft.source.yourCost),
      isAvailable: draft.source.isAvailable,
    } : null;
    save.mutate({
      ...(cabinetId ? { id: cabinetId } : {}),
      mode,
      masterCode: draft.masterCode,
      description: draft.description,
      category: draft.category,
      subCategory: optionalText(draft.subCategory),
      width: optionalNumber(draft.width),
      height: optionalNumber(draft.height),
      depth: optionalNumber(draft.depth),
      physicalWidth: optionalNumber(draft.physicalWidth),
      weight: optionalNumber(draft.weight),
      placementType: optionalText(draft.placementType),
      numberOfDoors: optionalNumber(draft.numberOfDoors),
      numberOfDrawers: optionalNumber(draft.numberOfDrawers),
      numberOfFixedShelves: optionalNumber(draft.numberOfFixedShelves),
      numberOfAdjShelves: optionalNumber(draft.numberOfAdjShelves),
      hingeSide: optionalText(draft.hingeSide),
      toeKickHeight: optionalNumber(draft.toeKickHeight),
      graphicType: optionalText(draft.graphicType),
      designerEligible: draft.designerEligible,
      isCornerCabinet: draft.isCornerCabinet,
      cornerSide: optionalText(draft.cornerSide),
      cornerType: optionalText(draft.cornerType),
      catalogImageUrl: optionalText(draft.catalogImageUrl),
      specNotes: optionalText(draft.specNotes),
      pkgLength: optionalNumber(draft.pkgLength),
      pkgWidth: optionalNumber(draft.pkgWidth),
      pkgHeight: optionalNumber(draft.pkgHeight),
      pkgWeight: optionalNumber(draft.pkgWeight),
      sku: optionalText(draft.sku),
      vendorSku: optionalText(draft.vendorSku),
      altSku1: optionalText(draft.altSku1),
      altSku2: optionalText(draft.altSku2),
      altSku3: optionalText(draft.altSku3),
      source,
    });
  };

  const categoryOptions = catalogOptions?.categories ?? [];
  const fieldClass = (key: string) => errors[key] ? "border-destructive" : "";
  const error = (key: string) => errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;
  const showLoading = isEdit && detail.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            {isEdit ? `Edit Item${detail.data ? ` — ${detail.data.item.masterCode}` : ""}` : "Add Item"}
          </DialogTitle>
          <DialogDescription>
            A master item defines CabinetDealz product identity, category, dimensions, and Designer geometry. Its supplier SKU and price remain a separate source record so catalog, checkout, and freight use the authoritative line.
          </DialogDescription>
        </DialogHeader>

        {showLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="space-y-6 pt-2">
            {serverError && <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{serverError}</div>}

            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Product identity</h3>
              <p className="mt-1 text-xs text-muted-foreground">SKU is the immutable master code used across CabinetDealz. Use the same code in imports and supplier mapping.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Master SKU <span className="text-destructive">*</span></Label><Input className={`font-mono ${fieldClass("masterCode")}`} disabled={isEdit} value={draft.masterCode} onChange={(event) => set("masterCode", event.target.value.toUpperCase())} placeholder="e.g. B-24" />{error("masterCode")}{isEdit && <p className="text-xs text-muted-foreground">Master SKU is fixed after creation to preserve saved designs, carts, and orders.</p>}</div>
                <div className="space-y-1.5"><Label>Product name / description <span className="text-destructive">*</span></Label><Input className={fieldClass("description")} value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="e.g. 24 in Single Door Base Cabinet" />{error("description")}</div>
                <div className="space-y-1.5"><Label>Category <span className="text-destructive">*</span></Label><Input className={fieldClass("category")} list="catalog-item-categories" value={draft.category} onChange={(event) => set("category", event.target.value)} placeholder="e.g. Base" /><datalist id="catalog-item-categories">{categoryOptions.map((category) => <option key={category} value={category} />)}</datalist>{error("category")}</div>
                <div className="space-y-1.5"><Label>Sub-category</Label><Input value={draft.subCategory} onChange={(event) => set("subCategory", event.target.value)} placeholder="e.g. Standard Base" /></div>
              </div>
            </section>

            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Dimensions and placement</h3>
              <p className="mt-1 text-xs text-muted-foreground">These measurements drive the 3D Designer, plan view, material list, and cabinet placement rules.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {([
                  ["width", 'Width (in)'], ["height", 'Height (in)'], ["depth", 'Depth (in)'], ["physicalWidth", 'Physical width (in)'], ["weight", 'Weight (lb)'],
                ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input inputMode="decimal" className={fieldClass(key)} value={draft[key]} onChange={(event) => set(key, event.target.value)} placeholder="—" />{error(key)}</div>)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5"><Label>Placement type</Label><Select value={draft.placementType || "none"} onValueChange={(value) => set("placementType", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="base">Base</SelectItem><SelectItem value="wall">Wall</SelectItem><SelectItem value="tall">Tall</SelectItem><SelectItem value="island">Island</SelectItem><SelectItem value="accessory">Accessory</SelectItem><SelectItem value="none">Not placeable</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Graphic type</Label><Input value={draft.graphicType} onChange={(event) => set("graphicType", event.target.value)} placeholder="e.g. base_1door" /></div>
                <div className="space-y-1.5"><Label>Hinge side</Label><Select value={draft.hingeSide || "none"} onValueChange={(value) => set("hingeSide", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None / N/A</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Toe kick (in)</Label><Input inputMode="decimal" className={fieldClass("toeKickHeight")} value={draft.toeKickHeight} onChange={(event) => set("toeKickHeight", event.target.value)} placeholder="—" />{error("toeKickHeight")}</div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["numberOfDoors", "Doors"], ["numberOfDrawers", "Drawers"], ["numberOfFixedShelves", "Fixed shelves"], ["numberOfAdjShelves", "Adjustable shelves"],
                ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input inputMode="numeric" className={fieldClass(key)} value={draft[key]} onChange={(event) => set(key, event.target.value)} placeholder="0" />{error(key)}</div>)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="catalog-item-designer-eligible">Eligible for 3D Designer</Label>
                  <p className="text-xs text-muted-foreground">Yes includes this item in the 3D Designer product list. No keeps it in the public catalog only.</p>
                </div>
                <Select value={draft.designerEligible ? "yes" : "no"} onValueChange={(value) => set("designerEligible", value === "yes")}>
                  <SelectTrigger id="catalog-item-designer-eligible" className="w-[96px]" aria-label="Eligible for 3D Designer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-4"><div><Label htmlFor="catalog-item-corner">Corner cabinet</Label><p className="text-xs text-muted-foreground">Enable only for a true corner unit so Designer collision and filler rules remain accurate.</p></div><Switch id="catalog-item-corner" checked={draft.isCornerCabinet} onCheckedChange={(value) => set("isCornerCabinet", value)} /></div>
                {draft.isCornerCabinet && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Corner side</Label><Select value={draft.cornerSide || "none"} onValueChange={(value) => set("cornerSide", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Corner type</Label><Select value={draft.cornerType || "none"} onValueChange={(value) => set("cornerType", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="lazy-susan">Lazy Susan</SelectItem><SelectItem value="blind-corner">Blind corner</SelectItem><SelectItem value="diagonal">Diagonal</SelectItem><SelectItem value="pie-cut">Pie cut</SelectItem><SelectItem value="l-shape">L-shape</SelectItem></SelectContent></Select></div></div>}
              </div>
            </section>

            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Supplier price and availability</h3>
              <p className="mt-1 text-xs text-muted-foreground">A published item must have a priced supplier SKU. Drafts may be completed later. Supplier sources remain separate from the master product.</p>
              {isEdit && (detail.data?.sources.length ?? 0) > 1 && <div className="mt-3 space-y-1.5"><Label>Supplier source to edit</Label><Select value={String(draft.source.skuId ?? "new")} onValueChange={(value) => value !== "new" && chooseExistingSource(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{detail.data?.sources.map((source) => <SelectItem key={source.skuId} value={String(source.skuId)}>{source.distributorName} · {source.styleName} · {source.distributorSku}</SelectItem>)}</SelectContent></Select></div>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5"><Label>Supplier line</Label><Select value={draft.source.distributorId} onValueChange={(value) => setDraft((current) => ({ ...current, source: { ...current.source, distributorId: value, styleId: "" } }))}><SelectTrigger className={fieldClass("source.distributorId")}><SelectValue placeholder="Select supplier line" /></SelectTrigger><SelectContent>{distributors.map((line) => <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>)}</SelectContent></Select>{error("source.distributorId")}</div>
                <div className="space-y-1.5"><Label>Door style</Label><Select value={draft.source.styleId} disabled={!draft.source.distributorId} onValueChange={(value) => setSource("styleId", value)}><SelectTrigger className={fieldClass("source.styleId")}><SelectValue placeholder={draft.source.distributorId ? "Select style" : "Choose supplier first"} /></SelectTrigger><SelectContent>{matchingStyles.map((style) => <SelectItem key={style.id} value={String(style.id)}>{style.ourName || style.styleCode}</SelectItem>)}</SelectContent></Select>{error("source.styleId")}</div>
                <div className="space-y-1.5"><Label>Supplier SKU</Label><Input className={`font-mono ${fieldClass("source.distributorSku")}`} value={draft.source.distributorSku} onChange={(event) => setSource("distributorSku", event.target.value.toUpperCase())} placeholder="e.g. B24" />{error("source.distributorSku")}</div>
                <div className="space-y-1.5"><Label>List Price</Label><Input inputMode="decimal" value={draft.source.listPrice} onChange={(event) => setSource("listPrice", event.target.value)} placeholder="0.00" /> </div>
                <div className="space-y-1.5"><Label>Your Cost</Label><Input inputMode="decimal" value={draft.source.yourCost} onChange={(event) => setSource("yourCost", event.target.value)} placeholder="0.00" />{error("source.price")}</div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2"><div><Label htmlFor="catalog-item-available">Available</Label><p className="text-xs text-muted-foreground">Can be ordered</p></div><Switch id="catalog-item-available" checked={draft.source.isAvailable} onCheckedChange={(value) => setSource("isAvailable", value)} /></div>
              </div>
            </section>

            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Shipping, aliases, and notes</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["pkgLength", 'Package L (in)'], ["pkgWidth", 'Package W (in)'], ["pkgHeight", 'Package H (in)'], ["pkgWeight", 'Package wt (lb)'],
                ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input inputMode="decimal" className={fieldClass(key)} value={draft[key]} onChange={(event) => set(key, event.target.value)} placeholder="—" />{error(key)}</div>)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ["sku", "Primary alternate SKU"], ["vendorSku", "Vendor SKU"], ["altSku1", "Alternate SKU 1"], ["altSku2", "Alternate SKU 2"], ["altSku3", "Alternate SKU 3"], ["catalogImageUrl", "Catalog image URL"],
                ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input className={key.includes("Sku") || key === "sku" ? "font-mono" : ""} value={draft[key]} onChange={(event) => set(key, event.target.value)} placeholder="—" /></div>)}
              </div>
              <div className="mt-4 space-y-1.5"><Label>Product notes</Label><Textarea value={draft.specNotes} onChange={(event) => set("specNotes", event.target.value)} placeholder="Construction, installation, or specification notes…" rows={3} /></div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="max-w-2xl text-xs text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />Publishing makes the master item active in the catalog and 3D Designer. The public picker appears only after its priced supplier SKU is published and available.</p>
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant="outline" disabled={save.isPending} onClick={() => submit("draft")}><Save className="mr-1.5 h-4 w-4" />{save.isPending ? "Saving…" : "Save Draft"}</Button><Button type="button" disabled={save.isPending} onClick={() => submit("publish")}><Send className="mr-1.5 h-4 w-4" />{save.isPending ? "Saving…" : "Publish"}</Button></div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CatalogItemFormDialog;
