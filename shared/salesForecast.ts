/**
 * Saved-design sales forecast. Quantities come from the shared takeoff
 * extractor. This module applies filters, close-rate weight, supplier
 * isolation, and the read-time retail value.
 *
 * Age is days since kitchen_designs.updatedAt.
 * Ordered designs (order submitted/confirmed, or paidAt) and CRM lost deals
 * are excluded from the projection and counted separately.
 * CRM won, not yet ordered, is included at 100%.
 * Draft and cancelled orders stay on the age-based rate.
 */

import { ageDaysFromUpdatedAt, closeRateFraction, type CloseRateBracket } from "./closeRateBrackets";
import { retailFromWholesale } from "./margins";
import { parseVendorScope, type VendorScope } from "./vendorFulfillment";

export type ForecastLine = {
  designId: number;
  scope: VendorScope | null;
  sku: string;
  description: string;
  supplierName: string | null;
  category: string;
  color: string;
  styleName: string;
  seriesName: string;
  quantity: number;
  estimated: boolean;
  note?: string;
  listPrice: number | null;
  /** Vendor cost. distributor_skus.vendorWholesale or pelican_products.vendorWholesale. */
  vendorWholesale: number | null;
  vendorMarkupPercent?: number | null;
  categoryMarkupBps?: number | null;
  /** True when neither the design line nor a linked product has a category. */
  categoryMissing?: boolean;
  catalogProductKind?: "pelican" | "cabinet_sku" | null;
  catalogProductId?: number | null;
};

export type ForecastDesignMeta = {
  id: number;
  name: string;
  updatedAt: Date | string | number;
  customerName: string | null;
  styleName: string;
  color: string;
  seriesName: string;
  customerType: string;
  status: "saved" | "quoted" | "ordered" | "won" | "lost" | "draft" | "cancelled";
  /** True when an order is submitted/confirmed or paidAt is set. */
  ordered: boolean;
  /** CRM stage when a deal is linked. */
  crmStage: string | null;
};

export type ForecastFilters = {
  doorStyles?: string[];
  colors?: string[];
  series?: string[];
  /** Product type / category. Use MISSING_CATEGORY_FILTER for rows with no linked category. */
  categories?: string[];
  /** Case-insensitive match on SKU, description, supplier name, or category. */
  query?: string | null;
  supplierScopes?: string[];
  savedFrom?: string | null;
  savedTo?: string | null;
  statuses?: string[];
  customerTypes?: string[];
};

/** Sentinel stored in the category filter, never written onto a product. */
export const MISSING_CATEGORY_FILTER = "__missing_category__";
export const MISSING_CATEGORY_LABEL = "No product category on file";

export type ForecastTimePreset = "all" | "2m" | "3m" | "custom";

export type VendorForecastRateInput = {
  scope: string;
  /** Null means the vendor has not entered a percentage. */
  percent: number | null;
};

export function isMissingProductCategory(category: string | null | undefined, categoryMissing = false): boolean {
  if (categoryMissing) return true;
  const text = (category ?? "").trim();
  return text.length === 0 || text.toLowerCase() === "unspecified";
}

export function categoryFilterValue(category: string | null | undefined, categoryMissing = false): string {
  return isMissingProductCategory(category, categoryMissing) ? MISSING_CATEGORY_FILTER : (category ?? "").trim();
}

/**
 * Calendar months before `now`, clamped to the last valid day of the target
 * month. Last 2 months from 2026-04-15 is 2026-02-15. Last 1 month from
 * 2026-03-31 is 2026-02-28, not March.
 */
export function monthsBefore(now: Date, months: number): Date {
  const from = new Date(now.getTime());
  const day = from.getUTCDate();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate();
  from.setUTCDate(Math.min(day, lastDay));
  return from;
}

/** Relative presets stay relative. Custom uses the caller's from/to dates. */
export function savedRangeForPreset(
  preset: ForecastTimePreset,
  now: Date,
  custom?: { from?: string | null; to?: string | null },
): { savedFrom: string | null; savedTo: string | null } {
  if (preset === "2m" || preset === "3m") {
    return { savedFrom: monthsBefore(now, preset === "2m" ? 2 : 3).toISOString(), savedTo: null };
  }
  if (preset === "custom") {
    return { savedFrom: custom?.from?.trim() || null, savedTo: custom?.to?.trim() || null };
  }
  return { savedFrom: null, savedTo: null };
}

