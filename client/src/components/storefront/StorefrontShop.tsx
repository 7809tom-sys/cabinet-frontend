import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { GlassPolicyBadge } from "@/components/GlassPolicyBadge";
import { useFamilyLock, type LockedFamily } from "@/hooks/useFamilyLock";
import { useStorefrontBranding, type StorefrontBranding } from "@/hooks/useStorefrontBranding";
import { useAuth } from "@/_core/hooks/useAuth";
import { favoriteStorageKey as buildFavoriteStorageKey, filterFavoriteFamilies, parseFavoriteFamilyIds, toggleFavoriteFamilyId } from "@/lib/favoriteFamilies";
import { favoriteSyncStatusText } from "@/lib/favoriteSyncStatus";
import {
  STOREFRONT_STRINGS,
  type Lang,
  type StringKey,
} from "@/lib/storefrontI18n";
import { translateSpec } from "@/lib/i18n/specPhrases";
import {
  ArrowRight, Check, Lock, RefreshCw, Sparkles, Search, Truck, ChevronRight,
  Minus, Plus, ShoppingCart, Info, Heart,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { affiliateCabinetDetailHref } from "@/lib/affiliateCabinetDetailRoute";
import { sortStorefrontCategoryTabs, storefrontCategoryTabLabel } from "@/lib/storefrontCategoryTabs";
import { affiliateDesignerPath } from "@/lib/affiliateStorefrontUrl";
import { useSearch } from "wouter";
import { doorStyleColorHex, doorStyleSwatchImageUrl } from "@/lib/doorColorSpectrum";
import {
  familyFinishKey,
  familyFinishLabel,
  familyImageUrl,
  groupStorefrontDoorFamilies,
  type StorefrontDoorVariant,
} from "@/lib/storefrontDoorFamilies";

type Brand = { primary: string; accent: string };

type SwatchStyle = {
  styleCode?: string | null;
  ourName?: string | null;
  name?: string | null;
  doorStyle?: string | null;
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
};

/**
 * Shows only a catalog-backed image. A missing or broken source is reported
 * honestly instead of being replaced by a fabricated door illustration.
 */
function FamilyCardImage({
  src,
  alt,
  style,
  imgClassName,
  swatchClassName,
  emptyLabel = "No photo yet",
}: {
  src?: string | null;
  alt: string;
  style: SwatchStyle;
  imgClassName?: string;
  swatchClassName?: string;
  emptyLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;
  if (showImg) {
    return (
      <img
        src={src as string}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    );
  }
  return <div className={`${swatchClassName ?? ""} flex items-center justify-center bg-muted px-3 text-center text-xs text-muted-foreground`}>{emptyLabel}</div>;
}

function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>) {
  const table = STOREFRONT_STRINGS[lang] ?? STOREFRONT_STRINGS.en;
  let s: string = table[key] ?? STOREFRONT_STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  return s;
}

function money(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function publicStyleName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+\([^)]*\)\s*$/, "").trim() || "Unnamed style";
}

function readFavoriteFamilyIds(storageKey: string): number[] {
  if (typeof window === "undefined") return [];
  return parseFavoriteFamilyIds(window.localStorage.getItem(storageKey));
}

