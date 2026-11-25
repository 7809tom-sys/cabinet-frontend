// ─── Admin CRM cabinet shop list upload (CSV / XLSX) ─────────────────────────
// Shared by the CRM "Upload shops" dialog (column mapping + preview in the
// browser) and the server (which re-plans every upload against the house CRM
// before inserting). The expected file is the affiliate library spreadsheet
// "Cabinet Shops in <State>": name, region, city, address, phone, website,
// google_rating, review_count, type, brands_carried, rta_competitor,
// confidence, source. Extra optional columns: state, email, platform,
// site_quality, mobile_pagespeed.
//
// Each shop becomes a house CRM row (affiliateId NULL, stage new, company
// "Cabinet shop prospect") whose notes start with a cabinet_shop_list_<date>
// marker and carry "State: XX" and "Website: https://..." lines, so it shows
// in the Cabinet Shops view with the same site comparison as distributors.
// Site stats are only written when the file really has them.

export const CABINET_SHOP_COMPANY = "Cabinet shop prospect";
export const CABINET_SHOP_MARKER_PREFIX = "cabinet_shop_list_";
export const CABINET_SHOP_UPLOAD_MAX_ROWS = 5000;

export const CABINET_SHOP_FIELDS = [
  "name",
  "state",
  "city",
  "address",
  "region",
  "phone",
  "email",
  "website",
  "type",
  "googleRating",
  "reviewCount",
  "brandsCarried",
  "rtaCompetitor",
  "confidence",
  "platform",
  "siteQuality",
  "mobilePageSpeed",
  "source",
] as const;
export type CabinetShopField = (typeof CABINET_SHOP_FIELDS)[number];

export const CABINET_SHOP_FIELD_LABELS: Record<CabinetShopField, string> = {
  name: "Shop name",
  state: "State",
  city: "City",
  address: "Address",
  region: "Region",
  phone: "Phone",
  email: "Email",
  website: "Website",
  type: "Business type",
  googleRating: "Google rating",
  reviewCount: "Review count",
  brandsCarried: "Brands carried",
  rtaCompetitor: "RTA competitor",
  confidence: "Confidence",
  platform: "Site platform",
  siteQuality: "Site quality (0-10)",
  mobilePageSpeed: "Mobile PageSpeed (0-100)",
  source: "Source",
};

const HEADER_ALIASES: Record<CabinetShopField, string[]> = {
  name: ["name", "shopname", "businessname", "company", "companyname", "business", "shop"],
  state: ["state", "st", "statecode"],
  city: ["city", "town"],
  address: ["address", "streetaddress", "fulladdress", "address1"],
  region: ["region", "area", "metro"],
  phone: ["phone", "telephone", "phonenumber", "tel"],
  email: ["email", "emailaddress", "e-mail"],
  website: ["website", "url", "site", "web", "websiteurl", "homepage"],
  type: ["type", "businesstype", "category"],
  googleRating: ["googlerating", "rating"],
  reviewCount: ["reviewcount", "reviews", "googlereviews"],
  brandsCarried: ["brandscarried", "brands"],
  rtaCompetitor: ["rtacompetitor", "rta"],
  confidence: ["confidence"],
  platform: ["platform", "siteplatform"],
  siteQuality: ["sitequality", "quality"],
  mobilePageSpeed: ["mobilepagespeed", "pagespeedmobile", "mobilepsi", "psimobile"],
  source: ["source", "sources"],
};

