/**
 * Distributor prospects are the house CRM contacts imported from the US
 * cabinet distributor master list. They are tagged one of two ways:
 * - company "Distributor prospect" or "Distributor prospect - needs new site"
 * - notes containing the master-list import marker
 * The Distributors view shows only these; every other view is unchanged.
 */
export const DISTRIBUTOR_MASTER_LIST_MARKER = "distributor_master_list_2026-11-24";

type DistributorFilterDeal = {
  company?: string | null;
  notes?: string | null;
};

export function isDistributorProspect(deal: DistributorFilterDeal): boolean {
  const company = (deal.company ?? "").trim().toLowerCase();
  if (company.startsWith("distributor prospect")) return true;
  return (deal.notes ?? "").includes(DISTRIBUTOR_MASTER_LIST_MARKER);
}

export function filterDistributorProspects<T extends DistributorFilterDeal>(deals: readonly T[]): T[] {
  return deals.filter(isDistributorProspect);
}
