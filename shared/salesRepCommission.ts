// Sales-rep pay for selling an affiliate account.
// The numbers below are seeded defaults only. Checkout and the ledger must
// use the settings row an admin saved, then copy that row onto the commission
// so a later edit does not rewrite commissions already earned.
//
// Residual base: "confirmed_material_subtotal" is the merchandise subtotal of
// confirmed orders. Freight, shipping, tax, fees, and affiliate-only cost fees
// are not included. Affiliate commission gross (sumCommission / totalAmount)
// is a different number and is not this base.

export const SALES_REP_COMMISSION_DEFAULTS = {
  flatFeeUsd: 400,
  /** 0.5% as a fraction, matching computeCommission's rate argument. */
  residualRate: 0.005,
  residualBase: "confirmed_material_subtotal" as const,
};

export const RESIDUAL_BASES = ["confirmed_material_subtotal"] as const;
export type ResidualBase = (typeof RESIDUAL_BASES)[number];

export type SalesRepCommissionSettings = {
  flatFeeUsd: number;
  residualRate: number;
  residualBase: ResidualBase;
  /**
   * Rep signup fee. Tom has not set one. Null keeps the rep checkout off.
   * An admin can enter an amount later without a code change.
   */
  repFeeUsd: number | null;
  repFeeCheckoutEnabled: boolean;
};

export const SALES_REP_FEE_TODO = "TODO: Tom has not set a sales rep signup fee.";

export function defaultCommissionSettings(): SalesRepCommissionSettings {
  return {
    flatFeeUsd: SALES_REP_COMMISSION_DEFAULTS.flatFeeUsd,
    residualRate: SALES_REP_COMMISSION_DEFAULTS.residualRate,
    residualBase: SALES_REP_COMMISSION_DEFAULTS.residualBase,
    repFeeUsd: null,
    repFeeCheckoutEnabled: false,
  };
}

export function normalizeCommissionSettings(
  raw: Partial<SalesRepCommissionSettings> | null | undefined,
): { ok: true; settings: SalesRepCommissionSettings } | { ok: false; message: string } {
  const flatFeeUsd = numberOr(raw?.flatFeeUsd, SALES_REP_COMMISSION_DEFAULTS.flatFeeUsd);
  const residualRate = numberOr(raw?.residualRate, SALES_REP_COMMISSION_DEFAULTS.residualRate);
  const residualBase = (raw as { residualBase?: string } | null | undefined)?.residualBase
    ?? SALES_REP_COMMISSION_DEFAULTS.residualBase;
  if (!Number.isFinite(flatFeeUsd) || flatFeeUsd < 0) {
    return { ok: false, message: "The flat fee must be zero or a positive number of dollars." };
  }
  if (!Number.isFinite(residualRate) || residualRate < 0 || residualRate > 1) {
    return { ok: false, message: "The residual rate must be between 0 and 1 (0.5% is 0.005)." };
  }
  const base = residualBase === "confirmed_order_gross" ? "confirmed_material_subtotal" : residualBase;
  if (!(RESIDUAL_BASES as readonly string[]).includes(base)) {
    return { ok: false, message: "The residual base must be confirmed material sales." };
  }
  const repFeeUsd = raw?.repFeeUsd == null || raw.repFeeUsd === ("" as unknown) ? null : Number(raw.repFeeUsd);
  if (repFeeUsd != null && (!Number.isFinite(repFeeUsd) || repFeeUsd <= 0)) {
    return { ok: false, message: "Leave the rep signup fee empty until Tom sets it, or enter a positive amount." };
  }
  return {
    ok: true,
    settings: {
      flatFeeUsd: roundDollars(flatFeeUsd),
      residualRate,
      residualBase: base as ResidualBase,
      repFeeUsd: repFeeUsd == null ? null : roundDollars(repFeeUsd),
      repFeeCheckoutEnabled: raw?.repFeeCheckoutEnabled === true && repFeeUsd != null && repFeeUsd > 0,
    },
  };
}

export type RateSnapshot = {
  flatFeeCents: number;
  residualRateBps: number;
  residualBase: ResidualBase;
  capturedAt: string;
};

/** Copy the settings that apply at the moment a commission is earned. */
export function snapshotRates(settings: SalesRepCommissionSettings, capturedAt: string): RateSnapshot {
  return {
    flatFeeCents: Math.round(settings.flatFeeUsd * 100),
    residualRateBps: Math.round(settings.residualRate * 10000),
    residualBase: settings.residualBase,
    capturedAt,
  };
}

export type MaterialOrderLine = {
  linePrice?: number | string | null;
  unitPrice?: number | string | null;
  qty?: number | null;
  productKind?: string | null;
  description?: string | null;
};

export type MaterialSalesOrder = {
  id: number | string;
  status: string;
  /** Stored merchandise subtotal in cents, when the order has that column. */
  materialSubtotalCents?: number | null;
  lineItems?: MaterialOrderLine[] | null;
  /** Present on older rows. Never used as the residual base. */
  totalAmount?: number | null;
};

