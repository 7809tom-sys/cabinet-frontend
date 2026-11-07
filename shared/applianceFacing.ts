/**
 * Per-appliance facing text for the photo render (Gemini / Google image test).
 *
 * The photo render is asked to turn the locked 3D Designer capture into a
 * photograph. It used to be told only *which* appliances exist, never which way
 * each one faces, so it was free to spin a range sideways down its own cabinet
 * run and drag the hood and wall cabinets with it. This module turns the facts
 * that come straight out of the 3D layout (the wall an appliance is set
 * against, the direction its front looks, and where the camera is looking from)
 * into plain sentences the prompt can state, one per appliance.
 *
 * Everything here is pure, framework-free and deterministic so the same input
 * always produces the same prompt text and it can be unit tested without a
 * browser or a provider.
 */

/** A direction in plan inches: +x is to the right of the room, +y is toward the front wall. */
export interface PlanVector {
  x: number;
  y: number;
}

export type ApplianceKind =
  | "range"
  | "cooktop"
  | "oven"
  | "hood"
  | "refrigerator"
  | "dishwasher"
  | "microwave"
  | "sink"
  | "wine-cooler"
  | "other";

/**
 * One appliance exactly as it sits in the 3D layout.
 *
 * `front` is the direction the appliance actually looks toward in the plan;
 * `inward` is the direction that wall faces into the room. Both come from the
 * 3D placement, so an appliance that really was turned across its run is
 * described that way instead of being flattened to "faces the room".
 */
export interface ApplianceFacingFacts {
  kind: ApplianceKind;
  /** Short noun phrase used in the sentence, e.g. `30 inch slide-in range`. */
  label: string;
  /** The wall the appliance is set against, e.g. `the back wall`. */
  wall: string;
  front: PlanVector;
  /** Direction the wall faces into the room, so the sentence can say "out into the room". */
  inward?: PlanVector | null;
  /** Direction the render camera looks along, in plan inches. */
  cameraForward?: PlanVector | null;
  /** For a hood or over-range microwave: the appliance it is mounted directly above. */
  above?: string | null;
  /** For a refrigerator: the cabinet that stays on the same wall directly above it. */
  overCabinet?: string | null;
}

/**
 * The one instruction that makes the reference image authoritative for
 * position and facing. It is stated before every per-appliance sentence so a
 * later sentence can never be read as permission to re-orient anything.
 */
export const APPLIANCE_ORIENTATION_LOCK =
  "ORIENTATION LOCK — reference image 1 IS the layout to preserve. It is the exact CabinetDealz 3D design, and its geometry is fixed: every cabinet run, every appliance, and every appliance's facing direction must be copied from image 1 exactly as drawn. Do not rotate, turn, flip, mirror, slide, swap, re-orient, or rearrange any appliance or cabinet. A range, cooktop, oven, hood, refrigerator, dishwasher, microwave, or sink keeps the same wall and the same direction its front faces in image 1. Never turn an appliance sideways down a cabinet run or point it at a neighbouring run, and never move a hood or the wall cabinets beside it away from the appliance they serve. If any sentence below seems to disagree with image 1, image 1 wins.";

/** True for appliances whose front is the face that must point into the room. */
const FEATURE_BY_KIND: Record<ApplianceKind, string> = {
  range: "oven door and front controls",
  cooktop: "cooking surface and front controls",
  oven: "oven door and control panel",
  hood: "front face and controls",
  refrigerator: "doors and dispenser",
  dishwasher: "door and control panel",
  microwave: "door and control panel",
  sink: "faucet and front rim",
  "wine-cooler": "glass door",
  other: "front face",
};

const PLACEMENT_BY_KIND: Record<ApplianceKind, string> = {
  range: "in the base run",
  cooktop: "in the countertop",
  oven: "in its cabinet bay",
  hood: "",
  refrigerator: "in its bay",
  dishwasher: "in the base run",
  microwave: "",
  sink: "in the countertop",
  "wine-cooler": "in the base run",
  other: "",
};

/** Appliances that hang on the wall above another appliance. */
const MOUNTED_KINDS: ReadonlySet<ApplianceKind> = new Set<ApplianceKind>(["hood", "microwave"]);

