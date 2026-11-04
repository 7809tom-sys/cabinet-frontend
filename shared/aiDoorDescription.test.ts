/**
 * The AI door-description comparison: parsing, the three prompts, the official
 * choice, the reference copies, and the plain-text color description.
 *
 * The parser must never invent a dimension. Everything a description does not
 * state stays at the library default and is reported in `unstated`.
 */
import { describe, expect, it } from "vitest";
import {
  AI_DOOR_MODELS,
  AI_DOOR_MODEL_LABELS,
  AI_DOOR_PARAM_FIELDS,
  AI_DOOR_PROMPTS,
  chooseOfficialAiDescription,
  officialRecordAsStylePatch,
  paramsAsStyleInput,
  parseAiDoorComparison,
  parseAiDoorDescription,
  parseColorText,
  parseCornerJoint,
  parseFamily,
  parseInchesFromText,
  parseInsideEdge,
  parsePainted,
  parsePanelConstruction,
  parseSheen,
  parseUndertone,
} from "./aiDoorDescription";
import {
  AI_DOOR_COMPARISON_STORAGE_KEY,
  DOOR_COLOR_DESCRIPTION_STORAGE_KEY,
  chooseOfficialAiDoorDescription,
  parsedAiDoorComparison,
  readAiDoorComparison,
  readDoorColorDescription,
  saveAiDoorComparison,
  saveDoorColorDescription,
} from "./aiDoorDescriptionStore";
import { RAISED_PANEL_BLUEPRINT_ID } from "./raisedPanelDoorBlueprint";
import { DOOR_LIBRARY_ENTRY_IDS } from "./doorLibraryProfiles";

/** A memory-backed Storage for the tests, so nothing touches the real browser. */
function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); },
  } as Storage;
}

const RAISED_DESCRIPTION = [
  "1. Style family: Raised Panel with a square five-piece frame.",
  "2. Frame: present, mitered corners at 45 degrees.",
  "3. Rail width: 2 1/2 in. Stile width: 2 1/2 in.",
  "4. Panel: raised center panel.",
  "5. Edge / bevel: bevel, about 3/4 in wide.",
  "6. Molding: a stepped cove molding around the panel.",
  "7. Grain or painted: opaque painted finish, no visible grain.",
  "8. Sheen: soft matte, low-luster.",
  "9. Undertone: warm.",
  "10. Color: warm ivory with a slight cream undertone.",
].join("\n");

const SHAKER_DESCRIPTION = [
  "Style family: shaker.",
  "Frame: present, cope-and-stick joints.",
  "Rail width 3 in, stile width 3 in.",
  "Panel: flat recessed center panel.",
  "Edge: square inside edge.",
  "Grain: visible wood grain, vertical.",
  "Sheen: satin.",
  "Undertone: neutral.",
  "Color: pale greige.",
].join("\n");

describe("the three prompts", () => {
  it("exist for GPT, Claude, and Gemini, in that order", () => {
    expect([...AI_DOOR_MODELS]).toEqual(["gpt", "claude", "gemini"]);
    expect(AI_DOOR_MODEL_LABELS.gpt).toBe("GPT");
    expect(AI_DOOR_MODEL_LABELS.claude).toBe("Claude");
    expect(AI_DOOR_MODEL_LABELS.gemini).toBe("Gemini");
    for (const model of AI_DOOR_MODELS) {
      expect(AI_DOOR_PROMPTS[model].length, model).toBeGreaterThan(200);
    }
  });

  it("ask every model for the same comparable fields", () => {
    for (const model of AI_DOOR_MODELS) {
      const prompt = AI_DOOR_PROMPTS[model].toLowerCase();
      for (const field of ["style", "frame", "panel", "bevel", "sheen", "undertone", "color"]) {
        expect(prompt, `${model} / ${field}`).toContain(field);
      }
      // Every prompt tells the model to say what it cannot see rather than guess.
      expect(prompt, model).toMatch(/not visible|never guess|do not guess/);
      // And each asks for color in words, explicitly not a hex code, so a hex can
      // never become a brand-palette snap.
      expect(prompt, model).toMatch(/not a hex|rather than a hex/);
    }
  });

  it("are tailored, not the same text three times", () => {
    const texts = AI_DOOR_MODELS.map((model) => AI_DOOR_PROMPTS[model]);
    expect(new Set(texts).size).toBe(3);
  });
});

