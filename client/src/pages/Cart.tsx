import { useMemo } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  ShoppingCart, Trash2, Plus, Minus, Truck, AlertTriangle, Package, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { resolveStorefrontTier, resolveTierPrice } from "@shared/pricingTier";
import { resolveAffiliateCartUnitPrice, calculateCartLineTotal } from "@shared/affiliateCartPricing";
import { resolveLockedCheckoutUnitPrice } from "@/lib/checkoutPriceLock";
import {
  affiliateSlugForStoreScope,
  resolveStoreScope,
  scopedBrowserStorageKey,
  type StoreScope,
} from "@/lib/affiliateContext";
import { cartItemToCheckoutPrefill } from "@/lib/cartCheckoutPrefill";
import { separateGlassPurchaseItems } from "@/lib/cartGlassPolicy";
import { formatEighthInches } from "@/lib/design";
import { isTemporaryOneDollarFreeShippingOrder } from "@shared/temporaryCheckoutTest";

// Key the OrderBuilder reads on mount to prefill the review step from the cart.
export const CART_PREFILL_KEY = "cd_cart_prefill_v1";
export function cartPrefillStorageKey(scope: StoreScope) {
  return scopedBrowserStorageKey(CART_PREFILL_KEY, scope);
}

export default function Cart() {
  const { t, lang } = useLanguage();
  useSeo({ title: t("seo_cart_t"), description: t("seo_cart_d"), lang });
  const { items, removeItem, setQty, clear, subtotal, count, sourceDesignId } = useCart();
  const storeScope = resolveStoreScope({
    pathname: typeof window !== "undefined" ? window.location.pathname : "/cart",
    search: typeof window !== "undefined" ? window.location.search : "",
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  });
  const currentAffiliateSlug = affiliateSlugForStoreScope(storeScope);
  // Affiliate carts request that storefront's server-calculated sale price. The
  // browser never refreshes them from CabinetDealz's generic homeowner/list price.
  const isAffiliateCart = Boolean(currentAffiliateSlug);
  const money = (n: number | null): string =>
    n == null ? t("crt_quoted") : `$${n.toFixed(2)}`;
  const [, navigate] = useLocation();

  // Determine the viewer's current pricing tier from their login state.
  const { user } = useAuth();
  const viewerTier = resolveStorefrontTier(user);

  // Build the list of (masterCode, styleId) pairs for cabinet items in the cart.
  const cartPairs = useMemo(
    () =>
      items
        .filter((i) => i.distributorId != null && i.productKind == null) // cabinets only (not non-cabinet products)
        .map((i) => ({ masterCode: i.masterCode, styleId: i.styleId, distributorId: i.distributorId })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.map((i) => `${i.masterCode}:${i.styleId}:${i.distributorId ?? "_"}`).join(",")]
  );

  // Fetch live tier-computed prices for all cart items. This ensures the cart
  // always shows the correct price for the viewer's current tier, even if the
  // stored unitPrice was added under a different tier.
  const { data: livePriceRows } = trpc.design.priceForCartItems.useQuery(
    { items: cartPairs, affiliateSlug: currentAffiliateSlug ?? undefined },
    { enabled: cartPairs.length > 0 }
  );

  // Build a map of exact masterCode:styleId:distributorId cart identity → live
  // unit price at the viewer's tier. Supplier-locked designs must never refresh
  // from another distributor that happens to carry the same master/style pair.
  const livePriceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of livePriceRows ?? []) {
      const price = isAffiliateCart ? Number(r.homeownerPrice) : resolveTierPrice(viewerTier, r);
      if (price != null) m.set(`${r.masterCode}:${r.styleId}:${r.distributorId ?? "_"}`, price);
    }
    return m;
  }, [livePriceRows, viewerTier, isAffiliateCart]);

  // Get the live price for a cart item, falling back to the stored unitPrice.
  const liveUnitPrice = (item: (typeof items)[number]): number | null => {
    if (item.productKind === "hardware") return item.unitPrice;
    const live = livePriceMap.get(`${item.masterCode}:${item.styleId}:${item.distributorId ?? "_"}`);
    const refreshedPrice = resolveAffiliateCartUnitPrice({
      storedUnitPrice: item.unitPrice,
      liveUnitPrice: live,
      tier: item.tier,
      isAffiliateCart,
      priceLocked: item.priceLocked,
    });
    return resolveLockedCheckoutUnitPrice({
      priceLocked: item.priceLocked,
      storedUnitPrice: item.unitPrice,
      recomputedUnitPrice: refreshedPrice,
    });
  };

  // Compute the live subtotal using live prices.
  const liveSubtotal = useMemo(
    () => items.reduce((s, i) => s + (liveUnitPrice(i) ?? 0) * i.qty, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, livePriceMap, isAffiliateCart]
  );

  const separateGlassItems = useMemo(
    () => separateGlassPurchaseItems(items),
    [items],
  );
  const hasOnlyTemporaryFreeShippingItems = useMemo(
    () => isTemporaryOneDollarFreeShippingOrder(items),
    [items],
  );
  const hardwareItems = useMemo(
    () => items
      .filter((item) => item.productKind === "hardware" && item.vendorProductId != null)
      .map((item) => ({ vendorProductId: item.vendorProductId!, qty: item.qty })),
    [items],
  );
  const containsKitchenMerchandise = useMemo(
    () => items.some((item) => item.productKind == null && item.distributorId != null),
    [items],
  );

  const requestOrder = () => {
    if (items.length === 0) return;
    // Include styleId and tier from the first item so OrderReview can pre-select
    // the correct door style and pricing tier instead of defaulting to Aston Green.
    const firstItem = items[0];
    const prefill = {
      items: items.map((i) => cartItemToCheckoutPrefill(i, liveUnitPrice(i))),
      styleId: firstItem?.styleId ?? null,
      tier: firstItem?.tier ?? null,
      kitchenDesignId: sourceDesignId,
      carrierPreference: null,
    };
    try {
      sessionStorage.setItem(cartPrefillStorageKey(storeScope), JSON.stringify(prefill));
    } catch {
      /* ignore */
    }
    navigate(currentAffiliateSlug ? `/store/${currentAffiliateSlug}/order` : "/order/new");
  };

  if (items.length === 0) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-3xl font-bold mb-3">{t("crt_empty_title")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("crt_empty_sub")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={currentAffiliateSlug ? `/store/${currentAffiliateSlug}` : "/catalog"}>{t("crt_browse_catalog")}</Link>
          </Button>
          <Button variant="outline" className="bg-background" asChild>
            <Link href={currentAffiliateSlug ? `/store/${currentAffiliateSlug}/design` : "/design"}>{t("crt_open_design")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl md:text-4xl font-bold">{t("crt_title")}</h1>
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          <Trash2 className="mr-1.5 h-4 w-4" /> {t("crt_clear")}
        </Button>
      </div>

      {sourceDesignId != null && (
        <div data-testid="saved-plan-order-link" className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
          <div>
            <p className="font-semibold">Saved kitchen plan linked to this order</p>
            <p className="mt-1 text-sm">Checkout will save this plan’s verified merchandise subtotal separately and requires a current carrier quote before shipping can be submitted.</p>
          </div>
        </div>
      )}

      {separateGlassItems.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="separate-glass-cart-warning"
          className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="font-semibold">Glass insert purchased separately</p>
              <p className="mt-1 text-sm">
                {separateGlassItems.length === 1
                  ? `${separateGlassItems[0]!.masterCode} requires a separate glass purchase from this distributor.`
                  : `${separateGlassItems.map((item) => item.masterCode).join(", ")} require separate glass purchases from this distributor.`}
                {" "}The cabinet is in your cart; confirm the matching glass insert or door with the distributor before ordering.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <div className="space-y-4">
          {(() => {
            // Group bundle parts (e.g. a Split Pantry's top + bottom) into a
            // single visual group under one heading; loose items render standalone.
            type Grp =
              | { kind: "single"; item: (typeof items)[number] }
              | { kind: "bundle"; bundleId: string; label: string; parts: typeof items };
            const groups: Grp[] = [];
            const idxByBundle = new Map<string, number>();
            for (const item of items) {
              if (item.bundleId) {
                const idx = idxByBundle.get(item.bundleId);
                if (idx == null) {
                  idxByBundle.set(item.bundleId, groups.length);
                  groups.push({ kind: "bundle", bundleId: item.bundleId, label: item.bundleLabel ?? "Split Pantry", parts: [item] });
                } else {
                  (groups[idx] as Extract<Grp, { kind: "bundle" }>).parts.push(item);
                }
              } else {
                groups.push({ kind: "single", item });
              }
            }

            const renderRow = (item: (typeof items)[number], inBundle: boolean) => {
            const unitPrice = liveUnitPrice(item);
            const lineTotal = calculateCartLineTotal(unitPrice, item.qty);
            const fillerDimensions = item.fillerStockWidthIn != null && item.fillerInstalledCutWidthIn != null
              ? { stock: formatEighthInches(item.fillerStockWidthIn), cut: formatEighthInches(item.fillerInstalledCutWidthIn) }
              : null;
            return (
              <div
                key={`${item.masterCode}-${item.styleId}-${item.tier}-${item.bundleId ?? ""}-${item.fillerStockWidthIn ?? ""}-${item.fillerInstalledCutWidthIn ?? ""}`}
                className={inBundle
                  ? "flex flex-col gap-2 p-3"
                  : "flex flex-col gap-2 rounded-xl border border-border bg-card p-4"}
              >
                <div className="flex gap-3 items-start">
                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{item.masterCode}</span>
                    {item.category ? (
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    ) : item.tier !== "homeowner" ? (
                      <Badge variant="secondary" className="text-[10px]">{item.tier}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-foreground leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.styleLabel}</p>
                  {fillerDimensions && (
                    <dl data-testid="cart-filler-stock-and-cut" className="mt-2 grid grid-cols-2 gap-x-3 rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-xs text-amber-950">
                      <div><dt className="uppercase tracking-wide text-[10px] font-semibold text-amber-800">Purchased stock</dt><dd className="font-semibold">{fillerDimensions.stock} wide</dd></div>
                      <div><dt className="uppercase tracking-wide text-[10px] font-semibold text-amber-800">Installed cut</dt><dd className="font-semibold">{fillerDimensions.cut} wide</dd></div>
                    </dl>
                  )}
                  {separateGlassItems.some((glassItem) => glassItem === item) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> Glass purchased separately
                    </p>
                  )}

                  </div>
                  {/* Price — right-aligned, stacked next to info block */}
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold">{money(lineTotal)}</div>
                    <div className="text-xs text-muted-foreground">{money(unitPrice)} {t("crt_each")}</div>
                  </div>
                </div>

                {/* Qty stepper + delete on same row */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-background"
                    onClick={() => setQty(item.masterCode, item.styleId, item.tier, item.qty - 1, item.fillerStockWidthIn, item.fillerInstalledCutWidthIn)}
                    aria-label={t("crt_decrease_qty")}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-background"
                    onClick={() => setQty(item.masterCode, item.styleId, item.tier, item.qty + 1, item.fillerStockWidthIn, item.fillerInstalledCutWidthIn)}
                    aria-label={t("crt_increase_qty")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.masterCode, item.styleId, item.tier, item.fillerStockWidthIn, item.fillerInstalledCutWidthIn)}
                    aria-label={t("crt_remove_item")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
            };

            const sectionForItem = (item: (typeof items)[number]) => {
              if (item.productKind === "hardware") {
                return { key: "hardware:HRDW", label: "Hardware Resources · Decorative Hardware" };
              }
              if (item.distributorId != null) {
                return { key: `cabinet:${item.distributorId}`, label: `${item.styleLabel || "Cabinet supplier"} · Cabinets & cabinet parts` };
              }
              if (item.productKind === "surface") {
                const category = item.category || "Products";
                return { key: `pelican:${category}`, label: `Pelican · ${/counter/i.test(category) ? "Countertops" : category}` };
              }
              return { key: `quote:${item.category || "other"}`, label: `${item.category || "Other drawing items"} · Quote required` };
            };
            const sections = new Map<string, { label: string; groups: Grp[] }>();
            for (const group of groups) {
              const first = group.kind === "single" ? group.item : group.parts[0];
              if (!first) continue;
              const section = sectionForItem(first);
              const existing = sections.get(section.key);
              if (existing) existing.groups.push(group);
              else sections.set(section.key, { label: section.label, groups: [group] });
            }
            return Array.from(sections.entries()).map(([sectionKey, section]) => (
              <section key={sectionKey} data-testid="cart-vendor-section" className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                  <h2 className="text-base font-semibold text-foreground">{section.label}</h2>
                  <span className="text-xs text-muted-foreground">{section.groups.length} line{section.groups.length === 1 ? "" : "s"}</span>
                </div>
                {section.groups.map((g) => {
              if (g.kind === "single") return renderRow(g.item, false);
              const groupTotal = g.parts.reduce(
                (sum, p) => {
                  const unit = liveUnitPrice(p);
                  const lineTotal = calculateCartLineTotal(unit, p.qty);
                  return lineTotal != null ? sum + lineTotal : sum;
                },
                0
              );
              const first = g.parts[0];
              return (
                <div
                  key={`bundle-${g.bundleId}`}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Package className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm font-semibold">{g.label}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {first?.styleLabel} · {g.parts.length} {t("crt_pieces")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{money(groupTotal || null)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          first && removeItem(first.masterCode, first.styleId, first.tier)
                        }
                        aria-label={t("crt_remove_item")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {g.parts.map((p) => renderRow(p, true))}
                  </div>
                </div>
              );
                })}
              </section>
            ));
          })()}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-fit rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">{t("crt_order_summary")}</h2>
          <Separator className="my-4" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("crt_items")}</span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("crt_est_subtotal")}</span>
              <span className="font-medium">${liveSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pricing tier</span>
              <span className="text-xs font-medium capitalize text-primary">{viewerTier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" /> {t("crt_shipping")}
              </span>
              <span className={hasOnlyTemporaryFreeShippingItems ? "text-xs font-semibold text-emerald-700" : "text-xs text-muted-foreground"}>
                {hasOnlyTemporaryFreeShippingItems ? "Free test shipping" : t("crt_shipping_quoted")}
              </span>
            </div>
          </div>
          <Separator className="my-4" />
          {hasOnlyTemporaryFreeShippingItems ? (
            <div role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="font-semibold">Free test shipping</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                This temporary one-dollar checkout item is exempt from freight. Other merchandise receives a shipping quote after a complete delivery address is entered.
              </p>
            </div>
          ) : (
            <div data-testid="checkout-address-shipping-notice" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
              <p className="font-semibold">Shipping is calculated after your delivery address is complete</p>
              <p className="mt-1">Continue to checkout, then enter your name, phone, street address, city, state, and ZIP. The system will request the appropriate carrier and hardware shipping quotes from that complete address.</p>
              {hardwareItems.length > 0 && (
                <p className="mt-1">Hardware ships free when it is ordered with qualifying kitchen cabinets.</p>
              )}
            </div>
          )}
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Review delivery and the final Stripe payment total before placing your order.
          </p>
          <Button
            className="w-full"
            size="lg"
            onClick={requestOrder}
          >
            <><Lock className="mr-1.5 h-4 w-4" /> Continue to secure checkout</>
          </Button>
          <Button variant="outline" className="mt-2 w-full bg-background" asChild>
            <Link href={currentAffiliateSlug ? `/store/${currentAffiliateSlug}` : "/catalog"}>{t("crt_continue_shopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
