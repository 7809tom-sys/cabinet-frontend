import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Elevation crown eligibility wiring", () => {
  it("uses the shared physical crown rule instead of a nullable mountBottom shortcut", () => {
    const source = readFileSync(new URL("./ElevationView.tsx", import.meta.url), "utf8");

    expect(source).toContain("crownEligibleCabinets(sorted, room)");
    expect(source).not.toContain('.filter((p) => p.placement === "wall" && p.mountBottom == null)\n    .map((p) => {\n      const footprint = placedFootprint(p);');
  });

  it("keeps the physical toe-kick run and visibly applies the selected finish instead of changing cart-only state", () => {
    const source = readFileSync(new URL("./ElevationView.tsx", import.meta.url), "utf8");

    expect(source).toContain('data-selected-toe-kick-finish={toeKick ? "true" : "false"}');
    expect(source).toContain("background: toeKick");
    expect(source).toContain("? `linear-gradient(180deg, ${finish.face} 0%, ${finish.edge} 100%)`");
  });

  it("renders visible 45-degree miter end cuts on the elevation crown band", () => {
    const source = readFileSync(new URL("./ElevationView.tsx", import.meta.url), "utf8");

    expect(source).toContain('data-visible-crown-miter="45"');
    expect(source).toContain('clipPath: "polygon(0 0, 100% 0, calc(100% - 4px) 100%, 4px 100%)"');
  });
});
