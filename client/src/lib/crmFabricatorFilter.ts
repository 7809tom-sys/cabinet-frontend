/**
 * Fabricator prospects are the countertop fabrication shops imported from the
 * fabrication_shops table (docs/sql/0291) and turned into house CRM contacts
 * (docs/sql/0293). They are tagged the same way as distributor and cabinet shop
 * prospects:
 * - company "Fabricator prospect - <shop name>"
 * - notes containing a fabricator list import marker, e.g.
 *   "fabricator_list_2026-11-26"
 * Each import note carries a "State: FL" line so the view can group by state.
 * The Fabricators view shows only these; every other view is unchanged.
 */
export const FABRICATOR_LIST_MARKER = "fabricator_list_2026-11-26";
const FABRICATOR_LIST_MARKER_PREFIX = "fabricator_list_";
const FABRICATOR_COMPANY_TAG = "fabricator prospect";

/** States worked first, in this order; the rest follow alphabetically. */
export const FABRICATOR_PRIORITY_STATES = ["FL", "GA"] as const;

type FabricatorFilterDeal = {
  company?: string | null;
  notes?: string | null;
};

export function isFabricatorProspect(deal: FabricatorFilterDeal): boolean {
  const company = (deal.company ?? "").trim().toLowerCase();
  if (company.startsWith(FABRICATOR_COMPANY_TAG)) return true;
  return (deal.notes ?? "").includes(FABRICATOR_LIST_MARKER_PREFIX);
}

export function filterFabricatorProspects<T extends FabricatorFilterDeal>(deals: readonly T[]): T[] {
  return deals.filter(isFabricatorProspect);
}

const STATE_LINE = /(?:^|\n|\|)\s*State:\s*([A-Za-z]{2})\b/;

/** Two-letter state from the "State: FL" notes line, or null when missing. */
export function fabricatorState(notes: string | null | undefined): string | null {
  const match = STATE_LINE.exec(notes ?? "");
  return match ? match[1].toUpperCase() : null;
}

function stateRank(state: string): number {
  const index = (FABRICATOR_PRIORITY_STATES as readonly string[]).indexOf(state);
  return index === -1 ? FABRICATOR_PRIORITY_STATES.length : index;
}

/** FL and GA first, then the other states A to Z, then "unknown" last. */
export function compareFabricatorStates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const byRank = stateRank(a) - stateRank(b);
  return byRank !== 0 ? byRank : a.localeCompare(b);
}

export type FabricatorStateCount = { state: string | null; count: number };

/** Shop count per state, in working order (FL, GA, then A to Z). */
export function countFabricatorsByState(deals: readonly FabricatorFilterDeal[]): FabricatorStateCount[] {
  const counts = new Map<string | null, number>();
  for (const deal of deals) {
    if (!isFabricatorProspect(deal)) continue;
    const state = fabricatorState(deal.notes);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((left, right) => compareFabricatorStates(left.state, right.state));
}

/** Keep only the fabricators in one state; "all" keeps every state. */
export function filterFabricatorsByState<T extends FabricatorFilterDeal>(
  deals: readonly T[],
  state: string | null | "all",
): T[] {
  if (state === "all") return [...deals];
  // The state Select uses "unknown" for deals whose notes carry no State line.
  const wanted = state === "unknown" ? null : state;
  return deals.filter((deal) => fabricatorState(deal.notes) === wanted);
}

/** The state to show for a saved preference, defaulting to the first one that has shops. */
export function resolveFabricatorState(
  preferred: string | null,
  states: readonly FabricatorStateCount[],
): string {
  if (preferred && states.some((entry) => entry.state === preferred)) return preferred;
  return states[0]?.state ?? "all";
}
