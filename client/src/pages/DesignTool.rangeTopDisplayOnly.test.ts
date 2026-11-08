import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL } from "@/lib/rangeTopDisplayOnly";

/**
 * Owner rule (Tom, CabinetDealz): where the Designer currently shows a price for
 * a range top, it shows "display only, not sold" instead. Placement, the
 * countertop, the cutout, and the rendering stay exactly as they were.
 */
describe("Designer range-top price presentation", () => {
  const source = readFileSync(
    resolve(process.cwd(), "client/src/pages/DesignTool.tsx"),
    "utf8",
  );
  const cardStart = source.indexOf(
    "const typeProducts = filteredRangeTops.filter",
  );
  const cardEnd = source.indexOf("Skip — add without product", cardStart);
  const cardSource = source.slice(cardStart, cardEnd);

  it("labels a range-top card as display-only where its price used to be", () => {
    expect(cardSource).toContain("rangeTopPriceLabel(p)");
    expect(cardSource).toContain("RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL");
    expect(cardSource).toContain(
      `data-testid={\`range-top-display-only-\${p.id}\`}`,
    );
    // The price element is the else branch of the display-only label.
    expect(cardSource).toMatch(
      /rangeTopPriceLabel\(p\)\s*\?[\s\S]*?:\s*p\.sellPrice != null/,
    );
  });

  it("keeps the copy the label promises", () => {
    expect(RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL).toBe("display only, not sold");
  });

  it("still places and draws the range top exactly as before", () => {
    // Placement identity, the drawing image, and the conversion stay untouched.
    expect(source).toContain("sinkTopProductId: product?.id ?? null");
    expect(source).toContain(
      "rangeTopImageUrl: product?.imageUrl ?? layoutVisual?.imageUrl ?? null",
    );
    expect(source).toContain("convertLegacyCooktopPlacements(");
    // No price travels with the display-only placement.
    expect(source).toContain("applianceCatalogPrice: null");
  });
});
