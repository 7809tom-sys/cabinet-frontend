/**
 * Which saved designs belong to a CRM customer.
 *
 * The CRM deal drawer used to read the customer directory, which lists every
 * design owned by the person behind the contact (and, because the directory
 * merges people by email/phone, sometimes designs belonging to other contacts
 * too). A customer view must show only designs that are actually linked to that
 * customer, and must never infer a link from ownership.
 *
 * Where a link is stored:
 * - `cabinet_dealz.crm_deal_designs` — the deal ↔ saved design link written by
 *   `crm.linkDesign` and removed by `crm.unlinkDesign`. This is the link the CRM
 *   deal drawer shows.
 * - `cabinet_dealz.kitchen_designs.contractorCustomerId` — a contractor's own
 *   customer folder (`cabinet_dealz.contractor_customers.id`). The contractor
 *   portal assigns designs this way.
 *
 * Nothing else is a link. A design with the customer's userId, the customer's
 * email, or the same store is NOT linked and is not shown.
 */

export const CRM_DEAL_DESIGNS_TABLE = "cabinet_dealz.crm_deal_designs";
export const DESIGN_CUSTOMER_COLUMN = "cabinet_dealz.kitchen_designs.contractorCustomerId";

export const CUSTOMER_DESIGN_LINK_NOTE =
  "Only designs linked to this customer are listed. Designs saved on the account but not linked are not shown.";

export const NO_LINKED_DESIGN_COPY = "No design linked to this customer yet.";

/**
 * Shown when the API that filters designs by link is not deployed yet. Without
 * it the drawer would look empty and read as "this customer has no designs".
 */
export const CUSTOMER_DESIGNS_UNAVAILABLE_COPY =
  "The linked-designs filter is not deployed on the server yet, so no design is listed here. Designs saved on the account are not shown until it is.";

export type DesignLinkKind = "deal" | "customerFolder";

export type CustomerDesignLinkScope = {
  /** crm_deals.id the view belongs to. Null outside the CRM (e.g. a store account page). */
  dealId: number | null;
  /** crm_deals.contractorCustomerId, when the deal belongs to a contractor's customer folder. */
  contractorCustomerId?: number | null;
};

/** The minimum a row must carry for the link decision. */
export type CustomerDesignLinkFacts = {
  designId: number;
  /** crm_deal_designs.dealId values that point at this design. */
  dealIds?: readonly number[];
  /** kitchen_designs.contractorCustomerId. */
  contractorCustomerId?: number | null;
};

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * How this design is linked to the customer being viewed, or null when it is not.
 * A design that is only owned by the customer, or only saved in the same store,
 * returns null.
 */
export function designLinkKind(
  facts: CustomerDesignLinkFacts,
  scope: CustomerDesignLinkScope,
): DesignLinkKind | null {
  const dealId = positive(scope.dealId);
  if (dealId != null && (facts.dealIds ?? []).some((id) => positive(id) === dealId)) return "deal";
  const customerId = positive(scope.contractorCustomerId);
  if (customerId != null && positive(facts.contractorCustomerId) === customerId) return "customerFolder";
  return null;
}

export type LinkedCustomerDesign<T> = T & { linkKind: DesignLinkKind };

/** Keep only linked designs, newest first by the caller's own order is preserved. */
export function selectCustomerDesigns<T extends CustomerDesignLinkFacts>(
  rows: readonly T[],
  scope: CustomerDesignLinkScope,
): Array<LinkedCustomerDesign<T>> {
  const seen = new Set<number>();
  const linked: Array<LinkedCustomerDesign<T>> = [];
  for (const row of rows) {
    const linkKind = designLinkKind(row, scope);
    if (!linkKind) continue;
    if (seen.has(row.designId)) continue;
    seen.add(row.designId);
    linked.push({ ...row, linkKind });
  }
  return linked;
}

/** True when the customer view has nothing to show. Never true because of ownership. */
export function hasLinkedDesign(rows: readonly CustomerDesignLinkFacts[], scope: CustomerDesignLinkScope): boolean {
  return selectCustomerDesigns(rows, scope).length > 0;
}

export function isDesignLinkKind(value: unknown): value is DesignLinkKind {
  return value === "deal" || value === "customerFolder";
}

/**
 * Client-side guard for a response that is supposed to carry the server's link
 * decision. A row with no `linkKind` was not proven linked — an older server
 * that lists every design on the account, for example — so it is dropped. The
 * customer view never falls back to showing it.
 */
export function serverLinkedDesigns<T extends { linkKind?: unknown }>(rows: readonly T[]): Array<T & { linkKind: DesignLinkKind }> {
  return rows.filter((row) => isDesignLinkKind(row.linkKind)) as Array<T & { linkKind: DesignLinkKind }>;
}

export function designLinkSourceLabel(kind: DesignLinkKind): string {
  return kind === "deal" ? "Linked to this deal" : "In this contractor customer folder";
}

/** The table/column pair to quote when explaining where the link lives. */
export function designLinkStorage(kind: DesignLinkKind): string {
  return kind === "deal" ? CRM_DEAL_DESIGNS_TABLE : DESIGN_CUSTOMER_COLUMN;
}
