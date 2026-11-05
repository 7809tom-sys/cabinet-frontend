/**
 * The bridge between "Choose as official" and the 3D door.
 *
 * Tom's rule: keeping a description as official fills the editor's fields and the
 * normal Save persists them — and the door he is looking at redraws from the
 * choice straight away, not after a reload.
 *
 * What must hold:
 * - only the values the description actually stated travel to the renderer;
 * - color is never part of the draft, so an accepted render still wins and nothing
 *   snaps to the brand palette;
 * - a draft stops applying as soon as the saved row already agrees with it;
 * - the Designer reads the draft for the active style and for placed cabinets.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY,
  chosenProfileAlreadySaved,
  chosenProfileFromRecord,
  clearChosenDoorProfile,
  readChosenDoorProfile,
  saveChosenDoorProfile,
  withChosenDoorProfile,
  type ChosenDoorProfile,
} from "./aiDoorChosenProfile";
import { chooseOfficialAiDescription, parseAiDoorComparison, type AiDoorOfficialRecord } from "./aiDoorDescription";
import { styleWithChosenProfile } from "../client/src/lib/useChosenDoorProfiles";

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

const RAISED_TEXT = [
  "Style family: Raised Panel.",
  "Frame: mitered corners.",
  "Rail width: 2 1/2 in. Stile width: 2 1/2 in.",
  "Panel: raised center panel.",
  "Edge / bevel: bevel, about 3/4 in wide.",
  "Grain or painted: opaque painted finish.",
  "Sheen: matte.",
  "Undertone: warm.",
  "Color: warm ivory.",
].join("\n");

const SPARSE_TEXT = [
  "Style family: shaker.",
  "Grain: visible wood grain, vertical.",
].join("\n");

function recordFor(text: string, model: "gpt" | "claude" | "gemini" = "gpt"): AiDoorOfficialRecord {
  const comparison = parseAiDoorComparison({ [model]: text });
  const record = chooseOfficialAiDescription(comparison, model);
  if (!record) throw new Error("expected a record");
  return record;
}

describe("what a choice sends to the renderer", () => {
  it("keeps only the values the description stated", () => {
    const profile = chosenProfileFromRecord(recordFor(SPARSE_TEXT));
    expect(profile.doorStyle).toBe("Shaker");
    expect(profile.grainDirection).toBe("vertical");
    // Not stated, so absent: the renderer keeps the library default.
    expect(profile.railWidth).toBeUndefined();
    expect(profile.stileWidth).toBeUndefined();
    expect(profile.bevelWidth).toBeUndefined();
    expect(profile.bevelDepth).toBeUndefined();
  });

  it("carries a stated frame width through as inches", () => {
    const profile = chosenProfileFromRecord(recordFor(RAISED_TEXT));
    expect(profile.railWidth).toBe(2.5);
    expect(profile.stileWidth).toBe(2.5);
    expect(profile.bevelWidth).toBe(0.75);
    expect(profile.doorStyle).toBe("Raised Panel");
    expect(profile.panelConstruction).toBe("raised");
    expect(profile.finishSheen).toBe("matte");
  });

  it("maps a recessed center to the renderer's flat construction", () => {
    const profile = chosenProfileFromRecord(recordFor("Style family: shaker. Panel: flat recessed panel."));
    expect(profile.panelConstruction).toBe("flat");
  });

  it("never carries a color, a hex, or an approved-render marker", () => {
    const profile = chosenProfileFromRecord(recordFor(RAISED_TEXT));
    const keys = Object.keys(profile);
    for (const forbidden of ["color", "renderHex", "approvedVersionId", "approvedReferenceImageUrl"]) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    // The color words stay on the profile text, exactly as the description said.
    expect(profile.profileDescription).toContain("warm ivory");
  });
});

describe("the draft store", () => {
  it("round-trips one style's chosen profile and drops bad values", () => {
    const store = memoryStore();
    saveChosenDoorProfile(330026, {
      doorStyle: "Shaker",
      railWidth: 1.5,
      stileWidth: -2,
      bevelWidth: 0,
      panelConstruction: "flat",
      finishSheen: "satin",
      grainDirection: "vertical",
      profileDescription: "Shaker door.",
    } as ChosenDoorProfile, store);

    const read = readChosenDoorProfile(330026, store)!;
    expect(read.doorStyle).toBe("Shaker");
    expect(read.railWidth).toBe(1.5);
    // A negative or zero measurement is not a measurement.
    expect(read.stileWidth).toBeUndefined();
    expect(read.bevelWidth).toBeUndefined();
    expect(read.panelConstruction).toBe("flat");
  });

  it("is keyed per style and never leaks between them", () => {
    const store = memoryStore();
    saveChosenDoorProfile(1, { doorStyle: "Shaker" }, store);
    saveChosenDoorProfile(2, { doorStyle: "Slab", panelConstruction: "slab" }, store);
    expect(readChosenDoorProfile(1, store)!.doorStyle).toBe("Shaker");
    expect(readChosenDoorProfile(2, store)!.doorStyle).toBe("Slab");
    expect(readChosenDoorProfile(3, store)).toBeNull();
    expect(store.getItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY)).toContain("Shaker");
  });

  it("clears a style and survives corrupt storage", () => {
    const store = memoryStore();
    saveChosenDoorProfile(7, { doorStyle: "Shaker" }, store);
    clearChosenDoorProfile(7, store);
    expect(readChosenDoorProfile(7, store)).toBeNull();
    store.setItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY, "null");
    expect(readChosenDoorProfile(7, store)).toBeNull();
  });

  it("has nothing to say for a style id it was never given", () => {
    expect(readChosenDoorProfile(null, memoryStore())).toBeNull();
    expect(saveChosenDoorProfile(undefined, { doorStyle: "Shaker" }, memoryStore())).toBeNull();
  });
});

describe("merging a draft onto a style row", () => {
  const saved = {
    id: 330026,
    doorStyle: "Raised Panel",
    railWidth: "3",
    stileWidth: "3",
    panelConstruction: "raised",
    color: "#EEEADF",
    renderHex: null,
    approvedVersionId: 9012,
  };

  it("lets the choice's stated values win and leaves the rest alone", () => {
    const merged = withChosenDoorProfile(saved, { doorStyle: "Shaker", railWidth: 1.25 })!;
    expect(merged.doorStyle).toBe("Shaker");
    expect(merged.railWidth).toBe(1.25);
    // Untouched by the draft.
    expect(merged.stileWidth).toBe("3");
  });

  it("never changes the color or the accepted-render marker", () => {
    const merged = withChosenDoorProfile(saved, { doorStyle: "Shaker", panelConstruction: "flat" })!;
    expect(merged.color).toBe("#EEEADF");
    expect(merged.renderHex).toBeNull();
    expect(merged.approvedVersionId).toBe(9012);
  });

  it("does not add the bookkeeping timestamp to the style row", () => {
    const merged = withChosenDoorProfile(saved, { doorStyle: "Shaker", chosenAt: "2026-11-05T00:00:00.000Z" })!;
    expect(merged as Record<string, unknown>).not.toHaveProperty("chosenAt");
  });

  it("returns the row unchanged when there is no choice", () => {
    expect(withChosenDoorProfile(saved, null)).toBe(saved);
    expect(withChosenDoorProfile(null, { doorStyle: "Shaker" })).toBeNull();
  });

  it("stops applying once the saved row already agrees", () => {
    const draft: ChosenDoorProfile = { doorStyle: "Shaker", railWidth: 1.25, stileWidth: 1.25 };
    expect(chosenProfileAlreadySaved(draft, { doorStyle: "Shaker", railWidth: "1.25", stileWidth: 1.25 })).toBe(true);
    expect(chosenProfileAlreadySaved(draft, { doorStyle: "Shaker", railWidth: "1.5", stileWidth: 1.25 })).toBe(false);
    // A row that has not caught up is not "saved".
    expect(chosenProfileAlreadySaved(draft, { doorStyle: "Raised Panel" })).toBe(false);
    expect(chosenProfileAlreadySaved(null, { doorStyle: "Shaker" })).toBe(false);
  });
});

describe("the Designer reads the choice", () => {
  const saved = { id: 330026, doorStyle: "Raised Panel", railWidth: "3", color: "#EEEADF", renderHex: null };

  it("merges the draft onto the style the Designer already holds", () => {
    const merged = styleWithChosenProfile(saved, (id) => (id === 330026 ? { doorStyle: "Shaker", railWidth: 1.25 } : null));
    expect(merged.doorStyle).toBe("Shaker");
    expect(merged.railWidth).toBe(1.25);
    expect(merged.color).toBe("#EEEADF");
  });

  it("leaves a style with no choice untouched", () => {
    expect(styleWithChosenProfile(saved, () => null)).toBe(saved);
  });

  it("ignores a draft the saved row already carries", () => {
    const draft: ChosenDoorProfile = { doorStyle: "Shaker", railWidth: 1.25 };
    const caughtUp = { id: 330026, doorStyle: "Shaker", railWidth: "1.25" };
    expect(styleWithChosenProfile(caughtUp, () => draft)).toBe(caughtUp);
  });

  it("is wired into the 3D Designer's door styles, for the active style and every placed cabinet", () => {
    const designer = readFileSync(new URL("../client/src/pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(designer).toContain("useChosenDoorProfiles");
    expect(designer).toContain("withChosenProfiles<(typeof catalogDoorStyles)[number]>(catalogDoorStyles, chosenProfileFor)");
    // The merged rows feed activeStyle and the per-cabinet profiles, which are the
    // two inputs the 3D renderer and the elevation read.
    expect(designer).toContain("doorStyles?.find((s) => s.id === styleId)");
    expect(designer).toContain("cabinetDoorProfiles={threeDCabinetDoorProfiles}");
    expect(designer).toContain("catalogDoorProfile={activeCatalogDoorProfile}");
  });

  it("refreshes on a choice made in this tab, not only on a reload", () => {
    const source = readFileSync(new URL("../client/src/lib/useChosenDoorProfiles.ts", import.meta.url), "utf8");
    expect(source).toContain("AI_DOOR_CHOSEN_PROFILE_EVENT");
    expect(source).toContain('window.addEventListener("storage"');
    expect(source).toContain('window.addEventListener("focus"');
    // The editor announces its choice so the Designer in the same tab re-reads.
    const editor = readFileSync(
      new URL("../client/src/components/admin/AiDoorDescriptionCompare.tsx", import.meta.url),
      "utf8",
    );
    expect(editor).toContain("announceChosenDoorProfile(style.id)");
  });
});
