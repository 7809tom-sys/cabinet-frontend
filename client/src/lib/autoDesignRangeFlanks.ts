/**
 * Owner rule: Auto-Design always puts a real base cabinet on each side of the
 * range, and finishes the outside of each of those cabinets with the line's own
 * end/finished panel.
 *
 * When the measured run leaves the range between two openings that are a hair
 * off a stock width — the reported right-wall plan had 8 7/8" on one side and
 * 9 1/8" on the other — the range is "wiggled": it slides along its own wall by
 * the small difference (1/8" in that plan) so both sides land on a width the
 * line really sells, and each side is then filled with that real cabinet. Filler
 * is the last resort and only appears when no stock width fits after the wiggle.
 *
 * The wiggle stays inside the anchor cap (the same band the general wiggle pass
 * uses, measured from the user's own measurement), never leaves the wall run,
 * and never overlaps anything: a shift or a cabinet that collides is rejected
 * and the next best plan is tried instead.
 *
 * Where a flank's outside is an open run end, the line's finished end panel gets
 * its own 3/4 inch of the run, seated outside the cabinet as a real catalog row,
 * so the plan, elevation and 3D draw it and the cart, quote and PO bill it and
 * nothing else. Where the outside already ends against another cabinet — the
 * corner box in a U or L kitchen owns that space — that side is already
 * finished; no board is invented and the reason is reported instead.
 */
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  formatEighthInches,
  freeSegmentsOnWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  wallPlacementAtUnbounded,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import { autoDesignShiftLimitIn, anchorWiggleLimitIn } from "./designerLayoutRules";
import { baseSubGroup, cabinetDrawingType } from "./cabinetGraphics";
import {
  catalogItemToExposedPanelStock,
  exposedPanelTypeForCatalog,
  type ExposedPanelCatalogItem,
  type ExposedPanelStock,
} from "./exposedSidePanels";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** One flank opening is never wider than this; a wider gap is an ordinary run the tiler owns. */
export const RANGE_FLANK_MAX_GAP_IN = 21;
/** A finished end panel is 3/4 inch stock, the same as every other finished end. */
export const RANGE_FLANK_PANEL_THICKNESS_IN = STD.PANEL_THICKNESS;
const STEP_IN = 1 / 8;
const EDGE_IN = 0.06;

const roundEighth = (value: number) => Math.round(value * 8) / 8;

/** True when `n` is 3/4 inch, the finished-end stock thickness. */
const isPanelThickness = (value: number) => Math.abs(value - RANGE_FLANK_PANEL_THICKNESS_IN) <= 0.01;

/**
 * Narrow single-door base boxes the line sells: the 9 inch tray base and the
 * 12 inch single-door base. A drawer box, a vanity box, a sink base, a corner
 * box and filler are deliberately excluded — they are never a flank neighbour.
 */
export function narrowFlankBaseCatalog(
  catalog: readonly DesignCabinet[],
  maxWidthIn = kitchenRuleNumber("narrow_cabinet_max_in"),
): DesignCabinet[] {
  const byWidth = new Map<number, DesignCabinet>();
  const specialty = (candidate: DesignCabinet) => /specialty|pullout|pull-out|organizer/i.test(`${candidate.subCategory ?? ""} ${candidate.description ?? ""}`);
  for (const row of catalog) {
    if (row.placement !== "base") continue;
    if (row.isCornerCabinet === true) continue;
    if (isCornerCabinet(row.masterCode, row.description ?? undefined)) continue;
    if (isSinkBaseCabinet(row) || isFillerItem(row) || isPanelItem(row)) continue;
    const width = dim(row.width, 0);
    if (!(width > 0) || width > maxWidthIn + 0.05) continue;
    if (cabinetDrawingType(row) !== "standard-door") continue;
    if ((row.numberOfDoors ?? 0) < 1) continue;
    const height = dim(row.height, 0);
    if (height > 0 && Math.abs(height - STD.BASE_HEIGHT) > 1) continue;
    const group = baseSubGroup(row);
    if (group !== "base" && group !== "full-height") continue;
    const existing = byWidth.get(width);
    // One row per stock width. Prefer a plain run base over a specialty pull-out.
    if (!existing || (specialty(existing) && !specialty(row))) byWidth.set(width, row);
  }
  return Array.from(byWidth.entries()).sort((left, right) => right[0] - left[0]).map(([, row]) => row);
}

