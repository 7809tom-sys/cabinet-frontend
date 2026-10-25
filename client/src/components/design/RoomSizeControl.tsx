import { useState, useEffect } from "react";
import { Maximize, Ruler, Check, ChevronDown, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  RoomData, inchesToFeetInches, parseLengthToInches, clampRoomInches,
  roomCeiling, CEILING_HEIGHT_PRESETS, MIN_CEILING_HEIGHT, MAX_CEILING_HEIGHT, ROOM_MIN_IN, ROOM_MAX_IN,
  type WallSide, type WallCeiling, wallCeiling, clampCeilingHeight,
} from "@/lib/design";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  room: RoomData;
  onChange: (room: RoomData) => void;
  /** Closet reach-in depth can be 24–30 in; kitchen room minimum remains unchanged. */
  minimumDepthIn?: number;
  drawMode: boolean;
  onToggleDraw: () => void;
  /** Whether the room is currently in polygon (custom shape) mode. */
  isPolygon?: boolean;
  /** Enter selected-wall Compass editing mode. */
  onTogglePolygon?: () => void;
}

const PRESETS: { label: string; width: number; depth: number }[] = [
  { label: "10 × 8", width: 120, depth: 96 },
  { label: "10 × 10", width: 120, depth: 120 },
  { label: "12 × 10", width: 144, depth: 120 },
  { label: "12 × 12", width: 144, depth: 144 },
  { label: "16 × 12", width: 192, depth: 144 },
];

// The four walls in display order, with their plan-side key.
const WALLS: { side: WallSide; labelKey: "dt_rs_back_wall" | "dt_rs_side_wall" | "plan_wall_left" | "plan_wall_right" }[] = [
  { side: "top", labelKey: "dt_rs_back_wall" },
  { side: "bottom", labelKey: "dt_rs_side_wall" },
  { side: "left", labelKey: "plan_wall_left" },
  { side: "right", labelKey: "plan_wall_right" },
];

// ─── Unit helpers ─────────────────────────────────────────────────────────────

const INCHES_PER_METER = 39.3701;

/** Convert inches to a display string in the chosen unit. */
function toDisplayString(totalInches: number, metric: boolean): string {
  if (metric) {
    const m = totalInches / INCHES_PER_METER;
    return `${Math.round(m * 100) / 100} m`;
  }
  const { feet, inches } = inchesToFeetInches(totalInches);
  if (inches === 0) return `${feet}'`;
  return `${feet}' ${inches}"`;
}

/** Parse a user-typed string (feet/inches OR meters) to inches. Returns null if invalid. */
function parseDisplayToInches(str: string, metric: boolean): number | null {
  if (metric) {
    // Accept "3.05", "3.05 m", "3,05"
    const cleaned = str.replace(/[,]/g, ".").replace(/\s*m\s*$/i, "").trim();
    const v = parseFloat(cleaned);
    if (!isFinite(v) || v <= 0) return null;
    return v * INCHES_PER_METER;
  }
  return parseLengthToInches(str);
}

// ─── Shared form body (used by both desktop popover and mobile inline) ────────

interface FormBodyProps {
  room: RoomData;
  onChange: (room: RoomData) => void;
  minimumDepthIn?: number;
  onApplied?: () => void;
  /** Whether to show the Apply button (desktop popover uses it; inline always shows it). */
  showApply?: boolean;
}

