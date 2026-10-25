/**
 * Returns the public-facing display name for a door style.
 *
 * Priority: aliasName → ourName → styleCode
 *
 * - aliasName: the white-label name set in CD_STANDARDS (e.g. "Lumina White")
 * - ourName:   the internal platform name (e.g. "Lumina White")
 * - styleCode: fallback code (e.g. "ASP")
 *
 * Use this everywhere a door style name is shown to customers or in the designer.
 * Admin panels may show ourName directly for clarity.
 */
export function styleDisplayName(style: {
  aliasName?: string | null;
  ourName?: string | null;
  styleCode?: string | null;
}): string {
  const raw = style.aliasName || style.ourName || style.styleCode || "";
  return raw.replace(/\s+\([^)]*\)\s*$/, "").trim() || style.styleCode || "";
}
