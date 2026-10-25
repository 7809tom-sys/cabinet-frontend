/**
 * Pure builder for the AI Photoreal Preview prompt. Kept framework-free and
 * side-effect-free so it can be unit tested and shared between the server
 * mutation and any future preview surface.
 *
 * The goal is a CONSISTENT, professional interior-photography look across every
 * render: same lens, same lighting language, same staging discipline — while
 * the design-specific facts (room size, finish, door style, counter, hardware,
 * per-wall layout) drive what is actually shown.
 *
 * Fidelity is the priority: the render MUST match the layout the user actually
 * built (which walls carry cabinets, whether there is an island, which
 * appliances exist). The model is otherwise prone to inventing a generic
 * L-shaped-kitchen-with-island, so we describe the true geometry explicitly and
 * add negative constraints against fabricated runs / islands / appliances.
 */

export type CameraAngle = "three-quarter" | "straight-on" | "wide";
export type TimeOfDay = "daylight" | "golden-hour" | "evening";

/** Overall footprint of the cabinetry, derived from which walls carry runs. */
export type LayoutType =
  | "one-wall"
  | "galley"
  | "L-shaped"
  | "U-shaped"
  | "peninsula"
  | "multi-wall";

export interface PhotorealPromptInput {
  roomWidthFt: number;
  roomDepthFt: number;
  ceilingFt?: number;
  finishName?: string;
  doorStyle?: string;
  secondFinishName?: string;
  countertop?: string;
  hardware?: string;
  /** Flooring material, e.g. "light natural-oak luxury vinyl plank". */
  flooring?: string;
  /** Backsplash tile/mosaic, e.g. "white marble hexagon mosaic". */
  backsplash?: string;
  /** Sink, e.g. "undermount stainless farmhouse sink". */
  sink?: string;
  /** Faucet, e.g. "matte black pull-down faucet". */
  faucet?: string;
  wallSummaries?: string[];
  hasIsland?: boolean;
  /**
   * Overall footprint of the cabinetry. When provided this drives the camera
   * framing and an explicit "this is a <layoutType> kitchen" statement so the
   * render does not drift into a generic layout.
   */
  layoutType?: LayoutType;
  /** Human names of the walls that actually carry cabinetry, e.g. ["Back wall"]. */
  cabinetWalls?: string[];
  /**
   * Appliances/fixtures that are actually present in the design (lowercase
   * phrases, e.g. ["a range", "a refrigerator", "a sink"]). Used to keep the
   * render from inventing appliances that were never placed.
   */
  appliances?: string[];
  notes?: string;
  /** Camera framing. Defaults to a flattering three-quarter angle. */
  cameraAngle?: CameraAngle;
  /** Lighting mood. Defaults to bright natural daylight. */
  timeOfDay?: TimeOfDay;
}

/**
 * Camera language. The three-quarter framing intentionally does NOT assume two
 * runs of cabinetry (that biases single-wall designs toward an L-shape). Layout
 * specifics are stated separately in the layout clause.
 */
const CAMERA_CLAUSE: Record<CameraAngle, string> = {
  "three-quarter":
    "Shot from a natural eye-level three-quarter angle, 24mm full-frame lens, straight verticals (no keystone distortion), composed like an architectural-digest interior.",
  "straight-on":
    "Shot straight-on and level with the main cabinet run, symmetric one-point perspective, 35mm full-frame lens, straight verticals, centered composition like a catalog hero photo.",
  wide:
    "Wide establishing shot from a corner of the room, 20mm full-frame lens kept level to avoid distortion, showing the full kitchen layout with generous foreground floor.",
};

const LIGHT_CLAUSE: Record<TimeOfDay, string> = {
  daylight:
    "Bright, even natural daylight pouring in from a large window, soft diffused shadows, clean neutral white balance, airy and inviting.",
  "golden-hour":
    "Warm late-afternoon golden-hour light raking across the counters, long soft shadows, cozy amber highlights balanced against cool window fill.",
  evening:
    "Evening scene lit by warm under-cabinet LED strips and recessed ceiling downlights, gentle pools of light on the counters, calm and upscale mood.",
};

/**
 * Plain-language description of each layout footprint. Written as a firm
 * instruction so the model reproduces the geometry the user actually built.
 */
const LAYOUT_CLAUSE: Record<LayoutType, string> = {
  "one-wall":
    "This is a SINGLE-WALL (one-wall) kitchen: all cabinetry sits in ONE straight continuous run along a single wall. There is NO island and NO cabinetry on the other walls — the opposite and side walls are open floor space.",
  galley:
    "This is a GALLEY kitchen: two parallel straight runs of cabinetry face each other along two opposite walls, with a walkway between them and NO island.",
  "L-shaped":
    "This is an L-SHAPED kitchen: cabinetry runs along two adjoining walls that meet at one corner, forming an L. Only these two walls carry cabinets.",
  "U-shaped":
    "This is a U-SHAPED kitchen: cabinetry wraps around three adjoining walls forming a U. Only these three walls carry cabinets.",
  peninsula:
    "This kitchen has a peninsula: the perimeter cabinetry is joined by a peninsula run connected at one end to the wall cabinetry (a connected counter, not a free-standing island).",
  "multi-wall":
    "Reproduce the cabinetry exactly as described in the layout list below — only on the walls listed, with no additional invented runs.",
};

