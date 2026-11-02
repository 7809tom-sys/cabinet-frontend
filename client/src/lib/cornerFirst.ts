/**
 * Rule 2: corner-first. Before any other cabinet goes on the two adjoining runs, the corner is
 * planned against the anchors that are already seated. The planner compares, on real catalog
 * rows only:
 *
 *   - a blind corner at its configured pull,
 *   - the same blind corner pulled further (a 36" blind base pulled 6" fills a 42" leg),
 *   - a straight base in the corner square,
 *   - and the same options after the allowed 3" appliance wiggle.
 *
 * "Waste" is the dead corner area no cabinet body fills: the inches a box takes along its run
 * beyond the 24" depth it reaches into the perpendicular run, less any deliberate blind pull.
 * A fitting blind corner therefore beats a straight base of the same nominal width, because the
 * blind cabinet's own door reaches into that space. Least waste wins.
 *
 * This module is deliberately pure: it plans, it does not place. `seatAutoDesignCornerFromCatalog`
 * owns the physical seating, filler and appliance-nudge work.
 */
import { BLIND_OPEN_LEG_IN } from "./cornerFit";
import {
  STD,
  blindPullRange,
  cabinetWall,
  dim,
  isBlindCorner,
  isFillerItem,
  isPanelItem,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** Least-waste threshold: a difference under this is a tie. */
export const CORNER_WASTE_EPSILON_IN = 1 / 16;

/** One evaluated corner idea. */
export type CornerFirstCandidate = {
  kind: "blind" | "blind-pulled" | "straight";
  /** Source catalog row (always a real, purchasable cabinet). */
  source: DesignCabinet;
  /** Width the cabinet occupies on its run. */
  widthIn: number;
  /** Extra distance the cabinet is pulled off the corner vertex, in inches. */
  pullIn: number;
  /** Run the cabinet's width follows. */
  runWallId: string;
  /** What is left of each leg after this cabinet, for the tiling stage. */
  legRemainders: { wallId: string; remainderIn: number }[];
  /**
   * Dead corner inches this option leaves: the run length the box takes past the depth it
   * reaches into the perpendicular run, less the pull that a blind cabinet's door reaches into.
   */
  wasteIn: number;
  /** True when the option only fits after an appliance moves within its wiggle limit. */
  requiresWiggle: boolean;
  /** Ordering key: least waste, then a real corner before a straight base, then largest, then least pull. */
  score: number;
};

export type CornerFirstPlanInput = {
  /** Real base-corner catalog rows of the selected line. */
  cornerOptions: readonly DesignCabinet[];
  /** Real straight base rows, for the straight-base fallback. */
  straightBaseCatalog: readonly DesignCabinet[];
  room: RoomData;
  /** The two engine walls that meet at this corner. */
  cornerWallIds: readonly string[];
  /** Shared vertex of the two runs. */
  corner: { x: number; y: number };
  /** Cabinets and appliances already seated (the anchors). */
  placed: readonly PlacedCabinet[];
  /** How far each appliance may slide to make the corner fit. */
  wiggleLimitIn?: number;
  /** Open leg of a blind corner, 24" + the required filler unless Kitchen Rules stores another. */
  blindOpenLegIn?: number;
};

/** Free length of each of the two runs, measured from the corner vertex, after the anchors. */
export function cornerLegClearance(input: {
  room: RoomData;
  cornerWallIds: readonly string[];
  corner: { x: number; y: number };
  placed: readonly PlacedCabinet[];
}): { wallId: string; clearIn: number }[] {
  return input.cornerWallIds.map((wallId) => {
    const frame = wallRunFrame(wallId, input.room);
    if (!frame) return { wallId, clearIn: 0 };
    const atStart = Math.hypot(frame.start.x - input.corner.x, frame.start.y - input.corner.y) <= 0.01;
    // Distance from the shared vertex along the run, growing away from the corner.
    const fromVertex = (along: number) => Math.max(0, atStart ? along : frame.length - along);
    let clearIn = frame.length;
    for (const item of input.placed) {
      if (item.islandFace) continue;
      if (cabinetWall(item, input.room) !== wallId) continue;
      if (isFillerItem(item) || isPanelItem(item)) continue;
      const start = wallRunOffset(item, wallId, input.room);
      const span = wallRunSpan(item, wallId, input.room);
      if (!(span > 0)) continue;
      const near = Math.min(fromVertex(start), fromVertex(start + span));
      clearIn = Math.min(clearIn, near);
    }
    return { wallId, clearIn: Math.round(Math.max(0, clearIn) * 1000) / 1000 };
  });
}

function legRemainders(
  legs: readonly { wallId: string; clearIn: number }[],
  occupied: Record<string, number>,
): { wallId: string; remainderIn: number }[] {
  return legs.map((leg) => ({
    wallId: leg.wallId,
    remainderIn: Math.round(Math.max(0, leg.clearIn - (occupied[leg.wallId] ?? 0)) * 1000) / 1000,
  }));
}

/**
 * Dead corner inches for a box of `widthIn` that reaches `depthIn` into the perpendicular run
 * and is pulled `pullIn` off the vertex. A blind cabinet's door swings into the pull, so the pull
 * is real usable clearance; a straight base has none.
 */
export function cornerDeadInches(widthIn: number, depthIn: number, pullIn: number): number {
  return Math.round(Math.max(0, widthIn - depthIn - Math.max(0, pullIn)) * 1000) / 1000;
}

function scoreOf(candidate: Omit<CornerFirstCandidate, "score">): number {
  const cornerBonus = candidate.kind === "straight" ? 0 : 1;
  return candidate.wasteIn * 1000 - cornerBonus * 10 - candidate.widthIn * 0.01 + candidate.pullIn * 0.0001;
}

/**
 * Every corner idea worth considering, best first.
 *
 * A blind corner owns its full width on the leg it runs along and the open leg (24" + filler) on
 * the other. Pulling it further fills the leg it runs along, which is how a BBC36 fills a 42" leg.
 */
export function planCornerFirst(input: CornerFirstPlanInput): CornerFirstCandidate[] {
  const legs = cornerLegClearance(input);
  if (legs.length < 2) return [];
  const openLeg = input.blindOpenLegIn ?? kitchenRuleNumber("blind_open_leg_in") ?? BLIND_OPEN_LEG_IN;
  const wiggleLimit = Math.max(0, input.wiggleLimitIn ?? kitchenRuleNumber("jog_max_in"));
  const candidates: CornerFirstCandidate[] = [];

  for (const source of input.cornerOptions) {
    const width = dim(source.width, 0);
    const depth = Math.max(0, dim(source.depth, STD.BASE_DEPTH));
    if (!(width > 0) || !isBlindCorner(source.masterCode, source.description ?? undefined, source.cornerType ?? null)) continue;
    const range = blindPullRange({ pullMin: source.pullMin, pullMax: source.pullMax, width, nominalWidth: width });
    const minimumPull = range?.min ?? 0;
    const pulls = Array.from(new Set([minimumPull, range?.max ?? 6].map((pull) => Math.round(pull * 8) / 8)))
      .filter((pull) => pull >= 0)
      .sort((a, b) => a - b);
    for (const runLeg of legs) {
      const otherLeg = legs.find((leg) => leg.wallId !== runLeg.wallId);
      if (!otherLeg) continue;
      for (const pull of pulls) {
        const runNeeded = width + pull;
        const fitsRun = runLeg.clearIn + wiggleLimit + 0.05 >= runNeeded;
        const fitsOther = otherLeg.clearIn + wiggleLimit + 0.05 >= openLeg;
        if (!fitsRun || !fitsOther) continue;
        const remainders = legRemainders(legs, { [runLeg.wallId]: runNeeded, [otherLeg.wallId]: openLeg });
        const partial = {
          kind: pull > minimumPull + CORNER_WASTE_EPSILON_IN ? "blind-pulled" as const : "blind" as const,
          source,
          widthIn: width,
          pullIn: pull,
          runWallId: runLeg.wallId,
          legRemainders: remainders,
          wasteIn: cornerDeadInches(width, depth, pull),
          requiresWiggle: runLeg.clearIn + 0.05 < runNeeded || otherLeg.clearIn + 0.05 < openLeg,
        };
        candidates.push({ ...partial, score: scoreOf(partial) });
      }
    }
  }

  // Straight base in the corner square: the largest real base that fits the tighter leg.
  const tightest = Math.min(...legs.map((leg) => leg.clearIn));
  for (const source of input.straightBaseCatalog) {
    const width = dim(source.width, 0);
    const depth = Math.max(0, dim(source.depth, STD.BASE_DEPTH));
    if (!(width > 0)) continue;
    if (width > tightest + wiggleLimit + 0.05) continue;
    const remainders = legRemainders(legs, Object.fromEntries(legs.map((leg) => [leg.wallId, width])));
    const partial = {
      kind: "straight" as const,
      source,
      widthIn: width,
      pullIn: 0,
      runWallId: legs[0]!.wallId,
      legRemainders: remainders,
      wasteIn: cornerDeadInches(width, depth, 0),
      requiresWiggle: legs.some((leg) => leg.clearIn + 0.05 < width),
    };
    candidates.push({ ...partial, score: scoreOf(partial) });
  }

  return candidates.sort((left, right) => (
    left.score - right.score
    || left.source.masterCode.localeCompare(right.source.masterCode)
  ));
}

/**
 * The single corner plan the build uses: least waste, and a fitting blind corner beats a straight
 * base. Null means neither can close this corner, so the caller lists it for review instead of
 * substituting something.
 */
export function pickCornerFirst(input: CornerFirstPlanInput): CornerFirstCandidate | null {
  return planCornerFirst(input)[0] ?? null;
}

/** True when the winning plan is a blind corner pulled beyond its configured minimum. */
export function cornerFirstWasPulled(candidate: CornerFirstCandidate | null): boolean {
  return candidate?.kind === "blind-pulled";
}

/** Human sentence for the review list. */
export function describeCornerFirst(candidate: CornerFirstCandidate): string {
  const leg = candidate.legRemainders.map((entry) => `${entry.remainderIn}″`).join(" / ");
  if (candidate.kind === "straight") {
    return `${candidate.source.masterCode} straight base in the corner square, leaving ${leg}.`;
  }
  return `${candidate.source.masterCode} blind corner${candidate.pullIn > 0 ? ` pulled ${candidate.pullIn}″` : ""}, leaving ${leg}.`;
}
