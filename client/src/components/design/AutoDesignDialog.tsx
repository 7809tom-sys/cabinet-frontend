import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Boxes, Check, Droplets, Flame } from "lucide-react";
import { autoDesignWallWidthRows } from "@/lib/autoDesignAutoBuild";
import { autoDesignSelectableWallLabels } from "@/lib/autoDesignCornerStage";
import { autoDesignDefaultCenters, autoDesignWallUsableSpan, type AutoDesignDefaultMeasurement } from "@/lib/autoDesignDefaultCenters";
import { centeredSinkRangePair, sinkBaseFitOptions, AUTO_DESIGN_SINK_BASE_WIDTHS, type Interval } from "@/lib/autoDesignWallPairAndSinkFit";
import { AutoDesignIntakeSection } from "./AutoDesignIntakeSection";
import { emptyAutoDesignIntake, hasPreference, intakeMissing, type AutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import { Checkbox } from "@/components/ui/checkbox";
import { KITCHEN_USE_OPTIONS, type KitchenUseId } from "@/lib/kitchenUsage";
import { DEFAULT_OVER_RANGE_ANSWER } from "@/lib/overRangeCompanion";
import type { PlacedCabinet, RoomData, WallOpening } from "@/lib/design";
import { autoDesignShapeLabel, autoDesignWallList } from "@/lib/autoDesignWallList";
import type {
  DishwasherSideChoice,
  AutoDesignInputs,
  AutoDesignLayoutType,
  AutoDesignOriginCorner,
  AutoDesignRunDirection,
  AutoDesignSinkBaseKind,
  WallLabel,
} from "@/lib/autoDesignAutoBuild";

export type AutoDesignSubmitResult = { ok: true } | { ok: false; message: string };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuild: (input: AutoDesignInputs) => AutoDesignSubmitResult;
  dishwasherSide?: DishwasherSideChoice | null;
  onDishwasherSideChange?: (side: DishwasherSideChoice) => void;
  /** The selected line's source-priced base catalog is still arriving. */
  catalogLoading?: boolean;
  /** Actual room-wall count, capped by the shared six-wall input contract. */
  wallCount?: number;
  /** Live room used to label each setup wall with its current width. */
  room?: RoomData;
  /** The plan's pieces, so the wall list can mark an empty wall (it stays listed and counted). */
  placed?: readonly PlacedCabinet[];
  /** Visual-only Floor Plan guide; receives the same datum choices as anchor measurements. */
  onWallGuideChange?: (selection: { originCorner: AutoDesignOriginCorner; runDirection: AutoDesignRunDirection }) => void;
  /** Replaces only an empty admin Designer room with the blank six-wall training shell. */
  onLoadSixWallTrainingRoom?: () => AutoDesignSubmitResult;
  /**
   * Opens the sink pop-up beside the faucet option. The pick auto-places a
   * Pelican basin in the measured sink base during the build.
   */
  onOpenSinkPicker?: () => void;
  selectedSinkName?: string | null;
  /**
   * Opens the tall oven/pantry pop-up. A pick is auto-placed by the build, so a
   * floor-to-ceiling box is never dragged into a run.
   */
  onOpenTallPicker?: () => void;
  selectedTallSummary?: string | null;
  /** Opens the range pop-up. The pick is auto-placed at the measured range center. */
  onOpenRangePicker?: () => void;
  selectedRangeLabel?: string | null;
  /**
   * True while the range, tall-cabinet or sink pop-up is open over this one. Those pop-ups
   * are separate dialogs, so Radix treats focus or a click inside them as "outside" this
   * non-modal dialog and would close it. While one is open, outside dismissal is blocked
   * so the person can keep choosing the other appliances.
   */
  childPickerOpen?: boolean;
  /**
   * Why a build cannot run right now (non-kitchen room, locked layout, hand-placed
   * cabinets), with the action that clears it. The always-visible toolbar opener
   * opens this popup in any state, so the reason is explained here instead of
   * graying the button out (Tom, owner voice, Nov 24 2026, 12:36 PM CT).
   */
  blockedNotice?: { message: string; actions?: { id: string; label: string; onClick: () => void }[] } | null;
  /** Room openings, so Wall 2 auto-placement keeps the range off windows and both off doors. */
  openings?: readonly WallOpening[];
};
type PointField = "sink" | "stove" | "dishwasher" | "refrigerator";
type SinkBaseWidth = 30 | 33 | 36 | 42;
type RefrigeratorWidth = 30 | 33 | 36 | 42;
type WallCabinetHeight = 30 | 36 | 42;

