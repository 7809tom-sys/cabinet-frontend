import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData } from "@/lib/design";
import { attachedFillerNeedsReview, attachedFillerPlanForCandidate } from "./cabinetAttachedFillers";

const room: RoomData = { ...DEFAULT_ROOM, width: 120, depth: 120 };

function cabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cabinet",
    cabinetId: 1,
    masterCode: "B24",
    description: "Base cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  };
}

describe("attached cabinet fillers", () => {
  it("plans a B24 with a 1/2-inch left field cut against the wall", () => {
    const b24 = cabinet({ uid: "b24", masterCode: "B24", x: 0, y: 0, width: 24 });
    const plan = attachedFillerPlanForCandidate(b24, [], room, { leftIn: 0.5, rightIn: 0 });
    expect(plan).toMatchObject({ leftAllowed: true, cabinetStartIn: 0.5 });
    expect(plan?.pieces).toEqual([{ side: "left", startIn: 0, widthIn: 0.5 }]);
  });

  it("plans independent 1 1/2-inch W3030 cuts on both bounded sides", () => {
    const left = cabinet({ uid: "left", masterCode: "W2430", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30 });
    const target = cabinet({ uid: "w3030", masterCode: "W3030", placement: "wall", x: 24, y: 0, width: 30, depth: 12, height: 30 });
    const right = cabinet({ uid: "right", masterCode: "W2430", placement: "wall", x: 57, y: 0, width: 24, depth: 12, height: 30 });
    const plan = attachedFillerPlanForCandidate(target, [left, right], room, { leftIn: 1.5, rightIn: 1.5 });
    expect(plan).toMatchObject({ leftAllowed: true, rightAllowed: true, cabinetStartIn: 25.5 });
    expect(plan?.pieces).toEqual([
      { side: "left", startIn: 24, widthIn: 1.5 },
      { side: "right", startIn: 55.5, widthIn: 1.5 },
    ]);
  });

  it("uses the pantry's full tall placement band for a wall-side 1 1/2-inch cut", () => {
    const pantry = cabinet({ uid: "pantry", masterCode: "P2496", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 96 });
    const plan = attachedFillerPlanForCandidate(pantry, [], room, { leftIn: 1.5, rightIn: 0 });
    expect(plan).toMatchObject({ placement: "tall", cabinetStartIn: 1.5 });
    expect(plan?.pieces[0]).toEqual({ side: "left", startIn: 0, widthIn: 1.5 });
  });

  it("allows a B18 1-inch filler between it and a refrigerator panel", () => {
    const panel = cabinet({ uid: "fridge-panel", masterCode: "REPV-96", description: "Refrigerator end panel", placement: "tall", x: 0, y: 0, width: 0.75, depth: 24, height: 96 });
    const b18 = cabinet({ uid: "b18", masterCode: "B18", x: 0.75, y: 0, width: 18 });
    const plan = attachedFillerPlanForCandidate(b18, [panel], room, { leftIn: 1, rightIn: 0 });
    expect(plan).toMatchObject({ leftAllowed: true, cabinetStartIn: 1.75 });
    expect(plan?.pieces[0]).toEqual({ side: "left", startIn: 0.75, widthIn: 1 });
  });

  it("does not offer a filler on an unbounded exposed end", () => {
    const endCabinet = cabinet({ uid: "end", masterCode: "BEC24", x: 48, y: 0, width: 24 });
    const plan = attachedFillerPlanForCandidate(endCabinet, [], room);
    expect(plan).toMatchObject({ leftAllowed: false, rightAllowed: false });
    // A far room endpoint cannot turn a cabinet across a large open run into a
    // filler candidate. Only a six-inch-or-less wall/cabinet seam is eligible.
    const openEndedRoom: RoomData = {
      ...room,
      customWalls: [{ id: "wall-open", label: "Open run", start: { x: 0, y: 0 }, end: { x: 96, y: 0 } }],
    } as RoomData;
    const openEnd = cabinet({ uid: "open-end", masterCode: "BEC24", wallId: "wall-open", wallOffset: 72, x: 72, y: 0, width: 24 });
    expect(attachedFillerPlanForCandidate(openEnd, [], openEndedRoom, { leftIn: 0, rightIn: 1 })).toBeNull();
  });

  it("flags an attached filler instead of deleting it when the adjoining cabinet disappears", () => {
    const owner = cabinet({ uid: "owner", masterCode: "B24", x: 24, y: 0, width: 24 });
    const attached = cabinet({
      uid: "attached", masterCode: "BF3", placement: "base", x: 48, y: 0, width: 1, depth: 24,
      fillerForCabinetUid: owner.uid,
      fillerAttachmentSide: "right",
    } as Partial<PlacedCabinet> & { fillerAttachmentSide: "right" });
    expect(attachedFillerNeedsReview(attached as PlacedCabinet & { fillerAttachmentSide: "right" }, [owner, attached], room)).toBe(true);
    const neighbor = cabinet({ uid: "neighbor", masterCode: "B24", x: 49, y: 0, width: 24 });
    expect(attachedFillerNeedsReview(attached as PlacedCabinet & { fillerAttachmentSide: "right" }, [owner, attached, neighbor], room)).toBe(false);
  });
});
