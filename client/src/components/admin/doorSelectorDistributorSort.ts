/** View-only distributor sort for the admin door selector. "manual" keeps saved order. */
export type DoorStyleDistributorSort = "manual" | "az" | "za";

export type DoorStyleDistributorFields = {
  ourName: string;
  supplierBrandName?: string | null;
  supplierName?: string | null;
};

/**
 * Distributor label already returned by doorStyles.listForAdmin:
 * distributors.brandName (supplierBrandName), else distributors.name (supplierName).
 * Blank means the style has no distributor to sort by.
 */
export function distributorSortName(style: Pick<DoorStyleDistributorFields, "supplierBrandName" | "supplierName">): string | null {
  const name = style.supplierBrandName?.trim() || style.supplierName?.trim() || "";
  return name || null;
}

/** A-Z or Z-A by distributor. Styles with no distributor stay last. Does not mutate the input. */
export function sortDoorStylesByDistributor<T extends DoorStyleDistributorFields>(
  styles: readonly T[],
  direction: Exclude<DoorStyleDistributorSort, "manual">,
  tieBreak: (a: T, b: T) => number,
): T[] {
  return styles.slice().sort((a, b) => {
    const aName = distributorSortName(a);
    const bName = distributorSortName(b);
    if (aName && bName) {
      const cmp = aName.localeCompare(bName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return direction === "az" ? cmp : -cmp;
    } else if (!aName && bName) {
      return 1;
    } else if (aName && !bName) {
      return -1;
    }
    return tieBreak(a, b);
  });
}
