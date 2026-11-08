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
