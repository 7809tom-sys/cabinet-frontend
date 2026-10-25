import { isGlassPolicyNomenclature } from "@/lib/glassPolicy";

export type CartGlassPolicyItem = {
  masterCode: string;
  glassIncluded?: boolean | null;
};

/**
 * A distributor's inclusion policy matters only for nomenclature that actually
 * contains a glass door or panel. Absence of policy data is intentionally not
 * treated as a warning: old cart snapshots remain valid until their supplier
 * row is refreshed, while an explicit false value is a clear customer notice.
 */
export function requiresSeparateGlassPurchase(item: CartGlassPolicyItem): boolean {
  return item.glassIncluded === false && isGlassPolicyNomenclature(item.masterCode);
}

export function separateGlassPurchaseItems<T extends CartGlassPolicyItem>(items: readonly T[]): T[] {
  return items.filter(requiresSeparateGlassPurchase);
}
