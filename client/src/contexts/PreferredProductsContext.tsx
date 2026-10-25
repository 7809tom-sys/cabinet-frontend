import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  resolveStoreScope,
  scopedBrowserStorageKey,
  storefrontAccountScope,
  type StoreScope,
} from "@/lib/affiliateContext";

export type PreferredProductCategory = "flooring" | "countertop" | "backsplash" | "faucet" | "sink";

export type PreferredProduct = {
  id: number;
  slug: string;
  name: string;
  category: PreferredProductCategory;
  productCategory: string;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  /** Approved repeatable swatch for the 3D Designer; catalog imagery remains display-only. */
  materialImageUrl?: string | null;
  sellPrice: number | null;
  coverageSqFt?: number | null;
  unsupportedOverhangLimitIn?: number | null;
};

export type PreferableCatalogProduct = Omit<PreferredProduct, "category" | "productCategory" | "coverageSqFt" | "unsupportedOverhangLimitIn"> & {
  category: string;
  productCategory?: string;
  coverageSqFt?: number | string | null;
  unsupportedOverhangLimitIn?: number | string | null;
};

export const MAX_PREFERRED_PRODUCTS_PER_CATEGORY = 6;
const STORAGE_KEY = "cd_preferred_products_v1";

export function preferredCategoryForCatalogProduct(product: Pick<PreferableCatalogProduct, "category" | "productCategory" | "subCategory">): PreferredProductCategory | null {
  const catalogCategory = product.productCategory ?? product.category;
  if (catalogCategory === "Flooring") return "flooring";
  if (catalogCategory === "Quartz Slabs (Countertops)") return "countertop";
  if (catalogCategory === "Tile & Mosaic") return "backsplash";
  if (catalogCategory !== "Sinks & Faucets") return null;
  const subtype = `${product.subCategory ?? ""}`.toLowerCase();
  if (subtype.includes("faucet")) return "faucet";
  if (subtype.includes("sink")) return "sink";
  return null;
}

/** The account list is ordered by created time, so the first matching item is the least recently saved replacement candidate. */
export function preferredReplacementCandidate(products: PreferredProduct[], category: PreferredProductCategory): PreferredProduct | null {
  return products.find((product) => product.category === category) ?? null;
}

function readGuestProducts(storageKey: string): PreferredProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is PreferredProduct => Number.isInteger(item?.id) && typeof item?.category === "string") : [];
  } catch {
    return [];
  }
}

type PreferredProductsContextValue = {
  products: PreferredProduct[];
  isLoading: boolean;
  isPreferred: (productId: number) => boolean;
  togglePreferred: (product: PreferableCatalogProduct) => void;
  countForCategory: (category: PreferredProductCategory) => number;
  maxPerCategory: number;
};

const PreferredProductsContext = createContext<PreferredProductsContextValue | null>(null);

