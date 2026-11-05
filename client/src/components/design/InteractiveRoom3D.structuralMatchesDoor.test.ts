// @vitest-environment jsdom
/**
 * Owner-approved restoration (Nov 5 2026): box, side panels and toe kick follow the
 * SAME door appearance as the fronts.
 *
 * Origin of the defect: PR #123 (`dc65100`, Oct 30 2026) deliberately split the two.
 * `threeDStructuralFinish` stopped returning the door sample and `#ffffff` tint and
 * returned the flat catalog hex instead, while `threeDFaceMaterialColor` kept the
 * photo. Same cabinet, two colour sources.
 *
 * These tests read the materials the real renderer builds, so a regression in the
 * split shows up as two different colours on one cabinet. They deliberately do NOT
 * assert that the skin board has raised geometry — a thin overlay board is flat by
 * design, and that was never the defect.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  addCabinet,
  applyThreeDStructuralFinishMaterials,
  threeDFaceMaterialColor,
  threeDStructuralFinish,
  type ThreeDDoorProfile,
} from "./InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { resolveKitchenDoorColor } from "@/lib/acceptedDoorAppearance";

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

/** Carbon Frost: Aspen Charcoal / Preston, stored color name not a hex. */
const CARBON_FROST = {
  id: 390012, styleCode: "AC", ourName: "Aspen Charcoal", aliasName: "Carbon Frost",
  distributorId: 180001, distributorName: "Preston", distributorCode: "SK",
  color: "Espresso Brown", finish: "Matching", woodSpecies: "Solid Birch",
  doorStyle: "Raised Panel", doorPanelType: "Raised Panel", panelConstruction: "raised",
};

/** Ivory Dune: Madison Haven, painted HDF, solid catalog hex. */
const IVORY_DUNE = {
  id: 330028, styleCode: "HD", ourName: "Haven Dune", aliasName: "Iroy Dune (Madison)",
  distributorId: 210002, color: "#D4C4A0", woodSpecies: "Painted HDF",
  finish: "Iroy Dune (Madison)", doorStyle: "Haven",
};

/** A stained wood style (keeps grain; must not be painted solid). */
const STAINED_OAK = {
  id: 330004, styleCode: "DN", ourName: "Designer Natural", distributorId: 210001,
  color: "#D4B896", woodSpecies: "Oak", finish: "Natural", doorStyle: "Shaker",
};

type Row = typeof CARBON_FROST | typeof IVORY_DUNE | typeof STAINED_OAK;

function build(row: Row & { approvedVersionId?: number | null; renderHex?: string | null; approvedReferenceImageUrl?: string | null; doorSampleImageUrl?: string }, doorUrl: string | null) {
  const finish = doorStyleFinishColors(row as never);
  const profile = designerCatalogDoorProfile(row as never) as ThreeDDoorProfile | null;
  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: `u-${row.id}`, masterCode: "B24", description: '24" Base Cabinet', placementType: "base",
      width: 24, depth: 24, height: 34.5, numberOfDoors: 2, numberOfDrawers: 0,
      category: "Base", subCategory: "Standard Base",
    } as never,
    "back", { back: 0 }, 144, 120, finish.face, "#eeeeee", profile as never,
    { x: 12, z: 0, rotation: 0 }, doorUrl, undefined, { selectedToeKick: true },
  );
  return root;
}

/** Colour + whether a map is present, per surface class. */
function surfaces(root: THREE.Group) {
  const fronts: string[] = [];
  const structural: string[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const tag = `${`#${material.color.getHexString()}`}|map:${material.map ? "yes" : "no"}`;
    if (mesh.userData.cabinetFront) fronts.push(tag);
    if (mesh.userData.selectedStyleSideSkin || mesh.userData.baseToeKick || mesh.userData.selectedFinishStructuralSurface) structural.push(tag);
  });
  return { fronts: Array.from(new Set(fronts)), structural: Array.from(new Set(structural)) };
}

