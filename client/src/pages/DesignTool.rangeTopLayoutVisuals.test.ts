import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("unpriced cooktop layout visuals", () => {
  it("offers gas, electric-coil, and smooth-glass visuals without creating a product line", () => {
    expect(source).toContain("const layoutCooktopVisuals: Record");
    expect(source).toContain("layout-visual-gas-cooktop_ab66b595.jpg");
    expect(source).toContain("layout-visual-electric-coil-cooktop_642f511d.jpg");
    expect(source).toContain("layout-visual-smooth-glass-cooktop_216fe453.jpg");
    expect(source).toContain("range-top-layout-visual-${effectiveType}");
    expect(source).toContain("applyRangeTop(effectiveType, undefined, layoutVisual)");
    expect(source).toContain("It does not add a Stone Creek product, SKU, or price.");
  });

  it("keeps product identity and cart pricing empty for a visual-only cooktop", () => {
    expect(source).toContain("sinkTopProductId: product?.id ?? null");
    expect(source).toContain("rangeTopImageUrl: product?.imageUrl ?? layoutVisual?.imageUrl ?? null");
    expect(source).toContain('if (product) {');
  });
});
