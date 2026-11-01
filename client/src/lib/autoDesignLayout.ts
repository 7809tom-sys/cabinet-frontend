import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
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
import { activeAutoDesignWiggleMoves, applyAutoDesignWiggleRoom, applyDesignerLayoutRules, type AutoDesignAnchorOrigin, type AutoDesignWiggleMove } from "./designerLayoutRules";
import { bakesALot, cooksALot, normalizeKitchenUsage } from "./kitchenUsage";
import { ensureDrawerBase } from "./autoDesignDrawerRule";
import { reviewAfterShift, separateRangeAndRefrigerator } from "./kitchenAdjacency";
import { AUTO_DESIGN_FILLER_MAX_IN, fillAutoDesignLowerSeams, planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { autoDesignRangeHood, autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";
import { AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN, buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { autoDesignSinkWindow, windowOverlapsReservation } from "./autoDesignSinkWindow";
import { raiseWindowsForDeckFaucet } from "./faucetPlacement";
import { buildAutoDesignWallCabinets, resolveWallHeightClass, type AutoDesignUpperCorner } from "./autoDesignWallCabinets";
import {
  autoDesignPeninsulaAttachment,
  buildAutoDesignPeninsula,
  type AutoDesignPeninsulaRequest,
  type AutoDesignPeninsulaSummary,
} from "./autoDesignPeninsula";
import {
  COLLISION_EPSILON_IN,
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
  makeDefaultSinkForCabinet,
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
  faucetWindowNotes: { openingUid: string; text: string }[];
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
      if (gap.length <= AUTO_DESIGN_FILLER_MAX_IN + 0.05 || gap.length > 9.05) continue;
      const neighbor = working.find((item) => item.placement === "base" && !isSinkBaseCabinet(item) && !/filler|scribe/i.test(item.masterCode)
        && cabinetWall(item, room) === wallId
        && (Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - gap.start) <= 0.75
          || Math.abs(wallRunOffset(item, wallId, room) - (gap.start + gap.length)) <= 0.75));
      if (!neighbor) {
        const appliance = working.find((item) => item.placement === "appliance" && cabinetWall(item, room) === wallId && (
          Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - gap.start) <= 0.2
          || Math.abs(wallRunOffset(item, wallId, room) - (gap.start + gap.length)) <= 0.2
        ));
        if (!appliance) continue;
        const delta = gap.length - AUTO_DESIGN_FILLER_MAX_IN;
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
      const wanted = neighbor.width + gap.length;
      const wider = catalog
        .map((row) => ({ row, width: dim(row.width, 0) }))
        .filter((entry) => entry.width > neighbor.width + 0.05 && entry.width <= wanted + 0.05 && wanted - entry.width <= AUTO_DESIGN_FILLER_MAX_IN + 0.05)
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

/** Auto-Design never installs a filler board wider than 3 inches. A wider catalog filler is cut to 3 instead of being flagged over its maximum. */
export function capAutoDesignFillerWidth(placed: PlacedCabinet[]): PlacedCabinet[] {
  return placed.map((item) => {
    const text = `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`;
    const filler = Boolean(item.fillerPieceGroupId) || /filler|scribe|^OF\d|^FOL/i.test(text);
    const installed = item.fillerTotalWidth ?? item.width;
    if (!filler || installed <= AUTO_DESIGN_FILLER_MAX_IN + 0.05) return item;
    return { ...item, width: AUTO_DESIGN_FILLER_MAX_IN, fillerTotalWidth: AUTO_DESIGN_FILLER_MAX_IN };
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
  styleId: number | null;
  makeUid: () => string;
  stoveMasterCode?: string;
  peninsula?: AutoDesignPeninsulaRequest | null;
}): AutoDesignLayoutResult {
  const { input, room, makeUid } = args;
  const openings = [...args.openings];
  const fail = (message: string): AutoDesignLayoutResult => ({ ok: false, message });
  const plan = planAutoDesignAutoBuild(input);
  if (!plan.ok) return fail(`Missing required measurement: ${plan.missing.join(", ")}.`);
  const sinkBaseWidth = input.sinkBaseWidthIn ?? 36;
  const refrigeratorWidth = input.refrigeratorWidthIn ?? 36;
  const pool = args.baseCatalog;
  const straightBaseCatalog = autoBuildStraightBaseCatalog(pool);
  const drawerBaseCatalog = autoBuildDrawerBaseCatalog(pool);
  const sinkBaseKind = input.sinkBaseKind ?? "regular";
  const sinkBaseSource = pickAutoDesignSinkBase(pool, sinkBaseWidth, sinkBaseKind);
  if (!sinkBaseSource) {
    return fail(sinkBaseKind === "farmhouse"
      ? `No source-priced ${sinkBaseWidth}″ farmhouse sink base is available for the selected line. Choose the regular sink base or another door style, then try again.`
      : `No source-priced SB${sinkBaseWidth} sink base is available for the selected line. Choose a door style with a priced sink base, then try again.`);
  }
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

  let working: PlacedCabinet[] = [];
  const anchorsByKind = new Map<string, PlacedCabinet>();
  const anchorOrigins: AutoDesignAnchorOrigin[] = [];
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
      framelessLine: args.wallCatalog.some((row) => hasAefPrintedGeometry(row)),
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
    const defaultSinkType = isFarmSinkBasePaletteItem(sinkBase) ? "farmhouse" : sinkBase.width >= 33 ? "double" : "single";
    sinks = keepSingleAutoDesignSink([makeDefaultSinkForCabinet(sinkBase, room, defaultSinkType)], sinkBase.uid);
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
    const seated = seatAutoDesignCornerFromCatalog({
      slot,
      options: stage.cornerOptions,
      pool: stage.pool,
      target: point,
      cornerWallIds: [firstWall.engineWallId, secondWall.engineWallId],
      working,
      room,
      openings: stageOpenings,
      measuredApplianceUids: stage.anchorOrigins.filter((entry) => entry.kind === "refrigerator").map((entry) => entry.uid),
      catalogFillers,
      makeUid,
      styleId: args.styleId,
      excludedWallIds,
    });
    if (!seated.ok) {
      // Keep the measured kitchen. A corner that cannot seat (a refrigerator
      // already in it, or a range closer than the slide limit) must not wipe
      // the runs. PR #133 owns the corner-occupant refrigerator bay.
      notes.push(seated.message);
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
      while (segmentEnd - along > AUTO_DESIGN_FILLER_MAX_IN + 0.05 && guard < 40) {
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
            const spot = wallPlacementAt(cursor, entry.width, depth, wallId, room);
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
          const spot = wallPlacementAt(along, width, depth, wallId, room);
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
  // Every layout has at least one three-drawer base (Tom, Oct 31). The planner already splits a wide door base beside
  // the range; if no drawer base landed anywhere, convert the best-fitting base run. A line with no drawer base only warns.
  const drawerRule = ensureDrawerBase({ placed: working, room, catalog: [...stage.straightBaseCatalog, ...stage.drawerBaseCatalog], makeUid, styleId: args.styleId });
  working = drawerRule.placed;
  if (drawerRule.note) notes.push(drawerRule.note);
  if (drawerRule.warning) drawerRuleWarnings.push(drawerRule.warning);
  const baseRules = applyDesignerLayoutRules({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid, styleId: args.styleId,
  });
  working = baseRules.placed;
  const seamResult = fillAutoDesignLowerSeams({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid,
    styleId: args.styleId, corners: upperCorners.map((entry) => entry.point),
    preserveHeavyCookLandings: heavyCook, maxFillerIn: AUTO_DESIGN_FILLER_MAX_IN,
  });
  working = absorbOpenBaseGaps(seamResult.placed, room, stage.straightBaseCatalog, runWalls, args.styleId, makeUid);
  notes.push(...seamResult.notes, ...separated.flags);
  const bareRangeForHood = working.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && autoDesignRangeNeedsVentilation(working, item));
  if (bareRangeForHood) {
    const builtHood = autoDesignRangeHood({ range: bareRangeForHood, room, palette: args.appliancePalette, uid: makeUid() });
    if (builtHood.ok) {
      const hooded = appendCollisionFreePlacements(working, [builtHood.hood], room);
      if (hooded.rejected.length === 0) working = hooded.placed;
    }
  }
  const upperResult = buildAutoDesignWallCabinets({
    placed: working, room, openings: stageOpenings, catalog: stage.wallPool,
    wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30,
    styleId: args.styleId, makeUid, corners: upperCorners, catalogFillers, closeSeams: true,
  });
  working = upperResult.placed;
  const finishedRules = applyDesignerLayoutRules({
    placed: working, room, openings: stageOpenings, fillers: catalogFillers, makeUid, styleId: args.styleId,
  });
  working = capAutoDesignFillerWidth(finishedRules.placed);
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
  const warnings = [...refrigeratorBayWarnings, ...drawerRuleWarnings, ...shiftReview.findings.filter((entry) => entry.severity === "attention").map((entry) => `${entry.title}: ${entry.description}`)];
  const bareRange = working.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && autoDesignRangeNeedsVentilation(working, item));
  return {
    ok: true,
    placed: working,
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
  };
}
