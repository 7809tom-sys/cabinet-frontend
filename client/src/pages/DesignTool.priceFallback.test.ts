import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveTierPrice } from "@shared/pricingTier";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer verified price fallback", () => {
  it("keeps an absent authorized tier price pending rather than treating it as a zero-dollar sale", () => {
    expect(resolveTierPrice("homeowner", {
      homeownerPrice: null,
      adjustedListPrice: null,
      listPrice: null,
    })).toBeNull();
    expect(source).toContain("return resolveTierPrice(DESIGN_TIER_TO_SHARED[tier], row);");
    expect(source).toContain("if (price != null) m.set(`${r.cabinetId}:${r.styleId}`, price);");
  });

  it("does not create a buyable trim or smart-gap price when its verified price is absent", () => {
    expect(source).toContain("if (unitPrice == null) return;");
    expect(source).toContain("return price == null ? [] : [[row.cabinetId, price] as const];");
  });

  it("passes a verified trim price through to Materials & Parts rather than relabeling it quote-only", () => {
    expect(source).toContain("const priced = trimPriceForKind(trim.kind, trimPriceByCode);");
    expect(source).toContain("if (!priced || pricedCodes.has(priced.masterCode)) continue;");
    expect(source).toContain("unitPrice: priced.unitPrice,");
    expect(source).not.toContain('supplier: "Cabinet supplier / quote",\n        styleColor,\n        unitPrice: null,');
  });

  it("never labels an unresolved automatic toe kick as included or zero-cost", () => {
    const toeKickBlock = source.slice(source.indexOf("{toeKick && toeKickOrder"), source.indexOf("{batten && battenOrder"));
    expect(toeKickBlock).toContain('t("dt_bs_quote")');
    expect(toeKickBlock).not.toContain('t("dt_bs_incl")');
  });

  it("marks an unpriced cabinet unavailable rather than presenting a vague N/A amount", () => {
    expect(source).toContain('lineTotal != null ? `$${lineTotal.toFixed(2)}` : "Unavailable"');
    expect(source).not.toContain('lineTotal != null ? `$${lineTotal.toFixed(2)}` : "N/A"');
  });

  it("labels an unpriced visual-only appliance as excluded instead of an unavailable cabinet", () => {
    expect(source).toContain('const isLayoutAppliance = g.sample.placement === "appliance"');
    expect(source).toContain('isLayoutAppliance ? "Not included"');
    expect(source).toContain("Appliance price not included");
    expect(source).toContain("{!isLayoutAppliance && <Popover>");
  });

  it("normalizes saved foreign cabinet finish overrides after the independent door-style list resolves", () => {
    expect(source).toContain("clearForeignSavedStyleOverrides(current, lockedDistributorId, styleDistributorIdById)");
    expect(source).toContain("if (lockedDistributorId == null || styleDistributorIdById.size === 0) return;");
  });

  it("shows the same discount and custom-size adjusted cabinet amount used by the locked cart", () => {
    expect(source).toContain("const adjustedUnitPrice = adjustedDesignUnitPrice(g.sample, g.unitPrice);");
    expect(source).toContain("const lineTotal = adjustedUnitPrice != null ? adjustedUnitPrice * g.qty : null;");
    expect(source).toContain("${adjustedUnitPrice.toFixed(2)} ea");
  });
});
