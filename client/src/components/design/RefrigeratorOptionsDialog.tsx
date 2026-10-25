import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REFRIGERATOR_UPPER_CLEARANCE_IN } from "@/lib/design";
import {
  availableOverFridgeWidths,
  closestOverFridgeSuggestion,
  exactOverFridgeCabinet,
  overFridgeCatalogDimensions,
} from "@/lib/refrigeratorOverFridgePicker";

export type FridgeAbove = "bridge" | "none";
export type FridgePanels = "left" | "right" | "both" | "none";

/** Minimal cabinet shape needed by the dialog. */
export interface SurroundCabinet {
  id: number;
  masterCode: string;
  description: string;
  width: string | null;
  height: string | null;
  depth: string | null;
}

export interface FridgeSurroundChoice {
  above: FridgeAbove;
  /** The specific bridge cabinet chosen by the user (id). Null when above !== "bridge". */
  bridgeCabinetId: number | null;
  /** The chosen bridge height in inches (12, 18, or 24). Null when above !== "bridge". */
  bridgeHeight: number | null;
  /** The chosen bridge depth in inches (12 or 24). Null when above !== "bridge". */
  bridgeDepth: number | null;
  /** The chosen bridge width in inches. Null when above !== "bridge". */
  bridgeWidth: number | null;
  panels: FridgePanels;
  /** The specific end panel chosen by the user (id). Null when panels === "none". */
  endPanelId: number | null;
  /** The verified selected end-panel depth in inches. Null when panels === "none". */
  panelDepth: number | null;
  /**
   * The auto-calculated panel height in inches.
   * = selected refrigerator height + 2" clearance + bridge height.
   * Null when panels === "none" or above === "none".
   */
  panelHeight: number | null;
  smooth: boolean;
  /** Chosen fridge width in inches (e.g. 30, 33, 36). */
  fridgeWidth: number;
  /** Chosen fridge height in inches (e.g. 66, 70, 72, 78, 84). */
  fridgeHeight: number;
  /** Chosen fridge depth in inches (e.g. 24, 27, 30, 33, 36). */
  fridgeDepth: number;
}

export interface RefrigeratorOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fridge width in inches — used to seed the bridge width. */
  fridgeWidthInches?: number;
  /** All deep 24" refrigerator wall cabinets available for this style. */
  deepAbove?: SurroundCabinet[];
  /** All bridge wall cabinets available for this style (will be filtered to ≤ fridge width). */
  bridgeAbove?: SurroundCabinet[];
  /** All end panels available for this style. */
  endPanels?: SurroundCabinet[];
  /** True when the style has a buyable smooth skin/refrigerator panel. */
  hasSmoothPanel?: boolean;
  /** Existing ordinary upper offered for customer-approved replacement. */
  replacementCabinetCode?: string | null;
  /** Exact reason a selected source component could not physically fit. */
  errorMessage?: string | null;
  /** Existing refrigerator choices, used when reopening the same popup to edit a placed bay. */
  initialChoice?: Partial<FridgeSurroundChoice> | null;
  /** Apply the chosen surround. Returns false when placement was rejected. */
  onApply: (choice: FridgeSurroundChoice) => boolean | void;
  /** Keep just the refrigerator (no surround). */
  onSkip: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FRIDGE_WIDTHS = [24, 27, 30, 33, 36, 42];
const FRIDGE_HEIGHTS = [66, 70, 72, 78, 84];
const FRIDGE_DEPTHS = [24, 27, 30, 33, 36];

const BRIDGE_HEIGHT_OPTIONS = [12, 15, 18, 21, 24] as const;
type BridgeHeight = typeof BRIDGE_HEIGHT_OPTIONS[number];

const BRIDGE_DEPTH_OPTIONS = [12, 24] as const;
type BridgeDepth = typeof BRIDGE_DEPTH_OPTIONS[number];

// Bridge cabinet widths — all distributors carry 30", 33", 36" fridge cabinets
const BRIDGE_WIDTH_OPTIONS = [30, 33, 36];

// ─── Helper: panel height from bridge height ──────────────────────────────────
function calcPanelHeight(fridgeH: number, bridgeH: BridgeHeight): number {
  return fridgeH + REFRIGERATOR_UPPER_CLEARANCE_IN + bridgeH;
}

