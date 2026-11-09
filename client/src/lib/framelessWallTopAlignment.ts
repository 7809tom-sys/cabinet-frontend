/**
 * U.S. Cabinet Depot frameless wall-cabinet top alignment.
 *
 * Issue #354 item 7 (Tom, Nov 9 2026): "in the U.S. Cabinet Depot frameless
 * line, the designer must automatically align all wall cabinets to the top of a
 * 40-1/4 in wall cabinet, including any cabinet placed above a microwave."
 *
 * The book's frameless wall heights are 30-1/4", 35-1/4" and 40-1/4" (altaeuro
 * V8.2 pp. 37-39). With the standard 54" bottom, a 40-1/4" box tops out at
 * 94-1/4". A 30-1/4" box beside it would leave a 10" step that the customer
 * should never have to notice, so on the frameless line a wall run finishes on
 * ONE top line: the top of the tallest wall cabinet on that wall, and never
 * below 94-1/4" once the run contains a 40-1/4" box.
 *
 * How this sits beside the rules that already exist:
 *
 * - **The 72" bridge datum** (`OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM`) is a
 *   BOTTOM line, not a top line, and it is set by the microwave: the bridge must
 *   start above the OTR appliance. This pass never moves it. A bridge that
 *   already carries that datum is left exactly where the bridge rule put it, and
 *   the over-range rules own the tops of the boxes over the range — so a kitchen
 *   whose uppers are all 30-1/4" keeps its historical 84-1/4" line, and its 12"
 *   W3012 bridge keeps topping out on that same line. The pass only raises a
 *   SHORTER box so it meets the run's tallest top; it can never pull a box down
 *   onto a line that would break the 72" bridge.
 * - **Over-range / over-sink rules** still own their own bottom lines
 *   (`OVER_RANGE_UPPER_MIN_BOTTOM_IN`, `OVER_SINK_WALL_MOUNT_BOTTOM`). This pass
 *   never lowers a box: a bottom only ever moves up, so a cooking-clearance or
 *   window-clearance minimum can never be violated by it.
 * - **Other lines are untouched.** The pass runs only when the line is the
 *   frameless line (`hasAefPrintedGeometry`), so a framed line keeps its own
 *   84" top line exactly.
 * - A cabinet the customer moved by hand is kept: this repairs the default
 *   datum, it does not override an explicit choice.
 */
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import {
  isStacker,
  ordinaryWallMountBottom,
  placedHeight,
  wallCabinetSkuDimensions,
  wallCeilingMin,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import type { DoorStyleFaceInput } from "@shared/doorFaceRecognition";
import { isFramelessDoorStyle } from "@shared/doorFaceRecognition";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** The tallest wall box the frameless book sells, in inches (40-1/4"). */
export const FRAMELESS_TOP_WALL_HEIGHT_IN = 40.25;

/** The frameless frameless wall heights the book prints (30-1/4", 35-1/4", 40-1/4"). */
export const FRAMELESS_WALL_HEIGHTS_IN = [30.25, 35.25, 40.25] as const;

/** The top line a 40-1/4" frameless wall cabinet finishes on above the standard 54" bottom. */
export function framelessWallTopDatumIn(): number {
  return kitchenRuleNumber("wall_bottom_in") + FRAMELESS_TOP_WALL_HEIGHT_IN;
}

/** True for the USCD frameless line, read from the same geometry marker every frameless pass uses. */
export function isFramelessLine(cabinet: { constructionMethod?: string | null } | null | undefined): boolean {
  return hasAefPrintedGeometry(cabinet ?? {});
}

export type FramelessWallTopAlignment = {
  placed: PlacedCabinet[];
  /** Cabinets whose bottom was raised so their top meets the run line. */
  aligned: Array<{ uid: string; masterCode: string; from: number; to: number }>;
  /** Boxes that could not join the line, with the reason, so nothing moves silently. */
  warnings: string[];
};

function wallTopOf(cabinet: PlacedCabinet, room: RoomData): number {
  const bottom = typeof cabinet.mountBottom === "number"
    ? cabinet.mountBottom
    : ordinaryWallMountBottom(cabinet);
  return bottom + placedHeight(cabinet);
}

/**
 * Raise every shorter frameless wall cabinet on a wall so its top meets the
 * tallest wall cabinet on that wall (and never below the 40-1/4" datum).
 *
 * `eligible` is the set of cabinets the caller has decided this pass owns;
 * everything else is measured as a neighbour but never rewritten.
 */
export function alignFramelessWallCabinetTops(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Uids the pass may rewrite. Defaults to every placed frameless wall cabinet. */
  eligible?: readonly string[];
}): FramelessWallTopAlignment {
  const { placed, room } = input;
  const eligible = input.eligible ? new Set(input.eligible) : null;
  const walls = new Map<string, PlacedCabinet[]>();
  for (const cabinet of placed) {
    if (cabinet.placement !== "wall") continue;
    if (!isFramelessLine(cabinet)) continue;
    const wall = cabinet.wallId ?? "";
    const group = walls.get(wall);
    if (group) group.push(cabinet);
    else walls.set(wall, [cabinet]);
  }
  if (walls.size === 0) return { placed: placed as PlacedCabinet[], aligned: [], warnings: [] };

  const aligned: FramelessWallTopAlignment["aligned"] = [];
  const warnings: string[] = [];
  const targets = new Map<string, number>();
  Array.from(walls.entries()).forEach(([wall, group]) => {
    // The run line is the top of the tallest box really on this wall. The
    // 40-1/4" datum is only the line once a 40-1/4" box is in the run: a
    // kitchen of 30-1/4" uppers keeps its 84-1/4" top, and the mandatory 72"
    // bridge above the range keeps its own 12" box topping out on it. A bridge
    // never sets the line and is never measured into it.
    const measured = group
      .filter((item: PlacedCabinet) => !isStacker(item) && !item.overRangeMicrowaveBridge && item.refrigeratorAssemblyRole !== "bridge")
      .map((item: PlacedCabinet) => wallTopOf(item, room));
    const hasTopHeightBox = group.some((item: PlacedCabinet) => placedHeight(item) >= FRAMELESS_TOP_WALL_HEIGHT_IN - 0.01);
    const tallest = Math.max(hasTopHeightBox ? framelessWallTopDatumIn() : 0, ...measured);
    if (tallest > 0) targets.set(wall, tallest);
  });

  let changed = false;
  const next = placed.map((cabinet) => {
    if (cabinet.placement !== "wall") return cabinet;
    if (!isFramelessLine(cabinet)) return cabinet;
    if (eligible && !eligible.has(cabinet.uid)) return cabinet;
    if (cabinet.islandFace) return cabinet;
    if (isStacker(cabinet)) return cabinet;
    if (cabinet.mountBottomAdjusted === true) return cabinet;
    // The 72" microwave bridge and the refrigerator-bay bridge are hung from
    // their own appliance datum. Moving them to make a top line even by a
    // quarter inch would put them inside the microwave they rest on, so their
    // bottoms are never rewritten; a real difference is named instead.
    if (cabinet.overRangeMicrowaveBridge === true || cabinet.refrigeratorAssemblyRole === "bridge") {
      const target = targets.get(cabinet.wallId ?? "");
      if (target != null && Math.abs(wallTopOf(cabinet, room) - target) > 0.5) {
        warnings.push(`${cabinet.masterCode} keeps its own appliance datum and finishes ${Math.abs(wallTopOf(cabinet, room) - target).toFixed(2)}″ off the ${target}″ wall-cabinet top line.`);
      }
      return cabinet;
    }
    const target = targets.get(cabinet.wallId ?? "");
    if (target == null) return cabinet;
    const height = placedHeight(cabinet);
    const bottom = target - height;
    const current = typeof cabinet.mountBottom === "number"
      ? cabinet.mountBottom
      : ordinaryWallMountBottom(cabinet);
    if (bottom <= current + 0.01) return cabinet;
    // Never push a box through the ceiling it hangs under. The box keeps its
    // own line and the difference is named instead of hidden.
    const ceiling = wallCeilingMin(room, (cabinet.wallId ?? "top") as WallSide);
    if (bottom + height > ceiling + 0.01) {
      warnings.push(`${cabinet.masterCode} cannot join the ${target}″ frameless top line: its top would exceed the ${ceiling}″ ceiling on this wall.`);
      return cabinet;
    }
    changed = true;
    aligned.push({ uid: cabinet.uid, masterCode: cabinet.masterCode ?? "", from: current, to: bottom });
    return { ...cabinet, mountBottom: bottom };
  });

  return {
    placed: changed ? next : (placed as PlacedCabinet[]),
    aligned,
    warnings,
  };
}

/** Door-style record fields the frameless check reads. */
export type FramelessStyleInput = DoorStyleFaceInput & {
  isFrameless?: boolean | null;
  frameless?: boolean | null;
  constructionMethod?: string | null;
};

/** True when the selected door style is a frameless style, so the top-alignment rule applies. */
export function isFramelessStyle(style: FramelessStyleInput | null | undefined): boolean {
  if (!style) return false;
  if (style.isFrameless === true || style.frameless === true) return true;
  return isFramelessDoorStyle(style);
}

/**
 * The top line the pass will use for one wall, exposed so the elevation and the
 * review list can quote the same number the plan was aligned to.
 */
export function framelessWallTopLineFor(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string | null | undefined,
): number | null {
  const group = placed.filter((item) => item.placement === "wall"
    && isFramelessLine(item)
    && !isStacker(item)
    && !item.overRangeMicrowaveBridge
    && item.refrigeratorAssemblyRole !== "bridge"
    && (item.wallId ?? "") === (wallId ?? ""));
  if (group.length === 0) return null;
  const measured = group.map((item) => wallTopOf(item, room));
  const hasTopHeightBox = group.some((item) => placedHeight(item) >= FRAMELESS_TOP_WALL_HEIGHT_IN - 0.01);
  return Math.max(hasTopHeightBox ? framelessWallTopDatumIn() : 0, ...measured);
}

/** The frameless height class nearest a nominal 30/36/42 request (30.25 / 35.25 / 40.25). */
export function framelessWallHeightClass(nominalIn: number): number {
  return FRAMELESS_WALL_HEIGHTS_IN.reduce((best, height) =>
    Math.abs(height - nominalIn) < Math.abs(best - nominalIn) ? height : best,
  FRAMELESS_WALL_HEIGHTS_IN[0]);
}

/** Reads the book height off a wall cabinet row, or falls back to the placed record. */
export function framelessWallHeightFor(cabinet: PlacedCabinet): number {
  const dims = wallCabinetSkuDimensions(cabinet.masterCode);
  return dims?.height ?? placedHeight(cabinet);
}
