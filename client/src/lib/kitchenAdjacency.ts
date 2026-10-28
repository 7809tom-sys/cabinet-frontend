import {
  COLLISION_EPSILON_IN,
  STD,
  cabinetWall,
  isFillerItem,
  isFullHeightCabinet,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkBaseCabinet,
  wallLength,
  wallPlacementAtUnbounded,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { kitchenAdjacencyRuleById } from "./kitchenAdjacencyRules";
import {
  bakesALot,
  cooksALot,
  describeBakingZone,
  firstCatalogMatch,
  isTrashBaseCatalog,
  kitchenUsageSuggestions,
  normalizeKitchenUsage,
  type KitchenUsageProfile,
} from "./kitchenUsage";

/** Finished top of a 42 inch wall run whose bottom sits at 54 inches. */
export const WALL_RUN_TOP_IN = 96;
export const STANDARD_WALL_BOTTOM_IN = STD.WALL_MOUNT_BOTTOM;
export const COUNTER_HEIGHT_IN = STD.COUNTERTOP_HEIGHT;

/**
 * Open question from the owner: "24-inch cabinets at 66".
 * A 24 inch box at 66 inches tops out at 90, which misses the 96 inch run.
 * This constant is named and unused. Bridges follow the 96 inch top instead.
 */
export const OPEN_QUESTION_TWENTY_FOUR_INCH_CABINET_BOTTOM_IN = 66;

export const RANGE_FRIDGE_MIN_CABINET_IN = 15;
export const HEAVY_COOK_LANDING_IN = 15;
/**
 * "Small cabinet" beside a heavy-cooking range: a base under 15 inches
 * (9 and 12 inch spice, tray, and filler bases) or any filler/panel/tall
 * unit touching the range. Drawer and door bases 15 inches and wider count.
 */
export const SMALL_RANGE_NEIGHBOR_BELOW_IN = 15;
export const SINK_DISHWASHER_MAX_GAP_IN = 36;
export const DISHWASHER_CORNER_CLEAR_IN = 21;
export const APPLIANCE_SHIFT_CAP_IN = 3;

export type RangeBridgeSpec = {
  code: string;
  widthIn: 30 | 33 | 36;
  heightIn: 24 | 30;
  bottomIn: 72 | 66;
  topIn: 96;
  depthIn: 12;
};

/** Width snapped to the stock bridge the catalog lists for that range. */
export function rangeBridgeWidth(rangeWidthIn: number): 30 | 33 | 36 {
  if (rangeWidthIn >= 34.5) return 36;
  if (rangeWidthIn >= 31.5) return 33;
  return 30;
}

/**
 * Something hanging under the bridge (microwave or hood): 24 inch bridge, bottom 72, top 96.
 * Nothing hanging under it: 30 inch bridge, bottom 66, top 96.
 */
export function rangeBridgeSpec(input: { rangeWidthIn: number; hangsBelow: boolean }): RangeBridgeSpec {
  const widthIn = rangeBridgeWidth(input.rangeWidthIn);
  if (input.hangsBelow) {
    return { code: `W${widthIn}24`, widthIn, heightIn: 24, bottomIn: 72, topIn: WALL_RUN_TOP_IN, depthIn: 12 };
  }
  return { code: `W${widthIn}30`, widthIn, heightIn: 30, bottomIn: 66, topIn: WALL_RUN_TOP_IN, depthIn: 12 };
}

export type AdjacencyFinding = {
  id: string;
  ruleId: string;
  severity: "suggestion" | "attention";
  title: string;
  description: string;
};

export type AdjacencySkip = { ruleId: string; note: string };

export type AdjacencyReport = {
  findings: AdjacencyFinding[];
  skipped: AdjacencySkip[];
};

type CatalogLike = {
  id?: number;
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
  width?: string | number | null;
  placement?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
};

type Span = { item: PlacedCabinet; wall: string; start: number; end: number };

function ruleNote(id: string, fallback: string): string {
  return kitchenAdjacencyRuleById(id)?.note ?? fallback;
}

function spanOf(item: PlacedCabinet, room: RoomData): Span | null {
  if (item.islandFace) return null;
  const wall = cabinetWall(item, room);
  if (!wall) return null;
  const start = wallRunOffset(item, wall, room);
  if (!Number.isFinite(start)) return null;
  return { item, wall, start, end: start + wallRunSpan(item, wall, room) };
}

function onWall(placed: readonly PlacedCabinet[], room: RoomData, wall: string): Span[] {
  return placed
    .map((item) => spanOf(item, room))
    .filter((span): span is Span => span != null && span.wall === wall)
    .sort((left, right) => left.start - right.start);
}

function isLandingBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if (isFullHeightCabinet(item)) return false;
  return true;
}

function isQualifyingBetween(item: PlacedCabinet): boolean {
  return isLandingBase(item) && item.width >= RANGE_FRIDGE_MIN_CABINET_IN - 0.05;
}

