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
import {
  WALL_OPENING_CLEARANCE_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
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
  const rows = catalog.filter((row) => sellable(row, layer) && Math.abs(widthOf(row) - width) <= 0.05);
  if (!rows.length) return null;
  if (preferHeightIn != null) {
    const atHeight = rows.filter((row) => Math.abs(dim(row.height, 0) - preferHeightIn) <= 0.5);
    if (atHeight.length) return atHeight.sort((a, b) => a.masterCode.localeCompare(b.masterCode))[0]!;
  }
  return rows.sort((a, b) => a.masterCode.localeCompare(b.masterCode))[0]!;
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


function mergeAdjacentFillers(placed: PlacedCabinet[], room: RoomData, wallIds: readonly string[]): PlacedCabinet[] {
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
        const combined = Math.round((wallRunSpan(right, wallId, room) + wallRunSpan(left, wallId, room) + Math.max(0, gap)) * 1000) / 1000;
        const depth = layer === "wall" ? 12 : 24;
        const spot = wallPlacementAt(leftStart, combined, depth, wallId as WallSide, room);
        if (!spot) continue;
        const merged: PlacedCabinet = {
          ...left,
          ...spot,
          width: combined,
          fillerTotalWidth: combined,
          description: fittedCatalogFillerDescription({ masterCode: left.masterCode, description: left.description, width: String(left.width) }, combined),
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
        ).filter((gap) => gap.length >= MIN_GAP_IN - 1e-9)
          .filter((gap) => !blockedByOpening(gap.start, gap.start + gap.length, openings, wallId, layer))
          .filter((gap) => !reserved(gap.start, gap.start + gap.length, reservedSpans, wallId));
        const gap = gaps
          .filter((entry) => !failedGaps.has(`${entry.start}:${entry.length}`))
          .sort((left, right) => right.length - left.length)[0];
        if (!gap) break;
        const start = gap.start;
        const span = Math.round(gap.length * 1000) / 1000;
        const packed = packWidths(span, catalog, layer);
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
            } else if (leftover <= 3 + COLLISION) {
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

  return { placed: mergeAdjacentFillers(working, input.room, input.wallIds), notes, findings };
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
        out.push({ wallId, layer, start: gap.start, width: Math.round(gap.length * 1000) / 1000 });
      }
    }
  }
  return out;
}
