// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isSlipperTub, makeFreestandingTubParts } from "./freestandingTubGeometry";
import { VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES } from "@/lib/pelicanBathroomFixtureProfiles";
import { tubSideProfile } from "./tubSideProfiles";

const materials = {
  shell: new THREE.MeshPhysicalMaterial({ color: "#ffffff" }),
  dark: new THREE.MeshStandardMaterial({ color: "#c7d1d4" }),
};

function partsFor(code: string, slipper?: boolean) {
  const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === code)!;
  return { profile, parts: makeFreestandingTubParts(profile, materials, { slipper: slipper ?? isSlipperTub(profile) }) };
}

function bounds(parts: ReturnType<typeof makeFreestandingTubParts>, part: string) {
  const mesh = parts.find((entry) => entry.part === part)!.mesh;
  mesh.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(mesh);
}

describe("Freestanding tub geometry", () => {
  it("raises the slipper backrest above the foot end on PL-02141", () => {
    const { profile, parts } = partsFor('PL-02141 59"');
    const body = bounds(parts, "freestanding-tub-exterior");
    // Height at the back (+Z) is the published overall height.
    const positions = parts.find((entry) => entry.part === "freestanding-tub-exterior")!.mesh.geometry.getAttribute("position");
    let backMax = -Infinity;
    let frontMax = -Infinity;
    for (let index = 0; index < positions.count; index += 1) {
      const z = positions.getZ(index);
      const y = positions.getY(index);
      if (z > 0) backMax = Math.max(backMax, y);
      else frontMax = Math.max(frontMax, y);
    }
    expect(backMax).toBeGreaterThan(frontMax * 1.08);
    expect(backMax * 12).toBeLessThanOrEqual(profile.heightIn + 0.5);
    expect(body.max.y * 12).toBeLessThanOrEqual(profile.heightIn + 0.5);
  });

  it("keeps an oval tub level all round", () => {
    const { parts } = partsFor('PL-02138 59"');
    const positions = parts.find((entry) => entry.part === "freestanding-tub-exterior")!.mesh.geometry.getAttribute("position");
    let backMax = -Infinity;
    let frontMax = -Infinity;
    for (let index = 0; index < positions.count; index += 1) {
      const z = positions.getZ(index);
      const y = positions.getY(index);
      if (z > 0) backMax = Math.max(backMax, y);
      else frontMax = Math.max(frontMax, y);
    }
    expect(backMax).toBeCloseTo(frontMax, 3);
  });

  it("stays inside the published exterior envelope", () => {
    for (const code of ['PL-02141 59"', 'PL-02141 67"', 'PL-02138 59"', 'PL-02563 67"']) {
      const { profile, parts } = partsFor(code);
      const body = bounds(parts, "freestanding-tub-exterior");
      const size = body.getSize(new THREE.Vector3());
      expect(size.x * 12, `${code} width`).toBeLessThanOrEqual(profile.widthIn + 0.6);
      expect(size.z * 12, `${code} depth`).toBeLessThanOrEqual(profile.depthIn + 0.6);
      expect(body.min.y, `${code} sits on the floor`).toBeGreaterThanOrEqual(-0.02);
    }
  });

  it("is a hollow shell with a thin rim, not a solid block or a fat ring", () => {
    const { parts } = partsFor('PL-02141 59"');
    const outer = bounds(parts, "freestanding-tub-exterior");
    const inner = bounds(parts, "freestanding-tub-interior");
    // The inner shell exists and sits below the rim.
    expect(inner.max.y).toBeLessThan(outer.max.y);
    // The rim band is a thin strip: its two edges are one rim thickness apart at
    // every point, not a fat torus sitting on top.
    const rim = parts.find((entry) => entry.part === "freestanding-tub-rim")!.mesh;
    const positions = rim.geometry.getAttribute("position");
    let maxGap = 0;
    let minGap = Infinity;
    for (let index = 0; index < positions.count; index += 2) {
      // The band stores the outer vertex then the inner vertex for each point.
      const outerY = positions.getY(index);
      const innerY = positions.getY(index + 1);
      // Ignore the clamped floor region; the rim is the upper part of the band.
      if (outerY < 1.5 || innerY < 1.5) continue;
      const gap = Math.abs(outerY - innerY);
      if (gap > 0) {
        maxGap = Math.max(maxGap, gap);
        minGap = Math.min(minGap, gap);
      }
    }
    expect(minGap).toBeGreaterThan(0);
    // The band's height is the rim thickness at the foot end, where the slipper
    // curve is flat. Thickness is per model now (see tubSideProfiles.ts), so
    // assert against this model's own configured value rather than a constant.
    const profile = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((entry) => entry.pelicanCode === 'PL-02141 59"')!;
    expect(minGap).toBeCloseTo((profile.heightIn / 12) * tubSideProfile(profile).rimThickness, 4);
    // The backrest rises along the rim, so the strip there is wider across; what
    // matters is that it is a band, not a fat torus.
    expect(maxGap).toBeLessThan(0.08);
    expect(maxGap).toBeGreaterThan(minGap);
  });

  it("gives every tub a drain and an overflow", () => {
    for (const code of ['PL-02141 59"', 'PL-02141 67"', 'PL-02138 59"']) {
      const { parts } = partsFor(code);
      expect(parts.some((entry) => entry.part === "freestanding-tub-drain"), code).toBe(true);
      expect(parts.some((entry) => entry.part === "freestanding-tub-overflow"), code).toBe(true);
    }
  });

  it("puts the drain at the documented end", () => {
    const left = partsFor('PL-02141 59"').parts.find((entry) => entry.part === "freestanding-tub-drain")!.mesh;
    expect(left.position.z).toBeLessThan(0);
    const centered = partsFor('PL-02138 59"').parts.find((entry) => entry.part === "freestanding-tub-drain")!.mesh;
    expect(centered.position.z).toBeCloseTo(0, 6);
  });

  it("closes the basin so the room floor cannot show through the tub", () => {
    for (const code of ['PL-02141 59"', 'PL-02146 59"', 'PL-02563 67"', 'PL-02138 59"']) {
      const { profile, parts } = partsFor(code);
      const height = profile.heightIn / 12;
      // A capped basin floor sits above the room floor, not on it.
      const well = parts.find((entry) => entry.part === "freestanding-tub-well")!;
      expect(well, code).toBeTruthy();
      const wellY = well.mesh.geometry.getAttribute("position");
      let minY = Infinity;
      for (let index = 0; index < wellY.count; index += 1) minY = Math.min(minY, wellY.getY(index));
      expect(minY, `${code} basin floor`).toBeGreaterThan(height * 0.1);
      // And the underside is capped, so the shell is not open at the floor.
      expect(parts.some((entry) => entry.part === "freestanding-tub-base"), `${code} base`).toBe(true);
    }
  });

  it("treats only PL-02141 as a slipper tub", () => {
    const slipper = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.filter((entry) => isSlipperTub(entry)).map((entry) => entry.pelicanCode);
    expect(slipper).toEqual(['PL-02141 59"', 'PL-02141 67"']);
  });
});