function isSmallAgainstRange(item: PlacedCabinet): boolean {
  if (isFillerItem(item) || isPanelItem(item)) return true;
  if (item.placement === "tall" || isFullHeightCabinet(item) || isRefrigerator(item)) return true;
  if (item.placement === "appliance") return true;
  return item.placement === "base" && item.width < SMALL_RANGE_NEIGHBOR_BELOW_IN - 0.05;
}

function touches(leftEnd: number, rightStart: number): boolean {
  return Math.abs(leftEnd - rightStart) <= 0.75;
}

function neighbor(spans: readonly Span[], edge: number, side: "before" | "after"): Span | null {
  if (side === "before") {
    const candidates = spans.filter((span) => touches(span.end, edge));
    return candidates.sort((left, right) => right.end - left.end)[0] ?? null;
  }
  const candidates = spans.filter((span) => touches(edge, span.start));
  return candidates.sort((left, right) => left.start - right.start)[0] ?? null;
}

function finding(ruleId: string, severity: AdjacencyFinding["severity"], title: string, description: string, suffix = ""): AdjacencyFinding {
  return { id: `adjacency:${ruleId}${suffix}`, ruleId, severity, title, description };
}

function skip(ruleId: string, note: string): AdjacencySkip {
  return { ruleId, note };
}

export function reviewRangeFridgeSeparation(placed: readonly PlacedCabinet[], room: RoomData): AdjacencyFinding[] {
  const spans = placed.map((item) => spanOf(item, room)).filter((span): span is Span => span != null);
  const walls = Array.from(new Set(spans.map((span) => span.wall)));
  const findings: AdjacencyFinding[] = [];
  for (const wall of walls) {
    const here = spans.filter((span) => span.wall === wall);
    const ranges = here.filter((span) => span.item.placement === "appliance" && isRangeOrOven(span.item.masterCode, span.item.description));
    const fridges = here.filter((span) => isRefrigerator(span.item));
    for (const range of ranges) {
      for (const fridge of fridges) {
        const left = range.start <= fridge.start ? range : fridge;
        const right = left === range ? fridge : range;
        const between = here.filter((span) => span.item.uid !== left.item.uid && span.item.uid !== right.item.uid
          && span.end > left.end - 0.5 && span.start < right.start + 0.5);
        if (between.some((span) => isQualifyingBetween(span.item))) continue;
        const gap = right.start - left.end;
        findings.push(finding(
          "range-fridge-gap",
          "attention",
          "Range and refrigerator need a 15 inch cabinet between them",
          `On the ${wall} wall the range and refrigerator have ${Math.round(gap * 8) / 8}" between them and no base cabinet 15" or wider. Fillers and panels do not count.`,
          `:${range.item.uid}:${fridge.item.uid}`,
        ));
      }
    }
  }
  return findings;
}

export type RangeFridgeMove = { uid: string; deltaAlongIn: number };

/**
 * Opens at least 15 inches between a same-run range and refrigerator.
 * Each appliance may move at most 3 inches from its original along-wall start.
 * The smallest combined shift is used. A gap that still cannot reach 15 inches is flagged.
 */
