/**
 * Visible edges for a shaker front, drawn from the shaker generic image.
 *
 * The shaker frame is already built from real rails and stiles standing proud of a recessed
 * center panel, but on a painted door every part is one flat color and the step barely reads.
 * This module draws the edge lines that make it read:
 *
 *  - `attachShakerFrameOutline` (the 3D Designer): ONE merged LineSegments per frame, the
 *    outer rectangle plus the opening rectangle, so a front costs one extra draw call.
 *  - `outlineEdges` (the door audit and the four-source cabinet preview): the per-rail
 *    EdgesGeometry version, moved here unchanged from `doorAuditDoorRender.ts`.
 *
 * Tom (Nov 18 2026, 10:02 PM CT) overrode the Nov 1 Driftwood-only edge rule and the earlier
 * removal of door-front outlines: every painted shaker front gets this look, and Driftwood
 * keeps its own soft strips as well.
 *
 * This file must NOT import InteractiveRoom3D (it imports this file). Nothing here is cached
 * or shared between frames: the Designer's `disposeObject` disposes every geometry and
 * material it finds, so each outline owns its own.
 */
import * as THREE from "three";
import { DLC_FRAME_DETAIL as SHAKER_GENERIC_IMAGE_FRAME } from "@shared/dlcFr26Textures";

export type ShakerOutlineTier = "mobile" | "balanced" | "high";

export type ShakerOutlinePolicy = {
  /** The Designer's Shaker edges toggle. Off hides every outline, already built or not. */
  enabled: boolean;
  /** Phones draw the opening edge only and fainter; the other tiers draw both rectangles. */
  tier: ShakerOutlineTier;
};

const POLICY_STORAGE_KEY = "shakerEdges.v1";

type Listener = () => void;
const listeners = new Set<Listener>();
/** Live outlines, so the toggle can show and hide scenes that are already built. */
const live = new Set<THREE.LineSegments>();

function defaultTier(): ShakerOutlineTier {
  if (typeof window === "undefined") return "balanced";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches === true;
  return coarse || window.innerWidth <= 640 ? "mobile" : "balanced";
}

function readStoredEnabled(): boolean {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(POLICY_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let policy: ShakerOutlinePolicy = { enabled: readStoredEnabled(), tier: defaultTier() };

export function getShakerOutlinePolicy(): ShakerOutlinePolicy {
  return policy;
}

export function subscribeShakerOutlinePolicy(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setShakerOutlinePolicy(next: Partial<ShakerOutlinePolicy>): void {
  const merged = { ...policy, ...next };
  if (merged.enabled === policy.enabled && merged.tier === policy.tier) return;
  policy = merged;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(POLICY_STORAGE_KEY, policy.enabled ? "on" : "off");
  } catch {
    // Private mode: the toggle still works for this page.
  }
  live.forEach((lines) => {
    lines.visible = policy.enabled;
  });
  listeners.forEach((listener) => listener());
}

/** Number of outlines currently alive (tests and the draw-call measurement). */
export function liveShakerOutlineCount(): number {
  return live.size;
}

function lerpHexTowardWhite(color: THREE.Color, amount: number) {
  return color.clone().lerp(new THREE.Color("#ffffff"), amount);
}

function luminanceOf(paint: THREE.Color) {
  return 0.2126 * paint.r + 0.7152 * paint.g + 0.0722 * paint.b;
}

/** Edge color from the paint: darker than the paint, lighter when the paint is already dark. */
export function shakerOutlineColor(hex: string, darken = 0.45): THREE.Color {
  const paint = new THREE.Color(hex);
  return luminanceOf(paint) < 0.12 ? lerpHexTowardWhite(paint, 0.4) : paint.clone().multiplyScalar(darken);
}

/**
 * Edge color for the Designer's frame outline. The line is drawn as its own color with the tone
 * map off, so it is darkened in display (sRGB) space: that is the step the eye sees. A paint that
 * is already dark gets a lighter edge instead.
 */
export function shakerFrameEdgeColor(hex: string, darken: number): THREE.Color {
  const paint = new THREE.Color(hex);
  if (luminanceOf(paint) < 0.12) return lerpHexTowardWhite(paint, 0.4);
  const display = paint.clone().convertLinearToSRGB();
  display.multiplyScalar(darken);
  return display.convertSRGBToLinear();
}

/** Thin edge lines for one rail or stile: darker than the paint, lighter when the paint is already dark. */
export function outlineEdges(geometry: THREE.BufferGeometry, hex: string): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 30),
    new THREE.LineBasicMaterial({ color: shakerOutlineColor(hex), transparent: true, opacity: 0.85 }),
  );
  lines.userData = { shakerOutline: true };
  return lines;
}

