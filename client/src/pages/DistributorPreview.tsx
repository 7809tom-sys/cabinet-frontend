// ─── Distributor Preview (demo) ──────────────────────────────────────────────
// A sales demo of what a distributor gets on CabinetDealz, modelled on the
// affiliate template preview (/store-preview/:template → StorefrontPreview).
// Accessible at /distributor-preview/:section. Everything on this page is
// placeholder data from @/lib/demoDistributor — no database reads or writes.
//
// Sections:
//   storefront — branded storefront limited to the distributor's own lines
//   designer   — the 3D designer reached through the existing branded
//                /store/:slug/design path (DesignTool itself is untouched)
//   dashboard  — sample back office: orders, leads, affiliates, labor, CRM
//   signup     — terms summary + CTA into the existing vendor application

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Box, CheckCircle2, FileSpreadsheet, LayoutDashboard, PenTool, Store, Users, Wrench, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DEMO_AFFILIATES,
  DEMO_CATALOG,
  DEMO_COMMISSION_RATE,
  DEMO_CRM_ACTIVITY,
  DEMO_DISTRIBUTOR,
  DEMO_DOOR_LINES,
  DEMO_LABOR,
  DEMO_LEADS,
  DEMO_ORDERS,
  DISTRIBUTOR_COMMISSION_RANGE,
  DISTRIBUTOR_PREVIEW_SECTIONS,
  demoCommissionCents,
  demoDesignerPath,
  filterCatalogForDistributor,
  formatPercent,
  formatUsd,
  isDistributorPreviewSection,
  summarizeDemoOrders,
  type DistributorPreviewSection,
} from "@/lib/demoDistributor";

const SECTION_LABELS: Record<DistributorPreviewSection, string> = {
  storefront: "Storefront",
  designer: "3D Designer",
  dashboard: "Back Office",
  signup: "Become a Distributor",
};

const COMMISSION_RANGE_LABEL = `${formatPercent(DISTRIBUTOR_COMMISSION_RANGE.min)}–${formatPercent(DISTRIBUTOR_COMMISSION_RANGE.max)}`;

export default function DistributorPreview({ section }: { section?: string }) {
  const id: DistributorPreviewSection = isDistributorPreviewSection(section) ? section : "storefront";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Preview banner — same pattern as the affiliate template preview */}
      <div className="sticky top-0 z-[100] bg-[#1a2b4a] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin">
            <button className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </button>
          </Link>
          <span className="text-white/40">|</span>
          <span className="text-sm font-medium">
            Distributor Preview:{" "}
            <span className="text-[#c9a227] font-semibold">{DEMO_DISTRIBUTOR.name}</span>
          </span>
          <span className="text-xs bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/30 rounded px-2 py-0.5">
            Demo Data
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Distributor demo sections">
          {DISTRIBUTOR_PREVIEW_SECTIONS.map((s) => (
            <Link key={s} href={`/distributor-preview/${s}`}>
              <button
                aria-current={s === id ? "page" : undefined}
                className={
                  s === id
                    ? "text-xs px-2.5 py-1 rounded border border-[#c9a227] bg-[#c9a227] text-[#1a2b4a] font-semibold"
                    : "text-xs text-white/70 hover:text-white px-2.5 py-1 rounded border border-white/20 hover:border-white/50 transition-colors"
                }
              >
                {SECTION_LABELS[s]}
              </button>
            </Link>
          ))}
        </nav>
      </div>

      <DemoDistributorHeader />

      <main className="flex-1">
        {id === "storefront" && <StorefrontSection />}
        {id === "designer" && <DesignerSection />}
        {id === "dashboard" && <DashboardSection />}
        {id === "signup" && <SignupSection />}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Demo only. {DEMO_DISTRIBUTOR.name}, its products, prices, orders, leads and partners are placeholders, not real records.
      </footer>
    </div>
  );
}

function DemoDistributorHeader() {
  return (
    <header className="border-b" style={{ borderColor: `${DEMO_DISTRIBUTOR.primaryColor}33` }}>
      <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <img src={DEMO_DISTRIBUTOR.logoUrl} alt={`${DEMO_DISTRIBUTOR.name} logo (placeholder)`} className="h-12 w-auto" />
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">{DEMO_DISTRIBUTOR.tagline}</p>
            <p className="text-xs text-muted-foreground">{DEMO_DISTRIBUTOR.sampleStoreUrl} · sample address</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/distributor-preview/designer">
            <Button size="sm" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} className="text-white">
              Design your kitchen
            </Button>
          </Link>
          <Link href="/distributor-preview/signup">
            <Button size="sm" variant="outline">Become a distributor</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── 1) Branded storefront, filtered to the distributor's own products ───────

