import { CLOSET_PARTS, masterTracProduct, type MasterTracProduct } from "./closet";
import { towerStorageSkuReferences } from "./masterTracTower";

export type StudioMode = "closet" | "pantry" | "mudroom" | "kids";
export type StudioMount = "floor" | "hanging";
export type StudioWall = "back" | "left" | "right" | "front";
export type StudioKind = "shelf" | "rod" | "drawer" | "shoe";
export type StudioReferenceKind = StudioKind | "fixedShelf";
/** New v2 records retain their physical wall identity; it is optional only while v1 drafts are migrated on restore. */
export type StudioItem = { id: string; kind: StudioKind; bottomIn: number; wallId?: StudioWall };
export type StudioCornerId = "back-left" | "back-right" | "front-left" | "front-right";
export type StudioCornerShelfMount = "fixed" | "adjustable";
/** A planning-only record: the source does not yet provide the board profile, support layout, or installation connection details. */
export type StudioCornerShelf = {
  id: string;
  sku: string;
  finish: StudioDesign["finish"];
  mount: StudioCornerShelfMount;
  profile: "curved-illustrative";
  cornerId: StudioCornerId;
  wallIds: [StudioWall, StudioWall];
  elevationIn: number;
  nominalFootprintIn: number;
  geometryRevision: string;
  geometrySource: "MasterTrac Spec Book NP 2026 p. 13";
  /** The two tower runs meet the outside edges of the conservative envelope in the visual plan; this is not a supplier-certified physical connection. */
  towerConnection?: "visualAligned";
  capability: "visualPlanning";
};
/** A saved product-reference selection only: no bay, elevation, decorative mesh, collision envelope, material line, or installation claim is created. */
export type StudioBasketReference = {
  id: string;
  sku: string;
  finish: "Chrome";
  nominalHeightIn: 6 | 11 | 17;
  nominalWidthIn: 18 | 24 | 30;
  sourceRevision: "floor-579554-p13-historical-reference-v1";
  capability: "referenceOnly";
};
/** A source-identified basket visual envelope. The 14.5-in depth is the Studio board depth, not a published basket outer dimension, rail, slide, travel, or clearance. */
export type StudioBasketPlacement = {
  id: string;
  sku: string;
  finish: "Chrome";
  nominalHeightIn: 6 | 11 | 17;
  nominalWidthIn: 18 | 24 | 30;
  nominalDepthIn: 14.5;
  bottomIn: number;
  wallId: StudioWall;
  bayId: string;
  sourceRevision: "floor-579554-p13-historical-basket-visual-envelope-v1";
  capability: "visualPlanning";
};
/** `widthIn` is the measured installed clear width; `stockWidthIn` retains the purchased shelf SKU width when field-cut. */
/** New v2 tower groups retain their wall identity; it is optional only while v1 drafts are migrated on restore. */
export type StudioBay = { id: string; widthIn: number; stockWidthIn?: 18 | 24 | 30; wallId?: StudioWall; items: StudioItem[] };
export type StudioWallLayout = { wallId: StudioWall; bays: StudioBay[] };
export type StudioWallOccupancy = { wallId: StudioWall; usedSpanIn: number; availableSpanIn: number; bayCount: number; itemCount: number; cornerCount: number; filled: boolean };
export type StudioDesign = {
  version: 1 | 2 | 3;
  mode: StudioMode;
  mount: StudioMount;
  finish: "Glacier White" | "Slate Rift" | "Spiced Mahogany";
  wall: StudioWall;
  wallWidthIn: number;
  roomDepthIn: number;
  /** v2 canonical per-wall tower layout. `bays` remains the selected-wall render cache for legacy component compatibility. */
  wallLayouts?: Partial<Record<StudioWall, StudioWallLayout>>;
  bays: StudioBay[];
  cornerShelves?: StudioCornerShelf[];
  basketReferences?: StudioBasketReference[];
  basketPlacements?: StudioBasketPlacement[];
  /** Kids' closet only: the child the rod and reach guidance are planned around. Kept when the mode is switched away so switching back needs no re-entry. */
  kids?: { ageYears: number; heightIn: number };
  /** Finished ceiling height. Optional so older drafts restore; unset behaves as the 96 in default. */
  roomHeightIn?: number;
};
export type StudioShelfCut = { stockWidthIn: 18 | 24 | 30; installedWidthIn: number; offcutIn: number };
export type ReferenceLine = { sku: string; label: string; qty: number; unitUsd: number; section: "cleat" | "panel" | "shelf" | "accessory" | "hardware"; packNote?: string; stockWidthIn?: number; installedWidthIn?: number; offcutIn?: number };
export type StudioTakeoff = { lines: ReferenceLine[]; subtotalUsd: number; missing: string[] };

const THICKNESS = 0.75;
const WIDTHS = [18, 24, 30] as const;
const CUT_PLANNING_MIN_IN = 12;
const EPS = 0.000001;
const STUDIO_SHOE_SHELF_DEPTH_IN = 14.5;
const STUDIO_SHOE_FENCE_HEIGHT_IN = 0.16;
/** Conservative visual depth equals the source-backed Studio bay depth; it is not an asserted basket outer dimension. */
export const STUDIO_BASKET_VISUAL_DEPTH_IN = 14.5;
export const STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN = 29.5;
export const STUDIO_CORNER_SHELF_THICKNESS_IN = 0.75;
/** 2026 nominal envelope only. The 2022 floor manual lists 29¼ in actual but does not publish the curved profile. */
export const STUDIO_CORNER_SHELF_GEOMETRY_REVISION = "mastertrac-np-2026-p13-nominal-envelope-v1";
/** Public historical List identities for the 2026 29.5-inch visual-planning envelope in each available Studio finish. */
export const STUDIO_CORNER_SHELF_SKUS: Record<StudioDesign["finish"], Record<StudioCornerShelfMount, string>> = {
  "Glacier White": { fixed: "432556", adjustable: "432557" },
  "Spiced Mahogany": { fixed: "432786", adjustable: "432787" },
  "Slate Rift": { fixed: "430833", adjustable: "430834" },
};
export const studioCornerShelfSku = (finish: StudioDesign["finish"], mount: StudioCornerShelfMount) => STUDIO_CORNER_SHELF_SKUS[finish][mount];
export type StudioFitCapabilityStatus = "referenceOnly" | "visualPlanning" | "fitVerified";
export type StudioFitCapability = { sku: string; family: "cornerShelf" | "basket"; status: StudioFitCapabilityStatus; source: string; reason: string };
export type StudioBasketReferenceOption = { sku: string; nominalHeightIn: 6 | 11 | 17; nominalWidthIn: 18 | 24 | 30; finish: "Chrome"; sourceRevision: StudioBasketReference["sourceRevision"] };
/** Source version, geometry status, and missing-fit boundary. This is not a sales or installation registry. */
export const STUDIO_FIT_CAPABILITY_REGISTRY: readonly StudioFitCapability[] = [
  ...Object.values(STUDIO_CORNER_SHELF_SKUS).flatMap((variants) => Object.values(variants).map((sku) => ({ sku, family: "cornerShelf" as const, status: "visualPlanning" as const, source: "MasterTrac Spec Book NP 2026 p. 13", reason: "29.5 in nominal envelope accepted for visual planning; curved profile, supports, and connections remain unverified." }))),
  ...["432897", "432898", "432899", "432900", "432901", "432902", "432903", "432904", "432905"].map((sku) => ({ sku, family: "basket" as const, status: "visualPlanning" as const, source: "Floor Mount 579554 p. 13 / MasterTrac Spec Book NP 2026 p. 46", reason: "Visual envelope is limited to sourced nominal width/height and Studio bay depth; rails, mounting offsets, travel, doors, and clearances are not source-verified." })),
];
/**
 * The 2022 list records these baskets as Chrome only. The product type has no
 * liner color, swatch, or photo, so the fabric below is a solid placeholder,
 * not a catalog color. Chrome stays on the rim.
 */
