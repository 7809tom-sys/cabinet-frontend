import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/useSeo";
import {
  PELICAN_DEPARTMENTS,
  PELICAN_STOREFRONT_CATEGORIES,
  CATEGORY_GRADIENT,
  categorySlug,
  pelicanCategoryLabel,
} from "@/lib/pelican";
import { ArrowRight, Waves, PencilRuler, Sparkles, Layers3, ChefHat, Bath, ShowerHead } from "lucide-react";
import { EditableText } from "@/components/admin/EditableText";

const DEPARTMENT_ICON = {
  "kitchen-surfaces": Layers3,
  "kitchen-fixtures": ChefHat,
  "bathroom-fixtures": Bath,
  "bath-surfaces-enclosures": ShowerHead,
} as const;

export default function Surfaces({ affiliateSlug }: { affiliateSlug?: string }) {
  useSeo({
    title: "Surfaces & Fixtures — Quartz, Flooring, Tile, Sinks & Baths | Cabinet Dealz",
    description:
      "Shop Pelican surfaces and fixtures: quartz countertops, waterproof flooring, tile & mosaic, sinks, faucets, showers, tubs, toilets and bidets — with trade pricing.",
  });

  // Only departments with one or more visible Pelican catalog categories are shown.
  const { data: categories, isLoading } = trpc.pelican.categories.useQuery({ scope: "catalog" });
  const available = new Set((categories ?? []).map((category) => category.category));
  const visibleDepartments = PELICAN_DEPARTMENTS.filter((department) =>
    department.families.some((family) => available.has(family.category))
  );
  const visibleRawCategories = PELICAN_STOREFRONT_CATEGORIES.filter((category) => available.has(category));

  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-[var(--color-navy)] text-white">
        <div className="container py-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium">
            <Waves className="h-3.5 w-3.5 text-[var(--color-gold)]" /> Surfaces & Fixtures
          </div>
          <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight md:text-5xl">
            <EditableText pageKey="surfaces" field="hero_title" defaultValue="Finish the whole room, not just the cabinets.">
              {(value) => <>{value}</>}
            </EditableText>
          </h1>
          <p className="mt-4 max-w-2xl text-white/70">
            <EditableText pageKey="surfaces" field="hero_subtitle" defaultValue="Quartz countertops, waterproof flooring, tile, sinks, faucets, showers, tubs and more — sourced through Pelican and priced for the trade. Add them straight into your kitchen design or browse by project below." multiline>
              {(value) => <>{value}</>}
            </EditableText>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/design-surfaces">
              <Button className="gap-2 bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90">
                <Sparkles className="h-4 w-4" /> Build your kitchen step by step
              </Button>
            </Link>
            <Link href="/design">
              <Button variant="outline" className="gap-2 border-white/25 bg-white/5 text-white hover:bg-white/10">
                <PencilRuler className="h-4 w-4" /> Open 3D Designer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="mb-6 max-w-2xl">
          <h2 className="font-serif text-2xl font-bold">Shop by room and project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with what you are building, then browse the product family that fits the job.
          </p>
        </div>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PELICAN_DEPARTMENTS.map((department) => <Skeleton key={department.slug} className="h-56 w-full rounded-xl" />)}
          </div>
        ) : visibleDepartments.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">The surfaces catalog is being updated. Please check back shortly.</Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDepartments.map((department) => {
              const Icon = DEPARTMENT_ICON[department.slug];
              const category = department.families[0]?.category ?? "Flooring";
              return (
                <Link key={department.slug} href={affiliateSlug ? `/store/${affiliateSlug}/surfaces/department/${department.slug}` : `/surfaces/department/${department.slug}`}>
                  <Card className="group relative h-56 overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="absolute inset-0" style={{ background: CATEGORY_GRADIENT[category] }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="mb-2 flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-[var(--color-gold)]" />{department.title}</div>
                      <p className="line-clamp-2 text-sm text-white/80">{department.description}</p>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-gold)]">
                        Browse product families <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {!isLoading && visibleRawCategories.length > 0 && (
          <div className="mt-10 border-t border-border/60 pt-6">
            <h3 className="text-sm font-semibold">Browse a full product category</h3>
            <p className="mt-1 text-sm text-muted-foreground">Every existing Pelican category remains available for direct browsing.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleRawCategories.map((category) => (
                <Link key={category} href={affiliateSlug ? `/store/${affiliateSlug}/surfaces/${categorySlug(category)}` : `/surfaces/${categorySlug(category)}`}>
                  <Button size="sm" variant="outline">{pelicanCategoryLabel(category)}</Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
