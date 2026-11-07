import {
  cabinetWall,
  isRangeHoodPlacement,
  isRangeOrOven,
  isRefrigerator,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type WallSide,
} from "@/lib/design";
import type { ApplianceFacingFacts, ApplianceKind, PlanVector } from "@shared/applianceFacing";

/**
 * Reads the appliance facing that the 3D Designer actually renders and turns it
 * into the facts the photo-render prompt states. Nothing here is written for
 * one kitchen: every wall name, facing direction and "above" pairing comes from
 * the placed geometry and the live camera.
 */

/** The camera the locked reference capture was taken from, in 3D world units. */
export interface RenderCameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
}

/** The rendered world rotation of one placed item, in radians. */
export type RenderRotationLookup = (cabinet: PlacedCabinet) => number;

function kindFor(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "placement">): ApplianceKind {
  const code = (cabinet.masterCode ?? "").toUpperCase();
  const description = (cabinet.description ?? "").toLowerCase();
  if (isRangeHoodPlacement(cabinet) || /^HOOD/.test(code) || /range\s+hood/.test(description)) return "hood";
  if (isRefrigerator(cabinet) || /^FRIDGE/.test(code)) return "refrigerator";
  if (/^DW[\s_-]?\d/.test(code) || /dishwasher/.test(description)) return "dishwasher";
  if (/^MW[\s_-]?\d/.test(code) || /microwave/.test(description)) return "microwave";
  if (/^WINE/.test(code) || /wine\s*(cooler|fridge|refrigerator)/.test(description)) return "wine-cooler";
  if (/^(RANGE|RNG|STOVE|STV)/.test(code) || /\brange\b|\bstove\b/.test(description)) return "range";
  if (/^(COOKTOP|CT)[\s_-]?\d/.test(code) || /cooktop/.test(description)) return "cooktop";
  if (/^(OVEN|OV)/.test(code) || /\boven\b/.test(description)) return "oven";
  return "other";
}

/** True when the placed item takes part in the render as a real appliance. */
export function isRenderAppliance(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "placement">): boolean {
  return cabinet.placement === "appliance" || isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode, cabinet.description);
}

/**
 * A short name for the appliance a sentence can use. Trailing catalog size
 * tokens are dropped because the width is already stated by the placement.
 */
