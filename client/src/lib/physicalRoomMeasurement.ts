import { clampRoomInches, type RoomData } from "@/lib/design";

export type PhysicalRoomMeasurement = {
  label: string;
  inches: number;
  feet: number;
  meters: number;
  segmentType: "wall" | "window" | "door" | "plumbing" | "electrical";
  note?: string;
};

export function physicalWallMeasurements(measurements: PhysicalRoomMeasurement[]) {
  return measurements.filter((measurement) => measurement.segmentType === "wall" && Number.isFinite(measurement.inches) && measurement.inches > 0);
}

export function suggestedRoomMeasurementIndexes(measurements: PhysicalRoomMeasurement[]) {
  const walls = physicalWallMeasurements(measurements);
  if (walls.length < 2) return { widthIndex: null, depthIndex: null };
  return { widthIndex: 0, depthIndex: 1 };
}

export function roomFromPhysicalMeasurements(
  room: RoomData,
  widthInches: number,
  depthInches: number,
): RoomData {
  return {
    ...room,
    width: clampRoomInches(widthInches),
    depth: clampRoomInches(depthInches),
    // Two measured spans describe a rectangular perimeter. An earlier custom
    // polygon must not survive underneath a newly applied physical rectangle.
    vertices: undefined,
    customWalls: undefined,
  };
}