describe("parsing one description", () => {
  it("reads a raised-panel description into the raised-panel library entry", () => {
    const parsed = parseAiDoorDescription("gpt", RAISED_DESCRIPTION);
    expect(parsed.params.family).toBe("raised-panel");
    expect(parsed.params.entryId).toBe(RAISED_PANEL_BLUEPRINT_ID);
    expect(parsed.params.panelConstruction).toBe("raised");
    expect(parsed.params.cornerJoint).toBe("mitered");
    expect(parsed.params.railIn).toBe(2.5);
    expect(parsed.params.stileIn).toBe(2.5);
    expect(parsed.params.painted).toBe(true);
    expect(parsed.params.sheen).toBe("matte");
    expect(parsed.params.undertone).toBe("warm");
    expect(parsed.params.colorText).toContain("warm ivory");
    expect(parsed.params.insideEdgeProfile).toContain("bevel");
    expect(parsed.params.molding).toContain("cove");
  });

  it("reads a shaker description into the shaker library entry with grain", () => {
    const parsed = parseAiDoorDescription("claude", SHAKER_DESCRIPTION);
    expect(parsed.params.family).toBe("shaker");
    expect(parsed.params.entryId).toBe(DOOR_LIBRARY_ENTRY_IDS.shaker);
    expect(parsed.params.cornerJoint).toBe("cope-and-stick");
    expect(parsed.params.railIn).toBe(3);
    expect(parsed.params.painted).toBe(false);
    expect(parsed.params.grainDirection).toBe("vertical");
    expect(parsed.params.sheen).toBe("satin");
  });

  it("leaves unstated dimensions at the library default and reports them", () => {
    const parsed = parseAiDoorDescription("gemini", "Style family: raised panel. Painted white.");
    expect(parsed.params.entryId).toBe(RAISED_PANEL_BLUEPRINT_ID);
    // Nothing invented.
    expect(parsed.params.railIn).toBeNull();
    expect(parsed.params.stileIn).toBeNull();
    expect(parsed.params.bevelWidthIn).toBeNull();
    expect(parsed.params.bevelDepthIn).toBeNull();
    // And each one is named as unstated.
    expect(parsed.unstated).toContain("railIn");
    expect(parsed.unstated).toContain("stileIn");
    expect(parsed.unstated).toContain("bevelWidthIn");
    expect(parsed.notes.some((note) => /library default is drawn/.test(note))).toBe(true);
  });

  it("returns everything unstated for an empty field, without guessing", () => {
    const parsed = parseAiDoorDescription("gpt", "   ");
    expect(parsed.description).toBe("");
    expect(parsed.unstated.sort()).toEqual([...AI_DOOR_PARAM_FIELDS].sort());
    expect(parsed.params.entryId).toBeNull();
    expect(parsed.params.family).toBe("unknown");
    expect(parsed.notes[0]).toContain("library default");
  });

  it("treats 'not visible' as unstated rather than as a value", () => {
    const parsed = parseAiDoorDescription("gpt", "Style family: shaker.\nRail width: not visible.\nSheen: not visible.");
    expect(parsed.params.railIn).toBeNull();
    expect(parsed.params.sheen).toBeNull();
    expect(parsed.unstated).toContain("railIn");
    expect(parsed.unstated).toContain("sheen");
  });

  it("parses all three fields with one call, in model order", () => {
    const comparison = parseAiDoorComparison({
      gpt: RAISED_DESCRIPTION,
      claude: SHAKER_DESCRIPTION,
      gemini: "",
    });
    expect(Object.keys(comparison)).toEqual([...AI_DOOR_MODELS]);
    expect(comparison.gpt.params.family).toBe("raised-panel");
    expect(comparison.claude.params.family).toBe("shaker");
    expect(comparison.gemini.description).toBe("");
  });
});

