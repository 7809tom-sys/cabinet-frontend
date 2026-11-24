import { describe, expect, it } from "vitest";
import type { PlacedCabinet, SinkFixture } from "./design";
import { designCartMissingFixtures, missingCartFixtureKinds, missingCartFixturesLabel } from "./designCartMissingFixtures";

const cab = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "c1",
  cabinetId: 1,
  masterCode: "SB30",
  description: "Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 30,
  depth: 24,
  height: 34.5,
  rotation: 0,
  ...overrides,
} as PlacedCabinet);

const sink = (overrides: Partial<SinkFixture> = {}): SinkFixture => ({
  uid: "s1",
  type: "single",
  x: 3,
  y: 2,
  width: 24,
  depth: 18,
  faucet: true,
  cabinetUid: "c1",
  ...overrides,
} as SinkFixture);

const sinkPick = { id: 101, category: "Sinks & Faucets", subCategory: "Sinks", name: "Kitchen sink" };
const faucetPick = { id: 202, category: "Sinks & Faucets", subCategory: "Faucets", name: "Kitchen faucet" };
const slabPick = { id: 303, category: "Quartz Slabs (Countertops)", subCategory: null, name: "White slab" };

const chosenSink = () => sink({ pelicanProductId: 101, pelicanFaucetProductId: 202 });

describe("designCartMissingFixtures", () => {
  it("lists a kitchen sink base whose bowl is only the drawn stand-in", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [cab({})],
      sinks: [sink({ pelicanFaucetProductId: 202 })],
      selectedSurfaces: [faucetPick],
      countertopOn: false,
    });
    expect(missing).toEqual([{ kind: "sink", cabinetUid: "c1", sinkUid: "s1" }]);
  });

  it("lists a sink base with no sink fixture at all", () => {
    const missing = designCartMissingFixtures({ roomType: "kitchen", placed: [cab({})], sinks: [], selectedSurfaces: [], countertopOn: false });
    expect(missingCartFixtureKinds(missing)).toEqual(["sink"]);
  });

  it("lists a filled-in faucet the customer did not choose", () => {
    for (const filled of [{ faucetAutoFilled: true }, { defaultFaucet: true, faucetAutoFilled: true }]) {
      const missing = designCartMissingFixtures({
        roomType: "kitchen",
        placed: [cab({})],
        sinks: [sink({ pelicanProductId: 101, pelicanFaucetProductId: 202, ...filled })],
        selectedSurfaces: [sinkPick, faucetPick],
        countertopOn: false,
      });
      expect(missing).toEqual([{ kind: "faucet", cabinetUid: "c1", sinkUid: "s1" }]);
    }
  });

  it("lists a countertop that is on with no quartz slab picked", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [cab({})],
      sinks: [chosenSink()],
      selectedSurfaces: [sinkPick, faucetPick],
      countertopOn: true,
    });
    expect(missing).toEqual([{ kind: "countertop" }]);
    expect(missingCartFixturesLabel(missing)).toBe("Not in cart yet: countertop");
  });

  it("returns an empty list when the sink, faucet and countertop are all chosen", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [cab({})],
      sinks: [chosenSink()],
      selectedSurfaces: [sinkPick, faucetPick, slabPick],
      countertopOn: true,
    });
    expect(missing).toEqual([]);
    expect(missingCartFixturesLabel(missing)).toBeNull();
  });

  it("names every missing kind once, in sink · faucet · countertop order", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [cab({}), cab({ uid: "c2", x: 60 })],
      sinks: [sink({ faucetAutoFilled: true, pelicanFaucetProductId: 202 }), sink({ uid: "s2", cabinetUid: "c2", x: 63, faucetAutoFilled: true, pelicanFaucetProductId: 202 })],
      selectedSurfaces: [],
      countertopOn: true,
    });
    expect(missing.filter((item) => item.kind === "sink")).toHaveLength(2);
    expect(missingCartFixturesLabel(missing)).toBe("Not in cart yet: sink · faucet · countertop");
  });

  it("never lists appliances", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [
        cab({ uid: "range", masterCode: "RANGE30", description: "Range", placement: "appliance" as PlacedCabinet["placement"] }),
        cab({ uid: "fridge", masterCode: "REF36", description: "Refrigerator", placement: "appliance" as PlacedCabinet["placement"], x: 40 }),
        cab({ uid: "dw", masterCode: "DW24", description: "Dishwasher next to sink base", placement: "appliance" as PlacedCabinet["placement"], x: 80 }),
        cab({ uid: "b15", masterCode: "B15", description: "Base", x: 110, width: 15 }),
      ],
      sinks: [],
      selectedSurfaces: [],
      countertopOn: false,
    });
    expect(missing).toEqual([]);
  });

  it("does not ask for a sink on a sink base used for a range top", () => {
    const missing = designCartMissingFixtures({
      roomType: "kitchen",
      placed: [cab({ sinkTopType: "gas" })],
      sinks: [],
      selectedSurfaces: [],
      countertopOn: false,
    });
    expect(missing).toEqual([]);
  });

  it("leaves bathrooms and vanity sink bases on their own checklist", () => {
    expect(designCartMissingFixtures({ roomType: "bathroom", placed: [cab({ description: "Vanity Sink Base" })], sinks: [sink()], selectedSurfaces: [], countertopOn: true })).toEqual([]);
    expect(designCartMissingFixtures({ roomType: "kitchen", placed: [cab({ masterCode: "VSD30", description: "Vanity Sink Base" })], sinks: [sink({ faucetAutoFilled: true })], selectedSurfaces: [], countertopOn: false })).toEqual([]);
  });
});
