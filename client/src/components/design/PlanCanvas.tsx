import { doorOpeningAppearance, roomDoorSwing, supportsRoomDoorSwing } from "@/lib/doorOpeningAppearance";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Fragment } from "react";
import {
  PlacedCabinet, RoomData, rotatedSize, placedFootprint, placedCornerGeometryKind, cabinetCornerPlacementInfo, blindCornerSnapInfo, cabinetPlacementCollisionDetail, nextAvailableRoomCornerPlacement, snapPosition, orientToWall,
  type FloorPlanDimensionAdjustment, type FloorPlanDimensionUnit,
	  isCornerCabinet, isProtectedCornerCabinet, cornerClipPath, cornerLegRatioForPlaced, cornerRotationForPlaced, diagonalCornerClipPath, isDiagonalCorner, isAngledWallCabinet, formatEighthInches, formatInches, isBlindCorner, isTriangleCorner, triangleCornerClipPath,
	  resolveSwing, resolveCabinetHardwarePosition,
	  WallOpening, clampOpening, FinishColors, DEFAULT_FINISH_COLORS, isWindowBelowCountertop,
  clampRoomInches, inchesToFeetInches, WallSide, type PeninsulaRun, peninsulaRunEndpoints, peninsulaRunMaxLength, peninsulaRunHitAtPoint, peninsulaRunStartOffsetAtPoint, peninsulaRunAssemblyLocked, peninsulaRootRunId,
	  cabinetWall, wallSpanMeasure, wallRunFrame, wallRunDistanceToPoint, peninsulaRunById, continuousWallApplianceSnapInfo, configuredRefrigeratorAssemblyMembers, customWallCabinetSide,
	  countertopSurfaces, countertopMaterial, potFillerMountedRange, type CountertopSurface, type PotFillerFixture, type SinkFixture, SINK_PRESETS,
  wallGaps, freeSegmentsOnWall, wallGapFitPreview, wallGapFreehandPreview, nearestRectRoomWallAtPoint, nearestWallRunAtPoint, cabinetWallMovePreview, refrigeratorMagneticSnapEnvelope, CABINET_CONFLICT_LOCK_IN, BLIND_CORNER_FILLER_WIDTH_IN, STD, WALL_OPENING_CLEARANCE_IN, resolvedDesignCabinetDimensions, cabinetPlacementHoverDetail, bestFitCatalogOption, smartGapCatalogOptions, smartGapRecommendation, type WallGap, type WallGapFitPreview,
  type DesignCabinet,
  type PlacedFurniture, FURNITURE_CATALOG, furnitureFootprint,
  flooringMaterial,
  type PlanAnnotation,
  cabinetWallRunSegment, retainedWallSegmentForSplit, floorPlanWallDimensionChains, roomWallRunFrames, isFillerItem, fillerWidthRange,
		  type PonyWall, clampPonyWall, ponyWallMiteredFootprint, ponyWallPlanFrame, drywallPonyWallAppearance, drywallPonyWallPreviewBackground,
	  type IslandZone, type IslandFace,
	} from "@/lib/design";
import { furniturePlanFrame } from "@/lib/design";
import { CheckCircle2, Compass, Eye, EyeOff, Maximize2, Minus, PanelTop, Plus, RotateCw, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cabinetDrawingType, isSquareDoubleDoorBaseEnd } from "@/lib/cabinetGraphics";
import { catalogFillerSuggestion, type CatalogFillerCandidate } from "@/lib/catalogFiller";
import { angledWallTransitionFootprint } from "@/lib/angledWallFiller";
import { islandCountertopVisibleRects, islandFaceCapacity, islandRaisedBarRects } from "@/lib/islandScene";
import { miteredWallOutlinesFromInteriorFaces, ROOM_WALL_THICKNESS_IN } from "@/lib/polygonRoom";
import { crownTopRuns, formatCrownTop } from "@/lib/crownTopRuns";
import { verifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";
import type { BathroomZoneOverlapWarning } from "@/lib/bathroomPlanning";
import type { FourAnchorWallGuide } from "@/lib/fourAnchorAutoBuild";

export type PlanCabinetRenderFrame = {
  lockedAngledRun: boolean;
  bodyW: number;
  bodyD: number;
  bodyLeft: number;
  bodyTop: number;
};

/**
 * Saved cabinet coordinates are the bounding-box origin of the fully rotated
 * physical body. CSS rotation, however, works from an unrotated body rectangle.
 * Recover that rectangle's center so an ERB36 on a 45-degree measured wall has
 * its actual rear corner exactly on the selected shared vertex in plan view.
 */
export function planCabinetRenderFrame(p: PlacedCabinet): PlanCabinetRenderFrame {
  const footprint = placedFootprint(p);
  const normalizedRotation = ((Math.round(p.rotation) % 360) + 360) % 360;
  const lockedAngledRun = Boolean(p.wallId && p.wallOffset != null && [45, 135, 225, 315].includes(normalizedRotation));
  if (!lockedAngledRun) {
    return { lockedAngledRun: false, bodyW: footprint.w, bodyD: footprint.d, bodyLeft: p.x, bodyTop: p.y };
  }
  const cornerKind = placedCornerGeometryKind(p);
  // Use nominal rectangular dimensions for a straight cabinet, but preserve the
  // full square physical envelope for ERB/L/diagonal corner products.
  const bodyW = cornerKind === "standard" ? Math.max(0.01, p.width) : footprint.w;
  const bodyD = cornerKind === "standard" ? Math.max(0.01, p.depth) : footprint.d;
  const radians = normalizedRotation * Math.PI / 180;
  const boundW = Math.abs(bodyW * Math.cos(radians)) + Math.abs(bodyD * Math.sin(radians));
  const boundD = Math.abs(bodyW * Math.sin(radians)) + Math.abs(bodyD * Math.cos(radians));
  return {
    lockedAngledRun: true,
    bodyW,
    bodyD,
    bodyLeft: p.x + (boundW - bodyW) / 2,
    bodyTop: p.y + (boundD - bodyD) / 2,
  };
}

export type PlanMeasurePoint = { x: number; y: number };

/** A quarter-inch increment keeps the on-screen tape precise without visual jitter. */
export const TAPE_MEASURE_INCREMENT_IN = 0.25;

export function snapPlanMeasurePoint(
  point: PlanMeasurePoint,
  room: Pick<RoomData, "width" | "depth">,
): PlanMeasurePoint {
  const snap = (value: number, maximum: number) =>
    Math.max(0, Math.min(maximum, Math.round(value / TAPE_MEASURE_INCREMENT_IN) * TAPE_MEASURE_INCREMENT_IN));
  return { x: snap(point.x, room.width), y: snap(point.y, room.depth) };
}

export function planTapeMeasure(a: PlanMeasurePoint, b: PlanMeasurePoint) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return { dx, dy, distance: Math.hypot(dx, dy) };
}

/**
 * A catalog drop must recognize either usable face of a peninsula wall, not
 * only its zero-thickness center line. A range held against the inside cabinet
 * face otherwise resolves to a nearby exterior room wall and crosses through
 * the peninsula. The touch target remains available, with the shared wall
 * magnet extended by the physical cabinet half-depth.
 */
export function peninsulaCatalogDropHitRadiusIn(depthIn: number, ppi: number): number {
  return Math.max(10, 40 / Math.max(0.1, ppi), Math.max(0, Number(depthIn) || 0) / 2 + STD.SNAP_THRESHOLD);
}

/** Rotate a wall-size bubble with its run while keeping the text right-side up. */
export function parallelWallLabelAngleDeg(dx: number, dy: number): number {
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return Math.round(angle * 1000) / 1000;
}

export type PlanOpeningWallFrame = {
  centerX: number;
  centerY: number;
  tangentX: number;
  tangentY: number;
  angleDeg: number;
  wallLength: number;
};

/**
 * Resolves a door/window against the same explicit wall segment used by
 * cabinet placement. The rectangular room bounds are only a drawing viewport
 * for Continuous Wall Builder rooms and must never become a substitute wall.
 */
