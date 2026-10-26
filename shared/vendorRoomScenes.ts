/** Named groupings on the existing door-style room scene rows. */

export const ROOM_SCENE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type RoomSceneImageType = (typeof ROOM_SCENE_IMAGE_TYPES)[number];

/** Matches the existing Featured Styles library cap of six photos per door style. */
export const MAX_ROOM_SCENE_PHOTOS_PER_STYLE = 6;
export const ROOM_SCENE_MAX_BYTES = 8 * 1024 * 1024;
export const PRESET_ROOM_SCENE_NAMES = ["Kitchen", "Bathroom", "Laundry"] as const;
export const DEFAULT_ROOM_SCENE_NAME = "Room";

export type RoomScenePhoto = {
  id: number;
  styleId: number;
  imageUrl: string;
  sortOrder: number;
  sceneName?: string | null;
  sceneDescription?: string | null;
  sceneSortOrder?: number | null;
  isCover?: boolean | null;
  isActive?: boolean | null;
  isVerified?: boolean | null;
  sourceDistributorId?: number | null;
  taggedCabinetIds?: number[] | null;
  taggedStyleIds?: number[] | null;
};

export type RoomSceneGroup<T extends RoomScenePhoto = RoomScenePhoto> = {
  name: string;
  description: string | null;
  sortOrder: number;
  photos: T[];
};

export function sceneNameOf(photo: { sceneName?: string | null }): string {
  const name = photo.sceneName?.trim().replace(/\s+/g, " ");
  return name || DEFAULT_ROOM_SCENE_NAME;
}

export function normalizeRoomSceneName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("A room scene needs a name.");
  if (trimmed.length > 128) throw new Error("Room scene names must be 128 characters or fewer.");
  return trimmed;
}

export function normalizeRoomSceneDescription(description: string | null | undefined): string | null {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > 512) throw new Error("Room scene descriptions must be 512 characters or fewer.");
  return trimmed;
}

export function parseIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
}

export function groupRoomScenes<T extends RoomScenePhoto>(photos: readonly T[]): RoomSceneGroup<T>[] {
  const groups = new Map<string, RoomSceneGroup<T>>();
  for (const photo of photos) {
    if (photo.isActive === false) continue;
    const name = sceneNameOf(photo);
    const current = groups.get(name) ?? {
      name,
      description: photo.sceneDescription?.trim() || null,
      sortOrder: photo.sceneSortOrder ?? 0,
      photos: [],
    };
    if (!current.description && photo.sceneDescription?.trim()) current.description = photo.sceneDescription.trim();
    current.sortOrder = Math.min(current.sortOrder, photo.sceneSortOrder ?? 0);
    current.photos.push(photo);
    groups.set(name, current);
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      photos: [...group.photos].sort((left, right) => {
        const cover = Number(Boolean(right.isCover)) - Number(Boolean(left.isCover));
        if (cover !== 0) return cover;
        return left.sortOrder - right.sortOrder || left.id - right.id;
      }),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function coverPhoto<T extends RoomScenePhoto>(photos: readonly T[]): T | null {
  const groups = groupRoomScenes(photos);
  const first = groups[0];
  if (!first) return null;
  return first.photos.find((photo) => photo.isCover) ?? first.photos[0] ?? null;
}

/** Rejects a file that is the wrong type, empty, too large, or whose bytes do not match the declared type. */
export function roomSceneImageError(bytes: Uint8Array, contentType: string): string | null {
  if (!ROOM_SCENE_IMAGE_TYPES.includes(contentType as RoomSceneImageType)) {
    return "Room scene photos must be JPEG, PNG, or WebP.";
  }
  if (bytes.byteLength === 0) return "The room scene photo was empty.";
  if (bytes.byteLength > ROOM_SCENE_MAX_BYTES) return "Room scene photos must be 8 MB or smaller.";
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const riff = bytes.byteLength >= 12
    && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF"
    && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP";
  const matches = (contentType === "image/jpeg" && jpeg)
    || (contentType === "image/png" && png)
    || (contentType === "image/webp" && riff);
  if (!matches) return "That file does not match the declared image type.";
  return null;
}
