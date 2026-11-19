/**
 * Minimum filler (Tom, voice, Nov 19 2026, 7:19 AM CT, call 00224ee2), learned
 * from the 12 x 10 ft (144 x 120 in) L-shaped run:
 *
 *  1. Use the least filler possible. Every inch of filler is a missed cabinet.
 *  2. Wiggle room is applied, not just reported. Spare inches upgrade a cabinet
 *     to the next stock width (W15 -> W18) or slide the range a little (up to
 *     the 3 in wiggle) so the stock widths land, instead of leaving dead space.
 *  3. A filler between cabinets that, with the inches around it, reaches a
 *     stock size step becomes that size (2-1/4 in beside a B21 -> B24).
 *  4. A half-inch strip on a cabinet side is within tolerance, as a last resort.
 *  5. Whatever is left after the upgrades is ONE thin strip against the wall
 *     end or the refrigerator, never a filler between cabinets.
 *  6. No filler between a wall cabinet and a bridge cabinet.
 *  7. The same rule runs on the base row and the wall row.
 *
 * Standing rules this pass keeps: only real catalog SKUs of the cabinet's own
 * family (nothing invented, renamed or deleted); never a filler outside an
 * exposed or refrigerator panel; corner, sink, dishwasher, refrigerator, tall,
 * panels and bridges never move (the range moves only inside its wiggle, with
 * its bridge / microwave / hood); required corner fillers are never touched;
 * no 39 in upper is picked; glass upper runs are not re-sized.
 *
 * The pass is pure and conservative: a wall is rewritten only when the new plan
 * scores strictly better (less filler, then no filler between cabinets).
 */
