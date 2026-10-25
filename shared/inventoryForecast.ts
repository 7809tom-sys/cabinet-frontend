export type ForecastRateBand = {
  baseRateBps: number | null;
  lowRateBps: number | null;
  highRateBps: number | null;
};

export type InventoryForecastInput = {
  masterCode: string;
  vendorSku: string;
  openDesignQty: number;
  openDesignCount: number;
  affiliateCount: number;
  onHandQty: number | null;
};

export type InventoryForecastRow = InventoryForecastInput & {
  projectedSellThrough: number | null;
  lowProjectedSellThrough: number | null;
  highProjectedSellThrough: number | null;
  suggestedStock: number | null;
  stockStatus: "short" | "ok" | "over" | "demand_only" | "rate_tbd";
};

export function isForecastRateBps(value: number | null | undefined): value is number {
  return value != null && Number.isInteger(value) && value >= 0 && value <= 10000;
}

export function normalizeForecastRates(input: ForecastRateBand): ForecastRateBand {
  const baseRateBps = isForecastRateBps(input.baseRateBps) ? input.baseRateBps : null;
  const lowRateBps = isForecastRateBps(input.lowRateBps) ? input.lowRateBps : null;
  const highRateBps = isForecastRateBps(input.highRateBps) ? input.highRateBps : null;
  if (baseRateBps == null) return { baseRateBps: null, lowRateBps: null, highRateBps: null };
  return {
    baseRateBps,
    lowRateBps: lowRateBps == null ? null : Math.min(lowRateBps, baseRateBps),
    highRateBps: highRateBps == null ? null : Math.max(highRateBps, baseRateBps),
  };
}

function projected(openQty: number, rateBps: number | null): number | null {
  return rateBps == null ? null : Number(((Math.max(0, openQty) * rateBps) / 10000).toFixed(2));
}

export function inventoryForecastRow(input: InventoryForecastInput, rates: ForecastRateBand): InventoryForecastRow {
  const normalized = normalizeForecastRates(rates);
  const projectedSellThrough = projected(input.openDesignQty, normalized.baseRateBps);
  const suggestedStock = projectedSellThrough == null ? null : Math.ceil(projectedSellThrough);
  let stockStatus: InventoryForecastRow["stockStatus"];
  if (suggestedStock == null) stockStatus = "rate_tbd";
  else if (input.onHandQty == null) stockStatus = "demand_only";
  else if (input.onHandQty < suggestedStock) stockStatus = "short";
  else if (suggestedStock > 0 && input.onHandQty > Math.ceil(suggestedStock * 1.25)) stockStatus = "over";
  else stockStatus = "ok";

  return {
    ...input,
    projectedSellThrough,
    lowProjectedSellThrough: projected(input.openDesignQty, normalized.lowRateBps),
    highProjectedSellThrough: projected(input.openDesignQty, normalized.highRateBps),
    suggestedStock,
    stockStatus,
  };
}

export function csvEscape(value: string | number | null): string {
  if (value == null) return "";
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}
