// ─── Demo Distributor data ───────────────────────────────────────────────────
// Placeholder data for the Distributor preview page (/distributor-preview).
// Mirrors the affiliate template preview (/store-preview/:template): nothing
// here is read from or written to the database. Every name, order, lead and
// number is fictional and is labelled "Demo" wherever it is shown.

export const DEMO_DISTRIBUTOR = {
  id: "demo-distributor",
  name: "Demo Distributor",
  code: "DEMO",
  tagline: "Cabinet lines you can design, price and order in one place.",
  logoUrl: "/demo/demo-distributor-logo.svg",
  primaryColor: "#0f4c5c",
  accentColor: "#f4a259",
  location: "Anytown, USA",
  publicEmail: "orders@example.com",
  // The demo's storefront URL is illustrative only; no subdomain is provisioned.
  sampleStoreUrl: "demo-distributor.cabinetdealz.com",
} as const;

// The 3D designer is reached through the existing branded affiliate path
// /store/:slug/design (AffiliateShell + DesignTool, unchanged). "sales-demo" is
// the existing Sales Demo storefront. Swap to "demo-distributor" only after the
// optional demo row in docs/sql/0281_demo_distributor_storefront.tidb.sql has
// been reviewed and applied by Tom.
export const DEMO_DISTRIBUTOR_DESIGNER_SLUG = "sales-demo";

export function demoDesignerPath(slug: string = DEMO_DISTRIBUTOR_DESIGNER_SLUG): string {
  return `/store/${encodeURIComponent(slug)}/design`;
}

// Commission terms shown on the signup CTA. The final rate inside the range is
// set in each distributor's agreement.
export const DISTRIBUTOR_COMMISSION_RANGE = { min: 0.03, max: 0.04 } as const;
export const DEMO_COMMISSION_RATE = 0.035;

export type DemoOrderChannel = "designer" | "csv";

export function isCommissionableChannel(channel: DemoOrderChannel): boolean {
  return channel === "designer";
}

/** Commission owed on one order: designer-assisted orders earn the rate; direct CSV orders earn nothing. */
export function demoCommissionCents(
  totalCents: number,
  channel: DemoOrderChannel,
  rate: number = DEMO_COMMISSION_RATE,
): number {
  if (!isCommissionableChannel(channel)) return 0;
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0;
  const bounded = Math.min(Math.max(rate, DISTRIBUTOR_COMMISSION_RANGE.min), DISTRIBUTOR_COMMISSION_RANGE.max);
  return Math.round(totalCents * bounded);
}

