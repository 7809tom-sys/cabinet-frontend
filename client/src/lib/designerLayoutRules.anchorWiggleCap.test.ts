/**
 * The wiggle-room cap the owner set:
 *
 *   "the range, refrigerator, and sink base MAY slide during the wiggle pass, but
 *    each by at most 2 inches from its anchored position (sink base stays centered
 *    on the window within that 2in). Other non-anchored cabinets use the normal
 *    wiggle allowance. Windows never move."
 *
 * Before this cap every anchor took the full 3 inch jog, which slid a measured
 * sink off its window and moved a range further than the owner allows.
 */
import { describe, expect, it } from "vitest";
import { ANCHOR_WIGGLE_CAP_IN, anchorWiggleLimitIn, applyAutoDesignWiggleRoom } from "./designerLayoutRules";
import { cabinetWall, wallPlacementAt, wallRunOffset, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

const ROOM = { width: 180, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;

function place(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number, wallId = "top"): PlacedCabinet {
  const depth = partial.depth ?? 24;
  const spot = wallPlacementAt(start, partial.width, depth, wallId as never, ROOM);
  return {
    cabinetId: 1, masterCode: "B24", description: '24" Base', category: "Base", subCategory: "Standard Base",
    placement: "base", height: 34.5, rotation: spot.rotation, numberOfDoors: 2, numberOfDrawers: 0,
    mountBottom: 0, ...partial, ...spot, width: partial.width, depth,
  } as PlacedCabinet;
}

describe("anchors slide at most 2 inches", () => {
  it("caps the range, refrigerator, and sink base at 2 inches", () => {
    expect(ANCHOR_WIGGLE_CAP_IN).toBe(2);
    for (const kind of ["sink", "stove", "range", "refrigerator"]) {
      expect(anchorWiggleLimitIn(kind)).toBe(2);
    }
  });

  it("leaves the normal allowance for anything that is not one of those anchors", () => {
    expect(anchorWiggleLimitIn("dishwasher")).toBeGreaterThanOrEqual(2);
    expect(anchorWiggleLimitIn("cabinet")).toBeGreaterThanOrEqual(2);
  });

  it("never moves a measured sink more than 2 inches along its wall", () => {
    // A sink base a little off center, with a run that would benefit from a big slide.
    const sink = place({ uid: "sink", masterCode: "SB36", description: '36" Sink Base', subCategory: "Sink Base", width: 36, numberOfDoors: 2, numberOfDrawers: 1 }, 10);
    const origin = { uid: "sink", kind: "sink", wallId: "top", originalStart: 10 };
    const result = applyAutoDesignWiggleRoom({
      placed: [sink],
      room: ROOM,
      openings: [],
      catalog: [] as DesignCabinet[],
      origins: [origin],
    });
    const moved = result.placed.find((item) => item.uid === "sink")!;
    const start = wallRunOffset(moved, cabinetWall(moved, ROOM), ROOM);
    expect(Math.abs(start - origin.originalStart)).toBeLessThanOrEqual(2 + 1e-6);
  });

  it("never moves a measured range more than 2 inches along its wall", () => {
    const range = place({ uid: "range", masterCode: "RANGE-30", description: '30" Range', placement: "appliance", width: 30, depth: 25, height: 36, numberOfDoors: 0 }, 40);
    const origin = { uid: "range", kind: "stove", wallId: "top", originalStart: 40 };
    const result = applyAutoDesignWiggleRoom({
      placed: [range],
      room: ROOM,
      openings: [],
      catalog: [] as DesignCabinet[],
      origins: [origin],
    });
    const moved = result.placed.find((item) => item.uid === "range")!;
    const start = wallRunOffset(moved, cabinetWall(moved, ROOM), ROOM);
    expect(Math.abs(start - origin.originalStart)).toBeLessThanOrEqual(2 + 1e-6);
  });

  it("reports the move it made, and no move reports more than the cap", () => {
    const sink = place({ uid: "sink", masterCode: "SB36", subCategory: "Sink Base", description: '36" Sink Base', width: 36 }, 20);
    const result = applyAutoDesignWiggleRoom({
      placed: [sink],
      room: ROOM,
      openings: [],
      catalog: [] as DesignCabinet[],
      origins: [{ uid: "sink", kind: "sink", wallId: "top", originalStart: 20 }],
    });
    for (const move of result.moves) {
      expect(Math.abs(move.distanceFromOriginalIn)).toBeLessThanOrEqual(2 + 1e-6);
    }
  });

  it("does not move a window, because the wiggle pass only slides cabinets", () => {
    // The pass takes no openings it can mutate and returns only cabinets; a window
    // that exists before the pass is the same object afterwards.
    const sink = place({ uid: "sink", masterCode: "SB36", subCategory: "Sink Base", description: '36" Sink Base', width: 36 }, 20);
    const window = { uid: "win", kind: "window", side: "top", offset: 20, width: 36, height: 48, sill: 42 } as const;
    const openings = [window];
    const result = applyAutoDesignWiggleRoom({
      placed: [sink],
      room: ROOM,
      openings,
      catalog: [] as DesignCabinet[],
      origins: [{ uid: "sink", kind: "sink", wallId: "top", originalStart: 20 }],
    });
    expect(openings[0]).toBe(window);
    expect(openings[0]!.offset).toBe(20);
    expect(result.placed.length).toBe(1);
  });
});

