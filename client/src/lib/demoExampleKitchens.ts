// ─── Demo distributor: example kitchens ──────────────────────────────────────
// Each example is an items list of real catalog codes for one demo line.
// Layout rules followed (Tom's): fillers only at wall ends or against tall
// cabinets/appliances, never between two cabinets; as few fillers as possible;
// one refrigerator end panel, on the open side only; no fluted fillers.
// Corners use lazy susan bases (no corner filler needed) and diagonal walls.

import {
  DEMO_LINES,
  demoSinkBaseCompatibility,
  productsForLine,
  type DemoLineId,
} from "./demoDistributor";

export type ExampleItem = { code: string; qty: number; note?: string };

export type ExampleKitchen = {
  id: string;
  name: string;
  lineId: DemoLineId;
  layout: "L-shape" | "U-shape" | "Galley" | "L-shape with island";
  /** Room size line, e.g. "10 ft × 13 ft". */
  size: string;
  summary: string;
  /** Cabinet items (sink and faucet are added from the sink base). */
  items: ExampleItem[];
  sinkBase: string;
};

export const EXAMPLE_KITCHENS_COPY = {
  title: "Example kitchens",
  intro: "Real layouts built from in-stock items in our three lines. Every item below is a catalog code you can order.",
  badge: "Built from in-stock items",
  itemsUsed: "Items used",
  photoNote: "Photo shows the door style, not this exact layout.",
  order: "Order this kitchen",
  design: "Design one like this",
  strip: "Start from an example",
  stripNote: "Opens the example's items list. Use its line in the designer to build your own.",
  viewAll: "See all example kitchens",
  total: "Items total",
} as const;

export const EXAMPLE_KITCHENS: ExampleKitchen[] = [
  {
    id: "white-shaker-l",
    name: "White Shaker L-shape",
    lineId: "white-shaker",
    layout: "L-shape",
    size: "10 ft × 13 ft, two walls",
    summary: "Lazy susan in the corner, sink under the window, pantry and refrigerator at the open end.",
    sinkBase: "SB36",
    items: [
      { code: "LSB36", qty: 1, note: "Corner" },
      { code: "B21", qty: 1 },
      { code: "SB36", qty: 1 },
      { code: "3DB24", qty: 1 },
      { code: "B24", qty: 1 },
      { code: "DCW2430", qty: 1, note: "Corner" },
      { code: "W2130", qty: 1 },
      { code: "W3030", qty: 1, note: "Over the sink" },
      { code: "W2430", qty: 2 },
      { code: "W362424", qty: 1, note: "Over the refrigerator" },
      { code: "U188424", qty: 1, note: "Pantry" },
      { code: "UNIV-ROT24", qty: 2, note: "In B24" },
      { code: "F342", qty: 1, note: "Wall end" },
      { code: "BF6", qty: 1, note: "Wall end" },
      { code: "REPV2496", qty: 1, note: "Open side of the refrigerator" },
      { code: "CM8", qty: 3 },
      { code: "TK8(TKC)", qty: 2 },
    ],
  },
  {
    id: "gray-shaker-galley",
    name: "Gray Shaker galley",
    lineId: "gray-shaker",
    layout: "Galley",
    size: "8 ft × 12 ft, two facing runs",
    summary: "Sink run on one side; oven cabinet, pantry and drawers on the other.",
    sinkBase: "SB36",
    items: [
      { code: "SB36", qty: 1 },
      { code: "B15", qty: 1 },
      { code: "3DB18", qty: 1 },
      { code: "B30", qty: 1 },
      { code: "3DB30", qty: 1 },
      { code: "W1830", qty: 1 },
      { code: "W3030", qty: 2 },
      { code: "W3630", qty: 1, note: "Over the sink" },
      { code: "O338424", qty: 1, note: "Wall oven" },
      { code: "U188424", qty: 1, note: "Pantry" },
      { code: "UNIV-ROT30", qty: 2, note: "In B30" },
      { code: "F396", qty: 1, note: "Against the tall run" },
      { code: "CM8", qty: 3 },
      { code: "TK8(TKC)", qty: 2 },
    ],
  },
  {
    id: "raised-panel-u",
    name: "Raised Panel U-shape",
    lineId: "raised-panel",
    layout: "U-shape",
    size: "12 ft × 12 ft, three walls",
    summary: "Two lazy susan corners, sink centered on the back wall, refrigerator and pantry closing one leg.",
    sinkBase: "SB36",
    items: [
      { code: "LSB36", qty: 2, note: "Corners" },
      { code: "SB36", qty: 1 },
      { code: "B18", qty: 1 },
      { code: "3DB15", qty: 1 },
      { code: "B24", qty: 1 },
      { code: "3DB30", qty: 1 },
      { code: "B30", qty: 1 },
      { code: "DCW2430", qty: 2, note: "Corners" },
      { code: "W1830", qty: 1 },
      { code: "W3030", qty: 1, note: "Over the sink" },
      { code: "W2430", qty: 1 },
      { code: "W3330", qty: 1 },
      { code: "W362424", qty: 1, note: "Over the refrigerator" },
      { code: "U248424", qty: 1, note: "Pantry" },
      { code: "UNIV-ROT18", qty: 1, note: "In B18" },
      { code: "UNIV-ROT24", qty: 1, note: "In B24" },
      { code: "F342", qty: 1, note: "Wall end" },
      { code: "REPV2496", qty: 1, note: "Open side of the refrigerator" },
      { code: "CM8", qty: 4 },
      { code: "TK8(TKC)", qty: 3 },
    ],
  },
  {
    id: "white-shaker-island",
    name: "White Shaker L-shape with island",
    lineId: "white-shaker",
    layout: "L-shape with island",
    size: "12 ft × 14 ft, two walls plus a 6 ft island",
    summary: "Tall 42 in. uppers, oven cabinet and pantry on the long wall, drawer bases in the island.",
    sinkBase: "SB36",
    items: [
      { code: "LSB36", qty: 1, note: "Corner" },
      { code: "SB36", qty: 1 },
      { code: "B24", qty: 1 },
      { code: "3DB30", qty: 1 },
      { code: "3DB30", qty: 2, note: "Island" },
      { code: "B24", qty: 1, note: "Island" },
      { code: "BDEP", qty: 2, note: "Island ends" },
      { code: "DCW2442", qty: 1, note: "Corner" },
      { code: "W2442", qty: 1 },
      { code: "W3042", qty: 1, note: "Over the sink" },
      { code: "W3642", qty: 1 },
      { code: "O338424", qty: 1, note: "Wall oven" },
      { code: "U188424", qty: 1, note: "Pantry" },
      { code: "W362424", qty: 1, note: "Over the refrigerator" },
      { code: "UNIV-ROT24", qty: 4, note: "Two in each B24" },
      { code: "F342", qty: 1, note: "Wall end" },
      { code: "REPV2496", qty: 1, note: "Open side of the refrigerator" },
      { code: "CM8", qty: 3 },
      { code: "TK8(TKC)", qty: 3 },
    ],
  },
];

