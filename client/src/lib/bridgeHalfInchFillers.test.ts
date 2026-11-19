import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isFillerItem, isPanelItem, wallPlacementAtUnbounded, wallRunOffset, wallRunSpan,
  type PlacedCabinet, type RoomData,
} from "./design";
import {
  applyBridgeAreaFillerRule, buildBridgeHalfInchFillers, isBridgeAreaFiller, isBridgeHalfInchFiller, seatRequiredBridgeFillers,
} from "./bridgeHalfInchFillers";
import { isCombinedSmallFiller } from "./fillerBilling";

/**
 * Rich's bridge filler rule (Tom, Nov 19 2026): a 1/2" filler on each side of every bridge over a refrigerator, in
 * the standard (non-budget) flows only; one 3" filler against a wall gap; nothing else in the bridge area.
 */
const roomFor = (width: number) => ({ width, depth: 120, ceilingHeight: 96 } as RoomData);
const pack = (matrix as any)["330014"];

const sinkRows = (pelicanRows as any[]).filter((row) => row.subCategory === "Sinks").map((row) => ({ id: Number(row.id), pelicanCode: row.pelicanCode, name: row.name, category: row.category, subCategory: "Sinks", size: row.size ?? null, sellPrice: row.sellPrice ?? null, imageUrl: row.imageUrl ?? null })) as never[];
const faucetRows = (pelicanRows as any[]).filter((row) => /faucet/i.test(String(row.subCategory ?? "")) && !/accessor/i.test(String(row.subCategory ?? ""))).map((row) => ({ ...row, id: Number(row.id) })) as never[];
function run(budget: boolean, fridgeC: number, stoveC: number, roomWidth: number) {
  const ROOM = roomFor(roomWidth);
  let uid = 0;
  const r = runAutoDesignLayout({
    input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: fridgeC }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: stoveC },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "left", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], sinkCatalog: sinkRows, faucetCatalog: faucetRows, styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
  return r;
}

const span = (item: PlacedCabinet, room: RoomData) => {
  const start = wallRunOffset(item, "top", room);
  return { start: Math.round(start * 1000) / 1000, end: Math.round((start + wallRunSpan(item, "top", room)) * 1000) / 1000 };
};
const topWall = (placed: PlacedCabinet[], room: RoomData) => placed.filter((item) => item.wallId === "top" && cabinetWall(item, room) === "top");
const bridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
const fridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => /^FRIDGE/.test(item.masterCode))!;
const nextId = () => { let n = 1000; return () => `t-${++n}`; };
const catalogFillers = () => (pack as any).accessory;

/**
 * The 1/2 in board standing at one junction of the bridge: either the bridge's own wall board (attached to the bridge) or
 * the refrigerator's existing full-height 1/2 in board that the engine already places there (never doubled).
 */
const junctionBoard = (placed: PlacedCabinet[], room: RoomData, side: "left" | "right") => {
  const bridge = span(bridgeOf(placed), room);
  const from = side === "left" ? bridge.start - 0.5 : bridge.end;
  return placed.find((item) => isFillerItem(item) && !isPanelItem(item) && cabinetWall(item, room) === "top"
    && Math.abs(span(item, room).start - from) < 0.01 && Math.abs(span(item, room).end - (from + 0.5)) < 0.01
    && (item.placement === "wall" || item.fillerContinuousVertical === true));
};

