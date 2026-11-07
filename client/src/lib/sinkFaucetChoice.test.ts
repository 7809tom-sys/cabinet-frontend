import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ensureMandatorySinkFaucets, sinkFaucetIsSatisfied } from "./autoDesignFaucet";
import type { SinkFixture } from "./design";

const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

const sink = (overrides: Partial<SinkFixture> = {}): SinkFixture => ({
  uid: "sink-1",
  type: "single",
  x: 0,
  y: 0,
  width: 30,
  depth: 18,
  faucet: false,
  ...overrides,
});

const catalogFaucet = {
  id: 1,
  pelicanCode: "PL-8237 BN",
  name: "PL-8237 BN",
  imageUrl: "/faucet.png",
  sellPrice: 140.29,
};

describe("Finishing a sink without a faucet", () => {
  it("treats an explicit no-faucet choice as satisfied, so nothing is drawn", () => {
    expect(sinkFaucetIsSatisfied(sink({ faucet: false, faucetDeclined: true }))).toBe(true);
    // A bare sink with no decision still needs one.
    expect(sinkFaucetIsSatisfied(sink({ faucet: false }))).toBe(false);
  });

  it("leaves a declined sink alone when the mandatory faucet rule runs", () => {
    const declined = sink({ faucet: false, faucetDeclined: true });
    const result = ensureMandatorySinkFaucets([declined], [catalogFaucet as never]);
    expect(result.attachedUids).toEqual([]);
    expect(result.sinks[0]).toBe(declined);
    expect(result.sinks[0]!.faucet).toBe(false);
    expect(result.sinks[0]!.pelicanFaucetProfileId).toBeUndefined();
  });

  it("still fills a sink that has not made a choice", () => {
    const bare = sink();
    const result = ensureMandatorySinkFaucets([bare], [catalogFaucet as never]);
    expect(result.attachedUids).toEqual(["sink-1"]);
    expect(result.sinks[0]!.faucet).toBe(true);
  });

  it("records the skip when the sink step finishes without a faucet", () => {
    expect(designTool).toContain("faucetDeclined: faucetProduct ? undefined : true");
  });
});

describe("Kitchen faucet list in the sink step", () => {
  it("keeps the server's kitchen faucet rows instead of running them through the bathroom filter", () => {
    // The bathroom-only merge must not apply to a kitchen sink.
    expect(designTool).toContain('if (!sinkBaseDialog || roomType === "bathroom")');
    expect(designTool).toContain("return (faucetBaseProducts ?? []) as typeof faucetBaseProducts;");
  });

  it("still filters the bathroom step to measured vanity faucets", () => {
    expect(designTool).toContain("mergeBathroomFaucetRows(");
    expect(designTool).toContain("bathroomVanityFaucetOptions([product], pendingSinkProduct?.pelicanCode)");
  });
});
