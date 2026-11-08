/**
 * Filler last resort, one board per run.
 *
 * Auto-Design used to leave a separate small board wherever one pass or another
 * found a sliver: a 1¼″ beside a stock run, a 1″ beside the range, a 3″ at each
 * window shoulder. The owner rule is:
 *
 *   1. close the opening with a real stock width first (widen the adjoining
 *      cabinet to the wider SKU of its own family);
 *   2. otherwise the run closes with at most ONE board, at a run end or a
 *      corner — several small boards in one run are consolidated into one board
 *      of their combined width;
 *   3. never two boards side by side, and never a board wider than the
 *      Auto-Design maximum.
 *
 * Both passes are pure: they take placements (plus the catalog and the filler
 * rows) and return new placements. Nothing here moves an appliance, a corner
 * cabinet, a panel, a tall box or a sink base, and the only pieces removed are
 * the boards a consolidation replaces.
 */
import {
  COLLISION_EPSILON_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  matchInstalledFillerToCabinet,
  standardHeight,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";

export type FillerLayer = "base" | "wall";

/** Narrowest board Auto-Design will cut; below this the opening is tape-measure noise. */
export const CONSOLIDATED_FILLER_MIN_IN = 0.125;

/** One contiguous set of movable pieces along one layer of one wall. */
type Stretch = {
  items: Array<{ item: PlacedCabinet; start: number; end: number }>;
  start: number;
  end: number;
};

function isRunCabinet(item: PlacedCabinet, layer: FillerLayer): boolean {
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if (item.placement !== layer) return false;
  if (isSinkBaseCabinet(item)) return false;
  if (isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)) return false;
  if (isRangeOrOven(item.masterCode, item.description)) return false;
  return (Number(item.width) || 0) > 0;
}

/** Pieces that bound a run and never move. */
function isFixedPiece(item: PlacedCabinet, layer: FillerLayer): boolean {
  if (isFillerItem(item)) return false;
  if (item.placement === "tall") return true;
  if (item.placement === "appliance") return true;
  if (isPanelItem(item)) return true;
  if (isSinkBaseCabinet(item)) return true;
  if (isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)) return true;
  if (layer === "wall" && item.placement !== "wall") return true;
  return false;
}

function blocksLayer(item: PlacedCabinet, layer: FillerLayer): boolean {
  if (item.placement === "tall") return true;
  if (layer === "base") return item.placement === "base" || item.placement === "appliance";
  return item.placement === "wall" || /hood/i.test(item.masterCode ?? "");
}

/**
 * The movable stretches of one layer of one wall: runs of cabinets and boards
 * between fixed pieces and wall openings. Nothing outside a stretch is touched.
 */
export function runStretches(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: string;
  layer: FillerLayer;
}): Stretch[] {
  const { room, wallId, layer } = input;
  if (!wallRunFrame(wallId, room)) return [];
  const items = input.placed
    .filter((item) => blocksLayer(item, layer) && cabinetWall(item, room) === wallId)
    .map((item) => {
      const start = wallRunOffset(item, wallId, room);
      return { item, start, end: start + wallRunSpan(item, wallId, room) };
    })
    .sort((left, right) => left.start - right.start);
  const openingZones = input.openings
    .filter((opening) => opening.side === wallId)
    .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width }))
    .sort((left, right) => left.start - right.start);
  const stretches: Stretch[] = [];
  let current: Stretch | null = null;
  const flush = () => {
    if (current && current.items.length) stretches.push(current);
    current = null;
  };
  for (const entry of items) {
    const cutByOpening = openingZones.some((zone) => zone.end > (current?.end ?? entry.start) + COLLISION_EPSILON_IN
      && zone.start < entry.start - COLLISION_EPSILON_IN);
    if (isFixedPiece(entry.item, layer) || cutByOpening) flush();
    if (!current) current = { items: [], start: entry.start, end: entry.end };
    current.items.push(entry);
    current.end = Math.max(current.end, entry.end);
    if (isFixedPiece(entry.item, layer)) flush();
  }
  flush();
  return stretches;
}

