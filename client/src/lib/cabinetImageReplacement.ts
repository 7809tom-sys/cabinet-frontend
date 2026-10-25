/**
 * A changed catalog image must ask whether to replace the current distributor
 * line only or every line. First-time image assignment can be saved directly.
 */
export function requiresImageReplacementScope(
  existingUrl: string | null | undefined,
  nextUrl: string | null | undefined,
): boolean {
  return Boolean(existingUrl && nextUrl && existingUrl !== nextUrl);
}