const labels: Record<PointField, string> = {
  sink: "Sink base",
  stove: "Range / stove",
  dishwasher: "Dishwasher — Optional exact dishwasher center",
  refrigerator: "Refrigerator",
};
const wallSelectionLabels: Record<PointField, string> = {
  sink: "Sink base — place on wall",
  stove: "Range / stove — place on wall",
  dishwasher: "Dishwasher — place on wall when using an exact center",
  refrigerator: "Refrigerator — place on wall",
};
const applianceFields = ["stove", "dishwasher", "refrigerator"] as const;
const omissionLabels: Record<(typeof applianceFields)[number], string> = {
  stove: "Do not add Range / stove",
  dishwasher: "Do not add Dishwasher",
  refrigerator: "Do not add Refrigerator",
};
type FieldValue = { wallLabel: WallLabel; centerOffsetIn: string };
const defaultFieldValue = (measurement: AutoDesignDefaultMeasurement | null, fallback: FieldValue): FieldValue => (measurement
  ? { wallLabel: measurement.wallLabel, centerOffsetIn: String(measurement.centerOffsetIn) }
  : fallback);

export function AutoDesignDialog({ open, onOpenChange, onBuild, catalogLoading = false, wallCount = 4, room, onWallGuideChange, onLoadSixWallTrainingRoom, dishwasherSide: dishwasherSidePreference = null, onDishwasherSideChange, onOpenSinkPicker, selectedSinkName = null, onOpenTallPicker, selectedTallSummary = null, onOpenRangePicker, selectedRangeLabel = null, childPickerOpen = false, blockedNotice = null, openings = [], placed = [] }: Props) {
  const [layoutType, setLayoutType] = useState<AutoDesignLayoutType>("single-wall");
  const [originCorner, setOriginCorner] = useState<AutoDesignOriginCorner>("left");
  const [runDirection, setRunDirection] = useState<AutoDesignRunDirection>("right");
  // Starting centers come from the room and the choices below, so Build works
  // without edits (the old fixed 24 / 120 / 72 overlapped on a 144" wall).
  const [values, setValues] = useState<Record<PointField, FieldValue>>(() => {
    const start = autoDesignDefaultCenters({
      room, layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCount,
      sinkBaseWidthIn: 36, dishwasherSide: "right", includeStove: true, includeRefrigerator: true, refrigeratorWidthIn: 36,
    });
    return {
      sink: defaultFieldValue(start.sink, { wallLabel: "Wall 1", centerOffsetIn: "" }),
      stove: defaultFieldValue(start.stove, { wallLabel: "Wall 1", centerOffsetIn: "" }),
      dishwasher: { wallLabel: "Wall 1", centerOffsetIn: "" },
      refrigerator: defaultFieldValue(start.refrigerator, { wallLabel: "Wall 1", centerOffsetIn: "" }),
    };
  });
  /** Fields the customer typed in or moved to another wall. Their values are never replaced. */
  const [edited, setEdited] = useState<Record<PointField, boolean>>({ sink: false, stove: false, dishwasher: false, refrigerator: false });
  const [omitted, setOmitted] = useState<Record<(typeof applianceFields)[number], boolean>>({
    stove: false,
    dishwasher: false,
    refrigerator: false,
  });
  const [sinkBaseWidth, setSinkBaseWidth] = useState<SinkBaseWidth>(36);
  const [sinkBaseKind, setSinkBaseKind] = useState<AutoDesignSinkBaseKind>("regular");
  const [wallCabinetHeight, setWallCabinetHeight] = useState<WallCabinetHeight>(30);
  const [overRangeAnswer, setOverRangeAnswer] = useState<"hood" | "microwave-bridge" | "open">(DEFAULT_OVER_RANGE_ANSWER);
  const [dishwasherSide, setDishwasherSide] = useState<DishwasherSideChoice>("right");
  const [refrigeratorWidth, setRefrigeratorWidth] = useState<RefrigeratorWidth>(36);
  const [windowAboveSink, setWindowAboveSink] = useState(false);
  const [kitchenUses, setKitchenUses] = useState<KitchenUseId[]>([]);
  const [intake, setIntake] = useState<AutoDesignIntake>(() => emptyAutoDesignIntake());
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) onWallGuideChange?.({ originCorner, runDirection });
  }, [open, onWallGuideChange, originCorner, runDirection]);
  useEffect(() => {
    if (dishwasherSidePreference === "left" || dishwasherSidePreference === "right" || dishwasherSidePreference === "none") {
      setDishwasherSide(dishwasherSidePreference);
    }
  }, [dishwasherSidePreference]);
  useEffect(() => {
    if (!hasPreference(intake, "dishwasher")) return;
    setOmitted((prev) => (prev.dishwasher ? { ...prev, dishwasher: false } : prev));
    setDishwasherSide((prev) => (prev === "none" ? "right" : prev));
  }, [intake.preferences]);

  const setValue = (field: PointField, patch: Partial<FieldValue>) => {
    setEdited((current) => (current[field] ? current : { ...current, [field]: true }));
    setValues((current) => ({
      ...current,
      [field]: { ...current[field], ...patch },
    }));
  };
  const layoutWallLabels = useMemo(
    () => autoDesignSelectableWallLabels(layoutType, wallCount),
    [layoutType, wallCount],
  );
  useEffect(() => {
    if (layoutType !== "u-shape" && layoutType !== "galley") return;
    setValues((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of Object.keys(next) as PointField[]) {
        if (layoutWallLabels.includes(next[field].wallLabel)) continue;
        next[field] = { ...next[field], wallLabel: "Wall 1" };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [layoutType, layoutWallLabels]);
  const wallWidths = useMemo(() => {
    if (!room) return [];
    const allowed = new Set<string>(layoutWallLabels);
    return autoDesignWallWidthRows(room, originCorner, runDirection).filter((row) => allowed.has(row.label));
  }, [layoutWallLabels, originCorner, room, runDirection]);
  // Wall-list shape model (Tom, owner voice, Nov 24 2026, 12:50 PM CT): every wall in order with
  // its angle to the next one; an empty wall stays listed and counted; the label is derived.
  const roomWalls = useMemo(() => (room?.customWalls?.length ? autoDesignWallList(room, placed) : []), [placed, room]);
  const roomShapeLabel = useMemo(() => autoDesignShapeLabel(roomWalls), [roomWalls]);
  const wallWidthText = (label: WallLabel) => wallWidths.find((row) => row.label === label)?.text ?? label;
  const usableSpan = (label: WallLabel) => autoDesignWallUsableSpan({ room, layoutType, originCorner, runDirection, wallCount }, label);
  /** Openings on one wall in measurement space, split into doors (block every base) and windows. */
  const openingSpans = (label: WallLabel): { doors: Interval[]; windows: Interval[] } => {
    const span = usableSpan(label);
    const doors: Interval[] = [];
    const windows: Interval[] = [];
    if (!span?.engineWallId) return { doors, windows };
    for (const opening of openings) {
      if (opening.side !== span.engineWallId) continue;
      const a = span.toMeasurement(opening.offset);
      const b = span.toMeasurement(opening.offset + opening.width);
      const interval = { start: Math.min(a, b), end: Math.max(a, b) };
      (opening.kind === "window" ? windows : doors).push(interval);
    }
    return { doors, windows };
  };
  /**
   * Tom (owner voice, Nov 24 2026, 12:27 PM CT): choosing Wall 2 for the sink or
   * the range places both on Wall 2, centered as a pair; the customer can then
   * readjust either center. Other walls keep their existing behavior.
   */
  const placeSinkAndRangeOnWall = (label: WallLabel): boolean => {
    const span = usableSpan(label);
    if (!span) return false;
    const { doors, windows } = openingSpans(label);
    const pair = centeredSinkRangePair({
      lo: span.lo,
      hi: span.hi,
      sinkBaseWidthIn: sinkBaseWidth,
      dishwasherSide: noDishwasher ? "none" : dishwasherSide,
      includeStove: !omitted.stove,
      blockedForRange: [...windows, ...doors],
      blockedForSink: doors,
    });
    if (!pair) return false;
    setEdited((current) => ({ ...current, sink: true, ...(pair.stoveCenterIn != null ? { stove: true } : {}) }));
    setValues((current) => ({
      ...current,
      sink: { wallLabel: label, centerOffsetIn: String(pair.sinkCenterIn) },
      ...(pair.stoveCenterIn != null ? { stove: { wallLabel: label, centerOffsetIn: String(pair.stoveCenterIn) } } : {}),
    }));
    return true;
  };
  const selectWallOrOmit = (field: PointField, value: string) => {
    if (field !== "sink" && value === `omit-${field}`) {
      setOmitted((current) => ({ ...current, [field]: true }));
      return;
    }
    if (field !== "sink") setOmitted((current) => ({ ...current, [field]: false }));
    if ((field === "sink" || field === "stove") && value === "Wall 2" && placeSinkAndRangeOnWall("Wall 2")) return;
    setValue(field, { wallLabel: value as WallLabel });
  };
  const measurement = (field: PointField) => ({
    wallLabel: values[field].wallLabel,
    centerOffsetIn: Number(values[field].centerOffsetIn),
  });
  const optionalMeasurement = (field: PointField) => values[field].centerOffsetIn.trim() ? measurement(field) : null;

  const noDishwasher = omitted.dishwasher || dishwasherSide === "none";
  // Typed values are obstacles the starting centers work around; only untouched fields follow the defaults.
  const typedValue = (field: PointField): AutoDesignDefaultMeasurement | null => {
    if (!edited[field] || !values[field].centerOffsetIn.trim()) return null;
    const center = Number(values[field].centerOffsetIn);
    return Number.isFinite(center) ? { wallLabel: values[field].wallLabel, centerOffsetIn: center } : null;
  };
  const typedKey = (Object.keys(labels) as PointField[]).map((field) => {
    const typed = typedValue(field);
    return typed ? `${field}:${typed.wallLabel}:${typed.centerOffsetIn}` : `${field}:-`;
  }).join("|");
  const startingCenters = useMemo(() => autoDesignDefaultCenters({
    room,
    layoutType,
    originCorner,
    runDirection,
    wallCount,
    sinkBaseWidthIn: sinkBaseWidth,
    dishwasherSide: noDishwasher ? "none" : dishwasherSide,
    includeStove: !omitted.stove,
    includeRefrigerator: !omitted.refrigerator,
    refrigeratorWidthIn: refrigeratorWidth,
    fixed: { sink: typedValue("sink"), stove: typedValue("stove"), refrigerator: typedValue("refrigerator"), dishwasher: typedValue("dishwasher") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [room, layoutType, originCorner, runDirection, wallCount, sinkBaseWidth, noDishwasher, dishwasherSide, omitted.stove, omitted.refrigerator, refrigeratorWidth, typedKey]);
  useEffect(() => {
    setValues((current) => {
      let next = current;
      for (const field of ["sink", "stove", "refrigerator"] as const) {
        if (edited[field]) continue;
        const measurement = startingCenters[field];
        if (!measurement) continue;
        const centerOffsetIn = String(measurement.centerOffsetIn);
        if (current[field].wallLabel === measurement.wallLabel && current[field].centerOffsetIn === centerOffsetIn) continue;
        next = { ...next, [field]: { wallLabel: measurement.wallLabel, centerOffsetIn } };
      }
      return next;
    });
  }, [startingCenters, edited]);
  /**
   * Tom (owner voice, Nov 24 2026, 12:28 PM CT): a 36 in sink base is offered only
   * when it qualifies at the sink spot (corner cabinet room, the other appliances
   * on that wall and doorways reserved); when it qualifies, smaller sink bases are
   * not offered. Otherwise 36 in is disabled with a reason and the largest width
   * that fits is offered.
   */
  const sinkFit = useMemo(() => {
    const label = values.sink.wallLabel;
    const span = autoDesignWallUsableSpan({ room, layoutType, originCorner, runDirection, wallCount }, label);
    if (!span) return null;
    // Only customer-placed appliances are fixed obstacles; untouched starting centers are
    // repacked around the sink base, so counting them would make the pick flip back and forth.
    const obstacles: Interval[] = [];
    if (edited.stove && !omitted.stove && values.stove.wallLabel === label && values.stove.centerOffsetIn.trim()) {
      const c = Number(values.stove.centerOffsetIn);
      if (Number.isFinite(c)) obstacles.push({ start: c - 15, end: c + 15 });
    }
    if (edited.refrigerator && !omitted.refrigerator && values.refrigerator.wallLabel === label && values.refrigerator.centerOffsetIn.trim()) {
      const c = Number(values.refrigerator.centerOffsetIn);
      const half = refrigeratorWidth / 2 + 1.5;
      if (Number.isFinite(c)) obstacles.push({ start: c - half, end: c + half });
    }
    if (span.engineWallId) {
      for (const opening of openings) {
        if (opening.side !== span.engineWallId || opening.kind === "window") continue;
        const a = span.toMeasurement(opening.offset);
        const b = span.toMeasurement(opening.offset + opening.width);
        obstacles.push({ start: Math.min(a, b), end: Math.max(a, b) });
      }
    }
    const typedCenter = edited.sink && values.sink.centerOffsetIn.trim() ? Number(values.sink.centerOffsetIn) : null;
    return sinkBaseFitOptions({
      lo: span.lo,
      hi: span.hi,
      sinkCenterIn: typedCenter != null && Number.isFinite(typedCenter) ? typedCenter : null,
      dishwasherSide: noDishwasher ? "none" : dishwasherSide,
      obstacles,
    });
  }, [dishwasherSide, edited.refrigerator, edited.sink, edited.stove, layoutType, noDishwasher, omitted.refrigerator, omitted.stove, openings, originCorner, refrigeratorWidth, room, runDirection, values.refrigerator, values.sink, values.stove, wallCount]);
  useEffect(() => {
    if (!sinkFit || sinkFit.recommended == null) return;
    if (sinkFit.offered.includes(sinkBaseWidth)) return;
    setSinkBaseWidth(sinkFit.recommended as SinkBaseWidth);
  }, [sinkBaseWidth, sinkFit]);
  const submit = () => {
    setSubmitError(null);
    const missing = intakeMissing(intake);
    if (missing.length) {
      setSubmitError(missing.join(" "));
      return;
    }
    const result = onBuild({
      intake,
      layoutType,
      originCorner,
      runDirection,
      wallCabinetHeightIn: wallCabinetHeight,
      sink: measurement("sink"),
      sinkBaseWidthIn: sinkBaseWidth,
      sinkBaseKind,
      stove: omitted.stove ? null : measurement("stove"),
      dishwasher: noDishwasher ? null : optionalMeasurement("dishwasher"),
      skipDishwasher: noDishwasher,
      dishwasherSide: noDishwasher ? "none" : dishwasherSide,
      refrigerator: omitted.refrigerator ? null : measurement("refrigerator"),
      refrigeratorWidthIn: refrigeratorWidth,
      refrigeratorPanels: "both",
      refrigeratorEnclosure: "cabinet-above",
      sinkWindowCenter: windowAboveSink
        ? { wallLabel: values.sink.wallLabel, centerOffsetIn: Number(values.sink.centerOffsetIn) }
        : null,
      overRangeAnswer,
      kitchenUsage: kitchenUses.length
        ? { uses: kitchenUses, skipped: false, acceptedSuggestionIds: [] }
        : { uses: [], skipped: true, acceptedSuggestionIds: [] },
    });
    if (!result.ok) setSubmitError(result.message);
  };

  const keepOpenForChildPicker = (event: { preventDefault: () => void }) => {
    if (childPickerOpen) event.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent hideOverlay onInteractOutside={keepOpenForChildPicker} onPointerDownOutside={keepOpenForChildPicker} onFocusOutside={keepOpenForChildPicker} className="max-h-[90vh] w-[calc(100vw-2rem)] sm:max-w-2xl 2xl:!left-auto 2xl:!right-4 2xl:!w-[28rem] 2xl:!translate-x-0 overflow-y-auto overflow-x-hidden" data-testid="auto-design-auto-build-dialog">
	        <DialogHeader>
	          <DialogTitle>Auto-Design</DialogTitle>
	          <DialogDescription>
	            Choose the layout and datum first. Every measured anchor uses its own selector from up to six actual room walls and a center measurement from that wall’s starting corner.
	          </DialogDescription>
	        </DialogHeader>
	        <div className="grid gap-4">
	          {blockedNotice && (
	            <div role="status" data-testid="auto-design-blocked-notice" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
	              <p>{blockedNotice.message}</p>
	              {(blockedNotice.actions ?? []).length > 0 && (
	                <div className="mt-2 flex flex-wrap gap-2">
	                  {(blockedNotice.actions ?? []).map((action) => (
	                    <Button key={action.id} type="button" size="sm" variant="outline" data-testid={`auto-design-blocked-action-${action.id}`} onClick={action.onClick}>
	                      {action.label}
	                    </Button>
	                  ))}
	                </div>
	              )}
	            </div>
	          )}
	          <AutoDesignIntakeSection intake={intake} onChange={setIntake} />
	          {onLoadSixWallTrainingRoom && (
	            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/70 p-3">
	              <div className="min-w-0 text-xs leading-relaxed text-slate-700">
	                <p className="font-semibold text-slate-900">Staff training room</p>
	                <p>Load a blank L-shaped room with six numbered physical walls. This does not build a kitchen.</p>
	              </div>
	              <Button type="button" variant="outline" size="sm" className="shrink-0 border-sky-300 bg-white text-sky-900 hover:bg-sky-100" onClick={() => {
	                const result = onLoadSixWallTrainingRoom();
	                if (!result.ok) setSubmitError(result.message);
	              }} data-testid="auto-design-load-six-wall-training-room">
	                Load six-wall training room
	              </Button>
	            </div>
	          )}
	          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
	            <div className="space-y-1.5">
	              <Label>Layout type</Label>
	              <Select value={layoutType} onValueChange={(value) => setLayoutType(value as AutoDesignLayoutType)}>
	                <SelectTrigger aria-label="Layout type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-wall">Single wall</SelectItem>
                  <SelectItem value="galley">Galley</SelectItem>
                  <SelectItem value="l-shape">L-shape</SelectItem>
                  <SelectItem value="u-shape">U-shape</SelectItem>
                </SelectContent>
              </Select>
            </div>
	            <div className="space-y-1.5">
	              <Label>Starting corner</Label>
	              <Select value={originCorner} onValueChange={(value) => setOriginCorner(value as AutoDesignOriginCorner)}>
	                <SelectTrigger aria-label="Starting corner"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Left corner</SelectItem><SelectItem value="right">Right corner</SelectItem></SelectContent>
              </Select>
            </div>
	            <div className="space-y-1.5">
	              <Label>Run direction</Label>
	              <Select value={runDirection} onValueChange={(value) => setRunDirection(value as AutoDesignRunDirection)}>
	                <SelectTrigger aria-label="Run direction"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="right">To the right</SelectItem><SelectItem value="left">To the left</SelectItem></SelectContent>
              </Select>
            </div>
	          </div>

              <div data-testid="auto-design-floor-plan-wall-key" className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">Wall widths for this setup</p>
                <p className="mt-1 leading-relaxed">Each width follows the current room and this starting corner and direction. Place each appliance at the center measurement you want along that wall.</p>
                {wallWidths.length > 0 && (
                  <ul data-testid="auto-design-wall-widths" className="mt-2 grid gap-1 sm:grid-cols-2">
                    {wallWidths.map((row) => (
                      <li key={row.label} data-testid={`auto-design-wall-width-${row.label.replace(/\s+/g, "-").toLowerCase()}`} className="font-semibold text-slate-900">
                        {row.text}
                      </li>
                    ))}
                  </ul>
                )}
                {roomWalls.length > 0 && (
                  <div data-testid="auto-design-room-walls" className="mt-2 border-t border-sky-200 pt-2">
                    <p className="font-semibold text-slate-900">Room shape: <span data-testid="auto-design-room-shape">{roomShapeLabel}</span></p>
                    <ol className="mt-1 grid gap-0.5">
                      {roomWalls.map((wall) => (
                        <li key={wall.wallId} data-testid={`auto-design-room-wall-${wall.index}`} data-empty={wall.empty ? "true" : "false"}>
                          {wall.label}: {Math.round(wall.lengthIn * 8) / 8}″{wall.empty ? " · empty run" : ""}{wall.angleToNextDeg != null ? ` · ${wall.angleToNextDeg}° to Wall ${wall.index + 1}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="mt-2 leading-relaxed">Colored Wall 1–6 markers are shown on the Floor Plan. The matching small dot marks the corner where that wall’s center measurements begin.</p>
              </div>

	          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            Choose from up to six real room walls for each appliance. The measurement is that item’s center from the selected wall’s labeled starting corner; raw X/Y floor coordinates are never used. The sink base remains required; choose Do not add for a range, dishwasher, or refrigerator you do not want in this build.
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="auto-design-build-order">
            <p className="font-semibold">Build order</p>
            <p>1. Measured appliances and sink base. 2. Place the required corner cabinets automatically before any other cabinets on those walls. 3. Fill remaining runs with the largest practical regular base cabinets. 4. Place source-sized, aligned wall cabinets above.</p>
            <p className="mt-1 text-xs text-muted-foreground">Specialty bases are not selected automatically. Wall cabinets respect the selected height, windows, doors, refrigerator bay, and ceiling; unavailable or blocked matches are flagged for review.</p>
          </div>
          {catalogLoading && (
            <div role="status" data-testid="auto-design-catalog-loading" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Loading the selected line’s source-priced cabinets. Build measured kitchen will be available as soon as the catalog is ready.
            </div>
          )}

          <div className="space-y-1.5 rounded-lg border p-3">
            <Label htmlFor="auto-design-wall-cabinet-height">Wall-cabinet height</Label>
            <Select value={String(wallCabinetHeight)} onValueChange={(value) => setWallCabinetHeight(Number(value) as WallCabinetHeight)}>
              <SelectTrigger id="auto-design-wall-cabinet-height" aria-label="Wall cabinet height"><SelectValue /></SelectTrigger>
              <SelectContent>{([30, 36, 42] as const).map((height) => <SelectItem key={height} value={String(height)}>{height}″ wall cabinets</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose the source-priced upper-cabinet height for this kitchen: 30″, 36″, or 42″.</p>
          </div>

          <div className="grid gap-2">
            <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,11rem)] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Appliance / fixture</span><span>Place on wall</span><span>Center from selected wall start (in.)</span>
            </div>
            {(Object.keys(labels) as PointField[]).map((field) => (
              <div key={field} className="grid min-w-0 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,11rem)] items-center gap-2">
                <Label htmlFor={`auto-design-${field}-center`}>{labels[field]}</Label>
                <Select value={field !== "sink" && omitted[field] ? `omit-${field}` : values[field].wallLabel} onValueChange={(value) => selectWallOrOmit(field, value)}>
                  <SelectTrigger className="w-full min-w-0" aria-label={wallSelectionLabels[field]}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {field !== "sink" && <SelectItem value={`omit-${field}`}>{omissionLabels[field]}</SelectItem>}
                    {layoutWallLabels.map((wall) => <SelectItem key={wall} value={wall}>{wallWidthText(wall)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex min-w-0 w-full items-center gap-2">
                  <Input
                    className="min-w-0 w-full"
                    id={`auto-design-${field}-center`}
                    type="number"
                    min="0"
                    step="0.125"
                    placeholder={field === "dishwasher" ? "Leave blank for sink side" : undefined}
                    value={values[field].centerOffsetIn}
                    onChange={(event) => setValue(field, { centerOffsetIn: event.target.value })}
                    disabled={(field !== "sink" && omitted[field]) || (field === "dishwasher" && noDishwasher)}
                    aria-label={`${labels[field]} center from selected wall start in inches`}
                  />
                  {field === "sink" && (
                    <label
                      htmlFor="auto-design-sink-window"
                      className="flex shrink-0 items-center gap-1 text-sm font-medium"
                      data-testid="auto-design-sink-window-label"
                    >
                      <Checkbox
                        id="auto-design-sink-window"
                        checked={windowAboveSink}
                        onCheckedChange={(checked) => setWindowAboveSink(checked === true)}
                        aria-label="window"
                        data-testid="auto-design-sink-window"
                      />
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      window
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="auto-design-sink-base-size">Sink base size</Label>
              <Select value={String(sinkBaseWidth)} onValueChange={(value) => setSinkBaseWidth(Number(value) as SinkBaseWidth)}>
                <SelectTrigger id="auto-design-sink-base-size" aria-label="Sink base size"><SelectValue /></SelectTrigger>
                <SelectContent>{AUTO_DESIGN_SINK_BASE_WIDTHS
                  .filter((width) => !sinkFit || sinkFit.offered.includes(width) || sinkFit.disabled.some((entry) => entry.width === width))
                  .map((width) => (
                    <SelectItem key={width} value={String(width)} disabled={Boolean(sinkFit && !sinkFit.offered.includes(width))} data-testid={`auto-design-sink-base-option-${width}`}>
                      SB{width} · {width}″
                    </SelectItem>
                  ))}</SelectContent>
              </Select>
              {sinkFit && !sinkFit.qualifies36 && sinkFit.disabled.find((entry) => entry.width === 36) && (
                <p className="text-xs font-medium text-amber-800" data-testid="auto-design-sink-base-36-reason">
                  {sinkFit.disabled.find((entry) => entry.width === 36)!.reason}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Builds the selected, source-priced sink base—not a generic sink appliance.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-design-sink-base-kind">Sink base style</Label>
              <Select value={sinkBaseKind} onValueChange={(value) => setSinkBaseKind(value as AutoDesignSinkBaseKind)}>
                <SelectTrigger id="auto-design-sink-base-kind" aria-label="Sink base style"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular sink base (default)</SelectItem>
                  <SelectItem value="farmhouse">Farmhouse (apron-front) sink base</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">A regular sink base is used unless you choose farmhouse here.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2" data-testid="auto-design-range-option">
              <Label>Range</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="auto-design-open-range-picker"
                  onClick={onOpenRangePicker}
                  disabled={!onOpenRangePicker}
                >
                  <Flame className="mr-1.5 h-3.5 w-3.5" /> Choose a range
                </Button>
                <span className="min-w-0 text-xs text-muted-foreground" data-testid="auto-design-range-selection">
                  {selectedRangeLabel ?? "No range picked — the build seats the standard 30″ range."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Opens the range pop-up. The pick is placed automatically at the range center above, and the corner cabinets on that wall are planned around its real width.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2" data-testid="auto-design-sink-option">
              <Label>Sink</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="auto-design-open-sink-picker"
                  onClick={onOpenSinkPicker}
                  disabled={!onOpenSinkPicker}
                >
                  <Droplets className="mr-1.5 h-3.5 w-3.5" /> Choose a sink
                </Button>
                <span className="min-w-0 text-xs text-muted-foreground" data-testid="auto-design-sink-selection">
                  {selectedSinkName ?? "Asked after the build, right before the faucet step."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-Design does not place a sink during the build. When the layout is built it asks which Pelican sink goes in
                the sink base, then asks for the faucet — the same timing as the faucet step. A farmhouse sink switches the build
                to its matching farmhouse base.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2" data-testid="auto-design-tall-option">
              <Label>Tall oven or pantry cabinet</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="auto-design-open-tall-picker"
                  onClick={onOpenTallPicker}
                  disabled={!onOpenTallPicker}
                >
                  <Boxes className="mr-1.5 h-3.5 w-3.5" /> Choose a tall cabinet
                </Button>
                <span className="min-w-0 text-xs text-muted-foreground" data-testid="auto-design-tall-selection">
                  {selectedTallSummary ?? "No tall cabinet — the runs stay at counter height."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Opens the tall-cabinet pop-up. A pick is placed automatically in the first free span that clears the wall ends, the refrigerator panels, and this room's ceiling.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-design-dishwasher-side">Dishwasher side</Label>
              <Select value={noDishwasher ? "none" : dishwasherSide} onValueChange={(value) => {
                const side = value as DishwasherSideChoice;
                setDishwasherSide(side);
                setOmitted((current) => ({ ...current, dishwasher: side === "none" }));
                onDishwasherSideChange?.(side);
              }} disabled={omitted.dishwasher && dishwasherSide !== "none"}>
                <SelectTrigger id="auto-design-dishwasher-side" aria-label="Dishwasher side"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left of sink</SelectItem>
                  <SelectItem value="right">Right of sink</SelectItem>
                  <SelectItem value="none">No dishwasher</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{noDishwasher ? "No dishwasher or dishwasher panel will be added. That run is filled with regular base cabinets." : "Left of sink, right of sink, or no dishwasher. Auto-Design keeps a dishwasher against the sink when it can, and otherwise on this side as close as possible."}</p>
            </div>
          </div>

          {!omitted.refrigerator && (
            <div className="rounded-lg border p-3" data-testid="auto-design-refrigerator-options">
              <div className="space-y-1.5">
                <Label>Refrigerator bay</Label>
                <Select value={String(refrigeratorWidth)} onValueChange={(value) => setRefrigeratorWidth(Number(value) as RefrigeratorWidth)}>
                  <SelectTrigger id="auto-design-refrigerator-size" aria-label="Refrigerator size" className="sm:max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{([30, 33, 36, 42] as const).map((width) => <SelectItem key={width} value={String(width)}>{width}″ refrigerator</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-sm font-medium">{refrigeratorWidth}″ refrigerator · Two source-priced side panels · Matching source-priced {refrigeratorWidth}″ cabinet above</p>
                <p className="text-xs text-muted-foreground">Auto-Design creates this complete refrigerator bay before filling surrounding runs. A refrigerator bay never uses a filler.</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5 rounded-lg border p-3" data-testid="auto-design-over-range">
            <Label htmlFor="auto-design-over-range-answer">What goes above the range?</Label>
            <Select value={overRangeAnswer} onValueChange={(value) => setOverRangeAnswer(value as "hood" | "microwave-bridge" | "open")}>
              <SelectTrigger id="auto-design-over-range-answer" aria-label="What goes above the range"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hood">Range hood</SelectItem>
                <SelectItem value="microwave-bridge">Microwave and bridge cabinet</SelectItem>
                <SelectItem value="open">Leave it open</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choosing a microwave and bridge places both now, centered over the range, instead of asking again after the build.</p>
          </div>
          <fieldset className="space-y-2 rounded-lg border p-3" data-testid="auto-design-kitchen-use">
            <legend className="px-1 text-sm font-medium">How do you use this kitchen?</legend>
            <p className="text-xs text-muted-foreground">Optional. Pick any that apply. You can build without answering, and saving is never blocked if this stays blank.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {KITCHEN_USE_OPTIONS.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm" htmlFor={`kitchen-use-${option.id}`}>
                  <Checkbox
                    id={`kitchen-use-${option.id}`}
                    checked={kitchenUses.includes(option.id)}
                    onCheckedChange={(checked) => setKitchenUses((current) => checked
                      ? Array.from(new Set([...current, option.id]))
                      : current.filter((use) => use !== option.id))}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          {submitError && (
            <div role="alert" data-testid="auto-design-build-error" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={catalogLoading} data-testid="auto-design-build-submit">Build measured kitchen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
