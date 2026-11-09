/**
 * HARD RULE (owner, Nov 5 2026): auto-design ALWAYS places a bridge wall cabinet
 * above the range.
 *
 * Not optional. Not skippable by the pop-up answer. Not skippable by the fallback
 * chain. It is placed FIRST — before any microwave or hood — on every build
 * (`runAutoDesignLayout` and the DesignTool build path) and on every layout load.
 * Ordinary wall runs never tile over the range, so the bridge always has its span.
 * An existing bridge or microwave is never deleted. A bridge that genuinely cannot
 * fit is reported with a clear blocking reason.
 *
 * This file is the matrix: range widths, with and without a microwave, and saved
 * layouts. Every case asserts a bridge is present over the range.
 */
import { describe, expect, it } from "vitest";
import matrixCatalog from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { wallLabelToEngineWallId, type AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  cabinetPlacementCollisionDetail,
  cabinetWall,
  elevationBox,
  wallCeilingMin,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  existingOverRangeBridge,
  fillOverRangeAnswer,
  overRangeHasBridge,
  placeMandatoryOverRangeBridges,
  rangesInPlan,
} from "./overRangeFill";

type StylePack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const catalog = matrixCatalog as unknown as Record<string, StylePack>;

const palette = [
  { id: 0, masterCode: "RANGE-30", description: "RANGE-30", category: "Appliance", subCategory: "Appliance", width: "30", depth: "25", height: "36", placement: "appliance" },
  { id: 1, masterCode: "RANGE-42", description: "RANGE-42", category: "Appliance", subCategory: "Appliance", width: "42", depth: "25", height: "36", placement: "appliance" },
  { id: 2, masterCode: "DW-24", description: "DW-24", category: "Appliance", subCategory: "Appliance", width: "24", depth: "24", height: "34.5", placement: "appliance" },
  { id: 3, masterCode: "FRIDGE-36", description: "FRIDGE-36", category: "Appliance", subCategory: "Appliance", width: "36", depth: "30", height: "70", placement: "appliance" },
  { id: 4, masterCode: "HOOD-30", description: "HOOD-30", category: "Appliance", subCategory: "Appliance", width: "30", depth: "18", height: "18", placement: "appliance" },
  { id: 5, masterCode: "MW-30", description: 'Over-Range Microwave 30"', category: "Appliance", subCategory: "Appliance", width: "30", depth: "15", height: "16", placement: "appliance" },
] as DesignCabinet[];

// 23 is the frameless 22-5/8" box, the height whose top reaches the 94-1/4" line.
const BRIDGE_CODE = /^W(\d{2})(12|15|18|21|23|24)$/;

function bridgesOver(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((item) => item.placement === "wall" && item.overRangeMicrowaveBridge === true);
}

/** One room shape per case, all standard so a bridge can seat at the 72" datum. */
function roomOf(width = 144, depth = 120, ceilingHeight = 96): RoomData {
  return { width, depth, ceilingHeight };
}

function inputsFor(width: string, overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "single-wall",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 24 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 100 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: null,
    ...overrides,
  } as AutoDesignInputs;
}

function build(input: AutoDesignInputs, room: RoomData, styleId: string, extraWall: DesignCabinet[] = []) {
  const pack = catalog[styleId]!;
  let uid = 0;
  return runAutoDesignLayout({
    input,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: [...pack.wall, ...extraWall],
    fillers: pack.accessory,
    appliancePalette: palette,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, []),
    refrigeratorEndPanels: [],
    styleId: Number(styleId),
    makeUid: () => `b-${++uid}`,
  } as never);
}

