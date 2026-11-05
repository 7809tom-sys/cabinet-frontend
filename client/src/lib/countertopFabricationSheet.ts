/**
 * Countertop fabrication data for the granite/quartz fabricator.
 *
 * Everything here is read from the live design: slab geometry comes from the
 * same surfaces the plan, elevation, 3D scene and cart use, so a run on this
 * sheet is a run the customer can actually see. The owner's rule applies
 * strictly — a field the design does not hold (slab thickness, seam layout,
 * backsplash height when none was chosen, an unselected material) stays blank
 * and is listed under `unknowns` instead of being filled with a shop default.
 */
import {
  COUNTERTOP_DEPTH_IN,
  STD,
  bearsCountertop,
  cabinetWall,
  countertopSurfacePlanPolygon,
  countertopSurfaces,
  edgeProfile,
  peninsulaRunById,
  peninsulaRunEndpoints,
  placedCornerGeometryKind,
  placedFootprint,
  type CountertopSurface,
  type IslandZone,
  type PlacedCabinet,
  type PonyWall,
  type RoomData,
  type SinkFixture,
  type SinkType,
  type WallSide,
} from "@/lib/design";
import { islandCountertopOverhangIn, islandCountertopRects, islandRotationDegrees } from "@/lib/islandScene";
import { activeCountertopForScope, isCountertopSurfacePick } from "@/lib/surfaceSelection";

const TOL = 1 / 16;
/** Edges this close to a room wall are treated as the wall side, never a profile. */
const WALL_TOLERANCE_IN = 0.5;

export type FabricationPoint = { x: number; y: number };

/** One edge of a slab outline, in the run's own frame (inches from front-left). */
export type FabricationEdge = {
  from: FabricationPoint;
  to: FabricationPoint;
  lengthIn: number;
  /** True when this edge is finished and receives the edge profile. */
  exposed: boolean;
  /** True when the edge sits against a room wall or another slab. */
  againstWallOrSeam: boolean;
};

/** Front/back/left/right summary. Only meaningful for a rectangular slab. */
export type FabricationEdgeSummary = {
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};

export type FabricationCutout = {
  kind: "sink" | "cooktop";
  /** Product name when the design carries one, otherwise a plain type label. */
  label: string;
  /** Opening size in the run's frame, or null when the design holds no size. */
  alongIn: number | null;
  acrossIn: number | null;
  /** Center measured along the run from its left start corner. */
  centerFromStartIn: number | null;
  /** Center measured from the finished front edge. */
  centerFromFrontIn: number | null;
  /** Where the sizes came from, so the shop knows what is measured vs. placed. */
  sizeSource: "product-outside-dims" | "design-footprint";
  notes: string[];
};

export type FabricationRun = {
  id: string;
  /** "Back wall", "Peninsula · 90° right", "Island", … */
  label: string;
  kind: "wall" | "measured-wall" | "peninsula" | "island" | "raised-bar" | "corner-piece" | "freestanding";
  /** Overall length across the run, measured from the slab outline. */
  lengthIn: number;
  /** Overall depth across the run, measured from the slab outline. */
  depthIn: number;
  /** True when the design stores an L/angled outline instead of a plain rectangle. */
  hasPolygon: boolean;
  /** Slab outline in the run's own frame, starting at the front-left corner. */
  outline: FabricationPoint[];
  /** Every outline edge, with the finished edges marked. */
  edges: FabricationEdge[];
  /** Front/back/left/right view of the edges; null for a non-rectangular slab. */
  edgeSummary: FabricationEdgeSummary | null;
  /** Finished edge length the fabricator profiles on this piece. */
  finishedEdgeLengthIn: number;
  /** Finished height of this top, only when the design stores it. */
  topHeightIn: number | null;
  cutouts: FabricationCutout[];
  /** Corner/cabinet support facts the shop needs, taken from placed cabinets. */
  supportNotes: string[];
  areaSqFt: number;
};

export type FabricationCorner = {
  /** "Inside 90° corner", "45° mitered joint", "Corner cabinet · l-shape", … */
  kind: string;
  /** Runs that meet here, by label. Empty for a cabinet-only entry. */
  runs: string[];
  /** Measured length of each participating run when known. */
  legsIn: (number | null)[];
  notes: string[];
};

export type FabricationMaterial = {
  /** Real product name when a countertop product was chosen. */
  name: string | null;
  code: string | null;
  size: string | null;
  scope: "perimeter" | "island";
};

export type FabricationJob = {
  designId: number | null;
  designName: string | null;
  projectName: string | null;
  roomLabel: string | null;
  roomType: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  generatedAt: string;
};