export function separateRangeAndRefrigerator(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  origins?: readonly { uid: string; originalStart: number }[];
}): { placed: PlacedCabinet[]; moves: RangeFridgeMove[]; flags: string[] } {
  let placed = [...input.placed];
  const moves: RangeFridgeMove[] = [];
  const flags: string[] = [];
  const originOf = (uid: string, current: number) => input.origins?.find((origin) => origin.uid === uid)?.originalStart ?? current;
  const remaining = (uid: string, current: number) => Math.max(0, APPLIANCE_SHIFT_CAP_IN - Math.abs(current - originOf(uid, current)));
  const spans = () => placed.map((item) => spanOf(item, input.room)).filter((span): span is Span => span != null);
  const shiftItem = (uid: string, delta: number) => {
    if (Math.abs(delta) <= 0.05) return;
    placed = placed.map((item) => {
      if (item.uid !== uid) return item;
      const wall = cabinetWall(item, input.room) as WallSide;
      const start = wallRunOffset(item, wall, input.room) + delta;
      const spot = wallPlacementAtUnbounded(start, wallRunSpan(item, wall, input.room), Math.max(0, item.depth), wall, input.room, item.peninsulaSide);
      return { ...item, ...spot, wallId: spot.wallId ?? item.wallId, wallOffset: spot.wallOffset ?? start };
    });
    const existing = moves.find((move) => move.uid === uid);
    if (existing) existing.deltaAlongIn += delta;
    else moves.push({ uid, deltaAlongIn: delta });
  };
  const current = spans();
  const walls = Array.from(new Set(current.map((span) => span.wall)));
  for (const wall of walls) {
    const here = spans().filter((span) => span.wall === wall);
    const ranges = here.filter((span) => span.item.placement === "appliance" && isRangeOrOven(span.item.masterCode, span.item.description));
    const fridges = here.filter((span) => isRefrigerator(span.item));
    for (const range of ranges) {
      for (const fridge of fridges) {
        const fresh = spans().filter((span) => span.wall === wall);
        const left = (fresh.find((span) => span.item.uid === range.item.uid)?.start ?? 0)
          <= (fresh.find((span) => span.item.uid === fridge.item.uid)?.start ?? 0)
          ? fresh.find((span) => span.item.uid === range.item.uid)!
          : fresh.find((span) => span.item.uid === fridge.item.uid)!;
        const right = left.item.uid === range.item.uid
          ? fresh.find((span) => span.item.uid === fridge.item.uid)!
          : fresh.find((span) => span.item.uid === range.item.uid)!;
        const between = fresh.filter((span) => span.end > left.end - 0.5 && span.start < right.start + 0.5
          && span.item.uid !== left.item.uid && span.item.uid !== right.item.uid);
        if (between.some((span) => isQualifyingBetween(span.item))) continue;
        const gap = right.start - left.end;
        if (gap >= RANGE_FRIDGE_MIN_CABINET_IN - 0.05) continue;
        let shortfall = RANGE_FRIDGE_MIN_CABINET_IN - gap;
        const leftBudget = remaining(left.item.uid, left.start);
        const rightBudget = remaining(right.item.uid, right.start);
        const leftMove = Math.min(leftBudget, shortfall);
        shortfall -= leftMove;
        const rightMove = Math.min(rightBudget, shortfall);
        shortfall -= rightMove;
        const length = wallLength(left.wall as WallSide, input.room);
        if (left.start - leftMove >= -COLLISION_EPSILON_IN) shiftItem(left.item.uid, -leftMove);
        if (right.end + rightMove <= length + COLLISION_EPSILON_IN) shiftItem(right.item.uid, rightMove);
        const after = spans().filter((span) => span.wall === wall);
        const leftAfter = after.find((span) => span.item.uid === left.item.uid)!;
        const rightAfter = after.find((span) => span.item.uid === right.item.uid)!;
        const opened = Math.min(leftAfter.end, rightAfter.end) === leftAfter.end
          ? rightAfter.start - leftAfter.end
          : leftAfter.start - rightAfter.end;
        if (opened < RANGE_FRIDGE_MIN_CABINET_IN - 0.05) {
          flags.push(`The range and refrigerator on the ${wall} wall still have ${Math.round(Math.abs(opened) * 8) / 8}" between them after the 3" shift. A 15" cabinet does not fit. Nothing smaller was invented to fill it.`);
        }
      }
    }
  }
  return { placed, moves, flags };
}

function landingWidth(spans: readonly Span[], edge: number, side: "before" | "after"): number {
  let cursor = edge;
  let width = 0;
  let guard = 0;
  while (guard < 8) {
    const next = neighbor(spans, cursor, side);
    if (!next || !isLandingBase(next.item)) break;
    width += next.end - next.start;
    cursor = side === "before" ? next.start : next.end;
    guard += 1;
  }
  return width;
}

export function reviewHeavyCookLandings(placed: readonly PlacedCabinet[], room: RoomData): AdjacencyFinding[] {
  const findings: AdjacencyFinding[] = [];
  for (const range of placed) {
    if (range.placement !== "appliance" || !isRangeOrOven(range.masterCode, range.description)) continue;
    const span = spanOf(range, room);
    if (!span) continue;
    const spans = onWall(placed, room, span.wall).filter((entry) => entry.item.uid !== range.uid);
    for (const side of ["before", "after"] as const) {
      const edge = side === "before" ? span.start : span.end;
      const next = neighbor(spans, edge, side);
      const label = side === "before" ? "on the start side" : "on the end side";
      if (!next || isSmallAgainstRange(next.item) || next.item.width < HEAVY_COOK_LANDING_IN - 0.05) {
        const name = next ? `${next.item.masterCode} (${Math.round(next.item.width)}")` : "open space";
        findings.push(finding(
          "heavy-cook-landing",
          "attention",
          "Heavy cooking needs 15\" of counter on both sides of the range",
          `Everyday cooking keeps an uninterrupted counter on both sides of the range so a hot pan can be set down. ${name} is directly ${label} of ${range.masterCode}. Bases under 15" (including 9" and 12" spice or tray bases), fillers, panels, tall cabinets, and the refrigerator are not used there.`,
          `:${range.uid}:${side}`,
        ));
      }
    }
  }
  return findings;
}

