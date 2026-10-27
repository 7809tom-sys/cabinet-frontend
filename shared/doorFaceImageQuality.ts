/**
 * Quality checks for a door style's door photo and drawer-front photo.
 *
 * The 3D designer does not paint the whole file onto a face. InteractiveRoom3D
 * (`doorTexture` / `drawerTexture`) and `configureDoorAuditSampleTexture` map a
 * non-curated sample with repeat 0.42 and offset 0.29, so the mesh shows the
 * center 42% (UV 0.29 through 0.71). `threeDStructuralSampleTexture` uses the
 * same crop for boxes and finished ends. FACE_IMAGE_MIN_PX is
 * ceil(256 / 0.42) = 610 so that window still holds about 256 texels on the
 * short side. The audit capture (720×1080) is the rendered PNG, not the
 * sample-photo requirement.
 *
 * Shadow, margin, and rule limits are Rec.709 luminance points (0–255), the
 * same scale as `rowLuminanceFromImageData`. A combined door+drawer swatch is
 * rejected with `detectHorizontalReveal` from doorFaceRecognition.
 */

import {
  detectHorizontalReveal,
  rowLuminanceFromImageData,
} from "./doorFaceRecognition";

/** Repeat used for a non-curated door or drawer sample in the 3D designer. */
export const FACE_TEXTURE_REPEAT = 0.42;
/** Offset paired with FACE_TEXTURE_REPEAT. The visible window starts here. */
export const FACE_TEXTURE_OFFSET = 0.29;
/** Texels wanted inside the center crop, on the short side. */
export const FACE_VISIBLE_TEXELS = 256;
/** Both width and height must reach this. 610 × 0.42 ≈ 256. */
export const FACE_IMAGE_MIN_PX = Math.ceil(
  FACE_VISIBLE_TEXELS / FACE_TEXTURE_REPEAT,
);

/** Outer band compared with the center for a studio falloff. */
export const SHADOW_EDGE_FRACTION = 0.08;
/** Inner span treated as the lit face. */
export const SHADOW_CENTER_FRACTION = 0.5;
/**
 * An edge band this many points darker than the center is a shadow.
 * 28 sits just above the reveal detector's dip of 25, so a thin drawer gap
 * and ordinary grain (band averages well under 15) stay under the line.
 */
export const SHADOW_EDGE_DELTA = 28;
/** One side this many points darker than the opposite side. */
export const SHADOW_SIDE_DELTA = 32;
/** And that darker side must also be this far below the center. */
export const SHADOW_SIDE_CENTER_DELTA = 18;

/** Outer rows/columns measured for a page margin or border. */
export const MARGIN_PROBE_PX = 3;
/** White margin: the strip is this bright… */
export const MARGIN_WHITE_MIN = 245;
/** …while the face inside the strip is at or below this. A white door stays under the line because its interior matches the edge. */
export const MARGIN_WHITE_INTERIOR_MAX = 220;
/** Black margin: the strip is this dark… */
export const MARGIN_BLACK_MAX = 15;
/** …while the face inside is at least this bright. A black door stays under the line. */
export const MARGIN_BLACK_INTERIOR_MIN = 40;

/** Compare the outermost pixel with the pixel this far inward. */
export const RULE_INSET_PX = 3;
/**
 * A PDF hairline is this many points darker than the face a few pixels in.
 * Larger than grain and larger than the reveal walk's neighbor gap of 12.
 */
export const RULE_LINE_DELTA = 40;
/** Share of an edge that must carry that step. A few dark knots do not count. */
export const RULE_LINE_COVERAGE = 0.7;

export type FaceImagePixels = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

export type DoorFaceName = "door" | "drawer";

export type DoorFaceQualityIssueCode =
  | "same-url"
  | "same-content"
  | "combined-reveal"
  | "shadow"
  | "margin"
  | "rule-line"
  | "resolution";

