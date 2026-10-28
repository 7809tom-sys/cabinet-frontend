import { KITCHEN_ADJACENCY_RULES } from "./kitchenAdjacencyRules";

export type KitchenRuleEnforcementKind = "auto" | "suggest" | "review" | "reference";
export type KitchenRuleImplementationStatus = "implemented" | "pending" | "reference";

export type KitchenRuleSeed = {
  ruleCode: string;
  category: string;
  title: string;
  ruleDescription: string;
  parameters: Record<string, number | string>;
  enforcementKind: KitchenRuleEnforcementKind;
  sourceText: string;
  implementationStatus: KitchenRuleImplementationStatus;
  readsParameters: boolean;
  notesText: string | null;
};

function categoryForResearchNumber(number: number): string {
  if (number <= 3) return "Placement order";
  if (number <= 10) return "Refrigerator";
  if (number <= 17) return "Sink";
  if (number <= 23) return "Dishwasher";
  if (number <= 30) return "Range";
  if (number <= 35) return "Wall cabinets";
  if (number <= 41) return "Corners";
  if (number <= 44) return "Tall and microwave";
  return "Aisles and clearances";
}

const RESEARCH_PARAMETERS: Record<string, { parameters: Record<string, number>; readsParameters: boolean }> = {
  "dishwasher-beside-sink": { parameters: { sink_dishwasher_max_gap_in: 36 }, readsParameters: true },
  "dishwasher-corner-clearance": { parameters: { dishwasher_corner_clear_in: 21 }, readsParameters: true },
  "dishwasher-corner-fallback": { parameters: { dishwasher_corner_min_in: 2 }, readsParameters: true },
  "sink-landing": { parameters: { sink_landing_long_in: 24, sink_landing_short_in: 18 }, readsParameters: true },
  "fridge-landing": { parameters: { fridge_landing_in: 15 }, readsParameters: true },
  "fridge-hinge-clearance": { parameters: { fridge_hinge_clear_in: 2.5 }, readsParameters: true },
  "sink-base-36": { parameters: { sink_base_default_in: 36 }, readsParameters: true },
};

function researchStatus(enforcement: string): KitchenRuleImplementationStatus {
  return enforcement === "skipped" ? "reference" : "implemented";
}

function researchKind(enforcement: string): KitchenRuleEnforcementKind {
  if (enforcement === "auto" || enforcement === "suggest" || enforcement === "review") return enforcement;
  return "reference";
}

const researchSeeds: KitchenRuleSeed[] = KITCHEN_ADJACENCY_RULES.map((rule) => {
  const extra = RESEARCH_PARAMETERS[rule.id];
  return {
    ruleCode: rule.id,
    category: categoryForResearchNumber(rule.number),
    title: rule.title,
    ruleDescription: rule.note ? `${rule.summary} ${rule.note}` : rule.summary,
    parameters: extra?.parameters ?? {},
    enforcementKind: researchKind(rule.enforcement),
    sourceText: rule.sources.join(", "),
    implementationStatus: researchStatus(rule.enforcement),
    readsParameters: extra?.readsParameters ?? false,
    notesText: rule.note ?? null,
  };
});

