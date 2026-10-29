import { autoDesignCornerFamily, type AutoBuildCornerCandidate } from "./autoDesignCornerStage";
import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  STD,
  cabinetWall,
  dim,
  wallRunAlongAtPoint,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** Open leg of a blind corner: 24 inch base depth plus the required 3 inch filler, unless Kitchen Rules stores another length. */
export const BLIND_OPEN_LEG_IN = STD.BASE_DEPTH + BLIND_CORNER_FILLER_WIDTH_IN;
function blindOpenLegIn(): number {
  return kitchenRuleNumber("blind_open_leg_in");
}

export type CornerFitOption = {
  id: number;
  masterCode: string;
  width?: string | number | null;
  description?: string | null;
  cornerType?: string | null;
  placement?: string | null;
};

export type CornerSinkPlan = {
  widthIn: number;
  /** Distance from the corner to the sink base's near edge. */
  startFromCornerIn: number;
  centerFromCornerIn: number;
  shiftFromPlumbingIn: number;
};

export type CornerFitRejection = {
  id: number;
  masterCode: string;
  reason: string;
};

export type PlumbingCornerPlan = {
  selected: { id: number; masterCode: string; widthIn: number } | null;
  /** The blind portion sits on this leg. Null for a square corner. */
  blindLeg: "plumbing" | "other" | null;
  sink: CornerSinkPlan | null;
  rejected: CornerFitRejection[];
  blockedMessage: string | null;
  fallbackNote: string | null;
};

type LegName = "plumbing" | "other";

function optionWidth(option: CornerFitOption): number {
  const coded = `${option.masterCode}`.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/(\d{2})$/);
  const fromCode = coded ? Number(coded[1]) : Number.NaN;
  const stored = dim(option.width == null ? null : String(option.width), Number.NaN);
  if (/^(?:BBC|WBC|BBL|BBR)/.test(`${option.masterCode}`.toUpperCase().replace(/[^A-Z0-9]/g, "")) && Number.isFinite(fromCode)) {
    return fromCode;
  }
  if (Number.isFinite(stored) && stored > 0) return stored;
  return Number.isFinite(fromCode) ? fromCode : 0;
}

function isBlind(option: CornerFitOption): boolean {
  return autoDesignCornerFamily(option as AutoBuildCornerCandidate) === "blind";
}

function inches(value: number): string {
  return `${Math.round(value * 8) / 8}"`;
}

/**
 * Place a sink base after `occupied` inches of corner, keeping its center
 * within the shift limit of the plumbing center. The smallest shift wins.
 */
export function placeSinkAfterCorner(input: {
  occupiedIn: number;
  availableIn: number;
  plumbingCenterFromCornerIn: number;
  sinkWidthIn: number;
  shiftLimitIn?: number;
}): { ok: true; sink: CornerSinkPlan } | { ok: false; sink: CornerSinkPlan; reason: string } {
  const shiftLimit = input.shiftLimitIn ?? kitchenRuleNumber("jog_max_in");
  const minStart = input.occupiedIn;
  const maxStart = input.availableIn - input.sinkWidthIn;
  const idealStart = input.plumbingCenterFromCornerIn - input.sinkWidthIn / 2;
  const low = idealStart - shiftLimit;
  const high = idealStart + shiftLimit;
  const forcedCenter = minStart + input.sinkWidthIn / 2;
  const forced: CornerSinkPlan = {
    widthIn: input.sinkWidthIn,
    startFromCornerIn: minStart,
    centerFromCornerIn: forcedCenter,
    shiftFromPlumbingIn: Math.abs(forcedCenter - input.plumbingCenterFromCornerIn),
  };
  if (maxStart < minStart - 1e-6) {
    return {
      ok: false,
      sink: forced,
      reason: `only ${inches(input.availableIn)} remains and a ${inches(input.sinkWidthIn)} sink base does not fit after ${inches(input.occupiedIn)} of corner`,
    };
  }
  const lo = Math.max(minStart, low);
  const hi = Math.min(maxStart, high);
  if (lo > hi + 1e-6) {
    return {
      ok: false,
      sink: forced,
      reason: `a ${inches(input.sinkWidthIn)} sink base would center at ${inches(forcedCenter)}, ${inches(forced.shiftFromPlumbingIn)} from the ${inches(input.plumbingCenterFromCornerIn)} plumbing, past the ${inches(shiftLimit)} shift`,
    };
  }
  const start = Math.min(Math.max(idealStart, lo), hi);
  const center = start + input.sinkWidthIn / 2;
  return {
    ok: true,
    sink: {
      widthIn: input.sinkWidthIn,
      startFromCornerIn: Math.round(start * 8) / 8,
      centerFromCornerIn: Math.round(center * 8) / 8,
      shiftFromPlumbingIn: Math.abs(center - input.plumbingCenterFromCornerIn),
    },
  };
}

