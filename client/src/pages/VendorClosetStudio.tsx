import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Download, FileText, Layers3, Move3D, Plus, RotateCcw, Ruler, ShoppingBag, Trash2, WandSparkles } from "lucide-react";
import { VendorClosetScene } from "@/components/vendor/VendorClosetScene";
import { MASTERTRAC_PRICE_DATE, masterTracProduct, masterTracPublicReferenceCatalog, type MasterTracPublicReference } from "@/lib/closet";
import {
  addStudioBay, addStudioBasketPlacement, addStudioConnectedCorner, addStudioCornerShelf, canStageStudioPart, changeStudioFinish, configureStudioBayCut, createStudioDesign, createStudioReviewDemo, MODE_RECOMMENDATIONS, moveStudioBasketPlacement, moveStudioCornerShelf, moveStudioItem, removeStudioBasketPlacement, removeStudioCornerShelf, studioBays, studioCornerShelfSku, updateStudioBasketPlacement,
  restoreStudioDesign, snapStudioPart, STUDIO_FINISHES, STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, STUDIO_MODES, STUDIO_PART_KINDS, STUDIO_WALLS,
  STUDIO_BASKET_REFERENCE_OPTIONS, STUDIO_CORNER_IDS, STUDIO_FIT_CAPABILITY_REGISTRY, replaceStudioWallBays, studioBayCut, studioBasketDesignError, studioBasketPlacementsForWall, studioCollision, studioCornerIdsForWall, studioCornerMeasuredGap, studioCornerShelves, studioCornerDesignError, studioFixedBottom, studioFixedTop, studioItemHeight, studioPartReferences, studioStockWidth, studioTakeoff, studioWallLength, studioWallOccupancy, studioWidth, switchStudioWall,
  type StudioBay, type StudioCornerId, type StudioCornerShelfMount, type StudioDesign, type StudioItem, type StudioKind, type StudioMode, type StudioWall,
} from "@/lib/vendorClosetStudio";

const STORAGE_KEY = "vendor-closet-studio:v1";
const card: Record<StudioKind, { title: string; subtitle: string; icon: string }> = {
  shelf: { title: "Adjustable shelf", subtitle: "An easy place for anything", icon: "▰" },
  rod: { title: "Hanging rod", subtitle: "Hang what you reach for", icon: "─" },
  drawer: { title: "Small slab drawer", subtitle: "Matching MasterTrac front + box", icon: "▤" },
  shoe: { title: "Shoe organizer", subtitle: "45° illustrative pitch · verify supplier fit", icon: "⌄" },
};
const SHOE_PITCH_CAVEAT = `${STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG}° illustrative shoe pitch — supplier fit and attachment must be verified.`;
const CORNER_PLANNING_CAVEAT = "29.5″ 2026-spec planning envelope only—not a curved profile, cut, support, connector, H-joint, or installation guide. The 2022 manual lists 29¼″ actual; verify supplier drawings and fit.";
// Operational trace only: lets release verification prove the matching lazy Studio asset reached production.
const STUDIO_RELEASE_TRACE = "corner-wall-basket-r1";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const wallNames: Record<StudioWall, string> = { back: "Back wall", left: "Left wall", right: "Right wall", front: "Front wall" };
const modeNames: Record<StudioMode, string> = { closet: "Closet", pantry: "Pantry", mudroom: "Mudroom" };
const cornerNames: Record<StudioCornerId, string> = { "back-left": "Back-left", "back-right": "Back-right", "front-left": "Front-left", "front-right": "Front-right" };
const finishSwatch: Record<StudioDesign["finish"], string> = {
  "Glacier White": "#f1f0eb", "Slate Rift": "#555553", "Spiced Mahogany": "#774d3a",
};
type StudioReference = ReturnType<typeof studioTakeoff>;

function downloadMaterialReference(design: StudioDesign, bill: StudioReference) {
  const lines = ["MASTERTRAC · MATERIAL REFERENCE ONLY", "March 1, 2022 customer List · not a checkout quote", `${modeNames[design.mode]} · ${design.finish} · ${design.mount} · all room walls aggregated`, "", "SKU,Description,Quantity,2022 List unit,2022 List extended"];
  bill.lines.forEach((line) => lines.push([line.sku, `"${line.label.replaceAll('"', '""')}"`, line.qty, line.unitUsd.toFixed(2), (line.qty * line.unitUsd).toFixed(2)].join(",")));
  lines.push("", `Historical List reference total,,,,${bill.subtotalUsd.toFixed(2)}`, "", "UNVERIFIED: " + bill.missing.join(" | "));
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "mastertrac-2022-list-reference.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function ReferenceRows({ bill, compact = false }: { bill: StudioReference; compact?: boolean }) {
  return <>
    {(["cleat", "panel", "shelf", "accessory", "hardware"] as const).map((section) => {
      const items = bill.lines.filter((line) => line.section === section);
      if (!items.length) return null;
      const heading = { cleat: "01 · Start with the cleat", panel: "02 · Uprights / shared sides", shelf: "03 · Shelves", accessory: "04 · Placed accessories", hardware: "05 · Verified hardware" }[section];
      return <section key={section} className={compact ? "mb-4" : "mb-6"}><h3 className="mb-2 border-b border-[#eae4da] pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#837565]">{heading}</h3>
        <div className={compact ? "space-y-2" : "space-y-3"}>{items.map((item) => <div key={`${section}-${item.sku}-${item.label}`} className="flex gap-3 text-xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#eae7df] font-semibold text-[#5e5449]">{item.qty}×</span>
          <div className="min-w-0 flex-1"><p className="font-semibold leading-snug text-[#343b3d]">{item.label}</p><p className="text-[11px] text-[#918779]">SKU {item.sku}{item.packNote ? ` · ${item.packNote}` : ""}</p></div>
          <span className="shrink-0 font-semibold tabular-nums text-[#343b3d]">{money(item.qty * item.unitUsd)}</span>
        </div>)}</div></section>;
    })}
    <div className="rounded-xl border border-[#e6d6bd] bg-[#fff6e6] p-3 text-[11px] leading-relaxed text-[#6c5b41]"><strong>Not an installation-ready bill.</strong> {bill.missing.join(" ")}</div>
  </>;
}

const STUDIO_SOURCE_CATALOG = masterTracPublicReferenceCatalog();
const STUDIO_SOURCE_CATEGORIES = Array.from(new Set(STUDIO_SOURCE_CATALOG.map((part) => part.category)));

function catalogDimensions(part: MasterTracPublicReference) {
  const values = [
    part.widthIn != null ? `W ${part.widthIn}″` : null,
    part.heightIn != null ? `H ${part.heightIn}″` : null,
    part.depthIn != null ? `D ${part.depthIn}″` : null,
    part.lengthIn != null ? `L ${part.lengthIn}″` : null,
    part.thicknessIn != null ? `T ${part.thicknessIn}″` : null,
  ].filter(Boolean);
  return values.length ? values.join(" · ") : "Source dimensions not published";
}

