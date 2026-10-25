import {
	  type PlacedCabinet,
	  type RoomData,
	  type WallSide,
  appendCollisionFreePlacements,
  customWallJoinTurnsFortyFive,
  elevationBox,
  peninsulaRunById,
  peninsulaRunEndpoints,
  STD,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
} from "@/lib/design";
import { catalogFillerForGap, type CatalogFillerCandidate } from "@/lib/catalogFiller";
import { installedFillerVerticalSpec } from "@/lib/smallGapFiller";

const JOIN_EPSILON_IN = 0.25;
const FRONT_FILLER_DEPTH_IN = 0.75;

/**
 * The front datum of a 45° transition is the ordinary cabinet face, never a
 * supplier's incidental box-depth field or the rear wall vertex. Base/tall
 * cabinets present at 24 inches from their back; wall cabinets present at
 * 12 inches. The two miter boards therefore meet immediately at the visible
 * cabinet fronts while their rear service pocket remains open.
 */
function transitionFrontDatumDepth(cabinet: Pick<PlacedCabinet, "placement">): number {
  return cabinet.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
}

function isTransitionCabinetPlacement(
  placement: PlacedCabinet["placement"],
): placement is "base" | "wall" | "tall" {
  return placement === "base" || placement === "wall" || placement === "tall";
}

export type AngledWallTransitionPoint = { x: number; y: number };

type EndpointFace = {
  rear: AngledWallTransitionPoint;
  front: AngledWallTransitionPoint;
};

export type AngledWallTransitionMeasurement = {
  wallId: string;
  neighborWallId: string;
  sharedVertexId: string;
  at: "start" | "end";
  neighborAt: "start" | "end";
  ownerUid: string;
  neighborUid: string;
  /** Exact gap along the owner cabinet's wall run. */
  rearGapIn: number;
  /** Exact gap along the adjoining cabinet's wall run. */
  neighborRearGapIn: number;
  /** Distance between the two visible cabinet-side front corners; diagnostic only. */
  frontGapIn: number;
  /** Measured front-run cut for filler A, from its cabinet edge to the real miter. */
  ownerFrontCutIn: number;
  /** Measured front-run cut for filler B, from its cabinet edge to the real miter. */
  neighborFrontCutIn: number;
  /** Each source filler must cover its own individual measured front-run cut. */
  requiredStockWidthIn: number;
  depthIn: number;
  ownerFace: EndpointFace;
  neighborFace: EndpointFace;
	  ownerFrontMiterOffsetIn: number;
	  neighborFrontMiterOffsetIn: number;
	  ownerRearMiterOffsetIn: number;
	  neighborRearMiterOffsetIn: number;
};

export type AngledWallFillerResolution = {
  /**
   * Two real pieces cut from source-priced stock: one on each cabinet front.
   * Neither piece is a full-depth wedge or an invented transition cabinet.
   */
  fillers: [PlacedCabinet, PlacedCabinet];
  ownerGapIn: number;
  neighborGapIn: number;
  miterAt: "start" | "end";
  neighborUid: string;
};

