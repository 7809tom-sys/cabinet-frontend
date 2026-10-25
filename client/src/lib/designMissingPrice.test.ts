import { describe, expect, it } from "vitest";
import { summarizeMissingPrices, missingPriceBannerText, missingPriceLineLabel, checkoutBlockedByMissingPrices } from "./designMissingPrice";
import type { PlacedCabinet } from "./design";

const cab = (over: Partial<PlacedCabinet> & { uid: string; masterCode: string }): PlacedCabinet => ({
  cabinetId: 1, description: over.masterCode, placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
  ...over,
});

describe("summarizeMissingPrices (Part 1)", () => {
  const priced = new Map<string, number>([["B36", 300], ["BER36", 324.14]]);
  const unitPriceFor = (c: PlacedCabinet) => priced.get(c.masterCode) ?? null;
  const styleIdFor = () => 330014;

  it("flags every price-required cabinet that has no positive price and never reports $0", () => {
    const summary = summarizeMissingPrices({
      placed: [
        cab({ uid: "a", masterCode: "B36" }),
        cab({ uid: "b", masterCode: "ERB36", cabinetId: 9360042 }),
        cab({ uid: "c", masterCode: "ZZZ-NOPRICE", cabinetId: 77 }),
      ],
      styleId: 330014, pricesReady: true, unitPriceFor, styleIdFor,
    });
    expect(summary.count).toBe(2);
    expect(Array.from(summary.uids)).toEqual(["b", "c"]);
    expect(summary.codes).toEqual(["ERB36", "ZZZ-NOPRICE"]);
    expect(checkoutBlockedByMissingPrices(summary)).toBe(true);
  });

  it("treats a $0 price as missing", () => {
    const summary = summarizeMissingPrices({
      placed: [cab({ uid: "a", masterCode: "B36" })],
      styleId: 1, pricesReady: true, unitPriceFor: () => 0, styleIdFor,
    });
    expect(summary.count).toBe(1);
  });

  it("does not flag appliances, closet parts, Designer-only visuals, or secondary filler halves", () => {
    const summary = summarizeMissingPrices({
      placed: [
        cab({ uid: "r", masterCode: "RANGE-30" }),
        cab({ uid: "v", masterCode: "COOKTOP-GAS-30", cabinetId: 0 }),
        cab({ uid: "f2", masterCode: "F342", fillerBillingRole: "secondary" }),
      ],
      styleId: 1, pricesReady: true, unitPriceFor: () => null, styleIdFor,
    });
    expect(summary.count).toBe(0);
    expect(checkoutBlockedByMissingPrices(summary)).toBe(false);
  });

  it("waits for the price query before flagging anything", () => {
    const summary = summarizeMissingPrices({
      placed: [cab({ uid: "a", masterCode: "B36" })],
      styleId: 1, pricesReady: false, unitPriceFor: () => null, styleIdFor,
    });
    expect(summary.count).toBe(0);
  });

  it("formats the banner and line labels", () => {
    expect(missingPriceBannerText(1)).toBe("1 cabinet missing price.");
    expect(missingPriceBannerText(3)).toBe("3 cabinets missing prices.");
    expect(missingPriceLineLabel("ERB36")).toBe("PRICE MISSING — ERB36");
  });
});