/** How the tiers draw: which rectangles, and how strong. */
export function shakerOutlineStyle(tier: ShakerOutlineTier): { outer: boolean; opening: boolean; opacity: number; darken: number } {
  if (tier === "mobile") return { outer: false, opening: true, opacity: 0.6, darken: 0.6 };
  if (tier === "balanced") return { outer: true, opening: true, opacity: 0.8, darken: 0.5 };
  return { outer: true, opening: true, opacity: 0.9, darken: 0.45 };
}

function pushRect(out: number[], halfW: number, halfH: number, z: number) {
  const corners: Array<[number, number]> = [[-halfW, halfH], [halfW, halfH], [halfW, -halfH], [-halfW, -halfH]];
  for (let index = 0; index < 4; index += 1) {
    const [ax, ay] = corners[index]!;
    const [bx, by] = corners[(index + 1) % 4]!;
    out.push(ax, ay, z, bx, by, z);
  }
}

/** Vertex positions (pairs of points) for the outer and opening rectangles, in the frame group's space. */
export function shakerFrameOutlinePositions(input: {
  faceWidth: number;
  faceHeight: number;
  rail: number;
  stile: number;
  z: number;
  outer?: boolean;
  opening?: boolean;
}): number[] {
  const positions: number[] = [];
  const openingW = input.faceWidth - input.stile * 2;
  const openingH = input.faceHeight - input.rail * 2;
  if (input.outer !== false) pushRect(positions, input.faceWidth / 2, input.faceHeight / 2, input.z);
  if (input.opening !== false && openingW > 0.02 && openingH > 0.02) pushRect(positions, openingW / 2, openingH / 2, input.z);
  return positions;
}

/** Local z of the rails' front plane in a frame group, with a hair of clearance so the lines never z-fight. */
export function shakerFrameFrontZ(proud: boolean): number {
  const standard = SHAKER_GENERIC_IMAGE_FRAME.standardRailDepth;
  const depth = proud ? SHAKER_GENERIC_IMAGE_FRAME.railDepth : standard;
  const center = proud ? (depth - standard) / 2 : 0;
  return center + depth / 2 + 0.0006;
}

export type ShakerFrameOutlineInput = {
  faceWidth: number;
  faceHeight: number;
  rail: number;
  stile: number;
  /** The paint (door finish) the edges are derived from. */
  color: string;
  /** True when the rails use the proud shaker generic image depth (solid-color faces). */
  proud: boolean;
};

/**
 * Add one outline to a shaker frame group: the outer rectangle and the opening rectangle in a
 * single LineSegments (one draw call). Returns null when there is nothing to draw (toggle off at
 * build is still built hidden, so turning it on later shows it without a rebuild).
 */
export function attachShakerFrameOutline(frameGroup: THREE.Group, input: ShakerFrameOutlineInput): THREE.LineSegments | null {
  const style = shakerOutlineStyle(policy.tier);
  const positions = shakerFrameOutlinePositions({
    faceWidth: input.faceWidth,
    faceHeight: input.faceHeight,
    rail: input.rail,
    stile: input.stile,
    z: shakerFrameFrontZ(input.proud),
    outer: style.outer,
    opening: style.opening,
  });
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: shakerFrameEdgeColor(input.color, style.darken),
      transparent: true,
      opacity: style.opacity,
      // Drawn as the edge color itself, not re-lit or tone-mapped: the Designer draws solid-color
      // faces with the tone map off, so a tone-mapped line would sit at a different shade.
      toneMapped: false,
      depthWrite: false,
    }),
  );
  lines.visible = policy.enabled;
  lines.renderOrder = 2;
  lines.userData = { shakerFrameOutline: true, dimensionalCabinetDetail: true };
  live.add(lines);
  // `disposeObject` disposes the geometry when the scene is rebuilt: forget the outline then.
  geometry.addEventListener("dispose", () => {
    live.delete(lines);
  });
  frameGroup.add(lines);
  return lines;
}
