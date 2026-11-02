/**
 * Door style → physical profile and finish color.
 *
 * The Designer and the Door Rendering Audit both read `door_styles`
 * (doorStyle, doorPanelType, panelConstruction, color, finish, styleCode,
 * distributor). Two gaps in that record were sending Aspen Charcoal (AC,
 * Preston / Skyline) out as a light gray slab:
 *
 * - `color` is often a name ("Espresso Brown") or empty. WebGL only understands
 *   a hex (or a CSS color keyword). An unknown name is ignored and the material
 *   stays white, which the audit lights turn into a flat gray.
 * - A raised panel with no bevel width/depth used a 0.18 in step, which reads
 *   as a slab from the front. Aspen White (AW) is the same raised family but
 *   its doorStyle text still says "Shaker".
 */

import {
  isAspenCharcoalIdentity,
  isAspenRaisedDefault,
  resolveDoorShapeDecision,
  type DoorProfileSource,
  type DoorShape,
} from "./doorRenderIdentity";

export const RAISED_PANEL_BEVEL_WIDTH_IN = 0.75;
export const RAISED_PANEL_BEVEL_DEPTH_IN = 0.28;

/** Dark charcoal stain sampled from the Aspen Charcoal door photograph. */
export const ASPEN_CHARCOAL_STAIN = "#2a211c";

export const ASPEN_RAISED_EDGE = "ogee";

export type { DoorProfileSource, DoorShape };

export type DoorPanelConstruction = "raised" | "flat" | "slab" | "glass";
export type DoorDrawerFrontType = "five-piece-raised" | "five-piece-flat" | "slab";
export type DoorGrainDirection = "vertical-stiles-horizontal-rails" | "vertical" | "horizontal" | "none";
export type DoorFinishSheen = "satin" | "matte" | "gloss";

export type DoorStyleAppearanceInput = {
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  styleCode?: string | null;
  code?: string | null;
  distributorName?: string | null;
  distributorCode?: string | null;
  doorStyle?: string | null;
  doorPanelType?: string | null;
  panelConstruction?: DoorPanelConstruction | string | null;
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  bevelWidth?: string | number | null;
  bevelDepth?: string | number | null;
  insideEdgeProfile?: string | null;
  drawerFrontType?: DoorDrawerFrontType | string | null;
  grainDirection?: DoorGrainDirection | string | null;
  finishSheen?: DoorFinishSheen | string | null;
  /** Admin door shape. When set, it wins over distributor text and the Aspen default. */
  doorShape?: DoorShape | string | null;
  /** Admin render color. When set, it wins over the name fallback and a distributor hex. */
  renderHex?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
  doorProfile?: DoorStyleAppearanceInput | null;
};

export type ResolvedDoorProfile = {
  doorStyle: string | null;
  doorPanelType: string | null;
  railWidth: string | number | null;
  stileWidth: string | number | null;
  panelConstruction: DoorPanelConstruction | null;
  bevelWidth: string | number | null;
  bevelDepth: string | number | null;
  insideEdgeProfile: string | null;
  drawerFrontType: DoorDrawerFrontType | null;
  grainDirection: DoorGrainDirection | null;
  finishSheen: DoorFinishSheen | null;
  profileSource: DoorProfileSource;
};

const PANEL_CONSTRUCTIONS = ["raised", "flat", "slab", "glass"] as const;
const DRAWER_FRONTS = ["five-piece-raised", "five-piece-flat", "slab"] as const;
const GRAIN_DIRECTIONS = ["vertical-stiles-horizontal-rails", "vertical", "horizontal", "none"] as const;
const FINISH_SHEENS = ["satin", "matte", "gloss"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  return allowed.find((item) => item === raw) ?? null;
}

function positiveInches(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : text(value) ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function styleCodeOf(style: DoorStyleAppearanceInput | null | undefined): string {
  return text(style?.styleCode || style?.code).toUpperCase();
}

function catalogName(style: DoorStyleAppearanceInput | null | undefined): string {
  return [style?.ourName, style?.aliasName, style?.name].map(text).filter(Boolean).join(" ");
}

function distributorText(style: DoorStyleAppearanceInput | null | undefined): string {
  return `${text(style?.distributorCode)} ${text(style?.distributorName)}`.toLowerCase();
}

export function isSkylineDistributor(style: DoorStyleAppearanceInput | null | undefined): boolean {
  const distributor = distributorText(style);
  if (!distributor.trim()) return false;
  return /skyline|preston|(^|[^a-z])sk([^a-z]|$)/.test(distributor);
}

/**
 * Preston / Skyline Aspen is a square raised panel (no cathedral) with an
 * ogee sticking and a 5-piece drawer. AW is stored as doorStyle "Shaker"
 * even though panelConstruction is raised. AC is stored as "Raised Panel"
 * with no bevel numbers.
 */
export function isSkylineAspenRaised(style: DoorStyleAppearanceInput | null | undefined): boolean {
  const name = catalogName(style).toLowerCase();
  const code = styleCodeOf(style);
  const aspenName = /\baspen\b/.test(name);
  const aspenCode = code === "AC" || code === "AW";
  if (!aspenName && !aspenCode) return false;
  const distributor = distributorText(style);
  if (distributor.trim() && !isSkylineDistributor(style)) {
    const stored = `${text(style?.doorStyle)} ${text(style?.doorPanelType)}`.toLowerCase();
    return style?.panelConstruction === "raised" || /raised/.test(stored);
  }
  return aspenName || aspenCode;
}

export function isAspenCharcoal(style: DoorStyleAppearanceInput | null | undefined): boolean {
  const name = catalogName(style).toLowerCase();
  const code = styleCodeOf(style);
  if (/\baspen\b/.test(name) && /charcoal/.test(name)) return true;
  return code === "AC" && /aspen|charcoal/.test(name);
}

/** A #rgb or #rrggbb catalog value. Color names are not hex. */
export function exactDoorFinishHex(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = text(value);
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
    if (!match) continue;
    const raw = match[1].toLowerCase();
    return raw.length === 3
      ? `#${raw.split("").map((part) => `${part}${part}`).join("")}`
      : `#${raw}`;
  }
  return null;
}

