import { describe, expect, it } from "vitest";
import { ensureMandatorySinkFaucets, withDefaultFaucet } from "./autoDesignFaucet";
import { DEFAULT_PELICAN_KITCHEN_FAUCET, DEFAULT_PELICAN_VANITY_FAUCET } from "./pelicanFixtureProfiles";
import type { SinkFixture } from "./design";

const sink = (): SinkFixture => ({
  uid: "sink-1",
  type: "single",
  x: 10,
  y: 0,
  width: 24,
  depth: 21,
  rotation: 0,
  cabinetUid: "cab-1",
  faucet: false,
} as SinkFixture);

describe("default sink faucet follows the room", () => {
  it("puts the verified vanity faucet on a bathroom sink", () => {
    const result = ensureMandatorySinkFaucets([sink()], [], { bathroom: true });
    expect(result.source).toBe("default");
    expect(result.notes[0]).toContain(DEFAULT_PELICAN_VANITY_FAUCET.pelicanCode);
    expect(result.notes[0]).not.toContain(DEFAULT_PELICAN_KITCHEN_FAUCET.pelicanCode);
    expect(result.sinks[0]?.pelicanFaucetProfileId).toBe(DEFAULT_PELICAN_VANITY_FAUCET.id);
    expect(result.sinks[0]?.faucetOverallHeight).toBe(DEFAULT_PELICAN_VANITY_FAUCET.overallHeightIn);
  });

  it("keeps the kitchen faucet on a kitchen sink", () => {
    const result = ensureMandatorySinkFaucets([sink()], []);
    expect(result.notes[0]).toContain(DEFAULT_PELICAN_KITCHEN_FAUCET.pelicanCode);
  });

  it("gives the bathroom default a vanity-scale spout, not a kitchen pull-down", () => {
    const vanity = withDefaultFaucet(sink(), true);
    const kitchen = withDefaultFaucet(sink(), false);
    expect(vanity.faucetOverallHeight!).toBeLessThan(kitchen.faucetOverallHeight!);
    expect(vanity.pelicanFaucetProfileId).toBe(DEFAULT_PELICAN_VANITY_FAUCET.id);
  });
});
