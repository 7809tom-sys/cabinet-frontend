/**
 * Deleted fillers stay deleted (Tom, voice, Nov 19 2026, 7:36 AM CT).
 */
import { describe, expect, it } from "vitest";
import type { PlacedCabinet, RoomData } from "./design";
import { repairMissingAdjoiningFillers } from "./smallGapFiller";
import {
  deletedFillerRecords, dropResurrectedFillers, isSuppressedFiller, isSuppressedSeam, mergeDeletedFillerRecords, suppressedFillerGroupIds,
} from "./deletedFillerMemory";
import { buildMaterialsListRows } from "./designMaterialsList";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const filler3 = { id: 88, masterCode: "F342", description: '3" filler', category: "Filler", subCategory: "Filler", width: "3", height: "42", depth: "0.75", catalogImageUrl: null };
const filler6 = { ...filler3, id: 89, masterCode: "F642", description: '6" filler', width: "6" };
const box = (uid: string, placement: "base" | "wall", x: number, width: number): PlacedCabinet => ({
  uid, cabinetId: 1, masterCode: placement === "wall" ? "W2430" : "B24", description: placement === "wall" ? "Wall" : "Base", placement,
  x, y: 0, width, depth: placement === "wall" ? 12 : 24, height: placement === "wall" ? 30 : 34.5,
  rotation: 0, wallId: "top", wallOffset: x, mountBottom: placement === "wall" ? 54 : 0, numberOfDoors: 2, numberOfDrawers: 0,
});

describe("a deleted seam filler is never rebuilt", () => {
  const plan = [box("b1", "base", 12, 24), box("b2", "base", 40, 24)];
  let n = 0;
  const first = repairMissingAdjoiningFillers(plan, room, [], [filler3, filler6], () => `fill-${++n}`, 7);
  const filler = first.added[0]!;

  it("today's repair closes the 4 in seam (the board the person then deletes)", () => {
    expect(first.added).toHaveLength(1);
    expect(filler.fillerPieceGroupId).toMatch(/^adjoining-filler-/);
  });

  it("after the person deletes it, the repair skips it by group id and by seam (either neighbor)", () => {
    const records = deletedFillerRecords([filler], room);
    expect(records).toEqual([expect.objectContaining({ groupId: filler.fillerPieceGroupId, wallId: "top", layer: "base", start: 36, end: 40 })]);
    const afterDelete = first.placed.filter((item) => item.uid !== filler.uid);
    const again = repairMissingAdjoiningFillers(afterDelete, room, [], [filler3, filler6], () => `again-${++n}`, 7, {
      suppressGroupIds: suppressedFillerGroupIds(records),
      suppress: (draft) => isSuppressedFiller(draft, records, room),
    });
    expect(again.added).toEqual([]);
    // Without the memory (the old behavior) it comes right back.
    expect(repairMissingAdjoiningFillers(afterDelete, room, [], [filler3, filler6], () => `old-${++n}`, 7).added).toHaveLength(1);
  });

  it("only that seam is held: a different seam still gets its filler", () => {
    const records = deletedFillerRecords([filler], room);
    const wider = [...first.placed.filter((item) => item.uid !== filler.uid), box("b3", "base", 68, 24)];
    const again = repairMissingAdjoiningFillers(wider, room, [], [filler3, filler6], () => `x-${++n}`, 7, {
      suppressGroupIds: suppressedFillerGroupIds(records),
      suppress: (draft) => isSuppressedFiller(draft, records, room),
    });
    expect(again.added).toHaveLength(1);
    expect(again.added[0]!.x).toBeCloseTo(64, 2);
  });

  it("frameless/angled repairs: a re-added board on a deleted seam is dropped; nothing else is touched", () => {
    const records = deletedFillerRecords([filler], room);
    const resurrected = { ...filler, uid: "new-uid", fillerPieceGroupId: "filler-group-new-uid" };
    const after = [...plan, resurrected];
    expect(dropResurrectedFillers(plan, after, records, room)).toEqual(plan);
    expect(isSuppressedSeam({ wallId: "top", layer: "base", start: 39, end: 41 }, records)).toBe(true);
    expect(isSuppressedSeam({ wallId: "top", layer: "wall", start: 39, end: 41 }, records)).toBe(false);
  });

  it("cabinets are not remembered and the memory de-duplicates", () => {
    expect(deletedFillerRecords([box("b9", "base", 0, 24)], room)).toEqual([]);
    const records = deletedFillerRecords([filler], room);
    expect(mergeDeletedFillerRecords(records, records)).toHaveLength(1);
  });
});

describe("Materials & Parts can delete any filler row", () => {
  it("a filler priced only as a cart line still points at its placed boards", () => {
    const rows = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [{ masterCode: "F342", name: "3 in filler", qty: 1, unitPrice: 20, category: "Filler" } as never],
      fillerSourceUidsByCode: new Map([["F342", ["f-1", "f-2"]]]),
    });
    expect(rows.find((row) => row.code === "F342")?.sourceUids).toEqual(["f-1", "f-2"]);
  });
});