export function designUpdatedOnOrAfter(updatedAt: Date | string | number, cutoff: Date): boolean {
  const saved = new Date(updatedAt).getTime();
  return Number.isFinite(saved) && saved >= cutoff.getTime();
}

/** Null when the value is outside 0–100. Null input means "not entered" and is valid. */
export function validateVendorForecastPercent(value: number | null): string | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 100) return "Forecast percentage must be between 0 and 100.";
  return null;
}

/**
 * Vendors may set a percentage only for a scope linked to their account.
 * Admins may set any vendor's percentage. Designer and sales_rep can view it
 * and cannot write it.
 */
export function vendorMaySetForecastRate(input: { role: string; scope: string; allowedScopes: readonly string[] }): string | null {
  const scope = parseVendorScope(input.scope);
  if (!scope) return "Unknown vendor.";
  if (input.role === "admin") return null;
  if (input.role !== "distributor") return "Only the vendor or an admin can set this forecast percentage.";
  if (!input.allowedScopes.includes(scope)) return "That vendor is not linked to your account.";
  return null;
}

export type ForecastExclusion = {
  ordered: number;
  lost: number;
  included: number;
  scanned: number;
};

const UNSPECIFIED = "unspecified";

function norm(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : UNSPECIFIED;
}

function includesOrAll(selected: string[] | undefined, value: string): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.some((item) => item.toLowerCase() === value.toLowerCase());
}

export function designMatchesFilters(design: ForecastDesignMeta, filters: ForecastFilters): boolean {
  if (!includesOrAll(filters.doorStyles, design.styleName)) return false;
  if (!includesOrAll(filters.colors, design.color)) return false;
  if (!includesOrAll(filters.series, design.seriesName)) return false;
  if (!includesOrAll(filters.customerTypes, design.customerType)) return false;
  if (filters.statuses && filters.statuses.length > 0 && !includesOrAll(filters.statuses, design.status)) return false;
  const saved = new Date(design.updatedAt).getTime();
  if (filters.savedFrom) {
    const from = new Date(filters.savedFrom).getTime();
    if (Number.isFinite(from) && saved < from) return false;
  }
  if (filters.savedTo) {
    const to = new Date(filters.savedTo).getTime();
    if (Number.isFinite(to) && saved > to + 86_400_000 - 1) return false;
  }
  return true;
}

export type DesignWeight = {
  include: boolean;
  reason: "ordered" | "lost" | "won" | "age";
  rate: number;
};

export function weightForDesign(
  design: Pick<ForecastDesignMeta, "updatedAt" | "ordered" | "crmStage">,
  brackets: readonly CloseRateBracket[],
  now: Date | number = Date.now(),
): DesignWeight {
  if (design.ordered) return { include: false, reason: "ordered", rate: 0 };
  const stage = (design.crmStage ?? "").toLowerCase();
  if (stage === "lost") return { include: false, reason: "lost", rate: 0 };
  if (stage === "won" || stage === "new_sale") return { include: true, reason: "won", rate: 1 };
  return { include: true, reason: "age", rate: closeRateFraction(ageDaysFromUpdatedAt(design.updatedAt, now), brackets) };
}

export type MaterialTotal = {
  sku: string;
  description: string;
  supplierName: string | null;
  scope: string | null;
  category: string;
  color: string;
  styleName: string;
  seriesName: string;
  quantity: number;
  /** Null until the owning vendor enters a forecast percentage. */
  weightedQuantity: number | null;
  designCount: number;
  weightedDesignCount: number | null;
  listValue: number | null;
  retailValue: number | null;
  weightedRetailValue: number | null;
  /** Sum of vendorWholesale × quantity. Null when any contributing line has no vendor cost. */
  vendorCost: number | null;
  weightedVendorCost: number | null;
  /** The vendor-entered percent applied to this row, or null when not entered. */
  vendorRatePercent: number | null;
  categoryMissing: boolean;
  catalogProductKind: "pelican" | "cabinet_sku" | null;
  catalogProductId: number | null;
  estimated: boolean;
};

export type ForecastDesignRow = {
  id: number;
  name: string;
  customerName: string | null;
  updatedAt: string;
  styleName: string;
  color: string;
  seriesName: string;
  customerType: string;
  status: string;
  /** Vendor forecast fraction for this design, or null when the vendor has not entered one. */
  weight: number | null;
};