export function guardHeavyCookRangeLanding<T extends { width: number; isFiller: boolean }>(
  items: readonly T[],
  input: { length: number; rangeAtStart: boolean; rangeAtEnd: boolean },
): { items: T[]; note: string | null } {
  if (!input.rangeAtStart && !input.rangeAtEnd) return { items: [...items], note: null };
  const bad = (item: T | undefined) => !item || item.isFiller || item.width < HEAVY_COOK_LANDING_IN - 0.05;
  const startBad = input.rangeAtStart && bad(items[0]);
  const endBad = input.rangeAtEnd && bad(items[items.length - 1]);
  if (!startBad && !endBad) return { items: [...items], note: null };
  const kept = items.filter((item, index) => {
    if (startBad && index === 0) return false;
    if (endBad && index === items.length - 1) return false;
    return true;
  });
  return {
    items: kept,
    note: `Heavy cooking needs an uninterrupted 15" counter on both sides of the range. This ${Math.round(input.length * 8) / 8}" space cannot hold a 15" or wider base against the range, so no cabinet under 15" and no filler was placed there.`,
  };
}

function reviewBaking(placed: readonly PlacedCabinet[], room: RoomData): AdjacencyFinding[] {
  const ranges = placed.filter((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  if (!ranges.length) {
    return [finding("prep-zone", "attention", "Baking counter needs a range to land beside", "Lots of baking looks for 36 inches of uninterrupted counter beside the range. This plan has no range yet.")];
  }
  const findings: AdjacencyFinding[] = [];
  for (const range of ranges) {
    const span = spanOf(range, room);
    if (!span) continue;
    const pieces = onWall(placed, room, span.wall).map((entry) => ({
      start: entry.start,
      end: entry.end,
      kind: isFillerItem(entry.item) || isPanelItem(entry.item)
        ? "filler" as const
        : entry.item.placement === "tall" || isFullHeightCabinet(entry.item)
          ? "tall" as const
          : entry.item.placement === "base"
            ? "base" as const
            : "appliance" as const,
    }));
    const fridge = onWall(placed, room, span.wall).find((entry) => isRefrigerator(entry.item));
    const zone = describeBakingZone({
      range: { start: span.start, end: span.end },
      fridge: fridge ? { start: fridge.start, end: fridge.end } : null,
      pieces,
    });
    if (!zone.ok) {
      findings.push(finding("prep-zone", "attention", "Baking zone is short of 36 inches", zone.message, `:${range.uid}`));
    }
  }
  return findings;
}

function edgeGap(left: Span, right: Span): number {
  if (left.end <= right.start + 0.2) return right.start - left.end;
  if (right.end <= left.start + 0.2) return left.start - right.end;
  return 0;
}

export function reviewAfterShift(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  usage?: KitchenUsageProfile | null;
}): AdjacencyReport {
  const findings: AdjacencyFinding[] = [];
  const skipped: AdjacencySkip[] = [];
  const sinks = input.placed.filter((item) => isSinkBaseCabinet(item));
  const dishwashers = input.placed.filter((item) => /DW/i.test(item.masterCode) || /dishwasher/i.test(item.description ?? ""));
  if (sinks.length && dishwashers.length) {
    for (const sink of sinks) {
      const sinkSpan = spanOf(sink, input.room);
      if (!sinkSpan) continue;
      const nearest = dishwashers
        .map((item) => spanOf(item, input.room))
        .filter((span): span is Span => span != null && span.wall === sinkSpan.wall)
        .map((span) => edgeGap(sinkSpan, span))
        .sort((left, right) => left - right)[0];
      if (nearest == null) continue;
      if (nearest > SINK_DISHWASHER_MAX_GAP_IN + 0.05) {
        findings.push(finding(
          "dishwasher-beside-sink",
          "attention",
          "Dishwasher is more than 36 inches from the sink",
          `The nearest dishwasher edge is ${Math.round(nearest * 8) / 8}" from the sink. Auto-design keeps that within 36" and will not shift either one more than 3" to recover it.`,
          `:${sink.uid}`,
        ));
      }
    }
  } else if (!dishwashers.length) {
    skipped.push(skip("dishwasher-beside-sink", "No dishwasher is on the plan, so the 36 inch sink-to-dishwasher check was skipped."));
  }

  for (const sink of sinks) {
    const sinkSpan = spanOf(sink, input.room);
    if (!sinkSpan) continue;
    const window = input.openings.find((opening) => opening.kind === "window" && opening.side === sinkSpan.wall
      && opening.offset < sinkSpan.end && opening.offset + opening.width > sinkSpan.start);
    if (!window) continue;
    const sinkCenter = (sinkSpan.start + sinkSpan.end) / 2;
    const windowCenter = window.offset + window.width / 2;
    if (Math.abs(sinkCenter - windowCenter) > 0.75) {
      findings.push(finding(
        "sink-on-window",
        "suggestion",
        "Sink is no longer centered on the window",
        `The sink center is ${Math.round(Math.abs(sinkCenter - windowCenter) * 8) / 8}" from the window center. Centering on the window is a suggestion. The sink was allowed to slide up to 3" for cabinet fit.`,
        `:${sink.uid}`,
      ));
    }
  }
  if (!input.openings.some((opening) => opening.kind === "window")) {
    skipped.push(skip("sink-on-window", "No window is on the plan, so centering the sink on a window was skipped."));
    skipped.push(skip("range-not-under-window", "No window is on the plan, so the range-under-window check was skipped."));
  }

  findings.push(...reviewRangeFridgeSeparation(input.placed, input.room));
  if (cooksALot(input.usage)) findings.push(...reviewHeavyCookLandings(input.placed, input.room));
  if (bakesALot(input.usage)) findings.push(...reviewBaking(input.placed, input.room));

  const doors = input.openings.filter((opening) => opening.kind === "door");
  if (!doors.length) {
    skipped.push(skip("appliance-door-clash", "No entry door is on the plan, so the door-swing check was skipped."));
    skipped.push(skip("door-swing-after-place", "No entry door is on the plan, so the post-placement door clearance check was skipped."));
  } else {
    for (const door of doors) {
      for (const appliance of input.placed.filter((item) => item.placement === "appliance")) {
        const span = spanOf(appliance, input.room);
        if (!span || span.wall !== door.side) continue;
        const overlaps = door.offset < span.end - 0.5 && door.offset + door.width > span.start + 0.5;
        if (overlaps) {
          findings.push(finding(
            "door-swing-after-place",
            "attention",
            `${appliance.masterCode} overlaps an entry door`,
            "An entry door and an appliance door cannot share the same wall opening. Move one of them. This was checked again after placement.",
            `:${door.uid}:${appliance.uid}`,
          ));
        }
      }
    }
  }
  return { findings, skipped };
}

function sameOrFacing(sink: Span, other: Span, room: RoomData): boolean {
  if (sink.wall === other.wall) return true;
  const pairs = [["top", "bottom"], ["left", "right"]];
  return pairs.some((pair) => pair.includes(sink.wall) && pair.includes(other.wall) && wallLength(sink.wall as WallSide, room) > 0);
}

export function reviewKitchenAdjacency(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  island?: { width: number; depth: number; raisedBar?: boolean; raisedBarOverhang?: number | null; x: number; y: number } | null;
  usage?: KitchenUsageProfile | null;
  catalog?: readonly CatalogLike[];
  acceptedSuggestionIds?: readonly string[];
}): AdjacencyReport {
  const usage = normalizeKitchenUsage(input.usage ?? input.room.kitchenUsage ?? null);
  const accepted = new Set([...(usage.acceptedSuggestionIds ?? []), ...(input.acceptedSuggestionIds ?? [])]);
  const report = reviewAfterShift({ placed: input.placed, room: input.room, openings: input.openings, usage });
  const findings = [...report.findings];
  const skipped = [...report.skipped];

  if (usage.skipped) {
    skipped.push(skip("kitchen-usage", "Kitchen use was not answered. Usage-based placement was skipped, and saving is not blocked."));
  }

  const sinks = input.placed.map((item) => spanOf(item, input.room)).filter((span): span is Span => span != null && isSinkBaseCabinet(span.item));
  const ranges = input.placed.map((item) => spanOf(item, input.room)).filter((span): span is Span => span != null && span.item.placement === "appliance" && isRangeOrOven(span.item.masterCode, span.item.description));
  const fridges = input.placed.map((item) => spanOf(item, input.room)).filter((span): span is Span => span != null && isRefrigerator(span.item));

  for (const sink of sinks) {
    const spans = onWall(input.placed, input.room, sink.wall);
    const left = landingWidth(spans, sink.start, "before");
    const right = landingWidth(spans, sink.end, "after");
    const longer = Math.max(left, right);
    const shorter = Math.min(left, right);
    if (longer < 24 - 0.05 || shorter < 18 - 0.05) {
      findings.push(finding(
        "sink-landing",
        "attention",
        "Sink landing is short",
        `The sink needs 24" on one side and 18" on the other. This run has ${Math.round(longer)}" and ${Math.round(shorter)}".`,
        `:${sink.item.uid}`,
      ));
    }
  }

  if (ranges.length && fridges.length && sinks.length === 1) {
    const sink = sinks[0]!;
    const nearRange = ranges.some((range) => sameOrFacing(sink, range, input.room));
    const nearFridge = fridges.some((fridge) => sameOrFacing(sink, fridge, input.room));
    if (!nearRange || !nearFridge) {
      findings.push(finding("single-sink-near-work", "suggestion", "The only sink is away from the range or refrigerator", "NKBA asks the only sink to sit next to or across from both the range and the refrigerator."));
    }
  }

  for (const range of ranges) {
    const spans = onWall(input.placed, input.room, range.wall);
    const left = neighbor(spans, range.start, "before");
    const right = neighbor(spans, range.end, "after");
    for (const side of [left, right]) {
      if (side && (isRefrigerator(side.item) || side.item.placement === "tall" || isFullHeightCabinet(side.item))) {
        findings.push(finding(
          "range-landing",
          "attention",
          "A tall cabinet or refrigerator is directly beside the range",
          `${side.item.masterCode} touches ${range.item.masterCode}. The range needs a base cabinet on that side, not a tall unit or the refrigerator.`,
          `:${range.item.uid}:${side.item.uid}`,
        ));
      }
    }
    const window = input.openings.find((opening) => opening.kind === "window" && opening.side === range.wall
      && opening.offset < range.end && opening.offset + opening.width > range.start);
    if (window) {
      findings.push(finding("range-not-under-window", "attention", "Range sits under a window", "A range does not go under an operable window.", `:${range.item.uid}`));
    }
    if (!cooksALot(usage)) {
      const leftLanding = landingWidth(spans, range.start, "before");
      const rightLanding = landingWidth(spans, range.end, "after");
      const sides = [leftLanding, rightLanding].sort((a, b) => a - b);
      if (sides[0]! < 12 - 0.05 || sides[1]! < 15 - 0.05) {
        findings.push(finding(
          "range-landing",
          "attention",
          "Range landing is short of 12 and 15 inches",
          `The range needs at least 12" on one side and 15" on the other. This run has ${Math.round(sides[0]!)}" and ${Math.round(sides[1]!)}".`,
          `:baseline:${range.item.uid}`,
        ));
      }
    }
  }

  for (const fridge of fridges) {
    const spans = onWall(input.placed, input.room, fridge.wall);
    const leftTouch = neighbor(spans, fridge.start, "before");
    const rightTouch = neighbor(spans, fridge.end, "after");
    if (leftTouch && rightTouch && isLandingBase(leftTouch.item) && isLandingBase(rightTouch.item)) {
      findings.push(finding("fridge-run-end", "attention", "Refrigerator is in the middle of a run", `${fridge.item.masterCode} has base cabinets on both sides. Put it at the end of the run when the measurement allows.`, `:${fridge.item.uid}`));
    }
    const handleLanding = Math.max(landingWidth(spans, fridge.start, "before"), landingWidth(spans, fridge.end, "after"));
    if (handleLanding > 0.5 && handleLanding < 15 - 0.05) {
      findings.push(finding("fridge-landing", "attention", "Refrigerator landing is under 15 inches", `${fridge.item.masterCode} needs 15" of counter on the handle side.`, `:${fridge.item.uid}`));
    }
  }

  if (sinks.length && ranges.length && fridges.length) {
    const centers = [sinks[0]!, ranges[0]!, fridges[0]!].map((span) => ({
      x: (span.item.x ?? 0) + span.item.width / 2,
      y: (span.item.y ?? 0) + span.item.depth / 2,
    }));
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const legs = [distance(centers[0]!, centers[1]!), distance(centers[1]!, centers[2]!), distance(centers[2]!, centers[0]!)];
    const total = legs.reduce((sum, leg) => sum + leg, 0);
    const bad = legs.some((leg) => leg < 48 - 0.5 || leg > 108 + 0.5) || total > 26 * 12 + 0.5;
    if (bad) {
      findings.push(finding(
        "work-triangle",
        "suggestion",
        "Work triangle is outside 4 to 9 feet",
        `The sink, range, and refrigerator legs are ${legs.map((leg) => `${Math.round(leg / 12)}'`).join(", ")} (${Math.round(total / 12)}' total). Each leg should be 4–9 feet and the total at most 26 feet.`,
      ));
    }
  } else {
    skipped.push(skip("work-triangle", "The work triangle needs a sink, a range, and a refrigerator. One of them is missing, so the check was skipped."));
  }

  const wallsWithBases = new Set(input.placed.filter(isLandingBase).map((item) => cabinetWall(item, input.room)));
  const parallel = (["top", "bottom"] as const).every((wall) => wallsWithBases.has(wall))
    || (["left", "right"] as const).every((wall) => wallsWithBases.has(wall));
  if (!parallel) {
    skipped.push(skip("aisles", "Aisle width needs two parallel cabinet runs. This plan does not have that pair, so the aisle check was skipped."));
  } else if (wallsWithBases.has("top") && wallsWithBases.has("bottom")) {
    const aisle = input.room.depth - STD.BASE_DEPTH * 2;
    if (aisle < 42 - 0.05) {
      findings.push(finding("aisles", "attention", "Work aisle is under 42 inches", `The facing runs leave about ${Math.round(aisle)}" . One cook needs 42" and two cooks need 48".`));
    }
  }

  if (!input.island) {
    skipped.push(skip("island", "No island is on the plan, so island depth and the 9 inch landing behind an island range were skipped."));
    skipped.push(skip("seating-clearance", "No island seating bar is on the plan, so seating clearance was skipped."));
  } else {
    const depth = input.island.depth;
    if (depth < 36 - 0.05) {
      findings.push(finding("island", "suggestion", "Island is under 36 inches deep", `This island is ${Math.round(depth)}" deep. A small island is 36" and a standard one is 39".`));
    }
    if (input.island.raisedBar) {
      const overhang = input.island.raisedBarOverhang ?? 0;
      if (overhang < 12) {
        findings.push(finding("seating-clearance", "attention", "Seating overhang is short", "A raised bar needs at least 12 inches of knee space, and more when people walk behind the seats."));
      }
    } else {
      skipped.push(skip("seating-clearance", "The island has no raised seating bar, so diner clearance was skipped."));
    }
  }

  if (!input.placed.some((item) => item.placement === "tall" && /oven/i.test(`${item.masterCode} ${item.description}`))) {
    skipped.push(skip("oven-tower-landing", "No oven tower is on the plan, so the 15 inch oven landing was skipped."));
  }
  skipped.push(skip("fridge-opening", ruleNote("fridge-opening", "The measured refrigerator bay is used instead of a 37 inch opening.")));
  skipped.push(skip("range-opening", ruleNote("range-opening", "The range uses its catalog width.")));
  skipped.push(skip("tall-depth", ruleNote("tall-depth", "Tall depth stays at the owner's panel rule.")));

  for (const range of ranges) {
    const covered = input.placed.some((item) => {
      if (item.uid === range.item.uid) return false;
      const span = spanOf(item, input.room);
      if (!span || span.wall !== range.wall) return false;
      const overlaps = span.start < range.end - 1 && span.end > range.start + 1;
      if (!overlaps) return false;
      return /HOOD|^MW/i.test(item.masterCode) || (item.placement === "wall" && (item.mountBottom ?? 0) >= 60);
    });
    if (covered) continue;
    const spec = rangeBridgeSpec({ rangeWidthIn: range.item.width, hangsBelow: false });
    findings.push(finding(
      "range-bridge",
      "suggestion",
      `Nothing hangs under the range bridge — use ${spec.code}`,
      `${spec.code} is ${spec.heightIn}" tall with its bottom at ${spec.bottomIn}" so the top lands at ${spec.topIn}". If a microwave or hood is added under it, switch to a 24" bridge with its bottom at 72".`,
      `:${range.item.uid}`,
    ));
  }

  const dishwashers = input.placed.filter((item) => /DW/i.test(item.masterCode) || /dishwasher/i.test(item.description ?? ""));
  for (const dishwasher of dishwashers) {
    const span = spanOf(dishwasher, input.room);
    if (!span) continue;
    const length = wallLength(span.wall as WallSide, input.room);
    const nearestEnd = Math.min(span.start, Math.max(0, length - span.end));
    if (nearestEnd < 2 - 0.05) {
      findings.push(finding("dishwasher-corner-fallback", "attention", "Dishwasher is tighter than 2 inches to a corner", `${dishwasher.masterCode} is ${Math.round(nearestEnd * 8) / 8}" from the end of the wall. Even when a 21" stand is impossible, leave at least 2".`, `:${dishwasher.uid}`));
    } else if (nearestEnd < DISHWASHER_CORNER_CLEAR_IN - 0.05) {
      findings.push(finding("dishwasher-corner-clearance", "attention", "Dishwasher is within 21 inches of a corner", `${dishwasher.masterCode} is ${Math.round(nearestEnd * 8) / 8}" from the wall end. It needs 21" of cabinet or sink between it and an inside corner. Auto-design will not slide it more than 3" to clear that.`, `:${dishwasher.uid}`));
    }
    const touchingRange = ranges.some((range) => range.wall === span.wall && (touches(range.end, span.start) || touches(span.end, range.start)));
    if (touchingRange) {
      findings.push(finding("dishwasher-away-from-range", "suggestion", "Dishwasher is directly beside the range", "The cleanup zone works better with the sink's landing between the dishwasher and the range. This is a suggestion.", `:${dishwasher.uid}`));
    }
    const atEnd = nearestEnd <= 0.75;
    const hasPanel = input.placed.some((item) => isPanelItem(item) && /dish|end panel/i.test(`${item.masterCode} ${item.description}`));
    if (atEnd && !hasPanel) {
      findings.push(finding("dishwasher-end-panel", "suggestion", "Dishwasher at the end of a run wants a panel", "A dishwasher that ends a run usually gets a 3/4 inch support panel or a 2–3 inch end panel, with the countertop running over it.", `:${dishwasher.uid}`));
    }
  }

  for (const fridge of fridges) {
    const length = wallLength(fridge.wall as WallSide, input.room);
    const nearestEnd = Math.min(fridge.start, Math.max(0, length - fridge.end));
    if (nearestEnd > 2.5) continue;
    const spans = onWall(input.placed, input.room, fridge.wall);
    const cover = spans.some((span) => (isFillerItem(span.item) || isPanelItem(span.item))
      && (touches(span.end, fridge.start) || touches(fridge.end, span.start)));
    if (!cover) {
      findings.push(finding("fridge-hinge-clearance", "attention", "Refrigerator hinge side needs clearance at the wall", `${fridge.item.masterCode} is ${Math.round(nearestEnd * 8) / 8}" from the wall end with no filler or panel. Hinge-side clearance is about 2.5".`, `:${fridge.item.uid}`));
    }
  }

  for (const sink of sinks) {
    for (const range of ranges) {
      if (sink.wall !== range.wall) continue;
      const betweenStart = Math.min(sink.end, range.end);
      const betweenEnd = Math.max(sink.start, range.start);
      if (betweenEnd <= betweenStart) continue;
      const counter = onWall(input.placed, input.room, sink.wall)
        .filter((span) => isLandingBase(span.item) && span.start >= betweenStart - 0.5 && span.end <= betweenEnd + 0.5)
        .reduce((sum, span) => sum + span.end - span.start, 0);
      if (counter > 0.5 && counter < 36 - 0.05) {
        findings.push(finding("shared-landing", "attention", "Shared landing between sink and range is short", `The counter between the sink and the range is ${Math.round(counter)}". The longer landing plus 12" is 36".`, `:${sink.item.uid}:${range.item.uid}`));
      }
    }
  }

  for (const range of ranges) {
    const hood = input.placed.find((item) => /HOOD/i.test(item.masterCode) && spanOf(item, input.room)?.wall === range.wall);
    if (hood && hood.width + 0.05 < range.item.width) {
      findings.push(finding("hood-width", "attention", "Hood is narrower than the range", `${hood.masterCode} is ${hood.width}" and ${range.item.masterCode} is ${range.item.width}". The hood should be at least as wide as the range.`, `:${range.item.uid}`));
    }
  }

  const microwave = input.placed.find((item) => /^MW/i.test(item.masterCode));
  if (!microwave) {
    skipped.push(skip("microwave-location", "No microwave is on the plan, so the 54 inch bottom and 15 inch landing were skipped."));
  } else if ((microwave.mountBottom ?? 0) > 54.05 && microwave.placement !== "base") {
    findings.push(finding("microwave-location", "attention", "Microwave bottom is above 54 inches", `${microwave.masterCode} starts at ${microwave.mountBottom}". NKBA wants the bottom at or below 54" unless it is a drawer or under-counter microwave.`));
  }

  if (input.catalog?.length && sinks.length) {
    const drawer = input.catalog.find((item) => /drawer/i.test(`${item.masterCode} ${item.description}`) && (item.numberOfDoors ?? 0) === 0);
    const sinkCenter = (sinks[0]!.start + sinks[0]!.end) / 2;
    const nearDrawer = input.placed.some((item) => {
      const span = spanOf(item, input.room);
      if (!span || span.wall !== sinks[0]!.wall) return false;
      return /drawer/i.test(`${item.masterCode} ${item.description}`) && Math.abs((span.start + span.end) / 2 - sinkCenter) <= 72;
    });
    if (drawer?.masterCode && !nearDrawer) {
      findings.push(finding("drawer-near-sink", "suggestion", `A drawer base such as ${drawer.masterCode} can sit by the sink`, "Utensils land better in a drawer in the sink and prep zone. Accepting this keeps the suggestion. It does not move cabinets."));
    }
  }

  const catalog = input.catalog ?? [];
  if (catalog.length && sinks.length) {
    const trash = firstCatalogMatch(catalog, isTrashBaseCatalog);
    if (trash?.masterCode && !input.placed.some((item) => isTrashBaseCatalog(item))) {
      findings.push(finding("trash-pullout", "suggestion", `Add ${trash.masterCode} by the sink`, "A trash pull-out belongs beside the sink, on the side opposite the dishwasher. Accepting this keeps the suggestion with the design. It does not move cabinets by itself."));
    }
  }
  for (const suggestion of kitchenUsageSuggestions(usage, catalog)) {
    findings.push(finding(suggestion.id, "suggestion", suggestion.title, suggestion.masterCode ? `${suggestion.description} Catalog item: ${suggestion.masterCode}.` : suggestion.description));
  }
  if (bakesALot(usage) && !ranges.length) {
    // reviewBaking already recorded the missing range when usage includes baking.
  }
  if (!input.openings.some((opening) => opening.kind === "door")) {
    // already skipped in reviewAfterShift
  }

  const visible = findings.filter((entry) => !accepted.has(entry.id));
  return { findings: visible, skipped };
}

export type { KitchenUsageProfile, PlacedCabinet, RoomData, WallOpening };
