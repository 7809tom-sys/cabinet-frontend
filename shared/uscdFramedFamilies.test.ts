import { describe, expect, it } from "vitest";
import {
  USCD_FRAMED_FAMILIES,
  uscdFramedFamilyForStyle,
  uscdFramedFamilyLabel,
  uscdFramedLibraryFamily,
} from "./uscdFramedFamilies";
import {
  AI_DOOR_PARAM_LABELS,
  aiDoorUnstatedSentence,
  parseAiDoorDescription,
  parseAiDoorDescriptionForStyle,
} from "./aiDoorDescription";

const HAVEN_HARBOR = {
  ourName: "Haven Harbor",
  styleCode: "HH",
  doorStyle: null,
  railWidth: null,
  stileWidth: null,
};

describe("US Cabinet Depot framed families", () => {
  it("documents exactly the four framed families with their manual values", () => {
    const byId = Object.fromEntries(USCD_FRAMED_FAMILIES.map((family) => [family.id, family]));
    expect(Object.keys(byId).sort()).toEqual(["casselberry", "edgeline", "haven", "oxford"]);

    expect(byId.haven).toMatchObject({
      railIn: 2.75,
      stileIn: 2.75,
      centerPanel: "flat-recessed",
      insideEdge: "pillowed-bevel",
      fivePieceFrame: true,
      frameJoint: "mortise-and-tenon",
    });
    expect(byId.oxford).toMatchObject({ railIn: 2.75, stileIn: 2.75, insideEdge: "wide-angled-bevel" });
    expect(byId.edgeline).toMatchObject({ railIn: 2.75, stileIn: 2.75 });
    expect(byId.casselberry).toMatchObject({
      railIn: 3,
      stileIn: 3,
      frameJoint: "mitered",
      centerPanel: "raised",
      insideEdge: "pillowed-bevel",
    });
  });

  it("never states a sheen or undertone the manual does not give", () => {
    for (const family of USCD_FRAMED_FAMILIES) {
      expect(family.sheen).toBeNull();
      expect(family.undertone).toBeNull();
    }
  });

  it("recognizes the family from the style name or its code", () => {
    expect(uscdFramedFamilyForStyle({ ourName: "Haven Harbor" })?.id).toBe("haven");
    expect(uscdFramedFamilyForStyle({ ourName: "Oxford White" })?.id).toBe("oxford");
    expect(uscdFramedFamilyForStyle({ ourName: "Edgeline Dove" })?.id).toBe("edgeline");
    expect(uscdFramedFamilyForStyle({ ourName: "Casselberry" })?.id).toBe("casselberry");
    expect(uscdFramedFamilyForStyle({ ourName: "Harbor Blue", styleCode: "HH" })?.id).toBe("haven");
    expect(uscdFramedFamilyForStyle({ ourName: "Something", styleCode: "HH-Harbor" })?.id).toBe("haven");
  });

  it("returns null instead of borrowing a family for an unknown style", () => {
    expect(uscdFramedFamilyForStyle({ ourName: "Preston Oyster", styleCode: "PR" })).toBeNull();
    expect(uscdFramedFamilyForStyle(null)).toBeNull();
  });

  it("is a framed library build with a readable label", () => {
    const haven = USCD_FRAMED_FAMILIES[0]!;
    expect(uscdFramedLibraryFamily(haven)).toBe("raised-panel");
    expect(uscdFramedFamilyLabel(haven)).toContain("Haven");
    expect(uscdFramedFamilyLabel(haven)).toContain("2.75 in");
  });
});

describe("Haven Harbor no longer falls back to the generic shaker", () => {
  it("infers the family from the style name when the text says nothing", () => {
    const result = parseAiDoorDescriptionForStyle("gpt", "", HAVEN_HARBOR);
    expect(result.params.entryId).toBe("haven");
    expect(result.params.family).toBe("raised-panel");
    expect(result.params.railIn).toBe(2.75);
    expect(result.params.stileIn).toBe(2.75);
    expect(result.params.panelConstruction).toBe("recessed");
    expect(result.params.insideEdgeProfile).toContain("pillowed");
    // The fields the manual does not state still stay blank.
    expect(result.params.sheen).toBeNull();
    expect(result.params.undertone).toBeNull();
    expect(result.params.molding).toBeNull();
    expect(result.unstated).toContain("sheen");
    expect(result.unstated).toContain("undertone");
    expect(result.notes.join(" ")).toContain("Haven");
  });

  it("keeps a family the text itself names", () => {
    const result = parseAiDoorDescriptionForStyle(
      "gpt",
      "A slab front with no frame.",
      HAVEN_HARBOR,
    );
    expect(result.params.family).toBe("slab");
    expect(result.params.entryId).toBeNull();
  });

  it("keeps the saved rail width when the style row has one", () => {
    const result = parseAiDoorDescriptionForStyle("gpt", "", { ...HAVEN_HARBOR, railWidth: "3" });
    expect(result.params.railIn).toBe(3);
    // The stile was not saved, so the manual's 2.75 in applies.
    expect(result.params.stileIn).toBe(2.75);
  });

  it("leaves a style with no documented family exactly as before", () => {
    const result = parseAiDoorDescriptionForStyle("gpt", "", { ourName: "Preston Oyster", styleCode: "PR" });
    expect(result.params.family).toBe("unknown");
    expect(result.params.entryId).toBeNull();
  });

  it("still parses text with no style supplied", () => {
    const result = parseAiDoorDescription("gpt", "Shaker door with 2.75 in rails.");
    expect(result.params.family).toBe("shaker");
  });
});

describe("unstated fields read as plain words", () => {
  it("never prints a raw camelCase field name", () => {
    const sentence = aiDoorUnstatedSentence(["railIn", "stileIn", "panelConstruction", "insideEdgeProfile"]);
    expect(sentence).toBe("Using library defaults for: rail width, stile width, panel construction, inside edge profile.");
    expect(sentence).not.toMatch(/railIn|stileIn|panelConstruction|insideEdgeProfile/);
  });

  it("has a readable label for every compared field", () => {
    for (const [field, label] of Object.entries(AI_DOOR_PARAM_LABELS)) {
      expect(label, field).toMatch(/^[a-z ]+$/);
      // A single plain word (molding) is already readable; camelCase is not.
      expect(label, field).toBe(label.toLowerCase());
    }
  });

  it("says so when nothing was left at a default", () => {
    expect(aiDoorUnstatedSentence([])).toContain("Every compared detail was stated");
  });

  it("reads the real Haven sentence without field names", () => {
    const result = parseAiDoorDescriptionForStyle("gpt", "", HAVEN_HARBOR);
    const sentence = aiDoorUnstatedSentence(result.unstated);
    expect(sentence).toMatch(/^Using library defaults for: /);
    expect(sentence).not.toMatch(/[a-z][A-Z]/);
  });
});
