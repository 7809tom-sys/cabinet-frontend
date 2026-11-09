/**
 * Short (above-the-worktop) wall cabinets, and the one that must not get a
 * side/end panel of its own.
 *
 * A 24-inch-or-shorter upper hangs at the range's 72-inch datum or the
 * refrigerator's cap rather than in the 54-inch upper run. Most of those are a
 * legitimate appliance surround — an over-range bridge, an over-fridge cap, a
 * refrigerator wall cabinet — and keep the end panel that finishes the side a
 * customer can see.
 *
 * The defect Tom reported (issue 353 outcome 8) is narrower: a STANDALONE
 * 24-inch upper with no appliance surround, no floor run beneath it and no
 * refrigerator assembly near it, beside which the designer hung an end panel
 * that ran down past the cabinet's own bottom. Only that case is refused.
 *
 * Two rules follow and are enforced by `panelFitsUpperBand`:
 *   - a panel beside an upper never extends below that upper's bottom, and
 *   - a standalone short upper with no exposed-end need gets no panel at all.
 */
import {
  bearsCountertop,
  cabinetWall,
  isRefrigerator,
  isRefrigeratorWallCabinet,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

export const SHORT_UPPER_MAX_HEIGHT_IN = 24;

/** True for a wall cabinet whose box is 24 inches tall or shorter (W3024, W3018, W3012). */
export function isShortUpperCabinet(item: {
  placement?: string | null;
  height?: number | string | null;
  masterCode?: string | null;
}): boolean {
  if (item.placement !== "wall") return false;
  const height = Number(item.height);
  if (Number.isFinite(height) && height > 0) return height <= SHORT_UPPER_MAX_HEIGHT_IN + 0.01;
  // A placed record without a stored height still names its height in the code:
  // W3024 is 30 wide by 24 tall, W3012 is 30 wide by 12 tall.
  const code = String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^W(\d{2})(\d{2})(?:[A-Z]+)?$/.exec(code);
  if (!match) return false;
  const codedHeight = Number(match[2]);
  return codedHeight > 0 && codedHeight <= SHORT_UPPER_MAX_HEIGHT_IN;
}

/** True when this record is an appliance-surround upper that keeps its panels. */
export function isApplianceSurroundUpper(item: PlacedCabinet): boolean {
  if (item.overRangeMicrowaveBridge === true) return true;
  if (isRefrigeratorWallCabinet(item)) return true;
  if (item.refrigeratorAssemblyRole === "bridge" || item.refrigeratorAssemblyId != null) return true;
  const text = `${item.masterCode ?? ""} ${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase();
  // Bridge / over-range / over-fridge / refrigerator caps.
  return /\bbridge\b|over[-\s]?range|over[-\s]?fridge|refrigerator|fridge\b|\bcap\b/.test(text);
}

/**
 * True when the plan holds an appliance or a refrigerator assembly directly
 * under this upper, so the upper is that appliance's surround.
 */
export function applianceUnderUpper(
  upper: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  if (!isShortUpperCabinet(upper)) return false;
  const wall = cabinetWall(upper, room) as string | null;
  if (!wall) return false;
  const start = wallRunOffset(upper, wall, room);
  const end = start + wallRunSpan(upper, wall, room);
  return placed.some((other) => {
    if (other.uid === upper.uid) return false;
    const isAppliance = other.placement === "appliance" || isRefrigerator(other);
    if (!isAppliance && !isRefrigeratorWallCabinet(other) && other.refrigeratorAssemblyId == null) return false;
    if (cabinetWall(other, room) !== wall) return false;
    const otherStart = wallRunOffset(other, wall, room);
    const otherEnd = otherStart + wallRunSpan(other, wall, room);
    // Any along-run overlap counts: a bridge sits over its range, a cap over its
    // refrigerator, and both may be a little wider or narrower than the box.
    return Math.min(end, otherEnd) - Math.max(start, otherStart) > -1;
  });
}

/** True when counter-bearing floor cabinets stand under this upper's span. */
export function floorRunUnderUpper(
  upper: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  const wall = cabinetWall(upper, room) as string | null;
  if (!wall) return false;
  const start = wallRunOffset(upper, wall, room);
  const end = start + wallRunSpan(upper, wall, room);
  return placed.some((other) => {
    if (other.uid === upper.uid || !bearsCountertop(other)) return false;
    if (cabinetWall(other, room) !== wall) return false;
    const otherStart = wallRunOffset(other, wall, room);
    const otherEnd = otherStart + wallRunSpan(other, wall, room);
    return Math.min(end, otherEnd) - Math.max(start, otherStart) > 1;
  });
}

/**
 * Owner rule (issue 353 outcome 8): a STANDALONE short upper — 24 inches or
 * less, no appliance surround, no floor run beneath it and no refrigerator
 * assembly near it — is not an upper-run end and gets no side/end panel.
 */
export function isStandaloneShortUpper(
  upper: PlacedCabinet,
  room: RoomData,
  placed?: readonly PlacedCabinet[],
): boolean {
  if (!isShortUpperCabinet(upper)) return false;
  if (isApplianceSurroundUpper(upper)) return false;
  if (placed && applianceUnderUpper(upper, placed, room)) return false;
  // A short upper standing over counter is part of a real run and keeps its
  // panel; only one with nothing under it is the reported defect.
  if (placed && floorRunUnderUpper(upper, placed, room)) return false;
  return true;
}

/**
 * A panel beside an upper must stay inside that upper's own vertical band. A
 * board that would reach below the upper's bottom is the stray strip Tom saw;
 * it is clamped (or refused when nothing would remain).
 */
export function panelFitsUpperBand(input: {
  upperBottomIn: number;
  upperHeightIn: number;
  panelBottomIn: number;
  panelHeightIn: number;
}): { bottomIn: number; heightIn: number } | null {
  const upperTop = input.upperBottomIn + input.upperHeightIn;
  const bottom = Math.max(input.upperBottomIn, input.panelBottomIn);
  const top = Math.min(upperTop, input.panelBottomIn + input.panelHeightIn);
  const height = top - bottom;
  if (!(height > 0.5)) return null;
  return { bottomIn: bottom, heightIn: height };
}