function occupancy(option: CornerFitOption, blindOn: LegName | null): { plumbing: number; other: number } {
  const width = optionWidth(option);
  if (!isBlind(option) || !blindOn) return { plumbing: width, other: width };
  return blindOn === "plumbing"
    ? { plumbing: width, other: blindOpenLegIn() }
    : { plumbing: blindOpenLegIn(), other: width };
}

function legFits(occupied: number, available: number): boolean {
  return occupied <= available + 0.05;
}

/**
 * Plumbing at a measured distance from the corner, sink centered on it within 3".
 * A lazy Susan uses its width on both legs. A blind corner uses 24" + 3" filler
 * on the open leg and its full width on the blind leg. The blind leg is the one
 * with more room. Ties put the blind on the wall that does not hold the plumbing
 * so the door faces the open run. The largest blind corner that fits is the
 * fallback. "No corner cabinet fits" is used only when the smallest blind fails.
 */
export function planCornerBesidePlumbing(input: {
  plumbingCenterFromCornerIn: number;
  sinkWidthIn: number;
  plumbingLegAvailableIn: number;
  otherLegAvailableIn: number;
  options: readonly CornerFitOption[];
  shiftLimitIn?: number;
}): PlumbingCornerPlan {
  const rejected: CornerFitRejection[] = [];
  const available = { plumbing: input.plumbingLegAvailableIn, other: input.otherLegAvailableIn };
  const preferredBlind: LegName = available.other > available.plumbing + 0.01
    ? "other"
    : available.plumbing > available.other + 0.01
      ? "plumbing"
      : "other";

  type Fit = {
    option: CornerFitOption;
    widthIn: number;
    blindLeg: LegName | null;
    sink: CornerSinkPlan;
  };
  const fits: Fit[] = [];

  const tryOrientation = (option: CornerFitOption, blindLeg: LegName | null): { ok: true; fit: Fit } | { ok: false; reason: string } => {
    const widthIn = optionWidth(option);
    const legs = occupancy(option, blindLeg);
    if (!legFits(legs.plumbing, available.plumbing) || !legFits(legs.other, available.other)) {
      return {
        ok: false,
        reason: `${option.masterCode} needs ${inches(legs.plumbing)} on the plumbing wall and ${inches(legs.other)} on the other wall, and one of those legs is shorter than that.`,
      };
    }
    const sink = placeSinkAfterCorner({
      occupiedIn: legs.plumbing,
      availableIn: available.plumbing,
      plumbingCenterFromCornerIn: input.plumbingCenterFromCornerIn,
      sinkWidthIn: input.sinkWidthIn,
      shiftLimitIn: input.shiftLimitIn,
    });
    if (!sink.ok) {
      return {
        ok: false,
        reason: `${option.masterCode} takes ${inches(legs.plumbing)} on the plumbing wall, so ${sink.reason}.`,
      };
    }
    return { ok: true, fit: { option, widthIn, blindLeg, sink: sink.sink } };
  };

  for (const option of input.options) {
    const orientations: Array<LegName | null> = isBlind(option)
      ? [preferredBlind, preferredBlind === "other" ? "plumbing" : "other"]
      : [null];
    let accepted: Fit | null = null;
    let reason = `${option.masterCode} does not fit this corner.`;
    for (const blindLeg of orientations) {
      const trial = tryOrientation(option, blindLeg);
      if (trial.ok) { accepted = trial.fit; break; }
      reason = trial.reason;
    }
    if (accepted) fits.push(accepted);
    else rejected.push({ id: option.id, masterCode: option.masterCode, reason });
  }

  const squares = fits
    .filter((fit) => fit.blindLeg == null)
    .sort((left, right) => right.widthIn - left.widthIn || left.option.masterCode.localeCompare(right.option.masterCode));
  const blinds = fits
    .filter((fit) => fit.blindLeg != null)
    .sort((left, right) => right.widthIn - left.widthIn || left.option.masterCode.localeCompare(right.option.masterCode));
  const selected = squares[0] ?? blinds[0] ?? null;
  if (!selected) {
    return {
      selected: null,
      blindLeg: null,
      sink: null,
      rejected,
      blockedMessage: "No corner cabinet fits. Even the smallest blind corner leaves the sink or a fixed wall constraint outside the 3 inch shift.",
      fallbackNote: null,
    };
  }
  const fellBack = selected.blindLeg != null && squares.length === 0 && input.options.some((option) => !isBlind(option));
  return {
    selected: { id: selected.option.id, masterCode: selected.option.masterCode, widthIn: selected.widthIn },
    blindLeg: selected.blindLeg,
    sink: selected.sink,
    rejected: rejected.filter((entry) => entry.id !== selected.option.id),
    blockedMessage: null,
    fallbackNote: fellBack
      ? `${input.options.find((option) => !isBlind(option))?.masterCode ?? "The square corner"} does not leave the sink within 3" of the plumbing. ${selected.option.masterCode} is placed instead, with the blind side on the ${selected.blindLeg} wall.`
      : null,
  };
}

