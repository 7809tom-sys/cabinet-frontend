import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Minus, Plus, DoorOpen, DoorClosed, Droplets, GitMerge, Link2, AlertTriangle, CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PlacedCabinet,
  type CabinetHardwarePosition,
  hasDoorSwing,
  resolveSwing,
  resolveCabinetHardwarePosition,
  supportsCenteredTopDoorPull,
  usesRaisedFloorWallDoorPull,
  isCounterHeightIslandWallCabinet,
  islandWallCabinetBaseTreatment,
  type IslandWallCabinetBaseTreatment,
  placedHeight,
  isCustomWidth,
  isCustomHeight,
  isCustomDepth,
  isBaseBlindCorner,
  blindPullRange,
  fillerWidthRange,
	  isKneeDrawerItem,
	  isRefrigerator,
	  isGlassPolicyNomenclature,
	  STD,
  KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN,
  KNEE_DRAWER_DEFAULT_MOUNT_BOTTOM_IN,
  KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN,
} from "@/lib/design";
import { cabinetDrawingType } from "@/lib/cabinetGraphics";
import { CUSTOM_CABINET_PROFILES } from "@/lib/customCabinetProfiles";
import { RollOutTrayPicker } from "@/components/design/RollOutTrayPicker";
import { CABINET_ATTRIBUTES_DIALOG_CLASS } from "@/lib/cabinetAttributesDialogLayout";
import { cabinetEditConfigLink } from "@/lib/cabinetEditConfigLink";
import { masterTracProduct, MASTERTRAC_PRICE_DATE } from "@/lib/closet";
import { trpc } from "@/lib/trpc";
import type { PricingTier } from "@shared/pricingTier";

export const MIN_CABINET_DEPTH_MOVE_IN = 0.125;
export const MAX_CABINET_DEPTH_MOVE_IN = 120;
const DEPTH_MOVE_FRACTION_GLYPHS: Record<string, number> = {
  "⅛": 0.125,
  "¼": 0.25,
  "⅜": 0.375,
  "½": 0.5,
  "⅝": 0.625,
  "¾": 0.75,
  "⅞": 0.875,
};

export function parsedCabinetDepthMoveDistance(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/(?:in(?:ches?)?|["″])$/i, "").trim();
  if (!text) return null;
  const glyph = text.match(/^(\d+(?:\.\d+)?)?\s*([⅛¼⅜½⅝¾⅞])$/);
  if (glyph) return Number(glyph[1] || 0) + DEPTH_MOVE_FRACTION_GLYPHS[glyph[2]];
  const mixed = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0 ? Number(mixed[1]) + Number(mixed[2]) / denominator : null;
  }
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizedCabinetDepthMoveDistance(value: unknown): number {
  const parsed = parsedCabinetDepthMoveDistance(value);
  if (parsed == null) return 1;
  const bounded = Math.min(MAX_CABINET_DEPTH_MOVE_IN, Math.max(MIN_CABINET_DEPTH_MOVE_IN, parsed));
  return Math.round(bounded * 8) / 8;
}

export function CabinetDepthMoveControls({
  onMove,
}: {
  onMove: (direction: "in" | "out", distanceIn: number) => void;
}) {
  const [distanceText, setDistanceText] = useState("1");
  const distance = normalizedCabinetDepthMoveDistance(distanceText);
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="cabinet-depth-move-controls">
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Depth move distance
        <span className="flex items-center gap-1">
          <Input
            type="text"
            inputMode="decimal"
            value={distanceText}
            className="h-9 w-24 text-center font-mono text-sm"
            aria-label="Depth move distance in inches"
            onChange={(event) => setDistanceText(event.target.value)}
            onBlur={() => setDistanceText(String(distance))}
          />
          <span className="text-xs">in.</span>
        </span>
      </label>
      <Button type="button" variant="outline" size="sm" className="h-9 min-w-[116px]" title={`Move out ${distance} inches toward the wall`} onClick={() => onMove("out", distance)}>Move Out {distance}″</Button>
      <Button type="button" variant="outline" size="sm" className="h-9 min-w-[106px]" title={`Move in ${distance} inches into the room`} onClick={() => onMove("in", distance)}>Move In {distance}″</Button>
    </div>
  );
}

export type CabinetWallPosition = {
  /** Human-readable selected run name, e.g. "Wall 2" or "Peninsula return". */
  wallLabel: string;
  /** Full measured length of the selected wall run, in inches. */
  wallLengthIn: number;
  /** Cabinet's exact measured start offset from this wall's start vertex. */
  offsetIn: number;
  /** Largest offset that keeps the entire cabinet on the measured run. */
  maxOffsetIn: number;
};

/** Measured clearance around a corner cabinet on its owning wall run. */
export type CabinetCornerClearance = {
  wallLabel: string;
  angle: 45 | 90;
  placement: "flush" | "clearance";
  requiredClearanceIn: number;
  startGapIn: number;
  endGapIn: number;
};

export function CabinetCornerClearancePanel({
  clearance,
}: {
  clearance: CabinetCornerClearance;
}) {
  const measured = (value: number) => `${Math.round(Math.max(0, value) * 8) / 8}″`;
  const hasRequiredSetback = clearance.requiredClearanceIn > 0;
  return (
    <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3" data-testid="cabinet-corner-clearance">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-emerald-950">Corner clearance</h4>
          <p className="text-[11px] text-emerald-900/80">
            {clearance.angle}° corner on {clearance.wallLabel} · {clearance.placement === "flush" ? "flush seated" : "inside-corner setback"}
          </p>
        </div>
        <Badge variant="secondary" className="border border-emerald-300 bg-white text-[10px] text-emerald-900">
          {hasRequiredSetback ? `${measured(clearance.requiredClearanceIn)} required` : "0″ required"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-emerald-200 bg-white/80 px-2.5 py-2">
          <span className="block text-[10px] uppercase tracking-wide text-emerald-900/70">Wall start gap</span>
          <span className="font-mono font-semibold text-emerald-950">{measured(clearance.startGapIn)}</span>
        </div>
        <div className="rounded border border-emerald-200 bg-white/80 px-2.5 py-2">
          <span className="block text-[10px] uppercase tracking-wide text-emerald-900/70">Wall end gap</span>
          <span className="font-mono font-semibold text-emerald-950">{measured(clearance.endGapIn)}</span>
        </div>
      </div>
      <p className="text-[11px] text-emerald-900/80">
        {hasRequiredSetback
          ? `This 45° peninsula turn requires ${measured(clearance.requiredClearanceIn)} from the inside corner. Ordinary 90° corners remain flush.`
          : "This is a normal 90° or non-peninsula angled corner; no artificial setback is applied."}
      </p>
    </section>
  );
}

/**
 * Exact along-wall placement for a cabinet or appliance.  A wall can be
 * horizontal, vertical, or diagonal, so the controls deliberately use the
 * wall's measured start/end—not screen-relative left/right directions.
 */
export function CabinetWallPositionControls({
  position,
  onSetOffset,
}: {
  position: CabinetWallPosition;
  onSetOffset: (offsetIn: number) => void;
}) {
  const [offsetText, setOffsetText] = useState(String(Math.round(position.offsetIn * 8) / 8));
  const [movementText, setMovementText] = useState("1");
  useEffect(() => {
    setOffsetText(String(Math.round(position.offsetIn * 8) / 8));
  }, [position.offsetIn]);

  const movementDistance = normalizedCabinetDepthMoveDistance(movementText);
  const clampOffset = (value: number) => Math.max(0, Math.min(position.maxOffsetIn, Math.round(value * 8) / 8));
  const commitOffset = () => {
    const parsed = parsedCabinetDepthMoveDistance(offsetText);
    if (parsed == null) {
      setOffsetText(String(Math.round(position.offsetIn * 8) / 8));
      return;
    }
    const next = clampOffset(parsed);
    onSetOffset(next);
    setOffsetText(String(next));
  };
  const nudge = (direction: "start" | "end") => {
    const next = clampOffset(position.offsetIn + (direction === "start" ? -movementDistance : movementDistance));
    onSetOffset(next);
  };
  const center = () => onSetOffset(clampOffset(position.maxOffsetIn / 2));

  return (
    <div className="space-y-2" data-testid="cabinet-wall-position-controls">
      <div className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-950">
        <span className="font-semibold">Selected run: {position.wallLabel}</span>
        <span className="text-amber-900/80"> · {Math.round(position.wallLengthIn * 8) / 8}″ measured</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Position from wall start corner
          <span className="flex items-center gap-1">
            <Input
              type="text"
              inputMode="decimal"
              value={offsetText}
              className="h-9 w-24 text-center font-mono text-sm"
              aria-label="Cabinet position from wall start in inches"
              onChange={(event) => setOffsetText(event.target.value)}
              onBlur={commitOffset}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              }}
            />
            <span className="text-xs">in.</span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Movement distance
          <span className="flex items-center gap-1">
            <Input
              type="text"
              inputMode="decimal"
              value={movementText}
              className="h-9 w-20 text-center font-mono text-sm"
              aria-label="Cabinet movement distance in inches"
              onChange={(event) => setMovementText(event.target.value)}
              onBlur={() => setMovementText(String(movementDistance))}
            />
            <span className="text-xs">in.</span>
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-label="Move cabinet toward wall start"
          title={`Move ${movementDistance} inches toward ${position.wallLabel}'s start corner`}
          disabled={position.offsetIn <= 0.001}
          onClick={() => nudge("start")}
        >
          Toward start −{movementDistance}″
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-label="Move cabinet toward wall end"
          title={`Move ${movementDistance} inches toward ${position.wallLabel}'s end corner`}
          disabled={position.offsetIn >= position.maxOffsetIn - 0.001}
          onClick={() => nudge("end")}
        >
          Toward end +{movementDistance}″
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-label="Center cabinet on wall"
          onClick={center}
        >
          Center on run
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Use wall start/end because this measured wall may be vertical or diagonal. Position is kept to the nearest ⅛ inch and remains collision-safe.</p>
    </div>
  );
}

