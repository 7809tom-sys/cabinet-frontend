/**
 * Raised-panel door blueprint (Tom, Nov 4 2026: "the profile is perfect").
 *
 * The 3D Designer already draws a raised-panel face: a square five-piece frame,
 * a sloped "pillowed" bevel inside it, and a raised center panel. This module is
 * that geometry, copied from `client/src/components/design/raisedPanelBevel.ts`
 * and the `raisedProfile` branch of `addShakerFrame` in
 * `client/src/components/design/InteractiveRoom3D.tsx` at the values those files
 * render today. Nothing here is a new design: every number below is the number
 * the renderer already uses, so a style moved onto this entry looks the same.
 *
 * Rules for the entry:
 *
 * - Door and drawer fronts only. `RAISED_PANEL_FRONT_ROLES` is the whole list.
 *   Cabinet sides, tops, bottoms, and end skins are flat; they never receive the
 *   frame, the bevel, or the raised center. An end treatment is separate and is
 *   added only when a cabinet's end-side box is checked.
 * - Painted finishes are solid. `grainUrl` is null and no photo/grain is applied,
 *   following the paint rule in `shakerDoorBlueprint.ts`. The color always comes
 *   from `resolveDoorColor` (an accepted render first); nothing is snapped to the
 *   brand palette. Stained wood keeps its grain.
 * - A profile the WalzCraft wizard produced for the style wins. The wizard lives
 *   only in the door editor, so this entry is the default for every other raised
 *   style.
 *
 * Dimensions that are not known are marked TODO instead of guessed. The only
 * measured raised sample in the catalog (Casselberry CW, style 330026) supplies
 * a photo, not dimensions.
 */
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import {
  doorProfileConstructionText,
  doorProfileIsSlabOrGlass,
  doorProfileMatches,
  doorProfileNameText,
} from "./doorProfileIdentity";
import { isPaintedFinish, type PaintedFinishInput } from "./paintedFinish";

/** Rendered raised faces today: the five-piece frame, bevel, and center panel. */
export const RAISED_PANEL_BLUEPRINT_ID = "raised-panel-five-piece-bevel";

/** The only faces this profile may be built on. */
export const RAISED_PANEL_FRONT_ROLES = ["door", "drawer"] as const;
export type RaisedPanelFrontRole = (typeof RAISED_PANEL_FRONT_ROLES)[number];

/**
 * Any other surface a cabinet has. Listed so a caller can prove the raised
 * profile is not attached to one of them.
 */
export const RAISED_PANEL_NON_FRONT_SURFACES = [
  "side",
  "top",
  "bottom",
  "back",
  "end-panel",
  "end-skin",
  "carcass",
  "face-frame",
  "toe-kick",
  "shelf",
  "interior",
] as const;
export type RaisedPanelNonFrontSurface = (typeof RAISED_PANEL_NON_FRONT_SURFACES)[number];

const INCH = 1 / 12;

/**
 * Geometry exactly as `raisedPanelBevel.ts` and the renderer build it.
 *
 * Frame: four square boxes. The top and bottom rails span the full face width;
 * the stiles run between them. The catalog sample is a mitered frame, but the
 * Designer draws square-butt joints today and that is what this entry copies.
 *
 * TODO(raised-panel): the mitered 45° joints and the multi-step "pillowed"
 * cove/ogee molding on Casselberry CW (330026) are not modeled by the renderer
 * at all. The current face carries one flat frame plus one sloped bevel, so that
 * is what the entry describes. Adding the molding is a separate change.
 */
