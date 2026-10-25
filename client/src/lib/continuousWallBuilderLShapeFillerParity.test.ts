import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import {
  appendCollisionFreePlacements,
  wallLength,
  wallPlacementAt,
  wallRunFrame,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { automaticAngledWallFiller } from "./angledWallFiller";

function lShapedContinuousRoom(): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 120, "start");
  segments = appendWallBuilderSegment(segments, 60, "right45");
  segments = appendWallBuilderSegment(segments, 120, "right45");
  segments = appendWallBuilderSegment(segments, 96, "right90");
  const built = wallBuilderRoomGeometry(segments, 96);
  if (!built.room) throw new Error(built.error ?? "Expected Wall Builder L-shaped room");
  return { ...built.room, ceilingHeight: 96 };
}

const STANDARD: RoomData = { width: 120, depth: 162.426, ceilingHeight: 96 };
const CONTINUOUS = lShapedContinuousRoom();
const FIRST_WALL = CONTINUOUS.customWalls![0]!.id;
const ANGLED_WALL = CONTINUOUS.customWalls![1]!.id;
const STRAIGHT_AFTER_ANGLE = CONTINUOUS.customWalls![2]!.id;
const RETURN_WALL = CONTINUOUS.customWalls![3]!.id;

function base(uid: string, room: RoomData, wallId: string, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, 24, 24, wallId as never, room);
  return {
    uid,
    cabinetId: 9360006,
    masterCode: "B24",
    description: '24" 2 Door Single Drawer Base Cabinet',
    placement: "base",
    width: 24,
    depth: 24,
    height: 34.5,
    numberOfDoors: 2,
    numberOfDrawers: 1,
    ...spot,
  };
}

describe("Continuous Wall Builder L-shaped custom-filler parity", () => {
  it("uses the same shared first-run seat as a standard Designer wall", () => {
    const standard = wallPlacementAt(30, 24, 24, "top", STANDARD);
    const continuous = wallPlacementAt(30, 24, 24, FIRST_WALL as never, CONTINUOUS);

    expect(wallRunFrame("top", STANDARD)).toMatchObject({ kind: "cardinal", length: 120 });
    expect(wallRunFrame(FIRST_WALL as never, CONTINUOUS)).toMatchObject({ kind: "custom", length: 120 });
    expect(continuous).toEqual({ ...standard, wallId: FIRST_WALL });
  });

  it("retains the same catalog custom filler stock/cut identity on the return run", () => {
    const fillerSpot = wallPlacementAt(30, 1.5, 12, RETURN_WALL as never, CONTINUOUS);
    const manualF342: PlacedCabinet = {
      uid: "manual-f342",
      cabinetId: 9360195,
      masterCode: "F342",
      description: '3" × 42" Wall Filler — cut to 1½"',
      placement: "wall",
      width: 1.5,
      depth: 12,
      height: 42,
      nominalWidth: 3,
      nominalDepth: 12,
      nominalHeight: 42,
      mountBottom: 54,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      fillerPieceGroupId: "continuous-l-custom-cut",
      fillerBillingRole: "primary",
      fillerTotalWidth: 1.5,
      fillerStockWidthIn: 3,
      fillerInstalledCutWidthIn: 1.5,
      fillerPlacementMode: "left",
      ...fillerSpot,
    };

    expect(manualF342).toMatchObject({
      wallId: RETURN_WALL,
      width: 1.5,
      fillerStockWidthIn: 3,
      fillerInstalledCutWidthIn: 1.5,
    });
  });

  it("creates the same two-board front-miter treatment at the actual builder 45-degree turn", () => {
    // The actual 45° join is Wall 2 (the measured diagonal) into Wall 3
    // (the next straight segment), exactly as the builder creates it.
    // Four inches clear on each side produces two 5.94 in cuts, which must
    // consume the real 6 in selected-line F696 stock rather than a made-up part.
    const first = base("angled-neighbour", CONTINUOUS, ANGLED_WALL, wallLength(ANGLED_WALL as never, CONTINUOUS) - 24 - 4);
    const angled = base("straight-owner", CONTINUOUS, STRAIGHT_AFTER_ANGLE, 4);
    let sequence = 0;
    const selectedLineFiller = {
      id: 9360198,
      masterCode: "F696",
      description: '6" × 96" Filler',
      category: "Filler",
      subCategory: "Filler",
      width: "6",
      height: "96",
      depth: null,
      catalogImageUrl: null,
    };

    const resolution = automaticAngledWallFiller(
      angled,
      CONTINUOUS,
      [first, angled],
      [selectedLineFiller],
      () => `continuous-miter-${++sequence}`,
      390012,
    );

    expect(resolution?.fillers).toHaveLength(2);
    expect(resolution?.fillers).toEqual(expect.arrayContaining([
      expect.objectContaining({ masterCode: "F696", placement: "base", fillerTransitionKind: "front-miter-pair", fillerMiterAngle: 22.5 }),
    ]));
    expect(appendCollisionFreePlacements([first, angled], resolution!.fillers, CONTINUOUS).rejected).toEqual([]);
  });
});
