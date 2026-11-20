import { applyBridgeAreaFillerRule, ensureBridgeHalfInchFillers, isBridgeHalfInchFiller, normalizeBridgeBoards } from "./bridgeHalfInchFillers";
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import { FRAMELESS_TOP_WALL_HEIGHT_IN } from "./framelessWallTopAlignment";
import {
  adjacentDishwasherCenterIn,
  anchorAlongStartIn,
  autoBuildStraightBaseCatalog,
  autoBuildDrawerBaseCatalog,
  keepSingleAutoDesignSink,
  planAutoDesignAutoBuild,
  pickAutoDesignSinkBase,
  subtractAnchorRunReservations,
  autoDesignWallNameByEngineId,
  wallLabelToEngineWallId,
  type AutoDesignInputs,
  type WallLabel,
} from "./autoDesignAutoBuild";
import { seatAutoDesignCornerFromCatalog } from "./autoDesignCornerPlacement";
import { matchUppersToBases } from "./autoDesignUpperMatch";
import { applyLazySusanCornerUppers } from "./autoDesignLazySusanCornerUppers";
import { applyGlassUpperPreference, autoDesignGlassOffered } from "./autoDesignFormOptions";
import { autoDesignGlassWidths, onlyGlassCapableUppers, onlyWidthsIn } from "./autoDesignGlassWidths";
import { ensureRequiredBlindCornerBaseFillers, isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";
import { reviewNkbaPlan } from "./nkbaLandingRules";
import { reviewCountertopPanelClashes } from "./countertopPanelRule";
import { isPlacedCornerCabinet, sameWidthFamily } from "./autoDesignCornerGuard";
import {
  AUTO_DESIGN_GALLEY_WALLS,
  autoBuildCornerCatalog,
  autoDesignAngledNeighborWallIds,
  autoDesignCornerFamily,
  autoDesignCornerSlotPoint,
  autoDesignCornerSlots,
  autoDesignExcludedEngineWallIds,
  autoDesignLayoutUsesWall,
  autoDesignRunWallIds,
  type AutoBuildCornerCandidate,
  type AutoDesignCornerSlot,
} from "./autoDesignCornerStage";
import { evaluateAutoDesignCornerFit } from "./cornerFit";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { repairMissingAngledWallFillers } from "./angledWallFiller";
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import { closeAutoDesignAngledBaseCorners } from "./autoDesignAngledBaseCorners";
import { autoDesignOpenAngledCornerFindings, closeAutoDesignAngledUpperCorners } from "./autoDesignAngledUpperCorners";
import { activeAutoDesignWiggleMoves, applyAutoDesignWiggleRoom, applyDesignerLayoutRules, autoDesignShiftLimitIn, type AutoDesignAnchorOrigin, type AutoDesignWiggleMove } from "./designerLayoutRules";
import { applyRealCabinetsBeforeFiller, isFillerLastResort } from "./autoDesignRealCabinets";
import { bakesALot, cooksALot, normalizeKitchenUsage } from "./kitchenUsage";
import { fifteenRuleFindings, hasPreference, lockedAnchorKinds, wallFitSuggestion, type WallFitAnchor } from "./autoDesignFifteenRules";
import { ensureDrawerBase } from "./autoDesignDrawerRule";
import { reviewAfterShift, separateRangeAndRefrigerator } from "./kitchenAdjacency";
import { autoDesignFillerMaxIn, fillAutoDesignLowerSeams, planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import {
  closeSmallOpeningsWithStock,
  consolidateAutoDesignFillers,
  FILLER_STRIP_MAX_IN,
  findFillerClusters,
  formatFillerInches,
} from "./autoDesignFillerConsolidation";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import { autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";
import { budgetSlideRefrigeratorToWallEnd, buildMandatoryAutoDesignRefrigeratorBay, holdRefrigeratorPanelsOnWall } from "./autoDesignRefrigeratorBay";
import { clampRefrigeratorAssemblyToPanels } from "./refrigeratorPanelClamp";
import { autoDesignSinkWindow, windowOverlapsReservation } from "./autoDesignSinkWindow";
import { resolveAutoDesignSinkBase, type AutoDesignSinkProduct } from "./autoDesignSink";
import { pickBudgetDefaultSink, pickBudgetSinkBase } from "./autoDesignBudgetSink";
import { applyDishwasherRunEndRule } from "./autoDesignDishwasherRunEnd";
import { economyKeepClearShifts, type KeepClearAnchor } from "./autoDesignEconomyKeepClear";
import { economyCornerClaimSpan, enforceEconomyCornerFillers, seatEconomyCorner } from "./autoDesignEconomyCorner";
import { planSinkLandingSlides, sinkFrontSetbackIn, sinkLandingGaps, sinkSeatCheck, sinkTallLandingIn } from "./autoDesignSinkLanding";
import { trimWallFillersOutsideRun } from "./autoDesignUpperAlignment";
import { buildPelicanSinkOnCabinet } from "./pelicanAutoPlace";
import {
  autoDesignTallProducts,
  planAutoDesignTallFit,
  resolveTallPick,
  tallCabinetPlacement,
} from "./autoDesignTallCabinets";
import { raiseWindowsForDeckFaucet } from "./faucetPlacement";
import { ensureBlindCornerFlankCabinets } from "./autoDesignBlindCornerFlank";
import { buildAutoDesignWallCabinets, catalogMatchingWallDesignHeight, enforceFortyTwoWallCabinets, resolveWallHeightClass, withoutNoGlassUppers, type AutoDesignUpperCorner } from "./autoDesignWallCabinets";
import { fillOverRangeAnswer, placeMandatoryOverRangeBridges } from "./overRangeFill";
import { placeSinkBridges } from "./autoDesignSinkBridge";
import { closeRemainingRunGaps } from "./autoDesignCloseRemainingGaps";
import { tightenRunOpenings } from "./autoDesignTightenOpenings";
import { removeFillersOutsideExposedPanels } from "./fillerOutsideExposedPanel";
import { ensureMandatorySinkFaucets, type AutoDesignFaucetProduct } from "./autoDesignFaucet";
import { boundedWallPlacementAt, cabinetInsideBounds, dropWallCabinetsWithoutWall, noWallCabinetFinding, uShapeRunWallLabels } from "./designerBounds";
import { ensureSingleDoorBase, pairAdjacentSingleDoorHandles, normalizeUpperHeights } from "./designerFaceRules";
import { buildDesignerReviewList, type DesignerReviewFinding } from "./designerReviewFindings";
import { applyDesignQuestionDoorSpec, verifyDesignQuestionDoorSpec, type DesignQuestionDoorSpec } from "./designQuestionDoorSpec";
import { exposedPanelFindings, exposedPanelRequirements } from "./exposedPanelRule";
import { repackFifteenRuleLayout } from "./autoDesignFifteenRepack";
import { applyMinimumFiller } from "./autoDesignMinimumFiller";
import { isFlutedFiller } from "./catalogFiller";
import { trimRefrigeratorWallSide } from "./autoDesignRefrigeratorWallSide";
import { cornerFirstWasPulled, describeCornerFirst, pickCornerFirst } from "./cornerFirst";
import {
  autoDesignInsideCornerReservations,
  cornerReservationsOnWall,
  decideAutoDesignCornerTypeOrder,
  describeCornerTypeDecision,
  subtractInsideCornerReservations,
} from "./autoDesignCornerDecision";
import { neighborAtGapEdge, refrigeratorPanelAtEdge, resolveLeftoverGap, leftoverGapIsActionable } from "./autoDesignLeftover";
import { refrigeratorLimitIn } from "./autoDesignAnchors";
import { alignFramelessWallCabinetTops, framelessWallTopDatumIn } from "./framelessWallTopAlignment";
import {
  applyRangeFlankEndPanels,
  applyRangeFlankPlan,
  describeUnfinishedFlank,
  planRangeFlankCabinets,
  RANGE_FLANK_PANEL_THICKNESS_IN,
  rangeFlankPanelRequests,
} from "./autoDesignRangeFlanks";
import { exposedPanelTypeForCatalog } from "./exposedSidePanels";
import { buildAnchoredRefrigeratorBay } from "./autoDesignRefrigeratorAnchor";
import { normalizeContinuousVerticalFillers } from "./verticalFiller";
import {
  autoDesignPeninsulaAttachment,
  buildAutoDesignPeninsula,
  type AutoDesignPeninsulaRequest,
  type AutoDesignPeninsulaSummary,
} from "./autoDesignPeninsula";
import {
  COLLISION_EPSILON_IN,
  STD,
  clampPlacedToRefrigeratorPanels,
  formatEighthInches,
  wallRunFrame,
  appendCollisionFreePlacements,
  appendRefrigeratorEnclosurePlacements,
  dim,
  fitExplicitRefrigeratorOptionPlacements,
  footprintDepth,
  isRefrigerator,
  placedFootprint,
  freeSegmentsOnWall,
  magneticAvailableWallStart,
  isFarmSinkBasePaletteItem,
  isFillerItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  NON_APRON_SINK_FRONT_SETBACK,
  standardHeight,
  cabinetWall,
  countertopSurfaces,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  type WallSide,
} from "./design";

export type AutoDesignSeatedCorner = {
  slotId: string;
  label: string;
  masterCode: string;
  family: string;
  fallbackNote: string | null;
};

export type AutoDesignLayoutSuccess = {
  ok: true;
  placed: PlacedCabinet[];
  sinks: SinkFixture[];
  sinkWindow: WallOpening | null;
  openings: WallOpening[];
  faucetWindowNotes: { openingUid: string; text: string; severity: "warning" }[];
  notes: string[];
  warnings: string[];
  wiggleMoves: AutoDesignWiggleMove[];
  /** 15-rule pass moves (range/sink shifted for the 15" fridge minimum or the 3" wiggle). */
  fifteenRepackMoves?: { uid: string; kind: string; wallId: string; deltaAlongIn: number }[];
  applianceMoves: { label: string; shiftIn: number; centerAlongIn: number }[];
  skippedUppers: string[];
  cornerSlots: AutoDesignCornerSlot[];
  seatedCorners: AutoDesignSeatedCorner[];
  bareRangeUid: string | null;
  heightUsedIn: number | null;
  requestedUpperIn: number;
  cornerCount: number;
  basePieceCount: number;
  fillerCount: number;
  upperCount: number;
  peninsula: AutoDesignPeninsulaSummary | null;
  peninsulaRuns: import("./design").PeninsulaRun[];
  furniture: PlacedFurniture[];
  /**
   * True when every sink fixture in the finished plan carries a faucet. The
   * faucet is mandatory, so this is reported rather than assumed.
   */
  everySinkHasFaucet: boolean;
  /** True when the built-in default fixture was used (the line sells no faucet row). */
  usedDefaultFaucet: boolean;
  /**
   * Rule 14: every design question the build could NOT honor, as a named, reviewable finding.
   * Empty means all questions were honored.
   */
  reviewFindings: DesignerReviewFinding[];
  reviewAllHonored: boolean;
};

export type AutoDesignLayoutResult = AutoDesignLayoutSuccess | { ok: false; message: string };

/** 24 inch refrigerator caps from the wall pool, then the surround query. W362324 lives only on the wall pool. */
export function mergeAutoDesignRefrigeratorCaps(
  wallCatalog: readonly DesignCabinet[],
  surroundCaps: readonly DesignCabinet[],
): DesignCabinet[] {
  const deep = wallCatalog.filter((row) => Math.abs(dim(row.width, 0) - 36) <= 0.5 && dim(row.depth, 0) >= 20);
  const seen = new Set<number>();
  const merged: DesignCabinet[] = [];
  for (const row of [...deep, ...surroundCaps]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

/**
 * True when the selected line is the U.S. Cabinet Depot frameless line: its wall
 * rows carry the printed geometry marker. One marker is enough, and a line with
 * no marker at all is treated as framed so its 84" line is never disturbed.
 */
export function isFramelessWallCatalog(
  wallCatalog: readonly { constructionMethod?: string | null; masterCode?: string | null; height?: string | number | null }[],
): boolean {
  // The geometry marker is the strongest signal, but the palette query does not
  // always ship it. The book's frameless wall heights are 30-1/4", 35-1/4" and
  // 40-1/4"; a framed line sells 30/36/42 instead. A 40-1/4" box is therefore
  // frameless-only, which identifies the line from dimension data alone.
  if (wallCatalog.some((row) => hasAefPrintedGeometry(row))) return true;
  return wallCatalog.some((row) => {
    const height = Number(row.height);
    return Number.isFinite(height) && Math.abs(height - FRAMELESS_TOP_WALL_HEIGHT_IN) <= 0.3;
  });
}

/** A 4–9 inch base opening is too wide for a 3 inch filler and too narrow for another cabinet. Grow the cabinet beside it when the line sells that wider box. */
function absorbOpenBaseGaps(
  placed: PlacedCabinet[],
  room: RoomData,
  catalog: readonly DesignCabinet[],
  walls: readonly WallSide[],
  styleId: number | null,
  makeUid: () => string,
  cornerReserved: ReadonlyArray<{ wallId: string; start: number; end: number }> = [],
): PlacedCabinet[] {
  let working = placed;
  for (const wallId of walls) {
    const rawGaps = freeSegmentsOnWall(wallId, room, working, [], 3.05, 0, "base", false);
    const gaps = subtractInsideCornerReservations(rawGaps, cornerReservationsOnWall(wallId, cornerReserved), 3.05);
    for (const gap of gaps) {
      if (gap.length <= autoDesignFillerMaxIn() + 0.05 || gap.length > 9.05) continue;
      const edgeNeighbors = working.filter((item) => item.placement === "base" && !/filler|scribe/i.test(item.masterCode)
        && cabinetWall(item, room) === wallId
        && (Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - gap.start) <= 0.75
          || Math.abs(wallRunOffset(item, wallId, room) - (gap.start + gap.length)) <= 0.75));
      // Grow a run cabinet into the gap. A corner cabinet on one edge is not a
      // candidate: widening it would turn a lazy Susan or blind corner into a
      // straight base and lose the corner, so the opposite edge is tried first.
      const neighbor = edgeNeighbors.find((item) => !isSinkBaseCabinet(item) && !isPlacedCornerCabinet(item));
      if (!neighbor) {
        const appliance = working.find((item) => item.placement === "appliance" && cabinetWall(item, room) === wallId && (
          Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - gap.start) <= 0.2
          || Math.abs(wallRunOffset(item, wallId, room) - (gap.start + gap.length)) <= 0.2
        ));
        if (!appliance) continue;
        const delta = gap.length - autoDesignFillerMaxIn();
        if (delta <= 0.05 || delta > 3.05) continue;
        const atStart = Math.abs(wallRunOffset(appliance, wallId, room) + wallRunSpan(appliance, wallId, room) - gap.start) <= 0.2;
        const nextStart = wallRunOffset(appliance, wallId, room) + (atStart ? -delta : delta);
        const spot = wallPlacementAt(nextStart, appliance.width, Math.max(0, appliance.depth), wallId, room);
        if (!spot) continue;
        const moved = { ...appliance, ...spot, wallId: spot.wallId ?? appliance.wallId, wallOffset: spot.wallOffset ?? nextStart };
        const without = working.filter((item) => item.uid !== appliance.uid);
        const accepted = appendCollisionFreePlacements(without, [moved], room);
        if (accepted.rejected.length === 0) working = accepted.placed;
        continue;
      }
      // A seated corner cabinet is never resized by this pass. Growing a 36"
      // lazy Susan into a 42" straight base copies the L-corner footprint onto a
      // wider body, which then overruns the room and is dropped by the bounds
      // gate, leaving the inside corner empty.
      const wanted = neighbor.width + gap.length;
      const wider = catalog
        .map((row) => ({ row, width: dim(row.width, 0) }))
        .filter((entry) => entry.width > neighbor.width + 0.05 && entry.width <= wanted + 0.05 && wanted - entry.width <= autoDesignFillerMaxIn() + 0.05)
        // Same family only: a `B` row is never the wider version of a `BBC`,
        // `LSB`, `CSB` or `CDB` corner.
        .filter((entry) => sameWidthFamily(neighbor, entry.row))
        .sort((a, b) => b.width - a.width)[0];
      const source = wider?.row;
      const grown = wider?.width ?? wanted;
      if (!source || !wider) continue;
      const neighborStart = wallRunOffset(neighbor, wallId, room);
      const followsGap = Math.abs(neighborStart - (gap.start + gap.length)) <= 0.75;
      const start = followsGap ? neighborStart + neighbor.width - grown : neighborStart;
      const depth = footprintDepth(source);
      const spot = wallPlacementAt(start, grown, depth, wallId, room);
      if (!spot) continue;
      const candidate: PlacedCabinet = {
        ...neighbor,
        uid: makeUid(),
        cabinetId: source.id,
        masterCode: source.masterCode,
        description: source.description,
        width: grown,
        depth,
        ...spot,
        styleId,
      };
      const without = working.filter((item) => item.uid !== neighbor.uid);
      const accepted = appendCollisionFreePlacements(without, [candidate], room);
      if (accepted.rejected.length === 0) working = accepted.placed;
    }
  }
  return working;
}

/**
 * Re-seat every sink fixture onto the sink base that actually holds it.
 *
 * The basin is built when the anchor is measured, and the base can move after
 * that (the sink-landing rule slides it to open counter between the basin and a
 * tall unit). Re-placing the fixture from the FINAL base is what keeps it centered
 * on its own box at the approved 2"–2½" front setback instead of drifting with the
 * old position.
 */
function reSeatSinkFixtures(
  sinks: readonly SinkFixture[],
  placed: readonly PlacedCabinet[],
  room: RoomData,
  setbackIn: number,
): { sinks: SinkFixture[]; changed: boolean; notes: string[] } {
  let changed = false;
  const notes: string[] = [];
  const next = sinks.map((sink) => {
    const base = placed.find((item) => item.uid === sink.cabinetUid);
    if (!base || !isSinkBaseCabinet(base)) return sink;
    const dimensions = {
      width: sink.sourceWidth ?? sink.width,
      depth: sink.sourceDepth ?? sink.depth,
    };
    const seated = makeSinkForCabinet(sink.type, base, room, dimensions, { frontSetbackIn: setbackIn });
    const same = seated.x === sink.x
      && seated.y === sink.y
      && seated.width === sink.width
      && seated.depth === sink.depth
      && seated.wallSide === sink.wallSide
      && seated.planRotation === sink.planRotation
      && seated.frontSetbackIn === sink.frontSetbackIn;
    if (same) return sink;
    changed = true;
    notes.push(`The basin on ${base.masterCode} was re-centered on its base at a ${seated.frontSetbackIn ?? setbackIn}″ front setback after the base moved.`);
    return {
      ...seated,
      uid: sink.uid,
      faucet: sink.faucet,
      pelicanProductId: sink.pelicanProductId,
      pelicanProductName: sink.pelicanProductName,
      pelicanProductImage: sink.pelicanProductImage,
      pelicanProfileId: sink.pelicanProfileId,
      bowlWidth: sink.bowlWidth,
      bowlDepth: sink.bowlDepth,
      bowlHeight: sink.bowlHeight,
      bowlCount: sink.bowlCount,
      bowlWidths: sink.bowlWidths,
      bowlDepths: sink.bowlDepths,
      bowlHeights: sink.bowlHeights,
      drainInsetRight: sink.drainInsetRight,
      drainInsetBack: sink.drainInsetBack,
      exteriorHeight: sink.exteriorHeight,
      apronFront: sink.apronFront,
      surfaceFinish: sink.surfaceFinish,
      autoDesignFaucet: sink.autoDesignFaucet,
      defaultFaucet: sink.defaultFaucet,
      pelicanFaucetProductId: sink.pelicanFaucetProductId,
      pelicanFaucetProductName: sink.pelicanFaucetProductName,
      pelicanFaucetProductImage: sink.pelicanFaucetProductImage,
      pelicanFaucetProfileId: sink.pelicanFaucetProfileId,
      faucetOverallHeight: sink.faucetOverallHeight,
      faucetSpoutLength: sink.faucetSpoutLength,
      faucetSpoutHeight: sink.faucetSpoutHeight,
      faucetFinish: sink.faucetFinish,
      faucetForm: sink.faucetForm,
    };
  });
  return { sinks: changed ? next : [...sinks], changed, notes };
}

/**
 * Owner rule: a sink base keeps a real counter landing between itself and a tall
 * cabinet or refrigerator. Called once the base runs and the tall picks are both
 * seated, so the exact gap is known. The sink base is the only piece that moves,
 * and only within its own anchor cap; the tall unit is never moved.
 *
 * A sink that cannot slide free is left where it is and reported by name, so the
 * plan never hides a basin jammed against a pantry.
 */
function slideSinkForLanding(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  notes: string[];
  reviewFindings: DesignerReviewFinding[];
  lockedUids?: readonly string[];
}): { placed: PlacedCabinet[] } {
  let working = [...input.placed];
  const landingIn = sinkTallLandingIn();
  for (let guard = 0; guard < 4; guard += 1) {
    const gaps = sinkLandingGaps(working, input.room, landingIn);
    if (gaps.length === 0) break;
    const gap = gaps[0]!;
    const sink = working.find((item) => item.uid === gap.sinkUid);
    if (!sink) break;
    if (input.lockedUids?.includes(sink.uid)) {
      input.reviewFindings.push({
        ruleId: "auto-design-rule-2",
        code: "sink-locked-no-slide",
        severity: "info",
        title: `${gap.sinkCode} stays put`,
        detail: "The customer said the sink base cannot move, so it was not slid for a counter landing.",
        cabinetUid: sink.uid,
        cabinetCode: sink.masterCode,
      });
      break;
    }
    const slides = planSinkLandingSlides({ sink, placed: working, room: input.room, landingIn });
    const slide = slides[0];
    if (!slide) {
      input.reviewFindings.push({
        ruleId: "sink-landing-before-tall",
        code: "sink-landing-short",
        severity: "warning",
        title: `${gap.sinkCode} has no counter landing before ${gap.blockerCode}`,
        detail: `The sink base and ${gap.blockerCode} are ${Math.max(0, gap.gapIn)}″ apart on ${gap.wallId}, so the basin is jammed against the tall unit. The sink base could not slide the ${landingIn}″ needed inside its own anchor allowance. Shorten the run or move the sink base, then rebuild.`,
        cabinetUid: sink.uid,
        cabinetCode: sink.masterCode,
      });
      break;
    }
    const spot = wallPlacementAt(slide.startIn, sink.width, sink.depth, gap.wallId as WallSide, input.room);
    const moved: PlacedCabinet = {
      ...sink,
      ...spot,
      wallId: spot.wallId ?? sink.wallId,
      wallOffset: spot.wallOffset ?? slide.startIn,
    };
    const without = working.filter((item) => item.uid !== sink.uid);
    const accepted = appendCollisionFreePlacements(without, [moved], input.room);
    if (accepted.rejected.length > 0) {
      input.reviewFindings.push({
        ruleId: "sink-landing-before-tall",
        code: "sink-landing-short",
        severity: "warning",
        title: `${gap.sinkCode} has no counter landing before ${gap.blockerCode}`,
        detail: `The sink base needs to slide ${Math.abs(slide.deltaIn)}″ to open a ${landingIn}″ landing before ${gap.blockerCode}, and that spot is already occupied. Nothing was moved. Shorten the run or move the sink base, then rebuild.`,
        cabinetUid: sink.uid,
        cabinetCode: sink.masterCode,
      });
      break;
    }
    working = accepted.placed;
    input.notes.push(`${gap.sinkCode} slid ${Math.abs(slide.deltaIn)}″ to keep a ${landingIn}″ counter landing before ${gap.blockerCode}.`);
  }
  return { placed: working };
}

/**
 * Rule 3: close a leftover opening with real cabinets before using filler.
 *
 * For every opening on the build's walls that is wider than a 3" filler, this grows the adjoining
 * cabinet to a wider SKU of the same family (an 18" drawer base becomes a 27") or seats a real
 * narrow cabinet plus a small filler. Filler alone is the last resort, and an opening no real
 * cabinet can close is named on the review list instead of being silently left open.
 */
function resolveLeftoverOpenings(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  catalog: readonly DesignCabinet[];
  walls: readonly WallSide[];
  styleId: number | null;
  makeUid: () => string;
  reviewFindings: DesignerReviewFinding[];
  cornerReserved?: ReadonlyArray<{ wallId: string; start: number; end: number }>;
}): { placed: PlacedCabinet[]; notes: string[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  for (const wallId of input.walls) {
    const reservations = refrigeratorLimitIn({ placed: working, room: input.room, wallId });
    const rawGaps = freeSegmentsOnWall(wallId, input.room, working, [], autoDesignFillerMaxIn() + 0.05, 0, "base", false, undefined, STD.BASE_DEPTH);
    const gaps = subtractInsideCornerReservations(rawGaps, cornerReservationsOnWall(wallId, input.cornerReserved ?? []), autoDesignFillerMaxIn() + 0.05);
    for (const gap of gaps) {
      const gapStart = gap.start;
      const gapEnd = gap.start + gap.length;
      if (!leftoverGapIsActionable(gap.length)) continue;
      const neighbor = neighborAtGapEdge({ placed: working, room: input.room, wallId, edgeIn: gapStart, side: "start" })
        ?? neighborAtGapEdge({ placed: working, room: input.room, wallId, edgeIn: gapEnd, side: "end" });
      const cappedByRefrigeratorPanel = refrigeratorPanelAtEdge({ placed: working, room: input.room, wallId, edgeIn: gapStart })
        || refrigeratorPanelAtEdge({ placed: working, room: input.room, wallId, edgeIn: gapEnd });
      const resolution = resolveLeftoverGap({
        gapIn: gap.length,
        startIn: gapStart,
        neighbor,
        catalog: [...input.catalog],
        room: input.room,
        cappedByRefrigeratorPanel,
        atSkin: gapStart <= 0.06 || gapEnd >= (wallRunFrame(wallId, input.room)?.length ?? 0) - 0.06,
        fillerMaxIn: autoDesignFillerMaxIn(),
        });

      if (resolution.kind === "widen-neighbor") {
        // Never resize a corner cabinet into a wider straight base here either.
        if (isPlacedCornerCabinet(resolution.neighbor)) continue;
        // Rule 7 (Nov 13 2026 spec): never grow or swap the sink base on its own; its size is a suggestion for the customer.
        const neighborIsSinkBase = /sink/i.test(`${resolution.neighbor.description ?? ""} ${resolution.neighbor.subCategory ?? ""}`) || /^(?:L|F)?SB\d/i.test(resolution.neighbor.masterCode ?? "");
        if (neighborIsSinkBase) continue;
        const depth = footprintDepth(resolution.replacement);
        const spot = boundedWallPlacementAt(resolution.startIn, resolution.widthIn, depth, wallId, input.room);
        if (!spot) continue;
        const replacement: PlacedCabinet = {
          ...resolution.neighbor,
          uid: input.makeUid(),
          cabinetId: resolution.replacement.id,
          masterCode: resolution.replacement.masterCode,
          description: resolution.replacement.description,
          category: resolution.replacement.category,
          subCategory: resolution.replacement.subCategory,
          width: resolution.widthIn,
          depth,
          ...spot,
          styleId: resolution.neighbor.styleId ?? input.styleId,
        };
        const without = working.filter((item) => item.uid !== resolution.neighbor.uid);
        const accepted = appendCollisionFreePlacements(without, [replacement], input.room);
        if (accepted.rejected.length === 0) {
          working = accepted.placed;
          notes.push(`${resolution.neighbor.masterCode} became ${resolution.replacement.masterCode} to close a ${formatEighthInches(gap.length)} opening on ${wallId}.`);
        }
        continue;
      }
      if (resolution.kind === "narrow-cabinet") {
        const depth = footprintDepth(resolution.source);
        const spot = boundedWallPlacementAt(resolution.startIn, resolution.widthIn, depth, wallId, input.room);
        if (!spot) continue;
        const piece: PlacedCabinet = {
          uid: input.makeUid(),
          cabinetId: resolution.source.id,
          masterCode: resolution.source.masterCode,
          description: resolution.source.description,
          category: resolution.source.category,
          subCategory: resolution.source.subCategory,
          placement: "base",
          width: resolution.widthIn,
          depth,
          ...spot,
          height: dim(resolution.source.height, standardHeight("base")),
          numberOfDoors: resolution.source.numberOfDoors,
          numberOfDrawers: resolution.source.numberOfDrawers,
          catalogImageUrl: resolution.source.catalogImageUrl ?? null,
          styleId: input.styleId,
        };
        const accepted = appendCollisionFreePlacements(working, [piece], input.room);
        if (accepted.rejected.length === 0) {
          working = accepted.placed;
          notes.push(`${resolution.source.masterCode} closes the ${formatEighthInches(gap.length)} opening on ${wallId}${resolution.fillerIn > 0 ? ` with ${formatEighthInches(resolution.fillerIn)} of filler` : ""}.`);
        }
        continue;
      }
      if (resolution.kind === "leave-bare" && resolution.widthIn > autoDesignFillerMaxIn() + 0.05) {
        // The reservation check above already proved this opening is not a filler's job.
        void reservations;
        input.reviewFindings.push({
          ruleId: "leftover-real-cabinets-first",
          code: "leftover-left-open",
          severity: "warning",
          title: `${formatEighthInches(resolution.widthIn)} opening left open on ${wallId}`,
          detail: `${resolution.reason}. Choose a cabinet that closes it, or adjust the run.`,
          cabinetUid: neighbor?.uid ?? null,
          cabinetCode: neighbor?.masterCode ?? null,
        });
      }
    }
  }
  return { placed: working, notes };
}

/**
 * A run that still carries two boards after consolidation is named on the
 * review list instead of being left silently doubled. One board per run end is
 * the rule; a second board means no stock width and no single board could close
 * the run, so the person deciding the plan has to see it.
 */
function reviewFillers(
  wallIds: readonly string[],
  placed: readonly PlacedCabinet[],
  room: RoomData,
  openings: readonly WallOpening[],
  findings: DesignerReviewFinding[],
): void {
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of wallIds) {
      for (const cluster of findFillerClusters({ placed, room, openings, wallId, layer })) {
        if (cluster.fillers.length < 2) continue;
        findings.push({
          ruleId: "one-filler-per-run",
          code: "extra-filler-boards",
          severity: "warning",
          title: `${cluster.fillers.length} filler boards on ${wallId}`,
          detail: `This ${layer} run still carries ${cluster.fillers.map((filler) => formatFillerInches(Number(filler.width) || 0)).join(" + ")} of filler because no single stock width and no single board closes the run. Adjust the run to close it with one board.`,
          cabinetUid: cluster.fillers[0]?.uid ?? null,
          cabinetCode: cluster.fillers[0]?.masterCode ?? null,
        });
      }
    }
  }
}

