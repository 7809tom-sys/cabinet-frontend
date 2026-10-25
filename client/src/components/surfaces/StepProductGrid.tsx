import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORY_GRADIENT,
  formatPrice,
  pelicanDisplayName,
  pelicanProductType,
  type PelicanCategory,
} from "@/lib/pelican";
import { Search, Check, Plus, Star } from "lucide-react";
import type { SurfacePick, SurfaceRole } from "@/lib/surfaceSelection";

const PAGE_LIMIT = 48;

export function StepProductGrid({
  category,
  role,
  selectedId,
  onPick,
}: {
  category: PelicanCategory;
  role: SurfaceRole;
  selectedId: number | null;
  onPick: (pick: SurfacePick) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.pelican.byCategory.useQuery({
    category: category as any,
    scope: "catalog",
    search: debounced || undefined,
    limit: PAGE_LIMIT,
    offset: 0,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${category.toLowerCase()}…`}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          No {category.toLowerCase()} items match your search.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p: any) => {
            const isSel = selectedId === p.id;
            const gradient =
              CATEGORY_GRADIENT[p.category] ?? "linear-gradient(135deg,#e5e7eb,#cbd5e1)";
            const displayName = pelicanDisplayName(p);
            const productType = pelicanProductType(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onPick({
                    id: p.id,
                    slug: p.slug,
                    name: p.name,
                    category: p.category,
                    subCategory: p.subCategory,
                    size: p.size,
                    imageUrl: p.imageUrl,
                    sellPrice: p.sellPrice,
                  })
                }
                className={`group overflow-hidden rounded-lg border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  isSel
                    ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/50"
                    : "border-border"
                }`}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={displayName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: gradient }}
                    >
                      <span className="px-2 text-center text-[10px] font-medium uppercase tracking-wide text-black/40">
                        {p.category}
                      </span>
                    </div>
                  )}
                  {p.isPopular && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-navy)]">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </span>
                  )}
                  <span
                    className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shadow-sm transition-colors ${
                      isSel
                        ? "bg-[var(--color-gold)] text-[var(--color-navy)]"
                        : "bg-white/90 text-[var(--color-navy)] group-hover:bg-white"
                    }`}
                  >
                    {isSel ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </div>
                <div className="space-y-1 p-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {productType}
                  </div>
                  <div className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug">
                    {displayName}
                  </div>
                  {p.size && <div className="text-[11px] text-muted-foreground">{p.size}</div>}
                  {p.pelicanCode && (
                    <div className="text-[10px] font-medium text-muted-foreground">Item code: {p.pelicanCode}</div>
                  )}
                  <div className="pt-0.5 text-sm font-bold text-[var(--color-navy)] dark:text-foreground">
                    {formatPrice(p.sellPrice)}
                    {(role === "flooring" || role === "tile") && p.sellPrice != null && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ box</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