function flattenProfile(input: DoorStyleAppearanceInput | null | undefined): DoorStyleAppearanceInput {
  const nested = input?.doorProfile ?? {};
  return { ...(input ?? {}), ...nested };
}

/**
 * Fills the physical door the renderer should build. Stored measurements win.
 * Missing raised-panel bevels use the shared raised-panel step so the center
 * panel is visible from the front. Aspen styles whose doorStyle text does not
 * say "raised" still build a square raised panel.
 */
export function resolveDoorProfile(input: DoorStyleAppearanceInput | null | undefined): ResolvedDoorProfile {
  const source = flattenProfile(input);
  const decision = resolveDoorShapeDecision({ ...input, ...source });
  const glass = decision.shape === "glass";
  const raised = decision.shape === "raised";
  const slab = decision.shape === "slab";
  const doorStyleText = `${text(source.doorStyle)} ${text(source.doorPanelType)}`.toLowerCase();
  const raisedByText = /raised|bevel|cathedral|\bogee\b|\barch(?:ed)?\b|traditional/.test(doorStyleText);
  const aspenFamily = isAspenRaisedDefault({ ...input, ...source }) || isSkylineAspenRaised({ ...input, ...source });
  const charcoal = isAspenCharcoal({ ...input, ...source }) || isAspenCharcoalIdentity({ ...input, ...source });

  let doorStyle = text(source.doorStyle) || null;
  let doorPanelType = text(source.doorPanelType) || null;
  if (raised && !raisedByText) {
    doorStyle = "Raised Panel";
    doorPanelType = doorPanelType ?? "Raised Panel";
  } else if (decision.shape === "recessed-shaker") {
    if (!doorStyle || /\bslab\b|flat[\s-]?panel|\bflat\b/.test(doorStyle.toLowerCase())) doorStyle = "Shaker";
    if (doorPanelType && /flat[\s-]?panel|\bslab\b/.test(doorPanelType.toLowerCase())) doorPanelType = "Recessed Panel";
  } else if (slab) {
    doorStyle = "Slab";
    doorPanelType = "Slab";
  } else if (glass && !/\bglass\b/.test(doorStyleText)) {
    doorStyle = "Glass";
    doorPanelType = doorPanelType ?? "Glass";
  }
  if (!doorStyle && decision.source === "guessed") doorStyle = "Shaker";

  const storedGrain = oneOf(source.grainDirection, GRAIN_DIRECTIONS);
  const grainDirection: DoorGrainDirection | null = charcoal && (!storedGrain || storedGrain === "none")
    ? "vertical-stiles-horizontal-rails"
    : storedGrain;

  const storedBevelWidth = positiveInches(source.bevelWidth);
  const storedBevelDepth = positiveInches(source.bevelDepth);
  const storedEdge = text(source.insideEdgeProfile) || null;
  const storedDrawer = oneOf(source.drawerFrontType, DRAWER_FRONTS);

  return {
    doorStyle,
    doorPanelType,
    railWidth: positiveInches(source.railWidth) ?? (text(source.railWidth) || null),
    stileWidth: positiveInches(source.stileWidth) ?? (text(source.stileWidth) || null),
    panelConstruction: glass ? "glass" : raised ? "raised" : slab ? "slab" : "flat",
    bevelWidth: raised ? (storedBevelWidth ?? RAISED_PANEL_BEVEL_WIDTH_IN) : (storedBevelWidth ?? (text(source.bevelWidth) || null)),
    bevelDepth: raised ? (storedBevelDepth ?? RAISED_PANEL_BEVEL_DEPTH_IN) : (storedBevelDepth ?? (text(source.bevelDepth) || null)),
    insideEdgeProfile: raised ? (storedEdge || (aspenFamily ? ASPEN_RAISED_EDGE : "bevel")) : storedEdge,
    drawerFrontType: storedDrawer ?? (raised && aspenFamily ? "five-piece-raised" : null),
    grainDirection,
    finishSheen: oneOf(source.finishSheen, FINISH_SHEENS),
    profileSource: decision.source,
  };
}
