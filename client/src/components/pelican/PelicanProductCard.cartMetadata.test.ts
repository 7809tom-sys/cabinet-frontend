import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Pelican catalog cart metadata", () => {
  it("locks approved product prices and identifies direct catalog items as surfaces", () => {
    const cardSource = fs.readFileSync(path.join(process.cwd(), "client/src/components/pelican/PelicanProductCard.tsx"), "utf8");
    const detailSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/SurfacesProduct.tsx"), "utf8");
    expect(cardSource).toContain('priceLocked: true');
    expect(cardSource).toContain('productKind: "surface"');
    expect(detailSource.match(/priceLocked: true/g)?.length).toBeGreaterThanOrEqual(2);
    expect(detailSource.match(/productKind: "surface"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("shows quote-only products as Call for pricing and never renders an add-to-cart control without a sell price", () => {
    const cardSource = fs.readFileSync(path.join(process.cwd(), "client/src/components/pelican/PelicanProductCard.tsx"), "utf8");
    expect(cardSource).toContain("formatPrice(product.sellPrice)");
    expect(cardSource).toContain("{product.sellPrice && (");
    expect(cardSource).toContain("if (!product.sellPrice) return;");
    expect(cardSource).toContain("const hasSellPrice = product.sellPrice != null && product.sellPrice > 0;");
  });
});
