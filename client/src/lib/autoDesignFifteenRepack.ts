import {
  type PlacedCabinet,
  type RoomData,
  type WallSide,
  type DesignCabinet,
  type WallOpening,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  wallPlacementAt,
  cabinetWall,
  placedFootprint,
  isRefrigerator,
  isRangeOrOven,
  isSinkBaseCabinet,
  isFillerItem,
  isPanelItem,
  isCornerCabinet,
  dim,
  placedHeight,
  blocksFloorRun,
} from "./design";
import {
  type AutoDesignIntake,
  lockedAnchorKinds,
  hasPreference,
  LANDING_MIN_IN,
} from "./autoDesignFifteenRules";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import {
  type RunBlock,
  type RunSpec,
  type GapFill,
  planRun,
} from "./autoDesignRunPacking";

export type FifteenRepackMove = {
  uid: string;
  kind: "stove" | "sink" | "dishwasher";
  wallId: WallSide;
  deltaAlongIn: number;
  reason: "landing" | "wiggle";
};

export type FifteenRepackResult = {
  placed: PlacedCabinet[];
  notes: string[];
  findings: DesignerReviewFinding[];
  moves: FifteenRepackMove[];
};

const WALLS: WallSide[] = ["top", "right", "bottom", "left"];
const EPS = 0.01;
const WIGGLE = 3;
const FILLER_MAX = 6;
const PANEL_IN = 0.75;

type Level = "base" | "wall";

type GroupKind = "refrigerator" | "range" | "sink" | "dishwasher" | "corner" | "tall" | "other";

type Group = {
  id: string;
  kind: GroupKind;
  members: PlacedCabinet[];
  baseMembers: PlacedCabinet[];
  upperMembers: PlacedCabinet[];
  start: number;
  end: number;
  fixed: boolean;
  moveKind: "stove" | "sink" | "dishwasher" | null;
  locked: boolean;
  wiggle: { lo: number; hi: number } | null;
  landing: { lo: number; hi: number } | null;
};

type StockRow = { row: DesignCabinet; width: number };

type Piece = {
  start: number;
  width: number;
  row: DesignCabinet | null;
  placeholder: boolean;
  family: "plain" | "drawer" | "filler" | "panel";
};

function isUpperLevel(p: PlacedCabinet): boolean {
  if (p.placement === "wall") return true;
  if (/^HOOD/i.test(p.masterCode)) return true;
  if (p.placement === "appliance" && (p.mountBottom ?? 0) > 30) return true;
  return false;
}

function isBaseLevel(p: PlacedCabinet): boolean {
  if (p.placement === "base") return true;
  if (p.placement === "tall") return true;
  if (p.placement === "appliance" && !isUpperLevel(p)) return true;
  return false;
}

function isCorner(p: PlacedCabinet): boolean {
  return isCornerCabinet(p.masterCode, p.description, p.cornerType) || Boolean(p.cornerType);
}

function isDishwasher(p: PlacedCabinet): boolean {
  return p.placement === "appliance" && /^DW/i.test(p.masterCode);
}

function isRange(p: PlacedCabinet): boolean {
  return p.placement === "appliance" && isRangeOrOven(p.masterCode, p.description);
}

function isSinkBase(p: PlacedCabinet): boolean {
  return p.placement === "base" && isSinkBaseCabinet(p);
}

function alongOf(p: PlacedCabinet, side: WallSide, room: RoomData): number {
  return wallRunOffset(p, side, room);
}

function spanOf(p: PlacedCabinet, side: WallSide, room: RoomData): number {
  return wallRunSpan(p, side, room);
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - EPS && b0 < a1 - EPS;
}

function mergeIntervals(list: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end + EPS) {
      last.end = Math.max(last.end, iv.end);
    } else {
      out.push({ start: iv.start, end: iv.end });
    }
  }
  return out;
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

function shiftItem(p: PlacedCabinet, delta: number, frame: NonNullable<ReturnType<typeof wallRunFrame>>): PlacedCabinet {
  const next: PlacedCabinet = {
    ...p,
    x: p.x + frame.tangent.x * delta,
    y: p.y + frame.tangent.y * delta,
  };
  if (typeof p.wallOffset === "number") next.wallOffset = p.wallOffset + delta;
  return next;
}

function projectInward(
  p: PlacedCabinet,
  frame: NonNullable<ReturnType<typeof wallRunFrame>>,
): { alongLo: number; alongHi: number; inLo: number; inHi: number } {
  const fp = placedFootprint(p);
  const corners = [
    { x: p.x, y: p.y },
    { x: p.x + fp.w, y: p.y },
    { x: p.x, y: p.y + fp.d },
    { x: p.x + fp.w, y: p.y + fp.d },
  ];
  let alongLo = Infinity;
  let alongHi = -Infinity;
  let inLo = Infinity;
  let inHi = -Infinity;
  for (const c of corners) {
    const dx = c.x - frame.start.x;
    const dy = c.y - frame.start.y;
    const along = dx * frame.tangent.x + dy * frame.tangent.y;
    const inward = dx * frame.inward.x + dy * frame.inward.y;
    alongLo = Math.min(alongLo, along);
    alongHi = Math.max(alongHi, along);
    inLo = Math.min(inLo, inward);
    inHi = Math.max(inHi, inward);
  }
  return { alongLo, alongHi, inLo, inHi };
}

function openingAlong(o: WallOpening, frame: NonNullable<ReturnType<typeof wallRunFrame>>): { start: number; end: number } {
  const a = frame.tangent.x + frame.tangent.y > 0 ? o.offset : frame.length - o.offset - o.width;
  return { start: a, end: a + o.width };
}

