import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES } from "./pelicanBathroomFixtureProfiles";
import { makePelicanToiletGroup, pelicanToiletForm, type PelicanToiletMeshProfile } from "./pelicanToiletMesh";

const INCH = 1 / 12;
const EPSILON = 0.000001;

function profile(overrides: Partial<PelicanToiletMeshProfile> = {}): PelicanToiletMeshProfile {
  return {
    pelicanCode: "PL-12044",
    widthIn: 14 + 9 / 16,
    depthIn: 26 + 37 / 64,
    heightIn: 29 + 17 / 32,
    seatHeightIn: 15.75,
    finish: "vitreous-china-white",
    toiletStyle: "one-piece",
    toiletFlushControl: "dual-button",
    ...overrides,
  };
}

function meshesIn(group: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  return meshes;
}

function partsIn(group: THREE.Object3D): string[] {
  return meshesIn(group).map((mesh) => String(mesh.userData.pelicanBathroomFixturePart));
}

function assertFitsSourceEnvelope(group: THREE.Group, source: PelicanToiletMeshProfile): void {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  expect(bounds.min.x).toBeGreaterThanOrEqual(-source.widthIn * INCH / 2 - EPSILON);
  expect(bounds.max.x).toBeLessThanOrEqual(source.widthIn * INCH / 2 + EPSILON);
  expect(bounds.min.z).toBeGreaterThanOrEqual(-source.depthIn * INCH / 2 - EPSILON);
  expect(bounds.max.z).toBeLessThanOrEqual(source.depthIn * INCH / 2 + EPSILON);
  expect(bounds.min.y).toBeGreaterThanOrEqual(-EPSILON);
  expect(bounds.max.y).toBeLessThanOrEqual(source.heightIn * INCH + EPSILON);
}