function RoomSizeFormBody({ room, onChange, minimumDepthIn, onApplied, showApply = true }: FormBodyProps) {
  const { t } = useLanguage();
  // Saved reach-in rooms must not expand to the 36-inch kitchen minimum simply
  // because a room-type switch and a toolbar popover rendered in adjacent frames.
  const roomMinimumDepthIn = minimumDepthIn ?? (room.depth < ROOM_MIN_IN ? 24 : undefined);
  const [metric, setMetric] = useState(false);
  const [showPerWall, setShowPerWall] = useState(
    () => !!room.wallCeilings && Object.keys(room.wallCeilings).length > 0,
  );

  const [wStr, setWStr] = useState(() => toDisplayString(room.width, false));
  const [dStr, setDStr] = useState(() => toDisplayString(room.depth, false));
  const [cStr, setCStr] = useState(() => toDisplayString(roomCeiling(room), false));
  const [perWall, setPerWall] = useState<Partial<Record<WallSide, WallCeiling>>>(
    () => ({ ...(room.wallCeilings ?? {}) }),
  );

  // Sync fields when room changes externally (mouse-draw / package preload).
  useEffect(() => {
    setWStr(toDisplayString(room.width, metric));
    setDStr(toDisplayString(room.depth, metric));
    setCStr(toDisplayString(roomCeiling(room), metric));
    setPerWall({ ...(room.wallCeilings ?? {}) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.width, room.depth, room.ceilingHeight, room.wallCeilings]);

  // When the unit toggle changes, re-express current field values in the new unit.
  const handleToggleMetric = (next: boolean) => {
    const wIn = parseDisplayToInches(wStr, metric);
    const dIn = parseDisplayToInches(dStr, metric);
    const cIn = parseDisplayToInches(cStr, metric);
    setMetric(next);
    if (wIn != null) setWStr(toDisplayString(wIn, next));
    if (dIn != null) setDStr(toDisplayString(dIn, next));
    if (cIn != null) setCStr(toDisplayString(cIn, next));
  };

  const wParsed = parseDisplayToInches(wStr, metric);
  const dParsed = parseDisplayToInches(dStr, metric);
  const cParsed = parseDisplayToInches(cStr, metric);
  const wValid = wParsed != null;
  const dValid = dParsed != null;
  const cValid = cParsed != null && cParsed >= MIN_CEILING_HEIGHT && cParsed <= MAX_CEILING_HEIGHT;

  const apply = () => {
    if (!wValid || !dValid || !cValid) return;
    const flat = Math.round(cParsed!);
    const cleaned: Partial<Record<WallSide, WallCeiling>> = {};
    for (const { side } of WALLS) {
      const wc = perWall[side];
      if (!wc) continue;
      const high = clampCeilingHeight(wc.high);
      const low = clampCeilingHeight(wc.low);
      const isSloped = Math.abs(high - low) > 0.5;
      if (!isSloped && high === flat) continue;
      cleaned[side] = isSloped
        ? { high: Math.max(high, low), low: Math.min(high, low), slopeFrom: wc.slopeFrom ?? "start" }
        : { high, low: high };
    }
    onChange({
      width: clampRoomInches(wParsed!),
      depth: roomMinimumDepthIn == null ? clampRoomInches(dParsed!) : Math.max(roomMinimumDepthIn, Math.min(ROOM_MAX_IN, Math.round(dParsed!))),
      ceilingHeight: flat,
      wallCeilings: Object.keys(cleaned).length ? cleaned : undefined,
    });
    onApplied?.();
  };

  const setWallMode = (side: WallSide, mode: "default" | "flat" | "sloped") => {
    setPerWall((prev) => {
      const next = { ...prev };
      if (mode === "default") {
        delete next[side];
      } else if (mode === "flat") {
        const cur = next[side] ?? wallCeiling(room, side);
        const h = clampCeilingHeight(cur.high);
        next[side] = { high: h, low: h };
      } else {
        const cur = next[side] ?? wallCeiling(room, side);
        const high = clampCeilingHeight(cur.high);
        const low = clampCeilingHeight(
          Math.abs(cur.high - cur.low) > 0.5 ? cur.low : Math.max(MIN_CEILING_HEIGHT, high - 24),
        );
        next[side] = { high: Math.max(high, low), low: Math.min(high, low), slopeFrom: cur.slopeFrom ?? "start" };
      }
      return next;
    });
  };

  const updateWall = (side: WallSide, patch: Partial<WallCeiling>) => {
    setPerWall((prev) => {
      const cur = prev[side] ?? wallCeiling(room, side);
      return { ...prev, [side]: { ...cur, ...patch } };
    });
  };

  const roomDefault = Math.round(cParsed ?? roomCeiling(room));

  return (
    <div className="space-y-3">
      {/* Header row: title + ft/m toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-4 w-4 text-[#a87f33] shrink-0" />
          <span className="text-sm font-semibold text-foreground">{t("dt_rs_measure_title")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-medium transition-colors ${!metric ? "text-foreground" : "text-muted-foreground"}`}>ft</span>
          <Switch
            checked={metric}
            onCheckedChange={handleToggleMetric}
            className="scale-75 origin-center"
          />
          <span className={`text-[11px] font-medium transition-colors ${metric ? "text-foreground" : "text-muted-foreground"}`}>m</span>
        </div>
      </div>

      {/* Hint text */}
      <p className="text-[11px] text-muted-foreground -mt-1">
        {metric
          ? "Enter measurements in meters, e.g. 3.05 m or 3.05"
          : `${t("dt_rs_measure_hint")} 10' 6", 126", 120 1/2.`}
      </p>

      {/* Dimension fields */}
      <div className="space-y-2.5">
        <UnitField
          label={t("dt_rs_back_wall")}
          value={wStr}
          onChange={setWStr}
          onEnter={apply}
          parsed={wParsed}
          valid={wValid}
          metric={metric}
        />
        <UnitField
          label={t("dt_rs_side_wall")}
          value={dStr}
          onChange={setDStr}
          onEnter={apply}
          parsed={dParsed}
          valid={dValid}
          metric={metric}
        />
        <UnitField
          label={t("dt_rs_ceiling")}
          value={cStr}
          onChange={setCStr}
          onEnter={apply}
          parsed={cParsed}
          valid={cValid}
          metric={metric}
          hint={metric
            ? `Min ${(MIN_CEILING_HEIGHT / INCHES_PER_METER).toFixed(2)} m, max ${(MAX_CEILING_HEIGHT / INCHES_PER_METER).toFixed(2)} m`
            : t("dt_rs_ceiling_hint", { min: MIN_CEILING_HEIGHT, max: MAX_CEILING_HEIGHT })}
        />
        {/* Ceiling height presets */}
        <div className="flex flex-wrap gap-1">
          {CEILING_HEIGHT_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setCStr(toDisplayString(h, metric))}
              className={`rounded-md border px-2 py-1 text-[11px] transition-colors hover:bg-muted/60 ${
                Math.round(cParsed ?? -1) === h ? "border-[#1a2744] bg-[#1a2744]/5 font-medium" : "border-border"
              }`}
            >
              {metric
                ? `${(h / INCHES_PER_METER).toFixed(2)} m`
                : `${h / 12}' (${h}")`}
            </button>
          ))}
        </div>
      </div>

      {/* Per-wall / sloped ceiling section */}
      <div className="rounded-md border border-border">
        <button
          type="button"
          onClick={() => setShowPerWall((v) => !v)}
          className="flex w-full items-center justify-between px-2.5 py-2 text-left"
        >
          <span className="text-[11px] font-semibold text-foreground">{t("dt_rs_per_wall_ceiling")}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showPerWall ? "rotate-180" : ""}`} />
        </button>
        {showPerWall && (
          <div className="space-y-2.5 border-t border-border px-2.5 py-2.5">
            <p className="text-[10px] text-muted-foreground">{t("dt_rs_per_wall_hint")}</p>
            {WALLS.map(({ side, labelKey }) => (
              <WallCeilingRow
                key={side}
                label={t(labelKey)}
                wc={perWall[side]}
                roomDefault={roomDefault}
                onMode={(m) => setWallMode(side, m)}
                onUpdate={(patch) => updateWall(side, patch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick presets */}
      {roomMinimumDepthIn != null ? (
        <p className="text-[11px] leading-5 text-muted-foreground">Reach-in depth may be as shallow as 24″. For a different bi-fold opening, start a blank room with Bedroom closet room templates; changing only the room size does not replace or recenter an existing doorway.</p>
      ) : <div>
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dt_rs_quick_presets")}</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onChange({ width: p.width, depth: p.depth, ceilingHeight: roomCeiling(room), wallCeilings: room.wallCeilings })}
              className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/60 transition-colors"
            >
              {metric
                ? `${(p.width / INCHES_PER_METER).toFixed(1)} × ${(p.depth / INCHES_PER_METER).toFixed(1)} m`
                : t("dt_rs_ft", { label: p.label })}
            </button>
          ))}
        </div>
      </div>}

      {showApply && (
        <>
          <Button
            onClick={apply}
            disabled={!wValid || !dValid || !cValid}
            className="w-full h-9 bg-[#1a2744] text-white hover:bg-[#243456] gap-1.5"
          >
            <Check className="h-4 w-4" /> {t("dt_rs_apply")}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            {t("dt_rs_tip")}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Desktop variant (Popover wrapper) ───────────────────────────────────────

export function RoomSizeControl({ room, onChange, minimumDepthIn, drawMode, onToggleDraw }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const wDisp = inchesToFeetInches(room.width);
  const dDisp = inchesToFeetInches(room.depth);
  const fmt = (v: { feet: number; inches: number }) =>
    v.inches === 0 ? `${v.feet}'` : `${v.feet}'${v.inches}"`;

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            title={`Edit room size · ${t("dt_room_label_h", { w: fmt(wDisp), d: fmt(dDisp), h: fmt(inchesToFeetInches(roomCeiling(room))) })}`}
            aria-label="Open room size"
          >
            <Maximize className="h-3.5 w-3.5" />
            <span>Room size</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-[80vh] overflow-y-auto" align="start">
          <RoomSizeFormBody
            room={room}
            onChange={onChange}
            minimumDepthIn={minimumDepthIn}
            onApplied={() => setOpen(false)}
            showApply
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Inline variant (for mobile sheet — no Popover wrapper) ──────────────────