export type RangeFlankSidePlan = {
  cabinet: DesignCabinet;
  widthIn: number;
  /** Along-wall start of the cabinet body. */
  startIn: number;
  /** The opening this side closes, measured on the plan being applied. */
  gapIn: number;
  /** Run reserved outside the cabinet for its finished end panel (0 when no panel fits). */
  panelIn: number;
  /** Remainder left for the seam pass (0 when the opening closes exactly). */
  fillerIn: number;
};

export type RangeFlankPlan = {
  rangeUid: string;
  rangeCode: string;
  wallId: WallSide;
  rangeWidthIn: number;
  fromStartIn: number;
  toStartIn: number;
  shiftIn: number;
  /** The bounded floor run the range sits in, before the shift. */
  segmentStartIn: number;
  segmentEndIn: number;
  /** Null when a real cabinet already butts the range on that side. */
  left: RangeFlankSidePlan | null;
  right: RangeFlankSidePlan | null;
};

type FlankFit = { cabinet: DesignCabinet; widthIn: number; fillerIn: number; panelIn: number };

/**
 * Best fit for one flank opening. `panelAvailable` says the outside of this
 * flank is an exposed run end, so the line's finished end panel can be seated
 * outside it. `panelFits` says the opening is at least 3/4" wider than the best
 * stock cabinet, i.e. the panel has room to stand outside the cabinet.
 *
 * Order of preference, filler last in every case: a stock cabinet plus its end
 * panel, a stock cabinet alone, then a stock cabinet plus one small filler.
 */
export function bestFlankCabinet(input: {
  gapIn: number;
  catalog: readonly DesignCabinet[];
  fillerMaxIn?: number;
  panelAvailable?: boolean;
}): FlankFit | null {
  const fillerMax = input.fillerMaxIn ?? autoDesignFillerMaxIn();
  const gap = roundEighth(input.gapIn);
  if (!(gap > COLLISION_EPSILON_IN)) return null;
  const panelAvailable = input.panelAvailable !== false;
  const widths = input.catalog
    .map((cabinet) => ({ cabinet, width: dim(cabinet.width, 0) }))
    .filter((entry) => entry.width > 0)
    .sort((left, right) => right.width - left.width);
  if (!widths.length) return null;
  const fits: FlankFit[] = [];
  for (const entry of widths) {
    for (const panelIn of panelAvailable ? [RANGE_FLANK_PANEL_THICKNESS_IN, 0] : [0]) {
      const remainder = roundEighth(gap - roundEighth(entry.width + panelIn));
      if (remainder < -COLLISION_EPSILON_IN) continue;
      if (remainder > fillerMax + COLLISION_EPSILON_IN) continue;
      fits.push({ cabinet: entry.cabinet, widthIn: entry.width, fillerIn: remainder, panelIn });
    }
  }
  if (!fits.length) return null;
  // Never a filler when a stocked width already closes the opening; then the
  // widest cabinet, then the finished end panel before a bare side.
  const rank = (fit: FlankFit) => [
    fit.fillerIn > COLLISION_EPSILON_IN ? 1 : 0,
    roundEighth(fit.fillerIn),
    fit.panelIn > 0 ? 0 : 1,
    -fit.widthIn,
  ];
  let best = fits[0]!;
  let bestRank = rank(best);
  for (const fit of fits.slice(1)) {
    const next = rank(fit);
    if (betterThan(next, bestRank)) {
      best = fit;
      bestRank = next;
    }
  }
  return best;
}

function candidateScore(input: {
  left: RangeFlankSidePlan | null;
  right: RangeFlankSidePlan | null;
  shiftIn: number;
}): number[] {
  const sides = [input.left, input.right].filter((side): side is RangeFlankSidePlan => side != null);
  const fillerCount = sides.filter((side) => side.fillerIn > COLLISION_EPSILON_IN).length;
  const fillerTotal = roundEighth(sides.reduce((sum, side) => sum + side.fillerIn, 0));
  const panels = sides.filter((side) => side.panelIn > 0).length;
  return [fillerCount, fillerTotal, -panels, Math.abs(input.shiftIn), -Math.min(...sides.map((side) => side.widthIn), 0)];
}

