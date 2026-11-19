import { describe, expect, it } from "vitest";
import { initialDoorColorSourceDraft, doorColorSourceReducer } from "@shared/doorColorSourceSelection";
import { initialProfileDescription, shouldPersistColorSource } from "./doorColorSourcePersist";

const NOW = "2026-11-18T19:00:00.000Z";

describe("shouldPersistColorSource", () => {
  it("persists a confirmed hex", () => {
    let draft = initialDoorColorSourceDraft(null);
    draft = doorColorSourceReducer(draft, { type: "choose", option: "hex", aiAvailable: false, now: NOW });
    expect(shouldPersistColorSource(draft)).toBe(false);
    draft = doorColorSourceReducer(draft, { type: "pendingHex", hex: "#224466" });
    expect(shouldPersistColorSource(draft)).toBe(false);
    draft = doorColorSourceReducer(draft, { type: "confirm", now: NOW });
    expect(shouldPersistColorSource(draft)).toBe(true);
  });

  it("does not persist a tile click that is waiting for Confirm, even over a saved choice", () => {
    const saved = initialDoorColorSourceDraft({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" });
    const clicked = doorColorSourceReducer(saved, { type: "choose", option: "sherwin-williams", aiAvailable: false, now: NOW });
    expect(clicked.stored?.source).toBe("original-image");
    expect(shouldPersistColorSource(clicked)).toBe(false);
  });

  it("persists a clicked Original image tile and a cleared (null) choice", () => {
    const saved = initialDoorColorSourceDraft({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" });
    const original = doorColorSourceReducer(saved, { type: "choose", option: "original-image", aiAvailable: false, now: NOW });
    expect(shouldPersistColorSource(original)).toBe(true);
    expect(shouldPersistColorSource(doorColorSourceReducer(original, { type: "reset", stored: null }))).toBe(true);
  });
});

describe("initialProfileDescription", () => {
  it("uses the saved profile description first", () => {
    expect(initialProfileDescription({ profileDescription: "Saved", aiProfileText: "AI" })).toBe("Saved");
  });
  it("falls back to the official AI profile text when the description is empty or blank", () => {
    expect(initialProfileDescription({ profileDescription: null, aiProfileText: "AI" })).toBe("AI");
    expect(initialProfileDescription({ profileDescription: "   ", aiProfileText: "AI" })).toBe("AI");
  });
  it("is empty with neither, and never throws on a missing style", () => {
    expect(initialProfileDescription({})).toBe("");
    expect(initialProfileDescription(null)).toBe("");
    expect(initialProfileDescription(undefined)).toBe("");
  });
});
