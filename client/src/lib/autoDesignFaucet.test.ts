import { describe, expect, it } from "vitest";
import type { SinkFixture } from "./design";
import {
  applyChosenAutoDesignFaucet,
  catalogFaucetBrand,
  defaultAutoDesignFaucet,
  ensureAutoDesignFaucet,
  groupFaucetsByBrand,
  type AutoDesignFaucetProduct,
} from "./autoDesignFaucet";

function catalogFaucet(overrides: Partial<AutoDesignFaucetProduct> & Pick<AutoDesignFaucetProduct, "id" | "name">): AutoDesignFaucetProduct {
  return {
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    ...overrides,
  };
}

function sink(overrides: Partial<SinkFixture> = {}): SinkFixture {
  return {
    uid: "sink-1",
    type: "single",
    x: 10,
    y: 20,
    width: 30,
    depth: 18,
    faucet: false,
    ...overrides,
  };
}

describe("Auto-Design faucet catalog selection", () => {
  const kitchen = catalogFaucet({
    id: 8203,
    name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
    pelicanCode: "PL-8203",
    sellPrice: 249,
    imageUrl: "https://example.test/pl-8203.png",
  });
  const vanity = catalogFaucet({
    id: 8112,
    name: "PL-8112 Cascade Series Vanity Faucet — Brushed Nickel",
    pelicanCode: "PL-8112 BN",
  });
  const wall = catalogFaucet({
    id: 8461,
    name: "PL-8461 Fountain Series Wall-Mounted Kitchen Faucet — Matte Black",
    pelicanCode: "PL-8461 MB",
  });
  const otherBrand = catalogFaucet({
    id: 42,
    name: "Bridge Kitchen Faucet Matte Black",
    brand: "Other Vendor",
    finish: "Matte Black",
    sellPrice: 180,
  });

  it("groups deck-mounted catalog faucets by brand and keeps finish and price", () => {
    const groups = groupFaucetsByBrand([kitchen, vanity, wall, otherBrand]);
    expect(groups.map((group) => group.brand)).toEqual(["Other Vendor", "Pelican"]);
    expect(groups[0]?.products.map((product) => product.id)).toEqual([42]);
    expect(groups[1]?.products.map((product) => product.id)).toEqual([8203]);
    expect(catalogFaucetBrand(kitchen)).toBe("Pelican");
  });

  it("picks the first verified single-hole kitchen faucet from the catalog rows it is given", () => {
    const chosen = defaultAutoDesignFaucet([otherBrand, vanity, wall, kitchen]);
    expect(chosen?.id).toBe(8203);
    expect(defaultAutoDesignFaucet([vanity, wall])).toBeNull();
  });

  it("adds one deck faucet and does not replace a faucet the sink already has", () => {
    const first = ensureAutoDesignFaucet(sink(), kitchen);
    expect(first.attached).toBe(true);
    expect(first.sink.faucet).toBe(true);
    expect(first.sink.autoDesignFaucet).toBe(true);
    expect(first.sink.pelicanFaucetProductId).toBe(8203);
    expect(first.sink.faucetRearDeckOffsetIn).toBe(1.25);
    expect(first.sink.faucetOverallHeight).toBeGreaterThan(0);

    const again = ensureAutoDesignFaucet(first.sink, otherBrand);
    expect(again.attached).toBe(false);
    expect(again.sink.pelicanFaucetProductId).toBe(8203);
    expect(again.sink).toBe(first.sink);
  });

  it("replaces the auto-placed faucet with the catalog product the user picks", () => {
    const placed = ensureAutoDesignFaucet(sink({ uid: "sink-2" }), kitchen).sink;
    const chosen = applyChosenAutoDesignFaucet(placed, otherBrand);
    expect(chosen.uid).toBe("sink-2");
    expect(chosen.pelicanFaucetProductId).toBe(42);
    expect(chosen.pelicanFaucetProductName).toBe(otherBrand.name);
    expect(chosen.autoDesignFaucet).toBe(true);
    expect(chosen.faucet).toBe(true);
  });
});