export type CabinetShopColumnMapping = Partial<Record<CabinetShopField, number>>;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Best-guess mapping from header names. Each column is used at most once. */
export function guessCabinetShopColumnMapping(headers: readonly string[]): CabinetShopColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: CabinetShopColumnMapping = {};
  for (const field of CABINET_SHOP_FIELDS) {
    const index = normalized.findIndex((header, i) => !used.has(i) && HEADER_ALIASES[field].includes(header));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

/** One uploaded shop, as plain strings (what the browser sends to the server). */
export type CabinetShopRow = Partial<Record<CabinetShopField, string>>;

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Turn raw spreadsheet rows into field objects using the column mapping. */
export function mapCabinetShopRows(rows: readonly unknown[][], mapping: CabinetShopColumnMapping): CabinetShopRow[] {
  return rows.map((row) => {
    const out: CabinetShopRow = {};
    for (const field of CABINET_SHOP_FIELDS) {
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
export function normalizeStateCode(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (STATE_CODES.has(upper)) return upper;
  return STATE_NAMES[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

/** State name in a file name like "Cabinet Shops in Florida.xlsx" -> "FL". */
export function stateFromFileName(fileName: string): string | null {
  const clean = fileName.trim().replace(/_/g, " ");
  const match = /\bin\s+([A-Za-z .]+?)(?:\s+[0-9a-f]{6,})?(?:\s*\(.*\))?\.(?:csv|xlsx|xls|txt)$/i.exec(clean);
  return match ? normalizeStateCode(match[1]) : null;
}

const ADDRESS_STATE = /,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/;

/** Row state: State column, else ", FL 32714" at the end of the address, else the default. */
export function cabinetShopRowState(row: CabinetShopRow, defaultState?: string | null): string | null {
  const explicit = normalizeStateCode(row.state);
  if (explicit) return explicit;
  const fromAddress = ADDRESS_STATE.exec(row.address ?? "")?.[1];
  if (fromAddress && STATE_CODES.has(fromAddress)) return fromAddress;
  return normalizeStateCode(defaultState ?? null);
}

/** "www.example.com" -> "https://www.example.com/" ; junk -> null. */
export function normalizeShopWebsite(value: string | null | undefined): string | null {
  let raw = (value ?? "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Website match key: host without "www.", lower case. */
export function shopWebsiteKey(value: string | null | undefined): string | null {
  const url = normalizeShopWebsite(value);
  if (!url) return null;
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** Name + state match key: letters and digits only, lower case. */
export function shopNameStateKey(name: string | null | undefined, state: string | null | undefined): string | null {
  const cleanName = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!cleanName || !state) return null;
  return `${cleanName}|${state.toUpperCase()}`;
}

// Supplier names that are never shown anywhere in the app. A shop whose name
// carries one is left out of the upload, and they are dropped from brand lists.
const HIDDEN_BRANDS = /pelican|us\s*cabinet\s*depot|\buscd\b|hardware\s*resources|line\s*dl|\bdl\s*cabinetry\b/i;

export function hasHiddenBrand(value: string | null | undefined): boolean {
  return HIDDEN_BRANDS.test(value ?? "");
}

function visibleBrands(value: string | undefined): string | null {
  const brands = (value ?? "").split(/[;,]/).map((brand) => brand.trim()).filter((brand) => brand && !hasHiddenBrand(brand));
  return brands.length ? brands.join("; ") : null;
}

function boundedInt(value: string | undefined, max: number): number | null {
  const match = /^\s*(\d{1,3})(?:\s*\/\s*\d+)?\s*$/.exec(value ?? "");
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 0 && n <= max ? n : null;
}

/** Marker for an upload made on a given day, e.g. cabinet_shop_list_2026-11-25. */
export function cabinetShopMarker(isoDate: string): string {
  return `${CABINET_SHOP_MARKER_PREFIX}${isoDate.slice(0, 10)}`;
}

export type CabinetShopDealValues = {
  title: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  company: string;
  location: string;
  state: string;
  notes: string;
};

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** The crm_deals values for one shop. Notes line format matches the distributor import. */
export function buildCabinetShopDeal(
  row: CabinetShopRow,
  state: string,
  options: { marker: string; sourceDoc: string },
): CabinetShopDealValues {
  const name = clip(row.name ?? "", 200);
  const city = row.city ?? "";
  const location = city ? `${city}, ${state}` : state;
  const website = normalizeShopWebsite(row.website);
  const quality = boundedInt(row.siteQuality, 10);
  const mobile = boundedInt(row.mobilePageSpeed, 100);
  const brands = visibleBrands(row.brandsCarried);
  const lines = [
    options.marker,
    `Location: ${location} | State: ${state}${row.region ? ` | Region: ${row.region}` : ""}`,
  ];
  if (row.address) lines.push(`Address: ${row.address}`);
  if (row.type) lines.push(`Business type: ${row.type}`);
  if (website) lines.push(`Website: ${website}`);
  if (row.phone) lines.push(`Phone: ${row.phone}`);
  if (row.email) lines.push(`Email: ${row.email}`);
  if (row.platform) lines.push(`Platform: ${row.platform}`);
  if (quality != null || mobile != null) {
    lines.push([quality != null ? `Site quality: ${quality}/10` : null, mobile != null ? `Mobile PageSpeed: ${mobile}/100` : null].filter(Boolean).join(" | "));
  }
  if (row.googleRating) lines.push(`Google rating: ${row.googleRating}${row.reviewCount ? ` (${row.reviewCount} reviews)` : ""}`);
  if (brands) lines.push(`Brands carried: ${brands}`);
  if (row.rtaCompetitor) lines.push(`RTA competitor: ${row.rtaCompetitor}`);
  if (row.confidence) lines.push(`Confidence: ${row.confidence}`);
  lines.push(`Source library doc: ${options.sourceDoc}`);
  if (row.source && !hasHiddenBrand(row.source)) lines.push(`Source: ${row.source}`);
  return {
    title: clip(`${CABINET_SHOP_COMPANY} — ${name} (${location})`, 256),
    contactName: name,
    contactPhone: row.phone ? clip(row.phone, 32) : null,
    contactEmail: row.email ? clip(row.email, 320) : null,
    company: CABINET_SHOP_COMPANY,
    location: clip(location, 256),
    state,
    notes: lines.join("\n"),
  };
}

/** A cabinet shop already in the house CRM, reduced to its match keys. */
export type ExistingCabinetShop = { contactName: string | null; notes: string | null };

export type CabinetShopSkipReason = "missing_name" | "missing_state" | "hidden_brand";
export type CabinetShopDuplicate = { row: number; name: string; state: string; where: "in_file" | "in_crm"; match: "name_state" | "website" };

export type CabinetShopStatePlan = { state: string; toImport: number; duplicates: number };

export type CabinetShopImportPlan = {
  toInsert: CabinetShopDealValues[];
  duplicates: CabinetShopDuplicate[];
  skipped: { row: number; name: string; reason: CabinetShopSkipReason }[];
  byState: CabinetShopStatePlan[];
};

const NOTES_STATE = /(?:^|\n|\|)\s*State:\s*([A-Za-z]{2})\b/;
const NOTES_WEBSITE = /\bWebsite:\s*(https?:\/\/[^\s|;,<>"'`]+)/i;

/** FL and GA first, then A to Z. */
export function compareShopStates(a: string, b: string): number {
  const rank = (s: string) => (s === "FL" ? 0 : s === "GA" ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * Decide which uploaded rows become new CRM rows. A row is a duplicate when its
 * name + state or its website host matches an earlier row in the file or a
 * cabinet shop already in the CRM, so uploading the same file twice adds nothing.
 */
export function planCabinetShopImport(
  rows: readonly CabinetShopRow[],
  existing: readonly ExistingCabinetShop[],
  options: { marker: string; sourceDoc: string; defaultState?: string | null },
): CabinetShopImportPlan {
  const crmNames = new Set<string>();
  const crmSites = new Set<string>();
  for (const shop of existing) {
    const state = normalizeStateCode(NOTES_STATE.exec(shop.notes ?? "")?.[1]);
    const nameKey = shopNameStateKey(shop.contactName, state);
    if (nameKey) crmNames.add(nameKey);
    const siteKey = shopWebsiteKey(NOTES_WEBSITE.exec(shop.notes ?? "")?.[1]);
    if (siteKey) crmSites.add(siteKey);
  }
  const fileNames = new Set<string>();
  const fileSites = new Set<string>();
  const plan: CabinetShopImportPlan = { toInsert: [], duplicates: [], skipped: [], byState: [] };
  const perState = new Map<string, CabinetShopStatePlan>();
  const bump = (state: string, key: "toImport" | "duplicates") => {
    const entry = perState.get(state) ?? { state, toImport: 0, duplicates: 0 };
    entry[key] += 1;
    perState.set(state, entry);
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1 in the spreadsheet
    const name = (row.name ?? "").trim();
    if (!name) { plan.skipped.push({ row: rowNumber, name: "", reason: "missing_name" }); return; }
    if (hasHiddenBrand(name)) { plan.skipped.push({ row: rowNumber, name: "(hidden)", reason: "hidden_brand" }); return; }
    const state = cabinetShopRowState(row, options.defaultState);
    if (!state) { plan.skipped.push({ row: rowNumber, name, reason: "missing_state" }); return; }
    const nameKey = shopNameStateKey(name, state)!;
    const siteKey = shopWebsiteKey(row.website);
    let duplicate: CabinetShopDuplicate | null = null;
    if (crmNames.has(nameKey)) duplicate = { row: rowNumber, name, state, where: "in_crm", match: "name_state" };
    else if (siteKey && crmSites.has(siteKey)) duplicate = { row: rowNumber, name, state, where: "in_crm", match: "website" };
    else if (fileNames.has(nameKey)) duplicate = { row: rowNumber, name, state, where: "in_file", match: "name_state" };
    else if (siteKey && fileSites.has(siteKey)) duplicate = { row: rowNumber, name, state, where: "in_file", match: "website" };
    if (duplicate) {
      plan.duplicates.push(duplicate);
      bump(state, "duplicates");
      return;
    }
    fileNames.add(nameKey);
    if (siteKey) fileSites.add(siteKey);
    plan.toInsert.push(buildCabinetShopDeal(row, state, options));
    bump(state, "toImport");
  });

  plan.byState = Array.from(perState.values()).sort((a, b) => compareShopStates(a.state, b.state));
  return plan;
}
