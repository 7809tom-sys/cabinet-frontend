// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addFurniture } from "./InteractiveRoom3D";
import { FURNITURE_CATALOG, makeFurniture } from "@/lib/design";
import { VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Every toilet and bidet the Designer can place must render as a real, closed
 * fixture: glossy white china, a shaped tank with a lid, a bowl with a seat and
 * lid, a skirt or exposed trapway per its form, a flush control, and no open or
 * see-through surfaces. It must fill its published envelope so the selection
 * box hugs it, and sit flat on the floor.
 *
 * Checks run through `addFurniture`, the designer's own path, with the real
 * materials. A debug double-sided material would hide exactly the winding bugs
 * this is for.
 */

const FIXTURES = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES
  .filter((profile) => profile.kind === "toilet" || profile.kind === "bidet");

const INCH = 1 / 12;

function placedFixture(code: string): { group: THREE.Group; profile: (typeof FIXTURES)[number] } {
  const profile = FIXTURES.find((entry) => entry.pelicanCode === code)!;
  const definition = FURNITURE_CATALOG.find((entry) => (
    entry.pelicanCode === profile.pelicanCode && entry.category === "bathroom-fixture"
  ));
  if (!definition) throw new Error(`No furniture definition for ${code}`);
  const root = new THREE.Group();
  addFurniture(root, makeFurniture(definition.id, 40, 40));
  root.updateMatrixWorld(true);
  return { group: root.children[0] as THREE.Group, profile };
}

function meshes(group: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh && node.visible) found.push(node);
  });
  return found;
}

/**
 * Signed volume of a mesh, by the divergence theorem over its triangles.
 *
 * A closed shell wound outward has positive volume. A shell wound inside out
 * has negative volume, and that is exactly what makes it invisible from the
 * outside — the surface faces away from the camera and is culled. Counting
 * volume is a far stronger closure check than casting rays, because a ray from
 * inside a solid strikes a back face and reports "no hit" even when the part is
 * perfectly closed.
 */
function signedVolume(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!position) return 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let volume = 0;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const ia = index ? index.getX(triangle * 3) : triangle * 3;
    const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  // Scale by the mesh's world transform (a mirror flip would invert it).
  mesh.updateMatrixWorld(true);
  const scale = new THREE.Vector3();
  mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return volume * scale.x * scale.y * scale.z;
}

/** True when the mesh is a closed shell whose faces point outward. */
function isClosedOutward(mesh: THREE.Mesh): boolean {
  return signedVolume(mesh) > 1e-7;
}

function partNames(group: THREE.Object3D): string[] {
  return meshes(group).map((mesh) => String(mesh.userData.pelicanBathroomFixturePart ?? ""));
}

export type ToiletAudit = {
  code: string;
  failures: string[];
};

