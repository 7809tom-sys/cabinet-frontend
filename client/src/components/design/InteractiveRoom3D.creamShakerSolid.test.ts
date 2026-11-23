// @vitest-environment jsdom
/**
 * Live Classic Cream (door style "Shaker", confirmed hex #cac2aa) was rendered
 * from its door photograph. The hex paint plan still pointed doorUrl at that
 * photograph and set faceTileIn, so the frame in the photo repeated across
 * every front. The 3D view should paint the saved hex and one shaker outline.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";

const CREAM = {
  id: 330002,
  distributorId: 210001,
  ourName: "Classic Cream",
  aliasName: "Aura Cream (Ashford)",
  styleCode: "CC",
  doorStyle: "Shaker",
  panelConstruction: "flat",
  finish: "Aura Cream (Ashford)",
  finishCategory: null,
  color: "f9f7eb",
  renderHex: "#cac2aa",
  doorColorSource: "hex",
  doorColorSourceValue: { hex: "#cac2aa" },
  grainDirection: "none",
  doorSampleImageUrl: "/manus-storage/media-library/classic-cream-door.jpg",
  drawerSampleImageUrl: "/manus-storage/media-library/classic-cream-drawer.jpg",
};

const SKU = {
  placementUid: "cream-b24",
  masterCode: "B24",
  description: '24" Base',
  placementType: "base",
  width: 24,
  depth: 24,
  height: 34.5,
  numberOfDoors: 2,
  numberOfDrawers: 1,
  category: "Base",
  subCategory: "Standard Base",
} as never;

describe("live Shaker Classic Cream renders as flat paint", () => {
  it("classifies the row as a solid painted shaker and keeps the saved hex", () => {
    const profile = designerCatalogDoorProfile(CREAM as never);
    expect(profile?.paintedFinish).toBe(true);
    expect(profile?.doorStyle?.toLowerCase()).toContain("shaker");
    const plan = designerFacePlan(CREAM as never, "base");
    // The hex plan is a solid color. It must not be the door photograph.
    expect(plan?.dlcCrop?.solidColor?.toLowerCase()).toBe("#cac2aa");
    expect(plan?.dlcCrop?.grainUrl ?? null).toBeNull();
  });

  it("draws flat fronts and one outline, with no tiled door photograph", () => {
    const finish = doorStyleFinishColors(CREAM as never);
    const profile = designerCatalogDoorProfile(CREAM as never);
    const plan = designerFacePlan(CREAM as never, "base");
    const root = new THREE.Group();
    // The Designer falls back to the door photograph when a plan has no image.
    // Pass that photograph plus the plan crop, the way the 3D view does.
    addCabinet(
      root,
      SKU,
      "back",
      { back: 0 },
      144,
      120,
      finish.face,
      "#eeeeee",
      profile as never,
      { x: 0, z: 0, rotation: 0 },
      plan?.doorUrl ?? CREAM.doorSampleImageUrl,
      undefined,
      {
        selectedToeKick: true,
        drawerSampleUrl: plan?.drawerUrl ?? CREAM.drawerSampleImageUrl,
        faceSourceKind: plan?.sourceKind,
        faceCrop: plan?.dlcCrop ?? null,
      },
    );
    let frames = 0;
    let outlines = 0;
    const frontMaps: boolean[] = [];
    const structuralMaps: boolean[] = [];
    root.traverse((node) => {
      if (node.userData?.physicalRails) frames += 1;
      if (node.userData?.shakerFrameOutline) outlines += 1;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material || !("map" in material)) return;
      const mapped = Boolean(material.map);
      if (mapped && material.map) {
        expect(Math.abs(material.map.repeat.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(material.map.repeat.y)).toBeLessThanOrEqual(1);
      }
      if (mesh.userData.cabinetFront || mesh.userData.physicalRail || mesh.userData.cabinetDrawerFront) frontMaps.push(mapped);
      if (mesh.userData.selectedFinishStructuralSurface || mesh.userData.baseToeKick || mesh.userData.cabinetFaceFrame) structuralMaps.push(mapped);
    });
    expect(frames).toBeGreaterThan(0);
    expect(outlines).toBe(frames);
    expect(frontMaps.length).toBeGreaterThan(0);
    expect(frontMaps.every((mapped) => mapped === false)).toBe(true);
    expect(structuralMaps.every((mapped) => mapped === false)).toBe(true);
  });

  it("paints Zenith Sage flat on a DCW2442, with no screenshot texture", () => {
    const sage = {
      id: 330005,
      distributorId: 210001,
      ourName: "Fresh Sage",
      aliasName: "Zenith Sage (Ashford)",
      styleCode: "FS",
      doorStyle: "Shaker",
      panelConstruction: "flat",
      finish: "Zenith Sage (Ashford)",
      color: "#8FAF8A",
      renderHex: "#798764",
      doorColorSource: "approved-ai-image",
      grainDirection: "none",
      doorSampleImageUrl: "/manus-storage/media-library/zenith-sage-screenshot.jpg",
      drawerSampleImageUrl: "/manus-storage/media-library/zenith-sage-drawer-screenshot.jpg",
    };
    const profile = designerCatalogDoorProfile(sage as never);
    expect(profile?.paintedFinish).toBe(true);
    const finish = doorStyleFinishColors(sage as never);
    const root = new THREE.Group();
    addCabinet(
      root,
      {
        placementUid: "sage-dcw",
        masterCode: "DCW2442",
        description: '24" x 42" Wall',
        placementType: "wall",
        width: 24,
        depth: 12,
        height: 42,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        category: "Wall",
        subCategory: "Wall",
      } as never,
      "back",
      { back: 0 },
      144,
      120,
      finish.face,
      "#eeeeee",
      profile as never,
      { x: 0, z: 0, rotation: 0 },
      sage.doorSampleImageUrl,
      undefined,
      { drawerSampleUrl: sage.drawerSampleImageUrl, faceCrop: designerFacePlan(sage as never, "wall")?.dlcCrop ?? null },
    );
    let frames = 0;
    let outlines = 0;
    let mapped = 0;
    root.traverse((node) => {
      if (node.userData?.physicalRails) frames += 1;
      if (node.userData?.shakerFrameOutline) outlines += 1;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material?.map) mapped += 1;
    });
    expect(frames).toBeGreaterThan(0);
    expect(outlines).toBe(frames);
    expect(mapped).toBe(0);
    expect(finish.face.toLowerCase()).toBe("#798764");
  });

  it("keeps Warm Toffee's door photo when the shaker crop is only a tan hex", () => {
    const toffee = {
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
      doorSampleImageUrl: "/manus-storage/media-library/warm-toffee-door.jpg",
    };
    const profile = designerCatalogDoorProfile(toffee as never);
    expect(profile?.paintedFinish).toBe(false);
    const root = new THREE.Group();
    addCabinet(
      root,
      {
        placementUid: "toffee-dcw",
        masterCode: "DCW2442",
        description: '24" x 42" Wall',
        placementType: "wall",
        width: 24,
        depth: 12,
        height: 42,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        category: "Wall",
      } as never,
      "back",
      { back: 0 },
      144,
      120,
      "#a07850",
      "#eeeeee",
      profile as never,
      { x: 0, z: 0, rotation: 0 },
      toffee.doorSampleImageUrl,
      undefined,
      {
        faceCrop: {
          slug: "versa-shaker",
          doorSize: [12, 24],
          drawerSize: null,
          drawerSolidColor: null,
          solidColor: "#a07850",
          grainUrl: null,
          faceTileIn: [12, 24],
          faceTileDrawerIn: [12, 7.5],
        },
      },
    );
    let fronts = 0;
    let mappedFronts = 0;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      if (!mesh.userData.cabinetFront && !mesh.userData.physicalRail) return;
      fronts += 1;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material.map) return;
      mappedFronts += 1;
      expect(Math.abs(material.map.repeat.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(material.map.repeat.y)).toBeLessThanOrEqual(1);
      expect(material.map.wrapS).toBe(THREE.ClampToEdgeWrapping);
    });
    expect(fronts).toBeGreaterThan(0);
    expect(mappedFronts).toBe(fronts);
  });
});
