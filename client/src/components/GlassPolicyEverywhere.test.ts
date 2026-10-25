import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("glass policy warning appears at every cabinet view", () => {
  it.each([
    ["../pages/CabinetDetail.tsx"],
    ["../pages/DesignTool.tsx"],
    ["./order/OrderReview.tsx"],
    ["./catalog/CabinetQuickViewDialog.tsx"],
    ["./storefront/StorefrontShop.tsx"],
  ])("%s renders GlassPolicyBadge", (file) => {
    expect(read(file)).toContain("<GlassPolicyBadge");
  });

  it("checkout prefill carries glassIncluded from the cart", () => {
    const s = read("../lib/cartCheckoutPrefill.ts");
    expect(s).toContain("glassIncluded: item.glassIncluded ?? null");
  });
});
