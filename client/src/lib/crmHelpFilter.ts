export type CrmHelpFilter = "all" | "design" | "shipping";

type HelpFilterDeal = {
  needsHelpDesigning?: boolean | null;
  needsHelpShipping?: boolean | null;
};

/**
 * Narrow a board view to one explicit staff-help queue without mutating the
 * fetched CRM data. The default leaves the board exactly as it was.
 */
export function filterDealsByHelpType<T extends HelpFilterDeal>(
  deals: readonly T[],
  filter: CrmHelpFilter,
): T[] {
  if (filter === "all") return [...deals];
  if (filter === "design") return deals.filter((deal) => deal.needsHelpDesigning === true);
  return deals.filter((deal) => deal.needsHelpShipping === true);
}
