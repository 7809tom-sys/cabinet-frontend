import { STD, dim, isCornerCabinet, isFarmerSinkBase, isSinkBaseCabinet, wallRunFrame, type RoomData, type WallRunFrame } from "./design";
import { baseSubGroup, cabinetDrawingType, type CabinetLike } from "./cabinetGraphics";

export type FourAnchorSinkBaseKind = "regular" | "farmhouse";
export type FourAnchorKind = "sink" | "stove" | "dishwasher" | "refrigerator";
export type FourAnchorLayoutType = "galley" | "l-shape" | "u-shape" | "single-wall";
export type FourAnchorOriginCorner = "left" | "right";
export type FourAnchorRunDirection = "left" | "right";
export const FOUR_ANCHOR_WALL_LABELS = ["Wall 1", "Wall 2", "Wall 3", "Wall 4", "Wall 5", "Wall 6"] as const;
export type WallLabel = typeof FOUR_ANCHOR_WALL_LABELS[number];
export type DishwasherSide = "left" | "right";
export type RefrigeratorPanelChoice = "none" | "left" | "right" | "both";
export type RefrigeratorEnclosureChoice = "none" | "cabinet-above";
export type AnchorRunReservation = { start: number; end: number };

/** Minimal source-catalog data used to constrain generated straight wall runs. */
export type AutoBuildCatalogCandidate = CabinetLike & {
  masterCode: string;
  description?: string | null;
  subCategory?: string | null;
  placement: string;
  isCornerCabinet?: boolean | null;
};

export type FourAnchorMeasurement = {
  wallLabel: WallLabel;
  /** Distance in inches from the selected wall's labeled starting corner to the anchor center. */
  centerOffsetIn: number;
};

export type AutoBuildWallRef = {
  label: WallLabel;
  engineWallId: string;
  frame: WallRunFrame;
  /** Which physical endpoint is the user's measurement datum. */
  startCorner: "start" | "end";
};

/**
 * High-contrast, color-blind-considered markers used only while the Four-Anchor
 * dialog is open. These are a reading aid for the Floor Plan; no color or label
 * is saved into room geometry or passed to the placement engine.
 */
export const FOUR_ANCHOR_WALL_GUIDE_COLORS = ["#2563eb", "#c2410c", "#047857", "#7c3aed", "#b45309", "#be123c"] as const;
export type FourAnchorWallGuide = Pick<AutoBuildWallRef, "label" | "engineWallId" | "startCorner"> & {
  color: (typeof FOUR_ANCHOR_WALL_GUIDE_COLORS)[number];
};

/**
 * Blank, closed L-shaped room used only by the admin Four-Anchor training
 * action. It deliberately contains no cabinet, appliance, opening, material,
 * or user-plan data: staff can identify six real wall segments before entering
 * their own fixture measurements.
 */
export const FOUR_ANCHOR_SIX_WALL_TRAINING_ROOM: RoomData = {
  width: 180,
  depth: 180,
  ceilingHeight: 96,
  openWallPath: false,
  vertices: [
    { id: "four-anchor-training-a", x: 0, y: 0 },
    { id: "four-anchor-training-b", x: 120, y: 0 },
    { id: "four-anchor-training-c", x: 180, y: 60 },
    { id: "four-anchor-training-d", x: 180, y: 180 },
    { id: "four-anchor-training-e", x: 60, y: 180 },
    { id: "four-anchor-training-f", x: 0, y: 120 },
  ],
  customWalls: [
    { id: "four-anchor-training-wall-1", label: "Wall 1", startVertexId: "four-anchor-training-a", endVertexId: "four-anchor-training-b" },
    { id: "four-anchor-training-wall-2", label: "Wall 2", startVertexId: "four-anchor-training-b", endVertexId: "four-anchor-training-c", lockedAngle: 45 },
    { id: "four-anchor-training-wall-3", label: "Wall 3", startVertexId: "four-anchor-training-c", endVertexId: "four-anchor-training-d" },
    { id: "four-anchor-training-wall-4", label: "Wall 4", startVertexId: "four-anchor-training-d", endVertexId: "four-anchor-training-e" },
    { id: "four-anchor-training-wall-5", label: "Wall 5", startVertexId: "four-anchor-training-e", endVertexId: "four-anchor-training-f", lockedAngle: 45 },
    { id: "four-anchor-training-wall-6", label: "Wall 6", startVertexId: "four-anchor-training-f", endVertexId: "four-anchor-training-a" },
  ],
};

