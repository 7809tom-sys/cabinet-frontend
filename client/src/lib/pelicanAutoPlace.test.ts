import { describe, expect, it } from "vitest";
import {
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "./design";
import {
  buildPelicanSinkOnCabinet,
  findOpenSinkBasePlacement,
  planPelicanFaucetAttachment,
} from "./pelicanAutoPlace";

const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function cabinet(partial: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: partial.uid ?? "cab",
    cabinetId: 1,
    masterCode: "B24",
    description: "Base cabinet",
    category: "Base",
    subCategory: null,
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...partial,
  } as PlacedCabinet;
}

function sink(partial: Partial<SinkFixture>): SinkFixture {
  return {
    uid: partial.uid ?? "sink",
    type: "single",
    x: 0,
    y: 0,
    width: 30,
    depth: 18,
    faucet: true,
    ...partial,
  };
}

describe("findOpenSinkBasePlacement", () => {
  it("puts an additional sink on the island before stacking it on the first sink wall", () => {
    const first = wallPlacementAt(40, 36, 24, "top", room);
    const existing = cabinet({
      ...first,
      uid: "sb-1",
      masterCode: "SB36",
      description: "Sink Base 36",
      width: 36,
    });
    const spot = findOpenSinkBasePlacement({
      width: 36,
      depth: 24,
      room,
      placed: [existing],
      openings: [],
      island: { x: 48, y: 40, width: 60, depth: 36 },
      activeWall: "top",
      preferIsland: true,
    });
    expect(spot?.islandFace).toBe("front");
    expect(spot && Math.abs(spot.x - existing.x) < 1 && Math.abs(spot.y - existing.y) < 1).toBe(false);
  });

  it("uses the next empty wall when the active wall is full and there is no island", () => {
    const blockerSpot = wallPlacementAt(0, 144, 24, "top", room);
    const blocker = cabinet({ ...blockerSpot, uid: "full", width: 144, masterCode: "B144", description: "Base" });
    const firstSinkSpot = wallPlacementAt(0, 36, 24, "bottom", room);
    const existing = cabinet({
      ...firstSinkSpot,
      uid: "sb-1",
      masterCode: "SB36",
      description: "Sink Base 36",
      width: 36,
    });
    const spot = findOpenSinkBasePlacement({
      width: 36,
      depth: 24,
      room,
      placed: [blocker, existing],
      openings: [],
      island: null,
      activeWall: "top",
      preferIsland: true,
    });
    expect(spot).not.toBeNull();
    expect(spot?.wallId ?? "left").not.toBe("top");
    expect(spot?.islandFace).toBeUndefined();
  });

  it("refuses when every run is blocked instead of overlapping the first sink", () => {
    const placed = (["top", "bottom", "left", "right"] as const).map((side) => {
      const length = side === "left" || side === "right" ? 120 : 144;
      const spot = wallPlacementAt(0, length, 24, side, room);
      return cabinet({ ...spot, uid: side, width: length, masterCode: side === "top" ? "SB144" : "B", description: side === "top" ? "Sink Base" : "Base" });
    });
    const spot = findOpenSinkBasePlacement({
      width: 36,
      depth: 24,
      room,
      placed,
      openings: [],
      island: null,
      activeWall: "top",
      preferIsland: true,
    });
    expect(spot).toBeNull();
  });
});

describe("planPelicanFaucetAttachment", () => {
  const base = cabinet({
    uid: "sb",
    masterCode: "SB36",
    description: "Sink Base 36",
    width: 36,
    ...wallPlacementAt(20, 36, 24, "top", room),
  });
  const basin = sink({
    uid: "basin",
    cabinetUid: "sb",
    x: base.x + 3,
    y: base.y + 3,
    wallSide: "top",
    sourceWidth: 30,
    sourceDepth: 18,
    faucet: false,
  });

  it("sets a single-hole faucet on the rear deck behind the sink", () => {
    const plan = planPelicanFaucetAttachment({
      item: { id: 7, pelicanCode: "PL-8203", name: "Fountain pull-down" },
      sinks: [basin],
      placed: [base],
      room,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.sinkUid).toBe("basin");
    expect(plan.patch.faucet).toBe(true);
    expect(plan.patch.pelicanFaucetProfileId).toBeTruthy();
    expect(plan.patch.faucetRearDeckOffsetIn).toBeGreaterThan(0);
    expect(plan.patch.requiresProjectSpecificMountHeight).toBeUndefined();
  });

  it("does not drop a wall-mounted faucet onto the counter", () => {
    const plan = planPelicanFaucetAttachment({
      item: { id: 8, pelicanCode: "PL-8410 BN", name: "Wall-mounted bridge" },
      sinks: [basin],
      placed: [base],
      room,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.message).toMatch(/wall-mounted/i);
  });

  it("sends a pot filler to the range wall flow", () => {
    const plan = planPelicanFaucetAttachment({
      item: { id: 9, pelicanCode: "PL-8369 BN", name: "Pot filler" },
      sinks: [basin],
      placed: [base],
      room,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.message).toMatch(/pot filler/i);
    expect(plan.message).toMatch(/range/i);
  });

  it("names the nearest counter when there is no sink", () => {
    const plan = planPelicanFaucetAttachment({
      item: { id: 7, pelicanCode: "PL-8203", name: "Fountain pull-down" },
      sinks: [],
      placed: [cabinet({ uid: "b", masterCode: "B24", width: 24 })],
      room,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.message).toMatch(/B24/);
    expect(plan.message).toMatch(/counter/i);
  });
});

describe("buildPelicanSinkOnCabinet", () => {
  it("centers a verified undermount sink and leaves the faucet off until one is chosen", () => {
    const base = cabinet({
      uid: "sb",
      masterCode: "SB36",
      description: "Sink Base 36",
      width: 36,
      ...wallPlacementAt(10, 36, 24, "top", room),
    });
    const fixture = buildPelicanSinkOnCabinet(
      { id: 11, pelicanCode: "PL-HA109", name: "Undermount sink", size: "30 x 18" },
      base,
      room,
    );
    expect(fixture.faucet).toBe(false);
    expect(fixture.cabinetUid).toBe("sb");
    expect(fixture.pelicanProductId).toBe(11);
    expect(fixture.pelicanProfileId).toBeTruthy();
    expect(fixture.width).toBeGreaterThan(0);
  });
});
