/**
 * Owner rule (Tom, Nov 14 2026): the wall cabinet over a base matches the base
 * width when the line sells that width at the selected height (B27 -> W27).
 *
 * The 15-rule repack re-tiles the base level and the wall level as two
 * independent runs, so a B27 + B12 pair could come back with a W30 + W9 (or a
 * W24 plus fillers) above it. This pass re-projects the ordinary uppers over
 * each run of straight bases, one matching catalog width per base. A run is
 * left as it is, with a visible reason, when the line has no matching width,
 * a window's 3" clearance or another wall item sits in the way.
 */
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import {
  COLLISION_EPSILON_IN, WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements, cabinetWall, dim, footprintDepth, formatInches,
  isCornerCabinet, isFillerItem, isPanelItem, isSinkBaseCabinet, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

const ADJACENT_IN = 0.25;
const HEIGHT_MATCH_IN = 0.5;

type Span = { item: PlacedCabinet; start: number; end: number };

function isStraightBase(item: PlacedCabinet): boolean {
  return item.placement === "base" && !isSinkBaseCabinet(item) && !isFillerItem(item) && !isPanelItem(item)
    && !isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null);
}

function isPlainUpper(item: PlacedCabinet, heightIn: number): boolean {
  if (item.placement !== "wall") return false;
  if (isFillerItem(item)) return true;
  if (isPanelItem(item) || isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)) return false;
  return /^W-?\d/i.test(item.masterCode) && Math.abs((Number(item.height) || 0) - heightIn) <= HEIGHT_MATCH_IN;
}

function mostCommon(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => { if (count > bestCount) { best = value; bestCount = count; } });
  return best;
}

/** True when [from, to] is fully covered by the given spans (within a hair). */
function isCovered(from: number, to: number, spans: readonly Span[]): boolean {
  let reach = from;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start > reach + ADJACENT_IN) break;
    reach = Math.max(reach, span.end);
    if (reach >= to - ADJACENT_IN) return true;
  }
  return reach >= to - ADJACENT_IN;
}

