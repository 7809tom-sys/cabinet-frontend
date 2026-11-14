import { describe, expect, it } from "vitest";
import { postBuildFixturePrompts, productFromOpeningPick } from "./autoDesignOpeningFixturePick";

describe("postBuildFixturePrompts", () => {
  it("asks for both sink and faucet at the end when the opening pop-up was skipped", () => {
    expect(postBuildFixturePrompts({ sinkId: null, faucetId: null })).toEqual({ askSink: true, askFaucet: true });
    expect(postBuildFixturePrompts(null)).toEqual({ askSink: true, askFaucet: true });
  });

  it("does not ask again when the shopper already picked a sink and a faucet at the start", () => {
    expect(postBuildFixturePrompts({ sinkId: 11, faucetId: 22 })).toEqual({ askSink: false, askFaucet: false });
  });

  it("still asks only for the fixture that was not chosen at the start", () => {
    expect(postBuildFixturePrompts({ sinkId: 11, faucetId: null })).toEqual({ askSink: false, askFaucet: true });
    expect(postBuildFixturePrompts({ sinkId: null, faucetId: 22 })).toEqual({ askSink: true, askFaucet: false });
  });
});

describe("productFromOpeningPick", () => {
  const products = [{ id: 11, name: "Sink A" }, { id: 22, name: "Faucet B" }];

  it("returns the catalog row for the opening pick so the layout can use it", () => {
    expect(productFromOpeningPick(products, 22)?.name).toBe("Faucet B");
  });

  it("returns null when nothing was picked or the row is gone", () => {
    expect(productFromOpeningPick(products, null)).toBeNull();
    expect(productFromOpeningPick(products, 99)).toBeNull();
  });
});

import { faucetAlreadyPlacedOnSink, keepExistingAutoDesignSinkAndFaucet, sinkAlreadyPlacedOnBase } from "./autoDesignOpeningFixturePick";
import { withDefaultFaucet } from "./autoDesignFaucet";

describe("end-of-run sink and faucet placement is idempotent", () => {
  const sink = { uid: "s1", cabinetUid: "sb-1", faucet: true as const };

  it("treats a sink already on the measured base as placed, so a second one is not added", () => {
    expect(sinkAlreadyPlacedOnBase([sink], "sb-1")).toBe(true);
    expect(sinkAlreadyPlacedOnBase([], "sb-1")).toBe(false);
    expect(sinkAlreadyPlacedOnBase([sink], "other")).toBe(false);
  });

  it("keeps a single sink when a later pass would append a duplicate on the same base", () => {
    const again = { uid: "s2", cabinetUid: "sb-1", faucet: true as const };
    expect(keepExistingAutoDesignSinkAndFaucet([sink, again], "sb-1")).toEqual([sink]);
  });

  it("does not add a second faucet to a sink that already has a drawable one", () => {
    const dressed = withDefaultFaucet({ ...sink, faucetForm: undefined }, false);
    expect(faucetAlreadyPlacedOnSink(dressed)).toBe(true);
    expect(faucetAlreadyPlacedOnSink({ ...sink, faucet: true, faucetForm: undefined })).toBe(false);
  });
});
