import type { RoomType } from "./design";

/**
 * The Designer builds a kitchen, a bathroom, a laundry, or a closet plan with
 * one workspace. Until now the only way in was the room tabs inside the panel,
 * so a link could not open the bathroom designer at all — and the entry gate,
 * the toolbar title, and the first catalog tab were all Kitchen.
 *
 * `?room=bathroom` (also accepted as `?roomType=` and the `store`/`vanity`
 * synonyms the storefront copy uses) selects that room on load. An unknown or
 * missing value keeps the kitchen default, so every existing link is unchanged.
 */
export const DESIGNER_ROOM_PARAM = "room";

const ROOM_SYNONYMS: Readonly<Record<string, RoomType>> = {
  kitchen: "kitchen",
  bathroom: "bathroom",
  bath: "bathroom",
  vanity: "bathroom",
  laundry: "laundry",
  utility: "laundry",
  closet: "closet",
  storage: "closet",
  other: "other",
  room: "other",
};

const ROOM_TYPES_SET = new Set<RoomType>(["kitchen", "bathroom", "laundry", "closet", "other"]);

/** Room requested by the URL, or null when the link does not name one. */
export function requestedDesignerRoom(search: string): RoomType | null {
  const params = new URLSearchParams(search);
  const raw = (params.get(DESIGNER_ROOM_PARAM) ?? params.get("roomType") ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (ROOM_TYPES_SET.has(raw as RoomType)) return raw as RoomType;
  return ROOM_SYNONYMS[raw] ?? null;
}

/** The catalog tab a room opens on, so the first thing shown is the room's own lineup. */
export function defaultPaletteTabForRoom(room: RoomType): "vanity" | "closetparts" | "appliance" | "base" {
  if (room === "bathroom") return "vanity";
  if (room === "closet") return "closetparts";
  if (room === "laundry") return "appliance";
  return "base";
}
