import {
  isFarmSinkBasePaletteItem,
  paletteActiveWallPlacement,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "@/lib/design";

export type FarmSinkCatalogItem = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
};

export function resolveFarmSinkPalettePlacement(
  item: FarmSinkCatalogItem,
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  width: number,
  depth: number,
) {
  if (!isFarmSinkBasePaletteItem(item)) {
    return { applies: false as const, spot: null, message: null };
  }
  const spot = paletteActiveWallPlacement(side, room, placed, openings, width, depth, "base");
  const message = spot
    ? null
    : `${item.masterCode ?? "Farm sink base"} was not added because there is no ${width}\" opening on the active wall. Select a wall with enough clear space or drag the cabinet to a valid wall position.`;
  return { applies: true as const, spot, message };
}