/** Round a foot value for clean prose (no trailing .0). */
function ft(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function buildPhotorealPrompt(input: PhotorealPromptInput): string {
  const finish = (input.finishName || "").trim();
  const door = (input.doorStyle || "").trim();
  const counter = (input.countertop || "").trim();
  const hardware = (input.hardware || "").trim();
  const ceiling = input.ceilingFt ?? 8;
  const angle = input.cameraAngle ?? "three-quarter";
  const mood = input.timeOfDay ?? "daylight";

  const parts: string[] = [];

  // 1. Medium + overall quality bar.
  parts.push(
    "Professional photorealistic interior photograph of a real, fully-built residential kitchen, editorial real-estate / architectural-digest quality, ultra realistic, high dynamic range, physically-based materials, crisp focus with subtle natural depth of field."
  );

  // 2. Camera + lighting (the consistency backbone).
  parts.push(CAMERA_CLAUSE[angle]);
  parts.push(LIGHT_CLAUSE[mood]);

  // 3. Room envelope.
  parts.push(
    `The room is approximately ${ft(input.roomWidthFt)} feet wide by ${ft(input.roomDepthFt)} feet deep with a ${ft(ceiling)}-foot ceiling, painted a soft neutral white on the walls with a light wood or warm-toned floor.`
  );

  // 3b. Layout footprint — stated up front and firmly so the render matches
  // the actual design instead of a generic kitchen.
  if (input.layoutType) {
    parts.push(LAYOUT_CLAUSE[input.layoutType]);
  }

  // 4. Cabinetry (the star of the shot).
  if (door || finish) {
    const twoTone = input.secondFinishName?.trim()
      ? `, with a two-tone scheme where the island or lower cabinets are ${input.secondFinishName.trim()}`
      : "";
    const desc = [finish, door && `${door}-style`].filter(Boolean).join(" ");
    parts.push(
      `The cabinetry is ${desc || "custom"} kitchen cabinets${twoTone}, with clean consistent reveals, realistic door and drawer fronts, and true-to-life paint or wood-grain texture.`
    );
  } else {
    parts.push("Custom kitchen cabinets with clean consistent reveals and realistic fronts.");
  }

  if (counter) {
    parts.push(`The countertops are ${counter} with a realistic polished surface, subtle reflections, and a proper thickness with a finished front edge.`);
  }
  if (hardware) {
    parts.push(`Cabinet hardware is ${hardware}, consistently placed on every door and drawer.`);
  }

  // 4b. Surfaces & fixtures chosen in the Surfaces wizard, so the money-shot
  // reflects the WHOLE room rather than just cabinets + countertop.
  const flooring = (input.flooring || "").trim();
  const backsplash = (input.backsplash || "").trim();
  const sink = (input.sink || "").trim();
  const faucet = (input.faucet || "").trim();
  if (flooring) {
    parts.push(`The floor is ${flooring}, laid realistically across the whole room with accurate plank/tile scale and natural texture.`);
  }
  if (backsplash) {
    parts.push(`The backsplash is ${backsplash}, installed on the wall between the countertop and the wall cabinets with realistic grout lines and reflections.`);
  }
  if (sink || faucet) {
    const fixture = [sink, faucet && `paired with a ${faucet}`].filter(Boolean).join(" ");
    parts.push(`The kitchen sink area features a ${fixture}, rendered true to life.`);
  }

  // 5. Layout so the render tracks what the user actually built.
  parts.push(
    "CRITICAL LAYOUT INSTRUCTION: You MUST faithfully reproduce the EXACT cabinet arrangement described below. Do NOT rearrange, add, remove, or substitute any cabinets. The number, size, and sequence of cabinets on each wall must match precisely."
  );
  if (input.cabinetWalls && input.cabinetWalls.length > 0) {
    parts.push(
      `Cabinetry appears ONLY on the following wall(s): ${input.cabinetWalls.join(", ")}. The other walls have NO cabinets — show them as bare painted walls.`
    );
  }
  if (input.wallSummaries && input.wallSummaries.length > 0) {
    parts.push("EXACT cabinet-by-cabinet layout (reproduce this precisely, left to right as described): " + input.wallSummaries.join(". ") + ".");
  }

  // 5b. Appliances: show exactly what was placed; do not invent extras.
  if (input.appliances && input.appliances.length > 0) {
    parts.push(
      `The only appliances/fixtures in this kitchen are: ${input.appliances.join(", ")}. Do not add any other appliances.`
    );
  }

  // 5c. Island is opt-in. State its absence firmly, since the model tends to
  // add one by default.
  if (input.hasIsland) {
    parts.push("A central kitchen island with cabinetry and countertop matching the perimeter, with a small amount of walking clearance around it.");
  } else {
    parts.push("There is NO kitchen island and NO peninsula — keep the center of the room as open floor.");
  }
  if (input.notes?.trim()) parts.push(input.notes.trim());

  // 6. Staging discipline.
  parts.push(
    "Tastefully but minimally staged: a few realistic props such as a bowl of fruit, a cutting board, or a plant, but uncluttered counters."
  );

  // 7. Hard constraints (negative prompt) to keep renders clean and on-brief.
  parts.push(
    "ABSOLUTE CONSTRAINTS: You must ONLY show what is described above. Do NOT invent, add, or rearrange any cabinets, appliances, islands, or peninsulas beyond what is explicitly listed. The cabinet count, widths, and left-to-right order on each wall must match the layout description exactly. Do NOT include: people, hands, pets, text, letters, numbers, labels, watermarks, logos, floor-plan overlays, measurement lines, grid lines, blueprint or CAD look, cartoon or 3D-render CGI look, warped or melted cabinets, crooked walls, extra doors, duplicated fixtures, fisheye distortion, or blurry low-resolution artifacts."
  );

  return parts.join(" ");
}