export const STUDIO_BASKET_LINER_PLACEHOLDER_HEX = "#d7cfc3";
export const STUDIO_BASKET_FRAME_HEX = "#b4b9b7";
export function studioBasketSurface(sku: string): { fabricHex: string; frameHex: string; placeholder: true; reason: string } {
  const product = masterTracProduct(sku);
  return {
    fabricHex: STUDIO_BASKET_LINER_PLACEHOLDER_HEX,
    frameHex: STUDIO_BASKET_FRAME_HEX,
    placeholder: true,
    reason: product
      ? `${product.sku} (${product.description}) is listed as ${product.finish} and has no liner color or product photo, so the fabric is a solid neutral placeholder.`
      : "This basket has no catalog record, so the fabric is a solid neutral placeholder.",
  };
}
/** Historical 2022 basket identification only. The 2026 446807–446815 family is deliberately not substituted here. */
export const STUDIO_BASKET_REFERENCE_OPTIONS: readonly StudioBasketReferenceOption[] = [
  { sku: "432897", nominalHeightIn: 6, nominalWidthIn: 18, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432900", nominalHeightIn: 6, nominalWidthIn: 24, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432903", nominalHeightIn: 6, nominalWidthIn: 30, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432898", nominalHeightIn: 11, nominalWidthIn: 18, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432901", nominalHeightIn: 11, nominalWidthIn: 24, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432904", nominalHeightIn: 11, nominalWidthIn: 30, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432899", nominalHeightIn: 17, nominalWidthIn: 18, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432902", nominalHeightIn: 17, nominalWidthIn: 24, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
  { sku: "432905", nominalHeightIn: 17, nominalWidthIn: 30, finish: "Chrome", sourceRevision: "floor-579554-p13-historical-reference-v1" },
];
export const STUDIO_MODES: StudioMode[] = ["closet", "pantry", "mudroom", "kids"];
export const STUDIO_PART_KINDS: StudioKind[] = ["shelf", "rod", "drawer", "shoe"];
export const STUDIO_WALLS: StudioWall[] = ["back", "left", "right", "front"];
export const STUDIO_CORNER_IDS: StudioCornerId[] = ["back-left", "back-right", "front-left", "front-right"];
export const STUDIO_FINISHES: StudioDesign["finish"][] = ["Glacier White", "Slate Rift", "Spiced Mahogany"];
/** Owner-approved visual presentation only; the supplied catalog does not certify this pitch, attachment, or clearances. */
export const STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG = 45;
const STUDIO_ILLUSTRATIVE_SHOE_PITCH_RAD = STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG * Math.PI / 180;
/** Conservative rise for the 14.5-inch shoe board plus its illustrative fence, used only to keep the visual clear of adjacent parts. */
const STUDIO_ILLUSTRATIVE_SHOE_ENVELOPE_HEIGHT_IN = STUDIO_SHOE_SHELF_DEPTH_IN * Math.sin(STUDIO_ILLUSTRATIVE_SHOE_PITCH_RAD)
  + (THICKNESS + STUDIO_SHOE_FENCE_HEIGHT_IN) * Math.cos(STUDIO_ILLUSTRATIVE_SHOE_PITCH_RAD);
export const MODE_RECOMMENDATIONS: Record<StudioMode, StudioKind[]> = {
  closet: ["shelf", "rod", "shoe"], pantry: ["shelf", "drawer"], mudroom: ["shoe", "rod", "shelf"], kids: ["rod", "shelf", "drawer"],
};

const blankWallLayouts = (): Record<StudioWall, StudioWallLayout> => ({
  back: { wallId: "back", bays: [] }, left: { wallId: "left", bays: [] }, right: { wallId: "right", bays: [] }, front: { wallId: "front", bays: [] },
});
const withWallIdentity = (bays: StudioBay[], wallId: StudioWall): StudioBay[] => bays.map((bay) => ({ ...bay, wallId, items: bay.items.map((item) => ({ ...item, wallId })) }));
const hasWallLayouts = (design: StudioDesign) => Boolean(design.wallLayouts && STUDIO_WALLS.some((wall) => design.wallLayouts?.[wall]));

/** Return the canonical tower groups for a particular room wall; v1 remains readable only for its original selected wall until restore migrates it. */
export const studioBays = (design: StudioDesign, wall: StudioWall = design.wall): StudioBay[] => {
  if (wall === design.wall) return design.bays;
  const layout = design.wallLayouts?.[wall];
  if (layout) return layout.bays;
  return [];
};

/** Replace one wall atomically and keep the current render cache synchronized. */
export function replaceStudioWallBays(design: StudioDesign, wall: StudioWall, bays: StudioBay[]): StudioDesign {
  const layouts = { ...blankWallLayouts(), ...design.wallLayouts, [wall]: { wallId: wall, bays: withWallIdentity(bays, wall) } };
  const activeBays = wall === design.wall ? layouts[wall].bays : studioBays(design, design.wall);
  return { ...design, version: design.version === 3 ? 3 : 2, wallLayouts: layouts, bays: activeBays };
}

/** Switch walls without copying any tower, part, or material state into the destination. */
export function switchStudioWall(design: StudioDesign, wall: StudioWall): StudioDesign {
  if (!STUDIO_WALLS.includes(wall)) return design;
  const layouts = { ...blankWallLayouts(), ...design.wallLayouts };
  layouts[design.wall] = { wallId: design.wall, bays: withWallIdentity(design.bays, design.wall) };
  const activeBays = layouts[wall]?.bays ?? [];
  return { ...design, version: design.version === 3 ? 3 : 2, wall, wallLayouts: layouts, bays: activeBays };
}

export const studioCornerShelvesForWall = (design: StudioDesign, wall: StudioWall = design.wall) => studioCornerShelves(design).filter((shelf) => shelf.wallIds.includes(wall));
export const studioCornerIdsForWall = (wall: StudioWall) => STUDIO_CORNER_IDS.filter((cornerId) => CORNER_WALL_IDS[cornerId].includes(wall));
export const studioWidthForWall = (design: StudioDesign, wall: StudioWall = design.wall) => studioBays(design, wall).reduce((sum, bay) => sum + bay.widthIn, 0) + (studioBays(design, wall).length ? THICKNESS * (studioBays(design, wall).length + 1) : 0);
export const studioWallOccupancy = (design: StudioDesign): Record<StudioWall, StudioWallOccupancy> => Object.fromEntries(STUDIO_WALLS.map((wallId) => {
  const bays = studioBays(design, wallId);
  const corners = studioCornerShelvesForWall(design, wallId);
  const usedSpanIn = studioWidthForWall(design, wallId);
  return [wallId, { wallId, usedSpanIn, availableSpanIn: studioWallLength(design, wallId), bayCount: bays.length, itemCount: bays.reduce((sum, bay) => sum + bay.items.length, 0), cornerCount: corners.length, filled: bays.length > 0 || corners.length > 0 }];
})) as Record<StudioWall, StudioWallOccupancy>;

export function createStudioDesign(): StudioDesign {
  const wallLayouts = blankWallLayouts();
  wallLayouts.back = { wallId: "back", bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [{ id: "shelf-1", wallId: "back", kind: "shelf", bottomIn: 38 }] }] };
  return { version: 2, mode: "closet", mount: "floor", finish: "Glacier White", wall: "back", wallWidthIn: 120, roomDepthIn: 96, wallLayouts, bays: wallLayouts.back.bays };
}
/** The catalog sells floor uprights at 87 in and 94 in (the 94 in part is named 96″); use the taller one only when the room leaves the required ceiling clearance. */
export const STUDIO_TALL_FLOOR_PANEL_IN = 94;
export const STUDIO_CEILING_CLEARANCE_IN = 4;
export const STUDIO_ROOM_HEIGHT_DEFAULT_IN = 96;
export const studioPanelHeight = (design: StudioDesign) => design.mount === "hanging" ? 80
  : design.roomHeightIn !== undefined && design.roomHeightIn - STUDIO_TALL_FLOOR_PANEL_IN >= STUDIO_CEILING_CLEARANCE_IN ? STUDIO_TALL_FLOOR_PANEL_IN : 87;
export const studioFixedBottom = (design: StudioDesign) => design.mount === "hanging" ? 1.5 : 6;
export const studioFixedTop = (design: StudioDesign) => studioPanelHeight(design) - THICKNESS;
export const studioWidth = (design: StudioDesign) => studioWidthForWall(design, design.wall);
export const studioWallLength = (design: StudioDesign, wall: StudioWall = design.wall) => wall === "left" || wall === "right" ? design.roomDepthIn : design.wallWidthIn;
export const studioCornerShelves = (design: StudioDesign) => design.cornerShelves ?? [];
const CORNER_WALL_IDS: Record<StudioCornerId, [StudioWall, StudioWall]> = {
  "back-left": ["back", "left"], "back-right": ["back", "right"], "front-left": ["front", "left"], "front-right": ["front", "right"],
};
type StudioFootprint = { xMin: number; xMax: number; zMin: number; zMax: number };
/**
 * The ordinary room-wall footprint is retained until a user explicitly creates a visual corner plan.
 * A connected visual corner moves both incident tower previews outside the conservative 29.5-in square
 * so neither tower is ever silently allowed to intersect the planning envelope.
 */
export const studioTowerFootprint = (design: StudioDesign, wall: StudioWall = design.wall): StudioFootprint => {
  const span = studioWidthForWall(design, wall);
  const connectedShelf = studioCornerShelves(design).find((shelf) => shelf.towerConnection === "visualAligned" && shelf.wallIds.includes(wall));
  if (connectedShelf) {
    const footprint = studioCornerPlanningFootprint(design, connectedShelf);
    const depth = 14.5;
    if (wall === "back") return connectedShelf.cornerId === "back-left"
      ? { xMin: footprint.xMax, xMax: footprint.xMax + span, zMin: footprint.zMin, zMax: footprint.zMin + depth }
      : { xMin: footprint.xMin - span, xMax: footprint.xMin, zMin: footprint.zMin, zMax: footprint.zMin + depth };
    if (wall === "front") return connectedShelf.cornerId === "front-left"
      ? { xMin: footprint.xMax, xMax: footprint.xMax + span, zMin: footprint.zMax - depth, zMax: footprint.zMax }
      : { xMin: footprint.xMin - span, xMax: footprint.xMin, zMin: footprint.zMax - depth, zMax: footprint.zMax };
    if (wall === "left") return connectedShelf.cornerId === "back-left"
      ? { xMin: footprint.xMin, xMax: footprint.xMin + depth, zMin: footprint.zMax, zMax: footprint.zMax + span }
      : { xMin: footprint.xMin, xMax: footprint.xMin + depth, zMin: footprint.zMin - span, zMax: footprint.zMin };
    return connectedShelf.cornerId === "back-right"
      ? { xMin: footprint.xMax - depth, xMax: footprint.xMax, zMin: footprint.zMax, zMax: footprint.zMax + span }
      : { xMin: footprint.xMax - depth, xMax: footprint.xMax, zMin: footprint.zMin - span, zMax: footprint.zMin };
  }
  if (wall === "front") return { xMin: 0, xMax: span, zMin: design.roomDepthIn - 14.5, zMax: design.roomDepthIn };
  if (wall === "left") return { xMin: 0, xMax: 14.5, zMin: 0, zMax: span };
  if (wall === "right") return { xMin: design.wallWidthIn - 14.5, xMax: design.wallWidthIn, zMin: 0, zMax: span };
  return { xMin: 0, xMax: span, zMin: 0, zMax: 14.5 };
};
const intervalsOverlap = (aMin: number, aMax: number, bMin: number, bMax: number) => aMin < bMax - EPS && bMin < aMax - EPS;
const footprintsOverlap = (a: StudioFootprint, b: StudioFootprint) => intervalsOverlap(a.xMin, a.xMax, b.xMin, b.xMax) && intervalsOverlap(a.zMin, a.zMax, b.zMin, b.zMax);

/** Conservative 29.5-inch occupancy, not the unprovided curved board outline, radius, edge profile, or connector layout. */
export function studioCornerPlanningFootprint(design: StudioDesign, shelf: Pick<StudioCornerShelf, "cornerId" | "nominalFootprintIn">): StudioFootprint {
  const span = shelf.nominalFootprintIn;
  switch (shelf.cornerId) {
    case "back-left": return { xMin: 0, xMax: span, zMin: 0, zMax: span };
    case "back-right": return { xMin: design.wallWidthIn - span, xMax: design.wallWidthIn, zMin: 0, zMax: span };
    case "front-left": return { xMin: 0, xMax: span, zMin: design.roomDepthIn - span, zMax: design.roomDepthIn };
    case "front-right": return { xMin: design.wallWidthIn - span, xMax: design.wallWidthIn, zMin: design.roomDepthIn - span, zMax: design.roomDepthIn };
  }
}

/** Measured rectangular planning gap to the straight Studio tower envelope; it is not an installation clearance. */
export function studioCornerMeasuredGap(design: StudioDesign, shelf: Pick<StudioCornerShelf, "cornerId" | "nominalFootprintIn">): { towerGapIn: number; footprint: StudioFootprint } {
  const footprint = studioCornerPlanningFootprint(design, shelf);
  const incidentWalls = CORNER_WALL_IDS[shelf.cornerId].filter((wallId) => studioBays(design, wallId).length);
  const gaps = incidentWalls.map((wallId) => {
    const tower = studioTowerFootprint(design, wallId);
    const xGap = Math.max(footprint.xMin - tower.xMax, tower.xMin - footprint.xMax, 0);
    const zGap = Math.max(footprint.zMin - tower.zMax, tower.zMin - footprint.zMax, 0);
    return xGap && zGap ? Math.hypot(xGap, zGap) : xGap || zGap;
  });
  return { towerGapIn: Math.round((gaps.length ? Math.min(...gaps) : 0) * 100) / 100, footprint };
}

const studioCornerProduct = (design: StudioDesign, mount: StudioCornerShelfMount) => {
  const sku = studioCornerShelfSku(design.finish, mount);
  const product = masterTracProduct(sku);
  return product?.finish === design.finish && product.category === "Shelves" && /Corner Shelf/i.test(product.description) ? product : undefined;
};