interface InlineProps {
  room: RoomData;
  onChange: (room: RoomData) => void;
  minimumDepthIn?: number;
  /** Called after the user taps Apply so the parent can close the sheet. */
  onApplied?: () => void;
  /** Activates the selected wall's direct 45° drag handle. */
  onOpenWallCompass?: () => void;
  isPolygon?: boolean;
}

export function RoomSizeInline({ room, onChange, minimumDepthIn, onApplied, onOpenWallCompass, isPolygon }: InlineProps) {
  return (
    <div className="space-y-3">
      <RoomSizeFormBody
        room={room}
        onChange={onChange}
        minimumDepthIn={minimumDepthIn}
        onApplied={onApplied}
        showApply
      />
      {onOpenWallCompass && (
        <Button type="button" variant={isPolygon ? "default" : "outline"} className={`w-full gap-2 ${isPolygon ? "bg-[#1a2744] text-white hover:bg-[#283c63]" : ""}`} onClick={onOpenWallCompass} data-testid="mobile-wall-compass-entry">
          <Compass className="h-4 w-4" /> Drag 45° on selected wall
        </Button>
      )}
    </div>
  );
}

// ─── WallCeilingRow ───────────────────────────────────────────────────────────

function WallCeilingRow({
  label, wc, roomDefault, onMode, onUpdate,
}: {
  label: string;
  wc: WallCeiling | undefined;
  roomDefault: number;
  onMode: (mode: "default" | "flat" | "sloped") => void;
  onUpdate: (patch: Partial<WallCeiling>) => void;
}) {
  const { t } = useLanguage();
  const isSloped = !!wc && Math.abs(wc.high - wc.low) > 0.5;
  const mode: "default" | "flat" | "sloped" = !wc ? "default" : isSloped ? "sloped" : "flat";

  const pill = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[10px] transition-colors ${
      active ? "bg-[#1a2744] text-white" : "border border-border hover:bg-muted/60"
    }`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] text-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          <button type="button" className={pill(mode === "default")} onClick={() => onMode("default")}>
            {t("dt_rs_uses_default")}
          </button>
          <button type="button" className={pill(mode === "flat")} onClick={() => onMode("flat")}>
            {t("dt_rs_wall_flat")}
          </button>
          <button type="button" className={pill(mode === "sloped")} onClick={() => onMode("sloped")}>
            {t("dt_rs_wall_sloped")}
          </button>
        </div>
      </div>

      {mode === "default" && (
        <p className="text-[10px] text-muted-foreground">{roomDefault}&quot;</p>
      )}

      {mode === "flat" && wc && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={Math.round(wc.high)}
            onChange={(e) => {
              const v = Number(e.target.value);
              onUpdate({ high: v, low: v });
            }}
            className="h-7 w-20 text-xs"
          />
          <span className="text-[10px] text-muted-foreground">in</span>
        </div>
      )}

      {mode === "sloped" && wc && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">{t("dt_rs_wall_high")}</Label>
              <Input
                type="number"
                value={Math.round(wc.high)}
                onChange={(e) => onUpdate({ high: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">{t("dt_rs_wall_low")}</Label>
              <Input
                type="number"
                value={Math.round(wc.low)}
                onChange={(e) => onUpdate({ low: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{t("dt_rs_high_side")}:</span>
            <button
              type="button"
              className={pill((wc.slopeFrom ?? "start") === "start")}
              onClick={() => onUpdate({ slopeFrom: "start" })}
            >
              {t("dt_rs_high_left")}
            </button>
            <button
              type="button"
              className={pill((wc.slopeFrom ?? "start") === "end")}
              onClick={() => onUpdate({ slopeFrom: "end" })}
            >
              {t("dt_rs_high_right")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UnitField ────────────────────────────────────────────────────────────────

function UnitField({
  label, value, onChange, onEnter, parsed, valid, metric, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  parsed: number | null;
  valid: boolean;
  metric: boolean;
  hint?: string;
}) {
  const { t } = useLanguage();
  const showError = value.trim().length > 0 && !valid;

  const eqText = valid && parsed != null
    ? metric
      ? `= ${(parsed / INCHES_PER_METER).toFixed(3)} m (${Math.round(parsed)}")`
      : t("dt_rs_field_eq", { inches: Math.round(parsed * 100) / 100, tape: toDisplayString(parsed, false) })
    : null;

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
        placeholder={metric ? "e.g. 3.05" : t("dt_rs_field_eg")}
        inputMode={metric ? "decimal" : "text"}
        className={`h-9 text-sm ${showError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
      />
      <div className="h-3.5 text-[10px] leading-none">
        {eqText ? (
          <span className="text-emerald-600">{eqText}</span>
        ) : showError ? (
          <span className="text-red-500">{hint ?? t("dt_rs_field_err")}</span>
        ) : null}
      </div>
    </div>
  );
}
