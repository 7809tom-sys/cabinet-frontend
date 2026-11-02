/**
 * Distributor tabs + per-tab sort for the admin door selector.
 *
 * The tab list is derived from the doors that are actually loaded, so a new
 * distributor gets a tab without any code change. A distributor that is switched
 * off keeps its tab (so an admin can switch it back on) but contributes no doors.
 */

export type DoorSelectorSort = "name" | "doorStyle" | "color";

export type DoorSelectorTabStyle = {
  ourName: string;
  doorStyle?: string | null;
  color?: string | null;
  distributorId: number;
  supplierBrandName?: string | null;
  supplierName?: string | null;
};

export type DistributorTab = { id: number; name: string };

/** Same label rule as the rest of the admin: real brand name, then neutral supplier name, then the id. */
export function distributorLabel(style: DoorSelectorTabStyle): string {
  return (
    style.supplierBrandName?.trim() ||
    style.supplierName?.trim() ||
    `Distributor #${style.distributorId}`
  );
}

/** One tab per distributor found on the loaded doors, alphabetical by label. "All" is the caller's tab. */
export function buildDistributorTabs<T extends DoorSelectorTabStyle>(styles: readonly T[]): DistributorTab[] {
  const byId = new Map<number, string>();
  for (const style of styles) {
    if (!byId.has(style.distributorId)) byId.set(style.distributorId, distributorLabel(style));
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

function sortedField(style: DoorSelectorTabStyle, sort: Exclude<DoorSelectorSort, "name">): string {
  return (sort === "doorStyle" ? style.doorStyle : style.color)?.trim() ?? "";
}

/**
 * Order inside one tab: by door name, by door style, or by color. A blank door
 * style / color always sorts last; the door name is the final tie-break.
 */
export function doorSelectorComparator<T extends DoorSelectorTabStyle>(
  sort: DoorSelectorSort,
): (a: T, b: T) => number {
  if (sort === "name") {
    return (a, b) => a.ourName.localeCompare(b.ourName);
  }
  return (a, b) => {
    const aKey = sortedField(a, sort);
    const bKey = sortedField(b, sort);
    if (aKey && bKey) {
      const cmp = aKey.localeCompare(bKey, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    } else if (!aKey && bKey) {
      return 1;
    } else if (aKey && !bKey) {
      return -1;
    }
    return a.ourName.localeCompare(b.ourName);
  };
}

/** Sorted copy of one tab's doors. Does not mutate the input. */
export function sortDoorSelectorStyles<T extends DoorSelectorTabStyle>(
  styles: readonly T[],
  sort: DoorSelectorSort,
): T[] {
  return styles.slice().sort(doorSelectorComparator<T>(sort));
}

/**
 * Doors shown in the selector: the chosen tab's doors only, minus every door
 * owned by a distributor that is switched off.
 */
export function visibleDoorSelectorStyles<T extends DoorSelectorTabStyle>(
  styles: readonly T[],
  tab: number | "all",
  isDistributorActive: (distributorId: number) => boolean,
): T[] {
  return styles
    .filter((style) => isDistributorActive(style.distributorId))
    .filter((style) => tab === "all" || style.distributorId === tab);
}
