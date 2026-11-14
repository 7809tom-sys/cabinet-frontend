/**
 * Above the range: the BRIDGE is mandatory, the rest is add-only.
 *
 * Owner HARD RULE (Nov 5 2026): every auto-design build places a real bridge wall
 * cabinet above the range. It is not optional and not skippable by the pop-up
 * answer or by any fallback chain. The bridge goes in FIRST; a microwave and a hood
 * are then added by the existing add-only logic.
 *
 * Order of work, per range, on every build and every layout load:
 *
 *   1. MANDATORY BRIDGE. If a bridge is already over the range it is kept exactly
 *      as it is. Otherwise a real bridge box (`W30xx`/`W36xx`, 12–24" tall) matched
 *      to the range width is placed at the 72" datum, centered on the range.
 *      Nothing is ever deleted, replaced, or moved.
 *   2. MICROWAVE + HOOD, add-only, driven by the saved answer (or the fallback
 *      chain when there is no answer).
 *
 * No wall run tiles over the range (`upperReservedZones` in
 * `autoDesignSeamFillers.ts`), so the bridge always has its span.
 *
 * A bridge that genuinely cannot be seated is reported as a blocking finding with
 * the reason, never silently skipped.
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
import type { DesignerReviewFinding } from "./designerReviewFindings";
import {
  bridgeMissingAtRangeWidthReason,
  isBridgeOverRangeCabinet,
  lineSellsBridgeAtRangeWidth,
  overRangeBridgeFor,
  overRangeBridgePlacement,
  singleTopLineFor,
  overRangeBridgePlanFor,
  overRangeCompanionPlacements,
  overRangeCompanionPlanFor,
  overRangeMicrowaveFor,
  planOverRangeCompanions,
  rangeWallCeiling,
  DEFAULT_OVER_RANGE_ANSWER,
  type OverRangeAnswer,
} from "./overRangeCompanion";
import { autoDesignRangeHood, autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";

export type OverRangeAnswerValue = NonNullable<OverRangeAnswer>;
export const OVER_RANGE_ANSWERS: readonly OverRangeAnswerValue[] = ["microwave-bridge", "hood", "open"] as const;

/**
 * Where the over-range state came from on this pass.
 * `mandatory-bridge` is the bridge placed by the hard rule; `answer` and
 * `fallback-*` describe what was added on top of it.
 */
export type OverRangeSource =
  | "mandatory-bridge"
  | "mandatory-bridge-answer"
  | "mandatory-bridge-fallback"
  | "answer"
  | "fallback-bridge"
  | "fallback-hood"
  | "none";

export type OverRangeFillResult = {
  /** The placed cabinets, with anything added. Identical when nothing was added. */
  placed: PlacedCabinet[];
  source: OverRangeSource;
  /** Plain-language notes for the toast. Empty when nothing happened. */
  notes: string[];
  /** True when at least one cabinet was added. */
  added: boolean;
  /**
   * Blocking reasons for a bridge that could not be seated. These go on the
   * Designer's review list so a missing bridge is always explained, never silent.
   */
  findings: DesignerReviewFinding[];
  /** True when every range in the plan now has a bridge above it. */
  everyRangeBridged: boolean;
};

/** True when the value really is one of the three answers people can give. */
export function isOverRangeAnswer(value: unknown): value is OverRangeAnswerValue {
  return typeof value === "string" && (OVER_RANGE_ANSWERS as readonly string[]).includes(value);
}

/** A stored answer, or null. Anything unrecognised is treated as "never asked". */
export function readOverRangeAnswer(value: unknown): OverRangeAnswerValue | null {
  return isOverRangeAnswer(value) ? value : null;
}

/**
 * Auto Design no longer asks what goes above the range at the end of a build.
 * A saved or entered answer is kept; otherwise the kitchen-rules default
 * (microwave and bridge) is used so the add-only pass can dress the range,
 * and the report lists that default as something the shopper can still change.
 */