function studioCornerPlacementError(design: StudioDesign, candidate: StudioCornerShelf, excludeId?: string): string | null {
  if (design.mount !== "floor") return "Corner planning is limited to the floor-mounted visual-planning envelope; hanging support is not verified.";
  if (candidate.nominalFootprintIn !== STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN || candidate.profile !== "curved-illustrative") return "Use the saved 2026 29.5 in curved-shelf planning envelope; the precise profile is not source-verified.";
  if (candidate.geometryRevision !== STUDIO_CORNER_SHELF_GEOMETRY_REVISION || candidate.geometrySource !== "MasterTrac Spec Book NP 2026 p. 13") return "This corner shelf geometry source is not supported by the Studio planning registry.";
  if (candidate.wallIds[0] !== CORNER_WALL_IDS[candidate.cornerId][0] || candidate.wallIds[1] !== CORNER_WALL_IDS[candidate.cornerId][1]) return "Choose the two incident walls of a 90° room corner.";
  if (design.wallWidthIn < candidate.nominalFootprintIn || design.roomDepthIn < candidate.nominalFootprintIn) return "The room is too small for the conservative 29.5 in corner planning envelope.";
  if (!Number.isFinite(candidate.elevationIn) || candidate.elevationIn < studioFixedBottom(design) + THICKNESS || candidate.elevationIn + STUDIO_CORNER_SHELF_THICKNESS_IN > studioFixedTop(design)) return `Corner shelf elevation must fit between the fixed shelves (${studioFixedBottom(design) + THICKNESS}–${studioFixedTop(design)} in within the panel).`;
  const product = studioCornerProduct(design, candidate.mount);
  if (!product || product.sku !== candidate.sku) return "No matching historical corner shelf SKU is available for the selected finish and fixed/adjustable choice.";
  const footprint = studioCornerPlanningFootprint(design, candidate);
  const candidateDesign = candidate.towerConnection === "visualAligned"
    ? { ...design, cornerShelves: [...studioCornerShelves(design).filter((shelf) => shelf.id !== candidate.id), candidate] }
    : design;
  for (const wallId of candidate.wallIds) {
    const wallBays = studioBays(candidateDesign, wallId);
    const tower = studioTowerFootprint(candidateDesign, wallId);
    if (tower.xMin < -EPS || tower.zMin < -EPS || tower.xMax > design.wallWidthIn + EPS || tower.zMax > design.roomDepthIn + EPS)
      return `The ${wallId} wall tower run does not fit outside this conservative 29.5 in corner envelope.`;
    if (wallBays.length && footprintsOverlap(footprint, tower)) return `This 29.5 in corner planning envelope intersects the ${wallId} wall tower. Move that tower or choose a free room corner; shared support is not verified.`;
  }
  for (const existing of studioCornerShelves(design)) {
    if (existing.id === excludeId) continue;
    if (footprintsOverlap(footprint, studioCornerPlanningFootprint(design, existing))
      && intervalsOverlap(candidate.elevationIn, candidate.elevationIn + STUDIO_CORNER_SHELF_THICKNESS_IN, existing.elevationIn, existing.elevationIn + STUDIO_CORNER_SHELF_THICKNESS_IN)) return `Corner shelf at ${candidate.elevationIn} in intersects ${existing.mount} corner shelf at ${existing.elevationIn} in.`;
  }
  return null;
}

export function studioCornerDesignError(design: StudioDesign): string | null {
  for (const shelf of studioCornerShelves(design)) {
    const error = studioCornerPlacementError(design, shelf, shelf.id);
    if (error) return error;
  }
  return null;
}

export function addStudioCornerShelf(design: StudioDesign, cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number, id = `corner-${Date.now()}`):
  { ok: true; design: StudioDesign; shelf: StudioCornerShelf } | { ok: false; reason: string } {
  const shelf: StudioCornerShelf = { id, sku: studioCornerShelfSku(design.finish, mount), finish: design.finish, mount, profile: "curved-illustrative", cornerId, wallIds: CORNER_WALL_IDS[cornerId], elevationIn: Math.round(elevationIn), nominalFootprintIn: STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN, geometryRevision: STUDIO_CORNER_SHELF_GEOMETRY_REVISION, geometrySource: "MasterTrac Spec Book NP 2026 p. 13", capability: "visualPlanning" };
  const error = studioCornerPlacementError(design, shelf);
  if (error) return { ok: false, reason: error };
  return { ok: true, shelf, design: { ...design, cornerShelves: [...studioCornerShelves(design), shelf] } };
}

/**
 * Starts a visual corner from the corner outward. This is atomic: it makes a 24-in companion tower
 * only on an empty incident wall, aligns both incident tower previews to the outside envelope, and
 * saves one shared corner record. It deliberately creates no support, connector, H-joint, or install claim.
 */
export function addStudioConnectedCorner(design: StudioDesign, cornerId: StudioCornerId, mount: StudioCornerShelfMount, elevationIn: number, id = `corner-${Date.now()}`):
  { ok: true; design: StudioDesign; shelf: StudioCornerShelf } | { ok: false; reason: string } {
  let candidate = design;
  for (const wallId of CORNER_WALL_IDS[cornerId]) {
    if (!studioBays(candidate, wallId).length) {
      candidate = replaceStudioWallBays(candidate, wallId, [{ id: `${id}-${wallId}-tower`, wallId, widthIn: 24, items: [] }]);
    }
  }
  const shelf: StudioCornerShelf = { id, sku: studioCornerShelfSku(candidate.finish, mount), finish: candidate.finish, mount, profile: "curved-illustrative", cornerId, wallIds: CORNER_WALL_IDS[cornerId], elevationIn: Math.round(elevationIn), nominalFootprintIn: STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN, geometryRevision: STUDIO_CORNER_SHELF_GEOMETRY_REVISION, geometrySource: "MasterTrac Spec Book NP 2026 p. 13", towerConnection: "visualAligned", capability: "visualPlanning" };
  const error = studioCornerPlacementError(candidate, shelf);
  if (error) return { ok: false, reason: error };
  const next = { ...candidate, cornerShelves: [...studioCornerShelves(candidate), shelf] };
  const recheck = studioCornerDesignError(next);
  if (recheck) return { ok: false, reason: recheck };
  return { ok: true, shelf, design: next };
}

export function moveStudioCornerShelf(design: StudioDesign, id: string, elevationIn: number): { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const existing = studioCornerShelves(design).find((shelf) => shelf.id === id);
  if (!existing) return { ok: false, reason: "Choose a placed corner shelf first." };
  const candidate = { ...existing, elevationIn: Math.round(elevationIn) };
  const error = studioCornerPlacementError(design, candidate, id);
  if (error) return { ok: false, reason: error };
  return { ok: true, design: { ...design, cornerShelves: studioCornerShelves(design).map((shelf) => shelf.id === id ? candidate : shelf) } };
}

export function removeStudioCornerShelf(design: StudioDesign, id: string): StudioDesign {
  return { ...design, cornerShelves: studioCornerShelves(design).filter((shelf) => shelf.id !== id) };
}

/**
 * A finish is one Studio-wide sourced selection. Corner shelves persist their own source SKU,
 * so replace their identity atomically rather than leaving an old-finish visual or List line behind.
 */
export function changeStudioFinish(design: StudioDesign, finish: StudioDesign["finish"]):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  if (!STUDIO_FINISHES.includes(finish)) return { ok: false, reason: "Choose one of the available MasterTrac finishes." };
  if (design.finish === finish) return { ok: true, design };
  const cornerShelves = studioCornerShelves(design).map((shelf) => ({ ...shelf, finish, sku: studioCornerShelfSku(finish, shelf.mount) }));
  const candidate = { ...design, finish, cornerShelves };
  for (const shelf of cornerShelves) {
    const error = studioCornerPlacementError(candidate, shelf, shelf.id);
    if (error) return { ok: false, reason: error };
  }
  for (const wallId of STUDIO_WALLS) {
    const scoped = switchStudioWall(candidate, wallId);
    for (let index = 0; index < scoped.bays.length; index++) {
      if (!studioPartReferences(scoped, index, "fixedShelf") || !studioPartReferences(scoped, index, "shelf"))
        return { ok: false, reason: "The selected finish is missing a sourced shelf reference for one of the existing towers." };
      for (const item of scoped.bays[index].items) {
        if (!studioPartReferences(scoped, index, item.kind)) return { ok: false, reason: `The selected finish has no matching source reference for a placed ${item.kind}.` };
      }
    }
  }
  return { ok: true, design: candidate };
}

export const studioBasketReferences = (design: StudioDesign) => design.basketReferences ?? [];
export const studioBasketPlacements = (design: StudioDesign) => design.basketPlacements ?? [];
export const studioBasketPlacementsForWall = (design: StudioDesign, wall: StudioWall = design.wall) => studioBasketPlacements(design).filter((placement) => placement.wallId === wall);

export function studioFitCapability(sku: string): StudioFitCapability | undefined {
  return STUDIO_FIT_CAPABILITY_REGISTRY.find((entry) => entry.sku === sku);
}

export function addStudioBasketReference(design: StudioDesign, sku: string, id = `basket-reference-${Date.now()}`):
  { ok: true; design: StudioDesign; reference: StudioBasketReference } | { ok: false; reason: string } {
  const option = STUDIO_BASKET_REFERENCE_OPTIONS.find((entry) => entry.sku === sku);
  const product = masterTracProduct(sku);
  const capability = studioFitCapability(sku);
  if (!option || !product || product.finish !== option.finish || product.category !== "Accessories" || product.placeable || product.packQty !== 1 || capability?.status !== "visualPlanning")
    return { ok: false, reason: "This historical basket reference is not available from the approved source registry." };
  const reference: StudioBasketReference = { id, sku, finish: option.finish, nominalHeightIn: option.nominalHeightIn, nominalWidthIn: option.nominalWidthIn, sourceRevision: option.sourceRevision, capability: "referenceOnly" };
  return { ok: true, reference, design: { ...design, basketReferences: [...studioBasketReferences(design), reference] } };
}

export function removeStudioBasketReference(design: StudioDesign, id: string): StudioDesign {
  return { ...design, basketReferences: studioBasketReferences(design).filter((reference) => reference.id !== id) };
}

export function updateStudioBasketReference(design: StudioDesign, id: string, sku: string): { ok: true; design: StudioDesign; reference: StudioBasketReference } | { ok: false; reason: string } {
  if (!studioBasketReferences(design).some((reference) => reference.id === id)) return { ok: false, reason: "Choose a saved basket reference first." };
  const staged = addStudioBasketReference(removeStudioBasketReference(design, id), sku, id);
  return staged;
}

const basketOption = (sku: string) => STUDIO_BASKET_REFERENCE_OPTIONS.find((option) => option.sku === sku);
const basketPlacementCapability = (sku: string) => {
  const option = basketOption(sku);
  const product = masterTracProduct(sku);
  const capability = studioFitCapability(sku);
  return option && product?.finish === option.finish && product.category === "Accessories" && product.packQty === 1 && capability?.status === "visualPlanning" ? option : undefined;
};

/** Validate only a conservative visual envelope; the source does not establish rail, slide, door, travel, or installation clearance geometry. */
function studioBasketPlacementError(design: StudioDesign, bayIndex: number, candidate: StudioBasketPlacement, excludeId?: string): string | null {
  const bay = studioBays(design)[bayIndex];
  if (!bay) return "Choose a tower bay for the basket visual plan.";
  if (design.mount !== "floor") return "Basket visual planning is limited to floor-mounted towers until hanging support and rail fit are source-verified.";
  if (candidate.wallId !== design.wall || candidate.bayId !== bay.id) return "Choose a basket location on the active wall and selected tower bay.";
  const option = basketPlacementCapability(candidate.sku);
  if (!option || candidate.finish !== "Chrome" || candidate.nominalHeightIn !== option.nominalHeightIn || candidate.nominalWidthIn !== option.nominalWidthIn
    || candidate.nominalDepthIn !== STUDIO_BASKET_VISUAL_DEPTH_IN || candidate.sourceRevision !== "floor-579554-p13-historical-basket-visual-envelope-v1" || candidate.capability !== "visualPlanning")
    return "This basket is not available from the approved historical visual-planning registry.";
  if (studioBayCut(bay)) return "Basket fit is not verified in a field-cut shelf bay. Restore full stock width before visual planning.";
  if (candidate.nominalWidthIn > bay.widthIn + EPS) return `SKU ${candidate.sku} is ${candidate.nominalWidthIn} in nominal width and exceeds this ${bay.widthIn} in clear bay. Baskets are never resized or cut to fit.`;
  const fixedBottom = studioFixedBottom(design);
  const fixedTop = studioFixedTop(design);
  if (!Number.isFinite(candidate.bottomIn) || candidate.bottomIn < fixedBottom + THICKNESS || candidate.bottomIn + candidate.nominalHeightIn > fixedTop)
    return `Basket visual envelope must fit between the fixed shelves (${fixedBottom + THICKNESS}–${fixedTop} in within the panel).`;
  const occupied = [
    { id: "fixed-bottom", bottomIn: fixedBottom, heightIn: THICKNESS, label: "fixed shelf" },
    { id: "fixed-top", bottomIn: fixedTop, heightIn: THICKNESS, label: "fixed shelf" },
    ...bay.items.map((item) => ({ id: item.id, bottomIn: item.bottomIn, heightIn: studioItemHeight(item.kind), label: item.kind })),
    ...studioBasketPlacementsForWall(design).filter((placement) => placement.id !== excludeId && placement.bayId === bay.id).map((placement) => ({ id: placement.id, bottomIn: placement.bottomIn, heightIn: placement.nominalHeightIn, label: "basket" })),
  ];
  for (const other of occupied) if (intervalsOverlap(candidate.bottomIn, candidate.bottomIn + candidate.nominalHeightIn, other.bottomIn, other.bottomIn + other.heightIn))
    return `At ${candidate.bottomIn} in this basket visual envelope intersects ${other.label} at ${other.bottomIn} in. Move it; rails and clearance remain supplier-verification items.`;
  return null;
}

