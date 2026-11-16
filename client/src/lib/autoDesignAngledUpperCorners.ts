/**
 * Angled-corner closing for the Auto Design upper layer (Tom, Nov 16 2026,
 * 6:45 AM CT; HANDOFF rule "the 45°/135° angled filler goes at all angled
 * corners").
 *
 * The upper run tiles to the base run under it, and the base run holds back
 * 11″ from a 45° vertex so two 24″-deep fronts never cross. A 12″-deep upper
 * only needs about 5″ of that hold, so the front-miter pair on the upper layer
 * has to cover roughly 6⅜″ per side. Lines whose widest wall filler is 6″ had
 * no board for it, the miter repair returned nothing, and every angled corner
 * was left open in the uppers with no message.
 *
 * This pass runs after the uppers are tiled and before the shared miter
 * repair. When a 45° upper corner is measured but no selected-line filler is
 * wide enough, the corner-end upper is swapped for the next wider stock
 * cabinet of the same height and depth from the live wall catalog (bigger
 * cabinets first, use every inch), so the remaining miter fits real stock. No
 * SKU is invented, nothing is stacked, and a corner that still cannot close is
 * named by `autoDesignOpenAngledCornerFindings` instead of being skipped silently.
 */
import { angledWallFillerStock, measuredAngledWallTransition } from "./angledWallFiller";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  cabinetPlacementCollisionDetail,
  dim,
  formatEighthInches,
  insideCornerHoldIn,
  isFillerItem,
  isRefrigeratorEndPanel,
  roomWallRunFrames,
  wallLength,
  wallPlacementAt,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import type { DesignerReviewFinding } from "./designerReviewFindings";

const EPSILON_IN = 0.05;

function isUpperRunCabinet(item: PlacedCabinet): boolean {
  return item.placement === "wall" && !item.fillerPieceGroupId && !isFillerItem(item);
}

/** The same cabinet, re-cut to a wider catalog row, growing toward `at`. */
function widenedToward(
  target: PlacedCabinet,
  row: DesignCabinet,
  at: "start" | "end",
  room: RoomData,
): PlacedCabinet | null {
  const wallId = target.wallId;
  if (!wallId) return null;
  const width = dim(row.width, 0);
  const grow = width - target.width;
  if (!(grow > EPSILON_IN)) return null;
  const start = wallRunOffset(target, wallId, room);
  const nextStart = at === "end" ? start : start - grow;
  if (nextStart < -EPSILON_IN) return null;
  const before = wallPlacementAt(start, target.width, target.depth, wallId as WallSide, room);
  const after = wallPlacementAt(nextStart, width, target.depth, wallId as WallSide, room);
  return {
    ...target,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    width,
    numberOfDoors: row.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? null,
    // Keep any forward offset (flush-to-panel bridges) exactly as it was.
    x: Number(target.x) + (after.x - before.x),
    y: Number(target.y) + (after.y - before.y),
    rotation: after.rotation,
    wallOffset: after.wallOffset ?? nextStart,
  };
}

function stockFor(item: PlacedCabinet, room: RoomData, placed: readonly PlacedCabinet[], fillers: readonly CatalogFillerCandidate[]) {
  const measurement = measuredAngledWallTransition(item, room, placed);
  if (!measurement) return { measurement: null, stock: null };
  return { measurement, stock: angledWallFillerStock(item, room, measurement, fillers) };
}

