import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, countertopSurfaceInsideRoom, type CountertopSurface } from "./design";

const surface = (x: number, y: number, width: number, depth: number): CountertopSurface => ({
  x,
  y,
  width,
  depth,
  kind: "base",
});

describe("countertopSurfaceInsideRoom", () => {
  it("accepts a cabinet-supported countertop contained by the room", () => {
    expect(countertopSurfaceInsideRoom(surface(24, 24, 48, 25.5), DEFAULT_ROOM)).toBe(true);
  });

  it("rejects a countertop projection that would pass through a room wall", () => {
    expect(countertopSurfaceInsideRoom(surface(24, -0.125, 48, 25.5), DEFAULT_ROOM)).toBe(false);
    expect(countertopSurfaceInsideRoom(surface(DEFAULT_ROOM.width - 20, 24, 25.5, 48), DEFAULT_ROOM)).toBe(false);
  });
});
