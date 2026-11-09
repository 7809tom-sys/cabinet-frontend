import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  autoDesignBaseRows,
  isStandardStraightBaseRow,
  rangeBaseCooktopFor,
  rangeBaseCooktopPromptWidth,
  rangeBaseHasCooktop,
  repairRangeBasesWithoutCooktop,
  standardBaseForRangeBase,
  standardBasePlacementForRangeBase,
} from "@/lib/rangeBaseGuard";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function catalogRow(partial: Partial<DesignCabinet> & { masterCode: string; width: number }): DesignCabinet {
  return {
    id: partial.id ?? Math.abs([...partial.masterCode].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)),
    masterCode: partial.masterCode,
    description: partial.description ?? `${partial.width}" Base Cabinet`,
    category: "Base",
    subCategory: null,
    width: String(partial.width),
    height: "34.75",
    depth: "24",
    placement: "base",
    numberOfDoors: partial.numberOfDoors ?? 2,
    numberOfDrawers: partial.numberOfDrawers ?? 1,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    ...partial,
  } as DesignCabinet;
}

const catalog: DesignCabinet[] = [
  catalogRow({ masterCode: "B24", width: 24, numberOfDoors: 2 }),
  catalogRow({ masterCode: "B30", width: 30, numberOfDoors: 2 }),
  catalogRow({ masterCode: "B21", width: 21, numberOfDoors: 1 }),
  catalogRow({ masterCode: "RB2DB24", width: 24, numberOfDoors: 0, numberOfDrawers: 2 }),
  catalogRow({ masterCode: "RB3DB24", width: 24, numberOfDoors: 0, numberOfDrawers: 3 }),
];

function placedBase(masterCode: string, width: number, offset: number, uid = masterCode): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", room);
  return {
    uid,
    cabinetId: 1,
    masterCode,
    description: masterCode,
    category: "Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.75,
    numberOfDoors: 0,
    numberOfDrawers: 2,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

function rangeTopOn(base: PlacedCabinet): PlacedCabinet {
  return {
    uid: `${base.uid}:cooktop`,
    cabinetId: 0,
    masterCode: "CATALOG-APPLIANCE-gas",
    description: "Gas range top",
    category: "Appliance",
    placement: "appliance",
    applianceRole: "countertop-opening",
    x: base.x,
    y: base.y,
    width: base.width,
    depth: base.depth,
    height: 1.5,
    rotation: base.rotation,
    wallId: base.wallId,
    wallOffset: base.wallOffset,
  };
}

describe("range base guard (issue #354 items 2 and 5)", () => {
  it("keeps the RB family out of the Auto-Design straight-base pool", () => {
    const pool = autoDesignBaseRows(catalog);
    expect(pool.map((row) => row.masterCode)).toEqual(["B24", "B30", "B21"]);
    expect(isStandardStraightBaseRow(catalog.find((row) => row.masterCode === "RB3DB24")!)).toBe(false);
    expect(isStandardStraightBaseRow(catalog.find((row) => row.masterCode === "B24")!)).toBe(true);
  });

  it("substitutes the standard base of the same width", () => {
    expect(standardBaseForRangeBase({ masterCode: "RB3DB24", width: 24 }, catalog)?.masterCode).toBe("B24");
    expect(standardBaseForRangeBase({ masterCode: "RB2DB30" }, catalog)?.masterCode).toBe("B30");
    // A stale width field never wins over the code's own width.
    expect(standardBaseForRangeBase({ masterCode: "RB3DB24", width: 30 }, catalog)?.masterCode).toBe("B24");
    expect(standardBaseForRangeBase({ masterCode: "RB2DB36" }, catalog)).toBeNull();
  });

  it("keeps the uid and the plan spot when it swaps the box", () => {
    const base = placedBase("RB3DB24", 24, 48);
    const replacement = standardBasePlacementForRangeBase({ rangeBase: base, catalog })!;
    expect(replacement.uid).toBe(base.uid);
    expect(replacement.masterCode).toBe("B24");
    expect({ x: replacement.x, y: replacement.y }).toEqual({ x: base.x, y: base.y });
    expect(replacement.width).toBe(24);
  });

  it("recognises the range top seated on the base's own uid", () => {
    const base = placedBase("RB3DB24", 24, 0);
    const rangeTop = rangeTopOn(base);
    expect(rangeBaseCooktopFor(base, [base, rangeTop], room)?.uid).toBe("RB3DB24:cooktop");
    expect(rangeBaseHasCooktop(base, [base, rangeTop], room)).toBe(true);
    expect(rangeBaseHasCooktop(base, [base], room)).toBe(false);
  });

  it("never accepts a freestanding range or a plain cabinet as the range top", () => {
    const base = placedBase("RB3DB24", 24, 0);
    const range: PlacedCabinet = {
      ...placedBase("RANGE-30", 30, 0, "range"),
      placement: "appliance",
      applianceRole: "freestanding",
      description: "30 inch Range",
    };
    expect(rangeBaseHasCooktop(base, [base, range], room)).toBe(false);
  });

  it("asks for the range top when a range base is picked", () => {
    expect(rangeBaseCooktopPromptWidth("RB3DB24")).toBe(24);
    expect(rangeBaseCooktopPromptWidth("RB2DB36")).toBe(36);
    expect(rangeBaseCooktopPromptWidth("B24")).toBeNull();
  });

  it("repairs a saved range base with no range top on it", () => {
    const dishwasher: PlacedCabinet = {
      ...placedBase("DW-24", 24, 60, "dw"),
      placement: "appliance",
      description: "Dishwasher",
    };
    const range: PlacedCabinet = {
      ...placedBase("RANGE-30", 30, 84, "range"),
      placement: "appliance",
      applianceRole: "freestanding",
      description: "Freestanding range",
    };
    const stray = placedBase("RB3DB24", 24, 36, "stray");
    const repair = repairRangeBasesWithoutCooktop({ placed: [stray, dishwasher, range], room, catalog });
    expect(repair.replacements).toEqual([{ uid: "stray", from: "RB3DB24", to: "B24" }]);
    expect(repair.placed.find((item) => item.uid === "stray")?.masterCode).toBe("B24");
  });

  it("keeps a range base that really has a range top", () => {
    const base = placedBase("RB3DB24", 24, 36);
    const repair = repairRangeBasesWithoutCooktop({ placed: [base, rangeTopOn(base)], room, catalog });
    expect(repair.replacements).toEqual([]);
    expect(repair.placed).toBe(repair.placed);
    expect(repair.placed[0]?.masterCode).toBe("RB3DB24");
  });
});
