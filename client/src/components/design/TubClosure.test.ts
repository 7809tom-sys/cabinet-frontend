// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addFurniture } from "./InteractiveRoom3D";
import { FURNITURE_CATALOG, furnitureFootprint, makeFurniture } from "@/lib/design";
import { VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Every bathroom tub the Designer can place must render as a complete closed
 * tub: no see-through walls, a basin floor, a continuous rim, and a drain and
 * overflow on or in the fixture. It must also fill its published envelope, so
 * the selection box hugs the tub instead of floating around a small shell.
 *
 * These checks run through `addFurniture`, the same path the 3D scene uses, with
 * the designer's own FrontSide materials — not a double-sided debug material,
 * which would hide exactly the winding bug this exists to catch.
 */

const TUB_CODES = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES
  .filter((profile) => profile.kind === "freestanding-tub" || profile.kind === "alcove-tub")
  .map((profile) => profile.pelicanCode);

function placedTub(code: string): { group: THREE.Group; definition: (typeof FURNITURE_CATALOG)[number] } {
  const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
  const definition = FURNITURE_CATALOG.find((entry) => entry.pelicanCode === profile.pelicanCode && entry.category === "bathroom-fixture");
  if (!definition) throw new Error(`No furniture definition for ${code}`);
  const furniture = makeFurniture(definition.id, 30, 20);
  const root = new THREE.Group();
  addFurniture(root, furniture);
  root.updateMatrixWorld(true);
  const group = root.children[0] as THREE.Group;
  return { group, definition };
}

function visibleMeshes(group: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  return meshes;
}

/** True when a ray from `origin` along `dir` hits geometry the camera can see. */
function seesGeometry(group: THREE.Object3D, origin: THREE.Vector3, dir: THREE.Vector3): boolean {
  const ray = new THREE.Raycaster(origin.clone(), dir.clone().normalize(), 0, 60);
  const meshes = visibleMeshes(group);
  return ray.intersectObjects(meshes, false).some((hit) => hit.object.visible && (hit.object.material as THREE.Material)?.visible !== false);
}

describe("Every placeable tub renders as a closed tub", () => {
  it("covers every freestanding and alcove tub in the catalog", () => {
    // 10 freestanding (five models in 59" and 67") plus 6 alcove sheets.
    expect(TUB_CODES.length).toBe(16);
    expect(TUB_CODES).toEqual(expect.arrayContaining(['PL-02141 59"', 'PL-02146 59"', "PL-02849L", "PL-02851R"]));
  });

  it.each(TUB_CODES)("%s is a closed tub that fills its published envelope", (code) => {
    const { group, definition } = placedTub(code);

    // 1. No see-through walls. From inside the basin, a ray in each direction
    //    must hit the tub before it can escape.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const inside = new THREE.Vector3(center.x, box.min.y + size.y * 0.5, center.z);
    for (const dir of [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ]) {
      expect(seesGeometry(group, inside, dir), `${code}: see-through wall along ${dir.toArray().join(",")}`).toBe(true);
    }

    // 2. A basin floor, so the room floor is never visible inside the tub.
    const basinFloorMeshes = visibleMeshes(group).filter((mesh) => (
      /freestanding-tub-well|alcove-tub-well/.test(String(mesh.userData.pelicanBathroomFixturePart))
    ));
    expect(basinFloorMeshes.length, `${code}: no basin floor`).toBeGreaterThan(0);

    // 3. A continuous rim: the rim part must span most of the tub's plan.
    const rimMeshes = visibleMeshes(group).filter((mesh) => /tub-rim|alcove-tub-rim/.test(String(mesh.userData.pelicanBathroomFixturePart)));
    expect(rimMeshes.length, `${code}: no rim`).toBeGreaterThan(0);

    // 4. A drain that sits on the fixture, not floating beside it.
    const drain = visibleMeshes(group).find((mesh) => /tub-drain/.test(String(mesh.userData.pelicanBathroomFixturePart)));
    expect(drain, `${code}: no drain`).toBeTruthy();
    const drainBox = new THREE.Box3().setFromObject(drain!);
    expect(drainBox.min.x).toBeGreaterThanOrEqual(box.min.x - 0.01);
    expect(drainBox.max.x).toBeLessThanOrEqual(box.max.x + 0.01);
    expect(drainBox.min.z).toBeGreaterThanOrEqual(box.min.z - 0.01);
    expect(drainBox.max.z).toBeLessThanOrEqual(box.max.z + 0.01);

    // 5. The mesh fills its published envelope, so the selection box hugs it.
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const expected = furnitureFootprint(makeFurniture(definition.id, 0, 0), definition);
    const INCH = 1 / 12;
    expect(size.x * 12).toBeGreaterThan(expected.w * 0.9);
    expect(size.x * 12).toBeLessThanOrEqual(expected.w + 0.6);
    expect(size.z * 12).toBeGreaterThan(expected.d * 0.9);
    expect(size.z * 12).toBeLessThanOrEqual(expected.d + 0.6);
    expect(size.y * 12).toBeGreaterThan(profile.heightIn * 0.9);
    expect(size.y * 12).toBeLessThanOrEqual(profile.heightIn + 0.6);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    void INCH;
  });
});

/**
 * Side and end profile.
 *
 * Owner report (Nov 8 2026), from a side view of PL-02563: the 3D tub flared at
 * the rim and curved sharply in to a narrow pedestal foot, like a bowl on a
 * plinth, while the catalog photo shows nearly vertical sides and a footprint
 * about as wide as the rim.
 *
 * Cause: one hard-coded 0.74 floor taper was applied to every model. The earlier
 * audit only checked closure and envelope, and a tapered shell satisfies both,
 * so nothing caught it. These tests check the silhouette itself.
 */
import { STRAIGHT_SIDED_MIN_BASE_SHARE, TUB_SIDE_PROFILES, isBoxTub, isStraightSided, tubSideProfile, tubWallShare, tubWidthShareAt } from "./tubSideProfiles";
import { ALCOVE_TUB_SPECS, alcoveBasinLayout, alcoveTubSpecFor } from "./alcoveTubGeometry";

const FREESTANDING_CODES = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES
  .filter((profile) => profile.kind === "freestanding-tub")
  .map((profile) => profile.pelicanCode);

/** The XZ extent of a named part, in inches, measured through the real path. */
function partFootprintIn(group: THREE.Group, part: string): { widthIn: number; depthIn: number } | null {
  const mesh = visibleMeshes(group).find((node) => node.userData.pelicanBathroomFixturePart === part);
  if (!mesh) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  return { widthIn: size.x * 12, depthIn: size.z * 12 };
}

describe("Every freestanding tub's side and end profile matches its catalog photo", () => {
  it("gives every freestanding model its own profile entry, not one shared shape", () => {
    // Each distinct model family must be configured explicitly. If a new tub
    // arrives without one it falls back to the soft rectangle, and this fails.
    const codes = FREESTANDING_CODES.map((code) => code.replace(/\s+\d+"$/, ""));
    const unique = [...new Set(codes)];
    expect(unique.length).toBe(5);
    for (const code of unique) {
      expect(TUB_SIDE_PROFILES[code], `no side profile for ${code}`).toBeTruthy();
    }
    // The profiles are genuinely different from one another, not copies.
    const shapes = new Set(unique.map((code) => {
      const p = TUB_SIDE_PROFILES[code]!;
      return `${p.baseFootprint}|${p.cornerRadiusShare}|${p.slipperRise}`;
    }));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it.each(FREESTANDING_CODES)("%s stands on a base that fills most of its envelope", (code) => {
    const { group } = placedTub(code);
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);

    const base = partFootprintIn(group, "freestanding-tub-base");
    const exterior = partFootprintIn(group, "freestanding-tub-exterior");
    expect(base, "no base cap").toBeTruthy();
    expect(exterior, "no exterior shell").toBeTruthy();

    // A genuine pedestal or clawfoot would be exempt. No Pelican freestanding
    // tub is one, so every model here must clear the straight-sided threshold.
    expect(side.baseFootprint).toBeGreaterThanOrEqual(STRAIGHT_SIDED_MIN_BASE_SHARE);
    expect(isStraightSided(side)).toBe(true);

    // The rendered base cap must actually be that wide, in BOTH plan directions.
    const widthShare = base!.widthIn / exterior!.widthIn;
    const depthShare = base!.depthIn / exterior!.depthIn;
    expect(widthShare, `${code} base is ${(widthShare * 100).toFixed(0)}% of the rim width`)
      .toBeGreaterThanOrEqual(STRAIGHT_SIDED_MIN_BASE_SHARE - 0.02);
    expect(depthShare, `${code} base is ${(depthShare * 100).toFixed(0)}% of the rim depth`)
      .toBeGreaterThanOrEqual(STRAIGHT_SIDED_MIN_BASE_SHARE - 0.02);
  });

  it.each(FREESTANDING_CODES)("%s has walls that fall nearly straight from the rim", (code) => {
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);
    // Width at 10%, 50% and 90% of the height. A straight wall changes only a
    // few percent across the body; the old 0.74 bowl dropped about 25 points.
    // The wall turns over a tight radius where it meets the floor (that is the
    // cove a real acrylic tub has), then runs nearly straight. Measure the
    // straight run: from a quarter of the height to the rim.
    const mid = tubWidthShareAt(side, 0.25);
    const upper = tubWidthShareAt(side, 0.75);
    const rim = tubWidthShareAt(side, 1);
    // Measured straight run per model is 4–6 points; the old bowl moved ~25.
    expect(upper - mid, "wall bulges out over the straight run").toBeLessThan(0.07);
    expect(rim - upper, "rim is wider than the wall it caps").toBeLessThan(0.06);
    // Over the whole body above the floor cove the change stays small.
    expect(rim - mid).toBeLessThan(0.12);
    // And it never bulges past the rim.
    for (const t of [0.3, 0.5, 0.7, 0.9]) expect(tubWidthShareAt(side, t)).toBeLessThanOrEqual(1);
    // And the wall never bulges out past the rim.

  });

  it("keeps the rim flush with the wall instead of flaring past it", () => {
    for (const code of Object.keys(TUB_SIDE_PROFILES)) {
      const side = TUB_SIDE_PROFILES[code]!;
      expect(side.rimFlare, `${code} rim flares`).toBeLessThanOrEqual(1.02);
      expect(tubWallShare(side)).toBeGreaterThanOrEqual(0.98);
    }
  });

  it("gives only the slipper model a raised backrest end", () => {
    for (const code of Object.keys(TUB_SIDE_PROFILES)) {
      const side = TUB_SIDE_PROFILES[code]!;
      if (code === "PL-02141") expect(side.slipperRise).toBeGreaterThan(0.1);
      else expect(side.slipperRise, `${code} should have level ends`).toBe(0);
    }
  });

  it.each(FREESTANDING_CODES)("%s sits flat on the floor", (code) => {
    const { group } = placedTub(code);
    const base = visibleMeshes(group).find((node) => node.userData.pelicanBathroomFixturePart === "freestanding-tub-base")!;
    const box = new THREE.Box3().setFromObject(base);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(box.min.y).toBeLessThan(0.05);
  });
});

/**
 * Alcove tubs are rectangular boxes.
 *
 * Owner report (Nov 8 2026), from the 3D view of PL-02851L: the tub had a thin
 * detached panel floating off one end, a right end that swept inward, and a soft
 * bowl-like body. The catalog photo is a plain alcove tub: a flat front apron at
 * full height to the floor, square vertical ends, a flat rectangular deck with a
 * rectangular basin, sitting flat on the floor.
 *
 * Cause: the alcove models reused the freestanding oval silhouette (so their
 * walls tapered inward like a bowl) and an extra "alcove-tub-apron" slab was
 * pushed in front of the body as a separate mesh, 90% as wide and 72% as tall,
 * standing proud of the front face. That slab was the floating panel.
 *
 * Alcove tubs are now built from `ALCOVE_BOX`: one prism, vertical walls at full
 * width from the floor to the deck, square plan corners, level rim, and no
 * separate apron part at all — the front of the box IS the apron.
 */
const ALCOVE_CODES = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES
  .filter((profile) => profile.kind === "alcove-tub")
  .map((profile) => profile.pelicanCode);

/**
 * The exterior shell's plan extent inside a horizontal slice of the body.
 * Scene units are feet; results are converted to inches to compare with the
 * published catalog dimensions. `lowShare`/`highShare` are fractions of the
 * shell's own height, so this does not depend on where the mesh is parented.
 */
function shellExtentAtHeight(group: THREE.Group, lowShare: number, highShare: number): { widthIn: number; depthIn: number } | null {
  const shell = visibleMeshes(group).find((node) => node.userData.pelicanBathroomFixturePart === "freestanding-tub-exterior");
  if (!shell) return null;
  const geometry = shell.geometry as THREE.BufferGeometry;
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const own = geometry.boundingBox!;
  const low = own.min.y + (own.max.y - own.min.y) * lowShare;
  const high = own.min.y + (own.max.y - own.min.y) * highShare;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, seen = 0;
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    if (y < low || y > high) continue;
    seen += 1;
    const x = positions.getX(i);
    const z = positions.getZ(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  if (!seen) return null;
  return { widthIn: (maxX - minX) * 12, depthIn: (maxZ - minZ) * 12 };
}

describe("Every alcove tub is a straight-sided rectangular box with a flat apron", () => {
  it("covers all three alcove sheets in both drain hands", () => {
    expect(ALCOVE_CODES.sort()).toEqual([
      "PL-02849L", "PL-02849R", "PL-02850L", "PL-02850R", "PL-02851L", "PL-02851R",
    ]);
  });

  it.each(ALCOVE_CODES)("%s uses the box profile, not an oval one", (code) => {
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);
    expect(isBoxTub(side), `${code} is not built as a box`).toBe(true);
    // A box has no taper, no waist, no rim flare and no backrest rise.
    expect(side.baseFootprint).toBe(1);
    expect(side.waistMid).toBe(1);
    expect(side.rimFlare).toBe(1);
    expect(side.slipperRise).toBe(0);
    expect(side.cornerRadiusShare).toBe(0);
  });

  it.each(ALCOVE_CODES)("%s has vertical walls at full width all the way down", (code) => {
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);
    // The silhouette never narrows at any height: 100% of the rim everywhere.
    for (const t of [0, 0.1, 0.25, 0.5, 0.66, 0.75, 0.9, 1]) {
      expect(tubWidthShareAt(side, t), `${code} narrows at ${(t * 100).toFixed(0)}% height`).toBe(1);
    }
  });

  it.each(ALCOVE_CODES)("%s renders its base the full size of its rim", (code) => {
    const { group, definition } = placedTub(code);

    const rim = shellExtentAtHeight(group, 0.94, 1.001);
    const waist = shellExtentAtHeight(group, 0.45, 0.55);
    const base = shellExtentAtHeight(group, -0.001, 0.06);
    expect(rim, "no rim ring").toBeTruthy();
    expect(waist, "no mid-body ring").toBeTruthy();
    expect(base, "no base ring").toBeTruthy();

    // No taper anywhere: the body is the same size at the floor, the waist and
    // the deck. Tolerance is 1% for the tiny radius where wall meets base.
    for (const [label, slice] of [["mid-body", waist!], ["base", base!]] as const) {
      const widthShare = slice.widthIn / rim!.widthIn;
      const depthShare = slice.depthIn / rim!.depthIn;
      expect(widthShare, `${code} ${label} is ${(widthShare * 100).toFixed(1)}% of the rim width`)
        .toBeGreaterThanOrEqual(0.99);
      expect(depthShare, `${code} ${label} is ${(depthShare * 100).toFixed(1)}% of the rim depth`)
        .toBeGreaterThanOrEqual(0.99);
    }

    // And the body still fills the published envelope.
    const published = furnitureFootprint(makeFurniture(definition.id, 0, 0), definition);
    expect(rim!.widthIn).toBeGreaterThanOrEqual(published.w * 0.98);
    expect(rim!.depthIn).toBeGreaterThanOrEqual(published.d * 0.98);
  });

  it.each(ALCOVE_CODES)("%s has no separate apron panel that can float off the body", (code) => {
    const { group } = placedTub(code);
    const parts = visibleMeshes(group).map((node) => String(node.userData.pelicanBathroomFixturePart ?? ""));
    // The old builder pushed an "alcove-tub-apron" mesh in front of the shell.
    // It was 90% as wide and 72% as tall as the tub, so it read as a detached
    // panel. There must be no apron part at all now.
    expect(parts.some((part) => part.includes("apron"))).toBe(false);
  });

  it.each(ALCOVE_CODES)("%s sits flat on the floor with level ends", (code) => {
    const { group } = placedTub(code);
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);
    expect(side.slipperRise, `${code} ends are not level`).toBe(0);

    const base = visibleMeshes(group).find((node) => node.userData.pelicanBathroomFixturePart === "freestanding-tub-base")!;
    const box = new THREE.Box3().setFromObject(base);
    // Flat on the floor, not hovering and not sunk.
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(box.min.y).toBeLessThan(0.05);
  });

  it.each(ALCOVE_CODES)("%s has square plan corners, not rounded ones", (code) => {
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
    const side = tubSideProfile(profile);
    expect(side.cornerRadiusShare, `${code} plan corners are rounded`).toBe(0);
    const { group, definition } = placedTub(code);
    const rim = shellExtentAtHeight(group, 0.94, 1.001)!;
    // A square-cornered rectangle at the deck reaches the full published
    // footprint in both directions. A rounded plan would measure short of the
    // published corner and this would fail.
    const published = furnitureFootprint(makeFurniture(definition.id, 0, 0), definition);
    expect(rim.widthIn).toBeCloseTo(published.w, 0);
    expect(rim.depthIn).toBeCloseTo(published.d, 0);
  });
});

/**
 * Alcove tubs to Pelican's published sheet.
 *
 * The owner supplied ElevenLabs reference renders and multi-view sheets for the
 * form, and said to use those for shape only — every measurement must come from
 * Pelican. The sheets also draw all three sizes as one 32"-wide tub, so the
 * published widths (30", 32-1/64", 35-63/64") are what these tests hold to. A
 * separate shape per size falls out of that: the widths and the bathing well
 * differ on each model.
 */
const ALCOVE_PUBLISHED = [
  { code: "PL-02849L", widthIn: 30, rimShortIn: 23 + 5 / 8, sumpShortIn: 16 + 59 / 64 },
  { code: "PL-02849R", widthIn: 30, rimShortIn: 23 + 5 / 8, sumpShortIn: 16 + 59 / 64 },
  { code: "PL-02850L", widthIn: 32 + 1 / 64, rimShortIn: 25 + 19 / 32, sumpShortIn: 19 + 11 / 16 },
  { code: "PL-02850R", widthIn: 32 + 1 / 64, rimShortIn: 25 + 19 / 32, sumpShortIn: 19 + 11 / 16 },
  { code: "PL-02851L", widthIn: 35 + 63 / 64, rimShortIn: 29 + 17 / 32, sumpShortIn: 23 + 5 / 8 },
  { code: "PL-02851R", widthIn: 35 + 63 / 64, rimShortIn: 29 + 17 / 32, sumpShortIn: 23 + 5 / 8 },
];

/** The world-space box of one named part, in inches. */
function partBoxIn(group: THREE.Group, part: string): THREE.Box3 | null {
  const mesh = visibleMeshes(group).find((node) => node.userData.pelicanBathroomFixturePart === part);
  if (!mesh) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  box.min.multiplyScalar(12);
  box.max.multiplyScalar(12);
  return box;
}

describe("Alcove tubs match Pelican's published sheet, not the reference sheets", () => {
  it("reads the family off the SKU for both drain hands", () => {
    for (const code of ["PL-02849L", "PL-02849R", "PL-02850L", "PL-02850R", "PL-02851L", "PL-02851R"]) {
      expect(alcoveTubSpecFor(code), `no published spec for ${code}`).toBeTruthy();
    }
    expect(alcoveTubSpecFor("PL-02849L")!.widthIn).toBe(30);
    expect(alcoveTubSpecFor("PL-02850R")!.widthIn).toBeCloseTo(32 + 1 / 64, 6);
    expect(alcoveTubSpecFor("PL-02851L")!.widthIn).toBeCloseTo(35 + 63 / 64, 6);
    // The reference sheets' 32" is not a spec, so it must not be a family.
    expect(alcoveTubSpecFor("PL-02852L")).toBeNull();
  });

  it("gives each size its own published envelope, so they are not one shape", () => {
    const widths = new Set(Object.values(ALCOVE_TUB_SPECS).map((spec) => spec.widthIn.toFixed(3)));
    expect(widths.size, "all three sizes share one width").toBe(3);
    for (const spec of Object.values(ALCOVE_TUB_SPECS)) {
      // Every model is 60" along the wall and 21-21/32" tall.
      expect(spec.lengthIn).toBe(60);
      expect(spec.heightIn).toBeCloseTo(21 + 21 / 32, 6);
    }
  });

  it.each(ALCOVE_PUBLISHED)("$code is built to its published width and well", ({ code, widthIn, rimShortIn, sumpShortIn }) => {
    const { group } = placedTub(code);
    const exterior = partBoxIn(group, "freestanding-tub-exterior")!;
    expect(exterior, "no exterior").toBeTruthy();
    // The tub is modelled with its front-to-back width on X and the 60" run
    // along the wall on Z, so measure each axis for what it is.
    expect(exterior.max.x - exterior.min.x, `${code} width`).toBeCloseTo(widthIn, 2);
    expect(exterior.max.z - exterior.min.z, `${code} length`).toBeCloseTo(60, 1);
    // 21-21/32" overall, measured to the top of the tile flange.
    const full = new THREE.Box3().setFromObject(group);
    expect(full.max.y * 12).toBeCloseTo(21 + 21 / 32, 1);

    // The basin is the published rectangle, not an arbitrary inset.
    const well = partBoxIn(group, "alcove-tub-well")!;
    expect(well.max.x - well.min.x, `${code} sump width`).toBeCloseTo(sumpShortIn, 1);
    expect(well.max.z - well.min.z, `${code} sump length`).toBeCloseTo(alcoveTubSpecFor(code)!.basinSumpLongIn, 1);
    // The deck ring's own box is the outer footprint; the basin opening is the
    // interior shell's top edge, so measure that for the published rim size.
    const interior = partBoxIn(group, "freestanding-tub-interior")!;
    expect(interior.max.x - interior.min.x, `${code} rim opening width`).toBeCloseTo(rimShortIn, 0);
    expect(interior.max.z - interior.min.z, `${code} rim opening length`)
      .toBeCloseTo(alcoveTubSpecFor(code)!.basinRimLongIn, 0);
  });

  it.each(ALCOVE_PUBLISHED)("$code slopes its backrest more than its drain end", ({ code }) => {
    const spec = alcoveTubSpecFor(code)!;
    const layout = alcoveBasinLayout(spec);
    // The published long sides differ by ~10"; the backrest takes the larger
    // share of that run, which is what makes the tub recline.
    expect(layout.drainRun + layout.backRun).toBeCloseTo(spec.basinRimLongIn - spec.basinSumpLongIn, 6);
    expect(layout.backRun).toBeGreaterThan(layout.drainRun);
    // The basin stays inside the deck on both axes.
    expect(layout.sumpFrom).toBeGreaterThan(-layout.rimHalfLong);
    expect(layout.sumpTo).toBeLessThan(layout.rimHalfLong);
    expect(layout.sumpHalfShort).toBeLessThan(layout.rimHalfShort);
  });

  it.each(ALCOVE_PUBLISHED)("$code puts the drain and overflow on its own drain end", ({ code }) => {
    const { group } = placedTub(code);
    const isRight = code.endsWith("R");
    const drain = partBoxIn(group, "alcove-tub-drain")!;
    const overflow = partBoxIn(group, "alcove-tub-overflow")!;
    // Measure from the tub's own centre, since the fixture is placed somewhere
    // in the room and the group carries that offset.
    const full = partBoxIn(group, "freestanding-tub-exterior")!;
    const centreZ = (full.min.z + full.max.z) / 2;
    const drainZ = (drain.min.z + drain.max.z) / 2 - centreZ;
    const overflowZ = (overflow.min.z + overflow.max.z) / 2 - centreZ;

    // Published drain offset is 8-7/8" from the drain-end face, i.e. 21.125"
    // from the tub's centre on a 60" tub.
    const expectedZ = (isRight ? 1 : -1) * (30 - (8 + 7 / 8));
    expect(drainZ).toBeCloseTo(expectedZ, 1);
    // The overflow shares that end, and sits under the deck.
    expect(Math.sign(overflowZ)).toBe(Math.sign(expectedZ));
    // The overflow sits on the end wall, i.e. nearer that end than the drain is.
    expect(Math.abs(overflowZ)).toBeGreaterThan(Math.abs(drainZ));
    expect(overflow.max.y).toBeLessThan((21 + 21 / 32));
    // Drain is centred across the width.
    const centreX = (full.min.x + full.max.x) / 2;
    expect((drain.min.x + drain.max.x) / 2).toBeCloseTo(centreX, 1);
  });

  it("mirrors the left and right models rather than rebuilding them differently", () => {
    const left = placedTub("PL-02851L").group;
    const right = placedTub("PL-02851R").group;
    const relativeDrainZ = (group: THREE.Group) => {
      const shell = partBoxIn(group, "freestanding-tub-exterior")!;
      const drain = partBoxIn(group, "alcove-tub-drain")!;
      return (drain.min.z + drain.max.z) / 2 - (shell.min.z + shell.max.z) / 2;
    };
    const leftZ = relativeDrainZ(left);
    const rightZ = relativeDrainZ(right);
    expect(leftZ).toBeCloseTo(-rightZ, 2);
    expect(Math.abs(leftZ)).toBeCloseTo(30 - (8 + 7 / 8), 1);
    // Same tub otherwise: identical rim and well widths.
    const rimWidth = (box: THREE.Box3) => box.max.x - box.min.x;
    expect(rimWidth(partBoxIn(left, "freestanding-tub-rim")!))
      .toBeCloseTo(rimWidth(partBoxIn(right, "freestanding-tub-rim")!), 3);
  });

  it.each(ALCOVE_PUBLISHED)("$code keeps a raised tile flange on three sides only", ({ code }) => {
    const { group } = placedTub(code);
    const flange = partBoxIn(group, "alcove-tub-flange");
    expect(flange, `${code} has no tile flange`).toBeTruthy();
    const full = new THREE.Box3().setFromObject(group);
    // It is the tallest part on the tub: the published height is measured to it.
    expect(flange!.max.y).toBeCloseTo(full.max.y * 12, 3);
    const spec = alcoveTubSpecFor(code)!;
    expect(flange!.max.y - flange!.min.y).toBeCloseTo(spec.tileFlangeIn, 2);
  });
});
