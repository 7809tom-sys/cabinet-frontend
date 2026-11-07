import { describe, expect, it } from "vitest";
import {
  cabinetFixtureRemoval,
  planSupportsCountertop,
  surfaceIdsToDropWithFixtures,
} from "./bathroomVanityRemoval";
import type { PlacedCabinet, SinkFixture } from "./design";

const vanity = (overrides: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
  uid: "vanity-1",
  cabinetId: 1,
  masterCode: "VSB24",
  description: '24" Vanity Sink Base',
  category: "Vanity",
  subCategory: "Vanity Cabinets",
  placement: "base",
  x: 10,
  y: 0,
  width: 24,
  depth: 21,
  height: 34.5,
  rotation: 0,
  wallId: "top",
  wallOffset: 10,
  ...overrides,
} as PlacedCabinet);

const sink = (overrides: Partial<SinkFixture> = {}): SinkFixture => ({
  uid: "sink-1",
  type: "single",
  x: 12,
  y: 4,
  width: 18,
  depth: 14,
  faucet: true,
  cabinetUid: "vanity-1",
  pelicanProductId: 701,
  pelicanFaucetProductId: 9901,
  ...overrides,
});

describe("Bathroom vanity removal takes its basin and faucet with it", () => {
  it("owns the basin installed in the vanity", () => {
    const removal = cabinetFixtureRemoval(vanity(), [sink()]);
    expect(removal.sinks.map((item) => item.uid)).toEqual(["sink-1"]);
    expect(removal.productIds.sort()).toEqual([701, 9901]);
  });

  it("adopts a legacy basin by footprint when it has no cabinetUid", () => {
    const legacy = sink({ cabinetUid: undefined, x: 14, y: 5 });
    expect(cabinetFixtureRemoval(vanity(), [legacy]).sinks).toHaveLength(1);
  });

  it("never claims a basin that belongs to another vanity", () => {
    const other = vanity({ uid: "vanity-2", x: 70, wallOffset: 70 });
    const removal = cabinetFixtureRemoval(other, [sink()]);
    expect(removal.sinks).toHaveLength(0);
    expect(removal.productIds).toHaveLength(0);
  });

  it("does not let a wall cabinet claim the base's basin by sharing its footprint", () => {
    const upper: PlacedCabinet = vanity({
      uid: "upper-1",
      masterCode: "W2430",
      category: "Wall Cabinets",
      subCategory: "Wall Cabinets",
      description: '24" x 30" Wall Cabinet',
      placement: "wall",
      x: 10,
      y: 0,
    });
    expect(cabinetFixtureRemoval(upper, [sink({ cabinetUid: undefined, x: 14, y: 5 })]).sinks).toHaveLength(0);
  });
});

describe("Cart rows that leave with a deleted vanity", () => {
  it("drops the basin and faucet rows once nothing else bills them", () => {
    const drop = surfaceIdsToDropWithFixtures({
      removedSinks: [sink()],
      remainingSinks: [],
      selectedSurfaceIds: [701, 9901, 555],
    });
    expect(drop.sort()).toEqual([701, 9901]);
  });

  it("keeps a faucet another remaining sink still uses", () => {
    const drop = surfaceIdsToDropWithFixtures({
      removedSinks: [sink()],
      remainingSinks: [sink({ uid: "sink-2", cabinetUid: "vanity-2", pelicanProductId: 702 })],
      selectedSurfaceIds: [701, 9901],
    });
    // The basin is gone; the shared faucet stays on the quote.
    expect(drop).toEqual([701]);
  });

  it("never removes a materials-list row the fixtures did not bill", () => {
    expect(surfaceIdsToDropWithFixtures({
      removedSinks: [sink()],
      remainingSinks: [],
      selectedSurfaceIds: [555],
    })).toEqual([]);
  });
});

describe("Countertop support after a delete", () => {
  it("drops the top when the last cabinet is gone", () => {
    expect(planSupportsCountertop([], null)).toBe(false);
  });

  it("keeps the top while a base cabinet or an island remains", () => {
    expect(planSupportsCountertop([vanity()], null)).toBe(true);
    expect(planSupportsCountertop([], { width: 48, depth: 36 })).toBe(true);
  });

  it("does not treat a hanging wall cabinet as counter support", () => {
    expect(planSupportsCountertop([vanity({ placement: "wall" })], null)).toBe(false);
  });
});
