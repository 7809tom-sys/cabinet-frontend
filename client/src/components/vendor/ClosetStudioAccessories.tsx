import { useMemo, useState } from "react";
import { masterTracProduct } from "@/lib/closet";
import {
  STUDIO_BASKET_FRAME_HEX, STUDIO_BASKET_LINER_PLACEHOLDER_HEX, STUDIO_BASKET_REFERENCE_OPTIONS, STUDIO_PART_KINDS, canStageStudioPart, studioPartReferences,
  type StudioDesign, type StudioKind,
} from "@/lib/vendorClosetStudio";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const PARTS: Record<StudioKind, { title: string; subtitle: string; filter: string }> = {
  shelf: { title: "Adjustable shelf", subtitle: "Straight shelf · snaps to a free height", filter: "Shelves" },
  rod: { title: "Hanging rod", subtitle: "Chrome rod and cups · snaps to a free height", filter: "Rods" },
  drawer: { title: "Small slab drawer", subtitle: "Matching MasterTrac front · snaps clear of other parts", filter: "Drawers" },
  shoe: { title: "Shoe organizer", subtitle: "Shoe basket · 45° illustrative pitch, snaps to an open span", filter: "Shoes" },
};

const FILTERS = ["All", "Shelves", "Rods", "Drawers", "Shoes", "Baskets", "Corners"] as const;
type AccessoryFilter = (typeof FILTERS)[number];

function Thumbnail({ kind }: { kind: "shelf" | "rod" | "drawer" | "shoe" | "basket" | "corner" }) {
  const common = { width: 36, height: 36, viewBox: "0 0 36 36", "aria-hidden": true };
  if (kind === "rod") return <svg {...common}><rect x="4" y="16" width="28" height="4" rx="2" fill="#8d9390" /><circle cx="6" cy="18" r="3" fill="#b7b1a6" /><circle cx="30" cy="18" r="3" fill="#b7b1a6" /></svg>;
  if (kind === "drawer") return <svg {...common}><rect x="6" y="8" width="24" height="20" rx="2" fill="#c4a27a" stroke="#6d4b2c" /><rect x="14" y="16" width="8" height="2" rx="1" fill="#f4efe6" /></svg>;
  if (kind === "shoe") return <svg {...common}><path d="M6 24 L28 12" stroke="#6d4b2c" strokeWidth="4" strokeLinecap="round" /><path d="M8 26 L30 16" stroke="#8d9390" strokeWidth="2" /></svg>;
  if (kind === "basket") return <svg {...common}><rect x="7" y="10" width="22" height="16" rx="2" fill={STUDIO_BASKET_LINER_PLACEHOLDER_HEX} stroke={STUDIO_BASKET_FRAME_HEX} strokeWidth="2.4" /><rect x="8" y="11" width="20" height="3" fill={STUDIO_BASKET_FRAME_HEX} /></svg>;
  if (kind === "corner") return <svg {...common}><path d="M8 8 H28 A20 20 0 0 1 8 28 Z" fill="#e9c38e" stroke="#92623c" strokeWidth="1.5" /></svg>;
  return <svg {...common}><rect x="6" y="15" width="24" height="4" rx="1" fill="#c4a27a" /><rect x="8" y="8" width="3" height="20" fill="#8a735c" /><rect x="25" y="8" width="3" height="20" fill="#8a735c" /></svg>;
}

