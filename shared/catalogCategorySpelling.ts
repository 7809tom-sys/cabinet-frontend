/**
 * Catalog category and subcategory spelling.
 *
 * The corrected spreadsheet uses British "Moulding". Live rows may still say
 * "Molding", "Trim and Molding", "Trim & Molding", or "Moldings & Trim".
 * Comparisons fold both spellings, including plurals, and ignore case.
 * Canonical labels use "Moulding".
 */

export const CATALOG_CATEGORY_MOULDING = "Moulding";
export const CATALOG_SUBCATEGORY_TRIM_AND_MOULDING = "Trim & Moulding";
export const CATALOG_SUBCATEGORY_MOULDINGS_AND_TRIM = "Mouldings & Trim";

const TRIM_AND_MOULDING = new Set(["trim & moulding", "trim and moulding"]);

/** Lowercase, collapse whitespace, and fold molding/moldings onto moulding/mouldings. */
export function normalizeCatalogCategoryValue(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/moldings?/g, (word) => (word.endsWith("s") ? "mouldings" : "moulding"));
}

export function catalogCategoryValuesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeCatalogCategoryValue(left);
  const b = normalizeCatalogCategoryValue(right);
  return a.length > 0 && a === b;
}

/** Rewrite Molding/Moldings to Moulding/Mouldings, keeping each word's original casing. */
export function canonicalMouldingLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/moldings?/gi, (match) => mouldingWord(match, true));
}

/**
 * The other accepted spelling of a category value, or null when the text
 * does not name moulding. "Molding" becomes "Moulding", and the reverse.
 */
export function alternateCatalogMouldingSpelling(value: string | null | undefined): string | null {
  if (!value || !/mouldings?|moldings?/i.test(value)) return null;
  if (/moldings?/i.test(value)) {
    const canonical = canonicalMouldingLabel(value);
    return canonical === value ? null : canonical;
  }
  const alternate = value.replace(/mouldings?/gi, (match) => mouldingWord(match, false));
  return alternate === value ? null : alternate;
}

export function isCatalogMouldingCategory(value: string | null | undefined): boolean {
  const normalized = normalizeCatalogCategoryValue(value);
  return normalized === "moulding"
    || TRIM_AND_MOULDING.has(normalized)
    || normalized === "mouldings & trim";
}

export function isTrimAndMouldingSubcategory(value: string | null | undefined): boolean {
  return TRIM_AND_MOULDING.has(normalizeCatalogCategoryValue(value));
}

export function isFlooringMouldingsAndTrim(value: string | null | undefined): boolean {
  return normalizeCatalogCategoryValue(value) === "mouldings & trim";
}

/** Sum counts stored under either spelling of the same category. */
export function catalogCategoryCount(
  counts: Readonly<Record<string, number>> | null | undefined,
  category: string,
): number {
  if (!counts) return 0;
  const target = normalizeCatalogCategoryValue(category);
  if (!target) return 0;
  let total = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (normalizeCatalogCategoryValue(key) === target) total += count;
  }
  return total;
}

/**
 * Category string to send to an exact server filter. Prefer the requested
 * spelling when it has rows; otherwise use the stored alternate spelling.
 */
export function catalogCategoryQueryValue(
  counts: Readonly<Record<string, number>> | null | undefined,
  category: string,
): string {
  if (!counts) return category;
  if ((counts[category] ?? 0) > 0) return category;
  const target = normalizeCatalogCategoryValue(category);
  for (const [key, count] of Object.entries(counts)) {
    if (count > 0 && normalizeCatalogCategoryValue(key) === target) return key;
  }
  return category;
}

export function catalogCategoryRecordValue<T>(
  record: Readonly<Record<string, T>>,
  category: string | null | undefined,
): T | undefined {
  if (!category) return undefined;
  if (Object.prototype.hasOwnProperty.call(record, category)) return record[category];
  const target = normalizeCatalogCategoryValue(category);
  const key = Object.keys(record).find((candidate) => normalizeCatalogCategoryValue(candidate) === target);
  return key ? record[key] : undefined;
}

/** Option value that matches the stored category, accepting either spelling. */
export function selectedCatalogOption(
  options: readonly string[],
  current: string | null | undefined,
): string | undefined {
  if (!current) return undefined;
  return options.find((option) => option === current)
    ?? options.find((option) => catalogCategoryValuesEqual(option, current));
}

function mouldingWord(match: string, british: boolean): string {
  const plural = /s$/i.test(match);
  const base = british
    ? (plural ? "mouldings" : "moulding")
    : (plural ? "moldings" : "molding");
  if (match === match.toUpperCase()) return base.toUpperCase();
  if (match[0] === match[0].toLowerCase()) return base;
  return base[0].toUpperCase() + base.slice(1);
}
