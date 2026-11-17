/**
 * Auto Design v2 uppers, glass schedule and flush tops (Tom, Nov 17 2026,
 * voice 2:51-3:10 PM CT, review of the Aero Solstice demo video).
 *
 * - Glass goes ONLY where the glass schedule calls for it, never "randomly
 *   across everything": the bridge over the range / microwave, the
 *   refrigerator cabinet, the 9" cabinet, the diagonal corner, and each pair of
 *   21" uppers over a 42" base. Every other upper stays solid.
 * - All or nothing: when the line cannot fill EVERY scheduled spot with a real
 *   catalog glass stacker (and every solid upper with a real flush-height
 *   row), no glass is placed at all and one report line says why.
 * - Flush tops: every stack on the upper line ends at one height. A glass spot
 *   is the design-height cabinet plus a glass stacker; a solid spot is the same
 *   width one size taller (30" + 12" glass beside a solid 42", top 96" with a
 *   54" bottom). Nothing is pushed back; glass never replaces crown.
 * - Window over the sink: the uppers on each side of the window mirror.
 *
 * Nothing here invents a SKU or a price; every row comes from the selected
 * line's catalog.
 */
import { hasPreference, type AutoDesignIntake } from "./autoDesignFifteenRules";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { autoDesignGlassStackerCatalog, AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN } from "./autoDesignFormOptions";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { stackerDraft } from "./glassStackerBulkPlacement";
import { autoDesignExactUpperTiling } from "./autoDesignUpperWidths";
import { isAutoDesignCornerFlank, isAutoDesignMergedTwelve } from "./autoDesignV2FinalPasses";

