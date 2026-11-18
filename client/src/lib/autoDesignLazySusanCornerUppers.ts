/**
 * Lazy Susan corner uppers (Tom, Nov 18 2026, voice 10:28-10:32 AM CT). Hard rules:
 *
 *  - A 33" lazy Susan base (ERB33 or any catalog lazy Susan 33" wide) gets the
 *    line's DCW24<h> diagonal corner upper with a 9" W09<h> on each leg
 *    (24 + 9 = 33), at the selected upper height. When "Glass cabinets above"
 *    is selected the 9s are skipped (the line sells no 9" glass stacker).
 *
 * Nothing is invented: a missing DCW24<h> or flank width is a "couldn't be met"
 * line and no substitute is placed. The pass runs after the last upper re-tile
 * (repack, gap closers, matchUppersToBases), so the pieces it places are final.
 */
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { autoDesignCornerFamily } from "./autoDesignCornerStage";
import { matchUppersToBases } from "./autoDesignUpperMatch";
import {
  COLLISION_EPSILON_IN, appendCollisionFreePlacements, cabinetWall, dim, elevationBox, footprintDepth,
  formatInches, isCornerCabinet, isFillerItem, isPanelItem, isStacker, wallLength, wallPlacementAt, wallRunFrame, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

const SAME_HEIGHT_IN = 0.5;
const ADJ = 0.25;
const WALL_IDS = ["top", "right", "bottom", "left"] as const;

export type LazySusanCornerUpperInput = {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallCatalog: readonly DesignCabinet[];
  /** The real catalog height the upper run used. Null = no uppers in this design. */
  heightIn: number | null;
  glass: boolean;
  styleId: number | null;
  makeUid: () => string;
};

export type LazySusanCornerUpperResult = {
  placed: PlacedCabinet[];
  notes: string[];
  findings: DesignerReviewFinding[];
  /** Pieces this pass seated (corner flanks and leg fills). Later passes must keep them. */
  lockedUids: string[];
  changed: boolean;
};

export type LazySusanCornerLeg = { wall: string; atStart: boolean; cornerFrom: number; cornerTo: number };

function sameHeight(value: unknown, height: number): boolean {
  return Math.abs(dim(value == null ? null : String(value), 0) - height) <= SAME_HEIGHT_IN;
}

function spanOn(item: PlacedCabinet, wall: string, room: RoomData): { start: number; end: number } {
  const start = wallRunOffset(item, wall, room);
  return { start, end: start + wallRunSpan(item, wall, room) };
}

/** The 33" lazy Susan width class of a base corner, or null. */
export function lazySusanCornerClass(item: Pick<PlacedCabinet, "masterCode" | "description" | "cornerType" | "subCategory" | "placement" | "width">): 33 | null {
  if (item.placement !== "base") return null;
  if (autoDesignCornerFamily(item as never) !== "lazy-susan") return null;
  const width = dim(item.width as never, 0);
  if (Math.abs(width - 33) <= 0.3) return 33;
  return null;
}

/** Both legs of a base corner: its own wall and the wall that meets it at the corner end. */
export function lazySusanCornerLegs(corner: PlacedCabinet, room: RoomData): LazySusanCornerLeg[] {
  const own = cabinetWall(corner, room);
  const frame = wallRunFrame(own, room);
  if (!frame) return [];
  const span = spanOn(corner, own, room);
  const length = wallLength(own, room);
  const atStart = span.start <= length - span.end;
  const point = atStart ? frame.start : frame.end;
  const legs: LazySusanCornerLeg[] = [{ wall: own, atStart, cornerFrom: span.start, cornerTo: span.end }];
  for (const other of WALL_IDS) {
    if (other === own) continue;
    const otherFrame = wallRunFrame(other, room);
    if (!otherFrame) continue;
    const startHits = Math.hypot(otherFrame.start.x - point.x, otherFrame.start.y - point.y) <= 1;
    const endHits = Math.hypot(otherFrame.end.x - point.x, otherFrame.end.y - point.y) <= 1;
    if (!startHits && !endHits) continue;
    const otherSpan = spanOn(corner, other, room);
    legs.push({ wall: other, atStart: startHits, cornerFrom: otherSpan.start, cornerTo: otherSpan.end });
    break;
  }
  return legs;
}

/** An ordinary upper at the design height (or a wall filler) that this pass may re-tile. */
function isPlainUpper(item: PlacedCabinet, height: number): boolean {
  if (item.placement !== "wall" || isStacker(item) || isPanelItem(item)) return false;
  if (isFillerItem(item)) return true;
  if (isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)) return false;
  return /^W-?\d/i.test(item.masterCode) && sameHeight(item.height, height);
}