import {
  cabinetWall,
  dim,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isStacker,
  placedFootprint,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import {
  cabinetFamilyToken,
  formatFillerInches,
  isProtectedCornerFiller,
  isRunCabinet,
  sellableRunCabinet,
  type FillerLayer,
} from "./autoDesignFillerConsolidation";

const EPS = 0.01;
/** Below this a leftover is tape-measure noise: no board is cut. */
export const MINIMUM_FILLER_NOISE_IN = 0.125;
/** Rule 4: a strip this wide on a cabinet side is within tolerance (last resort). */
export const MINIMUM_FILLER_TOLERANCE_IN = 0.5;
/** A cabinet is only re-sized within this many inches of its current width. */
const RESIZE_REACH_IN = 6;
const STEP_IN = 0.25;
const MAX_COMBOS = 20000;
const STANDARD_WALLS: WallSide[] = ["top", "right", "bottom", "left"];

type EndKind = "wall-end" | "opening" | "fridge" | "tall" | "cabinet" | "bridge" | "panel";

type Boundary = { start: number; end: number; kind: EndKind; item: PlacedCabinet | null };

type Unit = {
  cab: PlacedCabinet;
  startPanels: PlacedCabinet[];
  endPanels: PlacedCabinet[];
  panelIn: number;
  start: number;
  end: number;
  options: { width: number; row: DesignCabinet | null }[];
};

type Segment = {
  start: number;
  end: number;
  left: Boundary;
  right: Boundary;
  units: Unit[];
  fillers: PlacedCabinet[];
};

type SegmentPlan = {
  widths: number[];
  leftover: number;
  leftoverAt: "start" | "end";
  score: number;
  kind: "friendly" | "cabinet" | "bridge" | "panel" | "none";
  keepOpen?: boolean;
};

export type MinimumFillerChange = {
  wallId: string;
  layer: FillerLayer;
  kind: "resize" | "range-slide" | "filler-removed" | "strip-added" | "gap-open";
  uid: string;
  from: string;
  to: string;
  widthIn: number;
  note: string;
};

export type MinimumFillerResult = {
  placed: PlacedCabinet[];
  notes: string[];
  changes: MinimumFillerChange[];
  moves: { uid: string; kind: "stove"; wallId: WallSide; deltaAlongIn: number; reason: "wiggle" }[];
  /** Filler inches per wall and layer before and after, for the report. */
  fillerInches: { wallId: string; layer: FillerLayer; before: number; after: number }[];
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isUpperLevel(p: PlacedCabinet): boolean {
  if (p.placement === "wall") return true;
  if (/^HOOD/i.test(p.masterCode ?? "")) return true;
  if (p.placement === "appliance" && (Number(p.mountBottom) || 0) > 30) return true;
  return false;
}

function inLayer(p: PlacedCabinet, layer: FillerLayer): boolean {
  if (p.placement === "tall") return true;
  if (layer === "wall") return isUpperLevel(p);
  return !isUpperLevel(p) && (p.placement === "base" || p.placement === "appliance");
}

function isRefrigeratorPiece(p: PlacedCabinet): boolean {
  return isRefrigerator(p) || Boolean(p.refrigeratorAssemblyRole) || Boolean(p.refrigeratorAssemblyId);
}

function isBridge(p: PlacedCabinet): boolean {
  return p.overRangeMicrowaveBridge === true || /bridge|stacker/i.test(p.subCategory ?? "");
}

function isLazySusanFlank(p: PlacedCabinet): boolean {
  return /^Corner rule: .*beside the diagonal/.test(String(p.autoPlacedReason ?? ""));
}

/** Along-run span of a piece on `wallId`, projecting a neighbor wall's corner piece onto this run. */
function spanOn(p: PlacedCabinet, wallId: WallSide, room: RoomData, layer: FillerLayer): { start: number; end: number } | null {
  const own = cabinetWall(p, room);
  if (own === wallId) {
    const start = wallRunOffset(p, wallId, room);
    const width = wallRunSpan(p, wallId, room);
    if (width <= EPS) return null;
    return { start, end: start + width };
  }
  if (!STANDARD_WALLS.includes(own as WallSide)) return null;
  const fp = placedFootprint(p);
  if (fp.w <= EPS || fp.d <= EPS) return null;
  const strip = layer === "wall" ? 12 : 24;
  const x0 = Number(p.x) || 0;
  const y0 = Number(p.y) || 0;
  const touches = wallId === "top" ? y0 < strip - 1
    : wallId === "bottom" ? y0 + fp.d > room.depth - strip + 1
    : wallId === "left" ? x0 < strip - 1
    : x0 + fp.w > room.width - strip + 1;
  if (!touches) return null;
  return wallId === "top" || wallId === "bottom" ? { start: x0, end: x0 + fp.w } : { start: y0, end: y0 + fp.d };
}

function kindOf(p: PlacedCabinet): EndKind {
  if (isRefrigeratorPiece(p) && !isPanelItem(p)) return "fridge";
  if (isPanelItem(p)) return "panel";
  if (p.placement === "tall") return "tall";
  if (isBridge(p)) return "bridge";
  return "cabinet";
}

function friendly(kind: EndKind): boolean {
  return kind === "wall-end" || kind === "opening" || kind === "fridge" || kind === "tall";
}

/** Score of one leftover strip given what stands on each side of it. */
function stripScore(width: number, a: EndKind, b: EndKind): { score: number; kind: SegmentPlan["kind"] } {
  if (width < MINIMUM_FILLER_NOISE_IN) return { score: width, kind: "none" };
  const base = width * 10;
  if (a === "panel" || b === "panel") return { score: base + 1000 + width * 1000, kind: "panel" };
  if (friendly(a) || friendly(b)) return { score: base, kind: "friendly" };
  // Rule 6: never a board between a wall cabinet and a bridge. Rule 5: never between cabinets,
  // with rule 4's half-inch tolerance as the last resort. Each extra board also costs a little.
  if (a === "bridge" || b === "bridge") return { score: base + 50 + width * 500, kind: "bridge" };
  return { score: base + 5 + width * (width <= MINIMUM_FILLER_TOLERANCE_IN + EPS ? 20 : 100), kind: "cabinet" };
}

function unitSideKind(unit: Unit, side: "start" | "end"): EndKind {
  return (side === "start" ? unit.startPanels : unit.endPanels).length ? "panel" : "cabinet";
}

function planSegment(seg: Segment): SegmentPlan | null {
  const length = seg.end - seg.start;
  if (length < -EPS) return null;
  const n = seg.units.length;
  if (n === 0) {
    const s = stripScore(Math.max(0, length), seg.left.kind, seg.right.kind);
    // A gap between two fixed pieces that carries no board today (the inside of a refrigerator
    // panel, say) is scored but never given a new board.
    return { widths: [], leftover: Math.max(0, length), leftoverAt: "end", score: s.score, kind: s.kind, keepOpen: seg.fillers.length === 0 };
  }
  let combos = 1;
  for (const unit of seg.units) combos *= unit.options.length;
  const optionLists = combos > MAX_COMBOS ? seg.units.map((unit) => [unit.options[0]!]) : seg.units.map((unit) => unit.options);
  let best: SegmentPlan | null = null;
  const pick: number[] = new Array(n).fill(0);
  const visit = (i: number, total: number) => {
    if (total > length + EPS) return;
    if (i === n) {
      const leftover = Math.max(0, round3(length - total));
      const widths = pick.map((index, at) => optionLists[at]![index]!.width);
      let changes = 0;
      let delta = 0;
      widths.forEach((width, at) => {
        const current = Number(seg.units[at]!.cab.width) || 0;
        if (Math.abs(width - current) > EPS) changes += 1;
        delta += Math.abs(width - current);
      });
      const atStart = stripScore(leftover, seg.left.kind, unitSideKind(seg.units[0]!, "start"));
      const atEnd = stripScore(leftover, unitSideKind(seg.units[n - 1]!, "end"), seg.right.kind);
      const useStart = atStart.score < atEnd.score - EPS;
      const s = useStart ? atStart : atEnd;
      const score = s.score + changes * 0.3 + delta * 0.01;
      if (!best || score < best.score - 1e-9) best = { widths, leftover, leftoverAt: useStart ? "start" : "end", score, kind: s.kind };
      return;
    }
    const unit = seg.units[i]!;
    optionLists[i]!.forEach((option, index) => {
      pick[i] = index;
      visit(i + 1, total + option.width + unit.panelIn);
    });
  };
  visit(0, 0);
  return best;
}

/** What the segment scores as it stands now (current widths, current boards and gaps). */
function currentSegmentScore(seg: Segment): { score: number; fillerIn: number } {
  type Edge = { start: number; end: number; kind: EndKind };
  const solids: Edge[] = [{ start: seg.left.start, end: seg.start, kind: seg.left.kind }];
  for (const unit of seg.units) {
    if (unit.startPanels.length) solids.push({ start: unit.start, end: unit.start + 0.0001, kind: "panel" });
    solids.push({ start: unit.start + (unit.startPanels.length ? 0.0001 : 0), end: unit.end - (unit.endPanels.length ? 0.0001 : 0), kind: "cabinet" });
    if (unit.endPanels.length) solids.push({ start: unit.end - 0.0001, end: unit.end, kind: "panel" });
  }
  solids.push({ start: seg.end, end: seg.right.end, kind: seg.right.kind });
  solids.sort((a, b) => a.start - b.start);
  let score = 0;
  let fillerIn = 0;
  for (let i = 0; i + 1 < solids.length; i += 1) {
    const gap = round3(solids[i + 1]!.start - solids[i]!.end);
    if (gap < MINIMUM_FILLER_NOISE_IN) continue;
    score += stripScore(gap, solids[i]!.kind, solids[i + 1]!.kind).score;
    fillerIn += gap;
  }
  return { score, fillerIn };
}

function resizeOptions(cab: PlacedCabinet, layer: FillerLayer, catalog: readonly DesignCabinet[]): { width: number; row: DesignCabinet | null }[] {
  const current = Number(cab.width) || 0;
  const options: { width: number; row: DesignCabinet | null }[] = [{ width: current, row: null }];
  const family = cabinetFamilyToken(cab.masterCode);
  if (!family) return options;
  const height = Number(cab.height) || 0;
  const depth = Number(cab.depth) || 0;
  const rows = catalog
    .filter((row) => cabinetFamilyToken(row.masterCode) === family && sellableRunCabinet(row, layer))
    .filter((row) => layer !== "wall" || height <= 0 || Math.abs(dim(row.height, 0) - height) <= 0.05)
    .filter((row) => depth <= 0 || !dim(row.depth, 0) || Math.abs(dim(row.depth, 0) - depth) <= 0.05)
    .filter((row) => !(layer === "wall" && Math.abs(dim(row.width, 0) - 39) <= 0.05))
    .filter((row) => !isStacker(row));
  const seen = new Set<number>([Math.round(current * 1000)]);
  for (const row of rows) {
    const width = dim(row.width, 0);
    // Upgrades only (rule 2/3): a cabinet never shrinks to chase a filler.
    if (width <= current + EPS || width - current > RESIZE_REACH_IN + EPS) continue;
    const key = Math.round(width * 1000);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ width, row });
  }
  return options;
}