export type CountertopFabricationSheet = {
  job: FabricationJob;
  room: { widthIn: number; depthIn: number };
  materials: FabricationMaterial[];
  /** The Designer's stored edge profile, or null when the design has none. */
  edgeProfile: { id: string; name: string } | null;
  /** The finished front overhang the design's wall runs use, from its base depth. */
  frontOverhangIn: number;
  /** Backsplash the design actually specifies; null when it was not set. */
  backsplash: { heightIn: number | null; fullHeight: boolean } | null;
  runs: FabricationRun[];
  corners: FabricationCorner[];
  /** Sink/cooktop openings the design holds but that could not be tied to a slab. */
  unmatchedCutouts: FabricationCutout[];
  totals: { linearFeet: number; squareFeet: number; runCount: number; cutoutCount: number };
  /** Fields a fabricator needs that this design does not carry. Never estimated. */
  unknowns: string[];
  /** True when nothing countertop-bearing exists yet. */
  empty: boolean;
};

export type FabricationSurfacePick = {
  id?: number;
  name: string;
  category?: string | null;
  subCategory?: string | null;
  pelicanCode?: string | null;
  size?: string | null;
  countertopScope?: "perimeter" | "island" | "all";
};

export type CountertopFabricationInput = {
  room: RoomData;
  placed: PlacedCabinet[];
  island?: IslandZone | null;
  sinks?: SinkFixture[];
  ponyWalls?: PonyWall[];
  selectedSurfaces?: FabricationSurfacePick[];
  /** Designer edge profile id; null/undefined means the design stores no profile. */
  edgeProfileId?: string | null;
  /** Stored backsplash choice, only when the design really carries one. */
  backsplash?: { heightIn?: number | null; fullHeight?: boolean | null } | null;
  job?: Partial<Omit<FabricationJob, "generatedAt">> | null;
  /** Fixed timestamp for reproducible tests and artifacts. */
  now?: Date;
};

// ── small geometry helpers ──────────────────────────────────────────────────

const unit = (x: number, y: number): FabricationPoint => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

const finite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const text = (value: unknown): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
};