/** Assert the bridge geometry the hard rule requires. */
function expectBridgeOverLayout(result: AutoDesignLayoutSuccess, room: RoomData, label: string) {
  const ranges = rangesInPlan(result.placed);
  expect(ranges.length, `${label}: the fixture must have a range`).toBeGreaterThan(0);
  for (const range of ranges) {
    const bridge = existingOverRangeBridge(result.placed, range, room);
    expect(bridge, `${label}: no bridge above ${range.masterCode}`).not.toBeNull();
    const wall = cabinetWall(bridge!, room);
    // Centered on the range.
    const rangeCenter = wallRunOffset(range, wall, room) + wallRunSpan(range, wall, room) / 2;
    const bridgeCenter = wallRunOffset(bridge!, wall, room) + wallRunSpan(bridge!, wall, room) / 2;
    expect(Math.abs(rangeCenter - bridgeCenter), `${label}: bridge off-center`).toBeLessThanOrEqual(0.75);
    // On the 72" datum, and clear of the wall's ceiling.
    expect(Number(bridge!.mountBottom), `${label}: bridge datum`).toBe(72);
    const box = elevationBox(bridge!, room);
    expect(box.bottom + box.height, `${label}: bridge above the ceiling`).toBeLessThanOrEqual(wallCeilingMin(room, wall) + 0.5);
    // A real bridge-family box, no wider than the range.
    const normalized = (bridge!.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    expect(BRIDGE_CODE.test(normalized), `${label}: ${bridge!.masterCode} is not a bridge SKU`).toBe(true);
    expect(Number(bridge!.width), `${label}: bridge wider than the range`).toBeLessThanOrEqual(Number(range.width) + 0.05);
    // Collision-free against everything else.
    const peers = result.placed.filter((item) => item.uid !== bridge!.uid);
    expect(cabinetPlacementCollisionDetail(bridge!, peers, room), `${label}: bridge collides`).toBeNull();
  }
}

describe("a bridge is always placed above the range", () => {
  for (const styleId of ["540005", "540007", "330014", "330020", "330002", "510004"]) {
    it(`places one on a single-wall build (${styleId})`, () => {
      const room = roomOf();
      const result = build(inputsFor(styleId), room, styleId);
      expect(result.ok, result.ok ? "" : result.message).toBe(true);
      if (!result.ok) return;
      expectBridgeOverLayout(result, room, styleId);
      expect(result.notes.some((note) => /bridge was placed above/i.test(note))).toBe(true);
    });
  }

  it("places one on every layout shape", () => {
    const cases: Array<{ layout: AutoDesignInputs["layoutType"]; room: RoomData; rangeWall: AutoDesignInputs["stove"] }> = [
      { layout: "single-wall", room: roomOf(), rangeWall: { wallLabel: "Wall 1", centerOffsetIn: 100 } },
      { layout: "l-shape", room: roomOf(), rangeWall: { wallLabel: "Wall 2", centerOffsetIn: 60 } },
      { layout: "galley", room: roomOf(168, 132), rangeWall: { wallLabel: "Wall 1", centerOffsetIn: 100 } },
    ];
    for (const entry of cases) {
      const result = build(inputsFor("540005", { layoutType: entry.layout, stove: entry.rangeWall }), entry.room, "540005");
      expect(result.ok, `${entry.layout}: ${result.ok ? "" : result.message}`).toBe(true);
      if (!result.ok) continue;
      expectBridgeOverLayout(result, entry.room, entry.layout);
    }
  });
});

describe("the bridge is matched to the range width", () => {
  it("takes the 30 inch bridge for a 30 inch range", () => {
    const room = roomOf();
    const result = build(inputsFor("330011" in catalog ? "330011" : "330014"), room, "330014");
    if (!result.ok) return;
    const bridge = bridgesOver(result.placed)[0]!;
    expect(Number(bridge.width)).toBeCloseTo(30, 3);
  });

  it("takes the 36 inch bridge for a 36 inch range when the line sells one", () => {
    const room = roomOf();
    // Insert a 36" range into the palette for this case.
    const widePalette = [
      ...palette,
      { id: 9, masterCode: "RANGE-36", description: "RANGE-36", category: "Appliance", subCategory: "Appliance", width: "36", depth: "25", height: "36", placement: "appliance" } as DesignCabinet,
    ];
    const pack = catalog["330014"]!;
    let uid = 0;
    const result = runAutoDesignLayout({
      input: inputsFor("330014", { stove: { wallLabel: "Wall 1", centerOffsetIn: 100 } }),
      room,
      openings: [],
      baseCatalog: pack.base,
      wallCatalog: pack.wall,
      fillers: pack.accessory,
      appliancePalette: widePalette,
      refrigeratorCaps: [],
      refrigeratorEndPanels: [],
      stoveMasterCode: "RANGE-36",
      styleId: 330014,
      makeUid: () => `c-${++uid}`,
    } as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const range = rangesInPlan(result.placed)[0]!;
    expect(Number(range.width)).toBeCloseTo(36, 3);
    const bridge = existingOverRangeBridge(result.placed, range, room)!;
    expect(Number(bridge.width)).toBeCloseTo(36, 3);
    expect(Number(bridge.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(1, 3))).toBe(36);
  });

  it("reports the width it had to settle for when the line sells no bridge that wide", () => {
    // 330002 sells 30/33/36 bridges only, so a 42" range gets a 36" bridge. The
    // note names the box, and the bridge is still present (the rule is the bridge,
    // not a wider SKU the line does not sell).
    const room = roomOf(180, 132);
    const result = build(inputsFor("330002", { stove: { wallLabel: "Wall 3", centerOffsetIn: 60 } }), room, "330002");
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const ranges = rangesInPlan(result.placed);
    if (ranges.some((range) => Number(range.width) > 36.05)) {
      const bridge = bridgesOver(result.placed)[0]!;
      expect(Number(bridge.width)).toBeLessThanOrEqual(36.05);
      expect(bridge).toBeDefined();
    }
    expectBridgeOverLayout(result, room, "330002");
  });
});

describe("the bridge is placed whatever the answer is", () => {
  for (const answer of ["hood", "open", "microwave-bridge", null] as const) {
    it(`places the bridge with the answer ${answer ?? "unset"}`, () => {
      const room = roomOf();
      const result = build(inputsFor("540005", { overRangeAnswer: answer }), room, "540005");
      expect(result.ok, result.ok ? "" : result.message).toBe(true);
      if (!result.ok) return;
      expect(bridgesOver(result.placed)).toHaveLength(1);
      expectBridgeOverLayout(result, room, `answer ${answer ?? "unset"}`);
    });
  }

  it("still adds the microwave for the microwave-bridge answer, on top of the bridge", () => {
    const room = roomOf();
    const result = build(inputsFor("540005", { overRangeAnswer: "microwave-bridge" }), room, "540005");
    if (!result.ok) return;
    expect(bridgesOver(result.placed)).toHaveLength(1);
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(true);
  });

  it("adds the hood for the hood answer and keeps the bridge", () => {
    const room = roomOf();
    const result = build(inputsFor("540005", { overRangeAnswer: "hood" }), room, "540005");
    if (!result.ok) return;
    expect(bridgesOver(result.placed)).toHaveLength(1);
    expect(result.placed.some((item) => /^HOOD-/.test(item.masterCode))).toBe(true);
  });

  it("adds neither microwave nor hood for the open answer, and still places the bridge", () => {
    const room = roomOf();
    const result = build(inputsFor("540005", { overRangeAnswer: "open" }), room, "540005");
    if (!result.ok) return;
    expect(bridgesOver(result.placed)).toHaveLength(1);
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(false);
    expect(result.placed.some((item) => /^HOOD-/.test(item.masterCode))).toBe(false);
  });
});

describe("saved layouts get a bridge on load", () => {
  it("adds the bridge to a saved plan that has a bare range", () => {
    const room = roomOf();
    const result = build(inputsFor("540005"), room, "540005");
    if (!result.ok) return;
    // Simulate an older saved design: the range with nothing above it.
    const saved = result.placed.filter((item) => item.overRangeMicrowaveBridge !== true && !/^MW-/.test(item.masterCode) && !/^HOOD-/.test(item.masterCode));
    const range = rangesInPlan(saved)[0]!;
    expect(overRangeHasBridge(saved, range, room)).toBe(false);
    let uid = 0;
    const loaded = fillOverRangeAnswer({
      placed: saved,
      room,
      appliancePalette: palette,
      wallCatalog: catalog["540005"]!.wall,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `l-${++uid}`,
    });
    expect(loaded.everyRangeBridged).toBe(true);
    const rangeAfter = loaded.placed.find((item) => item.uid === range.uid)!;
    expect(existingOverRangeBridge(loaded.placed, rangeAfter, room)).not.toBeNull();
  });

  it("keeps a saved plan's existing bridge exactly as it is", () => {
    const room = roomOf();
    const result = build(inputsFor("540005"), room, "540005");
    if (!result.ok) return;
    const before = result.placed.find((item) => item.overRangeMicrowaveBridge === true)!;
    let uid = 0;
    const loaded = fillOverRangeAnswer({
      placed: result.placed,
      room,
      appliancePalette: palette,
      wallCatalog: catalog["540005"]!.wall,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `k-${++uid}`,
    });
    const after = loaded.placed.find((item) => item.uid === before.uid)!;
    expect(after).toEqual(before);
    expect(loaded.added).toBe(false);
  });

  it("is idempotent across repeated loads", () => {
    const room = roomOf();
    let uid = 0;
    const once = fillOverRangeAnswer({
      placed: [{
        uid: "range-only", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", placement: "appliance",
        x: 85, y: 0, width: 30, depth: 26, height: 36, rotation: 0, wallId: "top", wallOffset: 85,
      } as PlacedCabinet],
      room,
      appliancePalette: palette,
      wallCatalog: catalog["540005"]!.wall,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `i-${++uid}`,
    });
    const twice = fillOverRangeAnswer({
      placed: once.placed,
      room,
      appliancePalette: palette,
      wallCatalog: catalog["540005"]!.wall,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `i-${++uid}`,
    });
    expect(twice.placed).toEqual(once.placed);
    expect(twice.added).toBe(false);
  });
});

describe("ordinary wall runs never tile over the range", () => {
  it("never puts an ordinary upper across the range span", () => {
    const room = roomOf();
    const result = build(inputsFor("540005"), room, "540005");
    if (!result.ok) return;
    for (const range of rangesInPlan(result.placed)) {
      const wall = cabinetWall(range, room);
      const start = wallRunOffset(range, wall, room);
      const end = start + wallRunSpan(range, wall, room);
      for (const item of result.placed) {
        if (item.placement !== "wall" || cabinetWall(item, room) !== wall) continue;
        if (item.overRangeMicrowaveBridge === true) continue;
        const itemStart = wallRunOffset(item, wall, room);
        const itemEnd = itemStart + wallRunSpan(item, wall, room);
        const overlap = Math.min(itemEnd, end) - Math.max(itemStart, start);
        expect(overlap, `${item.masterCode} tiles over ${range.masterCode}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("leaves no sliver beside the bridge in the upper run", () => {
    const room = roomOf();
    const result = build(inputsFor("540005"), room, "540005");
    if (!result.ok) return;
    const bridge = bridgesOver(result.placed)[0]!;
    const wall = cabinetWall(bridge, room);
    const bridgeStart = wallRunOffset(bridge, wall, room);
    const bridgeEnd = bridgeStart + wallRunSpan(bridge, wall, room);
    // No other upper may start or end within a filler-width of the bridge's edges.
    for (const item of result.placed) {
      if (item.placement !== "wall" || cabinetWall(item, room) !== wall) continue;
      if (item.overRangeMicrowaveBridge === true) continue;
      const itemStart = wallRunOffset(item, wall, room);
      const itemEnd = itemStart + wallRunSpan(item, wall, room);
      const gap = Math.max(0, Math.max(bridgeStart - itemEnd, itemStart - bridgeEnd));
      if (gap > 0 && gap < 3.05) {
        // A sub-filler sliver is only allowed as a real catalog filler.
        expect(/filler|scribe|^OF\d/i.test(`${item.masterCode} ${item.description ?? ""}`), `${item.masterCode} leaves a ${gap}″ sliver`).toBe(true);
      }
    }
  });
});

describe("a bridge that cannot seat is reported, never silently dropped", () => {
  it("reports a blocking finding when the line sells no bridge", () => {
    let uid = 0;
    const noBridge = catalog["540005"]!.wall.filter((row) => !BRIDGE_CODE.test((row.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")));
    const result = placeMandatoryOverRangeBridges({
      placed: [{
        uid: "range-only", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", placement: "appliance",
        x: 85, y: 0, width: 30, depth: 26, height: 36, rotation: 0, wallId: "top", wallOffset: 85,
      } as PlacedCabinet],
      room: roomOf(),
      wallCatalog: noBridge,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `n-${++uid}`,
    });
    expect(result.everyRangeBridged).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.code).toBe("range-bridge-blocked");
    expect(result.findings[0]!.severity).toBe("warning");
    expect(result.findings[0]!.detail.length).toBeGreaterThan(20);
  });

  it("reports the occupied span and moves nothing", () => {
    let uid = 0;
    const occupant: PlacedCabinet = {
      uid: "occupant", cabinetId: 1, masterCode: "W3042", description: '30" x 42" Wall Cabinet', placement: "wall",
      x: 85, y: 0, width: 30, depth: 13.5, height: 42, rotation: 0, wallId: "top", wallOffset: 85, mountBottom: 72,
    } as PlacedCabinet;
    const range: PlacedCabinet = {
      uid: "range-only", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", placement: "appliance",
      x: 85, y: 0, width: 30, depth: 26, height: 36, rotation: 0, wallId: "top", wallOffset: 85,
    } as PlacedCabinet;
    const result = placeMandatoryOverRangeBridges({
      placed: [range, occupant],
      room: roomOf(),
      wallCatalog: catalog["540005"]!.wall,
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => `o-${++uid}`,
    });
    expect(result.everyRangeBridged).toBe(false);
    expect(result.findings[0]!.detail).toMatch(/occupied|clear upper wall/i);
    // Nothing was deleted or moved.
    expect(result.placed.find((item) => item.uid === "occupant")).toEqual(occupant);
    expect(result.placed.find((item) => item.uid === "range-only")).toEqual(range);
  });
});
