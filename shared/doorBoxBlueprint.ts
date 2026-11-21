/**
 * Door box blueprint: the box/frame geometry of one door front, in inches, for the
 * admin "Door Box Blueprint" screen (Tom, voice, Nov 21 2026, 11:59 AM CT and 12:00 PM CT).
 *
 * Two references live here, both read from the same sources the 3D Designer uses:
 *
 * 1. DL shaker door box. DL_SHAKER_FIRM_RULE: every shaker door uses the DL shaker
 *    style. Five pieces: two full-width rails (top, bottom), two stiles between them,
 *    one flat recessed center slab. Square corners, shared notch. The frame width is
 *    the style's own 2.75 or 3 inches (3 is the Designer default,
 *    `STANDARD_SHAKER_RAIL_IN`), reduced only when the face is too small to keep an
 *    opening, exactly like `threeDShakerRailThickness` in client/src/lib/shakerRail.ts.
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
import { DL_SHAKER_FIRM_RULE, DL_SHAKER_GEOMETRY, STANDARD_SHAKER_RAIL_IN } from "./shakerDoorBlueprint";

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
  id: "top-rail" | "bottom-rail" | "left-stile" | "right-stile" | "center-panel" | "slab";
  label: string;
  /** Left edge, from the door's left edge, inches. */
  xIn: number;
  /** Bottom edge, from the door's bottom edge, inches. */
  yIn: number;
  widthIn: number;
  heightIn: number;
  /** Front-to-back thickness of this piece, inches. */
  depthIn: number;
};

export type DoorBoxBlueprint = {
  kind: "dl-shaker" | "slab";
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
  center: "flat-slab" | "none";
  notes: string[];
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Same clamp as `threeDShakerRailThickness` (client/src/lib/shakerRail.ts), in inches:
 * the requested width, otherwise 3 in, never more than half the face less 0.01 ft.
 */
export function dlShakerFrameIn(widthIn: number, heightIn: number, requestedIn?: number | null): number {
  const requested = Number(requestedIn);
  const thickness = Number.isFinite(requested) && requested > 0 ? requested : STANDARD_SHAKER_RAIL_IN;
  const margin = 0.01 * FT_TO_IN;
  return Math.max(0, Math.min(thickness, widthIn / 2 - margin, heightIn / 2 - margin));
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
