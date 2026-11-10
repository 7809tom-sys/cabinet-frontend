import { describe, expect, it } from "vitest";
import type { PlacedFurniture } from "./design";
import {
  applyShowerMove,
  clampShowerMove,
  isShowerPart,
  moveShowerGroup,
  showerFitsRoom,
  showerGroupBox,
  showerGroupMembers,
} from "./showerGroupMove";

/**
 * Moving a whole shower as one unit.
 *
 * A shower is five separate placements (surround, pan, valve/head, niche, door)
 * that all carry a `showerStepId`. Tom asked to move the finished shower in one
 * step, keeping every part aligned and inside the room, without changing the
 * cart or the price.
 */

const room = { width: 120, depth: 96 };

function part(overrides: Partial<PlacedFurniture> & { uid: string }): PlacedFurniture {
  return {
    defId: "pelican-shower-pan-pl-smc6036c",
    x: 0,
    y: 0,
    rotation: 0,
    ...overrides,
  } as PlacedFurniture;
}

/** A 60x36 shower against the back wall, as the wizard places it. */
function builtShower(): PlacedFurniture[] {
  return [
    part({ uid: "pan", showerStepId: "pan", x: 30, y: 0, width: 60, depth: 36 }),
    part({ uid: "surround", showerStepId: "surround", x: 30, y: 0, width: 60, depth: 30 }),
    part({ uid: "head", showerStepId: "heads", x: 55, y: 0, width: 8, depth: 8 }),
    part({ uid: "niche", showerStepId: "niche", x: 45, y: 0, width: 16, depth: 4 }),
    part({ uid: "door", showerStepId: "door", x: 30, y: 30, width: 60, depth: 1 }),
  ];
}

describe("shower group membership", () => {
  it("treats every wizard-placed part as the shower", () => {
    const furniture = [
      ...builtShower(),
      // A vanity is not part of the shower, and neither is a bare table.
      part({ uid: "vanity", defId: "vanity-36", x: 0, y: 60 }),
    ];
    const members = showerGroupMembers(furniture, "pan");
    expect(members.map((member) => member.uid).sort()).toEqual(["door", "head", "niche", "pan", "surround"]);
    expect(members.some((member) => member.uid === "vanity")).toBe(false);
  });

  it("selects the whole group from ANY of its parts, not just the pan", () => {
    const furniture = builtShower();
    for (const uid of ["pan", "surround", "head", "niche", "door"]) {
      expect(showerGroupMembers(furniture, uid)).toHaveLength(5);
    }
  });

  it("selects nothing when the object is not a shower part", () => {
    const furniture = [...builtShower(), part({ uid: "vanity", defId: "vanity-36" })];
    expect(showerGroupMembers(furniture, "vanity")).toEqual([]);
    expect(showerGroupMembers(furniture, null)).toEqual([]);
    expect(isShowerPart({ uid: "x" })).toBe(false);
  });
});