export function closeAutoDesignAngledUpperCorners(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallCatalog: readonly DesignCabinet[];
  fillers: readonly CatalogFillerCandidate[];
}): { placed: PlacedCabinet[]; notes: string[] } {
  const { room } = input;
  let working = [...input.placed];
  const notes: string[] = [];
  const handled = new Set<string>();

  for (const original of input.placed) {
    if (!isUpperRunCabinet(original)) continue;
    const owner = working.find((item) => item.uid === original.uid);
    if (!owner) continue;
    const first = stockFor(owner, room, working, input.fillers);
    if (!first.measurement || first.stock) continue;
    const key = [owner.uid, first.measurement.neighborUid].sort().join("|");
    if (handled.has(key)) continue;
    handled.add(key);

    const neighbor = working.find((item) => item.uid === first.measurement!.neighborUid);
    if (!neighbor || !isUpperRunCabinet(neighbor)) continue;
    // Each side needs its own board, so both corner-end uppers may have to grow.
    // Options per side: keep it, or the next wider stock rows that stay clear of
    // that upper's own 45° hold. The smallest total growth that lets real stock
    // cut both boards wins.
    const options = (target: PlacedCabinet, at: "start" | "end"): PlacedCabinet[] => {
      const wallId = target.wallId;
      if (!wallId) return [target];
      const hold = insideCornerHoldIn(45, target.depth);
      const wallLen = wallLength(wallId as WallSide, room);
      const others = working.filter((item) => item.uid !== target.uid && item.uid !== owner.uid && item.uid !== neighbor.uid);
      const rows = autoDesignStandardUpperRows(input.wallCatalog, Number(target.height) || 0)
        .filter((row) => Math.abs(dim(row.depth, 0) - target.depth) <= 0.5 && dim(row.width, 0) > target.width + EPSILON_IN)
        .sort((left, right) => dim(left.width, 0) - dim(right.width, 0));
      const out: PlacedCabinet[] = [target];
      for (const row of rows) {
        const candidate = widenedToward(target, row, at, room);
        if (!candidate) continue;
        const start = wallRunOffset(candidate, wallId, room);
        const end = start + wallRunSpan(candidate, wallId, room);
        // Never past the upper's own 45° hold: the two fronts must not cross.
        if ((at === "start" ? start : wallLen - end) < hold - EPSILON_IN) break;
        if (cabinetPlacementCollisionDetail(candidate, others, room)) continue;
        out.push(candidate);
      }
      return out;
    };
    const ownerOptions = options(owner, first.measurement.at);
    const neighborOptions = options(neighbor, first.measurement.neighborAt);
    const combos = ownerOptions.flatMap((ownerOption) => neighborOptions.map((neighborOption) => ({
      ownerOption,
      neighborOption,
      growth: (ownerOption.width - owner.width) + (neighborOption.width - neighbor.width),
    })))
      .filter((combo) => combo.growth > EPSILON_IN)
      .sort((left, right) => left.growth - right.growth);
    for (const { ownerOption, neighborOption } of combos) {
      if (cabinetPlacementCollisionDetail(ownerOption, [neighborOption], room)) continue;
      const next = working.map((item) => (item.uid === owner.uid ? ownerOption : item.uid === neighbor.uid ? neighborOption : item));
      const check = stockFor(ownerOption, room, next, input.fillers);
      if (!check.measurement || !check.stock || check.measurement.neighborUid !== neighbor.uid) continue;
      working = next;
      for (const [before, after] of [[owner, ownerOption], [neighbor, neighborOption]] as const) {
        if (before.masterCode === after.masterCode && Math.abs(before.width - after.width) <= EPSILON_IN) continue;
        notes.push(`${before.masterCode} at the 45° corner on ${before.wallId} became ${after.masterCode}, so the angled upper filler is cut from ${check.stock.masterCode} stock (the ${formatEighthInches(first.measurement.requiredStockWidthIn)} cut it needed is wider than any wall filler this line sells).`);
      }
      break;
    }
    // A corner that still cannot close is named by
    // autoDesignOpenAngledCornerFindings after the shared miter repair.
  }
  return { placed: working, notes };
}

/**
 * Every 45° corner a cabinet still measures open after the build, named per
 * layer. The miter repair only returns a pair when real stock fits; this makes
 * the misses visible on the Auto Design report instead of silent.
 */
