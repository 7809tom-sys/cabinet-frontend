/**
 * Swap offer (Tom, voice, Nov 19 2026, 7:28 AM CT): adding a 24 in drawer base where
 * the only free space is a 6 in end filler beside an 18 in base offers B18 -> 24.
 */
import { describe, expect, it } from "vitest";
import { wallRunOffset, type PlacedCabinet, type RoomData } from "./design";
import { describeFreeSpaceOnWall, planSwapForAdd } from "./cabinetSwapForAdd";

const room: RoomData = { width: 120, depth: 120, ceilingHeight: 96 };
const item = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], x: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
  uid, cabinetId: 1, masterCode, description: masterCode, placement, x, y: 0, width, depth: 24, height: 34.5,
  rotation: 0, wallId: "top", wallOffset: x, mountBottom: 0, ...extra,
});
// The 7:10 AM 10 ft wall, laid on one run: ERB36 corner, B18, SB36, DW-24, F642 at the wall end.
const wall = (): PlacedCabinet[] => [
  item("erb", "ERB36", "base", 0, 36, { cornerType: "lazy-susan" as never, subCategory: "Lazy Susan / Easy Reach" }),
  item("b18", "B18", "base", 36, 18, { subCategory: "Standard Base" }),
  item("sb", "SB36", "base", 54, 36, { subCategory: "Sink Base" }),
  item("dw", "DW-24", "appliance", 90, 24),
  item("f6", "F642", "base", 114, 6, { category: "Filler", subCategory: "Filler" }),
];

describe("refusal message names the real free inches", () => {
  it("says only 6 in are free and that it is the F642 filler", () => {
    const summary = describeFreeSpaceOnWall({ placed: wall(), room, openings: [], wallId: "top", layer: "base" });
    expect(summary.freeIn).toBeCloseTo(6, 2);
    expect(summary.text).toBe("Only 6″ free (F642 filler 6″).");
    expect(summary.largestContiguousIn).toBeCloseTo(6, 2);
  });
  it("names the largest single opening and what splits the free inches", () => {
    const split = wall().filter((p) => p.uid !== "b18");
    const summary = describeFreeSpaceOnWall({ placed: split, room, openings: [], wallId: "top", layer: "base" });
    expect(summary.freeIn).toBeCloseTo(24, 2);
    expect(summary.largestContiguousIn).toBeCloseTo(18, 2);
    expect(summary.splitBy).toEqual(["SB36", "DW-24"]);
    expect(summary.text).toBe("Only 24″ free (F642 filler 6″; 18″ open). The largest single opening is 18″; the free inches are split by SB36, DW-24.");
  });
});

describe("planSwapForAdd", () => {
  it("offers B18 -> 3DB24: the sink and dishwasher slide 6 in and the end filler is absorbed", () => {
    const plan = planSwapForAdd({ placed: wall(), room, openings: [], wallId: "top", layer: "base", newMasterCode: "3DB24", newWidthIn: 24 });
    expect(plan).not.toBeNull();
    expect(plan!.replaceCode).toBe("B18");
    expect(plan!.newStartIn).toBeCloseTo(36, 2);
    expect(plan!.removedFillerCodes).toEqual(["F642"]);
    expect(plan!.leftoverIn).toBeCloseTo(0, 2);
    expect(plan!.slid.map((entry) => [entry.masterCode, entry.deltaIn])).toEqual([["SB36", 6], ["DW-24", 6]]);
    expect(plan!.question).toMatch(/^Swap B18 for 3DB24, slide SB36 6″, DW-24 6″, absorb the 6″ F642 filler\?/);
    expect(plan!.question).toMatch(/Nothing changes unless you confirm\./);
    // Nothing is applied by planning: the original plan is untouched and the corner never moves.
    const after = plan!.placedWithoutNew;
    expect(after.some((p) => p.uid === "b18" || p.uid === "f6")).toBe(false);
    expect(wallRunOffset(after.find((p) => p.uid === "erb")!, "top", room)).toBe(0);
    expect(wallRunOffset(after.find((p) => p.uid === "sb")!, "top", room)).toBeCloseTo(60, 2);
    expect(wall().find((p) => p.uid === "b18")).toBeTruthy();
  });

  it("no swap when even the swap cannot make room", () => {
    expect(planSwapForAdd({ placed: wall(), room, openings: [], wallId: "top", layer: "base", newMasterCode: "B36", newWidthIn: 36 })).toBeNull();
  });

  it("a locked cabinet is never swapped out", () => {
    const locked = wall().map((p) => (p.uid === "b18" ? { ...p, locked: true } : p));
    expect(planSwapForAdd({ placed: locked, room, openings: [], wallId: "top", layer: "base", newMasterCode: "3DB24", newWidthIn: 24 })).toBeNull();
  });
});
