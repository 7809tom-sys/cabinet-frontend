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
});
