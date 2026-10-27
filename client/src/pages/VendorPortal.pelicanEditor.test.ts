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

  it("opens the existing editor for a forecast product and shows vendor cost read-only", () => {
    expect(catalogSource).toContain("productForVendorEdit");
    expect(catalogSource).toContain('data-testid="pelican-vendor-cost"');
    expect(catalogSource).toContain("pelicanVendorCostLabel(editingProduct?.vendorWholesale)");
    expect(catalogSource).toContain("Read-only");
    expect(catalogSource).not.toContain('id="pelican-edit-vendor-wholesale"');
  });

  it("pages the Pelican catalog from the same category source as Overview", () => {
    expect(catalogSource).toContain("limit: CATALOG_PAGE_SIZE");
    expect(catalogSource).toContain('trpc.pelican.categories.useQuery({ scope: "admin" })');
    expect(catalogSource).toContain("selectedCatalogCategory");
    expect(catalogSource).toContain("Previous page");
    expect(catalogSource).toContain("Next page");
    expect(catalogSource).not.toContain("limit: 200");
    expect(catalogSource).toContain("Edit");
  });

  it("routes Pelican vendors to the shipping profile editor", () => {
    expect(source).toContain("PelicanShippingProfilesPanel");
    expect(source).toContain("page === \"shipping\" && (isPelican");
    expect(source).toContain("distList.find((d: any) => d.id === activeDistributorId)");
  });
});
