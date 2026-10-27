/**
 * Auto-Design is the measured kitchen build. A refrigerator already
 * in the layout turns that mode off and grays the control out. Turning it off
 * never rebuilds or clears the plan.
 */

export const AUTO_DESIGN_REFRIGERATOR_NOTE =
  "Auto-Design isn't available with a refrigerator in the layout.";

export type RefrigeratorLike = {
  uid?: string;
  masterCode?: string | null;
  description?: string | null;
  placement?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

/**
 * Any refrigerator appliance, including panel-ready and built-in units.
 * Refrigerator wall cabinets, bridges, and end panels are not the appliance.
 */
export function isRefrigeratorAppliance(item: RefrigeratorLike): boolean {
  const code = (item.masterCode ?? "").trim().toUpperCase();
  const description = item.description ?? "";
  const hay = `${code} ${description}`.toLowerCase();
  const placement = (item.placement ?? "").trim().toLowerCase();
  if (/\bend panel\b|\bwall cabinet\b|\bbridge\b|\bcabinet above\b/.test(hay) && !/^FRIDGE-/.test(code)) return false;
  if (placement === "wall" || placement === "base" || placement === "basetop" || placement === "undercabinet") return false;
  if (/^FRIDGE-/.test(code)) return true;
  if (!/\b(?:refrigerators?|fridges?)\b/.test(hay)) return false;
  if (placement && placement !== "appliance" && placement !== "tall") return false;
  return true;
}

export function layoutHasRefrigerator(items: readonly RefrigeratorLike[]): boolean {
  return items.some(isRefrigeratorAppliance);
}

/**
 * A refrigerator placed by the in-progress Auto-Design anchor step is part of
 * that build. Any other refrigerator means the layout is a fridge-plus-cabinet
 * plan and Auto-Design must stop.
 */
export function refrigeratorBlocksAutoDesign(
  items: readonly RefrigeratorLike[],
  sessionAnchorUids: ReadonlySet<string>,
): boolean {
  return items.some((item) => isRefrigeratorAppliance(item) && (!item.uid || !sessionAnchorUids.has(item.uid)));
}

export type AutoDesignControl = {
  shown: boolean;
  enabled: boolean;
  title: string;
  /** Visible explanation while the control is grayed out because of a refrigerator. */
  refrigeratorNote: string | null;
};

export function autoDesignControlState(input: {
  audienceAllowed: boolean;
  layoutLocked: boolean;
  placedCount: number;
  hasRefrigerator: boolean;
}): AutoDesignControl {
  if (!input.audienceAllowed) {
    return { shown: false, enabled: false, title: "", refrigeratorNote: null };
  }
  if (input.hasRefrigerator) {
    return {
      shown: true,
      enabled: false,
      title: AUTO_DESIGN_REFRIGERATOR_NOTE,
      refrigeratorNote: AUTO_DESIGN_REFRIGERATOR_NOTE,
    };
  }
  if (input.layoutLocked || input.placedCount > 0) {
    return {
      shown: true,
      enabled: false,
      title: "Start Auto-Design from an empty Designer",
      refrigeratorNote: null,
    };
  }
  return {
    shown: true,
    enabled: true,
    title: "Auto-Design a kitchen from four fixed fixture anchors",
    refrigeratorNote: null,
  };
}

/**
 * True only when a refrigerator outside the active anchor set appears while
 * Auto-Design is open. Callers close the dialog and drop the corner stage.
 * They must not call the layout completer or the cancel path that empties the plan.
 */
export function autoDesignShouldTurnOffForRefrigerator(input: {
  blockedByRefrigerator: boolean;
  dialogOpen: boolean;
  cornerStageActive: boolean;
}): boolean {
  return input.blockedByRefrigerator && (input.dialogOpen || input.cornerStageActive);
}
