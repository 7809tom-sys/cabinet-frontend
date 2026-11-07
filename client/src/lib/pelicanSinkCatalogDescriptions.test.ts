import { describe, expect, it } from "vitest";
import { pelicanSinkCatalogDescription, withPelicanSinkCatalogDescription } from "./pelicanSinkCatalogDescriptions";

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

  it("replaces a stored generic sentence when the SKU has Pelican copy", () => {
    const product = withPelicanSinkCatalogDescription({
      pelicanCode: "PL-3608",
      description: "18\" Undermount Vanity Sink. Fireclay construction with premium glaze finish.",
    });
    expect(product.description).toMatch(/Pearl Series PL-3608 Porcelain Undermount Sink/);
  });
});
