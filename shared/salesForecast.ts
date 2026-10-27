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
import type { VendorScope } from "./vendorFulfillment";

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
  vendorWholesale: number | null;
  vendorMarkupPercent?: number | null;
  categoryMarkupBps?: number | null;
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
  supplierScopes?: string[];
  savedFrom?: string | null;
  savedTo?: string | null;
  statuses?: string[];
  customerTypes?: string[];
};

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
  weightedQuantity: number;
  designCount: number;
  weightedDesignCount: number;
  listValue: number | null;
  retailValue: number | null;
  weightedRetailValue: number | null;
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
  weight: number;
};

export type ForecastResult = {
  scanned: number;
  matched: number;
  excluded: ForecastExclusion;
  designs: ForecastDesignRow[];
  materials: MaterialTotal[];
  unassigned: MaterialTotal[];
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

export function aggregateForecast(input: {
  designs: ForecastDesignMeta[];
  lines: ForecastLine[];
  brackets: readonly CloseRateBracket[];
  filters?: ForecastFilters;
  homeownerMarkupBps: number;
  now?: Date | number;
  page?: number;
  pageSize?: number;
}): ForecastResult {
  const filters = input.filters ?? {};
  const now = input.now ?? Date.now();
  const supplierFilter = (filters.supplierScopes ?? []).filter(Boolean);
  const attributeFilters: ForecastFilters = { ...filters, supplierScopes: undefined, statuses: undefined };
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

  const includedDesigns = statusFiltered.filter((design) => {
    const weight = weightById.get(design.id);
    if (!weight?.include) return false;
    if (supplierFilter.length === 0) return true;
    const lines = linesByDesign.get(design.id) ?? [];
    return lines.some((line) => line.scope != null && supplierFilter.includes(line.scope));
  });

  const buckets = new Map<string, MaterialTotal & { designIds: Set<number>; weightedDesignIds: Map<number, number> }>();
  const addLine = (line: ForecastLine, weight: number, intoUnassigned: boolean) => {
    if (supplierFilter.length > 0 && !intoUnassigned && (line.scope == null || !supplierFilter.includes(line.scope))) return;
    const key = [line.scope ?? "unassigned", line.sku, norm(line.color), norm(line.styleName), line.category].join("|");
    const current = buckets.get(key) ?? {
      sku: line.sku,
      description: line.description,
      supplierName: line.supplierName,
      scope: line.scope,
      category: line.category || UNSPECIFIED,
      color: norm(line.color),
      styleName: norm(line.styleName),
      seriesName: norm(line.seriesName),
      quantity: 0,
      weightedQuantity: 0,
      designCount: 0,
      weightedDesignCount: 0,
      listValue: 0,
      retailValue: 0,
      weightedRetailValue: 0,
      estimated: false,
      designIds: new Set<number>(),
      weightedDesignIds: new Map<number, number>(),
    };
    current.quantity += line.quantity;
    current.weightedQuantity += line.quantity * weight;
    current.estimated = current.estimated || line.estimated;
    current.designIds.add(line.designId);
    current.weightedDesignIds.set(line.designId, weight);
    const retail = retailForLine(line, input.homeownerMarkupBps);
    if (line.listPrice != null) current.listValue = (current.listValue ?? 0) + line.listPrice * line.quantity;
    if (retail != null) {
      current.retailValue = (current.retailValue ?? 0) + retail * line.quantity;
      current.weightedRetailValue = (current.weightedRetailValue ?? 0) + retail * line.quantity * weight;
    }
    buckets.set(key, current);
  };

  for (const design of includedDesigns) {
    const weight = weightById.get(design.id)?.rate ?? 0;
    for (const line of linesByDesign.get(design.id) ?? []) addLine(line, weight, line.scope == null);
  }

  const materialsAll = Array.from(buckets.values()).map((row) => {
    const { designIds, weightedDesignIds, ...rest } = row;
    const weightedDesignCount = Array.from(weightedDesignIds.values()).reduce((sum, rate) => sum + rate, 0);
    return {
      ...rest,
      quantity: round3(rest.quantity),
      weightedQuantity: round3(rest.weightedQuantity),
      designCount: designIds.size,
      weightedDesignCount: round3(weightedDesignCount),
      listValue: rest.listValue == null ? null : round2(rest.listValue),
      retailValue: rest.retailValue == null ? null : round2(rest.retailValue),
      weightedRetailValue: rest.weightedRetailValue == null ? null : round2(rest.weightedRetailValue),
    };
  });

  const pageSize = Math.max(1, input.pageSize ?? 25);
  const page = Math.max(0, input.page ?? 0);
  const designs = includedDesigns.slice(page * pageSize, page * pageSize + pageSize).map((design) => ({
    id: design.id,
    name: design.name,
    customerName: design.customerName,
    updatedAt: new Date(design.updatedAt).toISOString(),
    styleName: norm(design.styleName),
    color: norm(design.color),
    seriesName: norm(design.seriesName),
    customerType: norm(design.customerType),
    status: design.status,
    weight: weightById.get(design.id)?.rate ?? 0,
  }));

  return {
    scanned: input.designs.length,
    matched: includedDesigns.length,
    excluded,
    designs,
    materials: materialsAll.filter((row) => row.scope != null).sort((a, b) => a.sku.localeCompare(b.sku)),
    unassigned: materialsAll.filter((row) => row.scope == null).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
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
    materials: result.materials.filter((row) => row.scope != null && allowed.has(row.scope)),
    unassigned: [],
  };
}

export function materialsToCsv(rows: readonly MaterialTotal[]): string {
  const header = ["SKU", "Description", "Supplier", "Category", "Color", "Style", "Quantity", "Weighted quantity", "Designs", "Weighted designs", "Retail value", "Weighted retail value", "Estimated"];
  const body = rows.map((row) => [
    row.sku,
    row.description,
    row.supplierName ?? "",
    row.category,
    row.color,
    row.styleName,
    String(row.quantity),
    String(row.weightedQuantity),
    String(row.designCount),
    String(row.weightedDesignCount),
    row.retailValue == null ? "" : row.retailValue.toFixed(2),
    row.weightedRetailValue == null ? "" : row.weightedRetailValue.toFixed(2),
    row.estimated ? "yes" : "",
  ].map(csvCell).join(","));
  return [header.join(","), ...body].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
