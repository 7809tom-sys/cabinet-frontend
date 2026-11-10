import { describe, expect, it } from "vitest";
import {
  CUSTOMER_OFFERING_GROUP,
  customerOfferingsAreVisible,
  isCustomerOfferingCatalogVendor,
  isCustomerOfferingPath,
} from "./customerOfferings";

describe("customer offerings switch", () => {
  it("defaults to yes when nothing is stored", () => {
    expect(customerOfferingsAreVisible(undefined)).toBe(true);
    expect(customerOfferingsAreVisible(null)).toBe(true);
    expect(customerOfferingsAreVisible("")).toBe(true);
    expect(customerOfferingsAreVisible("yes")).toBe(true);
  });

  it("hides the group only for an explicit no", () => {
    expect(customerOfferingsAreVisible("no")).toBe(false);
    expect(customerOfferingsAreVisible("off")).toBe(false);
    expect(customerOfferingsAreVisible("false")).toBe(false);
  });

  it("covers the customer paths and catalog entries in the group", () => {
    expect(CUSTOMER_OFFERING_GROUP.join(" ")).toMatch(/Hardware Resources/);
    expect(CUSTOMER_OFFERING_GROUP.join(" ")).toMatch(/Closet Studio/);
    expect(CUSTOMER_OFFERING_GROUP.join(" ")).toMatch(/Kitchen packages/);
    expect(CUSTOMER_OFFERING_GROUP.join(" ")).toMatch(/Sampling/);
    expect(CUSTOMER_OFFERING_GROUP.join(" ")).toMatch(/Promotions/);
    expect(isCustomerOfferingPath("/hardware")).toBe(true);
    expect(isCustomerOfferingPath("/store/acme/closet")).toBe(true);
    expect(isCustomerOfferingPath("/store/acme/bundles")).toBe(true);
    expect(isCustomerOfferingPath("/catalog")).toBe(false);
    expect(isCustomerOfferingCatalogVendor({ key: "hardware", kind: "hardware" })).toBe(true);
    expect(isCustomerOfferingCatalogVendor({ key: "closet", kind: "closet" })).toBe(true);
    expect(isCustomerOfferingCatalogVendor({ key: "distributor:4", kind: "cabinet" })).toBe(false);
  });
});