// ─── Small reusable pill selector ────────────────────────────────────────────
function OptionPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; sub?: string; disabled?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
              o.disabled && "cursor-not-allowed opacity-40 hover:bg-background hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {o.label}
            {o.sub && <span className="block text-[10px] opacity-70">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Compact dimension button row ────────────────────────────────────────────
function DimSelector({
  label,
  value,
  options,
  onChange,
  unit = '"',
  note,
  disabledOptions = [],
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
  unit?: string;
  note?: string;
  disabledOptions?: readonly number[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const unavailable = disabledOptions.includes(o);
          return (
            <button
              key={o}
              type="button"
              disabled={unavailable}
              onClick={() => onChange(o)}
              title={unavailable ? `No ${o}${unit} cabinet is available for this height and depth` : undefined}
              className={cn(
                "rounded border px-2.5 py-1 text-xs transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                value === o
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : unavailable
                    ? "cursor-not-allowed border-border bg-background text-muted-foreground/40 line-through"
                    : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {o}{unit}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function RefrigeratorOptionsDialog({
  open,
  onOpenChange,
  fridgeWidthInches,
  deepAbove = [],
  endPanels = [],
  hasSmoothPanel = false,
  replacementCabinetCode = null,
  errorMessage = null,
  initialChoice = null,
  onApply,
  onSkip,
}: RefrigeratorOptionsDialogProps) {
  const { t } = useLanguage();
  // Clark & Sons' current source SKU is REP2496. The prior catalog/document
  // label was REP9624, so retain that familiar label in the picker without
  // inventing a second source item or changing the invoiceable code.
  const panelSourceLabel = (code: string) => code === "REP2496"
    ? "REP2496 · prior REP9624"
    : code === "S2496"
      ? "S2496 — finished shelf board / refrigerator side panel"
    : code === "TEP3096"
      ? "TEP3096 — 29-7/8″ stock panel, cut to fit"
    : code;

  // ── Fridge size ────────────────────────────────────────────────────────────
  const [fridgeW, setFridgeW] = useState<number>(fridgeWidthInches ?? 36);
  const [fridgeH, setFridgeH] = useState<number>(70);
  const [fridgeD, setFridgeD] = useState<number>(30);

  // ── Over-fridge cabinet ────────────────────────────────────────────────────
  const [above, setAbove] = useState<FridgeAbove>("none");
  const [bridgeHeightChoice, setBridgeHeightChoice] = useState<BridgeHeight>(12);
  const [bridgeDepthChoice, setBridgeDepthChoice] = useState<BridgeDepth>(12);
  // Bridge width is independent of fridge width — always 30/33/36
  const [bridgeWidthChoice, setBridgeWidthChoice] = useState<number>(36);

  // ── End panels ─────────────────────────────────────────────────────────────
  // A finished refrigerator enclosure uses both structural end panels by
  // default. Customers can still explicitly choose Left, Right, or None, but a
  // new refrigerator must not silently start without its wall-side panel.
  const [panels, setPanels] = useState<FridgePanels>("none");
  const [panelDepth, setPanelDepth] = useState<number>(24);
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");

  // ── Smooth panel ───────────────────────────────────────────────────────────
  const [smooth, setSmooth] = useState(false);

  // Every code, dimension label, cart line, and placement below comes from the
  // exact same active catalog record. There is no narrower-width fallback.
  const bridgeByDims = useMemo(() => {
    const result: Record<BridgeHeight, Record<BridgeDepth, SurroundCabinet | null>> = {
      12: { 12: null, 24: null },
      15: { 12: null, 24: null },
      18: { 12: null, 24: null },
      21: { 12: null, 24: null },
      24: { 12: null, 24: null },
    };
    for (const targetH of BRIDGE_HEIGHT_OPTIONS) {
      for (const targetD of BRIDGE_DEPTH_OPTIONS) {
        result[targetH][targetD] = exactOverFridgeCabinet(deepAbove, {
          width: bridgeWidthChoice,
          height: targetH,
          depth: targetD,
        });
      }
    }
    return result;
  }, [deepAbove, bridgeWidthChoice]);

  const availableBridgeWidths = useMemo(
    () => availableOverFridgeWidths(deepAbove, bridgeHeightChoice, bridgeDepthChoice),
    [deepAbove, bridgeHeightChoice, bridgeDepthChoice],
  );
  const unavailableBridgeWidths = useMemo(
    () => BRIDGE_WIDTH_OPTIONS.filter((width) => !availableBridgeWidths.includes(width)),
    [availableBridgeWidths],
  );

  // A refrigerator bay is an invoiceable group: the cap and each finished panel
  // must be an actual selected-line SKU. There is no visual-only generic cap or
  // filler fallback.
  const hasBridgeAbove = deepAbove.length > 0;

  const chosenBridge = above === "bridge" ? bridgeByDims[bridgeHeightChoice][bridgeDepthChoice] : null;
  const chosenBridgeDims = chosenBridge ? overFridgeCatalogDimensions(chosenBridge) : null;
  const closestBridgeSuggestion = useMemo(
    () => closestOverFridgeSuggestion(deepAbove, {
      width: bridgeWidthChoice,
      height: bridgeHeightChoice,
      depth: bridgeDepthChoice,
    }),
    [deepAbove, bridgeWidthChoice, bridgeHeightChoice, bridgeDepthChoice],
  );
  const closestBridgeDims = closestBridgeSuggestion ? overFridgeCatalogDimensions(closestBridgeSuggestion) : null;
  const suggestedFillerEachSide = closestBridgeDims && closestBridgeDims.width < bridgeWidthChoice
    ? (bridgeWidthChoice - closestBridgeDims.width) / 2
    : null;

  // A finished panel reaches the cap above the mandatory appliance clearance.
  const panelHeight = above === "bridge" && panels !== "none"
    ? calcPanelHeight(fridgeH, bridgeHeightChoice)
    : null;

  // Best-match end panel
  const bestPanel = useMemo(() => endPanels[0] ?? null, [endPanels]);
  const selectedPanel = useMemo(
    () => endPanels.find((panel) => String(panel.id) === selectedPanelId) ?? bestPanel,
    [bestPanel, endPanels, selectedPanelId],
  );
  const sourcePanelDepth = useMemo(() => {
    const direct = parseFloat(String(selectedPanel?.depth ?? ""));
    if (Number.isFinite(direct) && direct > 3) return direct;
    const alternate = parseFloat(String(selectedPanel?.width ?? ""));
    return Number.isFinite(alternate) && alternate > 3 ? alternate : null;
  }, [selectedPanel]);

  const hasRequiredBridge = above !== "bridge" || Boolean(chosenBridge);
  const hasRequiredPanels = panels === "none" || Boolean(bestPanel);
  const canApply = hasRequiredBridge && hasRequiredPanels;

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const w = initialChoice?.fridgeWidth ?? fridgeWidthInches ?? 36;
      setFridgeW(w);
      setFridgeH(initialChoice?.fridgeHeight ?? 70);
      setFridgeD(initialChoice?.fridgeDepth ?? 30);
      setBridgeHeightChoice((initialChoice?.bridgeHeight as BridgeHeight | null | undefined) ?? 12);
      setBridgeDepthChoice((initialChoice?.bridgeDepth as BridgeDepth | null | undefined) ?? 12);
      setBridgeWidthChoice(initialChoice?.bridgeWidth ?? BRIDGE_WIDTH_OPTIONS.reduce((best, option) =>
        Math.abs(option - w) < Math.abs(best - w) ? option : best,
      BRIDGE_WIDTH_OPTIONS[0]));
	      // A refrigerator's own source dimensions are enough to place it. The
	      // cabinet above and panels are independent, source-priced choices—not
	      // required additions. Reopened refrigerators retain exactly what was
	      // explicitly selected.
	      setAbove(initialChoice?.above ?? "none");
	      setPanels(initialChoice?.panels ?? "none");
      setPanelDepth(initialChoice?.panelDepth ?? sourcePanelDepth ?? 24);
      setSelectedPanelId(initialChoice?.endPanelId != null ? String(initialChoice.endPanelId) : bestPanel ? String(bestPanel.id) : "");
      setSmooth(initialChoice?.smooth ?? false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select best panel when panels changes away from none
  useEffect(() => {
    if (panels !== "none" && !selectedPanelId && bestPanel) {
      setSelectedPanelId(String(bestPanel.id));
    }
  }, [panels, selectedPanelId, bestPanel]);

  useEffect(() => {
    if (sourcePanelDepth != null) setPanelDepth(sourcePanelDepth);
  }, [sourcePanelDepth]);

  // Auto-correct depth when height changes and current depth has no matching cabinet
  useEffect(() => {
    if (above !== "bridge") return;
    const currentMatch = bridgeByDims[bridgeHeightChoice][bridgeDepthChoice];
    if (!currentMatch) {
      // Find the best available depth for this height
      const fallback = BRIDGE_DEPTH_OPTIONS.find(
        (d) => bridgeByDims[bridgeHeightChoice][d as BridgeDepth] != null
      ) as BridgeDepth | undefined;
      if (fallback !== undefined) setBridgeDepthChoice(fallback);
    }
  }, [bridgeHeightChoice, above]); // eslint-disable-line react-hooks/exhaustive-deps

  // A NEW refrigerator should not open on a blocked combination. Once the
  // selected style's catalog has loaded, if the default cap size has no source
  // cabinet, start on the first size that exists (height, then depth order).
  // A reopened refrigerator keeps its saved choice so the user sees exactly
  // what was built; the warning then tells them why it cannot be re-applied.
  useEffect(() => {
    if (!open || above !== "bridge" || !hasBridgeAbove) return;
    if (initialChoice?.bridgeHeight != null || initialChoice?.bridgeDepth != null) return;
    if (bridgeByDims[bridgeHeightChoice][bridgeDepthChoice]) return;
    for (const h of BRIDGE_HEIGHT_OPTIONS) {
      const d = BRIDGE_DEPTH_OPTIONS.find((depth) => bridgeByDims[h as BridgeHeight][depth as BridgeDepth] != null) as BridgeDepth | undefined;
      if (d !== undefined) {
        setBridgeHeightChoice(h as BridgeHeight);
        setBridgeDepthChoice(d);
        return;
      }
    }
    // Depends on the current height/depth as well: the reset-on-open effect in
    // the same commit sets 12x12 after this effect already read the previous
    // (available) values, so it must run again once that reset has landed.
  }, [open, above, hasBridgeAbove, bridgeByDims, bridgeHeightChoice, bridgeDepthChoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = () => {
    if (!canApply) return;
    // In the repair flow, declining a replacement must preserve the existing
    // ordinary wall cabinet. The customer can remove it separately if desired.
    if (replacementCabinetCode && above === "none") {
      onSkip();
      return;
    }
    const applied = onApply({
      above,
      bridgeCabinetId: chosenBridge ? chosenBridge.id : null,
      bridgeHeight: above === "bridge" ? bridgeHeightChoice : null,
      bridgeDepth: above === "bridge" ? bridgeDepthChoice : null,
      bridgeWidth: above === "bridge" ? bridgeWidthChoice : null,
      panels,
      endPanelId: panels !== "none" && selectedPanelId ? parseInt(selectedPanelId, 10) : null,
      panelDepth: panels !== "none" ? panelDepth : null,
      panelHeight,
      smooth,
      fridgeWidth: fridgeW,
      fridgeHeight: fridgeH,
      fridgeDepth: fridgeD,
    });
    // The dialog is controlled by the Designer, but closing here prevents the
    // modal from remaining on screen after a successful transaction. A false
    // result deliberately keeps it open so the user can correct a placement
    // or catalog-fit error shown by the parent.
    if (applied !== false) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dt_fridge_title")}</DialogTitle>
          <DialogDescription>{t("dt_fridge_desc")}</DialogDescription>
        </DialogHeader>

        {replacementCabinetCode && (
          <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <span className="font-semibold">{replacementCabinetCode}</span> overlaps the refrigerator span but is not a dedicated over-refrigerator cabinet. It stays in place unless you select <span className="font-semibold">Apply</span>, which replaces it with the compatible cabinet chosen below.
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-900">
            <span className="font-semibold">The selected refrigerator parts were not added.</span>{" "}
            {errorMessage}
          </p>
        )}

        <div className="space-y-4 py-1">

          {/* ── 1. Refrigerator Size ─────────────────────────────────────── */}
          <Section title="Refrigerator Size">
            <DimSelector
              label="Width"
              value={fridgeW}
              options={FRIDGE_WIDTHS}
              onChange={(w) => {
                setFridgeW(w);
                // Auto-snap bridge cabinet width to the closest available option (30/33/36)
                const snapped = BRIDGE_WIDTH_OPTIONS.reduce((best, opt) =>
                  Math.abs(opt - w) < Math.abs(best - w) ? opt : best,
                  BRIDGE_WIDTH_OPTIONS[0]
                );
                setBridgeWidthChoice(snapped);
              }}
            />
            <DimSelector label="Height" value={fridgeH} options={FRIDGE_HEIGHTS} onChange={setFridgeH} />
            <DimSelector label="Depth" value={fridgeD} options={FRIDGE_DEPTHS} onChange={setFridgeD} />
          </Section>

          <details data-testid="refrigerator-enclosure-options" className="group rounded-lg border border-border bg-muted/15 px-3 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <summary aria-label="Open optional refrigerator enclosure settings" className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>More enclosure options</span>
                  <span className="text-[11px] font-normal text-muted-foreground group-open:hidden">Cabinet above, end panels &amp; finish</span>
                  <span className="hidden text-[11px] font-normal text-muted-foreground group-open:inline">Hide enclosure options</span>
                </summary>
              </TooltipTrigger>
              <TooltipContent>Open cabinet-above, end-panel, and finish settings for this refrigerator enclosure.</TooltipContent>
            </Tooltip>
            <div className="space-y-4 border-t border-border pt-3">

          {/* ── 2. Over-Fridge Cabinet ───────────────────────────────────── */}
          <Section title="Over-Fridge Cabinet">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Recommended: add a matching cabinet above the refrigerator, with the required 2-inch appliance clearance.
              </p>
              <OptionPills<FridgeAbove>
                value={above}
                onChange={(v) => {
                  setAbove(v);
                  // Auto-select first available height+depth so user never opens to an error
                  if (v === "bridge") {
                    for (const h of BRIDGE_HEIGHT_OPTIONS) {
                      for (const d of BRIDGE_DEPTH_OPTIONS) {
                        if (bridgeByDims[h as BridgeHeight][d as BridgeDepth]) {
                          setBridgeHeightChoice(h as BridgeHeight);
                          setBridgeDepthChoice(d as BridgeDepth);
                          return;
                        }
                      }
                    }
                  }
                }}
                options={[
                  {
                    value: "bridge",
                    label: "Add Cabinet",
                    disabled: !hasBridgeAbove,
                  },
                  { value: "none", label: replacementCabinetCode ? "Keep Current Cabinet" : "No Cabinet" },
                ]}
              />
            </div>

            {above === "bridge" && (
              <div className="space-y-3 pt-1">

                {/* Cabinet Width */}
                <DimSelector
                  label="Width"
                  value={bridgeWidthChoice}
                  options={BRIDGE_WIDTH_OPTIONS}
                  onChange={setBridgeWidthChoice}
                  disabledOptions={unavailableBridgeWidths}
                />

                {/* Cabinet Height */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Height</span>
                  <div className="flex gap-2">
                    {BRIDGE_HEIGHT_OPTIONS.map((h) => {
                      const active = bridgeHeightChoice === h;
                      const hasAny = BRIDGE_DEPTH_OPTIONS.some((d) => bridgeByDims[h as BridgeHeight][d as BridgeDepth] != null);
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={!hasAny}
                          onClick={() => setBridgeHeightChoice(h)}
                          title={!hasAny ? `No ${h}" cabinet available for this style` : undefined}
                          className={cn(
                            "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : !hasAny
                                ? "border-border bg-background text-muted-foreground/40 line-through"
                                : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                          aria-pressed={active}
                        >
                          {h}"
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cabinet Depth */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Depth</span>
                  <div className="flex gap-2">
                    {([
                      { value: 12 as BridgeDepth, label: '12″ Deep' },
                      { value: 24 as BridgeDepth, label: '24″ Deep' },
                    ]).map((o) => {
                      const active = bridgeDepthChoice === o.value;
                      const hasDepth = bridgeByDims[bridgeHeightChoice][o.value] != null;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          disabled={!hasDepth}
                          onClick={() => {
                            if (hasDepth) {
                              setBridgeDepthChoice(o.value);
                            } else {
                              // Fall back to the other depth if this one has no match
                              const fallback = BRIDGE_DEPTH_OPTIONS.find(
                                (d) => d !== o.value && bridgeByDims[bridgeHeightChoice][d] != null
                              );
                              if (fallback) setBridgeDepthChoice(fallback);
                            }
                          }}
                          title={!hasDepth ? `No ${o.value}" deep cabinet available for this style` : undefined}
                          className={cn(
                            "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : !hasDepth
                                ? "border-border bg-background text-muted-foreground/40 line-through cursor-not-allowed"
                                : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                          aria-pressed={active}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Matched SKU / warning */}
                {chosenBridge && chosenBridgeDims ? (
                  <p className="text-[11px] text-muted-foreground">
                    Will use:{" "}
                    <span className="font-medium text-foreground">{chosenBridge.masterCode}</span>
                    {" "}— {chosenBridgeDims.height}″ H × {chosenBridgeDims.depth}″ D × {chosenBridgeDims.width}″ W
                  </p>
                ) : (
                  <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900" role="status">
                    <p>
                      <span className="font-semibold">{bridgeWidthChoice} × {bridgeHeightChoice} × {bridgeDepthChoice} isn’t available in this line.</span>
                      {" "}Choose an enabled width or use the suggested real cabinet below.
                    </p>
                    {closestBridgeSuggestion && closestBridgeDims ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          Closest: <span className="font-semibold">{closestBridgeSuggestion.masterCode}</span>
                          {" "}({closestBridgeDims.width}″ W × {closestBridgeDims.height}″ H × {closestBridgeDims.depth}″ D)
                          {suggestedFillerEachSide != null ? `; ${suggestedFillerEachSide}″ filler each side.` : "."}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 bg-background text-[11px]"
                          onClick={() => setBridgeWidthChoice(closestBridgeDims.width)}
                        >
                          Use {closestBridgeSuggestion.masterCode}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── 3. Fridge End Panels ─────────────────────────────────────── */}
          <Section title="Fridge End Panels">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                No enclosure panels are selected by default. Choose the sides you want only when this refrigerator needs them.
              </p>
              {above === "bridge" && panels !== "none" && panelHeight && (
                <p className="text-xs text-muted-foreground">
                  Panel height will be <span className="font-semibold text-foreground">{panelHeight}″</span>
                  {" "}({fridgeH}″ fridge + {REFRIGERATOR_UPPER_CLEARANCE_IN}″ clearance + {bridgeHeightChoice}″ cabinet)
                </p>
              )}
              {above === "none" && panels !== "none" && (
                <p className="text-xs text-amber-600">
                  Panel height is based on the over-fridge cabinet. Select a cabinet above to set panel height automatically.
                </p>
              )}
              <OptionPills<FridgePanels>
                value={panels}
                onChange={setPanels}
                options={[
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "both", label: "Both" },
                  { value: "none", label: "None" },
                ]}
              />
            </div>

            {panels !== "none" && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Panel depth: <span className="font-semibold text-foreground">{sourcePanelDepth ?? "—"}{sourcePanelDepth != null ? "″" : ""}</span>
                  {selectedPanel ? <> from source SKU <span className="font-semibold text-foreground">{panelSourceLabel(selectedPanel.masterCode)}</span></> : null}
                </p>

                {selectedPanel?.masterCode === "TEP3096" && (
                  <p className="rounded-md border border-primary/25 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Refrigerator bridge side panel.</span>{" "}
                    This source-priced 29-7/8″ × 96″ × 3/4″ stock panel is cut to the installed refrigerator depth and sits beside the refrigerator to support the bridge cabinet above.
                  </p>
                )}

                {/* Panel style selector */}
                {endPanels.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Panel style ({endPanels.length} available)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {endPanels.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedPanelId(String(c.id))}
                          className={cn(
                            "rounded border px-2.5 py-1 text-xs transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                            selectedPanelId === String(c.id)
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          {panelSourceLabel(c.masterCode)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {endPanels.length === 0 && (
                  <p role="status" className="text-[11px] text-amber-700">
                    No source-priced refrigerator end panel is available for this door style. Choose another style, or select None to place only the refrigerator.
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* ── 4. Optional smooth refrigerator panel ────────────────────── */}
          {hasSmoothPanel && (
            <label className="flex cursor-pointer items-center gap-2 px-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                checked={smooth}
                onChange={(e) => setSmooth(e.target.checked)}
              />
              <span className="text-sm">{t("dt_fridge_smooth_label")}</span>
            </label>
          )}
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="bg-background" onClick={onSkip}>
            {t("dt_fridge_skip")}
          </Button>
          <Button onClick={handleApply} disabled={!canApply} title={!canApply ? "Choose a source-priced over-fridge cabinet and end panels before building this bay." : undefined}>
            {t("dt_fridge_apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
