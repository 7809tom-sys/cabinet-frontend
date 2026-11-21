// ─── Distributor Preview (demo) ──────────────────────────────────────────────
// An example distributor website, modelled on the affiliate template preview
// (/store-preview/:template → StorefrontPreview). Tom emails this page to
// prospective distributors as "we can make your website like this".
// Accessible at /distributor-preview/:section. Everything on this page is
// placeholder data from @/lib/demoDistributor: no database reads or writes.
//
// Sections:
//   storefront — pitch banner, three-line hero, full catalog per line
//                (line → Bases / Walls / Talls / Specialties → sub-type) and
//                the shared Sinks & Faucets set with sink-base compatibility
//   dashboard  — sample back office: orders, leads, affiliates, labor, CRM
//   signup     — terms summary + CTA into the existing vendor application
// The designer lives at /distributor-preview/design (DistributorDesignerShell
// around the unchanged DesignTool, mounted from App.tsx);
// /distributor-preview/designer redirects there.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { ArrowRight, CheckCircle2, Droplets, FileSpreadsheet, LayoutDashboard, PenTool, Store, Users, Wrench, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSeo } from "@/hooks/useSeo";
import {
  DEMO_AFFILIATES,
  DEMO_BRAND_NAME,
  DEMO_CATALOG,
  DEMO_COMMISSION_RATE,
  DEMO_CRM_ACTIVITY,
  DEMO_DESIGNER_LABEL,
  DEMO_DISTRIBUTOR,
  DEMO_FAUCETS,
  DEMO_LABOR,
  DEMO_LEADS,
  DEMO_LINES,
  DEMO_ORDERS,
  DEMO_SHARE,
  DEMO_SINKS,
  DEMO_SINK_ACCESSORIES,
  DISTRIBUTOR_COMMISSION_RANGE,
  demoCommissionCents,
  demoDesignerPath,
  demoLineScene,
  demoSinkBaseCompatibility,
  filterCatalogForDistributor,
  formatPercent,
  formatUsd,
  groupLineProducts,
  isDemoLineId,
  isDistributorPreviewSection,
  productsForLine,
  summarizeDemoOrders,
  type DemoLine,
  type DemoLineId,
  type DemoProduct,
} from "@/lib/demoDistributor";

export const DISTRIBUTOR_PREVIEW_NAV = [
  { id: "storefront", label: "Storefront", href: "/distributor-preview/storefront" },
  { id: "design", label: DEMO_DESIGNER_LABEL, href: "/distributor-preview/design" },
  { id: "dashboard", label: "Back Office", href: "/distributor-preview/dashboard" },
  { id: "signup", label: "Become a Distributor", href: "/distributor-preview/signup" },
] as const;

type NavId = (typeof DISTRIBUTOR_PREVIEW_NAV)[number]["id"];
type PageSection = "storefront" | "dashboard" | "signup";


const COMMISSION_RANGE_LABEL = `${formatPercent(DISTRIBUTOR_COMMISSION_RANGE.min)}–${formatPercent(DISTRIBUTOR_COMMISSION_RANGE.max)}`;

export const PITCH_COPY = {
  eyebrow: "Example distributor website",
  headline: "We can build a site like this for your distributorship.",
  body: "This is a working example of the website Cabinet Deals can build for a cabinet distributor: your brand, your full catalog, your own 3D designer, and leads and orders that come straight to you. Everything below uses demo data.",
  cta: "Get a site like this",
} as const;

export const HERO_COPY = {
  headline: "Three cabinet lines. One place to design and order.",
  body: "Browse every base, wall, tall and specialty cabinet in each line, then plan the whole kitchen in 3D.",
  cta: "Start your design",
} as const;

function useDistributorPreviewSeo() {
  useSeo({
    title: DEMO_SHARE.title,
    description: DEMO_SHARE.description,
    siteName: DEMO_BRAND_NAME,
    appendSiteName: false,
    image: DEMO_SHARE.image,
    canonical: DEMO_SHARE.url,
  });
}