export function addStudioBasketPlacement(design: StudioDesign, bayIndex: number, sku: string, bottomIn: number, id = `basket-${Date.now()}`):
  { ok: true; design: StudioDesign; placement: StudioBasketPlacement } | { ok: false; reason: string } {
  const bay = studioBays(design)[bayIndex];
  const option = basketOption(sku);
  if (!bay || !option) return { ok: false, reason: "Choose a sourced basket and tower bay first." };
  const placement: StudioBasketPlacement = { id, sku, finish: "Chrome", nominalHeightIn: option.nominalHeightIn, nominalWidthIn: option.nominalWidthIn, nominalDepthIn: STUDIO_BASKET_VISUAL_DEPTH_IN, bottomIn: Math.round(bottomIn), wallId: design.wall, bayId: bay.id, sourceRevision: "floor-579554-p13-historical-basket-visual-envelope-v1", capability: "visualPlanning" };
  const error = studioBasketPlacementError(design, bayIndex, placement);
  if (error) return { ok: false, reason: error };
  return { ok: true, placement, design: { ...design, version: 3, basketPlacements: [...studioBasketPlacements(design), placement] } };
}

/**
 * The basket rule is unchanged: the nominal envelope must sit fully between the fixed shelves,
 * must not overlap another part, and is never cut to the bay. A requested top elevation often
 * fails that rule because the fixed top shelf leaves less than the basket height. This picks the
 * nearest whole inch that does fit, preferring the bottom of the opening when no height was aimed.
 */
export function snapStudioBasketPlacement(design: StudioDesign, bayIndex: number, sku: string, preferredIn?: number, id = `basket-${Date.now()}`):
  { ok: true; design: StudioDesign; placement: StudioBasketPlacement } | { ok: false; reason: string } {
  const option = basketOption(sku);
  const bay = studioBays(design)[bayIndex];
  if (!bay || !option) return { ok: false, reason: "Choose a sourced basket and tower bay first." };
  const min = Math.ceil(studioFixedBottom(design) + THICKNESS - EPS);
  const max = Math.floor(studioFixedTop(design) - option.nominalHeightIn + EPS);
  if (max < min) return { ok: false, reason: `This ${option.nominalHeightIn} in basket is taller than the open space between the fixed shelves.` };
  const preferred = preferredIn == null || !Number.isFinite(preferredIn) ? min : Math.max(min, Math.min(max, Math.round(preferredIn)));
  const candidates = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  let reason = "There is no open span tall enough for this basket in the selected tower.";
  for (const bottomIn of candidates) {
    const result = addStudioBasketPlacement(design, bayIndex, sku, bottomIn, id);
    if (result.ok) return result;
    reason = result.reason;
  }
  return { ok: false, reason };
}

export function moveStudioBasketPlacement(design: StudioDesign, id: string, bottomIn: number): { ok: true; design: StudioDesign; placement: StudioBasketPlacement } | { ok: false; reason: string } {
  const current = studioBasketPlacements(design).find((placement) => placement.id === id && placement.wallId === design.wall);
  if (!current) return { ok: false, reason: "Choose a placed basket on this wall first." };
  const bayIndex = studioBays(design).findIndex((bay) => bay.id === current.bayId);
  const placement = { ...current, bottomIn: Math.round(bottomIn) };
  const error = studioBasketPlacementError(design, bayIndex, placement, id);
  if (error) return { ok: false, reason: error };
  return { ok: true, placement, design: { ...design, version: 3, basketPlacements: studioBasketPlacements(design).map((item) => item.id === id ? placement : item) } };
}

export function updateStudioBasketPlacement(design: StudioDesign, id: string, sku: string): { ok: true; design: StudioDesign; placement: StudioBasketPlacement } | { ok: false; reason: string } {
  const current = studioBasketPlacements(design).find((placement) => placement.id === id && placement.wallId === design.wall);
  const option = basketOption(sku);
  if (!current || !option) return { ok: false, reason: "Choose a placed basket and sourced replacement SKU first." };
  const bayIndex = studioBays(design).findIndex((bay) => bay.id === current.bayId);
  const placement: StudioBasketPlacement = { ...current, sku, nominalHeightIn: option.nominalHeightIn, nominalWidthIn: option.nominalWidthIn };
  const error = studioBasketPlacementError(design, bayIndex, placement, id);
  if (error) return { ok: false, reason: error };
  return { ok: true, placement, design: { ...design, version: 3, basketPlacements: studioBasketPlacements(design).map((item) => item.id === id ? placement : item) } };
}

export function removeStudioBasketPlacement(design: StudioDesign, id: string): StudioDesign {
  return { ...design, basketPlacements: studioBasketPlacements(design).filter((placement) => placement.id !== id) };
}

export function studioBasketPlacementErrorForBay(design: StudioDesign, bayIndex: number, placement: StudioBasketPlacement, excludeId?: string) {
  return studioBasketPlacementError(design, bayIndex, placement, excludeId);
}

/** Revalidate every saved visual basket when a tower, wall, or room edit could change its envelope. */
export function studioBasketDesignError(design: StudioDesign): string | null {
  for (const placement of studioBasketPlacements(design)) {
    const scoped = switchStudioWall(design, placement.wallId);
    const bayIndex = studioBays(scoped).findIndex((bay) => bay.id === placement.bayId);
    const error = studioBasketPlacementError(scoped, bayIndex, placement, placement.id);
    if (error) return error;
  }
  return null;
}
/** The sourced board remains 0.75-inch thick; a shoe organizer reserves its taller, explicitly illustrative 45-degree visual envelope. */
export const studioItemHeight = (kind: StudioKind) => kind === "drawer" ? 5 : kind === "rod" ? 0 : kind === "shoe" ? STUDIO_ILLUSTRATIVE_SHOE_ENVELOPE_HEIGHT_IN : THICKNESS;
export const studioStockWidth = (bay: StudioBay) => bay.stockWidthIn ?? bay.widthIn;
export function studioBayCut(bay: StudioBay): StudioShelfCut | null {
  const stockWidthIn = studioStockWidth(bay);
  if (!bay.stockWidthIn || stockWidthIn - bay.widthIn <= EPS) return null;
  return { stockWidthIn: bay.stockWidthIn, installedWidthIn: bay.widthIn, offcutIn: Math.round((stockWidthIn - bay.widthIn) * 1000) / 1000 };
}

/** Shelf top/bottom and drawer face thickness are sourced; rod diameter and drawer body remain schematic. */
export function studioCollision(design: StudioDesign, bayIndex: number, candidate: StudioItem, excludeId?: string): string | null {
  const bay = studioBays(design)[bayIndex];
  if (!bay) return "Choose a tower bay.";
  const bottom = studioFixedBottom(design);
  const top = studioFixedTop(design);
  const height = studioItemHeight(candidate.kind);
  if (!Number.isFinite(candidate.bottomIn) || candidate.bottomIn < bottom + THICKNESS || candidate.bottomIn + height > top)
    return `This item must fit between the fixed shelves (${bottom + THICKNESS}–${top} in within the panel).`;
  const occupied = [
    { id: "fixed-bottom", bottomIn: bottom, kind: "shelf" as const, heightIn: THICKNESS, label: "fixed shelf" },
    { id: "fixed-top", bottomIn: top, kind: "shelf" as const, heightIn: THICKNESS, label: "fixed shelf" },
    ...bay.items.filter((item) => item.id !== excludeId).map((item) => ({ ...item, heightIn: studioItemHeight(item.kind), label: item.kind })),
    ...studioBasketPlacementsForWall(design).filter((placement) => placement.id !== excludeId && placement.bayId === bay.id).map((placement) => ({ id: placement.id, bottomIn: placement.bottomIn, kind: "basket" as const, heightIn: placement.nominalHeightIn, label: "basket" })),
  ];
  for (const other of occupied) {
    if (candidate.kind === "rod" && other.kind === "rod") continue; // Rod-to-rod clearance is unspecified.
    if (candidate.bottomIn < other.bottomIn + other.heightIn - 0.000001 &&
      other.bottomIn < candidate.bottomIn + height - 0.000001) return `At ${candidate.bottomIn} in this item intersects ${other.label} at ${other.bottomIn} in. Keep actual parts physically separate.`;
  }
  return null;
}

