import { describe, expect, it } from "vitest";
import { isFivePieceSlabLabel, styleHasFivePieceSlabLabel } from "./doorFrontStyle";
import { resolveDoorShapeDecision } from "./doorRenderIdentity";
import { resolveDoorProfile } from "./doorStyleAppearance";
import { doorPanelKind } from "../client/src/lib/doorPanelKind";

describe("five-piece slab labels", () => {
  it("recognizes the door-front labels and leaves shaker sentences alone", () => {
    for (const label of ["five-piece slab", "5-piece slab", "5 piece slab", "Five-Piece Slab", "5 piece", "5-piece", "five-piece", "five-piece flat", "5-piece flat panel"]) {
      expect(isFivePieceSlabLabel(label), label).toBe(true);
    }
    expect(isFivePieceSlabLabel("Slab")).toBe(false);
    expect(isFivePieceSlabLabel("Shaker")).toBe(false);
    expect(isFivePieceSlabLabel("Five-piece mortise-and-tenon frame; flat recessed center panel.")).toBe(false);
    expect(isFivePieceSlabLabel("Shaker cabinet doors feature a classic five-piece design")).toBe(false);
  });

  it("maps a five-piece slab label to that shape even when the other field still says shaker", () => {
    expect(resolveDoorShapeDecision({ doorStyle: "Shaker", doorPanelType: "five-piece slab" })).toEqual({
      shape: "five-piece-slab",
      source: "distributor",
    });
    expect(resolveDoorShapeDecision({ doorStyle: "5 piece" })).toEqual({
      shape: "five-piece-slab",
      source: "distributor",
    });
    expect(resolveDoorShapeDecision({ doorStyle: "Slab" }).shape).toBe("slab");
    expect(resolveDoorShapeDecision({ doorStyle: "Shaker", doorPanelType: "Flat recessed center panel" }).shape).toBe("recessed-shaker");
    const profile = resolveDoorProfile({ doorStyle: "Shaker", doorPanelType: "5-piece slab", railWidth: 2.75 });
    expect(profile.doorStyle).toBe("Five-Piece Slab");
    expect(profile.doorPanelType).toBe("Five-Piece Slab");
    expect(profile.panelConstruction).not.toBe("slab");
    expect(doorPanelKind(profile.doorStyle)).toBe("five-piece-slab");
    expect(styleHasFivePieceSlabLabel({ doorStyle: "Shaker", doorPanelType: "5 piece" })).toBe(true);
  });
});
