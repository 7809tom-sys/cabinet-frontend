// ─── Countertop fabrication shops: list upload + ZIP matching ────────────────
// Shared by the admin "Fabrication Shops" tab (column mapping + preview in the
// browser), the server (which re-plans every upload against the shops already
// saved before inserting) and the Countertop Quotes tab (which shows the shops
// nearest to each quote's ZIP).
//
// Expected file: "Countertop Fabrication Shops in <State>" with columns name,
// region, city, address, phone, website, google_rating, review_count,
// fabricator_confidence, source. Optional: state, zip, email.
//
// ZIP matching is offline. A shop's point is its own lat/lng when one is saved,
// otherwise the center of its 3-digit ZIP prefix (shared/data/usZip3Centroids).
// A quote's point is the center of its ZIP's 3-digit prefix. So distances are
// approximate (prefix centers are typically 10 to 30 miles from a given
// address); a shop in the quote's exact ZIP is always listed first.

import { approxZipCentroid, haversineMiles, normalizeZip, type LatLng } from "./availability";

export const FAB_SHOP_UPLOAD_MAX_ROWS = 5000;
/** Default search radius around a quote's ZIP. Tom's call; change here. */
export const FAB_SHOP_MATCH_RADIUS_MILES = 50;
/** Default number of shops attached to one countertop quote. Tom's call. */
export const FAB_SHOP_MATCH_LIMIT = 5;
/**
 * Emailing shops from the admin is OFF. When true, a shop that has an email
 * address gets a "Draft email" link that only opens the admin's own mail app;
 * nothing is ever sent by the server.
 */
export const FAB_SHOP_EMAIL_DRAFTS_ENABLED = false;

export const FAB_SHOP_FIELDS = [
  "name",
  "state",
  "zip",
  "city",
  "address",
  "region",
  "phone",
  "email",
  "website",
  "googleRating",
  "reviewCount",
  "confidence",
  "source",
] as const;
export type FabShopField = (typeof FAB_SHOP_FIELDS)[number];

export const FAB_SHOP_FIELD_LABELS: Record<FabShopField, string> = {
  name: "Shop name",
  state: "State",
  zip: "ZIP",
  city: "City",
  address: "Address",
  region: "Region",
  phone: "Phone",
  email: "Email",
  website: "Website",
  googleRating: "Google rating",
  reviewCount: "Review count",
  confidence: "Fabricator confidence",
  source: "Source",
};

const HEADER_ALIASES: Record<FabShopField, string[]> = {
  name: ["name", "shopname", "businessname", "company", "companyname", "business", "shop", "fabricator"],
  state: ["state", "st", "statecode"],
  zip: ["zip", "zipcode", "postalcode", "postcode", "zip5"],
  city: ["city", "town"],
  address: ["address", "streetaddress", "fulladdress", "address1"],
  region: ["region", "area", "metro"],
  phone: ["phone", "telephone", "phonenumber", "tel"],
  email: ["email", "emailaddress", "e-mail"],
  website: ["website", "url", "site", "web", "websiteurl", "homepage"],
  googleRating: ["googlerating", "rating"],
  reviewCount: ["reviewcount", "reviews", "googlereviews"],
  confidence: ["fabricatorconfidence", "confidence"],
  source: ["source", "sources"],
};

