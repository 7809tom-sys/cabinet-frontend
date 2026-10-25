import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  PELICAN_STOREFRONT_CATEGORIES,
  CATEGORY_GRADIENT,
  formatPrice,
  type PelicanCategory,
} from "@/lib/pelican";
import {
  BATHROOM_FIXTURE_RECOMMENDED_SECTIONS,
  BATHROOM_SURFACE_RECOMMENDED_SECTIONS,
  type BathroomPaletteMode,
  type RecommendedRole,
} from "./RecommendedSurfaces";
import {
  hasVerifiedPelicanFixtureProfile,
  verifiedPelicanFaucetProfile,
  verifiedPelicanPotFillerProfile,
  verifiedPelicanSinkProfile,
} from "@/lib/pelicanFixtureProfiles";
import { pelicanBathroomFixturePlacementText, verifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";
import { Search, Plus, Check, FileText, Waves } from "lucide-react";
import { usePreferredProducts } from "@/contexts/PreferredProductsContext";
import {
  groupPelicanConfigurations,
  pelicanConfigurationStyles,
  pelicanDisplayVariant,
  pelicanSelectedSiblings,
  pelicanUseLabel,
  type PelicanConfiguration,
} from "@shared/pelicanConfigurationGrouping";
import { PelicanVariantSelect } from "./PelicanVariantSelect";
import type { CountertopScope } from "@/lib/surfaceSelection";

export type SelectedSurface = {
  id: number;
  /** Authoritative Pelican item code; retained for verified fixture-profile matching. */
  pelicanCode?: string | null;
  slug: string;
  name: string;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  /** Optional approved material-only image for the 3D scene. */
  materialImageUrl?: string | null;
  /** Explicit product used to dress this role in the 3D scene; other selections stay in the quote. */
  threeDActive?: boolean;
  sellPrice: number | null;
  /** Wall-run versus island countertop assignment. Undefined is the legacy whole-design behavior. */
  countertopScope?: CountertopScope;
  /** Sq ft per box/carton — when set, BOM auto-calculates box qty from area + overage. */
  coverageSqFt?: number | null;
  /** Supplier/fabricator-verified maximum unsupported overhang for this exact material. */
  unsupportedOverhangLimitIn?: number | null;
};

// The server applies the verified-only readiness gate before pagination. Keep
// the full palette at the server's safe maximum so verified sink/faucet choices
// are not silently hidden below a legacy first-page cap.
const PAGE_LIMIT = 200;

export type CountertopSwatchFilter = "all" | "swatch-ready" | "swatch-pending";
export type BathroomFixtureFinishFilter = "all" | "white" | "matte-black" | "chrome" | "brushed-nickel" | "brushed-gold" | "other";
export type BathroomFixtureSizeFilter = "all" | "up-to-24" | "25-to-36" | "37-plus" | "tub-59" | "tub-67";

export const BATHROOM_FIXTURE_FINISH_CHIPS: Array<{
  value: BathroomFixtureFinishFilter;
  label: string;
  swatch: string;
}> = [
  { value: "all", label: "All", swatch: "linear-gradient(135deg,#f8fafc 0 48%,#1f2937 49% 100%)" },
  { value: "white", label: "White", swatch: "#f8fafc" },
  { value: "matte-black", label: "Matte black", swatch: "#24272a" },
  { value: "chrome", label: "Chrome", swatch: "linear-gradient(135deg,#b9c2c9,#f8fafc,#87929b)" },
  { value: "brushed-nickel", label: "Brushed nickel", swatch: "linear-gradient(135deg,#9ca3af,#e5e7eb,#6b7280)" },
  { value: "brushed-gold", label: "Brushed gold", swatch: "linear-gradient(135deg,#8d6b27,#e0b85c,#9b742b)" },
  { value: "other", label: "Other", swatch: "#cbd5e1" },
];

export function bathroomFixtureFinishFilter(item: Pick<SelectedSurface, "name" | "pelicanCode" | "size">): Exclude<BathroomFixtureFinishFilter, "all"> {
  const text = `${item.name} ${item.pelicanCode ?? ""} ${item.size ?? ""}`.toLowerCase();
  // Pelican's active catalog often expresses a finish in the SKU suffix rather
  // than the product title. Decode only the documented tokens, alongside their
  // written forms, so a filter never guesses a finish from a product photo.
  if (/matte black|gloss black|\bblack\b|\bmb\b/.test(text)) return "matte-black";
  if (/brushed nickel|\bbn\b/.test(text)) return "brushed-nickel";
  if (/brushed gold|\bgold\b|\bbg\b/.test(text)) return "brushed-gold";
  if (/chrome|\bchr\b/.test(text)) return "chrome";
  if (/white|porcelain|vitreous|toilet|bidet|acrylic/.test(text)) return "white";
  return "other";
}

export function bathroomFixtureWidthIn(item: Pick<SelectedSurface, "size" | "pelicanCode">): number | null {
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode);
  if (profile) return profile.widthIn;
  const raw = item.size ?? "";
  const match = raw.match(/(\d+(?:\.\d+)?)(?:\s*[- ]\s*(\d+)\s*\/\s*(\d+))?/);
  if (!match) return null;
  const whole = Number(match[1]);
  const numerator = Number(match[2] ?? 0);
  const denominator = Number(match[3] ?? 1);
  const parsed = whole + (denominator > 0 ? numerator / denominator : 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function filterBathroomFixtureItems(
  items: SelectedSurface[],
  finish: BathroomFixtureFinishFilter,
  size: BathroomFixtureSizeFilter,
) {
  return items.filter((item) => {
    const finishMatch = finish === "all" || bathroomFixtureFinishFilter(item) === finish;
    const width = bathroomFixtureWidthIn(item);
    const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode);
    const sizeMatch = size === "tub-59" || size === "tub-67"
      ? Boolean(profile && (profile.kind === "freestanding-tub" || profile.kind === "alcove-tub") && Math.round(profile.depthIn) === (size === "tub-59" ? 59 : 67))
      : size === "all" || width == null || (
      size === "up-to-24" ? width <= 24 : size === "25-to-36" ? width > 24 && width <= 36 : width >= 37
    );
    return finishMatch && sizeMatch;
  });
}

/** Keeps the countertop menu source-complete while allowing a quick preview-readiness view. */
export function matchesCountertopSwatchFilter(
  item: Pick<SelectedSurface, "category" | "materialImageUrl">,
  filter: CountertopSwatchFilter,
): boolean {
  if (item.category !== "Quartz Slabs (Countertops)" || filter === "all") return true;
  const swatchReady = Boolean(item.materialImageUrl?.trim());
  return filter === "swatch-ready" ? swatchReady : !swatchReady;
}

/**
 * Exposes a specification sheet only when this exact visible Pelican variant
 * resolves through an existing verified fixture profile. Catalog product pages
 * and shopper imagery deliberately do not qualify as technical sheets.
 */
export function verifiedSurfaceSpecificationUrl(item: Pick<SelectedSurface, "pelicanCode">): string | null {
  return verifiedPelicanSinkProfile(item.pelicanCode)?.specificationUrl
    ?? verifiedPelicanFaucetProfile(item.pelicanCode)?.specificationUrl
    ?? verifiedPelicanPotFillerProfile(item.pelicanCode)?.specificationUrl
    ?? verifiedPelicanBathroomFixtureProfile(item.pelicanCode)?.specificationUrl
    ?? null;
}

export function SurfacesPickerDialog({
  open,
  onOpenChange,
  selected,
  onToggle,
  estimatedSubtotal,
  countertopPriceLines = [],
  backsplashHeightMode = "standard",
  onBacksplashHeightModeChange,
  countertopBacksplashHeightIn = 0,
  onCountertopBacksplashHeightChange,
  activeThreeDBacksplashId = null,
  onSetActiveThreeDBacksplash,
  backsplashEnabled = true,
  onBacksplashEnabledChange,
  roomType = "kitchen",
  onPlaceBathroomFixture,
  bathroomPaletteMode = "fixtures",
  initialBathroomRole,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: SelectedSurface[];
  onToggle: (item: SelectedSurface) => void;
  /** Measured cart subtotal for selected surfaces, including area-based quantities. */
  estimatedSubtotal?: number | null;
  /** Price-locked countertop lines measured from the live rendered cabinet footprint. */
  countertopPriceLines?: Array<{
    name: string;
    qty: number;
    unitPrice: number | null;
    qtyNote?: string;
  }>;
  backsplashHeightMode?: "standard" | "full-height";
  onBacksplashHeightModeChange?: (mode: "standard" | "full-height") => void;
  countertopBacksplashHeightIn?: 0 | 2.5 | 3;
  onCountertopBacksplashHeightChange?: (height: 0 | 2.5 | 3) => void;
  /** The one selected tile/mosaic product currently dressing 3D wall segments. */
  activeThreeDBacksplashId?: number | null;
  onSetActiveThreeDBacksplash?: (item: SelectedSurface) => void;
  /** Keeps the selected wall tile available while including or excluding backsplash from this plan. */
  backsplashEnabled?: boolean;
  onBacksplashEnabledChange?: (enabled: boolean) => void;
  /** Keeps bathroom catalog choices isolated from kitchen-only fixture families. */
  roomType?: string;
  /** Places a source-measured toilet, bidet, or tub as a movable plan/3D fixture. */
  onPlaceBathroomFixture?: (item: SelectedSurface) => void;
  /** Selects either the bathroom finishes browser or the bathroom fixtures browser. */
  bathroomPaletteMode?: BathroomPaletteMode;
  /** Active family requested from a compact row or a guided checklist step. */
  initialBathroomRole?: RecommendedRole;
}) {
  const isBathroom = roomType === "bathroom";
  const [category, setCategory] = useState<PelicanCategory | "Preferred">(PELICAN_STOREFRONT_CATEGORIES[0]);
  const [bathroomRole, setBathroomRole] = useState<RecommendedRole>("bathroom-sink");
  useEffect(() => {
    if (open && isBathroom && initialBathroomRole) setBathroomRole(initialBathroomRole);
  }, [open, isBathroom, initialBathroomRole]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [countertopSwatchFilter, setCountertopSwatchFilter] = useState<CountertopSwatchFilter>("all");
  const [bathroomFinish, setBathroomFinish] = useState<BathroomFixtureFinishFilter>("all");
  const [bathroomSize, setBathroomSize] = useState<BathroomFixtureSizeFilter>("all");
  const ALL_PELICAN_STYLES = "__all_pelican_styles__";
  const [styleFilter, setStyleFilter] = useState<string>(ALL_PELICAN_STYLES);
  /** Finish / size / drain side the shopper picked on each model card (exact catalog SKU id). */
  const [chosenVariantIds, setChosenVariantIds] = useState<Record<string, number>>({});
  const { products: preferredProducts } = usePreferredProducts();
  const bathroomSections = bathroomPaletteMode === "fixtures"
    ? BATHROOM_FIXTURE_RECOMMENDED_SECTIONS
    : BATHROOM_SURFACE_RECOMMENDED_SECTIONS;
  const activeBathroomRole = bathroomSections.some((section) => section.role === bathroomRole)
    ? bathroomRole
    : bathroomSections[0]!.role;

  // A dialog may stay mounted while the user switches from a Bathroom surfaces
  // launcher to a fixtures launcher. Always select an available family rather
  // than issuing a stale query from the other tab.
  useEffect(() => {
    if (!isBathroom || bathroomSections.some((section) => section.role === bathroomRole)) return;
    setBathroomRole(bathroomSections.find((section) => section.role === initialBathroomRole)?.role ?? bathroomSections[0]!.role);
  }, [bathroomRole, bathroomSections, initialBathroomRole, isBathroom]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Which categories actually have designer-visible items
  const { data: cats } = trpc.pelican.categories.useQuery(
    { scope: "designer" },
    { enabled: open && !isBathroom }
  );
  const availableCats = useMemo(() => {
    const have = new Set((cats ?? []).map((c) => c.category));
    const list = PELICAN_STOREFRONT_CATEGORIES.filter((c) => have.has(c));
    return list.length ? list : PELICAN_STOREFRONT_CATEGORIES;
  }, [cats]);

  // Keep the active category valid as availability loads
  useEffect(() => {
    if (category !== "Preferred" && availableCats.length && !availableCats.includes(category)) {
      setCategory(availableCats[0]);
    }
  }, [availableCats, category]);

  const { data, isLoading } = trpc.pelican.byCategory.useQuery(
    {
      category: category as PelicanCategory,
      scope: "designer",
      search: debounced || undefined,
      limit: PAGE_LIMIT,
      offset: 0,
    },
    { enabled: open && !isBathroom && category !== "Preferred" }
  );
  const { data: bathroomData, isLoading: bathroomLoading } = trpc.surfaces.recommended.useQuery(
    { role: activeBathroomRole, limit: PAGE_LIMIT },
    { enabled: open && isBathroom },
  );

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const preferredIds = useMemo(
    () => preferredProducts.map((product) => product.id).filter(Number.isInteger),
    [preferredProducts],
  );
  const { data: verifiedPreferredProducts, isLoading: preferredProductsLoading } = trpc.surfaces.designerByIds.useQuery(
    { ids: preferredIds },
    { enabled: open && category === "Preferred" && preferredIds.length > 0 },
  );
  const preferredItems = useMemo(() => (verifiedPreferredProducts ?? []).map((product) => ({
      id: product.id,
      pelicanCode: product.pelicanCode,
      slug: product.slug,
      name: product.name,
      category: product.category,
      subCategory: product.subCategory,
      size: product.size,
      imageUrl: product.imageUrl,
      materialImageUrl: product.materialImageUrl,
      sellPrice: product.sellPrice,
      coverageSqFt: product.coverageSqFt ?? null,
      unsupportedOverhangLimitIn: product.unsupportedOverhangLimitIn ?? null,
    })), [verifiedPreferredProducts]);
  const items: SelectedSurface[] = (isBathroom
    ? bathroomData ?? []
    : category === "Preferred"
      ? preferredItems
      : data?.items ?? []) as SelectedSurface[];
  const paletteLoading = isBathroom ? bathroomLoading : category === "Preferred" ? preferredProductsLoading : isLoading;
  const selectedBathroomFixture = useMemo(() => {
    if (!isBathroom || bathroomPaletteMode !== "fixtures") return null;
    return selected.find((item) => Boolean(
      verifiedPelicanBathroomFixtureProfile(item.pelicanCode)
      || /faucet|tap|valve/i.test(`${item.name} ${item.category} ${item.subCategory ?? ""}`),
    )) ?? null;
  }, [bathroomPaletteMode, isBathroom, selected]);
  const selectedBacksplash = useMemo(() => {
    const backsplashSelections = selected.filter((item) => item.category === "Tile & Mosaic");
    return backsplashSelections.find((item) => item.id === activeThreeDBacksplashId)
      ?? backsplashSelections[0]
      ?? null;
  }, [activeThreeDBacksplashId, selected]);
  const visibleItems = useMemo(() => {
    const searched = isBathroom
      ? !debounced
        ? items
        : items.filter((item) => `${item.name} ${item.subCategory ?? ""} ${item.size ?? ""}`.toLowerCase().includes(debounced.toLowerCase()))
      : category !== "Preferred" || !debounced
        ? items
        : items.filter((item) => `${item.name} ${item.subCategory ?? ""} ${item.size ?? ""}`.toLowerCase().includes(debounced.toLowerCase()));
    const compatible = searched.filter((item) => {
      if (isBathroom) return true;
      if (item.category === "Sinks & Faucets") return hasVerifiedPelicanFixtureProfile(item.pelicanCode);
      const isMaterialRole = item.category === "Flooring"
        || item.category === "Tile & Mosaic"
        || item.category === "Quartz Slabs (Countertops)";
      // Active, priced Designer countertops remain selectable even when the
      // supplier has not yet supplied a repeatable material-only swatch. Their
      // card names the neutral 3D preview explicitly; catalog photography never
      // becomes a texture. Flooring and tile keep the stricter swatch rule.
      if (item.category === "Quartz Slabs (Countertops)") {
        return matchesCountertopSwatchFilter(item, countertopSwatchFilter);
      }
      return isMaterialRole && Boolean(item.materialImageUrl?.trim());
    });
    return isBathroom && bathroomPaletteMode === "fixtures"
      ? filterBathroomFixtureItems(compatible, bathroomFinish, bathroomSize)
      : compatible;
  }, [bathroomFinish, bathroomPaletteMode, bathroomSize, category, countertopSwatchFilter, debounced, isBathroom, items]);
  // One card per model. Saved favorites stay one card per exact SKU so a favorite
  // is never merged with siblings the shopper did not save.
  const allConfigurations = useMemo<PelicanConfiguration<SelectedSurface>[]>(() => (
    !isBathroom && category === "Preferred"
      ? visibleItems.flatMap((item) => groupPelicanConfigurations([item]))
      : groupPelicanConfigurations(visibleItems)
  ), [category, isBathroom, visibleItems]);
  const styleOptions = useMemo(() => pelicanConfigurationStyles(allConfigurations), [allConfigurations]);
  const activeStyle = styleOptions.includes(styleFilter) ? styleFilter : ALL_PELICAN_STYLES;
  const configurations = useMemo(
    () => activeStyle === ALL_PELICAN_STYLES ? allConfigurations : allConfigurations.filter((entry) => entry.style === activeStyle),
    [activeStyle, allConfigurations],
  );
  const countertopSwatchCounts = useMemo(() => {
    const countertops = items.filter((item) => item.category === "Quartz Slabs (Countertops)");
    const ready = countertops.filter((item) => matchesCountertopSwatchFilter(item, "swatch-ready")).length;
    return { all: countertops.length, ready, pending: countertops.length - ready };
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,860px)] max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,calc(100%-2rem))]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Waves className="h-5 w-5 text-[var(--color-gold)]" /> {isBathroom ? bathroomPaletteMode === "fixtures" ? "Bathroom Fixtures" : "Bathroom Surfaces" : "Surfaces & Fixtures"}
          </DialogTitle>
          <DialogDescription className="hidden sm:block text-xs sm:text-sm">
            {isBathroom
              ? bathroomPaletteMode === "fixtures"
                ? "Browse active, source-priced Pelican bathroom fixtures only. Source-measured toilets, bidets, and tubs can be placed and moved in Floor Plan and 3D; verified vanity basins and faucets install through a compatible vanity base."
                : "Browse active, source-priced Pelican bathroom countertops, flooring, and wall tile only. Bathroom fixtures are intentionally kept in the Fixtures tab."
              : "Add source-ready Pelican finishes and fixtures to this design. A new flooring or backsplash choice replaces the prior material everywhere in the final kitchen."}
          </DialogDescription>
        </DialogHeader>

        {/* Category tabs + search */}
        <div className="shrink-0 flex flex-col gap-2 sm:gap-3 border-b border-border px-4 py-2 sm:px-6 sm:py-3">
          <div className={isBathroom
            ? "flex flex-wrap gap-2 pb-1"
            : "flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none"}>
            {!isBathroom && preferredItems.length > 0 && (
              <Button
                size="sm"
                variant={category === "Preferred" ? "default" : "outline"}
                className="h-7 text-xs whitespace-nowrap shrink-0"
                onClick={() => setCategory("Preferred")}
              >
                Preferred ({preferredItems.length})
              </Button>
            )}
            {isBathroom ? bathroomSections.map((section) => (
              <Button
                key={section.role}
                size="sm"
                variant={section.role === activeBathroomRole ? "default" : "outline"}
                className="h-7 text-xs whitespace-nowrap shrink-0"
                onClick={() => setBathroomRole(section.role)}
              >
                {section.label}
              </Button>
            )) : availableCats.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={c === category ? "default" : "outline"}
                className="h-7 text-xs whitespace-nowrap shrink-0"
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isBathroom ? bathroomPaletteMode === "fixtures" ? "Search bathroom fixtures…" : "Search bathroom surfaces…" : category === "Preferred" ? "Search preferred products…" : `Search ${category.toLowerCase()}…`}
                className="pl-9"
              />
            </div>
            {styleOptions.length > 1 && (
              <Select value={activeStyle} onValueChange={setStyleFilter}>
                <SelectTrigger data-testid="pelican-style-filter" aria-label="Filter Pelican products by style" className="w-full sm:w-[210px]">
                  <SelectValue placeholder="All styles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PELICAN_STYLES}>All styles</SelectItem>
                  {styleOptions.map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!isBathroom && category === "Quartz Slabs (Countertops)" && (
              <Select value={countertopSwatchFilter} onValueChange={(value) => setCountertopSwatchFilter(value as CountertopSwatchFilter)}>
                <SelectTrigger data-testid="countertop-swatch-filter" aria-label="Filter countertop 3D material readiness" className="w-full sm:w-[244px]">
                  <SelectValue placeholder="Filter 3D material readiness" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countertop options ({countertopSwatchCounts.all})</SelectItem>
                  <SelectItem value="swatch-ready">3D material swatch ready ({countertopSwatchCounts.ready})</SelectItem>
                  <SelectItem value="swatch-pending">Neutral preview — swatch pending ({countertopSwatchCounts.pending})</SelectItem>
                </SelectContent>
              </Select>
            )}
            {isBathroom && bathroomPaletteMode === "fixtures" && (
              <>
                <div data-testid="bathroom-fixture-finish-filter" aria-label="Filter bathroom fixtures by finish" className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-white p-1.5">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Finish</span>
                  {BATHROOM_FIXTURE_FINISH_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={bathroomFinish === chip.value}
                      onClick={() => setBathroomFinish(chip.value)}
                      className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors ${bathroomFinish === chip.value ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-foreground ring-1 ring-[var(--color-gold)]/40" : "border-border text-muted-foreground hover:border-[var(--color-gold)]/60 hover:text-foreground"}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ background: chip.swatch }} />
                      {chip.label}
                    </button>
                  ))}
                </div>
                <Select value={bathroomSize} onValueChange={(value) => setBathroomSize(value as BathroomFixtureSizeFilter)}>
                  <SelectTrigger data-testid="bathroom-fixture-size-filter" aria-label="Filter bathroom fixtures by first listed size" className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sizes</SelectItem>
                    {activeBathroomRole === "bathtub" && <SelectItem value="tub-59">59-inch tubs</SelectItem>}
                    {activeBathroomRole === "bathtub" && <SelectItem value="tub-67">67-inch tubs</SelectItem>}
                    <SelectItem value="up-to-24">Up to 24 in.</SelectItem>
                    <SelectItem value="25-to-36">25–36 in.</SelectItem>
                    <SelectItem value="37-plus">37 in. and up</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-4">
            {/* Tall explanatory panels live inside the scroll area so a short window keeps
                the tabs and search pinned and still has room to scroll to the cards. */}
            <div data-testid="surfaces-scroll-panels" className="mb-4 flex flex-col gap-2 empty:hidden sm:gap-3">
              {!isBathroom && category === "Preferred" && (
                <p className="text-[10px] leading-relaxed text-muted-foreground">Saved favorites remain in your catalog list. This Designer view shows only favorites that are active, priced, Designer-enabled, and verified for an exact material or fixture role.</p>
              )}
              {!isBathroom && category === "Sinks & Faucets" && (
                <p className="text-[10px] leading-relaxed text-muted-foreground">Only fixtures with a source-verified 3D profile are shown here. Choose a sink and faucet through a compatible sink base to place their measured 3D models in the kitchen; adding an item here also retains it in the quote.</p>
              )}
              {((!isBathroom && category === "Tile & Mosaic") || (isBathroom && bathroomPaletteMode === "surfaces" && activeBathroomRole === "backsplash")) && (onBacksplashHeightModeChange || onCountertopBacksplashHeightChange) && (
                <div className="grid gap-2 rounded-lg border border-[#a87f33]/30 bg-[#fffaf0] p-2.5 text-xs sm:grid-cols-2">
                  {!isBathroom && onBacksplashEnabledChange && (
                    <div data-testid="backsplash-enabled-control" className="sm:col-span-2 flex flex-col gap-1.5 rounded-md border border-[#a87f33]/20 bg-white/70 p-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {selectedBacksplash ? (
                          <div
                            data-testid="backsplash-selected-swatch"
                            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-[#a87f33]/35 bg-stone-100 shadow-inner"
                            title={`Selected backsplash: ${selectedBacksplash.name}`}
                            aria-label={`Selected backsplash preview: ${selectedBacksplash.name}`}
                          >
                            {selectedBacksplash.materialImageUrl || selectedBacksplash.imageUrl ? (
                              <img
                                src={selectedBacksplash.materialImageUrl || selectedBacksplash.imageUrl || undefined}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span aria-hidden className="h-5 w-5 rounded-sm border border-stone-400/60 bg-[repeating-linear-gradient(135deg,#d6d3d1_0_3px,#f5f5f4_3px_6px)]" />
                            )}
                          </div>
                        ) : (
                          <div data-testid="backsplash-selected-swatch-empty" aria-label="No backsplash selected" className="grid h-9 w-9 shrink-0 place-items-center rounded border border-dashed border-stone-400 bg-stone-50 text-[9px] font-semibold text-stone-500">Tile</div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#60491b]">Backsplash</div>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{selectedBacksplash ? <><span className="font-medium text-foreground">{selectedBacksplash.name}</span> stays selected while Off removes it from this plan’s display and calculated surface/material amounts.</> : "Choose a wall tile to preview it here. Off removes a selected tile from this plan while keeping the choice ready to turn back on."}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5" role="group" aria-label="Backsplash option">
                        <Button type="button" size="sm" variant={backsplashEnabled ? "default" : "outline"} aria-pressed={backsplashEnabled} className="h-8 min-w-11 px-2 text-[11px]" onClick={() => onBacksplashEnabledChange(true)}>On</Button>
                        <Button type="button" size="sm" variant={!backsplashEnabled ? "default" : "outline"} aria-pressed={!backsplashEnabled} className="h-8 min-w-11 px-2 text-[11px]" onClick={() => onBacksplashEnabledChange(false)}>Off</Button>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#60491b]">Wall tile coverage</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant={backsplashHeightMode === "standard" ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => onBacksplashHeightModeChange?.("standard")}>Standard to uppers</Button>
                      <Button type="button" size="sm" variant={backsplashHeightMode === "full-height" ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => onBacksplashHeightModeChange?.("full-height")}>Full height to ceiling</Button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#60491b]">Countertop rear upstand</div>
                    <div className="flex flex-wrap gap-1.5">
                      {([0, 2.5, 3] as const).map((height) => (
                        <Button key={height} type="button" size="sm" variant={countertopBacksplashHeightIn === height ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => onCountertopBacksplashHeightChange?.(height)}>
                          {height === 0 ? "None" : `${height}\" upstand`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="sm:col-span-2 text-[10px] leading-relaxed text-muted-foreground">12-inch wall tile is continuous only above countertop-supported cabinet and appliance runs. Standard ends at upper cabinets; a range continues to its hood. Full-height coverage increases material quantity and price.</p>
                </div>
              )}
              {((!isBathroom && category === "Quartz Slabs (Countertops)") || (isBathroom && bathroomPaletteMode === "surfaces" && activeBathroomRole === "countertop")) && countertopPriceLines.length > 0 && (
                <div data-testid="countertop-priced-coverage" className="rounded-lg border border-[#a87f33]/30 bg-[#fffaf0] p-2.5 text-xs">
                  <div className="mb-1 font-semibold text-[#60491b]">Measured countertop pricing</div>
                  <div className="space-y-1 text-muted-foreground">
                    {countertopPriceLines.map((line) => (
                      <p key={`${line.name}:${line.qty}:${line.unitPrice ?? "pending"}`}>
                        <span className="font-medium text-foreground">{line.name}</span>
                        {line.qtyNote ? ` — ${line.qtyNote}` : ` — ${line.qty} ${line.qty === 1 ? "slab" : "slabs"}`}
                        {line.unitPrice != null ? ` · ${formatPrice(line.unitPrice * line.qty)}` : " · pricing pending"}
                      </p>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">The bar extension across a drywall pony wall is included in this measured coverage. Supplier pricing is per whole slab, so the total changes when that added coverage requires another slab.</p>
                </div>
              )}
              {((!isBathroom && category === "Quartz Slabs (Countertops)") || (isBathroom && bathroomPaletteMode === "surfaces" && activeBathroomRole === "countertop")) && (
                <p data-testid="countertop-selection-availability" className="text-[10px] leading-relaxed text-muted-foreground">All active, source-priced countertop products are available to select and quote. A product without an approved repeatable slab swatch remains accurately priced and is shown in 3D with the labeled neutral preview until its material swatch is supplied.</p>
              )}
              {isBathroom && bathroomPaletteMode === "fixtures" && selectedBathroomFixture && (
                <section data-testid="selected-bathroom-fixture-preview" aria-label="Selected bathroom fixture preview" className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--color-gold)]/45 bg-[#fffaf0] p-2.5">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[var(--color-gold)]/25 bg-white">
                    {selectedBathroomFixture.imageUrl ? (
                      <img src={selectedBathroomFixture.imageUrl} alt={`${selectedBathroomFixture.name} selected preview`} className="h-full w-full object-contain" />
                    ) : (
                      <Waves className="h-6 w-6 text-[var(--color-gold)]" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-foreground">Selected fixture</p>
                      <Badge variant="secondary" className="text-[10px]">{BATHROOM_FIXTURE_FINISH_CHIPS.find((chip) => chip.value === bathroomFixtureFinishFilter(selectedBathroomFixture))?.label ?? "Other"}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-navy)]">{selectedBathroomFixture.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{selectedBathroomFixture.size ?? "Source size on file"}{selectedBathroomFixture.pelicanCode ? ` · ${selectedBathroomFixture.pelicanCode}` : ""}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--color-navy)]">{formatPrice(selectedBathroomFixture.sellPrice)}</p>
                  </div>
                </section>
              )}
            </div>
            {paletteLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full rounded-lg" />
                ))}
              </div>
            ) : configurations.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                {isBathroom ? "No source-priced bathroom fixtures match your search." : category === "Preferred" ? "No saved products currently meet the verified Designer gate." : `No ${category.toLowerCase()} items match your search.`}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {configurations.map((configuration) => {
                  const displayVariant = pelicanDisplayVariant(configuration, selectedIds, chosenVariantIds[configuration.key]);
                  const p: any = displayVariant.item;
                  const isSel = selectedIds.has(p.id);
                  const siblingSelected = isSel ? undefined : configuration.variants.find((entry) => selectedIds.has(entry.item.id));
                  const hasVariants = configuration.variants.length > 1;
                  const gradient =
                    CATEGORY_GRADIENT[p.category] ?? "linear-gradient(135deg,#e5e7eb,#cbd5e1)";
                  const hasThreeDMaterialRole = /floor|tile|mosaic|backsplash|countertop|quartz|slab/i.test(`${p.category ?? ""} ${p.subCategory ?? ""}`);
                  const hasApprovedMaterialSwatch = Boolean(p.materialImageUrl?.trim());
                  const isBacksplash = p.category === "Tile & Mosaic";
                  const isActiveThreeDBacksplash = isBacksplash && activeThreeDBacksplashId === p.id;
                  const item: SelectedSurface = {
                    id: p.id,
                    pelicanCode: p.pelicanCode,
                    slug: p.slug,
                    name: p.name,
                    category: p.category,
                    subCategory: p.subCategory,
                    size: p.size,
                    imageUrl: p.imageUrl,
                    materialImageUrl: p.materialImageUrl,
                    sellPrice: p.sellPrice,
                    coverageSqFt: p.coverageSqFt ?? null,
                    unsupportedOverhangLimitIn: p.unsupportedOverhangLimitIn == null ? null : Number(p.unsupportedOverhangLimitIn),
                  };
                  const bathroomFixtureProfile = isBathroom
                    ? verifiedPelicanBathroomFixtureProfile(item.pelicanCode)
                    : null;
                  const specificationUrl = verifiedSurfaceSpecificationUrl(item);
                  // One countertop, floor and wall tile are already replaced by choosing another;
                  // everything else (sinks, faucets, fixtures) swaps a selected sibling finish
                  // for the new one instead of adding a second copy of the same product.
                  const replacesPrevious = p.category === "Quartz Slabs (Countertops)" || p.category === "Flooring" || p.category === "Tile & Mosaic";
                  const choose = () => {
                    if (!isSel && !replacesPrevious) {
                      for (const sibling of pelicanSelectedSiblings(configuration, displayVariant, selectedIds)) {
                        onToggle(sibling as SelectedSurface);
                      }
                    }
                    onToggle(item);
                  };
                  return (
                    <div
                      key={configuration.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${isSel ? "Remove" : "Select"} ${configuration.label}${hasVariants ? ` — ${displayVariant.label}` : ""}`}
                      data-testid={`surface-card-${p.id}`}
                      onClick={choose}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          choose();
                        }
                      }}
                      className={`touch-manipulation cursor-pointer overflow-hidden rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
                        isSel ? "border-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/40" : "border-border"
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={`${configuration.label}${hasVariants ? ` in ${displayVariant.label}` : ""}`} className="h-full w-full object-cover" />
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
                      </div>
                      <div className="space-y-1 p-2.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{configuration.eyebrow}</p>
                        <div className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug">
                          {configuration.label}
                        </div>
                        {hasVariants && (
                          <PelicanVariantSelect
                            configuration={configuration}
                            value={displayVariant}
                            onChange={(variantId) => setChosenVariantIds((current) => ({ ...current, [configuration.key]: variantId }))}
                          />
                        )}
                        {(p.size || p.pelicanCode) && (
                          <div className="truncate text-[11px] text-muted-foreground">{[p.size, p.pelicanCode].filter(Boolean).join(" · ")}</div>
                        )}
                        {siblingSelected && (
                          <p data-testid={`surface-sibling-selected-${p.id}`} className="text-[10px] font-medium leading-snug text-[#8a6828]">In your design: {siblingSelected.label}</p>
                        )}
                        {hasThreeDMaterialRole && (
                          <p data-testid={`surface-material-readiness-${p.id}`} className={`text-[10px] font-medium leading-snug ${hasApprovedMaterialSwatch ? "text-emerald-700" : "text-amber-800"}`}>
                            {hasApprovedMaterialSwatch ? "3D material swatch ready" : "3D material swatch pending — neutral preview"}
                          </p>
                        )}
                        {isBathroom && (activeBathroomRole === "toilet-bidet" || activeBathroomRole === "bathtub" || activeBathroomRole === "shower-door" || activeBathroomRole === "shower-surround" || bathroomFixtureProfile?.kind === "floor-tub-filler") && (
                          <p data-testid={`bathroom-fixture-placement-${p.id}`} className={`text-[10px] font-medium leading-snug ${bathroomFixtureProfile ? "text-emerald-700" : "text-amber-800"}`}>
                            {pelicanBathroomFixturePlacementText(item.pelicanCode)}
                          </p>
                        )}
                        {isSel && isBacksplash && onSetActiveThreeDBacksplash && (
                          <Button
                            type="button"
                            size="sm"
                            variant={isActiveThreeDBacksplash ? "default" : "outline"}
                            className="h-7 w-full text-[11px]"
                            data-testid={`surface-use-in-3d-${p.id}`}
                            disabled={isActiveThreeDBacksplash}
                            onClick={(event) => { event.stopPropagation(); onSetActiveThreeDBacksplash(item); }}
                          >
                            {isActiveThreeDBacksplash ? "Final 3D wall material" : "Use in 3D wall"}
                          </Button>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-bold text-[var(--color-navy)] dark:text-foreground">
                            {formatPrice(p.sellPrice)}
                          </span>
                          <Button
                            size="sm"
                            variant={isSel ? "secondary" : "default"}
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={(event) => { event.stopPropagation(); choose(); }}
                          >
                            {isSel ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" /> {hasVariants ? pelicanUseLabel(configuration.optionLabel) : "Add"}
                              </>
                            )}
                          </Button>
                        </div>
                        {bathroomFixtureProfile && onPlaceBathroomFixture && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-full text-[11px]"
                            data-testid={`place-bathroom-fixture-${p.id}`}
                            onClick={(event) => { event.stopPropagation(); onPlaceBathroomFixture(item); }}
                          >
                            {bathroomFixtureProfile.kind === "floor-tub-filler" ? "Place floor-mounted tub filler" : bathroomFixtureProfile.planningOnly ? "Place visual planning envelope" : "Place in floor plan & 3D"}
                          </Button>
                        )}
                        {specificationUrl && (
                          <a
                            href={specificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`surface-card-specs-${p.id}`}
                            aria-label={`View manufacturer specifications for ${configuration.label}`}
                            title="View manufacturer specifications"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-[#b98d3e]/60 bg-white px-2 text-[11px] font-medium text-[#634b20] transition hover:bg-[#fff4d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] active:scale-95"
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Specs
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer summary */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <div className="text-sm text-muted-foreground">
            {selected.length === 0 ? (
              "No surfaces added yet"
            ) : (
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{selected.length}</Badge>
                added ·{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(estimatedSubtotal ?? selected.reduce((sum, s) => sum + (s.sellPrice ?? 0), 0))}
                </span>
              </span>
            )}
          </div>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