/** Audit one fixture. Returns an empty list when it passes. */
export function auditToilet(code: string): ToiletAudit {
  const { group, profile } = placedFixture(code);
  const failures: string[] = [];
  const parts = partNames(group);

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const widthIn = size.x * 12;
  const depthIn = size.z * 12;
  const heightIn = size.y * 12;

  // 1. Fills the published envelope: within half an inch over, and at least 90%.
  const near = (actual: number, expected: number) => actual >= expected * 0.9 && actual <= expected + 0.6;
  if (!near(widthIn, profile.widthIn)) failures.push(`width ${widthIn.toFixed(2)} vs ${profile.widthIn.toFixed(2)}`);
  if (!near(depthIn, profile.depthIn)) failures.push(`depth ${depthIn.toFixed(2)} vs ${profile.depthIn.toFixed(2)}`);
  if (!near(heightIn, profile.heightIn)) failures.push(`height ${heightIn.toFixed(2)} vs ${profile.heightIn.toFixed(2)}`);

  // 2. Sits flat on the floor.
  if (box.min.y < -0.02) failures.push(`sinks below the floor at ${(box.min.y * 12).toFixed(2)} in`);
  if (box.min.y > 0.02) failures.push(`floats ${(box.min.y * 12).toFixed(2)} in above the floor`);

  // 3. Closed and outward-facing: every solid part must enclose positive volume.
  //    A part wound inside out has negative volume and disappears when the
  //    camera is outside it, which is the "see-through" the owner reported.
  //    The water plane is a flat disc by design, so it is exempt.
  const solidParts = meshes(group).filter((mesh) => (
    !/bowl-water/.test(String(mesh.userData.pelicanBathroomFixturePart))
    // A flat sensor or panel disc has no volume by design.
    && !/control-panel/.test(String(mesh.userData.pelicanBathroomFixturePart))
  ));
  const openParts = solidParts.filter((mesh) => !isClosedOutward(mesh)).map((mesh) => String(mesh.userData.pelicanBathroomFixturePart));
  if (openParts.length > 0) failures.push(`inside-out or open: ${openParts.join(", ")}`);

  // 4. From outside, the outer skin must be visible in all four directions.
  const center = box.getCenter(new THREE.Vector3());
  const probeY = box.min.y + size.y * 0.30;
  const cast = new THREE.Raycaster();
  for (const [label, from, toward] of [
    ["+x", new THREE.Vector3(box.max.x + 1, probeY, center.z), new THREE.Vector3(-1, 0, 0)],
    ["-x", new THREE.Vector3(box.min.x - 1, probeY, center.z), new THREE.Vector3(1, 0, 0)],
    ["+z", new THREE.Vector3(center.x, probeY, box.max.z + 1), new THREE.Vector3(0, 0, -1)],
    ["-z", new THREE.Vector3(center.x, probeY, box.min.z - 1), new THREE.Vector3(0, 0, 1)],
  ] as const) {
    cast.set(from.clone(), toward.clone());
    if (cast.intersectObjects(meshes(group), false).length === 0) failures.push(`nothing visible from ${label}`);
  }

  // 5. Glossy white china (or matte black where that finish is published).
  const black = profile.finish === "vitreous-china-matte-black";
  const shell = meshes(group).find((mesh) => /base|tank/.test(String(mesh.userData.pelicanBathroomFixturePart)))?.material as THREE.MeshPhysicalMaterial | undefined;
  if (!shell) failures.push("no ceramic body");
  else {
    const expected = black ? "#17191b" : "#ffffff";
    if (`#${shell.color.getHexString()}` !== expected) failures.push(`china colour ${`#${shell.color.getHexString()}`} not ${expected}`);
    if (!black && (shell.roughness ?? 1) > 0.1) failures.push(`china too rough (${shell.roughness})`);
    if (!black && (shell.clearcoat ?? 0) < 0.8) failures.push(`china lacks clearcoat (${shell.clearcoat})`);
  }

  // 6. A shaped tank with its own lid, unless the model is tankless or a bidet.
  const isBidet = profile.kind === "bidet";
  const tankless = isBidet || profile.toiletStyle === "smart" || /PL-12005|PL-12230|PL-12305/.test(profile.pelicanCode);
  if (!tankless) {
    if (!parts.some((part) => /tank|rear-housing/.test(part))) failures.push("no tank or rear housing");
    if (!parts.some((part) => /tank-lid/.test(part))) failures.push("no tank lid");
  }

  // 7. Bowl, seat and lid, and a flush control — a toilet's parts. A bidet has a
  //    basin, rim, tap and drain instead.
  if (isBidet) {
    if (!parts.some((part) => /bidet-basin/.test(part))) failures.push("no basin");
    if (!parts.some((part) => /bidet-rim/.test(part))) failures.push("no rim");
    if (!parts.some((part) => /bidet-tap/.test(part))) failures.push("no tap");
    if (!parts.some((part) => /bidet-drain/.test(part))) failures.push("no drain");
  } else {
    if (!parts.some((part) => /bowl-exterior/.test(part))) failures.push("no bowl");
    if (!parts.some((part) => /toilet-seat/.test(part))) failures.push("no seat");
    if (!parts.some((part) => /toilet-lid/.test(part))) failures.push("no lid");
    if (!parts.some((part) => /flush|touchless|lever/.test(part))) failures.push("no flush control");
  }

  // 8. A curved skirt or an exposed trapway, per the form.
  if (profile.kind === "toilet") {
    const base = meshes(group).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base");
    if (!base) failures.push("no ceramic base");
    if (!parts.some((part) => /trapway|trapway-cap/.test(part)) && profile.toiletStyle === "two-piece") {
      failures.push("two-piece without an exposed trapway");
    }
  }

  // 9. Seat height: the seat sits at the published seat height.
  const seat = meshes(group).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-seat");
  if (profile.seatHeightIn != null) {
    if (!seat) failures.push("no seat to measure");
    else {
      const seatBox = new THREE.Box3().setFromObject(seat);
      const seatTop = seatBox.max.y * 12;
      if (Math.abs(seatTop - profile.seatHeightIn) > 1.6) {
        failures.push(`seat top ${seatTop.toFixed(2)} in vs published ${profile.seatHeightIn.toFixed(2)} in`);
      }
    }
  }

  // 10. No floating parts: every piece must touch at least one other piece,
  //     within a hair, or it reads as a lid hovering over the tank.
  const boxes = meshes(group).map((mesh) => ({
    part: String(mesh.userData.pelicanBathroomFixturePart ?? ""),
    box: new THREE.Box3().setFromObject(mesh),
  }));
  // Two parts joined on a shared surface overlap or touch. A real gap of a
  // sixteenth of an inch is already a visible crack at room scale.
  const gapTolerance = 0.012; // inches
  const floating = boxes
    .filter(({ part, box: partBox }) => !/bowl-water|control-panel/.test(part))
    .filter(({ box: partBox }) => !boxes.some(({ box: other }) => (
      other !== partBox
      && partBox.min.x <= other.max.x + gapTolerance
      && partBox.max.x >= other.min.x - gapTolerance
      && partBox.min.y <= other.max.y + gapTolerance
      && partBox.max.y >= other.min.y - gapTolerance
      && partBox.min.z <= other.max.z + gapTolerance
      && partBox.max.z >= other.min.z - gapTolerance
    )))
    .map(({ part }) => part);
  if (floating.length > 0) failures.push(`floating: ${floating.join(", ")}`);

  return { code, failures };
}

describe("Every placeable toilet renders as a real, closed fixture", () => {
  it("covers every toilet and bidet the designer offers", () => {
    expect(FIXTURES.length).toBe(18);
    expect(FIXTURES.map((profile) => profile.pelicanCode)).toEqual(expect.arrayContaining([
      "PL-12318", "PL-12050", "PL-A249 ADA", "PL-12011", "PL-12005", "PL-12230",
    ]));
    void INCH;
  });

  it.each(FIXTURES.map((profile) => profile.pelicanCode))("%s fills its envelope and is closed", (code) => {
    const result = auditToilet(code);
    expect(result.failures, `${code}: ${result.failures.join("; ")}`).toEqual([]);
  });
});
