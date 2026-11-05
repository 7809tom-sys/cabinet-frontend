// @vitest-environment jsdom
/**
 * The accepted door render paints every 3D surface, and no surface may fall back
 * to a name-keyword swatch.
 *
 * Reported: a Carbon Frost kitchen (Preston / Skyline, raised panel, approved door
 * hex #34363a) showed the dark raised door in the selected style bar while the 3D
 * view drew a light shaker door with a linen box and toe kick. The linen bucket in
 * the keyword table is #e6dcc6 — a name guess, not the door.
 *
 * These tests build one cabinet the way the Designer does — with the
 * accepted-merged finish and door profile — and read the materials that actually
 * end up on the box, the exposed sides, the toe kick, and the door front.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, threeDFaceMaterialColor, threeDStructuralFinish } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { styleWithAccepted, acceptedAppearanceRowMap, type DesignerStyleRow } from "@/lib/designerThreeDStyles";
import { withFramelessExposedFinish } from "@/lib/framelessExposedFinish";

const ACCEPTED_HEX = "#34363a";
const LINEN_KEYWORD_FACE = "#e6dcc6";

const CARBON_FROST: DesignerStyleRow = {
  id: 390012,
  styleCode: "AC",
  ourName: "Aspen Charcoal",
  aliasName: "Carbon Frost",
  distributorId: 180001,
  distributorName: "Preston",
  distributorCode: "SK",
  color: "Espresso Brown",
  finish: "Matching",
  woodSpecies: "Solid Birch",
  doorStyle: "Raised Panel",
  doorPanelType: "Raised Panel",
  panelConstruction: "raised",
};

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

function mergedStyle() {
  return styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap([
    { styleId: 390012, colorHex: ACCEPTED_HEX, textureUrl: "/audit/carbon-frost.png", approvedVersionId: 4011 },
  ]))!;
}

function buildAcceptedCabinet(): Mesh[] {
  const style = mergedStyle();
  const finish = doorStyleFinishColors(style as never);
  const profile = withFramelessExposedFinish(style, designerCatalogDoorProfile(style as never));
  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: "carbon-frost-b24",
      masterCode: "B24",
      description: '24" Base Cabinet',
      placementType: "base",
      width: 24,
      depth: 24,
      height: 34.5,
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
    profile as never,
    { x: 12, z: 0, rotation: 0 },
    null,
    undefined,
    { selectedToeKick: true },
  );
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if ((node as Mesh).isMesh) meshes.push(node as Mesh);
  });
  return meshes;
}

function colorsOf(meshes: readonly Mesh[], predicate: (mesh: Mesh) => boolean): string[] {
  const out = new Set<string>();
  for (const mesh of meshes) {
    if (!predicate(mesh)) continue;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material || !("color" in material)) continue;
      const color = (material as THREE.MeshStandardMaterial).color;
      if (color) out.add(`#${color.getHexString()}`);
    }
  }
  return Array.from(out);
}

describe("the accepted render paints the cabinet box, sides, and toe kick", () => {
  it("uses the approved hex on the carcass, the exposed sides, and the toe kick", () => {
    const meshes = buildAcceptedCabinet();
    expect(meshes.length).toBeGreaterThan(1);
    const structural = colorsOf(meshes, (mesh) => (
      mesh.userData.selectedFinishSideSkin === true
      || mesh.userData.selectedToeKickFinishSkin === true
      || mesh.userData.selectedFinishStructuralSurface === true
    ));
    expect(structural.length).toBeGreaterThan(0);
    expect(structural).toEqual([ACCEPTED_HEX]);
  });

  it("never shows the linen keyword bucket on any visible cabinet surface", () => {
    const meshes = buildAcceptedCabinet();
    const visible = colorsOf(meshes, (mesh) => {
      const tags = Object.keys(mesh.userData);
      if (tags.some((tag) => /ShadowGap|Reveal/i.test(tag))) return false;
      if (mesh.userData.isCountertop || mesh.userData.countertopSurface) return false;
      return true;
    });
    expect(visible).not.toContain(LINEN_KEYWORD_FACE);
  });

  it("reports the structural finish as exactly the accepted color when there is no sample, and never a name", () => {
    const finish = threeDStructuralFinish(ACCEPTED_HEX, false);
    expect(finish.color).toBe(ACCEPTED_HEX);
    expect(finish.usesDoorSample).toBe(false);
  });

  it("follows the accepted appearance when one exists, like the fronts", () => {
    // Restoration (Nov 5 2026): with a sample the structural surfaces carry that
    // appearance — white tint over the image — so they cannot show a second shade.
    const finish = threeDStructuralFinish(ACCEPTED_HEX, true);
    expect(finish.color).toBe(threeDFaceMaterialColor(ACCEPTED_HEX, true));
    expect(finish.usesDoorSample).toBe(true);
  });
});

describe("the accepted style decides raised vs shaker in 3D", () => {
  it("builds a raised front for an approved raised style, from the same merged row", () => {
    // The renderer reads the profile the Designer builds from the accepted-merged
    // style; `panelConstruction: "raised"` is what drives the physical bevel.
    const style = mergedStyle();
    const profile = withFramelessExposedFinish(style, designerCatalogDoorProfile(style as never));
    expect(profile?.panelConstruction).toBe("raised");
    expect(profile?.doorStyle).toBe("Raised Panel");
  });

  it("uses the approved color as the profile's painted/stain source, never a catalog swatch", () => {
    const style = mergedStyle();
    expect(doorStyleFinishColors(style as never).face).toBe(ACCEPTED_HEX);
    // The raw row would have resolved from its catalog text instead.
    expect(doorStyleFinishColors(CARBON_FROST as never).face).not.toBe(ACCEPTED_HEX);
  });
});