export type DoorFaceQualityIssue = {
  code: DoorFaceQualityIssueCode;
  face: DoorFaceName | "pair";
  detail: string;
};

export type DoorFaceQualityInput = {
  ourName?: string | null;
  doorUrl: string;
  drawerUrl: string;
  door: FaceImagePixels;
  drawer: FaceImagePixels;
};

export type DoorFaceQualityResult = {
  ok: boolean;
  issues: DoorFaceQualityIssue[];
};

type EdgeName = "top" | "bottom" | "left" | "right";

type MarginHit = { edge: EdgeName; kind: "white" | "black" };

const EDGES: readonly EdgeName[] = ["top", "bottom", "left", "right"];

function styleLabel(ourName: string | null | undefined, face: string): string {
  const name = ourName?.trim();
  return name ? `${name} ${face}` : face;
}

function assertPixels(face: string, image: FaceImagePixels): void {
  const expected = image.width * image.height * 4;
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 1 ||
    image.height < 1
  ) {
    throw new Error(
      `${face} image size ${image.width}×${image.height} is not a positive integer pair`,
    );
  }
  if (image.rgba.length !== expected) {
    throw new Error(
      `${face} image is ${image.width}×${image.height} but rgba has ${image.rgba.length} bytes (expected ${expected})`,
    );
  }
}

function luminanceAt(
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): number {
  const i = (y * width + x) * 4;
  return 0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!;
}

function meanLuminance(
  rgba: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      sum += luminanceAt(rgba, width, x, y);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function samePixels(a: FaceImagePixels, b: FaceImagePixels): boolean {
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.rgba.length !== b.rgba.length
  )
    return false;
  for (let i = 0; i < a.rgba.length; i += 1) {
    if (a.rgba[i] !== b.rgba[i]) return false;
  }
  return true;
}

function shadowIssue(
  face: DoorFaceName,
  image: FaceImagePixels,
  ourName: string | null | undefined,
): DoorFaceQualityIssue | null {
  const { rgba, width, height } = image;
  const edgeX = Math.max(1, Math.round(width * SHADOW_EDGE_FRACTION));
  const edgeY = Math.max(1, Math.round(height * SHADOW_EDGE_FRACTION));
  if (edgeX * 2 >= width || edgeY * 2 >= height) return null;

  const cx0 = Math.floor((width * (1 - SHADOW_CENTER_FRACTION)) / 2);
  const cx1 = Math.ceil((width * (1 + SHADOW_CENTER_FRACTION)) / 2);
  const cy0 = Math.floor((height * (1 - SHADOW_CENTER_FRACTION)) / 2);
  const cy1 = Math.ceil((height * (1 + SHADOW_CENTER_FRACTION)) / 2);
  const center = meanLuminance(rgba, width, cx0, cy0, cx1, cy1);
  const bands: Record<EdgeName, number> = {
    top: meanLuminance(rgba, width, 0, 0, width, edgeY),
    bottom: meanLuminance(rgba, width, 0, height - edgeY, width, height),
    left: meanLuminance(rgba, width, 0, 0, edgeX, height),
    right: meanLuminance(rgba, width, width - edgeX, 0, width, height),
  };

  const notes: string[] = [];
  for (const edge of EDGES) {
    const delta = center - bands[edge];
    if (delta >= SHADOW_EDGE_DELTA) {
      notes.push(
        `${edge} edge is ${Math.round(delta)} luminance points darker than the center`,
      );
    }
  }
  const leftVsRight = bands.right - bands.left;
  if (
    leftVsRight >= SHADOW_SIDE_DELTA &&
    center - bands.left >= SHADOW_SIDE_CENTER_DELTA
  ) {
    notes.push(
      `left side is ${Math.round(leftVsRight)} points darker than the right`,
    );
  }
  const rightVsLeft = bands.left - bands.right;
  if (
    rightVsLeft >= SHADOW_SIDE_DELTA &&
    center - bands.right >= SHADOW_SIDE_CENTER_DELTA
  ) {
    notes.push(
      `right side is ${Math.round(rightVsLeft)} points darker than the left`,
    );
  }
  const topVsBottom = bands.bottom - bands.top;
  if (
    topVsBottom >= SHADOW_SIDE_DELTA &&
    center - bands.top >= SHADOW_SIDE_CENTER_DELTA
  ) {
    notes.push(
      `top side is ${Math.round(topVsBottom)} points darker than the bottom`,
    );
  }
  const bottomVsTop = bands.top - bands.bottom;
  if (
    bottomVsTop >= SHADOW_SIDE_DELTA &&
    center - bands.bottom >= SHADOW_SIDE_CENTER_DELTA
  ) {
    notes.push(
      `bottom side is ${Math.round(bottomVsTop)} points darker than the top`,
    );
  }
  if (notes.length === 0) return null;
  return {
    code: "shadow",
    face,
    detail: `${styleLabel(ourName, face)} shadow: ${notes.join("; ")} (edge limit ${SHADOW_EDGE_DELTA}, side limit ${SHADOW_SIDE_DELTA})`,
  };
}

