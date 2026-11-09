import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  SIDE_PANEL_THICKNESS_IN,
  applyExposedSidePanels,
  exposedSidePanelFor,
  dropFillersOvertakenByExposedPanel,
  rangeOrMicrowaveInPlan,
  cookingSidesFinishedByExposedPanels,
  setExposedSidePanel,
  symmetricEndPanel,
  exposedSidePanelNeeds,
  syncExposedSidePanelsForRun,
} from "@/lib/sidePanelForExposedSide";

const room: RoomData = { width: 180, depth: 120, ceilingHeight: 108 };

const panelCatalog = [
  { id: 101, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 102, masterCode: "WEP1530", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 103, masterCode: "WEP1535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 104, masterCode: "WEP1542", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 105, masterCode: "BEP2535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 106, masterCode: "TEP3096", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
];

function cab(partial: {
  uid: string;
  masterCode: string;
  placement: PlacedCabinet["placement"];
  offset: number;
  width: number;
  height: number;
  depth?: number;
  mountBottom?: number;
  description?: string;
  constructionMethod?: string | null;
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 13.5 : 24);
  const spot = wallPlacementAt(partial.offset, partial.width, depth, "top", room);
  return {
    uid: partial.uid,
    cabinetId: 1,
    masterCode: partial.masterCode,
    description: partial.description ?? partial.masterCode,
    category: partial.placement === "wall" ? "Wall" : "Base",
    placement: partial.placement,
    ...spot,
    width: partial.width,
    depth,
    height: partial.height,
    mountBottom: partial.mountBottom,
    constructionMethod: partial.constructionMethod === undefined ? AEF_PRINTED_GEOMETRY_MARKER : partial.constructionMethod,
  };
}

const range = (offset: number, width = 30, uid = "range") => cab({
  uid,
  masterCode: "RANGE-30",
  placement: "appliance",
  offset,
  width,
  height: 36,
  depth: 25,
  description: "30 inch Freestanding Range",
});

const base = (uid: string, offset: number, width = 24) => cab({ uid, masterCode: `B${width}`, placement: "base", offset, width, height: 34.75 });

describe("automatic side panels on an exposed side (issue #354 items 3 and 4)", () => {
  it("finishes the cabinet side that faces a range with BEP2535, not a filler", () => {
    const needs = exposedSidePanelNeeds({
      placed: [base("left", 6), range(30), base("right", 60)],
      room,
      catalog: panelCatalog,
    });
    const beside = needs.filter((need) => need.reason === "beside-range" || need.reason === "beside-oven");
    expect(beside.map((need) => `${need.hostUid}:${need.side}`).sort()).toEqual(["left:end", "right:start"]);
    expect(beside.every((need) => need.selection.masterCode === "BEP2535")).toBe(true);
    expect(beside[0]!.message).toMatch(/3\/4″ side panel \(BEP2535\)/);
    expect(beside[0]!.message).toMatch(/oven\/range|beside the range/);
    expect(beside[0]!.message).not.toMatch(/filler/i);
  });

  it("slides the run over by the 3/4 inch and seats a real catalog panel", () => {
    // 3/4" of unused run stands before the cabinet, exactly what a flank
    // leaves when the range has already been measured.
    const host = base("left", 0.75);
    const result = syncExposedSidePanelsForRun({
      placed: [host, range(24)],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: (() => { let n = 0; return () => `panel-${++n}`; })(),
    });
    expect(result.skipped).toEqual([]);
    expect(result.additions).toHaveLength(1);
    const panel = result.additions[0]!;
    expect(panel.masterCode).toBe("BEP2535");
    expect(panel.cabinetId).toBe(105);
    expect(panel.width).toBeCloseTo(SIDE_PANEL_THICKNESS_IN, 5);
    expect(panel.autoPlacedForUid).toBe("left");
    expect(panel.fieldModificationNote).toMatch(/Auto-added: side panel/);
    expect(result.placed.some((item) => item.uid === panel.uid)).toBe(true);
    // The cabinet slid to the wall start so the board has its own 3/4" between
    // it and the range.
    expect(result.placed.find((item) => item.uid === "left")?.wallOffset).toBeCloseTo(0, 5);
    expect(panel.wallOffset).toBeCloseTo(24, 5);
  });

  it("reports a tight run instead of forcing a board into an appliance", () => {
    // The cabinet is already hard against the wall: there is no 3/4" to take.
    const result = syncExposedSidePanelsForRun({
      placed: [base("left", 0), range(24)],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: () => "panel-1",
    });
    expect(result.additions).toEqual([]);
    expect(result.skipped[0]?.why).toMatch(/cannot be slid over/);
  });

  it("returns the same array reference on a settled second pass", () => {
    // The Designer runs this in an effect and calls setPlaced whenever the array
    // identity changes, so a fresh array on a settled plan would loop forever.
    const first = syncExposedSidePanelsForRun({
      placed: [base("left", 0.75), range(24)],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: (() => { let n = 0; return () => `panel-${++n}`; })(),
    });
    expect(first.additions).toHaveLength(1);
    const second = syncExposedSidePanelsForRun({
      placed: first.placed,
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: () => { throw new Error("no panel may be added on a settled pass"); },
    });
    expect(second.placed).toBe(first.placed);
    expect(second.additions).toEqual([]);
  });

  it("never stacks a duplicate board on a side that already has one", () => {
    const alreadyPanelled = {
      ...base("left", 0.75),
      uid: "existing-panel",
      masterCode: "BEP2535",
      description: 'BEP2535 3/4" Frameless End Panel',
      category: "Panels",
      subCategory: "End panel",
      width: SIDE_PANEL_THICKNESS_IN,
      autoPlacedForUid: "left",
      autoPlacedSide: "end" as const,
    };
    const result = syncExposedSidePanelsForRun({
      placed: [base("left", 0.75), range(24), alreadyPanelled],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: () => "duplicate",
    });
    expect(result.additions).toEqual([]);
    expect(result.placed.filter((item) => item.autoPlacedForUid === "left").length).toBe(1);
  });

  it("finishes a wall cabinet side beside a microwave with the wall panel for its height", () => {
    const microwave = cab({
      uid: "mw",
      masterCode: "MW-30",
      placement: "appliance",
      offset: 24,
      width: 30,
      height: 16,
      description: "Over-the-range microwave",
    });
    const needs = exposedSidePanelNeeds({
      placed: [cab({ uid: "wall", masterCode: "W3030", placement: "wall", offset: 54, width: 30, height: 30.25, mountBottom: 54 }), microwave],
      room,
      catalog: panelCatalog,
    });
    const beside = needs.find((need) => need.reason === "beside-microwave");
    expect(beside?.hostUid).toBe("wall");
    expect(beside?.side).toBe("start");
    expect(beside?.selection.masterCode).toBe("WEP1530");
  });

  it("finishes the side a shorter neighbour leaves exposed", () => {
    const needs = exposedSidePanelNeeds({
      placed: [
        cab({ uid: "tall-wall", masterCode: "W2440", placement: "wall", offset: 0, width: 24, height: 40.25, mountBottom: 54 }),
        cab({ uid: "short-wall", masterCode: "W3030", placement: "wall", offset: 24, width: 30, height: 30.25, mountBottom: 54 }),
      ],
      room,
      catalog: panelCatalog,
    });
    const smaller = needs.find((need) => need.reason === "smaller-neighbour");
    expect(smaller?.hostUid).toBe("tall-wall");
    expect(smaller?.side).toBe("end");
    expect(smaller?.selection.masterCode).toBe("WEP1542");
    expect(smaller?.message).toMatch(/adjacent cabinet is smaller/);
    // The exposed band is the 10" above the short neighbour's top, not the
    // whole 40-1/4" box.
    expect(smaller?.bottomIn).toBeCloseTo(84.25, 5);
    expect(smaller?.heightIn).toBeCloseTo(10, 5);
  });

  it("mounts the smaller-neighbour panel on the band that really shows", () => {
    const tall = cab({ uid: "tall-wall", masterCode: "W2440", placement: "wall", offset: 0, width: 24, height: 40.25, mountBottom: 54 });
    const short = cab({ uid: "short-wall", masterCode: "W3030", placement: "wall", offset: 24, width: 30, height: 30.25, mountBottom: 54 });
    const result = syncExposedSidePanelsForRun({
      placed: [tall, short],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: (() => { let n = 0; return () => `panel-${++n}`; })(),
    });
    const panel = result.additions.find((item) => item.autoPlacedForUid === "tall-wall")!;
    expect(panel.masterCode).toBe("WEP1542");
    // The real geometry: the board covers 84-1/4"–94-1/4" on the tall box's side,
    // so it sits on the exposed band rather than hanging at the 54" bottom.
    expect(panel.mountBottom).toBeCloseTo(84.25, 5);
    expect(panel.height).toBeCloseTo(10, 5);
    expect((panel.mountBottom ?? 0) + Number(panel.height)).toBeCloseTo(94.25, 5);
    // It stands outside the 54"-tall cabinet's end, and does not overlap the
    // shorter neighbour's own footprint.
    expect(panel.wallOffset).toBeCloseTo(tall.wallOffset! + 24, 5);
    expect((panel.mountBottom ?? 0)).toBeGreaterThan(Number(short.mountBottom) + 24);
  });

  it("leaves two equal cabinets alone", () => {
    const needs = exposedSidePanelNeeds({
      placed: [
        cab({ uid: "a", masterCode: "W3030", placement: "wall", offset: 0, width: 30, height: 30.25, mountBottom: 54 }),
        cab({ uid: "b", masterCode: "W3030", placement: "wall", offset: 30, width: 30, height: 30.25, mountBottom: 54 }),
      ],
      room,
      catalog: panelCatalog,
    });
    expect(needs).toEqual([]);
  });

  it("names a side that has no free 3/4 inch instead of forcing a board", () => {
    // The run starts at the wall, so there is no room outside the left cabinet
    // for its panel.
    const result = applyExposedSidePanels({
      placed: [base("left", 0), range(24)],
      room,
      needs: [{
        hostUid: "left",
        hostCode: "B24",
        side: "start",
        reason: "beside-range",
        wallId: "top",
        startIn: -0.75,
        heightIn: 34.75,
        depthIn: 24,
        placement: "base",
        selection: {
          masterCode: "BEP2535",
          cabinetId: 105,
          pendingSku: false,
          stockWidth: 25.625,
          stockHeight: 35.25,
          stockThickness: 0.75,
          height: 34.75,
          depth: 24.75,
          family: "base",
        },
        message: "test",
      }],
      styleId: null,
      makeUid: () => "p1",
    });
    expect(result.additions).toEqual([]);
    expect(result.skipped[0]?.why).toMatch(/no free 3\/4″/);
  });

  it("does not invent a panel on a framed line", () => {
    const framed = { ...base("framed", 0), constructionMethod: "Framed" };
    const needs = exposedSidePanelNeeds({ placed: [framed, range(24)], room, catalog: panelCatalog });
    expect(needs).toEqual([]);
  });

  it("answers whether cooking equipment is in the plan at all", () => {
    expect(rangeOrMicrowaveInPlan([base("a", 0)])).toBe(false);
    expect(rangeOrMicrowaveInPlan([base("a", 0), range(24)])).toBe(true);
    expect(rangeOrMicrowaveInPlan([
      cab({ uid: "mw", masterCode: "MW-30", placement: "appliance", offset: 0, width: 30, height: 16, description: "Over-the-range microwave" }),
    ])).toBe(true);
  });

  it("marks a range finished once a side panel covers each side that faces it", () => {
    const placed = [base("left", 6), range(30), base("right", 60)];
    const needs = exposedSidePanelNeeds({ placed, room, catalog: panelCatalog });
    // Both flanks are covered, so the old 3" handle-clearance filler prompt must
    // not be raised for this range (issue #354 item 3: fillers are for gaps).
    expect(Array.from(cookingSidesFinishedByExposedPanels({ placed, room, needs }))).toEqual(["range"]);
  });

  it("does not mark a range finished when a side has no panel", () => {
    // The right cabinet is a panel-free framed box: it is not a frameless host,
    // so nothing finishes its side and the range is not claimed as finished.
    const framedRight = { ...base("right", 60), constructionMethod: "Framed" };
    const placed = [base("left", 6), range(30), framedRight];
    const needs = exposedSidePanelNeeds({ placed, room, catalog: panelCatalog });
    expect(Array.from(cookingSidesFinishedByExposedPanels({ placed, room, needs }))).toEqual([]);
  });
});

describe("required panel rules (Tom, Nov 9 2026)", () => {
  const hood = (offset: number) => cab({
    uid: "hood",
    masterCode: "HOOD-30",
    placement: "appliance",
    offset,
    width: 30,
    height: 18,
    depth: 18,
    description: "30 inch Range Hood",
  });

  it("requires a wall end panel on the wall cabinet side that faces a range hood", () => {
    const upper = cab({ uid: "upper", masterCode: "W3030", placement: "wall", offset: 54, width: 30, height: 30.25, mountBottom: 54 });
    const needs = exposedSidePanelNeeds({ placed: [hood(24), upper], room, catalog: panelCatalog });
    const hoodSide = needs.find((need) => need.reason === "beside-hood");
    expect(hoodSide?.hostUid).toBe("upper");
    expect(hoodSide?.side).toBe("start");
    // A wall board sized to the wall cabinet, never a base panel.
    expect(hoodSide?.selection.masterCode).toBe("WEP1530");
    expect(hoodSide?.selection.family).toBe("wall");
  });

  it("requires a base end panel on the base side that faces the oven/range", () => {
    const needs = exposedSidePanelNeeds({ placed: [base("left", 0.75), range(24)], room, catalog: panelCatalog });
    const ovenSide = needs.find((need) => need.reason === "beside-oven");
    expect(ovenSide?.hostUid).toBe("left");
    expect(ovenSide?.side).toBe("end");
    expect(ovenSide?.selection.masterCode).toBe("BEP2535");
    expect(ovenSide?.selection.family).toBe("base");
  });

  it("never lets a filler stand in for a required panel on the same side", () => {
    // A filler board sitting in the slot the panel needs is removed; the panel wins.
    const host = base("left", 6);
    // A filler board standing exactly in the 3/4" slot the required panel needs.
    const filler: PlacedCabinet = {
      ...base("filler", 30),
      uid: "loose-filler",
      masterCode: "OF330",
      description: '3" Filler',
      width: 3,
    };
    // The range butts the host directly. The requirement is measured on the plan
    // without the filler, so this asserts the panel keeps priority on that side.
    const placed = [host, filler, range(30)];
    const needs = exposedSidePanelNeeds({ placed: [host, range(30)], room, catalog: panelCatalog });
    const required = needs.filter((need) => need.reason === "beside-oven" || need.reason === "beside-range");
    expect(required.length).toBeGreaterThan(0);
    const pruned = dropFillersOvertakenByExposedPanel({ placed, needs, room });
    expect(pruned.removed.map((item) => item.uid)).toContain("loose-filler");
    expect(pruned.placed.some((item) => item.uid === "loose-filler")).toBe(false);
  });

  it("adds no panel on a side that another cabinet already finishes", () => {
    // Two equal bases butted together: neither side is exposed, so no panel.
    const needs = exposedSidePanelNeeds({ placed: [base("a", 0), base("b", 24)], room, catalog: panelCatalog });
    expect(needs).toEqual([]);
  });

  it("adds no panel on a side that a tall unit in the run finishes", () => {
    const pantry = cab({ uid: "pantry", masterCode: "T3084", placement: "tall", offset: 24, width: 24, height: 84 });
    const needs = exposedSidePanelNeeds({ placed: [base("a", 0), pantry], room, catalog: panelCatalog });
    expect(needs.filter((need) => need.hostUid === "a")).toEqual([]);
  });

  it("never auto-places a panel against a pantry that is NOT included in the run", () => {
    // An excluded pantry stands beside the run but is not in it. Tom's
    // correction: this is NEVER automatic — no board is invented here by the
    // needs pass, by applyExposedSidePanels, or on restore. The customer adds it with
    // the per-cabinet Left/Right panel toggle.
    const needs = exposedSidePanelNeeds({ placed: [base("a", 6)], room, catalog: panelCatalog });
    expect(needs.some((need) => need.hostUid === "a")).toBe(false);
    const applied = applyExposedSidePanels({ placed: [base("a", 6)], room, needs, styleId: 1, makeUid: () => "auto" });
    expect(applied.additions).toEqual([]);
  });

  it("places a panel against an excluded pantry only after the user toggles it on", () => {
    const run = base("a", 6);
    // No automatic board exists yet.
    const auto = syncExposedSidePanelsForRun({ placed: [run], room, catalog: panelCatalog, styleId: 1, makeUid: () => "auto" });
    expect(auto.additions).toEqual([]);
    // The customer toggles the right side, which faces the separate pantry.
    const toggled = setExposedSidePanel({
      placed: [run],
      hostUid: "a",
      side: "end",
      enabled: true,
      room,
      catalog: panelCatalog,
      styleId: 1,
      makeUid: () => "manual",
    });
    expect(toggled.ok).toBe(true);
    if (!toggled.ok) return;
    expect(toggled.panel.masterCode).toBe("BEP2535");
    expect(exposedSidePanelFor("a", "end", toggled.placed)).not.toBeNull();
  });
});

describe("per-cabinet Left / Right panel toggles", () => {
  it("seats the line's end panel on the toggled side, as a real catalog row", () => {
    const host = base("host", 24, 24);
    expect(host.wallOffset).toBe(24);
    const result = setExposedSidePanel({
      placed: [host],
      hostUid: "host",
      side: "start",
      enabled: true,
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: () => "unused",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.masterCode).toBe("BEP2535");
    expect(result.panel.cabinetId).toBe(105);
    expect(result.placed.some((item) => item.uid === "host:manual-panel:start")).toBe(true);
    expect(exposedSidePanelFor("host", "start", result.placed)?.masterCode).toBe("BEP2535");
  });

  it("keeps the two sides independent", () => {
    // 3/4" of free run on each side, and not against the wall, so both toggles
    // can be satisfied without moving anything.
    const host = base("host", 6, 24);
    expect(host.wallOffset).toBe(6);
    const left = setExposedSidePanel({ placed: [host], hostUid: "host", side: "start", enabled: true, room, catalog: panelCatalog, styleId: 1, makeUid: () => "x" });
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    const right = setExposedSidePanel({ placed: left.placed, hostUid: "host", side: "end", enabled: true, room, catalog: panelCatalog, styleId: 1, makeUid: () => "y" });
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    expect(exposedSidePanelFor("host", "start", right.placed)).not.toBeNull();
    expect(exposedSidePanelFor("host", "end", right.placed)).not.toBeNull();
    const removedLeft = setExposedSidePanel({ placed: right.placed, hostUid: "host", side: "start", enabled: false, room, catalog: panelCatalog, styleId: 1, makeUid: () => "z" });
    expect(removedLeft.ok).toBe(true);
    if (!removedLeft.ok) return;
    expect(exposedSidePanelFor("host", "start", removedLeft.placed)).toBeNull();
    expect(exposedSidePanelFor("host", "end", removedLeft.placed)).not.toBeNull();
  });

  it("refuses a panel on a side that is not exposed", () => {
    const result = setExposedSidePanel({
      placed: [base("a", 0), base("b", 24)],
      hostUid: "a",
      side: "end",
      enabled: true,
      room,
      catalog: panelCatalog,
      styleId: 1,
      makeUid: () => "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/already finished/);
  });
});

describe("wall/base symmetry default at a run end (Tom, Nov 9 2026)", () => {
  it("matches a wall panel to the base panel at the same exposed run end", () => {
    const base = cab({ uid: "base", masterCode: "B24", placement: "base", offset: 6, width: 24, height: 34.75 });
    const upper = cab({ uid: "upper", masterCode: "W2430", placement: "wall", offset: 6, width: 24, height: 30.25, mountBottom: 54 });
    const basePanel: PlacedCabinet = {
      ...cab({ uid: "base-panel", masterCode: "BEP2535", placement: "base", offset: 5.25, width: 0.75, height: 34.75 }),
      description: 'BEP2535 3/4" Frameless End Panel',
      category: "Panels",
      subCategory: "End panel",
      autoPlacedForUid: "base",
      autoPlacedSide: "start",
    };
    const placed = [basePanel, base, upper];
    const match = symmetricEndPanel({ placed, room, catalog: panelCatalog, panelUid: "base-panel" });
    expect(match).not.toBeNull();
    expect(match?.hostUid).toBe("upper");
    expect(match?.side).toBe("start");
    // The same catalog stock family, so the look lines up.
    expect(match?.selection.masterCode).toBe("WEP1530");
    expect(match?.reason).toBe("symmetric-end");
    expect(match?.message).toMatch(/wall and base ends line up/);
    expect(match?.message).toMatch(/You can change or remove it/);
  });

  it("never adds a symmetric panel to a hidden side", () => {
    // The upper's start side butts a tall pantry in the run, so it is hidden:
    // no symmetric panel may be invented there.
    const base = cab({ uid: "base", masterCode: "B24", placement: "base", offset: 30, width: 24, height: 34.75 });
    const upper = cab({ uid: "upper", masterCode: "W2430", placement: "wall", offset: 30, width: 24, height: 30.25, mountBottom: 54 });
    const pantry = cab({ uid: "pantry", masterCode: "T3084", placement: "tall", offset: 6, width: 24, height: 84 });
    const basePanel: PlacedCabinet = {
      ...cab({ uid: "base-panel", masterCode: "BEP2535", placement: "base", offset: 29.25, width: 0.75, height: 34.75 }),
      description: 'BEP2535 3/4" Frameless End Panel',
      category: "Panels",
      subCategory: "End panel",
      autoPlacedForUid: "base",
      autoPlacedSide: "start",
    };
    const placed = [pantry, basePanel, base, upper];
    expect(symmetricEndPanel({ placed, room, catalog: panelCatalog, panelUid: "base-panel" })).toBeNull();
  });

  it("leaves an allowed mismatch alone: it is a default, never forced", () => {
    // The customer removed the matched wall panel. The base panel still exists and
    // the pair simply differs; nothing re-adds the wall board.
    const base = cab({ uid: "base", masterCode: "B24", placement: "base", offset: 6, width: 24, height: 34.75 });
    const upper = cab({ uid: "upper", masterCode: "W2430", placement: "wall", offset: 6, width: 24, height: 30.25, mountBottom: 54 });
    const basePanel: PlacedCabinet = {
      ...cab({ uid: "base-panel", masterCode: "BEP2535", placement: "base", offset: 5.25, width: 0.75, height: 34.75 }),
      description: 'BEP2535 3/4" Frameless End Panel',
      category: "Panels",
      subCategory: "End panel",
      autoPlacedForUid: "base",
      autoPlacedSide: "start",
    };
    const placed = [basePanel, base, upper];
    const needs = exposedSidePanelNeeds({ placed, room, catalog: panelCatalog });
    // The automatic needs pass must NOT invent a wall panel just for symmetry.
    expect(needs.some((need) => need.reason === "symmetric-end")).toBe(false);
  });
});