/**
 * Filler width is not shortened here. Cutting a wide board down to 3 inches
 * would hide the rest of the gap. The filler pass either closes that gap with
 * stock cabinets or removes the board and names the leftover.
 */
export function capAutoDesignFillerWidth(placed: PlacedCabinet[]): PlacedCabinet[] {
  return placed;
}

/** Cabinet layers Auto Design paints. Appliances are not a door finish. */
const AUTO_DESIGN_FINISH_PLACEMENTS = new Set(["base", "wall", "tall"]);

/**
 * The one door already stored on every base, wall, and tall cabinet, or null
 * when the plan does not have exactly one. A follow-up piece (the range
 * bridge) uses this so it cannot introduce a second finish.
 */
export function uniformCabinetStyleId(
  placed: readonly { placement?: string | null; styleId?: number | null }[],
): number | null {
  const ids = placed
    .filter((item) => item.placement === "base" || item.placement === "wall" || item.placement === "tall")
    .map((item) => item.styleId ?? null);
  const first = ids[0];
  if (first == null || ids.length === 0) return null;
  return ids.every((id) => id === first) ? first : null;
}

/** One finish on every cabinet this build generated. */
export function stampAutoDesignSingleFinish(
  placed: readonly PlacedCabinet[],
  styleId: number | null,
): PlacedCabinet[] {
  if (styleId == null) return [...placed];
  return placed.map((item) => {
    if (!AUTO_DESIGN_FINISH_PLACEMENTS.has(item.placement)) return item;
    if (item.styleId === styleId) return item;
    return { ...item, styleId };
  });
}

/**
 * The next along-wall inch where some catalog base actually seats. One jump
 * past an obstruction, instead of a filler for every 3" step that missed.
 */
function nextFittingBaseAlong(input: {
  working: readonly PlacedCabinet[];
  catalog: readonly DesignCabinet[];
  along: number;
  segmentEnd: number;
  wallId: WallSide;
  room: RoomData;
}): number | null {
  const widths = Array.from(new Set(input.catalog.map((row) => dim(row.width, 0)).filter((width) => width > 0)))
    .sort((left, right) => right - left);
  const limit = Math.min(input.segmentEnd - 9, input.along + 96);
  for (let cursor = input.along + 1; cursor <= limit + 0.05; cursor += 1) {
    for (const width of widths) {
      if (cursor + width > input.segmentEnd + 0.05) continue;
      const source = input.catalog.find((row) => Math.abs(dim(row.width, 0) - width) <= 0.05);
      if (!source) continue;
      const depth = footprintDepth(source);
      const spot = boundedWallPlacementAt(cursor, width, depth, input.wallId, input.room);
      if (!spot) continue;
      const candidate: PlacedCabinet = {
        uid: "probe-base", cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width, depth,
        height: dim(source.height, standardHeight("base")),
      };
      if (appendCollisionFreePlacements([...input.working], [candidate], input.room).rejected.length === 0) return cursor;
    }
  }
  return null;
}




/** True when a corner reservation is a 45° filler seat (not a 90° square). */
function fortyFiveSeatSpan(room: RoomData, span: { wallId: string; start: number; end: number }, runWalls: readonly string[]): boolean {
  const frame = wallRunFrame(span.wallId, room);
  if (!frame) return false;
  const at = Math.abs(span.start - frame.runStart) <= 0.01 ? "start" : Math.abs(span.end - frame.runEnd) <= 0.01 ? "end" : null;
  const seat = at ? fortyFiveCornerSeat(room, span.wallId, at, "base", { neighborWallIds: runWalls }) : null;
  return Boolean(seat && Math.abs((span.end - span.start) - Math.min(frame.runEnd - frame.runStart, seat.cabinetSetbackIn)) <= 0.01);
}

/**
 * Re-run the Designer's manual drop snap on the first base box beside each 45°
 * corner seat of `wallId` (boxes laid since `before`). The seat span (vertex to
 * the end of the 3″ angled filler) is removed from the free segments, exactly
 * as the seated filler pair will occupy it, then `magneticAvailableWallStart`
 * decides the start the same way a hand drop at the box's position would. A box
 * is moved only when the snap lands within the Designer's snap threshold and
 * the moved box is collision-free; otherwise it stays where the fill put it.
 */
function snapFortyFiveCornerCabinets(
  working: PlacedCabinet[],
  before: ReadonlySet<string>,
  wallId: string,
  runWalls: readonly string[],
  room: RoomData,
  openings: WallOpening[],
): PlacedCabinet[] {
  const frame = wallRunFrame(wallId, room);
  if (!frame) return working;
  let next = working;
  const seats = (["start", "end"] as const).flatMap((at) => {
    const seat = fortyFiveCornerSeat(room, wallId, at, "base", { neighborWallIds: runWalls });
    if (!seat) return [];
    const span = at === "start"
      ? { start: frame.runStart, end: frame.runStart + seat.cabinetSetbackIn }
      : { start: frame.runEnd - seat.cabinetSetbackIn, end: frame.runEnd };
    return [{ at, seat, span }];
  });
  for (const { at, seat } of seats) {
    const candidates = next
      .filter((item) => !before.has(item.uid) && item.wallId === wallId && item.placement === "base" && !isFillerItem(item))
      .map((item) => {
        const start = wallRunOffset(item, wallId, room);
        const end = start + wallRunSpan(item, wallId, room);
        return { item, start, gap: at === "start" ? start - frame.runStart : frame.runEnd - end };
      })
      .sort((left, right) => left.gap - right.gap);
    const first = candidates[0];
    if (!first) continue;
    const others = next.filter((item) => item.uid !== first.item.uid);
    const segments = subtractAnchorRunReservations(
      freeSegmentsOnWall(wallId as WallSide, room, others, openings, Math.min(first.item.width, 9), 0, "base", false, first.item, first.item.depth),
      seats.map((entry) => entry.span),
    );
    const snapped = magneticAvailableWallStart(segments, first.start, first.item.width);
    if (snapped == null || Math.abs(snapped - first.start) <= 0.01) continue;
    // Only a snap that seats the box closer to this corner's filler end counts.
    const snappedGap = at === "start" ? snapped - frame.runStart : frame.runEnd - (snapped + wallRunSpan(first.item, wallId, room));
    if (Math.abs(snappedGap - seat.cabinetSetbackIn) >= Math.abs(first.gap - seat.cabinetSetbackIn) - 0.01) continue;
    const spot = wallPlacementAt(snapped, first.item.width, first.item.depth, wallId as WallSide, room);
    const moved = { ...first.item, ...spot };
    if (appendCollisionFreePlacements(others, [moved], room).rejected.length > 0) continue;
    next = next.map((item) => (item.uid === moved.uid ? moved : item));
  }
  return next;
}

/**
 * Slide the base boxes one fill segment just laid (those not in `before`) as a
 * block toward the end of the segment, so the last box ends exactly at
 * `segmentEnd` (a 45° corner seat). Every box keeps its width and order. When
 * any slid box would collide, the segment is left exactly as it was laid.
 */
