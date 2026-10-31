/**
 * The 49 kitchen placement rules from the Oct 28, 2026 research note.
 * `researchTag` is the source tag. `enforcement` is what the Designer does.
 * Owner rules that already ship (3" wiggle, hood bottom, fridge panel cut,
 * filler/molding, U-shape corners) are not reimplemented here.
 */

export type KitchenRuleEnforcement = "auto" | "suggest" | "review" | "skipped";

export type KitchenAdjacencyRule = {
  id: string;
  number: number;
  title: string;
  researchTag: "AUTO" | "SUGGEST";
  enforcement: KitchenRuleEnforcement;
  sources: readonly string[];
  summary: string;
  /** Shown when the check cannot run, or when an owner rule wins. */
  note?: string;
};

export const KITCHEN_ADJACENCY_RULES: readonly KitchenAdjacencyRule[] = [
  { id: "placement-order", number: 1, title: "Fix constraints, then sink, appliances, and corners", researchTag: "AUTO", enforcement: "auto", sources: ["LA-LAYOUT"], summary: "Auto-design seats measured anchors and corners before it fills straight runs." },
  { id: "align-wall-cabinets", number: 2, title: "Line wall cabinets up over the bases", researchTag: "AUTO", enforcement: "auto", sources: ["LA-LAYOUT", "DECOR"], summary: "Upper runs follow the finished base widths." },
  { id: "tall-at-run-ends", number: 3, title: "Tall units at the ends of runs", researchTag: "AUTO", enforcement: "review", sources: ["LA-LAYOUT", "NKBA #4"], summary: "A tall cabinet or refrigerator between two base runs is flagged. A measured center is not moved past the shift cap." },
  { id: "fridge-landing", number: 4, title: "15 inch refrigerator landing", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #16"], summary: "The handle side needs 15 inches of counter, or 15 inches across an aisle within 48 inches." },
  { id: "fridge-run-end", number: 5, title: "Refrigerator at the end of a run", researchTag: "AUTO", enforcement: "review", sources: ["LA-LAYOUT", "NKBA #4", "KA-FRIDGE"], summary: "A refrigerator with base cabinets on both sides, or tucked into an inside corner, is flagged." },
  { id: "fridge-hinge-clearance", number: 6, title: "Hinge-side clearance at a wall", researchTag: "AUTO", enforcement: "review", sources: ["KA-FRIDGE", "ULINE"], summary: "A refrigerator whose hinge side lands on a wall with no filler or panel is flagged." },
  { id: "fridge-opening", number: 7, title: "37 inch by 72 inch refrigerator opening", researchTag: "AUTO", enforcement: "skipped", sources: ["DECOR", "HB-INST"], summary: "Default opening when the size is unknown.", note: "The Designer uses the measured refrigerator width and the existing panel bay, not a new 37 inch opening." },
  { id: "fridge-end-panels", number: 8, title: "Tall end panels beside the refrigerator", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR"], summary: "The existing refrigerator bay still frames the refrigerator with end panels.", note: "Panel depth stays on the owner's 24 inch cut. Sources that call for 25–30 inches are an open conflict." },
  { id: "over-fridge-depth", number: 9, title: "Deep cabinet over a paneled refrigerator", researchTag: "AUTO", enforcement: "suggest", sources: ["DECOR", "KM"], summary: "A 12 inch deep wall cabinet over a paneled refrigerator is a suggestion, not a replacement. Any wall cabinet 24 inches tall or shorter may still go over the fridge." },
  { id: "fridge-panel-filler", number: 10, title: "Filler between a wall cabinet and a fridge panel", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR"], summary: "The existing clearance filler between a frameless cabinet and a fridge panel is unchanged." },
  { id: "sink-on-window", number: 11, title: "Center the sink on the window", researchTag: "SUGGEST", enforcement: "suggest", sources: ["LA-LAYOUT", "DECOR"], summary: "After a sink shifts, a window that no longer shares the sink center is a suggestion the customer can accept." },
  { id: "sink-base-36", number: 12, title: "36 inch sink base by default", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR"], summary: "Auto-design still defaults to a 36 inch regular sink base unless the customer picks another size or a farmhouse base." },
  { id: "sink-landing", number: 13, title: "Sink landing 24 and 18 inches", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #11"], summary: "One side of the sink needs 24 inches of counter and the other 18 inches." },
  { id: "prep-zone", number: 14, title: "36 inch prep counter beside the sink", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #12"], summary: "A continuous 36 inch counter beside the sink is checked. Baking use also reserves that zone beside the range when the run allows it." },
  { id: "single-sink-near-work", number: 15, title: "Only sink near the range and refrigerator", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #10"], summary: "The only sink should share a run or sit across from the range and refrigerator." },
  { id: "trash-pullout", number: 16, title: "Trash pull-out by the sink", researchTag: "AUTO", enforcement: "suggest", sources: ["NKBA #14", "DECOR"], summary: "A trash or double-trash base in the catalog is suggested beside the sink, opposite the dishwasher. It is not forced into the run." },
  { id: "drawer-near-sink", number: 17, title: "Drawer base in the sink zone", researchTag: "SUGGEST", enforcement: "suggest", sources: ["DECOR", "NKBA #28"], summary: "A drawer base near the sink is suggested when the line sells one." },
  { id: "dishwasher-beside-sink", number: 18, title: "Dishwasher within 36 inches of the sink", researchTag: "AUTO", enforcement: "auto", sources: ["NKBA #13", "LA-LAYOUT"], summary: "Auto-design seats the dishwasher against the sink. The 36 inch edge check runs again after any shift." },
  { id: "dishwasher-corner-clearance", number: 19, title: "21 inches between the dishwasher and a corner", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #13"], summary: "A dishwasher against an inside corner is flagged. Auto-design will not slide it more than 3 inches to clear the corner." },
  { id: "dishwasher-corner-fallback", number: 20, title: "2 inch side gap if a corner cannot be avoided", researchTag: "AUTO", enforcement: "review", sources: ["DW-SPEC"], summary: "If the 21 inch stand is impossible, the side still needs 2 inches." },
  { id: "dishwasher-end-panel", number: 21, title: "Dishwasher end panel", researchTag: "AUTO", enforcement: "suggest", sources: ["DECOR", "LA-LAYOUT"], summary: "A dishwasher at the end of a run suggests a panel. Existing panel tooling is not duplicated." },
  { id: "dishwasher-away-from-range", number: 22, title: "Avoid a dishwasher directly beside the range", researchTag: "SUGGEST", enforcement: "suggest", sources: ["NKBA #24"], summary: "A dishwasher touching the range is a suggestion, not a block." },
  { id: "appliance-door-clash", number: 23, title: "Appliance doors clear entry doors", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #2"], summary: "Checked when the plan has a door. Skipped with a note when it does not." },
  { id: "range-landing", number: 24, title: "Landing on both sides of the range", researchTag: "AUTO", enforcement: "auto", sources: ["NKBA #17", "JLC31"], summary: "Auto-design keeps a real base on both sides of the range. No tall cabinet or refrigerator may sit directly against it. Heavy cooking raises the landing to 15 inches on both sides and rejects bases under 15 inches." },
  { id: "shared-landing", number: 25, title: "Shared landing between range and sink or refrigerator", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #24"], summary: "The shared counter uses the longer landing plus 12 inches." },
  { id: "range-not-under-window", number: 26, title: "Range not under an operable window", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #20"], summary: "Checked when a window is on the range wall. Skipped with a note when the plan has no windows." },
  { id: "range-opening", number: 27, title: "30.5 inch range opening", researchTag: "AUTO", enforcement: "skipped", sources: ["DECOR", "HB-INST"], summary: "Model a 30 inch range as a 30.5 or 31.25 inch opening.", note: "The appliance palette places RANGE-30 at its catalog width. A separate rough opening is not modeled." },
  { id: "drawers-beside-range", number: 28, title: "Drawer bases and a spice pull-out beside the range", researchTag: "SUGGEST", enforcement: "suggest", sources: ["LA-STOVE", "DECOR"], summary: "Suggested for every kitchen. Baking and everyday cooking prefer a drawer base of the same width when the line sells one." },
  { id: "hood-width", number: 29, title: "Hood at least as wide as the range", researchTag: "AUTO", enforcement: "review", sources: ["DECOR", "Thermador"], summary: "A hood narrower than the range is flagged." },
  { id: "cooktop-clearance", number: 30, title: "Clearance above the cooktop", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #18", "LA-STOVE", "GILROY"], summary: "The owner's 60 inch hood-bottom rule is unchanged. Gas manuals that want 30 inches above the cooktop are an open conflict, not a behavior change." },
  { id: "wall-bottom-54", number: 31, title: "Wall cabinet bottoms at 54 inches", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR", "KM", "FAB"], summary: "Standard wall cabinets stay bottom-anchored at 54 inches. A 30 inch box therefore tops at 84 inches." },
  { id: "wall-height-by-ceiling", number: 32, title: "Wall height follows the ceiling", researchTag: "AUTO", enforcement: "auto", sources: ["FAB", "KM"], summary: "The customer still picks 30, 36, or 42 inch wall cabinets. A 42 inch cabinet on the 54 inch line ends at 96 inches." },
  { id: "stacked-wall-fillers", number: 33, title: "Stacked wall fillers", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR"], summary: "Existing filler and molding rules are unchanged." },
  { id: "glass-and-microwave-wall", number: 34, title: "Glass doors and a microwave shelf", researchTag: "SUGGEST", enforcement: "suggest", sources: ["DECOR"], summary: "Glass doors and a microwave wall cabinet are suggestions when those SKUs exist." },
  { id: "run-end-panel", number: 35, title: "Finished end at the end of a run", researchTag: "AUTO", enforcement: "review", sources: ["DECOR", "LA-LAYOUT"], summary: "A run that dies into a wall with no filler or panel is flagged. Auto filler for gaps of 3 inches or less is unchanged." },
  { id: "corner-storage", number: 36, title: "Functional corner storage", researchTag: "AUTO", enforcement: "auto", sources: ["NKBA #29"], summary: "A corner still needs a real corner cabinet. Only sizes that fit the legs are offered, and a blind corner is the fallback." },
  { id: "blind-pull-filler", number: 37, title: "Blind corner pull and filler", researchTag: "AUTO", enforcement: "auto", sources: ["THD-PG", "HB-INST", "LA-LAYOUT"], summary: "The existing blind filler and the door-toward-the-open-run rule are unchanged. Corner fit counts the 3 inch filler on the open leg." },
  { id: "wall-corner-matches-base", number: 38, title: "Wall corner matches the base corner", researchTag: "AUTO", enforcement: "auto", sources: ["DECOR", "LA-LAYOUT"], summary: "A blind base still gets a blind wall corner, and a lazy Susan still gets a diagonal or corner upper." },
  { id: "kill-the-corner", number: 39, title: "Kill the corner", researchTag: "SUGGEST", enforcement: "suggest", sources: ["DECOR"], summary: "Leaving the corner open is a suggestion only. Auto-design still requires a corner cabinet at an L or U corner." },
  { id: "corner-base-off-wall", number: 40, title: "Corner base pulled off the wall", researchTag: "AUTO", enforcement: "auto", sources: ["HB-INST"], summary: "Blind corners keep their existing pull range." },
  { id: "u-shape-two-corners", number: 41, title: "U-shape corners follow the walls that exist", researchTag: "AUTO", enforcement: "auto", sources: ["LA-LAYOUT"], summary: "An open three-wall U keeps two corners. A closed room also cabinets Wall 4 and the corners at both of its ends." },
  { id: "oven-tower-landing", number: 42, title: "Oven tower landing", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #23"], summary: "Checked when a tall oven cabinet is on the plan. Skipped with a note otherwise." },
  { id: "microwave-location", number: 43, title: "Plan a microwave location", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #21", "NKBA #22", "DECOR"], summary: "A microwave above 54 inches, or no microwave at all, is flagged when the plan is far enough along to know." },
  { id: "tall-depth", number: 44, title: "Tall cabinets about 25 inches deep", researchTag: "AUTO", enforcement: "skipped", sources: ["DECOR"], summary: "Tall cabinets should die into a 25 inch gable.", note: "The owner's refrigerator panel is cut to 24 inches. This depth change is an open conflict and is not applied." },
  { id: "work-triangle", number: 45, title: "Work triangle", researchTag: "SUGGEST", enforcement: "review", sources: ["NKBA #3", "NKBA #5"], summary: "Checked from sink, range, and refrigerator centers when all three exist. Skipped with a note otherwise." },
  { id: "aisles", number: 46, title: "Work aisle and walkway", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #6", "NKBA #7", "DECOR"], summary: "Checked when two parallel runs exist. Skipped with a note for a single run." },
  { id: "seating-clearance", number: 47, title: "Seating clearance", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #8", "NKBA #9"], summary: "Checked when an island has a raised seating bar. Skipped with a note otherwise." },
  { id: "island", number: 48, title: "Island depth, ends, and range landing", researchTag: "AUTO", enforcement: "review", sources: ["DECOR", "NKBA #17"], summary: "Checked when an island is on the plan. Skipped with a note when it is not." },
  { id: "door-swing-after-place", number: 49, title: "Door and drawer clearance after every placement", researchTag: "AUTO", enforcement: "review", sources: ["NKBA #2", "LA-LAYOUT"], summary: "Run after auto-design, including after an appliance or sink shift, and again in plan review." },
];

export function kitchenAdjacencyRuleById(id: string): KitchenAdjacencyRule | undefined {
  return KITCHEN_ADJACENCY_RULES.find((rule) => rule.id === id);
}

export function kitchenAdjacencyRulesByEnforcement(enforcement: KitchenRuleEnforcement): KitchenAdjacencyRule[] {
  return KITCHEN_ADJACENCY_RULES.filter((rule) => rule.enforcement === enforcement);
}
