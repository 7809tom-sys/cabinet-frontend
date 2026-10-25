import { styleDisplayName } from "@/lib/styleDisplayName";

export type AffiliateStyleNameSource = {
  id: number;
  ourName?: string | null;
  aliasName?: string | null;
  styleCode?: string | null;
};

/**
 * Resolves the customer-visible name for one storefront without changing the
 * shared master style record. An affiliate override wins only when its own
 * style-name map is explicitly supplied.
 */
export function affiliateStyleName(
  style: AffiliateStyleNameSource | null | undefined,
  styleNames?: Record<number, string>
): string {
  if (!style) return "";
  const affiliateAlias = styleNames?.[style.id]?.trim();
  return affiliateAlias || styleDisplayName(style) || style.ourName || style.styleCode || `Style #${style.id}`;
}
