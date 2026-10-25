/**
 * The Design Tool persists a title-case tier in browser drafts and saved plans.
 * Older drafts used `retail`, which meant the public/homeowner tier.  Leaving
 * that unsupported string in state made the UI fall through to its Contractor
 * label while the shared resolver fell through to a Homeowner price.
 */
export type DesignPricingTier = "Wholesale" | "Contractor" | "Homeowner";

export function normalizeDesignPricingTier(
  value: unknown,
  fallback: DesignPricingTier = "Homeowner",
): DesignPricingTier {
  if (typeof value !== "string") return fallback;
  switch (value.trim().toLowerCase()) {
    case "wholesale":
      return "Wholesale";
    case "contractor":
      return "Contractor";
    case "homeowner":
    case "retail":
      // `retail` was the old persisted name for the public/homeowner tier.
      return "Homeowner";
    default:
      return fallback;
  }
}
