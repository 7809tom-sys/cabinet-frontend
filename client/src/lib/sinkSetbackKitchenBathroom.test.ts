import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  NON_APRON_SINK_FRONT_SETBACK,
  countertopDepthForCabinet,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  type PlacedCabinet,
} from "./design";

/**
 * The 2"–2½" front setback and the rear-deck calculation live in ONE shared
 * function, `nonApronSinkDeckPlacement`, used by both the kitchen and the
 * bathroom. Only the finished countertop depth differs (25.5" for a 24" kitchen
 * base vs. base depth + 1.5" for a 21" vanity base), and only the bathroom had
 * the blocking behaviour in practice because its tops are shallower.
 */
const kitchenBase = { uid: "sb36", cabinetId: 1, masterCode: "SB36", description: '36" sink base', placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0 } as PlacedCabinet;
const vanityBase = { uid: "vs30", cabinetId: 2, masterCode: "VS30", description: '30" Vanity Sink Base', category: "Vanity", subCategory: "Vanity Sink", placement: "base", x: 0, y: 0, width: 30, depth: 21, height: 34.5, rotation: 0 } as PlacedCabinet;

const BASIN = { width: 30, depth: 18 };

describe("the sink setback rule is shared by the kitchen and the bathroom", () => {
  it("applies the same 2\" default setback in both rooms", () => {
    expect(NON_APRON_SINK_FRONT_SETBACK.defaultIn).toBe(2);
    for (const base of [kitchenBase, vanityBase]) {
      expect(nonApronSinkDeckPlacement(base, DEFAULT_ROOM, BASIN).frontSetbackIn).toBe(2);
      expect(makeSinkForCabinet("single", base, DEFAULT_ROOM, BASIN).frontSetbackIn).toBe(2);
    }
  });

  it("derives the rear deck from each room's own finished top depth", () => {
    // Kitchen: 24" base -> 25.5" top. 25.5 − 2 − 18 = 5.5" of deck.
    expect(countertopDepthForCabinet(kitchenBase)).toBe(25.5);
    expect(nonApronSinkDeckPlacement(kitchenBase, DEFAULT_ROOM, BASIN).rearDeckIn).toBe(5.5);
    // Bathroom: 21" vanity -> 22.5" top. 22.5 − 2 − 18 = 2.5" of deck.
    expect(countertopDepthForCabinet(vanityBase)).toBe(22.5);
    expect(nonApronSinkDeckPlacement(vanityBase, DEFAULT_ROOM, BASIN).rearDeckIn).toBe(2.5);
  });

  it("never blocks either room on a tight deck", () => {
    // A 20" basin leaves 0.5" on the bathroom top; still placeable.
    for (const base of [kitchenBase, vanityBase]) {
      const tight = nonApronSinkDeckPlacement(base, DEFAULT_ROOM, { width: 30, depth: 20 });
      expect(tight.ok).toBe(true);
      expect(tight.faucetCanFit).toBe(true);
    }
    const bathroom = nonApronSinkDeckPlacement(vanityBase, DEFAULT_ROOM, { width: 30, depth: 20 });
    expect(bathroom.rearDeckIn).toBe(0.5);
    expect(bathroom.faucetDeckTight).toBe(true);
  });

  it("still blocks a basin that genuinely overhangs the top, in both rooms", () => {
    for (const base of [kitchenBase, vanityBase]) {
      const overhang = nonApronSinkDeckPlacement(base, DEFAULT_ROOM, { width: 30, depth: 30 });
      expect(overhang.ok).toBe(false);
    }
  });

  it("gives a farmhouse sink no front setback in either room", () => {
    for (const base of [kitchenBase, vanityBase]) {
      const apron = makeSinkForCabinet("farmhouse", base, DEFAULT_ROOM, { width: 30, depth: 20 });
      expect(apron.frontSetbackIn).toBeUndefined();
    }
  });
});
