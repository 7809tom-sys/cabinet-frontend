import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  SIDE_PANEL_THICKNESS_IN,
  applySidePanels,
  rangeOrMicrowaveInPlan,
  rangesFinishedBySidePanels,
  sidePanelNeeds,
  syncRangeAndNeighbourSidePanels,
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
    const needs = sidePanelNeeds({
      placed: [base("left", 0), range(24), base("right", 54)],
      room,
      catalog: panelCatalog,
    });
    const beside = needs.filter((need) => need.reason === "beside-range");
    expect(beside.map((need) => `${need.hostUid}:${need.side}`).sort()).toEqual(["left:end", "right:start"]);
    expect(beside.every((need) => need.selection.masterCode === "BEP2535")).toBe(true);
    expect(beside[0]!.message).toMatch(/3\/4″ side panel \(BEP2535\)/);
    expect(beside[0]!.message).toMatch(/exposed beside the range/);
    expect(beside[0]!.message).not.toMatch(/filler/i);
  });

  it("slides the run over by the 3/4 inch and seats a real catalog panel", () => {
    // 3/4" of unused run stands before the cabinet, exactly what a flank
    // leaves when the range has already been measured.
    const host = base("left", 0.75);
    const result = syncRangeAndNeighbourSidePanels({
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
    const result = syncRangeAndNeighbourSidePanels({
      placed: [base("left", 0), range(24)],
      room,
      catalog: panelCatalog,
      styleId: 540005,
      makeUid: () => "panel-1",
    });
    expect(result.additions).toEqual([]);
    expect(result.skipped[0]?.why).toMatch(/cannot be slid over/);
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
    const needs = sidePanelNeeds({
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
    const needs = sidePanelNeeds({
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
  });

  it("leaves two equal cabinets alone", () => {
    const needs = sidePanelNeeds({
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
    const result = applySidePanels({
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
    const needs = sidePanelNeeds({ placed: [framed, range(24)], room, catalog: panelCatalog });
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
    const placed = [base("left", 0.75), range(24), base("right", 54)];
    const needs = sidePanelNeeds({ placed, room, catalog: panelCatalog });
    // Both flanks are covered, so the old 3" handle-clearance filler prompt must
    // not be raised for this range (issue #354 item 3: fillers are for gaps).
    expect(Array.from(rangesFinishedBySidePanels({ placed, room, needs }))).toEqual(["range"]);
  });

  it("does not mark a range finished when a side has no panel", () => {
    // The right cabinet is a panel-free framed box: it is not a frameless host,
    // so nothing finishes its side and the range is not claimed as finished.
    const framedRight = { ...base("right", 54), constructionMethod: "Framed" };
    const placed = [base("left", 0.75), range(24), framedRight];
    const needs = sidePanelNeeds({ placed, room, catalog: panelCatalog });
    expect(Array.from(rangesFinishedBySidePanels({ placed, room, needs }))).toEqual([]);
  });
});
