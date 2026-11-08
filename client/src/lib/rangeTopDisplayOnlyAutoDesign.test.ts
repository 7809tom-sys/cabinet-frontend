import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDesignCabinetCartLines,
  calculateCartSubtotal,
} from "@/lib/designCartLines";
import { isRangeTopPlacement } from "@/lib/rangeTopDisplayOnly";
import type { PlacedCabinet } from "@/lib/design";

/**
 * Auto Design must not add a cart/quote line for a range top.
 *
 * Auto Design commits ordinary `PlacedCabinet` records and then hands the plan
 * to the same cart builders as manual placement, so the rule is verified on the
 * exact shape Auto Design commits: a sink base it auto-placed, the seeded
 * basin, and the countertop-opening range top it may seat over the base.
 */
const source = readFileSync(
  resolve(process.cwd(), "client/src/lib/designCartLines.ts"),
  "utf8",
);

const autoDesignBase = {
  uid: "auto-sb36",
  cabinetId: 3600,
  masterCode: "SB36",
  description: '36" Sink Base Cabinet',
  category: "Base",
  subCategory: "Sink Base",
  placement: "base",
  x: 42,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
} as PlacedCabinet;

const autoDesignRangeTop = {
  uid: "auto-sb36:cooktop",
  cabinetId: 0,
  masterCode: "SC-RT-ELEC-36",
  description: 'Electric Range Top 36"',
  category: "Appliance",
  subCategory: "Cooktop",
  placement: "appliance",
  applianceRole: "countertop-opening",
  applianceProductId: 30004,
  applianceCatalogCode: "SC-RT-ELEC-36",
  applianceCatalogName: 'Electric Range Top 36"',
  applianceCatalogPrice: 529,
  cooktopConversionStatus: "converted",
  x: 42,
  y: 0,
  width: 36,
  depth: 24,
  height: 1.5,
  mountBottom: 34.5,
  rotation: 0,
} as PlacedCabinet;

describe("Auto Design with a range top adds no line for it", () => {
  it("adds no cart or quote line for the auto-placed range top", () => {
    const lines = buildDesignCabinetCartLines({
      placed: [autoDesignBase, autoDesignRangeTop],
      styleId: 540005,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[540005, "Aspen"]]),
      unitPriceFor: (cabinet) => (cabinet.masterCode === "SB36" ? 421.5 : null),
    });
    expect(lines.map((line) => line.masterCode)).toEqual(["SB36"]);
    expect(calculateCartSubtotal(lines)).toBe(421.5);
  });

  it("keeps the cabinet under the range top in the cart", () => {
    const lines = buildDesignCabinetCartLines({
      placed: [autoDesignBase, autoDesignRangeTop],
      styleId: 540005,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[540005, "Aspen"]]),
      unitPriceFor: () => 421.5,
    });
    expect(lines).toEqual([
      expect.objectContaining({
        masterCode: "SB36",
        qty: 1,
        unitPrice: 421.5,
        priceLocked: true,
      }),
    ]);
  });

  it("enforces the rule in both cart builders, not only in the caller", () => {
    expect(source).toMatch(
      /buildDesignCabinetCartLines[\s\S]*?isRangeTopPlacement\(cabinet\)[\s\S]*?continue;/,
    );
    expect(source).toMatch(
      /buildDesignPreviewPricingLines[\s\S]*?isRangeTopPlacement\(cabinet\)[\s\S]*?continue;/,
    );
    expect(isRangeTopPlacement(autoDesignRangeTop)).toBe(true);
    expect(isRangeTopPlacement(autoDesignBase)).toBe(false);
  });
});