function slideSegmentToFortyFiveSeat(
  working: PlacedCabinet[],
  before: ReadonlySet<string>,
  wallId: string,
  segmentStart: number,
  segmentEnd: number,
  room: RoomData,
): PlacedCabinet[] {
  const laid = working.filter((item) => !before.has(item.uid) && item.wallId === wallId && item.placement === "base");
  if (laid.length === 0) return working;
  const spans = laid.map((item) => {
    const start = wallRunOffset(item, wallId, room);
    return { item, start, end: start + wallRunSpan(item, wallId, room) };
  });
  if (spans.some((span) => span.start < segmentStart - 0.05 || span.end > segmentEnd + 0.05)) return working;
  const lastEnd = Math.max(...spans.map((span) => span.end));
  const shift = segmentEnd - lastEnd;
  if (!(shift > 0.05)) return working;
  const moved = new Map<string, PlacedCabinet>();
  for (const { item, start } of spans) {
    const spot = wallPlacementAt(start + shift, item.width, item.depth, wallId as WallSide, room);
    moved.set(item.uid, { ...item, ...spot });
  }
  const others = working.filter((item) => !moved.has(item.uid));
  let trial = others;
  for (const item of Array.from(moved.values())) {
    const accepted = appendCollisionFreePlacements(trial, [item], room);
    if (accepted.rejected.length > 0) return working;
    trial = accepted.placed;
  }
  return working.map((item) => moved.get(item.uid) ?? item);
}

/**
 * The measured Auto-Design build: anchors, refrigerator surround, corners,
 * base runs, hood, then wall cabinets. Galley fills Wall 1 and Wall 3 and
 * never receives a corner slot.
 */
function autoDesignWallFitSuggestion(input: AutoDesignInputs, room: RoomData, baseCatalog: readonly DesignCabinet[]): string | null {
  const anchors: WallFitAnchor[] = [];
  if (input.refrigerator) anchors.push({ wallLabel: input.refrigerator.wallLabel, kind: "refrigerator", widthIn: input.refrigeratorWidthIn ?? 36 });
  anchors.push({ wallLabel: input.sink.wallLabel, kind: "sink", widthIn: input.sinkBaseWidthIn ?? 36 });
  const noDishwasher = input.skipDishwasher || input.dishwasherSide === "none";
  if (!noDishwasher) anchors.push({ wallLabel: input.dishwasher?.wallLabel ?? input.sink.wallLabel, kind: "dishwasher", widthIn: 24 });
  if (input.stove) anchors.push({ wallLabel: input.stove.wallLabel, kind: "stove", widthIn: 30 });
  return wallFitSuggestion({
    anchors,
    wallLengthOf: (label) => wallLabelToEngineWallId(label, room, input.originCorner, input.runDirection)?.frame.length ?? null,
    baseCatalog,
  });
}
function fmtBridgeOpening(placed: readonly PlacedCabinet[], refrigeratorUid: string): string {
  const bridge = placed.find((item) => item.refrigeratorAssemblyId === refrigeratorUid && item.refrigeratorAssemblyRole === "bridge");
  const width = bridge ? Number(bridge.width) || 0 : 0;
  const total = Math.round((width + 1) * 8) / 8;
  return String(total);
}

/** Inch text for a finding detail ("36.5″"). Rounds to 1/8 in like the bridge opening note. */
function inches(value: number): string {
  return `${Math.round(value * 8) / 8}″`;
}

/** The refrigerator opening the bridge boards create (Tom, Nov 20 2026: to = 37 inches). */
export const FRIDGE_OPENING_TARGET_IN = 37;

