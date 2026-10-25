import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AffiliateCatalogPanel.tsx"), "utf8");

describe("AffiliateCatalogPanel distributor curation", () => {
  it("provides clear include and feature controls without replacing per-style controls", () => {
    expect(source).toContain("Cabinet lines on my storefront");
    expect(source).toContain("Show all active cabinet lines again");
    expect(source).toContain("updateMyStorefrontDistributors");
    expect(source).toContain("adminUpdateStorefrontDistributors");
    expect(source).toContain("Line Active on Storefront");
    expect(source).toContain("line mark");
    expect(source).toContain("active cabinet styles");
    expect(source).toContain("Feature this door style");
    expect(source).toContain("featured door styles");
    expect(source).toContain("individual door styles so they appear first");
    expect(source).toContain("reorderFeaturedStyles");
    expect(source).toContain("Drag featured door styles to change their storefront order");
    expect(source).toContain("Español");
    expect(source).toContain("Mover estilo destacado arriba");
  });
});
