import { Link } from "wouter";
import { ArrowRight, Compass, LayoutTemplate, PackageOpen, Palette, Ruler, Send } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { KITCHEN_SCENES, type KitchenSceneKey } from "@/lib/doorFamilyPhotos";
import { useSeo } from "@/hooks/useSeo";
import { buildKitchenDiscoveryJsonLd } from "@/lib/seo/jsonLd";
import { trpc } from "@/lib/trpc";

type KitchenDiscoveryProps = {
  affiliateSlug?: string;
};

const KITCHEN_PATHS: Array<{
  name: string;
  detail: string;
  scene: KitchenSceneKey;
}> = [
  {
    name: "Bright Shaker",
    detail: "A clean, flexible starting point for a complete kitchen plan.",
    scene: "shaker-white",
  },
  {
    name: "Painted & Contemporary",
    detail: "Explore cool-toned and streamlined kitchen directions before choosing a cabinet line.",
    scene: "shaker-gray",
  },
  {
    name: "Warm & Traditional",
    detail: "Compare rich wood and raised-panel looks as part of a complete kitchen concept.",
    scene: "raised-cherry",
  },
];

const KITCHEN_FAQS = [
  {
    question: "How do I start planning a complete kitchen?",
    answer: "Start with a kitchen look, then explore a package or build your layout in the kitchen designer.",
  },
  {
    question: "Can I begin with a ready-to-customize kitchen package?",
    answer: "Yes. Kitchen Packages provide a ready-to-customize starting point that you can use before moving into the design process.",
  },
  {
    question: "What should I have before I begin a kitchen design?",
    answer: "You can start with a kitchen style or package. Room measurements help you organize the layout when you open the kitchen designer.",
  },
  {
    question: "When should I request a kitchen quote?",
    answer: "Request a quote after you have selected the kitchen direction, package, or layout you want to discuss for the complete project.",
  },
] as const;

function publicOrigin(): string {
  return typeof window === "undefined" ? "https://www.cabinetdealz.com" : window.location.origin;
}

