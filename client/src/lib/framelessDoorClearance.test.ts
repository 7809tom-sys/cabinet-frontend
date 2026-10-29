import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import type { CatalogFillerCandidate } from "./catalogFiller";
import { buildDesignCabinetCartLines } from "./designCartLines";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type WallSide,
} from "./design";
import { FRAMELESS_DOOR_CLEARANCE_FILLER_IN, applyFramelessDoorClearanceFillers } from "./framelessDoorClearance";

const room = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };
const wall: WallSide = "bottom";
const fillers: CatalogFillerCandidate[] = [
  { id: 501, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: 3, height: 34.5, depth: 24, catalogImageUrl: null },
  { id: 502, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: 3, height: 30, depth: 12, catalogImageUrl: null },
];

function seat(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement">, along: number, width: number, depth: number): PlacedCabinet {
  const spot = wallPlacementAt(along, width, depth, wall, room);
  return {
    cabinetId: 1,
    description: partial.masterCode,
    x: spot.x,
    y: spot.y,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    width,
    depth,
    height: partial.placement === "wall" ? 30 : partial.placement === "tall" ? 84 : 34.5,
    mountBottom: partial.placement === "wall" ? 54 : 0,
    styleId: 540005,
    ...partial,
  } as PlacedCabinet;
}

function run(item: PlacedCabinet) {
  const start = wallRunOffset(item, wall, room);
  return { start, end: start + wallRunSpan(item, wall, room) };
}

describe("frameless door clearance beside a refrigerator", () => {
  it("places the standard clearance filler between a frameless cabinet and a refrigerator end panel", () => {
    expect(FRAMELESS_DOOR_CLEARANCE_FILLER_IN).toBe(3);
    const panel = seat({
      uid: "panel",
      masterCode: "REP2496",
      description: "Refrigerator end panel",
      placement: "tall",
      height: 96,
    }, 0, 0.75, 24);
    const cabinet = seat({
      uid: "base",
      masterCode: "B24",
      description: "Frameless base cabinet",
      placement: "base",
      constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    }, 0.75, 24, 24);
    const result = applyFramelessDoorClearanceFillers({
      placed: [panel, cabinet],
      room,
      fillers,
      makeUid: () => "clearance-1",
      styleId: 540005,
    });
    const added = result.added[0];
    expect(result.added).toHaveLength(1);
    expect(added).toMatchObject({
      masterCode: "BF3",
      width: 3,
      fillerBillingRole: "primary",
      fillerTotalWidth: 3,
      styleId: 540005,
    });
    expect(added?.description).toContain("frameless door clearance");
    expect(run(added!).start).toBeCloseTo(run(result.placed.find((item) => item.uid === "panel")!).end, 3);
    expect(run(result.placed.find((item) => item.uid === "base")!).start).toBeCloseTo(run(added!).end, 3);
    const again = applyFramelessDoorClearanceFillers({
      placed: result.placed,
      room,
      fillers,
      makeUid: () => "clearance-2",
      styleId: 540005,
    });
    expect(again.added).toHaveLength(0);
    expect(again.placed).toBe(result.placed);
  });

  it("places the same filler beside a refrigerator wall cabinet and a refrigerator tall cabinet", () => {
    const wallCabinet = seat({
      uid: "fridge-wall",
      masterCode: "WR3630",
      description: "Refrigerator wall cabinet",
      placement: "wall",
      height: 30,
      depth: 24,
    }, 0, 36, 24);
    const upper = seat({
      uid: "upper",
      masterCode: "W3030",
      description: "Frameless wall cabinet",
      placement: "wall",
      constructionMethod: "frameless",
      depth: 12,
      height: 30,
    }, 36, 30, 12);
    const wallResult = applyFramelessDoorClearanceFillers({
      placed: [wallCabinet, upper], room, fillers, makeUid: () => "wall-clearance", styleId: 540005,
    });
    expect(wallResult.added.map((item) => item.masterCode)).toEqual(["WF3"]);

    const tall = seat({
      uid: "fridge-tall",
      masterCode: "RT2496",
      description: "Refrigerator tall cabinet",
      placement: "tall",
      height: 96,
    }, 0, 24, 24);
    const base = seat({
      uid: "base",
      masterCode: "B18",
      description: "Frameless base",
      placement: "base",
      constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    }, 24, 18, 24);
    const tallResult = applyFramelessDoorClearanceFillers({
      placed: [tall, base], room, fillers, makeUid: () => "tall-clearance", styleId: 540005,
    });
    expect(tallResult.added).toHaveLength(1);
    expect(tallResult.added[0]?.width).toBe(3);
  });

  it("leaves a framed cabinet beside the same panel unchanged", () => {
    const panel = seat({
      uid: "panel",
      masterCode: "REP2496",
      description: "Refrigerator end panel",
      placement: "tall",
      height: 96,
      styleId: 330011,
    }, 0, 0.75, 24);
    const framed = seat({
      uid: "framed",
      masterCode: "B24",
      description: "Base cabinet",
      placement: "base",
      constructionMethod: "face frame",
      styleId: 330011,
    }, 0.75, 24, 24);
    const input = [panel, framed];
    const result = applyFramelessDoorClearanceFillers({
      placed: input, room, fillers, makeUid: () => "unused", styleId: 330011,
    });
    expect(result.added).toEqual([]);
    expect(result.placed).toBe(input);
  });

  it("does not treat the refrigerator appliance itself as the neighboring cabinet", () => {
    const fridge = seat({
      uid: "fridge",
      masterCode: "FRIDGE-36",
      description: "Refrigerator",
      placement: "appliance",
      height: 70,
    }, 0, 36, 30);
    const cabinet = seat({
      uid: "base",
      masterCode: "B24",
      description: "Frameless base",
      placement: "base",
      constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    }, 36, 24, 24);
    const result = applyFramelessDoorClearanceFillers({
      placed: [fridge, cabinet], room, fillers, makeUid: () => "unused", styleId: 540005,
    });
    expect(result.added).toEqual([]);
  });

  it("feeds the clearance filler into the combined-cut order when the pieces stay within 2.5 inches", () => {
    const clearance = seat({
      uid: "clearance",
      masterCode: "BF3",
      description: '3" Base Filler — cut to 1.25" — frameless door clearance',
      category: "Filler",
      subCategory: "Filler",
      placement: "base",
      cabinetId: 501,
      width: 1.25,
      nominalWidth: 3,
      fillerTotalWidth: 1.25,
      fillerBillingRole: "primary",
      styleId: 540005,
    }, 0, 1.25, 24);
    const other = { ...clearance, uid: "other-clearance", x: clearance.x + 2, fillerTotalWidth: 1.25, width: 1.25 };
    const lines = buildDesignCabinetCartLines({
      placed: [clearance, other],
      styleId: 540005,
      distributorId: 4,
      tier: "homeowner",
      styleNameById: new Map([[540005, "Frameless White"]]),
      unitPriceFor: () => 22,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[0]?.qtyNote).toBe('two 1.25" pieces cut from one 3" filler');
    expect(lines[0]?.unitPrice).toBe(22);
  });
});