/** Left-column build palette. Every accessory, including the shoe organizer and pull-out baskets, is a full-width tile. */
export function ClosetStudioAccessories({ design, selectedBay, hasBay, partToPlace, onPlaceKind, onPlaceBasket, onOpenCorner }: {
  design: StudioDesign;
  selectedBay: number;
  hasBay: boolean;
  partToPlace: StudioKind | null;
  onPlaceKind: (kind: StudioKind) => void;
  onPlaceBasket: (sku: string) => void;
  onOpenCorner: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccessoryFilter>("All");
  const bay = design.bays[selectedBay];
  const needle = query.trim().toLowerCase();
  const show = (haystack: string, group: AccessoryFilter) => (filter === "All" || filter === group) && (!needle || haystack.toLowerCase().includes(needle));
  const prices = useMemo(() => {
    const listed: Partial<Record<StudioKind, number>> = {};
    if (!hasBay) return listed;
    for (const kind of STUDIO_PART_KINDS) {
      const products = studioPartReferences(design, selectedBay, kind);
      if (products?.[0]) listed[kind] = products[0].listEachUsd;
    }
    return listed;
  }, [design, hasBay, selectedBay]);

  return <div className="flex flex-col gap-3" data-testid="vendor-accessory-palette">
    <label className="block text-[11px] font-semibold text-[#5c564c]">Search accessories
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Shelf, rod, shoe basket…" aria-label="Search accessories" className="mt-1 h-11 w-full rounded-lg border border-[#dfd8cc] bg-white px-3 text-sm font-normal text-[#2c3832]" />
    </label>
    <div role="group" aria-label="Accessory categories" className="flex flex-wrap gap-1.5">
      {FILTERS.map((entry) => <button key={entry} type="button" aria-pressed={filter === entry} onClick={() => setFilter(entry)} className={`min-h-11 rounded-full px-3 text-xs font-semibold ${filter === entry ? "bg-[#244338] text-white" : "border border-[#dfd8cc] bg-white text-[#4d5852]"}`}>{entry}</button>)}
    </div>
    <div className="grid gap-2">
      {(["shoe", "shelf", "rod", "drawer"] as const).map((kind) => {
        const part = PARTS[kind];
        if (!show(`${part.title} ${part.subtitle} ${kind === "shoe" ? "shoe basket" : ""}`, part.filter)) return null;
        const error = hasBay ? canStageStudioPart(design, selectedBay, kind) : "Add a tower on this wall before placing a part.";
        return <button key={kind} type="button" data-testid={`vendor-accessory-${kind}`} draggable={!error} onDragStart={(event) => { if (error) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-vendor-closet-part", kind); event.dataTransfer.effectAllowed = "copy"; }} disabled={Boolean(error)} aria-pressed={partToPlace === kind} title={error ?? `Place ${part.title.toLowerCase()} in Tower ${selectedBay + 1}`} onClick={() => onPlaceKind(kind)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left disabled:opacity-45 ${partToPlace === kind ? "border-[#b47d48] bg-[#fff2dc]" : "border-[#e2ddd3] bg-white hover:border-[#bc9b74]"}`}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f6f1e8]"><Thumbnail kind={kind === "shoe" ? "shoe" : kind} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#2c3832]">{part.title}</span><span className="block text-xs leading-snug text-[#6e655c]">{part.subtitle}</span></span>
          {prices[kind] != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-[#3e4a44]">{money(prices[kind]!)}</span>}
        </button>;
      })}
      {[...STUDIO_BASKET_REFERENCE_OPTIONS].sort((a, b) => {
        const rank = (entry: (typeof STUDIO_BASKET_REFERENCE_OPTIONS)[number]) => !bay ? 1 : entry.nominalWidthIn === bay.widthIn ? 0 : entry.nominalWidthIn < bay.widthIn ? 1 : 2;
        return rank(a) - rank(b) || b.nominalHeightIn - a.nominalHeightIn;
      }).map((entry) => {
        const label = `${entry.nominalHeightIn} in pull-out basket, ${entry.nominalWidthIn} in wide`;
        if (!show(`${label} shoe basket pull-out SKU ${entry.sku}`, "Baskets")) return null;
        const product = masterTracProduct(entry.sku);
        const tooWide = Boolean(bay) && entry.nominalWidthIn > bay.widthIn;
        const error = !hasBay ? "Add a tower on this wall before placing a basket." : tooWide ? `SKU ${entry.sku} is ${entry.nominalWidthIn} in wide and this bay is ${bay.widthIn} in. Baskets are never cut to fit.` : null;
        return <button key={entry.sku} type="button" data-testid={`vendor-accessory-basket-${entry.sku}`} draggable={!error} onDragStart={(event) => { if (error) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-vendor-closet-part", `basket:${entry.sku}`); event.dataTransfer.effectAllowed = "copy"; }} disabled={Boolean(error)} title={error ?? `Place this basket in the first open span of Tower ${selectedBay + 1}`} onClick={() => onPlaceBasket(entry.sku)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2ddd3] bg-white px-3 py-2 text-left hover:border-[#bc9b74] disabled:opacity-45">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#e7f0f0]"><Thumbnail kind="basket" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#2c3832]">{entry.nominalHeightIn}″ × {entry.nominalWidthIn}″ pull-out basket</span><span className="block text-xs leading-snug text-[#6e655c]">Shoe and storage basket · SKU {entry.sku} · snaps between the fixed shelves</span></span>
          {product && <span className="shrink-0 text-xs font-semibold tabular-nums text-[#3e4a44]">{money(product.listEachUsd)}</span>}
        </button>;
      })}
      {show("29.5 inch curved corner shelf", "Corners") && <button type="button" aria-label="Plan 29.5-inch curved corner shelf" data-testid="vendor-accessory-corner" onClick={onOpenCorner} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#c8b08f] bg-[#fff8ed] px-3 py-2 text-left hover:border-[#a97946]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f6ead6]"><Thumbnail kind="corner" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#60462e]">29.5″ curved corner shelf</span><span className="block text-xs leading-snug text-[#806348]">Opens tower parts so you can plan the corner</span></span>
      </button>}
    </div>
  </div>;
}