function betterThan(next: number[], current: number[] | null): boolean {
  if (!current) return true;
  for (let index = 0; index < next.length; index += 1) {
    if (next[index]! < current[index]! - 1e-9) return true;
    if (next[index]! > current[index]! + 1e-9) return false;
  }
  return false;
}

/** The bounded floor run a range sits in, with the range itself taken out. */
function rangeSegment(range: PlacedCabinet, wallId: WallSide, input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
}): { start: number; end: number } | null {
  const width = wallRunSpan(range, wallId, input.room);
  const currentStart = wallRunOffset(range, wallId, input.room);
  const segment = freeSegmentsOnWall(
    wallId,
    input.room,
    input.placed.filter((item) => item.uid !== range.uid),
    [...input.openings],
    0.01,
    0,
    "base",
    false,
    undefined,
    Math.max(STD.BASE_DEPTH, Number(range.depth) || 0),
  ).find((free) => currentStart >= free.start - 0.02 && currentStart + width <= free.start + free.length + 0.02);
  return segment ? { start: segment.start, end: segment.start + segment.length } : null;
}

/**
 * True when a real cabinet already abuts this point, so the side is not an open
 * end of the run and nothing needs finishing there.
 */
function cabinetAt(placed: readonly PlacedCabinet[], room: RoomData, wallId: WallSide, at: number, ignoreUid: string): boolean {
  return placed.some((item) => {
    if (item.uid === ignoreUid) return false;
    if (item.placement !== "base" && item.placement !== "tall") return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const start = wallRunOffset(item, wallId, room);
    const end = start + wallRunSpan(item, wallId, room);
    return Math.abs(end - at) <= EDGE_IN || Math.abs(start - at) <= EDGE_IN;
  });
}

/**
 * Plans a real cabinet on each side of every range in the plan, sliding the
 * range by the smallest amount that puts both sides on a stock width. Where the
 * opening has exactly the 3/4" a finished end panel needs, that 3/4" is part of
 * the plan, so the panel is seated instead of filler.
 * Read-only: nothing moves and nothing is placed until `applyRangeFlankPlan`.
 */
