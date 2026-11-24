/**
 * Bug 1 (Tom, Nov 23 2026): with the dishwasher right against the range (or the
 * refrigerator), the opening-tightening pass reached past the dishwasher, took
 * the sink base as the range's "neighbor" and butted it to the range face —
 * straight on top of the dishwasher, with nothing on the report.
 *
 * The rule these tests hold: the piece directly beside an appliance is its
 * neighbor (another appliance included), a neighbor never slides onto anything,
 * and a measured sink base slides at most the anchor wiggle cap. A sink base
 * that has to stay put is named on the report.
 */
import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { tightenRunOpenings } from "./autoDesignTightenOpenings";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import {
  applianceAsDesignCabinet, appliancesForRoom, cabinetWall, wallPlacementAt, wallRunOffset, wallRunSpan,
  DEFAULT_ROOM, type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

const ROOM = { ...DEFAULT_ROOM } as RoomData;
const isSinkBase = (item: PlacedCabinet) => item.placement === "base" && /^SB/i.test(item.masterCode);
const isDw = (item: PlacedCabinet) => /^DW/i.test(item.masterCode);
const spanOf = (item: PlacedCabinet, room: RoomData) => {
  const wallId = cabinetWall(item, room);
  const start = wallRunOffset(item, wallId, room);
  return { wallId, start, end: start + wallRunSpan(item, wallId, room) };
};
const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  Math.min(a.end, b.end) - Math.max(a.start, b.start);

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };

function build(styleId: number, budget: boolean) {
  const pack = (matrix as unknown as Record<string, Pack>)[String(styleId)]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      // Explicit centers: the refrigerator at the left end, the sink at 72, the range at the right end. The dishwasher
      // goes right of the sink base, so it lands flush against the range.
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 72 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 129 },
      dishwasherSide: "right", skipDishwasher: false,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId, makeUid: () => `sb-${++uid}`,
  } as never) as { ok: boolean; message?: string; placed: PlacedCabinet[]; notes: string[] };
}

describe("the sink base never slides onto the dishwasher (bug 1)", () => {
  for (const styleId of [510004, 330014]) {
    for (const budget of [false, true]) {
      it(`${styleId} ${budget ? "budget" : "standard"}: fridge 18 / sink 72 / range 129, DW right — sink base and DW stay side by side`, () => {
        const run = build(styleId, budget);
        expect(run.ok, run.message).toBe(true);
        const sinkBase = run.placed.find(isSinkBase);
        const dw = run.placed.find(isDw);
        expect(sinkBase, "sink base").toBeTruthy();
        expect(dw, "dishwasher").toBeTruthy();
        const sb = spanOf(sinkBase!, ROOM);
        const d = spanOf(dw!, ROOM);
        expect(overlap(sb, d), `${sinkBase!.masterCode} ${sb.start}–${sb.end} vs ${dw!.masterCode} ${d.start}–${d.end}`).toBeLessThanOrEqual(0.05);
        // The sink base overlaps no appliance at all.
        for (const appliance of run.placed.filter((item) => item.placement === "appliance" && cabinetWall(item, ROOM) === sb.wallId)) {
          expect(overlap(sb, spanOf(appliance, ROOM)), `${sinkBase!.masterCode} vs ${appliance.masterCode}`).toBeLessThanOrEqual(0.05);
        }
        // The DW is still next to the sink base, and the sink base is still on its measured center within the wiggle cap.
        expect(Math.abs(d.start - sb.end)).toBeLessThanOrEqual(1.6);
        expect(Math.abs((sb.start + sb.end) / 2 - 72)).toBeLessThanOrEqual(kitchenRuleNumber("anchor_wiggle_cap_in") + 0.05);
        expect(run.notes.filter((note) => /^SB\S* was butted to RANGE/i.test(note))).toEqual([]);
      }, 60_000);
    }
  }
});

describe("tightenRunOpenings: neighbors of an appliance", () => {
  const piece = (uid: string, code: string, placement: PlacedCabinet["placement"], start: number, width: number, depth: number): PlacedCabinet => ({
    uid, cabinetId: 1, masterCode: code, description: code, category: placement === "appliance" ? "Appliance" : "Base", placement,
    ...wallPlacementAt(start, width, depth, "top", ROOM)!, width, depth, height: 34.5, numberOfDoors: 1, numberOfDrawers: 0, styleId: 1,
  } as PlacedCabinet);
  const tighten = (placed: PlacedCabinet[]) => {
    let uid = 0;
    return tightenRunOpenings({ placed, room: ROOM, wallIds: ["top"], fillers: [], styleId: 1, makeUid: () => `t-${++uid}` });
  };

  it("a sink base past a dishwasher that touches the range is not the range's neighbor and stays put", () => {
    const placed = [
      piece("SB", "SB36", "base", 54, 36, 24),
      piece("DW", "DW-24", "appliance", 90, 24, 24),
      piece("R", "RANGE-30", "appliance", 114, 30, 25),
    ];
    const out = tighten(placed);
    const sb = spanOf(out.placed.find((item) => item.uid === "SB")!, ROOM);
    const dw = spanOf(out.placed.find((item) => item.uid === "DW")!, ROOM);
    expect(sb.start).toBeCloseTo(54, 2);
    expect(overlap(sb, dw)).toBeLessThanOrEqual(0.05);
  });

  it("a sink base past a dishwasher that touches the refrigerator stays put", () => {
    const placed = [
      piece("F", "FRIDGE-36", "appliance", 0, 36, 30),
      piece("DW", "DW-24", "appliance", 36, 24, 24),
      piece("SB", "SB36", "base", 66, 36, 24),
    ];
    const out = tighten(placed);
    const sb = spanOf(out.placed.find((item) => item.uid === "SB")!, ROOM);
    const dw = spanOf(out.placed.find((item) => item.uid === "DW")!, ROOM);
    expect(sb.start).toBeCloseTo(66, 2);
    expect(overlap(sb, dw)).toBeLessThanOrEqual(0.05);
  });

  it("a sink base too far from the range to butt within the wiggle cap stays put and the report says so", () => {
    const placed = [
      piece("SB", "SB36", "base", 54, 36, 24),
      piece("R", "RANGE-30", "appliance", 100, 30, 25),
    ];
    const out = tighten(placed);
    const sb = spanOf(out.placed.find((item) => item.uid === "SB")!, ROOM);
    expect(sb.start).toBeCloseTo(54, 2);
    expect(out.findings.some((finding) => finding.code === "sink-base-kept-in-place" && finding.severity === "warning")).toBe(true);
  });

  it("a plain base still butts to the range (the tightening itself is unchanged)", () => {
    const placed = [
      piece("B", "B24", "base", 18, 24, 24),
      piece("R", "RANGE-30", "appliance", 48, 30, 25),
    ];
    const out = tighten(placed);
    expect(spanOf(out.placed.find((item) => item.uid === "B")!, ROOM).end).toBeCloseTo(48, 2);
  });
});
