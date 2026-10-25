import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addWallOpening, DEFAULT_WINDOW_SCENE_KIND, windowConstructionGrid, windowFrameColor, windowMullionGrid, windowPhotoCoverCrop, windowSceneAssetUrl, WINDOW_SCENE_ASSETS, WINDOW_SCENE_SOURCES } from "./InteractiveRoom3D";

describe("Designer window scenes", () => {
  it("maps the real reference scenes to stored photographic assets", () => {
    expect(DEFAULT_WINDOW_SCENE_KIND).toBe("garden");
    expect(windowSceneAssetUrl("garden")).toBe(WINDOW_SCENE_ASSETS.garden);
    expect(windowSceneAssetUrl("woodland")).toBe(WINDOW_SCENE_ASSETS.woodland);
    expect(windowSceneAssetUrl("coastal")).toBe(WINDOW_SCENE_ASSETS.coastal);
    expect(windowSceneAssetUrl("urban")).toBe(WINDOW_SCENE_ASSETS.urban);
    expect(windowSceneAssetUrl("mountain")).toBe(WINDOW_SCENE_ASSETS.mountain);
    expect(windowSceneAssetUrl("night")).toBe(WINDOW_SCENE_ASSETS.night);
    expect(windowSceneAssetUrl("city-skyline")).toBe(WINDOW_SCENE_ASSETS["city-skyline"]);
    expect(windowSceneAssetUrl("desert")).toBe(WINDOW_SCENE_ASSETS.desert);
    expect(windowSceneAssetUrl("snow")).toBe(WINDOW_SCENE_ASSETS.snow);
    expect(windowSceneAssetUrl("seasonal-garden")).toBe(WINDOW_SCENE_ASSETS["seasonal-garden"]);
    expect(windowSceneAssetUrl("autumn-woodland")).toBe(WINDOW_SCENE_ASSETS["autumn-woodland"]);
    expect(WINDOW_SCENE_ASSETS.garden).toMatch(/garden-outdoor_.*\.jpg$/);
    expect(WINDOW_SCENE_ASSETS.woodland).toMatch(/woodland-outdoor_.*\.jpg$/);
    expect(WINDOW_SCENE_ASSETS.coastal).toMatch(/coastal-outdoor_.*\.jpg$/);
    expect(WINDOW_SCENE_ASSETS["seasonal-garden"]).toMatch(/seasonal-garden_.*\.jpg$/);
    expect(WINDOW_SCENE_ASSETS["autumn-woodland"]).toMatch(/autumn-woodland_.*\.jpg$/);
    expect(WINDOW_SCENE_SOURCES.garden.license).toBe("CC BY-SA 4.0");
    expect(WINDOW_SCENE_SOURCES.woodland.license).toBe("CC0 1.0");
    expect(WINDOW_SCENE_SOURCES.coastal.license).toBe("CC BY-SA 2.0");
    expect(WINDOW_SCENE_SOURCES["city-skyline"].license).toBe("Unsplash License");
    expect(WINDOW_SCENE_SOURCES.desert.license).toBe("Unsplash License");
    expect(WINDOW_SCENE_SOURCES.snow.license).toBe("Pexels License");
    expect(WINDOW_SCENE_SOURCES["seasonal-garden"].license).toBe("Original generated asset");
    expect(WINDOW_SCENE_SOURCES["autumn-woodland"].license).toBe("Original generated asset");
  });

  it("keeps procedural scenes as safe fallbacks", () => {
    expect(windowSceneAssetUrl("daylight")).toBeNull();
    expect(windowSceneAssetUrl("suburban")).toBeNull();
    expect(windowSceneAssetUrl("privacy")).toBeNull();
  });

  it("uses distinct architectural frame finishes", () => {
    expect(windowFrameColor("white")).toBe("#f4f0e8");
    expect(windowFrameColor("black")).toBe("#20252b");
    expect(windowFrameColor("wood")).toBe("#8a5a35");
  });

  it("maps each construction style to its architectural mullion layout", () => {
    expect(windowConstructionGrid("picture")).toEqual({ columns: 0, rows: 0 });
    expect(windowConstructionGrid("double-hung")).toEqual({ columns: 0, rows: 1 });
    expect(windowConstructionGrid("casement")).toEqual({ columns: 1, rows: 0 });
    expect(windowConstructionGrid("slider")).toEqual({ columns: 1, rows: 0 });
    expect(windowConstructionGrid("french-cottage")).toEqual({ columns: 1, rows: 1 });
  });

  it("center-crops landscape photos into portrait windows without stretching them", () => {
    const crop = windowPhotoCoverCrop(16 / 9, 36 / 48);
    expect(crop.repeatY).toBe(1);
    expect(crop.repeatX).toBeLessThan(1);
    expect(crop.offsetX).toBeCloseTo((1 - crop.repeatX) / 2);
    expect(crop.offsetY).toBe(0);
  });

  it("supports explicit mullion presets instead of forcing a scene default", () => {
    expect(windowMullionGrid("garden")).toEqual({ columns: 1, rows: 0 });
    expect(windowMullionGrid("garden", "none")).toEqual({ columns: 0, rows: 0 });
    expect(windowMullionGrid("garden", "1x0")).toEqual({ columns: 1, rows: 0 });
    expect(windowMullionGrid("garden", "0x1")).toEqual({ columns: 0, rows: 1 });
    expect(windowMullionGrid("garden", "0x3")).toEqual({ columns: 0, rows: 3 });
    expect(windowMullionGrid("garden", "2x2")).toEqual({ columns: 2, rows: 2 });
  });

  it("renders saved per-window scene, frame, and grid metadata on the opening mesh", () => {
    const root = new THREE.Group();
    addWallOpening(root, {
      uid: "appearance-window",
      kind: "window",
      label: "Window",
      side: "top",
      offset: 24,
      width: 36,
      height: 36,
      sill: 42,
      windowSceneKind: "coastal",
      windowFrameStyle: "black",
      windowConstructionStyle: "double-hung",
      windowGridStyle: "none",
    }, { width: 144, depth: 120, ceilingHeight: 96 });
    const muntins: THREE.Object3D[] = [];
    let glass: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.windowMuntin) muntins.push(node);
      if (node.userData.windowGlassReflection) glass = node;
    });
    expect(muntins).toHaveLength(1);
    expect(glass?.userData).toMatchObject({ windowSceneKind: "coastal", windowConstructionStyle: "double-hung", windowGridStyle: "none" });
    const trim = root.children[0]?.children.find((node) => node.userData.architecturalOpeningTrim) as THREE.Mesh | undefined;
    expect((trim?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("20252b");
  });
});
