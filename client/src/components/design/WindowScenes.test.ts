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

  it("recesses the sash inside the wall and projects only the casing and sill by 1/2 inch", () => {
    const root = new THREE.Group();
    addWallOpening(root, {
      uid: "recessed-window",
      kind: "window",
      label: "Window",
      side: "top",
      offset: 24,
      width: 30,
      height: 36,
      sill: 44,
    }, { width: 120, depth: 96, ceilingHeight: 96 });
    const group = root.children[0] as THREE.Group;
    const trim = group.children.find((node) => node.userData.architecturalOpeningTrim) as THREE.Mesh;
    const glass = group.children.find((node) => node.userData.windowGlassReflection) as THREE.Mesh;
    const sill = group.children.find((node) => node.userData.architecturalWindowSill) as THREE.Mesh;
    const trimDepth = (trim.geometry as THREE.BoxGeometry).parameters.depth;
    const glassDepth = (glass.geometry as THREE.BoxGeometry).parameters.depth;
    const sillDepth = (sill.geometry as THREE.BoxGeometry).parameters.depth;
    const proud = (mesh: THREE.Mesh, depth: number) => (group.position.z + mesh.position.z + depth / 2) * 12;
    expect(proud(trim, trimDepth)).toBeCloseTo(0.5, 2);
    expect(proud(sill, sillDepth)).toBeCloseTo(0.5, 2);
    expect(proud(glass, glassDepth)).toBeLessThan(0);
    const scene = group.children.find((node) => node.userData.windowScenePlane) as THREE.Mesh;
    // The window must not draw an opaque cap behind its own glass.
    expect(group.children.some((node) => node.userData.architecturalOpeningBacking)).toBe(false);
    // The exterior view sits at the back of the recess, still behind the glass.
    expect(scene.position.z).toBeLessThan(glass.position.z);
  });

  it("renders see-through glass that reads from both sides", () => {
    const root = new THREE.Group();
    addWallOpening(root, {
      uid: "glass-window",
      kind: "window",
      label: "Window",
      side: "top",
      offset: 24,
      width: 36,
      height: 42,
      sill: 42,
    }, { width: 144, depth: 120, ceilingHeight: 96 });
    const group = root.children[0] as THREE.Group;
    const glass = group.children.find((node) => node.userData.windowGlassReflection) as THREE.Mesh;
    const material = glass.material as THREE.MeshPhysicalMaterial;
    expect(glass.userData.transparentWindowGlass).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(0.25);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    // A transparent pane has to draw after opaque geometry.
    expect(glass.renderOrder).toBeGreaterThan(0);
    // Nothing opaque is allowed behind the glass inside the opening.
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const childMaterial = mesh.material as THREE.Material | undefined;
      if (!childMaterial || childMaterial.transparent) continue;
      const isFacade = Boolean(mesh.userData.architecturalOpeningTrim
        || mesh.userData.architecturalWindowSill
        || mesh.userData.windowMuntin
        || mesh.userData.windowScenePlane);
      expect(isFacade).toBe(true);
    }
  });

  it("keeps the exterior scene and the glass inside the recess on a side wall as well", () => {
    const root = new THREE.Group();
    addWallOpening(root, {
      uid: "kitchen-window",
      kind: "window",
      label: "Window",
      side: "left",
      offset: 18,
      width: 36,
      height: 42,
      sill: 40,
    }, { width: 144, depth: 120, ceilingHeight: 96 });
    const group = root.children[0] as THREE.Group;
    const scene = group.children.find((node) => node.userData.windowScenePlane) as THREE.Mesh;
    const glass = group.children.find((node) => node.userData.windowGlassReflection) as THREE.Mesh;
    expect(scene.position.z).toBeLessThan(glass.position.z);
    expect(group.children.some((node) => node.userData.architecturalOpeningBacking)).toBe(false);
    expect(group.userData.kind).toBe("window");
  });
});
