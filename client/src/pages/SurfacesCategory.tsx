import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSeo } from "@/hooks/useSeo";
import { PelicanProductCard } from "@/components/pelican/PelicanProductCard";
import {
  categoryFromSlug,
  categorySlug,
  CATEGORY_BLURB,
  PELICAN_STOREFRONT_CATEGORIES,
  pelicanCategoryLabel,
} from "@/lib/pelican";
import { ArrowLeft, Search, Star, ChevronLeft, ChevronRight, Waves } from "lucide-react";

const PAGE_SIZE = 24;

export default function SurfacesCategory({ slug, affiliateSlug }: { slug: string; affiliateSlug?: string }) {
  const [, navigate] = useLocation();
  const queryString = useSearch();
  const category = categoryFromSlug(slug);
  const requestedFamily = useMemo(
    () => new URLSearchParams(queryString).get("family")?.trim() || undefined,
    [queryString]
  );

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset filters when the category or linked product family changes.
  useEffect(() => {
    setSearch("");
    setDebounced("");
    setSubCategory(requestedFamily);
    setPage(0);
  }, [slug, requestedFamily]);

  useSeo({
    title: category
      ? `${pelicanCategoryLabel(category)} — Surfaces & Fixtures | Cabinet Dealz`
      : "Surfaces & Fixtures | Cabinet Dealz",
    description: category ? CATEGORY_BLURB[category] : undefined,
  });

  const input = useMemo(
    () => ({
      category: (category ?? "Flooring") as any,
      scope: "catalog" as const,
      search: debounced || undefined,
      subCategory,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      affiliateSlug,
    }),
    [category, debounced, subCategory, page, affiliateSlug]
  );

  const { data, isLoading, error } = trpc.pelican.byCategory.useQuery(input, {
    enabled: !!category,
  });

  if (!category) {
    return (
      <div className="container py-16 text-center">
        <Waves className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Category not found</h1>
        <p className="mt-2 text-muted-foreground">
          That surfaces category doesn't exist.
        </p>
        <Link href={affiliateSlug ? `/store/${affiliateSlug}/surfaces` : "/surfaces"}>
          <Button className="mt-5 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Surfaces
          </Button>
        </Link>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showSuggested = page === 0 && !debounced && !subCategory && (data?.suggested?.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      {/* Category header */}
      <section className="border-b border-border/50 bg-muted/40">
        <div className="container py-8">
          <Link href={affiliateSlug ? `/store/${affiliateSlug}/surfaces` : "/surfaces"}>
            <button className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All Surfaces
            </button>
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold">{pelicanCategoryLabel(category)}</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {CATEGORY_BLURB[category]}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${pelicanCategoryLabel(category).toLowerCase()}…`}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category quick-switch */}
          <div className="mt-4 flex flex-wrap gap-2">
            {PELICAN_STOREFRONT_CATEGORIES.map((c) => (
              <Link key={c} href={affiliateSlug ? `/store/${affiliateSlug}/surfaces/${categorySlug(c)}` : `/surfaces/${categorySlug(c)}`}>
                <Badge
                  variant={c === category ? "default" : "secondary"}
                  className="cursor-pointer"
                >
                  {pelicanCategoryLabel(c)}
                </Badge>
              </Link>
            ))}
          </div>

          {/* Sub-category filter */}
          {data && data.subCategories.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Refine:</span>
              <Button
                size="sm"
                variant={subCategory === undefined ? "default" : "outline"}
                className="h-7"
                onClick={() => {
                  setSubCategory(undefined);
                  setPage(0);
                }}
              >
                All
              </Button>
              {data.subCategories.map((sc) => (
                <Button
                  key={sc}
                  size="sm"
                  variant={subCategory === sc ? "default" : "outline"}
                  className="h-7"
                  onClick={() => {
                    setSubCategory(sc);
                    setPage(0);
                  }}
                >
                  {sc}
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container py-8">
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-destructive">Could not load products. {error.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate(`/surfaces/${slug}`)}
            >
              Retry
            </Button>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : total === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No products match your search in {pelicanCategoryLabel(category)}.
          </Card>
        ) : (
          <>
            {showSuggested && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-[var(--color-gold)] text-[var(--color-gold)]" />
                  <h2 className="text-lg font-bold">Featured picks</h2>
                </div>
                <div className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {data!.suggested.map((p: any) => (
                    <PelicanProductCard key={`sug-${p.id}`} product={p} affiliateSlug={affiliateSlug} />
                  ))}
                </div>
                <div className="mt-8 border-t border-border/60" />
              </div>
            )}

            <div className="mb-3 text-sm text-muted-foreground">
              {total} product{total === 1 ? "" : "s"}
            </div>
            <div className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {data!.items.map((p: any) => (
                <PelicanProductCard key={p.id} product={p} affiliateSlug={affiliateSlug} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
