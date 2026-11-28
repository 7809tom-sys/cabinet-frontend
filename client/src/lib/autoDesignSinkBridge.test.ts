/**
 * Owner report (Nov 26 2026): Auto-Design left a sink with no wall cabinet over
 * it. The over-sink bridge pass cleared the full-height upper that closed that
 * span, then found no catalog bridge for the line and left the hole behind.
 *
 * The bridge may replace that upper only when the bridge itself seats.
 */
import { describe, expect, it } from "vitest";
import { placeSinkBridges } from "./autoDesignSinkBridge";
import {
  DEFAULT_ROOM,
  OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  cabinetWall,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };

function sinkBase(start = 48): PlacedCabinet {
  const spot = wallPlacementAt(start, 36, 24, "top", ROOM);
  return {
    uid: "sink-base",
    cabinetId: 1,
    masterCode: "SB36",
    description: "36 inch sink base",
    category: "Base",
    subCategory: "Sink Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

function upperOverSink(start = 48, width = 36): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 12, "top", ROOM);
  return {
    uid: "upper-over-sink",
    cabinetId: 2,
    masterCode: `W${width}30`,
    description: `${width} inch wall cabinet`,
    category: "Wall",
    subCategory: "Wall",
    placement: "wall",
    x: spot.x,
    y: spot.y,
    width,
    depth: 12,
    height: 30,
    mountBottom: 54,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 2,
  } as PlacedCabinet;
}

function wallRow(masterCode: string, width: number, height: number): DesignCabinet {
  return {
    id: 0,
    masterCode,
    description: `${width} x ${height} wall cabinet`,
    category: "Wall",
    subCategory: "Wall",
    placement: "wall",
    width: String(width),
    height: String(height),
    depth: "12",
    numberOfDoors: 1,
  } as DesignCabinet;
}

function run(wallCatalog: DesignCabinet[], placed: PlacedCabinet[]) {
  return placeSinkBridges({
    placed,
    room: ROOM,
    openings: [],
    wallCatalog,
    wallCabinetHeightIn: 30,
    styleId: 330014,
    makeUid: () => "bridge-1",
  });
}

describe("Auto Design: the wall above a sink is never left open by the bridge pass", () => {
  it("keeps the full-height upper over the sink when the line sells no bridge at the sink width", () => {
    const sink = sinkBase();
    const upper = upperOverSink();
    const result = run([wallRow("W1830", 18, 30)], [sink, upper]);

    expect(result.added).toBe(false);
    expect(result.placed.map((item) => item.uid)).toContain(upper.uid);
    const codes = result.placed.map((item) => item.masterCode);
    expect(codes).toContain("W3630");
    expect(result.findings.some((finding) => finding.code === "sink-bridge-unavailable")).toBe(true);
    expect(result.notes.join(" ")).toMatch(/kept/);
  });

  it("keeps the upper when the only bridge cannot be seated over the sink", () => {
    const sink = sinkBase();
    const upper = upperOverSink();
    // A 36 in bridge exists, but a tall cabinet already owns the wall span the
    // bridge needs, so the placement is rejected. The upper must survive.
    const blocker = {
      ...upper,
      uid: "tall-blocker",
      masterCode: "UOC3690",
      placement: "tall",
      height: 90,
      mountBottom: 0,
    } as PlacedCabinet;
    const result = run([wallRow("W3612", 36, 12)], [sink, upper, blocker]);

    expect(result.added).toBe(false);
    expect(result.placed.map((item) => item.uid)).toContain(upper.uid);
    expect(result.findings.some((finding) => finding.code === "sink-bridge-blocked")).toBe(true);
  });

  it("replaces the upper with the short catalog bridge when one fits", () => {
    const sink = sinkBase();
    const upper = upperOverSink();
    const result = run([wallRow("W3612", 36, 12)], [sink, upper]);

    expect(result.added).toBe(true);
    expect(result.placed.map((item) => item.uid)).not.toContain(upper.uid);
    const bridge = result.placed.find((item) => item.uid === "bridge-1");
    expect(bridge).toBeTruthy();
    const wall = cabinetWall(sink, ROOM);
    expect(wallRunSpan(bridge!, wall, ROOM)).toBeCloseTo(36, 1);
    expect(bridge!.height).toBeCloseTo(12, 1);
    expect(bridge!.mountBottom).toBeCloseTo(OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM, 6);
    expect(wallRunOffset(bridge!, wall, ROOM)).toBeCloseTo(wallRunOffset(sink, wall, ROOM), 1);
  });
});
