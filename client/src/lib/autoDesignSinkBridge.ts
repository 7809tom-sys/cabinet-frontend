/**
 * When there is no window over the sink base, Auto Design places a short
 * bridge wall cabinet over it for headroom at the sink (Tom, Nov 14 2026,
 * 2:01–2:02 PM CT). Width matches the sink base. Height is paired to the
 * neighboring wall cabinets the same way as the range bridge: 12 in next to
 * 30 in uppers, 18 in (or a catalog 15) next to 36, 24 in next to 42, using
 * only live priced catalog SKUs. If the line has no matching width, the
 * existing bridge fallback is used or a visible reason is raised. Nothing is
 * invented. When a window is over the sink, no bridge is placed and the
 * window stays clear of uppers.
 */
import { sinkHasWindowAbove } from "./autoDesignWallCabinets";
import { overRangeBridgeFor } from "./overRangeCompanion";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import {
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  isSinkBaseCabinet,
  microwaveBridgeHeightForNeighbor,
  OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";

export type SinkBridgeResult = {
  placed: PlacedCabinet[];
  notes: string[];
  findings: DesignerReviewFinding[];
  added: boolean;
};

function alreadyBridged(placed: readonly PlacedCabinet[], sink: PlacedCabinet, room: RoomData): boolean {
  const wall = cabinetWall(sink, room);
  const start = wallRunOffset(sink, wall, room);
  const end = start + wallRunSpan(sink, wall, room);
  return placed.some((item) => {
    if (item.placement !== "wall" || cabinetWall(item, room) !== wall) return false;
    // Only a short bridge on the 72 in datum counts; a full-height upper over
    // the sink is the failure mode this pass is meant to replace.
    if (Math.abs((item.mountBottom ?? 0) - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM) > 0.6) return false;
    const itemStart = wallRunOffset(item, wall, room);
    const itemEnd = itemStart + wallRunSpan(item, wall, room);
    const overlap = Math.min(end, itemEnd) - Math.max(start, itemStart);
    return overlap >= Math.min(wallRunSpan(sink, wall, room), wallRunSpan(item, wall, room)) * 0.5 - 0.05;
  });
}

/**
 * A catalog bridge over each sink base that does not have a window above it.
 */
export function placeSinkBridges(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallCatalog: readonly DesignCabinet[];
  wallCabinetHeightIn: number;
  styleId: number | null;
  makeUid: () => string;
}): SinkBridgeResult {
  let working = [...input.placed];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  let added = false;
  const sinks = working.filter((item) => item.placement === "base" && isSinkBaseCabinet(item));
  for (const sink of sinks) {
    if (sinkHasWindowAbove(sink, input.openings, input.room)) continue;
    if (alreadyBridged(working, sink, input.room)) continue;
    const wall = cabinetWall(sink, input.room);
    const start = wallRunOffset(sink, wall, input.room);
    const end = start + wallRunSpan(sink, wall, input.room);
    const widthIn = wallRunSpan(sink, wall, input.room);
    const neighborHeight = input.wallCabinetHeightIn;
    const mapped = microwaveBridgeHeightForNeighbor(neighborHeight);
    // What fills the span over this sink right now. Clearing it before a bridge
    // is known to exist is what left a sink with no wall cabinet over it (owner
    // report, Nov 26 2026). A bridge never turns a closed run into an open one.
    const covering = working.filter((item) => {
      if (item.placement !== "wall" || cabinetWall(item, input.room) !== wall) return false;
      if (Math.abs((item.mountBottom ?? 0) - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM) <= 0.6) return false;
      const itemStart = wallRunOffset(item, wall, input.room);
      const itemEnd = itemStart + wallRunSpan(item, wall, input.room);
      return Math.min(end, itemEnd) - Math.max(start, itemStart) >= 1;
    });
    const spanState = covering.length > 0
      ? `the ${covering.map((item) => item.masterCode).join(" + ")} over ${sink.masterCode} was kept, which keeps the run closed`
      : `no wall cabinet was over ${sink.masterCode}, so the span stays open`;
    const source = overRangeBridgeFor({
      rangeWidthIn: widthIn,
      wallCabinetHeightIn: neighborHeight,
      wallCatalog: input.wallCatalog,
      ceilingIn: input.room.ceilingHeight,
    });
    if (!source) {
      findings.push({
        ruleId: "sink-bridge-over-base",
        code: "sink-bridge-unavailable",
        severity: "warning",
        title: `No bridge over ${sink.masterCode}`,
        detail: `The selected line sells no ${Math.round(widthIn)}″-wide bridge (or a single-door cabinet that can turn horizontal) to match the ${neighborHeight}″ wall cabinets, so nothing was invented above the sink. A window is not checked, so a short bridge was required for headroom; ${spanState}.`,
      });
      notes.push(`No catalog bridge matches the ${Math.round(widthIn)}″ ${sink.masterCode}, so ${spanState}.`);
      continue;
    }
    const bridgeStart = wallRunOffset(sink, wall, input.room) + widthIn / 2 - dim(source.width, widthIn) / 2;
    const depth = dim(source.depth, 12);
    const boxWidth = dim(source.width, widthIn);
    const spot = wallPlacementAt(bridgeStart, boxWidth, depth, wall as WallSide, input.room);
    if (!spot) {
      findings.push({
        ruleId: "sink-bridge-over-base",
        code: "sink-bridge-blocked",
        severity: "warning",
        title: `No bridge over ${sink.masterCode}`,
        detail: `${source.masterCode} could not be seated over the sink; ${spanState}.`,
      });
      continue;
    }
    const bridge: PlacedCabinet = {
      uid: input.makeUid(),
      cabinetId: source.id,
      masterCode: source.masterCode,
      description: source.description,
      category: source.category ?? "Wall",
      subCategory: source.subCategory ?? "Wall",
      placement: "wall",
      ...spot,
      width: boxWidth,
      depth,
      height: dim(source.height, mapped ?? 12),
      mountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
      mountBottomAdjusted: true,
      numberOfDoors: source.numberOfDoors ?? 1,
      numberOfDrawers: source.numberOfDrawers ?? 0,
      catalogImageUrl: source.catalogImageUrl ?? null,
      styleId: input.styleId,
      ...(source.turnedSideways ? { turnedSideways: true } : {}),
    };
    // The full-height upper over the sink steps aside only once the bridge is
    // known to seat there. A blocked bridge keeps it, so the run never opens.
    const cleared = covering.length > 0
      ? working.filter((item) => !covering.some((cover) => cover.uid === item.uid))
      : working;
    const accepted = appendCollisionFreePlacements(cleared, [bridge], input.room);
    if (accepted.rejected.length > 0) {
      findings.push({
        ruleId: "sink-bridge-over-base",
        code: "sink-bridge-blocked",
        severity: "warning",
        title: `No bridge over ${sink.masterCode}`,
        detail: `${source.masterCode} overlaps another cabinet or opening over the sink; ${spanState}.`,
      });
      continue;
    }
    if (cleared.length !== working.length) {
      notes.push(`A full-height wall cabinet was removed over ${sink.masterCode} so a short bridge could be placed for headroom at the sink.`);
    }
    working = accepted.placed;
    added = true;
    notes.push(`${source.masterCode} was placed over ${sink.masterCode} as a ${dim(source.height, 0)}″ bridge matching the ${neighborHeight}″ wall cabinets, so there is headroom at the sink.`);
  }
  return { placed: working, notes, findings, added };
}

/** Keep a short sink-bridge from being raised to the full wall-cabinet height. */
export function isSinkBridgeCabinet(item: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): boolean {
  if (item.placement !== "wall") return false;
  if (Math.abs((item.mountBottom ?? 0) - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM) > 0.6) return false;
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  const end = start + wallRunSpan(item, wall, room);
  return placed.some((other) => {
    if (!isSinkBaseCabinet(other) || cabinetWall(other, room) !== wall) return false;
    const otherStart = wallRunOffset(other, wall, room);
    const otherEnd = otherStart + wallRunSpan(other, wall, room);
    return Math.min(end, otherEnd) - Math.max(start, otherStart) > 1;
  });
}
