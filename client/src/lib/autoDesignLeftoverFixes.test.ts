import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet } from "./design";
import {
  LEFTOVER_SPICE_WIDTH_IN,
  isNarrowLeftoverCabinet,
  leftoverAlternatives,
  leftoverFixes,
} from "./autoDesignLeftoverFixes";
import { homeownerSafeCopy } from "./designAlternatives";

type Pack = { base: DesignCabinet[] };
const BASES = (realCatalog as unknown as Record<string, Pack>)["330011"]!.base;

describe("a leftover opening is filled with a real cabinet, filler last", () => {
  it("defaults a 6 inch opening to a pull-out cabinet, not filler", () => {
    const fixes = leftoverFixes({ gapIn: 6, catalog: BASES });
    expect(LEFTOVER_SPICE_WIDTH_IN).toBe(6);
    expect(fixes[0]!.kind).toBe("narrow-cabinet");
    // A 6 inch real base exists on this line, so a filler is never the first answer.
    expect(fixes.some((fix) => fix.kind === "filler")).toBe(false);
    expect(fixes[0]!.summary).toMatch(/pull-out cabinet/i);
  });

  it("prefers a spice or pull-out base over a plain narrow base at the same width", () => {
    const spice = { id: 901, masterCode: "BSP6", description: '6" Spice Pull-Out Base', placement: "base", width: "6", height: "34.5", depth: "24", category: "Base", subCategory: "Spice Drawer Base", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: false } as DesignCabinet;
    const plain = { id: 902, masterCode: "B6", description: '6" Base Cabinet', placement: "base", width: "6", height: "34.5", depth: "24", category: "Base", subCategory: "Standard Base", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: false } as DesignCabinet;
    const fixes = leftoverFixes({ gapIn: 6, catalog: [plain, spice] });
    expect(fixes[0]!.cabinet?.masterCode).toBe("BSP6");
  });

  it("offers widening a neighbor before a filler", () => {
    const narrow = leftoverFixes({ gapIn: 6, catalog: [] , neighbor: { uid: "b24", masterCode: "B24", width: 24 } });
    const widened = { id: 3, masterCode: "B30", description: '30" Base', placement: "base", width: "30", height: "34.5", depth: "24", category: "Base", subCategory: "Standard Base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false } as DesignCabinet;
    const withWiden = leftoverFixes({ gapIn: 6, catalog: [widened], neighbor: { uid: "b24", masterCode: "B24", width: 24 } });
    expect(withWiden[0]!.kind).toBe("widen-neighbor");
    expect(withWiden[0]!.cabinet?.masterCode).toBe("B30");
    // Nothing real exists at all: then and only then does a filler appear.
    expect(narrow.some((fix) => fix.kind === "filler")).toBe(true);
  });

  it("offers a slide when the wiggle room can open a real width", () => {
    const fixes = leftoverFixes({ gapIn: 6, catalog: [], slideRoomIn: 3 });
    expect(fixes.some((fix) => fix.kind === "slide")).toBe(true);
  });

  it("uses homeowner words only: no SKU, no filler jargon, no error wording", () => {
    const { alternatives, reason } = leftoverAlternatives({ gapIn: 6, catalog: BASES });
    expect(alternatives.length).toBeGreaterThan(0);
    for (const alternative of alternatives) {
      expect(homeownerSafeCopy(alternative.summary)).toBe(true);
      expect(homeownerSafeCopy(alternative.reason)).toBe(true);
      // A real cabinet choice must not name its SKU to the homeowner.
      expect(alternative.summary).not.toMatch(/B\d{2}\b/);
    }
    expect(homeownerSafeCopy(reason)).toBe(true);
  });

  it("marks the first fix as closest to what they asked for", () => {
    const { alternatives } = leftoverAlternatives({ gapIn: 6, catalog: BASES });
    expect(alternatives[0]!.closest).toBe(true);
    for (const entry of alternatives.slice(1)) expect(entry.closest).toBe(false);
  });

  it("never treats a corner, sink base, panel, or filler as a narrow leftover cabinet", () => {
    const rows: DesignCabinet[] = [
      { id: 1, masterCode: "BBC36", description: "Blind corner", placement: "base", width: "36", height: "34.5", depth: "24", category: "Base", subCategory: "Blind Corner Base", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: true } as DesignCabinet,
      { id: 2, masterCode: "SB30", description: "Sink base", placement: "base", width: "30", height: "34.5", depth: "24", category: "Base", subCategory: "Sink Base", numberOfDoors: 2, numberOfDrawers: 1, isCornerCabinet: false } as DesignCabinet,
      { id: 3, masterCode: "BF6", description: '6" base filler', placement: "accessory", width: "6", height: "34.5", depth: "24", category: "Filler", subCategory: "Filler", numberOfDoors: 0, numberOfDrawers: 0, isCornerCabinet: false } as DesignCabinet,
    ];
    for (const row of rows) expect(isNarrowLeftoverCabinet(row)).toBe(false);
  });
});
