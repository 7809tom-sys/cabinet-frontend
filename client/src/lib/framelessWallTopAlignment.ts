/**
 * U.S. Cabinet Depot frameless wall-cabinet top alignment.
 *
 * Issue #354 item 7 (Tom, Nov 9 2026): "in the U.S. Cabinet Depot frameless
 * line, the designer must automatically align all wall cabinets to the top of a
 * 40-1/4 in wall cabinet, including any cabinet placed above a microwave."
 *
 * The book's frameless wall heights are 30-1/4", 35-1/4" and 40-1/4" (altaeuro
 * V8.2 pp. 37-39). With the standard 54" bottom, the 40-1/4" box tops out at
 * 94-1/4", and that is the ONE line a frameless wall run finishes on.
 *
 * Tom's decision (Nov 9 2026, issue #354 item 5), with no exceptions:
 *
 * - **Every frameless wall cabinet top is 94-1/4".** The line does not depend on
 *   which boxes happen to be present: a run of nothing but 30-1/4" cabinets is
 *   raised to it too, and there is no 30-1/4"-only exemption.
 * - **Bridges are not exempt.** The over-microwave bridge
 *   (`OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM`) and the refrigerator-bay bridge
 *   keep their fixed 72" BOTTOM datum; the SKU's HEIGHT is what puts the top on
 *   the line (the frameless 22-5/8" box reaches 94-5/8"). This pass never moves a
 *   bridge's bottom, and it names any bridge whose SKU still finishes short, so a
 *   low bridge is visible rather than silent.
 * - **Over-range / over-sink rules** still own their own bottom lines
 *   (`OVER_RANGE_UPPER_MIN_BOTTOM_IN`, `OVER_SINK_WALL_MOUNT_BOTTOM`). This pass
 *   never lowers a box: a bottom only ever moves up, so a cooking-clearance or
 *   window-clearance minimum can never be violated by it.
 * - **Other lines are untouched.** A wall counts as frameless when ANY cabinet on
 *   it carries the frameless marker (so a marker-less auto-built bridge still
 *   belongs to its frameless wall), but only two kinds of cabinet are ever
 *   rewritten: a frameless cabinet, and a bridge. A framed box standing on a
 *   mixed / two-style wall keeps its own 84" line exactly.
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

/**
 * THE frameless wall top line: 54" bottom + 40-1/4" = 94-1/4".
 *
 * Tom's decision (Nov 9 2026, issue #354 item 5): ALL frameless wall cabinet tops
 * line up here, with no exceptions. A run of nothing but 30-1/4" boxes is raised
 * too, and the over-microwave and refrigerator bridges are brought onto the same
 * line from their own 72" datum.
 */
export function framelessWallTopDatumIn(): number {
  return kitchenRuleNumber("wall_bottom_in") + FRAMELESS_TOP_WALL_HEIGHT_IN;
}

/**
 * The bridge height that puts a bridge's top on the frameless line from a fixed
 * 72" bottom: 94-1/4 − 72 = 22-1/4".
 */
export function framelessBridgeTopHeightIn(bridgeBottomIn: number): number {
  return Math.max(0, framelessWallTopDatumIn() - bridgeBottomIn);
}

/** True for the USCD frameless line, read from the same geometry marker every frameless pass uses. */
export function isFramelessLine(cabinet: { constructionMethod?: string | null } | null | undefined): boolean {
  return hasAefPrintedGeometry(cabinet ?? {});
}

/**
 * An over-microwave or refrigerator-bay bridge: the two short boxes that hang
 * from the fixed 72" datum rather than from an upper run. The rule applies to
 * them even when an auto-built record arrives without the frameless marker, so
 * they are recognised by their role flags instead of by geometry.
 */
