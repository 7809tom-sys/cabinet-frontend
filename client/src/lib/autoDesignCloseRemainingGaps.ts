/**
 * After Auto Design's leftover, 15-rule retile, corner, and sink/bridge passes,
 * close every remaining gap on each wall run (base and upper) with the biggest
 * catalog cabinets that fit, then one priced catalog filler (Tom, Nov 14 2026,
 * 2:03 PM CT). Fillers are last-resort, as few as possible, never invented,
 * and never used to bridge a window (designerFaceRules rule 9 + 3 in clearance).
 *
 * A run-end gap against a wall or a corner is a real gap and is closed. Window
 * openings, door openings, and the appliance bodies themselves are not filled.
 * Required inside-corner reservations stay reserved. If the line sells no
 * filler that covers a leftover, a review finding is raised and nothing is invented.
 */
import { autoDesignInsideCornerReservations } from "./autoDesignCornerDecision";
import { isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { formatFillerInches } from "./autoDesignFillerConsolidation";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import {
  WALL_OPENING_CLEARANCE_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  elevationBox,
  fillerOverlapIsSeamOnly,
  freeSegmentsOnWall,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  standardHeight,
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

const MIN_GAP_IN = 0.125;
const COLLISION = 0.05;

export type CloseRemainingGapsResult = {
  placed: PlacedCabinet[];
  notes: string[];
  findings: DesignerReviewFinding[];
};

function widthOf(row: { width?: string | number | null }): number {
  return dim(row.width == null ? null : String(row.width), 0);
}

function sellable(row: DesignCabinet, layer: "base" | "wall"): boolean {
  if (row.id <= 0) return false;
  if (layer === "wall") return row.placement === "wall" && widthOf(row) >= 9 && !/filler|scribe|panel|hood|bridge/i.test(`${row.masterCode} ${row.description} ${row.subCategory ?? ""}`);
  return (row.placement === "base" || !row.placement) && widthOf(row) >= 9
    && !/filler|scribe|panel|corner|lazy|susan|blind|sink|SB\d/i.test(`${row.masterCode} ${row.description} ${row.subCategory ?? ""}`);
}

function packWidths(span: number, catalog: readonly DesignCabinet[], layer: "base" | "wall", maxFillerIn = 6): number[] {
  const widths = Array.from(new Set(catalog.filter((row) => sellable(row, layer)).map(widthOf)))
    .filter((width) => width >= 9 && width <= span + COLLISION)
    .sort((left, right) => right - left);
  let best: { packed: number[]; leftover: number } = { packed: [], leftover: span };
  const visit = (left: number, packed: number[], depth: number) => {
    const leftover = Math.round(Math.max(0, left) * 1000) / 1000;
    if (leftover < 9 - COLLISION || depth >= 8) {
      if (leftover < best.leftover - 0.01
        || (Math.abs(leftover - best.leftover) <= 0.01 && packed.length < best.packed.length)
        || (Math.abs(leftover - best.leftover) <= 0.01 && packed.length === best.packed.length && packed[0]! > (best.packed[0] ?? 0))) {
        best = { packed: [...packed], leftover };
      }
      return;
    }
    let progressed = false;
    for (const width of widths) {
      if (width <= left + COLLISION) {
        progressed = true;
        visit(left - width, [...packed, width], depth + 1);
        if (best.leftover <= 0.125) return;
      }
    }
    if (!progressed) visit(0, packed, 8);
  };
  visit(span, [], 0);
  // Prefer a combination whose leftover a catalog filler can cover.
  if (best.leftover > maxFillerIn + COLLISION) {
    // Keep the search result anyway; the caller may still raise a finding.
  }
  return best.packed;
}

function rowFor(catalog: readonly DesignCabinet[], layer: "base" | "wall", width: number, preferHeightIn: number | null): DesignCabinet | null {
  const rows = catalog.filter((row) => sellable(row, layer) && Math.abs(widthOf(row) - width) <= 0.05)
    .sort((a, b) => (layer === "base" ? baseRowRank(a) - baseRowRank(b) : 0));
  if (!rows.length) return null;
  if (preferHeightIn != null) {
    const atHeight = rows.filter((row) => Math.abs(dim(row.height, 0) - preferHeightIn) <= 0.5);
    if (atHeight.length) return atHeight.sort((a, b) => a.masterCode.localeCompare(b.masterCode))[0]!;
  }
  return rows.sort((a, b) => (layer === "base" ? baseRowRank(a) - baseRowRank(b) : 0) || a.masterCode.localeCompare(b.masterCode))[0]!;
}

function isWindowOrDoor(opening: WallOpening): boolean {
  return opening.kind === "window" || opening.kind === "door";
}

function blockedByOpening(gapStart: number, gapEnd: number, openings: readonly WallOpening[], wallId: string, layer: "base" | "wall"): boolean {
  const clearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
  return openings.some((opening) => {
    if (opening.side !== wallId || !isWindowOrDoor(opening)) return false;
    // A window with a high sill does not occupy the base band.
    if (layer === "base" && opening.kind === "window" && (opening.sill ?? 42) >= 36) return false;
    const start = opening.offset - clearance;
    const end = opening.offset + opening.width + clearance;
    return gapStart < end - COLLISION && gapEnd > start + COLLISION;
  });
}

function reserved(gapStart: number, gapEnd: number, spans: ReadonlyArray<{ wallId: string; start: number; end: number }>, wallId: string): boolean {
  return spans.some((span) => span.wallId === wallId && gapStart < span.end - COLLISION && gapEnd > span.start + COLLISION);
}

/**
 * The parts of a free gap outside every reserved span. A gap that only touches
 * a reserved corner square (or a range / sink span) still has a real opening
 * beside it; dropping the whole gap left that opening empty (Tom, Nov 14 2026:
 * a 14 in base opening next to a blocked corner was never filled).
 */
function unreservedPieces(
  gap: { start: number; length: number },
  spans: ReadonlyArray<{ wallId: string; start: number; end: number }>,
  wallId: string,
): Array<{ start: number; length: number; trimmed: boolean }> {
  let pieces = [{ start: gap.start, end: gap.start + gap.length }];
  for (const span of spans) {
    if (span.wallId !== wallId) continue;
    pieces = pieces.flatMap((piece) => {
      if (span.end <= piece.start + COLLISION || span.start >= piece.end - COLLISION) return [piece];
      const out: Array<{ start: number; end: number }> = [];
      if (span.start > piece.start + COLLISION) out.push({ start: piece.start, end: span.start });
      if (span.end < piece.end - COLLISION) out.push({ start: span.end, end: piece.end });
      return out;
    });
  }
  return pieces.map((piece) => ({
    start: piece.start,
    length: piece.end - piece.start,
    trimmed: Math.abs(piece.start - gap.start) > COLLISION || Math.abs(piece.end - piece.start - gap.length) > COLLISION,
  }));
}

/** Kitchen Rules `close_gap_with_cabinet_max_in` (default 14.5 in). */
export function autoDesignCloseGapWithCabinetMaxIn(): number {
  return kitchenRuleNumber("close_gap_with_cabinet_max_in");
}

/**
 * Tom's rule (Nov 14 2026): a base opening from the line's narrowest base up to
 * `close_gap_with_cabinet_max_in` gets a NEW real base, the widest the line
 * sells that leaves no more than `seam_filler_max_in`, plus one filler trimmed
 * to the rest (14 -> 12 + 2, 14.5 -> 12 + 2.5). Widths come from the live
 * catalog for the chosen line; nothing is hard-coded. Null when the opening is
 * outside the band or no catalog base leaves a filler-sized remainder.
 */
export function narrowBasePlusFillerWidth(gapIn: number, catalog: readonly DesignCabinet[]): number | null {
  const widths = Array.from(new Set(catalog.filter((row) => sellable(row, "base")).map(widthOf))).filter((width) => width > 0).sort((a, b) => b - a);
  if (!widths.length) return null;
  const narrowest = widths[widths.length - 1]!;
  if (gapIn < narrowest - COLLISION || gapIn > autoDesignCloseGapWithCabinetMaxIn() + COLLISION) return null;
  const fillerMax = autoDesignFillerMaxIn();
  return widths.find((width) => width <= gapIn + COLLISION && gapIn - width <= fillerMax + COLLISION) ?? null;
}

/** A plain door base (B12) before a drawer or specialty base of the same width (3DB12). */
function baseRowRank(row: DesignCabinet): number {
  const code = row.masterCode.toUpperCase();
  if (/^B\d{1,2}$/.test(code)) return 0;
  if (/^B\d/.test(code)) return 1;
  return 2;
}

function placeFiller(input: {
  wallId: string;
  layer: "base" | "wall";
  start: number;
  width: number;
  fillers: readonly CatalogFillerCandidate[];
  room: RoomData;
  styleId: number | null;
  makeUid: () => string;
  heightIn: number;
}): PlacedCabinet | null {
  const suggestion = catalogFillerForGap(input.fillers, input.width, input.layer);
  if (!suggestion) return null;
  const depth = input.layer === "wall" ? 12 : 24;
  const spot = wallPlacementAt(input.start, input.width, depth, input.wallId as WallSide, input.room);
  if (!spot) return null;
  return {
    uid: input.makeUid(),
    cabinetId: suggestion.id,
    masterCode: suggestion.masterCode,
    description: fittedCatalogFillerDescription(suggestion, input.width),
    category: suggestion.category ?? "Filler",
    subCategory: suggestion.subCategory ?? "Filler",
    placement: input.layer,
    ...spot,
    width: input.width,
    depth,
    height: input.heightIn,
    ...(input.layer === "wall" ? { mountBottom: 54 } : {}),
    styleId: input.styleId,
    fillerBillingRole: "primary",
    fillerTotalWidth: input.width,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}


/** Full-height pieces (tall panels, continuous fillers) that close a run at the upper layer too. */
export function isFullHeightRunPiece(item: PlacedCabinet): boolean {
  return item.placement === "tall" || (isFillerItem(item) && item.fillerContinuousVertical === true);
}

/** True when full-height pieces on that wall cover [from, to] end to end. */
function fullHeightCovers(placed: readonly PlacedCabinet[], wallId: string, from: number, to: number, room: RoomData): boolean {
  const spans = placed
    .filter((item) => isFullHeightRunPiece(item) && cabinetWall(item, room) === wallId)
    .map((item) => { const start = wallRunOffset(item, wallId, room); return { start, end: start + wallRunSpan(item, wallId, room) }; })
    .sort((a, b) => a.start - b.start);
  let reach = from;
  for (const span of spans) {
    if (span.start > reach + COLLISION) break;
    reach = Math.max(reach, span.end);
  }
  return reach >= to - COLLISION;
}

/**
 * A loose wall-layer filler standing entirely inside full-height pieces (the ½″
 * board and end panel beside a refrigerator) duplicates them: the opening is
 * already closed at every height, and overlap cleanup would delete it later
 * anyway. Drop it here so the plan never carries the duplicate.
 */
function dropWallFillersInsideFullHeightPieces(placed: PlacedCabinet[], room: RoomData, wallIds: readonly string[]): PlacedCabinet[] {
  const drop = new Set<string>();
  for (const item of placed) {
    if (item.placement !== "wall" || !isFillerItem(item) || isFullHeightRunPiece(item)) continue;
    if (item.integratedWallBlindFiller || item.fillerForCabinetUid || isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId)) continue;
    const wallId = cabinetWall(item, room);
    if (!wallId || !wallIds.includes(wallId)) continue;
    const start = wallRunOffset(item, wallId, room);
    if (fullHeightCovers(placed.filter((other) => other.uid !== item.uid), wallId, start, start + wallRunSpan(item, wallId, room), room)) drop.add(item.uid);
  }
  return drop.size ? placed.filter((item) => !drop.has(item.uid)) : placed;
}

/** True when a continuous full-height filler already fills the filler's span on that wall. */
function coveredByFullHeightFiller(filler: PlacedCabinet, placed: readonly PlacedCabinet[], wallId: string, room: RoomData): boolean {
  const start = wallRunOffset(filler, wallId, room);
  const end = start + wallRunSpan(filler, wallId, room);
  return placed.some((item) => {
    if (item.uid === filler.uid || !isFillerItem(item) || item.fillerContinuousVertical !== true) return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const itemStart = wallRunOffset(item, wallId, room);
    const itemEnd = itemStart + wallRunSpan(item, wallId, room);
    return itemStart <= start + COLLISION && itemEnd >= end - COLLISION;
  });
}

function isOwnedBoard(item: PlacedCabinet): boolean {
  return item.fillerContinuousVertical === true || Boolean(item.fillerForCabinetUid);
}

function gapIsOccupied(
  placed: readonly PlacedCabinet[],
  skipUids: readonly string[],
  wallId: string,
  from: number,
  to: number,
  layerSample: PlacedCabinet,
  room: RoomData,
): boolean {
  const band = elevationBox(layerSample, room, placed);
  const bandTop = band.bottom + band.height;
  return placed.some((item) => {
    if (skipUids.includes(item.uid) || cabinetWall(item, room) !== wallId) return false;
    const start = wallRunOffset(item, wallId, room);
    const end = start + wallRunSpan(item, wallId, room);
    if (Math.min(to, end) - Math.max(from, start) <= COLLISION) return false;
    const box = elevationBox(item, room, placed);
    return Math.min(bandTop, box.bottom + box.height) - Math.max(band.bottom, box.bottom) > COLLISION;
  });
}

function mergeAdjacentFillers(
  placed: PlacedCabinet[],
  room: RoomData,
  wallIds: readonly string[],
  catalogFillers: readonly CatalogFillerCandidate[],
): PlacedCabinet[] {
  let working = [...placed];
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of wallIds) {
      const fillers = working
        .filter((item) => isFillerItem(item) && !isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId) && cabinetWall(item, room) === wallId && (layer === "wall" ? item.placement === "wall" : item.placement !== "wall"))
        .sort((left, right) => wallRunOffset(left, wallId, room) - wallRunOffset(right, wallId, room));
      for (let i = 0; i < fillers.length - 1; i += 1) {
        const left = fillers[i]!;
        const right = fillers[i + 1]!;
        const leftStart = wallRunOffset(left, wallId, room);
        const leftEnd = leftStart + wallRunSpan(left, wallId, room);
        const rightStart = wallRunOffset(right, wallId, room);
        const gap = rightStart - leftEnd;
        if (gap > 1 + 0.05 || gap < -0.05) continue;
        // A board owned by a cabinet or appliance (the ½″ between a refrigerator
        // and its end panel) is not a loose run filler; merging it dragged the
        // owner's board across the panel's spot.
        if (isOwnedBoard(left) || isOwnedBoard(right)) continue;
        // Never merge across something that already stands in the gap.
        if (gap > 0.05 && gapIsOccupied(working, [left.uid, right.uid], wallId, leftEnd, rightStart, left, room)) continue;
        const combined = Math.round((wallRunSpan(right, wallId, room) + wallRunSpan(left, wallId, room) + Math.max(0, gap)) * 1000) / 1000;
        const depth = layer === "wall" ? 12 : 24;
        const spot = wallPlacementAt(leftStart, combined, depth, wallId as WallSide, room);
        if (!spot) continue;
        // The merged board is cut from ONE real stock filler, so it must come from
        // a catalog row at least that wide (OF3xx stops at 2-7/8; OF6xx at
        // 5-7/8). Before, the left piece's identity was stretched to the
        // combined width — a 4" "OF335" that the plan flagged OVER MAX. When the
        // line sells no stock wide enough, the two boards stay as they are.
        const stock = catalogFillerForGap(catalogFillers, combined, layer);
        if (!stock) continue;
        const stockWidth = widthOf(stock);
        if (stockWidth > 0 && combined > stockWidth + 0.001) continue;
        const merged: PlacedCabinet = {
          ...left,
          ...spot,
          cabinetId: stock.id,
          masterCode: stock.masterCode,
          category: stock.category ?? left.category,
          subCategory: stock.subCategory ?? left.subCategory,
          catalogImageUrl: stock.catalogImageUrl ?? left.catalogImageUrl ?? null,
          width: combined,
          nominalWidth: stockWidth > 0 ? stockWidth : combined,
          fillerTotalWidth: combined,
          description: fittedCatalogFillerDescription(stock, combined),
        };
        working = working.filter((item) => item.uid !== left.uid && item.uid !== right.uid);
        working.push(merged);
        fillers[i] = merged;
        fillers.splice(i + 1, 1);
        i -= 1;
      }
    }
  }
  return working;
}