export function runAutoDesignLayout(rawArgs: {
  input: AutoDesignInputs;
  room: RoomData;
  openings: readonly WallOpening[];
  baseCatalog: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  fillers: readonly DesignCabinet[];
  appliancePalette: readonly DesignCabinet[];
  refrigeratorCaps: readonly DesignCabinet[];
  refrigeratorEndPanels: readonly DesignCabinet[];
  /** The line's tall oven/pantry boxes, so a pop-up pick resolves to its catalog row. */
  tallCatalog?: readonly DesignCabinet[];
  /**
   * The faucet rows the selected line sells. The build always places a faucet at
   * the sink; with no usable row here it uses the built-in default fixture.
   */
  faucetCatalog?: readonly AutoDesignFaucetProduct[];
  /**
   * The sink rows the build may pick from (Pelican/surfaces sink catalog). Budget friendly picks one
   * for the customer without asking (Tom, voice, Nov 19 2026, 8:40 AM CT); other modes ask as before.
   */
  sinkCatalog?: readonly AutoDesignSinkProduct[];
  /**
   * The line's real price per cabinet id (cabinet id -> homeowner price for the active style). Budget friendly
   * ranks sink bases by it; never invented, and a base with no entry ranks after every priced one.
   */
  cabinetPriceById?: ReadonlyMap<number, number> | null;
  /**
   * The selected line's end/finished panel stock. The build seats the line's own
   * panel on the outside of the base cabinet it puts on each side of the range,
   * as a real placed catalog row so it is drawn and billed.
   */
  panelCatalog?: readonly DesignCabinet[];
  styleId: number | null;
  makeUid: () => string;
  stoveMasterCode?: string;
  peninsula?: AutoDesignPeninsulaRequest | null;
  /**
   * Placements already in the room before the build (a pushed sink base and its
   * fixture, for example). They are not anchors and the build never seats a
   * cabinet on top of them, but their presence must not stop the build.
   */
  preExistingPlacements?: readonly PlacedCabinet[];
  /**
   * A refrigerator already on the plan that this build adopts as a FIXED
   * ANCHOR. The appliance keeps its exact plan position and floor space; the
   * bay, base runs, corners, talls and uppers are designed around it. When the
   * anchor cannot be described in the measured layout, the build falls back to
   * the appliance's own floor span and names it.
   */
  anchoredRefrigerator?: PlacedCabinet | null;
}): AutoDesignLayoutResult {
  // Tom, Nov 18 2026, 5:22 PM CT: no 39 wall cabinet where glass is offered (no 39 in
  // glass exists), so every upper the build can pick comes from widths with a stacker.
  const glassOffered = autoDesignGlassOffered({
    intake: rawArgs.input.intake, wallCatalog: rawArgs.wallCatalog, room: rawArgs.room,
    wallCabinetHeightIn: rawArgs.input.wallCabinetHeightIn ?? 30,
  });
  // Glass needs a stacker at the same width (Tom, Nov 20 2026): a width with no
  // stacker silently costs that upper its glass, and the all-or-nothing rule then
  // costs the whole run. Filter the uppers the run may pick to glazable widths.
  // The base run is filtered to the same widths: a base in an unglazable width forces
  // its upper back out of the glass set, which is how the run lost its glass before.
  const glassWidths = glassOffered ? autoDesignGlassWidths(rawArgs.wallCatalog) : [];
  const glassArgs = glassOffered
    ? {
        ...rawArgs,
        wallCatalog: onlyGlassCapableUppers(withoutNoGlassUppers(rawArgs.wallCatalog)),
        baseCatalog: onlyWidthsIn(rawArgs.baseCatalog, glassWidths),
      }
    : rawArgs;
  // Fluted fillers (WFF) are decorative only (Tom, voice, Nov 19 2026, 7:41 AM CT): Auto Design never
  // places one on its own, so they leave every catalog the build picks fillers and panels from.
  const args = {
    ...glassArgs,
    fillers: glassArgs.fillers.filter((row) => !isFlutedFiller(row)),
    ...(glassArgs.panelCatalog ? { panelCatalog: glassArgs.panelCatalog.filter((row) => !isFlutedFiller(row)) } : {}),
    refrigeratorEndPanels: glassArgs.refrigeratorEndPanels.filter((row) => !isFlutedFiller(row)),
  };
  const { input, room, makeUid } = args;
  const openings = [...args.openings];
  const fail = (message: string): AutoDesignLayoutResult => {
    // Rules 7, 8, 14: when the asked-for appliances cannot fit, say what would help. Suggestions only.
    const suggestion = input.intake ? autoDesignWallFitSuggestion(input, room, args.baseCatalog) : null;
    return { ok: false, message: suggestion ? `${message} ${suggestion}` : message };
  };
  const plan = planAutoDesignAutoBuild(input);
  if (!plan.ok) return fail(`Missing required measurement: ${plan.missing.join(", ")}.`);
  const peninsulaRequest = args.peninsula ?? (input.intake?.islandOrPeninsula === "peninsula" && input.intake.peninsulaSide ? { side: input.intake.peninsulaSide } : null);
  const pool = args.baseCatalog;
  const straightBaseCatalog = autoBuildStraightBaseCatalog(pool);
  const drawerBaseCatalog = autoBuildDrawerBaseCatalog(pool);
  // The sink picked in the sink pop-up decides the base it pairs with: an
  // apron-front sink switches to its farmhouse base, a wider sink widens the
  // measured base to the smallest source-priced one that fits. Nothing narrows.
  const pickedSinkProducts = (input.sinkProducts ?? []).filter((product) => product?.productId);
  const primaryPickedSink = pickedSinkProducts[0] ?? null;
  const resolvedSinkBase = resolveAutoDesignSinkBase({
    product: primaryPickedSink
      ? {
        id: primaryPickedSink.productId,
        pelicanCode: primaryPickedSink.pelicanCode,
        name: primaryPickedSink.name,
        size: primaryPickedSink.size,
        imageUrl: primaryPickedSink.imageUrl,
      }
      : null,
    measuredWidthIn: input.sinkBaseWidthIn ?? 36,
    measuredKind: input.sinkBaseKind ?? "regular",
    baseCatalog: pool,
  });
  // Budget friendly (Tom, voice, Nov 19 2026): with no sink picked by hand and no explicit farmhouse request,
  // the build seats the SMALLEST, lowest-priced regular sink base that takes a double-bowl sink. The measured
  // sink base size is only the starting point for every other mode.
  // Tom, owner voice, Nov 20 2026 ("All"): the range and the sink land where the plan put them. The budget pick may only choose WHICH
  // base (lowest price) at the width the plan already measured; a different width would re-pack the run and move the sink, the
  // dishwasher beside it and the range, so the measured base stays and the note names the cheaper-but-different-width base.
  const budgetSinkBasePick = hasPreference(input.intake, "budget-friendly") && !primaryPickedSink && resolvedSinkBase.kind === "regular"
    ? pickBudgetSinkBase({ baseCatalog: pool, lineSinkProducts: args.sinkCatalog ?? [], priceByCabinetId: args.cabinetPriceById })
    : null;
  const budgetSinkBase = budgetSinkBasePick && Math.abs(budgetSinkBasePick.widthIn - resolvedSinkBase.widthIn) < 0.01 ? budgetSinkBasePick : null;
  const sinkBaseWidth = budgetSinkBase ? budgetSinkBase.widthIn : resolvedSinkBase.widthIn;
  const sinkBaseKind = resolvedSinkBase.kind;
  const sinkBaseSource = budgetSinkBase ? budgetSinkBase.row : pickAutoDesignSinkBase(pool, sinkBaseWidth, sinkBaseKind);
  if (!sinkBaseSource) {
    return fail(sinkBaseKind === "farmhouse"
      ? `No source-priced ${sinkBaseWidth}″ farmhouse sink base is available for the selected line. Choose the regular sink base or another door style, then try again.`
      : `No source-priced SB${sinkBaseWidth} sink base is available for the selected line. Choose a door style with a priced sink base, then try again.`);
  }
  const refrigeratorWidth = input.refrigeratorWidthIn ?? 36;
  const stoveCode = args.stoveMasterCode ?? "RANGE-30";
  const applianceByKind: Record<string, DesignCabinet | undefined> = {
    stove: args.appliancePalette.find((item) => item.masterCode === stoveCode),
    dishwasher: args.appliancePalette.find((item) => item.masterCode === "DW-24"),
    refrigerator: args.appliancePalette.find((item) => item.masterCode === "FRIDGE-36"),
  };
  const requestedApplianceKinds = plan.plan.anchors.filter((anchor) => anchor.kind !== "sink").map((anchor) => anchor.kind);
  if (requestedApplianceKinds.some((kind) => !applianceByKind[kind])) {
    return fail("The kitchen appliance palette is still loading. Wait for the source-priced cabinet catalog, then try again.");
  }
  const baseSource = straightBaseCatalog.find((item) => Math.abs(dim(item.width, 0) - 24) < 0.1) ?? straightBaseCatalog[0];
  if (!baseSource) return fail("No source-priced standard base cabinet is available for the selected line. Choose a compatible door style, then try again.");
  // A refrigerator already on the plan is a fixed anchor: it is never moved and
  // never re-sized, so it never needs the measured refrigerator width or the
  // measured appliance palette row.
  const anchoredRefrigerator = args.anchoredRefrigerator && isRefrigerator(args.anchoredRefrigerator)
    ? args.anchoredRefrigerator
    : null;
  const refrigeratorRequested = plan.plan.anchors.some((anchor) => anchor.kind === "refrigerator");
  if (refrigeratorRequested && !anchoredRefrigerator && (!args.refrigeratorCaps.length || !args.refrigeratorEndPanels.length)) {
    return fail("The selected line’s source-priced 36-inch refrigerator cabinet and two end panels are still loading or unavailable. The measured build was not changed.");
  }

  // A pushed sink (or any other pre-existing fixture) must not stop the build.
  // The measured build owns the sink base — it seats the source-priced base of
  // the requested width and then asks which basin goes in it — so a sink base
  // already on the plan is dropped rather than treated as an obstacle. Anything
  // else that is pre-existing stays a real obstacle, and a refrigerator on the
  // plan stays exactly where it is as this build's fixed anchor.
  const preExisting = [...(args.preExistingPlacements ?? [])].filter((item) => !isSinkBaseCabinet(item));
  // Budget friendly pick (Tom, Nov 19 2026): a standing rule set applied to every budget layout.
  // Refrigerator: no end panels and a 12-inch-deep cabinet above. Corners: the countertop runs back
  // to the wall and an empty upper corner gets a diagonal corner wall cabinet.
  const budgetFriendly = hasPreference(input.intake, "budget-friendly");

  const notes: string[] = [];
  let working: PlacedCabinet[] = [...preExisting];
  const anchorsByKind = new Map<string, PlacedCabinet>();  const anchorOrigins: AutoDesignAnchorOrigin[] = [];
  const selectedWalls: WallSide[] = [];
  // A refrigerator already on the plan is a fixed anchor no matter what the
  // setup dialog said: it is seated first, from the plan itself, so the build
  // always works around its real position and floor space. It is never
  // re-created, re-measured, moved, or treated as an obstacle.
  if (anchoredRefrigerator) {
    const anchorWall = cabinetWall(anchoredRefrigerator, room);
    if (!working.some((item) => item.uid === anchoredRefrigerator.uid)) working = [...working, anchoredRefrigerator];
    anchorsByKind.set("refrigerator", anchoredRefrigerator);
    anchorOrigins.push({
      uid: anchoredRefrigerator.uid,
      kind: "refrigerator",
      wallId: anchorWall,
      originalStart: wallRunOffset(anchoredRefrigerator, anchorWall, room),
    });
    if (anchorWall && !selectedWalls.includes(anchorWall)) selectedWalls.push(anchorWall);
    notes.push("The refrigerator already on the plan is a fixed anchor: it keeps its position, and the cabinets are designed around it.");
  }
  // Economic corner keep-clear (Tom, voice, Nov 19 2026, 11:59 AM CT; scoped budget-only Nov 20 2026, 11:03 AM CT):
  // in budget mode the dishwasher, sink base and range never sit inside the 27" economic corner footprint
  // (24" void + 3" mitered filler). Outside budget the rule does not reserve that space or move the range
  // or sink, on any cabinet type or line. The measured positions are slid out along their own wall before anything is seated.
  const keepClear = (() => {
    if (!budgetFriendly || hasPreference(input.intake, "lazy-susan") || hasPreference(input.intake, "blind-corner")) return null;
    const rows: KeepClearAnchor[] = [];
    const wallIdsSeen: WallSide[] = [];
    for (const anchor of plan.plan.anchors) {
      if (anchor.kind === "refrigerator" && anchoredRefrigerator) continue;
      const source = anchor.kind === "sink" ? sinkBaseSource : applianceByKind[anchor.kind];
      if (!source) continue;
      const width = anchor.kind === "sink" ? sinkBaseWidth : anchor.kind === "refrigerator" ? refrigeratorWidth : dim(source.width, 24);
      const adjacent = anchor.kind === "dishwasher" && anchor.source === "adjacent-to-sink";
      const measured = adjacent
        ? { ...anchor, wallLabel: input.sink.wallLabel, centerOffsetIn: adjacentDishwasherCenterIn(input.sink.centerOffsetIn, sinkBaseWidth, width, input.dishwasherSide === "left" ? "left" : "right") }
        : anchor;
      const wall = wallLabelToEngineWallId(measured.wallLabel, room, input.originCorner, input.runDirection);
      if (!wall) continue;
      wallIdsSeen.push(wall.engineWallId as WallSide);
      rows.push({
        kind: anchor.kind, wallId: wall.engineWallId as WallSide, along: anchorAlongStartIn(measured, width, wall), width, depth: dim(source.depth, 24),
        group: adjacent || anchor.kind === "sink" ? "sink" : anchor.kind,
      });
    }
    if (anchoredRefrigerator) {
      const wallId = cabinetWall(anchoredRefrigerator, room);
      if (wallId) rows.push({ kind: "refrigerator", wallId: wallId as WallSide, along: wallRunOffset(anchoredRefrigerator, wallId, room), width: wallRunSpan(anchoredRefrigerator, wallId, room), depth: anchoredRefrigerator.depth, group: "refrigerator" });
    }
    return economyKeepClearShifts({
      anchors: rows,
      movableKinds: ["sink", "dishwasher", "stove"],
      lockedKinds: lockedAnchorKinds(input.intake),
      room,
      openings,
      frameOf: (wallId) => wallRunFrame(wallId, room),
      label: (kind) => (kind === "stove" ? "range" : kind === "sink" ? "sink base" : kind),
      budgetMode: budgetFriendly,
    });
  })();
  if (keepClear) notes.push(...keepClear.notes);
  for (const anchor of plan.plan.anchors) {
    // Already seated from the plan above.
    if (anchor.kind === "refrigerator" && anchoredRefrigerator) continue;
    const source = anchor.kind === "sink" ? sinkBaseSource : applianceByKind[anchor.kind]!;
    const width = anchor.kind === "sink" ? sinkBaseWidth : anchor.kind === "refrigerator" ? refrigeratorWidth : dim(source.width, 24);
    const depth = dim(source.depth, 24);
    const height = dim(source.height, standardHeight(anchor.kind === "sink" ? "base" : "appliance"));
    const measuredAnchor = anchor.kind === "dishwasher" && anchor.source === "adjacent-to-sink"
      ? {
        ...anchor,
        wallLabel: input.sink.wallLabel,
        centerOffsetIn: adjacentDishwasherCenterIn(input.sink.centerOffsetIn, sinkBaseWidth, width, input.dishwasherSide === "left" ? "left" : "right"),
      }
      : anchor;
    if (!autoDesignLayoutUsesWall(input.layoutType, measuredAnchor.wallLabel)) {
      const galley = input.layoutType === "galley"
        ? `A galley uses the two opposite runs, ${AUTO_DESIGN_GALLEY_WALLS.join(" and ")}.`
        : `U-shape uses Wall 1 through Wall 4 only.`;
      return fail(`${galley} ${measuredAnchor.wallLabel} is not part of this layout.`);
    }
    const wall = wallLabelToEngineWallId(measuredAnchor.wallLabel, room, input.originCorner, input.runDirection);
    if (!wall) return fail(`${anchor.kind} cannot be placed because ${measuredAnchor.wallLabel} is not available in this room.`);
    const along = anchorAlongStartIn(measuredAnchor, width, wall) + (keepClear?.shifts.get(anchor.kind) ?? 0);
    if (along < wall.frame.runStart - COLLISION_EPSILON_IN || along + width > wall.frame.runEnd + COLLISION_EPSILON_IN) {
      return fail(`${anchor.kind} does not fit on ${measuredAnchor.wallLabel} at the selected center measurement.`);
    }
    const spot = wallPlacementAt(along, width, depth, wall.engineWallId as WallSide, room);
    const candidate: PlacedCabinet = {
      uid: makeUid(), cabinetId: source.id,
      masterCode: anchor.kind === "refrigerator" ? `FRIDGE-${refrigeratorWidth}` : source.masterCode,
      description: anchor.kind === "refrigerator" ? `${refrigeratorWidth}″ Refrigerator` : source.description,
      category: source.category, subCategory: source.subCategory,
      placement: anchor.kind === "sink" ? "base" : "appliance",
      ...(anchor.kind === "sink" ? {} : { applianceRole: "base-height" as const }),
      ...(anchor.kind === "refrigerator" ? { refrigeratorPanelMode: (budgetFriendly ? "none" : "both") as "none" | "both", refrigeratorOptionsChosen: true } : {}),
      ...spot, width, depth, height, mountBottom: source.mountBottom ?? 0, catalogImageUrl: source.catalogImageUrl ?? null,
      numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers, styleId: args.styleId,
    };
    const available = freeSegmentsOnWall(wall.engineWallId as WallSide, room, working, openings, width, 0, "base", false, candidate, depth)
      .some((segment) => along >= segment.start - COLLISION_EPSILON_IN && along + width <= segment.start + segment.length + COLLISION_EPSILON_IN);
    if (!available) return fail(`${anchor.kind} cannot be placed at that exact measurement on ${measuredAnchor.wallLabel}: it overlaps a same-wall anchor, door, or required corner clearance. No layout was built.`);
    const preflight = appendCollisionFreePlacements(working, [candidate], room);
    if (preflight.rejected.length > 0) return fail(`${anchor.kind} cannot be placed at that exact measurement on ${measuredAnchor.wallLabel}: it overlaps an existing anchor, opening, or adjoining wall clearance. No layout was built.`);
    working = preflight.placed;
    anchorsByKind.set(anchor.kind, candidate);
    anchorOrigins.push({ uid: candidate.uid, kind: anchor.kind, wallId: wall.engineWallId, originalStart: along });
    if (!selectedWalls.includes(wall.engineWallId as WallSide)) selectedWalls.push(wall.engineWallId as WallSide);
  }

  const refrigeratorBayWarnings: string[] = [];
  const drawerRuleWarnings: string[] = [];
  const reviewFindings: DesignerReviewFinding[] = [];
  const refrigerator = anchorsByKind.get("refrigerator");
  let refrigeratorReservation: { wall: string; start: number; end: number } | null = null;
  if (refrigerator && anchoredRefrigerator) {
    // A refrigerator the person already placed never moves: build its bay around
    // it. Anything that cannot fit is omitted and named, and the appliance keeps
    // its measured depth, height, and floor span.
    const nominal = input.wallCabinetHeightIn ?? 30;
    const anchoredBay = buildAnchoredRefrigeratorBay({
      placed: working,
      refrigerator,
      room,
      caps: args.refrigeratorCaps,
      endPanels: args.refrigeratorEndPanels,
      styleId: args.styleId,
      makeUid,
      wallCabinetHeightIn: resolveWallHeightClass(args.wallCatalog, nominal) ?? nominal,
      // Same frameless answer as a generated bay: the geometry marker, or a
      // 40-1/4" wall box when the palette does not ship the marker.
      framelessLine: isFramelessWallCatalog(args.wallCatalog),
      budget: budgetFriendly,
    });
    working = anchoredBay.placed;
    refrigeratorReservation = anchoredBay.reservation;
    notes.push(...anchoredBay.notes);
  } else if (refrigerator) {
    const nominal = input.wallCabinetHeightIn ?? 30;
    // Budget friendly re-flow: with no end panels, a refrigerator a few inches off a free wall end slides
    // flush to it so the other side closes with stock cabinets instead of a sliver filler.
    let bayRefrigerator = refrigerator;
    if (budgetFriendly) {
      // A wall end is "free" when the wall joined there carries no anchor (so no run continues past it).
      const slid = budgetSlideRefrigeratorToWallEnd(refrigerator, room, (joinedWallId) => joinedWallId == null || !selectedWalls.includes(joinedWallId as WallSide));
      if (slid) {
        bayRefrigerator = slid.refrigerator;
        working = working.map((item) => (item.uid === refrigerator.uid ? bayRefrigerator : item));
        anchorsByKind.set("refrigerator", bayRefrigerator);
        notes.push(slid.note);
      }
    }
    const refrigeratorBay = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: bayRefrigerator,
      room,
      caps: args.refrigeratorCaps,
      endPanels: args.refrigeratorEndPanels,
      styleId: args.styleId,
      makeUid,
      wallCabinetHeightIn: resolveWallHeightClass(args.wallCatalog, nominal) ?? nominal,
      // A frameless line is one whose wall rows carry the printed geometry
      // marker. `wallCatalog` is the authoritative line list, so this is where
      // the answer is decided (issue #354 item 5 needs it for the cap's line).
      framelessLine: isFramelessWallCatalog(args.wallCatalog),
      budget: budgetFriendly,
    });
    if (!refrigeratorBay.ok) return fail(refrigeratorBay.message);
    // The refrigerator must stay inside its end panels: take the clamped copy (depth/height) before fitting.
    working = working.map((item) => (item.uid === refrigeratorBay.refrigerator.uid ? refrigeratorBay.refrigerator : item));
    anchorsByKind.set("refrigerator", refrigeratorBay.refrigerator);
    refrigeratorBayWarnings.push(...refrigeratorBay.warnings);
    const fittedBay = fitExplicitRefrigeratorOptionPlacements(working, refrigeratorBay.additions, refrigerator.uid, room);
    // A gap under 1.5 inches beside the panels is filled. The refrigerator stays
    // where it was measured. A larger miss still stops the layout.
    if (Math.abs(fittedBay.shiftIn) > 1.5 + COLLISION_EPSILON_IN) {
      return fail("The measured refrigerator bay does not have room for its two panels and matching cabinet above. Adjust the refrigerator center measurement; Auto-Design will not move it.");
    }
    const unshiftedFridge = working.find((item) => item.uid === refrigerator.uid) ?? refrigeratorBay.refrigerator;
    const heldPanels = Math.abs(fittedBay.shiftIn) > COLLISION_EPSILON_IN
      ? holdRefrigeratorPanelsOnWall(refrigeratorBay.additions, room)
      : null;
    const bayExisting = heldPanels
      ? fittedBay.existing.map((item) => item.uid === refrigerator.uid ? unshiftedFridge : item)
      : fittedBay.existing;
    const bayAdditions = heldPanels ? heldPanels.additions : fittedBay.additions;
    const appliedBayShift = heldPanels ? 0 : fittedBay.shiftIn;
    if (heldPanels?.note) notes.push(heldPanels.note);
    const committedBay = appendRefrigeratorEnclosurePlacements(bayExisting, bayAdditions, refrigerator.uid, room);
    if (committedBay.rejected.length > 0) {
      return fail("The measured refrigerator bay overlaps an anchor, opening, or wall end. Adjust the refrigerator center measurement; Auto-Design will not add a filler or move it.");
    }
    working = committedBay.placed;
    // Final containment pass after all fitting: the refrigerator and its cabinet above stay inside the end panels.
    // Budget friendly has no end panels, so there is nothing to clamp to or to add back.
    if (!budgetFriendly) {
      const contained = clampRefrigeratorAssemblyToPanels({
        placed: working,
        refrigeratorUid: refrigerator.uid,
        room,
        addPanel: (panelSide, opening) => refrigeratorBay.panelFor(panelSide, opening),
      });
      working = contained.placed;
      for (const warning of contained.warnings) if (!refrigeratorBayWarnings.includes(warning)) refrigeratorBayWarnings.push(warning);
      notes.push(...contained.notes);
    }
    refrigeratorReservation = {
      ...refrigeratorBay.reservation,
      start: refrigeratorBay.reservation.start + appliedBayShift,
      end: refrigeratorBay.reservation.end + appliedBayShift,
    };
    notes.push(...refrigeratorBay.notes, ...(refrigeratorBay.refrigeratorClampNote ? [refrigeratorBay.refrigeratorClampNote] : []));
  }
  if (refrigerator && !budgetFriendly) {
    // Rich's bridge filler rule (Tom, Nov 19 2026, 12:48-12:50 PM CT): a 1/2" filler on each side of every
    // bridge cabinet, so a 36" bridge takes a 37" opening. Mandatory in standard (non-budget) flows. Budget mode is exempt (Tom, 12:56 PM CT): it has no panels and keeps its bridge as is.
    const bridgeFillers = ensureBridgeHalfInchFillers(working, room, args.fillers ?? [], makeUid, args.styleId ?? null);
    working = bridgeFillers.placed;
    if (bridgeFillers.added.length > 0) {
      notes.push(`Bridge fillers: a 1/2″ ${bridgeFillers.added[0]!.masterCode} filler on each side of the cabinet over the refrigerator, so the bridge takes a ${fmtBridgeOpening(working, refrigerator.uid)}″ opening (stops the bridge bowing and lets the refrigerator go in without scratching).`);
    }
    for (const failure of bridgeFillers.failures) refrigeratorBayWarnings.push(`Bridge fillers: ${failure.masterCode} — ${failure.reason}.`);
  }
  if (budgetFriendly && refrigerator) {
    const budgetBridge = working.find((item) => item.refrigeratorAssemblyId === refrigerator.uid && item.refrigeratorAssemblyRole === "bridge");
    notes.push("Budget friendly: no refrigerator end panels, so the run closes against the refrigerator with stock cabinet widths.");
    notes.push(budgetBridge
      ? Math.abs((Number(budgetBridge.depth) || 0) - 12) <= 0.05
        ? `Budget friendly: ${budgetBridge.masterCode} above the refrigerator is 12″ deep (the line's standard wall depth).`
        : `Budget friendly: this line sells no 12″-deep cabinet at the refrigerator width, so ${budgetBridge.masterCode} (${Number(budgetBridge.depth) || 0}″ deep) is the closest real option above the refrigerator.`
      : "Budget friendly: no cabinet could be seated above the refrigerator, so none was added.");
  }

  const sinkBase = anchorsByKind.get("sink");
  let sinks: SinkFixture[] = [];
  if (sinkBase) {
    if (budgetSinkBase) notes.push(budgetSinkBase.note);
    else if (budgetSinkBasePick) {
      notes.push(`Budget friendly: the smallest sink base that takes the lowest-priced double-bowl sink is ${budgetSinkBasePick.row.masterCode} (${budgetSinkBasePick.widthIn}″), but your plan places a ${resolvedSinkBase.widthIn}″ sink base, so it stays where you placed it and the range, the dishwasher and the sink do not move. Change the sink base size in the plan to use ${budgetSinkBasePick.row.masterCode}.`);
    }
    // A sink picked in the sink pop-up is seated in the sink base the build
    // actually placed, so the pairing decided above is what gets a basin.
    const pickedSink = pickedSinkProducts[0];
    const setbackIn = sinkFrontSetbackIn();
    const pelicanSink = pickedSink && sinkBase
      ? buildPelicanSinkOnCabinet({
        id: pickedSink.productId,
        pelicanCode: pickedSink.pelicanCode ?? null,
        name: pickedSink.name,
        imageUrl: pickedSink.imageUrl ?? null,
        size: pickedSink.size ?? null,
      }, sinkBase, room, { frontSetbackIn: setbackIn })
      : null;
    const budgetSink = !pelicanSink && budgetFriendly ? pickBudgetDefaultSink({ base: sinkBase, lineProducts: args.sinkCatalog ?? [] }) : null;
    if (pelicanSink) {
      sinks = keepSingleAutoDesignSink([pelicanSink], sinkBase.uid);
      if (resolvedSinkBase.note) notes.push(resolvedSinkBase.note);
    } else if (budgetSink && budgetSink.source !== "none") {
      const seated = budgetSink.source === "line"
        ? buildPelicanSinkOnCabinet({
          id: budgetSink.product.id,
          pelicanCode: budgetSink.product.pelicanCode ?? null,
          name: budgetSink.product.name,
          imageUrl: budgetSink.product.imageUrl ?? null,
          size: budgetSink.product.size ?? null,
        }, sinkBase, room, { frontSetbackIn: setbackIn })
        : (() => {
          // The verified default has no catalog row: drawn from its published geometry, never billed.
          const { pelicanProductId: _id, pelicanProductImage: _image, ...drawn } = buildPelicanSinkOnCabinet({
            id: 0, pelicanCode: budgetSink.profile.pelicanCode, name: budgetSink.profile.name, imageUrl: null, size: null,
          }, sinkBase, room, { frontSetbackIn: setbackIn });
          return drawn as SinkFixture;
        })();
      sinks = keepSingleAutoDesignSink([seated], sinkBase.uid);
      notes.push(budgetSink.note);
    } else {
      if (budgetSink) notes.push(budgetSink.note);
      const defaultSinkType = isFarmSinkBasePaletteItem(sinkBase) ? "farmhouse" : sinkBase.width >= 33 ? "double" : "single";
      // The basin is centered on its own sink base and set back into the approved
      // 2"–2½" band from the finished countertop front. No build path seats it
      // flush with the front edge or off-center on the base.
      sinks = keepSingleAutoDesignSink([
        makeSinkForCabinet(defaultSinkType, sinkBase, room, undefined, { frontSetbackIn: setbackIn }),
      ], sinkBase.uid);
    }
  }
  let sinkWindow: WallOpening | null = null;
  if (input.sinkWindowCenter && sinkBase) {
    const sinkWall = cabinetWall(sinkBase, room);
    const existingWindow = openings.find((opening) => opening.kind === "window" && opening.side === sinkWall) ?? null;
    if (existingWindow) {
      // Checkbox on + a window already on the sink wall: center the sink under
      // that window and do not invent a second one. Uppers stay clear (rule 9).
      const width = wallRunSpan(sinkBase, sinkWall, room);
      const start = existingWindow.offset + existingWindow.width / 2 - width / 2;
      const spot = wallPlacementAt(start, width, sinkBase.depth, sinkWall, room);
      if (spot) {
        const dx = spot.x - sinkBase.x;
        const dy = spot.y - sinkBase.y;
        working = working.map((item) => item.uid === sinkBase.uid ? { ...item, ...spot } : item);
        sinks = sinks.map((sink) => ({ ...sink, x: sink.x + dx, y: sink.y + dy }));
        notes.push(`The sink base was centered under the existing window on ${sinkWall}.`);
      }
    } else {
      const proposedWindow = autoDesignSinkWindow({ sink: sinkBase, room, uid: makeUid() });
      const touchesOpening = openings.some((opening) => opening.side === proposedWindow.side
        && opening.offset < proposedWindow.offset + proposedWindow.width - COLLISION_EPSILON_IN
        && opening.offset + opening.width > proposedWindow.offset + COLLISION_EPSILON_IN);
      if (windowOverlapsReservation(proposedWindow, refrigeratorReservation)) {
        notes.push("The sink window was not created: with its required 3-inch clearance it would run into the refrigerator’s cabinet above.");
      } else if (touchesOpening) {
        notes.push("The sink window was not created because it would overlap an existing door or window on that wall.");
      } else sinkWindow = proposedWindow;
    }
  }

  let workingOpenings = sinkWindow ? [...openings, sinkWindow] : openings;
  const wallLabels = autoDesignWallNameByEngineId(room, input.originCorner, input.runDirection);
  const raisedForSink = raiseWindowsForDeckFaucet({ sinks, room, openings: workingOpenings, wallLabels });
  workingOpenings = raisedForSink.openings;
  if (sinkWindow) sinkWindow = workingOpenings.find((opening) => opening.uid === sinkWindow!.uid) ?? sinkWindow;
  let faucetWindowNotes = [...raisedForSink.notes];
  notes.push(...raisedForSink.notes.map((note) => note.text));

  const fillWallIds = input.layoutType === "galley"
    ? AUTO_DESIGN_GALLEY_WALLS.flatMap((label) => {
      const wall = wallLabelToEngineWallId(label, room, input.originCorner, input.runDirection);
      return wall ? [wall.engineWallId] : [];
    })
    : selectedWalls;
  const stage = {
    input,
    anchors: Object.fromEntries(anchorsByKind),
    selectedWalls: autoDesignRunWallIds({
      layoutType: input.layoutType,
      room,
      originCorner: input.originCorner,
      runDirection: input.runDirection,
      wallIds: fillWallIds,
    }) as WallSide[],
    anchorPlaced: working,
    pool,
    wallPool: args.wallCatalog,
    straightBaseCatalog,
    drawerBaseCatalog,
    baseSource,
    refrigeratorReservation,
    slots: autoDesignCornerSlots(input.layoutType, {
      wallIds: selectedWalls, room, originCorner: input.originCorner, runDirection: input.runDirection,
    }),
    cornerOptions: autoBuildCornerCatalog(pool) as AutoBuildCornerCandidate[],
    sinkWindow,
    anchorOrigins,
  };

  const stageOpenings = workingOpenings;
  const excludedWallIds = autoDesignExcludedEngineWallIds(stage.input.layoutType, room, stage.input.originCorner, stage.input.runDirection);
  const runWalls = [...stage.selectedWalls];
  const upperCorners: AutoDesignUpperCorner[] = [];
  const applianceMoves: AutoDesignLayoutSuccess["applianceMoves"] = [];
  const seatedCorners: AutoDesignSeatedCorner[] = [];
  const anchoredUids = anchoredRefrigerator ? [anchoredRefrigerator.uid] : [];
  const lockedKinds = lockedAnchorKinds(input.intake);
  const lockedUids = lockedKinds.flatMap((kind) => {
    const anchor = anchorsByKind.get(kind);
    return anchor ? [anchor.uid] : [];
  });
  const fixedAnchorUids = Array.from(new Set([...anchoredUids, ...lockedUids]));
  if (lockedKinds.length > 0) notes.push(`Utilities that cannot move stay at their measured spot (no 3″ wiggle): ${lockedKinds.join(", ")}.`);
  const catalogFillers = args.fillers as unknown as CatalogFillerCandidate[];
  const sinkAnchor = anchorsByKind.get("sink") ?? null;
  const companionKeepUids: string[] = [];
  const economyCorners: Array<{ label: string; wallIds: WallSide[]; corner: { x: number; y: number } }> = [];
  const wantedCornerFamily = hasPreference(input.intake, "lazy-susan") ? "lazy-susan" : hasPreference(input.intake, "blind-corner") ? "blind" : null;
  if (wantedCornerFamily && !stage.cornerOptions.some((option) => autoDesignCornerFamily(option) === wantedCornerFamily)) {
    notes.push(`The customer asked for a ${wantedCornerFamily === "blind" ? "blind corner" : "lazy Susan"}, but this line sells none, so the type is chosen from the appliances and the run math.`);
  }
  for (const slot of stage.slots) {
    const firstWall = wallLabelToEngineWallId(slot.firstWall, room, input.originCorner, input.runDirection);
    const secondWall = wallLabelToEngineWallId(slot.secondWall, room, input.originCorner, input.runDirection);
    if (!firstWall || !secondWall) return fail(`${slot.label} is unavailable in this room. No remaining cabinets were added.`);
    if (excludedWallIds.includes(firstWall.engineWallId) || excludedWallIds.includes(secondWall.engineWallId)) continue;
    for (const wallId of [firstWall.engineWallId, secondWall.engineWallId] as WallSide[]) {
      if (!excludedWallIds.includes(wallId) && !runWalls.includes(wallId)) runWalls.push(wallId);
    }
    const point = autoDesignCornerSlotPoint(slot, room, input.originCorner, input.runDirection);
    if (!point) return fail(`${slot.label} does not resolve to a real shared wall vertex. No remaining cabinets were added.`);
    const cornerFridge = working.find((item) => isRefrigerator(item) && (() => {
      const foot = placedFootprint(item);
      return point.x >= item.x - 1 && point.x <= item.x + foot.w + 1 && point.y >= item.y - 1 && point.y <= item.y + foot.d + 1;
    })());
    if (cornerFridge) {
      notes.push(`${slot.label}: the refrigerator already occupies this corner. A corner cabinet is not seated on top of it.`);
      continue;
    }
    // Economy corner (Tom, voice, Nov 19 2026, 8:44 + 9:01 AM CT): a budget build buys no corner
    // cabinet. Each leg claims 24" + a 3" filler first; the bases are sized to what is left.
    if (budgetFriendly && !wantedCornerFamily) {
      const economy = seatEconomyCorner({
        label: slot.label,
        wallIds: [firstWall.engineWallId, secondWall.engineWallId] as WallSide[],
        corner: point,
        placed: working,
        room,
        catalogFillers,
        makeUid,
        styleId: args.styleId,
      });
      notes.push(economy.note);
      if (economy.ok) {
        // The boards themselves are seated by the final economy pass, after every re-tile; here the
        // corner only skips the corner cabinet (the 24" square stays reserved by the corner stage).
        economyCorners.push({ label: slot.label, wallIds: [firstWall.engineWallId, secondWall.engineWallId] as WallSide[], corner: point });
        continue;
      }
    }
    const typeDecision = decideAutoDesignCornerTypeOrder({
      room,
      cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
      corner: point,
      placed: working,
      options: stage.cornerOptions,
      wiggleLimitIn: autoDesignShiftLimitIn("cabinet"),
      preferLazySusan: wantedCornerFamily === "lazy-susan",
      preferBlind: wantedCornerFamily === "blind",
    });
    notes.push(describeCornerTypeDecision(slot.label, typeDecision));
    if (typeDecision.blocked) {
      notes.push(typeDecision.reason);
      notes.push(`cannot fit at ${slot.label}.`);
      reviewFindings.push({
        ruleId: "corner-first-least-waste",
        code: "corner-cabinet-not-seated",
        severity: "warning",
        title: `${slot.label}: no corner cabinet was seated`,
        detail: typeDecision.reason,
      });
      continue;
    }
    const cornerOptionsForBuild = stage.cornerOptions;
    const fit = evaluateAutoDesignCornerFit({
      options: cornerOptionsForBuild,
      room,
      placed: working,
      corner: point,
      wallIds: [firstWall.engineWallId, secondWall.engineWallId],
      sink: sinkAnchor,
      openings: stageOpenings,
    });
    if (fit.fallbackNote) notes.push(fit.fallbackNote);
    // Rule 2: plan a fitting blind (and its pull) against the anchors. A straight
    // base is never a corner plan; the type comes from the appliances and the math.
    const cornerPlan = typeDecision.order[0] === "blind" || typeDecision.order.includes("blind")
      ? pickCornerFirst({
        cornerOptions: stage.pool.filter((row) => cornerOptionsForBuild.some((option) => option.id === row.id && autoDesignCornerFamily(option) === "blind")),
        room,
        cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
        corner: point,
        placed: working,
        wiggleLimitIn: autoDesignShiftLimitIn("cabinet"),
      })
      : null;
    // Only report the blind plan when the blind is the corner being built; a lazy Susan corner
    // used to get both notes for the same corner (Natura Maple 12x10 L report, Nov 19 2026).
    if (cornerPlan && typeDecision.order[0] === "blind") notes.push(`${slot.label}: ${describeCornerFirst(cornerPlan)}`);
    const plannedBlind = typeDecision.order[0] === "blind" && cornerPlan && (cornerPlan.kind === "blind" || cornerPlan.kind === "blind-pulled")
      ? cornerOptionsForBuild.find((candidate) => candidate.id === cornerPlan.source.id) ?? null
      : null;
    const seated = seatAutoDesignCornerFromCatalog({
      slot,
      options: cornerOptionsForBuild,
      pool: stage.pool,
      preferred: plannedBlind,
      familyOrder: typeDecision.order,
      target: point,
      cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
      working,
      room,
      openings: stageOpenings,
      measuredApplianceUids: stage.anchorOrigins.filter((entry) => entry.kind === "refrigerator").map((entry) => entry.uid),
      immovableApplianceUids: anchoredUids,
      blindPullIn: plannedBlind && cornerPlan ? Math.round(cornerPlan.pullIn * 8) / 8 : undefined,
      catalogFillers,
      makeUid,
      styleId: args.styleId,
      excludedWallIds,
      allowPlaceholderFiller: Boolean(input.intake),
      preferredBlindWallId: typeDecision.rotateBlind ? typeDecision.openWallId : null,
    });
    if (cornerPlan && cornerFirstWasPulled(cornerPlan) && !seated.ok) {
      notes.push(`${slot.label}: ${cornerPlan.source.masterCode} could not be pulled to fill the leg, so the standard corner order was used.`);
    }
    if (!seated.ok) {
      // Keep the measured kitchen. A corner that cannot seat (a refrigerator
      // already in it, or a range closer than the slide limit) must not wipe
      // the runs. PR #133 owns the corner-occupant refrigerator bay.
      notes.push(seated.message);
      // A required corner is never left empty in silence: the reason goes on the
      // review list with the slot name, so it is visible outside the notes panel.
      reviewFindings.push({
        ruleId: "corner-first-least-waste",
        code: "corner-cabinet-not-seated",
        severity: "warning",
        title: `${slot.label}: no corner cabinet was seated`,
        detail: seated.message,
      });
      continue;
    }
    if (seated.fallbackNote) notes.push(seated.fallbackNote);
    working = seated.placed;
    if (typeDecision.band === "lazy-susan" || typeDecision.band === "lazy-susan-plus-nine") {
      // Kept from the removed 9 in companion pass (Tom, Nov 18 2026): a measured
      // sink on a lazy Susan leg is still kept from being walked 3" by later passes.
      // No space beside the corner is reserved; the normal base fill and gap passes own it.
      for (const wallId of [firstWall.engineWallId, secondWall.engineWallId]) {
        if (!wallId || !(wallRunSpan(seated.corner, wallId, room) > 0)) continue;
        const sink = working.find((item) => item.placement === "base" && /^SB/i.test(item.masterCode) && cabinetWall(item, room) === wallId);
        if (sink && !companionKeepUids.includes(sink.uid)) companionKeepUids.push(sink.uid);
      }
    }
    applianceMoves.push(...seated.moves);

    seatedCorners.push({
      slotId: slot.id,
      label: slot.label,
      masterCode: seated.source.masterCode,
      family: autoDesignCornerFamily(seated.source),
      fallbackNote: seated.fallbackNote,
    });
    upperCorners.push({ base: seated.corner, point });
  }
  // A true BBC always includes its 3-inch filler. If a prior pass seated the
  // base without it (or the base was first misread as not blind), attach it now.
  const sealedBlindFillers = ensureRequiredBlindCornerBaseFillers({
    placed: working,
    room,
    catalogFillers,
    makeUid,
    styleId: args.styleId,
    allowPlaceholder: Boolean(input.intake),
  });
  working = sealedBlindFillers.placed;
  notes.push(...sealedBlindFillers.notes);
  for (const item of working) {
    if (isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId) && !companionKeepUids.includes(item.uid)) {
      companionKeepUids.push(item.uid);
    }
  }

  // An L cabinets both legs even when they meet at 45° and therefore have no
  // corner cabinet. A 45°/135° wall that touches a run already in the build is
  // a real run too: straight cabinets along it, angled filler at the join.
  if (input.layoutType === "l-shape") {
    const share = autoDesignCornerSlotPoint(
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
      room, input.originCorner, input.runDirection,
    );
    if (share) {
      for (const label of ["Wall 1", "Wall 2"] as const) {
        const wall = wallLabelToEngineWallId(label, room, input.originCorner, input.runDirection);
        if (wall && !excludedWallIds.includes(wall.engineWallId) && !runWalls.includes(wall.engineWallId as WallSide)) {
          runWalls.push(wall.engineWallId as WallSide);
        }
      }
    }
  }
  if (input.layoutType !== "single-wall") {
    for (const id of autoDesignAngledNeighborWallIds(runWalls, room, excludedWallIds)) {
      if (!runWalls.includes(id as WallSide)) runWalls.push(id as WallSide);
    }
  }

  // Economic corner (Tom, Nov 19 2026, 11:59 AM CT; scoped budget-only Nov 20 2026, 11:03 AM CT):
  // the 27" footprint of every accepted economic corner leg. Outside budget mode this list stays empty,
  // so wiggle, base fill, real-cabinets and minimum-filler never reserve or slide around a keep-clear span.
  const economyClaims = budgetFriendly
    ? economyCorners.flatMap((economy) => economy.wallIds.flatMap((wallId) => {
      const claim = economyCornerClaimSpan(wallId, economy.corner, room);
      return claim ? [claim] : [];
    }))
    : [];
  const wiggle = applyAutoDesignWiggleRoom({
    keepClearSpans: economyClaims,
    placed: working,
    room,
    openings: stageOpenings,
    catalog: stage.straightBaseCatalog,
    origins: stage.anchorOrigins,
    lockedUids: [],
    fixedUids: fixedAnchorUids,
  });
  working = wiggle.placed;
  const separated = separateRangeAndRefrigerator({
    placed: working,
    room,
    origins: stage.anchorOrigins,
    fixedRefrigeratorUids: anchoredUids,
    // The Setup Step 2 answers: a locked range or refrigerator must not be slid by
    // this stage either. It only protected a pre-existing refrigerator before, so a
    // "No" on the range hookup was still overruled here.
    fixedUids: fixedAnchorUids,
  });
  working = separated.placed;
  let reservation = stage.refrigeratorReservation;
  const refrigeratorShift = wiggle.moves.find((move) => move.kind === "refrigerator");
  if (reservation && refrigeratorShift) {
    reservation = { ...reservation, start: reservation.start + refrigeratorShift.deltaAlongIn, end: reservation.end + refrigeratorShift.deltaAlongIn };
  }
  const usage = normalizeKitchenUsage(stage.input.kitchenUsage);
  const heavyCook = cooksALot(usage);
  const preferDrawers = heavyCook || bakesALot(usage) || hasPreference(stage.input.intake, "lots-of-drawers");
  // Tall oven / pantry cabinets are picked in the tall pop-up and never dropped
  // into a run unasked. They are seated as run anchors BEFORE the base runs tile
  // the walls, so a pantry reserves its span the same way a measured appliance
  // does instead of being refused by a wall that just got filled. A tall box goes
  // at the END of a run, never the start of the first free span, and several
  // picks are allowed: each one is seated in turn and re-reads the plan, so a
  // second pantry closes the run next to the first. The wall ends, the
  // refrigerator panel limit, the ceiling, and every cabinet already seated all
  // still apply; nothing moves a range, sink, or refrigerator, and windows never
  // move. A pick that cannot seat is named with the reason it was dropped.
  const tallPicks = input.tallCabinets ?? [];
  for (const pick of tallPicks) {
    const source = resolveTallPick(args.tallCatalog ?? [], pick);
    const product = source ? autoDesignTallProducts([source])[0] : undefined;
    if (!source || !product) {
      reviewFindings.push({
        ruleId: "tall-cabinet-popup",
        code: "tall-cabinet-unavailable",
        severity: "warning",
        title: `${pick.masterCode} is not in this line's catalog`,
        detail: "The tall cabinet picked in the pop-up is no longer a source-priced tall box, so it was not placed.",
      });
      continue;
    }
    const fit = planAutoDesignTallFit({
      product,
      room,
      placed: working,
      openings: stageOpenings,
      wallIds: stage.selectedWalls,
      // Every wall this build will fill, so a tall box never claims an inside corner
      // that another run is about to occupy.
      runWallIds: runWalls,
      allowMultiple: tallPicks.length > 1,
      // A tall box is a run terminator; it must not leave the sink base as the
      // last floor box at a run end with the basin jammed against it.
      sinkLandingIn: sinkTallLandingIn(),
    });
    if (!fit.ok) {
      reviewFindings.push({
        ruleId: "tall-cabinet-popup",
        code: fit.code,
        severity: "warning",
        title: `${product.masterCode} was not placed`,
        detail: fit.reason,
      });
      continue;
    }
    const placedTall = tallCabinetPlacement({
      product,
      source,
      wallId: fit.wallId,
      spot: fit.placement,
      alongIn: fit.alongIn,
      uid: makeUid(),
      styleId: args.styleId,
    });
    const accepted = appendCollisionFreePlacements(working, [placedTall], room);
    if (accepted.rejected.length > 0) {
      reviewFindings.push({
        ruleId: "tall-cabinet-popup",
        code: "tall-cabinet-blocked",
        severity: "warning",
        title: `${product.masterCode} was not placed`,
        detail: "The tall box overlapped a cabinet already seated, so it was left off the plan.",
      });
      continue;
    }
    working = accepted.placed;
    const seatText = fit.seat === "end" ? " at the end of the run" : fit.seat === "start" ? " at the start of the run" : "";
    notes.push(`${product.masterCode} placed as a ${product.widthIn}″ × ${product.heightIn}″ tall cabinet${seatText}.`);
  }
  // Reserve every inside-corner square of the cabineted runs before the base
  // fill (and every later leftover / "use every inch" / intake-repack pass).
  const cornerReserved = [...autoDesignInsideCornerReservations(room, runWalls)];
  const cornerReservedUpper = [...cornerReserved]; // the 24" voids only: the upper row keeps its own corner decision
  // Economic corner (Tom, Nov 19 2026, 11:59 AM CT): the whole 27" footprint (24" void + the 3" filler seat)
  // is reserved on every leg whose economic corner was accepted, so no later pass seats or slides a box into it.
  for (const claim of economyClaims) {
    const at24 = cornerReserved.findIndex((span) => span.wallId === claim.wallId && (Math.abs(span.start - claim.start) <= 0.01 || Math.abs(span.end - claim.end) <= 0.01));
    if (at24 >= 0) cornerReserved[at24] = claim;
  }
  let basePieceCount = 0;
  for (const wallId of runWalls) {
    const rawSegments = freeSegmentsOnWall(wallId, room, working, stageOpenings, 9, 0, "base", false, undefined, footprintDepth(stage.baseSource));
    const peninsulaHold = peninsulaRequest && wallId === "bottom" ? autoDesignPeninsulaAttachment(room, peninsulaRequest.side) : null;
    const reservations = [
      ...(reservation?.wall === wallId ? [{ start: reservation.start, end: reservation.end }] : []),
      ...(peninsulaHold ? [{ start: peninsulaHold.reserveStart, end: peninsulaHold.reserveEnd }] : []),
      ...cornerReservationsOnWall(wallId, cornerReserved),
    ];
    for (const segment of subtractAnchorRunReservations(rawSegments, reservations)) {
      const segmentStartUids = new Set(working.map((item) => item.uid));
      const beside = (edge: "start" | "end") => working.some((other) => other.placement === "appliance"
        && isRangeOrOven(other.masterCode, other.description) && cabinetWall(other, room) === wallId
        && Math.abs((edge === "start" ? wallRunOffset(other, wallId, room) + wallRunSpan(other, wallId, room) - segment.start
          : segment.start + segment.length - wallRunOffset(other, wallId, room))) <= 0.05);
      let along = segment.start;
      const segmentEnd = segment.start + segment.length;
      let guard = 0;
      while (segmentEnd - along > autoDesignFillerMaxIn() + 0.05 && guard < 40) {
        guard += 1;
        const remain = segmentEnd - along;
        const fill = planAutoDesignBaseSegment({
          length: remain, catalog: stage.straightBaseCatalog, rangeAtStart: beside("start") && along <= segment.start + 0.05, rangeAtEnd: beside("end"),
          heavyCookLanding: heavyCook, preferDrawerBesideRange: preferDrawers, drawerCatalog: stage.drawerBaseCatalog,
        });
        if (fill.note) notes.push(fill.note);
        // A door + drawer split beside the range is placed as one unit, in order, so the drawer base really lands
        // against the range instead of being re-planned (as a plain door base) on the next pass.
        if (fill.items.some((entry) => entry.drawerSplit)) {
          let trial = working;
          let cursor = along;
          let pieces = 0;
          let allPlaced = true;
          for (const entry of fill.items) {
            if (entry.isFiller) { cursor += entry.width; continue; }
            const source = entry.cabinet;
            const depth = footprintDepth(source);
            // Rule: nothing past the wall end. wallPlacementAt clamps the start, so it would
            // happily hang a wide box off the run; boundedWallPlacementAt refuses that.
            const spot = boundedWallPlacementAt(cursor, entry.width, depth, wallId, room);
            if (!spot) { allPlaced = false; break; }
            const piece: PlacedCabinet = {
              uid: makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
              category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width: entry.width, depth,
              height: dim(source.height, standardHeight("base")), catalogImageUrl: source.catalogImageUrl ?? null,
              numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers, styleId: args.styleId,
            };
            const accepted = appendCollisionFreePlacements(trial, [piece], room);
            if (accepted.rejected.length > 0) { allPlaced = false; break; }
            trial = accepted.placed;
            cursor += entry.width;
            pieces += 1;
          }
          if (allPlaced && pieces > 0) {
            working = trial;
            basePieceCount += pieces;
            along = cursor;
            continue;
          }
        }
        // Lay the solved run in one pass. Re-planning after every single box
        // is what left a fresh filler in each remainder.
        const solvedCabinets = fill.items.filter((entry) => !entry.isFiller);
        if (solvedCabinets.length > 1) {
          let trial = working;
          let cursor = along;
          let pieces = 0;
          let allPlaced = true;
          for (const entry of solvedCabinets) {
            const source = entry.cabinet;
            const depth = footprintDepth(source);
            const spot = boundedWallPlacementAt(cursor, entry.width, depth, wallId, room);
            if (!spot) { allPlaced = false; break; }
            const piece: PlacedCabinet = {
              uid: makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
              category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width: entry.width, depth,
              height: dim(source.height, standardHeight("base")), catalogImageUrl: source.catalogImageUrl ?? null,
              numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers, styleId: args.styleId,
            };
            const accepted = appendCollisionFreePlacements(trial, [piece], room);
            if (accepted.rejected.length > 0) { allPlaced = false; break; }
            trial = accepted.placed;
            cursor += entry.width;
            pieces += 1;
          }
          if (allPlaced && pieces === solvedCabinets.length) {
            working = trial;
            basePieceCount += pieces;
            along = cursor;
            continue;
          }
        }
        const widths = Array.from(new Set(stage.straightBaseCatalog.map((row) => dim(row.width, 0)).filter((width) => width > 0 && width <= remain + 0.05)))
          .sort((a, b) => b - a);
        const preferred = fill.items.find((item) => !item.isFiller)?.width;
        const order = preferred ? [preferred, ...widths.filter((width) => Math.abs(width - preferred) > 0.05)] : widths;
        let placedOne = false;
        for (const width of order) {
          const item = fill.items.find((entry) => !entry.isFiller && Math.abs(entry.width - width) <= 0.05);
          const source = item?.cabinet ?? stage.straightBaseCatalog.find((row) => Math.abs(dim(row.width, 0) - width) <= 0.05);
          if (!source) continue;
          const depth = footprintDepth(source);
          const spot = boundedWallPlacementAt(along, width, depth, wallId, room);
          if (!spot) continue;
          const candidate: PlacedCabinet = {
            uid: makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
            category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width, depth,
            height: dim(source.height, standardHeight("base")), catalogImageUrl: source.catalogImageUrl ?? null,
            numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers, styleId: args.styleId,
          };
          const accepted = appendCollisionFreePlacements(working, [candidate], room);
          if (accepted.rejected.length === 0) {
            working = accepted.placed;
            basePieceCount += 1;
            along += width;
            placedOne = true;
            break;
          }
        }
        // An adjoining run's cabinet projects into this corner. Jump to the
        // next point a real box fits, in one step. Stepping 3" at a time left
        // a filler in every step.
        if (!placedOne) {
          const next = nextFittingBaseAlong({
            working, catalog: stage.straightBaseCatalog, along, segmentEnd, wallId, room,
          });
          if (next == null || next <= along + 0.05) break;
          along = next;
        }
      }
      // 45° corners (Tom, Nov 16 2026, voice 11:53 AM CT): the run is built
      // FROM the end of the 3″ angled filler. A segment that ends at a 45°
      // corner seat (and does not also start at one) is laid from its start,
      // so its leftover would land against the corner and widen the angled
      // filler past 3″. Slide the boxes this segment just laid toward the
      // corner, so the last one ends exactly at the seat and the leftover sits
      // at the other end of the segment (beside a cabinet, appliance or panel)
      // where the ordinary gap passes close it.
      const endSeat = fortyFiveCornerSeat(room, wallId, "end", "base", { neighborWallIds: runWalls });
      const startSeat = fortyFiveCornerSeat(room, wallId, "start", "base", { neighborWallIds: runWalls });
      const segmentFrame = wallRunFrame(wallId, room);
      if (endSeat && segmentFrame && !(startSeat && segment.start <= segmentFrame.runStart + startSeat.cabinetSetbackIn + 0.05)
        && Math.abs(segmentEnd - (segmentFrame.runEnd - endSeat.cabinetSetbackIn)) <= 0.05) {
        working = slideSegmentToFortyFiveSeat(working, segmentStartUids, wallId, segment.start, segmentEnd, room);
      }
      // Tom, Nov 16 2026 (voice 12:14 PM CT): a corner-adjacent cabinet snaps
      // into place the way it does when it is dropped by hand. The Designer's
      // own drop snap (`magneticAvailableWallStart` over `freeSegmentsOnWall`)
      // is reused with the 3″ angled-filler seat treated as occupied, so the
      // first box on each side lands against the filler end.
      working = snapFortyFiveCornerCabinets(working, segmentStartUids, wallId, runWalls, room, stageOpenings);
    }
  }
  working = absorbOpenBaseGaps(working, room, stage.straightBaseCatalog, runWalls, args.styleId, makeUid, cornerReserved);
  // Owner rule: a real base cabinet stands on EACH side of the range, and the
  // range is wiggled along its own wall (by the 1/8" difference) so both sides
  // land on a stock width. A side that is already a stock width needs no move.
  // Filler is never the answer here; it appears only when nothing stock fits,
  // and a finished end panel gets its own 3/4" outside an open flank first.
  const flankPanels = args.panelCatalog ?? (args.fillers as unknown as DesignCabinet[]);
  const panelThickness = flankPanels.some((row) => exposedPanelTypeForCatalog(row) === "base-end")
    ? RANGE_FLANK_PANEL_THICKNESS_IN
    : 0;
  const flankPlans = planRangeFlankCabinets({
    placed: working,
    room,
    openings: stageOpenings,
    catalog: pool,
    origins: stage.anchorOrigins,
    fillerMaxIn: autoDesignFillerMaxIn(),
    panelThicknessIn: panelThickness,
  });
  const flanked = applyRangeFlankPlan({ placed: working, room, plans: flankPlans, styleId: args.styleId, makeUid });
  working = flanked.placed;
  notes.push(...flanked.notes);
  if (flanked.plans.length > 0) {
    // Finished end panels on the outside of each flank cabinet: the line's own
    // end panel SKU, cut from stock, placed as a real row so plan, elevation and
    // 3D draw it and the cart, quote and PO bill it and nothing else.
    const panelPlan = rangeFlankPanelRequests({ placed: working, room, plans: flanked.plans });
    if (panelPlan.requests.length > 0) {
      const panels = applyRangeFlankEndPanels({
        placed: working,
        room,
        catalog: flankPanels,
        requests: panelPlan.requests,
        styleId: args.styleId,
        makeUid,
      });
      working = panels.placed;
      notes.push(...panels.notes);
      for (const skip of panels.skipped) {
        reviewFindings.push({
          ruleId: "range-flank-finished-ends",
          code: "flank-end-panel-not-placed",
          severity: "warning",
          title: `${skip.cabinetCode} beside the range has no end panel`,
          detail: `The owner rule finishes the outside of the cabinet on each side of the range, and ${skip.reason}.`,
          cabinetUid: skip.cabinetUid,
          cabinetCode: skip.cabinetCode,
        });
      }
    }
    // A flank whose outside already abuts a cabinet (the corner box of a U or L
    // kitchen) is finished by that cabinet. Double-stocking it would be wrong, so
    // the side is described on the plan instead of being given a second board.
    for (const side of panelPlan.unspaced) notes.push(describeUnfinishedFlank(side));
  }  // Every layout has at least one three-drawer base (Tom, Oct 31). The planner already splits a wide door base beside
  // the range; if no drawer base landed anywhere, convert the best-fitting base run. A line with no drawer base only warns.
  const drawerRule = ensureDrawerBase({ placed: working, room, catalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog], makeUid, styleId: args.styleId });
  working = drawerRule.placed;
  if (drawerRule.note) notes.push(drawerRule.note);
  if (drawerRule.warning) drawerRuleWarnings.push(drawerRule.warning);
  // A run end is finished, not gapped: no filler is appended at the end of a run,
  // and one board per run is the most Auto-Design ever places. The small-gap pass
  // is therefore off here (the measured build fills only a genuine sliver below).
  const baseRules = applyDesignerLayoutRules({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid, styleId: args.styleId,
    // Owner rule: filler is the last resort, never automatic. Real cabinets first
    // (shared pass below), and no end-of-run filler at all.
    allowAutoFillers: false,
  });
  working = baseRules.placed;
  // The shared "real cabinets before filler" pass runs on EVERY wall and both
  // layers: slide within the wiggle room, widen a neighbor, or seat a real narrow
  // cabinet before any sliver is called unusable.
  const wallHeightNominal = stage.input.wallCabinetHeightIn ?? 30;
  const wallDesignHeight = Math.abs(wallHeightNominal - 42) < 0.05
    ? resolveWallHeightClass(stage.wallPool, 42) ?? 42
    : null;
  const heightMatchedCatalog = catalogMatchingWallDesignHeight(
    [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...stage.wallPool],
    wallHeightNominal,
  );
  const realCabinets = applyRealCabinetsBeforeFiller({
    placed: working,
    room,
    openings: stageOpenings,
    catalog: heightMatchedCatalog,
    makeUid,
    styleId: args.styleId,
    wallIds: runWalls,
    // Anchors (range, refrigerator, sink base) move at most 2 inches; every other
    // cabinet may use the normal allowance.
    // The Budget friendly cabinet over the refrigerator has no panels to hold it, so it stays centered on the appliance.
    slideLimitFor: (item) => (item.refrigeratorBudgetBridge === true ? 0 : isSinkBaseCabinet(item)
      || (item.placement === "appliance" && (isRangeOrOven(item.masterCode, item.description) || isRefrigerator(item)))
      ? kitchenRuleNumber("anchor_wiggle_cap_in")
      : kitchenRuleNumber("jog_max_in")),
    wallHeightIn: wallDesignHeight,
    // Only the 45° filler seats: the 90° corner square keeps today's behavior here.
    reservedSpans: [...cornerReserved.filter((span) => fortyFiveSeatSpan(room, span, runWalls) && !economyClaims.some((claim) => claim.wallId === span.wallId && Math.abs(claim.start - span.start) <= 0.01 && Math.abs(claim.end - span.end) <= 0.01)), ...economyClaims], // economic corner footprint (Tom, Nov 19 2026, 11:59 AM CT)
  });
  working = realCabinets.placed;
  notes.push(...realCabinets.notes);
  // Filler is the last resort, and only for a sliver no real cabinet can take —
  // never at a run end that lands on its wall.
  for (const gap of realCabinets.unfilled) {
    const sliver = isFillerLastResort({
      gapIn: gap.widthIn,
      catalog: [...stage.straightBaseCatalog, ...stage.wallPool],
      layer: gap.layer,
    });
    if (!sliver) {
      reviewFindings.push({
        ruleId: "real-cabinets-before-filler",
        code: "opening-needs-a-cabinet",
        severity: "warning",
        title: `${formatEighthInches(gap.widthIn)} opening on ${gap.wallId}`,
        detail: "No cabinet in this line fits that space, and nothing could legally slide to open one.",
      });
    }
  }
  const seamResult = fillAutoDesignLowerSeams({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid,
    styleId: args.styleId, corners: upperCorners.map((entry) => entry.point),
    preserveHeavyCookLandings: heavyCook, maxFillerIn: autoDesignFillerMaxIn(),
  });
  working = absorbOpenBaseGaps(seamResult.placed, room, stage.straightBaseCatalog, runWalls, args.styleId, makeUid, cornerReserved);
  notes.push(...seamResult.notes, ...separated.flags);
  // Rule 3: a 9–12 inch hole beside the range is closed with a REAL cabinet — the adjoining
  // cabinet grows to a wider SKU of the same family, or a real narrow cabinet plus a small filler
  // takes the last inch. Filler alone was why these openings stayed open.
  const leftover = resolveLeftoverOpenings({
    placed: working,
    room,
    catalog: stage.straightBaseCatalog,
    walls: runWalls,
    styleId: args.styleId,
    makeUid,
    reviewFindings,
    cornerReserved,
  });
  working = leftover.placed;
  notes.push(...leftover.notes);
  // Owner rule: the sink base is never the last floor box against a tall unit or
  // refrigerator. The base runs and the tall picks are both down, so a slide that
  // opens the landing is known exactly. The sink base slides (within its own
  // anchor cap); nothing else moves. A sink that still has no landing is named.
  const landingFix = slideSinkForLanding({ placed: working, room, notes, reviewFindings, lockedUids });
  working = landingFix.placed;
  // HARD RULE (owner, Nov 5 2026): a real bridge wall cabinet is placed above the
  // range on EVERY build, and it goes in BEFORE the upper run tiles. Seating it
  // first makes the bridge an occupied upper, so the wall run never lays an
  // ordinary cabinet over the range and never leaves a sliver beside the bridge.
  // It is mandatory: no popup answer and no fallback chain can skip it.
  const bridgeResult = placeMandatoryOverRangeBridges({
    placed: working,
    room,
    wallCatalog: args.wallCatalog,
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId,
    makeUid,
  });
  if (bridgeResult.added) {
    working = bridgeResult.placed;
    notes.push(...bridgeResult.notes);
  }
  reviewFindings.push(...bridgeResult.findings);
  // When there is no window over the sink, a short catalog bridge (same width as
  // the sink base, height paired to the neighboring wall cabinets like the range
  // bridge) is seated before the upper run tiles so a full-height cabinet is never
  // laid over the sink (Tom, Nov 14 2026, 2:01–2:02 PM CT).
  const sinkBridgeResult = placeSinkBridges({
    placed: working,
    room,
    openings: stageOpenings,
    wallCatalog: args.wallCatalog,
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId,
    makeUid,
  });
  working = sinkBridgeResult.placed;
  notes.push(...sinkBridgeResult.notes);
  reviewFindings.push(...sinkBridgeResult.findings);
  if (sinkBridgeResult.added) {
    for (const item of working) {
      if (item.placement === "wall" && Math.abs((item.mountBottom ?? 0) - 72) <= 0.6 && !companionKeepUids.includes(item.uid)) {
        // Keep over-sink and over-range bridges through the 15-rule retile.
        const wall = cabinetWall(item, room);
        const start = wallRunOffset(item, wall, room);
        const end = start + wallRunSpan(item, wall, room);
        const overAnchor = working.some((other) => {
          if (other.uid === item.uid) return false;
          if (cabinetWall(other, room) !== wall) return false;
          if (!(isSinkBaseCabinet(other) || (other.placement === "appliance" && isRangeOrOven(other.masterCode, other.description)))) return false;
          const otherStart = wallRunOffset(other, wall, room);
          const otherEnd = otherStart + wallRunSpan(other, wall, room);
          return Math.min(end, otherEnd) - Math.max(start, otherStart) > 1;
        });
        if (overAnchor) companionKeepUids.push(item.uid);
      }
    }
  }
  // The range is otherwise left open to the design question: the microwave and hood
  // follow the add-only logic after the run is tiled.
  const upperResult = buildAutoDesignWallCabinets({
    placed: working, room, openings: stageOpenings, catalog: [...stage.wallPool],
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId, makeUid, corners: upperCorners, catalogFillers, closeSeams: true,
    // Standard and budget (Tom, Nov 20 2026, 4:25 / 4:33 PM CT): a diagonal
    // corner wall cabinet (DCW) at every empty inside 90° upper corner, seated
    // before the straight uppers tile, not tied to a seated base.
    diagonalCornerUppers: true,
  });
  working = upperResult.placed;
  notes.push(...upperResult.substitutions);
  for (const reason of upperResult.skipped) {
    reviewFindings.push({
      ruleId: "corner-first-least-waste",
      code: "upper-skip",
      severity: "warning",
      title: "Upper review",
      detail: reason,
    });
  }
  // The refrigerator end panels are a hard stop for the UPPER layer too. The
  // floor layer is clamped inside `applyDesignerLayoutRules`, but the wall
  // cabinets and their fillers are tiled after that, which is how a 24" upper
  // plus a 1-1/4" filler ended up running through the tall panel in 3D.
  working = clampPlacedToRefrigeratorPanels(working, room).placed;
  const finishedRules = applyDesignerLayoutRules({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid, styleId: args.styleId,
    // The automatic small-gap pass is off for the whole measured build: filler is
    // the last resort, and a run closes with one board at most (below).
    allowAutoFillers: false,
  });
  working = capAutoDesignFillerWidth(finishedRules.placed);
  const finalBlindFillers = ensureRequiredBlindCornerBaseFillers({
    placed: working,
    room,
    catalogFillers,
    makeUid,
    styleId: args.styleId,
    allowPlaceholder: Boolean(input.intake),
  });
  working = finalBlindFillers.placed;
  notes.push(...finalBlindFillers.notes.filter((note) => !notes.includes(note)));
  // One board per run end. Before this pass a run could collect a 1¼″ beside a
  // stock run, a 1″ beside the range and a 3″ at each window shoulder, because
  // every stage filled its own sliver. Now a stock width closes the opening when
  // one exists, and the boards of one run are consolidated into a single board.
  const stockClosed = closeSmallOpeningsWithStock({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: runWalls,
    catalog: heightMatchedCatalog,
    maxOpeningIn: autoDesignFillerMaxIn(),
    styleId: args.styleId,
    makeUid,
    wallHeightIn: wallDesignHeight,
    reservedSpans: cornerReserved,
  });
  working = stockClosed.placed;
  notes.push(...stockClosed.notes);
  const consolidated = consolidateAutoDesignFillers({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: runWalls,
    catalog: heightMatchedCatalog,
    fillers: catalogFillers,
    maxFillerIn: FILLER_STRIP_MAX_IN,
    makeUid,
    styleId: args.styleId,
    wallHeightIn: wallDesignHeight,
  });
  working = consolidated.placed;
  notes.push(...consolidated.notes);
  reviewFindings.push(...consolidated.warnings);
  reviewFillers(runWalls, working, room, stageOpenings, reviewFindings);
  // A wall that received wall cabinets and no bases is a silent half-wall: Tom hit
  // it twice (Nov 15 2026). Never build that quietly - name the wall and the reason.
  for (const wallId of runWalls) {
    const onWall = working.filter((item) => cabinetWall(item, room) === wallId);
    const hasWall = onWall.some((item) => item.placement === "wall" && !isFillerItem(item));
    const hasBase = onWall.some((item) => item.placement === "base" && !isFillerItem(item));
    if (!hasWall || hasBase) continue;
    reviewFindings.push({
      ruleId: "base-run-required",
      code: "wall-run-without-bases",
      severity: "warning",
      title: "Wall cabinets with no base run",
      detail: `The ${wallId} wall has wall cabinets but no base cabinets. The priced base pool was empty, or every span on that wall was narrower than the smallest base the line sells.`,
    });
  }
  // NKBA planning guidelines that were not encoded before: total usable counter
  // frontage, a preparation run beside the sink, and a landing for a microwave or
  // wall oven. Each names its number on the review list rather than staying silent.
  reviewFindings.push(...reviewNkbaPlan({ placed: working, room }));
  // Owner rule: the counter never runs through a panel. The dishwasher panel is
  // the one it sits on; anything larger stops the slab at its face.
  reviewFindings.push(...reviewCountertopPanelClashes({ placed: working, room }));
  // HARD RULE (owner, Nov 5 2026): the bridge above the range is mandatory and is
  // already seated before the upper run tiled. What follows is the existing
  // add-only logic for the MICROWAVE and HOOD on top of that bridge: the popup
  // answer decides those, and a fallback chain decides them when there is no
  // answer. Nothing here can remove the bridge, and nothing is ever deleted or
  // moved. A bridge that could not seat was reported above, with its reason.
  const overRunCompanions = fillOverRangeAnswer({
    placed: working,
    room,
    answer: stage.input.overRangeAnswer,
    appliancePalette: args.appliancePalette,
    wallCatalog: args.wallCatalog,
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId,
    makeUid,
  });
  if (overRunCompanions.added) {
    working = overRunCompanions.placed;
    notes.push(...overRunCompanions.notes);
  }
  reviewFindings.push(...overRunCompanions.findings);
  // A 42" design: every upper that is not above an appliance is the line's 42"
  // box. The microwave bridge, the refrigerator cap, and the range/hood bridge stay.
  const fortyTwo = enforceFortyTwoWallCabinets({
    placed: working,
    catalog: args.wallCatalog,
    nominalIn: wallHeightNominal,
    room,
  });
  working = fortyTwo.placed;
  notes.push(...fortyTwo.notes);
  // Rule 6: every kitchen has at least one single-door base.
  const singleDoor = ensureSingleDoorBase({
    placed: working,
    room,
    catalog: stage.straightBaseCatalog,
    makeUid,
    styleId: args.styleId,
  });
  working = singleDoor.placed;
  if (singleDoor.added) notes.push(`${singleDoor.added.masterCode} gives this kitchen its single-door base.`);
  if (singleDoor.warning) {
    reviewFindings.push({
      ruleId: "single-door-base-required",
      code: "no-single-door-base",
      severity: "warning",
      title: "No single-door base",
      detail: singleDoor.warning,
    });
  }
  // Rule 7: adjacent single doors meet their handles at the shared seam unless the user chose a side.
  const explicitHingeUids = working.filter((item) => item.swing === "left" || item.swing === "right").map((item) => item.uid);
  working = pairAdjacentSingleDoorHandles({ placed: working, room, explicitHingeUids }).placed;
  // Rule 11: the 54 / 84-90-96 upper datum, and rule 4's one continuous board per filler.
  working = normalizeUpperHeights(working, { room, openings: stageOpenings });
  // Issue #354 item 7 (Tom): on the U.S. Cabinet Depot frameless line every wall
  // cabinet top meets the top of a 40-1/4" wall cabinet, including the box over a
  // microwave. The pass only raises a bottom, so the 72" microwave bridge datum,
  // the over-range cooking floor and the over-sink window clearance are all left
  // satisfied, and other lines are untouched because none of their cabinets
  // carry the frameless geometry marker.
  const framelessTops = alignFramelessWallCabinetTops({ placed: working, room });
  working = framelessTops.placed;
  for (const entry of framelessTops.aligned) {
    notes.push(`${entry.masterCode} was raised to meet the frameless ${framelessWallTopDatumIn()}″ wall-cabinet top line.`);
  }
  for (const warning of framelessTops.warnings) {
    reviewFindings.push({
      ruleId: "frameless-wall-top-line",
      code: "frameless-upper-off-the-top-line",
      severity: "warning",
      title: "A wall cabinet could not join the frameless top line",
      detail: warning,
    });
  }
  working = normalizeContinuousVerticalFillers(working, room).placed;
  // Owner rule: the uppers line up with the bases beneath them. A shared pass
  // later in the pipeline can still mirror a run-end base filler up into the wall
  // layer, so the last word is here: flat stock that hangs past the end of the
  // base run is removed. Filler inside the run (and beside a window or corner) stays.
  const endTrim = trimWallFillersOutsideRun({ placed: working, room });
  working = endTrim.placed;
  // 15-rule pass (Tom, Nov 13): 15" fridge minimums, 3" wiggle, every opening
  // re-tiled with stock cabinets bigger-first, fillers last, end panels on
  // exposed sides. Runs only for builds that answered the upfront intake.
  const fifteenRepackMoves: { uid: string; kind: string; wallId: string; deltaAlongIn: number }[] = [];
  if (input.intake) {
    const repack = repackFifteenRuleLayout({
      placed: working,
      room,
      openings: stageOpenings,
      reservedSpans: cornerReserved,
      reservedUpperSpans: cornerReservedUpper,
      keepUids: companionKeepUids,
      intake: input.intake,
      baseCatalog: args.baseCatalog,
      wallCatalog: args.wallCatalog,
      fillerCatalog: args.fillers,
      panelCatalog: [...(args.panelCatalog ?? []), ...args.fillers, ...args.refrigeratorEndPanels],
      styleId: args.styleId,
      makeUid,
    });
    working = repack.placed;
    // Earlier passes' notes about openings, fillers and short neighbors described the run before it
    // was re-planned; the repack names whatever is still open or filled.
    const staleNote = /opening on the .* wall is wider than|No source-priced filler is sold for the|The run beside the range is only|still have .* between them after the 3" shift|became W\d+ to close a|slid .* to open a real cabinet on|filled a .* opening on|filled the opening on/;
    for (let i = notes.length - 1; i >= 0; i--) {
      if (staleNote.test(notes[i]!)) notes.splice(i, 1);
    }
    const keptCodes = new Set(working.map((item) => item.masterCode));
    for (let i = notes.length - 1; i >= 0; i--) {
      const raised = /^(\S+) was raised to meet the frameless/.exec(notes[i]!);
      if (raised && !keptCodes.has(raised[1]!)) notes.splice(i, 1);
    }
    // A blind corner whose pull the repack changed (Tom's ~1.8" corner filler) gets a new pull note.
    const pullNotes = repack.notes.filter((note) => / blind pull .* so the corner filler is /.test(note)).length;
    const seatPullNotes = notes.filter((note) => /blind corner pulled /.test(note)).length;
    if (pullNotes > 0 && pullNotes >= seatPullNotes) {
      for (let i = notes.length - 1; i >= 0; i--) {
        if (/blind corner pulled /.test(notes[i]!)) notes.splice(i, 1);
      }
    }
    notes.push(...repack.notes);
    fifteenRepackMoves.push(...repack.moves);
    // The repack tiles the base and wall levels as separate runs; put a
    // matching-width upper back over each straight base (B27 -> W27).
    const matchedAfterRepack = matchUppersToBases({
      placed: working, room, openings: stageOpenings, wallCatalog: args.wallCatalog,
      heightIn: upperResult.heightUsedIn, styleId: args.styleId, makeUid,
      glass: hasPreference(input.intake, "glass-uppers"),
    });
    working = matchedAfterRepack.placed;
    notes.push(...matchedAfterRepack.notes);
    // The openings and dead corners named before this pass were re-planned; keep only what is still true.
    const stale = new Set(["leftover-real-cabinets-first", "real-cabinets-before-filler"]);
    for (let i = reviewFindings.length - 1; i >= 0; i--) {
      if (stale.has(reviewFindings[i]!.ruleId)) reviewFindings.splice(i, 1);
    }
    // A sink the repack gave a counter landing is no longer jammed against the tall unit. With the
    // intake, 15" is the hard minimum and 18" only preferred (rule 13 already notes under-18 as info).
    const stillShort = new Set(sinkLandingGaps(working, room, Math.min(15, sinkTallLandingIn())).map((gap) => gap.sinkUid));
    for (let i = reviewFindings.length - 1; i >= 0; i--) {
      const finding = reviewFindings[i]!;
      if (finding.ruleId === "sink-landing-before-tall" && finding.cabinetUid && !stillShort.has(finding.cabinetUid)) {
        reviewFindings.splice(i, 1);
      }
    }
    reviewFindings.push(...repack.findings);
  }
  // Rule 10: 3/4" stock on every visible side. A side the selected line cannot finish is named.
  const panelRequirements = exposedPanelRequirements({ placed: working, room, buildWallIds: runWalls, wallEndsCovered: Boolean(input.intake) });
  reviewFindings.push(...exposedPanelFindings(panelRequirements, new Set()));
  // Rule 8: the design-question door spec applies to every cabinet.
  const doorSpec: DesignQuestionDoorSpec | null = stage.input.designQuestionDoorStyleId == null
    ? null
    : {
      styleId: stage.input.designQuestionDoorStyleId,
      styleName: stage.input.designQuestionDoorStyleName ?? null,
      twoTone: false,
    };
  // A door already selected in the designer is the finish. The question style
  // is only applied when the build was not given that selection.
  if (doorSpec && args.styleId == null) {
    working = applyDesignQuestionDoorSpec({
      cabinets: working,
      formerDefaultStyleId: args.styleId,
      spec: doorSpec,
    }).cabinets;
    reviewFindings.push(...verifyDesignQuestionDoorSpec({ cabinets: working, spec: doorSpec }));
  }
  // Rule: nothing may leave its wall run or the drawn room shell.
  const escaped = working.filter((item) => !cabinetInsideBounds(item, room));
  if (escaped.length) {
    reviewFindings.push({
      ruleId: "nothing-past-wall-or-room",
      code: "piece-outside-bounds",
      severity: "warning",
      title: `${escaped.length} piece${escaped.length === 1 ? "" : "s"} left the room bounds`,
      detail: `These pieces extend past their wall end or outside the drawn room: ${escaped.map((item) => item.masterCode).join(", ")}.`,
    });
    // Dropping a corner that escaped is never acceptable on its own: the inside
    // corner would just go bare. If a corner is among them, say so as its own
    // finding so the empty corner is visible and named, not silent.
    for (const corner of escaped.filter(isPlacedCornerCabinet)) {
      const slot = seatedCorners.find((entry) => entry.masterCode === corner.masterCode);
      reviewFindings.push({
        ruleId: "corner-first-least-waste",
        code: "corner-cabinet-dropped",
        severity: "warning",
        title: `${slot?.label ?? "The inside corner"} lost its ${corner.masterCode}`,
        detail: `${corner.masterCode} extended past its wall run or outside the drawn room, so it was removed and the inside corner is empty. Adjust the wall length or the measured appliance positions, then run Auto-Design again.`,
        cabinetUid: corner.uid,
        cabinetCode: corner.masterCode,
      });
    }
    working = working.filter((item) => cabinetInsideBounds(item, room));
  }
  let peninsulaSummary: AutoDesignPeninsulaSummary | null = null;
  let peninsulaRuns: import("./design").PeninsulaRun[] = [];
  let furniture: PlacedFurniture[] = [];
  if (peninsulaRequest) {
    const built = buildAutoDesignPeninsula({
      request: peninsulaRequest,
      room,
      placed: working,
      sinks,
      catalog: [...args.baseCatalog, ...args.wallCatalog],
      endPanels: args.refrigeratorEndPanels,
      styleId: args.styleId,
      makeUid,
    });
    working = built.placed;
    sinks = built.sinks;
    notes.push(...built.notes);
    const raisedForPeninsula = raiseWindowsForDeckFaucet({ sinks, room, openings: workingOpenings, wallLabels });
    workingOpenings = raisedForPeninsula.openings;
    if (sinkWindow) sinkWindow = workingOpenings.find((opening) => opening.uid === sinkWindow!.uid) ?? sinkWindow;
    if (raisedForPeninsula.notes.length) {
      const replaced = new Set(raisedForPeninsula.notes.map((note) => note.openingUid));
      faucetWindowNotes = [
        ...faucetWindowNotes.filter((note) => !replaced.has(note.openingUid)),
        ...raisedForPeninsula.notes,
      ];
      notes.push(...raisedForPeninsula.notes.map((note) => note.text));
    }
    peninsulaSummary = built.summary;
    peninsulaRuns = built.runs;
    furniture = built.furniture;
  }
  const reportedWiggleMoves = activeAutoDesignWiggleMoves(wiggle.moves, working, room);
  const shiftReview = reviewAfterShift({ placed: working, room, openings: stageOpenings, usage: stage.input.kitchenUsage });
  // HARD RULE (owner, Nov 5 2026): a faucet at the sink on every build, mandatory
  // like the over-range bridge. One deck-mounted faucet per sink fixture, centered
  // on the sink base, on the countertop, drawn in 3D. Add-only: an existing faucet
  // is never replaced; with no catalog faucet row the built-in default fixture is
  // used and reported.
  const mandatoryFaucet = ensureMandatorySinkFaucets(sinks, args.faucetCatalog ?? [], { budgetFriendly });
  if (mandatoryFaucet.attachedUids.length > 0) {
    sinks = mandatoryFaucet.sinks;
    notes.push(...mandatoryFaucet.notes);
    // A taller faucet can need a window shortened (never moved). Same one rule as
    // every other faucet, so the rule stays in `raiseWindowsForDeckFaucet`.
    const raisedForFaucet = raiseWindowsForDeckFaucet({ sinks, room, openings: workingOpenings, wallLabels });
    workingOpenings = raisedForFaucet.openings;
    if (sinkWindow) sinkWindow = workingOpenings.find((opening) => opening.uid === sinkWindow!.uid) ?? sinkWindow;
    if (raisedForFaucet.notes.length) {
      const replaced = new Set(raisedForFaucet.notes.map((note) => note.openingUid));
      faucetWindowNotes = [
        ...faucetWindowNotes.filter((note) => !replaced.has(note.openingUid)),
        ...raisedForFaucet.notes,
      ];
      notes.push(...raisedForFaucet.notes.map((note) => note.text));
    }
  }
  // Owner rule: the basin is centered on the sink base that actually holds it and
  // set back 2"–2½" from the finished countertop front. The base can slide after
  // the fixture is first built (the sink-landing rule moves it), so the fixtures
  // are re-seated onto the FINAL bases here, before the faucet is attached.
  const reseatedSinks = reSeatSinkFixtures(sinks, working, room, sinkFrontSetbackIn());
  if (reseatedSinks.changed) {
    sinks = reseatedSinks.sinks;
    notes.push(...reseatedSinks.notes);
  }
  // A basin the geometry cannot seat the owner's way (a Pelican sink deeper than
  // the finished top allows at a 2" setback, say) is named on the review list
  // rather than left as an unexplained offset.
  for (const sink of sinks) {
    const base = working.find((item) => item.uid === sink.cabinetUid);
    if (!base) continue;
    const seat = sinkSeatCheck(sink, base, room);
    if (seat.ok) continue;
    reviewFindings.push({
      ruleId: "sink-seat-on-base",
      code: "sink-not-centered-or-setback",
      severity: "warning",
      title: `${sink.pelicanProductName ?? sink.type} does not sit the way the sink rule asks`,
      detail: seat.reason ?? `${sink.uid} is not seated centered on ${base.masterCode} at a ${NON_APRON_SINK_FRONT_SETBACK.minimumIn}″–${NON_APRON_SINK_FRONT_SETBACK.maximumIn}″ front setback.`,
      cabinetUid: base.uid,
      cabinetCode: base.masterCode,
    });
  }
  // Owner rule: a blind corner base ALWAYS comes with its 3" filler. The stock
  // closing, consolidation and normalisation passes above can reshape the runs
  // after the earlier seal, so re-seat the mandatory filler last - the build must
  // never return a BBC without it, and any refusal is reported with its reason.
  const finalBlindSeal = ensureRequiredBlindCornerBaseFillers({
    placed: working,
    room,
    catalogFillers,
    makeUid,
    styleId: args.styleId,
    allowPlaceholder: Boolean(input.intake),
  });
  working = finalBlindSeal.placed;
  // Re-assert the bridge boards after every later pass (Tom, Nov 20 2026): the
  // refrigerator 'wall side needs no panel and no filler' cleanup was stripping one of
  // the two 1/2 in boards, so a 36 in bridge lost its 37 in opening and the refrigerator
  // lost the clearance the boards exist to give it. Seal last, like the blind filler.
  if (refrigerator && !budgetFriendly) {
    const bridgeReseal = ensureBridgeHalfInchFillers(working, room, args.fillers ?? [], makeUid, args.styleId ?? null);
    working = bridgeReseal.placed;
    // Restoring the boards is not the same as proving the opening is right: measure it.
    const fridgeBridge = working.find((item) => item.refrigeratorAssemblyRole === "bridge");
    if (fridgeBridge) {
      const bridgeBoards = working.filter((item) => isBridgeHalfInchFiller(item) && item.fillerForCabinetUid === fridgeBridge.uid);
      const opening = bridgeBoards.reduce((sum, board) => sum + (Number(board.width) || 0), Number(fridgeBridge.width) || 0);
      if (Math.abs(opening - FRIDGE_OPENING_TARGET_IN) > 0.05) {
        reviewFindings.push({
          ruleId: "refrigerator-opening",
          code: "refrigerator-opening-not-37",
          severity: "warning",
          title: "Refrigerator opening is not 37 in",
          detail: `${fridgeBridge.masterCode} plus ${bridgeBoards.length} bridge board${bridgeBoards.length === 1 ? "" : "s"} opens ${inches(opening)}; the target is ${FRIDGE_OPENING_TARGET_IN} in (36 in bridge + 1/2 in each side).`,
          cabinetUid: fridgeBridge.uid,
          cabinetCode: fridgeBridge.masterCode,
        });
      }
    }
    if (bridgeReseal.added.length > 0) {
      notes.push(`Bridge fillers re-sealed after later passes: 1/2 in ${bridgeReseal.added[0]!.masterCode} on each side of the cabinet above the refrigerator, so the opening is 37 in.`);
    }
  }
  notes.push(...finalBlindSeal.notes.filter((note) => !notes.includes(note)));
  // 15-rule retile can drop the over-sink bridge; seat it again before leftover
  // gaps and tighten so a full-height upper is never left over the sink.
  const restoredSinkBridges = placeSinkBridges({
    placed: working,
    room,
    openings: stageOpenings,
    wallCatalog: args.wallCatalog,
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId,
    makeUid,
  });
  working = restoredSinkBridges.placed;
  notes.push(...restoredSinkBridges.notes.filter((note) => !notes.includes(note)));
  reviewFindings.push(...restoredSinkBridges.findings);

  // After leftover fill, 15-rule retile, corner seating and sink/bridge placement,
  // close every remaining actionable gap (cabinets first, then one priced filler
  // per leftover) and tighten openings so adjacent cabinets butt flush and
  // appliance openings equal the appliance's nominal width (Tom, Nov 14 2026,
  // 2:03 and 2:06 PM CT). Never fill a window or its 3 in clearance.
  const extraWalls = working.map((item) => cabinetWall(item, room)).filter((id) => typeof id === "string" && id.length > 0) as string[];
  const gapWallIds = Array.from(new Set<string>([...runWalls, ...extraWalls]));
  const closedGaps = closeRemainingRunGaps({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: gapWallIds,
    baseCatalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...args.baseCatalog],
    wallCatalog: args.wallCatalog,
    fillers: catalogFillers,
    styleId: args.styleId,
    makeUid,
    wallHeightIn: wallDesignHeight ?? stage.input.wallCabinetHeightIn ?? 30,
    reservedSpans: cornerReserved,
  });
  working = closedGaps.placed;
  notes.push(...closedGaps.notes);
  reviewFindings.push(...closedGaps.findings);
  const tightened = tightenRunOpenings({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: gapWallIds,
    fillers: catalogFillers,
    styleId: args.styleId,
    makeUid,
    wallHeightIn: wallDesignHeight ?? stage.input.wallCabinetHeightIn ?? 30,
  });
  working = tightened.placed;
  notes.push(...tightened.notes);
  reviewFindings.push(...tightened.findings);
  const closedAfterTighten = closeRemainingRunGaps({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: gapWallIds,
    baseCatalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...args.baseCatalog],
    wallCatalog: args.wallCatalog,
    fillers: catalogFillers,
    styleId: args.styleId,
    makeUid,
    wallHeightIn: wallDesignHeight ?? stage.input.wallCabinetHeightIn ?? 30,
    reservedSpans: cornerReserved,
  });
  working = closedAfterTighten.placed;
  notes.push(...closedAfterTighten.notes.filter((note) => !notes.includes(note)));
  reviewFindings.push(...closedAfterTighten.findings);
  const postTightenBlindSeal = ensureRequiredBlindCornerBaseFillers({
    placed: working,
    room,
    catalogFillers,
    makeUid,
    styleId: args.styleId,
    allowPlaceholder: Boolean(input.intake),
  });
  working = postTightenBlindSeal.placed;
  notes.push(...postTightenBlindSeal.notes.filter((note) => !notes.includes(note)));
  for (const item of working) {
    if (isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId) && !companionKeepUids.includes(item.uid)) {
      companionKeepUids.push(item.uid);
    }
  }

  // Last word on upper widths: the gap and tighten passes above can re-tile a
  // span; uppers still line up with the base under them where the line allows.
  const matchedFinal = matchUppersToBases({
    placed: working, room, openings: workingOpenings, wallCatalog: args.wallCatalog,
    heightIn: upperResult.heightUsedIn, styleId: args.styleId, makeUid,
    glass: hasPreference(input.intake, "glass-uppers"), // rule 1b
  });
  working = matchedFinal.placed;
  notes.push(...matchedFinal.notes);
  reviewFindings.push(...matchedFinal.findings);
  // Lazy Susan corner uppers (Tom, Nov 18 2026; see autoDesignLazySusanCornerUppers).
  // Runs after the last upper re-tile so nothing later replaces or merges these pieces.
  const lazySusanUppers = applyLazySusanCornerUppers({
    placed: working, room, openings: workingOpenings, wallCatalog: args.wallCatalog,
    heightIn: upperResult.heightUsedIn, glass: hasPreference(input.intake, "glass-uppers"),
    styleId: args.styleId, makeUid,
  });
  working = lazySusanUppers.placed;
  notes.push(...lazySusanUppers.notes);
  reviewFindings.push(...lazySusanUppers.findings);
  if (matchedFinal.notes.length > 0 || lazySusanUppers.changed) {
    // Re-matching can leave a seam sliver (at most a seam filler wide) where an
    // old upper reached past the bases; close it with the line's own filler
    // like every other leftover, so the run still closes and never overflows.
    const closedAfterMatch = closeRemainingRunGaps({
      placed: working,
      room,
      openings: stageOpenings,
      wallIds: gapWallIds,
      baseCatalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...args.baseCatalog],
      wallCatalog: args.wallCatalog,
      fillers: catalogFillers,
      styleId: args.styleId,
      makeUid,
      wallHeightIn: wallDesignHeight ?? stage.input.wallCabinetHeightIn ?? 30,
      reservedSpans: cornerReserved,
    });
    working = closedAfterMatch.placed;
    notes.push(...closedAfterMatch.notes.filter((note) => !notes.includes(note)));
    reviewFindings.push(...closedAfterMatch.findings);
  }
  // 135° base corners (Tom, Nov 20 2026, 4:33 PM CT): do not measure a 23¼″
  // cut past a dishwasher. Seat each leg at the 45° setback when a stock move
  // can get there, and grow a range-left B12 to B15/B18 when that fits flush
  // without a leftover filler. Then the shared miter repair cuts the pair.
  const angledBases = closeAutoDesignAngledBaseCorners({
    placed: working, room, baseCatalog: args.baseCatalog,
    rangeWiggleIn: (range) => {
      if (!input.intake || lockedAnchorKinds(input.intake).includes("stove")) return 0;
      const used = fifteenRepackMoves.filter((move) => move.uid === range.uid).reduce((sum, move) => sum + move.deltaAlongIn, 0);
      return Math.max(0, 3 - Math.abs(used));
    },
  });
  working = angledBases.placed;
  notes.push(...angledBases.notes);
  // 45° corners (Tom, Nov 16 2026): every angled corner closes with the
  // front-miter filler pair on BOTH layers. The upper run follows the bases, so
  // its 45° miter needs about 6⅜″ per side; when the line sells no wall filler
  // that wide, the corner-end upper grows to the next stock width (never past
  // its own 45° hold) so the pair is cut from real stock. This runs after the
  // last upper re-match so that match cannot reopen the corner. Whatever still
  // cannot close is named on the report instead of being left silently open.
  const angledUppers = closeAutoDesignAngledUpperCorners({
    placed: working, room, wallCatalog: args.wallCatalog, fillers: catalogFillers,
  });
  working = angledUppers.placed;
  notes.push(...angledUppers.notes);
  working = repairMissingAngledWallFillers(working, room, catalogFillers, makeUid, args.styleId).placed;
  reviewFindings.push(...autoDesignOpenAngledCornerFindings(working, room, catalogFillers));
  // Corner flank rule (Tom, Nov 17 2026, 11:14 AM CT): every blind corner
  // (WBC upper or BBC base) gets a real cabinet right beside it on both its
  // blind side and its open side. The corner-square reservation kept the gap
  // passes above out of that spot, so it is claimed here, once, after the last
  // re-tile; when nothing fits, the corner is named on the review list.
  const flankWallNames = autoDesignWallNameByEngineId(room, input.originCorner, input.runDirection) as Record<string, WallLabel | undefined>;
  const cornerFlank = ensureBlindCornerFlankCabinets({
    placed: working,
    room,
    openings: stageOpenings,
    wallCatalog: args.wallCatalog,
    baseCatalog: [...stage.straightBaseCatalog, ...args.baseCatalog],
    wallHeightIn: upperResult.heightUsedIn,
    styleId: args.styleId,
    makeUid,
    wallLabelOf: (wallId) => flankWallNames[wallId] ?? null,
  });
  working = cornerFlank.placed;
  notes.push(...cornerFlank.notes.filter((note) => !notes.includes(note)));
  reviewFindings.push(...cornerFlank.findings);
  // Minimum filler (Tom, voice, Nov 19 2026, 7:19 AM CT): every inch of filler is a missed
  // cabinet. After every re-tile above, spare inches upgrade a stock width or slide the range
  // inside its wiggle; what is left is one strip against the wall end or the refrigerator,
  // never between cabinets or beside a bridge, on the base and wall rows alike. Runs before
  // the outside-panel rule below so that rule keeps the last word.
  // Refrigerator (Tom, voice, Nov 19 2026, 7:41 AM CT): only the open side keeps an end panel; the
  // wall side gets no panel and no filler. Runs before the minimum-filler pass so the freed inches
  // are put to use there.
  const fridgeWallSide = trimRefrigeratorWallSide({
    placed: working,
    room,
    // Standard mode: only tuck the fridge against a free wall end, same
    // meaning as the budget slide (no run continues past the join).
    isFreeWallEnd: (joinedWallId) => joinedWallId == null || !selectedWalls.includes(joinedWallId as WallSide),
  });
  if (fridgeWallSide.removedUids.length > 0 || fridgeWallSide.notes.length > 0) {
    working = fridgeWallSide.placed;
    for (let i = notes.length - 1; i >= 0; i--) {
      if (/REPV\S* is held on the wall|panel gap\.|was butted to FRIDGE/.test(notes[i]!)) notes.splice(i, 1);
    }
    notes.push(...fridgeWallSide.notes);
  }
  if (input.intake) {
    const intakeForWiggle = input.intake;
    const minimumFiller = applyMinimumFiller({
      placed: working, room, openings: stageOpenings, wallIds: runWalls,
      baseCatalog: args.baseCatalog, wallCatalog: args.wallCatalog, fillerCatalog: catalogFillers,
      styleId: args.styleId, makeUid,
      rangeWiggleIn: (range) => {
        if (lockedAnchorKinds(intakeForWiggle).includes("stove")) return 0;
        const used = fifteenRepackMoves.filter((move) => move.uid === range.uid).reduce((sum, move) => sum + move.deltaAlongIn, 0);
        return Math.max(0, 3 - Math.abs(used));
      },
      glassUppers: hasPreference(input.intake, "glass-uppers"),
      wallLabelOf: (wallId) => flankWallNames[wallId] ?? null,
      keepClearSpans: economyClaims,
    });
    working = minimumFiller.placed;
    if (minimumFiller.changes.length > 0) {
      // Earlier lines that named a board or opening this pass just re-planned are no longer true.
      const replanned = /filled a .* leftover on|filled the opening on|left beside the corner for the filler|for the filler\.$/;
      for (let i = notes.length - 1; i >= 0; i--) {
        if (replanned.test(notes[i]!)) notes.splice(i, 1);
      }
    }
    notes.push(...minimumFiller.notes);
    fifteenRepackMoves.push(...minimumFiller.moves);
  }
  // Tom, voice, Nov 18 2026, 4:53 PM CT: no filler outside an exposed panel. Every
  // filler pass above has run, so this is the last word: a board on a panel's outside
  // face is dropped and named on the review list; fillers between cabinets and
  // against walls are untouched.
  const outsidePanelFillers = removeFillersOutsideExposedPanels({
    placed: working, room, openings: stageOpenings, wallLabelOf: (wallId) => flankWallNames[wallId] ?? null,
  });
  working = outsidePanelFillers.placed;
  notes.push(...outsidePanelFillers.notes.filter((note) => !notes.includes(note)));
  reviewFindings.push(...outsidePanelFillers.findings);
  // Tom, voice, Nov 19 2026, 12:57-12:58 PM CT: no other filler in the bridge area except one 3" filler against a
  // wall gap. Standard (non-budget) flows only; budget mode keeps its bridge as it is.
  if (refrigerator && !budgetFriendly) {
    const bridgeArea = applyBridgeAreaFillerRule(working, room, args.fillers ?? [], makeUid, args.styleId ?? null);
    working = bridgeArea.placed;
    if (bridgeArea.removed.length > 0) {
      notes.push(`Bridge area: ${bridgeArea.removed.map((item) => item.masterCode).join(", ")} dropped. Only the two 1/2″ bridge boards, and one filler against a wall gap, are allowed beside the bridge.`);
    }
    if (bridgeArea.duplicatesDropped.length > 0) {
      notes.push(`Bridge area: the refrigerator's own full-height 1/2″ board already stands at the bridge junction on ${bridgeArea.duplicatesDropped.length === 1 ? "one side" : "both sides"}, so no second 1/2″ board was added there.`);
    }
    for (const gap of bridgeArea.closedGaps) {
      notes.push(`Bridge area: a ${gap.masterCode} filler cut to ${Math.round(gap.gapIn * 8) / 8}″ closes the gap between the bridge and the wall (${gap.side} side).`);
    }
    for (const gap of bridgeArea.oversizeGaps) {
      refrigeratorBayWarnings.push(`Bridge area: the ${gap.side} side of ${gap.masterCode} leaves a ${Math.round(gap.gapIn * 8) / 8}″ gap against the wall, over the 3″ filler. No second filler was added; this needs Tom's answer.`);
    }
  }
  // Economy corner (Tom, voice, Nov 19 2026, 8:44 + 9:01 AM CT): claim the 3" filler first, then size the base.
  const economyWarnings: string[] = [];
  if (economyCorners.length > 0) {
    const economyFinal = enforceEconomyCornerFillers({
      corners: economyCorners, placed: working, room,
      baseCatalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...args.baseCatalog] as never,
      wallCatalog: args.wallCatalog as never,
      catalogFillers, makeUid, styleId: args.styleId, openings: stageOpenings,
    });
    working = economyFinal.placed;
    notes.push(...economyFinal.notes);
    economyWarnings.push(...economyFinal.warnings);
  }
  // Tom, voice, Nov 19 2026, 8:42 / 8:44 AM CT: a dishwasher at a run end keeps a base filler only
  // where a wall follows; an opening or an unknown end takes the line's dishwasher panel instead.
  const dishwasherRunEnd = applyDishwasherRunEndRule({
    placed: working, room, openings: stageOpenings,
    panelCatalog: [...(args.panelCatalog ?? []), ...(args.fillers as unknown as DesignCabinet[])],
    budgetFriendly: hasPreference(input.intake, "budget-friendly"),
  });
  working = dishwasherRunEnd.placed;
  notes.push(...dishwasherRunEnd.notes);
  // The door passed into the build is the one the designer has selected. It wins
  // over a design-question id so the island and the wall runs cannot keep a
  // second finish. With no selected door, the question style is the one finish.
  // Rule 12: "Glass cabinets above" keeps the uppers solid and puts the line's
  // own 12/15/18 in glass stacker on top of each one (tallest that fits under
  // the ceiling), never an invented SKU (Tom, Nov 17 2026).
  const glassUppers = applyGlassUpperPreference({
    placed: working,
    wallCatalog: args.wallCatalog,
    intake: input.intake,
    room,
    wallHeightIn: upperResult.heightUsedIn,
  });
  working = glassUppers.placed;
  reviewFindings.push(...glassUppers.findings);
  // An upper needs a real wall behind it: nothing hangs over a peninsula or island, or past the wall or room.
  const noWallUppers = dropWallCabinetsWithoutWall(working, room);
  if (noWallUppers.dropped.length) {
    working = noWallUppers.placed;
    reviewFindings.push(noWallCabinetFinding(noWallUppers.dropped));
  }
  const singleFinishId = args.styleId ?? stage.input.designQuestionDoorStyleId ?? null;
  working = stampAutoDesignSingleFinish(working, singleFinishId);
  // Last word on the bridge's 1/2 in boards: flush with the bridge face, and one taller board per side when the glass
  // pass above put a glass cabinet on the bridge (the glass pass runs after the boards were first seated).
  working = normalizeBridgeBoards(working, room);
  // The 45° upper close and repairMissingAngledWallFillers above ran before glass,
  // so those fillers inherit the 30 in upper band (mount 54). Glass stackers sit
  // at a different elevation (mount 84, height 12). A second repair, after glass
  // and after the 1/2 in boards, seats a matching 22.5° front-miter pair between
  // adjacent glass cabinets only. Do not re-run closeAutoDesignAngledUpperCorners
  // here: that pass widens corner-end SKUs, which must not happen to stackers.
  // (Tom, owner voice, Nov 20 2026, 12:38 / 1:31 PM CT).
  working = repairMissingAngledWallFillers(working, room, catalogFillers, makeUid, args.styleId).placed;
  const warnings = [...economyWarnings, ...refrigeratorBayWarnings, ...drawerRuleWarnings, ...cornerFlank.warnings, ...shiftReview.findings.filter((entry) => entry.severity === "attention").map((entry) => `${entry.title}: ${entry.description}`)];
  const bareRange = working.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && autoDesignRangeNeedsVentilation(working, item));
  const wallNames = autoDesignWallNameByEngineId(room, input.originCorner, input.runDirection) as Record<string, WallLabel | undefined>;
  // The 15-rule findings (spacing, suggested downsizes, oven pairing, intake picks) are
  // suggestions only and run when the build was given the upfront intake.
  // Countertop corner report (Tom, Nov 19 2026, 1:06 PM CT): the top covers every inside corner; where two runs meet they
  // are cut on a 45° miter seam. Any square corner top still added (one run only) is named as before in budget mode.
  {
    const tops = countertopSurfaces(working, room, null);
    const cornerFills = tops.filter((surface) => surface.cabinetRunId?.startsWith("corner-fill"));
    const miterKeys = Array.from(new Set(tops.flatMap((surface) => (surface.insideCornerMiterKey ?? "").split("+").filter(Boolean))));
    if (miterKeys.length > 0) {
      notes.push(`Countertop: the two runs meet at a 45° miter seam at ${miterKeys.length === 1 ? "the inside corner" : `${miterKeys.length} inside corners`}, so the top covers the corner with no overlap and no gap.${hasPreference(input.intake, "budget-friendly") ? " Budget friendly: it runs over the open 24″ corner void and the 3″ mitered filler on both legs." : ""}`);
    }
    if (cornerFills.length > 0 && hasPreference(input.intake, "budget-friendly")) {
      notes.push(`Budget friendly: the countertop runs all the way back to the wall at ${cornerFills.length === 1 ? "the inside corner" : `${cornerFills.length} inside corners`} (${cornerFills.map((surface) => `${Math.round(surface.width * 100) / 100}″ × ${Math.round(surface.depth * 100) / 100}″`).join(", ")} corner top added).`);
    }
  }
  if (input.intake) reviewFindings.push(...fifteenRuleFindings({ placed: working, room, baseCatalog: args.baseCatalog, intake: input.intake, wallLabelOf: (wallId) => wallNames[wallId] ?? null, peninsulaBuilt: peninsulaSummary != null }));
  return {
    ok: true,
    // The plan the build returns is the whole plan, including any fixed anchor
    // it was handed; only the other pre-existing obstacles are reported apart.
    placed: working.filter((item) => !preExisting.some((kept) => kept.uid === item.uid) || item.uid === anchoredRefrigerator?.uid),
    sinks,
    sinkWindow,
    openings: workingOpenings,
    faucetWindowNotes,
    notes,
    warnings,
    wiggleMoves: reportedWiggleMoves,
    fifteenRepackMoves,
    applianceMoves,
    skippedUppers: upperResult.skipped,
    cornerSlots: stage.slots,
    seatedCorners,
    bareRangeUid: bareRange?.uid ?? null,
    heightUsedIn: upperResult.heightUsedIn,
    requestedUpperIn: stage.input.wallCabinetHeightIn ?? 30,
    cornerCount: seatedCorners.length,
    basePieceCount,
    fillerCount: seamResult.additions.length,
    upperCount: upperResult.additions.length,
    peninsula: peninsulaSummary,
    peninsulaRuns,
    furniture,
    everySinkHasFaucet: mandatoryFaucet.sinks.every((sink) => sink.faucet),
    usedDefaultFaucet: mandatoryFaucet.usedDefault,
    reviewFindings: buildDesignerReviewList(reviewFindings).findings,
    reviewAllHonored: buildDesignerReviewList(reviewFindings).allHonored,
  };
}
