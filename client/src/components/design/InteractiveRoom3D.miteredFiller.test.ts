import { describe, expect, it } from "vitest";
import { angledTransitionFillerPrismGeometry, angledTransitionLocalFootprint, miteredFillerPrismGeometry } from "./InteractiveRoom3D";

describe("miteredFillerPrismGeometry", () => {
  it("creates a true diagonal cut on the requested start end for legacy one-edge fillers", () => {
    const geometry = miteredFillerPrismGeometry(3, 42, 0.75, "start");
    const positions = Array.from(geometry.getAttribute("position").array as Float32Array);

    expect(geometry.getIndex()?.count).toBe(36);
    expect(positions[0]).toBeCloseTo(-0.75);
    expect(positions[9]).toBeCloseTo(-1.5);
    geometry.dispose();
  });

  it("mirrors the diagonal cut at the requested end", () => {
    const geometry = miteredFillerPrismGeometry(3, 42, 0.75, "end");
    const positions = Array.from(geometry.getAttribute("position").array as Float32Array);

    expect(positions[3]).toBeCloseTo(0.75);
    expect(positions[6]).toBeCloseTo(1.5);
    geometry.dispose();
  });
});

describe("angledTransitionFillerPrismGeometry", () => {
  it("extrudes the complete measured wedge/trapezoid instead of a 3/4-inch face strip", () => {
    const geometry = angledTransitionFillerPrismGeometry([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6.5, y: 12 },
      { x: 0, y: 12 },
    ], 42);
    geometry.computeBoundingBox();

    expect(geometry.getIndex()?.count).toBe(36);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(6.5);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(12);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(21);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-21);
    geometry.dispose();
  });

  it("converts the world Plan polygon into the cabinet group's rotated local frame", () => {
    const local = angledTransitionLocalFootprint([{ x: 11, y: 22 }], { x: 10, z: 20, rotation: Math.PI / 2 });
    expect(local[0]?.x).toBeCloseTo(-2 / 12);
    expect(local[0]?.y).toBeCloseTo(1 / 12);
  });

  it("extrudes a front-only 45-degree miter member without reserving full cabinet depth", () => {
    const geometry = angledTransitionFillerPrismGeometry([
      { x: 0, y: 23.25 },
      { x: 1.25, y: 24 },
      { x: 2, y: 24 },
      { x: 2, y: 23.25 },
    ], 34.5);
    geometry.computeBoundingBox();

    expect(geometry.boundingBox?.max.x).toBeCloseTo(2);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(24);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(23.25);
    expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(0.75);
    geometry.dispose();
  });
});
