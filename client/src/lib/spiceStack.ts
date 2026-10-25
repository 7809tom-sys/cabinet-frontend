import {
  cabinetWall,
  dim,
  elevationBox,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

const EPSILON = 0.01;

/**
 * WSC30 is a 30-inch-wide, 6-inch spice cabinet. It belongs beneath a matching
 * 30-inch wall cabinet; it is never an over-range bridge/ventilation part.
 */
export function isWscSpiceCabinet(cabinet: Pick<PlacedCabinet, "masterCode" | "width" | "height">): boolean {
  return /^WSC[-_]?30$/i.test(cabinet.masterCode)
    && Math.abs(Number(cabinet.width) - 30) <= EPSILON
    && Math.abs(Number(cabinet.height ?? 0) - 6) <= EPSILON;
}

/**
 * Returns only real selected-line 30 x 30 or 30 x 36 wall cabinets that can
 * complete WSC30 into the requested 36- or 42-inch visual stack.
 */
export function wsc30UpperChoices(
  spice: Pick<PlacedCabinet, "masterCode" | "width" | "height">,
  wallCabinets: readonly DesignCabinet[],
): DesignCabinet[] {
  if (!isWscSpiceCabinet(spice)) return [];
  return wallCabinets
    .filter((cabinet) => {
      const width = dim(cabinet.width, 0);
      const height = dim(cabinet.height, 0);
      const text = `${cabinet.masterCode} ${cabinet.description} ${cabinet.subCategory ?? ""}`.toLowerCase();
      return cabinet.placement === "wall"
        && Math.abs(width - 30) <= EPSILON
        && (Math.abs(height - 30) <= EPSILON || Math.abs(height - 36) <= EPSILON)
        && !/\b(?:spice|stacker|bridge)\b/.test(text);
    })
    .sort((left, right) => dim(left.height, 0) - dim(right.height, 0) || left.masterCode.localeCompare(right.masterCode));
}

/** Aligns a selected W3030/W3036 centered and directly above its WSC30 base. */
export function wsc30UpperPlacement(
  spice: PlacedCabinet,
  upper: DesignCabinet,
  room: RoomData,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; mountBottom: number } {
  const side = cabinetWall(spice, room);
  const spiceStart = wallRunOffset(spice, side, room);
  const spiceSpan = wallRunSpan(spice, side, room);
  const upperWidth = dim(upper.width, 30);
  const upperStart = spiceStart + (spiceSpan - upperWidth) / 2;
  const spot = wallPlacementAt(upperStart, upperWidth, dim(upper.depth, 12), side, room);
  return {
    ...spot,
    mountBottom: elevationBox(spice, room).bottom + Number(spice.height ?? 0),
  };
}
