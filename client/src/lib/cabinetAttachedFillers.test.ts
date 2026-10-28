import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData } from "@/lib/design";
import { attachedFillerLeftoverOptions, attachedFillerNeedsReview, attachedFillerPlanForCandidate, attachedFillerSizeIssues, isCornerFillerCabinet } from "./cabinetAttachedFillers";
import { buildAttachedFillerPlacement } from "./cabinetAttachedFillerPlacement";
import { cabinetWall } from "@/lib/design";

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

  it("suggests no size on an open exposed end, but attaches any chosen filler to the cabinet's side", () => {
    const endCabinet = cabinet({ uid: "end", masterCode: "BEC24", x: 48, y: 0, width: 24 });
    const plan = attachedFillerPlanForCandidate(endCabinet, [], room);
    // No wall or cabinet within six inches: nothing is suggested.
    expect(plan).toMatchObject({ leftAllowed: false, rightAllowed: false });
    expect(attachedFillerLeftoverOptions(plan!)).toBeNull();
    // The user may still choose any 1/8–6 inch filler on either side. On an
    // open side it attaches to the cabinet's face and the cabinet stays put.
    const both = attachedFillerPlanForCandidate(endCabinet, [], room, { leftIn: 1.5, rightIn: 6 });
    expect(both).toMatchObject({ cabinetStartIn: 48 });
    expect(both?.pieces).toEqual([
      { side: "left", startIn: 46.5, widthIn: 1.5 },
      { side: "right", startIn: 72, widthIn: 6 },
    ]);
    expect(attachedFillerPlanForCandidate(endCabinet, [], room, { leftIn: 6.25, rightIn: 0 })).toBeNull();
  });

  it("accepts any 1/8-inch filler and moves the cabinet over against a near wall", () => {
    const b24 = cabinet({ uid: "b24", masterCode: "B24", x: 0, y: 0, width: 24 });
    expect(attachedFillerPlanForCandidate(b24, [], room, { leftIn: 0.125, rightIn: 0 })).toMatchObject({
      cabinetStartIn: 0.125,
      pieces: [{ side: "left", startIn: 0, widthIn: 0.125 }],
    });
  });

  it("refuses a filler that would cross the next cabinet", () => {
    const left = cabinet({ uid: "left", masterCode: "W2430", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30 });
    const target = cabinet({ uid: "w3030", masterCode: "W3030", placement: "wall", x: 24, y: 0, width: 30, depth: 12, height: 30 });
    const right = cabinet({ uid: "right", masterCode: "W2430", placement: "wall", x: 57, y: 0, width: 24, depth: 12, height: 30 });
    expect(attachedFillerPlanForCandidate(target, [left, right], room, { leftIn: 2, rightIn: 2 })).toBeNull();
    expect(attachedFillerPlanForCandidate(target, [left, right], room, { leftIn: 1, rightIn: 2 })).not.toBeNull();
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

describe("attached filler leftover space", () => {
  const wall = (overrides: Partial<PlacedCabinet>) => cabinet({ placement: "wall", depth: 12, height: 30, ...overrides });

  it("offers a 3-inch leftover between two cabinets as left, right, or an even split", () => {
    const left = wall({ uid: "left", masterCode: "W2430", x: 0, width: 24 });
    const target = wall({ uid: "w3030", masterCode: "W3030", x: 24, width: 30 });
    const right = wall({ uid: "right", masterCode: "W2430", x: 57, width: 24 });
    const plan = attachedFillerPlanForCandidate(target, [left, right], room);
    expect(attachedFillerLeftoverOptions(plan!)).toEqual({
      leftoverIn: 3,
      left: { leftIn: 3, rightIn: 0 },
      right: { leftIn: 0, rightIn: 3 },
      split: { leftIn: 1.5, rightIn: 1.5 },
      corner: false,
      both: null,
    });
  });

  it("splits an odd leftover so the two strips still add up exactly", () => {
    const left = wall({ uid: "left", x: 0, width: 24 });
    const target = wall({ uid: "w3030", x: 24, width: 30 });
    const right = wall({ uid: "right", x: 55.125, width: 24 });
    const options = attachedFillerLeftoverOptions(attachedFillerPlanForCandidate(target, [left, right], room)!);
    expect(options?.leftoverIn).toBe(1.125);
    expect(options?.split).toEqual({ leftIn: 0.5, rightIn: 0.625 });
  });

  it("each planned option is accepted by the filler planner", () => {
    const left = wall({ uid: "left", x: 0, width: 24 });
    const target = wall({ uid: "w3030", x: 24, width: 30 });
    const right = wall({ uid: "right", x: 57, width: 24 });
    const options = attachedFillerLeftoverOptions(attachedFillerPlanForCandidate(target, [left, right], room)!)!;
    for (const choice of [options.left, options.right, options.split]) {
      expect(attachedFillerPlanForCandidate(target, [left, right], room, choice)).not.toBeNull();
    }
  });

  it("offers the one bounded side's measured gap when the other side is open", () => {
    // A B36 dropped 1/2 inch from the wall with an open run on its right.
    const b36 = cabinet({ uid: "b36", masterCode: "B36", x: 0.5, width: 36 });
    const plan = attachedFillerPlanForCandidate(b36, [], { ...room, width: 120 })!;
    expect(plan.leftAllowed).toBe(true);
    expect(plan.rightAllowed).toBe(false);
    expect(attachedFillerLeftoverOptions(plan)).toEqual({
      leftoverIn: 0.5,
      left: { leftIn: 0.5, rightIn: 0 },
      right: null,
      split: null,
      corner: false,
      both: null,
    });
  });

  it("shows no size when the space is over 6 inches", () => {
    const left = wall({ uid: "left", x: 0, width: 24 });
    const target = wall({ uid: "w3030", x: 24, width: 30 });
    const farRight = wall({ uid: "right", x: 61, width: 24 });
    expect(attachedFillerLeftoverOptions(attachedFillerPlanForCandidate(target, [left, farRight], room)!)).toBeNull();
  });

  it("shows no leftover when the cabinet already fills the space", () => {
    const left = wall({ uid: "left", x: 0, width: 24 });
    const target = wall({ uid: "w3030", x: 24, width: 30 });
    const right = wall({ uid: "right", x: 54, width: 24 });
    expect(attachedFillerLeftoverOptions(attachedFillerPlanForCandidate(target, [left, right], room)!)).toBeNull();
  });

  it("measures to a corner cabinet on the adjoining wall, like the plan's Fits up to label", () => {
    // LSB36 sits in the top-left corner on the LEFT wall; its 36-inch leg
    // reserves the start of the top wall. A B24 dropped 1 inch past that leg
    // must be offered the 1-inch filler, not measured 37 inches to the wall.
    const lsb36 = cabinet({ uid: "lsb36", masterCode: "LSB36", description: "Lazy Susan Base", width: 36, depth: 36, x: 0, y: 0, rotation: 90 });
    const b24 = cabinet({ uid: "b24", masterCode: "B24", x: 37, y: 0 });
    const plan = attachedFillerPlanForCandidate(b24, [lsb36], room)!;
    expect(plan).toMatchObject({ leftAllowed: true, leftGapIn: 1, openingStartIn: 36 });
    expect(attachedFillerLeftoverOptions(plan)).toEqual({ leftoverIn: 1, left: { leftIn: 1, rightIn: 0 }, right: null, split: null, corner: false, both: null });
    expect(attachedFillerPlanForCandidate(b24, [lsb36], room, { leftIn: 1, rightIn: 0 })?.pieces).toEqual([{ side: "left", startIn: 36, widthIn: 1 }]);
  });
});

describe("corner cabinet fillers", () => {
  // LSB36 seated in the top-left corner; B21 is 3 inches past its top-wall leg
  // and B30 is 3 inches past its left-wall leg.
  const lsb36 = cabinet({ uid: "lsb36", masterCode: "LSB36", description: "Lazy Susan Base", width: 36, depth: 36, x: 0, y: 0 });
  const b21 = cabinet({ uid: "b21", masterCode: "B21", width: 21, x: 39, y: 0 });
  const b30 = cabinet({ uid: "b30", masterCode: "B30", width: 30, x: 0, y: 39, rotation: 90 });
  const stock = [{ id: 9, masterCode: "F330", description: "3 inch Filler", category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "0.75", catalogImageUrl: null }];

  it("recognizes only the listed corner cabinet families", () => {
    for (const code of ["LSB36", "DCSB36", "LS33", "BER36", "CDB36", "CSB42", "ERB36", "ERB-36"]) expect(isCornerFillerCabinet(code)).toBe(true);
    for (const code of ["B21", "SB36", "BBC42", "WDC2430", "L36"]) expect(isCornerFillerCabinet(code)).toBe(false);
  });

  it("offers each leg's own gap, with both fillers together instead of a split", () => {
    const plan = attachedFillerPlanForCandidate(lsb36, [b21, b30], room)!;
    expect(plan).toMatchObject({ cornerCabinet: true, leftAllowed: true, rightAllowed: true, leftGapIn: 3, rightGapIn: 3 });
    expect(attachedFillerLeftoverOptions(plan)).toEqual({
      leftoverIn: 6,
      left: { leftIn: 3, rightIn: 0 },
      right: { leftIn: 0, rightIn: 3 },
      split: null,
      corner: true,
      both: { leftIn: 3, rightIn: 3 },
    });
  });

  it("keeps the corner cabinet in the corner and puts each filler at the end of its leg", () => {
    const plan = attachedFillerPlanForCandidate(lsb36, [b21, b30], room, { leftIn: 3, rightIn: 3 })!;
    expect(plan.cabinetStartIn).toBe(0);
    expect(plan.pieces).toEqual([
      { side: "left", wall: "left", startIn: 36, widthIn: 3, attachmentSide: "right" },
      { side: "right", startIn: 36, widthIn: 3 },
    ]);
    let n = 0;
    const built = buildAttachedFillerPlacement({ cabinet: lsb36, placed: [b21, b30], room, choice: { leftIn: 3, rightIn: 3 }, catalogFillers: stock as never, makeUid: () => `u${n++}`, styleId: 1 });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect([built.cabinet.x, built.cabinet.y]).toEqual([0, 0]);
    const [legFiller, ownFiller] = built.fillers;
    expect([cabinetWall(legFiller, room), legFiller.x, legFiller.y, legFiller.width]).toEqual(["left", 0, 36, 3]);
    expect([cabinetWall(ownFiller, room), ownFiller.x, ownFiller.y, ownFiller.width]).toEqual(["top", 36, 0, 3]);
    const placedNow = [built.cabinet, b21, b30, ...built.fillers];
    for (const filler of built.fillers) expect(attachedFillerNeedsReview(filler as never, placedNow, room)).toBe(false);
  });

  it("does not let a filler wider than its leg's gap be chosen", () => {
    expect(attachedFillerPlanForCandidate(lsb36, [b21, b30], room, { leftIn: 4, rightIn: 0 })).toBeNull();
  });
});

describe("filler size warning before placement", () => {
  const wallCab = (overrides: Partial<PlacedCabinet>) => cabinet({ placement: "wall", depth: 12, height: 30, ...overrides });
  // W3030 between two uppers with 3 inches of leftover.
  const left = wallCab({ uid: "left", x: 0, width: 24 });
  const target = wallCab({ uid: "w3030", masterCode: "W3030", x: 24, width: 30 });
  const right = wallCab({ uid: "right", x: 57, width: 24 });

  it("does not warn when the fillers exactly fill the space, or when none is chosen", () => {
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 3, rightIn: 0 })).toEqual([]);
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 1.5, rightIn: 1.5 })).toEqual([]);
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 0, rightIn: 0 })).toEqual([]);
  });

  it("warns that a filler is too large for the space", () => {
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 4, rightIn: 0 })).toEqual([
      { side: "left", chosenIn: 4, spaceIn: 3, problem: "too-large" },
    ]);
  });

  it("warns that a filler is too small and names the gap left open", () => {
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 1, rightIn: 0 })).toEqual([
      { side: "right", chosenIn: 0, spaceIn: 2, problem: "too-small" },
    ]);
    expect(attachedFillerSizeIssues(target, [left, right], room, { leftIn: 1, rightIn: 1 })).toEqual([
      { side: "right", chosenIn: 1, spaceIn: 2, problem: "too-small" },
    ]);
  });

  it("never warns about an open side", () => {
    const endCabinet = cabinet({ uid: "end", masterCode: "B24", x: 48, y: 0, width: 24 });
    expect(attachedFillerSizeIssues(endCabinet, [], room, { leftIn: 1, rightIn: 2 })).toEqual([]);
  });

  it("checks each corner cabinet leg on its own", () => {
    const lsb36 = cabinet({ uid: "lsb36", masterCode: "LSB36", width: 36, depth: 36, x: 0, y: 0 });
    const b21 = cabinet({ uid: "b21", masterCode: "B21", width: 21, x: 39, y: 0 });
    const b30 = cabinet({ uid: "b30", masterCode: "B30", width: 30, x: 0, y: 39, rotation: 90 });
    expect(attachedFillerSizeIssues(lsb36, [b21, b30], room, { leftIn: 3, rightIn: 3 })).toEqual([]);
    expect(attachedFillerSizeIssues(lsb36, [b21, b30], room, { leftIn: 2, rightIn: 4 })).toEqual([
      { side: "right", chosenIn: 4, spaceIn: 3, problem: "too-large" },
    ]);
    expect(attachedFillerSizeIssues(lsb36, [b21, b30], room, { leftIn: 2, rightIn: 3 })).toEqual([
      { side: "left", chosenIn: 2, spaceIn: 3, problem: "too-small" },
    ]);
  });
});

