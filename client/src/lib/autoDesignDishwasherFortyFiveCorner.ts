/**
 * Tom, Nov 16 2026 (voice go 4:38 PM CT): the dishwasher at a 45° corner.
 *
 * Auto Design seats a measured dishwasher exactly where it was measured. When
 * that spot puts its corner end inside the space a 45° turn needs for its
 * filler (the front miter line sits 24 × tan 22.5° ≈ 9.94″ from the vertex, and
 * the cabinets stand one 3″ board past it), nothing could close the corner: the
 * dishwasher was skipped as an appliance and a bare strip was left.
 *
 * This pass, run after every re-tiling pass of the build:
 *   1. finds a dishwasher whose corner end sits closer to a 45° vertex than the
 *      front miter line + ½″, with a cabinet run on the next wall;
 *   2. slides it away from the corner only as far as needed, so its end lands
 *      between the miter line + ½″ and the ordinary 45° cabinet seat, and the
 *      plain base cabinets between it and the fixed box behind it (the sink,
 *      another appliance, a corner unit) are re-tiled with stock widths so no
 *      bare strip and no new filler is left. The smallest move that tiles
 *      exactly wins;
 *   3. seats the dishwasher panel (the line's own DWR row) on that end, cut on
 *      the 22.5° miter (`syncDishwasherPanels`), and the next wall's single
 *      miter board (`closeDishwasherPanelAngledCorners`). A line with no panel
 *      row falls back to the ordinary two-piece pair against the dishwasher,
 *      which the 45° code now accepts as a base for corner joining.
 *
 * Every move is reported (how far and why). A dishwasher that cannot move
 * (a locked utility, or no exact stock tiling within the seat) is left at its
 * measurement and named, never silently.
 */
