import { describe, it, expect } from "vitest";
import { cornerRotationForPlaced } from "./design";
import type { PlacedCabinet, RoomData } from "./design";

// Regression: ERB (and every L-corner cabinet) must cut its notch toward the
// room INTERIOR in all four corners — not just the top-left. Previously the
// rotation only resolved when the box was within 2" of BOTH walls, so a cabinet
// dragged near the top-right / bottom-right corner fell back to rotation 0
// (notch bottom-right), which pointed the notch at the wall and made the box
// look solid. cornerRotationForPlaced now picks the nearest room corner.

const ROOM: RoomData = { width: 120, depth: 120 } as RoomData;

function erbAt(x: number, y: number): PlacedCabinet {
  return {
    uid: "t",
    masterCode: "ERB-36",
    description: "Easy Reach Corner Base",
    width: 36,
    depth: 36,
    x,
    y,
    rotation: 0,
    placement: "base",
  } as PlacedCabinet;
}

describe("cornerRotationForPlaced — notch faces the interior in every corner", () => {
  it("top-left corner → rotation 0 (notch bottom-right)", () => {
    expect(cornerRotationForPlaced(erbAt(0, 0), ROOM)).toBe(0);
  });

  it("top-right corner → rotation 90 (notch bottom-left)", () => {
    // x so the box right edge meets the right wall (120 - 36 = 84)
    expect(cornerRotationForPlaced(erbAt(84, 0), ROOM)).toBe(90);
  });

  it("bottom-right corner → rotation 180 (notch top-left)", () => {
    expect(cornerRotationForPlaced(erbAt(84, 84), ROOM)).toBe(180);
  });

  it("bottom-left corner → rotation 270 (notch top-right)", () => {
    expect(cornerRotationForPlaced(erbAt(0, 84), ROOM)).toBe(270);
  });

  it("near (not snapped tight to) the top-right corner still resolves to 90", () => {
    // A few inches off both walls — used to fall back to rot 0 and look solid.
    expect(cornerRotationForPlaced(erbAt(80, 5), ROOM)).toBe(90);
  });

  it("near (not snapped tight to) the bottom-right corner still resolves to 180", () => {
    expect(cornerRotationForPlaced(erbAt(80, 80), ROOM)).toBe(180);
  });
});

// Lock in the exact clip-path polygon for each corner. The top-left (rot 0)
// shape is the user-confirmed-correct reference; the other three corners MUST be
// geometric mirrors of it so the L-notch always opens into the room interior.
// k = round(0.667*100) = 67, j = 100 - k = 33.
import { cornerClipPath } from "./design";

describe("cornerClipPath — every corner mirrors the confirmed top-left shape", () => {
  it("rot 0 (top-left): legs hug top+left, notch bottom-right", () => {
    expect(cornerClipPath(0)).toBe(
      "polygon(0 0, 100% 0, 100% 67%, 67% 67%, 67% 100%, 0 100%)"
    );
  });

  it("rot 90 (top-right): legs hug top+right, notch bottom-left", () => {
    expect(cornerClipPath(90)).toBe(
      "polygon(0 0, 100% 0, 100% 100%, 33% 100%, 33% 67%, 0 67%)"
    );
  });

  it("rot 180 (bottom-right): legs hug bottom+right, notch top-left", () => {
    expect(cornerClipPath(180)).toBe(
      "polygon(33% 0, 100% 0, 100% 100%, 0 100%, 0 33%, 33% 33%)"
    );
  });

  it("rot 270 (bottom-left): legs hug bottom+left, notch top-right", () => {
    expect(cornerClipPath(270)).toBe(
      "polygon(0 0, 67% 0, 67% 33%, 100% 33%, 100% 100%, 0 100%)"
    );
  });

  it("normalizes out-of-range rotations (450 ≡ 90, -90 ≡ 270)", () => {
    expect(cornerClipPath(450)).toBe(cornerClipPath(90));
    expect(cornerClipPath(-90)).toBe(cornerClipPath(270));
  });
});

// Regression for the REAL root cause: corner cabinets only seated flush in the
// top-left corner because snapPosition used the raw rotated size. A lazy-Susan
// can carry a shallow stored depth (e.g. 36x24); snapping by 24 on the depth
// axis left it short of the bottom/right walls, so cornerRotationForPlaced (which
// uses the SQUARE 36x36 footprint) saw it as "not in the corner" and mis-rotated
// the notch. snapPosition + snapToWall now use the square plan footprint, so the
// box seats tight to BOTH walls in every corner and the rotation resolves right.
import { snapPosition, snapToWall, cornerRotationForPlaced as rot } from "./design";

// A lazy-Susan stored with the legacy shallow depth (width 36, depth 24).
function lazyShallow(x: number, y: number): PlacedCabinet {
  return {
    uid: "ls",
    masterCode: "LS-36",
    description: "Lazy Susan Corner Base",
    width: 36,
    depth: 24,
    x,
    y,
    rotation: 0,
    placement: "base",
  } as PlacedCabinet;
}

describe("corner cabinet seats flush in every corner (snap uses square footprint)", () => {
  // 36" square box in a 120x120 room → far-wall coordinate is 120 - 36 = 84.
  const corners: Array<{ name: string; drop: [number, number]; seat: [number, number]; rot: number }> = [
    { name: "top-left", drop: [1, 1], seat: [0, 0], rot: 0 },
    { name: "top-right", drop: [83, 1], seat: [84, 0], rot: 90 },
    { name: "bottom-right", drop: [83, 95], seat: [84, 84], rot: 180 },
    { name: "bottom-left", drop: [1, 95], seat: [0, 84], rot: 270 },
  ];

  for (const c of corners) {
    it(`${c.name}: snaps flush to both walls and resolves rotation ${c.rot}`, () => {
      const snapped = snapPosition(lazyShallow(c.drop[0], c.drop[1]), ROOM, []);
      expect(snapped.x).toBeCloseTo(c.seat[0], 5);
      expect(snapped.y).toBeCloseTo(c.seat[1], 5);
      const placed = { ...lazyShallow(snapped.x, snapped.y), x: snapped.x, y: snapped.y };
      expect(rot(placed, ROOM)).toBe(c.rot);
    });
  }

  it("snapToWall(bottom) seats a shallow-depth corner cabinet flush to the bottom wall", () => {
    const { y } = snapToWall(lazyShallow(40, 10), "bottom", ROOM);
    expect(y).toBeCloseTo(84, 5); // 120 - 36 (square side), NOT 120 - 24
  });

  it("snapToWall(right) seats a shallow-depth corner cabinet flush to the right wall", () => {
    const { x } = snapToWall(lazyShallow(10, 40), "right", ROOM);
    expect(x).toBeCloseTo(84, 5);
  });
});
