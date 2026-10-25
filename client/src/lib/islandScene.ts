import {
  COLLISION_EPSILON_IN,
  STD,
  bearsIslandCountertop,
  bearsCountertop,
  cabinetCollisionDetail,
  clampIslandToRoom,
  effectiveStyleId,
  hasCollision,
  isCounterHeightIslandWallCabinet,
  isOnIsland,
  isRangeOrOven,
  placedFootprint,
  type IslandFace,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
  type WallCabinetFitMeasure,
} from "./design";

export const ISLAND_COUNTERTOP_OVERHANG_IN = 1.5;
export const ISLAND_COUNTERTOP_OVERHANG_MAX_IN = 24;
/** The framing/pony-wall support below an upper island seating bar. */
export const ISLAND_RAISED_BAR_SUPPORT_DEPTH_IN = 4.5;

/** The user may replace the standard reveal in exact one-eighth-inch increments. */
export function islandCountertopOverhangIn(island: IslandZone): number {
  if (island.countertopOverhang == null) return ISLAND_COUNTERTOP_OVERHANG_IN;
  const configured = Number(island.countertopOverhang);
  return Number.isFinite(configured)
    ? Math.max(0, Math.min(ISLAND_COUNTERTOP_OVERHANG_MAX_IN, configured))
    : ISLAND_COUNTERTOP_OVERHANG_IN;
}

/**
 * Persisted islandFace is authoritative for current plans. Center-point
 * inference remains a fallback only for legacy plans where no cabinet has an
 * explicit face, so an oversized island zone cannot absorb room-wall cabinets.
 */
export function isIslandAssemblyMember(item: PlacedCabinet, island: IslandZone, placed: PlacedCabinet[]): boolean {
  if (item.islandFace) return true;
  // A saved island stove can predate islandFace metadata. Once a newer wall
  // cabinet adds that metadata, preserve the stove as an island member by its
  // physical island footprint so its required countertop opening is retained.
  if (isRangeOrOven(item.masterCode, item.description) && isOnIsland(item, island)) return true;
  if (placed.some((candidate) => candidate.islandFace != null)) return false;
  return isOnIsland(item, island);
}

export type CabinetFinishScope = "island" | "non-island" | "all";

function isCabinetFinishEligible(item: PlacedCabinet): boolean {
  return item.placement !== "appliance";
}

/**
 * Resolves the island's shared finish from its persisted setting first, then
 * from a uniform legacy island run. Null means the island follows the current
 * perimeter/default finish.
 */
export function resolvedIslandCabinetStyleId(
  placed: PlacedCabinet[],
  island: IslandZone | null,
  defaultStyleId: number | null,
): number | null {
  if (!island) return null;
  if (typeof island.cabinetStyleId === "number") return island.cabinetStyleId;
  const styles = new Set(
    placed
      .filter((item) => isCabinetFinishEligible(item) && isIslandAssemblyMember(item, island, placed))
      .map((item) => effectiveStyleId(item, defaultStyleId))
      .filter((styleId): styleId is number => styleId != null),
  );
  if (styles.size !== 1) return null;
  const onlyStyle = Array.from(styles)[0] ?? null;
  return onlyStyle === defaultStyleId ? null : onlyStyle;
}

/**
 * Applies one finish to exactly the requested cabinet scope. Non-island bulk
 * changes first freeze an inheriting island at its current visible finish, so
 * changing the perimeter default cannot silently recolor the island.
 */
export function applyCabinetFinishScope(
  placed: PlacedCabinet[],
  island: IslandZone | null,
  currentDefaultStyleId: number | null,
  targetStyleId: number,
  scope: CabinetFinishScope,
): {
  placed: PlacedCabinet[];
  island: IslandZone | null;
  nextDefaultStyleId: number | null;
  islandStyleId: number | null;
  changedCount: number;
} {
  const islandMemberIds = new Set(
    island
      ? placed
          .filter((item) => isCabinetFinishEligible(item) && isIslandAssemblyMember(item, island, placed))
          .map((item) => item.uid)
      : [],
  );
  const priorIslandStyleId = island
    ? resolvedIslandCabinetStyleId(placed, island, currentDefaultStyleId) ?? currentDefaultStyleId
    : null;
  const nextDefaultStyleId = scope === "island" ? currentDefaultStyleId : targetStyleId;
  const nextIslandStyleId = scope === "all"
    ? null
    : scope === "island"
      ? (targetStyleId === nextDefaultStyleId ? null : targetStyleId)
      : (priorIslandStyleId === nextDefaultStyleId ? null : priorIslandStyleId);

  const nextPlaced = placed.map((item) => {
    if (!isCabinetFinishEligible(item)) return item;
    const isIslandMember = islandMemberIds.has(item.uid);
    let nextStyleId = item.styleId ?? null;
    if (scope === "all") nextStyleId = null;
    else if (scope === "island" && isIslandMember) nextStyleId = nextIslandStyleId;
    else if (scope === "non-island" && !isIslandMember) nextStyleId = null;
    else if (scope === "non-island" && isIslandMember && effectiveStyleId(item, currentDefaultStyleId) === currentDefaultStyleId) {
      nextStyleId = nextIslandStyleId;
    }
    return nextStyleId === (item.styleId ?? null) ? item : { ...item, styleId: nextStyleId };
  });

  const changedCount = placed.reduce((count, item, index) => {
    if (!isCabinetFinishEligible(item)) return count;
    return effectiveStyleId(item, currentDefaultStyleId) === effectiveStyleId(nextPlaced[index]!, nextDefaultStyleId)
      ? count
      : count + 1;
  }, 0);

  return {
    placed: nextPlaced,
    island: island ? { ...island, cabinetStyleId: nextIslandStyleId } : null,
    nextDefaultStyleId,
    islandStyleId: nextIslandStyleId,
    changedCount,
  };
}

export function islandFaceLength(island: IslandZone, face: IslandFace): number {
  return face === "front" || face === "back" ? island.width : island.depth;
}

/** Normalize persisted clockwise plan rotation while retaining older unrotated plans. */
export function islandRotationDegrees(island: Pick<IslandZone, "rotation">): number {
  const raw = Number(island.rotation ?? 0);
  return Number.isFinite(raw) ? ((raw % 360) + 360) % 360 : 0;
}

type PlanPoint = { x: number; y: number };

