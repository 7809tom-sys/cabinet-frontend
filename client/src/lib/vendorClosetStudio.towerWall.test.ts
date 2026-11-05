import { describe, expect, it } from "vitest";
import {
  addStudioConnectedCorner, createStudioDesign, restoreStudioDesign, studioBays, studioCanonicalCornerShelf,
  studioCanonicalFootprint, studioCanonicalPoint, studioCanonicalTowerFootprint, studioCanonicalTowerOffset,
  studioCompanionTowerTransform, studioCornerPlanningFootprint, studioCornerShelves, studioCornerShelvesForWall,
  studioSnapShelfHeight, studioTowerFootprint, studioWallFrame, STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN,
  STUDIO_WALLS, switchStudioWall, type StudioCornerId, type StudioDesign, type StudioWall,
} from "./vendorClosetStudio";

/**
 * Units. The planning helpers speak inches; the scene multiplies by 1/12 to reach feet. These tests
 * stay in inches so every expectation reads against the plan, and convert only where the scene does.
 */
const FT_PER_IN = 1 / 12;
/** Board depth in inches: the tower backs sit on z = 0 and the boards are 14.5 in deep. */
export const TOWER_DEPTH_IN = 14.5;
/** Where every tower back edge belongs in the viewer frame, on every wall, in inches. */
export const TOWER_BACK_IN = 0;
/** "Against the wall" tolerance in inches; far under one board thickness. */
export const AGAINST_WALL_TOLERANCE_IN = 0.25;

const room = (): StudioDesign => ({ ...createStudioDesign(), wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: 96 });

/** A wall with one 24 in tower and a shelf in it, so the run is a real tower and not an empty wall. */
function towerOnWall(wall: StudioWall): StudioDesign {
  const scoped = switchStudioWall(room(), wall);
  return { ...scoped, bays: [{ id: `bay-${wall}`, wallId: wall, widthIn: 24, items: [{ id: `shelf-${wall}`, wallId: wall, kind: "shelf" as const, bottomIn: 42 }] }] };
}

/** Adds the real connected corner shelf, which is what brings a neighbour wall tower into view. */
function cornerDesign(cornerId: StudioCornerId): StudioDesign {
  const result = addStudioConnectedCorner(room(), cornerId, "fixed", 40, `corner-${cornerId}`);
  if (!result.ok) throw new Error(result.reason);
  return result.design;
}

/** The scene's placement of the active run, in feet: canonical geometry offset to where it starts. */
function activePlacementFt(design: StudioDesign, wall: StudioWall) {
  const offset = studioCanonicalTowerOffset(design, wall);
  return { x: offset.x * FT_PER_IN, z: offset.z * FT_PER_IN };
}

/**
 * The old bug, kept as an explicit counter-example: the wall frame's own rotation and translation
 * applied to a run that is already in the viewer frame. `activeTowerParts` got exactly this.
 */
function doubleTransformedOffset(design: StudioDesign, wall: StudioWall) {
  const frame = studioWallFrame(design, wall);
  return { x: frame.x * FT_PER_IN, z: frame.z * FT_PER_IN, rotationY: frame.rotationY };
}

/** A canonical-space box mapped through a companion transform, i.e. the rectangle the scene draws. */
function placeBox(box: { xMin: number; xMax: number; zMin: number; zMax: number }, transform: { rotationY: number; x: number; z: number }) {
  const cos = Math.cos(transform.rotationY);
  const sin = Math.sin(transform.rotationY);
  const points = [
    { x: box.xMin, z: box.zMin }, { x: box.xMax, z: box.zMin },
    { x: box.xMin, z: box.zMax }, { x: box.xMax, z: box.zMax },
  ].map((point) => ({ x: point.x * cos + point.z * sin + transform.x, z: -point.x * sin + point.z * cos + transform.z }));
  return {
    xMin: Math.min(...points.map((point) => point.x)), xMax: Math.max(...points.map((point) => point.x)),
    zMin: Math.min(...points.map((point) => point.z)), zMax: Math.max(...points.map((point) => point.z)),
  };
}

/** How far a double transform would throw a tower, which is what the bug report saw. */
const floatDistance = (design: StudioDesign, wall: StudioWall) => {
  const buggy = doubleTransformedOffset(design, wall);
  const correct = activePlacementFt(design, wall);
  return Math.hypot(buggy.x - correct.x, buggy.z - correct.z);
};

