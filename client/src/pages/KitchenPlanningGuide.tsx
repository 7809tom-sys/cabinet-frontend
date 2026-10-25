import { Link } from "wouter";
import { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutTemplate,
  ReceiptText,
  Ruler,
  Sparkles,
  Triangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KITCHEN_SCENES } from "@/lib/doorFamilyPhotos";
import { useSeo } from "@/hooks/useSeo";
import { buildKitchenDiscoveryJsonLd } from "@/lib/seo/jsonLd";

const PLANNING_FAQS = [
  {
    question: "Where do I start?",
    answer: "Start with how you use the kitchen, not the colors. Think about where you prep, cook, clean up, and store things. Then open the designer and lay out those areas on your walls. Style is the easy part once the layout works.",
  },
  {
    question: "What do I need to measure?",
    answer: "Measure each wall, the ceiling height, and every window, door, and opening from the corner. Note where the sink, range, and refrigerator are now. Rough numbers are fine for the first design; your local store confirms exact measurements before anything is ordered.",
  },
  {
    question: "How long does it take to design my kitchen?",
    answer: "Most people can make a first complete layout in 10 to 15 minutes. There is no download, and you can save the work, return, and change it whenever you are ready.",
  },
  {
    question: "What layout is right for my space?",
    answer: "It depends on your walls: a single wall, galley, L-shape, U-shape, or any of those with an island. The designer lets you try more than one and compare the resulting cabinet plan side by side.",
  },
  {
    question: "What is the kitchen work triangle?",
    answer: "It is the path between the sink, range, and refrigerator. A common planning guideline is 4 to 9 feet for each side of the triangle and 13 to 26 feet total, so you are not crossing the room for every step.",
  },
  {
    question: "How much space do I need between counters or around an island?",
    answer: "Plan on at least 42 inches of walkway for one cook and 48 inches if two people cook together. Also check that dishwasher, oven, and refrigerator doors can open without blocking the walkway.",
  },
  {
    question: "How do I handle the corners?",
    answer: "Corners are where most kitchens lose storage. Choose an easy-reach corner with a lazy Susan, a blind corner, or a diagonal corner. The designer applies the correct cabinet geometry and fillers so the selected corner fits the walls.",
  },
  {
    question: "How do I get enough storage?",
    answer: "Plan deep drawers for pots, a pantry cabinet, a trash pullout next to the sink, and wall cabinets that run toward the ceiling. Decide where everyday items will go before finalizing the layout.",
  },
  {
    question: "Which cabinet style is most popular?",
    answer: "Shaker remains a popular starting point, followed by flat-panel doors. Warm wood tones and two-tone kitchens are also common. You can try door styles and finishes in the designer while you build the layout.",
  },
  {
    question: "When will I know the price?",
    answer: "From the first cabinet you place. The quote and materials list update with each change, including fillers and crown molding where they apply.",
  },
  {
    question: "Can I see it before I buy?",
    answer: "Yes. You can inspect the layout in 3D and work with your local CabinetDealz store on a photo-quality presentation before anything is ordered.",
  },
  {
    question: "Should I do this myself or work with a designer?",
    answer: "Both work well. Build the first plan yourself in minutes, then let your local CabinetDealz store review it with you before ordering to catch anything that may need adjustment.",
  },
] as const;

const STARTING_POINTS = [
  {
    icon: Ruler,
    title: "1. Measure the room",
    description: "Walls, ceiling height, doors, windows, and openings are enough to begin.",
  },
  {
    icon: Triangle,
    title: "2. Set the work zones",
    description: "Place prep, cook, clean-up, and storage around a practical work triangle.",
  },
  {
    icon: LayoutTemplate,
    title: "3. Try the layouts",
    description: "Compare single-wall, galley, L, U, and island options in the same room.",
  },
  {
    icon: ReceiptText,
    title: "4. Review the plan",
    description: "Use the live materials list and quote before asking your local store to review it.",
  },
] as const;

function publicOrigin(): string {
  return typeof window === "undefined" ? "https://www.cabinetdealz.com" : window.location.origin;
}