export function applianceLabel(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "width">, kind: ApplianceKind): string {
  const cleaned = (cabinet.description ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\s*\d+(?:\.\d+)?\s*["″']?\s*/, "")
    .replace(/\s*\d+(?:\.\d+)?\s*["″']?\s*$/, "")
    .trim();
  if (cleaned) return cleaned;
  const width = Number(cabinet.width);
  const widthText = Number.isFinite(width) && width > 0 ? `${Math.round(width)} inch ` : "";
  return `${widthText}${kind === "wine-cooler" ? "wine cooler" : kind}`.trim();
}

/** Wall wording for a run id: a standard side, a drawn wall, a peninsula, or the island. */
export function renderWallPhrase(wallId: string | null | undefined, room: RoomData): string {
  if (!wallId) return "its wall";
  if (wallId === "top") return "the back wall";
  if (wallId === "bottom") return "the front wall";
  if (wallId === "left") return "the left wall";
  if (wallId === "right") return "the right wall";
  if (room.peninsulaRuns?.some((run) => run.id === wallId)) return "the peninsula";
  const customWall = room.customWalls?.find((wall) => wall.id === wallId);
  if (customWall?.label?.trim()) return `the ${customWall.label.trim().toLowerCase()}`;
  return "its wall";
}

/**
 * The direction one placed appliance faces, in plan inches. The 3D body is
 * modelled with its front on local +Z, so the plan direction is the body's
 * rendered three.js y-rotation applied to +Z. Passing the rendered rotation is
 * deliberate: an appliance that really was turned across its run reports that
 * instead of a guessed "faces the room".
 */
export function appliancePlanFacing(rotationRadians: number): PlanVector {
  const radians = Number.isFinite(rotationRadians) ? rotationRadians : 0;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

/**
 * The saved plan rotation as a three.js y-rotation. Plan positive rotation is
 * clockwise in plan inches and three.js turns the other way, so the sign is
 * flipped; both then name the same front direction for a cabinet on any wall.
 */
function defaultRotation(cabinet: PlacedCabinet): number {
  const degrees = Number(cabinet.rotation);
  return Number.isFinite(degrees) ? (-degrees * Math.PI) / 180 : 0;
}

function runSpan(cabinet: PlacedCabinet, side: string, room: RoomData): { start: number; end: number } {
  const start = wallRunOffset(cabinet, side, room);
  return { start, end: start + wallRunSpan(cabinet, side, room) };
}

/** The appliance a hood or over-range microwave is centred over, on the same wall. */
function applianceBelow(
  mounted: PlacedCabinet,
  side: string,
  room: RoomData,
  candidates: readonly PlacedCabinet[],
): PlacedCabinet | null {
  const span = runSpan(mounted, side, room);
  const center = (span.start + span.end) / 2;
  let best: { cabinet: PlacedCabinet; distance: number } | null = null;
  for (const candidate of candidates) {
    if (candidate.uid === mounted.uid) continue;
    if (cabinetWall(candidate, room) !== side) continue;
    const kind = kindFor(candidate);
    if (kind !== "range" && kind !== "cooktop" && kind !== "oven") continue;
    const below = runSpan(candidate, side, room);
    const distance = Math.abs((below.start + below.end) / 2 - center);
    if (!best || distance < best.distance) best = { cabinet: candidate, distance };
  }
  return best?.cabinet ?? null;
}

/** The cabinet that stays directly above a refrigerator on its own wall. */
function cabinetOver(
  refrigerator: PlacedCabinet,
  side: string,
  room: RoomData,
  candidates: readonly PlacedCabinet[],
): PlacedCabinet | null {
  const span = runSpan(refrigerator, side, room);
  const top = Number(refrigerator.height) || 0;
  let best: { cabinet: PlacedCabinet; overlap: number } | null = null;
  for (const candidate of candidates) {
    if (candidate.uid === refrigerator.uid) continue;
    if (candidate.placement !== "wall") continue;
    if (cabinetWall(candidate, room) !== side) continue;
    const mountedAbove = Number(candidate.mountBottom);
    if (Number.isFinite(mountedAbove) && mountedAbove < top - 1) continue;
    const above = runSpan(candidate, side, room);
    const overlap = Math.min(span.end, above.end) - Math.max(span.start, above.start);
    if (overlap <= 0) continue;
    if (!best || overlap > best.overlap) best = { cabinet: candidate, overlap };
  }
  return best?.cabinet ?? null;
}

/** Direction the reference camera looks, in plan inches. */
export function cameraPlanForward(camera: RenderCameraSnapshot | null | undefined): PlanVector | null {
  if (!camera) return null;
  const x = camera.target[0] - camera.position[0];
  const z = camera.target[2] - camera.position[2];
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) < 1e-6) return null;
  return { x, y: z };
}

/**
 * A short name for the cabinet a facing sentence refers to. Catalog
 * descriptions of refrigerator enclosures can run on for two lines, so the
 * sentence uses the plain cabinet name instead of the full catalog text.
 */
export function cabinetShortLabel(cabinet: Pick<PlacedCabinet, "masterCode" | "description">): string {
  const description = (cabinet.description ?? "").toLowerCase();
  if (/wall cabinet|bridge|upper/.test(description)) return "wall cabinet";
  const code = (cabinet.masterCode ?? "").trim();
  return code || "cabinet";
}

/** Sink facing: the basin front looks away from the wall it is set against. */
function sinkFacts(sink: SinkFixture, room: RoomData): ApplianceFacingFacts | null {
  const side: WallSide | undefined = sink.wallSide;
  const frame = side ? wallRunFrame(side, room) : null;
  if (!side || !frame) return null;
  // The run frame's inward normal is exact for a cardinal wall; adding zero keeps
  // a negative zero out of the prompt data.
  const inward = { x: frame.inward.x + 0, y: frame.inward.y + 0 };
  return {
    kind: "sink",
    label: sink.pelicanProductName?.trim() || `${Math.round(Number(sink.width) || 0)} inch kitchen sink`,
    wall: renderWallPhrase(side, room),
    front: inward,
    inward,
    cameraForward: null,
    above: null,
    overCabinet: null,
  };
}

/**
 * Every appliance facing the photo render must preserve, derived from the
 * actual 3D placement: the wall it is set against, the direction its front
 * really points, what sits above or below it, and the live camera axis.
 */
export function buildRenderApplianceFacing(input: {
  placed: readonly PlacedCabinet[];
  sinks?: readonly SinkFixture[];
  room: RoomData;
  camera?: RenderCameraSnapshot | null;
  /** The rendered world rotation of a placed item; defaults to the saved plan turn. */
  rotationFor?: RenderRotationLookup;
}): ApplianceFacingFacts[] {
  const { placed, room } = input;
  const rotationFor = input.rotationFor ?? defaultRotation;
  const cameraForward = cameraPlanForward(input.camera);
  const facts: ApplianceFacingFacts[] = [];

  for (const appliance of placed.filter(isRenderAppliance)) {
    const side = cabinetWall(appliance, room);
    const frame = wallRunFrame(side, room);
    const kind = kindFor(appliance);
    const mountedKind = kind === "hood" || kind === "microwave";
    const below = mountedKind ? applianceBelow(appliance, side, room, placed) : null;
    const overCabinet = kind === "refrigerator" ? cabinetOver(appliance, side, room, placed) : null;
    facts.push({
      kind,
      label: applianceLabel(appliance, kind),
      wall: renderWallPhrase(side, room),
      // A hood or over-range microwave keeps the facing of the appliance it serves.
      front: appliancePlanFacing(rotationFor(mountedKind && below ? below : appliance)),
      inward: frame ? { x: frame.inward.x, y: frame.inward.y } : null,
      cameraForward,
      above: below ? applianceLabel(below, kindFor(below)) : null,
      overCabinet: overCabinet ? cabinetShortLabel(overCabinet) : null,
    });
  }

  for (const sink of input.sinks ?? []) {
    const fact = sinkFacts(sink, room);
    if (fact) facts.push({ ...fact, cameraForward });
  }

  return facts;
}

/** Convenience for callers that only need to know whether there is anything to state. */
export function hasRenderApplianceFacing(facts: readonly ApplianceFacingFacts[] | null | undefined): boolean {
  return (facts?.length ?? 0) > 0;
}
