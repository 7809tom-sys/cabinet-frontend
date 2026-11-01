import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("VendorPortal add item", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
  const catalogSource = source.slice(source.indexOf("function PelicanVendorCatalogPage"), source.indexOf("function PelicanVendorOverviewPage"));
  const dialogSource = readFileSync(resolve(process.cwd(), "client/src/components/vendor/AddCatalogItemDialog.tsx"), "utf8");
  const otherProducts = readFileSync(resolve(process.cwd(), "client/src/components/vendor/VendorOtherProducts.tsx"), "utf8");
  const createSource = readFileSync(resolve(process.cwd(), "client/src/lib/vendorCatalogAddItem.ts"), "utf8");

  it("adds a Pelican catalog item with the createProduct contract and then opens the photo editor", () => {
    expect(catalogSource).toContain('data-testid="vendor-add-item"');
    expect(catalogSource).toContain("Add item");
    expect(catalogSource).toContain('data-testid="vendor-add-item-beside-edit"');
    expect(catalogSource).toContain("useCreatePelicanProduct");
    expect(catalogSource).toContain("buildCreatePelicanProductInput");
    expect(catalogSource).toContain("catalogEditorItemFromCreate");
    expect(catalogSource).toContain('data-testid="vendor-add-item-photos"');
    expect(catalogSource).toContain('uploadPelicanPhoto(file, "catalog")');
    expect(catalogSource).toContain('uploadPelicanPhoto(file, "designer")');
    expect(catalogSource).toContain('uploadPelicanPhoto(file, "roomScene")');
    expect(catalogSource).toContain("isCatalogProcedureNotFound");
    expect(catalogSource).toContain('createAvailability !== "missing"');
    expect(createSource).toContain("pelican.createProduct");
    expect(createSource).toContain("Cast until AppRouter includes it");
    expect(createSource).toContain("category: string");
    expect(createSource).toContain("subCategory: string");
    expect(createSource).toContain("pelicanCode?: string");
    expect(createSource).toContain("listPrice?: number");
    expect(createSource).toContain("msrp?: number");
    expect(createSource).toContain("coverageSqFt?: number");
    expect(dialogSource).toContain('data-testid="vendor-add-item-dialog"');
    expect(dialogSource).toContain('data-testid="vendor-add-item-name"');
    expect(dialogSource).toContain('data-testid="vendor-add-item-category"');
    expect(dialogSource).toContain('data-testid="vendor-add-item-subcategory"');
    expect(dialogSource).toContain('data-testid="vendor-add-item-code"');
    expect(dialogSource).toContain("Choose a category");
    expect(dialogSource).toContain("Code / SKU");
    expect(dialogSource).toContain("List price");
    expect(dialogSource).toContain("MSRP");
    expect(dialogSource).toContain("Coverage (sq ft)");
  });

  it("reuses the cabinet and other-product create flows instead of a new endpoint", () => {
    expect(source).toContain('data-testid="cabinet-add-item"');
    expect(source).toContain("setShowNewProduct(!showNewProduct)");
    expect(source).toContain("distributorPortal.submitNewProduct");
    expect(otherProducts).toContain('data-testid="other-products-add-item"');
    expect(otherProducts).toContain("Add item");
    expect(otherProducts).toContain("distributorPortal.saveVendorProduct");
    expect(source).not.toContain("distributorPortal.createProduct");
    expect(otherProducts).not.toContain("distributorPortal.createProduct");
  });
});
