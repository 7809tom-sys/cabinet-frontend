import { describe, expect, it } from "vitest";
import {
  CATALOG_CATEGORY_MOULDING,
  CATALOG_SUBCATEGORY_MOULDINGS_AND_TRIM,
  CATALOG_SUBCATEGORY_TRIM_AND_MOULDING,
  alternateCatalogMouldingSpelling,
  canonicalMouldingLabel,
  catalogCategoryCount,
  catalogCategoryQueryValue,
  catalogCategoryRecordValue,
  catalogCategoryValuesEqual,
  isCatalogMouldingCategory,
  isFlooringMouldingsAndTrim,
  isTrimAndMouldingSubcategory,
  normalizeCatalogCategoryValue,
  selectedCatalogOption,
} from "./catalogCategorySpelling";

describe("catalog category moulding spelling", () => {
  it("folds both spellings and plurals without regard to case or spacing", () => {
    expect(normalizeCatalogCategoryValue("  Molding ")).toBe("moulding");
    expect(normalizeCatalogCategoryValue("MOULDING")).toBe("moulding");
    expect(normalizeCatalogCategoryValue("Moldings & Trim")).toBe("mouldings & trim");
    expect(normalizeCatalogCategoryValue("Mouldings  &   Trim")).toBe("mouldings & trim");
    expect(catalogCategoryValuesEqual("Trim & Molding", "trim & moulding")).toBe(true);
    expect(catalogCategoryValuesEqual("Trim and Molding", "TRIM AND MOULDING")).toBe(true);
    expect(catalogCategoryValuesEqual("Crown Molding", "Crown Moulding")).toBe(true);
    expect(catalogCategoryValuesEqual("Base", "Moulding")).toBe(false);
    expect(catalogCategoryValuesEqual("", "Moulding")).toBe(false);
    expect(catalogCategoryValuesEqual("Trim & Molding", "Trim and Molding")).toBe(false);
  });

  it("uses Moulding as the canonical label and can still name the stored alternate", () => {
    expect(canonicalMouldingLabel("Molding")).toBe(CATALOG_CATEGORY_MOULDING);
    expect(canonicalMouldingLabel("MOLDINGS & TRIM")).toBe("MOULDINGS & TRIM");
    expect(canonicalMouldingLabel("trim & molding")).toBe("trim & moulding");
    expect(canonicalMouldingLabel("Crown Moulding")).toBe("Crown Moulding");
    expect(canonicalMouldingLabel(CATALOG_SUBCATEGORY_TRIM_AND_MOULDING)).toBe("Trim & Moulding");
    expect(alternateCatalogMouldingSpelling("Trim & Molding")).toBe("Trim & Moulding");
    expect(alternateCatalogMouldingSpelling("Mouldings & Trim")).toBe("Moldings & Trim");
    expect(alternateCatalogMouldingSpelling("Base")).toBeNull();
  });

  it("recognizes the category and subcategory values used by filters", () => {
    for (const value of ["Molding", "moulding", "MOULDING", "Trim and Molding", "Trim & Molding", "Trim & Moulding", "Moldings & Trim", CATALOG_SUBCATEGORY_MOULDINGS_AND_TRIM]) {
      expect(isCatalogMouldingCategory(value)).toBe(true);
    }
    expect(isCatalogMouldingCategory("Crown Moulding")).toBe(false);
    expect(isTrimAndMouldingSubcategory("Trim and Molding")).toBe(true);
    expect(isTrimAndMouldingSubcategory("Trim & Moulding")).toBe(true);
    expect(isTrimAndMouldingSubcategory("Crown & Moulding")).toBe(false);
    expect(isFlooringMouldingsAndTrim("Moldings & Trim")).toBe(true);
    expect(isFlooringMouldingsAndTrim("mouldings & trim")).toBe(true);
    expect(isFlooringMouldingsAndTrim("Planks & Flooring")).toBe(false);
  });

  it("counts and queries either stored spelling", () => {
    expect(catalogCategoryCount({ Molding: 4 }, "Moulding")).toBe(4);
    expect(catalogCategoryCount({ Moulding: 2, Molding: 1 }, "molding")).toBe(3);
    expect(catalogCategoryCount({ Base: 8 }, "Moulding")).toBe(0);
    expect(catalogCategoryQueryValue({ Molding: 4 }, "Moulding")).toBe("Molding");
    expect(catalogCategoryQueryValue({ Moulding: 4 }, "Moulding")).toBe("Moulding");
    expect(catalogCategoryQueryValue(undefined, "Moulding")).toBe("Moulding");
  });

  it("resolves fallback maps and select options across spellings", () => {
    const subs = { Moulding: ["Crown Moulding", "Scribe Moulding"] };
    expect(catalogCategoryRecordValue(subs, "Molding")).toEqual(["Crown Moulding", "Scribe Moulding"]);
    expect(selectedCatalogOption(["Trim & Moulding", "Roll-Out Tray"], "Trim & Molding")).toBe("Trim & Moulding");
    expect(selectedCatalogOption(["Trim & Moulding"], "Filler")).toBeUndefined();
  });
});