export function studioProduct(design: StudioDesign, category: string, description: RegExp, widthIn?: number, heightIn?: number): MasterTracProduct | undefined {
  return CLOSET_PARTS.find((p) => p.category === category && p.finish === design.finish && p.packQty === 1 && description.test(p.description)
    && (widthIn == null || p.widthIn === widthIn || p.lengthIn === widthIn)
    && (heightIn == null || p.heightIn === heightIn) && (category === "Cleats" || p.depthIn === 14.5));
}
export function studioPartReferences(design: StudioDesign, bayIndex: number, kind: StudioReferenceKind): MasterTracProduct[] | null {
  const bay = studioBays(design)[bayIndex];
  if (!bay) return null;
  const stockWidthIn = studioStockWidth(bay);
  if (kind === "shelf" || kind === "fixedShelf") {
    const shelf = studioProduct(design, "Shelves", kind === "fixedShelf" ? /\bFixed Shelf\b/i : /\b(?:Adj|Adjustable) Shelf\b/i, stockWidthIn, 0.75);
    return shelf ? [shelf] : null;
  }
  // The manual's field-cut steps are limited to straight fixed/adjustable shelves; other changed-width fits are not verified.
  if (studioBayCut(bay)) return null;
  if (kind === "rod") {
    const rod = CLOSET_PARTS.find((p) => p.category === "Accessories" && p.finish === "Chrome" && p.packQty === 1 && /^8' Rod\b/i.test(p.description));
    const cup = CLOSET_PARTS.find((p) => p.category === "Accessories" && p.finish === "Chrome" && p.packQty === 10 && /^Rod Cup \(10 Each\)/i.test(p.description));
    return rod && cup ? [rod, cup] : null;
  }
  const refs = towerStorageSkuReferences(kind === "drawer"
    ? { kind: "drawers", count: 1, drawerSize: "small", frontStyle: "slab" }
    : { kind: "shoe", count: 1, fenceFinish: "Chrome" }, bay.widthIn, 14.5, design.finish);
  return refs.ok ? refs.parts.map((line) => line.product) : null;
}

/** Plans a measured straight-shelf cut; this is not a cutting, drilling, or installation instruction. */
export function configureStudioBayCut(design: StudioDesign, bayIndex: number, stockWidthIn: 18 | 24 | 30, installedWidthIn: number):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const bays = studioBays(design);
  const bay = bays[bayIndex];
  if (!bay) return { ok: false, reason: "Choose a tower bay." };
  if (design.mount !== "floor") return { ok: false, reason: "Cut-to-fit planning is documented here only for floor-mounted straight shelves." };
  if (!WIDTHS.includes(stockWidthIn)) return { ok: false, reason: "Choose a sourced 18, 24, or 30 inch stock shelf." };
  if (!Number.isFinite(installedWidthIn) || installedWidthIn < CUT_PLANNING_MIN_IN || installedWidthIn > stockWidthIn + EPS)
    return { ok: false, reason: `Installed width must be ${CUT_PLANNING_MIN_IN}–${stockWidthIn} in for this planning tool.` };
  const normalizedInstalled = Math.round(installedWidthIn * 1000) / 1000;
  const candidateBay: StudioBay = { ...bay, widthIn: normalizedInstalled, ...(normalizedInstalled < stockWidthIn - EPS ? { stockWidthIn } : {}) };
  if (normalizedInstalled >= stockWidthIn - EPS) delete candidateBay.stockWidthIn;
  const candidate = replaceStudioWallBays(design, design.wall, bays.map((current, index) => index === bayIndex ? candidateBay : current));
  if (!studioPartReferences(candidate, bayIndex, "fixedShelf")
    || !studioPartReferences(candidate, bayIndex, "shelf"))
    return { ok: false, reason: `No matching ${stockWidthIn} inch stock fixed and adjustable shelf SKU is available in the selected finish.` };
  if (candidateBay.stockWidthIn && candidateBay.items.some((item) => item.kind !== "shelf"))
    return { ok: false, reason: "Drawer, shoe organizer, and rod fit is not verified in a field-cut bay. Remove those items or restore full stock width." };
  if (candidateBay.stockWidthIn && studioBasketPlacementsForWall(design).some((placement) => placement.bayId === bay.id))
    return { ok: false, reason: "Basket fit is not verified in a field-cut shelf bay. Remove the basket visual plan or restore full stock width." };
  if (studioWidth(candidate) > studioWallLength(candidate)) return { ok: false, reason: "The connected towers exceed the selected wall length." };
  const cornerError = studioCornerDesignError(candidate);
  if (cornerError) return { ok: false, reason: cornerError };
  const basketError = studioBasketDesignError(candidate);
  if (basketError) return { ok: false, reason: basketError };
  return { ok: true, design: candidate };
}

export function canStageStudioPart(design: StudioDesign, bayIndex: number, kind: StudioKind): string | null {
  if (!studioBays(design)[bayIndex]) return "Choose a tower bay.";
  if (!studioPartReferences(design, bayIndex, kind)) return `No verified March 2022 ${kind} SKU combination fits this bay and finish.`;
  if (studioWidth(design) > studioWallLength(design)) return "The connected towers exceed the selected wall length.";
  return null;
}

/** First free quarter-inch physical slot, or the preferred height snapped to the nearest valid inch. */
export function snapStudioPart(design: StudioDesign, bayIndex: number, kind: StudioKind, preferredIn?: number, id = `item-${Date.now()}`):
  { ok: true; design: StudioDesign; item: StudioItem } | { ok: false; reason: string } {
  const sourceError = canStageStudioPart(design, bayIndex, kind);
  if (sourceError) return { ok: false, reason: sourceError };
  const min = studioFixedBottom(design) + THICKNESS;
  const max = studioFixedTop(design) - studioItemHeight(kind);
  const preferred = preferredIn == null ? kind === "rod" ? 64 : kind === "shoe" ? 24 : kind === "drawer" ? 20 : 42 : preferredIn;
  const clamped = Math.max(min, Math.min(max, Math.round(preferred)));
  const candidates = Array.from({ length: Math.floor((max - min) * 4) + 1 }, (_, i) => Math.round((min + i * 0.25) * 100) / 100);
  candidates.sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped) || a - b);
  for (const bottomIn of candidates) {
    const item = { id, kind, bottomIn, wallId: design.wall };
    if (studioCollision(design, bayIndex, item)) continue;
    return { ok: true, item, design: replaceStudioWallBays(design, design.wall, studioBays(design).map((bay, index) => index === bayIndex ? { ...bay, items: [...bay.items, item] } : bay)) };
  }
  return { ok: false, reason: `There is no physical space left in Tower ${bayIndex + 1}; move or remove an item first.` };
}
export function moveStudioItem(design: StudioDesign, bayIndex: number, itemId: string, bottomIn: number):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const item = studioBays(design)[bayIndex]?.items.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: "Choose a placed part first." };
  const next = { ...item, bottomIn: Math.round(bottomIn) };
  const error = studioCollision(design, bayIndex, next, itemId);
  if (error) return { ok: false, reason: error };
  return { ok: true, design: replaceStudioWallBays(design, design.wall, studioBays(design).map((bay, i) => i === bayIndex
    ? { ...bay, items: bay.items.map((existing) => existing.id === itemId ? next : existing) } : bay)) };
}
export function addStudioBay(design: StudioDesign, widthIn: 18 | 24 | 30 = 24):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const bays = studioBays(design);
  if (!WIDTHS.includes(widthIn) || bays.length >= 4) return { ok: false, reason: "Choose up to four sourced tower bays." };
  const candidate = replaceStudioWallBays(design, design.wall, [...bays, { id: `bay-${Date.now()}`, wallId: design.wall, widthIn, items: [] }]);
  if (studioWidth(candidate) > studioWallLength(candidate)) return { ok: false, reason: "No wall space for a neighboring tower. Choose another wall or a narrower bay." };
  const cornerError = studioCornerDesignError(candidate);
  if (cornerError) return { ok: false, reason: cornerError };
  const basketError = studioBasketDesignError(candidate);
  if (basketError) return { ok: false, reason: basketError };
  return { ok: true, design: candidate };
}

/** Shareable, isolated sample. Never substitute this for a customer's saved draft. */
export function createStudioReviewDemo(): StudioDesign {
  let design: StudioDesign = { ...createStudioDesign(), finish: "Spiced Mahogany" };
  const neighbor = addStudioBay(design);
  if (!neighbor.ok) throw new Error(neighbor.reason);
  design = neighbor.design;
  for (const [kind, preferred, id] of [
    ["shoe", 24, "sample-shoe"], ["rod", 64, "sample-rod"], ["drawer", 20, "sample-drawer"],
  ] as const) {
    const staged = snapStudioPart(design, 1, kind, preferred, id);
    if (!staged.ok) throw new Error(staged.reason);
    design = staged.design;
  }
  return design;
}

/**
 * Kids' closet planning numbers. Sources (rules of thumb, not a MasterTrac specification):
 * - Reach: ADA Standards for Accessible Design 2010, Advisory 308.1 (children's reach ranges by age).
 * - Rod heights: Refined Space, HomeGuide, ClosetDesign.app and Oregon State University Extension closet-planning guidance.
 * - Tip restraint: ASTM F2057 / 16 CFR 1261 (clothing storage units 27 in or taller).
 * `stretchReachIn` is the higher "taller kids" reach for ages 9–12.
 */
export const KIDS_AGE_BANDS = [
  { minAge: 3, maxAge: 5,  rodMinIn: 32, rodMaxIn: 36, maxReachIn: 36 },
  { minAge: 6, maxAge: 8,  rodMinIn: 42, rodMaxIn: 45, maxReachIn: 40 },
  { minAge: 9, maxAge: 12, rodMinIn: 48, rodMaxIn: 54, maxReachIn: 44, stretchReachIn: 54 },
] as const;
export const KIDS_ADULT_DOUBLE_HANG_AGE = 11; // switch to adult 40/80 double hang
export const KIDS_UPPER_ROD_IN = 80;          // off-season / next-size clothes
export const KIDS_CHILD_SHELF_DEPTH_IN = 12;  // guidance; MasterTrac Studio boards are 14.5 in
export const KIDS_CLOSET_DEPTH_IN = 24;       // build depth so it grows into an adult closet
export const KIDS_TIP_RESTRAINT_MIN_HEIGHT_IN = 27;
export const KIDS_MIN_AGE = 3;
export const KIDS_MAX_AGE = 12;
export const KIDS_MIN_HEIGHT_IN = 30;
export const KIDS_MAX_HEIGHT_IN = 66;
const KIDS_ADULT_ROD_IN = 40;
const KIDS_UPPER_SHELF_CLEARANCE_IN = 4;
const KIDS_DRAWER_COUNT = 3;
const KIDS_BIN_SHELF_GAP_IN = 1.25;
type KidsAgeBand = { minAge: number; maxAge: number; rodMinIn: number; rodMaxIn: number; maxReachIn: number; stretchReachIn?: number };
const KIDS_ITEM_NAMES: Record<StudioKind, string> = { shelf: "Shelf", rod: "Hanging rod", drawer: "Drawer", shoe: "Shoe organizer" };
const validKids = (kids: unknown): kids is NonNullable<StudioDesign["kids"]> => {
  const k = kids as { ageYears?: unknown; heightIn?: unknown } | null | undefined;
  return !!k && typeof k === "object" && typeof k.ageYears === "number" && Number.isFinite(k.ageYears) && k.ageYears >= KIDS_MIN_AGE && k.ageYears <= KIDS_MAX_AGE
    && typeof k.heightIn === "number" && Number.isFinite(k.heightIn) && k.heightIn >= KIDS_MIN_HEIGHT_IN && k.heightIn <= KIDS_MAX_HEIGHT_IN;
};
export const kidsAgeBand = (ageYears: number): KidsAgeBand => KIDS_AGE_BANDS.find((band) => ageYears <= band.maxAge) ?? KIDS_AGE_BANDS[KIDS_AGE_BANDS.length - 1];

/** Child rod height in inches: the adult 40 in lower rod from age 11, otherwise about the child's height within the age band. */
export function kidsRodHeightIn(ageYears: number, heightIn: number): number {
  if (ageYears >= KIDS_ADULT_DOUBLE_HANG_AGE) return KIDS_ADULT_ROD_IN;
  const band = kidsAgeBand(ageYears);
  return Math.max(band.rodMinIn, Math.min(band.rodMaxIn, Math.round(heightIn)));
}

/** Places a part through snapStudioPart (so every fit and collision rule runs). Snap rounds the request to a whole inch, so a result within `toleranceIn` of the plan is accepted; anything else is skipped, never forced. */
function stageStudioPart(design: StudioDesign, bayIndex: number, kind: StudioKind, bottomIn: number, id: string, toleranceIn = 0.5): { design: StudioDesign; item: StudioItem | null } {
  const result = snapStudioPart(design, bayIndex, kind, bottomIn, id);
  return result.ok && Math.abs(result.item.bottomIn - bottomIn) <= toleranceIn + EPS ? { design: result.design, item: result.item } : { design, item: null };
}

/**
 * Starter kids' closet: one 24 in hanging tower (child rod, 80 in upper rod, a shelf above it, a low toy-bin shelf) and, for ages 3–10,
 * a second 24 in tower of drawers plus a low bin shelf. Every part goes through snapStudioPart, so the normal fit and collision rules apply;
 * a part that is rejected or would land away from its planned height is skipped, never forced.
 */
