import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  DEFAULT_ROOM,
  cabinetWallDragPreview,
  placedFootprint,
  wallPlacementAt,
  wallRunCornerPlacement,
  wallRunFrame,
  type DesignCabinet,
  type PlacedCabinet,
} from "./design";
import { seatAutoDesignCorner } from "./autoDesignCornerSeating";
import { cabinetInsideBounds } from "./designerBounds";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = REAL["330011"]!.base as DesignCabinet[];
const fillers = REAL["330011"]!.accessory as never[];

/** The 42x24 corner body the owner reported: nominal 42" wide, 24" deep. */
function wideCorner(rotation = 0): PlacedCabinet {
  return {
    uid: "corner-42",
    cabinetId: 1,
    masterCode: "DCB42",
    description: '42" Diagonal Corner Base',
    category: "Base",
    subCategory: "Corner",
    placement: "base",
    x: 0,
    y: 0,
    width: 42,
    depth: 24,
    height: 34.5,
    rotation,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    cornerType: "diagonal",
  } as PlacedCabinet;
}

/** Gap from the body's own footprint to each room wall, in inches. */
function wallGaps(cabinet: PlacedCabinet) {
  const foot = placedFootprint(cabinet);
  return {
    left: cabinet.x,
    top: cabinet.y,
    right: DEFAULT_ROOM.width - (cabinet.x + foot.w),
    bottom: DEFAULT_ROOM.depth - (cabinet.y + foot.d),
  };
}

describe("a 42x24 corner origin sits flush in the corner", () => {
  it("seats a 42-inch corner at the vertex without the 18-inch quarter-turn shift", () => {
    for (const wallId of ["top", "bottom", "left", "right"] as const) {
      const frame = wallRunFrame(wallId, DEFAULT_ROOM)!;
      for (const at of ["start", "end"] as const) {
        const spot = wallRunCornerPlacement(wideCorner(), frame, at, DEFAULT_ROOM);
        expect(spot, `${wallId} ${at}`).not.toBeNull();
        if (!spot) continue;
        const seated = { ...wideCorner(), ...spot };
        const gaps = wallGaps(seated);
        // Flush in the corner: the two adjacent walls touch (gap 0), the opposite sides are open.
        const adjacent = Math.min(gaps.left, gaps.right) + Math.min(gaps.top, gaps.bottom);
        expect(adjacent, `${wallId} ${at} gaps ${JSON.stringify(gaps)}`).toBeCloseTo(0, 5);
        expect(cabinetInsideBounds(seated, DEFAULT_ROOM), `${wallId} ${at}`).toBe(true);
      }
    }
  });

  it("computes a 42-inch corner's origin from its square envelope, not its 24 inch depth", () => {
    const frame = wallRunFrame("top", DEFAULT_ROOM)!;
    const flush = wallRunCornerPlacement(wideCorner(), frame, "end", DEFAULT_ROOM)!;
    // A 42" square corner owned by the top run ending at x=144 starts at 144-42 on that run.
    expect(flush.x + 42).toBeCloseTo(DEFAULT_ROOM.width, 5);
    expect(wallGaps({ ...wideCorner(), ...flush }).right).toBeCloseTo(0, 5);
    // With the old math (origin from the 24" depth, then a quarter turn of a 42" square) the
    // body's far edge landed at 144 - 42 + 24 + 36 = 162, i.e. 18" past the corner.
    const oldOrigin = DEFAULT_ROOM.width - 42;
    const oldFarEdge = oldOrigin + 24 + 36;
    expect(oldFarEdge - DEFAULT_ROOM.width).toBeCloseTo(18, 5);
  });

  it("seats the corner flush through the drag preview too", () => {
    const preview = cabinetWallDragPreview(wideCorner(90), DEFAULT_ROOM, [], [], 0, { disableSnapping: false });
    expect(preview?.candidate).not.toBeNull();
    const candidate = preview!.candidate!;
    expect(Math.min(...Object.values(wallGaps(candidate)))).toBeGreaterThanOrEqual(-0.01);
    expect(cabinetInsideBounds(candidate, DEFAULT_ROOM)).toBe(true);
  });

  it("keeps a real corner cabinet flush when it is seated from the catalog", () => {
    const bbc = rows.find((row) => row.masterCode === "BBC36")!;
    const seated = seatAutoDesignCorner({
      source: bbc,
      slotLabel: "Corner between Wall 1 and Wall 2",
      target: { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" },
      cornerWallIds: ["top", "right"],
      working: [],
      room: DEFAULT_ROOM,
      openings: [],
      // No pull: a blind corner at 0" pull is flush against the vertex.
      blindPullIn: 0,
      isBlindOption: true,
      catalogFillers: fillers,
      makeUid: (() => { let n = 0; return () => `c-${++n}`; })(),
      styleId: 330011,
    });
    expect(seated.ok, seated.ok ? "" : seated.message).toBe(true);
    if (!seated.ok) return;
    expect(cabinetInsideBounds(seated.corner, DEFAULT_ROOM)).toBe(true);
    const gaps = wallGaps(seated.corner);
    // The blind corner's back face is on the top wall (its 6" pull is the only gap), and its
    // 36" width runs along the right wall, so neither wall is crossed.
    expect(gaps.top).toBeCloseTo(6, 5);
    expect(gaps.right).toBeCloseTo(0, 5);
    expect(gaps.left).toBeGreaterThanOrEqual(0);
    expect(gaps.bottom).toBeGreaterThanOrEqual(0);
  });
});