export type ForecastFacets = {
  categories: string[];
  doorStyles: string[];
  statuses: string[];
  suppliers: Array<{ scope: string; name: string }>;
  missingCategory: boolean;
};

export type ForecastMaterialTotals = {
  rowCount: number;
  quantity: number;
  weightedQuantity: number | null;
  vendorCost: number | null;
  weightedVendorCost: number | null;
  missingCostRows: number;
  missingRateRows: number;
};

export type ForecastResult = {
  scanned: number;
  matched: number;
  excluded: ForecastExclusion;
  designs: ForecastDesignRow[];
  materials: MaterialTotal[];
  unassigned: MaterialTotal[];
  /** Options from the vendor-scoped data before the user's other filters. */
  facets: ForecastFacets;
};

function retailForLine(line: ForecastLine, homeownerMarkupBps: number): number | null {
  if (line.vendorWholesale != null && line.vendorWholesale > 0) {
    return retailFromWholesale(line.vendorWholesale, homeownerMarkupBps, {
      vendorMarkupPercent: line.vendorMarkupPercent,
      categoryMarkupBps: line.categoryMarkupBps,
    });
  }
  return line.listPrice;
}

function hasVendorCost(line: ForecastLine): boolean {
  return line.vendorWholesale != null && line.vendorWholesale > 0;
}

function lineMatchesCategory(line: ForecastLine, categories: string[] | undefined): boolean {
  if (!categories || categories.length === 0) return true;
  const value = categoryFilterValue(line.category, line.categoryMissing);
  return categories.some((item) => item.toLowerCase() === value.toLowerCase());
}

function lineMatchesQuery(line: ForecastLine, query: string | null | undefined): boolean {
  const needle = (query ?? "").trim().toLowerCase();
  if (!needle) return true;
  return [line.sku, line.description, line.supplierName, line.category]
    .some((value) => (value ?? "").toLowerCase().includes(needle));
}

function lineInScope(line: ForecastLine, supplierFilter: string[]): boolean {
  if (supplierFilter.length === 0) return true;
  return line.scope != null && supplierFilter.includes(line.scope);
}

function ratePercentFor(scope: string | null, rates: readonly VendorForecastRateInput[]): number | null {
  if (!scope) return null;
  const found = rates.find((rate) => rate.scope === scope);
  if (!found || found.percent == null) return null;
  return validateVendorForecastPercent(found.percent) == null ? found.percent : null;
}

type MaterialBucket = {
  sku: string;
  description: string;
  supplierName: string | null;
  scope: string | null;
  category: string;
  color: string;
  styleName: string;
  seriesName: string;
  quantity: number;
  weightedQuantity: number;
  listValue: number;
  retailValue: number;
  weightedRetailValue: number;
  vendorCost: number;
  weightedVendorCost: number;
  estimated: boolean;
  categoryMissing: boolean;
  rateMissing: boolean;
  costMissing: boolean;
  vendorRatePercent: number | null;
  catalogProductKind: "pelican" | "cabinet_sku" | null;
  catalogProductId: number | null;
  productConflict: boolean;
  designIds: Set<number>;
};

function emptyFacets(): ForecastFacets {
  return { categories: [], doorStyles: [], statuses: [], suppliers: [], missingCategory: false };
}