export default function KitchenPlanningGuide() {
  const origin = publicOrigin();
  const title = "Kitchen Planning Guide";
  const description = "Plan your kitchen with practical answers about measurements, layouts, work triangles, clearances, corners, storage, and the next steps in the CabinetDealz designer.";
  const jsonLd = useMemo(
    () => buildKitchenDiscoveryJsonLd({
      origin,
      path: "/kitchen-planning",
      name: title,
      description,
      faqs: PLANNING_FAQS.map((faq) => ({ ...faq })),
    }),
    [description, origin, title],
  );

  useSeo({
    title,
    description,
    canonical: `${origin}/kitchen-planning`,
    image: KITCHEN_SCENES["shaker-white"],
    jsonLd,
  });

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden bg-[var(--color-navy)] text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 84% 18%, rgba(212,167,90,.45), transparent 24%), linear-gradient(135deg, transparent 0 48%, rgba(255,255,255,.05) 48% 49%, transparent 49%)" }} />
        <div className="container relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:py-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
              <ClipboardList className="h-4 w-4" aria-hidden="true" /> Kitchen planning guide
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Plan your kitchen with confidence.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">Start with your room and the way you live in it. These practical answers make it easier to measure, compare layouts, and build a kitchen plan that works before you choose the finish.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/design"><Button size="lg" className="w-full gap-2 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[#e3b45f] sm:w-auto">Start designing <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/bundles"><Button size="lg" variant="outline" className="w-full gap-2 border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">Browse Kitchen Packages</Button></Link>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-300"><Clock3 className="h-4 w-4 text-[var(--color-gold)]" /> First layouts commonly take about 10–15 minutes.</p>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-2xl">
            <img src={KITCHEN_SCENES["shaker-white"]} alt="A finished kitchen with cabinets, island, and workspace" className="h-[240px] w-full object-cover sm:h-[320px] lg:h-[360px]" />
            <figcaption className="flex items-center gap-3 px-5 py-4 text-sm text-slate-200"><Sparkles className="h-4 w-4 shrink-0 text-[var(--color-gold)]" /> Make the room work first. Door style, surfaces, and price follow the layout.</figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-border bg-muted/35 py-12 sm:py-16" aria-labelledby="planning-start-title">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">A practical starting point</p>
            <h2 id="planning-start-title" className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Build the plan in the order the room needs.</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STARTING_POINTS.map(({ icon: Icon, title: stepTitle, description: stepDescription }) => (
              <article key={stepTitle} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-gold)]/15 text-[var(--color-wood)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-4 font-serif text-xl font-bold">{stepTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stepDescription}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16" aria-labelledby="kitchen-planning-questions">
        <div className="container grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Questions, answered</p>
            <h2 id="kitchen-planning-questions" className="mt-2 font-serif text-3xl font-bold tracking-tight">Planning your kitchen: the questions everyone asks.</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">Use this guide while you sketch, measure, or place the first cabinets in the designer. The numbers are common planning guidelines—not building code or a final field measurement.</p>
            <Link href="/design" className="mt-6 inline-flex"><Button className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">Open the 3D Designer <ArrowRight className="h-4 w-4" /></Button></Link>
          </aside>
          <div className="divide-y divide-border border-y border-border">
            {PLANNING_FAQS.map((faq, index) => (
              <details key={faq.question} className="group py-5" open={index === 0}>
                <summary className="cursor-pointer list-none pr-10 font-serif text-xl font-bold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {faq.question}<span className="float-right text-primary transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-[#12305a] py-12 text-white sm:py-16">
        <div className="container flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 sm:px-9 lg:flex-row lg:items-center">
          <div className="max-w-2xl"><CheckCircle2 className="h-6 w-6 text-[var(--color-gold)]" aria-hidden="true" /><h2 className="mt-3 font-serif text-3xl font-bold">Ready to put the plan on your walls?</h2><p className="mt-2 text-sm leading-relaxed text-white/80">Start with the rough measurements you have. You can revise the layout, style, and cabinet selections as the project develops.</p></div>
          <Link href="/design"><Button size="lg" className="gap-2 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[#e3b45f]">Start designing <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>
    </div>
  );
}
