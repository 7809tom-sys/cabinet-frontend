import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  pelicanSinkCatalogDescription,
  pelicanSinkCatalogFactLine,
  pelicanSinkCatalogName,
  pelicanSinkFinishLabel,
  pelicanSinkSeriesLabel,
  withPelicanSinkCatalogCopy,
  withPelicanSinkCatalogDescription,
} from "./pelicanSinkCatalogDescriptions";

describe("pelicanSinkCatalogDescription", () => {
  it("uses Pelican's Sandbar undermount copy for PL-1647 instead of the vessel fireclay sentence", () => {
    const text = pelicanSinkCatalogDescription("PL-1647 White");
    expect(text).toMatch(/Sandbar Series porcelain sinks/);
    expect(text).toMatch(/undermount installation/);
    expect(text).not.toMatch(/fireclay|vessel/i);
  });

  it("uses Pelican's Pearl undermount copy for each PL-3099 finish", () => {
    const bone = pelicanSinkCatalogDescription("PL-3099 Bone");
    const matte = pelicanSinkCatalogDescription("PL-3099 Matte Black");
    expect(bone).toBe(matte);
    expect(bone).toMatch(/Pearl Series PL-3099 Porcelain Undermount Sink/);
    expect(bone).not.toMatch(/farmhouse|apron/i);
  });

  it("leaves products outside this catalog on their stored description", () => {
    expect(pelicanSinkCatalogDescription("PL-8112 BN")).toBeNull();
    expect(pelicanSinkCatalogDescription(null)).toBeNull();
    const other = { pelicanCode: "PL-8112 BN", description: "Bathroom faucet" };
    expect(withPelicanSinkCatalogDescription(other)).toBe(other);
  });

  it("shows that copy on the shared product card used by the main site and every affiliate store", () => {
    const card = readFileSync(new URL("../components/pelican/PelicanProductCard.tsx", import.meta.url), "utf8");
    const category = readFileSync(new URL("../pages/SurfacesCategory.tsx", import.meta.url), "utf8");
    const product = readFileSync(new URL("../pages/SurfacesProduct.tsx", import.meta.url), "utf8");
    expect(card).toContain("pelicanSinkCatalogDescription(product.pelicanCode)");
    expect(category).toContain("<PelicanProductCard");
    expect(category).toContain("affiliateSlug={affiliateSlug}");
    expect(product).toContain("pelicanSinkCatalogDescription(data.pelicanCode)");
  });

  it("replaces a stored generic sentence when the SKU has Pelican copy", () => {
    const product = withPelicanSinkCatalogDescription({
      pelicanCode: "PL-3608",
      description: "18\" Undermount Vanity Sink. Fireclay construction with premium glaze finish.",
    });
    expect(product.description).toMatch(/Pearl Series PL-3608 Porcelain Undermount Sink/);
  });

  it("names PL-3099 from Pelican's Pearl undermount data instead of the imported farmhouse title", () => {
    expect(pelicanSinkCatalogName("PL-3099 Bone"))
      .toBe("StoneCreek Pearl Series Porcelain Undermount Sink — Bone White");
    expect(pelicanSinkCatalogName("PL-3099 Matte Black"))
      .toBe("StoneCreek Pearl Series Porcelain Undermount Sink — Matte Black");
    expect(pelicanSinkCatalogName("PL-3099 Individually Packed"))
      .toBe("StoneCreek Pearl Series Porcelain Undermount Sink — White (Foam Lined Box)");
    expect(pelicanSinkCatalogName("PL-3099 Bone")).not.toMatch(/farmhouse|apron/i);
  });

  it("uses the Sandbar series for the Sandbar basins and the published size, not a farmhouse footprint", () => {
    expect(pelicanSinkCatalogName("PL-1647 White")).toBe("StoneCreek Sandbar Series Porcelain Undermount Sink — White");
    expect(pelicanSinkSeriesLabel("PL-1647 White")).toBe("Sandbar Series");
    expect(pelicanSinkCatalogFactLine("PL-3099 Bone"))
      .toBe('Pearl Series · Undermount basin · 20 ⅞" × 15 ⅝"');
    expect(pelicanSinkCatalogFactLine("PL-1647 White"))
      .toBe('Sandbar Series · Undermount basin · 24 ⅜" × 16 ⅝"');
  });

  it("keeps vessel basins labelled as vessel and leaves other products alone", () => {
    expect(pelicanSinkCatalogName("PL-3001")).toBe("StoneCreek Shell Series Porcelain Vessel Sink");
    expect(pelicanSinkFinishLabel("PL-3001")).toBeNull();
    expect(pelicanSinkCatalogName("PL-3059 Gloss Black"))
      .toBe("StoneCreek Pearl Series Porcelain Undermount Sink — Gloss Black");
    expect(pelicanSinkCatalogName("PL-8237 BN")).toBeNull();
    const faucet = { pelicanCode: "PL-8237 BN", name: "StoneCreek faucet" };
    expect(withPelicanSinkCatalogCopy(faucet)).toBe(faucet);
  });

  it("replaces both the stored name and the stored fireclay sentence in one pass", () => {
    const stored = {
      pelicanCode: "PL-3099 Bone",
      name: 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl — Bone White',
      description: '33" Farmhouse Apron-Front Single Bowl. Fireclay construction with premium glaze finish. Bone White color.',
    };
    const corrected = withPelicanSinkCatalogCopy(stored);
    expect(corrected.name).toBe("StoneCreek Pearl Series Porcelain Undermount Sink — Bone White");
    expect(corrected.description).toMatch(/Pearl Series PL-3099 Porcelain Undermount Sink/);
    expect(corrected.description).not.toMatch(/fireclay/i);
  });

  it("shows the corrected name on the storefront card and the product page", () => {
    const card = readFileSync(new URL("../components/pelican/PelicanProductCard.tsx", import.meta.url), "utf8");
    const product = readFileSync(new URL("../pages/SurfacesProduct.tsx", import.meta.url), "utf8");
    const stoneCreek = readFileSync(new URL("../pages/StoneCreekCollection.tsx", import.meta.url), "utf8");
    expect(card).toContain("pelicanSinkCatalogName(product.pelicanCode)");
    expect(product).toContain("pelicanSinkCatalogName(data.pelicanCode)");
    expect(stoneCreek).toContain("withPelicanSinkCatalogCopy(row)");
  });

  it("reads both catalog pages so every sink series is listed", () => {
    const stoneCreek = readFileSync(new URL("../pages/StoneCreekCollection.tsx", import.meta.url), "utf8");
    expect(stoneCreek).toContain("offset: 200");
    expect(stoneCreek).toContain("sinksDataPage2?.items");
  });
});