function featuredLineSessionKey(slug: string) {
  const key = `cd_featured_line_session_${slug}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const value = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, value);
    return value;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Family-locked shopping surface. Until a family (cabinet line) is chosen it
 * shows the line picker. Once locked, all browsing is scoped to that one line
 * (single distributor → single shipment).
 */
export function StorefrontShop({
  slug,
  brand,
  lang,
  withRef,
}: {
  slug: string;
  brand: Brand;
  lang: Lang;
  withRef: (path: string) => string;
}) {
  const { family, lock, clear } = useFamilyLock(slug);
  const branding = useStorefrontBranding(slug);
  const availableFamilies = trpc.storefront.families.useQuery(
    { slug },
    { enabled: family !== null },
  );

  // An affiliate may later remove a supplier line from their storefront. Do not
  // leave a customer trapped in a stale localStorage family lock; return them to
  // the current picker without touching their cart or any other storefront state.
  useEffect(() => {
    if (!family || !availableFamilies.data) return;
    if (!availableFamilies.data.some((candidate) => candidate.styleId === family.styleId)) {
      clear();
    }
  }, [availableFamilies.data, clear, family]);

  if (!family) {
    return <FamilyPicker brand={brand} lang={lang} onPick={lock} branding={branding} slug={slug} withRef={withRef} />;
  }
  return (
    <LockedCatalog
      family={family}
      brand={brand}
      lang={lang}
      withRef={withRef}
      onSwitch={clear}
      branding={branding}
      slug={slug}
    />
  );
}

// ─── Line picker ────────────────────────────────────────────────────────────
function FamilyPicker({
  brand,
  lang,
  onPick,
  branding,
  slug,
  withRef,
}: {
  brand: Brand;
  lang: Lang;
  onPick: (f: LockedFamily) => void;
  branding: StorefrontBranding;
  slug?: string;
  withRef: (path: string) => string;
}) {
  const { user } = useAuth();
  const { data, isLoading } = trpc.storefront.families.useQuery({ slug: slug || undefined });
  const recordFeaturedViews = trpc.storefront.recordFeaturedDistributorViews.useMutation();
  const storageKey = buildFavoriteStorageKey(slug);
  const storefrontScope = slug || "main";
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => readFavoriteFamilyIds(storageKey));
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [detailFamily, setDetailFamily] = useState<typeof data extends Array<infer T> ? T : never | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, number>>({});
  const search = useSearch();
  const autoLockedStyleRef = useRef<number | null>(null);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const accountFavoriteQuery = trpc.favorites.list.useQuery(
    { storefrontSlug: storefrontScope },
    { enabled: Boolean(user?.id), staleTime: 60_000 }
  );
  const syncFavorites = trpc.favorites.sync.useMutation();
  const addFavorite = trpc.favorites.add.useMutation();
  const removeFavorite = trpc.favorites.remove.useMutation();
  const mergedAccountScopeRef = useRef<string | null>(null);

  useEffect(() => {
    setFavoriteIds(readFavoriteFamilyIds(storageKey));
  }, [storageKey]);

  // Buy-now links from the room-scene gallery arrive back at this picker with
  // the exact style in the query string. Lock that family automatically so
  // the visitor lands in its catalog instead of having to choose again.
  useEffect(() => {
    const requestedStyleId = Number(new URLSearchParams(search).get("style"));
    if (!Number.isInteger(requestedStyleId) || requestedStyleId <= 0) return;
    if (autoLockedStyleRef.current === requestedStyleId || !data?.length) return;
    const requestedFamily = data.find((candidate) => candidate.styleId === requestedStyleId);
    if (!requestedFamily) return;
    autoLockedStyleRef.current = requestedStyleId;
    onPick(requestedFamily);
  }, [data, onPick, search]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(favoriteIds));
    } catch {
      // Favorites remain usable for the current session if storage is blocked.
    }
  }, [storageKey, favoriteIds]);

  useEffect(() => {
    if (!user?.id) {
      setLastSyncedAt(null);
      setSyncError(false);
      return;
    }
    if (accountFavoriteQuery.data?.lastSyncedAt) {
      setLastSyncedAt(new Date(accountFavoriteQuery.data.lastSyncedAt));
    }
  }, [accountFavoriteQuery.data?.lastSyncedAt, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      mergedAccountScopeRef.current = null;
      return;
    }
    if (accountFavoriteQuery.isLoading || accountFavoriteQuery.data == null) return;

    const mergeScope = `${user.id}:${storefrontScope}`;
    if (mergedAccountScopeRef.current === mergeScope) return;
    mergedAccountScopeRef.current = mergeScope;

    const mergedIds = Array.from(new Set([
      ...favoriteIds,
      ...accountFavoriteQuery.data.styleIds,
    ]));
    setFavoriteIds(mergedIds);
    syncFavorites.mutate(
      { storefrontSlug: storefrontScope, styleIds: mergedIds },
      {
        onSuccess: (result) => {
          setFavoriteIds(result.styleIds);
          setLastSyncedAt(result.lastSyncedAt ? new Date(result.lastSyncedAt) : null);
          setSyncError(false);
        },
        onError: () => setSyncError(true),
      }
    );
  }, [
    accountFavoriteQuery.data,
    accountFavoriteQuery.isLoading,
    favoriteIds,
    storefrontScope,
    syncFavorites,
    user?.id,
  ]);

  function toggleFavorite(styleId: number) {
    const nextIds = toggleFavoriteFamilyId(favoriteIds, styleId);
    setFavoriteIds(nextIds);
    if (user?.id) {
      const options = {
        onSuccess: (result: { lastSyncedAt: Date | null }) => {
          setLastSyncedAt(result.lastSyncedAt ? new Date(result.lastSyncedAt) : null);
          setSyncError(false);
        },
        onError: () => setSyncError(true),
      };
      if (nextIds.includes(styleId)) {
        addFavorite.mutate({ storefrontSlug: storefrontScope, styleId }, options);
      } else {
        removeFavorite.mutate({ storefrontSlug: storefrontScope, styleId }, options);
      }
    }
  }

  const visibleFamilies = showFavorites
    ? filterFavoriteFamilies(data ?? [], favoriteIds)
    : (data ?? []);
  const groupedFamilies = useMemo(
    () => groupStorefrontDoorFamilies(visibleFamilies as StorefrontDoorVariant[]),
    [visibleFamilies],
  );

  const { data: affiliatePromos } = trpc.storefront.activeBannerAndPromos.useQuery(
    { slug: slug! },
    { enabled: !!slug, staleTime: 5 * 60 * 1000 }
  );
  const promoByStyleId = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of affiliatePromos?.promos ?? []) {
      if (p.targetId) map.set(p.targetId, p.label);
    }
    return map;
  }, [affiliatePromos?.promos]);

  useEffect(() => {
    if (!slug || !data?.length) return;
    const featuredDistributorIds = Array.from(new Set(data.filter((family) => family.featuredDistributor).map((family) => family.distributorId)));
    const featuredStyleIds = Array.from(new Set(data.filter((family) => family.featured && family.styleId != null).map((family) => family.styleId)));
    if (featuredDistributorIds.length === 0 && featuredStyleIds.length === 0) return;
    recordFeaturedViews.mutate({
      slug,
      distributorIds: featuredDistributorIds,
      styleIds: featuredStyleIds,
      sessionKey: featuredLineSessionKey(slug),
    });
  // The server de-dupes per session. Keep this isolated from favorites and local
  // client sorting so a visitor cannot accidentally create extra page views.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, data]);

  return (
    <section id="shop" className="py-16 md:py-20">
      <div className="container">
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <a href={withRef(`/store/${slug}/surfaces`)} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pelican</p><p className="mt-1 font-semibold">Surfaces &amp; Fixtures</p><p className="mt-1 text-sm text-muted-foreground">Countertops, flooring, tile, sinks, faucets, tubs and toilets.</p></div>
              <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </div>
          </a>
          <a href={withRef(`/store/${slug}/closet`)} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Closet Studio</p><p className="mt-1 font-semibold">Plan your closet</p><p className="mt-1 text-sm text-muted-foreground">Towers, shelves, hanging areas, corners and visual basket layouts.</p></div>
              <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </div>
          </a>
        </div>
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-3">
              {t(lang, "family_pick_title")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              {t(lang, "family_pick_sub")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {user ? (
                <span className={syncError ? "text-destructive" : undefined}>
                  {favoriteSyncStatusText({
                    authenticated: true,
                    lastSyncedAt,
                    isPending: syncFavorites.isPending || addFavorite.isPending || removeFavorite.isPending,
                    hasError: syncError,
                  })}
                </span>
              ) : (
                <>
                  Saved on this device. {" "}
                  <a href={getLoginUrl()} className="font-semibold underline underline-offset-2 hover:no-underline">
                    Sign in to sync across devices
                  </a>
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant={showFavorites ? "default" : "outline"}
            className="shrink-0 gap-2"
            onClick={() => setShowFavorites((current) => !current)}
            style={showFavorites ? { backgroundColor: brand.accent, borderColor: brand.accent } : undefined}
            aria-pressed={showFavorites}
          >
            <Heart className={`h-4 w-4 ${favoriteIds.length > 0 ? "fill-current" : ""}`} />
            My Favorites
          </Button>
        </div>

        {!isLoading && data && data.length > 0 && (
          <div className="mb-10 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl font-bold">Door samples</h3>
                <p className="mt-1 text-sm text-muted-foreground">Choose a door profile, then preview its available finishes.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {groupedFamilies.map((family) => {
                const selected = family.variants.find((variant) => variant.styleId === selectedVariantIds[family.key]) ?? family.selected;
                const image = familyImageUrl(selected);
                const buyHref = withRef(slug ? `/store/${slug}/catalog?style=${selected.styleId}` : `/catalog?style=${selected.styleId}`);
                const designHref = withRef(slug ? `${affiliateDesignerPath(slug)}?style=${selected.styleId}` : `/design?style=${selected.styleId}`);
                const displayName = publicStyleName(branding.brandName(selected.styleId, selected.name ?? ""));
                return (
                  <div
                    key={`sample-${family.key}`}
                    role="link"
                    tabIndex={0}
                    aria-label={`Shop ${family.label}, selected finish ${displayName}`}
                    onClick={() => { window.location.assign(buyHref); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        window.location.assign(buyHref);
                      }
                    }}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {image ? <img src={image} alt={`${displayName} door sample`} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">No photo yet</div>}
                      {family.featured && <Badge className="absolute left-2 top-2 border-0 text-white" style={{ backgroundColor: brand.accent }}>Featured</Badge>}
                      <button
                        type="button"
                        aria-label={favoriteIdSet.has(selected.styleId) ? `Remove ${displayName} from favorites` : `Add ${displayName} to favorites`}
                        aria-pressed={favoriteIdSet.has(selected.styleId)}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(selected.styleId);
                        }}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 text-foreground shadow-md hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Heart className={`h-4 w-4 ${favoriteIdSet.has(selected.styleId) ? "fill-current" : ""}`} style={favoriteIdSet.has(selected.styleId) ? { color: brand.accent } : undefined} />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold">{family.label}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{displayName}</p>
                      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colour / finish</p>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${family.label} colour and finish options`}>
                          {family.variants.map((variant) => {
                            const active = variant.styleId === selected.styleId;
                            const label = publicStyleName(familyFinishLabel(variant));
                            return (
                              <button
                                key={familyFinishKey(variant)}
                                type="button"
                                role="radio"
                                aria-label={label}
                                aria-checked={active}
                                title={label}
                                onClick={() => setSelectedVariantIds((current) => ({ ...current, [family.key]: variant.styleId }))}
                                className={`h-7 w-7 rounded-full border-2 shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-foreground ring-2 ring-primary/30" : "border-white"}`}
                                style={{
                                  backgroundColor: doorStyleColorHex(variant),
                                  backgroundImage: doorStyleSwatchImageUrl(variant)
                                    ? `url("${doorStyleSwatchImageUrl(variant)}")`
                                    : undefined,
                                  backgroundPosition: "center",
                                  backgroundSize: "cover",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <a
                          href={buyHref}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center justify-center rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
                        >
                          Buy now
                        </a>
                        <a
                          href={designHref}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          Design
                        </a>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailFamily(selected as never);
                          }}
                          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          Door detail
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">—</p>
        ) : visibleFamilies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-serif text-xl font-bold">No favorite cabinet families yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Tap the heart on any cabinet family to save it here for quick access.
            </p>
            <Button type="button" variant="outline" className="mt-5" onClick={() => setShowFavorites(false)}>
              Browse all families
            </Button>
          </div>
        ) : null}
      </div>

      {/* Door detail modal */}
      {detailFamily && (
        <DoorDetailModal
          family={detailFamily as DoorDetailFamily}
          brand={brand}
          lang={lang}
          open={!!detailFamily}
          onClose={() => setDetailFamily(null)}
        />
      )}
    </section>
  );
}