export function planRangeFlankCabinets(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  /** Every base row of the line, narrow boxes included. */
  catalog: readonly DesignCabinet[];
  /** Measured along-wall starts, so the wiggle never exceeds the anchor cap. */
  origins?: readonly { uid: string; originalStart: number }[];
  fillerMaxIn?: number;
  panelThicknessIn?: number;
}): RangeFlankPlan[] {
  const fillerMax = input.fillerMaxIn ?? autoDesignFillerMaxIn();
  const panelThickness = input.panelThicknessIn ?? RANGE_FLANK_PANEL_THICKNESS_IN;
  const panelsAvailable = isPanelThickness(panelThickness);
  const narrow = narrowFlankBaseCatalog(input.catalog);
  if (!narrow.length) return [];
  const plans: RangeFlankPlan[] = [];
  for (const range of input.placed) {
    if (range.placement !== "appliance" || !isRangeOrOven(range.masterCode, range.description)) continue;
    const wallId = cabinetWall(range, input.room) as WallSide | null;
    if (!wallId) continue;
    const width = wallRunSpan(range, wallId, input.room);
    const currentStart = wallRunOffset(range, wallId, input.room);
    const segment = rangeSegment(range, wallId, input);
    if (!segment) continue;
    const originalStart = input.origins?.find((origin) => origin.uid === range.uid)?.originalStart ?? currentStart;
    const cap = Math.min(anchorWiggleLimitIn("stove"), autoDesignShiftLimitIn("stove"));
    // An outside that already abuts a cabinet (the corner box in a U or L
    // kitchen) is finished by that cabinet, so no end panel is seated there.
    const leftCovered = cabinetAt(input.placed, input.room, wallId, segment.start, range.uid);
    const rightCovered = cabinetAt(input.placed, input.room, wallId, segment.end, range.uid);

    let best: { plan: RangeFlankPlan; score: number[] } | null = null;
    const steps = Math.round(cap / STEP_IN);
    for (let step = 0; step <= steps; step += 1) {
      const magnitudes = step === 0 ? [0] : [step * STEP_IN, -step * STEP_IN];
      for (const magnitude of magnitudes) {
        const targetStart = roundEighth(originalStart + magnitude);
        if (Math.abs(targetStart - originalStart) > cap + COLLISION_EPSILON_IN) continue;
        if (targetStart < segment.start - COLLISION_EPSILON_IN) continue;
        if (targetStart + width > segment.end + COLLISION_EPSILON_IN) continue;
        const targetEnd = roundEighth(targetStart + width);
        const leftGap = roundEighth(targetStart - segment.start);
        const rightGap = roundEighth(segment.end - targetEnd);
        if (leftGap < COLLISION_EPSILON_IN || rightGap < COLLISION_EPSILON_IN) continue;
        if (leftGap > RANGE_FLANK_MAX_GAP_IN + COLLISION_EPSILON_IN) continue;
        if (rightGap > RANGE_FLANK_MAX_GAP_IN + COLLISION_EPSILON_IN) continue;
        const leftFit = bestFlankCabinet({ gapIn: leftGap, catalog: narrow, fillerMaxIn: fillerMax, panelAvailable: panelsAvailable && !leftCovered });
        const rightFit = bestFlankCabinet({ gapIn: rightGap, catalog: narrow, fillerMaxIn: fillerMax, panelAvailable: panelsAvailable && !rightCovered });
        if (!leftFit || !rightFit) continue;
        // The cabinet stands against the range, and the finished end panel (then
        // any leftover filler) sits on its far outside face.
        const left: RangeFlankSidePlan = {
          cabinet: leftFit.cabinet,
          widthIn: leftFit.widthIn,
          startIn: roundEighth(targetStart - leftFit.widthIn),
          gapIn: leftGap,
          panelIn: leftFit.panelIn,
          fillerIn: leftFit.fillerIn,
        };
        const right: RangeFlankSidePlan = {
          cabinet: rightFit.cabinet,
          widthIn: rightFit.widthIn,
          startIn: targetEnd,
          gapIn: rightGap,
          panelIn: rightFit.panelIn,
          fillerIn: rightFit.fillerIn,
        };
        const shiftIn = roundEighth(targetStart - currentStart);
        const score = candidateScore({ left, right, shiftIn });
        if (!betterThan(score, best?.score ?? null)) continue;
        best = {
          score,
          plan: {
            rangeUid: range.uid,
            rangeCode: range.masterCode ?? "RANGE",
            wallId,
            rangeWidthIn: width,
            fromStartIn: roundEighth(currentStart),
            toStartIn: targetStart,
            shiftIn,
            segmentStartIn: roundEighth(segment.start),
            segmentEndIn: roundEighth(segment.end),
            left,
            right,
          },
        };
      }
    }
    if (best) plans.push(best.plan);
  }
  return plans;
}

export type RangeFlankResult = {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  plans: RangeFlankPlan[];
  notes: string[];
};

function wallName(wallId: string): string {
  if (wallId === "top" || wallId === "bottom" || wallId === "left" || wallId === "right") return `${wallId} wall`;
  return wallId;
}

function flankCabinetDraft(input: {
  pick: RangeFlankSidePlan;
  wallId: WallSide;
  room: RoomData;
  styleId: number | null;
  makeUid: () => string;
}): PlacedCabinet {
  const depth = footprintDepth(input.pick.cabinet);
  const spot = wallPlacementAtUnbounded(input.pick.startIn, input.pick.widthIn, depth, input.wallId, input.room);
  return {
    uid: input.makeUid(),
    cabinetId: input.pick.cabinet.id,
    masterCode: input.pick.cabinet.masterCode,
    description: input.pick.cabinet.description,
    category: input.pick.cabinet.category ?? "Base",
    subCategory: input.pick.cabinet.subCategory ?? "Standard Base",
    placement: "base",
    ...spot,
    width: input.pick.widthIn,
    depth,
    height: dim(input.pick.cabinet.height, STD.BASE_HEIGHT),
    numberOfDoors: input.pick.cabinet.numberOfDoors ?? 1,
    numberOfDrawers: input.pick.cabinet.numberOfDrawers ?? 0,
    catalogImageUrl: input.pick.cabinet.catalogImageUrl ?? null,
    styleId: input.styleId,
  } as PlacedCabinet;
}

