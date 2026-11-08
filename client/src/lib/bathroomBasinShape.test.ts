import { describe, expect, it } from "vitest";
import { PELICAN_VANITY_SINKS, pelicanVanitySinkProfile } from "@shared/pelicanBathroomFixtures";

/**
 * The bowl a shopper sees must be the shape the product actually is. These check
 * the source facts the renderer reads, so a product photo and the 3D bowl cannot
 * drift apart again.
 */
describe("vanity basin shapes come from the specification sheet", () => {
  it("gives every vanity basin and top a shape", () => {
    for (const record of PELICAN_VANITY_SINKS) {
      expect(record.basinShape, `${record.model} has no basinShape`).toMatch(/^(oval|rectangle|circle)$/);
    }
  });

  it("records PL-3608 as round, which is why a rectangle was wrong", () => {
    // The sheet states "Circular Basin" and interior 16 1/2" x 13 1/2".
    const profile = pelicanVanitySinkProfile("PL-3608");
    expect(profile?.basinShape).toBe("circle");
  });

  it("records the rectangular basins as rectangles", () => {
    // These sheets say "Rectangular Basin".
    for (const code of ["PL-1637 White", "PL-1646 White", "PL-3099 White", "PL-3611 White", "PL-3639"]) {
      expect(pelicanVanitySinkProfile(code)?.basinShape, code).toBe("rectangle");
    }
  });

  it("records the genuinely oval basins as ovals", () => {
    for (const code of ["PL-1634 White", "PL-1011 Spread 4\"", "PL-1011 Spread 8\""]) {
      expect(pelicanVanitySinkProfile(code)?.basinShape, code).toBe("oval");
    }
  });

  it("keeps a circle geometrically distinct from an oval", () => {
    // PL-3001 is 16" x 16" (round); PL-3002 is 22.75" x 14.75" (oval).
    expect(pelicanVanitySinkProfile("PL-3001")?.basinShape).toBe("circle");
    expect(pelicanVanitySinkProfile("PL-3002")?.basinShape).toBe("oval");
  });

  it("does not claim a shape for a product Pelican does not sell as a vanity basin", () => {
    expect(pelicanVanitySinkProfile("PL-CI6004 White")).toBeNull();
  });
});
