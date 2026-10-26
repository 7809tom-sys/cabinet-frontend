import { isCatalogMouldingCategory } from "@shared/catalogCategorySpelling";

/**
 * Buyer-facing room-section filters for a door-style family.
 * Category matching is case-insensitive and accepts both Molding and Moulding.
 */
export function familyTypeMatches(filterKey: string, category: string | null | undefined): boolean {
  const c = (category ?? "").trim().toLowerCase();
  switch (filterKey) {
    case "all":
      return true;
    case "base":
      return c === "base" || c === "corner";
    case "wall":
      return c === "wall";
    case "tall":
      return c === "tall";
    case "vanity":
      return c === "vanity";
    case "ada":
      return c === "ada";
    case "accessory":
      return c === "accessory"
        || c === "accessories"
        || isCatalogMouldingCategory(c)
        || c === "filler's and panels"
        || c === "fillers and panels"
        || c === "specialty";
    default:
      return false;
  }
}
