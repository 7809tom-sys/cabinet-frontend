import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { appliancesForRoom, applianceAsDesignCabinet, countertopSurfaces, isFillerItem, type RoomData } from "./design";

// Tom, voice, Nov 19 2026, 8:44 AM CT: the countertop runs continuously over fillers at the end of a run,
// including base fillers and dishwasher panels; it must not stop before a filler or panel.
const ROOM = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
const DOOR = { uid: "d", kind: "door", label: "Door", side: "right", offset: 100, width: 20, height: 80 };

// The customer asks for a lazy Susan so this layout keeps its corner cabinet; the budget economy
// corner (Tom, Nov 19 2026, 9:01 AM CT) is covered in autoDesignEconomyCorner.test.ts.
function build(sinkCenter: number, openings: any[], room: RoomData = ROOM) {
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: room.width === 144 ? 75 : 60 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["budget-friendly", "lazy-susan"], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room, openings, baseCatalog: (aero as any).base, wallCatalog: (aero as any).wall, fillers: (aero as any).accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps((aero as any).wall, (aero as any).surround?.deepAbove ?? []),
    refrigeratorEndPanels: (aero as any).surround?.endPanels ?? [], tallCatalog: (aero as any).tall ?? [],
    panelCatalog: [...(aero as any).accessory, ...((aero as any).surround?.endPanels ?? [])], styleId: 390019, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

/** Along-wall coverage of the right wall's counter (right wall runs along y). */
function rightCoverage(placed: any[], room: RoomData = ROOM): Array<[number, number]> {
  return countertopSurfaces(placed, room)
    .filter((s: any) => s.x + s.width >= room.width - 0.5 && s.depth > s.width - 0.01)
    .map((s: any) => [s.y, s.y + s.depth] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

describe("countertop runs over run-end fillers and the dishwasher panel (10x10 budget)", () => {
  it("12x10 L Aero 390019: the counter runs over the 6 in run-end filler F642 to the wall (it used to stop at 114 in)", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const r = build(70, [], room);
    expect(r.ok, r.message).toBe(true);
    const filler = r.placed.find((p: any) => p.wallId === "right" && p.masterCode === "F642" && Math.abs(p.wallOffset - 114) < 0.05);
    expect(filler).toBeTruthy();
    expect(filler.fillerPieceGroupId).toBeFalsy(); // a loose run-end strip, not an installed seam filler
    const cover = rightCoverage(r.placed, room);
    expect(cover.some(([a, b]) => a <= 114 - 1 && b >= 120 - 0.05)).toBe(true);
  });

  it("wall follows: the counter reaches the wall over the dishwasher's base filler", () => {
    const r = build(76, []);
    const filler = r.placed.find((p: any) => p.wallId === "right" && isFillerItem(p) && Math.abs(p.wallOffset - 118) < 0.05);
    expect(filler).toBeTruthy();
    const cover = rightCoverage(r.placed);
    expect(cover.some(([a, b]) => a <= 94 + 0.05 && b >= 120 - 0.05)).toBe(true);
  });

  it("opening follows: the counter runs over the DW panel to the panel's finished end", () => {
    const r = build(54, [DOOR]);
    const panel = r.placed.find((p: any) => p.autoPlacedReason === "dw-run-end-panel");
    expect(panel).toBeTruthy();
    const cover = rightCoverage(r.placed);
    expect(cover.some(([a, b]) => a <= 72 + 0.05 && b >= 99 - 0.05)).toBe(true);
  });

  it("a filler beside only a panel/refrigerator gets no orphan sliver of counter", () => {
    const r = build(76, []);
    const surfaces = countertopSurfaces(r.placed, ROOM);
    for (const s of surfaces) expect(Math.max(s.width, s.depth)).toBeGreaterThan(1.01);
  });
});
