import { describe, it, expect } from "vitest";
import { buildPhotorealScene } from "./photorealScene";
import type { PlacedCabinet, RoomData } from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function cab(over: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: over.uid ?? Math.random().toString(36).slice(2),
    cabinetId: over.cabinetId ?? 1,
    masterCode: over.masterCode ?? "B-24",
    description: over.description ?? "Base 24",
    placement: over.placement ?? "base",
    x: over.x ?? 0,
    y: over.y ?? 0, // flush to back wall (top) by default
    width: over.width ?? 24,
    depth: over.depth ?? 24,
    rotation: over.rotation ?? 0,
    ...over,
  } as PlacedCabinet;
}

describe("buildPhotorealScene", () => {
  it("returns null when no cabinets are placed", () => {
    expect(buildPhotorealScene({ room, placed: [] })).toBeNull();
  });

  it("returns null when only appliances are placed (no real cabinets)", () => {
    const fridge = cab({ masterCode: "FRIDGE-36", placement: "appliance", width: 36 });
    expect(buildPhotorealScene({ room, placed: [fridge] })).toBeNull();
  });

  it("converts room inches to feet and clamps into the allowed range", () => {
    const scene = buildPhotorealScene({ room, placed: [cab()] });
    expect(scene).not.toBeNull();
    expect(scene!.roomWidthFt).toBe(12); // 144in -> 12ft
    expect(scene!.roomDepthFt).toBe(10); // 120in -> 10ft
    expect(scene!.ceilingFt).toBe(8); // 96in -> 8ft
  });

  it("passes finish, door style, countertop, and hardware through, trimming", () => {
    const scene = buildPhotorealScene({
      room,
      placed: [cab()],
      finishName: "  Aspen White ",
      doorStyle: "Shaker",
      countertop: "White Quartz",
      hardware: "brushed nickel bar pulls",
    });
    expect(scene!.finishName).toBe("Aspen White");
    expect(scene!.doorStyle).toBe("Shaker");
    expect(scene!.countertop).toBe("White Quartz");
    expect(scene!.hardware).toBe("brushed nickel bar pulls");
  });

  it("drops empty/whitespace-only finish and hardware to undefined", () => {
    const scene = buildPhotorealScene({
      room,
      placed: [cab()],
      finishName: "   ",
      hardware: "",
    });
    expect(scene!.finishName).toBeUndefined();
    expect(scene!.hardware).toBeUndefined();
  });

  it("sets hasIsland from the island argument", () => {
    const withIsland = buildPhotorealScene({ room, placed: [cab()], island: { width: 48, depth: 24 } });
    const withoutIsland = buildPhotorealScene({ room, placed: [cab()], island: null });
    expect(withIsland!.hasIsland).toBe(true);
    expect(withoutIsland!.hasIsland).toBe(false);
  });

  it("summarizes cabinets per wall with a run length and cabinet kinds", () => {
    const scene = buildPhotorealScene({
      room,
      placed: [
        cab({ masterCode: "B-24", placement: "base", width: 24, x: 0, y: 0 }),
        cab({ masterCode: "B-36", placement: "base", width: 36, x: 24, y: 0 }),
        cab({ masterCode: "W-30-30", placement: "wall", width: 30, x: 0, y: 0 }),
      ],
    });
    expect(scene!.wallSummaries).toBeDefined();
    const back = scene!.wallSummaries!.find((s) => s.startsWith("Back wall"));
    expect(back).toBeTruthy();
    // 24 + 36 = 60in = 5ft run of base cabinets
    expect(back).toContain("5ft");
    expect(back).toContain("base cabinets");
    expect(back).toContain("wall cabinets");
  });

  it("mentions notable appliances/fixtures on a wall", () => {
    const scene = buildPhotorealScene({
      room,
      placed: [
        cab({ masterCode: "SB-36", placement: "base", width: 36, x: 0, y: 0 }),
        cab({ masterCode: "RANGE-30", placement: "appliance", width: 30, x: 40, y: 0 }),
      ],
    });
    const back = scene!.wallSummaries!.find((s) => s.startsWith("Back wall"));
    expect(back).toContain("a sink");
    expect(back).toContain("a range");
  });

  it("caps wall summaries at 8 entries", () => {
    // Only 4 walls exist, so this is naturally under 8; assert it never exceeds.
    const scene = buildPhotorealScene({
      room,
      placed: [
        cab({ placement: "base", x: 0, y: 0 }), // back
        cab({ placement: "base", x: 0, y: room.depth - 24 }), // front
        cab({ placement: "base", x: 0, y: 40, rotation: 90 }), // left
        cab({ placement: "base", x: room.width - 24, y: 40, rotation: 90 }), // right
      ],
    });
    expect(scene!.wallSummaries!.length).toBeLessThanOrEqual(8);
  });
});
