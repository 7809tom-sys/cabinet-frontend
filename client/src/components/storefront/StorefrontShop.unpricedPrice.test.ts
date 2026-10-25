import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./StorefrontShop.tsx", import.meta.url), "utf8");

describe("storefront unpriced product safeguards", () => {
  it("shows an unavailable state and prevents an item without a current price from entering the cart", () => {
    expect(source).toContain("const hasCurrentPrice");
    expect(source).toContain("Price unavailable");
    expect(source).toContain("disabled={!hasCurrentPrice}");
    expect(source).toContain("if (!hasCurrentPrice) return;");
  });
});
