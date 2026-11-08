import { describe, expect, it } from "vitest";
import {
  RANGE_TOP_CATALOG_CATEGORY,
  RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL,
  RANGE_TOP_PRODUCT_IDS,
  isRangeTopPlacement,
  isRangeTopProductId,
  isRangeTopSurfacePick,
  isSoldDesignPlacement,
  rangeTopPriceLabel,
} from "./rangeTopDisplayOnly";

const sinkBase = {
  uid: "sb36",
  masterCode: "SB36",
  description: '36" Sink Base Cabinet',
  category: "Base",
  subCategory: "Sink Base",
  placement: "base",
};

const rangeTopAppliance = (overrides: Record<string, unknown> = {}) => ({
  uid: "sb36:cooktop",
  masterCode: "SC-RT-GAS-30",
  description: 'Gas Range Top 30"',
  category: "Appliance",
  subCategory: "Cooktop",
  placement: "appliance",
  applianceRole: "countertop-opening" as const,
  applianceCatalogCode: "SC-RT-GAS-30",
  applianceCatalogName: 'Gas Range Top 30"',
  applianceProductId: 30001,
  ...overrides,
});

describe("range tops are display-only by catalog identity", () => {
  it("lists the eight Stone Creek range tops by stable id", () => {
    expect(RANGE_TOP_PRODUCT_IDS).toHaveLength(8);
    for (const id of RANGE_TOP_PRODUCT_IDS)
      expect(isRangeTopProductId(id)).toBe(true);
    expect(isRangeTopProductId(1234)).toBe(false);
  });

  it("recognizes every range top by category, item code, or id — never by display name", () => {
    for (const id of RANGE_TOP_PRODUCT_IDS) {
      expect(
        isRangeTopSurfacePick({ id, category: RANGE_TOP_CATALOG_CATEGORY }),
      ).toBe(true);
    }
    expect(
      isRangeTopSurfacePick({
        id: 1,
        category: "sinks & faucets",
        pelicanCode: "PL-3099 Bone",
      }),
    ).toBe(false);
    expect(
      isRangeTopSurfacePick({ id: 30001, category: null, pelicanCode: null }),
    ).toBe(true);
    expect(
      isRangeTopSurfacePick({
        id: 1,
        category: null,
        pelicanCode: "SC-RT-ELEC-36",
      }),
    ).toBe(true);
  });

  it("treats a placed range-top appliance as display-only and the base under it as billable", () => {
    expect(isRangeTopPlacement(rangeTopAppliance())).toBe(true);
    expect(isSoldDesignPlacement(rangeTopAppliance())).toBe(false);
    expect(isRangeTopPlacement(sinkBase)).toBe(false);
    expect(isSoldDesignPlacement(sinkBase)).toBe(true);
  });

  it("recognizes the legacy sink-base range-top mode without billing the base itself", () => {
    for (const mode of [
      "gas",
      "electric",
      "induction",
      "smooth-top",
    ] as const) {
      expect(isRangeTopPlacement({ ...sinkBase, sinkTopType: mode })).toBe(
        false,
      );
      expect(
        isRangeTopPlacement({
          ...sinkBase,
          placement: "appliance",
          sinkTopType: mode,
        }),
      ).toBe(true);
    }
    // A real sink fixture on the same base is billable.
    expect(isRangeTopPlacement({ ...sinkBase, sinkTopType: "sink" })).toBe(
      false,
    );
  });

  it("recognizes the synthetic appliance identity the Designer mints for a layout visual", () => {
    for (const type of [
      "gas",
      "electric",
      "induction",
      "smooth-top",
    ] as const) {
      expect(
        isRangeTopPlacement(
          rangeTopAppliance({
            applianceCatalogCode: `CATALOG-APPLIANCE-${type}`,
            applianceProductId: null,
          }),
        ),
      ).toBe(true);
    }
    expect(
      isRangeTopPlacement(
        rangeTopAppliance({
          applianceCatalogCode: "CATALOG-APPLIANCE-30008",
          applianceProductId: null,
        }),
      ),
    ).toBe(true);
  });

  it("leaves every other appliance billable", () => {
    const dishwasher = {
      ...sinkBase,
      placement: "appliance",
      applianceRole: "base-height" as const,
      masterCode: "DW-24",
      category: "Appliance",
      applianceCatalogCode: "DW-24",
    };
    expect(isRangeTopPlacement(dishwasher)).toBe(false);
    const microwave = {
      ...sinkBase,
      placement: "appliance",
      applianceRole: "countertop-opening" as const,
      masterCode: "MW-30",
      applianceCatalogCode: "MW-30",
    };
    expect(isRangeTopPlacement(microwave)).toBe(false);
  });

  it("replaces the price only for a range top", () => {
    expect(
      rangeTopPriceLabel({ id: 30001, category: RANGE_TOP_CATALOG_CATEGORY }),
    ).toBe(RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL);
    expect(
      rangeTopPriceLabel({ id: 42, category: "Sinks & Faucets" }),
    ).toBeNull();
    expect(rangeTopPriceLabel(null)).toBeNull();
  });
});