function mostCommon<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestN = -1;
  for (const entry of Array.from(counts)) {
    const v = entry[0];
    const n = entry[1];
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function baseRows(catalog: readonly DesignCabinet[]): { plain: StockRow[]; drawer: StockRow[]; widths: number[] } {
  const plain: StockRow[] = [];
  const drawer: StockRow[] = [];
  for (const row of catalog) {
    const w = dim(row.width, 0);
    if (w < 9) continue;
    if (/^B(\d{1,2})$/i.test(row.masterCode)) plain.push({ row, width: w });
    else if (/^3DB(\d{1,2})$/i.test(row.masterCode)) drawer.push({ row, width: w });
  }
  const set = new Set<number>();
  for (const r of plain) set.add(r.width);
  for (const r of drawer) set.add(r.width);
  const widths = Array.from(set).sort((a, b) => a - b);
  return { plain, drawer, widths };
}

function wallRows(
  catalog: readonly DesignCabinet[],
  H: number,
  D: number,
): StockRow[] {
  const out: StockRow[] = [];
  for (const row of catalog) {
    if (!/^W-?\d{2}-?\d{2}$/i.test(row.masterCode)) continue;
    if (isCornerCabinet(row.masterCode, row.description, row.cornerType)) continue;
    const h = dim(row.height, 0);
    const d = dim(row.depth, 0);
    if (Math.abs(h - H) > 0.5) continue;
    if (Math.abs(d - D) > 0.75) continue;
    const w = dim(row.width, 0);
    if (w < 9) continue;
    if (w > 42) continue;
    if (Math.abs(w / 3 - Math.round(w / 3)) > EPS) continue;
    out.push({ row, width: w });
  }
  return out;
}

function unionCovers(
  members: PlacedCabinet[],
  MB: number,
  H: number,
  D: number,
): boolean {
  if (members.length === 0) return false;
  const intervals: { start: number; end: number }[] = [];
  for (const m of members) {
    if (m.placement === "tall" || isPanelItem(m)) return true;
    if (m.depth < D - 0.01) continue;
    const mb = m.mountBottom ?? 54;
    const top = mb + placedHeight(m);
    intervals.push({ start: mb, end: top });
  }
  if (intervals.length === 0) return false;
  const merged = mergeIntervals(intervals);
  const targetLo = MB;
  const targetHi = MB + H;
  for (const iv of merged) {
    if (iv.start <= targetLo + EPS && iv.end >= targetHi - EPS) return true;
  }
  return false;
}

function fillerRows(catalog: readonly DesignCabinet[]): StockRow[] {
  const out: StockRow[] = [];
  for (const row of catalog) {
    if (!isFillerItem(row)) continue;
    if (isPanelItem(row)) continue;
    const w = dim(row.width, 0);
    if (w <= 0) continue;
    out.push({ row, width: w });
  }
  return out;
}

function panelRows(catalog: readonly DesignCabinet[]): DesignCabinet[] {
  return catalog.filter((row) => isPanelItem(row));
}

function pickPanelRow(
  rows: DesignCabinet[],
  hostHeight: number,
  hostDepth: number,
): DesignCabinet | null {
  const candidates = rows.filter(
    (r) => dim(r.height, 0) >= hostHeight - 0.5 && dim(r.width, 0) >= hostDepth - 0.5,
  );
  if (candidates.length === 0) return null;
  const nonFridge = candidates.filter((r) => {
    const text = `${r.description ?? ""} ${r.subCategory ?? ""}`.toLowerCase();
    return !text.includes("refrigerator");
  });
  const pool = nonFridge.length > 0 ? nonFridge : candidates;
  return Array.from(pool).sort((a, b) => dim(a.height, 0) - dim(b.height, 0))[0] ?? null;
}

function pickFillerRow(rows: StockRow[], residual: number, pieceHeight: number): StockRow | null {
  const candidates = rows
    .filter((r) => r.width >= residual - EPS && dim(r.row.height, 0) >= pieceHeight - 0.5)
    .sort((a, b) => a.width - b.width);
  return candidates[0] ?? null;
}

function makePlaceholderFiller(residual: number): DesignCabinet {
  return {
    id: 0,
    masterCode: `FILL-${fmt(residual)}`,
    description: `${fmt(residual)}" filler (unpriced placeholder)`,
    category: "Filler",
    subCategory: "Filler",
    width: String(residual),
    height: null,
    depth: null,
    numberOfDoors: null,
    numberOfDrawers: null,
    fieldModificationNote: `Line sells no filler SKU: unpriced placeholder, order a ${fmt(residual)}" filler`,
  } as unknown as DesignCabinet;
}

function buildBaseItem(
  row: DesignCabinet,
  along: number,
  width: number,
  depth: number,
  height: number,
  side: WallSide,
  room: RoomData,
  styleId: number | null,
  makeUid: () => string,
): PlacedCabinet {
  const seat = wallPlacementAt(along, width, depth, side, room);
  return {
    uid: makeUid(),
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    placement: "base",
    x: seat.x,
    y: seat.y,
    rotation: seat.rotation,
    wallId: side,
    wallOffset: along,
    width,
    depth,
    height,
    mountBottom: 0,
    numberOfDoors: row.numberOfDoors ?? null,
    numberOfDrawers: row.numberOfDrawers ?? null,
    catalogImageUrl: row.catalogImageUrl ?? null,
    constructionMethod: row.constructionMethod ?? null,
    styleId,
  } as PlacedCabinet;
}

function buildWallItem(
  row: DesignCabinet,
  along: number,
  width: number,
  depth: number,
  height: number,
  mountBottom: number,
  side: WallSide,
  room: RoomData,
  styleId: number | null,
  makeUid: () => string,
): PlacedCabinet {
  const seat = wallPlacementAt(along, width, depth, side, room);
  return {
    uid: makeUid(),
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    placement: "wall",
    x: seat.x,
    y: seat.y,
    rotation: seat.rotation,
    wallId: side,
    wallOffset: along,
    width,
    depth,
    height,
    mountBottom,
    numberOfDoors: row.numberOfDoors ?? null,
    numberOfDrawers: row.numberOfDrawers ?? null,
    catalogImageUrl: row.catalogImageUrl ?? null,
    constructionMethod: row.constructionMethod ?? null,
    styleId,
  } as PlacedCabinet;
}

function buildPanelItem(
  row: DesignCabinet,
  host: PlacedCabinet,
  side: "start" | "end",
  along: number,
  wallSide: WallSide,
  room: RoomData,
  makeUid: () => string,
): PlacedCabinet {
  const hostDepth = host.depth;
  const hostHeight = placedHeight(host);
  const seat = wallPlacementAt(along, PANEL_IN, hostDepth, wallSide, room);
  return {
    uid: makeUid(),
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: "Panels",
    subCategory: "End panel",
    placement: host.placement,
    x: seat.x,
    y: seat.y,
    rotation: seat.rotation,
    wallId: wallSide,
    wallOffset: along,
    width: PANEL_IN,
    depth: hostDepth,
    height: hostHeight,
    mountBottom: host.mountBottom ?? 0,
    autoPlacedForUid: host.uid,
    autoPlacedSide: side,
    fieldModificationNote: `Auto-added: finished end panel on the exposed ${side} side of ${host.masterCode}. Cut from ${row.masterCode}.`,
  } as PlacedCabinet;
}

function classifyGroups(
  items: PlacedCabinet[],
  side: WallSide,
  room: RoomData,
  intake: AutoDesignIntake,
  globalKeepUids: Set<string>,
): { groups: Group[]; fill: PlacedCabinet[]; kept: PlacedCabinet[] } {
  const locked = lockedAnchorKinds(intake);
  const byUid = new Map<string, PlacedCabinet>();
  for (const p of items) byUid.set(p.uid, p);

  const fridge = items.find((p) => isRefrigerator(p)) ?? null;
  const range = items.find((p) => isRange(p)) ?? null;
  const sinkBase = items.find((p) => isSinkBase(p)) ?? null;

  const fridgeUids = new Set<string>();
  if (fridge) {
    fridgeUids.add(fridge.uid);
    for (const p of items) if (p.refrigeratorAssemblyId === fridge.uid) fridgeUids.add(p.uid);
  }

  const rangeUids = new Set<string>();
  if (range) {
    rangeUids.add(range.uid);
    const rStart = alongOf(range, side, room);
    const rEnd = rStart + spanOf(range, side, room);
    for (const p of items) {
      if (isUpperLevel(p)) {
        const a = alongOf(p, side, room);
        const b = a + spanOf(p, side, room);
        if (a >= rStart - 0.25 && b <= rEnd + 0.25) rangeUids.add(p.uid);
      }
      if (p.autoPlacedForUid === range.uid) rangeUids.add(p.uid);
    }
  }

  const sinkUids = new Set<string>();
  if (sinkBase) {
    sinkUids.add(sinkBase.uid);
    const sStart = alongOf(sinkBase, side, room);
    const sEnd = sStart + spanOf(sinkBase, side, room);
    for (const p of items) {
      if (isDishwasher(p)) {
        const a = alongOf(p, side, room);
        const b = a + spanOf(p, side, room);
        const gap = Math.max(0, Math.max(sStart - b, a - sEnd));
        if (gap <= 0.25) sinkUids.add(p.uid);
      }
      if (p.autoPlacedForUid === sinkBase.uid) sinkUids.add(p.uid);
    }
  }

  const cornerUids = new Set<string>();
  for (const p of items) {
    if (isCorner(p) && isBaseLevel(p)) {
      cornerUids.add(p.uid);
      for (const q of items) if (q.fillerForCabinetUid === p.uid) cornerUids.add(q.uid);
    }
  }

  const groups: Group[] = [];
  const fill: PlacedCabinet[] = [];
  const kept: PlacedCabinet[] = [];
  const assigned = new Set<string>();

  const makeGroup = (id: string, kind: GroupKind, members: PlacedCabinet[]): Group => {
    const baseMembers = members.filter((m) => isBaseLevel(m));
    const upperMembers = members.filter((m) => isUpperLevel(m) || m.placement === "tall");
    let start = Infinity;
    let end = -Infinity;
    for (const m of baseMembers) {
      const a = alongOf(m, side, room);
      const b = a + spanOf(m, side, room);
      start = Math.min(start, a);
      end = Math.max(end, b);
    }
    if (!Number.isFinite(start)) {
      start = 0;
      end = 0;
    }
    return {
      id,
      kind,
      members,
      baseMembers,
      upperMembers,
      start,
      end,
      fixed: true,
      moveKind: null,
      locked: false,
      wiggle: null,
      landing: null,
    };
  };

  if (fridge) {
    const members = items.filter((p) => fridgeUids.has(p.uid));
    for (const m of members) assigned.add(m.uid);
    groups.push(makeGroup(fridge.uid, "refrigerator", members));
  }
  if (range) {
    const members = items.filter((p) => rangeUids.has(p.uid));
    for (const m of members) assigned.add(m.uid);
    const g = makeGroup(range.uid, "range", members);
    g.moveKind = "stove";
    g.locked = locked.includes("stove");
    if (!g.locked) g.wiggle = { lo: -WIGGLE, hi: WIGGLE };
    groups.push(g);
  }
  if (sinkBase) {
    const members = items.filter((p) => sinkUids.has(p.uid));
    for (const m of members) assigned.add(m.uid);
    const g = makeGroup(sinkBase.uid, "sink", members);
    g.moveKind = "sink";
    g.locked = locked.includes("sink") || locked.includes("dishwasher");
    if (!g.locked) g.wiggle = { lo: -WIGGLE, hi: WIGGLE };
    groups.push(g);
  }
  for (const p of items) {
    if (assigned.has(p.uid)) continue;
    if (isDishwasher(p)) {
      assigned.add(p.uid);
      const g = makeGroup(p.uid, "dishwasher", [p]);
      g.moveKind = "dishwasher";
      g.locked = locked.includes("dishwasher");
      if (!g.locked) g.wiggle = { lo: -WIGGLE, hi: WIGGLE };
      groups.push(g);
    }
  }
  for (const p of items) {
    if (assigned.has(p.uid)) continue;
    if (cornerUids.has(p.uid)) {
      assigned.add(p.uid);
      const members = items.filter((q) => cornerUids.has(q.uid) && (q.uid === p.uid || q.fillerForCabinetUid === p.uid));
      for (const m of members) assigned.add(m.uid);
      groups.push(makeGroup(p.uid, "corner", members));
    }
  }
  for (const p of items) {
    if (assigned.has(p.uid)) continue;
    if (p.placement === "tall" && !isFillerItem(p) && !isPanelItem(p)) {
      assigned.add(p.uid);
      groups.push(makeGroup(p.uid, "tall", [p]));
    }
  }

  for (const p of items) {
    if (assigned.has(p.uid)) continue;
    const tiedToKept =
      (p.fillerForCabinetUid && byUid.has(p.fillerForCabinetUid) && assigned.has(p.fillerForCabinetUid)) ||
      (p.autoPlacedForUid && byUid.has(p.autoPlacedForUid) && assigned.has(p.autoPlacedForUid)) ||
      (p.fillerForCabinetUid != null && globalKeepUids.has(p.fillerForCabinetUid)) ||
      (p.autoPlacedForUid != null && globalKeepUids.has(p.autoPlacedForUid));
    if (tiedToKept) {
      kept.push(p);
      assigned.add(p.uid);
      continue;
    }
    if (isFillerItem(p) || isPanelItem(p)) {
      fill.push(p);
      assigned.add(p.uid);
      continue;
    }
    if (p.placement === "base" && !isSinkBase(p) && !isCorner(p)) {
      fill.push(p);
      assigned.add(p.uid);
      continue;
    }
    if (p.placement === "wall" && !isCorner(p)) {
      fill.push(p);
      assigned.add(p.uid);
      continue;
    }
    kept.push(p);
    assigned.add(p.uid);
  }

  return { groups, fill, kept };
}

function coversEdge(
  member: PlacedCabinet,
  baseHeight: number,
): boolean {
  if (member.placement === "tall") return true;
  if (isPanelItem(member)) return true;
  const h = placedHeight(member);
  const d = member.depth;
  return h >= baseHeight - EPS && d >= 23.9;
}

function buildBaseBlocks(
  groups: Group[],
  frame: NonNullable<ReturnType<typeof wallRunFrame>>,
  baseHeight: number,
  side: WallSide,
  room: RoomData,
): RunBlock[] {
  const blocks: RunBlock[] = [];
  for (const g of groups) {
    if (g.baseMembers.length === 0) continue;
    let start = g.start;
    let end = g.end;
    if (g.kind === "corner") {
      if (Math.abs(end - frame.runEnd) <= 8) end = frame.runEnd;
      if (Math.abs(start - frame.runStart) <= 8) start = frame.runStart;
    }
    const startMembers = g.baseMembers.filter((m) => Math.abs(alongOf(m, side, room) - start) <= 0.25);
    const endMembers = g.baseMembers.filter((m) => {
      const a = alongOf(m, side, room);
      const b = a + spanOf(m, side, room);
      return Math.abs(b - end) <= 0.25;
    });
    const coversStart = startMembers.some((m) => coversEdge(m, baseHeight));
    const coversEnd = endMembers.some((m) => coversEdge(m, baseHeight));
    const ranges: { lo: number; hi: number }[] = [];
    if (g.wiggle) ranges.push(g.wiggle);
    if (g.landing) ranges.push(g.landing);
    const role: RunBlock["role"] =
      g.kind === "refrigerator"
        ? "refrigerator"
        : g.kind === "range"
          ? "range"
          : g.kind === "sink"
            ? "sink"
            : g.kind === "corner"
              ? "corner"
              : g.kind === "tall"
                ? "tall"
                : "other";
    blocks.push({
      id: g.id,
      start,
      end,
      ranges: ranges.length > 0 ? ranges : null,
      role,
      coversStart,
      coversEnd,
    });
  }
  return blocks;
}

function recomputeSpan(g: Group, side: WallSide, room: RoomData): void {
  let start = Infinity;
  let end = -Infinity;
  for (const m of g.baseMembers) {
    const a = alongOf(m, side, room);
    const b = a + spanOf(m, side, room);
    start = Math.min(start, a);
    end = Math.max(end, b);
  }
  if (Number.isFinite(start)) {
    g.start = start;
    g.end = end;
  }
}

function buildBlocked(
  items: readonly PlacedCabinet[],
  side: WallSide,
  room: RoomData,
  frame: NonNullable<ReturnType<typeof wallRunFrame>>,
  openings: readonly WallOpening[],
  level: Level,
  depthLimit: number,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const p of items) {
    const w = cabinetWall(p, room);
    if (w === side) continue;
    if (level === "base" && !isBaseLevel(p)) continue;
    if (level === "wall" && !isUpperLevel(p)) continue;
    const proj = projectInward(p, frame);
    if (!overlaps(proj.inLo, proj.inHi, 0.5, depthLimit)) continue;
    const lo = Math.max(frame.runStart, proj.alongLo);
    const hi = Math.min(frame.runEnd, proj.alongHi);
    if (hi > lo + EPS) out.push({ start: lo, end: hi });
  }
  for (const o of openings) {
    if (o.side !== side) continue;
    if (level === "base") {
      if (!blocksFloorRun(o.kind)) continue;
    } else {
      const sill = o.kind === "door" ? 0 : o.sill;
      const top = sill + o.height;
      if (!overlaps(sill, top, 0, depthLimit)) continue;
    }
    const iv = openingAlong(o, frame);
    out.push({ start: Math.max(frame.runStart, iv.start), end: Math.min(frame.runEnd, iv.end) });
  }
  return mergeIntervals(out);
}

