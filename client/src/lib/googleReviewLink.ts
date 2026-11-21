/**
 * CabinetDealz Google Business Profile write-a-review URL.
 * Leave empty until the exact URL is confirmed. The footer link is hidden
 * when this value is empty so a broken or guessed link never ships.
 */
export const GOOGLE_REVIEW_URL = (
  import.meta.env.VITE_GOOGLE_REVIEW_URL ?? ""
).trim();

export function isGoogleReviewUrlConfigured(): boolean {
  return GOOGLE_REVIEW_URL.length > 0;
}