const corners: StudioCornerId[] = ["back-left", "back-right", "front-left", "front-right"];
const wallOfCorner: Record<StudioCornerId, StudioWall> = {
  "back-left": "back", "back-right": "back", "front-left": "front", "front-right": "front",
};
const companionOfCorner: Record<StudioCornerId, StudioWall> = {
  "back-left": "left", "back-right": "right", "front-left": "left", "front-right": "right",
};

describe("every tower back sits against the wall slab", () => {
  it("puts the back wall tower back on z = 0 with its full board depth", () => {
    const design = towerOnWall("back");
    expect(activePlacementFt(design, "back").z).toBeCloseTo(TOWER_BACK_IN * FT_PER_IN, 9);
    const run = studioCanonicalTowerFootprint(design, "back");
    expect(run.zMin).toBeCloseTo(TOWER_BACK_IN, 6);
    // No rotation is applied, so the run keeps its board depth from the wall into the room.
    expect(run.zMax - run.zMin).toBeCloseTo(TOWER_DEPTH_IN, 6);
  });

  it("puts the left, right and front towers on z = 0 too, not out in the room", () => {
    for (const wall of ["left", "right", "front"] as StudioWall[]) {
      const design = towerOnWall(wall);
      expect(activePlacementFt(design, wall).z, `${wall} tower back`).toBeCloseTo(0, 9);
      const run = studioCanonicalTowerFootprint(design, wall);
      expect(run.zMin, `${wall} run back`).toBeCloseTo(TOWER_BACK_IN, 6);
      // A rotated run would swap its depth into width; the board depth proves nothing is rotated.
      expect(run.zMax - run.zMin, `${wall} board depth`).toBeCloseTo(TOWER_DEPTH_IN, 6);
      // The double transform moved the tower whole feet out of place.
      expect(floatDistance(design, wall), `${wall} would have floated`).toBeGreaterThan(1);
    }
  });

  it("keeps the tower on the slab once a corner shelf is in the plan", () => {
    for (const cornerId of corners) {
      const design = cornerDesign(cornerId);
      const activeWall = wallOfCorner[cornerId];
      const scoped = switchStudioWall(design, activeWall);
      expect(activePlacementFt(scoped, activeWall).z, `${cornerId} active tower back`).toBeCloseTo(0, 9);
      const run = studioCanonicalTowerFootprint(scoped, activeWall);
      expect(run.zMin, `${cornerId} run back`).toBeCloseTo(TOWER_BACK_IN, 6);
      expect(run.zMax - run.zMin, `${cornerId} board depth`).toBeCloseTo(TOWER_DEPTH_IN, 6);
      // With a corner shelf present the old code always applied the frame, so this is the reported case.
      expect(floatDistance(scoped, activeWall), `${cornerId} would have floated`).toBeGreaterThan(1);
    }
  });

  it("keeps the same board depth on every wall, so no wall is a different format", () => {
    const depths = STUDIO_WALLS.map((wall) => {
      const run = studioCanonicalTowerFootprint(towerOnWall(wall), wall);
      return Math.round((run.zMax - run.zMin) * 1000) / 1000;
    });
    expect(new Set(depths).size).toBe(1);
    expect(depths[0]).toBeCloseTo(TOWER_DEPTH_IN, 3);
  });
});