describe("bridge 1/2 inch fillers: Auto Design, standard flow", () => {
  const room = roomFor(144);
  const result = run(false, 24, 100, 144);
  const placed = result.placed as PlacedCabinet[];

  it("builds the layout with a 1/2 in board on each side of the bridge, so 36 takes a 37 in opening", () => {
    expect(result.ok).toBe(true);
    const bridge = bridgeOf(placed);
    expect(Number(bridge.width)).toBe(36);
    const left = junctionBoard(placed, room, "left")!;
    const right = junctionBoard(placed, room, "right")!;
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(span(right, room).end - span(left, room).start).toBeCloseTo(37, 3);
  });

  it("puts the bridge's own boards on the bridge only, never on a refrigerator panel, and stands the panels beyond the 37 in opening", () => {
    const bridge = bridgeOf(placed);
    const own = placed.filter(isBridgeHalfInchFiller);
    expect(own.length).toBeGreaterThanOrEqual(1);
    for (const board of own) {
      expect(board.fillerForCabinetUid).toBe(bridge.uid);
      expect(Number(board.width)).toBe(0.5);
      expect(placed.find((item) => item.uid === board.fillerForCabinetUid && isPanelItem(item))).toBeUndefined();
    }
    const left = span(junctionBoard(placed, room, "left")!, room);
    const right = span(junctionBoard(placed, room, "right")!, room);
    const leftPanel = span(placed.find((item) => item.refrigeratorAssemblyRole === "left-panel")!, room);
    const rightPanel = span(placed.find((item) => item.refrigeratorAssemblyRole === "right-panel")!, room);
    expect(leftPanel.end).toBeLessThanOrEqual(left.start + 0.001);
    expect(rightPanel.start).toBeGreaterThanOrEqual(right.end - 0.001);
  });

  it("uses the line's existing 3 in filler stock cut to 1/2 in and bills the boards as one stock board", () => {
    const own = placed.filter(isBridgeHalfInchFiller);
    for (const board of own) {
      expect(board.nominalWidth).toBe(3);
      expect(board.cabinetId).toBeTruthy();
      expect(board.description).toMatch(/cut to ½/);
      expect(board.fieldModificationNote).toMatch(/37" opening/);
    }
    // Two 1/2 in boards of the same stock bill as one board with a cut note (the existing cut-group rule).
    const pair = [{ ...own[0]!, uid: "p1" }, { ...own[0]!, uid: "p2" }] as PlacedCabinet[];
    expect(pair.filter((board) => isCombinedSmallFiller(board, pair))).toHaveLength(1);
  });

  it("allows no other wall-level filler in the bridge area", () => {
    const bridge = span(bridgeOf(placed), room);
    const stray = topWall(placed, room).filter((item) => item.placement === "wall" && isFillerItem(item) && !isPanelItem(item) && !isBridgeAreaFiller(item)
      && item.fillerContinuousVertical !== true
      && span(item, room).end >= bridge.start - 3.5 && span(item, room).start <= bridge.end + 3.5);
    expect(stray).toEqual([]);
  });

  it("at a wall-end refrigerator keeps only the open-side board and the panel stands beyond it", () => {
    const wallRoom = roomFor(144);
    const wallEnd = run(false, 21, 100, 144).placed as PlacedCabinet[];
    const bridge = span(bridgeOf(wallEnd), wallRoom);
    expect(bridge.start).toBeCloseTo(0, 3);
    expect(junctionBoard(wallEnd, wallRoom, "right")).toBeTruthy();
    expect(wallEnd.filter(isBridgeHalfInchFiller).map((item) => item.refrigeratorAssemblyRole)).toEqual(["bridge-right-filler"]);
    const panel = span(wallEnd.find((item) => item.refrigeratorAssemblyRole === "right-panel")!, wallRoom);
    expect(panel.start).toBeCloseTo(bridge.end + 0.5, 3);
  });
});

describe("bridge 1/2 inch fillers: budget mode is exempt", () => {
  const room = roomFor(168);
  const result = run(true, 66, 120, 168);
  const placed = result.placed as PlacedCabinet[];

  it("adds no bridge filler and leaves the bridge area exactly as it was on main", () => {
    expect(result.ok).toBe(true);
    expect(placed.filter((item) => isBridgeAreaFiller(item) || /^bridge-(left|right)-filler$/.test(String(item.refrigeratorAssemblyRole)))).toEqual([]);
    const uppers = topWall(placed, room).filter((item) => item.placement === "wall")
      .map((item) => `${item.masterCode} ${span(item, room).start}-${span(item, room).end}`)
      .sort((a, b) => parseFloat(a.split(" ")[1]!) - parseFloat(b.split(" ")[1]!));
    // Snapshot taken on main (3486f67) for the same inputs.
    expect(uppers).toEqual([
      "W3630 0-36", "W1230 36-48", "W3612 48-84", "W1830 84-102", "W3012 102-132", "W1230 132-144",
    ]);
    expect(String(result.notes?.join("\n"))).not.toMatch(/Bridge fillers/);
  });
});

describe("bridge area filler rule", () => {
  const room = roomFor(144);
  const base = (run(false, 27, 100, 144).placed as PlacedCabinet[]);
  // Strip the junction boards, the left panel and anything else on the left of the bridge, then seat the bridge `at` inches from the wall.
  const withBridgeAt = (at: number, extra: PlacedCabinet[] = []) => {
    const bridge = bridgeOf(base);
    const keep = base.filter((item) => item.uid === bridge.uid || /^FRIDGE/.test(item.masterCode));
    const moved = { ...bridge, ...wallPlacementAtUnbounded(at, 36, Number(bridge.depth), "top", room) } as PlacedCabinet;
    return [...keep.filter((item) => item.uid !== bridge.uid), moved, ...extra];
  };

  it("closes a gap of 3 in or less against a wall with one filler attached to the bridge, cut to the gap", () => {
    const placed = withBridgeAt(2);
    const out = applyBridgeAreaFillerRule(placed, room, catalogFillers(), nextId(), 330014);
    expect(out.added).toHaveLength(1);
    const filler = out.added[0]!;
    expect(span(filler, room)).toEqual({ start: 0, end: 2 });
    expect(filler.fillerForCabinetUid).toBe(bridgeOf(placed).uid);
    expect(filler.nominalWidth).toBe(3);
    expect(filler.description).toMatch(/3.*stock, cut to 2/);
    expect(out.oversizeGaps.filter((gap) => gap.side === "left")).toEqual([]);
    expect(out.closedGaps).toEqual([expect.objectContaining({ side: "left", gapIn: 2 })]);
  });

  it("adds no second filler for a gap over 3 in and reports it as an open question", () => {
    const out = applyBridgeAreaFillerRule(withBridgeAt(4), room, catalogFillers(), nextId(), 330014);
    expect(out.added).toEqual([]);
    expect(out.oversizeGaps.map((gap) => ({ side: gap.side, gapIn: gap.gapIn }))).toContainEqual({ side: "left", gapIn: 4 });
  });

  it("adds no filler and moves no cabinet for a gap that is not against a wall", () => {
    const bridge = bridgeOf(base);
    const neighborSource = base.find((item) => item.placement === "wall" && !isFillerItem(item) && !isPanelItem(item) && item.uid !== bridge.uid)!;
    const neighbor = { ...neighborSource, ...wallPlacementAtUnbounded(0, 3, Number(neighborSource.depth), "top", room), width: 3 } as PlacedCabinet;
    const placed = withBridgeAt(8, [neighbor]);
    const before = placed.map((item) => [item.uid, item.x, item.y]);
    const out = applyBridgeAreaFillerRule(placed, room, catalogFillers(), nextId(), 330014);
    expect(out.added).toEqual([]);
    expect(out.oversizeGaps.filter((gap) => gap.side === "left")).toEqual([]);
    expect(out.placed.map((item) => [item.uid, item.x, item.y])).toEqual(before);
  });

  it("leaves the junction boards unchanged", () => {
    const placed = run(false, 27, 100, 144).placed as PlacedCabinet[];
    const out = applyBridgeAreaFillerRule(placed, room, catalogFillers(), nextId(), 330014);
    const key = (list: PlacedCabinet[]) => list.filter(isBridgeHalfInchFiller).map((item) => [item.uid, item.x, item.y, item.width]);
    expect(key(out.placed)).toEqual(key(placed));
    expect(out.added).toEqual([]);
  });
});

describe("manual designer hook", () => {
  const room = roomFor(144);
  const full = run(false, 27, 100, 144).placed as PlacedCabinet[];
  const stripped = full.filter((item) => !isBridgeHalfInchFiller(item));

  it("seats both boards automatically when a bridge is placed over a refrigerator", () => {
    const bridge = bridgeOf(stripped);
    const out = seatRequiredBridgeFillers(stripped, bridge.uid, room, catalogFillers(), nextId(), 330014);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.added.length).toBeGreaterThanOrEqual(1);
    expect(out.placed.filter(isBridgeHalfInchFiller).length).toBe(out.added.length);
    expect(out.placed.filter(isBridgeHalfInchFiller).every((item) => item.fillerForCabinetUid === bridge.uid)).toBe(true);
  });

  it("is a no-op for a cabinet that is not a bridge and idempotent for a bridge that has its boards", () => {
    const other = full.find((item) => item.placement === "base")!;
    const same = seatRequiredBridgeFillers(full, other.uid, room, catalogFillers(), nextId(), 330014);
    expect(same.ok && same.added.length).toBe(0);
    const again = seatRequiredBridgeFillers(full, bridgeOf(full).uid, room, catalogFillers(), nextId(), 330014);
    expect(again.ok && again.added.length).toBe(0);
  });

  it("refuses the bridge, with the reason, when a panel stands where a board must go", () => {
    const bridge = bridgeOf(stripped);
    const squeezed = stripped.map((item) => (item.refrigeratorAssemblyRole === "left-panel"
      ? { ...item, ...wallPlacementAtUnbounded(span(bridge, room).start - Number(item.width), Number(item.width), Number(item.depth), "top", room) } as PlacedCabinet
      : item));
    const out = seatRequiredBridgeFillers(squeezed, bridge.uid, room, catalogFillers(), nextId(), 330014);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/required 1\/2″ bridge fillers/);
  });

  it("builds the pair on the opening's two edges: 36 + 1/2 + 1/2 = 37", () => {
    const bridge = bridgeOf(stripped);
    const built = buildBridgeHalfInchFillers(bridge, stripped, room, catalogFillers(), nextId(), 330014);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const [left, right] = built.fillers;
    expect(span(right!, room).end - span(left!, room).start).toBeCloseTo(37, 3);
  });
});