export type AngledWallFillerRepair = {
  placed: PlacedCabinet[];
  added: PlacedCabinet[];
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function distance(left: AngledWallTransitionPoint, right: AngledWallTransitionPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function roundedEighth(value: number): number {
  return Math.round(value * 8) / 8;
}

type TransitionJoin = {
  neighborWallId: string;
  at: "start" | "end";
  neighborAt: "start" | "end";
  vertexId: string;
};

function sharedVertexPosition(
  wall: NonNullable<RoomData["customWalls"]>[number],
  neighbor: NonNullable<RoomData["customWalls"]>[number],
): { at: "start" | "end"; neighborAt: "start" | "end"; vertexId: string } | null {
  if (wall.startVertexId === neighbor.startVertexId) return { at: "start", neighborAt: "start", vertexId: wall.startVertexId };
  if (wall.startVertexId === neighbor.endVertexId) return { at: "start", neighborAt: "end", vertexId: wall.startVertexId };
  if (wall.endVertexId === neighbor.startVertexId) return { at: "end", neighborAt: "start", vertexId: wall.endVertexId };
  if (wall.endVertexId === neighbor.endVertexId) return { at: "end", neighborAt: "end", vertexId: wall.endVertexId };
  return null;
}

function transitionJoins(wallId: string, room: RoomData): TransitionJoin[] {
  const wall = room.customWalls?.find((candidate) => candidate.id === wallId);
  if (wall) {
    return (room.customWalls ?? []).flatMap((neighbor) => {
      if (neighbor.id === wall.id || !customWallJoinTurnsFortyFive(wall, neighbor, room)) return [];
      const shared = sharedVertexPosition(wall, neighbor);
      return shared ? [{ neighborWallId: neighbor.id, ...shared }] : [];
    });
  }

  const run = peninsulaRunById(room, wallId as WallSide);
  if (!run) return [];
  const joins: TransitionJoin[] = [];
  if (run.parentRunId && run.turn === 45) {
    joins.push({
      neighborWallId: run.parentRunId,
      at: "start",
      neighborAt: "end",
      vertexId: `peninsula:${run.parentRunId}:${run.id}`,
    });
  }
  for (const child of room.peninsulaRuns ?? []) {
    if (child.parentRunId !== run.id || child.turn !== 45) continue;
    joins.push({
      neighborWallId: child.id,
      at: "end",
      neighborAt: "start",
      vertexId: `peninsula:${run.id}:${child.id}`,
    });
  }
  return joins;
}

function wallFrame(
	  wallId: string,
	  room: RoomData,
	  peninsulaSide?: PlacedCabinet["peninsulaSide"],
): { start: AngledWallTransitionPoint; tangent: AngledWallTransitionPoint; inward: AngledWallTransitionPoint } | null {
	  const peninsula = peninsulaRunById(room, wallId as WallSide);
	  if (peninsula) {
	    const geometry = peninsulaRunEndpoints(peninsula, room);
	    const tangent = { x: Math.cos(geometry.radians), y: Math.sin(geometry.radians) };
	    const leftNormal = { x: -tangent.y, y: tangent.x };
	    const side = peninsulaSide ?? peninsula.cabinetSide ?? "left";
	    return {
	      start: geometry.start,
	      tangent,
	      inward: side === "left" ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y },
	    };
	  }
	  const wall = room.customWalls?.find((candidate) => candidate.id === wallId);
	  if (!wall) return null;
	  const start = room.vertices?.find((vertex) => vertex.id === wall.startVertexId);
	  const end = room.vertices?.find((vertex) => vertex.id === wall.endVertexId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return null;
  const tangent = { x: dx / length, y: dy / length };
  return {
    start: { x: start.x, y: start.y },
    tangent,
    inward: { x: -tangent.y, y: tangent.x },
  };
}

function cabinetSideFaceAtWallEndpoint(
	  cabinet: PlacedCabinet,
	  wallId: string,
	  at: "start" | "end",
	  room: RoomData,
): EndpointFace | null {
	  const frame = wallFrame(wallId, room, cabinet.peninsulaSide);
	  if (!frame) return null;
	  const offset = wallRunOffset(cabinet, wallId, room);
	  const span = wallRunSpan(cabinet, wallId, room);
  const edgeOffset = at === "start" ? offset : offset + span;
  const rear = {
    x: frame.start.x + frame.tangent.x * edgeOffset,
    y: frame.start.y + frame.tangent.y * edgeOffset,
  };
  // A locked 45° transition must be referenced to the cabinet front—not an
  // arbitrary catalog depth. This keeps base fillers 24″ from the cabinet back
  // and wall fillers 12″ from their cabinet back on every rotated wall frame.
  const depth = transitionFrontDatumDepth(cabinet);
  return {
    rear,
    front: {
      x: rear.x + frame.inward.x * depth,
      y: rear.y + frame.inward.y * depth,
    },
  };
}

function frontFillerFootprint(
	  wallId: string,
	  room: RoomData,
	  cabinetFaceOffset: number,
	  miterOffset: number,
	  rearMiterOffset: number,
	  depth: number,
	  peninsulaSide?: PlacedCabinet["peninsulaSide"],
): AngledWallTransitionPoint[] | null {
	  const frame = wallFrame(wallId, room, peninsulaSide);
	  const width = Math.abs(miterOffset - cabinetFaceOffset);
	  if (!frame || width <= 0 || depth <= 0) return null;
	  const face = depth;
	  const back = Math.max(0, depth - Math.min(depth, FRONT_FILLER_DEPTH_IN));
	  // Both pieces share the full diagonal edge between their front-line
	  // intersection and the intersection of their 3/4-inch rear face lines.
	  // Cutting only the last 3/4 inch off the run (the former implementation)
	  // leaves a visible triangular hole between the two cabinet fronts.
	  const local = [
	    [cabinetFaceOffset, face],
	    [miterOffset, face],
	    [rearMiterOffset, back],
	    [cabinetFaceOffset, back],
	  ];
	  return local.map(([along, inward]) => ({
	    x: frame.start.x + frame.tangent.x * along + frame.inward.x * inward,
    y: frame.start.y + frame.tangent.y * along + frame.inward.y * inward,
  }));
}

function frontFillerPlacement(
  wallId: string,
  cabinetFaceOffset: number,
  miterOffset: number,
	  depth: number,
	  room: RoomData,
	  peninsulaSide?: PlacedCabinet["peninsulaSide"],
) {
	  const start = Math.min(cabinetFaceOffset, miterOffset);
	  return wallPlacementAt(start, Math.abs(miterOffset - cabinetFaceOffset), depth, wallId as WallSide, room, peninsulaSide);
}

function lineIntersection(
  leftPoint: AngledWallTransitionPoint,
  leftDirection: AngledWallTransitionPoint,
  rightPoint: AngledWallTransitionPoint,
  rightDirection: AngledWallTransitionPoint,
): AngledWallTransitionPoint | null {
  const determinant = leftDirection.x * rightDirection.y - leftDirection.y * rightDirection.x;
  if (Math.abs(determinant) <= 0.0001) return null;
  const delta = { x: rightPoint.x - leftPoint.x, y: rightPoint.y - leftPoint.y };
  const factor = (delta.x * rightDirection.y - delta.y * rightDirection.x) / determinant;
  return {
    x: leftPoint.x + leftDirection.x * factor,
    y: leftPoint.y + leftDirection.y * factor,
  };
}

function wallOffsetAtPoint(
	  wallId: string,
	  point: AngledWallTransitionPoint,
	  room: RoomData,
	  peninsulaSide?: PlacedCabinet["peninsulaSide"],
): number | null {
	  const frame = wallFrame(wallId, room, peninsulaSide);
  if (!frame) return null;
  return (point.x - frame.start.x) * frame.tangent.x + (point.y - frame.start.y) * frame.tangent.y;
}

/**
 * Measure one genuine two-piece 45-degree front-filler assembly. A pair exists
 * only when both independently supported cabinet runs leave a real measured gap
 * at the same locked 45-degree vertex. A one-sided opening is left alone rather
 * than being converted into a deep wedge at the back of a cabinet run.
 */
export function measuredAngledWallTransition(
  cabinet: PlacedCabinet,
  room: RoomData,
  placed: readonly PlacedCabinet[],
): AngledWallTransitionMeasurement | null {
	  // This is a cabinet-run rule, not a base-cabinet rule. Any independently
	  // supported cabinet family may meet a true 45° turn; the two selected-line
	  // filler boards follow the shared elevation band of those two cabinets.
	  if (!isTransitionCabinetPlacement(cabinet.placement) || !cabinet.wallId) return null;
	  const joins = transitionJoins(cabinet.wallId, room);
	  if (joins.length === 0) return null;

	  const wallLen = wallLength(cabinet.wallId as WallSide, room);
	  const start = wallRunOffset(cabinet, cabinet.wallId, room);
	  const end = start + wallRunSpan(cabinet, cabinet.wallId, room);
	  const currentElevation = elevationBox(cabinet, room);

	  for (const shared of joins) {
	    const ownerGap = shared.at === "start" ? start : wallLen - end;
	    if (ownerGap < -JOIN_EPSILON_IN) continue;
	    const neighborLen = wallLength(shared.neighborWallId as WallSide, room);
	    const neighborCandidate = placed
	      .filter((item) => item.uid !== cabinet.uid
	        && !item.fillerPieceGroupId
	        && item.placement === cabinet.placement
	        && item.wallId === shared.neighborWallId)
	      .map((item) => {
	      const itemStart = wallRunOffset(item, shared.neighborWallId, room);
	      const itemEnd = itemStart + wallRunSpan(item, shared.neighborWallId, room);
	      const neighborGap = shared.neighborAt === "start" ? itemStart : neighborLen - itemEnd;
	      const itemElevation = elevationBox(item, room);
	      const sameElevation = Math.abs(itemElevation.bottom - currentElevation.bottom) <= JOIN_EPSILON_IN
	        && Math.abs(itemElevation.height - currentElevation.height) <= JOIN_EPSILON_IN;
	      return { item, neighborGap, sameElevation };
	    })
	      .filter(({ neighborGap, sameElevation }) => neighborGap >= -JOIN_EPSILON_IN && sameElevation)
	      .sort((left, right) => left.neighborGap - right.neighborGap)[0];
	    if (!neighborCandidate) continue;
	    const neighbor = neighborCandidate.item;
	    if (placed.some((item) => item.fillerTransitionKind === "front-miter-pair" && (
	      (item.fillerForCabinetUid === cabinet.uid && item.fillerTransitionNeighborUid === neighbor.uid)
	      || (item.fillerForCabinetUid === neighbor.uid && item.fillerTransitionNeighborUid === cabinet.uid)
	    ))) continue;

	    const neighborGap = neighborCandidate.neighborGap;
	    if (ownerGap < 0.125 && neighborGap < 0.125) continue;
	    const ownerFace = cabinetSideFaceAtWallEndpoint(cabinet, cabinet.wallId, shared.at, room);
	    const neighborFace = cabinetSideFaceAtWallEndpoint(neighbor, shared.neighborWallId, shared.neighborAt, room);
	    if (!ownerFace || !neighborFace) continue;
	    const ownerFrame = wallFrame(cabinet.wallId, room, cabinet.peninsulaSide);
	    const neighborFrame = wallFrame(shared.neighborWallId, room, neighbor.peninsulaSide);
	    if (!ownerFrame || !neighborFrame) continue;
	    const miterPoint = lineIntersection(ownerFace.front, ownerFrame.tangent, neighborFace.front, neighborFrame.tangent);
	    if (!miterPoint) continue;
	    const ownerRearLine = {
	      x: ownerFace.front.x - ownerFrame.inward.x * FRONT_FILLER_DEPTH_IN,
	      y: ownerFace.front.y - ownerFrame.inward.y * FRONT_FILLER_DEPTH_IN,
	    };
	    const neighborRearLine = {
	      x: neighborFace.front.x - neighborFrame.inward.x * FRONT_FILLER_DEPTH_IN,
	      y: neighborFace.front.y - neighborFrame.inward.y * FRONT_FILLER_DEPTH_IN,
	    };
	    const rearMiterPoint = lineIntersection(ownerRearLine, ownerFrame.tangent, neighborRearLine, neighborFrame.tangent);
	    if (!rearMiterPoint) continue;
	    const ownerFrontMiterOffsetIn = wallOffsetAtPoint(cabinet.wallId, miterPoint, room, cabinet.peninsulaSide);
	    const neighborFrontMiterOffsetIn = wallOffsetAtPoint(shared.neighborWallId, miterPoint, room, neighbor.peninsulaSide);
	    const ownerRearMiterOffsetIn = wallOffsetAtPoint(cabinet.wallId, rearMiterPoint, room, cabinet.peninsulaSide);
	    const neighborRearMiterOffsetIn = wallOffsetAtPoint(shared.neighborWallId, rearMiterPoint, room, neighbor.peninsulaSide);
	    if (ownerFrontMiterOffsetIn == null || neighborFrontMiterOffsetIn == null || ownerRearMiterOffsetIn == null || neighborRearMiterOffsetIn == null) continue;
	    const ownerGapIn = roundedEighth(ownerGap);
	    const neighborGapIn = roundedEighth(neighborGap);
	    const ownerFrontCutIn = roundedEighth(distance(ownerFace.front, miterPoint));
	    const neighborFrontCutIn = roundedEighth(distance(neighborFace.front, miterPoint));
	    const ownerRearCutIn = roundedEighth(distance(ownerRearLine, rearMiterPoint));
	    const neighborRearCutIn = roundedEighth(distance(neighborRearLine, rearMiterPoint));
	    if (ownerFrontCutIn < 0.5 || neighborFrontCutIn < 0.5) continue;
	    return {
	      wallId: cabinet.wallId,
	      neighborWallId: shared.neighborWallId,
      sharedVertexId: shared.vertexId,
      at: shared.at,
      neighborAt: shared.neighborAt,
      ownerUid: cabinet.uid,
      neighborUid: neighbor.uid,
      rearGapIn: ownerGapIn,
      neighborRearGapIn: neighborGapIn,
      frontGapIn: roundedEighth(distance(ownerFace.front, neighborFace.front)),
      ownerFrontCutIn,
      neighborFrontCutIn,
	      requiredStockWidthIn: Math.max(ownerFrontCutIn, neighborFrontCutIn, ownerRearCutIn, neighborRearCutIn),
      depthIn: Math.max(transitionFrontDatumDepth(cabinet), transitionFrontDatumDepth(neighbor)),
	      ownerFace,
	      neighborFace,
	      ownerFrontMiterOffsetIn,
	      neighborFrontMiterOffsetIn,
	      ownerRearMiterOffsetIn,
	      neighborRearMiterOffsetIn,
    };
  }
  return null;
}

/**
 * Return the persisted physical face-board polygon for the specific member of a
 * two-piece miter pair. Legacy full-depth wedges are kept readable only for old
 * saved plans; new assemblies never use that construction.
 */
export function angledWallTransitionFootprint(
  filler: PlacedCabinet,
  room: RoomData,
  placed: readonly PlacedCabinet[],
): AngledWallTransitionPoint[] | null {
  if (filler.fillerTransitionKind === "front-miter-pair") {
    return filler.fillerTransitionPlanFootprint?.length
      ? filler.fillerTransitionPlanFootprint.map((point) => ({ ...point }))
      : null;
  }
  if (filler.fillerTransitionKind !== "angled-wedge") return null;
  const owner = placed.find((item) => item.uid === filler.fillerForCabinetUid);
  if (!owner) return filler.fillerTransitionPlanFootprint?.length
    ? filler.fillerTransitionPlanFootprint.map((point) => ({ ...point }))
    : null;
  // Existing saved full-depth wedge records retain their persisted footprint so
  // an old design does not change its measured collision body on load.
  return filler.fillerTransitionPlanFootprint?.length
    ? filler.fillerTransitionPlanFootprint.map((point) => ({ ...point }))
    : null;
}

/**
 * Resolves a source-priced two-piece miter pair at the exposed front of the
 * cabinet runs. Both pieces use the same verified selected-line filler stock,
 * each gets its own positive locked price, and neither becomes a deep wedge,
 * panel, or fabricated SKU.
 */
export function automaticAngledWallFiller(
  cabinet: PlacedCabinet,
  room: RoomData,
  placed: readonly PlacedCabinet[],
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): AngledWallFillerResolution | null {
	const transitionPlacement = cabinet.placement === "wall"
	  ? "wall"
	  : cabinet.placement === "base"
	    ? "base"
	    : cabinet.placement === "tall" ? "tall" : null;
	if (!transitionPlacement) return null;
	  const measurement = measuredAngledWallTransition(cabinet, room, placed);
	  if (!measurement) return null;
	  const currentElevation = elevationBox(cabinet, room);
	  const heightCompatibleCandidates = candidates.filter((candidate) => {
	    const height = numberValue(candidate.height);
	    if (height + JOIN_EPSILON_IN < currentElevation.height) return false;
	    const sourceText = `${candidate.masterCode} ${candidate.description ?? ""}`.toLowerCase();
	    // A base transition may be cut from real base/tall filler stock, but never
	    // from a source-described wall filler. Tall cabinets require tall stock;
	    // no source filler is stretched or invented to match an elevation.
	    if (transitionPlacement === "base" && /\bwall\s+filler\b/.test(sourceText)) return false;
	    if (transitionPlacement === "wall" && /\bbase\s+filler\b/.test(sourceText)) return false;
	    if (transitionPlacement === "tall" && !/\btall\s+filler\b/.test(sourceText)) return false;
	    return true;
	  });
	  const source = catalogFillerForGap(heightCompatibleCandidates, measurement.requiredStockWidthIn, transitionPlacement);
	  if (!source) return null;

	  const depth = Math.max(FRONT_FILLER_DEPTH_IN, measurement.depthIn);
	  const stockWidth = numberValue(source.width);
	  const vertical = installedFillerVerticalSpec(transitionPlacement, currentElevation.height);
  const groupId = `front-miter-pair-${cabinet.uid}-${measurement.neighborUid}-${measurement.at}`;
  const neighbor = placed.find((item) => item.uid === measurement.neighborUid);
  if (!neighbor) return null;

  const makePiece = (
    owner: PlacedCabinet,
	    wallId: string,
	    cabinetFaceOffset: number,
	    miterOffset: number,
	    rearMiterOffset: number,
	    counterpartUid: string,
	    piece: "owner" | "neighbor",
	  ): PlacedCabinet | null => {
	    if (!wallFrame(wallId, room, owner.peninsulaSide)) return null;
	    const footprint = frontFillerFootprint(wallId, room, cabinetFaceOffset, miterOffset, rearMiterOffset, depth, owner.peninsulaSide);
	    if (!footprint) return null;
	    const spot = frontFillerPlacement(wallId, cabinetFaceOffset, miterOffset, depth, room, owner.peninsulaSide);
    // Preserve the real geometry rather than rounding the stored body shorter
    // than its shared miter line. The presented cut is rounded to 1/8 inch by
    // the plan/toast helpers, while stock selection rounds up separately.
    const exactCutWidth = Math.abs(miterOffset - cabinetFaceOffset);
    const miteredEnd = miterOffset >= cabinetFaceOffset ? "end" : "start";
    const sourceDescription = source.description ?? source.masterCode;
    // SCR and similar source rows are orderable stock, but their fitted role at
    // this corner is a cabinet filler—not decorative scribe molding.
    const installedName = /\bscribe\b/i.test(sourceDescription) ? "Filler" : sourceDescription;
    return {
      uid: makeUid(),
      cabinetId: source.id,
      masterCode: source.masterCode,
	      description: `${installedName} — ${piece === "owner" ? "A" : "B"} front filler cut to ${roundedEighth(exactCutWidth)}\" with 22.5° miter (forms 45° turn)`,
      category: source.category,
      subCategory: source.subCategory,
	      placement: transitionPlacement,
      x: spot.x,
      y: spot.y,
      width: exactCutWidth,
      nominalWidth: stockWidth,
      depth,
      nominalDepth: depth,
      height: vertical.storedHeight,
	      nominalHeight: numberValue(source.height),
	      rotation: spot.rotation,
	      numberOfDoors: 0,
	      numberOfDrawers: 0,
	      catalogImageUrl: source.catalogImageUrl ?? null,
	      // A front-miter filler is field-cut to its owning cabinet's full face
	      // envelope. This includes a raised base/tall datum as well as an upper
	      // mounted above the normal 54-inch line; the source stock size remains
	      // only its purchasing identity.
	      mountBottom: currentElevation.bottom,
      styleId,
      wallId: spot.wallId ?? wallId,
      wallOffset: spot.wallOffset ?? Math.min(cabinetFaceOffset, miterOffset),
      fillerPieceGroupId: groupId,
      // Both physical pieces are purchased stock and each has the selected-line price.
      fillerBillingRole: "primary",
      fillerTotalWidth: measurement.rearGapIn + measurement.neighborRearGapIn,
      fillerPlacementMode: piece === "owner" ? "left" : "right",
      fillerForCabinetUid: owner.uid,
	      fillerMiterAngle: 22.5,
      fillerMiteredEnd: miteredEnd,
      fillerTransitionKind: "front-miter-pair",
      fillerTransitionPiece: piece,
      fillerTransitionNeighborUid: counterpartUid,
	      fillerTransitionRearWidthIn: Math.abs(rearMiterOffset - cabinetFaceOffset),
      fillerTransitionFrontWidthIn: exactCutWidth,
      fillerTransitionStockWidthIn: stockWidth,
      fillerTransitionPlanFootprint: footprint.map((point) => ({ ...point })),
      fillerIndependentCabinetSupport: true,
    };
  };

  const ownerFaceOffset = measurement.at === "start"
    ? wallRunOffset(cabinet, measurement.wallId, room)
    : wallRunOffset(cabinet, measurement.wallId, room) + wallRunSpan(cabinet, measurement.wallId, room);
  const neighborFaceOffset = measurement.neighborAt === "start"
    ? wallRunOffset(neighbor, measurement.neighborWallId, room)
    : wallRunOffset(neighbor, measurement.neighborWallId, room) + wallRunSpan(neighbor, measurement.neighborWallId, room);
	  const ownerPiece = makePiece(cabinet, measurement.wallId, ownerFaceOffset, measurement.ownerFrontMiterOffsetIn, measurement.ownerRearMiterOffsetIn, neighbor.uid, "owner");
	  const neighborPiece = makePiece(neighbor, measurement.neighborWallId, neighborFaceOffset, measurement.neighborFrontMiterOffsetIn, measurement.neighborRearMiterOffsetIn, cabinet.uid, "neighbor");
  if (!ownerPiece || !neighborPiece) return null;
	  return {
	    fillers: [ownerPiece, neighborPiece],
	    ownerGapIn: measurement.ownerFrontCutIn,
	    neighborGapIn: measurement.neighborFrontCutIn,
	    miterAt: measurement.at,
	    neighborUid: measurement.neighborUid,
	  };
}

/**
 * Restores any missing source-priced front-miter pair after an older saved plan
 * or local draft loads. This is intentionally additive: existing cabinet
 * positions, manual fillers, countertops, and historical wedge records remain
 * untouched. A real, catalog-backed pair is committed whenever both exact
 * footprints pass collision checks. Its price is deliberately not a geometry
 * gate: an unpriced source board must remain visible in the design and then be
 * caught by the shared Part 1 missing-price flag and checkout block, never
 * leave an unexplained physical void.
 */
export function repairMissingAngledWallFillers(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): AngledWallFillerRepair {
  let next = [...placed];
  const added: PlacedCabinet[] = [];
  for (const cabinet of placed) {
	if (cabinet.fillerPieceGroupId || !isTransitionCabinetPlacement(cabinet.placement)) continue;
    const resolution = automaticAngledWallFiller(cabinet, room, next, candidates, makeUid, styleId);
    if (!resolution) continue;
    const appended = appendCollisionFreePlacements(next, resolution.fillers, room);
    if (!resolution.fillers.every((filler) => appended.placed.some((item) => item.uid === filler.uid))) continue;
    next = appended.placed;
    added.push(...resolution.fillers);
  }
  return { placed: added.length > 0 ? next : [...placed], added };
}
