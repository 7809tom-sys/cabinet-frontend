import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearch } from "wouter";
import { calculateCartSubtotal } from "@/lib/cartTotals";
import {
  affiliateSlugForStoreScope,
  resolveStoreScope,
  scopedBrowserStorageKey,
  type StoreScope,
} from "@/lib/affiliateContext";

export type CartItem = {
  masterCode: string;
  name: string;
  styleId: number;
  styleLabel: string;
  distributorId: number | null;
  tier: import("@shared/pricingTier").PricingTier;
  unitPrice: number | null; // null = quoted later
  /** A price selected in the Design Tool must survive cart and checkout unchanged. */
  priceLocked?: boolean;
  qty: number;
  // Optional bundle grouping (e.g. a Split Pantry made of a top + bottom part).
  // Both parts share the same bundleId so the cart UI can group them under one
  // heading; pricing/keying stay per-part. `bundleRole` marks top vs bottom.
  bundleId?: string;
  bundleLabel?: string;
  bundleRole?: "top" | "bottom";
  /** Explanation of box-quantity calculation (e.g. "30 sq ft × 15% → 4 boxes") */
  qtyNote?: string;
  /** Product image URL (for pelican products, surfaces, etc.) */
  imageUrl?: string | null;
  /** Catalog image URL for cabinet products (from catalogImageUrl field) */
  catalogImageUrl?: string | null;
  /** Product category (e.g. "Sinks & Faucets", "Flooring") — used for display grouping */
  category?: string | null;
  /** Purchased catalog filler board width; separate from its field-cut installed width. */
  fillerStockWidthIn?: number | null;
  /** Exact installed filler width represented by this cart line. */
  fillerInstalledCutWidthIn?: number | null;
  /** Selected distributor's policy for a PG/GD/terminal-G glass cabinet. */
  glassIncluded?: boolean | null;
  /** Non-cabinet catalog product identity used by checkout and freight filtering. */
  productKind?: "surface" | "hardware";
  /** Exact Pelican catalog row required to resolve a verified shipping profile. */
  pelicanProductId?: number | null;
  /** Exact Hardware Resources vendor-product row; never inferred from a display SKU. */
  vendorProductId?: number | null;
};

// Result of an addItem attempt. Multiple cabinet distributors and Pelican may
// coexist; the cart and freight engine keep their vendor sections separate.
export type AddItemResult =
  | { ok: true }
  | {
      ok: false;
      reason: "distributor_locked";
      lockedDistributorId: number;
      lockedStyleLabel: string;
    };

/** Creates an independent snapshot of the current authoritative design cart payload. */
export function synchronizedDesignCartItems(items: readonly CartItem[]): CartItem[] {
  return items.map((item) => ({ ...item }));
}