/**
 * Applies the plans: slides each range, then seats the real cabinet on each
 * side. A shift or a cabinet that would overlap anything is dropped whole, so a
 * half-applied pair can never reach the plan.
 */
export function applyRangeFlankPlan(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  plans: readonly RangeFlankPlan[];
  styleId: number | null;
  makeUid: () => string;
}): RangeFlankResult {
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const applied: RangeFlankPlan[] = [];
  const notes: string[] = [];
  for (const plan of input.plans) {
    const original = working.find((item) => item.uid === plan.rangeUid);
    if (!original) continue;
    const currentStart = wallRunOffset(original, plan.wallId, input.room);
    const depth = Math.max(0, Number(original.depth) || 0);
    if (Math.abs(plan.shiftIn - (plan.toStartIn - currentStart)) > COLLISION_EPSILON_IN) continue;
    if (Math.abs(plan.shiftIn) > COLLISION_EPSILON_IN) {
      const spot = wallPlacementAtUnbounded(currentStart + plan.shiftIn, plan.rangeWidthIn, depth, plan.wallId, input.room, original.peninsulaSide);
      const moved = { ...original, ...spot, wallId: spot.wallId ?? original.wallId, wallOffset: spot.wallOffset ?? plan.toStartIn };
      const without = working.filter((item) => item.uid !== original.uid);
      const accepted = appendCollisionFreePlacements(without, [moved], input.room);
      if (accepted.rejected.length > 0) continue;
      working = accepted.placed;
    }
    const drafts: PlacedCabinet[] = [];
    for (const pick of [plan.left, plan.right]) {
      if (!pick) continue;
      drafts.push(flankCabinetDraft({ pick, wallId: plan.wallId, room: input.room, styleId: input.styleId, makeUid: input.makeUid }));
    }
    const accepted = appendCollisionFreePlacements(working, drafts, input.room);
    const allSeated = accepted.rejected.length === 0 && drafts.every((draft) => accepted.placed.some((item) => item.uid === draft.uid));
    if (!allSeated) {
      // Undo the range shift so the plan is never left half-built.
      working = working.map((item) => (item.uid === original.uid ? original : item));
      continue;
    }
    working = accepted.placed;
    additions.push(...drafts);
    applied.push(plan);
    const sideText = [plan.left, plan.right]
      .filter((pick): pick is RangeFlankSidePlan => pick != null)
      .map((pick) => `${formatEighthInches(pick.widthIn)} ${pick.cabinet.masterCode}`)
      .join(" and ");
    const shiftText = Math.abs(plan.shiftIn) > COLLISION_EPSILON_IN
      ? `The ${plan.rangeCode} was slid ${formatEighthInches(Math.abs(plan.shiftIn))} along the ${wallName(plan.wallId)} so both sides land on stock widths.`
      : `The ${plan.rangeCode} already sat on stock widths.`;
    notes.push(`${shiftText} ${sideText} now stand beside it, one on each side.`);
  }
  return { placed: working, additions, plans: applied, notes };
}

/** A finished end panel the build wants on the outside of one flank cabinet. */
export type RangeFlankPanelRequest = {
  cabinetUid: string;
  cabinetCode: string;
  /** `start` is the side toward the wall start, `end` the side toward the wall end. */
  side: "start" | "end";
  wallId: WallSide;
  /** Along-wall start the panel occupies. */
  startIn: number;
};

/**
 * One request per flank side whose plan reserved the 3/4" for a finished end.
 *
 * `unspaced` names a flank whose outside is already against another cabinet (the
 * corner box in a U or L kitchen owns that space) so the caller can say why that
 * side is not double-stocked. No board is invented there.
 */
