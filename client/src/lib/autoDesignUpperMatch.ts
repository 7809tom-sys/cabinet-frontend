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

type CornerLeg = { start: number; end: number; corner: Span; upper: Span };

/**
 * The strip of a base corner that the wall corner above it does not cover, on
 * the side facing a run of straight bases (ERB33's 33" leg vs WER2430's 24" leg
 * leaves 9"). Empty when the legs already agree.
 */
function cornerLegsFor(chainStart: number, chainEnd: number, cornerBases: readonly Span[], cornerUppers: readonly Span[]): CornerLeg[] {
  const legs: CornerLeg[] = [];
  for (const corner of cornerBases) {
    const upper = cornerUppers.find((entry) => entry.start >= corner.start - ADJACENT_IN && entry.end <= corner.end + ADJACENT_IN);
    if (!upper) continue;
    if (Math.abs(corner.start - chainEnd) <= ADJACENT_IN && upper.start > chainEnd + ADJACENT_IN) {
      legs.push({ start: chainEnd, end: upper.start, corner, upper });
    } else if (Math.abs(corner.end - chainStart) <= ADJACENT_IN && upper.end < chainStart - ADJACENT_IN) {
      legs.push({ start: upper.end, end: chainStart, corner, upper });
    }
  }
  return legs;
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
    const cornerBases = working.filter((item) => item.placement === "base" && cabinetWall(item, room) === wall
      && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)).map(spanOf);
    const cornerUppers = working.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall
      && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)).map(spanOf);
    for (const chain of chains) {
      const baseStart = chain[0]!.start;
      const baseEnd = chain[chain.length - 1]!.end;
      // Corner leg (Tom, Nov 15 2026): a base corner and the wall corner above it
      // can have different legs (ERB33 = 33", WER2430 = 24"). The strip of the
      // base corner the wall corner leaves uncovered is a "leg" that needs its
      // own upper, or every upper beyond it lands 9" off the base beneath it.
      const legs = cornerLegsFor(baseStart, baseEnd, cornerBases, cornerUppers);
      const targets: Span[] = [...legs.map((leg) => ({ item: leg.corner.item, start: leg.start, end: leg.end })), ...chain]
        .sort((a, b) => a.start - b.start);
      const chainStart = targets[0]!.start;
      const chainEnd = targets[targets.length - 1]!.end;
      const above = working.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall)
        .map(spanOf)
        .filter((entry) => entry.start < chainEnd - COLLISION_EPSILON_IN && entry.end > chainStart + COLLISION_EPSILON_IN);
      const uppers = above.filter((entry) => !isFillerItem(entry.item));
      if (!uppers.length) continue; // nothing above (a window, the range bay) is left alone
      const aligned = targets.every((base) => above.some((entry) => !isFillerItem(entry.item)
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
      // A window keeps WALL_OPENING_CLEARANCE_IN clear on each side. Tom's rule
      // (Nov 15 2026) is about the PAIRING, any size: every base whose upper slot
      // is clear of the window gets its exact-width upper. Only a base that the
      // window's clearance actually reaches gets the widest catalog upper that
      // still fits between the clearance and that base's far seam, so the seams
      // past it keep lining up with the bases below (B30 + B12 beside a window:
      // W2730 + W1230, not W3030 + W0930).
      const windows = input.openings.filter((opening) => opening.side === wall && opening.kind === "window"
        && opening.offset - WALL_OPENING_CLEARANCE_IN < chainEnd - COLLISION_EPSILON_IN
        && opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN > chainStart + COLLISION_EPSILON_IN);
      const slotFor = (base: Span): { start: number; end: number } | null => {
        let start = base.start;
        let end = base.end;
        for (const opening of windows) {
          const blockFrom = opening.offset - WALL_OPENING_CLEARANCE_IN;
          const blockTo = opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN;
          if (blockTo <= start + COLLISION_EPSILON_IN || blockFrom >= end - COLLISION_EPSILON_IN) continue;
          // Keep the side of the base away from the window.
          if (blockFrom <= start + COLLISION_EPSILON_IN) start = Math.max(start, blockTo);
          else if (blockTo >= end - COLLISION_EPSILON_IN) end = Math.min(end, blockFrom);
          else return null; // the window sits inside this base's span: no upper here
        }
        return end - start > COLLISION_EPSILON_IN ? { start, end } : null;
      };
      const depth = mostCommon(uppers.map((entry) => Number(entry.item.depth) || 0)) ?? 12;
      const mountBottom = mostCommon(uppers.map((entry) => entry.item.mountBottom ?? 54)) ?? 54;
      const rows: Array<{ row: DesignCabinet; start: number; base: Span; exact: boolean } | null> = [];
      const missing: string[] = [];
      const missingLegs: Array<{ width: number; corner: string; wallCorner: string }> = [];
      const clipped: string[] = [];
      const pickWidth = (width: number, exact: boolean) => standard
        .filter((candidate) => exact
          ? Math.abs(dim(candidate.width, 0) - width) <= COLLISION_EPSILON_IN
          : dim(candidate.width, 0) <= width + COLLISION_EPSILON_IN)
        .sort((a, b) => (exact ? 0 : dim(b.width, 0) - dim(a.width, 0))
          || Math.abs(dim(a.depth, 0) - depth) - Math.abs(dim(b.depth, 0) - depth)
          || a.masterCode.localeCompare(b.masterCode))[0];
      // Hard fallback (Tom, Nov 18 2026, 10:28 / 10:34 AM CT): a 42" base with no
      // 42" upper at the selected height gets two 21" uppers at that height
      // (W2130 at 30, W2142 at 42), looked up in the catalog, never invented.
      // Compatible with the v2 splitExact pair; this pass runs after the last
      // repack and gap re-tile, so the pair is the final word over that base.
      const pairFor42 = (width: number): DesignCabinet | null => {
        if (Math.abs(width - 42) > COLLISION_EPSILON_IN || pickWidth(42, true)) return null;
        return pickWidth(21, true) ?? null;
      };
      const missing21: string[] = [];
      for (const base of targets) {
        const baseWidth = base.end - base.start;
        const leg = legs.find((entry) => Math.abs(entry.start - base.start) <= COLLISION_EPSILON_IN && Math.abs(entry.end - base.end) <= COLLISION_EPSILON_IN);
        const slot = windows.length ? slotFor(base) : { start: base.start, end: base.end };
        if (!slot) { rows.push(null); continue; }
        const exact = Math.abs((slot.end - slot.start) - baseWidth) <= COLLISION_EPSILON_IN;
        if (exact && !leg && Math.abs(baseWidth - 42) <= COLLISION_EPSILON_IN && !pickWidth(42, true)) {
          const half = pairFor42(baseWidth);
          if (half) {
            rows.push({ row: half, start: base.start, base, exact });
            rows.push({ row: half, start: base.start + dim(half.width, 0), base, exact });
          } else {
            missing21.push(base.item.masterCode);
            rows.push(null);
          }
          continue;
        }
        // A corner leg takes an exact-width upper or nothing (never a narrowed box).
        const row = leg && !exact ? undefined : pickWidth(slot.end - slot.start, exact);
        if (!row) {
          if (leg) {
            // A leg within the seam-filler max is left to the gap closer.
            if (baseWidth > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN && exact) {
              missingLegs.push({ width: baseWidth, corner: leg.corner.item.masterCode, wallCorner: leg.upper.item.masterCode });
            }
          } else if (exact) missing.push(`${formatInches(baseWidth)}`);
          rows.push(null);
          continue;
        }
        // A clipped slot hangs its upper on the base's far seam (away from the window).
        const width = dim(row.width, 0);
        const start = exact ? base.start : (slot.start > base.start + COLLISION_EPSILON_IN ? base.end - width : base.start);
        if (!exact) clipped.push(`${row.masterCode} over ${base.item.masterCode}`);
        rows.push({ row, start, base, exact });
      }
      if (missingLegs.length) {
        for (const leg of missingLegs) {
          findings.push({
            ruleId: "uppers-match-bases",
            code: "corner-leg-not-matched",
            severity: "warning",
            title: `Uppers beside ${leg.wallCorner} do not line up with the bases on ${wall}`,
            detail: `${leg.corner} reaches ${formatInches(leg.width)} farther along the wall than ${leg.wallCorner}, and this line sells no ${formatInches(leg.width)} wide wall cabinet at ${formatInches(height)} or a filler that wide, so the wall cabinets above ${label} were kept.`,
            cabinetUid: chain[0]!.item.uid,
            cabinetCode: chain[0]!.item.masterCode,
          });
        }
        continue;
      }
      for (const code of missing21) {
        findings.push({
          ruleId: "uppers-match-bases",
          code: "b42-two-21-not-met",
          severity: "warning",
          title: `Two 21″ uppers over ${code} couldn't be met`,
          detail: `This line sells no 42″ and no 21″ wide wall cabinet at ${formatInches(height)}, so the two-21s rule over ${code} could not be applied; no SKU was invented.`,
          cabinetUid: chain[0]!.item.uid,
          cabinetCode: code,
        });
      }
      if (missing21.length) continue;
      if (missing.length) {
        skip(`This line sells no ${missing.join(", ")} wide wall cabinet at ${formatInches(height)}, so the wall cabinets above ${label} do not match the base width.`);
        continue;
      }
      if (rows.every((entry) => entry == null)) continue;
      // Nothing to gain when the uppers already sit exactly where these would.
      const planned = rows.filter((entry): entry is NonNullable<typeof entry> => entry != null);
      const alreadyThere = planned.length === uppers.length && planned.every((entry) => uppers.some((upper) => upper.item.masterCode === entry.row.masterCode
        && Math.abs(upper.start - entry.start) <= ADJACENT_IN));
      if (alreadyThere) continue;
      const removeUids = new Set(above.map((entry) => entry.item.uid));
      const without = working.filter((item) => !removeUids.has(item.uid));
      const replacements: PlacedCabinet[] = planned.map(({ row, start, base }) => {
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
          ...wallPlacementAt(start, width, rowDepth, wall as WallSide, room),
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
      for (const leg of legs) {
        if (!planned.some((entry) => Math.abs(entry.start - leg.start) <= ADJACENT_IN)) continue;
        notes.push(`${leg.corner.item.masterCode} reaches ${formatInches(leg.end - leg.start)} past ${leg.upper.item.masterCode}; that leg got its own upper so the uppers line up over the bases on ${wall}.`);
      }
      if (clipped.length) {
        findings.push({
          ruleId: "uppers-match-bases",
          code: "upper-narrowed-for-window",
          severity: "info",
          title: `Window clearance narrowed an upper over ${label}`,
          detail: `The window keeps ${formatInches(WALL_OPENING_CLEARANCE_IN)} clear, so ${clipped.join(", ")} is the widest stock box that fits; every other upper matches its base.`,
          cabinetUid: chain[0]!.item.uid,
          cabinetCode: chain[0]!.item.masterCode,
        });
      }
    }
  }
  return { placed: working, notes, findings };
}
