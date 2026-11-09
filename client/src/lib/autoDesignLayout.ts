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
} from "./autoDesignAutoBuild";
import { seatAutoDesignCornerFromCatalog } from "./autoDesignCornerPlacement";
import { isPlacedCornerCabinet, sameWidthFamily } from "./autoDesignCornerGuard";
import {
  AUTO_DESIGN_GALLEY_WALLS,
  autoBuildCornerCatalog,
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
import { activeAutoDesignWiggleMoves, applyAutoDesignWiggleRoom, applyDesignerLayoutRules, autoDesignShiftLimitIn, type AutoDesignAnchorOrigin, type AutoDesignWiggleMove } from "./designerLayoutRules";
import { applyRealCabinetsBeforeFiller, isFillerLastResort } from "./autoDesignRealCabinets";
import { bakesALot, cooksALot, normalizeKitchenUsage } from "./kitchenUsage";
import { ensureDrawerBase } from "./autoDesignDrawerRule";
import { reviewAfterShift, separateRangeAndRefrigerator } from "./kitchenAdjacency";
import { autoDesignFillerMaxIn, fillAutoDesignLowerSeams, planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import {
  closeSmallOpeningsWithStock,
  consolidateAutoDesignFillers,
  findFillerClusters,
  formatFillerInches,
} from "./autoDesignFillerConsolidation";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import { autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";
import { AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN, buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { clampRefrigeratorAssemblyToPanels } from "./refrigeratorPanelClamp";
import { autoDesignSinkWindow, windowOverlapsReservation } from "./autoDesignSinkWindow";
import { resolveAutoDesignSinkBase } from "./autoDesignSink";
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
import { buildAutoDesignWallCabinets, resolveWallHeightClass, type AutoDesignUpperCorner } from "./autoDesignWallCabinets";
import { fillOverRangeAnswer, placeMandatoryOverRangeBridges } from "./overRangeFill";
import { ensureMandatorySinkFaucets, type AutoDesignFaucetProduct } from "./autoDesignFaucet";
import { boundedWallPlacementAt, cabinetInsideBounds, uShapeRunWallLabels } from "./designerBounds";
import { ensureSingleDoorBase, pairAdjacentSingleDoorHandles, normalizeUpperHeights } from "./designerFaceRules";
import { buildDesignerReviewList, type DesignerReviewFinding } from "./designerReviewFindings";
import { applyDesignQuestionDoorSpec, verifyDesignQuestionDoorSpec, type DesignQuestionDoorSpec } from "./designQuestionDoorSpec";
import { exposedPanelFindings, exposedPanelRequirements } from "./exposedPanelRule";
import { cornerFirstWasPulled, describeCornerFirst, pickCornerFirst } from "./cornerFirst";
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
import { normalizeContinuousVerticalFillers } from "./verticalFiller";
import {
  autoDesignPeninsulaAttachment,
  buildAutoDesignPeninsula,
  type AutoDesignPeninsulaRequest,
  type AutoDesignPeninsulaSummary,
} from "./autoDesignPeninsula";import {
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
  isFarmSinkBasePaletteItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  NON_APRON_SINK_FRONT_SETBACK,
  standardHeight,
  cabinetWall,
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
): PlacedCabinet[] {
  let working = placed;
  for (const wallId of walls) {
    const gaps = freeSegmentsOnWall(wallId, room, working, [], 3.05, 0, "base", false);
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
}): { placed: PlacedCabinet[] } {
  let working = [...input.placed];
  const landingIn = sinkTallLandingIn();
  for (let guard = 0; guard < 4; guard += 1) {
    const gaps = sinkLandingGaps(working, input.room, landingIn);
    if (gaps.length === 0) break;
    const gap = gaps[0]!;
    const sink = working.find((item) => item.uid === gap.sinkUid);
    if (!sink) break;
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
}): { placed: PlacedCabinet[]; notes: string[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  for (const wallId of input.walls) {
    const reservations = refrigeratorLimitIn({ placed: working, room: input.room, wallId });
    const gaps = freeSegmentsOnWall(wallId, input.room, working, [], autoDesignFillerMaxIn() + 0.05, 0, "base", false, undefined, STD.BASE_DEPTH);
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

/** Auto-Design never installs a filler board wider than 3 inches. A wider catalog filler is cut to 3 instead of being flagged over its maximum. */
export function capAutoDesignFillerWidth(placed: PlacedCabinet[]): PlacedCabinet[] {  return placed.map((item) => {
    const text = `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`;
    const filler = Boolean(item.fillerPieceGroupId) || /filler|scribe|^OF\d|^FOL/i.test(text);
    const installed = item.fillerTotalWidth ?? item.width;
    if (!filler || installed <= autoDesignFillerMaxIn() + 0.05) return item;
    return { ...item, width: autoDesignFillerMaxIn(), fillerTotalWidth: autoDesignFillerMaxIn() };
  });
}

/**
 * The measured Auto-Design build: anchors, refrigerator surround, corners,
 * base runs, hood, then wall cabinets. Galley fills Wall 1 and Wall 3 and
 * never receives a corner slot.
 */
export function runAutoDesignLayout(args: {
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
}): AutoDesignLayoutResult {
  const { input, room, makeUid } = args;
  const openings = [...args.openings];
  const fail = (message: string): AutoDesignLayoutResult => ({ ok: false, message });
  const plan = planAutoDesignAutoBuild(input);
  if (!plan.ok) return fail(`Missing required measurement: ${plan.missing.join(", ")}.`);
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
  const sinkBaseWidth = resolvedSinkBase.widthIn;
  const sinkBaseKind = resolvedSinkBase.kind;
  const sinkBaseSource = pickAutoDesignSinkBase(pool, sinkBaseWidth, sinkBaseKind);
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
  const refrigeratorRequested = plan.plan.anchors.some((anchor) => anchor.kind === "refrigerator");
  if (refrigeratorRequested && (!args.refrigeratorCaps.length || !args.refrigeratorEndPanels.length)) {
    return fail("The selected line’s source-priced 36-inch refrigerator cabinet and two end panels are still loading or unavailable. The measured build was not changed.");
  }

  // A pushed sink (or any other pre-existing fixture) must not stop the build.
  // The measured build owns the sink base — it seats the source-priced base of
  // the requested width and then asks which basin goes in it — so a sink base
  // already on the plan is dropped rather than treated as an obstacle. Anything
  // else that is pre-existing stays a real obstacle.
  const preExisting = [...(args.preExistingPlacements ?? [])].filter((item) => !isSinkBaseCabinet(item));

  let working: PlacedCabinet[] = [...preExisting];
  const anchorsByKind = new Map<string, PlacedCabinet>();  const anchorOrigins: AutoDesignAnchorOrigin[] = [];
  const selectedWalls: WallSide[] = [];
  for (const anchor of plan.plan.anchors) {
    const source = anchor.kind === "sink" ? sinkBaseSource : applianceByKind[anchor.kind]!;
    const width = anchor.kind === "sink" ? sinkBaseWidth : anchor.kind === "refrigerator" ? refrigeratorWidth : dim(source.width, 24);
    const depth = dim(source.depth, 24);
    const height = dim(source.height, standardHeight(anchor.kind === "sink" ? "base" : "appliance"));
    const measuredAnchor = anchor.kind === "dishwasher" && anchor.source === "adjacent-to-sink"
      ? {
        ...anchor,
        wallLabel: input.sink.wallLabel,
        centerOffsetIn: adjacentDishwasherCenterIn(input.sink.centerOffsetIn, sinkBaseWidth, width, input.dishwasherSide ?? "right"),
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
    const along = anchorAlongStartIn(measuredAnchor, width, wall);
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
      ...(anchor.kind === "refrigerator" ? { refrigeratorPanelMode: "both" as const, refrigeratorOptionsChosen: true } : {}),
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

  const notes: string[] = [];
  const refrigeratorBayWarnings: string[] = [];
  const drawerRuleWarnings: string[] = [];
  const reviewFindings: DesignerReviewFinding[] = [];
  const refrigerator = anchorsByKind.get("refrigerator");
  let refrigeratorReservation: { wall: string; start: number; end: number } | null = null;
  if (refrigerator) {
    const nominal = input.wallCabinetHeightIn ?? 30;
    const refrigeratorBay = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator,
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
    });
    if (!refrigeratorBay.ok) return fail(refrigeratorBay.message);
    // The refrigerator must stay inside its end panels: take the clamped copy (depth/height) before fitting.
    working = working.map((item) => (item.uid === refrigeratorBay.refrigerator.uid ? refrigeratorBay.refrigerator : item));
    anchorsByKind.set("refrigerator", refrigeratorBay.refrigerator);
    refrigeratorBayWarnings.push(...refrigeratorBay.warnings);
    const fittedBay = fitExplicitRefrigeratorOptionPlacements(working, refrigeratorBay.additions, refrigerator.uid, room);
    if (Math.abs(fittedBay.shiftIn) > AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN + COLLISION_EPSILON_IN) {
      return fail("The measured refrigerator bay does not have room for its two panels and matching cabinet above. Adjust the refrigerator center measurement; Auto-Design will not move it.");
    }
    const committedBay = appendRefrigeratorEnclosurePlacements(fittedBay.existing, fittedBay.additions, refrigerator.uid, room);
    if (committedBay.rejected.length > 0) {
      return fail("The measured refrigerator bay overlaps an anchor, opening, or wall end. Adjust the refrigerator center measurement; Auto-Design will not add a filler or move it.");
    }
    working = committedBay.placed;
    // Final containment pass after all fitting: the refrigerator and its cabinet above stay inside the end panels.
    const contained = clampRefrigeratorAssemblyToPanels({
      placed: working,
      refrigeratorUid: refrigerator.uid,
      room,
      addPanel: (panelSide, opening) => refrigeratorBay.panelFor(panelSide, opening),
    });
    working = contained.placed;
    for (const warning of contained.warnings) if (!refrigeratorBayWarnings.includes(warning)) refrigeratorBayWarnings.push(warning);
    notes.push(...contained.notes);
    refrigeratorReservation = {
      ...refrigeratorBay.reservation,
      start: refrigeratorBay.reservation.start + fittedBay.shiftIn,
      end: refrigeratorBay.reservation.end + fittedBay.shiftIn,
    };
    notes.push(...refrigeratorBay.notes, ...(refrigeratorBay.refrigeratorClampNote ? [refrigeratorBay.refrigeratorClampNote] : []));
  }

  const sinkBase = anchorsByKind.get("sink");
  let sinks: SinkFixture[] = [];
  if (sinkBase) {
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
    if (pelicanSink) {
      sinks = keepSingleAutoDesignSink([pelicanSink], sinkBase.uid);
      if (resolvedSinkBase.note) notes.push(resolvedSinkBase.note);
    } else {
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
  const catalogFillers = args.fillers as unknown as CatalogFillerCandidate[];
  const sinkAnchor = anchorsByKind.get("sink") ?? null;
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
    const fit = evaluateAutoDesignCornerFit({
      options: stage.cornerOptions,
      room,
      placed: working,
      corner: point,
      wallIds: [firstWall.engineWallId, secondWall.engineWallId],
      sink: sinkAnchor,
      openings: stageOpenings,
    });
    if (fit.fallbackNote) notes.push(fit.fallbackNote);
    // Rule 2: plan the corner against the anchors before any other cabinet on these runs.
    // Blind corner (at its pull and pulled further), straight base, and the 3" wiggle are costed
    // by dead corner inches; the least waste wins and a fitting blind corner beats a straight base.
    const cornerPlan = pickCornerFirst({
      cornerOptions: stage.pool.filter((row) => stage.cornerOptions.some((option) => option.id === row.id)),
      straightBaseCatalog: stage.straightBaseCatalog,
      room,
      cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
      corner: point,
      placed: working,
      wiggleLimitIn: autoDesignShiftLimitIn("cabinet"),
    });
    if (cornerPlan) notes.push(`${slot.label}: ${describeCornerFirst(cornerPlan)}`);
    // A blind corner the planner chose overrides the generic widest-first order.
    const plannedBlind = cornerPlan && (cornerPlan.kind === "blind" || cornerPlan.kind === "blind-pulled")
      ? stage.cornerOptions.find((candidate) => candidate.id === cornerPlan.source.id) ?? null
      : null;
    const seated = seatAutoDesignCornerFromCatalog({
      slot,
      options: stage.cornerOptions,
      pool: stage.pool,
      preferred: plannedBlind,
      target: point,
      cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
      working,
      room,
      openings: stageOpenings,
      measuredApplianceUids: stage.anchorOrigins.filter((entry) => entry.kind === "refrigerator").map((entry) => entry.uid),
      blindPullIn: plannedBlind && cornerPlan ? Math.round(cornerPlan.pullIn * 8) / 8 : undefined,
      catalogFillers,
      makeUid,
      styleId: args.styleId,
      excludedWallIds,
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

  const wiggle = applyAutoDesignWiggleRoom({
    placed: working,
    room,
    openings: stageOpenings,
    catalog: stage.straightBaseCatalog,
    origins: stage.anchorOrigins,
    lockedUids: [],
  });
  working = wiggle.placed;
  const separated = separateRangeAndRefrigerator({ placed: working, room, origins: stage.anchorOrigins });
  working = separated.placed;
  let reservation = stage.refrigeratorReservation;
  const refrigeratorShift = wiggle.moves.find((move) => move.kind === "refrigerator");
  if (reservation && refrigeratorShift) {
    reservation = { ...reservation, start: reservation.start + refrigeratorShift.deltaAlongIn, end: reservation.end + refrigeratorShift.deltaAlongIn };
  }
  const usage = normalizeKitchenUsage(stage.input.kitchenUsage);
  const heavyCook = cooksALot(usage);
  const preferDrawers = heavyCook || bakesALot(usage);
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
  let basePieceCount = 0;
  for (const wallId of runWalls) {
    const rawSegments = freeSegmentsOnWall(wallId, room, working, stageOpenings, 9, 0, "base", false, undefined, footprintDepth(stage.baseSource));
    const peninsulaHold = args.peninsula && wallId === "bottom" ? autoDesignPeninsulaAttachment(room, args.peninsula.side) : null;
    const reservations = [
      ...(reservation?.wall === wallId ? [{ start: reservation.start, end: reservation.end }] : []),
      ...(peninsulaHold ? [{ start: peninsulaHold.reserveStart, end: peninsulaHold.reserveEnd }] : []),
    ];
    for (const segment of subtractAnchorRunReservations(rawSegments, reservations)) {
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
        // An adjoining run's cabinet projects into this corner. Step past it
        // instead of abandoning the rest of the wall.
        if (!placedOne) along += Math.min(3, Math.max(0.125, remain));
      }
    }
  }
  working = absorbOpenBaseGaps(working, room, stage.straightBaseCatalog, runWalls, args.styleId, makeUid);
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
  const realCabinets = applyRealCabinetsBeforeFiller({
    placed: working,
    room,
    openings: stageOpenings,
    catalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...stage.wallPool],
    makeUid,
    styleId: args.styleId,
    wallIds: runWalls,
    // Anchors (range, refrigerator, sink base) move at most 2 inches; every other
    // cabinet may use the normal allowance.
    slideLimitFor: (item) => (isSinkBaseCabinet(item)
      || (item.placement === "appliance" && (isRangeOrOven(item.masterCode, item.description) || isRefrigerator(item)))
      ? kitchenRuleNumber("anchor_wiggle_cap_in")
      : kitchenRuleNumber("jog_max_in")),
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
  working = absorbOpenBaseGaps(seamResult.placed, room, stage.straightBaseCatalog, runWalls, args.styleId, makeUid);
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
  });
  working = leftover.placed;
  notes.push(...leftover.notes);
  // Owner rule: the sink base is never the last floor box against a tall unit or
  // refrigerator. The base runs and the tall picks are both down, so a slide that
  // opens the landing is known exactly. The sink base slides (within its own
  // anchor cap); nothing else moves. A sink that still has no landing is named.
  const landingFix = slideSinkForLanding({ placed: working, room, notes, reviewFindings });
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
  // The range is otherwise left open to the design question: the microwave and hood
  // follow the add-only logic after the run is tiled.
  const upperResult = buildAutoDesignWallCabinets({
    placed: working, room, openings: stageOpenings, catalog: [...stage.wallPool],
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId, makeUid, corners: upperCorners, catalogFillers, closeSeams: true,
  });
  working = upperResult.placed;
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
  // One board per run end. Before this pass a run could collect a 1¼″ beside a
  // stock run, a 1″ beside the range and a 3″ at each window shoulder, because
  // every stage filled its own sliver. Now a stock width closes the opening when
  // one exists, and the boards of one run are consolidated into a single board.
  const stockClosed = closeSmallOpeningsWithStock({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: runWalls,
    catalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...stage.wallPool],
    maxOpeningIn: autoDesignFillerMaxIn(),
    styleId: args.styleId,
    makeUid,
  });
  working = stockClosed.placed;
  notes.push(...stockClosed.notes);
  const consolidated = consolidateAutoDesignFillers({
    placed: working,
    room,
    openings: stageOpenings,
    wallIds: runWalls,
    catalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog, ...stage.wallPool],
    fillers: catalogFillers,
    maxFillerIn: autoDesignFillerMaxIn(),
    makeUid,
    styleId: args.styleId,
  });
  working = consolidated.placed;
  notes.push(...consolidated.notes);
  reviewFillers(runWalls, working, room, stageOpenings, reviewFindings);
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
  // Rule 10: 3/4" stock on every visible side. A side the selected line cannot finish is named.
  const panelRequirements = exposedPanelRequirements({ placed: working, room, buildWallIds: runWalls });
  reviewFindings.push(...exposedPanelFindings(panelRequirements, new Set()));
  // Rule 8: the design-question door spec applies to every cabinet.
  const doorSpec: DesignQuestionDoorSpec | null = stage.input.designQuestionDoorStyleId == null
    ? null
    : {
      styleId: stage.input.designQuestionDoorStyleId,
      styleName: stage.input.designQuestionDoorStyleName ?? null,
      twoTone: false,
    };
  if (doorSpec) {
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
  if (args.peninsula) {
    const built = buildAutoDesignPeninsula({
      request: args.peninsula,
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
  const mandatoryFaucet = ensureMandatorySinkFaucets(sinks, args.faucetCatalog ?? []);
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
  const warnings = [...refrigeratorBayWarnings, ...drawerRuleWarnings, ...shiftReview.findings.filter((entry) => entry.severity === "attention").map((entry) => `${entry.title}: ${entry.description}`)];
  const bareRange = working.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && autoDesignRangeNeedsVentilation(working, item));
  return {
    ok: true,
    placed: working.filter((item) => !preExisting.some((kept) => kept.uid === item.uid)),
    sinks,
    sinkWindow,
    openings: workingOpenings,
    faucetWindowNotes,
    notes,
    warnings,
    wiggleMoves: reportedWiggleMoves,
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
