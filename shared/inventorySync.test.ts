import { describe, expect, it } from "vitest";
import {
  classifyInventoryRows,
  descriptiveEditAllowed,
  parseInventoryCsv,
  parseWholesaleCsv,
  priceChangeAllowed,
  takeRateLimit,
  wholesalePriceDisposition,
} from "./inventorySync";

describe("inventory upload", () => {
  it("reports an unknown SKU and does not treat it as a new product", () => {
    const parsed = parseInventoryCsv("SKU,Quantity on hand,Lead time days\nB24,4,7\nNOPE,1,3\n");
    const classified = classifyInventoryRows(parsed.rows, new Set(["B24"]));
    expect(classified.applicable.map((row) => row.sku)).toEqual(["B24"]);
    expect(classified.unknown[0]).toMatchObject({ sku: "NOPE" });
  });

  it("rejects a bad quantity before apply", () => {
    const parsed = parseInventoryCsv("SKU,Quantity on hand\nB24,-1\n");
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.issues[0]?.message).toMatch(/Quantity/);
  });
});

describe("wholesaleIncreaseRequiresApproval", () => {
  it("queues an increase, applies a decrease, and applies a first price", () => {
    expect(wholesalePriceDisposition(null, 40, true)).toBe("apply");
    expect(wholesalePriceDisposition(0, 40, true)).toBe("apply");
    expect(wholesalePriceDisposition(50, 40, true)).toBe("apply");
    expect(wholesalePriceDisposition(50, 60, true)).toBe("queue");
    expect(wholesalePriceDisposition(50, 50, true)).toBe("noop");
  });

  it("applies an increase only when the owner turns the setting off", () => {
    expect(wholesalePriceDisposition(50, 60, false)).toBe("apply");
  });

  it("respects import locks and conflict review", () => {
    expect(priceChangeAllowed({ lockedFields: ["vendorWholesale"], conflictStatus: "none", field: "vendorWholesale" })).toMatch(/locked/);
    expect(priceChangeAllowed({ lockedFields: [], conflictStatus: "conflict", field: "vendorWholesale" })).toMatch(/conflict/);
    expect(descriptiveEditAllowed({ field: "conflictReason", lockedFields: [] })).toMatch(/conflict/);
    expect(descriptiveEditAllowed({ field: "supplierDescription", lockedFields: ["supplierDescription"] })).toMatch(/locked/);
  });
});

describe("wholesale csv", () => {
  it("reads a wholesale column", () => {
    const parsed = parseWholesaleCsv("SKU,Wholesale\nB24,125.5\n");
    expect(parsed.rows).toEqual([{ row: 2, sku: "B24", wholesale: 125.5 }]);
  });
});

describe("sync rate limit", () => {
  it("allows 30 calls in a window and then refuses", () => {
    const buckets = new Map();
    for (let i = 0; i < 30; i++) expect(takeRateLimit(buckets, "key", 1_000)).toBe(true);
    expect(takeRateLimit(buckets, "key", 1_000)).toBe(false);
    expect(takeRateLimit(buckets, "key", 61_000)).toBe(true);
  });
});