describe("structural surfaces follow the same door appearance as the fronts", () => {
  it("reports the structural finish as the door sample, matching the face function", () => {
    // The exact pre-PR123 contract, restored.
    for (const hasSample of [true, false]) {
      const face = threeDFaceMaterialColor("#d4c4a0", hasSample);
      const structural = threeDStructuralFinish("#d4c4a0", hasSample);
      expect(structural.usesDoorSample).toBe(hasSample);
      expect(structural.color).toBe(face);
    }
    expect(threeDStructuralFinish("#d4c4a0", true)).toEqual({ color: "#ffffff", usesDoorSample: true });
    expect(threeDStructuralFinish("#d4c4a0", false)).toEqual({ color: "#d4c4a0", usesDoorSample: false });
  });

  it("shades structural materials from the sample, not the flat catalog hex", () => {
    // The renderer applies the loaded door image to the structural materials
    // through this helper. With a sample it is a white tint over that image; with
    // none it is the resolved solid. That is the whole restoration.
    const withSample = [new THREE.MeshStandardMaterial({ color: "#000000" })];
    const appliedWith = applyThreeDStructuralFinishMaterials(withSample, "#d4c4a0", new THREE.Texture());
    expect(appliedWith.texture).not.toBeNull();
    expect(appliedWith.color).toBe("#ffffff");
    expect(withSample[0]!.map).not.toBeNull();
    expect(`#${withSample[0]!.color.getHexString()}`).toBe("#ffffff");

    const noSample = [new THREE.MeshStandardMaterial({ color: "#000000" })];
    const appliedWithout = applyThreeDStructuralFinishMaterials(noSample, "#d4c4a0", null);
    expect(appliedWithout.texture).toBeNull();
    expect(appliedWithout.color).toBe("#d4c4a0");
    expect(noSample[0]!.map).toBeNull();
    expect(`#${noSample[0]!.color.getHexString()}`).toBe("#d4c4a0");
  });

  it("passes the loaded door image to the structural pass at every call site", () => {
    // Source-level: the loader callback and the initial pass both hand the door
    // image through, so box/sides/toe kick are shaded from the fronts' appearance.
    const src = readFileSync(new URL("./InteractiveRoom3D.tsx", `file://${process.cwd()}/client/src/components/design/InteractiveRoom3D.tsx`), "utf8");
    expect(src).toContain("applyPlainStructuralFinish?.(color, loaded)");
    expect(src).toContain("applyStructuralFinish(color, doorTexture)");
    expect(src).not.toContain("applyStructuralFinish(color, null);\n  if (dlcDoorFinish");
    // The structural pass must never hardcode the door sample away.
    expect(src).not.toContain("doorPanelHex: null");
  });

  it("uses the resolved solid finish on every surface when there is no door image", () => {
    const root = build(IVORY_DUNE, null);
    const { fronts, structural } = surfaces(root);
    expect(Array.from(new Set([...fronts, ...structural]))).toHaveLength(1);
    expect(structural[0]).toBe("#d4c4a0|map:no");
  });

  it("does not introduce a second colour for a raised style with a door image", () => {
    const root = build({ ...CARBON_FROST, doorSampleImageUrl: "/uploads/carbon-frost-door.jpg" }, "/uploads/carbon-frost-door.jpg");
    const { structural } = surfaces(root);
    expect(structural).toHaveLength(1);
    expect(structural[0]).toMatch(/map:yes/);
  });

  it("keeps a stained style's grain instead of painting it solid", () => {
    const root = build({ ...STAINED_OAK, doorSampleImageUrl: "/uploads/oak-door.jpg" }, "/uploads/oak-door.jpg");
    const { structural } = surfaces(root);
    // A stained finish keeps the sample (grain), never a flat solid.
    expect(structural[0]).toMatch(/map:yes/);
  });

  it("matches when an approved render is the appearance", () => {
    const approved = {
      ...IVORY_DUNE,
      approvedVersionId: 4011,
      renderHex: "#34363a",
      approvedReferenceImageUrl: "/manus-storage/door-rendering-audit/ivory-approved.png",
    };
    // The approved render wins the colour resolution and supplies the image.
    const decision = resolveKitchenDoorColor(approved as never);
    expect(decision.appliedHex).toBe("#34363a");
    expect(decision.appliedSource).toBe("accepted-render");
    // Structural surfaces take that same approved image.
    const materials = [new THREE.MeshStandardMaterial({ color: "#000000" })];
    const applied = applyThreeDStructuralFinishMaterials(materials, decision.appliedHex, new THREE.Texture());
    expect(applied.color).toBe("#ffffff");
    expect(materials[0]!.map).not.toBeNull();
  });

  it("keeps the resolved hex when the record has no image and no approval", () => {
    // Never snapped to a brand palette: whatever the resolver chose is what paints.
    const style = { ...IVORY_DUNE, id: 990123, ourName: "Unlisted Colour", color: "#7f6a52" };
    const expected = resolveKitchenDoorColor(style as never).appliedHex;
    const root = build(style as Row, null);
    const { structural } = surfaces(root);
    expect(structural).toEqual([`${expected}|map:no`]);
  });
});