const ownerSeeds: KitchenRuleSeed[] = [
  {
    ruleCode: "owner-jog-3",
    category: "Owner placement",
    title: "Appliance and sink jog max 3 inches",
    ruleDescription: "Anything shifted for fit, including the sink base centerline, may move at most 3 inches left or right. The smallest shift that works is used. The refrigerator bay still has its existing 6 inch slide until that cap is changed.",
    parameters: { jog_max_in: 3 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-range-fridge-15",
    category: "Owner placement",
    title: "15 inch cabinet between range and refrigerator",
    ruleDescription: "When the range and refrigerator are on the same run, at least one real cabinet 15 inches wide or wider must sit between them. Fillers and panels do not count.",
    parameters: { range_fridge_min_cabinet_in: 15 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-filler-gap-3",
    category: "Owner fillers and molding",
    title: "Auto filler for gaps of 3 inches or less",
    ruleDescription: "A measured gap of 3 inches or less receives a filler with no prompt. The code default before this stored value loads is 6 inches.",
    parameters: { filler_gap_max_in: 3 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: "Seed value is 3. The untouched code constant is 6 until the saved parameter loads.",
  },
  {
    ruleCode: "owner-clearance-filler-fridge",
    category: "Owner fillers and molding",
    title: "Clearance filler between a frameless cabinet and a fridge panel",
    ruleDescription: "A frameless cabinet next to a refrigerator cabinet or end panel keeps a clearance filler so doors and handles do not hit the panel.",
    parameters: {},
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "pending",
    readsParameters: false,
    notesText: "Owned by the filler-molding-rules work. Not reimplemented on this branch.",
  },
  {
    ruleCode: "owner-filler-cut-2-5",
    category: "Owner fillers and molding",
    title: "One filler when combined pieces are 2.5 inches or less",
    ruleDescription: "Filler pieces whose combined width is 2.5 inches or less are cut from one filler.",
    parameters: { filler_cut_combined_max_in: 2.5 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "pending",
    readsParameters: false,
    notesText: "Owned by the filler-molding-rules work. The number is stored for that branch.",
  },
  {
    ruleCode: "owner-molding-extra-stick",
    category: "Owner fillers and molding",
    title: "Add one molding stick",
    ruleDescription: "The bill of materials adds one extra molding stick.",
    parameters: { molding_extra_sticks: 1 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "pending",
    readsParameters: false,
    notesText: "BOM note: added one just in case of craftsmanship issues. Owned by the filler-molding-rules work.",
  },
  {
    ruleCode: "owner-fridge-panel-24",
    category: "Owner placement",
    title: "Fridge panel cut to 24 inches when the fridge is 24 inches deep",
    ruleDescription: "A 24 inch deep refrigerator uses an end panel cut to 24 inches.",
    parameters: { fridge_panel_cut_in: 24 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "pending",
    readsParameters: false,
    notesText: "BOM note: 30 inch panel cut down to 24. Display and BOM are on branch fridge-panel-cut-to-24.",
  },
  {
    ruleCode: "owner-over-fridge-24",
    category: "Owner placement",
    title: "Wall cabinets 24 inches tall or shorter may go over the fridge",
    ruleDescription: "On every cabinet line, any wall cabinet 24 inches high or shorter may be placed over the refrigerator.",
    parameters: { over_fridge_max_height_in: 24 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: false,
    notesText: "The designer does not reject a wall cabinet at or under this height above the refrigerator. The number is shown for reference.",
  },
  {
    ruleCode: "owner-u-shape-two-corners",
    category: "Owner placement",
    title: "U-shape has exactly two corners",
    ruleDescription: "A U-shaped auto-design kitchen has exactly two corner cabinets.",
    parameters: { u_shape_corner_count: 2 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-blind-door-open-run",
    category: "Owner placement",
    title: "Blind corner door defaults toward the open run",
    ruleDescription: "The blind corner door faces the open run. The blind side tucks into the corner.",
    parameters: {},
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: false,
    notesText: null,
  },
  {
    ruleCode: "owner-corner-fit",
    category: "Owner placement",
    title: "Corner fit against plumbing and fixed items",
    ruleDescription: "Before a corner is offered or placed, each leg is measured up to plumbing, appliances, windows, and wall ends. The sink center may move at most the jog limit. The placed sink center is the plumbing anchor.",
    parameters: { blind_open_leg_in: 27 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: "blind_open_leg_in is 24 inches of base depth plus the 3 inch filler.",
  },
  {
    ruleCode: "owner-blind-corner-fallback",
    category: "Owner placement",
    title: "Blind corner fallback when a lazy Susan will not fit",
    ruleDescription: "If a lazy Susan or other corner will not fit, the largest blind corner that fits is placed, blind side on the longer leg. No corner cabinet fits is reported only when the smallest blind corner fails.",
    parameters: {},
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: false,
    notesText: null,
  },
  {
    ruleCode: "owner-wall-bottom-54",
    category: "Owner vertical",
    title: "54 inch baseline for 30 inch wall cabinets",
    ruleDescription: "Standard 30 inch wall cabinets anchor with the bottom at 54 inches above the floor.",
    parameters: { wall_bottom_in: 54 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-24-at-66",
    category: "Open questions",
    title: "24 inch cabinets at 66 inches",
    ruleDescription: "The owner also said 24 inch cabinets at 66. That tops out at 90 inches, which misses a 96 inch top. This value is stored and not applied.",
    parameters: { open_question_24_bottom_in: 66 },
    enforcementKind: "reference",
    sourceText: "Owner",
    implementationStatus: "reference",
    readsParameters: false,
    notesText: "Open question. Named in code as OPEN_QUESTION_TWENTY_FOUR_INCH_CABINET_BOTTOM_IN and not used for placement.",
  },
  {
    ruleCode: "owner-bridge-cabinets",
    category: "Owner vertical",
    title: "Bridge cabinets over the range",
    ruleDescription: "When a microwave or hood hangs below the bridge, use a 24 inch bridge with its bottom at 72. When nothing hangs below, use a 30 inch bridge with its bottom at 66. Width matches the range.",
    parameters: { bridge_hung_bottom_in: 72, bridge_hung_height_in: 24, bridge_open_bottom_in: 66, bridge_open_height_in: 30 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-run-top-96",
    category: "Owner vertical",
    title: "Runs end at 96 inches",
    ruleDescription: "Wall runs and range bridges are aligned so the top line is 96 inches. A 42 inch wall cabinet on the 54 inch baseline reaches that line. A 30 inch wall cabinet on the 54 inch baseline tops at 84.",
    parameters: { run_top_in: 96 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-hood-bottom-60",
    category: "Owner vertical",
    title: "42 inch hood bottom at 60 inches",
    ruleDescription: "The range hood bottom stays at 60 inches above the floor.",
    parameters: { hood_bottom_in: 60 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: "The code fallback before this value loads is 66 inches, which is the catalog default used when a hood row has no mount.",
  },
  {
    ruleCode: "owner-baking-zone",
    category: "Usage",
    title: "Usage question and 36 inch baking zone",
    ruleDescription: "Auto-design asks how the kitchen is used. Lots of baking reserves at least 36 inches of uninterrupted counter beside the range, ideally toward the refrigerator, and suggests drawer, tray, and mixer items when the catalog has them. The question is skippable and does not block saving.",
    parameters: { baking_zone_min_in: 36 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: null,
  },
  {
    ruleCode: "owner-sink-base-false-front",
    category: "Owner placement",
    title: "Out-of-stock sink base substitutes a same-width base",
    ruleDescription: "When an SBxx sink base is out of stock and the mapped base of the same width is in stock in the same door style, the Designer swaps it automatically. The shop removes the drawer and installs a false front. The customer can undo the swap.",
    parameters: { sink_base_substitute: 1, sink_base_map: "SBxx->Bxx" },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: "Order note: out of SB36, sub with a B36. remove drawer, install false front. Set sink_base_substitute to 0 to disable. Edit sink_base_map to change the prefix pair.",
  },
  {
    ruleCode: "owner-heavy-cook-landing",
    category: "Usage",
    title: "Heavy-cook counter on both sides of the range",
    ruleDescription: "Everyday cooking keeps open uninterrupted counter on both sides of the range. No small cabinet sits directly against the range. Small means a base under 15 inches, a filler, a panel, a tall cabinet, or the refrigerator.",
    parameters: { heavy_cook_landing_in: 15, small_cabinet_below_in: 15 },
    enforcementKind: "auto",
    sourceText: "Owner",
    implementationStatus: "implemented",
    readsParameters: true,
    notesText: "Small cabinet means bases under 15 inches, including 9 and 12 inch spice or tray bases, plus fillers, panels, tall cabinets, and the refrigerator.",
  },
  {
    ruleCode: "conflict-gas-hood-30",
    category: "Open conflicts",
    title: "Gas hood manuals want 30 inches above the cooktop",
    ruleDescription: "Several gas hood manuals require 30 inches above the cooktop. The owner hood bottom stays at 60 inches, which is 24 inches above a 36 inch cooktop. Behavior is not changed.",
    parameters: { gas_hood_clearance_in: 30 },
    enforcementKind: "reference",
    sourceText: "CYC-INSERT, DECOR, owner conflict",
    implementationStatus: "reference",
    readsParameters: false,
    notesText: "Open conflict. Do not change the 60 inch hood bottom until the owner decides.",
  },
  {
    ruleCode: "conflict-fridge-panel-25",
    category: "Open conflicts",
    title: "Sources cut fridge panels to 25 inches",
    ruleDescription: "Some sources cut the refrigerator panel to 25 inches so it meets a 25.5 inch countertop. The owner cuts a 24 inch deep refrigerator panel to 24 inches. Behavior is not changed.",
    parameters: { source_fridge_panel_in: 25 },
    enforcementKind: "reference",
    sourceText: "DECOR, owner conflict",
    implementationStatus: "reference",
    readsParameters: false,
    notesText: "Open conflict. The 24 inch owner cut wins until the owner decides.",
  },
];

export const KITCHEN_RULE_SEED: readonly KitchenRuleSeed[] = [...researchSeeds, ...ownerSeeds];

export function kitchenRuleSeedByCode(ruleCode: string): KitchenRuleSeed | undefined {
  return KITCHEN_RULE_SEED.find((rule) => rule.ruleCode === ruleCode);
}