function polygonArea(points: readonly FabricationPoint[]): number {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function pointInPolygon(point: FabricationPoint, polygon: readonly FabricationPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;
    if ((yi > point.y) !== (yj > point.y)
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The unit vector the finished front edge faces, i.e. out of the slab toward
 * the room. Read from the record that owns the slab so the drawing is never
 * mirrored: the peninsula's cabinet side, the measured wall, the island, or the
 * cardinal wall the slab sits on.
 */
function frontNormalFor(
  surface: CountertopSurface,
  room: RoomData,
  island: IslandZone | null | undefined,
): FabricationPoint {
  const peninsulaId = surface.peninsulaRunId ?? surface.peninsulaRunIds?.[0];
  if (peninsulaId) {
    const run = peninsulaRunById(room, peninsulaId);
    if (run) {
      const geometry = peninsulaRunEndpoints(run, room);
      const leftNormal = { x: -Math.sin(geometry.radians), y: Math.cos(geometry.radians) };
      return run.cabinetSide === "right"
        ? { x: -leftNormal.x, y: -leftNormal.y }
        : leftNormal;
    }
  }
  if (surface.customWallId) {
    const wall = room.customWalls?.find((candidate) => candidate.id === surface.customWallId);
    const start = room.vertices?.find((vertex) => vertex.id === wall?.startVertexId);
    const end = room.vertices?.find((vertex) => vertex.id === wall?.endVertexId);
    if (start && end) {
      const direction = unit(end.x - start.x, end.y - start.y);
      const normal = { x: direction.y, y: -direction.x };
      const centre = { x: surface.x + surface.width / 2, y: surface.y + surface.depth / 2 };
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return (centre.x - midpoint.x) * normal.x + (centre.y - midpoint.y) * normal.y >= 0
        ? normal
        : { x: -normal.x, y: -normal.y };
    }
  }
  if (surface.kind === "island" && island) {
    const radians = islandRotationDegrees(island) * Math.PI / 180;
    return { x: -Math.sin(radians), y: Math.cos(radians) };
  }
  const side = cardinalSideFor(surface, room);
  if (side === "top") return { x: 0, y: 1 };
  if (side === "bottom") return { x: 0, y: -1 };
  if (side === "left") return { x: 1, y: 0 };
  if (side === "right") return { x: -1, y: 0 };
  return { x: 0, y: 1 };
}

function cardinalSideFor(surface: CountertopSurface, room: RoomData): WallSide | null {
  if (surface.supportWallId) return surface.supportWallId;
  if (Math.abs(surface.y) <= TOL) return "top";
  if (Math.abs(surface.y + surface.depth - room.depth) <= TOL) return "bottom";
  if (Math.abs(surface.x) <= TOL) return "left";
  if (Math.abs(surface.x + surface.width - room.width) <= TOL) return "right";
  return null;
}

type Measurement = {
  lengthIn: number;
  depthIn: number;
  /** Outline in the run's own frame: y = 0 on the finished front edge. */
  outline: FabricationPoint[];
  /** Same outline in world inches, in the same vertex order. */
  world: FabricationPoint[];
  hasPolygon: boolean;
  /** The run's own axes, so any world point can be reported in the run frame. */
  basis: { along: FabricationPoint; frontNormal: FabricationPoint; minAlong: number; maxAcross: number };
};

/**
 * Express a world point in a measured run's frame: inches along the run from
 * its left end, and inches back from the finished front edge.
 */
function toRunFrame(measurement: Measurement, point: FabricationPoint): FabricationPoint {
  const { basis } = measurement;
  return {
    x: point.x * basis.along.x + point.y * basis.along.y - basis.minAlong,
    y: basis.maxAcross - (point.x * basis.frontNormal.x + point.y * basis.frontNormal.y),
  };
}

/**
 * Project the slab outline onto the run's own axes. The along axis follows the
 * front edge; the across axis runs from that front edge back to the wall, so
 * every measured point is "x inches from the left end, y inches back from the
 * front". A rectangular and an L-shaped slab therefore use one measurement path.
 */
function measureSurface(
  surface: CountertopSurface,
  room: RoomData,
  island: IslandZone | null | undefined,
): Measurement | null {
  const world = countertopSurfacePlanPolygon(surface);
  if (world.length < 3) return null;
  const frontNormal = frontNormalFor(surface, room, island);
  // Along the front edge: perpendicular to the front normal, with a
  // deterministic sign so "left" and "right" never swap between renders.
  let along = { x: frontNormal.y, y: -frontNormal.x };
  if (Math.abs(along.x) >= Math.abs(along.y) ? along.x < 0 : along.y < 0) {
    along = { x: -along.x, y: -along.y };
  }
  const projected = world.map((point) => ({
    along: point.x * along.x + point.y * along.y,
    across: point.x * frontNormal.x + point.y * frontNormal.y,
  }));
  const minAlong = Math.min(...projected.map((point) => point.along));
  const maxAcross = Math.max(...projected.map((point) => point.across));
  const lengthIn = Math.max(...projected.map((point) => point.along)) - minAlong;
  const depthIn = maxAcross - Math.min(...projected.map((point) => point.across));
  if (!(lengthIn > TOL) || !(depthIn > TOL)) return null;

  const order = outlineOrder(projected.map((point) => ({
    x: point.along - minAlong,
    y: maxAcross - point.across,
  })));
  return {
    lengthIn,
    depthIn,
    outline: order.map((index) => ({
      x: projected[index]!.along - minAlong,
      y: maxAcross - projected[index]!.across,
    })),
    world: order.map((index) => world[index]!),
    hasPolygon: Boolean(surface.polygon?.length && surface.polygon.length > 4),
    basis: { along, frontNormal, minAlong, maxAcross },
  };
}

/**
 * Start the outline at its front-left vertex and walk left-to-right along the
 * front edge, so every consumer reads the same vertex order and the drawn
 * polygon is never mirrored or rotated relative to the dimensions. Returns the
 * source indices so the world outline stays index-aligned.
 */
function outlineOrder(points: readonly FabricationPoint[]): number[] {
  if (points.length < 3) return points.map((_, index) => index);
  const frontLeft = points.reduce((best, point, index) => {
    const candidate = points[best]!;
    if (point.y < candidate.y - TOL) return index;
    if (Math.abs(point.y - candidate.y) <= TOL && point.x < candidate.x) return index;
    return best;
  }, 0);
  const forward = points[(frontLeft + 1) % points.length]!;
  const backward = points[(frontLeft - 1 + points.length) % points.length]!;
  // The front edge continues toward larger x. If the next vertex does not, walk
  // the other way round so the front edge is the first reported edge.
  const goesForward = Math.abs(forward.y - backward.y) <= TOL
    ? forward.x > backward.x
    : forward.y < backward.y;
  const order: number[] = [];
  for (let step = 0; step < points.length; step += 1) {
    const index = goesForward
      ? (frontLeft + step) % points.length
      : (frontLeft - step + points.length) % points.length;
    order.push(index);
  }
  return order;
}

/** True when a world point lies on a room wall or a measured custom wall. */
function onRoomBoundary(point: FabricationPoint, room: RoomData): boolean {
  if (Math.abs(point.x) <= WALL_TOLERANCE_IN || Math.abs(point.x - room.width) <= WALL_TOLERANCE_IN) return true;
  if (Math.abs(point.y) <= WALL_TOLERANCE_IN || Math.abs(point.y - room.depth) <= WALL_TOLERANCE_IN) return true;
  for (const wall of room.customWalls ?? []) {
    const start = room.vertices?.find((vertex) => vertex.id === wall.startVertexId);
    const end = room.vertices?.find((vertex) => vertex.id === wall.endVertexId);
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const distance = Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / length;
    const along = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length);
    if (distance <= WALL_TOLERANCE_IN && along >= -0.01 && along <= 1.01) return true;
  }
  return false;
}

/**
 * True when another slab covers this edge on the side it actually faces. A slab
 * that merely abuts from behind (a run continuing on the far side of the seam)
 * does not cover the finished edge, so the probe only tests the outward side.
 */
function coveredBySibling(
  from: FabricationPoint,
  to: FabricationPoint,
  own: readonly FabricationPoint[],
  siblings: readonly FabricationPoint[][],
): boolean {
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const direction = unit(to.x - from.x, to.y - from.y);
  const candidates = [
    { x: midpoint.x + direction.y * 0.25, y: midpoint.y - direction.x * 0.25 },
    { x: midpoint.x - direction.y * 0.25, y: midpoint.y + direction.x * 0.25 },
  ];
  // The outward side is the probe that lies outside the slab that owns the edge.
  const outward = candidates.filter((probe) => !pointInPolygon(probe, own));
  const probes = outward.length > 0 ? outward : candidates;
  return siblings.some((polygon) => probes.some((probe) => pointInPolygon(probe, polygon)));
}

function measureEdges(
  measurement: Measurement,
  siblings: readonly Measurement[],
  room: RoomData,
): FabricationEdge[] {
  const { outline, world } = measurement;
  const siblingWorlds = siblings.map((sibling) => sibling.world);
  return outline.map((from, index) => {
    const to = outline[(index + 1) % outline.length]!;
    const worldFrom = world[index]!;
    const worldTo = world[(index + 1) % world.length]!;
    const mid = { x: (worldFrom.x + worldTo.x) / 2, y: (worldFrom.y + worldTo.y) / 2 };
    const onWall = onRoomBoundary(mid, room);
    const seam = !onWall && coveredBySibling(worldFrom, worldTo, world, siblingWorlds);
    return {
      from: { x: round(from.x, 3), y: round(from.y, 3) },
      to: { x: round(to.x, 3), y: round(to.y, 3) },
      lengthIn: round(Math.hypot(to.x - from.x, to.y - from.y)),
      exposed: !onWall && !seam,
      againstWallOrSeam: onWall || seam,
    };
  });
}

/** Front/back/left/right view, only when the slab really is an axis-aligned rectangle. */
function summarizeEdges(measurement: Measurement, edges: readonly FabricationEdge[]): FabricationEdgeSummary | null {
  if (measurement.outline.length !== 4 || measurement.hasPolygon) return null;
  const isRectangular = measurement.outline.every((point) =>
    (Math.abs(point.x) <= TOL || Math.abs(point.x - measurement.lengthIn) <= TOL)
    && (Math.abs(point.y) <= TOL || Math.abs(point.y - measurement.depthIn) <= TOL));
  if (!isRectangular) return null;
  const front = edges.find((edge) => Math.abs(edge.from.y) <= TOL && Math.abs(edge.to.y) <= TOL);
  const back = edges.find((edge) =>
    Math.abs(edge.from.y - measurement.depthIn) <= TOL && Math.abs(edge.to.y - measurement.depthIn) <= TOL);
  const left = edges.find((edge) => Math.abs(edge.from.x) <= TOL && Math.abs(edge.to.x) <= TOL);
  const right = edges.find((edge) =>
    Math.abs(edge.from.x - measurement.lengthIn) <= TOL && Math.abs(edge.to.x - measurement.lengthIn) <= TOL);
  return {
    front: front?.exposed ?? false,
    back: back?.exposed ?? false,
    left: left?.exposed ?? false,
    right: right?.exposed ?? false,
  };
}

function wallLabelFor(side: WallSide): string {
  return side === "top" ? "Back wall" : side === "bottom" ? "Front wall" : side === "left" ? "Left wall" : "Right wall";
}

function runLabel(surface: CountertopSurface, room: RoomData): { label: string; kind: FabricationRun["kind"] } {
  const peninsulaId = surface.peninsulaRunId ?? surface.peninsulaRunIds?.[0];
  if (peninsulaId) {
    const run = peninsulaRunById(room, peninsulaId);
    const base = text(run?.label) ?? `Peninsula · ${run?.turn ?? 90}° ${run?.direction ?? ""}`.trim();
    return surface.raisedBar
      ? { label: `${base} · raised bar`, kind: "raised-bar" }
      : { label: base, kind: "peninsula" };
  }
  if (surface.raisedBar) return { label: "Raised bar", kind: "raised-bar" };
  if (surface.customWallId) {
    const wall = room.customWalls?.find((candidate) => candidate.id === surface.customWallId);
    return { label: text(wall?.label) ?? "Measured wall", kind: "measured-wall" };
  }
  if (surface.kind === "island") return { label: "Island", kind: "island" };
  if (surface.polygon?.length) {
    // An L/diagonal corner piece is its own shaped slab, not a straight run.
    return { label: "Corner piece", kind: "corner-piece" };
  }
  if (surface.supportWallId) return { label: wallLabelFor(surface.supportWallId), kind: "wall" };
  return { label: "Freestanding run", kind: "freestanding" };
}

function sinkLabel(sink: SinkFixture): string {
  const product = text(sink.pelicanProductName);
  if (product) return product;
  const labels: Record<SinkType, string> = {
    single: "Single-bowl sink",
    double: "Double-bowl sink",
    farmhouse: "Farmhouse (apron-front) sink",
    bar: "Bar sink",
  };
  return labels[sink.type] ?? "Sink";
}

type RawCutout = {
  kind: "sink" | "cooktop";
  label: string;
  centre: FabricationPoint;
  alongSize: number | null;
  acrossSize: number | null;
  sizeSource: FabricationCutout["sizeSource"];
  /** Plan rotation of the fixture or cabinet that owns the opening. */
  rotationDeg: number;
  notes: string[];
};

/**
 * Openings the design actually holds: sinks seated on the counter and
 * countertop-opening appliances (cooktops). A size is reported only when the
 * record carries it; nothing is inferred from a product photo.
 */
function rawCutouts(placed: readonly PlacedCabinet[], sinks: readonly SinkFixture[]): RawCutout[] {
  const out: RawCutout[] = [];
  for (const sink of sinks) {
    const physicalWidth = finite(sink.sourceWidth) ?? finite(sink.width);
    const physicalDepth = finite(sink.sourceDepth) ?? finite(sink.depth);
    const planWidth = finite(sink.width) ?? physicalWidth ?? 0;
    const planDepth = finite(sink.depth) ?? physicalDepth ?? 0;
    const notes: string[] = [];
    if (sink.apronFront) notes.push("Apron-front sink: the top is notched around the exposed front.");
    if (sink.bowlCount === 2) notes.push("Two-bowl fixture.");
    if (sink.faucetDeckConflict === "shallow-countertop-deck") {
      notes.push("Designer flagged no usable rear deck for a deck-mounted faucet.");
    }
    if (sink.bowlWidth != null || sink.bowlDepth != null) {
      const bowls = [sink.bowlWidth, sink.bowlDepth].filter((value) => value != null);
      if (bowls.length === 2) notes.push(`Bowl cutout ${sink.bowlWidth}" x ${sink.bowlDepth}".`);
    }
    out.push({
      kind: "sink",
      label: sinkLabel(sink),
      centre: { x: (finite(sink.x) ?? 0) + planWidth / 2, y: (finite(sink.y) ?? 0) + planDepth / 2 },
      alongSize: physicalWidth,
      acrossSize: physicalDepth,
      sizeSource: finite(sink.sourceWidth) != null || finite(sink.sourceDepth) != null
        ? "product-outside-dims"
        : "design-footprint",
      rotationDeg: finite(sink.planRotation) ?? 0,
      notes,
    });
  }
  for (const cabinet of placed) {
    if (cabinet.placement !== "appliance" || cabinet.applianceRole !== "countertop-opening") continue;
    const footprint = placedFootprint(cabinet);
    out.push({
      kind: "cooktop",
      label: text(cabinet.applianceCatalogName) ?? text(cabinet.description) ?? "Cooktop",
      centre: { x: (finite(cabinet.x) ?? 0) + footprint.w / 2, y: (finite(cabinet.y) ?? 0) + footprint.d / 2 },
      alongSize: finite(cabinet.width),
      acrossSize: finite(cabinet.depth),
      sizeSource: "design-footprint",
      rotationDeg: finite(cabinet.rotation) ?? 0,
      notes: ["Cutout appliance seated in this slab."],
    });
  }
  return out;
}

/** Rotate an opening's own long/short side into the run's frame. */
function sizeInFrame(
  raw: RawCutout,
  along: FabricationPoint,
): { alongIn: number | null; acrossIn: number | null } {
  if (raw.alongSize == null || raw.acrossSize == null) return { alongIn: null, acrossIn: null };
  // The fixture's own width runs along its plan rotation; compare that to the
  // run's along axis to decide whether the two sides swap.
  const runAngle = (Math.atan2(along.y, along.x) * 180) / Math.PI;
  const relative = ((raw.rotationDeg - runAngle) % 180 + 180) % 180;
  const swapped = Math.abs(relative - 90) < 45;
  return swapped
    ? { alongIn: raw.acrossSize, acrossIn: raw.alongSize }
    : { alongIn: raw.alongSize, acrossIn: raw.acrossSize };
}

function cornerSupportNotes(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  surface: CountertopSurface,
): string[] {
  const ownerWall = surface.customWallId ?? surface.supportWallId ?? null;
  if (!ownerWall) return [];
  return placed
    .filter((cabinet) => bearsCountertop(cabinet) && placedCornerGeometryKind(cabinet) !== "standard")
    .filter((cabinet) => {
      try {
        return cabinetWall(cabinet, room) === ownerWall;
      } catch {
        return false;
      }
    })
    .map((cabinet) => `${cabinet.masterCode || "Corner cabinet"} · ${placedCornerGeometryKind(cabinet)}`);
}

function isCountertopPick(surface: FabricationSurfacePick): boolean {
  return isCountertopSurfacePick({
    category: surface.category ?? "",
    subCategory: surface.subCategory ?? null,
    name: surface.name,
  });
}

function materialFor(
  surfaces: readonly FabricationSurfacePick[] | undefined,
  scope: "perimeter" | "island",
): FabricationMaterial {
  const picks = (surfaces ?? []).filter(isCountertopPick);
  const chosen: FabricationSurfacePick | null = picks.length > 0
    ? activeCountertopForScope(picks.map((pick) => ({ ...pick, category: pick.category ?? "", name: pick.name, id: pick.id ?? 0 })), scope)
    : null;
  return {
    name: text(chosen?.name),
    code: text(chosen?.pelicanCode),
    size: text(chosen?.size),
    scope,
  };
}

// ── the sheet ───────────────────────────────────────────────────────────────

export function buildCountertopFabricationSheet(input: CountertopFabricationInput): CountertopFabricationSheet {
  const room = input.room;
  const placed = input.placed ?? [];
  const island = input.island ?? null;
  const sinks = input.sinks ?? [];
  const job: FabricationJob = {
    designId: finite(input.job?.designId),
    designName: text(input.job?.designName),
    projectName: text(input.job?.projectName),
    roomLabel: text(input.job?.roomLabel),
    roomType: text(input.job?.roomType),
    customerName: text(input.job?.customerName),
    customerEmail: text(input.job?.customerEmail),
    customerPhone: text(input.job?.customerPhone),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };

  const perimeterSurfaces = countertopSurfaces(placed, room, island, input.ponyWalls ?? [])
    .filter((surface) => surface.kind !== "island" && surface.width > TOL && surface.depth > TOL);
  const islandSurfaces: CountertopSurface[] = island
    ? islandCountertopRects(island, placed)
      .filter((rect) => rect.width > TOL && rect.depth > TOL)
      .map((rect) => ({ ...rect, kind: "island" as const }))
    : [];

  type Piece = {
    surface: CountertopSurface;
    label: string;
    kind: FabricationRun["kind"];
    measurement: Measurement;
    frontNormal: FabricationPoint;
    id: string;
  };
  const pieces: Piece[] = [];
  const addPiece = (surface: CountertopSurface, baseLabel: string, kind: FabricationRun["kind"], id: string) => {
    const measurement = measureSurface(surface, room, island);
    if (!measurement) return;
    // Two pieces on the same wall are named so the fabricator can tell them
    // apart instead of seeing the same wall twice.
    const sameLabel = pieces.filter((piece) => piece.label === baseLabel || piece.label.startsWith(`${baseLabel} (`)).length;
    const label = sameLabel === 0 ? baseLabel : `${baseLabel} (${sameLabel + 1})`;
    pieces.push({ surface, label, kind, measurement, frontNormal: frontNormalFor(surface, room, island), id });
  };
  perimeterSurfaces.forEach((surface, index) => {
    const { label, kind } = runLabel(surface, room);
    addPiece(surface, label, kind, `run-${index + 1}`);
  });
  islandSurfaces.forEach((surface, index) => {
    addPiece(
      surface,
      islandSurfaces.length > 1 ? `Island slab ${index + 1}` : "Island",
      "island",
      `island-${index + 1}`,
    );
  });

  const raw = rawCutouts(placed, sinks);
  const matched = new Set<RawCutout>();

  const runs: FabricationRun[] = pieces.map((piece, index) => {
    const siblings = pieces.filter((_, otherIndex) => otherIndex !== index).map((other) => other.measurement);
    const edges = measureEdges(piece.measurement, siblings, room);
    // Openings belong to the piece whose outline contains their center.
    const cutouts: FabricationCutout[] = [];
    for (const candidate of raw) {
      if (matched.has(candidate) || !pointInPolygon(candidate.centre, piece.measurement.world)) continue;
      const local = toRunFrame(piece.measurement, candidate.centre);
      const sizes = sizeInFrame(candidate, piece.measurement.basis.along);
      cutouts.push({
        kind: candidate.kind,
        label: candidate.label,
        alongIn: sizes.alongIn == null ? null : round(sizes.alongIn),
        acrossIn: sizes.acrossIn == null ? null : round(sizes.acrossIn),
        centerFromStartIn: round(local.x),
        centerFromFrontIn: round(local.y),
        sizeSource: candidate.sizeSource,
        notes: candidate.notes,
      });
      matched.add(candidate);
    }
    return {
      id: piece.id,
      label: piece.label,
      kind: piece.kind,
      lengthIn: round(piece.measurement.lengthIn),
      depthIn: round(piece.measurement.depthIn),
      hasPolygon: piece.measurement.hasPolygon,
      outline: piece.measurement.outline.map((point) => ({ x: round(point.x, 3), y: round(point.y, 3) })),
      edges,
      edgeSummary: summarizeEdges(piece.measurement, edges),
      finishedEdgeLengthIn: round(edges.filter((edge) => edge.exposed).reduce((sum, edge) => sum + edge.lengthIn, 0)),
      topHeightIn: finite(piece.surface.countertopHeightIn),
      cutouts,
      supportNotes: [
        ...cornerSupportNotes(placed, room, piece.surface),
        ...(piece.surface.raisedBar
          ? [`Separate raised bar${piece.surface.countertopHeightIn != null ? ` at ${round(piece.surface.countertopHeightIn)}" finished height` : ""}.`]
          : []),
      ],
      areaSqFt: round(polygonArea(piece.measurement.world) / 144, 1),
    };
  });

  const unmatchedCutouts: FabricationCutout[] = raw
    .filter((candidate) => !matched.has(candidate))
    .map((candidate) => ({
      kind: candidate.kind,
      label: candidate.label,
      alongIn: candidate.alongSize == null ? null : round(candidate.alongSize),
      acrossIn: candidate.acrossSize == null ? null : round(candidate.acrossSize),
      centerFromStartIn: null,
      centerFromFrontIn: null,
      sizeSource: candidate.sizeSource,
      notes: [...candidate.notes, "Not inside a slab this design draws, so no cutout position can be given."],
    }));

  const corners = buildCorners(pieces, room, placed);
  const linearInches = runs.reduce((sum, run) => sum + run.lengthIn, 0);
  const squareInches = runs.reduce((sum, run) => sum + run.areaSqFt * 144, 0);

  return {
    job,
    room: { widthIn: round(room.width), depthIn: round(room.depth) },
    materials: [materialFor(input.selectedSurfaces, "perimeter"), materialFor(input.selectedSurfaces, "island")],
    edgeProfile: text(input.edgeProfileId)
      ? { id: input.edgeProfileId!, name: edgeProfile(input.edgeProfileId).name }
      : null,
    frontOverhangIn: round(COUNTERTOP_DEPTH_IN - STD.BASE_DEPTH),
    backsplash: input.backsplash && (finite(input.backsplash.heightIn) != null || input.backsplash.fullHeight)
      ? { heightIn: finite(input.backsplash.heightIn), fullHeight: Boolean(input.backsplash.fullHeight) }
      : null,
    runs,
    corners,
    unmatchedCutouts,
    totals: {
      linearFeet: round(linearInches / 12, 1),
      squareFeet: round(squareInches / 144, 1),
      runCount: runs.length,
      cutoutCount: runs.reduce((sum, run) => sum + run.cutouts.length, 0) + unmatchedCutouts.length,
    },
    unknowns: describeUnknowns(input, runs),
    empty: runs.length === 0,
  };
}

type SheetPiece = {
  surface: CountertopSurface;
  label: string;
  kind: FabricationRun["kind"];
  measurement: Measurement;
  frontNormal: FabricationPoint;
  id: string;
};

function buildCorners(
  pieces: readonly SheetPiece[],
  room: RoomData,
  placed: readonly PlacedCabinet[],
): FabricationCorner[] {
  const corners: FabricationCorner[] = [];

  // 45° mitered joints the design already models as one shared seam.
  pieces.forEach((piece, index) => {
    const surface = piece.surface;
    if (!surface.miteredStart && !surface.miteredEnd && !surface.customWallMiterWallIds?.length) return;
    const partnerWallIds: string[] = surface.customWallMiterWallIds ?? [];
    const partners = pieces
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidateIndex }) => candidateIndex !== index)
      .filter(({ candidate }) => partnerWallIds.length > 0
        ? Boolean(candidate.surface.customWallId && partnerWallIds.includes(candidate.surface.customWallId ?? ""))
        : piece.measurement.world.some((own) =>
          candidate.measurement.world.some((corner) => Math.hypot(corner.x - own.x, corner.y - own.y) <= WALL_TOLERANCE_IN)));
    if (partners.length === 0) return;
    corners.push({
      kind: "45° mitered joint",
      runs: [piece.label, ...partners.map(({ candidate }) => candidate.label)],
      legsIn: [round(piece.measurement.lengthIn), ...partners.map(({ candidate }) => round(candidate.measurement.lengthIn))],
      notes: ["Two pieces meet at a mitered seam the design already draws."],
    });
  });

  // 90° inside corners where two pieces turn on a shared corner point.
  for (let a = 0; a < pieces.length; a += 1) {
    for (let b = a + 1; b < pieces.length; b += 1) {
      const first = pieces[a]!;
      const second = pieces[b]!;
      const firstAlong = { x: first.frontNormal.y, y: -first.frontNormal.x };
      const secondAlong = { x: second.frontNormal.y, y: -second.frontNormal.x };
      if (Math.abs(firstAlong.x * secondAlong.x + firstAlong.y * secondAlong.y) >= 0.2) continue;
      const shared = first.measurement.world.find((corner) =>
        second.measurement.world.some((other) => Math.hypot(corner.x - other.x, corner.y - other.y) <= WALL_TOLERANCE_IN));
      if (!shared) continue;
      if (corners.some((corner) => corner.runs.includes(first.label) && corner.runs.includes(second.label))) continue;
      corners.push({
        kind: "Inside 90° corner",
        runs: [first.label, second.label],
        legsIn: [round(first.measurement.lengthIn), round(second.measurement.lengthIn)],
        notes: [`Pieces meet at ${round(shared.x)}", ${round(shared.y)}" in plan coordinates.`],
      });
    }
  }

  // Corner cabinets the top actually rests on.
  for (const cabinet of placed.filter((item) => bearsCountertop(item) && placedCornerGeometryKind(item) !== "standard")) {
    const kind = placedCornerGeometryKind(cabinet);
    const note = `${cabinet.masterCode || "Corner cabinet"} · ${text(cabinet.description) ?? ""}`.trim();
    const existing = corners.find((corner) => corner.kind === `Corner cabinet · ${kind}`);
    if (existing) {
      if (!existing.notes.includes(note)) existing.notes.push(note);
      continue;
    }
    corners.push({ kind: `Corner cabinet · ${kind}`, runs: [], legsIn: [finite(cabinet.width)], notes: [note] });
  }

  void room;
  return corners;
}

