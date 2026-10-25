import { useState, useMemo, useRef } from "react";
import {
  Star, Search, GripVertical, ArrowUp, ArrowDown, X,
  AlertTriangle, CheckCircle2, Pencil, RotateCcw, Upload, Loader2, ImageIcon, EyeOff, Eye,
	  Trash2, Plus, Package, Building2, DollarSign, MapPin, Ruler, ClipboardCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import DoorPhotoCorrectButton from "./DoorPhotoCorrectButton";
import { MediaPicker } from "./MediaPicker";
import { designerFrameCompliance } from "@/lib/doorFrameMetrics";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

const MAX_SCENES_PER_STYLE = 6;

interface AdminStyle {
  id: number;
  ourName: string;
  aliasName: string | null;
  featuredLabel: string | null;
  doorStyle: string | null;
  color: string | null;
  finish: string | null;
  woodSpecies: string | null;
  thumbnailImageUrl: string | null;
  doorSampleImageUrl: string | null;
  drawerSampleImageUrl: string | null;
  roomSceneImageUrl: string | null;
  roomScenes?: Array<{ id: number; imageUrl: string; sortOrder: number; isVerified: boolean; sourceNote: string | null; sourceDistributorId: number | null; isActive: boolean }>;
  doorSampleVerified: boolean;
  isFeatured: boolean;
  featuredRank: number;
  distributorId: number;
  distributorName: string | null;  // distributor's own name for this style (e.g. "Aspen White")
  supplierBrandName?: string | null; // real supplier brand (e.g. "US Cabinet Depot") — admin only
  supplierName?: string | null;      // neutral internal label (e.g. "Line A") — admin only
  warehouseZip: string | null;
  warehouseZips?: string[] | null;
  flatFreightFeeCents: number | null;
  railWidth: string | null;
  stileWidth: string | null;
  centerRailWidth: string | null;
  panelConstruction?: "raised" | "flat" | "slab" | "glass" | null;
  bevelWidth?: string | null;
  bevelDepth?: string | null;
  insideEdgeProfile?: string | null;
  drawerFrontType?: "five-piece-raised" | "five-piece-flat" | "slab" | null;
  grainDirection?: "vertical-stiles-horizontal-rails" | "vertical" | "horizontal" | "none" | null;
  finishSheen?: "satin" | "matte" | "gloss" | null;
  boxConstruction?: string | null;
  drawerConstruction?: string | null;
  hardware?: string | null;
  overlayType?: string | null;
  doorPanelType?: string | null;
  profileNotes: string | null;
  profileDescription?: string | null;
  sourceSpecification?: string | null;
  cornerSwatchImageUrl?: string | null;
  isActive: boolean;
}

// ── Catalog Preview Modal ─────────────────────────────────────────────────────
// Shows all SKUs for a door style with cost + retail prices.
function CatalogPreviewModal({
  style,
  open,
  onClose,
}: {
  style: AdminStyle;
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const { data, isLoading } = trpc.doorStyles.styleSkuPreview.useQuery(
    { styleId: style.id, page, pageSize: PAGE_SIZE, search: search || undefined },
    { enabled: open },
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fmt(v: string | null | undefined): string {
    if (v == null) return "—";
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl flex flex-col max-h-[90dvh] p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Catalog Preview — {style.ourName}
          </DialogTitle>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {(style.supplierBrandName || style.supplierName) && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                <Building2 className="h-3.5 w-3.5" />
                {style.supplierBrandName || style.supplierName}
              </span>
            )}
            {style.distributorName && (
              <span className="text-xs text-muted-foreground">
                ({style.distributorName})
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {total.toLocaleString()} SKUs
            </Badge>
            {style.doorStyle && (
              <Badge variant="secondary" className="text-xs">{style.doorStyle}</Badge>
            )}
            {style.color && (
              <Badge variant="secondary" className="text-xs">{style.color}</Badge>
            )}
          </div>
          {(style.boxConstruction || style.doorPanelType || style.drawerConstruction || style.hardware || style.profileNotes) && (
            <div className="mt-2 rounded-md border border-[#d8c7a1] bg-[#fffaf0] px-3 py-2 text-[11px] leading-snug text-[#49381a]" data-testid="admin-catalog-style-specifications">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wide">Automatic manufacturer specifications</span>
                <span className="text-[10px] text-[#806a42]">Stored on this finish record</span>
              </div>
              <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {style.boxConstruction && <span><b>Box:</b> {style.boxConstruction}</span>}
                {style.doorPanelType && <span><b>Front:</b> {style.doorPanelType}</span>}
                {style.drawerConstruction && <span><b>Drawers:</b> {style.drawerConstruction}</span>}
                {style.hardware && <span><b>Hardware:</b> {style.hardware}</span>}
                {style.overlayType && <span><b>Overlay:</b> {style.overlayType}</span>}
              </div>
              {style.profileNotes && <p className="mt-1 text-[#806a42]">{style.profileNotes}</p>}
            </div>
          )}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by code or description…"
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              No SKUs found{search ? " matching your search" : ""}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-28 sticky left-0 bg-background">Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20 text-right">Size</TableHead>
                  <TableHead className="w-24 text-right text-amber-700 font-semibold">Your Cost</TableHead>
                  <TableHead className="w-24 text-right">List</TableHead>
                  <TableHead className="w-24 text-right">Wholesale</TableHead>
	                  <TableHead className="w-24 text-right">Contractor</TableHead>
	                  <TableHead className="w-24 text-right">Homeowner</TableHead>
	                  <TableHead className="w-16 text-center">Avail</TableHead>
	                  <TableHead className="w-48">Designer</TableHead>
	                </TableRow>
              </TableHeader>
              <TableBody>
	                {rows.map((row) => (
	                  <TableRow key={row.skuId} data-testid={row.isCompliant ? "featured-cabinet-designer-compliant" : "featured-cabinet-designer-noncompliant"} className={`text-xs ${row.isCompliant ? "" : "bg-red-50/80"}`}>
	                    <TableCell className={`font-mono font-medium sticky left-0 ${row.isCompliant ? "bg-background" : "bg-red-50"}`}>{row.canonicalMasterCode ?? row.masterCode}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground" title={row.description}>{row.description}</TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      {[row.width, row.height].filter(Boolean).map(Number).filter(Number.isFinite).join('×') || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-700">{fmt(row.yourCost)}</TableCell>
                    <TableCell className="text-right">{fmt(row.listPrice)}</TableCell>
                    <TableCell className="text-right">{fmt(row.wholesalePrice)}</TableCell>
                    <TableCell className="text-right">{fmt(row.contractorPrice)}</TableCell>
                    <TableCell className="text-right">{fmt(row.homeownerPrice)}</TableCell>
	                    <TableCell className="text-center">
                      {row.isAvailable && row.isPublished ? (
                        <span className="text-emerald-600 font-medium">✓</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
	                    </TableCell>
	                    <TableCell>
	                      {row.isCompliant ? (
	                        <span className="font-medium text-emerald-700">Designer ready</span>
	                      ) : (
	                        <span className="font-medium text-red-800">Not Designer-compliant: {row.reason ?? "readiness could not be verified"}</span>
	                      )}
	                    </TableCell>
	                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0 text-xs text-muted-foreground">
            <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border shrink-0 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function thumb(s: AdminStyle): string | null {
  return s.roomSceneImageUrl || s.doorSampleImageUrl || s.thumbnailImageUrl || null;
}

function originZipList(style: Pick<AdminStyle, "warehouseZip" | "warehouseZips">): string[] {
  return Array.from(new Set([...(style.warehouseZips ?? []), style.warehouseZip ?? ""]
    .map((zip) => zip.replace(/\D/g, "").slice(0, 5))
    .filter((zip) => /^\d{5}$/.test(zip))));
}

function SourceAttribution({ style }: { style: AdminStyle }) {
  const source = style.supplierBrandName?.trim() || style.supplierName?.trim() || null;
  const supplierStyle = style.distributorName?.trim() || null;

  return (
    <span
      className="inline-flex max-w-full items-center gap-1 text-[10px] font-medium text-amber-800"
      title="Verified distributor attribution. It is visible only to authorized staff and is never shown to public shoppers."
    >
      <Building2 className="h-2.5 w-2.5 shrink-0" />
      <span className="shrink-0">Verified distributor:</span>
      <span className="truncate">{source ?? `Source record #${style.distributorId}`}</span>
      {supplierStyle && <span className="truncate text-muted-foreground">· Source style: {supplierStyle}</span>}
    </span>
  );
}

// ── Reusable image field: uses MediaPicker for library + upload + URL paste ──

function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  big?: boolean;
  slot?: "thumbnail" | "door-sample" | "room-scene";
}) {
  return (
    <div className="space-y-1.5">
      <MediaPicker
        label={label}
        value={value}
        onChange={onChange}
        placeholder="https://… or browse library"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ── Quick-edit dialog ─────────────────────────────────────────────────────────

interface EditDialogProps {
  style: AdminStyle;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditDialog({ style, open, onClose, onSaved }: EditDialogProps) {
  const [featuredLabel, setFeaturedLabel] = useState(style.featuredLabel ?? "");
  const [aliasName, setAliasName] = useState(style.aliasName ?? "");
  const [ourName, setOurName] = useState(style.ourName);
  const [doorStyle, setDoorStyle] = useState(style.doorStyle ?? "");
  const [color, setColor] = useState(style.color ?? "");
  const [finish, setFinish] = useState(style.finish ?? "");
  const [woodSpecies, setWoodSpecies] = useState(style.woodSpecies ?? "");
  const [warehouseZips, setWarehouseZips] = useState(() => originZipList(style));
  const [newWarehouseZip, setNewWarehouseZip] = useState("");
  const [flatFreightDollars, setFlatFreightDollars] = useState(
    style.flatFreightFeeCents != null ? (style.flatFreightFeeCents / 100).toFixed(2) : "",
  );
  const [doorSampleImageUrl, setDoorSampleImageUrl] = useState(style.doorSampleImageUrl ?? "");
  const [drawerSampleImageUrl, setDrawerSampleImageUrl] = useState(style.drawerSampleImageUrl ?? "");
  const [roomSceneImageUrl, setRoomSceneImageUrl] = useState(style.roomSceneImageUrl ?? "");
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState(style.thumbnailImageUrl ?? "");
  const [railWidth, setRailWidth] = useState(style.railWidth != null ? String(style.railWidth) : "");
  const [stileWidth, setStileWidth] = useState(style.stileWidth != null ? String(style.stileWidth) : "");
  const [centerRailWidth, setCenterRailWidth] = useState(style.centerRailWidth != null ? String(style.centerRailWidth) : "");
  const [panelConstruction, setPanelConstruction] = useState<NonNullable<AdminStyle["panelConstruction"]>>(style.panelConstruction ?? "flat");
  const [bevelWidth, setBevelWidth] = useState(style.bevelWidth != null ? String(style.bevelWidth) : "");
  const [bevelDepth, setBevelDepth] = useState(style.bevelDepth != null ? String(style.bevelDepth) : "");
  const [insideEdgeProfile, setInsideEdgeProfile] = useState(style.insideEdgeProfile ?? "");
  const [drawerFrontType, setDrawerFrontType] = useState<NonNullable<AdminStyle["drawerFrontType"]>>(style.drawerFrontType ?? "slab");
  const [grainDirection, setGrainDirection] = useState<NonNullable<AdminStyle["grainDirection"]>>(style.grainDirection ?? "none");
  const [finishSheen, setFinishSheen] = useState<NonNullable<AdminStyle["finishSheen"]>>(style.finishSheen ?? "satin");
  const [profileNotes, setProfileNotes] = useState(style.profileNotes ?? "");
  const [profileDescription, setProfileDescription] = useState((style as AdminStyle & { profileDescription?: string | null }).profileDescription ?? "");
  const [sourceSpecification, setSourceSpecification] = useState(style.sourceSpecification ?? "");
  const [cornerSwatchImageUrl, setCornerSwatchImageUrl] = useState(style.cornerSwatchImageUrl ?? "");
  const [newSceneUrl, setNewSceneUrl] = useState("");
  const [newSceneSourceNote, setNewSceneSourceNote] = useState("");

  // Reset state when dialog opens for a different style
  const resetToStyle = (s: AdminStyle) => {
    setFeaturedLabel(s.featuredLabel ?? "");
    setAliasName(s.aliasName ?? "");
    setOurName(s.ourName);
    setDoorStyle(s.doorStyle ?? "");
    setColor(s.color ?? "");
    setFinish(s.finish ?? "");
    setWoodSpecies(s.woodSpecies ?? "");
    setWarehouseZips(originZipList(s));
    setNewWarehouseZip("");
    setFlatFreightDollars(
      s.flatFreightFeeCents != null ? (s.flatFreightFeeCents / 100).toFixed(2) : "",
    );
    setDoorSampleImageUrl(s.doorSampleImageUrl ?? "");
    setDrawerSampleImageUrl(s.drawerSampleImageUrl ?? "");
    setRoomSceneImageUrl(s.roomSceneImageUrl ?? "");
    setThumbnailImageUrl(s.thumbnailImageUrl ?? "");
    setRailWidth(s.railWidth != null ? String(s.railWidth) : "");
    setStileWidth(s.stileWidth != null ? String(s.stileWidth) : "");
    setCenterRailWidth(s.centerRailWidth != null ? String(s.centerRailWidth) : "");
    setPanelConstruction(s.panelConstruction ?? "flat");
    setBevelWidth(s.bevelWidth != null ? String(s.bevelWidth) : "");
    setBevelDepth(s.bevelDepth != null ? String(s.bevelDepth) : "");
    setInsideEdgeProfile(s.insideEdgeProfile ?? "");
    setDrawerFrontType(s.drawerFrontType ?? "slab");
    setGrainDirection(s.grainDirection ?? "none");
    setFinishSheen(s.finishSheen ?? "satin");
    setProfileNotes(s.profileNotes ?? "");
    setProfileDescription((s as AdminStyle & { profileDescription?: string | null }).profileDescription ?? "");
    setSourceSpecification(s.sourceSpecification ?? "");
    setCornerSwatchImageUrl(s.cornerSwatchImageUrl ?? "");
  };

  const update = trpc.doorStyles.adminUpdateDoorStyle.useMutation({
    onSuccess: () => {
      toast.success("Style updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addRoomScene = trpc.doorStyles.addRoomScene.useMutation({
    onSuccess: () => { toast.success("Room scene added to this Door Style library"); setNewSceneUrl(""); setNewSceneSourceNote(""); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteRoomScene = trpc.doorStyles.deleteRoomScene.useMutation({
    onSuccess: () => { toast.success("Room scene removed"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const parsedMeasurement = (value: string) => {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 99 ? parsed : null;
  };
  const enteredRail = parsedMeasurement(railWidth);
  const enteredStile = parsedMeasurement(stileWidth);
  const hasRailText = railWidth.trim().length > 0;
  const hasStileText = stileWidth.trim().length > 0;
  const frameEntryStatus = enteredRail != null && enteredStile != null
    ? "complete"
    : hasRailText || hasStileText
      ? "partial"
      : "blank";
  const hasFrameCitation = sourceSpecification.trim().length > 0;
  const designerFrameReady = frameEntryStatus === "complete" && hasFrameCitation;

  function handleSave() {
    if (!ourName.trim()) {
      toast.error("Internal name is required");
      return;
    }
    if ((hasRailText && enteredRail == null) || (hasStileText && enteredStile == null)) {
      toast.error("Rail and stile measurements must be positive values in inches");
      return;
    }
    if (frameEntryStatus === "complete" && !sourceSpecification.trim()) {
      toast.error("A source citation is required before a frame can render in Designer");
      return;
    }
    const flatFreightValue = flatFreightDollars.trim();
    const flatFreightNumber = flatFreightValue ? Number(flatFreightValue) : null;
    if (flatFreightNumber != null && (!Number.isFinite(flatFreightNumber) || flatFreightNumber < 0)) {
      toast.error("Flat freight fee must be a valid non-negative dollar amount");
      return;
    }
    // For image URL fields: only send the field if the user actually changed it
    // from the original value. This prevents a stale empty string from wiping
    // an existing image that was set in a previous session.
    const orig = style;
    const imgField = (current: string, original: string | null | undefined) => {
      const cur = current.trim() || null;
      const was = original?.trim() || null;
      return cur !== was ? cur : undefined; // undefined = omit from patch (server won't touch it)
    };
    update.mutate({
      id: style.id,
      featuredLabel: featuredLabel.trim() || null,
      aliasName: aliasName.trim() || null,
      ourName: ourName.trim(),
      doorStyle: doorStyle.trim() || null,
      color: color.trim() || null,
      finish: finish.trim() || null,
      woodSpecies: woodSpecies.trim() || null,
      warehouseZips: warehouseZips.length > 0 ? warehouseZips : null,
      flatFreightFeeCents: flatFreightNumber == null ? null : Math.round(flatFreightNumber * 100),
      doorSampleImageUrl: imgField(doorSampleImageUrl, orig.doorSampleImageUrl),
      drawerSampleImageUrl: imgField(drawerSampleImageUrl, orig.drawerSampleImageUrl),
      roomSceneImageUrl: imgField(roomSceneImageUrl, orig.roomSceneImageUrl),
      thumbnailImageUrl: imgField(thumbnailImageUrl, orig.thumbnailImageUrl),
      cornerSwatchImageUrl: imgField(cornerSwatchImageUrl, orig.cornerSwatchImageUrl),
      railWidth: enteredRail,
      stileWidth: enteredStile,
      centerRailWidth: centerRailWidth.trim() ? parseFloat(centerRailWidth) : null,
      panelConstruction,
      bevelWidth: bevelWidth.trim() ? parseFloat(bevelWidth) : null,
      bevelDepth: bevelDepth.trim() ? parseFloat(bevelDepth) : null,
      insideEdgeProfile: insideEdgeProfile.trim() || null,
      drawerFrontType,
      grainDirection,
      finishSheen,
      profileNotes: profileNotes.trim() || null,
      profileDescription: profileDescription.trim() || null,
      sourceSpecification: sourceSpecification.trim() || null,
    });
  }

  function addWarehouseZip() {
    const normalizedZip = newWarehouseZip.replace(/\D/g, "").slice(0, 5);
    if (!/^\d{5}$/.test(normalizedZip)) {
      toast.error("Shipping origin ZIP must be exactly 5 digits");
      return;
    }
    if (warehouseZips.includes(normalizedZip)) {
      toast.message("This shipping origin ZIP is already listed");
      setNewWarehouseZip("");
      return;
    }
    setWarehouseZips((current) => [...current, normalizedZip]);
    setNewWarehouseZip("");
  }

  // Sync fields when the style prop changes (e.g. list refreshes)
  const prevId = useMemo(() => style.id, [style.id]);
  if (open && style.id !== prevId) resetToStyle(style);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="!flex h-[min(90dvh,800px)] max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden p-5 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-amber-600" />
            Edit Door Style
            <span className="font-mono text-xs font-normal text-muted-foreground ml-1">{style.ourName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-2 [scrollbar-gutter:stable]">

          {/* Alias Name (CD_STANDARDS white-label) */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3 space-y-1.5">
            <Label htmlFor="ed-alias">
              Alias Name{" "}
              <span className="text-muted-foreground font-normal text-xs">(white-label public name — what customers see)</span>
            </Label>
            <Input
              id="ed-alias"
              value={aliasName}
              onChange={(e) => setAliasName(e.target.value)}
              placeholder={`e.g. ${style.ourName}`}
            />
            {aliasName.trim() && (
              <button
                type="button"
                onClick={() => setAliasName("")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Clear alias (show internal name)
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              This is the CD_STANDARDS white-label name shown in the catalog, designer, and door styles page.
              Leave blank to fall back to the internal name.
            </p>
          </div>

          {/* Legacy public label (kept for backward compat) */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-1.5">
            <Label htmlFor="ed-label">
              Featured Label{" "}
              <span className="text-muted-foreground font-normal text-xs">(legacy override)</span>
            </Label>
            <Input
              id="ed-label"
              value={featuredLabel}
              onChange={(e) => setFeaturedLabel(e.target.value)}
              placeholder={`Default: ${style.ourName}`}
            />
            {featuredLabel.trim() && (
              <button
                type="button"
                onClick={() => setFeaturedLabel("")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset to default
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Legacy field. Use Alias Name above instead.
            </p>
          </div>

          {/* Internal name */}
          <div className="space-y-1.5">
            <Label htmlFor="ed-name">
              Internal Name{" "}
              <span className="text-muted-foreground font-normal text-xs">(admin only)</span>
            </Label>
            <Input
              id="ed-name"
              value={ourName}
              onChange={(e) => setOurName(e.target.value)}
              placeholder="e.g. Lumina White"
            />
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-3 space-y-2">
            <Label htmlFor="ed-warehouse-zip" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-sky-700" />
              Shipping Origin ZIPs
              <span className="text-muted-foreground font-normal text-xs">(admin only)</span>
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="ed-warehouse-zip"
                value={newWarehouseZip}
                onChange={(e) => setNewWarehouseZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWarehouseZip();
                  }
                }}
                placeholder="5-digit distributor warehouse ZIP"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
              />
              <Button type="button" variant="outline" className="shrink-0" onClick={addWarehouseZip}>
                <Plus className="mr-1.5 h-4 w-4" /> Add ZIP
              </Button>
            </div>
            {warehouseZips.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Saved shipping origin ZIPs">
                {warehouseZips.map((zip) => (
                  <Badge key={zip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
                    {zip}
                    <button
                      type="button"
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => setWarehouseZips((current) => current.filter((item) => item !== zip))}
                      aria-label={`Remove shipping origin ZIP ${zip}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add every verified warehouse ZIP for this Door Style. Live freight uses the saved origin nearest to the delivery ZIP; these private origins override the general distributor/global fallback for this style.
            </p>
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="ed-flat-freight">Plan B flat freight fee (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="ed-flat-freight"
                  value={flatFreightDollars}
                  onChange={(e) => setFlatFreightDollars(e.target.value)}
                  placeholder="Used only when the live quote is unavailable"
                  inputMode="decimal"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use this only when the distributor gives this cabinet line an approved fallback charge. The live carrier quote remains Plan A; Operations markup and delivery accessorials stay separate.
              </p>
            </div>
          </div>

          {/* Door style type + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-doorstyle">Door Style Type</Label>
              <Input
                id="ed-doorstyle"
                value={doorStyle}
                onChange={(e) => setDoorStyle(e.target.value)}
                placeholder="e.g. Shaker"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-color">Color</Label>
              <Input
                id="ed-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. White"
              />
            </div>
          </div>

          {/* Frame Profile Measurements */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-3 space-y-3">
            <div>
              <span className="text-xs font-semibold text-emerald-800">Frame Profile Measurements</span>
              <p className="text-xs text-muted-foreground mt-0.5">Enter widths in inches (e.g. <code>0.5</code> = 1/2", <code>3</code> = 3"). Applies to all door style types — Shaker, Slim Shaker, Double Shaker, Raised Panel, Beaded, Inset, Slab, etc.</p>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-background/70 px-2.5 py-2 text-xs">
              {designerFrameReady ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />}
              <div>
                <span className="font-semibold text-foreground">{designerFrameReady ? "Ready for Designer" : frameEntryStatus === "complete" ? "Source citation needed" : frameEntryStatus === "partial" ? "Partial frame entry" : "No frame measurement entered"}</span>
                <p className="mt-0.5 text-muted-foreground">{designerFrameReady ? "The cited rail and stile values are the Designer’s rendered frame dimensions for this exact style." : frameEntryStatus === "complete" ? "Add the official source citation before these dimensions can render. The Designer will retain its neutral fallback." : frameEntryStatus === "partial" ? "Enter both rail and stile widths to record a complete verified frame. A blank dimension keeps the neutral fallback." : "Leave blank only when a verified source measurement is unavailable; the Designer retains its neutral fallback."}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ed-rail">Rail Width (in)</Label>
                <Input
                  id="ed-rail"
                  type="number"
                  min="0" max="99" step="0.125"
                  value={railWidth}
                  onChange={(e) => setRailWidth(e.target.value)}
                  placeholder="e.g. 2.5"
                />
                <p className="text-xs text-muted-foreground">Top &amp; bottom rail</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-stile">Stile Width (in)</Label>
                <Input
                  id="ed-stile"
                  type="number"
                  min="0" max="99" step="0.125"
                  value={stileWidth}
                  onChange={(e) => setStileWidth(e.target.value)}
                  placeholder="e.g. 2.5"
                />
                <p className="text-xs text-muted-foreground">Left &amp; right stile</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-center-rail">Center Rail (in)</Label>
                <Input
                  id="ed-center-rail"
                  type="number"
                  min="0" max="99" step="0.125"
                  value={centerRailWidth}
                  onChange={(e) => setCenterRailWidth(e.target.value)}
                  placeholder="e.g. 2.5"
                />
                <p className="text-xs text-muted-foreground">Mid rail if any</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Panel construction</Label>
                <Select value={panelConstruction} onValueChange={(value) => setPanelConstruction(value as NonNullable<AdminStyle["panelConstruction"]>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raised">Raised panel</SelectItem>
                    <SelectItem value="flat">Flat panel</SelectItem>
                    <SelectItem value="slab">Slab</SelectItem>
                    <SelectItem value="glass">Glass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-bevel-width">Bevel width (in)</Label>
                <Input id="ed-bevel-width" type="number" min="0" max="12" step="0.125" value={bevelWidth} onChange={(event) => setBevelWidth(event.target.value)} placeholder="e.g. 0.5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-bevel-depth">Bevel depth (in)</Label>
                <Input id="ed-bevel-depth" type="number" min="0" max="4" step="0.0625" value={bevelDepth} onChange={(event) => setBevelDepth(event.target.value)} placeholder="e.g. 0.18" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-edge-profile">Inside-edge profile</Label>
                <Input id="ed-edge-profile" value={insideEdgeProfile} onChange={(event) => setInsideEdgeProfile(event.target.value)} placeholder="e.g. beveled ogee" />
              </div>
              <div className="space-y-1.5">
                <Label>Drawer front</Label>
                <Select value={drawerFrontType} onValueChange={(value) => setDrawerFrontType(value as NonNullable<AdminStyle["drawerFrontType"]>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="five-piece-raised">5-piece raised panel</SelectItem>
                    <SelectItem value="five-piece-flat">5-piece flat panel</SelectItem>
                    <SelectItem value="slab">Slab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Finish sheen</Label>
                <Select value={finishSheen} onValueChange={(value) => setFinishSheen(value as NonNullable<AdminStyle["finishSheen"]>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satin">Satin</SelectItem>
                    <SelectItem value="matte">Matte</SelectItem>
                    <SelectItem value="gloss">Gloss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Wood-grain direction</Label>
              <Select value={grainDirection} onValueChange={(value) => setGrainDirection(value as NonNullable<AdminStyle["grainDirection"]>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical-stiles-horizontal-rails">Vertical stiles / horizontal rails</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="none">No visible grain direction</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The 3D Designer uses these physical profile settings only for this catalog style. Provide or cite a sample-door source before entering frame dimensions.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-frame-source">Official frame source citation</Label>
              <Input
                id="ed-frame-source"
                value={sourceSpecification}
                onChange={(event) => setSourceSpecification(event.target.value)}
                placeholder="e.g. Skyline 2026 Slim Shaker catalog — exact style code SS-DW"
              />
              <p className="text-xs text-muted-foreground">Required with rail and stile measurements. Cite the official document and exact supplier style code; generic family assumptions do not render.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-profile-notes">Profile Notes</Label>
              <Input
                id="ed-profile-notes"
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
                placeholder="e.g. Ogee profile, Beaded inner edge, Step detail"
              />
            </div>
          </div>

          {/* Profile Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ed-profile-desc">Profile Description</Label>
            <textarea
              id="ed-profile-desc"
              value={profileDescription}
              onChange={(e) => setProfileDescription(e.target.value)}
              rows={5}
              placeholder="Long-form educational description shown on the public Door Styles page. Explain what makes this profile unique, its construction, and ideal use cases."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            />
            <p className="text-xs text-muted-foreground">Shown in the style detail popup and the Door Styles education guide.</p>
          </div>

          {/* Finish + Wood species */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-finish">Finish</Label>
              <Input
                id="ed-finish"
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                placeholder="e.g. Painted"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-wood">Wood Species</Label>
              <Input
                id="ed-wood"
                value={woodSpecies}
                onChange={(e) => setWoodSpecies(e.target.value)}
                placeholder="e.g. Maple"
              />
            </div>
          </div>

          {/* Images — upload from device or paste a URL; changes save site-wide */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Images</Label>
            <p className="text-xs text-muted-foreground -mt-2">
              Upload a photo from your device or paste an image URL. Saving applies the change
              everywhere this door style appears — catalog, door styles page, the kitchen designer,
              and the family/product page.
            </p>

            {/* Room scene gets the prominent, larger preview */}
            <ImageField
              label="Room Scene Photo"
              hint="The full kitchen scene shown on the family/product page and home showcase."
              value={roomSceneImageUrl}
              onChange={setRoomSceneImageUrl}
              big
              slot="room-scene"
            />
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Room Scene Library ({style.roomScenes?.length ?? 0}/{MAX_SCENES_PER_STYLE})</p>
                <p className="text-xs text-muted-foreground">Add only verified scenes that match this Door Style. These central scenes are shared with every affiliate; private source notes never appear publicly.</p>
              </div>
              {(style.roomScenes?.length ?? 0) > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {style.roomScenes?.map((scene) => <div key={scene.id} className="relative overflow-hidden rounded border border-border bg-background">
                  <img src={scene.imageUrl} alt={`Verified room scene for ${style.ourName}`} className="h-20 w-full object-cover" />
                  <p className="truncate p-1.5 text-[10px] text-muted-foreground">{scene.isVerified ? "Verified" : "Unverified"}{scene.sourceNote ? ` · ${scene.sourceNote}` : ""}</p>
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-6 w-6 bg-background/90 text-destructive" onClick={() => deleteRoomScene.mutate({ id: scene.id })} aria-label="Remove room scene"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>)}
              </div>}
              {(style.roomScenes?.length ?? 0) < MAX_SCENES_PER_STYLE && <div className="space-y-2 border-t border-emerald-200 pt-3">
                <MediaPicker value={newSceneUrl} onChange={setNewSceneUrl} label="Add verified matching scene" />
                <Input value={newSceneSourceNote} onChange={(e) => setNewSceneSourceNote(e.target.value)} placeholder="Private source verification note (optional)" className="h-8 text-xs" />
                <Button type="button" size="sm" disabled={!newSceneUrl.trim() || addRoomScene.isPending} onClick={() => addRoomScene.mutate({ styleId: style.id, imageUrl: newSceneUrl, sourceNote: newSceneSourceNote || null, sourceDistributorId: style.distributorId, isVerified: true })}><Plus className="mr-1 h-3.5 w-3.5" />{addRoomScene.isPending ? "Adding…" : "Add to library"}</Button>
              </div>}
            </div>
            {/* Door Sample + Drawer Sample side-by-side */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-800">Elevation Renderer Images</span>
                <span className="text-xs text-muted-foreground">— used in the 3D Designer and elevation renderer</span>
              </div>
              <ImageField
                label="Door Sample Photo"
                hint="Close-up of the door panel only (no drawer front). Used for door panels in the designer."
                value={doorSampleImageUrl}
                onChange={setDoorSampleImageUrl}
                slot="door-sample"
              />
              <ImageField
                label="Drawer Sample Photo"
                hint="Close-up of the drawer front only. Used for drawer fronts in the designer. Leave blank to fall back to the door sample."
                value={drawerSampleImageUrl}
                onChange={setDrawerSampleImageUrl}
                slot="door-sample"
              />
            </div>
            {/* Corner Swatch */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-800">Corner Swatch</span>
                <span className="text-xs text-muted-foreground">— angled close-up of the door corner</span>
              </div>
              <ImageField
                label="Corner Swatch Photo"
                hint="Angled close-up showing the door profile, grain, and color at the corner. Shown as an overlay on the Featured Door Styles section and in the designer style picker."
                value={cornerSwatchImageUrl}
                onChange={setCornerSwatchImageUrl}
                slot="thumbnail"
              />
            </div>
            <ImageField
              label="Thumbnail (optional override)"
              hint="Overrides the door sample as the small thumbnail when set."
              value={thumbnailImageUrl}
              onChange={setThumbnailImageUrl}
              slot="thumbnail"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={update.isPending || !ourName.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create new door style dialog ─────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  distributorOptions: { id: number; name: string }[];
}

function CreateDialog({ open, onClose, onCreated, distributorOptions }: CreateDialogProps) {
  const [distributorId, setDistributorId] = useState<string>("");
  const [styleCode, setStyleCode] = useState("");
  const [ourName, setOurName] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [doorStyle, setDoorStyle] = useState("");
  const [color, setColor] = useState("");
  const [finish, setFinish] = useState("");
  const [woodSpecies, setWoodSpecies] = useState("");

  const createMut = trpc.doorStyles.createDoorStyle.useMutation({
    onSuccess: (data) => {
      toast.success(`Door style "${data.ourName}" created (ID: ${data.id})`);
      onCreated();
      onClose();
      // Reset form
      setDistributorId("");
      setStyleCode("");
      setOurName("");
      setDistributorName("");
      setDoorStyle("");
      setColor("");
      setFinish("");
      setWoodSpecies("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!distributorId) {
      toast.error("Please select a distributor");
      return;
    }
    if (!styleCode.trim()) {
      toast.error("Style code is required");
      return;
    }
    if (!ourName.trim()) {
      toast.error("Internal name is required");
      return;
    }
    createMut.mutate({
      distributorId: Number(distributorId),
      styleCode: styleCode.trim(),
      ourName: ourName.trim(),
      distributorName: distributorName.trim() || undefined,
      doorStyle: doorStyle.trim() || null,
      color: color.trim() || null,
      finish: finish.trim() || null,
      woodSpecies: woodSpecies.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            New Door Style
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cr-dist">Distributor *</Label>
            <Select value={distributorId} onValueChange={setDistributorId}>
              <SelectTrigger id="cr-dist" className="h-9">
                <SelectValue placeholder="Select distributor…" />
              </SelectTrigger>
              <SelectContent>
                {distributorOptions.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-code">Style Code *</Label>
              <Input
                id="cr-code"
                value={styleCode}
                onChange={(e) => setStyleCode(e.target.value)}
                placeholder="e.g. SW, ASP"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">Internal Name *</Label>
              <Input
                id="cr-name"
                value={ourName}
                onChange={(e) => setOurName(e.target.value)}
                placeholder="e.g. Slim White"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-distname">Distributor Name</Label>
            <Input
              id="cr-distname"
              value={distributorName}
              onChange={(e) => setDistributorName(e.target.value)}
              placeholder="(defaults to internal name)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-doorstyle">Door Style Type</Label>
              <Input
                id="cr-doorstyle"
                value={doorStyle}
                onChange={(e) => setDoorStyle(e.target.value)}
                placeholder="e.g. Shaker"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-color">Color</Label>
              <Input
                id="cr-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. White"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-finish">Finish</Label>
              <Input
                id="cr-finish"
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                placeholder="e.g. Painted"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-wood">Wood Species</Label>
              <Input
                id="cr-wood"
                value={woodSpecies}
                onChange={(e) => setWoodSpecies(e.target.value)}
                placeholder="e.g. Maple"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMut.isPending || !ourName.trim() || !styleCode.trim() || !distributorId}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createMut.isPending ? "Creating…" : "Create Style"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PendingMeasurement = {
  id: number;
  vendorLineName: string;
  vendorStyleCode: string;
  vendorStyleName: string;
  appliesToStyleIds: number[];
  measuredBy: string;
  measuredOn: string;
  citation: string;
  measurementData: Record<string, unknown>;
  submittedAt: Date;
};

function DoorMeasurementReviewQueue() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.distributorPortal.listDoorMeasurementSubmissions.useQuery({ status: "pending", limit: 100 });
  const [target, setTarget] = useState<PendingMeasurement | null>(null);
  const [rail, setRail] = useState("");
  const [stile, setStile] = useState("");
  const [centerRail, setCenterRail] = useState("");
  const [physicalSampleMeasured, setPhysicalSampleMeasured] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const review = trpc.distributorPortal.reviewDoorMeasurementSubmission.useMutation({
    onSuccess: (result) => {
      utils.distributorPortal.listDoorMeasurementSubmissions.invalidate();
      utils.doorStyles.listForAdmin.invalidate();
      toast.success(result.approved ? "Designer profile approved from the physical sample." : "Vendor measurement submission rejected.");
      setTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const openReview = (submission: PendingMeasurement) => {
    setTarget(submission);
    setRail(""); setStile(""); setCenterRail(""); setPhysicalSampleMeasured(false); setReviewNote("");
  };
  const measured = target?.measurementData ?? {};
  const applicantValue = (key: string) => {
    const value = measured[key];
    return value == null || value === "" ? "—" : String(value);
  };
  const approve = (approved: boolean) => {
    if (!target) return;
    const asNumber = (value: string) => value.trim() ? Number(value) : null;
    review.mutate({
      id: target.id,
      approve: approved,
      physicalSampleMeasured,
      railWidth: approved ? asNumber(rail) : undefined,
      stileWidth: approved ? asNumber(stile) : undefined,
      centerRailWidth: approved ? asNumber(centerRail) : undefined,
      reviewNote: reviewNote.trim() || undefined,
    });
  };
  if (isLoading || !data?.length) return null;
  const pending = data as PendingMeasurement[];
  return <>
    <section data-testid="door-measurement-review-queue" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="flex items-center gap-2 font-semibold text-amber-950"><Ruler className="h-4 w-4" />Physical sample-door measurement review</h2><p className="mt-1 max-w-3xl text-sm text-amber-900/80">Vendor submissions are official first-party source records. They remain pending until CabinetDealz measures the delivered sample once. Approval writes the team-measured frame profile and citation into every style the vendor checked as the same profile.</p></div>
        <Badge className="w-fit border-amber-300 bg-background text-amber-900" variant="outline">{pending.length} pending</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {pending.map((submission) => <div key={submission.id} className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{submission.vendorLineName} · {submission.vendorStyleName} <span className="font-mono text-sm">{submission.vendorStyleCode}</span></p><p className="text-xs text-muted-foreground">Measured by {submission.measuredBy} on {submission.measuredOn} · applies to {submission.appliesToStyleIds.length} checked style{submission.appliesToStyleIds.length === 1 ? "" : "s"}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={submission.citation}>{submission.citation}</p></div><Button size="sm" variant="outline" onClick={() => openReview(submission)}><ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />Review physical sample</Button></div>)}
      </div>
    </section>
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) setTarget(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-amber-600" />Confirm physical sample measurements</DialogTitle></DialogHeader>
        {target && <div className="space-y-4"><div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm"><p className="font-semibold">Vendor source: {target.vendorLineName} · {target.vendorStyleName} · {target.vendorStyleCode}</p><p className="mt-1 text-muted-foreground">Vendor-entered values: top rail {applicantValue("topRailWidth")}″ · bottom rail {applicantValue("bottomRailWidth")}″ · left stile {applicantValue("leftStileWidth")}″ · right stile {applicantValue("rightStileWidth")}″.</p><p className="mt-1 text-muted-foreground">Approval will update {target.appliesToStyleIds.length} checked Designer profile{target.appliesToStyleIds.length === 1 ? "" : "s"}.</p></div><label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" checked={physicalSampleMeasured} onChange={(event) => setPhysicalSampleMeasured(event.target.checked)} /><span><strong>CabinetDealz measured the physical sample door.</strong><br /><span className="text-muted-foreground">Required before these values may render in Designer.</span></span></label><div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Team-measured rail (in)</Label><Input type="number" step="0.0625" min="0.01" value={rail} onChange={(event) => setRail(event.target.value)} /></div><div className="space-y-1"><Label>Team-measured stile (in)</Label><Input type="number" step="0.0625" min="0.01" value={stile} onChange={(event) => setStile(event.target.value)} /></div><div className="space-y-1"><Label>Center rail (in)</Label><Input type="number" step="0.0625" min="0.01" value={centerRail} onChange={(event) => setCenterRail(event.target.value)} /></div></div><div className="space-y-1"><Label>Review note (optional)</Label><Input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="e.g. matches the delivered sample" /></div></div>}
        <DialogFooter><Button variant="outline" onClick={() => setTarget(null)} disabled={review.isPending}>Cancel</Button><Button variant="destructive" onClick={() => approve(false)} disabled={review.isPending}>Reject</Button><Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => approve(true)} disabled={review.isPending || !physicalSampleMeasured || !rail || !stile}>{review.isPending ? "Saving…" : "Approve for Designer"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FeaturedStylesAdmin() {
  const [search, setSearch] = useState("");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [editingStyle, setEditingStyle] = useState<AdminStyle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminStyle | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<AdminStyle | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.doorStyles.listForAdmin.useQuery();
  const { data: skuCounts } = trpc.doorStyles.skuCountsByStyle.useQuery();

  const styles = useMemo(() => (data ?? []) as unknown as AdminStyle[], [data]);

	  // Build a map of styleId -> catalog counts plus exact Designer cabinet holds.
	  const countMap = useMemo(() => {
	    const map = new Map<number, { skuCount: number; cabinetCount: number; designerNoncompliantCabinetCount: number }>();
	    if (skuCounts) {
	      for (const row of skuCounts) {
	        map.set(row.styleId, {
	          skuCount: Number(row.skuCount),
	          cabinetCount: Number(row.cabinetCount),
	          designerNoncompliantCabinetCount: Number(row.designerNoncompliantCabinetCount ?? 0),
	        });
      }
    }
    return map;
  }, [skuCounts]);

  const featured = useMemo(
    () =>
      styles
        .filter((s) => s.isFeatured)
        .sort((a, b) => a.featuredRank - b.featuredRank || a.ourName.localeCompare(b.ourName)),
    [styles],
  );

  // Distinct distributors present in the catalog, for the filter dropdown.
  const distributorOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of styles) {
      if (!map.has(s.distributorId)) {
        map.set(
          s.distributorId,
          s.supplierBrandName?.trim() || s.supplierName?.trim() || `Distributor #${s.distributorId}`,
        );
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [styles]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    const distId = distributorFilter === "all" ? null : Number(distributorFilter);
    return styles
      .filter((s) => s.isActive && !s.isFeatured)
      .filter((s) => (distId === null ? true : s.distributorId === distId))
      .filter((s) =>
        q
          ? `${s.ourName} ${s.doorStyle ?? ""} ${s.color ?? ""} ${s.finish ?? ""} ${s.distributorName ?? ""} ${s.supplierBrandName ?? ""} ${s.supplierName ?? ""}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => a.ourName.localeCompare(b.ourName));
  }, [styles, search, distributorFilter]);

  const inactive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return styles
      .filter((s) => !s.isActive)
      .filter((s) =>
        q
          ? `${s.ourName} ${s.doorStyle ?? ""} ${s.color ?? ""} ${s.finish ?? ""}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => a.ourName.localeCompare(b.ourName));
  }, [styles, search]);

  const toggleActive = trpc.doorStyles.adminUpdateDoorStyle.useMutation({
    onSuccess: () => {
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
      utils.doorStyles.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  function deactivate(s: AdminStyle) {
    toggleActive.mutate({ id: s.id, isActive: false });
    toast.success(`"${s.ourName}" hidden from storefront`);
  }
  function activate(s: AdminStyle) {
    toggleActive.mutate({ id: s.id, isActive: true });
    toast.success(`"${s.ourName}" restored to storefront`);
  }

  const setFeatured = trpc.doorStyles.setFeatured.useMutation({
    onSuccess: () => {
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorder = trpc.doorStyles.reorderFeatured.useMutation({
    onSuccess: () => {
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.doorStyles.deleteDoorStyle.useMutation({
    onSuccess: () => {
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
      utils.doorStyles.skuCountsByStyle.invalidate();
      toast.success("Door style permanently deleted");
      setDeleteTarget(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setDeleteTarget(null);
    },
  });

  const unverifiedDoorSampleCount = useMemo(
    () => featured.filter((s) => !s.doorSampleVerified).length,
    [featured],
  );

  function add(s: AdminStyle) {
    if (!(s.roomScenes?.some((scene) => scene.isActive && scene.isVerified) ?? false)) {
      toast.error("Add a style-matched room scene before adding this style to the homepage set.");
      return;
    }
    setFeatured.mutate({ id: s.id, featured: true });
  }
  function remove(s: AdminStyle) {
    setFeatured.mutate({ id: s.id, featured: false });
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...featured];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ orderedIds: next.map((s) => s.id) });
  }

  function invalidateAll() {
    utils.doorStyles.listForAdmin.invalidate();
    utils.doorStyles.featured.invalidate();
    utils.doorStyles.skuCountsByStyle.invalidate();
  }

  // SKU count badge helper — clickable to open the catalog preview modal
	  function SkuBadge({ style: s }: { style: AdminStyle }) {
	    const counts = countMap.get(s.id);
    if (!counts || counts.skuCount === 0) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600 bg-orange-50">
          0 SKUs
        </Badge>
      );
    }
	    const hasDesignerHolds = counts.designerNoncompliantCabinetCount > 0;
	    return (
	      <button
	        type="button"
	        onClick={(e) => { e.stopPropagation(); setPreviewStyle(s); }}
	        title={hasDesignerHolds ? "Click to review highlighted cabinets that are not Designer-compliant" : "Click to preview catalog items with pricing"}
	        className="inline-flex items-center"
	      >
	        <Badge data-testid={hasDesignerHolds ? "featured-cabinet-count-designer-noncompliant" : "featured-cabinet-count-designer-compliant"} variant="outline" className={`text-[10px] px-1.5 py-0 cursor-pointer transition-colors ${hasDesignerHolds ? "border-red-400 bg-red-100 font-semibold text-red-800 hover:bg-red-200" : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
	          {hasDesignerHolds ? <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> : <Package className="h-2.5 w-2.5 mr-0.5" />}
	          {hasDesignerHolds ? `${counts.designerNoncompliantCabinetCount} cabinet hold${counts.designerNoncompliantCabinetCount === 1 ? "" : "s"}` : `${counts.skuCount} SKUs`}
	        </Badge>
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Intro + cap meter */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Featured Door Styles
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Curate up to six style-matched room scenes for the homepage. The order below is the
            rotation priority, and signed-in shoppers receive one of these scenes per session.
            Each row includes its internal source record, which remains unavailable on public pages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" />
            New Style
          </Button>
          {unverifiedDoorSampleCount > 0 && (
            <Badge variant="outline" className="text-sm border-amber-500 text-amber-600 bg-amber-50">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {unverifiedDoorSampleCount} door sample{unverifiedDoorSampleCount === 1 ? "" : "s"} need review
            </Badge>
          )}
          <Badge variant="secondary" className="text-sm">
            {featured.length} featured Door Styles
          </Badge>
        </div>
	      </div>

	      <DoorMeasurementReviewQueue />

	      {/* Featured list */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Featured Door Styles ({featured.length})
        </h3>
        {featured.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No curated homepage scenes yet. Add a room-scene-ready style from the list below.
          </div>
	        ) : (
	          <ul className="space-y-2">
	            {featured.map((s, i) => {
	              const designerCompliance = designerFrameCompliance(s);
	              const cabinetHoldCount = countMap.get(s.id)?.designerNoncompliantCabinetCount ?? 0;
	              const allDesignerCompliant = designerCompliance.isCompliant && cabinetHoldCount === 0;
	              return (
	              <li
	                key={s.id}
	                data-testid={allDesignerCompliant ? "featured-style-designer-compliant" : "featured-style-designer-noncompliant"}
	                className={`flex items-center gap-3 rounded-lg border p-2.5 ${allDesignerCompliant ? "border-border bg-card" : "border-red-400 bg-red-50/80"}`}
              >
                <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                {thumb(s) ? (
                  <img
                    src={thumb(s)!}
                    alt={s.ourName}
                    className="h-12 w-12 rounded object-cover ring-1 ring-border shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {/* Public label (if set) vs internal name */}
                  <p className="font-medium text-sm truncate flex items-center gap-1.5">
                    {s.featuredLabel ? (
                      <>
                        <span className="text-primary">{s.featuredLabel}</span>
                        <span className="text-muted-foreground font-normal text-xs">({s.ourName})</span>
                      </>
                    ) : (
                      <>
                        {s.ourName}
                        {s.doorSampleVerified ? (
                          <span title="Sample photo verified" className="inline-flex items-center text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        ) : (
                          <span title="Unverified door photo" className="inline-flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                        )}
                      </>
                    )}
                  </p>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700">
                      <ImageIcon className="mr-0.5 h-2.5 w-2.5" /> Room scene ready
                    </Badge>
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
                    <span className="text-xs text-muted-foreground">{[s.doorStyle, s.color, s.finish].filter(Boolean).join(" · ")}</span>
                    <SkuBadge style={s} />
                  </div>
	                  {!designerCompliance.isCompliant && (
	                    <p className="mt-1 text-xs font-medium text-red-800">Designer requirement: {designerCompliance.reason}</p>
	                  )}
	                  {cabinetHoldCount > 0 && (
	                    <p className="mt-1 text-xs font-medium text-red-800">Designer cabinet requirement: {cabinetHoldCount} catalog cabinet{cabinetHoldCount === 1 ? " is" : "s are"} held. Open the red cabinet-hold badge to see every highlighted item and its exact reason.</p>
	                  )}
	                  <div className="mt-1 min-w-0"><SourceAttribution style={s} /></div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Quick-edit button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => setEditingStyle(s)}
                    aria-label="Edit style"
                    title="Edit style"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DoorPhotoCorrectButton styleId={s.id} styleName={s.ourName} compact />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === 0 || reorder.isPending}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={i === featured.length - 1 || reorder.isPending}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={setFeatured.isPending}
                    onClick={() => remove(s)}
                    aria-label="Remove from featured"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* All other styles — edit any of them, or feature them */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            All door styles{" "}
            <span className="text-muted-foreground/60 normal-case font-normal">
              ({available.length})
            </span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Filter by distributor (supply line) */}
            <Select value={distributorFilter} onValueChange={setDistributorFilter}>
              <SelectTrigger className="h-9 w-full sm:w-56">
                <SelectValue placeholder="All distributors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All distributors</SelectItem>
                {distributorOptions.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search door styles…"
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching styles.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {available.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              >
                <button
                  type="button"
                  onClick={() => setEditingStyle(s)}
                  title="Edit this door style"
                  className="shrink-0"
                >
                  {thumb(s) ? (
                    <img
                      src={thumb(s)!}
                      alt={s.ourName}
                      className="h-11 w-11 rounded object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStyle(s)}
                  className="min-w-0 flex-1 text-left"
                  title="Edit this door style"
                >
                  <p className="font-medium text-sm truncate">{s.ourName}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    {(s.roomScenes?.length ?? 0) > 0 ? `${s.roomScenes?.length}/${MAX_SCENES_PER_STYLE} room scenes` : "Room scene required"}
                    {[s.doorStyle, s.color].filter(Boolean).length > 0 && " · "}
                    {[s.doorStyle, s.color].filter(Boolean).join(" · ")}
                    <SkuBadge style={s} />
                  </p>
                  <span className="mt-1 block min-w-0"><SourceAttribution style={s} /></span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => setEditingStyle(s)}
                    aria-label="Edit style"
                    title="Edit style"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => add(s)}
                    disabled={setFeatured.isPending || !(s.roomScenes?.some((scene) => scene.isActive && scene.isVerified) ?? false)}
                    aria-label="Feature this style"
                    title={!(s.roomScenes?.some((scene) => scene.isActive && scene.isVerified) ?? false) ? "Add a verified matching room scene before featuring" : "Add to curated homepage styles"}
                  >
                    <Star className="h-4 w-4 text-muted-foreground/60" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deactivate(s)}
                    disabled={toggleActive.isPending}
                    aria-label="Deactivate style"
                    title="Hide from storefront (deactivate)"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive / deactivated styles */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Inactive styles{" "}
            <span className="text-muted-foreground/60 normal-case font-normal">({inactive.length} hidden from storefront)</span>
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {inactive.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5 opacity-60"
              >
                <div className="shrink-0">
                  {thumb(s) ? (
                    <img
                      src={thumb(s)!}
                      alt={s.ourName}
                      className="h-11 w-11 rounded object-cover ring-1 ring-border grayscale"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate line-through text-muted-foreground">{s.ourName}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    {(s.supplierBrandName || s.supplierName) && (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-700 shrink-0">
                        <Building2 className="h-2.5 w-2.5" />{s.supplierBrandName || s.supplierName}
                      </span>
                    )}
                    {[s.doorStyle, s.color].filter(Boolean).join(" · ")}
                    <SkuBadge style={s} />
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => activate(s)}
                    disabled={toggleActive.isPending}
                    aria-label="Restore style"
                    title="Restore to storefront (activate)"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(s)}
                    aria-label="Permanently delete style"
                    title="Permanently delete this door style"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog preview modal — opens when clicking the SKU count badge */}
      {previewStyle && (
        <CatalogPreviewModal
          key={previewStyle.id}
          style={previewStyle}
          open={!!previewStyle}
          onClose={() => setPreviewStyle(null)}
        />
      )}

      {/* Quick-edit dialog — key forces full remount when switching styles so local image state resets */}
      {editingStyle && (
        <EditDialog
          key={editingStyle.id}
          style={editingStyle}
          open={!!editingStyle}
          onClose={() => setEditingStyle(null)}
          onSaved={invalidateAll}
        />
      )}

      {/* Create new style dialog */}
      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidateAll}
        distributorOptions={distributorOptions}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Door Style</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteTarget?.ourName}</strong>? This cannot be undone.
              {(() => {
                const counts = deleteTarget ? countMap.get(deleteTarget.id) : null;
                if (counts && counts.skuCount > 0) {
                  return (
                    <span className="block mt-2 text-destructive font-medium">
                      This style has {counts.skuCount} SKUs referencing it. You must remove or reassign them before deleting.
                    </span>
                  );
                }
                return null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate({ id: deleteTarget.id })}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