/** A direction this close to the camera axis counts as toward/away rather than sideways. */
const CAMERA_AXIS_DOT = 0.68;

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeVector(vector: PlanVector | null | undefined): PlanVector | null {
  if (!vector) return null;
  const x = finite(vector.x);
  const y = finite(vector.y);
  const length = Math.hypot(x, y);
  if (!(length > 1e-6)) return null;
  return { x: x / length, y: y / length };
}

function dot(a: PlanVector, b: PlanVector): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Camera-relative wording. `cameraForward` points from the camera into the
 * scene, so a front that points the other way looks toward the camera. The
 * camera's own right-hand direction is (-forward.y, forward.x) in plan inches,
 * which is what makes "across the view to the left/right" correct rather than
 * mirrored.
 */
export function applianceFacingCameraPhrase(input: {
  front: PlanVector;
  cameraForward?: PlanVector | null;
}): string {
  const front = normalizeVector(input.front);
  const forward = normalizeVector(input.cameraForward);
  if (!front || !forward) return "";
  const along = dot(front, forward);
  if (along <= -CAMERA_AXIS_DOT) return "toward the camera";
  if (along >= CAMERA_AXIS_DOT) return "away from the camera";
  const right: PlanVector = { x: -forward.y, y: forward.x };
  return dot(front, right) >= 0 ? "across the camera's view to the right" : "across the camera's view to the left";
}

/**
 * Where the appliance front points, in words, from the 3D placement: into the
 * room (from the wall it is set against) or, when the design really does turn
 * it along the run, along that run.
 */
export function applianceFacingDirectionPhrase(input: {
  front: PlanVector;
  inward?: PlanVector | null;
  cameraForward?: PlanVector | null;
}): string {
  const front = normalizeVector(input.front) ?? { x: 0, y: 1 };
  const inward = normalizeVector(input.inward);
  const camera = applianceFacingCameraPhrase({ front, cameraForward: input.cameraForward });
  const intoRoom = inward ? dot(front, inward) >= 0.5 : true;
  if (!intoRoom) return camera ? `along its cabinet run, ${camera}` : "along its cabinet run";
  return camera ? `out into the room and ${camera}` : "out into the room";
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/[.\s]+$/, "");
}

/** One sentence describing where one appliance is and which way it faces. */
export function describeApplianceFacing(facts: ApplianceFacingFacts): string {
  const kind = facts.kind;
  const label = cleanText(facts.label) || kind;
  const wall = cleanText(facts.wall) || "its wall";
  const feature = FEATURE_BY_KIND[kind] ?? FEATURE_BY_KIND.other;
  const above = cleanText(facts.above);
  const overCabinet = cleanText(facts.overCabinet);
  const direction = applianceFacingDirectionPhrase({
    front: facts.front,
    inward: facts.inward,
    cameraForward: facts.cameraForward,
  });

  if (MOUNTED_KINDS.has(kind)) {
    const mount = above
      ? `is mounted on ${wall} directly above the ${above}, centered on it, and it faces the same way as the ${above}`
      : `is mounted on ${wall} and its ${feature} faces ${direction}`;
    return `The ${label} ${mount}.`;
  }

  if (kind === "sink") {
    return `The ${label} is set into the countertop on ${wall}, with its ${feature} facing ${direction} and its faucet behind the bowl against that wall.`;
  }

  const placement = PLACEMENT_BY_KIND[kind];
  const place = placement ? ` ${placement}` : "";
  const cabinetLine = overCabinet
    ? ` The ${overCabinet} stays on ${wall} directly above the ${label}, centered over it.`
    : "";

  return `The ${label} sits${place} against ${wall}, with its back to that wall and its ${feature} facing ${direction}.${cabinetLine}`;
}

/** Every appliance's facing sentence, in the order the appliances were placed. */
export function buildApplianceFacingStatements(
  facts: readonly ApplianceFacingFacts[] | null | undefined,
): string[] {
  return (facts ?? []).map((entry) => describeApplianceFacing(entry));
}

/**
 * The complete prompt block: the layout lock first, then one sentence per
 * appliance. Returns an empty string when there is nothing to describe so a
 * prompt without facing data stays byte-identical to today's.
 */
export function buildApplianceFacingPromptBlock(
  facts: readonly ApplianceFacingFacts[] | null | undefined,
): string {
  const statements = buildApplianceFacingStatements(facts);
  if (statements.length === 0) return "";
  return [APPLIANCE_ORIENTATION_LOCK, ...statements].join(" ");
}
