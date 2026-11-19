/**
 * Rich's bridge filler rule (Tom, voice, Nov 19 2026, 12:48-12:50 PM CT).
 *
 * Whenever a bridge cabinet is placed over a refrigerator, a 1/2″ filler goes on each side of it,
 * horizontally, so a 36″ bridge occupies a 37″ opening (36 + 1/2 + 1/2). The two boards stop the
 * bridge from bowing and give the refrigerator room to be installed without scratching.
 *
 * - Mandatory and automatic in Auto Design AND the manual designer: there is no setting, toggle or
 *   prompt to skip it.
 * - The boards attach (fillerForCabinetUid) to the bridge cabinet only, never to the refrigerator
 *   end panel. The bridge's glass-door version is the same bridge and is covered the same way.
 * - The two 1/2″ boards are the only fillers at the bridge. Nothing else is added by this rule.
 * - Follow-ups (Tom, voice, Nov 19 2026, 2:23-2:26 PM ET): (1) the bridge, the refrigerator panels and both boards
 *   move as ONE unit when the refrigerator group is dragged or nudged, and the boards stay attached to the bridge;
 *   (2) a glass wall cabinet above the bridge makes each board one taller board that flanks the glass cabinet too;
 *   (3) each board is flush with the refrigerator panel: no gap, no overlap, front face aligned with the bridge
 *   (and so the panel), so a 36" bridge keeps its true 37" opening. See `normalizeBridgeBoards`.
 * - The SKU and price are the line's existing wall filler stock (the 3″ filler cut to 1/2″); the
 *   catalog has no dedicated 1/2″ filler and none is invented. Two 1/2″ pieces are billed by the
 *   existing cut-group rule as one stock board.
 */
