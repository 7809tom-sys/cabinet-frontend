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
export type StudioBay = { id: string; widthIn: number; stockWidthIn?: StudioStockWidth; wallId?: StudioWall; items: StudioItem[] };
export type StudioWallLayout = { wallId: StudioWall; bays: StudioBay[] };
export type StudioWallOccupancy = { wallId: StudioWall; usedSpanIn: number; availableSpanIn: number; bayCount: number; itemCount: number; cornerCount: number; cornerSpanIn: number; filled: boolean };
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
/** Every straight shelf/cleat stock width the March 2022 sheet actually sells for a 14.5 in floor tower. */
export const STUDIO_STOCK_WIDTHS = [18, 24, 30, 36, 42] as const;
export type StudioStockWidth = typeof STUDIO_STOCK_WIDTHS[number];
export type StudioShelfCut = { stockWidthIn: StudioStockWidth; installedWidthIn: number; offcutIn: number };
export type ReferenceLine = { sku: string; label: string; qty: number; unitUsd: number; section: "cleat" | "panel" | "shelf" | "accessory" | "hardware"; packNote?: string; stockWidthIn?: number; installedWidthIn?: number; offcutIn?: number };
export type StudioTakeoff = { lines: ReferenceLine[]; subtotalUsd: number; missing: string[] };