export { autoDesignExactUpperTiling };
import {
  WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements, cabinetWall, dim, elevationBox, footprintDepth, glassStackerFamily,
  glassStackerParentPlacement, glassStackerSpanCover, isCornerCabinet, isFillerItem, isGlassDoorCabinet, isPanelItem, isRefrigerator,
  isStacker, resolvedDesignCabinetDimensions, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

const EPS = 0.1;
const HEIGHT_MATCH_IN = 0.5;
const WIDTH_MATCH_IN = 0.05;
const SEAM_MATCH_IN = 0.25;

type Span = { item: PlacedCabinet; start: number; end: number; bottom: number; top: number };

function spanOn(item: PlacedCabinet, wall: string, room: RoomData): Span {
  const start = wallRunOffset(item, wall, room);
  const box = elevationBox(item, room);
  return { item, start, end: start + wallRunSpan(item, wall, room), bottom: box.bottom, top: box.bottom + box.height };
}

function codeOf(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function prefixOf(code: string | null | undefined): string {
  return /^[A-Z]+/.exec(codeOf(code))?.[0] ?? "";
}

function inches(value: number): string {
  return `${Math.round(value * 100) / 100}″`;
}

function isPlainUpper(item: PlacedCabinet, heightIn: number): boolean {
  return item.placement === "wall" && !item.islandFace && !isFillerItem(item) && !isPanelItem(item) && !isStacker(item)
    && !isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
    && /^W-?\d/i.test(item.masterCode) && Math.abs((Number(item.height) || 0) - heightIn) <= HEIGHT_MATCH_IN;
}

function upperFromRow(row: DesignCabinet, start: number, wall: string, room: RoomData, template: PlacedCabinet, heightIn: number, uid: string, styleId: number | null): PlacedCabinet {
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
    ...wallPlacementAt(start, width, depth, wall as WallSide, room),
    width,
    depth,
    height: dim(row.height, heightIn),
    mountBottom: template.mountBottom ?? 54,
    numberOfDoors: row.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? null,
    constructionMethod: row.constructionMethod ?? null,
    styleId: template.styleId ?? styleId,
  } as PlacedCabinet;
}

/**
 * Window over the sink: the uppers beside the window mirror (Tom, Nov 17 2026,
 * 3:09 PM CT). When the cabinet left of the window and the one right of it are
 * different widths, the side whose far edge does NOT line up with a base seam is
 * re-tiled so its window-side cabinet matches the other side, and the rest of
 * that run is closed exactly with real widths (no filler added). A side whose
 * run cannot close exactly is left as it is.
 */
export function mirrorAutoDesignUppersAroundWindows(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallCatalog: readonly DesignCabinet[];
  heightIn: number | null;
  styleId: number | null;
  makeUid: () => string;
}): { placed: PlacedCabinet[]; notes: string[]; misses: string[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  const misses: string[] = [];
  const height = input.heightIn;
  if (height == null) return { placed: working, notes, misses };
  const standard = autoDesignStandardUpperRows(input.wallCatalog, height);
  const widths = Array.from(new Set(standard.map((row) => dim(row.width, 0))));
  const rowFor = (width: number) => standard.find((row) => Math.abs(dim(row.width, 0) - width) <= WIDTH_MATCH_IN);
  const { room } = input;
  for (const opening of input.openings) {
    if (opening.kind !== "window") continue;
    const wall = opening.side as string;
    const clearFrom = opening.offset - WALL_OPENING_CLEARANCE_IN;
    const clearTo = opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN;
    const onWall = working.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall);
    // The 12" beside a diagonal corner is placed first (corner rule) and is never re-tiled here.
    const plain = onWall.filter((item) => isPlainUpper(item, height) && !isAutoDesignCornerFlank(item)).map((item) => spanOn(item, wall, room));
    const left = plain.filter((entry) => entry.end <= clearFrom + EPS && entry.end >= clearFrom - 1.5).sort((a, b) => b.end - a.end)[0];
    const right = plain.filter((entry) => entry.start >= clearTo - EPS && entry.start <= clearTo + 1.5).sort((a, b) => a.start - b.start)[0];
    if (!left || !right) continue;
    const leftWidth = left.end - left.start;
    const rightWidth = right.end - right.start;
    if (Math.abs(leftWidth - rightWidth) <= WIDTH_MATCH_IN) continue;
    const baseEdges = working.filter((item) => (item.placement === "base" || item.placement === "appliance") && cabinetWall(item, room) === wall && !isFillerItem(item))
      .flatMap((item) => { const s = spanOn(item, wall, room); return [s.start, s.end]; });
    const anchored = (edge: number) => baseEdges.some((value) => Math.abs(value - edge) <= SEAM_MATCH_IN);
    const leftAnchored = anchored(left.start);
    const rightAnchored = anchored(right.end);
    if (leftAnchored && rightAnchored) continue;
    const retileRight = !rightAnchored;
    const mirrorWidth = retileRight ? leftWidth : rightWidth;
    if (!rowFor(mirrorWidth)) continue;
    // The contiguous run of plain uppers on the side being re-tiled.
    const run: Span[] = [retileRight ? right : left];
    for (;;) {
      const edge = retileRight ? run[run.length - 1]!.end : run[run.length - 1]!.start;
      const next = plain.find((entry) => !run.includes(entry) && (retileRight ? Math.abs(entry.start - edge) <= EPS : Math.abs(entry.end - edge) <= EPS));
      if (!next) break;
      run.push(next);
    }
    const runStart = Math.min(...run.map((entry) => entry.start));
    const runEnd = Math.max(...run.map((entry) => entry.end));
    const rest = autoDesignExactUpperTiling(runEnd - runStart - mirrorWidth, widths);
    if (rest == null) {
      misses.push(`The uppers beside the window on ${wall} do not mirror (${inches(leftWidth)} left, ${inches(rightWidth)} right): the ${inches(runEnd - runStart)} run ${retileRight ? "right" : "left"} of the window cannot close exactly around a ${inches(mirrorWidth)} cabinet with this line's widths${working.some((item) => isAutoDesignCornerFlank(item) && cabinetWall(item, room) === wall) ? ", and the 12″ corner cabinet comes first" : ""}.`);
      continue;
    }
    const pieces = retileRight ? [mirrorWidth, ...rest] : [...rest.reverse(), mirrorWidth];
    let along = runStart;
    const template = (retileRight ? right : left).item;
    const replacements = pieces.map((width) => {
      const row = rowFor(width)!;
      const placedRow = upperFromRow(row, along, wall, room, template, height, input.makeUid(), input.styleId);
      along += width;
      return placedRow;
    });
    if (replacements.some((item, index) => !rowFor(pieces[index]!))) continue;
    const removeUids = new Set(run.map((entry) => entry.item.uid));
    const without = working.filter((item) => !removeUids.has(item.uid) && !(item.stackedOnCabinetUid && removeUids.has(item.stackedOnCabinetUid)));
    const accepted = appendCollisionFreePlacements(without, replacements, room);
    if (accepted.rejected.length > 0) continue;
    working = accepted.placed;
    notes.push(`Uppers beside the window on ${wall} now mirror: ${replacements.map((item) => item.masterCode).join(" + ")} (was ${run.map((entry) => entry.item.masterCode).join(" + ")}), so the cabinet next to the window is ${inches(mirrorWidth)} on both sides.`);
  }
  return { placed: working, notes, misses };
}