/** Returns a fresh room object so a training session cannot mutate the preset. */
export function makeFourAnchorSixWallTrainingRoom(): RoomData {
  return {
    ...FOUR_ANCHOR_SIX_WALL_TRAINING_ROOM,
    vertices: FOUR_ANCHOR_SIX_WALL_TRAINING_ROOM.vertices?.map((vertex) => ({ ...vertex })),
    customWalls: FOUR_ANCHOR_SIX_WALL_TRAINING_ROOM.customWalls?.map((wall) => ({ ...wall })),
  };
}

export type FourAnchorInputs = {
  layoutType: FourAnchorLayoutType;
  originCorner: FourAnchorOriginCorner;
  runDirection: FourAnchorRunDirection;
  /** Height selected for source-priced wall cabinets in the generated kitchen. */
  wallCabinetHeightIn?: 30 | 36 | 42;
  sink: FourAnchorMeasurement;
  /** Exact source-sized sink base requested by the admin (SB30/SB33/SB36/SB42). */
  sinkBaseWidthIn?: 30 | 33 | 36 | 42;
  /** Regular sink base unless the admin explicitly asks for a farmhouse (apron-front) base. */
  sinkBaseKind?: FourAnchorSinkBaseKind;
  /** Null means the admin explicitly chose not to add a range/stove. */
  stove: FourAnchorMeasurement | null;
  /** Optional exact dishwasher center. Null means seat it against the sink. */
  dishwasher?: FourAnchorMeasurement | null;
  /** True means do not add any dishwasher; false/undefined retains the sink-adjacent default. */
  skipDishwasher?: boolean;
  /** Used only when no exact dishwasher center is entered. */
  dishwasherSide?: DishwasherSide;
  /** Null means the admin explicitly chose not to add a refrigerator/bay. */
  refrigerator: FourAnchorMeasurement | null;
  refrigeratorWidthIn?: 30 | 33 | 36 | 42;
  refrigeratorPanels?: RefrigeratorPanelChoice;
  refrigeratorEnclosure?: RefrigeratorEnclosureChoice;
  sinkWindowCenter?: FourAnchorMeasurement | null;
};

export type FourAnchorPlacement = FourAnchorMeasurement & {
  kind: FourAnchorKind;
  source: "measured" | "adjacent-to-sink" | "sink-window-centered";
  dishwasherSide?: DishwasherSide;
};

export type FourAnchorBuildPlan = {
  layoutType: FourAnchorLayoutType;
  originCorner: FourAnchorOriginCorner;
  runDirection: FourAnchorRunDirection;
  anchors: FourAnchorPlacement[];
  surroundingRules: readonly ["fillers", "blind corners", "molding", "substitution"];
};

export type FourAnchorBuildResult =
  | { ok: true; plan: FourAnchorBuildPlan }
  | { ok: false; missing: FourAnchorKind[] };

const STANDARD_WALL_ORDER: Record<FourAnchorOriginCorner, Record<FourAnchorRunDirection, string[]>> = {
  left: {
    right: ["top", "right", "bottom", "left"],
    left: ["top", "left", "bottom", "right"],
  },
  right: {
    left: ["top", "left", "bottom", "right"],
    right: ["top", "right", "bottom", "left"],
  },
};

function orderedEngineWallIds(
  room: RoomData,
  originCorner: FourAnchorOriginCorner,
  runDirection: FourAnchorRunDirection,
): string[] {
  const customIds = room.customWalls?.map((wall) => wall.id) ?? [];
  if (customIds.length > 0) {
    const ids = customIds.slice(0, FOUR_ANCHOR_WALL_LABELS.length);
    return runDirection === "left" ? [...ids].reverse() : ids;
  }
  return STANDARD_WALL_ORDER[originCorner][runDirection];
}