export type FabShopColumnMapping = Partial<Record<FabShopField, number>>;
/** One uploaded shop, as plain strings (what the browser sends to the server). */
export type FabShopRow = Partial<Record<FabShopField, string>>;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Best-guess mapping from header names. Each column is used at most once. */
export function guessFabShopColumnMapping(headers: readonly string[]): FabShopColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: FabShopColumnMapping = {};
  for (const field of FAB_SHOP_FIELDS) {
    const index = normalized.findIndex((header, i) => !used.has(i) && HEADER_ALIASES[field].includes(header));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Turn raw spreadsheet rows into field objects using the column mapping. */
export function mapFabShopRows(rows: readonly unknown[][], mapping: FabShopColumnMapping): FabShopRow[] {
  return rows.map((row) => {
    const out: FabShopRow = {};
    for (const field of FAB_SHOP_FIELDS) {
      const index = mapping[field];
      if (index == null) continue;
      const value = cell(row[index]);
      if (value) out[field] = value;
    }
    return out;
  });
}

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", districtofcolumbia: "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", newhampshire: "NH", newjersey: "NJ", newmexico: "NM", newyork: "NY",
  northcarolina: "NC", northdakota: "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  rhodeisland: "RI", southcarolina: "SC", southdakota: "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", westvirginia: "WV", wisconsin: "WI", wyoming: "WY",
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

/** "FL", "fl" or "Florida" -> "FL"; anything else -> null. */
export function normalizeFabShopState(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (STATE_CODES.has(upper)) return upper;
  return STATE_NAMES[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

/** State name in a file name like "Fabrication Shops in Florida.csv" -> "FL". */
export function fabShopStateFromFileName(fileName: string): string | null {
  const clean = fileName.trim().replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const match = clean.match(/\bin\s+([a-z .]+)$/i);
  if (match) return normalizeFabShopState(match[1]);
  for (const word of clean.split(/\s+/).reverse()) {
    const code = word.length === 2 ? normalizeFabShopState(word) : null;
    if (code) return code;
  }
  for (const name of Object.keys(STATE_NAMES)) {
    if (clean.toLowerCase().replace(/[^a-z]/g, "").includes(name)) return STATE_NAMES[name]!;
  }
  return null;
}

/** "2525 Clarcona Rd, Apopka, FL 32703" -> { state: "FL", zip: "32703" }. */
export function parseFabShopAddress(address: string | null | undefined): { state: string | null; zip: string | null } {
  const text = (address ?? "").trim();
  if (!text) return { state: null, zip: null };
  const tail = text.match(/,\s*([A-Za-z]{2})\s*(\d{5})?(?:-\d{4})?\s*(?:,\s*(?:USA|United States))?\s*$/i);
  if (tail) return { state: normalizeFabShopState(tail[1]), zip: tail[2] ?? null };
  const zip = text.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  return { state: null, zip: zip ? zip[1]! : null };
}

const HIDDEN_BRANDS = /pelican|us\s*cabinet\s*depot|\buscd\b|hardware\s*resources|line\s*dl|\bdl\s*cabinetry\b/i;
export function hasHiddenFabBrand(value: string | null | undefined): boolean {
  return HIDDEN_BRANDS.test(value ?? "");
}

export function normalizeFabShopWebsite(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function websiteKey(value: string | null | undefined): string | null {
  const url = normalizeFabShopWebsite(value);
  if (!url) return null;
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function nameKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\b(llc|inc|corp|co|ltd|the)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityKey(city: string | null | undefined, state: string | null | undefined): string {
  return `${(city ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim()}|${state ?? ""}`;
}

/** Duplicate key: same name in the same ZIP, or same name in the same city. */
export function fabShopDedupeKeys(shop: { name: string | null; zip?: string | null; city?: string | null; state?: string | null; website?: string | null }): string[] {
  const keys: string[] = [];
  const name = nameKey(shop.name);
  if (name && shop.zip) keys.push(`nz:${name}|${shop.zip}`);
  if (name && shop.city) keys.push(`nc:${name}|${cityKey(shop.city, shop.state)}`);
  return keys;
}

function boundedNumber(value: string | undefined, max: number, decimals = 0): number | null {
  const number = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!value || !Number.isFinite(number) || number < 0 || number > max) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function clip(value: string | null | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export type FabShopConfidence = "high" | "medium" | "low";

/** What one shop row in the fabrication_shops table holds. */
export type FabShopValues = {
  name: string;
  state: string;
  zip: string | null;
  zip3: string | null;
  /** "address" when the ZIP came from the shop's own address, "city" when borrowed from another shop in the same city. */
  zipSource: "address" | "zip_column" | "city" | null;
  city: string | null;
  address: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  confidence: FabShopConfidence | null;
  source: string | null;
  sourceDoc: string;
};

export type FabShopSkipReason = "missing_name" | "missing_state" | "hidden_brand";

export type ExistingFabShop = { name: string; zip: string | null; city: string | null; state: string | null; website: string | null };

export type FabShopImportPlan = {
  toInsert: FabShopValues[];
  byState: { state: string; toImport: number; duplicates: number; withZip: number }[];
  duplicates: { row: number; name: string; state: string; where: "in_file" | "in_list" }[];
  skipped: { row: number; name: string; reason: FabShopSkipReason }[];
  /** Rows whose ZIP was taken from another shop in the same city (no ZIP in the address). */
  zipFromCity: number;
  /** Rows with no ZIP at all; they only match by state. */
  noZip: number;
};

/**
 * Plan an upload: map each row to a shop, skip rows with no name, no state or a
 * hidden supplier name, and drop duplicates (same name in the same ZIP or city,
 * or the same website in the same city) against the file and the saved list.
 * Adds rows only; never updates or deletes a saved shop.
 */
export function planFabShopImport(
  rows: readonly FabShopRow[],
  existing: readonly ExistingFabShop[],
  options: { sourceDoc: string; defaultState?: string | null },
): FabShopImportPlan {
  const plan: FabShopImportPlan = { toInsert: [], byState: [], duplicates: [], skipped: [], zipFromCity: 0, noZip: 0 };
  const defaultState = normalizeFabShopState(options.defaultState);
  const seen = new Set<string>();
  const seenSites = new Set<string>();
  for (const shop of existing) {
    for (const key of fabShopDedupeKeys(shop)) seen.add(key);
    const site = websiteKey(shop.website);
    if (site && shop.state) seenSites.add(`${site}|${cityKey(shop.city, shop.state)}`);
  }

  // City -> ZIP from the rows that do carry one, so a shop with only a city
  // still gets a ZIP3 point for matching.
  const parsed = rows.map((row) => {
    const fromAddress = parseFabShopAddress(row.address);
    const state = normalizeFabShopState(row.state) ?? fromAddress.state ?? defaultState;
    const zipColumn = normalizeZip(row.zip);
    const zip = zipColumn && /^\d{5}$/.test(zipColumn) ? zipColumn : fromAddress.zip;
    return { row, state, zip, zipSource: (zipColumn ? "zip_column" : fromAddress.zip ? "address" : null) as FabShopValues["zipSource"] };
  });
  const cityZip = new Map<string, string>();
  for (const item of parsed) {
    if (item.zip && item.row.city && item.state) {
      const key = cityKey(item.row.city, item.state);
      if (!cityZip.has(key)) cityZip.set(key, item.zip);
    }
  }

  const stats = new Map<string, { toImport: number; duplicates: number; withZip: number }>();
  const stat = (state: string) => {
    let entry = stats.get(state);
    if (!entry) { entry = { toImport: 0, duplicates: 0, withZip: 0 }; stats.set(state, entry); }
    return entry;
  };

  parsed.forEach((item, index) => {
    const rowNumber = index + 2; // header is row 1
    const name = clip(item.row.name, 256);
    if (!name) { plan.skipped.push({ row: rowNumber, name: "", reason: "missing_name" }); return; }
    if (hasHiddenFabBrand(name)) { plan.skipped.push({ row: rowNumber, name: "(hidden)", reason: "hidden_brand" }); return; }
    if (!item.state) { plan.skipped.push({ row: rowNumber, name, reason: "missing_state" }); return; }

    let zip = item.zip;
    let zipSource = item.zipSource;
    if (!zip && item.row.city) {
      const borrowed = cityZip.get(cityKey(item.row.city, item.state));
      if (borrowed) { zip = borrowed; zipSource = "city"; }
    }
    const website = normalizeFabShopWebsite(item.row.website);
    const shop = { name, zip: zipSource === "city" ? null : zip, city: clip(item.row.city, 128), state: item.state, website };
    const keys = fabShopDedupeKeys(shop);
    const site = websiteKey(website);
    // Same website in the same city is one shop; a chain's other locations stay.
    const siteKey = site ? `${site}|${cityKey(shop.city, item.state)}` : null;
    const duplicate = keys.some((key) => seen.has(key)) || (siteKey != null && seenSites.has(siteKey));
    if (duplicate) {
      const inFile = plan.toInsert.some((other) =>
        fabShopDedupeKeys({ ...other, zip: other.zipSource === "city" ? null : other.zip }).some((key) => keys.includes(key))
        || (siteKey != null && websiteKey(other.website) != null && `${websiteKey(other.website)}|${cityKey(other.city, other.state)}` === siteKey));
      plan.duplicates.push({ row: rowNumber, name, state: item.state, where: inFile ? "in_file" : "in_list" });
      stat(item.state).duplicates += 1;
      return;
    }
    for (const key of keys) seen.add(key);
    if (siteKey) seenSites.add(siteKey);

    const confidence = (item.row.confidence ?? "").trim().toLowerCase();
    const values: FabShopValues = {
      name,
      state: item.state,
      zip: zip ?? null,
      zip3: zip ? zip.slice(0, 3) : null,
      zipSource: zip ? zipSource : null,
      city: shop.city,
      address: clip(item.row.address, 512),
      region: clip(item.row.region, 128),
      phone: clip(item.row.phone, 32),
      email: clip(item.row.email && /@/.test(item.row.email) ? item.row.email : null, 320),
      website: website ? website.slice(0, 512) : null,
      googleRating: boundedNumber(item.row.googleRating, 5, 1),
      reviewCount: boundedNumber(item.row.reviewCount, 1_000_000),
      confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : null,
      source: clip(item.row.source, 1000),
      sourceDoc: options.sourceDoc.trim().slice(0, 200),
    };
    if (values.zipSource === "city") plan.zipFromCity += 1;
    if (!values.zip) plan.noZip += 1;
    plan.toInsert.push(values);
    const entry = stat(item.state);
    entry.toImport += 1;
    if (values.zip) entry.withZip += 1;
  });

  plan.byState = Array.from(stats.entries())
    .map(([state, entry]) => ({ state, ...entry }))
    .sort((a, b) => a.state.localeCompare(b.state));
  return plan;
}

// ─── Matching a quote's ZIP to shops ─────────────────────────────────────────

export type MatchableFabShop = {
  id: number;
  state: string | null;
  zip: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  confidence?: string | null;
  isActive?: boolean | null;
};

export type FabShopMatch<T extends MatchableFabShop = MatchableFabShop> = {
  shop: T;
  /** Approximate miles between the quote ZIP and the shop; null for a state-only match. */
  distanceMiles: number | null;
  method: "same_zip" | "distance" | "state";
};

export function fabShopPoint(shop: MatchableFabShop): LatLng | null {
  const lat = Number(shop.lat);
  const lng = Number(shop.lng);
  if (shop.lat != null && shop.lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return approxZipCentroid(shop.zip);
}

/** The state a 5-digit ZIP belongs to, from the shops that share its 3-digit prefix. */
function stateForZip(zip5: string, shops: readonly MatchableFabShop[]): string | null {
  const prefix = zip5.slice(0, 3);
  return shops.find((shop) => shop.zip?.slice(0, 3) === prefix && shop.state)?.state ?? null;
}

const CONFIDENCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Shops for one quote ZIP: shops in the exact ZIP first, then every shop whose
 * point is within the radius, nearest first (ties go to higher fabricator
 * confidence). When nothing is within the radius, fall back to shops in the
 * same state (by distance when known), so a quote is never left empty while the
 * state has shops. Inactive shops are never matched.
 */
export function matchFabShopsForZip<T extends MatchableFabShop>(
  zip: string | null | undefined,
  shops: readonly T[],
  options: { radiusMiles?: number; limit?: number; state?: string | null } = {},
): FabShopMatch<T>[] {
  const radius = options.radiusMiles ?? FAB_SHOP_MATCH_RADIUS_MILES;
  const limit = options.limit ?? FAB_SHOP_MATCH_LIMIT;
  const zip5 = normalizeZip(zip);
  const active = shops.filter((shop) => shop.isActive !== false);
  if (!zip5) return [];
  const origin = approxZipCentroid(zip5);
  const rank = (shop: T) => CONFIDENCE_RANK[(shop.confidence ?? "").toLowerCase()] ?? 3;

  const scored = active.map((shop) => {
    const point = fabShopPoint(shop);
    const distanceMiles = origin && point ? Math.round(haversineMiles(origin, point) * 10) / 10 : null;
    return { shop, distanceMiles, sameZip: shop.zip === zip5 };
  });
  const byDistance = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    Number(b.sameZip) - Number(a.sameZip)
    || (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)
    || rank(a.shop) - rank(b.shop)
    || a.shop.id - b.shop.id;

  const near = scored
    .filter((item) => item.sameZip || (item.distanceMiles != null && item.distanceMiles <= radius))
    .sort(byDistance)
    .slice(0, limit)
    .map((item): FabShopMatch<T> => ({ shop: item.shop, distanceMiles: item.distanceMiles, method: item.sameZip ? "same_zip" : "distance" }));
  if (near.length > 0) return near;

  const state = normalizeFabShopState(options.state) ?? stateForZip(zip5, active);
  if (!state) return [];
  return scored
    .filter((item) => item.shop.state === state)
    .sort(byDistance)
    .slice(0, limit)
    .map((item): FabShopMatch<T> => ({ shop: item.shop, distanceMiles: item.distanceMiles, method: "state" }));
}
