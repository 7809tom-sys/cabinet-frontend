import { describe, expect, it } from "vitest";
import {
  INVENTORY_SIM_QUERY,
  SHOPPER_STOCK_STATUS_VISIBLE,
  StubInventoryProvider,
  VendorApiInventoryProvider,
  canViewerSeeStockStatus,
  guardShopperInventoryProvider,
  resolveDesignerInventoryProvider,
} from "./inventoryProvider";

describe("shopper stock status guard", () => {
  it("keeps stock status hidden from shoppers", () => {
    expect(SHOPPER_STOCK_STATUS_VISIBLE).toBe(false);
    expect(canViewerSeeStockStatus(false)).toBe(false);
    expect(canViewerSeeStockStatus(true)).toBe(true);
  });

  it("gives shoppers the unknown provider even when the simulation flag is set", () => {
    for (const search of [`?${INVENTORY_SIM_QUERY}=1`, `?${INVENTORY_SIM_QUERY}=B36`, ""]) {
      const provider = resolveDesignerInventoryProvider({ isAdmin: false, search, storedFlag: "1" });
      expect(provider.id).toBe("unknown");
      for (const row of provider.getStockStatus(["B36", "W3012"]) as { status: string }[]) {
        expect(row.status).toBe("unknown");
      }
    }
  });

  it("replaces a live or simulated provider with unknown for shoppers", () => {
    const stub = new StubInventoryProvider({ outOfStock: ["B36"], low: ["W3012"] });
    const guarded = guardShopperInventoryProvider(stub, false);
    expect(guarded.id).toBe("unknown");
    expect(guarded.getStockStatus(["B36", "W3012"])).toEqual([
      { sku: "B36", status: "unknown" },
      { sku: "W3012", status: "unknown" },
    ]);
    expect(guardShopperInventoryProvider(new VendorApiInventoryProvider(), false).id).toBe("unknown");
  });

  it("leaves admin simulation unchanged", () => {
    const admin = resolveDesignerInventoryProvider({ isAdmin: true, search: `?${INVENTORY_SIM_QUERY}=1`, storedFlag: null });
    expect(admin.id).toBe("stub");
    const stub = new StubInventoryProvider({ outOfStock: ["B36"] });
    expect(guardShopperInventoryProvider(stub, true)).toBe(stub);
  });
});
