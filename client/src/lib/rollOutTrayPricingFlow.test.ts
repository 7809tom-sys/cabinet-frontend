import { describe, expect, it } from "vitest";
import { buildMaterialsListRows, materialsListCsv, materialsListPricedTotal } from "./designMaterialsList";
import { resolveLockedCheckoutUnitPrice } from "./checkoutPriceLock";
import { buildRollOutLines, rollOutTrayCartItems, type TrayOptionForStyle, type TrayPlaced } from "./rollOutTrayMatch";

const styleId = 330002;
const distributorId = 210001;
const homeownerPrices = new Map([
  [18, 73.46],
  [21, 76.35],
  [24, 79.89],
  [27, 85.80],
  [30, 93.06],
  [33, 101.26],
  [36, 107.65],
]);

describe("rollout tray price flow", () => {
  const widths = Array.from(homeownerPrices.keys());
  const quantities = [1, 2, 3, 4, 5, 1, 5];
  const options: TrayOptionForStyle[] = widths.map((width, index) => ({
    cabinetId: 10920002 + index,
    masterCode: `UNIV-ROT${width}`,
    description: `Universal rollout tray for ${width}-inch cabinet`,
    styleId,
    width,
    unitPrice: homeownerPrices.get(width)!,
  }));
  const placed: TrayPlaced[] = widths.map((width, index) => ({
    placement: "base",
    category: "Base",
    subCategory: "Base Cabinets",
    masterCode: `B${width}`,
    numberOfDoors: 1,
    isCornerCabinet: false,
    nominalWidth: width,
    width,
    effectiveStyleId: styleId,
    rolloutQty: quantities[index],
  }));
  const lines = buildRollOutLines(placed, new Map([[styleId, options]]));
  const cartItems = rollOutTrayCartItems({
    lines,
    styleNameById: new Map([[styleId, "Aura Cream"]]),
    distributorId,
    tier: "homeowner",
  });

  it("maps every eligible B18–B36 width to the exact priced Clark & Son SKU and retains quantities one through five", () => {
    expect(lines.map((line) => [line.masterCode, line.qty, line.unitPrice])).toEqual(widths.map((width, index) => [
      `UNIV-ROT${width}`,
      quantities[index],
      homeownerPrices.get(width),
    ]));
    expect(cartItems.every((item) => item.distributorId === distributorId && item.styleId === styleId)).toBe(true);
  });

  it("shows the same unit prices and extended totals in Materials & Parts and CSV", () => {
    const buildRows = lines.map((line) => ({
      code: line.masterCode,
      description: line.description ?? line.masterCode,
      widthIn: line.width,
      heightIn: 0,
      depthIn: 0,
      placement: "accessory",
      color: "Aura Cream",
      qty: line.qty,
      unitPrice: line.unitPrice,
    }));
    const rows = buildMaterialsListRows({
      buildRows,
      pricingLines: cartItems,
      distributorNames: new Map([[distributorId, "Clark & Son"]]),
      defaultDistributorId: distributorId,
      defaultStyleName: "Aura Cream",
    });
    const expectedTotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

    expect(materialsListPricedTotal(rows)).toBeCloseTo(expectedTotal, 8);
    for (const item of cartItems) {
      expect(rows.find((row) => row.code === item.masterCode)).toMatchObject({
        supplier: "Clark & Son",
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.qty,
      });
    }
    const csv = materialsListCsv(rows);
    expect(csv).toContain("UNIV-ROT18");
    expect(csv).toContain("73.46");
    expect(csv).toContain("UNIV-ROT36");
    expect(csv).toContain("107.65");
  });

  it("persists each cabinet quantity and refreshes checkout from the live exact-distributor price", () => {
    const saved = JSON.parse(JSON.stringify(placed)) as TrayPlaced[];
    expect(saved.map((cabinet) => cabinet.rolloutQty)).toEqual(quantities);
    expect(resolveLockedCheckoutUnitPrice({
      priceLocked: false,
      storedUnitPrice: 1,
      recomputedUnitPrice: cartItems[0]!.unitPrice,
    })).toBe(73.46);
  });
});
