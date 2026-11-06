/**
 * Short customer-facing order notes. Pure string builders so the wording is
 * reviewable and testable here, and the backend only has to deliver the result.
 *
 * These are deliberately separate messages with separate stamps on the order:
 *   - "order received" — acknowledges the order right after it is placed.
 *   - "order verified" — sent when an admin marks the order verified, i.e. the
 *     order was checked and is moving to fulfilment.
 * Sending one must never be recorded as sending the other.
 */

export type OrderCustomerEmailInput = {
  orderNumber: string;
  customerName?: string | null;
  /** Ship-to or pickup location, used only to keep the note concrete. */
  shipTo?: string | null;
  pickup?: boolean;
  /** Door style / finish, shown so the customer knows what the order was for. */
  styleName?: string | null;
};

export type OrderCustomerEmail = {
  subject: string;
  text: string;
};

function greeting(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? `Hi ${first},` : "Hi,";
}

const SIGN_OFF = ["", "Thank you for your order,", "Cabinet Dealz"].join("\n");

/** Acknowledgement that we have the order in hand. */
export function buildOrderReceivedEmail(input: OrderCustomerEmailInput): OrderCustomerEmail {
  const lines = [
    greeting(input.customerName),
    "",
    `Thank you — we have your order ${input.orderNumber}.`,
  ];
  if (input.styleName?.trim()) lines.push(`Style: ${input.styleName.trim()}`);
  if (input.shipTo?.trim()) {
    lines.push(input.pickup ? `Pickup at: ${input.shipTo.trim()}` : `Shipping to: ${input.shipTo.trim()}`);
  }
  lines.push(
    "",
    "We are reviewing the details now and will email you again as soon as it is confirmed and scheduled.",
    "If anything above looks wrong, just reply to this message.",
    SIGN_OFF
  );
  return {
    subject: `We received your order ${input.orderNumber} — Cabinet Dealz`,
    text: lines.join("\n"),
  };
}

/**
 * The verified note: a thank-you plus a promise to follow up with shipping
 * information. Kept short on purpose — it is a courtesy email, not an invoice.
 */
export function buildOrderVerifiedEmail(input: OrderCustomerEmailInput): OrderCustomerEmail {
  const lines = [
    greeting(input.customerName),
    "",
    `Thank you for your order ${input.orderNumber} — what a great choice.`,
  ];
  if (input.styleName?.trim()) lines.push(`Your ${input.styleName.trim()} cabinets are our favourite kind of project.`);
  lines.push(
    "",
    "Your order has been reviewed and verified on our side. We will be in touch soon with your shipping information.",
    "Nothing else is needed from you in the meantime.",
    SIGN_OFF
  );
  return {
    subject: `Your order ${input.orderNumber} is confirmed — Cabinet Dealz`,
    text: lines.join("\n"),
  };
}

export type OrderCustomerEmailKind = "received" | "verified";

export function buildOrderCustomerEmail(
  kind: OrderCustomerEmailKind,
  input: OrderCustomerEmailInput
): OrderCustomerEmail {
  return kind === "received" ? buildOrderReceivedEmail(input) : buildOrderVerifiedEmail(input);
}
