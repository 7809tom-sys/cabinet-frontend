import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  applianceFinishNeedsTint,
  disposeApplianceFrontTextureCache,
  isCachedApplianceFrontTexture,
  loadApplianceFrontTexture,
  refrigeratorBodyMaterialParams,
  tintApplianceRgb,
} from "./applianceFinishTint";

describe("appliance finish tint", () => {
  it("leaves stainless and unset finishes as the supplied photo", () => {
    expect(applianceFinishNeedsTint("stainless")).toBe(false);
    expect(applianceFinishNeedsTint(null)).toBe(false);
    expect(applianceFinishNeedsTint(undefined)).toBe(false);
    expect(applianceFinishNeedsTint("white")).toBe(true);
  });

  it("keeps shading order so handles and seams stay readable", () => {
    for (const finish of ["white", "black", "black-stainless"] as const) {
      const dark = tintApplianceRgb(finish, 40, 40, 40)[0];
      const light = tintApplianceRgb(finish, 220, 220, 220)[0];
      expect(light).toBeGreaterThan(dark);
    }
  });

  it("white reads light and black reads dark across the photo's range", () => {
    expect(tintApplianceRgb("white", 30, 30, 30)[0]).toBeGreaterThan(150);
    expect(tintApplianceRgb("black", 230, 230, 230)[0]).toBeLessThan(100);
  });

  it("fridge shell follows the finish", () => {
    expect(refrigeratorBodyMaterialParams("white").color).toBe("#e6e8ea");
    expect(refrigeratorBodyMaterialParams(null).color).toBe("#5f666d");
  });
});

describe("appliance front photo cache", () => {
  afterEach(() => {
    disposeApplianceFrontTextureCache();
    vi.restoreAllMocks();
  });

  it("reuses the same already-loaded texture on a second rebuild with no new load", () => {
    const loadedImage = { src: "https://cdn.example/fridge.jpg", width: 64, height: 64 };
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(((url: string) => {
      const texture = new THREE.Texture();
      // The first rebuild's load has already finished, so the cached object
      // carries its image and a later mesh can use it immediately.
      texture.image = { ...loadedImage, src: url };
      return texture;
    }) as THREE.TextureLoader["load"]);

    const first = loadApplianceFrontTexture("https://cdn.example/fridge.jpg", "stainless");
    expect(isCachedApplianceFrontTexture(first)).toBe(true);
    expect(first.image).toEqual(expect.objectContaining({ src: "https://cdn.example/fridge.jpg" }));

    const second = loadApplianceFrontTexture("https://cdn.example/fridge.jpg", "stainless");
    expect(second).toBe(first);
    expect(second.image).toBe(first.image);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight tinted texture and does not start a second image load", () => {
    const imageLoad = vi.spyOn(THREE.ImageLoader.prototype, "load").mockImplementation((() => undefined) as THREE.ImageLoader["load"]);

    const first = loadApplianceFrontTexture("https://cdn.example/dishwasher.jpg", "white");
    const second = loadApplianceFrontTexture("https://cdn.example/dishwasher.jpg", "white");
    expect(second).toBe(first);
    expect(isCachedApplianceFrontTexture(first)).toBe(true);
    expect(imageLoad).toHaveBeenCalledTimes(1);
  });

  it("keeps a tinted finish off the stainless cache entry", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((() => new THREE.Texture()) as THREE.TextureLoader["load"]);
    const imageLoad = vi.spyOn(THREE.ImageLoader.prototype, "load").mockImplementation((() => undefined) as THREE.ImageLoader["load"]);

    const stainless = loadApplianceFrontTexture("https://cdn.example/hood.jpg", "stainless");
    const white = loadApplianceFrontTexture("https://cdn.example/hood.jpg", "white");
    expect(white).not.toBe(stainless);
    expect(load).toHaveBeenCalledTimes(1);
    expect(imageLoad).toHaveBeenCalledTimes(1);
  });
});