export function resolveAutoDesignOverRangeAnswer(value: unknown): {
  value: OverRangeAnswerValue;
  defaulted: boolean;
} {
  const read = readOverRangeAnswer(value);
  if (read) return { value: read, defaulted: false };
  return { value: DEFAULT_OVER_RANGE_ANSWER, defaulted: true };
}

/**
 * Every real range in the plan, in placement order.
 *
 * A microwave and a hood must be excluded: their own descriptions say "over-range"
 * and "range hood", so `isRangeOrOven` alone would read them as ranges and this
 * module would try to hang a bridge above a microwave.
 */
export function rangesInPlan(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((item) => (
    item.placement === "appliance"
    && isRangeOrOven(item.masterCode, item.description)
    && !isOverRangeMicrowave(item)
    && !/^HOOD[-_]/i.test(item.masterCode ?? "")
    && !/\bhood\b/i.test(item.description ?? "")
  ));
}

/** The bridge already over this range, if any. Never deleted or moved by this module. */
export function existingOverRangeBridge(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
  room: RoomData,
): PlacedCabinet | null {
  return placed.find((item) => isBridgeOverRangeCabinet(item, range, room)) ?? null;
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

/**
 * True when something already sits above this range: a bridge, a hood, or a
 * microwave. A bridge alone counts — the mandatory bridge is what the range is
 * dressed with, and the microwave/hood question is decided separately.
 */
export function overRangeIsOccupied(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
  room: RoomData,
): boolean {
  return overRangeHasBridge(placed, range, room) || !autoDesignRangeNeedsVentilation(placed, range);
}

/**
 * True when this range needs nothing more: it has its mandatory bridge AND a
 * microwave or hood above it. Used to skip a redundant pass; the pass itself is
 * idempotent, so a false answer only costs one cheap re-check.
 */
export function overRangeFullyDressed(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
  room: RoomData,
): boolean {
  return overRangeHasBridge(placed, range, room)
    && (existingOverRangeMicrowave(placed, range) != null || existingOverRangeHood(placed, range) != null);
}

/** True when this range has its mandatory bridge. */
export function overRangeHasBridge(
  placed: readonly PlacedCabinet[],
  range: PlacedCabinet,
  room: RoomData,
): boolean {
  return existingOverRangeBridge(placed, range, room) != null;
}

/** A WallSide for the range's wall, or null when it is not on a room wall. */
function rangeWall(range: PlacedCabinet): WallSide | null {
  const wall = range.wallId;
  return wall === "top" || wall === "bottom" || wall === "left" || wall === "right" ? wall : null;
}

const BRIDGE_RULE_ID = "bridge-above-range";

/** One blocking finding, named and specific, for a bridge that could not seat. */
function bridgeBlockedFinding(range: PlacedCabinet, detail: string): DesignerReviewFinding {
  return {
    ruleId: BRIDGE_RULE_ID,
    code: "range-bridge-blocked",
    severity: "warning",
    title: `No bridge cabinet above ${range.masterCode}`,
    detail,
    cabinetUid: range.uid,
    cabinetCode: range.masterCode,
  };
}

/**
 * Seat the mandatory bridge over one range. Never deletes, replaces, or moves
 * anything: an existing bridge is returned untouched, and the new box goes through
 * the shared collision gate.
 */
function seatMandatoryBridge(input: {
  placed: PlacedCabinet[];
  range: PlacedCabinet;
  room: RoomData;
  wallCatalog: readonly DesignCabinet[];
  wallCabinetHeightIn: number;
  styleId: number | null;
  makeUid: () => string;
}): { placed: PlacedCabinet[]; added: PlacedCabinet | null; finding: DesignerReviewFinding | null } {
  const { placed, range, room, wallCatalog, wallCabinetHeightIn } = input;
  if (existingOverRangeBridge(placed, range, room)) {
    return { placed, added: null, finding: null };
  }
  const wall = rangeWall(range);
  if (!wall) {
    return {
      placed,
      added: null,
      finding: bridgeBlockedFinding(range, `${range.masterCode} is not on a room wall, so there is nowhere to hang a bridge cabinet.`),
    };
  }
  const ceilingIn = rangeWallCeiling(range, room);
  const topLineIn = singleTopLineFor({ wallCatalog, wallCabinetHeightIn });
  const bridge = overRangeBridgeFor({
    rangeWidthIn: Number(range.width) || 0,
    wallCabinetHeightIn,
    wallCatalog,
    ceilingIn,
    topLineIn,
  });
  if (!bridge) {
    // Never a narrower stock width: no bridge at the range's own width is reported, not substituted.
    const sellsBridge = lineSellsBridgeAtRangeWidth(Number(range.width) || 0, wallCatalog);
    return {
      placed,
      added: null,
      finding: bridgeBlockedFinding(range, sellsBridge
        ? `The ${range.masterCode} wall's ${ceilingIn}″ ceiling leaves no room for a 12″–24″ bridge at the 72″ datum, so no bridge could be hung above the range.`
        : bridgeMissingAtRangeWidthReason(Number(range.width) || 0, null, "range")),
    };
  }
  // A frameless line's 12" bridge is a 12" tall box; other lines sell 13½" deep
  // uppers. Neither is a reason to skip the mandatory bridge, so its own catalog
  // depth and height are placed exactly as the line stores them.
  const plan = overRangeBridgePlanFor({ range, room, bridge });
  const draft = overRangeBridgePlacement(plan, { makeUid: input.makeUid, styleId: input.styleId });
  const accepted = appendCollisionFreePlacements(placed, [draft], room);
  if (accepted.rejected.length > 0 || !accepted.placed.some((item) => item.uid === draft.uid)) {
    return {
      placed,
      added: null,
      finding: bridgeBlockedFinding(range, `The ${bridge.masterCode} bridge needs ${Number(bridge.width) || 30}″ of clear upper wall centered above ${range.masterCode}, and that span is already occupied. Nothing was moved or removed to make room.`),
    };
  }
  // Issue #354 item 5: on a line with one wall top line the bridge must reach it.
  // When the tallest box the line sells still falls short, the bridge is placed
  // (never dropped) and the shortfall is named, so a low bridge is visible.
  if (topLineIn != null) {
    const bridgeTop = draft.mountBottom! + (Number(draft.height) || 0);
    if (bridgeTop < topLineIn - 0.51) {
      const shortfall = Math.round((topLineIn - bridgeTop) * 8) / 8;
      return {
        placed: accepted.placed,
        added: draft,
        finding: bridgeBlockedFinding(
          range,
          `${bridge.masterCode} is the tallest bridge the line sells at ${Math.round(Number(range.width) || 30)}″ and its top finishes at ${bridgeTop}″, ${shortfall}″ short of the ${topLineIn}″ wall-cabinet line. Choose a door line whose bridge reaches that line, or accept the lower bridge.`,
        ),
      };
    }
  }
  return { placed: accepted.placed, added: draft, finding: null };
}

/**
 * Seat the mandatory bridge over every range. Call this BEFORE the wall-cabinet run
 * tiles, so the run treats the bridge as an occupied upper and never lays an
 * ordinary wall cabinet over the range or leaves a sliver beside it.
 *
 * Never deletes, replaces, or moves anything: an existing bridge is kept as it is.
 */
export function placeMandatoryOverRangeBridges(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallCatalog: readonly DesignCabinet[];
  wallCabinetHeightIn: number;
  styleId: number | null;
  makeUid: () => string;
}): OverRangeFillResult {
  const initial = [...input.placed];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  let working = initial;
  let addedAny = false;

  for (const range of rangesInPlan(working)) {
    const seated = seatMandatoryBridge({
      placed: working,
      range,
      room: input.room,
      wallCatalog: input.wallCatalog,
      wallCabinetHeightIn: input.wallCabinetHeightIn,
      styleId: input.styleId,
      makeUid: input.makeUid,
    });
    if (seated.placed !== working) {
      working = seated.placed;
      addedAny = true;
      notes.push(`${seated.added!.masterCode} bridge was placed above ${range.masterCode}.`);
    }
    if (seated.finding) findings.push(seated.finding);
  }

  const finalRanges = rangesInPlan(working);
  return {
    placed: working,
    source: addedAny ? "mandatory-bridge" : "none",
    notes,
    added: addedAny,
    findings,
    everyRangeBridged: finalRanges.every((range) => overRangeHasBridge(working, range, input.room)),
  };
}

