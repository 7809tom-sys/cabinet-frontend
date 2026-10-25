import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Palette, ArrowRight, ChevronLeft, ChevronRight, ImageIcon, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import { DoorStyleSwatch } from "@/components/DoorStyleSwatch";
import { ResilientStyleImage } from "@/components/ResilientStyleImage";
import {
  DOOR_COLOR_SPECTRUM_PAGE_SIZE,
  doorColorSpectrumGradient,
  doorColorSpectrumPage,
  doorColorSpectrumPageCount,
  doorStyleColorHex,
  orderDoorStylesByColor,
} from "@/lib/doorColorSpectrum";
import DoorPhotoMatchWidget from "@/components/DoorPhotoMatchWidget";
import { styleDisplayName } from "@/lib/styleDisplayName";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type SimpleDoorStyle = "shaker" | "slab" | "slim" | "raised";

const SIMPLE_DOOR_STYLES: Array<{ key: SimpleDoorStyle; label: string }> = [
  { key: "shaker", label: "Shaker" },
  { key: "slab", label: "Slab" },
  { key: "slim", label: "Slim" },
  { key: "raised", label: "Raised" },
];

function simpleDoorStyle(value: string | null | undefined): SimpleDoorStyle {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("slim")) return "slim";
  if (normalized.includes("slab") || normalized.includes("flat panel")) return "slab";
  if (normalized.includes("raised")) return "raised";
  // Named framed profiles—Haven, Oxford, Edgeline, Casselberry, and Double
  // Shaker—belong in the one Shaker choice instead of making a phone filter
  // bar difficult to scan.
  return "shaker";
}

// ─── Style card ───────────────────────────────────────────────────────────────
// Presents purely by door-style attributes. No supplier/line identity is shown.

interface DoorStyle {
  id: number;
  styleCode: string;
  ourName: string | null;
  aliasName?: string | null;
  featuredLabel?: string | null;
  featuredRank?: number | null;
  doorStyle: string | null;
  woodSpecies: string | null;
  color: string | null;
  finish: string | null;
  hardware?: string | null;
  isBuilderGrade?: boolean | null;
  distributorId?: number | null;
  thumbnailImageUrl: string | null;
  doorSampleImageUrl: string | null;
  roomSceneImageUrl: string | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  centerRailWidth?: string | number | null;
  profileNotes?: string | null;
  profileDescription?: string | null;
  specificationStatus?: "purchasable" | "availability_pending" | "coming_soon" | null;
  sourceSpecification?: string | null;
}

/** Returns the public-facing display name: aliasName → featuredLabel → ourName → styleCode */
function displayName(style: DoorStyle): string {
  return styleDisplayName(style) || style.featuredLabel || style.styleCode;
}

