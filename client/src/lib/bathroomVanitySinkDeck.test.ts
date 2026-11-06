import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  countertopDepthForCabinet,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  type PlacedCabinet,
} from "./design";
import { verifiedPelicanSinkProfile } from "./pelicanFixtureProfiles";

/**
 * The reported bathroom case: a 30" Pelican vanity basin on a 30" vanity sink
 * base between two 3VDB15 drawer bases, under a 21"-deep vanity top.
 *
 * The sink is the right sink for its base, so a narrow rear counter deck must
 * stay informational. It may not block placement, and it may not move the
 * neighbours, the top, or the fixture to chase a deeper deck.
 */
const PLACED: PlacedCabinet[] = [
  { uid: "left", cabinetId: 1, masterCode: "3VDB15", description: '15" W x 34-1/2" H x 21" D Vanity Drawer Base', category: "Vanity", subCategory: "Vanity Drawer Base", placement: "base", x: 0, y: 0, width: 15, depth: 21, height: 34.5, rotation: 0 },
  { uid: "sink-base", cabinetId: 2, masterCode: "VS30", description: '30" W x 34-1/2" H x 21" D Vanity Sink Base — 2 Doors, False Drawer Front', category: "Vanity", subCategory: "Vanity Sink", placement: "base", x: 15, y: 0, width: 30, depth: 21, height: 34.5, rotation: 0 },
  { uid: "right", cabinetId: 3, masterCode: "3VDB15", description: '15" W x 34-1/2" H x 21" D Vanity Drawer Base', category: "Vanity", subCategory: "Vanity Drawer Base", placement: "base", x: 45, y: 0, width: 15, depth: 21, height: 34.5, rotation: 0 },
] as PlacedCabinet[];

const sinkBase = PLACED[1]!;
const snapshot = () => JSON.stringify(PLACED);

/** The 30" Pelican undermount basins that a 30" vanity base accepts. */
const THIRTY_INCH_PELICAN_CODES = ["PL-VS3018 16g", "PL-VS3018 18g", "PL-VS3018 ADA", "PL-HA109 R0 16g", "PL-HA109 R15 18g"];

describe("bathroom 30\" Pelican vanity sink on a 30\" vanity base", () => {
  it("uses the published 30\" × 18\" envelope and the 22.5\" finished vanity top", () => {
    const profile = verifiedPelicanSinkProfile("PL-VS3018 18g");
    expect(profile).not.toBeNull();
    expect(profile!.exteriorWidthIn).toBe(30);
    expect(profile!.exteriorDepthIn).toBe(18);
    expect(profile!.minimumCabinetWidthIn).toBe(30);
    expect(countertopDepthForCabinet(sinkBase)).toBe(22.5);
  });

  it("places the basin on the 30\" vanity base and keeps its neighbours and the top untouched", () => {
    const before = snapshot();
    for (const code of THIRTY_INCH_PELICAN_CODES) {
      const profile = verifiedPelicanSinkProfile(code)!;
      const sink = makeSinkForCabinet("single", sinkBase, DEFAULT_ROOM, {
        width: profile.exteriorWidthIn,
        depth: profile.exteriorDepthIn,
      });

      // The basin lands inside its own base and is a placeable fixture.
      expect(sink.cabinetUid).toBe("sink-base");
      expect(sink.frontSetbackIn).toBe(2);
      expect(sink.x).toBeGreaterThanOrEqual(sinkBase.x);
      expect(sink.x + sink.width).toBeLessThanOrEqual(sinkBase.x + sinkBase.width + 0.001);
      // A tight-deck note never blocks the sink, which is what Tom reported.
      expect(sink.faucetDeckConflict).toBeUndefined();
      expect(profile!.apronFront).toBe(false);
    }
    // No cabinet, top, or neighbour was moved or redesigned for the flag.
    expect(snapshot()).toBe(before);
  });

  it("reports 2.5\" of rear deck and no advisory for the 30\" × 18\" basin", () => {
    const layout = nonApronSinkDeckPlacement(sinkBase, DEFAULT_ROOM, { width: 30, depth: 18 });
    // 22.5" top − 2" front setback − 18" basin = 2.5" of rear deck.
    expect(layout.rearDeckIn).toBe(2.5);
    expect(layout.faucetDeckTight).toBe(false);
    expect(layout.faucetCanFit).toBe(true);
    expect(layout.reason).toBeUndefined();
  });

  it("says a 30\" basin that leaves only 1.5\" still places and still takes a faucet", () => {
    // A 19"-deep basin on the same 22.5" top under the old 3" setback left 0.5".
    const layout = nonApronSinkDeckPlacement(sinkBase, DEFAULT_ROOM, { width: 31, depth: 19 });
    expect(layout.ok).toBe(true);
    expect(layout.rearDeckIn).toBe(1.5);
    expect(layout.faucetDeckTight).toBe(true);
    expect(layout.faucetCanFit).toBe(true);
    expect(layout.reason).toContain("tight-deck note only");
  });

  it("still recognises the vanity base as a sink base so the basin has a legal host", () => {
    expect(isSinkBaseCabinet(sinkBase)).toBe(true);
  });
});
