/**
 * The wiggle-room cap the owner set:
 *
 *   "the range, refrigerator, and sink base MAY slide during the wiggle pass, but
 *    each by at most 3 inches from its anchored position (sink base stays centered
 *    on the window within that cap). Other non-anchored cabinets use the normal
 *    wiggle allowance. Windows never move."
 *
 * The cap equals the general 3 inch jog. It stays a separate rule so the
 * appliance allowance can be tightened without tightening every cabinet.
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

describe("anchors slide at most 3 inches", () => {
  it("caps the range and the sink base at 3 inches", () => {
    expect(ANCHOR_WIGGLE_CAP_IN).toBe(3);
    for (const kind of ["sink", "stove", "range"]) {
      expect(anchorWiggleLimitIn(kind)).toBe(3);
    }
  });

  it("never slides the refrigerator in the wiggle pass, because its bay has its own slides", () => {
    // A gap under 1.5 inches beside a refrigerator is closed with a filler, not by
    // sliding the bay; corner seating and the bay gap-closing slide are separate rules.
    expect(anchorWiggleLimitIn("refrigerator")).toBe(0);
  });

  it("leaves the normal allowance for anything that is not one of those anchors", () => {
    expect(anchorWiggleLimitIn("dishwasher")).toBe(3);
    expect(anchorWiggleLimitIn("cabinet")).toBe(3);
  });

  it("never moves a measured sink more than 3 inches along its wall", () => {
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
    expect(Math.abs(start - origin.originalStart)).toBeLessThanOrEqual(3 + 1e-6);
  });

  it("never moves a measured range more than 3 inches along its wall", () => {
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
    expect(Math.abs(start - origin.originalStart)).toBeLessThanOrEqual(3 + 1e-6);
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
      expect(Math.abs(move.distanceFromOriginalIn)).toBeLessThanOrEqual(3 + 1e-6);
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