export default function KitchenDiscovery({ affiliateSlug }: KitchenDiscoveryProps) {
  const affiliate = trpc.affiliates.bySlug.useQuery(
    { slug: affiliateSlug ?? "" },
    { enabled: Boolean(affiliateSlug), retry: false },
  );
  const origin = publicOrigin();
  const basePath = affiliateSlug ? `/store/${affiliateSlug}` : "";
  const canonical = `${origin}${basePath}/kitchens`;
  const storeName = (affiliate.data?.storeName ?? "CabinetDealz").trim().replace(/[.]+$/, "");
  const title = affiliateSlug
    ? `Plan Your Complete Kitchen with ${storeName}`
    : "Plan Your Complete Kitchen";
  const description = affiliateSlug
    ? `Explore kitchen styles, complete package ideas, and a guided design-to-quote path with ${storeName}.`
    : "Explore kitchen styles, complete package ideas, and a guided path from room inspiration to kitchen design and quote.";
  const jsonLd = useMemo(
    () => buildKitchenDiscoveryJsonLd({
      origin,
      path: `${basePath}/kitchens`,
      journeyBasePath: affiliateSlug ? basePath : undefined,
      name: title,
      description,
      faqs: KITCHEN_FAQS.map((faq) => ({ ...faq })),
    }),
    [basePath, description, origin, title],
  );

  useSeo({
    title,
    description,
    siteName: storeName,
    appendSiteName: !affiliateSlug,
    canonical,
    image: KITCHEN_SCENES["shaker-white"],
    jsonLd,
  });

  const designHref = affiliateSlug ? `/design?affiliate=${encodeURIComponent(affiliateSlug)}` : "/design";
  const quoteHref = affiliateSlug ? `${basePath}/order` : "/order/new";
  const styleHref = affiliateSlug ? `${basePath}#shop` : "/styles";
  const bundleHref = affiliateSlug ? `${basePath}/bundles` : "/bundles";

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-[#0a1628] text-white">
        <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:py-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e3b45f]">
              <Compass className="h-4 w-4" aria-hidden="true" /> Start with the whole kitchen
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              Plan the kitchen you want to live in.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Begin with a complete kitchen look, then choose your cabinet line, layout, surfaces, and fixtures. When you are ready, build the plan or request a quote for the full project.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={bundleHref}>
                <Button size="lg" className="w-full gap-2 bg-[#d4a75a] font-semibold text-[#0a1628] hover:bg-[#e3b45f] sm:w-auto">
                  <PackageOpen className="h-4 w-4" aria-hidden="true" /> Explore Kitchen Packages <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={designHref}>
                <Button size="lg" variant="outline" className="w-full gap-2 border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">
                  <Ruler className="h-4 w-4" aria-hidden="true" /> Design My Kitchen
                </Button>
              </Link>
            </div>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
            <img
              src={KITCHEN_SCENES["shaker-white"]}
              alt="A complete bright kitchen with cabinetry, island, countertops, and lighting"
              className="h-[240px] w-full object-cover sm:h-[320px] lg:h-[360px]"
            />
            <figcaption className="flex items-center gap-3 px-5 py-4 text-sm text-slate-200">
              <LayoutTemplate className="h-4 w-4 shrink-0 text-[#e3b45f]" aria-hidden="true" />
              A kitchen plan brings cabinet style, layout, surfaces, fixtures, and delivery together.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-border py-12 sm:py-16">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Choose a direction</p>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Start with the room, not a single cabinet.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">Use these complete-kitchen looks to narrow the door style and finish that fit your project. You can compare cabinet lines afterward with the full room in mind.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {KITCHEN_PATHS.map((path) => (
              <article key={path.name} className="overflow-hidden rounded-xl border border-border bg-card">
                <img src={KITCHEN_SCENES[path.scene]} alt={`${path.name} complete kitchen inspiration`} className="h-[210px] w-full object-cover" />
                <div className="p-5">
                  <h3 className="font-serif text-xl font-bold">{path.name}</h3>
                  <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-muted-foreground">{path.detail}</p>
                  <Link href={styleHref} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                    Explore cabinet styles <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/35 py-12 sm:py-16">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="border-t-2 border-primary pt-5">
              <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-2xl font-bold">1. Choose your look</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Browse door styles and finishes through real room scenes before building a cabinet list.</p>
              <Link href={styleHref} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Browse styles <ArrowRight className="h-4 w-4" /></Link>
            </article>
            <article className="border-t-2 border-primary pt-5">
              <PackageOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-2xl font-bold">2. Start with a package or layout</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use a ready-to-customize kitchen package, or begin your own layout in the 3D Designer.</p>
              <Link href={bundleHref} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">View packages <ArrowRight className="h-4 w-4" /></Link>
            </article>
            <article className="border-t-2 border-primary pt-5">
              <Send className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-2xl font-bold">3. Build the complete quote</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Bring cabinets, surfaces, fixtures, and delivery information into one complete kitchen request.</p>
              <Link href={quoteHref} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Request a kitchen quote <ArrowRight className="h-4 w-4" /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-12 sm:py-16">
        <div className="container flex flex-col items-start justify-between gap-6 rounded-2xl bg-[#12305a] px-6 py-8 text-white sm:px-9 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl font-bold">Have room measurements? Start your kitchen plan.</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">The designer helps organize a complete layout before you request a quote.</p>
          </div>
          <Link href={designHref}>
            <Button size="lg" className="gap-2 bg-[#d4a75a] font-semibold text-[#0a1628] hover:bg-[#e3b45f]">
              <Ruler className="h-4 w-4" /> Open Kitchen Designer <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-muted/35 py-12 sm:py-16" aria-labelledby="kitchen-questions-title">
        <div className="container max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Kitchen planning answers</p>
          <h2 id="kitchen-questions-title" className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Questions people ask before planning a kitchen.</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {KITCHEN_FAQS.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-10 font-serif text-xl font-bold marker:hidden">
                  {faq.question}
                  <span className="float-right text-primary transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