function describeUnknowns(input: CountertopFabricationInput, runs: readonly FabricationRun[]): string[] {
  if (runs.length === 0) return ["The design has no countertop-bearing run yet, so there is nothing to fabricate."];
  const unknowns = [
    "Slab thickness is not stored on this design — the fabricator confirms the slab it supplies.",
    "Seam layout is not decided by this design; the fabricator sets seams from the slab size.",
  ];
  if (!(input.selectedSurfaces ?? []).some(isCountertopPick)) {
    unknowns.push("No countertop product is selected, so the slab material is blank.");
  }
  if (!input.backsplash || (finite(input.backsplash.heightIn) == null && !input.backsplash.fullHeight)) {
    unknowns.push("No backsplash height is set on this design.");
  }
  if (!text(input.edgeProfileId)) unknowns.push("No edge profile is stored on this design.");
  if (runs.some((run) => run.topHeightIn == null)) {
    unknowns.push("Finished countertop height is not stored per run; field-verify against the cabinet plan.");
  }
  if (runs.some((run) => run.cutouts.some((cutout) => cutout.alongIn == null || cutout.acrossIn == null))) {
    unknowns.push("At least one opening has no stored size; confirm the fixture template before cutting.");
  }
  return unknowns;
}

/** True when the sheet carries at least one opening the fabricator must cut. */
export function fabricationSheetHasCutouts(sheet: CountertopFabricationSheet): boolean {
  return sheet.runs.some((run) => run.cutouts.length > 0) || sheet.unmatchedCutouts.length > 0;
}

