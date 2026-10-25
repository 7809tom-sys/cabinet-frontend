import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import {
  backfillLegacyWallRuns,
  cabinetWallMovePreview,
  freeSegmentsOnWall,
  insideCornerHoldIn,
  placedPlanCenter,
  seatedWallRunFrame,
  wallPlacementAt,
  wallRunDistanceToPoint,
  wallRunFrame,
  type PlacedCabinet,
  type RoomData,
} from "./design";

function angledRoom(): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 132, "start");
  segments = appendWallBuilderSegment(segments, 96, "right45");
  segments = appendWallBuilderSegment(segments, 96, "right45");
  const result = wallBuilderRoomGeometry(segments);
  if (!result.room) throw new Error(result.error ?? "Expected an angled Wall Builder room");
  return { ...result.room, ceilingHeight: 96 };
}

function upper(
  code: string,
  width: number,
  room: RoomData,
  wallId: string,
  offset: number,
): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 12, wallId as never, room);
  return {
    uid: `${code}-${wallId}`,
    cabinetId: 1,
    masterCode: code,
    description: `${width}-inch wall cabinet`,
    placement: "wall",
    x: spot.x,
    y: spot.y,
    width,
    depth: 12,
    height: 42,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  };
}

describe("one shared wall engine: upper alignment and layer-depth corner spans", () => {
  const DRAWN = angledRoom();
  const DIAGONAL = DRAWN.customWalls![1]!.id;

  it("calculates 45-degree free span from each cabinet layer's own depth", () => {
    const base = freeSegmentsOnWall(DIAGONAL, DRAWN, [], [], 0.01, 0, "base", false, undefined, 24);
    const wall12 = freeSegmentsOnWall(DIAGONAL, DRAWN, [], [], 0.01, 0, "wall", false, undefined, 12);
    const wall15 = freeSegmentsOnWall(DIAGONAL, DRAWN, [], [], 0.01, 0, "wall", false, undefined, 15);
    const wall24 = freeSegmentsOnWall(DIAGONAL, DRAWN, [], [], 0.01, 0, "wall", false, undefined, 24);

    expect(insideCornerHoldIn(45, 24)).toBe(11);
    expect(insideCornerHoldIn(45, 12)).toBe(5.5);
    expect(insideCornerHoldIn(45, 15)).toBe(6.875);
    expect(insideCornerHoldIn(90, 24)).toBe(0);
    expect(base[0]!.start).toBe(11);
    expect(wall12[0]!.start).toBe(5.5);
    expect(wall15[0]!.start).toBe(6.875);
    expect(wall24[0]!.start).toBe(11);
    expect(wall12[0]!.length).toBeGreaterThan(base[0]!.length);
  });

  it.each([
    ["W-1542", 15],
    ["W-1642", 16],
    ["W3042", 30],
  ] as const)("repairs saved %s on a 45-degree Wall Builder run without changing its along-wall offset", (code, width) => {
    const seated = upper(code, width, DRAWN, DIAGONAL, 24);
    const frame = wallRunFrame(DIAGONAL, DRAWN)!;
    const screenSquareLegacy = { ...seated, rotation: 0 };

    const repaired = backfillLegacyWallRuns([screenSquareLegacy], DRAWN)[0]!;
    expect(repaired.wallId).toBe(DIAGONAL);
    expect(repaired.wallOffset).toBe(24);
    expect(repaired.rotation).toBe(frame.facingRotation);
    expect(repaired.x).toBe(seated.x);
    expect(repaired.y).toBe(seated.y);
    expect(seatedWallRunFrame(repaired, DRAWN)?.id).toBe(DIAGONAL);
    expect(wallRunDistanceToPoint(frame, placedPlanCenter(repaired))).toBeCloseTo(repaired.depth / 2, 6);
  });

  it("back-fills a saved screen-square upper on a 45-degree wall by rotating only", () => {
    const seated = upper("W1542", 15, DRAWN, DIAGONAL, 5.5);
    const legacy = { ...seated, rotation: 0, wallId: undefined, wallOffset: undefined };
    const repaired = backfillLegacyWallRuns([legacy], DRAWN)[0]!;

    expect(repaired).toMatchObject({ wallId: DIAGONAL, wallOffset: 5.5, rotation: 45 });
    expect(repaired.x).toBe(seated.x);
    expect(repaired.y).toBe(seated.y);
  });

  it("uses the same run direction for an exact drag/nudge target and a normal standard-room wall", () => {
    const standard: RoomData = { width: 132, depth: 96, ceilingHeight: 96 };
    const straight = upper("W-1542", 15, standard, "top", 24);
    const diagonal = upper("W-1542", 15, DRAWN, DIAGONAL, 24);

    for (const [room, wallId, cabinet] of [[standard, "top", straight], [DRAWN, DIAGONAL, diagonal]] as const) {
      const frame = wallRunFrame(wallId, room)!;
      const wrongRotation = { ...cabinet, rotation: (frame.facingRotation + 90) % 360 };
      const moved = cabinetWallMovePreview(
        wrongRotation,
        { x: wrongRotation.x, y: wrongRotation.y },
        room,
        [],
        [],
        { magnet: false, exact: true, target: { wallId, wallOffset: 36.125 } },
      ).candidate;
      expect(moved).not.toBeNull();
      expect(moved).toMatchObject({ wallId, wallOffset: 36.125, rotation: frame.facingRotation });
      expect(seatedWallRunFrame(moved!, room)?.id).toBe(wallId);
    }
  });
});
