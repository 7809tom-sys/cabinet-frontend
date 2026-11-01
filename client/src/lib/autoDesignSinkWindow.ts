import {
  OPENINGS, WALL_OPENING_CLEARANCE_IN, cabinetWall, clampOpening, wallCeilingMin, wallRunOffset, wallRunSpan,
  type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

/** A new Auto-Design window head sits no more than this far below the wall top. */
export const WINDOW_HEAD_MAX_BELOW_CEILING_IN = 10;

/**
 * The measured window above the sink. Auto-Design already centers the sink on
 * the entered window center; this creates the actual opening so the room and
 * the upper-cabinet stage both know about it. It is the catalog's over-sink
 * window (48 inches tall, 42-inch sill), made as wide as the sink base it
 * sits over.
 */
export function autoDesignSinkWindow({ sink, room, uid }: { sink: PlacedCabinet; room: RoomData; uid: string }): WallOpening {
  const def = OPENINGS.find((item) => item.key === "window-over-sink");
  if (!def) throw new Error("The over-sink window definition is missing from the opening catalog.");
  const wall = cabinetWall(sink, room);
  const placed = clampOpening({
    uid, kind: "window", label: def.label, side: wall, autoPlaced: true,
    offset: wallRunOffset(sink, wall, room), width: wallRunSpan(sink, wall, room), height: def.height, sill: def.sill,
  }, room);
  // Initial placement only. An existing window is never raised to meet this.
  const ceiling = wallCeilingMin(room, placed.side);
  const gap = ceiling - (placed.sill + placed.height);
  if (gap <= WINDOW_HEAD_MAX_BELOW_CEILING_IN + 0.01) return placed;
  return clampOpening({ ...placed, sill: placed.sill + (gap - WINDOW_HEAD_MAX_BELOW_CEILING_IN) }, room);
}

/** True when the window, plus the required clearance on each side, touches a reserved wall span. */
export function windowOverlapsReservation(
  window: Pick<WallOpening, "side" | "offset" | "width">,
  reservation: { wall: string; start: number; end: number } | null,
): boolean {
  if (!reservation || reservation.wall !== window.side) return false;
  const start = window.offset - WALL_OPENING_CLEARANCE_IN;
  const end = window.offset + window.width + WALL_OPENING_CLEARANCE_IN;
  return start < reservation.end - 0.001 && end > reservation.start + 0.001;
}