function rotatePlanPoint(point: PlanPoint, center: PlanPoint, clockwiseDegrees: number): PlanPoint {
  const radians = clockwiseDegrees * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

/** The true plan-space bounds of a potentially angled island work zone. */
export function islandAssemblyBounds(island: IslandZone): { x: number; y: number; width: number; depth: number } {
  const center = { x: island.x + island.width / 2, y: island.y + island.depth / 2 };
  const rotation = islandRotationDegrees(island);
  const corners = [
    { x: island.x, y: island.y },
    { x: island.x + island.width, y: island.y },
    { x: island.x + island.width, y: island.y + island.depth },
    { x: island.x, y: island.y + island.depth },
  ].map((corner) => rotatePlanPoint(corner, center, rotation));
  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  return { x: minX, y: minY, width: maxX - minX, depth: maxY - minY };
}

export type IslandAssemblyClearance = {
  leftIn: number;
  rightIn: number;
  backIn: number;
  frontIn: number;
  nearestIn: number;
  rotationDegrees: number;
};

function rotatedPlanRectBounds(rect: { x: number; y: number; width: number; depth: number; rotation?: number }) {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.depth / 2 };
  const rotation = Number(rect.rotation ?? 0);
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.depth },
    { x: rect.x, y: rect.y + rect.depth },
  ].map((corner) => rotatePlanPoint(corner, center, rotation));
  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  return { x: minX, y: minY, width: maxX - minX, depth: maxY - minY };
}

/**
 * Measures the finished island assembly against the room, not merely the
 * unrotated work-zone rectangle. The countertop overhang and every saved island
 * cabinet participate, so the values immediately change after a 45° or 90°
 * rotation and remain truthful for seating slabs and angled cabinets.
 */
export function islandAssemblyClearance(
  island: IslandZone,
  placed: PlacedCabinet[],
  room: RoomData,
): IslandAssemblyClearance {
  const rectangles = [
    islandAssemblyBounds(island),
    ...islandCountertopRects(island, placed).map(rotatedPlanRectBounds),
    ...islandRaisedBarRects(island, placed).map(rotatedPlanRectBounds),
    ...placed
      .filter((item) => isIslandAssemblyMember(item, island, placed))
      .map((item) => {
        const footprint = placedFootprint(item);
        return { x: item.x, y: item.y, width: footprint.w, depth: footprint.d };
      }),
  ];
  const minX = Math.min(...rectangles.map((rect) => rect.x));
  const maxX = Math.max(...rectangles.map((rect) => rect.x + rect.width));
  const minY = Math.min(...rectangles.map((rect) => rect.y));
  const maxY = Math.max(...rectangles.map((rect) => rect.y + rect.depth));
  const leftIn = Math.max(0, minX);
  const rightIn = Math.max(0, room.width - maxX);
  const backIn = Math.max(0, minY);
  const frontIn = Math.max(0, room.depth - maxY);
  return {
    leftIn,
    rightIn,
    backIn,
    frontIn,
    nearestIn: Math.min(leftIn, rightIn, backIn, frontIn),
    rotationDegrees: islandRotationDegrees(island),
  };
}

function rotatePlacedAroundIslandCenter(cabinet: PlacedCabinet, island: IslandZone, clockwiseDegrees: number): PlacedCabinet {
  const before = placedFootprint(cabinet);
  const islandCenter = { x: island.x + island.width / 2, y: island.y + island.depth / 2 };
  const cabinetCenter = { x: cabinet.x + before.w / 2, y: cabinet.y + before.d / 2 };
  const nextRotation = ((Number(cabinet.rotation || 0) + clockwiseDegrees) % 360 + 360) % 360;
  const rotated = { ...cabinet, rotation: nextRotation };
  const after = placedFootprint(rotated);
  const nextCenter = rotatePlanPoint(cabinetCenter, islandCenter, clockwiseDegrees);
  return { ...rotated, x: nextCenter.x - after.w / 2, y: nextCenter.y - after.d / 2 };
}

/**
 * Measured free capacity on one physical island face. This intentionally uses
 * inferred physical faces so legacy saved plans with stale face labels cannot
 * make an occupied Front run appear available.
 */
export function islandFaceCapacity(island: IslandZone, face: IslandFace, placed: PlacedCabinet[]) {
  const length = islandFaceLength(island, face);
  const spans = placed
    .filter((item) => isIslandAssemblyMember(item, island, placed) && inferredIslandFace(item, island) === face)
    .map((item) => {
      const start = Math.max(0, islandOffsetForPlaced(item, island, face));
      const end = Math.min(length, start + Math.max(0, Number(item.width) || 0));
      return { start, end };
    })
    .filter((span) => span.end > span.start + COLLISION_EPSILON_IN)
    .sort((left, right) => left.start - right.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span.start <= previous.end + COLLISION_EPSILON_IN) previous.end = Math.max(previous.end, span.end);
    else merged.push({ ...span });
  }

  let cursor = 0;
  let largestOpenSpan = 0;
  for (const span of merged) {
    largestOpenSpan = Math.max(largestOpenSpan, Math.max(0, span.start - cursor));
    cursor = Math.max(cursor, span.end);
  }
  largestOpenSpan = Math.max(largestOpenSpan, Math.max(0, length - cursor));
  const occupiedSpan = merged.reduce((total, span) => total + Math.max(0, span.end - span.start), 0);
  return {
    length,
    occupiedSpan,
    largestOpenSpan,
    isFull: largestOpenSpan <= COLLISION_EPSILON_IN,
  };
}

export function islandFacePlacement(cabinet: PlacedCabinet, island: IslandZone, face: IslandFace, offset: number): PlacedCabinet {
  const width = Math.max(0, Number(cabinet.width) || 0);
  const depth = Math.max(0, Number(cabinet.depth) || STD.BASE_DEPTH);
  // A range may be deeper than the 24-inch base boxes beside it. Its rear edge
  // still belongs on the shared base-cabinet rear plane; only the appliance
  // front may project into the cooking aisle. Otherwise the extra depth points
  // into the island and falsely pushes an opposing shallow cabinet away.
  const rearPlaneDepth = cabinet.placement === "appliance" && isRangeOrOven(cabinet.masterCode, cabinet.description)
    ? Math.min(depth, STD.BASE_DEPTH)
    : depth;
  const along = Math.max(0, Math.min(offset, Math.max(0, islandFaceLength(island, face) - width)));
  const isCounterHeightWallFace = cabinet.placement === "wall"
    && depth <= STD.WALL_DEPTH + COLLISION_EPSILON_IN
    && Math.max(0, Number(cabinet.height) || STD.WALL_HEIGHT) <= STD.BASE_HEIGHT + COLLISION_EPSILON_IN;
  const mountBottom = isCounterHeightWallFace
    ? Math.max(0, STD.BASE_HEIGHT - Math.max(0, Number(cabinet.height) || STD.WALL_HEIGHT))
    : cabinet.mountBottomAdjusted === true && typeof cabinet.mountBottom === "number" && cabinet.mountBottom >= 0
    ? cabinet.mountBottom
    : 0;
  const local = { ...cabinet, mountBottom, islandCounterHeightWallCabinet: isCounterHeightWallFace || undefined };
  const localPlacement = face === "front"
    ? { ...local, x: island.x + along, y: island.y + island.depth - rearPlaneDepth, rotation: 0, islandFace: face, islandOffset: along }
    : face === "back"
      ? { ...local, x: island.x + along, y: island.y + rearPlaneDepth - depth, rotation: 180, islandFace: face, islandOffset: along }
      : face === "left"
        ? { ...local, x: island.x + rearPlaneDepth - depth, y: island.y + along, rotation: 90, islandFace: face, islandOffset: along }
        : { ...local, x: island.x + island.width - rearPlaneDepth, y: island.y + along, rotation: 270, islandFace: face, islandOffset: along };
  const rotation = islandRotationDegrees(island);
  return rotation === 0 ? localPlacement : rotatePlacedAroundIslandCenter(localPlacement, island, rotation);
}

