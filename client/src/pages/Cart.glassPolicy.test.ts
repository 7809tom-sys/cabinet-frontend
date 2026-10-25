import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "Cart.tsx"), "utf8");

describe("Cart separate glass purchase warning", () => {
  it("uses an explicit cart-wide policy warning and marks affected lines", () => {
    expect(source).toContain("separateGlassPurchaseItems(items)");
    expect(source).toContain('data-testid="separate-glass-cart-warning"');
    expect(source).toContain("Glass insert purchased separately");
    expect(source).toContain("Glass purchased separately");
  });

  it("shows purchased filler stock width separately from its installed cut width", () => {
    expect(source).toContain('data-testid="cart-filler-stock-and-cut"');
    expect(source).toContain("Purchased stock");
    expect(source).toContain("Installed cut");
    expect(source).toContain("formatEighthInches(item.fillerStockWidthIn)");
    expect(source).toContain("formatEighthInches(item.fillerInstalledCutWidthIn)");
  });
});
