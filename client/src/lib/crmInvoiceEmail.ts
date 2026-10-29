export type CrmInvoiceEmailSource = "deal" | "order" | "account" | "stripe_record" | "stripe";
export type CrmInvoiceStripeLookup = "not_needed" | "found" | "unavailable" | "skipped";

export type CrmInvoiceRecipient = {
  email: string | null;
  source: CrmInvoiceEmailSource | null;
  stripeLookup: CrmInvoiceStripeLookup;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function usableInvoiceEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? "";
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/**
 * The invoice button is blocked only when there is no address to send to, or a
 * send is already in progress. Delivery readiness is not a reason to disable
 * it: a click has to reach the server so a real failure can be shown.
 */
export function invoiceEmailButtonDisabled(input: { recipient: string; pending: boolean }): boolean {
  return input.pending || usableInvoiceEmail(input.recipient) == null;
}

export function invoiceEmailSourceLabel(source: CrmInvoiceEmailSource | null | undefined, lang: "en" | "es"): string | null {
  if (!source) return null;
  const labels: Record<CrmInvoiceEmailSource, { en: string; es: string }> = {
    deal: { en: "on this lead", es: "en este prospecto" },
    order: { en: "from the linked order", es: "del pedido vinculado" },
    account: { en: "from the customer account", es: "de la cuenta del cliente" },
    stripe_record: { en: "from Stripe checkout", es: "del pago de Stripe" },
    stripe: { en: "from Stripe checkout", es: "del pago de Stripe" },
  };
  return labels[source][lang];
}

export function suggestedInvoiceEmail(dealEmail: string | null | undefined, recipient: CrmInvoiceRecipient | null | undefined): string {
  return usableInvoiceEmail(recipient?.email) ?? usableInvoiceEmail(dealEmail) ?? "";
}