/**
 * No exposed filler side (Tom, Nov 16 2026): a wall filler of 3" or less left
 * between an upper and a window's clearance has its window side open, so it is
 * removed; the window clearance simply grows by that sliver.
 */
export function dropAutoDesignWindowSideUpperFillers(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
}): { placed: PlacedCabinet[]; notes: string[] } {
  const { room } = input;
  const drop = new Set<string>();
  const notes: string[] = [];
  for (const opening of input.openings) {
    if (opening.kind !== "window") continue;
    const wall = opening.side as string;
    const clearFrom = opening.offset - WALL_OPENING_CLEARANCE_IN;
    const clearTo = opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN;
    const onWall = input.placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall).map((item) => spanOn(item, wall, room));
    for (const entry of onWall) {
      if (!isFillerItem(entry.item) || entry.end - entry.start > 3 + EPS) continue;
      const windowAfter = Math.abs(entry.end - clearFrom) <= EPS;
      const windowBefore = Math.abs(entry.start - clearTo) <= EPS;
      if (!windowAfter && !windowBefore) continue;
      const touchesUpper = onWall.some((other) => other.item.uid !== entry.item.uid && !isFillerItem(other.item)
        && (windowAfter ? Math.abs(other.end - entry.start) <= EPS : Math.abs(other.start - entry.end) <= EPS));
      if (!touchesUpper) continue;
      drop.add(entry.item.uid);
      notes.push(`Removed the ${inches(entry.end - entry.start)} ${entry.item.masterCode} beside the window on ${wall}: its window side would be exposed.`);
    }
  }
  return { placed: input.placed.filter((item) => !drop.has(item.uid)), notes };
}

type ScheduledSpot = { tag: string; parent: PlacedCabinet; stackerWidth: number; fallbackWidth?: number; label: string };