/**
 * Close remaining openings on the given walls after every earlier Auto Design pass.
 */
export function closeRemainingRunGaps(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  wallIds: readonly string[];
  baseCatalog: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  fillers: readonly CatalogFillerCandidate[];
  styleId: number | null;
  makeUid: () => string;
  wallHeightIn?: number | null;
  reservedSpans?: ReadonlyArray<{ wallId: string; start: number; end: number }>;
}): CloseRemainingGapsResult {
  let working = [...input.placed];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const openings = input.openings ?? [];
  const reservedSpans = [
    ...(input.reservedSpans ?? []),
    // Do not let leftover fill replace a short bridge (or the open cooking /
    // sink-window span) with a full-height wall cabinet.
    ...input.placed.flatMap((item) => {
      const wallId = cabinetWall(item, input.room);
      if (!wallId) return [];
      if (item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description)) {
        const start = wallRunOffset(item, wallId, input.room);
        return [{ wallId, start, end: start + wallRunSpan(item, wallId, input.room) }];
      }
      if (item.placement === "base" && isSinkBaseCabinet(item)) {
        const start = wallRunOffset(item, wallId, input.room);
        return [{ wallId, start, end: start + wallRunSpan(item, wallId, input.room) }];
      }
      return [];
    }),
  ];

  for (const layer of ["base", "wall"] as const) {
    const catalog = layer === "wall" ? input.wallCatalog : input.baseCatalog;
    const preferHeight = layer === "wall" ? input.wallHeightIn ?? null : null;
    const heightIn = preferHeight ?? standardHeight(layer);
    const openingClearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
    for (const wallId of input.wallIds) {
      if (!wallRunFrame(wallId, input.room)) continue;
      const failedGaps = new Set<string>();
      for (let guard = 0; guard < 20; guard += 1) {
        const gaps = freeSegmentsOnWall(
          wallId as WallSide,
          input.room,
          working,
          [...openings],
          MIN_GAP_IN,
          openingClearance,
          layer,
          layer === "wall",
        ).flatMap((gap) => unreservedPieces(gap, reservedSpans, wallId))
          .filter((gap) => gap.length >= MIN_GAP_IN - 1e-9)
          .filter((gap) => !blockedByOpening(gap.start, gap.start + gap.length, openings, wallId, layer));
        const gap = gaps
          .filter((entry) => !failedGaps.has(`${entry.start}:${entry.length}`))
          .sort((left, right) => right.length - left.length)[0];
        if (!gap) break;
        const start = gap.start;
        const span = Math.round(gap.length * 1000) / 1000;
        const narrowWidth = layer === "base" ? narrowBasePlusFillerWidth(span, catalog) : null;
        if (layer === "base" && narrowWidth == null
          && span >= kitchenRuleNumber("narrow_cabinet_max_in") - COLLISION && span <= autoDesignCloseGapWithCabinetMaxIn() + COLLISION) {
          findings.push({
            ruleId: "close-remaining-run-gaps",
            code: "narrow-base-missing",
            severity: "warning",
            title: `${formatFillerInches(span)} base opening on ${wallId}`,
            detail: `This line sells no base cabinet that leaves ${formatFillerInches(autoDesignFillerMaxIn())} or less for a filler in a ${formatFillerInches(span)} opening, so the narrow-base-plus-filler rule could not close it.`,
          });
        }
        const packed = narrowWidth != null ? [narrowWidth] : packWidths(span, catalog, layer);
        const packedTotal = packed.reduce((sum, width) => sum + width, 0);
        // A gap cut down by a reserved corner, range or sink span used to be
        // left open unless the narrow-base-plus-filler band matched it, which
        // is how a 15 or 18 inch opening beside the sink stayed bare wall. A
        // catalog pack that closes the gap exactly is allowed (owner spec:
        // never leave a leftover that a real cabinet fits).
        const packedClosesGap = layer === "base" && packed.length > 0 && Math.abs(packedTotal - span) <= MIN_GAP_IN;
        if (gap.trimmed && narrowWidth == null && !packedClosesGap) {
          // Beside a reserved corner square, range or sink span only the
          // narrow-base-plus-filler rule or an exact catalog pack fills;
          // anything else keeps the old behaviour (left for the earlier passes
          // and the review).
          failedGaps.add(`${gap.start}:${gap.length}`);
          continue;
        }
        let along = start;
        let placedAny = false;
        for (const width of packed) {
          const source = rowFor(catalog, layer, width, preferHeight);
          if (!source) continue;
          const depth = dim(source.depth, layer === "wall" ? 12 : 24);
          const spot = wallPlacementAt(along, width, depth, wallId as WallSide, input.room);
          if (!spot) break;
          const cabinet: PlacedCabinet = {
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
            height: dim(source.height, heightIn),
            ...(layer === "wall" ? { mountBottom: 54 } : {}),
            styleId: input.styleId,
            numberOfDoors: source.numberOfDoors ?? 1,
            numberOfDrawers: source.numberOfDrawers ?? 0,
            catalogImageUrl: source.catalogImageUrl ?? null,
          };
          const accepted = appendCollisionFreePlacements(working, [cabinet], input.room);
          if (accepted.rejected.length > 0) break;
          working = accepted.placed;
          along += width;
          placedAny = true;
          notes.push(`${source.masterCode} filled a ${formatFillerInches(width)} opening on ${wallId} (${layer}).`);
        }
        const leftover = Math.round((start + span - along) * 1000) / 1000;
        if (leftover >= MIN_GAP_IN) {
          const filler = placeFiller({
            wallId, layer, start: along, width: leftover, fillers: input.fillers,
            room: input.room, styleId: input.styleId, makeUid: input.makeUid, heightIn,
          });
          if (filler) {
            const accepted = appendCollisionFreePlacements(working, [filler], input.room);
            if (accepted.rejected.length === 0) {
              working = accepted.placed;
              placedAny = true;
              notes.push(`${filler.masterCode} filled a ${formatFillerInches(leftover)} leftover on ${wallId} (${layer}).`);
            } else if (coveredByFullHeightFiller(filler, working, wallId, input.room)
              || fullHeightCovers(working, wallId, along, along + leftover, input.room)) {
              // A full-height board (the ½″ beside a refrigerator panel, say)
              // already closes this spot at every height. The wall-layer scan
              // does not see floor-standing boards, so this "gap" is not real;
              // seating a second filler here only made overlap cleanup delete it.
            } else if (leftover <= 3 + COLLISION && fillerOverlapIsSeamOnly(filler, working, input.room)) {
              // A sliver next to a bridge or panel often fails the rectangular
              // collision test at a 1/64 in seam. The measured gap is real, so
              // seat the catalog filler directly in that opening.
              working = [...working, filler];
              placedAny = true;
              notes.push(`${filler.masterCode} filled a ${formatFillerInches(leftover)} leftover on ${wallId} (${layer}).`);
            } else {
              findings.push({
                ruleId: "close-remaining-run-gaps",
                code: "filler-blocked",
                severity: "warning",
                title: `${formatFillerInches(leftover)} opening on ${wallId}`,
                detail: `A priced ${filler.masterCode} filler could not be seated in the leftover ${layer} gap.`,
              });
            }
          } else {
            findings.push({
              ruleId: "close-remaining-run-gaps",
              code: "filler-sku-missing",
              severity: "warning",
              title: `${formatFillerInches(leftover)} opening on ${wallId}`,
              detail: `The selected line sells no priced filler that covers this ${layer} leftover, so nothing was invented to close it.`,
            });
          }
        }
        if (!placedAny) {
          failedGaps.add(`${gap.start}:${gap.length}`);
          continue;
        }
      }
    }
  }

  const deduped = dropWallFillersInsideFullHeightPieces(working, input.room, input.wallIds);
  return { placed: mergeAdjacentFillers(deduped, input.room, input.wallIds, input.fillers), notes, findings };
}

