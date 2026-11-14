import { afterEach, describe, expect, it } from "vitest";
import { closeRemainingRunGaps, narrowBasePlusFillerWidth } from "./autoDesignCloseRemainingGaps";
import { KITCHEN_RULE_DEFINITIONS } from "./kitchenRuleRegistry";
import { setKitchenRuleParameters } from "./kitchenRuleParameters";
import { cabinetWall, wallPlacementAt, wallRunOffset, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import type { CatalogFillerCandidate } from "./catalogFiller";

// Tom, Nov 14 2026: a 14 in base opening was left empty instead of getting the
// largest base that fits plus a filler (B12 + 2 in). Test-only catalog rows.
const ROOM = { width: 132, depth: 120, ceilingHeight: 96 } as RoomData;
const row = (id: number, masterCode: string, width: number, extra: Partial<DesignCabinet> = {}): DesignCabinet => ({
  id, masterCode, description: `${width}" Base Cabinet`, category: "Base", subCategory: "Base", placement: "base",
  width: String(width), height: "34.5", depth: "24", numberOfDoors: 1, numberOfDrawers: 1, ...extra,
} as DesignCabinet);
const BASES = [row(1, "B9", 9), row(2, "B12", 12), row(3, "3DB12", 12, { description: '12" Three Drawer Base', numberOfDrawers: 3, numberOfDoors: 0 }), row(4, "B15", 15), row(5, "B27", 27)];
const FILLERS = [{ id: 90, masterCode: "TEST-BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "0.75", placement: "base" }] as unknown as CatalogFillerCandidate[];

function item(uid: string, masterCode: string, along: number, width: number, placement: PlacedCabinet["placement"]): PlacedCabinet {
  return { uid, cabinetId: 1, masterCode, description: masterCode, category: "Base", subCategory: "Base", placement,
    ...wallPlacementAt(along, width, 24, "top", ROOM), width, depth: 24, height: 34.5, styleId: 1 } as PlacedCabinet;
}

function fill(gapIn: number) {
  // B27 at 36, range right after the opening, and the reserved inside corner square at the end of the top wall.
  const rangeStart = 63 + gapIn;
  const placed = [item("b27", "B27", 36, 27, "base"), item("range", "RANGE-30", rangeStart, 30, "appliance")];
  let n = 0;
  const cornerStart = rangeStart + 30 + gapIn;
  const result = closeRemainingRunGaps({
    placed, room: ROOM, openings: [], wallIds: ["top"], baseCatalog: BASES, wallCatalog: [], fillers: FILLERS,
    styleId: 1, makeUid: () => `n-${++n}`, reservedSpans: [{ wallId: "top", start: cornerStart, end: ROOM.width }],
  });
  const added = result.placed.filter((p) => !placed.some((orig) => orig.uid === p.uid) && cabinetWall(p, ROOM) === "top")
    .map((p) => ({ code: p.masterCode, at: Math.round(wallRunOffset(p, "top", ROOM) * 100) / 100, width: p.width }))
    .sort((a, b) => a.at - b.at);
  return { added, rangeStart, cornerStart, placedAfter: result.placed };
}

describe("Auto Design closes a base opening with the largest base plus filler", () => {
  afterEach(() => setKitchenRuleParameters({}));

  it("is a Kitchen Rules setting, close_gap_with_cabinet_max_in = 14.5 in", () => {
    const rule = KITCHEN_RULE_DEFINITIONS.find((entry) => entry.key === "close_gap_with_cabinet_max_in");
    expect(rule?.defaultValue).toBe(14.5);
  });

  it("12 to 14.5 in picks the widest catalog base that leaves a seam-filler remainder", () => {
    expect([12, 13, 14, 14.5].map((gap) => narrowBasePlusFillerWidth(gap, BASES))).toEqual([12, 12, 12, 12]);
    // Outside the band the ordinary closer decides; 15 is a B15, not B12 + 3.
    expect(narrowBasePlusFillerWidth(15, BASES)).toBeNull();
    expect(narrowBasePlusFillerWidth(8, BASES)).toBeNull();
    // An admin can narrow the band.
    setKitchenRuleParameters({ close_gap_with_cabinet_max_in: 13 });
    expect(narrowBasePlusFillerWidth(14, BASES)).toBeNull();
  });

  it("seats a new B12 rather than growing the B27 beside the opening", () => {
    const { added, placedAfter } = fill(14);
    const b27 = placedAfter.find((entry) => entry.uid === "b27")!;
    expect([b27.masterCode, b27.width, Math.round(wallRunOffset(b27, "top", ROOM) * 100) / 100]).toEqual(["B27", 27, 36]);
    expect(added.filter((entry) => entry.at >= 63 - 0.01 && entry.at < 77 - 0.01).map((entry) => entry.code)).toEqual(["B12", "TEST-BF3"]);
  });

  it("does not drop a wide filler beside a reserved span (6 in stays for the review, no 6 in board)", () => {
    const placed = [item("b27", "B27", 36, 27, "base")];
    let n = 0;
    const result = closeRemainingRunGaps({
      placed, room: ROOM, openings: [], wallIds: ["top"], baseCatalog: BASES, wallCatalog: [], fillers: FILLERS,
      styleId: 1, makeUid: () => `x-${++n}`, reservedSpans: [{ wallId: "top", start: 0, end: 30 }, { wallId: "top", start: 69, end: ROOM.width }],
    });
    const added = result.placed.filter((p) => p.uid !== "b27");
    expect(added).toEqual([]);
  });

  it("14 in beside a B27 -> B12 + 2 in filler (a plain door base, not a drawer base)", () => {
    const { added } = fill(14);
    const beside = added.filter((entry) => entry.at >= 63 - 0.01 && entry.at < 77 - 0.01);
    expect(beside).toEqual([{ code: "B12", at: 63, width: 12 }, { code: "TEST-BF3", at: 75, width: 2 }]);
  });

  it("14 in next to the reserved corner square is filled, the square itself is not", () => {
    const { added, rangeStart, cornerStart } = fill(14);
    const nextToCorner = added.filter((entry) => entry.at >= rangeStart + 30 - 0.01);
    expect(nextToCorner).toEqual([{ code: "B12", at: rangeStart + 30, width: 12 }, { code: "TEST-BF3", at: rangeStart + 42, width: 2 }]);
    expect(added.some((entry) => entry.at >= cornerStart - 0.01)).toBe(false);
  });

  it("14.5 in -> B12 + 2.5 in filler", () => {
    const { added } = fill(14.5);
    const beside = added.filter((entry) => entry.at >= 63 - 0.01 && entry.at < 77.5 - 0.01);
    expect(beside).toEqual([{ code: "B12", at: 63, width: 12 }, { code: "TEST-BF3", at: 75, width: 2.5 }]);
  });
});
