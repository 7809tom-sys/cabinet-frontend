// 90-day Auto Design credit (Tom, voice, Nov 19, 2026, 7:52 AM CT).
//
// If a customer pays the $9.99 Auto Design fee (app download fee, or the web
// equivalent purchase), every kitchen design they create within 90 days of that
// payment counts toward a credit on their FIRST kitchen order. The credit is
// applied once.
//
// Keyed by VERIFIED PHONE (E.164), not email or account: a payment, a design,
// and an order belong together when they carry the same phone.
//
// STORE-FEE POLICY: Google Play / Apple App Store keep a cut of the download
// fee. That cut is NOT passed on to the customer. The credit equals the full
// amount the customer paid (gross), never the net after the store cut. Kitchen
// sale revenue is separate and unaffected: no store fee is added to cabinet or
// kitchen prices, and the credit never reduces anything but the first kitchen
// order's merchandise total.
//
// Pure functions only: no database, no network, no clock of their own.

import { AUTO_DESIGN_ACCESS_FEE_CENTS, formatUsd, isValidPhoneE164 } from "./autoDesignAccess";

export const AUTO_DESIGN_CREDIT_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AutoDesignPaymentChannel = "web" | "app_store" | "play_store";

export interface AutoDesignFeePayment {
  id: string | number;
  phoneE164: string;
  channel: AutoDesignPaymentChannel;
  /** What the customer paid, in cents, before any store cut. */
  grossCents: number;
  /** Store cut kept by Apple/Google. Recorded for accounting only; never used for the credit. */
  storeFeeCents?: number | null;
  paidAt: Date | string;
  /** Refunded or charged back payments never earn a credit. */
  refunded?: boolean;
}

export interface CreditableDesign {
  id: string | number;
  phoneE164: string;
  roomType: string;
  createdAt: Date | string;
}

export interface KitchenOrderForCredit {
  id: string | number;
  phoneE164: string;
  /** Merchandise subtotal in cents (before tax and freight). The credit is capped at this. */
  merchandiseCents: number;
}

export interface CreditHistory {
  /** Kitchen orders already placed on this phone before the order being priced. */
  priorKitchenOrdersForPhone: number;
  /** True once a credit has been applied to any order on this phone. */
  creditAlreadyApplied: boolean;
}

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

export function creditWindow(paidAt: Date | string): { startMs: number; endMs: number } {
  const startMs = toMs(paidAt);
  return { startMs, endMs: startMs + AUTO_DESIGN_CREDIT_WINDOW_DAYS * DAY_MS };
}

/** A design qualifies when it is a kitchen on the same phone, created on or after payment and within 90 days. */
export function designQualifiesForPayment(payment: AutoDesignFeePayment, design: CreditableDesign): boolean {
  if (payment.refunded) return false;
  if (!isValidPhoneE164(payment.phoneE164) || payment.phoneE164 !== design.phoneE164) return false;
  if (design.roomType !== "kitchen") return false;
  const { startMs, endMs } = creditWindow(payment.paidAt);
  const created = toMs(design.createdAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(created)) return false;
  return created >= startMs && created <= endMs;
}

export function qualifyingDesigns(payment: AutoDesignFeePayment, designs: CreditableDesign[]): CreditableDesign[] {
  return designs.filter((design) => designQualifiesForPayment(payment, design));
}

/** Full fee the customer paid. Deliberately ignores storeFeeCents (policy above). */
export function creditAmountForPayment(payment: AutoDesignFeePayment): number {
  return Math.max(0, Math.round(payment.grossCents));
}

export type FirstOrderCreditResult =
  | { eligible: true; creditCents: number; paymentId: string | number; designIds: Array<string | number>; note: string }
  | { eligible: false; creditCents: 0; reason: "no_phone" | "not_first_order" | "already_applied" | "no_payment" | "no_qualifying_design" };

/**
 * Credit for one kitchen order. Applies only to the phone's first kitchen
 * order, only once, and only when a qualifying design exists. With several
 * payments on the phone, the payment with the most qualifying designs wins
 * (ties: earliest). One credit per phone, never stacked.
 */
export function firstKitchenOrderCredit(
  order: KitchenOrderForCredit,
  payments: AutoDesignFeePayment[],
  designs: CreditableDesign[],
  history: CreditHistory,
): FirstOrderCreditResult {
  if (!isValidPhoneE164(order.phoneE164)) return { eligible: false, creditCents: 0, reason: "no_phone" };
  if (history.creditAlreadyApplied) return { eligible: false, creditCents: 0, reason: "already_applied" };
  if (history.priorKitchenOrdersForPhone > 0) return { eligible: false, creditCents: 0, reason: "not_first_order" };
  const mine = payments
    .filter((p) => !p.refunded && p.phoneE164 === order.phoneE164 && p.grossCents > 0)
    .sort((a, b) => toMs(a.paidAt) - toMs(b.paidAt));
  if (mine.length === 0) return { eligible: false, creditCents: 0, reason: "no_payment" };
  let best: { payment: AutoDesignFeePayment; designs: CreditableDesign[] } | null = null;
  for (const payment of mine) {
    const q = qualifyingDesigns(payment, designs);
    if (q.length > 0 && (!best || q.length > best.designs.length)) best = { payment, designs: q };
  }
  if (!best) return { eligible: false, creditCents: 0, reason: "no_qualifying_design" };
  const creditCents = Math.min(creditAmountForPayment(best.payment), Math.max(0, Math.round(order.merchandiseCents)));
  return {
    eligible: true,
    creditCents,
    paymentId: best.payment.id,
    designIds: best.designs.map((d) => d.id),
    note: `Auto Design credit: ${formatUsd(creditCents)} from your ${formatUsd(creditAmountForPayment(best.payment))} Auto Design fee.`,
  };
}

/** Customer-facing explanation. Used in the subscribe prompt and wherever the credit is shown. */
export function autoDesignCreditCopy(feeCents: number = AUTO_DESIGN_ACCESS_FEE_CENTS): readonly string[] {
  return [
  `Your ${formatUsd(feeCents)} Auto Design fee comes back to you: kitchen designs you create within ${AUTO_DESIGN_CREDIT_WINDOW_DAYS} days of paying are credited toward your first kitchen order, once.`,
  "You get the full amount you paid. App store fees are never deducted from your credit, and they are never added to your kitchen price.",
  "Designs and credit are tied to your verified mobile number.",
  ];
}

export const AUTO_DESIGN_CREDIT_COPY = autoDesignCreditCopy();
