import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Grid3X3, Palette, Ruler, FileSpreadsheet, Users, ChevronLeft, ChevronRight, Sparkles, Star, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

import { KITCHEN_SCENES } from "@/lib/doorFamilyPhotos";
import { DoorStyleSwatch } from "@/components/DoorStyleSwatch";
import {
  DOOR_COLOR_SPECTRUM_PAGE_SIZE,
  doorColorSpectrumGradient,
  doorColorSpectrumPage,
  doorColorSpectrumPageCount,
  doorStyleColorHex,
  orderDoorStylesByColor,
} from "@/lib/doorColorSpectrum";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import { buildMainSiteJsonLd } from "@/lib/seo/jsonLd";
import { EditableText } from "@/components/admin/EditableText";
import { HomepageWelcomeBanner } from "@/components/home/HomepageWelcomeBanner";

const CDN = "/manus-storage/legacy-cdn";

// ─── Dynamic Storefront Banner ───────────────────────────────────────────────
// Driven by the active banner in the admin Banner Management panel.

function StorefrontBanner() {
  const { data: banner, isLoading } = trpc.banners.getActive.useQuery();

  if (isLoading || !banner) return null;

  return (
    <div
      className="py-2.5 px-4 text-sm"
      style={{ backgroundColor: banner.backgroundColor, color: banner.textColor }}
    >
      <div className="container flex items-center justify-center gap-3 text-center flex-wrap">
        {banner.emoji && <span className="text-base flex-shrink-0">{banner.emoji}</span>}
        <p className="font-semibold tracking-wide">
          {banner.title}
          {banner.subtitle && (
            <span className="ml-2 font-normal opacity-80 hidden sm:inline">{banner.subtitle}</span>
          )}
        </p>
        {banner.ctaText && banner.ctaUrl && (
          <a
            href={banner.ctaUrl}
            className="text-xs font-bold px-3 py-1 rounded-full border flex-shrink-0 hover:opacity-80 transition-opacity"
            style={{ borderColor: banner.textColor, color: banner.textColor }}
          >
            {banner.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}

function AuthenticatedWelcomeBanner() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;
  return <HomepageWelcomeBanner user={user} />;
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function Hero() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-[var(--color-navy)] text-white">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.03) 40px,
            rgba(255,255,255,0.03) 80px
          )`
        }}
      />
      <div className="relative container py-16 md:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: copy + CTAs */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
              {t("home_hero_badge")}
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <EditableText pageKey="home" field="hero_title_line1" defaultValue="Plan Your Complete">
                {(v) => <>{v}</>}
              </EditableText>
              <br />
              <span className="text-[var(--color-gold)]">
                <EditableText pageKey="home" field="hero_title_line2" defaultValue="Kitchen & Bath.">
                  {(v) => <>{v}</>}
                </EditableText>
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/75 mb-8 leading-relaxed">
              <EditableText pageKey="home" field="hero_subtitle" defaultValue="Start with a complete kitchen idea, select a style and package, then customize the layout, surfaces, fixtures, and quote for your space." multiline>
                {(v) => <>{v}</>}
              </EditableText>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link href="/kitchens">
                <Button size="lg" className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90 font-semibold gap-2">
                  Plan a Complete Kitchen
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/bundles">
                <Button size="lg" variant="outline" className="border-white/80 text-white bg-white/5 hover:bg-white/15 hover:border-white gap-2">
                  <PackageOpen className="h-4 w-4" />
                  Kitchen Packages
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/styles">
                <Button size="lg" variant="outline" className="border-white/80 text-white bg-white/5 hover:bg-white/15 hover:border-white gap-2">
                  Shop by Style
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/design">
                <Button size="lg" variant="outline" className="border-white/80 text-white bg-white/5 hover:bg-white/15 hover:border-white gap-2">
                  Start from Scratch
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/closet">
                <Button size="lg" variant="outline" className="border-white/80 text-white bg-white/5 hover:bg-white/15 hover:border-white gap-2">
                  Plan a Closet
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: kitchen lifestyle collage */}
          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
              <img
                src={KITCHEN_SCENES["shaker-white"]}
                alt="Beautiful white shaker kitchen"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden w-40 overflow-hidden rounded-xl shadow-xl ring-4 ring-[var(--color-navy)] xl:block">
              <img
                src={`${CDN}/stonecreek-bath-hero-fCp9GA4H5XXQNmpgUdMiWg.webp`}
                alt="StoneCreek bathroom fixtures"
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="absolute -right-5 -top-5 hidden w-32 overflow-hidden rounded-xl shadow-xl ring-4 ring-[var(--color-navy)] xl:block">
              <img
                src={KITCHEN_SCENES["raised-cherry"]}
                alt="Cherry kitchen"
                className="aspect-square w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Value props row */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/15 pt-10">
          {[
            { value: "Cabinets", label: "Full catalog, every door style" },
            { value: "Surfaces", label: "Quartz, tile, flooring & more" },
            { value: "Fixtures", label: "Sinks, faucets, showers, toilets" },
            { value: "Design", label: "3D kitchen designer included" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold text-[var(--color-gold)]">{stat.value}</div>
              <div className="text-sm md:text-base text-white/70 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── About Your Kitchen ───────────────────────────────────────────────────────

function AboutYourKitchen() {
  const questions = [
    { icon: Ruler, question: "Where do I start?", answer: "Start with how you use your kitchen: prep, cook, clean up, and store. Then lay those work areas onto your walls before choosing finishes." },
    { icon: Grid3X3, question: "What layout fits my space?", answer: "Try a single-wall, galley, L-shape, U-shape, or island layout in the designer and compare the options side by side." },
    { icon: FileSpreadsheet, question: "What should I measure?", answer: "Measure each wall, the ceiling height, and every window, door, and opening from the corner. Rough measurements are enough to begin." },
    { icon: CircleCheck, question: "When will I know the price?", answer: "Your quote and materials list update as you build, including cabinets, fillers, and trim, so you can see the cost from the first cabinet onward." },
  ];

  return (
    <section className="border-y border-border bg-muted/30 py-14 md:py-18" aria-labelledby="about-your-kitchen-title">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-wood)]">About Your Kitchen</p>
          <h2 id="about-your-kitchen-title" className="mt-2 font-serif text-3xl font-bold text-foreground md:text-4xl">The four questions to answer first</h2>
          <p className="mt-3 text-muted-foreground">A simple starting point for planning a kitchen that works for your space and your life.</p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {questions.map(({ icon: Icon, question, answer }) => (
            <article key={question} className="rounded-2xl border border-border bg-background p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-gold)]/15 text-[var(--color-wood)]"><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <h3 className="mt-4 font-serif text-lg font-bold text-foreground">{question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-end">
          <Link href="/design"><Button className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">Start Designing <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link href="/kitchen-planning"><Button variant="outline" className="gap-2 bg-background">Read the Kitchen Planning Guide <ArrowRight className="h-4 w-4" /></Button></Link>
          <div className="flex flex-col items-center gap-2">
            <img
              src={KITCHEN_SCENES["shaker-white"]}
              alt="Kitchen package preview"
              className="h-16 w-28 rounded-lg border border-border object-cover shadow-sm"
            />
            <Link href="/bundles"><Button variant="outline" className="gap-2 bg-background">Browse Kitchen Packages <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Featured Door Style Color Line (from DB) ─────────────────────────────────

type FeaturedDoorStyle = {
  id: number;
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  featuredLabel?: string | null;
  featuredRank?: number | null;
  doorStyle?: string | null;
  woodSpecies?: string | null;
  color?: string | null;
  finish?: string | null;
  thumbnailImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  cornerSwatchImageUrl?: string | null;
  roomScenes?: Array<{ id: number; imageUrl: string; sortOrder: number }>;
};

function FeaturedStyles() {
  const { data: featured, isLoading } = trpc.doorStyles.featured.useQuery();
  const [page, setPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isSliding, setIsSliding] = useState(false);
  const reduceMotion = useReducedMotion();

  // The front page is a finish chooser, not a random collection of rooms. Each
  // active featured row gets its own real door sample (or the accurate swatch
  // fallback) and remains separately selectable even when profiles repeat.
  const orderedStyles = useMemo((): FeaturedDoorStyle[] => {
    if (!featured) return [];
    return orderDoorStylesByColor(featured as FeaturedDoorStyle[]);
  }, [featured]);

  // The color line is the first choice; these are the curated cabinet displays
  // that remain directly beneath it. A room never borrows another style's image.
  const featuredCabinetDisplays = useMemo(() => {
    if (!featured) return [];
    return (featured as FeaturedDoorStyle[])
      .flatMap((style) => {
        const imageUrl = style.roomScenes?.[0]?.imageUrl;
        return imageUrl ? [{ ...style, roomSceneImageUrl: imageUrl }] : [];
      })
      .slice(0, 6);
  }, [featured]);

  const pageCount = doorColorSpectrumPageCount(orderedStyles);
  const visibleStyles = doorColorSpectrumPage(orderedStyles, page);
  const firstStyleNumber = orderedStyles.length === 0 ? 0 : page * DOOR_COLOR_SPECTRUM_PAGE_SIZE + 1;
  const lastStyleNumber = Math.min(orderedStyles.length, firstStyleNumber + visibleStyles.length - 1);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const moveColorLine = (direction: 1 | -1) => {
    const nextPage = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (nextPage === page || isSliding) return;
    setSlideDirection(direction);
    if (!reduceMotion) setIsSliding(true);
    setPage(nextPage);
  };

  const spectrumSlideVariants = {
    enter: (direction: number) => ({
      x: reduceMotion ? 0 : direction * 56,
      opacity: reduceMotion ? 1 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: reduceMotion ? 0 : direction * -56,
      opacity: reduceMotion ? 1 : 0,
    }),
  };

  if (isLoading) {
    return (
      <section className="py-10 md:py-20" aria-busy="true" aria-live="polite">
        <div className="container">
          <div className="mb-8 text-center md:mb-12">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-wood)]">
              <span className="h-px w-8 bg-[var(--color-wood)]" />
              <span>Featured cabinet lines</span>
              <span className="h-px w-8 bg-[var(--color-wood)]" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">Loading cabinet colors and featured displays</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Preparing the door samples and finished cabinet displays.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="aspect-[4/5] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!orderedStyles.length) return null;

  return (
    <section className="py-10 md:py-20">
      <div className="container">
        <div className="mb-8 text-center md:mb-12">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-wood)]">
            <span className="h-px w-8 bg-[var(--color-wood)]" />
            <EditableText pageKey="home" field="featured_eyebrow" defaultValue="Featured Door Styles">
              {(value) => <>{value}</>}
            </EditableText>
            <span className="h-px w-8 bg-[var(--color-wood)]" />
          </div>
          <h2 className="mb-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            <EditableText pageKey="home" field="featured_title" defaultValue="Choose Your Cabinet Color">
              {(value) => <>{value}</>}
            </EditableText>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            <EditableText pageKey="home" field="featured_subtitle" defaultValue="Start with a real door sample. Move from bright white through natural tones and colors to deep black, six cabinet lines at a time." multiline>
              {(value) => <>{value}</>}
            </EditableText>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Light</span>
            <div
              className="h-2 flex-1 rounded-full ring-1 ring-black/10"
              style={{ backgroundImage: doorColorSpectrumGradient(orderedStyles) }}
              aria-label="Door color spectrum from light to dark"
              role="img"
            />
            <span>Deep</span>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing <strong className="text-foreground">{firstStyleNumber}–{lastStyleNumber}</strong> of {orderedStyles.length} cabinet color lines
            </p>
            <div className="flex items-center gap-2" aria-label="Door color line pages">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-background"
                aria-label="Show previous six cabinet color lines"
                disabled={page === 0 || isSliding}
                onClick={() => moveColorLine(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-12 text-center text-xs font-semibold text-muted-foreground">
                {page + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-background"
                aria-label="Show next six cabinet color lines"
                disabled={page >= pageCount - 1 || isSliding}
                onClick={() => moveColorLine(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative overflow-hidden" aria-live="polite">
            <AnimatePresence
              initial={false}
              mode="wait"
              custom={slideDirection}
            >
              <motion.div
                key={page}
                custom={slideDirection}
                variants={spectrumSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                onAnimationComplete={(definition) => {
                  if (definition === "center") setIsSliding(false);
                }}
                className="grid grid-cols-2 gap-3 will-change-transform md:grid-cols-3 md:gap-4 lg:grid-cols-6"
              >
                {visibleStyles.map((style) => {
                  const displayName = style.featuredLabel ?? style.aliasName ?? style.ourName ?? style.styleCode ?? "Cabinet line";
                  const detail = style.color ?? style.finish ?? style.doorStyle ?? "Door sample";
                  return (
                    <Link
                      key={style.id}
                      href={`/family/${encodeURIComponent(style.styleCode ?? String(style.id))}`}
                      aria-label={`View ${displayName} cabinets`}
                      className="group rounded-xl border border-border bg-background p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-gold)]/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-black/10 bg-muted">
                        <DoorStyleSwatch style={style} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        <span
                          aria-hidden="true"
                          className="absolute bottom-2 left-2 h-3.5 w-3.5 rounded-full border border-white/70 shadow-sm"
                          style={{ backgroundColor: doorStyleColorHex(style) }}
                        />
                      </div>
                      <h3 className="mt-3 truncate text-sm font-semibold text-foreground" title={displayName}>{displayName}</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-wood)] transition-all group-hover:gap-1.5">
                        View cabinets <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {featuredCabinetDisplays.length > 0 && (
          <div className="mt-12 border-t border-border pt-10 md:mt-16 md:pt-14">
            <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-wood)]">Featured cabinet displays</p>
                <h3 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">See the featured cabinets in a finished kitchen</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">Browse the room displays after choosing a color, then open the matching cabinet line to build your own layout.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <CircleCheck className="h-3.5 w-3.5" /> Active cabinet lines
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              {featuredCabinetDisplays.map((style, index) => {
                const displayName = style.featuredLabel ?? style.aliasName ?? style.ourName ?? style.styleCode ?? "Featured cabinet line";
                const isLead = index === 0;
                return (
                  <Link
                    key={style.id}
                    href={`/family/${encodeURIComponent(style.styleCode ?? String(style.id))}`}
                    className={`group relative overflow-hidden rounded-2xl bg-[var(--color-navy)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isLead ? "md:row-span-2" : ""}`}
                  >
                    <img
                      src={style.roomSceneImageUrl}
                      alt={`${displayName} finished kitchen cabinet display`}
                      className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${isLead ? "h-60 md:h-full" : "h-48"}`}
                    />
                    {style.cornerSwatchImageUrl && (
                      <img
                        src={style.cornerSwatchImageUrl}
                        alt={`${displayName} door sample`}
                        className="absolute left-3 top-3 h-14 w-14 rounded-lg border-2 border-white/50 object-cover shadow-lg ring-1 ring-black/10"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className={`absolute bottom-0 left-0 right-0 ${isLead ? "p-5 md:p-6" : "p-4"}`}>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                        <CircleCheck className="h-3 w-3" /> Active cabinet line
                      </span>
                      <h4 className={`mt-2 font-serif font-bold text-white ${isLead ? "text-xl md:text-2xl" : "text-lg"}`}>{displayName}</h4>
                      <p className="mt-0.5 text-sm text-white/75">{[style.doorStyle, style.woodSpecies].filter(Boolean).join(" · ") || "Featured cabinet display"}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-gold)] transition-all group-hover:gap-2.5">
                        View these cabinets <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/styles">
            <Button size="lg" variant="outline" className="gap-2 bg-card">
              Browse All Door Styles <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/design">
            <Button size="lg" className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">
              Start Designing Your Kitchen <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Product Category Showcase ───────────────────────────────────────────────

function ProductShowcase() {
  const categories = [
    {
      title: "Countertops & Tile",
      description: "Premium quartz slabs, porcelain tile, mosaic backsplash, and luxury flooring options.",
      image: KITCHEN_SCENES["slab-natural"],
      href: "/surfaces",
      cta: "Browse Surfaces",
      accent: "from-slate-600/80 to-slate-900/90",
    },
    {
      title: "StoneCreek Fixtures",
      description: "Exclusive sinks, faucets, and kitchen accessories. Modern designs at wholesale pricing.",
      image: `${CDN}/stonecreek-kitchen-hero-GNgNkcBRXKeBwSEoXrBMBg.webp`,
      href: "/stonecreek",
      cta: "StoneCreek Collection",
      accent: "from-emerald-600/80 to-emerald-900/90",
    },
    {
      title: "Plumber's Choice",
      description: "Complete bathroom install kits — showers, toilets, and bidets. Everything a plumber needs.",
      image: `${CDN}/stonecreek-bath-hero-fCp9GA4H5XXQNmpgUdMiWg.webp`,
      href: "/plumbers-choice",
      cta: "Shop Plumber's Choice",
      accent: "from-blue-600/80 to-blue-900/90",
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="container">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-wood)] mb-3">
            <span className="h-px w-8 bg-[var(--color-wood)]" />
            Everything You Need
            <span className="h-px w-8 bg-[var(--color-wood)]" />
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            <EditableText pageKey="home" field="showcase_title" defaultValue="One Platform, Every Product">
              {(v) => <>{v}</>}
            </EditableText>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            <EditableText pageKey="home" field="showcase_subtitle" defaultValue="From countertops to complete bathroom kits — shop everything for your next kitchen or bath project at trade pricing." multiline>
              {(v) => <>{v}</>}
            </EditableText>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link key={cat.title} href={cat.href} className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer">
              <img
                src={cat.image}
                alt={cat.title}
                className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.accent} via-transparent to-transparent`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="font-serif text-xl font-bold text-white mb-1">{cat.title}</h3>
                <p className="text-xs text-white/80 mb-3 line-clamp-2">{cat.description}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-gold)] group-hover:gap-2.5 transition-all">
                  {cat.cta} <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Supply Network Strip ─────────────────────────────────────────────────────

function DistributorsStrip() {
  const { t } = useLanguage();
  const styles = ["Shaker", "Raised Panel", "Slim Shaker", "Slab"];
  return (
    <section className="py-10 border-y border-border bg-muted/20">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm font-medium text-muted-foreground shrink-0">
            {t("home_strip_label")}
          </p>
          <div className="flex flex-wrap justify-center md:justify-end gap-3">
            {styles.map((name) => (
              <Link
                key={name}
                href={`/styles?door=${encodeURIComponent(name)}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Style Showcase (dream-kitchen scenes) ─────────────────────────────────────

function StyleShowcase() {
  const { t } = useLanguage();
  const { data: styles } = trpc.doorStyles.list.useQuery();
  const fallback = useMemo(
    () => [
      { name: "White Shaker", blurb: t("home_showcase_blurb_fallback"), scene: KITCHEN_SCENES["shaker-white"], href: "/styles" },
      { name: "Gray Shaker", blurb: t("home_showcase_blurb_fallback"), scene: KITCHEN_SCENES["shaker-gray"], href: "/styles" },
      { name: "Cherry Raised Panel", blurb: t("home_showcase_blurb_fallback"), scene: KITCHEN_SCENES["raised-cherry"], href: "/styles" },
      { name: "Natural Slab", blurb: t("home_showcase_blurb_fallback"), scene: KITCHEN_SCENES["slab-natural"], href: "/styles" },
      { name: "Espresso Shaker", blurb: t("home_showcase_blurb_fallback"), scene: KITCHEN_SCENES["shaker-espresso"], href: "/styles" },
    ],
    [t]
  );
  const looks = useMemo(() => {
    type S = { id: number; styleCode: string; ourName: string | null; doorStyle: string | null; color: string | null; woodSpecies: string | null; roomSceneImageUrl?: string | null };
    const list = (styles ?? []).filter((s) => !!(s as S).roomSceneImageUrl) as S[];
    if (list.length === 0) return fallback;
    const bucketOf = (s: S) => {
      const t2 = [s.color, s.ourName, s.doorStyle, s.woodSpecies].filter(Boolean).join(" ").toLowerCase();
      if (/black|obsidian|onyx|tricorn|espresso|java|ebony/.test(t2)) return "dark";
      if (/grey|gray|graphite|slate|sage|fog|navy|blue|cobalt/.test(t2)) return "gray";
      if (/cherry|mahogany|chestnut|saddle|autumn|rust|spice/.test(t2)) return "warm";
      if (/oak|honey|natural|maple|hickory|wheat|gold|solstice/.test(t2)) return "light";
      return "white";
    };
    const seen = new Set<string>();
    const picked: S[] = [];
    for (const s of list) {
      const b = bucketOf(s);
      if (seen.has(b)) continue;
      seen.add(b);
      picked.push(s);
      if (picked.length >= 5) break;
    }
    for (const s of list) {
      if (picked.length >= 5) break;
      if (picked.some((p) => p.id === s.id)) continue;
      picked.push(s);
    }
    return picked.map((s) => ({
      name: s.ourName || s.styleCode,
      blurb: [s.doorStyle, s.woodSpecies].filter(Boolean).join(" · ") || t("home_showcase_blurb_fallback"),
      scene: s.roomSceneImageUrl as string,
      href: `/family/${encodeURIComponent(s.styleCode)}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, fallback, t]);
  return (
    <section className="py-16 md:py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-wood)] mb-3">
            <span className="h-px w-8 bg-[var(--color-wood)]" />
            {t("home_showcase_eyebrow")}
            <span className="h-px w-8 bg-[var(--color-wood)]" />
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t("home_showcase_title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("home_showcase_sub")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Feature the first look large */}
          <Link href={looks[0].href} className="group relative col-span-1 md:row-span-2 overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-lg">
            <img src={looks[0].scene} alt={looks[0].name} className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <div className="font-serif text-2xl font-bold">{looks[0].name}</div>
              <div className="text-sm text-white/85">{looks[0].blurb}</div>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-gold)]">
                {t("home_showcase_shop_this")} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-6">
            {looks.slice(1).map((look) => (
              <Link key={look.name} href={look.href} className="group relative overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-lg">
                <img src={look.scene} alt={look.name} className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="font-serif text-base font-bold leading-tight">{look.name}</div>
                  <div className="text-xs text-white/80">{look.blurb}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/styles">
            <Button size="lg" variant="outline" className="gap-2 bg-card">
              {t("home_showcase_explore_all")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Become an Affiliate ──────────────────────────────────────────────────────

function AffiliatePromo() {
  const advantages = [
    {
      icon: Star,
      title: "Your Own Branded Storefront",
      description: "Get a custom-branded storefront powered by the full Cabinet Dealz catalog. Your name, your brand, our backend.",
    },
    {
      icon: Sparkles,
      title: "Earn on Every Order",
      description: "Every kitchen or bath project that comes through your storefront earns you a commission. No inventory, no risk.",
    },
    {
      icon: Grid3X3,
      title: "Thousands of Products",
      description: "Cabinets, countertops, tile, flooring, sinks, faucets, showers, toilets — your customers get access to everything.",
    },
    {
      icon: Users,
      title: "Trade Pricing Built In",
      description: "Your customers see competitive trade pricing automatically. You don't negotiate — the platform handles it.",
    },
    {
      icon: Palette,
      title: "3D Designer Included",
      description: "Your customers can build their kitchen in 3D right on your storefront. No extra software.",
    },
    {
      icon: FileSpreadsheet,
      title: "We Handle Fulfillment",
      description: "Orders ship direct from the supply network. You focus on sales and relationships — we handle the logistics.",
    },
  ];

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/20 dark:via-background dark:to-amber-950/20" />
      <div className="relative container">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-5">
            <Sparkles className="h-4 w-4" />
            Affiliate Program
          </div>
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-4">
            <EditableText pageKey="home" field="affiliate_title" defaultValue="Become a Cabinet Dealz Affiliate">
              {(v) => <>{v}</>}
            </EditableText>
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            <EditableText pageKey="home" field="affiliate_subtitle" defaultValue="Launch your own branded kitchen & bath storefront — backed by the full Cabinet Dealz product catalog, trade pricing, and fulfillment network. Zero inventory. Zero risk. Maximum earning potential." multiline>
              {(v) => <>{v}</>}
            </EditableText>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 mb-12">
          {advantages.map((adv) => (
            <div key={adv.title} className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mb-3">
                <adv.icon className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">{adv.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{adv.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/affiliate">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 px-8 py-6 text-base">
              Start Your Affiliate Storefront
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-3">
            <EditableText pageKey="home" field="affiliate_note" defaultValue="Free to join. No upfront costs. Start earning from day one.">
              {(v) => <>{v}</>}
            </EditableText>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Platform Features ────────────────────────────────────────────────────────

function PlatformFeatures() {
  const { t } = useLanguage();
  const features = [
    { icon: Palette, title: t("home_feat_switcher_t"), description: t("home_feat_switcher_d") },
    { icon: Ruler, title: t("home_feat_design_t"), description: t("home_feat_design_d") },
    { icon: FileSpreadsheet, title: t("home_feat_csv_t"), description: t("home_feat_csv_d") },
    { icon: Grid3X3, title: t("home_feat_ocr_t"), description: t("home_feat_ocr_d") },
  ];

  return (
    <section className="py-16 md:py-20">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-wood)] mb-4">
              <span className="h-px w-8 bg-[var(--color-wood)]" />
              {t("home_feat_eyebrow")}
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("home_feat_title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t("home_feat_sub")}
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((f) => (
                <div key={f.title} className="flex gap-3">
                  <div className="shrink-0 mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground mb-0.5">{f.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{f.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link href="/order/new">
                <Button size="lg" className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 gap-2">
                  {t("home_feat_build_cta")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                {t("home_feat_build_note")}
              </p>
            </div>
          </div>

          {/* Visual mockup */}
          <div className="relative">
            <div className="rounded-2xl bg-[var(--color-navy)] p-6 text-white">
              <div className="text-xs text-white/50 mb-3 font-mono">PRICE BY DOOR STYLE</div>
              <div className="space-y-3">
                {[
                  { name: "Shaker White", style: "Shaker", price: "$194.50" },
                  { name: "Frost White", style: "Raised Panel", price: "$218.40" },
                  { name: "Graphite", style: "Contemporary Slab", price: "$249.94" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-lg p-3 ${i === 0 ? "bg-[var(--color-gold)]/20 border border-[var(--color-gold)]/30" : "bg-white/5"}`}>
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-white/50">{item.style}</div>
                    </div>
                    <div className={`text-lg font-bold ${i === 0 ? "text-[var(--color-gold)]" : "text-white/70"}`}>
                      {item.price}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-white/40 text-center">B24 — 24" Double Door Base Cabinet · {t("home_stat_trade")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-[var(--color-navy)] text-white/70">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-gold)] text-[var(--color-navy)] font-bold text-xs">
                CD
              </div>
              <span className="font-serif text-lg font-bold text-white">
                Cabinet<span className="text-[var(--color-gold)]">Dealz</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              {t("home_footer_blurb")}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{t("home_footer_col_tools")}</div>
            <ul className="space-y-2 text-sm">
              {[
                { label: t("nav_shop_by_style"), href: "/styles" },
                { label: t("nav_design_tool"), href: "/design" },
                { label: t("nav_build_an_order"), href: "/bulk-order" },
                { label: t("nav_photo_to_cart"), href: "/photo-to-cart" },
                { label: "Surfaces & Fixtures", href: "/surfaces" },
                { label: "Plumber's Choice", href: "/plumbers-choice" },
                { label: "StoneCreek", href: "/stonecreek" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{t("home_footer_col_portals")}</div>
            <ul className="space-y-2 text-sm">
              {[
                { label: t("nav_supplier_portal"), href: "/distributor" },
                { label: "Become a Vendor / Supplier", href: "/become-a-vendor" },
                { label: t("home_aud_affiliates_cta"), href: "/affiliate" },
                { label: t("nav_admin"), href: "/admin" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Cabinet Dealz. {t("footer_rights")}</span>
          <span>{t("home_footer_members_only")}</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────

export default function Home() {
  const { t, lang } = useLanguage();
  const seoOrigin = typeof window === "undefined" ? "https://www.cabinetdealz.com" : window.location.origin;
  useSeo({
    title: t("seo_home_t"),
    description: t("seo_home_d"),
    lang,
    canonical: `${seoOrigin}/`,
    jsonLd: buildMainSiteJsonLd(seoOrigin),
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      toast.error("Sign-in didn't complete. Please try again.");
      params.delete("auth_error");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <StorefrontBanner />
      <AuthenticatedWelcomeBanner />
      <Hero />
      <AboutYourKitchen />
      <FeaturedStyles />
      <ProductShowcase />
      <AffiliatePromo />
      <Footer />
    </div>
  );
}
import { PackageOpen } from "lucide-react";