// ─── Locked catalog ───────────────────────────────────────────────────────────
function LockedCatalog({
  family,
  brand,
  lang,
  withRef,
  onSwitch,
  branding,
  slug,
}: {
  family: LockedFamily;
  brand: Brand;
  lang: Lang;
  withRef: (path: string) => string;
  onSwitch: () => void;
  branding: StorefrontBranding;
  slug?: string;
}) {
  // The affiliate's white-label name for this line (falls back to central name).
  const displayName = publicStyleName(branding.brandName(family.styleId, family.name));
  const [showDetails, setShowDetails] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [subGroup, setSubGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Reset the sub-group whenever the top-level category changes.
  useEffect(() => {
    setSubGroup(null);
  }, [category]);

  const { data: cats } = trpc.storefront.familyCategories.useQuery({ styleId: family.styleId });
  const orderedCategories = useMemo(() => sortStorefrontCategoryTabs(cats ?? []), [cats]);

  // Accessory has clean display sub-groups (Trim & Molding / Accessories) so the
  // tab never shows a sprawl of micro-categories.
  const { data: accessorySubs } = trpc.storefront.familySubCategories.useQuery(
    { styleId: family.styleId, category: "Accessory" },
    { enabled: category === "Accessory" }
  );

  const catalogInput = useMemo(
    () => ({
      styleId: family.styleId,
      category: category ?? undefined,
      subCategory: category === "Accessory" && subGroup ? subGroup : undefined,
      search: debounced || undefined,
      limit: 60,
      slug: slug || undefined,
    }),
    [family.styleId, category, subGroup, debounced, slug]
  );
  const { data: catalog, isLoading } = trpc.storefront.familyCatalog.useQuery(catalogInput);
  const { data: promos } = trpc.promotions.activeForStorefront.useQuery();

  return (
    <section id="shop" className="py-12 md:py-16">
      <div className="container">
        {/* Dream-kitchen scene banner for the locked line — only this family's own verified photo. */}
        <div className="relative mb-4 overflow-hidden rounded-2xl">
          <FamilyCardImage
            src={family.roomSceneImageUrl}
            alt={`${displayName} kitchen`}
            style={{
              ourName: displayName,
              name: displayName,
              doorStyle: family.doorStyle,
              color: family.color,
              finish: family.finish,
            }}
            imgClassName="h-44 w-full object-cover sm:h-56"
            swatchClassName="h-44 w-full sm:h-56"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/85">
              <Lock className="h-3 w-3" /> {t(lang, "family_locked_label")}
            </div>
            <h2 className="font-serif text-2xl font-bold text-white drop-shadow sm:text-3xl">
              {displayName}
            </h2>
            {[family.finish, family.color].filter(Boolean).length > 0 && (
              <p className="text-sm text-white/85">
                {[family.finish, family.color].filter(Boolean).map((value) => publicStyleName(value)).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Lock banner */}
        <div
          className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <FamilyCardImage
              src={family.roomSceneImageUrl || family.thumbnailImageUrl}
              alt={displayName}
              style={{
                ourName: displayName,
                name: displayName,
                doorStyle: family.doorStyle,
                color: family.color,
                finish: family.finish,
              }}
              imgClassName="h-12 w-12 rounded-lg object-cover"
              swatchClassName="h-12 w-12 overflow-hidden rounded-lg"
            />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="h-3 w-3" /> {t(lang, "family_locked_label")}
              </div>
              <div className="font-serif text-lg font-bold leading-tight" style={{ color: brand.primary }}>
                {displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 bg-card" onClick={() => setShowDetails(true)}>
              <Info className="h-3.5 w-3.5" /> {t(lang, "family_door_detail")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-card" onClick={onSwitch}>
              <RefreshCw className="h-3.5 w-3.5" /> {t(lang, "family_switch")}
            </Button>
          </div>
        </div>

        {/* Door detail modal for locked family */}
        <DoorDetailModal
          family={family as DoorDetailFamily}
          brand={brand}
          lang={lang}
          open={showDetails}
          onClose={() => setShowDetails(false)}
        />

        <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4" style={{ color: brand.accent }} />
          {t(lang, "family_one_line_note")}
        </p>

        {/* AI recommender */}
        <Recommender family={family} brand={brand} lang={lang} branding={branding} slug={slug} />

        {/* Category tabs + search */}
        <div className="mt-8 mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {orderedCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
                style={
                  category === c
                    ? { backgroundColor: brand.primary, color: "#fff", borderColor: brand.primary }
                  : { borderColor: "var(--border)" }
                }
              >
                {storefrontCategoryTabLabel(c)}
              </button>
            ))}
            <button
              onClick={() => setCategory(null)}
              className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
              style={
                category === null
                  ? { backgroundColor: brand.primary, color: "#fff", borderColor: brand.primary }
                  : { borderColor: "var(--border)" }
              }
            >
              {t(lang, "shop_view_all")}
            </button>
          </div>
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "rec_placeholder")}
              className="pl-9"
            />
          </div>
        </div>

        {/* Accessory sub-group tabs (Trim & Molding / Accessories) — only the
            consolidated groups, never a sprawl of micro-categories. */}
        {category === "Accessory" && (accessorySubs?.length ?? 0) > 0 && (
          <div className="-mt-2 mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => setSubGroup(null)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
              style={
                subGroup === null
                  ? { backgroundColor: brand.accent, color: "#fff", borderColor: brand.accent }
                  : { borderColor: "var(--border)" }
              }
            >
              {t(lang, "shop_view_all")}
            </button>
            {(accessorySubs ?? []).map((g) => (
              <button
                key={g}
                onClick={() => setSubGroup(g)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={
                  subGroup === g
                    ? { backgroundColor: brand.accent, color: "#fff", borderColor: brand.accent }
                    : { borderColor: "var(--border)" }
                }
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Catalog grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !catalog || catalog.items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t(lang, "rec_empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {catalog.items.map((it) => (
              <CatalogCard
                key={it.id}
                item={it}
                styleId={family.styleId}
                brand={brand}
                lang={lang}
                branding={branding}
                family={family}
                promos={promos ?? []}
                slug={slug}
              />
            ))}
          </div>
        )}

        {/* Shipping note + continue */}
        <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-8 text-center">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" /> {t(lang, "ship_not_included")}
          </p>
		  <Link href={withRef(slug ? `/store/${slug}/order` : "/order/new")}>
            <Button size="lg" className="gap-2 font-semibold text-white" style={{ backgroundColor: brand.accent }}>
              {t(lang, "family_continue_quote")} <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Promotion helpers ────────────────────────────────────────────────────────
type ActivePromo = {
  id: number;
  distributorId: number;
  name: string;
  skuIds: unknown;
  styleId: number | null;
  category: string | null;
  discountType: string;
  discountValue: string;
};

/** Find the best matching promo for a catalog item (most specific wins). */
function findPromo(
  item: { id: number; category: string | null },
  styleId: number,
  distributorId: number,
  promos: ActivePromo[]
): ActivePromo | null {
  const mine = promos.filter((p) => p.distributorId === distributorId);
  // Priority: SKU-level > style-level > category-level
  const bySkuId = mine.find((p) => Array.isArray(p.skuIds) && (p.skuIds as number[]).includes(item.id));
  if (bySkuId) return bySkuId;
  const byStyle = mine.find((p) => !p.skuIds && p.styleId === styleId && !p.category);
  if (byStyle) return byStyle;
  const byCat = mine.find((p) => !p.skuIds && !p.styleId && p.category === item.category);
  return byCat ?? null;
}

/** Apply a promo to a base price, returning the sale price. */
function applyPromoPrice(basePrice: number, promo: ActivePromo): number {
  const val = Number(promo.discountValue);
  if (!isFinite(val) || val <= 0) return basePrice;
  if (promo.discountType === "percent") {
    return Math.max(0, basePrice * (1 - val / 100));
  }
  // fixed_price: discountValue is the final price
  return Math.max(0, val);
}

/** Compute the save % badge label for a promo. */
function promoSavePct(basePrice: number, promo: ActivePromo): number | null {
  const salePrice = applyPromoPrice(basePrice, promo);
  if (salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}

// ─── Catalog card (with glass-door upsell on solid wall cabinets) ──────────────
type CatalogItem = {
  id: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  homeownerPrice: unknown;
  imageUrl?: string | null;
  catalogImageUrl?: string | null;
  glassIncluded?: boolean | null;
};

function CatalogCard({
  item,
  styleId,
  brand,
  lang,
  branding,
  family,
  promos,
  slug,
}: {
  item: CatalogItem;
  styleId: number;
  brand: Brand;
  lang: Lang;
  branding: StorefrontBranding;
  family: LockedFamily;
  promos: ActivePromo[];
  slug?: string;
}) {
  const [glass, setGlass] = useState(false);
  const [qty, setQtyState] = useState(1);
  const { addItem, setStorefrontSlug } = useCart();

  // Only solid WALL cabinets are eligible to offer a glass-door swap. The query
  // returns null for anything else (oven/tall/base, or no buyable GD twin), so
  // the prompt simply never appears for those.
  const eligible =
    item.category === "Wall" && !item.masterCode.toUpperCase().endsWith("GD");
  const { data: upsell } = trpc.storefront.glassDoorUpsell.useQuery(
    { styleId, masterCode: item.masterCode, slug },
    { enabled: eligible }
  );

  const showing = glass && upsell ? upsell : item;
  const code = showing.masterCode;
  const description = translateSpec(showing.description, lang);
  // The storefront API has already calculated the affiliate's sale price from
  // protected affiliate cost + its own markup. Never markup a public platform
  // homeowner/list price in the browser.
  const price = Number(showing.homeownerPrice);
  const hasCurrentPrice = typeof price === "number" && Number.isFinite(price) && price > 0;
  const detailHref = affiliateCabinetDetailHref({ slug, masterCode: code, styleId, cabinetId: item.id });

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <Link
        href={detailHref}
        aria-label={`View details for ${code}`}
        className="group/details -m-1 mb-1 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ ['--tw-ring-color' as string]: brand.accent }}
      >
        {(item.imageUrl || item.catalogImageUrl) && (
          <div className="mb-3 aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={item.imageUrl || item.catalogImageUrl!}
              alt={item.description ?? item.masterCode}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-200 group-hover/details:scale-[1.02]"
            />
          </div>
        )}
        <div className="mb-1 flex items-start justify-between gap-2">
          <span className="font-mono text-xs font-semibold" style={{ color: brand.primary }}>
            {code}
          </span>
          {item.category && (
            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
          )}
        </div>
        <GlassPolicyBadge masterCode={code} glassIncluded={showing.glassIncluded} className="mb-1" />
        <p className="line-clamp-2 text-sm text-foreground">{description}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: brand.accent }}>
          View details <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      {/* Glass-door upsell — only when a buyable GD twin exists for this line. */}
      {upsell && (
        <button
          type="button"
          onClick={() => setGlass((g) => !g)}
          className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
          style={
            glass
              ? { backgroundColor: brand.accent, color: "#fff", borderColor: brand.accent }
              : { borderColor: "var(--border)", color: brand.accent }
          }
        >
          <Sparkles className="h-3 w-3" />
          {glass ? t(lang, "glass_upsell_add") : t(lang, "glass_upsell_q")}
        </button>
      )}

      <div className="mt-auto pt-3 space-y-2">
        {/* Promotion badge + pricing */}
        {(() => {
          const basePrice = hasCurrentPrice ? price : null;
          // Affiliate sale prices are already cost-floor protected by the
          // server. A generic platform promotion cannot replace that price.
          const promo = !slug && basePrice != null
            ? findPromo(showing, styleId, family.distributorId, promos)
            : null;
          const salePrice = promo && basePrice != null ? applyPromoPrice(basePrice, promo) : null;
          const savePct = promo && basePrice != null ? promoSavePct(basePrice, promo) : null;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              {slug && hasCurrentPrice && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Affiliate sale price</Badge>
              )}
              {salePrice != null ? (
                <>
                  <span className="font-serif text-lg font-bold text-emerald-600">{money(salePrice)}</span>
                  <span className="text-sm text-muted-foreground line-through">{money(basePrice)}</span>
                  {savePct != null && savePct > 0 && (
                    <Badge className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-600 px-1.5 py-0">
                      Save {savePct}%
                    </Badge>
                  )}
                </>
              ) : (
                hasCurrentPrice ? (
                  <span className="font-serif text-lg font-bold">{money(price)}</span>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">Price unavailable</span>
                )
              )}
            </div>
          );
        })()}

        {/* Quantity stepper + Add to Cart */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              className="px-2 py-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              onClick={() => setQtyState((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) setQtyState(v);
              }}
              className="w-10 text-center text-sm font-semibold bg-transparent border-x border-border py-1.5 focus:outline-none"
              aria-label="Quantity"
            />
            <button
              type="button"
              className="px-2 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
              onClick={() => setQtyState((q) => q + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: brand.accent }}
            disabled={!hasCurrentPrice}
            title={hasCurrentPrice ? undefined : "This item needs a vendor price before it can be added to the cart."}
            onClick={() => {
              if (!hasCurrentPrice) return;
              const unitPrice = price;
              const res = addItem({
                masterCode: code,
                name: description || code,
                styleId,
                styleLabel: publicStyleName(branding.brandName(family.styleId, family.name)),
                distributorId: family.distributorId,
                tier: "homeowner",
                unitPrice,
                qty,
                category: showing.category,
                catalogImageUrl: item.catalogImageUrl ?? null,
                glassIncluded: showing.glassIncluded ?? null,
              });
              if (res.ok) {
                if (slug) setStorefrontSlug(slug);
                toast.success(lang === "es" ? `Añadido: ${qty} × ${code}` : `Added ${qty} × ${code} to cart`);
                setQtyState(1);
              } else {
                toast.error(
                  lang === "es"
                    ? `Tu carrito está bloqueado a ${res.lockedStyleLabel}. Vacía el carrito para cambiar de línea.`
                    : `Your cart is locked to ${res.lockedStyleLabel}. Clear your cart to switch lines.`
                );
              }
            }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {hasCurrentPrice ? t(lang, "btn_add_to_cart") : "Price unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Family-locked recommender ────────────────────────────────────────────────
function Recommender({
  family,
  brand,
  lang,
  branding,
  slug,
}: {
  family: LockedFamily;
  brand: Brand;
  lang: Lang;
  branding: StorefrontBranding;
  slug?: string;
}) {
  const [intent, setIntent] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { data, isFetching } = trpc.storefront.recommendForIntent.useQuery(
    { styleId: family.styleId, intent: submitted ?? "", limit: 6, slug },
    { enabled: !!submitted }
  );

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: brand.accent }} />
        <h3 className="font-serif text-lg font-bold">{t(lang, "rec_title")}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t(lang, "rec_sub")}</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(intent.trim());
        }}
      >
        <Input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={t(lang, "rec_placeholder")}
        />
        <Button
          type="submit"
          className="font-semibold text-white"
          style={{ backgroundColor: brand.primary }}
          disabled={!intent.trim()}
        >
          {t(lang, "rec_btn")}
        </Button>
      </form>

      {submitted && (
        <div className="mt-4">
          {isFetching ? (
            <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
          ) : !data || data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(lang, "rec_empty")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(data.items as Array<{ id: number; masterCode: string; description: string | null; category?: string | null; homeownerPrice: unknown }>).map((it) => (
                <div key={it.id} className="rounded-lg border border-border bg-card p-3">
                  <span className="font-mono text-xs font-semibold" style={{ color: brand.primary }}>
                    {it.masterCode}
                  </span>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{translateSpec(it.description, lang)}</p>
                  <div className="mt-1 text-sm font-bold">{money(it.homeownerPrice)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Door Detail Modal ────────────────────────────────────────────────────────
type DoorDetailFamily = {
  name: string;
  doorStyle?: string | null;
  woodSpecies?: string | null;
  finish?: string | null;
  color?: string | null;
  boxConstruction?: string | null;
  drawerConstruction?: string | null;
  hardware?: string | null;
  frameSize?: string | null;
  overlayType?: string | null;
  doorPanelType?: string | null;
  doorSampleImageUrl?: string | null;
  styleCode?: string | null;
};

export function DoorDetailModal({
  family,
  brand,
  lang,
  open,
  onClose,
}: {
  family: DoorDetailFamily;
  brand: Brand;
  lang: Lang;
  open: boolean;
  onClose: () => void;
}) {
  const specs: Array<{ label: string; value: string | null | undefined }> = [
    { label: lang === "es" ? "Estilo de Puerta" : lang === "zh" ? "门板样式" : "Door Style", value: family.doorStyle },
    { label: lang === "es" ? "Especie de Madera" : lang === "zh" ? "木材种类" : "Wood Species", value: family.woodSpecies },
    { label: lang === "es" ? "Acabado" : lang === "zh" ? "饰面" : "Finish", value: family.finish },
    { label: lang === "es" ? "Color" : lang === "zh" ? "颜色" : "Color", value: family.color },
    { label: lang === "es" ? "Construcción de Caja" : lang === "zh" ? "箱体结构" : "Box Construction", value: family.boxConstruction },
    { label: lang === "es" ? "Construcción de Cajón" : lang === "zh" ? "抽屉结构" : "Drawer Construction", value: family.drawerConstruction },
    { label: lang === "es" ? "Herrajes" : lang === "zh" ? "五金件" : "Hardware", value: family.hardware },
    { label: lang === "es" ? "Tamaño de Marco" : lang === "zh" ? "框架尺寸" : "Frame Size", value: family.frameSize },
    { label: lang === "es" ? "Tipo de Overlay" : lang === "zh" ? "覆盖类型" : "Overlay Type", value: family.overlayType },
    { label: lang === "es" ? "Tipo de Panel" : lang === "zh" ? "门板类型" : "Door Panel Type", value: family.doorPanelType },
  ].filter((s) => s.value);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{publicStyleName(family.name)}</DialogTitle>
        </DialogHeader>

        {/* Door sample image */}
        <div className="relative overflow-hidden rounded-xl bg-muted aspect-[4/3]">
          {family.doorSampleImageUrl ? (
            <img
              src={family.doorSampleImageUrl}
              alt={`${publicStyleName(family.name)} door sample`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">No door sample photo yet</div>
          )}
          {family.doorStyle && (
            <Badge
              className="absolute left-3 top-3 border-0 text-white shadow-sm"
              style={{ backgroundColor: brand.primary }}
            >
              {family.doorStyle}
            </Badge>
          )}
        </div>

        {/* Construction specs grid */}
        {specs.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {specs.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </span>
                <span className="text-sm font-medium text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {specs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === "es" ? "Detalles de construcción próximamente." : lang === "zh" ? "建造细节即将推出。" : "Construction details coming soon."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
