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
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  imageUrl: "/faucet.png",
  sellPrice: 140.29,
};

const renderableFaucet = {
  faucet: true,
  faucetForm: "pull-down" as const,
  faucetOverallHeight: 26.125,
  faucetSpoutLength: 7.6875,
  faucetSpoutHeight: 6.5,
};

describe("Every sink in the drawing has a faucet", () => {
  it("gives a faucet to a sink that was added without one", () => {
    const bare = sink();
    const result = ensureMandatorySinkFaucets([bare], [catalogFaucet as never]);
    expect(result.attachedUids).toEqual(["sink-1"]);
    expect(result.sinks[0]!.faucet).toBe(true);
    expect(result.sinks[0]!.pelicanFaucetProductId).toBe(1);
  });

  it("has no opt-out: a declined faucet is not a satisfied sink", () => {
    // The rule fills any sink without a drawable faucet, full stop.
    expect(sinkFaucetIsSatisfied(sink({ faucet: false }))).toBe(false);
    expect(sinkFaucetIsSatisfied(sink({ faucet: true }))).toBe(false);
  });

  it("leaves an existing drawable faucet untouched", () => {
    const complete = sink(renderableFaucet);
    const result = ensureMandatorySinkFaucets([complete], [catalogFaucet as never]);
    expect(result.attachedUids).toEqual([]);
    expect(result.sinks[0]).toBe(complete);
  });

  it("falls back to the built-in default when the catalog has no faucet row", () => {
    const result = ensureMandatorySinkFaucets([sink()], []);
    expect(result.attachedUids).toEqual(["sink-1"]);
    expect(result.usedDefault).toBe(true);
    expect(result.sinks[0]!.faucet).toBe(true);
  });

  it("carries no declined-faucet flag anywhere in the designer", () => {
    expect(designTool).not.toContain("faucetDeclined");
    expect(designTool).not.toContain("Finish without a faucet");
  });

  it("still shows the kitchen faucet list to choose from", () => {
    // The role follows the selected base: a kitchen or farmhouse / apron-front
    // base asks for ordinary faucet rows; only a vanity asks for vanity faucets.
    expect(designTool).toContain("{ role: faucetCatalogRoleForBase(sinkDialogBase, roomType), limit: 200, affiliateSlug: affiliateSlug ?? undefined }");
    expect(designTool).toContain("return (faucetBaseProducts ?? []) as typeof faucetBaseProducts;");
  });
});
