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
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  cabinetPlacementCollisionDetail,
  dim,
  formatEighthInches,
  insideCornerHoldIn,
  isFillerItem,
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
/** Largest stock step a corner-end upper may slide toward a 45° corner. */
const FORTY_FIVE_UPPER_SLIDE_MAX_IN = 6;
/** Ranks a slide after every plain widening. */
const FORTY_FIVE_UPPER_SLIDE_PENALTY_IN = 100;

function elevationBottom(item: PlacedCabinet): number {
  const mount = Number(item.mountBottom);
  return Number.isFinite(mount) ? mount : 54;
}

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
    type Option = { item: PlacedCabinet; extra: PlacedCabinet | null; extraIsNew?: boolean; growth: number };
    const options = (target: PlacedCabinet, at: "start" | "end"): Option[] => {
      const wallId = target.wallId;
      if (!wallId) return [{ item: target, extra: null, growth: 0 }];
      const hold = insideCornerHoldIn(45, target.depth);
      const wallLen = wallLength(wallId as WallSide, room);
      const others = working.filter((item) => item.uid !== target.uid && item.uid !== owner.uid && item.uid !== neighbor.uid);
      const rowsFor = (item: PlacedCabinet) => autoDesignStandardUpperRows(input.wallCatalog, Number(item.height) || 0)
        .filter((row) => Math.abs(dim(row.depth, 0) - item.depth) <= 0.5 && dim(row.width, 0) > item.width + EPSILON_IN)
        .sort((left, right) => dim(left.width, 0) - dim(right.width, 0));
      const out: Option[] = [{ item: target, extra: null, growth: 0 }];
      for (const row of rowsFor(target)) {
        const candidate = widenedToward(target, row, at, room);
        if (!candidate) continue;
        const start = wallRunOffset(candidate, wallId, room);
        const end = start + wallRunSpan(candidate, wallId, room);
        // Never past the upper's own 45° hold: the two fronts must not cross.
        if ((at === "start" ? start : wallLen - end) < hold - EPSILON_IN) break;
        if (cabinetPlacementCollisionDetail(candidate, others, room)) continue;
        out.push({ item: candidate, extra: null, growth: candidate.width - target.width });
      }
      // 45° corners (Tom, Nov 16 2026, voice 11:53 AM CT): the bases now start
      // at the end of a 3″ angled filler, so the corner-end upper sits about 5″
      // farther from its own miter than a 12″-deep upper needs. When that upper
      // is already the widest stock row (a W42 over a B42), slide it toward the
      // corner by one stock step and let the next upper in the run grow by the
      // same step into the space it left. Both stay real stock widths and no
      // filler is left between them; the miter pair is still cut from real
      // stock. Plain widening is always preferred.
      const tStart = wallRunOffset(target, wallId, room);
      const tEnd = tStart + wallRunSpan(target, wallId, room);
      const next = working.find((item) => item.uid !== target.uid && item.wallId === wallId && isUpperRunCabinet(item)
        && Math.abs((Number(item.height) || 0) - (Number(target.height) || 0)) <= 0.25
        && Math.abs(elevationBottom(item) - elevationBottom(target)) <= 0.25
        && (at === "start"
          ? Math.abs(wallRunOffset(item, wallId, room) - tEnd) <= EPSILON_IN
          : Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - tStart) <= EPSILON_IN));
      if (next) {
        const rest = others.filter((item) => item.uid !== next.uid);
        for (const row of rowsFor(next)) {
          const step = dim(row.width, 0) - next.width;
          if (step > FORTY_FIVE_UPPER_SLIDE_MAX_IN + EPSILON_IN) break;
          const slidStart = at === "start" ? tStart - step : tStart + step;
          if ((at === "start" ? slidStart : wallLen - (slidStart + target.width)) < hold - EPSILON_IN) break;
          const spot = wallPlacementAt(slidStart, target.width, target.depth, wallId as WallSide, room);
          const before = wallPlacementAt(tStart, target.width, target.depth, wallId as WallSide, room);
          const slid: PlacedCabinet = {
            ...target,
            x: Number(target.x) + (spot.x - before.x),
            y: Number(target.y) + (spot.y - before.y),
            rotation: spot.rotation,
            wallOffset: spot.wallOffset ?? slidStart,
          };
          const grown = widenedToward(next, row, at, room);
          if (!grown) continue;
          if (cabinetPlacementCollisionDetail(slid, rest, room) || cabinetPlacementCollisionDetail(grown, rest, room)) continue;
          if (cabinetPlacementCollisionDetail(grown, [slid], room)) continue;
          // Ranked after every plain widening of the same total growth.
          out.push({ item: slid, extra: grown, growth: step + FORTY_FIVE_UPPER_SLIDE_PENALTY_IN });
        }
      }
      // When neither widening nor a slide can reach (the corner-end upper is
      // already the widest stock row and nothing behind it can grow), re-tile
      // that one upper as two stock uppers over the same far edge, starting as
      // close as stock allows to the end of a 3″ angled filler (Tom's rule).
      if (out.length === 1) {
        const seat = fortyFiveCornerSeat(room, wallId, at, "wall");
        const rows = autoDesignStandardUpperRows(input.wallCatalog, Number(target.height) || 0)
          .filter((row) => Math.abs(dim(row.depth, 0) - target.depth) <= 0.5);
        const farEdge = at === "start" ? tEnd : tStart;
        if (seat && rows.length) {
          const wantSpan = at === "start" ? farEdge - seat.cabinetSetbackIn : wallLen - seat.cabinetSetbackIn - farEdge;
          const maxSpan = at === "start" ? farEdge - hold : wallLen - hold - farEdge;
          const pairs = rows.flatMap((cornerRow) => rows.map((farRow) => ({ cornerRow, farRow, span: dim(cornerRow.width, 0) + dim(farRow.width, 0) })))
            .filter((pair) => pair.span > target.width + EPSILON_IN && pair.span <= maxSpan + EPSILON_IN)
            .sort((left, right) => Math.abs(left.span - wantSpan) - Math.abs(right.span - wantSpan)
              || Math.abs(dim(left.cornerRow.width, 0) - dim(left.farRow.width, 0)) - Math.abs(dim(right.cornerRow.width, 0) - dim(right.farRow.width, 0)));
          for (const { cornerRow, farRow, span } of pairs.slice(0, 6)) {
            const cornerWidth = dim(cornerRow.width, 0);
            const farWidth = dim(farRow.width, 0);
            const cornerStart = at === "start" ? farEdge - span : farEdge + span - cornerWidth;
            const farStart = at === "start" ? farEdge - farWidth : farEdge;
            const piece = (row: DesignCabinet, start: number, width: number, uid: string): PlacedCabinet => {
              const spot = wallPlacementAt(start, width, target.depth, wallId as WallSide, room);
              const before = wallPlacementAt(tStart, target.width, target.depth, wallId as WallSide, room);
              return {
                ...target,
                uid,
                cabinetId: row.id,
                masterCode: row.masterCode,
                description: row.description,
                category: row.category,
                subCategory: row.subCategory,
                width,
                numberOfDoors: row.numberOfDoors,
                numberOfDrawers: row.numberOfDrawers,
                catalogImageUrl: row.catalogImageUrl ?? null,
                x: Number(target.x) + (spot.x - before.x),
                y: Number(target.y) + (spot.y - before.y),
                rotation: spot.rotation,
                wallOffset: spot.wallOffset ?? start,
              };
            };
            const cornerPiece = piece(cornerRow, cornerStart, cornerWidth, target.uid);
            const farPiece = piece(farRow, farStart, farWidth, `${target.uid}-45split`);
            if (cabinetPlacementCollisionDetail(cornerPiece, others, room) || cabinetPlacementCollisionDetail(farPiece, others, room)) continue;
            out.push({ item: cornerPiece, extra: farPiece, extraIsNew: true, growth: span - target.width + 2 * FORTY_FIVE_UPPER_SLIDE_PENALTY_IN });
          }
        }
      }
      return out;
    };
    const ownerOptions = options(owner, first.measurement.at);
    const neighborOptions = options(neighbor, first.measurement.neighborAt);
    const combos = ownerOptions.flatMap((ownerOption) => neighborOptions.map((neighborOption) => ({
      ownerOption,
      neighborOption,
      growth: ownerOption.growth + neighborOption.growth,
    })))
      .filter((combo) => combo.growth > EPSILON_IN)
      .sort((left, right) => left.growth - right.growth);
    for (const { ownerOption, neighborOption } of combos) {
      const changed = [ownerOption.item, neighborOption.item, ...(ownerOption.extra ? [ownerOption.extra] : []), ...(neighborOption.extra ? [neighborOption.extra] : [])];
      if (changed.some((item, index) => cabinetPlacementCollisionDetail(item, changed.filter((_, other) => other !== index), room))) continue;
      const replace = new Map(changed.map((item) => [item.uid, item]));
      const added = [ownerOption, neighborOption].filter((option) => option.extraIsNew && option.extra).map((option) => option.extra!);
      if (added.some((item) => cabinetPlacementCollisionDetail(item, working.filter((other) => !replace.has(other.uid)), room))) continue;
      const next = [...working.map((item) => replace.get(item.uid) ?? item), ...added];
      const check = stockFor(ownerOption.item, room, next, input.fillers);
      if (!check.measurement || !check.stock || check.measurement.neighborUid !== neighbor.uid) continue;
      working = next;
      for (const [before, after, option] of [[owner, ownerOption.item, ownerOption], [neighbor, neighborOption.item, neighborOption]] as const) {
        if (option.extraIsNew) continue;
        if (before.masterCode === after.masterCode && Math.abs(before.width - after.width) <= EPSILON_IN) continue;
        notes.push(`${before.masterCode} at the 45° corner on ${before.wallId} became ${after.masterCode}, so the angled upper filler is cut from ${check.stock.masterCode} stock (the ${formatEighthInches(first.measurement.requiredStockWidthIn)} cut it needed is wider than any wall filler this line sells).`);
      }
      for (const option of [ownerOption, neighborOption]) {
        if (!option.extra) continue;
        if (option.extraIsNew) {
          const was = option === ownerOption ? owner : neighbor;
          notes.push(`${was.masterCode} at the 45° corner on ${was.wallId} became ${option.item.masterCode} + ${option.extra.masterCode}, so the upper run starts near the end of the 3″ angled filler and the filler is cut from ${check.stock.masterCode} stock.`);
          continue;
        }
        const grownFrom = input.placed.find((item) => item.uid === option.extra!.uid);
        notes.push(`${option.item.masterCode} at the 45° corner on ${option.item.wallId} slid toward the corner and ${grownFrom?.masterCode ?? "the next upper"} became ${option.extra.masterCode} behind it, so the angled upper filler is cut from ${check.stock.masterCode} stock.`);
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
    seen.add(`${item.placement}|${[measurement.wallId, measurement.neighborWallId].sort().join("|")}`);
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
  // measure, and a filler against a refrigerator panel is not allowed. Name the
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
        if (pairs[0] === layer && pairs[1] === layer) {
          // Cabinet-to-cabinet: measured above. Tom, Nov 16 2026: when the
          // measurement could not run (a panel or other non-cabinet piece ends
          // one side) and no angled pair joins them, still name the open corner.
          const key = `${layer}|${[frame.id, join.frame.id].sort().join("|")}`;
          if (seen.has(key)) continue;
          const paired = placed.some((piece) => piece.fillerTransitionKind === "front-miter-pair"
            && [piece.fillerForCabinetUid, piece.fillerTransitionNeighborUid].some((uid) => uid === mine.item.uid || uid === theirs.item.uid));
          const holdIn = insideCornerHoldIn(45, layer === "wall" ? 12 : 24);
          if (paired || (mine.gap <= holdIn + 0.5 && theirs.gap <= holdIn + 0.5)) continue;
          const nearestPiece = (wallId: string, end: "start" | "end") => {
            const len = wallLength(wallId as WallSide, room);
            return placed
              .filter((piece) => piece.wallId === wallId && piece.placement === layer)
              .map((piece) => {
                const start = wallRunOffset(piece, wallId, room);
                return end === "start" ? start : len - (start + wallRunSpan(piece, wallId, room));
              })
              .filter((gap) => gap >= -EPSILON_IN)
              .sort((left, right) => left - right)[0] ?? Number.POSITIVE_INFINITY;
          };
          // Something (an ordinary filler, panel) already sits closer: only warn when floor is bare.
          if (nearestPiece(frame.id, at) < mine.gap - EPSILON_IN && nearestPiece(join.frame.id, neighborAt) < theirs.gap - EPSILON_IN) continue;
          seen.add(key);
          findings.push({
            ruleId: "angled-wall-filler",
            code: layer === "wall" ? "angled-upper-corner-open" : "angled-base-corner-open",
            severity: "warning",
            title: `${layer === "wall" ? "Upper" : "Base"} run left open at the 45° corner of ${frame.id} and ${join.frame.id}`,
            detail: `${mine.item.masterCode} stops ${formatEighthInches(mine.gap)} from the corner and ${theirs.item.masterCode} on the next wall starts ${formatEighthInches(theirs.gap)} from it, and no angled filler pair could be seated between them, so this corner needs a designer decision.`,
            cabinetUid: mine.item.uid,
            cabinetCode: mine.item.masterCode,
          });
          continue;
        }
        if (pairs[0] !== layer && pairs[1] !== layer) continue; // two tall/appliance ends: not a run joint
        const cabinet = mine.item.placement === layer ? mine : theirs;
        const other = cabinet === mine ? theirs : mine;
        const key = `${layer}|${[frame.id, join.frame.id].sort().join("|")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hold = insideCornerHoldIn(45, layer === "wall" ? 12 : 24);
        if (cabinet.gap <= hold + 0.5 && other.gap <= hold + 0.5) continue;
        // Tom, Nov 16 2026 (4:38 PM CT): a base-height dishwasher joins a 45°
        // corner like a base, so a miter pair seated against it closes the corner.
        if (placed.some((piece) => piece.fillerTransitionKind === "front-miter-pair"
          && [piece.fillerForCabinetUid, piece.fillerTransitionNeighborUid].includes(cabinet.item.uid)
          && [piece.fillerForCabinetUid, piece.fillerTransitionNeighborUid].includes(other.item.uid))) continue;
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
