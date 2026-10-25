import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, OPENINGS, wallPlacementAt, wallRunOffset, type PlacedCabinet } from "./design";
import { fourAnchorSinkWindow, windowOverlapsReservation } from "./fourAnchorSinkWindow";

function sink(width: number, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: "sink", cabinetId: 1, masterCode: `SB${width}`, description: `${width}" Sink Base`, category: "Base", subCategory: "Sink Base",
    placement: "base", ...spot, width, depth: 24, height: 34.5, numberOfDoors: 2, numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("Four-anchor sink window", () => {
  it("is a real over-sink window, as wide as the sink base and centered on it", () => {
    const placedSink = sink(36, 42);
    const window = fourAnchorSinkWindow({ sink: placedSink, room: DEFAULT_ROOM, uid: "win-1" });
    const def = OPENINGS.find((item) => item.key === "window-over-sink")!;
    expect(window).toMatchObject({ uid: "win-1", kind: "window", side: "top", width: 36, height: def.height, sill: def.sill });
    expect(window.offset).toBeCloseTo(wallRunOffset(placedSink, "top", DEFAULT_ROOM), 5);
    expect(window.offset + window.width / 2).toBeCloseTo(42 + 18, 5);
  });

  it("follows the sink width for SB30, SB33 and SB42", () => {
    for (const width of [30, 33, 42]) {
      const window = fourAnchorSinkWindow({ sink: sink(width, 40), room: DEFAULT_ROOM, uid: `w${width}` });
      expect(window.width).toBe(width);
      expect(window.offset + window.width / 2).toBeCloseTo(40 + width / 2, 5);
    }
  });

  it("detects a window that would overlap the refrigerator cabinet's wall span, including the 3-inch clearance", () => {
    const window = fourAnchorSinkWindow({ sink: sink(36, 42), room: DEFAULT_ROOM, uid: "w" });
    expect(windowOverlapsReservation(window, { wall: "top", start: 0, end: 38.75 })).toBe(false);
    expect(windowOverlapsReservation(window, { wall: "top", start: 0, end: 39.5 })).toBe(true);
    expect(windowOverlapsReservation(window, { wall: "right", start: 0, end: 200 })).toBe(false);
    expect(windowOverlapsReservation(window, null)).toBe(false);
  });
});
