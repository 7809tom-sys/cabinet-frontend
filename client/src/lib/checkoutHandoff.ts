import type { CartItem } from "@/contexts/CartContext";
import { cartItemToCheckoutPrefill, type CartCheckoutPrefillItem } from "@/lib/cartCheckoutPrefill";
import { scopedBrowserStorageKey, type StoreScope } from "@/lib/affiliateContext";
import { isRangeTopCartLine } from "@/lib/rangeTopDisplayOnly";

/**
 * Checkout used to read only `sessionStorage` key `cd_cart_prefill_v1:<scope>`,
 * written when "Continue to secure checkout" was clicked. The cart itself lives
 * in `localStorage` (`cd_cart_v1:<scope>`). A direct checkout load, a refresh in
 * a tab that never wrote the hand-off, or a browser that rejects sessionStorage
 * therefore opened an empty checkout whose next action is "Go to cart".
 *
 * The slug in the key is normalized (`FIRSTCLASS` and `firstclass` share a key).
 * `?ref=` does not change it. The hand-off is also written to localStorage, and
 * checkout rebuilds from the persisted cart when the hand-off is missing or stale.
 */
export const CART_PREFILL_KEY = "cd_cart_prefill_v1";

export function cartPrefillStorageKey(scope: StoreScope) {
  return scopedBrowserStorageKey(CART_PREFILL_KEY, scope);
}

export type CheckoutHandoff = {
  items: CartCheckoutPrefillItem[];
  styleId: number | null;
  tier: string | null;
  kitchenDesignId: number | null;
  carrierPreference: "ups" | null;
  destinationZip?: string | null;
};

export function normalizeDestinationZip(value: string | null | undefined): string | null {
  const zip = (value ?? "").trim();
  return /^\d{5}(?:-\d{4})?$/.test(zip) ? zip : null;
}

function positiveId(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value! : null;
}

function lineSignature(item: CartCheckoutPrefillItem): string {
  return [
    item.code,
    item.qty,
    item.styleId ?? "",
    item.productKind ?? "",
    item.distributorId ?? "",
    item.vendorProductId ?? "",
    item.pelicanProductId ?? "",
  ].join("\u001f");
}

function sameLines(handoff: CheckoutHandoff, cartLines: readonly CartCheckoutPrefillItem[]): boolean {
  if (handoff.items.length !== cartLines.length) return false;
  const left = handoff.items.map(lineSignature).sort();
  const right = cartLines.map(lineSignature).sort();
  return left.every((value, index) => value === right[index]);
}

export function parseCheckoutHandoff(raw: string | null): CheckoutHandoff | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(raw) as
      | CheckoutHandoff
      | CartCheckoutPrefillItem[];
    const record = Array.isArray(decoded) ? null : decoded;
    const items = (Array.isArray(decoded) ? decoded : decoded.items ?? [])
      .filter((item) => item && item.code && item.qty > 0);
    if (items.length === 0) return null;
    return {
      items,
      styleId: record?.styleId ?? null,
      tier: record?.tier ?? null,
      kitchenDesignId: positiveId(record?.kitchenDesignId),
      carrierPreference: record?.carrierPreference === "ups" ? "ups" : null,
      destinationZip: normalizeDestinationZip(record?.destinationZip),
    };
  } catch {
    return null;
  }
}

/** Lines checkout should review, using stored cart prices when no live price is supplied. */
export function checkoutHandoffFromCart(input: {
  items: readonly CartItem[];
  unitPrice?: (item: CartItem) => number | null;
  kitchenDesignId?: number | null;
  carrierPreference?: "ups" | null;
  destinationZip?: string | null;
}): CheckoutHandoff | null {
  const sellable = input.items.filter((item) => !isRangeTopCartLine(item) && item.qty > 0 && item.masterCode.trim());
  if (sellable.length === 0) return null;
  const first = sellable[0]!;
  return {
    items: sellable.map((item) => cartItemToCheckoutPrefill(
      item,
      input.unitPrice ? input.unitPrice(item) : item.unitPrice,
    )),
    styleId: first.styleId ?? null,
    tier: first.tier ?? null,
    kitchenDesignId: positiveId(input.kitchenDesignId),
    carrierPreference: input.carrierPreference === "ups" ? "ups" : null,
    destinationZip: normalizeDestinationZip(input.destinationZip),
  };
}

/**
 * The persisted cart wins. A hand-off is used only when it still describes
 * those same lines (so a cleared or edited cart cannot reopen a stale checkout,
 * and a missing hand-off still checks out what is in the cart).
 */
export function resolveCheckoutHandoff(input: {
  sessionRaw: string | null;
  localHandoffRaw: string | null;
  cartItems: readonly CartItem[];
  kitchenDesignId?: number | null;
  destinationZip?: string | null;
}): CheckoutHandoff | null {
  const fromCart = checkoutHandoffFromCart({
    items: input.cartItems,
    kitchenDesignId: input.kitchenDesignId,
    destinationZip: input.destinationZip,
  });
  if (!fromCart) return null;
  const handoff = parseCheckoutHandoff(input.sessionRaw) ?? parseCheckoutHandoff(input.localHandoffRaw);
  if (!handoff || !sameLines(handoff, fromCart.items)) return fromCart;
  return {
    ...handoff,
    kitchenDesignId: handoff.kitchenDesignId ?? fromCart.kitchenDesignId,
    destinationZip: handoff.destinationZip ?? fromCart.destinationZip ?? null,
  };
}

export function persistCheckoutHandoff(
  key: string,
  handoff: CheckoutHandoff,
  storages: readonly (Pick<Storage, "setItem"> | null | undefined)[],
): void {
  const raw = JSON.stringify(handoff);
  for (const storage of storages) {
    try {
      storage?.setItem(key, raw);
    } catch {
      /* private mode or a blocked store must not stop navigation */
    }
  }
}

export function browserStorage(kind: "session" | "local"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readStorageItem(storage: Pick<Storage, "getItem"> | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