const THICKNESS = 0.75;
const WIDTHS = STUDIO_STOCK_WIDTHS;
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
/** Where along its own wall a tower run begins: past the corner shelf, else past the back run's bay depth so the two runs never interpenetrate. */
const AUTO_SIDE_CLEAR_IN = 14.5;
export const studioWallStartIn = (design: StudioDesign, wall: StudioWall = design.wall): number => {
  if (wall !== "left" && wall !== "right") return 0;
  const connected = studioCornerShelves(design).find((shelf) => shelf.towerConnection === "visualAligned" && shelf.wallIds.includes(wall));
  return connected ? STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN : studioBays(design, "back").length ? AUTO_SIDE_CLEAR_IN : 0;
};
export const studioWallOccupancy = (design: StudioDesign): Record<StudioWall, StudioWallOccupancy> => Object.fromEntries(STUDIO_WALLS.map((wallId) => {
  const bays = studioBays(design, wallId);
  const corners = studioCornerShelvesForWall(design, wallId);
  /**
   * A corner shelf is a floor-mounted 29.5 in board that occupies that much of every wall it touches,
   * so it counts as used wall. Reporting only tower width made a wall with two corner shelves read
   * as "19.5 of 84 in used", which looked like a planning gap that was not there.
   */
  const cornerSpanIn = Math.round(corners.reduce((sum, shelf) => sum + shelf.nominalFootprintIn, 0) * 100) / 100;
  const usedSpanIn = Math.round((studioWidthForWall(design, wallId) + cornerSpanIn) * 100) / 100;
  return [wallId, { wallId, usedSpanIn, availableSpanIn: studioWallLength(design, wallId), bayCount: bays.length, itemCount: bays.reduce((sum, bay) => sum + bay.items.length, 0), cornerCount: corners.length, cornerSpanIn, filled: bays.length > 0 || corners.length > 0 }];
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
  if (wall === "left") return { xMin: 0, xMax: 14.5, zMin: studioWallStartIn(design, "left"), zMax: studioWallStartIn(design, "left") + span };
  if (wall === "right") return { xMin: design.wallWidthIn - 14.5, xMax: design.wallWidthIn, zMin: studioWallStartIn(design, "right"), zMax: studioWallStartIn(design, "right") + span };
  return { xMin: 0, xMax: span, zMin: 0, zMax: 14.5 };
};
const intervalsOverlap = (aMin: number, aMax: number, bMin: number, bMax: number) => aMin < bMax - EPS && bMin < aMax - EPS;
const footprintsOverlap = (a: StudioFootprint, b: StudioFootprint) => intervalsOverlap(a.xMin, a.xMax, b.xMin, b.xMax) && intervalsOverlap(a.zMin, a.zMax, b.zMin, b.zMax);

/**
 * The viewer presents every wall in one canonical frame: the active run always lies along +X with
 * its board face toward the camera (+Z), so back, left, right and front walls share one framing,
 * one scale and one set of annotations instead of a per-wall render path.
 */
export type StudioWallFrame = { yaw: number; rotationY: number; x: number; z: number };

/** `yaw` is the camera azimuth that looks at this wall from inside the room; the rest places a canonical tower on it. */
export function studioWallFrame(design: StudioDesign, wall: StudioWall = design.wall): StudioWallFrame {
  const footprint = studioTowerFootprint(design, wall);
  const frame = (rotationY: number, x: number, z: number): StudioWallFrame => ({ rotationY, yaw: -rotationY, x, z });
  if (wall === "left") return frame(-Math.PI / 2, footprint.zMax, -footprint.xMin);
  if (wall === "right") return frame(Math.PI / 2, -footprint.zMin, footprint.xMax);
  if (wall === "front") return frame(Math.PI, footprint.xMax, footprint.zMax);
  return frame(0, -footprint.xMin, -footprint.zMin);
}

/**
 * Where the active wall's tower run lands once the wall frame is applied. This is the same for every
 * wall, which is what lets one framing call serve a back, side or front view.
 */
export function studioCanonicalTowerFootprint(design: StudioDesign, wall: StudioWall = design.wall): StudioFootprint {
  const footprint = studioTowerFootprint(design, wall);
  const frame = studioWallFrame(design, wall);
  const cos = Math.cos(frame.rotationY);
  const sin = Math.sin(frame.rotationY);
  const points = [
    { x: footprint.xMin, z: footprint.zMin }, { x: footprint.xMax, z: footprint.zMin },
    { x: footprint.xMin, z: footprint.zMax }, { x: footprint.xMax, z: footprint.zMax },
  ].map((point) => ({
    x: point.x * cos + point.z * sin + frame.x,
    z: -point.x * sin + point.z * cos + frame.z,
  }));
  return {
    xMin: Math.min(...points.map((point) => point.x)), xMax: Math.max(...points.map((point) => point.x)),
    zMin: Math.min(...points.map((point) => point.z)), zMax: Math.max(...points.map((point) => point.z)),
  };
}

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
export function configureStudioBayCut(design: StudioDesign, bayIndex: number, stockWidthIn: StudioStockWidth, installedWidthIn: number):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const bays = studioBays(design);
  const bay = bays[bayIndex];
  if (!bay) return { ok: false, reason: "Choose a tower bay." };
  if (design.mount !== "floor") return { ok: false, reason: "Cut-to-fit planning is documented here only for floor-mounted straight shelves." };
  if (!WIDTHS.includes(stockWidthIn)) return { ok: false, reason: `Choose a sourced ${STUDIO_STOCK_WIDTHS.join(", ").replace(/, ([^,]*)$/, " or $1")} inch stock shelf.` };
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
/**
 * Adds a tower and reports where it landed. A new tower is inserted at `insertIndex` (end by default),
 * so every tower before it keeps its parts and only its on-wall position moves over.
 */
export function insertStudioBay(design: StudioDesign, widthIn: StudioStockWidth = 24, insertIndex?: number, id = `bay-${Date.now()}`):
  { ok: true; design: StudioDesign; index: number } | { ok: false; reason: string } {
  const bays = studioBays(design);
  if (!WIDTHS.includes(widthIn) || bays.length >= 4) return { ok: false, reason: "Choose up to four sourced tower bays." };
  const index = Math.max(0, Math.min(bays.length, Math.round(Number.isFinite(insertIndex ?? NaN) ? insertIndex! : bays.length)));
  const inserted: StudioBay = { id, wallId: design.wall, widthIn, items: [] };
  const candidate = replaceStudioWallBays(design, design.wall, [...bays.slice(0, index), inserted, ...bays.slice(index)]);
  if (studioWidth(candidate) > studioWallLength(candidate)) return { ok: false, reason: "No wall space for a neighboring tower. Choose another wall or a narrower bay." };
  const cornerError = studioCornerDesignError(candidate);
  if (cornerError) return { ok: false, reason: cornerError };
  const basketError = studioBasketDesignError(candidate);
  if (basketError) return { ok: false, reason: basketError };
  return { ok: true, design: candidate, index };
}

export function addStudioBay(design: StudioDesign, widthIn: StudioStockWidth = 24):
  { ok: true; design: StudioDesign } | { ok: false; reason: string } {
  const result = insertStudioBay(design, widthIn);
  return result.ok ? { ok: true, design: result.design } : result;
}

/**
 * The tower the viewer should keep in the middle of the panel: a brand-new tower is the one the user
 * just created, and any other design change keeps the already-selected tower.
 */
export const studioCenteredBayIndex = (design: StudioDesign, selectedBay: number, focusId?: string | null): number => {
  const bays = studioBays(design);
  if (!bays.length) return 0;
  if (focusId) {
    const found = bays.findIndex((bay) => bay.id === focusId);
    if (found >= 0) return found;
  }
  return Math.max(0, Math.min(bays.length - 1, selectedBay));
};

/** First shelf height: the owner's 4.5-in mark above the floor, never inside the fixed bottom shelf. */
export const STUDIO_SHELF_LADDER_START_IN = 4.5;
export const STUDIO_SHELF_LADDER_SPACING_IN = 10;
export const STUDIO_SHELF_LADDER_MAX_COUNT = 12;

export type StudioShelfLadderResult = { ok: true; design: StudioDesign; placed: StudioItem[]; skipped: number[]; spacings: number[] } | { ok: false; reason: string };

/**
 * Places shelves from the bottom up at a fixed spacing. The first shelf sits at the 4.5-in mark
 * (raised only as far as the fixed bottom shelf requires), then every `spacingIn` above it. Each
 * shelf still goes through snapStudioPart, so the fixed top, collisions and sourced SKUs are
 * enforced; shelf numbers that cannot fit are reported rather than forced.
 */
export function placeStudioShelfLadder(design: StudioDesign, bayIndex: number, count: number, spacingIn = STUDIO_SHELF_LADDER_SPACING_IN):
  StudioShelfLadderResult {
  const bay = studioBays(design)[bayIndex];
  if (!bay) return { ok: false, reason: "Choose a tower before adding a shelf run." };
  const total = Math.round(Number.isFinite(count) ? count : 0);
  if (total < 1) return { ok: false, reason: "Enter at least one shelf." };
  if (total > STUDIO_SHELF_LADDER_MAX_COUNT) return { ok: false, reason: `A shelf run is limited to ${STUDIO_SHELF_LADDER_MAX_COUNT} shelves at a time.` };
  const spacing = Math.round((Number.isFinite(spacingIn) ? spacingIn : STUDIO_SHELF_LADDER_SPACING_IN) * 100) / 100;
  if (!(spacing >= 2)) return { ok: false, reason: "Enter a shelf spacing of at least 2 in." };
  const startIn = Math.max(STUDIO_SHELF_LADDER_START_IN, studioFixedBottom(design) + THICKNESS);
  let next = design;
  const placed: StudioItem[] = [];
  const skipped: number[] = [];
  const spacings: number[] = [];
  for (let index = 0; index < total; index++) {
    const target = Math.round((startIn + index * spacing) * 4) / 4;
    // Placement is validated at the quarter-inch the user asked for, not silently rounded to an inch,
    // so the 4.5-in start and a 10-in pitch land where the tool says they will.
    const moved = stageShelfAt(next, bayIndex, target, `shelf-ladder-${index + 1}-${Date.now()}`);
    if (moved) {
      next = moved.design;
      placed.push(moved.item);
      spacings.push(Math.round((moved.item.bottomIn - startIn) * 100) / 100);
    } else skipped.push(index + 1);
  }
  if (!placed.length) return { ok: false, reason: "No shelf in this run fits between the fixed shelves. Remove a part or use a wider spacing." };
  return { ok: true, design: next, placed, skipped, spacings };
}

/** One shelf at one exact quarter-inch height, through the same sourced-SKU and collision rules as a drop. */
function stageShelfAt(design: StudioDesign, bayIndex: number, bottomIn: number, id: string):
  { design: StudioDesign; item: StudioItem } | null {
  const bay = studioBays(design)[bayIndex];
  if (!bay) return null;
  if (!studioPartReferences(design, bayIndex, "shelf")) return null;
  const candidate: StudioItem = { id, kind: "shelf", bottomIn, wallId: design.wall };
  if (studioCollision(design, bayIndex, candidate)) return null;
  return { design: replaceStudioWallBays(design, design.wall, studioBays(design).map((current, index) => index === bayIndex ? { ...current, items: [...current.items, candidate] } : current)), item: candidate };
}

/**
 * Sets one shelf to an exact bottom height. The value is validated by the same collision and
 * fixed-top rules as a drag, so a typed height can never force an overlap.
 */
export function setStudioShelfHeight(design: StudioDesign, bayIndex: number, itemId: string, bottomIn: number):
  { ok: true; design: StudioDesign; item: StudioItem } | { ok: false; reason: string } {
  const item = studioBays(design)[bayIndex]?.items.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: "Choose a placed shelf first." };
  if (!Number.isFinite(bottomIn)) return { ok: false, reason: "Enter a shelf height in inches." };
  const snapped = studioSnapShelfHeight(design, bottomIn);
  if (Math.abs(snapped - bottomIn) > 0.001) return { ok: false, reason: `A shelf height must be between ${studioSnapShelfHeight(design, 0)} and ${studioSnapShelfHeight(design, studioFixedTop(design))} in, in ¼-in steps.` };
  const error = studioCollision(design, bayIndex, { ...item, bottomIn: snapped }, itemId);
  if (error) return { ok: false, reason: error };
  return {
    ok: true,
    item: { ...item, bottomIn: snapped },
    design: replaceStudioWallBays(design, design.wall, studioBays(design).map((bay, index) => index === bayIndex
      ? { ...bay, items: bay.items.map((existing) => existing.id === itemId ? { ...existing, bottomIn: snapped } : existing) } : bay)),
  };
}

/** Quarter-inch drag heights, clamped to the opening so the live inch readout is always placeable. */
export const studioSnapShelfHeight = (design: StudioDesign, bottomIn: number) => {
  const min = studioFixedBottom(design) + THICKNESS;
  const max = Math.max(min, studioFixedTop(design) - THICKNESS);
  const clamped = Math.max(min, Math.min(max, bottomIn));
  return Math.round(clamped * 4) / 4;
};

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

/**
 * The guided flow's four plain-language questions. Every answer is a small named enum so the
 * UI, the tests, and this planner all speak the same vocabulary instead of raw part counts.
 */
export type StudioGuidedClosetType = "reachIn" | "walkIn";
export type StudioGuidedStorageMix = "mostlyHanging" | "balanced" | "mostlyShelving";
export type StudioGuidedYesNo = "yes" | "no";
export type StudioGuidedAmount = "none" | "some" | "lots";
export type StudioGuidedAnswers = {
  closetType: StudioGuidedClosetType;
  storageMix: StudioGuidedStorageMix;
  longHang: StudioGuidedYesNo;
  drawers: StudioGuidedAmount;
  shoes: StudioGuidedAmount;
  /**
   * Corner shelf choice. Only meaningful for a walk-in big enough for `studioCornerOption`; the
   * question is not shown at all otherwise, and the builder ignores the flag in that case.
   */
  cornerShelves?: StudioGuidedYesNo;
};

export const STUDIO_GUIDED_DEFAULTS: StudioGuidedAnswers = {
  closetType: "reachIn", storageMix: "balanced", longHang: "yes", drawers: "some", shoes: "some", cornerShelves: "no",
};

const GUIDED_AMOUNT_COUNT: Record<StudioGuidedAmount, number> = { none: 0, some: 2, lots: 4 };
/** Shelves per dedicated shelving bay. Kept low so the answers still fit a normal room. */
const GUIDED_SHELVES_PER_SHELVING_BAY = 3;

/**
 * How many bays each storage mix spends on hanging versus shelves. Kept deliberately modest so
 * a typical room can hold everything the answers ask for: a guided build that over-asks would
 * silently drop parts, and then the summary would describe a closet the user did not choose.
 */
const GUIDED_MIX_UNITS: Record<StudioGuidedStorageMix, { hangingUnits: number; shelvingUnits: number }> = {
  mostlyHanging: { hangingUnits: 2, shelvingUnits: 0 },
  balanced: { hangingUnits: 1, shelvingUnits: 1 },
  mostlyShelving: { hangingUnits: 1, shelvingUnits: 2 },
};

/**
 * Turns the guided answers into the rod/shelf/drawer/shoe counts that `autoBuildStudio` already
 * consumes. Pure and deterministic: the same answers always produce the same counts, and the
 * builder below still runs every fit and collision rule, so nothing is forced into the room.
 *
 * Rods: a normally hung bay gets a double hanging run (2 rods). Answering "yes" to long hanging
 *        turns one of those bays into a single high rod, so dresses and coats hang straight.
 * Shelves: each shelving bay gets 4 shelves; each hanging bay gets the shelf above its upper rod,
 *          plus the extra shelving the storage mix asked for.
 * Drawers/shoes: none/some/lots map to 0/2/4 of that part.
 */
export function studioGuidedPartCounts(answers: StudioGuidedAnswers): StudioAutoBuildOptions {
  const mix = GUIDED_MIX_UNITS[answers.storageMix] ?? GUIDED_MIX_UNITS.balanced;
  const hangingUnits = Math.max(1, mix.hangingUnits);
  const shelvingUnits = mix.shelvingUnits;
  /**
   * One bay becomes the long-hang bay when long hanging is asked for, which removes one rod.
   *
   * A reach-in then needs a floor. The owner's brief calls for a reach-in to be *mostly double hang
   * with one long-hang bay*, but the mix answer can ask for a single hanging bay — and once one rod
   * becomes the long hang there is no double hang left at all. Three rods guarantees one long-hang
   * bay plus a real double-hang bay. The floor is reach-in only; a walk-in spreads hanging across
   * side walls and needs no padding. Applied after the subtraction, so the floor is a guarantee of
   * double hang rather than a reshuffle of the count.
   */
  let rods = hangingUnits * 2 - (answers.longHang === "yes" ? 1 : 0);
  if (answers.closetType === "reachIn" && answers.longHang === "yes") rods = Math.max(rods, 3);
  const shelves = shelvingUnits * GUIDED_SHELVES_PER_SHELVING_BAY + hangingUnits;

  return {
    rods: Math.min(rods, STUDIO_AUTO_BUILD_MAX_COUNT),
    shelves: Math.min(shelves, STUDIO_AUTO_BUILD_MAX_COUNT),
    drawers: GUIDED_AMOUNT_COUNT[answers.drawers],
    shoes: GUIDED_AMOUNT_COUNT[answers.shoes],
  };
}

/**
 * Sensible starting room sizes, in inches. These are the sizes where the whole guided answer set
 * reliably fits: a narrow walk-in leaves no room for the corner envelopes the builder reserves, so
 * the default walk-in starts at 8 ft wide instead of the smallest preset. Users can still type any
 * size, and the presets below them are one tap away.
 */
export const STUDIO_GUIDED_ROOM_DEFAULTS: Record<StudioGuidedClosetType, { wallWidthIn: number; roomDepthIn: number; roomHeightIn: number }> = {
  // The "Roomy bedroom reach-in" preset: still an ordinary bedroom closet, but wide and deep
  // enough that the guided answers (drawers included) actually fit.
  reachIn: { wallWidthIn: 78, roomDepthIn: 30, roomHeightIn: STUDIO_ROOM_HEIGHT_DEFAULT_IN },
  walkIn: { wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: STUDIO_ROOM_HEIGHT_DEFAULT_IN },
};

/** The whole guided build, so the page and the tests share one entry point. */
export function autoBuildStudioFromAnswers(input: {
  answers: StudioGuidedAnswers;
  mount: StudioMount;
  finish: StudioDesign["finish"];
  room: { wallWidthIn: number; roomDepthIn: number; roomHeightIn: number };
  mode?: StudioMode;
  kids?: StudioDesign["kids"];
}): StudioAutoBuildResult & { options: StudioAutoBuildOptions } {
  const options = studioGuidedPartCounts(input.answers);
  const result = autoBuildStudio({
    mode: input.mode ?? "closet",
    mount: input.mount,
    finish: input.finish,
    ...input.room,
    kids: input.kids,
    options,
    longHangBay: input.answers.longHang === "yes",
    cornerShelves: input.answers.cornerShelves === "yes",
  });
  return { ...result, options };
}

/**
 * Plain-language summary of a finished guided build. Counts come from the design itself (not the
 * requested options), so a part the fit rules skipped is never claimed in the sales copy.
 */
export function studioGuidedSummaryLines(design: StudioDesign, answers: StudioGuidedAnswers): string[] {
  const bays = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall));
  const items = bays.flatMap((bay) => bay.items);
  const count = (kind: StudioKind) => items.filter((item) => item.kind === kind).length;
  const rods = count("rod");
  const shelves = count("shelf");
  const drawers = count("drawer");
  const shoes = count("shoe");
  const hangingBays = bays.filter((bay) => bay.items.some((item) => item.kind === "rod")).length;

  const lines: string[] = [];
  lines.push(answers.closetType === "walkIn" ? "A walk-in closet: shelves and hanging space on more than one wall." : "A reach-in closet: one wall of shelves and hanging space.");
  if (rods) lines.push(hangingBays === 1 ? "Hanging space in one tower, with room for clothes on hangers." : `Hanging space in ${hangingBays} towers, with room for clothes on hangers.`);
  if (answers.longHang === "yes" && rods) lines.push("One hanging area is kept high and clear for long dresses and coats.");
  if (shelves) lines.push(shelves === 1 ? "A shelf for folded clothes, bins, and baskets." : `${shelves} shelves for folded clothes, bins, and baskets.`);
  if (drawers) lines.push(`${drawers} drawer${drawers === 1 ? "" : "s"} for smaller things you would rather not see.`);
  else if (answers.drawers !== "none") lines.push("No drawers fit in this room, so everything is open shelving and hanging.");
  if (shoes) lines.push(shoes === 1 ? "A shoe shelf to keep pairs together on the floor." : `${shoes} shoe shelves to keep pairs together on the floor.`);
  else if (answers.shoes !== "none") lines.push("No separate shoe shelf fit, so shoes go on the lowest shelf.");
  const cornerShelves = studioCornerShelves(design);
  if (cornerShelves.length) lines.push(`${cornerShelves.length === 1 ? "A curved corner shelf" : `${cornerShelves.length} curved corner shelves`} fill the corner${cornerShelves.length === 1 ? "" : "s"} where the walls meet.`);
  const totalBays = bays.length;
  lines.push(`${totalBays} tall tower${totalBays === 1 ? "" : "s"} in the ${design.finish} finish. You can change any of this below.`);
  return lines;
}

