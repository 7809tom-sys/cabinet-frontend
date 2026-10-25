import { useEffect, useMemo, useState } from "react";
import { Search, PackageCheck, Truck, ChevronLeft, ChevronRight, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeo } from "@/hooks/useSeo";
import { useCart } from "@/contexts/CartContext";
import { useLocation } from "wouter";
import { affiliateSlugForStoreScope, resolveStoreScope } from "@/lib/affiliateContext";
import { toast } from "sonner";

const PAGE_SIZE = 24;
const ALL_STYLES = "__all_styles__";
const ALL_TYPES = "__all_types__";

function price(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "Price unavailable";
}

export default function Hardware() {
  const { addItem, setStorefrontSlug } = useCart();
  const [, navigate] = useLocation();
  const storeScope = resolveStoreScope({
    pathname: typeof window !== "undefined" ? window.location.pathname : "/hardware",
    search: typeof window !== "undefined" ? window.location.search : "",
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  });
  const affiliateSlug = affiliateSlugForStoreScope(storeScope);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [collection, setCollection] = useState<string | undefined>();
  const [productType, setProductType] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, number>>({});

  useSeo({
    title: "Cabinet Hardware Styles & Finishes | Cabinet Dealz",
    description: "Explore decorative cabinet hardware styles and select an available finish for each exact product configuration.",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const input = useMemo(() => ({
    collection,
    productType,
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    affiliateSlug: affiliateSlug ?? undefined,
  }), [collection, productType, debouncedSearch, page, affiliateSlug]);

  const { data: filters } = trpc.hardware.configurationFilters.useQuery();
  const { data, isLoading, error } = trpc.hardware.listConfigurations.useQuery(input);

  const setStyle = (next: string) => {
    setCollection(next === ALL_STYLES ? undefined : next);
    setPage(0);
  };
  const setType = (next: string) => {
    setProductType(next === ALL_TYPES ? undefined : next);
    setPage(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border/60 bg-muted/40">
        <div className="container py-8 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[1fr,minmax(280px,360px)] lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
                <PackageCheck className="h-4 w-4" /> Decorative Hardware
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">Cabinet Hardware</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Explore hardware styles, choose the right size or type, then select the finish you want to order. Each finish keeps its own exact item number, image, and price.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 pl-9"
                placeholder="Search by style, type, finish, or item number"
                aria-label="Search cabinet hardware"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="hardware-style-filter" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Style
              </label>
              <Select value={collection ?? ALL_STYLES} onValueChange={setStyle}>
                <SelectTrigger id="hardware-style-filter" className="h-10 w-full bg-background" aria-label="Filter hardware by style">
                  <SelectValue placeholder="All styles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STYLES}>All styles</SelectItem>
                  {filters?.collections.map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hardware-type-filter" className="text-xs font-semibold text-muted-foreground">Type / size</label>
              <Select value={productType ?? ALL_TYPES} onValueChange={setType}>
                <SelectTrigger id="hardware-type-filter" className="h-10 w-full bg-background" aria-label="Filter hardware by type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  {filters?.productTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(collection || productType || search) && (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full bg-background sm:w-auto"
                  onClick={() => {
                    setCollection(undefined);
                    setProductType(undefined);
                    setSearch("");
                    setDebouncedSearch("");
                    setPage(0);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container py-7 md:py-9">
        <Card className="mb-7 flex gap-3 border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-4 text-sm leading-6">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-gold)]" />
          <div><strong>Shipping notice:</strong> Hardware is consolidated into one package per order. Free hardware shipping applies when it is ordered with kitchen merchandise. Stand-alone shipping is shown only after Operations enables the verified Hardware Resources shipment profile.</div>
        </Card>

        {error ? (
          <Card className="p-10 text-center text-destructive">Could not load hardware. {error.message}</Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[31rem] rounded-xl" />)}
          </div>
        ) : data?.items.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No hardware styles match those filters. Try another style, type, finish, or item number.</Card>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">Choose a style configuration, then select an available finish.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data?.items.map((item) => {
                const selected = item.variants.find((variant) => variant.id === selectedVariantIds[item.configurationKey]) ?? item.variants[0];
                if (!selected) return null;
                const finishSelectId = `hardware-finish-${item.configurationKey}`;
                return (
                  <Card key={item.configurationKey} className="group flex min-h-[30rem] flex-col overflow-hidden border-border/70">
                    <div className="aspect-square bg-muted/30 p-3">
                      {selected.imageUrl ? (
                        <img
                          src={selected.imageUrl}
                          alt={`${item.collection} ${item.productType}, ${item.label}; ${selected.finish} finish`}
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.025]"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col space-y-2 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.collection} · {item.productType}</p>
                      <h2 className="line-clamp-3 min-h-[3.75rem] text-sm font-semibold leading-5">{item.label}</h2>
                      <div className="space-y-1.5 pt-1">
                        <label id={`${finishSelectId}-label`} className="text-xs font-semibold text-muted-foreground">Finish / color</label>
                        <Select
                          value={String(selected.id)}
                          onValueChange={(value) => setSelectedVariantIds((current) => ({ ...current, [item.configurationKey]: Number(value) }))}
                        >
                          <SelectTrigger id={finishSelectId} aria-labelledby={`${finishSelectId}-label`} className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {item.variants.map((variant) => (
                              <SelectItem key={variant.id} value={String(variant.id)}>
                                {variant.finish} · {variant.sku}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p aria-live="polite" className="pt-1 text-xs font-medium text-muted-foreground">
                        Finish: {selected.finish} · Item: {selected.sku}
                      </p>
                      <p className="text-lg font-bold text-[var(--color-navy)] dark:text-foreground">
                        {price(selected.unitPriceCents != null ? selected.unitPriceCents / 100 : null)}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-auto min-h-11 w-full gap-1.5"
                        disabled={selected.unitPriceCents == null}
                        onClick={() => {
                          if (selected.unitPriceCents == null) return;
                          if (affiliateSlug) setStorefrontSlug(affiliateSlug);
                          const result = addItem({
                            masterCode: selected.sku,
                            name: `${item.collection} ${item.productType}: ${item.label}`,
                            styleId: 0,
                            styleLabel: `Decorative Hardware · ${selected.finish}`,
                            distributorId: null,
                            tier: "homeowner",
                            unitPrice: selected.unitPriceCents / 100,
                            priceLocked: true,
                            productKind: "hardware",
                            vendorProductId: selected.id,
                            qty: 1,
                            imageUrl: selected.imageUrl,
                            category: item.productType,
                          });
                          if (result.ok) toast.success(`Added ${item.collection} in ${selected.finish} to cart`, {
                            action: { label: "View Cart", onClick: () => navigate(affiliateSlug ? `/store/${affiliateSlug}/cart` : "/cart") },
                          });
                        }}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" /> Add selected finish
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
            {(page > 0 || data?.hasMore) && (
              <div className="mt-9 flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous styles
                </Button>
                <Button size="sm" variant="outline" disabled={!data?.hasMore} onClick={() => setPage((current) => current + 1)}>
                  More styles <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