export const RAISED_PANEL_BLUEPRINT = {
  id: RAISED_PANEL_BLUEPRINT_ID,
  label: "Raised panel — five-piece frame, pillowed bevel, raised center",
  appliesTo: RAISED_PANEL_FRONT_ROLES,
  /** Frame members. Widths are the style's own rail/stile; 3 in is the renderer default. */
  frame: {
    railIn: 3,
    stileIn: 3,
    corner: "square-butt",
    /** `DLC_FRAME_DETAIL.standardRailDepth` / `.railDepth` (scene feet). */
    railDepthFt: 0.026,
    dlcRailDepthFt: 0.031,
  },
  /** Sloped border between frame opening and the raised center. */
  bevel: {
    widthIn: 0.75,
    depthIn: 0.28,
    /** A shallower stored step is lifted to this so the slope reads from the front. */
    readableDepthIn: 0.45,
    minWidthFt: 0.025,
    minDepthFt: 0.012,
    /** Cap as rendered (`Math.min(..., 0.07)`). */
    maxDepthFt: 0.07,
  },
  /** Dark groove between the frame opening and the start of the slope. */
  groove: {
    widthIn: 0.18,
    depthFt: 0.001,
    maxFractionOfFace: 0.12,
    maxFractionOfBevel: 0.45,
  },
  /** Raised center panel sitting on top of the bevel. */
  panel: {
    minThicknessFt: 0.012,
    maxThicknessFt: 0.02,
    thicknessOfBevelDepth: 0.45,
    zFt: 0.003,
  },
  /** Recessed bed behind the front, one per face. */
  recess: {
    bedThicknessFt: 0.006,
    bedZFt: -0.01,
  },
  /**
   * Unknown dimensions. Left unset on purpose: the catalog raised rows carry no
   * numbers and the CW sample is a photo. The renderer's defaults above apply.
   */
  todos: [
    "TODO: mitered 45-degree joint width/none rendered (square-butt today)",
    "TODO: inner cove/ogee molding stack of Casselberry CW 330026",
    "TODO: frame width for Casselberry CW 330026 (no stored railWidth/stileWidth)",
    "TODO: drawer-front rail proportion beyond the shared frame fallback",
  ],
} as const;

export type RaisedPanelStyleInput = DoorColorInput & PaintedFinishInput & {
  doorPanelType?: string | null;
  panelConstruction?: string | null;
  approvedReferenceImageUrl?: string | null;
  bevelWidth?: string | number | null;
  bevelDepth?: string | number | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  insideEdgeProfile?: string | null;
  doorShape?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
};

const RAISED_TEXT = /raised|bevel|cathedral|\bogee\b|\barch(?:ed)?\b|traditional/i;

/**
 * Raised by the construction fields, or by the style's own name when the
 * construction fields say nothing. Matching is case-insensitive, so "RAISED
 * PANEL" and "Raised Panel" are the same style.
 *
 * A name is only consulted when `doorStyle` / `doorPanelType` / the profile notes
 * are all blank, and never for a style whose construction says slab, glass, or
 * shaker — a "Traditional Shaker" is a shaker, not a raised panel.
 */
export function isRaisedPanelStyle(style: RaisedPanelStyleInput | null | undefined): boolean {
  if (!style) return false;
  const construction = doorProfileConstructionText(style);
  if (RAISED_TEXT.test(construction)) return true;
  if ((style.panelConstruction ?? "").trim().toLowerCase() === "raised") return true;
  if ((style.doorShape ?? "").trim().toLowerCase() === "raised") return true;
  // The construction fields above already spoke; a name only fills a blank.
  if (construction) return false;
  if (doorProfileIsSlabOrGlass(style) || doorProfileMatches(style, /shaker/)) return false;
  return RAISED_TEXT.test(doorProfileNameText(style));
}

/** Re-exported so a raised style and a plain cabinet read paint the same way. */
export { isPaintedFinish };

