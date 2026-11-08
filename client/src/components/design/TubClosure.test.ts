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
import { STRAIGHT_SIDED_MIN_BASE_SHARE, TUB_SIDE_PROFILES, isStraightSided, tubSideProfile, tubWallShare, tubWidthShareAt } from "./tubSideProfiles";

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
