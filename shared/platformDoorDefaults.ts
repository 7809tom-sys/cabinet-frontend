/**
 * PLATFORM DEFAULT DOOR STYLE (Tom, voice, Nov 21 2026, 1:54 PM CT).
 *
 * DL Shaker is the default starter door style and blueprint for EVERY distributor
 * on the CabinetDealz platform. When a distributor has no saved door style, the door
 * editor and the Door Box Blueprint screen start on DL Shaker. The other approved
 * styles (raised panel, slim shaker, slab) are offered alongside it.
 *
 * - New records start on the default: the admin "New Door Style" dialog opens with
 *   door style type "Shaker", and the vendor sample-measurement sheet starts on
 *   "Shaker".
 * - Existing records are never rewritten. A style's saved `doorStyle` always wins
 *   (`starterDoorStyleFor`). A style saved blank stays blank until someone picks a
 *   style; the editors show the platform default as a hint and a one-click choice.
 * - "Shaker" resolves to the DL Shaker blueprint everywhere
 *   (DL_SHAKER_FIRM_RULE, shared/shakerDoorBlueprint.ts).
 *
 * No database default: distributor signup creates no door-style or blueprint rows,
 * so this constant is the single source the UI falls back to.
 * Rule doc: docs/rules/SHAKER_DOOR_RULE.md.
 */
export type ApprovedDoorStyle = {
  /** Stable id, also the Door Box Blueprint section id suffix. */
  id: "dl-shaker" | "raised-panel" | "slim-shaker" | "slab";
  label: string;
  /** Value written to door_styles.doorStyle when chosen. */
  doorStyle: "Shaker" | "Raised Panel" | "Slim Shaker" | "Slab";
  /** Builder in shared/doorBoxBlueprint.ts that draws it. */
  blueprint: "dlShakerDoorBox" | "raisedPanelDoorBox" | "slimShakerDoorBox" | "slabDoorBox";
};

export const PLATFORM_DEFAULT_DOOR_STYLE: ApprovedDoorStyle = {
  id: "dl-shaker",
  label: "DL Shaker",
  doorStyle: "Shaker",
  blueprint: "dlShakerDoorBox",
} as const;

/** Approved starter styles, platform default first. */
export const PLATFORM_APPROVED_DOOR_STYLES: readonly ApprovedDoorStyle[] = [
  PLATFORM_DEFAULT_DOOR_STYLE,
  { id: "raised-panel", label: "DL Raised Panel", doorStyle: "Raised Panel", blueprint: "raisedPanelDoorBox" },
  { id: "slim-shaker", label: "DL Slim Shaker", doorStyle: "Slim Shaker", blueprint: "slimShakerDoorBox" },
  { id: "slab", label: "Slab", doorStyle: "Slab", blueprint: "slabDoorBox" },
] as const;

/**
 * The door style a distributor's editor starts on: its own saved value when it has
 * one, otherwise the platform default. Never used to overwrite a saved value.
 */
export function starterDoorStyleFor(saved: string | null | undefined): string {
  const own = (saved ?? "").trim();
  return own || PLATFORM_DEFAULT_DOOR_STYLE.doorStyle;
}
