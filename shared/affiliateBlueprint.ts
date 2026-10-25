export const REAVES_WAY_AFFILIATE_BLUEPRINT = {
  template: "showcase" as const,
  primaryColor: "#1ceb31",
  accentColor: "#0000ff",
  buttonRadius: "9999px",
  defaultMarkupBps: 5500,
} as const;

/**
 * Future affiliates inherit Reaves Way's approved storefront structure and
 * commercial defaults. Store-specific identity (name, slug, logo, contact and
 * copy) is intentionally supplied separately rather than copied from Reaves.
 */
export function reavesWayAffiliateDefaults() {
  return { ...REAVES_WAY_AFFILIATE_BLUEPRINT };
}