export function createKidsStudioDesign(ageYears: number, heightIn: number, room?: { wallWidthIn: number; roomDepthIn: number; roomHeightIn: number }): StudioDesign {
  const base = { ...createStudioDesign(), ...room };
  let design: StudioDesign = { ...replaceStudioWallBays(base, "back", [{ ...base.bays[0], items: [] }]), mode: "kids", kids: { ageYears, heightIn } };
  const band = kidsAgeBand(ageYears);
  const stage = (bayIndex: number, kind: StudioKind, bottomIn: number, id: string) => {
    const staged = stageStudioPart(design, bayIndex, kind, bottomIn, id);
    design = staged.design;
    return staged.item;
  };
  const lowestIn = studioFixedBottom(design) + THICKNESS;
  stage(0, "rod", kidsRodHeightIn(ageYears, heightIn), "kids-rod");
  stage(0, "rod", KIDS_UPPER_ROD_IN, "kids-upper-rod");
  stage(0, "shelf", KIDS_UPPER_ROD_IN + KIDS_UPPER_SHELF_CLEARANCE_IN, "kids-upper-shelf");
  stage(0, "shelf", lowestIn, "kids-toy-bin-shelf");
  if (ageYears < KIDS_ADULT_DOUBLE_HANG_AGE) {
    const neighbor = addStudioBay(design, 24);
    if (neighbor.ok) {
      design = replaceStudioWallBays(neighbor.design, "back", studioBays(neighbor.design, "back").map((bay, index) => index === 1 ? { ...bay, id: "bay-2" } : bay));
      let nextIn = lowestIn;
      for (let n = 1; n <= KIDS_DRAWER_COUNT; n++) {
        if (nextIn + studioItemHeight("drawer") > band.maxReachIn) break;
        const drawer = stage(1, "drawer", nextIn, `kids-drawer-${n}`);
        if (!drawer) break;
        nextIn = drawer.bottomIn + studioItemHeight("drawer");
      }
      if (nextIn + KIDS_BIN_SHELF_GAP_IN + THICKNESS <= band.maxReachIn) stage(1, "shelf", nextIn + KIDS_BIN_SHELF_GAP_IN, "kids-bin-shelf");
    }
  }
  return design;
}

/** Kids' closet planning notes: reach, safety and growth guidance. Empty for every other mode. */
export function kidsGuidance(design: StudioDesign): string[] {
  if (design.mode !== "kids" || !design.kids) return [];
  const band = kidsAgeBand(design.kids.ageYears);
  const limitIn = band.stretchReachIn ?? band.maxReachIn;
  const notes = [`Kids' reach: keep everything the child uses at or below ${band.maxReachIn} in (ADA children's reach, ages ${band.minAge}–${band.maxAge})${band.stretchReachIn ? `, up to ${band.stretchReachIn} in for taller kids` : ""}.`];
  for (const wall of STUDIO_WALLS) studioBays(design, wall).forEach((bay, index) => bay.items.forEach((item) => {
    if ((item.kind === "rod" || item.kind === "shelf") && item.bottomIn >= KIDS_UPPER_ROD_IN) return; // the upper rod and shelf are for adults
    const topIn = Math.round((item.bottomIn + studioItemHeight(item.kind)) * 10) / 10;
    // A child rod sits at about the child's height, which can be above the reach limit for ages 6–8; it is flagged only above the age band's rod range.
    const itemLimitIn = item.kind === "rod" ? Math.max(limitIn, band.rodMaxIn) : limitIn;
    if (topIn > itemLimitIn + EPS) notes.push(`Reach warning: ${KIDS_ITEM_NAMES[item.kind].toLowerCase()} at ${item.bottomIn} in (top ${topIn} in) in Tower ${index + 1} on the ${wall} wall is above the ${itemLimitIn} in kids' reach limit.`);
  }));
  notes.push(`Upper rod at ${KIDS_UPPER_ROD_IN} in holds off-season and next-size clothes.`);
  notes.push(`Plan the closet ${KIDS_CLOSET_DEPTH_IN} in deep so it can become an adult closet; keep shelves the child uses about ${KIDS_CHILD_SHELF_DEPTH_IN} in deep (Studio boards are 14.5 in).`);
  if (design.roomDepthIn < KIDS_CLOSET_DEPTH_IN + 36) notes.push("Leave a 3 ft walkway in front of hanging clothes.");
  notes.push("Toy bins and shoes go in floor-level open cubbies.");
  notes.push("Anchor every tall unit to studs.");
  // A tower that holds drawers is one unit as tall as its panels, so any drawer makes the unit tall enough to need a tip restraint.
  if (STUDIO_WALLS.some((wall) => studioBays(design, wall).some((bay) => bay.items.some((item) => item.kind === "drawer"))) && studioPanelHeight(design) >= KIDS_TIP_RESTRAINT_MIN_HEIGHT_IN)
    notes.push(`Tip restraint required on drawer units ${KIDS_TIP_RESTRAINT_MIN_HEIGHT_IN} in or taller (ASTM F2057 / 16 CFR 1261).`);
  return notes;
}

/** Part counts for an auto-build. Rods are hanging rods, shelves are adjustable shelves, drawers are small slab drawers, shoes are shoe organizers. */
export type StudioAutoBuildOptions = { rods: number; shelves: number; drawers: number; shoes: number };
export const MODE_AUTO_BUILD_DEFAULTS: Record<StudioMode, StudioAutoBuildOptions> = {
  closet: { rods: 3, shelves: 4, drawers: 3, shoes: 2 },
  pantry: { rods: 0, shelves: 8, drawers: 3, shoes: 0 },
  mudroom: { rods: 2, shelves: 2, drawers: 0, shoes: 4 },
  kids: { rods: 2, shelves: 3, drawers: 3, shoes: 0 },
};
export const STUDIO_AUTO_BUILD_MAX_COUNT = 8;
export type StudioAutoBuildInput = {
  mode: StudioMode; mount: StudioMount; finish: StudioDesign["finish"];
  wallWidthIn: number; roomDepthIn: number; roomHeightIn: number;
  kids?: StudioDesign["kids"]; options?: StudioAutoBuildOptions;
};
export type StudioAutoBuildResult = { design: StudioDesign; notices: string[] };

const AUTO_HANG_DEPTH_IN = 24;
const AUTO_WALKWAY_IN = 36;
const AUTO_TOWER_DEPTH_IN = 14.5;
const AUTO_BAY_IN = 24;
const AUTO_MAX_BAYS_PER_WALL = 4;
const AUTO_CORNER_ELEVATION_IN = 36;
const AUTO_SHELF_STEP_IN = 12;
type AutoSpec = { kind: StudioKind; at: number };
type AutoPlan = { specs: AutoSpec[] };
const runWidthIn = (widths: number[]) => widths.length ? widths.reduce((sum, width) => sum + width, 0) + THICKNESS * (widths.length + 1) : 0;
const roundIn = (value: number) => Math.round(value * 100) / 100;

/** Bay-by-bay part plans for a mode. Each count is consumed as parts are assigned, so the totals placed match the options unless a wall runs out of room. */
function planAutoBays(design: StudioDesign, mode: StudioMode, options: StudioAutoBuildOptions, kids?: StudioDesign["kids"]): AutoPlan[] {
  const left = { ...options };
  const plans: AutoPlan[] = [];
  const lowestIn = studioFixedBottom(design) + THICKNESS;
  const maxTopIn = studioFixedTop(design);
  const upperRodIn = Math.min(KIDS_UPPER_ROD_IN, Math.floor(maxTopIn - 1));
  const band = kids ? kidsAgeBand(kids.ageYears) : null;
  const take = (key: keyof StudioAutoBuildOptions, count: number) => { const n = Math.min(left[key], count); left[key] -= n; return n; };
  const shelvesFrom = (startIn: number, count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "shelf" as const, at: startIn + i * AUTO_SHELF_STEP_IN })).filter((spec) => spec.at + THICKNESS <= limitIn);
  const drawersLow = (count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "drawer" as const, at: lowestIn + i * studioItemHeight("drawer") })).filter((spec) => spec.at + studioItemHeight("drawer") <= limitIn);
  const shoesLow = (count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "shoe" as const, at: lowestIn + i * (studioItemHeight("shoe") + 0.25) })).filter((spec) => spec.at + studioItemHeight("shoe") <= limitIn);
  const hang = (): void => {
    while (left.rods >= 2) { take("rods", 2); const specs: AutoSpec[] = [{ kind: "rod", at: KIDS_ADULT_ROD_IN }, { kind: "rod", at: upperRodIn }]; if (take("shelves", 1)) specs.push({ kind: "shelf", at: upperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN }); plans.push({ specs }); }
    if (left.rods === 1) { take("rods", 1); const specs: AutoSpec[] = [{ kind: "rod", at: 66 }]; if (take("shelves", 1)) specs.push({ kind: "shelf", at: 70 }); plans.push({ specs }); }
  };
  const shoes = (perBay: number, limitIn?: number): void => { while (left.shoes > 0) plans.push({ specs: shoesLow(take("shoes", perBay), limitIn) }); };
  const shelfDrawer = (shelvesPerBay: number, limitIn?: number): void => {
    while (left.drawers > 0 || left.shelves > 0) {
      const drawers = take("drawers", 3);
      const startIn = drawers ? lowestIn + drawers * studioItemHeight("drawer") + 1.25 : lowestIn + AUTO_SHELF_STEP_IN - 1.5;
      plans.push({ specs: [...drawersLow(drawers, limitIn), ...shelvesFrom(startIn, take("shelves", shelvesPerBay), limitIn)] });
    }
  };
  if (mode === "closet") { hang(); shoes(4); shelfDrawer(5); }
  else if (mode === "pantry") { shelfDrawer(6); hang(); shoes(4); }
  else if (mode === "mudroom") {
    while (left.shoes > 0 || left.rods > 0) {
      const specs = shoesLow(take("shoes", 2));
      if (take("rods", 1)) specs.push({ kind: "rod", at: 60 });
      if (take("shelves", 1)) specs.push({ kind: "shelf", at: 74 });
      plans.push({ specs });
    }
    shelfDrawer(5);
  } else if (band && kids) {
    const reachIn = band.maxReachIn;
    while (left.rods > 0) {
      const rods = take("rods", 2);
      const specs: AutoSpec[] = [{ kind: "rod", at: kidsRodHeightIn(kids.ageYears, kids.heightIn) }];
      if (rods === 2) specs.push({ kind: "rod", at: upperRodIn });
      if (rods === 2 && take("shelves", 1)) specs.push({ kind: "shelf", at: upperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN });
      if (take("shelves", 1)) specs.push({ kind: "shelf", at: lowestIn }); // toy-bin zone, low enough for hanging clothes above it
      plans.push({ specs });
    }
    shoes(2, reachIn);
    shelfDrawer(2, reachIn);
  }
  return plans.filter((plan) => plan.specs.length);
}

/**
 * Builds a whole room from a mode, size and part counts. Pure: it only composes the existing Studio helpers
 * (addStudioBay, configureStudioBayCut, addStudioConnectedCorner, snapStudioPart), so every fit and collision rule still runs
 * and a part those rules reject is skipped, never forced. Anything left out is reported in `notices`.
 */
