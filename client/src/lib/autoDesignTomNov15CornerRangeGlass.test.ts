import { describe, expect, it, vi } from "vitest";
import live from "@/lib/__fixtures__/sereneHarbor510004Live.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { placeCornerLegFillers, isCornerLegFillerGroupId } from "./autoDesignCornerLegFillers";
import { applyGlassUpperPreference } from "./autoDesignFormOptions";
import {
  appliancesForRoom,
  applianceAsDesignCabinet,
  cabinetWall,
  isFillerItem,
  isGlassDoorCabinet,
  isOverRangeMicrowave,
  isPanelItem,
  isStacker,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

// Tom, Nov 15 2026 (Serene Harbor, L-shape): "It failed to put the filler in
// between the corner cabinet and the base cabinet on the bottom. And then on
// the side ... it failed to put a cabinet above the range. And ... glass
// cabinets in the wizard. Understanding as a stacker."
// Catalog: the live Serene Harbor (style 510004) pools from the public
// design.placeableCabinets / design.surroundForFridge queries, Nov 15 2026.

const repackSpy = vi.hoisted(() => ({ dropBridge: false }));
vi.mock("./autoDesignFifteenRepack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./autoDesignFifteenRepack")>();
  return {
    ...actual,
    repackFifteenRuleLayout: (...args: Parameters<typeof actual.repackFifteenRuleLayout>) => {
      const result = actual.repackFifteenRuleLayout(...args);
      if (!repackSpy.dropBridge) return result;
      // Simulate a wall re-plan that loses the bridge above the range.
      return { ...result, placed: result.placed.filter((item) => !(item.placement === "wall" && /^W30(12|15|18|24)$/.test(item.masterCode) && Math.abs((item.mountBottom ?? 0) - 72) <= 0.6)) };
    },
  };
});

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[]; surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] } };
const PACK = live as unknown as Pack;
const PALETTE = appliancesForRoom("kitchen").map(applianceAsDesignCabinet);
const ROOM = { width: 156, depth: 156, ceilingHeight: 96 } as RoomData;
const SKUS = new Set([...PACK.base, ...PACK.wall, ...PACK.accessory, ...PACK.tall].map((row) => row.masterCode));

