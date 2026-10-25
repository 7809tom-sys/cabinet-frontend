import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { makePelicanTubFillerGroup, type PelicanTubFillerProfile } from "./pelicanTubFillerMesh";

const INCH = 1 / 12;
const EPSILON = 0.001;

const profile = (overrides: Partial<PelicanTubFillerProfile>): PelicanTubFillerProfile => ({
  pelicanCode: "PL-8515",
  widthIn: 14,
  depthIn: 14,
  heightIn: 43.875,
  finish: "matte-black",
  tubFillerStyle: "gooseneck-single-column",
  ...overrides,
});

function meshesIn(group: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  return meshes;
}

function assertEveryMeshFits(group: THREE.Group, heightIn: number): void {
  group.updateMatrixWorld(true);
  for (const mesh of meshesIn(group)) {
    const bounds = new THREE.Box3().setFromObject(mesh);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-7 * INCH - EPSILON);
    expect(bounds.max.x).toBeLessThanOrEqual(7 * INCH + EPSILON);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-7 * INCH - EPSILON);
    expect(bounds.max.z).toBeLessThanOrEqual(7 * INCH + EPSILON);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-EPSILON);
    expect(bounds.max.y).toBeLessThanOrEqual(heightIn * INCH + EPSILON);
  }
}

describe("makePelicanTubFillerGroup", () => {
  it("keeps every PL-8515 mesh in the 14 × 14 visual occupancy and published overall height", () => {
    const fixture = makePelicanTubFillerGroup(profile({
      tubFillerSpoutHeightIn: 40.25,
      tubFillerSpoutReachIn: 7,
    }));

    assertEveryMeshFits(fixture, 43.875);
    expect(fixture.userData).toMatchObject({
      pelicanCode: "PL-8515",
      tubFillerStyle: "gooseneck-single-column",
      visualOccupancyIn: { width: 14, depth: 14, height: 43.875 },
      visualOnly: true,
    });
    expect(meshesIn(fixture).map((mesh) => mesh.userData.pelicanBathroomFixturePart)).toEqual(expect.arrayContaining([
      "tub-filler-base",
      "tub-filler-single-column",
      "tub-filler-gooseneck-spout",
      "tub-filler-side-lever",
      "tub-filler-handshower",
      "tub-filler-handshower-holder",
      "tub-filler-hanging-hose",
      "tub-filler-open-spout-outlet",
    ]));
  });

  it("renders PL-8522 as the distinguishable twin-column telephone variant within its published height", () => {
    const telephone = makePelicanTubFillerGroup(profile({
      pelicanCode: "PL-8522",
      heightIn: 44.5,
      finish: "brushed-nickel",
      tubFillerStyle: "telephone-double-column",
      tubFillerSpoutHeightIn: 32.875,
      tubFillerSpoutReachIn: 6.5,
    }));
    const gooseneck = makePelicanTubFillerGroup(profile({ finish: "brushed-nickel" }));

    assertEveryMeshFits(telephone, 44.5);
    const telephoneParts = meshesIn(telephone).map((mesh) => mesh.userData.pelicanBathroomFixturePart);
    expect(telephoneParts).toEqual(expect.arrayContaining([
      "tub-filler-double-column-base",
      "tub-filler-double-column",
      "tub-filler-connected-valve-bridge",
      "tub-filler-cross-handle-hub",
      "tub-filler-telephone-handset",
      "tub-filler-bent-spout",
      "tub-filler-hanging-hose",
    ]));
    expect(telephoneParts).not.toContain("tub-filler-gooseneck-spout");
    expect(meshesIn(telephone).filter((mesh) => mesh.userData.pelicanBathroomFixturePart === "tub-filler-double-column")).toHaveLength(2);
    expect(meshesIn(telephone)).not.toHaveLength(meshesIn(gooseneck).length);
  });

  it("retains the source spout outlet and handshower heights with the arch highest", () => {
    const fixture = makePelicanTubFillerGroup(profile({ tubFillerSpoutHeightIn: 40.25 }));
    fixture.updateMatrixWorld(true);
    const part = (name: string) => meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === name)!;
    expect(part("tub-filler-open-spout-outlet").position.y / INCH).toBeCloseTo(40.25);
    expect(new THREE.Box3().setFromObject(part("tub-filler-handshower-face")).max.y / INCH).toBeCloseTo(42.25, 3);
    expect(new THREE.Box3().setFromObject(part("tub-filler-gooseneck-spout")).max.y / INCH).toBeGreaterThan(43);
  });

  it("renders the PL-8538 square post / flat spout with the official height and reach", () => {
    const fixture = makePelicanTubFillerGroup(profile({ pelicanCode: "PL-8538 MB", heightIn: 41.875, tubFillerStyle: "square-single-column", tubFillerSpoutHeightIn: 35, tubFillerSpoutReachIn: 8.875 }));
    assertEveryMeshFits(fixture, 41.875);
    expect(meshesIn(fixture).map((mesh) => mesh.userData.pelicanBathroomFixturePart)).toEqual(expect.arrayContaining(["tub-filler-square-base", "tub-filler-square-column", "tub-filler-flat-spout", "tub-filler-square-handshower"]));
  });

  it.each([
    ["matte-black", "matte-black"],
    ["brushed-nickel", "brushed-nickel"],
    ["brushed-gold", "brushed-gold"],
    ["chrome", "chrome"],
  ] as const)("uses metal materials and %s finish identity on every mesh", (finish, finishKey) => {
    const fixture = makePelicanTubFillerGroup(profile({ finish }));

    for (const mesh of meshesIn(fixture)) {
      expect(mesh.userData).toMatchObject({
        pelicanCode: "PL-8515",
        pelicanBathroomFixturePart: expect.any(String),
        pelicanFinish: finishKey,
      });
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.metalness).toBeGreaterThanOrEqual(0.7);
      expect(material.userData).toMatchObject({ pelicanMetal: true });
    }
    expect(meshesIn(fixture).some((mesh) => (mesh.material as THREE.MeshStandardMaterial).userData.pelicanFinish === finishKey)).toBe(true);
  });
});