export function autoBuildStudio(input: StudioAutoBuildInput): StudioAutoBuildResult {
  const notices: string[] = [];
  const mode = input.mode;
  let kids = input.kids;
  if (mode === "kids" && !validKids(kids)) { kids = { ageYears: 8, heightIn: 48 }; notices.push("No child age or height was given, so the kids' closet is planned for age 8 and 48 in."); }
  const requested = input.options ?? MODE_AUTO_BUILD_DEFAULTS[mode];
  const count = (value: number) => Math.max(0, Math.min(STUDIO_AUTO_BUILD_MAX_COUNT, Math.round(Number.isFinite(value) ? value : 0)));
  const options: StudioAutoBuildOptions = { rods: count(requested.rods), shelves: count(requested.shelves), drawers: count(requested.drawers), shoes: count(requested.shoes) };
  const layouts = blankWallLayouts();
  let design: StudioDesign = {
    version: 2, mode, mount: input.mount, finish: input.finish, wall: "back", wallWidthIn: input.wallWidthIn, roomDepthIn: input.roomDepthIn, roomHeightIn: input.roomHeightIn,
    ...(mode === "kids" ? { kids } : {}), wallLayouts: layouts, bays: layouts.back.bays,
  };
  if (design.mount === "floor" && input.roomHeightIn < 87 + STUDIO_CEILING_CLEARANCE_IN) notices.push(`A ${input.roomHeightIn} in ceiling leaves less than ${STUDIO_CEILING_CLEARANCE_IN} in above the shortest 87 in floor upright; confirm the ceiling clearance before ordering.`);

  // Reach-in (back wall only) or walk-in (back plus side walls that keep a 36 in walkway).
  const walkIn = input.roomDepthIn >= AUTO_HANG_DEPTH_IN + AUTO_WALKWAY_IN;
  const sides: StudioWall[] = [];
  if (walkIn && design.mount === "hanging") notices.push("Hanging mount is planned on the back wall only; side-wall corners are floor-mounted.");
  else if (walkIn) for (const side of ["left", "right"] as const) {
    if (input.wallWidthIn - (sides.length + 1) * AUTO_TOWER_DEPTH_IN >= AUTO_WALKWAY_IN) sides.push(side);
    else notices.push(`The ${side} wall is skipped: towers there would leave less than a ${AUTO_WALKWAY_IN} in walkway.`);
  }
  const cornerIn = STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN;
  const availableIn = (wall: StudioWall) => wall === "back" ? input.wallWidthIn - sides.length * cornerIn : input.roomDepthIn - cornerIn;
  const walls: StudioWall[] = ["back", ...sides];
  const capacity = new Map<StudioWall, { stock: number; remainderIn: number }>();
  for (const wall of walls) {
    const widths: number[] = [];
    while (widths.length < AUTO_MAX_BAYS_PER_WALL && runWidthIn([...widths, AUTO_BAY_IN]) <= availableIn(wall) + EPS) widths.push(AUTO_BAY_IN);
    capacity.set(wall, { stock: widths.length, remainderIn: roundIn(availableIn(wall) - runWidthIn(widths)) });
    if (!widths.length) notices.push(`The ${wall} wall has no room for a 24 in tower.`);
  }

  // Assign part plans round-robin across the walls, one tower per plan.
  const plans = planAutoBays(design, mode, options, kids);
  const assigned = new Map<StudioWall, AutoPlan[]>(walls.map((wall) => [wall, []]));
  const droppedPlans: AutoPlan[] = [];
  plans.forEach((plan, index) => {
    for (let step = 0; step < walls.length; step++) {
      const wall = walls[(index + step) % walls.length];
      if ((assigned.get(wall)?.length ?? 0) < (capacity.get(wall)?.stock ?? 0)) { assigned.get(wall)!.push(plan); return; }
    }
    droppedPlans.push(plan);
  });

  // Build each wall: stock towers, then one cut tower (shelves only) from a saturated wall's remainder when shelves are left over.
  const droppedShelves = droppedPlans.reduce((sum, plan) => sum + plan.specs.filter((spec) => spec.kind === "shelf").length, 0);
  let cutShelves = droppedShelves;
  const slots: { wall: StudioWall; index: number; plan: AutoPlan }[] = [];
  for (const wall of walls) {
    design = switchStudioWall(design, wall);
    const mine = assigned.get(wall) ?? [];
    for (let i = 0; i < mine.length; i++) {
      const added = addStudioBay(design, AUTO_BAY_IN);
      if (!added.ok) { notices.push(`The ${wall} wall stopped at ${i} tower${i === 1 ? "" : "s"}: ${added.reason}`); break; }
      design = replaceStudioWallBays(added.design, wall, studioBays(added.design, wall).map((bay, index) => index === i ? { ...bay, id: `${wall}-bay-${i + 1}` } : bay));
      slots.push({ wall, index: i, plan: mine[i] });
    }
    const cap = capacity.get(wall)!;
    const built = studioBays(design, wall).length;
    const saturated = mine.length >= cap.stock && built === cap.stock;
    const installedIn = roundIn(cap.remainderIn - (built ? THICKNESS : THICKNESS * 2));
    if (saturated && built < AUTO_MAX_BAYS_PER_WALL && installedIn >= CUT_PLANNING_MIN_IN) {
      if (cutShelves > 0) {
        const stockIn = installedIn <= 18 ? 18 : installedIn <= 24 ? 24 : 30;
        const cutIndex = built;
        const withTower = replaceStudioWallBays(design, wall, [...studioBays(design, wall), { id: `${wall}-bay-${cutIndex + 1}`, wallId: wall, widthIn: 18, items: [] }]);
        const cut = configureStudioBayCut(withTower, cutIndex, stockIn, installedIn);
        if (cut.ok) {
          design = cut.design;
          const shelves = Math.min(cutShelves, 5);
          cutShelves -= shelves;
          slots.push({ wall, index: cutIndex, plan: { specs: Array.from({ length: shelves }, (_, i) => ({ kind: "shelf" as const, at: 18 + i * AUTO_SHELF_STEP_IN })) } });
          notices.push(`The ${wall} wall ends in a ${installedIn} in field-cut shelf tower cut from ${stockIn} in stock; it holds shelves only because drawer, rod and shoe fit is not verified in a cut tower.`);
        } else notices.push(`The ${wall} wall's last ${installedIn} in stays empty: ${cut.reason}`);
      } else notices.push(`The ${wall} wall has ${installedIn} in left over after its towers; it stays empty.`);
    } else if (saturated && cap.remainderIn > THICKNESS && installedIn < CUT_PLANNING_MIN_IN) {
      notices.push(`The ${wall} wall has ${cap.remainderIn} in left over, too narrow for another tower (12 in minimum); it stays empty.`);
    } else if (saturated && built >= AUTO_MAX_BAYS_PER_WALL && cap.remainderIn > THICKNESS) {
      notices.push(`The ${wall} wall has ${cap.remainderIn} in left over after four towers (the Studio limit); it stays empty.`);
    }
  }

  const dropped = droppedPlans.reduce((sum, plan) => sum + plan.specs.length, 0) - (droppedShelves - cutShelves);
  if (dropped > 0) notices.push(`${dropped} part${dropped === 1 ? "" : "s"} did not fit in the available wall space and ${dropped === 1 ? "was" : "were"} left out.`);

  // Connect the two walls at each side corner with the existing visual corner shelf; if one is refused, drop that side wall.
  if (design.mount === "floor") for (const side of sides) {
    const cornerId: StudioCornerId = side === "left" ? "back-left" : "back-right";
    if (!studioBays(design, side).length) continue;
    const connected = addStudioConnectedCorner(design, cornerId, "fixed", AUTO_CORNER_ELEVATION_IN, `auto-corner-${cornerId}`);
    if (connected.ok) design = connected.design;
    else {
      design = replaceStudioWallBays(design, side, []);
      for (let i = slots.length - 1; i >= 0; i--) if (slots[i].wall === side) slots.splice(i, 1);
      notices.push(`The ${side} wall is skipped: ${connected.reason}`);
    }
  }

  // Place parts only through snapStudioPart; a refused or displaced part is skipped.
  let skipped = 0;
  for (const slot of slots) {
    design = switchStudioWall(design, slot.wall);
    slot.plan.specs.forEach((spec, n) => {
      const staged = stageStudioPart(design, slot.index, spec.kind, spec.at, `auto-${slot.wall}-${slot.index + 1}-${spec.kind}-${n + 1}`, spec.kind === "rod" || spec.kind === "drawer" ? 0.5 : 3);
      if (staged.item) design = staged.design; else skipped++;
    });
  }
  if (skipped) notices.push(`${skipped} part${skipped === 1 ? "" : "s"} could not be placed without breaking a fit or spacing rule and ${skipped === 1 ? "was" : "were"} skipped.`);
  return { design: switchStudioWall(design, "back"), notices };
}

export const autoBuildStudioDesign = (input: StudioAutoBuildInput): StudioDesign => autoBuildStudio(input).design;

