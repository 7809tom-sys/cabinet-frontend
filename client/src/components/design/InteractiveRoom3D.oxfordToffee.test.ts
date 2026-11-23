// @vitest-environment jsdom
/**
 * Oxford Toffee (Warm Toffee, Madison) is a wood-tone shaker. The 3D frame is
 * the only frame. The door photograph's own stiles and rails stay out of the
 * texture. Grain comes from the flat center panel.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, doorProfileKind, pieceGrainTexture } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile } from "@/lib/doorStyleAppearance";
import { isRaisedPanelStyle } from "@shared/raisedPanelDoorBlueprint";
import { woodPanelPreviewUv } from "@/lib/woodPanelGrain";

const TOFFEE = {
  id: 330030,
  distributorId: 210002,
  ourName: "Oxford Toffee",
  aliasName: "Warm Toffee (Madison)",
  styleCode: "OT",
  doorStyle: "Shaker",
  finish: "Warm Toffee (Madison)",
  woodSpecies: "Solid Birch frame / veneered center panel",
  color: "#A07850",
  grainDirection: null,
  doorSampleImageUrl: "/manus-storage/media-library/oxford-toffee-door.jpg",
  drawerSampleImageUrl: "/manus-storage/media-library/oxford-toffee-drawer.jpg",
};

const CROP = {
  slug: "versa-shaker",
  doorSize: [141, 240] as [number, number],
  drawerSize: [141, 58] as [number, number],
  drawerSolidColor: null,
  solidColor: "#a07850",
  grainUrl: null,
  faceTileIn: [6, 12] as [number, number],
  faceTileDrawerIn: [4, 8] as [number, number],
};

function sku(masterCode: string, placement: "base" | "wall", width: number, height: number, depth: number) {
  return {
    placementUid: masterCode,
    masterCode,
    description: masterCode === "LSB36" ? '36" Lazy Susan Base' : masterCode,
    placementType: placement,
    width,
    depth,
    height,
    numberOfDoors: 2,
    numberOfDrawers: placement === "base" && masterCode.startsWith("B") ? 1 : 0,
    category: placement === "wall" ? "Wall" : "Base",
  } as never;
}

function build(masterCode: string, placement: "base" | "wall", width: number, height: number, depth: number) {
  const profile = designerCatalogDoorProfile(TOFFEE as never);
  const root = new THREE.Group();
  addCabinet(
    root,
    sku(masterCode, placement, width, height, depth),
    "back",
    { back: 0 },
    144,
    120,
    "#a07850",
    "#eeeeee",
    profile as never,
    { x: 0, z: 0, rotation: 0 },
    TOFFEE.doorSampleImageUrl,
    undefined,
    { selectedToeKick: placement === "base", drawerSampleUrl: TOFFEE.drawerSampleImageUrl, faceCrop: CROP },
  );
  return { root, profile };
}

function materialOf(node: THREE.Object3D): THREE.MeshStandardMaterial | null {
  const mesh = node as THREE.Mesh;
  if (!mesh.isMesh || Array.isArray(mesh.material)) return null;
  const material = mesh.material as THREE.MeshStandardMaterial;
  return material && "map" in material ? material : null;
}

describe("Oxford Toffee wood photo", () => {
  it("is a shaker in the 3D profile; the raised bevel lives in the door photograph", () => {
    expect(isRaisedPanelStyle(TOFFEE)).toBe(false);
    expect(doorProfileKind(TOFFEE.doorStyle, null)).toBe("shaker");
    expect(designerCatalogDoorProfile(TOFFEE as never)?.paintedFinish).toBe(false);
  });

  it("textures both lazy-Susan leaves with the center panel, not the framed photo or the flat tan", () => {
    const { root } = build("LSB36", "base", 36, 34.5, 24);
    const uv = woodPanelPreviewUv();
    const leaves = ["back-leg", "side-leg"].map((leg) => {
      let found: THREE.MeshStandardMaterial | null = null;
      root.traverse((node) => {
        if (node.userData?.lCornerDoor === leg) found = materialOf(node);
      });
      return found;
    });
    expect(leaves.every((material) => material?.map)).toBe(true);
    for (const material of leaves) {
      expect(material!.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(material!.map!.repeat.x).toBeCloseTo(uv.repeatX);
      expect(material!.map!.repeat.y).toBeCloseTo(uv.repeatY);
      expect(material!.map!.offset.x).toBeCloseTo(uv.offsetX);
      expect(material!.map!.offset.y).toBeCloseTo(uv.offsetY);
      expect(material!.map!.repeat.x).not.toBeCloseTo(1);
      expect(material!.userData.centerPanelGrain).toBe(true);
      expect(material!.toneMapped).toBe(false);
      expect(material!.userData.woodPhotoFidelity).toBe(true);
      expect(`#${material!.color.getHexString()}`).toBe("#ffffff");
    }
    let rails = 0;
    root.traverse((node) => {
      if (node.userData?.grainPiece !== "rail") return;
      const material = materialOf(node);
      expect(material?.map?.rotation).toBeCloseTo(Math.PI / 2);
      rails += 1;
    });
    expect(rails).toBeGreaterThan(0);
  });

  it("keeps the center-panel crop on a base, a wall, and a DCW", () => {
    const uv = woodPanelPreviewUv();
    for (const [code, placement, width, height, depth] of [
      ["B24", "base", 24, 34.5, 24],
      ["W2430", "wall", 24, 30, 12],
      ["DCW2442", "wall", 24, 42, 12],
    ] as const) {
      const { root } = build(code, placement, width, height, depth);
      let fronts = 0;
      root.traverse((node) => {
        if (!node.userData?.cabinetFront && !node.userData?.physicalRail) return;
        const material = materialOf(node);
        if (!material?.map) return;
        fronts += 1;
        expect(material.map.wrapS, code).toBe(THREE.ClampToEdgeWrapping);
        expect(material.map.repeat.x, code).toBeCloseTo(uv.repeatX);
        expect(material.map.offset.x, code).toBeCloseTo(uv.offsetX);
        expect(material.userData.centerPanelGrain, code).toBe(true);
      });
      expect(fronts, code).toBeGreaterThan(0);
    }
  });

  it("does not squash the door photo onto drawer or false fronts", () => {
    const uv = woodPanelPreviewUv();
    const root = new THREE.Group();
    const profile = designerCatalogDoorProfile(TOFFEE as never);
    addCabinet(
      root,
      {
        placementUid: "3db",
        masterCode: "3DB30",
        description: "3 Drawer Base",
        placementType: "base",
        width: 30,
        depth: 24,
        height: 34.5,
        numberOfDoors: 0,
        numberOfDrawers: 3,
        category: "Base",
      } as never,
      "back",
      { back: 0 },
      144,
      120,
      "#a07850",
      "#eeeeee",
      profile as never,
      { x: 0, z: 0, rotation: 0 },
      TOFFEE.doorSampleImageUrl,
      undefined,
      { selectedToeKick: true, drawerSampleUrl: TOFFEE.drawerSampleImageUrl, faceCrop: CROP },
    );
    let drawers = 0;
    root.traverse((node) => {
      if (!node.userData?.cabinetDrawerFront) return;
      const material = materialOf(node);
      expect(material?.userData.drawerGrain).toBeUndefined();
      expect(material?.userData.centerPanelGrain).toBe(true);
      expect(material?.map).toBeTruthy();
      expect(material!.map!.repeat.x).toBeCloseTo(uv.repeatX);
      expect(material!.map!.offset.x).toBeCloseTo(uv.offsetX);
      expect(material!.map!.repeat.x).not.toBeCloseTo(1);
      expect(material!.map!.repeat.y).not.toBeCloseTo(1);
      expect(material!.toneMapped).toBe(false);
      const piece = pieceGrainTexture(material!.map!, 30, 6, "vertical");
      expect(piece.wrapS).toBe(THREE.RepeatWrapping);
      expect(piece.repeat.x).toBeGreaterThan(1);
      drawers += 1;
    });
    expect(drawers).toBeGreaterThanOrEqual(3);
  });

  it("does not leave the box, sides, or toe kick as the bare catalog hex", () => {
    const { root } = build("LSB36", "base", 36, 34.5, 24);
    const structural: string[] = [];
    root.traverse((node) => {
      if (!node.userData?.selectedFinishStructuralSurface && !node.userData?.baseToeKick && !node.userData?.selectedStyleSideSkin) return;
      const material = materialOf(node);
      if (!material) return;
      const tag = material.map ? "photo" : `#${material.color.getHexString()}`;
      structural.push(tag);
    });
    expect(structural.length).toBeGreaterThan(0);
    expect(structural.every((tag) => tag === "photo" || tag !== "#a07850")).toBe(true);
    expect(structural.some((tag) => tag === "photo")).toBe(true);
    root.traverse((node) => {
      if (!node.userData?.selectedFinishStructuralSurface && !node.userData?.baseToeKick) return;
      const material = materialOf(node);
      if (!material?.map) return;
      expect(material.toneMapped).toBe(false);
      expect(material.userData.woodPhotoFidelity).toBe(true);
      expect(material.userData.centerPanelGrain).toBe(true);
      expect(material.map.repeat.x).toBeCloseTo(woodPanelPreviewUv().repeatX);
      expect(material.map.offset.x).toBeCloseTo(woodPanelPreviewUv().offsetX);
      expect(`#${material.color.getHexString()}`).toBe("#ffffff");
    });
  });
});