function nearestAppliance(item: Span, wall: string, placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet | null {
  return placed.find((other) => other.placement === "appliance" && cabinetWall(other, room) === wall && (() => {
    const s = spanOn(other, wall, room);
    return Math.min(s.end, item.end) - Math.max(s.start, item.start) > 1;
  })()) ?? null;
}

/**
 * The glass schedule for a finished plan: the spots that get a glass stacker.
 * Everything else on the upper line stays solid.
 */
export function autoDesignGlassScheduleSpots(placed: readonly PlacedCabinet[], room: RoomData, heightIn: number, topIn: number, bottomIn: number): ScheduledSpot[] {
  const spots: ScheduledSpot[] = [];
  const onTopLine = placed.filter((item) => item.placement === "wall" && !item.islandFace && item.noDoor !== true && !isStacker(item)
    && !isFillerItem(item) && !isPanelItem(item));
  for (const item of onTopLine) {
    const wall = cabinetWall(item, room) as string;
    const span = spanOn(item, wall, room);
    if (Math.abs(span.top - topIn) > HEIGHT_MATCH_IN) continue;
    const width = span.end - span.start;
    const code = item.masterCode;
    if (glassStackerFamily(item) === "WDC") {
      spots.push({ tag: "diagonal-corner", parent: item, stackerWidth: Number(item.width) || width, label: `${code} (diagonal corner)` });
      continue;
    }
    if (span.bottom > bottomIn + 1) {
      const appliance = nearestAppliance(span, wall, placed, room);
      const fridge = appliance ? isRefrigerator(appliance) : /refrigerator|fridge/i.test(`${item.description ?? ""} ${item.refrigeratorAssemblyRole ?? ""}`);
      spots.push({ tag: fridge ? "refrigerator-cabinet" : "bridge", parent: item, stackerWidth: Number(item.width) || width,
        label: `${code} (${fridge ? "over the refrigerator" : "bridge over the range / microwave"})` });
      continue;
    }
    if (!isPlainUpper(item, heightIn)) continue;
    if (isAutoDesignMergedTwelve(item)) {
      // The 12" cabinet that replaced a 9" + 3" filler (cabinet before filler) keeps the 9" spot's glass.
      spots.push({ tag: "twelve-inch", parent: item, stackerWidth: 12, label: `${code} (12″ cabinet, was a 9″ + filler)` });
      continue;
    }
    if (Math.abs(width - 9) <= WIDTH_MATCH_IN) {
      spots.push({ tag: "nine-inch", parent: item, stackerWidth: 9, fallbackWidth: 12, label: `${code} (9″ cabinet)` });
      continue;
    }
    if (Math.abs(width - 21) <= WIDTH_MATCH_IN) {
      // A pair of 21" uppers covering a 42" base exactly.
      const base = placed.find((other) => other.placement === "base" && cabinetWall(other, room) === wall && !isFillerItem(other) && (() => {
        const s = spanOn(other, wall, room);
        return Math.abs(s.end - s.start - 42) <= WIDTH_MATCH_IN && span.start >= s.start - EPS && span.end <= s.end + EPS;
      })());
      if (!base) continue;
      const baseSpan = spanOn(base, wall, room);
      const partner = onTopLine.find((other) => other.uid !== item.uid && cabinetWall(other, room) === wall && isPlainUpper(other, heightIn) && (() => {
        const s = spanOn(other, wall, room);
        return Math.abs(s.end - s.start - 21) <= WIDTH_MATCH_IN && s.start >= baseSpan.start - EPS && s.end <= baseSpan.end + EPS;
      })());
      if (partner) spots.push({ tag: "pair-over-42", parent: item, stackerWidth: 21, label: `${code} (pair over the ${base.masterCode})` });
    }
  }
  return spots;
}

function solidRowFor(item: PlacedCabinet, heightIn: number, catalog: readonly DesignCabinet[]): DesignCabinet | null {
  const prefix = prefixOf(item.masterCode);
  const width = Number(item.width) || 0;
  const depth = Number(item.depth) || 0;
  return catalog.find((row) => row.id > 0 && row.placement === item.placement
    && prefixOf(row.masterCode) === prefix
    && Math.abs(dim(row.width, 0) - width) <= WIDTH_MATCH_IN
    && Math.abs(dim(row.height, 0) - heightIn) <= HEIGHT_MATCH_IN
    && (depth <= 0 || Math.abs(dim(row.depth, depth) - depth) <= HEIGHT_MATCH_IN)
    && !isStacker(row) && !isGlassDoorCabinet(row)) ?? null;
}

function skinRowFor(item: PlacedCabinet, heightIn: number, catalog: readonly DesignCabinet[]): DesignCabinet | null {
  const prefix = prefixOf(item.masterCode);
  return catalog.find((row) => row.id > 0 && prefixOf(row.masterCode) === prefix
    && Math.abs(dim(row.height, 0) - heightIn) <= HEIGHT_MATCH_IN
    && isPanelItem(row)) ?? null;
}

function swapRow(item: PlacedCabinet, row: DesignCabinet): PlacedCabinet {
  const dims = resolvedDesignCabinetDimensions(row);
  return {
    ...item,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category ?? item.category,
    subCategory: row.subCategory ?? item.subCategory,
    height: dims.height,
    nominalHeight: dims.height,
    numberOfDoors: row.numberOfDoors ?? item.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers ?? item.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? item.catalogImageUrl ?? null,
  } as PlacedCabinet;
}

function mostCommon(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(Math.round(value * 100) / 100, (counts.get(Math.round(value * 100) / 100) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => { if (count > bestCount) { best = value; bestCount = count; } });
  return best;
}

export type AutoDesignGlassScheduleResult = {
  placed: PlacedCabinet[];
  stackers: PlacedCabinet[];
  findings: DesignerReviewFinding[];
  notes: string[];
  /** The one top height every upper stack ends at, or null when nothing changed. */
  flushTopIn: number | null;
  schedule: Array<{ tag: string; parentCode: string; stackerCode: string; wallId: string }>;
};

/**
 * "Glass cabinets above" (rule 12) with Tom's v2 glass schedule and flush tops.
 * See the file comment. All or nothing: any scheduled spot without a real glass
 * stacker (or any solid upper without a real flush-height row) means no glass
 * and the plan keeps its design-height uppers.
 */
export function applyAutoDesignGlassSchedule(input: {
  placed: readonly PlacedCabinet[];
  wallCatalog: readonly DesignCabinet[];
  /** Skins, fillers and end panels of the line (for the flush-height skin and end panel rows). */
  panelCatalog?: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  room: RoomData;
  /** The real catalog height the upper run used (for example 30.25 for a 30" class). */
  wallHeightIn: number | null;
}): AutoDesignGlassScheduleResult {
  const original = [...input.placed];
  const none = (findings: DesignerReviewFinding[] = []): AutoDesignGlassScheduleResult => ({ placed: original, stackers: [], findings, notes: [], flushTopIn: null, schedule: [] });
  if (!hasPreference(input.intake, "glass-uppers")) return none();
  const { room } = input;
  const height = input.wallHeightIn;
  const skipped = (detail: string): DesignerReviewFinding => ({
    ruleId: "auto-design-rule-12",
    code: "preference-glass-stackers-skipped",
    severity: "warning",
    title: "Customer pick: Glass cabinets above",
    detail: `No glass placed (the glass schedule is all or nothing): ${detail} Every upper stays solid.`,
  });
  if (height == null) return none([skipped("this plan has no wall cabinets.")]);
  const designUppers = original.filter((item) => item.placement === "wall" && !item.islandFace && !isStacker(item) && !isFillerItem(item) && !isPanelItem(item)
    && Math.abs((Number(item.height) || 0) - height) <= HEIGHT_MATCH_IN);
  const bottom = mostCommon(designUppers.map((item) => elevationBox(item, room).bottom));
  if (bottom == null) return none([skipped("no regular wall cabinet at the design height was found.")]);
  const designTop = bottom + height;
  const onTopLine = (item: PlacedCabinet) => {
    if (item.placement !== "wall" || item.islandFace || isStacker(item)) return false;
    const box = elevationBox(item, room);
    return Math.abs(box.bottom + box.height - designTop) <= HEIGHT_MATCH_IN;
  };
  const spots = autoDesignGlassScheduleSpots(original, room, height, designTop, bottom);
  if (spots.length === 0) return none([skipped("the plan has none of the scheduled glass spots (range bridge, refrigerator cabinet, 9″ / 12″ cabinet, diagonal corner, 21″ pair over a 42″ base).")]);
  const stackerCatalog = autoDesignGlassStackerCatalog(input.wallCatalog);
  const panelCatalog = [...(input.panelCatalog ?? [])];
  const ceiling = Number(room.ceilingHeight) || 0;
  const stackerRow = (width: number, family: "WDC" | "W" | null, heightIn: number) => stackerCatalog.find((row) => Math.abs(resolvedDesignCabinetDimensions(row).width - width) <= WIDTH_MATCH_IN
    && Math.abs(resolvedDesignCabinetDimensions(row).height - heightIn) <= HEIGHT_MATCH_IN && glassStackerFamily(row) === family) ?? null;
  const glassMissingEverywhere = new Set<string>();
  for (const spot of spots) {
    const family = glassStackerFamily(spot.parent);
    const any = AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN.some((g) => stackerRow(spot.stackerWidth, family, g)
      || (spot.fallbackWidth != null && stackerRow(spot.fallbackWidth, family, g)));
    if (!any) glassMissingEverywhere.add(`${spot.label}, ${inches(spot.stackerWidth)} wide`);
  }
  let lastReasons: string[] = [];
  for (const stackerHeight of [...AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN].sort((a, b) => a - b)) {
    const flushTop = designTop + stackerHeight;
    if (ceiling > 0 && flushTop > ceiling + EPS) continue;
    const reasons: string[] = [];
    const picks: Array<{ spot: ScheduledSpot; row: DesignCabinet; span: boolean }> = [];
    for (const spot of spots) {
      const family = glassStackerFamily(spot.parent);
      const exact = stackerRow(spot.stackerWidth, family, stackerHeight);
      if (exact) { picks.push({ spot, row: exact, span: false }); continue; }
      if (spot.fallbackWidth != null) {
        const wide = stackerRow(spot.fallbackWidth, family, stackerHeight);
        if (wide && glassStackerSpanCover({ uid: "probe", width: dim(wide.width, 0) }, spot.parent, original, room)) {
          picks.push({ spot, row: wide, span: true });
          continue;
        }
      }
      reasons.push(spot.fallbackWidth != null
        ? `no ${inches(stackerHeight)} glass stacker fits ${spot.label}: the line sells no ${inches(spot.stackerWidth)} glass stacker and there is no ${inches(spot.fallbackWidth - spot.stackerWidth)} filler beside it for a ${inches(spot.fallbackWidth)} one to span`
        : `no ${inches(stackerHeight)} glass stacker for ${spot.label}`);
    }
    const solidHeight = height + stackerHeight;
    const scheduledUids = new Set(spots.map((spot) => spot.parent.uid));
    const spanFillerUids = new Set(picks.filter((pick) => pick.span).map((pick) => glassStackerSpanCover({ uid: "probe", width: dim(pick.row.width, 0) }, pick.spot.parent, original, room)?.filler.uid).filter(Boolean) as string[]);
    const swaps = new Map<string, PlacedCabinet>();
    const notes: string[] = [];
    for (const item of original) {
      if (!onTopLine(item) || scheduledUids.has(item.uid)) continue;
      if (isFillerItem(item)) {
        if (spanFillerUids.has(item.uid)) continue;
        swaps.set(item.uid, { ...item, height: solidHeight, nominalHeight: solidHeight } as PlacedCabinet);
        continue;
      }
      if (isPanelItem(item)) {
        const skin = skinRowFor(item, solidHeight, [...panelCatalog, ...input.wallCatalog]);
        if (skin) swaps.set(item.uid, swapRow(item, skin));
        else notes.push(`${item.masterCode} has no ${inches(solidHeight)} row in this line, so it stays ${inches(Number(item.height) || 0)} tall.`);
        continue;
      }
      if (elevationBox(item, room).bottom > bottom + 1) {
        reasons.push(`${item.masterCode} is a short cabinet on the top line that is not on the glass schedule`);
        continue;
      }
      const solid = solidRowFor(item, solidHeight, input.wallCatalog);
      if (!solid) { reasons.push(`this line sells no ${inches(solidHeight)} tall ${prefixOf(item.masterCode)} ${inches(Number(item.width) || 0)} wide for ${item.masterCode}`); continue; }
      swaps.set(item.uid, swapRow(item, solid));
    }
    if (reasons.length > 0) { if (lastReasons.length === 0) lastReasons = reasons; continue; }
    // Tall end panels beside the refrigerator (clamped to the old top line) reach the new top when the real row is that tall.
    for (const item of original) {
      if (item.placement !== "tall" || !isPanelItem(item)) continue;
      const box = elevationBox(item, room);
      if (Math.abs(box.bottom + box.height - designTop) > HEIGHT_MATCH_IN) continue;
      const row = panelCatalog.find((candidate) => candidate.id === item.cabinetId) ?? panelCatalog.find((candidate) => codeOf(candidate.masterCode) === codeOf(item.masterCode));
      const wanted = flushTop - box.bottom;
      if (row && dim(row.height, 0) >= wanted - EPS) swaps.set(item.uid, { ...item, height: wanted, nominalHeight: wanted } as PlacedCabinet);
    }
    let working = original.map((item) => swaps.get(item.uid) ?? item);
    const stackers: PlacedCabinet[] = [];
    const failed: string[] = [];
    for (const pick of picks) {
      const parent = working.find((item) => item.uid === pick.spot.parent.uid)!;
      const draft = { ...stackerDraft(parent, pick.row, parent), uid: `auto-glass-stacker-${parent.uid}` } as PlacedCabinet;
      const seat = glassStackerParentPlacement(draft, [...working, ...stackers], room, parent.uid);
      if (!seat.ok || seat.parentUid !== parent.uid) { failed.push(`${pick.row.masterCode} on ${pick.spot.label}`); continue; }
      stackers.push({
        ...draft,
        x: seat.x,
        y: seat.y,
        rotation: seat.rotation,
        mountBottom: seat.mountBottom,
        stackedOnCabinetUid: parent.uid,
        depthPositionAdjusted: true,
        noDoor: false,
        // The GD code already says glass; the flag is only for rows that do not
        // (so the cart does not append a second GD, the PR 441 GDGD issue).
        glassDoor: isGlassDoorCabinet({ ...pick.row, glassDoor: undefined } as never) ? undefined : true,
        autoPlacedReason: `Glass schedule: glass stacker on ${pick.spot.label}`,
      } as PlacedCabinet);
    }
    if (failed.length > 0) { if (lastReasons.length === 0) lastReasons = [`the glass stacker would not seat (${failed.join("; ")})`]; continue; }
    working = [...working, ...stackers];
    // Verify: one top for every stack on the upper line.
    const covered = new Set<string>([...stackers.map((item) => item.stackedOnCabinetUid!), ...Array.from(spanFillerUids)]);
    const off = working.filter((item) => item.placement === "wall" && !item.islandFace && !covered.has(item.uid)
      && (isStacker(item) || onTopLine(original.find((o) => o.uid === item.uid) ?? item)))
      .filter((item) => { const box = elevationBox(item, room); return Math.abs(box.bottom + box.height - flushTop) > HEIGHT_MATCH_IN && !isPanelItem(item); });
    if (off.length > 0) { if (lastReasons.length === 0) lastReasons = [`${off.map((item) => item.masterCode).join(", ")} would not end at ${inches(flushTop)}`]; continue; }
    const schedule = stackers.map((stacker) => ({
      tag: picks.find((pick) => pick.spot.parent.uid === stacker.stackedOnCabinetUid)!.spot.tag,
      parentCode: working.find((item) => item.uid === stacker.stackedOnCabinetUid)!.masterCode,
      stackerCode: stacker.masterCode,
      wallId: String(cabinetWall(stacker, room)),
    }));
    return {
      placed: working,
      stackers,
      notes: [`Glass schedule: ${stackers.length} glass stacker${stackers.length === 1 ? "" : "s"} (${schedule.map((entry) => `${entry.stackerCode} on ${entry.parentCode}`).join(", ")}); every other upper is solid and every upper stack ends at ${inches(flushTop)}.`, ...notes],
      findings: [{
        ruleId: "auto-design-rule-12",
        code: "glass-schedule-placed",
        severity: "info",
        title: "Customer pick: Glass cabinets above",
        detail: `Glass goes only where the glass schedule calls for it: ${picks.map((pick) => `${pick.row.masterCode} on ${pick.spot.label}`).join("; ")}. The other uppers are solid ${inches(solidHeight)} cabinets, so every top lines up at ${inches(flushTop)}.${notes.length ? ` ${notes.join(" ")}` : ""}`,
      }],
      flushTopIn: flushTop,
      schedule,
    };
  }
  const parts: string[] = [];
  if (glassMissingEverywhere.size > 0) parts.push(`This line sells no 12″, 15″ or 18″ glass stacker the same width as ${Array.from(glassMissingEverywhere).sort().join("; ")}.`);
  if (lastReasons.length > 0) parts.push(`${lastReasons.join("; ")}.`);
  if (parts.length === 0) parts.push("no glass stacker fits under the ceiling.");
  return none([skipped(parts.join(" "))]);
}
