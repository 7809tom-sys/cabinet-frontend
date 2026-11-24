import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("./WarehouseOpenControls.tsx", import.meta.url), "utf8");
const fulfillment = readFileSync(new URL("./DistributorFulfillmentEditor.tsx", import.meta.url), "utf8");
const doorStyles = readFileSync(new URL("./FeaturedStylesAdmin.tsx", import.meta.url), "utf8");

describe("admin warehouse open/closed toggle", () => {
  it("switches a warehouse without editing shipping origin ZIP lists", () => {
    expect(controls).toContain("warehouses.setOpen");
    expect(controls).toContain("isOpen");
    expect(controls).toContain("Not a shipping origin");
    expect(controls).not.toContain("warehouseZips");
    expect(fulfillment).toContain("<WarehouseOpenControls distributorId={Number(selectedId)} />");
    expect(fulfillment).toContain("warehouseZips: shippingZips");
    expect(doorStyles).toContain("<WarehouseOpenControls distributorId={style.distributorId} />");
    expect(doorStyles).toContain("Shipping Origin ZIPs");
  });
});
