import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  cornerLegClearance,
  describeCornerFirst,
  pickCornerFirst,
  planCornerFirst,
} from "./cornerFirst";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = REAL["330011"]!.base as DesignCabinet[];
const byCode = (code: string) => {
  const row = rows.find((candidate) => candidate.masterCode === code);
  if (!row) throw new Error(`fixture is missing ${code}`);
  return row;
};
const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0 };
const straightBases = () => rows.filter((row) => /^(?:B|SB|DB)\d/.test(row.masterCode));

function anchor(masterCode: string, width: number, start: number): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 26, "top", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${start}`,
    cabinetId: 0,
    masterCode,
    description: `${width} inch appliance`,
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width,
    depth: 26,
    height: 36,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("corner-first planning", () => {
  it("measures each corner leg from the shared vertex and stops at the first anchor", () => {
    const legs = cornerLegClearance({
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [anchor("RANGE-30", 30, 84)],
    });
    expect(legs).toHaveLength(2);
    // The top run is 144 long. The range starts at 84, so 30" of that run sits between the
    // corner and the range.
    expect(legs.find((leg) => leg.wallId === "top")!.clearIn).toBeCloseTo(30, 5);
    // The right run has no anchor.
    expect(legs.find((leg) => leg.wallId === "right")!.clearIn).toBeCloseTo(120, 5);
  });

  it("pulls a blind corner further than its configured pull to fill the leg it runs along", () => {
    const bbc = byCode("BBC36");
    const plan = planCornerFirst({
      cornerOptions: [bbc],
      straightBaseCatalog: straightBases(),
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      wiggleLimitIn: 3,
    });
    const pulls = [...new Set(plan.filter((candidate) => candidate.source.masterCode === "BBC36").map((candidate) => candidate.pullIn))];
    expect(pulls.length).toBeGreaterThan(1);
    expect(Math.max(...pulls)).toBeGreaterThan(Math.min(...pulls));
    // A deeper pull leaves less dead corner than the same corner at its minimum pull.
    const byPullWaste = plan.filter((candidate) => candidate.source.masterCode === "BBC36")
      .map((candidate) => ({ pull: candidate.pullIn, waste: candidate.wasteIn }))
      .sort((left, right) => left.pull - right.pull);
    expect(byPullWaste[byPullWaste.length - 1]!.waste).toBeLessThanOrEqual(byPullWaste[0]!.waste);
  });

  it("prefers a fitting blind corner over a straight base", () => {
    const bbc = byCode("BBC36");
    const winner = pickCornerFirst({
      cornerOptions: [bbc],
      straightBaseCatalog: [byCode("B36")],
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      wiggleLimitIn: 3,
    });
    expect(winner).not.toBeNull();
    expect(winner!.kind === "blind" || winner!.kind === "blind-pulled").toBe(true);
    expect(winner!.source.masterCode).toBe("BBC36");
  });

  it("always returns real catalog rows and never fabricates a corner", () => {
    const bbc = byCode("BBC36");
    const plan = planCornerFirst({
      cornerOptions: [bbc],
      straightBaseCatalog: straightBases(),
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      wiggleLimitIn: 3,
    });
    expect(plan.length).toBeGreaterThan(0);
    for (const candidate of plan) {
      expect(rows.some((row) => row.id === candidate.source.id)).toBe(true);
    }
  });

  it("orders by least waste and describes the pick for the review list", () => {
    const bbc = byCode("BBC36");
    const plan = planCornerFirst({
      cornerOptions: [bbc],
      straightBaseCatalog: straightBases(),
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      wiggleLimitIn: 3,
    });
    const wastes = plan.map((candidate) => candidate.wasteIn);
    expect([...wastes].sort((left, right) => left - right)).toEqual(wastes);
    expect(describeCornerFirst(plan[0]!)).toMatch(/BBC36/);
  });

  it("never offers a straight base as the cabinet in the corner square", () => {
    const bbc = byCode("BBC36");
    const plan = planCornerFirst({
      cornerOptions: [bbc],
      straightBaseCatalog: straightBases(),
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [anchor("RANGE-30", 30, 96)],
      wiggleLimitIn: 0,
    });
    expect(plan.every((entry) => entry.kind !== "straight")).toBe(true);
    const empty = planCornerFirst({
      cornerOptions: [],
      straightBaseCatalog: straightBases(),
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      wiggleLimitIn: 3,
    });
    expect(empty).toEqual([]);
  });
});
