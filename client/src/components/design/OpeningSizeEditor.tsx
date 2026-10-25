import { useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, AlignCenterHorizontal } from "lucide-react";
import { clampOpening, formatEighthInches, wallLength, wallCeilingMin, type WallOpening, type RoomData } from "@/lib/design";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  opening: WallOpening;
  room: RoomData;
  onChange: (o: WallOpening) => void;
  onDelete: () => void;
  onOpenAttributes?: () => void;
  movementIncrementIn?: number;
  /** Mirrors the active measurement reference onto the Floor Plan while typing. */
  onPositionReferenceFocusChange?: (reference: { openingUid: string; reference: "start" | "end" } | null) => void;
}

// Inline editor shown in the contextual row when a door/window is selected.
// Exact opening width and height in inches; doors no longer have a fixed height.
// The dedicated Door Attributes dialog also provides paint and planning opacity.
//
// It ALSO exposes a "Position on wall" control — start/end (left/right)
// reference selection, a numeric exact-distance field, nudge buttons, and a
// Center button — so the opening can be moved precisely without dragging.
// Dragging is hard on a phone, so these tap targets are the reliable way to
// reposition a door/window there.
export function OpeningSizeEditor({ opening, room, onChange, onDelete, onOpenAttributes, movementIncrementIn = 1, onPositionReferenceFocusChange }: Props) {
  const { t } = useLanguage();
  // All openings expose height; only windows/pass-throughs expose sill controls.
  const showHeightSill = opening.kind === "window" || opening.kind === "opening";
  const wallLen = Math.round(wallLength(opening.side, room) * 8) / 8;
  const maxW = wallLen;
  // The largest valid offset keeps the whole opening on the wall.
  const maxOffset = Math.max(0, Math.round((wallLen - opening.width) * 8) / 8);
  const wallCeilingIn = wallCeilingMin(room, opening.side);
  const moveIncrement = Math.max(0.125, Math.round(movementIncrementIn * 8) / 8);
  const moveIncrementLabel = Math.abs(moveIncrement - 1) < 0.001 ? "1 inch" : formatEighthInches(moveIncrement);

  // Local text state so the user can clear/retype without the value snapping
  // back mid-edit. We commit (clamped) on blur or Enter.
  const [widthText, setWidthText] = useState(String(opening.width));
  const [heightText, setHeightText] = useState(String(opening.height));
  const [sillText, setSillText] = useState(String(opening.sill));
  const [positionReference, setPositionReference] = useState<"start" | "end">("start");
  const [positionInputFocused, setPositionInputFocused] = useState(false);
  const measuredDistance = positionReference === "start"
    ? opening.offset
    : Math.max(0, maxOffset - opening.offset);
  const formatMeasuredDistance = (value: number) => String(Math.round(value * 8) / 8);
  const [offsetText, setOffsetText] = useState(formatMeasuredDistance(measuredDistance));
  const parsedDistance = parseFloat(offsetText);
  const distanceError = Number.isFinite(parsedDistance) && parsedDistance > maxOffset + 0.001
    ? parsedDistance > wallLen + 0.001
      ? `Entered distance (${formatMeasuredDistance(parsedDistance)}″) exceeds this wall’s full ${formatMeasuredDistance(wallLen)}″ length.`
      : `This ${formatMeasuredDistance(opening.width)}″ window leaves a maximum ${formatMeasuredDistance(maxOffset)}″ distance from the selected wall ${positionReference === "start" ? "start / left" : "end / right"}.`
    : null;

  // Re-sync when a different opening is selected or the canvas drag changes it.
  useEffect(() => {
    setWidthText(String(opening.width));
    setHeightText(String(opening.height));
    setSillText(String(opening.sill));
    setOffsetText(formatMeasuredDistance(positionReference === "start"
      ? opening.offset
      : Math.max(0, maxOffset - opening.offset)));
  }, [opening.uid, opening.width, opening.height, opening.sill, opening.offset, maxOffset, positionReference]);

  const commitWidth = () => {
    const n = parseFloat(widthText);
    if (Number.isFinite(n) && n > 0) {
      onChange(clampOpening({ ...opening, width: Math.min(Math.max(6, n), maxW) }, room));
    } else {
      setWidthText(String(opening.width));
    }
  };
  const commitHeight = () => {
    const n = parseFloat(heightText);
    if (Number.isFinite(n) && n > 0) {
      onChange(clampOpening({ ...opening, height: Math.min(Math.max(6, n), wallCeilingIn - opening.sill) }, room));
    } else {
      setHeightText(String(opening.height));
    }
  };
  const commitSill = () => {
    const n = parseFloat(sillText);
    if (Number.isFinite(n) && n >= 0) {
      onChange(clampOpening({ ...opening, sill: n }, room));
    } else {
      setSillText(String(opening.sill));
    }
  };
  const nudgeSill = (delta: number) => {
    const nextOpening = clampOpening({ ...opening, sill: opening.sill + delta }, room);
    const nextSill = nextOpening.sill;
    onChange(nextOpening);
    setSillText(String(Math.round(nextSill)));
  };

  // ── Position on wall ──────────────────────────────────────────────────────
  // `offset` is stored as inches from the wall's start corner. A user can enter
  // the same location from the opposite end; the conversion preserves the
  // opening's near edge at either measured wall reference.
  const setOffset = (raw: number) => {
    const next = clampOpening({ ...opening, offset: raw }, room);
    onChange(next);
    const nextMeasurement = positionReference === "start"
      ? next.offset
      : Math.max(0, maxOffset - next.offset);
    setOffsetText(formatMeasuredDistance(nextMeasurement));
  };
  const nudge = (delta: number) => setOffset(opening.offset + delta);
  const commitOffset = () => {
    const n = parseFloat(offsetText);
    if (Number.isFinite(n) && n >= 0) {
      setOffset(positionReference === "start" ? n : maxOffset - n);
    } else {
      setOffsetText(formatMeasuredDistance(measuredDistance));
    }
  };
  const centerOnWall = () => setOffset(Math.max(0, (wallLen - opening.width) / 2));

  const fieldClass =
    "w-16 rounded-md border border-border bg-white px-2 py-1 text-[11px] text-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#a87f33]";
  const nudgeBtnClass =
    "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-[#1a2744] transition-colors hover:bg-[#a87f33] hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#1a2744]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">
        {t("dt_op_selected")}{" "}
        <span className="font-semibold text-foreground">{opening.label}</span>
      </span>
      <div className="h-4 w-px bg-border" />
      <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {t("dt_op_width")}
        <input
          type="number"
          inputMode="decimal"
          min={6}
          max={maxW}
          value={widthText}
          onChange={(e) => setWidthText(e.target.value)}
          onBlur={commitWidth}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={fieldClass}
        />
        <span className="text-foreground/60">{t("dt_op_in")}</span>
      </label>
      {(
        <>
          <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            {t("dt_op_height")}
            <input
              type="number"
              inputMode="decimal"
              min={6}
              max={Math.max(6, wallCeilingIn - opening.sill)}
              value={heightText}
              onChange={(e) => setHeightText(e.target.value)}
              onBlur={commitHeight}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className={fieldClass}
            />
            <span className="text-foreground/60">{t("dt_op_in")}</span>
          </label>
          {showHeightSill && <>
          <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            {t("dt_op_sill")}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={Math.max(0, wallCeilingIn - opening.height)}
              value={sillText}
              onChange={(e) => setSillText(e.target.value)}
              onBlur={commitSill}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className={fieldClass}
            />
            <span className="text-foreground/60">{t("dt_op_in")}</span>
          </label>
          <div className="flex items-center gap-1" aria-label="Window vertical position">
            <button
              type="button"
              onClick={() => nudgeSill(-moveIncrement)}
              disabled={opening.sill <= 0.001}
              title={`Move window down ${moveIncrementLabel}`}
              aria-label={`Move window down ${moveIncrementLabel}`}
              className={nudgeBtnClass}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => nudgeSill(moveIncrement)}
              disabled={opening.sill >= wallCeilingIn - opening.height - 0.001}
              title={`Move window up ${moveIncrementLabel}`}
              aria-label={`Move window up ${moveIncrementLabel}`}
              className={nudgeBtnClass}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          </>}
        </>
      )}

      <div className="h-4 w-px bg-border" />

      {/* Position on wall — select a start/end (left/right) reference, then type
          or nudge the exact measurement. Start/end remains authoritative on
          vertical and diagonal walls where literal left/right would be ambiguous. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{t("dt_op_position")}</span>
        <label className="sr-only" htmlFor={`opening-position-reference-${opening.uid}`}>Window position reference</label>
        <select
          id={`opening-position-reference-${opening.uid}`}
          value={positionReference}
          onChange={(event) => {
            const reference = event.target.value as "start" | "end";
            setPositionReference(reference);
            if (positionInputFocused) onPositionReferenceFocusChange?.({ openingUid: opening.uid, reference });
          }}
          aria-label="Window position reference"
          className="h-7 rounded-md border border-border bg-white px-1.5 text-[11px] font-medium text-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#a87f33]"
        >
          <option value="start">Wall start / left</option>
          <option value="end">Wall end / right</option>
        </select>
        <button
          type="button"
          onClick={() => nudge(-moveIncrement)}
          disabled={opening.offset <= 0.001}
          title={t("dt_op_move_left")}
          aria-label={t("dt_op_move_left")}
          className={nudgeBtnClass}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={maxOffset}
          step="0.125"
          value={offsetText}
          onChange={(e) => setOffsetText(e.target.value)}
          onFocus={() => {
            setPositionInputFocused(true);
            onPositionReferenceFocusChange?.({ openingUid: opening.uid, reference: positionReference });
          }}
          onBlur={() => {
            setPositionInputFocused(false);
            onPositionReferenceFocusChange?.(null);
            commitOffset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          title={`Exact distance from wall ${positionReference === "start" ? "start / left" : "end / right"}`}
          aria-label={`Window distance from wall ${positionReference === "start" ? "start / left" : "end / right"} in inches`}
          aria-invalid={Boolean(distanceError)}
          aria-describedby={distanceError ? `window-distance-warning-${opening.uid}` : undefined}
          className={`${fieldClass} ${distanceError ? "border-amber-600 bg-amber-50 text-amber-950 focus:ring-amber-600" : ""}`}
        />
        <span className="text-foreground/60 text-[11px]">{t("dt_op_in")}</span>
        <button
          type="button"
          onClick={() => nudge(moveIncrement)}
          disabled={opening.offset >= maxOffset - 0.001}
          title={t("dt_op_move_right")}
          aria-label={t("dt_op_move_right")}
          className={nudgeBtnClass}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={centerOnWall}
          title={t("dt_op_center")}
          aria-label={t("dt_op_center")}
          className={nudgeBtnClass}
        >
          <AlignCenterHorizontal className="h-4 w-4" />
        </button>
        {distanceError && (
          <span
            id={`window-distance-warning-${opening.uid}`}
            role="alert"
            data-testid="window-distance-warning"
            className="basis-full text-[11px] font-medium text-amber-800"
          >
            {distanceError}
          </span>
        )}
      </div>

      {opening.kind === "door" && onOpenAttributes && <button type="button" onClick={onOpenAttributes} data-testid="opening-door-attributes" className="min-h-10 rounded-md border border-[#1a2744]/35 bg-white px-3 text-xs font-semibold text-[#1a2744]">Attributes</button>}
      <button
        type="button"
        onClick={onDelete}
        title={t("dt_op_delete_title")}
        className="flex items-center gap-1 rounded-md border border-destructive/40 bg-white px-2 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
      >
        <Trash2 className="h-3 w-3" /> {t("dt_op_delete")}
      </button>
    </div>
  );
}