export function autoDesignOpenAngledCornerFindings(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  fillers: readonly CatalogFillerCandidate[],
): DesignerReviewFinding[] {
  const findings: DesignerReviewFinding[] = [];
  const seen = new Set<string>();
  for (const item of placed) {
    if ((item.placement !== "base" && item.placement !== "wall") || item.fillerPieceGroupId || isFillerItem(item)) continue;
    const measurement = measuredAngledWallTransition(item, room, placed);
    if (!measurement) continue;
    const key = `${item.placement}|${measurement.sharedVertexId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const stock = angledWallFillerStock(item, room, measurement, fillers);
    findings.push({
      ruleId: "angled-wall-filler",
      code: item.placement === "wall" ? "angled-upper-corner-open" : "angled-base-corner-open",
      severity: "warning",
      title: `${item.placement === "wall" ? "Upper" : "Base"} run left open at the 45° corner of ${measurement.wallId} and ${measurement.neighborWallId}`,
      detail: stock
        ? `The ${formatEighthInches(measurement.requiredStockWidthIn)} angled filler pair from ${stock.masterCode} could not be seated without a collision.`
        : `The angled filler pair needs ${formatEighthInches(measurement.requiredStockWidthIn)} of stock per side and this line sells no ${item.placement === "wall" ? "wall" : "base"} filler that wide.`,
      cabinetUid: item.uid,
      cabinetCode: item.masterCode,
    });
  }
  // A run that ends against a tall box or an appliance on the next wall (a
  // refrigerator and its end panel, a pantry) has no cabinet-to-cabinet pair to
  // measure, and a corner that the last-resort miter pair could not close against a
  // refrigerator panel stays open. Name the
  // open 45° corner so it is reviewed rather than silently left as bare floor.
  for (const frame of roomWallRunFrames(room)) {
    for (const at of ["start", "end"] as const) {
      const join = wallRunJoinAt(frame, at, room);
      if (!join || Math.abs(join.turnDeg - 45) > 0.5) continue;
      const vertex = at === "start" ? frame.start : frame.end;
      const neighborAt = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.01 ? "start" : "end";
      for (const layer of ["base", "wall"] as const) {
        const nearestOn = (wallId: string, end: "start" | "end") => {
          const len = wallLength(wallId as WallSide, room);
          return placed
            .filter((item) => item.wallId === wallId && !item.fillerPieceGroupId && !isFillerItem(item)
              && (layer === "base"
                ? item.placement === "base" || item.placement === "tall" || item.placement === "appliance"
                : item.placement === "wall" || item.placement === "tall"))
            .map((item) => {
              const start = wallRunOffset(item, wallId, room);
              const stop = start + wallRunSpan(item, wallId, room);
              return { item, gap: end === "start" ? start : len - stop };
            })
            .filter((entry) => entry.gap >= -EPSILON_IN)
            .sort((left, right) => left.gap - right.gap)[0] ?? null;
        };
        const mine = nearestOn(frame.id, at);
        const theirs = nearestOn(join.frame.id, neighborAt);
        if (!mine || !theirs) continue;
        const pairs = [mine.item.placement, theirs.item.placement];
        if (pairs[0] === layer && pairs[1] === layer) continue; // cabinet-to-cabinet: measured above
        if (pairs[0] !== layer && pairs[1] !== layer) continue; // two tall/appliance ends: not a run joint
        const cabinet = mine.item.placement === layer ? mine : theirs;
        const other = cabinet === mine ? theirs : mine;
        const key = `${layer}|${[frame.id, join.frame.id].sort().join("|")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hold = insideCornerHoldIn(45, layer === "wall" ? 12 : 24);
        if (cabinet.gap <= hold + 0.5 && other.gap <= hold + 0.5) continue;
        // Closed against a refrigerator panel by the last-resort miter pair.
        if (placed.some((piece) => piece.fillerTransitionKind === "front-miter-pair" && (
          (piece.fillerForCabinetUid === cabinet.item.uid && piece.fillerTransitionNeighborUid === other.item.uid)
          || (piece.fillerForCabinetUid === other.item.uid && piece.fillerTransitionNeighborUid === cabinet.item.uid)
        ))) continue;
        findings.push({
          ruleId: "angled-wall-filler",
          code: layer === "wall" ? "angled-upper-corner-open" : "angled-base-corner-open",
          severity: "warning",
          title: `${layer === "wall" ? "Upper" : "Base"} run left open at the 45° corner of ${frame.id} and ${join.frame.id}`,
          detail: `${cabinet.item.masterCode} stops ${formatEighthInches(cabinet.gap)} from the corner and ${other.item.masterCode} on the next wall starts ${formatEighthInches(other.gap)} from it. No angled filler pair is placed against ${other.item.placement === "appliance" ? "an appliance" : "a tall box or refrigerator panel"}, so this corner needs a designer decision.`,
          cabinetUid: cabinet.item.uid,
          cabinetCode: cabinet.item.masterCode,
        });
      }
    }
  }
  return findings;
}

/**
 * Tom, Nov 16 2026 (8:17 AM CT): a filler against a refrigerator panel is the
 * last resort. When a run turns a 45° corner and the next wall starts with a
 * refrigerator end panel, the space between that layer's 45° hold and the panel
 * gets the widest stock cabinet the live catalog sells that fits (use every
 * inch, never a hardcoded size). The corner then closes cabinet-to-cabinet with
 * the normal miter pair. When no cabinet fits (a base run usually has under 6″
 * there) nothing is seated and the base miter pair closes against the panel.
 */
