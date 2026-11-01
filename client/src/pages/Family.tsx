import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Package, Search, X, Expand, Minus, Plus, ShoppingCart, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CabinetImage } from "@/components/CabinetImage";
import { CatalogSkuImage } from "@/components/CatalogSkuImage";
import { DoorStyleSwatch } from "@/components/DoorStyleSwatch";
import { realImageUrl } from "@/lib/doorFamilyPhotos";
import { finishColors } from "@/lib/design";
import { type CabinetLike, cabinetTypeLabel } from "@/lib/cabinetGraphics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import { translateSpec } from "@/lib/i18n/specPhrases";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { familyTypeMatches } from "@/lib/familyCategoryFilters";
import { searchCatalogItems } from "@shared/catalogCodeSearch";
import { isCatalogFreeShippingFlag } from "@shared/freeShippingItem";
import {
  resolveStorefrontTier,
  resolveTierPrice,
  tierLabel,
  type PricingTier,
} from "@shared/pricingTier";
import { affiliateCabinetDetailHref } from "@/lib/affiliateCabinetDetailRoute";
import {
  affiliateDesignPath,
  affiliateFamilyPath,
  affiliateQuotePath,
  affiliateStylesPath,
} from "@/lib/affiliateBrowse";

// ─────────────────────────────────────────────────────────────────────────────
// Family page — the DOOR-STYLE-FAMILY-first shopping experience.
//
// A door style (e.g. "Silver Shaker" / Hickory) IS the product line. Landing
// here shows the family's room scene + sample door + facts, then EVERY cabinet
// available in that family (base, wall, tall, vanity, accessory) together,
// filterable by type. Each cabinet is drawn to scale and recolored to this
// family's real finish so the picture always matches the actual item.
// ─────────────────────────────────────────────────────────────────────────────

interface FamilyStyle {
  id: number;
  styleCode: string;
  ourName: string | null;
  featuredLabel?: string | null;
  doorStyle: string | null;
  woodSpecies: string | null;
  color: string | null;
  finish: string | null;
  roomSceneImageUrl: string | null;
  doorSampleImageUrl: string | null;
}

interface FamilyItem extends CabinetLike {
  cabinetId: number;
  masterCode: string;
  replacementMasterCode?: string | null;
  aliases?: readonly string[] | string | null;
  sku?: string | null;
  vendorSku?: string | null;
  altSku1?: string | null;
  altSku2?: string | null;
  altSku3?: string | null;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  skuImageUrl?: string | null;
  // Pricing + supply line for on-card price + add-to-cart
  listPrice?: string | null;
  adjustedListPrice?: string | null;
  wholesalePrice?: string | null;
  contractorPrice?: string | null;
  homeownerPrice?: string | null;
  distributorId?: number | null;
  freeShipping?: boolean | number | null;
}