/**
 * Re-seat saved island ranges authored before rear-plane alignment existed.
 * Non-island room objects and every non-range island member remain untouched.
 */
export function normalizeIslandRangeRearPlanes(island: IslandZone, placed: PlacedCabinet[], room?: RoomData): PlacedCabinet[] {
  const alignedRanges = placed.map((item) => {
    if (!isIslandAssemblyMember(item, island, placed)) return item;
    if (item.placement !== "appliance" || !isRangeOrOven(item.masterCode, item.description)) return item;
    const face = inferredIslandFace(item, island);
    const offset = islandOffsetForPlaced(item, island, face);
    const aligned = islandFacePlacement(item, island, face, offset);
    return { ...item, x: aligned.x, y: aligned.y, rotation: aligned.rotation, islandFace: face, islandOffset: aligned.islandOffset };
  });
  const alignedAssembly = alignedRanges.map((item) => {
    if (!isIslandAssemblyMember(item, island, alignedRanges) || !isCounterHeightIslandWallCabinet(item)) return item;
    const face = inferredIslandFace(item, island);
    const offset = islandOffsetForPlaced(item, island, face);
    const aligned = islandFacePlacementAgainstOpposingRun(item, island, face, offset, alignedRanges);
    return { ...item, x: aligned.x, y: aligned.y, rotation: aligned.rotation, islandFace: face, islandOffset: aligned.islandOffset };
  });

  if (!room) return alignedAssembly;
  const externalObjects = placed.filter((item) => !isIslandAssemblyMember(item, island, placed));
  const movedMembers = alignedAssembly.filter((item, index) => {
    const original = placed[index];
    return original && (Math.abs(item.x - original.x) > COLLISION_EPSILON_IN || Math.abs(item.y - original.y) > COLLISION_EPSILON_IN);
  });
  const unsafe = movedMembers.some((item) => {
    const footprint = placedFootprint(item);
    const outsideRoom = item.x < -COLLISION_EPSILON_IN
      || item.y < -COLLISION_EPSILON_IN
      || item.x + footprint.w > room.width + COLLISION_EPSILON_IN
      || item.y + footprint.d > room.depth + COLLISION_EPSILON_IN;
    return outsideRoom || hasCollision(item, externalObjects);
  });
  return unsafe ? placed : alignedAssembly;
}

function opposingIslandFace(face: IslandFace): IslandFace {
  return face === "front" ? "back" : face === "back" ? "front" : face === "left" ? "right" : "left";
}

function spansOverlap(firstStart: number, firstLength: number, secondStart: number, secondLength: number): boolean {
  return Math.min(firstStart + firstLength, secondStart + secondLength) - Math.max(firstStart, secondStart) > COLLISION_EPSILON_IN;
}

/**
 * A shallow wall cabinet used at counter height on an island must meet the
 * opposing base run back-to-back. Extra island depth is countertop/seating
 * space, not an internal void between cabinet backs.
 */
export function islandFacePlacementAgainstOpposingRun(
  cabinet: PlacedCabinet,
  island: IslandZone,
  face: IslandFace,
  offset: number,
  placed: PlacedCabinet[],
): PlacedCabinet {
  const candidate = islandFacePlacement(cabinet, island, face, offset);
  // An angled island has already been seated in its rotated physical frame.
  // Axis-aligned seam repair would pull a newly added shallow cabinet back into
  // the old rectangular frame and separate it from the rest of the island.
  if (islandRotationDegrees(island) !== 0) return candidate;
  if (!isCounterHeightIslandWallCabinet(candidate)) return candidate;

  const candidateFootprint = placedFootprint(candidate);
  const oppositeFace = opposingIslandFace(face);
  const oppositeMembers = placed.filter((item) => {
    if (item.uid === candidate.uid || !isIslandAssemblyMember(item, island, placed)) return false;
    if (inferredIslandFace(item, island) !== oppositeFace) return false;
    const footprint = placedFootprint(item);
    return face === "front" || face === "back"
      ? spansOverlap(candidate.x, candidateFootprint.w, item.x, footprint.w)
      : spansOverlap(candidate.y, candidateFootprint.d, item.y, footprint.d);
  });
  if (oppositeMembers.length === 0) return candidate;

  if (face === "front") {
    const seam = Math.max(...oppositeMembers.map((item) => item.y + placedFootprint(item).d));
    return { ...candidate, y: seam };
  }
  if (face === "back") {
    const seam = Math.min(...oppositeMembers.map((item) => item.y));
    return { ...candidate, y: seam - candidateFootprint.d };
  }
  if (face === "left") {
    const seam = Math.min(...oppositeMembers.map((item) => item.x));
    return { ...candidate, x: seam - candidateFootprint.w };
  }
  const seam = Math.max(...oppositeMembers.map((item) => item.x + placedFootprint(item).w));
  return { ...candidate, x: seam };
}

