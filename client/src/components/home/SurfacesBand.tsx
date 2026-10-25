import { Link } from "wouter";
import { ArrowRight, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  PELICAN_STOREFRONT_CATEGORIES,
  CATEGORY_BLURB,
  CATEGORY_GRADIENT,
  categorySlug,
} from "@/lib/pelican";

// Short display labels for the homepage cards (the raw category names are long).
const SHORT_LABEL: Record<string, string> = {
  "Quartz Slabs (Countertops)": "Quartz Slabs",
  Flooring: "Flooring",
  "Tile & Mosaic": "Tile & Mosaic",
  "Sinks & Faucets": "Sinks & Faucets",
  "Shower & Bath": "Shower & Bath",
  "Toilets & Bidets": "Toilets & Bidets",
};

/**
 * Homepage promo band for the Pelican "Surfaces & Fixtures" storefront.
 * The landing page (/) does NOT render the shared TopNav, so this band is the
 * primary way shoppers discover Surfaces from the home screen.
 */
export function SurfacesBand() {
  const { data: categories } = trpc.pelican.categories.useQuery({ scope: "catalog" });
  const countFor = (name: string) =>
    categories?.find((c) => c.category === name)?.count ?? null;

  return (
    <section className="py-16 md:py-20 bg-muted/30">
      <div className="container">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Waves className="h-3.5 w-3.5 text-[var(--color-gold)]" />
              Surfaces &amp; Fixtures
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
              Complete the kitchen &amp; bath
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Beyond cabinets — quartz countertops, flooring, tile, sinks, faucets, and bath
              fixtures from Pelican Surfaces, priced with your member markups.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/design-surfaces">
              <Button className="gap-2 bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90">
                Build your kitchen
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/surfaces">
              <Button
                variant="outline"
                className="gap-2 border-[var(--color-navy)]/25 text-[var(--color-navy)] hover:bg-[var(--color-navy)]/5 dark:border-white/25 dark:text-white"
              >
                Browse Surfaces &amp; Fixtures
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PELICAN_STOREFRONT_CATEGORIES.map((cat) => {
            const count = countFor(cat);
            return (
              <Link key={cat} href={`/surfaces/${categorySlug(cat)}`}>
                <div className="group overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
                  <div
                    className="h-20 w-full"
                    style={{ background: CATEGORY_GRADIENT[cat] }}
                    aria-hidden
                  />
                  <div className="p-3">
                    <div className="font-serif text-base font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                      {SHORT_LABEL[cat] ?? cat}
                    </div>
                    <div className="text-xs text-muted-foreground leading-snug mt-1 hidden md:block line-clamp-2">
                      {CATEGORY_BLURB[cat]}
                    </div>
                    {count != null && count > 0 && (
                      <div className="mt-2 text-[11px] font-medium text-muted-foreground/80">
                        {count} option{count === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
