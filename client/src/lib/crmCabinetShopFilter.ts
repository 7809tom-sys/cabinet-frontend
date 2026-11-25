/**
 * Cabinet shop prospects are house CRM contacts imported state by state from
 * the "Cabinet Shops in <State>" lists in the affiliate library. Like the
 * distributor prospects they are tagged one of two ways:
 * - company "Cabinet shop prospect" (any suffix)
 * - notes containing a cabinet shop list import marker, e.g.
 *   "cabinet_shop_list_2026-11-24"
 * Each import note carries a "State: FL" line so the view can group by state.
 * The Cabinet Shops view shows only these; every other view is unchanged.
 */
export const CABINET_SHOP_LIST_MARKER = "cabinet_shop_list_2026-11-24";
const CABINET_SHOP_MARKER_PREFIX = "cabinet_shop_list_";

/** States worked first, in this order; the rest follow alphabetically. */
export const CABINET_SHOP_PRIORITY_STATES = ["FL", "GA"] as const;

type CabinetShopFilterDeal = {
  company?: string | null;
  notes?: string | null;
};

export function isCabinetShopProspect(deal: CabinetShopFilterDeal): boolean {
  const company = (deal.company ?? "").trim().toLowerCase();
  if (company.startsWith("cabinet shop prospect")) return true;
  return (deal.notes ?? "").includes(CABINET_SHOP_MARKER_PREFIX);
}

export function filterCabinetShopProspects<T extends CabinetShopFilterDeal>(deals: readonly T[]): T[] {
  return deals.filter(isCabinetShopProspect);
}

const STATE_LINE = /(?:^|\n|\|)\s*State:\s*([A-Za-z]{2})\b/;

/** Two-letter state from the "State: FL" notes line, or null when missing. */
export function cabinetShopState(notes: string | null | undefined): string | null {
  const match = STATE_LINE.exec(notes ?? "");
  return match ? match[1].toUpperCase() : null;
}

function stateRank(state: string): number {
  const index = (CABINET_SHOP_PRIORITY_STATES as readonly string[]).indexOf(state);
  return index === -1 ? CABINET_SHOP_PRIORITY_STATES.length : index;
}

/** FL and GA first, then the other states A to Z, then "unknown" last. */
export function compareCabinetShopStates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const byRank = stateRank(a) - stateRank(b);
  return byRank !== 0 ? byRank : a.localeCompare(b);
}

export type CabinetShopStateCount = { state: string | null; count: number };

/** Shop count per state, in working order (FL, GA, then A to Z). */
export function countCabinetShopsByState(deals: readonly CabinetShopFilterDeal[]): CabinetShopStateCount[] {
  const counts = new Map<string | null, number>();
  for (const deal of deals) {
    if (!isCabinetShopProspect(deal)) continue;
    const state = cabinetShopState(deal.notes);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return Array.from(counts, ([state, count]) => ({ state, count })).sort((a, b) => compareCabinetShopStates(a.state, b.state));
}

/** Narrow to one state; "all" keeps every shop. */
export function filterCabinetShopsByState<T extends CabinetShopFilterDeal>(deals: readonly T[], state: string): T[] {
  if (state === "all") return [...deals];
  if (state === "unknown") return deals.filter((deal) => cabinetShopState(deal.notes) == null);
  return deals.filter((deal) => cabinetShopState(deal.notes) === state);
}
