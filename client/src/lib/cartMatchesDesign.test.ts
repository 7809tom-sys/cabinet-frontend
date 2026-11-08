import { describe, expect, it } from "vitest";
import { buildSurfaceCartLines } from "./surfaceCartLines";
import { isCartableBathroomFixtureSurface } from "./cartableBathroomFixture";
import { fixtureQuantitiesFromPlacements, reconcileCartWithDesign } from "./designCartReconciliation";

/**
 * The cart, quote and order must equal what is actually placed in the design.
 *
 * The reported symptom: a bathroom drawing with one vanity, one countertop, one
 * basin, one gold faucet, one black toilet and one linen cabinet produced a cart
 * with roughly five extra lines, and the popup footer said "11 added".
 *
 * Root cause: a cart line is only suppressed while its product id is present in the
 * fixture-quantity map. Only verified *fixture profiles* (toilet, bidet, tub,
 * shower) were seeded at zero. A vanity basin and a vanity faucet are fixtures too,
 * but they live on a `SinkFixture` rather than a furniture placement, so nothing
 * seeded them — and `buildSurfaceCartLines` fell through to its default `qty = 1`.
 * The basin and faucet therefore billed from the selection alone, even after being
 * replaced or deleted.
 */

const sink = (id: number, name = "PL-3608") => ({
  id,
  pelicanCode: name,
  name,
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  sellPrice: 55.15,
});

const faucet = (id: number) => ({
  id,
  pelicanCode: "PL-8112 BN",
  name: "PL-8112 BN Vanity Faucet",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  sellPrice: 120,
});

describe("fixture picks are identified as fixtures, not area materials", () => {
  it("treats vanity basins and vanity faucets as fixtures", () => {
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-3608", name: "PL-3608", category: "Sinks & Faucets" })).toBe(true);
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-8112 BN", name: "PL-8112 BN", category: "Sinks & Faucets" })).toBe(true);
  });

  it("treats verified toilet and tub profiles as fixtures", () => {
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-12044", name: "PL-12044" })).toBe(true);
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-02138 67\"", name: "PL-02138" })).toBe(true);
  });

  it("never treats flooring, tile or a countertop as a fixture", () => {
    expect(isCartableBathroomFixtureSurface({ name: "Planks", category: "Flooring" })).toBe(false);
    expect(isCartableBathroomFixtureSurface({ name: "Mosaic", category: "Tile & Mosaic" })).toBe(false);
    expect(isCartableBathroomFixtureSurface({ name: "Calacatta", category: "Quartz Slabs (Countertops)" })).toBe(false);
  });
});

describe("the cart only bills fixtures that are actually placed", () => {
  it("does not bill a basin that was picked but never placed", () => {
    // selectedSurfaces still holds the basin row; nothing placed it.
    const surfaces = [sink(560)];
    const fixtureQuantities = new Map<number, number>([[560, 0]]);
    const lines = buildSurfaceCartLines(surfaces, "wholesale", null, fixtureQuantities);
    expect(lines).toEqual([]);
  });

  it("bills a basin exactly once when one placement owns it", () => {
    const surfaces = [sink(560)];
    const fixtureQuantities = new Map<number, number>([[560, 1]]);
    const lines = buildSurfaceCartLines(surfaces, "wholesale", null, fixtureQuantities);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBe(1);
    expect(lines[0]!.masterCode).toBe("PEL-560");
  });

  it("stops billing a basin that was replaced, while keeping the replacement", () => {
    // The shopper swapped a rectangular basin for PL-3608. Both rows exist in the
    // selection; only the new one is installed.
    const surfaces = [sink(100, "PL-3609 Rectangular"), sink(560, "PL-3608 Round")];
    const fixtureQuantities = new Map<number, number>([[100, 0], [560, 1]]);
    const lines = buildSurfaceCartLines(surfaces, "wholesale", null, fixtureQuantities);
    expect(lines.map((line) => line.masterCode)).toEqual(["PEL-560"]);
  });

  it("seeds an unplaced basin to zero through the same predicate the designer uses", () => {
    // This mirrors the designer: every selected fixture pick is seeded at zero,
    // then only real placements increment it.
    const selected = [sink(560), faucet(900)];
    const seeded = new Map<number, number>();
    for (const surface of selected) {
      if (isCartableBathroomFixtureSurface(surface)) seeded.set(surface.id, 0);
    }
    expect(seeded.get(560)).toBe(0);
    expect(seeded.get(900)).toBe(0);
    const lines = buildSurfaceCartLines(selected, "wholesale", null, seeded);
    expect(lines).toEqual([]);
  });

  it("does not bill a default faucet that was filled in rather than chosen", () => {
    // `faucetCartQuantities` seeds an auto-filled faucet at zero; the surface row may
    // still be present from an earlier pick.
    const surfaces = [faucet(900)];
    const fixtureQuantities = new Map<number, number>([[900, 0]]);
    expect(buildSurfaceCartLines(surfaces, "wholesale", null, fixtureQuantities)).toEqual([]);
  });

  it("still bills area materials from the selection, because they are measured not placed", () => {
    const surfaces = [{ id: 1, pelicanCode: null, name: "Plank", category: "Flooring", sellPrice: 4, coverageSqFt: 20 }];
    const lines = buildSurfaceCartLines(surfaces, "wholesale", { backsplashSqFt: 0, flooringSqFt: 120 }, new Map());
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBeGreaterThan(0);
  });
});