describe("moving the group", () => {
  it("moves every part by the same delta, so they stay aligned", () => {
    const furniture = builtShower();
    const moved = moveShowerGroup(furniture, ["pan", "surround", "head", "niche", "door"], 12, 6);
    const byUid = new Map(moved.map((item) => [item.uid, item]));
    expect(byUid.get("pan")).toMatchObject({ x: 42, y: 6 });
    expect(byUid.get("surround")).toMatchObject({ x: 42, y: 6 });
    expect(byUid.get("head")).toMatchObject({ x: 67, y: 6 });
    // The door keeps its 30" offset from the pan: the group did not deform.
    expect(byUid.get("door")).toMatchObject({ x: 42, y: 36 });
  });

  it("does not touch anything outside the group", () => {
    const furniture = [...builtShower(), part({ uid: "vanity", defId: "vanity-36", x: 0, y: 60 })];
    const moved = moveShowerGroup(furniture, ["pan", "surround"], 12, 0);
    const vanity = moved.find((item) => item.uid === "vanity")!;
    expect(vanity.x).toBe(0);
    expect(vanity.y).toBe(60);
  });

  it("changes nothing but coordinates, so the cart and price cannot move", () => {
    const furniture = builtShower().map((item) => ({ ...item, pelicanProductId: 42, pelicanSellPrice: 500, showerStepId: item.showerStepId }));
    const moved = moveShowerGroup(furniture, furniture.map((item) => item.uid), 10, 10);
    for (let index = 0; index < furniture.length; index += 1) {
      const before = furniture[index]!;
      const after = moved[index]!;
      expect(after.uid).toBe(before.uid);
      expect(after.pelicanProductId).toBe(before.pelicanProductId);
      expect(after.pelicanSellPrice).toBe(before.pelicanSellPrice);
      expect(after.showerStepId).toBe(before.showerStepId);
      expect(after.defId).toBe(before.defId);
      expect(after.rotation).toBe(before.rotation);
    }
  });

  it("keeps untouched parts identical by reference", () => {
    const furniture = [...builtShower(), part({ uid: "vanity", defId: "vanity-36" })];
    const moved = moveShowerGroup(furniture, ["pan"], 5, 0);
    expect(moved.find((item) => item.uid === "vanity")).toBe(furniture.find((item) => item.uid === "vanity"));
  });
});

describe("staying inside the room walls", () => {
  it("measures the group's own box", () => {
    const box = showerGroupBox(showerGroupMembers(builtShower(), "pan"))!;
    expect(box).toMatchObject({ minX: 30, minY: 0, maxX: 90, maxY: 36 });
  });

  it("stops a move into the right wall at the wall, not past it", () => {
    const room120 = { width: 120, depth: 96 };
    const result = applyShowerMove(builtShower(), "pan", 100, 0, room120);
    // The box's right edge starts at 90, so at most 30" of the 100" requested fits.
    expect(result.dx).toBe(30);
    const box = showerGroupBox(result.furniture.filter((item) => item.showerStepId))!;
    expect(box.maxX).toBeCloseTo(120, 3);
  });

  it("slides along a wall instead of stopping dead in a corner", () => {
    const furniture = builtShower();
    // Ask to move right AND up while already against the back wall: the up part
    // is refused, but the sideways part still happens.
    const result = applyShowerMove(furniture, "pan", 10, -10, room);
    expect(result.dx).toBe(10);
    expect(result.dy).toBeCloseTo(0, 6);
    expect(result.moved).toBe(true);
  });

  it("refuses a move that would leave the room and reports nothing moved", () => {
    const furniture = builtShower();
    const againstWall = applyShowerMove(furniture, "pan", 30, 0, room); // now flush right
    const again = applyShowerMove(againstWall.furniture, "pan", 10, 0, room);
    expect(again.moved).toBe(false);
    expect(again.dx).toBe(0);
    expect(again.furniture).toBe(againstWall.furniture);
  });

  it("clamps both axes independently", () => {
    const box = { uids: ["a"], minX: 10, minY: 5, maxX: 110, maxY: 90 };
    expect(clampShowerMove(box, 50, 50, room)).toEqual({ dx: 10, dy: 6 });
    expect(clampShowerMove(box, -50, -50, room)).toEqual({ dx: -10, dy: -5 });
  });

  it("reports whether the shower still fits its room", () => {
    expect(showerFitsRoom(showerGroupMembers(builtShower(), "pan"), room)).toBe(true);
    const tooSmall = { width: 40, depth: 40 };
    expect(showerFitsRoom(showerGroupMembers(builtShower(), "pan"), tooSmall)).toBe(false);
  });

  it("moves nothing when the object is not part of a shower", () => {
    const furniture = [part({ uid: "vanity", defId: "vanity-36" })];
    const result = applyShowerMove(furniture, "vanity", 10, 0, room);
    expect(result.moved).toBe(false);
    expect(result.furniture).toBe(furniture);
  });
});
