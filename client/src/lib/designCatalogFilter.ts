// ─── Optional designer catalog filter ────────────────────────────────────────
// DesignTool's one optional `catalogFilter` prop (approved by Tom, 5:02 PM CT,
// for the demo distributor designer). When the prop is omitted these helpers
// return their input unchanged (same reference), so the live designer and
// every other caller behave exactly as before.

/** The door-style fields the filter can look at (from doorStyles.list). */
export type DesignCatalogDoorStyle = {
  id: number;
  distributorId?: number | null;
  styleCode?: string | null;
  ourName?: string | null;
};

/** Return true to keep a door style (and its cabinet line) in the designer. */
export type DesignCatalogFilter = (style: DesignCatalogDoorStyle) => boolean;

export function filterDesignDoorStyles<T extends DesignCatalogDoorStyle>(
  styles: T[] | undefined,
  filter: DesignCatalogFilter | undefined,
): T[] | undefined {
  if (!filter || !styles) return styles;
  return styles.filter((style) => filter(style));
}

/** Keep only the supply lines that still have an allowed door style. */
export function filterDesignDistributors<D extends { id: number }>(
  distributors: D[] | undefined,
  allowedStyles: DesignCatalogDoorStyle[] | undefined,
  filter: DesignCatalogFilter | undefined,
): D[] | undefined {
  if (!filter || !distributors) return distributors;
  if (!allowedStyles) return [];
  const ids = new Set(allowedStyles.map((style) => style.distributorId).filter((id): id is number => id != null));
  return distributors.filter((distributor) => ids.has(distributor.id));
}
