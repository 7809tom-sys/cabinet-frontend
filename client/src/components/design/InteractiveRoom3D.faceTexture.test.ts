import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { combinedSwatchTextureWindow } from "@shared/doorFaceRecognition";
import {
  THREE_D_PHOTO_SAMPLE_FRAME,
  applyThreeDFaceTextureFiltering,
  threeDSampleTextureFrame,
  threeDUsesSeparateDrawerTexture,
} from "./InteractiveRoom3D";

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

  it("uses the whole photo for a real door.png and drawer-front.png", () => {
    const wholePhoto = { offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1 };
    expect(THREE_D_PHOTO_SAMPLE_FRAME).toEqual(wholePhoto);
    expect(threeDSampleTextureFrame("split", "door")).toEqual(wholePhoto);
    expect(threeDSampleTextureFrame("split", "drawer")).toEqual(wholePhoto);
    expect(threeDSampleTextureFrame("legacy-door", "door")).toEqual(wholePhoto);
    expect(threeDSampleTextureFrame(null, "door")).toEqual(wholePhoto);
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

  it("leaves a combined swatch on its own band instead of the whole photo", () => {
    expect(threeDSampleTextureFrame("combined", "door")).not.toEqual(THREE_D_PHOTO_SAMPLE_FRAME);
    expect(threeDSampleTextureFrame("combined", "drawer")).not.toEqual(THREE_D_PHOTO_SAMPLE_FRAME);
  });
});

describe("3D door and drawer texture filtering", () => {
  it("turns on mipmaps and the renderer's maximum anisotropy", () => {
    const texture = new THREE.Texture();
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    applyThreeDFaceTextureFiltering(texture, 16);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.anisotropy).toBe(16);
  });

  it("still enables mipmaps and keeps the default anisotropy when no cap is supplied", () => {
    for (const cap of [undefined, null, 0, Number.NaN]) {
      const texture = new THREE.Texture();
      applyThreeDFaceTextureFiltering(texture, cap);
      expect(texture.generateMipmaps).toBe(true);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.anisotropy).toBe(1);
    }
  });
});