function interiorMean(image: FaceImagePixels): number {
  const { rgba, width, height } = image;
  if (width <= MARGIN_PROBE_PX * 2 || height <= MARGIN_PROBE_PX * 2) {
    return meanLuminance(rgba, width, 0, 0, width, height);
  }
  return meanLuminance(
    rgba,
    width,
    MARGIN_PROBE_PX,
    MARGIN_PROBE_PX,
    width - MARGIN_PROBE_PX,
    height - MARGIN_PROBE_PX,
  );
}

function stripMean(image: FaceImagePixels, edge: EdgeName): number {
  const { rgba, width, height } = image;
  const probeX = Math.min(MARGIN_PROBE_PX, width);
  const probeY = Math.min(MARGIN_PROBE_PX, height);
  if (edge === "top") return meanLuminance(rgba, width, 0, 0, width, probeY);
  if (edge === "bottom")
    return meanLuminance(rgba, width, 0, height - probeY, width, height);
  if (edge === "left") return meanLuminance(rgba, width, 0, 0, probeX, height);
  return meanLuminance(rgba, width, width - probeX, 0, width, height);
}

function marginHits(image: FaceImagePixels): MarginHit[] {
  const interior = interiorMean(image);
  const hits: MarginHit[] = [];
  for (const edge of EDGES) {
    const strip = stripMean(image, edge);
    if (strip >= MARGIN_WHITE_MIN && interior <= MARGIN_WHITE_INTERIOR_MAX)
      hits.push({ edge, kind: "white" });
    if (strip <= MARGIN_BLACK_MAX && interior >= MARGIN_BLACK_INTERIOR_MIN)
      hits.push({ edge, kind: "black" });
  }
  return hits;
}

function ruleCoverage(image: FaceImagePixels, edge: EdgeName): number {
  const { rgba, width, height } = image;
  if ((edge === "top" || edge === "bottom") && height <= RULE_INSET_PX)
    return 0;
  if ((edge === "left" || edge === "right") && width <= RULE_INSET_PX) return 0;
  let hits = 0;
  if (edge === "top" || edge === "bottom") {
    const yEdge = edge === "top" ? 0 : height - 1;
    const yIn = edge === "top" ? RULE_INSET_PX : height - 1 - RULE_INSET_PX;
    for (let x = 0; x < width; x += 1) {
      if (
        luminanceAt(rgba, width, x, yEdge) + RULE_LINE_DELTA <=
        luminanceAt(rgba, width, x, yIn)
      )
        hits += 1;
    }
    return hits / width;
  }
  const xEdge = edge === "left" ? 0 : width - 1;
  const xIn = edge === "left" ? RULE_INSET_PX : width - 1 - RULE_INSET_PX;
  for (let y = 0; y < height; y += 1) {
    if (
      luminanceAt(rgba, width, xEdge, y) + RULE_LINE_DELTA <=
      luminanceAt(rgba, width, xIn, y)
    )
      hits += 1;
  }
  return hits / height;
}

