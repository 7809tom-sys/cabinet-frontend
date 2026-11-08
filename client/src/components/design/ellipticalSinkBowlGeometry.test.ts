import { describe, expect, it } from "vitest";
import { ellipticalSinkBowlGeometry } from "@/components/design/InteractiveRoom3D";

/**
 * The bowl a shopper sees must be the shape of the product they picked.
 *
 * PL-3608 is a round undermount basin (its sheet says "Circular Basin"). Until this
 * was fixed the renderer only knew how to build a rounded rectangle, so every
 * vanity basin came out rectangular.
 */
describe("ellipticalSinkBowlGeometry", () => {
  const width = 16.5 / 12;
  const depth = 13.5 / 12;

  it("builds a closed, indexed ring of vertices", () => {
    const geometry = ellipticalSinkBowlGeometry(width, depth, 3.5 / 12);
    const position = geometry.getAttribute("position");
    expect(position.count).toBeGreaterThan(100);
    expect(geometry.getIndex()!.count).toBeGreaterThan(0);
  });

  it("is wider than it is deep for an oval, and equal for a circle", () => {
    const oval = ellipticalSinkBowlGeometry(2, 1, 0.3);
    const box = oval.boundingBox ?? (oval.computeBoundingBox(), oval.boundingBox)!;
    expect(box.max.x - box.min.x).toBeCloseTo(2, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(1, 5);

    const circle = ellipticalSinkBowlGeometry(1, 1, 0.3);
    const circleBox = circle.boundingBox ?? (circle.computeBoundingBox(), circle.boundingBox)!;
    expect(circleBox.max.x - circleBox.min.x).toBeCloseTo(circleBox.max.z - circleBox.min.z, 5);
  });

  it("reaches the full published opening, not an inscribed rectangle", () => {
    // A rounded rectangle would be narrower than the ellipse at the mid-span.
    const geometry = ellipticalSinkBowlGeometry(width, depth, 3.5 / 12);
    const box = geometry.boundingBox ?? (geometry.computeBoundingBox(), geometry.boundingBox)!;
    expect(box.max.x - box.min.x).toBeCloseTo(width, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(depth, 5);
  });

  it("is open at the top and recessed by the published bowl height", () => {
    const height = 3.5 / 12;
    const geometry = ellipticalSinkBowlGeometry(width, depth, height);
    const box = geometry.boundingBox ?? (geometry.computeBoundingBox(), geometry.boundingBox)!;
    // The rim is at y = 0 and the floor at y = -height.
    expect(box.max.y).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(-height, 5);
    const userData = geometry.userData as { ellipticalSinkBowl?: boolean; measuredDepth?: number };
    expect(userData.ellipticalSinkBowl).toBe(true);
    expect(userData.measuredDepth).toBeCloseTo(height, 5);
  });

  it("draws in slightly at the bottom like a moulded china basin", () => {
    const geometry = ellipticalSinkBowlGeometry(width, depth, 3.5 / 12);
    const userData = geometry.userData as { bottomWidth: number; bottomDepth: number };
    expect(userData.bottomWidth).toBeLessThan(width);
    expect(userData.bottomDepth).toBeLessThan(depth);
    expect(userData.bottomWidth).toBeGreaterThan(width * 0.5);
  });
});