describe("companion towers are transformed once, not twice", () => {
  it("lands each companion tower exactly where the room puts it", () => {
    for (const cornerId of corners) {
      const design = cornerDesign(cornerId);
      const activeWall = wallOfCorner[cornerId];
      const companionWall = companionOfCorner[cornerId];
      const scoped = switchStudioWall(design, activeWall);
      const transform = studioCompanionTowerTransform(scoped, companionWall, activeWall);
      const drawn = placeBox(studioCanonicalTowerFootprint(scoped, companionWall), transform);
      // The one thing a companion must get right: the same rectangle the plan gives that wall, seen
      // from the active wall's camera. The old code stacked a second rotate on it.
      const expected = studioCanonicalFootprint(scoped, studioTowerFootprint(scoped, companionWall), activeWall);
      expect(drawn.xMin, `${cornerId} companion xMin`).toBeCloseTo(expected.xMin, 6);
      expect(drawn.xMax, `${cornerId} companion xMax`).toBeCloseTo(expected.xMax, 6);
      expect(drawn.zMin, `${cornerId} companion zMin`).toBeCloseTo(expected.zMin, 6);
      expect(drawn.zMax, `${cornerId} companion zMax`).toBeCloseTo(expected.zMax, 6);
      // It turns about the shared corner, so its back edge runs from the corner into the room. That
      // is the geometry of a side wall, not a float: the side wall's slab is perpendicular.
      const turn = Math.abs(Math.atan2(Math.sin(transform.rotationY), Math.cos(transform.rotationY)));
      expect(turn, `${cornerId} companion turn`).toBeCloseTo(Math.PI / 2, 6);
      expect(drawn.zMin, `${cornerId} companion starts at the corner`).toBeCloseTo(STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN, 6);
    }
  });

  it("places the companion beside the active run, never over it or across the room", () => {
    for (const cornerId of corners) {
      const design = cornerDesign(cornerId);
      const activeWall = wallOfCorner[cornerId];
      const companionWall = companionOfCorner[cornerId];
      const scoped = switchStudioWall(design, activeWall);
      const transform = studioCompanionTowerTransform(scoped, companionWall, activeWall);
      const drawn = placeBox(studioCanonicalTowerFootprint(scoped, companionWall), transform);
      const activeRun = studioCanonicalTowerFootprint(scoped, activeWall);
      const apart = drawn.xMax <= activeRun.xMin + 0.001 || drawn.xMin >= activeRun.xMax - 0.001;
      expect(apart, `${cornerId} companion does not overlap the active run`).toBe(true);
      // One corner span away at most, on the same side the plan puts it.
      const gap = Math.max(activeRun.xMin - drawn.xMax, drawn.xMin - activeRun.xMax);
      expect(gap, `${cornerId} companion gap`).toBeLessThanOrEqual(STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN + 0.001);
      expect(gap, `${cornerId} companion gap`).toBeGreaterThanOrEqual(-0.001);
      // The side it appears on follows the room's own corner, so a left corner stays left.
      if (cornerId.endsWith("left") && activeWall === "back") expect(drawn.xMax).toBeLessThanOrEqual(activeRun.xMin + 0.001);
      if (cornerId.endsWith("right") && activeWall === "back") expect(drawn.xMin).toBeGreaterThanOrEqual(activeRun.xMax - 0.001);
    }
  });

  it("gives a companion run on the same wall the same back edge as the active run", () => {
    // Two corners on the same wall: the companion is that wall's other run, so it shares the slab.
    // This is the case that proves the offset is a placement, not a second rotation.
    for (const cornerId of ["back-left", "back-right"] as StudioCornerId[]) {
      const scoped = switchStudioWall(cornerDesign(cornerId), "back");
      const transform = studioCompanionTowerTransform(scoped, "back", "back");
      expect(transform.rotationY, `${cornerId} same-wall companion turn`).toBeCloseTo(0, 6);
      expect(placeBox(studioCanonicalTowerFootprint(scoped, "back"), transform).zMin, `${cornerId} back edge`).toBeCloseTo(TOWER_BACK_IN, 6);
    }
  });
});

