/**
 * AI door-description comparison: three pasted descriptions → three profiles.
 *
 * Paste-back workflow only. Nothing here calls a model. The operator opens the
 * tool, copies each model's prompt, pastes that model's description back, and the
 * tool parses the text into profile parameters the existing door blueprints can
 * draw.
 *
 * Tom's rules that this file must keep:
 *
 * - The parser never invents a dimension. A parameter the text does not state
 *   stays at the library default and is reported in `unstated`, so the preview and
 *   the "Choose as official" summary can show what is actually known.
 * - The profile draws door and drawer fronts only; `appliesTo` says so.
 * - A painted description renders solid with no grain; a stained one keeps grain.
 * - Color is a plain-text description on the door profile, never a brand-palette
 *   snap. A hex in the text is reported as-is; a color word is reported as text.
 * - The WalzCraft wizard is untouched and still wins when it has a record.
 */
import {
  RAISED_PANEL_BLUEPRINT,
  RAISED_PANEL_BLUEPRINT_ID,
  type RaisedPanelStyleInput,
} from "./raisedPanelDoorBlueprint";
import { isPaintedFinish } from "./paintedFinish";
import { DOOR_LIBRARY_ENTRY_IDS } from "./doorLibraryProfiles";

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
/** The library entry a description resolves to, or null when the text names none. */
export type AiDoorEntryId = string | null;

export type AiDoorProfileParams = {
  /** Library entry the preview draws with. Null means "no library entry named". */
  entryId: AiDoorEntryId;
  /** Shaker-style framed front. */
  family: "shaker" | "raised-panel" | "slab" | "unknown";
  railIn: number | null;
  stileIn: number | null;
  bevelWidthIn: number | null;
  bevelDepthIn: number | null;
  panelConstruction: "raised" | "flat" | "recessed" | null;
  insideEdgeProfile: string | null;
  cornerJoint: "mitered" | "cope-and-stick" | null;
  molding: string | null;
  /** Paint renders solid; stain keeps grain. Null when the text does not say. */
  painted: boolean | null;
  grainDirection: "vertical" | "horizontal" | "none" | null;
  sheen: "matte" | "satin" | "semi-gloss" | "gloss" | null;
  undertone: "warm" | "cool" | "neutral" | null;
  /** Free-text color from the description. Never snapped to a brand hex. */
  colorText: string | null;
};

export type AiDoorParseResult = {
  model: AiDoorModel;
  /** The pasted text, trimmed. Empty means the field is still blank. */
  description: string;
  params: AiDoorProfileParams;
  /** Parameter names the text did not state. These stayed at the library default. */
  unstated: string[];
  /** Plain-language notes: what was read, and anything that stayed defaulted. */
  notes: string[];
};

/** Every parameter the parser can read, in report order. */
export const AI_DOOR_PARAM_FIELDS = [
  "family",
  "railIn",
  "stileIn",
  "panelConstruction",
  "insideEdgeProfile",
  "cornerJoint",
  "bevelWidthIn",
  "molding",
  "painted",
  "grainDirection",
  "sheen",
  "undertone",
  "colorText",
] as const;
export type AiDoorParamField = (typeof AI_DOOR_PARAM_FIELDS)[number];

const EMPTY_PARAMS: AiDoorProfileParams = {
  entryId: null,
  family: "unknown",
  railIn: null,
  stileIn: null,
  bevelWidthIn: null,
  bevelDepthIn: null,
  panelConstruction: null,
  insideEdgeProfile: null,
  cornerJoint: null,
  molding: null,
  painted: null,
  grainDirection: null,
  sheen: null,
  undertone: null,
  colorText: null,
};

