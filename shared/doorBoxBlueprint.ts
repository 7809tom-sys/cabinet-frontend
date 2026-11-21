/**
 * Door box blueprint: the box/frame geometry of one door front, in inches, for the
 * admin "Door Box Blueprint" screen (Tom, voice, Nov 21 2026, 11:59 AM CT and 12:00 PM CT).
 *
 * Two references live here, both read from the same sources the 3D Designer uses:
 *
 * 1. DL shaker door box. DL_SHAKER_FIRM_RULE: every shaker door uses the DL shaker
 *    style. Five pieces: two full-width rails (top, bottom), two stiles between them,
 *    one flat recessed center slab. Square corners, shared notch. The frame width is
 *    a fixed 2.75 inches on a regular shaker door, and min(2.75, 25% of the face width)
 *    on a skinny door (face under 12 in wide), from shared/shakerFrameRule.ts, exactly
 *    like `threeDShakerRailThickness` in client/src/lib/shakerRail.ts.
 *    Rail depth is `DLC_FRAME_DETAIL.railDepth` (shared/dlcFr26Textures.ts). A front
 *    under 7 inches tall or wide is a plain slab (Tom, Nov 1 2026).
 *
 * 2. Canonical slab door reference. A slab front has NO library entry:
 *    `libraryEntriesForStyle` in shared/doorLibraryProfiles.ts returns [] for any style
 *    `doorProfileIsSlabOrGlass` (shared/doorProfileIdentity.ts) calls slab, and the
 *    Designer then draws one flat box of the full face size. That flat box is the
 *    slab reference the library falls back to every time. Its thickness is the
 *    0.045 ft door slab front used by the 3D Designer
 *    (client/src/components/design/InteractiveRoom3D.tsx: "Door slab front is at half
 *    its 0.045 ft thickness"). Mirrored here as `DESIGNER_SLAB_FRONT_THICKNESS_FT`
 *    (a test reads that source so the two cannot drift). A solid-color slab renders
 *    flat with no photo (`isSolidSlabFace`, shared/solidSlabFace.ts); a wood slab keeps
 *    a grain tile (`slabGrainColorPlan`, shared/slabGrainApply.ts).
 *
 * Pure numbers, no three.js, so the admin screen and tests can share it.
 */
import { DLC_FRAME_DETAIL } from "./dlcFr26Textures";
import { DL_SHAKER_FIRM_RULE, DL_SHAKER_GEOMETRY } from "./shakerDoorBlueprint";
import { shakerFrameWidthIn } from "./shakerFrameRule";
import { RAISED_PANEL_BLUEPRINT, raisedPanelFrameGeometry } from "./raisedPanelDoorBlueprint";

export { DL_SHAKER_FIRM_RULE };

/** Scene units are feet; one inch is 1/12. */
const FT_TO_IN = 12;

/** A shaker front shorter or narrower than this renders as a plain slab (Tom, Nov 1 2026). */
export const DL_SHAKER_SLAB_BELOW_IN = 7;

/** Thickness of the Designer's flat door slab front, in feet (InteractiveRoom3D.tsx). */
export const DESIGNER_SLAB_FRONT_THICKNESS_FT = 0.045;

/** Where the slab reference comes from, named on the admin screen. */
export const SLAB_REFERENCE_SOURCES = {
  classifier: "shared/doorProfileIdentity.ts → doorProfileIsSlabOrGlass",
  library: "shared/doorLibraryProfiles.ts → libraryEntriesForStyle (returns no entry for a slab: plain flat panel)",
  solidColor: "shared/solidSlabFace.ts → isSolidSlabFace",
  woodGrain: "shared/slabGrainApply.ts → slabGrainColorPlan",
  thickness: "client/src/components/design/InteractiveRoom3D.tsx → 0.045 ft door slab front",
} as const;

export const DL_SHAKER_REFERENCE_SOURCES = {
  faceBuilder: "shared/shakerDoorBlueprint.ts → standardShakerDlFacePlan",
  libraryEntry: "shared/doorLibraryProfiles.ts → DOOR_LIBRARY_ENTRY_IDS.shaker (dl-shaker-frame)",
  railWidth: "client/src/lib/shakerRail.ts → threeDShakerRailThickness",
  railDepth: "shared/dlcFr26Textures.ts → DLC_FRAME_DETAIL.railDepth",
} as const;