export type StudioAutoBuildInput = {
  mode: StudioMode; mount: StudioMount; finish: StudioDesign["finish"];
  wallWidthIn: number; roomDepthIn: number; roomHeightIn: number;
  kids?: StudioDesign["kids"]; options?: StudioAutoBuildOptions;
  /** Guided flow only: put one bay's hanging on a single high rod for long dresses and coats. */
  longHangBay?: boolean;
  /**
   * Guided flow only: the customer asked for the 29.5 in MasterTrac corner shelf. Honoured only where
   * `studioCornerOption` offers it; reach-ins and small walk-ins fall back to shared-geometry corners
   * so their walls still fill, and the build says so in its notices.
   */
  cornerShelves?: boolean;
};
export type StudioAutoBuildResult = { design: StudioDesign; notices: string[] };

const AUTO_HANG_DEPTH_IN = 24;
const AUTO_WALKWAY_IN = 36;
const AUTO_TOWER_DEPTH_IN = 14.5;
const AUTO_MAX_BAYS_PER_WALL = 4;
const AUTO_CORNER_ELEVATION_IN = 36;
const AUTO_SHELF_STEP_IN = 12;
/**
 * A layout may not add a whole extra tower to gain less than this much filled wall. Without it the
 * search would answer an 84 in wall with four 18–24 in bays instead of three 24–30 in bays that
 * cover the same span with two fewer uprights and one fewer cleat.
 */
