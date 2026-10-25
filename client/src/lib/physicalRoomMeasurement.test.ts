import { describe, expect, it } from "vitest";
import {
  physicalWallMeasurements,
  roomFromPhysicalMeasurements,
  suggestedRoomMeasurementIndexes,
  type PhysicalRoomMeasurement,
} from "./physicalRoomMeasurement";

const measurements: PhysicalRoomMeasurement[] = [
  { label: "Back wall", inches: 144, feet: 12, meters: 3.6576, segmentType: "wall" },
  { label: "Left wall", inches: 125, feet: 10.4167, meters: 3.175, segmentType: "wall" },
  { label: "Kitchen door", inches: 36, feet: 3, meters: 0.9144, segmentType: "door" },
];

describe("physical room measurement review", () => {
  it("uses only positive wall spans as room-dimension candidates", () => {
    expect(physicalWallMeasurements(measurements)).toEqual(measurements.slice(0, 2));
    expect(suggestedRoomMeasurementIndexes(measurements)).toEqual({ widthIndex: 0, depthIndex: 1 });
  });

  it("requires two wall spans before suggesting room dimensions", () => {
    expect(suggestedRoomMeasurementIndexes([measurements[0]])).toEqual({ widthIndex: null, depthIndex: null });
  });

  it("applies a reviewed physical rectangle while clearing an incompatible custom perimeter", () => {
    const room = roomFromPhysicalMeasurements(
      { width: 96, depth: 96, ceilingHeight: 96, vertices: [{ x: 0, y: 0 }], customWalls: [{ id: "wall" } as never] },
      144,
      125,
    );
    expect(room).toMatchObject({ width: 144, depth: 125, ceilingHeight: 96 });
    expect(room.vertices).toBeUndefined();
    expect(room.customWalls).toBeUndefined();
  });
});
