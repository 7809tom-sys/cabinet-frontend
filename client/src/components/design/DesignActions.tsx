import { useState, useEffect, useRef } from "react";
import { Save, FolderOpen, Download, Loader2, Clock, Send, Calculator, Printer, Ruler, ClipboardCheck, Lightbulb, TriangleAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PlacedCabinet, RoomData, WallOpening, SinkFixture, PotFillerFixture, PlacedFurniture, PonyWall } from "@/lib/design";
import { roomWithPersistedEntities } from "@/lib/design";
import type { PreSavePlanReview, PreSavePlanReviewFinding } from "@/lib/preSavePlanReview";
import { normalizeStoreScope } from "@/lib/affiliateContext";

// ─────────────────────────────────────────────────────────────────────────────
// DesignActions
// Save the current kitchen design, reload a previously saved one, and export an
// itemized build sheet (CSV). No supplier/line identity is included anywhere.
// ─────────────────────────────────────────────────────────────────────────────

const DESIGN_AUTO_SAVE_INTERVAL_MS = 60_000;

export interface BuildSheetRow {
  /** Placed cabinet IDs represented by this bill-of-material line. */
  sourceUids?: string[];
  code: string;
  description: string;
  widthIn: number;
  // Real height & depth in inches so every line carries a full 3D size.
  heightIn: number;
  depthIn: number;
  placement: string;
  // Door hinge side, e.g. "left" | "right" | "double"; omitted for no-door items.
  swing?: string;
  // The specific door style / finish this line is in (important for two-tone
  // designs where different cabinets carry different colors). Optional.
  color?: string | null;
  qty: number;
  unitPrice: number | null;
  /** Exact adjusted unit amount locked into Designer cart/checkout pricing. */
  pricingUnitPrice?: number | null;
  // Per-item discount (negative) or surcharge (positive) percentage. Null = no adjustment.
  discountPct?: number | null;
}

// Human label for the hinge side used on the build sheet.
function swingCell(s: string | undefined): string {
  if (s === "left") return "Left hinge";
  if (s === "right") return "Right hinge";
  if (s === "double") return "Double door";
  return "";
}

// Inch value without trailing zeros (34.5 -> "34.5", 24 -> "24"). Returns ""
// for missing/invalid numbers so the CSV never prints NaN.
function fmtIn(n: number | undefined | null): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Combined W x H x D size cell for a build-sheet row. Only includes the
// dimensions that are actually known.
function sizeCell(r: BuildSheetRow): string {
  const w = fmtIn(r.widthIn);
  const h = fmtIn(r.heightIn);
  const d = fmtIn(r.depthIn);
  if (!w && !h && !d) return "";
  return `${w || "?"}\"W x ${h || "?"}\"H x ${d || "?"}\"D`;
}

