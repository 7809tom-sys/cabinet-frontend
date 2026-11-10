import { kitchenRuleNumber, kitchenRuleChoice, KITCHEN_RULE_PARAMETER_DEFAULTS } from "./kitchenRuleParameters";
import {
	STD,
	PENINSULA_INSIDE_CORNER_CLEARANCE_IN,
  appendCollisionFreePlacements,
  clampPlacedToRefrigeratorPanels,
	cabinetWall,
	isFillerItem,
	peninsulaRunById,
	wallRunOffset,
	wallRunSpan,
	wallRunFrame,
	wallRunJoinAt,
	insideCornerHoldIn,
	wallLength,
	wallPlacementAt,
	matchInstalledFillerToCabinet,
	wallCabinetFitMeasure,
  type CabinetWallDragPreview,
  type IslandFace,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "@/lib/design";
import { islandFaceFitMeasure, islandOffsetForPlaced } from "@/lib/islandScene";
import { isWallBlindCornerCabinet } from "@/lib/cabinetGraphics";
import { isFillableBoundary, seamBoundariesFor } from "@/lib/fillerPlacementRule";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "@/lib/catalogFiller";

const EDGE_EPSILON_IN = 0.001;
/**
 * Narrowest filler worth cutting. The live value is
 * `effectiveSmallGapFillerMinIn()`, so an admin can change it in Kitchen Rules.
 */
export const SMALL_GAP_FILLER_MIN_IN = KITCHEN_RULE_PARAMETER_DEFAULTS.filler_min_in;
/** A cabinet-to-cabinet seam up to this width can be intentionally filled. */
export const SMALL_GAP_FILLER_MAX_IN = KITCHEN_RULE_PARAMETER_DEFAULTS.filler_gap_max_in;
/**
 * A leftover run gap at or below this width is filled immediately. Wider seams,
 * through the filler maximum, still ask where the filler should go.
 */
export const AUTO_PLACE_FILLER_MAX_IN = KITCHEN_RULE_PARAMETER_DEFAULTS.auto_place_filler_max_in;

/** Saved Kitchen Rules value, or the code default when no override is stored. */
export function effectiveSmallGapFillerMaxIn(): number {
  return kitchenRuleNumber("filler_gap_max_in");
}

/** Narrowest seam that is still worth a filler board. */
export function effectiveSmallGapFillerMinIn(): number {
  return kitchenRuleNumber("filler_min_in");
}

/** Widest leftover that is filled with no question. */
export function effectiveAutoPlaceFillerMaxIn(): number {
  return kitchenRuleNumber("auto_place_filler_max_in");
}
/** Two pieces are available whenever both halves have a positive cut width. */
export const SMALL_GAP_SPLIT_PIECE_MIN_IN = 0;

export type SmallGapFillerPlacementMode = "left" | "right" | "split";

export type SmallGapFillerOpportunity = {
  cabinetUid: string;
  wall: WallSide;
  layer: "base" | "wall";
  cabinetStart: number;
  cabinetSpan: number;
  openingStart: number;
  openingLength: number;
  remaining: number;
  /** Island-local run ownership; absent for room-wall filler opportunities. */
  islandFace?: IslandFace;
  /** Existing purchased filler group replaced when an installed filler is edited. */
  replacingFillerGroupId?: string;
  /** Fixed-hand one-click preference; explicit user left/right/split still wins. */
  preferredMode?: SmallGapFillerPlacementMode;
	/** Left/right cabinet owners when the entire remainder is bounded by two cabinets. */
	boundedCabinetUids?: [string, string];
	/** Exact along-run start of a bounded two-cabinet gap. */
	boundedGapStart?: number;
	/** First cabinet at a held 45° turn; replace this one board with the shared pair after a neighbor is added. */
	cornerMiterProvisional?: { at: "start" | "end" };
};

export type SmallGapFillerLayout = {
  cabinetStart: number;
  leftWidth: number;
  rightWidth: number;
  pieces: Array<{ side: "left" | "right"; start: number; width: number }>;
};

export type InstalledFillerVerticalSpec = {
  storedHeight: number;
  visibleBottom: number;
  visibleHeight: number;
  visibleTop: number;
};

/**
 * Source filler records may describe longer stock. Once installed, the board is
 * field-cut to the adjoining cabinet's exact elevation. A base board exposes the
 * cabinet-height face above its 4½-inch toe kick; wall and tall boards remain
 * full-height from their shared mounting datum.
 */
export function installedFillerVerticalSpec(
  layer: "base" | "wall" | "tall",
  cabinetHeight: number,
): InstalledFillerVerticalSpec {
  if (layer === "base") {
    const storedHeight = Number.isFinite(cabinetHeight) && cabinetHeight > 0
      ? cabinetHeight
      : STD.BASE_HEIGHT;
    return {
      storedHeight,
      visibleBottom: STD.TOE_KICK,
      visibleHeight: Math.max(0, storedHeight - STD.TOE_KICK),
      visibleTop: storedHeight,
    };
  }
  // The source catalog record supplies the purchasable stock and price; the
  // installed board is always field-cut to the adjoining cabinet's exact
  // elevation. This applies to upper, tall, and nonstandard-height runs.
  const storedHeight = Number.isFinite(cabinetHeight) && cabinetHeight > 0
    ? cabinetHeight
    : layer === "tall" ? STD.TALL_HEIGHT : STD.WALL_HEIGHT;
  return {
    storedHeight,
    visibleBottom: 0,
    visibleHeight: storedHeight,
    visibleTop: storedHeight,
  };
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= EDGE_EPSILON_IN;
}

/** Gap prompts use field-cut source-filler widths with fine tape-measure precision. */
export function installableSmallGapRemainder(value: number): number | null {
  if (!Number.isFinite(value) || value <= EDGE_EPSILON_IN || value > effectiveSmallGapFillerMaxIn() + EDGE_EPSILON_IN) return null;
  const rounded = Math.round(value * 16) / 16;
  const normalized = rounded > EDGE_EPSILON_IN ? rounded : value;
  if (normalized <= EDGE_EPSILON_IN || normalized > effectiveSmallGapFillerMaxIn() + EDGE_EPSILON_IN) return null;
  // A seam below the narrowest filler worth cutting is noise, not a board.
  return normalized >= effectiveSmallGapFillerMinIn() - EDGE_EPSILON_IN ? normalized : null;
}

/** The optimal filler consumes the entire measured cabinet-to-cabinet seam. */
export function optimalSmallGapFillerCut(opportunity: Pick<SmallGapFillerOpportunity, "remaining">): number | null {
  return installableSmallGapRemainder(opportunity.remaining);
}

/** True when a detected leftover must be filled without asking the user. */
export function shouldAutoPlaceLeftoverFiller(remaining: number): boolean {
  return Number.isFinite(remaining)
    && remaining > EDGE_EPSILON_IN
    && remaining <= effectiveAutoPlaceFillerMaxIn() + EDGE_EPSILON_IN;
}

/**
 * The admin's answer to "what happens to a leftover opening". `cabinet-first`
 * (the default) tries a real cabinet before any filler. `filler-first` fills the
 * seam immediately, up to the widest seam that may be filled.
 */
export function fillerFirstPreference(): boolean {
  return kitchenRuleChoice("filler_preference_order", ["cabinet-first", "filler-first"] as const, "cabinet-first") === "filler-first";
}

/**
 * The one question every leftover asks: is this filler's job, or a real
 * cabinet's? Reads the admin's preference so a single setting steers both the
 * prompt and the automatic pass.
 */
export function leftoverWantsFiller(remaining: number): boolean {
  if (!Number.isFinite(remaining) || remaining <= EDGE_EPSILON_IN) return false;
  if (remaining > effectiveSmallGapFillerMaxIn() + EDGE_EPSILON_IN) return false;
  return fillerFirstPreference() || remaining <= effectiveAutoPlaceFillerMaxIn() + EDGE_EPSILON_IN;
}

function gapCrossesWallOpening(openings: readonly WallOpening[], wall: WallSide, start: number, length: number) {
  const end = start + length;
  return openings.some((opening) => opening.side === wall
    && opening.offset < end - EDGE_EPSILON_IN
    && opening.offset + opening.width > start + EDGE_EPSILON_IN);
}

/** Convert the WBC's fixed local blind-left side into the wall's run direction. */
export function wallBlindCornerPreferredFillerMode(
  cabinet: Pick<PlacedCabinet, "masterCode" | "description">,
  wall: WallSide,
): SmallGapFillerPlacementMode | null {
  if (!isWallBlindCornerCabinet(cabinet)) return null;
  return wall === "top" || wall === "right" ? "left" : "right";
}

/** Detects a real post-placement cabinet seam with an installable six-inch-or-less remainder. */
export function findSmallGapFillerOpportunity(
  room: RoomData,
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  cabinetUid: string,
): SmallGapFillerOpportunity | null {
  const cabinet = placed.find((item) => item.uid === cabinetUid);
  if (!cabinet || isFillerItem(cabinet) || !["base", "wall", "tall"].includes(cabinet.placement)) return null;

  const wall = cabinetWall(cabinet, room);
  // Use the same free-segment measurement that powers the selected-cabinet
  // details panel. Unlike same-placement nearest-neighbor measurement, this
  // recognizes base/tall/appliance boundaries in one floor run as well as true
  // corner footprints, so the filler prompt agrees with the displayed remainder.
  const measurement = wallCabinetFitMeasure(cabinet, room, [...placed], [...openings], wall);
  const cabinetStart = measurement.start;
  const cabinetSpan = measurement.end - measurement.start;
  const cabinetEnd = cabinetStart + cabinetSpan;
	const layer: "base" | "wall" = cabinet.placement === "wall" ? "wall" : "base";
	const leadingStart = measurement.availableStart;
	const peninsula = peninsulaRunById(room, wall);
	let protectedLeadingClearance = false;
	let protectedTrailingClearance = false;
	if (peninsula && layer === "base") {
		const floorLayerPeer = (item: PlacedCabinet) => item.placement === "base" || item.placement === "appliance" || item.placement === "tall";
		const boundedNeighbor = placed
			.filter((item) => item.uid !== cabinet.uid && !isFillerItem(item) && floorLayerPeer(item) && cabinetWall(item, room) === wall)
			.map((item) => {
				const start = wallRunOffset(item, wall, room);
				const end = start + wallRunSpan(item, wall, room);
				if (end <= cabinetStart + EDGE_EPSILON_IN) return { item, start, end, gapStart: end, gap: cabinetStart - end, before: true };
				if (start >= cabinetEnd - EDGE_EPSILON_IN) return { item, start, end, gapStart: cabinetEnd, gap: start - cabinetEnd, before: false };
				return null;
			})
			.filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
			.filter((candidate) => installableSmallGapRemainder(candidate.gap) != null)
			.sort((left, right) => left.gap - right.gap)[0];
		if (boundedNeighbor && !gapCrossesWallOpening(openings, wall, boundedNeighbor.gapStart, boundedNeighbor.gap)) {
			const remaining = installableSmallGapRemainder(boundedNeighbor.gap)!;
			const leftUid = boundedNeighbor.before ? boundedNeighbor.item.uid : cabinet.uid;
			const rightUid = boundedNeighbor.before ? cabinet.uid : boundedNeighbor.item.uid;
			return {
				cabinetUid,
				wall,
				layer,
				cabinetStart,
				cabinetSpan,
				openingStart: boundedNeighbor.gapStart,
				openingLength: remaining,
				remaining,
				preferredMode: "split",
				boundedCabinetUids: [leftUid, rightUid],
				boundedGapStart: boundedNeighbor.gapStart,
			};
		}

		// The 11-inch 45° inside-corner envelope is installation clearance,
		// not an uncovered cabinet-to-cabinet seam. A cabinet beginning at
		// 12 inches leaves a one-inch protected pocket behind it; selling a
		// filler there would put a strip at the turn instead of at a real,
		// visible cabinet-front seam. Only a measured transition between two
		// independently supported cabinet faces may receive the dedicated
		// full-depth 45° transition filler.
		const startsAtProtectedCorner = near(measurement.availableStart, Math.min(PENINSULA_INSIDE_CORNER_CLEARANCE_IN, measurement.wallLen));
		const hasConnectedFarCorner = Boolean(room.peninsulaRuns?.some((run) => run.parentRunId === peninsula.id));
		const endsAtProtectedCorner = hasConnectedFarCorner
			&& near(measurement.availableEnd, Math.max(0, measurement.wallLen - PENINSULA_INSIDE_CORNER_CLEARANCE_IN));
		protectedLeadingClearance = startsAtProtectedCorner && measurement.before > EDGE_EPSILON_IN;
		protectedTrailingClearance = endsAtProtectedCorner && measurement.after > EDGE_EPSILON_IN;
	}
	const before = installableSmallGapRemainder(measurement.before);
	const after = installableSmallGapRemainder(measurement.after);
	// Owner rule: a filler only closes a gap between two cabinets, between a
	// cabinet and a wall end, or between a cabinet and an appliance. A
	// refrigerator end panel is deliberately exempt from the plan-collision test
	// (`sharesPlanCollisionZone`), so the fit measurement above can report a
	// "before" gap that actually runs straight through a 24-inch-deep, 84-inch
	// panel. Reading the real boundaries is what stops the designer cutting a
	// board for it (the white strip across the panel's outside face).
	const seams = seamBoundariesFor({ cabinet, placed, room, openings });
	const beforeBlocked = !isFillableBoundary(seams.start);
	const afterBlocked = !isFillableBoundary(seams.end);
	// Base-cabinet fit measurement ignores window clearance, so a window can be
	// the real boundary of a short visible seam even though the free segment spans
	// the whole wall. Treat only the cabinet-to-opening edge as a filler seam;
	// never propose a board that crosses the opening itself.
	const openingBefore = openings
		.filter((opening) => opening.side === wall)
		.map((opening) => cabinetStart - (opening.offset + opening.width))
		.filter((gap) => gap >= -EDGE_EPSILON_IN && gap <= effectiveSmallGapFillerMaxIn() + EDGE_EPSILON_IN)
		.map((gap) => Math.max(0, gap))
		.sort((left, right) => left - right)[0];
	const openingAfter = openings
		.filter((opening) => opening.side === wall)
		.map((opening) => opening.offset - cabinetEnd)
		.filter((gap) => gap >= -EDGE_EPSILON_IN && gap <= effectiveSmallGapFillerMaxIn() + EDGE_EPSILON_IN)
		.map((gap) => Math.max(0, gap))
		.sort((left, right) => left - right)[0];
	const measuredBefore = before ?? installableSmallGapRemainder(openingBefore ?? Number.NaN);
	const measuredAfter = after ?? installableSmallGapRemainder(openingAfter ?? Number.NaN);
	const beforeIsClear = before != null
		&& !protectedLeadingClearance
		&& !beforeBlocked
		&& !gapCrossesWallOpening(openings, wall, leadingStart, measurement.before);
	const afterIsClear = after != null
		&& !protectedTrailingClearance
		&& !afterBlocked
		&& !gapCrossesWallOpening(openings, wall, cabinetEnd, measurement.after);
	const openingBeforeIsClear = before == null && measuredBefore != null && !protectedLeadingClearance && !beforeBlocked;
	const openingAfterIsClear = after == null && measuredAfter != null && !protectedTrailingClearance && !afterBlocked;
	const combined = installableSmallGapRemainder(
		(protectedLeadingClearance || beforeBlocked ? 0 : measurement.before)
		+ (protectedTrailingClearance || afterBlocked ? 0 : measurement.after),
	);

	  // When both adjoining seams are small, preserve the established single
	  // dialog with left/right/split choices. It is one bounded opening and one
	  // sellable filler line, even when the user elects to install two equal pieces.
	  if (beforeIsClear && afterIsClear && combined != null) {
	    const preferredMode = wallBlindCornerPreferredFillerMode(cabinet, wall);
	    return {
	      cabinetUid,
	      wall,
	      layer,
	      cabinetStart,
	      cabinetSpan,
	      openingStart: leadingStart,
	      openingLength: cabinetSpan + combined,
	      remaining: combined,
	      ...(preferredMode ? { preferredMode } : {}),
	    };
	  }

	  // Do not decide an ERB36 filler at the moment the corner cabinet is seated:
	  // the neighboring runs are not known yet. Once the user places a cabinet
	  // beside either leg, however, a real 1/8–6" seam needs immediate filler
	  // guidance even if the cabinet's other side remains open for more cabinets.
	  // Pick the left seam first for a deterministic prompt; after it is resolved,
	  // the next cabinet placement/recheck can offer the independent right seam.
	  if (beforeIsClear || openingBeforeIsClear) {
	    const remaining = measuredBefore!;
	    return {
	      cabinetUid,
	      wall,
	      layer,
	      cabinetStart,
	      cabinetSpan,
	      openingStart: cabinetStart - remaining,
	      openingLength: cabinetSpan + remaining,
	      remaining,
	      preferredMode: wallBlindCornerPreferredFillerMode(cabinet, wall) ?? "left",
	    };
	  }
	  if (afterIsClear || openingAfterIsClear) {
	    const remaining = measuredAfter!;
	    return {
	      cabinetUid,
	      wall,
	      layer,
	      cabinetStart,
	      cabinetSpan,
	      openingStart: cabinetStart,
	      openingLength: cabinetSpan + remaining,
      remaining,
	      preferredMode: wallBlindCornerPreferredFillerMode(cabinet, wall) ?? "right",
	    };
	  }
	  return null;
}

/**
 * A first cabinet seated at a true 45° inside-corner hold can leave a visible
 * face-side sliver before the adjoining run exists. Offer its ordinary
 * source-backed filler dialog immediately; the caller replaces this provisional
 * board with the shared front-miter pair after a second cabinet reaches the turn.
 */
export function findFirstCabinet45CornerFillerOpportunity(
  room: RoomData,
  placed: readonly PlacedCabinet[],
  cabinetUid: string,
): SmallGapFillerOpportunity | null {
  const cabinet = placed.find((item) => item.uid === cabinetUid);
  if (!cabinet || isFillerItem(cabinet) || !cabinet.wallId || !["base", "wall", "tall"].includes(cabinet.placement)) return null;
  const frame = wallRunFrame(cabinet.wallId, room);
  if (!frame) return null;
  const wall = cabinetWall(cabinet, room);
  const wallLen = wallLength(wall, room);
  const start = wallRunOffset(cabinet, wall, room);
  const end = start + wallRunSpan(cabinet, wall, room);
  const layer: "base" | "wall" = cabinet.placement === "wall" ? "wall" : "base";
  for (const at of ["start", "end"] as const) {
    const join = wallRunJoinAt(frame, at, room);
    const hold = join ? insideCornerHoldIn(join.turnDeg, cabinet.depth) : 0;
    const edgeGap = at === "start" ? start : wallLen - end;
    if (hold <= 0 || Math.abs(edgeGap - hold) > 0.125) continue;
    const hasSameLayerNeighbor = placed.some((item) => item.uid !== cabinet.uid
      && !isFillerItem(item)
      && item.placement === cabinet.placement
      && item.wallId === join?.frame.id);
    if (hasSameLayerNeighbor) continue;
    const remaining = 1;
    return {
      cabinetUid,
      wall,
      layer,
      cabinetStart: start,
      cabinetSpan: end - start,
      openingStart: at === "start" ? start - remaining : start,
      openingLength: end - start + remaining,
      remaining,
      preferredMode: at === "start" ? "left" : "right",
      cornerMiterProvisional: { at },
    };
  }
  return null;
}

/** Prefer the protected 45-degree first-cabinet transition to a generic edge gap. */
export function findPreferredSmallGapFillerOpportunity(
  room: RoomData,
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  cabinetUid: string,
): SmallGapFillerOpportunity | null {
  return findFirstCabinet45CornerFillerOpportunity(room, placed, cabinetUid)
    ?? findSmallGapFillerOpportunity(room, placed, openings, cabinetUid);
}

/** Uses the selected island face's own run length and neighbors, never a room wall. */
export function findIslandSmallGapFillerOpportunity(
  island: IslandZone,
  placed: readonly PlacedCabinet[],
  cabinetUid: string,
): SmallGapFillerOpportunity | null {
  const cabinet = placed.find((item) => item.uid === cabinetUid);
  const face = cabinet?.islandFace ?? null;
  if (!cabinet || !face || isFillerItem(cabinet) || !["base", "wall", "tall"].includes(cabinet.placement)) return null;
  const measurement = islandFaceFitMeasure(cabinet, island, [...placed]);
  if (!measurement || measurement.status !== "fits") return null;
  const remaining = installableSmallGapRemainder(measurement.before + measurement.after);
  if (remaining == null) return null;
  return {
    cabinetUid,
    wall: measurement.side,
    layer: cabinet.placement === "wall" ? "wall" : "base",
    cabinetStart: islandOffsetForPlaced(cabinet, island, face),
    cabinetSpan: measurement.requiredSpan,
    openingStart: measurement.availableStart,
    openingLength: measurement.availableSpan,
    remaining,
    islandFace: face,
  };
}

/**
 * A right-drag preview already identifies the exact bounded free segment and the
 * accepted zero-overlap object position. Convert that measured result directly
 * into the existing filler workflow so cabinets, panels, fillers, and floor
 * appliances all receive the same left/right/split choices after a valid move.
 */
export function smallGapFillerOpportunityFromDragPreview(
  cabinetUid: string,
  preview: CabinetWallDragPreview,
): SmallGapFillerOpportunity | null {
  if (!preview.candidate || preview.fit.status !== "valid") return null;
  const remaining = installableSmallGapRemainder(preview.fit.before + preview.fit.after);
  if (remaining == null) return null;
  const preferredMode = wallBlindCornerPreferredFillerMode(preview.candidate, preview.wall);
  return {
    cabinetUid,
    wall: preview.wall,
    layer: preview.fit.gap.layer,
    cabinetStart: preview.fit.snapStart,
    cabinetSpan: preview.fit.requiredSpan,
    openingStart: preview.fit.gap.start,
    openingLength: preview.fit.gap.length,
    remaining,
    ...(preferredMode ? { preferredMode } : {}),
  };
}

export function canSplitSmallGapFiller(opportunity: Pick<SmallGapFillerOpportunity, "remaining">) {
  const half = opportunity.remaining / 2;
  return half > EDGE_EPSILON_IN
    && half + EDGE_EPSILON_IN >= SMALL_GAP_SPLIT_PIECE_MIN_IN
    && Math.abs(half * 16 - Math.round(half * 16)) <= EDGE_EPSILON_IN;
}

/** Chooses the safest one-click layout while reusing the existing priced filler transaction. */
export function automaticSmallGapFillerMode(opportunity: SmallGapFillerOpportunity): SmallGapFillerPlacementMode {
  if (opportunity.preferredMode) return opportunity.preferredMode;
  if (canSplitSmallGapFiller(opportunity)) return "split";
  const leftOpen = Math.max(0, opportunity.cabinetStart - opportunity.openingStart);
  const openingEnd = opportunity.openingStart + opportunity.openingLength;
  const rightOpen = Math.max(0, openingEnd - (opportunity.cabinetStart + opportunity.cabinetSpan));
  return leftOpen > rightOpen ? "left" : "right";
}

/** Returns exact edge-contact coordinates; every piece and cabinet seam has zero overlap. */
export function smallGapFillerLayout(
  opportunity: SmallGapFillerOpportunity,
  mode: SmallGapFillerPlacementMode,
): SmallGapFillerLayout {
	if (mode === "split" && opportunity.boundedCabinetUids && opportunity.boundedGapStart != null) {
		const leftWidth = opportunity.remaining / 2;
		const rightWidth = opportunity.remaining - leftWidth;
		return {
			cabinetStart: opportunity.cabinetStart,
			leftWidth,
			rightWidth,
			pieces: [
				{ side: "left", start: opportunity.boundedGapStart, width: leftWidth },
				{ side: "right", start: opportunity.boundedGapStart + leftWidth, width: rightWidth },
			],
		};
	}
  const leftWidth = mode === "left"
    ? opportunity.remaining
    : mode === "split"
      ? opportunity.remaining / 2
      : 0;
  const rightWidth = opportunity.remaining - leftWidth;
  const cabinetStart = opportunity.openingStart + leftWidth;
  const pieces: SmallGapFillerLayout["pieces"] = [];
  if (leftWidth > EDGE_EPSILON_IN) pieces.push({ side: "left", start: opportunity.openingStart, width: leftWidth });
  if (rightWidth > EDGE_EPSILON_IN) pieces.push({ side: "right", start: cabinetStart + opportunity.cabinetSpan, width: rightWidth });
  return { cabinetStart, leftWidth, rightWidth, pieces };
}

/**
 * Replaces only the cabinet being repositioned, then appends filler pieces
 * without dropping unrelated saved items. Measured custom-wall rooms must be
 * supplied so the batch preserves valid physical seams that have overlapping
 * rotated screen envelopes at a diagonal corner.
 */
export function appendSmallGapFillerPlacement(
  placed: readonly PlacedCabinet[],
  movedCabinet: PlacedCabinet,
  pieces: readonly PlacedCabinet[],
  room?: RoomData,
) {
  const preserved = placed.map((item) => item.uid === movedCabinet.uid ? movedCabinet : item);
  const accepted = appendCollisionFreePlacements(preserved, [...pieces], room);
  if (!room) return accepted;
  return { ...accepted, placed: clampPlacedToRefrigeratorPanels(accepted.placed, room).placed };
}

/**
 * Fillers placed together with a cabinet record it as their owner
 * (`fillerForCabinetUid`). Returns the fillers owned by the cabinets being
 * deleted so they leave the design with their cabinet.
 */
export function removedCabinetOwnedFillers(placed: readonly PlacedCabinet[], removedUids: ReadonlySet<string>): PlacedCabinet[] {
  return placed.filter((item) => !removedUids.has(item.uid)
    && item.fillerForCabinetUid != null
    && removedUids.has(item.fillerForCabinetUid));
}

/** Removing either half removes the complete purchased filler group. */
export function removePlacedCabinetGroup(placed: readonly PlacedCabinet[], uid: string): PlacedCabinet[] {
  const target = placed.find((item) => item.uid === uid);
  if (!target?.fillerPieceGroupId) return placed.filter((item) => item.uid !== uid);
  return placed.filter((item) => item.fillerPieceGroupId !== target.fillerPieceGroupId);
}

/**
 * Reconstructs the owning cabinet's measured opening after temporarily removing
 * an installed filler group. New groups carry an explicit owner UID; legacy
 * saved groups fall back to the unique adjacent cabinet whose restored
 * remainder equals the purchased filler's total installed width.
 */
export function installedSmallGapFillerEditOpportunity(
  room: RoomData,
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  fillerUid: string,
  island?: IslandZone | null,
): SmallGapFillerOpportunity | null {
  const selected = placed.find((item) => item.uid === fillerUid);
  const groupId = selected?.fillerPieceGroupId ?? null;
  if (!selected || !groupId || !isFillerItem(selected)) return null;
  if (groupId.startsWith("bbc-required-filler-")) return null;
  const group = placed.filter((item) => item.fillerPieceGroupId === groupId);
  const withoutGroup = placed.filter((item) => item.fillerPieceGroupId !== groupId);
  const explicitOwnerUid = group.find((item) => item.fillerForCabinetUid)?.fillerForCabinetUid ?? null;
  const totalWidth = Math.max(
    0,
    Number(selected.fillerTotalWidth) || group.reduce((total, item) => total + Math.max(0, Number(item.width) || 0), 0),
  );
  const candidateUids = explicitOwnerUid
    ? [explicitOwnerUid]
    : withoutGroup
      .filter((item) => !isFillerItem(item) && ["base", "wall", "tall"].includes(item.placement))
      .map((item) => item.uid);
  const matches = candidateUids.flatMap((cabinetUid) => {
    const owner = withoutGroup.find((item) => item.uid === cabinetUid);
    const opportunity = owner?.islandFace && island
      ? findIslandSmallGapFillerOpportunity(island, withoutGroup, cabinetUid)
      : findSmallGapFillerOpportunity(room, withoutGroup, openings, cabinetUid);
    return opportunity && Math.abs(opportunity.remaining - totalWidth) <= 0.01 ? [opportunity] : [];
  });
  if (matches.length !== 1) return null;
  return { ...matches[0], replacingFillerGroupId: groupId };
}

function sameFillerLayer(cabinet: PlacedCabinet, item: PlacedCabinet): boolean {
  if (item.placement === cabinet.placement) return true;
  if (cabinet.placement === "wall") return false;
  return item.placement === "tall";
}

/** A filler already standing in this along-wall interval means the seam is closed. */
function fillerAlreadyCoversGap(
  cabinet: PlacedCabinet,
  gapStart: number,
  gapWidth: number,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  const wall = cabinetWall(cabinet, room);
  const gapEnd = gapStart + gapWidth;
  return placed.some((item) => {
    if (!isFillerItem(item) || !sameFillerLayer(cabinet, item)) return false;
    if (cabinetWall(item, room) !== wall) return false;
    const start = wallRunOffset(item, wall, room);
    const end = start + wallRunSpan(item, wall, room);
    return end > gapStart + EDGE_EPSILON_IN && start < gapEnd - EDGE_EPSILON_IN;
  });
}

/**
 * Filler-sized gap between this cabinet and the wall vertex of a 90° inside
 * corner, when the adjoining run actually has a cabinet. A 45°/135° corner
 * keeps the angled miter pair instead of a straight board.
 */
function insideCornerFillerGap(
  cabinet: PlacedCabinet,
  at: "start" | "end",
  placed: readonly PlacedCabinet[],
  room: RoomData,
): number | null {
  const wall = cabinetWall(cabinet, room);
  const frame = wallRunFrame(wall, room);
  if (!frame) return null;
  const join = wallRunJoinAt(frame, at, room);
  if (!join || join.turnDeg !== 90) return null;
  const start = wallRunOffset(cabinet, wall, room);
  const end = start + wallRunSpan(cabinet, wall, room);
  const gap = at === "start" ? start : Math.max(0, wallLength(wall, room) - end);
  const width = installableSmallGapRemainder(gap);
  if (width == null) return null;
  const vertex = at === "start" ? frame.start : frame.end;
  const neighborAtStart = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.05;
  const neighborWall = join.frame.id;
  const neighborLength = join.frame.length;
  const hasNeighbor = placed.some((item) => {
    if (item.uid === cabinet.uid || isFillerItem(item) || !sameFillerLayer(cabinet, item)) return false;
    if (cabinetWall(item, room) !== neighborWall) return false;
    const neighborStart = wallRunOffset(item, neighborWall, room);
    const neighborEnd = neighborStart + wallRunSpan(item, neighborWall, room);
    const neighborGap = neighborAtStart ? neighborStart : Math.max(0, neighborLength - neighborEnd);
    return neighborGap <= Math.max(Number(item.depth) || 0, Number(cabinet.depth) || 0) + effectiveSmallGapFillerMaxIn();
  });
  return hasNeighbor ? width : null;
}

function adjoiningGapStart(cabinet: PlacedCabinet, at: "start" | "end", width: number, room: RoomData): number {
  const wall = cabinetWall(cabinet, room);
  const start = wallRunOffset(cabinet, wall, room);
  const end = start + wallRunSpan(cabinet, wall, room);
  return at === "start" ? start - width : end;
}

/**
 * Closes a filler-sized empty seam between two cabinets, including both the
 * base and the upper at a 90° inside corner of an L. Run ends that open onto
 * the floor are left alone. Each board is the line's own filler SKU.
 */
export function repairMissingAdjoiningFillers(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  openings: readonly WallOpening[],
  fillers: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null | ((cabinet: PlacedCabinet) => number | null),
): { placed: PlacedCabinet[]; added: PlacedCabinet[] } {
  let working = [...placed];
  const added: PlacedCabinet[] = [];
  for (let guard = 0; guard < 48; guard += 1) {
    let placedOne = false;
    for (const cabinet of working) {
      if (isFillerItem(cabinet) || !["base", "wall", "tall"].includes(cabinet.placement)) continue;
      const seams = seamBoundariesFor({ cabinet, placed: working, room, openings });
      const candidates: Array<{ at: "start" | "end"; width: number }> = [];
      for (const boundary of [seams.start, seams.end]) {
        if (boundary.kind !== "cabinet") continue;
        const width = installableSmallGapRemainder(boundary.gapIn);
        if (width == null) continue;
        candidates.push({ at: boundary.at, width });
      }
      for (const at of ["start", "end"] as const) {
        if (candidates.some((candidate) => candidate.at === at)) continue;
        const width = insideCornerFillerGap(cabinet, at, working, room);
        if (width == null) continue;
        candidates.push({ at, width });
      }
      for (const candidate of candidates) {
        const gapStart = adjoiningGapStart(cabinet, candidate.at, candidate.width, room);
        if (fillerAlreadyCoversGap(cabinet, gapStart, candidate.width, working, room)) continue;
        const layer = cabinet.placement === "wall" ? "wall" : cabinet.placement === "tall" ? "tall" : "base";
        const fillerDef = catalogFillerForGap(fillers, candidate.width, layer);
        if (!fillerDef) continue;
        const wall = cabinetWall(cabinet, room);
        const depth = Math.max(0, Number(cabinet.depth) || (layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH));
        const spot = wallPlacementAt(gapStart, candidate.width, depth, wall, room);
        const fillerStyleId = typeof styleId === "function" ? styleId(cabinet) : cabinet.styleId ?? styleId;
        const draft: PlacedCabinet = {
          uid: makeUid(),
          cabinetId: fillerDef.id,
          masterCode: fillerDef.masterCode,
          description: fittedCatalogFillerDescription(fillerDef, candidate.width),
          category: fillerDef.category ?? "Filler",
          subCategory: fillerDef.subCategory ?? "Filler",
          placement: layer,
          x: spot.x,
          y: spot.y,
          rotation: spot.rotation,
          ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset, peninsulaSide: spot.peninsulaSide } : {}),
          width: candidate.width,
          nominalWidth: Number(fillerDef.width) || candidate.width,
          depth,
          height: Number(cabinet.height) || (layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT),
          mountBottom: cabinet.placement === "wall" ? cabinet.mountBottom ?? null : 0,
          numberOfDoors: 0,
          numberOfDrawers: 0,
          catalogImageUrl: fillerDef.catalogImageUrl ?? null,
          styleId: fillerStyleId,
          fillerPieceGroupId: `adjoining-filler-${cabinet.uid}-${candidate.at}`,
          fillerBillingRole: "primary",
          fillerTotalWidth: candidate.width,
          fillerPlacementMode: candidate.at === "start" ? "left" : "right",
          fillerForCabinetUid: cabinet.uid,
        };
        const matched = matchInstalledFillerToCabinet(draft, cabinet, room);
        const accepted = appendCollisionFreePlacements(working, [matched], room);
        if (!accepted.placed.some((item) => item.uid === matched.uid)) continue;
        working = accepted.placed;
        added.push(matched);
        placedOne = true;
        break;
      }
      if (placedOne) break;
    }
    if (!placedOne) break;
  }
  return { placed: added.length > 0 ? working : [...placed], added };
}