export function aggregateForecast(input: {
  designs: ForecastDesignMeta[];
  lines: ForecastLine[];
  brackets: readonly CloseRateBracket[];
  filters?: ForecastFilters;
  /** Vendor-entered percentages. Company close-rate brackets are not applied to weighted quantities. */
  vendorRates?: readonly VendorForecastRateInput[];
  homeownerMarkupBps: number;
  now?: Date | number;
  page?: number;
  pageSize?: number;
}): ForecastResult {
  const filters = input.filters ?? {};
  const now = input.now ?? Date.now();
  const rates = input.vendorRates ?? [];
  const supplierFilter = (filters.supplierScopes ?? []).filter(Boolean);
  const attributeFilters: ForecastFilters = {
    doorStyles: filters.doorStyles,
    colors: filters.colors,
    series: filters.series,
    customerTypes: filters.customerTypes,
    savedFrom: filters.savedFrom,
    savedTo: filters.savedTo,
  };
  const attributeMatched = input.designs.filter((design) => designMatchesFilters(design, attributeFilters));
  const statusFiltered = attributeMatched.filter((design) => designMatchesFilters(design, { statuses: filters.statuses }));

  const weightById = new Map<number, DesignWeight>();
  const excluded: ForecastExclusion = { ordered: 0, lost: 0, included: 0, scanned: input.designs.length };
  for (const design of statusFiltered) {
    const weight = weightForDesign(design, input.brackets, now);
    weightById.set(design.id, weight);
    if (!weight.include && weight.reason === "ordered") excluded.ordered += 1;
    else if (!weight.include && weight.reason === "lost") excluded.lost += 1;
    else excluded.included += 1;
  }

  const linesByDesign = new Map<number, ForecastLine[]>();
  for (const line of input.lines) {
    const list = linesByDesign.get(line.designId) ?? [];
    list.push(line);
    linesByDesign.set(line.designId, list);
  }

  const facetLines = input.lines.filter((line) => lineInScope(line, supplierFilter));
  const facetDesignIds = new Set(facetLines.map((line) => line.designId));
  const facetDesigns = input.designs.filter((design) => supplierFilter.length === 0 || facetDesignIds.has(design.id));
  const categorySet = new Set<string>();
  let missingCategory = false;
  for (const line of facetLines) {
    if (isMissingProductCategory(line.category, line.categoryMissing)) missingCategory = true;
    else categorySet.add(line.category.trim());
  }
  const supplierNames = new Map<string, string>();
  for (const line of facetLines) {
    if (!line.scope || supplierNames.has(line.scope)) continue;
    supplierNames.set(line.scope, line.supplierName?.trim() || line.scope);
  }
  const facets: ForecastFacets = {
    categories: Array.from(categorySet).sort((a, b) => a.localeCompare(b)),
    doorStyles: uniquePresent(facetDesigns.map((design) => design.styleName)),
    statuses: uniquePresent(facetDesigns.map((design) => design.status)),
    suppliers: Array.from(supplierNames.entries())
      .map(([scope, name]) => ({ scope, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    missingCategory,
  };

  const lineFiltersActive = supplierFilter.length > 0
    || (filters.categories?.length ?? 0) > 0
    || Boolean((filters.query ?? "").trim());
  const lineIncluded = (line: ForecastLine) => lineInScope(line, supplierFilter)
    && lineMatchesCategory(line, filters.categories)
    && lineMatchesQuery(line, filters.query);

  const includedDesigns = statusFiltered.filter((design) => {
    const weight = weightById.get(design.id);
    if (!weight?.include) return false;
    if (!lineFiltersActive) return true;
    return (linesByDesign.get(design.id) ?? []).some(lineIncluded);
  });

  const buckets = new Map<string, MaterialBucket>();
  const addLine = (line: ForecastLine) => {
    if (!lineIncluded(line)) return;
    const categoryMissing = isMissingProductCategory(line.category, line.categoryMissing);
    const key = [line.scope ?? "unassigned", line.sku, norm(line.color), norm(line.styleName), categoryFilterValue(line.category, line.categoryMissing)].join("|");
    const percent = ratePercentFor(line.scope, rates);
    const current = buckets.get(key) ?? {
      sku: line.sku,
      description: line.description,
      supplierName: line.supplierName,
      scope: line.scope,
      category: categoryMissing ? "" : line.category.trim(),
      color: norm(line.color),
      styleName: norm(line.styleName),
      seriesName: norm(line.seriesName),
      quantity: 0,
      weightedQuantity: 0,
      listValue: 0,
      retailValue: 0,
      weightedRetailValue: 0,
      vendorCost: 0,
      weightedVendorCost: 0,
      estimated: false,
      categoryMissing,
      rateMissing: false,
      costMissing: false,
      vendorRatePercent: percent,
      catalogProductKind: line.catalogProductKind ?? null,
      catalogProductId: line.catalogProductId ?? null,
      productConflict: false,
      designIds: new Set<number>(),
    };
    current.quantity += line.quantity;
    current.estimated = current.estimated || line.estimated;
    current.designIds.add(line.designId);
    current.categoryMissing = current.categoryMissing || categoryMissing;
    if (percent == null) current.rateMissing = true;
    else current.weightedQuantity += line.quantity * (percent / 100);
    if (!hasVendorCost(line)) current.costMissing = true;
    else {
      const cost = line.vendorWholesale! * line.quantity;
      current.vendorCost += cost;
      if (percent != null) current.weightedVendorCost += cost * (percent / 100);
    }
    const retail = retailForLine(line, input.homeownerMarkupBps);
    if (line.listPrice != null) current.listValue += line.listPrice * line.quantity;
    if (retail != null) {
      current.retailValue += retail * line.quantity;
      if (percent != null) current.weightedRetailValue += retail * line.quantity * (percent / 100);
    }
    const kind = line.catalogProductKind ?? null;
    const productId = line.catalogProductId ?? null;
    if (current.catalogProductId == null && productId != null && !current.productConflict) {
      current.catalogProductKind = kind;
      current.catalogProductId = productId;
    } else if (productId !== current.catalogProductId || kind !== current.catalogProductKind) {
      current.productConflict = true;
      current.catalogProductKind = null;
      current.catalogProductId = null;
    }
    buckets.set(key, current);
  };

  for (const design of includedDesigns) {
    for (const line of linesByDesign.get(design.id) ?? []) addLine(line);
  }

  const materialsAll = Array.from(buckets.values()).map((row) => {
    const fraction = row.vendorRatePercent == null ? null : row.vendorRatePercent / 100;
    return {
      sku: row.sku,
      description: row.description,
      supplierName: row.supplierName,
      scope: row.scope,
      category: row.categoryMissing ? "" : row.category,
      color: row.color,
      styleName: row.styleName,
      seriesName: row.seriesName,
      quantity: round3(row.quantity),
      weightedQuantity: row.rateMissing ? null : round3(row.weightedQuantity),
      designCount: row.designIds.size,
      weightedDesignCount: row.rateMissing || fraction == null ? null : round3(row.designIds.size * fraction),
      listValue: round2(row.listValue),
      retailValue: round2(row.retailValue),
      weightedRetailValue: row.rateMissing ? null : round2(row.weightedRetailValue),
      vendorCost: row.costMissing ? null : round2(row.vendorCost),
      weightedVendorCost: row.costMissing || row.rateMissing ? null : round2(row.weightedVendorCost),
      vendorRatePercent: row.rateMissing ? null : row.vendorRatePercent,
      categoryMissing: row.categoryMissing,
      catalogProductKind: row.productConflict ? null : row.catalogProductKind,
      catalogProductId: row.productConflict ? null : row.catalogProductId,
      estimated: row.estimated,
    };
  });

  const pageSize = Math.max(1, input.pageSize ?? 25);
  const page = Math.max(0, input.page ?? 0);
  const designs = includedDesigns.slice(page * pageSize, page * pageSize + pageSize).map((design) => {
    const includedLines = (linesByDesign.get(design.id) ?? []).filter(lineIncluded);
    const percents = new Set(includedLines.map((line) => ratePercentFor(line.scope, rates)));
    const only = percents.size === 1 ? Array.from(percents)[0] : null;
    return {
      id: design.id,
      name: design.name,
      customerName: design.customerName,
      updatedAt: new Date(design.updatedAt).toISOString(),
      styleName: norm(design.styleName),
      color: norm(design.color),
      seriesName: norm(design.seriesName),
      customerType: norm(design.customerType),
      status: design.status,
      weight: only == null ? null : only / 100,
    };
  });

  return {
    scanned: input.designs.length,
    matched: includedDesigns.length,
    excluded,
    designs,
    facets,
    materials: materialsAll.filter((row) => row.scope != null).sort((a, b) => a.sku.localeCompare(b.sku)),
    unassigned: materialsAll.filter((row) => row.scope == null).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

function uniquePresent(values: string[]): string[] {
  const found = new Set<string>();
  for (const value of values) {
    const text = value.trim();
    if (!text || text.toLowerCase() === "unspecified") continue;
    found.add(text);
  }
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

export function filterForecastMaterials(
  rows: readonly MaterialTotal[],
  range: { qtyMin?: number | null; qtyMax?: number | null },
): MaterialTotal[] {
  return rows.filter((row) => {
    if (range.qtyMin != null && Number.isFinite(range.qtyMin) && row.quantity < range.qtyMin) return false;
    if (range.qtyMax != null && Number.isFinite(range.qtyMax) && row.quantity > range.qtyMax) return false;
    return true;
  });
}

export function sumForecastMaterials(rows: readonly MaterialTotal[]): ForecastMaterialTotals {
  let quantity = 0;
  let weightedQuantity = 0;
  let weightedMissing = false;
  let vendorCost = 0;
  let weightedVendorCost = 0;
  let weightedCostMissing = false;
  let missingCostRows = 0;
  let missingRateRows = 0;
  for (const row of rows) {
    quantity += row.quantity;
    if (row.weightedQuantity == null) {
      weightedMissing = true;
      missingRateRows += 1;
    } else weightedQuantity += row.weightedQuantity;
    if (row.vendorCost == null) missingCostRows += 1;
    else vendorCost += row.vendorCost;
    if (row.weightedVendorCost == null) weightedCostMissing = true;
    else weightedVendorCost += row.weightedVendorCost;
  }
  return {
    rowCount: rows.length,
    quantity: round3(quantity),
    weightedQuantity: weightedMissing ? null : round3(weightedQuantity),
    vendorCost: round2(vendorCost),
    weightedVendorCost: weightedCostMissing ? null : round2(weightedVendorCost),
    missingCostRows,
    missingRateRows,
  };
}

export function forecastProductEditTarget(row: Pick<MaterialTotal, "catalogProductKind" | "catalogProductId" | "sku">): { section: "catalog"; edit?: number; sku?: string } | null {
  if (row.catalogProductKind === "pelican" && row.catalogProductId != null) {
    return { section: "catalog", edit: row.catalogProductId };
  }
  if (row.catalogProductKind === "cabinet_sku" && row.sku.trim()) {
    return { section: "catalog", sku: row.sku };
  }
  return null;
}

/** Company forecast link into the existing catalog editor for that vendor's product. */
export function companyForecastProductPath(row: Pick<MaterialTotal, "catalogProductKind" | "catalogProductId" | "sku" | "scope">): string | null {
  const target = forecastProductEditTarget(row);
  if (!target) return null;
  const params = new URLSearchParams();
  params.set("section", "catalog");
  if (target.edit != null) {
    params.set("catalog", "pelican");
    params.set("edit", String(target.edit));
    return `/vendor?${params.toString()}`;
  }
  const distributorId = row.scope?.startsWith("dist:") ? Number(row.scope.slice("dist:".length)) : NaN;
  if (!target.sku || !Number.isInteger(distributorId) || distributorId <= 0) return null;
  params.set("catalog", "cabinet");
  params.set("sku", target.sku);
  params.set("as", String(distributorId));
  return `/vendor?${params.toString()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

const VENDOR_PRIVATE = new Set(["customerName"]);

/** Vendor projection: own scopes only, no customer identity, no unassigned lines. */
export function projectForecastForScopes(result: ForecastResult, scopes: readonly string[]): ForecastResult {
  const allowed = new Set(scopes);
  return {
    ...result,
    designs: result.designs.map((design) => {
      const copy = { ...design };
      for (const key of Array.from(VENDOR_PRIVATE)) {
        if (key in copy) (copy as { customerName: string | null }).customerName = null;
      }
      return copy;
    }),
    materials: result.materials
      .filter((row) => row.scope != null && allowed.has(row.scope))
      .map(hideRetailFromVendor),
    unassigned: [],
    facets: {
      ...result.facets,
      suppliers: result.facets.suppliers.filter((supplier) => allowed.has(supplier.scope)),
      categories: result.facets.categories,
    },
  };
}

function hideRetailFromVendor(row: MaterialTotal): MaterialTotal {
  return { ...row, listValue: null, retailValue: null, weightedRetailValue: null };
}

export function formatVendorCost(value: number | null): string {
  if (value == null) return "No cost on file";
  return `$${value.toFixed(2)}`;
}

export function formatWeightedQuantity(value: number | null): string {
  if (value == null) return "Not entered";
  return String(value);
}

export function materialsToCsv(rows: readonly MaterialTotal[]): string {
  const header = ["SKU", "Description", "Supplier", "Category", "Color", "Style", "Quantity", "Weighted quantity", "Forecast percent", "Designs", "Vendor cost", "Weighted vendor cost", "Estimated"];
  const body = rows.map((row) => [
    row.sku,
    row.description,
    row.supplierName ?? "",
    row.categoryMissing ? MISSING_CATEGORY_LABEL : row.category,
    row.color,
    row.styleName,
    String(row.quantity),
    row.weightedQuantity == null ? "Not entered" : String(row.weightedQuantity),
    row.vendorRatePercent == null ? "Not entered" : String(row.vendorRatePercent),
    String(row.designCount),
    row.vendorCost == null ? "No cost on file" : row.vendorCost.toFixed(2),
    row.weightedVendorCost == null ? "Not entered" : row.weightedVendorCost.toFixed(2),
    row.estimated ? "yes" : "",
  ].map(csvCell).join(","));
  return [header.join(","), ...body].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
