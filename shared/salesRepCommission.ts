// Sales-rep pay for selling an affiliate account.
// The numbers below are seeded defaults only. Checkout and the ledger must
// use the settings row an admin saved, then copy that row onto the commission
// so a later edit does not rewrite commissions already earned.
//
// Residual base: "confirmed_order_gross" means the same gross as
// sumCommission in shared/affiliate.ts — the sum of totalAmount on orders
// whose status is "confirmed". Other order statuses are not sales.

import { sumCommission } from "./affiliate";

export const SALES_REP_COMMISSION_DEFAULTS = {
  flatFeeUsd: 400,
  /** 0.5% as a fraction, matching computeCommission's rate argument. */
  residualRate: 0.005,
  residualBase: "confirmed_order_gross" as const,
};

export const RESIDUAL_BASES = ["confirmed_order_gross"] as const;
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
  const residualBase = raw?.residualBase ?? SALES_REP_COMMISSION_DEFAULTS.residualBase;
  if (!Number.isFinite(flatFeeUsd) || flatFeeUsd < 0) {
    return { ok: false, message: "The flat fee must be zero or a positive number of dollars." };
  }
  if (!Number.isFinite(residualRate) || residualRate < 0 || residualRate > 1) {
    return { ok: false, message: "The residual rate must be between 0 and 1 (0.5% is 0.005)." };
  }
  if (!(RESIDUAL_BASES as readonly string[]).includes(residualBase)) {
    return { ok: false, message: "The residual base must be confirmed order sales." };
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
      residualBase,
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

export type ConfirmedOrder = { id: number | string; totalAmount: number | null; status: string };

export type ResidualLine = {
  orderKey: string;
  amountCents: number;
  grossCents: number;
  residualRateBps: number;
  residualBase: ResidualBase;
};

/**
 * Residual on one affiliate's orders using the rate saved when the rep sold
 * the account. Gross matches sumCommission: confirmed orders only.
 */
export function residualLines(orders: ConfirmedOrder[], snapshot: RateSnapshot): ResidualLine[] {
  if (snapshot.residualBase !== "confirmed_order_gross") return [];
  if (snapshot.residualRateBps <= 0) return [];
  const lines: ResidualLine[] = [];
  for (const order of orders) {
    if (order.status !== "confirmed") continue;
    const gross = Number(order.totalAmount ?? 0);
    if (!Number.isFinite(gross) || gross <= 0) continue;
    const grossCents = Math.round(gross * 100);
    const amountCents = Math.round((grossCents * snapshot.residualRateBps) / 10000);
    if (amountCents <= 0) continue;
    lines.push({
      orderKey: `residual:order:${order.id}`,
      amountCents,
      grossCents,
      residualRateBps: snapshot.residualRateBps,
      residualBase: snapshot.residualBase,
    });
  }
  return lines;
}

/** Same gross figure sumCommission reports, so the residual base is not a second definition. */
export function confirmedOrderGross(orders: { totalAmount: number | null; status: string }[]): number {
  return sumCommission(orders, 0).gross;
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
