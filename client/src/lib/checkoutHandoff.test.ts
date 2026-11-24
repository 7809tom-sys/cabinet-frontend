import { describe, expect, it } from "vitest";
import type { CartItem } from "@/contexts/CartContext";
import { resolveStoreScope } from "@/lib/affiliateContext";
import {
  cartPrefillStorageKey,
  checkoutHandoffFromCart,
  parseCheckoutHandoff,
  persistCheckoutHandoff,
  resolveCheckoutHandoff,
} from "@/lib/checkoutHandoff";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    masterCode: "B24",
    name: "Base 24",
    styleId: 12,
    styleLabel: "Shaker",
    distributorId: 3,
    tier: "homeowner",
    unitPrice: 100,
    qty: 1,
    ...overrides,
  };
}

describe("checkout handoff storage", () => {
  it("uses one key for FIRSTCLASS and firstclass, and ignores ?ref=", () => {
    expect(cartPrefillStorageKey("FIRSTCLASS")).toBe("cd_cart_prefill_v1:firstclass");
    expect(cartPrefillStorageKey("firstclass")).toBe(cartPrefillStorageKey("FIRSTCLASS"));
    expect(resolveStoreScope({
      pathname: "/store/FIRSTCLASS/cart",
      search: "?ref=FIRSTCLASS",
      hostname: "www.cabinetdealz.com",
    })).toBe("firstclass");
    expect(resolveStoreScope({
      pathname: "/store/firstclass/checkout",
      search: "",
      hostname: "cabinetdealz.com",
    })).toBe("firstclass");
  });

  it("rehydrates a direct checkout load from the persisted cart when no hand-off exists", () => {
    const handoff = resolveCheckoutHandoff({
      sessionRaw: null,
      localHandoffRaw: null,
      cartItems: [item({ qty: 2, unitPrice: 80 })],
      kitchenDesignId: 44,
      destinationZip: "34231",
    });
    expect(handoff).toMatchObject({
      styleId: 12,
      tier: "homeowner",
      kitchenDesignId: 44,
      destinationZip: "34231",
      items: [expect.objectContaining({ code: "B24", qty: 2, unitPrice: 80 })],
    });
  });

  it("keeps the continue-click hand-off, including its live price, when the cart lines still match", () => {
    const clicked = checkoutHandoffFromCart({
      items: [item()],
      unitPrice: () => 125,
      destinationZip: "34231",
    });
    const resolved = resolveCheckoutHandoff({
      sessionRaw: null,
      localHandoffRaw: JSON.stringify(clicked),
      cartItems: [item({ unitPrice: 100 })],
      destinationZip: "34231",
    });
    expect(resolved?.items[0]?.unitPrice).toBe(125);
  });

  it("ignores a stale hand-off after the cart quantity changes", () => {
    const stale = checkoutHandoffFromCart({ items: [item({ qty: 1 })] });
    const resolved = resolveCheckoutHandoff({
      sessionRaw: JSON.stringify(stale),
      localHandoffRaw: JSON.stringify(stale),
      cartItems: [item({ qty: 3, unitPrice: 90 })],
    });
    expect(resolved?.items).toEqual([expect.objectContaining({ code: "B24", qty: 3, unitPrice: 90 })]);
  });

  it("does not revive a hand-off after the cart is cleared", () => {
    const stale = checkoutHandoffFromCart({ items: [item()] });
    expect(resolveCheckoutHandoff({
      sessionRaw: JSON.stringify(stale),
      localHandoffRaw: JSON.stringify(stale),
      cartItems: [],
    })).toBeNull();
  });

  it("keeps the hand-off in localStorage when sessionStorage rejects the write", () => {
    const handoff = checkoutHandoffFromCart({ items: [item()] })!;
    const local = new Map<string, string>();
    const session = {
      setItem() {
        throw new Error("sessionStorage blocked");
      },
    };
    persistCheckoutHandoff("cd_cart_prefill_v1:firstclass", handoff, [
      session,
      {
        setItem(key, value) {
          local.set(key, value);
        },
      },
    ]);
    expect(parseCheckoutHandoff(local.get("cd_cart_prefill_v1:firstclass") ?? null)?.items[0]?.code).toBe("B24");
  });
});
