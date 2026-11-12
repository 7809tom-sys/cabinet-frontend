/**
 * Every kitchen rule the auto-designer reads, in one place.
 *
 * Each entry is one independently keyed setting: one row in
 * `cabinet_dealz.kitchen_rule_settings`, one value in the admin table, one
 * number/toggle/choice the Designer reads. `key` is unique by construction and
 * is enforced unique by the table, so no two rules can ever share a value.
 *
 * This registry is the DEFAULT side of the pair. Code defaults live here and in
 * `kitchenRuleParameters.ts`; an admin override lives in the database. Until an
 * admin saves a different value the Designer reads the default, so adding a rule
 * here never changes a plan on its own.
 *
 * `locked` marks a rule Tom made mandatory (bridge above the range, a faucet at
 * the sink, windows never move). A locked rule is shown in the admin table with
 * a lock, cannot be deleted, and cannot be switched off. Its number can still be
 * read for reference, but the Designer ignores any attempted override so the
 * hard rule cannot be softened from a screen.
 */

export type KitchenRuleValueType = "number" | "toggle" | "text" | "choice";

export type KitchenRuleSettingDefinition = {
  /** Stable, unique setting key. Also the Designer's parameter name. */
  key: string;
  title: string;
  description: string;
  category: string;
  valueType: KitchenRuleValueType;
  defaultValue: number | string;
  /** Inches, inches of counter, or a plain count. Shown after the input. */
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  /** Allowed values for a `choice` rule. */
  options?: readonly string[];
  /**
   * Tom's mandatory rules. Shown with a lock, cannot be deleted or disabled,
   * and the Designer ignores an override of the value.
   */
  locked?: boolean;
  /**
   * The module that reads this value, or "guidance" when nothing executes it.
   * Admins see this so a rule that is only guidance is never mistaken for one
   * that moves cabinets.
   */
  appliedBy: string;
};

/** Plain English for the `appliedBy` field, shared by the table and the dialog. */
export const KITCHEN_RULE_APPLIED_BY_LABEL: Record<string, string> = {
  designerLayoutRules: "Auto-Design wiggle and layout pass",
  autoDesignAnchors: "Auto-Design anchor seating",
  autoDesignCornerSeating: "Auto-Design corner seating",
  smallGapFiller: "Filler prompt and auto-filler",
  autoDesignSeamFillers: "Auto-Design seam filler",
  autoDesignLeftover: "Auto-Design leftover fill",
  automaticDesigner: "Auto-Design and plan review",
  kitchenAdjacency: "Range bridge and plan review",
  autoDesignRangeHood: "Auto-Design hood height",
  dishwasherPanelRule: "Auto-Design dishwasher panel",
  autoDesignTallCabinets: "Auto-Design tall cabinet seating",
  autoDesignSinkLanding: "Auto-Design sink landing and sink seating",
  designerFaceRules: "Upper height pass",
  exposedSidePanels: "Exposed-side panel engine",
  design: "Designer geometry",
  kitchenUsage: "Usage question and baking zone",
  stockPrompt: "Out-of-stock prompt",
  inventoryAlternatives: "Out-of-stock sink base substitution",
  kitchenRulesGuidance: "Guidance only — plan review and the AI prompt",
};

export const KITCHEN_RULE_CATEGORIES = [
  "Wiggle room",
  "Fillers",
  "Cabinet widths",
  "Corners",
  "Upper heights",
  "Range and hood",
  "Sink and appliances",
  "Panels",
  "Tall and dishwasher",
  "Locked hard rules",
  "Guidance",
] as const;

