/**
 * Staff quick lookup: a customer identifier in, that customer's design(s) out.
 *
 * The identifier is the CRM customer number, which is `cabinet_dealz.crm_deals.id`
 * (customer 5192 is deal row 5192). It is matched directly on that row — there is
 * no free-text search, no "browse all designs", and no ownership fallback — so the
 * only designs returned are the ones stored as linked to that customer
 * (see shared/crmCustomerDesigns.ts).
 *
 * Accepts what staff actually paste: "5192", "#5192", "customer 5192", "deal 5192",
 * or a pasted CRM URL such as /admin?deal=5192 / ?section=crm&deal=5192.
 */

export const CUSTOMER_IDENTIFIER_HINT = "Customer # (e.g. 5192)";

export const CUSTOMER_LOOKUP_COPY = {
  prompt: "Type the customer number from the CRM to open their plan.",
  notAnIdentifier: "That is not a customer number. Use the number shown on the customer, e.g. 5192.",
  notFound: "No customer with that number is in your CRM scope.",
  none: "That customer has no design linked yet.",
  one: "Opening their only design…",
  several: "That customer has more than one linked design. Pick the right one.",
  noneHint: "Link a saved design from the customer's record in the CRM, then look them up again.",
} as const;

export type LookupOutcome = "none" | "one" | "several";

export type ParsedCustomerIdentifier = {
  /** crm_deals.id, or null when the text is not a customer number at all. */
  dealId: number | null;
  /** What the caller typed, trimmed. Echoed back in "no customer ##### found". */
  raw: string;
};

const DEAL_QUERY_PARAM = /[?&]deal=(\d{1,9})\b/;
const LABELLED = /(?:^|\b)(?:customer|client|deal|account|contact)\s*(?:#|no\.?|number)?\s*[:#]?\s*(\d{1,9})\b/i;

function toDealId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 2_147_483_647) return null;
  return parsed;
}

/**
 * Pull the customer number out of whatever staff typed or pasted.
 * A bare number wins. Otherwise a CRM URL's `deal=` (or `customer=`), then a
 * labelled form like "customer #5192". Text with no number at all is rejected
 * rather than treated as a search term, so the lookup never turns into browsing.
 */
export function parseCustomerIdentifier(input: string): ParsedCustomerIdentifier {
  const raw = (input ?? "").trim();
  if (raw.length === 0) return { dealId: null, raw };

  const bare = raw.replace(/^#/, "").replace(/^customer\s*#?\s*/i, "").trim();
  if (/^\d{1,9}$/.test(bare)) return { dealId: toDealId(bare), raw };

  const fromDealParam = raw.match(DEAL_QUERY_PARAM)?.[1];
  if (fromDealParam) return { dealId: toDealId(fromDealParam), raw };

  const labelled = raw.match(LABELLED)?.[1];
  if (labelled) return { dealId: toDealId(labelled), raw };

  return { dealId: null, raw };
}

/** Exactly one design opens straight away; zero or several do not. */
export function lookupOutcome(designCount: number): LookupOutcome {
  if (designCount <= 0) return "none";
  if (designCount === 1) return "one";
  return "several";
}

export function lookupMessage(outcome: LookupOutcome, identifier: string | null): string {
  if (outcome === "none") return CUSTOMER_LOOKUP_COPY.none;
  if (outcome === "one") return CUSTOMER_LOOKUP_COPY.one;
  return identifier ? `${identifier}: ${CUSTOMER_LOOKUP_COPY.several}` : CUSTOMER_LOOKUP_COPY.several;
}
