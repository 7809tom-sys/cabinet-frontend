/**
 * Minimum filler (Tom, voice, Nov 19 2026, 7:19 AM CT), on the 12 x 10 ft (144 x 120 in)
 * L-shaped kitchen he ran at 7:10 AM. Before/after (Aero 390019, fridge flush left,
 * range centered 75 in, sink centered 70 in on the 10 ft wall, dishwasher on):
 *
 *  STANDARD, 12 ft wall (Wall 1)
 *   before  base: REPV | FRIDGE-36 | F342 ½ (inside panel) | REPV | B21 | F342 1¾ | RANGE-30 | 3DB18 | ERB36
 *           wall: W361224 | W2130 | (1¾ open) | W3012 bridge | WSV30 | W-15-30 | F342 2¼ | W1230 | DCW
 *   after   the wall-side REPV and the ½ in inside-panel filler go (refrigerator rule, 7:41 AM), the
 *           fridge sits on the wall; range + MW + bridge slide 2¼ toward the fridge (inside the 3 in wiggle);
 *           base: FRIDGE-36 | REPV | B21 | RANGE-30 | 3DB18 | F342 2¼ | ERB36
 *           wall: W361224 | REPV | W2130 | W3012 bridge | WSV30 | W1830 (was W-15-30) | F342 1½ | W1230 | DCW
 *           nothing beside the bridge; filler + open 6¾ in -> 3¾ in.
 *  BUDGET, 10 ft wall (Wall 2)
 *   before  wall: ... W3612 | W1230 | W1230 | F642 6 (and the note said the 6 in "stays open")
 *   after   wall: ... W3612 | W1230 | W1830; base keeps one F642 strip against the wall end,
 *           and the note now says that.
 */
import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isFillerItem, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";
import { applyMinimumFiller } from "./autoDesignMinimumFiller";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = aero as unknown as Pack;
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

// The customer asks for a lazy Susan so this layout keeps its corner cabinet; the budget economy
// corner (Tom, Nov 19 2026, 9:01 AM CT) is covered in autoDesignEconomyCorner.test.ts.
function build(budget: boolean) {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 75 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 70 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: {
        ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly", "lazy-susan"] : [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
      },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: 390019, makeUid: () => `m-${++uid}`,
  } as never) as unknown as { ok: boolean; message?: string; placed: PlacedCabinet[]; notes: string[]; fifteenRepackMoves: { uid: string; deltaAlongIn: number }[] };
  if (!result.ok) throw new Error(result.message ?? "build failed");
  return result;
}

