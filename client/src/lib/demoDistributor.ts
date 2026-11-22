// ─── Demo Distributor data ───────────────────────────────────────────────────
// Placeholder data for the Distributor preview page (/distributor-preview).
// Mirrors the affiliate template preview (/store-preview/:template): nothing
// here is read from or written to the database. Every name, order, lead and
// price is a placeholder and is labelled "Demo" wherever it is shown.
//
// The cabinet codes and dimensions are real: they are derived programmatically
// from the read-only catalog snapshots committed in client/src/lib/__fixtures__
// (see scripts/emit_demo_distributor_catalog.mjs). Prices are demo placeholders.

import {
  DEMO_CATALOG_SOURCE_ROWS,
  DEMO_FIXTURE_SOURCE_ROWS,
  type DemoCatalogSourceRow,
} from "./demoDistributorCatalog.generated";
import type { AutoDesignSinkProduct } from "./autoDesignSink";
import type { AutoDesignFaucetProduct } from "./autoDesignFaucet";
import { cheapestAutoDesignFaucet } from "./autoDesignFaucet";
import { pickBudgetDefaultSink } from "./autoDesignBudgetSink";
import { faucetRowsForBase, sinkRowsForBase } from "./sinkBaseSelection";
import { KITCHEN_SCENES, type KitchenSceneKey } from "./doorFamilyPhotos";
import { DEMO_LINE_DOOR_STYLES } from "./demoDesignerCatalog";

export const DEMO_BRAND_NAME = "Cabinet Deals Demo Distributor";
export const DEMO_DESIGNER_LABEL = "Demo Distributor Designer";