function chooseFamily(
  width: number,
  preferDrawer: boolean,
  plain: StockRow[],
  drawer: StockRow[],
): { row: DesignCabinet; family: "plain" | "drawer" } | null {
  const hasPlain = plain.some((r) => Math.abs(r.width - width) < EPS);
  const hasDrawer = drawer.some((r) => Math.abs(r.width - width) < EPS);
  if (preferDrawer) {
    if (hasDrawer) return { row: drawer.find((r) => Math.abs(r.width - width) < EPS)!.row, family: "drawer" };
    if (hasPlain) return { row: plain.find((r) => Math.abs(r.width - width) < EPS)!.row, family: "plain" };
  } else {
    if (hasPlain) return { row: plain.find((r) => Math.abs(r.width - width) < EPS)!.row, family: "plain" };
    if (hasDrawer) return { row: drawer.find((r) => Math.abs(r.width - width) < EPS)!.row, family: "drawer" };
  }
  return null;
}

function planLevel(
  spec: RunSpec,
): ReturnType<typeof planRun> {
  return planRun(spec);
}

export function repackFifteenRuleLayout(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  intake: AutoDesignIntake;
  baseCatalog: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  fillerCatalog: readonly DesignCabinet[];
  panelCatalog: readonly DesignCabinet[];
  styleId: number | null;
  makeUid: () => string;
}): FifteenRepackResult {
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const moves: FifteenRepackMove[] = [];

  const baseStock = baseRows(input.baseCatalog);
  const fillerStock = fillerRows(input.fillerCatalog);
  const panelStock = panelRows(input.panelCatalog);

  const keptOrder: PlacedCabinet[] = [];
  const newItems: PlacedCabinet[] = [];
  const removedUids = new Set<string>();

  const allItems = Array.from(input.placed);

  // Global keep set: every corner cabinet, fridge, range, sink base, DW, tall item.
  const globalKeepUids = new Set<string>();
  for (const p of input.placed) {
    if (isCorner(p)) globalKeepUids.add(p.uid);
    if (isRefrigerator(p)) globalKeepUids.add(p.uid);
    if (isRange(p)) globalKeepUids.add(p.uid);
    if (isSinkBase(p)) globalKeepUids.add(p.uid);
    if (isDishwasher(p)) globalKeepUids.add(p.uid);
    if (p.placement === "tall") globalKeepUids.add(p.uid);
  }

  // Pre-scan: figure out wall-cabinet H/D/MB defaults across all walls.
  const allWallFill: PlacedCabinet[] = [];
  for (const side of WALLS) {
    const frame = wallRunFrame(side, input.room);
    if (!frame) continue;
    const onWall = allItems.filter((p) => {
      const w = cabinetWall(p, input.room);
      return w === side;
    });
    const { fill } = classifyGroups(onWall, side, input.room, input.intake, globalKeepUids);
    for (const p of fill) if (p.placement === "wall") allWallFill.push(p);
  }
  const defaultH = mostCommon(allWallFill.map((p) => placedHeight(p))) ?? 30;
  const defaultD = mostCommon(allWallFill.map((p) => p.depth)) ?? 12;
  const defaultMB = mostCommon(allWallFill.map((p) => p.mountBottom ?? 54)) ?? 54;

  for (const side of WALLS) {
    const frame = wallRunFrame(side, input.room);
    if (!frame) continue;
    const onWall = allItems.filter((p) => {
      const w = cabinetWall(p, input.room);
      return w === side;
    });
    if (onWall.length === 0) continue;
    if (!onWall.some((p) => isBaseLevel(p))) continue;

    const { groups, fill, kept } = classifyGroups(onWall, side, input.room, input.intake, globalKeepUids);
    for (const p of kept) keptOrder.push(p);
    for (const p of fill) removedUids.add(p.uid);

    // Kept items not in a group become fixed obstacles.
    const groupedUids = new Set<string>();
    for (const g of groups) for (const m of g.members) groupedUids.add(m.uid);
    const extraBaseBlocks: RunBlock[] = [];
    const extraUpperBlocks: RunBlock[] = [];
    for (const p of kept) {
      if (groupedUids.has(p.uid)) continue;
      const a = alongOf(p, side, input.room);
      const b = a + spanOf(p, side, input.room);
      if (isBaseLevel(p)) {
        const tiedToCorner =
          (p.fillerForCabinetUid != null && globalKeepUids.has(p.fillerForCabinetUid)) ||
          (p.autoPlacedForUid != null && globalKeepUids.has(p.autoPlacedForUid));
        extraBaseBlocks.push({
          id: `kept-base-${p.uid}`,
          start: a,
          end: b,
          ranges: null,
          role: tiedToCorner ? "corner" : "other",
          coversStart: true,
          coversEnd: true,
        });
      } else if (isUpperLevel(p) || p.placement === "tall") {
        extraUpperBlocks.push({
          id: `kept-upper-${p.uid}`,
          start: a,
          end: b,
          ranges: null,
          role: "other",
          coversStart: true,
          coversEnd: true,
        });
      }
    }

    // Base height default
    const baseHeights = groups
      .flatMap((g) => g.baseMembers)
      .filter((m) => m.placement === "base")
      .map((m) => placedHeight(m));
    const baseHeight = mostCommon(baseHeights) ?? 34.5;

    // Landing pairs
    const landingPairs: { a: string; b: string; minIn: number }[] = [];
    const fridgeGroup = groups.find((g) => g.kind === "refrigerator");
    if (fridgeGroup) {
      const neighbors = groups.filter((g) => g.kind === "range" || g.kind === "sink");
      for (const nb of neighbors) {
        const after = nb.start >= fridgeGroup.end - EPS;
        const before = nb.end <= fridgeGroup.start + EPS;
        if (!after && !before) continue;
        const counter = after ? nb.start - fridgeGroup.end : fridgeGroup.start - nb.end;
        landingPairs.push({ a: fridgeGroup.id, b: nb.id, minIn: LANDING_MIN_IN });
        if (counter < LANDING_MIN_IN && input.intake.construction === "new" && !nb.locked) {
          const r = LANDING_MIN_IN - counter;
          if (after) nb.landing = { lo: r, hi: r + WIGGLE };
          else nb.landing = { lo: -(r + WIGGLE), hi: -r };
        }
      }
    }

    // Sink/DW panel shift
    const sinkGroup = groups.find((g) => g.kind === "sink");
    if (sinkGroup) {
      const sinkBase = sinkGroup.baseMembers.find((m) => isSinkBase(m));
      const dw = sinkGroup.baseMembers.find((m) => isDishwasher(m));
      if (sinkBase && dw) {
        const dwH = placedHeight(dw);
        const sbH = placedHeight(sinkBase);
        if (dwH < sbH - EPS) {
          const dwAlong = alongOf(dw, side, input.room);
          const sbAlong = alongOf(sinkBase, side, input.room);
          const dwAfter = dwAlong >= sbAlong;
          const delta = dwAfter ? 0.75 : -0.75;
          const shifted = shiftItem(dw, delta, frame);
          const idx = sinkGroup.members.indexOf(dw);
          if (idx >= 0) sinkGroup.members[idx] = shifted;
          const bIdx = sinkGroup.baseMembers.indexOf(dw);
          if (bIdx >= 0) sinkGroup.baseMembers[bIdx] = shifted;
          const panelRow = pickPanelRow(panelStock, sbH, sinkBase.depth);
          if (panelRow) {
            const panelAlong = dwAfter ? alongOf(sinkBase, side, input.room) + spanOf(sinkBase, side, input.room) : alongOf(sinkBase, side, input.room) - PANEL_IN;
            const panel = buildPanelItem(panelRow, sinkBase, dwAfter ? "end" : "start", panelAlong, side, input.room, input.makeUid);
            sinkGroup.members.push(panel);
            sinkGroup.baseMembers.push(panel);
            notes.push(`Added end panel between ${sinkBase.masterCode} and ${dw.masterCode}.`);
          }
        }
        recomputeSpan(sinkGroup, side, input.room);
      }
    }

    // Build base blocks
    const baseBlocks = buildBaseBlocks(groups, frame, baseHeight, side, input.room);
    for (const b of extraBaseBlocks) baseBlocks.push(b);
    const baseBlocked = buildBlocked(allItems, side, input.room, frame, input.openings, "base", 23.5);

    const panelRowBase = pickPanelRow(panelStock, baseHeight, 24);
    const panelInBase = panelRowBase ? PANEL_IN : 0;

    const baseSpec: RunSpec = {
      runStart: frame.runStart,
      runEnd: frame.runEnd,
      blocked: baseBlocked,
      blocks: baseBlocks,
      widths: baseStock.widths,
      fillerMaxIn: FILLER_MAX,
      panelIn: panelInBase,
      landingPairs,
      step: 0.125,
    };
    const basePlan = planLevel(baseSpec);

    // Apply offsets
    const groupById = new Map(groups.map((g) => [g.id, g]));
    for (const [gid, delta] of Object.entries(basePlan.offsets)) {
      if (Math.abs(delta) < EPS) continue;
      const g = groupById.get(gid);
      if (!g) continue;
      for (let i = 0; i < g.members.length; i++) {
        g.members[i] = shiftItem(g.members[i], delta, frame);
      }
      for (let i = 0; i < g.baseMembers.length; i++) {
        g.baseMembers[i] = shiftItem(g.baseMembers[i], delta, frame);
      }
      for (let i = 0; i < g.upperMembers.length; i++) {
        g.upperMembers[i] = shiftItem(g.upperMembers[i], delta, frame);
      }
      if (g.moveKind) {
        const reason: "landing" | "wiggle" = Math.abs(delta) > WIGGLE ? "landing" : "wiggle";
        const anchor = g.members.find((m) => m.uid === g.id) ?? g.members[0];
        if (anchor) {
          moves.push({ uid: anchor.uid, kind: g.moveKind, wallId: side, deltaAlongIn: delta, reason });
          const label = anchor.masterCode;
          if (reason === "landing") {
            notes.push(`${label} moved ${fmt(delta)}" so the refrigerator has ${LANDING_MIN_IN}" of counter (Tom's 15" minimum).`);
          } else {
            notes.push(`${label} wiggled ${fmt(delta)}" so the run closes with stock cabinets.`);
          }
        }
      }
    }

    // Push all group members (after shifts) to keptOrder so moved items emit at their new position.
    for (const g of groups) {
      recomputeSpan(g, side, input.room);
      for (const m of g.members) keptOrder.push(m);
    }

    // Rebuild blocks after shifts for gap creation
    const shiftedBaseBlocks = buildBaseBlocks(groups, frame, baseHeight, side, input.room);
    for (const b of extraBaseBlocks) shiftedBaseBlocks.push(b);
    const rangeBlock = shiftedBaseBlocks.find((b) => b.role === "range");
    const fridgeBlock = shiftedBaseBlocks.find((b) => b.role === "refrigerator");

    const preferDrawers = hasPreference(input.intake, "lots-of-drawers");

    for (const gap of basePlan.gaps) {
      const pieces = gap.pieces;
      const isFridgeRangeCounter =
        fridgeBlock !== undefined &&
        rangeBlock !== undefined &&
        gap.start >= Math.min(fridgeBlock.end, rangeBlock.end) - EPS &&
        gap.end <= Math.max(fridgeBlock.start, rangeBlock.start) + EPS;

      const created: PlacedCabinet[] = [];
      for (const piece of pieces) {
        const touchesRange =
          rangeBlock !== undefined &&
          (Math.abs(piece.start - rangeBlock.end) < 0.5 || Math.abs(piece.start + piece.width - rangeBlock.start) < 0.5);
        const preferDrawer = preferDrawers || (touchesRange && !isFridgeRangeCounter);
        const chosen = chooseFamily(piece.width, preferDrawer, baseStock.plain, baseStock.drawer);
        if (!chosen) continue;
        const depth = dim(chosen.row.depth, 24);
        const height = dim(chosen.row.height, 34.5);
        const item = buildBaseItem(chosen.row, piece.start, piece.width, depth, height, side, input.room, input.styleId, input.makeUid);
        newItems.push(item);
        created.push(item);
      }

      if (gap.filler) {
        const residual = gap.filler.width;
        const row = pickFillerRow(fillerStock, residual, baseHeight);
        if (row) {
          const depth = dim(row.row.depth, 24);
          const height = dim(row.row.height, baseHeight);
          const item = buildBaseItem(row.row, gap.filler.start, residual, depth, height, side, input.room, input.styleId, input.makeUid);
          item.nominalWidth = row.width;
          newItems.push(item);
          created.push(item);
        } else {
          const placeholder = makePlaceholderFiller(residual);
          const item = buildBaseItem(placeholder, gap.filler.start, residual, 24, baseHeight, side, input.room, input.styleId, input.makeUid);
          newItems.push(item);
          created.push(item);
          findings.push({
            ruleId: "auto-design-rule-10",
            code: "filler-sku-missing",
            severity: "warning",
            title: `${fmt(residual)}" filler needs a filler SKU`,
            detail: `No filler SKU in the line covers ${fmt(residual)}" on ${side}. Placeholder FILL-${fmt(residual)} added (unpriced).`,
          });
        }
      }

      // Panels
      if (panelRowBase) {
        for (const panel of gap.panels) {
          const host = panel.side === "start" ? created[0] : created[created.length - 1];
          if (!host) continue;
          if (isFillerItem(host)) continue;
          const panelAlong = panel.side === "start" ? panel.start : panel.start;
          const item = buildPanelItem(panelRowBase, host, panel.side, panelAlong, side, input.room, input.makeUid);
          newItems.push(item);
        }
      } else if (gap.panels.length > 0) {
        findings.push({
          ruleId: "exposed-panel-three-quarter",
          code: "end-panel-sku-missing",
          severity: "info",
          title: `End panel SKU missing on ${side}`,
          detail: `No panel stock covers the exposed side on ${side}; 0.75" end panel not placed.`,
        });
      }

      if (gap.openIn > 0.01) {
        findings.push({
          ruleId: "leftover-real-cabinets-first",
          code: "opening-left-open",
          severity: "warning",
          title: `${fmt(gap.openIn)}" opening left open on ${side}`,
          detail: `No stock width or filler closes the ${fmt(gap.openIn)}" opening on ${side}.`,
        });
      }
    }

    // WALL-CABINET level
    const wallFillOnWall = fill.filter((p) => p.placement === "wall");
    const H = mostCommon(wallFillOnWall.map((p) => placedHeight(p))) ?? defaultH;
    const D = mostCommon(wallFillOnWall.map((p) => p.depth)) ?? defaultD;
    const MB = mostCommon(wallFillOnWall.map((p) => p.mountBottom ?? 54)) ?? defaultMB;

    const hasUppers = wallFillOnWall.length > 0 || allWallFill.length > 0;
    if (hasUppers) {
      const wallStock = wallRows(input.wallCatalog, H, D);
      const wallWidths = Array.from(new Set(wallStock.map((r) => r.width))).sort((a, b) => a - b);

      const upperBlocks: RunBlock[] = [];
      for (const g of groups) {
        if (g.upperMembers.length === 0) continue;
        let start = Infinity;
        let end = -Infinity;
        for (const m of g.upperMembers) {
          const a = alongOf(m, side, input.room);
          const b = a + spanOf(m, side, input.room);
          start = Math.min(start, a);
          end = Math.max(end, b);
        }
        if (!Number.isFinite(start)) continue;
        const startMembers = g.upperMembers.filter((m) => Math.abs(alongOf(m, side, input.room) - start) <= 0.25);
        const endMembers = g.upperMembers.filter((m) => {
          const a = alongOf(m, side, input.room);
          const b = a + spanOf(m, side, input.room);
          return Math.abs(b - end) <= 0.25;
        });
        const coversStart = unionCovers(startMembers, MB, H, D);
        const coversEnd = unionCovers(endMembers, MB, H, D);
        const role: RunBlock["role"] =
          g.kind === "refrigerator"
            ? "refrigerator"
            : g.kind === "range"
              ? "range"
              : g.kind === "corner"
                ? "corner"
                : g.kind === "tall"
                  ? "tall"
                  : "other";
        upperBlocks.push({ id: g.id, start, end, ranges: null, role, coversStart, coversEnd });
      }
      for (const b of extraUpperBlocks) upperBlocks.push(b);

      const upperBlocked = buildBlocked(allItems, side, input.room, frame, input.openings, "wall", D - 0.5);

      // Uppers only hang over base cabinets: block intervals with no base support
      const baseSupport: { start: number; end: number }[] = [];
      for (const b of shiftedBaseBlocks) baseSupport.push({ start: b.start, end: b.end });
      for (const b of baseBlocked) baseSupport.push(b);
      for (const item of newItems) {
        if (cabinetWall(item, input.room) !== side) continue;
        if (!isBaseLevel(item)) continue;
        const a = alongOf(item, side, input.room);
        baseSupport.push({ start: a, end: a + spanOf(item, side, input.room) });
      }
      const mergedSupport = mergeIntervals(baseSupport);
      const noSupport: { start: number; end: number }[] = [];
      let cursor = frame.runStart;
      for (const s of mergedSupport) {
        if (s.start > cursor + EPS) noSupport.push({ start: cursor, end: s.start });
        cursor = Math.max(cursor, s.end);
      }
      if (cursor < frame.runEnd - EPS) noSupport.push({ start: cursor, end: frame.runEnd });

      const panelRowWall = pickPanelRow(panelStock, H, D);
      const panelInWall = panelRowWall ? PANEL_IN : 0;

      const wallSpec: RunSpec = {
        runStart: frame.runStart,
        runEnd: frame.runEnd,
        blocked: mergeIntervals(Array.from(upperBlocked).concat(noSupport)),
        blocks: upperBlocks,
        widths: wallWidths,
        fillerMaxIn: FILLER_MAX,
        panelIn: panelInWall,
        landingPairs: [],
        step: 0.125,
      };
      const wallPlan = planLevel(wallSpec);

      for (const gap of wallPlan.gaps) {
        const created: PlacedCabinet[] = [];
        for (const piece of gap.pieces) {
          const row = wallStock.find((r) => Math.abs(r.width - piece.width) < EPS);
          if (!row) {
            findings.push({
              ruleId: "leftover-real-cabinets-first",
              code: "opening-left-open",
              severity: "warning",
              title: `${fmt(piece.width)}" wall cabinet missing on ${side}`,
              detail: `No ${fmt(piece.width)}" wall cabinet in stock at ${fmt(H)}"x${fmt(D)}" on ${side}; opening left open.`,
            });
            continue;
          }
          const depth = dim(row.row.depth, D);
          const item = buildWallItem(row.row, piece.start, piece.width, depth, H, MB, side, input.room, input.styleId, input.makeUid);
          newItems.push(item);
          created.push(item);
        }
        if (gap.filler) {
          const residual = gap.filler.width;
          const row = pickFillerRow(fillerStock, residual, H);
          if (row) {
            const depth = dim(row.row.depth, D);
            const item = buildWallItem(row.row, gap.filler.start, residual, depth, H, MB, side, input.room, input.styleId, input.makeUid);
            item.nominalWidth = row.width;
            newItems.push(item);
            created.push(item);
          } else {
            const placeholder = makePlaceholderFiller(residual);
            const item = buildWallItem(placeholder, gap.filler.start, residual, D, H, MB, side, input.room, input.styleId, input.makeUid);
            newItems.push(item);
            created.push(item);
            findings.push({
              ruleId: "auto-design-rule-10",
              code: "filler-sku-missing",
              severity: "warning",
              title: `${fmt(residual)}" filler needs a filler SKU`,
              detail: `No filler SKU in the line covers ${fmt(residual)}" on ${side} (wall level). Placeholder FILL-${fmt(residual)} added (unpriced).`,
            });
          }
        }
        if (panelRowWall) {
          for (const panel of gap.panels) {
            const host = panel.side === "start" ? created[0] : created[created.length - 1];
            if (!host) continue;
            if (isFillerItem(host)) continue;
            const item = buildPanelItem(panelRowWall, host, panel.side, panel.start, side, input.room, input.makeUid);
            newItems.push(item);
          }
        } else if (gap.panels.length > 0) {
          findings.push({
            ruleId: "exposed-panel-three-quarter",
            code: "end-panel-sku-missing",
            severity: "info",
            title: `End panel SKU missing on ${side} (wall level)`,
            detail: `No panel stock covers the exposed side on ${side}; 0.75" end panel not placed.`,
          });
        }
        if (gap.openIn > 0.01) {
          findings.push({
            ruleId: "leftover-real-cabinets-first",
            code: "opening-left-open",
            severity: "warning",
            title: `${fmt(gap.openIn)}" opening left open on ${side} (wall level)`,
            detail: `No stock width or filler closes the ${fmt(gap.openIn)}" opening on ${side}.`,
          });
        }
      }
    }
  }

  // Assemble final placed list: kept (shifted) in original order, then new items.
  const keptByUid = new Map<string, PlacedCabinet>();
  for (const p of keptOrder) keptByUid.set(p.uid, p);

  const placed: PlacedCabinet[] = [];
  const emitted = new Set<string>();
  for (const original of input.placed) {
    if (removedUids.has(original.uid)) continue;
    const kept = keptByUid.get(original.uid);
    if (kept) {
      placed.push(kept);
      emitted.add(original.uid);
    } else {
      placed.push(original);
      emitted.add(original.uid);
    }
  }
  for (const p of keptOrder) {
    if (!emitted.has(p.uid)) {
      placed.push(p);
      emitted.add(p.uid);
    }
  }
  for (const p of newItems) placed.push(p);

  return { placed, notes, findings, moves };
}