function ScopedPreferredProductsProvider({ children, scope }: { children: React.ReactNode; scope: StoreScope }) {
  const { user } = useAuth();
  const slug = storefrontAccountScope(scope);
  const storageKey = scopedBrowserStorageKey(STORAGE_KEY, scope);
  const utils = trpc.useUtils();
  const [guestProducts, setGuestProducts] = useState<PreferredProduct[]>(() => readGuestProducts(storageKey));
  const mergedGuestRef = useRef(false);
  const accountList = trpc.preferredProducts.list.useQuery({ storefrontSlug: slug }, { enabled: Boolean(user) });
  const add = trpc.preferredProducts.add.useMutation({ onSuccess: () => void utils.preferredProducts.list.invalidate({ storefrontSlug: slug }) });
  const remove = trpc.preferredProducts.remove.useMutation({ onSuccess: () => void utils.preferredProducts.list.invalidate({ storefrontSlug: slug }) });
  const products = user ? (accountList.data?.products ?? []) as PreferredProduct[] : guestProducts;

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(guestProducts));
  }, [guestProducts, storageKey]);

  useEffect(() => {
    if (!user || accountList.isLoading || mergedGuestRef.current || guestProducts.length === 0) return;
    mergedGuestRef.current = true;
    void Promise.all(guestProducts.map((product) => add.mutateAsync({ storefrontSlug: slug, productId: product.id }).catch(() => null))).then(() => {
      setGuestProducts([]);
      void utils.preferredProducts.list.invalidate({ storefrontSlug: slug });
    });
  }, [user, accountList.isLoading, guestProducts, add, slug, utils]);

  const isPreferred = useCallback((productId: number) => products.some((product) => product.id === productId), [products]);
  const countForCategory = useCallback((category: PreferredProductCategory) => products.filter((product) => product.category === category).length, [products]);

  const togglePreferred = useCallback((product: PreferableCatalogProduct) => {
    const category = preferredCategoryForCatalogProduct(product);
    if (!category) {
      toast.error("Only flooring, countertops, backsplashes, faucets, and sinks can be added to Preferred.");
      return;
    }
    if (isPreferred(product.id)) {
      if (user) remove.mutate({ storefrontSlug: slug, productId: product.id });
      else setGuestProducts((current) => current.filter((item) => item.id !== product.id));
      toast.success(`${product.name} removed from Preferred.`);
      return;
    }
    if (countForCategory(category) >= MAX_PREFERRED_PRODUCTS_PER_CATEGORY) {
      const replacement = preferredReplacementCandidate(products, category);
      const approved = replacement && window.confirm(`You can save up to ${MAX_PREFERRED_PRODUCTS_PER_CATEGORY} preferred ${category} products. Replace your oldest saved item, ${replacement.name}, with ${product.name}?`);
      if (!approved || !replacement) return;
      const nextProduct: PreferredProduct = {
        ...product,
        category,
        productCategory: product.productCategory ?? product.category,
        coverageSqFt: product.coverageSqFt == null ? null : Number(product.coverageSqFt),
        unsupportedOverhangLimitIn: product.unsupportedOverhangLimitIn == null ? null : Number(product.unsupportedOverhangLimitIn),
      };
      if (user) {
        void (async () => {
          try {
            await remove.mutateAsync({ storefrontSlug: slug, productId: replacement.id });
            await add.mutateAsync({ storefrontSlug: slug, productId: product.id });
            toast.success(`${product.name} replaced ${replacement.name} in Preferred.`);
          } catch (error) {
            void add.mutateAsync({ storefrontSlug: slug, productId: replacement.id }).catch(() => null);
            toast.error(error instanceof Error ? error.message : "Preferred replacement could not be completed.");
          }
        })();
      } else {
        setGuestProducts((current) => [...current.filter((item) => item.id !== replacement.id), nextProduct]);
        toast.success(`${product.name} replaced ${replacement.name} in Preferred on this device.`);
      }
      return;
    }
    if (user) {
      add.mutate({ storefrontSlug: slug, productId: product.id }, { onSuccess: () => toast.success(`${product.name} added to Preferred.`), onError: (error) => toast.error(error.message) });
    } else {
      setGuestProducts((current) => [...current, {
        ...product,
        category,
        productCategory: product.productCategory ?? product.category,
        coverageSqFt: product.coverageSqFt == null ? null : Number(product.coverageSqFt),
        unsupportedOverhangLimitIn: product.unsupportedOverhangLimitIn == null ? null : Number(product.unsupportedOverhangLimitIn),
      }]);
      toast.success(`${product.name} added to Preferred on this device.`);
    }
  }, [add, countForCategory, isPreferred, products, remove, slug, user]);

  const value = useMemo<PreferredProductsContextValue>(() => ({
    products,
    isLoading: Boolean(user && accountList.isLoading),
    isPreferred,
    togglePreferred,
    countForCategory,
    maxPerCategory: MAX_PREFERRED_PRODUCTS_PER_CATEGORY,
  }), [products, user, accountList.isLoading, isPreferred, togglePreferred, countForCategory]);

  return <PreferredProductsContext.Provider value={value}>{children}</PreferredProductsContext.Provider>;
}

export function PreferredProductsProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const search = useSearch();
  const scope = resolveStoreScope({
    pathname: location.split("?")[0],
    search,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  });
  return <ScopedPreferredProductsProvider key={scope} scope={scope}>{children}</ScopedPreferredProductsProvider>;
}

export function usePreferredProducts() {
  const context = useContext(PreferredProductsContext);
  if (!context) throw new Error("usePreferredProducts must be used inside PreferredProductsProvider");
  return context;
}
