import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  FAUCET_REAR_DECK_BODY_OFFSET_IN,
  MINIMUM_FAUCET_REAR_DECK_IN,
  NON_APRON_SINK_FRONT_SETBACK,
  countertopDepthForCabinet,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  normalizeSinkFixturesToBases,
  placedFootprint,
  type PlacedCabinet,
  type SinkFixture,
} from "./design";

const topWallSinkBase = {
  uid: "sink-base-36",
  cabinetId: 1,
  masterCode: "SB36",
  description: "36 inch sink base",
  placement: "base",
  x: 24,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
} as PlacedCabinet;

/** The reported bathroom case: a 30" Pelican basin on a 30" × 21" vanity base. */
const bathroomVanityBase = {
  uid: "vs30",
  cabinetId: 2,
  masterCode: "VS30",
  description: '30" W x 34-1/2" H x 21" D Vanity Sink Base — 2 Doors, False Drawer Front',
  category: "Vanity",
  subCategory: "Vanity Sink",
  placement: "base",
  x: 15,
  y: 0,
  width: 30,
  depth: 21,
  height: 34.5,
  rotation: 0,
} as PlacedCabinet;

describe("non-apron sink countertop-deck placement", () => {
  it("sets every standard sink front 2 inches behind the finished countertop front while centering it on the base", () => {
    const single = makeSinkForCabinet("single", topWallSinkBase, DEFAULT_ROOM, { width: 25, depth: 18 });
    const double = makeSinkForCabinet("double", topWallSinkBase, DEFAULT_ROOM, { width: 33, depth: 20 });
    // An undermount uses the same non-apron deck rule; its bowl construction is
    // source-specific but its exterior envelope remains centered and set back.
    const undermount = makeSinkForCabinet("single", topWallSinkBase, DEFAULT_ROOM, { width: 30, depth: 18 });
    const footprint = placedFootprint(topWallSinkBase);
    const finishedFront = topWallSinkBase.y + footprint.d + 1.5;

    for (const sink of [single, double, undermount]) {
      expect(finishedFront - (sink.y + sink.depth)).toBeCloseTo(NON_APRON_SINK_FRONT_SETBACK.defaultIn, 6);
      expect(sink.x + sink.width / 2).toBeCloseTo(topWallSinkBase.x + footprint.w / 2, 6);
      expect(sink.frontSetbackIn).toBe(2);
      expect(sink.faucetRearDeckOffsetIn).toBe(FAUCET_REAR_DECK_BODY_OFFSET_IN);
    }
  });

  it("keeps the approved 2\"–2½\" front-setback range with 2\" as the default", () => {
    expect(NON_APRON_SINK_FRONT_SETBACK).toEqual({ minimumIn: 2, defaultIn: 2, maximumIn: 2.5 });
    const atTwoAndAHalf = nonApronSinkDeckPlacement(topWallSinkBase, DEFAULT_ROOM, { width: 24, depth: 18 }, 2.5);
    expect(atTwoAndAHalf.frontSetbackIn).toBe(2.5);
    expect(atTwoAndAHalf.rearDeckIn).toBeCloseTo(countertopDepthForCabinet(topWallSinkBase) - 2.5 - 18, 6);
  });

  it("rejects a setback outside the approved range instead of silently clamping it", () => {
    const outside = nonApronSinkDeckPlacement(topWallSinkBase, DEFAULT_ROOM, { width: 24, depth: 18 }, 3.5);
    expect(outside.ok).toBe(false);
    expect(outside.reason).toContain("between 2″ and 2.5″");
  });

  it("reports the rear deck of the 20-inch double sink on a 24-inch kitchen base", () => {
    const layout = nonApronSinkDeckPlacement(topWallSinkBase, DEFAULT_ROOM, { width: 33, depth: 20 });

    expect(layout.ok).toBe(true);
    expect(layout.frontSetbackIn).toBe(2);
    // 25.5" finished kitchen top − 2" setback − 20" basin depth
    expect(layout.rearDeckIn).toBe(3.5);
    expect(layout.faucetDeckTight).toBe(false);
  });

  it("never blocks the bathroom sink when the deck is tight, and never moves the base", () => {
    const layout = nonApronSinkDeckPlacement(bathroomVanityBase, DEFAULT_ROOM, { width: 30, depth: 18 });

    // 22.5" finished vanity top − 2" setback − 18" basin depth
    expect(countertopDepthForCabinet(bathroomVanityBase)).toBe(22.5);
    expect(layout.ok).toBe(true);
    expect(layout.sinkFitsCountertop).toBe(true);
    expect(layout.rearDeckIn).toBe(2.5);
    expect(layout.faucetCanFit).toBe(true);
    expect(layout.faucetDeckTight).toBe(false);
    expect(layout.reason).toBeUndefined();
  });

  it("treats a genuinely shallow deck as an advisory, not a conflict", () => {
    const shallow = nonApronSinkDeckPlacement(bathroomVanityBase, DEFAULT_ROOM, { width: 31, depth: 19 });

    expect(shallow.ok).toBe(true);
    expect(shallow.rearDeckIn).toBe(1.5);
    expect(shallow.faucetCanFit).toBe(true);
    expect(shallow.faucetDeckTight).toBe(true);
    expect(shallow.reason).toContain("one- or two-hole mount");
    expect(shallow.reason).not.toMatch(/requires 2\.5/);
  });

  it("keeps the drawn faucet body inside the deck instead of pushing it past the rear edge", () => {
    // 1.5" of deck still leaves room for the full 1¼" drawn body offset.
    const shallow = nonApronSinkDeckPlacement(bathroomVanityBase, DEFAULT_ROOM, { width: 31, depth: 19 });
    expect(shallow.faucetRearDeckOffsetIn).toBe(FAUCET_REAR_DECK_BODY_OFFSET_IN);

    // A 0.1" deck cannot hold the 1¼" body, so the drawn faucet is pulled in
    // to the actual deck instead of spilling past the rear edge of the top.
    const tight = nonApronSinkDeckPlacement(bathroomVanityBase, DEFAULT_ROOM, { width: 31, depth: 20.4 });
    expect(tight.rearDeckIn).toBeCloseTo(0.1, 6);
    expect(tight.faucetRearDeckOffsetIn).toBeCloseTo(0.1, 6);
    expect(MINIMUM_FAUCET_REAR_DECK_IN).toBe(2.5);
  });

  it("still refuses a basin that overhangs the finished top, which is a real fit problem", () => {
    const tooDeep = nonApronSinkDeckPlacement(bathroomVanityBase, DEFAULT_ROOM, { width: 31, depth: 22 });
    expect(tooDeep.ok).toBe(false);
    expect(tooDeep.sinkFitsCountertop).toBe(false);
    expect(tooDeep.reason).toContain("deeper than the finished countertop");
  });

  it("stamps the tight-deck advisory on the fixture without a blocking conflict", () => {
    const tightSink = makeSinkForCabinet("single", bathroomVanityBase, DEFAULT_ROOM, { width: 31, depth: 19 });
    expect(tightSink.faucetDeckAdvisory).toBe("tight-rear-deck");
    expect(tightSink.faucetDeckConflict).toBeUndefined();

    const roomySink = makeSinkForCabinet("single", bathroomVanityBase, DEFAULT_ROOM, { width: 20.875, depth: 15.625 });
    expect(roomySink.faucetDeckAdvisory).toBeUndefined();
    expect(roomySink.faucetDeckConflict).toBeUndefined();
  });

  it("clears a legacy blocking flag when an older saved sink is normalized", () => {
    const legacy = {
      ...makeSinkForCabinet("single", bathroomVanityBase, DEFAULT_ROOM, { width: 30, depth: 18 }),
      uid: "legacy-sink",
      faucet: true,
      faucetDeckConflict: "shallow-countertop-deck" as const,
      sourceWidth: 30,
      sourceDepth: 18,
    } as SinkFixture;
    const [normalized] = normalizeSinkFixturesToBases([legacy], [bathroomVanityBase], DEFAULT_ROOM);
    expect(normalized.uid).toBe("legacy-sink");
    expect(normalized.faucetDeckConflict).toBeUndefined();
  });

  it("leaves farmhouse/apron-front placement unchanged", () => {
    const farmhouse = makeSinkForCabinet("farmhouse", topWallSinkBase, DEFAULT_ROOM, { width: 30, depth: 20 });

    expect(farmhouse.y).toBe(4);
    expect(farmhouse.frontSetbackIn).toBeUndefined();
    expect(farmhouse.faucetRearDeckOffsetIn).toBeUndefined();
  });
});
