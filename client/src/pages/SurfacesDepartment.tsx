import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/useSeo";
import {
  CATEGORY_GRADIENT,
  pelicanDepartmentFromSlug,
  pelicanFamilyHref,
} from "@/lib/pelican";
import { ArrowLeft, ArrowRight, Layers3, Waves } from "lucide-react";

export default function SurfacesDepartment({ departmentSlug, affiliateSlug }: { departmentSlug: string; affiliateSlug?: string }) {
  const department = pelicanDepartmentFromSlug(departmentSlug);
  const { data: categories, isLoading } = trpc.pelican.categories.useQuery({ scope: "catalog" });
  const available = new Set((categories ?? []).map((category) => category.category));
  const families = department?.families.filter((family) => available.has(family.category)) ?? [];

  useSeo({
    title: department
      ? `${department.title} — Surfaces & Fixtures | Cabinet Dealz`
      : "Surfaces & Fixtures | Cabinet Dealz",
    description: department?.description,
  });

  if (!department) {
    return (
      <div className="container py-16 text-center">
        <Waves className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Department not found</h1>
        <p className="mt-2 text-muted-foreground">That Pelican department does not exist.</p>
        <Link href={affiliateSlug ? `/store/${affiliateSlug}/surfaces` : "/surfaces"}><Button className="mt-5 gap-2"><ArrowLeft className="h-4 w-4" /> Back to Surfaces</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-muted/40">
        <div className="container py-8">
          <Link href={affiliateSlug ? `/store/${affiliateSlug}/surfaces` : "/surfaces"}>
            <button className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All Surfaces & Fixtures
            </button>
          </Link>
          <div className="flex max-w-3xl items-start gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-[var(--color-gold)]"><Layers3 className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pelican surfaces & fixtures</p>
              <h1 className="mt-1 font-serif text-3xl font-bold">{department.title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{department.description}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        <div className="mb-6 max-w-2xl">
          <h2 className="font-serif text-2xl font-bold">Choose a product family</h2>
          <p className="mt-1 text-sm text-muted-foreground">Product codes, pricing, and source details remain available on every item.</p>
        </div>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {department.families.map((family) => <Skeleton key={family.title} className="h-44 w-full rounded-xl" />)}
          </div>
        ) : families.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">This department is being updated. Please check back shortly.</Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {families.map((family) => (
              <Link key={`${family.category}-${family.subCategory ?? "all"}`} href={affiliateSlug ? pelicanFamilyHref(family).replace("/surfaces", `/store/${affiliateSlug}/surfaces`) : pelicanFamilyHref(family)}>
                <Card className="group h-full border-border/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="h-1.5 w-14 rounded-full" style={{ background: CATEGORY_GRADIENT[family.category] }} />
                  <h3 className="mt-4 text-lg font-bold">{family.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{family.description}</p>
                  <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-navy)] dark:text-foreground">
                    Browse products <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
