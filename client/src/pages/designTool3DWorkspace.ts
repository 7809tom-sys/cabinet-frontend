import { DEFAULT_ROOM, type RoomData } from "@/lib/design";

export type DesignWorkspaceView = "plan" | "threeD" | "hybrid" | "elevation" | "split" | "corner" | "island";

/**
 * A room shell is design content even before the first cabinet is placed.
 * This is especially important for Continuous Wall Builder rooms: after a
 * refresh their wall IDs may restore before any cabinet/fixture exists, and the
 * 3D workspace must still render those measured walls instead of the empty
 * starter message.
 */
export function hasDesignedRoomGeometry(room: RoomData): boolean {
  const hasCustomWallPath = (room.vertices?.length ?? 0) >= 2 && (room.customWalls?.length ?? 0) > 0;
  return hasCustomWallPath
    || (room.peninsulaRuns?.length ?? 0) > 0
    || Object.keys(room.wallCeilings ?? {}).length > 0
    || Math.abs(room.width - DEFAULT_ROOM.width) > 0.001
    || Math.abs(room.depth - DEFAULT_ROOM.depth) > 0.001
    || Math.abs((room.ceilingHeight ?? DEFAULT_ROOM.ceilingHeight ?? 96) - (DEFAULT_ROOM.ceilingHeight ?? 96)) > 0.001;
}

/**
 * The 3D workspace is the normal starting point. Precision-focused deep links
 * remain explicit so designers can still open the bird's-eye plan directly.
 */
export function initialDesignWorkspaceView(search: string): DesignWorkspaceView {
  const view = new URLSearchParams(search).get("view");
  if (view === "plan") return "plan";
  if (view === "front") return "elevation";
  if (view === "split") return "split";
  if (view === "hybrid" || view === "3d-plan") return "hybrid";
  if (view === "corner") return "corner";
  if (view === "island") return "island";
  return "threeD";
}

/** Matches the catalog payload accepted by the 3D canvas drop target. */
export function threeDLeftCatalogDragPayload(category: "Cabinet" | "Accessory" | "Appliance", id: number) {
  return `${category}:${id}`;
}