/** Leading family token of a cabinet code: B27 → B, W2730 → W, 3DB18 → 3DB, BBC36 → BBC. */
export function cabinetFamilyToken(masterCode: string | null | undefined): string {
  const code = String(masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = code.match(/^([A-Z0-9]*?)(\d+)$/);
  return digits ? digits[1]! : code;
}

function soldWidth(candidate: DesignCabinet): number {
  return dim(candidate.width, 0);
}

function sellableRunCabinet(candidate: DesignCabinet, layer: FillerLayer): boolean {
  if (candidate.placement !== layer) return false;
  if (isFillerItem(candidate) || isPanelItem(candidate)) return false;
  if (isCornerCabinet(candidate.masterCode, candidate.description)) return false;
  if (isSinkBaseCabinet(candidate)) return false;
  if (isRangeOrOven(candidate.masterCode, candidate.description)) return false;
  if (soldWidth(candidate) <= 0) return false;
  const text = `${candidate.masterCode ?? ""} ${candidate.description ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  return !/\bfiller\b|\bscribe\b|panel|skin|moulding|molding|crown|valance/.test(text);
}

/** The wider SKU of the same family that takes a cabinet plus `extraIn` exactly. */
export function widerSkuClosing(input: {
  cabinet: PlacedCabinet;
  extraIn: number;
  layer: FillerLayer;
  catalog: readonly DesignCabinet[];
}): { replacement: DesignCabinet; widthIn: number } | null {
  if (input.extraIn <= COLLISION_EPSILON_IN) return null;
  const current = Number(input.cabinet.width) || 0;
  const wanted = Math.round((current + input.extraIn) * 1000) / 1000;
  const family = cabinetFamilyToken(input.cabinet.masterCode);
  if (!family) return null;
  const replacement = input.catalog.find((row) => sellableRunCabinet(row, input.layer)
    && cabinetFamilyToken(row.masterCode) === family
    && Math.abs(soldWidth(row) - wanted) <= 0.05);
  return replacement ? { replacement, widthIn: wanted } : null;
}

/** Eighths-of-an-inch label for review text, matching the plan's own format. */
export function formatFillerInches(value: number): string {
  const eighths = Math.round(Math.max(0, value) * 8);
  const whole = Math.floor(eighths / 8);
  const fraction = eighths % 8;
  const glyph = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"][fraction];
  return `${whole || !glyph ? whole : ""}${glyph}″`;
}

export type StockClose = {
  wallId: string;
  layer: FillerLayer;
  cabinetUid: string;
  masterCode: string;
  fromWidthIn: number;
  widthIn: number;
  startIn: number;
  note: string;
};

/**
 * Close small openings with real stock widths before any board is cut.
 *
 * Every opening on the given walls that is narrower than a filler maximum is
 * offered the wider SKU of the cabinet beside it. An opening a real box closes
 * leaves no filler at all: that is the first thing the owner asked for.
 */
export function closeSmallOpeningsWithStock(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallIds: readonly string[];
  catalog: readonly DesignCabinet[];
  maxOpeningIn: number;
  styleId: number | null;
  makeUid: () => string;
}): { placed: PlacedCabinet[]; closes: StockClose[]; notes: string[] } {
  let working = [...input.placed];
  const closes: StockClose[] = [];
  const notes: string[] = [];
  const declined = new Set<string>();
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of input.wallIds) {
      const frame = wallRunFrame(wallId, input.room);
      if (!frame) continue;
      for (let guard = 0; guard < 16; guard += 1) {
        const gap = smallestOpenGap({
          placed: working, room: input.room, openings: input.openings, wallId, layer,
          maxIn: input.maxOpeningIn, declined,
        });
        if (!gap) break;
        const touching = working.filter((item) => cabinetWall(item, input.room) === wallId
          && isRunCabinet(item, layer)
          && (Math.abs(wallRunOffset(item, wallId, input.room) + wallRunSpan(item, wallId, input.room) - gap.startIn) <= 0.02
            || Math.abs(wallRunOffset(item, wallId, input.room) - gap.endIn) <= 0.02));
        let applied = false;
        for (const neighbor of touching) {
          const onLeft = Math.abs(wallRunOffset(neighbor, wallId, input.room) + wallRunSpan(neighbor, wallId, input.room) - gap.startIn) <= 0.02;
          const wider = widerSkuClosing({ cabinet: neighbor, extraIn: gap.widthIn, layer, catalog: input.catalog });
          if (!wider) continue;
          const start = onLeft
            ? wallRunOffset(neighbor, wallId, input.room)
            : Math.round((wallRunOffset(neighbor, wallId, input.room) - gap.widthIn) * 1000) / 1000;
          const depth = Math.max(0, Number(neighbor.depth) || 0);
          const spot = wallPlacementAt(start, wider.widthIn, depth, wallId as never, input.room);
          if (!spot) continue;
          const grown: PlacedCabinet = {
            ...neighbor,
            uid: input.makeUid(),
            cabinetId: wider.replacement.id,
            masterCode: wider.replacement.masterCode,
            description: wider.replacement.description,
            category: wider.replacement.category,
            subCategory: wider.replacement.subCategory,
            width: wider.widthIn,
            depth,
            height: dim(wider.replacement.height, Number(neighbor.height) || standardHeight(layer === "wall" ? "wall" : "base")),
            ...spot,
            styleId: neighbor.styleId ?? input.styleId,
          };
          const accepted = appendCollisionFreePlacements(
            working.filter((item) => item.uid !== neighbor.uid),
            [grown],
            input.room,
          );
          if (accepted.rejected.length > 0) continue;
          working = accepted.placed;
          const note = `${neighbor.masterCode} became ${wider.replacement.masterCode} to close a ${formatFillerInches(gap.widthIn)} opening on ${wallId} with no filler.`;
          closes.push({
            wallId, layer, cabinetUid: neighbor.uid, masterCode: wider.replacement.masterCode,
            fromWidthIn: Number(neighbor.width) || 0, widthIn: wider.widthIn, startIn: start, note,
          });
          notes.push(note);
          applied = true;
          break;
        }
        if (!applied) declined.add(`${wallId}|${layer}|${Math.round(gap.startIn * 1000)}|${Math.round(gap.widthIn * 1000)}`);
      }
    }
  }
  return { placed: working, closes, notes };
}

function smallestOpenGap(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: string;
  layer: FillerLayer;
  maxIn: number;
  declined: ReadonlySet<string>;
}): { startIn: number; endIn: number; widthIn: number } | null {
  const frame = wallRunFrame(input.wallId, input.room);
  if (!frame) return null;
  const items = input.placed
    .filter((item) => blocksLayer(item, input.layer) && cabinetWall(item, input.room) === input.wallId)
    .map((item) => {
      const start = wallRunOffset(item, input.wallId, input.room);
      return { start, end: start + wallRunSpan(item, input.wallId, input.room) };
    })
    .sort((left, right) => left.start - right.start);
  const openingZones = input.openings
    .filter((opening) => opening.side === input.wallId)
    .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width }));
  const bounds = [...items, ...openingZones].sort((left, right) => left.start - right.start);
  const edges: Array<{ startIn: number; endIn: number; widthIn: number }> = [];
  let cursor = Math.max(0, frame.runStart);
  for (const bound of bounds) {
    if (bound.start > cursor + COLLISION_EPSILON_IN) {
      edges.push({ startIn: cursor, endIn: bound.start, widthIn: Math.round((bound.start - cursor) * 1000) / 1000 });
    }
    cursor = Math.max(cursor, bound.end);
  }
  if (frame.runEnd > cursor + COLLISION_EPSILON_IN) {
    edges.push({ startIn: cursor, endIn: frame.runEnd, widthIn: Math.round((frame.runEnd - cursor) * 1000) / 1000 });
  }
  // An opening that starts at a wall end is the end of the run, not a seam:
  // widening into it would push the run past the wall.
  return edges
    .filter((edge) => edge.widthIn >= CONSOLIDATED_FILLER_MIN_IN - COLLISION_EPSILON_IN)
    .filter((edge) => edge.widthIn <= input.maxIn + COLLISION_EPSILON_IN)
    .filter((edge) => edge.startIn > COLLISION_EPSILON_IN && edge.endIn < frame.runEnd - COLLISION_EPSILON_IN)
    .filter((edge) => !input.declined.has(`${input.wallId}|${input.layer}|${Math.round(edge.startIn * 1000)}|${Math.round(edge.widthIn * 1000)}`))
    .sort((left, right) => right.widthIn - left.widthIn)[0] ?? null;
}

export type FillerCluster = {
  wallId: string;
  layer: FillerLayer;
  /** Boards in this stretch, in run order. */
  fillers: PlacedCabinet[];
  /** Run cabinets of the stretch. They may be re-laid. */
  cabinets: PlacedCabinet[];
  /** Whole movable stretch, from its first piece to its last. */
  startIn: number;
  endIn: number;
  /** Combined installed width of the boards: what one board has to cover. */
  boardTotalIn: number;
};

/**
 * The stretches that carry two or more boards, with every cabinet of the same
 * stretch. A board on each side of a range belongs to two stretches, never one.
 */
export function findFillerClusters(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: string;
  layer: FillerLayer;
}): FillerCluster[] {
  return runStretches(input).flatMap((stretch) => {
    const fillers = stretch.items.filter((entry) => isFillerItem(entry.item)).sort((left, right) => left.start - right.start);
    if (!fillers.length) return [];
    const cabinets = stretch.items.filter((entry) => !isFillerItem(entry.item) && isRunCabinet(entry.item, input.layer));
    return [{
      wallId: input.wallId,
      layer: input.layer,
      fillers: fillers.map((entry) => entry.item),
      cabinets: cabinets.map((entry) => entry.item),
      startIn: Math.round(stretch.start * 1000) / 1000,
      endIn: Math.round(stretch.end * 1000) / 1000,
      boardTotalIn: Math.round(fillers.reduce((sum, entry) => sum + (entry.end - entry.start), 0) * 1000) / 1000,
    }];
  });
}

export type ClusterPlan =
  | { kind: "widen"; cabinet: PlacedCabinet; replacement: DesignCabinet; widthIn: number; starts: Array<{ uid: string; startIn: number }> }
  | { kind: "consolidate"; boardWidthIn: number; starts: Array<{ uid: string; startIn: number }>; boardStartIn: number }
  | { kind: "leave"; reason: string };

/** Lay the stretch's cabinets contiguously from `fromIn`, one of them at a new width. */
function layCluster(input: {
  cluster: FillerCluster;
  room: RoomData;
  growUid?: string;
  growWidthIn?: number;
}): { starts: Array<{ uid: string; startIn: number }>; endIn: number } {
  const ordered = [...input.cluster.cabinets]
    .sort((left, right) => wallRunOffset(left, input.cluster.wallId, input.room) - wallRunOffset(right, input.cluster.wallId, input.room));
  const starts: Array<{ uid: string; startIn: number }> = [];
  let along = input.cluster.startIn;
  for (const cabinet of ordered) {
    starts.push({ uid: cabinet.uid, startIn: Math.round(along * 1000) / 1000 });
    along += cabinet.uid === input.growUid
      ? (input.growWidthIn ?? Number(cabinet.width) ?? 0)
      : Number(cabinet.width) || 0;
  }
  return { starts, endIn: Math.round(along * 1000) / 1000 };
}

/**
 * What to do with one board-bearing stretch:
 *
 *   1. A cabinet that becomes the wider SKU of its own family absorbs the whole
 *      board width, and the run closes with no filler at all.
 *   2. A single board that already sits at the end of its stretch is the minimum
 *      and is left exactly where it is.
 *   3. Otherwise the run is re-laid from its start and ONE board of the boards'
 *      combined width takes the end.
 *
 * Either fix keeps the run spanning exactly the same stretch of wall, so nothing
 * outside it moves and the countertop keeps its support.
 */
export function planFillerCluster(input: {
  cluster: FillerCluster;
  catalog: readonly DesignCabinet[];
  maxFillerIn: number;
  room: RoomData;
}): ClusterPlan {
  const { cluster, room } = input;
  if (cluster.boardTotalIn > input.maxFillerIn + COLLISION_EPSILON_IN) {
    return { kind: "leave", reason: `a ${formatFillerInches(cluster.boardTotalIn)} opening is wider than a ${input.maxFillerIn}″ filler` };
  }
  const ordered = [...cluster.cabinets]
    .sort((left, right) => wallRunOffset(left, cluster.wallId, room) - wallRunOffset(right, cluster.wallId, room));
  // The last cabinet of the run absorbs the boards beside it first: that keeps
  // the run's start where it is, which is where the corner and the countertop
  // expect it.
  for (const cabinet of [...ordered].reverse()) {
    const wider = widerSkuClosing({ cabinet, extraIn: cluster.boardTotalIn, layer: cluster.layer, catalog: input.catalog });
    if (!wider) continue;
    const laid = layCluster({ cluster, room, growUid: cabinet.uid, growWidthIn: wider.widthIn });
    if (Math.abs(laid.endIn - cluster.endIn) > 0.02) continue;
    return { kind: "widen", cabinet, replacement: wider.replacement, widthIn: wider.widthIn, starts: laid.starts };
  }
  const lastBoardEnd = Math.max(...cluster.fillers.map((item) => wallRunOffset(item, cluster.wallId, room) + Number(item.width || 0)));
  if (cluster.fillers.length < 2 && Math.abs(lastBoardEnd - cluster.endIn) <= 0.02) {
    return { kind: "leave", reason: "one board already closes the run end" };
  }
  const laid = layCluster({ cluster, room });
  return {
    kind: "consolidate",
    boardWidthIn: cluster.boardTotalIn,
    starts: laid.starts,
    boardStartIn: Math.round((cluster.endIn - cluster.boardTotalIn) * 1000) / 1000,
  };
}

function boardFor(input: {
  cluster: FillerCluster;
  width: number;
  startIn: number;
  owner: PlacedCabinet | null;
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  room: RoomData;
}): PlacedCabinet | null {
  const { cluster, width, startIn, owner } = input;
  const def = catalogFillerForGap(input.fillers, width, cluster.layer === "wall" ? "wall" : "base");
  if (!def) return null;
  const depth = owner && Number(owner.depth) > 0 ? Number(owner.depth) : cluster.layer === "wall" ? 12 : 24;
  const spot = wallPlacementAt(startIn, width, depth, cluster.wallId as never, input.room);
  if (!spot) return null;
  const uid = input.makeUid();
  const height = owner && Number(owner.height) > 0
    ? Number(owner.height)
    : cluster.layer === "wall" ? standardHeight("wall") : standardHeight("base");
  const draft: PlacedCabinet = {
    uid,
    cabinetId: def.id,
    masterCode: def.masterCode,
    description: `${fittedCatalogFillerDescription(def, width)} — install on right`,
    category: def.category ?? "Filler",
    subCategory: def.subCategory ?? "Filler",
    placement: cluster.layer,
    ...spot,
    width,
    nominalWidth: dim(def.width, width),
    depth,
    height,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    catalogImageUrl: def.catalogImageUrl ?? null,
    styleId: owner?.styleId ?? input.styleId,
    fillerPieceGroupId: `filler-group-${uid}`,
    fillerBillingRole: "primary",
    fillerTotalWidth: width,
    fillerPlacementMode: "right",
    ...(owner ? { fillerForCabinetUid: owner.uid } : {}),
    ...(cluster.layer === "wall" ? { mountBottom: owner?.mountBottom ?? 54 } : {}),
  };
  return owner ? matchInstalledFillerToCabinet(draft, owner, input.room) : draft;
}

/**
 * One board per run end. For every stretch whose boards can be improved: absorb
 * them into a wider stock SKU, or consolidate them into one board of their
 * combined width. Idempotent — a run that already carries one board at its end
 * is untouched.
 */
export function consolidateAutoDesignFillers(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallIds: readonly string[];
  catalog: readonly DesignCabinet[];
  fillers: readonly CatalogFillerCandidate[];
  maxFillerIn: number;
  makeUid: () => string;
  styleId: number | null;
}): {
  placed: PlacedCabinet[];
  changes: Array<{ wallId: string; layer: FillerLayer; kind: "widen" | "consolidate"; detail: string }>;
  notes: string[];
} {
  let working = [...input.placed];
  const changes: Array<{ wallId: string; layer: FillerLayer; kind: "widen" | "consolidate"; detail: string }> = [];
  const notes: string[] = [];
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of input.wallIds) {
      if (!wallRunFrame(wallId, input.room)) continue;
      const skipped = new Set<string>();
      for (let guard = 0; guard < 8; guard += 1) {
        const cluster = findFillerClusters({ placed: working, room: input.room, openings: input.openings, wallId, layer })
          .filter((candidate) => !candidate.fillers.every((item) => skipped.has(item.uid)))
          .at(0);
        if (!cluster) break;
        const plan = planFillerCluster({ cluster, catalog: input.catalog, maxFillerIn: input.maxFillerIn, room: input.room });
        if (plan.kind === "leave") {
          for (const filler of cluster.fillers) skipped.add(filler.uid);
          if (cluster.fillers.length > 1) notes.push(`${wallId}: ${plan.reason}.`);
          continue;
        }
        const fillerUids = new Set(cluster.fillers.map((item) => item.uid));
        const starts = new Map(plan.starts.map((entry) => [entry.uid, entry.startIn]));
        let trial = working.filter((item) => !fillerUids.has(item.uid) && !starts.has(item.uid));
        let failed = false;
        const ordered = [...cluster.cabinets].sort((left, right) => (starts.get(left.uid) ?? 0) - (starts.get(right.uid) ?? 0));
        for (const cabinet of ordered) {
          const start = starts.get(cabinet.uid);
          if (start == null) continue;
          const isGrown = plan.kind === "widen" && cabinet.uid === plan.cabinet.uid;
          const width = isGrown ? plan.widthIn : Number(cabinet.width) || 0;
          const depth = Math.max(0, Number(cabinet.depth) || 0);
          const spot = wallPlacementAt(start, width, depth, wallId as never, input.room);
          if (!spot) { failed = true; break; }
          const next: PlacedCabinet = isGrown && plan.kind === "widen"
            ? {
              ...cabinet,
              uid: input.makeUid(),
              cabinetId: plan.replacement.id,
              masterCode: plan.replacement.masterCode,
              description: plan.replacement.description,
              category: plan.replacement.category,
              subCategory: plan.replacement.subCategory,
              width: plan.widthIn,
              depth,
              ...spot,
            }
            : { ...cabinet, ...spot };
          const accepted = appendCollisionFreePlacements(trial, [next], input.room);
          if (accepted.rejected.length > 0) { failed = true; break; }
          trial = accepted.placed;
        }
        if (failed) {
          for (const filler of cluster.fillers) skipped.add(filler.uid);
          notes.push(`${wallId}: the run could not be re-laid to consolidate its fillers.`);
          continue;
        }
        if (plan.kind === "widen") {
          working = trial;
          const detail = `${plan.cabinet.masterCode} became ${plan.replacement.masterCode} and the run closed with no filler.`;
          changes.push({ wallId, layer, kind: "widen", detail });
          notes.push(detail);
          continue;
        }
        const owner = ordered
          .map((cabinet) => trial.find((item) => item.uid === cabinet.uid) ?? cabinet)
          .sort((left, right) => wallRunOffset(right, wallId, input.room) - wallRunOffset(left, wallId, input.room))[0] ?? null;
        const board = boardFor({
          cluster, width: plan.boardWidthIn, startIn: plan.boardStartIn, owner,
          fillers: input.fillers, makeUid: input.makeUid, styleId: input.styleId, room: input.room,
        });
        if (!board) {
          for (const filler of cluster.fillers) skipped.add(filler.uid);
          notes.push(`${wallId}: no source-priced filler is sold for the ${formatFillerInches(plan.boardWidthIn)} opening.`);
          continue;
        }
        const accepted = appendCollisionFreePlacements(trial, [board], input.room);
        if (accepted.rejected.length > 0) {
          for (const filler of cluster.fillers) skipped.add(filler.uid);
          notes.push(`${wallId}: the consolidated filler could not be seated.`);
          continue;
        }
        working = accepted.placed;
        const detail = cluster.fillers.length > 1
          ? `${cluster.fillers.length} fillers on ${wallId} became one ${formatFillerInches(plan.boardWidthIn)} board at the run end.`
          : `A ${formatFillerInches(plan.boardWidthIn)} filler on ${wallId} moved to the run end.`;
        changes.push({ wallId, layer, kind: "consolidate", detail });
        notes.push(detail);
      }
    }
  }
  return { placed: working, changes, notes };
}
