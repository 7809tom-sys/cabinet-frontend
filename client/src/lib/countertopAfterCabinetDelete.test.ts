import { describe, expect, it } from "vitest";
import {
  countertopSurfaces,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { isBathroomVanityCabinet } from "./bathroomVanityCatalog";
import { DISHWASHER_RUN_END_PANEL_REASON } from "./dishwasherPanelRule";

const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function base(uid: string, x: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `${width}" Base Cabinet`,
    category: "Base Cabinets",
    subCategory: "Base Cabinets",
    placement: "base",
    x,
    y: 0,
    width,
    depth: 24,
    height: 34.5,
    wallId: "top",
    wallOffset: x,
    rotation: 0,
    ...extra,
  } as PlacedCabinet;
}

/** Slabs are compared as spans along the run, which is what "floating" is about. */
function spans(placed: PlacedCabinet[], room: RoomData = ROOM): Array<{ start: number; end: number }> {
  return countertopSurfaces(placed, room)
    .filter((surface) => surface.kind === "base")
    .map((surface) => ({ start: Math.round(surface.x * 100) / 100, end: Math.round((surface.x + surface.width) * 100) / 100 }))
    .sort((left, right) => left.start - right.start);
}

describe("A countertop covers only the cabinets that remain under it", () => {
  const run = [base("a", 0, 30), base("b", 30, 30), base("c", 60, 30)];

  it("runs the full length while all three cabinets are in place", () => {
    expect(spans(run)).toEqual([{ start: 0, end: 90 }]);
  });

  it("shortens when an END cabinet is deleted", () => {
    // Deleting the right-hand end cabinet must trim the right end of the top.
    expect(spans([run[0]!, run[1]!])).toEqual([{ start: 0, end: 60 }]);
    // …and the left end, symmetrically.
    expect(spans([run[1]!, run[2]!])).toEqual([{ start: 30, end: 90 }]);
  });

  it("splits into two pieces when a MIDDLE cabinet is deleted", () => {
    // The 30" hole at 30–60 must be empty. One slab from 30–90 would be the
    // floating section in the owner's screenshot.
    expect(spans([run[0]!, run[2]!])).toEqual([
      { start: 0, end: 30 },
      { start: 60, end: 90 },
    ]);
  });

  it("leaves no countertop when the ONLY cabinet is deleted", () => {
    expect(spans([])).toEqual([]);
    expect(spans([run[1]!])).toEqual([{ start: 30, end: 60 }]);
  });

  it("never spans a gap left by a deleted cabinet while a further run continues", () => {
    // Four cabinets, the second removed: two pieces, and the far run still ends
    // where its own last cabinet does.
    const four = [base("a", 0, 30), base("b", 30, 30), base("c", 60, 30), base("d", 90, 30)];
    expect(spans([four[0]!, four[2]!, four[3]!])).toEqual([
      { start: 0, end: 30 },
      { start: 60, end: 120 },
    ]);
  });
});

describe("Support that legitimately continues the top still does", () => {
  it("keeps one continuous top across a touching filler", () => {
    const filler = base("fill", 24, 3, {
      masterCode: "FILL-3",
      description: '3" Filler',
      subCategory: "Filler",
      fillerPieceGroupId: "g1",
      fillerTotalWidth: 3,
      fillerPlacementMode: "right",
    });
    expect(spans([base("a", 0, 24), filler, base("c", 27, 30)])).toEqual([{ start: 0, end: 57 }]);
  });

  it("keeps one continuous top across both halves of a split filler purchase", () => {
    const left = base("fill-left", 24, 1.25, {
      masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler",
      fillerPieceGroupId: "split", fillerTotalWidth: 2.5, fillerPlacementMode: "split",
    });
    const right = base("fill-right", 40.25, 1.25, {
      masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler",
      fillerPieceGroupId: "split", fillerTotalWidth: 2.5, fillerPlacementMode: "split",
    });
    // One purchased board fitted at both ends of the opening: the top is
    // continuous, exactly as before this rule.
    expect(spans([left, right])).toEqual([{ start: 24, end: 41.5 }]);
  });

  it("keeps a 45-degree dishwasher's own counter-bearing return continuous", () => {
    const dishwasher = base("dw", 24, 24, {
      masterCode: "DWR-24",
      description: '24" Dishwasher',
      category: "Appliances",
      subCategory: "Appliances",
      placement: "appliance",
      applianceRole: "base-height",
    });
    const returnPanel = base("dw-return", 48, 3, {
      masterCode: "DWR-PANEL",
      description: "Dishwasher return panel",
      placement: "base",
      autoPlacedReason: DISHWASHER_RUN_END_PANEL_REASON,
      depth: 24,
    });
    // A dishwasher is an appliance opening the top covers; the auto-placed
    // return panel bears the top past its finished end.
    expect(spans([base("a", 0, 24), dishwasher, returnPanel])).toEqual([{ start: 0, end: 51 }]);
  });

  it("covers an appliance OPENING between two cabinets, and ends at a flush appliance", () => {
    const range = (x: number) => base("range", x, 30, {
      masterCode: "RANGE-30",
      description: "30 inch Gas Range",
      category: "Appliances",
      subCategory: "Appliances",
      placement: "appliance",
      height: 36,
      applianceRole: "base-height",
    });
    // Standing IN the gap (2" each side): the top covers the opening as one piece.
    expect(spans([base("a", 0, 24), range(26), base("c", 58, 24)])).toEqual([{ start: 0, end: 82 }]);
    // Flush against the cabinets: that body occupies the floor where a
    // counter-bearing cabinet would be, so the run ends at it.
    expect(spans([base("a", 0, 24), range(24), base("c", 54, 27)])).toEqual([
      { start: 0, end: 24 },
      { start: 54, end: 81 },
    ]);
    // With the range gone the opening is empty floor and the top splits.
    expect(spans([base("a", 0, 24), base("c", 54, 27)])).toEqual([
      { start: 0, end: 24 },
      { start: 54, end: 81 },
    ]);
  });

  it("ends the top at a fridge bay rather than bridging it, and never over a tall pantry", () => {
    const fridge = base("fridge", 84, 36, {
      masterCode: "FRIDGE-36",
      description: "Refrigerator 36",
      category: "Appliances",
      subCategory: "Appliances",
      placement: "appliance",
      applianceRole: "freestanding",
    });
    const pantry = base("pantry", 30, 24, {
      masterCode: "TC2484",
      description: "24x84 Tall Pantry",
      placement: "tall",
      height: 84,
    });
    // Pantry ends the first run; the open refrigerator floor ends the second.
    expect(spans([base("a", 0, 30), pantry, base("c", 54, 30), fridge, base("e", 120, 24)])).toEqual([
      { start: 0, end: 30 },
      { start: 54, end: 84 },
      { start: 120, end: 144 },
    ]);
  });
});

describe("Bathroom vanities follow the same rule", () => {
  it("splits a vanity run when the middle vanity is deleted", () => {
    const vanity = (uid: string, x: number, width: number) => base(uid, x, width, {
      masterCode: "VSB30",
      description: '30" Vanity Sink Base',
      category: "Vanity",
      subCategory: "Vanity Cabinets",
      depth: 21,
    });
    const all = [vanity("v1", 0, 30), vanity("v2", 30, 30), vanity("v3", 60, 30)];
    expect(isBathroomVanityCabinet(all[1]!)).toBe(true);
    expect(spans([all[0]!, all[2]!])).toEqual([
      { start: 0, end: 30 },
      { start: 60, end: 90 },
    ]);
  });
});
