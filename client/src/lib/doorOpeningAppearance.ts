import { clampOpening, wallCeilingMin, wallLength, type RoomData, type WallOpening } from "./design";

export const DEFAULT_INTERIOR_DOOR_COLOR = "#ffffff";
export const DEFAULT_INTERIOR_DOOR_OPACITY = 0.25;

export function supportsRoomDoorSwing(opening: WallOpening): boolean {
  return opening.kind === "door" && opening.doorStyle !== "bifold" && !/sliding|patio/i.test(opening.label);
}

/** Inward positive local-z swing; mirrored hinge keeps the handle opposite. */
export function roomDoorSwing(opening: WallOpening): { hinge: "left" | "right"; angle: 0 | 90; sign: 1 | -1 } {
  const hinge = opening.doorHinge === "right" ? "right" : "left";
  const angle = supportsRoomDoorSwing(opening) && opening.doorOpenAngle === 90 ? 90 : 0;
  return { hinge, angle, sign: hinge === "left" ? 1 : -1 };
}

/** Room-opening illustration only; opacity does not assert a glass/transparent product. */
export function doorOpeningAppearance(opening: WallOpening): { color: string; opacity: number } {
  const legacyBifold = opening.doorStyle === "bifold";
  const color = /^#[0-9a-f]{6}$/i.test(opening.doorColor ?? "")
    ? opening.doorColor!
    : legacyBifold ? "#ad8059" : DEFAULT_INTERIOR_DOOR_COLOR;
  const raw = opening.doorOpacity;
  const opacity = typeof raw === "number" && Number.isFinite(raw)
    ? Math.min(1, Math.max(0.05, raw))
    : legacyBifold ? 0.38 : DEFAULT_INTERIOR_DOOR_OPACITY;
  return { color, opacity };
}

export function applyDoorOpeningAttributes(
  opening: WallOpening,
  patch: { width: number; height: number; color: string; opacity: number; openAngle?: 0 | 90; hinge?: "left" | "right" },
  room: RoomData,
): { ok: true; item: WallOpening } | { ok: false; error: string } {
  if (opening.kind !== "door") return { ok: false, error: "Door Attributes apply only to room doors." };
  const length = wallLength(opening.side, room);
  const maxHeight = wallCeilingMin(room, opening.side) - opening.sill;
  if (!Number.isFinite(patch.width) || patch.width < 6 || patch.width > length) {
    return { ok: false, error: `Door width must be between 6 and ${length} inches on this wall.` };
  }
  if (!Number.isFinite(patch.height) || patch.height < 6 || patch.height > maxHeight) {
    return { ok: false, error: `Door height must be between 6 and ${maxHeight} inches below the wall ceiling.` };
  }
  if (!/^#[0-9a-f]{6}$/i.test(patch.color)) return { ok: false, error: "Choose a valid door color." };
  if (!Number.isFinite(patch.opacity) || patch.opacity < 0.05 || patch.opacity > 1) {
    return { ok: false, error: "Door transparency must be between 0 and 95 percent." };
  }
  if (patch.openAngle !== undefined && patch.openAngle !== 0 && patch.openAngle !== 90) return { ok: false, error: "Choose a closed or 90-degree open door." };
  if (patch.hinge !== undefined && patch.hinge !== "left" && patch.hinge !== "right") return { ok: false, error: "Choose a left or right hinge." };
  if (patch.openAngle === 90 && !supportsRoomDoorSwing(opening)) return { ok: false, error: "Single-leaf swing is not available for sliding or bi-fold doors." };
  return {
    ok: true,
    item: clampOpening({ ...opening, width: patch.width, height: patch.height, doorColor: patch.color.toLowerCase(), doorOpacity: patch.opacity, ...(patch.openAngle !== undefined ? { doorOpenAngle: patch.openAngle } : {}), ...(patch.hinge ? { doorHinge: patch.hinge } : {}) }, room),
  };
}
