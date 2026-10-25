/**
 * Pure, framework-free helpers for the Tawk.to live-chat integration.
 * Kept separate from the browser loader so the logic is unit-testable.
 */

export function normalizeWidgetId(widgetId?: string | null): string {
  const w = (widgetId ?? "").trim();
  return w.length > 0 ? w : "default";
}

export function isTawkConfigured(propertyId?: string | null): boolean {
  return Boolean((propertyId ?? "").trim());
}

/**
 * Build the Tawk.to embed script URL. Returns null when not configured so
 * callers can no-op gracefully.
 */
export function buildTawkEmbedUrl(
  propertyId?: string | null,
  widgetId?: string | null,
): string | null {
  const pid = (propertyId ?? "").trim();
  if (!pid) return null;
  return `https://embed.tawk.to/${pid}/${normalizeWidgetId(widgetId)}`;
}
