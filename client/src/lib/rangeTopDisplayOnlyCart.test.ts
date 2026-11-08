import { describe, expect, it } from "vitest";
import {
  buildDesignCabinetCartLines,
  buildDesignPreviewPricingLines,
  calculateCartSubtotal,
} from "./designCartLines";
import { buildSurfaceCartLines, type SurfacePick } from "./surfaceCartLines";
import { isRangeTopPlacement } from "./rangeTopDisplayOnly";
import type { PlacedCabinet } from "@/lib/design";

/**
 * Owner rule (Tom, CabinetDealz): the eight range tops stay available in the 3D
 * Designer for show, but they are never added to the cart, quote, or order. The
 * cabinet under the range top — the sink/range base — stays billable.
 */

const rangeTopIds = [30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008];

const sinkBase = {
  uid: "sb36",
  cabinetId: 3600,
  masterCode: "SB36",
  description: '36" Sink Base Cabinet',
  category: "Base",
  subCategory: "Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
} as PlacedCabinet;

/** The first-class countertop-opening appliance the Designer mints for a range top. */
const rangeTopAppliance = (productId: number, code: string): PlacedCabinet =>
  ({
    uid: "sb36:cooktop",
    cabinetId: 0,
    masterCode: code,
    description: 'Gas Range Top 30"',
    category: "Appliance",
    subCategory: "Cooktop",
    placement: "appliance",
    applianceRole: "countertop-opening",
    applianceProductId: productId,
    applianceCatalogCode: code,
    applianceCatalogName: 'Gas Range Top 30"',
    // A price is deliberately present so the test fails if identity alone is not
    // what excludes the line.
    applianceCatalogPrice: 599,
    cooktopConversionStatus: "converted",
    x: 0,
    y: 0,
    width: 36,
    depth: 24,
    height: 1.5,
    mountBottom: 34.5,
    rotation: 0,
  }) as PlacedCabinet;

const common = {
  styleId: 330001,
  distributorId: 210001,
  tier: "homeowner" as const,
  styleNameById: new Map([[330001, "Ashford Style"]]),
  unitPriceFor: () => 365.95,
};

describe("a placed range top never becomes a cart or quote line", () => {
  it.each(rangeTopIds.map((id) => [id] as const))(
    "excludes range-top row %i while keeping the base under it",
    (id) => {
      const cooktop = rangeTopAppliance(id, "SC-RT-GAS-30");
      const cart = buildDesignCabinetCartLines({
        ...common,
        placed: [sinkBase, cooktop],
      });
      const preview = buildDesignPreviewPricingLines({
        ...common,
        placed: [sinkBase, cooktop],
      });

      expect(cart.map((line) => line.masterCode)).toEqual(["SB36"]);
      expect(preview.map((line) => line.masterCode)).toEqual(["SB36"]);
      expect(calculateCartSubtotal(cart)).toBe(365.95);
      expect(cart.every((line) => line.unitPrice !== 599)).toBe(true);
    },
  );

  it("excludes the legacy sink-base range-top conversion (base plus opening appliance)", () => {
    const converted = [
      { ...sinkBase, sinkTopType: null } as PlacedCabinet,
      rangeTopAppliance(30001, "CATALOG-APPLIANCE-30001"),
    ];
    expect(
      buildDesignCabinetCartLines({ ...common, placed: converted }).map(
        (line) => line.masterCode,
      ),
    ).toEqual(["SB36"]);
    expect(
      buildDesignPreviewPricingLines({ ...common, placed: converted }).map(
        (line) => line.masterCode,
      ),
    ).toEqual(["SB36"]);
  });

  it("excludes a range top that carries the Range Tops source category but no known id", () => {
    const unknownRow = {
      ...rangeTopAppliance(99999, "SC-RT-UNKNOWN-30"),
      applianceProductId: 99999,
      category: "Range Tops",
    } as PlacedCabinet;
    expect(
      buildDesignCabinetCartLines({
        ...common,
        placed: [sinkBase, unknownRow],
      }).map((line) => line.masterCode),
    ).toEqual(["SB36"]);
  });

  it("still bills every other countertop-opening appliance unchanged", () => {
    const inductionCooktop = {
      ...rangeTopAppliance(77, "CTGAS30"),
      applianceProductId: 77,
      applianceCatalogCode: "CTGAS30",
      applianceCatalogName: "30 in. Gas Cooktop",
      applianceCatalogPrice: 899,
    } as PlacedCabinet;
    expect(isRangeTopPlacement(inductionCooktop)).toBe(false);
    expect(
      buildDesignCabinetCartLines({
        ...common,
        placed: [sinkBase, inductionCooktop],
      }).map((line) => line.masterCode),
    ).toEqual(["SB36", "CTGAS30"]);
  });

  it("keeps Auto Design fixtures billable except a range top", () => {
    // The Auto Design build places the same records; the range top it may seat
    // is skipped by identity, and the base under it stays on the order.
    const autoBuilt = [sinkBase, rangeTopAppliance(30006, "SC-RT-SMOOTH-36")];
    const cart = buildDesignCabinetCartLines({ ...common, placed: autoBuilt });
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({
      masterCode: "SB36",
      unitPrice: 365.95,
      priceLocked: true,
    });
  });
});

describe("a range-top surface pick never becomes a cart line", () => {
  const rangeTopPick: SurfacePick = {
    id: 30001,
    name: 'Gas Range Top 30"',
    category: "Range Tops",
    subCategory: "Gas",
    size: '30"',
    sellPrice: 599,
  };

  it("skips the priced range-top pick and leaves other picks alone", () => {
    const faucet: SurfacePick = {
      id: 769,
      name: "Kitchen Faucet",
      category: "Sinks & Faucets",
      subCategory: "Faucets",
      sellPrice: 84.39,
    };
    expect(
      buildSurfaceCartLines([rangeTopPick, faucet], "homeowner").map(
        (line) => line.masterCode,
      ),
    ).toEqual(["PEL-769"]);
    expect(buildSurfaceCartLines([rangeTopPick], "homeowner")).toEqual([]);
  });

  it("recognizes a range top by item code and by stable id, not by its name", () => {
    const byCode: SurfacePick = {
      ...rangeTopPick,
      id: 1,
      pelicanCode: "SC-RT-INDUCTION-36",
    } as SurfacePick;
    const byId: SurfacePick = { ...rangeTopPick, category: "Sinks & Faucets" };
    const renamed: SurfacePick = {
      ...rangeTopPick,
      id: 4242,
      name: 'Gas Range Top 30"',
      category: "Sinks & Faucets",
    };
    expect(buildSurfaceCartLines([byCode], "homeowner")).toEqual([]);
    expect(buildSurfaceCartLines([byId], "homeowner")).toEqual([]);
    // A display name alone is never the rule.
    expect(buildSurfaceCartLines([renamed], "homeowner")).toHaveLength(1);
  });
});
