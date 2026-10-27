import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Catalog Add Item and Edit Item form", () => {
  const source = readFileSync(
    resolve(process.cwd(), "client/src/components/admin/CatalogItemFormDialog.tsx"),
    "utf8",
  );

  it("uses one complete form for draft creation and editing", () => {
    expect(source).toContain('isEdit ? `Edit Item');
    expect(source).toContain('"Add Item"');
    expect(source).toContain('Save Draft');
    expect(source).toContain('Publish');
    expect(source).toContain('trpc.genericCabinets.saveCatalogItem.useMutation');
    expect(source).toContain('trpc.genericCabinets.itemEditorDetail.useQuery');
  });

  it("specifies cabinet identity, category, dimensions, placement, shipping, aliases, and a priced supplier source", () => {
    for (const field of [
      "Master SKU", "Product name / description", "Category", "Sub-category",
      "Dimensions and placement", "Placement type", "Corner cabinet",
      "Supplier price and availability", "Supplier line", "Door style", "Supplier SKU",
      "Eligible for 3D Designer",
      "List Price", "Your Cost", "Shipping, aliases, and notes", "Package L (in)",
    ]) {
      expect(source).toContain(field);
    }
  });

  it("shows inline validation and blocks publishing without a category or priced source", () => {
    expect(source).toContain('next.category = "Category is required."');
    expect(source).toContain('Enter List Price or Your Cost before publishing.');
    expect(source).toContain('Supplier SKU is required before publishing.');
    expect(source).toContain('className={fieldClass("category")}');
    expect(source).toContain('text-xs text-destructive');
  });
});


describe("Catalog administration wiring", () => {
  const adminSource = readFileSync(
    resolve(process.cwd(), "client/src/components/admin/GenericCabinetsAdmin.tsx"),
    "utf8",
  );
  const tabsSource = readFileSync(
    resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"),
    "utf8",
  );

  it("makes Add Item and the same edit form available under Products and Catalog", () => {
    expect(adminSource).toContain('Add Item');
    expect(adminSource).toContain('Eligible for 3D Designer');
    expect(adminSource).toContain('Eligible for 3D Designer: Yes');
    expect(adminSource).toContain('Eligible for 3D Designer: No');
    expect(adminSource).toContain('CatalogItemFormDialog');
    expect(adminSource).toContain('setItemEditor({ mode: "edit", id: cabinet.id })');
    expect(tabsSource).toContain('{ value: "cabinets", label: "Catalog" }');
    expect(tabsSource).toContain('<GenericCabinetsAdmin />');
  });
});