type RowModel = { segments: Segment[]; feasible: boolean };

function buildRow(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: WallSide;
  layer: FillerLayer;
  catalog: readonly DesignCabinet[];
  slideUids: ReadonlySet<string>;
  delta: number;
  glass: boolean;
}): RowModel {
  const { room, wallId, layer } = input;
  const frame = wallRunFrame(wallId, room)!;
  const runStart = Math.max(0, frame.runStart);
  const runEnd = frame.runEnd;
  const boundaries: Boundary[] = [];
  const units: Unit[] = [];
  const fillers: { item: PlacedCabinet; start: number; end: number }[] = [];
  const panels: { item: PlacedCabinet; start: number; end: number }[] = [];
  // A short wall piece (a bridge over a sink or window) is never resized.
  for (const p of input.placed) {
    if (!inLayer(p, layer)) continue;
    const span = spanOn(p, wallId, room, layer);
    if (!span) continue;
    const shift = input.slideUids.has(p.uid) ? input.delta : 0;
    const start = span.start + shift;
    const end = span.end + shift;
    const ownWall = cabinetWall(p, room) === wallId;
    if (ownWall && isFillerItem(p) && !isPanelItem(p) && p.placement === layer && !isProtectedCornerFiller(p, input.placed, room)) {
      const owner = p.fillerForCabinetUid ? input.placed.find((item) => item.uid === p.fillerForCabinetUid) : null;
      const ownerHard = owner != null && (isRefrigeratorPiece(owner) || isPanelItem(owner) || owner.placement === "tall");
      // A full-height board (beside a tall cabinet or the refrigerator) covers both rows; it stays.
      const fullHeight = (p.fillerContinuousVertical === true || (Number(p.height) || 0) > 40)
        && input.placed.some((q) => q.uid !== p.uid && (q.placement === "tall" || isRefrigeratorPiece(q)) && cabinetWall(q, room) === wallId
          && (() => { const qs = spanOn(q, wallId, room, layer); return qs != null && (Math.abs(qs.end - span.start) <= 0.25 || Math.abs(qs.start - span.end) <= 0.25); })());
      if (!ownerHard && !p.fillerTransitionKind && !fullHeight) {
        fillers.push({ item: p, start, end });
        continue;
      }
    }
    if (ownWall && isPanelItem(p) && !isRefrigeratorPiece(p) && p.placement === layer) {
      panels.push({ item: p, start, end });
      continue;
    }
    const shortWallPiece = layer === "wall" && (Number(p.height) || 0) > 0 && (Number(p.height) || 0) < 29;
    const resizable = ownWall && !input.slideUids.has(p.uid) && isRunCabinet(p, layer) && !isLazySusanFlank(p) && !isStacker(p)
      && !(layer === "wall" && input.glass) && !shortWallPiece;
    if (resizable) {
      units.push({ cab: p, startPanels: [], endPanels: [], panelIn: 0, start, end, options: resizeOptions(p, layer, input.catalog) });
      continue;
    }
    boundaries.push({ start, end, kind: kindOf(p), item: p });
  }
  // A side panel that touches a run cabinet travels with it; any other panel is a fixed boundary.
  for (const panel of panels) {
    const host = units.find((unit) => Math.abs(unit.start - panel.end) <= 0.05)
      ?? units.find((unit) => Math.abs(unit.end - panel.start) <= 0.05);
    if (!host) {
      boundaries.push({ start: panel.start, end: panel.end, kind: "panel", item: panel.item });
      continue;
    }
    if (Math.abs(host.start - panel.end) <= 0.05) {
      host.startPanels.push(panel.item);
      host.start = panel.start;
    } else {
      host.endPanels.push(panel.item);
      host.end = panel.end;
    }
    host.panelIn += panel.end - panel.start;
  }
  const openingTop = 34.5;
  for (const opening of input.openings) {
    if (opening.side !== wallId) continue;
    if (layer === "base" && (Number(opening.sill) || 0) >= openingTop) continue;
    boundaries.push({ start: opening.offset, end: opening.offset + opening.width, kind: "opening", item: null });
  }
  boundaries.sort((a, b) => a.start - b.start);
  // Pieces that only touch (or a slid range that now overlaps a fixed piece) decide feasibility.
  let feasible = true;
  for (let i = 0; i + 1 < boundaries.length; i += 1) {
    const a = boundaries[i]!;
    const b = boundaries[i + 1]!;
    if (a.end > b.start + 0.05) {
      const aSlid = Boolean(a.item && input.slideUids.has(a.item.uid));
      const bSlid = Boolean(b.item && input.slideUids.has(b.item.uid));
      if (aSlid !== bSlid && input.delta !== 0) feasible = false;
    }
  }
  if (boundaries.some((b) => b.item && input.slideUids.has(b.item.uid) && (b.start < runStart - EPS || b.end > runEnd + EPS))) feasible = false;
  const merged: Boundary[] = [];
  for (const b of boundaries) {
    const last = merged[merged.length - 1];
    if (last && b.start < last.end - 0.05) {
      if (b.end > last.end) merged.push({ ...b, start: last.end });
      continue;
    }
    merged.push(b);
  }
  const ends: Boundary[] = [
    { start: runStart - 1, end: runStart, kind: "wall-end", item: null },
    ...merged.filter((b) => b.end > runStart + EPS && b.start < runEnd - EPS),
    { start: runEnd, end: runEnd + 1, kind: "wall-end", item: null },
  ];
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < ends.length; i += 1) {
    const left = ends[i]!;
    const right = ends[i + 1]!;
    segments.push({ start: Math.max(runStart, left.end), end: Math.min(runEnd, right.start), left, right, units: [], fillers: [] });
  }
  const segmentFor = (mid: number) => segments.find((seg) => mid >= seg.start - EPS && mid <= seg.end + EPS)
    ?? segments.slice().sort((a, b) => Math.abs((a.start + a.end) / 2 - mid) - Math.abs((b.start + b.end) / 2 - mid))[0];
  for (const unit of units.sort((a, b) => a.start - b.start)) segmentFor((unit.start + unit.end) / 2)?.units.push(unit);
  for (const filler of fillers) segmentFor((filler.start + filler.end) / 2)?.fillers.push(filler.item);
  return { segments, feasible };
}