/** Gaps still open on a layer that are larger than `minIn` and not a window/door clearance. */
export function remainingRunGaps(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  wallIds: readonly string[];
  minIn?: number;
}): Array<{ wallId: string; layer: "base" | "wall"; start: number; width: number }> {
  const minIn = input.minIn ?? MIN_GAP_IN;
  const openings = input.openings ?? [];
  const out: Array<{ wallId: string; layer: "base" | "wall"; start: number; width: number }> = [];
  for (const layer of ["base", "wall"] as const) {
    const openingClearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
    for (const wallId of input.wallIds) {
      if (!wallRunFrame(wallId, input.room)) continue;
      for (const gap of freeSegmentsOnWall(wallId as WallSide, input.room, [...input.placed], [...openings], minIn, openingClearance, layer, layer === "wall")) {
        if (gap.length < minIn - 1e-9) continue;
        if (blockedByOpening(gap.start, gap.start + gap.length, openings, wallId, layer)) continue;
        const reservedByAppliance = input.placed.some((item) => {
          const itemWall = cabinetWall(item, input.room);
          if (itemWall !== wallId) return false;
          const isReserved = (item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description))
            || (item.placement === "base" && isSinkBaseCabinet(item));
          if (!isReserved) return false;
          const start = wallRunOffset(item, itemWall, input.room);
          const end = start + wallRunSpan(item, itemWall, input.room);
          return gap.start < end - 0.05 && gap.start + gap.length > start + 0.05;
        });
        if (reservedByAppliance) continue;
        const cornerReserved = autoDesignInsideCornerReservations(input.room, input.wallIds);
        if (reserved(gap.start, gap.start + gap.length, cornerReserved, wallId)) continue;
        // Ignore a completely empty wall (no run started).
        const hasRun = input.placed.some((item) => cabinetWall(item, input.room) === wallId && (layer === "wall" ? item.placement === "wall" || item.placement === "tall" : item.placement === "base" || item.placement === "appliance" || isFillerItem(item) || isPanelItem(item)));
        if (!hasRun) continue;
        // On the upper layer, a spot a full-height board or tall panel already
        // closes (refrigerator end panel + its ½″ board) is not an open gap.
        if (layer === "wall" && fullHeightCovers(input.placed, wallId, gap.start, gap.start + gap.length, input.room)) continue;
        out.push({ wallId, layer, start: gap.start, width: Math.round(gap.length * 1000) / 1000 });
      }
    }
  }
  return out;
}