export function matchUppersToBases(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallCatalog: readonly DesignCabinet[];
  /** The real catalog height the upper run used (30.25 for a frameless 30" class). Null = no uppers. */
  heightIn: number | null;
  styleId: number | null;
  makeUid: () => string;
}): { placed: PlacedCabinet[]; notes: string[]; findings: DesignerReviewFinding[] } {
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  let working = [...input.placed];
  const height = input.heightIn;
  if (height == null) return { placed: working, notes, findings };
  const standard = autoDesignStandardUpperRows(input.wallCatalog, height);
  if (!standard.length) return { placed: working, notes, findings };
  const { room } = input;
  const walls = Array.from(new Set(working.filter(isStraightBase).map((item) => cabinetWall(item, room)).filter(Boolean))) as string[];
  for (const wall of walls) {
    const spanOf = (item: PlacedCabinet): Span => {
      const start = wallRunOffset(item, wall, room);
      return { item, start, end: start + wallRunSpan(item, wall, room) };
    };
    const bases = working.filter((item) => isStraightBase(item) && cabinetWall(item, room) === wall).map(spanOf).sort((a, b) => a.start - b.start);
    // Runs of straight bases that butt (within a hair) against each other.
    const chains: Span[][] = [];
    for (const base of bases) {
      const last = chains[chains.length - 1];
      if (last && base.start - last[last.length - 1]!.end <= ADJACENT_IN) last.push(base);
      else chains.push([base]);
    }
    for (const chain of chains) {
      const chainStart = chain[0]!.start;
      const chainEnd = chain[chain.length - 1]!.end;
      const above = working.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall)
        .map(spanOf)
        .filter((entry) => entry.start < chainEnd - COLLISION_EPSILON_IN && entry.end > chainStart + COLLISION_EPSILON_IN);
      const uppers = above.filter((entry) => !isFillerItem(entry.item));
      if (!uppers.length) continue; // nothing above (a window, the range bay) is left alone
      const aligned = chain.every((base) => above.some((entry) => !isFillerItem(entry.item)
        && Math.abs(entry.start - base.start) <= ADJACENT_IN && Math.abs((entry.end - entry.start) - (base.end - base.start)) <= ADJACENT_IN))
        && above.every((entry) => !isFillerItem(entry.item));
      if (aligned) continue;
      const label = chain.map((base) => base.item.masterCode).join(" + ");
      const skip = (detail: string) => findings.push({
        ruleId: "uppers-match-bases",
        code: "upper-width-not-matched",
        severity: "info",
        title: `Wall cabinets over ${label} were kept`,
        detail,
        cabinetUid: chain[0]!.item.uid,
        cabinetCode: chain[0]!.item.masterCode,
      });
      if (above.some((entry) => !isPlainUpper(entry.item, height))) {
        continue; // a bridge, corner upper, hood or panel owns part of this span
      }
      // An upper may reach past this run of bases only over a spot something
      // else already fills (a tall panel beside the refrigerator, say). If it
      // reaches over an appliance, a sink base or a neighbouring run, re-tiling
      // only the bases' span would leave the rest of that upper's spot open.
      const aboveUids = new Set(above.map((entry) => entry.item.uid));
      const coverers = working
        .filter((item) => !aboveUids.has(item.uid) && (item.placement === "wall" || item.placement === "tall") && cabinetWall(item, room) === wall)
        .map(spanOf);
      const overhangs: Array<[number, number]> = [];
      for (const entry of above) {
        if (entry.start < chainStart - ADJACENT_IN) overhangs.push([entry.start, chainStart]);
        if (entry.end > chainEnd + ADJACENT_IN) overhangs.push([chainEnd, entry.end]);
      }
      // A sliver up to seam_filler_max_in is left for the gap closer that
      // runs after this pass; anything wider keeps the existing uppers.
      if (overhangs.some(([from, to]) => to - from > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN && !isCovered(from, to, coverers))) continue;
      const window = input.openings.find((opening) => opening.side === wall && opening.kind === "window"
        && opening.offset - WALL_OPENING_CLEARANCE_IN < chainEnd - COLLISION_EPSILON_IN
        && opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN > chainStart + COLLISION_EPSILON_IN);
      if (window) {
        skip(`A window keeps ${formatInches(WALL_OPENING_CLEARANCE_IN)} clear on each side, so the wall cabinets above ${label} cannot match the base width.`);
        continue;
      }
      const depth = mostCommon(uppers.map((entry) => Number(entry.item.depth) || 0)) ?? 12;
      const mountBottom = mostCommon(uppers.map((entry) => entry.item.mountBottom ?? 54)) ?? 54;
      const rows: DesignCabinet[] = [];
      const missing: string[] = [];
      for (const base of chain) {
        const width = base.end - base.start;
        const row = standard
          .filter((candidate) => Math.abs(dim(candidate.width, 0) - width) <= COLLISION_EPSILON_IN)
          .sort((a, b) => Math.abs(dim(a.depth, 0) - depth) - Math.abs(dim(b.depth, 0) - depth) || a.masterCode.localeCompare(b.masterCode))[0];
        if (row) rows.push(row);
        else missing.push(`${formatInches(width)}`);
      }
      if (missing.length) {
        skip(`This line sells no ${missing.join(", ")} wide wall cabinet at ${formatInches(height)}, so the wall cabinets above ${label} do not match the base width.`);
        continue;
      }
      const removeUids = new Set(above.map((entry) => entry.item.uid));
      const without = working.filter((item) => !removeUids.has(item.uid));
      const replacements: PlacedCabinet[] = chain.map((base, index) => {
        const row = rows[index]!;
        const width = dim(row.width, 0);
        const rowDepth = footprintDepth(row);
        const original = uppers.find((entry) => entry.start < base.end && entry.end > base.start)?.item ?? uppers[0]!.item;
        return {
          uid: input.makeUid(),
          cabinetId: row.id,
          masterCode: row.masterCode,
          description: row.description,
          category: row.category,
          subCategory: row.subCategory,
          placement: "wall",
          ...wallPlacementAt(base.start, width, rowDepth, wall as WallSide, room),
          width,
          depth: rowDepth,
          height: dim(row.height, height),
          mountBottom: original.mountBottom ?? mountBottom,
          numberOfDoors: row.numberOfDoors,
          numberOfDrawers: row.numberOfDrawers,
          catalogImageUrl: row.catalogImageUrl ?? null,
          constructionMethod: row.constructionMethod ?? null,
          ...(original.glassDoor ? { glassDoor: true } : {}),
          styleId: input.styleId,
        } as PlacedCabinet;
      });
      const accepted = appendCollisionFreePlacements(without, replacements, room);
      if (accepted.rejected.length > 0) {
        skip(`A matching wall cabinet over ${label} would collide with another wall item, so the existing wall cabinets were kept.`);
        continue;
      }
      working = accepted.placed;
      notes.push(`Wall cabinets over ${label} now match the bases: ${replacements.map((item) => item.masterCode).join(" + ")} (was ${uppers.map((entry) => entry.item.masterCode).join(" + ")}${above.length > uppers.length ? " and filler" : ""}).`);
    }
  }
  return { placed: working, notes, findings };
}
