import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildMaterialsListRows,
  materialsListPricedTotal,
} from "./designMaterialsList";

/**
 * Owner rule (Tom, CabinetDealz): the eight range tops are shown and rendered in
 * the Designer but are never quoted, invoiced, or ordered. This covers the
 * Materials & Parts list (the Designer's quote sheet) and the build sheet that
 * feeds it.
 */

const designSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/DesignTool.tsx"),
  "utf8",
);

const rangeTopRow = {
  sourceUids: ["sb36:cooktop"],
  code: "SC-RT-GAS-30",
  description: 'Gas Range Top 30"',
  widthIn: 36,
  heightIn: 1.5,
  depthIn: 24,
  placement: "appliance",
  qty: 1,
  unitPrice: 599,
  pricingUnitPrice: 599,
};

const baseRow = {
  sourceUids: ["sb36"],
  code: "SB36",
  description: '36" Sink Base Cabinet',
  widthIn: 36,
  heightIn: 34.5,
  depthIn: 24,
  placement: "base",
  qty: 1,
  unitPrice: 365.95,
  pricingUnitPrice: 365.95,
};

describe("the quote / materials list never carries a range top", () => {
  it("drops the range-top build row and keeps the base under it", () => {
    const rows = buildMaterialsListRows({
      buildRows: [baseRow, rangeTopRow],
      pricingLines: [],
    });
    expect(rows.map((row) => row.code)).toEqual(["SB36"]);
    expect(materialsListPricedTotal(rows)).toBe(365.95);
  });

  it("drops a range-top surface selection that has no cart line", () => {
    const rows = buildMaterialsListRows({
      buildRows: [baseRow],
      pricingLines: [],
      selectedSurfaces: [
        {
          id: 30001,
          pelicanCode: "SC-RT-GAS-30",
          slug: "sc-gas-range-top-30",
          name: 'Gas Range Top 30"',
          category: "Range Tops",
          subCategory: "Gas",
          size: '30"',
          imageUrl: null,
          sellPrice: 599,
        },
      ],
    });
    expect(rows.map((row) => row.code)).toEqual(["SB36"]);
  });

  it("never re-adds the range top as a PEL row in the quote", () => {
    const rows = buildMaterialsListRows({
      buildRows: [baseRow],
      pricingLines: [
        {
          masterCode: "PEL-30001",
          name: 'Gas Range Top 30"',
          styleId: -30001,
          styleLabel: 'Range Tops · 30"',
          distributorId: null,
          tier: "homeowner",
          unitPrice: 599,
          priceLocked: true,
          qty: 1,
          productKind: "surface",
          pelicanProductId: 30001,
          category: "Range Tops",
        },
      ],
      selectedSurfaces: [
        {
          id: 30001,
          pelicanCode: "SC-RT-GAS-30",
          slug: "sc-gas-range-top-30",
          name: 'Gas Range Top 30"',
          category: "Range Tops",
          subCategory: "Gas",
          size: '30"',
          imageUrl: null,
          sellPrice: 599,
        },
      ],
    });
    expect(rows.some((row) => row.code.includes("30001"))).toBe(false);
    expect(rows.map((row) => row.code)).toEqual(["SB36"]);
  });
});

describe("the Designer build sheet skips a placed range top", () => {
  it("filters the range-top placement before it becomes a build-sheet row", () => {
    expect(designSource).toMatch(/if \(isRangeTopPlacement\(p\)\) continue;/);
  });
});
