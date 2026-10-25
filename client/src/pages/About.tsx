import { Link } from "wouter";
import { ArrowRight, Compass, Handshake, LayoutPanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLATFORM_AREAS = [
  {
    icon: LayoutPanelTop,
    title: "Explore the catalog",
    description: "Browse cabinet styles and related kitchen products in one organized place before you begin a design.",
  },
  {
    icon: Compass,
    title: "Plan with confidence",
    description: "Use the kitchen design tools to explore a layout, review selections, and prepare for a conversation with a cabinet professional.",
  },
  {
    icon: Handshake,
    title: "Work through a local network",
    description: "Cabinet Dealz supports the affiliate and dealer relationships that help move a project from planning toward an order.",
  },
];

export default function About() {
  return (
    <div className="bg-background">
      <section className="border-b border-border bg-[var(--color-navy)] text-white">
        <div className="container py-16 sm:py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">About Cabinet Dealz</p>
          <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            A practical place to plan a cabinet project.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            Cabinet Dealz brings a cabinet catalog, kitchen design tools, and an affiliate and dealer network together so homeowners and trade professionals can take a project from selection to a supported next step.
          </p>
        </div>
      </section>

      <section className="container py-14 sm:py-18">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">What the platform is for</p>
          <h2 className="mt-3 text-3xl font-bold text-foreground">Clearer choices, connected workflows.</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A kitchen project involves many decisions. Cabinet Dealz is designed to make those decisions easier to organize by keeping product exploration, design activity, and follow-up pathways connected without requiring visitors to start from a blank page.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PLATFORM_AREAS.map(({ icon: Icon, title, description }) => (
            <article key={title} className="border-t-2 border-[var(--color-gold)] pt-5">
              <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/50">
        <div className="container grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-foreground">Start with your project, not a complicated process.</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Browse cabinet options, begin a room layout, or contact Cabinet Dealz when you are ready to discuss a project. The platform is built to help visitors and members work from the same organized information.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Button asChild className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90">
              <Link href="/catalog">Browse Cabinets <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/design">Open 3D Designer</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