/**
 * Resolves the UI-only Wall 1–6 label to the existing placement engine wall.
 * No placement coordinates are produced here; callers must use the returned
 * frame and wall id with wallPlacementAt().
 */
export function wallLabelToEngineWallId(
  label: WallLabel,
  room: RoomData,
  originCorner: FourAnchorOriginCorner,
  runDirection: FourAnchorRunDirection,
): AutoBuildWallRef | null {
  const index = Number(label.replace("Wall ", "")) - 1;
  if (index < 0 || index >= FOUR_ANCHOR_WALL_LABELS.length) return null;
  const engineWallId = orderedEngineWallIds(room, originCorner, runDirection)[index];
  if (!engineWallId) return null;
  const frame = wallRunFrame(engineWallId, room);
  if (!frame) return null;

  // The standard frame direction is physical start -> end. The label's datum
  // follows the selected traversal, so reverse traversal measures from frame.end.
  const startCorner = runDirection === "right" ? "start" : "end";
  return { label, engineWallId, frame, startCorner };
}

export function buildWallLabelMap(
  room: RoomData,
  originCorner: FourAnchorOriginCorner,
  runDirection: FourAnchorRunDirection,
): Record<WallLabel, AutoBuildWallRef | null> {
  return {
    "Wall 1": wallLabelToEngineWallId("Wall 1", room, originCorner, runDirection),
    "Wall 2": wallLabelToEngineWallId("Wall 2", room, originCorner, runDirection),
    "Wall 3": wallLabelToEngineWallId("Wall 3", room, originCorner, runDirection),
    "Wall 4": wallLabelToEngineWallId("Wall 4", room, originCorner, runDirection),
    "Wall 5": wallLabelToEngineWallId("Wall 5", room, originCorner, runDirection),
    "Wall 6": wallLabelToEngineWallId("Wall 6", room, originCorner, runDirection),
  };
}

/**
 * A visual-only projection of the exact label-to-engine-wall map. Keeping this
 * beside the map makes the visible Floor Plan markers follow the same selected
 * starting corner and traversal direction as every anchor measurement.
 */
export function buildFourAnchorWallGuides(
  room: RoomData,
  originCorner: FourAnchorOriginCorner,
  runDirection: FourAnchorRunDirection,
): FourAnchorWallGuide[] {
  return FOUR_ANCHOR_WALL_LABELS.flatMap((label, index) => {
    const wall = wallLabelToEngineWallId(label, room, originCorner, runDirection);
    if (!wall) return [];
    return [{
      label: wall.label,
      engineWallId: wall.engineWallId,
      startCorner: wall.startCorner,
      color: FOUR_ANCHOR_WALL_GUIDE_COLORS[index],
    }];
  });
}

/** Convert a center measurement to the placement engine's along-wall start. */
export function anchorAlongStartIn(measurement: FourAnchorMeasurement, cabinetWidthIn: number, wall: AutoBuildWallRef): number {
  const fromPhysicalStart = wall.startCorner === "start"
    ? measurement.centerOffsetIn
    : wall.frame.length - measurement.centerOffsetIn;
  return fromPhysicalStart - cabinetWidthIn / 2;
}

/**
 * Returns the wall-relative center for a dishwasher that butts the selected
 * side of a sink base. The caller still validates the resulting center against
 * the actual selected wall; this helper never clamps or relocates it.
 */
export function adjacentDishwasherCenterIn(
  sinkCenterIn: number,
  sinkWidthIn: number,
  dishwasherWidthIn: number,
  side: DishwasherSide,
): number {
  const offset = (sinkWidthIn + dishwasherWidthIn) / 2;
  return sinkCenterIn + (side === "right" ? offset : -offset);
}

/**
 * The Sink base selector means a straight SB box on the selected wall—not a
 * CSB/DCSB or any other corner sink SKU that happens to share its nominal width.
 */