function scoreRow(row: RowModel): { plans: (SegmentPlan | null)[]; score: number; feasible: boolean } {
  if (!row.feasible) return { plans: [], score: Infinity, feasible: false };
  const plans = row.segments.map((seg) => (seg.units.length || seg.fillers.length || seg.end - seg.start >= MINIMUM_FILLER_NOISE_IN ? planSegment(seg) : null));
  let score = 0;
  for (let i = 0; i < plans.length; i += 1) {
    const seg = row.segments[i]!;
    const plan = plans[i];
    if (plan === null && (seg.units.length || seg.fillers.length || seg.end - seg.start >= MINIMUM_FILLER_NOISE_IN)) return { plans, score: Infinity, feasible: false };
    score += plan?.score ?? 0;
  }
  return { plans, score, feasible: true };
}

function currentRowScore(row: RowModel): { score: number; fillerIn: number } {
  let score = 0;
  let fillerIn = 0;
  for (const seg of row.segments) {
    const s = currentSegmentScore(seg);
    score += s.score;
    fillerIn += s.fillerIn;
  }
  return { score, fillerIn };
}

/** The range and what hangs over it (bridge, microwave, hood) slide together. */
function rangeGroups(placed: readonly PlacedCabinet[], room: RoomData, wallId: WallSide): { range: PlacedCabinet; uids: Set<string> }[] {
  const groups: { range: PlacedCabinet; uids: Set<string> }[] = [];
  for (const range of placed) {
    if (range.placement !== "appliance" || isUpperLevel(range) || !isRangeOrOven(range.masterCode, range.description)) continue;
    if (cabinetWall(range, room) !== wallId) continue;
    const start = wallRunOffset(range, wallId, room);
    const end = start + wallRunSpan(range, wallId, room);
    const uids = new Set<string>([range.uid]);
    for (const p of placed) {
      if (p.uid === range.uid || cabinetWall(p, room) !== wallId || !isUpperLevel(p)) continue;
      const s = wallRunOffset(p, wallId, room);
      const e = s + wallRunSpan(p, wallId, room);
      const over = s >= start - 0.5 && e <= end + 0.5;
      if (over && (p.overRangeMicrowaveBridge === true || /^HOOD/i.test(p.masterCode ?? "") || p.placement === "appliance" || isBridge(p))) uids.add(p.uid);
    }
    groups.push({ range, uids });
  }
  return groups;
}

