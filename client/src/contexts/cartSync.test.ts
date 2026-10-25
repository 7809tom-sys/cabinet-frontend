import { describe, expect, it } from "vitest";
import { synchronizedDesignCartItems, type CartItem } from "./CartContext";

describe("synchronizedDesignCartItems", () => {
  it("preserves the exact distributor, finish, pending-price, and locked-price design lines", () => {
    const designLines: CartItem[] = [
      { masterCode: "SB-33", name: "Sink Base", styleId: 330008, styleLabel: "Midnight Black Shaker", distributorId: 210001, tier: "homeowner", unitPrice: 572.25, priceLocked: true, qty: 1 },
      { masterCode: "W-30", name: "Wall Cabinet", styleId: 330008, styleLabel: "Midnight Black Shaker", distributorId: 210001, tier: "homeowner", unitPrice: null, qty: 1 },
    ];

    const synced = synchronizedDesignCartItems(designLines);

    expect(synced).toEqual(designLines);
    expect(synced).not.toBe(designLines);
    expect(synced[0]).not.toBe(designLines[0]);
  });
});
