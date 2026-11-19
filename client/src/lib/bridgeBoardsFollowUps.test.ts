import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetFrontIn, cabinetWall, commitConfiguredRefrigeratorCandidate, isFillerItem, isRefrigerator, isStacker,
  wallPlacementAt, wallRunOffset, wallRunSpan, type PlacedCabinet, type RoomData,
} from "./design";
import {
  bridgeBoardEnvelope, buildBridgeHalfInchFillers, glassCabinetsAboveBridge, isBridgeHalfInchFiller, measureBridgeBoardFlush, normalizeBridgeBoards,
  seatRequiredBridgeFillers,
} from "./bridgeHalfInchFillers";
import { normalizeRefrigeratorBridgeDepth } from "./refrigeratorBridgeDepth";

/**
 * Follow-ups to the merged 1/2 in bridge board rule (PR 464), Tom, voice, Nov 19 2026, 2:23-2:26 PM ET:
 * (1) the refrigerator group (bridge, panels, both boards) drags and nudges as one unit, the boards stay on the bridge;
 * (2) a glass cabinet above the bridge makes each board one taller board that flanks it too;
 * (3) the boards are flush with the refrigerator panel: no gap, no overlap, front faces aligned, 37 in for a 36 in bridge.
 */
const room = { width: 168, depth: 120, ceilingHeight: 96 } as RoomData;
const pack = (matrix as any)["330014"];
const sinkRows = (pelicanRows as any[]).filter((row) => row.subCategory === "Sinks").map((row) => ({ id: Number(row.id), pelicanCode: row.pelicanCode, name: row.name, category: row.category, subCategory: "Sinks" })) as never[];

function build(budget: boolean, fridgeC = 60) {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: fridgeC }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 120 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "left", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
    room, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], sinkCatalog: sinkRows, faucetCatalog: [], styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
  if (!result.ok) throw new Error(JSON.stringify(result).slice(0, 400));
  return result.placed as PlacedCabinet[];
}

const fridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => isRefrigerator(item))!;
const bridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
const along = (item: PlacedCabinet) => Math.round(wallRunOffset(item, "top", room) * 1000) / 1000;
const end = (item: PlacedCabinet) => Math.round((wallRunOffset(item, "top", room) + wallRunSpan(item, "top", room)) * 1000) / 1000;
/** Just the refrigerator group, standing alone on its wall so a drag has room (neighbors are tested separately). */
const groupOnly = (placed: PlacedCabinet[]) => {
  const fridge = fridgeOf(placed);
  return placed.filter((item) => item.uid === fridge.uid || item.refrigeratorAssemblyId === fridge.uid || item.fillerForCabinetUid === fridge.uid
    || item.fillerForCabinetUid === bridgeOf(placed).uid);
};
const boardsOf = (placed: PlacedCabinet[]) => placed.filter((item) => item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler");
/** What setPlaced does after every edit in the designer. */
const settle = (placed: PlacedCabinet[]) => normalizeBridgeBoards(normalizeRefrigeratorBridgeDepth(placed, room), room);
const drag = (placed: PlacedCabinet[], deltaIn: number) => {
  const fridge = fridgeOf(placed);
  const spot = wallPlacementAt(wallRunOffset(fridge, "top", room) + deltaIn, Number(fridge.width), Number(fridge.depth), "top", room);
  const next = commitConfiguredRefrigeratorCandidate(placed, fridge.uid, { ...fridge, ...spot } as PlacedCabinet, room);
  return next ? settle(next) : null;
};
const stackerFor = (placed: PlacedCabinet[], height = 12): PlacedCabinet => {
  const bridge = bridgeOf(placed);
  const row = pack.wall.find((entry: any) => entry.masterCode === `W3612GD`)!;
  const top = (Number(bridge.mountBottom) || 0) + Number(bridge.height);
  return {
    ...bridge, uid: "glass-above-bridge", cabinetId: row.id, masterCode: row.masterCode, description: row.description, height, nominalHeight: height, depth: 12, nominalDepth: 12,
    mountBottom: top, refrigeratorAssemblyId: null, refrigeratorAssemblyRole: null, stackedOnCabinetUid: bridge.uid, ...wallPlacementAt(along(bridge), 36, 12, "top", room),
  } as PlacedCabinet;
};

describe("3. boards flush with the refrigerator panel: no gap, no overlap, fronts aligned (Auto Design, standard)", () => {
  const placed = build(false);
  it("each board touches its panel's inner edge, the front faces line up, and the 36 in bridge keeps its 37 in opening", () => {
    const boards = boardsOf(placed);
    expect(boards.length).toBeGreaterThanOrEqual(1);
    const bridge = bridgeOf(placed);
    for (const finding of measureBridgeBoardFlush(placed, room)) {
      if (finding.panelGapIn == null) continue;
      expect(finding.panelGapIn).toBeCloseTo(0, 3);
      expect(finding.panelFrontStepIn).toBeCloseTo(0, 3);
    }
    for (const board of boards) {
      expect(board.fillerForCabinetUid).toBe(bridge.uid);
      expect(cabinetFrontIn(board, "top", room)).toBeCloseTo(cabinetFrontIn(bridge, "top", room), 3);
      expect(Number(board.depth)).toBeCloseTo(cabinetFrontIn(bridge, "top", room), 3);
    }
    const left = boards.find((item) => item.refrigeratorAssemblyRole === "bridge-left-filler");
    const right = boards.find((item) => item.refrigeratorAssemblyRole === "bridge-right-filler");
    expect(Number(bridge.width)).toBe(36);
    expect((right ? end(right) : end(bridge)) - (left ? along(left) : along(bridge))).toBeGreaterThanOrEqual(36.5 - 0.001);
  });
  it("the normalizer is idempotent: a plan that is already true is returned untouched", () => {
    expect(normalizeBridgeBoards(placed, room)).toBe(placed);
  });
  it("the board is as deep as the bridge face even when the bridge was pulled forward to the panel (a shallow bridge)", () => {
    const shallow = placed.map((item) => (item.refrigeratorAssemblyRole === "bridge-left-filler" ? { ...item, depth: 12, nominalDepth: 12, ...wallPlacementAt(along(item), 0.5, 12, "top", room) } as PlacedCabinet : item));
    const fixed = normalizeBridgeBoards(shallow, room);
    const board = boardsOf(fixed).find((item) => item.refrigeratorAssemblyRole === "bridge-left-filler");
    if (board) expect(cabinetFrontIn(board, "top", room)).toBeCloseTo(cabinetFrontIn(bridgeOf(fixed), "top", room), 3);
  });
});

describe("1. dragging the refrigerator group moves bridge, panels and both boards as one unit", () => {
  const group = groupOnly(build(false));
  const boards = boardsOf(group);
  const attributes = (list: PlacedCabinet[]) => list.map((item) => [item.uid, item.refrigeratorAssemblyRole ?? "", item.fillerForCabinetUid ?? "", item.masterCode].join("|")).sort();

  for (const delta of [10, -6, 0.125, -0.125, 25.5]) {
    it(`a ${delta} in move shifts every member by the same ${delta} in and keeps the boards on the bridge`, () => {
      const moved = drag(group, delta);
      expect(moved).not.toBeNull();
      for (const before of group) {
        const after = moved!.find((item) => item.uid === before.uid)!;
        expect(after, before.masterCode).toBeTruthy();
        expect(along(after) - along(before)).toBeCloseTo(delta, 3);
        expect(Number(after.width)).toBe(Number(before.width));
        expect(cabinetFrontIn(after, "top", room)).toBeCloseTo(cabinetFrontIn(before, "top", room), 3);
      }
      expect(attributes(moved!)).toEqual(attributes(group));
      const bridge = bridgeOf(moved!);
      for (const board of boardsOf(moved!)) {
        expect(board.fillerForCabinetUid).toBe(bridge.uid);
        expect(moved!.find((item) => item.uid === board.fillerForCabinetUid)?.refrigeratorAssemblyRole).toBe("bridge");
        expect(board.refrigeratorAssemblyRole === "bridge-left-filler" ? end(board) : along(board)).toBeCloseTo(board.refrigeratorAssemblyRole === "bridge-left-filler" ? along(bridge) : end(bridge), 3);
      }
      for (const finding of measureBridgeBoardFlush(moved!, room)) {
        if (finding.panelGapIn == null) continue;
        expect(finding.panelGapIn).toBeCloseTo(0, 3);
        expect(finding.panelFrontStepIn).toBeCloseTo(0, 3);
      }
      // The designer's own commit pass finds nothing left to fix.
      expect(normalizeBridgeBoards(moved!, room)).toBe(moved);
    });
  }

  it("3D arrow nudges (1/8 in at a time, then back) never separate a board from the bridge or the panel", () => {
    let current = group;
    for (let step = 0; step < 24; step += 1) current = drag(current, step < 12 ? 0.125 : -0.125)!;
    expect(current.map((item) => [item.uid, along(item)])).toEqual(group.map((item) => [item.uid, along(item)]));
    let forward = group;
    for (let step = 0; step < 16; step += 1) forward = drag(forward, 0.5)!;
    for (const board of boardsOf(forward)) expect(board.fillerForCabinetUid).toBe(bridgeOf(forward).uid);
    expect(along(bridgeOf(forward)) - along(bridgeOf(group))).toBeCloseTo(8, 3);
    for (const finding of measureBridgeBoardFlush(forward, room)) if (finding.panelGapIn != null) expect(finding.panelGapIn).toBeCloseTo(0, 3);
  });

  it("the refrigerator's own full-height 1/2 in board stays attached to the refrigerator and moves with it instead of being left behind", () => {
    const own = group.filter((item) => isFillerItem(item) && item.fillerForCabinetUid === fridgeOf(group).uid && item.fillerContinuousVertical === true);
    const moved = drag(group, 7)!;
    for (const board of own) {
      const after = moved.find((item) => item.uid === board.uid)!;
      expect(after.fillerForCabinetUid).toBe(fridgeOf(group).uid);
      expect(along(after) - along(board)).toBeCloseTo(7, 3);
    }
  });

  it("a move that would hit a neighbor is refused whole, so nothing is left half moved", () => {
    const crowded = build(false);
    const fridge = fridgeOf(crowded);
    const spot = wallPlacementAt(wallRunOffset(fridge, "top", room) + 60, Number(fridge.width), Number(fridge.depth), "top", room);
    expect(commitConfiguredRefrigeratorCandidate(crowded, fridge.uid, { ...fridge, ...spot } as PlacedCabinet, room)).toBeNull();
  });

  it("keeps the wider reveal boards of the refrigerator dialog (a bridge narrower than the opening) on the bridge edges", () => {
    const bridge = bridgeOf(group);
    const fridge = fridgeOf(group);
    const narrow = { ...bridge, width: 33, nominalWidth: 33, ...wallPlacementAt(along(fridge) + 1.5, 33, Number(bridge.depth), "top", room) } as PlacedCabinet;
    const reveal = (role: "bridge-left-filler" | "bridge-right-filler", start: number): PlacedCabinet => ({
      ...boards[0]!, uid: `reveal-${role}`, width: 2, nominalWidth: 3, refrigeratorAssemblyRole: role, fillerForCabinetUid: bridge.uid, ...wallPlacementAt(start, 2, Number(bridge.depth), "top", room),
    } as PlacedCabinet);
    const dialog = [...group.filter((item) => item.uid !== bridge.uid && !isBridgeHalfInchFiller(item) && item.refrigeratorAssemblyRole !== "bridge-left-filler" && item.refrigeratorAssemblyRole !== "bridge-right-filler"),
      narrow, reveal("bridge-left-filler", along(fridge) - 0.5), reveal("bridge-right-filler", along(fridge) + 34.5)];
    const moved = drag(dialog, 12)!;
    expect(moved).not.toBeNull();
    const b = bridgeOf(moved);
    const left = moved.find((item) => item.uid === "reveal-bridge-left-filler")!;
    const right = moved.find((item) => item.uid === "reveal-bridge-right-filler")!;
    expect(end(left)).toBeCloseTo(along(b), 3);
    expect(along(right)).toBeCloseTo(end(b), 3);
    expect(end(right) - along(left)).toBeCloseTo(37, 3);
  });
});

describe("2. a glass cabinet above the bridge: each board becomes one taller board that flanks it too", () => {
  const group = groupOnly(build(false));
  const stacker = stackerFor(group);
  const withGlass = [...group, stacker];

  it("sees the glass stacker as sitting on the bridge", () => {
    expect(isStacker(stacker)).toBe(true);
    expect(glassCabinetsAboveBridge(bridgeOf(withGlass), withGlass, room).map((item) => item.uid)).toEqual([stacker.uid]);
    expect(glassCabinetsAboveBridge(bridgeOf(group), group, room)).toEqual([]);
  });

  it("raises every board to the top of the glass cabinet: same bottom as the bridge, one board per side", () => {
    const out = normalizeBridgeBoards(withGlass, room);
    const bridge = bridgeOf(out);
    const envelope = bridgeBoardEnvelope(bridge, out, room);
    expect(envelope.glassAbove).toBe(true);
    expect(envelope.height).toBeCloseTo(Number(bridge.height) + 12, 3);
    const wallBoards = boardsOf(out);
    expect(wallBoards.length).toBeGreaterThanOrEqual(1);
    const sides = wallBoards.map((item) => item.refrigeratorAssemblyRole);
    expect(new Set(sides).size).toBe(sides.length);
    for (const board of wallBoards) {
      expect(Number(board.mountBottom)).toBeCloseTo(Number(bridge.mountBottom), 3);
      expect(Number(board.mountBottom) + Number(board.height)).toBeCloseTo(Number(stacker.mountBottom) + Number(stacker.height), 3);
      expect(board.fillerForCabinetUid).toBe(bridge.uid);
    }
    // Whichever side is the refrigerator's own full-height board, it reaches the glass top too and stays on the refrigerator.
    for (const board of out.filter((item) => isFillerItem(item) && item.fillerContinuousVertical === true && item.fillerForCabinetUid === fridgeOf(out).uid)) {
      expect(Number(board.mountBottom) + Number(board.height)).toBeGreaterThanOrEqual(Number(stacker.mountBottom) + Number(stacker.height) - 0.001);
    }
    expect(normalizeBridgeBoards(out, room)).toBe(out);
  });

  it("a taller glass cabinet makes taller boards, and removing the glass puts the wall boards back to the bridge height", () => {
    const tall = normalizeBridgeBoards([...group, stackerFor(group, 18)], room);
    for (const board of boardsOf(tall)) expect(Number(board.height)).toBeCloseTo(Number(bridgeOf(tall).height) + 18, 3);
    const removed = normalizeBridgeBoards(tall.filter((item) => item.uid !== "glass-above-bridge"), room);
    for (const board of boardsOf(removed)) expect(Number(board.height)).toBeCloseTo(Number(bridgeOf(removed).height), 3);
  });

  it("the glass cabinet and the taller boards drag with the group and stay flush", () => {
    const start = normalizeBridgeBoards(withGlass, room);
    const moved = drag(start, 9)!;
    expect(moved).not.toBeNull();
    const glass = moved.find((item) => item.uid === stacker.uid)!;
    expect(glass.stackedOnCabinetUid).toBe(bridgeOf(moved).uid);
    expect(along(glass) - along(start.find((item) => item.uid === stacker.uid)!)).toBeCloseTo(9, 3);
    expect(along(glass)).toBeCloseTo(along(bridgeOf(moved)), 3);
    expect(cabinetFrontIn(glass, "top", room)).toBeCloseTo(cabinetFrontIn(bridgeOf(moved), "top", room), 3);
    for (const board of boardsOf(moved)) expect(Number(board.mountBottom) + Number(board.height)).toBeCloseTo(Number(glass.mountBottom) + Number(glass.height), 3);
    for (const finding of measureBridgeBoardFlush(moved, room)) if (finding.panelGapIn != null) expect(finding.panelGapIn).toBeCloseTo(0, 3);
    expect(normalizeBridgeBoards(moved, room)).toBe(moved);
  });

  it("boards built when the glass is already above the bridge (manual designer) are born tall", () => {
    const stripped = withGlass.filter((item) => !isBridgeHalfInchFiller(item) && item.refrigeratorAssemblyRole !== "bridge-left-filler" && item.refrigeratorAssemblyRole !== "bridge-right-filler" && !(isFillerItem(item) && item.fillerContinuousVertical));
    const built = buildBridgeHalfInchFillers(bridgeOf(stripped), stripped, room, pack.accessory, (() => { let n = 0; return () => `b-${++n}`; })(), 330014);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const board of built.fillers) expect(Number(board.height)).toBeCloseTo(Number(built.bridge.height) + 12, 3);
    const seated = seatRequiredBridgeFillers(stripped, bridgeOf(stripped).uid, room, pack.accessory, (() => { let n = 100; return () => `m-${++n}`; })(), 330014);
    expect(seated.ok).toBe(true);
    if (seated.ok) for (const board of seated.added) expect(Number(board.height)).toBeCloseTo(Number(bridgeOf(stripped).height) + 12, 3);
  });
});

