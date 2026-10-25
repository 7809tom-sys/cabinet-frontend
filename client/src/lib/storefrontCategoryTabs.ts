export const STOREFRONT_CATEGORY_TAB_ORDER = [
  "Base",
  "Wall",
  "Corner",
  "Tall",
  "Filler",
  "Panels",
  "Wall Skin / Scribe Veneer",
  "Molding",
  "Accessory",
  "Vanity",
] as const;

const DISPLAY_LABELS: Readonly<Record<string, string>> = {
  "Wall Skin / Scribe Veneer": "Wall Skins",
  Accessory: "Accessories",
};

function normalizedCategory(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const TAB_RANK = new Map(
  STOREFRONT_CATEGORY_TAB_ORDER.map((category, index) => [normalizedCategory(category), index]),
);

/**
 * Keep the locked storefront's category navigation in the cabinet-buying order
 * established by CabinetDealz. Categories not in the intentional sequence are
 * retained and placed after the known tabs so an imported line cannot disappear.
 */
export function sortStorefrontCategoryTabs(categories: readonly string[]): string[] {
  return Array.from(new Set(categories.map((category) => category.trim()).filter(Boolean)))
    .sort((left, right) => {
      const leftRank = TAB_RANK.get(normalizedCategory(left)) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = TAB_RANK.get(normalizedCategory(right)) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.localeCompare(right);
    });
}

/** Public button wording can be concise without changing the exact DB filter. */
export function storefrontCategoryTabLabel(category: string): string {
  return DISPLAY_LABELS[category] ?? category;
}