describe("makePelicanToiletGroup", () => {
  it("faces its rounded porcelain skirt outward rather than disappearing with FrontSide", () => {
    const fixture = makePelicanToiletGroup(profile());
    const base = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")!;
    const positions = base.geometry.getAttribute("position");
    const normals = base.geometry.getAttribute("normal");
    let outward = 0;
    for (let index = 0; index < positions.count; index++) {
      if (positions.getY(index) > 0.05 && positions.getY(index) < 1 && positions.getZ(index) > 0.7) {
        const radialDot = positions.getX(index) * normals.getX(index) + positions.getZ(index) * normals.getZ(index);
        expect(radialDot).toBeGreaterThan(0);
        outward++;
      }
    }
    expect(outward).toBeGreaterThan(0);
  });
  it("renders PL-12044 as a continuous white one-piece skirt with the source exterior envelope", () => {
    const source = profile();
    const fixture = makePelicanToiletGroup(source);
    assertFitsSourceEnvelope(fixture, source);
    expect(fixture.userData).toMatchObject({
      pelicanCode: "PL-12044",
      toiletStyle: "one-piece",
      sourceEnvelopeIn: { width: source.widthIn, depth: source.depthIn, height: source.heightIn },
      illustrativeContours: true,
      visualOnly: true,
    });
    expect(partsIn(fixture)).toEqual(expect.arrayContaining([
      "toilet-ceramic-base",
      "toilet-bowl-exterior",
      "toilet-bowl-water",
      "toilet-seat",
      "toilet-lid",
      "toilet-integrated-rear-housing",
      "toilet-dual-flush-left-button",
      "toilet-dual-flush-right-button",
    ]));
    const base = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")!;
    const bowl = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-bowl-exterior")!;
    const rear = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-integrated-rear-housing")!;
    expect(base.userData).toMatchObject({ silhouette: "continuous-skirted-body", pelicanFinish: "white" });
    expect(bowl.userData).toMatchObject({ continuousWithCeramicBase: true });
    expect(rear.userData).toMatchObject({ silhouette: "rounded-rectangular-tank", tankFootprint: "rounded-rectangle" });
    const seat = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-seat")!;
    const lid = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-lid")!;
    expect(seat.position.y).toBeCloseTo(source.seatHeightIn! * INCH, 6);
    expect(new THREE.Box3().setFromObject(lid).getSize(new THREE.Vector3()).z).toBeLessThan(source.depthIn * INCH);
    expect(lid.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(lid.userData.lidProfile).toBe("soft-elongated-oval");
    expect(seat.userData.seatProfile).toBe("closed-elongated-oval");
    expect(new THREE.Box3().setFromObject(bowl).min.y).toBeLessThan(new THREE.Box3().setFromObject(base).max.y);
  });

  it("keeps PL-12011 matte-black finish identity with the same integrated one-piece silhouette", () => {
    const source = profile({
      pelicanCode: "PL-12011 MB",
      widthIn: 14 + 61 / 64,
      depthIn: 26 + 31 / 32,
      heightIn: 30 + 45 / 64,
      finish: "vitreous-china-matte-black",
    });
    const fixture = makePelicanToiletGroup(source);
    assertFitsSourceEnvelope(fixture, source);
    expect(partsIn(fixture)).toContain("toilet-integrated-rear-housing");
    for (const mesh of meshesIn(fixture)) {
      expect(mesh.userData).toMatchObject({ pelicanCode: "PL-12011 MB", pelicanFinish: "matte-black" });
    }
    const shell = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")!.material as THREE.MeshPhysicalMaterial;
    expect(shell.color.getHexString()).toBe(new THREE.Color("#17191b").getHexString());
  });

  it("distinguishes the PL-12005 smart toilet with its low squared body, flat lid, and control panel", () => {
    const source = profile({
      pelicanCode: "PL-12005",
      widthIn: 15 + 15 / 32,
      depthIn: 26 + 31 / 32,
      heightIn: 17 + 63 / 64,
      seatHeightIn: 15 + 5 / 8,
      toiletStyle: "smart",
      toiletFlushControl: "touchless-auto",
    });
    const fixture = makePelicanToiletGroup(source);
    assertFitsSourceEnvelope(fixture, source);
    expect(partsIn(fixture)).toEqual(expect.arrayContaining([
      "toilet-ceramic-base",
      "toilet-bowl-exterior",
      "toilet-bowl-water",
      "toilet-seat",
      "toilet-lid",
      "toilet-smart-rear-housing",
      "toilet-touchless-auto-top",
      "toilet-smart-control-panel",
    ]));
    expect(partsIn(fixture).some((part) => part.includes("flush-button"))).toBe(false);
    const base = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")!;
    const lid = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-lid")!;
    const rear = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-smart-rear-housing")!;
    expect(base.userData).toMatchObject({ silhouette: "low-squared-smart-body" });
    expect(lid.userData).toMatchObject({ lidProfile: "flat-rounded-rectangle" });
    expect(rear.userData).toMatchObject({ silhouette: "flat-squared-smart-rear" });
  });

  it("keeps a two-piece model as a separate, softly rounded tank inside the same measured envelope", () => {
    const source = profile({
      pelicanCode: "PL-A249 ADA",
      widthIn: 17,
      depthIn: 28,
      heightIn: 31,
      toiletStyle: "two-piece",
      toiletFlushControl: "single-button",
    });
    const fixture = makePelicanToiletGroup(source);
    assertFitsSourceEnvelope(fixture, source);
    expect(partsIn(fixture)).toEqual(expect.arrayContaining([
      "toilet-tank",
      "toilet-tank-lid",
      "toilet-single-flush-button",
    ]));
    expect(partsIn(fixture)).toEqual(expect.arrayContaining(["toilet-exposed-trapway"]));
    expect(partsIn(fixture)).not.toContain("toilet-integrated-rear-housing");
    const tank = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-tank")!;
    expect(tank.userData).toMatchObject({ silhouette: "rounded-rectangular-tank", tankFootprint: "rounded-rectangle" });
    expect(fixture.userData.toiletForm).toBe("two-piece");
  });

  it("renders PL-12318 as glossy white skirted china with an elongated seat and a rectangular tank", () => {
    const source = profile({
      pelicanCode: "PL-12318",
      widthIn: 14 + 5 / 8,
      depthIn: 25 + 5 / 8,
      heightIn: 26 + 5 / 8,
      seatHeightIn: 16.5,
      toiletFlushControl: "dual-button",
    });
    const fixture = makePelicanToiletGroup(source);
    assertFitsSourceEnvelope(fixture, source);
    expect(fixture.userData.toiletForm).toBe("skirted-one-piece");
    expect(partsIn(fixture)).toEqual(expect.arrayContaining([
      "toilet-ceramic-base",
      "toilet-bowl-exterior",
      "toilet-seat",
      "toilet-lid",
      "toilet-integrated-rear-housing",
      "toilet-tank-lid",
      "toilet-trapway-cap",
      "toilet-dual-flush-left-button",
      "toilet-dual-flush-right-button",
    ]));
    const shell = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")!.material as THREE.MeshPhysicalMaterial;
    expect(shell.color.getHexString()).toBe("ffffff");
    expect(shell.roughness).toBeLessThanOrEqual(0.08);
    expect(shell.clearcoat).toBeGreaterThanOrEqual(0.9);
    const seat = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-seat")!;
    const lid = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-lid")!;
    const tank = meshesIn(fixture).find((mesh) => mesh.userData.pelicanBathroomFixturePart === "toilet-integrated-rear-housing")!;
    expect(seat.userData.seatProfile).toBe("closed-elongated-oval");
    expect(lid.userData.lidProfile).toBe("soft-elongated-oval");
    expect(seat.position.y).toBeCloseTo(16.5 * INCH, 5);
    const seatSize = new THREE.Box3().setFromObject(seat).getSize(new THREE.Vector3());
    expect(seatSize.z).toBeGreaterThan(seatSize.x);
    expect(tank.userData).toMatchObject({ silhouette: "rounded-rectangular-tank", tankFootprint: "rounded-rectangle" });
    const tankSize = new THREE.Box3().setFromObject(tank).getSize(new THREE.Vector3());
    expect(tankSize.x).toBeGreaterThan(tankSize.z * 1.4);
    expect(new THREE.Box3().setFromObject(fixture).max.y).toBeLessThanOrEqual(source.heightIn * INCH + EPSILON);
  });

  it("keeps every published toilet inside its sheet envelope and on its own silhouette", () => {
    const expected: Record<string, string> = {
      "PL-12005": "smart-wedge",
      "PL-12050": "pedestal-one-piece",
      "PL-12335": "pedestal-one-piece",
      "PL-12305": "smart-egg",
      "PL-12230": "smart-egg",
      "PL-A249 ADA": "two-piece",
      "PL-12044": "skirted-one-piece",
      "PL-12318": "skirted-one-piece",
    };
    const toilets = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.filter((entry) => entry.kind === "toilet");
    expect(toilets.length).toBeGreaterThanOrEqual(14);
    for (const source of toilets) {
      const fixture = makePelicanToiletGroup(source);
      assertFitsSourceEnvelope(fixture, source);
      const form = pelicanToiletForm(source);
      if (expected[source.pelicanCode]) expect(form).toBe(expected[source.pelicanCode]);
      expect(fixture.userData.toiletForm).toBe(form);
      expect(partsIn(fixture)).toEqual(expect.arrayContaining(["toilet-bowl-exterior", "toilet-seat", "toilet-lid"]));
    }
  });
});
