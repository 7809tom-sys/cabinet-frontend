import { describe, expect, it } from "vitest";
import { isValidZipPrefix, normalizeZipPrefix, parseZipPrefixes, serializeZipPrefixes } from "./shippingZipPrefixes";

describe("shipping ZIP prefix editor", () => {
  it("normalizes individual ZIP code entries without exceeding five digits", () => {
    expect(normalizeZipPrefix(" 30301 ")).toBe("30301");
    expect(normalizeZipPrefix("30301-9999")).toBe("30301");
    expect(normalizeZipPrefix("303019")).toBe("30301");
  });

  it("keeps multiple unique ZIP codes or prefixes in their stored comma-delimited format", () => {
    expect(parseZipPrefixes("30301, 34230,30301,30")).toEqual(["30301", "34230", "30"]);
    expect(serializeZipPrefixes(["30301", "34230", "30301", "30"])).toBe("30301,34230,30");
  });

  it("accepts only one-to-five digit ZIP entries", () => {
    expect(isValidZipPrefix("30")).toBe(true);
    expect(isValidZipPrefix("34230")).toBe(true);
    expect(isValidZipPrefix("")).toBe(false);
    expect(isValidZipPrefix("342301")).toBe(false);
    expect(isValidZipPrefix("34A30")).toBe(false);
  });
});