export function rangeFlankPanelRequests(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  plans: readonly RangeFlankPlan[];
}): {
  requests: RangeFlankPanelRequest[];
  unspaced: Array<{ cabinetCode: string; side: "start" | "end"; wallId: WallSide; against: string | null }>;
} {
  type Unspaced = { cabinetCode: string; side: "start" | "end"; wallId: WallSide; against: string | null };
  const requests: RangeFlankPanelRequest[] = [];
  const unspaced: Unspaced[] = [];
  const neighbourOf = (wallId: WallSide, at: number, ignoreUid: string, reachIn = EDGE_IN): string | null => {
    const match = input.placed.find((item) => {
      if (item.uid === ignoreUid) return false;
      if (item.placement !== "base" && item.placement !== "tall") return false;
      if (cabinetWall(item, input.room) !== wallId) return false;
      const start = wallRunOffset(item, wallId, input.room);
      const end = start + wallRunSpan(item, wallId, input.room);
      return Math.abs(end - at) <= reachIn || Math.abs(start - at) <= reachIn;
    });
    return match?.masterCode ?? null;
  };
  for (const plan of input.plans) {
    const range = input.placed.find((item) => item.uid === plan.rangeUid);
    const rangeStart = range ? wallRunOffset(range, plan.wallId, input.room) : null;
    for (const pick of [plan.left, plan.right]) {
      if (!pick) continue;
      const host = input.placed.find((item) => (
        item.placement === "base"
        && !isFillerItem(item)
        && cabinetWall(item, input.room) === plan.wallId
        && Math.abs((Number(item.width) || 0) - pick.widthIn) <= 0.01
        && Math.abs(wallRunOffset(item, plan.wallId, input.room) - pick.startIn) <= 0.02
      ));
      if (!host) continue;
      const hostStart = wallRunOffset(host, plan.wallId, input.room);
      const hostEnd = hostStart + wallRunSpan(host, plan.wallId, input.room);
      // The flank that ends at the range has its outside on its start side.
      const side: "start" | "end" = rangeStart != null && Math.abs(hostEnd - rangeStart) <= EDGE_IN ? "start" : "end";
      if (pick.panelIn <= 0) {
        const outside = side === "start" ? hostStart : hostEnd;
        // A neighbour within one small filler of the outside is the piece that
        // finishes that side. Otherwise the side is either the bare end of the
        // run, or the hold an inside corner owns; both are named as they are.
        const against = neighbourOf(plan.wallId, outside, host.uid, 3.5);
        const frame = wallRunFrame(plan.wallId, input.room);
        const atRunEnd = frame != null
          && (Math.abs(outside - frame.runStart) <= EDGE_IN || Math.abs(outside - frame.runEnd) <= EDGE_IN);
        unspaced.push({
          cabinetCode: host.masterCode,
          side,
          wallId: plan.wallId,
          against: against ?? (atRunEnd ? null : "the inside corner return"),
        });
        continue;
      }
      requests.push({
        cabinetUid: host.uid,
        cabinetCode: host.masterCode,
        side,
        wallId: plan.wallId,
        startIn: flankPanelStartIn({ hostStartIn: hostStart, hostWidthIn: pick.widthIn, side }),
      });
    }
  }
  return { requests, unspaced };
}

/** Why no separate board was seated on a flank side, in the plan's own words. */
export function describeUnfinishedFlank(input: {
  cabinetCode: string;
  side: "start" | "end";
  against: string | null;
}): string {
  const where = input.side === "start" ? "start" : "end";
  return input.against
    ? `${input.cabinetCode} keeps its ${where} side against ${input.against}, which already finishes it; no second panel was added there.`
    : `${input.cabinetCode} finishes at the ${where} of the run itself, with no free 3/4″ outside it for a separate panel board.`;
}

/**
 * The line's finished end panel that covers a base cabinet side, cut from stock.
 * Panels meant for another purpose (a dishwasher return, a refrigerator or tall
 * panel, a wall panel) are not a base end and are excluded, as are sheets too
 * shallow to cover the side.
 */