/**
 * Place the mandatory bridge, then let the existing add-only logic dress the rest of
 * the range.
 *
 * Call it after every build and on every layout load. It is idempotent: a second
 * pass sees the bridge and adds nothing.
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
  const initial = [...input.placed];
  const answer = readOverRangeAnswer(input.answer);
  const ranges = rangesInPlan(initial);
  if (ranges.length === 0) {
    return { placed: initial, source: "none", notes: [], added: false, findings: [], everyRangeBridged: true };
  }

  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  let working = initial;
  let addedAny = false;
  let bridgePlaced = false;

  // ── 1. The mandatory bridge, first, for every range ──────────────────────────
  for (const range of rangesInPlan(working)) {
    const seated = seatMandatoryBridge({
      placed: working,
      range,
      room: input.room,
      wallCatalog: input.wallCatalog,
      wallCabinetHeightIn: input.wallCabinetHeightIn,
      styleId: input.styleId,
      makeUid: input.makeUid,
    });
    if (seated.placed !== working) {
      working = seated.placed;
      addedAny = true;
      bridgePlaced = true;
      notes.push(`${seated.added!.masterCode} bridge was placed above ${range.masterCode}.`);
    }
    if (seated.finding) findings.push(seated.finding);
  }

  // ── 2. Microwave / hood: the existing add-only logic ─────────────────────────
  let source: OverRangeSource = bridgePlaced ? "mandatory-bridge" : "none";
  let addedByAnswerOrFallback = false;

  for (const range of rangesInPlan(working)) {
    // A bridge alone is not "ventilation": the microwave/hood question is separate.
    const hasMicrowave = existingOverRangeMicrowave(working, range) != null;
    const hasHood = existingOverRangeHood(working, range) != null;
    if (hasMicrowave || hasHood) continue;

    if (answer === "open") {
      notes.push(`Range ${range.masterCode} keeps its bridge and no microwave or hood, as answered.`);
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
        // The bridge is already seated; add only the microwave. An existing bridge
        // is never replaced by a different one.
        const drafts = overRangeCompanionPlacements(companions.plan, { makeUid: input.makeUid, styleId: input.styleId })
          .filter((draft) => draft.placement === "appliance");
        if (drafts.length === 0) continue;
        const accepted = appendCollisionFreePlacements(working, drafts, input.room);
        if (accepted.rejected.length === 0) {
          working = accepted.placed;
          addedAny = true;
          addedByAnswerOrFallback = true;
          source = bridgePlaced ? "mandatory-bridge-answer" : "answer";
          notes.push(`${companions.plan.microwave.masterCode} was placed above ${companions.plan.rangeCode} as answered.`);
          continue;
        }
        notes.push(`The ${companions.plan.microwave.masterCode} microwave did not fit above ${range.masterCode}; the bridge was kept and nothing else was added.`);
      } else {
        // A missing microwave is not a missing bridge: report the microwave only.
        notes.push(...companions.findings.map((finding) => finding.detail));
      }
    }

    if (answer === "hood") {
      const hood = autoDesignRangeHood({ range, room: input.room, palette: input.appliancePalette, uid: input.makeUid() });
      if (!hood.ok) {
        notes.push(hood.message);
        continue;
      }
      const accepted = appendCollisionFreePlacements(working, [hood.hood], input.room);
      if (accepted.rejected.length > 0 || !accepted.placed.some((item) => item.uid === hood.hood.uid)) {
        notes.push(`The hood needs a clear upper-wall span above ${range.masterCode}; the bridge was kept and nothing else was added.`);
        continue;
      }
      working = accepted.placed;
      addedAny = true;
      addedByAnswerOrFallback = true;
      source = bridgePlaced ? "mandatory-bridge-answer" : "answer";
      notes.push(`${hood.hood.masterCode} was centered above ${range.masterCode} as answered.`);
      continue;
    }

    // No answer (or the answer could not be honored): the existing fallback chain.
    // The bridge is already seated, so only the microwave is left to add; its
    // geometry is centered on that same bridge.
    const mic = overRangeMicrowaveFor(Number(range.width) || 0, input.appliancePalette);
    const seatedBridge = existingOverRangeBridge(working, range, input.room);
    if (mic && seatedBridge) {
      // Reuse the seated bridge's own catalog row so the microwave centers exactly
      // on the box already on the plan, whatever width it is.
      const bridgeSource = input.wallCatalog.find((row) => (
        row.masterCode === seatedBridge.masterCode
        && Math.abs((Number(row.width) || 0) - (Number(seatedBridge.width) || 0)) <= 0.05
      )) ?? null;
      if (bridgeSource) {
        const plan = overRangeCompanionPlanFor({ range, room: input.room, microwave: mic, bridge: bridgeSource });
        const microwaveDraft = overRangeCompanionPlacements(plan, { makeUid: input.makeUid, styleId: input.styleId })
          .filter((draft) => draft.placement === "appliance");
        const accepted = appendCollisionFreePlacements(working, microwaveDraft, input.room);
        if (accepted.rejected.length === 0) {
          working = accepted.placed;
          addedAny = true;
          addedByAnswerOrFallback = true;
          source = bridgePlaced ? "mandatory-bridge-fallback" : "fallback-bridge";
          notes.push(`${mic.masterCode} was added above the bridge on ${range.masterCode}: no answer was saved.`);
          continue;
        }
      }
    }
    const hood = autoDesignRangeHood({ range, room: input.room, palette: input.appliancePalette, uid: input.makeUid() });
    if (hood.ok) {
      const accepted = appendCollisionFreePlacements(working, [hood.hood], input.room);
      if (accepted.rejected.length === 0 && accepted.placed.some((item) => item.uid === hood.hood.uid)) {
        working = accepted.placed;
        addedAny = true;
        addedByAnswerOrFallback = true;
        source = bridgePlaced ? "mandatory-bridge-fallback" : "fallback-hood";
        notes.push(`${hood.hood.masterCode} was centered above ${range.masterCode}: no answer was saved and no microwave was available.`);
        continue;
      }
    }
    if (!bridgePlaced) {
      notes.push(`Nothing could be added above ${range.masterCode}.`);
    }
  }

  // A bridge-only pass still counts as a change.
  if (!addedByAnswerOrFallback && bridgePlaced) source = "mandatory-bridge";

  const finalRanges = rangesInPlan(working);
  return {
    placed: working,
    source,
    notes,
    added: addedAny,
    findings,
    everyRangeBridged: finalRanges.every((range) => overRangeHasBridge(working, range, input.room)),
  };
}

/**
 * The answer to save with the layout. A saved answer is the person's decision and
 * is never overwritten by a fallback: an "open" range stays open, and a range the
 * fallback dressed keeps "no answer" so the next load re-runs the same chain
 * instead of claiming the person chose something.
 *
 * The mandatory bridge is independent of this: it is placed whatever the answer is.
 */
export function overRangeAnswerToPersist(previous: unknown, chosen: unknown): OverRangeAnswerValue | null {
  const chosenAnswer = readOverRangeAnswer(chosen);
  if (chosenAnswer) return chosenAnswer;
  return readOverRangeAnswer(previous);
}