/** Stable, filesystem-safe file name for the generated PDF. */
export function fabricationSheetFileName(sheet: CountertopFabricationSheet, brandName?: string | null): string {
  const slug = (value: string | null | undefined) =>
    (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const brand = slug(brandName) || "cabinetdealz";
  const job = slug(sheet.job.projectName) || slug(sheet.job.designName) || slug(sheet.job.roomLabel) || "design";
  return `${brand}-countertop-fabrication-${job}.pdf`;
}

/** Plain-text summary, used as the email body so it reads without opening the PDF. */
export function fabricationSheetSummaryLines(sheet: CountertopFabricationSheet): string[] {
  const lines: string[] = [];
  for (const run of sheet.runs) {
    lines.push(`${run.label} — ${run.lengthIn}" x ${run.depthIn}"`);
    for (const cutout of run.cutouts) {
      const opening = cutout.alongIn != null && cutout.acrossIn != null
        ? `${cutout.alongIn}" x ${cutout.acrossIn}"`
        : "opening size not stored";
      const position = cutout.centerFromStartIn != null && cutout.centerFromFrontIn != null
        ? `center ${cutout.centerFromStartIn}" from run start, ${cutout.centerFromFrontIn}" from front edge`
        : "position not measured";
      lines.push(`  ${cutout.kind === "sink" ? "Sink" : "Cooktop"}: ${cutout.label} — ${opening} — ${position}`);
    }
  }
  return lines;
}

/** Depth the Designer gives a wall run: base box plus the finished front overhang. */
export const FABRICATION_STANDARD_DEPTH_IN = COUNTERTOP_DEPTH_IN;
/** Overhang past the cabinet face on a wall run. */
export const FABRICATION_STANDARD_FRONT_OVERHANG_IN = COUNTERTOP_DEPTH_IN - STD.BASE_DEPTH;

/** The island's configured reveal, read straight from the island record. */
export function fabricationIslandOverhangIn(island: IslandZone): number {
  return islandCountertopOverhangIn(island);
}