export type AutoDesignCornerFit = {
  offeredIds: number[];
  selectedId: number | null;
  /** Wall the blind cabinet's width runs along. Square corners keep the slot wall. */
  placementWallById: Record<number, string>;
  sinkShiftByOptionId: Record<number, { wallId: string; start: number } | null>;
  rejected: CornerFitRejection[];
  blockedMessage: string | null;
  fallbackNote: string | null;
};

function distanceFromCorner(cornerAlong: number, point: number): number {
  return Math.abs(point - cornerAlong);
}

/**
 * Inches of clear run from a corner along one wall, stopping at the first
 * appliance, cabinet, opening, or wall end. This is the room the blind side
 * can use; it does not add the appliance jog.
 */
export function cornerLegClearIn(input: {
  room: RoomData;
  placed: readonly PlacedCabinet[];
  corner: { x: number; y: number };
  wallId: string;
  openings?: readonly WallOpening[];
}): number | null {
  const frame = wallRunFrame(input.wallId, input.room);
  if (!frame) return null;
  const cornerAlong = wallRunAlongAtPoint(frame, input.corner);
  const towardEnd = cornerAlong <= frame.length / 2;
  let available = towardEnd ? frame.length - cornerAlong : cornerAlong;
  for (const opening of input.openings ?? []) {
    if (opening.side !== input.wallId) continue;
    const near = towardEnd ? opening.offset : opening.offset + opening.width;
    const gap = towardEnd ? near - cornerAlong : cornerAlong - near;
    if (gap > 0.5) available = Math.min(available, gap);
  }
  for (const item of input.placed) {
    if (cabinetWall(item, input.room) !== input.wallId) continue;
    const start = wallRunOffset(item, input.wallId, input.room);
    const end = start + wallRunSpan(item, input.wallId, input.room);
    const near = towardEnd ? start : end;
    const gap = towardEnd ? near - cornerAlong : cornerAlong - near;
    if (gap <= 0.5) continue;
    available = Math.min(available, gap);
  }
  return available;
}

/** The adjoining wall with more clear run. Ties keep the first wall in the list. */
export function preferredBlindRunWallId(input: {
  room: RoomData;
  placed: readonly PlacedCabinet[];
  corner: { x: number; y: number };
  wallIds: readonly string[];
  openings?: readonly WallOpening[];
  excludedWallIds?: readonly string[];
}): string | null {
  const excluded = new Set(input.excludedWallIds ?? []);
  let best: { id: string; room: number } | null = null;
  for (const wallId of input.wallIds) {
    if (excluded.has(wallId)) continue;
    const room = cornerLegClearIn({ ...input, wallId });
    if (room == null) continue;
    if (!best || room > best.room + 0.01) best = { id: wallId, room };
  }
  return best?.id ?? null;
}

/**
 * Room-backed corner filter. The placed sink's center is the plumbing anchor.
 * There is no separate plumbing object in the room model.
 */
