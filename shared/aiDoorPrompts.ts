/**
 * The three models, their labels, and the prompt each one is asked for.
 *
 * Kept in its own module, with no blueprint or browser imports, because both
 * sides of the feature read it: the door editor shows and copies these prompts,
 * and the API server sends the same text to the provider when the operator
 * presses Generate. One copy of the text means the pasted path and the generated
 * path can never drift apart.
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
 * What each model is asked to describe. Tailored per model, but every prompt asks
 * for the same fields so the three descriptions are comparable, and every prompt
 * tells the model to say "not visible" rather than guess.
 */
export const AI_DOOR_PROMPTS: Record<AiDoorModel, string> = {
  gpt: [
    "You are describing a single cabinet door from a photograph so a renderer can draw it.",
    "Answer in short labelled lines, in this exact order. If something is not visible, write \"not visible\" — never guess.",
    "1. Profile / style family (for example shaker, raised panel, slab, beaded).",
    "2. Frame: does it have one, and are the corners mitered (45° joints) or cope-and-stick (butted stiles and rails)?",
    "3. Rail and stile width, in inches, if you can judge it against the door size.",
    "4. Panel type: flat, raised, or recessed.",
    "5. Edge / bevel: square, bevel, ogee, cove, or other, and roughly how wide the bevel is.",
    "6. Any molding or sticking profile, described plainly.",
    "7. Grain or painted: is the wood grain visible, and in which direction?",
    "8. Sheen: matte, satin, semi-gloss, or gloss.",
    "9. Undertone: warm, cool, or neutral.",
    "10. Color, in your own words (a name, not a hex code).",
    "Do not describe the room, cabinetry layout, or hardware.",
  ].join("\n"),
  claude: [
    "Look at the photographed cabinet door and describe its construction and finish so it can be rebuilt.",
    "Use one line per item, in this order. Where the photo does not show something, say \"not visible\" instead of inferring it.",
    "• Style family — shaker, raised panel, slab, beaded, inset, or other.",
    "• Frame construction — mitered corners, or cope-and-stick (interlocking stiles and rails).",
    "• Rail and stile width in inches, if the proportions allow an estimate.",
    "• Center panel — flat, raised, or recessed.",
    "• Inside edge — square, single bevel, ogee, cove, or a stepped molding.",
    "• Bevel width, roughly, if a bevel is visible.",
    "• Surface — visible wood grain (note the direction) or an opaque painted finish.",
    "• Sheen — matte, satin, semi-gloss, or gloss.",
    "• Undertone — warm, cool, or neutral.",
    "• Color, described in words rather than a hex value.",
    "Keep it to the door itself; ignore the room and the cabinets around it.",
  ].join("\n"),
  gemini: [
    "Describe this cabinet door so it can be drawn again from your description.",
    "Give each item on its own line, in this order, and write \"not visible\" when the photo does not show it. Do not guess.",
    "1) Style: shaker / raised panel / slab / beaded / other.",
    "2) Frame: present? corners mitered or cope-and-stick?",
    "3) Rail width and stile width, in inches, if they can be judged.",
    "4) Panel: flat, raised, or recessed.",
    "5) Edge and bevel: profile name and approximate bevel width.",
    "6) Molding: any sticking or applied molding, in plain words.",
    "7) Grain or paint: visible grain (say which direction) or solid paint.",
    "8) Sheen: matte, satin, semi-gloss, gloss.",
    "9) Undertone: warm, cool, neutral.",
    "10) Color: a name or short phrase, not a hex code.",
    "Describe only the door.",
  ].join("\n"),
};
