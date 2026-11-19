/**
 * Group move (Tom, voice, Nov 19 2026, 7:29 AM CT): range + MW-30 + W3012 bridge move as one.
 */
import { describe, expect, it } from "vitest";
import { shouldBlockPlacementCollision, wallRunOffset, type PlacedCabinet, type RoomData } from "./design";
import { cabinetStackFor, fillerInsideOpenedGap, planGroupWallMove, toggleGroupMember } from "./cabinetGroupMove";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const item = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], x: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
  uid, cabinetId: 1, masterCode, description: masterCode, placement, x, y: 0, width,
  depth: placement === "wall" ? 12 : placement === "appliance" ? 25 : 24,
  height: placement === "wall" ? 12 : 34.5, rotation: 0, wallId: "top", wallOffset: x, mountBottom: 0, ...extra,
});
const plan = (): PlacedCabinet[] => [
  item("b24", "B24", "base", 30, 24),
  item("range", "RANGE-30", "appliance", 57, 30),
  item("mw", "MW-30", "appliance", 57, 30, { depth: 15, height: 16, mountBottom: 56 }),
  item("bridge", "W3012", "wall", 57, 30, { mountBottom: 72, overRangeMicrowaveBridge: true, subCategory: "Standard Wall" }),
  item("db", "3DB18", "base", 90, 18),
  item("w24", "W2430", "wall", 30, 24, { height: 30, mountBottom: 54 }),
];

describe("select stack", () => {
  it("picking the range, the microwave or the bridge selects all three", () => {
    for (const uid of ["range", "mw", "bridge"]) expect(new Set(cabinetStackFor(plan(), room, uid))).toEqual(new Set(["range", "mw", "bridge"]));
  });
  it("shift-click toggles a member", () => {
    expect(toggleGroupMember(["range"], "mw")).toEqual(["range", "mw"]);
    expect(toggleGroupMember(["range", "mw"], "mw")).toEqual(["range"]);
  });
});

describe("planGroupWallMove", () => {
  it("today a lone range move is blocked by its own microwave; the group moves together", () => {
    const placed = plan();
    const range = placed.find((p) => p.uid === "range")!;
    const others = placed.filter((p) => p.uid !== "range");
    // The single-item path: range moved 3 in still overlaps the (unmoved) MW above it.
    expect(shouldBlockPlacementCollision({ ...range, x: 60, wallOffset: 60 }, others, false, room)).toBe(true);
    const moved = planGroupWallMove({ placed, room, uids: ["range", "mw", "bridge"], deltaAlongIn: 3 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    for (const uid of ["range", "mw", "bridge"]) expect(wallRunOffset(moved.placed.find((p) => p.uid === uid)!, "top", room)).toBeCloseTo(60, 2);
    expect(wallRunOffset(moved.placed.find((p) => p.uid === "b24")!, "top", room)).toBeCloseTo(30, 2);
    expect(moved.openedGaps).toEqual(expect.arrayContaining([expect.objectContaining({ layer: "base", start: 57, end: 60 })]));
  });

  it("the combined group still cannot overlap a non-member", () => {
    const moved = planGroupWallMove({ placed: plan(), room, uids: ["range", "mw", "bridge"], deltaAlongIn: 6 });
    expect(moved.ok).toBe(false);
  });

  it("clamps the whole group at the wall run end", () => {
    const placed = plan().filter((p) => p.uid !== "db");
    const moved = planGroupWallMove({ placed, room, uids: ["range", "mw", "bridge"], deltaAlongIn: 100 });
    expect(moved.ok && moved.clamped && moved.appliedDeltaIn).toBeCloseTo(144 - 87, 2);
  });

  it("a locked member or a seated corner refuses the move", () => {
    const locked = plan().map((p) => (p.uid === "mw" ? { ...p, locked: true } : p));
    expect(planGroupWallMove({ placed: locked, room, uids: ["range", "mw", "bridge"], deltaAlongIn: 2 }).ok).toBe(false);
    const withCorner = [...plan(), item("erb", "ERB36", "base", 108, 36, { cornerType: "lazy-susan" as never })];
    const result = planGroupWallMove({ placed: withCorner, room, uids: ["db", "erb"], deltaAlongIn: -2 });
    expect(result.ok).toBe(false);
  });

  it("a seam filler the repair would add inside the opened gap is held back", () => {
    const moved = planGroupWallMove({ placed: plan(), room, uids: ["range", "mw", "bridge"], deltaAlongIn: 3 });
    if (!moved.ok) throw new Error(moved.reason);
    const respawn = item("fill", "F342", "base", 57, 3, { category: "Filler", subCategory: "Filler", fillerPieceGroupId: "adjoining-filler-b24-end" });
    expect(fillerInsideOpenedGap(respawn, moved.openedGaps, room)).toBe(true);
  });
});
