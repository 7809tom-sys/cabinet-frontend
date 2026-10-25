import { describe, expect, it } from "vitest";
import { US_CABINET_DEPOT_AVAILABILITY_SOURCES, US_CABINET_DEPOT_WAREHOUSES } from "./vendorWarehouseNetwork";

describe("US Cabinet Depot warehouse network", () => {
  it("contains the eight workbook locations with valid shipping ZIPs", () => {
    expect(US_CABINET_DEPOT_WAREHOUSES).toHaveLength(8);
    expect(US_CABINET_DEPOT_WAREHOUSES.map((warehouse) => warehouse.zip)).toEqual([
      "30071", "02766", "60446", "23005", "33073", "92337", "77038", "84043",
    ]);
    expect(new Set(US_CABINET_DEPOT_WAREHOUSES.map((warehouse) => warehouse.zip)).size).toBe(8);
    for (const warehouse of US_CABINET_DEPOT_WAREHOUSES) {
      expect(warehouse.address).toBeTruthy();
      expect(warehouse.city).toBeTruthy();
      expect(warehouse.phone).toMatch(/\d{3}-\d{3}-\d{4}/);
    }
  });

  it("keeps each availability PDF as a source reference, not an inventory claim", () => {
    expect(US_CABINET_DEPOT_AVAILABILITY_SOURCES).toHaveLength(8);
    expect(US_CABINET_DEPOT_AVAILABILITY_SOURCES.every((source) => source.endsWith(".pdf"))).toBe(true);
  });
});