export function finishedBaseEndPanelStock(
  catalog: readonly ExposedPanelCatalogItem[],
  host: Pick<PlacedCabinet, "depth" | "height">,
): ExposedPanelStock | null {
  const face = Math.max(Number(host.depth) || STD.BASE_DEPTH, STD.BASE_DEPTH);
  const height = Number(host.height) || STD.BASE_HEIGHT;
  const stocks = catalog.flatMap((item) => {
    if (exposedPanelTypeForCatalog(item) !== "base-end") return [];
    const text = `${item.masterCode ?? ""} ${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase();
    if (/dishwasher|return panel|refrigerator|fridge|tall panel|wall end/.test(text)) return [];
    const stock = catalogItemToExposedPanelStock(item, null);
    return stock ? [stock] : [];
  }).filter((stock) => stock.stockFace + 0.01 >= face);
  if (!stocks.length) return null;
  // A panel must cover the whole side it finishes. Among those that do, prefer
  // one the line names an end panel or skin, then the smallest sheet: a 24" side
  // is never cut from a 96" tall sheet when a base panel is sold.
  const named = (stock: ExposedPanelStock) => /end\s*panel|\bskin\b/i.test(`${stock.description}`);
  return stocks.sort((left, right) => (
    Number(right.stockHeight + 0.01 >= height) - Number(left.stockHeight + 0.01 >= height)
    || Number(named(right)) - Number(named(left))
    || left.stockFace * left.stockHeight - right.stockFace * right.stockHeight
  ))[0] ?? null;
}

/** Where the panel for one flank sits along the run, outside the cabinet body. */
export function flankPanelStartIn(input: {
  hostStartIn: number;
  hostWidthIn: number;
  side: "start" | "end";
  thicknessIn?: number;
}): number {
  const thickness = input.thicknessIn ?? RANGE_FLANK_PANEL_THICKNESS_IN;
  return roundEighth(input.side === "start" ? input.hostStartIn - thickness : input.hostStartIn + input.hostWidthIn);
}

export type RangeFlankPanelResult = {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  notes: string[];
  skipped: Array<RangeFlankPanelRequest & { reason: string }>;
};

/**
 * Seats the line's own finished end panel on the outside of each flank cabinet
 * as a real catalog row in the drawing, cut from stock. A side without stock or
 * without the free 3/4" is reported rather than forced: nothing is invented and
 * nothing overlaps.
 */
export function applyRangeFlankEndPanels(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  catalog: readonly ExposedPanelCatalogItem[];
  requests: readonly RangeFlankPanelRequest[];
  styleId: number | null;
  makeUid: () => string;
  thicknessIn?: number;
}): RangeFlankPanelResult {
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const notes: string[] = [];
  const skipped: RangeFlankPanelResult["skipped"] = [];
  const thickness = input.thicknessIn ?? RANGE_FLANK_PANEL_THICKNESS_IN;
  for (const request of input.requests) {
    const host = working.find((item) => item.uid === request.cabinetUid);
    if (!host) continue;
    const stock = finishedBaseEndPanelStock(input.catalog, host);
    if (!stock) {
      skipped.push({ ...request, reason: "the selected line sells no finished base end panel for it" });
      continue;
    }
    const depth = Math.max(Number(host.depth) || STD.BASE_DEPTH, STD.BASE_DEPTH);
    const spot = wallPlacementAtUnbounded(request.startIn, thickness, depth, request.wallId, input.room, host.peninsulaSide);
    const panel: PlacedCabinet = {
      uid: input.makeUid(),
      cabinetId: stock.id,
      masterCode: stock.masterCode,
      description: stock.description,
      category: "Panels",
      subCategory: "End panel",
      placement: "base",
      ...spot,
      wallId: spot.wallId ?? request.wallId,
      wallOffset: spot.wallOffset ?? request.startIn,
      width: thickness,
      nominalWidth: thickness,
      depth,
      nominalDepth: depth,
      height: Number(host.height) || stock.stockHeight,
      nominalHeight: stock.stockHeight,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      mountBottom: 0,
      styleId: host.styleId ?? input.styleId,
      // A finished side is read from these two fields. The panel deliberately
      // carries no `autoPlacedReason`: this is an owner rule for every line, not
      // the frameless/hickory exposed-side pass, so that pass must never sweep it.
      autoPlacedForUid: host.uid,
      autoPlacedSide: request.side,
      fieldModificationNote: `Auto-added: finished end panel on the outside of ${host.masterCode} beside the range. Cut from ${stock.masterCode}.`,
    };
    const accepted = appendCollisionFreePlacements(working, [panel], input.room);
    const seated = accepted.rejected.length === 0 && accepted.placed.some((item) => item.uid === panel.uid);
    if (!seated) {
      skipped.push({ ...request, reason: "the run has no free 3/4″ outside it for the panel board" });
      continue;
    }
    working = accepted.placed;
    additions.push(panel);
    notes.push(`${stock.masterCode} finishes the outside of ${host.masterCode} beside the range.`);
  }
  return { placed: working, additions, notes, skipped };
}
