/**
 * Dishwasher at the end of a run (Tom, voice, Nov 19 2026: 8:42 AM CT, refined 8:44 AM CT).
 *
 * When a dishwasher is the last run piece at a run end:
 *   • a WALL is known to follow at that end (the room wall, or the adjoining run's cabinets closing the
 *     corner) -> the base filler that closes the gap to the wall stays (a filler is right against a wall);
 *   • an OPENING follows (door / cased opening), or it is UNKNOWN whether a wall follows (the run just
 *     stops in open floor) -> the line's dishwasher panel (DWR / BEP(DWR)3 / DW3, real catalog SKU)
 *     finishes the dishwasher's exposed side instead of a base filler. A line that sells no dishwasher
 *     panel gets a clear report line and no filler.
 *
 * Budget friendly only (the rule Tom gave for budget builds). The panel uses the same uid and
 * `autoPlacedReason` as the Designer's `syncDishwasherPanels`, so the post-build sync recognizes it,
 * prices it from the line's own stock, and never doubles it. Nothing is invented: the panel is a row
 * the line offers, or nothing.
 */
import {
  DISHWASHER_RUN_END_PANEL_REASON,
  blocksFloorRun,
  cabinetWall,
  cabinetWallRunSegment,
  isFillerItem,
  isPanelItem,
  placedFootprint,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { dishwasherPanelStock, isDishwasherItem, DISHWASHER_PANEL_DEFAULT_WIDTH_IN, DISHWASHER_PANEL_MAX_WIDTH_IN } from "./dishwasherPanelRule";

const EPS = 0.05;
/** An opening this close past the run end is what follows it. */
const OPENING_REACH_IN = 6;
const STANDARD_WALLS = new Set(["top", "right", "bottom", "left"]);

export type DishwasherRunEndFollower = "wall" | "cabinet" | "opening" | "unknown";

export type DishwasherRunEndResult = {
  placed: PlacedCabinet[];
  notes: string[];
  changes: Array<{ dishwasherUid: string; edge: "start" | "end"; follows: DishwasherRunEndFollower; removedFillerUids: string[]; panelUid: string | null }>;
};

function isBaseRunPiece(p: PlacedCabinet): boolean {
  if (p.placement === "wall") return false;
  return p.placement === "base" || p.placement === "appliance" || p.placement === "tall";
}

function span(p: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(p, wallId, room);
  return { start, end: start + wallRunSpan(p, wallId, room) };
}

function bbox(p: { x: number; y: number }, w: number, d: number) {
  return { x0: p.x, y0: p.y, x1: p.x + w, y1: p.y + d };
}

function overlaps(a: ReturnType<typeof bbox>, b: ReturnType<typeof bbox>): boolean {
  return a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
}

/** What follows the run end at `along` (just past it, in the run's direction). */
export function dishwasherRunEndFollower(input: {
  wallId: WallSide;
  along: number;
  direction: 1 | -1;
  room: RoomData;
  openings: readonly WallOpening[];
  placed: readonly PlacedCabinet[];
  ignoreUids: ReadonlySet<string>;
}): DishwasherRunEndFollower {
  const { wallId, along, direction, room } = input;
  const segment = cabinetWallRunSegment(wallId, room);
  const runStart = segment.start;
  const runEnd = segment.start + segment.length;
  // The room wall itself.
  if (direction === 1 ? along >= runEnd - 0.5 : along <= runStart + 0.5) return "wall";
  // A door or cased opening on this wall right past the end.
  const opening = input.openings.some((o) => {
    if (o.side !== wallId || !blocksFloorRun(o.kind)) return false;
    const start = Number(o.offset);
    const end = start + Number(o.width);
    return direction === 1
      ? start >= along - EPS - Number(o.width) && start <= along + OPENING_REACH_IN && end > along - EPS
      : end <= along + EPS + Number(o.width) && end >= along - OPENING_REACH_IN && start < along + EPS;
  });
  if (opening) return "opening";
  // The adjoining run's cabinets (another wall) occupy the floor just past the end: the corner is closed.
  const probeAlong = direction === 1 ? along + 0.5 : along - 1.5;
  const spot = wallPlacementAt(probeAlong, 1, 12, wallId, input.room, null, false);
  const rot = ((Math.round(spot.rotation ?? 0) % 360) + 360) % 360;
  const probe = rot === 90 || rot === 270 ? bbox(spot, 12, 1) : bbox(spot, 1, 12);
  const closed = input.placed.some((p) => {
    if (input.ignoreUids.has(p.uid) || !isBaseRunPiece(p)) return false;
    const fp = placedFootprint(p);
    return overlaps(probe, bbox(p, fp.w, fp.d));
  });
  return closed ? "cabinet" : "unknown";
}

export function applyDishwasherRunEndRule(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  panelCatalog: readonly DesignCabinet[];
  budgetFriendly: boolean;
}): DishwasherRunEndResult {
  const result: DishwasherRunEndResult = { placed: [...input.placed], notes: [], changes: [] };
  if (!input.budgetFriendly) return result;
  const { room } = input;
  const stock = dishwasherPanelStock(input.panelCatalog.map((row) => ({
    id: row.id,
    masterCode: row.masterCode,
    description: row.description ?? null,
    category: row.category ?? null,
    subCategory: row.subCategory ?? null,
    width: row.width,
    height: row.height,
    depth: row.depth,
    price: null,
  })));
  const stockWidth = (() => {
    const w = Number(stock?.width);
    return w > 0 && w <= DISHWASHER_PANEL_MAX_WIDTH_IN ? w : DISHWASHER_PANEL_DEFAULT_WIDTH_IN;
  })();

  for (const dishwasher of input.placed.filter(isDishwasherItem)) {
    const wallId = cabinetWall(dishwasher, room) as WallSide | null;
    if (!wallId || !STANDARD_WALLS.has(wallId) || dishwasher.wallOffset == null) continue;
    for (const edge of ["start", "end"] as const) {
      const current = result.placed;
      const own = span(dishwasher, wallId, room);
      const peers = current.filter((p) => p.uid !== dishwasher.uid && isBaseRunPiece(p) && !isPanelItem(p) && cabinetWall(p, room) === wallId);
      // Walk the filler chain off this edge.
      const fillers: PlacedCabinet[] = [];
      let far = edge === "end" ? own.end : own.start;
      let next: PlacedCabinet | undefined;
      for (;;) {
        next = peers.find((p) => {
          const s = span(p, wallId, room);
          return edge === "end" ? Math.abs(s.start - far) <= EPS : Math.abs(s.end - far) <= EPS;
        });
        if (!next || !isFillerItem(next)) break;
        fillers.push(next);
        const s = span(next, wallId, room);
        far = edge === "end" ? s.end : s.start;
      }
      if (next) continue; // a real cabinet or appliance continues the run: not a run end
      if (fillers.length === 0) continue; // nothing to replace; the Designer's panel sync handles a bare open end
      const follows = dishwasherRunEndFollower({
        wallId, along: far, direction: edge === "end" ? 1 : -1, room, openings: input.openings, placed: current,
        ignoreUids: new Set([dishwasher.uid, ...fillers.map((f) => f.uid)]),
      });
      if (follows === "wall" || follows === "cabinet") continue; // a wall follows: the base filler is right
      const fillerIn = Math.abs(far - (edge === "end" ? own.end : own.start));
      const removed = new Set(fillers.map((f) => f.uid));
      let placed = current.filter((p) => !removed.has(p.uid));
      const where = follows === "opening" ? "an opening follows" : "it is not known that a wall follows";
      let panelUid: string | null = null;
      if (!stock) {
        result.notes.push(`Budget friendly: ${dishwasher.masterCode} ends the run on ${wallId} and ${where}, so it takes a dishwasher panel, not a base filler — the selected line sells no dishwasher panel (DWR), so the ${fillerIn.toFixed(2).replace(/\.?0+$/, "")}″ base filler was removed and the side is left open. Add a panel to finish it.`);
      } else {
        const along = edge === "end" ? own.end : own.start - stockWidth;
        const depth = Number(stock.depth) || 24;
        const height = Number(stock.height) || 34.5;
        const spot = wallPlacementAt(along, stockWidth, depth, wallId, room, null, false);
        const panel: PlacedCabinet = {
          uid: `auto-dw-panel:${dishwasher.uid}:${edge}`,
          cabinetId: stock.id,
          masterCode: stock.masterCode,
          description: stock.description?.trim() || `${stock.masterCode} dishwasher return panel`,
          category: "Panels",
          subCategory: "Dishwasher Return Panel",
          placement: "base",
          x: spot.x,
          y: spot.y,
          width: stockWidth,
          depth,
          height,
          nominalWidth: stockWidth,
          nominalHeight: height,
          nominalDepth: depth,
          rotation: spot.rotation,
          wallId: spot.wallId ?? wallId,
          wallOffset: spot.wallOffset ?? along,
          mountBottom: 0,
          numberOfDoors: 0,
          numberOfDrawers: 0,
          fieldModificationNote: `Auto-added: dishwasher panel at end of run. Cut from ${stock.masterCode}.`,
          autoPlacedReason: DISHWASHER_RUN_END_PANEL_REASON,
          autoPlacedForUid: dishwasher.uid,
          autoPlacedSide: edge,
          islandFace: dishwasher.islandFace ?? null,
        } as PlacedCabinet;
        // The panel must not reach into the opening or another piece.
        const panelSpan = { start: along, end: along + stockWidth };
        const segment = cabinetWallRunSegment(wallId, room);
        const blockedByOpening = input.openings.some((o) => o.side === wallId && blocksFloorRun(o.kind)
          && Number(o.offset) < panelSpan.end - EPS && Number(o.offset) + Number(o.width) > panelSpan.start + EPS);
        const outside = panelSpan.start < segment.start - EPS || panelSpan.end > segment.start + segment.length + EPS;
        if (blockedByOpening || outside) {
          result.notes.push(`Budget friendly: ${dishwasher.masterCode} ends the run on ${wallId} and ${where}, so it takes the line's dishwasher panel ${stock.masterCode}, not a base filler — but the ${stockWidth}″ panel has no clear ${stockWidth}″ there, so the ${fillerIn.toFixed(2).replace(/\.?0+$/, "")}″ base filler was removed and the side is left open. Slide the run to make room for the panel.`);
        } else {
          placed = [...placed, panel];
          panelUid = panel.uid;
          result.notes.push(`Budget friendly: ${dishwasher.masterCode} ends the run on ${wallId} and ${where}, so its exposed side gets the line's dishwasher panel ${stock.masterCode} (${stockWidth}″) instead of the ${fillerIn.toFixed(2).replace(/\.?0+$/, "")}″ base filler. A base filler is used only where a wall follows.`);
        }
      }
      result.placed = placed;
      result.changes.push({ dishwasherUid: dishwasher.uid, edge, follows, removedFillerUids: Array.from(removed), panelUid });
    }
  }
  return result;
}