/** Complete public 2022 source catalog: discovery only, never a placement or installation claim. */
function SourceCatalogReference({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(() => STUDIO_SOURCE_CATALOG.filter((part) =>
    (category === "All" || part.category === category)
    && (!normalizedQuery || [part.sku, part.description, part.finish, part.category].some((value) => value.toLowerCase().includes(normalizedQuery))),
  ), [category, normalizedQuery]);
  const grouped = useMemo(() => STUDIO_SOURCE_CATEGORIES.map((name) => ({ name, parts: visible.filter((part) => part.category === name) })).filter((group) => group.parts.length), [visible]);
  const referenceOnlyCount = STUDIO_SOURCE_CATALOG.filter((part) => !part.placeable).length;
  const capabilityBySku = useMemo(() => new Map(STUDIO_FIT_CAPABILITY_REGISTRY.map((entry) => [entry.sku, entry])), []);

  return <section className={`border-t border-[#e8e0d6] ${compact ? "mt-4 pt-4" : "mt-6 pt-5"}`} data-testid="vendor-source-catalog">
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">MasterTrac source catalog</p>
    <h3 className="mt-1 font-serif text-lg text-[#29352f]">Every sourced part, clearly separated from placement.</h3>
    <p className="mt-2 text-[11px] leading-relaxed text-[#766f65]">{STUDIO_SOURCE_CATALOG.length} public {MASTERTRAC_PRICE_DATE} List records. This browser is a source reference—not a checkout quote or installation guide. {referenceOnlyCount} records are catalog-reference-only; the two historical curved corner SKUs and baskets 432897–432905 have separate, restricted <strong>visual-planning</strong> controls, never fit-verified placements.</p>
    <p className="mt-2 rounded-md bg-[#fff6e7] px-2 py-2 text-[10px] leading-relaxed text-[#76563a]">Corner shelves use a 29.5″ 2026 planning envelope while the 2022 manual says 29¼″ actual; no curve/profile, support, connector, or installation geometry is claimed. Historical baskets 432897–432905 use only sourced nominal size plus the Studio 14.5″ bay depth as a conservative visual envelope; rails, mounting offsets, travel, door/vertical clearances, and hardware remain unverified. The alternate 2026 basket SKUs are not substituted.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
      <label className="text-[10px] font-semibold text-[#766f65]">Find a source part<input aria-label="Search MasterTrac source catalog" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SKU, hamper, basket…" className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]" /></label>
      <label className="text-[10px] font-semibold text-[#766f65]">Category<select aria-label="Filter MasterTrac source catalog by category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-10 min-w-32 rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]"><option value="All">All categories</option>{STUDIO_SOURCE_CATEGORIES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    </div>
    <p className="mt-3 text-[10px] font-semibold text-[#766f65]">{visible.length} matching source record{visible.length === 1 ? "" : "s"}</p>
    <div className={`mt-2 ${compact ? "space-y-2" : "space-y-3"}`}>
      {grouped.map((group) => <details key={group.name} open={Boolean(normalizedQuery) || category === group.name} className="rounded-lg border border-[#e7e0d6] bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-[#4a554e]">{group.name} <span className="font-normal text-[#887d70]">· {group.parts.length}</span></summary>
        <div className="border-t border-[#eee8df] p-2">
          {group.parts.map((part) => { const capability = capabilityBySku.get(part.sku); return <article key={part.sku} className="border-b border-[#f0ebe3] px-1 py-2 last:border-0" data-testid={`vendor-source-part-${part.sku}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block text-[11px] leading-snug text-[#343b3d]">{part.description}</strong><span className="text-[10px] text-[#887d70]">SKU {part.sku} · {part.finish} · {catalogDimensions(part)}</span></div><span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#5c665f]">{money(part.packQty > 1 ? part.listPackUsd : part.listEachUsd)}</span></div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#876a4c]">{capability?.status === "visualPlanning" ? "Visual planning only · use the Tower corner planner; not a profile, fit, or installation confirmation" : "Reference only · not a Studio placement or fit confirmation"}{part.packQty > 1 ? ` · pack of ${part.packQty}` : ""}</p>
          </article>; })}
        </div>
      </details>)}
      {!grouped.length && <p className="rounded-md border border-dashed border-[#d8cbb9] p-3 text-xs text-[#766f65]">No public 2022 MasterTrac source record matches that search.</p>}
    </div>
  </section>;
}

function TabletMaterialDisclosure({ design, expanded, onToggle }: { design: StudioDesign; expanded: boolean; onToggle: () => void }) {
  const bill = useMemo(() => studioTakeoff(design), [design]);
  return <section className="rounded-xl border border-[#e1d8ca] bg-white" data-testid="vendor-tablet-material-disclosure">
    <button type="button" aria-label="Material reference details" aria-expanded={expanded} aria-controls="vendor-tablet-material-list" onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left">
      <span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#9c7450]">Material reference</span><strong className="mt-0.5 block text-xs text-[#303934]">2022 List · {money(bill.subtotalUsd)}</strong></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#6e655a] transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <div id="vendor-tablet-material-list" data-testid="vendor-tablet-material-list" className="max-h-[min(42dvh,370px)] overflow-y-auto border-t border-[#e8e0d6] px-3 py-3">
      <p className="mb-3 text-[11px] leading-relaxed text-[#776f64]">March 1, 2022 customer List. Historical reference only—<strong>not checkout pricing</strong>.</p>
      <ReferenceRows bill={bill} compact />
      <SourceCatalogReference compact />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e8e0d6] pt-3"><span className="text-[10px] font-bold uppercase tracking-wider text-[#766a5d]">2022 List reference</span><strong className="font-serif text-xl tabular-nums text-[#24322e]" data-testid="vendor-reference-total">{money(bill.subtotalUsd)}</strong></div>
      <button type="button" onClick={() => downloadMaterialReference(design, bill)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#243b32] text-xs font-bold text-white hover:bg-[#385348]"><Download className="h-4 w-4" /> Download material reference</button>
    </div>}
  </section>;
}

function CutToFitControls({ design, bay, onApply }: { design: StudioDesign; bay: StudioBay; onApply: (stockWidthIn: 18 | 24 | 30, installedWidthIn: number) => void }) {
  const cut = studioBayCut(bay);
  const [stockWidthIn, setStockWidthIn] = useState<18 | 24 | 30>(studioStockWidth(bay) as 18 | 24 | 30);
  const [installedWidth, setInstalledWidth] = useState(cut ? String(cut.installedWidthIn) : "");
  if (design.mount !== "floor") return <section className="mt-3 border-t border-[#e8e0d6] pt-3" data-testid="vendor-cut-to-fit"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Cut-to-fit shelves</p><p className="mt-1 text-[10px] leading-relaxed text-[#766f65]">Field-cut planning is documented here only for floor-mounted straight shelves. Hanging-panel shelf cuts are not offered.</p></section>;
  const apply = () => {
    const measured = Number(installedWidth);
    if (Number.isFinite(measured)) onApply(stockWidthIn, measured);
  };
  return <section className="mt-3 border-t border-[#e8e0d6] pt-3" data-testid="vendor-cut-to-fit">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Cut-to-fit shelves</p><p className="mt-1 text-[10px] leading-relaxed text-[#766f65]">Straight fixed + adjustable shelves only.</p></div>{cut && <span className="rounded-full bg-[#f9ead7] px-2 py-1 text-[10px] font-bold text-[#875c34]">Cut planned</span>}</div>
    <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-[#766f65]">Stock shelf<select aria-label="Cut-to-fit stock shelf width" value={stockWidthIn} onChange={(event) => setStockWidthIn(Number(event.target.value) as 18 | 24 | 30)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]"><option value="18">18 in stock</option><option value="24">24 in stock</option><option value="30">30 in stock</option></select></label><label className="text-[10px] text-[#766f65]">Measured opening<input aria-label="Installed clear shelf width in inches" type="number" min="12" max={stockWidthIn} step="0.25" inputMode="decimal" value={installedWidth} onChange={(event) => setInstalledWidth(event.target.value)} placeholder={cut ? String(cut.installedWidthIn) : "Enter inches"} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]" /></label></div>
    <div className="mt-2 flex gap-2"><button type="button" onClick={apply} disabled={!installedWidth} className="min-h-11 flex-1 rounded-md border border-[#b78151] bg-[#fff7ed] px-2 text-[11px] font-semibold text-[#6d4b2c] disabled:opacity-40">Apply measured width</button>{cut && <button type="button" onClick={() => onApply(stockWidthIn, stockWidthIn)} className="min-h-11 rounded-md border border-[#dfd8cc] bg-white px-3 text-[11px] font-semibold text-[#5d655f]">Full stock</button>}</div>
    {cut ? <p className="mt-2 rounded-md bg-[#fff6e7] px-2 py-2 text-[10px] leading-relaxed text-[#6d563c]">Installed <strong>{cut.installedWidthIn}″</strong> from <strong>{cut.stockWidthIn}″</strong> stock · planning difference <strong>{cut.offcutIn}″</strong>. Full stock SKU/List remains in the reference.</p> : <p className="mt-2 text-[10px] leading-relaxed text-[#766f65]">Measure between finished uprights. Adjustable shelves require the manufacturer template at the cut edge; fixed shelves require the connector-hole jig. Not a cutting or drilling guide.</p>}
  </section>;
}

function CornerPlanningControls({ plannerId, design, selectedCornerId, onSelect, onAdd, onBuild, onMove, onRemove, canUndo, onUndo }: {
  plannerId: string;
  design: StudioDesign;
  selectedCornerId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number) => void;
  onBuild: (cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number) => void;
  onMove: (id: string, elevationIn: number) => void;
  onRemove: (id: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const [cornerId, setCornerId] = useState<StudioCornerId>("back-right");
  const [mount, setMount] = useState<StudioCornerShelfMount>("fixed");
  const [elevation, setElevation] = useState("36");
  const availableCornerIds = studioCornerIdsForWall(design.wall);
  const activeCornerId = availableCornerIds.includes(cornerId) ? cornerId : availableCornerIds[0];
  const shelves = studioCornerShelves(design).filter((shelf) => shelf.wallIds.includes(design.wall));
  const selected = shelves.find((shelf) => shelf.id === selectedCornerId) ?? null;
  const gap = selected ? studioCornerMeasuredGap(design, selected) : null;
  const hasIncidentTower = selected ? selected.wallIds.some((wallId) => studioBays(design, wallId).length > 0) : false;
  const fixedSku = studioCornerShelfSku(design.finish, "fixed");
  const adjustableSku = studioCornerShelfSku(design.finish, "adjustable");
  const add = () => {
    const parsed = Number(elevation);
    if (Number.isFinite(parsed)) onAdd(activeCornerId, mount, parsed);
  };
  return <section id={plannerId} className="mt-4 border-t border-[#e8e0d6] pt-3" data-corner-shelf-planner="true" data-testid="vendor-corner-planning-controls">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">29.5″ curved corner shelf</p><p className="mt-1 text-[10px] leading-relaxed text-[#766f65]">Start the corner first, then build each wall from its two outside edges. Visual planning only.</p></div>{canUndo && <button type="button" onClick={onUndo} className="min-h-10 shrink-0 rounded-md border border-[#dfd8cc] bg-white px-2 text-[10px] font-semibold text-[#5d655f]">Undo corner</button>}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] text-[#766f65]">Room corner<select aria-label="Corner shelf room corner" value={activeCornerId} onChange={(event) => setCornerId(event.target.value as StudioCornerId)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]">{availableCornerIds.map((id) => <option key={id} value={id}>{cornerNames[id]}</option>)}</select></label><label className="text-[10px] text-[#766f65]">Shelf type<select aria-label="Corner shelf type" value={mount} onChange={(event) => setMount(event.target.value as StudioCornerShelfMount)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]"><option value="fixed">Fixed · {fixedSku}</option><option value="adjustable">Adjustable · {adjustableSku}</option></select></label></div>
    <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-[#e3dbcf] bg-[#f8f5ef] p-1" role="group" aria-label="Highlight an incident 90-degree room corner">{availableCornerIds.map((id) => <button key={id} type="button" aria-label={`Highlight ${cornerNames[id]} 90-degree corner`} aria-pressed={activeCornerId === id} onClick={() => setCornerId(id)} className={`min-h-9 rounded px-2 text-[10px] font-semibold ${activeCornerId === id ? "bg-[#d9a86f] text-[#3a2b1f]" : "bg-white text-[#665c50] hover:bg-[#f1eadf]"}`}>{cornerNames[id]}</button>)}</div>
    <div className="mt-2"><label className="block text-[10px] text-[#766f65]">Planning elevation (in)<input aria-label="Corner shelf planning elevation in inches" type="number" min={studioFixedBottom(design) + 1} max={studioFixedTop(design) - 0.75} step="1" inputMode="decimal" value={elevation} onChange={(event) => setElevation(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]" /></label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => onBuild(activeCornerId, mount, Number(elevation))} className="min-h-11 rounded-md bg-[#244338] px-2 text-[11px] font-bold text-white hover:bg-[#315444]">Build visual corner</button><button type="button" onClick={add} className="min-h-11 rounded-md border border-[#b78151] bg-[#fff7ed] px-2 text-[11px] font-semibold text-[#6d4b2c]">Shelf only</button></div></div>
    <p className="mt-2 rounded-md bg-[#fff6e7] px-2 py-2 text-[10px] leading-relaxed text-[#76563a]" data-testid="vendor-corner-planning-caveat">{CORNER_PLANNING_CAVEAT}</p>
    {shelves.length > 0 && <div className="mt-3 space-y-2 border-t border-[#e8e0d6] pt-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Placed visual envelopes</p>{shelves.map((shelf) => <article key={shelf.id} className={`rounded-md border p-2 ${selected?.id === shelf.id ? "border-[#b78151] bg-[#fff8ed]" : "border-[#e6dfd5] bg-white"}`}><button type="button" onClick={() => onSelect(shelf.id)} aria-pressed={selected?.id === shelf.id} className="w-full text-left text-[11px] font-semibold text-[#39443f]">{shelf.mount === "fixed" ? "Fixed" : "Adjustable"} corner · SKU {shelf.sku} · {cornerNames[shelf.cornerId]} · {shelf.elevationIn} in</button>{selected?.id === shelf.id && <div className="mt-2 flex items-center gap-2"><button type="button" aria-label="Lower selected corner shelf one inch" onClick={() => onMove(shelf.id, shelf.elevationIn - 1)} className="h-10 w-10 rounded border border-[#dfd5c5] bg-white">−</button><span className="min-w-0 flex-1 text-center text-[10px] leading-relaxed text-[#766f65]">{!hasIncidentTower ? "No incident tower to align yet" : gap?.towerGapIn === 0 ? "Touches tower envelope" : `${gap?.towerGapIn}″ tower-envelope gap`} · verify assembly fit</span><button type="button" aria-label="Raise selected corner shelf one inch" onClick={() => onMove(shelf.id, shelf.elevationIn + 1)} className="h-10 w-10 rounded border border-[#dfd5c5] bg-white">+</button><button type="button" aria-label="Remove selected corner shelf" onClick={() => onRemove(shelf.id)} className="flex h-10 w-10 items-center justify-center rounded text-[#9b674d] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>}</article>)}</div>}
    {selected && <div className="mt-3 grid grid-cols-[80px_1fr] items-center gap-3 rounded-md border border-[#e4d7c5] bg-[#fffdf9] p-2" data-testid="vendor-corner-plan-elevation"><svg viewBox="0 0 80 80" role="img" aria-label={`Illustrative pie shelf inside the conservative plan envelope for ${cornerNames[selected.cornerId]}`} className="h-20 w-20"><path d="M8 8H72V72H8Z" fill="none" stroke="#92623c" strokeDasharray="3 2" strokeWidth="1.5" /><path d="M8 8H72A64 64 0 0 1 8 72Z" fill="#e9c38e" fillOpacity="0.72" stroke="#92623c" strokeWidth="2" /><path d="M8 8L38 8" stroke="#5e4835" strokeWidth="4" /><path d="M8 8L8 38" stroke="#5e4835" strokeWidth="4" /><text x="40" y="45" textAnchor="middle" fontSize="9" fill="#634328">29.5″</text></svg><div className="text-[10px] leading-relaxed text-[#655a4e]"><strong className="block text-[#39443f]">Plan + elevation parity</strong><span className="block">Plan: illustrative pie shelf inside the conservative 29.5″ square collision envelope at the {cornerNames[selected.cornerId].toLowerCase()} 90° room corner.</span><span className="block">Elevation: {selected.elevationIn}″ bottom · 0.75″ nominal board thickness.</span><span className="block">{selected.towerConnection === "visualAligned" ? "Both incident tower previews align to the envelope outside edges; this is not a physical connection." : "Tower alignment has not been planned yet."}</span><span className="block">Geometry source: 2026 spec p.13; pie shape is illustrative—verify supplier profile and support.</span></div></div>}
  </section>;
}

function BasketPlanningControls({ design, selectedBay, selectedBasketId, onSelect, onAdd, onMove, onUpdate, onRemove, canUndo, onUndo }: {
  design: StudioDesign;
  selectedBay: number;
  selectedBasketId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (sku: string, elevationIn: number) => void;
  onMove: (id: string, elevationIn: number) => void;
  onUpdate: (id: string, sku: string) => void;
  onRemove: (id: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const [sku, setSku] = useState(STUDIO_BASKET_REFERENCE_OPTIONS[0]?.sku ?? "");
  const [elevation, setElevation] = useState("24");
  const bay = design.bays[selectedBay];
  const baskets = studioBasketPlacementsForWall(design).filter((placement) => placement.bayId === bay?.id);
  const selected = baskets.find((placement) => placement.id === selectedBasketId) ?? null;
  const option = STUDIO_BASKET_REFERENCE_OPTIONS.find((entry) => entry.sku === sku);
  return <section className="mt-4 border-t border-[#e8e0d6] pt-3" data-testid="vendor-basket-planning-controls">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Pull-out basket visual planning</p><p className="mt-1 text-[10px] leading-relaxed text-[#766f65]">Historical SKU + nominal size in this tower only. Visual planning—not a rail, slide, door, clearance, or installation claim.</p></div>{canUndo && <button type="button" onClick={onUndo} className="min-h-10 shrink-0 rounded-md border border-[#dfd8cc] bg-white px-2 text-[10px] font-semibold text-[#5d655f]">Undo basket</button>}</div>
    {!bay ? <p className="mt-2 rounded-md bg-[#f7f2e9] px-2 py-2 text-[10px] leading-relaxed text-[#6d6255]">Add a tower on this wall before placing a basket visual plan.</p> : <><label className="mt-3 block text-[10px] text-[#766f65]">Historical basket source<select aria-label="Basket visual-planning source SKU" value={sku} onChange={(event) => setSku(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]">{STUDIO_BASKET_REFERENCE_OPTIONS.map((entry) => { const product = masterTracProduct(entry.sku); return <option key={entry.sku} value={entry.sku}>{entry.nominalHeightIn}″ H × {entry.nominalWidthIn}″ W · SKU {entry.sku} · {product ? money(product.listEachUsd) : "List unavailable"}</option>; })}</select></label><div className="mt-2 flex gap-2"><label className="min-w-0 flex-1 text-[10px] text-[#766f65]">Bottom elevation (in)<input aria-label="Basket visual-planning bottom elevation in inches" type="number" min={studioFixedBottom(design) + 1} max={studioFixedTop(design) - (option?.nominalHeightIn ?? 6)} step="1" inputMode="decimal" value={elevation} onChange={(event) => setElevation(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#dfd8cc] bg-white px-2 text-xs text-[#39443f]" /></label><button type="button" onClick={() => onAdd(sku, Number(elevation))} className="mt-[18px] min-h-10 shrink-0 rounded-md border border-[#b78151] bg-[#fff7ed] px-3 text-[11px] font-semibold text-[#6d4b2c]">Place visual basket</button></div></>}
    <p className="mt-2 rounded-md bg-[#fff6e7] px-2 py-2 text-[10px] leading-relaxed text-[#76563a]" data-testid="vendor-basket-planning-caveat">Visual planning only—supplier rail and clearance verification required. The conservative envelope uses sourced nominal width/height and the Studio 14.5″ bay depth; outer basket dimensions, rail/slide inclusion, mounting offsets, travel, door occlusion, vertical clearance, and hardware are not verified. 2026 SKUs 446807–446815 are not substituted or priced here.</p>
    {baskets.length > 0 && <div className="mt-3 space-y-2 border-t border-[#e8e0d6] pt-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Placed visual envelopes</p>{baskets.map((basket) => { const product = masterTracProduct(basket.sku); return <article key={basket.id} className={`rounded-md border p-2 ${selected?.id === basket.id ? "border-[#b78151] bg-[#fff8ed]" : "border-[#e6dfd5] bg-white"}`}><button type="button" onClick={() => onSelect(basket.id)} aria-pressed={selected?.id === basket.id} className="w-full text-left text-[11px] font-semibold text-[#39443f]">{basket.nominalHeightIn}″ H × {basket.nominalWidthIn}″ W basket · SKU {basket.sku} · Tower {selectedBay + 1} · {basket.bottomIn} in · {product ? money(product.listEachUsd) : "2022 List reference"}</button>{selected?.id === basket.id && <div className="mt-2 grid gap-2"><select aria-label="Edit selected basket visual-planning SKU" value={basket.sku} onChange={(event) => onUpdate(basket.id, event.target.value)} className="min-h-10 rounded border border-[#dfd5c5] bg-white px-2 text-[10px] text-[#39443f]">{STUDIO_BASKET_REFERENCE_OPTIONS.map((entry) => <option key={entry.sku} value={entry.sku}>{entry.nominalHeightIn}″ × {entry.nominalWidthIn}″ · {entry.sku}</option>)}</select><div className="flex items-center gap-2"><button aria-label="Lower selected basket one inch" onClick={() => onMove(basket.id, basket.bottomIn - 1)} className="h-10 w-10 rounded border border-[#dfd5c5] bg-white">−</button><span className="min-w-0 flex-1 text-center text-[10px] leading-relaxed text-[#766f65]">{basket.bottomIn}″ bottom · 14.5″ visual depth · supplier fit to verify</span><button aria-label="Raise selected basket one inch" onClick={() => onMove(basket.id, basket.bottomIn + 1)} className="h-10 w-10 rounded border border-[#dfd5c5] bg-white">+</button><button type="button" aria-label="Remove selected basket visual plan" onClick={() => onRemove(basket.id)} className="flex h-10 w-10 items-center justify-center rounded text-[#9b674d] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>}</article>; })}</div>}
    {selected && <div className="mt-3 grid grid-cols-[72px_1fr] items-center gap-3 rounded-md border border-[#e4d7c5] bg-[#fffdf9] p-2" data-testid="vendor-basket-plan-elevation"><svg viewBox="0 0 72 52" role="img" aria-label={`Plan envelope for basket ${selected.sku}`} className="h-14 w-[72px]"><path d="M8 10H64V42H8Z" fill="#c8d5d3" fillOpacity="0.72" stroke="#547173" strokeWidth="2" /><text x="36" y="29" textAnchor="middle" fontSize="8" fill="#355255">{selected.nominalWidthIn}″ × 14.5″</text></svg><div className="text-[10px] leading-relaxed text-[#655a4e]"><strong className="block text-[#39443f]">Plan + elevation parity</strong><span className="block">Plan: {selected.nominalWidthIn}″ nominal width × 14.5″ conservative visual depth in Tower {selectedBay + 1}.</span><span className="block">Elevation: {selected.bottomIn}″ bottom · {selected.nominalHeightIn}″ nominal height.</span><span className="block">Visual planning only—supplier rail and clearance verification required.</span></div></div>}
  </section>;
}

function WallPicker({ value, onChange }: { value: StudioWall; onChange: (wall: StudioWall) => void }) {
  return <div className="relative mx-auto h-28 w-36 rounded-[5px] border border-[#bcb8ae] bg-[#f8f6f2]" role="group" aria-label="Choose a wall in the room">
    {STUDIO_WALLS.map((wall) => <button key={wall} type="button" aria-label={`Select ${wallNames[wall]}`} aria-pressed={value === wall} onClick={() => onChange(wall)}
      className={`absolute rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b77c4b] ${value === wall ? "border-[#bd864f] bg-[#d7a46c] text-[#2d2620]" : "border-[#dfdcd4] bg-white text-[#857c70] hover:border-[#c3a47b]"} ${wall === "back" ? "left-7 right-7 top-[-6px] h-4" : wall === "front" ? "bottom-[-6px] left-7 right-7 h-4" : wall === "left" ? "left-[-7px] top-6 bottom-6 w-4" : "right-[-7px] top-6 bottom-6 w-4"}`} />)}
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-[0.2em] text-[#b0aba2]">ROOM</span>
  </div>;
}

/** Compact room map: wall state comes from persisted wall layouts, never the selected-wall label alone. */
function RoomOccupancyOverview({ design, onSelect }: { design: StudioDesign; onSelect: (wall: StudioWall) => void }) {
  const occupancy = studioWallOccupancy(design);
  const active = occupancy[design.wall];
  const position = (wall: StudioWall) => wall === "back" ? "left-5 right-5 top-1 h-5" : wall === "front" ? "bottom-1 left-5 right-5 h-5" : wall === "left" ? "left-1 top-5 bottom-5 w-5" : "right-1 top-5 bottom-5 w-5";
  return <section className="absolute right-3 top-3 z-10 w-36 rounded-xl border border-[#d8d0c3] bg-[#fffdf9]/95 p-2 shadow-lg backdrop-blur sm:right-5 sm:top-5" data-testid="vendor-room-overview" aria-label="Room occupancy overview">
    <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#8e6946]">Room overview</p>
    <div className="relative mx-auto mt-1 h-20 w-28 rounded border border-[#cfc6b8] bg-[#f6f3ed]" role="group" aria-label="Select a wall from room overview">
      {STUDIO_WALLS.map((wall) => {
        const state = occupancy[wall];
        return <button key={wall} type="button" aria-label={`${wallNames[wall]}: ${state.filled ? "filled" : "empty"}, ${state.usedSpanIn} of ${state.availableSpanIn} inches used`} aria-pressed={wall === design.wall} onClick={() => onSelect(wall)} className={`absolute rounded-sm border text-[7px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b77c4b] ${position(wall)} ${wall === design.wall ? "border-[#754c2d] bg-[#d5a06a] text-[#30231a]" : state.filled ? "border-[#75917e] bg-[#b9d2bb] text-[#234332] hover:bg-[#cce0ca]" : "border-[#d5cec3] bg-white text-[#8c8478] hover:bg-[#f0ebe2]"}`}>{state.filled ? "●" : "○"}</button>;
      })}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-semibold tracking-[0.12em] text-[#a59c8e]">ROOM</span>
    </div>
    <p className="mt-1 text-center text-[9px] leading-3 text-[#655d53]"><strong>{wallNames[design.wall]}</strong> · {active.usedSpanIn} / {active.availableSpanIn} in {active.filled ? "used" : "empty"}</p>
  </section>;
}
function Reference({ design, onClose }: { design: StudioDesign; onClose: () => void }) {
  const bill = useMemo(() => studioTakeoff(design), [design]);
  return <aside className="flex h-full min-h-0 flex-col border-l border-[#e0dbd2] bg-[#fcfaf6]" data-testid="vendor-reference-panel">
    <div className="flex items-start justify-between gap-2 border-b border-[#e5dfd5] p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ae7950]">Material reference</p><h2 className="mt-1 font-serif text-2xl text-[#282e32]">Every piece, accounted for.</h2><p className="mt-2 text-xs leading-relaxed text-[#776f64]">March 1, 2022 customer List. Historical reference only—<strong>not checkout pricing</strong>.</p></div>
      <button type="button" onClick={onClose} aria-label="Close material reference" className="min-h-11 rounded-lg border border-[#dfd7cc] px-3 text-xs min-[1800px]:hidden">Close</button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><ReferenceRows bill={bill} /><SourceCatalogReference /></div>
    <div className="border-t border-[#e5dfd5] bg-white p-5"><div className="flex items-baseline justify-between gap-4"><span className="text-xs font-semibold uppercase tracking-wider text-[#766a5d]">2022 List reference</span><strong className="font-serif text-3xl tabular-nums text-[#24322e]" data-testid="vendor-reference-total">{money(bill.subtotalUsd)}</strong></div><button type="button" onClick={() => downloadMaterialReference(design, bill)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#243b32] text-xs font-bold text-white hover:bg-[#385348]"><Download className="h-4 w-4" /> Download material reference</button></div>
  </aside>;
}

export default function VendorClosetStudio({ affiliateSlug }: { affiliateSlug?: string } = {}) {
  const storageKey = affiliateSlug ? `${STORAGE_KEY}:${affiliateSlug}` : STORAGE_KEY;
  const [isReviewDemo] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "mixed");
  const [design, setDesign] = useState<StudioDesign>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "mixed"
    ? createStudioReviewDemo() : restoreStudioDesign(typeof window !== "undefined" ? localStorage.getItem(storageKey) : null) ?? createStudioDesign());
  const [step, setStep] = useState<"start" | "studio">(isReviewDemo ? "studio" : "start");
  const [selectedBay, setSelectedBay] = useState(isReviewDemo ? 1 : 0);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null);
  const [cornerUndoDesign, setCornerUndoDesign] = useState<StudioDesign | null>(null);
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [basketUndoDesign, setBasketUndoDesign] = useState<StudioDesign | null>(null);
  const [partToPlace, setPartToPlace] = useState<StudioKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showRoom, setShowRoom] = useState(false);
  const [showTabletMaterial, setShowTabletMaterial] = useState(false);
  const [phonePanel, setPhonePanel] = useState<"tower" | "parts" | "material" | null>(null);
  const [cornerPlannerRequested, setCornerPlannerRequested] = useState(false);
  const [extraPart, setExtraPart] = useState<StudioKind | "">("");
  const [savedDraft] = useState(() => typeof window !== "undefined" && Boolean(restoreStudioDesign(localStorage.getItem(storageKey))));
  useEffect(() => { if (!isReviewDemo) localStorage.setItem(storageKey, JSON.stringify(design)); }, [design, isReviewDemo, storageKey]);
  useEffect(() => {
    if (!cornerPlannerRequested) return;
    const timer = window.setTimeout(() => {
      const planners = Array.from(document.querySelectorAll<HTMLElement>("[data-corner-shelf-planner]"));
      const visiblePlanner = planners.find((planner) => {
        const { width, height } = planner.getBoundingClientRect();
        return width > 0 && height > 0;
      }) ?? planners[0];
      visiblePlanner?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      setCornerPlannerRequested(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cornerPlannerRequested, phonePanel]);
  const hasBay = Boolean(design.bays[selectedBay]);
  const bay = design.bays[selectedBay] ?? { id: "empty-wall", widthIn: 24, items: [] as StudioItem[] };
  const currentItem = bay.items.find((item) => item.id === selectedItem) ?? null;
  const recommendation = MODE_RECOMMENDATIONS[design.mode];
  const updateDesign = (next: StudioDesign) => { setDesign(next); setNotice(null); };
  const changeFinish = (finish: StudioDesign["finish"]) => {
    const result = changeStudioFinish(design, finish);
    if (!result.ok) { setNotice(result.reason); return; }
    updateDesign(result.design);
  };
  const place = (bayIndex: number, bottomIn: number, kind: StudioKind) => {
    if (!design.bays[bayIndex]) { setNotice("Add a tower to this wall before placing a part."); return; }
    const result = snapStudioPart(design, bayIndex, kind, bottomIn, crypto.randomUUID());
    if (!result.ok) { setNotice(result.reason); return; }
    updateDesign(result.design); setSelectedBay(bayIndex); setSelectedItem(result.item.id); setPartToPlace(null);
  };
  const changeElevation = (item: StudioItem, bottomIn: number) => {
    const result = moveStudioItem(design, selectedBay, item.id, bottomIn);
    if (!result.ok) { setNotice(result.reason); return; }
    updateDesign(result.design);
  };
  const removeItem = (item: StudioItem) => { updateDesign(replaceStudioWallBays(design, design.wall, design.bays.map((b, index) => index === selectedBay ? { ...b, items: b.items.filter((part) => part.id !== item.id) } : b))); setSelectedItem(null); };
  const addCornerShelf = (cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number) => {
    const result = addStudioCornerShelf(design, cornerId, mount, elevationIn, crypto.randomUUID());
    if (!result.ok) { setNotice(result.reason); return; }
    setCornerUndoDesign(design); updateDesign(result.design); setSelectedCornerId(result.shelf.id); setSelectedItem(null);
  };
  const buildConnectedCorner = (cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number) => {
    const result = addStudioConnectedCorner(design, cornerId, mount, elevationIn, crypto.randomUUID());
    if (!result.ok) { setNotice(result.reason); return; }
    const primaryWall: StudioWall = cornerId.startsWith("back") ? "back" : "front";
    setCornerUndoDesign(design); updateDesign(switchStudioWall(result.design, primaryWall)); setSelectedBay(0); setSelectedCornerId(result.shelf.id); setSelectedItem(null);
  };
  const moveCornerShelf = (id: string, elevationIn: number) => {
    const result = moveStudioCornerShelf(design, id, elevationIn);
    if (!result.ok) { setNotice(result.reason); return; }
    setCornerUndoDesign(design); updateDesign(result.design); setSelectedCornerId(id);
  };
  const removeCornerShelf = (id: string) => { setCornerUndoDesign(design); updateDesign(removeStudioCornerShelf(design, id)); setSelectedCornerId(null); };
  const undoCorner = () => { if (!cornerUndoDesign) return; setDesign(cornerUndoDesign); setCornerUndoDesign(null); setNotice("Corner planning change undone."); setSelectedCornerId(null); };
  const addBasket = (sku: string, elevationIn: number) => {
    const result = addStudioBasketPlacement(design, selectedBay, sku, elevationIn, crypto.randomUUID());
    if (!result.ok) { setNotice(result.reason); return; }
    setBasketUndoDesign(design); updateDesign(result.design); setSelectedBasketId(result.placement.id); setSelectedItem(null);
  };
  const moveBasket = (id: string, elevationIn: number) => {
    const result = moveStudioBasketPlacement(design, id, elevationIn);
    if (!result.ok) { setNotice(result.reason); return; }
    setBasketUndoDesign(design); updateDesign(result.design); setSelectedBasketId(result.placement.id); setSelectedItem(null);
  };
  const updateBasket = (id: string, sku: string) => {
    const result = updateStudioBasketPlacement(design, id, sku);
    if (!result.ok) { setNotice(result.reason); return; }
    setBasketUndoDesign(design); updateDesign(result.design); setSelectedBasketId(result.placement.id); setSelectedItem(null);
  };
  const removeBasket = (id: string) => { setBasketUndoDesign(design); updateDesign(removeStudioBasketPlacement(design, id)); setSelectedBasketId(null); };
  const undoBasket = () => { if (!basketUndoDesign) return; setDesign(basketUndoDesign); setBasketUndoDesign(null); setNotice("Basket visual-planning change undone."); setSelectedBasketId(null); };
  const addNeighbor = () => {
    const result = addStudioBay(design);
    if (!result.ok) { setNotice(result.reason); return; }
    updateDesign(result.design); setSelectedBay(result.design.bays.length - 1); setSelectedItem(null);
  };
  const pickPart = (kind: StudioKind) => { if (!hasBay) { setNotice("Add a tower to this wall before choosing a part."); return; } setPartToPlace(kind); setSelectedItem(null); setPhonePanel(null); setNotice(`Now tap Tower ${selectedBay + 1} in 3D, or drag the part into any tower bay. Its height will snap to a free position.`); };
  const openCornerShelfPlanner = () => {
    setPartToPlace(null); setSelectedItem(null); setPhonePanel("tower"); setCornerPlannerRequested(true);
  };
  const selectedWidth = (widthIn: 18 | 24 | 30) => {
    if (!hasBay) { setNotice("Add a tower to this wall before changing its width."); return; }
    if (bay.widthIn === widthIn) return;
    const candidate = replaceStudioWallBays(design, design.wall, design.bays.map((b, index) => index === selectedBay ? { ...b, widthIn, stockWidthIn: undefined } : b));
    if (studioWidth(candidate) > studioWallLength(candidate)) { setNotice("This tower would exceed the selected wall. Choose a narrower bay or a longer wall."); return; }
    const cornerError = studioCornerDesignError(candidate);
    if (cornerError) { setNotice(cornerError); return; }
    const basketError = studioBasketDesignError(candidate);
    if (basketError) { setNotice(basketError); return; }
    for (const item of bay.items) if (!studioPartReferences(candidate, selectedBay, item.kind)) { setNotice(`The ${widthIn} in bay has no matching ${item.kind} SKU in the selected finish. Remove or change that item first.`); return; }
    updateDesign(candidate);
  };
  const changeCutToFit = (stockWidthIn: 18 | 24 | 30, installedWidthIn: number) => {
    const result = configureStudioBayCut(design, selectedBay, stockWidthIn, installedWidthIn);
    if (!result.ok) { setNotice(result.reason); return; }
    updateDesign(result.design);
  };
  const setMount = (mount: StudioDesign["mount"]) => {
    if (design.mount === mount) return;
    const candidate: StudioDesign = { ...design, mount };
    const cornerError = studioCornerDesignError(candidate);
    if (cornerError) { setNotice(cornerError); return; }
    const basketError = studioBasketDesignError(candidate);
    if (basketError) { setNotice(basketError); return; }
    for (const wallId of STUDIO_WALLS) {
      const scoped = switchStudioWall(candidate, wallId);
      for (let i = 0; i < scoped.bays.length; i++) for (const item of scoped.bays[i].items) {
        const error = studioCollision(scoped, i, item, item.id);
        if (error) { setNotice(`Move your placed items first: ${error}`); return; }
      }
    }
    updateDesign(candidate); setSelectedItem(null);
  };
  const onChangeWall = (wall: StudioWall) => {
    updateDesign(switchStudioWall(design, wall)); setSelectedBay(0); setSelectedItem(null); setPartToPlace(null); setSelectedCornerId(null); setShowRoom(false);
  };
  const changeRoomDimension = (field: "wallWidthIn" | "roomDepthIn", value: number) => {
    if (!Number.isFinite(value) || value < 24 || value > 360) { setNotice("Room dimensions must be 24–360 in."); return; }
    const candidate = { ...design, [field]: value };
    for (const wallId of STUDIO_WALLS) {
      const scoped = switchStudioWall(candidate, wallId);
      if (studioWidth(scoped) > studioWallLength(scoped)) { setNotice(`${wallNames[wallId]} is too short for ${studioWidth(scoped)} in of connected towers.`); return; }
    }
    const cornerError = studioCornerDesignError(candidate);
    if (cornerError) { setNotice(cornerError); return; }
    const basketError = studioBasketDesignError(candidate);
    if (basketError) { setNotice(basketError); return; }
    updateDesign(candidate);
  };
  const reset = () => { if (confirm("Start a new local Closet Studio draft? This replaces only this browser's Studio draft, not any saved Cabinet Dealz Designer plan.")) { updateDesign(createStudioDesign()); setStep("start"); setSelectedBay(0); setSelectedItem(null); setPartToPlace(null); } };
  if (step === "start") return <div className="min-h-screen bg-[#f2f0ea] text-[#26332d]" data-testid="vendor-mode-gate" data-studio-release={STUDIO_RELEASE_TRACE}>
    <header className="flex items-center justify-between gap-2 border-b border-[#dfded6] bg-[#fbfaf7] px-5 py-4 sm:px-9"><a href="/" aria-label="Cabinet Dealz home" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#244338] text-lg font-semibold text-[#f2e3c3]">M</span><span><strong className="block font-serif text-lg leading-none">MasterTrac Studio</strong><span className="text-[10px] uppercase tracking-[0.21em] text-[#8a8276]">Cabinet Dealz closet program</span></span></a><a href="/design" data-testid="closet-to-kitchen" aria-label="Kitchen Designer" className="flex h-10 shrink-0 items-center rounded-lg border border-[#d7d0c5] bg-white px-3 text-xs font-bold text-[#244338] hover:bg-[#f0ede6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244338]">Kitchen<span className="hidden sm:inline"> Designer</span></a></header>
    <main className="mx-auto grid min-h-[calc(100vh-75px)] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_0.92fr] lg:px-12">
      <div><div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#d7c8ae] bg-[#f9f4e9] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#97734a]"><WandSparkles className="h-4 w-4" /> Make room for real life</div><h1 className="max-w-xl font-serif text-5xl leading-[1.08] text-[#253c32] sm:text-6xl">Your space. <em className="font-normal text-[#b88151]">Your way.</em></h1><p className="mt-6 max-w-lg text-base leading-7 text-[#716e64]">Build a beautiful closet one tower at a time. Choose what the room is for; then place shelves, rods, drawers, and shoe organizers right where you want them.</p>
      <h2 className="mb-3 mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[#60594e]">First, what are we designing?</h2><div className="grid max-w-lg grid-cols-3 gap-2 sm:gap-3">{STUDIO_MODES.map((mode) => <button key={mode} type="button" onClick={() => updateDesign({ ...design, mode })} aria-pressed={design.mode === mode} className={`min-h-24 rounded-xl border p-3 text-left transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba8351] ${design.mode === mode ? "border-[#ba8351] bg-[#fffbf4] shadow-md" : "border-[#d9d5cb] bg-[#f9f8f4] hover:bg-white"}`}><span className="block text-lg">{mode === "closet" ? "◧" : mode === "pantry" ? "▧" : "⌂"}</span><strong className="mt-2 block text-xs sm:text-sm">{modeNames[mode]}</strong>{design.mode === mode && <Check className="float-right mt-[-18px] h-4 w-4 text-[#9e683a]" />}</button>)}</div>
        <button type="button" onClick={() => setStep("studio")} className="mt-7 flex h-13 min-h-12 w-full max-w-lg items-center justify-center gap-2 rounded-lg bg-[#244338] px-5 font-bold text-white shadow-lg shadow-[#244338]/15 transition-transform hover:bg-[#315444] active:scale-[0.98]">{savedDraft ? "Continue my local draft" : "Start with one tower"}<ArrowRight className="h-4 w-4" /></button><p className="mt-3 max-w-lg text-[11px] leading-relaxed text-[#868278]">Shown parts use the sourced March 2022 MasterTrac customer List only; no checkout or installation specification is implied.</p></div>
      <div className="relative min-h-[360px] overflow-hidden rounded-3xl bg-[#9b8978] shadow-[0_30px_90px_-50px_#43423a] lg:min-h-[560px]">
        <img src="/manus-storage/mastertrac-room-from-brochure_339f6cce.png" alt="MasterTrac closet inspiration from the manufacturer brochure; this is not the configured 3D design" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17241e]/75 via-transparent to-[#17241e]/5" />
        <div className="absolute bottom-0 left-0 right-0 p-7 text-white"><span className="rounded-full border border-white/60 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur">Brochure inspiration · not your configured design</span><p className="mt-5 max-w-sm font-serif text-3xl leading-tight">Beautifully organized, one tower at a time.</p></div>
      </div>
    </main>
  </div>;
  return <div className="flex h-[100dvh] min-h-[580px] flex-col overflow-hidden bg-[#e9e5dc] text-[#29352f]" data-testid="vendor-closet-studio" data-studio-release={STUDIO_RELEASE_TRACE}>
    <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#ded8cd] bg-[#fbfaf7] px-3 sm:px-5"><div className="flex min-w-0 items-center gap-2"><button type="button" aria-label="Back to room choice" title="Back to room choice" onClick={() => setStep("start")} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[#f0ede6]"><ArrowLeft className="h-5 w-5" /></button><a href="/" aria-label="Cabinet Dealz home" className="hidden h-8 w-8 items-center justify-center rounded-lg bg-[#244338] text-[#f2e3c3] sm:flex">M</a><div className="min-w-0"><strong className="block truncate font-serif text-base leading-none sm:text-lg">{modeNames[design.mode]} Studio</strong><span className="mt-1 block truncate text-[10px] text-[#897f73]">One tower at a time · {design.finish}</span></div></div>
      <div className="hidden items-center gap-1 rounded-full bg-[#eeeae1] p-1 md:flex">{STUDIO_MODES.map((mode) => <button type="button" key={mode} aria-pressed={mode === design.mode} onClick={() => updateDesign({ ...design, mode })} className={`rounded-full px-4 py-2 text-xs font-semibold ${mode === design.mode ? "bg-white text-[#314739] shadow-sm" : "text-[#81766a]"}`}>{modeNames[mode]}</button>)}</div>
      <div className="flex items-center gap-1"><button type="button" onClick={openCornerShelfPlanner} title="Add a 29.5-inch curved corner shelf" aria-label="Add 29.5-inch corner shelf" className="flex h-10 items-center gap-1 rounded-lg border border-[#c8b08f] bg-[#fff8ed] px-2 text-xs font-bold text-[#60462e] hover:border-[#a97946] hover:bg-[#fff2df]"><span aria-hidden="true" className="text-base">◔</span><span className="hidden min-[360px]:inline">Corner shelf</span></button><button type="button" onClick={() => { setShowRoom((open) => !open); setShowReference(false); setPhonePanel(null); }} aria-label="Room and wall settings" aria-expanded={showRoom} aria-controls="vendor-room-panel" className="hidden h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-[#eeeae1] min-[1024px]:flex min-[1800px]:hidden"><Ruler className="h-4 w-4" /><span>Room</span></button><button type="button" onClick={() => setShowHelp(!showHelp)} title="How to use the Studio" aria-label="How to use the Studio" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[#eeeae1]"><CircleHelp className="h-5 w-5" /></button><button type="button" onClick={reset} title="Start a new local draft" aria-label="Start a new local draft" className="hidden h-10 w-10 items-center justify-center rounded-lg hover:bg-[#eeeae1] sm:flex"><RotateCcw className="h-4 w-4" /></button></div>
    </header>
    <nav aria-label="Designer navigation" className="flex min-h-10 shrink-0 items-center gap-2 border-b border-[#ded8cd] bg-[#fbfaf7] px-3 text-xs sm:px-5"><label className="flex min-w-0 flex-1 items-center gap-2 text-[#766f65]"><span className="hidden shrink-0 font-semibold min-[520px]:inline">Finish</span><select aria-label="Available MasterTrac finish" value={design.finish} onChange={(event) => changeFinish(event.target.value as StudioDesign["finish"])} className="h-8 min-w-0 w-full max-w-52 rounded-md border border-[#d8cdbc] bg-white px-2 text-xs font-semibold text-[#39443f]" data-testid="vendor-finish-picker">{STUDIO_FINISHES.map((finish) => <option key={finish} value={finish}>{finish}</option>)}</select></label><span className="hidden min-w-0 truncate text-[#766f65] min-[700px]:inline">Building a kitchen instead?</span><a href="/design" data-testid="closet-to-kitchen" className="flex h-9 shrink-0 items-center rounded-lg px-3 font-bold text-[#244338] underline underline-offset-2 hover:bg-[#f0ede6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244338]">Kitchen<span className="hidden sm:inline"> Designer</span> <ArrowRight className="ml-1 h-3.5 w-3.5" /></a></nav>
    {isReviewDemo && <div className="z-20 flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-[#d5c5a8] bg-[#fff3dc] px-3 py-1 text-[11px] font-semibold text-[#6d4d27] sm:px-5" data-testid="vendor-review-demo-banner"><span>Review example · 2 towers · matching MasterTrac small slab front · not your saved design</span><a href="/closet" className="shrink-0 underline underline-offset-2">Start my own</a></div>}
    <div className="relative flex min-h-0 flex-1 overflow-hidden pb-16 min-[1024px]:pb-0">
      {showRoom && <button type="button" aria-label="Close room settings" onClick={() => setShowRoom(false)} className="fixed inset-0 z-30 bg-black/30 min-[1024px]:absolute min-[1800px]:hidden" />}
      <aside id="vendor-room-panel" className={`${showRoom ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[78dvh] rounded-t-2xl shadow-2xl min-[1024px]:absolute min-[1024px]:inset-y-0 min-[1024px]:left-0 min-[1024px]:w-[min(88vw,340px)] min-[1024px]:rounded-none" : "hidden"} shrink-0 flex-col overflow-y-auto border-r border-[#dfd8cc] bg-[#faf9f5] p-4 min-[1800px]:static min-[1800px]:z-auto min-[1800px]:flex min-[1800px]:w-[320px] min-[1800px]:max-h-none min-[1800px]:rounded-none min-[1800px]:shadow-none`} data-testid="vendor-controls">
        <button type="button" onClick={() => setShowRoom(false)} className="mb-3 min-h-11 self-end rounded-md border border-[#ded8cd] px-3 text-xs min-[1800px]:hidden">Close room settings</button>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ad784d]">01 / Set the room</p><h2 className="mt-2 font-serif text-2xl">A place for everything.</h2><p className="mb-5 mt-2 text-xs leading-5 text-[#82796c]">Pick a wall, then build one tower. The shared side appears automatically when you add the next one.</p>
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-[#eeeae1] p-1 md:hidden" role="group" aria-label="Room mode">{STUDIO_MODES.map((mode) => <button type="button" key={mode} aria-pressed={mode === design.mode} onClick={() => updateDesign({ ...design, mode })} className={`h-10 rounded-md text-[11px] font-semibold ${mode === design.mode ? "bg-white text-[#314739] shadow-sm" : "text-[#81766a]"}`}>{modeNames[mode]}</button>)}</div>
        <div className="mb-5 rounded-xl border border-[#e5dfd5] bg-white p-4"><WallPicker value={design.wall} onChange={onChangeWall} /><p className="mt-4 text-center text-xs font-semibold">{wallNames[design.wall]} <span className="font-normal text-[#857e73]">· {studioWallLength(design)} in available</span></p><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] text-[#81786d]">Room width (in)<input type="number" min="30" max="360" step="1" value={design.wallWidthIn} onChange={(e) => changeRoomDimension("wallWidthIn", Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-[#e1dbd1] bg-white px-2 text-sm text-[#364039]" /></label><label className="text-[10px] text-[#81786d]">Room depth (in)<input type="number" min="30" max="360" step="1" value={design.roomDepthIn} onChange={(e) => changeRoomDimension("roomDepthIn", Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-[#e1dbd1] bg-white px-2 text-sm text-[#364039]" /></label></div></div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#827b70]">How it mounts</p><div className="mb-5 grid grid-cols-2 gap-2">{(["floor", "hanging"] as const).map((mount) => <button key={mount} type="button" aria-pressed={design.mount === mount} onClick={() => setMount(mount)} className={`min-h-11 rounded-md border px-2 text-xs font-semibold ${design.mount === mount ? "border-[#b78151] bg-[#f6ebda]" : "border-[#e4dfd6] bg-white"}`}>{mount === "floor" ? "Floor-standing" : "Hanging"}</button>)}</div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#827b70]">Finish</p><div className="mb-5 space-y-1">{STUDIO_FINISHES.map((finish) => <button type="button" key={finish} aria-pressed={design.finish === finish} onClick={() => changeFinish(finish)} className={`flex h-10 w-full items-center gap-3 rounded-md px-2 text-left text-xs ${finish === design.finish ? "bg-[#eee8dd] font-bold" : "hover:bg-[#f0ede6]"}`}><span className="h-6 w-6 rounded border border-black/15" style={{ backgroundColor: finishSwatch[finish] }} />{finish}{finish === design.finish && <Check className="ml-auto h-4 w-4" />}</button>)}</div>
        <div className="mt-auto border-t border-[#e6e0d6] pt-4"><p className="text-[11px] leading-5 text-[#81776a]">Real catalog parts, rendered as an inviting room preview. Finish and dimensions are source-based; connections, accessories and lighting are illustrative.</p></div>
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 bg-[#e7e2d8]"><VendorClosetScene design={design} selectedBay={selectedBay} selectedCornerId={selectedCornerId} partToPlace={partToPlace} onSelectBay={(index) => { setSelectedBay(index); setSelectedItem(null); setSelectedCornerId(null); }} onPlace={place} onError={setNotice} />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-180px)] rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-md backdrop-blur sm:left-5 sm:top-5 sm:px-4"><p className="text-[9px] font-bold uppercase tracking-[0.19em] text-[#aa7950]">Your {modeNames[design.mode].toLowerCase()} takes shape</p>{hasBay ? <div className="mt-1 flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-[#976a46]" /> Tower {selectedBay + 1} of {design.bays.length}<span className="text-xs font-normal text-[#746c61]">· {bay.widthIn} in wide</span></div> : <div className="mt-1 flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-[#976a46]" /> Empty {wallNames[design.wall].toLowerCase()}<span className="text-xs font-normal text-[#746c61]">· 0 in used</span></div>}</div>
          <RoomOccupancyOverview design={design} onSelect={onChangeWall} />
          <div className={`pointer-events-none absolute left-3 rounded-lg bg-[#26362e]/90 px-3 py-2 text-[10px] font-medium text-white shadow-md sm:left-5 ${partToPlace && hasBay ? "top-24 sm:top-28" : "bottom-3 sm:bottom-5"}`}>{partToPlace && hasBay ? `Tap the ${bay.widthIn} in bay to place ${card[partToPlace].title.toLowerCase()}` : hasBay ? "Drag to rotate · tap a tower to select" : "This wall is empty · add a tower in the controls"}</div>
          {showHelp && <div className="absolute right-3 top-28 z-20 max-w-[250px] rounded-xl border border-[#e1d7c6] bg-[#fffdf9] p-4 text-xs leading-5 shadow-xl sm:right-5 sm:top-32"><button className="float-right font-semibold" aria-label="Close help" onClick={() => setShowHelp(false)}>✕</button><strong>Three simple moves</strong><ol className="mt-2 list-inside list-decimal space-y-1"><li>Choose a room mode and wall.</li><li>Drag a part into a tower, or tap a part then the tower.</li><li>Slide the height below until it locks clear of other parts.</li></ol><p className="mt-2 text-[#847564]">Hardware with unknown source quantities remains flagged, not guessed.</p></div>}
        </div>
        <div className="hidden shrink-0 border-t border-[#ded7cb] bg-[#faf9f5] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 sm:px-5 min-[1800px]:block" data-testid="vendor-tower-controls">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-1" role="group" aria-label="Select a tower">{design.bays.map((b, index) => <button type="button" key={b.id} onClick={() => { if (partToPlace) place(index, partToPlace === "rod" ? 64 : partToPlace === "shoe" ? 24 : partToPlace === "drawer" ? 20 : 42, partToPlace); else { setSelectedBay(index); setSelectedItem(null); } }} aria-label={partToPlace ? `Place ${card[partToPlace].title.toLowerCase()} in Tower ${index + 1}` : `Select Tower ${index + 1}`} aria-pressed={selectedBay === index} className={`min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold ${selectedBay === index ? "bg-[#244338] text-white" : "border border-[#dfd8cc] bg-white"}`}>Tower {index + 1}</button>)}</div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex"><label className="sr-only" htmlFor="vendor-bay-width-tablet">Selected tower clear width</label><select id="vendor-bay-width-tablet" aria-label="Selected tower clear width" value={bay.widthIn} onChange={(event) => selectedWidth(Number(event.target.value) as 18 | 24 | 30)} className="min-h-11 rounded-md border border-[#dfd8cc] bg-white px-2 text-xs min-[1800px]:hidden"><option value="18">18 in</option><option value="24">24 in</option><option value="30">30 in</option></select><button type="button" onClick={addNeighbor} disabled={design.bays.length >= 4} className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[#d6c3a6] bg-[#fff8ed] px-2 text-[11px] font-semibold text-[#72563b] disabled:opacity-40 sm:px-3"><Plus className="h-4 w-4" /> Add neighbor</button></div>
            <button type="button" onClick={addNeighbor} disabled={design.bays.length >= 4} className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[#d6c3a6] bg-[#fff8ed] px-2 text-[11px] font-semibold text-[#72563b] disabled:opacity-40 sm:hidden"><Plus className="h-4 w-4" /> Add neighbor</button>
          </div>
          <div className="flex items-center justify-between gap-2 pb-1 text-[11px] text-[#766f65] sm:hidden min-[1800px]:flex"><span><Ruler className="mr-1 inline h-3 w-3" /> {studioWidth(design)} of {studioWallLength(design)} in on {wallNames[design.wall].toLowerCase()}</span><div className="flex items-center gap-2"><span className="hidden min-[1800px]:inline">Tower width</span><select aria-label="Selected tower clear width" value={bay.widthIn} onChange={(event) => selectedWidth(Number(event.target.value) as 18 | 24 | 30)} className="min-h-11 rounded-md border border-[#dfd8cc] bg-white px-2 text-xs"><option value="18">18 in</option><option value="24">24 in</option><option value="30">30 in</option></select></div></div>
          <CornerPlanningControls plannerId="vendor-corner-shelf-planner-wide" design={design} selectedCornerId={selectedCornerId} onSelect={setSelectedCornerId} onAdd={addCornerShelf} onBuild={buildConnectedCorner} onMove={moveCornerShelf} onRemove={removeCornerShelf} canUndo={Boolean(cornerUndoDesign)} onUndo={undoCorner} />
        </div>
        <div className="hidden shrink-0 overflow-hidden border-t border-[#e4dcd0] bg-white px-3 py-1.5 sm:px-5 min-[1800px]:block min-[1800px]:py-2" data-testid="vendor-part-tray"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#997851]">02 / Slide a piece into Tower {selectedBay + 1}</span><span className="hidden text-[10px] text-[#938a7d] min-[1800px]:inline">Recommended for {modeNames[design.mode].toLowerCase()} · all verified SKUs remain available</span></div><div className="mt-1 flex gap-2 overflow-x-auto pb-1 min-[1800px]:mt-2">
          {recommendation.map((kind) => { const error = canStageStudioPart(design, selectedBay, kind); return <button key={kind} type="button" draggable={!error} onDragStart={(event) => { if (error) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-vendor-closet-part", kind); event.dataTransfer.effectAllowed = "copy"; }} disabled={Boolean(error)} aria-pressed={partToPlace === kind} onClick={() => pickPart(kind)} title={error ?? "Drag onto a tower or tap, then tap the tower"} className={`flex min-h-11 w-36 shrink-0 items-center gap-2 rounded-lg border px-3 text-left transition-transform active:scale-[0.97] disabled:opacity-40 min-[1800px]:min-h-14 ${partToPlace === kind ? "border-[#b47d48] bg-[#fff2dc]" : "border-[#e2ddd3] bg-[#f9f7f3] hover:border-[#bc9b74]"}`}><span className="text-xl text-[#8d755b] min-[1800px]:text-2xl">{card[kind].icon}</span><span><strong className="block text-[11px]">{card[kind].title}</strong><span className="hidden text-[9px] text-[#91867b] min-[1800px]:block">{card[kind].subtitle}</span></span></button>; })}
          <button type="button" aria-label="Plan 29.5-inch curved corner shelf" onClick={openCornerShelfPlanner} className="flex min-h-11 w-44 shrink-0 items-center gap-2 rounded-lg border border-[#c8b08f] bg-[#fff8ed] px-3 text-left transition-transform hover:border-[#a97946] active:scale-[0.97] min-[1800px]:min-h-14"><span className="text-xl text-[#8d755b] min-[1800px]:text-2xl">◔</span><span><strong className="block text-[11px]">29.5″ curved corner shelf</strong><span className="hidden text-[9px] text-[#806348] min-[1800px]:block">Start a two-wall visual corner</span></span></button><label className="relative flex min-h-12 w-36 shrink-0 items-center rounded-lg border border-dashed border-[#ceb9a0] bg-[#fffdf9] px-2 text-[11px] font-semibold text-[#65584a] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#b77c4b] min-[1800px]:min-h-14"><ChevronDown className="mr-1 h-4 w-4" /><span>More verified parts</span><select aria-label="More parts for selected tower" value={extraPart} onChange={(event) => { const kind = event.target.value as StudioKind | ""; setExtraPart(""); if (kind) pickPart(kind); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"><option value="">More verified parts</option>{STUDIO_PART_KINDS.filter((kind) => !recommendation.includes(kind)).map((kind) => <option key={kind} value={kind}>{card[kind].title}</option>)}<option disabled value="basket">Baskets: fit unverified</option></select></label>
        </div><p className="mt-1 text-[10px] leading-relaxed text-[#806348]" data-testid="vendor-shoe-pitch-caveat">{SHOE_PITCH_CAVEAT}</p></div>
        <div className="hidden shrink-0 border-t border-[#e4dcd0] bg-white px-3 py-2 sm:px-5 min-[1800px]:block"><BasketPlanningControls design={design} selectedBay={selectedBay} selectedBasketId={selectedBasketId} onSelect={setSelectedBasketId} onAdd={addBasket} onMove={moveBasket} onUpdate={updateBasket} onRemove={removeBasket} canUndo={Boolean(basketUndoDesign)} onUndo={undoBasket} /></div>
        {(currentItem || bay.items.length > 0) && <div className="hidden max-h-32 shrink-0 items-center gap-2 overflow-x-auto border-t border-[#e5ddd1] bg-[#fbfaf7] px-3 py-2 sm:px-5 min-[1800px]:flex" data-testid="vendor-placed-items"><span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#8b775d]">Tower {selectedBay + 1}</span>{bay.items.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedItem(item.id); setPartToPlace(null); }} aria-pressed={selectedItem === item.id} className={`h-9 shrink-0 rounded-md px-3 text-[11px] font-semibold ${selectedItem === item.id ? "bg-[#ede0c8] text-[#4f3a22]" : "border border-[#e5ded4] bg-white text-[#6f655a]"}`}>{card[item.kind].title} · {item.bottomIn} in</button>)}</div>}
        {currentItem && <div className="hidden shrink-0 flex-wrap items-center gap-2 border-t border-[#e5ddd1] bg-[#fffaf1] px-3 py-2 text-[11px] sm:px-5 min-[1800px]:flex" data-testid="vendor-height-control"><Move3D className="h-4 w-4 text-[#94734c]" /><strong className="whitespace-nowrap">Slide {card[currentItem.kind].title.toLowerCase()} height</strong><button aria-label="Lower selected item one inch" onClick={() => changeElevation(currentItem, currentItem.bottomIn - 1)} className="h-9 w-9 rounded-md border border-[#dfd5c5] bg-white">−</button><input aria-label="Selected item bottom height in inches" type="range" min={studioFixedBottom(design) + 1} max={studioFixedTop(design) - studioItemHeight(currentItem.kind)} step="1" value={currentItem.bottomIn} onChange={(event) => changeElevation(currentItem, Number(event.target.value))} className="min-w-[80px] flex-1 accent-[#9b6b3e]" /><button aria-label="Raise selected item one inch" onClick={() => changeElevation(currentItem, currentItem.bottomIn + 1)} className="h-9 w-9 rounded-md border border-[#dfd5c5] bg-white">+</button><span className="w-12 text-center font-bold tabular-nums">{currentItem.bottomIn} in</span><button type="button" aria-label={`Remove ${card[currentItem.kind].title.toLowerCase()}`} onClick={() => removeItem(currentItem)} className="flex h-9 w-9 items-center justify-center rounded-md text-[#9b674d] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>}
        {notice && <div role="status" className="hidden shrink-0 border-t border-[#eacb9a] bg-[#fff6e5] px-4 py-2 text-xs text-[#73543a] min-[1800px]:block">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="float-right font-bold">✕</button></div>}
      </main>
      {phonePanel && <button type="button" aria-label="Close design options" onClick={() => setPhonePanel(null)} className="fixed inset-0 z-40 bg-black/35 min-[1024px]:hidden" />}
      <aside id="vendor-phone-options-dock" className={`${phonePanel ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[78dvh] rounded-t-2xl shadow-2xl" : "hidden"} min-[1024px]:static min-[1024px]:z-auto min-[1024px]:flex min-[1024px]:w-[min(33vw,360px)] min-[1024px]:min-w-[300px] min-[1024px]:max-h-none min-[1024px]:rounded-none min-[1024px]:shadow-none min-[1800px]:hidden shrink-0 flex-col gap-3 overflow-y-auto border-l border-[#dfd8cc] bg-[#faf9f5] p-3`} data-testid="vendor-tablet-options-dock">
        <div className="flex items-center justify-between gap-3 min-[1024px]:hidden"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">{phonePanel === "material" ? "Material list" : phonePanel === "parts" ? "Add a part" : "Tower controls"}</p><strong className="text-sm">Tower {selectedBay + 1}</strong></div><button type="button" aria-label="Close design options" onClick={() => setPhonePanel(null)} className="min-h-11 rounded-md border border-[#ded8cd] px-3 text-xs font-semibold">Close</button></div>
        <div className={`${phonePanel === "material" ? "block" : "hidden"} min-[1024px]:block`}><TabletMaterialDisclosure design={design} expanded={showTabletMaterial || phonePanel === "material"} onToggle={() => setShowTabletMaterial((open) => !open)} /></div>
        <section className={`${phonePanel === "tower" ? "block" : "hidden"} rounded-xl border border-[#e1d8ca] bg-white p-3 min-[1024px]:block`}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Tower & size</p>{hasBay ? <CutToFitControls key={`${bay.id}:${bay.widthIn}:${studioStockWidth(bay)}`} design={design} bay={bay} onApply={changeCutToFit} /> : <p className="mt-2 rounded-md bg-[#f7f2e9] px-2 py-2 text-[11px] leading-relaxed text-[#6d6255]">This wall is empty. Add its first 24 in tower below; other walls remain unchanged.</p>}<div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Select a tower">{design.bays.map((b, index) => <button type="button" key={b.id} onClick={() => { if (partToPlace) place(index, partToPlace === "rod" ? 64 : partToPlace === "shoe" ? 24 : partToPlace === "drawer" ? 20 : 42, partToPlace); else { setSelectedBay(index); setSelectedItem(null); } }} aria-label={partToPlace ? `Place ${card[partToPlace].title.toLowerCase()} in Tower ${index + 1}` : `Select Tower ${index + 1}`} aria-pressed={selectedBay === index} className={`min-h-11 rounded-md px-3 text-xs font-semibold ${selectedBay === index ? "bg-[#244338] text-white" : "border border-[#dfd8cc] bg-white"}`}>Tower {index + 1}</button>)}</div><div className="mt-3 flex items-center gap-2">{hasBay && <><label className="sr-only" htmlFor="vendor-bay-width-dock">Selected tower clear width</label><select id="vendor-bay-width-dock" aria-label="Selected tower clear width" value={bay.widthIn} onChange={(event) => selectedWidth(Number(event.target.value) as 18 | 24 | 30)} className="min-h-11 flex-1 rounded-md border border-[#dfd8cc] bg-white px-2 text-xs"><option value="18">18 in</option><option value="24">24 in</option><option value="30">30 in</option></select></>}<button type="button" onClick={addNeighbor} disabled={design.bays.length >= 4} className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[#d6c3a6] bg-[#fff8ed] px-3 text-[11px] font-semibold text-[#72563b] disabled:opacity-40"><Plus className="h-4 w-4" /> {hasBay ? "Add" : "Add first tower"}</button></div><p className="mt-2 text-[10px] text-[#766f65]"><Ruler className="mr-1 inline h-3 w-3" /> {studioWidth(design)} of {studioWallLength(design)} in on {wallNames[design.wall].toLowerCase()}</p>{bay.items.length > 0 && <div className="mt-3 border-t border-[#e8e0d6] pt-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Placed items</p><div className="mt-2 flex flex-wrap gap-2">{bay.items.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedItem(item.id); setPartToPlace(null); }} aria-pressed={selectedItem === item.id} className={`min-h-10 rounded-md px-3 text-[11px] font-semibold ${selectedItem === item.id ? "bg-[#ede0c8] text-[#4f3a22]" : "border border-[#e5ded4] bg-white text-[#6f655a]"}`}>{card[item.kind].title} · {item.bottomIn} in</button>)}</div></div>}{currentItem && <div className="mt-3 border-t border-[#e8e0d6] pt-3" data-testid="vendor-tablet-height-control"><div className="flex items-center gap-2"><Move3D className="h-4 w-4 text-[#94734c]" /><strong className="text-xs">Adjust {card[currentItem.kind].title.toLowerCase()}</strong></div><div className="mt-3 flex items-center gap-2"><button aria-label="Lower selected item one inch" onClick={() => changeElevation(currentItem, currentItem.bottomIn - 1)} className="h-11 w-11 rounded-md border border-[#dfd5c5] bg-white">−</button><input aria-label="Selected item bottom height in inches" type="range" min={studioFixedBottom(design) + 1} max={studioFixedTop(design) - studioItemHeight(currentItem.kind)} step="1" value={currentItem.bottomIn} onChange={(event) => changeElevation(currentItem, Number(event.target.value))} className="min-w-0 flex-1 accent-[#9b6b3e]" /><button aria-label="Raise selected item one inch" onClick={() => changeElevation(currentItem, currentItem.bottomIn + 1)} className="h-11 w-11 rounded-md border border-[#dfd5c5] bg-white">+</button><span className="w-12 text-center text-xs font-bold tabular-nums">{currentItem.bottomIn} in</span><button type="button" aria-label={`Remove ${card[currentItem.kind].title.toLowerCase()}`} onClick={() => removeItem(currentItem)} className="flex h-11 w-11 items-center justify-center rounded text-[#9b674d] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>}<CornerPlanningControls plannerId="vendor-corner-shelf-planner-dock" design={design} selectedCornerId={selectedCornerId} onSelect={setSelectedCornerId} onAdd={addCornerShelf} onBuild={buildConnectedCorner} onMove={moveCornerShelf} onRemove={removeCornerShelf} canUndo={Boolean(cornerUndoDesign)} onUndo={undoCorner} /></section>
        <section className={`${phonePanel === "parts" ? "block" : "hidden"} rounded-xl border border-[#e1d8ca] bg-white p-3 min-[1024px]:block`}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#997851]">Slide a piece into Tower {selectedBay + 1}</p><div className="mt-2 grid gap-2">{recommendation.map((kind) => { const error = canStageStudioPart(design, selectedBay, kind); return <button key={kind} type="button" draggable={!error} onDragStart={(event) => { if (error) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-vendor-closet-part", kind); event.dataTransfer.effectAllowed = "copy"; }} disabled={Boolean(error)} aria-pressed={partToPlace === kind} onClick={() => pickPart(kind)} title={error ?? "Drag onto a tower or tap, then tap the tower"} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-xs font-semibold transition-transform active:scale-[0.97] disabled:opacity-40 ${partToPlace === kind ? "border-[#b47d48] bg-[#fff2dc]" : "border-[#e2ddd3] bg-[#f9f7f3] hover:border-[#bc9b74]"}`}><span className="text-xl text-[#8d755b]">{card[kind].icon}</span>{card[kind].title}</button>; })}<button type="button" aria-label="Plan 29.5-inch curved corner shelf" onClick={openCornerShelfPlanner} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#c8b08f] bg-[#fff8ed] px-3 text-left text-xs font-semibold text-[#60462e] transition-transform hover:border-[#a97946] active:scale-[0.97]"><span className="text-xl text-[#8d755b]">◔</span><span>29.5″ curved corner shelf <span className="font-normal text-[#806348]">· start a two-wall visual corner</span></span></button><label className="relative flex min-h-12 w-full items-center rounded-lg border border-dashed border-[#ceb9a0] bg-[#fffdf9] px-3 text-xs font-semibold text-[#65584a] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#b77c4b]"><ChevronDown className="mr-2 h-4 w-4" /><span>More verified parts</span><select aria-label="More parts for selected tower" value={extraPart} onChange={(event) => { const kind = event.target.value as StudioKind | ""; setExtraPart(""); if (kind) pickPart(kind); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"><option value="">More verified parts</option>{STUDIO_PART_KINDS.filter((kind) => !recommendation.includes(kind)).map((kind) => <option key={kind} value={kind}>{card[kind].title}</option>)}<option disabled value="basket">Baskets: use visual-planning controls below</option></select></label></div><p className="mt-3 rounded-md bg-[#fff6e7] px-2 py-2 text-[10px] leading-relaxed text-[#76563a]" data-testid="vendor-shoe-pitch-caveat">{SHOE_PITCH_CAVEAT}</p><BasketPlanningControls design={design} selectedBay={selectedBay} selectedBasketId={selectedBasketId} onSelect={setSelectedBasketId} onAdd={addBasket} onMove={moveBasket} onUpdate={updateBasket} onRemove={removeBasket} canUndo={Boolean(basketUndoDesign)} onUndo={undoBasket} /></section>
        {notice && <div role="status" className={`${phonePanel === "tower" || phonePanel === "parts" ? "block" : "hidden"} rounded-lg border border-[#eacb9a] bg-[#fff6e5] px-3 py-2 text-xs text-[#73543a] min-[1024px]:block`}>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="float-right font-bold">✕</button></div>}
      </aside>
      <nav aria-label="Closet Studio phone actions" className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-[#ded7cb] bg-[#fcfaf6]/95 px-1 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur min-[1024px]:hidden" data-testid="vendor-phone-action-strip">
        <button type="button" onClick={() => { setShowRoom(true); setPhonePanel(null); }} aria-label="Room settings" className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${showRoom ? "text-[#a16d3f]" : "text-[#3f4a43]"}`}><Ruler className="h-5 w-5" />Room</button>
        <button type="button" onClick={() => { setPhonePanel("tower"); setShowRoom(false); }} aria-label="Tower controls" className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${phonePanel === "tower" ? "text-[#a16d3f]" : "text-[#3f4a43]"}`}><Layers3 className="h-5 w-5" />Tower</button>
        <button type="button" onClick={() => { setPhonePanel("parts"); setShowRoom(false); }} aria-label="Add closet parts" className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${phonePanel === "parts" ? "text-[#a16d3f]" : "text-[#3f4a43]"}`}><ShoppingBag className="h-5 w-5" />Parts</button>
        <button type="button" onClick={() => { setPhonePanel("material"); setShowRoom(false); }} aria-label="Material reference" className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${phonePanel === "material" ? "text-[#a16d3f]" : "text-[#3f4a43]"}`}><FileText className="h-5 w-5" />List</button>
      </nav>
      <div id="vendor-reference-drawer" className={`${showReference ? "absolute inset-0 z-40 bg-black/35" : "hidden"} min-[1800px]:static min-[1800px]:block min-[1800px]:w-[345px] min-[1800px]:bg-transparent`} onClick={(e) => { if (e.target === e.currentTarget) setShowReference(false); }}><div className="ml-auto h-full w-[min(100vw,380px)] shadow-2xl min-[1800px]:w-full min-[1800px]:shadow-none"><Reference design={design} onClose={() => setShowReference(false)} /></div></div>
    </div>
  </div>;
}
