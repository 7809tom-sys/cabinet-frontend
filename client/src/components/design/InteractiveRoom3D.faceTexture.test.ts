import { describe, expect, it } from "vitest";
import { combinedSwatchTextureWindow } from "@shared/doorFaceRecognition";
import { threeDSampleTextureFrame, threeDUsesSeparateDrawerTexture } from "./InteractiveRoom3D";

describe("3D door and drawer sample frames", () => {
  it("maps a wall door onto the door band of a combined swatch", () => {
    const door = threeDSampleTextureFrame("combined", "door");
    const drawer = threeDSampleTextureFrame("combined", "drawer");
    expect(door).toEqual(combinedSwatchTextureWindow("door"));
    expect(drawer).toEqual(combinedSwatchTextureWindow("drawer"));
    expect(door.offsetY).toBeGreaterThan(0);
    expect(door.offsetY + door.repeatY).toBeLessThanOrEqual(drawer.offsetY);
    expect(drawer.offsetY + drawer.repeatY).toBeLessThanOrEqual(1);
    expect(threeDUsesSeparateDrawerTexture({
      isWall: true,
      doorSampleUrl: "/manus-storage/TWP.png",
      drawerSampleUrl: "/manus-storage/TWP.png",
      faceSourceKind: "combined",
    })).toBe(false);
  });

  it("gives a base drawer the drawer band even when the file is the same swatch", () => {
    expect(threeDUsesSeparateDrawerTexture({
      isWall: false,
      doorSampleUrl: "/manus-storage/TWP.png",
      drawerSampleUrl: "/manus-storage/TWP.png",
      faceSourceKind: "combined",
    })).toBe(true);
    const frame = threeDSampleTextureFrame("combined", "drawer");
    expect(frame.offsetY).toBeGreaterThan(0.7);
    expect(frame.repeatY).toBeLessThan(0.3);
  });

  it("keeps a real door.png and drawer-front.png on the photo crop", () => {
    expect(threeDSampleTextureFrame("split", "door")).toEqual({
      offsetX: 0.29,
      offsetY: 0.29,
      repeatX: 0.42,
      repeatY: 0.42,
    });
    expect(threeDUsesSeparateDrawerTexture({
      isWall: false,
      doorSampleUrl: "/door.png",
      drawerSampleUrl: "/drawer-front.png",
      faceSourceKind: "split",
    })).toBe(true);
    expect(threeDUsesSeparateDrawerTexture({
      isWall: false,
      doorSampleUrl: "/door-only.jpg",
      drawerSampleUrl: "/door-only.jpg",
      faceSourceKind: "legacy-door",
    })).toBe(false);
  });
});
