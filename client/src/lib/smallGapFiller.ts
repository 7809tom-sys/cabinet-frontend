import {
	STD,
	PENINSULA_INSIDE_CORNER_CLEARANCE_IN,
	appendCollisionFreePlacements,
	cabinetWall,
	isFillerItem,
	peninsulaRunById,
	wallRunOffset,
	wallRunSpan,
	wallRunFrame,
	wallRunJoinAt,
	insideCornerHoldIn,
	wallLength,
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

const EDGE_EPSILON_IN = 0.001;
/** Any positive measured seam may be field-cut; there is no minimum filler width. */
export const SMALL_GAP_FILLER_MIN_IN = 0;
/** A cabinet-to-cabinet seam up to six inches can be intentionally filled. */
export const SMALL_GAP_FILLER_MAX_IN = 6;
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
  if (!Number.isFinite(value) || value <= EDGE_EPSILON_IN || value > SMALL_GAP_FILLER_MAX_IN + EDGE_EPSILON_IN) return null;
  const rounded = Math.round(value * 16) / 16;
  const normalized = rounded > EDGE_EPSILON_IN ? rounded : value;
  return normalized > EDGE_EPSILON_IN && normalized <= SMALL_GAP_FILLER_MAX_IN + EDGE_EPSILON_IN ? normalized : null;
}

/** The optimal filler consumes the entire measured cabinet-to-cabinet seam. */
export function optimalSmallGapFillerCut(opportunity: Pick<SmallGapFillerOpportunity, "remaining">): number | null {
  return installableSmallGapRemainder(opportunity.remaining);
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
	// Base-cabinet fit measurement ignores window clearance, so a window can be
	// the real boundary of a short visible seam even though the free segment spans
	// the whole wall. Treat only the cabinet-to-opening edge as a filler seam;
	// never propose a board that crosses the opening itself.
	const openingBefore = openings
		.filter((opening) => opening.side === wall)
		.map((opening) => cabinetStart - (opening.offset + opening.width))
		.filter((gap) => gap >= -EDGE_EPSILON_IN && gap <= SMALL_GAP_FILLER_MAX_IN + EDGE_EPSILON_IN)
		.map((gap) => Math.max(0, gap))
		.sort((left, right) => left - right)[0];
	const openingAfter = openings
		.filter((opening) => opening.side === wall)
		.map((opening) => opening.offset - cabinetEnd)
		.filter((gap) => gap >= -EDGE_EPSILON_IN && gap <= SMALL_GAP_FILLER_MAX_IN + EDGE_EPSILON_IN)
		.map((gap) => Math.max(0, gap))
		.sort((left, right) => left - right)[0];
	const measuredBefore = before ?? installableSmallGapRemainder(openingBefore ?? Number.NaN);
	const measuredAfter = after ?? installableSmallGapRemainder(openingAfter ?? Number.NaN);
	const beforeIsClear = before != null
		&& !protectedLeadingClearance
		&& !gapCrossesWallOpening(openings, wall, leadingStart, measurement.before);
	const afterIsClear = after != null
		&& !protectedTrailingClearance
		&& !gapCrossesWallOpening(openings, wall, cabinetEnd, measurement.after);
	const openingBeforeIsClear = before == null && measuredBefore != null && !protectedLeadingClearance;
	const openingAfterIsClear = after == null && measuredAfter != null && !protectedTrailingClearance;
	const combined = installableSmallGapRemainder(
		(protectedLeadingClearance ? 0 : measurement.before)
		+ (protectedTrailingClearance ? 0 : measurement.after),
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
  return appendCollisionFreePlacements(preserved, [...pieces], room);
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
