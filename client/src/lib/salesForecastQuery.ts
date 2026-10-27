import type { ForecastTimePreset } from "@shared/salesForecast";

export type ForecastQueryState = {
  query: string;
  categories: string[];
  doorStyles: string[];
  colors: string[];
  series: string[];
  supplierScopes: string[];
  statuses: string[];
  customerTypes: string[];
  preset: ForecastTimePreset;
  savedFrom: string;
  savedTo: string;
  qtyMin: string;
  qtyMax: string;
  page: number;
};

const PREFIXES = {
  vf: {
    query: "vfQ",
    categories: "vfCat",
    doorStyles: "vfStyle",
    colors: "vfColor",
    series: "vfSeries",
    supplierScopes: "vfSupplier",
    statuses: "vfStatus",
    customerTypes: "vfRole",
    preset: "vfRange",
    savedFrom: "vfFrom",
    savedTo: "vfTo",
    qtyMin: "vfQtyMin",
    qtyMax: "vfQtyMax",
    page: "vfPage",
  },
  sf: {
    query: "sfQ",
    categories: "sfCat",
    doorStyles: "sfStyle",
    colors: "sfColor",
    series: "sfSeries",
    supplierScopes: "sfSupplier",
    statuses: "sfStatus",
    customerTypes: "sfRole",
    preset: "sfRange",
    savedFrom: "sfFrom",
    savedTo: "sfTo",
    qtyMin: "sfQtyMin",
    qtyMax: "sfQtyMax",
    page: "sfPage",
  },
} as const;

export type ForecastQueryPrefix = keyof typeof PREFIXES;

export function emptyForecastQuery(): ForecastQueryState {
  return {
    query: "",
    categories: [],
    doorStyles: [],
    colors: [],
    series: [],
    supplierScopes: [],
    statuses: [],
    customerTypes: [],
    preset: "all",
    savedFrom: "",
    savedTo: "",
    qtyMin: "",
    qtyMax: "",
    page: 0,
  };
}

function listParam(value: string | null): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function writeList(params: URLSearchParams, key: string, values: string[]) {
  const text = values.map((item) => item.trim()).filter(Boolean).join(",");
  if (text) params.set(key, text);
  else params.delete(key);
}

export function readForecastQuery(params: URLSearchParams, prefix: ForecastQueryPrefix): ForecastQueryState {
  const keys = PREFIXES[prefix];
  const savedFrom = params.get(keys.savedFrom) ?? "";
  const savedTo = params.get(keys.savedTo) ?? "";
  const rawPreset = params.get(keys.preset);
  const preset: ForecastTimePreset = rawPreset === "2m" || rawPreset === "3m" || rawPreset === "custom" || rawPreset === "all"
    ? rawPreset
    : savedFrom || savedTo
      ? "custom"
      : "all";
  return {
    query: params.get(keys.query) ?? "",
    categories: listParam(params.get(keys.categories)),
    doorStyles: listParam(params.get(keys.doorStyles)),
    colors: listParam(params.get(keys.colors)),
    series: listParam(params.get(keys.series)),
    supplierScopes: listParam(params.get(keys.supplierScopes)),
    statuses: listParam(params.get(keys.statuses)),
    customerTypes: listParam(params.get(keys.customerTypes)),
    preset,
    savedFrom,
    savedTo,
    qtyMin: params.get(keys.qtyMin) ?? "",
    qtyMax: params.get(keys.qtyMax) ?? "",
    page: Number(params.get(keys.page) ?? "0") || 0,
  };
}

export function applyForecastQuery(params: URLSearchParams, prefix: ForecastQueryPrefix, state: ForecastQueryState): URLSearchParams {
  const keys = PREFIXES[prefix];
  const next = new URLSearchParams(params);
  const setText = (key: string, value: string) => {
    const text = value.trim();
    if (text) next.set(key, text);
    else next.delete(key);
  };
  setText(keys.query, state.query);
  writeList(next, keys.categories, state.categories);
  writeList(next, keys.doorStyles, state.doorStyles);
  writeList(next, keys.colors, state.colors);
  writeList(next, keys.series, state.series);
  writeList(next, keys.supplierScopes, state.supplierScopes);
  writeList(next, keys.statuses, state.statuses);
  writeList(next, keys.customerTypes, state.customerTypes);
  if (state.preset === "all") next.delete(keys.preset);
  else next.set(keys.preset, state.preset);
  if (state.preset === "custom") {
    setText(keys.savedFrom, state.savedFrom);
    setText(keys.savedTo, state.savedTo);
  } else {
    next.delete(keys.savedFrom);
    next.delete(keys.savedTo);
  }
  setText(keys.qtyMin, state.qtyMin);
  setText(keys.qtyMax, state.qtyMax);
  if (state.page > 0) next.set(keys.page, String(state.page));
  else next.delete(keys.page);
  return next;
}

export function optionalNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