function fmtPrice(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// Group the DB categories into the buyer-facing room-section filters.
// Matching is case-insensitive and accepts both Molding and Moulding.
const TYPE_FILTERS = [
  { key: "all", labelKey: "fam_f_all" },
  { key: "base", labelKey: "fam_f_base" },
  { key: "wall", labelKey: "fam_f_wall" },
  { key: "tall", labelKey: "fam_f_tall" },
  { key: "vanity", labelKey: "fam_f_vanity" },
  { key: "ada", labelKey: "fam_f_ada" },
  { key: "accessory", labelKey: "fam_f_accessory" },
] as const;

function FamilyCabinetCard({
  item,
  finish,
  styleId,
  styleLabel,
  tier,
  detailHref,
}: {
  item: FamilyItem;
  finish: string;
  styleId: number;
  styleLabel: string;
  tier: PricingTier;
  detailHref: string;
}) {
  const { lang } = useLanguage();
  const { addItem, lockedDistributorId, lockedStyleLabel } = useCart();
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const unitPrice = resolveTierPrice(tier, {
    listPrice: item.listPrice,
    adjustedListPrice: item.adjustedListPrice,
    wholesalePrice: item.wholesalePrice,
    contractorPrice: item.contractorPrice,
    homeownerPrice: item.homeownerPrice,
  });
  const sourceListPrice = item.listPrice == null ? null : Number(item.listPrice);
  const showsSourceListPrice =
    unitPrice != null &&
    sourceListPrice != null &&
    Number.isFinite(sourceListPrice) &&
    Math.abs(sourceListPrice - unitPrice) > 0.004;

  function handleAdd() {
    const res = addItem({
      masterCode: item.masterCode,
      name: translateSpec(item.description, lang) || item.masterCode,
      styleId,
      styleLabel,
      distributorId: item.distributorId ?? null,
      tier,
      unitPrice,
      qty,
      ...(isCatalogFreeShippingFlag(item.freeShipping) ? { freeShipping: true } : {}),
    });
    if (!res.ok && res.reason === "distributor_locked") {
      toast.error(
        lang === "es"
          ? `Tu carrito ya tiene artículos de “${res.lockedStyleLabel}”. Para evitar cargos de envío extra, todos los artículos deben venir de la misma línea.`
          : `Your cart already has items from “${res.lockedStyleLabel}.” To avoid extra shipping, every item must come from the same supply line.`,
      );
      return;
    }
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
    toast.success(
      lang === "es"
        ? `Añadido: ${qty} × ${item.masterCode}`
        : `Added ${qty} × ${item.masterCode} to cart`,
    );
  }

  // A friendly note when this card is from a different supply line than the
  // one the cart is already locked to (add is blocked to protect freight).
  const blockedByLock =
    lockedDistributorId != null &&
    item.distributorId != null &&
    item.distributorId !== lockedDistributorId;

  return (
    <div className="cabinet-card group rounded-xl border border-border bg-card hover:border-primary/40 overflow-hidden transition-colors flex flex-col">
      {/* Image + specs link through to the detail page */}
      <Link href={detailHref} className="block">
        <div className="relative h-44 bg-gradient-to-b from-white to-muted/30 flex items-center justify-center border-b border-border p-3 cursor-pointer">
          {item.skuImageUrl ? (
            <CatalogSkuImage
              src={item.skuImageUrl}
              alt={item.description ?? item.masterCode}
              cabinet={item}
              finishColor={finish}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <CabinetImage
              cabinet={item}
              finishColor={finish}
              className="h-full w-auto max-w-full transition-transform duration-300 group-hover:scale-[1.04]"
            />
          )}
        </div>

        <div className="p-4 pb-2 cursor-pointer">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {item.masterCode}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {isCatalogFreeShippingFlag(item.freeShipping) && (
                <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">Free shipping</Badge>
              )}
              <Badge variant="secondary" className="text-xs shrink-0">
                {cabinetTypeLabel(item)}
              </Badge>
            </span>
          </div>

          <p className="text-sm font-medium text-foreground mt-2 leading-snug line-clamp-2">
            {translateSpec(item.description, lang)}
          </p>

          {(item.width || item.height || item.depth) && (
            <p className="text-xs text-muted-foreground mt-2">
              {[
                item.width && `W: ${item.width}"`,
                item.height && `H: ${item.height}"`,
                item.depth && `D: ${item.depth}"`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </Link>

      {/* Price + quantity + add-to-cart (NOT inside the Link) */}
      <div className="mt-auto px-4 pb-4">
        <div className="flex items-end justify-between gap-2 mb-2">
          <div>
            {unitPrice != null ? (
              <>
                <span className="text-lg font-bold text-foreground">{fmtPrice(unitPrice)}</span>
                <span className="ml-1 text-[11px] text-muted-foreground">/ ea</span>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {tierLabel(tier)}
                </div>
                {showsSourceListPrice && (
                  <div className="text-[10px] text-muted-foreground">
                    {lang === "es" ? "Precio de lista:" : "List price:"} {fmtPrice(sourceListPrice)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">
                  {lang === "es" ? "Cotización requerida" : "Quote required"}
                </span>
                <span className="block">
                  {lang === "es" ? "Pida a su equipo la disponibilidad y el precio." : "Ask your CabinetDealz team for current availability and pricing."}
                </span>
              </div>
            )}
          </div>

          {/* Quantity stepper */}
          {unitPrice != null && (
            <div className="flex items-center rounded-md border border-border">
              <button
                type="button"
                aria-label={lang === "es" ? "Disminuir cantidad" : "Decrease quantity"}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  setQty(Number.isFinite(n) && n >= 1 ? n : 1);
                }}
                className="h-8 w-10 border-x border-border bg-transparent text-center text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label={lang === "es" ? "Cantidad" : "Quantity"}
              />
              <button
                type="button"
                aria-label={lang === "es" ? "Aumentar cantidad" : "Increase quantity"}
                onClick={() => setQty((q) => q + 1)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {unitPrice != null && (
          <Button
            onClick={handleAdd}
            className="w-full bg-[var(--color-navy,#1a2b4a)] text-white"
            size="sm"
          >
            {justAdded ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-4 w-4" />
                {lang === "es" ? "Añadido" : "Added"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                {lang === "es" ? "Añadir al carrito" : "Add to cart"}
              </span>
            )}
          </Button>
        )}

        {blockedByLock && (
          <p className="mt-1.5 text-[10px] leading-tight text-amber-700">
            {lang === "es"
              ? `El carrito está bloqueado a “${lockedStyleLabel}”. Este artículo es de otra línea.`
              : `Cart is locked to “${lockedStyleLabel}.” This item is from another supply line.`}
          </p>
        )}
      </div>
    </div>
  );
}

function useAffiliateSalePrices(slug: string | undefined, styleId: number) {
  const utils = trpc.useUtils();
  const utilsRef = useRef(utils);
  utilsRef.current = utils;
  const [byCode, setByCode] = useState<Map<string, string | null>>(new Map());
  const [ready, setReady] = useState(!slug);
  useEffect(() => {
    if (!slug || !styleId) {
      setByCode(new Map());
      setReady(!slug);
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      const map = new Map<string, string | null>();
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      while (offset < total) {
        const page = await utilsRef.current.storefront.familyCatalog.fetch({
          styleId,
          slug,
          limit: 200,
          offset,
        });
        if (cancelled) return;
        for (const item of page.items) {
          if (item.masterCode) map.set(item.masterCode, item.homeownerPrice ?? null);
        }
        total = page.total;
        if (page.items.length === 0) break;
        offset += page.items.length;
      }
      if (!cancelled) {
        setByCode(map);
        setReady(true);
      }
    })().catch(() => {
      if (!cancelled) {
        setByCode(new Map());
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, styleId]);
  return { byCode, ready };
}

export default function Family({ styleCode, affiliateSlug }: { styleCode: string; affiliateSlug?: string }) {
  const { t, lang } = useLanguage();
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [heroPassed, setHeroPassed] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Track when the hero scrolls out of view so the sticky bar shows the style name.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroPassed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);


  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Resolve the family by its style code, then load its full catalog.
  const { data: style, isLoading: styleLoading } = trpc.doorStyles.byCode.useQuery({
    styleCode,
  });
  const styleId = (style as FamilyStyle | null)?.id ?? 0;

  // Track product view for vendor analytics (fires once per page load when style resolves).
  const trackView = trpc.analytics.trackView.useMutation();
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    const s = style as (FamilyStyle & { distributorId?: number | null }) | null;
    if (!s?.id || !s.distributorId) return;
    const key = `${s.id}:${styleCode}`;
    if (trackedRef.current === key) return;
    trackedRef.current = key;
    trackView.mutate({
      distributorId: s.distributorId,
      pageSlug: affiliateSlug ? `/store/${affiliateSlug}/family/${styleCode}` : `/family/${styleCode}`,
      referrer: document.referrer || undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, styleCode]);

  const { data, isLoading: platformCatalogLoading } = trpc.doorStyles.familyCatalog.useQuery(
    { styleId },
    { enabled: !!styleId },
  );
  const affiliateFamilies = trpc.storefront.families.useQuery(
    { slug: affiliateSlug },
    { enabled: Boolean(affiliateSlug), staleTime: 60_000 },
  );
  const affiliateStore = trpc.affiliates.bySlug.useQuery(
    { slug: affiliateSlug ?? "" },
    { enabled: Boolean(affiliateSlug), staleTime: 60_000 },
  );
  const salePrices = useAffiliateSalePrices(affiliateSlug, styleId);

  const platformItems = useMemo(() => (data?.items ?? []) as FamilyItem[], [data]);
  const items = useMemo(() => {
    if (!affiliateSlug) return platformItems;
    if (!salePrices.ready) return [];
    return platformItems.flatMap((item) => {
      if (!salePrices.byCode.has(item.masterCode)) return [];
      return [{
        ...item,
        homeownerPrice: salePrices.byCode.get(item.masterCode) ?? null,
        listPrice: null,
        adjustedListPrice: null,
        wholesalePrice: null,
        contractorPrice: null,
      }];
    });
  }, [affiliateSlug, platformItems, salePrices.byCode, salePrices.ready]);
  const catalogLoading = platformCatalogLoading || Boolean(affiliateSlug && styleId && !salePrices.ready);

  // The viewer's storefront tier drives which price shows on each card.
  // An affiliate family page always shows that store's sale price.
  const { user } = useAuth();
  const viewerTier: PricingTier = affiliateSlug ? "homeowner" : resolveStorefrontTier(user);

  // Color variations within the same door profile (in-place finish picker).
  const { data: siblingsData } = trpc.doorStyles.siblings.useQuery(
    { styleCode },
    { enabled: !!styleCode },
  );
  const siblings = useMemo(() => {
    const rows = (siblingsData ?? []) as FamilyStyle[];
    if (!affiliateSlug || !affiliateFamilies.data) return rows;
    const allowed = new Set(affiliateFamilies.data.map((row) => row.styleId));
    return rows.filter((sib) => allowed.has(sib.id));
  }, [affiliateFamilies.data, affiliateSlug, siblingsData]);

  // Finish color for recoloring every drawing to this family's real finish.
  const finish = useMemo(() => {
    const s = style as FamilyStyle | null;
    const fc = finishColors(s?.color || s?.ourName || s?.styleCode);
    return fc.face;
  }, [style]);

  // Only show type-filter chips that actually have items in this family.
  const availableTypes = useMemo(() => {
    return TYPE_FILTERS.filter((f) => f.key === "all" || items.some((item) => familyTypeMatches(f.key, item.category, item.subCategory, item.masterCode)));
  }, [items]);

  const visible = useMemo(() => {
    const f = TYPE_FILTERS.find((t) => t.key === activeType) ?? TYPE_FILTERS[0];
    const typed = items.filter((i) => familyTypeMatches(f.key, i.category, i.subCategory, i.masterCode));
    if (!debounced) return typed;
    return searchCatalogItems(typed, debounced, (item, query) => {
      const hay = `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    }).map((hit) => hit.item);
  }, [items, activeType, debounced]);

  const s = style as FamilyStyle | null;
  const affiliateFamily = useMemo(() => {
    if (!affiliateSlug || !affiliateFamilies.data) return null;
    return affiliateFamilies.data.find((row) => row.styleCode === styleCode || (styleId > 0 && row.styleId === styleId)) ?? null;
  }, [affiliateFamilies.data, affiliateSlug, styleCode, styleId]);
  // Prefer the affiliate line name, then the white-label name, over the internal name.
  const familyName = affiliateFamily?.name || s?.featuredLabel || s?.ourName || s?.styleCode || "Door Style";
  useSeo({
    title: t("seo_family_t", { name: familyName }),
    description: t("seo_family_d", { name: familyName }),
    image: affiliateFamily?.roomSceneImageUrl || (s as FamilyStyle | null)?.roomSceneImageUrl || undefined,
    lang,
    siteName: affiliateStore.data?.storeName || undefined,
    appendSiteName: !affiliateSlug || Boolean(affiliateStore.data?.storeName),
    skip: Boolean(affiliateSlug) && !affiliateStore.data?.storeName,
  });
  // STRICT ONE-FAMILY-ONE-COLOR: a family shows ONLY its own verified photo.
  // There is NO keyword/bucket fallback — we never borrow another family's
  // scene. When a family has no real photo yet, `realScene` stays null and the
  // header renders a clean color-accurate door panel (in this family's exact
  // finish) instead of a stock kitchen.
  const realScene = realImageUrl(affiliateFamily?.roomSceneImageUrl || s?.roomSceneImageUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const realDoor = realImageUrl(affiliateFamily?.doorSampleImageUrl || s?.doorSampleImageUrl);
  const stylesHref = affiliateStylesPath(affiliateSlug);
  const affiliateMissing = Boolean(affiliateSlug) && !affiliateFamilies.isLoading && !affiliateFamily;

  if (styleLoading || (affiliateSlug && affiliateFamilies.isLoading)) {
    return (
      <div className="container py-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-64 w-full rounded-2xl mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!s || affiliateMissing) {
    return (
      <div className="container py-16 text-center">
        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
        <h2 className="font-serif text-2xl font-bold mb-2">{t("fam_not_found_title")}</h2>
        <p className="text-muted-foreground mb-4">
          {t("fam_not_found_body", { code: styleCode })}
        </p>
        <Link
          href={stylesHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("fam_browse_all")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Link
        href={stylesHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("fam_back")}
      </Link>

      {/* ── Family header: room scene + sample door + the facts ───────────────── */}
      <div ref={heroRef} className="relative overflow-hidden rounded-2xl border border-border mb-8">
        {realScene ? (
          <img
            src={realScene}
            alt={`${familyName} kitchen room scene`}
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          // No verified photo for this family yet — fill the backdrop with this
          // family's EXACT finish color (never another family's kitchen).
          <div
            className="absolute inset-0"
            style={{ backgroundColor: finish }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-navy)]/92 via-[var(--color-navy)]/75 to-transparent" />
        <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-6 p-6 md:p-10 items-center">
          <div className="max-w-xl">
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2">
              {t("fam_collection")}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mb-3">
              {familyName}
            </h1>
            <p className="text-white/85 text-sm md:text-base mb-5">
              {t("fam_intro", { name: familyName })}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              {s.doorStyle && (
                <p className="text-white/90">
                  <span className="text-white/60">{t("fam_door")}</span> {s.doorStyle}
                </p>
              )}
              {s.woodSpecies && (
                <p className="text-white/90">
                  <span className="text-white/60">{t("fam_wood")}</span> {s.woodSpecies}
                </p>
              )}
              {s.finish && (
                <p className="text-white/90">
                  <span className="text-white/60">{t("fam_finish")}</span> {s.finish}
                </p>
              )}
              {s.color && (
                <p className="text-white/90">
                  <span className="text-white/60">{t("fam_color")}</span> {s.color}
                </p>
              )}
            </div>

            {/* ── Design with this style CTA ─────────────────────────────── */}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={affiliateDesignPath(affiliateSlug, styleId)}
                title="Open the 3D Designer with this door style pre-selected — arrange cabinets, see prices, and export your layout."
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-[var(--color-navy)] font-semibold text-sm px-5 py-2.5 transition-all shadow-md hover:shadow-lg"
              >
                <Pencil className="h-4 w-4" />
                Design with this style
              </Link>
              <Link
                href={affiliateQuotePath(affiliateSlug, styleId)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-2.5 transition-all"
              >
                <ShoppingCart className="h-4 w-4" />
                Request a quote
              </Link>
            </div>

            {/* In-place finish picker: switch the color within this door profile
                without leaving the family. Current color is highlighted. */}
            {siblings.length > 1 && (
              <div className="mt-6">
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2">
                  {t("fam_choose_finish")}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {siblings.map((sib) => {
                    const isCurrent = sib.id === s.id;
                    const sc = finishColors(sib.color || sib.ourName || sib.styleCode);
                    const label = sib.color || sib.ourName || sib.styleCode;
                    return (
                      <Link
                        key={sib.id}
                        href={affiliateFamilyPath(affiliateSlug, sib.styleCode)}
                        title={label}
                        aria-label={`View ${label} finish`}
                        className={`group/sw relative flex flex-col items-center gap-1 outline-none`}
                      >
                        <span
                          className={`block h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-[var(--color-navy)] transition-transform duration-150 group-hover/sw:scale-110 ${
                            isCurrent
                              ? "ring-[var(--color-gold)]"
                              : "ring-white/30 group-hover/sw:ring-white/70"
                          }`}
                          style={{ backgroundColor: sc.face }}
                        />
                        <span
                          className={`max-w-[4.5rem] truncate text-[10px] leading-tight text-center ${
                            isCurrent ? "text-white font-semibold" : "text-white/60"
                          }`}
                        >
                          {label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Mobile: door swatch + room scene side by side */}
          <div className="md:hidden mt-4 flex gap-2">
            {/* Door swatch */}
            <div className="flex-1 rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-white/40 flex flex-col items-center">
              {realDoor ? (
                <img
                  src={realDoor}
                  alt={`${familyName} door sample`}
                  className="h-24 w-full rounded object-cover ring-1 ring-border"
                  decoding="async"
                />
              ) : (
                <DoorStyleSwatch style={s} className="h-24 w-full" />
              )}
              <p className="text-[10px] text-muted-foreground mt-1 text-center truncate w-full">
                {t("fam_door_finish")}
              </p>
            </div>
            {/* Room scene */}
            <div className="flex-1 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/40 flex flex-col">
              {realScene ? (
                <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
                  <img
                    src={realScene}
                    alt={`${familyName} kitchen room scene`}
                    className="h-24 w-full object-cover"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Expand className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 drop-shadow" />
                  </div>
                </div>
              ) : (
                <div
                  className="h-24 w-full flex items-center justify-center text-[10px] text-white/60"
                  style={{ backgroundColor: finish }}
                >
                  Room scene coming soon
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 text-center bg-white/95 py-0.5">
                Room Scene
              </p>
            </div>
          </div>

          {/* Desktop: door swatch + room scene side by side */}
          <div className="hidden md:flex items-center justify-center gap-3">
            {/* Door swatch card */}
            <div className="rounded-xl bg-white/95 p-4 shadow-xl ring-1 ring-white/40 flex flex-col items-center">
              {realDoor ? (
                <img
                  src={realDoor}
                  alt={`${familyName} door sample`}
                  className="h-44 w-44 rounded-lg object-cover ring-1 ring-border"
                  width={176}
                  height={176}
                  decoding="async"
                />
              ) : (
                <DoorStyleSwatch style={s} className="h-44 w-auto" />
              )}
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                {familyName} {t("fam_door_finish")}
              </p>
            </div>
            {/* Room scene card */}
            <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-white/40 flex flex-col">
              {realScene ? (
                <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
                  <img
                    src={realScene}
                    alt={`${familyName} kitchen room scene`}
                    className="h-44 w-44 object-cover"
                    width={176}
                    height={176}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Expand className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 drop-shadow" />
                  </div>
                </div>
              ) : (
                <div
                  className="h-44 w-44 flex items-center justify-center text-[11px] text-white/60"
                  style={{ backgroundColor: finish }}
                >
                  Room scene coming soon
                </div>
              )}
              <p className="text-center text-[11px] text-muted-foreground bg-white/95 py-2">
                {familyName} kitchen
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lightbox (portal to body so no parent clip/transform can block it) ── */}
      {lightboxOpen && realScene && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={realScene}
            alt={`${familyName} kitchen room scene`}
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {familyName} kitchen
          </p>
        </div>,
        document.body
      )}

      {/* ── Type filter + search ──────────────────────────────────────────────── */}
      {/* Sticky filter bar — bleeds to viewport edge, stays below TopNav (top-16 = 64px) */}
      <div
        ref={filterBarRef}
        className="sticky z-40 -mx-4 px-4 md:-mx-6 md:px-6 mb-6"
        style={{
          top: 64,
          background: heroPassed ? "hsl(var(--background) / 0.97)" : "transparent",
          backdropFilter: heroPassed ? "blur(8px)" : "none",
          WebkitBackdropFilter: heroPassed ? "blur(8px)" : "none",
          boxShadow: heroPassed ? "0 1px 0 hsl(var(--border))" : "none",
          paddingTop: heroPassed ? 8 : 0,
          paddingBottom: heroPassed ? 8 : 0,
          transition: "background 150ms, box-shadow 150ms, padding 150ms",
        }}
      >
        {/* Style pill — always visible so the shopper always knows which door
            style family they are browsing. Clicking scrolls back to the hero. */}
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={stylesHref}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 shadow-sm hover:bg-muted/60 transition-colors"
            title="Change line"
          >
            {realDoor && (
              <img
                src={realDoor}
                alt={familyName}
                className="h-6 w-6 rounded object-cover ring-1 ring-border shrink-0"
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
              />
            )}
            <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{familyName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>
        </div>
        {/* Filter pills + inline search on one row */}
        <div className="flex flex-wrap items-center gap-2">
          {availableTypes.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveType(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeType === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(f.labelKey as never)}
            </button>
          ))}
          {/* Search input — pushed to the right on wider screens */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("fam_search_ph", { name: familyName })}
              className="pl-9 h-9 text-sm w-40 md:w-52"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Cabinet grid ──────────────────────────────────────────────────────── */}
      {catalogLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <Skeleton className="h-44 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("fam_no_match_title")}</p>
          <p className="text-sm mt-1">{t("fam_no_match_body")}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {t("fam_showing_label", { name: familyName })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((item) => (
              <FamilyCabinetCard
                key={item.cabinetId}
                item={item}
                finish={finish}
                styleId={s.id}
                styleLabel={familyName}
                tier={viewerTier}
                detailHref={affiliateCabinetDetailHref({
                  slug: affiliateSlug,
                  masterCode: item.masterCode,
                  styleId: s.id,
                  cabinetId: item.cabinetId,
                })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