export function exampleKitchenById(id: string | null | undefined): ExampleKitchen | null {
  return EXAMPLE_KITCHENS.find((k) => k.id === id) ?? null;
}

export function exampleKitchensForLine(lineId: DemoLineId): ExampleKitchen[] {
  return EXAMPLE_KITCHENS.filter((k) => k.lineId === lineId);
}

export function exampleKitchenPath(id: string): string {
  return `/distributor-preview/examples/${id}`;
}

export type ExampleItemRow = { code: string; name: string; qty: number; note?: string; unitCents: number | null; lineCents: number | null };

/** Items with catalog names and demo prices (merged by code), plus the default sink and faucet for the sink base. */
export function exampleKitchenRows(kitchen: ExampleKitchen): { rows: ExampleItemRow[]; totalCents: number } {
  const products = productsForLine(kitchen.lineId);
  const merged = new Map<string, ExampleItemRow>();
  for (const item of kitchen.items) {
    const product = products.find((p) => p.sku === item.code);
    if (!product) throw new Error(`Example ${kitchen.id}: ${item.code} is not in ${kitchen.lineId}`);
    const prev = merged.get(item.code);
    const qty = (prev?.qty ?? 0) + item.qty;
    const note = [prev?.note, item.note].filter(Boolean).join("; ") || undefined;
    merged.set(item.code, { code: item.code, name: product.name, qty, note, unitCents: product.priceCents, lineCents: product.priceCents * qty });
  }
  const fit = demoSinkBaseCompatibility().find((c) => c.baseCode === kitchen.sinkBase);
  for (const [fixture, note] of [[fit?.defaultSink, `Sink for ${kitchen.sinkBase}`], [fit?.defaultFaucet, "Faucet"]] as const) {
    if (!fixture) continue;
    const unit = fixture.sellPrice != null ? Math.round(fixture.sellPrice * 100) : null;
    const code = fixture.pelicanCode ?? fixture.name;
    merged.set(code, { code, name: (fixture as { description?: string | null }).description || fixture.name, qty: 1, note, unitCents: unit, lineCents: unit });
  }
  const rows = Array.from(merged.values());
  return { rows, totalCents: rows.reduce((s, r) => s + (r.lineCents ?? 0), 0) };
}

export function exampleLine(kitchen: ExampleKitchen) {
  return DEMO_LINES.find((l) => l.id === kitchen.lineId)!;
}