export function applyMinimumFiller(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallIds: readonly string[];
  baseCatalog: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  fillerCatalog: readonly CatalogFillerCandidate[];
  styleId: number | null;
  makeUid: () => string;
  /** Inches the range may still slide each way (the 3 in wiggle less what the run already used). 0 = locked. */
  rangeWiggleIn: (range: PlacedCabinet) => number;
  glassUppers?: boolean;
  wallLabelOf?: (wallId: string) => string | null | undefined;
}): MinimumFillerResult {
  let working: PlacedCabinet[] = [...input.placed];
  const notes: string[] = [];
  const changes: MinimumFillerChange[] = [];
  const moves: MinimumFillerResult["moves"] = [];
  const fillerInches: MinimumFillerResult["fillerInches"] = [];
  const layers: FillerLayer[] = ["base", "wall"];
  const catalogOf = (layer: FillerLayer) => (layer === "base" ? input.baseCatalog : input.wallCatalog);
  // Strips are real filler boards only: no scribe or base moulding (SM8 is 3/4 in tall trim).
  const stripStock = input.fillerCatalog.filter((row) => !/mou?ld/i.test(`${row.category ?? ""} ${row.subCategory ?? ""} ${row.description ?? ""}`));
  for (const wallId of input.wallIds) {
    if (!STANDARD_WALLS.includes(wallId as WallSide) || !wallRunFrame(wallId, input.room)) continue;
    const side = wallId as WallSide;
    // A wall with a window or door keeps its clearance-driven sizes (narrowed boxes, window-side
    // panels); this pass leaves it alone for now.
    if (input.openings.some((opening) => opening.side === side)) continue;
    const label = input.wallLabelOf?.(side) ?? side;
    const groups = rangeGroups(working, input.room, side);
    const group = groups.length === 1 ? groups[0]! : null;
    const slideUids = group?.uids ?? new Set<string>();
    const reach = group ? Math.max(0, Math.min(3, input.rangeWiggleIn(group.range))) : 0;
    const deltas: number[] = [0];
    for (let d = STEP_IN; d <= reach + EPS; d += STEP_IN) deltas.push(round3(d), round3(-d));
    const rowsAt = (delta: number) => layers.map((layer) => buildRow({
      placed: working, room: input.room, openings: input.openings, wallId: side, layer,
      catalog: catalogOf(layer), slideUids, delta, glass: Boolean(input.glassUppers),
    }));
    const currentRows = rowsAt(0);
    const current = currentRows.map(currentRowScore);
    const currentScore = current.reduce((sum, row) => sum + row.score, 0);
    type Candidate = { delta: number; rows: RowModel[]; plans: (SegmentPlan | null)[][]; score: number };
    const candidates: Candidate[] = [];
    for (const delta of deltas) {
      const rows = delta === 0 ? currentRows : rowsAt(delta);
      const scored = rows.map(scoreRow);
      if (scored.some((row) => !row.feasible)) continue;
      const score = scored.reduce((sum, row) => sum + row.score, 0) + Math.abs(delta) * 0.2;
      if (score < currentScore - 0.5) candidates.push({ delta, rows, plans: scored.map((row) => row.plans), score });
    }
    const applyCandidate = (best: Candidate) => {
    const movesLocal: MinimumFillerResult["moves"] = [];
    const replaced = new Map<string, PlacedCabinet>();
    const removed = new Set<string>();
    const added: PlacedCabinet[] = [];
    const wallChanges: MinimumFillerChange[] = [];
    if (best.delta !== 0 && group) {
      for (const uid of Array.from(group.uids)) {
        const item = working.find((p) => p.uid === uid)!;
        const along = wallRunOffset(item, side, input.room) + best.delta;
        const spot = wallPlacementAt(along, Number(item.width) || 0, Number(item.depth) || 0, side, input.room);
        replaced.set(uid, { ...item, ...spot });
      }
      const toward = best.delta < 0 ? "toward the run start" : "toward the run end";
      const note = `Minimum filler: ${group.range.masterCode} slid ${formatFillerInches(Math.abs(best.delta))} ${toward} on ${label} (inside its wiggle) with its bridge above, so stock widths land instead of filler.`;
      wallChanges.push({ wallId: side, layer: "base", kind: "range-slide", uid: group.range.uid, from: group.range.masterCode, to: group.range.masterCode, widthIn: best.delta, note });
      movesLocal.push({ uid: group.range.uid, kind: "stove", wallId: side, deltaAlongIn: best.delta, reason: "wiggle" });
    }
    const afterInches: number[] = [];
    best.rows.forEach((row, layerIndex) => {
      const layer = layers[layerIndex]!;
      let layerInches = 0;
      row.segments.forEach((seg, segIndex) => {
        const plan = best!.plans[layerIndex]![segIndex];
        if (!plan) return;
        for (const filler of seg.fillers) {
          removed.add(filler.uid);
          wallChanges.push({ wallId: side, layer, kind: "filler-removed", uid: filler.uid, from: filler.masterCode, to: "", widthIn: Number(filler.width) || 0, note: "" });
        }
        let cursor = seg.start + (plan.leftoverAt === "start" ? plan.leftover : 0);
        seg.units.forEach((unit, at) => {
          const width = plan.widths[at]!;
          for (const panel of unit.startPanels) {
            const pw = wallRunSpan(panel, side, input.room);
            replaced.set(panel.uid, { ...panel, ...wallPlacementAt(cursor, Number(panel.width) || pw, Number(panel.depth) || 0, side, input.room) });
            cursor += pw;
          }
          const cab = unit.cab;
          const option = unit.options.find((entry) => Math.abs(entry.width - width) <= EPS) ?? unit.options[0]!;
          const depth = Number(cab.depth) || 0;
          const spot = wallPlacementAt(cursor, width, depth, side, input.room);
          if (option.row && Math.abs(width - (Number(cab.width) || 0)) > EPS) {
            const row = option.row;
            replaced.set(cab.uid, {
              ...cab,
              cabinetId: row.id,
              masterCode: row.masterCode,
              description: row.description,
              category: row.category,
              subCategory: row.subCategory,
              width,
              height: dim(row.height, Number(cab.height) || 0),
              numberOfDoors: row.numberOfDoors ?? cab.numberOfDoors,
              numberOfDrawers: row.numberOfDrawers ?? cab.numberOfDrawers,
              catalogImageUrl: row.catalogImageUrl ?? cab.catalogImageUrl ?? null,
              ...spot,
            } as PlacedCabinet);
            const note = `Minimum filler: ${cab.masterCode} became ${row.masterCode} on ${label} (${layer === "wall" ? "wall" : "base"} row), using spare inches instead of a filler.`;
            wallChanges.push({ wallId: side, layer, kind: "resize", uid: cab.uid, from: cab.masterCode, to: row.masterCode, widthIn: width, note });
          } else {
            replaced.set(cab.uid, { ...cab, ...spot });
          }
          cursor += width;
          for (const panel of unit.endPanels) {
            const pw = wallRunSpan(panel, side, input.room);
            replaced.set(panel.uid, { ...panel, ...wallPlacementAt(cursor, Number(panel.width) || pw, Number(panel.depth) || 0, side, input.room) });
            cursor += pw;
          }
        });
        if (plan.keepOpen) {
          if (plan.leftover >= MINIMUM_FILLER_NOISE_IN) layerInches += plan.leftover;
          return;
        }
        if (plan.leftover >= MINIMUM_FILLER_NOISE_IN) {
          const at = plan.leftoverAt === "start" ? seg.start : seg.end - plan.leftover;
          const neighbor = plan.leftoverAt === "start" ? (seg.units[0]?.cab ?? seg.left.item) : (seg.units[seg.units.length - 1]?.cab ?? seg.right.item);
          const sideText = describeStrip(plan, seg);
          const stock = catalogFillerForGap(stripStock, plan.leftover, layer);
          const heightIn = layer === "wall" ? Number(neighbor?.height) || 30 : 34.5;
          const spot = stock ? wallPlacementAt(at, plan.leftover, layer === "wall" ? 12 : 24, side, input.room) : null;
          if (stock && spot) {
            added.push({
              uid: input.makeUid(),
              cabinetId: stock.id,
              masterCode: stock.masterCode,
              description: fittedCatalogFillerDescription(stock, plan.leftover),
              category: stock.category ?? "Filler",
              subCategory: stock.subCategory ?? "Filler",
              placement: layer,
              ...spot,
              width: plan.leftover,
              depth: layer === "wall" ? 12 : 24,
              height: heightIn,
              ...(layer === "wall" ? { mountBottom: Number(neighbor?.mountBottom) || 54 } : {}),
              styleId: neighbor?.styleId ?? input.styleId,
              fillerBillingRole: "primary",
              autoPlacedReason: `Minimum filler (Tom, Nov 19 2026): the ${formatFillerInches(plan.leftover)} left after stock widths, kept as one strip ${sideText}.`,
              fillerTotalWidth: plan.leftover,
              numberOfDoors: 0,
              numberOfDrawers: 0,
            } as PlacedCabinet);
            const note = `Minimum filler: one ${formatFillerInches(plan.leftover)} ${stock.masterCode} strip ${sideText} on ${label} (${layer === "wall" ? "wall" : "base"} row), ${round3(at)}″ to ${round3(at + plan.leftover)}″.`;
            wallChanges.push({ wallId: side, layer, kind: "strip-added", uid: "", from: "", to: stock.masterCode, widthIn: plan.leftover, note });
          } else {
            const note = `Minimum filler: ${formatFillerInches(plan.leftover)} on ${label} (${layer === "wall" ? "wall" : "base"} row) ${sideText} stays open; the line sells no filler that wide.`;
            wallChanges.push({ wallId: side, layer, kind: "gap-open", uid: "", from: "", to: "", widthIn: plan.leftover, note });
          }
          layerInches += plan.leftover;
        }
      });
      afterInches.push(layerInches);
    });
    const next = working
      .filter((item) => !removed.has(item.uid))
      .map((item) => replaced.get(item.uid) ?? item)
      .concat(added);
    return { next, wallChanges, afterInches, moves: movesLocal };
    };
    candidates.sort((a, b) => a.score - b.score);
    const alignedBefore = alignedStackUids(working, input.room, side);
    let accepted: ReturnType<typeof applyCandidate> | null = null;
    for (const candidate of candidates.slice(0, 12)) {
      const tried = applyCandidate(candidate);
      const alignedAfter = alignedStackUids(tried.next, input.room, side);
      // Tom, Nov 14 2026: an upper that lines up over its base keeps lining up; a plan that
      // breaks a lined-up stack is not used.
      const broken = Array.from(alignedBefore).filter((uid) => !alignedAfter.has(uid) && tried.next.some((item) => item.uid === uid));
      if (broken.length) continue;
      accepted = tried;
      break;
    }
    if (!accepted) {
      layers.forEach((layer, i) => fillerInches.push({ wallId: side, layer, before: round3(current[i]!.fillerIn), after: round3(current[i]!.fillerIn) }));
      continue;
    }
    working = accepted.next;
    moves.push(...accepted.moves);
    const { wallChanges, afterInches } = accepted;
    layers.forEach((layer, i) => fillerInches.push({ wallId: side, layer, before: round3(current[i]!.fillerIn), after: round3(afterInches[i] ?? 0) }));
    const beforeTotal = round3(current.reduce((sum, row) => sum + row.fillerIn, 0));
    const afterTotal = round3(afterInches.reduce((sum, value) => sum + value, 0));
    notes.push(...wallChanges.filter((change) => change.note).map((change) => change.note));
    notes.push(`Minimum filler on ${label}: filler and open inches went from ${formatFillerInches(beforeTotal)} to ${formatFillerInches(afterTotal)} (base and wall rows).`);
    changes.push(...wallChanges);
  }
  return { placed: working, notes, changes, moves, fillerInches };
}

