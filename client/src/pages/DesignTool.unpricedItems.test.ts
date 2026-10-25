import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("regular Designer priced-item rule", () => {
  it("keeps every placed cabinet in the design and Cart handoff when its price is pending", () => {
    expect(source).toContain("They never delete a placed cabinet or remove it from Cart transfer.");
    expect(source).toContain("Every placed cabinet stays in the Cart.");
    expect(source).not.toContain("unpriced catalog item");
    expect(source).not.toContain("checkoutBlockedByMissingPrices");
    expect(source).not.toContain("notifyCheckoutBlockedByMissingPrices");
    expect(source).not.toContain("disabled={cartableLines.length === 0 || checkoutBlockedForMissingPrices}");
  });

  it("does not add quote-only trim, countertop, or hardware cart lines", () => {
    const cartBlock = source.slice(source.indexOf("const cartableLines"), source.indexOf("// The designer total"));
    expect(cartBlock).not.toContain("COUNTERTOP-QUOTE");
    expect(cartBlock).not.toContain("(quote)");
    expect(cartBlock).not.toContain("unitPrice: null");
  });

  it("does not add blank-price supplements to Materials & Parts", () => {
    const supplementBlock = source.slice(source.indexOf("const materialsListSupplements"), source.indexOf("const materialsListRows"));
    expect(supplementBlock).not.toContain("unitPrice: null");
    expect(supplementBlock).not.toContain("/ quote");
    expect(supplementBlock).not.toContain("COUNTERTOP-QUOTE");
    expect(supplementBlock).not.toContain("SINK-");
  });
});