export const DEMO_DISTRIBUTOR = {
  id: "demo-distributor",
  name: DEMO_BRAND_NAME,
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

// Share details for emailing the page to prospective distributors.
export const DEMO_SHARE = {
  url: "https://www.cabinetdealz.com/distributor-preview",
  title: `${DEMO_BRAND_NAME}: an example distributor website`,
  description:
    "An example of the website Cabinet Deals can build for a cabinet distributor: your brand, your full catalog, your own 3D designer, and leads and orders that come to you. Demo data.",
  image: `https://www.cabinetdealz.com${KITCHEN_SCENES["shaker-white"]}`,
} as const;

// The designer opens inside the demo distributor shell at this route. The
// designer component itself (DesignTool) is mounted unchanged.
export const DEMO_DESIGNER_ROUTE = "/distributor-preview/design";

export function demoDesignerPath(lineId?: DemoLineId): string {
  if (!lineId) return DEMO_DESIGNER_ROUTE;
  // `style` is the designer's existing door-style preselect parameter.
  return `${DEMO_DESIGNER_ROUTE}?line=${encodeURIComponent(lineId)}&style=${DEMO_LINE_DOOR_STYLES[lineId].doorStyleId}`;
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

// ─── Demo lines, groups and catalog ──────────────────────────────────────────
// Three door lines. Every line carries the full derived catalog (same codes and
// dimensions), priced with a fixed per-line demo multiplier.

export const DEMO_LINES = [
  {
    id: "white-shaker",
    name: "White Shaker",
    scene: "shaker-white" as KitchenSceneKey,
    swatch: "#f4f4f2",
    priceMultiplier: 1,
    headline: "A clean, bright classic",
    copy: "A simple five-piece shaker door in white. It suits modern and traditional kitchens alike.",
  },
  {
    id: "gray-shaker",
    name: "Gray Shaker",
    scene: "shaker-gray" as KitchenSceneKey,
    swatch: "#8f969c",
    priceMultiplier: 1.08,
    headline: "The same shaker door in a calm gray",
    copy: "A soft neutral for kitchens that want a little color without a bold statement.",
  },
  {
    id: "raised-panel",
    name: "Raised Panel",
    scene: "raised-cherry" as KitchenSceneKey,
    swatch: "#7a3e2b",
    priceMultiplier: 1.18,
    headline: "Traditional detail and warmth",
    copy: "A raised center panel and a warm finish for a more formal, furniture-style kitchen.",
  },
] as const;

export type DemoLine = (typeof DEMO_LINES)[number];
export type DemoLineId = DemoLine["id"];

export { DEMO_LINE_DOOR_STYLES, demoDesignerCatalogFilter } from "./demoDesignerCatalog";

export function isDemoLineId(value: unknown): value is DemoLineId {
  return typeof value === "string" && DEMO_LINES.some((line) => line.id === value);
}

export function demoLineScene(line: DemoLine): string {
  return KITCHEN_SCENES[line.scene];
}

export const DEMO_TYPE_GROUPS = ["Bases", "Walls", "Talls", "Specialties"] as const;
export type DemoTypeGroup = (typeof DEMO_TYPE_GROUPS)[number];

export type DemoProduct = {
  sku: string;
  name: string;
  /** Type group inside a line: Bases, Walls, Talls or Specialties. */
  group: DemoTypeGroup;
  /** Sub-type inside the group, e.g. "Sink Base" or "Drawer Base" inside Bases. */
  category: string;
  doorLine: string;
  lineId: DemoLineId | null;
  distributorId: string;
  priceCents: number;
  widthIn: number | null;
  heightIn: number | null;
  depthIn: number | null;
};

/** Organizers that drop into an existing cabinet: rollout trays, roll-out shelves, lazy susan inserts. */
export const ORGANIZERS_SUBTYPE = "Organizers & Rollout Trays";
export const ORGANIZERS_NOTE = "Universal rollout trays fit standard base cabinets of the matching width.";
export const CORNER_BASE_SUBTYPE = "Corner Cabinets";

type GroupingRow = Pick<DemoCatalogSourceRow, "kind" | "category" | "subCategory"> & { code?: string };

export function isDemoOrganizer(row: GroupingRow): boolean {
  if (row.kind !== "accessory") return false;
  return /rollout tray|roll-out shelf|lazy susan insert/i.test(row.subCategory ?? "") || /^UNIV-ROT\d|TRAY/i.test(row.code ?? "");
}

/** Panels and skins listed under the Wall category are parts, not wall boxes. */
function isWallListedPanel(row: GroupingRow): boolean {
  return row.kind === "accessory" && row.category === "Wall" && /^(WDEP|WEP|WS)\d/i.test(row.code ?? "");
}

/** A real corner base cabinet (never an accessory or a part). */
export function isDemoCornerBase(row: GroupingRow): boolean {
  if (row.kind !== "base") return false;
  if (/vanity/i.test(`${row.category ?? ""} ${row.subCategory ?? ""}`)) return false;
  return row.category === "Corner" || /corner|lazy susan|easy reach/i.test(row.subCategory ?? "");
}

/** Every source row lands in exactly one type group. */
export function demoTypeGroupFor(row: GroupingRow): DemoTypeGroup {
  const text = `${row.category ?? ""} ${row.subCategory ?? ""}`;
  if (row.kind === "wall") return "Walls";
  if (row.kind === "tall") return "Talls";
  if (row.kind === "base") return /vanity/i.test(text) ? "Specialties" : "Bases";
  // Accessory rows: stock wall boxes listed with accessories stay with the walls;
  // panels and organizers are Specialties.
  if (row.category === "Wall" && !isWallListedPanel(row)) return "Walls";
  return "Specialties";
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => (word === word.toUpperCase() && word.length > 1 ? word : word.charAt(0).toUpperCase() + word.slice(1)));
}

export function demoSubTypeFor(row: GroupingRow): string {
  if (isDemoOrganizer(row)) return ORGANIZERS_SUBTYPE;
  if (isDemoCornerBase(row)) return CORNER_BASE_SUBTYPE;
  if (isWallListedPanel(row)) return "Panels";
  // Accessory parts named after a corner (e.g. SBF4242 corner sink base floor) are parts, not corner cabinets.
  if (row.kind === "accessory" && /corner/i.test(row.subCategory ?? "")) return "Cabinet Parts";
  const raw = (row.subCategory ?? row.category ?? "Other").trim() || "Other";
  return titleCase(raw);
}

/** Demo placeholder price in cents, from the box size and the line multiplier. Not a quote. */
export function demoPriceCents(row: Pick<DemoCatalogSourceRow, "widthIn" | "heightIn">, group: DemoTypeGroup, multiplier: number): number {
  const w = row.widthIn ?? 3;
  const h = row.heightIn ?? 30;
  let dollars: number;
  switch (group) {
    case "Bases": dollars = 90 + w * 7.5; break;
    case "Walls": dollars = 40 + w * h * 0.12; break;
    case "Talls": dollars = 250 + w * h * 0.18; break;
    default: dollars = 25 + w * h * 0.05; break;
  }
  return Math.max(500, Math.round(dollars * multiplier) * 100);
}

function buildLineProducts(line: DemoLine): DemoProduct[] {
  return DEMO_CATALOG_SOURCE_ROWS.map((row) => {
    const group = demoTypeGroupFor(row);
    return {
      sku: row.code,
      name: row.description,
      group,
      category: demoSubTypeFor(row),
      doorLine: line.name,
      lineId: line.id,
      distributorId: DEMO_DISTRIBUTOR.id,
      priceCents: demoPriceCents(row, group, line.priceMultiplier),
      widthIn: row.widthIn,
      heightIn: row.heightIn,
      depthIn: row.depthIn,
    };
  });
}

// Another supplier's products: present in the platform catalog, hidden from this storefront.
const OTHER_SUPPLIER_PRODUCTS: DemoProduct[] = [
  { sku: "OL-B24", name: "Base 24\" (other supplier)", group: "Bases", category: "Standard Base", doorLine: "Other supplier line", lineId: null, distributorId: "other-line", priceCents: 25100, widthIn: 24, heightIn: 34.5, depthIn: 24 },
  { sku: "OL-W3030", name: "Wall 30\" x 30\" (other supplier)", group: "Walls", category: "Standard Wall", doorLine: "Other supplier line", lineId: null, distributorId: "other-line", priceCents: 20400, widthIn: 30, heightIn: 30, depthIn: 12 },
];

export const DEMO_CATALOG: DemoProduct[] = [...DEMO_LINES.flatMap(buildLineProducts), ...OTHER_SUPPLIER_PRODUCTS];

export function filterCatalogForDistributor(catalog: DemoProduct[], distributorId: string): DemoProduct[] {
  return catalog.filter((product) => product.distributorId === distributorId);
}

export function productsForLine(lineId: DemoLineId, catalog: DemoProduct[] = DEMO_CATALOG): DemoProduct[] {
  return catalog.filter((p) => p.lineId === lineId && p.distributorId === DEMO_DISTRIBUTOR.id);
}

export type DemoLineGroupSection = { group: DemoTypeGroup; count: number; subTypes: { name: string; products: DemoProduct[] }[] };

/** Line → type group → sub-type, in display order. Every product appears exactly once. */
export function groupLineProducts(products: DemoProduct[]): DemoLineGroupSection[] {
  return DEMO_TYPE_GROUPS.map((group) => {
    const inGroup = products.filter((p) => p.group === group);
    const bySub = new Map<string, DemoProduct[]>();
    for (const p of inGroup) bySub.set(p.category, [...(bySub.get(p.category) ?? []), p]);
    const subTypes = Array.from(bySub.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([name, items]) => ({ name, products: items }));
    return { group, count: inGroup.length, subTypes };
  });
}

// ─── Easy upload ordering example (static) ───────────────────────────────────
// A sample handwritten list and the shopping list it becomes. Codes are real
// catalog codes from the derived catalog; nothing is sent to any service.

export const EASY_UPLOAD_SAMPLE: { written: string; code: string; qty: number }[] = [
  { written: "2 - B24", code: "B24", qty: 2 },
  { written: "3 - W3030", code: "W3030", qty: 3 },
  { written: "1 - SB36", code: "SB36", qty: 1 },
  { written: "2 - 3DB18", code: "3DB18", qty: 2 },
  { written: "2 - W3012", code: "W3012", qty: 2 },
  { written: "1 - BBC42", code: "BBC42", qty: 1 },
];

export type EasyUploadRow = { code: string; qty: number; name: string; unitCents: number; lineCents: number };

/** The shopping list the sample becomes for one door line (demo prices). */
export function easyUploadShoppingList(lineId: DemoLineId): { rows: EasyUploadRow[]; totalCents: number } {
  const products = productsForLine(lineId);
  const rows = EASY_UPLOAD_SAMPLE.flatMap((item) => {
    const product = products.find((p) => p.sku === item.code);
    return product ? [{ code: item.code, qty: item.qty, name: product.name, unitCents: product.priceCents, lineCents: product.priceCents * item.qty }] : [];
  });
  return { rows, totalCents: rows.reduce((sum, row) => sum + row.lineCents, 0) };
}

// ─── Sinks & Faucets (shared across all three lines) ─────────────────────────
// Rows use the designer's own sink and faucet product shapes, so the existing
// sink-base rules decide what fits. Prices are demo placeholders.

export const DEMO_FIXTURE_PRICE_MULTIPLIER = 1.1;

function demoFixturePrice(snapshot: number | null): number | null {
  return snapshot == null ? null : Math.round(snapshot * DEMO_FIXTURE_PRICE_MULTIPLIER * 100) / 100;
}

const fixtureRow = (row: (typeof DEMO_FIXTURE_SOURCE_ROWS)[number]) => ({
  id: row.id,
  pelicanCode: row.pelicanCode,
  name: row.name,
  description: row.description,
  category: row.category,
  subCategory: row.subCategory,
  size: row.size,
  imageUrl: null,
  sellPrice: demoFixturePrice(row.snapshotPrice),
});

export const DEMO_SINKS: AutoDesignSinkProduct[] = DEMO_FIXTURE_SOURCE_ROWS.filter((r) => r.subCategory === "Sinks").map(fixtureRow);
export const DEMO_FAUCETS: AutoDesignFaucetProduct[] = DEMO_FIXTURE_SOURCE_ROWS.filter((r) => r.subCategory === "Faucets").map(fixtureRow);
export const DEMO_SINK_ACCESSORIES: AutoDesignSinkProduct[] = DEMO_FIXTURE_SOURCE_ROWS.filter((r) => r.subCategory !== "Sinks" && r.subCategory !== "Faucets").map(fixtureRow);

export type DemoSinkBaseCompatibility = {
  baseCode: string;
  baseName: string;
  widthIn: number;
  sinks: AutoDesignSinkProduct[];
  faucets: AutoDesignFaucetProduct[];
  /** The designer's Auto Design pick: lowest-priced double bowl that fits, else lowest-priced sink. */
  defaultSink: AutoDesignSinkProduct | null;
  defaultSinkNote: string;
  /** The designer's Auto Design pick: lowest-priced deck faucet that fits this base. */
  defaultFaucet: AutoDesignFaucetProduct | null;
};

export function isDemoSinkBase(row: Pick<DemoCatalogSourceRow, "kind" | "subCategory" | "description">): boolean {
  return row.kind === "base" && (/sink/i.test(row.subCategory ?? "") || /\bsink base\b/i.test(row.description));
}

/** Sinks and faucets that fit each sink base, using the designer's existing sink-base rules. Same in every line. */
export function demoSinkBaseCompatibility(): DemoSinkBaseCompatibility[] {
  return DEMO_CATALOG_SOURCE_ROWS.filter((row) => isDemoSinkBase(row) && (row.widthIn ?? 0) > 0).map((row) => {
    const base = { masterCode: row.code, description: row.description, subCategory: row.subCategory, category: row.category, width: row.widthIn } as const;
    const roomType = /vanity/i.test(`${row.category ?? ""} ${row.subCategory ?? ""} ${row.description}`) ? "bathroom" : "kitchen";
    const sinks = sinkRowsForBase(DEMO_SINKS, base as never, roomType);
    const faucets = faucetRowsForBase(DEMO_FAUCETS, base as never, roomType);
    const budget = roomType === "kitchen" ? pickBudgetDefaultSink({ base: base as never, lineProducts: DEMO_SINKS }) : null;
    return {
      baseCode: row.code,
      baseName: row.description,
      widthIn: row.widthIn ?? 0,
      sinks,
      faucets,
      defaultSink: budget?.source === "line" ? budget.product : null,
      defaultSinkNote: budget?.note ?? "Vanity sink base: the designer offers vanity basins and vanity faucets.",
      defaultFaucet: roomType === "kitchen" ? cheapestAutoDesignFaucet(faucets) : (faucets[0] ?? null),
    };
  });
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

export const DISTRIBUTOR_PREVIEW_SECTIONS = ["storefront", "shop", "dashboard", "signup", "features", "auto-design", "contractors", "affiliates", "dealers", "designs", "examples"] as const;
export type DistributorPreviewSection = (typeof DISTRIBUTOR_PREVIEW_SECTIONS)[number];

export function isDistributorPreviewSection(value: unknown): value is DistributorPreviewSection {
  return typeof value === "string" && (DISTRIBUTOR_PREVIEW_SECTIONS as readonly string[]).includes(value);
}
