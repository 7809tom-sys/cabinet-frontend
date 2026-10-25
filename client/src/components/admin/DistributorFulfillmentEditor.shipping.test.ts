import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DistributorFulfillmentEditor.tsx", import.meta.url), "utf8");

describe("DistributorFulfillmentEditor shipping overlay", () => {
  it("collects warehouse identity, origin ZIPs, and shipping rules", () => {
    expect(source).toContain("Distributor warehouse & shipping rule");
    expect(source).toContain("Warehouse ZIPs");
    expect(source).toContain("Live carrier quote");
    expect(source).toContain("Fixed freight by ZIP / all locations");
    expect(source).toContain("Free freight at order total");
  });

  it("sends the complete shipping profile through the protected update mutation", () => {
    expect(source).toContain("warehouseZips: shippingZips");
    expect(source).toContain("shippingFlatFreightFeeCents: flatFreightFeeCents");
    expect(source).toContain("shippingZipRates: zipRates");
    expect(source).toContain("shippingExceptions: shippingExceptions.trim()");
  });
});