// A single dimension stepper (−/value/+) used inside the dialog.
function Dim({
  label,
  value,
  custom,
  min,
  max,
  step = 1,
  inputStep = 0.25,
  snapTypedValue = false,
  onSet,
}: {
  label: string;
  value: number;
  custom: boolean;
  min: number;
  max: number;
  step?: number;
  inputStep?: number;
  snapTypedValue?: boolean;
  onSet: (v: number) => void;
}) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const full =
    label === "W" ? t("dt_ca_width") : label === "H" ? t("dt_ca_height") : t("dt_ca_depth");
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{t("dt_ca_dim_unit", { name: full })}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title={t("dt_ca_dim_dec", { name: full })}
          onClick={() => onSet(Math.max(min, Math.round((value - step) / step) * step))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          type="number"
          step={inputStep}
          min={min}
          max={max}
          value={value}
          className={cn(
            "h-8 w-20 text-center text-sm",
            custom && "font-semibold text-[var(--color-gold,#c89b3c)]"
          )}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) {
              const next = snapTypedValue ? Math.round(v / step) * step : v;
              onSet(Math.max(min, Math.min(max, next)));
            }
          }}
          aria-label={t("dt_ca_dim_aria", { name: full })}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title={t("dt_ca_dim_inc", { name: full })}
          onClick={() => onSet(Math.min(max, Math.round((value + step) / step) * step))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export interface CabinetAttributesDialogProps {
  cabinet: PlacedCabinet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cabinet belongs to a persisted, safely editable Peninsula Wizard assembly. */
  wizardBuiltEditable?: boolean;
  /** Opens the assembly's exact Wizard recipe without altering this cabinet first. */
  onJumpToWizard?: (uid: string) => void;
  customFee: number;
  onSetWidth: (uid: string, v: number) => void;
  onSetHeight: (uid: string, v: number) => void;
  onSetDepth: (uid: string, v: number) => void;
  mountBottom?: number | null;
  maxMountBottom?: number;
  onSetMountBottom?: (uid: string, v: number) => void;
  onMoveInOut?: (uid: string, direction: "in" | "out", distanceIn: number) => void;
  wallPosition?: CabinetWallPosition | null;
  onSetWallOffset?: (uid: string, offsetIn: number) => void;
	  cornerClearance?: CabinetCornerClearance | null;
	  /** Opens the source-backed refrigerator surround selector for this appliance. */
	  onSetRefrigeratorSidePanels?: (uid: string, enabled: boolean) => void;
	  /** A saved refrigerator requested panels but has no actual source SKU placements yet. */
	  refrigeratorPanelsRequestedButMissing?: boolean;
  onResetSize: (uid: string) => void;
  onSetSwing: (uid: string, swing: "left" | "right" | "double") => void;
  onSetNoDoor: (uid: string, noDoor: boolean) => void;
  onSetHandleSide: (uid: string, side: CabinetHardwarePosition) => void;
  onApplyHandleSideToAll?: (side: CabinetHardwarePosition) => void;
  hardwareApplyCount?: number;
  // Per-cabinet roll-out shelf add-on: the design's default door style + locked
  // line let the picker resolve the correct same-line RS shelf, and onSetRolloutQty
  // persists the (unlimited) quantity onto the cabinet.
	  designStyleId: number | null;
	  distributorId: number | null;
	  pricingTier: PricingTier;
  onSetRolloutQty: (uid: string, qty: number) => void;
  // Glass door upgrade toggle
  onSetGlassDoor: (uid: string, glassDoor: boolean) => void;
  onSetDecorativeEnd: (uid: string, treatment: "none" | "left" | "right" | "both") => void;
  glassDoorAvailable: boolean;
  // Glass door add-on: add the separate glass door SKU to the cart
  onAddGlassDoorToCart: (uid: string) => void;
  // Blind corner pull distance
  onSetBlindPull: (uid: string, pull: number) => void;
  // Waterfall countertop edge
  onSetWaterfall: (uid: string, side: "left" | "right", enabled: boolean) => void;
  // Category / subCategory override — lets the user re-classify a cabinet
  // (e.g. change Base → Vanity, or update the subCategory label).
  onSetCategory: (uid: string, category: string, subCategory: string | null) => void;
  // Per-design drawing-profile override for non-standard and end cabinets.
  onSetCustomProfile: (uid: string, profile: string | null) => void;
  // Owner-only link to the persistent Cabinet Config record for this SKU.
  masterConfigHref?: string;
  // Persists the selected design's category and drawing rule to its master SKU.
  onSaveMasterConfig?: (cabinet: PlacedCabinet) => void;
  savingMasterConfig?: boolean;
  // Oven type: single or double — only shown for oven-tall cabinets
  onSetOvenType: (uid: string, ovenType: "single" | "double") => void;
  // Floor finish for a shallow wall cabinet used as a counter-height island face.
  onSetIslandWallBaseTreatment: (uid: string, treatment: IslandWallCabinetBaseTreatment) => void;
  /** Optional regular-Designer attached-filler choices for this cabinet's current bounded run. */
  attachedFillerOptions?: {
    leftAllowed: boolean;
    rightAllowed: boolean;
    leftIn: number;
    rightIn: number;
    needsReview?: boolean;
  } | null;
  onApplyAttachedFillers?: (uid: string, choice: { leftIn: number; rightIn: number }) => void;
}

export function CabinetAttachedFillerControls({
  value,
  onApply,
}: {
  value: NonNullable<CabinetAttributesDialogProps["attachedFillerOptions"]>;
  onApply: (choice: { leftIn: number; rightIn: number }) => void;
}) {
  const [leftText, setLeftText] = useState(String(value.leftIn || ""));
  const [rightText, setRightText] = useState(String(value.rightIn || ""));
  useEffect(() => {
    setLeftText(String(value.leftIn || ""));
    setRightText(String(value.rightIn || ""));
  }, [value.leftIn, value.rightIn]);
  const read = (text: string) => {
    const amount = Number(text);
    return Number.isFinite(amount) && amount > 0 ? Math.min(6, Math.max(0.125, Math.round(amount * 8) / 8)) : 0;
  };
  const leftIn = read(leftText);
  const rightIn = read(rightText);
  return (
    <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3" data-testid="cabinet-attached-filler-controls">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-amber-950">Attached fillers</h4>
          <p className="text-[11px] text-amber-900/80">Choose ⅛″–6″ installed cuts only where this cabinet meets a wall or another cabinet. Short cuts use real CabinetDealz filler stock.</p>
        </div>
        {value.needsReview && <Badge className="border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10">Review exposed filler</Badge>}
      </div>
      {!value.leftAllowed && !value.rightAllowed ? (
        <p className="rounded border border-amber-200 bg-white/80 px-2.5 py-2 text-xs text-amber-950">No attached filler is available because both visible ends are exposed.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {value.leftAllowed && <label className="grid gap-1 text-xs font-semibold text-amber-950">Left filler (in.)
              <Input aria-label="Left attached filler size in inches" type="number" inputMode="decimal" min="0.125" max="6" step="0.125" value={leftText} placeholder="None" onChange={(event) => setLeftText(event.target.value)} />
            </label>}
            {value.rightAllowed && <label className="grid gap-1 text-xs font-semibold text-amber-950">Right filler (in.)
              <Input aria-label="Right attached filler size in inches" type="number" inputMode="decimal" min="0.125" max="6" step="0.125" value={rightText} placeholder="None" onChange={(event) => setRightText(event.target.value)} />
            </label>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onApply({ leftIn, rightIn })}>Update attached fillers</Button>
            {(value.leftIn > 0 || value.rightIn > 0) && <Button type="button" size="sm" variant="outline" onClick={() => onApply({ leftIn: 0, rightIn: 0 })}>Remove attached fillers</Button>}
          </div>
        </>
      )}
    </section>
  );
}

// Right-click attributes editor for a single placed cabinet (email item 1):
// resize H/D/W, remove the door, change the door swing (L/R), set the handle
// position, and add roll-out trays. Everything here targets the cabinet the
// dialog was opened on (by uid), independent of keyboard selection.
export function CabinetAttributesDialog({
  cabinet,
  open,
  onOpenChange,
  wizardBuiltEditable = false,
  onJumpToWizard,
  customFee,
  onSetWidth,
  onSetHeight,
  onSetDepth,
  mountBottom,
  maxMountBottom,
  onSetMountBottom,
  onMoveInOut,
  wallPosition,
	  onSetWallOffset,
		  cornerClearance,
		  onSetRefrigeratorSidePanels,
		  refrigeratorPanelsRequestedButMissing = false,
	  onResetSize,
  onSetSwing,
  onSetNoDoor,
  onSetHandleSide,
  onApplyHandleSideToAll,
  hardwareApplyCount = 0,
  designStyleId,
	  distributorId,
	  pricingTier,
  onSetRolloutQty,
  onSetGlassDoor,
  onSetDecorativeEnd,
  glassDoorAvailable,
  onAddGlassDoorToCart,
  onSetBlindPull,
  onSetWaterfall,
  onSetCategory,
  onSetCustomProfile,
  masterConfigHref,
  onSaveMasterConfig,
  savingMasterConfig,
  onSetOvenType,
  onSetIslandWallBaseTreatment,
  attachedFillerOptions,
  onApplyAttachedFillers,
}: CabinetAttributesDialogProps) {
	  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [pendingMasterId, setPendingMasterId] = useState<number | null>(null);
  const swing = useMemo(() => (cabinet ? resolveSwing(cabinet) : "double"), [cabinet]);
  const masterCode = cabinet?.masterCode ?? "";
  const cabinetId = cabinet?.cabinetId ?? 0;
  const isMasterAdmin = Boolean(masterConfigHref && cabinet?.cabinetId);
  const editConfigLink = cabinetEditConfigLink(masterConfigHref);
  const aliasesQuery = trpc.masterSku.getAliasesForCabinet.useQuery(
    { masterCode },
    { enabled: isMasterAdmin }
  );
  const similarQuery = trpc.masterSku.similarForCabinet.useQuery(
    { cabinetId },
    { enabled: isMasterAdmin }
  );
  const utils = trpc.useUtils();
  const mergeMutation = trpc.masterSku.confirmCabinetLink.useMutation({
    onSuccess: () => {
      setPendingMasterId(null);
      utils.masterSku.getAliasesForCabinet.invalidate({ masterCode });
      utils.masterSku.similarForCabinet.invalidate({ cabinetId });
    },
  });

  if (!cabinet) return null;

  const uid = cabinet.uid;
  const canSwing = hasDoorSwing(cabinet) && swing !== "double";
  const isDouble = swing === "double";
  const noDoor = !!cabinet.noDoor;
  const hardwarePosition = resolveCabinetHardwarePosition(cabinet);
  const canUseCenteredTopPull = supportsCenteredTopDoorPull(cabinet);
  const usesAutomaticRaisedPull = usesRaisedFloorWallDoorPull(cabinet);
  const isIslandWallCabinet = isCounterHeightIslandWallCabinet(cabinet);
  const islandBaseTreatment = islandWallCabinetBaseTreatment(cabinet);
	  const isBase = cabinet.placement === "base";
	  const isKneeDrawer = cabinet.placement === "baseTop" && isKneeDrawerItem(cabinet);
  const kneeDrawerBaseBodyAlignBottom = isKneeDrawer
    ? Math.min(KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN, Math.max(KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN, STD.BASE_HEIGHT - placedHeight(cabinet)))
    : null;
	  const canMoveMount = (cabinet.placement === "wall" || isKneeDrawer) && typeof mountBottom === "number" && typeof onSetMountBottom === "function";
	  const canMoveInOut = typeof onMoveInOut === "function";
	  const canMoveAlongWall = Boolean(wallPosition && typeof onSetWallOffset === "function");
	  const isRefrigeratorCabinet = isRefrigerator(cabinet);
	  const hasRefrigeratorSidePanels = cabinet.refrigeratorPanelMode === "both" && !refrigeratorPanelsRequestedButMissing;
  const custom =
    isCustomWidth(cabinet) || isCustomHeight(cabinet) || isCustomDepth(cabinet);
  const masterTrac = masterTracProduct(cabinet.masterCode);
  if (masterTrac?.placeable) {
    const isShelf = masterTrac.shape === "shelf";
    const canMoveBoard = cabinet.placement === "wall" && typeof mountBottom === "number" && typeof onSetMountBottom === "function";
    const topLimit = Math.max(0, maxMountBottom ?? 120);
    const boardControls = (
      <div className="space-y-4 p-4" data-testid="mastertrac-attributes">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <div className="font-semibold">{masterTrac.description} · {masterTrac.finish}</div>
          <div className="mt-1 text-xs text-stone-600">Purchased stock: {masterTrac.widthIn}″ W × {masterTrac.heightIn}″ H × {masterTrac.depthIn}″ D · ¾″ board</div>
          {cabinet.masterTracShelfCut ? <div data-testid="mastertrac-attributes-cut" className="mt-1 text-xs font-semibold text-amber-900">Installed clear width: {cabinet.masterTracShelfCut.installedWidthIn}″ · offcut {cabinet.masterTracShelfCut.offcutIn}″. Edit the connected tower to change the stock SKU or cut. Manufacturer templates and field reboring are required; this 3D view is not a cutting guide.</div> : <div className="mt-1 text-xs text-stone-600">SKU dimensions are fixed; select a different material number to change the board size.</div>}
          <div className="mt-2 text-xs font-semibold">${masterTrac.listEachUsd.toFixed(2)} List / each <span className="font-normal text-stone-500">({MASTERTRAC_PRICE_DATE})</span></div>
        </div>
        {canMoveBoard && (
          <div className="space-y-2" data-testid="mastertrac-shelf-height">
            <div className="font-semibold">{isShelf ? "Shelf elevation" : "Hanging-panel elevation"}</div>
            <p className="text-xs text-muted-foreground">Move this {isShelf ? "shelf" : "panel"} up or down. The number is the bottom edge above the finished floor; elevation and 3D update together.</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" aria-label={isShelf ? "Lower shelf one inch" : "Lower panel one inch"} onClick={() => onSetMountBottom(uid, Math.max(0, mountBottom - 1))}><Minus className="h-4 w-4" /></Button>
              <Input type="number" min={0} max={topLimit} step={0.125} value={mountBottom} aria-label={isShelf ? "Shelf bottom height in inches" : "Panel bottom height in inches"} className="w-24 text-center" onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) onSetMountBottom(uid, Math.max(0, Math.min(topLimit, value))); }} />
              <span className="text-xs text-muted-foreground">in. from floor</span>
              <Button type="button" variant="outline" size="sm" aria-label={isShelf ? "Raise shelf one inch" : "Raise panel one inch"} onClick={() => onSetMountBottom(uid, Math.min(topLimit, mountBottom + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
            {isShelf && <div className="flex flex-wrap gap-1.5">{[24, 36, 48, 60, 72].filter((height) => height <= topLimit).map((height) => <Button key={height} type="button" variant={Math.abs(mountBottom - height) < 0.01 ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => onSetMountBottom(uid, height)}>{height}″</Button>)}</div>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Brochure-inspired 3D board in the named finish. Confirm compatible rails and hardware before installation.</p>
      </div>
    );
    return isMobile ? (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="border-b p-4 text-left"><SheetTitle>MasterTrac {cabinet.masterCode}</SheetTitle><SheetDescription>{masterTrac.description}</SheetDescription></SheetHeader>
          {boardControls}
          <div className="border-t p-4"><Button type="button" className="w-full" onClick={() => onOpenChange(false)}>Done</Button></div>
        </SheetContent>
      </Sheet>
    ) : (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>MasterTrac {cabinet.masterCode}</DialogTitle><DialogDescription>{masterTrac.description}</DialogDescription></DialogHeader>{boardControls}</DialogContent>
      </Dialog>
    );
  }
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 flex flex-col gap-0" style={{ maxHeight: "min(90vh, calc(100dvh - 4rem))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="font-mono text-base leading-none">{cabinet.masterCode}</SheetTitle>
            <SheetDescription className="truncate text-xs">{cabinet.description}</SheetDescription>
          <div data-testid="cabinet-attributes-active-target" className="mt-1 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 shadow-sm ring-2 ring-amber-200/70 motion-safe:animate-pulse">
            <span className="shrink-0 rounded bg-[#1a2744] px-1.5 py-0.5 font-mono font-bold text-white">{cabinet.masterCode}</span>
            <span><strong>Editing this cabinet</strong></span>
          </div>
          {wizardBuiltEditable && onJumpToWizard && (
            <div data-testid="cabinet-wizard-jump-panel" className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-left">
              <Badge className="bg-emerald-800 text-[10px] font-bold tracking-wide text-white hover:bg-emerald-800">WIZARD-BUILT · EDITABLE</Badge>
              <p className="mt-1 text-[11px] leading-4 text-emerald-950">This cabinet belongs to an editable Peninsula Wizard assembly.</p>
              <Button type="button" variant="outline" size="sm" data-testid="jump-to-peninsula-wizard" className="mt-2 w-full border-emerald-700 bg-white text-emerald-950 hover:bg-emerald-100" onClick={() => onJumpToWizard(uid)}>Jump to Wizard</Button>
            </div>
          )}
          {editConfigLink && (
              <a
                href={editConfigLink.href}
                target={editConfigLink.target}
                rel={editConfigLink.rel}
                className="w-fit text-xs font-medium text-amber-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
              >
                Edit Config ↗
              </a>
            )}
          </SheetHeader>
	          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
	            {attachedFillerOptions && onApplyAttachedFillers && (
	              <CabinetAttachedFillerControls
	                value={attachedFillerOptions}
	                onApply={(choice) => onApplyAttachedFillers(uid, choice)}
	              />
	            )}
	            <div className="rounded-lg border border-border p-4 bg-muted/20 text-sm text-center text-muted-foreground">
	              Please use a tablet or desktop computer to access full cabinet attributes.
	            </div>
          </div>
          <div className="border-t p-4">
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              {t("dt_ca_done")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CABINET_ATTRIBUTES_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{cabinet.masterCode}</DialogTitle>
          <DialogDescription className="truncate">{cabinet.description}</DialogDescription>
          <div data-testid="cabinet-attributes-active-target" className="mt-1 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 shadow-sm ring-2 ring-amber-200/70 motion-safe:animate-pulse">
            <span className="shrink-0 rounded bg-[#1a2744] px-1.5 py-0.5 font-mono font-bold text-white">{cabinet.masterCode}</span>
            <span><strong>Editing this cabinet</strong> — it is highlighted in the active Designer view.</span>
          </div>
          {wizardBuiltEditable && onJumpToWizard && (
            <div data-testid="cabinet-wizard-jump-panel" className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Badge className="bg-emerald-800 text-[10px] font-bold tracking-wide text-white hover:bg-emerald-800">WIZARD-BUILT · EDITABLE</Badge>
                  <p className="mt-1 text-[11px] leading-4 text-emerald-950">This cabinet belongs to an editable Peninsula Wizard assembly.</p>
                </div>
                <Button type="button" variant="outline" size="sm" data-testid="jump-to-peninsula-wizard" className="border-emerald-700 bg-white text-emerald-950 hover:bg-emerald-100" onClick={() => onJumpToWizard(uid)}>Jump to Wizard</Button>
              </div>
            </div>
          )}
          {editConfigLink && (
            <a
              href={editConfigLink.href}
              target={editConfigLink.target}
              rel={editConfigLink.rel}
              className="w-fit text-xs font-medium text-amber-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
            >
              Edit Config ↗
            </a>
          )}
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Dimensions */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{t("dt_ca_size")}</h4>
              {custom && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {t("dt_ca_custom_fee", { fee: customFee })}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                    onClick={() => onResetSize(uid)}
                  >
                    {t("dt_ca_reset_catalog")}
                  </Button>
                </div>
              )}
            </div>
            {(() => {
              const fillerRange = fillerWidthRange(cabinet);
              return <div className="flex items-end gap-3">
              <Dim
                label="W"
                value={fillerRange ? Math.round(cabinet.width * 8) / 8 : Math.round(cabinet.width * 10) / 10}
                custom={isCustomWidth(cabinet)}
                min={fillerRange?.min ?? 6}
                max={fillerRange?.max ?? 48}
                step={fillerRange ? 0.125 : 1}
                inputStep={fillerRange ? 0.125 : 0.25}
                snapTypedValue={Boolean(fillerRange)}
                onSet={(v) => onSetWidth(uid, v)}
              />
              <Dim
                label="H"
                value={Math.round(placedHeight(cabinet) * 10) / 10}
                custom={isCustomHeight(cabinet)}
                min={6}
                max={96}
                onSet={(v) => onSetHeight(uid, v)}
              />
              <Dim
                label="D"
                value={Math.round(cabinet.depth * 10) / 10}
                custom={isCustomDepth(cabinet)}
                min={6}
                max={36}
                onSet={(v) => onSetDepth(uid, v)}
              />
            </div>;
            })()}
          </section>

	          {cornerClearance && <CabinetCornerClearancePanel clearance={cornerClearance} />}

	          {isRefrigeratorCabinet && onSetRefrigeratorSidePanels && (
	            <section data-testid="refrigerator-side-panel-toggle" className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
	              <div className="min-w-0">
	                <h4 className="text-sm font-semibold text-amber-950">Finished refrigerator side panels</h4>
	                <p className="text-[11px] text-amber-900/80">
	                  {refrigeratorPanelsRequestedButMissing
	                    ? "Panels were requested on this saved refrigerator, but no real catalog panel SKUs are placed. Configure the enclosure to add the verified, priced panels."
	                    : hasRefrigeratorSidePanels
	                      ? "Both finished side panels are included. Configure to change the enclosure while keeping the refrigerator and over-fridge cabinet."
	                      : "Configure both finished side panels from the active line. The refrigerator remains a 36-inch appliance; real ¾-inch panels finish outside it."}
	                </p>
	              </div>
	              <Switch
	                checked={hasRefrigeratorSidePanels}
	                onCheckedChange={(enabled) => onSetRefrigeratorSidePanels(uid, enabled)}
	                aria-label="Configure refrigerator side panels"
	              />
	            </section>
	          )}

            {attachedFillerOptions && onApplyAttachedFillers && (
              <CabinetAttachedFillerControls
                value={attachedFillerOptions}
                onApply={(choice) => onApplyAttachedFillers(uid, choice)}
              />
            )}

	          <section className="space-y-3 border-t border-border pt-3" data-testid="cabinet-attributes-door-hardware">
            <h4 className="text-sm font-semibold">{t("dt_ca_door_hardware")}</h4>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {noDoor ? (
                  <DoorOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <DoorClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <Label className="text-sm">{t("dt_ca_remove_door")}</Label>
                  <p className="text-[11px] text-muted-foreground">{t("dt_ca_remove_door_hint")}</p>
                </div>
              </div>
              <Switch
                checked={noDoor}
                onCheckedChange={(value) => onSetNoDoor(uid, value)}
                aria-label={t("dt_ca_remove_door")}
              />
            </div>

            <div className={cn("space-y-1.5", noDoor && "pointer-events-none opacity-40")}>
              <Label className="text-sm">{t("dt_ca_door_swing")}</Label>
              {isDouble ? (
                <p className="text-[11px] text-muted-foreground">{t("dt_ca_double_hint")}</p>
              ) : !hasDoorSwing(cabinet) ? (
                <p className="text-[11px] text-muted-foreground">{t("dt_ca_no_hinged")}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={swing === "left" ? "default" : "outline"} size="sm" className="h-8" disabled={!canSwing} onClick={() => onSetSwing(uid, "left")}>
                    {t("dt_ca_left_hinge")}
                  </Button>
                  <Button type="button" variant={swing === "right" ? "default" : "outline"} size="sm" className="h-8" disabled={!canSwing} onClick={() => onSetSwing(uid, "right")}>
                    {t("dt_ca_right_hinge")}
                  </Button>
                </div>
              )}
            </div>

            <div className={cn("space-y-1.5", noDoor && "pointer-events-none opacity-40")}>
              <div>
                <Label className="text-sm">Hardware placement</Label>
                <p className="text-[11px] text-muted-foreground">Every door pull or knob stays centered on its 3-inch frame, exactly 1.5 inches from the selected edge. Automatic uses the opening edge opposite the hinge; every drawer pull stays centered automatically.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={hardwarePosition === "auto" ? "default" : "outline"} size="sm" className="h-8" disabled={noDoor} onClick={() => onSetHandleSide(uid, "auto")}>Automatic</Button>
                <Button type="button" variant={hardwarePosition === "left" ? "default" : "outline"} size="sm" className="h-8" disabled={noDoor} onClick={() => onSetHandleSide(uid, "left")}>{t("dt_ca_left")}</Button>
                <Button type="button" variant={hardwarePosition === "right" ? "default" : "outline"} size="sm" className="h-8" disabled={noDoor} onClick={() => onSetHandleSide(uid, "right")}>{t("dt_ca_right")}</Button>
              </div>
              {usesAutomaticRaisedPull && (
                <p className="rounded-md border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-[11px] text-muted-foreground dark:border-emerald-800 dark:bg-emerald-950/20" data-testid="automatic-raised-floor-wall-pull">
                  This floor-seated wall cabinet keeps each vertical pull on its existing hinge-aware door rail and positions it upward automatically.
                </p>
              )}
              {canUseCenteredTopPull && !usesAutomaticRaisedPull && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50/70 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
                  <div>
                    <Label className="text-sm font-semibold">Raise door handle on its rail</Label>
                    <p className="text-[11px] text-muted-foreground">B15/B18 only.</p>
                  </div>
                  <Switch checked={hardwarePosition === "top-center"} disabled={noDoor} aria-label="Move B15/B18 door handle to top center" onCheckedChange={(checked) => onSetHandleSide(uid, checked ? "top-center" : "auto")} />
                </div>
              )}
              {isDouble && (
                <Button type="button" variant={hardwarePosition === "paired" ? "default" : "outline"} size="sm" className="h-8 w-full" disabled={noDoor} onClick={() => onSetHandleSide(uid, "paired")}>
                  Paired doors — pulls at the center meeting edge
                </Button>
              )}
              {onApplyHandleSideToAll && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="secondary" size="sm" className="h-9 w-full" disabled={noDoor || hardwareApplyCount === 0}>Apply to All Cabinets</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apply this door hardware position to all cabinets?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will apply {hardwarePosition === "auto" ? "Automatic" : hardwarePosition === "paired" ? "Paired doors" : hardwarePosition[0]!.toUpperCase() + hardwarePosition.slice(1)} to {hardwareApplyCount} eligible cabinet{hardwareApplyCount === 1 ? "" : "s"}. Open cabinets, appliances, panels, and drawer-only cabinets are skipped. Every drawer pull remains centered automatically.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onApplyHandleSideToAll(hardwarePosition)}>Apply to {hardwareApplyCount} cabinet{hardwareApplyCount === 1 ? "" : "s"}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </section>

          <details data-testid="cabinet-attributes-more-options" className="group rounded-lg border border-border bg-muted/15">
            <Tooltip>
              <TooltipTrigger asChild>
                <summary aria-label="Open optional cabinet settings" className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>More cabinet options</span>
                  <span className="text-[11px] font-normal text-muted-foreground group-open:hidden">Placement, finish &amp; specialty settings</span>
                  <span className="hidden text-[11px] font-normal text-muted-foreground group-open:inline">Hide optional settings</span>
                </summary>
              </TooltipTrigger>
              <TooltipContent>Open optional placement, finish, and specialty settings.</TooltipContent>
            </Tooltip>
            <div className="space-y-3 border-t border-border px-3 py-3">

          {(cabinet.placement === "base" || cabinet.placement === "wall" || cabinet.placement === "tall") && (
            <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div>
                <h4 className="text-sm font-semibold text-[#6e531d]">End Panel Treatment</h4>
                <p className="text-[11px] text-muted-foreground">Plain finished ends are standard. Add a decorative panel only where you want one.</p>
              </div>
              <Select value={cabinet.decorativeEnd ?? "none"} onValueChange={(value) => onSetDecorativeEnd(uid, value as "none" | "left" | "right" | "both")}>
                <SelectTrigger className="h-9 bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Plain finished ends</SelectItem>
                  <SelectItem value="left">Decorative panel — left end</SelectItem>
                  <SelectItem value="right">Decorative panel — right end</SelectItem>
                  <SelectItem value="both">Decorative panels — both ends</SelectItem>
                </SelectContent>
              </Select>
            </section>
          )}

	          {canMoveMount && (
	            <section className="space-y-2 border-t border-border pt-4">
	              <div className="flex items-center justify-between gap-3">
	                <div>
	                  <h4 className="text-sm font-semibold">{isKneeDrawer ? "Knee-drawer position" : "Elevation position"}</h4>
	                  <p className="text-[11px] text-muted-foreground">{isKneeDrawer ? "Set the drawer bottom 24–30 inches from the finished floor for a seated work area, or align its top to the 34.5-inch base body." : "Move this wall cabinet up or down from the floor."}</p>
	                </div>
	                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onSetMountBottom?.(uid, isKneeDrawer ? KNEE_DRAWER_DEFAULT_MOUNT_BOTTOM_IN : 54)}>
	                  {isKneeDrawer ? "Reset 30″" : "Reset 54″"}
	                </Button>
	              </div>
	              {isKneeDrawer && (
	                <div className="flex flex-wrap gap-1.5" data-testid="knee-drawer-height-presets" aria-label="Knee drawer mounting-height presets">
	                  {[24, 27, 30].map((height) => (
	                    <Button key={height} type="button" size="sm" variant={Math.round(mountBottom ?? 0) === height ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => onSetMountBottom?.(uid, height)}>{height}″</Button>
	                  ))}
	                  <Button
                    type="button"
                    size="sm"
                    variant={Math.abs((mountBottom ?? 0) - (kneeDrawerBaseBodyAlignBottom ?? 0)) < 0.01 ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    title="Align the knee-drawer top with the 34.5-inch base-cabinet body"
                    onClick={() => kneeDrawerBaseBodyAlignBottom !== null && onSetMountBottom?.(uid, kneeDrawerBaseBodyAlignBottom)}
                  >
                    Align top 34.5″
                  </Button>
	                </div>
	              )}
	              <div className="flex items-center gap-1">
	                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" title={isKneeDrawer ? "Lower knee drawer one inch" : "Move down one inch"} onClick={() => onSetMountBottom?.(uid, Math.max(isKneeDrawer ? KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN : 0, (mountBottom ?? 0) - 1))}>
	                  <Minus className="h-3.5 w-3.5" />
	                </Button>
	                <Input
	                  type="number"
	                  min={isKneeDrawer ? KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN : 0}
	                  max={isKneeDrawer ? KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN : maxMountBottom ?? 120}
	                  step={1}
	                  value={Math.round(mountBottom ?? 0)}
	                  className="h-8 w-20 text-center text-sm"
	                  aria-label={isKneeDrawer ? "Knee drawer mounting height from floor" : "Cabinet mounting height from floor"}
	                  onChange={(event) => {
	                    const next = Number(event.target.value);
	                    const min = isKneeDrawer ? KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN : 0;
	                    const max = isKneeDrawer ? KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN : maxMountBottom ?? 120;
	                    if (Number.isFinite(next)) onSetMountBottom?.(uid, Math.max(min, Math.min(max, next)));
	                  }}
	                />
	                <span className="text-xs text-muted-foreground">in. from floor</span>
	                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" title={isKneeDrawer ? "Raise knee drawer one inch" : "Move up one inch"} onClick={() => onSetMountBottom?.(uid, Math.min(isKneeDrawer ? KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN : maxMountBottom ?? 120, (mountBottom ?? 0) + 1))}>
	                  <Plus className="h-3.5 w-3.5" />
	                </Button>
              </div>
            </section>
          )}

	          {canMoveInOut && (
	            <section className="space-y-2 border-t border-border pt-4">
              <div>
                <h4 className="text-sm font-semibold">Depth position</h4>
                <p className="text-[11px] text-muted-foreground">Choose an exact distance, then move this cabinet toward the wall or into the room.</p>
              </div>
              <CabinetDepthMoveControls onMove={(direction, distanceIn) => onMoveInOut?.(uid, direction, distanceIn)} />
	            </section>
	          )}

              {canMoveAlongWall && wallPosition && (
                <section className="space-y-2 border-t border-border pt-4">
                  <div>
                    <h4 className="text-sm font-semibold">Exact position on wall</h4>
                    <p className="text-[11px] text-muted-foreground">Type the measured position from the selected wall’s start corner, or move by a known distance toward its start or end.</p>
                  </div>
                  <CabinetWallPositionControls position={wallPosition} onSetOffset={(offsetIn) => onSetWallOffset?.(uid, offsetIn)} />
                </section>
              )}

	          {isIslandWallCabinet && (
            <section className="space-y-2 border-t border-border pt-4" data-testid="island-wall-cabinet-base-treatment">
              <div className="flex items-start gap-1.5">
                <div>
                  <h4 className="text-sm font-semibold">Island base finish</h4>
                  <p className="text-[11px] text-muted-foreground">Choose the floor detail for this counter-height wall cabinet. The preview matches the island’s visible cabinet support.</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Learn about island base finishes" className="mt-0.5 shrink-0 rounded-sm text-amber-700 outline-none hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300">
                      <CircleHelp className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56">Use a recessed toe kick to match base cabinets, or a full-depth base molding for a built-in furniture look.</TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Island wall cabinet base finish">
                <button
                  type="button"
                  aria-pressed={islandBaseTreatment === "toe-kick"}
                  className={cn("rounded-md border p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", islandBaseTreatment === "toe-kick" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-border hover:border-amber-400")}
                  onClick={() => onSetIslandWallBaseTreatment(uid, "toe-kick")}
                >
                  <span data-testid="island-base-preview-toe-kick" aria-hidden="true" className="relative mb-2 block h-10 overflow-hidden rounded-sm border border-stone-300 bg-stone-100 dark:border-stone-700 dark:bg-stone-900">
                    <span className="absolute inset-x-1.5 top-1 h-6 rounded-sm bg-[#6f7e70]" />
                    <span className="absolute inset-x-3 bottom-0 h-2 bg-[#4c584d]" />
                  </span>
                  <span className="block text-xs font-semibold">Recessed toe kick</span>
                  <span className="block text-[10px] text-muted-foreground">Inset base-cabinet support</span>
                </button>
                <button
                  type="button"
                  aria-pressed={islandBaseTreatment === "base-molding"}
                  className={cn("rounded-md border p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", islandBaseTreatment === "base-molding" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-border hover:border-amber-400")}
                  onClick={() => onSetIslandWallBaseTreatment(uid, "base-molding")}
                >
                  <span data-testid="island-base-preview-base-molding" aria-hidden="true" className="relative mb-2 block h-10 overflow-hidden rounded-sm border border-stone-300 bg-stone-100 dark:border-stone-700 dark:bg-stone-900">
                    <span className="absolute inset-x-1.5 top-1 h-6 rounded-sm bg-[#6f7e70]" />
                    <span className="absolute inset-x-0 bottom-0 h-2 bg-[#4c584d]" />
                  </span>
                  <span className="block text-xs font-semibold">Base molding</span>
                  <span className="block text-[10px] text-muted-foreground">Full-depth furniture plinth</span>
                </button>
              </div>
            </section>
          )}

          {/* Oven Type — only for oven-tall cabinets */}
          {cabinetDrawingType(cabinet) === "oven-tall" && (
            <section className="space-y-3 border-t border-border pt-4">
              <h4 className="text-sm font-semibold">Oven Type</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                    (cabinet.ovenType ?? "single") === "single"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary"
                  )}
                  onClick={() => onSetOvenType(uid, "single")}
                >
                  <img
                    src="/manus-storage/legacy-cdn/oven-single-front-U843ihaYrWbB8xwKsMyngZ.webp"
                    alt="Single oven"
                    className="w-16 h-20 object-cover rounded-lg"
                  />
                  <span className="text-xs font-medium">Single Oven</span>
                </button>
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                    cabinet.ovenType === "double"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary"
                  )}
                  onClick={() => onSetOvenType(uid, "double")}
                >
                  <img
                    src="/manus-storage/legacy-cdn/oven-double-front-n2DaWbuTecczH4YKk7fJbo.webp"
                    alt="Double oven"
                    className="w-16 h-20 object-cover rounded-lg"
                  />
                  <span className="text-xs font-medium">Double Oven</span>
                </button>
              </div>
            </section>
          )}
          {/* Category */}
          <section className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-semibold">Category</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Category</Label>
                <Select
                  value={cabinet.category ?? ""}
                  onValueChange={(val) => onSetCategory(uid, val, cabinet.subCategory ?? null)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Base">Base</SelectItem>
                    <SelectItem value="Wall">Wall</SelectItem>
                    <SelectItem value="Tall">Tall</SelectItem>
                    <SelectItem value="Vanity">Vanity</SelectItem>
                    <SelectItem value="ADA">ADA</SelectItem>
                    <SelectItem value="Corner">Corner</SelectItem>
                    <SelectItem value="Accessory">Accessory</SelectItem>
                    <SelectItem value="Specialty">Specialty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Sub-Category</Label>
                <Select
                  value={cabinet.subCategory ?? "__none__"}
                  onValueChange={(val) => onSetCategory(uid, cabinet.category ?? "Base", val === "__none__" ? null : val)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="Sink Base">Sink Base</SelectItem>
                    <SelectItem value="Drawer Base">Drawer Base</SelectItem>
                    <SelectItem value="Corner Base">Corner Base</SelectItem>
                    <SelectItem value="Blind Corner">Blind Corner</SelectItem>
                    <SelectItem value="Lazy Susan">Lazy Susan</SelectItem>
                    <SelectItem value="Oven Base">Oven Base</SelectItem>
                    <SelectItem value="Range Base">Range Base</SelectItem>
                    <SelectItem value="Microwave">Microwave</SelectItem>
                    <SelectItem value="Refrigerator">Refrigerator</SelectItem>
                    <SelectItem value="Pantry">Pantry</SelectItem>
                    <SelectItem value="Utility">Utility</SelectItem>
                    <SelectItem value="Open Shelf">Open Shelf</SelectItem>
                    <SelectItem value="Glass Door">Glass Door</SelectItem>
                    <SelectItem value="Decorative End Panel">Decorative End Panel</SelectItem>
                    <SelectItem value="Roll-Out Tray">Roll-Out Tray</SelectItem>
                    <SelectItem value="Trim & Molding">Trim &amp; Molding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Custom drawing rule */}
          <section className="space-y-3 border-t border-border pt-4">
            <div>
              <h4 className="text-sm font-semibold">Drawing Rule</h4>
              <p className="text-[11px] text-muted-foreground">
                Choose how this cabinet draws in plan and elevation. End cabinets remain independent from corner-cabinet rules.
              </p>
            </div>
            <Select
              value={cabinet.customProfile ?? "standard"}
              onValueChange={(value) => onSetCustomProfile(uid, value === "standard" ? null : value)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Standard cabinet" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_CABINET_PROFILES.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>{profile.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cabinet.customProfile && cabinet.customProfile !== "standard" && !cabinet.genericDrawingUrl && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                This profile has no generic drawing image yet. It will use its vector fallback until one is saved in Cabinet Config.
              </p>
            )}
            {masterConfigHref && (
              <a
                href={masterConfigHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-[11px] font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                Open Master Cabinet Config to save this rule and generic image ↗
              </a>
            )}
            {onSaveMasterConfig && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={savingMasterConfig}
                onClick={() => onSaveMasterConfig(cabinet)}
              >
                {savingMasterConfig ? "Saving master configuration…" : "Save category and drawing rule to this cabinet SKU"}
              </Button>
            )}
          </section>

          {isMasterAdmin && (
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="h-4 w-4" /> Master &amp; linked variants</h4>
                  <p className="text-[11px] text-muted-foreground">The confirmed master owns shared cabinet configuration. Supplier pricing and availability remain on source records.</p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{cabinet.masterCode}</Badge>
              </div>
              {aliasesQuery.data && aliasesQuery.data.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-2 text-xs">
                  <div className="mb-1 font-medium">Connected variants ({aliasesQuery.data.length})</div>
                  <div className="flex flex-wrap gap-1">{aliasesQuery.data.map((alias) => <Badge key={alias.id} variant="outline" className="font-mono text-[10px]">{alias.aliasCode}</Badge>)}</div>
                </div>
              ) : <p className="text-[11px] text-muted-foreground">No linked variants yet.</p>}
              {similarQuery.data && similarQuery.data.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-2.5 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle className="h-3.5 w-3.5" /> Similar candidates — confirm the master before linking</div>
                  <div className="space-y-2">
                    {similarQuery.data.map((candidate) => (
                      <div key={candidate.id} className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-background/80 px-2 py-1.5 text-xs dark:border-amber-900">
                        <div className="min-w-0"><div className="truncate font-mono font-semibold">{candidate.masterCode}</div><div className="truncate text-muted-foreground">{candidate.description} · {candidate.similarity}% code match</div></div>
                        {pendingMasterId === candidate.id ? (
                          <Button type="button" size="sm" className="h-7 text-[11px]" disabled={mergeMutation.isPending} onClick={() => mergeMutation.mutate({ masterCabinetId: candidate.id, aliasCabinetId: cabinet.cabinetId! })}>{mergeMutation.isPending ? "Linking…" : "Confirm master"}</Button>
                        ) : <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPendingMasterId(candidate.id)}><GitMerge className="mr-1 h-3 w-3" /> Link</Button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Glass door upgrade */}
          {cabinet.placement === "wall" && (
            <section className="space-y-3 border-t border-border pt-4">
              <h4 className="text-sm font-semibold">{t("dt_ca_glass_door")}</h4>
              {(cabinet.glassDoor || isGlassPolicyNomenclature(cabinet.masterCode)) && (
                <div className={cabinet.glassIncluded === true ? "rounded-md border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200" : "rounded-md border border-amber-300 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"}>
                  <span className="font-semibold">{cabinet.glassIncluded === true ? "Glass included" : "Glass purchased separately"}</span>
                  {cabinet.glassIncluded === true
                    ? " — this distributor includes the glass insert in this item’s listed price."
                    : " — this distributor sells the cabinet or door without the glass insert. Add the required glass separately before ordering."}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t("dt_ca_glass_door_toggle")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {glassDoorAvailable
                      ? t("dt_ca_glass_door_hint")
                      : t("dt_ca_glass_door_unavail")}
                  </p>
                </div>
                <Switch
                  checked={!!cabinet.glassDoor}
                  disabled={!glassDoorAvailable}
                  onCheckedChange={(v) => onSetGlassDoor(uid, v)}
                  aria-label={t("dt_ca_glass_door_toggle")}
                />
              </div>
              {/* Linked replacement door: persisted and priced with the design. */}
              {cabinet.glassDoorAddonCode && (
                <div className="pt-2">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Glass door sold separately as {cabinet.glassDoorAddonCode}. The cabinet remains {cabinet.masterCode}, and one same-style glass-door line is included in the design price and cart. {cabinet.glassIncluded === true ? "The distributor includes the glass insert." : "The glass insert is purchased separately."}
                  </p>
                  <button
                    type="button"
                    className="w-full text-sm font-medium py-2 px-3 rounded-md border border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                    onClick={() => onAddGlassDoorToCart(uid)}
                  >
                    Use Glass Door ({cabinet.glassDoorAddonCode})
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Blind base-corner attributes */}
          {isBaseBlindCorner(cabinet) && (() => {
            const range = blindPullRange(cabinet);
            const pullMin = range?.min ?? 3;
            const pullMax = range?.max ?? 6;
            const currentPull = cabinet.blindPull ?? pullMax;
            return (
              <section className="space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold">Blind Base Corner</h4>

                {/* Door side */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Door Side</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Which side of the cabinet the door opens from
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={swing === "left" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => onSetSwing(uid, "left")}
                    >
                      Left
                    </Button>
                    <Button
                      type="button"
                      variant={swing === "right" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => onSetSwing(uid, "right")}
                    >
                      Right
                    </Button>
                  </div>
                </div>

                {/* Pull distance from wall */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Pull from Wall</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Distance (inches) the blind portion extends from the corner wall ({pullMin}–{pullMax}")
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => onSetBlindPull(uid, Math.max(pullMin, currentPull - 1))}
                      disabled={currentPull <= pullMin}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      step="1"
                      min={pullMin}
                      max={pullMax}
                      value={currentPull}
                      className="h-8 w-20 text-center text-sm"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) onSetBlindPull(uid, Math.max(pullMin, Math.min(pullMax, v)));
                      }}
                      aria-label="Pull distance from wall"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => onSetBlindPull(uid, Math.min(pullMax, currentPull + 1))}
                      disabled={currentPull >= pullMax}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground ml-1">" in</span>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Waterfall countertop edge — only for base cabinets */}
          {isBase && (
            <section className="space-y-3 border-t border-border pt-4">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                Waterfall Edge
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Countertop material cascades down the side of this cabinet to the floor.
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Left Side</Label>
                <Switch
                  checked={!!cabinet.waterfallLeft}
                  onCheckedChange={(v) => onSetWaterfall(uid, "left", v)}
                  aria-label="Waterfall left side"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Right Side</Label>
                <Switch
                  checked={!!cabinet.waterfallRight}
                  onCheckedChange={(v) => onSetWaterfall(uid, "right", v)}
                  aria-label="Waterfall right side"
                />
              </div>
            </section>
          )}

          {/* Add-ons: per-cabinet roll-out shelves (auto-sized, same line) */}
          <RollOutTrayPicker
            cabinet={cabinet}
            designStyleId={designStyleId}
	          distributorId={distributorId}
	          pricingTier={pricingTier}
            qty={cabinet.rolloutQty ?? 0}
            onSetQty={(q) => onSetRolloutQty(uid, q)}
          />
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("dt_ca_done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