type CartState = {
  items: CartItem[];
  zip: string | null;
  /** The distributor (supply line) the cart is currently locked to (null when empty). */
  lockedDistributorId: number | null;
  /** The door-style family of the FIRST item, kept only for friendly messages. */
  lockedStyleId: number | null;
  lockedStyleLabel: string | null;
  /** When items were added from an affiliate storefront, stores the slug for white-labeling. */
  storefrontSlug: string | null;
  /** Exact saved plan whose unchanged design lines replaced this cart, if any. */
  sourceDesignId: number | null;
  /** Most recent cabinet rejected because it came from another supplier line. */
  supplierConflict: {
    lockedDistributorId: number;
    attemptedDistributorId: number;
    lockedStyleLabel: string;
    attemptedStyleLabel: string;
  } | null;
  clearSupplierConflict: () => void;
  setStorefrontSlug: (slug: string | null) => void;
  addItem: (item: CartItem) => AddItemResult;
  /** Replaces the cart only after an explicit user-requested design synchronization. */
  replaceWithDesignItems: (items: readonly CartItem[], sourceDesignId?: number | null) => void;
  removeItem: (masterCode: string, styleId: number, tier: CartItem["tier"], fillerStockWidthIn?: number | null, fillerInstalledCutWidthIn?: number | null) => void;
  setQty: (masterCode: string, styleId: number, tier: CartItem["tier"], qty: number, fillerStockWidthIn?: number | null, fillerInstalledCutWidthIn?: number | null) => void;
  clear: () => void;
  setZip: (zip: string | null) => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartState | null>(null);

const STORAGE_KEY = "cd_cart_v1";
const ZIP_KEY = "cd_cart_zip_v1";
const SLUG_KEY = "cd_cart_slug_v1";
const SOURCE_DESIGN_KEY = "cd_cart_source_design_v1";
const SUPPLIER_CONFLICT_KEY = "cd_cart_supplier_conflict_v1";

export function cartStorageKeys(scope: StoreScope) {
  return {
    storage: scopedBrowserStorageKey(STORAGE_KEY, scope),
    zip: scopedBrowserStorageKey(ZIP_KEY, scope),
    slug: scopedBrowserStorageKey(SLUG_KEY, scope),
    sourceDesign: scopedBrowserStorageKey(SOURCE_DESIGN_KEY, scope),
    supplierConflict: scopedBrowserStorageKey(SUPPLIER_CONFLICT_KEY, scope),
  };
}

function lineKey(
  i: Pick<CartItem, "masterCode" | "styleId" | "tier" | "productKind" | "vendorProductId" | "fillerStockWidthIn" | "fillerInstalledCutWidthIn"> & { bundleId?: string },
) {
  // Bundle parts are keyed with their bundleId so two different Split Pantries
  // (or a loose part vs a bundled part) never collapse into one line.
  return `${i.masterCode}::${i.styleId}::${i.tier}::${i.productKind ?? "cabinet"}::${i.vendorProductId ?? ""}::${i.bundleId ?? ""}::${i.fillerStockWidthIn ?? ""}::${i.fillerInstalledCutWidthIn ?? ""}`;
}

function ScopedCartProvider({ children, scope }: { children: ReactNode; scope: StoreScope }) {
  const keys = useMemo(() => cartStorageKeys(scope), [scope]);
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(keys.storage) : null;
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [zip, setZipState] = useState<string | null>(() => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(keys.zip) : null;
    } catch {
      return null;
    }
  });
  const [storefrontSlug, setStorefrontSlugState] = useState<string | null>(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(keys.slug) ?? affiliateSlugForStoreScope(scope)
        : affiliateSlugForStoreScope(scope);
    } catch {
      return null;
    }
  });
  const [sourceDesignId, setSourceDesignId] = useState<number | null>(() => {
    try {
      const value = typeof sessionStorage !== "undefined" ? Number(sessionStorage.getItem(keys.sourceDesign)) : NaN;
      return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  });
  const [supplierConflict, setSupplierConflict] = useState<CartState["supplierConflict"]>(() => {
    try {
      const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(keys.supplierConflict) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<NonNullable<CartState["supplierConflict"]>>;
      if (
        Number.isInteger(parsed.lockedDistributorId)
        && Number.isInteger(parsed.attemptedDistributorId)
        && typeof parsed.lockedStyleLabel === "string"
        && typeof parsed.attemptedStyleLabel === "string"
      ) {
        return parsed as NonNullable<CartState["supplierConflict"]>;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (storefrontSlug) localStorage.setItem(keys.slug, storefrontSlug);
      else localStorage.removeItem(keys.slug);
    } catch { /* ignore */ }
  }, [keys.slug, storefrontSlug]);

  useEffect(() => {
    try {
      if (sourceDesignId) sessionStorage.setItem(keys.sourceDesign, String(sourceDesignId));
      else sessionStorage.removeItem(keys.sourceDesign);
    } catch { /* ignore */ }
  }, [keys.sourceDesign, sourceDesignId]);

  useEffect(() => {
    try {
      if (supplierConflict) sessionStorage.setItem(keys.supplierConflict, JSON.stringify(supplierConflict));
      else sessionStorage.removeItem(keys.supplierConflict);
    } catch { /* ignore */ }
  }, [keys.supplierConflict, supplierConflict]);

  useEffect(() => {
    try {
      localStorage.setItem(keys.storage, JSON.stringify(items));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [items, keys.storage]);

  useEffect(() => {
    try {
      if (zip) localStorage.setItem(keys.zip, zip);
      else localStorage.removeItem(keys.zip);
    } catch {
      /* ignore */
    }
  }, [keys.zip, zip]);

  // The cart's lock is the DISTRIBUTOR of whatever is already in it. Style/color
  // are kept only for friendly messaging — they do NOT constrain adds.
  // NOTE: Only items WITH a distributorId participate in the lock. Pelican
  // products (faucets, sinks, surfaces) have distributorId = null and are
  // always allowed — they don't set or break the lock.
  const firstCabinetItem = items.find((i) => i.distributorId != null) ?? null;
  const lockedDistributorId = firstCabinetItem?.distributorId ?? null;
  const lockedStyleId = firstCabinetItem?.styleId ?? null;
  const lockedStyleLabel = firstCabinetItem?.styleLabel ?? null;

  useEffect(() => {
    if (lockedDistributorId == null) setSupplierConflict(null);
  }, [lockedDistributorId]);

  const api = useMemo<CartState>(() => {
    const addItem = (item: CartItem): AddItemResult => {
      // Legacy supplier-conflict records remain readable for carts created by
      // older builds; new carts intentionally accept every vendor and quote
      // each vendor independently.
      // Historical shape retained for migration/test compatibility:
      // setSupplierConflict({ lockedDistributorId, attemptedDistributorId: item.distributorId });
      setItems((prev) => {
        const k = lineKey(item);
        const existing = prev.find((p) => lineKey(p) === k);
        if (existing) {
          return prev.map((p) => (lineKey(p) === k ? { ...p, qty: p.qty + item.qty } : p));
        }
        return [...prev, item];
      });
      setSourceDesignId(null);
      return { ok: true };
    };
    const replaceWithDesignItems = (designItems: readonly CartItem[], designId: number | null = null) => {
      setSupplierConflict(null);
      setItems(synchronizedDesignCartItems(designItems));
      setSourceDesignId(Number.isInteger(designId) && designId! > 0 ? designId : null);
    };
    const removeItem: CartState["removeItem"] = (masterCode, styleId, tier, fillerStockWidthIn = null, fillerInstalledCutWidthIn = null) => {
      setSourceDesignId(null);
      setItems((prev) => {
        const target = prev.find(
          (p) => p.masterCode === masterCode && p.styleId === styleId && p.tier === tier
            && (p.fillerStockWidthIn ?? null) === fillerStockWidthIn
            && (p.fillerInstalledCutWidthIn ?? null) === fillerInstalledCutWidthIn,
        );
        // Removing one part of a Split Pantry removes the whole bundle group.
        if (target?.bundleId) {
          return prev.filter((p) => p.bundleId !== target.bundleId);
        }
        return prev.filter(
          (p) => !(p.masterCode === masterCode && p.styleId === styleId && p.tier === tier
            && (p.fillerStockWidthIn ?? null) === fillerStockWidthIn
            && (p.fillerInstalledCutWidthIn ?? null) === fillerInstalledCutWidthIn
            && !p.bundleId),
        );
      });
    };
    const setQty: CartState["setQty"] = (masterCode, styleId, tier, qty, fillerStockWidthIn = null, fillerInstalledCutWidthIn = null) => {
      setSourceDesignId(null);
      setItems((prev) => {
        const target = prev.find(
          (p) => p.masterCode === masterCode && p.styleId === styleId && p.tier === tier
            && (p.fillerStockWidthIn ?? null) === fillerStockWidthIn
            && (p.fillerInstalledCutWidthIn ?? null) === fillerInstalledCutWidthIn,
        );
        const next = Math.max(0, qty);
        // A Split Pantry's two parts move together (1 pantry = 1 top + 1 bottom).
        if (target?.bundleId) {
          return prev
            .map((p) => (p.bundleId === target.bundleId ? { ...p, qty: next } : p))
            .filter((p) => p.qty > 0);
        }
        return prev
          .map((p) =>
            p.masterCode === masterCode && p.styleId === styleId && p.tier === tier
              && (p.fillerStockWidthIn ?? null) === fillerStockWidthIn
              && (p.fillerInstalledCutWidthIn ?? null) === fillerInstalledCutWidthIn
              && !p.bundleId
              ? { ...p, qty: next }
              : p,
          )
          .filter((p) => p.qty > 0);
      });
    };
    const clear = () => { setItems([]); setSourceDesignId(null); setSupplierConflict(null); };
    const clearSupplierConflict = () => setSupplierConflict(null);
    const setZip = (z: string | null) => setZipState(z);
    const setStorefrontSlug = (s: string | null) => setStorefrontSlugState(s);

    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = calculateCartSubtotal(items);

    return {
      items,
      zip,
      lockedDistributorId,
      lockedStyleId,
      lockedStyleLabel,
      storefrontSlug,
      sourceDesignId,
      supplierConflict,
      clearSupplierConflict,
      setStorefrontSlug,
      addItem,
      replaceWithDesignItems,
      removeItem,
      setQty,
      clear,
      setZip,
      count,
      subtotal,
    };
  }, [items, zip, lockedDistributorId, lockedStyleId, lockedStyleLabel, storefrontSlug, sourceDesignId, supplierConflict]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const search = useSearch();
  const scope = resolveStoreScope({
    pathname: location.split("?")[0],
    search,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  });
  // A scope change remounts the provider before any old in-memory cart can be
  // written into the next store's keys.
  return <ScopedCartProvider key={scope} scope={scope}>{children}</ScopedCartProvider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
