// @vitest-environment jsdom
/**
 * A borrowed grain must look the same on every surface of the cabinet.
 *
 * Natura Maple (Ashford `Designer Natural`, 330004) is not a DL finish, so the
 * shaker blueprint gives it Versa Shaker's grain as a template. The renderer
 * used to run the DL photo light compensation over that template, which darkened
 * it, and the tint that was supposed to bring it back to the door's own colour
 * clamped to `#ffffff` in sRGB. The cabinet rendered #776d5a instead of #d4b896
 * (ΔE2000 26.7).
 *
 * These tests read the materials the real renderer builds.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import catalog from "@shared/fixtures/doorStyleSideCatalog.json";
import { addCabinet } from "./InteractiveRoom3D";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { dlcPhotoLightCompensation } from "@shared/dlcFr26Textures";
import { RESTORED_DOOR_LIGHTS, relativeLuminance } from "@shared/doorRenderLights";

type CatalogStyle = {
  id: number;
  distributorId: number;
  styleCode?: string;
  ourName?: string;
  aliasName?: string;
  color?: string;
  finish?: string;
  doorStyle?: string;
  woodSpecies?: string;
};

const styles = catalog as CatalogStyle[];

type Surface = { kind: string; material: THREE.MeshStandardMaterial };

function surfacesFor(id: number): { surfaces: Surface[]; doorColor: string; cropSlug: string | null } {
  const style = styles.find((entry) => entry.id === id)!;
  const plan = designerFacePlan(style, "base")!;
  const finish = doorStyleFinishColors(style);
  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: `u-${id}`,
      masterCode: "B24",
      description: '24" Two Door Base Cabinet',
      placementType: "base",
      width: 24,
      depth: 24,
      height: 34.5,
      // Door and drawer counts come from the cabinet edit config.
      numberOfDoors: 2,
      numberOfDrawers: 0,
      category: "Base",
      subCategory: "Standard Base",
    } as never,
    "back",
    { back: 0 },
    144,
    120,
    finish.face,
    "#eeeeee",
    designerCatalogDoorProfile(style) as never,
    { x: 0, z: 0, rotation: 0 },
    plan.doorUrl,
    undefined,
    {
      selectedToeKick: true,
      drawerSampleUrl: plan.drawerUrl,
      faceSourceKind: plan.sourceKind,
      faceCrop: plan.dlcCrop ?? null,
    },
  );

  const surfaces: Surface[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const kind = mesh.userData.cabinetFront || mesh.userData.physicalRail ? "front"
      : mesh.userData.baseToeKick ? "toe-kick"
        : mesh.userData.selectedFinishStructuralSurface || mesh.userData.selectedStyleSideSkin ? "side"
          : "";
    if (kind) surfaces.push({ kind, material });
  });
  return { surfaces, doorColor: finish.face, cropSlug: plan.dlcCrop?.slug ?? null };
}

/** Materials whose tint is a borrowed grain: the map exists and tone mapping stays on. */
function grainFaces(surfaces: Surface[]) {
  return surfaces.filter((surface) => surface.material.map && surface.material.toneMapped);
}

describe("Natura Maple's borrowed grain", () => {
  it("uses the shaker grain template, not the DL photo compensation", () => {
    const { surfaces } = surfacesFor(330004);
    const fronts = grainFaces(surfaces.filter((surface) => surface.kind === "front"));
    expect(fronts.length).toBeGreaterThan(0);
    // The compensation would have painted the whole light sum as a dark tint and
    // switched the tone map off.
    const compensation = dlcPhotoLightCompensation(RESTORED_DOOR_LIGHTS, relativeLuminance("#d4b896")).hex;
    expect(compensation).toBe("#b7b9bd");
    for (const front of fronts) {
      expect(`#${front.material.color.getHexString()}`).not.toBe(compensation);
      expect(front.material.toneMapped).toBe(true);
    }
  });

  it("gives the fronts, box, sides and toe kick one appearance", () => {
    const { surfaces } = surfacesFor(330004);
    const front = surfaces.find((surface) => surface.kind === "front" && surface.material.map)!;
    const structural = surfaces.filter((surface) => surface.kind !== "front" && surface.material.map);
    expect(structural.length).toBeGreaterThan(0);
    for (const surface of structural) {
      expect(`#${surface.material.color.getHexString()}`).toBe(`#${front.material.color.getHexString()}`);
      expect(surface.material.toneMapped).toBe(front.material.toneMapped);
    }
  });

  it("lifts the grain to the door's own recorded colour", () => {
    const { surfaces, doorColor } = surfacesFor(330004);
    expect(doorColor.toLowerCase()).toBe("#d4b896");
    const front = grainFaces(surfaces.filter((surface) => surface.kind === "front"))[0]!;
    // A brightening multiplier: the door is lighter than the Versa Shaker grain.
    expect(front.material.color.r).toBeGreaterThan(1);
  });

  it("leaves a real DL finish on its own photo compensation", () => {
    const { surfaces, cropSlug } = surfacesFor(600004);
    expect(cropSlug).toBe("versa-shaker");
    const fronts = surfaces.filter((surface) => surface.kind === "front" && surface.material.map);
    expect(fronts.length).toBeGreaterThan(0);
    // Versa Shaker is its own studio photo, so it keeps the compensation.
    for (const front of fronts) expect(front.material.toneMapped).toBe(false);
  });
});

describe("a drawer front beside a stained Natura Maple door", () => {
  it("carries the same appearance as the door", () => {
    const style = styles.find((entry) => entry.id === 330004)!;
    const plan = designerFacePlan(style, "base")!;
    const finish = doorStyleFinishColors(style);
    const root = new THREE.Group();
    addCabinet(
      root,
      {
        placementUid: "u-drawers",
        masterCode: "3DB24",
        description: '24" Three Drawer Base Cabinet',
        placementType: "base",
        width: 24,
        depth: 24,
        height: 34.5,
        // Door and drawer counts come from the cabinet edit config.
        numberOfDoors: 1,
        numberOfDrawers: 3,
        category: "Base",
        subCategory: "Standard Base",
      } as never,
      "back",
      { back: 0 },
      144,
      120,
      finish.face,
      "#eeeeee",
      designerCatalogDoorProfile(style) as never,
      { x: 0, z: 0, rotation: 0 },
      plan.doorUrl,
      undefined,
      {
        selectedToeKick: true,
        drawerSampleUrl: plan.drawerUrl,
        faceSourceKind: plan.sourceKind,
        faceCrop: plan.dlcCrop ?? null,
      },
    );

    const drawer: THREE.MeshStandardMaterial[] = [];
    const front: THREE.MeshStandardMaterial[] = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
      if (!material || !("color" in material)) return;
      if (mesh.userData.cabinetDrawerFront) drawer.push(material);
      if (mesh.userData.cabinetFront) front.push(material);
    });
    expect(drawer.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);
    const doorTint = front[0]!.color;
    for (const material of drawer) {
      expect(material.toneMapped).toBe(true);
      expect(material.color.r).toBeCloseTo(doorTint.r, 5);
      expect(material.color.g).toBeCloseTo(doorTint.g, 5);
      expect(material.color.b).toBeCloseTo(doorTint.b, 5);
    }
  });
});
