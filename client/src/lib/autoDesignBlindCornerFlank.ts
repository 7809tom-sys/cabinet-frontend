/**
 * Corner flank rule (Tom, Nov 17 2026, voice 11:14 AM CT): every blind corner
 * cabinet Auto Design places, upper (WBC) or base (BBC), must have a real
 * cabinet directly beside it on BOTH sides:
 *   - blind side: the first cabinet of the adjoining wall's run, butted to the
 *     blind cabinet's face (past its required clearance filler), so the blind
 *     area is covered and the run connects around the corner;
 *   - open side: the first cabinet on the blind cabinet's own wall, right beside
 *     its door.
 *
 * The 24″ inside-corner square every 90° vertex reserves (see
 * `autoDesignInsideCornerReservations`) kept the later gap passes from ever
 * filling the adjoining wall's spot in front of a 12″-deep WBC, so the upper
 * beside the corner was left blank (demo, Nov 17 2026: W2730 ended at 120,
 * WBC2730 face at 132, 120–132 stayed empty). This pass runs once at the end
 * of the build, claims only the flank spot inside that reservation, and seats
 * real catalog widths there. A plain filler touching the corner may be swapped
 * for a cabinet only when real widths cover its span exactly. When no cabinet
 * fits (an appliance sits there, or the opening is narrower than any stock
 * box), nothing is invented: a visible warning names the corner. One pass, no
 * retry loop (one-redraw rule).
 */
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { isWallBlindCornerCabinet } from "./cabinetGraphics";
import { requiredBlindCornerFillerGroupId, isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import type { WallLabel } from "./autoDesignAutoBuild";
import {
  WALL_OPENING_CLEARANCE_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  elevationBox,
  isBaseBlindCorner,
  isFillerItem,
  isPanelItem,
  placedFootprint,
  wallPlacementAt,
  wallRunFrame,
  wallRunJoinAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallRunFrame,
  type WallSide,
} from "./design";

const EPS = 0.3;
const MIN_FLANK_IN = 9;
/** A blind corner farther than this from a vertex is not seated in a corner. */
const CORNER_REACH_IN = 15;
const BASE_BAND_TOP_IN = 34.5;

export type BlindCornerFlankResult = {
  placed: PlacedCabinet[];
  notes: string[];
  warnings: string[];
  findings: DesignerReviewFinding[];
  /** Cabinets this pass seated. */
  additions: PlacedCabinet[];
};

type Layer = "base" | "wall";
type Span = { start: number; end: number };

function isBlindCornerPiece(item: PlacedCabinet): Layer | null {
  if (item.placement === "wall" && isWallBlindCornerCabinet(item)) return "wall";
  if (isBaseBlindCorner(item)) return "base";
  return null;
}

/** Projection of a piece's plan box onto a wall frame: along-run span and depth band off the wall. */
function project(item: PlacedCabinet, frame: WallRunFrame): { along: Span; across: Span } | null {
  const foot = placedFootprint(item);
  if (!(foot.w > 0.01) || !(foot.d > 0.01)) return null;
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  const pts = [{ x, y }, { x: x + foot.w, y }, { x, y: y + foot.d }, { x: x + foot.w, y: y + foot.d }];
  const along = pts.map((p) => (p.x - frame.start.x) * frame.tangent.x + (p.y - frame.start.y) * frame.tangent.y);
  const across = pts.map((p) => (p.x - frame.start.x) * frame.inward.x + (p.y - frame.start.y) * frame.inward.y);
  return {
    along: { start: Math.min(...along), end: Math.max(...along) },
    across: { start: Math.min(...across), end: Math.max(...across) },
  };
}

function axisAligned(frame: WallRunFrame): boolean {
  return Math.abs(frame.tangent.x) < 1e-6 || Math.abs(frame.tangent.y) < 1e-6;
}

function inLayer(item: PlacedCabinet, layer: Layer, band: Span, room: RoomData): boolean {
  if (item.placement === "island" as never) return false;
  const box = elevationBox(item, room);
  const bottom = box.bottom;
  const top = box.bottom + box.height;
  if (layer === "base") {
    if (!(item.placement === "base" || item.placement === "appliance" || item.placement === "tall")) return false;
    return bottom < BASE_BAND_TOP_IN - EPS;
  }
  if (!(item.placement === "wall" || item.placement === "tall")) return false;
  return bottom < band.end - EPS && top > band.start + EPS;
}

function isRealCabinet(item: PlacedCabinet): boolean {
  return (item.placement === "base" || item.placement === "wall" || item.placement === "tall")
    && !isFillerItem(item) && !isPanelItem(item);
}

function baseFlankRows(catalog: readonly DesignCabinet[]): DesignCabinet[] {
  return catalog.filter((row) => row.id > 0 && (row.placement === "base" || !row.placement)
    && dim(row.width, 0) >= MIN_FLANK_IN && dim(row.depth, 0) > 0
    && !/filler|scribe|panel|corner|lazy|susan|blind|sink|SB\d|vanity|island|appliance|dishwasher|oven/i
      .test(`${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`));
}

function baseRank(row: DesignCabinet): number {
  const code = row.masterCode.toUpperCase();
  if (/^B\d{1,2}$/.test(code)) return 0;
  if (/^B\d/.test(code)) return 1;
  return 2;
}

/** Real catalog widths that cover `span`: exact single, then exact pair, else the widest single that fits. */
function pickWidths(span: number, widths: readonly number[], exactOnly: boolean): number[] {
  const sorted = Array.from(new Set(widths)).filter((w) => w >= MIN_FLANK_IN - 0.01).sort((a, b) => b - a);
  const exact = sorted.find((w) => Math.abs(w - span) <= 0.125);
  if (exact != null) return [exact];
  for (const a of sorted) {
    for (const b of sorted) {
      if (b > a) continue;
      if (Math.abs(a + b - span) <= 0.125) return [a, b];
    }
  }
  if (exactOnly) return [];
  const fit = sorted.find((w) => w <= span + 0.01);
  return fit != null ? [fit] : [];
}

function openingSpans(openings: readonly WallOpening[], wallId: string, layer: Layer): Span[] {
  return openings
    .filter((opening) => opening.side === wallId && (opening.kind === "window" || opening.kind === "door"))
    .filter((opening) => layer === "wall" || opening.kind === "door" || (opening.sill ?? 42) < 36)
    .map((opening) => {
      const clearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
      return { start: opening.offset - clearance, end: opening.offset + opening.width + clearance };
    });
}

type SideCheck =
  | { status: "ok" }
  | { status: "filled"; added: PlacedCabinet[]; removed: PlacedCabinet[] }
  | { status: "blocked"; reason: string };

/**
 * Look along `frame` from `edge` in `dir` (+1 toward runEnd, -1 toward runStart)
 * and make sure a real cabinet sits right there.
 */
function ensureFlankAt(input: {
  blind: PlacedCabinet;
  layer: Layer;
  frame: WallRunFrame;
  edge: number;
  dir: 1 | -1;
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  rows: readonly DesignCabinet[];
  band: Span;
  depthLimit: number;
  styleId: number | null;
  makeUid: () => string;
}): SideCheck {
  const { blind, layer, frame, dir, room } = input;
  const groupId = requiredBlindCornerFillerGroupId(blind);
  type Seen = { item: PlacedCabinet; span: Span };
  const onRun: Seen[] = [];
  for (const item of input.placed) {
    if (item.uid === blind.uid) continue;
    if (!inLayer(item, layer, input.band, room)) continue;
    const p = project(item, frame);
    if (!p) continue;
    // Only pieces standing against this wall (within the blind layer's depth).
    if (p.across.start > input.depthLimit + EPS || p.across.end < -EPS) continue;
    onRun.push({ item, span: p.along });
  }
  // Walk past the blind cabinet's own required clearance filler.
  let edge = input.edge;
  for (let guard = 0; guard < 3; guard += 1) {
    const own = onRun.find((seen) => (seen.item.fillerPieceGroupId === groupId || isRequiredBlindCornerFillerGroupId(seen.item.fillerPieceGroupId))
      && Math.abs((dir > 0 ? seen.span.start : seen.span.end) - edge) <= EPS);
    if (!own) break;
    edge = dir > 0 ? own.span.end : own.span.start;
  }
  const touching = (at: number) => onRun.filter((seen) => {
    const near = dir > 0 ? seen.span.start : seen.span.end;
    const far = dir > 0 ? seen.span.end : seen.span.start;
    return Math.abs(near - at) <= EPS || (dir > 0 ? seen.span.start < at - EPS && far > at + EPS : seen.span.end > at + EPS && far < at - EPS);
  });
  const first = touching(edge);
  if (first.some((seen) => isRealCabinet(seen.item))) return { status: "ok" };
  const blocker = first.find((seen) => !isFillerItem(seen.item));
  if (blocker) {
    return { status: "blocked", reason: `${blocker.item.masterCode} sits there` };
  }
  // Swallow plain fillers touching the corner (never a panel or a required filler).
  const removable: PlacedCabinet[] = [];
  let cursor = edge;
  for (let guard = 0; guard < 4; guard += 1) {
    const filler = touching(cursor).find((seen) => isFillerItem(seen.item) && !isPanelItem(seen.item)
      && !isRequiredBlindCornerFillerGroupId(seen.item.fillerPieceGroupId));
    if (!filler) break;
    removable.push(filler.item);
    cursor = dir > 0 ? filler.span.end : filler.span.start;
  }
  // Free run beyond that, up to the next piece, an opening, or the run end.
  const limits: number[] = [dir > 0 ? frame.runEnd : frame.runStart];
  for (const seen of onRun) {
    if (removable.some((item) => item.uid === seen.item.uid)) continue;
    if (dir > 0 && seen.span.end > cursor + EPS) limits.push(Math.max(cursor, seen.span.start));
    if (dir < 0 && seen.span.start < cursor - EPS) limits.push(Math.min(cursor, seen.span.end));
  }
  for (const span of openingSpans(input.openings, frame.id, layer)) {
    if (dir > 0 && span.end > cursor + EPS) limits.push(Math.max(cursor, span.start));
    if (dir < 0 && span.start < cursor - EPS) limits.push(Math.min(cursor, span.end));
  }
  const far = dir > 0 ? Math.min(...limits) : Math.max(...limits);
  const available = Math.abs(far - edge);
  const nextPiece = onRun
    .filter((seen) => !removable.some((item) => item.uid === seen.item.uid))
    .filter((seen) => Math.abs((dir > 0 ? seen.span.start : seen.span.end) - far) <= EPS)[0];
  const describe = () => {
    const inches = `${Math.round(available * 100) / 100}″`;
    const until = nextPiece ? nextPiece.item.masterCode : "the end of the run";
    return removable.length
      ? `only ${inches} (${removable.map((item) => item.masterCode).join(" + ")} filler) is there before ${until}`
      : `only ${inches} is open before ${until}`;
  };
  if (available < MIN_FLANK_IN - 0.01) return { status: "blocked", reason: describe() };
  const widths = input.rows.map((row) => dim(row.width, 0));
  // A filler may only give way when real widths close its whole span (filler last resort).
  const picked = pickWidths(available, widths, removable.length > 0);
  if (!picked.length) return { status: "blocked", reason: `${describe()}, and no stock ${layer === "wall" ? "wall" : "base"} width closes it` };
  const kept = input.placed.filter((item) => !removable.some((gone) => gone.uid === item.uid));
  const added: PlacedCabinet[] = [];
  let working = kept;
  let along = edge;
  for (const width of picked) {
    const rows = input.rows.filter((row) => Math.abs(dim(row.width, 0) - width) <= 0.05)
      .sort((a, b) => (layer === "base" ? baseRank(a) - baseRank(b) : 0) || a.masterCode.localeCompare(b.masterCode));
    let seated = false;
    for (const source of rows) {
      const depth = dim(source.depth, layer === "wall" ? 12 : 24);
      const start = dir > 0 ? along : along - width;
      const spot = wallPlacementAt(start, width, depth, frame.id as WallSide, room, null, false);
      if (!spot) continue;
      const candidate: PlacedCabinet = {
        uid: input.makeUid(),
        cabinetId: source.id,
        masterCode: source.masterCode,
        description: source.description,
        category: source.category,
        subCategory: source.subCategory,
        placement: layer,
        ...spot,
        width,
        depth,
        height: dim(source.height, layer === "wall" ? input.band.end - input.band.start : 34.5),
        ...(layer === "wall" ? { mountBottom: input.band.start } : {}),
        styleId: input.styleId,
        numberOfDoors: source.numberOfDoors ?? 1,
        numberOfDrawers: source.numberOfDrawers ?? 0,
        catalogImageUrl: source.catalogImageUrl ?? null,
        autoPlacedReason: `Corner flank: beside ${blind.masterCode}`,
      } as PlacedCabinet;
      const accepted = appendCollisionFreePlacements(working, [candidate], room);
      if (accepted.rejected.length > 0) continue;
      working = accepted.placed;
      added.push(candidate);
      seated = true;
      break;
    }
    if (!seated) break;
    along += dir * width;
  }
  if (!added.length) return { status: "blocked", reason: `${describe()}, and no stock box could be seated without a collision` };
  if (removable.length && added.length !== picked.length) {
    return { status: "blocked", reason: `${describe()}, and the stock boxes that close it could not all be seated` };
  }
  return { status: "filled", added, removed: removable };
}

export function ensureBlindCornerFlankCabinets(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallCatalog: readonly DesignCabinet[];
  baseCatalog: readonly DesignCabinet[];
  wallHeightIn: number | null;
  styleId: number | null;
  makeUid: () => string;
  wallLabelOf?: (wallId: string) => WallLabel | null;
}): BlindCornerFlankResult {
  const { room } = input;
  let working = [...input.placed];
  const notes: string[] = [];
  const warnings: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const additions: PlacedCabinet[] = [];
  const baseRows = baseFlankRows(input.baseCatalog);
  const label = (wallId: string) => input.wallLabelOf?.(wallId) ?? wallId;
  const blinds = working.filter((item) => isBlindCornerPiece(item) != null);
  for (const blind of blinds) {
    const layer = isBlindCornerPiece(blind)!;
    const ownId = blind.wallId ?? cabinetWall(blind, room);
    const own = wallRunFrame(ownId, room);
    if (!own || !axisAligned(own)) continue;
    const ownProj = project(blind, own);
    if (!ownProj) continue;
    const dStart = ownProj.along.start - own.runStart;
    const dEnd = own.runEnd - ownProj.along.end;
    const at: "start" | "end" = dStart <= dEnd ? "start" : "end";
    if (Math.min(dStart, dEnd) > CORNER_REACH_IN) continue;
    const join = wallRunJoinAt(own, at, room);
    if (!join || Math.abs(join.turnDeg - 90) > 0.5 || !axisAligned(join.frame)) continue;
    const adj = join.frame;
    const box = elevationBox(blind, room);
    const band: Span = { start: box.bottom, end: box.bottom + box.height };
    const rows = layer === "wall"
      ? autoDesignStandardUpperRows(input.wallCatalog, input.wallHeightIn ?? box.height)
      : baseRows;
    const blindDepth = Math.max(1, Number(blind.depth) || (layer === "wall" ? 12 : 24));
    const corner = `${label(ownId)} / ${label(adj.id)} corner`;
    const sides: Array<{ side: "blind" | "open"; frame: WallRunFrame; edge: number; dir: 1 | -1 }> = [];
    // Blind side: the adjoining wall, at the blind cabinet's inner face.
    const adjProj = project(blind, adj);
    if (adjProj) {
      const vertex = at === "start" ? own.start : own.end;
      const adjAtEnd = Math.hypot(adj.end.x - vertex.x, adj.end.y - vertex.y) <= 0.01;
      sides.push(adjAtEnd
        ? { side: "blind", frame: adj, edge: adjProj.along.start, dir: -1 }
        : { side: "blind", frame: adj, edge: adjProj.along.end, dir: 1 });
    }
    // Open side: the blind cabinet's own wall, right after its door.
    sides.push(at === "start"
      ? { side: "open", frame: own, edge: ownProj.along.end, dir: 1 }
      : { side: "open", frame: own, edge: ownProj.along.start, dir: -1 });
    for (const side of sides) {
      const check = ensureFlankAt({
        blind,
        layer,
        frame: side.frame,
        edge: side.edge,
        dir: side.dir,
        placed: working,
        room,
        openings: input.openings,
        rows,
        band,
        depthLimit: blindDepth,
        styleId: input.styleId,
        makeUid: input.makeUid,
      });
      if (check.status === "ok") continue;
      if (check.status === "filled") {
        const removedUids = new Set(check.removed.map((item) => item.uid));
        working = [...working.filter((item) => !removedUids.has(item.uid)), ...check.added];
        additions.push(...check.added);
        notes.push(`Corner flank: seated ${check.added.map((item) => item.masterCode).join(" + ")} on ${label(side.frame.id)} beside the ${side.side} side of ${blind.masterCode} at the ${corner}${check.removed.length ? ` in place of ${check.removed.map((item) => item.masterCode).join(" + ")} filler` : ""}.`);
        continue;
      }
      const title = `${blind.masterCode} at the ${corner} has no cabinet on its ${side.side} side`;
      const detail = `A blind corner needs a cabinet right beside its ${side.side} side on ${label(side.frame.id)}, but ${check.reason}. Nothing was invented; add a cabinet by hand or move what sits there.`;
      warnings.push(`${title}: ${detail}`);
      findings.push({
        ruleId: "blind-corner-flank",
        code: "blind-corner-flank-missing",
        severity: "warning",
        title,
        detail,
        wallLabel: input.wallLabelOf?.(side.frame.id) ?? null,
        cabinetUid: blind.uid,
        cabinetCode: blind.masterCode,
      });
    }
  }
  return { placed: working, notes, warnings, findings, additions };
}
