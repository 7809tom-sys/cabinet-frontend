/**
 * A distributor-level glass policy applies only to glass nomenclature. Normalize
 * separator variants so W2430GD, W-24-30-GD, and W2430-G behave identically.
 */
export function isGlassPolicyNomenclature(masterCode: string | null | undefined): boolean {
  const code = (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /(?:PG|GD|G)$/.test(code);
}

export type GlassPolicyDisclosure = {
  included: boolean;
  label: "Glass included" | "Glass purchased separately";
  tooltip: string;
};

/** Returns the customer-facing disclosure for a glass-policy product, or null for ordinary products. */
export function glassPolicyForProduct(
  masterCode: string | null | undefined,
  glassIncluded: boolean | null | undefined,
): GlassPolicyDisclosure | null {
  if (!isGlassPolicyNomenclature(masterCode)) return null;
  if (glassIncluded === true) {
    return {
      included: true,
      label: "Glass included",
      tooltip: "The selected distributor includes the glass insert with this cabinet.",
    };
  }
  return {
    included: false,
    label: "Glass purchased separately",
    tooltip: "The selected distributor sells the cabinet or door without the glass insert. Purchase the glass separately.",
  };
}