export const KITCHEN_RULE_DEFINITIONS: readonly KitchenRuleSettingDefinition[] = [
  // ── Wiggle room ────────────────────────────────────────────────────────────
  {
    key: "jog_max_in",
    title: "Wiggle room for a placed cabinet",
    description:
      "How far the fit may slide a cabinet that is not an anchor, left or right along its own wall. The smallest shift that works is always used.",
    category: "Wiggle room",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 12,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "anchor_wiggle_cap_in",
    title: "Wiggle room for appliances",
    description:
      "Every appliance — the range, refrigerator, sink base, and dishwasher — may slide at most this far each way from the measured center. A sink base also keeps its sink on the window within this cap. Windows never move.",
    category: "Wiggle room",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 12,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "sink_shift_limit_in",
    title: "Sink base shift cap",
    description: "How far the gap solver may slide the sink base from the measured sink center. The faucet stays on that base.",
    category: "Wiggle room",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 12,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "measured_fridge_corner_shift_in",
    title: "Measured refrigerator corner slide",
    description:
      "A refrigerator the customer measured may slide this far away from a corner while a corner cabinet is seated. The refrigerator bay gap-closing slide is separate.",
    category: "Wiggle room",
    valueType: "number",
    defaultValue: 12,
    unit: "in",
    step: 0.5,
    min: 0,
    max: 36,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "refrigerator_shift_limit_in",
    title: "Refrigerator bay gap-closing slide",
    description: "How far the whole refrigerator bay (its panels and the cabinet above) may slide to close a gap at the end of a run.",
    category: "Wiggle room",
    valueType: "number",
    defaultValue: 6,
    unit: "in",
    step: 0.5,
    min: 0,
    max: 24,
    appliedBy: "autoDesignCornerSeating",
  },

  // ── Fillers ────────────────────────────────────────────────────────────────
  {
    key: "filler_preference_order",
    title: "Preference when a gap is left",
    description:
      "Which answer Auto-Design tries first for a leftover opening. Cabinet first grows or swaps in a real cabinet and leaves filler until last. Filler first closes the seam immediately.",
    category: "Fillers",
    valueType: "choice",
    defaultValue: "cabinet-first",
    options: ["cabinet-first", "filler-first"],
    appliedBy: "automaticDesigner",
  },
  {
    key: "filler_gap_max_in",
    title: "Widest seam that may be filled",
    description: "A measured gap wider than this is never closed with a filler alone. It needs a real cabinet or a plan change.",
    category: "Fillers",
    valueType: "number",
    defaultValue: 6,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 24,
    appliedBy: "smallGapFiller",
  },
  {
    key: "filler_min_in",
    title: "Narrowest filler worth cutting",
    description: "A seam narrower than this is tape-measure noise and no filler is ordered for it.",
    category: "Fillers",
    valueType: "number",
    defaultValue: 0,
    unit: "in",
    step: 0.0625,
    min: 0,
    max: 6,
    appliedBy: "smallGapFiller",
  },
  {
    key: "auto_place_filler_max_in",
    title: "Leftover filled with no question",
    description:
      "A leftover at or below this width gets its filler placed automatically. A wider seam, up to the widest seam that may be filled, waits for a choice.",
    category: "Fillers",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 24,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "seam_filler_max_in",
    title: "Widest seam Auto-Design closes by itself",
    description: "Auto-Design closes a run seam up to this width with one filler board and no prompt.",
    category: "Fillers",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 24,
    appliedBy: "autoDesignSeamFillers",
  },

  // ── Cabinet widths ─────────────────────────────────────────────────────────
  {
    key: "narrow_cabinet_max_in",
    title: "Widest cabinet that still counts as narrow",
    description:
      "A leftover opening is offered a real cabinet up to this wide (a 9 or 12 inch spice or tray base) before any filler is considered.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 12,
    unit: "in",
    step: 1,
    min: 0,
    max: 24,
    appliedBy: "autoDesignLeftover",
  },
  {
    key: "undersized_cabinet_in",
    title: "Cabinet width that scores as undersized",
    description: "In the fit score, a cabinet narrower than this counts as a poor fill and is avoided when something wider belongs there.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 12,
    unit: "in",
    step: 1,
    min: 0,
    max: 24,
    appliedBy: "designerLayoutRules",
  },
  {
    key: "range_fridge_min_cabinet_in",
    title: "Cabinet between the range and the refrigerator",
    description:
      "When the range and the refrigerator share a run, at least one real cabinet this wide must sit between them. Fillers and panels do not count.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 15,
    unit: "in",
    step: 1,
    min: 0,
    max: 36,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "heavy_cook_landing_in",
    title: "Heavy-cooking counter beside the range",
    description: "A household that cooks a lot keeps this much open counter on both sides of the range.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 15,
    unit: "in",
    step: 1,
    min: 0,
    max: 36,
    appliedBy: "kitchenUsage",
  },
  {
    key: "small_cabinet_below_in",
    title: "Width below which a base counts as small",
    description: "Beside a heavy-cooking range, a base narrower than this is treated as too small to land on.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 15,
    unit: "in",
    step: 1,
    min: 0,
    max: 36,
    appliedBy: "kitchenUsage",
  },
  {
    key: "range_landing_short_in",
    title: "Range landing, shorter side",
    description: "A range with no heavy-cooking profile needs at least this much counter on its shorter side.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 12,
    unit: "in",
    step: 1,
    min: 0,
    max: 36,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "range_landing_long_in",
    title: "Range landing, longer side",
    description: "A range with no heavy-cooking profile needs at least this much counter on its longer side.",
    category: "Cabinet widths",
    valueType: "number",
    defaultValue: 15,
    unit: "in",
    step: 1,
    min: 0,
    max: 36,
    appliedBy: "kitchenAdjacency",
  },

  // ── Corners ────────────────────────────────────────────────────────────────
  {
    key: "corner_preference_order",
    title: "Corner logic",
    description:
      "The order Auto-Design tries corner cabinets in when the customer has not picked one. Every type named here must be a corner the selected line actually sells.",
    category: "Corners",
    valueType: "text",
    defaultValue: "lazy-susan,diagonal,blind,angled-l,corner-drawer",
    appliedBy: "automaticDesigner",
  },
  {
    key: "blind_open_leg_in",
    title: "Blind corner open leg",
    description: "The open leg a blind corner needs: base depth plus its required filler.",
    category: "Corners",
    valueType: "number",
    defaultValue: 27,
    unit: "in",
    step: 0.5,
    min: 0,
    max: 48,
    appliedBy: "autoDesignCornerSeating",
  },
  {
    key: "u_shape_corner_count",
    title: "Corners in a U-shaped kitchen",
    description: "How many corner cabinets a U-shaped Auto-Design kitchen has.",
    category: "Corners",
    valueType: "number",
    defaultValue: 2,
    step: 1,
    min: 0,
    max: 4,
    appliedBy: "autoDesignCornerSeating",
  },

  // ── Upper heights ──────────────────────────────────────────────────────────
  {
    key: "wall_bottom_in",
    title: "Wall cabinet bottom line",
    description: "Standard wall cabinets hang with their bottom at this height above the floor.",
    category: "Upper heights",
    valueType: "number",
    defaultValue: 54,
    unit: "in",
    step: 0.5,
    min: 36,
    max: 72,
    appliedBy: "designerFaceRules",
  },
  {
    key: "run_top_in",
    title: "Height a wall run tops out at",
    description: "Wall runs and range bridges are aligned so their top line lands here.",
    category: "Upper heights",
    valueType: "number",
    defaultValue: 96,
    unit: "in",
    step: 0.5,
    min: 72,
    max: 120,
    appliedBy: "designerFaceRules",
  },
  {
    key: "window_cabinet_height_in",
    title: "Wall cabinet height beside a window",
    description: "The wall cabinet height that the window-side panel and filler rules treat as the standard box.",
    category: "Upper heights",
    valueType: "number",
    defaultValue: 30,
    unit: "in",
    step: 1,
    min: 12,
    max: 48,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "window_filler_max_in",
    title: "Filler beside a window",
    description: "A gap to the window casing at or below this width gets a filler instead of a panel.",
    category: "Upper heights",
    valueType: "number",
    defaultValue: 3,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 12,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "window_framed_panel",
    title: "Panel on a framed line beside a window",
    description: "On turns it on: a framed line also gets a finished panel beside a window, not only a filler.",
    category: "Upper heights",
    valueType: "toggle",
    defaultValue: 0,
    appliedBy: "exposedSidePanels",
  },

  // ── Range and hood ─────────────────────────────────────────────────────────
  {
    key: "bridge_above_range_required",
    title: "Bridge cabinet above the range",
    description:
      "Hard rule from Tom. Every range keeps a bridge cabinet above it. This cannot be switched off and its value cannot be overridden.",
    category: "Locked hard rules",
    valueType: "toggle",
    defaultValue: 1,
    locked: true,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "bridge_hung_bottom_in",
    title: "Bridge bottom when a hood or microwave hangs below",
    description: "The bridge cabinet's bottom line when something hangs under it.",
    category: "Range and hood",
    valueType: "number",
    defaultValue: 72,
    unit: "in",
    step: 0.5,
    min: 48,
    max: 96,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "bridge_upper_height_in",
    title: "Wall run height beside the range",
    description:
      "The wall cabinet height the range's neighbours run at. The bridge above the range is not a stored height: it is whatever lands its top on this run's top line (54 plus this height). 30 inch uppers finish at 84, so the bridge is a 12 inch W3012. 42 inch uppers finish at 96, so that bridge is 24 inches.",
    category: "Range and hood",
    valueType: "number",
    defaultValue: 30,
    unit: "in",
    step: 1,
    min: 12,
    max: 48,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "bridge_open_bottom_in",
    title: "Bridge bottom when nothing hangs below",
    description: "The bridge cabinet's bottom line when nothing hangs under it. Its height still comes from the wall run beside it.",
    category: "Range and hood",
    valueType: "number",
    defaultValue: 66,
    unit: "in",
    step: 0.5,
    min: 48,
    max: 96,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "hood_bottom_in",
    title: "Hood bottom height",
    description: "The range hood bottom stays at this height above the floor.",
    category: "Range and hood",
    valueType: "number",
    defaultValue: 60,
    unit: "in",
    step: 1,
    min: 48,
    max: 84,
    appliedBy: "autoDesignRangeHood",
  },
  {
    key: "standard_hood_bottom_in",
    title: "Hood bottom for every hood but the 42 inch hood",
    description: "Every hood except the 42 inch hood is mounted with its bottom at this height.",
    category: "Range and hood",
    valueType: "number",
    defaultValue: 54,
    unit: "in",
    step: 1,
    min: 42,
    max: 84,
    appliedBy: "autoDesignRangeHood",
  },

  // ── Sink and appliances ────────────────────────────────────────────────────
  {
    key: "faucet_at_sink_required",
    title: "Faucet at the sink",
    description:
      "Hard rule from Tom. Every sink Auto-Design places gets one deck-mounted faucet, on every build and on every older plan that is opened. This cannot be switched off and its value cannot be overridden.",
    category: "Locked hard rules",
    valueType: "toggle",
    defaultValue: 1,
    locked: true,
    appliedBy: "automaticDesigner",
  },
  {
    key: "window_never_moves",
    title: "Window never moves",
    description:
      "Hard rule from Tom. A measured window keeps the height and position the customer gave it. No fit pass, filler, cabinet or appliance may slide a window. This cannot be switched off and its value cannot be overridden.",
    category: "Locked hard rules",
    valueType: "toggle",
    defaultValue: 1,
    locked: true,
    appliedBy: "designerFaceRules",
  },
  {
    key: "sink_base_default_in",
    title: "Default sink base width",
    description: "The sink base Auto-Design picks unless the customer chooses another size or a farmhouse base.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 36,
    unit: "in",
    step: 3,
    min: 24,
    max: 48,
    appliedBy: "automaticDesigner",
  },
  {
    key: "sink_dishwasher_max_gap_in",
    title: "Dishwasher distance from the sink",
    description: "The dishwasher is seated against the sink and re-checked against this distance after any shift.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 36,
    unit: "in",
    step: 1,
    min: 0,
    max: 72,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "dishwasher_corner_clear_in",
    title: "Standing space between the dishwasher and a corner",
    description: "A dishwasher against an inside corner needs this much standing space at right angles to it.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 21,
    unit: "in",
    step: 1,
    min: 0,
    max: 48,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "dishwasher_corner_min_in",
    title: "Side gap when a corner cannot be avoided",
    description: "If the standing space is impossible, the dishwasher side still needs this much gap.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 2,
    unit: "in",
    step: 0.5,
    min: 0,
    max: 24,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "sink_landing_long_in",
    title: "Sink landing, longer side",
    description: "One side of the sink needs this much counter.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 24,
    unit: "in",
    step: 1,
    min: 0,
    max: 48,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "sink_landing_short_in",
    title: "Sink landing, shorter side",
    description: "The other side of the sink needs this much counter.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 18,
    unit: "in",
    step: 1,
    min: 0,
    max: 48,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "sink_tall_landing_in",
    title: "Landing between the sink base and a tall unit",
    description:
      "A real base cabinet (and its countertop) stands between the sink base and a tall cabinet or refrigerator. The sink base is never the last box at the end of a run that butts a tall unit; it keeps at least this much usable counter between the two.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 18,
    unit: "in",
    step: 1,
    min: 0,
    max: 48,
    appliedBy: "autoDesignSinkLanding",
  },
  {
    key: "sink_front_setback_in",
    title: "Sink front setback",
    description:
      "How far the basin sits back from the finished countertop front edge. The approved range is 2 to 2½ inches; 2 inches is the default. The sink stays centered on its own sink base.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 2,
    unit: "in",
    step: 0.25,
    min: 2,
    max: 2.5,
    appliedBy: "autoDesignSinkLanding",
  },
  {
    key: "fridge_landing_in",
    title: "Refrigerator landing",
    description: "The refrigerator handle side needs this much counter, or the same amount across an aisle.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 15,
    unit: "in",
    step: 1,
    min: 0,
    max: 48,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "fridge_hinge_clear_in",
    title: "Refrigerator hinge-side clearance",
    description: "A refrigerator hinge side that lands on a wall needs this much filler or panel.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 2.5,
    unit: "in",
    step: 0.25,
    min: 0,
    max: 12,
    appliedBy: "kitchenAdjacency",
  },
  {
    key: "baking_zone_min_in",
    title: "Baking zone beside the range",
    description: "A household that bakes a lot reserves this much uninterrupted counter beside the range.",
    category: "Sink and appliances",
    valueType: "number",
    defaultValue: 36,
    unit: "in",
    step: 1,
    min: 0,
    max: 72,
    appliedBy: "kitchenUsage",
  },
  {
    key: "sink_base_substitute",
    title: "Substitute an out-of-stock sink base",
    description: "On turns it on: an out-of-stock SBxx sink base is swapped for the mapped base of the same width, and the shop fits a false front.",
    category: "Sink and appliances",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "inventoryAlternatives",
  },
  {
    key: "sink_base_map",
    title: "Sink base substitution map",
    description: "The prefix pair used when a sink base is out of stock, written as SBxx->Bxx.",
    category: "Sink and appliances",
    valueType: "text",
    defaultValue: "SBxx->Bxx",
    appliedBy: "inventoryAlternatives",
  },
  {
    key: "stock_prompt_enabled",
    title: "Ask before replacing an out-of-stock cabinet",
    description: "On turns it on: the Designer asks before it changes a plan for stock.",
    category: "Sink and appliances",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "stockPrompt",
  },
  {
    key: "stock_prompts",
    title: "Out-of-stock choices by SKU",
    description: "SKU:option,option entries separated by semicolons. Options are full-height, drawer, and readjust.",
    category: "Sink and appliances",
    valueType: "text",
    defaultValue: "B18:full-height,drawer,readjust",
    appliedBy: "stockPrompt",
  },

  // ── Panels ─────────────────────────────────────────────────────────────────
  {
    key: "exposed_panels_enabled",
    title: "Exposed-side panel engine",
    description: "The master switch for the broad exposed-side panel engine. The narrow auto panels on frameless and Hickory lines still run.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 0,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_thickness_in",
    title: "Finished panel thickness",
    description: "The stock thickness of every finished end panel the Designer adds.",
    category: "Panels",
    valueType: "number",
    defaultValue: 0.75,
    unit: "in",
    step: 0.25,
    min: 0.25,
    max: 1.5,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_end_wall_enabled",
    title: "Panel at a run end against a wall",
    description: "A cabinet whose side meets a wall gets a finished panel on that side.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_dw_enabled",
    title: "Panel on an exposed dishwasher side",
    description: "A dishwasher with an exposed side, or a cabinet side facing the dishwasher, gets a finished panel.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_fridge_enabled",
    title: "Refrigerator end panel",
    description: "A refrigerator that stands alone or ends a run gets a tall end panel.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_island_enabled",
    title: "Island and peninsula panels",
    description: "Exposed island and peninsula ends and backs get a finished panel.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_window_enabled",
    title: "Panel beside a window",
    description: "A wall cabinet next to a window gets a finished panel on the window side.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_open_enabled",
    title: "Panel on an open run end",
    description: "An end of a run that stands in the open gets a finished panel.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_wall_end_enabled",
    title: "Panel at a wall return",
    description: "A cabinet that dies into a wall return gets a finished panel on that side.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },
  {
    key: "panel_tall_enabled",
    title: "Panel on a tall run end",
    description: "A tall cabinet at the end of a run gets a finished panel.",
    category: "Panels",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "exposedSidePanels",
  },

  // ── Tall and dishwasher ────────────────────────────────────────────────────
  {
    key: "tall_at_run_end",
    title: "Pantry and oven tower at the end of a run",
    description:
      "On turns it on: a tall box closes a run at the run end or the end of a free span, never in the middle of the first gap that fits.",
    category: "Tall and dishwasher",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "autoDesignTallCabinets",
  },
  {
    key: "dishwasher_panel_enabled",
    title: "Dishwasher panel at the end of a run",
    description: "A dishwasher that ends a run gets a DWR dishwasher panel in the Designer's panel system.",
    category: "Tall and dishwasher",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "dishwasherPanelRule",
  },
  {
    key: "dishwasher_panel_forty_five_enabled",
    title: "Dishwasher panel at a 45-degree turn",
    description: "A run that turns at 45 degrees on the dishwasher gets the same DWR panel in the fitted corner slot.",
    category: "Tall and dishwasher",
    valueType: "toggle",
    defaultValue: 1,
    appliedBy: "dishwasherPanelRule",
  },
];

const BY_KEY = new Map(KITCHEN_RULE_DEFINITIONS.map((definition) => [definition.key, definition]));

export function kitchenRuleDefinition(key: string): KitchenRuleSettingDefinition | undefined {
  return BY_KEY.get(key);
}

/** Keys the Designer can read as a number. Every one has a numeric default. */
export type KitchenRuleNumericKey =
  | "jog_max_in"
  | "anchor_wiggle_cap_in"
  | "sink_shift_limit_in"
  | "measured_fridge_corner_shift_in"
  | "refrigerator_shift_limit_in"
  | "filler_gap_max_in"
  | "filler_min_in"
  | "auto_place_filler_max_in"
  | "seam_filler_max_in"
  | "narrow_cabinet_max_in"
  | "undersized_cabinet_in"
  | "range_fridge_min_cabinet_in"
  | "range_landing_short_in"
  | "range_landing_long_in"
  | "heavy_cook_landing_in"
  | "small_cabinet_below_in"
  | "blind_open_leg_in"
  | "u_shape_corner_count"
  | "wall_bottom_in"
  | "run_top_in"
  | "window_cabinet_height_in"
  | "window_filler_max_in"
  | "window_framed_panel"
  | "bridge_above_range_required"
  | "bridge_hung_bottom_in"
  | "bridge_upper_height_in"
  | "bridge_open_bottom_in"
  | "hood_bottom_in"
  | "standard_hood_bottom_in"
  | "faucet_at_sink_required"
  | "window_never_moves"
  | "sink_base_default_in"
  | "sink_dishwasher_max_gap_in"
  | "dishwasher_corner_clear_in"
  | "dishwasher_corner_min_in"
  | "sink_landing_long_in"
  | "sink_landing_short_in"
  | "sink_tall_landing_in"
  | "sink_front_setback_in"
  | "fridge_landing_in"
  | "fridge_hinge_clear_in"
  | "baking_zone_min_in"
  | "sink_base_substitute"
  | "stock_prompt_enabled"
  | "exposed_panels_enabled"
  | "panel_thickness_in"
  | "panel_end_wall_enabled"
  | "panel_dw_enabled"
  | "panel_fridge_enabled"
  | "panel_island_enabled"
  | "panel_window_enabled"
  | "panel_open_enabled"
  | "panel_wall_end_enabled"
  | "panel_tall_enabled"
  | "tall_at_run_end"
  | "dishwasher_panel_enabled"
  | "dishwasher_panel_forty_five_enabled";

function defaultNumber(key: KitchenRuleNumericKey): number {
  const value = BY_KEY.get(key)?.defaultValue;
  return typeof value === "number" ? value : 0;
}

/** Code defaults, one entry per numeric rule. An override never rewrites this. */
export const KITCHEN_RULE_PARAMETER_DEFAULTS: Record<KitchenRuleNumericKey, number> = {
  jog_max_in: defaultNumber("jog_max_in"),
  anchor_wiggle_cap_in: defaultNumber("anchor_wiggle_cap_in"),
  sink_shift_limit_in: defaultNumber("sink_shift_limit_in"),
  measured_fridge_corner_shift_in: defaultNumber("measured_fridge_corner_shift_in"),
  refrigerator_shift_limit_in: defaultNumber("refrigerator_shift_limit_in"),
  filler_gap_max_in: defaultNumber("filler_gap_max_in"),
  filler_min_in: defaultNumber("filler_min_in"),
  auto_place_filler_max_in: defaultNumber("auto_place_filler_max_in"),
  seam_filler_max_in: defaultNumber("seam_filler_max_in"),
  narrow_cabinet_max_in: defaultNumber("narrow_cabinet_max_in"),
  undersized_cabinet_in: defaultNumber("undersized_cabinet_in"),
  range_fridge_min_cabinet_in: defaultNumber("range_fridge_min_cabinet_in"),
  range_landing_short_in: defaultNumber("range_landing_short_in"),
  range_landing_long_in: defaultNumber("range_landing_long_in"),
  heavy_cook_landing_in: defaultNumber("heavy_cook_landing_in"),
  small_cabinet_below_in: defaultNumber("small_cabinet_below_in"),
  blind_open_leg_in: defaultNumber("blind_open_leg_in"),
  u_shape_corner_count: defaultNumber("u_shape_corner_count"),
  wall_bottom_in: defaultNumber("wall_bottom_in"),
  run_top_in: defaultNumber("run_top_in"),
  window_cabinet_height_in: defaultNumber("window_cabinet_height_in"),
  window_filler_max_in: defaultNumber("window_filler_max_in"),
  window_framed_panel: defaultNumber("window_framed_panel"),
  bridge_above_range_required: defaultNumber("bridge_above_range_required"),
  bridge_hung_bottom_in: defaultNumber("bridge_hung_bottom_in"),
  bridge_upper_height_in: defaultNumber("bridge_upper_height_in"),
  bridge_open_bottom_in: defaultNumber("bridge_open_bottom_in"),
  hood_bottom_in: defaultNumber("hood_bottom_in"),
  standard_hood_bottom_in: defaultNumber("standard_hood_bottom_in"),
  faucet_at_sink_required: defaultNumber("faucet_at_sink_required"),
  window_never_moves: defaultNumber("window_never_moves"),
  sink_base_default_in: defaultNumber("sink_base_default_in"),
  sink_dishwasher_max_gap_in: defaultNumber("sink_dishwasher_max_gap_in"),
  dishwasher_corner_clear_in: defaultNumber("dishwasher_corner_clear_in"),
  dishwasher_corner_min_in: defaultNumber("dishwasher_corner_min_in"),
  sink_landing_long_in: defaultNumber("sink_landing_long_in"),
  sink_landing_short_in: defaultNumber("sink_landing_short_in"),
  sink_tall_landing_in: defaultNumber("sink_tall_landing_in"),
  sink_front_setback_in: defaultNumber("sink_front_setback_in"),
  fridge_landing_in: defaultNumber("fridge_landing_in"),
  fridge_hinge_clear_in: defaultNumber("fridge_hinge_clear_in"),
  baking_zone_min_in: defaultNumber("baking_zone_min_in"),
  sink_base_substitute: defaultNumber("sink_base_substitute"),
  stock_prompt_enabled: defaultNumber("stock_prompt_enabled"),
  exposed_panels_enabled: defaultNumber("exposed_panels_enabled"),
  panel_thickness_in: defaultNumber("panel_thickness_in"),
  panel_end_wall_enabled: defaultNumber("panel_end_wall_enabled"),
  panel_dw_enabled: defaultNumber("panel_dw_enabled"),
  panel_fridge_enabled: defaultNumber("panel_fridge_enabled"),
  panel_island_enabled: defaultNumber("panel_island_enabled"),
  panel_window_enabled: defaultNumber("panel_window_enabled"),
  panel_open_enabled: defaultNumber("panel_open_enabled"),
  panel_wall_end_enabled: defaultNumber("panel_wall_end_enabled"),
  panel_tall_enabled: defaultNumber("panel_tall_enabled"),
  tall_at_run_end: defaultNumber("tall_at_run_end"),
  dishwasher_panel_enabled: defaultNumber("dishwasher_panel_enabled"),
  dishwasher_panel_forty_five_enabled: defaultNumber("dishwasher_panel_forty_five_enabled"),
};

/** Text rules with a code default, read through `kitchenRuleText`. */
export const KITCHEN_RULE_TEXT_DEFAULTS = {
  filler_preference_order: "cabinet-first",
  corner_preference_order: "lazy-susan,diagonal,blind,angled-l,corner-drawer",
  sink_base_map: "SBxx->Bxx",
  stock_prompts: "B18:full-height,drawer,readjust",
} as const;

export type KitchenRuleTextKey = keyof typeof KITCHEN_RULE_TEXT_DEFAULTS;

/** True when this rule is one of Tom's mandatory hard rules. */
export function kitchenRuleIsLocked(key: string): boolean {
  return BY_KEY.get(key)?.locked === true;
}

/** Rules the Designer executes. Everything else is guidance shown in review. */
export function kitchenRuleExecutes(key: string): boolean {
  return BY_KEY.get(key)?.appliedBy !== "kitchenRulesGuidance";
}
