import { describe, expect, it } from "vitest";
import {
  coverPhoto,
  groupRoomScenes,
  normalizeRoomSceneName,
  roomSceneImageError,
  sceneNameOf,
} from "./vendorRoomScenes";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe("vendor room scenes", () => {
  it("groups photos into named scenes and puts the cover first", () => {
    const groups = groupRoomScenes([
      { id: 2, styleId: 9, imageUrl: "/b.jpg", sortOrder: 20, sceneName: "Bathroom", sceneSortOrder: 20, isCover: false },
      { id: 1, styleId: 9, imageUrl: "/k2.jpg", sortOrder: 20, sceneName: "Kitchen", sceneSortOrder: 10, isCover: false },
      { id: 3, styleId: 9, imageUrl: "/k1.jpg", sortOrder: 10, sceneName: "Kitchen", sceneSortOrder: 10, isCover: true },
      { id: 4, styleId: 9, imageUrl: "/old.jpg", sortOrder: 0, sceneName: null, isActive: false },
    ]);
    expect(groups.map((group) => group.name)).toEqual(["Kitchen", "Bathroom"]);
    expect(groups[0]?.photos.map((photo) => photo.id)).toEqual([3, 1]);
    expect(coverPhoto(groups.flatMap((group) => group.photos))?.id).toBe(3);
  });

  it("keeps legacy photos in a Room group", () => {
    expect(sceneNameOf({ sceneName: "  " })).toBe("Room");
    expect(normalizeRoomSceneName("  Laundry room  ")).toBe("Laundry room");
    expect(() => normalizeRoomSceneName(" ")).toThrow(/name/);
  });

  it("accepts real jpeg and png bytes and rejects a mismatched or oversized file", () => {
    expect(roomSceneImageError(jpeg, "image/jpeg")).toBeNull();
    expect(roomSceneImageError(png, "image/png")).toBeNull();
    expect(roomSceneImageError(png, "image/jpeg")).toMatch(/does not match/);
    expect(roomSceneImageError(jpeg, "image/gif")).toMatch(/JPEG, PNG, or WebP/);
    expect(roomSceneImageError(new Uint8Array(8 * 1024 * 1024 + 1), "image/jpeg")).toMatch(/8 MB/);
  });
});
