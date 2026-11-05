/**
 * The over-range answer the kitchen asks once and then keeps.
 *
 * The design questions ask what goes above the range — a hood, a bridge with an
 * over-range microwave, or nothing. PR 174 removed the in-build hood fallback so
 * the question could decide, and left the range open. That is right during the
 * build, but it left the answer in a transient dialog: nothing remembered it, and
 * a plan loaded later sat with a bare range because `planOverRangeCompanions`
 * only ever ran inside `autoDesignLayout.ts`.
 *
 * The rule this module holds:
 *
 *   1. The answer the person gave is persisted with the layout and is used first,
 *      every time the plan is built or loaded.
 *   2. With no answer, the fallback chain runs ONLY when there is nothing above
 *      the range: a W30xx bridge (height from the upper line) plus the over-range
 *      microwave that matches the range width, else a `HOOD-` item.
 *   3. It is ADD-ONLY. An existing bridge or microwave is never deleted or moved,
 *      and nothing here edits a placement.
 *
 * The microwave code stays `MW-…` because `isMicrowaveOverRangePair`
 * (`client/src/lib/design.ts`) recognises an over-range appliance only by that
 * prefix; the W30 bridge is a `wall` cabinet flagged `overRangeMicrowaveBridge`.
 */
import {
  appendCollisionFreePlacements,
  isHoodOverRangePair,
  isMicrowaveOverRangePair,
  isOverRangeMicrowave,
  isRangeOrOven,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import {
  overRangeBridgeFor,
  overRangeCompanionPlacements,
  overRangeCompanionPlanFor,
  overRangeMicrowaveFor,
  planOverRangeCompanions,
  type OverRangeAnswer,
} from "./overRangeCompanion";
import { autoDesignRangeHood, autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";

export type OverRangeAnswerValue = NonNullable<OverRangeAnswer>;
export const OVER_RANGE_ANSWERS: readonly OverRangeAnswerValue[] = ["microwave-bridge", "hood", "open"] as const;

/** Where the answer came from on this pass. */
export type OverRangeSource = "answer" | "fallback-bridge" | "fallback-hood" | "none";

export type OverRangeFillResult = {
  /** The placed cabinets, with anything added. Identical when nothing was added. */
  placed: PlacedCabinet[];
  source: OverRangeSource;
  /** Plain-language notes for the toast/review list. Empty when nothing happened. */
  notes: string[];
  /** True when at least one cabinet was added. */
  added: boolean;
};

/** True when the value really is one of the three answers people can give. */
export function isOverRangeAnswer(value: unknown): value is OverRangeAnswerValue {
  return typeof value === "string" && (OVER_RANGE_ANSWERS as readonly string[]).includes(value);
}

/** A stored answer, or null. Anything unrecognised is treated as "never asked". */
export function readOverRangeAnswer(value: unknown): OverRangeAnswerValue | null {
  return isOverRangeAnswer(value) ? value : null;
}

/** True when something already sits above this range: a hood, a bridge, or a microwave. */
export function overRangeIsOccupied(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
  room: RoomData,
): boolean {
  return !autoDesignRangeNeedsVentilation(placed, range);
}

/** Every range in the plan, in placement order. */
export function rangesInPlan(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
}

/** The over-range microwave already mounted on this range, if any. */
export function existingOverRangeMicrowave(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
): PlacedCabinet | null {
  return placed.find((item) => item.uid !== range.uid && isOverRangeMicrowave(item) && isMicrowaveOverRangePair(item, range)) ?? null;
}

/** The hood already over this range, if any. */
export function existingOverRangeHood(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
): PlacedCabinet | null {
  return placed.find((item) => item.uid !== range.uid && isHoodOverRangePair(item, range)) ?? null;
}

/** A WallSide for the range's wall, or null when it is not on a room wall. */
function rangeWall(range: PlacedCabinet): WallSide | null {
  const wall = range.wallId;
  return wall === "top" || wall === "bottom" || wall === "left" || wall === "right" ? wall : null;
}

/**
 * Add the answer's companions, or run the add-only fallback chain.
 *
 * Call it after every DesignTool build and on layout load. It never removes,
 * replaces, or moves a placement: every addition goes through
 * `appendCollisionFreePlacements`, and anything that does not fit is reported
 * instead of forced.
 */
export function fillOverRangeAnswer(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** The persisted answer, when the kitchen already asked. */
  answer?: unknown;
  appliancePalette: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  wallCabinetHeightIn: number;
  styleId: number | null;
  makeUid: () => string;
}): OverRangeFillResult {
  const placed = [...input.placed];
  const answer = readOverRangeAnswer(input.answer);
  const ranges = rangesInPlan(placed);
  if (ranges.length === 0) return { placed, source: "none", notes: [], added: false };

  const notes: string[] = [];
  let working = placed;
  let source: OverRangeSource = "none";
  let added = false;

  for (const range of ranges) {
    // Nothing to do when something is already above this range. This is what makes
    // the pass add-only and idempotent: an existing bridge or microwave is kept.
    if (overRangeIsOccupied(working, range, input.room)) continue;

    if (answer === "open") {
      notes.push(`Range ${range.masterCode} is left open above, as answered.`);
      continue;
    }

    if (answer === "microwave-bridge") {
      const companions = planOverRangeCompanions({
        answer,
        placed: working,
        room: input.room,
        appliancePalette: input.appliancePalette,
        wallCatalog: input.wallCatalog,
        wallCabinetHeightIn: input.wallCabinetHeightIn,
      });
      if (companions.ok) {
        const drafts = overRangeCompanionPlacements(companions.plan, { makeUid: input.makeUid, styleId: input.styleId });
        const accepted = appendCollisionFreePlacements(working, drafts, input.room);
        if (accepted.rejected.length === 0) {
          working = accepted.placed;
          source = "answer";
          added = true;
          notes.push(`${companions.plan.bridge.masterCode} and ${companions.plan.microwave.masterCode} were placed above ${companions.plan.rangeCode} as answered.`);
          continue;
        }
        notes.push(`The ${companions.plan.bridge.masterCode} bridge or the ${companions.plan.microwave.masterCode} microwave did not fit above ${range.masterCode}; nothing was added.`);
      } else {
        notes.push(...companions.findings.map((finding) => finding.detail));
      }
      // The answer could not be honored, so fall through to the fallback chain
      // rather than leaving the range bare.
    }

    if (answer === "hood") {
      const hood = autoDesignRangeHood({ range, room: input.room, palette: input.appliancePalette, uid: input.makeUid() });
      if (!hood.ok) {
        notes.push(hood.message);
        continue;
      }
      const accepted = appendCollisionFreePlacements(working, [hood.hood], input.room);
      if (accepted.rejected.length > 0 || !accepted.placed.some((item) => item.uid === hood.hood.uid)) {
        notes.push(`The hood needs a clear upper-wall span above ${range.masterCode}; existing cabinets were left unchanged.`);
        continue;
      }
      working = accepted.placed;
      source = "answer";
      added = true;
      notes.push(`${hood.hood.masterCode} was centered above ${range.masterCode} as answered.`);
      continue;
    }

    // Fallback chain: W30xx bridge + matching microwave, else a HOOD- item.
    const mic = overRangeMicrowaveFor(Number(range.width) || 0, input.appliancePalette);
    const bridge = overRangeBridgeFor({
      rangeWidthIn: Number(range.width) || 0,
      wallCabinetHeightIn: input.wallCabinetHeightIn,
      wallCatalog: input.wallCatalog,
    });
    if (mic && bridge) {
      const plan = overRangeCompanionPlanFor({ range, room: input.room, microwave: mic, bridge });
      const bridgeDraft = overRangeCompanionPlacements(plan, { makeUid: input.makeUid, styleId: input.styleId });
      const accepted = appendCollisionFreePlacements(working, bridgeDraft, input.room);
      if (accepted.rejected.length === 0) {
        working = accepted.placed;
        source = "fallback-bridge";
        added = true;
        notes.push(`${bridge.masterCode} and ${mic.masterCode} were added above ${range.masterCode}: nothing was above the range and no answer was saved.`);
        continue;
      }
    }
    const hood = autoDesignRangeHood({ range, room: input.room, palette: input.appliancePalette, uid: input.makeUid() });
    if (hood.ok) {
      const accepted = appendCollisionFreePlacements(working, [hood.hood], input.room);
      if (accepted.rejected.length === 0 && accepted.placed.some((item) => item.uid === hood.hood.uid)) {
        working = accepted.placed;
        source = "fallback-hood";
        added = true;
        notes.push(`${hood.hood.masterCode} was centered above ${range.masterCode}: nothing was above the range and no bridge could be seated.`);
        continue;
      }
    }
    const wall = rangeWall(range);
    notes.push(wall
      ? `Nothing could be added above ${range.masterCode}: no bridge fit and no hood could reach a clear span.`
      : `Nothing could be added above ${range.masterCode}: the range is not on a room wall.`);
  }

  return { placed: working, source, notes, added };
}

/**
 * The answer to save with the layout. A saved answer is the person's decision and
 * is never overwritten by a fallback: an "open" range stays open, and a range the
 * fallback dressed keeps "no answer" so the next load re-runs the same chain
 * instead of claiming the person chose something.
 */
export function overRangeAnswerToPersist(previous: unknown, chosen: unknown): OverRangeAnswerValue | null {
  const chosenAnswer = readOverRangeAnswer(chosen);
  if (chosenAnswer) return chosenAnswer;
  return readOverRangeAnswer(previous);
}
