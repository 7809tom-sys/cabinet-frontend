import { describe, expect, it } from "vitest";
import {
  designerFillerDeletionSet,
  designerFillerOffset,
  isDesignerPlacedFiller,
  moveDesignerFiller,
  planHasMovableDesignerFillers,
} from "./designerFillerActions";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "./design";

function filler(uid: string, start: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(start, 3, 24, "bottom", DEFAULT_ROOM);
  return {
    uid,
    cabinetId: 90,
    masterCode: "BF3",
    description: "3 inch base filler",
    category: "Filler",
    subCategory: "Filler",
    placement: "base",
    ...spot,
    width: 3,
    depth: 24,
    height: 84,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fillerPieceGroupId: "group-1",
    fillerTotalWidth: 6,
    fillerContinuousVertical: true,
    ...extra,
  } as PlacedCabinet;
}

describe("rule 13: Designer fillers can be deleted and moved", () => {
  it("recognises a Designer-placed filler", () => {
    expect(isDesignerPlacedFiller(filler("f1", 10))).toBe(true);
    const plain = { ...filler("f2", 20), fillerPieceGroupId: null, fillerTotalWidth: null, fillerContinuousVertical: null } as PlacedCabinet;
    expect(isDesignerPlacedFiller(plain)).toBe(false);
  });

  it("deleting one piece removes every board cut from the same purchase", () => {
    const plan = [filler("f1", 10, { fillerBillingRole: "primary" }), filler("f2", 13, { fillerBillingRole: "secondary" })];
    expect(designerFillerDeletionSet(plan, "f1").sort()).toEqual(["f1", "f2"]);
  });

  it("deleting a single-piece group removes only that board", () => {
    const plan = [filler("f1", 10, { fillerPieceGroupId: "solo" }), filler("f2", 20, { fillerPieceGroupId: "other" })];
    expect(designerFillerDeletionSet(plan, "f1")).toEqual(["f1"]);
  });

  it("moves a Designer filler along its wall and keeps its identity", () => {
    const plan = [filler("f1", 10)];
    const result = moveDesignerFiller({ placed: plan, uid: "f1", requestedOffsetIn: 30, room: DEFAULT_ROOM });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.placed.find((item) => item.uid === "f1")!;
    expect(designerFillerOffset(moved, DEFAULT_ROOM)).toBeCloseTo(30, 5);
    expect(moved.width).toBe(3);
    expect(moved.fillerPieceGroupId).toBe("group-1");
    expect(moved.fillerContinuousVertical).toBe(true);
  });

  it("refuses to move a locked filler and names why", () => {
    const plan = [filler("f1", 10, { locked: true })];
    const result = moveDesignerFiller({ placed: plan, uid: "f1", requestedOffsetIn: 30, room: DEFAULT_ROOM });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/locked/i);
  });

  it("reports whether the plan holds any movable Designer filler", () => {
    expect(planHasMovableDesignerFillers([filler("f1", 10)])).toBe(true);
    expect(planHasMovableDesignerFillers([])).toBe(false);
  });
});