function parsedInches(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export type RaisedPanelFrameGeometryInput = {
  faceWidth: number;
  faceHeight: number;
  railIn?: string | number | null;
  stileIn?: string | number | null;
  bevelWidthIn?: string | number | null;
  bevelDepthIn?: string | number | null;
  insideEdgeProfile?: string | null;
  dlcFrame?: boolean;
};

/**
 * The face geometry the renderer builds, in scene feet.
 *
 * This is the arithmetic from `addShakerFrame` (raised branch) and
 * `attachSlopedRaisedPanel`, moved here unchanged so one entry owns it.
 */
export function raisedPanelFrameGeometry(input: RaisedPanelFrameGeometryInput) {
  const { faceWidth, faceHeight } = input;
  const blueprint = RAISED_PANEL_BLUEPRINT;
  const railIn = parsedInches(input.railIn) ?? blueprint.frame.railIn;
  const stileIn = parsedInches(input.stileIn) ?? blueprint.frame.stileIn;
  const railDepth = input.dlcFrame ? blueprint.frame.dlcRailDepthFt : blueprint.frame.railDepthFt;
  // Same clamps the renderer uses: a frame never takes more than half the face.
  const rail = Math.max(0, Math.min(railIn * INCH, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));
  const stile = Math.max(0, Math.min(stileIn * INCH, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));

  const openingWidth = Math.max(0.06, faceWidth - stile * 2);
  const openingHeight = Math.max(0.06, faceHeight - rail * 2);

  const requestedBevelWidth = parsedInches(input.bevelWidthIn);
  const bevelWidth = Math.max(blueprint.bevel.minWidthFt, Math.min(
    requestedBevelWidth != null ? requestedBevelWidth * INCH : blueprint.bevel.widthIn * INCH,
    openingWidth / 4,
    openingHeight / 4,
  ));
  const requestedBevelDepth = parsedInches(input.bevelDepthIn);
  const bevelDepth = Math.max(blueprint.bevel.minDepthFt, Math.min(
    effectiveRaisedBevelDepthIn(requestedBevelDepth != null ? requestedBevelDepth : blueprint.bevel.depthIn) * INCH,
    blueprint.bevel.maxDepthFt,
  ));

  // `attachSlopedRaisedPanel` groove math, unchanged.
  const groove = Math.min(
    blueprint.groove.widthIn * INCH,
    openingWidth * blueprint.groove.maxFractionOfFace,
    openingHeight * blueprint.groove.maxFractionOfFace,
    Math.max(0.004, bevelWidth * blueprint.groove.maxFractionOfBevel),
  );
  const slopeOuterWidth = Math.max(0.04, openingWidth - groove * 2);
  const slopeOuterHeight = Math.max(0.04, openingHeight - groove * 2);
  const slopeBevelWidth = Math.max(0.008, Math.min(bevelWidth, slopeOuterWidth / 4, slopeOuterHeight / 4));
  const panelWidth = Math.max(0.02, slopeOuterWidth - slopeBevelWidth * 2);
  const panelHeight = Math.max(0.02, slopeOuterHeight - slopeBevelWidth * 2);
  const panelThickness = Math.max(
    blueprint.panel.minThicknessFt,
    Math.min(blueprint.panel.maxThicknessFt, bevelDepth * blueprint.panel.thicknessOfBevelDepth),
  );

  return {
    rail,
    stile,
    railDepth,
    openingWidth,
    openingHeight,
    bevelWidth,
    bevelDepth,
    groove,
    slopeOuterWidth,
    slopeOuterHeight,
    slopeBevelWidth,
    panelWidth,
    panelHeight,
    panelThickness,
    recessBedThickness: blueprint.recess.bedThicknessFt,
    recessBedZ: blueprint.recess.bedZFt,
    grooveZ: blueprint.groove.depthFt,
    bevelZ: blueprint.panel.zFt,
    panelZ: blueprint.panel.zFt + bevelDepth + panelThickness / 2,
    insideEdgeProfile: input.insideEdgeProfile ?? "bevel",
  };
}

/** Lift a shallow step into the range that reads as raised; keep an already-deep one. */
export function effectiveRaisedBevelDepthIn(requestedInches: number): number {
  const requested = Number.isFinite(requestedInches) && requestedInches > 0 ? requestedInches : RAISED_PANEL_BLUEPRINT.bevel.depthIn;
  return requested < 0.4 ? RAISED_PANEL_BLUEPRINT.bevel.readableDepthIn : requested;
}

/** Only door and drawer fronts. Anything else is a flat finished surface. */
export function raisedPanelFaceRoleAllowed(role: string | null | undefined): role is RaisedPanelFrontRole {
  return role === "door" || role === "drawer";
}

export type RaisedPanelSelection =
  | {
      adopted: true;
      entryId: string;
      role: RaisedPanelFrontRole | null;
      /** Solid color when the finish is paint; null when the wood grain stays. */
      paintedSolidHex: string | null;
      painted: boolean;
      /** Null for paint: no photo and no grain on a painted face. */
      grainUrl: null;
      railIn: number;
      stileIn: number;
      bevelWidthIn: number;
      bevelDepthIn: number;
      insideEdgeProfile: string;
      reason: string;
    }
  | {
      adopted: false;
      /** "wizard" means the wizard's own profile won; the others are not raised. */
      reason: "wizard" | "not-raised" | "not-a-front";
      detail: string;
    };

export type RaisedPanelSelectionOptions = {
  /** True when the WalzCraft wizard produced a profile for this style. */
  wizardProfile?: boolean;
  /** The face being built. Null means "unplaced" and is allowed for a library lookup. */
  faceRole?: string | null;
};

/**
 * The single selection point for a raised-panel face.
 *
 * `wizardProfile` wins: a style the wizard dressed keeps the profile it was
 * saved with, so the entry is only the default for styles the wizard never saw.
 */
export function selectRaisedPanelBlueprint(
  style: RaisedPanelStyleInput | null | undefined,
  options: RaisedPanelSelectionOptions = {},
): RaisedPanelSelection {
  if (!isRaisedPanelStyle(style)) {
    return { adopted: false, reason: "not-raised", detail: "Door style text and construction are not raised panel." };
  }
  if (options.wizardProfile) {
    return {
      adopted: false,
      reason: "wizard",
      detail: "The WalzCraft wizard saved a profile for this style, so the wizard profile wins.",
    };
  }
  const role = options.faceRole ?? null;
  if (role != null && !raisedPanelFaceRoleAllowed(role)) {
    return {
      adopted: false,
      reason: "not-a-front",
      detail: `The raised panel builds on door and drawer fronts only; "${role}" stays a flat finished surface.`,
    };
  }

  const painted = isPaintedFinish(style);
  const decision = resolveDoorColor(style);
  const railIn = parsedInches(style?.railWidth) ?? RAISED_PANEL_BLUEPRINT.frame.railIn;
  const stileIn = parsedInches(style?.stileWidth) ?? RAISED_PANEL_BLUEPRINT.frame.stileIn;
  const bevelWidthIn = parsedInches(style?.bevelWidth) ?? RAISED_PANEL_BLUEPRINT.bevel.widthIn;
  const bevelDepthIn = parsedInches(style?.bevelDepth) ?? RAISED_PANEL_BLUEPRINT.bevel.depthIn;
  return {
    adopted: true,
    entryId: RAISED_PANEL_BLUEPRINT_ID,
    role,
    painted,
    paintedSolidHex: painted ? decision.appliedHex : null,
    grainUrl: null,
    railIn,
    stileIn,
    bevelWidthIn,
    bevelDepthIn,
    insideEdgeProfile: (style?.insideEdgeProfile ?? "").trim() || "bevel",
    reason: painted
      ? `Raised panel with a painted finish: solid ${decision.appliedHex} (${decision.appliedSource}), no grain or photo.`
      : `Raised panel with a wood finish: frame and bevel in ${decision.appliedHex} (${decision.appliedSource}); grain is kept.`,
  };
}

/**
 * Where the raised-panel entry sits for one style.
 *
 * - `wizard`: the WalzCraft wizard produced the profile, so the library entry does
 *   not describe this face and must not be applied over it.
 * - `library`: no wizard profile. The library entry is the default for a raised
 *   style, so the renderer builds exactly the face it builds today.
 * - `none`: not raised; nothing to apply.
 */
export type RaisedPanelApplicationSource = "wizard" | "library" | "none";

export type RaisedPanelApplication = {
  source: RaisedPanelApplicationSource;
  /** True when this library entry owns the profile for the style. */
  applied: boolean;
  reason: string;
};

/**
 * Default-application rule (Tom, Nov 4 2026): a raised style that never went
 * through the WalzCraft wizard gets this library profile automatically. A style
 * the wizard dressed keeps the wizard's profile.
 *
 * The role gate is separate and always the same: whichever profile is in force,
 * the raised geometry belongs on door and drawer fronts only. Use
 * `isRaisedPanelFrontSurface` for that.
 */
export function raisedPanelApplicationForStyle(
  style: RaisedPanelStyleInput | null | undefined,
  options: { wizardProfile?: boolean } = {},
): RaisedPanelApplication {
  if (!isRaisedPanelStyle(style)) {
    return { source: "none", applied: false, reason: "Not a raised-panel door style." };
  }
  if (options.wizardProfile) {
    return {
      source: "wizard",
      applied: false,
      reason: "The WalzCraft wizard produced this profile, so the wizard profile is used and the library entry is not applied.",
    };
  }
  return {
    source: "library",
    applied: true,
    reason: `Raised style with no WalzCraft profile: the ${RAISED_PANEL_BLUEPRINT_ID} library entry is the default on door and drawer fronts only.`,
  };
}

/** Role gate for the renderer: true only for door and drawer fronts. */
export function isRaisedPanelFrontSurface(role: string | null | undefined): boolean {
  return raisedPanelFaceRoleAllowed(role);
}
