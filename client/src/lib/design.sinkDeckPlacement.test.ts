import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  placedFootprint,
  type PlacedCabinet,
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

describe("non-apron sink countertop-deck placement", () => {
  it("sets every standard sink front exactly 3 inches behind the finished countertop front while centering it on the base", () => {
    const single = makeSinkForCabinet("single", topWallSinkBase, DEFAULT_ROOM, { width: 25, depth: 18 });
    const double = makeSinkForCabinet("double", topWallSinkBase, DEFAULT_ROOM, { width: 33, depth: 20 });
    // An undermount uses the same non-apron deck rule; its bowl construction is
    // source-specific but its exterior envelope remains centered and set back.
    const undermount = makeSinkForCabinet("single", topWallSinkBase, DEFAULT_ROOM, { width: 30, depth: 18 });
    const footprint = placedFootprint(topWallSinkBase);
    const finishedFront = topWallSinkBase.y + footprint.d + 1.5;

    for (const sink of [single, double, undermount]) {
      expect(finishedFront - (sink.y + sink.depth)).toBeCloseTo(3, 6);
      expect(sink.x + sink.width / 2).toBeCloseTo(topWallSinkBase.x + footprint.w / 2, 6);
      expect(sink.frontSetbackIn).toBe(3);
      expect(sink.faucetRearDeckOffsetIn).toBe(1.25);
    }
  });

  it("keeps the 20-inch double sink on the 2½-inch rear deck needed for a deck-mounted faucet", () => {
    const layout = nonApronSinkDeckPlacement(topWallSinkBase, DEFAULT_ROOM, { width: 33, depth: 20 });

    expect(layout.ok).toBe(true);
    expect(layout.frontSetbackIn).toBe(3);
    expect(layout.rearDeckIn).toBe(2.5);
    expect(layout.faucetCanFit).toBe(true);
    expect(layout.faucetRearDeckOffsetIn).toBe(1.25);
  });

  it("reports a shallow countertop instead of placing a deck-mounted faucet through the bowl or past the rear edge", () => {
    const shallowVanity = {
      ...topWallSinkBase,
      uid: "shallow-vanity",
      masterCode: "VSB30",
      description: "21 inch deep vanity sink base",
      width: 30,
      depth: 21,
    } as PlacedCabinet;
    const layout = nonApronSinkDeckPlacement(shallowVanity, DEFAULT_ROOM, { width: 24, depth: 18 });

    expect(layout.sinkFitsCountertop).toBe(true);
    expect(layout.rearDeckIn).toBe(1.5);
    expect(layout.faucetCanFit).toBe(false);
    expect(layout.reason).toContain("rear deck");
  });

  it("leaves farmhouse/apron-front placement unchanged", () => {
    const farmhouse = makeSinkForCabinet("farmhouse", topWallSinkBase, DEFAULT_ROOM, { width: 30, depth: 20 });

    expect(farmhouse.y).toBe(4);
    expect(farmhouse.frontSetbackIn).toBeUndefined();
    expect(farmhouse.faucetRearDeckOffsetIn).toBeUndefined();
  });
});