const AUTO_FILL_BAY_PENALTY_IN = 1.5;
/** Drawer boxes and shoe shelves are only sourced at 18, 24 and 30 in, so a wider bay hosts hanging and shelving only. */
const AUTO_STORAGE_WIDTHS = [18, 24, 30] as const;

/* ----------------------------------------------------------------------------------------------
 * General closet-design rules (Owner brief, Tom, Nov 2026). These come from standard closet
 * planning guides, NOT from a MasterTrac specification, so every one of them is applied through
 * the same sourced-part fit rules. Where a guide figure conflicts with what MasterTrac actually
 * sells or with the 14.5 in board depth, the sourced geometry wins and `AUTO_GUIDE_CONFLICTS`
 * records the difference so the UI can state it instead of silently pretending they agree.
 * ---------------------------------------------------------------------------------------------- */

/** A 29.5 in corner bay is treated as a double-hang anchor section, with rods at about 40 and 82 in. */
export const AUTO_ANCHOR_LOWER_ROD_IN = 40;
export const AUTO_ANCHOR_UPPER_ROD_IN = 82;
/**
 * Long hang (dresses and coats) needs a clear drop. Guides ask for 8–13 in of *extra* width beyond
 * a normal bay, with an 18 in floor. MasterTrac's narrowest stocked bay is 18 in, so the floor and
 * the guide's own minimum agree; the extra width is applied to whichever bay hosts the long hang.
 */
export const AUTO_LONG_HANG_MIN_BAY_IN = 18;
export const AUTO_LONG_HANG_EXTRA_IN = 13;
/**
 * Rod clearance is the source conflict. A guide's 82 in upper rod cannot also leave the 72 in of
 * clear drop this planner requires for a dress, because MasterTrac floor uprights are 87 or 94 in
 * tall and a rod needs to clear the fixed top shelf. The planner therefore puts a long-hang rod at
 * the stocked height that still leaves a real dress drop, and reports the guide's 82 in figure as
 * unavailable in this panel height. Same idea for the 40 in lower rod: it is used exactly as the
 * guide asks wherever the geometry allows it.
 */
export const AUTO_GUIDE_CONFLICTS = [
  "A guide's 82 in upper rod is not usable in this closet: MasterTrac floor uprights are 87 or 94 in tall, so an 82 in rod cannot leave the clear drop a long dress needs above the floor.",
  "Guide dimensions are general closet-planning guidance, not MasterTrac specifications. Every part, width and elevation here still resolves to the sourced March 2022 catalog.",
] as const;

/** Shelf openings a tighter middle filler bay gets: folded clothes, shoes, boots. */
export const AUTO_FILLER_SHELF_GAPS = { foldedIn: 13, shoesIn: 9, bootsIn: 17 } as const;
/** A filler bay this narrow is a middle bay between hanging sections; above it the bay gets normal shelves. */
const AUTO_FILLER_BAY_MAX_IN = 14;
/** A side-wall section starts this far forward from the back wall, bridged by the corner shelf. */
export const AUTO_SIDE_SECTION_START_IN = 24;
/** The corner shelf must bridge at least this much, and may not exceed the guide's upper bound. */
export const AUTO_SIDE_SECTION_MAX_IN = 30;
/**
 * The source reconciliation for that rule. The guide asks for side-wall sections to start 24–30 in
 * from the back wall, "bridged by a corner shelf". MasterTrac's only real corner shelf is a 29.5 in
 * board, and it occupies exactly that much of both incident walls — so the side run starts at
 * 29.5 in and the guide's own range is satisfied by the sourced dimension, not approximated to it.
 * Checked here once so the two numbers cannot drift apart silently.
 */
export const AUTO_SIDE_SECTION_BRIDGES_GUIDE_RANGE =
  STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN >= AUTO_SIDE_SECTION_START_IN - 0.000001
  && STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN <= AUTO_SIDE_SECTION_MAX_IN + 0.000001;
/** How far a drawer bank stays clear of a reach-in door swing, measured from the entry end. */
export const AUTO_DOOR_SWING_CLEARANCE_IN = 30;

/**
 * When a closet may be offered the 29.5 in MasterTrac corner shelf.
 *
 * Tom's rule: every **walk-in** is offered it, because a corner shelf is a real layout choice that
 * adds shelf spots, and **reach-ins never are** — a reach-in is one wall, so a corner shelf there
 * would only shorten the single run the customer has. Reach-in corners therefore always stay shared
 * geometry so the wall fills end to end.
 *
 * "Walk-in" is not a new idea here: it is the same test `autoBuildStudio` already uses to decide
 * whether side walls are worth planning at all —
 *
 *     depth ≥ 24 in hanging + 36 in walkway = 60 in
 *
 * A corner shelf still has to be *usable*, though: it occupies 29.5 in of both incident walls, so
 * every wall must keep at least one real 18 in tower beside it. `studioCornerOption` proves that
 * with the same fill math the builder uses instead of trusting a hardcoded size, and reports the
 * inches involved so the UI can explain it. That keeps the threshold in one place and makes it
 * impossible for the offer to drift away from what the builder can actually place.
 */
export const STUDIO_CORNER_MIN_WALKWAY_IN = 36;
export const STUDIO_CORNER_MIN_HANG_DEPTH_IN = 24;
/** A walk-in needs hanging depth plus a walkway before it has a usable room corner. */
export const STUDIO_CORNER_WALK_IN_MIN_DEPTH_IN = STUDIO_CORNER_MIN_HANG_DEPTH_IN + STUDIO_CORNER_MIN_WALKWAY_IN;

export type StudioCornerOption = {
  /** True for every walk-in whose walls can still hold a real tower beside a corner shelf. */
  offered: boolean;
  /** Plain-language reason, used by the guided flow and by the build notices. */
  reason: string;
};

/** Single source of truth for "may this closet be offered a corner shelf?". Used by the UI and the planner. */
export function studioCornerOption(room: { closetType: StudioGuidedClosetType; wallWidthIn: number; roomDepthIn: number; mount?: StudioMount }): StudioCornerOption {
  if (room.closetType === "reachIn") return { offered: false, reason: "A reach-in is one wall, so a corner shelf would only shorten the run you already have." };
  if (room.mount === "hanging") return { offered: false, reason: "Corner shelves are floor-mounted, so they are not offered on a hanging closet." };
  const cornerIn = STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN;
  const sideSpanIn = room.roomDepthIn - cornerIn;
  const backSpanIn = room.wallWidthIn - 2 * cornerIn;
  if (!studioWallFill(sideSpanIn).widths.length) return { offered: false, reason: `A corner shelf needs ${cornerIn} in of the side wall and still one ${STUDIO_STOCK_WIDTHS[0]} in tower; this room is too shallow for that.` };
  if (!studioWallFill(backSpanIn).widths.length) return { offered: false, reason: `Two corner shelves need ${2 * cornerIn} in of the back wall and still one ${STUDIO_STOCK_WIDTHS[0]} in tower; this back wall is too short for that.` };
  return { offered: true, reason: "This walk-in can keep a real tower on every wall beside the corner shelves." };
}
type AutoSpec = { kind: StudioKind; at: number };
/**
 * What a planned bay is *for*. The wall rules below need this: hanging belongs on short walls,
 * drawers centred on the back wall, shoes by the door, and only one long hang per closet.
 */
