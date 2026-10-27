import { describe, expect, it } from "vitest";
import { pelicanVendorCostLabel } from "./vendorCostLabel";

describe("vendor cost label", () => {
  it("shows the vendor wholesale amount and not a retail fallback", () => {
    expect(pelicanVendorCostLabel("80.5")).toBe("$80.50");
    expect(pelicanVendorCostLabel(0)).toBe("No cost on file");
    expect(pelicanVendorCostLabel(null)).toBe("No cost on file");
    expect(pelicanVendorCostLabel("")).toBe("No cost on file");
  });
});