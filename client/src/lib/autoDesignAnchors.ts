/**
 * Rule 1: appliances come first.
 *
 * The range, sink and refrigerator are placed as fixed anchors before any cabinet is chosen.
 * Each anchor may slide at most 3 inches from its measured center; the refrigerator bay (its two
 * 3/4 inch end panels and the cabinet above) may slide as one assembly, and nothing in the kitchen
 * may ever extend past the refrigerator panel.
 *
 * The wiggle itself lives in `designerLayoutRules.applyAutoDesignWiggleRoom`; this module is the
 * anchor contract the build reads, so the order and the cap cannot drift.
 */
import {
  COLLISION_EPSILON_IN,
  cabinetWall,
  isRangeOrOven,
  isRefrigerator,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { AUTO_DESIGN_WIGGLE_ROOM_IN } from "./designerLayoutRules";

/** Anchor kinds in the order rule 1 seats them. */
export const ANCHOR_ORDER = ["range", "sink", "refrigerator"] as const;
export type AnchorKind = (typeof ANCHOR_ORDER)[number];

/** Rule 1: the largest slide any anchor may take from its measured center. */
export const ANCHOR_WIGGLE_MAX_IN = AUTO_DESIGN_WIGGLE_ROOM_IN;

export type SeatedAnchor = {
  uid: string;
  kind: AnchorKind;
  wallId: string;
  startIn: number;
  endIn: number;
  /** True when this anchor owns the refrigerator end panel limit. */
  capsRunPast: boolean;
};

/** Classifies a placed item as one of the rule-1 anchors, or null for a cabinet. */
export function anchorKindOf(item: PlacedCabinet): AnchorKind | null {
  if (item.placement !== "appliance" && item.placement !== "base") return null;
  if (isRefrigerator(item)) return "refrigerator";
  if (isRangeOrOven(item.masterCode, item.description)) return "range";
  if (item.placement === "base" && /^SB[-_]?\d/i.test(`${item.masterCode ?? ""}`)) return "sink";
  return null;
}

/** Anchors on the plan, in the rule-1 seating order. */
export function seatedAnchors(placed: readonly PlacedCabinet[], room: RoomData): SeatedAnchor[] {
  const anchors: SeatedAnchor[] = [];
  for (const kind of ANCHOR_ORDER) {
    for (const item of placed) {
      if (anchorKindOf(item) !== kind) continue;
      const wallId = cabinetWall(item, room);
      if (!wallId) continue;
      const startIn = wallRunOffset(item, wallId, room);
      anchors.push({
        uid: item.uid,
        kind,
        wallId,
        startIn,
        endIn: startIn + wallRunSpan(item, wallId, room),
        capsRunPast: kind === "refrigerator",
      });
    }
  }
  return anchors;
}

/** Rule 1: nothing may pass the refrigerator's outer panel face. */
export function refrigeratorLimitIn(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
}): { startIn: number; endIn: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const item of input.placed) {
    if (cabinetWall(item, input.room) !== input.wallId) continue;
    const isAssembly = item.refrigeratorAssemblyId != null
      || isRefrigerator(item)
      || /refrigerator/i.test(`${item.description ?? ""} ${item.subCategory ?? ""}`);
    if (!isAssembly) continue;
    const start = wallRunOffset(item, input.wallId, input.room);
    min = Math.min(min, start);
    max = Math.max(max, start + wallRunSpan(item, input.wallId, input.room));
  }
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { startIn: min, endIn: max } : null;
}

/**
 * Rule 1: true when a piece sits entirely inside the refrigerator's panel limit (or nowhere near
 * it). A piece that crosses either outer face is a violation, however small the overlap.
 */
export function pieceStaysInsideRefrigeratorLimit(input: {
  startIn: number;
  widthIn: number;
  limit: { startIn: number; endIn: number } | null;
  /** Which side of the limit the run continues on. */
  side: "before" | "after";
}): boolean {
  if (!input.limit) return true;
  const end = input.startIn + input.widthIn;
  if (input.side === "before") return end <= input.limit.startIn + COLLISION_EPSILON_IN;
  return input.startIn >= input.limit.endIn - COLLISION_EPSILON_IN;
}

/**
 * Rule 1: the slide an anchor is allowed. Range and sink take the 3 inch jog; a refrigerator bay
 * slides as one assembly within its own measured cap. Never more, never in/out.
 */
export function anchorSlideAllowance(kind: AnchorKind, options?: { measured?: boolean }): number {
  if (kind === "refrigerator") return options?.measured === false ? 6 : ANCHOR_WIGGLE_MAX_IN;
  return ANCHOR_WIGGLE_MAX_IN;
}

/** True when every anchor is still inside its own slide allowance from its measured center. */
export function anchorsWithinSlideLimit(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  measuredCenters: Readonly<Record<string, number>>;
}): boolean {
  for (const item of input.placed) {
    const kind = anchorKindOf(item);
    if (!kind) continue;
    const measured = input.measuredCenters[item.uid];
    if (measured == null) continue;
    const wallId = cabinetWall(item, input.room);
    if (!wallId) continue;
    const along = wallRunOffset(item, wallId, input.room);
    if (Math.abs(along - measured) > anchorSlideAllowance(kind) + 1e-6) return false;
  }
  return true;
}