export function evaluateAutoDesignCornerFit(input: {
  options: readonly AutoBuildCornerCandidate[];
  room: RoomData;
  placed: readonly PlacedCabinet[];
  corner: { x: number; y: number };
  wallIds: readonly [string, string];
  sink?: PlacedCabinet | null;
  openings?: readonly WallOpening[];
  shiftLimitIn?: number;
}): AutoDesignCornerFit {
  const openings = input.openings ?? [];
  const metrics = input.wallIds.map((wallId) => {
    const frame = wallRunFrame(wallId, input.room);
    if (!frame) return null;
    const cornerAlong = wallRunAlongAtPoint(frame, input.corner);
    const towardEnd = cornerAlong <= frame.length / 2;
    let available = towardEnd ? frame.length - cornerAlong : cornerAlong;
    for (const opening of openings) {
      if (opening.side !== wallId) continue;
      const near = towardEnd ? opening.offset : opening.offset + opening.width;
      const gap = towardEnd ? near - cornerAlong : cornerAlong - near;
      if (gap > 0.5) available = Math.min(available, gap);
    }
    for (const item of input.placed) {
      if (input.sink && item.uid === input.sink.uid) continue;
      if (cabinetWall(item, input.room) !== wallId) continue;
      const start = wallRunOffset(item, wallId, input.room);
      const end = start + wallRunSpan(item, wallId, input.room);
      const near = towardEnd ? start : end;
      const gap = towardEnd ? near - cornerAlong : cornerAlong - near;
      if (gap <= 0.5) continue;
      const slack = item.placement === "appliance" ? 3 : 0;
      available = Math.min(available, gap + slack);
    }
    let sinkCenter: number | null = null;
    let sinkWidth = 0;
    if (input.sink && cabinetWall(input.sink, input.room) === wallId) {
      const start = wallRunOffset(input.sink, wallId, input.room);
      sinkWidth = wallRunSpan(input.sink, wallId, input.room);
      sinkCenter = distanceFromCorner(cornerAlong, start + sinkWidth / 2);
    }
    return { wallId, available, sinkCenter, sinkWidth, cornerAlong, towardEnd };
  });
  const [first, second] = metrics;
  if (!first || !second) {
    return {
      offeredIds: input.options.map((option) => option.id),
      selectedId: input.options[0]?.id ?? null,
      placementWallById: {},
      sinkShiftByOptionId: {},
      rejected: [],
      blockedMessage: null,
      fallbackNote: null,
    };
  }
  const sinkLeg = first.sinkCenter != null ? first : second.sinkCenter != null ? second : null;
  const otherLeg = sinkLeg?.wallId === first.wallId ? second : first;
  if (!sinkLeg || sinkLeg.sinkCenter == null) {
    return {
      offeredIds: input.options.map((option) => option.id),
      selectedId: input.options[0]?.id ?? null,
      placementWallById: {},
      sinkShiftByOptionId: {},
      rejected: [],
      blockedMessage: null,
      fallbackNote: null,
    };
  }
  const plan = planCornerBesidePlumbing({
    plumbingCenterFromCornerIn: sinkLeg.sinkCenter,
    sinkWidthIn: sinkLeg.sinkWidth,
    plumbingLegAvailableIn: sinkLeg.available,
    otherLegAvailableIn: otherLeg.available,
    options: input.options,
    shiftLimitIn: input.shiftLimitIn,
  });
  const fittingIds = new Set(input.options.map((option) => option.id).filter((id) => !plan.rejected.some((entry) => entry.id === id) || plan.selected?.id === id));
  // Recompute each offered option's wall and sink start. Rejected ids stay out.
  const offered = input.options.filter((option) => {
    if (plan.selected?.id === option.id) return true;
    return !plan.rejected.some((entry) => entry.id === option.id);
  });
  const placementWallById: Record<number, string> = {};
  const sinkShiftByOptionId: Record<number, { wallId: string; start: number } | null> = {};
  for (const option of offered) {
    const blind = isBlind(option);
    const wallId = blind
      ? (plan.blindLeg === "plumbing" ? sinkLeg.wallId : otherLeg.wallId)
      : input.wallIds[0];
    placementWallById[option.id] = wallId;
    if (plan.sink && plan.selected?.id === option.id) {
      const centerFromCorner = plan.sink.centerFromCornerIn;
      const startFromCorner = plan.sink.startFromCornerIn;
      const start = sinkLeg.towardEnd
        ? sinkLeg.cornerAlong + startFromCorner
        : sinkLeg.cornerAlong - startFromCorner - sinkLeg.sinkWidth;
      sinkShiftByOptionId[option.id] = { wallId: sinkLeg.wallId, start: Math.round(start * 8) / 8 };
      void centerFromCorner;
    } else {
      sinkShiftByOptionId[option.id] = null;
    }
  }
  // Every fitting blind shares the chosen blind leg. Square corners that also
  // fit keep their own sink math via a second pass when they are selected.
  for (const option of offered) {
    if (isBlind(option) || sinkShiftByOptionId[option.id]) continue;
    const legs = occupancy(option, null);
    const sink = placeSinkAfterCorner({
      occupiedIn: legs.plumbing,
      availableIn: sinkLeg.available,
      plumbingCenterFromCornerIn: sinkLeg.sinkCenter,
      sinkWidthIn: sinkLeg.sinkWidth,
      shiftLimitIn: input.shiftLimitIn,
    });
    if (!sink.ok) continue;
    const start = sinkLeg.towardEnd
      ? sinkLeg.cornerAlong + sink.sink.startFromCornerIn
      : sinkLeg.cornerAlong - sink.sink.startFromCornerIn - sinkLeg.sinkWidth;
    sinkShiftByOptionId[option.id] = { wallId: sinkLeg.wallId, start: Math.round(start * 8) / 8 };
  }
  return {
    offeredIds: offered.map((option) => option.id).filter((id) => fittingIds.has(id) || plan.selected?.id === id),
    selectedId: plan.selected?.id ?? null,
    placementWallById,
    sinkShiftByOptionId,
    rejected: plan.rejected.filter((entry) => entry.id !== plan.selected?.id),
    blockedMessage: plan.blockedMessage,
    fallbackNote: plan.fallbackNote,
  };
}

export type { PlacedCabinet, RoomData, WallOpening };
