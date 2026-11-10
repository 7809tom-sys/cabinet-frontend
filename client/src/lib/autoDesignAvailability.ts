/**
 * Auto-Design is the measured kitchen build. A refrigerator already on the plan
 * does not turn that mode off: a placed refrigerator is a FIXED ANCHOR. The
 * build keeps it exactly where it is, reserves its floor space, and designs the
 * cabinets, corners, tall boxes and uppers around it.
 */

/**
 * Visible hint beside the Auto-Design control while a refrigerator is on the
 * plan. It says what the build will do with that refrigerator; it is never a
 * reason to gray the control out.
 */
export const AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE =
  "Your refrigerator stays where it is; Auto-Design designs the cabinets around it.";

/**
 * Visible explanation for the grayed-out case. Every surface prints this same
 * sentence for the same reason, so a phone never shows a bare disabled control
 * where the desktop explains why.
 */
export const AUTO_DESIGN_EMPTY_PLAN_NOTE = "Needs an empty plan";

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

/** The refrigerator Auto-Design adopts as a fixed anchor, or null when the plan has none. */
export function anchoredRefrigeratorOf<T extends RefrigeratorLike>(items: readonly T[]): T | null {
  return items.find(isRefrigeratorAppliance) ?? null;
}

export type AutoDesignControl = {
  shown: boolean;
  enabled: boolean;
  title: string;
  /**
   * The single visible sentence every surface (desktop toolbar, phone/tablet top
   * actions, More sheet) prints while the control is disabled. `null` when the
   * control is enabled or hidden, so no width invents a different reason.
   */
  blockedNote: string | null;
  /**
   * Visible hint while the control is ENABLED and a refrigerator is on the plan.
   * Null when there is no refrigerator, so the surfaces stay quiet.
   */
  refrigeratorAnchorNote: string | null;
};

/**
 * A pushed Pelican sink is a sink base plus one fixture on it. It is a fixture
 * choice, not hand-placed cabinet work, so Auto-Design can still run over it.
 * This is the bug owner hit: pushing a sink auto-placed its base, `placed.length`
 * went to 1, and Auto-Design grayed itself out and refused to build.
 */
export type AutoDesignPlacedLike = RefrigeratorLike & { uid?: string };

const SINK_BASE_CODE = /^(?:ADA-)?F?SB[-_ ]?\d|^CSB[-_ ]?\d|^(?:UV-)?SBF[-_ ]?\d|^(?:ADA-)?VSD?[-_ ]?\d/i;

export function isSinkBasePlacement(item: AutoDesignPlacedLike): boolean {
  const text = `${item.subCategory ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (item.placement === "appliance") return false;
  if (/\bsink\s*base\b|\bvanity\s*sink\b|\bsink\s*(?:floor|front)\b/.test(text)) return true;
  if (/\b(?:farm(?:house)?|apron)\b[^.]*\bsink\b/.test(text)) return true;
  return SINK_BASE_CODE.test((item.masterCode ?? "").trim());
}

/**
 * True when this placement is hand-placed cabinet work that makes the plan no
 * longer empty. A pushed sink base is a fixture choice, and a refrigerator is a
 * fixed anchor the build designs around, so neither one counts.
 */
export function autoDesignBlocksEmptyPlan(item: AutoDesignPlacedLike): boolean {
  return !isSinkBasePlacement(item) && !isRefrigeratorAppliance(item);
}

/** How many placements count as hand-placed work, i.e. what keeps Auto-Design off an occupied plan. */
export function autoDesignHandPlacedCount(items: readonly AutoDesignPlacedLike[]): number {
  return items.filter(autoDesignBlocksEmptyPlan).length;
}

export function autoDesignControlState(input: {
  /**
   * Whether Auto-Design is offered in this workspace at all. The Designer now
   * passes the kitchen-room flag here for every visitor — the old
   * admin/affiliate audience check is gone. Kept as a parameter so a caller
   * that does not offer the feature can hide every surface at once.
   */
  audienceAllowed: boolean;
  layoutLocked: boolean;
  /** Placements other than a pushed sink base or a refrigerator, so neither locks Auto-Design out. */
  placedCount: number;
  /**
   * True when a refrigerator is already on the plan. It becomes the build's
   * fixed anchor: it never disables the control, it only adds the visible hint.
   */
  refrigeratorAnchor?: boolean;
}): AutoDesignControl {
  if (!input.audienceAllowed) {
    return { shown: false, enabled: false, title: "", blockedNote: null, refrigeratorAnchorNote: null };
  }
  if (input.layoutLocked || input.placedCount > 0) {
    return {
      shown: true,
      enabled: false,
      title: "Start Auto-Design from an empty Designer",
      blockedNote: AUTO_DESIGN_EMPTY_PLAN_NOTE,
      refrigeratorAnchorNote: null,
    };
  }
  const anchorNote = input.refrigeratorAnchor ? AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE : null;
  return {
    shown: true,
    enabled: true,
    title: anchorNote
      ? "Auto-Design a kitchen around your refrigerator"
      : "Auto-Design a kitchen from four fixed fixture anchors",
    blockedNote: null,
    refrigeratorAnchorNote: anchorNote,
  };
}
