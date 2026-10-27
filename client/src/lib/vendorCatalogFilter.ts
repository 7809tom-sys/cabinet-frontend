import { catalogCategoryKey } from "@shared/catalogCategory";

export { catalogCategoryKey };

/** Sentinel for "no category filter". Never a real category name, and never falsy. */
export const ALL_CATEGORIES = "__all__";

/**
 * Sections a supplier can use when its products are not a cabinet supply line.
 * Pelican is the current case (sourceKey "pelican", no distributors row).
 */
export const STANDALONE_CATALOG_SECTIONS = [
  "overview",
  "supplier-profile",
  "catalog",
  "shipping",
  "fulfillment",
] as const;

export const STANDALONE_CATALOG_SOURCE_KEY = "pelican";

export type CatalogCategoryOption = { category: string; count: number };

export type VendorAccountIdentity = {
  sourceKey?: string | null;
  linkedDistributor?: { id?: number; code?: string | null } | null;
};

/** API filter value. Empty, null, and the All sentinel clear the filter. Never falls back to the first category. */
export function selectedCatalogCategory(value: string | null | undefined): string | undefined {
  const key = catalogCategoryKey(value);
  if (!key || key === ALL_CATEGORIES) return undefined;
  return key;
}

/** Keep the server's order (the same order Overview uses) and drop blank names. */
export function catalogCategoryOptions(
  rows: Array<{ category?: string | null; count?: number | null }> | null | undefined,
): CatalogCategoryOption[] {
  const seen = new Set<string>();
  const options: CatalogCategoryOption[] = [];
  for (const row of rows ?? []) {
    const category = catalogCategoryKey(row.category);
    if (!category || seen.has(category)) continue;
    seen.add(category);
    const count = Number(row.count ?? 0);
    options.push({ category, count: Number.isFinite(count) ? count : 0 });
  }
  return options;
}

export function vendorSourceKey(vendor: VendorAccountIdentity | null | undefined): string {
  return vendor?.sourceKey?.trim().toLowerCase() ?? "";
}

/** A product catalog that is not a cabinet supply line. Pelican is the current source key. */
export function isStandaloneCatalogVendor(vendor: VendorAccountIdentity | null | undefined): boolean {
  return vendorSourceKey(vendor) === STANDALONE_CATALOG_SOURCE_KEY && !vendor?.linkedDistributor;
}

export function vendorAccountCode(vendor: VendorAccountIdentity): string {
  const code = vendor.linkedDistributor?.code?.trim();
  if (code) return code;
  if (vendorSourceKey(vendor) === STANDALONE_CATALOG_SOURCE_KEY) return "PEL";
  return "PROFILE";
}

/** True only for an approved vendor that has neither a supply line nor its own catalog. */
export function vendorShowsProfileOnly(vendor: VendorAccountIdentity): boolean {
  return !vendor.linkedDistributor && vendorSourceKey(vendor) !== STANDALONE_CATALOG_SOURCE_KEY;
}

/**
 * Keep the open portal section when the destination vendor has that section.
 * A cabinet line keeps any section. A standalone catalog vendor keeps the
 * sections it actually has. A profile-only vendor opens Supplier Profile.
 */
export function portalSectionAfterVendorSwitch(current: string, vendor: VendorAccountIdentity): string {
  if (vendor.linkedDistributor) return current;
  if (isStandaloneCatalogVendor(vendor)) {
    return (STANDALONE_CATALOG_SECTIONS as readonly string[]).includes(current) ? current : "overview";
  }
  return "supplier-profile";
}

/** Accept either a legacy array payload or a paged `{ items, total }` payload. */
export function pagedRows<T>(data: unknown): { items: T[]; total: number | null } {
  if (Array.isArray(data)) return { items: data as T[], total: null };
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    const record = data as { items: T[]; total?: unknown };
    const total = Number(record.total);
    return { items: record.items, total: Number.isFinite(total) ? total : null };
  }
  return { items: [], total: null };
}