/** "not visible", "n/a", "unknown" — the prompts ask for these instead of a guess. */
const NOT_VISIBLE = /\b(?:not\s+visible|not\s+shown|cannot\s+tell|can'?t\s+tell|unclear|unknown|n\/?a|none\s+visible)\b/i;

function lineValue(text: string): string | null {
  const trimmed = text.split(/[\n•]/)[0]?.trim() ?? "";
  if (!trimmed || NOT_VISIBLE.test(trimmed)) return null;
  // Drop a leading bullet or a list marker ("1.", "1)", "-"). The marker must be
  // followed by whitespace, so a measurement like "2 1/2 in" keeps its whole number.
  const stripped = trimmed
    .replace(/^[-•*]\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^[A-Za-z][A-Za-z /-]{0,40}:\s*/, "")
    .trim();
  return stripped || null;
}

/**
 * Reads a labelled value from one line: `Rail width: 2 1/2 in`, or
 * `Rail width 2.5 in` without a colon. Null when no line states it, or when the
 * line says "not visible".
 */
function labelled(text: string, ...labels: string[]): string | null {
  const lines = text.split(/\r?\n/);
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\b\\s*(?:[:\\-–—]|\\s)\\s*(.+)$`, "i");
    for (const line of lines) {
      const match = pattern.exec(line);
      if (!match?.[1]) continue;
      const value = lineValue(match[1]);
      if (value) return value;
    }
  }
  return null;
}

/** `2 1/2 in`, `2.5"`, `3 inches` → 2.5 / 3. Null when no measurement is stated. */
export function parseInchesFromText(text: string | null | undefined): number | null {
  const source = (text ?? "").trim();
  if (!source || NOT_VISIBLE.test(source)) return null;
  // A mixed number first: "2 1/2" must not be read as the bare fraction "1/2".
  const mixed = /(?<![\d.])(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(?:in(?:ch(?:es)?)?|"|”)?/i.exec(source);
  if (mixed) {
    const value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  // A bare fraction, but only when no whole number precedes it.
  const fraction = /(?<![\d./])(\d+)\s*\/\s*(\d+)\s*(?:in(?:ch(?:es)?)?|"|”)?/i.exec(source);
  if (fraction) {
    const value = Number(fraction[1]) / Number(fraction[2]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  // A decimal with inches attached, or a bare number on a measurement line.
  const decimal = /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|"|”)/i.exec(source);
  if (decimal) {
    const value = Number(decimal[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const bare = /^(\d+(?:\.\d+)?)$/.exec(source);
  if (bare) {
    const value = Number(bare[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return null;
}

type Family = AiDoorProfileParams["family"];

/**
 * The style family the description names, case-insensitively.
 *
 * Checked in this order, because a description can use more than one word:
 * raised panel, then slab, then shaker. That keeps "a raised shaker-style panel" a
 * raised panel and "slab-fronted shaker look" a slab, which is what the words
 * actually describe.
 */
export function parseFamily(text: string): Family {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return "unknown";
  if (/\braised\b|\bcatherdal\b|\bcathedral\b|\bogee\b|raised[\s-]?panel/.test(haystack)) return "raised-panel";
  if (/\bslab\b|\bflat[\s-]?(?:front|slab)\b|\bcontemporary\b|\beuro\b/.test(haystack)) return "slab";
  if (/shaker/.test(haystack)) return "shaker";
  return "unknown";
}

export function parsePanelConstruction(text: string): AiDoorProfileParams["panelConstruction"] {
  const haystack = text.toLowerCase();
  if (/\braised\b/.test(haystack)) return "raised";
  if (/\brecessed\b|\breversed\b/.test(haystack)) return "recessed";
  if (/\bflat\b/.test(haystack)) return "flat";
  return null;
}

export function parseSheen(text: string): AiDoorProfileParams["sheen"] {
  const haystack = text.toLowerCase();
  if (/\bgloss(?:y)?\b/.test(haystack) && !/semi[\s-]?gloss/.test(haystack)) return "gloss";
  if (/semi[\s-]?gloss/.test(haystack)) return "semi-gloss";
  if (/\bsatin\b/.test(haystack)) return "satin";
  if (/\bmatte?\b|\blow[\s-]luster\b|\bflat\s+finish\b/.test(haystack)) return "matte";
  return null;
}

export function parseUndertone(text: string): AiDoorProfileParams["undertone"] {
  const haystack = text.toLowerCase();
  if (/\bwarm\b|\bcreamy\b|\buttery\b/.test(haystack)) return "warm";
  if (/\bcool\b|\bbluish\b|\bgreyish\b|\bgrayish\b/.test(haystack)) return "cool";
  if (/\bneutral\b/.test(haystack)) return "neutral";
  return null;
}

/** Paint vs stain, from the description alone. Null when it does not say. */
export function parsePainted(text: string): boolean | null {
  const haystack = text.toLowerCase();
  if (/\bpainted\b|\bsolid\s+paint\b|\bpaint\s+finish\b|\bhdf\b|\bmdf\b|\bno\s+(?:visible\s+)?grain\b/.test(haystack)) return true;
  if (/\bstain(?:ed)?\b|\bwood\s+grain\b|\bgrain\s+visible\b|\bvisible\s+grain\b|\bnatural\b|\boak\b|\bmaple\b|\bwalnut\b|\bcherry\b|\bhickory\b/.test(haystack)) return false;
  return null;
}

export function parseCornerJoint(text: string): AiDoorProfileParams["cornerJoint"] {
  const haystack = text.toLowerCase();
  if (/\bmiter(?:ed)?\b|\b45[\s-]?degree\b/.test(haystack)) return "mitered";
  if (/cope[\s-]and[\s-]stick|coped\b|\binterlock/.test(haystack)) return "cope-and-stick";
  return null;
}

export function parseGrainDirection(text: string): AiDoorProfileParams["grainDirection"] {
  const haystack = text.toLowerCase();
  if (/\bhorizontal\b/.test(haystack) && !/vertical/.test(haystack)) return "horizontal";
  if (/\bvertical\b/.test(haystack)) return "vertical";
  if (/\bno\s+(?:visible\s+)?grain\b|\bpainted\b/.test(haystack)) return "none";
  return null;
}

export function parseInsideEdge(text: string): string | null {
  const haystack = text.toLowerCase();
  const found: string[] = [];
  if (/\bsquare\b/.test(haystack)) found.push("square");
  if (/\bbevel(?:ed|led)?\b/.test(haystack)) found.push("bevel");
  if (/\bogee\b/.test(haystack)) found.push("ogee");
  if (/\bcove\b/.test(haystack)) found.push("cove");
  if (/\bstep(?:ped)?\b/.test(haystack)) found.push("stepped");
  if (/\bquarter[\s-]round\b|\bbullnose\b/.test(haystack)) found.push("quarter-round");
  return found.length > 0 ? found.join(" + ") : null;
}

/**
 * A color phrase the description states. Only an explicit color line is read, so a
 * throwaway "white" in prose is not used. No hex is invented and no brand swatch
 * is substituted: whatever the model wrote is kept as text.
 */
export function parseColorText(text: string): string | null {
  const stated = labelled(text, "color", "colour", "finish color", "painted color", "stain color");
  if (stated) return stated;
  const phrase = /\b((?:warm|cool|soft|deep|light|dark|pale|antique|off)[\s-][a-z]+(?:[\s-][a-z]+){0,3})\b/i.exec(text);
  return phrase?.[1]?.trim() ?? null;
}

/**
 * Parse one model's pasted description into profile parameters.
 *
 * Anything the text does not state stays null. The caller renders that as the
 * library default and lists it in `unstated`, so nothing is invented.
 */
export function parseAiDoorDescription(
  model: AiDoorModel,
  description: string,
): AiDoorParseResult {
  const text = (description ?? "").trim();
  if (!text) {
    return {
      model,
      description: "",
      params: { ...EMPTY_PARAMS },
      unstated: [...AI_DOOR_PARAM_FIELDS],
      notes: ["No description pasted yet. Every parameter stays at the library default."],
    };
  }

  const family = parseFamily(text);
  const railIn = parseInchesFromText(labelled(text, "rail width", "rail"));
  const stileIn = parseInchesFromText(labelled(text, "stile width", "stile"));
  const bevelStated = labelled(text, "bevel width", "bevel");
  const bevelWidthIn = parseInchesFromText(bevelStated);
  const panelConstruction = parsePanelConstruction(text);
  const insideEdgeProfile = parseInsideEdge(text);
  const cornerJoint = parseCornerJoint(text);
  const molding = (() => {
    const stated = labelled(text, "molding", "moulding", "sticking", "inside edge", "inside-edge");
    if (!stated) return null;
    // An edge profile name is already captured above; only a real molding line counts.
    return /square|bevel|ogee|cove/i.test(stated) && stated.length <= 24 ? null : stated;
  })();
  const painted = parsePainted(text);
  const grainDirection = parseGrainDirection(text);
  const sheen = parseSheen(text);
  const undertone = parseUndertone(text);
  const colorText = parseColorText(text);

  const entryId = family === "raised-panel"
    ? RAISED_PANEL_BLUEPRINT_ID
    : family === "shaker"
      ? DOOR_LIBRARY_ENTRY_IDS.shaker
      : null;

  const params: AiDoorProfileParams = {
    entryId,
    family,
    railIn,
    stileIn,
    bevelWidthIn,
    bevelDepthIn: null,
    panelConstruction,
    insideEdgeProfile,
    cornerJoint,
    molding,
    painted,
    grainDirection,
    sheen,
    undertone,
    colorText,
  };

  const unstated = AI_DOOR_PARAM_FIELDS.filter((field) => params[field] == null || params[field] === "unknown");
  const notes: string[] = [];
  if (family === "unknown") notes.push("The description does not name a style family, so no library entry is applied.");
  if (railIn == null) notes.push(`Rail width was not stated; the ${RAISED_PANEL_BLUEPRINT.frame.railIn} in library default is drawn.`);
  if (painted == null) notes.push("The description does not say paint or stain, so the preview keeps the library's grain rule.");
  if (colorText == null) notes.push("No color was stated. Nothing is guessed and no brand swatch is used.");
  if (bevelWidthIn == null && family === "raised-panel") {
    notes.push(`Bevel width was not stated; the ${RAISED_PANEL_BLUEPRINT.bevel.widthIn} in library default is drawn.`);
  }

  return { model, description: text, params, unstated: [...unstated], notes };
}

/** Parse all three fields at once. Order matches `AI_DOOR_MODELS`. */
export function parseAiDoorComparison(
  fields: Partial<Record<AiDoorModel, string>>,
): Record<AiDoorModel, AiDoorParseResult> {
  return AI_DOOR_MODELS.reduce((accumulator, model) => {
    accumulator[model] = parseAiDoorDescription(model, fields[model] ?? "");
    return accumulator;
  }, {} as Record<AiDoorModel, AiDoorParseResult>);
}

/**
 * The style-shaped input the door blueprints accept, from parsed parameters.
 *
 * Only stated values are passed. Unstated dimensions stay absent so
 * `raisedPanelFrameGeometry` and the shaker blueprint fall back to their own
 * library defaults rather than a number this parser made up.
 */
export type AiDoorStyleInput = RaisedPanelStyleInput & {
  finishSheen?: "matte" | "satin" | "gloss" | null;
  grainDirection?: "vertical" | "horizontal" | "none" | null;
};

export function paramsAsStyleInput(
  params: AiDoorProfileParams,
  base: Partial<AiDoorStyleInput> = {},
): AiDoorStyleInput {
  const style: AiDoorStyleInput = {
    doorStyle: params.family === "raised-panel" ? "Raised Panel" : params.family === "shaker" ? "Shaker" : base.doorStyle ?? null,
    doorPanelType: base.doorPanelType ?? null,
    panelConstruction: params.panelConstruction === "raised" ? "raised" : params.panelConstruction === "flat" || params.panelConstruction === "recessed" ? "flat" : base.panelConstruction ?? null,
    railWidth: params.railIn,
    stileWidth: params.stileIn,
    bevelWidth: params.bevelWidthIn,
    bevelDepth: params.bevelDepthIn,
    insideEdgeProfile: params.insideEdgeProfile,
    finishSheen: params.sheen === "semi-gloss" ? "satin" : params.sheen,
    ...base,
  };
  if (params.painted === true) style.woodSpecies = "Painted";
  if (params.painted === false) style.woodSpecies = base.woodSpecies ?? "Solid wood";
  return style;
}

/** True when the parsed description is painted by the shipped paint rule. */
export function paramsRenderPainted(params: AiDoorProfileParams): boolean {
  if (params.painted != null) return params.painted;
  return isPaintedFinish({ woodSpecies: null, finish: null });
}

/**
 * The winner recorded as the door's official profile, plus the losing two kept as
 * reference. This is the shape the door editor saves.
 */
export type AiDoorOfficialRecord = {
  /** Which model won. */
  model: AiDoorModel;
  /** The winning description text, recorded as the profile description. */
  description: string;
  params: AiDoorProfileParams;
  /** Parameter names the winner left at the library default. */
  unstated: string[];
  /** The other two descriptions, kept for reference with their model names. */
  reference: Array<{ model: AiDoorModel; description: string }>;
  /** Plain-text color description merged from the winning description. */
  colorDescription: string | null;
};

/**
 * Build the official record from the three parsed results.
 *
 * Nothing is discarded: the winner's text and parsed parameters become the
 * profile, and the other two stay as named references. A winner with an empty
 * field is rejected, because there is nothing to record.
 */
export function chooseOfficialAiDescription(
  comparison: Record<AiDoorModel, AiDoorParseResult>,
  model: AiDoorModel,
): AiDoorOfficialRecord | null {
  const winner = comparison[model];
  if (!winner || !winner.description.trim()) return null;
  const reference = AI_DOOR_MODELS
    .filter((other) => other !== model && comparison[other]?.description.trim())
    .map((other) => ({ model: other, description: comparison[other]!.description }));
  return {
    model,
    description: winner.description,
    params: winner.params,
    unstated: winner.unstated,
    reference,
    colorDescription: winner.params.colorText,
  };
}

/**
 * Merge a chosen record into the style fields the door editor already saves.
 *
 * Only fields the record actually has are written. `profileDescription` receives
 * the winning text; the color description is never guessed.
 */
export function officialRecordAsStylePatch(
  record: AiDoorOfficialRecord,
): {
  profileDescription: string;
  colorDescription: string | null;
  railWidth: number | null;
  stileWidth: number | null;
  bevelWidth: number | null;
  bevelDepth: number | null;
  panelConstruction: "raised" | "flat" | null;
  insideEdgeProfile: string | null;
  finishSheen: "matte" | "satin" | "gloss" | null;
} {
  const { params } = record;
  return {
    profileDescription: record.description,
    colorDescription: record.colorDescription,
    railWidth: params.railIn,
    stileWidth: params.stileIn,
    bevelWidth: params.bevelWidthIn,
    bevelDepth: params.bevelDepthIn,
    panelConstruction: params.panelConstruction === "raised" ? "raised" : params.panelConstruction == null ? null : "flat",
    insideEdgeProfile: params.insideEdgeProfile,
    finishSheen: params.sheen === "semi-gloss" ? "satin" : params.sheen,
  };
}