describe("the small readers", () => {
  it("reads inches in mixed, fractional, and decimal forms", () => {
    expect(parseInchesFromText("2 1/2 in")).toBe(2.5);
    expect(parseInchesFromText('3"')).toBe(3);
    expect(parseInchesFromText("2.75 inches")).toBe(2.75);
    expect(parseInchesFromText("3/4 in")).toBe(0.75);
    expect(parseInchesFromText("not visible")).toBeNull();
    expect(parseInchesFromText("")).toBeNull();
  });

  it("classifies families case-insensitively, raised before shaker and slab before shaker", () => {
    expect(parseFamily("RAISED PANEL")).toBe("raised-panel");
    expect(parseFamily("Shaker")).toBe("shaker");
    expect(parseFamily("a raised shaker-style panel")).toBe("raised-panel");
    expect(parseFamily("slab-fronted shaker look")).toBe("slab");
    expect(parseFamily("unknown")).toBe("unknown");
  });

  it("reads panel construction, edge profiles, joints, sheen, undertone, and paint", () => {
    expect(parsePanelConstruction("raised center")).toBe("raised");
    expect(parsePanelConstruction("recessed panel")).toBe("recessed");
    expect(parsePanelConstruction("flat center")).toBe("flat");
    expect(parseInsideEdge("ogee with a cove")).toBe("ogee + cove");
    expect(parseCornerJoint("45-degree mitered corners")).toBe("mitered");
    expect(parseCornerJoint("cope and stick")).toBe("cope-and-stick");
    expect(parseSheen("semi-gloss")).toBe("semi-gloss");
    expect(parseSheen("high gloss")).toBe("gloss");
    expect(parseSheen("soft matte")).toBe("matte");
    expect(parseUndertone("slight cream undertone, warm")).toBe("warm");
    expect(parseUndertone("cool bluish")).toBe("cool");
    expect(parsePainted("opaque painted finish")).toBe(true);
    expect(parsePainted("visible wood grain")).toBe(false);
    expect(parsePainted("a door")).toBeNull();
  });

  it("keeps the model's color words and never invents a hex", () => {
    expect(parseColorText("Color: warm ivory with a soft matte finish")).toContain("warm ivory");
    expect(parseColorText("nothing here")).toBeNull();
    // A description that only says "white" in prose does not become a color value.
    expect(parseColorText("the door is white")).toBeNull();
  });
});

describe("choosing one description as official", () => {
  const comparison = parseAiDoorComparison({
    gpt: RAISED_DESCRIPTION,
    claude: SHAKER_DESCRIPTION,
    gemini: "Style family: slab. Painted, gloss.",
  });

  it("records the winner and keeps the other two as reference", () => {
    const record = chooseOfficialAiDescription(comparison, "claude");
    expect(record).not.toBeNull();
    expect(record!.model).toBe("claude");
    expect(record!.description).toBe(SHAKER_DESCRIPTION);
    expect(record!.params.family).toBe("shaker");
    expect(record!.reference.map((entry) => entry.model).sort()).toEqual(["gemini", "gpt"]);
    expect(record!.reference.find((entry) => entry.model === "gpt")?.description).toBe(RAISED_DESCRIPTION);
  });

  it("keeps the winner's unstated list with the record", () => {
    const record = chooseOfficialAiDescription(comparison, "gemini");
    expect(record).not.toBeNull();
    expect(record!.unstated).toContain("railIn");
  });

  it("refuses an empty field, because there is nothing to record", () => {
    const withEmpty = parseAiDoorComparison({ gpt: RAISED_DESCRIPTION });
    expect(chooseOfficialAiDescription(withEmpty, "claude")).toBeNull();
  });

  it("turns the record into a style patch that only writes stated values", () => {
    const sparse = parseAiDoorComparison({ gpt: "Style family: raised panel. Painted warm white." });
    const record = chooseOfficialAiDescription(sparse, "gpt")!;
    const patch = officialRecordAsStylePatch(record);
    expect(patch.profileDescription).toBe(record.description);
    expect(patch.panelConstruction).toBe("raised");
    // Never invented: an unstated rail stays null in the patch.
    expect(patch.railWidth).toBeNull();
    expect(patch.stileWidth).toBeNull();
    expect(patch.bevelWidth).toBeNull();
    expect(patch.colorDescription).toBe(record.colorDescription);
  });

  it("hands only stated dimensions to the blueprint-style input", () => {
    const parsed = parseAiDoorDescription("gpt", "Style family: raised panel. Painted. Rail width 2.5 in.");
    const style = paramsAsStyleInput(parsed.params);
    expect(style.railWidth).toBe(2.5);
    expect(style.stileWidth).toBeNull();
    expect(style.bevelWidth).toBeNull();
    // Unstated dimensions stay absent so the library default applies downstream.
    expect(style.doorStyle).toBe("Raised Panel");
    expect(style.woodSpecies).toBe("Painted");
  });
});

