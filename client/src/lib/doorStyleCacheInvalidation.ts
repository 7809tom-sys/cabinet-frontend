/**
 * PRIORITY: one place that clears the door-style caches a kitchen reads.
 *
 * Owner rule: accepting a new render must flow into kitchens with no manual step.
 * The Designer and the kitchen render read `doorStyles.list` (and
 * `doorStyles.acceptedAppearance`); the admin screens read different queries. If a
 * save or an approval only invalidates the admin queries, an admin can approve a
 * render and still see the old color in a kitchen until the page reloads.
 *
 * Every admin write that can change a style's appearance calls this, so there is
 * one list to keep right instead of one per screen.
 */

type Invalidate = { invalidate: () => unknown | Promise<unknown> };

export type DoorStyleCacheUtils = {
  doorStyles?: {
    list?: Invalidate;
    acceptedAppearance?: Invalidate;
    byId?: Invalidate;
    featured?: Invalidate;
    listForAdmin?: Invalidate;
    skuCountsByStyle?: Invalidate;
  };
  design?: {
    placeableCabinets?: Invalidate;
  };
};

/**
 * Invalidate every query whose answer depends on a style's appearance.
 *
 * Safe to call with any subset of the utils (a screen may only have some), and
 * safe to call after a failure: it never throws.
 */
export function invalidateDoorStyleCaches(utils: DoorStyleCacheUtils | null | undefined): string[] {
  if (!utils) return [];
  const cleared: string[] = [];
  const run = (name: string, query: Invalidate | undefined) => {
    if (!query) return;
    try {
      void query.invalidate();
      cleared.push(name);
    } catch {
      // A missing or unmounted query must never break the caller's save.
    }
  };
  // The kitchen's own reads first: these are the ones an approval must reach.
  run("doorStyles.list", utils.doorStyles?.list);
  run("doorStyles.acceptedAppearance", utils.doorStyles?.acceptedAppearance);
  run("doorStyles.byId", utils.doorStyles?.byId);
  run("design.placeableCabinets", utils.design?.placeableCabinets);
  // Admin surfaces.
  run("doorStyles.listForAdmin", utils.doorStyles?.listForAdmin);
  run("doorStyles.featured", utils.doorStyles?.featured);
  run("doorStyles.skuCountsByStyle", utils.doorStyles?.skuCountsByStyle);
  return cleared;
}

/** The kitchen queries an approval must reach. Named for tests and review. */
export const KITCHEN_DOOR_STYLE_QUERIES = ["doorStyles.list", "doorStyles.acceptedAppearance"] as const;
