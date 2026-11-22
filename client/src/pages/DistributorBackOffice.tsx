// ─── Demo distributor Back Office (the distributor's admin) ──────────────────
// /distributor-preview/dashboard?tab=<id>. The left sidebar mirrors the real
// admin's group names and order (AdminGroupedTabs: Sales & Orders, People,
// Products & Catalog, Pricing, Operations, Settings), keeping only items a
// distributor would get. Vendor-portal tools (VendorPortal: products, door
// styles, featured styles, images, catalog import) sit under Products &
// Catalog, where the main admin keeps catalog and door styles. Demo data only;
// the real admin and VendorPortal are not changed.

import type { ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { BarChart3, ClipboardList, DollarSign, LayoutDashboard, Package, Settings, ShoppingBag, Truck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DEMO_AFFILIATES,
  DEMO_COMMISSION_RATE,
  DEMO_CRM_ACTIVITY,
  DEMO_DISTRIBUTOR,
  DEMO_LABOR,
  DEMO_LEADS,
  DEMO_LINES,
  DEMO_LINE_DOOR_STYLES,
  DEMO_ORDERS,
  DISTRIBUTOR_COMMISSION_RANGE,
  demoCommissionCents,
  demoLineScene,
  formatPercent,
  formatUsd,
  groupLineProducts,
  productsForLine,
  summarizeDemoOrders,
} from "@/lib/demoDistributor";
import { DEMO_DEALERS } from "@/lib/demoDealers";
import { useStoredPublicPricing, useDemoPublicPricing, pricingOverrideFromSearch } from "@/lib/demoPricing";
import { DistributorCatalogImport } from "./DistributorCatalogImport";

export const BACK_OFFICE_TITLE = "Distributor admin";

export type BackOfficeItem = { id: string; label: string };
export type BackOfficeGroup = { id: string; label: string; icon: typeof Users; items: BackOfficeItem[] };

/** Same group names and order as the real admin (AdminGroupedTabs), distributor items only. */
export const BACK_OFFICE_GROUPS: BackOfficeGroup[] = [
  { id: "sales", label: "Sales & Orders", icon: ShoppingBag, items: [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Incoming Orders" },
    { id: "forecast", label: "Sales Forecast" },
    { id: "samples", label: "Sample Orders" },
    { id: "inventory", label: "Inventory" },
    { id: "leads", label: "Design Leads" },
    { id: "crm", label: "Sales CRM" },
  ] },
  { id: "people", label: "People", icon: Users, items: [
    { id: "customers", label: "Customers" },
    { id: "contractors", label: "Contractors" },
    { id: "affiliates", label: "Affiliates" },
    { id: "dealers", label: "Dealers" },
  ] },
  { id: "catalog", label: "Products & Catalog", icon: Package, items: [
    { id: "catalog", label: "Catalog" },
    { id: "door-styles", label: "Door Styles" },
    { id: "featured-styles", label: "Featured Styles" },
    { id: "images", label: "Product Images" },
    { id: "import", label: "Spreadsheet Import" },
    { id: "packages", label: "Kitchen Packages" },
  ] },
  { id: "pricing", label: "Pricing", icon: DollarSign, items: [
    { id: "price-list", label: "Price List" },
  ] },
  { id: "operations", label: "Operations", icon: Truck, items: [
    { id: "fulfillment", label: "Fulfillment & Shipping" },
    { id: "onboarding", label: "Go-live Checklist" },
  ] },
  { id: "settings", label: "Settings", icon: Settings, items: [
    { id: "store", label: "Store Settings" },
    { id: "analytics", label: "Analytics" },
    { id: "branding", label: "Branding" },
  ] },
];

const ALL_ITEMS = BACK_OFFICE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
export function backOfficeHref(tab: string): string {
  return `/distributor-preview/dashboard?tab=${tab}`;
}

export const STORE_SETTINGS_COPY = {
  title: "Store settings",
  pricingLabel: "Show prices to the public",
  pricingHelp: "Off: visitors design first and see “Sign in to see your pricing”. On: every price on your site is shown. Applies to the whole demo site, saved in this browser.",
  overrideNote: (on: boolean) => `A ?pricing=${on ? "on" : "off"} link is overriding this setting on this page.`,
} as const;

function SampleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <Table>
      <TableHeader><TableRow>{head.map((h, i) => <TableHead key={h} className={i === head.length - 1 && /\$|Total|Sales|Estimate|Stock|Count|Orders/.test(h) ? "text-right" : ""}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  );
}

function Panel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StoreSettingsCard() {
  const [stored, setStored] = useStoredPublicPricing();
  const search = useSearch();
  const override = pricingOverrideFromSearch(search);
  return (
    <Card className="border-[#0f4c5c]/40" data-testid="store-settings">
      <CardHeader className="pb-2"><CardTitle className="text-base">{STORE_SETTINGS_COPY.title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="public-pricing" className="text-sm font-medium">{STORE_SETTINGS_COPY.pricingLabel}</Label>
          <Switch id="public-pricing" checked={stored} onCheckedChange={(v) => setStored(v === true)} aria-label={STORE_SETTINGS_COPY.pricingLabel} />
        </div>
        <p className="text-xs text-muted-foreground">{STORE_SETTINGS_COPY.pricingHelp}</p>
        {override != null && <p className="text-xs text-[#7a5f10]">{STORE_SETTINGS_COPY.overrideNote(override)}</p>}
      </CardContent>
    </Card>
  );
}

function PricingStatusChip() {
  const on = useDemoPublicPricing();
  return (
    <Link href={backOfficeHref("store")} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:border-[#0f4c5c]" data-testid="pricing-status">
      Public pricing: <span className="font-semibold">{on ? "On" : "Off"}</span>
    </Link>
  );
}

function TabContent({ tab }: { tab: string }) {
  const summary = summarizeDemoOrders(DEMO_ORDERS);
  switch (tab) {
    case "orders":
      return <Panel title="Incoming Orders"><SampleTable head={["Order", "Date", "Customer", "Channel", "Status", "Total", "Commission"]} rows={DEMO_ORDERS.map((o) => [<span className="font-medium">{o.id}</span>, o.date, o.customer, <Badge variant="outline">{o.channel === "designer" ? "3D designer" : "Direct CSV"}</Badge>, o.status, formatUsd(o.totalCents), formatUsd(demoCommissionCents(o.totalCents, o.channel))])} /></Panel>;
    case "forecast":
      return <Panel title="Sales Forecast" note="Demand from customers' saved designs on your store (sample)."><SampleTable head={["Code", "Line", "In saved designs", "Suggested stock"]} rows={[["B24", "White Shaker", "14", "18"], ["SB36", "White Shaker", "11", "12"], ["W3030", "Gray Shaker", "19", "24"], ["LSB36", "Gray Shaker", "6", "8"], ["U188424", "Raised Panel", "4", "5"]]} /></Panel>;
    case "samples":
      return <Panel title="Sample Orders"><SampleTable head={["Request", "Door style", "Ship to", "Status"]} rows={[["SMP-204", "Shaker White (SW)", "Sample Homeowner F", "To ship"], ["SMP-203", "Aspen White (AW)", "Sample Remodeler D", "Shipped"], ["SMP-202", "Shaker Gray (GR)", "Sample Lead 2", "Shipped"]]} /></Panel>;
    case "inventory":
      return <Panel title="Inventory"><SampleTable head={["Code", "Line", "On hand", "Status"]} rows={[["B24", "White Shaker", "22", "In stock"], ["SB36", "Gray Shaker", "9", "In stock"], ["W3030", "Raised Panel", "3", "Low"], ["LSB36", "White Shaker", "0", "Backorder"]]} /></Panel>;
    case "leads":
      return <Panel title="Design Leads"><SampleTable head={["Lead", "Source", "Stage", "Estimate"]} rows={DEMO_LEADS.map((l) => [<span><span className="font-medium">{l.name}</span><br /><span className="text-xs text-muted-foreground">{l.project}</span></span>, l.source, <Badge variant="outline">{l.stage}</Badge>, formatUsd(l.estimateCents)])} /></Panel>;
    case "crm":
      return <Panel title="Sales CRM"><ul className="space-y-3">{DEMO_CRM_ACTIVITY.map((item) => <li key={`${item.when}-${item.who}`} className="text-sm"><span className="font-medium">{item.who}</span> · {item.what}<p className="text-xs text-muted-foreground">{item.when}</p></li>)}</ul></Panel>;
    case "customers":
      return <Panel title="Customers" note="Customers who signed up on your store (sample)."><SampleTable head={["Customer", "Saved designs", "Orders"]} rows={[["Sample Homeowner A", "2", "1"], ["Sample Homeowner C", "1", "1"], ["Sample Homeowner F", "3", "1"], ["Sample Lead 2", "1", "0"]]} /></Panel>;
    case "contractors":
      return (
        <div className="space-y-4">
          <Panel title="Contractor Access" note="Approve or decline contractors who apply on your store."><SampleTable head={["Contractor", "Applied", "Status"]} rows={[["Sample Builders LLC", "Nov 2", "Approved"], ["Sample Remodel Co.", "Nov 14", "Pending review"]]} /></Panel>
          <Panel title="Labor analytics"><SampleTable head={["Task", "Jobs", "Avg hours", "Avg rate / hr"]} rows={DEMO_LABOR.map((r) => [r.task, String(r.jobs), r.avgHours.toFixed(1), formatUsd(r.avgRateCents)])} /></Panel>
        </div>
      );
    case "affiliates":
      return <Panel title="Affiliates (distributor-owned)"><SampleTable head={["Partner", "Type", "Status", "Orders", "Sales"]} rows={DEMO_AFFILIATES.map((a) => [<span className="font-medium">{a.name}</span>, a.type, <Badge variant="outline">{a.status}</Badge>, String(a.orders), formatUsd(a.salesCents)])} /></Panel>;
    case "dealers":
      return <Panel title="Dealers" note="Approved dealers who receive customers' plans (fictional sample dealers)."><SampleTable head={["Dealer", "City", "Phone"]} rows={DEMO_DEALERS.map((d) => [d.name, `${d.city}, ${d.state}`, d.phone])} /><Link href="/distributor-preview/dealers" className="mt-2 inline-block text-sm underline" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>Open the public dealer page</Link></Panel>;
    case "catalog":
      return <Panel title="Catalog" note="Your lines as customers see them."><SampleTable head={["Line", "Bases", "Walls", "Talls", "Specialties", "Count"]} rows={DEMO_LINES.map((l) => { const g = groupLineProducts(productsForLine(l.id)); return [<Link href={`/distributor-preview/shop?line=${l.id}`} className="font-medium underline">{l.name}</Link>, ...g.map((s) => String(s.count)), String(productsForLine(l.id).length)]; })} /></Panel>;
    case "door-styles":
      return <Panel title="Door Styles" note="The door style behind each line in the 3D designer."><SampleTable head={["Line", "Door style", "Code", "Profile"]} rows={DEMO_LINES.map((l) => { const s = DEMO_LINE_DOOR_STYLES[l.id]; return [l.name, s.styleName, s.styleCode, s.doorStyle]; })} /></Panel>;
    case "featured-styles":
      return <Panel title="Featured Styles" note="Choose which styles lead your storefront."><ul className="grid gap-3 sm:grid-cols-3">{DEMO_LINES.map((l, i) => <li key={l.id} className="rounded-md border p-2 text-sm"><img src={demoLineScene(l)} alt={`${l.name} kitchen (example photo)`} className="mb-2 aspect-video w-full rounded object-cover" loading="lazy" />{l.name} <Badge variant="outline" className="ml-1">{i === 0 ? "Featured first" : "Featured"}</Badge></li>)}</ul></Panel>;
    case "images":
      return <Panel title="Product Images" note="Add or replace photos for your products (sample)."><SampleTable head={["Code", "Line", "Photo"]} rows={[["B24", "White Shaker", "Added"], ["SB36", "White Shaker", "Added"], ["W3030", "Gray Shaker", "Needed"], ["U188424", "Raised Panel", "Needed"]]} /></Panel>;
    case "import":
      return <DistributorCatalogImport />;
    case "packages":
      return <Panel title="Kitchen Packages" note="Build ready-made packages from your own line."><Link href="/distributor-preview/examples" className="text-sm underline" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>See the example kitchens</Link></Panel>;
    case "price-list":
      return <Panel title="Price List" note="Placeholder demo prices per line."><SampleTable head={["Line", "Price level"]} rows={DEMO_LINES.map((l) => [l.name, `${Math.round(l.priceMultiplier * 100)}% of the base list`])} /><p className="mt-2 text-xs text-muted-foreground">Platform commission on designer-assisted orders: {formatPercent(DISTRIBUTOR_COMMISSION_RANGE.min)}–{formatPercent(DISTRIBUTOR_COMMISSION_RANGE.max)}. Direct CSV orders: no commission.</p></Panel>;
    case "fulfillment":
      return <Panel title="Fulfillment & Shipping"><SampleTable head={["Setting", "Value"]} rows={[["Order email", "orders@example.com"], ["Warehouse", "Sample warehouse, Chicago, IL"], ["Pickup", "Mon–Fri 8am–4pm"], ["Lead time", "Set per line"]]} /></Panel>;
    case "onboarding":
      return <Panel title="Go-live Checklist"><ul className="space-y-1 text-sm">{["Agreement signed", "Logo and colors added", "Price list uploaded", "Door style pictures added", "Fulfillment settings filled in"].map((s, i) => <li key={s} className="flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden /> {s} {i < 3 ? <Badge variant="outline">Done</Badge> : <Badge variant="outline">To do</Badge>}</li>)}</ul></Panel>;
    case "store":
      return <StoreSettingsCard />;
    case "analytics":
      return <Panel title="Analytics" note="Visits and orders on your store (sample)."><SampleTable head={["Page", "Visits"]} rows={[["Storefront", "Sample"], ["3D designer", "Sample"], ["Shop", "Sample"]]} /></Panel>;
    case "branding":
      return <Panel title="Branding"><div className="flex items-center gap-3"><img src={DEMO_DISTRIBUTOR.logoUrl} alt="Logo (placeholder)" className="h-10" /><span className="inline-block h-6 w-6 rounded" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} /><span className="inline-block h-6 w-6 rounded" style={{ backgroundColor: DEMO_DISTRIBUTOR.accentColor }} /></div></Panel>;
    default:
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Orders (30 days)", String(summary.count), formatUsd(summary.totalCents)],
              ["Designer-assisted sales", formatUsd(summary.designerCents), `Platform commission at ${formatPercent(DEMO_COMMISSION_RATE)}: ${formatUsd(summary.commissionCents)}`],
              ["Direct CSV orders", formatUsd(summary.csvCents), "No commission"],
              ["Open leads", String(DEMO_LEADS.filter((l) => l.stage !== "Won" && l.stage !== "Lost").length), `${DEMO_AFFILIATES.filter((a) => a.status === "Active").length} active affiliates`],
            ].map(([label, value, hint]) => (
              <Card key={label}><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>
            ))}
          </div>
          <Card className="border-[#0f4c5c]/40 bg-[#f3f8f9]">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">Easy upload ordering</p><p className="text-sm text-muted-foreground">Type a cabinet list or upload a photo of a handwritten or printed one, and it becomes a shopping list. Pick the door style and place the order.</p></div>
              <Link href="/distributor-preview#easy-upload"><Button size="sm" variant="outline" className="shrink-0">See how it works</Button></Link>
            </CardContent>
          </Card>
        </div>
      );
  }
}

export function BackOfficeSection() {
  const search = useSearch();
  const requested = new URLSearchParams(search).get("tab") ?? "overview";
  const tab = ALL_ITEMS.some((i) => i.id === requested) ? requested : "overview";
  const current = ALL_ITEMS.find((i) => i.id === tab)!;
  return (
    <section className="container py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard className="h-6 w-6" aria-hidden /> {BACK_OFFICE_TITLE}</h1>
          <p className="text-sm text-muted-foreground">{DEMO_DISTRIBUTOR.name} back office: a sample of the admin your team would use.</p>
        </div>
        <PricingStatusChip />
      </div>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Back office sections" className="space-y-4">
          {BACK_OFFICE_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><group.icon className="h-3.5 w-3.5" aria-hidden /> {group.label}</p>
              <ul className="flex flex-wrap gap-1 md:block md:space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={backOfficeHref(item.id)}
                      aria-current={item.id === tab ? "page" : undefined}
                      className={`block rounded-md px-2 py-1 text-sm ${item.id === tab ? "bg-[#0f4c5c] text-white" : "hover:bg-muted"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          <p className="text-xs text-muted-foreground">{current.group} › {current.label}</p>
          <TabContent tab={tab} />
          <p className="text-xs text-muted-foreground"><BarChart3 className="mr-1 inline h-3 w-3" aria-hidden />Sample data. <Link href="/distributor-preview/features#backOffice" className="underline">See every back-office tool</Link></p>
        </div>
      </div>
    </section>
  );
}
