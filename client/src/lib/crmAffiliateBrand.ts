export type CrmAffiliateBrand = {
  storeName: string;
  primaryColor: string | null;
  accentColor: string | null;
};

const FALLBACK_AFFILIATE_COLOR = "#1a2b4a";

export function affiliateCardColor(brand?: CrmAffiliateBrand): string | undefined {
  if (!brand) return undefined;
  const candidate = brand.primaryColor?.trim();
  return /^#[0-9a-f]{6}$/i.test(candidate ?? "")
    ? candidate!
    : FALLBACK_AFFILIATE_COLOR;
}