function StyleCard({ style, seriesName }: { style: DoorStyle; seriesName?: string | null }) {
  const { t } = useLanguage();
  const [showDoor, setShowDoor] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const isSpecificationReference = Boolean(
    style.specificationStatus && style.specificationStatus !== "purchasable",
  );
  const availabilityLabel = style.specificationStatus === "coming_soon"
    ? "Coming soon"
    : "Specification reference";
  // Room scene is the featured image; door sample is the secondary toggle view
  const roomScene = style.roomSceneImageUrl || null;
  const doorSample = style.doorSampleImageUrl || null;
  // Hero: room scene first, fall back to door sample
  const heroSrc = showDoor ? (doorSample || roomScene) : (roomScene || doorSample);
  const canToggle = !!(roomScene && doorSample); // only show toggle when both exist

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="cabinet-card group relative rounded-xl border border-border bg-card overflow-hidden text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Room scene as the primary visual — door sample available via toggle */}
          <div className="h-48 flex items-center justify-center border-b border-border overflow-hidden relative bg-gradient-to-b from-muted/40 to-muted/70">
            {heroSrc ? (
              <ResilientStyleImage
                key={heroSrc}
                src={heroSrc}
                alt={showDoor ? `${displayName(style)} door sample` : `${displayName(style)} kitchen`}
                style={style}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                onFallback={!showDoor ? () => setSceneUnavailable(true) : undefined}
              />
            ) : (
              <DoorStyleSwatch
                style={style}
                className="relative h-32 w-auto drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
              />
            )}
            {/* Door/scene toggle button */}
            {canToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDoor(v => !v); }}
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 bg-black/40 text-white hover:bg-black/60 transition-colors"
                aria-label={showDoor ? "Show room scene" : "Show door close-up"}
              >
                <ImageIcon className="h-3 w-3" />
              </button>
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-medium text-white bg-black/55 px-2 py-0.5 rounded-full">
              {showDoor ? "Door sample" : sceneUnavailable ? "Door-color preview" : "Room scene"}
            </span>
          </div>

          {/* Builder Grade line marker — standard hardware, value line */}
          {style.isBuilderGrade && (
            <span className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide text-amber-950 bg-amber-300/95 px-2 py-0.5 rounded-full shadow-sm">
              {t("ds_builder_grade")}
            </span>
          )}
          {isSpecificationReference && (
            <span className="absolute top-2 right-2 z-10 text-[10px] font-semibold uppercase tracking-wide text-sky-950 bg-sky-200/95 px-2 py-0.5 rounded-full shadow-sm">
              {availabilityLabel}
            </span>
          )}

          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-sm text-foreground leading-snug">
                {displayName(style)}
              </p>
              {style.doorStyle && (
                <Badge variant="outline" className="text-xs shrink-0">{style.doorStyle}</Badge>
              )}
            </div>

            <div className="mt-1 space-y-0.5">
              {style.woodSpecies && (
                <p className="text-xs text-muted-foreground">{t("ds_wood")}: {style.woodSpecies}</p>
              )}
              {style.finish && (
                <p className="text-xs text-muted-foreground">{t("ds_finish")}: {style.finish}</p>
              )}
              {style.color && (
                <p className="text-xs text-muted-foreground">
                  {t("ds_color")}: {style.color}{seriesName ? <span className="text-muted-foreground/70"> ({seriesName})</span> : null}
                </p>
              )}
              {!style.color && seriesName && (
                <p className="text-xs text-muted-foreground/70">({seriesName})</p>
              )}
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden p-0">
        <div className="px-6 pt-6 pb-3 border-b border-border shrink-0 flex items-start justify-between gap-3">
          <DialogHeader className="flex-1 min-w-0">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {displayName(style)}
              {style.doorStyle && (
                <Badge variant="outline" className="text-xs">{style.doorStyle}</Badge>
              )}
              {style.isBuilderGrade && (
                <Badge className="text-xs bg-amber-300 text-amber-950 hover:bg-amber-300">{t("ds_builder_grade")}</Badge>
              )}
              {isSpecificationReference && (
                <Badge className="text-xs bg-sky-100 text-sky-900 hover:bg-sky-100">{availabilityLabel}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <DialogClose className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-0.5">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* Primary: room scene (full-width hero), then door sample thumbnail below */}
        {roomScene && (
          <div className="min-h-48 rounded-lg overflow-hidden border border-border">
            <ResilientStyleImage
              src={roomScene}
              alt={`${displayName(style)} kitchen`}
              style={style}
              className="w-full h-auto block"
              unavailableLabel="Kitchen image unavailable in this browser"
            />
          </div>
        )}
        {/* Door sample — shown as secondary if room scene is present, or primary if not */}
        <div className={`rounded-lg overflow-hidden border border-border bg-gradient-to-b from-muted/40 to-muted/70 ${roomScene ? "flex items-center gap-3 p-3" : ""}`}>
          {doorSample ? (
            <ResilientStyleImage
              src={doorSample}
              alt={`${displayName(style)} door sample`}
              style={style}
              className={roomScene ? "h-24 w-auto rounded object-contain" : "w-full h-auto block"}
            />
          ) : (
            <DoorStyleSwatch style={style} className={roomScene ? "h-24 w-auto" : "w-full h-auto block"} />
          )}
          {roomScene && (
            <div className="text-xs text-muted-foreground">Door close-up</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-2">
            <DoorStyleSwatch style={style} className="h-12 w-auto" />
            <div className="text-xs text-muted-foreground">{t("ds_true_color")}</div>
          </div>
          <div className="space-y-0.5">
            {style.doorStyle && <p className="text-xs"><span className="text-muted-foreground">{t("ds_style")}:</span> {style.doorStyle}</p>}
            {style.woodSpecies && <p className="text-xs"><span className="text-muted-foreground">{t("ds_wood")}:</span> {style.woodSpecies}</p>}
            {style.finish && <p className="text-xs"><span className="text-muted-foreground">{t("ds_finish")}:</span> {style.finish}</p>}
            {style.color && <p className="text-xs"><span className="text-muted-foreground">{t("ds_color")}:</span> {style.color}</p>}
            {style.hardware && <p className="text-xs"><span className="text-muted-foreground">{t("ds_hardware")}:</span> {style.hardware}</p>}
          </div>
        </div>

        {/* Frame profile measurements */}
        {(style.railWidth || style.stileWidth || style.centerRailWidth || style.profileNotes) && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-emerald-800">Frame Profile</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {style.railWidth && (
                <p className="text-xs"><span className="text-muted-foreground">Rail:</span> {style.railWidth}&quot;</p>
              )}
              {style.stileWidth && (
                <p className="text-xs"><span className="text-muted-foreground">Stile:</span> {style.stileWidth}&quot;</p>
              )}
              {style.centerRailWidth && (
                <p className="text-xs"><span className="text-muted-foreground">Center Rail:</span> {style.centerRailWidth}&quot;</p>
              )}
              {style.profileNotes && (
                <p className="text-xs"><span className="text-muted-foreground">Profile:</span> {style.profileNotes}</p>
              )}
            </div>
          </div>
        )}

        {/* Profile Description */}
        {(style as DoorStyle & { profileDescription?: string | null }).profileDescription && (
          <div className="rounded-md border border-blue-100 bg-blue-50/50 px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-blue-800">About This Profile</p>
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">
              {(style as DoorStyle & { profileDescription?: string | null }).profileDescription}
            </p>
          </div>
        )}

        {/* Builder Grade advisory: this value line ships standard hardware, not soft-close */}
        {style.isBuilderGrade && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t("ds_builder_grade_note")}
          </div>
        )}
        {isSpecificationReference && (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            {style.specificationStatus === "coming_soon"
              ? "This finish is documented by the manufacturer as coming soon. It is not yet available to order."
              : "This finish is documented by the manufacturer. It will become available to order only after a verified positive supplier price is published."}
            {style.sourceSpecification ? ` Source: ${style.sourceSpecification}.` : ""}
          </div>
        )}

        </div>
        {/* Sticky footer with the CTA button — always visible */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-background">
          {isSpecificationReference ? (
            <p className="text-center text-sm text-muted-foreground">Not available for catalog, cart, or Designer selection yet.</p>
          ) : (
            <Link href={`/family/${encodeURIComponent(style.styleCode)}`}>
              <Button className="w-full" size="lg">
                {t("ds_shop_collection", { name: displayName(style) })}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Door Styles page ────────────────────────────────────────────────────

export default function DoorStyles() {
  const { t, lang } = useLanguage();
  useSeo({ title: t("seo_styles_t"), description: t("seo_styles_d"), lang });
  // Read an optional ?door=<DoorStyle> query param so links from the Home page
  // hero chips (e.g. /styles?door=Shaker) open the grid pre-filtered to one of
  // the four customer-facing groups. Falls back to All Styles when absent.
  const initialType = (() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("door");
    return p && p.trim() ? simpleDoorStyle(p) : null;
  })();
  const [selectedType, setSelectedType] = useState<SimpleDoorStyle | null>(initialType);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const PER_PAGE = 16;
  const [page, setPage] = useState(0);
  const [colorRailPage, setColorRailPage] = useState(0);
  const [colorRailDirection, setColorRailDirection] = useState<1 | -1>(1);
  const [isColorRailSliding, setIsColorRailSliding] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => { setPage(0); }, [selectedType, searchQuery]);
  useEffect(() => { setColorRailPage(0); }, [selectedType]);

  // Fetch distributors to map series names
  const { data: distributorList } = trpc.distributors.list.useQuery();
  const seriesById = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const d of (distributorList ?? [])) m.set(d.id, d.seriesName ?? null);
    return m;
  }, [distributorList]);

  // Keep the URL in sync so the filtered view is shareable/back-button friendly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedType) url.searchParams.set("door", selectedType);
    else url.searchParams.delete("door");
    window.history.replaceState({}, "", url.toString());
  }, [selectedType]);

  const { data: styles, isLoading } = trpc.doorStyles.list.useQuery();
  const { data: specificationReferences } = trpc.doorStyles.specificationReferences.useQuery();
  // Admin-curated featured set (80/20 merchandising), ordered by rank, max 30.
  const { data: featuredData } = trpc.doorStyles.featured.useQuery();

  // De-duplicate styles by display name (the same style can be carried by more
  // than one supply line internally; members should only ever see it once).
  const uniqueStyles = useMemo(() => {
    const map = new Map<string, DoorStyle>();
    for (const s of (styles ?? []) as DoorStyle[]) {
      const key = (s.ourName || s.styleCode || String(s.id)).toLowerCase();
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.ourName || "").localeCompare(b.ourName || "")
    );
  }, [styles]);

  // Featured push styles come from the admin-curated list (Admin → Featured
  // Styles). The backend already orders by rank and caps at 30; we preserve
  // that order here. Membership is keyed by display name so de-duped rows match.
  const featuredNames = useMemo(() => {
    const names = new Map<string, number>();
    ((featuredData ?? []) as DoorStyle[]).forEach((s, i) => {
      const key = (s.ourName || s.styleCode || String(s.id)).toLowerCase();
      if (!names.has(key)) names.set(key, i);
    });
    return names;
  }, [featuredData]);

  const isFeatured = (s: DoorStyle) =>
    featuredNames.has((s.ourName || s.styleCode || String(s.id)).toLowerCase());

  const featured = useMemo(
    () =>
      uniqueStyles
        .filter(isFeatured)
        .sort(
          (a, b) =>
            (featuredNames.get((a.ourName || a.styleCode || String(a.id)).toLowerCase()) ?? 0) -
            (featuredNames.get((b.ourName || b.styleCode || String(b.id)).toLowerCase()) ?? 0)
        )
        .slice(0, 30),
    [uniqueStyles, featuredNames]
  );

  // The slider is the complete active, sellable door-color catalogue—not only
  // the seven editor picks below it. `doorStyles.list` has already excluded
  // inactive/unorderable styles, while `uniqueStyles` dedupes shared lines.
  // Present every remaining door finish from light through deep, six at a time.
  const colorRailStyles = useMemo(
    () => orderDoorStylesByColor(uniqueStyles),
    [uniqueStyles],
  );
  const previewStyles = useMemo(
    () => selectedType
      ? colorRailStyles.filter((style) => simpleDoorStyle(style.doorStyle) === selectedType)
      : colorRailStyles,
    [colorRailStyles, selectedType],
  );
  const colorRailPageCount = doorColorSpectrumPageCount(previewStyles);
  const visibleColorRailStyles = doorColorSpectrumPage(previewStyles, colorRailPage);
  const colorRailFirst = previewStyles.length === 0 ? 0 : colorRailPage * DOOR_COLOR_SPECTRUM_PAGE_SIZE + 1;
  const colorRailLast = Math.min(previewStyles.length, colorRailFirst + visibleColorRailStyles.length - 1);
  const selectedPreview = previewStyles.find((style) => style.id === selectedPreviewId) ?? previewStyles[0] ?? null;

  useEffect(() => {
    setColorRailPage((current) => Math.min(current, Math.max(0, colorRailPageCount - 1)));
  }, [colorRailPageCount]);

  // A profile change selects its first available finish; a color click owns the
  // selection until that finish no longer belongs to the selected profile.
  useEffect(() => {
    setSelectedPreviewId((current) => (
      current != null && previewStyles.some((style) => style.id === current)
        ? current
        : previewStyles[0]?.id ?? null
    ));
  }, [previewStyles]);

  const moveColorRail = (direction: 1 | -1) => {
    const nextPage = Math.max(0, Math.min(colorRailPageCount - 1, colorRailPage + direction));
    if (nextPage === colorRailPage || isColorRailSliding) return;
    setColorRailDirection(direction);
    if (!reduceMotion) setIsColorRailSliding(true);
    setColorRailPage(nextPage);
  };

  const colorRailVariants = {
    enter: (direction: number) => ({ x: reduceMotion ? 0 : direction * 44, opacity: reduceMotion ? 1 : 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: reduceMotion ? 0 : direction * -44, opacity: reduceMotion ? 1 : 0 }),
  };

  const visible = useMemo(() => {
    let list = uniqueStyles;
    if (selectedType) list = list.filter((s) => simpleDoorStyle(s.doorStyle) === selectedType);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => {
        const sn = seriesById.get(s.distributorId ?? -1) ?? "";
        const n = ((s.ourName || "") + " " + (s.aliasName || "") + " " + (s.color || "") + " " + (s.doorStyle || "") + " " + sn).toLowerCase();
        return n.includes(q);
      });
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueStyles, selectedType, searchQuery, seriesById]);

  // When no profile filter is active, show the Featured row separately and keep
  // the main grid as the rest (so featured styles aren't duplicated below).
  const showFeatured = !selectedType && featured.length > 0;
  const gridStyles = showFeatured
    ? visible.filter((s) => !isFeatured(s))
    : visible;

  // Desktop pages the main grid by 16 (4x4). Mobile shows the full list so the
  // familiar scroll is preserved. Clamp the page if the list shrank.
  const paginate = !isMobile;
  const pageCount = paginate ? Math.max(1, Math.ceil(gridStyles.length / PER_PAGE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const pagedStyles = paginate
    ? gridStyles.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE)
    : gridStyles;

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
          {t("ds_title")}
        </h1>
        <p className="text-muted-foreground">
          {t("ds_sub")}
        </p>
      </div>

      {/* Match a door from a photo */}
      <div className="mb-8">
        <DoorPhotoMatchWidget />
      </div>

      {/* Search + Filters */}
      <div className="mb-8 space-y-3">
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, color or series…"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Keep the public door-profile choice simple and phone friendly. */}
        <div className="flex flex-wrap gap-2" aria-label="Door style filter">
          <button onClick={() => setSelectedType(null)} aria-pressed={selectedType === null}
            className={`px-4 py-1.5 rounded-full text-sm transition-all ${
              selectedType === null
                ? "border-[3px] border-[#0f1f3d] bg-[#d4a75a] font-extrabold text-[#0f1f3d] shadow-[0_0_0_3px_rgba(212,167,90,0.3)] ring-2 ring-[#d4a75a] ring-offset-2"
                : "border border-border bg-background font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground"
            }`}>
            {t("ds_all_styles")}
          </button>
          {SIMPLE_DOOR_STYLES.map((style) => (
            <button key={style.key}
              onClick={() => setSelectedType(selectedType === style.key ? null : style.key)}
              aria-pressed={selectedType === style.key}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                selectedType === style.key
                  ? "border-[3px] border-[#0f1f3d] bg-[#d4a75a] font-extrabold text-[#0f1f3d] shadow-[0_0_0_3px_rgba(212,167,90,0.3)] ring-2 ring-[#d4a75a] ring-offset-2"
                  : "border border-border bg-background font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground"
              }`}>
              {style.label}
            </button>
          ))}
        </div>

        {/* Active filter summary */}
        {(selectedType || searchQuery) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{visible.length} style{visible.length !== 1 ? "s" : ""} found</span>
            <button onClick={() => { setSelectedType(null); setSearchQuery(""); }}
              className="text-primary hover:underline">
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Featured color line: select a finish before browsing the room-scene cards. */}
      {!isLoading && colorRailStyles.length > 0 && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-wood)]">Cabinet color line</p>
              <h2 className="mt-1 font-serif text-xl font-bold text-foreground">Choose a door color first</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedType
                  ? `${SIMPLE_DOOR_STYLES.find((style) => style.key === selectedType)?.label ?? "Selected"} finishes, light to deep.`
                  : "White to deep finishes, six door samples at a time."}
              </p>
            </div>
            <div className="flex items-center gap-2" aria-label="Cabinet color line pages">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-background"
                aria-label="Show previous six cabinet colors"
                disabled={colorRailPage === 0 || isColorRailSliding}
                onClick={() => moveColorRail(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-10 text-center text-xs font-semibold text-muted-foreground">
                {colorRailPage + 1} / {colorRailPageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-background"
                aria-label="Show next six cabinet colors"
                disabled={colorRailPage >= colorRailPageCount - 1 || isColorRailSliding}
                onClick={() => moveColorRail(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span>Light</span>
            <div
              className="h-2 flex-1 rounded-full ring-1 ring-black/10"
              style={{ backgroundImage: doorColorSpectrumGradient(previewStyles) }}
              role="img"
              aria-label="Door color line from light to deep"
            />
            <span>Deep</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
            Showing {colorRailFirst}–{colorRailLast} of {previewStyles.length} active cabinet door colors
          </p>

          <div className="relative overflow-hidden" aria-live="polite">
            <AnimatePresence initial={false} mode="wait" custom={colorRailDirection}>
              <motion.div
                key={colorRailPage}
                custom={colorRailDirection}
                variants={colorRailVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                onAnimationComplete={(definition) => {
                  if (definition === "center") setIsColorRailSliding(false);
                }}
                className="grid grid-cols-3 gap-2.5 will-change-transform sm:grid-cols-6 sm:gap-3"
              >
                {visibleColorRailStyles.map((style) => {
                  const name = displayName(style);
                  const detail = style.color ?? style.finish ?? style.doorStyle ?? "Door sample";
                  return (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => setSelectedPreviewId(style.id)}
                      aria-pressed={selectedPreview?.id === style.id}
                      aria-label={`Show ${name} kitchen preview`}
                      className={`group rounded-lg bg-background p-2 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        selectedPreview?.id === style.id
                          ? "border-2 border-[#d4a75a] ring-2 ring-[#d4a75a]/35"
                          : "border border-border hover:-translate-y-0.5 hover:border-[var(--color-gold)]/70 hover:shadow-md"
                      }`}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-black/10 bg-muted">
                        <DoorStyleSwatch style={style} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full border border-white/70 shadow-sm"
                          style={{ backgroundColor: doorStyleColorHex(style) }}
                        />
                      </div>
                      <p className="mt-2 truncate text-xs font-semibold text-foreground" title={name}>{name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={detail}>{detail}</p>
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {selectedPreview && (() => {
            const previewName = displayName(selectedPreview);
            const previewImage = selectedPreview.roomSceneImageUrl || selectedPreview.thumbnailImageUrl || selectedPreview.doorSampleImageUrl;
            const previewDetail = selectedPreview.color ?? selectedPreview.finish ?? selectedPreview.doorStyle ?? "Selected door finish";
            return (
              <section className="mt-5 overflow-hidden rounded-xl border border-[#d4a75a]/45 bg-[#fffaf0] p-3 sm:p-4" aria-live="polite">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={selectedPreview.id}
                    initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduceMotion ? 0 : -18 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                    className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
                  >
                    <div className="order-2 min-w-0 sm:order-1">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8b6425]">Selected kitchen preview</p>
                      <h3 className="mt-1 text-lg font-bold text-foreground">{previewName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{previewDetail}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">This cabinet scene updates when a new style or color is selected.</p>
                      <Link href={`/family/${encodeURIComponent(selectedPreview.styleCode)}`} className="mt-3 inline-flex">
                        <Button size="sm" className="bg-[#0f1f3d] text-white hover:bg-[#19305a]">
                          View {previewName} cabinets
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                    <div className="order-1 aspect-[4/3] overflow-hidden rounded-lg border border-[#d4a75a]/40 bg-muted sm:order-2">
                      {previewImage ? (
                        <ResilientStyleImage key={selectedPreview.id} src={previewImage} style={selectedPreview} alt={`${previewName} cabinet kitchen preview`} className="h-full w-full object-cover" unavailableLabel="Kitchen image unavailable in this browser" />
                      ) : (
                        <DoorStyleSwatch style={selectedPreview} className="h-full w-full object-cover" />
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </section>
            );
          })()}
        </section>
      )}

      {/* Featured cabinet cards remain below the color line. */}
      {!isLoading && showFeatured && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-serif text-xl font-bold text-foreground">{t("ds_featured")}</h2>
            <Badge className="bg-primary text-primary-foreground">{t("ds_editors_picks")}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {featured.map((style) => (
              <StyleCard key={style.id} style={style} seriesName={seriesById.get(style.distributorId ?? -1) ?? null} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && showFeatured && gridStyles.length > 0 && (
        <h2 className="font-serif text-xl font-bold text-foreground mb-4">{t("ds_all_door_styles")}</h2>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Palette className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("ds_none")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pagedStyles.map((style) => (
              <StyleCard key={style.id} style={style} seriesName={seriesById.get(style.distributorId ?? -1) ?? null} />
            ))}
          </div>

          {/* Desktop pager: 16 styles per page, Prev / Next + position. */}
          {paginate && pageCount > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 0}
                onClick={() => {
                  setPage((p) => Math.max(0, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("ds_prev")}
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("ds_page_of", { page: String(safePage + 1), total: String(pageCount) })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => {
                  setPage((p) => Math.min(pageCount - 1, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {t("ds_next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
      {!isLoading && (specificationReferences?.length ?? 0) > 0 && (
        <section className="mt-12 rounded-2xl border border-sky-200 bg-sky-50/40 p-5 md:p-6">
          <div className="mb-5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl font-bold text-foreground">Capital Collection reference finishes</h2>
              <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">Not yet orderable</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              These documented manufacturer finishes are shown for specification planning only. They are kept out of the catalog, cart, and Designer until an available supplier line has a verified positive price.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(specificationReferences as DoorStyle[]).map((style) => (
              <StyleCard key={style.id} style={style} seriesName={seriesById.get(style.distributorId ?? -1) ?? null} />
            ))}
          </div>
        </section>
      )}
      {/* ── Door Style Profile Guide ─────────────────────────────────────────── */}
      <div id="profile-guide" className="mt-16 border-t border-border pt-12">
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Door Style Profile Guide</h2>
          <p className="text-muted-foreground max-w-2xl">
            Not sure which profile is right for your project? Each door style has its own character, construction method, and ideal use case. Use this guide to compare profiles and find the perfect fit.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROFILE_GUIDE.map((profile) => (
            <div key={profile.name} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-base">{profile.name}</h3>
                  {profile.tag && (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">{profile.tag}</span>
                  )}
                </div>
                {profile.frameRange && (
                  <span className="shrink-0 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">Rail {profile.frameRange}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>
              {profile.bestFor && (
                <p className="text-xs text-foreground/70"><span className="font-medium text-foreground">Best for:</span> {profile.bestFor}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- Profile Guide content --------------------------------------------------
const PROFILE_GUIDE: {
  name: string;
  tag?: string;
  frameRange?: string;
  description: string;
  bestFor?: string;
}[] = [
  {
    name: "Shaker",
    tag: "Most Popular",
    frameRange: '2" - 3"',
    description:
      "Shaker cabinet doors feature a classic five-piece design with a recessed, flat center panel and a surrounding frame. Their simple, clean lines and durable construction make them a versatile choice that complements both traditional and modern kitchen styles.",
    bestFor: "Any kitchen style -- especially transitional and contemporary designs.",
  },
  {
    name: "Slim Shaker",
    tag: "Modern Favorite",
    frameRange: '1/2" - 1"',
    description:
      "The Slim Shaker (also called Skinny Shaker) is a refined take on the classic Shaker profile with dramatically narrower rails and stiles -- typically 1/2\" to 1\". The thinner frame exposes more of the center panel, creating a sleek, minimal look that is ideal for modern and contemporary kitchens.",
    bestFor: "Modern, minimalist, and European-inspired kitchen designs.",
  },
  {
    name: "Double Shaker",
    tag: "Transitional",
    frameRange: '2" - 3"',
    description:
      "The Double Shaker profile adds a second inner rail to the classic Shaker door, creating a step or dual-panel effect. This extra detail adds depth, striking shadow lines, and a sophisticated architectural feel -- making it a popular choice for transitional and upscale kitchen designs.",
    bestFor: "Transitional kitchens, custom built-ins, and high-end bathroom vanities.",
  },
  {
    name: "Raised Panel",
    tag: "Classic",
    description:
      "Raised Panel cabinets feature a center panel that sits higher than the surrounding door frame, creating a distinctive three-dimensional, sculpted look. This classic, architectural style offers depth, shadow lines, and elegant detailing, making it a popular choice for traditional, transitional, and formal design spaces.",
    bestFor: "Traditional kitchens, formal dining rooms, home offices, and master bathrooms.",
  },
  {
    name: "Flat Panel (Slab)",
    tag: "Ultra-Modern",
    description:
      "A slab cabinet door is a solid, flat piece of material like wood or laminate, with no raised panels, frames, or decorative molding. It is completely smooth and has clean lines, giving kitchens a very modern, minimalist look.",
    bestFor: "Modern, minimalist, and European-style kitchens with integrated or push-to-open hardware.",
  },
  {
    name: "Beaded",
    description:
      "The Beaded profile adds a small decorative bead (a narrow routed groove) along the inner edge of the door frame, where the stiles and rails meet the center panel. This subtle detail adds a cottage, farmhouse, or craftsman character to an otherwise simple flat or recessed panel door.",
    bestFor: "Farmhouse, cottage, and craftsman-style kitchens.",
  },
  {
    name: "Inset",
    tag: "Premium",
    description:
      "Inset cabinet doors are set flush inside the cabinet frame, showing the frame around the door. This gives a traditional, high-end look but requires precise craftsmanship to ensure they fit perfectly.",
    bestFor: "High-end custom kitchens where a furniture-grade, built-in aesthetic is the priority.",
  },
  {
    name: "Framed vs Frameless",
    tag: "Construction Type",
    description:
      "Framed cabinets have a face frame attached to the front of the box, which adds sturdiness and provides a traditional look. Frameless cabinets, also known as European style, don't have that frame, which gives you easier access and a more modern, seamless appearance.",
    bestFor: "Framed: traditional and transitional kitchens. Frameless: modern, contemporary, and European-style kitchens.",
  },
];
