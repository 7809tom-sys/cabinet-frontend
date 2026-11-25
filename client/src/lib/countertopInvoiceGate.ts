import { COUNTERTOP_MISSING_SHIPPING_MESSAGE } from "@shared/countertopSlabBilling";

/** One option from crm.countertopQuoteInvoiceOptions. */
export interface CountertopQuoteInvoiceOption {
  id: number;
  contactEmail: string;
  status: string;
  material: string | null;
  squareFeet: string | number | null;
  line: { description: string; amount: number; kind: "charge" } | null;
  slabs: number | null;
  slabSizeWarning: string | null;
  blockedReason: string | null;
}

export type CountertopInvoiceGate =
  | { ok: true; line: CountertopQuoteInvoiceOption["line"] }
  | { ok: false; reason: "missing_line" | "missing_shipping" | "loading"; message: string };

/**
 * Whether the picked countertop quote may go on the deal invoice. No quote
 * picked is always fine (line: null). A picked quote needs a slab line and
 * shipping info on file, because payment is only requested once shipping is
 * collected. The server re-checks both before it sends anything.
 */
export function countertopInvoiceGate(input: {
  quoteId: number | null;
  quotes: CountertopQuoteInvoiceOption[] | undefined;
  shippingOnFile: boolean | undefined;
}): CountertopInvoiceGate {
  if (input.quoteId == null) return { ok: true, line: null };
  if (!input.quotes) return { ok: false, reason: "loading", message: "Countertop quotes are still loading." };
  const quote = input.quotes.find((q) => q.id === input.quoteId);
  if (!quote || !quote.line) {
    return { ok: false, reason: "missing_line", message: quote?.blockedReason ?? "That countertop quote has no slab line to bill." };
  }
  if (input.shippingOnFile !== true) return { ok: false, reason: "missing_shipping", message: COUNTERTOP_MISSING_SHIPPING_MESSAGE };
  return { ok: true, line: quote.line };
}

/** Admin-facing text for the server's sendInvoiceEmail refusal codes. */
export function countertopInvoiceErrorMessage(message: string): string | null {
  return message === "missing_shipping" ? COUNTERTOP_MISSING_SHIPPING_MESSAGE : null;
}
