import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glassPolicyForProduct, isGlassPolicyNomenclature } from "@/lib/glassPolicy";

const badge = readFileSync(new URL("./GlassPolicyBadge.tsx", import.meta.url), "utf8");
const policy = readFileSync(new URL("../lib/glassPolicy.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../pages/Catalog.tsx", import.meta.url), "utf8");
const storefront = readFileSync(new URL("./storefront/StorefrontShop.tsx", import.meta.url), "utf8");

describe("catalog glass policy disclosure", () => {
  it("recognizes every required glass nomenclature ending", () => {
    expect(isGlassPolicyNomenclature("W2430GD")).toBe(true);
    expect(isGlassPolicyNomenclature("W2430-PG")).toBe(true);
    expect(isGlassPolicyNomenclature("W2430-G")).toBe(true);
    expect(isGlassPolicyNomenclature("W2430")).toBe(false);
  });

  it("uses the selected distributor overlay to disclose included or separate glass", () => {
    expect(glassPolicyForProduct("W2430GD", true)).toMatchObject({
      included: true,
      label: "Glass included",
    });
    expect(glassPolicyForProduct("W2430GD", false)).toMatchObject({
      included: false,
      label: "Glass purchased separately",
    });
    expect(glassPolicyForProduct("B24", false)).toBeNull();
  });

  it("renders the compact disclosure and its explanation on both catalog card surfaces", () => {
    expect(badge).toContain('data-testid="glass-policy-badge"');
    expect(policy).toContain("Glass purchased separately");
    expect(policy).toContain("Purchase the glass separately.");
    expect(catalog).toContain("<GlassPolicyBadge");
    expect(storefront).toContain("<GlassPolicyBadge masterCode={code} glassIncluded={showing.glassIncluded}");
  });
});
