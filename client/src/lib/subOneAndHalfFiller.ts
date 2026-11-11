/**
 * Owner rule (Tom, Nov 11 2026): a gap under 1.5 inches between two cabinets,
 * or between a cabinet and a refrigerator or its end panel, is closed with a
 * filler. The refrigerator is not slid to close that gap. A filler is never
 * wider than 3 inches; this pass only sees gaps that are already under 1.5.
 */
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  isFillerItem,
  isRefrigerator,
  isRefrigeratorEndPanel,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

/** Gaps this wide or wider are not this rule. They stay on the existing filler cap. */
export const SUB_ONE_AND_HALF_MAX_IN = 1.5;
/** Narrower than this is tape-measure noise, not a board. */
const SUB_ONE_AND_HALF_MIN_IN = 0.05;

export type SubOneAndHalfFillerResult = {
  placed: PlacedCabinet[];
  notes: string[];
};

type Edge = {
  item: PlacedCabinet;
  start: number;
  end: number;
};

function isPanelOrFridge(item: PlacedCabinet): boolean {
  return isRefrigerator(item) || isRefrigeratorEndPanel(item);
}

function occupies(item: PlacedCabinet, layer: "base" | "wall"): boolean {
  if (isFillerItem(item)) return item.placement === layer;
  if (layer === "wall") return item.placement === "wall" || item.placement === "tall" || isRefrigeratorEndPanel(item);
  return item.placement === "base" || item.placement === "appliance" || item.placement === "tall" || isRefrigeratorEndPanel(item);
}

function qualifies(left: PlacedCabinet, right: PlacedCabinet): boolean {
  if (isFillerItem(left) || isFillerItem(right)) return false;
  const leftBound = isPanelOrFridge(left) || left.placement === "base" || left.placement === "wall" || left.placement === "tall" || left.placement === "appliance";
  const rightBound = isPanelOrFridge(right) || right.placement === "base" || right.placement === "wall" || right.placement === "tall" || right.placement === "appliance";
  if (!leftBound || !rightBound) return false;
  // At least one side is a cabinet (not two appliances with nothing to fill against a box).
  const leftCabinet = !isRefrigerator(left) && left.placement !== "appliance";
  const rightCabinet = !isRefrigerator(right) && right.placement !== "appliance";
  return leftCabinet || rightCabinet;
}

/**
 * Insert a filler in every along-wall gap under 1.5 inches that this rule owns.
 * Nothing already placed is moved, including the refrigerator.
 */
export function fillGapsUnderOneAndAHalf(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
}): SubOneAndHalfFillerResult {
  let placed = [...input.placed];
  const notes: string[] = [];
  const walls = new Set<string>();
  for (const item of placed) {
    const wall = item.wallId ?? cabinetWall(item, input.room);
    if (wallRunFrame(wall, input.room)) walls.add(wall);
  }
  for (const wall of walls) {
    for (const layer of ["base", "wall"] as const) {
      const edges: Edge[] = [];
      for (const item of placed) {
        if (!occupies(item, layer)) continue;
        if ((item.wallId ?? cabinetWall(item, input.room)) !== wall) continue;
        const start = wallRunOffset(item, wall, input.room);
        const end = start + wallRunSpan(item, wall, input.room);
        if (end - start <= COLLISION_EPSILON_IN) continue;
        edges.push({ item, start, end });
      }
      edges.sort((a, b) => a.start - b.start || a.end - b.end);
      for (let index = 0; index < edges.length - 1; index += 1) {
        const left = edges[index]!;
        const right = edges[index + 1]!;
        const gap = right.start - left.end;
        if (gap <= SUB_ONE_AND_HALF_MIN_IN || gap > SUB_ONE_AND_HALF_MAX_IN + 1e-6) continue;
        if (gap > 3 + 1e-6) continue;
        if (!qualifies(left.item, right.item)) continue;
        const filler = catalogFillerForGap(input.fillers, gap, layer);
        if (!filler) {
          notes.push(`A ${gap.toFixed(3)}" gap between ${left.item.masterCode} and ${right.item.masterCode} needs a filler, and this line has no 3" ${layer} filler to cut.`);
          continue;
        }
        const cabinet = [left.item, right.item].find((item) => !isPanelOrFridge(item) && !isRefrigerator(item)) ?? left.item;
        const depth = Math.max(0, Number(cabinet.depth) || (layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH));
        const height = Math.max(0, Number(cabinet.height) || (layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT));
        const spot = wallPlacementAt(left.end, gap, depth, wall as WallSide, input.room);
        const piece: PlacedCabinet = {
          uid: input.makeUid(),
          cabinetId: filler.id,
          masterCode: filler.masterCode,
          description: fittedCatalogFillerDescription(filler, gap),
          category: filler.category ?? "Filler",
          subCategory: filler.subCategory ?? "Filler",
          placement: layer,
          ...spot,
          width: gap,
          depth,
          height,
          rotation: spot.rotation,
          wallId: spot.wallId ?? wall,
          wallOffset: spot.wallOffset ?? left.end,
          numberOfDoors: 0,
          numberOfDrawers: 0,
          catalogImageUrl: filler.catalogImageUrl ?? null,
          styleId: input.styleId,
          fillerPieceGroupId: `sub-1-5-${left.item.uid}-${right.item.uid}`,
          fillerBillingRole: "primary",
          fillerTotalWidth: gap,
          mountBottom: layer === "wall" ? (cabinet.mountBottom ?? STD.WALL_MOUNT_BOTTOM) : 0,
        };
        const accepted = appendCollisionFreePlacements(placed, [piece], input.room);
        if (accepted.rejected.length > 0) continue;
        placed = accepted.placed;
        notes.push(`${filler.masterCode} cut to ${gap.toFixed(3)}" closes the gap between ${left.item.masterCode} and ${right.item.masterCode}. The refrigerator was not moved.`);
        edges.splice(index + 1, 0, { item: piece, start: left.end, end: right.start });
      }
    }
  }
  return { placed, notes };
}