export type DoorBoxPiece = {
  id: "top-rail" | "bottom-rail" | "left-stile" | "right-stile" | "center-panel" | "slab" | "groove" | "bevel" | "raised-panel";
  label: string;
  /** Left edge, from the door's left edge, inches. */
  xIn: number;
  /** Bottom edge, from the door's bottom edge, inches. */
  yIn: number;
  widthIn: number;
  heightIn: number;
  /** Front-to-back thickness of this piece, inches. */
  depthIn: number;
  /**
   * Center of this piece front-to-back, inches, relative to the frame's center
   * (positive is toward the viewer). Only the raised panel and slim shaker pieces
   * set it; the original DL shaker and slab pieces leave it unset.
   */
  zIn?: number;
};

export type DoorBoxBlueprint = {
  kind: "dl-shaker" | "slab" | "slim-shaker" | "raised-panel";
  widthIn: number;
  heightIn: number;
  /** Thickest piece, front to back, inches. */
  depthIn: number;
  /** Frame (rail and stile) width actually used, inches. 0 for a slab. */
  frameIn: number;
  /** True when a requested shaker was too small and fell to the plain slab rule. */
  smallFrontSlab: boolean;
  pieces: DoorBoxPiece[];
  corners: "square";
  center: "flat-slab" | "none" | "raised";
  notes: string[];
  /** Values not found in repo data or dlcabinetry.com. Shown as "TBD - confirm with Tom". */
  tbd?: string[];
  /** Values read from dlcabinetry.com's own published pages, with the page. */
  published?: string[];
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Same rule as `threeDShakerRailThickness` (client/src/lib/shakerRail.ts), in inches,
 * from shared/shakerFrameRule.ts: a regular shaker door is a fixed 2.75 in frame; a
 * skinny door (face under 12 in wide, confirm with Tom) is min(2.75, 25% of the face).
 */
export function dlShakerFrameIn(widthIn: number, heightIn: number, requestedIn?: number | null): number {
  return shakerFrameWidthIn(widthIn, heightIn, requestedIn);
}

/** Plain slab door box: one flat piece the size of the face. */
export function slabDoorBox(widthIn: number, heightIn: number, notes: string[] = []): DoorBoxBlueprint {
  const depthIn = round(DESIGNER_SLAB_FRONT_THICKNESS_FT * FT_TO_IN);
  return {
    kind: "slab",
    widthIn,
    heightIn,
    depthIn,
    frameIn: 0,
    smallFrontSlab: false,
    pieces: [{ id: "slab", label: "Slab", xIn: 0, yIn: 0, widthIn, heightIn, depthIn }],
    corners: "square",
    center: "none",
    notes: [
      "Canonical slab reference: one flat panel, square edges, no rails, stiles, or center panel.",
      `Thickness ${depthIn} in (${DESIGNER_SLAB_FRONT_THICKNESS_FT} ft, the Designer's door slab front).`,
      ...notes,
    ],
  };
}

/**
 * DL shaker door box for a face of `widthIn` × `heightIn`. `railIn` is the style's
 * own rail width (2.75 or 3); omitted means the 3 inch Designer default.
 */
export function dlShakerDoorBox(widthIn: number, heightIn: number, railIn?: number | null): DoorBoxBlueprint {
  if (heightIn < DL_SHAKER_SLAB_BELOW_IN || widthIn < DL_SHAKER_SLAB_BELOW_IN) {
    const slab = slabDoorBox(widthIn, heightIn, [
      `Under ${DL_SHAKER_SLAB_BELOW_IN} in tall or wide: a small front renders as a plain slab, not a shaker frame.`,
    ]);
    return { ...slab, smallFrontSlab: true };
  }
  const frameIn = round(dlShakerFrameIn(widthIn, heightIn, railIn));
  const railDepthIn = round(DLC_FRAME_DETAIL.railDepth * FT_TO_IN);
  // Center slab sits behind the rails, 0.012 ft thick like the Designer's DL center.
  const panelDepthIn = round(0.012 * FT_TO_IN);
  const innerHeight = round(heightIn - frameIn * 2);
  const innerWidth = round(widthIn - frameIn * 2);
  const pieces: DoorBoxPiece[] = [
    { id: "top-rail", label: "Top rail", xIn: 0, yIn: round(heightIn - frameIn), widthIn, heightIn: frameIn, depthIn: railDepthIn },
    { id: "bottom-rail", label: "Bottom rail", xIn: 0, yIn: 0, widthIn, heightIn: frameIn, depthIn: railDepthIn },
    { id: "left-stile", label: "Left stile", xIn: 0, yIn: frameIn, widthIn: frameIn, heightIn: innerHeight, depthIn: railDepthIn },
    { id: "right-stile", label: "Right stile", xIn: round(widthIn - frameIn), yIn: frameIn, widthIn: frameIn, heightIn: innerHeight, depthIn: railDepthIn },
    { id: "center-panel", label: "Center panel (flat slab)", xIn: frameIn, yIn: frameIn, widthIn: innerWidth, heightIn: innerHeight, depthIn: panelDepthIn },
  ];
  return {
    kind: "dl-shaker",
    widthIn,
    heightIn,
    depthIn: railDepthIn,
    frameIn,
    smallFrontSlab: false,
    pieces,
    corners: DL_SHAKER_GEOMETRY.corners,
    center: DL_SHAKER_GEOMETRY.center,
    notes: [
      DL_SHAKER_FIRM_RULE,
      "Five pieces: full-width top and bottom rails, stiles between them, flat recessed center slab.",
      `Rail/stile width ${frameIn} in; rail depth ${railDepthIn} in (DLC_FRAME_DETAIL.railDepth).`,
      "Square corners and the shared four-sided shaker notch. Only color/texture varies per style.",
    ],
  };
}

// ─── Raised panel and slim shaker (Tom, voice, Nov 21 2026, 1:11 PM CT) ──────────

/** Shown for any dimension not found in repo data or on dlcabinetry.com. */
export const TBD_CONFIRM_WITH_TOM = "TBD - confirm with Tom" as const;

/**
 * Door thickness DL Cabinetry publishes: "SAMPLE DOOR 12\" 15\" 3/4\"" and the
 * Base/Wall Decorative Doors at 3/4" depth in DL's Specification Book (v.11/14/23),
 * linked from https://www.dlcabinetry.com/resources. Applies to every DL door style.
 */
export const DL_PUBLISHED_DOOR_THICKNESS_IN = 0.75;
export const DL_SPEC_BOOK_URL = "https://www.dlcabinetry.com/_files/ugd/bd0079_982d3ca8295d49f6b917c3f814615612.pdf";
export const DL_DESIGN_CATALOG_URL = "https://www.dlcabinetry.com/_files/ugd/036bd4_caff82d300cd449486cc5afb99b22631.pdf";

/**
 * Slim Shaker rail and stile, inches. Same value as `SLIM_SHAKER_FRAME_INCHES` in
 * client/src/lib/doorFrameMetrics.ts ("All CabinetDealz Slim Shaker styles use a
 * one-inch rail and stile") and `SLIM_SHAKER_FACE_FRAME_INCHES` in
 * client/src/lib/elevationFrameGeometry.ts. A test keeps them equal.
 * dlcabinetry.com describes Slim Shaker only as "ultra-narrow stiles and rails"
 * with no number, so DL's own published width is TBD.
 */
export const SLIM_SHAKER_FRAME_IN = 1;

export const SLIM_SHAKER_REFERENCE_SOURCES = {
  frameWidth: "client/src/lib/doorFrameMetrics.ts → SLIM_SHAKER_FRAME_INCHES (1 in)",
  elevation: "client/src/lib/elevationFrameGeometry.ts → SLIM_SHAKER_FACE_FRAME_INCHES (1 in)",
  railDepth: "shared/dlcFr26Textures.ts → DLC_FRAME_DETAIL.railDepth (Slim Shaker Alabaster/Ebony are DL finishes in dlcFr26Catalog)",
  family: "shared/shakerDoorBlueprint.ts → shakerDoorFamily (slim-shaker keeps its own frame)",
  dlPublished: `${DL_SPEC_BOOK_URL} (door thickness 3/4 in); ${DL_DESIGN_CATALOG_URL} p.32 ("ultra-narrow stiles and rails")`,
} as const;

export const RAISED_PANEL_REFERENCE_SOURCES = {
  geometry: "shared/raisedPanelDoorBlueprint.ts → raisedPanelFrameGeometry / RAISED_PANEL_BLUEPRINT",
  renderer: "client/src/components/design/raisedPanelBevel.ts → attachSlopedRaisedPanel",
  railDepth: "shared/raisedPanelDoorBlueprint.ts → RAISED_PANEL_BLUEPRINT.frame.dlcRailDepthFt (DL frame)",
  dlPublished: `${DL_SPEC_BOOK_URL} (door thickness 3/4 in); ${DL_DESIGN_CATALOG_URL} p.25 (Glacier White, "The Perfect Transitional Raised Panel")`,
} as const;

function framePieces(widthIn: number, heightIn: number, frameIn: number, depthIn: number): DoorBoxPiece[] {
  const innerHeight = round(heightIn - frameIn * 2);
  return [
    { id: "top-rail", label: "Top rail", xIn: 0, yIn: round(heightIn - frameIn), widthIn, heightIn: frameIn, depthIn, zIn: 0 },
    { id: "bottom-rail", label: "Bottom rail", xIn: 0, yIn: 0, widthIn, heightIn: frameIn, depthIn, zIn: 0 },
    { id: "left-stile", label: "Left stile", xIn: 0, yIn: frameIn, widthIn: frameIn, heightIn: innerHeight, depthIn, zIn: 0 },
    { id: "right-stile", label: "Right stile", xIn: round(widthIn - frameIn), yIn: frameIn, widthIn: frameIn, heightIn: innerHeight, depthIn, zIn: 0 },
  ];
}

/**
 * DL Slim Shaker door box: the same five-piece build as the DL shaker (full-width
 * rails, stiles between, flat recessed center slab) with the 1 inch slim frame.
 * The 7 inch small-front slab rule belongs to the 2.75/3 inch frame and is not
 * applied; the frame only clamps so the opening never closes.
 */
export function slimShakerDoorBox(widthIn: number, heightIn: number): DoorBoxBlueprint {
  const frameIn = round(dlShakerFrameIn(widthIn, heightIn, SLIM_SHAKER_FRAME_IN));
  const railDepthIn = round(DLC_FRAME_DETAIL.railDepth * FT_TO_IN);
  const panelDepthIn = round(0.012 * FT_TO_IN);
  const pieces: DoorBoxPiece[] = [
    ...framePieces(widthIn, heightIn, frameIn, railDepthIn),
    {
      id: "center-panel",
      label: "Center panel (flat slab)",
      xIn: frameIn,
      yIn: frameIn,
      widthIn: round(widthIn - frameIn * 2),
      heightIn: round(heightIn - frameIn * 2),
      depthIn: panelDepthIn,
      zIn: round(-(railDepthIn - panelDepthIn) / 2),
    },
  ];
  return {
    kind: "slim-shaker",
    widthIn,
    heightIn,
    depthIn: railDepthIn,
    frameIn,
    smallFrontSlab: false,
    pieces,
    corners: "square",
    center: "flat-slab",
    notes: [
      "DL Slim Shaker (Slim Shaker Alabaster SSA, Slim Shaker Ebony SSE): five pieces, full-width rails, stiles between, flat recessed center slab.",
      `Rail/stile width ${frameIn} in (repo rule: every Slim Shaker uses a 1 in rail and stile); rail depth ${railDepthIn} in (DL frame depth).`,
      `DL publishes a ${DL_PUBLISHED_DOOR_THICKNESS_IN} in door thickness (Specification Book). The Designer's scene depth above is its drawn rail depth, not the physical door.`,
      "Slim Shaker is not the 2.75/3 in DL shaker template; it keeps its own frame.",
    ],
    published: [
      `Door thickness ${DL_PUBLISHED_DOOR_THICKNESS_IN} in — DL Specification Book v.11/14/23 (Sample Door 12 × 15 × 3/4 in).`,
      "Ultra-narrow stiles and rails, framed construction — DL design catalog p.32, Slim Shaker Alabaster.",
    ],
    tbd: [
      `DL's own published Slim Shaker rail/stile width: ${TBD_CONFIRM_WITH_TOM} (dlcabinetry.com gives no number; the 1 in shown is the repo rule).`,
      `Center panel recess depth on the physical DL door: ${TBD_CONFIRM_WITH_TOM}.`,
      `Smallest front that keeps the slim frame before it becomes a slab: ${TBD_CONFIRM_WITH_TOM}.`,
    ],
  };
}

/**
 * DL raised panel door box, from `raisedPanelFrameGeometry` (the numbers the 3D
 * Designer renders): square-butt five-piece frame, a groove, a sloped bevel, and a
 * raised center panel. DL frame depth, because DL raised finishes are DL frames.
 */
export function raisedPanelDoorBox(widthIn: number, heightIn: number): DoorBoxBlueprint {
  const g = raisedPanelFrameGeometry({ faceWidth: widthIn / FT_TO_IN, faceHeight: heightIn / FT_TO_IN, dlcFrame: true });
  const frameIn = round(g.rail * FT_TO_IN);
  const stileIn = round(g.stile * FT_TO_IN);
  const railDepthIn = round(g.railDepth * FT_TO_IN);
  const openingW = round(g.openingWidth * FT_TO_IN);
  const openingH = round(g.openingHeight * FT_TO_IN);
  const grooveIn = round(g.groove * FT_TO_IN);
  const slopeW = round(g.slopeOuterWidth * FT_TO_IN);
  const slopeH = round(g.slopeOuterHeight * FT_TO_IN);
  const bevelWidthIn = round(g.slopeBevelWidth * FT_TO_IN);
  const bevelDepthIn = round(g.bevelDepth * FT_TO_IN);
  const panelW = round(g.panelWidth * FT_TO_IN);
  const panelH = round(g.panelHeight * FT_TO_IN);
  const panelThicknessIn = round(g.panelThickness * FT_TO_IN);
  const innerHeight = round(heightIn - frameIn * 2);
  // Front-to-back, relative to the frame center, exactly as the renderer stacks it.
  // Renderer local z of the DL rail center: (railDepth - standardRailDepth) / 2.
  const railCenterZIn = ((g.railDepth - DLC_FRAME_DETAIL.standardRailDepth) / 2) * FT_TO_IN;
  const bedZ = round(g.recessBedZ * FT_TO_IN - railCenterZIn);
  const panelZ = round(g.panelZ * FT_TO_IN - railCenterZIn);
  const bevelZ = round(g.bevelZ * FT_TO_IN + bevelDepthIn / 2 - railCenterZIn);
  const pieces: DoorBoxPiece[] = [
    { id: "top-rail", label: "Top rail", xIn: 0, yIn: round(heightIn - frameIn), widthIn, heightIn: frameIn, depthIn: railDepthIn, zIn: 0 },
    { id: "bottom-rail", label: "Bottom rail", xIn: 0, yIn: 0, widthIn, heightIn: frameIn, depthIn: railDepthIn, zIn: 0 },
    { id: "left-stile", label: "Left stile", xIn: 0, yIn: frameIn, widthIn: stileIn, heightIn: innerHeight, depthIn: railDepthIn, zIn: 0 },
    { id: "right-stile", label: "Right stile", xIn: round(widthIn - stileIn), yIn: frameIn, widthIn: stileIn, heightIn: innerHeight, depthIn: railDepthIn, zIn: 0 },
    { id: "groove", label: `Groove (${grooveIn} in) and recessed bed`, xIn: stileIn, yIn: frameIn, widthIn: openingW, heightIn: openingH, depthIn: round(g.recessBedThickness * FT_TO_IN), zIn: bedZ },
    { id: "bevel", label: `Sloped bevel (${bevelWidthIn} in wide, ${bevelDepthIn} in raise)`, xIn: round(stileIn + grooveIn), yIn: round(frameIn + grooveIn), widthIn: slopeW, heightIn: slopeH, depthIn: bevelDepthIn, zIn: bevelZ },
    { id: "raised-panel", label: "Raised center panel", xIn: round(stileIn + grooveIn + bevelWidthIn), yIn: round(frameIn + grooveIn + bevelWidthIn), widthIn: panelW, heightIn: panelH, depthIn: panelThicknessIn, zIn: panelZ },
  ];
  const bp = RAISED_PANEL_BLUEPRINT;
  return {
    kind: "raised-panel",
    widthIn,
    heightIn,
    depthIn: railDepthIn,
    frameIn,
    smallFrontSlab: false,
    pieces,
    corners: "square",
    center: "raised",
    notes: [
      "DL raised panel (Glacier White GW): five-piece frame with full-width rails and stiles between, a groove, a sloped bevel, and a raised center panel.",
      `Rail/stile ${frameIn} in (Designer default ${bp.frame.railIn} in); rail depth ${railDepthIn} in (DL frame depth).`,
      `Bevel ${bevelWidthIn} in wide (stored ${bp.bevel.widthIn} in); raise ${bevelDepthIn} in (stored ${bp.bevel.depthIn} in, lifted to the readable ${bp.bevel.readableDepthIn} in); groove ${grooveIn} in; center panel ${panelThicknessIn} in thick.`,
      `DL publishes a ${DL_PUBLISHED_DOOR_THICKNESS_IN} in door thickness (Specification Book). The Designer's scene depths above are drawn values, not the physical door.`,
    ],
    published: [
      `Door thickness ${DL_PUBLISHED_DOOR_THICKNESS_IN} in — DL Specification Book v.11/14/23 (Sample Door 12 × 15 × 3/4 in).`,
      "Glacier White is \"The Perfect Transitional Raised Panel\" — DL design catalog p.25.",
    ],
    tbd: [
      `DL's own published raised panel rail/stile width: ${TBD_CONFIRM_WITH_TOM} (the ${bp.frame.railIn} in shown is the Designer default).`,
      `DL's physical raise depth and bevel width: ${TBD_CONFIRM_WITH_TOM} (shown values are the Designer's rendered bevel).`,
      `Panel edge profile (cove/ogee molding stack) and mitered vs square-butt corners: ${TBD_CONFIRM_WITH_TOM} (the Designer draws square-butt with one flat bevel).`,
    ],
  };
}
