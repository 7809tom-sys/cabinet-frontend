import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AUTO_DESIGN_WALL_LABELS, autoDesignWallWidthRows } from "@/lib/autoDesignAutoBuild";
import type { RoomData } from "@/lib/design";
import type {
  DishwasherSide,
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
  /** The selected line's source-priced base catalog is still arriving. */
  catalogLoading?: boolean;
  /** Actual room-wall count, capped by the shared six-wall input contract. */
  wallCount?: number;
  /** Live room used to label each setup wall with its current width. */
  room?: RoomData;
  /** Visual-only Floor Plan guide; receives the same datum choices as anchor measurements. */
  onWallGuideChange?: (selection: { originCorner: AutoDesignOriginCorner; runDirection: AutoDesignRunDirection }) => void;
  /** Replaces only an empty admin Designer room with the blank six-wall training shell. */
  onLoadSixWallTrainingRoom?: () => AutoDesignSubmitResult;
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

export function AutoDesignDialog({ open, onOpenChange, onBuild, catalogLoading = false, wallCount = 4, room, onWallGuideChange, onLoadSixWallTrainingRoom }: Props) {
  const [layoutType, setLayoutType] = useState<AutoDesignLayoutType>("single-wall");
  const [originCorner, setOriginCorner] = useState<AutoDesignOriginCorner>("left");
  const [runDirection, setRunDirection] = useState<AutoDesignRunDirection>("right");
  const [values, setValues] = useState<Record<PointField, FieldValue>>({
    sink: { wallLabel: "Wall 1", centerOffsetIn: "24" },
    stove: { wallLabel: "Wall 1", centerOffsetIn: "120" },
    dishwasher: { wallLabel: "Wall 1", centerOffsetIn: "" },
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: "84" },
  });
  const [omitted, setOmitted] = useState<Record<(typeof applianceFields)[number], boolean>>({
    stove: false,
    dishwasher: false,
    refrigerator: false,
  });
  const [sinkBaseWidth, setSinkBaseWidth] = useState<SinkBaseWidth>(36);
  const [sinkBaseKind, setSinkBaseKind] = useState<AutoDesignSinkBaseKind>("regular");
  const [wallCabinetHeight, setWallCabinetHeight] = useState<WallCabinetHeight>(30);
  const [dishwasherSide, setDishwasherSide] = useState<DishwasherSide>("right");
  const refrigeratorWidth: RefrigeratorWidth = 36;
  const [windowCenter, setWindowCenter] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) onWallGuideChange?.({ originCorner, runDirection });
  }, [open, onWallGuideChange, originCorner, runDirection]);

  const setValue = (field: PointField, patch: Partial<FieldValue>) => setValues((current) => ({
    ...current,
    [field]: { ...current[field], ...patch },
  }));
  const availableWallLabels = AUTO_DESIGN_WALL_LABELS.slice(0, Math.max(1, Math.min(AUTO_DESIGN_WALL_LABELS.length, wallCount)));
  const wallWidths = useMemo(() => {
    if (!room) return [];
    const allowed = new Set<string>(availableWallLabels);
    return autoDesignWallWidthRows(room, originCorner, runDirection).filter((row) => allowed.has(row.label));
  }, [availableWallLabels, originCorner, room, runDirection]);
  const wallWidthText = (label: WallLabel) => wallWidths.find((row) => row.label === label)?.text ?? label;
  const selectWallOrOmit = (field: PointField, value: string) => {
    if (field !== "sink" && value === `omit-${field}`) {
      setOmitted((current) => ({ ...current, [field]: true }));
      return;
    }
    setValue(field, { wallLabel: value as WallLabel });
    if (field !== "sink") setOmitted((current) => ({ ...current, [field]: false }));
  };
  const measurement = (field: PointField) => ({
    wallLabel: values[field].wallLabel,
    centerOffsetIn: Number(values[field].centerOffsetIn),
  });
  const optionalMeasurement = (field: PointField) => values[field].centerOffsetIn.trim() ? measurement(field) : null;

  const submit = () => {
    setSubmitError(null);
    const result = onBuild({
      layoutType,
      originCorner,
      runDirection,
      wallCabinetHeightIn: wallCabinetHeight,
      sink: measurement("sink"),
      sinkBaseWidthIn: sinkBaseWidth,
      sinkBaseKind,
      stove: omitted.stove ? null : measurement("stove"),
      dishwasher: omitted.dishwasher ? null : optionalMeasurement("dishwasher"),
      skipDishwasher: omitted.dishwasher,
      dishwasherSide,
      refrigerator: omitted.refrigerator ? null : measurement("refrigerator"),
      refrigeratorWidthIn: refrigeratorWidth,
      refrigeratorPanels: "both",
      refrigeratorEnclosure: "cabinet-above",
      sinkWindowCenter: windowCenter.trim()
        ? { wallLabel: values.sink.wallLabel, centerOffsetIn: Number(windowCenter) }
        : null,
    });
    if (!result.ok) setSubmitError(result.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent hideOverlay className="max-h-[90vh] w-[calc(100vw-2rem)] sm:max-w-2xl 2xl:!left-auto 2xl:!right-4 2xl:!w-[28rem] 2xl:!translate-x-0 overflow-y-auto overflow-x-hidden" data-testid="auto-design-auto-build-dialog">
	        <DialogHeader>
	          <DialogTitle>Auto-Design</DialogTitle>
	          <DialogDescription>
	            Choose the layout and datum first. Every measured anchor uses its own selector from up to six actual room walls and a center measurement from that wall’s starting corner.
	          </DialogDescription>
	        </DialogHeader>
	        <div className="grid gap-4">
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
                <p className="mt-2 leading-relaxed">Colored Wall 1–6 markers are shown on the Floor Plan. The matching small dot marks the corner where that wall’s center measurements begin.</p>
              </div>

	          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            Choose from up to six real room walls for each appliance. The measurement is that item’s center from the selected wall’s labeled starting corner; raw X/Y floor coordinates are never used. The sink base remains required; choose Do not add for a range, dishwasher, or refrigerator you do not want in this build.
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="auto-design-build-order">
            <p className="font-semibold">Build order</p>
            <p>1. Measured appliances and sink base. 2. Select and place the required corner cabinets. 3. Fill remaining runs with the largest practical regular base cabinets. 4. Place source-sized, aligned wall cabinets above.</p>
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
                    {availableWallLabels.map((wall) => <SelectItem key={wall} value={wall}>{wallWidthText(wall)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  className="min-w-0 w-full"
                  id={`auto-design-${field}-center`}
                  type="number"
                  min="0"
                  step="0.125"
                  placeholder={field === "dishwasher" ? "Leave blank for sink side" : undefined}
                  value={values[field].centerOffsetIn}
                  onChange={(event) => setValue(field, { centerOffsetIn: event.target.value })}
                  disabled={field !== "sink" && omitted[field]}
                  aria-label={`${labels[field]} center from selected wall start in inches`}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="auto-design-sink-base-size">Sink base size</Label>
              <Select value={String(sinkBaseWidth)} onValueChange={(value) => setSinkBaseWidth(Number(value) as SinkBaseWidth)}>
                <SelectTrigger id="auto-design-sink-base-size" aria-label="Sink base size"><SelectValue /></SelectTrigger>
                <SelectContent>{([30, 33, 36, 42] as const).map((width) => <SelectItem key={width} value={String(width)}>SB{width} · {width}″</SelectItem>)}</SelectContent>
              </Select>
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
            <div className="space-y-1.5">
              <Label htmlFor="auto-design-dishwasher-side">Dishwasher position</Label>
              <Select value={dishwasherSide} onValueChange={(value) => setDishwasherSide(value as DishwasherSide)} disabled={omitted.dishwasher}>
                <SelectTrigger id="auto-design-dishwasher-side" aria-label="Dishwasher position"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Left of sink</SelectItem><SelectItem value="right">Right of sink</SelectItem></SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{omitted.dishwasher ? "No dishwasher will be added." : "Used when the optional exact dishwasher center is blank. An exact center takes precedence."}</p>
            </div>
          </div>

          {!omitted.refrigerator && (
            <div className="rounded-lg border p-3" data-testid="auto-design-refrigerator-options">
              <div className="space-y-1.5">
                <Label>Refrigerator bay</Label>
                <p className="text-sm font-medium">36″ refrigerator · Two source-priced side panels · Matching source-priced 36″ cabinet above</p>
                <p className="text-xs text-muted-foreground">Auto-Design creates this complete refrigerator bay before filling surrounding runs. A refrigerator bay never uses a filler.</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auto-design-window-center">Window above the sink: center from the sink wall’s starting corner (in.)</Label>
            <Input id="auto-design-window-center" type="number" min="0" step="0.125" placeholder="Leave blank when there is no window" value={windowCenter} onChange={(event) => setWindowCenter(event.target.value)} />
            <p className="text-xs text-muted-foreground" data-testid="auto-design-window-help">
              The sink is centered on this measurement and a window as wide as the sink base is placed above it. No wall cabinet goes above the sink, and the next cabinets start 3 inches past the window. Leave blank for nothing above the sink.
            </p>
          </div>
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