export function formatPercent(rate: number): string {
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── Demo catalog ────────────────────────────────────────────────────────────
// A small mixed catalog. The storefront filters it to the demo distributor's
// own lines to show what a distributor-locked storefront looks like.

export type DemoProduct = {
  sku: string;
  name: string;
  category: "Base" | "Wall" | "Tall" | "Vanity" | "Accessory";
  doorLine: string;
  distributorId: string;
  priceCents: number;
};

export const DEMO_DOOR_LINES = [
  { id: "demo-white-shaker", name: "Demo White Shaker", swatch: "#f4f4f2", distributorId: DEMO_DISTRIBUTOR.id },
  { id: "demo-sage-shaker", name: "Demo Sage Shaker", swatch: "#9caf88", distributorId: DEMO_DISTRIBUTOR.id },
  { id: "demo-espresso-slab", name: "Demo Espresso Slab", swatch: "#3b2a20", distributorId: DEMO_DISTRIBUTOR.id },
  { id: "other-gray-raised", name: "Other Line Gray Raised", swatch: "#8a8f94", distributorId: "other-line" },
] as const;

export const DEMO_CATALOG: DemoProduct[] = [
  { sku: "B12", name: "Base 12\" (1 door, 1 drawer)", category: "Base", doorLine: "Demo White Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 18900 },
  { sku: "B24", name: "Base 24\" (2 doors, 1 drawer)", category: "Base", doorLine: "Demo White Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 26400 },
  { sku: "DB18-3", name: "Drawer Base 18\" (3 drawers)", category: "Base", doorLine: "Demo Sage Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 31200 },
  { sku: "SB36", name: "Sink Base 36\"", category: "Base", doorLine: "Demo Sage Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 28800 },
  { sku: "W3030", name: "Wall 30\" x 30\"", category: "Wall", doorLine: "Demo White Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 21500 },
  { sku: "W1542", name: "Wall 15\" x 42\"", category: "Wall", doorLine: "Demo Espresso Slab", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 17900 },
  { sku: "P2484", name: "Pantry 24\" x 84\"", category: "Tall", doorLine: "Demo Espresso Slab", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 61900 },
  { sku: "V3021", name: "Vanity 30\" x 21\"", category: "Vanity", doorLine: "Demo Sage Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 24900 },
  { sku: "TK8", name: "Toe Kick 8'", category: "Accessory", doorLine: "Demo White Shaker", distributorId: DEMO_DISTRIBUTOR.id, priceCents: 3900 },
  // Another supplier's products — present in the platform catalog, hidden from this storefront.
  { sku: "OL-B24", name: "Base 24\" (Other Line)", category: "Base", doorLine: "Other Line Gray Raised", distributorId: "other-line", priceCents: 25100 },
  { sku: "OL-W3030", name: "Wall 30\" x 30\" (Other Line)", category: "Wall", doorLine: "Other Line Gray Raised", distributorId: "other-line", priceCents: 20400 },
];

export function filterCatalogForDistributor(catalog: DemoProduct[], distributorId: string): DemoProduct[] {
  return catalog.filter((product) => product.distributorId === distributorId);
}

// ─── Demo back office ────────────────────────────────────────────────────────

export type DemoOrder = {
  id: string;
  date: string;
  customer: string;
  channel: DemoOrderChannel;
  totalCents: number;
  status: "Quoted" | "Paid" | "In production" | "Shipped" | "Delivered";
};

export const DEMO_ORDERS: DemoOrder[] = [
  { id: "DEMO-1042", date: "Nov 18", customer: "Sample Homeowner A", channel: "designer", totalCents: 1284000, status: "Paid" },
  { id: "DEMO-1041", date: "Nov 17", customer: "Sample Contractor B", channel: "csv", totalCents: 2215000, status: "In production" },
  { id: "DEMO-1040", date: "Nov 15", customer: "Sample Homeowner C", channel: "designer", totalCents: 846000, status: "Shipped" },
  { id: "DEMO-1039", date: "Nov 12", customer: "Sample Remodeler D", channel: "designer", totalCents: 1932000, status: "Delivered" },
  { id: "DEMO-1038", date: "Nov 10", customer: "Sample Contractor E", channel: "csv", totalCents: 1107000, status: "Delivered" },
  { id: "DEMO-1037", date: "Nov 8", customer: "Sample Homeowner F", channel: "designer", totalCents: 659000, status: "Quoted" },
];

export type DemoLead = {
  name: string;
  source: "3D designer" | "Storefront form" | "Affiliate referral" | "Phone";
  project: string;
  stage: "New" | "Contacted" | "Design sent" | "Won" | "Lost";
  estimateCents: number;
};

export const DEMO_LEADS: DemoLead[] = [
  { name: "Sample Lead 1", source: "3D designer", project: "L-shape kitchen, 14 cabinets", stage: "Design sent", estimateCents: 980000 },
  { name: "Sample Lead 2", source: "Storefront form", project: "Two bathroom vanities", stage: "New", estimateCents: 210000 },
  { name: "Sample Lead 3", source: "Affiliate referral", project: "Kitchen + pantry wall", stage: "Contacted", estimateCents: 1540000 },
  { name: "Sample Lead 4", source: "3D designer", project: "Galley kitchen refresh", stage: "Won", estimateCents: 720000 },
  { name: "Sample Lead 5", source: "Phone", project: "Laundry room uppers", stage: "Lost", estimateCents: 160000 },
];

export type DemoAffiliate = {
  name: string;
  type: "Contractor" | "Showroom" | "Designer";
  orders: number;
  salesCents: number;
  status: "Active" | "Invited" | "Paused";
};

export const DEMO_AFFILIATES: DemoAffiliate[] = [
  { name: "Sample Builders LLC", type: "Contractor", orders: 7, salesCents: 6420000, status: "Active" },
  { name: "Sample Kitchen Showroom", type: "Showroom", orders: 4, salesCents: 3870000, status: "Active" },
  { name: "Sample Interiors Studio", type: "Designer", orders: 2, salesCents: 1190000, status: "Active" },
  { name: "Sample Remodel Co.", type: "Contractor", orders: 0, salesCents: 0, status: "Invited" },
];

export type DemoLaborRow = {
  task: string;
  jobs: number;
  avgHours: number;
  avgRateCents: number;
};

export const DEMO_LABOR: DemoLaborRow[] = [
  { task: "Cabinet install (per box)", jobs: 22, avgHours: 0.9, avgRateCents: 6500 },
  { task: "Countertop template + set", jobs: 9, avgHours: 4.5, avgRateCents: 7500 },
  { task: "Crown + trim", jobs: 11, avgHours: 3.2, avgRateCents: 6000 },
  { task: "Delivery + unload", jobs: 31, avgHours: 1.5, avgRateCents: 5000 },
];

export type DemoCrmActivity = {
  when: string;
  who: string;
  what: string;
};

export const DEMO_CRM_ACTIVITY: DemoCrmActivity[] = [
  { when: "Today 10:12 AM", who: "Sample Lead 1", what: "Opened the shared 3D design link" },
  { when: "Today 9:40 AM", who: "Sample Contractor B", what: "Uploaded a CSV order (direct — no commission)" },
  { when: "Yesterday", who: "Sample Lead 3", what: "Follow-up call logged, quote requested" },
  { when: "Yesterday", who: "Sample Homeowner A", what: "Paid invoice DEMO-1042" },
  { when: "Nov 16", who: "Sample Lead 4", what: "Marked Won — designer-assisted order" },
];

export function summarizeDemoOrders(orders: DemoOrder[], rate: number = DEMO_COMMISSION_RATE) {
  let designerCents = 0;
  let csvCents = 0;
  let commissionCents = 0;
  for (const order of orders) {
    if (order.channel === "designer") designerCents += order.totalCents;
    else csvCents += order.totalCents;
    commissionCents += demoCommissionCents(order.totalCents, order.channel, rate);
  }
  return { count: orders.length, designerCents, csvCents, totalCents: designerCents + csvCents, commissionCents };
}

export const DISTRIBUTOR_PREVIEW_SECTIONS = ["storefront", "designer", "dashboard", "signup"] as const;
export type DistributorPreviewSection = (typeof DISTRIBUTOR_PREVIEW_SECTIONS)[number];

export function isDistributorPreviewSection(value: unknown): value is DistributorPreviewSection {
  return typeof value === "string" && (DISTRIBUTOR_PREVIEW_SECTIONS as readonly string[]).includes(value);
}
