import type { KitchenRuleSeed } from "./kitchenRulesCatalog";

/**
 * Open questions for Rich, who installed kitchens for 40 years. Each one is a reference-only Kitchen Rule: it never
 * changes Designer behavior. Rich answers in the rule's Notes field in Settings > Kitchen Rules, and Tom turns an
 * answer into a real rule (with a number the Designer reads) in a separate change.
 *
 * Default while a question is open: follow NKBA (kb.nkba.org Kitchen Planning Guidelines). NKBA numbers quoted here
 * are the recommended values from that document. Where NKBA is silent the question says so.
 */
export const RICH_QUESTIONS_CATEGORY = "Questions for Rich";

const ANSWER_PROMPT = "Rich's answer: (not answered yet). Write what you do on a real job, and any number you use.";

function question(code: string, title: string, nkba: string, today: string, ask: string): KitchenRuleSeed {
  return {
    ruleCode: `rich-q-${code}`,
    category: RICH_QUESTIONS_CATEGORY,
    title,
    ruleDescription: `NKBA: ${nkba} Auto-Design today: ${today} Question for Rich: ${ask}`,
    parameters: {},
    enforcementKind: "reference",
    sourceText: "NKBA planning guidelines, owner rules, question for Rich",
    implementationStatus: "reference",
    readsParameters: false,
    notesText: ANSWER_PROMPT,
  };
}

export const richQuestionSeeds: readonly KitchenRuleSeed[] = [
  question(
    "gap-in-run",
    "A gap bigger than 3 inches in a run",
    "Silent on filler widths.",
    "A gap of 3 inches or less gets a filler automatically. A bigger gap, such as the 9 to 10 inches beside a range, is left open with no cabinet and no filler.",
    "What do you put in a 4, 6, 9 or 12 inch gap: a wider filler, a 9 inch spice base, a drawer base, or move the run? What is the widest filler you will install?",
  ),
  question(
    "hood-bottom",
    "How high above the cooktop does the hood go",
    "Guideline 18: 24 inches minimum to a protected noncombustible surface, 30 inches to combustible material or metal cabinets, or 24 inches with an approved hood. Follow the manufacturer for over-range microwaves.",
    "The owner rule says the hood bottom is 60 inches (24 inches over a 36 inch cooktop). Auto-Design applies 60 only to a 42 inch hood and places every other hood at 54 inches, 18 inches over the cooktop. The catalog hood entries say 66 inches. Gas hood manuals often say 30 inches.",
    "Where do you hang a 30, 36 and 42 inch hood on gas and on electric? Does the bottom edge of the hood line up with the wall cabinet bottoms?",
  ),
  question(
    "wall-cab-beside-hood",
    "Wall cabinet next to a hood",
    "Silent.",
    "A 3/4 inch end panel is added on the side of a wall cabinet that faces the range or hood, flush against the hood.",
    "Does the hood sit tight to the cabinet or with a gap? Do you put a panel or a filler there? How much space do you leave for the hood to be installed and serviced?",
  ),
  question(
    "range-landing",
    "Counter on each side of the range",
    "Guideline 17: 12 inches on one side and 15 inches on the other at cooktop height. Where two landing areas are next to each other, use the longer one plus 12 inches (guideline 24).",
    "15 inches of real base on both sides of the range, and nothing smaller than a 15 inch base against it.",
    "Is 15 inches both sides right? Will you ever leave a range with a 9 or 12 inch cabinet or a filler beside it?",
  ),
  question(
    "dishwasher",
    "Dishwasher placement and clearance",
    "Guideline 13: within 36 inches of the sink edge, with 21 inches of standing space at right angles to the dishwasher.",
    "The dishwasher goes beside the sink and is flagged against an inside corner; Auto-Design will not slide it more than 3 inches to clear the corner.",
    "How far from a corner do you need a dishwasher so the door opens? Which side of the sink do you prefer? Do you want a panel beside it?",
  ),
  question(
    "sink-and-prep",
    "Counter around the sink",
    "Guideline 11: 24 inches on one side and 18 inches on the other, at least 16 inches deep. Guideline 12: 36 inches wide by 24 inches deep of continuous counter for prep beside the sink.",
    "24 and 18 inches of landing and a 36 inch prep counter are checked and flagged. They do not steer where cabinets are placed.",
    "Is 24 and 18 enough in a small kitchen? What is the smallest prep counter you would sign off on?",
  ),
  question(
    "fridge-clearances",
    "Space around the refrigerator",
    "Guideline 16: 15 inches of counter on the handle side, or 15 inches across an aisle within 48 inches.",
    "A 15 inch real cabinet is required between the range and the refrigerator, a hinge-side clearance of 2.5 inches is flagged against a wall, and panels are cut to 24 inches. Some sources cut panels to 25 inches and want the tall cabinet 25 inches deep.",
    "What clearance do you leave on the hinge side and the top of a refrigerator? Do you cut panels to 24 or 25 inches?",
  ),
  question(
    "panels-when",
    "When do exposed sides get a finished panel",
    "Silent.",
    "The owner rule says the Designer does not add panels on its own. Other rules and Auto-Design do add 3/4 inch panels at run ends, beside a window, beside the dishwasher and fridge, and beside a range.",
    "On a real job which ends always get a panel, and which ones do you skip?",
  ),
  question(
    "wall-cabinet-heights",
    "Wall cabinet bottom and top lines",
    "Silent on cabinet heights. Guideline 21: a microwave goes no higher than 54 inches to the bottom.",
    "Bottoms at 54 inches, runs topping at 96 inches, a 30 inch cabinet topping at 84. The owner also said 24 inch cabinets at 66 inches, which is stored and not applied.",
    "What heights do you hang 30, 36 and 42 inch uppers at? Do you carry the top line to 96 inches with a stacker or crown? Where do 24 inch cabinets go?",
  ),
  question(
    "corners",
    "Corners",
    "Guideline 29: at least one corner cabinet with a functional storage device.",
    "Auto-Design picks a diagonal corner, then the largest lazy Susan, then the largest blind corner that fits, with a 3 inch blind filler.",
    "What corner do you choose in a small kitchen? How far do you pull a blind corner off the wall for the door to open?",
  ),
  question(
    "walkways",
    "Aisles and walkways",
    "Guideline 6: 42 inches minimum for one cook, 48 inches for two, and 60 inches between opposing arms of a U-shaped kitchen. Guideline 3: work triangle legs 4 to 9 feet, total no more than 26 feet.",
    "Aisles and the work triangle are checked and flagged when the plan has the runs to check.",
    "Where do you bend these numbers in tight kitchens, and where must they never be bent?",
  ),
  question(
    "what-designs-get-wrong",
    "What do computer designs usually get wrong on site",
    "Not a guideline.",
    "Not applicable.",
    "Which problems have you had to fix on the job most often after a design was done, starting with the most common?",
  ),
];