export function seatAutoDesignAngledFridgePanelCabinets(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  baseCatalog: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  makeUid: () => string;
  styleId: number | null;
}): { placed: PlacedCabinet[]; notes: string[] } {
  const { room } = input;
  let working = [...input.placed];
  const notes: string[] = [];
  for (const frame of roomWallRunFrames(room)) {
    for (const at of ["start", "end"] as const) {
      const join = wallRunJoinAt(frame, at, room);
      if (!join || Math.abs(join.turnDeg - 45) > 0.5) continue;
      const vertex = at === "start" ? frame.start : frame.end;
      const neighborAt = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.01 ? "start" : "end";
      for (const layer of ["base", "wall"] as const) {
        const nearestOn = (wallId: string, end: "start" | "end") => {
          const len = wallLength(wallId as WallSide, room);
          return working
            .filter((item) => item.wallId === wallId && !item.fillerPieceGroupId && !isFillerItem(item)
              && (isRefrigeratorEndPanel(item) || (layer === "base"
                ? item.placement === "base" || item.placement === "tall" || item.placement === "appliance"
                : item.placement === "wall" || item.placement === "tall")))
            .map((item) => {
              const start = wallRunOffset(item, wallId, room);
              const stop = start + wallRunSpan(item, wallId, room);
              return { item, start, stop, gap: end === "start" ? start : len - stop };
            })
            .filter((entry) => entry.gap >= -EPSILON_IN)
            .sort((left, right) => left.gap - right.gap)[0] ?? null;
        };
        // Only the wall whose first box is the panel: the far side is the run.
        const panel = nearestOn(join.frame.id, neighborAt);
        const run = nearestOn(frame.id, at);
        if (!panel || !run || !isRefrigeratorEndPanel(panel.item)) continue;
        if (run.item.placement !== layer || isRefrigeratorEndPanel(run.item)) continue;
        const depth = Number(run.item.depth) || (layer === "wall" ? 12 : 24);
        const hold = insideCornerHoldIn(45, depth);
        const free = panel.gap - hold;
        if (!(free > EPSILON_IN)) continue;
        const rows = (layer === "wall"
          ? autoDesignStandardUpperRows(input.wallCatalog, Number(run.item.height) || 0)
          : input.baseCatalog.filter((row) => !row.isCornerCabinet))
          .filter((row) => Math.abs(dim(row.depth, 0) - depth) <= 0.5)
          .filter((row) => dim(row.width, 0) > 0 && dim(row.width, 0) <= free + EPSILON_IN)
          // Widest first (use every inch); at one width a spice / pull-out box first.
          .sort((left, right) => dim(right.width, 0) - dim(left.width, 0)
            || Number(/spice|pull[- ]?out/i.test(`${right.description ?? ""} ${right.subCategory ?? ""}`))
              - Number(/spice|pull[- ]?out/i.test(`${left.description ?? ""} ${left.subCategory ?? ""}`)));
        const wallId = join.frame.id;
        for (const row of rows) {
          const width = dim(row.width, 0);
          const along = neighborAt === "start" ? panel.start - width : panel.stop;
          const spot = wallPlacementAt(along, width, depth, wallId as WallSide, room);
          const height = layer === "wall" ? Number(run.item.height) || dim(row.height, 30) : dim(row.height, 34.5);
          const candidate: PlacedCabinet = {
            uid: input.makeUid(),
            cabinetId: row.id,
            masterCode: row.masterCode,
            description: row.description,
            category: row.category,
            subCategory: row.subCategory,
            placement: layer,
            ...spot,
            width,
            depth,
            height,
            rotation: spot.rotation,
            wallId: spot.wallId ?? wallId,
            wallOffset: spot.wallOffset ?? along,
            numberOfDoors: row.numberOfDoors,
            numberOfDrawers: row.numberOfDrawers,
            catalogImageUrl: row.catalogImageUrl ?? null,
            styleId: input.styleId,
            mountBottom: layer === "wall" ? run.item.mountBottom : 0,
          } as PlacedCabinet;
          if (cabinetPlacementCollisionDetail(candidate, working, room)) continue;
          working = [...working, candidate];
          notes.push(`${row.masterCode} (${formatEighthInches(width)}) is seated beside the ${panel.item.masterCode} refrigerator panel at the 45° corner of ${frame.id} and ${wallId}, so the ${layer === "wall" ? "upper" : "base"} corner closes with cabinets instead of a filler against the panel.`);
          break;
        }
      }
    }
  }
  return { placed: working, notes };
}
