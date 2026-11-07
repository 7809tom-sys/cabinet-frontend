import { describe, expect, it } from "vitest";
import {
  applyChosenAutoDesignFaucet,
  ensureMandatorySinkFaucets,
  fillAutoFaucet,
  isAutoFilledFaucet,
  withDefaultFaucet,
} from "./autoDesignFaucet";
import { buildSurfaceCartLines } from "./surfaceCartLines";
import type { SinkFixture } from "./design";

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

describe("A defaulted faucet is drawn but not billed", () => {
  it("marks a faucet filled in by the mandatory rule as auto-filled", () => {
    const result = ensureMandatorySinkFaucets([sink()], [catalogFaucet as never]);
    expect(result.sinks[0]!.faucet).toBe(true);
    expect(result.sinks[0]!.faucetAutoFilled).toBe(true);
    expect(isAutoFilledFaucet(result.sinks[0])).toBe(true);
  });

  it("marks the built-in fallback faucet as auto-filled", () => {
    const filled = withDefaultFaucet(sink());
    expect(filled.faucet).toBe(true);
    expect(filled.defaultFaucet).toBe(true);
    expect(isAutoFilledFaucet(filled)).toBe(true);
  });

  it("clears the auto-filled mark when the shopper picks a faucet", () => {
    const filled = fillAutoFaucet(sink(), catalogFaucet as never);
    expect(filled.faucetAutoFilled).toBe(true);

    const chosen = applyChosenAutoDesignFaucet(filled, { ...catalogFaucet, id: 42, pelicanCode: "PL-8248 BN" });
    expect(chosen.pelicanFaucetProductId).toBe(42);
    expect(chosen.faucetAutoFilled).toBeUndefined();
    expect(isAutoFilledFaucet(chosen)).toBe(false);
  });

  it("still supplies a faucet when the designer was finished without one", () => {
    const result = ensureMandatorySinkFaucets([sink({ faucet: false })], [catalogFaucet as never]);
    expect(result.attachedUids).toEqual(["sink-1"]);
    expect(result.sinks[0]!.pelicanFaucetProductId).toBe(1);
    expect(result.sinks[0]!.faucetAutoFilled).toBe(true);
  });

  it("bills a chosen faucet and never bills a filled-in one", () => {
    const faucetSurface = {
      id: 1,
      name: "PL-8237 BN",
      category: "Sinks & Faucets",
      subCategory: "Faucets",
      size: null,
      sellPrice: 140.29,
    };
    // Mirrors DesignTool: a filled-in faucet is seeded at zero unless the same
    // faucet was chosen on another sink.
    const billable = (sinks: SinkFixture[]) => {
      const quantities = new Map<number, number>();
      const chosen = new Set<number>();
      for (const item of sinks) {
        if (item.pelicanFaucetProductId != null && item.faucetAutoFilled !== true) chosen.add(item.pelicanFaucetProductId);
      }
      for (const item of sinks) {
        if (item.pelicanFaucetProductId == null) continue;
        if (item.faucetAutoFilled === true && !chosen.has(item.pelicanFaucetProductId) && !quantities.has(item.pelicanFaucetProductId)) {
          quantities.set(item.pelicanFaucetProductId, 0);
        }
      }
      for (const item of sinks) {
        if (item.pelicanFaucetProductId == null || item.faucetAutoFilled === true) continue;
        quantities.set(item.pelicanFaucetProductId, (quantities.get(item.pelicanFaucetProductId) ?? 0) + 1);
      }
      return quantities;
    };

    const skipped = ensureMandatorySinkFaucets([sink()], [catalogFaucet as never]).sinks;
    expect(buildSurfaceCartLines([faucetSurface], "homeowner", null, billable(skipped))).toHaveLength(0);

    const picked = [applyChosenAutoDesignFaucet(sink(), catalogFaucet as never)];
    expect(buildSurfaceCartLines([faucetSurface], "homeowner", null, billable(picked))).toHaveLength(1);
  });
});