const isUpper = (p: PlacedCabinet) => p.placement === "wall" || (p.placement === "appliance" && (Number(p.mountBottom) || 0) > 30);
function row(placed: PlacedCabinet[], wall: string, upper: boolean) {
  return placed
    .filter((p) => cabinetWall(p, ROOM) === wall && (upper ? isUpper(p) || p.placement === "tall" : !isUpper(p)))
    .map((p) => ({ p, start: wallRunOffset(p, wall, ROOM), end: wallRunOffset(p, wall, ROOM) + wallRunSpan(p, wall, ROOM) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}
const fillerInches = (entries: ReturnType<typeof row>) => entries.filter(({ p }) => isFillerItem(p)).reduce((sum, { p }) => sum + Number(p.width), 0);
const codes = (entries: ReturnType<typeof row>) => entries.map(({ p }) => p.masterCode);

describe("144 x 120 L, standard mode", () => {
  const result = build(false);
  const base = row(result.placed, "top", false);
  const wall = row(result.placed, "top", true);

  it("rule 2: the range slides inside its wiggle with its bridge and microwave", () => {
    const range = result.placed.find((p) => /^RANGE/.test(p.masterCode))!;
    const bridge = result.placed.find((p) => p.overRangeMicrowaveBridge)!;
    const mw = result.placed.find((p) => /^MW/.test(p.masterCode))!;
    const start = wallRunOffset(range, "top", ROOM);
    // Rich's bridge rule (Tom, Nov 19 2026): the refrigerator's bridge now carries its 1/2 in board on the open side,
    // so the opening is 1/2 in wider and the range sits 1/2 in further along (was 57.75).
    expect(start).toBeCloseTo(58.25, 2);
    expect(wallRunOffset(bridge, "top", ROOM)).toBeCloseTo(start, 2);
    expect(wallRunOffset(mw, "top", ROOM)).toBeCloseTo(start, 2);
    expect(result.notes.some((note) => /^Minimum filler: RANGE-30 slid 1¾″/.test(note))).toBe(true);
  });

  it("rules 2/3: W-15-30 + 2¼ in wall filler became W1830; no 2¼ in board is left on the wall row", () => {
    expect(codes(wall)).toContain("W1830");
    expect(codes(wall)).not.toContain("W-15-30");
    expect(wall.some(({ p }) => isFillerItem(p) && Math.abs(Number(p.width) - 2.25) < 0.01)).toBe(false);
  });

  it("rule 1: less filler on the 12 ft wall (filler + open 6¾ in -> 3¾ in: base 2¼ strip by the corner, wall 1½)", () => {
    // the ½ inside the fridge panel went with the wall-side panel (refrigerator rule); 2¼ by the corner is the
    // least this run allows (B21 + range + 3DB18 in 71¼ in; the next sizes are 3 in steps)
    // Rich's bridge rule: the open-side 1/2 in bridge board takes 1/2 in of this run, so the corner strip is 1¾ (was 2¼).
    expect(fillerInches(base)).toBeCloseTo(1.75, 2);
    expect(fillerInches(wall)).toBeCloseTo(1.5, 2);
    expect(result.notes.some((note) => /^Minimum filler on Wall 1: filler and open inches went from/.test(note))).toBe(true);
  });

  it("rule 6: no filler touches a bridge on the wall row", () => {
    const bridges = wall.filter(({ p }) => p.overRangeMicrowaveBridge || /bridge/i.test(p.subCategory ?? ""));
    for (const { p: f, start, end } of wall.filter(({ p }) => isFillerItem(p))) {
      for (const b of bridges) expect(Math.abs(b.end - start) < 0.05 || Math.abs(b.start - end) < 0.05, `${f.masterCode} beside ${b.p.masterCode}`).toBe(false);
    }
  });

  it("rule 5 / standing: no filler between two plain run cabinets, none outside a panel, real SKUs only", () => {
    for (const layer of [base, wall]) {
      layer.forEach(({ p }, i) => {
        if (!isFillerItem(p)) return;
        const prev = layer[i - 1]?.p;
        const next = layer[i + 1]?.p;
        // The W1230 flank beside the diagonal corner upper is a fixed corner piece (Nov 18 rule), so a
        // last-resort strip against it counts as "beside a fixed piece", like a strip against ERB36.
        const plain = (q?: PlacedCabinet) => q && /^(B|W|3DB)\d/.test(q.masterCode) && !/bridge/i.test(q.subCategory ?? "")
          && !/^Corner rule: .*beside the diagonal/.test(String(q.autoPlacedReason ?? ""));
        expect(Boolean(plain(prev) && plain(next)), `${p.masterCode} between ${prev?.masterCode} and ${next?.masterCode}`).toBe(false);
      });
    }
    const all = [...pack.base, ...pack.wall, ...pack.accessory, ...(pack.surround?.endPanels ?? []), ...(pack.surround?.deepAbove ?? [])].map((r) => r.masterCode);
    for (const p of result.placed.filter((q) => q.placement === "base" || q.placement === "wall")) expect(all, p.masterCode).toContain(p.masterCode);
  });
});

describe("144 x 120 L, budget mode", () => {
  const result = build(true);
  it("rule 7: the 10 ft wall row upgrades W1230 -> W1830 instead of a 6 in wall filler", () => {
    const wall = row(result.placed, "right", true);
    expect(codes(wall).slice(-2)).toEqual(["W1230", "W1830"]);
    expect(fillerInches(wall)).toBe(0);
  });
  it("rule 5: the 6 in leftover is one F642 strip against the wall end, and the note says so (no 'stays open' contradiction)", () => {
    const base = row(result.placed, "right", false);
    const last = base[base.length - 1]!;
    expect(last.p.masterCode).toBe("F642");
    expect(last.end).toBeCloseTo(120, 2);
    expect(result.notes.some((note) => /stays open as a gap/.test(note))).toBe(false);
    expect(result.notes.some((note) => /one thin strip against the wall or the refrigerator/.test(note))).toBe(true);
  });
  it("budget rules hold: no fridge panels, no WSV skins, 12 in cap, the 12 ft wall closes exactly", () => {
    expect(result.placed.some((p) => /^(REPV|WSV)/.test(p.masterCode))).toBe(false);
    expect(result.placed.find((p) => p.refrigeratorAssemblyRole === "bridge")!.depth).toBe(12);
    expect(fillerInches(row(result.placed, "top", false))).toBe(0);
    expect(fillerInches(row(result.placed, "top", true))).toBe(0);
  });
});

describe("applyMinimumFiller unit rules", () => {
  const base24 = pack.base.find((r) => r.masterCode === "B24")!;
  const filler = pack.accessory.find((r) => /^F3/.test(r.masterCode))!;
  const room = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
  const mk = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], x: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
    uid, cabinetId: 1, masterCode, description: masterCode, placement, x, y: 0, width, depth: 24, height: 34.5, rotation: 0, mountBottom: 0, ...extra,
  });
  it("rule 3: a 2¼ in filler (plus ¾ open) between a sink base and a B21 becomes a B24", () => {
    expect(base24).toBeTruthy();
    const placed = [
      mk("sb", "SB36", "base", 0, 36, { subCategory: "Sink Base", description: "Sink Base" }),
      mk("b21", "B21", "base", 36, 21, { subCategory: "Standard Base" }),
      mk("f", filler.masterCode, "base", 57, 2.25, { category: "Filler", subCategory: "Filler" }),
      mk("dw", "DW-24", "appliance", 60, 24),
    ];
    const out = applyMinimumFiller({
      placed, room, openings: [], wallIds: ["top"], baseCatalog: pack.base, wallCatalog: pack.wall, fillerCatalog: pack.accessory as never,
      styleId: 390019, makeUid: () => "u", rangeWiggleIn: () => 0,
    });
    expect(out.placed.find((p) => p.uid === "b21")!.masterCode).toBe("B24");
    expect(out.placed.some((p) => isFillerItem(p))).toBe(false);
  });
});
