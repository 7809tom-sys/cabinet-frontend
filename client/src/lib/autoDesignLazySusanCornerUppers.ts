/**
 * Lazy Susan corner uppers (Tom, Nov 18 2026, voice 10:28-10:32 AM CT). Hard rules:
 *
 *  - A 33" lazy Susan base (ERB33 or any catalog lazy Susan 33" wide) gets the
 *    line's DCW24<h> diagonal corner upper with a 9" W09<h> on each leg
 *    (24 + 9 = 33), at the selected upper height. When "Glass cabinets above"
 *    is selected the 9s are skipped (the line sells no 9" glass stacker): the
 *    leg is filled from the diagonal's edge with 12" or wider uppers that have
 *    a same-width glass stacker, so nothing is left blank beside the corner.
 *  - A 36" lazy Susan base (ERB36 or any 36" lazy Susan) gets DCW24<h> with a
 *    12" W12<h> on each leg (24 + 12 = 36).
 *  - After the flank, any open wall span on that leg (to the next upper,
 *    appliance, tall, window or the wall end) is filled with catalog wall
 *    cabinets at the selected height: one exact width first, otherwise the
 *    fewest pieces; never a 39" and never a 9" here. A remainder no cabinet
 *    closes is left beside the corner for the line's filler; a span nothing
 *    fits is named.
 *
 * Nothing is invented: a missing DCW24<h> or flank width is a "couldn't be met"
 * line and no substitute is placed. The pass runs after the last upper re-tile
 * (repack, gap closers, matchUppersToBases), so the pieces it places are final.
 */
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { autoDesignGlassStackerCatalog } from "./autoDesignFormOptions";
import { autoDesignCornerFamily } from "./autoDesignCornerStage";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import { matchUppersToBases } from "./autoDesignUpperMatch";
import {
  COLLISION_EPSILON_IN, WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements, cabinetWall, dim, elevationBox, footprintDepth,
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

/** The 33" / 36" lazy Susan width class of a base corner, or null. */
export function lazySusanCornerClass(item: Pick<PlacedCabinet, "masterCode" | "description" | "cornerType" | "subCategory" | "placement" | "width">): 33 | 36 | null {
  if (item.placement !== "base") return null;
  if (autoDesignCornerFamily(item as never) !== "lazy-susan") return null;
  const width = dim(item.width as never, 0);
  if (Math.abs(width - 33) <= 0.3) return 33;
  if (Math.abs(width - 36) <= 0.3) return 36;
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

/**
 * Fewest catalog pieces that close `span` exactly; otherwise the fewest that
 * leave a remainder no wider than the line's filler cap. Widths in 1/8".
 */
export function tileUpperSpan(span: number, widths: readonly number[], fillerMaxIn: number): { pieces: number[]; remainder: number } | null {
  const unit = 8;
  const total = Math.floor(span * unit + 1e-6);
  const sizes = Array.from(new Set(widths.map((width) => Math.round(width * unit)).filter((value) => value > 0))).sort((a, b) => b - a);
  if (total <= 0 || !sizes.length) return null;
  const best: Array<number | null> = new Array(total + 1).fill(null);
  const pick: number[] = new Array(total + 1).fill(0);
  best[0] = 0;
  for (let reach = 1; reach <= total; reach += 1) {
    for (const size of sizes) {
      if (size > reach) continue;
      const prev = best[reach - size];
      if (prev == null) continue;
      if (best[reach] == null || prev + 1 < best[reach]!) { best[reach] = prev + 1; pick[reach] = size; }
    }
  }
  const maxRemainder = Math.floor(fillerMaxIn * unit + 1e-6);
  for (let remainder = 0; remainder <= Math.min(maxRemainder, total); remainder += 1) {
    const reach = total - remainder;
    if (reach <= 0 || best[reach] == null) continue;
    const pieces: number[] = [];
    let at = reach;
    while (at > 0) { pieces.push(pick[at]! / unit); at -= pick[at]!; }
    pieces.sort((a, b) => b - a);
    return { pieces, remainder: span - reach / unit };
  }
  return null;
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
  const stackerWidths = new Set(autoDesignGlassStackerCatalog(input.wallCatalog).map((row) => Math.round(dim(row.width, 0) * 8) / 8));
  // Leg fill widths: never 39" (Tom) and never 9" (the 9 is only the 33" corner flank).
  const fillWidths = Array.from(new Set(standard.map((row) => dim(row.width, 0))))
    .filter((width) => Math.abs(width - 39) > 0.05 && Math.abs(width - 9) > 0.05)
    .filter((width) => !input.glass || stackerWidths.has(Math.round(width * 8) / 8));
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
    const flankWidth = size === 33 ? 9 : 12;
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
    const rematched = matchUppersToBases({ placed: working, room, openings: input.openings, wallCatalog: input.wallCatalog, heightIn: height, styleId: input.styleId, makeUid: input.makeUid, glass: input.glass });
    working = rematched.placed;
    notes.push(...rematched.notes);
  }

  // Open-span fill after the corner flank (Tom, 10:30 AM CT): fill each leg's open
  // run from the flank to the next upper, appliance, tall, window or the wall end.
  for (const leg of fillLegs) {
    const top = leg.mountBottom + height;
    const length = wallLength(leg.wall, room);
    const dir = leg.atStart ? 1 : -1;
    const lockedB42 = (item: PlacedCabinet) => Math.abs(dim(item.width as never, 0) - 21) <= 0.05 && working.some((base) => base.placement === "base"
      && base.masterCode === "B42" && cabinetWall(base, room) === leg.wall
      && (() => { const b = spanOn(base, leg.wall, room); const s = spanOn(item, leg.wall, room); return s.start >= b.start - ADJ && s.end <= b.end + ADJ; })());
    const onWall = working.filter((item) => item.placement !== "base" && (cabinetWall(item, room) === leg.wall || item.uid === leg.cornerUpperUid)
      && !isStacker(item) && overlapsBand(item, room, leg.mountBottom, top));
    // Glass leg: the uppers that follow the diagonal are re-tiled from its edge so the
    // skipped 9" is absorbed into a glass-capable width (never a blank 9" gap).
    if (input.glass && lazySusanCornerClass(leg.corner) === 33) {
      const ahead = onWall.map((item) => ({ item, ...spanOn(item, leg.wall, room) }))
        .filter((entry) => dir > 0 ? entry.end > leg.from + ADJ : entry.start < leg.from - ADJ)
        .sort((a, b) => dir > 0 ? a.start - b.start : b.end - a.end);
      const clear = new Set<string>();
      for (const entry of ahead) {
        if (!isPlainUpper(entry.item, height) || lockedUids.includes(entry.item.uid) || lockedB42(entry.item)) break;
        clear.add(entry.item.uid);
      }
      if (clear.size) {
        working = working.filter((item) => !clear.has(item.uid) && !(item.stackedOnCabinetUid && clear.has(item.stackedOnCabinetUid)));
        changed = true;
      }
    }
    const blockers: Array<{ start: number; end: number }> = working
      .filter((item) => item.placement !== "base" && (cabinetWall(item, room) === leg.wall || item.uid === leg.cornerUpperUid) && !isStacker(item)
        && overlapsBand(item, room, leg.mountBottom, top))
      .map((item) => spanOn(item, leg.wall, room));
    for (const opening of input.openings) {
      if (opening.side !== leg.wall) continue;
      const sill = Number((opening as { sill?: number }).sill ?? 0);
      const openTop = sill + Number((opening as { height?: number }).height ?? 0);
      if (opening.kind === "window" && !(sill < top && openTop > leg.mountBottom)) continue;
      blockers.push({ start: opening.offset - WALL_OPENING_CLEARANCE_IN, end: opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN });
    }
    let limit = dir > 0 ? length : 0;
    for (const block of blockers) {
      if (dir > 0 && block.end > leg.from + ADJ && block.start >= leg.from - ADJ) limit = Math.min(limit, block.start);
      if (dir > 0 && block.start < leg.from - ADJ && block.end > leg.from + ADJ) limit = leg.from; // already covered
      if (dir < 0 && block.start < leg.from - ADJ && block.end <= leg.from + ADJ) limit = Math.max(limit, block.end);
      if (dir < 0 && block.end > leg.from + ADJ && block.start < leg.from - ADJ) limit = leg.from;
    }
    const open = Math.abs(limit - leg.from);
    if (open <= ADJ) continue;
    const plan = tileUpperSpan(open, fillWidths, autoDesignFillerMaxIn());
    if (!plan) {
      unmet(`${formatInches(open)} open beside the ${leg.corner.masterCode} corner on ${leg.wall}`, `No ${input.glass ? "glass-capable " : ""}wall cabinet combination at ${formatInches(height)} in this line fits the ${formatInches(open)} open span after the corner, and a filler that wide is not allowed, so it is reported instead of left silently blank.`, leg.corner);
      continue;
    }
    // Pieces go from the far end back toward the corner, so any remainder sits beside
    // the corner flank for the filler. With glass the first cabinet must start at the
    // diagonal (it carries a stacker; a filler cannot), so the pieces start there.
    const rows = plan.pieces.map((width) => wallRow(standard, width, leg.depth)!);
    const fromCorner = input.glass && plan.remainder > ADJ;
    const additions: PlacedCabinet[] = [];
    let cursor = fromCorner ? leg.from : limit;
    const toward = fromCorner ? dir : -dir;
    for (const row of rows) {
      const width = dim(row.width, 0);
      const along = toward > 0 ? cursor : cursor - width;
      additions.push(placeRow(row, along, leg.wall, room, leg.mountBottom, height, input.styleId, input.makeUid(), "Corner rule: open span after the diagonal corner filled from the catalog"));
      cursor += toward * width;
    }
    const accepted = appendCollisionFreePlacements(working, additions, room);
    if (accepted.rejected.length) {
      unmet(`${formatInches(open)} open beside the ${leg.corner.masterCode} corner on ${leg.wall}`, `${rows.map((row) => row.masterCode).join(" + ")} would collide with another item, so the span was not filled.`, leg.corner);
      continue;
    }
    working = accepted.placed;
    lockedUids.push(...additions.map((item) => item.uid));
    changed = true;
    notes.push(`Open ${formatInches(open)} after the ${leg.corner.masterCode} corner on ${leg.wall} filled with ${rows.map((row) => row.masterCode).join(" + ")}${plan.remainder > ADJ ? ` and ${formatInches(plan.remainder)} left ${fromCorner ? "at the far end (glass: the cabinet beside the diagonal carries a stacker)" : "beside the corner"} for the filler` : ""}.`);
  }
  return done();
}