export function planOpeningWallFrame(opening: WallOpening, room: RoomData): PlanOpeningWallFrame | null {
  const wall = room.customWalls?.find((candidate) => candidate.id === opening.side);
  const start = wall && room.vertices?.find((vertex) => vertex.id === wall.startVertexId);
  const end = wall && room.vertices?.find((vertex) => vertex.id === wall.endVertexId);
  if (!wall || !start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const wallLength = Math.hypot(dx, dy);
  if (wallLength <= 0.001) return null;
  const tangentX = dx / wallLength;
  const tangentY = dy / wallLength;
  const centerOffset = Math.max(0, Math.min(wallLength, opening.offset + opening.width / 2));
  return {
    centerX: start.x + tangentX * centerOffset,
    centerY: start.y + tangentY * centerOffset,
    tangentX,
    tangentY,
    angleDeg: Math.atan2(dy, dx) * 180 / Math.PI,
    wallLength,
  };
}

export function nearestIslandFaceInRect(
  point: { x: number; y: number },
  rect: { width: number; height: number },
): IslandFace {
  const distances: Array<[IslandFace, number]> = [
    ["left", Math.max(0, point.x)],
    ["right", Math.max(0, rect.width - point.x)],
    ["back", Math.max(0, point.y)],
    ["front", Math.max(0, rect.height - point.y)],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0]![0];
}

/** Resolve the Plan marker from the same saved-hardware compatibility rule as 3D. */
export function planCabinetHardwarePosition(cabinet: PlacedCabinet) {
  const swing = resolveSwing(cabinet);
  if (swing !== "left" && swing !== "right") return null;
  const hardwarePosition = resolveCabinetHardwarePosition(cabinet);
  return hardwarePosition === "auto"
    ? (swing === "left" ? "right" : "left")
    : hardwarePosition;
}

function formatSixteenthInches(inches: number): string {
  const measured = Math.max(0, Number.isFinite(inches) ? inches : 0);
  const sixteenths = Math.round(measured * 16);
  const whole = Math.floor(sixteenths / 16);
  const remainder = sixteenths % 16;
  const divisor = remainder === 0 ? 1 : remainder % 8 === 0 ? 2 : remainder % 4 === 0 ? 4 : remainder % 2 === 0 ? 8 : 16;
  const numerator = remainder === 0 ? 0 : remainder / (16 / divisor);
  const fraction = numerator > 0 ? `${numerator}/${divisor}` : "";
  return `${whole || !fraction ? whole : ""}${whole && fraction ? " " : ""}${fraction}\"`;
}

/**
 * Floor Plan geometry stays in inches. This converts only the annotation text,
 * allowing the same shared placement engine to be read in either unit system.
 */
export function formatFloorPlanDimension(inches: number, unitSystem: FloorPlanDimensionUnit = "imperial"): string {
  if (unitSystem === "metric") {
    const millimeters = Math.max(0, Math.round((Number.isFinite(inches) ? inches : 0) * 25.4));
    return `${millimeters} mm`;
  }
  return formatSixteenthInches(inches);
}

export type FloorPlanAvailableCabinetSpan = {
  side: WallSide;
  layer: "base" | "wall";
  start: number;
  length: number;
};

/**
 * Placement-aware red callouts for the Floor Plan. Their spans come from the
 * exact free-segment source used by catalog placement, including opening,
 * corner, tall-cabinet, and layer constraints. A displayed fit is never merely
 * a visual gap in the drafting rail.
 */
export function floorPlanAvailableCabinetSpans(
  room: RoomData,
  cabinets: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  includeWallLayer: boolean,
): FloorPlanAvailableCabinetSpan[] {
  const spans: FloorPlanAvailableCabinetSpan[] = [];
  const layers = includeWallLayer ? (["base", "wall"] as const) : (["base"] as const);
  for (const frame of roomWallRunFrames(room).filter((candidate) => candidate.kind !== "peninsula")) {
    for (const layer of layers) {
      const openingClearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
      for (const segment of freeSegmentsOnWall(
        frame.id as WallSide,
        room,
        [...cabinets],
        [...openings],
        0.125,
        openingClearance,
        layer,
      )) {
        spans.push({ side: frame.id as WallSide, layer, start: segment.start, length: segment.length });
      }
    }
  }
  return spans;
}

/** View-only Floor Plan zoom boundaries. Geometry, measurements, and saved cabinet coordinates stay in inches. */
export const FLOOR_PLAN_ZOOM_MIN = 0.5;
export const FLOOR_PLAN_ZOOM_MAX = 3;
export const FLOOR_PLAN_ZOOM_STEP = 0.25;

export function clampFloorPlanZoom(value: number): number {
  const finite = Number.isFinite(value) ? value : 1;
  return Math.round(Math.max(FLOOR_PLAN_ZOOM_MIN, Math.min(FLOOR_PLAN_ZOOM_MAX, finite)) * 100) / 100;
}

/** Exact installed dimensions for either half of one purchased split filler. */
export function splitFillerDimensionTooltip(cabinet: PlacedCabinet): string | null {
  if (!cabinet.fillerPieceGroupId || cabinet.fillerPlacementMode !== "split") return null;
  const pieceWidth = Math.max(0, Number(cabinet.width) || 0);
  const storedTotal = Number(cabinet.fillerTotalWidth);
  const totalWidth = Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : pieceWidth * 2;
  const depth = Math.max(0, Number(cabinet.depth) || 0);
  const height = Math.max(0, Number(cabinet.height) || 0);
  if (pieceWidth <= 0 || totalWidth <= 0 || depth <= 0 || height <= 0) return null;
  const adjoiningWidth = Math.max(0, totalWidth - pieceWidth);
  return `Split filler gap: ${formatSixteenthInches(totalWidth)} total. This half: ${formatSixteenthInches(pieceWidth)} wide × ${formatSixteenthInches(depth)} deep × ${formatSixteenthInches(height)} high. Adjoining half: ${formatSixteenthInches(adjoiningWidth)} wide.`;
}

export function planCornerGeometry(cabinet: PlacedCabinet) {
  // Existing placements copy the current Cabinet Config graphic rule into
  // customProfile. Use it when resolving BA/BEC so a saved base end cabinet
  // cannot fall back to a stale standard/triangle plan footprint.
  const drawingType = cabinetDrawingType({ ...cabinet, graphicType: cabinet.customProfile ?? null });
  const isEndAngle = drawingType === "end-angle";
  const isEndReturn = drawingType === "end-return";
  // Older BEC24 placements can retain triangle/angled Config flags. The exact
  // square end-of-run identity must not acquire a corner clip or 45° marker.
  const isEndCabinet = isEndAngle || isEndReturn || isSquareDoubleDoorBaseEnd(cabinet);
  const configuredCorner = isEndCabinet ? null : cabinet.cornerType ?? null;
  const sharedKind = placedCornerGeometryKind(cabinet);
  const isCorner = !isEndCabinet && (configuredCorner !== null || isCornerCabinet(cabinet.masterCode, cabinet.description));
  const isTriangle = !isEndCabinet && sharedKind === "triangle";
  const isDiagonal = !isEndCabinet && sharedKind === "diagonal";
  const isBlind = !isEndCabinet && sharedKind === "blind-corner";
  const isConfiguredL = !isEndCabinet && (sharedKind === "l-shape" || sharedKind === "corner-drawer");
  return { isEndAngle, isEndReturn, isCorner, isTriangle, isDiagonal, isBlind, isConfiguredL };
}

/**
 * The visible plan outline must follow the same saved-cabinet classifier as the
 * plan footprint and 3D conversion. Keeping the render value here makes a
 * diagonal WDC impossible to silently fall back to a square box.
 */
export function planCabinetClipPath(cabinet: PlacedCabinet, room: RoomData): string | undefined {
  // AW is positioned like a standard wall cabinet. Its exposed end is angled
  // inside the cabinet's local frame, so never rotate this clip toward the
  // nearest room corner; the cabinet group's saved wall rotation handles that.
  if (isAngledWallCabinet(cabinet.masterCode, cabinet.description)) {
    return triangleCornerClipPath(0);
  }
  const { isCorner, isTriangle, isDiagonal, isBlind, isConfiguredL } = planCornerGeometry(cabinet);
  const savedRotation = ((Math.round(cabinet.rotation) % 360) + 360) % 360;
  const lockedAngledCorner = Boolean(
    cabinet.wallId
    && cabinet.wallOffset != null
    && [45, 135, 225, 315].includes(savedRotation),
  );
  // CSS rotates a measured diagonal body as a whole. Its clip therefore stays
  // in the local top-left corner frame; deriving a second rectangular-room
  // corner turn here mirrors the L notch and produces a plan/3D disagreement.
  const rotation = lockedAngledCorner ? 0 : cornerRotationForPlaced(cabinet, room);
  if (isTriangle) return triangleCornerClipPath(rotation);
  if (isDiagonal) return diagonalCornerClipPath(rotation);
  if ((isConfiguredL || isCorner) && !isBlind) {
    return cornerClipPath(rotation, cornerLegRatioForPlaced(cabinet));
  }
  return undefined;
}

/** Visible 45° WDC door/front seam derived from the same shared diagonal classification. */
export function planDiagonalFrontPath(cabinet: PlacedCabinet, room: RoomData): string | undefined {
  if (!planCornerGeometry(cabinet).isDiagonal) return undefined;
  if (isAngledWallCabinet(cabinet.masterCode, cabinet.description)) return undefined;
  switch (((cornerRotationForPlaced(cabinet, room) % 360) + 360) % 360) {
    case 90: return "M50 100L0 50";
    case 180: return "M0 50L50 0";
    case 270: return "M50 0L100 50";
    default: return "M100 50L50 100";
  }
}

/** The two exposed 12-inch fronts on a 36-inch Lazy Susan L-corner. */
export function planLazySusanTwoFrontPath(cabinet: PlacedCabinet): string | undefined {
  const isLazySusan = /^LS(?:B)?[-_]?\d/i.test(cabinet.masterCode);
  return isLazySusan && planCornerGeometry(cabinet).isConfiguredL
    ? "M67 67L100 67M67 67L67 100"
    : undefined;
}

interface Props {
  room: RoomData;
  /** Visual-only numbered wall aid, present only during Four-Anchor setup. */
  fourAnchorWallGuides?: readonly FourAnchorWallGuide[];
  /** Catalog item currently being dragged over the 2D plan. */
  catalogDragCabinet?: DesignCabinet | null;
  cabinets: PlacedCabinet[];
  /** An atomic, optionally deferred snapshot for the costly countertop layer only. */
  countertopGeometry?: { room: RoomData; cabinets: PlacedCabinet[]; island: IslandZone | null };
  selectedUid: string | null;
  /** Cabinet currently controlled by an open Attributes panel. This receives a stronger, non-destructive visual cue than ordinary selection. */
  attributesTargetUid?: string | null;
  onSelect: (uid: string | null) => void;
  onMove: (uid: string, x: number, y: number, rotation?: number, exactWallDrag?: boolean, target?: { wallId?: string; wallOffset?: number }) => void;
  onDelete?: (uid: string) => void;
  // Rotate the selected cabinet 90° in place (touch-friendly on-canvas handle).
  onRotate?: (uid: string) => void;
  /** Detaches a confirmed corner cabinet so the next drag uses ordinary wall placement. */
  onUnlockCorner?: (uid: string) => void;
  // Right-click a cabinet to open its per-cabinet attributes dialog.
  onOpenAttributes?: (uid: string) => void;
	  onDropNew?: (clientX: number, clientY: number, canvasRect: DOMRect, ppi: number, freehand?: boolean, targetWall?: WallSide) => void;
	  /** Toolbar-controlled choice between nearest-valid placement and exact manual placement. */
  automaticSnapping?: boolean;
  showWallLayer: boolean;
  /** Crown-top callouts describe selected crown molding only; never imply crown on an untrimmed plan. */
  showCrownTopBadges?: boolean;
  /** Keeps wall-cabinet visibility in the single Floor Plan action rail. */
  onToggleWallLayer?: () => void;
  measureMode?: boolean;
  /** When true, show dimension lines for all gaps on all walls simultaneously. */
  autoDimensions?: boolean;
  /** Saves a display-only manual position for an exterior dimension rail. */
  onDimensionAdjustmentChange?: (key: string, adjustment: FloorPlanDimensionAdjustment) => void;
  /** User preference for the non-structural 90-degree peninsula snap glow and badge. */
  showPeninsulaCornerSnapFeedback?: boolean;
  island?: IslandZone | null;
  /** A short-lived cue emitted after a safe Back-face island depth expansion. */
  islandDepthTransition?: { fromDepth: number; toDepth: number; key: number } | null;
  onIslandChange?: (zone: IslandZone) => void;
  // Incremental island move (inches). When provided, moving the island also
  // carries the cabinets sitting on it. Resize still uses onIslandChange.
	  onIslandMove?: (dxIn: number, dyIn: number) => void;
	  activeIslandFace?: IslandFace;
	  onSelectIslandFace?: (face: IslandFace) => void;
	  onOpenIslandAttributes?: () => void;
  openings?: WallOpening[];
  selectedOpeningUid?: string | null;
  /** Exact wall endpoint highlighted while a Window Attributes distance field is focused. */
  openingMeasurementReference?: { openingUid: string; reference: "start" | "end" } | null;
	  /** Brief confirmation that a just-added sink base is centered beneath this window. */
	  sinkWindowSnap?: { cabinetUid: string; openingUid: string; key: number } | null;
  onSelectOpening?: (uid: string | null) => void;
  /** Opens the exact Width / Height / Sill / Position window editor. */
  onOpenWindowAttributes?: (uid: string) => void;
  onOpenDoorAttributes?: (uid: string) => void;
  onOpeningChange?: (opening: WallOpening) => void;
  onDeleteOpening?: (uid: string) => void;
  finish?: FinishColors;
  // Optional per-cabinet finish resolver for TWO-TONE designs. When provided,
  // each cabinet is drawn in its own finish; otherwise the single `finish`
  // prop is used for every cabinet.
  finishFor?: (cab: PlacedCabinet) => FinishColors;
  drawMode?: boolean;
  onDrawRoom?: (room: RoomData) => void;
  // Active-wall: the highlighted wall. A normal touch only selects the wall;
  // room dimensions are changed through the explicit Room Size controls.
	  activeWall?: WallSide;
	  onSelectWall?: (side: WallSide) => void;
	  /** The selected wall's saved 45-degree corner-start distance, in inches. */
	  wallCompassStartIn?: number | null;
	  /** The 45-degree peninsula Compass is shown only after explicit dashboard activation. */
	  wallCompassVisible?: boolean;
	  /** Called after the user moves and releases the selected-wall Compass handle. */
  onWallCompassDrop?: (side: WallSide, startIn: number) => void;
  /** Rotates a measured custom-wall drawing as one unchanged geometric plan. */
  onRotateDrawing?: () => void;
  /** The drawing may be visible but protected from structural changes. */
  drawingRotationDisabled?: boolean;
  /** Inline, uncommitted peninsula continuation shown after a Compass split. */
  peninsulaDraft?: PeninsulaRun | null;
  /** Updates the exact pulled length of the inline peninsula draft. */
  onPeninsulaDraftLengthChange?: (length: number) => void;
  /** Moves a committed peninsula's joined endpoint along its parent wall. */
  onPeninsulaAttachmentChange?: (runId: string, startOffset: number) => void;
  /** Opens the explicit Wall settings editor for the chosen wall. */
  onOpenWallSettings?: (side: WallSide) => void;
  // Uids of items that are in a conflict (e.g. appliance running into a cabinet).
  conflictUids?: Set<string>;
  /** Part 1: placed cabinets with no price on the active line (red flag). */
  missingPriceUids?: Set<string>;
  // Lock state: when layoutLocked is true the whole room/walls/openings/island
  // are frozen (cabinets can still be moved). lockedWalls freezes specific walls.
  layoutLocked?: boolean;
  lockedWalls?: Set<WallSide>;
  // Countertop: when a material id is set, draw a visible slab over base cabinets
  // (and the island). Sinks/faucets are drawn on top of the counter.
  countertopMaterialId?: string | null;
  islandCountertopMaterialId?: string | null;
  sinks?: SinkFixture[];
  /** Source-measured wall pot-fillers; valid range-wall associations render as exact reach lines. */
  potFillers?: PotFillerFixture[];
  selectedSinkUid?: string | null;
  onSelectSink?: (uid: string | null) => void;
  onMoveSink?: (uid: string, x: number, y: number) => void;
  // Right-click a WALL cabinet to drop it to the floor as an island/peninsula
  // base (top lands at 34.5 in). Provided by DesignTool.
  onDropToFloor?: (uid: string) => void;
  // Furniture (tables, chairs, stools) — floor-plan-only space planning items.
  furniture?: import("@/lib/design").PlacedFurniture[];
  selectedFurnUid?: string | null;
  onSelectFurn?: (uid: string | null) => void;
  onMoveFurn?: (uid: string, x: number, y: number) => void;
  onDeleteFurn?: (uid: string) => void;
  onRotateFurn?: (uid: string) => void;
  onOpenFurnitureAttributes?: (uid: string) => void;
  /** Advisory warning when a bathroom fixture is dragged into a mismatched starter zone. */
  bathroomZoneWarningsByFixture?: ReadonlyMap<string, readonly BathroomZoneOverlapWarning[]>;
  // Flooring: when set, draw a flooring pattern texture on the room floor.
  flooringMaterialId?: string | null;
  // Flooring layout pattern: how planks are arranged (affects SVG tile rendering).
  flooringPattern?: import("@/lib/design").FlooringLayoutPattern;
  // Cabinet lock: when true, cabinet drag/drop/delete are blocked.
  cabinetsLocked?: boolean;
  // Gap intelligence: one representative real cabinet per width (keyed by width
  // in inches) sourced from the active palette, used to suggest cabinets that
  // fit a measured gap. When onFillGap is provided the popover rows become
  // click-to-place actions.
  gapFillCandidates?: Map<number, DesignCabinet>;
  /** Active selected-line fillers used to calculate the exact sellable cut recommendation. */
  catalogFillerCandidates?: readonly CatalogFillerCandidate[];
  /** Full selected-line catalog for Smart Gap type filtering and price ordering. */
  smartGapCandidates?: DesignCabinet[];
  /** Approved current unit prices keyed by active catalog cabinet ID. */
  smartGapCandidatePrices?: Map<number, number>;
  /** Non-interactive ghost pieces showing where the active filler choice will be inserted. */
  fillerGapPreview?: readonly PlacedCabinet[];
  onFillGap?: (gap: WallGap, cabinet: DesignCabinet) => void;
  onPlaceFiller?: (gap: WallGap) => void;
  /** Place a cabinet + auto-sized filler in a gap as a combo. */
  onFillGapWithCabAndFiller?: (gap: WallGap, cabinet: DesignCabinet) => void;
  /** Visualize a Smart Gap option in 3D without adding it to the saved plan. */
  onPreviewGap?: (gap: WallGap, cabinet: DesignCabinet | null, needsFiller: boolean, choices: Array<{ cabinet: DesignCabinet | null; needsFiller: boolean }>, index: number) => void;
  // Text annotations placed on the floor plan by the user.
  annotations?: PlanAnnotation[];
  selectedAnnotationUid?: string | null;
  onSelectAnnotation?: (uid: string | null) => void;
  onMoveAnnotation?: (uid: string, x: number, y: number) => void;
  onDeleteAnnotation?: (uid: string) => void;
  // Pony walls — free-standing half-walls (34.5" tall by default) placed on the floor plan.
  ponyWalls?: PonyWall[];
  selectedPonyWallUid?: string | null;
  onSelectPonyWall?: (uid: string | null) => void;
  onPonyWallChange?: (pw: PonyWall) => void;
  onDeletePonyWall?: (uid: string) => void;
}

// Compute a readable label color for text drawn directly on a cabinet fill.
// Parses a #rgb/#rrggbb hex fill, estimates perceived luminance, and returns
// dark ink on light fills / light ink on dark fills, plus a matching subtle
// text-shadow so the ID stays legible on any finish.
function readableLabel(fillHex: string): { color: string; shadow: string; isDarkFill: boolean } {
  let hex = (fillHex || "").trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Fallback: treat unparseable fills as light.
  const valid = hex.length === 6 && [r, g, b].every((n) => !Number.isNaN(n));
  const lum = valid ? (0.299 * r + 0.587 * g + 0.114 * b) / 255 : 1;
  const isDarkFill = lum < 0.55;
  return isDarkFill
    ? { color: "#f8fafc", shadow: "0 1px 2px rgba(0,0,0,0.65)", isDarkFill }
    : { color: "#1a2744", shadow: "0 1px 1px rgba(255,255,255,0.55)", isDarkFill };
}

export function PlanCanvas({
  room, fourAnchorWallGuides = [], catalogDragCabinet = null, cabinets, countertopGeometry, selectedUid, attributesTargetUid = null, onSelect, onMove, onDelete, onRotate, onUnlockCorner, onOpenAttributes, onDropNew, onDropToFloor,
  showWallLayer, showCrownTopBadges = false, onToggleWallLayer, measureMode = false, autoDimensions = false, onDimensionAdjustmentChange, showPeninsulaCornerSnapFeedback = true, island = null, onIslandChange, onIslandMove,
  islandDepthTransition = null,
  activeIslandFace = "front", onSelectIslandFace, onOpenIslandAttributes,
  openings = [], selectedOpeningUid = null, openingMeasurementReference = null, sinkWindowSnap = null, onSelectOpening, onOpenWindowAttributes, onOpenDoorAttributes, onOpeningChange, onDeleteOpening,
	  finish = DEFAULT_FINISH_COLORS,
	  drawMode = false, onDrawRoom,
	  activeWall, onSelectWall, wallCompassStartIn = null, wallCompassVisible = false, onWallCompassDrop, onRotateDrawing, drawingRotationDisabled = false, peninsulaDraft = null, onPeninsulaDraftLengthChange, onPeninsulaAttachmentChange, onOpenWallSettings, conflictUids, missingPriceUids,
  layoutLocked = false, lockedWalls,
  countertopMaterialId = null, islandCountertopMaterialId = null, sinks = [], potFillers = [], selectedSinkUid = null, onSelectSink, onMoveSink,
  finishFor,
  furniture = [], selectedFurnUid = null, onSelectFurn, onMoveFurn, onDeleteFurn, onRotateFurn, onOpenFurnitureAttributes, bathroomZoneWarningsByFixture,
  flooringMaterialId = null,
	  flooringPattern = "random-stagger",
	  cabinetsLocked = false,
	  automaticSnapping = true,
  gapFillCandidates,
  catalogFillerCandidates = [],
  smartGapCandidates = [],
  smartGapCandidatePrices,
  fillerGapPreview = [],
  onFillGap,
  onPlaceFiller,
  onFillGapWithCabAndFiller,
  onPreviewGap,
  annotations = [], selectedAnnotationUid = null, onSelectAnnotation, onMoveAnnotation, onDeleteAnnotation,
  ponyWalls = [], selectedPonyWallUid = null, onSelectPonyWall, onPonyWallChange, onDeletePonyWall,
}: Props) {
  const { t } = useLanguage();
  const snapshotRoom = countertopGeometry?.room ?? room;
  const snapshotCabinets = countertopGeometry?.cabinets ?? cabinets;
  const snapshotIsland = countertopGeometry ? countertopGeometry.island : island;
  const countertopShapes = useMemo(() => {
    if (!countertopMaterialId) return [] as CountertopSurface[];
    const geometryIsland = snapshotIsland;
    const perimeterSurfaces = countertopSurfaces(snapshotCabinets, snapshotRoom, geometryIsland, ponyWalls).filter((surface) => surface.kind !== "island");
    const islandSurfaces: CountertopSurface[] = geometryIsland
      ? [
          ...islandCountertopVisibleRects(geometryIsland, snapshotCabinets).map((surface) => ({ ...surface, kind: "island" as const })),
          ...islandRaisedBarRects(geometryIsland, snapshotCabinets).map((surface) => ({ ...surface, kind: "island" as const, raisedBar: true, raisedBarOverhangIn: geometryIsland.raisedBarOverhang === 12 ? 12 : 15, countertopHeightIn: 42 })),
        ]
      : [];
    return [...perimeterSurfaces, ...islandSurfaces];
  }, [countertopMaterialId, snapshotRoom, snapshotCabinets, snapshotIsland, ponyWalls]);
  const dimensionUnitSystem: FloorPlanDimensionUnit = room.dimensionLabelStyle?.unitSystem === "metric" ? "metric" : "imperial";
  const formatDisplayDimension = (inches: number) => formatFloorPlanDimension(inches, dimensionUnitSystem);
  // View-only preference: hide annotations without changing saved geometry or
  // the user's Auto dimensions setting.
  const [measurementBubblesVisible, setMeasurementBubblesVisible] = useState(true);
  const [measurementBubbleOpacity, setMeasurementBubbleOpacity] = useState(1);
  const measurementBubbleStyle = { opacity: measurementBubbleOpacity };
  const [islandDepthTransitionVisible, setIslandDepthTransitionVisible] = useState(false);
  useEffect(() => {
    if (!islandDepthTransition) {
      setIslandDepthTransitionVisible(false);
      return;
    }
    setIslandDepthTransitionVisible(false);
    const frame = requestAnimationFrame(() => setIslandDepthTransitionVisible(true));
    const timeout = window.setTimeout(() => setIslandDepthTransitionVisible(false), 1400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [islandDepthTransition?.key]);
  // Localized wall names (Back/Front/Left/Right) for on-canvas labels.
  const wallLabel: Record<WallSide, string> = {
    top: t("plan_wall_back"), bottom: t("plan_wall_front"), left: t("plan_wall_left"), right: t("plan_wall_right"),
  };
  // A wall cannot be resized if the whole layout is locked or that wall is locked.
  const isWallLocked = (side: WallSide) => layoutLocked || !!lockedWalls?.has(side);
  // Door/window drag along its wall (move) or width-resize.
  const openingDrag = useRef<
    | { mode: "move" | "resize"; startX: number; startY: number; orig: WallOpening }
    | null
  >(null);

  const onOpeningPointerDown = (e: React.PointerEvent, o: WallOpening, mode: "move" | "resize") => {
    if (!onOpeningChange || layoutLocked) return;
    e.stopPropagation();
    onSelectOpening?.(o.uid);
    openingDrag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...o } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onOpeningPointerMove = (e: React.PointerEvent) => {
    const d = openingDrag.current;
    if (!d || !onOpeningChange) return;
    const customFrame = planOpeningWallFrame(d.orig, room);
    const horizontal = d.orig.side === "top" || d.orig.side === "bottom";
    const deltaPx = customFrame
      ? (e.clientX - d.startX) * customFrame.tangentX + (e.clientY - d.startY) * customFrame.tangentY
      : horizontal ? e.clientX - d.startX : e.clientY - d.startY;
    const deltaIn = deltaPx / ppiRef.current;
    if (d.mode === "move") {
      onOpeningChange(clampOpening({ ...d.orig, offset: d.orig.offset + deltaIn }, room));
    } else {
      const width = Math.max(12, d.orig.width + deltaIn);
      onOpeningChange(clampOpening({ ...d.orig, width }, room));
    }
  };

  const onOpeningPointerUp = (e: React.PointerEvent) => {
    if (openingDrag.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    openingDrag.current = null;
  };

  const openOpeningAttributes = (event: React.MouseEvent, opening: WallOpening) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectOpening?.(opening.uid);
    // Windows and doors have dedicated, type-specific Attributes dialogs.
    if (opening.kind === "window") onOpenWindowAttributes?.(opening.uid);
    if (opening.kind === "door") onOpenDoorAttributes?.(opening.uid);
  };
  // Island drag/resize: tracks an active gesture without re-rendering per move.
  const islandDrag = useRef<
    | { mode: "move" | "resize"; startX: number; startY: number; orig: IslandZone }
    | null
  >(null);

	  const onIslandPointerDown = (e: React.PointerEvent, mode: "move" | "resize") => {
	    if (!island || !onIslandChange || layoutLocked) return;
	    e.stopPropagation();
	    const rect = containerRef.current?.getBoundingClientRect();
	    if (rect) {
	      const x = (e.clientX - rect.left) / ppiRef.current;
	      const y = (e.clientY - rect.top) / ppiRef.current;
	      const distances: Array<[IslandFace, number]> = [
	        ["back", Math.abs(y - island.y)],
	        ["front", Math.abs(y - (island.y + island.depth))],
	        ["left", Math.abs(x - island.x)],
	        ["right", Math.abs(x - (island.x + island.width))],
	      ];
	      distances.sort((a, b) => a[1] - b[1]);
	      onSelectIslandFace?.(distances[0][0]);
	    }
	    islandDrag.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...island } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onIslandPointerMove = (e: React.PointerEvent) => {
    const d = islandDrag.current;
    if (!d || !island || (!onIslandChange && !onIslandMove)) return;
    const dxIn = (e.clientX - d.startX) / ppiRef.current;
    const dyIn = (e.clientY - d.startY) / ppiRef.current;
    if (d.mode === "move") {
      const x = Math.max(0, Math.min(d.orig.x + dxIn, room.width - d.orig.width));
      const y = Math.max(0, Math.min(d.orig.y + dyIn, room.depth - d.orig.depth));
      // If a grouped-move handler is provided, report the incremental delta from
      // the island's CURRENT position so the cabinets on it move in lockstep.
      if (onIslandMove) {
        const ddx = x - island.x;
        const ddy = y - island.y;
        if (ddx !== 0 || ddy !== 0) onIslandMove(ddx, ddy);
      } else {
        onIslandChange?.({ ...d.orig, x, y });
      }
    } else {
      const width = Math.max(18, Math.min(d.orig.width + dxIn, room.width - d.orig.x));
      const depth = Math.max(18, Math.min(d.orig.depth + dyIn, room.depth - d.orig.y));
      onIslandChange?.({ ...d.orig, width, depth });
    }
  };

  const onIslandPointerUp = (e: React.PointerEvent) => {
    if (islandDrag.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    islandDrag.current = null;
  };

  // Sink drag: freely move a sink fixture around (it floats on the counter).
  const sinkDrag = useRef<
    | { uid: string; startX: number; startY: number; origX: number; origY: number; w: number; d: number }
    | null
  >(null);
  const onSinkPointerDown = (e: React.PointerEvent, s: SinkFixture) => {
    e.stopPropagation();
    onSelectSink?.(s.uid);
    // A linked standard sink is deliberately positioned by the shared 3-inch
    // setback policy. Keep it selectable, but do not offer a free drag that
    // would put it back over the bowl/faucet deck geometry.
    if (!onMoveSink || layoutLocked || (s.cabinetUid && s.frontSetbackIn != null && !s.apronFront)) return;
    sinkDrag.current = { uid: s.uid, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y, w: s.width, d: s.depth };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onSinkPointerMove = (e: React.PointerEvent) => {
    const dgr = sinkDrag.current;
    if (!dgr || !onMoveSink) return;
    const dx = (e.clientX - dgr.startX) / ppiRef.current;
    const dy = (e.clientY - dgr.startY) / ppiRef.current;
    const x = Math.max(0, Math.min(dgr.origX + dx, room.width - dgr.w));
    const y = Math.max(0, Math.min(dgr.origY + dy, room.depth - dgr.d));
    onMoveSink(dgr.uid, x, y);
  };
  const onSinkPointerUp = (e: React.PointerEvent) => {
    if (sinkDrag.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    sinkDrag.current = null;
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [fitPpi, setFitPpi] = useState(4);
  const [floorPlanZoom, setFloorPlanZoom] = useState(1);
  const [floorPlanPan, setFloorPlanPan] = useState({ x: 0, y: 0 });
  const ppi = fitPpi * floorPlanZoom;
  const ppiRef = useRef(4);
  useEffect(() => { ppiRef.current = ppi; }, [ppi]);
  const planPanDrag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const dimensionLeaderDrag = useRef<{
    key: string;
    startX: number;
    startY: number;
    tangent: { x: number; y: number };
    inward: { x: number; y: number };
    origin: FloorPlanDimensionAdjustment;
  } | null>(null);
  const beginDimensionLeaderDrag = useCallback((event: React.PointerEvent<SVGGElement>, key: string, frame: { tangent: { x: number; y: number }; inward: { x: number; y: number } }) => {
    if (!onDimensionAdjustmentChange) return;
    event.preventDefault();
    event.stopPropagation();
    dimensionLeaderDrag.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      tangent: frame.tangent,
      inward: frame.inward,
      origin: room.dimensionAdjustments?.[key] ?? {},
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }, [onDimensionAdjustmentChange, room.dimensionAdjustments]);
  const moveDimensionLeaderDrag = useCallback((event: React.PointerEvent<SVGGElement>) => {
    const drag = dimensionLeaderDrag.current;
    if (!drag || !onDimensionAdjustmentChange) return;
    const dxIn = (event.clientX - drag.startX) / ppiRef.current;
    const dyIn = (event.clientY - drag.startY) / ppiRef.current;
    const alongIn = (drag.origin.alongIn ?? 0) + dxIn * drag.tangent.x + dyIn * drag.tangent.y;
    // Exterior is opposite the room's inward normal. Keep the rail outside the
    // wall so a manual correction cannot cover cabinet faces again.
    const outsideIn = (drag.origin.outsideIn ?? 0) - dxIn * drag.inward.x - dyIn * drag.inward.y;
    onDimensionAdjustmentChange(drag.key, {
      alongIn: Math.round(Math.max(-36, Math.min(36, alongIn)) * 8) / 8,
      outsideIn: Math.round(Math.max(0, Math.min(36, outsideIn)) * 8) / 8,
    });
  }, [onDimensionAdjustmentChange]);
  const endDimensionLeaderDrag = useCallback((event: React.PointerEvent<SVGGElement>) => {
    if (!dimensionLeaderDrag.current) return;
    moveDimensionLeaderDrag(event);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    dimensionLeaderDrag.current = null;
  }, [moveDimensionLeaderDrag]);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [hoverSnap, setHoverSnap] = useState(false);
  const [hoverSnapWall, setHoverSnapWall] = useState(false);
  const [wallSnapSuccessUid, setWallSnapSuccessUid] = useState<string | null>(null);
  const wallSnapSuccessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tape-measure: two arbitrary points on the saved 2D plan, stored in inches.
  // This deliberately does not depend on cabinet centers: users can measure a
  // wall span, opening, aisle, appliance clearance, or any other plan detail.
  const [measurePoints, setMeasurePoints] = useState<PlanMeasurePoint[]>([]);
  // Mouse-draw room gesture: pixel rectangle relative to the container while
  // dragging; converted to inches on release via the same fit-PPI scale.
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const compassDrag = useRef<{ side: WallSide; initialStartIn: number } | null>(null);
  const [compassPreviewStart, setCompassPreviewStart] = useState<number | null>(null);
  const [compassPreviewVisible, setCompassPreviewVisible] = useState(false);
  const peninsulaPull = useRef<{ startX: number; startY: number; radians: number; maxLength: number } | null>(null);
  const peninsulaAttachmentDrag = useRef<{ run: PeninsulaRun } | null>(null);
  // Gap intelligence: which gap label was clicked (shows fill suggestions).
	  const [activeGap, setActiveGap] = useState<WallGap | null>(null);
	  const [catalogDragFit, setCatalogDragFit] = useState<WallGapFitPreview | null>(null);
	  const [catalogDragFreehand, setCatalogDragFreehand] = useState(false);
  const [smartGapType, setSmartGapType] = useState<"all" | "base" | "sink" | "drawer">("all");
  const [smartGapOrder, setSmartGapOrder] = useState<"fit" | "price">("fit");
  // Furniture drag state.
  const furnDrag = useRef<{ uid: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onFurnPointerDown = (e: React.PointerEvent, f: PlacedFurniture) => {
    e.stopPropagation();
    onSelectFurn?.(f.uid);
    if (e.button !== 0 || layoutLocked) return;
    furnDrag.current = { uid: f.uid, startX: e.clientX, startY: e.clientY, origX: f.x, origY: f.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onFurnPointerMove = (e: React.PointerEvent) => {
    const d = furnDrag.current;
    if (!d || !onMoveFurn) return;
    const placed = furniture.find((f) => f.uid === d.uid);
    const def = placed ? FURNITURE_CATALOG.find((fd) => fd.id === placed.defId) : undefined;
    const fp = (def && placed) ? furnitureFootprint(placed, def) : { w: 24, d: 24 };
    const dx = (e.clientX - d.startX) / ppiRef.current;
    const dy = (e.clientY - d.startY) / ppiRef.current;
    const x = Math.max(0, Math.min(d.origX + dx, room.width - fp.w));
    const y = Math.max(0, Math.min(d.origY + dy, room.depth - fp.d));
    onMoveFurn(d.uid, x, y);
  };
  const onFurnPointerUp = (e: React.PointerEvent) => {
    if (furnDrag.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
    furnDrag.current = null;
  };

  // ── Annotation drag ──
  const annDrag = useRef<{ uid: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onAnnPointerDown = (e: React.PointerEvent, a: PlanAnnotation) => {
    e.stopPropagation();
    onSelectAnnotation?.(a.uid);
    annDrag.current = { uid: a.uid, startX: e.clientX, startY: e.clientY, origX: a.x, origY: a.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onAnnPointerMove = (e: React.PointerEvent) => {
    const d = annDrag.current;
    if (!d || !onMoveAnnotation) return;
    const dx = (e.clientX - d.startX) / ppiRef.current;
    const dy = (e.clientY - d.startY) / ppiRef.current;
    const x = Math.max(0, Math.min(d.origX + dx, room.width));
    const y = Math.max(0, Math.min(d.origY + dy, room.depth));
    onMoveAnnotation(d.uid, x, y);
  };
  const onAnnPointerUp = (e: React.PointerEvent) => {
    if (annDrag.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
    annDrag.current = null;
  };

  // Dimensioned plans reserve a true exterior drafting gutter. This keeps all
  // dimension rails outside the wall/cabinet footprint rather than squeezing
  // labels through the room as an overlay.
  const PADDING = autoDimensions && measurementBubblesVisible ? 104 : 48;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fit = () => {
      const availW = el.clientWidth - PADDING * 2;
      const availH = el.clientHeight - PADDING * 2;
      const fitPpi = Math.min(availW / room.width, availH / room.depth);
      setFitPpi(Math.max(1.5, Math.min(fitPpi, 8)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [room.width, room.depth, autoDimensions]);

  const setZoom = useCallback((next: number) => {
    setFloorPlanZoom(clampFloorPlanZoom(next));
  }, []);
  const zoomIn = useCallback(() => setZoom(floorPlanZoom + FLOOR_PLAN_ZOOM_STEP), [floorPlanZoom, setZoom]);
  const zoomOut = useCallback(() => setZoom(floorPlanZoom - FLOOR_PLAN_ZOOM_STEP), [floorPlanZoom, setZoom]);
  const resetFloorPlanView = useCallback(() => {
    setFloorPlanZoom(1);
    setFloorPlanPan({ x: 0, y: 0 });
  }, []);

  // Reset the temporary tape whenever measure mode toggles off.
  useEffect(() => {
    if (!measureMode) setMeasurePoints([]);
  }, [measureMode]);

  useEffect(() => () => {
    if (wallSnapSuccessTimeout.current != null) clearTimeout(wallSnapSuccessTimeout.current);
  }, []);

  const addMeasurePoint = useCallback((clientX: number, clientY: number, roomRect: DOMRect) => {
    const point = snapPlanMeasurePoint({
      x: (clientX - roomRect.left) / ppiRef.current,
      y: (clientY - roomRect.top) / ppiRef.current,
    }, room);
    setMeasurePoints((previous) => previous.length >= 2 ? [point] : [...previous, point]);
  }, [room]);

  const roomPxW = room.width * ppi;
  const roomPxH = room.depth * ppi;
  const hasCustomWallShell = Boolean(room.vertices?.length && room.customWalls?.length);
  // Four-Anchor labels are projected from the same physical wall frames used by
  // anchor placement. They sit just inside the room, are not clickable, and are
  // discarded as soon as setup closes; they never affect a room or wall record.
  const positionedFourAnchorWallGuides = useMemo(() => fourAnchorWallGuides.flatMap((guide) => {
    const frame = wallRunFrame(guide.engineWallId, room);
    if (!frame || frame.kind === "peninsula") return [];
    const middleAlong = (frame.runStart + frame.runEnd) / 2;
    const start = guide.startCorner === "start" ? frame.start : frame.end;
    const pointAt = (point: { x: number; y: number }, insetIn: number) => ({
      left: (point.x + frame.inward.x * insetIn) * ppi,
      top: (point.y + frame.inward.y * insetIn) * ppi,
    });
    return [{ guide, labelPosition: pointAt({
      x: frame.start.x + frame.tangent.x * middleAlong,
      y: frame.start.y + frame.tangent.y * middleAlong,
    }, 8), startPosition: pointAt(start, 3) }];
  }), [fourAnchorWallGuides, ppi, room]);
  // The measured segment is the finished room-facing wall surface shared by
  // cabinet placement, openings, dimensions and 3D. Build the wall thickness
  // outward from that face, so the plan cannot depict a cabinet buried halfway
  // inside a diagonal Wall Builder wall.
	  const customWallShellOutlines = hasCustomWallShell
    ? miteredWallOutlinesFromInteriorFaces(
        room.customWalls!.flatMap((wall) => {
          const start = room.vertices!.find((vertex) => vertex.id === wall.startVertexId);
          const end = room.vertices!.find((vertex) => vertex.id === wall.endVertexId);
          return start && end ? [{
            id: wall.id,
            start,
            end,
            interiorOnLeft: customWallCabinetSide(room, wall.id) === "left",
          }] : [];
        }),
        ROOM_WALL_THICKNESS_IN,
        !room.openWallPath,
      )
	    : [];
	  // The Four-Anchor form docks at the right on wide screens. Move only this
	  // rendered room viewport left while its numbered guide is active so its
	  // right-side Wall 4–6 labels remain readable. Saved coordinates, panning,
	  // cabinet transforms and all placement math remain inch-based and unchanged.
	  const fourAnchorGuideDockOffsetPx = positionedFourAnchorWallGuides.length > 0
	    ? Math.min(120, Math.max(48, roomPxW * 0.15))
	    : 0;
  // The position editor stores every distance against a wall endpoint. Resolve
  // that endpoint here rather than using the graph rectangle: a Continuous Wall
  // Builder room may be diagonal or open, and its real start/end must be visible.
  const openingReferencePoint = (() => {
    if (!openingMeasurementReference) return null;
    const opening = openings.find((candidate) => candidate.uid === openingMeasurementReference.openingUid);
    if (!opening) return null;
    const customWall = room.customWalls?.find((wall) => wall.id === opening.side);
    if (customWall && room.vertices) {
      const vertexId = openingMeasurementReference.reference === "start" ? customWall.startVertexId : customWall.endVertexId;
      const vertex = room.vertices.find((candidate) => candidate.id === vertexId);
      if (vertex) {
        return { x: vertex.x, y: vertex.y, label: `Wall ${openingMeasurementReference.reference} / ${openingMeasurementReference.reference === "start" ? "left" : "right"}` };
      }
    }
    const atStart = openingMeasurementReference.reference === "start";
    if (opening.side === "top" || opening.side === "bottom") {
      return { x: atStart ? 0 : room.width, y: opening.side === "top" ? 0 : room.depth, label: `Wall ${atStart ? "start / left" : "end / right"}` };
    }
    return { x: opening.side === "left" ? 0 : room.width, y: atStart ? 0 : room.depth, label: `Wall ${atStart ? "start / left" : "end / right"}` };
  })();

  // ─── Mouse-draw room gesture (container-level) ─────────────────────────────
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    // Middle-mouse drag pans only the view. It intentionally never changes a
    // cabinet, wall, dimension, or saved room coordinate.
    if (!drawMode && !measureMode && e.button === 1) {
      e.preventDefault();
      planPanDrag.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: floorPlanPan.x,
        originY: floorPlanPan.y,
      };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (!drawMode || !onDrawRoom) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawStart.current = { x, y };
    setDrawRect({ x, y, w: 0, h: 0 });
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const pan = planPanDrag.current;
    if (pan) {
      setFloorPlanPan({
        x: Math.round(pan.originX + e.clientX - pan.startX),
        y: Math.round(pan.originY + e.clientY - pan.startY),
      });
      return;
    }
    if (!drawMode || !drawStart.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const s = drawStart.current;
    setDrawRect({
      x: Math.min(s.x, cx),
      y: Math.min(s.y, cy),
      w: Math.abs(cx - s.x),
      h: Math.abs(cy - s.y),
    });
  };

  const onCanvasPointerUp = (e: React.PointerEvent) => {
    if (planPanDrag.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      planPanDrag.current = null;
      return;
    }
    if (!drawMode || !drawStart.current || !onDrawRoom) {
      drawStart.current = null;
      setDrawRect(null);
      return;
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const r = drawRect;
    drawStart.current = null;
    setDrawRect(null);
    // Ignore tiny accidental drags.
    if (!r || r.w < 12 || r.h < 12) return;
    const width = clampRoomInches(r.w / ppi);
    const depth = clampRoomInches(r.h / ppi);
    if (layoutLocked) return;
    onDrawRoom({ width, depth });
  };

  const onRoomMeasurePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measureMode) return;
    e.stopPropagation();
    addMeasurePoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  // ─── Wall selection ────────────────────────────────────────────────────────
  // A wall is a first-class selectable object. A normal touch only selects it;
  // a right-click (or equivalent context-menu gesture) opens the explicit wall
  // Attributes dialog. Moving a pointer while selecting must never resize the
  // room or change its geometry.
  const onWallPointerDown = (e: React.PointerEvent, side: WallSide) => {
    e.stopPropagation();
    onSelectWall?.(side);
  };

  const onWallContextMenu = (event: React.MouseEvent, side: WallSide) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectWall?.(side);
    onOpenWallSettings?.(side);
  };

  const compassStartForWall = useCallback((side: WallSide) => {
    const span = side === "top" || side === "bottom" ? room.width : room.depth;
    const requested = compassPreviewStart ?? wallCompassStartIn ?? span / 2;
    return Math.max(6, Math.min(Math.max(6, span - 6), requested));
  }, [compassPreviewStart, room.depth, room.width, wallCompassStartIn]);

  const compassPositionFromPointer = useCallback((event: React.PointerEvent, side: WallSide) => {
    const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement | null;
    if (!roomEl) return compassStartForWall(side);
    const rect = roomEl.getBoundingClientRect();
    const raw = side === "top" || side === "bottom"
      ? (event.clientX - rect.left) / ppiRef.current
      : (event.clientY - rect.top) / ppiRef.current;
    const span = side === "top" || side === "bottom" ? room.width : room.depth;
    return Math.max(6, Math.min(Math.max(6, span - 6), Math.round(raw * 8) / 8));
  }, [compassStartForWall, room.depth, room.width]);

  const onCompassPointerDown = (event: React.PointerEvent, side: WallSide) => {
    event.stopPropagation();
    event.preventDefault();
    onSelectWall?.(side);
    const initialStartIn = compassPositionFromPointer(event, side);
    compassDrag.current = { side, initialStartIn };
    setCompassPreviewStart(initialStartIn);
    setCompassPreviewVisible(true);
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const onCompassPointerMove = (event: React.PointerEvent) => {
    const drag = compassDrag.current;
    if (!drag) return;
    setCompassPreviewStart(compassPositionFromPointer(event, drag.side));
  };

  const onCompassPointerUp = (event: React.PointerEvent) => {
    const drag = compassDrag.current;
    compassDrag.current = null;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    const startIn = compassPositionFromPointer(event, drag.side);
    setCompassPreviewStart(null);
    setCompassPreviewVisible(false);
    const movement = startIn - drag.initialStartIn;
    // A press without meaningful travel only keeps the wall selected. A moved
    // handle establishes a real peninsula split point; angle and pull length
    // are chosen in the follow-up inline builder, never in a popup.
    if (Math.abs(movement) < 0.5) return;
    onWallCompassDrop?.(drag.side, startIn);
  };

  // Touch browsers can cancel a pointer sequence when the user's finger crosses
  // a scroll boundary or the OS momentarily steals the gesture. Clear the
  // preview in that case so the one visible Compass target is immediately ready
  // for the next drag instead of retaining a stale captured state.
  const onCompassPointerCancel = (event: React.PointerEvent) => {
    if (!compassDrag.current) return;
    event.preventDefault();
    event.stopPropagation();
    compassDrag.current = null;
    setCompassPreviewStart(null);
    setCompassPreviewVisible(false);
  };

  const onPeninsulaPullDown = (event: React.PointerEvent, draft: PeninsulaRun) => {
    event.preventDefault();
    event.stopPropagation();
    const { start, radians } = peninsulaRunEndpoints(draft, room);
    peninsulaPull.current = { startX: start.x, startY: start.y, radians, maxLength: peninsulaRunMaxLength(draft, room) };
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const onPeninsulaPullMove = (event: React.PointerEvent) => {
    const pull = peninsulaPull.current;
    if (!pull || !onPeninsulaDraftLengthChange) return;
    const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement | null;
    if (!roomEl) return;
    const rect = roomEl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / ppiRef.current;
    const y = (event.clientY - rect.top) / ppiRef.current;
    const projected = (x - pull.startX) * Math.cos(pull.radians) + (y - pull.startY) * Math.sin(pull.radians);
    onPeninsulaDraftLengthChange(Math.round(Math.max(12, Math.min(pull.maxLength, projected)) * 8) / 8);
  };

  const onPeninsulaPullUp = (event: React.PointerEvent) => {
    if (!peninsulaPull.current) return;
    onPeninsulaPullMove(event);
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    peninsulaPull.current = null;
  };

  const peninsulaPointFromPointer = useCallback((event: React.PointerEvent) => {
    const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement | null;
    if (!roomEl) return null;
    const rect = roomEl.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / ppiRef.current,
      y: (event.clientY - rect.top) / ppiRef.current,
    };
  }, []);

	const onPeninsulaAttachmentPointerDown = (event: React.PointerEvent, run: PeninsulaRun) => {
	  if (layoutLocked || peninsulaRunAssemblyLocked(run, room) || !onPeninsulaAttachmentChange) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectWall?.(run.id as WallSide);
    peninsulaAttachmentDrag.current = { run };
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

	const onPeninsulaAttachmentPointerMove = (event: React.PointerEvent) => {
	  const drag = peninsulaAttachmentDrag.current;
	  if (!drag || peninsulaRunAssemblyLocked(drag.run, room) || !onPeninsulaAttachmentChange) return;
    const point = peninsulaPointFromPointer(event);
    if (!point) return;
    onPeninsulaAttachmentChange(drag.run.id, peninsulaRunStartOffsetAtPoint(drag.run, room, point));
  };

  const onPeninsulaAttachmentPointerUp = (event: React.PointerEvent) => {
    if (!peninsulaAttachmentDrag.current) return;
    onPeninsulaAttachmentPointerMove(event);
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    peninsulaAttachmentDrag.current = null;
  };

  // Manual double-tap detector (iOS Safari does not reliably synthesize
  // dblclick from two quick taps). A second tap on the same cabinet within
  // ~320ms opens the attributes editor; a single tap only selects.
  const lastTapRef = useRef<{ uid: string; t: number }>({ uid: "", t: 0 });

  const handlePointerDown = (e: React.PointerEvent, p: PlacedCabinet) => {
    e.stopPropagation();
    if (measureMode) {
      const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement | null;
      if (roomEl) addMeasurePoint(e.clientX, e.clientY, roomEl.getBoundingClientRect());
      return;
    }
    onSelect(p.uid);
    setWallSnapSuccessUid(null);
    if (wallSnapSuccessTimeout.current != null) {
      clearTimeout(wallSnapSuccessTimeout.current);
      wallSnapSuccessTimeout.current = null;
    }
    // Double-tap / double-click → open the attributes editor.
    const now = Date.now();
    const last = lastTapRef.current;
    if (onOpenAttributes && last.uid === p.uid && now - last.t < 320) {
      lastTapRef.current = { uid: "", t: 0 };
      onOpenAttributes(p.uid);
      return;
    }
    lastTapRef.current = { uid: p.uid, t: now };
    // When cabinets are locked, allow selection but not dragging.
    if (cabinetsLocked) return;
    setDragUid(p.uid);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragUid) return;
      const container = containerRef.current;
      if (!container) return;
      const cabinet = cabinets.find((c) => c.uid === dragUid);
      if (!cabinet) return;

      const roomEl = container.querySelector("[data-room]") as HTMLElement;
      if (!roomEl) return;
      const roomRect = roomEl.getBoundingClientRect();

      const px = e.clientX - roomRect.left - dragOffset.current.x;
      const py = e.clientY - roomRect.top - dragOffset.current.y;
      const rawX = px / ppi;
      const rawY = py / ppi;

      let candidate: PlacedCabinet = { ...cabinet, x: rawX, y: rawY };
      // True corner cabinets get an intentional, generous corner target while
      // dragging. This avoids the old experience where the user had to hunt for
      // an exact pixel on the wall and guarantees that the target retains its
      // measured wall identity instead of falling back to the graph boundary.
      if (isProtectedCornerCabinet(cabinet.masterCode, cabinet.description) && !cabinet.cornerSnapUnlocked) {
        const cornerSpot = nextAvailableRoomCornerPlacement(
          candidate,
          cabinetWall(cabinet, room),
          room,
          cabinets.filter((item) => item.uid !== cabinet.uid),
          { x: (e.clientX - roomRect.left) / ppi, y: (e.clientY - roomRect.top) / ppi },
        );
        if (cornerSpot) {
          setHoverSnap(true);
          setHoverSnapWall(true);
          onMove(
            dragUid,
            cornerSpot.x,
            cornerSpot.y,
            cornerSpot.rotation,
            true,
            { wallId: cornerSpot.wallId, wallOffset: cornerSpot.wallOffset },
          );
          return;
        }
      }
      // ONE drag engine for every wall. The pointer body is projected onto the
      // nearest wall run (standard side, drawn wall or peninsula) and previewed
      // with the same 1/8-inch placement, magnet and seam rules moveCabinet
      // commits with. Only a floor cabinet dragged beyond the wall magnet keeps
      // the free-floating rectangular snap (islands, open-floor pieces).
      // The panel/cap/filler choices belong to this selected refrigerator's
      // configured source-part set.  They must travel with it, not block its
      // own preview.  The shared envelope exposes an end panel as the magnetic
      // contact edge so the refrigerator snaps flush to the adjacent base.
      const refrigeratorEnvelope = refrigeratorMagneticSnapEnvelope(cabinet, cabinets, room);
      const refrigeratorMemberUids = new Set(configuredRefrigeratorAssemblyMembers(cabinets, cabinet, room)
        .map(({ member }) => member.uid));
      const peers = cabinets.filter((c) => c.uid !== cabinet.uid && !refrigeratorMemberUids.has(c.uid));
      const wallMove = cabinet.islandFace
        ? null
        : cabinetWallMovePreview(candidate, { x: rawX, y: rawY }, room, peers, openings, {
            magnet: automaticSnapping,
            seamToleranceIn: automaticSnapping ? CABINET_CONFLICT_LOCK_IN : undefined,
	          magneticEnvelope: refrigeratorEnvelope,
          });
      if (wallMove?.candidate) {
        setHoverSnap(true);
        setHoverSnapWall(true);
        onMove(
          dragUid,
          wallMove.candidate.x,
          wallMove.candidate.y,
          wallMove.candidate.rotation,
          true,
          { wallId: wallMove.candidate.wallId ?? undefined, wallOffset: wallMove.candidate.wallOffset ?? undefined },
        );
        return;
      }
      if (wallMove?.failure && wallMove.failure !== "no-wall") {
        // The chosen run has no clear opening; hold the last committed spot.
        setHoverSnap(false);
        setHoverSnapWall(false);
        return;
      }
      // Include appliances in the others list so dragged cabinets push against
      // appliances (fridge, range, dishwasher, etc.) and don't slide through them.
      const others = cabinets.filter(
        (c) => c.uid !== cabinet.uid &&
          (c.placement === cabinet.placement || c.placement === "appliance" || cabinet.placement === "appliance" || c.placement === "tall" || cabinet.placement === "tall")
      );
      const targetRot = orientToWall(candidate, room, island);
      if (targetRot != null) {
        candidate = { ...candidate, rotation: targetRot };
      }
      const snapped = automaticSnapping
        ? snapPosition(candidate, room, others, island)
        : { x: candidate.x, y: candidate.y, snappedWall: false, snappedIsland: false, snappedCabinet: false, snappedGrid: false };
      setHoverSnap(snapped.snappedWall || snapped.snappedIsland || snapped.snappedCabinet || snapped.snappedGrid);
      setHoverSnapWall(Boolean(snapped.snappedWall));
      onMove(dragUid, snapped.x, snapped.y, targetRot ?? undefined);
    },
    [dragUid, cabinets, ppi, room, island, onMove, openings, automaticSnapping]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    const snappedUid = dragUid;
    if (snappedUid) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { /* ignore */ }
    }
    if (snappedUid && hoverSnapWall) {
      setWallSnapSuccessUid(snappedUid);
      if (wallSnapSuccessTimeout.current != null) clearTimeout(wallSnapSuccessTimeout.current);
      wallSnapSuccessTimeout.current = setTimeout(() => {
        setWallSnapSuccessUid(null);
        wallSnapSuccessTimeout.current = null;
      }, 1600);
    }
    setDragUid(null);
    setHoverSnap(false);
    setHoverSnapWall(false);
  };

  // Live drag tape-measure: while dragging a cabinet, bracket it along its wall
  // and show the clearance on BOTH sides (to the neighbor cabinet edge, else the
  // wall). Built in inches then scaled to px for the overlay.
  // The tape shows while a cabinet is being dragged AND, for convenience, when a
  // cabinet is simply selected (idle) so the designer can read the clearance to
  // each neighbor/wall without nudging it. Drag takes priority.
  const tapeUid = dragUid ?? (measureMode ? null : selectedUid);
	  const dragTape = (() => {
	    if (!tapeUid) return null;
    const p = cabinets.find((c) => c.uid === tapeUid);
    if (!p) return null;
    const side = cabinetWall(p, room);
    const m = wallSpanMeasure(p, room, cabinets, side);
	    const frame = wallRunFrame(side, room);
	    if (!frame) return null;
	    // Draw just beyond the cabinet front using the same inward normal that
	    // seats the cabinet. The readout stays parallel to a 45° measured run.
	    const lineIn = Math.max(0, Number(p.depth) || 0) + 3;
	    const pointAt = (along: number) => ({
	      x: (frame.start.x + frame.tangent.x * along + frame.inward.x * lineIn) * ppi,
	      y: (frame.start.y + frame.tangent.y * along + frame.inward.y * lineIn) * ppi,
	    });
	    return { m, frame, pointAt };
	  })();

	  const activeIslandFaceCapacityWarning = (() => {
	    if (!catalogDragCabinet || !island || !catalogDragFit) return null;
	    const requiredWidth = resolvedDesignCabinetDimensions(catalogDragCabinet).width;
	    const capacity = islandFaceCapacity(island, activeIslandFace, cabinets);
	    if (requiredWidth <= capacity.largestOpenSpan + 0.01) return null;
	    return { requiredWidth, remaining: capacity.largestOpenSpan, shortage: requiredWidth - capacity.largestOpenSpan };
	  })();
	  const lowSillWindows = openings.filter(isWindowBelowCountertop);

  // Compute the point-to-point tape in the same inch coordinate system used by
  // all placed cabinets, walls, openings, and clearances.
  const measure = (() => {
    if (measurePoints.length !== 2) return null;
    const [a, b] = measurePoints;
    const { dx, dy, distance } = planTapeMeasure(a, b);
    const ax = a.x * ppi;
    const ay = a.y * ppi;
    const bx = b.x * ppi;
    const by = b.y * ppi;
    return { ax, ay, bx, by, midX: (ax + bx) / 2, midY: (ay + by) / 2, dx, dy, distIn: distance };
  })();

  return (
    <div
      ref={containerRef}
      data-testid="floor-plan-canvas"
      data-floor-plan-zoom={floorPlanZoom}
      className={`relative w-full h-full overflow-hidden bg-[#eef1f5] select-none touch-none ${drawMode || measureMode ? "cursor-crosshair" : ""}`}
      onClick={(e) => { if (!measureMode && !drawMode && e.target === e.currentTarget) { onSelect(null); onSelectPonyWall?.(null); } }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
	  onPointerCancel={() => { planPanDrag.current = null; drawStart.current = null; setDrawRect(null); }}
      onWheel={(event) => {
        if (drawMode || measureMode) return;
        setZoom(floorPlanZoom + (event.deltaY < 0 ? FLOOR_PLAN_ZOOM_STEP : -FLOOR_PLAN_ZOOM_STEP));
      }}
	      onDragOver={(e) => {
	        e.preventDefault();
	        if (!catalogDragCabinet) return;
		        const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement | null;
		        if (!roomEl) return;
		        const rect = roomEl.getBoundingClientRect();
		        const point = { x: (e.clientX - rect.left) / ppi, y: (e.clientY - rect.top) / ppi };
		        const catalogDimensions = resolvedDesignCabinetDimensions(catalogDragCabinet);
		        const peninsulaHit = peninsulaRunHitAtPoint(room, point, peninsulaCatalogDropHitRadiusIn(catalogDimensions.depth, ppi));
		        const nearestRun = peninsulaHit ? null : nearestWallRunAtPoint(room, point);
		        const side = (peninsulaHit?.run.id ?? nearestRun?.frame.id ?? nearestRectRoomWallAtPoint(room, point)) as WallSide;
		        const placement: "wall" | "base" = catalogDragCabinet.placement === "wall" ? "wall" : "base";
		        const width = catalogDimensions.width;
	        const targetAlong = peninsulaHit?.offset
	          ?? (nearestRun ? nearestRun.along : side === "top" || side === "bottom" ? point.x : point.y);
        const gaps = peninsulaHit || nearestRun
          ? freeSegmentsOnWall(side, room, cabinets, openings, 0.5, 0, placement, false, undefined, catalogDimensions.depth).map((segment) => ({
	              side,
	              layer: placement,
	              start: segment.start,
	              length: segment.length,
	              center: segment.start + segment.length / 2,
	              isStandardSize: false,
	              isFillerSize: segment.length <= 6,
	            }))
	          : wallGaps(room, cabinets, openings, 0.5).filter((gap) => gap.side === side && gap.layer === placement);
	        setCatalogDragFreehand(!automaticSnapping);
	        setCatalogDragFit(automaticSnapping ? wallGapFitPreview(gaps, targetAlong, width) : wallGapFreehandPreview(gaps, targetAlong, width));
	      }}
	      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setCatalogDragFit(null); setCatalogDragFreehand(false); } }}
	      onDrop={(e) => {
	        e.preventDefault();
	        const roomEl = containerRef.current?.querySelector("[data-room]") as HTMLElement;
		        if (roomEl && onDropNew) {
		          const rect = roomEl.getBoundingClientRect();
		          const point = { x: (e.clientX - rect.left) / ppi, y: (e.clientY - rect.top) / ppi };
		          const dragDepth = catalogDragCabinet ? resolvedDesignCabinetDimensions(catalogDragCabinet).depth : 0;
		          const peninsulaWall = peninsulaRunHitAtPoint(room, point, peninsulaCatalogDropHitRadiusIn(dragDepth, ppi))?.run.id;
	          const targetWall = (peninsulaWall ?? nearestWallRunAtPoint(room, point)?.frame.id) as WallSide | undefined;
	          onDropNew(e.clientX, e.clientY, rect, ppi, !automaticSnapping, targetWall);
	        }
	        setCatalogDragFit(null);
	        setCatalogDragFreehand(false);
      }}
	    >
	      {lowSillWindows.length > 0 && (
	        <div
	          role="alert"
	          data-testid="low-sill-window-conflict"
	          className="pointer-events-none absolute left-3 top-3 z-[70] max-w-[min(28rem,calc(100%-1.5rem))] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 shadow-sm"
	        >
	          {lowSillWindows.length === 1
	            ? `${lowSillWindows[0].label || "Window"} sill is below the ${formatEighthInches(STD.COUNTERTOP_HEIGHT)} countertop height. Raise the sill or revise the base run.`
	            : `${lowSillWindows.length} window sills are below the ${formatEighthInches(STD.COUNTERTOP_HEIGHT)} countertop height. Raise the sills or revise the base runs.`}
	        </div>
	      )}
	      {/* Live draw-room rectangle (container coordinates) */}
      {drawMode && drawRect && (
        <div
          className="pointer-events-none absolute z-50 border-2 border-dashed border-[#d4a75a] bg-[#d4a75a]/10"
          style={{ left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-[#1a2744] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {(() => {
              const w = clampRoomInches(drawRect.w / ppi);
              const h = clampRoomInches(drawRect.h / ppi);
              return `${formatDisplayDimension(w)} × ${formatDisplayDimension(h)}`;
            })()}
          </span>
        </div>
      )}
      <div
	        data-room
	        data-four-anchor-guide-active={positionedFourAnchorWallGuides.length > 0 ? "true" : undefined}
	        className="absolute shadow-inner"
        onPointerDownCapture={onRoomMeasurePointerDown}
        style={{
          width: roomPxW,
          height: roomPxH,
	          left: `calc(50% + ${floorPlanPan.x - fourAnchorGuideDockOffsetPx}px)`,
          top: `calc(50% + ${floorPlanPan.y}px)`,
          transform: "translate(-50%, -50%)",
          border: "none",
          backgroundColor: flooringMaterialId
            ? flooringMaterial(flooringMaterialId).fill
            : "#ffffff",
          backgroundImage: (() => {
            if (!flooringMaterialId) {
              return "linear-gradient(#f1f4f8 1px, transparent 1px), linear-gradient(90deg, #f1f4f8 1px, transparent 1px)";
            }
            const fm = flooringMaterial(flooringMaterialId);
            const tw = Math.max(6, fm.tileW * ppi);
            const th = Math.max(6, fm.tileH * ppi);
            if (fm.pattern === "hardwood" || fm.pattern === "plank") {
              // Plank rendering varies by the user-selected layout pattern.
              const g = fm.grout;
              if (flooringPattern === "herringbone") {
                // Herringbone: V-shape zigzag planks at 45°
                return `repeating-linear-gradient(45deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(-45deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${th}px)`;
              }
              if (flooringPattern === "diagonal") {
                // Diagonal: planks at 45° with staggered seams
                const h2 = th * 2;
                const offset = Math.round(tw / 3);
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
                  + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
                  + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
                  + `</svg>`;
                return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
              }
              if (flooringPattern === "third-offset") {
                // 1/3 Offset: each row offset by exactly 1/3 plank length (3-row repeat)
                const h3 = th * 3;
                const off1 = Math.round(tw / 3);
                const off2 = Math.round((tw * 2) / 3);
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h3}'>`
                  + `<rect x='0' y='0' width='${tw}' height='${h3}' fill='none'/>`
                  + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='0' y1='${th * 2}' x2='${tw}' y2='${th * 2}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='${off1}' y1='${th}' x2='${off1}' y2='${th * 2}' stroke='${g}' stroke-width='1'/>`
                  + `<line x1='${off2}' y1='${th * 2}' x2='${off2}' y2='${h3}' stroke='${g}' stroke-width='1'/>`
                  + `</svg>`;
                return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
              }
              // Default: random-stagger (2-row repeat with 1/3 offset — looks natural)
              const offset = Math.round(tw / 3);
              const h2 = th * 2;
              const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
                + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
                + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
                + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
                + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
                + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
                + `</svg>`;
              return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            }
            if (fm.pattern === "tile-grid" || fm.pattern === "tile-diagonal") {
              return `repeating-linear-gradient(0deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(90deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${tw}px)`;
            }
            if (fm.pattern === "tile-stagger") {
              // Brick-lay for rectangular tiles: offset every other row by half tile width.
              const g = fm.grout;
              const offset = Math.round(tw / 2);
              const h2 = th * 2;
              const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
                + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
                + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
                + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
                + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
                + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
                + `</svg>`;
              return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            }
            if (fm.pattern === "herringbone") {
              return `repeating-linear-gradient(45deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(-45deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${th}px)`;
            }
            if (fm.pattern === "chevron") {
              return `repeating-linear-gradient(60deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(-60deg, ${fm.grout} 0px, ${fm.grout} 1px, transparent 1px, transparent ${th}px)`;
            }
            // solid / concrete
            return undefined;
          })(),
          backgroundSize: (() => {
            if (!flooringMaterialId) return `${12 * ppi}px ${12 * ppi}px`;
            const fm = flooringMaterial(flooringMaterialId);
            const tw = Math.max(6, fm.tileW * ppi);
            const th = Math.max(6, fm.tileH * ppi);
            if ((fm.pattern === "hardwood" || fm.pattern === "plank") && flooringPattern === "third-offset") {
              return `${tw}px ${th * 3}px`;
            }
            // Staggered patterns use a 2-row SVG tile, so double the height.
            if (fm.pattern === "hardwood" || fm.pattern === "plank" || fm.pattern === "tile-stagger") {
              return `${tw}px ${th * 2}px`;
            }
            return `${tw}px ${th}px`;
          })(),
        }}
      >
	        {positionedFourAnchorWallGuides.length > 0 && (
	          <div data-testid="four-anchor-wall-guide" className="pointer-events-none absolute inset-0 z-[28]" aria-label="Four-anchor wall guide">
	            {positionedFourAnchorWallGuides.map(({ guide, labelPosition, startPosition }) => (
	              <Fragment key={guide.label}>
	                <span
	                  data-testid="four-anchor-wall-guide-label"
	                  data-wall-label={guide.label}
	                  data-wall-color={guide.color}
	                  aria-label={`${guide.label}. Measure from the matching colored dot.`}
	                  title={`${guide.label} — measure from the matching colored dot.`}
	                  tabIndex={0}
	                  className="group pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-help place-items-center rounded-full border-2 border-white text-xs font-black text-white shadow-[0_1px_4px_rgba(15,23,42,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-sky-950 focus-visible:ring-offset-2"
	                  style={{ ...labelPosition, backgroundColor: guide.color }}
	                >
	                  {guide.label.replace("Wall ", "")}
	                  <span data-testid="four-anchor-wall-guide-tooltip" role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded bg-slate-950 px-2 py-1 text-center text-[10px] font-semibold leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
	                    {guide.label} — measure from the matching colored dot.
	                  </span>
	                </span>
	                <span
	                  data-testid="four-anchor-wall-guide-start"
	                  data-wall-label={guide.label}
	                  aria-label={`${guide.label} measurement start`}
	                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(15,23,42,0.55)]"
	                  style={{ ...startPosition, backgroundColor: guide.color }}
	                />
	              </Fragment>
	            ))}
	          </div>
	        )}
	        {openingReferencePoint && (
          <div
            data-testid="window-measurement-reference-marker"
            aria-label={`${openingReferencePoint.label} measurement reference`}
            className="pointer-events-none absolute z-[36]"
            style={{ left: openingReferencePoint.x * ppi, top: openingReferencePoint.y * ppi, transform: "translate(-50%, -50%)" }}
          >
            <span className="absolute -inset-2 rounded-full border-2 border-emerald-500/80 bg-emerald-300/20 shadow-[0_0_0_4px_rgba(16,185,129,0.18)] animate-pulse" />
            <span className="relative block h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              {openingReferencePoint.label}
            </span>
          </div>
        )}
        {hasCustomWallShell ? (
          <svg className="pointer-events-none absolute inset-0 z-[2] overflow-visible" width={roomPxW} height={roomPxH} aria-label="User measured walls">
	          {customWallShellOutlines.map((outline) => {
	              const wall = room.customWalls!.find((candidate) => candidate.id === outline.id);
	              if (!wall) return null;
	              const start = room.vertices!.find((vertex) => vertex.id === wall.startVertexId);
	              const end = room.vertices!.find((vertex) => vertex.id === wall.endVertexId);
	              if (!start || !end) return null;
              const x1 = start.x * ppi;
              const y1 = start.y * ppi;
              const x2 = end.x * ppi;
              const y2 = end.y * ppi;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const length = Math.hypot(end.x - start.x, end.y - start.y);
              const labelAngle = parallelWallLabelAngleDeg(end.x - start.x, end.y - start.y);
              const active = activeWall === wall.id;
	              const outlinePoints = outline.corners.map((corner) => `${corner.x * ppi},${corner.y * ppi}`).join(" ");
	              return <g key={wall.id}>
	                <polygon
	                  data-testid="custom-wall-mitered-outline"
	                  points={outlinePoints}
	                  fill={active ? "#d4a75a" : "#1a2744"}
	                  fillOpacity={active ? 0.9 : 0.78}
	                  stroke={active ? "#b98632" : "#1a2744"}
	                  strokeWidth={1}
	                  strokeLinejoin="miter"
	                  className="pointer-events-none"
	                />
	                <line
	                  data-testid="custom-wall-context-target"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={32}
	                  strokeLinecap="butt"
                  className="pointer-events-auto cursor-pointer"
                  aria-label={`Right-click ${wall.label ?? "wall"} for Attributes`}
                  onPointerDown={(event) => onWallPointerDown(event, wall.id as WallSide)}
                  onContextMenu={(event) => onWallContextMenu(event, wall.id as WallSide)}
                  onDoubleClick={(event) => onWallContextMenu(event, wall.id as WallSide)}
                >
                  <title>{`Right-click ${wall.label ?? "wall"} for Attributes`}</title>
                </line>
	                {!autoDimensions && measurementBubblesVisible && <g data-testid="custom-wall-length-bubble" className="pointer-events-none" transform={`translate(${midX} ${midY}) rotate(${labelAngle})`} style={measurementBubbleStyle}>
                  <rect x={-29} y={-10} width={58} height={18} rx={5} fill="white" fillOpacity={0.94} stroke={active ? "#d4a75a" : "#cbd5e1"} />
                  <text x={0} y={3} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1a2744">{formatDisplayDimension(length)}</text>
                </g>}
              </g>;
            })}
          </svg>
        ) : (
          /* A peninsula opens its parent wall at the attachment. Draw the room
             shell as individual wall segments so the open continuation remains visible. */
          (["top", "bottom", "left", "right"] as WallSide[]).map((side) => {
            const segment = cabinetWallRunSegment(side, room);
            const horizontal = side === "top" || side === "bottom";
            return <div
              key={`room-wall-${side}`}
              data-testid={`room-wall-${side}`}
              className={`pointer-events-none absolute z-[1] bg-[#1a2744] ${horizontal ? "h-[3px]" : "w-[3px]"}`}
              style={horizontal
                ? { left: segment.start * ppi, width: segment.length * ppi, top: side === "top" ? 0 : undefined, bottom: side === "bottom" ? 0 : undefined }
                : { top: segment.start * ppi, height: segment.length * ppi, left: side === "left" ? 0 : undefined, right: side === "right" ? 0 : undefined }}
            />;
          })
        )}
        {peninsulaDraft && (() => {
          const { start, end, radians } = peninsulaRunEndpoints(peninsulaDraft, room);
          const degrees = (radians * 180) / Math.PI;
          const lengthPx = Math.max(12, peninsulaDraft.length * ppi);
          return (
            <div
              data-testid="peninsula-run-draft"
              className="absolute z-[24] h-3 cursor-grab rounded-full border-2 border-dashed border-[#d4a75a] bg-[#d4a75a]/25 shadow-[0_0_0_2px_rgba(26,39,68,0.2)] active:cursor-grabbing"
              style={{
                left: start.x * ppi,
                top: start.y * ppi - 6,
                width: lengthPx,
                transform: `rotate(${degrees}deg)`,
                transformOrigin: "0 50%",
              }}
            >
              <span className="pointer-events-none absolute left-1/2 -top-7 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a2744] px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                Pull peninsula · {formatDisplayDimension(peninsulaDraft.length)}
              </span>
              <button
                type="button"
                aria-label="Pull peninsula run to set its length"
                title="Drag to pull the new peninsula run to its final length"
                className="absolute -right-3 -top-3 grid h-8 w-8 touch-none place-items-center rounded-full border-2 border-[#d4a75a] bg-[#1a2744] text-xs font-bold text-white shadow"
                onPointerDown={(event) => onPeninsulaPullDown(event, peninsulaDraft)}
                onPointerMove={onPeninsulaPullMove}
                onPointerUp={onPeninsulaPullUp}
              >
                ↔
              </button>
              <span className="pointer-events-none absolute -left-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-[#1a2744] bg-white" />
              <span className="pointer-events-none absolute -right-px -top-0.5 h-2 w-2 rounded-full bg-[#d4a75a]" />
              <span className="sr-only">Peninsula draft ending at {end.x}, {end.y}</span>
            </div>
          );
        })()}
	        {catalogDragFit && (() => {
	          const { gap } = catalogDragFit;
	          const customWall = room.customWalls?.find((wall) => wall.id === gap.side);
	          const customStart = customWall && room.vertices?.find((vertex) => vertex.id === customWall.startVertexId);
	          const customEnd = customWall && room.vertices?.find((vertex) => vertex.id === customWall.endVertexId);
	          const customLength = customStart && customEnd ? Math.hypot(customEnd.x - customStart.x, customEnd.y - customStart.y) : 0;
	          const customTangent = customStart && customEnd && customLength > 0
	            ? { x: (customEnd.x - customStart.x) / customLength, y: (customEnd.y - customStart.y) / customLength }
	            : null;
	          const customAngle = customTangent ? Math.atan2(customTangent.y, customTangent.x) * 180 / Math.PI : 0;
	          const horizontal = Boolean(customTangent) || gap.side === "top" || gap.side === "bottom";
	          const depthIn = gap.layer === "wall" ? 12 : 24;
	          const valid = catalogDragFit.status === "valid";
	          const tooLarge = !valid && catalogDragFit.shortage > 0;
	          const layerCandidates = smartGapCandidates.filter((cabinet) => {
	            const dimensions = resolvedDesignCabinetDimensions(cabinet);
	            return (gap.layer === "wall" ? cabinet.placement === "wall" : cabinet.placement !== "wall") && dimensions.height > 0;
	          });
	          const exactFits = layerCandidates
	            .filter((cabinet) => Math.abs(resolvedDesignCabinetDimensions(cabinet).width - gap.length) <= 0.01)
	            .sort((left, right) => left.masterCode.localeCompare(right.masterCode));
	          const suggestedFit = exactFits[0] ? { cabinet: exactFits[0], remaining: 0 } : bestFitCatalogOption(gap, layerCandidates);
	          const gapStyle: React.CSSProperties = customTangent && customStart
	            ? {
	                left: (customStart.x + customTangent.x * gap.start) * ppi,
	                top: (customStart.y + customTangent.y * gap.start) * ppi,
	                width: gap.length * ppi,
	                height: depthIn * ppi,
	                transform: `rotate(${customAngle}deg)`,
	                transformOrigin: "0 0",
	              }
	            : horizontal
	            ? { left: gap.start * ppi, top: gap.side === "top" ? 0 : roomPxH - depthIn * ppi, width: gap.length * ppi, height: depthIn * ppi }
            : { left: gap.side === "left" ? 0 : roomPxW - depthIn * ppi, top: gap.start * ppi, width: depthIn * ppi, height: gap.length * ppi };
	          const snapStyle: React.CSSProperties = horizontal
	            ? { left: (catalogDragFit.snapStart - gap.start) * ppi, top: 0, width: catalogDragFit.requiredSpan * ppi, height: depthIn * ppi }
	            : { left: 0, top: (catalogDragFit.snapStart - gap.start) * ppi, width: depthIn * ppi, height: catalogDragFit.requiredSpan * ppi };
	          const spanLabelStyle: React.CSSProperties = horizontal
	            ? { left: "50%", top: 4, transform: "translateX(-50%)" }
	            : { left: 4, top: "50%", transform: "translateY(-50%)" };
	          const remainingSegments = [
	            { key: "before", inches: catalogDragFit.before, offset: 0 },
	            { key: "after", inches: catalogDragFit.after, offset: catalogDragFit.snapEnd - gap.start },
	          ].filter((segment) => segment.inches > 0.01);
	          return <div data-testid="catalog-drag-gap-highlight" data-too-large={tooLarge ? "true" : "false"} aria-hidden="true" className={`pointer-events-none absolute z-[18] border-2 ${valid ? "border-emerald-600 bg-emerald-300/25" : "border-rose-700 bg-rose-300/35"}`} style={gapStyle}>
	            <span data-testid="catalog-drag-clear-span" className="absolute z-20 whitespace-nowrap rounded bg-[#1a2744] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow" style={spanLabelStyle}>
	              Clear span · {formatEighthInches(gap.length)}
	            </span>
	            {suggestedFit && <span data-testid="catalog-drag-best-fit" className={`absolute z-20 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow ${tooLarge ? "bg-rose-800" : "bg-emerald-800"}`} style={{ ...spanLabelStyle, ...(horizontal ? { top: 23 } : { left: 23 }) }}>
	              {suggestedFit.remaining <= 0.01 ? `Perfect fit · ${suggestedFit.cabinet.masterCode}` : `Largest fit · ${suggestedFit.cabinet.masterCode}`}
	            </span>}
	            {tooLarge && <span data-testid="catalog-drag-too-large" className="absolute z-20 whitespace-nowrap rounded bg-rose-800 px-1.5 py-1 text-[10px] font-bold leading-none text-white shadow" style={{ ...spanLabelStyle, ...(horizontal ? { top: 42 } : { left: 42 }) }}>
	              {catalogDragCabinet?.masterCode ?? "Cabinet"} needs {formatEighthInches(catalogDragFit.requiredSpan)} · opening {formatEighthInches(catalogDragFit.availableSpan)} · short {formatEighthInches(catalogDragFit.shortage)}
	            </span>}
	            {valid && <div data-testid="catalog-drag-snap-ghost" data-freehand={catalogDragFreehand ? "true" : "false"} data-perfect-fit={Math.abs(catalogDragFit.availableSpan - catalogDragFit.requiredSpan) <= 0.01 ? "true" : "false"} className="absolute flex items-center justify-center border-2 border-dashed border-emerald-800 bg-emerald-400/35 shadow-[0_0_0_2px_rgba(255,255,255,0.85),0_0_18px_rgba(5,150,105,0.55)]" style={snapStyle}>
	              <span data-testid="catalog-drag-ghost-label" className="max-w-full truncate rounded bg-emerald-900/90 px-1.5 py-1 text-[9px] font-bold leading-none text-white shadow">
	                {Math.abs(catalogDragFit.availableSpan - catalogDragFit.requiredSpan) <= 0.01 ? "Perfect fit" : "Fits here"} · {catalogDragCabinet?.masterCode ?? formatEighthInches(catalogDragFit.requiredSpan)}
	              </span>
	            </div>}
	            {valid && remainingSegments.map((segment) => {
	              const lineStyle: React.CSSProperties = horizontal
	                ? { left: segment.offset * ppi, top: "50%", width: segment.inches * ppi }
	                : { left: "50%", top: segment.offset * ppi, height: segment.inches * ppi };
	              return <div key={segment.key} data-testid={`catalog-drag-remaining-${segment.key}`} className={`absolute z-[19] border-[#1a2744] ${horizontal ? "border-t-2" : "border-l-2"}`} style={lineStyle}>
	                <span className={`absolute rounded bg-[#1a2744] px-1 py-0.5 text-[9px] font-bold leading-none text-white shadow ${horizontal ? "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" : "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}>{formatEighthInches(segment.inches)}</span>
	              </div>;
	            })}
	          </div>;
        })()}
		{(room.peninsulaRuns ?? []).map((run) => {
		  const { start, radians } = peninsulaRunEndpoints(run, room);
		  const runDegrees = (radians * 180) / Math.PI;
		  const counterRotate: React.CSSProperties = { transform: `rotate(${-runDegrees}deg)` };
		  const active = activeWall === run.id;
		  const runLocked = peninsulaRunAssemblyLocked(run, room);
		  const wizardRootId = peninsulaRootRunId(run, room);
			  const wizardRoot = room.peninsulaRuns?.find((candidate) => candidate.id === wizardRootId);
			  const wizardEditable = wizardRoot?.wizardRecipe?.schemaVersion === 1;
          const parentWall = run.parentWall;
	          const parentWallIsCardinal = parentWall === "top" || parentWall === "bottom" || parentWall === "left" || parentWall === "right";
	          const parentWallLabel = room.customWalls?.find((wall) => wall.id === parentWall)?.label ?? (parentWallIsCardinal ? wallLabel[parentWall] : "selected wall");
	          const primaryAttachmentMeasure = !run.parentRunId && parentWallIsCardinal
	            ? Math.max(0, Number(run.startOffset) || 0)
	            : null;
          const attachmentMeasureHorizontal = parentWall === "top" || parentWall === "bottom";
          const attachmentMeasureStyle: React.CSSProperties | undefined = primaryAttachmentMeasure == null
            ? undefined
            : attachmentMeasureHorizontal
              ? {
                  // Keep the parent-wall measurement outside the room. It is a
                  // drawing dimension, not a cabinet label, so it must never
                  // cover an ERB or the peninsula corner snap target.
                  left: Math.max(3, start.x * ppi / 2 - 56),
                  top: parentWall === "top" ? -25 : roomPxH + 10,
                }
              : {
                  left: parentWall === "left" ? -132 : roomPxW + 10,
                  top: Math.max(3, start.y * ppi / 2 - 10),
                };
          return (
            <Fragment key={run.id}>
            {measurementBubblesVisible && primaryAttachmentMeasure != null && <span
                data-testid="peninsula-attachment-measurement"
                title="Measured parent-wall segment from the wall start corner to this peninsula attachment; displayed outside the room so it does not cover cabinets"
                className="pointer-events-none absolute z-20 whitespace-nowrap rounded border border-slate-300 bg-white/95 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950 shadow-sm"
                style={{ ...attachmentMeasureStyle, ...measurementBubbleStyle }}
              >
                Wall start → peninsula · {formatEighthInches(primaryAttachmentMeasure)}
              </span>}
            <div
              data-testid="peninsula-run-segment"
              role="button"
              tabIndex={0}
	              aria-label={run.parentRunId
	                ? `Select ${run.label ?? "peninsula return"}; it is attached to its parent peninsula endpoint${wizardEditable ? " and is Wizard-built and editable" : ""}${runLocked ? " and locked" : ""}`
	                : `Select ${run.label ?? "peninsula run"};${wizardEditable ? " Wizard-built and editable;" : ""} ${runLocked ? "its attachment is locked" : `hold and drag it along the adjoining ${parentWallLabel} wall to move the attachment point`}`}
	              title={run.parentRunId
	                ? `${run.turn}° ${run.direction} connected return · ${formatEighthInches(run.length)} · ${run.height}" high${wizardEditable ? ". Wizard-built and editable in Peninsula Wizard." : ""}${runLocked ? " Peninsula assembly locked." : ". Right-click for Attributes."}`
	                : `${run.turn}° ${run.direction} peninsula · ${formatEighthInches(run.length)} · ${run.height}" high.${wizardEditable ? " Wizard-built and editable in Peninsula Wizard." : ""}${runLocked ? " Peninsula assembly locked; unlock in Attributes before moving its attachment." : " Right-click for Attributes; hold and drag the line to move its attachment along the adjoining wall."}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectWall?.(run.id as WallSide);
	                if (!run.parentRunId && !runLocked) onPeninsulaAttachmentPointerDown(event, run);
	              }}
	              onPointerMove={run.parentRunId || runLocked ? undefined : onPeninsulaAttachmentPointerMove}
	              onPointerUp={run.parentRunId || runLocked ? undefined : onPeninsulaAttachmentPointerUp}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectWall?.(run.id as WallSide);
                onOpenWallSettings?.(run.id as WallSide);
              }}
	              className={`absolute z-[3] h-3 rounded-full border-2 shadow-sm ${runLocked ? "cursor-default" : "cursor-pointer"} ${active ? "border-[#d4a75a] bg-[#1a2744]" : "border-[#1a2744] bg-[#d4a75a]/80"}`}
	              style={{
	                left: start.x * ppi,
	                top: start.y * ppi - 6,
	                width: Math.max(12, run.length * ppi),
	                transform: `rotate(${runDegrees}deg)`,
	                transformOrigin: "0 50%",
	              }}
	                >
	              {wizardEditable && run.parentRunId && <span
	                data-testid="peninsula-wizard-built-badge"
	                className="pointer-events-none absolute z-10 whitespace-nowrap rounded border border-emerald-700 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-emerald-950 shadow-sm"
	                style={{ left: "50%", top: -52, transform: `translateX(-50%) rotate(${-runDegrees}deg)`, transformOrigin: "center" }}
	              >
	                WIZARD-BUILT · EDITABLE
	              </span>}
	              <span
	                data-testid="peninsula-plan-label"
	                className="pointer-events-none absolute z-10 whitespace-nowrap rounded border border-[#d4a75a]/70 bg-white/95 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-[#1a2744] shadow-sm"
	                style={{
	                  left: "50%",
	                  top: -23,
	                  transform: `translateX(-50%) rotate(${-runDegrees}deg)`,
	                  transformOrigin: "center",
	                }}
	              >
	                {run.parentRunId ? `PENINSULA · ${run.turn}° ${run.direction} RETURN` : `PENINSULA · ${formatEighthInches(run.length)}`}
	                {wizardEditable && !run.parentRunId && <span data-testid="peninsula-wizard-built-badge" className="ml-1 rounded border border-emerald-700 bg-emerald-50 px-1 py-px text-emerald-950">WIZARD-BUILT · EDITABLE</span>}
	                {runLocked ? " · LOCKED" : ""}
	              </span>
	              {active && <>
	                {!run.parentRunId && !runLocked && <button
                  type="button"
                  aria-label="Drag joined peninsula end along adjoining wall"
                  title="Hold and drag along the adjoining wall to move this peninsula attachment"
                  onPointerDown={(event) => onPeninsulaAttachmentPointerDown(event, run)}
                  onPointerMove={onPeninsulaAttachmentPointerMove}
                  onPointerUp={onPeninsulaAttachmentPointerUp}
                  style={counterRotate}
                  className="absolute -left-2 -top-[4px] z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#1a2744] text-[10px] font-bold text-white shadow"
                >↔</button>}
                <button
                  type="button"
                  aria-label="Add a connected 45° or 90° wall from the far peninsula end"
                  title="Compass: add a new connected 45° or 90° wall from this end"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectWall?.(run.id as WallSide);
                    onOpenWallSettings?.(run.id as WallSide);
                  }}
                  style={counterRotate}
                  className="absolute -right-2 top-[18px] z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[#a87f33] bg-white text-[#1a2744] shadow"
                >
                  <Compass className="h-3 w-3" />
                </button>
              </>}
            </div>
            </Fragment>
          );
        })}
        {/* Wall bands: touch to select and highlight only. Rendered first so
            they sit beneath cabinets; Room Size owns explicit dimension edits. */}
        {onSelectWall && !hasCustomWallShell && !measureMode && !drawMode && (["top", "bottom", "left", "right"] as WallSide[]).map((side) => {
          const horizontal = side === "top" || side === "bottom";
          const isActive = activeWall === side;
          const wallLocked = isWallLocked(side);
          const compassStart = compassStartForWall(side);
          const band = 14;
          const retainedWall = cabinetWallRunSegment(side, room);
          const prospectiveRetainedWall = retainedWallSegmentForSplit(side, room, compassStart);
          const showCompassRetainedPreview = wallCompassVisible && isActive && compassPreviewVisible && !layoutLocked && Boolean(onWallCompassDrop);
          const visibleStart = retainedWall.start * ppi;
          const visibleLength = retainedWall.length * ppi;
          const wstyle: React.CSSProperties = horizontal
            ? {
                left: visibleStart,
                width: visibleLength,
                height: band,
                top: side === "top" ? 0 : roomPxH - band,
                cursor: "pointer",
              }
            : {
                top: visibleStart,
                height: visibleLength,
                width: band,
                left: side === "left" ? 0 : roomPxW - band,
                cursor: "pointer",
              };
          return (
            <div
              key={`wall-${side}`}
              onPointerDown={(e) => onWallPointerDown(e, side)}
              onContextMenu={(event) => onWallContextMenu(event, side)}
              onDoubleClick={(event) => onWallContextMenu(event, side)}
              className="absolute z-[5] flex items-center justify-center transition-colors"
              style={{
                ...wstyle,
                background: isActive ? "rgba(212,167,90,0.55)" : "transparent",
                boxShadow: isActive ? "inset 0 0 0 2px #d4a75a" : undefined,
              }}
              title={`${t("dt_pc_wall_target", { wall: wallLabel[side] })} · Right-click for Attributes`}
            >
              {showCompassRetainedPreview && (
                <div
                  data-testid="compass-retained-wall-preview"
                  data-retained-start={prospectiveRetainedWall.start}
                  data-retained-length={prospectiveRetainedWall.length}
                  className="pointer-events-none absolute z-10 flex items-center justify-center border-2 border-emerald-700 bg-emerald-300/70 text-[8px] font-bold text-emerald-950 shadow-sm"
                  style={horizontal
                    ? {
                        left: (prospectiveRetainedWall.start - retainedWall.start) * ppi,
                        width: prospectiveRetainedWall.length * ppi,
                        height: band,
                        top: 0,
                      }
                    : {
                        top: (prospectiveRetainedWall.start - retainedWall.start) * ppi,
                        height: prospectiveRetainedWall.length * ppi,
                        width: band,
                        left: 0,
                        writingMode: "vertical-rl",
                      }}
                  aria-label={`Retained wall preview: ${formatEighthInches(prospectiveRetainedWall.length)}`}
                >
                  Retain {formatEighthInches(prospectiveRetainedWall.length)}
                </div>
              )}
              {isActive && (
                <>
                  <span
                    className="pointer-events-none rounded border border-slate-400 bg-white/98 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950 shadow-sm whitespace-nowrap"
                    style={{ transform: horizontal ? "none" : "rotate(-90deg)" }}
                  >
                    {wallLabel[side].toUpperCase()}{wallLocked ? t("dt_pc_wall_locked_suffix") : " SELECTED"}
                  </span>
                  {wallCompassVisible && !layoutLocked && onWallCompassDrop && (
                    <button
                      type="button"
                      aria-label={`Drag Compass along ${wallLabel[side]} wall to set the peninsula split point`}
                      title="Drag toward the wall end for a 45° right turn or toward its start for a 45° left turn"
                      data-testid="on-wall-compass-drag-target"
                      className="absolute z-20 grid h-8 w-8 touch-none place-items-center rounded-md border-2 border-rose-700 bg-rose-700 text-white shadow-md cursor-grab active:cursor-grabbing"
                      style={horizontal
                        ? { left: (compassStart - retainedWall.start) * ppi - 16, top: -9 }
                        : { top: (compassStart - retainedWall.start) * ppi - 16, left: -9 }}
                      onPointerDown={(event) => onCompassPointerDown(event, side)}
                      onPointerMove={onCompassPointerMove}
                      onPointerUp={onCompassPointerUp}
                      onPointerCancel={onCompassPointerCancel}
                      onLostPointerCapture={onCompassPointerCancel}
                      onPointerEnter={() => setCompassPreviewVisible(true)}
                      onPointerLeave={() => { if (!compassDrag.current) setCompassPreviewVisible(false); }}
                      onFocus={() => setCompassPreviewVisible(true)}
                      onBlur={() => { if (!compassDrag.current) setCompassPreviewVisible(false); }}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span className="absolute bottom-0.5 text-[7px] font-bold leading-none">45°</span>
                    </button>
                  )}
                </>
              )}
              {wallLocked && !isActive && (
                <span
                  className="pointer-events-none rounded bg-[#1a2744]/80 px-1 text-[9px] font-bold text-[#d4a75a] shadow"
                  style={{ transform: horizontal ? "none" : "rotate(-90deg)" }}
                  title={t("dt_pc_wall_is_locked", { wall: wallLabel[side] })}
                >
                  🔒
                </span>
              )}
            </div>
          );
        })}
        {/* Countertop slab layer — visible material over base cabinets + island.
            Sits above the floor but below cabinet faces so faces read on top. */}
        {countertopMaterialId && (() => {
          const surfaces = countertopShapes;
          if (surfaces.length === 0) return null;
          return (
            <div className="pointer-events-none absolute inset-0 z-[2]">
              {surfaces.map((s, i) => {
                const mat = countertopMaterial(s.kind === "island" ? islandCountertopMaterialId ?? countertopMaterialId : countertopMaterialId);
                return (
                  <div
                    key={`ct${i}`}
                    data-countertop-scope={s.kind === "island" ? "island" : "perimeter"}
                    data-raised-bar={s.raisedBar ? "true" : undefined}
                    className="absolute"
                    style={{
                      left: s.x * ppi,
                      top: s.y * ppi,
                      width: s.width * ppi,
                      height: s.depth * ppi,
                      background: mat.fill,
                      border: s.raisedBar ? "2px dashed #9a6c22" : `1px solid ${mat.edge}`,
                      boxShadow: s.raisedBar ? "0 0 0 2px rgba(212,167,90,0.34), 0 1px 2px rgba(0,0,0,0.12)" : "0 1px 2px rgba(0,0,0,0.12)",
                      backgroundImage: mat.speckle
                        ? `radial-gradient(${mat.speckle} 0.5px, transparent 0.6px)`
                        : undefined,
                      backgroundSize: mat.speckle ? "6px 6px" : undefined,
                      opacity: s.raisedBar ? 0.76 : 0.92,
                      transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
                      transformOrigin: "50% 50%",
                      clipPath: s.polygon
                        ? `polygon(${s.polygon.map((point) => `${(point.x / s.width) * 100}% ${(point.y / s.depth) * 100}%`).join(", ")})`
                        : undefined,
                    }}
                  >
                    {s.raisedBar && <span className="absolute left-1 top-1 rounded bg-[#fff7df]/90 px-1 text-[8px] font-bold tracking-wide text-[#755117]">42″ BAR</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Sink + faucet fixtures — drawn on top of the counter. */}
        {sinks.map((s) => {
          const isSel = s.uid === selectedSinkUid;
          const verticalWall = s.wallSide === "left" || s.wallSide === "right";
          const isAttachedStandardSink = Boolean(s.cabinetUid && s.frontSetbackIn != null && !s.apronFront);
          return (
            <div
              key={s.uid}
              onPointerDown={(e) => onSinkPointerDown(e, s)}
              onPointerMove={onSinkPointerMove}
              onPointerUp={onSinkPointerUp}
              className={`absolute z-[3] ${onMoveSink && !layoutLocked && !isAttachedStandardSink ? "cursor-move" : ""}`}
	              style={{
	                left: s.x * ppi,
	                top: s.y * ppi,
	                width: s.width * ppi,
	                height: s.depth * ppi,
	                transform: s.planRotation ? `rotate(${s.planRotation}deg)` : undefined,
	                transformOrigin: "50% 50%",
	              }}
              title={isAttachedStandardSink
                ? `${s.pelicanProductName || SINK_PRESETS[s.type].name} · centered with ${formatEighthInches(s.frontSetbackIn!)} front setback`
                : t("dt_pc_sink_drag", { name: s.pelicanProductName || SINK_PRESETS[s.type].name })}
            >
              {/* basin */}
              <div
                className="absolute inset-0 rounded-[3px]"
                style={{
                  background: "#d7dde2",
                  border: isSel ? "2px solid #1a2744" : "1.5px solid #8b949c",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.18)",
                }}
              />
              {s.type === "double" && (
                verticalWall
                  ? <div className="absolute left-[12%] right-[12%] top-1/2 h-px -translate-y-1/2" style={{ background: "#8b949c" }} />
                  : <div className="absolute top-[12%] bottom-[12%] left-1/2 w-px -translate-x-1/2" style={{ background: "#8b949c" }} />
              )}
              {/* faucet — a small fixture centered behind the basin */}
              {s.faucet && (
                s.wallSide === "bottom" ? <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2" style={{ width: Math.max(4, 3 * ppi), height: Math.max(4, 4 * ppi), background: "#5b636b", borderRadius: 2 }} />
                  : s.wallSide === "left" ? <div className="absolute left-[-5px] top-1/2 -translate-y-1/2" style={{ width: Math.max(4, 4 * ppi), height: Math.max(4, 3 * ppi), background: "#5b636b", borderRadius: 2 }} />
                    : s.wallSide === "right" ? <div className="absolute right-[-5px] top-1/2 -translate-y-1/2" style={{ width: Math.max(4, 4 * ppi), height: Math.max(4, 3 * ppi), background: "#5b636b", borderRadius: 2 }} />
                      : <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -5, width: Math.max(4, 3 * ppi), height: Math.max(4, 4 * ppi), background: "#5b636b", borderRadius: 2 }} />
              )}
              {s.faucetDeckConflict === "shallow-countertop-deck" && (
                <span data-testid={`sink-faucet-deck-conflict-${s.uid}`} role="alert" className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-rose-700 px-1 py-0.5 text-[8px] font-bold text-white shadow">
                  REAR DECK TOO SHALLOW
                </span>
              )}
            </div>
          );
        })}

        {/* Wall pot fillers use their manufacturer-published reach, rooted at
            the actual wall behind the associated range/cooktop. The dashed line
            is an installation envelope, not a claimed folded-arm pivot angle. */}
        {potFillers.map((fixture) => {
          const range = potFillerMountedRange(fixture, cabinets, room, island);
          if (!range) return null;
          const frame = planCabinetRenderFrame(range);
          const angle = range.rotation || 0;
          const radians = angle * Math.PI / 180;
          const forward = { x: Math.sin(radians), y: Math.cos(radians) };
          const center = { x: frame.bodyLeft + frame.bodyW / 2, y: frame.bodyTop + frame.bodyD / 2 };
          const rangeDepth = Math.min(frame.bodyW, frame.bodyD);
          const anchor = {
            x: center.x - forward.x * (rangeDepth / 2 + 0.03),
            y: center.y - forward.y * (rangeDepth / 2 + 0.03),
          };
          return (
            <div
              key={fixture.uid}
              data-testid="pot-filler-plan-reach"
              data-range-uid={fixture.rangeUid}
              className="pointer-events-none absolute z-[4]"
              style={{
                left: anchor.x * ppi,
                top: anchor.y * ppi - Math.max(2, ppi * 0.28),
                width: fixture.spoutReachIn * ppi,
                height: Math.max(4, ppi * 0.56),
                transform: `rotate(${angle}deg)`,
                transformOrigin: "0 50%",
              }}
              title={`${fixture.pelicanProductName}: source-measured ${formatEighthInches(fixture.spoutReachIn)} deployed reach from wall`}
            >
              <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#a87f33] bg-white shadow-sm" />
              <span className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-[#a87f33]" />
              <span className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-[#a87f33] bg-[#fffaf1] shadow-sm" />
              <span className="absolute left-1/2 top-[-14px] -translate-x-1/2 whitespace-nowrap rounded bg-[#fffaf1]/95 px-1 text-[9px] font-bold text-[#765416] shadow-sm">PF · {formatEighthInches(fixture.spoutReachIn)}</span>
            </div>
          );
        })}

        {/* Island zone guide — sits beneath cabinets so items placed inside show on top */}
	        {island && (
	          <div
	            data-testid="island-work-zone"
	            role="button"
	            tabIndex={0}
	            aria-label={`Island work zone; active ${activeIslandFace} face. Click an edge to select its cabinet run; right-click or double-click to edit.`}
	            onPointerDown={(e) => onIslandPointerDown(e, "move")}
	            onPointerMove={onIslandPointerMove}
	            onPointerUp={onIslandPointerUp}
	            onClick={(e) => {
	              const rect = e.currentTarget.getBoundingClientRect();
	              onSelectIslandFace?.(nearestIslandFaceInRect(
	                { x: e.clientX - rect.left, y: e.clientY - rect.top },
	                { width: rect.width, height: rect.height },
	              ));
	            }}
	            onKeyDown={(e) => {
	              if (e.key === "Enter" || e.key === " ") {
	                e.preventDefault();
	                onOpenIslandAttributes?.();
	              }
	            }}
	            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onOpenIslandAttributes?.(); }}
	            onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenIslandAttributes?.(); }}
	            className="absolute z-[1] cursor-move"
	            style={{
	              left: island.x * ppi,
	              top: island.y * ppi,
	              width: island.width * ppi,
	              height: island.depth * ppi,
	              border: "2px dashed #d4a75a",
	              background: "transparent",
	              borderRadius: 3,
	              transform: island.rotation ? `rotate(${island.rotation}deg)` : undefined,
	              transformOrigin: "50% 50%",
	            }}
	            title={t("dt_pc_island_zone")}
	          >
	            {islandDepthTransition && islandDepthTransitionVisible && islandDepthTransition.toDepth > islandDepthTransition.fromDepth && (
	              <div
	                data-testid="island-depth-expansion-animation"
	                aria-live="polite"
	                className="island-depth-expansion-cue pointer-events-none absolute left-0 right-0 top-0 z-30 origin-bottom border-b-2 border-dashed border-emerald-700 bg-emerald-400/35"
	                style={{ height: Math.max(0, islandDepthTransition.toDepth - islandDepthTransition.fromDepth) * ppi, transform: "scaleY(1)", opacity: 1 }}
	              >
	                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-emerald-800 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow">
	                  BACK EXPANDS · {Math.round(islandDepthTransition.fromDepth)}″ → {Math.round(islandDepthTransition.toDepth)}″
	                </span>
	              </div>
	            )}
	            <div className={`absolute left-0 right-0 top-0 h-1.5 ${activeIslandFace === "back" ? activeIslandFaceCapacityWarning ? "bg-rose-700 shadow-[0_0_0_2px_rgba(190,24,93,0.75)]" : "bg-[#1a2744] shadow-[0_0_0_2px_rgba(212,167,90,0.85)]" : "bg-transparent"}`} />
	            <div className={`absolute left-0 right-0 bottom-0 h-1.5 ${activeIslandFace === "front" ? activeIslandFaceCapacityWarning ? "bg-rose-700 shadow-[0_0_0_2px_rgba(190,24,93,0.75)]" : "bg-[#1a2744] shadow-[0_0_0_2px_rgba(212,167,90,0.85)]" : "bg-transparent"}`} />
	            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${activeIslandFace === "left" ? activeIslandFaceCapacityWarning ? "bg-rose-700 shadow-[0_0_0_2px_rgba(190,24,93,0.75)]" : "bg-[#1a2744] shadow-[0_0_0_2px_rgba(212,167,90,0.85)]" : "bg-transparent"}`} />
	            <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${activeIslandFace === "right" ? activeIslandFaceCapacityWarning ? "bg-rose-700 shadow-[0_0_0_2px_rgba(190,24,93,0.75)]" : "bg-[#1a2744] shadow-[0_0_0_2px_rgba(212,167,90,0.85)]" : "bg-transparent"}`} />
	            <span data-testid="active-island-face-indicator" className={`pointer-events-none absolute z-10 whitespace-nowrap rounded bg-[#1a2744] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow ${activeIslandFace === "front" ? "bottom-1 left-1/2 -translate-x-1/2" : activeIslandFace === "back" ? "top-1 left-1/2 -translate-x-1/2" : activeIslandFace === "left" ? "left-1 top-1/2 -translate-y-1/2" : "right-1 top-1/2 -translate-y-1/2"}`}>
	              {activeIslandFace.toUpperCase()} · ACTIVE PLACEMENT
	            </span>
	            {activeIslandFaceCapacityWarning && <span data-testid="active-island-face-too-small" role="status" aria-live="polite" className="pointer-events-none absolute z-20 left-1/2 top-1/2 max-w-[calc(100%-0.75rem)] -translate-x-1/2 -translate-y-1/2 rounded bg-rose-700 px-1.5 py-1 text-center text-[9px] font-bold leading-tight text-white shadow">
	              {activeIslandFace.toUpperCase()} has {formatEighthInches(activeIslandFaceCapacityWarning.remaining)} left · cabinet needs {formatEighthInches(activeIslandFaceCapacityWarning.requiredWidth)} · short {formatEighthInches(activeIslandFaceCapacityWarning.shortage)}
	            </span>}
            <span className="absolute left-1 top-1 text-[9px] font-bold tracking-wide text-[#a87f33] bg-white/70 px-1 rounded pointer-events-none">
              ISLAND {Math.round(island.width)}″×{Math.round(island.depth)}″
            </span>
            <div
              onPointerDown={(e) => onIslandPointerDown(e, "resize")}
              onPointerMove={onIslandPointerMove}
              onPointerUp={onIslandPointerUp}
              className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm bg-[#d4a75a] border border-white shadow cursor-nwse-resize"
            />
          </div>
        )}
        {/* Pony walls — free-standing half-walls rendered as solid dark rectangles */}
	        {ponyWalls.map((pw) => {
	          const isPonySelected = pw.uid === selectedPonyWallUid;
		          const ponyFrame = ponyWallPlanFrame(pw, room);
		          const ponyFootprint = ponyWallMiteredFootprint(pw, ponyWalls, room);
		          const ponyDegrees = (ponyFrame.radians * 180) / Math.PI;
		          const attachedToPeninsula = ponyFrame.attachedToPeninsula;
	          const isDrywallBackedPeninsula = attachedToPeninsula && pw.peninsulaPlacement === "behind-cabinets" && pw.finish === "drywall";
	          const isDrywallEndPeninsula = attachedToPeninsula && pw.peninsulaPlacement !== "behind-cabinets" && pw.finish === "drywall";
		          const drywallAppearance = drywallPonyWallAppearance(pw);
		          const drywallPlanBackground = drywallPonyWallPreviewBackground(pw);
		          const localXs = ponyFootprint.corners.map((corner) => corner.x);
		          const localZs = ponyFootprint.corners.map((corner) => corner.z);
		          const minLocalX = Math.min(...localXs);
		          const maxLocalX = Math.max(...localXs);
		          const minLocalZ = Math.min(...localZs);
		          const maxLocalZ = Math.max(...localZs);
		          const miteredPonyClip = ponyFootprint.miteredStart || ponyFootprint.miteredEnd
		            ? `polygon(${ponyFootprint.corners.map((corner) => `${((corner.x - minLocalX) / Math.max(0.001, maxLocalX - minLocalX)) * 100}% ${((corner.z - minLocalZ) / Math.max(0.001, maxLocalZ - minLocalZ)) * 100}%`).join(", ")})`
		            : undefined;
	          const ponyStyle: React.CSSProperties = attachedToPeninsula
	            ? {
	                left: (ponyFrame.start.x + Math.cos(ponyFrame.radians) * minLocalX - Math.sin(ponyFrame.radians) * minLocalZ) * ppi,
	                top: (ponyFrame.start.y + Math.sin(ponyFrame.radians) * minLocalX + Math.cos(ponyFrame.radians) * minLocalZ) * ppi,
	                width: (maxLocalX - minLocalX) * ppi,
	                height: (maxLocalZ - minLocalZ) * ppi,
	                transform: `rotate(${ponyDegrees}deg)`,
	                transformOrigin: "0 0",
	              }
            : {
                left: pw.x * ppi,
                top: pw.y * ppi,
                width: pw.width * ppi,
                height: pw.depth * ppi,
              };
          return (
            <div
              key={pw.uid}
	            data-testid={isDrywallBackedPeninsula ? "peninsula-drywall-back-pony-wall" : isDrywallEndPeninsula ? "peninsula-drywall-pony-wall" : attachedToPeninsula ? "peninsula-pony-wall" : "pony-wall"}
            data-peninsula-run-id={pw.peninsulaRunId ?? undefined}
            className="absolute group touch-none"
            style={{
              ...ponyStyle,
	              background: isDrywallBackedPeninsula || isDrywallEndPeninsula ? drywallPlanBackground : "#2a3550",
	              border: isPonySelected ? "2px solid #f59e0b" : isDrywallBackedPeninsula || isDrywallEndPeninsula ? "2px solid #8b8274" : "2px solid #1a2744",
	              borderRadius: 2,
		              clipPath: miteredPonyClip,
	              cursor: layoutLocked || attachedToPeninsula ? "default" : "move",
              zIndex: isPonySelected ? 20 : 2,
              boxShadow: isPonySelected ? "0 0 0 2px rgba(245,158,11,0.4)" : undefined,
            }}
            title={attachedToPeninsula
	              ? isDrywallBackedPeninsula || isDrywallEndPeninsula
	                ? `${pw.peninsulaPlacement === "behind-cabinets" ? "Drywall behind the cabinet run" : "Drywall end wall"} · follows the measured peninsula endpoint · ${formatEighthInches(ponyFrame.width)} long × ${ponyFrame.height} in. tall`
	                : `${pw.label ?? "Pony wall"} follows the measured peninsula endpoint · ${formatEighthInches(ponyFrame.width)} long × ${ponyFrame.height} in. tall`
	              : `Pony Wall ${Math.round(pw.width)} in. wide × ${pw.height} in. tall`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectPonyWall?.(pw.uid);
              if (layoutLocked || attachedToPeninsula || !onPonyWallChange) return;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
              const startX = (e.clientX - rect.left) / ppi;
              const startY = (e.clientY - rect.top) / ppi;
              const origX = pw.x; const origY = pw.y;
              const el = e.currentTarget as HTMLElement;
              const onMove = (ev: PointerEvent) => {
                const dx = (ev.clientX - rect.left) / ppi - startX;
                const dy = (ev.clientY - rect.top) / ppi - startY;
                const updated = clampPonyWall({ ...pw, x: origX + dx, y: origY + dy }, room);
                onPonyWallChange(updated);
              };
              const onUp = () => {
                try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                el.removeEventListener("pointermove", onMove as EventListener);
                el.removeEventListener("pointerup", onUp);
              };
              el.addEventListener("pointermove", onMove as EventListener);
              el.addEventListener("pointerup", onUp);
            }}
            >
	              <span className={`absolute left-1 top-0.5 text-[8px] font-bold tracking-wide pointer-events-none whitespace-nowrap ${isDrywallBackedPeninsula || isDrywallEndPeninsula ? "text-[#4e463d]" : "text-white/80"} ${attachedToPeninsula ? "origin-left" : ""}`} style={attachedToPeninsula ? { transform: `rotate(${-ponyDegrees}deg)` } : undefined}>
	                {isDrywallBackedPeninsula ? `DRYWALL PONY WALL · ${formatEighthInches(ponyFrame.width)}` : attachedToPeninsula ? `PONY WALL · ${formatEighthInches(ponyFrame.width)}` : pw.label || `PONY ${Math.round(pw.width)}″`}
	              </span>
	              <span className={`absolute right-0.5 top-0.5 text-[8px] pointer-events-none ${isDrywallBackedPeninsula ? "text-[#6b6258]" : "text-white/60"}`} style={attachedToPeninsula ? { transform: `rotate(${-ponyDegrees}deg)` } : undefined}>{pw.height}″H</span>
              {/* Delete button — shown when selected or on hover */}
              {onDeletePonyWall && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDeletePonyWall(pw.uid); onSelectPonyWall?.(null); }}
                  className={`absolute -top-2.5 -right-2.5 h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] shadow z-10 ${isPonySelected ? "flex" : "hidden group-hover:flex"}`}
                >
                  ×
                </button>
              )}
              {/* Resize handle */}
              {onPonyWallChange && !layoutLocked && !attachedToPeninsula && (
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm bg-[#4a6090] border border-white shadow cursor-nwse-resize z-10"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    const rect = (e.currentTarget as HTMLElement).closest(".absolute")!.parentElement!.getBoundingClientRect();
                    const startX = (e.clientX - rect.left) / ppi;
                    const startY = (e.clientY - rect.top) / ppi;
                    const origW = pw.width; const origD = pw.depth;
                    const el = e.currentTarget as HTMLElement;
                    const onMove = (ev: PointerEvent) => {
                      const dx = (ev.clientX - rect.left) / ppi - startX;
                      const dy = (ev.clientY - rect.top) / ppi - startY;
                      const newW = Math.max(6, origW + dx);
                      const newD = Math.max(4, origD + dy);
                      const updated = clampPonyWall({ ...pw, width: newW, depth: newD }, room);
                      onPonyWallChange(updated);
                    };
                    const onUp = () => {
                      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                      el.removeEventListener("pointermove", onMove as EventListener);
                      el.removeEventListener("pointerup", onUp);
                    };
                    el.addEventListener("pointermove", onMove as EventListener);
                    el.addEventListener("pointerup", onUp);
                  }}
                />
              )}
            </div>
          );
        })}
        {/* Doors & Windows on the room walls */}
        {openings.map((o) => {
          const customFrame = planOpeningWallFrame(o, room);
          const horizontal = o.side === "top" || o.side === "bottom";
          const isSel = o.uid === selectedOpeningUid;
	          const isSinkWindowSnapTarget = sinkWindowSnap?.openingUid === o.uid;
          const isDoor = o.kind === "door";
          const isOpening = o.kind === "opening";
          const isBifold = isDoor && o.doorStyle === "bifold";
          // Wall band thickness in px (how far the opening graphic extends into the room).
          const band = 10;
          const lenPx = o.width * ppi;
          const offPx = o.offset * ppi;
          const style: React.CSSProperties = customFrame
            ? {
                left: customFrame.centerX * ppi - lenPx / 2,
                top: customFrame.centerY * ppi - band / 2,
                width: lenPx,
                height: band,
                transform: `rotate(${customFrame.angleDeg}deg)`,
                transformOrigin: "center center",
              }
            : horizontal ? {
                left: offPx,
                width: lenPx,
                height: band,
                top: o.side === "top" ? -band / 2 : roomPxH - band / 2,
              }
            : {
                top: offPx,
                height: lenPx,
                width: band,
                left: o.side === "left" ? -band / 2 : roomPxW - band / 2,
              };
          return (
            <div
              key={o.uid}
              onPointerDown={(e) => {
                // A secondary-button press must reach onContextMenu. Capturing
                // it as a drag first prevented the window editor from opening.
                if (e.button === 2) return;
                onOpeningPointerDown(e, o, "move");
              }}
              onPointerMove={onOpeningPointerMove}
              onPointerUp={onOpeningPointerUp}
              onContextMenu={(event) => openOpeningAttributes(event, o)}
              onDoubleClick={(event) => openOpeningAttributes(event, o)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                openOpeningAttributes(event as unknown as React.MouseEvent, o);
              }}
              role="button"
              tabIndex={0}
              data-testid={o.kind === "window" ? "plan-window-attributes-target" : "plan-opening-attributes-target"}
              aria-label={`${o.label}. Right-click, double-click, or press Enter to edit.`}
	              className={`group absolute z-[15] flex items-center justify-center ${onOpeningChange ? "cursor-move" : ""} ${isSinkWindowSnapTarget ? "motion-safe:animate-pulse" : ""}`}
              style={{
                ...style,
                background: isDoor ? doorOpeningAppearance(o).color : isOpening ? "#e8eaed" : "#7fb4d6",
                border: isSel
                  ? "2px solid #1a2744"
	                  : isSinkWindowSnapTarget
	                  ? "2px solid #059669"
                  : isOpening
                  ? "1px dashed rgba(90,103,112,0.85)"
                  : "1px solid rgba(0,0,0,0.35)",
                boxShadow: isSel
	                  ? "0 0 0 3px rgba(212,167,90,0.5)"
	                  : isSinkWindowSnapTarget
	                  ? "0 0 0 4px rgba(16,185,129,0.38), 0 0 18px rgba(16,185,129,0.65)"
	                  : undefined,
                borderRadius: 2,
              }}
              title={`${t("dt_pc_opening_drag", { label: o.label, width: Math.round(o.width) })} · Right-click or double-click to edit`}
	              data-sink-window-snap-confirmed={isSinkWindowSnapTarget ? "true" : undefined}
            >
              {isBifold && <span className="pointer-events-none absolute inset-0 flex" data-testid="plan-bifold-panels" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => <span key={index} className="h-full w-1/4 border-r border-[#f4e7d3]/80 last:border-r-0" />)}
              </span>}
              {supportsRoomDoorSwing(o) && roomDoorSwing(o).angle === 90 && (() => {
                const swing = roomDoorSwing(o);
                const hingeX = swing.hinge === "left" ? 0 : lenPx;
                const closedX = swing.hinge === "left" ? lenPx : 0;
                const reversed = customFrame ? customWallCabinetSide(room, o.side) === "right" : o.side === "bottom" || o.side === "left";
                const horizontalDoor = Boolean(customFrame) || horizontal;
                const swingTransform = horizontalDoor ? reversed ? "rotate(180deg)" : "none" : reversed ? "rotate(-90deg)" : "rotate(90deg)";
                return <svg data-testid="plan-door-swing" data-door-uid={o.uid} data-open-angle="90" aria-hidden="true" width={lenPx} height={lenPx} viewBox={`0 0 ${lenPx} ${lenPx}`} className="pointer-events-none absolute overflow-visible" style={{ left: horizontalDoor ? reversed ? lenPx : 0 : band / 2, top: horizontalDoor ? band / 2 : reversed ? lenPx : 0, transformOrigin: "0 0", transform: swingTransform }}>
                  <path d={`M ${closedX} 0 A ${lenPx} ${lenPx} 0 0 ${swing.hinge === "left" ? 1 : 0} ${hingeX} ${lenPx}`} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 4" />
                  <line x1={hingeX} y1="0" x2={hingeX} y2={lenPx} stroke="#475569" strokeWidth="4" />
                  <line x1={hingeX} y1="0" x2={hingeX} y2={lenPx} stroke={doorOpeningAppearance(o).color} strokeWidth="2" />
                </svg>;
              })()}
              <span
                className={`pointer-events-none whitespace-nowrap text-[8px] font-bold drop-shadow ${isOpening || isDoor ? "text-[#3a4047]" : "text-white"}`}
                style={{ transform: customFrame ? `rotate(${-customFrame.angleDeg}deg)` : horizontal ? "none" : "rotate(-90deg)" }}
              >
                {isBifold ? "Bi-fold" : isDoor ? t("dt_pc_door") : isOpening ? t("dt_pc_open") : t("dt_pc_win")} {Math.round(o.width)}"
              </span>
	              {isSinkWindowSnapTarget && (
	                <span data-testid="sink-window-snap-window-indicator" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+5px)] whitespace-nowrap rounded bg-emerald-700 px-1.5 py-0.5 text-[8px] font-bold leading-none text-white shadow">
	                  Sink aligned
	                </span>
	              )}
              {/* width-resize handle at the far end */}
              {onOpeningChange && (
                <div
                  onPointerDown={(e) => onOpeningPointerDown(e, o, "resize")}
                  onPointerMove={onOpeningPointerMove}
                  onPointerUp={onOpeningPointerUp}
                  className="absolute h-3 w-3 rounded-sm bg-[#1a2744] border border-white shadow"
                  style={
                    customFrame || horizontal
                      ? { right: -6, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" }
                      : { bottom: -6, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" }
                  }
                />
              )}
              {/* delete control when selected */}
              {isSel && onDeleteOpening && (
                <button
                  type="button"
                  aria-label={t("dt_pc_delete_opening")}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDeleteOpening(o.uid); }}
                  className="absolute -top-2.5 -right-2.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c] active:scale-95 transition"
                  style={{ transitionDuration: "120ms" }}
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}

	        {fillerGapPreview.map((preview) => {
	          const { lockedAngledRun, bodyW, bodyD, bodyLeft, bodyTop } = planCabinetRenderFrame(preview);
	          return (
	            <div
	              key={`filler-gap-preview-${preview.uid}`}
	              data-testid="plan-filler-gap-preview"
	              className="pointer-events-none absolute z-[35] flex items-center justify-center overflow-visible rounded-sm border-2 border-dashed border-amber-500 bg-amber-300/35 shadow-[0_0_0_3px_rgba(251,191,36,0.25),0_0_18px_rgba(245,158,11,0.48)] motion-safe:animate-pulse"
	              style={{
	                left: bodyLeft * ppi,
	                top: bodyTop * ppi,
	                width: Math.max(2, bodyW * ppi),
	                height: Math.max(2, bodyD * ppi),
	                transform: lockedAngledRun ? `rotate(${preview.rotation}deg)` : undefined,
	                transformOrigin: lockedAngledRun ? "center" : undefined,
	                animationDuration: "1.2s",
	              }}
	              title={`Filler preview — ${formatInches(preview.width)} will be inserted here`}
	            >
	              <span className="whitespace-nowrap rounded bg-amber-700 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow">
	                Filler {formatInches(preview.width)}
	              </span>
	            </div>
	          );
	        })}

	        {cabinets
          .filter((c) => (showWallLayer ? true : c.placement !== "wall"))
          .map((p) => {
            const { lockedAngledRun, bodyW, bodyD, bodyLeft, bodyTop } = planCabinetRenderFrame(p);
            const isWall = p.placement === "wall";
            const isSelected = p.uid === selectedUid;
            const isAttributesTarget = p.uid === attributesTargetUid;
	            const showWallSnapSuccess = p.uid === wallSnapSuccessUid;
	            const isWindowCenteredSink = sinkWindowSnap?.cabinetUid === p.uid;
            const { isCorner, isTriangle, isDiagonal, isBlind, isConfiguredL, isEndAngle, isEndReturn } = planCornerGeometry(p);
            const isAppliance = p.placement === "appliance";
            // Keep appliance confirmation tied to the same measured-wall spans
            // used by collision and drop placement. The indicator is selected-only
            // so tightly packed continuous runs remain readable on phones.
            const applianceSnap = isAppliance && isSelected
              ? continuousWallApplianceSnapInfo(p, cabinets, room)
              : null;
            const applianceSnapNeighborCodes = applianceSnap
              ? [applianceSnap.before?.masterCode, applianceSnap.after?.masterCode].filter((code): code is string => Boolean(code)).join(" + ")
              : "";
            const applianceSnapWallLabel = applianceSnap
              ? room.customWalls?.find((wall) => wall.id === applianceSnap.wallId)?.label ?? "continuous wall"
              : "";
            const applianceSnapTooltip = applianceSnap
              ? `${p.masterCode} appliance snap confirmed on ${applianceSnapWallLabel} · 0\" gap · 0\" overlap${applianceSnapNeighborCodes ? ` · flush to ${applianceSnapNeighborCodes}` : ""}`
              : null;
            const cabFinish = finishFor ? finishFor(p) : finish;
            const faceFill = isAppliance ? "#b9bdc4" : cabFinish.face;
            const edgeColor = isAppliance ? "#8a8f96" : cabFinish.edge;
            const lbl = readableLabel(faceFill);
            const collides = cabinetPlacementCollisionDetail(p, cabinets, room) != null;
            const inConflict = conflictUids?.has(p.uid) ?? false;
            const priceMissing = missingPriceUids?.has(p.uid) ?? false;
            const installedFillerWidth = isFillerItem(p)
              ? Math.min(Math.abs(Number(p.width)), Math.abs(Number(p.depth)))
              : null;
            const fillerMaximum = isFillerItem(p) ? fillerWidthRange(p)?.max ?? 3 : null;
            const fillerExceedsMaximum = installedFillerWidth != null && fillerMaximum != null && installedFillerWidth > fillerMaximum + 0.001;
            const showBbcFillerMeasurement = installedFillerWidth != null
              && installedFillerWidth > 0
              && installedFillerWidth <= BLIND_CORNER_FILLER_WIDTH_IN + 0.001
              && (Boolean(p.fillerForCabinetUid) || /required\s+(?:bbc|wbc)/i.test(p.description ?? "") || /^F342$/i.test(p.masterCode));
            const measuredFillerGapWidth = Number.isFinite(Number(p.fillerTotalWidth)) && Number(p.fillerTotalWidth) > 0
              ? Number(p.fillerTotalWidth)
              : null;
            const splitFillerTooltip = splitFillerDimensionTooltip(p);
	            const placementHoverDetail = cabinetPlacementHoverDetail(p);
	            const placementHoverTooltip = placementHoverDetail
	              ? `${placementHoverDetail.title} · ${formatEighthInches(placementHoverDetail.dimensions.width)}W × ${formatEighthInches(placementHoverDetail.dimensions.height)}H × ${formatEighthInches(placementHoverDetail.dimensions.depth)}D. ${placementHoverDetail.clearance}`
	              : null;
	            const cornerPlacement = cabinetCornerPlacementInfo(p, room);
            const blindCornerPlacement = blindCornerSnapInfo(p, room);
            const cornerStatus = cornerPlacement ?? blindCornerPlacement;
	            const isSeatedErb36 = p.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "") === "ERB36"
	              && cornerPlacement?.placement === "flush"
	              && !p.cornerSnapUnlocked;
	            const isSeatedBlindCorner = blindCornerPlacement?.placement === "flush" && !p.cornerSnapUnlocked;
	            const isSeatedPeninsulaCorner = Boolean(
	              isProtectedCornerCabinet(p.masterCode, p.description)
	              && cornerPlacement?.angle === 90
	              && cornerPlacement.placement === "flush"
	              && !p.cornerSnapUnlocked
	              && p.wallId
	              && peninsulaRunById(room, p.wallId as WallSide),
	            );
	            const isFrontMiterPair = p.fillerTransitionKind === "front-miter-pair";
            const isMiteredAngledWallFiller = (p.placement === "wall" || p.placement === "base")
              && !p.fillerTransitionKind
              && p.fillerMiterAngle === 45
              && (p.fillerMiteredEnd === "start" || p.fillerMiteredEnd === "end");
            const showMeasuredFillerMeasurement = isFillerItem(p)
              && installedFillerWidth != null
              && installedFillerWidth > 0
              && !showBbcFillerMeasurement
              && !p.fillerTransitionKind
              && !isMiteredAngledWallFiller;
	            const transitionFootprint = angledWallTransitionFootprint(p, room, cabinets)
	              ?? (p.fillerTransitionPlanFootprint?.length ? p.fillerTransitionPlanFootprint : null);
	            const transitionBounds = transitionFootprint
	              ? {
	                  minX: Math.min(...transitionFootprint.map((point) => point.x)),
	                  maxX: Math.max(...transitionFootprint.map((point) => point.x)),
	                  minY: Math.min(...transitionFootprint.map((point) => point.y)),
	                  maxY: Math.max(...transitionFootprint.map((point) => point.y)),
	                }
	              : null;
	            const transitionClipPath = transitionBounds && transitionFootprint
	              ? `polygon(${transitionFootprint.map((point) => {
	                  const width = Math.max(0.01, transitionBounds.maxX - transitionBounds.minX);
	                  const depth = Math.max(0.01, transitionBounds.maxY - transitionBounds.minY);
	                  return `${((point.x - transitionBounds.minX) / width) * 100}% ${((point.y - transitionBounds.minY) / depth) * 100}%`;
	                }).join(", ")})`
	              : null;
	            const miterCutPercent = Math.min(100, Math.max(0, (0.75 / Math.max(0.01, Number(p.width) || 0.01)) * 100));
	            const miterClipPath = isMiteredAngledWallFiller
	              ? p.fillerMiteredEnd === "start"
	                ? `polygon(${miterCutPercent}% 0, 100% 0, 100% 100%, 0 100%)`
	                : `polygon(0 0, ${100 - miterCutPercent}% 0, 100% 100%, 0 100%)`
	              : planCabinetClipPath(p, room);
	            const isSeatedProtectedCorner = isSeatedErb36 || isSeatedBlindCorner;
	            const showSeatedPeninsulaCornerFeedback = isSeatedPeninsulaCorner && showPeninsulaCornerSnapFeedback;
	            const showProtectedCornerFeedback = isSeatedProtectedCorner && (!isSeatedPeninsulaCorner || showPeninsulaCornerSnapFeedback);
            const cornerPlacementTooltip = cornerStatus
              ? cornerStatus.placement === "clearance"
                ? `${cornerStatus.angle}° inside corner · ${cornerStatus.clearanceIn}" required clearance`
                : `${cornerStatus.angle}° corner · seated flush (0" corner clearance)${isSeatedErb36 ? " · ERB36 corner snap confirmed" : isSeatedBlindCorner ? ` · ${p.masterCode} blind-corner snap confirmed` : ""}`
              : null;
            return (
              <div
                key={p.uid}
                onPointerDown={(e) => handlePointerDown(e, p)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={
                  onOpenAttributes
                    ? (e) => {
                        e.preventDefault();
                        onSelect(p.uid);
                        onOpenAttributes(p.uid);
                      }
                    : undefined
                }
                onDoubleClick={
                  onOpenAttributes
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(p.uid);
                        onOpenAttributes(p.uid);
                      }
                    : undefined
                }
                className={`group absolute transition-[box-shadow,border-color] duration-200 ${
                  measureMode ? "cursor-crosshair" : "cursor-move"
	                } ${isWindowCenteredSink || showSeatedPeninsulaCornerFeedback || applianceSnap || showWallSnapSuccess ? "motion-safe:animate-pulse" : ""} ${isAttributesTarget ? "z-30" : isSelected ? "z-20" : isWall ? "z-10" : isAppliance ? "z-[3]" : "z-[2]"}`}
                style={{
	                  left: (transitionBounds?.minX ?? bodyLeft) * ppi,
	                  top: (transitionBounds?.minY ?? bodyTop) * ppi,
	                  width: (transitionBounds ? transitionBounds.maxX - transitionBounds.minX : bodyW) * ppi,
	                  height: (transitionBounds ? transitionBounds.maxY - transitionBounds.minY : bodyD) * ppi,
                  background: isWall
                    ? `repeating-linear-gradient(45deg, ${edgeColor}33, ${edgeColor}33 6px, ${edgeColor}55 6px, ${edgeColor}55 12px), ${faceFill}`
                    : faceFill,
                  border: priceMissing
                    ? "3px solid #dc2626"
                    : inConflict
                    ? "2.5px solid #dc2626"
                    : isAttributesTarget
                    ? "3px solid #a87f33"
	                  : isWindowCenteredSink || applianceSnap
	                  ? "3px solid #059669"
	                  : showWallSnapSuccess
	                  ? "3px solid #16a34a"
	                  : showSeatedPeninsulaCornerFeedback || showProtectedCornerFeedback
	                    ? "2.5px solid #16a34a"
                    : isSelected
                    ? "2px solid #1a2744"
                    : collides
                    ? "2px solid #dc2626"
                    : isWall
                    ? `1.5px dashed ${edgeColor}`
                    : `1.5px solid ${edgeColor}`,
                  boxShadow: priceMissing
                    ? "0 0 0 4px rgba(220,38,38,0.55), 0 0 16px rgba(220,38,38,0.7)"
                    : inConflict
                    ? "0 0 0 3px rgba(220,38,38,0.45)"
                    : isAttributesTarget
                    ? "0 0 0 5px rgba(212,167,90,0.72), 0 0 18px rgba(212,167,90,0.52), inset 0 0 0 1px rgba(255,255,255,0.85)"
	                  : isWindowCenteredSink || applianceSnap
	                  ? "0 0 0 5px rgba(16,185,129,0.42), 0 0 22px rgba(16,185,129,0.7), inset 0 0 0 1px rgba(255,255,255,0.92)"
	                  : showWallSnapSuccess
	                  ? "0 0 0 5px rgba(34,197,94,0.42), 0 0 22px rgba(34,197,94,0.72), inset 0 0 0 1px rgba(255,255,255,0.92)"
	                    : showSeatedPeninsulaCornerFeedback || showProtectedCornerFeedback
	                    ? "0 0 0 4px rgba(34,197,94,0.42), 0 0 20px rgba(34,197,94,0.58), inset 0 0 0 1px rgba(255,255,255,0.88)"
                    : isSelected
                    ? "0 0 0 3px rgba(212,167,90,0.5)"
                    : undefined,
	                  borderRadius: (isCorner && !isBlind) ? 0 : 2,
	                  clipPath: transitionClipPath ?? miterClipPath,
	                  transform: transitionBounds ? undefined : lockedAngledRun ? `rotate(${p.rotation}deg)` : undefined,
	                  transformOrigin: transitionBounds ? undefined : lockedAngledRun ? "center" : undefined,
                }}
	                title={splitFillerTooltip ?? applianceSnapTooltip ?? cornerPlacementTooltip ?? placementHoverTooltip ?? `${p.masterCode} — ${p.description}`}
                tabIndex={splitFillerTooltip ? 0 : undefined}
                aria-describedby={splitFillerTooltip ? `split-filler-tooltip-${p.uid}` : undefined}
                data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}
	                data-corner-snap-confirmed={isSeatedProtectedCorner || isSeatedPeninsulaCorner ? "true" : undefined}
	                data-peninsula-corner-snap-confirmed={isSeatedPeninsulaCorner ? "true" : undefined}
	                data-sink-window-snap-confirmed={isWindowCenteredSink ? "true" : undefined}
	                data-continuous-wall-appliance-snap-confirmed={applianceSnap ? "true" : undefined}
	                data-wall-snap-confirmed={showWallSnapSuccess ? "true" : undefined}
	                data-angled-wall-mitered-filler={isMiteredAngledWallFiller ? "true" : undefined}
	                data-angled-wall-transition-filler={transitionBounds ? "true" : undefined}
	                data-placement-detail-tooltip={placementHoverDetail ? "true" : undefined}
                data-price-missing={priceMissing ? "true" : undefined}
              >
                {priceMissing && (
                  <span
                    data-testid="price-missing-indicator"
                    role="alert"
                    className="pointer-events-none absolute left-1/2 top-0 z-50 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center gap-1 whitespace-nowrap rounded border border-red-200 bg-red-600 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86),0_0_14px_rgba(220,38,38,0.72)]"
                    title={`PRICE MISSING — ${p.masterCode}. No price on the active line. Click the cabinet for a priced alternative.`}
                  >
                    PRICE MISSING
                  </span>
                )}
                {showBbcFillerMeasurement && installedFillerWidth != null && (
                  <span
                    data-testid="bbc-filler-measurement-label"
                    role="status"
                    className="pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center whitespace-nowrap rounded border border-sky-200 bg-sky-800 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86),0_0_10px_rgba(14,116,144,0.5)]"
                    title={`Installed filler width ${formatInches(installedFillerWidth)}; BBC return maximum ${formatInches(BLIND_CORNER_FILLER_WIDTH_IN)}`}
                  >
                    FILLER {formatInches(installedFillerWidth)} · MAX {formatInches(BLIND_CORNER_FILLER_WIDTH_IN)}
                  </span>
                )}
                {showMeasuredFillerMeasurement && installedFillerWidth != null && (
                  <span
                    data-testid="measured-filler-measurement-label"
                    data-filler-warning={fillerExceedsMaximum ? "over-maximum" : undefined}
                    role={fillerExceedsMaximum ? "alert" : "status"}
                    className={`pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86)] ${fillerExceedsMaximum ? "border-red-200 bg-red-700" : "border-violet-200 bg-violet-800"}`}
                    title={`Measured filler gap ${formatInches(measuredFillerGapWidth ?? installedFillerWidth)}; installed filler width ${formatInches(installedFillerWidth)}`}
                  >
                    FILLER {formatInches(installedFillerWidth)}{measuredFillerGapWidth != null && Math.abs(measuredFillerGapWidth - installedFillerWidth) > 0.001 ? ` · GAP ${formatInches(measuredFillerGapWidth)}` : ""}{fillerExceedsMaximum ? ` · MAX ${formatInches(fillerMaximum!)} · OVER MAX` : ""}
                  </span>
                )}
                {showWallSnapSuccess && (
		                  <span
		                    data-testid="wall-snap-success-indicator"
	                    role="status"
	                    className="pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center gap-1 whitespace-nowrap rounded border border-emerald-200 bg-emerald-700 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86),0_0_14px_rgba(16,185,129,0.72)]"
	                  >
	                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
		                    WALL SNAP
		                  </span>
		                )}
	                {isMiteredAngledWallFiller && (
		                  <span
		                    data-testid="angled-wall-mitered-filler-indicator"
		                    className="pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center whitespace-nowrap rounded border border-amber-200 bg-[#9a6717] px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow"
		                    title="Selected-line filler cut with a 45° miter at the continuous-wall vertex"
		                  >
	                    45° MITER FILLER
	                  </span>
	                )}
	                {transitionBounds && (
	                  <span
	                    data-testid="angled-wall-transition-filler-indicator"
	                    className="pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center whitespace-nowrap rounded border border-amber-200 bg-[#7c5313] px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow"
	                    title={isFrontMiterPair
	                      ? `Front-only 22.5° miter-cut filler ${p.fillerTransitionPiece === "neighbor" ? "B" : "A"}: ${formatEighthInches(Number(p.fillerTransitionRearWidthIn) || 0)} cut from source-priced ${p.masterCode}. Together the pair forms one tight 45° turn; the rear pocket remains open and both cabinets stay independently supported.`
	                      : `Legacy measured 45° transition: ${formatEighthInches(Number(p.fillerTransitionRearWidthIn) || 0)} rear / ${formatEighthInches(Number(p.fillerTransitionFrontWidthIn) || 0)} face. This saved plan retains its historical footprint.`}
	                  >
	                    {isFrontMiterPair ? `22.5° FRONT FILLER ${p.fillerTransitionPiece === "neighbor" ? "B" : "A"}` : "45° TRANSITION"}
	                  </span>
	                )}
		                {showSeatedPeninsulaCornerFeedback && (
	                  <span
	                    data-testid="peninsula-corner-snap-indicator"
	                    className="pointer-events-none absolute left-1/2 top-0 z-40 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center gap-1 whitespace-nowrap rounded border border-emerald-200 bg-emerald-700 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86),0_0_14px_rgba(16,185,129,0.72)]"
	                    title="Corner cabinet snapped flush to this peninsula’s 90-degree bend"
	                  >
	                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
	                    90° BEND SNAP
	                  </span>
	                )}
	                <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden px-0.5 relative">
	                  {applianceSnap && (
	                    <span
	                      data-testid="continuous-wall-appliance-snap-indicator"
	                      className="pointer-events-none absolute left-1/2 bottom-0 z-30 inline-flex -translate-x-1/2 translate-y-[calc(100%+5px)] items-center gap-1 whitespace-nowrap rounded border border-emerald-200 bg-emerald-700 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86),0_0_14px_rgba(16,185,129,0.72)]"
	                      title={applianceSnapTooltip ?? undefined}
	                    >
	                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
	                      FLUSH SNAP · 0\"
	                    </span>
	                  )}
	                  {isWindowCenteredSink && (
	                    <span data-testid="sink-window-snap-cabinet-indicator" className="pointer-events-none absolute left-1/2 bottom-0 z-30 -translate-x-1/2 translate-y-[calc(100%+5px)] whitespace-nowrap rounded bg-emerald-700 px-1.5 py-0.5 text-[8px] font-bold leading-none text-white shadow">
	                      Centered to window
	                    </span>
	                  )}
	                  {cornerStatus && (!isSeatedPeninsulaCorner || showPeninsulaCornerSnapFeedback) && (
                    <span
                      data-testid="corner-placement-indicator"
                      className={`pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-bold leading-none text-white shadow ${cornerStatus.placement === "clearance" ? "bg-[#9a6717]" : "bg-emerald-700"}`}
                      title={cornerPlacementTooltip ?? undefined}
                    >
                      {cornerStatus.placement === "clearance"
                        ? `45° · ${cornerStatus.clearanceIn}\" clear`
                        : isSeatedErb36 ? "ERB36 · locked" : isSeatedBlindCorner ? `${p.masterCode} · locked` : `${cornerStatus.angle}° · flush`}
                    </span>
                  )}
                  {isAttributesTarget && (
                    <span data-testid="plan-cabinet-attributes-target" className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 rounded-full border border-amber-200 bg-[#1a2744] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm motion-safe:animate-pulse">Editing</span>
                  )}
                  {/* BEC-24 is a 24x24 two-face end return. Keep the enclosing
                      square for collision/snapping, then show the paired 12-inch
                      faces with a 90-degree fold mark — never a clipped corner. */}
                  {isEndReturn && !isAppliance && (
                    <svg
                      data-bec-end-return="true"
                      aria-label="24 by 24 base end corner return"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <path d="M50 3V52H97" fill="none" stroke={edgeColor} strokeWidth="3" opacity="0.9" />
                      <path d="M4 4H50V50H96" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.5" />
                      <path d="M50 52L96 96" fill="none" stroke={edgeColor} strokeWidth="1.4" opacity="0.55" />
                    </svg>
                  )}
                  {isDiagonal && !isAppliance && (
                    <svg
                      data-diagonal-corner-front="true"
                      aria-label="Diagonal corner cabinet 45 degree front"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <path d={planDiagonalFrontPath(p, room)} fill="none" stroke={edgeColor} strokeWidth="3" opacity="0.95" />
                      <path d={planDiagonalFrontPath(p, room)} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1" transform="translate(0 -1)" />
                    </svg>
                  )}
                  {planLazySusanTwoFrontPath(p) && !isAppliance && (
                    <svg
                      data-lazy-susan-two-fronts="true"
                      aria-label="Lazy Susan L corner with two 12 inch door fronts"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {/* A 36-inch L corner leaves a 12-inch exposed front on
                          each leg: 12 / 36 = 33.33% of the square footprint. */}
                      <path d={planLazySusanTwoFrontPath(p)} fill="none" stroke={edgeColor} strokeWidth="3" opacity="0.95" />
                      <path d="M68 66L100 66M68 66L68 100" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1" />
                    </svg>
                  )}
                  {/* BEC-24's configured 45° end face stays inside its 24×24
                      bounding footprint. It is an end cabinet, never a room
                      corner, so this marker must not enable corner snapping. */}
                  {isEndAngle && !isAppliance && (
                    <svg
                      data-end-angle="true"
                      aria-label="24 by 24 base end cabinet with 45 degree angled front"
                      className="absolute inset-0 h-full w-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <path d="M4 4H96V54L54 96H4Z" fill="none" stroke={edgeColor} strokeWidth="3" opacity="0.9" />
                      <path d="M96 54L54 96" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.5" />
                      <path d="M88 62L62 88" fill="none" stroke={edgeColor} strokeWidth="1" opacity="0.55" />
                    </svg>
                  )}
                  {/* Appliance-specific top-down icons */}
                  {isAppliance && (() => {
                    const mc = (p.masterCode || "").toUpperCase();
                    if (mc.startsWith("RANGE")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {([{cx:30,cy:30},{cx:70,cy:30},{cx:30,cy:70},{cx:70,cy:70}] as {cx:number;cy:number}[]).map((b,i)=>(
                            <g key={i}>
                              <circle cx={b.cx} cy={b.cy} r={14} fill="none" stroke="#666" strokeWidth="3"/>
                              <circle cx={b.cx} cy={b.cy} r={7} fill="none" stroke="#666" strokeWidth="2"/>
                              <circle cx={b.cx} cy={b.cy} r={2.5} fill="#555"/>
                            </g>
                          ))}
                        </svg>
                      );
                    }
                    if (mc.startsWith("FRIDGE")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={4} fill="none" stroke="#666" strokeWidth="3"/>
                          <rect x={15} y={15} width={70} height={70} rx={2} fill="#ccc" fillOpacity={0.3}/>
                          <rect x={72} y={30} width={8} height={40} rx={3} fill="#888"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("DW")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={3} fill="none" stroke="#666" strokeWidth="3"/>
                          <rect x={10} y={10} width={80} height={18} rx={3} fill="#aaa" fillOpacity={0.4}/>
                          <circle cx={50} cy={55} r={22} fill="none" stroke="#888" strokeWidth="2" strokeDasharray="6 4"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("HOOD")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon points="20,20 80,20 65,80 35,80" fill="#aaa" fillOpacity={0.4} stroke="#666" strokeWidth="3"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("MW")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={15} width={80} height={70} rx={4} fill="none" stroke="#666" strokeWidth="3"/>
                          <rect x={15} y={20} width={55} height={60} rx={2} fill="#ccc" fillOpacity={0.3}/>
                          <rect x={74} y={20} width={12} height={60} rx={2} fill="#aaa" fillOpacity={0.5}/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("WINE")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={3} fill="none" stroke="#666" strokeWidth="3"/>
                          {([20,40,60,80] as number[]).map(y=>(
                            <line key={y} x1={10} y1={y} x2={90} y2={y} stroke="#888" strokeWidth="1.5"/>
                          ))}
                        </svg>
                      );
                    }
                    if (mc.startsWith("SINK") || mc.startsWith("FIX-BATHSINK") || mc.startsWith("FIX-LAUNDRYTUB")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={4} fill="none" stroke="#666" strokeWidth="2"/>
                          <ellipse cx={50} cy={52} rx={32} ry={28} fill="none" stroke="#888" strokeWidth="2"/>
                          <circle cx={50} cy={52} r={5} fill="#888"/>
                          <line x1={50} y1={18} x2={50} y2={30} stroke="#888" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("FIX-TOILET")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={20} y={10} width={60} height={30} rx={4} fill="none" stroke="#666" strokeWidth="2"/>
                          <ellipse cx={50} cy={70} rx={30} ry={25} fill="none" stroke="#888" strokeWidth="2"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("FIX-SHOWER")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={4} fill="none" stroke="#666" strokeWidth="2"/>
                          <circle cx={50} cy={50} r={25} fill="none" stroke="#888" strokeWidth="2" strokeDasharray="5 3"/>
                          <circle cx={50} cy={50} r={5} fill="#888"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("FIX-TUB")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={8} fill="none" stroke="#666" strokeWidth="2"/>
                          <ellipse cx={50} cy={55} rx={32} ry={26} fill="none" stroke="#888" strokeWidth="2"/>
                          <circle cx={50} cy={20} r={5} fill="#888"/>
                        </svg>
                      );
                    }
                    if (mc.startsWith("FIX-WASHER") || mc.startsWith("FIX-DRYER")) {
                      return (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect x={10} y={10} width={80} height={80} rx={4} fill="none" stroke="#666" strokeWidth="2"/>
                          <circle cx={50} cy={50} r={30} fill="none" stroke="#888" strokeWidth="2"/>
                          <circle cx={50} cy={50} r={18} fill="none" stroke="#aaa" strokeWidth="2"/>
                        </svg>
                      );
                    }
                    return null;
                  })()}
                  <span
                    className="text-[9px] font-bold leading-none truncate max-w-full relative z-10"
                    style={{ color: lbl.color, textShadow: lbl.shadow }}
                  >
                    {p.masterCode}
                  </span>
                  <span
                    className="text-[7px] leading-none mt-0.5 relative z-10"
                    style={{ color: lbl.color, opacity: 0.8, textShadow: lbl.shadow }}
                  >
                    {Math.round(p.width)}"
                  </span>
                </div>
                {!isWall && (!isCorner || isBlind) && (
                  <div
                    className="absolute bottom-0 left-0 right-0 border-b-2 border-[#8a6d3b]/40"
                    style={{ height: 2 }}
                  />
                )}
                {/* Open unit (door removed): show an "OPEN" hatch so the shop sees
                    there is no door/front on this cabinet. */}
                {p.noDoor && !isWall && !isAppliance && (
                  <div
                    className="absolute inset-1 z-10 flex items-center justify-center rounded pointer-events-none"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, #00000018 0, #00000018 3px, transparent 3px, transparent 7px)",
                    }}
                    title={t("dt_pc_open_no_door")}
                  >
                    <span className="text-[8px] font-bold tracking-wide text-[#5b6472]">{t("dt_pc_open")}</span>
                  </div>
                )}
                {/* Hinge-side marker: a short bar on the hinge edge of the door
                    face so the shop can see Left vs Right swing at a glance. */}
	                {!p.noDoor && (() => {
	                  const sw = resolveSwing(p);
	                  if (sw !== "left" && sw !== "right") return null;
	                  // Resolve legacy center/top overrides exactly as 3D does,
	                  // then place automatic hardware opposite the saved hinge.
	                  const hSide = planCabinetHardwarePosition(p);
	                  if (!hSide) return null;
                  return (
                    <>
                      <div
                        className="absolute top-1/2 z-10 -translate-y-1/2 rounded bg-[#1a2744]"
                        style={{
                          [sw === "left" ? "left" : "right"]: 1,
                          width: 2,
                          height: "55%",
                        } as React.CSSProperties}
                        title={sw === "left" ? t("dt_pc_left_hinge") : t("dt_pc_right_hinge")}
                      />
                      {hSide === "paired" ? <>
                        <div className="absolute top-1/2 z-10 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#c89b3c]" style={{ left: "38%" }} title="Paired door hardware" />
                        <div className="absolute top-1/2 z-10 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#c89b3c]" style={{ right: "38%" }} title="Paired door hardware" />
	                      </> : <div
	                        className={`absolute z-10 h-1.5 w-1.5 rounded-full bg-[#c89b3c] ${hSide === "top-center" ? "top-0.5 -translate-x-1/2" : "top-1/2 -translate-y-1/2"}`}
	                        style={{
	                          ...(hSide === "top-center" ? { left: "50%" } : { [hSide === "left" ? "left" : "right"]: 2 }),
	                        } as React.CSSProperties}
	                        title={hSide === "top-center" ? "Top-centered hardware" : hSide === "left" ? t("dt_pc_handle_left") : t("dt_pc_handle_right")}
	                      />
                      }
                    </>
                  );
                })()}
                {/* Blind corners need a corner filler strip for door clearance — show
                    a hatched gap marker on the inside edge so the layout reads correctly. */}

                {splitFillerTooltip && (
                  <span
                    id={`split-filler-tooltip-${p.uid}`}
                    role="tooltip"
                    data-testid="split-filler-dimension-tooltip"
                    className="pointer-events-none absolute left-1/2 top-0 z-50 w-max max-w-64 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded bg-[#1a2744] px-2 py-1 text-[9px] font-semibold leading-4 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                  >
                    {splitFillerTooltip}
                  </span>
                )}

                {/* Always-available rotate control on the selected cabinet — a
                    touch-friendly handle so customers can turn a cabinet without
                    a keyboard. Turns the cabinet 90° and re-seats it. */}
                {isSelected && !measureMode && onRotate && (
                  <button
                    type="button"
                    aria-label={t("dt_pc_rotate_aria")}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); onRotate(p.uid); }}
                    className="absolute -top-2.5 -left-2.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a2744] text-white shadow-md hover:bg-[#243456] active:scale-95 transition"
                    style={{ transitionDuration: "120ms" }}
                    title={t("dt_pc_rotate_title")}
                  >
                    <RotateCw className="h-3 w-3" strokeWidth={3} />
                  </button>
                )}
                {/* Always-available delete control on the selected cabinet. */}
                {isSelected && !measureMode && onDelete && !cabinetsLocked && (
                  <button
                    type="button"
                    aria-label={t("dt_pc_delete_cabinet")}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); onDelete(p.uid); }}
                    className="absolute -top-2.5 -right-2.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c] active:scale-95 transition"
                    style={{ transitionDuration: "120ms" }}
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                )}
                {/* Lock badge: shown on selected cabinet when cabinets are locked */}
                {isSelected && !measureMode && cabinetsLocked && (
                  <div
                    className="absolute -top-2.5 -right-2.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-md"
                    title="Cabinets are locked — click 'Lock Cabs' in toolbar to unlock"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                )}
	              {isSeatedProtectedCorner && onUnlockCorner && !cabinetsLocked && (
                <div
                  role="tooltip"
                  data-testid="corner-snap-unlock-tooltip"
                  className="pointer-events-none absolute inset-x-1 bottom-1 z-50 flex items-center justify-between gap-1 rounded-md border border-emerald-200 bg-emerald-950 px-1.5 py-1 text-[8px] font-semibold leading-3 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                >
                  <span className="mr-2">Corner snap confirmed</span>
                  <button
                    type="button"
                    data-testid="unlock-corner-snap"
                    aria-label={`Unlock ${p.masterCode} corner snap so it can be moved`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnlockCorner(p.uid);
                    }}
                    className="pointer-events-auto shrink-0 rounded border border-emerald-200/70 bg-white px-1.5 py-0.5 text-[9px] font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50 active:scale-[0.97]"
                  >
                    Unlock
                  </button>
                </div>
              )}
              </div>
            );
          })}

        {/* Crown-top badges: one per continuous upper run, showing the height the
            crown finishes at. Runs whose top differs from another run on the same
            wall are flagged so mismatched tops are caught before opening 3D. */}
        {showCrownTopBadges && showWallLayer && !drawMode && !measureMode && crownTopRuns(cabinets, room).map((run) => (
          <div
            key={`crown-top-${run.wallId}-${run.start}-${run.top}`}
            data-testid="crown-top-badge"
            data-crown-top={run.top}
            data-crown-mismatch={run.mismatch ? "true" : undefined}
            className={`pointer-events-none absolute z-40 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[8px] font-extrabold leading-none shadow-[0_0_0_2px_rgba(255,255,255,0.86)] ${
              run.mismatch
                ? "border-amber-300 bg-amber-500 text-white"
                : "border-slate-300 bg-slate-800 text-white"
            }`}
            style={{ left: run.centerX * ppi, top: run.centerY * ppi }}
            title={run.mismatch
              ? `Crown top ${formatCrownTop(run.top)} — another run on this wall finishes at ${run.otherTops.map(formatCrownTop).join(", ")}. Level the tops or the crown will step.`
              : `Crown top ${formatCrownTop(run.top)} — this upper run's crown finishes here.`}
          >
            {run.mismatch ? "\u26A0 " : ""}CROWN {formatCrownTop(run.top)}
          </div>
        ))}
        {/* Selected-cabinet ID callout: a leader line from the cabinet out to a
            high-contrast ID chip placed just outside the nearest room edge, so
            the code is readable even when the cabinet is narrow / dark / packed
            against neighbors. Only for the selected cabinet, and skipped while
            drawing or measuring to avoid clutter. */}
        {!drawMode && !measureMode && selectedUid && (() => {
          const sel = cabinets.find((c) => c.uid === selectedUid);
          if (!sel) return null;
          const { w: fw, d: fd } = placedFootprint(sel);
          const cx = (sel.x + fw / 2) * ppi;
          const cy = (sel.y + fd / 2) * ppi;
          // Choose the nearest perimeter edge to exit toward.
          const distTop = cy, distBottom = roomPxH - cy, distLeft = cx, distRight = roomPxW - cx;
          const minD = Math.min(distTop, distBottom, distLeft, distRight);
          const gap = 26; // how far outside the wall to place the chip
          let ex = cx, ey = cy;
          if (minD === distTop) { ey = -gap; }
          else if (minD === distBottom) { ey = roomPxH + gap; }
          else if (minD === distLeft) { ex = -gap; }
          else { ex = roomPxW + gap; }
          const label = sel.masterCode;
          const horizontalExit = minD === distTop || minD === distBottom;
          return (
            <>
              <svg className="pointer-events-none absolute inset-0 z-[45] overflow-visible" width={roomPxW} height={roomPxH}>
                <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#d4a75a" strokeWidth={1.5} strokeDasharray="3 2" />
                <circle cx={cx} cy={cy} r={2.5} fill="#d4a75a" stroke="#1a2744" strokeWidth={1} />
                <polygon
                  points={
                    horizontalExit
                      ? `${ex},${ey} ${ex - 4},${ey + (ey < cy ? 6 : -6)} ${ex + 4},${ey + (ey < cy ? 6 : -6)}`
                      : `${ex},${ey} ${ex + (ex < cx ? 6 : -6)},${ey - 4} ${ex + (ex < cx ? 6 : -6)},${ey + 4}`
                  }
                  fill="#d4a75a"
                />
              </svg>
              <div
                className="pointer-events-none absolute z-[46] -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#1a2744] px-2 py-0.5 text-[10px] font-bold text-white shadow-lg ring-1 ring-[#d4a75a] whitespace-nowrap"
                style={{ left: ex, top: ey }}
              >
                {label}
              </div>
            </>
          );
        })()}

        {/* Live drag tape-measure: two-sided clearance along the wall */}
        {measurementBubblesVisible && dragTape && (() => {
          const { m, frame, pointAt } = dragTape;
          const tick = { x: -frame.tangent.y * 5, y: frame.tangent.x * 5 };
          const labelAngle = parallelWallLabelAngleDeg(frame.tangent.x, frame.tangent.y);
          // Use the same high-contrast white drafting chip as the exterior
          // dimension rails. During a cabinet drag the old arrow glyphs were
          // too small to distinguish from the dimension itself, especially on
          // a diagonal wall. The end ticks and extension lines already show
          // which side is being measured, so the bubble states the actual
          // clearance only.
          const clearanceFontSize = Math.max(10, Math.min(16, Number(room.dimensionLabelStyle?.fontSizePx) || 11));
          const segs = [
            { start: m.start - m.before, end: m.start, value: m.before, side: "before" as const },
            { start: m.end, end: m.end + m.after, value: m.after, side: "after" as const },
          ];
          return (
            <svg data-testid="live-cabinet-gap-dimensions" className="pointer-events-none absolute inset-0 z-40 overflow-visible" width={roomPxW} height={roomPxH} style={measurementBubbleStyle}>
              {segs.map((segment, index) => {
                const start = pointAt(segment.start);
                const end = pointAt(segment.end);
                const middle = pointAt((segment.start + segment.end) / 2);
                const label = formatDisplayDimension(segment.value);
                const labelWidth = Math.max(46, Math.round(label.length * clearanceFontSize * 0.76 + 18));
                const labelHeight = Math.max(20, clearanceFontSize + 9);
                return <g key={index} stroke="#1a2744" strokeWidth={1.25}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  <line x1={start.x - tick.x} y1={start.y - tick.y} x2={start.x + tick.x} y2={start.y + tick.y} />
                  <line x1={end.x - tick.x} y1={end.y - tick.y} x2={end.x + tick.x} y2={end.y + tick.y} />
                  <g transform={`translate(${middle.x} ${middle.y}) rotate(${labelAngle})`}>
                    <rect
                      data-testid={`live-gap-dimension-bubble-${segment.side}`}
                      x={-labelWidth / 2}
                      y={-labelHeight / 2}
                      width={labelWidth}
                      height={labelHeight}
                      rx={4}
                      fill="white"
                      fillOpacity={0.98}
                      stroke="#a8b5cf"
                      strokeWidth={1.2}
                    />
                    <text x={0} y={clearanceFontSize * 0.34} textAnchor="middle" fontSize={clearanceFontSize} fontWeight={800} fill={room.dimensionLabelStyle?.color || "#1a2744"}>{label}</text>
                  </g>
                </g>;
              })}
            </svg>
          );
        })()}

        {/* Google-style point-to-point tape measure. The start point remains
            visible after the first tap; a second tap completes the distance. */}
        {measurementBubblesVisible && measurePoints.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 z-40 overflow-visible"
            width={roomPxW}
            height={roomPxH}
            style={measurementBubbleStyle}
          >
            {measure && (
              <line
                x1={measure.ax} y1={measure.ay} x2={measure.bx} y2={measure.by}
                stroke="#d4a75a" strokeWidth={3} strokeLinecap="round"
              />
            )}
            <circle cx={measurePoints[0].x * ppi} cy={measurePoints[0].y * ppi} r={5} fill="#d4a75a" stroke="#1a2744" strokeWidth={1.5} />
            {measure && <circle cx={measure.bx} cy={measure.by} r={5} fill="#d4a75a" stroke="#1a2744" strokeWidth={1.5} />}
          </svg>
        )}
        {measurementBubblesVisible && measure && (
          <div
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#d4a75a] bg-white/98 px-2 py-1 text-center text-[10px] font-semibold text-slate-950 shadow-lg whitespace-nowrap"
            style={{ left: measure.midX, top: measure.midY, ...measurementBubbleStyle }}
          >
            <span className="block text-[11px] font-extrabold text-slate-950">Tape {formatDisplayDimension(measure.distIn)}</span>
            <span className="block text-[9px] text-slate-700">Point-to-point · X {formatDisplayDimension(measure.dx)} · Y {formatDisplayDimension(measure.dy)}</span>
            <span className="block text-[8px] text-slate-600">Use the catalog fit banner for usable cabinet clearance</span>
          </div>
        )}


        {/* ─── Live Floor Plan dimensions (display-only) ───────────────── */}
        {measurementBubblesVisible && autoDimensions && (() => {
          const wallFrames = roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula");
          const chains = floorPlanWallDimensionChains(room, cabinets)
            .filter((chain) => chain.layer === "base" || showWallLayer);
          const availableCabinetSpans = floorPlanAvailableCabinetSpans(room, cabinets, openings, showWallLayer);
          const activeLayers = showWallLayer ? ["base", "wall"] as const : ["base"] as const;
          // 2020-style exterior drafting rails: every wall dimension lives
          // outside the drawing, with the detail chain nearest the wall and
          // the overall wall length farthest out. The canvas reserves a
          // matching gutter above, so nothing sits on cabinet faces.
          const baseRailOffsetIn = 3;
          const wallRailOffsetIn = 6;
          const openingRailOffsetIn = 8.5;
          const outerRailOffsetIn = 11;
          const labelOffsetIn = 1.4;
          const tickPx = 4;
          const dimensionFontSize = Math.max(8, Math.min(18, Number(room.dimensionLabelStyle?.fontSizePx) || 9));
          const dimensionColor = room.dimensionLabelStyle?.color || "#1a2744";
          const pointAt = (frame: typeof wallFrames[number], along: number, inwardIn: number) => ({
            x: (frame.start.x + frame.tangent.x * along + frame.inward.x * inwardIn) * ppi,
            y: (frame.start.y + frame.tangent.y * along + frame.inward.y * inwardIn) * ppi,
          });
          const adjustmentFor = (key: string): FloorPlanDimensionAdjustment => room.dimensionAdjustments?.[key] ?? {};
          const railPoint = (frame: typeof wallFrames[number], along: number, railOffsetIn: number, adjustment: FloorPlanDimensionAdjustment) =>
            pointAt(frame, along + (adjustment.alongIn ?? 0), -(railOffsetIn + (adjustment.outsideIn ?? 0)));
          const labelMetrics = (characters: number) => ({
            width: Math.max(38, Math.round(dimensionFontSize * Math.max(4.4, characters * 0.64))),
            height: Math.max(14, Math.round(dimensionFontSize + 7)),
          });
          const wallPoint = (frame: typeof wallFrames[number], along: number) => pointAt(frame, along, 0);
          const labelAngle = (frame: typeof wallFrames[number]) => parallelWallLabelAngleDeg(frame.tangent.x, frame.tangent.y);
          const tickVector = (frame: typeof wallFrames[number]) => ({ x: -frame.tangent.y * tickPx, y: frame.tangent.x * tickPx });
          const openingDimensions = openings.flatMap((opening) => {
            const frame = wallFrames.find((candidate) => candidate.id === opening.side);
            if (!frame) return [];
            const start = Math.max(0, Math.min(frame.length, opening.offset));
            const width = Math.max(0, Math.min(frame.length - start, opening.width));
            if (width <= 0) return [];
            const end = Math.max(0, frame.length - start - width);
            return [{ opening, frame, start, width, end }];
          });
          const islandAisle = island ? (() => {
            const box = { left: island.x, top: island.y, right: island.x + island.width, bottom: island.y + island.depth };
            const distances = cabinets.map((cabinet) => {
              const footprint = placedFootprint(cabinet);
              const other = { left: cabinet.x, top: cabinet.y, right: cabinet.x + footprint.w, bottom: cabinet.y + footprint.d };
              const dx = Math.max(0, box.left - other.right, other.left - box.right);
              const dy = Math.max(0, box.top - other.bottom, other.top - box.bottom);
              return Math.hypot(dx, dy);
            }).filter((value) => value > 0.001);
            return distances.length ? Math.min(...distances) : null;
          })() : null;
	          const peninsulaDimensions = roomWallRunFrames(room)
	            .filter((frame) => frame.kind === "peninsula")
	            .map((frame) => {
	              const ownCabinets = cabinets.filter((cabinet) => cabinetWall(cabinet, room) === frame.id);
	              const depth = Math.max(24, ...ownCabinets.map((cabinet) => Math.max(0, Number(cabinet.depth) || 0)));
	              const midpoint = {
	                x: frame.start.x + frame.tangent.x * frame.length / 2,
	                y: frame.start.y + frame.tangent.y * frame.length / 2,
	              };
	              const aisle = roomWallRunFrames(room)
	                .filter((other) => other.id !== frame.id && cabinets.some((cabinet) => cabinetWall(cabinet, room) === other.id))
	                .map((other) => Math.max(0, wallRunDistanceToPoint(other, midpoint) - depth / 2))
	                .sort((left, right) => left - right)[0] ?? null;
	              return { frame, depth, aisle };
	            });
          return (
            <svg data-testid="floor-plan-live-dimensions" className="pointer-events-none absolute inset-0 z-30 overflow-visible" width={roomPxW} height={roomPxH} aria-label="Live Floor Plan dimensions" style={measurementBubbleStyle}>
              {/* Outer physical-wall lines: corner-to-corner, including measured 45° walls. */}
              {wallFrames.map((frame) => {
                const dimensionKey = `wall:${frame.id}`;
                const adjustment = adjustmentFor(dimensionKey);
                const label = formatDisplayDimension(frame.length);
                const metrics = labelMetrics(label.length);
                const start = railPoint(frame, 0, outerRailOffsetIn, adjustment);
                const end = railPoint(frame, frame.length, outerRailOffsetIn, adjustment);
                const middle = railPoint(frame, frame.length / 2, outerRailOffsetIn + labelOffsetIn, adjustment);
                const wallStart = wallPoint(frame, 0);
                const wallEnd = wallPoint(frame, frame.length);
                const tick = tickVector(frame);
                return <g
                  key={`floor-dimension-wall-${frame.id}`}
                  data-testid={`floor-dimension-wall-${frame.id}`}
                  data-dimension-key={dimensionKey}
                  className={onDimensionAdjustmentChange ? "pointer-events-auto cursor-grab active:cursor-grabbing" : undefined}
                  onPointerDown={(event) => beginDimensionLeaderDrag(event, dimensionKey, frame)}
                  onPointerMove={moveDimensionLeaderDrag}
                  onPointerUp={endDimensionLeaderDrag}
                  onPointerCancel={endDimensionLeaderDrag}
                >
                  <line x1={wallStart.x} y1={wallStart.y} x2={start.x} y2={start.y} stroke="#64748b" strokeWidth={0.8} />
                  <line x1={wallEnd.x} y1={wallEnd.y} x2={end.x} y2={end.y} stroke="#64748b" strokeWidth={0.8} />
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#273b6b" strokeWidth={1} />
                  <line x1={start.x - tick.x} y1={start.y - tick.y} x2={start.x + tick.x} y2={start.y + tick.y} stroke="#273b6b" strokeWidth={1} />
                  <line x1={end.x - tick.x} y1={end.y - tick.y} x2={end.x + tick.x} y2={end.y + tick.y} stroke="#273b6b" strokeWidth={1} />
                  <g transform={`translate(${middle.x} ${middle.y}) rotate(${labelAngle(frame)})`}>
                    <rect x={-metrics.width / 2} y={-metrics.height / 2} width={metrics.width} height={metrics.height} rx={4} fill="white" fillOpacity={0.96} stroke="#a8b5cf" />
                    <text x={0} y={dimensionFontSize * 0.34} textAnchor="middle" fontSize={dimensionFontSize} fontWeight={700} fill={dimensionColor}>{label}</text>
                  </g>
                </g>;
              })}

              {/* Exterior run lines: installed catalog cabinet widths.  Free runs
                  render below from the placement-aware span helper so a red fit
                  label cannot accidentally describe an opening or blocked edge. */}
              {chains.flatMap((chain) => {
                const frame = wallFrames.find((candidate) => candidate.id === chain.wallId);
                if (!frame) return [];
                const railOffsetIn = chain.layer === "wall" ? wallRailOffsetIn : baseRailOffsetIn;
                const tick = tickVector(frame);
                return chain.segments.filter((segment) => segment.kind === "cabinet").map((segment, index) => {
                  const dimensionKey = `run:${chain.wallId}:${chain.layer}:${index}`;
                  const adjustment = adjustmentFor(dimensionKey);
                  const label = formatDisplayDimension(segment.length);
                  const metrics = labelMetrics(label.length);
                  const start = railPoint(frame, segment.start, railOffsetIn, adjustment);
                  const end = railPoint(frame, segment.start + segment.length, railOffsetIn, adjustment);
                  const middle = railPoint(frame, segment.start + segment.length / 2, railOffsetIn + labelOffsetIn, adjustment);
                  const wallStart = wallPoint(frame, segment.start);
                  const wallEnd = wallPoint(frame, segment.start + segment.length);
                  const short = segment.length * ppi < 30;
                  const labelPoint = short ? railPoint(frame, segment.start + segment.length / 2, railOffsetIn + 4.5, adjustment) : middle;
                  const color = "#1a2744";
                  return <g
                    key={`floor-dimension-run-${chain.wallId}-${chain.layer}-${index}`}
                    data-testid={`floor-dimension-run-${chain.wallId}-${chain.layer}-${index}`}
                    data-dimension-key={dimensionKey}
                    className={onDimensionAdjustmentChange ? "pointer-events-auto cursor-grab active:cursor-grabbing" : undefined}
                    onPointerDown={(event) => beginDimensionLeaderDrag(event, dimensionKey, frame)}
                    onPointerMove={moveDimensionLeaderDrag}
                    onPointerUp={endDimensionLeaderDrag}
                    onPointerCancel={endDimensionLeaderDrag}
                  >
                    <line x1={wallStart.x} y1={wallStart.y} x2={start.x} y2={start.y} stroke={color} strokeOpacity={0.55} strokeWidth={0.75} />
                    <line x1={wallEnd.x} y1={wallEnd.y} x2={end.x} y2={end.y} stroke={color} strokeOpacity={0.55} strokeWidth={0.75} />
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={1} />
                    <line x1={start.x - tick.x} y1={start.y - tick.y} x2={start.x + tick.x} y2={start.y + tick.y} stroke={color} strokeWidth={1} />
                    <line x1={end.x - tick.x} y1={end.y - tick.y} x2={end.x + tick.x} y2={end.y + tick.y} stroke={color} strokeWidth={1} />
                    {short && <line x1={(start.x + end.x) / 2} y1={(start.y + end.y) / 2} x2={labelPoint.x} y2={labelPoint.y} stroke={color} strokeWidth={1} />}
                    <g transform={`translate(${labelPoint.x} ${labelPoint.y}) rotate(${labelAngle(frame)})`}>
                      <rect x={-metrics.width / 2} y={-metrics.height / 2} width={metrics.width} height={metrics.height} rx={3} fill="white" fillOpacity={0.94} />
                      <text x={0} y={dimensionFontSize * 0.34} textAnchor="middle" fontSize={Math.max(8, dimensionFontSize - 1)} fontWeight={500} fill={dimensionColor}>{label}</text>
                    </g>
                  </g>;
                });
              })}
              {/* Red cabinet-space labels use freeSegmentsOnWall—the same
                  opening-aware source of truth used when a catalog item is
                  actually placed.  They replace the older generic “Open” chips. */}
              {availableCabinetSpans.map((gap, index) => {
                const frame = wallFrames.find((candidate) => candidate.id === gap.side);
                if (!frame) return null;
                const railOffsetIn = gap.layer === "wall" ? wallRailOffsetIn : baseRailOffsetIn;
                const dimensionKey = `available:${gap.side}:${gap.layer}:${index}`;
                const adjustment = adjustmentFor(dimensionKey);
                const label = `Fits up to ${formatDisplayDimension(gap.length)} — ${gap.layer === "wall" ? "Wall" : "Base"}`;
                const metrics = labelMetrics(label.length);
                const start = railPoint(frame, gap.start, railOffsetIn, adjustment);
                const end = railPoint(frame, gap.start + gap.length, railOffsetIn, adjustment);
                const middle = railPoint(frame, gap.start + gap.length / 2, railOffsetIn + labelOffsetIn, adjustment);
                const wallStart = wallPoint(frame, gap.start);
                const wallEnd = wallPoint(frame, gap.start + gap.length);
                const short = gap.length * ppi < 30;
                const labelPoint = short ? railPoint(frame, gap.start + gap.length / 2, railOffsetIn + 4.5, adjustment) : middle;
                const color = "#dc2626";
                return <g
                  key={`floor-available-gap-${gap.side}-${gap.layer}-${index}`}
                  data-testid={`floor-available-gap-${gap.side}-${gap.layer}-${index}`}
                  data-dimension-key={dimensionKey}
                  aria-label={`${gap.layer === "wall" ? "Wall" : "Base"} cabinet space: fits up to ${formatDisplayDimension(gap.length)}.`}
                  className={onDimensionAdjustmentChange ? "pointer-events-auto cursor-grab active:cursor-grabbing" : undefined}
                  onPointerDown={(event) => beginDimensionLeaderDrag(event, dimensionKey, frame)}
                  onPointerMove={moveDimensionLeaderDrag}
                  onPointerUp={endDimensionLeaderDrag}
                  onPointerCancel={endDimensionLeaderDrag}
                >
                  <line x1={wallStart.x} y1={wallStart.y} x2={start.x} y2={start.y} stroke={color} strokeOpacity={0.6} strokeWidth={0.75} />
                  <line x1={wallEnd.x} y1={wallEnd.y} x2={end.x} y2={end.y} stroke={color} strokeOpacity={0.6} strokeWidth={0.75} />
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={1.25} />
                  <line x1={start.x - tickVector(frame).x} y1={start.y - tickVector(frame).y} x2={start.x + tickVector(frame).x} y2={start.y + tickVector(frame).y} stroke={color} strokeWidth={1.25} />
                  <line x1={end.x - tickVector(frame).x} y1={end.y - tickVector(frame).y} x2={end.x + tickVector(frame).x} y2={end.y + tickVector(frame).y} stroke={color} strokeWidth={1.25} />
                  {short && <line x1={(start.x + end.x) / 2} y1={(start.y + end.y) / 2} x2={labelPoint.x} y2={labelPoint.y} stroke={color} strokeWidth={1} />}
                  <g transform={`translate(${labelPoint.x} ${labelPoint.y}) rotate(${labelAngle(frame)})`}>
                    <rect x={-metrics.width / 2} y={-metrics.height / 2} width={metrics.width} height={metrics.height} rx={3} fill="#fff1f2" stroke="#fecdd3" />
                    <text x={0} y={dimensionFontSize * 0.34} textAnchor="middle" fontSize={Math.max(8, dimensionFontSize - 1)} fontWeight={800} fill="#dc2626">{label}</text>
                  </g>
                </g>;
              })}

              {/* Door, window, and cased-opening width plus both wall-end dimensions. */}
              {openingDimensions.map(({ opening, frame, start, width, end }) => {
                const dimensionKey = `opening:${opening.uid}`;
                const adjustment = adjustmentFor(dimensionKey);
                const openingKind = opening.kind === "door"
                  ? "Door"
                  : opening.kind === "window"
                    ? "Window"
                    : "Wall opening";
                const label = `${openingKind} ${formatDisplayDimension(width)} · ${formatDisplayDimension(start)} / ${formatDisplayDimension(end)} to ends`;
                const metrics = labelMetrics(label.length);
                const a = railPoint(frame, start, openingRailOffsetIn, adjustment);
                const b = railPoint(frame, start + width, openingRailOffsetIn, adjustment);
                const m = railPoint(frame, start + width / 2, openingRailOffsetIn + labelOffsetIn, adjustment);
                const wallStart = wallPoint(frame, start);
                const wallEnd = wallPoint(frame, start + width);
                return <g
                  key={`floor-dimension-opening-${opening.uid}`}
                  data-testid={`floor-dimension-opening-${opening.uid}`}
                  data-dimension-key={dimensionKey}
                  className={onDimensionAdjustmentChange ? "pointer-events-auto cursor-grab active:cursor-grabbing" : undefined}
                  onPointerDown={(event) => beginDimensionLeaderDrag(event, dimensionKey, frame)}
                  onPointerMove={moveDimensionLeaderDrag}
                  onPointerUp={endDimensionLeaderDrag}
                  onPointerCancel={endDimensionLeaderDrag}
                >
                  <line x1={wallStart.x} y1={wallStart.y} x2={a.x} y2={a.y} stroke="#0f766e" strokeOpacity={0.55} strokeWidth={0.75} />
                  <line x1={wallEnd.x} y1={wallEnd.y} x2={b.x} y2={b.y} stroke="#0f766e" strokeOpacity={0.55} strokeWidth={0.75} />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0f766e" strokeWidth={1} strokeDasharray="2 2" />
                  <g transform={`translate(${m.x} ${m.y}) rotate(${labelAngle(frame)})`}>
                    <rect x={-metrics.width / 2} y={-metrics.height / 2} width={metrics.width} height={metrics.height} rx={3} fill="white" fillOpacity={0.96} />
                    <text x={0} y={dimensionFontSize * 0.34} textAnchor="middle" fontSize={Math.max(8, dimensionFontSize - 1)} fontWeight={700} fill={dimensionColor}>{label}</text>
                  </g>
                </g>;
              })}

              {/* Freestanding island/peninsula size and nearest clear aisle. */}
              {island && <g data-testid="floor-dimension-island">
                <line x1={island.x * ppi} y1={(island.y - 8) * ppi} x2={(island.x + island.width) * ppi} y2={(island.y - 8) * ppi} stroke="#6d28d9" strokeWidth={1} />
                <text x={(island.x + island.width / 2) * ppi} y={(island.y - 10) * ppi} textAnchor="middle" fontSize={9} fontWeight={700} fill="#5b21b6">{formatDisplayDimension(island.width)}</text>
                <line x1={(island.x - 8) * ppi} y1={island.y * ppi} x2={(island.x - 8) * ppi} y2={(island.y + island.depth) * ppi} stroke="#6d28d9" strokeWidth={1} />
                <text x={(island.x - 10) * ppi} y={(island.y + island.depth / 2) * ppi} textAnchor="end" fontSize={9} fontWeight={700} fill="#5b21b6">{formatDisplayDimension(island.depth)}{islandAisle != null ? ` · aisle ${formatDisplayDimension(islandAisle)}` : ""}</text>
              </g>}
	              {peninsulaDimensions.map(({ frame, depth, aisle }) => {
	                const start = pointAt(frame, 0, depth / 2 + 8);
	                const end = pointAt(frame, frame.length, depth / 2 + 8);
	                const middle = pointAt(frame, frame.length / 2, depth / 2 + 11);
	                const tick = tickVector(frame);
	                return <g key={`floor-dimension-peninsula-${frame.id}`} data-testid={`floor-dimension-peninsula-${frame.id}`}>
	                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#6d28d9" strokeWidth={1} />
	                  <line x1={start.x - tick.x} y1={start.y - tick.y} x2={start.x + tick.x} y2={start.y + tick.y} stroke="#6d28d9" strokeWidth={1} />
	                  <line x1={end.x - tick.x} y1={end.y - tick.y} x2={end.x + tick.x} y2={end.y + tick.y} stroke="#6d28d9" strokeWidth={1} />
	                  <g transform={`translate(${middle.x} ${middle.y}) rotate(${labelAngle(frame)})`}>
	                    <rect x={-52} y={-8} width={104} height={16} rx={4} fill="white" fillOpacity={0.94} stroke="#c4b5fd" />
                    <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#5b21b6">{formatDisplayDimension(frame.length)} × {formatDisplayDimension(depth)}{aisle != null ? ` · aisle ${formatDisplayDimension(aisle)}` : ""}</text>
	                  </g>
	                </g>;
	              })}
              <title>{`Live dimensions · ${activeLayers.join(" + ")} cabinet layers`}</title>
            </svg>
          );
        })()}

	        {/* Opening-gap chips are intentionally omitted from the canvas. The
	            selected-wall Compass is the sole persistent wall-editing affordance
	            so the plan remains uncluttered. */}

        {/* ── Furniture footprints (floor-plan only) ───────────────────── */}
        {furniture.map((f) => {
          const def = FURNITURE_CATALOG.find((fd) => fd.id === f.defId);
          if (!def) return null;
          const bathroomFixture = verifiedPelicanBathroomFixtureProfile(f.pelicanCode ?? def.pelicanCode);
          const fp = furnitureFootprint(f, def);
          const frame = def.category === "bathroom-fixture" || def.category === "bathroom-zone" ? furniturePlanFrame(f) : null;
          const isSelected = selectedFurnUid === f.uid;
          const pxW = (frame?.width ?? fp.w) * ppi;
          const pxD = (frame?.depth ?? fp.d) * ppi;
          const isRound = def.shape === "round";
          const bathroomPlanningZone = def.category === "bathroom-zone";
          const showerEnvelope = bathroomFixture?.kind === "shower-door" || bathroomFixture?.kind === "tub-door" || bathroomFixture?.kind === "shower-wall";
          const zoneWarnings = bathroomZoneWarningsByFixture?.get(f.uid) ?? [];
          const hasZoneWarning = zoneWarnings.length > 0;
          const furnitureActionLabel = bathroomFixture
            ? `${bathroomFixture.pelicanCode} ${bathroomFixture.kind.replace(/-/g, " ")}`
            : def.name;
          return (
            <div
              key={f.uid}
              data-testid={hasZoneWarning ? `bathroom-zone-overlap-${f.uid}` : undefined}
              data-furniture-uid={f.uid}
              data-furniture-definition={f.defId}
              data-rotation={f.rotation}
              tabIndex={bathroomPlanningZone ? 0 : undefined}
              role={bathroomPlanningZone ? "group" : undefined}
              aria-label={bathroomPlanningZone ? `${def.name.split(" · ")[0]} ${fp.w} by ${fp.d} inches. Press Enter for Attributes.` : undefined}
              className="absolute cursor-grab active:cursor-grabbing select-none"
              style={{
                left: (frame?.left ?? f.x) * ppi,
                top: (frame?.top ?? f.y) * ppi,
                width: pxW,
                height: pxD,
                background: bathroomPlanningZone ? `${def.color}22` : showerEnvelope ? bathroomFixture?.kind === "shower-wall" ? "#e7e2dc" : "#d8eef466" : bathroomFixture?.finish === "vitreous-china-matte-black" ? "#232323" : bathroomFixture ? "#fbfcfa" : def.color + "33",
                border: `2px ${bathroomPlanningZone || showerEnvelope ? "dashed" : "solid"} ${hasZoneWarning ? "#dc2626" : isSelected ? "#1a2744" : bathroomFixture ? "#87929b" : def.color}`,
                borderRadius: bathroomFixture?.kind === "freestanding-tub" ? bathroomFixture.tubShape === "rectangular" ? "6% / 3%" : bathroomFixture.tubShape === "rounded-rectangular" ? "25% / 12%" : "48% / 26%" : bathroomFixture?.kind === "toilet" || bathroomFixture?.kind === "bidet" ? "42% 42% 30% 30%" : isRound ? "50%" : 4,
                transform: `rotate(${f.rotation}deg)`,
                transformOrigin: "center",
                zIndex: 20,
                boxShadow: hasZoneWarning ? "0 0 0 2px #fecaca, 0 0 14px #ef444488" : isSelected ? `0 0 0 2px #1a274488` : undefined,
              }}
              onPointerDown={(e) => onFurnPointerDown(e, f)}
              onPointerMove={onFurnPointerMove}
              onPointerUp={onFurnPointerUp}
              onContextMenu={(event) => { if (!bathroomPlanningZone) return; event.preventDefault(); event.stopPropagation(); onSelectFurn?.(f.uid); onOpenFurnitureAttributes?.(f.uid); }}
              onDoubleClick={(event) => { if (!bathroomPlanningZone) return; event.stopPropagation(); onOpenFurnitureAttributes?.(f.uid); }}
              onKeyDown={(event) => { if (!bathroomPlanningZone || event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return; event.preventDefault(); event.stopPropagation(); onSelectFurn?.(f.uid); onOpenFurnitureAttributes?.(f.uid); }}
            >
              {bathroomFixture?.kind === "freestanding-tub" && (
                <div className={`pointer-events-none absolute inset-[14%] border border-slate-400/70 bg-slate-100/80 ${bathroomFixture.tubShape === "rectangular" ? "rounded-[6%]" : bathroomFixture.tubShape === "rounded-rectangular" ? "rounded-[22%]" : "rounded-[48%_/_30%]"}`} />
              )}
              {bathroomFixture?.kind === "alcove-tub" && (
                <div className="pointer-events-none absolute inset-x-[9%] top-[12%] bottom-[13%] rounded-[22%] border border-slate-400/70 bg-slate-100/80" />
              )}
              {showerEnvelope && (
                <>
                  {bathroomFixture?.kind === "shower-wall" ? <div className="pointer-events-none absolute inset-x-[8%] top-[12%] bottom-[12%] border border-stone-400/70 bg-stone-100/60" /> : <><div className="pointer-events-none absolute left-1/2 top-0 h-full border-l border-slate-500/80" /><div className="pointer-events-none absolute inset-y-[14%] left-[10%] right-[10%] border-y border-slate-400/60" /></>}
                  <span className="pointer-events-none absolute bottom-0.5 left-1 right-1 rounded bg-white/75 px-0.5 text-center text-[7px] font-semibold uppercase tracking-wide text-slate-600">Visual envelope</span>
                </>
              )}
              {bathroomPlanningZone && <span className="pointer-events-none absolute bottom-0.5 left-1 right-1 rounded bg-white/80 px-0.5 text-center text-[7px] font-semibold uppercase tracking-wide" style={{ color: def.color }}>Movable planning zone</span>}
              {hasZoneWarning && <span className="pointer-events-none absolute -bottom-4 left-1/2 z-30 w-max max-w-[12rem] -translate-x-1/2 rounded bg-red-700 px-1.5 py-0.5 text-center text-[8px] font-semibold text-white shadow" title={zoneWarnings.map((warning) => `${warning.fixtureLabel} overlaps the ${warning.zoneLabel}`).join(" ")}>Different planning zone</span>}
              {(bathroomFixture?.kind === "toilet" || bathroomFixture?.kind === "bidet") && (
                <div className="pointer-events-none absolute left-[20%] right-[20%] top-[27%] bottom-[12%] rounded-[48%] border border-slate-400/70 bg-slate-100/80" />
              )}
              {bathroomFixture?.drain && (
                <div className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 rounded-full bg-slate-500" style={{ left: bathroomFixture.drain === "left" ? "22%" : bathroomFixture.drain === "right" ? "78%" : "50%", transform: "translate(-50%, -50%)" }} />
              )}
              {bathroomFixture?.kind === "floor-tub-filler" && (
                <div data-testid="floor-tub-filler-icon" className="pointer-events-none absolute inset-[15%]">
                  <div className="absolute left-[35%] top-[18%] h-[32%] w-[30%] rounded-full border-2 border-slate-600" />
                  <div className="absolute left-[48%] top-[40%] h-[46%] w-[12%] rounded bg-slate-600" />
                </div>
              )}
              {/* Label */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ fontSize: Math.max(7, Math.min(10, pxW / 6)) }}
              >
                <span className="font-semibold leading-tight" style={{ color: bathroomFixture?.finish === "vitreous-china-matte-black" ? "#f8fafc" : def.color }}>{bathroomFixture?.pelicanCode ?? (bathroomPlanningZone ? def.name.split(" · ")[0] : def.name)}</span>
                <span className="text-[8px] opacity-60" style={{ color: def.color }}>
                  {bathroomFixture?.footprintBasis ? "Illustrative footprint" : isRound ? `${def.w}"⌀` : `${fp.w}"×${fp.d}"`}
                </span>
              </div>
              {/* Selected controls */}
              {isSelected && (
                <>
                  <button
                    className="absolute -top-4 -right-4 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow z-30"
                    onPointerDown={(e) => { e.stopPropagation(); onDeleteFurn?.(f.uid); }}
                    aria-label={`Remove ${furnitureActionLabel}`}
                    title={`Remove ${furnitureActionLabel}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    className={`absolute -top-4 -left-4 rounded-full bg-[#1a2744] text-white flex items-center justify-center shadow z-30 ${frame ? "w-10 h-10" : "w-6 h-6"}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRotateFurn?.(f.uid); }}
                    aria-label={`Rotate ${furnitureActionLabel} 90 degrees`}
                    title={`Rotate ${furnitureActionLabel} 90°`}
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  {bathroomPlanningZone && onOpenFurnitureAttributes && <button type="button" data-testid={`bathroom-zone-attributes-${f.uid}`} className="absolute -bottom-10 left-1/2 min-h-9 -translate-x-1/2 rounded border border-slate-400 bg-white px-3 text-[11px] font-semibold text-[#1a2744] shadow z-30" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onOpenFurnitureAttributes(f.uid); }}>Attributes</button>}
                </>
              )}
            </div>
          );
        })}

        {/* ── Annotations (text notes) ───────────────────────────── */}
        {annotations.map((a) => {
          const isSelected = selectedAnnotationUid === a.uid;
          return (
            <div
              key={a.uid}
              className="absolute cursor-grab active:cursor-grabbing select-none"
              style={{
                left: a.x * ppi - 4,
                top: a.y * ppi - 4,
                zIndex: 25,
              }}
              onPointerDown={(e) => onAnnPointerDown(e, a)}
              onPointerMove={onAnnPointerMove}
              onPointerUp={onAnnPointerUp}
            >
              <div className={`relative whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm border ${
                isSelected
                  ? "bg-amber-100 border-amber-500 text-amber-900"
                  : "bg-white/90 border-amber-300 text-amber-800"
              }`}>
                {a.text}
                {isSelected && onDeleteAnnotation && (
                  <button
                    className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center shadow z-30"
                    onPointerDown={(e) => { e.stopPropagation(); onDeleteAnnotation(a.uid); }}
                    title="Delete"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

      </div>

      {hoverSnap && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#1a2744] text-white text-xs px-3 py-1 rounded-full shadow-lg z-30">
          {t("dt_pc_snapped")}
        </div>
      )}

      {catalogDragFit && (
        <div data-testid="catalog-drag-fit-status" role="status" aria-live="polite" className={`absolute top-3 left-1/2 z-40 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-full border px-3 py-1 text-center text-xs font-semibold shadow-lg ${catalogDragFit.status === "valid" ? "border-emerald-700 bg-emerald-700 text-white" : "border-rose-700 bg-rose-700 text-white"}`}>
	          {catalogDragFit.status === "valid"
	            ? catalogDragFreehand
	              ? `Shift freehand · exact position ${formatEighthInches(catalogDragFit.snapStart)}–${formatEighthInches(catalogDragFit.snapEnd)} · left ${formatEighthInches(catalogDragFit.before)} · right ${formatEighthInches(catalogDragFit.after)} · 0\" overlap required`
	              : `Valid ${catalogDragFit.gap.layer} opening · cabinet uses ${formatEighthInches(catalogDragFit.requiredSpan)} of ${formatEighthInches(catalogDragFit.availableSpan)} · snap ${formatEighthInches(catalogDragFit.snapStart)}–${formatEighthInches(catalogDragFit.snapEnd)} · left ${formatEighthInches(catalogDragFit.before)} · right ${formatEighthInches(catalogDragFit.after)} · hold Shift for freehand`
	            : !catalogDragFit.containsTarget
              ? `Move onto the highlighted opening · cabinet uses ${formatEighthInches(catalogDragFit.requiredSpan)} · nearest opening ${formatEighthInches(catalogDragFit.gap.start)}–${formatEighthInches(catalogDragFit.gap.start + catalogDragFit.gap.length)}`
              : `Too small · cabinet uses ${formatEighthInches(catalogDragFit.requiredSpan)} · opening ${formatEighthInches(catalogDragFit.availableSpan)} · short ${formatEighthInches(catalogDragFit.shortage)}`}
        </div>
      )}

      {measureMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#d4a75a] text-[#1a2744] text-xs font-semibold px-3 py-1 rounded-full shadow-lg z-30">
          {measurePoints.length === 0
            ? t("dt_pc_measure_first")
            : measurePoints.length === 1
            ? t("dt_pc_measure_second")
            : t("dt_pc_measure_done")}
        </div>
      )}

      {activeGap && gapFillCandidates && (() => {
        const recommendation = smartGapRecommendation(activeGap, gapFillCandidates);
        const close = () => setActiveGap(null);
        const candidateType = (cabinet: DesignCabinet): "base" | "sink" | "drawer" => {
          const text = `${cabinet.masterCode} ${cabinet.description} ${cabinet.subCategory ?? ""}`.toLowerCase();
          if (/sink|^sb/.test(text)) return "sink";
          if (/drawer|^db/.test(text)) return "drawer";
          return "base";
        };
        const availableSmartGapCandidates = smartGapCandidates.length > 0 ? smartGapCandidates : Array.from(gapFillCandidates.values());
        const layerCandidates = availableSmartGapCandidates.filter((cabinet) => {
          const dimensions = resolvedDesignCabinetDimensions(cabinet);
          const correctLayer = activeGap.layer === "wall" ? cabinet.placement === "wall" : cabinet.placement !== "wall";
          if (!correctLayer || dimensions.height <= 0) return false;
          const ceiling = room.ceilingHeight ?? 96;
          const mountedBottom = cabinet.placement === "wall" ? (dimensions.height < 30 ? Math.max(54, 84 - dimensions.height) : 54) : 0;
          return mountedBottom + dimensions.height <= ceiling + 0.01;
        });
        const approvedPriceFor = (cabinet: DesignCabinet) => smartGapCandidatePrices?.get(cabinet.id) ?? (cabinet as DesignCabinet & { approvedPrice?: number }).approvedPrice;
        const options = smartGapCatalogOptions(activeGap, layerCandidates)
          .filter((option) => activeGap.layer === "wall" || smartGapType === "all" || candidateType(option.cabinet) === smartGapType)
          .sort((a, b) => {
            if (smartGapOrder !== "price") return 0;
            const aPrice = approvedPriceFor(a.cabinet);
            const bPrice = approvedPriceFor(b.cabinet);
            const aSort = aPrice != null && aPrice > 0 ? aPrice : Number.POSITIVE_INFINITY;
            const bSort = bPrice != null && bPrice > 0 ? bPrice : Number.POSITIVE_INFINITY;
            return aSort - bSort || a.cabinet.masterCode.localeCompare(b.cabinet.masterCode);
          });
	        const best = bestFitCatalogOption(activeGap, layerCandidates);
	        const bestPrice = best ? approvedPriceFor(best.cabinet) : null;
	        const fillerSuggestion = recommendation?.kind === "filler"
	          ? catalogFillerSuggestion(catalogFillerCandidates, recommendation.remaining, activeGap.layer)
	          : null;
	        return <div data-testid="smart-gap-recommendation" className="absolute left-3 top-3 z-40 max-w-[calc(100%-1.5rem)] rounded-xl border border-[#d9c196] bg-[#fffaf1]/95 p-3 text-xs shadow-lg backdrop-blur">
	          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-semibold text-[#634b20]">Smart fit for {formatInches(activeGap.length)} open space</p><p className="mt-0.5 text-[#765416]">Suggestions use the active wall and available cabinets in your selected style.</p>
	            {best && <button type="button" data-testid="smart-gap-place-best" onClick={() => { if (best.needsFiller) onFillGapWithCabAndFiller?.(activeGap, best.cabinet); else onFillGap?.(activeGap, best.cabinet); close(); }} className="mt-2 w-full rounded-md bg-emerald-700 px-3 py-2 text-left font-bold text-white shadow-sm active:scale-[0.99]"><span className="block">Place best fit · {best.cabinet.masterCode}</span><span className="block text-[10px] font-medium text-emerald-50">Uses {formatInches(Number(best.cabinet.width))} of {formatInches(activeGap.length)} · {best.remaining <= 0.01 ? "exact fit" : best.needsFiller ? `${formatInches(best.remaining)} fitted filler` : `${formatInches(best.remaining)} remains open`} · {bestPrice != null && bestPrice > 0 ? `$${bestPrice.toFixed(2)}` : "Quote required"}</span></button>}
	            {recommendation?.kind === "filler" && <div className="mt-2 rounded-md border border-[#e7d7b7] bg-white p-2">{fillerSuggestion ? <><p data-testid="automatic-filler-size-suggestion" className="font-semibold text-[#49381a]">Recommended {fillerSuggestion.candidate.masterCode}: {formatInches(fillerSuggestion.catalogWidth)} catalog filler cut to {formatInches(fillerSuggestion.installedWidth)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Trim {formatInches(fillerSuggestion.trimAmount)} on site · installed width exactly fills the measured opening · catalog SKU and approved price stay unchanged.</p><div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => onPreviewGap?.(activeGap, null, true, [{ cabinet: null, needsFiller: true }], 0)} className="rounded-md border border-[#1a2744] bg-white px-2.5 py-1.5 font-semibold text-[#1a2744] active:scale-95">Preview in 3D</button>{onPlaceFiller && <button type="button" onClick={() => { onPlaceFiller(activeGap); close(); }} className="rounded-md bg-[#1a2744] px-2.5 py-1.5 font-semibold text-white active:scale-95">Add {fillerSuggestion.candidate.masterCode} · cut to {formatInches(fillerSuggestion.installedWidth)}</button>}</div></> : <p className="font-medium text-rose-700">No active catalog filler can cover this measured opening in the selected distributor and style.</p>}</div>}
	            {recommendation?.kind !== "filler" && <><div className="mt-2 flex flex-wrap gap-1" aria-label="Smart Gap cabinet type filters">{activeGap.layer === "base" && (["all", "base", "sink", "drawer"] as const).map((type) => <button key={type} type="button" onClick={() => setSmartGapType(type)} className={`rounded-full border px-2 py-1 font-semibold capitalize ${smartGapType === type ? "border-[#1a2744] bg-[#1a2744] text-white" : "border-[#d9c196] text-[#765416]"}`}>{type}</button>)}<button type="button" onClick={() => setSmartGapOrder((current) => current === "fit" ? "price" : "fit")} className="rounded-full border border-[#d9c196] px-2 py-1 font-semibold text-[#765416]">{smartGapOrder === "price" ? "Price ↑" : "Best fit"}</button></div><div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">{options.map((option, optionIndex) => { const unitPrice = approvedPriceFor(option.cabinet); const label = option.needsFiller ? `Add ${option.cabinet.masterCode} + fitted ${formatInches(option.remaining)} filler` : `Add ${option.cabinet.masterCode} · leaves ${formatInches(option.remaining)}`; const previewChoices = options.map((choice) => ({ cabinet: choice.cabinet, needsFiller: choice.needsFiller })); return <div key={option.cabinet.id} className="flex items-center gap-1 rounded-md border border-[#e7d7b7] bg-white p-1"><button type="button" onClick={() => onPreviewGap?.(activeGap, option.cabinet, option.needsFiller, previewChoices, optionIndex)} className="shrink-0 rounded px-1.5 py-1 text-[10px] font-semibold text-[#1a2744] underline underline-offset-2 active:scale-95">Preview</button><button type="button" onClick={() => { if (option.needsFiller) onFillGapWithCabAndFiller?.(activeGap, option.cabinet); else onFillGap?.(activeGap, option.cabinet); close(); }} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-0.5 text-left font-semibold text-[#49381a] active:scale-[0.99]"><span className="min-w-0 truncate">{label}</span><span className="shrink-0 text-[10px] text-muted-foreground">{unitPrice != null && unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "Quote required"}</span></button></div>; })}{options.length === 0 && <p className="rounded-md border border-dashed p-2 text-muted-foreground">No selected-style cabinet matches this filter.</p>}</div></>}
          </div><button type="button" onClick={close} aria-label="Close smart gap recommendation" className="text-base leading-none text-muted-foreground hover:text-foreground">×</button></div>
        </div>;
      })()}

      <div className="absolute bottom-12 right-3 text-[10px] text-muted-foreground bg-white/80 px-2 py-1 rounded">
        {(() => {
          return t("dt_pc_room_size", { w: formatDisplayDimension(room.width), h: formatDisplayDimension(room.depth) });
        })()}
      </div>
	      {!drawMode && (
	        <div data-testid="floor-plan-action-rail" className="absolute right-3 top-3 z-50 flex max-w-[calc(100%-1.5rem)] flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
	          <div className="flex shrink-0 flex-nowrap items-center gap-1">
	            <label
	              data-testid="floor-plan-measurement-opacity-control"
	              title="Dim visible Floor Plan measurement bubbles without hiding them"
	              className={`flex h-9 shrink-0 items-center gap-1 rounded-lg border px-1.5 text-[11px] font-bold shadow-md transition ${measurementBubblesVisible ? "border-[#1a2744]/30 bg-white/95 text-[#1a2744]" : "border-slate-200 bg-slate-50/95 text-slate-400"}`}
            >
              <span className="sr-only">Measurement bubble opacity</span>
              <input
                type="range"
                data-testid="floor-plan-measurement-opacity-slider"
                aria-label="Measurement bubble opacity"
                min={25}
                max={100}
                step={5}
                value={Math.round(measurementBubbleOpacity * 100)}
                disabled={!measurementBubblesVisible}
                onChange={(event) => setMeasurementBubbleOpacity(Math.max(0.25, Math.min(1, Number(event.target.value) / 100)))}
	                className="h-1.5 w-12 accent-[#1a2744] disabled:cursor-not-allowed"
	              />
	              <output data-testid="floor-plan-measurement-opacity-value" className="w-7 text-right tabular-nums" aria-live="polite">
                {Math.round(measurementBubbleOpacity * 100)}%
              </output>
            </label>
            <button
              type="button"
              data-testid="floor-plan-measurement-bubbles-toggle"
              aria-label={measurementBubblesVisible ? "Hide all Floor Plan measurement bubbles" : "Show all Floor Plan measurement bubbles"}
              aria-pressed={measurementBubblesVisible}
              title={measurementBubblesVisible ? "Hide all Floor Plan measurement bubbles for a cleaner drawing" : "Show all Floor Plan measurement bubbles"}
              onClick={() => setMeasurementBubblesVisible((visible) => !visible)}
	              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-0 text-[11px] font-bold shadow-md transition active:scale-[0.97] sm:w-auto sm:px-2 ${measurementBubblesVisible ? "border-[#1a2744]/30 bg-white/95 text-[#1a2744] hover:bg-[#f2f5f8]" : "border-[#d4a75a] bg-[#fff9ed] text-[#1a2744] hover:bg-[#fff4dc]"}`}
	            >
	              {measurementBubblesVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
	              <span className="hidden min-[360px]:inline">Measurements</span>
	            </button>
	          {onToggleWallLayer && (
	            <button
	              type="button"
	              data-testid="floor-plan-wall-layer-toggle"
	              aria-label={showWallLayer ? "Hide wall cabinets in this Floor Plan view" : "Show wall cabinets in this Floor Plan view"}
	              aria-pressed={showWallLayer}
	              title={showWallLayer ? "Hide wall cabinets in this Floor Plan view" : "Show wall cabinets in this Floor Plan view"}
	              onClick={onToggleWallLayer}
	              className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#1a2744]/30 bg-white/95 px-2 text-[11px] font-bold text-[#1a2744] shadow-md transition hover:bg-[#f2f5f8] active:scale-[0.97]"
	            >
	              <PanelTop className="h-4 w-4" />
	              <span className="max-[300px]:hidden sm:hidden">Walls</span>
	              <span className="hidden sm:inline">{showWallLayer ? "Hide wall cabinets" : "Show wall cabinets"}</span>
	            </button>
	          )}
	          {!measureMode && onRotateDrawing && (
            <button
              type="button"
              data-testid="rotate-custom-drawing"
              aria-label="Rotate the complete measured drawing 90 degrees clockwise"
              title="Rotate the complete drawing 90° clockwise while preserving every measured wall and cabinet position"
              onClick={onRotateDrawing}
              disabled={drawingRotationDisabled}
	              className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#d4a75a] bg-white/95 px-2 text-[11px] font-bold text-[#1a2744] shadow-md transition hover:bg-[#fff9ed] disabled:pointer-events-none disabled:opacity-50"
	            >
	              <RotateCw className="h-4 w-4" /> <span className="max-[300px]:hidden">Rotate</span>
            </button>
          )}
          </div>
        </div>
      )}
      {!drawMode && !measureMode && (
        <div data-testid="floor-plan-zoom-controls" className="absolute bottom-3 right-3 z-50 flex items-center overflow-hidden rounded-lg border border-[#1a2744]/25 bg-white/95 shadow-md backdrop-blur">
          <button
            type="button"
            data-testid="floor-plan-zoom-out"
            aria-label="Zoom out Floor Plan"
            title="Zoom out Floor Plan"
            disabled={floorPlanZoom <= FLOOR_PLAN_ZOOM_MIN}
            onClick={zoomOut}
            className="flex h-8 w-8 items-center justify-center border-r border-[#1a2744]/15 text-[#1a2744] transition hover:bg-[#f2f5f8] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span data-testid="floor-plan-zoom-value" className="min-w-12 px-2 text-center text-[11px] font-bold tabular-nums text-[#1a2744]" title="Mouse wheel zooms. Middle-mouse drag pans the view.">
            {Math.round(floorPlanZoom * 100)}%
          </span>
          <button
            type="button"
            data-testid="floor-plan-zoom-in"
            aria-label="Zoom in Floor Plan"
            title="Zoom in Floor Plan"
            disabled={floorPlanZoom >= FLOOR_PLAN_ZOOM_MAX}
            onClick={zoomIn}
            className="flex h-8 w-8 items-center justify-center border-l border-[#1a2744]/15 text-[#1a2744] transition hover:bg-[#f2f5f8] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="floor-plan-zoom-fit"
            aria-label="Fit Floor Plan to canvas"
            title="Fit Floor Plan to canvas"
            onClick={resetFloorPlanView}
            className="flex h-8 w-8 items-center justify-center border-l border-[#1a2744]/15 text-[#1a2744] transition hover:bg-[#f2f5f8] active:scale-95"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