export function isAutoBuildStraightSinkBaseCandidate(candidate: AutoBuildCatalogCandidate): boolean {
  return candidate.placement === "base"
    && candidate.isCornerCabinet !== true
    && !isCornerCabinet(candidate.masterCode, candidate.description ?? undefined)
    && isSinkBaseCabinet(candidate);
}

/**
 * The sink base a Four-anchor build seats. A kitchen defaults to the REGULAR
 * sink base: a plain SB of the requested width (two doors, top drawer front)
 * wins over a full-height SBxxFH, and the farmhouse apron-front base, vanity
 * sink bases and corner sink bases are never substituted for it. The farmhouse
 * base is built only when the admin explicitly asks for it. The result does not
 * depend on the order the catalog lists its rows; null means the line sells no
 * such base at that width, so the caller reports it instead of substituting.
 */
export function pickFourAnchorSinkBase<T extends AutoBuildCatalogCandidate & { width?: string | number | null }>(
  catalog: readonly T[],
  widthIn: number,
  kind: FourAnchorSinkBaseKind = "regular",
): T | null {
  const text = (row: T) => `${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`;
  const fits = catalog.filter((row) => isAutoBuildStraightSinkBaseCandidate(row)
    && Math.abs(dim(row.width as never, 0) - widthIn) < 0.1
    && !/vanity/i.test(text(row)) && !/^V/i.test(row.masterCode));
  if (kind === "farmhouse") return fits.find((row) => isFarmerSinkBase(row)) ?? null;
  const regular = fits.filter((row) => !isFarmerSinkBase(row));
  const rank = (row: T) => (/^(?:ADA-)?SB[-_ ]?\d+$/i.test(row.masterCode) ? 0 : 1);
  return [...regular].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Four-anchor surrounding fill is deliberately straight-run only. Corner boxes
 * belong to a physical room vertex and must be selected through the normal
 * corner workflow; an auto-build must never place or substitute one mid-run.
 */
export function autoBuildStraightBaseCatalog<T extends AutoBuildCatalogCandidate>(catalog: readonly T[]): T[] {
  return catalog.filter((candidate) => (
    candidate.placement === "base"
    && candidate.isCornerCabinet !== true
    && !isCornerCabinet(candidate.masterCode, candidate.description ?? undefined)
    && !isSinkBaseCabinet(candidate)
    // A standard door base may have a top drawer. All-drawer, full-height,
    // pull-out, appliance, vanity and other specialty boxes require an explicit
    // design choice and are never a substitute for an ordinary base run.
    && baseSubGroup(candidate) === "base"
    && cabinetDrawingType(candidate) === "standard-door"
  ));
}

/** Remove measured refrigerator openings/panel spans from otherwise free wall segments. */
export function subtractAnchorRunReservations(
  segments: ReadonlyArray<{ start: number; length: number }>,
  reservations: ReadonlyArray<AnchorRunReservation>,
): Array<{ start: number; length: number }> {
  const normalized = reservations
    .filter((reservation) => Number.isFinite(reservation.start) && Number.isFinite(reservation.end) && reservation.end > reservation.start)
    .sort((a, b) => a.start - b.start);
  const result: Array<{ start: number; length: number }> = [];
  for (const segment of segments) {
    const end = segment.start + segment.length;
    let cursor = segment.start;
    for (const reservation of normalized) {
      if (reservation.end <= cursor || reservation.start >= end) continue;
      const beforeEnd = Math.min(end, Math.max(cursor, reservation.start));
      if (beforeEnd > cursor) result.push({ start: cursor, length: beforeEnd - cursor });
      cursor = Math.max(cursor, Math.min(end, reservation.end));
      if (cursor >= end) break;
    }
    if (cursor < end) result.push({ start: cursor, length: end - cursor });
  }
  return result.filter((segment) => segment.length > 0.01);
}

/**
 * A straight base cabinet cannot occupy the inside depth of a room corner when
 * another auto-build anchor owns the adjoining wall. The builder leaves that
 * area open rather than silently choosing a corner SKU or creating a cabinet
 * body behind a sink, range, dishwasher, or refrigerator. A real corner box
 * remains a deliberate catalog selection through the normal placement engine.
 */
export function autoBuildSelectedWallCornerReservations(
  targetWallId: string,
  room: RoomData,
  selectedWallIds: readonly string[],
  depthIn = STD.BASE_DEPTH,
): AnchorRunReservation[] {
  const target = wallRunFrame(targetWallId, room);
  if (!target || depthIn <= 0 || !selectedWallIds.includes(targetWallId)) return [];
  const samePoint = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= 0.01;
  const reserved: AnchorRunReservation[] = [];
  for (const adjacentWallId of selectedWallIds) {
    if (adjacentWallId === targetWallId) continue;
    const adjacent = wallRunFrame(adjacentWallId, room);
    if (!adjacent) continue;
    if (samePoint(target.start, adjacent.start) || samePoint(target.start, adjacent.end)) {
      reserved.push({ start: target.runStart, end: Math.min(target.runEnd, target.runStart + depthIn) });
    }
    if (samePoint(target.end, adjacent.start) || samePoint(target.end, adjacent.end)) {
      reserved.push({ start: Math.max(target.runStart, target.runEnd - depthIn), end: target.runEnd });
    }
  }
  return reserved;
}

export function planFourAnchorAutoBuild(input: FourAnchorInputs): FourAnchorBuildResult {
  const missing: FourAnchorKind[] = [];
  if (!validMeasurement(input.sink)) missing.push("sink");
  const stove = validMeasurement(input.stove) ? input.stove : null;
  if (!stove && input.stove !== null && input.stove !== undefined) missing.push("stove");
  const refrigerator = validMeasurement(input.refrigerator) ? input.refrigerator : null;
  if (!refrigerator && input.refrigerator !== null && input.refrigerator !== undefined) missing.push("refrigerator");

  const dishwasher = validMeasurement(input.dishwasher) ? input.dishwasher : null;
  if (!input.skipDishwasher && !dishwasher && input.dishwasher !== null && input.dishwasher !== undefined) missing.push("dishwasher");
  if (missing.length) return { ok: false, missing };

  const sink = input.sinkWindowCenter && validMeasurement(input.sinkWindowCenter)
    ? { ...input.sinkWindowCenter, kind: "sink" as const, source: "sink-window-centered" as const }
    : { ...input.sink, kind: "sink" as const, source: "measured" as const };
  const dishwasherPlacement = input.skipDishwasher ? null : dishwasher
    ? { ...dishwasher, kind: "dishwasher" as const, source: "measured" as const }
    : {
      wallLabel: sink.wallLabel,
      centerOffsetIn: sink.centerOffsetIn,
      kind: "dishwasher" as const,
      source: "adjacent-to-sink" as const,
      dishwasherSide: input.dishwasherSide ?? "right",
    };

  return {
    ok: true,
    plan: {
      layoutType: input.layoutType,
      originCorner: input.originCorner,
      runDirection: input.runDirection,
      anchors: [
        sink,
        ...(stove ? [{ ...stove, kind: "stove" as const, source: "measured" as const }] : []),
        ...(dishwasherPlacement ? [dishwasherPlacement] : []),
        ...(refrigerator ? [{ ...refrigerator, kind: "refrigerator" as const, source: "measured" as const }] : []),
      ],
      surroundingRules: ["fillers", "blind corners", "molding", "substitution"],
    },
  };
}

export function canRunFourAnchorAutoBuild(isAdmin: boolean, hasHandPlacedItems: boolean): boolean {
  return isAdmin && !hasHandPlacedItems;
}

function validMeasurement(measurement: FourAnchorMeasurement | null | undefined): measurement is FourAnchorMeasurement {
  if (!measurement) return false;
  return FOUR_ANCHOR_WALL_LABELS.includes(measurement.wallLabel)
    && Number.isFinite(measurement.centerOffsetIn)
    && measurement.centerOffsetIn >= 0;
}