describe("budget mode is exempt and nothing else changes", () => {
  it("a budget plan has no bridge boards and the normalizer returns it untouched", () => {
    const budget = build(true, 66);
    expect(boardsOf(budget)).toEqual([]);
    expect(normalizeBridgeBoards(budget, room)).toBe(budget);
    const bridge = budget.find((item) => item.refrigeratorAssemblyRole === "bridge");
    if (bridge) {
      const glass = { ...bridge, uid: "g", masterCode: "W3612GD", height: 12, mountBottom: Number(bridge.mountBottom) + Number(bridge.height), refrigeratorAssemblyRole: null, refrigeratorAssemblyId: null, stackedOnCabinetUid: bridge.uid } as PlacedCabinet;
      expect(normalizeBridgeBoards([...budget, glass], room).filter((item) => item.fillerContinuousVertical).map((item) => item.height))
        .toEqual([...budget, glass].filter((item) => item.fillerContinuousVertical).map((item) => item.height));
    }
  });
});

describe("designer wiring (source)", () => {
  const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
  const autoLayout = readFileSync(new URL("./autoDesignLayout.ts", import.meta.url), "utf8");
  const designerRules = readFileSync(new URL("./designerLayoutRules.ts", import.meta.url), "utf8");
  it("the single commit boundary re-seats the boards after every edit, including plan drag and 3D arrows", () => {
    const setPlaced = designTool.slice(designTool.indexOf("const setPlaced = useCallback"), designTool.indexOf("useEffect(() => {\n    placedRef.current = placed;"));
    expect(setPlaced).toContain("normalizeBridgeBoards(flushed, roomRef.current)");
    expect(setPlaced.indexOf("normalizeRefrigeratorBridgeDepth")).toBeLessThan(setPlaced.indexOf("normalizeBridgeBoards"));
    expect(designTool).toContain("commitConfiguredRefrigeratorCandidate(workingPrev, uid, movedCabinet, room)");
    expect(designTool).toContain("commitConfiguredRefrigeratorCandidate(prev, uid, candidate, room)");
  });
  it("Auto Design and the designer layout rules run it last, after the glass pass and the bridge depth pass", () => {
    expect(autoLayout.indexOf("working = normalizeBridgeBoards(working, room);")).toBeGreaterThan(autoLayout.indexOf("applyGlassUpperPreference({"));
    expect(designerRules.indexOf("normalizeBridgeBoards(placed, input.room)")).toBeGreaterThan(designerRules.indexOf("normalizeRefrigeratorBridgeDepth(placed, input.room)"));
  });
});
