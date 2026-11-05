/**
 * Mini door preview for the AI description comparison.
 *
 * Draws one door front from parsed parameters, using the same proportions the
 * renderer's blueprints use:
 *
 * - `raisedPanelFrameGeometry` from `shared/raisedPanelDoorBlueprint.ts` supplies
 *   the frame widths, bevel width/depth, and raised-center inset.
 * - The shaker entry uses the same frame arithmetic with a flat center slab.
 * - A painted finish paints a solid face; a stained one gets the grain lines.
 *
 * Door and drawer fronts only: this component draws a front, never a cabinet side
 * or end.
 */
import { raisedPanelFrameGeometry, RAISED_PANEL_BLUEPRINT_ID } from "@shared/raisedPanelDoorBlueprint";
import { DOOR_LIBRARY_ENTRY_IDS } from "@shared/doorLibraryProfiles";
import { USCD_FRAMED_FAMILIES, type UscdFramedFamily } from "@shared/uscdFramedFamilies";
import { resolveDoorColor } from "@shared/doorColorResolve";
import type { AiDoorProfileParams } from "@shared/aiDoorDescription";

/** The door proportions the preview draws, in inches. A standard 15 in x 30 in front. */
export const AI_DOOR_PREVIEW_FACE = { widthIn: 15, heightIn: 30 } as const;

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 200;

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [200, 200, 200];
  const raw = match[1]!;
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function shift(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const delta = amount < 0 ? amount * 255 : amount * (255 - 0) * 0.35;
  return toHex([r + delta, g + delta, b + delta]);
}

/**
 * The face color the preview paints.
 *
 * The color always comes from `resolveDoorColor`, which puts an accepted render
 * first and never snaps to the brand palette. A description's own color text is
 * shown beside the preview as text; it is never converted to a hex here.
 */
export function previewFaceHex(base: Parameters<typeof resolveDoorColor>[0] | null | undefined): string {
  if (!base) return "#e9e4d6";
  return resolveDoorColor(base).appliedHex;
}

export type AiDoorPreviewGeometry = {
  /** Frame width on each edge, in view units. */
  frame: number;
  /** Opening inside the frame. */
  opening: { x: number; y: number; width: number; height: number };
  /** Raised center panel, when the description says raised. */
  raisedCenter: { x: number; y: number; width: number; height: number } | null;
  /** Sloped bevel band between opening and center, when the description says raised. */
  bevelBand: number;
  /** True when the preview draws a plain slab front. */
  slab: boolean;
  /** True when the preview draws grain lines. */
  grain: boolean;
};

/**
 * Geometry for one preview.
 *
 * Frame width, bevel width, and the raised-center inset come from the shipped
 * blueprint's own arithmetic, scaled from inches to view units. An unstated
 * dimension therefore draws at the library default exactly as the 3D renderer
 * would, and the caller lists it as unstated beside the preview.
 */
export function aiDoorPreviewGeometry(params: AiDoorProfileParams): AiDoorPreviewGeometry {
  const faceWidthFt = AI_DOOR_PREVIEW_FACE.widthIn / 12;
  const faceHeightFt = AI_DOOR_PREVIEW_FACE.heightIn / 12;
  // A documented USCD family sets its own center panel even when the pasted text
  // said nothing; the family entry is the authority there.
  const uscd = uscdFramedFamilyById(params.entryId);
  const shipped = raisedPanelFrameGeometry({
    faceWidth: faceWidthFt,
    faceHeight: faceHeightFt,
    railIn: params.railIn,
    stileIn: params.stileIn,
    bevelWidthIn: params.bevelWidthIn,
    bevelDepthIn: params.bevelDepthIn,
    insideEdgeProfile: params.insideEdgeProfile,
  });

  // Scene feet → view units, using the face box so proportions are preserved.
  const perFootX = VIEW_WIDTH / faceWidthFt;
  const perFootY = VIEW_HEIGHT / faceHeightFt;
  const slab = params.family === "slab";
  const frame = slab ? 0 : Math.max(2, (shipped.stile * perFootX + shipped.rail * perFootY) / 2);

  const openingX = slab ? 4 : frame;
  const openingY = slab ? 4 : frame;
  const openingWidth = VIEW_WIDTH - openingX * 2;
  const openingHeight = VIEW_HEIGHT - openingY * 2;

  const raised = uscd
    ? uscd.centerPanel === "raised"
    : params.panelConstruction === "raised" || params.family === "raised-panel";
  const bevelBand = raised ? Math.max(3, Math.min(12, shipped.slopeBevelWidth * perFootX)) : 0;

  return {
    frame,
    opening: { x: openingX, y: openingY, width: openingWidth, height: openingHeight },
    raisedCenter: raised
      ? {
        x: openingX + bevelBand,
        y: openingY + bevelBand,
        width: Math.max(4, openingWidth - bevelBand * 2),
        height: Math.max(4, openingHeight - bevelBand * 2),
      }
      : null,
    bevelBand,
    slab,
    // Paint is opaque with no grain; stain shows grain. An unstated finish keeps
    // the library's own rule rather than inventing one.
    grain: params.painted === false || (params.painted == null && params.family !== "slab" && params.grainDirection != null),
  };
}

/** Which library entry the preview draws with, for the caption. */
export function aiDoorPreviewEntryLabel(params: AiDoorProfileParams): string {
  const uscd = uscdFramedFamilyById(params.entryId);
  if (uscd) return `US Cabinet Depot ${uscd.name} library entry (${uscd.citation})`;
  if (params.entryId === RAISED_PANEL_BLUEPRINT_ID) return "raised-panel library entry";
  if (params.entryId === DOOR_LIBRARY_ENTRY_IDS.shaker) return "shaker library entry";
  if (params.family === "slab") return "slab front (no library entry)";
  return "no library entry (family not stated)";
}

/** The USCD framed family an entry id names, when it names one. */
export function uscdFramedFamilyById(entryId: string | null | undefined): UscdFramedFamily | null {
  if (!entryId) return null;
  return USCD_FRAMED_FAMILIES.find((family) => family.id === entryId) ?? null;
}
