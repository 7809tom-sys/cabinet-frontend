/**
 * The three models, their labels, and the standing prompt each one is asked for.
 *
 * Kept in its own module, with no blueprint or browser imports, because both
 * sides of the feature read it: the door editor sends this text on Generate, and
 * a test can compare the three. One copy of the text means the model can never be
 * asked for something the parser does not read.
 *
 * The prompt is PRE-LOADED and standing. It is a constant, not something the
 * operator composes, so pressing Generate is the only action: there is no
 * separate button, step, or dialog to load or submit a prompt.
 *
 * The field list is derived from what the 3D Designer actually reads, so nothing
 * it needs is missing:
 *
 * - `doorProfileIdentity.ts` / `doorRenderIdentity.ts` — style family, frame
 *   construction words, panel type. Read from `doorStyle`, `doorPanelType`,
 *   `profileDescription`.
 * - `doorFrameMetrics.ts` — stile width, rail width.
 * - `doorStyleAppearance.ts` — rail, stile, panel construction, bevel width and
 *   depth, inside-edge profile, drawer-front type, grain direction, sheen.
 * - `shakerDoorBlueprint.ts` — the 2.75 / 3 in standard-shaker rail rule and the
 *   painted-vs-stained grain rule.
 * - `raisedPanelDoorBlueprint.ts` — five-piece frame, sloped bevel, raised centre.
 * - `doorColorResolve.ts` — colour words only; a hex is never taken from a
 *   description.
 *
 * The labels are the contract with `shared/aiDoorDescription.ts`:
 * `parseAiDoorDescription` reads one labelled value per line, so a model that
 * follows this shape produces a record the renderer can act on. Lines the parser
 * does not yet read (top/bottom/mid rail, panel profile, outside profile, beads,
 * material, proportions) are still requested: they are the detail a person needs
 * to rebuild the door, and they are what a later parser field would read.
 *
 * Anything the photo does not show must be written as "not visible". The parser
 * treats that as unstated, so no dimension is invented and the library default
 * stays in force.
 */

/** The three models this tool compares, in the order they render side by side. */
export const AI_DOOR_MODELS = ["gpt", "claude", "gemini"] as const;
export type AiDoorModel = (typeof AI_DOOR_MODELS)[number];

export const AI_DOOR_MODEL_LABELS: Record<AiDoorModel, string> = {
  gpt: "GPT",
  claude: "Claude",
  gemini: "Gemini",
};

/**
 * Who the description is for. Stated first in every prompt, because a model that
 * writes for a person writes prose the parser cannot read.
 */
const AUDIENCE = [
  "You are writing for a machine reader: the 3D Designer in our cabinet software, which builds the actual door in this photograph from your description alone.",
  "It is not a person reading a catalogue. Write only what the Designer needs to rebuild this door, and nothing else.",
].join(" ");

/**
 * The structured output contract: one labelled line per field, in this order.
 *
 * The order matters. The parser takes the first line that carries a label, so the
 * general "Rail width" and "Stile width" lines come before any per-rail detail,
 * and "Inside edge" carries both the sticking profile and the edge words.
 */
const FIELD_BLOCK = [
  "Answer with one labelled line per field, in exactly this order. No preamble, no closing summary, no bullets other than the labels.",
  "Write \"not visible\" for anything the photograph does not show. Never estimate a number you cannot judge, and never invent a detail.",
  "",
  "Style family: shaker, raised panel, slab, beaded, inset, or other",
  "Frame construction: five-piece, slab, or glass, and whether the corners are mitered or cope-and-stick",
  "Stile width: in inches",
  "Rail width: in inches",
  "Top rail: width in inches, or \"not visible\"",
  "Bottom rail: width in inches, or \"not visible\"",
  "Mid rail: width in inches if a horizontal divider splits the face, otherwise \"none\"",
  "Panel type: flat, raised, recessed, or slab",
  "Bevel width: in inches, or \"none\" when the panel meets the frame squarely",
  "Panel profile: how the centre panel is shaped, in plain words",
  "Door outside profile: the edge treatment on the outer face, such as square, eased, beveled, ogee, or chamfered",
  "Inside edge: the sticking where the frame meets the panel, such as square, bevel, ogee, cove, stepped, or quarter-round",
  "Moulding: any applied moulding on the face, in plain words, or \"none\"",
  "Beads and grooves: any bead, flute, or groove and where it runs, or \"none\"",
  "Finish: painted or stained",
  "Color: a name or short phrase in words, not a hex code",
  "Sheen: matte, satin, semi-gloss, or gloss",
  "Undertone: warm, cool, or neutral",
  "Grain direction: vertical, horizontal, or none when the face is painted",
  "Material: the species or material if you can tell, such as maple, oak, or painted MDF, otherwise \"not visible\"",
  "Door proportions: the width-to-height relationship, such as a narrow door about 1:2 or a wide drawer front about 3:1",
  "",
  "Describe the door itself only. Do not describe the room, the other cabinets, the hardware, or the lighting.",
  // A drawer front is deliberately NOT asked for. The Designer reads this text as
  // construction words, and `doorProfileIsSlabOrGlass` scans them for "slab" and
  // "glass" — so a raised-panel door whose drawer front is a slab front would have
  // its raised-panel blueprint dropped entirely. The drawer front is recorded by
  // the editor's own drawer-front field instead.
].join("\n");

/** A model-specific opening line, then the shared contract. Same fields for all three. */
function standingPrompt(intro: string): string {
  return [AUDIENCE, intro, "", FIELD_BLOCK].join("\n");
}

/**
 * The standing prompt each model is pre-loaded with.
 *
 * All three ask for the same fields in the same order, so the three answers are
 * comparable and the parser reads them identically. Only the opening line
 * differs, which lets each model play to how it reads a photograph.
 */
export const AI_DOOR_PROMPTS: Record<AiDoorModel, string> = {
  gpt: standingPrompt(
    "Read the photograph carefully and describe this cabinet door precisely enough that the door can be rebuilt from your words.",
  ),
  claude: standingPrompt(
    "Look closely at the photographed cabinet door and describe its construction and finish precisely enough that the door can be rebuilt from your words.",
  ),
  gemini: standingPrompt(
    "Study this cabinet door photograph and describe the door precisely enough that it can be rebuilt from your words.",
  ),
};

/**
 * The field labels, in the order the prompt asks for them.
 *
 * Exported so the docs, the tests, and the prompt can never disagree about what a
 * description is supposed to contain.
 */
export const AI_DOOR_PROMPT_FIELDS = [
  "Style family",
  "Frame construction",
  "Stile width",
  "Rail width",
  "Top rail",
  "Bottom rail",
  "Mid rail",
  "Panel type",
  "Bevel width",
  "Panel profile",
  "Door outside profile",
  "Inside edge",
  "Moulding",
  "Beads and grooves",
  "Finish",
  "Color",
  "Sheen",
  "Undertone",
  "Grain direction",
  "Material",
  "Door proportions",
] as const;
