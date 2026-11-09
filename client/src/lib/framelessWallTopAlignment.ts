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
  const targets = new Map<string, number>();
  // Every wall the pass touches finishes on the one frameless line, 94-1/4",
  // whatever heights are in the run and whoever is over the range or fridge.
  framelessWalls.forEach((wall) => targets.set(wall, framelessWallTopDatumIn()));

  let changed = false;
  const next = placed.map((cabinet) => {
    if (cabinet.placement !== "wall") return cabinet;
    // The WALL decides that the rule applies (a marker-less auto-built bridge
    // still hangs on a frameless wall), but the CABINET decides whether it may be
    // rewritten. Only a frameless box or a bridge is this rule's business; a
    // framed box sharing a mixed / two-style wall keeps its own line exactly.
    if (!framelessWalls.has(cabinet.wallId ?? "")) return cabinet;
    if (!isFramelessLine(cabinet) && !isBridgeCabinet(cabinet)) return cabinet;
    if (eligible && !eligible.has(cabinet.uid)) return cabinet;
    if (cabinet.islandFace) return cabinet;
    if (isStacker(cabinet)) return cabinet;
    if (cabinet.mountBottomAdjusted === true) return cabinet;
    // Issue #354 item 5 (Tom, Nov 9 2026): the over-microwave bridge and the
    // refrigerator bridge are NOT exempt from the one 94-1/4" line. Their bottom
    // stays on the fixed 72" datum and the SKU's HEIGHT is what puts the top on
    // the line (the 22-5/8" box reaches 94-5/8"). This pass therefore never moves
    // a bridge's bottom; it reports any bridge whose chosen SKU still finishes off
    // the line, so the shortfall is visible instead of silent.
    if (isBridgeCabinet(cabinet)) {
      const target = targets.get(cabinet.wallId ?? "");
      if (target == null) return cabinet;
      const top = wallTopOf(cabinet, room);
      if (Math.abs(top - target) > 0.51) {
        warnings.push(`${cabinet.masterCode} finishes at ${top}″, ${Math.round((target - top) * 8) / 8}″ off the ${target}″ frameless wall-cabinet top line.`);
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
  _room: RoomData,
  wallId: string | null | undefined,
): number | null {
  const wall = wallId ?? "";
  const touchesFrameless = placed.some((item) => item.placement === "wall"
    && (item.wallId ?? "") === wall
    && (isFramelessLine(item) || isBridgeCabinet(item)));
  return touchesFrameless ? framelessWallTopDatumIn() : null;
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
