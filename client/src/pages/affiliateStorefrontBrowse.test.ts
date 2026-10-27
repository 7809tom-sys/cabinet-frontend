import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storefront = readFileSync(new URL("./Storefront.tsx", import.meta.url), "utf8");
const shop = readFileSync(new URL("../components/storefront/StorefrontShop.tsx", import.meta.url), "utf8");
const doorStyles = readFileSync(new URL("./DoorStyles.tsx", import.meta.url), "utf8");
const family = readFileSync(new URL("./Family.tsx", import.meta.url), "utf8");

describe("affiliate storefront reuses the main shop-by-style and catalog", () => {
  it("serves Shop by Style and the family page inside the branded shell", () => {
    expect(app).toContain('<Route path="/store/:slug/styles">');
    expect(app).toContain("<DoorStyles affiliateSlug={params.slug} />");
    expect(app).toContain('<Route path="/store/:slug/family/:styleCode">');
    expect(app).toContain("<Family styleCode={decodeURIComponent(params.styleCode)} affiliateSlug={params.slug} />");
    expect(app).toContain('href={affiliateStylesPath(slug)}');
    expect(app).toContain('<Storefront slug={params.slug} focusShop />');
  });

  it("puts the main catalog, with room scenes and the line selector, on Browse Cabinets", () => {
    expect(storefront).toContain('<div id="shop">');
    expect(storefront).toContain("<Catalog affiliateSlug={data.slug} embedded />");
    expect(storefront).toContain('href={withRef(`/store/${slug}/styles`)}');
    expect(storefront).not.toContain("<StorefrontShop");
  });

  it("stops a style query from re-locking the line after Change Line", () => {
    expect(shop).toContain("params.delete(\"style\")");
    expect(shop).toContain("ignoreStyleQuery");
    expect(shop).toContain("onSwitch={releaseLine}");
    expect(shop).toContain("clear();");
  });

  it("keeps affiliate family links and sale prices on the shared pages", () => {
    expect(doorStyles).toContain("affiliateFamilyPath(affiliateSlug, style.styleCode)");
    expect(doorStyles).toContain("overlayAffiliateStyle");
    expect(family).toContain("affiliateStylesPath(affiliateSlug)");
    expect(family).toContain('title="Change line"');
    expect(family).toContain("useAffiliateSalePrices");
    expect(family).toContain('affiliateSlug ? "homeowner"');
  });
});