/** Uids of uppers whose both edges sit on base seams, and of bases with uppers on both edges. */
function alignedStackUids(placed: readonly PlacedCabinet[], room: RoomData, wallId: WallSide): Set<string> {
  const frame = wallRunFrame(wallId, room);
  const ends = frame ? [Math.max(0, frame.runStart), frame.runEnd] : [];
  const bases: { uid: string; start: number; end: number }[] = [];
  const uppers: { uid: string; start: number; end: number }[] = [];
  for (const p of placed) {
    if (cabinetWall(p, room) !== wallId || isFillerItem(p) || isPanelItem(p)) continue;
    const start = wallRunOffset(p, wallId, room);
    const span = { uid: p.uid, start, end: start + wallRunSpan(p, wallId, room) };
    if (p.placement === "wall" && isRunCabinet(p, "wall")) uppers.push(span);
    else if (inLayer(p, "base") && p.placement !== "tall") bases.push(span);
  }
  const near = (list: number[], value: number) => list.some((edge) => Math.abs(edge - value) <= 0.25);
  const baseEdges = [...ends, ...bases.flatMap((b) => [b.start, b.end])];
  const upperEdges = uppers.flatMap((u) => [u.start, u.end]);
  const out = new Set<string>();
  for (const u of uppers) if (near(baseEdges, u.start) && near(baseEdges, u.end)) out.add(u.uid);
  for (const b of bases) if (isRunCabinet(placed.find((p) => p.uid === b.uid)!, "base") && near(upperEdges, b.start) && near(upperEdges, b.end)) out.add(b.uid);
  return out;
}

function describeStrip(plan: SegmentPlan, seg: Segment): string {
  const boundary = plan.leftoverAt === "start" ? seg.left : seg.right;
  const what = boundary.kind === "wall-end" ? "against the wall end"
    : boundary.kind === "fridge" ? `against the refrigerator${boundary.item ? ` (${boundary.item.masterCode})` : ""}`
    : boundary.kind === "tall" ? `against ${boundary.item?.masterCode ?? "the tall cabinet"}`
    : boundary.kind === "opening" ? "beside the opening"
    : `beside ${boundary.item?.masterCode ?? "the next piece"}`;
  if (plan.kind === "cabinet") return `${what} (last resort${plan.leftover <= MINIMUM_FILLER_TOLERANCE_IN + EPS ? ", within the ½″ tolerance" : ""})`;
  if (plan.kind === "bridge") return `${what} (no other place for it; Tom's rule is no filler beside a bridge, review)`;
  return what;
}