function StorefrontSection() {
  const products = useMemo(() => filterCatalogForDistributor(DEMO_CATALOG, DEMO_DISTRIBUTOR.id), []);
  const hiddenCount = DEMO_CATALOG.length - products.length;
  const doorLines = DEMO_DOOR_LINES.filter((line) => line.distributorId === DEMO_DISTRIBUTOR.id);
  const [line, setLine] = useState<string>("all");
  const visible = line === "all" ? products : products.filter((p) => p.doorLine === line);

  return (
    <div>
      <section className="py-14 text-white" style={{ background: `linear-gradient(135deg, ${DEMO_DISTRIBUTOR.primaryColor}, #163b45)` }}>
        <div className="container space-y-3">
          <Badge className="bg-white/15 text-white border-white/30">Demo storefront</Badge>
          <h1 className="text-3xl md:text-4xl font-bold">{DEMO_DISTRIBUTOR.name} Cabinet Store</h1>
          <p className="max-w-2xl text-white/85">
            A distributor storefront shows only that distributor's cabinet lines, with its own logo, colors and address.
            Customers design in 3D, get a price, and order, all under the distributor's brand.
          </p>
        </div>
      </section>

      <section className="container py-10 space-y-6" id="shop">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Door lines</h2>
            <p className="text-sm text-muted-foreground">
              {products.length} demo products from {DEMO_DISTRIBUTOR.name}. {hiddenCount} products from other suppliers are hidden on this storefront.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by door line">
            <Button size="sm" variant={line === "all" ? "default" : "outline"} onClick={() => setLine("all")}>All lines</Button>
            {doorLines.map((d) => (
              <Button key={d.id} size="sm" variant={line === d.name ? "default" : "outline"} onClick={() => setLine(d.name)} className="gap-2">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: d.swatch }} />
                {d.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <Card key={p.sku}>
              <CardContent className="p-4 space-y-2">
                <div className="flex h-28 items-center justify-center rounded bg-muted">
                  <Box className="h-10 w-10 text-muted-foreground" aria-hidden />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.sku}</p>
                    <p className="text-sm text-muted-foreground">{p.name}</p>
                  </div>
                  <Badge variant="outline">{p.category}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.doorLine}</span>
                  <span className="font-semibold">{formatUsd(p.priceCents)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Demo price, not a quote.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── 2) 3D designer, branded with the distributor's logo ─────────────────────

function DesignerSection() {
  const designerHref = demoDesignerPath();
  return (
    <section className="container py-10 space-y-6">
      <div className="space-y-2">
        <Badge variant="outline">Demo designer</Badge>
        <h1 className="text-2xl font-semibold">3D kitchen designer, under the distributor's brand</h1>
        <p className="max-w-3xl text-muted-foreground">
          Each storefront opens the same CabinetDealz 3D designer through its own branded address. The distributor's logo and
          colors frame the designer, and the cabinet list can be limited to that distributor's lines.
        </p>
      </div>

      {/* Branded frame mock-up: shows where the distributor logo sits around the designer. */}
      <div className="overflow-hidden rounded-lg border shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white px-1.5 py-0.5">
              <img src={DEMO_DISTRIBUTOR.logoUrl} alt={`${DEMO_DISTRIBUTOR.name} logo (placeholder)`} className="h-6 w-auto" />
            </span>
            <span className="text-sm font-medium">Kitchen Designer</span>
          </div>
          <span className="text-xs" style={{ color: DEMO_DISTRIBUTOR.accentColor }}>Demo preview</span>
        </div>
        <div className="grid min-h-[260px] place-items-center bg-[linear-gradient(0deg,#f6f7f8_1px,transparent_1px),linear-gradient(90deg,#f6f7f8_1px,transparent_1px)] bg-[size:24px_24px] p-8 text-center">
          <div className="space-y-3">
            <PenTool className="mx-auto h-10 w-10" style={{ color: DEMO_DISTRIBUTOR.primaryColor }} aria-hidden />
            <p className="font-medium">Drag cabinets, set wall sizes, see it in 3D, and send the material list to the cart.</p>
            <a href={designerHref} target="_blank" rel="noreferrer">
              <Button className="gap-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>
                Open the 3D designer <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Opens the live designer at <code>{designerHref}</code> (the existing Sales Demo storefront). A real distributor gets
              their own address with their own logo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 3) Back office dashboard with demo data ─────────────────────────────────

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