describe("the corner shelf keeps its own planned corner", () => {
  it("lands on the corner it was added to, on every wall that touches it", () => {
    for (const cornerId of corners) {
      const design = cornerDesign(cornerId);
      const shelf = studioCornerShelves(design).find((candidate) => candidate.cornerId === cornerId)!;
      for (const wall of [wallOfCorner[cornerId], companionOfCorner[cornerId]] as StudioWall[]) {
        const scoped = switchStudioWall(design, wall);
        const visible = studioCornerShelvesForWall(scoped, wall);
        expect(visible, `${cornerId} visible on ${wall}`).toHaveLength(1);
        const canonical = studioCanonicalCornerShelf(scoped, visible[0], wall);
        // The room corner mapped into the viewer frame is where the pie's origin belongs.
        const footprint = studioCornerPlanningFootprint(scoped, visible[0]);
        const roomCorner = {
          x: cornerId.endsWith("left") ? footprint.xMin : footprint.xMax,
          z: cornerId.startsWith("back") ? footprint.zMin : footprint.zMax,
        };
        const expected = studioCanonicalPoint(scoped, roomCorner, wall);
        expect(canonical.x, `${cornerId} on ${wall} x`).toBeCloseTo(expected.x, 6);
        expect(canonical.z, `${cornerId} on ${wall} z`).toBeCloseTo(expected.z, 6);
      }
    }
  });

  it("keeps the 29.5 in envelope in its corner and off the tower run", () => {
    for (const cornerId of corners) {
      const design = cornerDesign(cornerId);
      const activeWall = wallOfCorner[cornerId];
      const shelf = studioCornerShelves(design).find((candidate) => candidate.cornerId === cornerId)!;
      const scoped = switchStudioWall(design, activeWall);
      const canonical = studioCanonicalCornerShelf(scoped, shelf, activeWall);
      const run = studioCanonicalTowerFootprint(scoped, activeWall);
      const span = STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN;
      const envelopeStart = canonical.scaleX === 1 ? canonical.x : canonical.x - span;
      const envelopeEnd = envelopeStart + span;
      expect(envelopeEnd - envelopeStart, `${cornerId} envelope span`).toBeCloseTo(span, 6);
      // The reserved envelope ends exactly where the tower run begins, so neither overlaps.
      const touchesRun = Math.abs(envelopeStart - run.xMax) < 0.001 || Math.abs(envelopeEnd - run.xMin) < 0.001;
      expect(touchesRun, `${cornerId} envelope meets the run`).toBe(true);
      expect(canonical.z, `${cornerId} envelope back`).toBeCloseTo(TOWER_BACK_IN, 6);
    }
  });

  it("mirrors the room's left and right exactly as the wall view does", () => {
    // Standing at the back wall, a back-left corner is on the viewer's left. Looking at the front
    // wall means turning around, so the same room corner appears on the viewer's right. The shelf
    // has to follow the room, not a fixed screen side.
    const cases: Array<{ cornerId: StudioCornerId; wall: StudioWall; side: "left" | "right" }> = [
      { cornerId: "back-left", wall: "back", side: "left" },
      { cornerId: "back-right", wall: "back", side: "right" },
      { cornerId: "front-left", wall: "front", side: "right" },
      { cornerId: "front-right", wall: "front", side: "left" },
    ];
    for (const { cornerId, wall, side } of cases) {
      const shelf = studioCornerShelves(cornerDesign(cornerId)).find((candidate) => candidate.cornerId === cornerId)!;
      const scoped = switchStudioWall(cornerDesign(cornerId), wall);
      const canonical = studioCanonicalCornerShelf(scoped, shelf, wall);
      const run = studioCanonicalTowerFootprint(scoped, wall);
      if (side === "left") expect(canonical.x, `${cornerId} on ${wall}`).toBeLessThanOrEqual(run.xMin + 0.001);
      else expect(canonical.x, `${cornerId} on ${wall}`).toBeGreaterThanOrEqual(run.xMax - 0.001);
    }
  });
});

describe("a restored draft renders the same way", () => {
  it("survives a save and restore with its corner shelf still on its own wall", () => {
    const design = cornerDesign("back-right");
    const restored = restoreStudioDesign(JSON.stringify(design));
    expect(restored).not.toBeNull();
    const scoped = switchStudioWall(restored!, "back");
    expect(studioBays(scoped, "back")).toHaveLength(1);
    expect(activePlacementFt(scoped, "back").z).toBeCloseTo(0, 9);
    const shelf = studioCornerShelvesForWall(scoped, "back")[0];
    expect(shelf.cornerId).toBe("back-right");
    const canonical = studioCanonicalCornerShelf(scoped, shelf, "back");
    const run = studioCanonicalTowerFootprint(scoped, "back");
    // A back-right corner reserves the span to the right of the run, before and after restore.
    expect(canonical.x - shelf.nominalFootprintIn).toBeCloseTo(run.xMax, 6);
  });
});

describe("shelf heights are unaffected by the frame", () => {
  it("snaps a shelf to the same inches on every wall", () => {
    const reference = studioSnapShelfHeight(towerOnWall("back"), 40.1);
    for (const wall of STUDIO_WALLS) {
      expect(studioSnapShelfHeight(towerOnWall(wall), 40.1), `${wall} snap`).toBe(reference);
    }
  });
});