/** Every priced line is from the public-only 2022 catalog. Unknown screws, anchors, cam locks and slide hardware are NOT silently counted. */
export function studioTakeoff(design: StudioDesign): StudioTakeoff {
  const rows = new Map<string, ReferenceLine>();
  const missing: string[] = [];
  const add = (p: MasterTracProduct | undefined, section: ReferenceLine["section"], qty = 1, packNote?: string, cut?: StudioShelfCut | null) => {
    if (!p) { missing.push(`A ${section} SKU or exact assembly quantity is not verified.`); return; }
    const key = `${section}:${p.sku}:${cut ? `${cut.stockWidthIn}:${cut.installedWidthIn}` : "full"}`;
    const row = rows.get(key);
    if (row) row.qty += qty;
    else {
      const cutSuffix = cut ? ` · installed ${cut.installedWidthIn}″ · cut from ${cut.stockWidthIn}″ stock` : "";
      const cutNote = cut ? `Installed ${cut.installedWidthIn}″ · planning difference ${cut.offcutIn}″ (not usable offcut; field measurement and manufacturer template/jig required)` : undefined;
      rows.set(key, {
        sku: p.sku,
        label: `${p.description} · ${p.finish}${cutSuffix}`,
        qty,
        unitUsd: p.packQty > 1 ? p.listPackUsd : p.listEachUsd,
        section,
        ...(cut ? { stockWidthIn: cut.stockWidthIn, installedWidthIn: cut.installedWidthIn, offcutIn: cut.offcutIn } : {}),
        ...(packNote ?? cutNote ? { packNote: [packNote, cutNote].filter(Boolean).join(" · ") } : {}),
      });
    }
  };
  const panelCategory = design.mount === "hanging" ? "Panels (Hang)" : "Panels (Floor)";
  const panelHeight = studioPanelHeight(design);
  let rods = 0;
  for (const wallId of STUDIO_WALLS) {
    const scoped = switchStudioWall(design, wallId);
    const bays = studioBays(scoped);
    for (let i = 0; i < bays.length; i++) {
      const bay = bays[i];
      const cut = studioBayCut(bay);
      if (cut) missing.push(`${wallId} wall Tower ${i + 1}: a matching cleat at the cut installed width is not verified; it is not substituted in the material reference.`);
      else add(studioProduct(scoped, "Cleats", /\bCleat\b/i, bay.widthIn), "cleat");
    }
    if (bays.length) {
      add(studioProduct(scoped, panelCategory, /\bLeft End\b/i, 0.75, panelHeight), "panel");
      for (let i = 1; i < bays.length; i++) add(studioProduct(scoped, panelCategory, /\bCenter Upright\b/i, 0.75, panelHeight), "panel");
      add(studioProduct(scoped, panelCategory, /\bRight End\b/i, 0.75, panelHeight), "panel");
    }
    for (let i = 0; i < bays.length; i++) {
      const bay = bays[i];
      const cut = studioBayCut(bay);
      const fixed = studioPartReferences(scoped, i, "fixedShelf")?.[0];
      add(fixed, "shelf", 2, undefined, cut);
      for (const item of bay.items) {
        const parts = studioPartReferences(scoped, i, item.kind);
        if (!parts) { missing.push(`${wallId} wall Tower ${i + 1}: ${item.kind} has no compatible verified SKU.`); continue; }
        if (item.kind === "rod") { rods++; add(parts[0], "accessory"); }
        else parts.forEach((part) => add(part, item.kind === "shelf" ? "shelf" : "accessory", 1, undefined, item.kind === "shelf" ? cut : null));
      }
    }
  }
  for (const shelf of studioCornerShelves(design)) {
    const corner = masterTracProduct(shelf.sku);
    const key = `shelf:${shelf.sku}:corner:${shelf.mount}:${shelf.geometryRevision}`;
    const row = rows.get(key);
    const cornerLabel = `${corner?.description ?? "Corner Shelf"} · ${shelf.finish} · ${shelf.mount} · 2026 planning envelope 29.5″ × 29.5″ · reference only`;
    const cornerNote = "Visual planning only · 2026 nominal envelope; 2022 manual lists 29¼″ actual · curved profile, supports, connectors, H-joint applicability, and installation fit are unverified";
    if (!corner) missing.push(`Corner shelf ${shelf.sku} is not available in the public historical source catalog.`);
    else if (row) row.qty += 1;
    else rows.set(key, { sku: corner.sku, label: cornerLabel, qty: 1, unitUsd: corner.packQty > 1 ? corner.listPackUsd : corner.listEachUsd, section: "shelf", packNote: cornerNote });
  }
  for (const placement of studioBasketPlacements(design)) {
    const product = masterTracProduct(placement.sku);
    add(product, "accessory", 1, `Visual planning only · ${placement.wallId} wall · ${placement.nominalWidthIn}″ W × ${placement.nominalHeightIn}″ H nominal envelope at ${placement.bottomIn}″ · supplier rail, door, travel, mounting, and clearance verification required`);
  }
  if (rods) {
    const cups = CLOSET_PARTS.find((p) => p.category === "Accessories" && p.finish === "Chrome" && p.packQty === 10 && /^Rod Cup \(10 Each\)/i.test(p.description));
    add(cups, "hardware", Math.ceil(rods * 2 / 10), `${rods * 2} cups required · sold in packs of 10`);
  }
  if (STUDIO_WALLS.some((wallId) => studioBays(design, wallId).some((bay) => bay.items.some((item) => item.kind === "shoe"))))
    missing.push("Shoe organizer 45° pitch is illustrative; verify supplier fit, attachment, and support requirements before ordering or installation.");
  if (studioCornerShelves(design).length)
    missing.push("Corner shelves use a 2026 29.5″ visual-planning envelope, not the unavailable curved-board profile or installation drawing. The 2022 manual lists 29¼″ actual; verify profile, supports, connectors, adjacent assembly, and fit before ordering or installation.");
  if (studioCornerShelves(design).some((shelf) => shelf.towerConnection === "visualAligned"))
    missing.push("Visual tower alignment only: incident tower runs meet the outside edges of the conservative corner envelope in this Studio preview. It does not verify a physical connection, shared support, H-joint, connector, fastener, or installation assembly.");
  if (studioBasketReferences(design).length)
    missing.push(`Basket references selected: ${studioBasketReferences(design).map((reference) => reference.sku).join(", ")}. They are not placed, priced in the material lines, or fit-approved because outer envelope, rails, mounting offsets, extension travel, and clearance requirements are not source-verified.`);
  if (studioBasketPlacements(design).length)
    missing.push(`${studioBasketPlacements(design).map((placement) => `Basket ${placement.sku} is visual planning only`).join("; ")}. Each uses only its sourced nominal width/height and the Studio 14.5″ bay depth as a conservative visual envelope; supplier rail/slide inclusion, mounting offsets, door occlusion, extension travel, vertical clearance, hardware, and installation fit remain unverified.`);
  if (STUDIO_WALLS.some((wallId) => studioBays(design, wallId).some((bay) => studioBayCut(bay)))) missing.push("Field-cut shelf planning: measure the finished opening; use the manufacturer’s adjustable-shelf template or fixed-shelf connector-hole jig as applicable. This Studio is not a cutting or drilling guide.");
  missing.push("Wall anchors, cleat fasteners, connector/cam-lock quantities, and drawer slide hardware are not verified by the provided sources; obtain the installation schedule before ordering.");
  if (design.mount === "hanging") missing.push("Hanging-panel installation elevation and fastener locations are not certified here; the 3D height is illustrative.");
  if (design.mode === "kids") missing.push(...kidsGuidance(design));
  const order: ReferenceLine["section"][] = ["cleat", "panel", "shelf", "accessory", "hardware"];
  const lines = Array.from(rows.values()).sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.sku.localeCompare(b.sku));
  return { lines, subtotalUsd: Math.round(lines.reduce((sum, line) => sum + line.qty * line.unitUsd, 0) * 100) / 100, missing };
}

export function restoreStudioDesign(raw: string | null): StudioDesign | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Partial<StudioDesign>;
    if ((v.version !== 1 && v.version !== 2 && v.version !== 3) || !STUDIO_MODES.includes(v.mode!) || !["floor", "hanging"].includes(v.mount!)
      || !STUDIO_FINISHES.includes(v.finish!) || !STUDIO_WALLS.includes(v.wall!)
      || !Number.isFinite(v.wallWidthIn) || !Number.isFinite(v.roomDepthIn)
      || v.wallWidthIn! < 24 || v.wallWidthIn! > 360 || v.roomDepthIn! < 24 || v.roomDepthIn! > 360
      || (v.cornerShelves != null && !Array.isArray(v.cornerShelves))
      || (v.basketReferences != null && !Array.isArray(v.basketReferences))
      || (v.basketPlacements != null && !Array.isArray(v.basketPlacements))
      || (v.roomHeightIn != null && (!Number.isFinite(v.roomHeightIn) || v.roomHeightIn < 72 || v.roomHeightIn > 120))
      || (v.kids != null && !validKids(v.kids)) || (v.mode === "kids" && !validKids(v.kids))) return null;
    const validBays = (bays: unknown, wallId: StudioWall, requireIdentity: boolean): bays is StudioBay[] => Array.isArray(bays) && bays.length <= 4 && bays.every((bay: StudioBay) => !!bay && typeof bay.id === "string" && Number.isFinite(bay.widthIn)
      && bay.widthIn >= CUT_PLANNING_MIN_IN && bay.widthIn <= 30
      && (!requireIdentity || bay.wallId === wallId)
      && (bay.stockWidthIn == null || (WIDTHS.includes(bay.stockWidthIn) && bay.widthIn <= bay.stockWidthIn + EPS))
      && (bay.stockWidthIn != null || WIDTHS.includes(bay.widthIn as 18 | 24 | 30))
      && Array.isArray(bay.items) && bay.items.every((item: StudioItem) => !!item && typeof item.id === "string" && STUDIO_PART_KINDS.includes(item.kind) && Number.isFinite(item.bottomIn) && (!requireIdentity || item.wallId === wallId)));
    let design: StudioDesign;
    if (v.version === 1) {
      if (!validBays(v.bays, v.wall!, false) || !v.bays.length) return null;
      const wallLayouts = blankWallLayouts();
      wallLayouts[v.wall!] = { wallId: v.wall!, bays: withWallIdentity(v.bays, v.wall!) };
      design = { ...(v as StudioDesign), version: 2, wallLayouts, bays: wallLayouts[v.wall!].bays };
    } else {
      if (!v.wallLayouts || typeof v.wallLayouts !== "object") return null;
      const wallLayouts = blankWallLayouts();
      for (const wallId of STUDIO_WALLS) {
        const layout = v.wallLayouts[wallId];
        if (!layout || layout.wallId !== wallId || !validBays(layout.bays, wallId, true)) return null;
        wallLayouts[wallId] = { wallId, bays: withWallIdentity(layout.bays, wallId) };
      }
      if (!Array.isArray(v.bays) || JSON.stringify(v.bays) !== JSON.stringify(wallLayouts[v.wall!].bays)) return null;
      design = { ...(v as StudioDesign), version: v.version, wallLayouts, bays: wallLayouts[v.wall!].bays, ...(v.basketPlacements ? { basketPlacements: v.basketPlacements } : {}) };
    }
    for (const wallId of STUDIO_WALLS) {
      const scoped = switchStudioWall(design, wallId);
      const bays = studioBays(scoped);
      if (studioWidth(scoped) > studioWallLength(scoped)) return null;
      for (let i = 0; i < bays.length; i++) {
        if (studioBayCut(bays[i]) && scoped.mount !== "floor") return null;
        if (!studioPartReferences(scoped, i, "fixedShelf")) return null;
        for (const item of bays[i].items) if (studioCollision(scoped, i, item, item.id) || !studioPartReferences(scoped, i, item.kind)) return null;
      }
    }
    const seenCornerIds = new Set<string>();
    for (const shelf of studioCornerShelves(design)) {
      if (!shelf || typeof shelf.id !== "string" || seenCornerIds.has(shelf.id)
        || !Object.values(STUDIO_CORNER_SHELF_SKUS).some((variants) => Object.values(variants).includes(shelf.sku)) || shelf.finish !== design.finish
        || !["fixed", "adjustable"].includes(shelf.mount) || shelf.profile !== "curved-illustrative"
        || !["back-left", "back-right", "front-left", "front-right"].includes(shelf.cornerId)
        || !Array.isArray(shelf.wallIds) || shelf.wallIds.length !== 2 || !STUDIO_WALLS.includes(shelf.wallIds[0]) || !STUDIO_WALLS.includes(shelf.wallIds[1])
        || !Number.isFinite(shelf.elevationIn) || shelf.nominalFootprintIn !== STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN
        || shelf.geometryRevision !== STUDIO_CORNER_SHELF_GEOMETRY_REVISION || shelf.geometrySource !== "MasterTrac Spec Book NP 2026 p. 13"
        || (shelf.towerConnection != null && shelf.towerConnection !== "visualAligned") || shelf.capability !== "visualPlanning") return null;
      seenCornerIds.add(shelf.id);
    }
    if (studioCornerDesignError(design)) return null;
    const seenBasketIds = new Set<string>();
    for (const reference of studioBasketReferences(design)) {
      const option = STUDIO_BASKET_REFERENCE_OPTIONS.find((entry) => entry.sku === reference?.sku);
      const product = reference ? masterTracProduct(reference.sku) : undefined;
      if (!reference || typeof reference.id !== "string" || seenBasketIds.has(reference.id)
        || reference.finish !== "Chrome" || reference.capability !== "referenceOnly" || reference.sourceRevision !== "floor-579554-p13-historical-reference-v1"
        || !option || reference.nominalHeightIn !== option.nominalHeightIn || reference.nominalWidthIn !== option.nominalWidthIn
        || !product || product.finish !== "Chrome" || product.category !== "Accessories" || product.placeable || studioFitCapability(reference.sku)?.status !== "visualPlanning") return null;
      seenBasketIds.add(reference.id);
    }
    const seenBasketPlacementIds = new Set<string>();
    for (const placement of studioBasketPlacements(design)) {
      const option = basketOption(placement?.sku);
      const product = placement ? masterTracProduct(placement.sku) : undefined;
      if (!placement || typeof placement.id !== "string" || seenBasketPlacementIds.has(placement.id)
        || !STUDIO_WALLS.includes(placement.wallId) || !option || placement.finish !== "Chrome"
        || placement.nominalHeightIn !== option.nominalHeightIn || placement.nominalWidthIn !== option.nominalWidthIn
        || placement.nominalDepthIn !== STUDIO_BASKET_VISUAL_DEPTH_IN || !Number.isFinite(placement.bottomIn)
        || typeof placement.bayId !== "string" || placement.sourceRevision !== "floor-579554-p13-historical-basket-visual-envelope-v1"
        || placement.capability !== "visualPlanning" || !product || product.finish !== "Chrome" || product.category !== "Accessories"
        || studioFitCapability(placement.sku)?.status !== "visualPlanning") return null;
      seenBasketPlacementIds.add(placement.id);
    }
    if (studioBasketDesignError(design)) return null;
    return design;
  } catch { return null; }
}
