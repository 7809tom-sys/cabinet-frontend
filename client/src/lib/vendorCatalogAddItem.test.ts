import { describe, expect, it } from "vitest";
import {
  PELICAN_CATEGORY_MAX,
  PELICAN_CODE_MAX,
  PELICAN_NAME_MAX,
  PELICAN_SUBCATEGORY_MAX,
  buildCreatePelicanProductInput,
  collectPelicanSubcategories,
  catalogBrowseLabel,
  catalogEditorItemFromCreate,
  catalogSubcategoryOptions,
  categoryChoices,
  createdCatalogItemId,
  initialAddCatalogItemDraft,
  isCatalogProcedureNotFound,
  itemsMatchingSubcategory,
  type CreatePelicanProductResult,
} from "./vendorCatalogAddItem";

const created: CreatePelicanProductResult = {
  id: 42,
  pelicanCode: "hex-mosaic",
  slug: "hex-mosaic",
  name: "Hex Mosaic",
  description: "",
  category: "Tile & Mosaic",
  subCategory: "Mosaic",
  size: null,
  listPrice: null,
  msrp: null,
  coverageSqFt: null,
  isActive: true,
  showInCatalog: true,
  showInDesigner: true,
  sellPrice: null,
  markupBps: 5500,
};

describe("vendor catalog add item", () => {
  it("prefills the category and sub-category being browsed", () => {
    expect(catalogBrowseLabel("Tile & Mosaic", "Mosaic")).toBe("Tile & Mosaic > Mosaic");
    expect(catalogBrowseLabel("Tile & Mosaic", "  ")).toBe("Tile & Mosaic");
    expect(catalogBrowseLabel(null, "Mosaic")).toBeNull();
    expect(initialAddCatalogItemDraft({ category: "Tile & Mosaic", subCategory: "Mosaic" })).toMatchObject({
      name: "",
      category: "Tile & Mosaic",
      subCategory: "Mosaic",
      code: "",
      listPrice: "",
    });
    expect(initialAddCatalogItemDraft({})).toMatchObject({ category: "", subCategory: "" });
  });

  it("asks for a category from the existing list when the catalog is on all", () => {
    expect(categoryChoices(["Tile & Mosaic", "Flooring", "  "], "")).toEqual(["Tile & Mosaic", "Flooring"]);
    expect(categoryChoices(["Flooring"], "Tile & Mosaic")).toEqual(["Tile & Mosaic", "Flooring"]);
    const parsed = buildCreatePelicanProductInput(initialAddCatalogItemDraft({}));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toBe("Enter a product name.");
  });

  it("sends the pelican.createProduct contract and omits blank optional fields", () => {
    const draft = {
      ...initialAddCatalogItemDraft({ category: " Tile & Mosaic ", subCategory: " Mosaic " }),
      name: " Hex Mosaic ",
      code: " HEX-1 ",
      description: " Sheet ",
      size: " 12 x 12 ",
      listPrice: "20",
      msrp: "0",
      coverageSqFt: "10.5",
    };
    expect(buildCreatePelicanProductInput(draft)).toEqual({
      ok: true,
      value: {
        category: "Tile & Mosaic",
        subCategory: "Mosaic",
        name: "Hex Mosaic",
        pelicanCode: "HEX-1",
        description: "Sheet",
        size: "12 x 12",
        listPrice: 20,
        msrp: 0,
        coverageSqFt: 10.5,
      },
    });
    const minimal = buildCreatePelicanProductInput({
      ...initialAddCatalogItemDraft({ category: "Tile & Mosaic", subCategory: "Mosaic" }),
      name: "Plain",
    });
    expect(minimal).toEqual({
      ok: true,
      value: { category: "Tile & Mosaic", subCategory: "Mosaic", name: "Plain" },
    });
    expect(JSON.stringify(minimal)).not.toContain("isActive");
    expect(JSON.stringify(minimal)).not.toContain("showInCatalog");
    expect(JSON.stringify(minimal)).not.toContain("pelicanCode");
  });

  it("rejects fields outside the createProduct limits", () => {
    const base = initialAddCatalogItemDraft({ category: "Tile & Mosaic", subCategory: "Mosaic" });
    expect(buildCreatePelicanProductInput({ ...base, name: "Plain" }).ok).toBe(true);
    expect(buildCreatePelicanProductInput({ ...base, name: "..." }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "A".repeat(PELICAN_NAME_MAX + 1) }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", category: "C".repeat(PELICAN_CATEGORY_MAX + 1) }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", subCategory: "S".repeat(PELICAN_SUBCATEGORY_MAX + 1) }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", code: "K".repeat(PELICAN_CODE_MAX + 1) }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", listPrice: "-1" }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", msrp: "nope" }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", coverageSqFt: "0" }).ok).toBe(false);
    expect(buildCreatePelicanProductInput({ ...base, name: "Named", subCategory: "" }).ok).toBe(false);
  });

  it("opens the editor from the created id and hides the button on NOT_FOUND", () => {
    expect(createdCatalogItemId(created)).toBe(42);
    expect(createdCatalogItemId({ id: 0 })).toBeNull();
    expect(createdCatalogItemId(42)).toBeNull();
    expect(catalogEditorItemFromCreate(created)).toMatchObject({
      id: 42,
      pelicanCode: "hex-mosaic",
      category: "Tile & Mosaic",
      subCategory: "Mosaic",
      imageUrl: null,
      materialImageUrl: null,
      roomSceneImageUrl: null,
    });
    expect(isCatalogProcedureNotFound({ data: { code: "NOT_FOUND" }, message: "No procedure found on path \"pelican.createProduct\"" })).toBe(true);
    expect(isCatalogProcedureNotFound({ message: "No procedure found on path \"pelican.createProduct\"" })).toBe(true);
    expect(isCatalogProcedureNotFound({ data: { code: "CONFLICT" }, message: "A product named \"Hex Mosaic\" already exists in Tile & Mosaic." })).toBe(false);
    expect(isCatalogProcedureNotFound({ data: { code: "BAD_REQUEST" }, message: "Enter a product name." })).toBe(false);
  });

  it("lists sub-categories for the category being browsed and filters the page", () => {
    const items = [
      { category: "Tile & Mosaic", subCategory: "Mosaic" },
      { category: "Tile & Mosaic", subCategory: "Field Tile" },
      { category: "Flooring", subCategory: "Planks & Flooring" },
    ];
    expect(catalogSubcategoryOptions({
      category: "Tile & Mosaic",
      serverSubs: ["Mosaic", "Mosaic", ""],
      items,
    })).toEqual(["Mosaic", "Field Tile"]);
    expect(catalogSubcategoryOptions({ category: "", items })).toEqual([]);
    expect(itemsMatchingSubcategory(items, "Mosaic")).toEqual([items[0]]);
    expect(itemsMatchingSubcategory(items, undefined)).toEqual(items);
  });

  it("collects every sub-category for one category from paged catalog rows", async () => {
    const pageSize = 2;
    const subs = await collectPelicanSubcategories("Sinks & Faucets", async ({ category, offset, limit }) => {
      expect(category).toBe("Sinks & Faucets");
      expect(limit).toBe(pageSize);
      if (offset === 0) return { items: [{ subCategory: "Sinks" }, { subCategory: "Faucets" }], total: 3 };
      if (offset === 2) return { items: [{ subCategory: " sinks " }, { subCategory: "Disposals & Accessories" }], total: 3 };
      return { items: [], total: 3 };
    }, pageSize);
    expect(subs).toEqual(["Sinks", "Faucets", "Disposals & Accessories"]);
    await expect(collectPelicanSubcategories("  ", async () => ({ items: [], total: 0 }))).resolves.toEqual([]);
  });
});