import {
  appendCollisionFreePlacements,
  cabinetFrontIn,
  cabinetWall,
  isFillerItem,
  isGlassDoorCabinet,
  isPanelItem,
  isRefrigerator,
  placedHeight,
  wallRunFrame,
  refrigeratorBayRunMetrics,
  wallPlacementAtUnbounded,
  wallRunOffset,
  wallRunSpan,
  STD,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";

export const BRIDGE_FILLER_WIDTH_IN = 0.5;
export const BRIDGE_FILLER_GROUP_PREFIX = "bridge-half-inch:";
export const BRIDGE_WALL_GAP_GROUP_PREFIX = "bridge-wall-gap:";
/** Largest wall gap beside the bridge that one filler may close (the line's 3" stock filler). */
export const BRIDGE_WALL_GAP_MAX_IN = 3;
export const BRIDGE_FILLER_NOTE = "Bridge filler: 1/2\" on each side of the bridge so a 36\" bridge takes a 37\" opening. It stops the bridge bowing and lets the refrigerator go in without scratching. Attached to the bridge only, not the refrigerator panel.";

type BridgeSide = "left" | "right";

export function isBridgeHalfInchFiller(item: Pick<PlacedCabinet, "fillerPieceGroupId">): boolean {
  return typeof item.fillerPieceGroupId === "string" && item.fillerPieceGroupId.startsWith(BRIDGE_FILLER_GROUP_PREFIX);
}

/** Either bridge-area board: a 1/2" junction board or the single filler that closes a gap against a wall. */
export function isBridgeAreaFiller(item: Pick<PlacedCabinet, "fillerPieceGroupId">): boolean {
  return typeof item.fillerPieceGroupId === "string"
    && (item.fillerPieceGroupId.startsWith(BRIDGE_FILLER_GROUP_PREFIX) || item.fillerPieceGroupId.startsWith(BRIDGE_WALL_GAP_GROUP_PREFIX));
}

export function bridgeFillerGroupId(bridgeUid: string, side: BridgeSide): string {
  return `${BRIDGE_FILLER_GROUP_PREFIX}${bridgeUid}:${side}`;
}

/** Bridges: wall cabinets joined to a refrigerator assembly as its bridge. */
export function isRefrigeratorBridge(item: PlacedCabinet): boolean {
  return item.placement === "wall" && item.refrigeratorAssemblyRole === "bridge" && !isFillerItem(item);
}

/**
 * Glass wall cabinets that sit on top of a bridge: the stacker linked to it (stackedOnCabinetUid), or any glass
 * wall cabinet hanging directly above it on the same wall. Pure geometry; nothing is moved.
 */
export function glassCabinetsAboveBridge(bridge: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  const wallId = cabinetWall(bridge, room);
  const start = wallRunOffset(bridge, wallId, room);
  const end = start + wallRunSpan(bridge, wallId, room);
  const bridgeTop = (Number(bridge.mountBottom) || 0) + placedHeight(bridge);
  return placed.filter((item) => {
    if (item.uid === bridge.uid || item.placement !== "wall" || isFillerItem(item) || isPanelItem(item)) return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const itemStart = wallRunOffset(item, wallId, room);
    const overlap = Math.min(end, itemStart + wallRunSpan(item, wallId, room)) - Math.max(start, itemStart);
    if (overlap <= 0.25) return false;
    if ((Number(item.mountBottom) || 0) < bridgeTop - 0.5) return false;
    return item.stackedOnCabinetUid === bridge.uid || isGlassDoorCabinet(item);
  });
}

/**
 * The elevation a bridge's 1/2" board stands in: it starts where the bridge starts, is as deep as the bridge's front
 * face (so the front lines up with the bridge and the refrigerator panel), and is as tall as the bridge, or as the
 * bridge plus the glass cabinet above it (one taller board per side).
 */
export function bridgeBoardEnvelope(bridge: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): { mountBottom: number; height: number; depth: number; glassAbove: boolean } {
  const wallId = cabinetWall(bridge, room);
  const mountBottom = Number(bridge.mountBottom) || 0;
  const bridgeTop = mountBottom + (placedHeight(bridge) || STD.WALL_HEIGHT);
  const glass = glassCabinetsAboveBridge(bridge, placed, room);
  const top = glass.length ? Math.max(bridgeTop, ...glass.map((item) => (Number(item.mountBottom) || 0) + placedHeight(item))) : bridgeTop;
  const front = cabinetFrontIn(bridge, wallId, room);
  const depth = front > 0 ? front : Number(bridge.depth) > 0 ? Number(bridge.depth) : STD.WALL_DEPTH;
  return { mountBottom, height: Math.round((top - mountBottom) * 1000) / 1000, depth: Math.round(depth * 1000) / 1000, glassAbove: glass.length > 0 };
}

export type BridgeFillerResult =
  | { ok: true; bridge: PlacedCabinet; fillers: PlacedCabinet[] }
  | { ok: false; reason: "not-bridge" | "no-refrigerator" | "missing-catalog-filler" };

/**
 * The two 1/2″ boards for one bridge. When the bridge fits the refrigerator opening (36 + 1) it is
 * centered on the refrigerator first, so the boards land exactly on the opening's two edges.
 */
export function buildBridgeHalfInchFillers(
  bridge: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): BridgeFillerResult {
  if (!isRefrigeratorBridge(bridge)) return { ok: false, reason: "not-bridge" };
  const fridge = placed.find((item) => item.uid === bridge.refrigeratorAssemblyId && isRefrigerator(item));
  if (!fridge) return { ok: false, reason: "no-refrigerator" };
  const catalog = catalogFillerForGap(candidates, BRIDGE_FILLER_WIDTH_IN, "wall");
  if (!catalog) return { ok: false, reason: "missing-catalog-filler" };
  const side = cabinetWall(bridge, room);
  const bay = refrigeratorBayRunMetrics(fridge, room);
  const span = wallRunSpan(bridge, side, room);
  const depth = Number(bridge.depth) > 0 ? Number(bridge.depth) : STD.WALL_DEPTH;
  const envelope = bridgeBoardEnvelope(bridge, placed, room);
  // A bridge that fits the opening sits centered on the refrigerator; a wider one stays where it is.
  const bridgeStart = span <= bay.openingWidth + 0.001 ? bay.refrigeratorCenter - span / 2 : wallRunOffset(bridge, side, room);
  const bridgeSpot = wallPlacementAtUnbounded(bridgeStart, span, depth, side, room);
  const seatedBridge: PlacedCabinet = Math.abs(bridgeStart - wallRunOffset(bridge, side, room)) > 0.001
    ? { ...bridge, x: bridgeSpot.x, y: bridgeSpot.y, rotation: bridgeSpot.rotation, wallId: bridgeSpot.wallId, wallOffset: bridgeSpot.wallOffset }
    : bridge;
  const stock = Number(catalog.width) > 0 ? Number(catalog.width) : 3;
  const make = (which: BridgeSide, along: number): PlacedCabinet => {
    const spot = wallPlacementAtUnbounded(along, BRIDGE_FILLER_WIDTH_IN, envelope.depth, side, room);
    return {
      uid: makeUid(),
      cabinetId: catalog.id,
      masterCode: catalog.masterCode,
      description: fittedCatalogFillerDescription(catalog, BRIDGE_FILLER_WIDTH_IN),
      category: catalog.category ?? "Filler",
      subCategory: catalog.subCategory ?? "Filler",
      placement: "wall",
      x: spot.x,
      y: spot.y,
      width: BRIDGE_FILLER_WIDTH_IN,
      nominalWidth: stock,
      depth: envelope.depth,
      nominalDepth: envelope.depth,
      height: envelope.height,
      nominalHeight: envelope.height,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: catalog.catalogImageUrl ?? null,
      styleId: seatedBridge.styleId ?? styleId,
      refrigeratorAssemblyId: fridge.uid,
      refrigeratorAssemblyRole: which === "left" ? "bridge-left-filler" : "bridge-right-filler",
      // Attached to the bridge cabinet only; never to a refrigerator end panel.
      fillerForCabinetUid: seatedBridge.uid,
      fillerPieceGroupId: bridgeFillerGroupId(seatedBridge.uid, which),
      fillerTotalWidth: BRIDGE_FILLER_WIDTH_IN,
      fillerPlacementMode: which,
      mountBottom: envelope.mountBottom,
      fieldModificationNote: BRIDGE_FILLER_NOTE,
    } as PlacedCabinet;
  };
  return {
    ok: true,
    bridge: seatedBridge,
    fillers: [make("left", bridgeStart - BRIDGE_FILLER_WIDTH_IN), make("right", bridgeStart + span)],
  };
}

export type EnsureBridgeFillersResult = {
  placed: PlacedCabinet[];
  /** Bridges that could not get both boards, with the reason, for the build notes / designer message. */
  failures: { bridgeUid: string; masterCode: string; reason: string }[];
  added: PlacedCabinet[];
};

/**
 * Idempotent: gives every bridge in `placed` its two 1/2″ boards (and removes nothing). A bridge that
 * already has both is left alone. A board that would overlap a neighbor is not placed and is reported:
 * the neighbor has to move 1/2″, the rule is never skipped silently.
 */
export function ensureBridgeHalfInchFillers(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): EnsureBridgeFillersResult {
  let working = [...placed];
  const failures: EnsureBridgeFillersResult["failures"] = [];
  const added: PlacedCabinet[] = [];
  for (const bridge of placed.filter(isRefrigeratorBridge)) {
    const have = working.filter((item) => isFillerItem(item) && item.fillerForCabinetUid === bridge.uid
      && (item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler"));
    if (have.length >= 2) continue;
    const built = buildBridgeHalfInchFillers(bridge, working, room, candidates, makeUid, styleId);
    if (!built.ok) {
      if (built.reason === "missing-catalog-filler") {
        failures.push({ bridgeUid: bridge.uid, masterCode: bridge.masterCode, reason: "the line sells no wall filler to cut the 1/2″ bridge boards from" });
      }
      continue;
    }
    const current = working.find((item) => item.uid === bridge.uid)!;
    // Re-seat the bridge when it was centered on the refrigerator.
    const withBridge = working.map((item) => (item.uid === bridge.uid ? built.bridge : item));
    const withoutBridge = withBridge.filter((item) => item.uid !== bridge.uid);
    const reseated = appendCollisionFreePlacements(withoutBridge, [built.bridge], room);
    const keepBridge = reseated.rejected.length === 0 ? built.bridge : current;
    const base = withBridge.map((item) => (item.uid === bridge.uid ? keepBridge : item));
    const todo = built.fillers.filter((filler) => !have.some((existing) => existing.refrigeratorAssemblyRole === filler.refrigeratorAssemblyRole));
    // Cabinets of one refrigerator assembly are exempt from the collision check, so a board standing where an
    // end panel is would slip through it. The panel stands beyond the board, never under it.
    const bridgeWall = cabinetWall(built.bridge, room);
    const underPanel = (filler: PlacedCabinet) => base.find((item) => item.uid !== filler.uid && isPanelItem(item) && cabinetWall(item, room) === bridgeWall
      && Math.min(wallRunOffset(item, bridgeWall, room) + wallRunSpan(item, bridgeWall, room), wallRunOffset(filler, bridgeWall, room) + BRIDGE_FILLER_WIDTH_IN)
        - Math.max(wallRunOffset(item, bridgeWall, room), wallRunOffset(filler, bridgeWall, room)) > 0.01);
    // A full-height board already standing in the junction (the frameless lines' own 1/2" board inside the
    // refrigerator panel) is that board: a second wall board on top of it would be the old duplicate.
    const alreadyCovered = (filler: PlacedCabinet) => base.some((item) => item.uid !== filler.uid && isFillerItem(item) && item.fillerContinuousVertical === true
      && cabinetWall(item, room) === bridgeWall
      && Math.min(wallRunOffset(item, bridgeWall, room) + wallRunSpan(item, bridgeWall, room), wallRunOffset(filler, bridgeWall, room) + BRIDGE_FILLER_WIDTH_IN)
        - Math.max(wallRunOffset(item, bridgeWall, room), wallRunOffset(filler, bridgeWall, room)) > 0.25);
    const clear = todo.filter((filler) => {
      if (alreadyCovered(filler)) return false;
      const panel = underPanel(filler);
      if (!panel) return true;
      failures.push({
        bridgeUid: bridge.uid,
        masterCode: bridge.masterCode,
        reason: `the ${filler.refrigeratorAssemblyRole === "bridge-left-filler" ? "left" : "right"} 1/2″ board would sit under the ${panel.masterCode} refrigerator panel; move that panel 1/2″ outward`,
      });
      return false;
    });
    const seated = appendCollisionFreePlacements(base, clear, room);
    working = seated.placed;
    added.push(...clear.filter((filler) => seated.placed.some((item) => item.uid === filler.uid)));
    for (const rejected of seated.rejected) {
      failures.push({
        bridgeUid: bridge.uid,
        masterCode: bridge.masterCode,
        reason: `the ${rejected.refrigeratorAssemblyRole === "bridge-left-filler" ? "left" : "right"} 1/2″ board would overlap the cabinet beside ${bridge.masterCode}; move that cabinet 1/2″`,
      });
    }
  }
  const normalized = normalizeBridgeBoards(working, room);
  return { placed: normalized, failures, added: added.map((item) => normalized.find((entry) => entry.uid === item.uid) ?? item) };
}

const BOARD_EPS_IN = 0.01;

/** The 1/2" junction boards that belong to one bridge (attached to the bridge, never to a panel). */
function boardsOfBridge(placed: readonly PlacedCabinet[], bridge: PlacedCabinet): PlacedCabinet[] {
  return placed.filter((item) => isFillerItem(item) && item.fillerForCabinetUid === bridge.uid
    && (item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler"));
}

/**
 * Keeps every bridge's 1/2" boards true to the bridge, after ANY edit (drag, 3D arrow nudge, resize, a glass cabinet
 * added or removed, Auto Design). It is idempotent and returns the same array when nothing needs to change.
 *  - along the wall: the left board ends exactly where the bridge starts, the right board starts exactly where the
 *    bridge ends, so the boards ride with the bridge and a 36" bridge keeps its 37" opening;
 *  - depth: the board's front face is the bridge's front face (the refrigerator panel face), no step;
 *  - height: the bridge's height, or the bridge plus the glass wall cabinet above it, as ONE board per side.
 * Budget mode never has these boards, so it is untouched. Pure: no frozen 3D or Wall Builder code is involved.
 */
export function normalizeBridgeBoards(placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  const bridges = placed.filter(isRefrigeratorBridge);
  if (bridges.length === 0) return placed as PlacedCabinet[];
  let changed = false;
  const replacement = new Map<string, PlacedCabinet>();
  for (const bridge of bridges) {
    // Budget mode has no bridge boards and keeps its bridge exactly as it is.
    if (bridge.refrigeratorBudgetBridge === true) continue;
    const boards = boardsOfBridge(placed, bridge);
    const wallId = cabinetWall(bridge, room);
    const bridgeStart = wallRunOffset(bridge, wallId, room);
    const bridgeEnd = bridgeStart + wallRunSpan(bridge, wallId, room);
    const envelope = bridgeBoardEnvelope(bridge, placed, room);
    if (boards.length === 0 && !envelope.glassAbove) continue;
    for (const board of boards) {
      // The board's own width: 1/2" from the bridge rule, or the wider reveal the refrigerator Attributes dialog cuts
      // for a bridge narrower than the opening. Either way the board touches the bridge edge on its own side.
      const boardWidth = Number(board.width) > 0 ? Number(board.width) : BRIDGE_FILLER_WIDTH_IN;
      const along = board.refrigeratorAssemblyRole === "bridge-left-filler" ? bridgeStart - boardWidth : bridgeEnd;
      const sameAlong = Math.abs(wallRunOffset(board, wallId, room) - along) <= BOARD_EPS_IN && cabinetWall(board, room) === wallId;
      const sameFront = Math.abs(cabinetFrontIn(board, wallId, room) - envelope.depth) <= BOARD_EPS_IN;
      const sameHeight = Math.abs((Number(board.height) || 0) - envelope.height) <= BOARD_EPS_IN
        && Math.abs((Number(board.mountBottom) || 0) - envelope.mountBottom) <= BOARD_EPS_IN
        && Math.abs((Number(board.depth) || 0) - envelope.depth) <= BOARD_EPS_IN;
      if (sameAlong && sameFront && sameHeight) continue;
      const spot = wallPlacementAtUnbounded(along, boardWidth, envelope.depth, wallId, room, bridge.peninsulaSide);
      replacement.set(board.uid, {
        ...board,
        x: spot.x,
        y: spot.y,
        rotation: spot.rotation,
        wallId: spot.wallId ?? board.wallId,
        wallOffset: spot.wallOffset ?? along,
        depth: envelope.depth,
        nominalDepth: envelope.depth,
        height: envelope.height,
        nominalHeight: envelope.height,
        mountBottom: envelope.mountBottom,
        refrigeratorAssemblyId: bridge.refrigeratorAssemblyId ?? board.refrigeratorAssemblyId,
        fillerForCabinetUid: bridge.uid,
      } as PlacedCabinet);
      changed = true;
    }
    // The refrigerator's own full-height 1/2" board (frameless lines) already stands at a junction in place of the
    // wall board. It stays attached to the refrigerator; it only grows taller so the glass cabinet above the bridge is
    // flanked too (one board per side, floor to the top of the glass).
    if (envelope.glassAbove) {
      const glassTop = envelope.mountBottom + envelope.height;
      for (const item of placed) {
        if (!isFillerItem(item) || isPanelItem(item) || item.fillerContinuousVertical !== true || isBridgeAreaFiller(item)) continue;
        if (cabinetWall(item, room) !== wallId || item.fillerForCabinetUid !== bridge.refrigeratorAssemblyId) continue;
        const start = wallRunOffset(item, wallId, room);
        const end = start + wallRunSpan(item, wallId, room);
        const atJunction = Math.abs(end - bridgeStart) <= 0.05 || Math.abs(start - bridgeEnd) <= 0.05;
        const top = (Number(item.mountBottom) || 0) + (Number(item.height) || 0);
        if (!atJunction || top >= glassTop - BOARD_EPS_IN) continue;
        const taller = glassTop - (Number(item.mountBottom) || 0);
        replacement.set(item.uid, { ...item, height: taller, nominalHeight: Math.max(Number(item.nominalHeight) || 0, taller) } as PlacedCabinet);
        changed = true;
      }
    }
  }
  return changed ? placed.map((item) => replacement.get(item.uid) ?? item) : placed as PlacedCabinet[];
}

export type BridgeBoardFlushFinding = {
  bridgeUid: string;
  boardUid: string;
  side: BridgeSide;
  /** Positive: an air gap between the board and the refrigerator panel. Negative: they overlap. Null: no panel on that side. */
  panelGapIn: number | null;
  /** Positive: the board's front stands proud of the panel's face; negative: set back. Null: no panel on that side. */
  panelFrontStepIn: number | null;
};

/**
 * Measures how each bridge board meets its refrigerator panel (the proof for "flush, no gap, no overlap, fronts
 * aligned"). The panel face is measured at the board's own edge: the board's outer edge against the panel's inner edge.
 */
export function measureBridgeBoardFlush(placed: readonly PlacedCabinet[], room: RoomData): BridgeBoardFlushFinding[] {
  const out: BridgeBoardFlushFinding[] = [];
  for (const bridge of placed.filter(isRefrigeratorBridge)) {
    const wallId = cabinetWall(bridge, room);
    for (const board of boardsOfBridge(placed, bridge)) {
      const side: BridgeSide = board.refrigeratorAssemblyRole === "bridge-left-filler" ? "left" : "right";
      const panel = placed.find((item) => item.refrigeratorAssemblyId === bridge.refrigeratorAssemblyId
        && item.refrigeratorAssemblyRole === (side === "left" ? "left-panel" : "right-panel"));
      if (!panel) { out.push({ bridgeUid: bridge.uid, boardUid: board.uid, side, panelGapIn: null, panelFrontStepIn: null }); continue; }
      const bs = wallRunOffset(board, wallId, room);
      const ps = wallRunOffset(panel, wallId, room);
      const gap = side === "left" ? bs - (ps + wallRunSpan(panel, wallId, room)) : ps - (bs + wallRunSpan(board, wallId, room));
      out.push({
        bridgeUid: bridge.uid,
        boardUid: board.uid,
        side,
        panelGapIn: Math.round(gap * 1000) / 1000,
        panelFrontStepIn: Math.round((cabinetFrontIn(board, wallId, room) - cabinetFrontIn(panel, wallId, room)) * 1000) / 1000,
      });
    }
  }
  return out;
}

export type BridgeAreaResult = {
  placed: PlacedCabinet[];
  added: PlacedCabinet[];
  /** Fillers the bridge-area rule dropped because they were not against a wall. */
  removed: PlacedCabinet[];
  /** 1/2″ junction boards dropped because a full-height 1/2″ board (the refrigerator's own) already stands there. */
  duplicatesDropped: PlacedCabinet[];
  /** Gaps against a wall wider than 3": no second filler is added, so they are open questions for Tom. */
  oversizeGaps: { bridgeUid: string; masterCode: string; side: BridgeSide; gapIn: number }[];
  /** Gaps against a wall that were closed with one filler. */
  closedGaps: { bridgeUid: string; side: BridgeSide; gapIn: number; masterCode: string }[];
};

const BRIDGE_ZONE_IN = 3.5;
const EDGE_EPS_IN = 0.02;

/**
 * Tom, voice, Nov 19 2026, 12:57-12:58 PM CT: in the bridge area no filler goes in any direction except the
 * two 1/2″ junction boards, with one exception: when a wall leaves a gap beside the bridge, ONE 3″ filler
 * (cut to the gap when the gap is under 3″) is placed and attached to the bridge at that spot.
 *  - a gap against a wall of 3″ or less gets that one filler;
 *  - a gap against a wall over 3″ gets none and is returned in `oversizeGaps` (open question);
 *  - a gap that is not against a wall gets no filler, and cabinets are never resized or shifted to close it.
 * Fillers that stand in the bridge zone without being junction boards or wall closers are dropped.
 */
export function applyBridgeAreaFillerRule(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): BridgeAreaResult {
  let working = [...placed];
  const added: PlacedCabinet[] = [];
  const removed: PlacedCabinet[] = [];
  const duplicatesDropped: PlacedCabinet[] = [];
  const oversizeGaps: BridgeAreaResult["oversizeGaps"] = [];
  const closedGaps: BridgeAreaResult["closedGaps"] = [];
  for (const bridge of placed.filter(isRefrigeratorBridge)) {
    const wallId = cabinetWall(bridge, room);
    const frame = wallRunFrame(wallId, room);
    if (!frame) continue;
    const runStart = Math.max(0, frame.runStart);
    const runEnd = frame.runEnd;
    const spanOf = (item: PlacedCabinet) => {
      const start = wallRunOffset(item, wallId, room);
      return { start, end: start + wallRunSpan(item, wallId, room) };
    };
    const b = spanOf(bridge);
    const junctions = working.filter((item) => item.fillerForCabinetUid === bridge.uid && item.fillerPieceGroupId?.startsWith(BRIDGE_FILLER_GROUP_PREFIX));
    // 0. A full-height 1/2" board already standing in a junction (the refrigerator's own board inside its panel)
    // is that board. A second board in the same spot would be the old duplicate, so the wall board is dropped.
    for (const junction of junctions) {
      const js = spanOf(junction);
      const existing = working.find((item) => item.uid !== junction.uid && isFillerItem(item) && !isBridgeAreaFiller(item)
        && item.fillerContinuousVertical === true && cabinetWall(item, room) === wallId
        && Math.min(spanOf(item).end, js.end) - Math.max(spanOf(item).start, js.start) > 0.25);
      if (existing) {
        working = working.filter((item) => item.uid !== junction.uid);
        duplicatesDropped.push(junction);
      }
    }
    // 1. Drop every other filler in the bridge zone unless it closes the run against a wall.
    const stray = working.filter((item) => {
      if (!isFillerItem(item) || isPanelItem(item) || isBridgeAreaFiller(item) || item.fillerContinuousVertical === true) return false;
      if (item.placement !== "wall" || cabinetWall(item, room) !== wallId) return false;
      const s = spanOf(item);
      if (s.end < b.start - BRIDGE_ZONE_IN || s.start > b.end + BRIDGE_ZONE_IN) return false;
      const againstWall = s.start <= runStart + EDGE_EPS_IN || s.end >= runEnd - EDGE_EPS_IN;
      return !againstWall;
    });
    if (stray.length > 0) {
      const strayIds = new Set(stray.map((item) => item.uid));
      working = working.filter((item) => !strayIds.has(item.uid));
      removed.push(...stray);
    }
    // 2. A gap against a wall beside the bridge gets one 3" filler, cut to fit.
    for (const which of ["left", "right"] as const) {
      const edge = which === "left"
        ? Math.min(b.start, ...junctions.filter((item) => item.fillerPlacementMode === "left").map((item) => spanOf(item).start))
        : Math.max(b.end, ...junctions.filter((item) => item.fillerPlacementMode === "right").map((item) => spanOf(item).end));
      const wallEdge = which === "left" ? runStart : runEnd;
      const gap = which === "left" ? edge - wallEdge : wallEdge - edge;
      if (gap <= EDGE_EPS_IN) continue;
      const lo = which === "left" ? wallEdge : edge;
      const hi = which === "left" ? edge : wallEdge;
      // Anything else at wall level in that strip means the gap is not bare wall; no filler there.
      const occupied = working.some((item) => {
        if (item.uid === bridge.uid || cabinetWall(item, room) !== wallId) return false;
        if (item.placement !== "wall" && item.placement !== "tall") return false;
        const s = spanOf(item);
        return Math.min(s.end, hi) - Math.max(s.start, lo) > EDGE_EPS_IN;
      });
      if (occupied) continue;
      if (gap > BRIDGE_WALL_GAP_MAX_IN + 0.001) {
        oversizeGaps.push({ bridgeUid: bridge.uid, masterCode: bridge.masterCode, side: which, gapIn: Math.round(gap * 1000) / 1000 });
        continue;
      }
      const catalog = catalogFillerForGap(candidates, gap, "wall");
      if (!catalog) continue;
      const depth = Number(bridge.depth) > 0 ? Number(bridge.depth) : STD.WALL_DEPTH;
      const along = which === "left" ? wallEdge : edge;
      const spot = wallPlacementAtUnbounded(along, gap, depth, wallId, room);
      const stock = Number(catalog.width) > 0 ? Number(catalog.width) : 3;
      const filler = {
        uid: makeUid(),
        cabinetId: catalog.id,
        masterCode: catalog.masterCode,
        description: fittedCatalogFillerDescription(catalog, gap),
        category: catalog.category ?? "Filler",
        subCategory: catalog.subCategory ?? "Filler",
        placement: "wall",
        x: spot.x,
        y: spot.y,
        width: gap,
        nominalWidth: stock,
        depth,
        nominalDepth: depth,
        height: Number(bridge.height) || STD.WALL_HEIGHT,
        nominalHeight: Number(bridge.height) || STD.WALL_HEIGHT,
        rotation: spot.rotation,
        wallId: spot.wallId,
        wallOffset: spot.wallOffset,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        catalogImageUrl: catalog.catalogImageUrl ?? null,
        styleId: bridge.styleId ?? styleId,
        refrigeratorAssemblyId: bridge.refrigeratorAssemblyId,
        fillerForCabinetUid: bridge.uid,
        fillerPieceGroupId: `${BRIDGE_WALL_GAP_GROUP_PREFIX}${bridge.uid}:${which}`,
        fillerTotalWidth: gap,
        fillerPlacementMode: which,
        mountBottom: bridge.mountBottom ?? 0,
        fieldModificationNote: `Bridge-area filler: closes the ${formatGap(gap)} gap between the bridge and the wall. One filler, attached to the bridge.`,
      } as PlacedCabinet;
      const seated = appendCollisionFreePlacements(working, [filler], room);
      if (seated.rejected.length === 0) {
        working = seated.placed;
        added.push(filler);
        closedGaps.push({ bridgeUid: bridge.uid, side: which, gapIn: Math.round(gap * 1000) / 1000, masterCode: filler.masterCode });
      }
    }
  }
  return { placed: working, added, removed, duplicatesDropped, oversizeGaps, closedGaps };
}

function formatGap(value: number): string {
  return `${Math.round(value * 8) / 8}″`;
}

export type SeatRequiredBridgeFillersResult =
  | { ok: true; placed: PlacedCabinet[]; added: PlacedCabinet[] }
  | { ok: false; message: string };

/**
 * Manual designer hook (the independent designer's add path). Called with the plan that already holds the new
 * cabinet. A bridge over a refrigerator gets its two 1/2″ boards automatically, the same way a blind corner gets
 * its required filler: there is no setting and no prompt, and a bridge whose boards cannot be seated is refused
 * with the reason instead of being placed without them. Anything that is not a bridge over a refrigerator
 * passes through untouched. Pure: it never touches the frozen 3D scene or the Wall Builder.
 */
export function seatRequiredBridgeFillers(
  placed: readonly PlacedCabinet[],
  cabinetUid: string,
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): SeatRequiredBridgeFillersResult {
  const cabinet = placed.find((item) => item.uid === cabinetUid);
  if (!cabinet || !isRefrigeratorBridge(cabinet)) return { ok: true, placed: [...placed], added: [] };
  const ensured = ensureBridgeHalfInchFillers(placed, room, candidates, makeUid, styleId);
  if (ensured.failures.length > 0) {
    return {
      ok: false,
      message: `${cabinet.masterCode} was not added because its required 1/2″ bridge fillers could not be seated: ${ensured.failures.map((failure) => failure.reason).join("; ")}.`,
    };
  }
  const have = ensured.placed.filter((item) => item.fillerForCabinetUid === cabinet.uid
    && (item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler"));
  // A wall-end refrigerator leaves no room for the wall-side board; one board is then all the plan can hold.
  const coveredByFullHeight = ensured.placed.some((item) => isFillerItem(item) && item.fillerContinuousVertical === true && item.refrigeratorAssemblyId === cabinet.refrigeratorAssemblyId);
  if (have.length === 0 && !coveredByFullHeight) {
    return { ok: false, message: `${cabinet.masterCode} was not added because its required 1/2″ bridge fillers could not be seated beside the refrigerator.` };
  }
  return { ok: true, placed: ensured.placed, added: ensured.added };
}