function build(preferences: PreferenceId[] = []) {
  let uid = 0;
  const input = {
    layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 80 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 87 }, dishwasher: null, dishwasherSide: "right", skipDishwasher: false,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: 80 }, overRangeAnswer: "microwave-bridge",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    intake: { ...emptyAutoDesignIntake(), construction: "new", preferences },
  } as unknown as AutoDesignInputs;
  const run = runAutoDesignLayout({
    input, room: ROOM, openings: [], baseCatalog: PACK.base, wallCatalog: PACK.wall, fillers: PACK.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(PACK.wall, PACK.surround.deepAbove),
    refrigeratorEndPanels: PACK.surround.endPanels, panelCatalog: [...PACK.accessory, ...PACK.surround.endPanels],
    tallCatalog: PACK.tall, styleId: 510004, makeUid: () => `n15-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}

const span = (item: PlacedCabinet, wallId: string) => {
  const start = wallRunOffset(item, wallId, ROOM);
  return { start, end: start + wallRunSpan(item, wallId, ROOM) };
};

describe("Tom Nov 15: filler between the corner cabinet and the base beside it, on both legs", () => {
  it("the lazy Susan gets the line's 3 in filler on each leg, and a real base closes the leg right after it", () => {
    const run = build();
    const corner = run.placed.find((item) => item.placement === "base" && /^(ERB|LSB)/.test(item.masterCode))!;
    expect(corner, "lazy Susan seated").toBeTruthy();
    for (const wallId of ["top", "right"]) {
      const box = span(corner, wallId);
      const filler = run.placed.find((item) => isCornerLegFillerGroupId(item.fillerPieceGroupId) && cabinetWall(item, ROOM) === wallId);
      expect(filler, `${wallId} leg filler`).toBeTruthy();
      expect(SKUS.has(filler!.masterCode)).toBe(true);
      expect(filler!.fillerForCabinetUid).toBe(corner.uid);
      expect(Number(filler!.width)).toBe(3);
      const board = span(filler!, wallId);
      // The board touches the open edge of the corner box (top leg: the corner is at the far end).
      const openEdge = wallId === "top" ? box.start : box.end;
      expect(Math.min(Math.abs(board.end - openEdge), Math.abs(board.start - openEdge))).toBeLessThan(0.05);
      // And a real base cabinet butts the other side of the board: no hole beside the corner.
      const farEdge = wallId === "top" ? board.start : board.end;
      const neighbor = run.placed.find((item) => item.placement === "base" && !isFillerItem(item) && item.uid !== corner.uid
        && cabinetWall(item, ROOM) === wallId
        && Math.abs((wallId === "top" ? span(item, wallId).end : span(item, wallId).start) - farEdge) < 0.05);
      expect(neighbor, `${wallId} base beside the leg filler`).toBeTruthy();
    }
  });

  it("a line with no 3 in filler stock gets a visible finding and nothing invented", () => {
    const corner = { uid: "c1", cabinetId: 1, masterCode: "LSB36", description: "Lazy Susan", cornerType: "lazy-susan", placement: "base", x: 120, y: 0, width: 36, depth: 36, height: 34.5, rotation: 90, wallId: "right" } as unknown as PlacedCabinet;
    const result = placeCornerLegFillers({
      corner, cornerPoint: { x: 156, y: 0 }, wallIds: ["top", "right"], room: ROOM, placed: [corner],
      catalogFillers: PACK.accessory.filter((row) => !/^F3/.test(row.masterCode)) as never, makeUid: () => "f", styleId: null,
    });
    expect(result.fillers).toHaveLength(0);
    expect(result.placed).toHaveLength(1);
    expect(result.findings[0]?.code).toBe("corner-leg-filler-missing");
  });

  it("a leg whose space fits a real base only without the filler keeps the real base (the 9 in flank rule)", () => {
    const corner = { uid: "c2", cabinetId: 1, masterCode: "LSB36", description: "Lazy Susan", cornerType: "lazy-susan", placement: "base", x: 120, y: 0, width: 36, depth: 36, height: 34.5, rotation: 90, wallId: "right" } as unknown as PlacedCabinet;
    // A range 9 in from the corner on the top leg: 81..111, corner box from 120.
    const range = { uid: "r", cabinetId: 0, masterCode: "RANGE-30", description: "Range", placement: "appliance", x: 81, y: 0, width: 30, depth: 25, height: 36, rotation: 0, wallId: "top" } as unknown as PlacedCabinet;
    const result = placeCornerLegFillers({
      corner, cornerPoint: { x: 156, y: 0 }, wallIds: ["top"], room: ROOM, placed: [corner, range],
      catalogFillers: PACK.accessory as never, makeUid: () => "f", styleId: null, minBaseWidthIn: 9,
    });
    expect(result.fillers).toHaveLength(0);
    expect(result.notes[0]).toMatch(/takes a real 9″ cabinet only without a 3″ filler/);
  });
});

describe("Tom Nov 15: a cabinet above the range, over the microwave", () => {
  it("the range gets a bridge as wide as the range, 12 in tall next to 30 in uppers, right above the MW-30", () => {
    const run = build();
    const range = run.placed.find((item) => item.placement === "appliance" && /^RANGE-/.test(item.masterCode))!;
    const wallId = cabinetWall(range, ROOM);
    const r = span(range, wallId);
    const microwave = run.placed.find((item) => isOverRangeMicrowave(item))!;
    expect(microwave).toBeTruthy();
    const bridge = run.placed.find((item) => item.placement === "wall" && cabinetWall(item, ROOM) === wallId
      && Math.abs(span(item, wallId).start - r.start) < 0.5 && Math.abs(span(item, wallId).end - r.end) < 0.5
      && (item.mountBottom ?? 0) >= (microwave.mountBottom ?? 0) + Number(microwave.height) - 0.05)!;
    expect(bridge, "bridge over the range").toBeTruthy();
    expect(SKUS.has(bridge.masterCode)).toBe(true);
    expect(Number(bridge.width)).toBe(Number(range.width));
    expect(Number(bridge.height)).toBe(12);
  });

  it("a later wall re-plan that loses the bridge cannot ship a bare microwave: the build re-seats it", () => {
    repackSpy.dropBridge = true;
    try {
      const run = build();
      const range = run.placed.find((item) => item.placement === "appliance" && /^RANGE-/.test(item.masterCode))!;
      const wallId = cabinetWall(range, ROOM);
      const r = span(range, wallId);
      const bridge = run.placed.find((item) => item.placement === "wall" && /^W30(12|15|18|24)$/.test(item.masterCode)
        && cabinetWall(item, ROOM) === wallId && Math.abs(span(item, wallId).start - r.start) < 0.5);
      expect(bridge, "re-seated bridge").toBeTruthy();
      expect(run.notes.some((note) => /re-seated after the wall run was re-planned/.test(note))).toBe(true);
    } finally {
      repackSpy.dropBridge = false;
    }
  });
});

describe("Tom Nov 15: glass cabinets picked in the wizard are glass stackers", () => {
  it("every 30 in upper gets the line's own glass stacker of the same width on top; the upper keeps its solid door", () => {
    const run = build(["glass-uppers"]);
    const uppers = run.placed.filter((item) => item.placement === "wall" && !isFillerItem(item) && !isPanelItem(item) && Math.abs(Number(item.height) - 30) <= 0.5);
    expect(uppers.length).toBeGreaterThan(3);
    const stackers = run.placed.filter((item) => item.placement === "wall" && isStacker(item) && isGlassDoorCabinet(item));
    for (const upper of uppers) {
      expect(upper.glassDoor === true, upper.masterCode).toBe(false);
      const stacker = stackers.find((item) => item.stackedOnCabinetUid === upper.uid);
      expect(stacker, `stacker on ${upper.masterCode}`).toBeTruthy();
      expect(SKUS.has(stacker!.masterCode), stacker!.masterCode).toBe(true);
      expect(Number(stacker!.width)).toBe(Number(upper.width));
      expect(stacker!.mountBottom).toBeCloseTo((upper.mountBottom ?? 0) + Number(upper.height), 2);
      expect((stacker!.mountBottom ?? 0) + Number(stacker!.height)).toBeLessThanOrEqual(96.05);
    }
    // Short bridges (over the range and refrigerator) carry no stacker.
    const shortUids = new Set(run.placed.filter((item) => item.placement === "wall" && Number(item.height) < 20 && !isStacker(item)).map((item) => item.uid));
    expect(stackers.some((item) => item.stackedOnCabinetUid && shortUids.has(item.stackedOnCabinetUid))).toBe(false);
    expect(run.reviewFindings.some((finding) => /^preference-glass/.test(finding.code ?? ""))).toBe(false);
  });

  it("an upper the line sells no stacker for is named in one visible warning, nothing invented", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
    const upper = (uid: string, code: string, x: number, width: number) => ({ uid, cabinetId: 1, masterCode: code, description: code, placement: "wall", x, y: 0, width, depth: 12, height: 30, mountBottom: 54, rotation: 0, wallId: "top" }) as unknown as PlacedCabinet;
    const placed = [upper("a", "W1830", 0, 18), upper("b", "W2730", 18, 27)];
    let n = 0;
    const result = applyGlassUpperPreference({
      placed, wallCatalog: PACK.wall.filter((row) => row.masterCode !== "W2712GD"), intake: { ...emptyAutoDesignIntake(), preferences: ["glass-uppers"] },
      wallHeightIn: 30, room, makeUid: () => `s-${++n}`,
    });
    expect(result.stacked).toBe(1);
    expect(result.placed.find((item) => item.stackedOnCabinetUid === "a")?.masterCode).toBe("W1812GD");
    expect(result.placed.some((item) => item.stackedOnCabinetUid === "b")).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.code).toBe("preference-glass-stacker-unavailable");
    expect(result.findings[0]!.detail).toMatch(/W2730/);
  });
});
