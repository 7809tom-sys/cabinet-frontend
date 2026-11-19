import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { applyDishwasherRunEndRule } from "./autoDesignDishwasherRunEnd";
import { appliancesForRoom, applianceAsDesignCabinet, isFillerItem, type RoomData } from "./design";

// 10 x 10 ft (120 x 120 in) L-shaped budget kitchen; the sink + dishwasher run on the right wall.
const ROOM = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
const DOOR = { uid: "d", kind: "door", label: "Door", side: "right", offset: 100, width: 20, height: 80 };

// The customer asks for a lazy Susan so this layout keeps its corner cabinet; the budget economy
// corner (Tom, Nov 19 2026, 9:01 AM CT) is covered in autoDesignEconomyCorner.test.ts.
function build(pack: any, sinkCenter: number, openings: any[], budget = true) {
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly", "lazy-susan"] : [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings, baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 390019, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

const right = (r: any) => r.placed.filter((p: any) => p.wallId === "right" && p.placement !== "wall")
  .sort((a: any, b: any) => a.wallOffset - b.wallOffset);
const dwOf = (r: any) => right(r).find((p: any) => /^DW-/.test(p.masterCode));

describe("10x10 budget: dishwasher at a run end (Tom, voice, Nov 19 2026, 8:42 + 8:44 AM CT)", () => {
  it("a wall follows -> the base filler stays (no dishwasher panel)", () => {
    const r = build(aero, 76, []);
    expect(r.ok, r.message).toBe(true);
    const dw = dwOf(r);
    expect(dw.wallOffset + dw.width).toBeCloseTo(118, 2);
    const after = right(r).find((p: any) => Math.abs(p.wallOffset - 118) < 0.05);
    expect(after && isFillerItem(after)).toBe(true);
    expect(right(r).some((p: any) => p.autoPlacedReason === "dw-run-end-panel")).toBe(false);
  });

  it("an opening (door) follows -> the line's dishwasher panel BEP(DWR)3, not a base filler", () => {
    const r = build(aero, 54, [DOOR]);
    expect(r.ok, r.message).toBe(true);
    const dw = dwOf(r);
    const end = dw.wallOffset + dw.width;
    const after = right(r).filter((p: any) => p.wallOffset >= end - 0.05);
    expect(after.map((p: any) => p.masterCode)).toEqual(["BEP(DWR)3"]);
    expect(after[0].autoPlacedReason).toBe("dw-run-end-panel");
    expect(after[0].uid).toBe(`auto-dw-panel:${dw.uid}:end`);
    expect(r.notes.some((n: string) => /an opening follows, so its exposed side gets the line's dishwasher panel BEP\(DWR\)3/.test(n))).toBe(true);
  });

  it("unknown whether a wall follows (run stops in open floor) -> dishwasher panel", () => {
    const r = build(aero, 54, [DOOR]);
    const panel = right(r).find((p: any) => p.autoPlacedReason === "dw-run-end-panel");
    const filler = { ...aero.accessory.find((row: any) => row.masterCode === "F642"), ...panel, uid: "test-filler", masterCode: "F642", description: "Filler", category: "Filler", subCategory: "Filler", autoPlacedReason: undefined, width: 4 };
    const placed = [...r.placed.filter((p: any) => p.uid !== panel.uid), filler];
    const out = applyDishwasherRunEndRule({ placed, room: ROOM, openings: [], panelCatalog: aero.accessory as never, budgetFriendly: true });
    expect(out.changes[0]?.follows).toBe("unknown");
    expect(out.placed.some((p) => p.uid === "test-filler")).toBe(false);
    expect(out.placed.some((p) => p.masterCode === "BEP(DWR)3")).toBe(true);
  });

  it("the line sells no dishwasher panel -> clear report line and no filler", () => {
    const pack = { ...aero, accessory: aero.accessory.filter((row: any) => !/DWR/i.test(row.masterCode)) };
    const r = build(pack, 54, [DOOR]);
    expect(r.ok, r.message).toBe(true);
    const dw = dwOf(r);
    const end = dw.wallOffset + dw.width;
    expect(right(r).filter((p: any) => p.wallOffset >= end - 0.05)).toEqual([]);
    expect(r.notes.some((n: string) => /sells no dishwasher panel \(DWR\), so the .* base filler was removed/.test(n))).toBe(true);
  });

  it("non-budget builds are unchanged by this rule", () => {
    const r = build(aero, 54, [DOOR], false);
    expect(r.notes.some((n: string) => /takes a dishwasher panel|gets the line's dishwasher panel/.test(n))).toBe(false);
  });
});