import {
  STD,
  appendCollisionFreePlacements,
  dim,
  footprintDepth,
  formatEighthInches,
  isFillerItem,
  isPanelItem,
  isSinkBaseCabinet,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import { isPlacedCornerCabinet } from "./autoDesignCornerGuard";
import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { closeDishwasherPanelAngledCorners } from "./angledWallFiller";
import {
  DISHWASHER_FORTY_FIVE_PANEL_REASON,
  DISHWASHER_PANEL_MIN_MITER_CUT_IN,
  isDishwasherItem,
  syncDishwasherPanels,
  type DishwasherPanelStock,
} from "./dishwasherPanelRule";
import type { CatalogFillerCandidate } from "./catalogFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";

const EPS = 1 / 16;
/** A cabinet on the next wall this close to the vertex is the run the corner joins. */
const NEIGHBOR_REACH_IN = 18;
/** At most this many stock bases re-tile the span behind the dishwasher. */
const MAX_RETILE_PIECES = 3;

export type DishwasherFortyFiveMove = {
  uid: string;
  masterCode: string;
  wallId: string;
  shiftIn: number;
  fromCornerIn: number;
  toCornerIn: number;
  replaced: string[];
  laid: string[];
};

export type DishwasherFortyFiveResult = {
  placed: PlacedCabinet[];
  moves: DishwasherFortyFiveMove[];
  findings: DesignerReviewFinding[];
};

type Span = { item: PlacedCabinet; start: number; end: number };

function spanOn(item: PlacedCabinet, wallId: string, room: RoomData): Span {
  const start = wallRunOffset(item, wallId, room);
  return { item, start, end: start + wallRunSpan(item, wallId, room) };
}

function floorBand(item: PlacedCabinet): boolean {
  return item.placement === "base" || item.placement === "appliance" || item.placement === "tall";
}

/** A plain stock base (or a straight filler) the pass may re-tile; everything else is fixed. */
function retileable(item: PlacedCabinet, keepUids: ReadonlySet<string>): boolean {
  if (item.placement !== "base" || keepUids.has(item.uid)) return false;
  if (item.fillerTransitionKind || item.autoPlacedReason) return false;
  if (isPanelItem(item) || isSinkBaseCabinet(item) || isPlacedCornerCabinet(item)) return false;
  if (isFillerItem(item)) return !item.fillerPieceGroupId;
  return true;
}

/** Widths of the stock tiling closest to `length` from below within [min, max], or null. */
function stockTiling(
  catalog: readonly DesignCabinet[],
  minLength: number,
  maxLength: number,
): { length: number; rows: DesignCabinet[] } | null {
  const widths = Array.from(new Set(catalog.map((row) => dim(row.width, 0)).filter((width) => width > 0))).sort((a, b) => b - a);
  const sums = new Set<number>([0]);
  let frontier: number[] = [0];
  for (let depth = 0; depth < MAX_RETILE_PIECES; depth += 1) {
    const next: number[] = [];
    for (const base of frontier) for (const width of widths) {
      const total = Math.round((base + width) * 1000) / 1000;
      if (total > maxLength + EPS || sums.has(total)) continue;
      sums.add(total);
      next.push(total);
    }
    frontier = next;
  }
  const candidates = Array.from(sums).filter((total) => total >= minLength - EPS && total <= maxLength + EPS).sort((a, b) => b - a);
  for (const length of candidates) {
    if (length <= EPS) return { length: 0, rows: [] };
    const plan = planAutoDesignBaseSegment({ length, catalog: catalog as DesignCabinet[], rangeAtStart: false, rangeAtEnd: false });
    const cabinets = plan.items.filter((entry) => !entry.isFiller);
    const covered = cabinets.reduce((total, entry) => total + entry.width, 0);
    if (cabinets.length > 0 && cabinets.length <= MAX_RETILE_PIECES && Math.abs(covered - length) <= EPS
      && plan.items.every((entry) => !entry.isFiller || entry.width <= EPS)) {
      return { length, rows: cabinets.map((entry) => entry.cabinet) };
    }
  }
  return null;
}

/**
 * Stock bases the re-tile may lay: the build's own straight door bases first,
 * then the narrow plain base rows the build's gap passes already close a run
 * with (the 9″ BT9 on lines whose door bases start at 12″). Drawer, vanity,
 * sink, corner and specialty rows are never used here.
 */
export function dishwasherCornerRetileCatalog(
  straightBaseCatalog: readonly DesignCabinet[],
  fullBaseCatalog: readonly DesignCabinet[],
): DesignCabinet[] {
  const straightWidths = new Set(straightBaseCatalog.map((row) => dim(row.width, 0)));
  const narrow = fullBaseCatalog.filter((row) => (row.placement === "base" || !row.placement)
    && (row.id ?? 0) > 0
    && dim(row.width, 0) >= 9
    && !straightWidths.has(dim(row.width, 0))
    && /^B[A-Z]?\d{1,2}$/i.test(row.masterCode.trim())
    && !/vanity|drawer|sink|corner|lazy|susan|blind|filler|panel|appliance|pull[- ]?out/i.test(`${row.description ?? ""} ${row.subCategory ?? ""}`));
  return [...straightBaseCatalog, ...narrow];
}

function panelStockFrom(rows: readonly DesignCabinet[]): DishwasherPanelStock[] {
  const seen = new Set<string>();
  const out: DishwasherPanelStock[] = [];
  for (const row of rows) {
    const key = `${row.id ?? ""}:${row.masterCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: row.id,
      masterCode: row.masterCode,
      description: row.description,
      category: row.category ?? null,
      subCategory: row.subCategory ?? null,
      width: row.width,
      height: row.height,
      depth: row.depth,
      // No price list in the build; the Designer's own sync checks it.
      price: null,
    });
  }
  return out;
}

export function seatDishwashersAtFortyFiveCorners(args: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  runWallIds: readonly string[];
  baseCatalog: readonly DesignCabinet[];
  panelCatalog: readonly DesignCabinet[];
  fillers: readonly CatalogFillerCandidate[];
  lockedUids?: readonly string[];
  keepUids?: readonly string[];
  wallLabelOf?: (wallId: string) => string | null | undefined;
  styleId: number | null;
  makeUid: () => string;
}): DishwasherFortyFiveResult {
  const { room } = args;
  let working = [...args.placed];
  const moves: DishwasherFortyFiveMove[] = [];
  const findings: DesignerReviewFinding[] = [];
  const keep = new Set(args.keepUids ?? []);
  const locked = new Set(args.lockedUids ?? []);
  const label = (wallId: string) => args.wallLabelOf?.(wallId) ?? wallId;
  const cornerDishwashers = new Set<string>();
  const pendingMoveNotes: { uid: string; code: string; title: string; lead: string; retile: string }[] = [];

  for (const original of args.placed.filter(isDishwasherItem)) {
    const dishwasher = working.find((item) => item.uid === original.uid);
    const wallId = dishwasher?.wallId;
    if (!dishwasher || !wallId) continue;
    const wallLen = wallLength(wallId as WallSide, room);
    for (const at of ["start", "end"] as const) {
      const current = working.find((item) => item.uid === dishwasher.uid)!;
      const seat = fortyFiveCornerSeat(room, wallId, at, "base", { neighborWallIds: args.runWallIds });
      if (!seat) continue;
      const own = spanOn(current, wallId, room);
      const toCorner = at === "start" ? own.start : wallLen - own.end;
      if (toCorner > seat.cabinetSetbackIn + STD.BASE_DEPTH) continue;
      // The dishwasher must end its run at this corner: nothing on the floor between it and the vertex.
      const between = working.some((item) => item.uid !== current.uid && item.wallId === wallId && floorBand(item)
        && !item.fillerTransitionKind && (() => {
          const span = spanOn(item, wallId, room);
          return at === "start" ? span.end <= own.start + EPS : span.start >= own.end - EPS;
        })());
      if (between) continue;
      // A cabinet run on the next wall reaches this corner, so the corner has to close.
      const neighborLen = wallLength(seat.neighborWallId as WallSide, room);
      const vertexIsNeighborStart = (() => {
        const join = room.customWalls?.find((wall) => wall.id === seat.neighborWallId);
        const mine = room.customWalls?.find((wall) => wall.id === wallId);
        if (!join || !mine) return true;
        const vertexId = at === "start" ? mine.startVertexId : mine.endVertexId;
        return join.startVertexId === vertexId;
      })();
      const neighborReaches = working.some((item) => item.wallId === seat.neighborWallId && floorBand(item)
        && !item.fillerTransitionKind && !isPanelItem(item) && (() => {
          const span = spanOn(item, seat.neighborWallId, room);
          const gap = vertexIsNeighborStart ? span.start : neighborLen - span.end;
          return gap >= -EPS && gap <= NEIGHBOR_REACH_IN;
        })());
      if (!neighborReaches) continue;

      const minToCorner = seat.frontMiterIn + DISHWASHER_PANEL_MIN_MITER_CUT_IN;
      if (toCorner >= minToCorner - EPS) {
        // Already clear of the miter line: it only needs its corner panel.
        cornerDishwashers.add(current.uid);
        continue;
      }
      const lo = minToCorner - toCorner;
      const hi = seat.cabinetSetbackIn - toCorner;
      const where = `${current.masterCode} on ${label(wallId)}`;
      const named = (code: string, title: string, detail: string) => findings.push({
        ruleId: "dishwasher-forty-five-corner",
        code,
        severity: "warning",
        title,
        detail,
        cabinetUid: current.uid,
        cabinetCode: current.masterCode,
      });
      if (locked.has(current.uid)) {
        named("dishwasher-corner-locked", "Dishwasher at the 45° corner cannot move",
          `${where} ends ${formatEighthInches(toCorner)} from the 45° corner, inside the ${formatEighthInches(seat.cabinetSetbackIn)} the angled corner filler needs, and it is a locked utility, so the corner stays open for a designer decision.`);
        continue;
      }
      // The span behind the dishwasher, back to the first box that must not move.
      const behind = working
        .filter((item) => item.uid !== current.uid && item.wallId === wallId && floorBand(item) && !item.fillerTransitionKind)
        .map((item) => spanOn(item, wallId, room))
        .filter((span) => (at === "end" ? span.end <= own.start + EPS : span.start >= own.end - EPS))
        .sort((a, b) => (at === "end" ? b.end - a.end : a.start - b.start));
      const replaced: Span[] = [];
      let stop: Span | null = null;
      for (const span of behind) {
        if (retileable(span.item, keep)) { replaced.push(span); continue; }
        stop = span;
        break;
      }
      if (!stop) {
        named("dishwasher-corner-no-room", "Dishwasher at the 45° corner could not be moved",
          `${where} ends ${formatEighthInches(toCorner)} from the 45° corner, inside the ${formatEighthInches(seat.cabinetSetbackIn)} the angled corner filler needs, and no fixed cabinet behind it bounds the run, so it was left at its measurement.`);
        continue;
      }
      const spanLength = at === "end" ? own.start - stop.end : stop.start - own.end;
      const tiling = stockTiling(args.baseCatalog, spanLength - hi, spanLength - lo);
      if (!tiling) {
        named("dishwasher-corner-no-room", "Dishwasher at the 45° corner could not be moved",
          `${where} ends ${formatEighthInches(toCorner)} from the 45° corner, inside the ${formatEighthInches(seat.cabinetSetbackIn)} the angled corner filler needs. Moving it ${formatEighthInches(lo)}–${formatEighthInches(hi)} toward ${stop.item.masterCode} leaves no opening this line's stock bases fill exactly, so it was left at its measurement.`);
        continue;
      }
      const shift = Math.round((spanLength - tiling.length) * 1000) / 1000;
      const newStart = at === "end" ? own.start - shift : own.start + shift;
      const spot = wallPlacementAt(newStart, current.width, Math.max(0, current.depth), wallId as WallSide, room);
      if (Math.abs(Number(spot.wallOffset ?? newStart) - newStart) > 0.05) continue;
      const moved: PlacedCabinet = { ...current, ...spot, wallId: spot.wallId ?? wallId, wallOffset: spot.wallOffset ?? newStart };
      const pieces: PlacedCabinet[] = [];
      let cursor = at === "end" ? stop.end : own.end + shift;
      for (const row of tiling.rows) {
        const width = dim(row.width, 0);
        const depth = footprintDepth(row);
        const piece = wallPlacementAt(cursor, width, depth, wallId as WallSide, room);
        pieces.push({
          uid: args.makeUid(), cabinetId: row.id, masterCode: row.masterCode, description: row.description,
          category: row.category, subCategory: row.subCategory, placement: "base", ...piece,
          wallId: piece.wallId ?? wallId, wallOffset: piece.wallOffset ?? cursor,
          width, depth, height: dim(row.height, STD.BASE_HEIGHT), catalogImageUrl: row.catalogImageUrl ?? null,
          numberOfDoors: row.numberOfDoors, numberOfDrawers: row.numberOfDrawers, styleId: args.styleId,
        });
        cursor += width;
      }
      const removed = new Set([current.uid, ...replaced.map((span) => span.item.uid)]);
      const base = working.filter((item) => !removed.has(item.uid));
      const appended = appendCollisionFreePlacements(base, [moved, ...pieces], room);
      if (appended.rejected.length > 0) {
        named("dishwasher-corner-no-room", "Dishwasher at the 45° corner could not be moved",
          `${where} ends ${formatEighthInches(toCorner)} from the 45° corner. Moving it ${formatEighthInches(shift)} would collide with ${appended.rejected.map((item) => item.masterCode).join(", ")}, so it was left at its measurement.`);
        continue;
      }
      working = appended.placed;
      cornerDishwashers.add(current.uid);
      const toCornerAfter = toCorner + shift;
      const replacedCodes = replaced.map((span) => span.item.masterCode);
      const laidCodes = pieces.map((item) => item.masterCode);
      moves.push({ uid: current.uid, masterCode: current.masterCode, wallId, shiftIn: shift, fromCornerIn: toCorner, toCornerIn: toCornerAfter, replaced: replacedCodes, laid: laidCodes });
      const retile = replacedCodes.length || laidCodes.length
        ? ` ${replacedCodes.length ? replacedCodes.join(" + ") : "The opening"} between ${stop.item.masterCode} and the dishwasher became ${laidCodes.length ? laidCodes.join(" + ") : "nothing (the dishwasher now meets it)"}, so no bare strip is left.`
        : "";
      pendingMoveNotes.push({
        uid: current.uid,
        code: current.masterCode,
        title: `Dishwasher moved ${formatEighthInches(shift)} from its measured spot`,
        lead: `${where} was measured ending ${formatEighthInches(toCorner)} from the 45° corner, inside the space the angled corner filler needs (the two cabinet fronts meet about ${formatEighthInches(seat.frontMiterIn)} from the corner). It moved ${formatEighthInches(shift)} away from the corner and now ends ${formatEighthInches(toCornerAfter)} from it`,
        retile,
      });
    }
  }

  const moveFindings = (): DesignerReviewFinding[] => pendingMoveNotes.map((note) => {
    const panel = working.find((item) => item.autoPlacedForUid === note.uid && item.autoPlacedReason === DISHWASHER_FORTY_FIVE_PANEL_REASON);
    const closing = panel
      ? `, so its dishwasher panel (cut to ${formatEighthInches(Number(panel.width))} on the 22.5° miter) and the 22.5° filler from the next wall close the corner.`
      : ", so the 22.5° angled filler pair closes the corner against it.";
    return {
      ruleId: "dishwasher-forty-five-corner",
      code: "dishwasher-moved-for-45-corner",
      severity: "info",
      title: note.title,
      detail: `${note.lead}${closing}${note.retile}`,
      cabinetUid: note.uid,
      cabinetCode: note.code,
    };
  });
  if (cornerDishwashers.size === 0) return { placed: working, moves, findings: [...moveFindings(), ...findings] };

  // The dishwasher panel on the corner end, cut on the 22.5° miter. Only the
  // 45° corner panels are seated by the build; every other dishwasher end is
  // left to the Designer's own sync exactly as before.
  const panelRows = [...args.panelCatalog, ...(args.fillers as unknown as DesignCabinet[])];
  const sync = syncDishwasherPanels({ placed: working, room, catalog: panelStockFrom(panelRows), deferPriceCheck: true });
  const cornerPanels = sync.placed.filter((item) => item.autoPlacedReason === DISHWASHER_FORTY_FIVE_PANEL_REASON
    && item.autoPlacedForUid != null && cornerDishwashers.has(item.autoPlacedForUid)
    && !working.some((existing) => existing.uid === item.uid));
  if (cornerPanels.length > 0) working = [...working, ...cornerPanels];
  for (const warning of sync.warnings) {
    if (warning.reason !== DISHWASHER_FORTY_FIVE_PANEL_REASON || !cornerDishwashers.has(warning.cabinetUid)) continue;
    findings.push({
      ruleId: "dishwasher-forty-five-corner",
      code: warning.id.startsWith("missing-price") ? "dishwasher-panel-sku-missing" : "dishwasher-panel-no-room",
      severity: "warning",
      title: warning.id.startsWith("missing-price") ? "No dishwasher panel for this line" : "Dishwasher panel could not be seated",
      detail: warning.id.startsWith("missing-price")
        ? `${working.find((item) => item.uid === warning.cabinetUid)?.masterCode ?? "The dishwasher"} ends at a 45° corner and needs a dishwasher panel (DWR), and the selected line sells none. The corner is closed with the angled filler pair against the dishwasher instead.`
        : warning.message,
      cabinetUid: warning.cabinetUid,
      cabinetCode: working.find((item) => item.uid === warning.cabinetUid)?.masterCode ?? null,
    });
  }
  // The next wall's single miter board meets the panel at the miter point.
  working = closeDishwasherPanelAngledCorners(working, room, args.fillers, args.makeUid, args.styleId).placed;
  return { placed: working, moves, findings: [...moveFindings(), ...findings] };
}
