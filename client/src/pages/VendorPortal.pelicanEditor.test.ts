import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Pelican vendor catalog editor", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
  const catalogSource = source.slice(source.indexOf("function PelicanVendorCatalogPage"), source.indexOf("function PelicanVendorOverviewPage"));

  it("renders image, description, cost, and retail price editing fields", () => {
    expect(catalogSource).toContain('id="pelican-edit-image"');
    expect(catalogSource).toContain('id="pelican-edit-description"');
    expect(catalogSource).toContain('id="pelican-edit-cost"');
    expect(catalogSource).toContain('id="pelican-edit-retail"');
    expect(catalogSource).toContain("updateProduct");
  });

  it("keeps the full Pelican catalog page available for editing", () => {
    expect(catalogSource).toContain("limit: 200");
    expect(catalogSource).toContain("Edit");
  });

  it("routes Pelican vendors to the shipping profile editor", () => {
    expect(source).toContain("PelicanShippingProfilesPanel");
    expect(source).toContain("page === \"shipping\" && (isPelican");
    expect(source).toContain("distList.find((d: any) => d.id === activeDistributorId)");
  });
});
