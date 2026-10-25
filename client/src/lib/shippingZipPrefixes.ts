/**
 * Freight estimator zones retain their existing comma-delimited storage format.
 * These helpers make that legacy format safe to edit as a list of ZIP codes or
 * leading ZIP prefixes.
 */
export function normalizeZipPrefix(value: string): string {
  return value.trim().replace(/\D/g, "").slice(0, 5);
}

export function isValidZipPrefix(value: string): boolean {
  return /^\d{1,5}$/.test(value);
}

export function parseZipPrefixes(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map(normalizeZipPrefix)
    .filter((zip) => isValidZipPrefix(zip) && !seen.has(zip) && Boolean(seen.add(zip)));
}

export function serializeZipPrefixes(zipPrefixes: string[]): string {
  return parseZipPrefixes(zipPrefixes.join(",")).join(",");
}