function overlapsBand(item: PlacedCabinet, room: RoomData, bottom: number, top: number): boolean {
  const box = elevationBox(item, room);
  return box.bottom < top - COLLISION_EPSILON_IN && box.bottom + box.height > bottom + COLLISION_EPSILON_IN;
}

function wallRow(catalog: readonly DesignCabinet[], width: number, depth: number): DesignCabinet | undefined {
  return catalog
    .filter((row) => Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN)
    .sort((a, b) => Math.abs(dim(a.depth, 0) - depth) - Math.abs(dim(b.depth, 0) - depth) || a.masterCode.localeCompare(b.masterCode))[0];
}

function placeRow(row: DesignCabinet, along: number, wall: string, room: RoomData, mountBottom: number, height: number, styleId: number | null, uid: string, reason: string): PlacedCabinet {
  const width = dim(row.width, 0);
  const depth = footprintDepth(row);
  return {
    uid,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    placement: "wall",
    ...wallPlacementAt(along, width, depth, wall as WallSide, room),
    width,
    depth,
    height: dim(row.height, height),
    mountBottom,
    numberOfDoors: row.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? null,
    constructionMethod: row.constructionMethod ?? null,
    styleId,
    autoPlacedReason: reason,
  } as PlacedCabinet;
}

export function applyLazySusanCornerUppers(input: LazySusanCornerUpperInput): LazySusanCornerUpperResult {
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const lockedUids: string[] = [];
  let working = [...input.placed];
  let changed = false;
  const height = input.heightIn;
  const { room } = input;
  const done = (): LazySusanCornerUpperResult => ({ placed: working, notes, findings, lockedUids, changed });
  if (height == null) return done();
  const corners = working.filter((item) => lazySusanCornerClass(item) != null);
  if (!corners.length) return done();
  const standard = autoDesignStandardUpperRows(input.wallCatalog, height);
  const diagonalRows = input.wallCatalog.filter((row) => row.placement === "wall" && /^DCW24/i.test(row.masterCode)
    && !/GD$/i.test(row.masterCode) && sameHeight(row.height, height));
  const unmet = (title: string, detail: string, corner: PlacedCabinet) => findings.push({
    ruleId: "lazy-susan-corner-uppers",
    code: "lazy-susan-corner-uppers-not-met",
    severity: "warning",
    title,
    detail,
    cabinetUid: corner.uid,
    cabinetCode: corner.masterCode,
  });
  const fillLegs: Array<{ corner: PlacedCabinet; wall: string; atStart: boolean; from: number; mountBottom: number; depth: number; cornerUpperUid: string }> = [];

  for (const corner of corners) {
    const size = lazySusanCornerClass(corner)!;
    const legs = lazySusanCornerLegs(corner, room);
    if (legs.length < 2) continue;
    const cornerWall = cabinetWall(corner, room);
    const ownSpan = spanOn(corner, cornerWall, room);
    const upper = working.find((item) => item.placement === "wall" && !isStacker(item)
      && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
      && (() => { const s = spanOn(item, cornerWall, room); return s.start < ownSpan.end - ADJ && s.end > ownSpan.start + ADJ; })()
      && (() => { const s = spanOn(item, legs[1]!.wall, room); return s.start < legs[1]!.cornerTo - ADJ && s.end > legs[1]!.cornerFrom + ADJ; })());
    if (!upper) continue; // no corner upper here (a window or an open corner): nothing to flank
    const diagonal = wallRow(diagonalRows, 24, 12);
    if (!diagonal) {
      unmet(`${corner.masterCode}: no ${formatInches(height)} diagonal corner upper`, `The rule puts a DCW24${Math.round(height)} diagonal corner upper over a ${size}″ lazy Susan, and this line sells none at ${formatInches(height)}, so the corner upper was not changed and no SKU was substituted.`, corner);
      continue;
    }
    let cornerUpper = upper;
    if (upper.masterCode !== diagonal.masterCode) {
      if (Math.abs(dim(upper.width as never, 0) - 24) > 0.3) {
        unmet(`${corner.masterCode}: corner upper is not a diagonal`, `${upper.masterCode} sits over the ${size}″ lazy Susan and is not 24″ on the leg, so it was not swapped for ${diagonal.masterCode}.`, corner);
        continue;
      }
      const swapped = { ...upper, uid: input.makeUid(), cabinetId: diagonal.id, masterCode: diagonal.masterCode, description: diagonal.description,
        category: diagonal.category, subCategory: diagonal.subCategory, height: dim(diagonal.height, height), catalogImageUrl: diagonal.catalogImageUrl ?? null } as PlacedCabinet;
      working = working.filter((item) => item.uid !== upper.uid && item.stackedOnCabinetUid !== upper.uid).concat(swapped);
      notes.push(`${upper.masterCode} over ${corner.masterCode} became ${diagonal.masterCode} (diagonal corner rule).`);
      cornerUpper = swapped;
      changed = true;
    }
    lockedUids.push(cornerUpper.uid);
    const mountBottom = cornerUpper.mountBottom ?? 54;
    const top = mountBottom + height;
    const flankWidth = 9;
    const skipFlank = size === 33 && input.glass;
    const flankRow = skipFlank ? undefined : wallRow(standard, flankWidth, 12);
    if (!skipFlank && !flankRow) {
      unmet(`${corner.masterCode}: no ${flankWidth}″ wall cabinet beside ${diagonal.masterCode}`, `The rule flanks ${diagonal.masterCode} with a ${flankWidth}″ wall cabinet on each leg, and this line sells no ${flankWidth}″ wide wall cabinet at ${formatInches(height)}, so no flank was placed and nothing was substituted.`, corner);
      continue;
    }
    for (const leg of legs) {
      const upperSpan = spanOn(cornerUpper, leg.wall, room);
      const edge = leg.atStart ? upperSpan.end : upperSpan.start;
      if (skipFlank) {
        // Glass: the 9" strip is not left blank; the fill starts at the diagonal's edge.
        fillLegs.push({ corner, wall: leg.wall, atStart: leg.atStart, from: edge, mountBottom, depth: dim(cornerUpper.depth as never, 12) || 12, cornerUpperUid: cornerUpper.uid });
        continue;
      }
      const from = leg.atStart ? edge : edge - flankWidth;
      const to = from + flankWidth;
      const existing = working.find((item) => item.placement === "wall" && cabinetWall(item, room) === leg.wall
        && item.masterCode === flankRow!.masterCode && (() => { const s = spanOn(item, leg.wall, room); return Math.abs(s.start - from) <= ADJ; })());
      if (existing) {
        lockedUids.push(existing.uid);
      } else {
        const clashes = working.filter((item) => item.uid !== cornerUpper.uid && cabinetWall(item, room) === leg.wall && item.placement !== "base"
          && overlapsBand(item, room, mountBottom, top)
          && (() => { const s = spanOn(item, leg.wall, room); return s.start < to - COLLISION_EPSILON_IN && s.end > from + COLLISION_EPSILON_IN; })());
        const blocking = clashes.filter((item) => !isPlainUpper(item, height) || lockedUids.includes(item.uid));
        if (blocking.length) {
          unmet(`${corner.masterCode}: ${flankRow!.masterCode} could not be placed beside ${diagonal.masterCode}`, `${blocking.map((item) => item.masterCode).join(", ")} already sits where the ${flankWidth}″ flank goes on ${leg.wall}.`, corner);
          continue;
        }
        const removed = new Set(clashes.map((item) => item.uid));
        const without = working.filter((item) => !removed.has(item.uid) && !(item.stackedOnCabinetUid && removed.has(item.stackedOnCabinetUid)));
        const flank = placeRow(flankRow!, from, leg.wall, room, mountBottom, height, input.styleId, input.makeUid(), `Corner rule: ${flankWidth}″ wall cabinet beside the diagonal over a ${size}″ lazy Susan`);
        const accepted = appendCollisionFreePlacements(without, [flank], room);
        if (accepted.rejected.length) {
          unmet(`${corner.masterCode}: ${flankRow!.masterCode} could not be placed beside ${diagonal.masterCode}`, `The ${flankWidth}″ flank on ${leg.wall} would collide with another item.`, corner);
          continue;
        }
        working = accepted.placed;
        lockedUids.push(flank.uid);
        changed = true;
        notes.push(`${diagonal.masterCode} over ${corner.masterCode} has a ${flankRow!.masterCode} beside it on ${leg.wall} (${24} + ${flankWidth} = ${size}″).`);
      }
      fillLegs.push({ corner, wall: leg.wall, atStart: leg.atStart, from: leg.atStart ? to : from, mountBottom, depth: 12, cornerUpperUid: cornerUpper.uid });
    }
  }

  if (changed) {
    // A flank can cut an old misaligned upper; put the uppers back over the bases first.
    const rematched = matchUppersToBases({ placed: working, room, openings: input.openings, wallCatalog: input.wallCatalog, heightIn: height, styleId: input.styleId, makeUid: input.makeUid });
    working = rematched.placed;
    notes.push(...rematched.notes);
  }

  return done();
}
