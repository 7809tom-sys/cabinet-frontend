/**
 * The mini preview draws from parsed parameters without changing the door's color.
 *
 * Tom's rule: no color snapping to the brand palette. The preview therefore paints
 * whatever `resolveDoorColor` returns (an accepted render first), and a
 * description's own color words are shown as text beside the preview rather than
 * converted into a hex.
 */
import { describe, expect, it } from "vitest";
import { aiDoorPreviewEntryLabel, aiDoorPreviewGeometry, previewFaceHex } from "./aiDoorPreview";
import { parseAiDoorDescription } from "@shared/aiDoorDescription";
import { resolveDoorColor } from "@shared/doorColorResolve";

const RAISED = parseAiDoorDescription("gpt", [
  "Style family: Raised Panel.",
  "Rail width: 2 1/2 in. Stile width: 2 1/2 in.",
  "Edge / bevel: bevel.",
  "Grain or painted: opaque painted finish.",
].join("\n")).params;

const SHAKER = parseAiDoorDescription("claude", [
  "Style family: shaker.",
  "Panel: flat recessed panel.",
  "Grain: visible wood grain, vertical.",
].join("\n")).params;

const SLAB = parseAiDoorDescription("gemini", "Style family: slab. Gloss.").params;

describe("preview color never snaps to the brand palette", () => {
  it("paints the resolver's own hex for any color", () => {
    for (const color of ["#1f4e8c", "#555553", "#8d8f92", "#2a8c8c", "#eeeadf"]) {
      const style = { id: 1, color, renderHex: null, finish: "Painted", woodSpecies: "Painted HDF" };
      expect(previewFaceHex(style), color).toBe(resolveDoorColor(style).appliedHex);
      // The four old brand swatches are never substituted.
      for (const brand of ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"]) {
        if (color.toLowerCase() !== brand) expect(previewFaceHex(style), `${color} vs ${brand}`).not.toBe(brand);
      }
    }
  });

  it("takes an accepted render's color first", () => {
    const accepted = { id: 2, color: "#c8a040", renderHex: "#e9e4d6", approvedVersionId: 9001, finish: "Painted" };
    expect(previewFaceHex(accepted).toLowerCase()).toBe("#e9e4d6");
  });

  it("falls back to a neutral swatch only when there is no style at all", () => {
    expect(previewFaceHex(null)).toBe("#e9e4d6");
    expect(previewFaceHex(undefined)).toBe("#e9e4d6");
  });
});

describe("preview geometry comes from the shipped blueprints", () => {
  it("draws a raised face with a frame and a raised center", () => {
    const geometry = aiDoorPreviewGeometry(RAISED);
    expect(geometry.slab).toBe(false);
    expect(geometry.frame).toBeGreaterThan(0);
    expect(geometry.raisedCenter).not.toBeNull();
    expect(geometry.raisedCenter!.width).toBeLessThan(geometry.opening.width);
    expect(geometry.raisedCenter!.height).toBeLessThan(geometry.opening.height);
    // Painted: no grain lines.
    expect(geometry.grain).toBe(false);
  });

  it("draws a shaker face with a frame and no raised center, and keeps grain", () => {
    const geometry = aiDoorPreviewGeometry(SHAKER);
    expect(geometry.slab).toBe(false);
    expect(geometry.frame).toBeGreaterThan(0);
    expect(geometry.raisedCenter).toBeNull();
    expect(geometry.grain).toBe(true);
  });

  it("draws a slab as a plain front with no frame", () => {
    const geometry = aiDoorPreviewGeometry(SLAB);
    expect(geometry.slab).toBe(true);
    expect(geometry.frame).toBe(0);
    expect(geometry.raisedCenter).toBeNull();
  });

  it("uses the library default for an unstated rail and the style's own when stated", () => {
    const defaulted = aiDoorPreviewGeometry({ ...RAISED, railIn: null, stileIn: null });
    const stated = aiDoorPreviewGeometry({ ...RAISED, railIn: 1, stileIn: 1 });
    // A stated narrower frame draws a visibly thinner frame than the 3 in default.
    expect(stated.frame).toBeLessThan(defaulted.frame);
  });

  it("names the entry each preview draws with", () => {
    expect(aiDoorPreviewEntryLabel(RAISED)).toContain("raised-panel library entry");
    expect(aiDoorPreviewEntryLabel(SHAKER)).toContain("shaker library entry");
    expect(aiDoorPreviewEntryLabel(SLAB)).toContain("slab front");
    expect(aiDoorPreviewEntryLabel(parseAiDoorDescription("gpt", "").params)).toContain("no library entry");
  });
});