interface Props {
  room: RoomData;
  placed: PlacedCabinet[];
  openings: WallOpening[];
  sinks: SinkFixture[];
  potFillers: PotFillerFixture[];
  island: { x: number; y: number; width: number; depth: number } | null;
  furniture: PlacedFurniture[];
  ponyWalls: PonyWall[];
  // Pelican surface & fixture picks chosen in the Surfaces tab; persisted so a
  // reloaded design restores its exact surfaces.
  selectedSurfaces: unknown[];
  threeDPresentation?: object | null;
  styleId: number | null;
  // Locked supply line (distributor) for this design, or null when unlocked.
  lockedDistributorId: number | null;
  styleName: string | null;
  tier: "Wholesale" | "Contractor" | "Homeowner";
  total: number;
  // Extra non-cabinet lines (fillers, crown, toe kick, countertop) for export.
  extraLines: { label: string; detail: string }[];
  buildRows: BuildSheetRow[];
  // Current room context for Master Project grouping.
  roomType: string;
  // Contact email for the designer (from the email gate / signed-in user). Used
  // to associate the saved plan with the correct CRM contact.
  contactEmail?: string | null;
  /** Name/phone captured at the designer gate, used to prefill the required customer fields. */
  contactName?: string | null;
  contactPhone?: string | null;
  /** Affiliate context makes saved designs, plans, exports, and CRM links private to that affiliate. */
  affiliateSlug?: string | null;
  /** Existing saved-design identity. When present, Save updates that shared plan instead of creating an unrelated copy. */
  currentDesignId?: number | null;
  /** Existing saved-design name, used to keep Update from silently renaming the plan. */
  currentDesignName?: string | null;
  /** Canonical current plan payload from the Designer, used to avoid needless automatic updates. */
  currentPlanFingerprint?: string | null;
  /** True when the canonical current plan exactly matches the server-saved revision. */
  isCurrentPlanSaved?: boolean;
  /** Visible only in affiliate sessions; removes platform branding from exports. */
  brandName?: string | null;
  // Incrementing signals from a parent (e.g. the mobile "More" sheet) to open the
  // Save / My Plans dialogs without the parent needing access to internal state.
  openSaveSignal?: number;
  openLoadSignal?: number;
  /** Measured, non-destructive recommendations reviewed before the save dialog opens. */
  preSavePlanReview?: PreSavePlanReview;
  /** Opens an existing safe editing workflow; it never changes the plan itself. */
  onReviewPlanFinding?: (finding: PreSavePlanReviewFinding) => void;
  /** Called after a design is successfully saved (after the user confirms in the dialog). */
  onSaveSuccess?: (designName: string, designId: number) => void;
  /** Reports only a successful in-place automatic update so the Designer can show its timestamp. */
  onAutomaticSaveSuccess?: (savedAt: number) => void;
  /** Called after the server permanently deletes a saved design. */
  onDeleteSuccess?: (designId: number, designName: string) => void;
  onLoad: (d: {
    id?: number;
    room: RoomData;
    placed: PlacedCabinet[];
    styleId: number | null;
    distributorId?: number | null;
    roomType?: string | null;
    selectedSurfaces?: unknown[] | null;
    threeDPresentation?: {
      cabinetFinish?: string;
      countertopFinish?: string;
      backsplashEnabled?: boolean;
      backsplashHeightMode?: "standard" | "full-height";
      countertopBacksplashHeightIn?: 0 | 2.5 | 3;
    } | null;
  }) => void;
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build + download the itemized CSV build sheet. Exported so both the toolbar
// action and the pricing-panel button share one implementation.
export interface BuildSheetArgs {
  room: RoomData;
  styleName: string | null;
  tier: "Wholesale" | "Contractor" | "Homeowner";
  total: number;
  buildRows: BuildSheetRow[];
  extraLines: { label: string; detail: string }[];
  /**
   * Brand name for the sheet header. On an affiliate storefront this is the
   * affiliate's store name so the export carries no platform branding.
   */
  brandName?: string | null;
}

// Pure: build the CSV text for a design build sheet. No DOM / side effects so it
// can be unit-tested directly. Returns null if there are no cabinet rows.
export function buildSheetCsv(args: BuildSheetArgs): string | null {
  const { room, styleName, tier, total, buildRows, extraLines, brandName } = args;
  if (buildRows.length === 0) return null;
  const header = ["Item Code", "Description", "Color / Finish", "Size (W x H x D)", "W (in)", "H (in)", "D (in)", "Type", "Swing", "Qty", "Unit Price", "Adj %", "Line Total"];
  const lines: string[] = [];
  lines.push(`${brandName?.trim() || "Cabinet Dealz"} Build Sheet`);
  lines.push(`Door Style:,${csvEscape(styleName ?? "(not selected)")}`);
  lines.push(`Pricing Tier:,${csvEscape(tier)}`);
  lines.push(`Room:,${csvEscape(`${room.width}in x ${room.depth}in`)}`);
  lines.push("");
  lines.push(header.map(csvEscape).join(","));
  for (const r of buildRows) {
    const disc = r.discountPct ?? 0;
    const rawLine = r.unitPrice != null ? r.unitPrice * r.qty : null;
    const lineTotal = rawLine != null ? (rawLine * (1 + disc / 100)).toFixed(2) : "";
    const adjStr = disc !== 0 ? `${disc > 0 ? "+" : ""}${disc}%` : "";
    lines.push([
      r.code, r.description, r.color ?? "", sizeCell(r),
      fmtIn(r.widthIn), fmtIn(r.heightIn), fmtIn(r.depthIn),
      r.placement, swingCell(r.swing), r.qty,
      r.unitPrice != null ? r.unitPrice.toFixed(2) : "", adjStr, lineTotal,
    ].map(csvEscape).join(","));
  }
  for (const e of extraLines) {
    lines.push([e.label, e.detail, "", "", "", "", "", "", "", "", "", "", "incl."].map(csvEscape).join(","));
  }
  lines.push("");
  lines.push(`Estimated Total,,,,,,,,,,,,${total.toFixed(2)}`);
  return lines.join("\n");
}

export function exportBuildSheet(args: BuildSheetArgs): boolean {
  const csv = buildSheetCsv(args);
  if (csv == null) {
    toast.error("Add cabinets before exporting.");
    return false;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Filename follows the brand too, so an affiliate's customer never receives a
  // file named after the platform.
  const slugBrand = (args.brandName?.trim() || "cabinet-dealz")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "build";
  a.download = `${slugBrand}-build-sheet-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Build sheet exported", { description: `${args.buildRows.length} line items` }); // CSV export stays English (machine-readable)
  return true;
}

// A saved design row as returned by trpc.design.myDesigns (loosely typed here
// since only a subset of fields is used in the picker).
type SavedDesignRow = {
  id: number;
  name: string;
  updatedAt: string | number | Date;
  placedCabinets?: unknown;
  roomData?: unknown;
  selectedSurfaces?: unknown;
  selectedStyleId?: number | null;
  projectName?: string | null;
  roomLabel?: string | null;
  roomType?: string | null;
};

interface ProjectGroup {
  key: string;
  projectName: string | null;
  rooms: SavedDesignRow[];
}

// Build + download a combined project CSV: one block per room + a grand total.
function downloadProjectCsv(
  projectName: string,
  summary: {
    rooms: { name: string; roomLabel: string | null; roomType: string | null; styleName: string | null; cabinetCount: number; subtotal: number }[];
    grandTotal: number;
  },
  brandName?: string | null,
) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  const brand = brandName?.trim() || "Cabinet Dealz";
  const slugBrand = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
  lines.push(`${brand} Project Plan`);
  lines.push(`Project:,${esc(projectName)}`);
  lines.push(`Rooms:,${summary.rooms.length}`);
  lines.push("");
  lines.push(["Room", "Type", "Door Style", "Cabinets", "Estimated Subtotal"].map(esc).join(","));
  for (const r of summary.rooms) {
    lines.push([
      r.roomLabel || r.name,
      r.roomType ?? "",
      r.styleName ?? "(not selected)",
      r.cabinetCount,
      r.subtotal.toFixed(2),
    ].map(esc).join(","));
  }
  lines.push("");
  lines.push(["", "", "", "Project Total", summary.grandTotal.toFixed(2)].map(esc).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugBrand}-project-${projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Project bill of materials exported", { description: `${summary.rooms.length} rooms` });
}

// Per-project totals expander used inside the My Designs dialog. Lazily queries
// the roll-up only when opened.
function ProjectTotals({ projectName, affiliateSlug, brandName }: { projectName: string; affiliateSlug?: string | null; brandName?: string | null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const summary = trpc.design.projectSummary.useQuery(
    { projectName, affiliateSlug: normalizeStoreScope(affiliateSlug) },
    { enabled: open },
  );
  return (
    <div className="px-1 pb-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-[#a87f33] hover:underline"
      >
        <Calculator className="h-3 w-3" /> {open ? t("dt_act_hide") : t("dt_act_view")} {t("dt_act_project_total_link")}
      </button>
      {open && (
        <div className="mt-1.5 rounded-md bg-muted/40 p-2 text-[11px]">
          {summary.isLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("dt_act_calculating")}
            </div>
          ) : summary.data ? (
            <>
              <div className="space-y-0.5">
                {summary.data.rooms.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {r.roomLabel || r.name}
                    </span>
                    <span className="tabular-nums">${r.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                <span>{t("dt_act_project_total")}</span>
                <span className="tabular-nums">${summary.data.grandTotal.toFixed(2)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full gap-1.5 text-[11px]"
                onClick={() => downloadProjectCsv(projectName, summary.data!, brandName)}
              >
                <Download className="h-3 w-3" /> {t("dt_act_download_project_csv")}
              </Button>
              <p className="mt-1 text-[9px] leading-tight text-muted-foreground">
                {t("dt_act_project_pricing_note")}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">{t("dt_act_no_totals")}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Group saved designs by projectName. Designs without a project fall into a
// single trailing "ungrouped" bucket (projectName = null). Project order follows
// the most-recently-updated room within each project.
export function groupByProject(rows: SavedDesignRow[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const r of rows) {
    const proj = (r.projectName ?? "").trim();
    const key = proj ? `p:${proj}` : "__ungrouped__";
    let g = groups.get(key);
    if (!g) {
      g = { key, projectName: proj || null, rooms: [] };
      groups.set(key, g);
    }
    g.rooms.push(r);
  }
  const ts = (r: SavedDesignRow) => new Date(r.updatedAt).getTime();
  const arr = Array.from(groups.values());
  for (const g of arr) g.rooms.sort((a, b) => ts(b) - ts(a));
  arr.sort((a, b) => {
    // Ungrouped bucket always last; otherwise newest project first.
    if (a.projectName === null) return 1;
    if (b.projectName === null) return -1;
    return ts(b.rooms[0]) - ts(a.rooms[0]);
  });
  return arr;
}

export function DesignActions({
  room, placed, openings, sinks, potFillers, island, furniture, ponyWalls, selectedSurfaces, threeDPresentation, styleId, lockedDistributorId, styleName, contactName, contactPhone, tier, total, extraLines, buildRows, roomType, contactEmail, affiliateSlug, currentDesignId, currentDesignName, currentPlanFingerprint, isCurrentPlanSaved = false, brandName, openSaveSignal, openLoadSignal, preSavePlanReview, onReviewPlanFinding, onSaveSuccess, onAutomaticSaveSuccess, onDeleteSuccess, onLoad,
}: Props) {
  const { user, isAuthenticated, loading: isAuthLoading, error: authError, refresh } = useAuth();
  const { t } = useLanguage();
  const storeScope = normalizeStoreScope(affiliateSlug);
  const utils = trpc.useUtils();
  const documentAccess = trpc.design.documentAccess.useQuery(
    { designId: currentDesignId ?? 1 },
    { enabled: isAuthenticated && currentDesignId != null, retry: false },
  );
  const hasFullDocumentAccess = user?.role === "admin" || documentAccess.data?.level === "full";
  const [saveOpen, setSaveOpen] = useState(false);
  const [planCheckOpen, setPlanCheckOpen] = useState(false);
  const [dismissedPlanFindingIds, setDismissedPlanFindingIds] = useState<string[]>([]);
  const [loadOpen, setLoadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [name, setName] = useState("");
  // Customer/House this plan is for (the CRM contact + grouping key). A homeowner
  // can leave it blank (their own project); a contractor names the customer/house.
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState(() => {
    const empty = { line1: "", line2: "", city: "", state: "", zip: "" };
    try { return { ...empty, ...JSON.parse(localStorage.getItem("cd-design-delivery-address") ?? "{}") }; } catch { return empty; }
  });
  const [showCustomerErrors, setShowCustomerErrors] = useState(false);
  useEffect(() => { setCustomerName((v) => v || contactName || user?.name || ""); }, [contactName, user?.name]);
  useEffect(() => { setCustomerPhone((v) => v || contactPhone || ""); }, [contactPhone]);
  useEffect(() => { setCustomerEmail((v) => v || contactEmail || user?.email || ""); }, [contactEmail, user?.email]);
  const customerErrors = (() => {
    const e: string[] = [];
    if (customerName.trim().length < 2) e.push("Customer name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) e.push("Customer email");
    if (customerPhone.replace(/\D/g, "").length < 10) e.push("Customer phone (10 digits)");
    if (customerAddress.line1.trim().length < 3) e.push("Street address");
    if (customerAddress.city.trim().length < 2) e.push("City");
    if (!/^[A-Za-z]{2}$/.test(customerAddress.state.trim())) e.push("2-letter state");
    if (customerAddress.zip.trim().length < 5) e.push("ZIP");
    return e;
  })();
  // Master Project grouping (optional): a job name + a room label.
  const [projectName, setProjectName] = useState("");
  const [roomLabel, setRoomLabel] = useState("");
  const isUpdatingExistingDesign = currentDesignId != null;
  useEffect(() => {
    if (isUpdatingExistingDesign && currentDesignName?.trim()) setName(currentDesignName.trim());
  }, [currentDesignName, isUpdatingExistingDesign]);
  // Open the Save / My Plans dialogs when a parent bumps the signal (mobile menu).
  useEffect(() => {
    if (!openSaveSignal) return;
    setDismissedPlanFindingIds([]);
    setPlanCheckOpen(true);
  }, [openSaveSignal]);
  useEffect(() => {
    if (!openLoadSignal) return;
    setLoadOpen(true);
    // Refresh the account check when My Designs opens so a newly returned
    // first-party session is not mistaken for an anonymous visitor.
    void refresh();
  }, [openLoadSignal]);
  // When checked, after saving we create a CRM deal for the design's owner.
  const [requestQuote, setRequestQuote] = useState(false);

  const quoteMutation = trpc.crm.requestQuoteFromDesign.useMutation({
    onSuccess: (r) => {
      toast.success(
        r.reused ? t("dt_act_quote_reused") : t("dt_act_quote_sent"),
        { description: t("dt_act_quote_desc") },
      );
    },
    onError: (e) =>
      toast.error(t("dt_act_quote_err"), { description: e.message }),
  });

  const saveMutation = trpc.design.save.useMutation({
    onSuccess: (res) => {
      const savedName = name || t("dt_act_saved_untitled");
      if (!res?.id) {
        toast.error(t("dt_act_save_err"), { description: "The design was saved but its plan reference was not returned. Please try saving once more." });
        return;
      }
      toast.success(isUpdatingExistingDesign ? "Design saved now" : t("dt_act_saved"), {
        id: "designer-manual-save",
        description: savedName,
      });
      onSaveSuccess?.(savedName, res.id);
      setSaveOpen(false);
      setName("");
      utils.design.myDesigns.invalidate({ affiliateSlug: storeScope });
      // Optionally request a quote from the design's owning CRM.
      if (requestQuote) {
        quoteMutation.mutate({
          designId: res.id,
          contactName: customerName.trim() || null,
          contactEmail: customerEmail.trim() || contactEmail || null,
          estimatedValue: total > 0 ? total : null,
        });
      }
      setRequestQuote(false);
    },
    onError: (e) => toast.error(t("dt_act_save_err"), { description: e.message }),
  });

  // A timer may only update a plan the customer has already explicitly named
  // and saved. New/incomplete work remains in the established local recovery
  // draft until the required manual Save fields are complete.
  const lastAutomaticSaveRef = useRef<{ id: number; fingerprint: string } | null>(null);
  const automaticSavePendingRef = useRef(false);
  const automaticSaveFailureNotifiedRef = useRef(false);
  const pendingAutomaticSaveRef = useRef<{ id: number; fingerprint: string } | null>(null);
  const automaticSaveMutation = trpc.design.autosave.useMutation({
    onSuccess: (result) => {
      const pending = pendingAutomaticSaveRef.current;
      if (!pending || result.id !== pending.id) return;
      lastAutomaticSaveRef.current = pending;
      automaticSaveFailureNotifiedRef.current = false;
      onAutomaticSaveSuccess?.(Date.now());
      void Promise.all([
        utils.design.byId.invalidate({ id: result.id, affiliateSlug: storeScope }),
        utils.design.myDesigns.invalidate({ affiliateSlug: storeScope }),
      ]);
    },
    onError: (error) => {
      if (automaticSaveFailureNotifiedRef.current) return;
      automaticSaveFailureNotifiedRef.current = true;
      toast.error("Automatic save could not reach the server", {
        description: "Your local recovery draft remains protected on this device. Use Save/Update after your connection returns.",
      });
      console.warn("[design] automatic save failed", error);
    },
    onSettled: () => {
      automaticSavePendingRef.current = false;
      pendingAutomaticSaveRef.current = null;
    },
  });
  const automaticSaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (currentDesignId == null || !currentPlanFingerprint || !isCurrentPlanSaved) return;
    lastAutomaticSaveRef.current = { id: currentDesignId, fingerprint: currentPlanFingerprint };
    automaticSaveFailureNotifiedRef.current = false;
  }, [currentDesignId, currentPlanFingerprint, isCurrentPlanSaved]);

  automaticSaveRef.current = () => {
    if (!isAuthenticated || currentDesignId == null || placed.length === 0 || !currentPlanFingerprint) return;
    if (isCurrentPlanSaved || automaticSavePendingRef.current) return;
    if (lastAutomaticSaveRef.current?.id === currentDesignId && lastAutomaticSaveRef.current.fingerprint === currentPlanFingerprint) return;
    if (!currentDesignName?.trim()) return;

    automaticSavePendingRef.current = true;
    pendingAutomaticSaveRef.current = { id: currentDesignId, fingerprint: currentPlanFingerprint };
    automaticSaveMutation.mutate({
      id: currentDesignId,
      affiliateSlug: storeScope,
      originScope: storeScope,
      roomData: roomWithPersistedEntities(room, { openings, sinks, potFillers, island, furniture, ponyWalls }),
      placedCabinets: placed,
      selectedSurfaces,
      threeDPresentation: threeDPresentation ?? undefined,
      selectedStyleId: styleId ?? undefined,
      selectedDistributorId: lockedDistributorId ?? undefined,
      roomType: roomType || undefined,
    });
  };

  useEffect(() => {
    const interval = window.setInterval(() => automaticSaveRef.current(), DESIGN_AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Only logged-in users can list their saved designs (protected procedure).
  const myDesigns = trpc.design.myDesigns.useQuery({ affiliateSlug: storeScope }, {
    enabled: isAuthenticated && loadOpen,
    retry: false,
  });

  const removeMutation = trpc.design.remove.useMutation({
    onSuccess: (result) => {
      setDeleteTarget(null);
      setLoadOpen(false);
      onDeleteSuccess?.(result.id, result.name);
      toast.success("Design permanently deleted", {
        description: `Started a new kitchen after deleting “${result.name}”. Choose a room layout to continue.`,
      });
      void Promise.all([
        utils.design.myDesigns.invalidate({ affiliateSlug: storeScope }),
        utils.design.byId.invalidate(),
        utils.design.documentAccess.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error("Could not delete this design", { description: error.message });
    },
  });

  const handleSave = () => {
    if (placed.length === 0) {
      toast.error(t("dt_act_err_save_empty"));
      return;
    }
    if (customerErrors.length > 0) {
      setShowCustomerErrors(true);
      toast.error("Customer details are required to save", { description: `Please complete: ${customerErrors.join(", ")}.` });
      return;
    }
    try { localStorage.setItem("cd-design-delivery-address", JSON.stringify(customerAddress)); } catch { /* storage unavailable */ }
    const proj = projectName.trim();
    const rlabel = roomLabel.trim();
    saveMutation.mutate({
      designValue: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : undefined,
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim(),
        address: {
          line1: customerAddress.line1.trim(),
          line2: customerAddress.line2.trim() || null,
          city: customerAddress.city.trim(),
          state: customerAddress.state.trim().toUpperCase(),
          zip: customerAddress.zip.trim(),
        },
      },
      id: currentDesignId ?? undefined,
      name: name.trim() || rlabel || proj || t("dt_act_untitled_design"),
      email: customerEmail.trim() || contactEmail || undefined,
      affiliateSlug: storeScope,
      originScope: storeScope,
      roomData: roomWithPersistedEntities(room, { openings, sinks, potFillers, island, furniture, ponyWalls }),
      placedCabinets: placed,
      selectedSurfaces,
      threeDPresentation: threeDPresentation ?? undefined,
      selectedStyleId: styleId ?? undefined,
      selectedDistributorId: lockedDistributorId ?? undefined,
      projectName: proj || undefined,
      roomLabel: rlabel || undefined,
      roomType: roomType || undefined,
    });
  };

  const handleExport = () => {
    if (!hasFullDocumentAccess) {
      toast.info("Detailed build sheets unlock after purchase", {
        description: "Save this plan and complete a paid cabinet order linked to it. Administrators and authorized affiliate teams retain full access.",
      });
      return;
    }
    exportBuildSheet({ room, styleName, tier, total, buildRows, extraLines, brandName });
  };

  const openPresentation = () => {
    const params = new URLSearchParams({ affiliate: storeScope });
    if (currentDesignId) params.set("designId", String(currentDesignId));
    window.open(`/design/presentation?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const openFabricatorSheet = () => {
    if (!hasFullDocumentAccess) {
      toast.info("Fabricator sheets are available to your project team", {
        description: "This supplier-ready document is available to administrators and authorized same-affiliate staff.",
      });
      return;
    }
    const search = currentDesignId ? `?designId=${encodeURIComponent(String(currentDesignId))}` : "";
    window.open(`/design/fabricator-sheet${search}`, "_blank", "noopener,noreferrer");
  };

  const activePlanFindings = (preSavePlanReview?.findings ?? []).filter((finding) => !dismissedPlanFindingIds.includes(finding.id));
  const openSaveAfterPlanCheck = () => {
    setPlanCheckOpen(false);
    setSaveOpen(true);
  };

  return (
    <>
      <Button variant="outline" size="icon" className="h-9 w-9" title={t("dt_act_my_designs_btn")} onClick={() => setLoadOpen(true)}>
        <FolderOpen className="h-4 w-4" />
      </Button>

      <Dialog open={planCheckOpen} onOpenChange={setPlanCheckOpen}>
        <DialogContent className="max-w-lg max-h-[82svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#a87f33]" />Plan check before saving</DialogTitle>
            <DialogDescription>
              Review measured suggestions and any open placement checks. Nothing changes until you choose an action.
            </DialogDescription>
          </DialogHeader>
          {activePlanFindings.length === 0 ? (
            <div data-testid="pre-save-plan-check-clear" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
              <p className="font-semibold">Plan checks complete</p>
              <p className="mt-1 text-xs">No remaining measured filler, refrigerator-upper, or placement items need review right now.</p>
            </div>
          ) : (
            <div data-testid="pre-save-plan-check-findings" className="space-y-2">
              {activePlanFindings.map((finding) => {
                const Icon = finding.severity === "attention" ? TriangleAlert : Lightbulb;
                return <div key={finding.id} className={`rounded-md border px-3 py-2.5 ${finding.severity === "attention" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex gap-2">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${finding.severity === "attention" ? "text-amber-700" : "text-[#a87f33]"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{finding.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" className="h-8" onClick={() => { setPlanCheckOpen(false); onReviewPlanFinding?.(finding); }}>{finding.actionLabel}</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setDismissedPlanFindingIds((ids) => [...ids, finding.id])}>Skip for now</Button>
                      </div>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPlanCheckOpen(false)}>Keep designing</Button>
            <Button onClick={openSaveAfterPlanCheck}><Save className="mr-1.5 h-4 w-4" />{activePlanFindings.length > 0 ? "Save without changes" : "Continue to save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="!flex h-[min(92dvh,900px)] max-h-[calc(100dvh-1rem)] w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden p-5 sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isUpdatingExistingDesign ? "Update saved design" : t("dt_act_save_title")}</DialogTitle>
            <DialogDescription>
              {isUpdatingExistingDesign
                ? "Save your latest changes to this shared plan. Viewers will see the update after they refresh."
                : t("dt_act_save_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-1 pr-1 [touch-action:pan-y]">
            <div className="space-y-1.5">
              <Label htmlFor="design-name" className="text-sm">{t("dt_act_design_name")}</Label>
              <Input
                id="design-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("dt_act_design_name_ph")}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                autoFocus
              />
            </div>
            <div className="rounded-lg border border-border p-3 space-y-2.5" data-testid="save-customer-details">
              <p className="text-xs font-semibold text-foreground">Customer details <span className="font-normal text-destructive">(all required — saved to the CRM)</span></p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="customer-name" className="text-[11px]">Customer name</Label>
                  <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" className="h-8 text-xs" aria-invalid={showCustomerErrors && customerName.trim().length < 2} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-email" className="text-[11px]">Email</Label>
                  <Input id="customer-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} autoComplete="email" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-phone" className="text-[11px]">Phone</Label>
                  <Input id="customer-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} autoComplete="tel" className="h-8 text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="customer-line1" className="text-[11px]">Street address</Label>
                  <Input id="customer-line1" value={customerAddress.line1} onChange={(e) => setCustomerAddress({ ...customerAddress, line1: e.target.value })} autoComplete="address-line1" className="h-8 text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="customer-line2" className="text-[11px]">Apt / suite (optional)</Label>
                  <Input id="customer-line2" value={customerAddress.line2} onChange={(e) => setCustomerAddress({ ...customerAddress, line2: e.target.value })} autoComplete="address-line2" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-city" className="text-[11px]">City</Label>
                  <Input id="customer-city" value={customerAddress.city} onChange={(e) => setCustomerAddress({ ...customerAddress, city: e.target.value })} autoComplete="address-level2" className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="customer-state" className="text-[11px]">State</Label>
                    <Input id="customer-state" maxLength={2} value={customerAddress.state} onChange={(e) => setCustomerAddress({ ...customerAddress, state: e.target.value.toUpperCase() })} autoComplete="address-level1" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customer-zip" className="text-[11px]">ZIP</Label>
                    <Input id="customer-zip" value={customerAddress.zip} onChange={(e) => setCustomerAddress({ ...customerAddress, zip: e.target.value })} autoComplete="postal-code" className="h-8 text-xs" />
                  </div>
                </div>
              </div>
              {showCustomerErrors && customerErrors.length > 0 && (
                <p role="alert" className="text-[11px] text-destructive">Still needed: {customerErrors.join(", ")}.</p>
              )}
            </div>
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2.5 bg-muted/20">
              <p className="text-[11px] font-semibold text-foreground">
                {t("dt_act_master_project")} <span className="font-normal text-muted-foreground">{t("dt_act_optional")}</span>
              </p>
              <p className="text-[11px] text-muted-foreground -mt-1">
                {t("dt_act_master_project_desc")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="project-name" className="text-[11px]">{t("dt_act_customer_house")}</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t("dt_act_project_job_ph")}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="room-label" className="text-[11px]">{t("dt_act_room_plan")}</Label>
                  <Input
                    id="room-label"
                    value={roomLabel}
                    onChange={(e) => setRoomLabel(e.target.value)}
                    placeholder={t("dt_act_room_in_project_ph")}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            {isAuthenticated && (
              <label
                htmlFor="request-quote"
                className="flex items-start gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <input
                  id="request-quote"
                  type="checkbox"
                  checked={requestQuote}
                  onChange={(e) => setRequestQuote(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-[11px] leading-snug">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Send className="h-3 w-3" /> {t("dt_act_send_rep")}
                  </span>
                  <span className="text-muted-foreground">
                    {t("dt_act_send_rep_desc")}
                    {total > 0 ? t("dt_act_send_rep_est", { total: total.toLocaleString() }) : "."}
                  </span>
                </span>
              </label>
            )}
            {!isAuthenticated && (
              <p className="text-[11px] text-muted-foreground">
                {t("dt_act_signin_tip")}
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-border pt-3 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>{t("dt_act_cancel")}</Button>
            {isAuthenticated ? (
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isUpdatingExistingDesign ? "Update" : t("dt_act_save_design")}
              </Button>
            ) : (
              <Button asChild className="gap-1.5">
                <a href={getLoginUrl()}>Sign in to save</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My designs dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dt_act_my_saved_title")}</DialogTitle>
            <DialogDescription>{t("dt_act_my_saved_desc")}</DialogDescription>
          </DialogHeader>

          {isAuthLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> {t("dt_act_loading")}
            </div>
          ) : !isAuthenticated ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{authError ? "We could not confirm your session for this shop." : t("dt_act_signin_to_view")}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
                  Check account again
                </Button>
                <Button type="button" size="sm" asChild>
                  <a href={getLoginUrl()}>Sign in again</a>
                </Button>
              </div>
            </div>
          ) : myDesigns.isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> {t("dt_act_loading")}
            </div>
          ) : myDesigns.isError ? (
            <div className="py-6 text-center text-sm text-destructive">
              {t("dt_act_load_err")}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => myDesigns.refetch()}>{t("dt_act_retry")}</Button>
              </div>
            </div>
          ) : !myDesigns.data || myDesigns.data.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("dt_act_no_saved")}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-3">
              {groupByProject(myDesigns.data).map((group) => (
                <div key={group.key}>
                  {group.projectName && (
                    <div className="flex items-center gap-1.5 px-1 pb-1">
                      <FolderOpen className="h-3.5 w-3.5 text-[#a87f33]" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {group.projectName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {group.rooms.length} {group.rooms.length === 1 ? t("dt_act_room_one") : t("dt_act_room_many")}
                      </span>
                    </div>
                  )}
                  {group.projectName && <ProjectTotals projectName={group.projectName} affiliateSlug={affiliateSlug} brandName={brandName} />}
                  <div className={`space-y-1.5 ${group.projectName ? "pl-2 border-l-2 border-[#a87f33]/30" : ""}`}>
                    {group.rooms.map((d) => {
                      const items = Array.isArray(d.placedCabinets) ? d.placedCabinets.length : 0;
                      const rType = (d as { roomType?: string | null }).roomType;
                      const rLabel = (d as { roomLabel?: string | null }).roomLabel;
                      return (
                        <div key={d.id} className="flex items-stretch gap-1.5">
                          <button
                            className="min-w-0 flex-1 text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              onLoad({
                                id: d.id,
                                room: (d.roomData as RoomData) ?? room,
	                              placed: (d.placedCabinets as PlacedCabinet[]) ?? [],
                              styleId: d.selectedStyleId ?? null,
                              distributorId: (d as { selectedDistributorId?: number | null }).selectedDistributorId ?? null,
                              roomType: rType ?? null,
                              selectedSurfaces: Array.isArray(d.selectedSurfaces) ? d.selectedSurfaces : null,
                              threeDPresentation: (d as { threeDPresentation?: {
                                cabinetFinish?: string;
                                countertopFinish?: string;
                                backsplashEnabled?: boolean;
                                backsplashHeightMode?: "standard" | "full-height";
                                countertopBacksplashHeightIn?: 0 | 2.5 | 3;
                              } | null }).threeDPresentation ?? null,
                              });
                              setLoadOpen(false);
                              toast.success(t("dt_act_loaded", { name: d.name }));
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{rLabel || d.name}</span>
                              {rType && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                                  {rType}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{items} {items === 1 ? t("dt_act_item_one") : t("dt_act_item_many")}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(d.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-auto min-h-[3.75rem] w-10 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete saved design ${d.name}`}
                            title="Delete saved design"
                            data-testid={`delete-saved-design-${d.id}`}
                            onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => { if (!open && !removeMutation.isPending) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this saved design?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be permanently deleted. Its local draft and active Designer state will also be cleared, and a new blank design will start.`
                : "This saved design will be permanently deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={removeMutation.isPending} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteTarget || removeMutation.isPending}
              data-testid="confirm-delete-saved-design"
              onClick={() => {
                if (!deleteTarget) return;
                removeMutation.mutate({ id: deleteTarget.id, affiliateSlug: storeScope });
              }}
            >
              {removeMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Delete and start new design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export build sheet */}
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleExport} title={hasFullDocumentAccess ? t("dt_act_export_btn") : "Detailed build sheet unlocks after paid order"}>
        <Download className="h-3.5 w-3.5" />
      </Button>
      {/* Print Presentation */}
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={openPresentation} title={t("dt_act_presentation_btn")}>
        <Printer className="h-3.5 w-3.5" />
      </Button>
      {/* Fabricator Countertop Sheet */}
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={openFabricatorSheet} title={hasFullDocumentAccess ? t("dt_act_fabricator_btn") : "Fabricator sheet is available to authorized project staff"}>
        <Ruler className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
