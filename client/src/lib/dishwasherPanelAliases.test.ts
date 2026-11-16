import { describe, expect, it } from "vitest";
import {
  DISHWASHER_PANEL_ALIAS_CODES,
  dishwasherPanelAliasIds,
  dishwasherPanelAliasKey,
  isDishwasherPanelAliasCode,
  resolveDishwasherPanelAliasPrice,
  sameDishwasherPanelAlias,
} from "./dishwasherPanelAliases";

const BEP = { id: 9390016, masterCode: "BEP(DWR)3" };
const DWR3 = { id: 15480031, masterCode: "DWR3" };
const DW3 = { id: 99, masterCode: "DW3" };

describe("dishwasher panel aliases", () => {
  it("treats DWR3, DW3, and BEP(DWR)3 as the same panel under any punctuation", () => {
    expect([...DISHWASHER_PANEL_ALIAS_CODES].sort()).toEqual(["BEP(DWR)3", "DW3", "DWR3"]);
    expect(dishwasherPanelAliasKey("BEP(DWR)3")).toBe("BEPDWR3");
    expect(isDishwasherPanelAliasCode("BEP(DWR)3")).toBe(true);
    expect(isDishwasherPanelAliasCode("bepdwr3")).toBe(true);
    expect(isDishwasherPanelAliasCode("DWR3")).toBe(true);
    expect(isDishwasherPanelAliasCode("dwr-3")).toBe(true);
    expect(isDishwasherPanelAliasCode("DW3")).toBe(true);
    expect(isDishwasherPanelAliasCode("dw-3")).toBe(true);
    expect(sameDishwasherPanelAlias("DWR3", "BEP(DWR)3")).toBe(true);
    expect(sameDishwasherPanelAlias("DW3", "DWR3")).toBe(true);
    expect(isDishwasherPanelAliasCode("DW-24")).toBe(false);
    expect(isDishwasherPanelAliasCode("BEP2535")).toBe(false);
    expect(isDishwasherPanelAliasCode("REPV2496")).toBe(false);
    expect(sameDishwasherPanelAlias("DWR3", "BEP2535")).toBe(false);
  });

  it("resolves DWR3 and DW3 to a priced BEP(DWR)3 entry, and the other way around", () => {
    const styleId = 330011;
    const priceMap = new Map<string, number>([[`${BEP.id}:${styleId}`, 65.19]]);
    const catalog = [BEP, DWR3, DW3];
    expect(resolveDishwasherPanelAliasPrice(DWR3, styleId, priceMap, catalog)).toBe(65.19);
    expect(resolveDishwasherPanelAliasPrice(DW3, styleId, priceMap, catalog)).toBe(65.19);
    expect(resolveDishwasherPanelAliasPrice(BEP, styleId, priceMap, catalog)).toBe(65.19);

    const dwrPriced = new Map<string, number>([[`${DWR3.id}:${styleId}`, 63.2]]);
    expect(resolveDishwasherPanelAliasPrice(BEP, styleId, dwrPriced, catalog)).toBe(63.2);
    expect(resolveDishwasherPanelAliasPrice(DWR3, styleId, dwrPriced, catalog)).toBe(63.2);
  });

  it("prefers the item's own priced id and does not invent a price", () => {
    const styleId = 330011;
    const both = new Map<string, number>([
      [`${BEP.id}:${styleId}`, 65.19],
      [`${DWR3.id}:${styleId}`, 63.2],
    ]);
    expect(resolveDishwasherPanelAliasPrice(DWR3, styleId, both, [BEP, DWR3])).toBe(63.2);
    expect(resolveDishwasherPanelAliasPrice(BEP, styleId, both, [BEP, DWR3])).toBe(65.19);
    expect(resolveDishwasherPanelAliasPrice(DWR3, styleId, new Map(), [BEP])).toBeNull();
    expect(resolveDishwasherPanelAliasPrice(DWR3, null, both, [BEP])).toBeNull();
    // A non-alias board never borrows the dishwasher-panel price.
    expect(resolveDishwasherPanelAliasPrice(
      { id: 15570001, masterCode: "BEP2535" },
      styleId,
      both,
      [BEP],
    )).toBeNull();
  });

  it("lists the item's id first, then other alias ids from the catalog", () => {
    expect(dishwasherPanelAliasIds(DWR3, [BEP, DW3])).toEqual([DWR3.id, BEP.id, DW3.id]);
    expect(dishwasherPanelAliasIds({ id: 15570001, masterCode: "BEP2535" }, [BEP])).toEqual([15570001]);
  });
});