export type AutoPlanRole = "longHang" | "anchor" | "filler" | "drawer" | "shoe" | "storage";
type AutoPlan = { specs: AutoSpec[]; role?: AutoPlanRole; /** A narrow middle bay that takes closely spaced shelves instead of hanging. */ filler?: boolean; /** Long-hang bays are kept off the back wall in a walk-in. */ preferSideWall?: boolean };
const runWidthIn = (widths: number[]) => widths.length ? widths.reduce((sum, width) => sum + width, 0) + THICKNESS * (widths.length + 1) : 0;
const roundIn = (value: number) => Math.round(value * 100) / 100;

/** The real 18–42 in towers a wall can be covered with, and what that leaves unused. */
export type StudioWallFill = { wallId: StudioWall; widths: StudioStockWidth[]; availableIn: number; usedIn: number; leftoverIn: number };

/** Widest first, so every width multiset is generated exactly once and wider bays win a same-span tie. */
const AUTO_WIDTHS_WIDEST_FIRST = [...STUDIO_STOCK_WIDTHS].sort((a, b) => b - a) as StudioStockWidth[];

/** Every run of real stock towers that fits the span. The search space is tiny (≤ 70 width multisets), so it is exhaustive. */
function studioWallFillOptions(availableIn: number, minTowers = 1): { widths: StudioStockWidth[]; usedIn: number }[] {
  const options: { widths: StudioStockWidth[]; usedIn: number }[] = [];
  const walk = (widths: StudioStockWidth[]) => {
    const usedIn = runWidthIn(widths);
    if (widths.length >= minTowers && widths.length && usedIn <= availableIn + EPS) options.push({ widths, usedIn });
    if (widths.length >= AUTO_MAX_BAYS_PER_WALL) return;
    for (const width of AUTO_WIDTHS_WIDEST_FIRST) {
      if (widths.length && width > widths[widths.length - 1]) continue;
      walk([...widths, width]);
    }
  };
  walk([]);
  return options;
}

/**
 * The tower run that fills one wall using only real MasterTrac stock widths: most wall covered,
 * then the fewest towers, then the widest bays. `minTowers` keeps a tower for each part plan the
 * caller still has to place, so filling the wall never costs the room a requested drawer or shoe
 * shelf. `leftoverIn` is either the gap that no sourced width can cover or, when nothing fits at
 * all, the whole span. No SKU is ever invented or cut here; a field-cut tower is a separate,
 * explicitly reported step.
 */
export function studioWallFill(availableIn: number, wallId: StudioWall = "back", planned?: { widths: StudioStockWidth[]; usedIn: number }, minTowers = 1): StudioWallFill {
  const span = Math.max(0, roundIn(availableIn));
  const options = planned ? [planned] : studioWallFillOptions(span, minTowers);
  const bestUsedIn = options.reduce((top, option) => Math.max(top, option.usedIn), 0);
  const chosen = options
    .filter((option) => option.usedIn >= bestUsedIn - AUTO_FILL_BAY_PENALTY_IN - EPS)
    .sort((a, b) => a.widths.length - b.widths.length || b.usedIn - a.usedIn || a.widths.join(",").localeCompare(b.widths.join(",")))[0];
  return { wallId, widths: chosen?.widths ?? [], availableIn: span, usedIn: roundIn(chosen?.usedIn ?? 0), leftoverIn: roundIn(span - (chosen?.usedIn ?? 0)) };
}

/**
 * Extra towers the wall fill adds are real shelving towers, not empty frames: a pantry or a
 * closet's spare span is shelving in practice, and an empty frame is exactly the unfinished look
 * the owner reported. Shelves are the one part whose fit is verified in any stock width, so they
 * are the only thing an unplanned tower ever gets. `autoBuildStudio` still places every one
 * through `snapStudioPart`, so a rule that refuses one skips it rather than forcing it.
 *
 * A kids' closet only gets shelves inside the child's reach: an auto-build must never quietly add
 * storage a child cannot use and then warn about it.
 */
function spareTowerSpecs(design: StudioDesign, mode: StudioMode, kids?: StudioDesign["kids"]): AutoSpec[] {
  const lowestIn = studioFixedBottom(design) + THICKNESS;
  const topIn = kids ? Math.min(studioFixedTop(design) - THICKNESS, kidsAgeBand(kids.ageYears).maxReachIn) : studioFixedTop(design) - THICKNESS;
  const stepIn = mode === "pantry" ? AUTO_SHELF_STEP_IN : AUTO_SHELF_STEP_IN * 1.5;
  const count = mode === "pantry" ? 6 : 4;
  return Array.from({ length: count }, (_, index) => ({ kind: "shelf" as const, at: lowestIn + index * stepIn }))
    .filter((spec) => spec.at + THICKNESS <= topIn);
}

/**
 * Shelves for a tight middle filler bay, spaced the way the owner's guide asks: close together for
 * folded clothes, tighter for shoes, wider for boots. The guide's 12–14 in folded spacing is the
 * one the sourced 0.75 in boards actually reach; the shoe and boot openings apply the guide's own
 * ranges and are clamped so every shelf stays under the fixed top.
 */
export function fillerTowerSpecs(design: StudioDesign, kids?: StudioDesign["kids"]): AutoSpec[] {
  const lowestIn = studioFixedBottom(design) + THICKNESS;
  const topIn = kids ? Math.min(studioFixedTop(design) - THICKNESS, kidsAgeBand(kids.ageYears).maxReachIn) : studioFixedTop(design) - THICKNESS;
  const specs: AutoSpec[] = [];
  // Boot opening first at the bottom, then shoes, then folded clothes above: the guide's ordering.
  let at = lowestIn;
  for (const gapIn of [AUTO_FILLER_SHELF_GAPS.bootsIn, AUTO_FILLER_SHELF_GAPS.shoesIn, AUTO_FILLER_SHELF_GAPS.foldedIn, AUTO_FILLER_SHELF_GAPS.foldedIn]) {
    if (at + THICKNESS > topIn) break;
    specs.push({ kind: "shelf", at });
    at += THICKNESS + gapIn;
  }
  return specs;
}

/**
 * A reach-in's full-width top shelf, the guide's other named reach-in feature. It sits in the same
 * place the anchor bay already wants a shelf above its upper rod, so the whole run shares one shelf
 * elevation and the two never stack on each other.
 */
function reachInTopShelfIn(design: StudioDesign): number {
  const upperRodIn = Math.min(AUTO_ANCHOR_UPPER_ROD_IN, Math.floor(studioFixedTop(design) - KIDS_UPPER_SHELF_CLEARANCE_IN - THICKNESS));
  return Math.min(upperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN, studioFixedTop(design) - THICKNESS);
}