describe("pot fillers keep their existing rule", () => {
  it("bills a mounted filler and zeroes an orphaned one", () => {
    const surfaces = [
      { id: 700, pelicanCode: "PL-8515 BN", name: "Pot filler", category: "Sinks & Faucets", subCategory: "Faucets", sellPrice: 400 },
    ];
    const q = fixtureQuantitiesFromPlacements({
      selected: surfaces as any,
      // The filler row is selected, and the design has one filler id that is NOT mounted.
      potFillers: [],
      zeroedPotFillerIds: [700],
    });
    expect(q.get(700)).toBe(0);
    expect(buildSurfaceCartLines(surfaces as any, "wholesale", null, q)).toEqual([]);
  });

  it("bills a mounted filler once", () => {
    const surfaces = [
      { id: 700, pelicanCode: "PL-8515 BN", name: "Pot filler", category: "Sinks & Faucets", subCategory: "Faucets", sellPrice: 400 },
    ];
    const q = fixtureQuantitiesFromPlacements({
      selected: surfaces as any,
      potFillers: [{ pelicanProductId: 700 }],
      zeroedPotFillerIds: [700],
    });
    expect(q.get(700)).toBe(1);
    expect(buildSurfaceCartLines(surfaces as any, "wholesale", null, q)).toHaveLength(1);
  });
});

describe("a sink is a fixture, never an area material", () => {
  it("classifies every Pelican basin family as a fixture", () => {
    // Regression: these were skipped because `surfaceRole` reports "sink", and an
    // early "not other => area material" test wrongly treated that as an area
    // product, so the replaced PL-3609 and the trial PL-3099 kept billing.
    for (const code of ["PL-3608", "PL-3609", "PL-3099", "PL-3609 White", "PL-1606 White", "PL-R2519W"]) {
      expect(isCartableBathroomFixtureSurface({ pelicanCode: code, category: "Sinks & Faucets", subCategory: "Sinks" }), code).toBe(true);
    }
  });

  it("still excludes kitchen and utility sinks from the fixture rule", () => {
    // They are fixtures of a kind, but they never belong to a bathroom design; the
    // tab classifier drops them before this point. What matters here is that they
    // are not mistaken for an AREA product either.
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-WS4519 R0 16g", category: "Sinks & Faucets", subCategory: "Sinks" })).toBe(false);
    expect(isCartableBathroomFixtureSurface({ pelicanCode: "PL-FC3020WS", category: "Sinks & Faucets", subCategory: "Sinks" })).toBe(false);
  });
});

describe("reconciling a cart against a design", () => {
  it("reports the orphan lines and the money they were adding", () => {
    const expected = [
      { masterCode: "PEL-560", styleId: -560, tier: "homeowner", unitPrice: 55.15, qty: 1, name: "basin", styleLabel: "x", distributorId: null, priceLocked: true, productKind: "surface", pelicanProductId: 560, category: "Sinks & Faucets" },
    ] as unknown as Parameters<typeof reconcileCartWithDesign>[1];
    const cart = [
      ...(expected as unknown as Parameters<typeof reconcileCartWithDesign>[0]),
      { masterCode: "PEL-557", styleId: -557, tier: "homeowner", unitPrice: 61.4, qty: 1, name: "replaced basin", styleLabel: "x", distributorId: null, priceLocked: true, productKind: "surface", pelicanProductId: 557, category: "Sinks & Faucets" },
    ] as unknown as Parameters<typeof reconcileCartWithDesign>[0];
    const result = reconcileCartWithDesign(cart, expected);
    expect(result.matches).toBe(false);
    expect(result.orphans.map((line) => line.masterCode)).toEqual(["PEL-557"]);
    expect(result.missing).toEqual([]);
  });

  it("matches once the orphan is gone", () => {
    const expected = [
      { masterCode: "PEL-560", styleId: -560, tier: "homeowner", unitPrice: 55.15, qty: 1, name: "basin", styleLabel: "x", distributorId: null, priceLocked: true, productKind: "surface", pelicanProductId: 560, category: "Sinks & Faucets" },
    ] as unknown as Parameters<typeof reconcileCartWithDesign>[1];
    expect(reconcileCartWithDesign(expected as unknown as Parameters<typeof reconcileCartWithDesign>[0], expected).matches).toBe(true);
  });
});