/** Sticky preview bar shared by every demo page, including the designer. */
export function DistributorPreviewBanner({ active }: { active: NavId }) {
  return (
    <div className="sticky top-0 z-[100] bg-[#1a2b4a] text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        <span className="text-xs sm:text-sm font-medium truncate">
          <span className="text-[#c9a227] font-semibold">{DEMO_BRAND_NAME}</span>
        </span>
        <span className="text-[10px] sm:text-xs bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/30 rounded px-2 py-0.5">
          Demo Data
        </span>
      </div>
      <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Distributor demo sections">
        {DISTRIBUTOR_PREVIEW_NAV.map((item) => (
          <Link key={item.id} href={item.href}>
            <button
              aria-current={item.id === active ? "page" : undefined}
              className={
                item.id === active
                  ? "text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border border-[#c9a227] bg-[#c9a227] text-[#1a2b4a] font-semibold"
                  : "text-[11px] sm:text-xs text-white/75 hover:text-white px-2 sm:px-2.5 py-1 rounded border border-white/20 hover:border-white/50 transition-colors"
              }
            >
              {item.label}
            </button>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function DistributorPreview({ section }: { section?: string }) {
  const id: PageSection = isDistributorPreviewSection(section) ? section : "storefront";
  useDistributorPreviewSeo();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DistributorPreviewBanner active={id} />
      <DemoDistributorHeader />

      <main className="flex-1">
        {id === "storefront" && <StorefrontSection />}
        {id === "dashboard" && <DashboardSection />}
        {id === "signup" && <SignupSection />}
      </main>

      <DemoFooter />
    </div>
  );
}

function DemoFooter() {
  return (
    <footer className="border-t py-6 px-4 text-center text-xs text-muted-foreground">
      Demo only. {DEMO_BRAND_NAME}, its products, prices, orders, leads and partners are placeholders, not real records. Prices are demo placeholders, not quotes.
    </footer>
  );
}

function DemoDistributorHeader() {
  return (
    <header className="border-b" style={{ borderColor: `${DEMO_DISTRIBUTOR.primaryColor}33` }}>
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
        <Link href="/distributor-preview" className="flex items-center gap-3">
            <img src={DEMO_DISTRIBUTOR.logoUrl} alt={`${DEMO_BRAND_NAME} logo (placeholder)`} className="h-10 sm:h-12 w-auto" />
            <div className="hidden md:block">
              <p className="text-sm text-muted-foreground">{DEMO_DISTRIBUTOR.tagline}</p>
              <p className="text-xs text-muted-foreground">{DEMO_DISTRIBUTOR.sampleStoreUrl} · sample address</p>
            </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={demoDesignerPath()}>
            <Button size="sm" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} className="text-white">
              {HERO_COPY.cta}
            </Button>
          </Link>
          <Link href="/distributor-preview/signup">
            <Button size="sm" variant="outline">{PITCH_COPY.cta}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Storefront: pitch, hero, full catalog per line ──────────────────────────

function lineFromSearch(search: string): DemoLineId {
  const value = new URLSearchParams(search).get("line");
  return isDemoLineId(value) ? value : DEMO_LINES[0].id;
}

function shopHref(lineId: DemoLineId): string {
  return `/distributor-preview/storefront?line=${lineId}#catalog`;
}

function StorefrontSection() {
  const search = useSearch();
  const [lineId, setLineId] = useState<DemoLineId>(() => lineFromSearch(search));
  useEffect(() => {
    setLineId(lineFromSearch(search));
    // "Shop <line>" links land on the catalog for that line.
    if (typeof window !== "undefined" && window.location.hash === "#catalog") {
      window.requestAnimationFrame(() => document.getElementById("catalog")?.scrollIntoView({ block: "start" }));
    }
  }, [search]);

  return (
    <div>
      <PitchBanner />
      <LinesHero />
      <CatalogBrowser lineId={lineId} onLineChange={setLineId} />
      <SinksAndFaucetsSection />
    </div>
  );
}

function PitchBanner() {
  return (
    <section className="border-b bg-[#fdf6ec]" aria-label="About this example">
      <div className="container flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>{PITCH_COPY.eyebrow}</p>
          <h2 className="text-lg sm:text-xl font-semibold">{PITCH_COPY.headline}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{PITCH_COPY.body}</p>
        </div>
        <Link href="/distributor-preview/signup">
          <Button className="shrink-0 gap-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>
            {PITCH_COPY.cta} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function LinesHero() {
  return (
    <section className="py-10 sm:py-14 text-white" style={{ background: `linear-gradient(135deg, ${DEMO_DISTRIBUTOR.primaryColor}, #163b45)` }}>
      <div className="container space-y-8">
        <div className="space-y-3 text-center">
          <Badge className="bg-white/15 text-white border-white/30">Demo storefront</Badge>
          <h1 className="text-2xl sm:text-4xl font-bold">{HERO_COPY.headline}</h1>
          <p className="mx-auto max-w-2xl text-white/85">{HERO_COPY.body}</p>
          <Link href={demoDesignerPath()}>
            <Button size="lg" className="mt-2 gap-2 font-semibold" style={{ backgroundColor: DEMO_DISTRIBUTOR.accentColor, color: "#1a2b4a" }}>
              {HERO_COPY.cta} <PenTool className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {DEMO_LINES.map((line) => <LineCard key={line.id} line={line} />)}
        </div>
      </div>
    </section>
  );
}

function LineCard({ line }: { line: DemoLine }) {
  const count = productsForLine(line.id).length;
  return (
    <article className="overflow-hidden rounded-xl bg-white text-foreground shadow-lg">
      <div className="relative aspect-[16/10] bg-muted">
        <img src={demoLineScene(line)} alt={`${line.name} kitchen (example photo)`} className="h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold">
          <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: line.swatch }} />
          {line.name}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold">{line.headline}</h3>
          <p className="text-sm text-muted-foreground">{line.copy}</p>
          <p className="mt-1 text-xs text-muted-foreground">{count} cabinets and parts in this line</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={shopHref(line.id)}>
            <Button size="sm" variant="outline">Shop {line.name}</Button>
          </Link>
          <Link href={demoDesignerPath(line.id)}>
            <Button size="sm" className="text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>Design with {line.name}</Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

function dims(p: DemoProduct): string {
  const parts = [p.widthIn, p.heightIn, p.depthIn].map((n) => (n == null ? "–" : String(Number(n.toFixed(2)))));
  return `${parts.join(" × ")} in`;
}

function CatalogBrowser({ lineId, onLineChange }: { lineId: DemoLineId; onLineChange: (id: DemoLineId) => void }) {
  const line = DEMO_LINES.find((l) => l.id === lineId) ?? DEMO_LINES[0];
  const products = useMemo(() => productsForLine(line.id), [line.id]);
  const sections = useMemo(() => groupLineProducts(products), [products]);
  const hiddenCount = DEMO_CATALOG.length - filterCatalogForDistributor(DEMO_CATALOG, DEMO_DISTRIBUTOR.id).length;

  return (
    <section className="container py-10 space-y-6 scroll-mt-28" id="catalog">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Full catalog by line</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} cabinets and parts in {line.name}, grouped by type. {hiddenCount} products from other suppliers are hidden on this storefront. Demo prices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cabinet line">
          {DEMO_LINES.map((l) => (
            <Button
              key={l.id}
              size="sm"
              role="tab"
              aria-selected={l.id === line.id}
              variant={l.id === line.id ? "default" : "outline"}
              onClick={() => onLineChange(l.id)}
              className="gap-2"
            >
              <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: l.swatch }} />
              {l.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <details key={section.group} open={index === 0} className="rounded-lg border bg-card" data-group={section.group}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold">
              <span>{line.name} · {section.group}</span>
              <Badge variant="outline">{section.count}</Badge>
            </summary>
            <div className="space-y-5 border-t px-4 py-4">
              {section.subTypes.map((sub) => (
                <div key={sub.name} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">{sub.name} <span className="font-normal">({sub.products.length})</span></h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sub.products.map((p) => (
                      <div key={`${p.lineId}-${p.sku}`} className="flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold">{p.sku}</p>
                          <p className="truncate text-xs text-muted-foreground" title={p.name}>{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{dims(p)}</p>
                        </div>
                        <span className="shrink-0 font-medium">{formatUsd(p.priceCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function SinksAndFaucetsSection() {
  const compatibility = useMemo(() => demoSinkBaseCompatibility(), []);
  const kitchen = compatibility.filter((c) => c.faucets.length > 0 || c.defaultSink);
  return (
    <section className="container pb-12 space-y-4" id="sinks-faucets">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><Droplets className="h-5 w-5" aria-hidden /> Sinks &amp; Faucets</h2>
        <p className="text-sm text-muted-foreground">
          Shared by all three lines: {DEMO_SINKS.length} sinks, {DEMO_FAUCETS.length} faucets and {DEMO_SINK_ACCESSORIES.length} sink and faucet accessories.
          The table shows what fits each sink base under the designer's sink-base rules. Demo prices.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sink base</TableHead>
              <TableHead className="text-right">Sinks that fit</TableHead>
              <TableHead className="text-right">Faucets that fit</TableHead>
              <TableHead>Auto Design sink pick</TableHead>
              <TableHead>Auto Design faucet pick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compatibility.map((c) => (
              <TableRow key={c.baseCode}>
                <TableCell>
                  <p className="font-medium">{c.baseCode}</p>
                  <p className="text-xs text-muted-foreground">{c.baseName}</p>
                </TableCell>
                <TableCell className="text-right">{c.sinks.length}</TableCell>
                <TableCell className="text-right">{c.faucets.length}</TableCell>
                <TableCell className="text-xs">{c.defaultSink ? `${c.defaultSink.pelicanCode ?? c.defaultSink.name}${c.defaultSink.sellPrice != null ? ` · ${formatUsd(Math.round(c.defaultSink.sellPrice * 100))}` : ""}` : "—"}</TableCell>
                <TableCell className="text-xs">{c.defaultFaucet ? `${c.defaultFaucet.pelicanCode ?? c.defaultFaucet.name}${c.defaultFaucet.sellPrice != null ? ` · ${formatUsd(Math.round(c.defaultFaucet.sellPrice * 100))}` : ""}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{kitchen.length} kitchen sink bases have a faucet match. Vanity sink bases take vanity basins.</p>
    </section>
  );
}

// ─── Designer shell: wraps the unchanged DesignTool at /distributor-preview/design ──

export function DistributorDesignerShell({ children }: { children: ReactNode }) {
  const search = useSearch();
  const lineParam = new URLSearchParams(search).get("line");
  const line = isDemoLineId(lineParam) ? DEMO_LINES.find((l) => l.id === lineParam) ?? null : null;
  useDistributorPreviewSeo();

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <DistributorPreviewBanner active="design" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 sm:px-4 py-2" style={{ borderBottomColor: DEMO_DISTRIBUTOR.accentColor, borderBottomWidth: 2 }}>
        <div className="flex items-center gap-2 min-w-0">
          <img src={DEMO_DISTRIBUTOR.logoUrl} alt={`${DEMO_BRAND_NAME} logo (placeholder)`} className="h-7 sm:h-8 w-auto" />
          <h1 className="text-sm sm:text-base font-semibold truncate" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>{DEMO_DESIGNER_LABEL}</h1>
          {line ? <Badge variant="outline" className="hidden sm:inline-flex">Line: {line.name}</Badge> : null}
        </div>
        <p className="text-[11px] text-muted-foreground max-w-xl">
          Demo: the designer below uses the live Cabinet Deals catalog and door styles, not the demo line data.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ─── Back office dashboard with demo data ────────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Store; children: ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="h-4 w-4" style={{ color: DEMO_DISTRIBUTOR.primaryColor }} aria-hidden />
      {children}
    </CardTitle>
  );
}

function DashboardSection() {
  const summary = summarizeDemoOrders(DEMO_ORDERS);
  const openLeads = DEMO_LEADS.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const activeAffiliates = DEMO_AFFILIATES.filter((a) => a.status === "Active");

  return (
    <section className="container py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6" aria-hidden /> {DEMO_DISTRIBUTOR.name} back office
          </h1>
          <p className="text-sm text-muted-foreground">Sample dashboard. Every number below is demo data.</p>
        </div>
        <Badge className="bg-[#c9a227]/20 text-[#7a5f10] border border-[#c9a227]/40">Demo Data</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders (30 days)" value={String(summary.count)} hint={formatUsd(summary.totalCents)} />
        <Stat label="Designer-assisted sales" value={formatUsd(summary.designerCents)} hint={`Platform commission at ${formatPercent(DEMO_COMMISSION_RATE)}: ${formatUsd(summary.commissionCents)}`} />
        <Stat label="Direct CSV orders" value={formatUsd(summary.csvCents)} hint="No commission" />
        <Stat label="Open leads" value={String(openLeads.length)} hint={`${activeAffiliates.length} active affiliates`} />
      </div>

      <Card>
        <CardHeader><SectionTitle icon={FileSpreadsheet}>Orders</SectionTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_ORDERS.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.id}</TableCell>
                  <TableCell>{o.date}</TableCell>
                  <TableCell>{o.customer}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.channel === "designer" ? "3D designer" : "Direct CSV"}</Badge>
                  </TableCell>
                  <TableCell>{o.status}</TableCell>
                  <TableCell className="text-right">{formatUsd(o.totalCents)}</TableCell>
                  <TableCell className="text-right">{formatUsd(demoCommissionCents(o.totalCents, o.channel))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><SectionTitle icon={Contact}>Leads</SectionTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Estimate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_LEADS.map((l) => (
                  <TableRow key={l.name}>
                    <TableCell>
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.project}</p>
                    </TableCell>
                    <TableCell>{l.source}</TableCell>
                    <TableCell><Badge variant="outline">{l.stage}</Badge></TableCell>
                    <TableCell className="text-right">{formatUsd(l.estimateCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><SectionTitle icon={Users}>Affiliates (distributor-owned)</SectionTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_AFFILIATES.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                    <TableCell className="text-right">{a.orders}</TableCell>
                    <TableCell className="text-right">{formatUsd(a.salesCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><SectionTitle icon={Wrench}>Labor analytics</SectionTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Avg hours</TableHead>
                  <TableHead className="text-right">Avg rate / hr</TableHead>
                  <TableHead className="text-right">Avg per job</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_LABOR.map((row) => (
                  <TableRow key={row.task}>
                    <TableCell className="font-medium">{row.task}</TableCell>
                    <TableCell className="text-right">{row.jobs}</TableCell>
                    <TableCell className="text-right">{row.avgHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{formatUsd(row.avgRateCents)}</TableCell>
                    <TableCell className="text-right">{formatUsd(Math.round(row.avgHours * row.avgRateCents))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><SectionTitle icon={Contact}>CRM activity</SectionTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {DEMO_CRM_ACTIVITY.map((item) => (
                <li key={`${item.when}-${item.who}`} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DEMO_DISTRIBUTOR.accentColor }} />
                  <div>
                    <p><span className="font-medium">{item.who}</span> · {item.what}</p>
                    <p className="text-xs text-muted-foreground">{item.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ─── 4) Signup call to action ────────────────────────────────────────────────

function SignupSection() {
  const [agreed, setAgreed] = useState(false);
  return (
    <section className="container py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Get your own branded distributor storefront</h1>
          <p className="text-muted-foreground">
            Your logo, your colors, your cabinet lines, and the CabinetDealz 3D designer, on your own storefront address.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Store, title: "Branded storefront", body: "Only your lines, under your name." },
            { icon: PenTool, title: "3D designer", body: "Customers design and price in your store." },
            { icon: LayoutDashboard, title: "Back office", body: "Orders, leads, affiliates, labor and CRM." },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="p-4 space-y-1 text-center">
                <Icon className="mx-auto h-6 w-6" style={{ color: DEMO_DISTRIBUTOR.primaryColor }} aria-hidden />
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Distributor terms (summary)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                <span><strong>Designer-assisted orders:</strong> a {COMMISSION_RANGE_LABEL} commission applies to orders built in the 3D designer. The exact rate is set in your distributor agreement.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                <span><strong>Direct CSV orders:</strong> no commission on orders you upload directly by CSV.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                <span><strong>Your storefront:</strong> we set up your branded store with your logo, colors and products after your application is approved.</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              This is a summary. The full distributor agreement is sent for e-signature before your storefront goes live.
            </p>
            <div className="flex items-start gap-2 rounded border p-3">
              <Checkbox id="distributor-terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <Label htmlFor="distributor-terms" className="text-sm font-normal leading-snug">
                I have read the distributor terms summary, including the {COMMISSION_RANGE_LABEL} commission on designer-assisted orders and no commission on direct CSV orders.
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {agreed ? (
                <Link href="/become-a-vendor?type=distributor">
                  <Button className="gap-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>
                    Continue to distributor application <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button disabled className="gap-2">
                  Continue to distributor application <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Opens the vendor and distributor application form.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