/** Bay-by-bay part plans for a mode. Each count is consumed as parts are assigned, so the totals placed match the options unless a wall runs out of room. */
function planAutoBays(design: StudioDesign, mode: StudioMode, options: StudioAutoBuildOptions, kids?: StudioDesign["kids"], longHangBay = false): AutoPlan[] {
  const left = { ...options };
  const plans: AutoPlan[] = [];
  const lowestIn = studioFixedBottom(design) + THICKNESS;
  const maxTopIn = studioFixedTop(design);
  /**
   * The anchor upper rod. The guide asks for about 82 in; that is only reachable in the taller 94 in
   * upright, because the shelf over the rod still has to fit under the fixed top shelf. `upperRodIn`
   * is therefore the guide figure clamped to real panel geometry, and the caller reports the gap.
   */
  const upperRodIn = Math.min(AUTO_ANCHOR_UPPER_ROD_IN, Math.floor(maxTopIn - KIDS_UPPER_SHELF_CLEARANCE_IN - THICKNESS));
  const band = kids ? kidsAgeBand(kids.ageYears) : null;
  const take = (key: keyof StudioAutoBuildOptions, count: number) => { const n = Math.min(left[key], count); left[key] -= n; return n; };
  const shelvesFrom = (startIn: number, count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "shelf" as const, at: startIn + i * AUTO_SHELF_STEP_IN })).filter((spec) => spec.at + THICKNESS <= limitIn);
  const drawersLow = (count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "drawer" as const, at: lowestIn + i * studioItemHeight("drawer") })).filter((spec) => spec.at + studioItemHeight("drawer") <= limitIn);
  const shoesLow = (count: number, limitIn = Infinity): AutoSpec[] => Array.from({ length: count }, (_, i) => ({ kind: "shoe" as const, at: lowestIn + i * (studioItemHeight("shoe") + 0.25) })).filter((spec) => spec.at + studioItemHeight("shoe") <= limitIn);
  /** Double hang: the guide's ~40 in lower rod under the anchor upper rod, with a shelf above the top rod. */
  const hang = (): void => {
    while (left.rods >= 2) { take("rods", 2); const specs: AutoSpec[] = [{ kind: "rod", at: AUTO_ANCHOR_LOWER_ROD_IN }, { kind: "rod", at: upperRodIn }]; if (take("shelves", 1)) specs.push({ kind: "shelf", at: upperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN }); plans.push({ specs, role: "anchor" }); }
    if (left.rods === 1) { take("rods", 1); const specs: AutoSpec[] = [{ kind: "rod", at: 66 }]; if (take("shelves", 1)) specs.push({ kind: "shelf", at: 70 }); plans.push({ specs, role: "anchor" }); }
  };
  /**
   * A long-hang bay is one high rod with clear space beneath it, so dresses and coats hang
   * straight instead of folding over a second rod. It uses the highest rod the panel allows, which
   * is the guide's own "hang long things high" intent; `AUTO_GUIDE_CONFLICTS` records that the
   * guide's 82 in figure is not always reachable. A walk-in keeps it off the back wall because a
   * corner must not carry double hang on both of its walls.
   */
  const longHang = (): void => {
    if (left.rods < 1) return;
    take("rods", 1);
    const specs: AutoSpec[] = [{ kind: "rod", at: upperRodIn }];
    if (take("shelves", 1)) specs.push({ kind: "shelf", at: upperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN });
    plans.push({ specs, role: "longHang", preferSideWall: true });
  };
  const shoes = (perBay: number, limitIn?: number): void => { while (left.shoes > 0) plans.push({ specs: shoesLow(take("shoes", perBay), limitIn), role: "shoe" }); };
  const shelfDrawer = (shelvesPerBay: number, limitIn?: number): void => {
    while (left.drawers > 0 || left.shelves > 0) {
      const drawers = take("drawers", 3);
      const startIn = drawers ? lowestIn + drawers * studioItemHeight("drawer") + 1.25 : lowestIn + AUTO_SHELF_STEP_IN - 1.5;
      plans.push({ specs: [...drawersLow(drawers, limitIn), ...shelvesFrom(startIn, take("shelves", shelvesPerBay), limitIn)], role: drawers ? "drawer" : "storage" });
    }
  };
  if (mode === "closet") { if (longHangBay) longHang(); hang(); shoes(4); shelfDrawer(5); }
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
    // Kids' closets keep their own documented 80 in off-season rod (`KIDS_UPPER_ROD_IN`), clamped to
    // the panel; the adult anchor heights above do not apply to them.
    const kidUpperRodIn = Math.min(KIDS_UPPER_ROD_IN, Math.floor(maxTopIn - KIDS_UPPER_SHELF_CLEARANCE_IN - THICKNESS));
    while (left.rods > 0) {
      const rods = take("rods", 2);
      const specs: AutoSpec[] = [{ kind: "rod", at: kidsRodHeightIn(kids.ageYears, kids.heightIn) }];
      if (rods === 2) specs.push({ kind: "rod", at: kidUpperRodIn });
      if (rods === 2 && take("shelves", 1)) specs.push({ kind: "shelf", at: kidUpperRodIn + KIDS_UPPER_SHELF_CLEARANCE_IN });
      if (take("shelves", 1)) specs.push({ kind: "shelf", at: lowestIn }); // toy-bin zone, low enough for hanging clothes above it
      plans.push({ specs, role: "anchor" });
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
  const walls: StudioWall[] = ["back", ...sides];
  // Template plans are what the owner asked for; those carrying a drawer or a shoe shelf need a bay
  // width that actually sells one, so the room search below requires enough such bays.
  const plans = planAutoBays(design, mode, options, kids, input.longHangBay);
  const needsStorage = (plan: AutoPlan) => plan.specs.some((spec) => spec.kind === "drawer" || spec.kind === "shoe");
  const storagePlanCount = plans.filter(needsStorage).length;
  /**
   * A bay hosts exactly one hanging plan. A 36 in bay does not become "two hanging bays", so a fill
   * with fewer bays than hanging plans would silently drop requested rods — which is what made a
   * 78 in reach-in lose its double hang. Prefer fills with enough bays for the hanging asked for,
   * falling back to the widest fill only when the wall genuinely cannot hold that many towers.
   */
  const hangingPlanCount = plans.filter((plan) => plan.specs.some((spec) => spec.kind === "rod")).length;

  /* ---------------------------------------------------------------- wall fill */
  /**
   * The corner shelf is a customer layout decision, not something the fill search quietly wins or
   * loses. Reach-ins are never offered it (see `studioCornerOption`), and a walk-in only gets it when
   * the customer asked for it *and* the room is big enough to keep a real tower beside every corner.
   * Both corners are planned consistently: a corner shelf on one side means a corner shelf on the
   * other, so a walk-in never ends up with one bare corner and one filled with a shelf.
   */
  const cornerOption = studioCornerOption({ closetType: walkIn ? "walkIn" : "reachIn", wallWidthIn: input.wallWidthIn, roomDepthIn: input.roomDepthIn, mount: design.mount });
  const wantsCorners = Boolean(input.cornerShelves) && sides.length > 0 && cornerOption.offered;
  // Say why a requested corner shelf is not there, whatever the reason (reach-in, small room, mount).
  if (input.cornerShelves && !wantsCorners) notices.push(`Corner shelves were not added: ${cornerOption.reason}`);
  /** One bit per side: true plans a 29.5 in visual corner shelf, false closes that corner with shared geometry only. */
  const cornerChoices = wantsCorners
    ? [sides.map((side) => ({ side, withCornerShelf: true }))]
    : [sides.map((side) => ({ side, withCornerShelf: false }))];
  type SidePlan = { side: StudioWall; withCornerShelf: boolean; widths: StudioStockWidth[]; availableIn: number; usedIn: number; leftoverIn: number };
  type RoomPlan = { back: StudioWallFill; sides: SidePlan[]; score: number; storageBays: number; bayCount: number };
  const roomPlans: RoomPlan[] = [];
  for (const choice of cornerChoices) {
    const reservedIn = choice.filter((entry) => entry.withCornerShelf).length * STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN;
    for (const backOption of studioWallFillOptions(input.wallWidthIn - reservedIn)) {
      const back = studioWallFill(input.wallWidthIn - reservedIn, "back", backOption);
      // A shared corner reserves the back run's bay depth on the side wall; a corner shelf reserves
      // its 29.5 in envelope. `studioWallStartIn` reports the same offset, so the drawn run and the
      // planned run always start at the same place.
      const sidesForThisChoice = choice.map(({ side, withCornerShelf }): SidePlan => {
        const span = input.roomDepthIn - (withCornerShelf ? STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN : AUTO_SIDE_CLEAR_IN);
        return { side, withCornerShelf, ...studioWallFill(span, side) };
      });
      const all = [back, ...sidesForThisChoice];
      const coveredIn = all.reduce((sum, fill) => sum + fill.usedIn, 0);
      const towers = all.reduce((sum, fill) => sum + fill.widths.length, 0);
      const storageBays = all.reduce((sum, fill) => sum + fill.widths.filter((width) => (AUTO_STORAGE_WIDTHS as readonly number[]).includes(width)).length, 0);
      roomPlans.push({ back, sides: sidesForThisChoice, score: coveredIn - AUTO_FILL_BAY_PENALTY_IN * towers, storageBays, bayCount: towers });
    }
  }
  const rankPlans = (plans: RoomPlan[]) => [...plans].sort((a, b) => b.score - a.score || b.back.usedIn - a.back.usedIn);
  /**
   * Two feasibility rules, both about not silently dropping a part the owner asked for:
   *  - enough 18/24/30 in bays for the drawer and shoe plans; and
   *  - enough bays for the hanging plans. In a reach-in every plan lands on the one wall, so this is
   *    the back wall's own bay count; in a walk-in the side walls take hanging too.
   */
  const fitsStorage = roomPlans.filter((plan) => plan.storageBays >= storagePlanCount);
  const pool = fitsStorage.length ? fitsStorage : roomPlans;
  const bayPool = (plan: RoomPlan) => walkIn ? plan.bayCount : plan.back.widths.length;
  const fitsHanging = pool.filter((plan) => bayPool(plan) >= Math.min(hangingPlanCount, AUTO_MAX_BAYS_PER_WALL));
  /**
   * Drawer/shoe bays and hanging bays are different bays, so the wall must have room for both groups
   * at once. A fill that satisfied the storage plans by leaving no bay for hanging is what dropped a
   * 78 in reach-in's double hang.
   */
  const combined = fitsHanging.filter((plan) => bayPool(plan) >= Math.min(storagePlanCount + hangingPlanCount, AUTO_MAX_BAYS_PER_WALL));
  const candidates = combined.length ? combined : (fitsHanging.length ? fitsHanging : pool);
  /** Filling the wall is the goal: most wall covered, discounted by the extra tower each layout needs. */
  const ranked = rankPlans(candidates);
  const bestScore = ranked[0]?.score ?? 0;
  const bestPlan = ranked.find((plan) => plan.score >= bestScore - AUTO_FILL_BAY_PENALTY_IN / 2) ?? ranked[0];
  // Prefer a plan whose every wall has at least one real tower: an empty wall beside a filled one
  // looks unfinished, and that was the owner's second observation about the same screenshot.
  const sameScore = ranked.filter((plan) => plan.score >= bestScore - AUTO_FILL_BAY_PENALTY_IN / 2);
  const finalPlan = sameScore.find((plan) => plan.sides.every((side) => side.widths.length) && plan.back.widths.length)
    ?? sameScore.find((plan) => plan.back.widths.length) ?? bestPlan;
  const fills = new Map<StudioWall, StudioWallFill>(walls.map((wall): [StudioWall, StudioWallFill] => {
    if (wall === "back") return [wall, finalPlan?.back ?? studioWallFill(input.wallWidthIn, "back")];
    const side = finalPlan?.sides.find((plan) => plan.side === wall);
    return [wall, side ? { wallId: wall, widths: side.widths, availableIn: side.availableIn, usedIn: side.usedIn, leftoverIn: side.leftoverIn } : studioWallFill(input.roomDepthIn, wall)];
  }));
  /** Sides whose corner is closed by shared geometry instead of a 29.5 in visual corner shelf. */
  const sharedSides = new Set((finalPlan?.sides ?? []).filter((plan) => !plan.withCornerShelf).map((plan) => plan.side));
  for (const wall of walls) if (!fills.get(wall)!.widths.length) notices.push(`The ${wall} wall has no room for the narrowest ${STUDIO_STOCK_WIDTHS[0]} in sourced tower.`);

  /* ------------------------------------------------------------ tower planning */
  /**
   * Bays are fixed *slots* on a wall, in order from the corner outward, so a role can be placed at
   * "the bay by the door" and stay there. Building from an ordered list of pushes instead made the
   * shoe bay land at the corner, which is the opposite of what the brief asks for.
   *
   * Wall roles from the owner's brief:
   *
   *  Walk-in — hanging goes on the shorter walls, the drawer bank is centred on the back wall, the
   *    shoe shelving sits by the door (the free end of each side run, away from the corner), and
   *    long hang is kept off the back wall so no corner carries double hang on both of its walls.
   *    A tight middle bay between hanging sections takes closely spaced shelves instead.
   *  Reach-in — mostly double hang with exactly one long-hang bay, a full-width top shelf, and the
   *    drawer bank kept clear of the door swing at the entry end.
   */
  const slotPlans = new Map<StudioWall, (AutoPlan | null)[]>(walls.map((wall) => [wall, fills.get(wall)!.widths.map(() => null)]));
  const wallLength = (wall: StudioWall) => wall === "back" ? input.wallWidthIn : input.roomDepthIn;
  /** "Hanging on short walls": shortest wall first, so a deep narrow walk-in hangs on its sides. */
  const shortestFirst = [...walls].sort((a, b) => wallLength(a) - wallLength(b));
  const droppedPlans: AutoPlan[] = [];
  /** Index of the bay furthest from the shared corner: that end is by the door. */
  const doorEnds = (wall: StudioWall) => [...(slotPlans.get(wall) ?? [])].map((_, index) => index).reverse();
  const emptySlots = (wall: StudioWall) => (slotPlans.get(wall) ?? []).map((plan, index) => plan ? -1 : index).filter((index) => index >= 0);
  const storageSlots = (wall: StudioWall) => emptySlots(wall).filter((index) => (AUTO_STORAGE_WIDTHS as readonly number[]).includes(fills.get(wall)!.widths[index]));
  const put = (wall: StudioWall, index: number, plan: AutoPlan) => { slotPlans.get(wall)![index] = plan; };
  /**
   * Placement order matters now that roles claim specific slots: shoes need the door-end bay, and
   * drawers need the middle of the back wall, before hanging fills those bays. Storage-bearing
   * plans go first, then shoes-by-the-door, then drawers, then hanging, then shelves.
   */
  const roleOrder: Record<string, number> = { drawer: 0, shoe: 1, longHang: 2, anchor: 3, storage: 4, filler: 5 };
  const queue = [...plans].sort((a, b) => (roleOrder[a.role ?? "storage"] ?? 9) - (roleOrder[b.role ?? "storage"] ?? 9));
  for (const plan of queue) {
    const wantsStorage = needsStorage(plan);
    const candidates = (wall: StudioWall) => wantsStorage ? storageSlots(wall) : emptySlots(wall);
    let placed = false;
    if (plan.role === "shoe") {
      // Shoe shelving by the door: the last bay of each side run, then the entry end of the back
      // wall, and only then whatever is left. Never the bay tucked into a corner.
      for (const side of sides) {
        const valid = new Set(candidates(side));
        for (const index of doorEnds(side)) if (valid.has(index)) { put(side, index, plan); placed = true; break; }
        if (placed) break;
      }
      if (!placed) {
        const backSlots = candidates("back");
        const pool = [...backSlots].reverse();
        if (pool.length) { put("back", pool[0], plan); placed = true; }
      }
    } else if (plan.role === "drawer") {
      /**
       * Drawers centred on the back wall. The "no double hang on both sides of a corner" rule is
       * about hanging, not drawers, so a drawer bank may sit in a corner-adjacent bay when the back
       * wall has only two: the nearest-to-centre bay wins. In a reach-in it additionally stays clear
       * of the door swing at the entry end.
       */
      const backCount = fills.get("back")!.widths.length;
      const usable = candidates("back").filter((index) => {
        if (walkIn || backCount <= 1) return true;
        // A reach-in's door swing is at the entry end of the run: keep the drawer bank out of it.
        // The bay has to end at least the clearance distance from that end to be usable.
        const widths = fills.get("back")!.widths;
        const fromEntryIn = widths.slice(index + 1).reduce((sum, width) => sum + width + THICKNESS, 0);
        return fromEntryIn >= AUTO_DOOR_SWING_CLEARANCE_IN - EPS;
      });
      const centre = backCount / 2;
      const index = usable.sort((a, b) => Math.abs(a + 0.5 - centre) - Math.abs(b + 0.5 - centre))[0];
      if (index != null) { put("back", index, plan); placed = true; }
    }
    if (!placed) {
      /**
       * Fallbacks. A drawer bank that could not take a usable back-wall bay goes to a side wall
       * rather than blocking a corner; hanging prefers the shortest wall; anything else fills in
       * wall order.
       */
      const order = plan.role === "drawer" ? [...sides, "back" as StudioWall]
        : plan.role === "longHang" || plan.role === "anchor" ? [...shortestFirst, ...walls] : walls;
      for (const wall of order) {
        const [index] = candidates(wall);
        if (index != null) { put(wall, index, plan); placed = true; break; }
      }
    }
    if (!placed) droppedPlans.push(plan);
  }
  // Remaining slots are built too: a filled wall is the whole point. A tight middle bay between
  // hanging sections gets the guide's filler spacing; anything else gets a real shelf stack.
  const spareTowers = walls.reduce((sum, wall) => sum + emptySlots(wall).length, 0);
  for (const wall of walls) {
    for (const index of emptySlots(wall)) {
      const widthIn = fills.get(wall)!.widths[index];
      const betweenHanging = (slotPlans.get(wall) ?? []).some((plan) => plan?.role === "anchor" || plan?.role === "longHang");
      put(wall, index, widthIn <= AUTO_FILLER_BAY_MAX_IN && betweenHanging
        ? { specs: fillerTowerSpecs(design, kids), role: "filler", filler: true }
        : { specs: spareTowerSpecs(design, mode, kids), role: "storage" });
    }
  }
  const towers: { wall: StudioWall; widthIn: StudioStockWidth; plan: AutoPlan }[] = [];
  for (const wall of walls) (slotPlans.get(wall) ?? []).forEach((plan, index) => { if (plan) towers.push({ wall, widthIn: fills.get(wall)!.widths[index], plan }); });
  // A reach-in's full-width top shelf: every bay on the run shares one shelf elevation, and a bay
  // that already has a shelf at that height is left alone rather than getting a duplicate.
  if (!walkIn && mode === "closet") {
    const topIn = reachInTopShelfIn(design);
    for (const tower of towers) {
      if (tower.wall !== "back" || tower.plan.role === "filler") continue;
      if (tower.plan.specs.some((spec) => spec.kind === "shelf" && Math.abs(spec.at - topIn) < THICKNESS)) continue;
      tower.plan = { ...tower.plan, specs: [...tower.plan.specs, { kind: "shelf", at: topIn }] };
    }
  }

  /* ------------------------------------------------------------------- build */
  const slots: { wall: StudioWall; index: number; plan: AutoPlan }[] = [];
  for (const wall of walls) {
    // Build in wall order so bay numbering stays predictable for the elevations and the tests.
    const mine = towers.filter((tower) => tower.wall === wall);
    design = switchStudioWall(design, wall);
    mine.forEach((tower, index) => {
      const added = addStudioBay(design, tower.widthIn);
      if (!added.ok) { notices.push(`The ${wall} wall stopped at ${index} tower${index === 1 ? "" : "s"}: ${added.reason}`); return; }
      design = replaceStudioWallBays(added.design, wall, studioBays(added.design, wall).map((bay, at) => at === index ? { ...bay, id: `${wall}-bay-${index + 1}` } : bay));
      slots.push({ wall, index, plan: tower.plan });
    });
  }

  /* ------------------------------------------------------ leftover field cut */
  // Cut-to-fit planning is only documented for straight fixed/adjustable shelves, so a leftover
  // span becomes one shelf-only cut tower and never absorbs a rod, drawer or shoe plan.
  let cutShelves = droppedPlans.reduce((sum, plan) => sum + plan.specs.filter((spec) => spec.kind === "shelf").length, 0);
  for (const wall of walls) {
    const fill = fills.get(wall)!;
    if (!fill.widths.length) continue;
    const builtCount = studioBays(design, wall).length;
    /**
     * Real leftover is what the fill could not cover *plus* any planned bay that could not be built,
     * so a wall stopped at the four-bay Studio limit still reports the span it left bare. Reporting
     * only the planned leftover silently dropped the notice whenever every planned bay was built.
     */
    const unbuiltIn = fill.widths.slice(builtCount).reduce((sum, width) => sum + width + THICKNESS, 0);
    const leftoverIn = roundIn(fill.leftoverIn + unbuiltIn);
    if (leftoverIn <= THICKNESS) continue;
    const installedIn = roundIn(leftoverIn - THICKNESS * (builtCount ? 1 : 2));
    if (builtCount >= AUTO_MAX_BAYS_PER_WALL) notices.push(`The ${wall} wall has ${leftoverIn} in left over after four towers (the Studio limit); it stays empty.`);
    else if (installedIn < CUT_PLANNING_MIN_IN) notices.push(`The ${wall} wall has ${leftoverIn} in left over, too narrow for another sourced tower (${CUT_PLANNING_MIN_IN} in minimum); it stays empty.`);
    else if (cutShelves <= 0) notices.push(`The ${wall} wall has ${leftoverIn} in left over after its sourced towers; it stays empty.`);
    else {
      design = switchStudioWall(design, wall);
      const stockIn = STUDIO_STOCK_WIDTHS.find((width) => width >= installedIn) ?? STUDIO_STOCK_WIDTHS[STUDIO_STOCK_WIDTHS.length - 1];
      const cutIndex = studioBays(design, wall).length;
      const withTower = replaceStudioWallBays(design, wall, [...studioBays(design, wall), { id: `${wall}-bay-${cutIndex + 1}`, wallId: wall, widthIn: stockIn, items: [] }]);
      const cut = configureStudioBayCut(withTower, cutIndex, stockIn, installedIn);
      if (!cut.ok) { notices.push(`The ${wall} wall's last ${installedIn} in stays empty: ${cut.reason}`); continue; }
      design = cut.design;
      const shelves = Math.min(cutShelves, 5);
      cutShelves -= shelves;
      slots.push({ wall, index: cutIndex, plan: { specs: Array.from({ length: shelves }, (_, i) => ({ kind: "shelf" as const, at: 18 + i * AUTO_SHELF_STEP_IN })) } });
      notices.push(`The ${wall} wall ends in a ${installedIn} in field-cut shelf tower cut from ${stockIn} in stock; it holds shelves only because drawer, rod and shoe fit is not verified in a cut tower.`);
    }
  }
  const dropped = droppedPlans.reduce((sum, plan) => sum + plan.specs.length, 0) - (droppedPlans.reduce((sum, plan) => sum + plan.specs.filter((spec) => spec.kind === "shelf").length, 0) - cutShelves);
  if (dropped > 0) notices.push(`${dropped} part${dropped === 1 ? "" : "s"} did not fit in the available wall space and ${dropped === 1 ? "was" : "were"} left out.`);

  /* ------------------------------------------------------- corner connection */
  // Only sides planned around a 29.5 in envelope get one. A shared-corner side was filled edge to
  // edge on purpose, so adding the envelope there would undo the fill.
  if (design.mount === "floor") for (const side of sides) {
    if (sharedSides.has(side)) continue;
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

  /* ---------------------------------------------------------------- parts in */
  // Parts go in only through snapStudioPart; a refused or displaced part is skipped, never forced.
  let skipped = 0;
  for (const slot of slots) {
    design = switchStudioWall(design, slot.wall);
    slot.plan.specs.forEach((spec, n) => {
      const staged = stageStudioPart(design, slot.index, spec.kind, spec.at, `auto-${slot.wall}-${slot.index + 1}-${spec.kind}-${n + 1}`, spec.kind === "rod" || spec.kind === "drawer" ? 0.5 : 3);
      if (staged.item) design = staged.design; else skipped++;
    });
  }
  if (skipped) notices.push(`${skipped} part${skipped === 1 ? "" : "s"} could not be placed without breaking a fit or spacing rule and ${skipped === 1 ? "was" : "were"} skipped.`);
  // Filling the wall costs real shelves, so say so: the reference total is not just the slider counts.
  if (spareTowers) notices.push(`${spareTowers} extra tower${spareTowers === 1 ? "" : "s"} filled the rest of the wall as open shelving; ${spareTowers === 1 ? "it is" : "they are"} in the material reference.`);
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
      && bay.widthIn >= CUT_PLANNING_MIN_IN && bay.widthIn <= STUDIO_STOCK_WIDTHS[STUDIO_STOCK_WIDTHS.length - 1]
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