function formatCollisionInches(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function islandCollisionReason(action: "Moving" | "Resizing" | "Rotating" | "Adjusting", moving: PlacedCabinet, others: PlacedCabinet[]): string | null {
  const collision = cabinetCollisionDetail(moving, others);
  if (!collision) return null;
  const blocker = collision.cabinet.masterCode || collision.cabinet.description || "unnamed object";
  const movingLabel = moving.masterCode || moving.description || "island cabinet";
  return `${action} the island would make ${movingLabel} overlap ${blocker} by ${formatCollisionInches(collision.penetration)}\" (${formatCollisionInches(collision.overlapX)}\" × ${formatCollisionInches(collision.overlapY)}\" footprint overlap).`;
}

export function islandFaceFitMeasure(
  moving: PlacedCabinet,
  island: IslandZone,
  placed: PlacedCabinet[],
): WallCabinetFitMeasure | null {
  const face = moving.islandFace ?? null;
  if (!face) return null;
  const wallLen = islandFaceLength(island, face);
  const start = Math.max(0, islandOffsetForPlaced(moving, island, face));
  const requiredSpan = Math.max(0, Number(moving.width) || 0);
  const end = start + requiredSpan;
  const peers = placed
    .filter((item) => item.uid !== moving.uid && item.islandFace === face)
    .map((item) => ({
      item,
      start: Math.max(0, islandOffsetForPlaced(item, island, face)),
      end: Math.max(0, islandOffsetForPlaced(item, island, face)) + Math.max(0, Number(item.width) || 0),
    }))
    .sort((a, b) => a.start - b.start);
  const segments: Array<{ start: number; end: number; beforeBoundary: string; afterBoundary: string }> = [];
  let cursor = 0;
  let beforeBoundary = "island face start";
  for (const peer of peers) {
    if (peer.start > cursor + COLLISION_EPSILON_IN) {
      segments.push({ start: cursor, end: peer.start, beforeBoundary, afterBoundary: peer.item.masterCode });
    }
    if (peer.end > cursor) {
      cursor = peer.end;
      beforeBoundary = peer.item.masterCode;
    }
  }
  if (cursor < wallLen - COLLISION_EPSILON_IN) {
    segments.push({ start: cursor, end: wallLen, beforeBoundary, afterBoundary: "island face end" });
  }
  if (segments.length === 0) {
    segments.push({ start: 0, end: wallLen, beforeBoundary: "island face start", afterBoundary: "island face end" });
  }
  const distanceTo = (segment: { start: number; end: number }) => {
    if (end < segment.start) return segment.start - end;
    if (start > segment.end) return start - segment.end;
    return 0;
  };
  const selected = segments.reduce((best, segment) => distanceTo(segment) < distanceTo(best) ? segment : best, segments[0]);
  const availableStart = selected.start;
  const availableEnd = selected.end;
  const availableSpan = Math.max(0, availableEnd - availableStart);
  let leftOverlap = 0;
  let rightOverlap = 0;
  const center = (start + end) / 2;
  for (const peer of peers) {
    const overlap = Math.min(end, peer.end) - Math.max(start, peer.start);
    if (overlap <= COLLISION_EPSILON_IN) continue;
    if ((peer.start + peer.end) / 2 <= center) leftOverlap = Math.max(leftOverlap, overlap);
    else rightOverlap = Math.max(rightOverlap, overlap);
  }
  const status = leftOverlap > 0 || rightOverlap > 0
    ? "overlap"
    : availableSpan + COLLISION_EPSILON_IN < requiredSpan
      ? "insufficient"
      : "fits";
  const snapStart = availableSpan + COLLISION_EPSILON_IN >= requiredSpan
    ? Math.max(availableStart, Math.min(start, availableEnd - requiredSpan))
    : availableStart;
  const snapEnd = snapStart + requiredSpan;
  const side = face === "front" ? "bottom" : face === "back" ? "top" : face === "left" ? "left" : "right";
  return {
    side,
    layer: moving.placement,
    seated: true,
    requiredSpan,
    start,
    end,
    wallLen,
    availableStart,
    availableEnd,
    availableSpan,
    before: Math.max(0, start - availableStart),
    after: Math.max(0, availableEnd - end),
    leftOverlap,
    rightOverlap,
    shortage: Math.max(0, requiredSpan - availableSpan),
    snapStart,
    snapEnd,
    snapBefore: Math.max(0, snapStart - availableStart),
    snapAfter: Math.max(0, availableEnd - snapEnd),
    beforeBoundary: selected.beforeBoundary,
    afterBoundary: selected.afterBoundary,
    status,
  };
}

export function inferredIslandFace(cabinet: PlacedCabinet, island: IslandZone): IslandFace {
  // The saved face/offset is authoritative once the island itself is angled;
  // axis-aligned edge-distance inference cannot identify a 45-degree side.
  if (cabinet.islandFace && islandRotationDegrees(island) !== 0) return cabinet.islandFace;
  const footprint = placedFootprint(cabinet);
  const distances: Array<[IslandFace, number]> = [
    ["back", Math.abs(cabinet.y - island.y)],
    ["front", Math.abs(island.y + island.depth - (cabinet.y + footprint.d))],
    ["left", Math.abs(cabinet.x - island.x)],
    ["right", Math.abs(island.x + island.width - (cabinet.x + footprint.w))],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  const nearestFace = distances[0]?.[0] ?? "front";
  const nearestDistance = distances[0]?.[1] ?? Number.POSITIVE_INFINITY;
  const declaredFace = cabinet.islandFace ?? null;
  if (!declaredFace) return nearestFace;
  // Counter-height wall cabinets can be intentionally inset so their backs
  // touch an opposing base run. Their stored face remains authoritative even
  // when that shared seam is nearer the zone center than the exterior edge.
  if (isCounterHeightIslandWallCabinet(cabinet)) return declaredFace;

  const declaredDistance = distances.find(([face]) => face === declaredFace)?.[1] ?? Number.POSITIVE_INFINITY;
  // Older saved plans can retain an islandFace label after a cabinet was moved
  // onto another physical side of the island. Trust the persisted face only
  // when it still matches that edge; otherwise it must not reserve a run that
  // is visibly empty in the current island layout.
  return declaredDistance <= nearestDistance + 1 ? declaredFace : nearestFace;
}

export function islandOffsetForPlaced(cabinet: PlacedCabinet, island: IslandZone, face = inferredIslandFace(cabinet, island)): number {
  if (cabinet.islandFace === face && Number.isFinite(cabinet.islandOffset)) return Math.max(0, Number(cabinet.islandOffset));
  return face === "front" || face === "back" ? cabinet.x - island.x : cabinet.y - island.y;
}

export function nextIslandFacePlacement(cabinet: PlacedCabinet, island: IslandZone, face: IslandFace, placed: PlacedCabinet[]): PlacedCabinet | null {
  const runLength = Math.max(0, Number(cabinet.width) || 0);
  if (runLength <= 0 || runLength > islandFaceLength(island, face) + COLLISION_EPSILON_IN) return null;
  const occupied = placed
    // Earlier saved island plans did not persist islandFace. Infer those members
    // from their measured island position so a new cabinet (including SB36) can
    // extend the occupied face instead of being tested at a false overlapping start.
    .filter((item) => isIslandAssemblyMember(item, island, placed) && inferredIslandFace(item, island) === face)
    .map((item) => ({ start: islandOffsetForPlaced(item, island, face), end: islandOffsetForPlaced(item, island, face) + Math.max(0, Number(item.width) || 0) }))
    .sort((a, b) => a.start - b.start);
  // Same-face end points keep a run flush. Only perpendicular members expose
  // physical edges for legitimate L-shaped/end-cap configurations. An opposing
  // face shares the same run axis and must never offset a Back run away from
  // the Front run (or vice versa), which would leave a visible open island gap.
  const crossFaceEdges = placed
    .filter((item) => {
      if (!isIslandAssemblyMember(item, island, placed)) return false;
      const itemFace = inferredIslandFace(item, island);
      const faceUsesHorizontalRun = face === "front" || face === "back";
      const itemUsesHorizontalRun = itemFace === "front" || itemFace === "back";
      return faceUsesHorizontalRun !== itemUsesHorizontalRun;
    })
    .flatMap((item) => {
      const footprint = placedFootprint(item);
      return face === "front" || face === "back"
        ? [item.x - island.x, item.x + footprint.w - island.x]
        : [item.y - island.y, item.y + footprint.d - island.y];
    });
  const candidateStarts = Array.from(new Set([0, ...occupied.map((span) => span.end), ...crossFaceEdges]
    .map((value) => Math.max(0, Math.round(value * 8) / 8))))
    .sort((a, b) => a - b);
  for (const start of candidateStarts) {
    if (start + runLength > islandFaceLength(island, face) + COLLISION_EPSILON_IN) continue;
    if (occupied.some((span) => start < span.end - COLLISION_EPSILON_IN && start + runLength > span.start + COLLISION_EPSILON_IN)) continue;
    const candidate = islandFacePlacementAgainstOpposingRun(cabinet, island, face, start, placed);
    if (!hasCollision(candidate, placed)) return candidate;
  }
  return null;
}

export type IslandFaceTransferOption = {
  targetFace: IslandFace;
  moved: PlacedCabinet;
  swapped?: PlacedCabinet;
};

/**
 * Builds a collision-safe move or swap from one island face to its opposite.
 * The island zone itself is never changed, so its countertop, waterfall,
 * seating, toe-kick, and base-molding choices stay intact.
 */
export function islandFaceTransferOption(selected: PlacedCabinet, island: IslandZone, placed: PlacedCabinet[]): IslandFaceTransferOption | null {
  if (!isIslandAssemblyMember(selected, island, placed)) return null;
  const sourceFace = inferredIslandFace(selected, island);
  const targetFace: IslandFace = sourceFace === "front" ? "back" : sourceFace === "back" ? "front" : sourceFace === "left" ? "right" : "left";
  const withoutSelected = placed.filter((item) => item.uid !== selected.uid);
  const move = nextIslandFacePlacement(selected, island, targetFace, withoutSelected);
  if (move) return { targetFace, moved: move };

  const sourceOffset = islandOffsetForPlaced(selected, island, sourceFace);
  const swapCandidates = withoutSelected
    .filter((item) => isIslandAssemblyMember(item, island, placed) && inferredIslandFace(item, island) === targetFace)
    .sort((left, right) => Math.abs(islandOffsetForPlaced(left, island, targetFace) - sourceOffset) - Math.abs(islandOffsetForPlaced(right, island, targetFace) - sourceOffset));
  for (const oppositeCabinet of swapCandidates) {
    const remaining = withoutSelected.filter((item) => item.uid !== oppositeCabinet.uid);
    const moved = islandFacePlacement(selected, island, targetFace, islandOffsetForPlaced(oppositeCabinet, island, targetFace));
    const swapped = islandFacePlacement(oppositeCabinet, island, sourceFace, sourceOffset);
    if (!hasCollision(moved, [...remaining, swapped]) && !hasCollision(swapped, [...remaining, moved])) {
      return { targetFace, moved, swapped };
    }
  }
  return null;
}

export type IslandSceneEditResult =
  | { ok: true; island: IslandZone; placed: PlacedCabinet[] }
  | { ok: false; reason: string; island: IslandZone; placed: PlacedCabinet[] };

export function moveIslandScene(island: IslandZone, placed: PlacedCabinet[], room: RoomData, dx: number, dy: number): IslandSceneEditResult {
  const members = placed.filter((item) => isIslandAssemblyMember(item, island, placed));
  const memberIds = new Set(members.map((item) => item.uid));
  const others = placed.filter((item) => !memberIds.has(item.uid));
  const nextIsland = clampIslandToRoom({ ...island, x: island.x + dx, y: island.y + dy }, room)!;
  if (Math.abs(nextIsland.x - (island.x + dx)) > COLLISION_EPSILON_IN || Math.abs(nextIsland.y - (island.y + dy)) > COLLISION_EPSILON_IN) {
    return { ok: false, reason: "The island assembly would leave the room.", island, placed };
  }
  const nextBounds = islandAssemblyBounds(nextIsland);
  if (
    nextBounds.x < -COLLISION_EPSILON_IN
    || nextBounds.y < -COLLISION_EPSILON_IN
    || nextBounds.x + nextBounds.width > room.width + COLLISION_EPSILON_IN
    || nextBounds.y + nextBounds.depth > room.depth + COLLISION_EPSILON_IN
  ) {
    return { ok: false, reason: "The angled island assembly would leave the room.", island, placed };
  }
  const moved = members.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
  for (let index = 0; index < moved.length; index++) {
    const reason = islandCollisionReason("Moving", moved[index], [...others, ...moved.filter((_, otherIndex) => otherIndex !== index)]);
    if (reason) return { ok: false, reason, island, placed };
  }
  const byId = new Map(moved.map((item) => [item.uid, item]));
  return { ok: true, island: nextIsland, placed: placed.map((item) => byId.get(item.uid) ?? item) };
}

export function resizeIslandScene(island: IslandZone, placed: PlacedCabinet[], room: RoomData, width: number, depth: number): IslandSceneEditResult {
  if (islandRotationDegrees(island) !== 0) {
    if (Math.abs(width - island.width) <= COLLISION_EPSILON_IN && Math.abs(depth - island.depth) <= COLLISION_EPSILON_IN) {
      return { ok: true, island, placed };
    }
    return { ok: false, reason: "Rotate the island back to 0° before changing its measured work-zone width or depth.", island, placed };
  }
  const nextIsland = clampIslandToRoom({ ...island, width, depth }, room)!;
  if (Math.abs(nextIsland.width - width) > COLLISION_EPSILON_IN || Math.abs(nextIsland.depth - depth) > COLLISION_EPSILON_IN) {
    return { ok: false, reason: "The island size would leave the room.", island, placed };
  }
  const members = placed.filter((item) => isIslandAssemblyMember(item, island, placed));
  const memberIds = new Set(members.map((item) => item.uid));
  const others = placed.filter((item) => !memberIds.has(item.uid));
  if (members.some((item) => {
    const face = inferredIslandFace(item, island);
    return islandOffsetForPlaced(item, island, face) + Math.max(0, Number(item.width) || 0) > islandFaceLength(nextIsland, face) + COLLISION_EPSILON_IN;
  })) {
    return { ok: false, reason: "The resized island face is too short for its cabinets.", island, placed };
  }
  const edgePlaced = members.map((item) => islandFacePlacement(item, nextIsland, inferredIslandFace(item, island), islandOffsetForPlaced(item, island)));
  const rebuilt = edgePlaced.map((item) => islandFacePlacementAgainstOpposingRun(item, nextIsland, inferredIslandFace(item, nextIsland), islandOffsetForPlaced(item, nextIsland), edgePlaced));
  for (let index = 0; index < rebuilt.length; index++) {
    const reason = islandCollisionReason("Resizing", rebuilt[index], [...others, ...rebuilt.filter((_, otherIndex) => otherIndex !== index)]);
    if (reason) return { ok: false, reason, island, placed };
  }
  const byId = new Map(rebuilt.map((item) => [item.uid, item]));
  return { ok: true, island: nextIsland, placed: placed.map((item) => byId.get(item.uid) ?? item) };
}

/**
 * Grows an island only toward its Back side for an incoming Back-face cabinet.
 * Existing Front cabinet faces stay visually fixed, while all current island
 * members are rebuilt against the expanded work zone and checked for collisions.
 */
export function autoAdjustIslandDepthForBackFace(island: IslandZone, placed: PlacedCabinet[], room: RoomData, incomingBackDepth: number): IslandSceneEditResult {
  const members = placed.filter((item) => isIslandAssemblyMember(item, island, placed));
  const frontDepth = members
    .filter((item) => inferredIslandFace(item, island) === "front")
    .reduce((largest, item) => Math.max(largest, Math.max(0, Number(item.depth) || 0)), 0);
  const onlyFrontMembers = members.every((item) => inferredIslandFace(item, island) === "front");
  const exactRequiredDepth = Math.max(12, frontDepth + Math.max(0, incomingBackDepth));
  const requiredDepth = onlyFrontMembers ? exactRequiredDepth : Math.max(island.depth, exactRequiredDepth);
  if (Math.abs(requiredDepth - island.depth) <= COLLISION_EPSILON_IN) return { ok: true, island, placed };

  const depthDelta = requiredDepth - island.depth;
  const requested = {
    ...island,
    y: island.y - depthDelta,
    depth: requiredDepth,
    // A zone-anchored explicit slab expands only toward the Back with the new
    // work zone, retaining its original Front edge and user-selected offset.
    countertopDepth: depthDelta > 0 && island.countertopDepth != null && island.countertopDepthAnchoredToZone === true
      ? island.countertopDepth + depthDelta
      : island.countertopDepth,
  };
  const nextIsland = clampIslandToRoom(requested, room)!;
  if (Math.abs(nextIsland.y - requested.y) > COLLISION_EPSILON_IN || Math.abs(nextIsland.depth - requiredDepth) > COLLISION_EPSILON_IN) {
    return { ok: false, reason: `The island cannot grow to ${requiredDepth}\" deep toward the Back side without leaving the room.`, island, placed };
  }

  const memberIds = new Set(members.map((item) => item.uid));
  const others = placed.filter((item) => !memberIds.has(item.uid));
  const edgePlaced = members.map((item) => {
    const face = inferredIslandFace(item, island);
    return islandFacePlacement(item, nextIsland, face, islandOffsetForPlaced(item, island, face));
  });
  const rebuilt = edgePlaced.map((item) => islandFacePlacementAgainstOpposingRun(item, nextIsland, inferredIslandFace(item, nextIsland), islandOffsetForPlaced(item, nextIsland), edgePlaced));
  for (let index = 0; index < rebuilt.length; index++) {
    const reason = islandCollisionReason("Adjusting", rebuilt[index], [...others, ...rebuilt.filter((_, otherIndex) => otherIndex !== index)]);
    if (reason) return { ok: false, reason, island, placed };
  }

  const byId = new Map(rebuilt.map((item) => [item.uid, item]));
  return { ok: true, island: nextIsland, placed: placed.map((item) => byId.get(item.uid) ?? item) };
}

export function rotateIslandScene(
  island: IslandZone,
  placed: PlacedCabinet[],
  room: RoomData,
  clockwiseDegrees: 45 | 90 = 90,
): IslandSceneEditResult {
  const currentRotation = islandRotationDegrees(island);
  const targetRotation = (currentRotation + clockwiseDegrees) % 360;
  // Keep the local island zone dimensions and face labels stable. The complete
  // cabinet/slab group is rotated around its center, so a 36-inch by 48-inch
  // island remains that exact measured assembly at 45° as well as at 90°.
  const nextIsland: IslandZone = { ...island, rotation: targetRotation };
  const bounds = islandAssemblyBounds(nextIsland);
  if (
    bounds.x < -COLLISION_EPSILON_IN
    || bounds.y < -COLLISION_EPSILON_IN
    || bounds.x + bounds.width > room.width + COLLISION_EPSILON_IN
    || bounds.y + bounds.depth > room.depth + COLLISION_EPSILON_IN
  ) {
    return { ok: false, reason: "The rotated island assembly would leave the room.", island, placed };
  }
  const members = placed.filter((item) => isIslandAssemblyMember(item, island, placed));
  const memberIds = new Set(members.map((item) => item.uid));
  const others = placed.filter((item) => !memberIds.has(item.uid));
  const rotated = members.map((item) => rotatePlacedAroundIslandCenter(item, island, clockwiseDegrees));
  for (let index = 0; index < rotated.length; index++) {
    const reason = islandCollisionReason("Rotating", rotated[index], [...others, ...rotated.filter((_, otherIndex) => otherIndex !== index)]);
    if (reason) return { ok: false, reason, island, placed };
  }
  const byId = new Map(rotated.map((item) => [item.uid, item]));
  return { ok: true, island: nextIsland, placed: placed.map((item) => byId.get(item.uid) ?? item) };
}

export type IslandCountertopRect = { x: number; y: number; width: number; depth: number; rotation?: number };
/** Legacy 10-inch plans stay intact; new seating choices start at 12 inches. */
export type IslandSeatingOverhangIn = 10 | 12 | 15;

function unrotatePlacedFromIslandCenter(cabinet: PlacedCabinet, island: IslandZone, clockwiseDegrees: number): PlacedCabinet {
  const before = placedFootprint(cabinet);
  const islandCenter = { x: island.x + island.width / 2, y: island.y + island.depth / 2 };
  const cabinetCenter = { x: cabinet.x + before.w / 2, y: cabinet.y + before.d / 2 };
  const nextRotation = ((Number(cabinet.rotation || 0) - clockwiseDegrees) % 360 + 360) % 360;
  const unrotated = { ...cabinet, rotation: nextRotation };
  const after = placedFootprint(unrotated);
  const nextCenter = rotatePlanPoint(cabinetCenter, islandCenter, -clockwiseDegrees);
  return { ...unrotated, x: nextCenter.x - after.w / 2, y: nextCenter.y - after.d / 2 };
}

function orientIslandCountertopRect(rect: IslandCountertopRect, island: IslandZone, clockwiseDegrees: number): IslandCountertopRect {
  if (clockwiseDegrees === 0) return rect;
  const center = rotatePlanPoint(
    { x: rect.x + rect.width / 2, y: rect.y + rect.depth / 2 },
    { x: island.x + island.width / 2, y: island.y + island.depth / 2 },
    clockwiseDegrees,
  );
  return { ...rect, x: center.x - rect.width / 2, y: center.y - rect.depth / 2, rotation: clockwiseDegrees };
}

function islandCountertopSupportBounds(supports: PlacedCabinet[]): IslandCountertopRect | null {
  if (supports.length === 0) return null;
  const footprints = supports.map((item) => ({ item, footprint: placedFootprint(item) }));
  const minX = Math.min(...footprints.map(({ item }) => item.x));
  const minY = Math.min(...footprints.map(({ item }) => item.y));
  const maxX = Math.max(...footprints.map(({ item, footprint }) => item.x + footprint.w));
  const maxY = Math.max(...footprints.map(({ item, footprint }) => item.y + footprint.d));
  return { x: minX, y: minY, width: maxX - minX, depth: maxY - minY };
}

function countertopSupportsConnect(first: PlacedCabinet, second: PlacedCabinet): boolean {
  const a = placedFootprint(first);
  const b = placedFootprint(second);
  const gapX = Math.max(first.x - (second.x + b.w), second.x - (first.x + a.w), 0);
  const gapY = Math.max(first.y - (second.y + b.d), second.y - (first.y + a.d), 0);
  return gapX <= COLLISION_EPSILON_IN && gapY <= COLLISION_EPSILON_IN;
}

/**
 * Automatic island slabs follow connected cabinet support groups. This prevents
 * an empty plan-space gap from being hidden by one unsupported counter bridge.
 * A user-entered custom slab remains one intentional physical slab.
 */
export function islandCountertopRects(island: IslandZone, placed: PlacedCabinet[]): IslandCountertopRect[] {
  const rotation = islandRotationDegrees(island);
  const localIsland = rotation === 0 ? island : { ...island, rotation: 0 };
  const localPlaced = rotation === 0
    ? placed
    : placed.map((item) => isIslandAssemblyMember(item, island, placed)
      ? unrotatePlacedFromIslandCenter(item, island, rotation)
      : item);
  const supports = localPlaced.filter((item) => isIslandAssemblyMember(item, localIsland, localPlaced) && bearsIslandCountertop(item));
  const allBounds = islandCountertopSupportBounds(supports);
  if (!allBounds) return [];
  const overhang = islandCountertopOverhangIn(localIsland);
  const hasIntentionalSlab = localIsland.countertopWidth != null || localIsland.countertopDepth != null;
  if (hasIntentionalSlab) {
    const autoWidth = allBounds.width + overhang * 2;
    const autoDepth = allBounds.depth + overhang * 2;
    const width = localIsland.countertopWidth ?? autoWidth;
    const depth = localIsland.countertopDepth ?? autoDepth;
    const supportCenterX = allBounds.x + allBounds.width / 2;
    const supportCenterY = allBounds.y + allBounds.depth / 2;
    const centerX = (localIsland.countertopWidthAnchoredToZone ? localIsland.x + localIsland.width / 2 : supportCenterX) + Number(localIsland.countertopOffsetX ?? 0);
    const centerY = (localIsland.countertopDepthAnchoredToZone ? localIsland.y + localIsland.depth / 2 : supportCenterY) + Number(localIsland.countertopOffsetY ?? 0);
    return [orientIslandCountertopRect({ x: centerX - width / 2, y: centerY - depth / 2, width, depth }, island, rotation)];
  }
  const groups: PlacedCabinet[][] = [];
  const remaining = [...supports];
  while (remaining.length > 0) {
    const group = [remaining.shift()!];
    for (let index = 0; index < group.length; index++) {
      for (let candidate = remaining.length - 1; candidate >= 0; candidate--) {
        if (countertopSupportsConnect(group[index], remaining[candidate])) {
          group.push(remaining[candidate]);
          remaining.splice(candidate, 1);
        }
      }
    }
    groups.push(group);
  }
  return groups.flatMap((group) => {
    const bounds = islandCountertopSupportBounds(group);
    return bounds ? [orientIslandCountertopRect({
      x: bounds.x - overhang,
      y: bounds.y - overhang,
      width: bounds.width + overhang * 2,
      depth: bounds.depth + overhang * 2,
    }, island, rotation)] : [];
  });
}

/** Countertop openings occupied by island ranges are not supported slab area. */
export function islandRangeCountertopCutouts(island: IslandZone, placed: PlacedCabinet[]): IslandCountertopRect[] {
  return placed.flatMap((item) => {
    if (!isIslandAssemblyMember(item, island, placed)) return [];
    // Older drafts can retain a stove in the base layer. Classification—not the
    // stale layer—owns the physical countertop opening.
    if (!isRangeOrOven(item.masterCode, item.description)) return [];
    const footprint = placedFootprint(item);
    return [{ x: item.x, y: item.y, width: footprint.w, depth: footprint.d }];
  });
}

function subtractIslandCountertopRect(
  slab: IslandCountertopRect,
  cutout: IslandCountertopRect,
): IslandCountertopRect[] {
  const overlapLeft = Math.max(slab.x, cutout.x);
  const overlapRight = Math.min(slab.x + slab.width, cutout.x + cutout.width);
  const overlapBack = Math.max(slab.y, cutout.y);
  const overlapFront = Math.min(slab.y + slab.depth, cutout.y + cutout.depth);
  if (overlapRight - overlapLeft <= COLLISION_EPSILON_IN || overlapFront - overlapBack <= COLLISION_EPSILON_IN) return [slab];

  const fragments: IslandCountertopRect[] = [
    { x: slab.x, y: slab.y, width: slab.width, depth: overlapBack - slab.y },
    { x: slab.x, y: overlapFront, width: slab.width, depth: slab.y + slab.depth - overlapFront },
    { x: slab.x, y: overlapBack, width: overlapLeft - slab.x, depth: overlapFront - overlapBack },
    { x: overlapRight, y: overlapBack, width: slab.x + slab.width - overlapRight, depth: overlapFront - overlapBack },
  ];
  return fragments.filter((fragment) => fragment.width > COLLISION_EPSILON_IN && fragment.depth > COLLISION_EPSILON_IN);
}

/**
 * Rendered and priced island countertop fragments. The outer slab still drives
 * waterfall ends, but a range footprint is a true opening rather than an
 * unsupported slab drawn over the appliance.
 */
export function islandCountertopVisibleRects(island: IslandZone, placed: PlacedCabinet[]): IslandCountertopRect[] {
  const cutouts = islandRangeCountertopCutouts(island, placed);
  return islandCountertopRects(island, placed).flatMap((slab) =>
    cutouts.reduce<IslandCountertopRect[]>(
      (fragments, cutout) => fragments.flatMap((fragment) => subtractIslandCountertopRect(fragment, cutout)),
      [slab],
    ),
  );
}

/**
 * Returns a separate 42-inch seating bar behind (or on the chosen side of) an
 * island's counter-height worktop. The lower worktop is never stretched to make
 * this happen: each returned rectangle is a new physical top, measured for the
 * fabricator and rendered at its own height.
 */
export function islandRaisedBarRects(island: IslandZone, placed: PlacedCabinet[]): IslandCountertopRect[] {
  if (!island.raisedBar) return [];
  const side = island.raisedBarSide ?? "back";
  const overhang = island.raisedBarOverhang === 15 ? 15 : 12;
  const barDepth = ISLAND_RAISED_BAR_SUPPORT_DEPTH_IN + overhang;
  // A cooktop cuts only the flat worktop. The raised seating bar is supported
  // by the continuous base run and must remain one uninterrupted strip behind
  // the cooktop bay.
  return islandCountertopRects(island, placed).map((slab) => {
    const radians = ((Number(slab.rotation ?? 0) || 0) * Math.PI) / 180;
    const local = side === "back"
      ? { x: 0, y: -(slab.depth / 2 + barDepth / 2), width: slab.width, depth: barDepth }
      : side === "front"
        ? { x: 0, y: slab.depth / 2 + barDepth / 2, width: slab.width, depth: barDepth }
        : side === "left"
          ? { x: -(slab.width / 2 + barDepth / 2), y: 0, width: barDepth, depth: slab.depth }
          : { x: slab.width / 2 + barDepth / 2, y: 0, width: barDepth, depth: slab.depth };
    const centerX = slab.x + slab.width / 2 + local.x * Math.cos(radians) - local.y * Math.sin(radians);
    const centerY = slab.y + slab.depth / 2 + local.x * Math.sin(radians) + local.y * Math.cos(radians);
    return {
      x: centerX - local.width / 2,
      y: centerY - local.depth / 2,
      width: local.width,
      depth: local.depth,
      rotation: slab.rotation,
    };
  });
}

/** Legacy single-slab measurement used by the 2D island attribute interface. */
export function islandCountertopRect(island: IslandZone, placed: PlacedCabinet[]): IslandCountertopRect | null {
  const slabs = islandCountertopRects(island, placed);
  if (slabs.length === 1) return slabs[0];
  const supports = placed.filter((item) => isIslandAssemblyMember(item, island, placed) && bearsIslandCountertop(item));
  const bounds = islandCountertopSupportBounds(supports);
  const overhang = islandCountertopOverhangIn(island);
  return bounds ? {
    x: bounds.x - overhang,
    y: bounds.y - overhang,
    width: bounds.width + overhang * 2,
    depth: bounds.depth + overhang * 2,
  } : null;
}

/**
 * Reset only custom slab dimensions when the counter-bearing island cabinet
 * set changes. The next render then measures the current supports directly,
 * so countertop coverage grows with a new cabinet and disappears over a
 * deleted cabinet. Product, standard overhang, waterfall, and finish remain
 * island treatments and are intentionally preserved.
 */
export function synchronizeIslandCountertopFootprint(
  island: IslandZone,
  before: PlacedCabinet[],
  after: PlacedCabinet[],
): IslandZone {
  const beforeSupports = before.filter((item) => isIslandAssemblyMember(item, island, before) && bearsIslandCountertop(item));
  const afterSupports = after.filter((item) => isIslandAssemblyMember(item, island, after) && bearsIslandCountertop(item));
  const beforeIds = beforeSupports.map((item) => item.uid).sort();
  const afterIds = afterSupports.map((item) => item.uid).sort();
  if (beforeIds.length === afterIds.length && beforeIds.every((uid, index) => uid === afterIds[index])) return island;

  return {
    ...island,
    countertopWidth: null,
    countertopDepth: null,
    countertopOffsetX: 0,
    countertopOffsetY: 0,
    countertopWidthAnchoredToZone: false,
    countertopDepthAnchoredToZone: false,
  };
}

/** Backwards-compatible deletion alias for existing consumers. */
export function islandAfterCountertopSupportRemoval(
  island: IslandZone,
  before: PlacedCabinet[],
  after: PlacedCabinet[],
): IslandZone {
  return synchronizeIslandCountertopFootprint(island, before, after);
}

/**
 * Create one intentional island slab with seating projection on a selected
 * face. The stated 10- or 12-inch value is measured from that cabinet face;
 * the normal 1.5-inch reveal is retained on the other exposed slab edges.
 */
export function islandWithFaceSeatingOverhang(
  island: IslandZone,
  placed: PlacedCabinet[],
  face: IslandFace,
  overhangIn: IslandSeatingOverhangIn,
): IslandZone {
  const supports = placed.filter((item) => isIslandAssemblyMember(item, island, placed) && bearsIslandCountertop(item));
  const bounds = islandCountertopSupportBounds(supports);
  if (!bounds) return island;
  const standardOverhang = islandCountertopOverhangIn(island);
  const extra = overhangIn - standardOverhang;
  if (face === "front") return {
    ...island,
    countertopWidth: bounds.width + standardOverhang * 2,
    countertopDepth: bounds.depth + standardOverhang + overhangIn,
    countertopOffsetX: 0,
    countertopOffsetY: extra / 2,
    countertopWidthAnchoredToZone: false,
    countertopDepthAnchoredToZone: false,
  };
  if (face === "back") return {
    ...island,
    countertopWidth: bounds.width + standardOverhang * 2,
    countertopDepth: bounds.depth + standardOverhang + overhangIn,
    countertopOffsetX: 0,
    countertopOffsetY: -extra / 2,
    countertopWidthAnchoredToZone: false,
    countertopDepthAnchoredToZone: false,
  };
  if (face === "left") return {
    ...island,
    countertopWidth: bounds.width + standardOverhang + overhangIn,
    countertopDepth: bounds.depth + standardOverhang * 2,
    countertopOffsetX: -extra / 2,
    countertopOffsetY: 0,
    countertopWidthAnchoredToZone: false,
    countertopDepthAnchoredToZone: false,
  };
  return {
    ...island,
    countertopWidth: bounds.width + standardOverhang + overhangIn,
    countertopDepth: bounds.depth + standardOverhang * 2,
    countertopOffsetX: extra / 2,
    countertopOffsetY: 0,
    countertopWidthAnchoredToZone: false,
    countertopDepthAnchoredToZone: false,
  };
}