describe("saved state", () => {
  it("saves and reloads the three descriptions for one style", () => {
    const store = memoryStore();
    const saved = saveAiDoorComparison(330026, {
      fields: { gpt: RAISED_DESCRIPTION, claude: SHAKER_DESCRIPTION },
      chosen: null,
      reference: {},
    }, store);
    expect(saved.fields.gpt).toBe(RAISED_DESCRIPTION);
    const reloaded = readAiDoorComparison(330026, store);
    expect(reloaded.fields.claude).toBe(SHAKER_DESCRIPTION);
    expect(reloaded.chosen).toBeNull();
    // Nothing leaked onto another style.
    expect(readAiDoorComparison(330027, store).fields.gpt).toBeUndefined();
  });

  it("keeps the loser reference when a winner is chosen, even for a field later cleared", () => {
    const store = memoryStore();
    saveAiDoorComparison(1, {
      fields: { gpt: RAISED_DESCRIPTION, claude: SHAKER_DESCRIPTION, gemini: "Style family: slab." },
      chosen: null,
      reference: {},
    }, store);
    const chosen = chooseOfficialAiDoorDescription(1, readAiDoorComparison(1, store), "gpt", store);
    expect(chosen.chosen).toBe("gpt");
    expect(chosen.fields.gpt).toBe(RAISED_DESCRIPTION);
    // The other two are preserved as reference.
    expect(chosen.reference.claude).toBe(SHAKER_DESCRIPTION);
    expect(chosen.reference.gemini).toBe("Style family: slab.");
    expect(chosen.reference.gpt).toBeUndefined();
    // Parsing the saved state again still gives three comparable results.
    const reparsed = parsedAiDoorComparison(readAiDoorComparison(1, store));
    expect(reparsed.gpt.params.family).toBe("raised-panel");
    expect(reparsed.claude.params.family).toBe("shaker");
  });

  it("survives corrupt storage without throwing", () => {
    const store = memoryStore();
    store.setItem(AI_DOOR_COMPARISON_STORAGE_KEY, "{not json");
    expect(readAiDoorComparison(1, store)).toEqual({ fields: {}, chosen: null, reference: {} });
  });

  it("keeps a blank color description blank and stores one when typed", () => {
    const store = memoryStore();
    expect(readDoorColorDescription(5, store)).toBe("");
    expect(saveDoorColorDescription(5, "", store)).toBe("");
    expect(readDoorColorDescription(5, store)).toBe("");
    saveDoorColorDescription(5, "  warm ivory with a soft matte sheen  ", store);
    expect(readDoorColorDescription(5, store)).toBe("warm ivory with a soft matte sheen");
    expect(store.getItem(DOOR_COLOR_DESCRIPTION_STORAGE_KEY)).toContain("warm ivory");
    // Clearing it removes the entry rather than storing an empty string.
    saveDoorColorDescription(5, "   ", store);
    expect(readDoorColorDescription(5, store)).toBe("");
  });
});