export type MaterialSubtotal =
  | { ok: true; materialSubtotalCents: number; source: "stored" | "line_items" }
  | { ok: false; reason: "material_subtotal_missing" };

export type ResidualLine = {
  orderKey: string;
  amountCents: number;
  materialSubtotalCents: number;
  residualRateBps: number;
  residualBase: ResidualBase;
  flagged: false;
};

export type FlaggedResidual = {
  orderKey: string;
  reason: "material_subtotal_missing";
  flagged: true;
};

export type ResidualComputation = {
  lines: ResidualLine[];
  flagged: FlaggedResidual[];
};

const NON_MATERIAL_KINDS = new Set(["freight", "shipping", "tax", "fee", "damage_fee", "tech_fee", "card_fee"]);

function isNonMaterialLine(line: MaterialOrderLine): boolean {
  const kind = (line.productKind ?? "").trim().toLowerCase();
  if (NON_MATERIAL_KINDS.has(kind)) return true;
  const description = (line.description ?? "").toLowerCase();
  return /\b(freight|shipping|sales tax|damage fee|tech fee|card fee)\b/.test(description);
}

function dollarsToCents(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function lineMerchandiseCents(line: MaterialOrderLine): number | null {
  const fromLine = dollarsToCents(line.linePrice);
  if (fromLine != null) return fromLine;
  const unit = dollarsToCents(line.unitPrice);
  if (unit == null) return null;
  const qty = line.qty ?? 1;
  if (!Number.isFinite(qty)) return null;
  return unit * Math.max(0, Math.round(qty));
}

/**
 * Merchandise subtotal for one order. A stored materialSubtotalCents wins.
 * Otherwise the merchandise lines are summed. Freight, shipping, tax, and fee
 * lines are left out. totalAmount is never used: if neither the stored
 * subtotal nor a complete set of merchandise lines is present, the order is
 * flagged instead of guessed.
 */
export function resolveMaterialSubtotal(order: MaterialSalesOrder): MaterialSubtotal {
  const stored = order.materialSubtotalCents;
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0) {
    return { ok: true, materialSubtotalCents: Math.round(stored), source: "stored" };
  }
  const lines = order.lineItems;
  if (!lines || lines.length === 0) return { ok: false, reason: "material_subtotal_missing" };
  const materialLines = lines.filter((line) => !isNonMaterialLine(line));
  if (materialLines.length === 0) return { ok: false, reason: "material_subtotal_missing" };
  let sum = 0;
  for (const line of materialLines) {
    const cents = lineMerchandiseCents(line);
    if (cents == null) return { ok: false, reason: "material_subtotal_missing" };
    sum += cents;
  }
  return { ok: true, materialSubtotalCents: sum, source: "line_items" };
}

/**
 * Residual on material sales only, using the rate saved when the rep sold
 * the account. Orders that are not confirmed are ignored. Confirmed orders
 * with no material subtotal are flagged and pay nothing.
 */
export function residualLines(orders: MaterialSalesOrder[], snapshot: RateSnapshot): ResidualComputation {
  const lines: ResidualLine[] = [];
  const flagged: FlaggedResidual[] = [];
  const base = snapshot.residualBase === "confirmed_material_subtotal"
    || (snapshot.residualBase as string) === "confirmed_order_gross";
  if (!base || snapshot.residualRateBps <= 0) return { lines, flagged };
  for (const order of orders) {
    if (order.status !== "confirmed") continue;
    const material = resolveMaterialSubtotal(order);
    const orderKey = `residual:order:${order.id}`;
    if (!material.ok) {
      flagged.push({ orderKey, reason: material.reason, flagged: true });
      continue;
    }
    if (material.materialSubtotalCents <= 0) continue;
    const amountCents = Math.round((material.materialSubtotalCents * snapshot.residualRateBps) / 10000);
    if (amountCents <= 0) continue;
    lines.push({
      orderKey,
      amountCents,
      materialSubtotalCents: material.materialSubtotalCents,
      residualRateBps: snapshot.residualRateBps,
      residualBase: "confirmed_material_subtotal",
      flagged: false,
    });
  }
  return { lines, flagged };
}

export function repFeeCheckoutAvailable(settings: SalesRepCommissionSettings): boolean {
  return settings.repFeeCheckoutEnabled === true && settings.repFeeUsd != null && settings.repFeeUsd > 0;
}

export type RepApplicationStatus = "pending" | "approved" | "rejected";

export function selectableSalesReps<T extends { status: RepApplicationStatus }>(reps: T[]): T[] {
  return reps.filter((rep) => rep.status === "approved");
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value !== "number") return fallback;
  return value;
}

function roundDollars(value: number): number {
  return Math.round(value * 100) / 100;
}