export function isBridgeCabinet(cabinet: {
  overRangeMicrowaveBridge?: boolean | null;
  refrigeratorAssemblyRole?: string | null;
} | null | undefined): boolean {
  if (!cabinet) return false;
  return cabinet.overRangeMicrowaveBridge === true || cabinet.refrigeratorAssemblyRole === "bridge";
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
  // A wall is frameless when ANY cabinet on it says so. Auto-Design's bridge and
  // refrigerator-cap records are built from catalog rows that can arrive without
  // the geometry marker, so requiring the marker on every piece would silently
  // skip the very bridges this rule has to bring onto the line.
  const framelessWalls = new Set<string>();
  for (const cabinet of placed) {
    if (cabinet.placement !== "wall") continue;
    const wall = cabinet.wallId ?? "";
    const group = walls.get(wall);
    if (group) group.push(cabinet);
    else walls.set(wall, [cabinet]);
    if (isFramelessLine(cabinet)) framelessWalls.add(wall);
  }
  if (walls.size === 0) return { placed: placed as PlacedCabinet[], aligned: [], warnings: [] };

  const aligned: FramelessWallTopAlignment["aligned"] = [];
  const warnings: string[] = [];
  // Tom (Nov 15 2026, 7:13 PM CT) replaced the Nov 9 issue #354 "one 94-1/4" top
  // line" rule: frameless wall cabinets hang from the standard 54" bottom exactly
  // like framed ones, and a 30-1/4" or 35-1/4" box is NEVER lifted to meet a
  // 40-1/4" box's top. Reaching the crown is a sizing choice (Auto Design picks
  // the 40" class), not a raise. Lifting boxes here also fought
  // normalizeStandardWallMounts (54" reset) inside DesignTool's mount effect, which
  // rebuilt `placed` on every render and kept the 3D scene from ever settling.
  //
  // So this pass now moves nothing. It only names a bridge whose top misses the
  // wall's real top line (the tallest ordinary frameless box on that wall).
  for (const wall of Array.from(framelessWalls)) {
    const target = framelessWallTopLineFor(placed, room, wall);
    if (target == null) continue;
    for (const cabinet of walls.get(wall) ?? []) {
      if (!isBridgeCabinet(cabinet)) continue;
      if (eligible && !eligible.has(cabinet.uid)) continue;
      const top = wallTopOf(cabinet, room);
      if (Math.abs(top - target) > 0.51) {
        warnings.push(`${cabinet.masterCode} finishes at ${top}″, ${Math.round((target - top) * 8) / 8}″ off the ${target}″ wall-cabinet top line on this wall.`);
      }
    }
  }
  return { placed: placed as PlacedCabinet[], aligned, warnings };
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
 * The top line the pass uses for one wall, exposed so the elevation and the
 * review list can quote the same number the plan was aligned to.
 *
 * Under Tom's decision (issue #354 item 5) that is simply the one frameless line,
 * 94-1/4", for any wall this rule touches — it no longer depends on which heights
 * or which boxes happen to be present, and bridges do not change it. Null when no
 * frameless cabinet or bridge stands on the wall, so a framed-only wall has no
 * frameless line at all. A wall this rule touches is frameless even when the
 * frameless cabinet on it is a bridge row, mirroring `alignFramelessWallCabinetTops`.
 */
export function framelessWallTopLineFor(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string | null | undefined,
): number | null {
  const wall = wallId ?? "";
  const onWall = placed.filter((item) => item.placement === "wall" && (item.wallId ?? "") === wall);
  if (!onWall.some((item) => isFramelessLine(item) || isBridgeCabinet(item))) return null;
  // The line is what the wall really shows: the highest top among its ordinary
  // frameless boxes, each hanging from its own (standard 54") bottom.
  let line: number | null = null;
  for (const item of onWall) {
    if (!isFramelessLine(item) || isBridgeCabinet(item) || isStacker(item) || item.islandFace) continue;
    const top = wallTopOf(item, room);
    if (Number.isFinite(top)) line = line == null ? top : Math.max(line, top);
  }
  return line;
}

/**
 * The top a frameless run of the given nominal wall height really reaches from
 * the standard bottom: 54 + 30-1/4 = 84-1/4, 54 + 35-1/4 = 89-1/4,
 * 54 + 40-1/4 = 94-1/4. Bridges and refrigerator caps line up with THIS, so a
 * 30" frameless run is never matched to a 40" box's line (Tom, Nov 15 2026).
 */
export function framelessRunTopLineIn(nominalWallHeightIn: number | null | undefined): number {
  const nominal = Number(nominalWallHeightIn);
  const height = framelessWallHeightClass(Number.isFinite(nominal) && nominal > 0 ? nominal : 30);
  return kitchenRuleNumber("wall_bottom_in") + height;
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