function inspectFace(
  face: DoorFaceName,
  image: FaceImagePixels,
  ourName: string | null | undefined,
): DoorFaceQualityIssue[] {
  const issues: DoorFaceQualityIssue[] = [];
  const label = styleLabel(ourName, face);
  if (image.width < FACE_IMAGE_MIN_PX || image.height < FACE_IMAGE_MIN_PX) {
    issues.push({
      code: "resolution",
      face,
      detail: `${label} is ${image.width}×${image.height}, under ${FACE_IMAGE_MIN_PX} px. The designer crops the center ${Math.round(FACE_TEXTURE_REPEAT * 100)}% (repeat ${FACE_TEXTURE_REPEAT}, offset ${FACE_TEXTURE_OFFSET}), and ${FACE_IMAGE_MIN_PX} px keeps about ${FACE_VISIBLE_TEXELS} texels in that crop.`,
    });
  }

  const shadow = shadowIssue(face, image, ourName);
  if (shadow) issues.push(shadow);

  const margins = marginHits(image);
  if (margins.length > 0) {
    const described = margins
      .map((hit) => `${hit.kind} margin on the ${hit.edge}`)
      .join("; ");
    issues.push({
      code: "margin",
      face,
      detail: `${label} crop: ${described} (white strip ≥ ${MARGIN_WHITE_MIN} with interior ≤ ${MARGIN_WHITE_INTERIOR_MAX}, or black strip ≤ ${MARGIN_BLACK_MAX} with interior ≥ ${MARGIN_BLACK_INTERIOR_MIN}, over ${MARGIN_PROBE_PX}px)`,
    });
  }

  const marginEdges = new Set(margins.map((hit) => hit.edge));
  const rules = EDGES.filter(
    (edge) =>
      !marginEdges.has(edge) && ruleCoverage(image, edge) >= RULE_LINE_COVERAGE,
  );
  if (rules.length > 0) {
    issues.push({
      code: "rule-line",
      face,
      detail: `${label} has a thin dark rule on the ${rules.join(", ")} (outer pixel ≥ ${RULE_LINE_DELTA} points darker than ${RULE_INSET_PX}px inward on ${Math.round(RULE_LINE_COVERAGE * 100)}% of the edge)`,
    });
  }

  const reveal = detectHorizontalReveal(
    rowLuminanceFromImageData(image.rgba, image.width, image.height),
  );
  if (reveal.detected) {
    issues.push({
      code: "combined-reveal",
      face,
      detail: `${label} contains a horizontal drawer reveal at rows ${reveal.revealStart}–${reveal.revealEnd} (dip ${Math.round(reveal.dip)}), so this file is a combined swatch`,
    });
  }
  return issues;
}

/**
 * Check one style's door image and drawer-front image.
 * Does not read the network or the database. Callers supply pixels.
 */
export function validateDoorFaceImages(
  input: DoorFaceQualityInput,
): DoorFaceQualityResult {
  assertPixels("door", input.door);
  assertPixels("drawer", input.drawer);
  const issues: DoorFaceQualityIssue[] = [];
  const doorUrl = input.doorUrl.trim();
  const drawerUrl = input.drawerUrl.trim();
  const label = styleLabel(input.ourName, "pair");
  if (doorUrl.length > 0 && doorUrl === drawerUrl) {
    issues.push({
      code: "same-url",
      face: "pair",
      detail: `${label} uses one URL for the door and the drawer front`,
    });
  }
  if (samePixels(input.door, input.drawer)) {
    issues.push({
      code: "same-content",
      face: "pair",
      detail: `${label} door and drawer-front pixels match`,
    });
  }
  issues.push(...inspectFace("door", input.door, input.ourName));
  issues.push(...inspectFace("drawer", input.drawer, input.ourName));
  return { ok: issues.length === 0, issues };
}
