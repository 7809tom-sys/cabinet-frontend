import { useEffect, useMemo, useRef, useState } from "react";
import { useTabletWorkspace } from "@/hooks/useTabletWorkspace";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { DenoiseMaterial, WebGLPathTracer } from "three-gpu-pathtracer";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, CheckCircle2, ChevronDown, Download, Eye, FileDown, Info, LoaderCircle, Magnet, Mail, Maximize2, Minimize2, Minus, Move3D, Palette, PanelTop, Plus, Printer, RefreshCw, Rotate3D, Save, Share2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreeDHandlesControl } from "./ThreeDHandlesControl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APPLIANCES, BLIND_CORNER_FILLER_WIDTH_IN, COUNTERTOP_DEPTH_IN, FURNITURE_CATALOG, STD, applianceAppearanceImage, bearsCountertop, isBaseHeightAppliance, blindCornerRearCountertopExtensionIn, cabinetWall, cabinetWallDragPreview, cornerLegRatioForPlaced, cornerRotationForPlaced, countertopRunFaceNormal, countertopSurfacePlanPolygon, countertopSurfaces, crownBlockingCabinets, crownEligibleCabinets, customWallCabinetSide, drywallPonyWallAppearance, elevationBox, formatEighthInches, formatInches, glassDoorShelfCount, isAgainstWall, isBaseEndCornerCabinet, isCustomRoomWall, isFillerItem, fillerWidthRange, isGlassDoorCabinet, isMicrowaveOverRangePair, isRangeHoodPlacement, isRangeOrOven, isRefrigerator, isStacker, isWallRunDraggable, isWd18CountertopDrawerCabinet, kitchenCrestGenericOpenEndShelfCount, normalizeInstalledFillersToAdjacentCabinets, peninsulaCountertopPonyWallBackExtensionIn, peninsulaCountertopPonyWallBarOverhang, peninsulaCountertopSeatingOverhang, peninsulaCountertopWaterfallEnd, peninsulaLowerWorktopOppositeSideExtensionIn, peninsulaRunEndpoints, placedCornerGeometryKind, placedFootprint, ponyWallMiteredFootprint, ponyWallPlanFrame, potFillerMountedRange, rangeVisualAppearance, refrigeratorBayVerificationMetrics, resolveCabinetHardwarePosition, resolveSwing, roomWallAppearance, seatedWallRunFrame, wallRunFrame, selectedLowerCabinetWallPlacement, sinkPlanDimensions, usesRaisedFloorWallDoorPull, wallCabinetFitMeasure, wallGapFitPreview, wallGapFreehandPreview, wallGaps, wallPlacementAt, wallRunOffset, wallRunSpan, wallSpanMeasure, wallLength, wd18CountertopFaceLayout, type CabinetWallDragPreview, type CountertopSurface, type IslandZone, type PlacedCabinet, type PlacedCornerGeometryKind, type PlacedFurniture, type PonyWall, type PotFillerFixture, rotatedSize, type RoomData, type SinkFixture, type WallCabinetFitMeasure, type WallGapFitPreview, type WallOpening, type WallSide, type WallSpanMeasure, wallTopLimit, } from "@/lib/design";
import { islandCountertopRects, islandCountertopVisibleRects, islandRaisedBarRects, islandFaceFitMeasure } from "@/lib/islandScene";
import { furniturePlanFrame, resolvedFurnitureDimensions } from "@/lib/design";
import { farmhouseSinkBaseFaceLayout } from "@/lib/farmhouseSinkBaseFace";
import { angledWallTransitionFootprint } from "@/lib/angledWallFiller";
import { miteredWallOutlinesFromInteriorFaces, ROOM_WALL_THICKNESS_IN, wallAngle as polygonWallAngle } from "@/lib/polygonRoom";
import { cabinetDrawingType, isEqualHeightTwoDrawerBase as isEqualHeightTwoDrawerBaseFamily, isSquareDoubleDoorBaseEnd, isWallBlindCornerCabinet, resolveDoorDrawerCounts, resolvedVanityComboFaceLayout, standardDoorCountForFaceWidth, threeDrawerBaseRowHeights } from "@/lib/cabinetGraphics";
import { verifiedPelicanBathroomFixtureProfile, type VerifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";
import { makePelicanTubFillerGroup } from "@/lib/pelicanTubFillerMesh";
import { makePelicanToiletGroup } from "@/lib/pelicanToiletMesh";
import { doorOpeningAppearance, roomDoorSwing } from "@/lib/doorOpeningAppearance";
import { doorHardwareOffsetFromFaceCenterIn, hardwareStyle, normalizeDoorHardwareFramePosition, type HardwareStyleId } from "@/lib/hardware";
import { ovenOpeningGeometry } from "@/lib/ovenOpening";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { normalizeCode } from "@shared/cabinetCodeMatch";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { toast } from "sonner";
import { pantryDrawerFrontLayout } from "@/lib/pantryDrawerLayout";
import { masterTracProduct, masterTracFinishColor } from "@/lib/closet";
import { geminiHardwareReference, type GeminiMaterialManifestEntry } from "@/lib/geminiHardwareReference";
import { geminiMaterialReference, geminiInferredMaterialLabels } from "@/lib/geminiMaterialReference";
import { GEMINI_MATERIAL_MANIFEST_WIRE_VERSION, geminiMaterialManifestWireValidationIssues, serializeGeminiImageTestProvenanceForWire, serializeGeminiMaterialManifestForWire } from "@shared/geminiMaterialManifest";
import { pelicanQuartzMaterialMap } from "@/lib/pelicanQuartzMaterialMaps";

/**
 * The in-house browser path tracer is switched off: it opens a second WebGL
 * context that can leave the interactive 3D Designer unable to start, and the
 * Google (Gemini) render test produces the photo-quality image instead.
 */
export const IN_HOUSE_PATH_TRACE_ENABLED = false;
export const THREE_D_PATH_TRACE_PREVIEW = {
  width: 1920,
  height: 1080,
  samples: 256,
  bounces: 5,
  denoise: { sigma: 2.1, kSigma: 1, threshold: 0.055 },
} as const;

/**
 * CC0 Poly Haven Photo Studio 01 (1K HDR) used only as an invisible lighting and
 * reflection environment for the cloned production-render scene. It never becomes
 * kitchen geometry, a room backdrop, or a substitute for the selected room scene.
 */
export const THREE_D_PRODUCTION_HDRI_URL = "/manus-storage/photo_studio_01_1k_5f7e3d4e.hdr";

/**
 * Returns a stable UV offset for the curated Hickory material assigned to one
 * saved cabinet placement. A placement UID is durable through save/load and
 * moves, so a cabinet keeps its own wood figure without render-time randomness.
 *
 * The curated asset remains vertical at a 1:1 repeat. Only the source crop is
 * shifted; cabinet geometry, door construction, and rail direction are not
 * changed.
 */
export function threeDCabinetGrainTransform(
  placementUid: string | null | undefined,
  doorSampleUrl: string | null | undefined,
): { offsetX: number; offsetY: number } {
  const source = `${placementUid?.trim() || "legacy-cabinet"}|${doorSampleUrl?.trim() || "curated-grain"}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const primary = hash >>> 0;
  const secondary = Math.imul(primary ^ 0x9e3779b9, 2246822519) >>> 0;
  // Keep both values away from an exact wrap seam. Hickory needs stronger
  // horizontal variation and only a modest vertical shift to retain its grain
  // direction and recognizable character.
  return {
    offsetX: 0.035 + (primary / 0xffffffff) * 0.93,
    offsetY: 0.015 + (secondary / 0xffffffff) * 0.31,
  };
}

/** Room wall meshes are Designer context only. They must never become part of
 * the locked cabinet-image crop that Gemini uses as its product-layout source. */
export function photoReferenceRoomWallMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const walls: THREE.Mesh[] = [];
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh && node.userData.roomWall === true) walls.push(node);
  });
  return walls;
}

/** Temporarily remove all architectural room walls during a photo reference
 * capture. This restores each wall exactly as found, including hidden walls,
 * and deliberately does not touch cabinet, glass, countertop, or support mesh.
 */
export function captureWithRoomWallsHidden<T>(scene: THREE.Scene, capture: () => T): T {
  const walls = photoReferenceRoomWallMeshes(scene);
  const visibility = walls.map((wall) => wall.visible);
  try {
    walls.forEach((wall) => { wall.visible = false; });
    return capture();
  } finally {
    walls.forEach((wall, index) => { wall.visible = visibility[index] ?? true; });
  }
}

export function pathTraceCompatibleMaterial(material: THREE.Material) {
  const source = material as THREE.MeshPhysicalMaterial;
  const hasMaterialMap = Boolean(source.map);
  const converted = new THREE.MeshPhysicalMaterial({
    color: source.color?.clone() ?? new THREE.Color("#ffffff"),
    map: source.map ?? null,
    normalMap: source.normalMap ?? null,
    normalScale: source.normalScale?.clone(),
    bumpMap: source.bumpMap ?? (hasMaterialMap ? source.map : null),
    bumpScale: source.bumpMap ? source.bumpScale : (hasMaterialMap ? 0.008 : 0),
    roughnessMap: source.roughnessMap ?? null,
    metalnessMap: source.metalnessMap ?? null,
    aoMap: source.aoMap ?? null,
    aoMapIntensity: source.aoMapIntensity,
    alphaMap: source.alphaMap ?? null,
    emissive: source.emissive?.clone() ?? new THREE.Color("#000000"),
    emissiveMap: source.emissiveMap ?? null,
    emissiveIntensity: source.emissiveIntensity,
    roughness: typeof source.roughness === "number" ? source.roughness : 0.72,
    metalness: typeof source.metalness === "number" ? source.metalness : 0,
    clearcoat: source.clearcoat ?? 0,
    clearcoatMap: source.clearcoatMap ?? null,
    clearcoatRoughness: source.clearcoatRoughness ?? 0,
    clearcoatRoughnessMap: source.clearcoatRoughnessMap ?? null,
    ior: source.ior,
    transmission: source.transmission,
    transmissionMap: source.transmissionMap ?? null,
    thickness: source.thickness,
    thicknessMap: source.thicknessMap ?? null,
    attenuationDistance: source.attenuationDistance,
    attenuationColor: source.attenuationColor?.clone(),
    specularIntensity: source.specularIntensity,
    specularIntensityMap: source.specularIntensityMap ?? null,
    specularColor: source.specularColor?.clone(),
    specularColorMap: source.specularColorMap ?? null,
    sheen: source.sheen,
    sheenRoughness: source.sheenRoughness,
    sheenColor: source.sheenColor?.clone(),
    sheenColorMap: source.sheenColorMap ?? null,
    sheenRoughnessMap: source.sheenRoughnessMap ?? null,
    envMapIntensity: source.envMapIntensity ?? 1,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
  });
  converted.name = `path-trace:${source.name || source.type}`;
  converted.userData = {
    ...source.userData,
    productionRenderMaterial: true,
    reusedApprovedTextureMap: hasMaterialMap,
  };
  return converted;
}

export function addThreeDProductionLightRig(
  scene: THREE.Scene,
  roomWidth: number,
  roomDepth: number,
  wallHeight: number,
): THREE.Light[] {
  const target = new THREE.Vector3(roomWidth * 0.5, wallHeight * 0.44, roomDepth * 0.47);
  const daylight = new THREE.RectAreaLight("#fff5e6", 4.5, Math.max(2.6, roomWidth * 0.72), Math.max(2.2, wallHeight * 0.38));
  daylight.position.set(roomWidth * 0.16, wallHeight * 0.84, roomDepth * 0.05);
  daylight.lookAt(target);
  daylight.userData = { productionRenderLight: true, rig: "daylight", cloneOnly: true };

  const ceiling = new THREE.RectAreaLight("#fff1db", 3.1, Math.max(2.7, roomWidth * 0.55), Math.max(2.4, roomDepth * 0.45));
  ceiling.position.set(roomWidth * 0.52, wallHeight * 0.94, roomDepth * 0.47);
  ceiling.lookAt(target);
  ceiling.userData = { productionRenderLight: true, rig: "ceiling", cloneOnly: true };

  const softFill = new THREE.PointLight("#dfeeff", 1.05, Math.max(roomWidth, roomDepth) * 2.4, 2);
  softFill.position.set(roomWidth * 0.88, wallHeight * 0.56, roomDepth * 0.82);
  softFill.userData = { productionRenderLight: true, rig: "soft-fill", cloneOnly: true };

  scene.add(daylight, ceiling, softFill);
  return [daylight, ceiling, softFill];
}

type SceneSku = {
  /** Stable source ID for a cabinet that came from the authoritative 2D design. */
  placementUid?: string | null;
  distributorSkuId: number;
  cabinetId: number;
  masterCode: string;
  description: string | null;
  category?: string | null;
  subCategory?: string | null;
  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
  applianceProductId?: number | null;
  applianceCatalogCode?: string | null;
  applianceCatalogName?: string | null;
  applianceCatalogPrice?: number | null;
  rangeTopImageUrl?: string | null;
  rangeTopFinish?: "stainless" | "black-glass" | null;
  /** Distributor-specific construction marker retained from the placed cabinet. */
  constructionMethod?: string | null;
  placementType: string | null;
  width: unknown;
  height: unknown;
  depth: unknown;
  mountBottom?: number | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  fixedShelfCount?: number | null;
  adjustableShelfCount?: number | null;
  glassDoor?: boolean | null;
  doorOrientation?: "side-by-side" | "stacked" | null;
  swing?: "left" | "right" | "double" | "none" | null;
  handleSide?: "left" | "right" | null;
  hardwarePosition?: "auto" | "left" | "center" | "right" | "paired" | "top-center" | null;
  openingType?: string | null;
  openingWidth?: number | null;
  openingHeight?: number | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
  drawerLayout?: string | null;
  layoutSpec?: string | null;
  ovenType?: "single" | "double" | null;
  /** A distributor source record has verified that its drawer rows are exterior faces. */
  sourceOvenDrawerLayout?: boolean | null;
  graphicType?: string | null;
  customProfile?: string | null;
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  cornerType?: string | null;
  cornerGeometryKind?: PlacedCornerGeometryKind;
  /** Original product visual selected in the 2D appliance palette. */
  catalogImageUrl?: string | null;
  decorativeEnd?: "none" | "left" | "right" | "both";
  masterTracShelfCut?: PlacedCabinet["masterTracShelfCut"];
	  fillerPieceGroupId?: string | null;
		  fillerTotalWidth?: number | null;
			  fillerPlacementMode?: "left" | "right" | "split" | null;
			  fillerMatchesFullOwnerEnvelope?: boolean | null;
		  fillerMiterAngle?: 22.5 | 45 | null;
		  fillerMiteredEnd?: "start" | "end" | null;
		  fillerTransitionKind?: "angled-wedge" | "corner-provisional" | "front-miter-pair" | null;
		  fillerTransitionPiece?: "owner" | "neighbor" | null;
	  fillerTransitionNeighborUid?: string | null;
	  fillerTransitionRearWidthIn?: number | null;
	  fillerTransitionFrontWidthIn?: number | null;
	  fillerTransitionStockWidthIn?: number | null;
	  fillerIndependentCabinetSupport?: boolean | null;
	  fillerTransitionFootprint?: Array<{ x: number; y: number }> | null;
		  countertopRearExtensionIn?: number | null;
	  islandFace?: PlacedCabinet["islandFace"];
	  islandCounterHeightWallCabinet?: boolean | null;
	  islandWallCabinetBaseTreatment?: "toe-kick" | "base-molding" | null;
	  waterfallLeft?: boolean | null;
	  waterfallRight?: boolean | null;
};

export type VanityFaceLayout = { drawerSide: 'left' | 'right'; drawerCount: number; drawerBankRatio: number };
/** Catalog-backed visual construction for a door style; never infer it from a finish name. */
export type ThreeDDoorProfile = {
  doorStyle: string | null;
  doorPanelType: string | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  panelConstruction?: "raised" | "flat" | "slab" | "glass" | null;
  bevelWidth?: string | number | null;
  bevelDepth?: string | number | null;
  insideEdgeProfile?: string | null;
  drawerFrontType?: "five-piece-raised" | "five-piece-flat" | "slab" | null;
  grainDirection?: "vertical-stiles-horizontal-rails" | "vertical" | "horizontal" | "none" | null;
  finishSheen?: "satin" | "matte" | "gloss" | null;
};

export function resolvedThreeDVanityFaceLayout(layoutSpec: string | null | undefined): VanityFaceLayout | null {
  if (!layoutSpec) return null;
  try {
    const parsed = JSON.parse(layoutSpec) as { vanity?: Partial<VanityFaceLayout> };
    if (!parsed.vanity || (parsed.vanity.drawerSide !== 'left' && parsed.vanity.drawerSide !== 'right')) return null;
    return {
      drawerSide: parsed.vanity.drawerSide,
      drawerCount: Math.max(1, Math.min(8, Number(parsed.vanity.drawerCount) || 1)),
      drawerBankRatio: Math.min(0.55, Math.max(0.28, Number(parsed.vanity.drawerBankRatio) || 0.4)),
    };
  } catch {
    return null;
  }
}

export type InteractiveRoomScene = {
  roomShape: { id: string; name: string; defaultDimensions: unknown; geometryTemplate: unknown } | null;
  layout: { id: string; name: string } | null;
  suggestions: Array<{
    zone: { zoneKey: string; label: string; wallKey: string | null; sequence: number; placementType: string | null; required: boolean };
    sku: SceneSku | null;
  }>;
  materials: {
    cabinet: { publicName: string | null; name: string; color: string | null; finish: string | null; doorStyle: string | null; doorPanelType: string | null };
    defaults: { floor: string; countertop: string; backsplash: string; wall: string };
  } | null;
};

export type InteractiveRoomOrderSummary = {
  itemCount: number;
  pricedLineCount: number;
  unpricedLineCount: number;
  subtotal: number;
};

export type InteractiveRoomOrderLine = {
  id: string;
  label: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  /** Exact saved-plan cabinet UIDs represented by this order line. */
  placementUids?: string[];
};

export function threeDOrderLineForSelectedCabinet(
  orderLines: readonly InteractiveRoomOrderLine[],
  selectedCabinet: Pick<ThreeDCabinetHit, "uid" | "masterCode">,
): InteractiveRoomOrderLine | null {
  if (selectedCabinet.uid) {
    const exactLine = orderLines.find((entry) => entry.placementUids?.includes(selectedCabinet.uid!));
    if (exactLine) return exactLine;
  }
  return orderLines.find((entry) => `${entry.label} ${entry.detail ?? ""}`.toUpperCase().includes(selectedCabinet.masterCode.toUpperCase())) ?? null;
}

export type InteractiveRoomCatalogItem = {
	  id: number;
	  sourceCabinetId?: number;
	  masterCode: string;
  description: string | null;
  category: "Cabinet" | "Accessory" | "Appliance";
  catalogGroup?: ThreeDCatalogGroup;
  placement?: string | null;
  width?: number | null;
  height?: number | null;
	  depth?: number | null;
	  glassDoor?: boolean;
	  glassDoorAddonCode?: string | null;
};

export function threeDCatalogDragFitText(item: Pick<InteractiveRoomCatalogItem, "masterCode">, fit: WallGapFitPreview): string {
  if (fit.status === "invalid") {
    if (!fit.containsTarget) return `${item.masterCode} uses ${formatEighthInches(fit.requiredSpan)} · pointer is outside the nearest ${formatEighthInches(fit.availableSpan)} opening at ${formatEighthInches(fit.gap.start)}–${formatEighthInches(fit.gap.start + fit.gap.length)}`;
    return `${item.masterCode} uses ${formatEighthInches(fit.requiredSpan)} · opening ${formatEighthInches(fit.availableSpan)} · short ${formatEighthInches(fit.shortage)}`;
  }
  return `${item.masterCode} uses ${formatEighthInches(fit.requiredSpan)} of ${formatEighthInches(fit.availableSpan)} · snap ${formatEighthInches(fit.snapStart)}–${formatEighthInches(fit.snapEnd)} · left ${formatEighthInches(fit.before)} · right ${formatEighthInches(fit.after)}`;
}

export const THREE_D_CATALOG_GROUPS = ["All", "Base", "Corner", "Wall", "Tall", "Appliances", "Accessories"] as const;
export type ThreeDCatalogGroup = (typeof THREE_D_CATALOG_GROUPS)[number];

export function filteredThreeDCatalogItems(items: InteractiveRoomCatalogItem[], group: ThreeDCatalogGroup, search: string): InteractiveRoomCatalogItem[] {
  const query = search.trim().toLowerCase();
  const normalizedCodeQuery = normalizeCode(query);
  return items.filter((item) => {
    const itemGroup = item.catalogGroup ?? (item.category === "Appliance" ? "Appliances" : item.category === "Accessory" ? "Accessories" : "Base");
    const groupMatches = group === "All" || itemGroup === group;
    const searchMatches = !query
      || `${item.masterCode} ${item.description ?? ""} ${item.category}`.toLowerCase().includes(query)
      || (normalizedCodeQuery.length > 0 && normalizeCode(item.masterCode).includes(normalizedCodeQuery));
    return groupMatches && searchMatches;
  });
}

/** Core 2D-style capabilities preserved in the compact, canvas-first 3D toolbar. */
export const THREE_D_WORKSPACE_ACTIONS = ["catalog", "view", "finish", "room", "output"] as const;

/** The add-from-catalog strip remains available for both starter rooms and saved 2D plans. */
export function shouldShowThreeDCatalog(catalogItems: InteractiveRoomCatalogItem[]): boolean {
  return catalogItems.length > 0;
}

/** The manual cart sync is meaningful only when the current 3D order has cabinet lines. */
export function canSyncThreeDOrderToCart(orderLines: readonly InteractiveRoomOrderLine[]): boolean {
  return orderLines.length > 0;
}

/** Exact remaining room from the selected cabinet to its immediate neighbors or wall edges. */
export function threeDWallClearanceText(measurement: Pick<WallSpanMeasure, "before" | "after" | "beforeIsCabinet" | "afterIsCabinet"> | null): string | null {
  if (!measurement) return null;
  const beforeBoundary = measurement.beforeIsCabinet ? "previous cabinet" : "wall edge";
  const afterBoundary = measurement.afterIsCabinet ? "next cabinet" : "wall edge";
  return `Open space: ${formatInches(measurement.before)} to ${beforeBoundary} · ${formatInches(measurement.after)} to ${afterBoundary}`;
}

/** Live 3D fit text derived from the same plan coordinates used by collision validation. */
export function threeDWallFitGuideText(measurement: WallCabinetFitMeasure | null): string | null {
  if (!measurement) return null;
  const required = exactFittedFillerInches(measurement.requiredSpan);
  const available = exactFittedFillerInches(measurement.availableSpan);
  const boundaries = `${measurement.beforeBoundary} to ${measurement.afterBoundary}`;
  const snap = `${exactFittedFillerInches(measurement.snapStart)}–${exactFittedFillerInches(measurement.snapEnd)}`;
  if (!measurement.seated) {
    return `Placement guide: cabinet uses ${required} · not seated on the ${measurement.side} wall · snap to a wall to measure available space`;
  }
  if (measurement.status === "overlap") {
    const overlaps = [
      measurement.leftOverlap > 0 ? `left overlap ${exactFittedFillerInches(measurement.leftOverlap)}` : null,
      measurement.rightOverlap > 0 ? `right overlap ${exactFittedFillerInches(measurement.rightOverlap)}` : null,
    ].filter((value): value is string => value != null);
    return `Used ${required} · available opening ${available} (${boundaries}) · ${overlaps.join(" · ")} · valid snap target ${snap}`;
  }
  if (measurement.status === "insufficient") {
    return `Used ${required} · available opening ${available} (${boundaries}) · short ${exactFittedFillerInches(measurement.shortage)} · choose a smaller cabinet`;
  }
  return `Used ${required} · available opening ${available} (${boundaries}) · snap target ${snap} · left remaining ${exactFittedFillerInches(measurement.snapBefore)} · right remaining ${exactFittedFillerInches(measurement.snapAfter)} · 0\" overlap`;
}

export function exactFittedFillerInches(width: number): string {
  return formatEighthInches(width);
}

/** Automatic gap fillers retain a source-catalog description marked "cut to". */
export function threeDFittedFillerWidthText(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "category" | "subCategory" | "width">): string | null {
  const identity = `${cabinet.masterCode} ${cabinet.description ?? ""} ${cabinet.category ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  const isFiller = /\bfiller\b|\bscribe\b/.test(identity);
  const isAutomaticFit = /\bcut to\b/.test(cabinet.description ?? "");
  if (!isFiller || !isAutomaticFit || !Number.isFinite(cabinet.width) || cabinet.width <= 0) return null;
  return `Filler cut: ${exactFittedFillerInches(cabinet.width)}`;
}

/**
 * One compact 3D notice replaces the former separate fitted-cut and maximum
 * panels. Identical stock fillers with the same installed measurement are
 * grouped, but every installed piece remains represented in `quantity` and
 * every over-maximum condition remains visible.
 */
export type ThreeDFillerMeasurementNoticeEntry = {
  masterCode: string;
  installedWidth: number;
  maximum: number;
  over: boolean;
  quantity: number;
};

export function threeDFillerMeasurementNoticeEntries(placed: readonly PlacedCabinet[]): ThreeDFillerMeasurementNoticeEntry[] {
  const grouped = new Map<string, ThreeDFillerMeasurementNoticeEntry>();
  for (const cabinet of placed) {
    if (!isFillerItem(cabinet)) continue;
    const installedWidth = Math.min(Math.abs(Number(cabinet.width)), Math.abs(Number(cabinet.depth)));
    if (!Number.isFinite(installedWidth) || installedWidth <= 0) continue;
    const range = fillerWidthRange(cabinet);
    const maximum = range == null ? 3 : range.max;
    const over = installedWidth > maximum + 0.001;
    const key = `${cabinet.masterCode}|${installedWidth}|${maximum}|${over}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    grouped.set(key, { masterCode: cabinet.masterCode, installedWidth, maximum, over, quantity: 1 });
  }
  return Array.from(grouped.values());
}

/** A complete two-piece 45° front miter confirms a physical cabinet-front datum in the 3D planner. */
export type ThreeDFrontDatumSnap = {
  groupId: string;
  datumIn: 12 | 24;
  placement: "base" | "wall" | "tall";
  cabinetCodes: [string, string];
};

/**
 * Only show a green 3D datum confirmation when the saved design carries both
 * source-priced front-miter boards and both supporting cabinets. A loose,
 * legacy wedge or a one-sided filler must never claim an aligned 24″/12″ face.
 */
export function threeDFrontDatumSnapIndicators(placed: readonly PlacedCabinet[]): ThreeDFrontDatumSnap[] {
  const byUid = new Map(placed.map((cabinet) => [cabinet.uid, cabinet]));
  const groups = new Map<string, PlacedCabinet[]>();
  for (const cabinet of placed) {
    if (cabinet.fillerTransitionKind !== "front-miter-pair" || !cabinet.fillerPieceGroupId) continue;
    const members = groups.get(cabinet.fillerPieceGroupId) ?? [];
    members.push(cabinet);
    groups.set(cabinet.fillerPieceGroupId, members);
  }

  return Array.from(groups.entries()).flatMap(([groupId, fillers]): ThreeDFrontDatumSnap[] => {
    if (fillers.length !== 2) return [];
    const [first, second] = fillers;
    if (!first || !second || first.placement !== second.placement) return [];
    if (first.placement !== "base" && first.placement !== "wall" && first.placement !== "tall") return [];
    const placement: ThreeDFrontDatumSnap["placement"] = first.placement;
    const pieces = new Set(fillers.map((filler) => filler.fillerTransitionPiece));
    if (!pieces.has("owner") || !pieces.has("neighbor")) return [];
    if (!fillers.every((filler) => filler.fillerIndependentCabinetSupport === true && (filler.fillerTransitionPlanFootprint?.length ?? 0) >= 3)) return [];

    const ownerUid = first.fillerForCabinetUid ?? second.fillerTransitionNeighborUid;
    const neighborUid = first.fillerTransitionNeighborUid ?? second.fillerForCabinetUid;
    const owner = ownerUid ? byUid.get(ownerUid) : null;
    const neighbor = neighborUid ? byUid.get(neighborUid) : null;
    if (!owner || !neighbor || owner.placement !== placement || neighbor.placement !== placement) return [];
    const datumIn: ThreeDFrontDatumSnap["datumIn"] = placement === "wall" ? 12 : 24;

    return [{
      groupId,
      datumIn,
      placement,
      cabinetCodes: [owner.masterCode, neighbor.masterCode] as [string, string],
    }];
  }).sort((left, right) => left.groupId.localeCompare(right.groupId));
}

export type InteractiveRoomPresentation = {
  cabinetFinish: string;
  countertopFinish: string;
  windowScene?: WindowSceneKind;
  windowFrameStyle?: WindowFrameStyle;
};

export type WindowSceneKind = "daylight" | "garden" | "woodland" | "coastal" | "urban" | "mountain" | "night" | "city-skyline" | "desert" | "snow" | "seasonal-garden" | "autumn-woodland" | "suburban" | "privacy";
export type WindowFrameStyle = "white" | "black" | "wood";
export type WindowConstructionStyle = "picture" | "double-hung" | "casement" | "slider" | "french-cottage";
export type WindowGridStyle = "scene-default" | "none" | "1x0" | "2x0" | "3x0" | "0x1" | "0x2" | "0x3" | "1x1" | "2x1" | "2x2" | "3x2";
export const DEFAULT_WINDOW_SCENE_KIND: WindowSceneKind = "garden";

export function windowFrameColor(style: WindowFrameStyle): string {
  if (style === "black") return "#20252b";
  if (style === "wood") return "#8a5a35";
  return "#f4f0e8";
}
export function windowConstructionGrid(style: WindowConstructionStyle = "picture"): { columns: number; rows: number } {
  if (style === "double-hung") return { columns: 0, rows: 1 };
  if (style === "casement" || style === "slider") return { columns: 1, rows: 0 };
  if (style === "french-cottage") return { columns: 1, rows: 1 };
  return { columns: 0, rows: 0 };
}

/** Real reference photographs used behind architectural window openings. */
export const WINDOW_SCENE_ASSETS: Partial<Record<WindowSceneKind, string>> = {
  // Outdoor-only photos: the Designer supplies the architectural frame and
  // glass, so these assets must not contain a second window or interior room.
  garden: "/manus-storage/garden-outdoor_99c686e1.jpg",
  woodland: "/manus-storage/woodland-outdoor_a7243038.jpg",
  coastal: "/manus-storage/coastal-outdoor_a5ed6982.jpg",
  urban: "/manus-storage/window-urban_617d07dc.jpg",
  mountain: "/manus-storage/window-mountain_2ede9ff2.jpg",
  night: "/manus-storage/window-night_0bb50bde.jpg",
  "city-skyline": "/manus-storage/city-skyline-window_f7ff8dee.jpg",
  desert: "/manus-storage/desert-landscape_64300d12.jpg",
  snow: "/manus-storage/snowy-mountain-window_37b56d4c.jpeg",
  "seasonal-garden": "/manus-storage/seasonal-garden_a6dc49d7.jpg",
  "autumn-woodland": "/manus-storage/autumn-woodland_eed9c157.jpg",
};

/** Source and license notes for the photographic presets shown in the Designer. */
export const WINDOW_SCENE_SOURCES = {
  garden: { photographer: "Karl432", license: "CC BY-SA 4.0", source: "Wikimedia Commons — View into a garden through an open ground floor window in Germany" },
  woodland: { photographer: "Johannes Plenio", license: "CC0 1.0", source: "Wikimedia Commons — Pexels-photo-1114896.jpg" },
  coastal: { photographer: "Peter Toporowski", license: "CC BY-SA 2.0", source: "Wikimedia Commons — Sylt: Window With A View" },
  "city-skyline": { photographer: "Clark Gu", license: "Unsplash License", source: "Unsplash — A view of a city from a window in a building" },
  desert: { photographer: "NEOM", license: "Unsplash License", source: "Unsplash — A desert landscape with mountains in the background" },
  snow: { photographer: "Chris F", license: "Pexels License", source: "Pexels — Serene snowy mountain landscape in winter" },
  "seasonal-garden": { photographer: "Manus image generation", license: "Original generated asset", source: "Manus-generated outdoor seasonal garden background" },
  "autumn-woodland": { photographer: "Manus image generation", license: "Original generated asset", source: "Manus-generated outdoor autumn woodland background" },
} as const;

export function windowSceneAssetUrl(kind: WindowSceneKind): string | null {
  return WINDOW_SCENE_ASSETS[kind] ?? null;
}

export type ThreeDCabinetFinishPreviewOption = {
  id: string;
  name: string;
  color: string;
};

/** Cycles Plan colors → each real selected catalog finish → Plan colors. */
export function nextThreeDCabinetFinishPreviewId(
  options: readonly ThreeDCabinetFinishPreviewOption[],
  currentId: string | null,
): string | null {
  if (options.length === 0) return null;
  if (currentId == null) return options[0]!.id;
  const currentIndex = options.findIndex((option) => option.id === currentId);
  return currentIndex >= 0 && currentIndex < options.length - 1 ? options[currentIndex + 1]!.id : null;
}

export type ThreeDCabinetMoveDirection = "up" | "down" | "left" | "right" | "in" | "out";

export type ThreeDPlanMoveDelta = { x: number; y: number };

export type ThreeDCabinetMoveResult = {
  status: "moved" | "blocked";
  message: string;
};

export function ThreeDCabinetMoveButton({ testId, direction, title, className, onMove, children }: {
  testId: string;
  direction: ThreeDCabinetMoveDirection;
  title: string;
  className: string;
  onMove: (direction: ThreeDCabinetMoveDirection) => void;
  children: ReactNode;
}) {
  const claimPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    if (event.button === 0 && event.isPrimary !== false) onMove(direction);
  };
  const activateFromKeyboard = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.detail === 0) onMove(direction);
  };
  return <button data-testid={testId} type="button" onPointerDownCapture={claimPointer} onClick={activateFromKeyboard} className={className} title={title}>{children}</button>;
}

/** Converts a screen-left/right request into the selected wall's horizontal plan axis. */
export function threeDScreenHorizontalPlanDelta(
  side: WallSide,
  direction: "left" | "right",
  incrementIn: number,
  cameraRight: Pick<THREE.Vector3, "x" | "z">,
): ThreeDPlanMoveDelta {
  const step = Math.max(0.125, Math.min(24, Number(incrementIn) || 1));
  const run = side === "top" || side === "bottom" ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const runPointsScreenRight = run.x * cameraRight.x + run.y * cameraRight.z >= 0;
  const screenRight = runPointsScreenRight ? run : { x: -run.x, y: -run.y };
  const sign = direction === "right" ? 1 : -1;
  const x = screenRight.x * step * sign;
  const y = screenRight.y * step * sign;
  return { x: Math.abs(x) < 1e-9 ? 0 : x, y: Math.abs(y) < 1e-9 ? 0 : y };
}
export type ThreeDCatalogDropTarget = { x: number; y: number; wall?: WallSide; placementUid?: string | null };
export const THREE_D_MIN_MOVE_INCREMENT_IN = 0.125;
export const THREE_D_MAX_MOVE_INCREMENT_IN = 24;
const THREE_D_FRACTION_GLYPHS: Record<string, number> = {
  "⅛": 0.125,
  "¼": 0.25,
  "⅜": 0.375,
  "½": 0.5,
  "⅝": 0.625,
  "¾": 0.75,
  "⅞": 0.875,
};

export function parsedThreeDCabinetMoveIncrement(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/(?:in(?:ches?)?|["″])$/i, "").trim();
  if (!text) return null;
  const glyph = text.match(/^(\d+(?:\.\d+)?)?\s*([⅛¼⅜½⅝¾⅞])$/);
  if (glyph) return Number(glyph[1] || 0) + THREE_D_FRACTION_GLYPHS[glyph[2]];
  const mixed = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0 ? Number(mixed[1]) + Number(mixed[2]) / denominator : null;
  }
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizedThreeDCabinetMoveIncrement(value: unknown): number {
  const parsed = parsedThreeDCabinetMoveIncrement(value);
  if (parsed == null) return 1;
  const bounded = Math.min(THREE_D_MAX_MOVE_INCREMENT_IN, Math.max(THREE_D_MIN_MOVE_INCREMENT_IN, parsed));
  return Math.round(bounded * 8) / 8;
}
export const THREE_D_EMBEDDED_TOOLBAR_CLASS = "absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1 rounded-lg border bg-background/95 p-1.5 shadow-sm backdrop-blur";
export function threeDPreviewFadeAllowed(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}
export function threeDTemporaryPreviewCounterText(counter?: { current: number; total: number }): string | null {
  return counter && counter.total > 1 ? `Suggestion ${counter.current} of ${counter.total}` : null;
}

/** Cabinet attributes stay locked until an intentional click or context-menu action picks another cabinet. */
export function threeDPointerSelectsCabinet(gesture: "move" | "up" | "context", travelPx = 0): boolean {
  return gesture === "context" || (gesture === "up" && travelPx < 6);
}

  /** Touch and pen devices open Window Attributes on a stationary tap; mouse keeps right-click. */
export function threeDTouchTapOpensWindow(
  pointerType: string,
  travelPx: number,
  openingKind: WallOpening["kind"] | null | undefined,
): boolean {
  return pointerType !== "mouse"
    && openingKind === "window"
    && threeDPointerSelectsCabinet("up", travelPx);
}

export type ThreeDRightPointerGesture = "none" | "context" | "drag";
export function threeDRightPointerGesture(button: number, travelPx: number, hasMovableCabinet: boolean): ThreeDRightPointerGesture {
  if (button !== 2 || !hasMovableCabinet) return "none";
  return travelPx >= 6 ? "drag" : "context";
}

export function threeDCabinetWallDragText(cabinet: Pick<PlacedCabinet, "masterCode">, preview: CabinetWallDragPreview): string {
  const code = cabinet.masterCode || "Cabinet";
  if (!preview.fit.containsTarget) {
    return `${code} · pointer is outside the nearest ${formatEighthInches(preview.fit.availableSpan)} opening`;
  }
  if (preview.fit.status !== "valid") {
    return `${code} uses ${formatEighthInches(preview.fit.requiredSpan)} · opening ${formatEighthInches(preview.fit.availableSpan)} · ${formatEighthInches(preview.fit.shortage)} too small`;
  }
  if (!preview.candidate) return `${code} · selected seam is blocked by another item`;
  if (!preview.snapped) {
    return `${code} · position ${formatEighthInches(preview.fit.snapStart)}–${formatEighthInches(preview.fit.snapEnd)} · left clearance ${formatEighthInches(preview.fit.before)} · right clearance ${formatEighthInches(preview.fit.after)} · 0" overlap`;
  }
  const contact = preview.fit.before <= 1e-9 ? "touching previous edge" : "touching next edge";
  return `${code} · snap ${formatEighthInches(preview.fit.snapStart)}–${formatEighthInches(preview.fit.snapEnd)} · ${contact} · 0" gap · 0" overlap`;
}

export function ThreeDRemainingSpaceLine({ before, after }: { before: number; after: number }) {
  const safeBefore = Math.max(0, before);
  const safeAfter = Math.max(0, after);
  return <div data-testid="three-d-drag-remaining-line" aria-hidden="true" className="pointer-events-none absolute left-3 right-3 top-28 z-30 flex items-center gap-1 rounded-md bg-white/90 px-2 py-2 shadow-sm backdrop-blur">
    <div data-testid="three-d-drag-remaining-before" className="relative min-w-0 border-t-2 border-[#1a2744]" style={{ flexGrow: Math.max(safeBefore, 0.01) }}><span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded bg-[#1a2744] px-1 py-0.5 text-[9px] font-bold leading-none text-white">{formatEighthInches(safeBefore)}</span></div>
    <div className="shrink-0 rounded border border-dashed border-emerald-700 bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-900">Cabinet</div>
    <div data-testid="three-d-drag-remaining-after" className="relative min-w-0 border-t-2 border-[#1a2744]" style={{ flexGrow: Math.max(safeAfter, 0.01) }}><span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded bg-[#1a2744] px-1 py-0.5 text-[9px] font-bold leading-none text-white">{formatEighthInches(safeAfter)}</span></div>
  </div>;
}

interface Props {
  scene: InteractiveRoomScene;
  /** Current 2D design items take precedence over starter-layout suggestions. */
  placed?: PlacedCabinet[];
  /** Draw crown rails around the exposed tops of upper cabinets. */
  crown?: boolean;
  /** Apply the selected finished toe-kick skin to every eligible floor cabinet. */
  toeKick?: boolean;
  roomOverride?: RoomData;
  /** Doors, cased openings, and windows from the current 2D plan. */
  openings?: WallOpening[];
  /** Countertop sink fixtures from the current 2D plan. */
  sinks?: SinkFixture[];
  /** Source-measured wall pot-fillers attached to valid range/cooktop walls. */
  potFillers?: PotFillerFixture[];
  /** Island zone, movable furniture, and half walls from the current 2D plan. */
	  island?: IslandZone | null;
	  /** A host-issued one-shot request to rotate the camera toward an island face. */
	  islandFocusRequest?: { face: "front" | "back"; key: number } | null;
  furniture?: PlacedFurniture[];
  /** Host furniture selection synchronized into the 3D fixture action card. */
  selectedFurnitureUid?: string | null;
  /** Selects the same movable fixture or planning zone in the host 2D designer. */
  onSelectFurniture?: (uid: string | null) => void;
  /** Removes a movable fixture or planning zone through the authoritative plan state. */
  onRemoveFurniture?: (uid: string) => void;
  /** Uses the same 90-degree rotation action as Floor Plan furniture controls. */
  onRotateFurniture?: (uid: string) => void;
  onOpenFurnitureAttributes?: (uid: string) => void;
  ponyWalls?: PonyWall[];
  orderSummary?: InteractiveRoomOrderSummary;
  orderLines?: InteractiveRoomOrderLine[];
  initialPresentation?: InteractiveRoomPresentation;
  /** Active design-tool finish derived from the chosen catalog door style. */
  catalogFinishOverride?: string | null;
  /** Real selected catalog finishes available for a temporary whole-room color check. */
  cabinetFinishPreviewOptions?: ThreeDCabinetFinishPreviewOption[];
  /** Exact resolved 2D finish color for each placed cabinet, keyed by placement UID. */
  cabinetFinishOverrides?: Record<string, string>;
  /** Exact saved 2D door profile for each placed cabinet, keyed by placement UID. */
  cabinetDoorProfiles?: Record<string, ThreeDDoorProfile>;
  /** Exact admin door-sample URL for each placed cabinet's effective saved style. */
  cabinetDoorSampleUrls?: Record<string, string>;
  /** Live Cabinet Config product visual for each placed cabinet, keyed by placement UID. */
  cabinetFrontVisuals?: Record<string, string>;
  /** Exact selected 2D door sample applied to 3D cabinet faces in catalog-finish mode. */
  catalogDoorSampleUrl?: string | null;
  /** Administration room scene is a visual target reference only; it never replaces saved plan geometry. */
  catalogRoomSceneUrl?: string | null;
  /** Visual-only scene shown through architectural windows in 3D. */
  windowSceneKind?: WindowSceneKind;
  /** Architectural frame finish applied to window trim and mullions. */
  windowFrameStyle?: WindowFrameStyle;
  /** Active 2D style geometry; required when a persisted saved-room scene has sparse material metadata. */
  catalogDoorProfile?: ThreeDDoorProfile | null;
  /** The exact design-level hardware choice; `none` deliberately renders no pulls. */
  hardwareStyleId?: HardwareStyleId;
  /** Optional real catalog finish tint for the existing selected hardware proxy. */
  hardwareAccent?: string;
  /** Regular Designer-owned saved choice. Absent in read-only/other-tool viewers. */
  onHardwareStyleChange?: (style: HardwareStyleId) => void;
  /** Human-readable catalog selections used in PDF and account-email output. */
  catalogFinishName?: string | null;
  /** Exact selected catalog identities retained with a final render for audit. */
  catalogFinishProductId?: number | null;
  /** Independent island cabinet finish/style used by the finished-photo prompt. */
  catalogIslandCabinetName?: string | null;
  catalogIslandCabinetColor?: string | null;
  catalogIslandCabinetProductId?: number | null;
  catalogIslandDoorSampleUrl?: string | null;
  catalogCountertopName?: string | null;
  catalogCountertopProductId?: number | null;
  catalogCountertopReferenceUrl?: string | null;
  catalogIslandCountertopName?: string | null;
  catalogIslandCountertopProductId?: number | null;
  catalogIslandCountertopReferenceUrl?: string | null;
  catalogFlooringName?: string | null;
  catalogFlooringProductId?: number | null;
  catalogFlooringReferenceUrl?: string | null;
  catalogFlooringCategory?: string | null;
  catalogFlooringSubCategory?: string | null;
  catalogFlooringSize?: string | null;
  catalogBacksplashName?: string | null;
  catalogBacksplashProductId?: number | null;
  catalogBacksplashReferenceUrl?: string | null;
  catalogHardwareReferenceUrl?: string | null;
  /** Exact selected hardware name/finish/SKU for the saved material manifest. */
  catalogHardwareName?: string | null;
  /** Saved-design identity anchors a manual final render to an auditable record. */
  savedDesignId?: number | null;
  savedDesignRevision?: string | null;
  /** Server-verified affiliate Designer access for the active storefront. */
  canAffiliateGeminiImageTest?: boolean;
  /** True only when the active 3D plan matches the persisted Save Plan payload. */
  isCurrentPlanSaved?: boolean;
  /** Canonical JSON used by Save Plan; hashed locally only to bind the capture to that same persisted plan. */
  savedPlanFingerprintPayload?: string | null;
  /** Standard stops at the upper cabinet; full-height continues to the ceiling on the same supported run. */
  backsplashHeightMode?: BacksplashHeightMode;
  /** Optional physical countertop rear upstand; wall tile begins above this strip. */
  countertopBacksplashHeightIn?: 0 | 2.5 | 3;
  /** Exact selected 2D countertop fill used when no presentation-only override exists. */
  catalogCountertopColor?: string | null;
  /** Independent island countertop fill; null/undefined follows the perimeter countertop. */
  catalogIslandCountertopColor?: string | null;
  /** Exact selected website product images used only as material maps. */
  catalogCountertopImageUrl?: string | null;
  catalogIslandCountertopImageUrl?: string | null;
  catalogFlooringImageUrl?: string | null;
  catalogBacksplashImageUrl?: string | null;
  shareContext?: { layoutPresetId: string; distributorId: number; styleId: number };
  catalogItems?: InteractiveRoomCatalogItem[];
  /** Reactive left-panel drag item used when browsers protect DataTransfer reads during dragover. */
  catalogDragItem?: InteractiveRoomCatalogItem | null;
  /** Active designer wall used to project explicit 3D catalog drops onto the correct wall plane. */
  catalogDropWall?: WallSide;
	  onAddCatalogItem?: (item: InteractiveRoomCatalogItem, dropTarget?: ThreeDCatalogDropTarget, freehand?: boolean) => void;
  /** Adds the matching hood to the editable 2D range position when one is absent. */
  onAddRangeHood?: () => void;
  onSaveToAccount?: () => void;
  /** Explicitly refreshes the main cart from the current authoritative design lines. */
  onSyncCart?: () => void;
  onPresentationChange?: (presentation: InteractiveRoomPresentation) => void;
  /** Fires once the rebuilt scene has painted its first countertop frame. */
  onGeometryRendered?: () => void;
  /** Persists an interactive wall-height adjustment back to the current 2D room. */
  onRoomWallHeightChange?: (heightIn: number) => void;
  /** Persists individual back, left, right, and front wall heights. */
  onRoomWallHeightsChange?: (heights: Record<WallSide, number>) => void;
  /** Applies a 3D attributes movement to the matching authoritative 2D placement. */
  onMoveCabinet?: (uid: string, direction: ThreeDCabinetMoveDirection, incrementIn: number, planDelta?: ThreeDPlanMoveDelta) => ThreeDCabinetMoveResult;
  /** Commits an absolute same-wall position and preserves its measured opening for the filler prompt. */
  onMoveCabinetTo?: (uid: string, x: number, y: number, preview: NonNullable<ReturnType<typeof cabinetWallDragPreview>>) => void;
  /** Host selection synchronized into the 3D action card so a second scene click is unnecessary. */
  selectedCabinetUid?: string | null;
  /** Cabinet currently controlled by the host Cabinet Attributes panel. */
  attributesTargetUid?: string | null;
  /** Part 1: placed cabinets flagged with no price on the active line (red outline). */
  missingPriceUids?: ReadonlySet<string>;
  /** Selects the same saved placement in the host 2D designer after a 3D hit. */
  onSelectCabinet?: (uid: string) => void;
  /** Opens the selected cabinet’s standard edit controls without leaving the 3D workspace. */
  onOpenCabinetEditor?: (uid: string) => void;
  /** Selects an architectural opening in the authoritative host plan. */
  onSelectOpening?: (uid: string) => void;
  /** Opens the selected window's exact attributes controls. */
  onOpenWindowEditor?: (uid: string) => void;
  /** Room door attributes use the same saved opening identity in plan and 3D. */
  onOpenDoorEditor?: (uid: string) => void;
  /** Opens the host Designer's measured, catalog-backed add or edit filler choices. */
  onRequestFiller?: (uid: string) => void;
  /** Moves an eligible glass stacker flush with the front of its deeper parent cabinet. */
  onSnapGlassCabinetToFront?: (uid: string) => ThreeDCabinetMoveResult;
  /** Uses the same 90-degree cabinet rotation action as the 2D planner. */
  onRotateCabinet?: (uid: string) => void;
  /** Removes the selected cabinet through the designer's authoritative cleanup path. */
  onRemoveCabinet?: (uid: string) => void;
  /** Keeps the primary 3D toolbar in control of wall-cabinet visibility. */
  showWallLayer?: boolean;
  onToggleWallLayer?: () => void;
  /** Non-destructive Smart Gap visual layer supplied by the designer host. */
  temporaryPreviewMessage?: string;
  onClearTemporaryPreview?: () => void;
  temporaryPreviewCounter?: { current: number; total: number };
  /** Changes whenever the host swaps a temporary preview recommendation. */
  temporaryPreviewTransitionKey?: string | null;
  /** One-shot visual cue for catalog fillers safely inserted into a measured seam. */
  fillerInsertionTransition?: { uids: string[]; key: number } | null;
  /** Renders directly inside the main designer canvas rather than a standalone preview shell. */
  embedded?: boolean;
  /** Ghosts walls between the camera and its target so the regular Designer stays visible. */
  cutawayRoomWalls?: boolean;
  /** Draws the complete authoritative 2D plan as a subdued floor reference beneath full-opacity 3D geometry. */
  hybridPlanUnderlay?: boolean;
  /** Exact admin-only Cabinet Config destination for a selected 3D cabinet. */
  cabinetConfigHref?: (cabinet: PlacedCabinet) => string | null;
  className?: string;
}

export type ThreeDPhysicalSurfaceRole =
  | "cabinet"
  | "countertop"
  | "flooring"
  | "backsplash"
  | "metal"
  | "glass"
  | "wall";

export function threeDPhysicalSurfaceProfile(role: ThreeDPhysicalSurfaceRole, hasTexture = false) {
  const profiles: Record<ThreeDPhysicalSurfaceRole, {
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    envMapIntensity: number;
  }> = {
    cabinet: { roughness: hasTexture ? 0.44 : 0.5, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.56, envMapIntensity: 0.42 },
    countertop: { roughness: hasTexture ? 0.32 : 0.36, metalness: 0, clearcoat: 0.24, clearcoatRoughness: 0.3, envMapIntensity: 0.62 },
    flooring: { roughness: hasTexture ? 0.58 : 0.64, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.7, envMapIntensity: 0.34 },
    backsplash: { roughness: hasTexture ? 0.42 : 0.52, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.48, envMapIntensity: 0.46 },
    metal: { roughness: 0.22, metalness: 0.82, clearcoat: 0.08, clearcoatRoughness: 0.28, envMapIntensity: 1.12 },
    glass: { roughness: 0.07, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.14, envMapIntensity: 1.06 },
    wall: { roughness: 0.82, metalness: 0, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: 0.35 },
  };
  return profiles[role];
}

/** Door sheen is catalog data, not an assumed glossy or glass-like reflection. */
export function threeDDoorFinishSurfaceProfile(
  finishSheen: ThreeDDoorProfile["finishSheen"] | undefined,
  hasTexture = false,
) {
  const base = threeDPhysicalSurfaceProfile("cabinet", hasTexture);
  if (finishSheen === "matte") return { ...base, roughness: hasTexture ? 0.56 : 0.6, clearcoat: 0.02, clearcoatRoughness: 0.78 };
  if (finishSheen === "gloss") return { ...base, roughness: hasTexture ? 0.25 : 0.3, clearcoat: 0.28, clearcoatRoughness: 0.22 };
  // Satin is the honest default for a wood cabinet profile: a controlled soft
  // highlight, never the transmission/reflection behavior reserved for glass.
  return { ...base, roughness: hasTexture ? 0.4 : 0.44, clearcoat: 0.1, clearcoatRoughness: 0.46 };
}

export function threeDSurfaceTextureTransform(
  role: "cabinet" | "countertop" | "flooring" | "backsplash",
  widthIn = 24,
  depthIn = 24,
) {
  if (role === "flooring") {
    return { wrap: "repeat" as const, repeatX: Math.max(1, widthIn / 24), repeatY: Math.max(1, depthIn / 24), offsetX: 0, offsetY: 0 };
  }
  if (role === "backsplash") {
    return { wrap: "repeat" as const, repeatX: Math.max(1, widthIn / 12), repeatY: Math.max(1, depthIn / 12), offsetX: 0, offsetY: 0 };
  }
  if (role === "countertop") {
    // Website slab photography commonly includes a display background. Use the
    // material-bearing center of that authoritative image instead of projecting
    // its showroom frame onto the modeled countertop.
    return { wrap: "clamp" as const, repeatX: 0.62, repeatY: 0.52, offsetX: 0.19, offsetY: 0.24 };
  }
  return { wrap: "clamp" as const, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
}

export function threeDSurfaceImageCrop(role: "countertop" | "flooring" | "backsplash") {
  if (role === "countertop") return { x: 0.28, y: 0.3, width: 0.44, height: 0.4 };
  if (role === "flooring") return { x: 0.035, y: 0.035, width: 0.93, height: 0.93 };
  return { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
}

export type ThreeDProductSurfaceRole = "countertop" | "flooring" | "backsplash";

export type ThreeDProductMaterialSource = {
  url: string;
  key: string | null;
  curated: boolean;
  /** Deterministic no-photo preview used while an exact product awaits an approved swatch. */
  proceduralFallback: boolean;
  physicalWidthIn: number | null;
  physicalDepthIn: number | null;
  sourceProductName: string | null;
  flooringPatternKind: ThreeDFlooringPatternKind | null;
  plankWidthIn: number | null;
  plankLengthIn: number | null;
  staggerOffsetsIn: number[] | null;
  backsplashPatternKind?: "field-tile" | "interlocking-mosaic" | "subway-mosaic" | null;
  backsplashModuleIn?: number | null;
  backsplashGroutJointIn?: number | null;
};

export type ThreeDFlooringPatternKind = "plank" | "tile" | "sheet" | "unknown";

export const THREE_D_PLANK_STAGGER_FRACTIONS = [0, 1 / 3, 2 / 3, 1 / 6, 1 / 2, 5 / 6, 1 / 4, 7 / 12, 11 / 12, 1 / 12, 5 / 12, 3 / 4] as const;

export function threeDFlooringPatternProfile(input: {
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
  size?: string | null;
}) {
  const identity = `${input.name ?? ""} ${input.category ?? ""} ${input.subCategory ?? ""}`.toLowerCase();
  const kind: ThreeDFlooringPatternKind = /\b(?:sheet|roll|linoleum|broadloom)\b/.test(identity)
    ? "sheet"
    : /\b(?:tile|porcelain|ceramic|mosaic)\b/.test(identity)
      ? "tile"
      : /\b(?:planks?|lvp|luxury vinyl|vinyl flooring|hardwood|engineered wood|laminate)\b/.test(identity)
        ? "plank"
        : "unknown";
  const sizeMatch = `${input.size ?? ""} ${input.name ?? ""}`.match(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|["”])?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|["”])?/i);
  const first = Number(sizeMatch?.[1]);
  const second = Number(sizeMatch?.[2]);
  const measured = Number.isFinite(first) && Number.isFinite(second) && first > 0 && second > 0;
  const plankWidthIn = kind === "plank" ? (measured ? Math.min(first, second) : 7) : null;
  const plankLengthIn = kind === "plank" ? (measured ? Math.max(first, second) : 48) : null;
  return {
    kind,
    plankWidthIn,
    plankLengthIn,
    staggerOffsetsIn: plankLengthIn
      ? THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(plankLengthIn * fraction * 8) / 8)
      : null,
  };
}

const THREE_D_AVELINE_20MIL_FLOOR_URL = "/manus-storage/aveline_20mil_7x48_staggered_floor_2675d409.webp";
const THREE_D_BAHIA_12MIL_FLOOR_URL = "/manus-storage/bahia_12mil_7x48_staggered_floor_551c6d5b.webp";
const THREE_D_ACORN_20MIL_FLOOR_URL = "/manus-storage/acorn_20mil_7_5x48_staggered_floor_3dbd212f.webp";
const THREE_D_ASTORIA_22MIL_FLOOR_URL = "/manus-storage/astoria_22mil_9x60_staggered_floor_cd0a1cf7.webp";
const THREE_D_DESERT_CLAY_MOSAIC_URL = "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp";
const THREE_D_ARCTIC_VAIL_MOSAIC_URL = "/manus-storage/arctic_vail_candidate_2_a8bed842.png";
const THREE_D_CARBON_HEX_MOSAIC_URL = "/manus-storage/carbon_hex_candidate_1_2af63616.png";
const THREE_D_CARRARA_SUBWAY_MOSAIC_URL = "/manus-storage/carrara_subway_11_97x12_13_running_bond_f57029f6.webp";
const THREE_D_CLOUDLINE_MARBLE_MOSAIC_URL = "/manus-storage/cloudline_marble_11_81x11_81_staggered_mosaic_32c5408e.webp";
const THREE_D_CONCORD_SQUARE_MOSAIC_URL = "/manus-storage/concord_square_11_81x11_81_glass_marble_mosaic_8ffff52d.webp";
const THREE_D_GLACIER_SHIFT_HERRINGBONE_URL = "/manus-storage/glacier_shift_12_05x12_05_recycled_glass_herringbone_3f2c6eb9.webp";
const THREE_D_GOLDEN_TRACE_MOSAIC_URL = "/manus-storage/golden_trace_11_81x11_81_marble_aluminum_mosaic_8ce14587.webp";

/**
 * Exact selected products may provide retail thumbnails that are unsuitable as
 * tileable maps. These two curated assets are deterministic crops/assemblies of
 * the manufacturers' own source photography at documented physical scale.
 */
export function threeDProductMaterialSource(
	role: ThreeDProductSurfaceRole,
	productName: string | null | undefined,
	originalUrl: string | null | undefined,
	surfaceMetadata?: { productId?: number | null; category?: string | null; subCategory?: string | null; size?: string | null },
): ThreeDProductMaterialSource | null {
	const normalizedName = (productName ?? "").trim().toLowerCase();
	const productId = surfaceMetadata?.productId ?? null;
	const flooringProfile = role === "flooring"
		? threeDFlooringPatternProfile({ name: productName, ...surfaceMetadata })
		: null;
	if (role === "flooring" && (normalizedName === "bahia 12mil vinyl flooring" || productId === 82)) {
    return {
      url: THREE_D_BAHIA_12MIL_FLOOR_URL,
      key: "bahia-12mil-7x48",
      curated: true,
      proceduralFallback: false,
      physicalWidthIn: 192,
      physicalDepthIn: 84,
      sourceProductName: productName ?? null,
      flooringPatternKind: "plank",
      plankWidthIn: 7,
      plankLengthIn: 48,
      staggerOffsetsIn: THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(48 * fraction * 8) / 8),
    };
  }
	if (role === "flooring" && (normalizedName === "acorn 20mil dryback planks" || productId === 40)) {
	  return {
      url: THREE_D_ACORN_20MIL_FLOOR_URL,
      key: "acorn-20mil-7.5x48",
      curated: true,
      proceduralFallback: false,
      physicalWidthIn: 192,
      physicalDepthIn: 90,
      sourceProductName: productName ?? null,
      flooringPatternKind: "plank",
      plankWidthIn: 7.5,
      plankLengthIn: 48,
	    staggerOffsetsIn: THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(48 * fraction * 8) / 8),
	  };
	}
	if (role === "flooring" && (normalizedName === "astoria 22mil vinyl flooring" || productId === 54)) {
	  return {
	    url: THREE_D_ASTORIA_22MIL_FLOOR_URL,
	    key: "astoria-22mil-9x60",
	    curated: true,
	    proceduralFallback: false,
	    physicalWidthIn: 240,
	    physicalDepthIn: 108,
	    sourceProductName: productName ?? null,
	    flooringPatternKind: "plank",
	    plankWidthIn: 9,
	    plankLengthIn: 60,
	    staggerOffsetsIn: THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(60 * fraction * 8) / 8),
	  };
	}
  const quartzMap = role === "countertop" ? pelicanQuartzMaterialMap(productName) : null;
  if (quartzMap) {
    return {
      url: quartzMap.materialImageUrl,
      key: `pelican-quartz:${quartzMap.handle}`,
      curated: true,
      proceduralFallback: false,
      physicalWidthIn: quartzMap.physicalWidthIn,
      physicalDepthIn: quartzMap.physicalDepthIn,
      sourceProductName: productName ?? null,
      flooringPatternKind: null,
      plankWidthIn: null,
      plankLengthIn: null,
      staggerOffsetsIn: null,
    };
  }
	if (role === "backsplash" && (normalizedName === "desert clay" || productId === 183)) {
	  return {
	    url: THREE_D_DESERT_CLAY_MOSAIC_URL,
      key: "desert-clay-11.81in-interlocking-mosaic",
      curated: true,
      proceduralFallback: false,
      physicalWidthIn: 11.81,
      physicalDepthIn: 11.81,
      sourceProductName: productName ?? null,
      flooringPatternKind: null,
      plankWidthIn: null,
      plankLengthIn: null,
      staggerOffsetsIn: null,
      backsplashPatternKind: "interlocking-mosaic",
      backsplashModuleIn: 11.81,
	    backsplashGroutJointIn: 1 / 16,
	  };
	}
	if (role === "backsplash" && (normalizedName === "arctic vail" || productId === 47)) {
	  return {
	    url: THREE_D_ARCTIC_VAIL_MOSAIC_URL,
	    key: "arctic-vail-10.71in-interlocking-hex-mosaic",
	    curated: true,
	    proceduralFallback: false,
	    physicalWidthIn: 10.71,
	    physicalDepthIn: 10.55,
	    sourceProductName: productName ?? null,
	    flooringPatternKind: null,
	    plankWidthIn: null,
	    plankLengthIn: null,
	    staggerOffsetsIn: null,
	    backsplashPatternKind: "interlocking-mosaic",
	    backsplashModuleIn: 10.71,
	    backsplashGroutJointIn: 1 / 16,
	  };
	}
	if (role === "backsplash" && (normalizedName === "carbon hex" || productId === 142)) {
	  return {
	    url: THREE_D_CARBON_HEX_MOSAIC_URL,
	    key: "carbon-hex-12.80in-marble-hex-mosaic",
	    curated: true,
	    proceduralFallback: false,
	    physicalWidthIn: 12.8,
	    physicalDepthIn: 11.1,
	    sourceProductName: productName ?? null,
	    flooringPatternKind: null,
	    plankWidthIn: null,
	    plankLengthIn: null,
	    staggerOffsetsIn: null,
	    backsplashPatternKind: "interlocking-mosaic",
	    backsplashModuleIn: 12.8,
	    backsplashGroutJointIn: 1 / 16,
	  };
	}
		if (role === "flooring" && (normalizedName === "aveline 20mil vinyl flooring" || productId === 73)) {
    return {
	      url: THREE_D_AVELINE_20MIL_FLOOR_URL,
	      key: "aveline-20mil-7x48",
	      curated: true,
	      proceduralFallback: false,
	      physicalWidthIn: 192,
      physicalDepthIn: 84,
      sourceProductName: productName ?? null,
      flooringPatternKind: "plank",
      plankWidthIn: 7,
      plankLengthIn: 48,
      staggerOffsetsIn: THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(48 * fraction * 8) / 8),
    };
  }
	if (role === "backsplash" && (normalizedName === "carrara subway" || productId === 144)) {
		return {
			url: THREE_D_CARRARA_SUBWAY_MOSAIC_URL,
			key: "carrara-subway-11.97in-running-bond-mosaic",
			curated: true,
			proceduralFallback: false,
			physicalWidthIn: 11.97,
			physicalDepthIn: 12.13,
			sourceProductName: productName ?? null,
			flooringPatternKind: null,
			plankWidthIn: null,
			plankLengthIn: null,
			staggerOffsetsIn: null,
			backsplashPatternKind: "subway-mosaic",
			backsplashModuleIn: 11.97,
			backsplashGroutJointIn: 1 / 16,
		};
	}
	if (role === "backsplash" && (normalizedName === "cloudline marble" || productId === 149)) {
		return {
			url: THREE_D_CLOUDLINE_MARBLE_MOSAIC_URL,
			key: "cloudline-marble-11.81in-staggered-glass-marble-mosaic",
			curated: true,
			proceduralFallback: false,
			physicalWidthIn: 11.81,
			physicalDepthIn: 11.81,
			sourceProductName: productName ?? null,
			flooringPatternKind: null,
			plankWidthIn: null,
			plankLengthIn: null,
			staggerOffsetsIn: null,
			backsplashPatternKind: "subway-mosaic",
			backsplashModuleIn: 11.81,
			backsplashGroutJointIn: 1 / 16,
		};
	}
	if (role === "backsplash" && (normalizedName === "concord square" || productId === 164)) {
		return {
			url: THREE_D_CONCORD_SQUARE_MOSAIC_URL,
			key: "concord-square-11.81in-glass-marble-mosaic",
			curated: true,
			proceduralFallback: false,
			physicalWidthIn: 11.81,
			physicalDepthIn: 11.81,
			sourceProductName: productName ?? null,
			flooringPatternKind: null,
			plankWidthIn: null,
			plankLengthIn: null,
			staggerOffsetsIn: null,
			backsplashPatternKind: "interlocking-mosaic",
			backsplashModuleIn: 11.81,
			backsplashGroutJointIn: 1 / 16,
		};
	}
	if (role === "backsplash" && (normalizedName === "glacier shift" || productId === 242)) {
		return {
			url: THREE_D_GLACIER_SHIFT_HERRINGBONE_URL,
			key: "glacier-shift-12.05in-recycled-glass-herringbone",
			curated: true,
			proceduralFallback: false,
			physicalWidthIn: 12.05,
			physicalDepthIn: 12.05,
			sourceProductName: productName ?? null,
			flooringPatternKind: null,
			plankWidthIn: null,
			plankLengthIn: null,
			staggerOffsetsIn: null,
			backsplashPatternKind: "interlocking-mosaic",
			backsplashModuleIn: 12.05,
			backsplashGroutJointIn: 1 / 16,
		};
	}
	if (role === "backsplash" && (normalizedName === "golden trace" || productId === 244)) {
		return {
			url: THREE_D_GOLDEN_TRACE_MOSAIC_URL,
			key: "golden-trace-11.81in-marble-aluminum-mosaic",
			curated: true,
			proceduralFallback: false,
			physicalWidthIn: 11.81,
			physicalDepthIn: 11.81,
			sourceProductName: productName ?? null,
			flooringPatternKind: null,
			plankWidthIn: null,
			plankLengthIn: null,
			staggerOffsetsIn: null,
			backsplashPatternKind: "interlocking-mosaic",
			backsplashModuleIn: 11.81,
			backsplashGroutJointIn: 1 / 16,
		};
	}
	// Shopper-facing room and product-card imagery is never allowed into this
	// texture path. A selected product without an approved swatch still receives
	// a visible deterministic representative material, not a missing surface.
	if (!originalUrl) {
		if (!productName?.trim()) return null;
		return {
			url: "",
			key: `representative-${role}`,
			curated: false,
			proceduralFallback: true,
			physicalWidthIn: role === "countertop" ? 138 : null,
			physicalDepthIn: role === "countertop" ? 79 : null,
			sourceProductName: productName,
			flooringPatternKind: flooringProfile?.kind ?? null,
			plankWidthIn: flooringProfile?.plankWidthIn ?? null,
			plankLengthIn: flooringProfile?.plankLengthIn ?? null,
			staggerOffsetsIn: flooringProfile?.staggerOffsetsIn ?? null,
		};
	}
	return {
	  url: originalUrl,
	  key: null,
	  curated: false,
	  proceduralFallback: false,
	  physicalWidthIn: null,
    physicalDepthIn: null,
    sourceProductName: productName ?? null,
    flooringPatternKind: flooringProfile?.kind ?? null,
    plankWidthIn: flooringProfile?.plankWidthIn ?? null,
    plankLengthIn: flooringProfile?.plankLengthIn ?? null,
    staggerOffsetsIn: flooringProfile?.staggerOffsetsIn ?? null,
	};
}

/** Stable seed used only to vary a neutral representative material preview. */
function threeDMaterialPreviewSeed(value: string | null | undefined) {
	return Array.from(value ?? "").reduce((seed, char) => ((seed * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

/**
 * In-memory neutral material fields retain visual surface feedback while a
 * selected catalog product awaits an admin-approved material-only swatch. They
 * cannot contain retail labels, framed samples, room photography, or geometry.
 */
function threeDRepresentativeSurfaceTexture(role: ThreeDProductSurfaceRole, source: ThreeDProductMaterialSource): THREE.CanvasTexture | null {
	if (typeof document === "undefined") return null;
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return null;
	const seed = threeDMaterialPreviewSeed(source.sourceProductName);
	const tone = seed % 18;

	if (role === "flooring" && source.flooringPatternKind === "plank") {
		const profile = threeDPlankAtlasProfile(source.plankWidthIn ?? 7, source.plankLengthIn ?? 48);
		canvas.width = 768;
		canvas.height = Math.max(180, Math.round(canvas.width * profile.physicalDepthIn / profile.physicalWidthIn));
		const rowHeight = canvas.height / profile.rows;
		const boardWidth = canvas.width / profile.columns;
		for (let row = 0; row < profile.rows; row += 1) {
			const lightness = 34 + ((tone + row * 5) % 14);
			context.fillStyle = `hsl(${25 + ((seed + row * 7) % 24)} ${20 + (seed % 12)}% ${lightness}%)`;
			context.fillRect(0, row * rowHeight, canvas.width, rowHeight);
			const offset = (profile.staggerOffsetsIn[row] / (source.plankLengthIn ?? 48)) * boardWidth;
			context.strokeStyle = "rgba(48,35,24,0.48)";
			context.lineWidth = 1.2;
			context.beginPath();
			context.moveTo(0, row * rowHeight + 0.6);
			context.lineTo(canvas.width, row * rowHeight + 0.6);
			for (let x = -offset; x <= canvas.width + boardWidth; x += boardWidth) {
				context.moveTo(x, row * rowHeight + 1);
				context.lineTo(x, (row + 1) * rowHeight - 1);
			}
			context.stroke();
		}
	} else if (role === "flooring" && source.flooringPatternKind === "tile") {
		// The standard flooring texture transform represents a 24-inch field.
		// Draw four 12-inch cells in that field so selected tile keeps its real
		// construction rhythm without turning into a plank or a blank color.
		canvas.width = 240;
		canvas.height = 240;
		context.fillStyle = `hsl(${24 + (seed % 28)} ${8 + (seed % 11)}% ${69 + (tone % 17)}%)`;
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.strokeStyle = "rgba(83,78,71,0.5)";
		context.lineWidth = 4;
		context.beginPath();
		context.moveTo(canvas.width / 2, 0);
		context.lineTo(canvas.width / 2, canvas.height);
		context.moveTo(0, canvas.height / 2);
		context.lineTo(canvas.width, canvas.height / 2);
		context.stroke();
		context.strokeStyle = "rgba(255,255,255,0.18)";
		context.lineWidth = 1.2;
		context.strokeRect(2, 2, canvas.width / 2 - 4, canvas.height / 2 - 4);
		context.strokeRect(canvas.width / 2 + 2, 2, canvas.width / 2 - 4, canvas.height / 2 - 4);
		context.strokeRect(2, canvas.height / 2 + 2, canvas.width / 2 - 4, canvas.height / 2 - 4);
		context.strokeRect(canvas.width / 2 + 2, canvas.height / 2 + 2, canvas.width / 2 - 4, canvas.height / 2 - 4);
	} else if (role === "backsplash") {
		canvas.width = 240;
		canvas.height = 240;
		context.fillStyle = `hsl(${30 + (seed % 26)} ${9 + (seed % 12)}% ${78 + (tone % 11)}%)`;
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.strokeStyle = "rgba(91,86,79,0.46)";
		context.lineWidth = 5;
		context.strokeRect(2.5, 2.5, canvas.width - 5, canvas.height - 5);
		context.strokeStyle = "rgba(255,255,255,0.22)";
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(10, 14);
		context.lineTo(canvas.width - 14, 10);
		context.stroke();
	} else if (role === "countertop") {
		canvas.width = 690;
		canvas.height = 395;
		context.fillStyle = `hsl(${28 + (seed % 24)} ${7 + (seed % 10)}% ${74 + (tone % 13)}%)`;
		context.fillRect(0, 0, canvas.width, canvas.height);
		for (let vein = 0; vein < 7; vein += 1) {
			const y = 30 + ((seed >>> (vein % 16)) % Math.max(1, canvas.height - 60));
			context.strokeStyle = vein % 2 ? "rgba(121,111,99,0.26)" : "rgba(255,255,255,0.46)";
			context.lineWidth = 1.2 + ((seed + vein) % 3);
			context.beginPath();
			context.moveTo(-30, y);
			context.bezierCurveTo(canvas.width * 0.24, y - 44, canvas.width * 0.66, y + 48, canvas.width + 30, y + ((vein % 3) - 1) * 32);
			context.stroke();
		}
	} else {
		canvas.width = 320;
		canvas.height = 320;
		context.fillStyle = `hsl(${25 + (seed % 25)} 13% ${63 + (tone % 16)}%)`;
		context.fillRect(0, 0, canvas.width, canvas.height);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.userData = { representativePreview: true, materialOnlyNoGeometryChange: true };
	return texture;
}

export function threeDProductSurfaceTextureTransform(
  role: ThreeDProductSurfaceRole,
  source: ThreeDProductMaterialSource,
  widthIn: number,
  depthIn: number,
) {
  if (source.curated && source.physicalWidthIn && source.physicalDepthIn) {
    const rotateForLongRoom = role === "flooring" && depthIn > widthIn;
    return {
      wrap: "repeat" as const,
      repeatX: Math.max(0.01, (rotateForLongRoom ? depthIn : widthIn) / source.physicalWidthIn),
      repeatY: Math.max(0.01, (rotateForLongRoom ? widthIn : depthIn) / source.physicalDepthIn),
      offsetX: 0,
      offsetY: 0,
      rotation: rotateForLongRoom ? Math.PI / 2 : 0,
    };
  }
  if (role === "flooring" && source.flooringPatternKind === "plank" && source.plankWidthIn && source.plankLengthIn) {
    const atlas = threeDPlankAtlasProfile(source.plankWidthIn, source.plankLengthIn);
    const rotateForLongRoom = depthIn > widthIn;
    return {
      wrap: "repeat" as const,
      repeatX: Math.max(0.01, (rotateForLongRoom ? depthIn : widthIn) / atlas.physicalWidthIn),
      repeatY: Math.max(0.01, (rotateForLongRoom ? widthIn : depthIn) / atlas.physicalDepthIn),
      offsetX: 0,
      offsetY: 0,
      rotation: rotateForLongRoom ? Math.PI / 2 : 0,
    };
  }
  return { ...threeDSurfaceTextureTransform(role, widthIn, depthIn), rotation: 0 };
}

export function threeDPlankAtlasProfile(plankWidthIn = 7, plankLengthIn = 48) {
  const safeWidth = Math.max(1, plankWidthIn);
  const safeLength = Math.max(safeWidth * 2, plankLengthIn);
  return {
    plankWidthIn: safeWidth,
    plankLengthIn: safeLength,
    rows: THREE_D_PLANK_STAGGER_FRACTIONS.length,
    columns: 4,
    physicalWidthIn: safeLength * 4,
    physicalDepthIn: safeWidth * THREE_D_PLANK_STAGGER_FRACTIONS.length,
    staggerOffsetsIn: THREE_D_PLANK_STAGGER_FRACTIONS.map((fraction) => Math.round(safeLength * fraction * 8) / 8),
  };
}

function normalizedThreeDPlankImage(
  source: HTMLImageElement,
  plankWidthIn: number,
  plankLengthIn: number,
  maxDimension: number,
): HTMLImageElement | HTMLCanvasElement {
  const sourceWidth = Number(source.naturalWidth ?? source.width ?? 0);
  const sourceHeight = Number(source.naturalHeight ?? source.height ?? 0);
  if (!sourceWidth || !sourceHeight || typeof document === "undefined") return source;
  const profile = threeDPlankAtlasProfile(plankWidthIn, plankLengthIn);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(512, Math.min(2048, maxDimension * 2));
  const boardLengthPx = canvas.width / profile.columns;
  const rowHeightPx = Math.max(12, Math.round(boardLengthPx * profile.plankWidthIn / profile.plankLengthIn));
  canvas.height = rowHeightPx * profile.rows;
  const context = canvas.getContext("2d");
  if (!context) return source;
  const crop = threeDSurfaceImageCrop("flooring");
  const cropX = sourceWidth * crop.x;
  const cropY = sourceHeight * crop.y;
  const cropWidth = sourceWidth * crop.width;
  const cropHeight = sourceHeight * crop.height;
  const sourceAspect = profile.plankLengthIn / profile.plankWidthIn;
  let sampleWidth = cropWidth;
  let sampleHeight = sampleWidth / sourceAspect;
  if (sampleHeight > cropHeight) {
    sampleHeight = cropHeight;
    sampleWidth = sampleHeight * sourceAspect;
  }
  const joint = Math.max(1, Math.round(canvas.width / 1024));
  for (let row = 0; row < profile.rows; row++) {
    const y = row * rowHeightPx;
    const offsetPx = profile.staggerOffsetsIn[row] / profile.plankLengthIn * boardLengthPx;
    let x = -offsetPx;
    let boardIndex = 0;
    while (x < canvas.width) {
      const variation = (row * 5 + boardIndex * 3) % 11;
      const sxRange = Math.max(0, cropWidth - sampleWidth);
      const syRange = Math.max(0, cropHeight - sampleHeight);
      const sx = cropX + sxRange * ((variation % 5) / 4);
      const sy = cropY + syRange * (((variation * 7) % 11) / 10);
      context.save();
      if ((row + boardIndex) % 2 === 1) {
        context.translate(x + boardLengthPx, 0);
        context.scale(-1, 1);
        context.drawImage(source, sx, sy, sampleWidth, sampleHeight, 0, y, boardLengthPx, rowHeightPx);
      } else {
        context.drawImage(source, sx, sy, sampleWidth, sampleHeight, x, y, boardLengthPx, rowHeightPx);
      }
      context.restore();
      if (x > 0) {
        context.fillStyle = "rgba(70, 58, 42, 0.42)";
        context.fillRect(Math.round(x), y + 1, joint, Math.max(1, rowHeightPx - 2));
      }
      x += boardLengthPx;
      boardIndex += 1;
    }
    if (row > 0) {
      context.fillStyle = "rgba(78, 65, 48, 0.32)";
      context.fillRect(0, y, canvas.width, joint);
    }
  }
  return canvas;
}

export function threeDCountertopSlabTextureTransform(input: {
  centerXIn: number;
  centerZIn: number;
  localWidthIn: number;
  localDepthIn: number;
  rotation: number;
  slabWidthIn?: number;
  slabDepthIn?: number;
}) {
  const slabWidthIn = input.slabWidthIn ?? 138;
  const slabDepthIn = input.slabDepthIn ?? 79;
  return {
    repeatX: Math.max(0.01, input.localWidthIn / slabWidthIn),
    repeatY: Math.max(0.01, input.localDepthIn / slabDepthIn),
    offsetX: ((input.centerXIn - input.localWidthIn / 2) / slabWidthIn) % 1,
    offsetY: ((input.centerZIn - input.localDepthIn / 2) / slabDepthIn) % 1,
    rotation: input.rotation === 0 ? 0 : -input.rotation,
  };
}

function threeDTextureForCountertopMesh(
  source: THREE.Texture | null,
  input: Parameters<typeof threeDCountertopSlabTextureTransform>[0],
) {
  if (!source || !String(source.userData?.curatedSurfaceKey ?? "").startsWith("pelican-quartz:")) return source;
  const texture = source.clone();
  const transform = threeDCountertopSlabTextureTransform(input);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(transform.repeatX, transform.repeatY);
  texture.offset.set(transform.offsetX, transform.offsetY);
  texture.center.set(0.5, 0.5);
  texture.rotation = transform.rotation;
  texture.needsUpdate = true;
  texture.userData = { ...source.userData, worldSlabMapped: true };
  return texture;
}

function normalizedThreeDSurfaceImage(
  source: HTMLImageElement,
  role: "countertop" | "flooring" | "backsplash",
  maxDimension: number,
): HTMLImageElement | HTMLCanvasElement {
  const dimensions = source as HTMLImageElement & {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const sourceWidth = Number(dimensions.naturalWidth ?? dimensions.videoWidth ?? dimensions.width ?? 0);
  const sourceHeight = Number(dimensions.naturalHeight ?? dimensions.videoHeight ?? dimensions.height ?? 0);
  if (!sourceWidth || !sourceHeight || typeof document === "undefined") return source;
  const crop = threeDSurfaceImageCrop(role);
  const cropWidth = Math.max(1, sourceWidth * crop.width);
  const cropHeight = Math.max(1, sourceHeight * crop.height);
  const scale = Math.min(1, maxDimension / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(
    source,
    sourceWidth * crop.x,
    sourceHeight * crop.y,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

/**
 * Backsplash catalog images are product swatches, not a wall mural. Crop their
 * material-bearing center once, then repeat that single selected tile on a real
 * 12-inch module so white retail-photo surrounds cannot become empty field gaps.
 */
function normalizedThreeDBacksplashTileImage(
  source: HTMLImageElement,
  maxDimension: number,
): HTMLImageElement | HTMLCanvasElement {
  const sourceWidth = Number(source.naturalWidth ?? source.width ?? 0);
  const sourceHeight = Number(source.naturalHeight ?? source.height ?? 0);
  if (!sourceWidth || !sourceHeight || typeof document === "undefined") return source;
  const sourceSide = Math.min(sourceWidth, sourceHeight);
  const cropSide = Math.max(1, sourceSide * 0.76);
  const canvasSide = Math.max(96, Math.min(maxDimension, Math.round(cropSide)));
  const canvas = document.createElement("canvas");
  canvas.width = canvasSide;
  canvas.height = canvasSide;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(
    source,
    (sourceWidth - cropSide) / 2,
    (sourceHeight - cropSide) / 2,
    cropSide,
    cropSide,
    0,
    0,
    canvasSide,
    canvasSide,
  );
  return canvas;
}

export type ThreeDRenderQualityTier = "mobile" | "balanced" | "high";

export function threeDRenderQualityProfile(input: {
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  coarsePointer?: boolean;
  hardwareConcurrency?: number | null;
  deviceMemoryGb?: number | null;
}) {
  const constrainedHardware = (input.hardwareConcurrency ?? 8) <= 4 || (input.deviceMemoryGb ?? 8) <= 4;
  const mobileViewport = input.coarsePointer === true || input.canvasWidth <= 640;
  const tier: ThreeDRenderQualityTier = mobileViewport
    ? "mobile"
    : constrainedHardware || input.canvasWidth < 1100 || input.canvasHeight < 620
      ? "balanced"
      : "high";
  if (tier === "mobile") {
    return { tier, pixelRatioCap: 1.25, shadowMapSize: 1024, maxAnisotropy: 4, environmentEnabled: true };
  }
  if (tier === "balanced") {
    return { tier, pixelRatioCap: 1.5, shadowMapSize: 1536, maxAnisotropy: 6, environmentEnabled: true };
  }
  return { tier, pixelRatioCap: 1.75, shadowMapSize: 2048, maxAnisotropy: 8, environmentEnabled: true };
}

export type HybridPlanUnderlayModel = {
  room: { width: number; depth: number };
  cabinets: Array<{ uid: string; masterCode: string; placement: PlacedCabinet["placement"]; x: number; y: number; width: number; depth: number }>;
  openings: Array<{ uid: string; side: WallSide; offset: number; width: number; kind: WallOpening["kind"] }>;
};

/** The hybrid reference is derived from the same saved objects rendered in 3D. */
export function hybridPlanUnderlayModel(room: RoomData, placed: PlacedCabinet[], openings: WallOpening[]): HybridPlanUnderlayModel {
  return {
    room: { width: room.width, depth: room.depth },
    cabinets: placed.map((cabinet) => {
      const footprint = placedFootprint(cabinet);
      return { uid: cabinet.uid, masterCode: cabinet.masterCode, placement: cabinet.placement, x: cabinet.x, y: cabinet.y, width: footprint.w, depth: footprint.d };
    }),
    openings: openings.map((opening) => ({ uid: opening.uid, side: opening.side, offset: opening.offset, width: opening.width, kind: opening.kind })),
  };
}

function hybridPlanTexture(model: HybridPlanUnderlayModel): THREE.CanvasTexture {
  const longest = Math.max(model.room.width, model.room.depth, 1);
  const pixelsPerInch = Math.max(3, Math.min(8, 1536 / longest));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(384, Math.round(model.room.width * pixelsPerInch));
  canvas.height = Math.max(384, Math.round(model.room.depth * pixelsPerInch));
  const context = canvas.getContext("2d")!;
  const sx = canvas.width / model.room.width;
  const sy = canvas.height / model.room.depth;
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(77,92,112,0.17)";
  for (let inch = 12; inch < model.room.width; inch += 12) {
    context.beginPath(); context.moveTo(inch * sx, 0); context.lineTo(inch * sx, canvas.height); context.stroke();
  }
  for (let inch = 12; inch < model.room.depth; inch += 12) {
    context.beginPath(); context.moveTo(0, inch * sy); context.lineTo(canvas.width, inch * sy); context.stroke();
  }
  for (const cabinet of model.cabinets) {
    const palette = cabinet.placement === "appliance"
      ? ["rgba(71,85,105,0.18)", "rgba(51,65,85,0.58)"]
      : cabinet.placement === "wall"
        ? ["rgba(212,167,90,0.16)", "rgba(138,101,31,0.58)"]
        : ["rgba(26,39,68,0.11)", "rgba(26,39,68,0.50)"];
    const x = cabinet.x * sx;
    const y = cabinet.y * sy;
    const width = cabinet.width * sx;
    const depth = cabinet.depth * sy;
    context.fillStyle = palette[0];
    context.strokeStyle = palette[1];
    context.lineWidth = Math.max(1, pixelsPerInch * 0.22);
    context.fillRect(x, y, width, depth);
    context.strokeRect(x, y, width, depth);
    if (width >= 34 && depth >= 16) {
      context.fillStyle = "rgba(26,39,68,0.70)";
      context.font = `600 ${Math.max(9, Math.round(pixelsPerInch * 1.25))}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(cabinet.masterCode, x + width / 2, y + depth / 2, Math.max(0, width - 6));
    }
  }
  context.lineCap = "square";
  for (const opening of model.openings) {
    context.lineWidth = Math.max(4, pixelsPerInch * 0.75);
    context.strokeStyle = opening.kind === "door" ? "rgba(180,83,9,0.75)" : opening.kind === "window" ? "rgba(2,132,199,0.72)" : "rgba(124,58,237,0.68)";
    context.beginPath();
    if (opening.side === "top") { context.moveTo(opening.offset * sx, 0); context.lineTo((opening.offset + opening.width) * sx, 0); }
    else if (opening.side === "bottom") { context.moveTo(opening.offset * sx, canvas.height); context.lineTo((opening.offset + opening.width) * sx, canvas.height); }
    else if (opening.side === "left") { context.moveTo(0, opening.offset * sy); context.lineTo(0, (opening.offset + opening.width) * sy); }
    else { context.moveTo(canvas.width, opening.offset * sy); context.lineTo(canvas.width, (opening.offset + opening.width) * sy); }
    context.stroke();
  }
  context.strokeStyle = "rgba(26,39,68,0.88)";
  context.lineWidth = Math.max(3, pixelsPerInch * 0.55);
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillStyle = "rgba(26,39,68,0.78)";
  context.font = `700 ${Math.max(10, Math.round(pixelsPerInch * 1.35))}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(`${model.room.width}\"`, canvas.width / 2, 8);
  context.save();
  context.translate(8, canvas.height / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(`${model.room.depth}\"`, 0, 0);
  context.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const INCH = 1 / 12;
export const THREE_D_WALL_SIDES: WallSide[] = ["top", "left", "right", "bottom"];
const BASE_DEPTH = 24;
const WALL_DEPTH = 12;
const THREE_D_TOE_KICK = 4.5;
export const THREE_D_CABINET_FRONT_OUTER_REVEAL_IN = 1 / 16;
export const THREE_D_CABINET_FRONT_CENTER_GAP_IN = 1 / 8;

export function threeDCabinetFrontColumnLayout(bodyWidth: number, count: number) {
  const columnCount = Math.max(1, Math.round(count));
  const outerReveal = THREE_D_CABINET_FRONT_OUTER_REVEAL_IN * INCH;
  const centerGap = THREE_D_CABINET_FRONT_CENTER_GAP_IN * INCH;
  const availableWidth = Math.max(
    0.08,
    bodyWidth - outerReveal * 2 - centerGap * Math.max(0, columnCount - 1),
  );
  const columnWidth = availableWidth / columnCount;
  return {
    columnCount,
    columnWidth,
    centerGap,
    outerReveal,
    centerX(index: number) {
      return -bodyWidth / 2 + outerReveal + columnWidth / 2 + index * (columnWidth + centerGap);
    },
  };
}
// A 1½-inch countertop sits directly on the 34½-inch base cabinet, so its
// center is 35¼ inches—not the 37½-inch finished-counter height. Keeping this
// as the slab center prevents a visible vertical gap above every base run.
const COUNTERTOP_H = 35.25;
const COUNTERTOP_TOP = 36;
// The shared 2D plan, material takeoff, and cabinet standards all use a
// 25½-inch top over a standard 24-inch base: exactly 1½ inches at the front
// and no invented rear projection. Keep this explicit 3D placement constant
// in lockstep so the rendered cabinet edge cannot look deeper or shallower
// than its measured plan surface.
const COUNTERTOP_FRONT_OVERHANG = 1.5 * INCH;
const WALL_BOTTOM = 54;
const CABINET_FINISHES = [
  { name: "Catalog finish", color: "catalog" },
  { name: "Soft White", color: "#f2f0ea" },
  { name: "Sage", color: "#78826b" },
  { name: "Navy", color: "#435b77" },
  { name: "Walnut", color: "#75523e" },
  { name: "Charcoal", color: "#34363a" },
] as const;
const COUNTERTOP_FINISHES = [
  { name: "Quartz", color: "#e9e7e2" },
  { name: "Carrara", color: "#d7d7d3" },
  { name: "Soapstone", color: "#3d4245" },
  { name: "Sand", color: "#c9b8a1" },
  { name: "Black", color: "#202124" },
] as const;
export const THREE_D_EXPORT_SIZE = { width: 2000, height: 1400 } as const;

/** Keeps the selected 3D cabinet card informative even for sparse legacy records. */
export function threeDSelectedCabinetDescription(cabinet: Pick<PlacedCabinet, "masterCode" | "fillerPieceGroupId" | "fillerPlacementMode"> & { description?: string | null }): string {
  const description = cabinet.description?.trim();
  if (description) {
    // Preserve legacy SCR source rows and their SKU for ordering, but call an
    // installed, linked cut what it is in the design: a cabinet filler.
    if (cabinet.fillerPieceGroupId && cabinet.fillerPlacementMode && /\bscribe\b/i.test(description)) {
      const cut = description.match(/(?:[AB]\s+front\s+)?filler\s+cut\s+to\s+.+$/i)?.[0]
        ?? description.match(/cut\s+to\s+.+$/i)?.[0];
      return cut ? `Filler — ${cut}` : "Filler";
    }
    return description;
  }

  const code = cabinet.masterCode?.trim();
  return code ? `${code} cabinet` : "Catalog cabinet";
}

/** Converts the host designer selection into the data shown by the 3D action card. */
export function threeDSelectionFromPlaced(uid: string | null | undefined, placed: PlacedCabinet[]): ThreeDCabinetHit | null {
  if (!uid) return null;
  const cabinet = placed.find((item) => item.uid === uid);
  return cabinet
    ? { uid: cabinet.uid, masterCode: cabinet.masterCode, description: cabinet.description, distributorSkuId: null }
    : null;
}

/** Keeps selected-cabinet details in document flow below the drawing instead of covering the 3D canvas. */
export function threeDSelectedCabinetDockClass(): string {
	return "relative mt-1 max-h-[min(18dvh,132px)] w-full shrink-0 overflow-y-auto overscroll-contain rounded-md border bg-background px-2 py-1 text-[11px] shadow-sm";
}

export type ThreeDCabinetHit = {
  uid: string | null;
  masterCode: string;
  description: string | null;
  distributorSkuId: number | null;
};

/** Exact saved furniture identity resolved from a visible 3D fixture child. */
export type ThreeDFurnitureHit = {
  uid: string;
  defId: string;
  pelicanCode: string | null;
  fixtureKind: string | null;
};

export function threeDFurnitureHitFromObject(object: THREE.Object3D): ThreeDFurnitureHit | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (typeof node.userData.furnitureUid === "string" && typeof node.userData.furnitureDefId === "string") {
      return {
        uid: node.userData.furnitureUid,
        defId: node.userData.furnitureDefId,
        pelicanCode: typeof node.userData.pelicanCode === "string" ? node.userData.pelicanCode : null,
        fixtureKind: typeof node.userData.fixtureKind === "string" ? node.userData.fixtureKind : null,
      };
    }
    node = node.parent;
  }
  return null;
}

/** Select only a fixture that is actually visible before cabinet, opening, or room geometry. */
export function threeDFurnitureHitFromIntersections(
  intersections: Array<Pick<THREE.Intersection, "object">>,
): ThreeDFurnitureHit | null {
  for (const intersection of intersections) {
    if (threeDCabinetHitFromObject(intersection.object)?.uid || threeDOpeningHitFromObject(intersection.object)) return null;
    const hit = threeDFurnitureHitFromObject(intersection.object);
    if (hit) return hit;
  }
  return null;
}

/**
 * A raycast can first hit a decorative child mesh. Continue to the placement
 * root so selected 3D cabinets always retain their saved plan identity rather
 * than losing the description and exact configuration record on a child face.
 */
export function threeDCabinetHitFromObject(object: THREE.Object3D): ThreeDCabinetHit | null {
  let node: THREE.Object3D | null = object;
  let masterCode: string | null = null;
  let uid: string | null = null;
  let description: string | null = null;
  let distributorSkuId: number | null = null;

  while (node) {
    if (!masterCode && node.userData.masterCode) masterCode = String(node.userData.masterCode);
    if (!uid && typeof node.userData.placedUid === "string") uid = node.userData.placedUid;
    if (!description && typeof node.userData.label === "string") description = node.userData.label;
    if (distributorSkuId == null && typeof node.userData.distributorSkuId === "number") {
      distributorSkuId = node.userData.distributorSkuId;
    }
    node = node.parent;
  }

  return masterCode ? { uid, masterCode, description, distributorSkuId } : null;
}

/**
 * A visible operating door is the clearest selection target. In particular, an
 * ERB/BER L-corner has two narrow room-facing door planes that can sit beside
 * full-depth cabinet skins and countertops in a perspective view. Favor that
 * actual face only when the ray reaches it; otherwise retain nearest-hit order.
 */
export function threeDCabinetSelectionPriority(object: THREE.Object3D): number {
  let node: THREE.Object3D | null = object;
  let priority = 0;
  while (node) {
    if (node.userData?.lCornerDoor) return 30;
    if (node.userData?.cabinetFront || node.userData?.cabinetDrawerFront) priority = Math.max(priority, 20);
    node = node.parent;
  }
  return priority;
}

/** Select the first actual placed-cabinet hit, skipping room/countertop decoration with no placement identity. */
export function threeDCabinetHitFromIntersections(
  intersections: Array<Pick<THREE.Intersection, "object">>,
): ThreeDCabinetHit | null {
  const candidates = intersections
    .map((intersection, index) => ({
      hit: threeDCabinetHitFromObject(intersection.object),
      priority: threeDCabinetSelectionPriority(intersection.object),
      index,
    }))
    .filter((candidate): candidate is { hit: ThreeDCabinetHit; priority: number; index: number } => Boolean(candidate.hit?.uid));
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.priority - left.priority || left.index - right.index);
  return candidates[0]!.hit;
}

export type ThreeDOpeningHit = {
  uid: string;
  kind: WallOpening["kind"];
  label: string | null;
};

/** Resolve any visible opening mesh back to its saved architectural opening. */
export function threeDOpeningHitFromObject(object: THREE.Object3D): ThreeDOpeningHit | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (typeof node.userData.openingUid === "string") {
      return {
        uid: node.userData.openingUid,
        kind: node.userData.kind as WallOpening["kind"],
        label: typeof node.userData.label === "string" ? node.userData.label : null,
      };
    }
    node = node.parent;
  }
  return null;
}

export function threeDOpeningHitFromIntersections(
  intersections: Array<Pick<THREE.Intersection, "object">>,
): ThreeDOpeningHit | null {
  for (const intersection of intersections) {
    const hit = threeDOpeningHitFromObject(intersection.object);
    if (hit) return hit;
    // Stop at the first tagged physical object. A visible cabinet must keep
    // its own context action rather than selecting a window behind it.
    if (threeDCabinetHitFromObject(intersection.object)?.uid) return null;
  }
  return null;
}

/** Stamp exact saved-placement identity onto every visible part of a generated cabinet assembly. */
export function applyThreeDPlacementIdentity(
  object: THREE.Object3D,
  identity: Pick<ThreeDCabinetHit, "uid" | "masterCode" | "description" | "distributorSkuId">,
): void {
  object.traverse((child) => {
    child.userData = {
      ...child.userData,
      placedUid: identity.uid,
      masterCode: identity.masterCode,
      label: identity.description,
      distributorSkuId: identity.distributorSkuId,
    };
  });
}

/** Projects explicit 3D catalog drops onto the active designer wall rather than the floor. */
export function threeDCatalogDropPlane(
  wall: WallSide | undefined,
  room: Pick<RoomData, "width" | "depth">,
): THREE.Plane {
  if (wall === "left") return new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  if (wall === "right") return new THREE.Plane(new THREE.Vector3(-1, 0, 0), room.width * INCH);
  if (wall === "top") return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  if (wall === "bottom") return new THREE.Plane(new THREE.Vector3(0, 0, -1), room.depth * INCH);
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
}

/**
 * Uses the first visible saved-placement hit for a catalog drop. Projecting the
 * same screen point all the way back to the physical wall can shift the run-axis
 * coordinate in an angled camera view because cabinets and countertops stand in
 * front of that wall. The tagged placement hit preserves the position the user
 * actually pointed at; the active-wall plane remains the deterministic fallback
 * when the ray crosses only open wall/floor geometry.
 */
export function threeDCatalogDropTargetFromIntersections(
  intersections: Array<Pick<THREE.Intersection<THREE.Object3D>, "object" | "point">>,
  wallPlaneHit: THREE.Vector3,
  room: Pick<RoomData, "width" | "depth">,
  fallbackWall?: WallSide,
): ThreeDCatalogDropTarget {
  const placedIntersection = intersections.find((intersection) => Boolean(threeDCabinetHitFromObject(intersection.object)));
  const placedHit = placedIntersection ? threeDCabinetHitFromObject(placedIntersection.object) : null;
  const wallIntersection = intersections.find((intersection) => threeDRoomWallSideFromObject(intersection.object) != null);
  const point = placedIntersection?.point ?? wallPlaneHit;
  return {
    x: Math.max(0, Math.min(room.width, point.x / INCH)),
    y: Math.max(0, Math.min(room.depth, point.z / INCH)),
    wall: wallIntersection ? threeDRoomWallSideFromObject(wallIntersection.object) ?? fallbackWall : fallbackWall,
    placementUid: placedHit?.uid ?? null,
  };
}

export function threeDRoomWallSideFromObject(object: THREE.Object3D | null | undefined): WallSide | null {
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    const side = current.userData?.physicalWallSide;
    if (current.userData?.roomWall === true && (side === "top" || side === "bottom" || side === "left" || side === "right")) return side;
    current = current.parent;
  }
  return null;
}
// Drawer reveals must sit behind the physical front. Keeping this near the
// carcass face avoids line geometry projecting through painted door panels.
export const THREE_D_DRAWER_REVEAL_DEPTH = 0.002;
export const THREE_D_WALL_OPACITY = 0.72;
export const THREE_D_CUTAWAY_WALL_OPACITY = 0.025;
// Regular Designer: retain visible walls, not opaque screens or invisible walls.
export const THREE_D_DESIGNER_WALL_OPACITY = 0.28;
export const THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY = 0.14;
export const THREE_D_WALL_DEPTH_WRITE = false;
// A kitchen is placed in a room, not on an empty stage. Show the drawn walls on
// first load so the customer can immediately see cabinet-to-wall relationships.
// The control still offers a deliberate clear-stage view for close inspection.
export const THREE_D_ROOM_CONTEXT_DEFAULT = true;

/** A wall only becomes a visual cutaway if the sightline to the orbit target crosses its finite span. */
export function threeDWallObscuresOrbitTarget(
  start: { x: number; y: number },
  end: { x: number; y: number },
  camera: { x: number; z: number },
  target: { x: number; z: number },
): boolean {
  const cameraX = camera.x, cameraY = -camera.z;
  const rayX = target.x - cameraX, rayY = -target.z - cameraY;
  const wallX = end.x - start.x, wallY = end.y - start.y;
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const denominator = cross(rayX, rayY, wallX, wallY);
  if (Math.abs(denominator) < 1e-9) return false;
  const alongSightline = cross(start.x - cameraX, start.y - cameraY, wallX, wallY) / denominator;
  const alongWall = cross(start.x - cameraX, start.y - cameraY, rayX, rayY) / denominator;
  return alongSightline > 0 && alongSightline < 1 && alongWall >= -0.03 && alongWall <= 1.03;
}

/** Keeps the orbit camera outside the furnished room envelope at every supported room size. */
export function threeDCameraDistanceLimits(maxSpan: number) {
  return {
    minDistance: Math.max(5.5, maxSpan * 0.55),
    maxDistance: Math.max(14, maxSpan * 3.4),
  };
}

/** One click makes a useful close-inspection change without skipping past the selected cabinet face. */
export const THREE_D_VIEWER_ZOOM_FACTOR = 0.76;

/** Directional pan remains proportional to the active camera distance, with a comfortable control range. */
export function threeDViewerPanStep(distance: number): number {
  return Math.max(0.35, Math.min(1.2, distance * 0.12));
}

/** Clamps button-driven zoom to the same safe OrbitControls range used for wheel and pinch input. */
export function threeDViewerZoomDistance(
  distance: number,
  limits: Pick<ReturnType<typeof threeDCameraDistanceLimits>, "minDistance" | "maxDistance">,
  direction: "in" | "out",
): number {
  const current = Math.min(limits.maxDistance, Math.max(limits.minDistance, distance));
  const requested = direction === "in" ? current * THREE_D_VIEWER_ZOOM_FACTOR : current / THREE_D_VIEWER_ZOOM_FACTOR;
  return Math.min(limits.maxDistance, Math.max(limits.minDistance, requested));
}

export type ThreeDCameraPreset = "presentation" | "front" | "wide" | "detail";

export type ThreeDCameraViewSnapshot = {
  preset: ThreeDCameraPreset;
  resetKey: number;
  /** The measured room outline used when this local orbit view was captured. */
  roomFrameKey?: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
};

export type ThreeDCameraShareView = Pick<ThreeDCameraViewSnapshot, "position" | "target" | "zoom">;
export const THREE_D_CAMERA_VIEW_QUERY_PARAM = "view";

/** Encodes only transient camera state. The saved 2D plan and secure-share token are never included or altered here. */
export function serializeThreeDCameraShareView(view: ThreeDCameraShareView): string {
  const values = [view.position.x, view.position.y, view.position.z, view.target.x, view.target.y, view.target.z, view.zoom];
  if (!values.every((value) => Number.isFinite(value))) return "";
  return `1,${values.map((value) => value.toFixed(3)).join(",")}`;
}

/** Rejects malformed or extreme URL input before it reaches the Three.js camera. */
export function parseThreeDCameraShareView(value: string | null | undefined): ThreeDCameraShareView | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 8 || parts[0] !== "1") return null;
  const values = parts.slice(1).map(Number);
  if (!values.every((entry) => Number.isFinite(entry) && Math.abs(entry) <= 1000)) return null;
  const [x, y, z, targetX, targetY, targetZ, zoom] = values;
  const position = new THREE.Vector3(x, y, z);
  const target = new THREE.Vector3(targetX, targetY, targetZ);
  if (position.distanceToSquared(target) < 0.0001 || zoom <= 0 || zoom > 4) return null;
  return { position, target, zoom };
}

/** Keeps a shared perspective within the same supported OrbitControls distance range as a local wheel or pinch gesture. */
export function constrainedThreeDCameraShareView(
  view: ThreeDCameraShareView,
  limits: Pick<ReturnType<typeof threeDCameraDistanceLimits>, "minDistance" | "maxDistance">,
): ThreeDCameraShareView {
  const offset = view.position.clone().sub(view.target);
  const distance = offset.length();
  const clampedDistance = Math.max(limits.minDistance, Math.min(limits.maxDistance, distance));
  return {
    position: view.target.clone().add(offset.normalize().multiplyScalar(clampedDistance)),
    target: view.target.clone(),
    zoom: Math.max(0.5, Math.min(2, view.zoom)),
  };
}

/**
 * A local orbit is useful while cabinet/material data refreshes, but it becomes
 * unsafe when a customer applies a different measured room outline. The camera
 * needs to reframe that new room rather than retaining a viewpoint sized for
 * the previous outline and leaving the kitchen tiny in a blank canvas.
 */
export function threeDCameraRoomFrameKey(room: Pick<RoomData, "width" | "depth" | "vertices" | "openWallPath">): string {
  const vertices = (room.vertices ?? []).map((vertex) => `${Number(vertex.x).toFixed(3)},${Number(vertex.y).toFixed(3)}`).join(";");
  return `${Number(room.width).toFixed(3)}x${Number(room.depth).toFixed(3)}|${room.openWallPath ? "open" : "closed"}|${vertices}`;
}

/** Scene rebuilds preserve the user's view; explicit camera resets and preset changes do not. */
export function threeDShouldRestoreCameraView(
  snapshot: Pick<ThreeDCameraViewSnapshot, "preset" | "resetKey" | "roomFrameKey"> | null | undefined,
  preset: ThreeDCameraPreset,
  resetKey: number,
  roomFrameKey?: string,
): boolean {
  return Boolean(
    snapshot
    && snapshot.preset === preset
    && snapshot.resetKey === resetKey
    && (roomFrameKey == null || snapshot.roomFrameKey === roomFrameKey),
  );
}

/** Stable framing presets keep 3D reviews clear without changing the active 2D design. */
export function threeDCameraPresetPosition(preset: ThreeDCameraPreset, maxSpan: number) {
  switch (preset) {
    case "front": return new THREE.Vector3(maxSpan * 0.5, maxSpan * 0.72, maxSpan * 1.8);
    case "wide": return new THREE.Vector3(maxSpan * 1.5, maxSpan * 1.22, maxSpan * 1.58);
    case "detail": return new THREE.Vector3(maxSpan * 0.98, maxSpan * 0.66, maxSpan * 0.96);
    default: return new THREE.Vector3(maxSpan * 1.15, maxSpan * 0.92, maxSpan * 1.25);
  }
}

export function threeDDoorMaterialFallback(color: string) {
  return { color, map: null as null };
}

/** A provided sample map carries the exact finish; tinting would darken or alter it. */
export function threeDFaceMaterialColor(color: string, hasProvidedDoorSample: boolean) {
  return hasProvidedDoorSample ? "#ffffff" : color;
}

/** Every structural cabinet surface follows the chosen finish; a supplied door sample supplies both its detail and hue. */
export function threeDStructuralFinish(color: string, hasProvidedDoorSample: boolean) {
  return {
    color: hasProvidedDoorSample ? "#ffffff" : color,
    usesDoorSample: hasProvidedDoorSample,
  };
}

/**
 * Cabinet boxes, finished ends, toe kicks, and crown need the selected wood or
 * painted finish without projecting the framed-door geometry onto those flat
 * structural surfaces. Crop the center of the verified door sample, where the
 * uninterrupted finish lives, and reuse that crop across structural meshes.
 */
export function threeDStructuralSampleTexture(texture: THREE.Texture) {
  const structural = texture.clone();
  const curatedCabinetGrain = texture.userData?.curatedCabinetFinish === true;
  structural.wrapS = curatedCabinetGrain ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  structural.wrapT = curatedCabinetGrain ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  structural.repeat.set(curatedCabinetGrain ? 1 : 0.42, curatedCabinetGrain ? 1 : 0.42);
  structural.offset.set(curatedCabinetGrain ? 0 : 0.29, curatedCabinetGrain ? 0 : 0.29);
  structural.needsUpdate = true;
  return structural;
}

export function applyThreeDStructuralFinishMaterials(
  materials: THREE.MeshStandardMaterial[],
  finishColor: string,
  sampleTexture: THREE.Texture | null = null,
) {
  const structuralTexture = sampleTexture ? threeDStructuralSampleTexture(sampleTexture) : null;
  for (const material of materials) {
    material.color.set(structuralTexture ? "#ffffff" : finishColor);
    material.map = structuralTexture;
    material.roughness = structuralTexture ? 0.48 : 0.5;
    material.needsUpdate = true;
    material.userData = {
      ...material.userData,
      selectedFinishStructuralSurface: true,
      usesDoorSample: Boolean(structuralTexture),
      usesDoorImage: Boolean(structuralTexture),
    };
  }
  return { color: structuralTexture ? "#ffffff" : finishColor, texture: structuralTexture };
}

/** Decorative end panels are opt-in; normal cabinet ends are plain finished skins. */
export function threeDDecorativeEndSides(treatment: SceneSku["decorativeEnd"] | undefined): Array<-1 | 1> {
  if (treatment === "left") return [-1];
  if (treatment === "right") return [1];
  return treatment === "both" ? [-1, 1] : [];
}

export function shouldRenderCountertopOverSceneItem(
	  placementOrItem: string | Pick<PlacedCabinet,
	    "placement" | "masterCode" | "description" | "subCategory" |
	    "category" | "height" | "mountBottom" | "applianceRole" |
	    "fillerPieceGroupId" | "fillerTotalWidth" | "fillerPlacementMode" | "islandFace"
	  >,
  masterCode = "",
  description: string | null = null,
) {
	  const item = typeof placementOrItem === "string"
	    ? { placement: placementOrItem as PlacedCabinet["placement"], masterCode, description, islandFace: null }
	    : placementOrItem;
	  if (item.islandFace) return false;
  // Keep 3D counter coverage identical to ElevationView: a counter sits over a
  // genuine counter-bearing base, plus a dishwasher or wine opening. Master
  // code is deliberately considered even on stale placements, so an appliance
  // accidentally persisted as "base" can never receive a false counter slab.
  if (isRangeOrOven(item.masterCode, item.description)) return false;
  if (isBaseHeightAppliance(item)) return true;
  return bearsCountertop(item);
}

/** A standard 24-inch base run receives the required 1½-inch front countertop overhang. */
export function threeDCountertopDepthIn(cabinetDepthIn: number) {
  return cabinetDepthIn + 1.5;
}

/** Installed base fillers continue the adjacent 24-inch base countertop and its 1½-inch front edge instead of using their shallow stock depth. */
export function threeDSceneCountertopDepthIn(
  item: Pick<SceneSku, "fillerPieceGroupId" | "fillerTotalWidth" | "fillerPlacementMode">,
  cabinetDepthIn: number,
) {
  const installedFiller = Boolean(
    item.fillerPieceGroupId &&
    item.fillerPlacementMode &&
    Number.isFinite(Number(item.fillerTotalWidth)) &&
    Number(item.fillerTotalWidth) > 0,
  );
  return threeDCountertopDepthIn(installedFiller ? BASE_DEPTH : cabinetDepthIn);
}

export function rangeOvenFrontLayout(bodyHeight: number) {
  const drawerHeight = Math.max(0.12, bodyHeight * 0.14);
  const openingHeight = Math.max(0.2, bodyHeight * 0.54);
  return {
    openingHeight,
    openingCenterY: drawerHeight * 0.42,
    drawerHeight,
    drawerCenterY: -bodyHeight / 2 + drawerHeight / 2 + 0.04,
  };
}

/** The upper bridge grows with the total 84/90/96-inch single-oven tower. */
export function singleOvenTowerAssembly(totalHeightIn: number) {
  const baseHeightIn = 34.5;
  const ovenHeightIn = 27;
  const fillerHeightIn = 3;
  return {
    baseHeightIn,
    ovenHeightIn,
    fillerHeightIn,
    bridgeHeightIn: Math.max(0, totalHeightIn - baseHeightIn - ovenHeightIn - fillerHeightIn),
  };
}

export function rangeCooktopLayout(bodyWidth: number, bodyDepth: number, bodyHeight: number, mountBottomIn = 0, controlPosition: "front" | "rear" = "rear") {
  // A front-control range has one continuous, full-depth cooking surface. Rear
  // control ranges reserve a slightly larger perimeter for their backguard.
  const perimeterInset = controlPosition === "front" ? 0.04 : 0.12;
  const cooktopWidth = Math.max(0.2, bodyWidth - perimeterInset);
  const cooktopDepth = Math.max(0.2, bodyDepth - perimeterInset);
  const cooktopThickness = 0.045;
  const burnerRadius = Math.max(0.06, Math.min(cooktopWidth, cooktopDepth) * 0.105);
  const xOffset = cooktopWidth * 0.24;
  const zOffset = cooktopDepth * 0.23;
  // A freestanding range's cooktop follows the 34½-inch base-cabinet line. The
  // countertop slab may sit above this line, but only the rear range controls
  // rise higher than the adjacent cabinet faces.
  const cookingSurfaceY = (STD.RANGE_COOKING_SURFACE_HEIGHT - mountBottomIn) * INCH - bodyHeight / 2;
  return {
    cooktopWidth,
    cooktopDepth,
    cooktopThickness,
    topY: cookingSurfaceY - cooktopThickness / 2,
    cookingSurfaceY,
    controlPosition,
    flatFrontControlTop: controlPosition === "front",
    burnerRadius,
    burnerCenters: [
      { x: -xOffset, z: -zOffset },
      { x: xOffset, z: -zOffset },
      { x: -xOffset, z: zOffset },
      { x: xOffset, z: zOffset },
    ],
  };
}

/** Shared freestanding-range vertical profile, measured from finished floor. */
export function freestandingRangeHeightProfile(mountBottomIn = 0, bodyHeight = 0) {
  const cookingSurfaceIn = STD.RANGE_COOKING_SURFACE_HEIGHT;
  const backguardTopIn = STD.RANGE_BACKGUARD_TOP;
  const backguardHeight = Math.max(0, (backguardTopIn - cookingSurfaceIn) * INCH);
  const cookingSurfaceY = (cookingSurfaceIn - mountBottomIn) * INCH - bodyHeight / 2;
  const backguardTopY = (backguardTopIn - mountBottomIn) * INCH - bodyHeight / 2;
  return { cookingSurfaceIn, backguardTopIn, backguardHeight, cookingSurfaceY, backguardTopY };
}

/** The 3D selling preview uses original product imagery only on catalog-backed appliance fronts. */
export function threeDApplianceFrontVisualUrl(sku: Pick<SceneSku, "masterCode" | "catalogImageUrl">): string | null {
  if (!/^(?:RANGE|HOOD|FRIDGE|DW|MW)[-_]?/i.test(sku.masterCode ?? "")) return null;
  return applianceAppearanceImage(sku.masterCode, sku.catalogImageUrl ?? null);
}

type EnclosedWallMicrowaveCandidate = Pick<SceneSku, "masterCode" | "placementType"> & Partial<Pick<SceneSku, "description" | "numberOfDoors" | "openingType">>;

/**
 * The MW3030/MW3036/MW3042 family is an enclosed wall cabinet with two upper
 * doors and a lower microwave bay. It is neither a standalone MW appliance nor
 * the separate open WMS wall-microwave kit, so it needs a constructed appliance
 * face only inside its existing Cabinet Config opening envelope.
 */
export function isEnclosedWallMicrowaveCabinet(sku: EnclosedWallMicrowaveCandidate): boolean {
  if ((sku.placementType ?? "").trim().toLowerCase() !== "wall") return false;
  if ((sku.openingType ?? "").trim().toLowerCase() !== "bottom") return false;
  if (Number(sku.numberOfDoors ?? 0) < 1) return false;

  const code = (sku.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const description = (sku.description ?? "").toLowerCase();
  const isEnclosedWallMicrowaveCode = /^MW\d{4}$/.test(code) && !code.startsWith("WMS");
  const isExplicitWallMicrowaveDescription = /(?:microwave\s+wall\s+cabinet|wall\s+microwave\s+cabinet)/.test(description);
  return isEnclosedWallMicrowaveCode || isExplicitWallMicrowaveDescription;
}

/** A supplied Cabinet Config product visual is authoritative for a cabinet front. */
export function threeDCabinetFrontVisualUrl(sku: EnclosedWallMicrowaveCandidate & Pick<SceneSku, "catalogImageUrl">): string | null {
  if ((sku.placementType ?? "").toLowerCase() === "appliance") return null;
  // The existing BEC24 source image is a quarter-octagon front. It must not
  // cover the two physical, coplanar doors of the owner-approved square end.
  if (isSquareDoubleDoorBaseEnd(sku)) return null;
  // The actual enclosed wall-microwave family receives a modeled stainless
  // appliance face inside its configured bay. Its cabinet-card diagram is not
  // an appliance finish and must never cover the upper doors or microwave face.
  if (isEnclosedWallMicrowaveCabinet(sku)) return null;
  return sku.catalogImageUrl?.trim() || null;
}

/**
 * A Door Style sample supplies finish/color—not a cabinet's complete physical
 * construction. Shaker selections therefore always receive real raised rails
 * and stiles around a recessed center panel. This keeps a cropped sample from
 * flattening every door and drawer in the 3D Designer.
 */
export function threeDUsesPhysicalShakerRails(profileKind: string, hasSuppliedDoorSample: boolean): boolean {
  // A supplied sample changes only the material map, never the Shaker geometry.
  void hasSuppliedDoorSample;
  return profileKind === "shaker";
}

export function threeDVisibleMaterialMode(doorSampleUrl: string | null | undefined, textureState: "not-requested" | "loading" | "loaded" | "failed") {
  if (doorSampleUrl && textureState === "loaded") return "selected-texture" as const;
  if (doorSampleUrl && textureState === "loading") return "selected-texture-loading" as const;
  return "calibrated-fallback" as const;
}

/**
 * A selected door sample is authoritative Cabinet Config information when the
 * style does not supply an explicit finish color. Apply that supplied material
 * to the actual door and drawer panels only; never substitute a generic color.
 */
export function threeDUsesDoorSampleTexture(doorSampleUrl?: string | null) {
  return Boolean(doorSampleUrl);
}

/** Exact supplied samples must not be altered by scene lighting or generic tinting. */
export function threeDUsesExactDoorSampleMaterial(hasProvidedDoorSample: boolean) {
  return hasProvidedDoorSample;
}

export function threeDMaterialStatusText(mode: ReturnType<typeof threeDVisibleMaterialMode>, textureState: "not-requested" | "loading" | "loaded" | "failed") {
  const textureLabel = textureState === "not-requested" ? "not selected" : textureState;
  return `Cabinet material: ${mode.replaceAll("-", " ")} · Door sample texture: ${textureLabel}`;
}

/** A locked final capture must never race ahead of the selected cabinet sample. */
export function threeDPhotoRenderDoorReferenceStatus(
  doorSampleUrl: string | null | undefined,
  textureState: "not-requested" | "loading" | "loaded" | "failed",
) {
  if (!doorSampleUrl) return { ready: true, message: "No selected door sample is available; calibrated cabinet finish remains in use." };
  if (textureState === "loading") return { ready: false, message: "The selected cabinet door sample is still loading. Wait until it is visible in the 3D kitchen before creating the exact render." };
  if (textureState === "failed") return { ready: false, message: "The selected cabinet door sample could not be loaded. Reopen the 3D view after the sample is available; the exact render will not substitute a generic door finish." };
  if (textureState === "loaded") return { ready: true, message: "The selected cabinet door sample is loaded on the 3D cabinet faces." };
  return { ready: false, message: "The selected cabinet door sample has not started loading. Reopen the 3D view before creating the exact render." };
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isEqualHeightTwoDrawerBase(
  sku: Pick<SceneSku, "drawerLayout"> & Partial<Pick<SceneSku, "masterCode" | "numberOfDoors" | "numberOfDrawers">>,
  fallbackCount: number,
) {
  return isEqualHeightTwoDrawerBaseFamily(sku, fallbackCount);
}

export function resolvedThreeDDrawerRows(
  sku: Pick<SceneSku, "drawerLayout"> & Partial<Pick<SceneSku, "masterCode" | "numberOfDoors" | "numberOfDrawers">>,
  availableHeight: number,
  fallbackCount: number,
  useShallowTopDrawer = false,
) {
  const count = Math.max(0, fallbackCount);
  if (isEqualHeightTwoDrawerBase(sku, fallbackCount)) {
    return Array.from({ length: 2 }, () => ({ count: 1, height: availableHeight / 2 }));
  }
  try {
    const parsed = JSON.parse(sku.drawerLayout ?? "null");
    if (Array.isArray(parsed) && parsed.length) {
      const rows = parsed
        .map((row) => ({
          count: Math.max(1, Number((row as Record<string, unknown>).count) || 1),
          height: Math.max(0.12, Number((row as Record<string, unknown>).height) * INCH || availableHeight / parsed.length),
        }))
        .filter((row) => Number.isFinite(row.count) && Number.isFinite(row.height));
      if (rows.length) return rows;
    }
  } catch {
    // Older placements may not have a valid JSON drawer layout. Use counts.
  }
  const verifiedThreeDrawerRows = useShallowTopDrawer
    ? threeDrawerBaseRowHeights(sku, availableHeight / INCH, count)
    : null;
  if (verifiedThreeDrawerRows) {
    return verifiedThreeDrawerRows.map((heightIn) => ({ count: 1, height: heightIn * INCH }));
  }
  if (useShallowTopDrawer && count > 1 && availableHeight > 6 * INCH) {
    const topHeight = 6 * INCH;
    const remainingHeight = (availableHeight - topHeight) / (count - 1);
    return [{ count: 1, height: topHeight }, ...Array.from({ length: count - 1 }, () => ({ count: 1, height: remainingHeight }))];
  }
  return count ? Array.from({ length: count }, () => ({ count: 1, height: availableHeight / count })) : [];
}

export function threeDDrawerZoneHeight(input: {
  availableHeight: number;
  drawerCount: number;
  doorCount: number;
  configuredDrawerHeight?: number | null;
  hasConfiguredOpening: boolean;
  placement: string;
  masterCode?: string | null;
}) {
  if (!input.drawerCount) return 0;
  if (isEqualHeightTwoDrawerBase({ masterCode: input.masterCode ?? undefined, numberOfDrawers: input.drawerCount }, input.drawerCount)) {
    return input.configuredDrawerHeight && input.configuredDrawerHeight > 0
      ? Math.min(input.availableHeight, input.configuredDrawerHeight * input.drawerCount)
      : input.availableHeight;
  }
  if (input.configuredDrawerHeight && input.configuredDrawerHeight > 0) {
    return Math.min(input.availableHeight, input.configuredDrawerHeight);
  }
  // Standard base cabinets with both drawers and doors use a shallow, six-inch
  // utility drawer by default. This matches the supplied Honey Shaker reference
  // and leaves the larger lower opening for the doors.
  if (input.placement === "base" && input.doorCount > 0) {
    return Math.min(input.availableHeight, 6 * INCH);
  }
  return input.doorCount === 0 && !input.hasConfiguredOpening
    ? input.availableHeight
    : input.availableHeight * 0.35;
}

export function threeDTallPantryDoorsPerRow(input: Pick<SceneSku, "numberOfDoors" | "width" | "doorOrientation">) {
  const configuredDoorCount = Math.max(0, Math.round(Number(input.numberOfDoors) || 0));
  if (configuredDoorCount === 2 && input.doorOrientation === "stacked") return 1;
  if (configuredDoorCount === 2) return 1;
  if (configuredDoorCount >= 4) return 2;
  // Older placements without door metadata follow the standard narrow pantry
  // convention: an 18-inch pantry has one upper and one lower door.
  return numberValue(input.width, 18) <= 18.5 ? 1 : 2;
}

export function threeDHasVerifiedDoorLayout(input: Pick<SceneSku, "numberOfDoors" | "numberOfDrawers" | "doorOrientation" | "drawerLayout" | "layoutSpec" | "openingType">) {
  return (Number(input.numberOfDoors) || 0) > 0
    || (Number(input.numberOfDrawers) || 0) > 0
    || Boolean(input.doorOrientation)
    || Boolean(input.drawerLayout)
    || Boolean(input.layoutSpec)
    // An authored appliance opening is itself a verified cabinet-front layout.
    // Never replace MW3042/BMC-style constructed geometry with a catalog/spec
    // diagram image merely because the legacy row has zero door/drawer counts.
    || Boolean(input.openingType);
}

export function threeDUsesCatalogFrontVisual(input: {
  hasCatalogFrontVisual: boolean;
  hasDoorSample: boolean;
  hasDoorTexture: boolean;
  specialtyKind: string;
  isRefrigeratorEndPanel: boolean;
  hasVerifiedDoorLayout: boolean;
}) {
  return input.hasCatalogFrontVisual
    && !input.hasDoorSample
    && !input.hasDoorTexture
    && input.specialtyKind === "standard"
    && !input.isRefrigeratorEndPanel
    && !input.hasVerifiedDoorLayout;
}

export function describedOvenSpecification(description: string | null | undefined) {
  const source = description ?? "";
  const opening = source.match(/(\d+(?:\.\d+)?)\s*(?:["″]|in)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:["″]|in)?\s*oven\s+opening/i);
  const doors = source.match(/(\d+)\s*doors?/i);
  const drawers = source.match(/(\d+)\s*drawers?/i);
  return {
    openingWidth: opening ? Number(opening[1]) : null,
    openingHeight: opening ? Number(opening[2]) : null,
    doorCount: doors ? Number(doors[1]) : null,
    drawerCount: drawers ? Number(drawers[1]) : null,
  };
}

export function resolvedThreeDOvenLayout(input: {
  height: unknown;
  description?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
  drawerLayout?: string | null;
  openingType?: string | null;
  ovenType?: "single" | "double" | null;
  sourceOvenDrawerLayout?: boolean | null;
}) {
  const totalHeight = numberValue(input.height, 84) * INCH;
  const usableHeight = Math.max(0.2, totalHeight - 0.08);
  const described = describedOvenSpecification(input.description);
  const ovenCount = input.ovenType === "double" ? 2 : 1;
  // A single oven tower has a fixed two-door upper bridge. Older saved records
  // can carry `numberOfDoors: 0` even though the visible 2D assembly includes
  // the bridge, so normalize that stale metadata before building the 3D face.
  const enforcedDoorCount = input.ovenType === "single" ? 2 : null;
  const doorCount = enforcedDoorCount ?? (input.numberOfDoors != null && input.numberOfDoors > 0
    ? input.numberOfDoors
    : described.doorCount ?? (input.numberOfDoors === 0 ? 0 : 2));
  // Generic legacy oven towers retain their established one-/three-drawer
  // fallback. Only an explicit distributor source marker can authorize a
  // supplied row layout to replace it; a stale generic saved drawerLayout must
  // not silently change a non-AEF tower's established visible face.
  const hasSourceDrawerLayout = input.sourceOvenDrawerLayout === true && Boolean(input.drawerLayout?.trim());
  const enforcedDrawerCount = hasSourceDrawerLayout
    ? null
    : input.ovenType === "single" ? 3 : input.ovenType === "double" ? 1 : null;
  const drawerCount = enforcedDrawerCount ?? (
    input.numberOfDrawers != null && input.numberOfDrawers > 0
      ? input.numberOfDrawers
      : described.drawerCount ?? (input.numberOfDrawers === 0 ? 0 : ovenCount === 2 ? 1 : 3)
  );
  const requestedDrawerHeight = input.drawerHeight != null
    ? Math.max(0, Number(input.drawerHeight) * INCH)
    : enforcedDrawerCount != null ? drawerCount * 11 * INCH : drawerCount * 5 * INCH;
  const requestedRows = enforcedDrawerCount != null
    ? Array.from({ length: drawerCount }, () => ({ count: 1, height: 11 * INCH }))
    : resolvedThreeDDrawerRows({ drawerLayout: input.drawerLayout ?? null }, requestedDrawerHeight, drawerCount);
  const measuredOpeningHeight = described.openingHeight != null ? described.openingHeight * INCH : null;
  let doorZone = doorCount
    ? input.doorHeight != null
      ? Math.min(usableHeight * 0.7, Math.max(0, Number(input.doorHeight) * INCH))
      : measuredOpeningHeight != null
        ? Math.max(0, usableHeight - measuredOpeningHeight - requestedRows.reduce((sum, row) => sum + row.height, 0))
        : usableHeight * 0.2
    : 0;
  const fixedSingleOvenOpening = input.ovenType === "single" ? 27 * INCH : null;
  if (input.ovenType === "single" && doorCount) {
    doorZone = singleOvenTowerAssembly(numberValue(input.height, 84)).bridgeHeightIn * INCH;
  }
  const requestedDrawerZone = requestedRows.reduce((sum, row) => sum + row.height, 0);
  const availableDrawerZone = Math.max(0, usableHeight - doorZone - (fixedSingleOvenOpening ?? measuredOpeningHeight ?? usableHeight * 0.15));
  const drawerScale = requestedDrawerZone > availableDrawerZone && requestedDrawerZone > 0 ? availableDrawerZone / requestedDrawerZone : 1;
  const drawerRows = requestedRows.map((row) => ({ ...row, height: row.height * drawerScale }));
  const drawerZone = drawerRows.reduce((sum, row) => sum + row.height, 0);
  return {
    usableHeight,
    doorCount,
    doorZone,
    drawerRows,
    drawerZone,
    openingHeight: fixedSingleOvenOpening ?? Math.max(0.12, usableHeight - doorZone - drawerZone),
    openingPosition: input.openingType === "top" || input.openingType === "bottom" ? input.openingType : "middle" as const,
    ovenCount,
  };
}

export function rangeHoodGeometry(widthIn: number, heightIn: number, depthIn: number) {
  const width = widthIn * INCH;
  const height = heightIn * INCH;
  const depth = depthIn * INCH;
  const canopyHeight = Math.max(0.14, Math.min(height * 0.34, 0.46));
  const chimneyWidth = Math.max(0.18, width * 0.42);
  const chimneyDepth = Math.max(0.12, depth * 0.46);
  return {
    width,
    depth,
    height,
    canopyHeight,
    canopyLowerWidth: width * 0.96,
    canopyLowerDepth: depth * 0.92,
    canopyUpperWidth: Math.max(chimneyWidth * 1.08, width * 0.34),
    canopyUpperDepth: Math.max(chimneyDepth * 1.08, depth * 0.34),
    chimneyWidth,
    chimneyDepth,
    chimneyHeight: Math.max(0.1, height - canopyHeight),
    controlRailWidth: width * 0.38,
    filterWidth: width * 0.31,
    filterDepth: depth * 0.46,
  };
}

/**
 * RHF30/RHF36 are wood cabinet hood fronts, as shown in the source catalog—not
 * appliance hoods. Their shallow cabinet box ends in a lower fascia; the two
 * decorative doors rake backward from that front rail toward the wall.
 */
export function rangeHoodFrontGeometry(widthIn: number, heightIn: number, depthIn: number) {
  const width = widthIn * INCH;
  const height = heightIn * INCH;
  const depth = depthIn * INCH;
  const fasciaHeight = Math.max(0.16, Math.min(height * 0.28, 0.32));
  const doorHeight = Math.max(0.12, height - fasciaHeight - 0.08);
  // Keep the top door rail visibly inside the shallow 9- or 12-inch cabinet
  // depth while leaving the lower rail flush at the physical cabinet face.
  const rakeDepth = Math.min(Math.max(0.13, depth * 0.42), Math.max(0.13, depth - 0.11));
  return {
    width,
    height,
    depth,
    fasciaHeight,
    doorHeight,
    rakeDepth,
    doorTiltRadians: -Math.atan2(rakeDepth, doorHeight),
    doorWidth: Math.max(0.08, (width - 0.1) / 2),
  };
}

function taperedRangeHoodCanopyGeometry(
  lowerWidth: number,
  lowerDepth: number,
  upperWidth: number,
  upperDepth: number,
  height: number,
) {
  const lx = lowerWidth / 2;
  const lz = lowerDepth / 2;
  const ux = upperWidth / 2;
  const uz = upperDepth / 2;
  const y0 = -height / 2;
  const y1 = height / 2;
  const vertices = new Float32Array([
    -lx, y0, -lz,  lx, y0, -lz,  lx, y0, lz, -lx, y0, lz,
    -ux, y1, -uz,  ux, y1, -uz,  ux, y1, uz, -ux, y1, uz,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Matches the 2D Corner Drawer Base face: an 8% corner marker plus a 92% full-height drawer stack. */
export function cornerDrawerFrontLayout(bodyWidth: number) {
  const cornerMarkerWidth = Math.max(0.04, bodyWidth * 0.08);
  return {
    cornerMarkerWidth,
    drawerStackWidth: Math.max(0.08, bodyWidth - cornerMarkerWidth),
  };
}

/**
 * The physical L-corner footprint shared by the 2D plan and 3D CDB36 carcass.
 * With a 36-inch bounding square, the 24-inch legs leave a 12-inch interior notch.
 */
export function lCornerCarcassParts(bodyWidth: number, bodyDepth: number, legRatio = 2 / 3) {
  const boundedLegRatio = Math.max(0.3, Math.min(0.95, legRatio));
  const legWidth = bodyWidth * boundedLegRatio;
  const legDepth = bodyDepth * boundedLegRatio;
  return {
    legWidth,
    legDepth,
    backLeg: { width: bodyWidth, depth: legDepth, x: 0, z: -(bodyDepth - legDepth) / 2 },
    sideLeg: { width: legWidth, depth: bodyDepth - legDepth, x: -(bodyWidth - legWidth) / 2, z: (legDepth) / 2 },
  };
}

type ThreeDPlanRect = { x: number; y: number; width: number; depth: number };

function threeDPlanRect(cabinet: Pick<PlacedCabinet, "x" | "y" | "width" | "depth" | "rotation">): ThreeDPlanRect {
  const quarterTurn = Math.abs(Math.round((cabinet.rotation ?? 0) / 90)) % 2 === 1;
  return {
    x: cabinet.x,
    y: cabinet.y,
    width: Math.max(0, quarterTurn ? cabinet.depth : cabinet.width),
    depth: Math.max(0, quarterTurn ? cabinet.width : cabinet.depth),
  };
}

function threeDPlanRectsShareEdge(first: ThreeDPlanRect, second: ThreeDPlanRect, toleranceIn = 0.08): boolean {
  const xOverlap = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const yOverlap = Math.min(first.y + first.depth, second.y + second.depth) - Math.max(first.y, second.y);
  const touchesVertically = Math.abs(first.x + first.width - second.x) <= toleranceIn || Math.abs(second.x + second.width - first.x) <= toleranceIn;
  const touchesHorizontally = Math.abs(first.y + first.depth - second.y) <= toleranceIn || Math.abs(second.y + second.depth - first.y) <= toleranceIn;
  return (touchesVertically && yOverlap > toleranceIn) || (touchesHorizontally && xOverlap > toleranceIn);
}

/** A base filler cannot add a cabinet toe kick into a dishwasher opening. */
export function threeDFittedFillerToeKickSuppressionUids(placed: PlacedCabinet[]): Set<string> {
  const dishwashers = placed.filter((cabinet) => (
    cabinet.placement === "appliance"
    && /(?:^|[-_])DW(?:[-_]|\d|$)|dishwasher/i.test(`${cabinet.masterCode ?? ""} ${cabinet.description ?? ""}`)
  ));
  const suppressed = new Set<string>();
  for (const filler of placed) {
    const isBaseFiller = filler.placement === "base" && (
      Boolean(filler.fillerPieceGroupId && filler.fillerPlacementMode && Number(filler.fillerTotalWidth) > 0)
      || /^(?:FILL|F\d{1,4})(?:[-_]|$)|\bfiller\b/i.test(`${filler.masterCode ?? ""} ${filler.description ?? ""}`)
    );
    if (!isBaseFiller) continue;
    if (dishwashers.some((dishwasher) => threeDPlanRectsShareEdge(threeDPlanRect(filler), threeDPlanRect(dishwasher)))) {
      suppressed.add(filler.uid);
    }
  }
  return suppressed;
}

/**
 * Plan-space vertices for a true diagonal-corner cabinet. The saved 2D plan
 * stores the enclosing square, but the cabinet occupies the wall-side triangle
 * behind its 45-degree face rather than a full rectangular box.
 */
export function diagonalCornerFootprintVertices(bodyWidth: number, bodyDepth: number, legRatio = 0.5) {
  const cutX = -bodyWidth / 2 + bodyWidth * legRatio;
  const cutZ = -bodyDepth / 2 + bodyDepth * legRatio;
  return [
    { x: -bodyWidth / 2, z: -bodyDepth / 2 },
    { x: bodyWidth / 2, z: -bodyDepth / 2 },
    { x: bodyWidth / 2, z: cutZ },
    { x: cutX, z: bodyDepth / 2 },
    { x: -bodyWidth / 2, z: bodyDepth / 2 },
  ];
}

/**
 * The diagonal-corner countertop is the cabinet's exact pentagon, with its
 * wall-side returns held flush and its single 45-degree door edge carried out
 * by the finished front overhang. Expanding the whole square would push stone
 * through the two walls; expanding only the diagonal face keeps the top seated
 * on the same corner cabinet geometry used by the plan and 3D carcass.
 */
export function diagonalCornerCountertopFootprintVertices(
  bodyWidth: number,
  bodyDepth: number,
  frontOverhang = COUNTERTOP_FRONT_OVERHANG,
) {
  const vertices = diagonalCornerFootprintVertices(bodyWidth, bodyDepth);
  const frontStart = vertices[2]!;
  const frontEnd = vertices[3]!;
  const edgeX = frontEnd.x - frontStart.x;
  const edgeZ = frontEnd.z - frontStart.z;
  const length = Math.hypot(edgeX, edgeZ);
  if (!Number.isFinite(frontOverhang) || frontOverhang <= 0 || length <= 1e-8) return vertices;
  // The local pentagon is counter-clockwise; the right-hand normal of its
  // diagonal edge points into the room, away from the two wall-side returns.
  const outward = { x: edgeZ / length, z: -edgeX / length };
  return vertices.map((vertex, index) => (
    index === 2 || index === 3
      ? { x: vertex.x + outward.x * frontOverhang, z: vertex.z + outward.z * frontOverhang }
      : vertex
  ));
}

/**
 * A Lazy Susan / Easy Reach / corner-drawer base has two actual room-facing
 * cabinet fronts: the short front of its back leg and the long front of its
 * side leg. The countertop carries the same finished 1½-inch projection over
 * each of those faces. Moving the side-leg rectangle in only one direction
 * would put the projection along its end instead, leaving an uneven point and
 * making the top miss the adjacent base-run front line.
 */
export function lCornerCountertopFootprintVertices(
  bodyWidth: number,
  bodyDepth: number,
  legRatio = 2 / 3,
  frontOverhang = COUNTERTOP_FRONT_OVERHANG,
) {
  const lShape = lCornerCarcassParts(bodyWidth, bodyDepth, legRatio);
  const left = -bodyWidth / 2;
  const right = bodyWidth / 2;
  const back = -bodyDepth / 2;
  const front = bodyDepth / 2;
  const insideX = left + lShape.sideLeg.width;
  const insideZ = back + lShape.backLeg.depth;
  const projection = Math.max(0, Math.min(
    Number.isFinite(frontOverhang) ? frontOverhang : 0,
    Math.max(0, right - insideX),
    Math.max(0, front - insideZ),
  ));
  return [
    { x: left, z: back },
    { x: right, z: back },
    { x: right, z: insideZ + projection },
    { x: insideX + projection, z: insideZ + projection },
    { x: insideX + projection, z: front },
    { x: left, z: front },
  ];
}

/**
 * A WDC's diagonal is the hypotenuse of its two 12-inch returns within the
 * 24-by-24 footprint: √(12² + 12²) ≈ 17 inches. This is the total two-door
 * front, not the diagonal across the full enclosing square.
 */
export function diagonalCornerFrontWidth(bodyWidth: number, bodyDepth: number) {
  return Math.hypot(bodyWidth / 2, bodyDepth / 2);
}

/** The full diagonal of a right-triangle corner is its actual angled front. */
export function triangleCornerFrontWidth(bodyWidth: number, bodyDepth: number) {
  return Math.hypot(bodyWidth, bodyDepth);
}

/** The exposed hypotenuse plane of a triangular angled-wall cabinet. */
export function triangleCornerFrontPose(bodyWidth: number, bodyDepth: number, outwardOffset = 0.029) {
  const normalX = -Math.SQRT1_2;
  const normalZ = Math.SQRT1_2;
  void bodyWidth;
  void bodyDepth;
  return {
    x: normalX * outwardOffset,
    z: normalZ * outwardOffset,
    rotation: -Math.PI / 4,
    normalX,
    normalZ,
  };
}

/** The local triangle assumes the wall corner is back-left; shared rotation orients it elsewhere. */
export function triangleCornerFootprintVertices(bodyWidth: number, bodyDepth: number) {
  return [
    { x: -bodyWidth / 2, z: -bodyDepth / 2 },
    { x: bodyWidth / 2, z: -bodyDepth / 2 },
    { x: bodyWidth / 2, z: bodyDepth / 2 },
  ];
}

/** Builds the vertical pentagonal extrusion defined by the shared 2D diagonal footprint. */
function diagonalCornerWedgeGeometry(
  bodyWidth: number,
  bodyDepth: number,
  height: number,
  frontOverhang = 0,
) {
  const vertices = frontOverhang > 0
    ? diagonalCornerCountertopFootprintVertices(bodyWidth, bodyDepth, frontOverhang)
    : diagonalCornerFootprintVertices(bodyWidth, bodyDepth);
  const shape = new THREE.Shape();
  shape.moveTo(vertices[0]!.x, -vertices[0]!.z);
  for (const vertex of vertices.slice(1)) shape.lineTo(vertex.x, -vertex.z);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return geometry;
}

/** Builds the one non-self-intersecting L top from both finished front edges. */
function lCornerCountertopWedgeGeometry(
  bodyWidth: number,
  bodyDepth: number,
  height: number,
  legRatio: number,
) {
  const vertices = lCornerCountertopFootprintVertices(
    bodyWidth,
    bodyDepth,
    legRatio,
    COUNTERTOP_FRONT_OVERHANG,
  );
  const shape = new THREE.Shape();
  shape.moveTo(vertices[0]!.x, -vertices[0]!.z);
  for (const vertex of vertices.slice(1)) shape.lineTo(vertex.x, -vertex.z);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return geometry;
}

/**
 * BEC-24 follows its Cabinet Config diagram: two 24-inch cabinet sides run
 * from one rear apex to the two front ends, and its door faces meet at the
 * shared exterior apex. Its plan is therefore a diamond, not a 24×24 box.
 */
export function baseEndAttachedFrontLayout(bodyWidth: number, bodyDepth: number) {
  const sideLength = Math.min(bodyWidth, bodyDepth);
  // The diagram shows two short fronts at the exterior apex. The 24-inch
  // dimensions label the two rear construction sides, never the door spans.
  const doorWidth = Math.min(sideLength, 8.45 * INCH);
  const doorFaceOffset = 0.029;
  const halfDiagonal = sideLength / Math.SQRT2;
  const rearApex = { x: 0, z: -halfDiagonal };
  const apex = { x: 0, z: halfDiagonal };
  return {
    apex,
    rearApex,
    sideLength,
    doorWidth,
    footprint: [rearApex, { x: -halfDiagonal, z: 0 }, apex, { x: halfDiagonal, z: 0 }],
    faces: [
      { side: "left" as const, x: -doorWidth * Math.SQRT1_2 / 2 - doorFaceOffset * Math.SQRT1_2, z: halfDiagonal - doorWidth * Math.SQRT1_2 / 2 + doorFaceOffset * Math.SQRT1_2, rotation: -Math.PI / 4 },
      { side: "right" as const, x: doorWidth * Math.SQRT1_2 / 2 + doorFaceOffset * Math.SQRT1_2, z: halfDiagonal - doorWidth * Math.SQRT1_2 / 2 + doorFaceOffset * Math.SQRT1_2, rotation: Math.PI / 4 },
    ],
    supportFaces: [
      { side: "left" as const, x: -halfDiagonal / 2, z: halfDiagonal / 2, rotation: -Math.PI / 4 },
      { side: "right" as const, x: halfDiagonal / 2, z: halfDiagonal / 2, rotation: Math.PI / 4 },
    ],
  };
}

/** Extrudes BEC's diagram-defined diamond plan into a vertical cabinet body or top support. */
function baseEndDiagramGeometry(sideLength: number, height: number) {
  const layout = baseEndAttachedFrontLayout(sideLength, sideLength);
  const shape = new THREE.Shape();
  const [first, ...rest] = layout.footprint;
  shape.moveTo(first!.x, -first!.z);
  for (const point of rest) shape.lineTo(point.x, -point.z);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return geometry;
}

/** Builds the vertical triangular extrusion defined by the shared 2D triangle footprint. */
function triangleCornerWedgeGeometry(bodyWidth: number, bodyDepth: number, height: number) {
  const vertices = triangleCornerFootprintVertices(bodyWidth, bodyDepth);
  const shape = new THREE.Shape();
  shape.moveTo(vertices[0]!.x, -vertices[0]!.z);
  for (const vertex of vertices.slice(1)) shape.lineTo(vertex.x, -vertex.z);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return geometry;
}

export function dimensions(value: unknown) {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    width: numberValue(object.width, 144),
    depth: numberValue(object.depth, 120),
    ceilingHeight: numberValue(object.ceilingHeight, 96),
  };
}

/** Wall context can be hidden down to one inch or shown up to a ten-foot room. */
export function constrainedThreeDWallHeight(value: unknown, fallback = 96) {
  const parsed = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(120, Math.max(1, Math.round(safe)));
}

export function sceneCabinetColor(scene: InteractiveRoomScene) {
  const color = scene.materials?.cabinet.color?.trim() ?? "";
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const source = `${scene.materials?.cabinet.finish ?? ""} ${color}`.toLowerCase();
  // Calibrated from the verified Preston Aero Sage door, drawer, full-door,
  // and room-scene references supplied by the catalog owner. This specific
  // finish intentionally takes precedence over the broad generic sage fallback.
  if (/(aero sage|aston green)/.test(source)) return "#4f5549";
  if (/(black|charcoal|obsidian|graphite)/.test(source)) return "#34363a";
  if (/(navy|blue|ocean)/.test(source)) return "#435b77";
  if (/(green|sage|forest)/.test(source)) return "#78826b";
  if (/(walnut|espresso|brown|mocha)/.test(source)) return "#75523e";
  // Calibrated from the owner-supplied Designer Natural door, drawer, full-door,
  // and installed-room references: a light creamy maple/oak rather than the
  // former orange-brown generic wood fallback.
  if (/(oak|maple|honey|natural)/.test(source)) return "#d1ba8f";
  if (/(cream|beige|linen|almond)/.test(source)) return "#ded5c1";
  return "#f2f0ea";
}

export function resolvedCatalogFinish(scene: InteractiveRoomScene, catalogFinishOverride?: string | null) {
  const override = catalogFinishOverride?.trim() ?? "";
  return /^#[0-9a-f]{6}$/i.test(override) ? override : sceneCabinetColor(scene);
}

/** Resolves one 3D cabinet's exact saved 2D finish before using the design default. */
export function resolvedPlacedCabinetFinish(
  cabinet: Pick<PlacedCabinet, "uid">,
  cabinetFinishOverrides: Record<string, string> | undefined,
  designDefault: string,
) {
  return cabinetFinishOverrides?.[cabinet.uid] ?? designDefault;
}

/** Resolves a placed cabinet's own saved 2D feature style before the plan default. */
export function resolvedPlacedCabinetDoorProfile(
  cabinet: Pick<PlacedCabinet, "uid">,
  cabinetDoorProfiles: Record<string, ThreeDDoorProfile> | undefined,
  planDefault: ThreeDDoorProfile | null | undefined,
) {
  const placedProfile = cabinetDoorProfiles?.[cabinet.uid];
  const placedIdentity = `${placedProfile?.doorStyle ?? ""} ${placedProfile?.doorPanelType ?? ""}`.trim();
  return placedIdentity ? placedProfile : planDefault ?? null;
}

/** Resolves a live Cabinet Config product visual when older saved placements omitted it. */
export function resolvedPlacedCabinetFrontVisual(
  cabinet: Pick<PlacedCabinet, "uid">,
  cabinetFrontVisuals: Record<string, string> | undefined,
  fallback: string | null | undefined,
) {
  return cabinetFrontVisuals?.[cabinet.uid] ?? fallback ?? null;
}

/** Resolves a placed cabinet's saved admin door sample before the design default sample. */
export function resolvedPlacedCabinetDoorSampleUrl(
  cabinet: Pick<PlacedCabinet, "uid">,
  cabinetDoorSampleUrls: Record<string, string> | undefined,
  catalogDoorSampleUrl?: string | null,
  preferSelectedPlanSample = false,
) {
  return resolvedThreeDDoorSampleUrl(
    "catalog",
    cabinetDoorSampleUrls?.[cabinet.uid] ?? catalogDoorSampleUrl,
    preferSelectedPlanSample,
  );
}

export function resolvedThreeDDoorSampleUrl(cabinetFinish: string, catalogDoorSampleUrl?: string | null, preferSelectedPlanSample = false) {
  const sample = catalogDoorSampleUrl?.trim() ?? "";
  return (preferSelectedPlanSample || cabinetFinish === "catalog") && sample ? sample : null;
}

export function resolvedThreeDDoorProfile(
  scene: InteractiveRoomScene,
  catalogDoorProfile?: ThreeDDoorProfile | null,
) {
  const selectedProfile = `${catalogDoorProfile?.doorStyle ?? ""} ${catalogDoorProfile?.doorPanelType ?? ""}`.trim();
  return selectedProfile ? catalogDoorProfile : scene.materials?.cabinet ?? null;
}

export function shouldRenderPlacedDesign(placed: PlacedCabinet[]) {
  return placed.length > 0;
}

export function quoteMaterialDetails(input: {
  cabinetPreview: string;
  countertopPreview: string;
  catalogFinishName?: string | null;
  catalogCountertopName?: string | null;
}) {
  return {
    cabinet: input.cabinetPreview === "Catalog finish" ? input.catalogFinishName?.trim() || "Catalog finish" : input.cabinetPreview,
    countertop: input.countertopPreview === "Quartz" ? input.catalogCountertopName?.trim() || "Quartz" : input.countertopPreview,
  };
}

export function doorProfileKind(doorStyle: string | null | undefined, doorPanelType: string | null | undefined) {
  const profile = `${doorStyle ?? ""} ${doorPanelType ?? ""}`.toLowerCase();
  if (/raised|bevel|cathedral/.test(profile)) return "raised" as const;
  if (/shaker|recessed|frame/.test(profile)) return "shaker" as const;
  return "flat" as const;
}

/** Three-inch physical Shaker rail/stile, reduced only when a very narrow face cannot accommodate it. */
export function threeDShakerRailThickness(faceWidth: number, faceHeight: number, verifiedInches?: string | number | null) {
  const requested = Number(verifiedInches);
  const thickness = Number.isFinite(requested) && requested > 0 ? requested * INCH : 3 * INCH;
  return Math.max(0, Math.min(thickness, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));
}

/** The physical Shaker frame must share the exact pose of its door face. */
export function threeDShakerFramePose(x: number, y: number, z: number, rotationY = 0) {
  return { x, y, z, rotationY };
}

function roomPolygon(geometryTemplate: unknown, width: number, depth: number) {
  const geometry = geometryTemplate && typeof geometryTemplate === "object" && !Array.isArray(geometryTemplate)
    ? geometryTemplate as Record<string, unknown>
    : {};
  const raw = Array.isArray(geometry.vertices) ? geometry.vertices : [];
  const points = raw
    .map((vertex) => vertex && typeof vertex === "object" ? vertex as Record<string, unknown> : {})
    .map((vertex) => new THREE.Vector2(
      Math.max(0, Math.min(width, numberValue(vertex.x, 0) * width)) * INCH,
      -Math.max(0, Math.min(depth, numberValue(vertex.y, 0) * depth)) * INCH,
    ));
  return points.length >= 3
    ? points
    : [new THREE.Vector2(0, 0), new THREE.Vector2(width * INCH, 0), new THREE.Vector2(width * INCH, -depth * INCH), new THREE.Vector2(0, -depth * INCH)];
}

/**
 * Converts the saved measured-plan vertices directly into the Three.js X/Z
 * plane.  Saved RoomData vertices are already inches; unlike a starter-layout
 * geometry template they must never be multiplied by room width/depth again.
 */
export function threeDMeasuredRoomPolygon(room: RoomData | undefined, fallbackWidth: number, fallbackDepth: number) {
  const vertices = room?.vertices ?? [];
  if (vertices.length >= 3 && !room?.openWallPath) {
    return vertices.map((vertex) => new THREE.Vector2(vertex.x * INCH, -vertex.y * INCH));
  }
  return [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(fallbackWidth * INCH, 0),
    new THREE.Vector2(fallbackWidth * INCH, -fallbackDepth * INCH),
    new THREE.Vector2(0, -fallbackDepth * INCH),
  ];
}

export type ThreeDMeasuredWallSegment = {
  id: string;
  start: THREE.Vector2;
  end: THREE.Vector2;
  length: number;
  /** Local +X follows the saved plan tangent under the shared Three.js transform. */
  rotationY: number;
  heightIn?: number;
};

/**
 * One authoritative transform for user-measured walls.  Plan Y points down;
 * Three.js wall positions use the same saved plan coordinates as cabinet
 * positions. A local PlaneGeometry +X axis maps to world `(cos θ, -sin θ)`,
 * so its Y rotation must mirror the plan's clockwise angle. This avoids a
 * diagonal wall being placed correctly but rotated across its own endpoints.
 */
export function threeDMeasuredWallSegments(room: RoomData | undefined): ThreeDMeasuredWallSegment[] {
  if (!room?.vertices?.length || !room.customWalls?.length) return [];
  return room.customWalls.flatMap((customWall) => {
    const startVertex = room.vertices!.find((vertex) => vertex.id === customWall.startVertexId);
    const endVertex = room.vertices!.find((vertex) => vertex.id === customWall.endVertexId);
    if (!startVertex || !endVertex) return [];
    const planDx = endVertex.x - startVertex.x;
    const planDy = endVertex.y - startVertex.y;
    const lengthIn = Math.hypot(planDx, planDy);
    if (lengthIn <= 0.001) return [];
    return [{
      id: customWall.id,
      start: new THREE.Vector2(startVertex.x * INCH, -startVertex.y * INCH),
      end: new THREE.Vector2(endVertex.x * INCH, -endVertex.y * INCH),
      length: lengthIn * INCH,
      rotationY: threeDPlanRotation(Math.atan2(planDy, planDx)),
      // Wall plane never rises above the room ceiling; a shorter drawn wall
      // (half / pony wall) renders at its own height.
      heightIn: wallTopLimit(room, customWall.id as WallSide),
    }];
  });
}

/**
 * The plane, its baseboard, and its ceiling edge must use one transform. This
 * is intentionally exported so a regression can assert the actual renderer
 * placement rather than merely checking the source vertices.
 */
export function threeDMeasuredWallTransform(
  segment: Pick<ThreeDMeasuredWallSegment, "start" | "end" | "rotationY">,
  heightIn: number,
) {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: Math.max(0, heightIn) * INCH / 2,
    // Wall vertices are stored with negative Y so the floor polygon can be
    // drawn directly in X/Z. The live cabinet and opening scene convention is
    // positive-Z plan Y, so convert once here—exactly as openingTransform does.
    z: -(segment.start.y + segment.end.y) / 2,
    rotationY: segment.rotationY,
  };
}

/**
 * Converts authored room-facing wall surfaces—classic or Continuous Wall
 * Builder—into one finished-thickness mitered footprint. The saved-plan
 * Vector2 uses negative Y for Three.js Z, so convert it once before the shared
 * 2D outline routine. A cabinet back is seated on the authored face, and the
 * 4½-inch wall body extends outward from it; free ends remain square and every
 * connected joint is mitered on both faces.
 */
export function threeDMiteredRoomWallOutlines(
  segments: Array<Pick<ThreeDMeasuredWallSegment, "id" | "start" | "end"> & { interiorOnLeft?: boolean }>,
  closed: boolean,
) {
  return miteredWallOutlinesFromInteriorFaces(
    segments.map((segment) => ({
      id: segment.id,
      start: { x: segment.start.x, y: -segment.start.y },
      end: { x: segment.end.x, y: -segment.end.y },
      // Standard rooms and the normally clockwise measured path keep usable
      // room space left of each directed segment. Counter-clockwise/open paths
      // explicitly provide the mirrored side from customWallCabinetSide.
      interiorOnLeft: segment.interiorOnLeft ?? true,
    })),
    ROOM_WALL_THICKNESS_IN * INCH,
    closed,
  );
}

/** A full-height wall mesh with sharp mitered plan corners and no end caps. */
export function threeDMiteredRoomWallGeometry(
  corners: Array<{ x: number; y: number }>,
  height: number,
) {
  const [startLeft, endLeft, endRight, startRight] = corners;
  if (!startLeft || !endLeft || !endRight || !startRight) return new THREE.BufferGeometry();
  const positions = new Float32Array([
    startLeft.x, 0, startLeft.y,
    endLeft.x, 0, endLeft.y,
    endRight.x, 0, endRight.y,
    startRight.x, 0, startRight.y,
    startLeft.x, height, startLeft.y,
    endLeft.x, height, endLeft.y,
    endRight.x, height, endRight.y,
    startRight.x, height, startRight.y,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

export function normalizeThreeDPlanarUv<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  if (!bounds || !positions || !uvs) return geometry;
  const spanX = Math.max(bounds.max.x - bounds.min.x, 0.0001);
  const spanY = Math.max(bounds.max.y - bounds.min.y, 0.0001);
  for (let index = 0; index < positions.count; index++) {
    uvs.setXY(
      index,
      (positions.getX(index) - bounds.min.x) / spanX,
      (positions.getY(index) - bounds.min.y) / spanY,
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

/**
 * The currently edited 2D room is authoritative. A normal 2D room has no
 * polygon vertices and must stay rectangular rather than inheriting an older
 * L-shaped starter-layout template.
 */
export function activeThreeDRoomGeometry(
  roomOverride: RoomData | undefined,
  sceneRoomShape: InteractiveRoomScene["roomShape"] | undefined,
) {
  if (roomOverride) {
    if (roomOverride.openWallPath) return null;
    return roomOverride.vertices?.length ? { vertices: roomOverride.vertices } : null;
  }
  return sceneRoomShape?.geometryTemplate ?? null;
}

function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const disposeMaterial = (material: THREE.Material) => {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
    material.dispose();
  };
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
  textures.forEach((texture) => texture.dispose());
}

export function resolvedThreeDFaceLayout(input: {
  masterCode?: string | null;
  placementType?: string | null;
  width?: unknown;
  description?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  openingType?: string | null;
  graphicType?: string | null;
  customProfile?: string | null;
  cornerType?: string | null;
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  drawerLayout?: string | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
}) {
  const hasProvidedFaceDescription = /\b(?:door|drawer|opening)\b/i.test(input.description ?? "");
  const isExactStandardBase = /^B[-_]?\d{1,2}$/i.test(input.masterCode ?? "");
  const descriptionFaceCounts = resolveDoorDrawerCounts({
    masterCode: input.masterCode ?? undefined,
    description: input.description ?? null,
    placementType: input.placementType ?? null,
    width: typeof input.width === "number" || typeof input.width === "string" ? input.width : null,
    numberOfDoors: input.numberOfDoors ?? null,
    numberOfDrawers: input.numberOfDrawers ?? null,
    openingType: input.openingType ?? null,
    graphicType: input.graphicType ?? input.customProfile ?? null,
    cornerType: input.cornerType ?? null,
    facePattern: input.facePattern ?? null,
    drawerLayout: input.drawerLayout ?? null,
    doorHeight: input.doorHeight ?? null,
    drawerHeight: input.drawerHeight ?? null,
  });
  // A description that names doors, drawers, or openings is authoritative.
  // A generic label such as "Base Cabinet" has no face facts, so retain its
  // explicit Cabinet Config counts instead of discarding them. When neither
  // source specifies a count, use the shared 21-inch standard-face rule.
  const configuredFaceCounts = isExactStandardBase
    ? descriptionFaceCounts
    : hasProvidedFaceDescription
    ? descriptionFaceCounts
    : {
      doors: input.numberOfDoors == null
        ? standardDoorCountForFaceWidth(typeof input.width === "number" || typeof input.width === "string" ? input.width : null)
        : Math.max(0, input.numberOfDoors),
      drawers: Math.max(0, input.numberOfDrawers ?? 0),
    };
  if (isWd18CountertopDrawerCabinet({ masterCode: input.masterCode, placement: input.placementType })) {
    return { hasConfiguredOpening: false, doorCount: 1, drawerCount: 2 };
  }
  return {
    hasConfiguredOpening: Boolean(input.openingType && input.openingType !== "none"),
    doorCount: configuredFaceCounts.doors,
    drawerCount: configuredFaceCounts.drawers,
  };
}

export function resolvedThreeDSpecialtyProfile(sku: Pick<SceneSku, "graphicType" | "customProfile" | "facePattern" | "cornerType" | "cornerGeometryKind" | "masterCode" | "description">) {
  const graphic = `${sku.graphicType ?? ""} ${sku.customProfile ?? ""}`.toLowerCase();
  const normalizedCode = (sku.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  // BEC24's active master is a 24 × 34½ × 24 two-door base end cabinet.
  // The owner-approved visible body is a square end-of-run box with two doors
  // on one flat front. Do not borrow a diagonal or two-face corner mesh from
  // stale graphicType, customProfile, or legacy supplier descriptions.
  if (normalizedCode === "BEC24") return { kind: "standard" as const, pattern: null };
  if (cabinetDrawingType({
    masterCode: sku.masterCode,
    description: sku.description,
    graphicType: sku.graphicType ?? sku.customProfile ?? null,
  }) === "range-hood-front") return { kind: "range-hood-front" as const, pattern: null };
  if (/^(?:ada[-_])?fsb[-_]?\d/i.test(sku.masterCode) || /farm(?:house)?\s+sink|apron[-\s]?front/i.test(sku.description ?? "")) return { kind: "farmhouse-sink" as const, pattern: null };
  // AW1230, AW1236, and AW1242 are one angled wall-END family. They are not
  // room-corner cabinets, but all three use the same true triangular end mesh,
  // with cabinet height and shelf count supplied by the individual SKU.
  if (isAngledWallProfile(sku)) return { kind: "diagonal-corner" as const, pattern: null };
  if (/corner-drawer-base/.test(graphic) || /^cdb[-_]?\d/.test(sku.masterCode) || /corner drawer base/i.test(sku.description ?? "")) return { kind: "corner-drawer" as const, pattern: null };
  if (sku.cornerGeometryKind === "base-end" || /end-angle|base_end_angle|end-return|base_end_return/.test(graphic) || /^(?:bec|ba)[-_]?\d/i.test(sku.masterCode) || /base end (?:corner|cabinet|return)/i.test(sku.description ?? "")) return { kind: "end-return" as const, pattern: null };
  if (sku.cornerGeometryKind === "triangle" || sku.cornerType === "triangle" || /^(?:wtc|btc)[-_]?\d/i.test(sku.masterCode)) return { kind: "triangle-corner" as const, pattern: null };
  if (sku.cornerGeometryKind === "blind-corner" || sku.cornerType === "blind-corner" || /^(?:bbc|wbc|bbl|bbr|wbl|wbr)[-_]?\d/i.test(sku.masterCode)) return { kind: "blind-corner" as const, pattern: null };
  if (sku.cornerGeometryKind === "l-shape" || sku.cornerType === "l-shape" || /^(?:LSB?)[-_]?\d/i.test(sku.masterCode) || /lazy\s*susan/i.test(sku.description ?? "")) {
    return { kind: "l-corner" as const, pattern: null };
  }
  if (sku.cornerGeometryKind === "diagonal" || sku.cornerType === "diagonal" || /^wdc[-_]?\d/i.test(sku.masterCode) || /diagonal wall corner/i.test(sku.description ?? "")) {
    return { kind: "diagonal-corner" as const, pattern: null };
  }
  if (sku.facePattern) return { kind: "face-pattern" as const, pattern: sku.facePattern };
  if (/\b(?:wine|lattice|plate)\b/i.test(`${sku.masterCode} ${sku.description ?? ""}`)) return { kind: "face-pattern" as const, pattern: "lattice" as const };
  return { kind: "standard" as const, pattern: null };
}

function isAngledWallProfile(sku: Pick<SceneSku, "graphicType" | "customProfile" | "masterCode" | "description">) {
  const graphic = `${sku.graphicType ?? ""} ${sku.customProfile ?? ""}`.toLowerCase();
  return /(?:^|\s)wall_angle(?:\s|$)|angled-wall/.test(graphic)
    || /^aw[-_]?\d/i.test(sku.masterCode)
    || /\bangled wall\b/i.test(sku.description ?? "");
}

/**
 * A 45-degree mitered filler is not a rectangular filler merely rotated on the
 * plan. Its visible width terminates on a diagonal cut at the continuous-wall
 * vertex, while the rear remains full depth for a practical install piece.
 */
export function miteredFillerPrismGeometry(
  width: number,
  height: number,
  depth: number,
  miteredEnd: "start" | "end",
): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const cut = Math.min(width, depth);
  const startCut = miteredEnd === "start";
  const footprint: Array<[number, number]> = startCut
    ? [[-halfWidth + cut, halfDepth], [halfWidth, halfDepth], [halfWidth, -halfDepth], [-halfWidth, -halfDepth]]
    : [[-halfWidth, halfDepth], [halfWidth - cut, halfDepth], [halfWidth, -halfDepth], [-halfWidth, -halfDepth]];
  const vertices = [
    ...footprint.flatMap(([x, z]) => [x, -halfHeight, z]),
    ...footprint.flatMap(([x, z]) => [x, halfHeight, z]),
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Extrudes the exact convex Plan footprint of a measured angled transition vertically. */
export function angledTransitionFillerPrismGeometry(
  footprint: Array<{ x: number; y: number }>,
  height: number,
): THREE.BufferGeometry {
  const points = footprint.length >= 3 ? footprint : [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 0.1 }];
  const halfHeight = height / 2;
  const count = points.length;
  const vertices = [
    ...points.flatMap((point) => [point.x, -halfHeight, point.y]),
    ...points.flatMap((point) => [point.x, halfHeight, point.y]),
  ];
  const indices: number[] = [];
  for (let index = 1; index < count - 1; index += 1) {
    indices.push(0, index + 1, index);
    indices.push(count, count + index, count + index + 1);
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(index, next, count + next, index, count + next, count + index);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Converts world-plan inches into one cabinet group's local Three.js X/Z frame. */
export function angledTransitionLocalFootprint(
  footprint: Array<{ x: number; y: number }>,
  transform: { x: number; z: number; rotation: number },
): Array<{ x: number; y: number }> {
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return footprint.map((point) => {
    const dx = point.x - transform.x;
    const dz = point.y - transform.z;
    return {
      x: (cosine * dx - sine * dz) * INCH,
      y: (sine * dx + cosine * dz) * INCH,
    };
  });
}

/**
 * The source drawing for WEOS0930 shows a 9×30×12 wall-end shelf with a straight
 * rear, open front, and a rounded front edge on each fixed interior shelf. This
 * is a shelf board—not a photo texture or a generic box.
 */
export function wallEndOpenShelfBoardGeometry(
  width: number,
  depth: number,
  thickness: number,
  bowedFront = true,
) {
  if (!bowedFront) return new THREE.BoxGeometry(width, thickness, depth);
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  // The catalog drawing's bow is centered in the 9-inch face and stays inside
  // the 12-inch cabinet depth. Its side endpoints are 2 inches behind the
  // foremost center point, keeping the shelf usable and physically plausible.
  const bowDepth = Math.min(2 * INCH, Math.max(0.035, width * 0.22), depth * 0.28);
  const sideFrontZ = halfDepth - bowDepth;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfDepth);
  shape.lineTo(halfWidth, -halfDepth);
  shape.lineTo(halfWidth, sideFrontZ);
  shape.quadraticCurveTo(0, halfDepth + bowDepth, -halfWidth, sideFrontZ);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness / 2, 0);
  return geometry;
}

/** Manufacturer-photo-informed preview only. These shapes have NO published
 * box envelope, rail side clearance, fence section, or drilled-hole pitch.
 * Their 2022 SKU references and actual List prices live on the bay anchor;
 * this group's visual dimensions are deliberately never presented as specs. */
export function addMasterTracConceptStorage(root: THREE.Group, anchor: PlacedCabinet, room: RoomData, currentFixedTopIn?: number) {
  if (anchor.masterTracTowerRole === "fixed-bottom" && anchor.masterTracStorageItems) {
    for (const item of anchor.masterTracStorageItems) {
      if (item.kind === "shelf") continue; // Actual adjustable board rendered independently.
      if (item.kind === "rod") {
        const transform = existingCabinetTransform(anchor, room);
        const group = new THREE.Group();
        group.position.set(transform.x * INCH, 0, transform.z * INCH);
        group.rotation.y = transform.rotation;
        const material = new THREE.MeshStandardMaterial({ color: item.rodFinish === "Chrome" ? 0xa7a8aa : 0x747574, metalness: 0.7, roughness: 0.3 });
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * INCH, 0.42 * INCH, anchor.width * INCH, 12), material);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, item.elevationIn * INCH, 0);
        bar.userData = { masterTracRodIllustration: true, notInstallationGeometry: true };
        group.add(bar);
        for (const end of [-1, 1]) {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * INCH, 0.55 * INCH, 0.12 * INCH, 12), material);
          cup.rotation.z = Math.PI / 2;
          cup.position.set(end * anchor.width / 2 * INCH, item.elevationIn * INCH, 0);
          cup.userData = { masterTracCupIllustration: true, notInstallationGeometry: true };
          group.add(cup);
        }
        root.add(group);
      } else if (item.kind === "shoe") {
        const transform = existingCabinetTransform(anchor, room);
        const group = new THREE.Group();
        group.position.set(transform.x * INCH, 0, transform.z * INCH);
        group.rotation.y = transform.rotation;
        const board = new THREE.Mesh(new THREE.BoxGeometry((anchor.width - 0.4) * INCH, 0.75 * INCH, (anchor.depth - 0.6) * INCH),
          new THREE.MeshStandardMaterial({ color: masterTracFinishColor(masterTracProduct(anchor.masterCode)?.finish ?? "Glacier White") }));
        board.position.y = (item.elevationIn + 0.375) * INCH;
        board.userData = { masterTracConceptComponent: "shoe-board-illustration", notInstallationGeometry: true };
        group.add(board);
        const fence = new THREE.Mesh(new THREE.BoxGeometry((anchor.width - 0.5) * INCH, 0.15 * INCH, 0.15 * INCH),
          new THREE.MeshStandardMaterial({ color: item.fenceFinish === "Chrome" ? "#95938e" : "#74736f", metalness: 0.58 }));
        fence.position.set(0, item.elevationIn * INCH, anchor.depth * 0.45 * INCH);
        fence.userData = { masterTracConceptComponent: "shoe-fence-illustration", notInstallationGeometry: true };
        group.add(fence);
        root.add(group);
      } else {
        const storage = { kind: "drawers" as const, count: 1, drawerSize: item.drawerSize, frontStyle: item.frontStyle, skuReferences: [] };
        addMasterTracConceptStorage(root, { ...anchor, masterTracStorageItems: undefined, masterTracConceptStorage: storage,
          mountBottom: item.elevationIn - 1.25 }, room, currentFixedTopIn);
      }
    }
    return;
  }
  const storage = anchor.masterTracConceptStorage;
  if (!storage || anchor.masterTracTowerRole !== "fixed-bottom") return;
  const transform = existingCabinetTransform(anchor, room);
  const group = new THREE.Group();
  group.position.set(transform.x * INCH, 0, transform.z * INCH);
  group.rotation.y = transform.rotation;
  group.userData.masterTracIllustration = { kind: storage.kind, skuReferences: storage.skuReferences, notInstallationGeometry: true };
  const span = anchor.width * INCH;
  const depth = anchor.depth * INCH;
  const bottom = anchor.mountBottom ?? 6;
  const frontZ = depth / 2 + 0.045 * INCH;
  const boardFinish = masterTracProduct(anchor.masterCode)?.finish ?? "Glacier White";
  const colored = new THREE.MeshStandardMaterial({ color: masterTracFinishColor(boardFinish), roughness: 0.78 });
  const maple = new THREE.MeshStandardMaterial({ color: "#c9a77b", roughness: 0.79 });
  const metal = new THREE.MeshStandardMaterial({ color: storage.fenceFinish === "Matt Nickel" ? "#74736f" : "#95938e", metalness: 0.58, roughness: 0.37 });
  function part(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, component: string) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * INCH, y * INCH, z * INCH);
    mesh.userData.masterTracConceptComponent = component;
    mesh.castShadow = true;
    if (component === "drawer-front-illustration" || component === "shoe-board-illustration") {
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: "#68635d", transparent: true, opacity: 0.8 }));
      outline.userData.masterTracConceptOutline = true;
      mesh.add(outline);
    }
    group.add(mesh);
    return mesh;
  }
  if (storage.kind === "drawers") {
    const small = storage.drawerSize !== "large";
    const faceH = small ? 5 : 10; // Nominal catalog family; not an actual envelope.
    const gap = small ? 7 : 12; // Visual spacing only; rail hole pitch is unpublished.
    for (let i = 0; i < storage.count; i++) {
      const faceY = bottom + 1.25 + faceH / 2 + i * gap;
      part(new THREE.BoxGeometry(span - 0.5 * INCH, faceH * INCH, 0.45 * INCH), colored, 0, faceY, frontZ / INCH, "drawer-front-illustration");
      part(new THREE.BoxGeometry(span - 1.6 * INCH, 0.28 * INCH, depth * 0.72), maple, 0, faceY - faceH / 2 + 0.2, -0.35, "drawer-tray-bottom-illustration");
      for (const edge of [-1, 1]) part(new THREE.BoxGeometry(0.33 * INCH, (faceH - 0.9) * INCH, depth * 0.72), maple, edge * (anchor.width / 2 - 0.9), faceY - 0.3, -0.35, "drawer-tray-side-illustration");
      part(new THREE.BoxGeometry(Math.min(4.5, anchor.width / 4) * INCH, 0.16 * INCH, 0.2 * INCH), metal, 0, faceY, frontZ / INCH + 0.33, "drawer-pull-illustration");
    }
  } else if (storage.kind === "shoe") {
    const tilt = 11 * Math.PI / 180; // Preview inclination only, NOT a drilling instruction.
    // Manual p. 38 references hole 6/8 BELOW the fixed top shelf; absolute
    // pitch is unpublished. Use only a visually plausible, labeled offset.
    for (let i = 0; i < storage.count; i++) {
      const shelfY = (currentFixedTopIn ?? storage.fixedTopIn ?? 60) - 10 - i * 12;
      const shelf = part(new THREE.BoxGeometry(span, 0.75 * INCH, depth * 0.97), colored, 0, shelfY, 0, "shoe-board-illustration");
      shelf.rotation.x = tilt;
      const frontHeight = shelfY - Math.sin(tilt) * anchor.depth * 0.485;
      part(new THREE.BoxGeometry(span - 0.4 * INCH, 0.14 * INCH, 0.14 * INCH), metal, 0, frontHeight + 0.65, anchor.depth * 0.47, "shoe-fence-illustration");
    }
  }
  applyThreeDPlacementIdentity(group, { uid: anchor.uid, masterCode: anchor.masterCode, description: `${storage.kind === "shoe" ? "Shoe organizer" : "Drawers"} · illustrative 3D, confirm manufacturer fit`, distributorSkuId: null });
  root.add(group);
}

export function addCabinet(
  root: THREE.Group,
  sku: SceneSku,
  wallKey: string | null,
  cursor: Record<string, number>,
  roomWidth: number,
  roomDepth: number,
  color: string,
  counterColor: string,
  doorProfile?: ThreeDDoorProfile,
  transform?: { x: number; z: number; rotation: number; bottom?: number },
  doorSampleUrl?: string | null,
  onDoorTextureState?: (state: "loading" | "loaded" | "failed") => void,
  surfaceTextures?: { countertop?: THREE.Texture | null; suppressCountertop?: boolean; suppressFittedFillerToeKick?: boolean; suppressContinuousBaseToeKick?: boolean; suppressFarmhouseSinkPlaceholder?: boolean; selectedToeKick?: boolean; hardwareStyleId?: HardwareStyleId; hardwareAccent?: string },
) {
  const placement = (sku.placementType ?? "base").toLowerCase();
  const isWall = placement === "wall";
  const isTall = placement === "tall";
  const isBaseCabinet = placement === "base";
  const isPlacedAppliance = placement === "appliance";
  const isCountertopOpeningAppliance = isPlacedAppliance && sku.applianceRole === "countertop-opening";
  const isRefrigeratorAppliance = isPlacedAppliance && /FRIDGE/i.test(sku.masterCode);
  const isPanelReadyAppliance = /panel[-\s]?ready|integrated appliance/i.test(sku.description ?? "");
  const isFloorDishwasher = placement === "appliance" && /(?:^|[-_])DW(?:[-_]|\d|$)|dishwasher/i.test(`${sku.masterCode} ${sku.description ?? ""}`);
  const isPlacedHood = placement === "appliance" && /HOOD/i.test(sku.masterCode);
  const rangeOrStoveCode = /^(?:RANGE|RNG|STOVE|STV)[\s_-]*(?:\d+)?$/i.test(sku.masterCode);
  const nonRangeApplianceCode = /^(?:FRIDGE|HOOD|DW|DISHWASHER|WINE|MW|MICROWAVE|OVEN)[\s_-]*/i.test(sku.masterCode);
  const rangeOrStoveDescription = /\b(?:freestanding\s+)?(?:range|stove)\b/i.test(sku.description ?? "")
    && !nonRangeApplianceCode
    && !/\b(?:wall|built[-\s]?in|single|double)\s+oven\b/i.test(sku.description ?? "");
  const isFreestandingRange = placement === "appliance" && !isCountertopOpeningAppliance && !isPlacedHood && (rangeOrStoveCode || rangeOrStoveDescription);
  const rangeAppearance = isFreestandingRange ? rangeVisualAppearance(sku) : null;
  const isFarmhouseSinkBase = placement === "base" && (/^(?:ada[-_])?fsb[-_]?\d/i.test(sku.masterCode) || /farm(?:house)?\s+sink|apron[-\s]?front/i.test(sku.description ?? ""));
  const isRefrigeratorEndPanel = /refrigerator[-\s]?end[-\s]?panel|refrigerator-end-panel|\brepv\b/i.test(`${sku.description ?? ""} ${sku.masterCode ?? ""} ${sku.customProfile ?? ""}`);
  const openShelfCode = `${sku.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const kitchenCrestGenericShelfCount = kitchenCrestGenericOpenEndShelfCount(sku);
  const isWallOpenShelf = /^W(?:E)?OS\d{4}$/.test(openShelfCode)
    || kitchenCrestGenericShelfCount != null
    || /\bwall\s+(?:end\s+)?open\s+shelf\b|\bwall\s+end\s+shelf\b|\bopen\s+end\s+shelf\s+wall\b/i.test(`${sku.subCategory ?? ""} ${sku.description ?? ""}`);
  const isWallEndOpenShelf = /^WEOS\d{4}$/.test(openShelfCode)
    || /\bwall\s+end\s+(?:open\s+)?shelf\b/i.test(`${sku.subCategory ?? ""} ${sku.description ?? ""}`);
  // A WOS/WEOS is a full-height wall cabinet with an open, curved-shelf
  // carcass. Only explicit FS/floating-shelf items use the thin-shelf path.
  const isFloatingShelf = !isWallOpenShelf && (/^FS[-_ ]?\d+(?:\.\d+)?$/i.test(sku.masterCode ?? "") || /floating\s*shelf/i.test(`${sku.description ?? ""} ${sku.masterCode ?? ""}`));
  const floatingShelfWidth = Number(/^FS[-_ ]?(\d+(?:\.\d+)?)$/i.exec(sku.masterCode ?? "")?.[1]);
  const widthIn = isFloatingShelf && Number.isFinite(floatingShelfWidth) && floatingShelfWidth > 0
    ? floatingShelfWidth
    : numberValue(sku.width, 24);
  const depthIn = isFloatingShelf ? WALL_DEPTH : numberValue(sku.depth, isWall ? WALL_DEPTH : BASE_DEPTH);
  // Base L-corners keep their actual 24-inch legs inside their square plan
  // envelope. That produces 24/33 for ERB33 and retains the existing 24/36
  // result for every 36-inch corner. Wall L-corners intentionally keep their
  // present 12/24 fixed ratio until their source audit is separately approved.
  const lCornerLegRatio = isWall
    ? 0.5
    : cornerLegRatioForPlaced({ width: widthIn, placement: "base" });
  const configuredHeightIn = isFloatingShelf ? 2.06 : numberValue(sku.height, isWall ? 30 : isTall ? 84 : 34.5);
  const resolvedHeightIn = isFreestandingRange
    ? Math.max(STD.RANGE_COOKING_SURFACE_HEIGHT, configuredHeightIn)
    : configuredHeightIn;
  const catalogMountBottom = sku.mountBottom != null
    ? numberValue(sku.mountBottom, 0)
    : (isWd18CountertopDrawerCabinet({ masterCode: sku.masterCode, placement })
      ? STD.COUNTERTOP_HEIGHT
      : isWall ? WALL_BOTTOM : isBaseCabinet ? THREE_D_TOE_KICK : 0);
  const requestedMountBottom = transform?.bottom ?? catalogMountBottom;
  // A cabinet that physically stands on the floor always has a recessed 4½in
  // kick. This includes tall cabinets and a wall profile deliberately dropped
  // to floor level; wall cabinets mounted above the floor are excluded.
  const isCounterHeightIslandWallCabinet = isWall && Boolean(sku.islandFace) && sku.islandCounterHeightWallCabinet === true;
  const hasFurnitureBaseMolding = isCounterHeightIslandWallCabinet && sku.islandWallCabinetBaseTreatment === "base-molding";
  const hasSelectedToeKickFinish = Boolean(surfaceTextures?.selectedToeKick)
    || (isCounterHeightIslandWallCabinet && !hasFurnitureBaseMolding);
  const isInstalledFillerPiece = Boolean(
    sku.fillerPieceGroupId &&
    sku.fillerPlacementMode &&
    Number.isFinite(Number(sku.fillerTotalWidth)) &&
    Number(sku.fillerTotalWidth) > 0,
  );
  const isBaseFillerPiece = isBaseCabinet && (
    isInstalledFillerPiece
    || /^(?:FILL|F\d{1,4})(?:[-_]|$)|\bfiller\b/i.test(`${sku.masterCode ?? ""} ${sku.description ?? ""}`)
  );
  const isAngledTransitionFiller = (sku.fillerTransitionKind === "angled-wedge" || sku.fillerTransitionKind === "front-miter-pair")
    && Array.isArray(sku.fillerTransitionFootprint)
    && sku.fillerTransitionFootprint.length >= 3;
  const isFrontMiterPair = isAngledTransitionFiller && sku.fillerTransitionKind === "front-miter-pair";
  const isMiteredWallFiller = (isWall || isBaseCabinet)
    && !isAngledTransitionFiller
    && sku.fillerMiterAngle === 45
    && (sku.fillerMiteredEnd === "start" || sku.fillerMiteredEnd === "end");
  const isFrontFlushFillerBoard = isFrontMiterPair || (!isAngledTransitionFiller && (isBaseFillerPiece || isMiteredWallFiller));
  // A base filler is a cabinet-face board, not a cabinet support. Its stored
  // catalog height includes the 4½-inch base toe kick so its top agrees with
  // the adjoining cabinet, but its visible board starts above that kick. This
  // applies equally to straight, split, and 45-degree miter filler pieces.
  const usesBaseFillerFaceElevation = isBaseFillerPiece && sku.fillerMatchesFullOwnerEnvelope !== true;
  // Refrigerator-side fillers are full-height architectural strips. They
  // follow the refrigerator from the finished floor to its top—never the
  // neighboring base's face elevation or toe-kick construction.
  const isFullOwnerEnvelopeFiller = isBaseFillerPiece && sku.fillerMatchesFullOwnerEnvelope === true;
  const isFloorStandingCabinet = placement !== "appliance"
    && !isRefrigeratorEndPanel
    && !usesBaseFillerFaceElevation
    && !isFullOwnerEnvelopeFiller
    && (isBaseCabinet || isTall || isCounterHeightIslandWallCabinet
      || (isWall && requestedMountBottom <= 0.001));
  // The saved 2D base height is 34½ inches inclusive of the 4½-inch recessed
  // toe kick. Build only the upper carcass over that kick so every floor run
  // keeps its measured top while exposing the proper floor recess in 3D.
  const heightIn = usesBaseFillerFaceElevation
    ? Math.max(0.1, resolvedHeightIn - THREE_D_TOE_KICK)
    : isFloorStandingCabinet && !isCounterHeightIslandWallCabinet
    ? Math.max(0.1, resolvedHeightIn - THREE_D_TOE_KICK)
    : isFloorDishwasher
      ? 34.5
      : resolvedHeightIn;
  const key = wallKey === "left" ? "left" : wallKey === "right" ? "right" : wallKey === "front" ? "front" : "back";
  const along = cursor[key] ?? 3;
  // A 1½-inch countertop overhang belongs only at the exposed cabinet front.
  // It is not a gap in a cabinet run. In the suggestion/fallback scene this
  // cursor is the placement authority, so adding the historical 1½-inch step
  // here left every base appliance seam visibly open (for example DB18 beside
  // a 30-inch range) even though the Plan's snap rule correctly allows a flush
  // edge. Advance by the actual measured box width only.
  cursor[key] = along + widthIn;

  let x = along + widthIn / 2;
  let z = depthIn / 2;
  let rotation = 0;
  if (key === "front") { z = roomDepth - depthIn / 2; rotation = Math.PI; }
  if (key === "left") { x = depthIn / 2; z = along + widthIn / 2; rotation = Math.PI / 2; }
  if (key === "right") { x = roomWidth - depthIn / 2; z = along + widthIn / 2; rotation = -Math.PI / 2; }
  if (transform) ({ x, z, rotation } = transform);

	  // Cabinet dimensions always remain in the cabinet's own local frame:
	  // X is the face/run width and Z is the wall-to-front depth. The group rotation
	  // maps that frame onto left/right walls. Swapping width and depth here *and*
	  // then rotating the group double-swapped every non-square side-wall cabinet,
	  // so its 25½-inch countertop could appear beside the 24-inch-deep box instead
	  // of sitting on it.
	  const bodyWidth = widthIn * INCH;
	  const bodyDepth = depthIn * INCH;
  const bodyHeight = heightIn * INCH;
  // A base filler is a finished face above the shared run's toe-kick opening;
  // it must never manufacture a narrow toe-kick block of its own.
  const suppressInstalledFillerToeKick = usesBaseFillerFaceElevation
    || isFullOwnerEnvelopeFiller
    || Boolean(surfaceTextures?.suppressFittedFillerToeKick);
	  const installedFillerBoardDepth = Math.min(bodyDepth, 0.75 * INCH);
  const installedFillerFrontOffset = isFrontFlushFillerBoard ? bodyDepth / 2 - installedFillerBoardDepth / 2 : 0;
  const bottom = usesBaseFillerFaceElevation
    // Base cabinet catalog records can preserve either 0 or the historical
    // 4½-inch toe datum as mountBottom; in both cases their visible face begins
    // above the shared recessed kick. Match that physical face—not stock height.
    ? THREE_D_TOE_KICK
    : isFloorStandingCabinet && !isCounterHeightIslandWallCabinet
      ? THREE_D_TOE_KICK
      : requestedMountBottom;
  const countertopCenterY = (bottom + heightIn + 0.75) * INCH;
  const cabinet = new THREE.Group();
  cabinet.position.set(x * INCH, (bottom + heightIn / 2) * INCH, z * INCH);
  cabinet.rotation.y = rotation;
  cabinet.userData = {
    placedUid: sku.placementUid ?? null,
    distributorSkuId: sku.distributorSkuId,
    masterCode: sku.masterCode,
    label: sku.description ?? sku.masterCode,
    cornerGeometryKind: sku.cornerGeometryKind ?? "standard",
    ...(isFloorStandingCabinet ? { floorStandingCabinet: true, toeKickHeightIn: THREE_D_TOE_KICK, islandWallCabinetBaseTreatment: isCounterHeightIslandWallCabinet ? (hasFurnitureBaseMolding ? "base-molding" : "toe-kick") : null } : {}),
    ...(usesBaseFillerFaceElevation ? { baseFillerFace: true, fillerFaceBottomIn: bottom, fillerFaceHeightIn: heightIn } : {}),
    ...(isFullOwnerEnvelopeFiller ? { fullOwnerEnvelopeFiller: true, fillerFaceBottomIn: bottom, fillerFaceHeightIn: heightIn } : {}),
    ...(placement === "appliance" ? {
      catalogApplianceEnvelope: {
        widthIn,
        heightIn,
        depthIn,
        mountBottomIn: bottom,
        rotation,
      },
    } : {}),
    ...(isPlacedHood ? { wallMountedAppliance: true, noCabinetBacking: true } : {}),
  };
  // MasterTrac sells distinct ¾-inch board SKUs, not kitchen cabinet boxes.
  // The workbook supplies their physical dimensions; render only the verified
  // rectangular panel/shelf families and never invent a door, drawer, rod,
  // toe-kick, countertop, or attachment detail for an order-only SKU.
  const masterTrac = masterTracProduct(sku.masterCode);
  if (masterTrac?.placeable && masterTrac.shape) {
    const finish = new THREE.Color(masterTracFinishColor(masterTrac.finish));
    const boardMaterial = new THREE.MeshStandardMaterial({ color: finish, roughness: 0.77 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: finish.clone().offsetHSL(0, 0, 0.06), roughness: 0.73 });
    cabinet.position.y = (requestedMountBottom + resolvedHeightIn / 2) * INCH;
    cabinet.userData.masterTracBoard = { sku: sku.masterCode, shape: masterTrac.shape, finish: masterTrac.finish, thicknessIn: masterTrac.thicknessIn, bottomIn: requestedMountBottom, ...(sku.masterTracShelfCut ? { cut: sku.masterTracShelfCut } : {}) };
    const board = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, resolvedHeightIn * INCH, bodyDepth), boardMaterial);
    board.castShadow = true;
    board.receiveShadow = true;
    board.userData.masterTracBoardSurface = true;
    const boardOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(board.geometry),
      new THREE.LineBasicMaterial({ color: "#655e55", transparent: true, opacity: 0.5 }),
    );
    boardOutline.userData.masterTracBoardOutline = true;
    board.add(boardOutline);
    cabinet.add(board);
    const frontEdge = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, resolvedHeightIn * INCH, 0.04 * INCH), edgeMaterial);
    frontEdge.position.z = bodyDepth / 2 + 0.02 * INCH;
    frontEdge.userData.masterTracEdgeBand = true;
    cabinet.add(frontEdge);
    applyThreeDPlacementIdentity(cabinet, { uid: sku.placementUid ?? null, masterCode: sku.masterCode, description: sku.description ?? null, distributorSkuId: sku.distributorSkuId });
    root.add(cabinet);
    return;
  }
  // FSB catalog rows can carry generic base metadata, so recognize their
  // code/description at scene construction as well as in profile resolution.
  const specialty = isFarmhouseSinkBase
    ? { kind: "farmhouse-sink" as const, pattern: null }
    : resolvedThreeDSpecialtyProfile(sku);
  const angledWallProfile = isAngledWallProfile(sku);

	  const cabinetPbr = threeDPhysicalSurfaceProfile("cabinet", Boolean(doorSampleUrl));
	  const metalPbr = threeDPhysicalSurfaceProfile("metal");
	  const bodyMaterial = new THREE.MeshPhysicalMaterial(isRefrigeratorAppliance
	    ? { color: "#5f666d", roughness: 0.3, metalness: 0.58, clearcoat: 0.08, clearcoatRoughness: 0.28, envMapIntensity: 1.02 }
	    : { color: "#c6b9a7", ...cabinetPbr });
  const structuralFinishMaterials: THREE.MeshStandardMaterial[] = isRefrigeratorAppliance ? [] : [bodyMaterial];
  const flatExposedFinishMaterials: THREE.MeshStandardMaterial[] = [];
  let applyPlainStructuralFinish: ((finishColor: string, sampleTexture?: THREE.Texture | null) => void) | null = null;
  const bodyMeshes: THREE.Mesh[] = [];
  if (isFloorStandingCabinet) {
    const toeKickHeight = THREE_D_TOE_KICK * INCH;
    const toeKickMaterial = new THREE.MeshStandardMaterial({
      color: hasSelectedToeKickFinish ? color : "#211f1c",
      roughness: hasSelectedToeKickFinish ? 0.48 : 0.82,
      metalness: 0.01,
    });
    if (hasSelectedToeKickFinish) structuralFinishMaterials.push(toeKickMaterial);
    if (hasFurnitureBaseMolding) {
      const baseMolding = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth + 0.02, toeKickHeight, Math.max(0.12, bodyDepth - 0.04)),
        toeKickMaterial,
      );
      baseMolding.position.set(0, -bodyHeight / 2 - toeKickHeight / 2, 0);
      baseMolding.userData = {
        islandWallCabinetBaseMolding: true,
        furnitureBaseFinish: true,
        floorStandingBaseTreatment: true,
        baseMoldingHeightIn: THREE_D_TOE_KICK,
        baseMoldingDepthIn: bodyDepth / INCH,
      };
      cabinet.add(baseMolding);
      bodyMeshes.push(baseMolding);
    } else {
    const lCornerKind = specialty.kind === "corner-drawer" || specialty.kind === "l-corner";
    if (lCornerKind) {
      // ERB/BER/LSB and corner-drawer bases have two exposed room-facing legs.
      // Build only two thin strips immediately behind those faces, not deep
      // carcass-leg blocks that extend into the corner or dishwasher opening.
      const lShape = lCornerCarcassParts(bodyWidth, bodyDepth, lCornerLegRatio);
      const exposedBackWidth = Math.max(0.12, bodyWidth - lShape.sideLeg.width - 0.06);
      const exposedBackX = bodyWidth / 2 - exposedBackWidth / 2;
      const exposedBackZ = lShape.backLeg.z + lShape.backLeg.depth / 2 + 0.03;
      const exposedSideLength = Math.max(0.12, lShape.sideLeg.depth - 0.06);
      const exposedSideX = lShape.sideLeg.x + lShape.sideLeg.width / 2 + 0.03;
      const exposedSideZ = lShape.sideLeg.z;
      const toeKickRecess = 3 * INCH;
      const toeKickThickness = 0.08;
      const backKickZ = exposedBackZ - toeKickRecess - toeKickThickness / 2;
      const sideKickX = exposedSideX - toeKickRecess - toeKickThickness / 2;
      const backKickOuterX = exposedBackX + exposedBackWidth / 2;
      const sideKickOuterZ = exposedSideZ + exposedSideLength / 2;
      // Extend each thin recessed leg only to the other leg's centreline. Their
      // thicknesses overlap in one small right-angle joint, so the toe kick is
      // continuous without the old 4-inch square block protruding into the
      // visible inside corner.
      const joinedBackWidth = Math.max(0.12, backKickOuterX - sideKickX);
      const joinedSideLength = Math.max(0.12, sideKickOuterZ - backKickZ);
      const exposedKicks = [
        {
          side: "back-leg" as const,
          geometry: new THREE.BoxGeometry(joinedBackWidth, toeKickHeight, toeKickThickness),
          x: sideKickX + joinedBackWidth / 2,
          z: backKickZ,
        },
        {
          side: "side-leg" as const,
          geometry: new THREE.BoxGeometry(toeKickThickness, toeKickHeight, joinedSideLength),
          x: sideKickX,
          z: backKickZ + joinedSideLength / 2,
        },
      ];
      for (const exposedKick of exposedKicks) {
        const legKick = new THREE.Mesh(exposedKick.geometry, toeKickMaterial);
        legKick.position.set(exposedKick.x, -bodyHeight / 2 - toeKickHeight / 2, exposedKick.z);
        legKick.userData = {
          baseToeKick: true,
          lCornerToeKick: true,
          floorStandingToeKick: true,
          lCornerExposedFaceToeKick: true,
          lCornerToeKickSide: exposedKick.side,
          toeKickHeightIn: THREE_D_TOE_KICK,
          toeKickRecessIn: 3,
          selectedToeKickFinishSkin: hasSelectedToeKickFinish,
          visibleToeKickFrontPlane: hasSelectedToeKickFinish,
          doesNotReplacePhysicalSupport: true,
        };
        cabinet.add(legKick);
        bodyMeshes.push(legKick);
      }
    } else if (specialty.kind === "end-return") {
      const attachedFronts = baseEndAttachedFrontLayout(bodyWidth, bodyDepth);
      const toeKickRecess = 3 * INCH;
      const toeKickThickness = 0.08;
      for (const face of attachedFronts.supportFaces) {
        const toeKick = new THREE.Mesh(
          new THREE.BoxGeometry(attachedFronts.sideLength, toeKickHeight, toeKickThickness),
          toeKickMaterial,
        );
        const normalX = Math.sin(face.rotation);
        const normalZ = Math.cos(face.rotation);
        // The decorative face belongs at the cabinet boundary; the 4½-inch
        // support begins three inches behind that boundary, not flush with it.
        toeKick.position.set(
          face.x - normalX * (toeKickRecess + 0.028 + toeKickThickness / 2),
          -bodyHeight / 2 - toeKickHeight / 2,
          face.z - normalZ * (toeKickRecess + 0.028 + toeKickThickness / 2),
        );
        toeKick.rotation.y = face.rotation;
        toeKick.userData = {
          baseToeKick: true,
          floorStandingToeKick: true,
          toeKickHeightIn: THREE_D_TOE_KICK,
          endReturnToeKick: true,
          nonCornerEndReturnToeKick: true,
          attachedEndFrontToeKick: face.side,
          toeKickFaceWidthIn: attachedFronts.sideLength / INCH,
          toeKickRecessIn: 3,
          selectedToeKickFinishSkin: hasSelectedToeKickFinish,
          visibleToeKickFrontPlane: hasSelectedToeKickFinish,
          doesNotReplacePhysicalSupport: true,
        };
        cabinet.add(toeKick);
        bodyMeshes.push(toeKick);
      }
    } else if (!suppressInstalledFillerToeKick && !surfaceTextures?.suppressContinuousBaseToeKick) {
      const toeKick = new THREE.Mesh(
		        new THREE.BoxGeometry(bodyWidth + 0.02, toeKickHeight, isFrontFlushFillerBoard ? installedFillerBoardDepth : Math.max(0.12, bodyDepth - 0.25)),
	        toeKickMaterial,
	      );
      // Recess the toe-kick three inches from the cabinet face, matching the
      // shared 2D base-cabinet convention rather than drawing a floor-to-front box.
	      toeKick.position.set(
	        0,
	        -bodyHeight / 2 - toeKickHeight / 2,
		        isFrontFlushFillerBoard ? installedFillerFrontOffset - 3 * INCH : -0.125,
	      );
	      toeKick.userData = {
	        baseToeKick: true,
	        continuousRunOverlap: true,
        floorStandingToeKick: true,
        toeKickHeightIn: THREE_D_TOE_KICK,
	        toeKickRecessIn: 3,
		        ...(isFrontFlushFillerBoard ? { installedFillerToeKickRecessed: true, installedFillerVisibleDepthIn: installedFillerBoardDepth / INCH } : {}),
      };
      cabinet.add(toeKick);
      bodyMeshes.push(toeKick);
      if (hasSelectedToeKickFinish && !isFrontFlushFillerBoard) {
        const finishSkinThickness = 0.035;
        const finishSkin = new THREE.Mesh(
          new THREE.BoxGeometry(bodyWidth + 0.02, toeKickHeight, finishSkinThickness),
          toeKickMaterial,
        );
        finishSkin.position.set(
          0,
          -bodyHeight / 2 - toeKickHeight / 2,
          bodyDepth / 2 - 3 * INCH + finishSkinThickness / 2 + 0.002,
        );
        finishSkin.userData = {
          selectedToeKickFinishSkin: true,
          floorStandingToeKick: true,
          toeKickHeightIn: THREE_D_TOE_KICK,
          toeKickRecessIn: 3,
          visibleToeKickFrontPlane: true,
          doesNotReplacePhysicalSupport: true,
        };
        cabinet.add(finishSkin);
        bodyMeshes.push(finishSkin);
      }
    }
    }
  }
  if (isFloorDishwasher) {
    // A built-in dishwasher is a floor appliance inside a base opening: its
    // appliance face begins above the same 4½-inch recessed kick as adjacent
    // base cabinets, while its full catalog envelope remains authoritative.
    const toeKickHeight = THREE_D_TOE_KICK * INCH;
    const dishwasherKick = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.12, bodyWidth - 0.08), toeKickHeight, Math.max(0.12, bodyDepth - 0.25)),
      new THREE.MeshStandardMaterial({ color: "#302820", roughness: 0.78 }),
    );
    // Unlike a base carcass, a dishwasher's 34½-inch envelope already starts
    // at floor level, so its recessed support is positioned inside that full
    // appliance height and still spans exactly floor-to-4½ inches.
    dishwasherKick.position.set(0, -bodyHeight / 2 + toeKickHeight / 2, -0.125);
    dishwasherKick.userData = { dishwasherToeKick: true, toeKickHeightIn: THREE_D_TOE_KICK, floorApplianceSupport: true };
    cabinet.add(dishwasherKick);
    bodyMeshes.push(dishwasherKick);
  }
  if (specialty.kind === "corner-drawer" || specialty.kind === "l-corner") {
    const lShape = lCornerCarcassParts(bodyWidth, bodyDepth, lCornerLegRatio);
    for (const part of [lShape.backLeg, lShape.sideLeg]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(part.width, bodyHeight, part.depth), bodyMaterial);
      leg.position.set(part.x, 0, part.z);
      leg.userData = { specialtyProfile: specialty.kind, lCornerCarcass: true, selectedStyleSideSkin: true };
      cabinet.add(leg);
      bodyMeshes.push(leg);
    }
  } else if (specialty.kind === "end-return") {
    const diagram = baseEndAttachedFrontLayout(bodyWidth, bodyDepth);
    const clippedBody = new THREE.Mesh(baseEndDiagramGeometry(diagram.sideLength, bodyHeight), bodyMaterial);
    clippedBody.userData = {
      specialtyProfile: "end-return",
      nonCornerEndReturnBody: true,
      diagramDefinedRearApexBody: true,
      sideLengthIn: diagram.sideLength / INCH,
      rearApex: diagram.rearApex,
      exteriorApex: diagram.apex,
    };
    cabinet.add(clippedBody);
    bodyMeshes.push(clippedBody);
  } else if (specialty.kind === "diagonal-corner") {
    const wedge = new THREE.Mesh(
      angledWallProfile
        ? triangleCornerWedgeGeometry(bodyWidth, bodyDepth, bodyHeight)
        : diagonalCornerWedgeGeometry(bodyWidth, bodyDepth, bodyHeight),
      bodyMaterial,
    );
    wedge.userData = angledWallProfile
      ? { specialtyProfile: "angled-wall", angledWallWedge: true, selectedStyleSideSkin: true }
      : { specialtyProfile: "diagonal-corner", diagonalCornerWedge: true, selectedStyleSideSkin: true };
    cabinet.add(wedge);
    bodyMeshes.push(wedge);
    if (!angledWallProfile) {
      // The extruded pentagon's two short return faces inherit directional light
      // differently from its door planes, which made one WDC side look gray or
      // like a different finish. Add flush finish skins on only those two exposed
      // returns and update them from the same selected finish/door-sample crop.
	      const rightReturnMaterial = new THREE.MeshPhysicalMaterial({ color, ...cabinetPbr });
	      const leftReturnMaterial = new THREE.MeshPhysicalMaterial({ color, ...cabinetPbr });
      flatExposedFinishMaterials.push(rightReturnMaterial, leftReturnMaterial);
      const rightReturn = new THREE.Mesh(new THREE.PlaneGeometry(bodyDepth / 2, bodyHeight), rightReturnMaterial);
      rightReturn.position.set(bodyWidth / 2 + 0.006, 0, -bodyDepth / 4);
      rightReturn.rotation.y = Math.PI / 2;
      rightReturn.userData = { diagonalCornerFinishedReturn: "right", selectedFinishSideSkin: true, selectedFinishStructuralSurface: true };
      cabinet.add(rightReturn);
      const leftReturn = new THREE.Mesh(new THREE.PlaneGeometry(bodyWidth / 2, bodyHeight), leftReturnMaterial);
      leftReturn.position.set(-bodyWidth / 4, 0, bodyDepth / 2 + 0.006);
      leftReturn.userData = { diagonalCornerFinishedReturn: "left", selectedFinishSideSkin: true, selectedFinishStructuralSurface: true };
      cabinet.add(leftReturn);
    }
  } else if (specialty.kind === "triangle-corner") {
    const wedge = new THREE.Mesh(triangleCornerWedgeGeometry(bodyWidth, bodyDepth, bodyHeight), bodyMaterial);
    wedge.userData = { specialtyProfile: "triangle-corner", triangleCornerWedge: true, selectedStyleSideSkin: true };
    cabinet.add(wedge);
    bodyMeshes.push(wedge);
  } else if (isFreestandingRange) {
    // A range is a floor appliance, not a cabinet carcass. A dedicated chassis,
    // lower recess, and four feet keep the product front from reading as a box.
    // Its body must still occupy the exact approved 30-inch placement width:
    // shrinking the chassis created a visible gap beside an edge-snapped DB18
    // even though the plan, collision model, and order takeoff were flush.
    const footHeight = Math.min(0.12, bodyHeight * 0.06);
    const topClearance = 0.06;
    const chassisHeight = Math.max(0.2, bodyHeight - footHeight - topClearance);
    const chassisMaterial = new THREE.MeshStandardMaterial({ color: rangeAppearance?.bodyColor ?? "#1b2026", roughness: 0.34, metalness: 0.58 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, chassisHeight, bodyDepth), chassisMaterial);
    chassis.position.y = -bodyHeight / 2 + footHeight + chassisHeight / 2;
    chassis.userData = { applianceCode: sku.masterCode, freestandingRangeChassis: true, rangeFloorClearanceIn: footHeight / INCH, rangeFinish: rangeAppearance?.finish, rangeFuel: rangeAppearance?.fuel };
    cabinet.add(chassis);

    const footWidth = Math.max(0.07, Math.min(0.11, bodyWidth * 0.055));
    const footDepth = Math.max(0.09, Math.min(0.14, bodyDepth * 0.07));
    for (const xSign of [-1, 1] as const) {
      for (const zSign of [-1, 1] as const) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(footWidth, footHeight, footDepth), chassisMaterial);
        const isFrontFoot = zSign === 1;
        foot.position.set(
          xSign * (bodyWidth / 2 - footWidth * 0.8),
          -bodyHeight / 2 + footHeight / 2,
          isFrontFoot ? bodyDepth / 2 + 0.12 : -bodyDepth / 2 + footDepth * 0.8,
        );
        foot.userData = { applianceCode: sku.masterCode, freestandingRangeFoot: true, visibleFreestandingRangeFoot: isFrontFoot, floorApplianceSupport: true };
        cabinet.add(foot);
      }
    }
    const toeRecess = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.72, Math.max(0.06, footHeight * 0.78), 0.028),
      new THREE.MeshStandardMaterial({ color: "#080b0e", roughness: 0.5, metalness: 0.28 }),
    );
    toeRecess.position.set(0, -bodyHeight / 2 + footHeight * 0.72, bodyDepth / 2 + 0.122);
    toeRecess.userData = { applianceCode: sku.masterCode, freestandingRangeToeRecess: true };
    cabinet.add(toeRecess);
  } else if (isCountertopOpeningAppliance) {
    // A built-in cooktop is a thin opening appliance on a standard base box,
    // not a sink-base fixture and not a freestanding range chassis.
    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: sku.rangeTopFinish === "black-glass" || /induction|smooth|electric/i.test(sku.description ?? "") ? "#151a20" : "#b9c0c7",
      roughness: sku.rangeTopFinish === "black-glass" ? 0.18 : 0.28,
      metalness: sku.rangeTopFinish === "black-glass" ? 0.42 : 0.72,
    });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.94, 0.06, bodyDepth * 0.92), surfaceMaterial);
    // Keep the appliance top slightly above the finished slab so WebGL depth
    // testing cannot bury the cooktop in a coplanar countertop surface.
    const cooktopReveal = 0.035 * INCH;
    surface.position.set(0, bodyHeight / 2 - 0.03 + cooktopReveal, 0);
    surface.userData = { applianceCode: sku.masterCode, countertopOpeningCooktop: true, cooktopProductId: sku.applianceProductId ?? null };
    cabinet.add(surface);
    const gas = /gas/i.test(sku.description ?? "");
    const induction = /induction/i.test(sku.description ?? "");
    for (const center of [[-0.27, -0.2], [0.27, -0.2], [-0.27, 0.2], [0.27, 0.2]] as const) {
      const burner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.025, 24),
        new THREE.MeshStandardMaterial({ color: gas ? "#171b20" : "#3b4148", roughness: 0.24, metalness: 0.55 }),
      );
      burner.position.set(center[0] * bodyWidth, bodyHeight / 2 + 0.006 + cooktopReveal, center[1] * bodyDepth);
      burner.userData = { applianceCode: sku.masterCode, countertopOpeningBurner: true, fuel: gas ? "gas" : "electric" };
      cabinet.add(burner);
      if (gas) {
        for (const rotation of [0, Math.PI / 2]) {
          const grate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.026), new THREE.MeshStandardMaterial({ color: "#11151a", roughness: 0.32, metalness: 0.58 }));
          grate.rotation.y = rotation;
          grate.position.set(burner.position.x, bodyHeight / 2 + 0.025 + cooktopReveal, burner.position.z);
          grate.userData = { applianceCode: sku.masterCode, countertopOpeningGasGrate: true };
          cabinet.add(grate);
        }
      } else if (induction) {
        const zone = new THREE.Mesh(
          new THREE.TorusGeometry(0.15, 0.012, 10, 32),
          new THREE.MeshStandardMaterial({ color: "#7e8c9b", roughness: 0.2, metalness: 0.5, emissive: "#263747", emissiveIntensity: 0.25 }),
        );
        zone.rotation.x = Math.PI / 2;
        zone.position.set(burner.position.x, bodyHeight / 2 + 0.02 + cooktopReveal, burner.position.z);
        zone.userData = { applianceCode: sku.masterCode, countertopOpeningInductionZone: true };
        cabinet.add(zone);
      }
    }
  } else if (isWallOpenShelf) {
    // A wall open shelf is a full carcass, never a thin floating shelf. The
    // WEOS wall-end source alone adds the source-documented bowed shelf fronts.
    const panelThickness = Math.min(0.06, Math.max(0.035, Math.min(bodyWidth, bodyDepth) * 0.075));
    const shelfThickness = Math.min(0.052, Math.max(0.028, bodyHeight * 0.022));
    const interiorWidth = Math.max(0.08, bodyWidth - panelThickness * 2);
    const interiorDepth = Math.max(0.08, bodyDepth - panelThickness);
    const interiorHeight = Math.max(0.08, bodyHeight - shelfThickness * 2);
    const addOpenShelfPart = (mesh: THREE.Mesh, data: Record<string, unknown>) => {
      mesh.userData = {
        wallOpenShelf: true,
        wallEndOpenShelf: isWallEndOpenShelf,
        catalogCurvedShelfAssembly: isWallEndOpenShelf,
        selectedStyleSideSkin: true,
        ...data,
      };
      cabinet.add(mesh);
      bodyMeshes.push(mesh);
    };
    const top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, shelfThickness, bodyDepth), bodyMaterial);
    top.position.y = bodyHeight / 2 - shelfThickness / 2;
    addOpenShelfPart(top, { wallOpenShelfPart: "top" });
    const bottomShelf = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, shelfThickness, bodyDepth), bodyMaterial);
    bottomShelf.position.y = -bodyHeight / 2 + shelfThickness / 2;
    addOpenShelfPart(bottomShelf, { wallOpenShelfPart: "bottom" });
    const back = new THREE.Mesh(new THREE.BoxGeometry(interiorWidth, interiorHeight, panelThickness), bodyMaterial);
    back.position.z = -bodyDepth / 2 + panelThickness / 2;
    addOpenShelfPart(back, { wallOpenShelfPart: "back" });
    for (const side of [-1, 1] as const) {
      const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(panelThickness, interiorHeight, bodyDepth), bodyMaterial);
      sidePanel.position.x = side * (bodyWidth / 2 - panelThickness / 2);
      addOpenShelfPart(sidePanel, { wallOpenShelfPart: side === -1 ? "left-side" : "right-side" });
    }
    // WEOS0930 keeps its source-documented two bowed shelves. The named
    // KitchenCrest OE6 family uses the supplied generic square-shelf counts;
    // all other open shelves retain only their authored count.
    const fixedShelfCount = isWallEndOpenShelf
      ? Math.max(1, Math.min(4, Math.round(Number(sku.fixedShelfCount ?? 2) || 2)))
      : kitchenCrestGenericShelfCount
        ?? Math.max(0, Math.min(4, Math.round(Number(sku.fixedShelfCount ?? 0) || 0)));
    for (let index = 0; index < fixedShelfCount; index += 1) {
      const shelf = new THREE.Mesh(
        wallEndOpenShelfBoardGeometry(interiorWidth, interiorDepth, shelfThickness, isWallEndOpenShelf),
        bodyMaterial,
      );
      shelf.position.set(0, -bodyHeight / 2 + shelfThickness + (interiorHeight * (index + 1)) / (fixedShelfCount + 1), panelThickness / 2);
      addOpenShelfPart(shelf, {
        wallOpenShelfPart: "fixed-shelf",
        wallOpenShelfFixedShelf: index + 1,
        bowedFrontEdge: isWallEndOpenShelf,
        sourceFixedShelfCount: fixedShelfCount,
        kitchenCrestGenericOpenEndShelf: kitchenCrestGenericShelfCount != null,
      });
    }
  } else if (isFloatingShelf) {
    const shelfBody = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, Math.max(0.05, bodyHeight), bodyDepth),
      bodyMaterial,
    );
    shelfBody.userData = {
      floatingShelf: true,
      thinWallShelf: true,
      noCabinetCarcass: true,
      selectedStyleSideSkin: true,
    };
    cabinet.add(shelfBody);
    bodyMeshes.push(shelfBody);
  } else if (isFloorDishwasher) {
    // A fitted dishwasher holds the same measured 24-inch opening as a base
    // cabinet, but it is an appliance—not a cabinet-finish side panel. The
    // former generic body used bodyMaterial here, leaving a visible door-style
    // strip at the dishwasher edge even after neighboring filler toe kicks
    // were correctly suppressed. Only an explicitly panel-ready appliance may
    // inherit the selected cabinet finish.
    const dishwasherChassisMaterial = isPanelReadyAppliance
      ? bodyMaterial
      : new THREE.MeshStandardMaterial({ color: "#59616a", roughness: 0.34, metalness: 0.58 });
    const dishwasherChassis = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
      dishwasherChassisMaterial,
    );
    dishwasherChassis.userData = {
      applianceCode: sku.masterCode,
      dishwasherChassis: true,
      floorApplianceEnvelope: true,
      ...(isPanelReadyAppliance
        ? { selectedFinishSideSkin: true }
        : { neutralApplianceSidesAndTop: true, usesDoorImage: false }),
    };
    cabinet.add(dishwasherChassis);
    bodyMeshes.push(dishwasherChassis);
	  } else if (!isPlacedHood) {
		    const fillerBodyDepth = isFrontFlushFillerBoard ? installedFillerBoardDepth : bodyDepth;
		    const transitionFootprint = isAngledTransitionFiller
		      ? angledTransitionLocalFootprint(sku.fillerTransitionFootprint!, { x, z, rotation })
		      : null;
		    const body = new THREE.Mesh(
		      transitionFootprint
		        ? angledTransitionFillerPrismGeometry(transitionFootprint, bodyHeight)
		        : isMiteredWallFiller
		        ? miteredFillerPrismGeometry(bodyWidth, bodyHeight, fillerBodyDepth, sku.fillerMiteredEnd!)
		        : new THREE.BoxGeometry(bodyWidth, bodyHeight, fillerBodyDepth),
			      bodyMaterial,
		    );
		    // The front-miter pair arrives as an exact world-plan footprint in this
		    // group's local frame. Do not apply the generic filler front shift a
		    // second time or the board becomes a detached leg in front of the run.
		    if (isFrontFlushFillerBoard && !isAngledTransitionFiller) body.position.z = installedFillerFrontOffset;
		    body.userData = {
		...(isRefrigeratorAppliance
        ? { refrigeratorNeutralShell: true, neutralApplianceSidesAndTop: true }
        : { selectedStyleSideSkin: true }),
	      ...(specialty.kind === "blind-corner" ? { specialtyProfile: "blind-corner", blindCornerBody: true } : {}),
      ...(isFrontFlushFillerBoard ? { installedFillerFrontAligned: true, installedFillerVisibleDepthIn: installedFillerBoardDepth / INCH, fullDepthReservedForCountertop: true } : {}),
      ...(usesBaseFillerFaceElevation ? { baseFillerFace: true, fillerFaceBottomIn: THREE_D_TOE_KICK, fillerFaceHeightIn: heightIn } : {}),
		      ...(isMiteredWallFiller ? { angledWallMiteredFiller: true, miterAngle: 45, miteredEnd: sku.fillerMiteredEnd } : {}),
		      ...(isAngledTransitionFiller ? {
		        angledWallTransitionFiller: true,
		        ...(sku.fillerTransitionKind === "front-miter-pair"
		          ? { frontOnlyMiterPair: true, miterPairPiece: sku.fillerTransitionPiece ?? null, visibleDepthIn: 0.75 }
		          : { fullDepthMeasuredFootprint: true }),
		        rearWidthIn: sku.fillerTransitionRearWidthIn,
		        frontWidthIn: sku.fillerTransitionFrontWidthIn,
		        stockWidthIn: sku.fillerTransitionStockWidthIn,
		        cabinetsIndependentlySupported: sku.fillerIndependentCabinetSupport === true,
		      } : {}),
		    };
    cabinet.add(body);
    bodyMeshes.push(body);
  }

	  const textureMaterials: THREE.MeshStandardMaterial[] = [];
  const applyDoorTextureFallback = () => {
    const fallback = threeDDoorMaterialFallback(color);
    for (const material of textureMaterials) {
      material.map = fallback.map;
      material.color.set(fallback.color);
      material.needsUpdate = true;
    }
  };
	  const useDoorTexture = threeDUsesDoorSampleTexture(doorSampleUrl);
	  const usesCuratedCabinetGrain = /rustic_hickory_vertical_grain/i.test(doorSampleUrl ?? "");
	  const doorTexture = useDoorTexture && doorSampleUrl
    ? new THREE.TextureLoader().load(doorSampleUrl, (loadedTexture) => {
      applyPlainStructuralFinish?.(color, loadedTexture);
      onDoorTextureState?.("loaded");
    }, undefined, () => {
      applyDoorTextureFallback();
      applyPlainStructuralFinish?.(color, null);
      onDoorTextureState?.("failed");
    })
    : null;
  if (doorTexture) onDoorTextureState?.("loading");
	  if (doorTexture) {
	    doorTexture.colorSpace = THREE.SRGBColorSpace;
	    doorTexture.wrapS = usesCuratedCabinetGrain ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
	    doorTexture.wrapT = usesCuratedCabinetGrain ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
	    // A door-sample photo often includes rails, stiles, and studio background.
	    // The renderer already builds the saved door profile physically, so use only
	    // the uninterrupted center finish grain as its material map.
	    doorTexture.repeat.set(usesCuratedCabinetGrain ? 1 : 0.42, usesCuratedCabinetGrain ? 1 : 0.42);
	    const grainTransform = usesCuratedCabinetGrain
	      ? threeDCabinetGrainTransform(sku.placementUid, doorSampleUrl)
	      : null;
	    doorTexture.offset.set(grainTransform?.offsetX ?? 0.29, grainTransform?.offsetY ?? 0.29);
	    doorTexture.userData = {
	      ...doorTexture.userData,
	      curatedCabinetFinish: usesCuratedCabinetGrain,
	      ...(grainTransform ? { cabinetGrainTransform: grainTransform, grainPlacementUid: sku.placementUid ?? "legacy-cabinet" } : {}),
	      materialOnlyNoDoorGeometry: true,
	    };
	  }
  // The active catalog sample is applied to actual door and drawer faces.
  // Shaker rails and stiles remain physical meshes over those faces, preserving
  // the selected Door Style's recessed-panel construction in the 3D Designer.
  const faceColor = threeDFaceMaterialColor(color, Boolean(doorTexture));
	  const doorFinishSurface = threeDDoorFinishSurfaceProfile(doorProfile?.finishSheen, Boolean(doorTexture));
	  const faceMaterial = new THREE.MeshPhysicalMaterial({
	    color: faceColor,
	    map: doorTexture,
	    ...doorFinishSurface,
	  });
  const structuralFinish = threeDStructuralFinish(color, Boolean(doorTexture));
  let plainStructuralColor = structuralFinish.color;
  let structuralSampleTexture: THREE.Texture | null = null;
  const applyStructuralFinish = (finishColor: string, sampleTexture: THREE.Texture | null = null) => {
    const applied = applyThreeDStructuralFinishMaterials(structuralFinishMaterials, finishColor, sampleTexture);
    for (const material of flatExposedFinishMaterials) {
      material.color.set(applied.texture ? "#ffffff" : finishColor);
      material.map = applied.texture;
      material.needsUpdate = true;
      material.userData = {
        ...material.userData,
        selectedFinishStructuralSurface: true,
        usesDoorSample: Boolean(applied.texture),
        usesDoorImage: Boolean(applied.texture),
      };
    }
    plainStructuralColor = applied.color;
    structuralSampleTexture = applied.texture;
  };
  applyPlainStructuralFinish = applyStructuralFinish;
  applyStructuralFinish(color, null);
  if (doorTexture?.image) {
    applyStructuralFinish(color, doorTexture);
  }
	  const trimMaterial = new THREE.MeshPhysicalMaterial({ color: faceColor, map: doorTexture, ...doorFinishSurface });
	  // A per-host Door Style sample can fail to load. Faces and their physical
	  // rails must then fall back together to the chosen style color instead of
	  // leaving the rails with an unresolved (black) texture map.
	  textureMaterials.push(faceMaterial, trimMaterial);
	  const frameMaterialFor = (piece: "rail" | "stile" | "panel") => {
	    // The catalog profile can explicitly request traditional frame grain: rails
	    // run horizontally, stiles and center panels vertically. A cloned material
	    // keeps this UV orientation local to the physical board rather than rotating
	    // the whole cabinet texture or any glass surface.
	    if (!doorTexture || doorProfile?.grainDirection !== "vertical-stiles-horizontal-rails" || piece === "panel") return trimMaterial;
	    const map = doorTexture.clone();
	    map.center.set(0.5, 0.5);
	    map.rotation = piece === "rail" ? Math.PI / 2 : 0;
	    map.needsUpdate = true;
	    const material = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map, ...doorFinishSurface });
	    material.userData = { grainPiece: piece, grainDirection: doorProfile.grainDirection };
	    textureMaterials.push(material);
	    return material;
	  };
	  const drawerRevealMaterial = new THREE.LineBasicMaterial({ color: "#302a24", transparent: true, opacity: 0.58 });
	  const hardwareMaterial = new THREE.MeshPhysicalMaterial({ color: surfaceTextures?.hardwareAccent ?? "#b8bbc0", ...metalPbr });
	  const glassDoorMaterial = new THREE.MeshPhysicalMaterial({
	    color: "#b8d4dc",
	    ...threeDPhysicalSurfaceProfile("glass"),
	    transmission: 0.48,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
	    side: THREE.DoubleSide,
	  });
	  const glassInteriorMaterial = new THREE.MeshStandardMaterial({ color: plainStructuralColor, roughness: 0.58, metalness: 0.01 });
	  structuralFinishMaterials.push(glassInteriorMaterial);
  const shadowRevealMaterial = new THREE.MeshStandardMaterial({ color: "#1c1814", roughness: 0.78, metalness: 0.02, transparent: true, opacity: 0.52 });
  // Side skins inherit the selected finish color but must never project the door
  // sample image or Shaker panel layout onto a cabinet end. The actual door sample
  // is reserved for true front meshes above; the carcass gets a flush finish skin.
  bodyMaterial.userData = isRefrigeratorAppliance
    ? { ...bodyMaterial.userData, refrigeratorNeutralShell: true, neutralApplianceSidesAndTop: true, usesDoorImage: false }
    : { ...bodyMaterial.userData, selectedFinishSideSkin: true, usesDoorImage: Boolean(bodyMaterial.map) };
  // Every decorative standard front must remain on the physical exterior of the
  // carcass. The former 0.015-ft group offset placed the inner face of a 0.045-
  // or 0.052-ft door mesh inside the box. Seat the deepest supported front just
  // beyond the box plane, leaving a small deterministic clearance while keeping
  // its left/right edges constrained by the configured cabinet width below.
  const faceDepth = bodyDepth / 2 + 0.052 / 2 + 0.004;
  // A verified Cabinet Config product visual carries the supplied cabinet's
  // actual front layout. Keep the measured 3D carcass behind it, but place the
  // provided visual on the visible face instead of inventing a generic panel.
  const catalogFrontVisualUrl = threeDCabinetFrontVisualUrl(sku);
  const hasVerifiedDoorLayout = threeDHasVerifiedDoorLayout(sku);
  // The admin panel door sample (doorSampleUrl) is the SOLE authoritative face
  // texture. When it exists, NEVER overlay the Cabinet Config line-art drawing.
  // The catalog front visual is only used as a fallback for cabinets that have
  // NO active door style sample at all.
  if (catalogFrontVisualUrl && threeDUsesCatalogFrontVisual({
    hasCatalogFrontVisual: Boolean(catalogFrontVisualUrl),
    hasDoorSample: Boolean(doorSampleUrl),
    hasDoorTexture: Boolean(doorTexture),
    specialtyKind: specialty.kind,
    isRefrigeratorEndPanel,
    hasVerifiedDoorLayout,
  })) {
    const frontVisualTexture = new THREE.TextureLoader().load(catalogFrontVisualUrl);
    frontVisualTexture.colorSpace = THREE.SRGBColorSpace;
    const frontVisualMaterial = new THREE.MeshBasicMaterial({
      map: frontVisualTexture,
      color: "#ffffff",
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
    });
    const visualHeight = bodyHeight + (isFloorStandingCabinet ? THREE_D_TOE_KICK * INCH : 0);
    const frontVisual = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.08, bodyWidth - 0.02), Math.max(0.08, visualHeight - 0.02)),
      frontVisualMaterial,
    );
    frontVisual.position.set(0, isFloorStandingCabinet ? -(THREE_D_TOE_KICK * INCH) / 2 : 0, faceDepth + 0.012);
    frontVisual.renderOrder = 4;
    frontVisual.userData = {
      authoritativeCabinetFrontVisual: true,
      cabinetFrontVisualUrl: catalogFrontVisualUrl,
      source: "Cabinet Config",
    };
    cabinet.add(frontVisual);
  }
  // Standard catalog cabinets need a visible constructed face frame behind their
  // door/drawer fronts. This keeps slab, raised-panel, and shaker selections
  // equally dimensional instead of relying on the Shaker rail overlay alone.
  const usesConstructedFaceFrame = placement !== "appliance"
    && !isRefrigeratorEndPanel
    && !isWallOpenShelf
    && !["diagonal-corner", "triangle-corner", "l-corner", "corner-drawer", "end-return", "blind-corner", "range-hood-front"].includes(specialty.kind);
  if (usesConstructedFaceFrame) {
    const frameMaterial = new THREE.MeshStandardMaterial({ color: plainStructuralColor, roughness: 0.46, metalness: 0.01 });
    structuralFinishMaterials.push(frameMaterial);
    const frameDepth = 0.028;
    const frameWidth = Math.min(0.095, Math.max(0.055, Math.min(bodyWidth, bodyHeight) * 0.075));
    const frameGroup = new THREE.Group();
    frameGroup.position.z = faceDepth - frameDepth * 0.65;
    frameGroup.userData = { cabinetFaceFrame: true, constructedCarcassDetail: true, faceFrameWidthIn: frameWidth / INCH };
    const framePieces = [
      [bodyWidth, frameWidth, 0, bodyHeight / 2 - frameWidth / 2],
      [bodyWidth, frameWidth, 0, -bodyHeight / 2 + frameWidth / 2],
      [frameWidth, Math.max(0.02, bodyHeight - frameWidth * 2), -bodyWidth / 2 + frameWidth / 2, 0],
      [frameWidth, Math.max(0.02, bodyHeight - frameWidth * 2), bodyWidth / 2 - frameWidth / 2, 0],
    ] as const;
    for (const [pieceWidth, pieceHeight, x, y] of framePieces) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(pieceWidth, pieceHeight, frameDepth), frameMaterial);
      frame.position.set(x, y, 0);
      frame.userData = { cabinetFaceFrame: true, constructedCarcassDetail: true };
      frameGroup.add(frame);
    }
    cabinet.add(frameGroup);
  }
  const resolvedFaceLayout = resolvedThreeDFaceLayout(sku);
  // Sink bases use false drawer fronts above their doors. Some catalog rows
  // omit those non-operable fronts from `numberOfDrawers`; the physical SB/CSB
  // front standard is still two false fronts over its standard door pair.
  const isStandardSinkBase = placement === "base" && /^(?:SB|CSB)[-_]?\d/i.test(sku.masterCode ?? "");
  const hasConfiguredOpening = resolvedFaceLayout.hasConfiguredOpening;
  const doorCount = isStandardSinkBase ? Math.max(2, resolvedFaceLayout.doorCount) : resolvedFaceLayout.doorCount;
  const drawerCount = isStandardSinkBase ? Math.max(2, resolvedFaceLayout.drawerCount) : resolvedFaceLayout.drawerCount;
  const usableHeight = bodyHeight - 0.08;
  const pantryLayout = pantryDrawerFrontLayout({ ...sku, numberOfDoors: doorCount, numberOfDrawers: drawerCount }, usableHeight / INCH);
  const wd18Layout = wd18CountertopFaceLayout(
    { masterCode: sku.masterCode, placement, numberOfDrawers: drawerCount },
    usableHeight / INCH,
  );
  const configuredDrawerHeight = sku.drawerHeight != null ? numberValue(sku.drawerHeight, 0) * INCH : 0;
  // A drawer-only cabinet's authored rows own its whole usable face. The former
  // generic 35% allowance left an invented blank upper section in 3D even though
  // the 2D elevation renders the saved drawer stack full height.
  const drawerHeight = pantryLayout ? pantryLayout.drawerHeight * INCH : wd18Layout
    ? wd18Layout.drawerHeights.reduce((sum, heightIn) => sum + heightIn, 0) * INCH
    : threeDDrawerZoneHeight({
      availableHeight: usableHeight,
      drawerCount,
      doorCount,
      configuredDrawerHeight,
      hasConfiguredOpening,
      placement,
      masterCode: sku.masterCode,
    });
  const configuredDoorHeight = sku.doorHeight != null ? numberValue(sku.doorHeight, 0) * INCH : 0;
  const doorHeight = pantryLayout ? pantryLayout.doorHeight * INCH : Math.max(0.2, wd18Layout ? wd18Layout.doorHeight * INCH : configuredDoorHeight || usableHeight - drawerHeight);
  const frontGroup = new THREE.Group();
  frontGroup.userData = {
    decorativeFrontClearanceIn: 0.004 / INCH,
    physicalFacePlane: true,
    boundedByCarcassFace: true,
  };
  if (specialty.kind === "end-return") {
    frontGroup.userData = {
      ...frontGroup.userData,
      becAttachedTwoFaceEnd: true,
      separateProjectedThirdFace: false,
    };
  }
  // Specialty fronts use absolute local positions on their physical footprint.
  // In particular, BEC must not inherit the generic rectangular front-depth
  // offset: that offset creates a separate third face ahead of its clipped
  // 45-degree end plane.
  // Range-hood meshes already carry their complete catalog depth. Mount them at
  // the footprint center so their rear plane stays on the wall; placing them on
  // the decorative face plane adds another half-depth and makes the hood float
  // forward into the room.
  frontGroup.position.z = isPlacedHood || specialty.kind === "diagonal-corner" || specialty.kind === "triangle-corner" || specialty.kind === "l-corner" || specialty.kind === "end-return" ? 0 : faceDepth;
  if (isPlacedHood) {
    frontGroup.userData = {
      ...frontGroup.userData,
      fullDepthWallMountedAppliance: true,
      rearPlaneUsesSavedWallFootprint: true,
    };
  }
  for (const side of threeDDecorativeEndSides(sku.decorativeEnd)) {
    const endPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, Math.max(0.12, bodyHeight - 0.05), Math.max(0.12, bodyDepth - 0.05)),
      faceMaterial,
    );
    endPanel.position.set(side * (bodyWidth / 2 + 0.022), 0, -faceDepth);
    endPanel.userData = { decorativeEndPanel: true, decorativeEndSide: side === -1 ? "left" : "right", explicitEndTreatment: true };
    frontGroup.add(endPanel);
  }
  const profileKind = doorProfileKind(doorProfile?.doorStyle, doorProfile?.doorPanelType);

  // The active profile arrives from the same Door Style metric resolver that
  // drives elevation. Slim Shaker therefore carries its actual one-inch stile
  // into both physical rails and hardware placement; ordinary Shaker remains 3.
  const requestedProfileStile = Number(doorProfile?.stileWidth);
  const profileFrameWidthIn = Number.isFinite(requestedProfileStile) && requestedProfileStile > 0
    ? requestedProfileStile
    : 3;
	  const addShakerFrame = (faceWidth: number, faceHeight: number, x: number, y: number, z = 0.036, rotationY = 0, forceGlassFrame = false) => {
	    const raisedProfile = !forceGlassFrame && (profileKind === "raised" || doorProfile?.panelConstruction === "raised");
	    const framedProfile = forceGlassFrame || raisedProfile || threeDUsesPhysicalShakerRails(profileKind, Boolean(doorTexture));
	    if (!framedProfile) return;
    const rail = threeDShakerRailThickness(faceWidth, faceHeight, doorProfile?.railWidth);
    const stile = threeDShakerRailThickness(faceWidth, faceHeight, doorProfile?.stileWidth);
    if (!rail || !stile) return;
    const frameGroup = new THREE.Group();
    const pose = threeDShakerFramePose(x, y, z, rotationY);
    frameGroup.position.set(pose.x, pose.y, pose.z);
    frameGroup.rotation.y = pose.rotationY;
	    frameGroup.userData = {
	      selectedStyleFace: forceGlassFrame ? "glass-door-frame" : raisedProfile ? "raised-panel" : "shaker",
	      physicalRails: true,
	      panelConstruction: raisedProfile ? "raised" : doorProfile?.panelConstruction ?? "flat",
	      insideEdgeProfile: doorProfile?.insideEdgeProfile ?? "square",
	      ...(forceGlassFrame ? { glassDoorFrame: true, selectedFinishGlassFrame: true } : {}),
	    };
    const pieces = [
      [faceWidth, rail, 0, faceHeight / 2 - rail / 2, "rail" as const],
      [faceWidth, rail, 0, -faceHeight / 2 + rail / 2, "rail" as const],
      [stile, Math.max(0.02, faceHeight - rail * 2), -faceWidth / 2 + stile / 2, 0, "stile" as const],
      [stile, Math.max(0.02, faceHeight - rail * 2), faceWidth / 2 - stile / 2, 0, "stile" as const],
    ] as const;
    for (const [pieceWidth, pieceHeight, offsetX, offsetY, piece] of pieces) {
      const railMesh = new THREE.Mesh(new THREE.BoxGeometry(pieceWidth, pieceHeight, 0.026), frameMaterialFor(piece));
      railMesh.position.set(offsetX, offsetY, 0);
	      railMesh.userData = { selectedStyleFace: forceGlassFrame ? "glass-door-frame" : raisedProfile ? "raised-panel" : "shaker", physicalRail: true, grainPiece: piece, ...(forceGlassFrame ? { glassDoorFrameRail: true, selectedFinishGlassFrame: true } : {}) };
      frameGroup.add(railMesh);
    }
	    if (raisedProfile) {
	      const bevelWidth = Math.max(0.025, Math.min(
	        Number.isFinite(Number(doorProfile?.bevelWidth)) ? Number(doorProfile?.bevelWidth) * INCH : 0.5 * INCH,
	        (faceWidth - stile * 2) / 4,
	        (faceHeight - rail * 2) / 4,
	      ));
	      const bevelDepth = Math.max(0.012, Math.min(
	        Number.isFinite(Number(doorProfile?.bevelDepth)) ? Number(doorProfile?.bevelDepth) * INCH : 0.18 * INCH,
	        0.07,
	      ));
	      const bevelOuterWidth = Math.max(0.06, faceWidth - stile * 2);
	      const bevelOuterHeight = Math.max(0.06, faceHeight - rail * 2);
	      const panelWidth = Math.max(0.04, bevelOuterWidth - bevelWidth * 2);
	      const panelHeight = Math.max(0.04, bevelOuterHeight - bevelWidth * 2);
	      const recessedBed = new THREE.Mesh(new THREE.BoxGeometry(bevelOuterWidth, bevelOuterHeight, 0.008), shadowRevealMaterial);
	      recessedBed.position.z = -0.012;
	      recessedBed.userData = { raisedPanelRecess: true, insideEdgeProfile: doorProfile?.insideEdgeProfile ?? "bevel" };
	      frameGroup.add(recessedBed);
	      const bevel = new THREE.Mesh(new THREE.BoxGeometry(bevelOuterWidth - 0.006, bevelOuterHeight - 0.006, Math.max(0.018, bevelDepth * 0.62)), frameMaterialFor("panel"));
	      bevel.position.z = bevelDepth * 0.31;
	      bevel.userData = { raisedPanelBevel: true, bevelWidthIn: bevelWidth / INCH, bevelDepthIn: bevelDepth / INCH, insideEdgeProfile: doorProfile?.insideEdgeProfile ?? "bevel" };
	      frameGroup.add(bevel);
	      const centerPanel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, panelHeight, Math.max(0.02, bevelDepth)), faceMaterial);
	      centerPanel.position.z = bevelDepth;
	      centerPanel.userData = { raisedCenterPanel: true, panelConstruction: "raised", drawerFrontType: doorProfile?.drawerFrontType ?? null, grainPiece: "panel" };
	      frameGroup.add(centerPanel);
	    }
    frontGroup.add(frameGroup);
  };
  const addDrawerReveal = (faceWidth: number, faceHeight: number, x: number, y: number, z = THREE_D_DRAWER_REVEAL_DEPTH) => {
    // Render one recessed backing plane behind the drawer front rather than an
    // EdgesGeometry outline. The old outline sat forward of some physical front
    // layers and produced the ghosted lines visible on painted door/drawer faces.
    const reveal = new THREE.Mesh(
      new THREE.BoxGeometry(faceWidth + 0.018, faceHeight + 0.018, 0.006),
      shadowRevealMaterial,
    );
    reveal.position.set(x, y, z);
    reveal.userData = { cabinetDrawerReveal: true, recessedPhysicalGap: true };
    frontGroup.add(reveal);
  };
  const addFaceShadow = (faceWidth: number, faceHeight: number, x: number, y: number, z = 0.008) => {
    // Keep this backing behind the opaque physical face. Enlarging it beyond
    // the face exposed a 0.144-inch near-black band around every white door
    // and drawer; genuine drawer/door seams remain separately modeled.
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(faceWidth, faceHeight, 0.012), shadowRevealMaterial);
    shadow.position.set(x, y, z);
    shadow.userData = { cabinetFaceShadowGap: true, dimensionalCabinetDetail: true };
    frontGroup.add(shadow);
  };
  const addPull = (faceWidth: number, faceHeight: number, x: number, y: number, drawer = false, z = 0.086, doorZone: "upper" | "lower" = "lower", hingeSide: "left" | "right" | null = null, hardwarePosition = sku.hardwarePosition ?? sku.handleSide ?? "auto") => {
    const selectedHardware = hardwareStyle(surfaceTextures?.hardwareStyleId);
    const piece = drawer ? selectedHardware.drawerPiece : selectedHardware.doorPiece;
    // A design configured as touch-latch/push-to-open must not acquire a default
    // bar pull merely because a cabinet renderer was invoked.
    if (piece === "none") return;
    // A stacked tall pantry has two independent door openings. Its pulls meet
    // at the opening: the upper doors use their lower rails, while lower doors
    // use their upper rails. Do not let the generic tall-cabinet raised-rail
    // convention override those authored pantry door zones.
    const isStackedTallPantryDoor = !drawer
      && sku.placementType === "tall"
      && /pantry/i.test(`${sku.masterCode ?? ""} ${sku.description ?? ""}`);
    // This is an opening rule, not a distributor or finish rule: every tall
    // cabinet's separate top door bank pulls from its bottom/meeting rail. A
    // full-height, single-door tall cabinet remains on the existing raised rail.
    const tallDoorZoneOverridesTopCenter = !drawer
      && sku.placementType === "tall"
      && (doorZone === "upper" || isStackedTallPantryDoor);
    const tallUpperDoorUsesMeetingRail = tallDoorZoneOverridesTopCenter && doorZone === "upper";
    const raisedFloorWallDoorPull = !tallDoorZoneOverridesTopCenter && !drawer && usesRaisedFloorWallDoorPull({
      placement: sku.placementType,
      mountBottom: sku.mountBottom,
      islandFace: sku.islandFace,
      islandCounterHeightWallCabinet: sku.islandCounterHeightWallCabinet,
    });
    const mountedWallDoorUsesBottomRail = !drawer
      && sku.placementType === "wall"
      && !raisedFloorWallDoorPull;
    const effectiveHardwarePosition = (raisedFloorWallDoorPull || tallDoorZoneOverridesTopCenter) && hardwarePosition === "top-center" ? "auto" : hardwarePosition;
    const requestedTopCenteredDoorPull = !drawer && effectiveHardwarePosition === "top-center";
    const horizontalTopRailPull = requestedTopCenteredDoorPull && !raisedFloorWallDoorPull && piece === "pull";
    // Top-center is a construction position, not the center of the panel. For
    // framed doors it belongs on the physical upper rail. The old 34% offset
    // placed a B18 trashcan pull in the recessed center panel.
    const topRailWidth = threeDShakerRailThickness(faceWidth, faceHeight, doorProfile?.railWidth);
    const pullLength = Math.min(Math.max(0.12, ((drawer || horizontalTopRailPull) ? faceWidth : faceHeight) * ((drawer || horizontalTopRailPull) ? 0.48 : 0.28)), (drawer || horizontalTopRailPull) ? 0.62 : 0.86);
    const isKnob = piece === "knob";
    const isCupPull = piece === "cup";
    const pull = new THREE.Mesh(
      isKnob
        ? new THREE.SphereGeometry(0.035, 14, 10)
        : isCupPull
          ? new THREE.CylinderGeometry(0.052, 0.052, Math.min(0.2, pullLength), 14, 1, false, 0, Math.PI)
          : new THREE.BoxGeometry((drawer || horizontalTopRailPull) ? pullLength : 0.022, (drawer || horizontalTopRailPull) ? 0.022 : pullLength, 0.026),
      hardwareMaterial,
    );
    if (isCupPull) pull.rotation.z = Math.PI / 2;
    // Doors swing from their outside edge. Pulls therefore sit vertically at
    // the center meeting edge (opposite hinge). Separate upper door banks use
    // the physical bottom rail: the *lower end* of the handle is 2¾ inches
    // above that rail, rather than positioning the centerline there. That
    // keeps the whole pull inside the door. Lower/pantry doors retain their
    // existing upper-side placement.
    const automaticSide = hingeSide === "left" ? 1 : hingeSide === "right" ? -1 : -Math.sign(x || 1);
    // Drawers are fixed at the horizontal center by CabinetDealz construction
    // rules. Saved hardware choices remain effective only for door pulls.
    const resolvedHardwarePosition = drawer ? "center" : normalizeDoorHardwareFramePosition(effectiveHardwarePosition);
    const topCenteredDoorPull = !drawer && resolvedHardwarePosition === "top-center";
    const explicitSide = horizontalTopRailPull ? 0 : resolvedHardwarePosition === "left" ? -1 : resolvedHardwarePosition === "right" ? 1 : resolvedHardwarePosition === "center" ? 0 : automaticSide;
    const pullX = drawer || horizontalTopRailPull
      ? x
      : x + doorHardwareOffsetFromFaceCenterIn(
        faceWidth / INCH,
        explicitSide < 0 ? "left" : explicitSide > 0 ? "right" : "center",
        profileFrameWidthIn,
      ) * INCH;
    const upperDoorBottomRailClearance = Math.min(2.75 * INCH, Math.max(0, faceHeight - pullLength));
    const upperDoorBottomRailCenter = upperDoorBottomRailClearance + pullLength / 2;
    const pullY = drawer
      ? y
      : raisedFloorWallDoorPull
        ? y + faceHeight * 0.34
        : requestedTopCenteredDoorPull
          ? y + faceHeight / 2 - topRailWidth / 2
      : tallUpperDoorUsesMeetingRail || mountedWallDoorUsesBottomRail
            ? y - faceHeight / 2 + upperDoorBottomRailCenter
            : y + faceHeight * 0.3;
    pull.position.set(pullX, pullY, isKnob ? z + 0.012 : z);
    pull.userData = {
      cabinetHardware: true,
      cabinetPull: isKnob ? "knob" : isCupPull ? "cup-pull" : drawer ? "drawer" : "door",
      hardwareStyleId: selectedHardware.id,
      verticalPull: !isKnob && !drawer && !horizontalTopRailPull,
      pullDoorZone: drawer ? null : doorZone,
      pullVerticalRail: drawer ? null : tallUpperDoorUsesMeetingRail || mountedWallDoorUsesBottomRail ? "bottom" : doorZone === "lower" ? "upper-side" : null,
      pullEdge: raisedFloorWallDoorPull ? "raised-door-rail" : horizontalTopRailPull ? "top-center" : resolvedHardwarePosition === "auto" || resolvedHardwarePosition === "paired" ? (drawer ? "center" : "opposite-hinge") : resolvedHardwarePosition,
      ...(hingeSide ? { hingeSide, handleSide: horizontalTopRailPull ? "top-center" : resolvedHardwarePosition === "auto" || resolvedHardwarePosition === "paired" ? hingeSide === "left" ? "right" : "left" : resolvedHardwarePosition } : { handleSide: horizontalTopRailPull ? "top-center" : resolvedHardwarePosition === "auto" || resolvedHardwarePosition === "paired" ? (automaticSide < 0 ? "left" : "right") : resolvedHardwarePosition }),
      hardwarePosition: resolvedHardwarePosition,
      ...(drawer || explicitSide === 0 ? {} : { frameWidthIn: profileFrameWidthIn, frameCenterInsetIn: profileFrameWidthIn / 2 }),
      dimensionalCabinetDetail: true,
    };
    frontGroup.add(pull);
    if (isKnob) return;
    for (const offset of [-1, 1] as const) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), hardwareMaterial);
      stem.rotation.x = Math.PI / 2;
      stem.position.set((drawer || horizontalTopRailPull) ? pull.position.x + offset * pullLength * 0.34 : pull.position.x, (drawer || horizontalTopRailPull) ? pull.position.y : pull.position.y + offset * pullLength * 0.34, z - 0.018);
      stem.userData = { cabinetHardwareMount: true };
      frontGroup.add(stem);
    }
  };
  const singleDoorHinge: "left" | "right" = sku.swing === "right" ? "right" : "left";
  // BEC24's source description says "Quarter-Octagon". The generic OC oven
  // code matcher otherwise sees the "-Oc" substring and draws an oven door
  // over this square, two-door end cabinet. Keep all actual oven paths intact.
  const isOvenCabinet = !isSquareDoubleDoorBaseEnd(sku) && !isPlacedAppliance && Boolean(sku.ovenType || /(?:^|[-_])(UOC|OC|OVEN)|oven cabinet/i.test(sku.masterCode + " " + (sku.description ?? "")));
  if (specialty.kind === "range-hood-front") {
    const hoodFront = rangeHoodFrontGeometry(widthIn, heightIn, depthIn);
    frontGroup.userData = {
      ...frontGroup.userData,
      specialtyProfile: "range-hood-front",
      sourceCatalogConstruction: "RHF sloped double door + lower fascia",
      noGenericRectangularWallDoors: true,
    };
    const fasciaMaterial = new THREE.MeshPhysicalMaterial({ color: faceColor, map: doorTexture, ...threeDPhysicalSurfaceProfile("cabinet", Boolean(doorTexture)) });
    textureMaterials.push(fasciaMaterial);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(hoodFront.width - 0.06, hoodFront.fasciaHeight, 0.06), fasciaMaterial);
    fascia.position.set(0, -bodyHeight / 2 + hoodFront.fasciaHeight / 2, 0.006);
    fascia.userData = { specialtyProfile: "range-hood-front", rangeHoodFrontLowerFascia: true, cabinetFront: true, flushPhysicalFace: true };
    frontGroup.add(fascia);
    const fasciaRail = new THREE.Mesh(new THREE.BoxGeometry(hoodFront.width + 0.02, 0.045, 0.075), trimMaterial);
    fasciaRail.position.set(0, -bodyHeight / 2 + hoodFront.fasciaHeight + 0.022, 0.038);
    fasciaRail.userData = { specialtyProfile: "range-hood-front", rangeHoodFrontFasciaRail: true, selectedFinishFace: true };
    frontGroup.add(fasciaRail);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(hoodFront.width + 0.055, 0.05, 0.075), trimMaterial);
    cornice.position.set(0, bodyHeight / 2 - 0.025, -hoodFront.rakeDepth + 0.038);
    cornice.userData = { specialtyProfile: "range-hood-front", rangeHoodFrontTopCornice: true, selectedFinishFace: true };
    frontGroup.add(cornice);
    for (const side of [-1, 1] as const) {
      const doorGroup = new THREE.Group();
      const doorX = side * (hoodFront.doorWidth / 2 + 0.012);
      doorGroup.position.set(doorX, -bodyHeight / 2 + hoodFront.fasciaHeight + hoodFront.doorHeight / 2, -hoodFront.rakeDepth / 2);
      doorGroup.rotation.x = hoodFront.doorTiltRadians;
      doorGroup.userData = {
        specialtyProfile: "range-hood-front",
        rangeHoodFrontSlopedDoor: side === -1 ? "left" : "right",
        cabinetFront: true,
        physicalSlopedDoor: true,
      };
      const door = new THREE.Mesh(new THREE.BoxGeometry(hoodFront.doorWidth - 0.028, hoodFront.doorHeight - 0.028, 0.052), faceMaterial);
      door.userData = { specialtyProfile: "range-hood-front", rangeHoodFrontDoorPanel: side === -1 ? "left" : "right", cabinetFront: true, flushPhysicalFace: true };
      doorGroup.add(door);
      const rail = threeDShakerRailThickness(hoodFront.doorWidth, hoodFront.doorHeight, doorProfile?.railWidth);
      const stile = threeDShakerRailThickness(hoodFront.doorWidth, hoodFront.doorHeight, doorProfile?.stileWidth);
      if (rail && stile && threeDUsesPhysicalShakerRails(profileKind, Boolean(doorTexture))) {
        const frameMaterial = new THREE.MeshPhysicalMaterial({ color: faceColor, map: doorTexture, ...threeDPhysicalSurfaceProfile("cabinet", Boolean(doorTexture)) });
        textureMaterials.push(frameMaterial);
        for (const [frameWidth, frameHeight, x, y] of [
          [hoodFront.doorWidth - 0.035, rail, 0, hoodFront.doorHeight / 2 - rail / 2],
          [hoodFront.doorWidth - 0.035, rail, 0, -hoodFront.doorHeight / 2 + rail / 2],
          [stile, hoodFront.doorHeight - rail * 2, -hoodFront.doorWidth / 2 + stile / 2, 0],
          [stile, hoodFront.doorHeight - rail * 2, hoodFront.doorWidth / 2 - stile / 2, 0],
        ] as const) {
          const frame = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, Math.max(0.02, frameHeight), 0.058), frameMaterial);
          frame.position.set(x, y, 0.032);
          frame.userData = { specialtyProfile: "range-hood-front", rangeHoodFrontDoorFrame: true, selectedStyleFace: "shaker", physicalRails: true };
          doorGroup.add(frame);
        }
      }
      frontGroup.add(doorGroup);
    }
  } else if (isWallOpenShelf) {
    frontGroup.userData = {
      ...frontGroup.userData,
      wallOpenShelf: true,
      wallEndOpenShelf: isWallEndOpenShelf,
      noCabinetFronts: true,
      sourceFixedShelfCount: isWallEndOpenShelf
        ? Math.max(1, Math.min(4, Math.round(Number(sku.fixedShelfCount ?? 2) || 2)))
        : kitchenCrestGenericShelfCount
          ?? Math.max(0, Math.min(4, Math.round(Number(sku.fixedShelfCount ?? 0) || 0))),
    };
  } else if (isFloatingShelf) {
    frontGroup.userData = { ...frontGroup.userData, floatingShelf: true, noCabinetFronts: true };
  } else if (isRefrigeratorEndPanel) {
    // Finished refrigerator enclosure panels have no doors, drawers, pulls, or
    // toe kicks. They are plain floor-to-ceiling architectural skins matching
    // the selected cabinet finish on both sides of the refrigerator.
    // The physical panel box above already carries the finish on every face.
    // Do not add a second positive-Z “front” face: an end panel's broad finished
    // surface is its side face, and this extra strip sat in front of the
    // neighboring base (notably 3DB15) in the 3D view.
    frontGroup.userData = {
      ...frontGroup.userData,
      refrigeratorEndPanel: true,
      architecturalPanel: true,
      noCabinetHardware: true,
      selectedFinishFace: true,
    };
  } else if (isPlacedAppliance) {
    const usesCabinetFinishForAppliance = isPanelReadyAppliance && !isRefrigeratorAppliance;
    const applianceMaterial = new THREE.MeshStandardMaterial({
      color: usesCabinetFinishForAppliance ? faceColor : rangeAppearance?.bodyColor ?? "#c7cbd0",
      map: usesCabinetFinishForAppliance ? doorTexture : null,
      roughness: usesCabinetFinishForAppliance ? 0.42 : 0.24,
      metalness: usesCabinetFinishForAppliance ? 0.04 : 0.62,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: "#1f2933", roughness: 0.18, metalness: 0.35 });
    const code = sku.masterCode.toUpperCase();
    if (/HOOD/.test(code)) {
      const hood = rangeHoodGeometry(widthIn, heightIn, depthIn);
      // The tapered canopy intentionally uses 92% of the catalog depth. Anchor
      // that physical rear edge to the saved footprint rear rather than centering
      // the smaller canopy inside the envelope, which leaves a visible wall gap.
      frontGroup.position.z = -(hood.depth - hood.canopyLowerDepth) / 2 - 0.025;
      frontGroup.userData = {
        ...frontGroup.userData,
        fullDepthWallMountedAppliance: true,
        rearPlaneUsesSavedWallFootprint: true,
        physicalCanopyRearFlush: true,
      };
      const canopy = new THREE.Mesh(taperedRangeHoodCanopyGeometry(
        hood.canopyLowerWidth,
        hood.canopyLowerDepth,
        hood.canopyUpperWidth,
        hood.canopyUpperDepth,
        hood.canopyHeight,
      ), applianceMaterial);
      canopy.position.set(0, -bodyHeight / 2 + hood.canopyHeight / 2, 0.025);
      canopy.userData = { applianceCode: sku.masterCode, rangeHoodCanopy: true, pyramidalCanopy: true };
      frontGroup.add(canopy);
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(hood.chimneyWidth, hood.chimneyHeight, hood.chimneyDepth), applianceMaterial);
      chimney.position.set(0, bodyHeight / 2 - hood.chimneyHeight / 2, -hood.depth * 0.13);
      chimney.userData = { applianceCode: sku.masterCode, rangeHoodChimney: true };
      frontGroup.add(chimney);
      const hoodDetailMaterial = new THREE.MeshStandardMaterial({ color: "#5a626b", roughness: 0.24, metalness: 0.76 });
      const hoodFilterMaterial = new THREE.MeshStandardMaterial({ color: "#434b53", roughness: 0.34, metalness: 0.7 });
      const hoodLightMaterial = new THREE.MeshStandardMaterial({ color: "#fff3c4", emissive: "#ffd46b", emissiveIntensity: 1.1, roughness: 0.18 });
      const canopyBottom = -bodyHeight / 2;
      const canopyFront = hood.canopyLowerDepth / 2 + 0.035;
      const controlRail = new THREE.Mesh(new THREE.BoxGeometry(hood.controlRailWidth, 0.055, 0.035), glassMaterial);
      controlRail.position.set(0, canopyBottom + hood.canopyHeight * 0.3, canopyFront);
      controlRail.userData = { applianceCode: sku.masterCode, rangeHoodControlRail: true, dimensionalApplianceDetail: true };
      frontGroup.add(controlRail);
      for (const offset of [-0.32, -0.16, 0, 0.16, 0.32] as const) {
        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 12), hoodDetailMaterial);
        button.rotation.x = Math.PI / 2;
        button.position.set(offset * hood.controlRailWidth, canopyBottom + hood.canopyHeight * 0.3, canopyFront + 0.025);
        button.userData = { applianceCode: sku.masterCode, rangeHoodControl: true, dimensionalApplianceDetail: true };
        frontGroup.add(button);
      }
      for (const side of [-1, 1] as const) {
        const filterX = side * hood.width * 0.18;
        const filter = new THREE.Mesh(new THREE.BoxGeometry(hood.filterWidth, 0.018, hood.filterDepth), hoodFilterMaterial);
        filter.position.set(filterX, canopyBottom + 0.016, 0.025);
        filter.userData = { applianceCode: sku.masterCode, rangeHoodFilter: true, dimensionalApplianceDetail: true };
        frontGroup.add(filter);
        for (const slatOffset of [-0.3, -0.1, 0.1, 0.3] as const) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(hood.filterWidth * 0.82, 0.008, 0.012), hoodDetailMaterial);
          slat.position.set(filterX, canopyBottom + 0.03, slatOffset * hood.filterDepth);
          slat.userData = { applianceCode: sku.masterCode, rangeHoodFilterSlat: true, dimensionalApplianceDetail: true };
          frontGroup.add(slat);
        }
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.016, 18), hoodLightMaterial);
        light.position.set(side * hood.width * 0.32, canopyBottom + 0.02, hood.depth * 0.2);
        light.userData = { applianceCode: sku.masterCode, rangeHoodTaskLight: true, dimensionalApplianceDetail: true };
        frontGroup.add(light);
      }
    } else {
      const dishwasherToeKickHeight = THREE_D_TOE_KICK * INCH;
      const applianceFaceHeight = isFloorDishwasher ? Math.max(0.2, bodyHeight - dishwasherToeKickHeight) : bodyHeight - 0.06;
      const applianceFace = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.06, applianceFaceHeight, 0.05), applianceMaterial);
      if (isFloorDishwasher) applianceFace.position.y = dishwasherToeKickHeight / 2;
      if (isFloorDishwasher) applianceFace.userData = { applianceCode: sku.masterCode, dishwasherFlushFace: true, floorApplianceFace: true };
      frontGroup.add(applianceFace);
      const rangeLayout = isFreestandingRange ? rangeOvenFrontLayout(bodyHeight) : null;
      if (/FRIDGE/.test(code)) {
        const upperHeight = Math.max(0.2, bodyHeight * 0.72);
        const freezerHeight = Math.max(0.16, bodyHeight - upperHeight - 0.1);
        const refrigeratorDoorWidth = (bodyWidth - 0.1) / 2;
        const applianceHandleMaterial = new THREE.MeshStandardMaterial({ color: "#20262c", roughness: 0.2, metalness: 0.82 });
        for (const side of [-1, 1] as const) {
          const refrigeratorDoor = new THREE.Mesh(new THREE.BoxGeometry(refrigeratorDoorWidth - 0.025, upperHeight, 0.064), applianceMaterial);
          refrigeratorDoor.position.set(side * refrigeratorDoorWidth * 0.5, bodyHeight / 2 - upperHeight / 2 - 0.035, 0.042);
          refrigeratorDoor.userData = { applianceCode: sku.masterCode, refrigeratorDoor: side === -1 ? "left" : "right", applianceFront: true };
          frontGroup.add(refrigeratorDoor);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.042, upperHeight * 0.72, 0.052), applianceHandleMaterial);
          handle.position.set(side * refrigeratorDoorWidth * 0.13, refrigeratorDoor.position.y, 0.092);
          handle.userData = { applianceCode: sku.masterCode, refrigeratorHandle: side === -1 ? "left" : "right", dimensionalApplianceDetail: true };
          frontGroup.add(handle);
        }
        const freezer = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.1, freezerHeight, 0.064), applianceMaterial);
        freezer.position.set(0, -bodyHeight / 2 + freezerHeight / 2 + 0.03, 0.042);
        freezer.userData = { applianceCode: sku.masterCode, refrigeratorFreezer: true, applianceFront: true, ...(isPanelReadyAppliance ? { panelReadyFinish: true } : {}) };
        frontGroup.add(freezer);
        const freezerHandle = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.6, 0.038, 0.05), applianceHandleMaterial);
        freezerHandle.position.set(0, freezer.position.y + freezerHeight * 0.12, 0.093);
        freezerHandle.userData = { applianceCode: sku.masterCode, refrigeratorFreezerHandle: true, dimensionalApplianceDetail: true };
        frontGroup.add(freezerHandle);
        const dispenser = new THREE.Mesh(new THREE.BoxGeometry(refrigeratorDoorWidth * 0.33, upperHeight * 0.22, 0.03), glassMaterial);
        dispenser.position.set(-refrigeratorDoorWidth * 0.5, bodyHeight / 2 - upperHeight * 0.6, 0.088);
        dispenser.userData = { applianceCode: sku.masterCode, refrigeratorDispenser: true, dimensionalApplianceDetail: true };
        frontGroup.add(dispenser);
        const refrigeratorVent = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.52, 0.028, 0.042), applianceHandleMaterial);
        refrigeratorVent.position.set(0, bodyHeight / 2 - 0.045, 0.084);
        refrigeratorVent.userData = { applianceCode: sku.masterCode, refrigeratorTopVent: true, dimensionalApplianceDetail: true };
        frontGroup.add(refrigeratorVent);
        for (const side of [-1, 1] as const) {
          const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.06), applianceHandleMaterial);
          hinge.position.set(side * (bodyWidth * 0.32), bodyHeight / 2 - 0.055, 0.078);
          hinge.userData = { applianceCode: sku.masterCode, refrigeratorHingeCap: side === -1 ? "left" : "right", dimensionalApplianceDetail: true };
          frontGroup.add(hinge);
        }
        const refrigeratorFootMaterial = new THREE.MeshStandardMaterial({ color: "#161a1e", roughness: 0.48, metalness: 0.56 });
        for (const side of [-1, 1] as const) {
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.12), refrigeratorFootMaterial);
          foot.position.set(side * (bodyWidth / 2 - 0.12), -bodyHeight / 2 + 0.038, bodyDepth / 2 - 0.1);
          foot.userData = { applianceCode: sku.masterCode, refrigeratorFoot: side === -1 ? "left" : "right", dimensionalApplianceDetail: true };
          cabinet.add(foot);
        }
      } else {
        const openingH = rangeLayout?.openingHeight ?? (isFloorDishwasher
          ? Math.max(0.2, bodyHeight - dishwasherToeKickHeight - 0.22)
          : /SINK/.test(code) ? bodyHeight * 0.56 : bodyHeight * 0.62);
        const openingWidth = isFloorDishwasher ? Math.max(0.2, bodyWidth - 0.14) : bodyWidth * 0.68;
        const opening = new THREE.Mesh(new THREE.BoxGeometry(openingWidth, openingH, 0.064), glassMaterial);
        opening.position.y = rangeLayout?.openingCenterY ?? (isFloorDishwasher ? dishwasherToeKickHeight / 2 : /RANGE|DW|WINE|MW/.test(code) ? -bodyHeight * 0.03 : bodyHeight * 0.04);
        opening.userData = { applianceCode: sku.masterCode, applianceOpening: true, ...(isPanelReadyAppliance ? { panelReadyFinish: true } : {}), ...(isFloorDishwasher ? { dishwasherOpening: true, dishwasherOpeningWidthIn: openingWidth / INCH } : {}) };
        frontGroup.add(opening);
        const isMicrowaveAppliance = /(?:^|[-_])MW|MICROWAVE/.test(code);
        const isOvenAppliance = !isMicrowaveAppliance && /(?:^|[-_])OVEN|SINGLE[-_]?OVEN|DOUBLE[-_]?OVEN/.test(code);
        if (isMicrowaveAppliance || isOvenAppliance) {
          const applianceTrimMaterial = new THREE.MeshStandardMaterial({ color: "#3d444c", roughness: 0.28, metalness: 0.7 });
          const bezelDepth = 0.04;
          const bezelWidth = Math.min(0.08, openingWidth * 0.09);
          const bezelHeight = Math.min(0.08, openingH * 0.1);
          const bezelParts = [
            [openingWidth + bezelWidth * 2, bezelHeight, 0, opening.position.y + openingH / 2 + bezelHeight / 2],
            [openingWidth + bezelWidth * 2, bezelHeight, 0, opening.position.y - openingH / 2 - bezelHeight / 2],
            [bezelWidth, openingH, -openingWidth / 2 - bezelWidth / 2, opening.position.y],
            [bezelWidth, openingH, openingWidth / 2 + bezelWidth / 2, opening.position.y],
          ] as const;
          for (const [bezelW, bezelH, bezelX, bezelY] of bezelParts) {
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(bezelW, bezelH, bezelDepth), applianceTrimMaterial);
            bezel.position.set(bezelX, bezelY, 0.095);
            bezel.userData = { applianceCode: sku.masterCode, applianceBezel: isMicrowaveAppliance ? "microwave" : "oven", dimensionalApplianceDetail: true };
            frontGroup.add(bezel);
          }
          const display = new THREE.Mesh(new THREE.BoxGeometry(openingWidth * 0.32, Math.min(0.05, openingH * 0.12), 0.018), new THREE.MeshStandardMaterial({ color: "#111920", roughness: 0.18, metalness: 0.38 }));
          display.position.set(0, opening.position.y + openingH / 2 + bezelHeight * 0.55, 0.122);
          display.userData = { applianceCode: sku.masterCode, applianceDisplay: isMicrowaveAppliance ? "microwave" : "oven", dimensionalApplianceDetail: true };
          frontGroup.add(display);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(openingWidth * (isMicrowaveAppliance ? 0.42 : 0.62), 0.03, 0.052), applianceTrimMaterial);
          handle.position.set(0, opening.position.y + openingH * 0.3, 0.118);
          handle.userData = { applianceCode: sku.masterCode, applianceDoorHandle: isMicrowaveAppliance ? "microwave" : "oven", dimensionalApplianceDetail: true };
          frontGroup.add(handle);
        }
        if (isFloorDishwasher) {
          const dishwasherDetailMaterial = new THREE.MeshStandardMaterial({ color: "#4a5158", roughness: 0.24, metalness: 0.72 });
          const controlStrip = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.14, 0.075, 0.032), dishwasherDetailMaterial);
          controlStrip.position.set(0, bodyHeight / 2 - 0.055, 0.083);
          controlStrip.userData = { applianceCode: sku.masterCode, dishwasherControlStrip: true, dimensionalApplianceDetail: true };
          frontGroup.add(controlStrip);
          const dishwasherHandle = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.62, 0.032, 0.052), dishwasherDetailMaterial);
          dishwasherHandle.position.set(0, bodyHeight / 2 - 0.14, 0.09);
          dishwasherHandle.userData = { applianceCode: sku.masterCode, dishwasherHandle: true, dimensionalApplianceDetail: true };
          frontGroup.add(dishwasherHandle);
          for (let index = 0; index < 4; index++) {
            const button = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.016, 0.018), new THREE.MeshStandardMaterial({ color: "#171c21", roughness: 0.34, metalness: 0.4 }));
            button.position.set(-bodyWidth * 0.14 + index * bodyWidth * 0.09, bodyHeight / 2 - 0.055, 0.106);
            button.userData = { applianceCode: sku.masterCode, dishwasherControlButton: index + 1, dimensionalApplianceDetail: true };
            frontGroup.add(button);
          }
          const dishwasherDoorReveal = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.2, 0.018, 0.02), dishwasherDetailMaterial);
          dishwasherDoorReveal.position.set(0, bodyHeight * 0.05, 0.083);
          dishwasherDoorReveal.userData = { applianceCode: sku.masterCode, dishwasherDoorReveal: true, dimensionalApplianceDetail: true };
          frontGroup.add(dishwasherDoorReveal);
        }
      }
      if (rangeLayout) {
        const storageDrawer = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.8, rangeLayout.drawerHeight, 0.066), applianceMaterial);
        storageDrawer.position.set(0, rangeLayout.drawerCenterY, 0.038);
        storageDrawer.userData = { applianceCode: sku.masterCode, rangeStorageDrawer: true };
        frontGroup.add(storageDrawer);
        const cooktop = rangeCooktopLayout(bodyWidth, bodyDepth, bodyHeight, bottom, rangeAppearance?.controlPosition ?? "rear");
        const rangeProfile = freestandingRangeHeightProfile(bottom, bodyHeight);
        const cooktopSurface = new THREE.Mesh(
          new THREE.BoxGeometry(cooktop.cooktopWidth, cooktop.cooktopThickness, cooktop.cooktopDepth),
          new THREE.MeshStandardMaterial({ color: "#20262d", roughness: 0.2, metalness: 0.48 }),
        );
        cooktopSurface.position.set(0, cooktop.topY, 0);
        cooktopSurface.userData = { applianceCode: sku.masterCode, rangeCooktop: true, rangeControlPosition: cooktop.controlPosition, ...(cooktop.flatFrontControlTop ? { rangeFrontControlFlatCooktop: true } : {}) };
        cabinet.add(cooktopSurface);
        for (const burnerCenter of cooktop.burnerCenters) {
          const burner = new THREE.Mesh(
            new THREE.CylinderGeometry(cooktop.burnerRadius, cooktop.burnerRadius, 0.026, 24),
            new THREE.MeshStandardMaterial({ color: "#11151a", roughness: 0.25, metalness: 0.58 }),
          );
          burner.position.set(burnerCenter.x, cooktop.cookingSurfaceY + 0.013, burnerCenter.z);
          burner.userData = { applianceCode: sku.masterCode, rangeBurner: true, rangeFuel: rangeAppearance?.fuel ?? "electric", rangeCooktopStyle: rangeAppearance?.cooktopStyle ?? "electric-glass" };
          cabinet.add(burner);
          if (rangeAppearance?.cooktopStyle === "gas-grate") {
            for (const rotation of [0, Math.PI / 2]) {
              const grate = new THREE.Mesh(
                new THREE.BoxGeometry(cooktop.burnerRadius * 1.75, 0.018, 0.026),
                new THREE.MeshStandardMaterial({ color: "#14191e", roughness: 0.34, metalness: 0.56 }),
              );
              grate.rotation.y = rotation;
              grate.position.set(burnerCenter.x, cooktop.cookingSurfaceY + 0.034, burnerCenter.z);
              grate.userData = { applianceCode: sku.masterCode, rangeGasGrate: true, dimensionalApplianceDetail: true };
              cabinet.add(grate);
            }
          }
        }
        const frontControlRange = rangeAppearance?.controlPosition === "front";
        if (rangeAppearance?.backPanel !== "none") {
          // A rear-control freestanding range keeps its control panel on a
          // backguard above the shared 34½-inch cooktop line.
          const backguard = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.76, rangeProfile.backguardHeight, 0.075),
            new THREE.MeshStandardMaterial({ color: "#242a31", roughness: 0.3, metalness: 0.62 }),
          );
          backguard.position.set(0, rangeProfile.backguardTopY - rangeProfile.backguardHeight / 2, -bodyDepth * 0.28);
          backguard.userData = { applianceCode: sku.masterCode, rangeBackguard: true, rangeBackguardTopIn: rangeProfile.backguardTopIn, rangeControlPosition: "rear" };
          cabinet.add(backguard);
          const controls = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.56, Math.min(0.13, rangeProfile.backguardHeight * 0.22), 0.026),
            new THREE.MeshStandardMaterial({ color: rangeAppearance?.controlColor ?? "#0c1015", roughness: 0.24, metalness: 0.54 }),
          );
          controls.position.set(0, rangeProfile.backguardTopY - rangeProfile.backguardHeight * 0.38, -bodyDepth * 0.28 + 0.052);
          controls.userData = { applianceCode: sku.masterCode, rangeBackguardControlPanel: true, rangeControlPosition: "rear" };
          cabinet.add(controls);
          const display = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.18, 0.045, 0.016),
            new THREE.MeshStandardMaterial({ color: "#101923", roughness: 0.2, metalness: 0.38 }),
          );
          display.position.set(0, rangeProfile.backguardTopY - rangeProfile.backguardHeight * 0.25, -bodyDepth * 0.28 + 0.095);
          display.userData = { applianceCode: sku.masterCode, rangeRearControlDisplay: true, rangeControlPosition: "rear", dimensionalApplianceDetail: true };
          cabinet.add(display);
        } else {
          const controls = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.76, 0.12, 0.052),
            new THREE.MeshStandardMaterial({ color: rangeAppearance?.controlColor ?? "#0c1015", roughness: 0.24, metalness: 0.54 }),
          );
          controls.position.set(0, bodyHeight / 2 - 0.105, 0.088);
          controls.userData = { applianceCode: sku.masterCode, rangeFrontControlPanel: true, rangeControlPosition: "front" };
          frontGroup.add(controls);
          const display = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.16, 0.045, 0.016),
            new THREE.MeshStandardMaterial({ color: "#101923", roughness: 0.2, metalness: 0.38 }),
          );
          display.position.set(0, bodyHeight / 2 - 0.09, 0.121);
          display.userData = { applianceCode: sku.masterCode, rangeFrontControlDisplay: true, rangeControlPosition: "front", dimensionalApplianceDetail: true };
          frontGroup.add(display);
        }
        const knobMaterial = new THREE.MeshStandardMaterial({ color: "#d8dce0", roughness: 0.18, metalness: 0.86 });
        const gasRange = rangeAppearance?.fuel === "gas";
        const controlCount = rangeAppearance?.controlCount ?? (gasRange ? 5 : 4);
        const controlRadius = gasRange ? 0.033 : 0.027;
        for (let index = 0; index < controlCount; index++) {
          const knob = new THREE.Mesh(new THREE.CylinderGeometry(controlRadius, controlRadius, 0.026, 16), knobMaterial);
          knob.rotation.x = Math.PI / 2;
          knob.position.set(-bodyWidth * 0.28 + index * bodyWidth * (controlCount === 5 ? 0.14 : 0.186), bodyHeight / 2 - 0.105, 0.087);
          knob.userData = { applianceCode: sku.masterCode, rangeControlKnob: index + 1, rangeControlType: gasRange ? "gas-knob" : "electric-control", rangeControlPosition: frontControlRange ? "front" : "rear", dimensionalApplianceDetail: true };
          frontGroup.add(knob);
        }
        const ovenHandle = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.62, 0.038, 0.052), knobMaterial);
        ovenHandle.position.set(0, rangeLayout.openingCenterY + rangeLayout.openingHeight * 0.34, 0.093);
        ovenHandle.userData = { applianceCode: sku.masterCode, rangeOvenHandle: true, dimensionalApplianceDetail: true };
        frontGroup.add(ovenHandle);

        // A merged island countertop can be the closest visible raycast result
        // near a range opening. Give each range its own non-rendering envelope so
        // clicks anywhere on the stove resolve to its saved placement identity.
        const selectionHitbox = new THREE.Mesh(
          new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
        );
        selectionHitbox.userData = {
          applianceRangeSelectionHitbox: true,
          cabinetFront: true,
          selectionOnly: true,
        };
        cabinet.add(selectionHitbox);
      }
      const control = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.76, Math.min(0.08, bodyHeight * 0.12), 0.066), new THREE.MeshStandardMaterial({ color: rangeAppearance?.controlColor ?? "#3b4147", roughness: 0.3, metalness: 0.45 }));
      control.position.y = bodyHeight / 2 - Math.min(0.1, bodyHeight * 0.14);
      frontGroup.add(control);
    }

    // Range catalog photos are not orthographic product fronts and visibly
    // conflict with the modeled cooktop, knobs, oven glass, handle, feet, and
    // backguard. Ranges therefore use the single measured procedural assembly;
    // product imagery remains available for other appliance types.
    const originalVisualUrl = isFreestandingRange ? null : threeDApplianceFrontVisualUrl(sku);
    if (originalVisualUrl) {
      // Vitest builds the deterministic mesh graph without a DOM. Preserve the
      // front plane and its selected-image contract there, while only requesting
      // the browser image texture in a real WebGL document context.
      const originalTexture = typeof document === "undefined"
        ? null
        : new THREE.TextureLoader().load(originalVisualUrl);
      if (originalTexture) {
        originalTexture.colorSpace = THREE.SRGBColorSpace;
        originalTexture.minFilter = THREE.LinearFilter;
      }
      const rangeFootClearance = isFreestandingRange ? Math.min(0.12, bodyHeight * 0.06) : 0;
      const originalFront = new THREE.Mesh(
        new THREE.PlaneGeometry(
          Math.max(0.12, bodyWidth - 0.035),
          Math.max(0.12, bodyHeight - 0.035 - rangeFootClearance),
        ),
        new THREE.MeshBasicMaterial({ map: originalTexture, transparent: true, alphaTest: 0.02, side: THREE.FrontSide, depthWrite: false }),
      );
      // frontGroup already sits at the true front plane. This small offset shows
      // the original product visual without changing envelope or placement.
      originalFront.position.set(0, rangeFootClearance / 2, 0.085);
      originalFront.userData = {
        applianceCode: sku.masterCode,
        originalProductVisual: true,
        originalProductVisualUrl: originalVisualUrl,
        ...(isFreestandingRange ? { freestandingRangeProductVisual: true, rangeFootClearanceIn: rangeFootClearance / INCH } : {}),
        catalogEnvelope: { widthIn, heightIn, depthIn, mountBottomIn: bottom, rotation },
      };
      frontGroup.add(originalFront);
    }
  } else if (isOvenCabinet) {
    // An oven cabinet is a finished tall enclosure. Its door zone, appliance
    // cut-out, and each drawer row are taken from the saved 2D configuration.
    const surround = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.06, bodyHeight - 0.06, 0.045), faceMaterial);
    frontGroup.add(surround);
    const ovenLayout = resolvedThreeDOvenLayout({
      height: sku.height,
      description: sku.description,
      numberOfDoors: sku.numberOfDoors,
      numberOfDrawers: sku.numberOfDrawers,
      doorHeight: sku.doorHeight,
      drawerHeight: sku.drawerHeight,
      drawerLayout: sku.drawerLayout,
      openingType: sku.openingType,
      ovenType: sku.ovenType,
      sourceOvenDrawerLayout: sku.sourceOvenDrawerLayout,
    });
    const applianceMaterial = new THREE.MeshStandardMaterial({ color: "#c7cbd0", roughness: 0.24, metalness: 0.62 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: "#1f2933", roughness: 0.18, metalness: 0.35 });
    let zoneTop = bodyHeight / 2 - 0.04;
    const addDoors = (height: number) => {
      if (!height || !ovenLayout.doorCount) return;
      const doorWidth = (bodyWidth - 0.08) / ovenLayout.doorCount;
      for (let i = 0; i < ovenLayout.doorCount; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.03, Math.max(0.08, height - 0.025), 0.052), faceMaterial);
        door.position.set(-bodyWidth / 2 + 0.04 + doorWidth * (i + 0.5), zoneTop - height / 2, 0.035);
        door.userData = { cabinetFront: true, ovenCabinetDoor: true, flushPhysicalFace: true };
        frontGroup.add(door);
        addShakerFrame(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y, 0.066);
        addFaceShadow(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y);
        addPull(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y, false, 0.086, "upper", i === 0 ? "left" : "right");
      }
      zoneTop -= height;
    };
    const addSingleOvenFiller = () => {
      if (sku.ovenType !== "single") return;
      const fillerHeight = 3 * INCH;
      const filler = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.06, fillerHeight, 0.048), bodyMaterial);
      filler.position.set(0, zoneTop - fillerHeight / 2, 0.032);
      filler.userData = { ovenTowerFiller: true, fillerHeightIn: 3, selectedFinishSideSkin: true };
      frontGroup.add(filler);
      zoneTop -= fillerHeight;
    };
    const addDrawers = () => {
      for (const row of ovenLayout.drawerRows) {
        const drawerWidth = (bodyWidth - 0.08) / row.count;
        for (let column = 0; column < row.count; column++) {
          const drawer = new THREE.Mesh(new THREE.BoxGeometry(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), 0.052), faceMaterial);
          drawer.position.set(-bodyWidth / 2 + 0.04 + drawerWidth * (column + 0.5), zoneTop - row.height / 2, 0.035);
          drawer.userData = { cabinetFront: true, cabinetDrawerFront: true, ovenCabinetDrawer: true, flushPhysicalFace: true };
          frontGroup.add(drawer);
          addDrawerReveal(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y);
          addShakerFrame(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y, 0.066);
          addFaceShadow(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y);
          addPull(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y, true);
        }
        zoneTop -= row.height;
      }
    };
    const addOvenCutout = () => {
      const ovenOpeningWidth = ovenOpeningGeometry(bodyWidth / INCH, sku.ovenType).width * INCH;
      const oven = new THREE.Mesh(new THREE.BoxGeometry(ovenOpeningWidth, ovenLayout.openingHeight, 0.07), applianceMaterial);
      oven.position.set(0, zoneTop - ovenLayout.openingHeight / 2, 0.032);
      oven.userData = { ovenOpeningWidthIn: ovenOpeningWidth / INCH, singleOvenInsetIn: ovenOpeningGeometry(bodyWidth / INCH, sku.ovenType).horizontalInset };
      frontGroup.add(oven);
      const ovenUnitHeight = ovenLayout.openingHeight / ovenLayout.ovenCount;
      for (let i = 0; i < ovenLayout.ovenCount; i++) {
        const unitCenterY = zoneTop - ovenUnitHeight * (i + 0.5);
        const applianceDoor = new THREE.Mesh(new THREE.BoxGeometry(ovenOpeningWidth - 0.045, Math.max(0.08, ovenUnitHeight - 0.03), 0.038), applianceMaterial);
        applianceDoor.position.set(0, unitCenterY, 0.07);
        applianceDoor.userData = { ovenCabinetApplianceDoor: true, ovenUnit: i + 1, ovenUnitCount: ovenLayout.ovenCount };
        frontGroup.add(applianceDoor);
        const controlBand = new THREE.Mesh(new THREE.BoxGeometry(ovenOpeningWidth * 0.84, Math.min(0.06, ovenUnitHeight * 0.13), 0.052), new THREE.MeshStandardMaterial({ color: "#4b535b", roughness: 0.28, metalness: 0.58 }));
        controlBand.position.set(0, unitCenterY + ovenUnitHeight * 0.34, 0.094);
        controlBand.userData = { ovenControlBand: true, ovenUnit: i + 1 };
        frontGroup.add(controlBand);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(ovenOpeningWidth * 0.74, Math.max(0.08, ovenUnitHeight * 0.48), 0.078), glassMaterial);
        glass.position.set(0, unitCenterY - ovenUnitHeight * 0.055, 0.102);
        glass.userData = { ovenGlassDoor: true, ovenUnit: i + 1, ovenUnitCount: ovenLayout.ovenCount };
        frontGroup.add(glass);
        const ovenHandle = new THREE.Mesh(new THREE.BoxGeometry(ovenOpeningWidth * 0.62, 0.026, 0.03), hardwareMaterial);
        ovenHandle.position.set(0, unitCenterY - ovenUnitHeight * 0.32, 0.132);
        ovenHandle.userData = { ovenDoorHandle: true, ovenUnit: i + 1, ovenUnitCount: ovenLayout.ovenCount };
        frontGroup.add(ovenHandle);
      }
      zoneTop -= ovenLayout.openingHeight;
    };
    if (sku.ovenType === "single") {
      addDoors(ovenLayout.doorZone);
      addSingleOvenFiller();
      addOvenCutout();
      addDrawers();
    } else if (ovenLayout.openingPosition === "top") {
      addOvenCutout();
      addDoors(ovenLayout.doorZone);
      addDrawers();
    } else if (ovenLayout.openingPosition === "bottom") {
      addDoors(ovenLayout.doorZone);
      addDrawers();
      addOvenCutout();
    } else {
      addDoors(ovenLayout.doorZone);
      addOvenCutout();
      addDrawers();
    }
  } else if (isTall && !pantryLayout && /pantry/i.test(`${sku.masterCode} ${sku.description ?? ""}`)) {
    // A two-door pantry is one tall lower door plus one upper door. Wider pantry
    // models, or records explicitly configured with four doors, retain paired
    // leaves in both the upper and lower openings.
    const lowerDoorHeight = Math.min(bodyHeight - 0.1, 54 * INCH);
    const upperDoorHeight = Math.max(0.2, bodyHeight - lowerDoorHeight - 0.1);
    const doorsPerRow = threeDTallPantryDoorsPerRow(sku);
    const addPantryRow = (height: number, centerY: number, row: "lower" | "upper") => {
      const doorWidth = (bodyWidth - 0.08) / doorsPerRow;
      for (let i = 0; i < doorsPerRow; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.03, Math.max(0.08, height - 0.025), 0.052), faceMaterial);
        door.position.set(-bodyWidth / 2 + 0.04 + doorWidth * (i + 0.5), centerY, 0.035);
        door.userData = { cabinetFront: true, pantryDoorSet: row, pantryDoorsPerRow: doorsPerRow, flushPhysicalFace: true };
        frontGroup.add(door);
        addShakerFrame(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y, 0.066);
        addFaceShadow(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y);
        addPull(doorWidth - 0.03, Math.max(0.08, height - 0.025), door.position.x, door.position.y, false, 0.086, row, doorsPerRow === 1 ? singleDoorHinge : null);
      }
    };
    addPantryRow(lowerDoorHeight, -bodyHeight / 2 + 0.05 + lowerDoorHeight / 2, "lower");
    addPantryRow(upperDoorHeight, bodyHeight / 2 - 0.05 - upperDoorHeight / 2, "upper");
  } else if (specialty.kind === "diagonal-corner") {
    // Match the 2D diagonal corner: a square corner body with two center-meeting
    // doors on the actual 45-degree clipped front—not in the center plane of the
    // square body. Keeping these faces on the diagonal is particularly important
    // for LS3612: a centered pair makes a correct 36×36 Lazy Susan look like an
    // ordinary rectangular base from the mobile orbit camera.
    const diagonalWidth = angledWallProfile
      ? triangleCornerFrontWidth(bodyWidth, bodyDepth)
      : diagonalCornerFrontWidth(bodyWidth, bodyDepth);
    const diagonalDoorCount = angledWallProfile
      ? 1
      : sku.numberOfDoors != null && sku.numberOfDoors > 0
        ? Math.min(2, Math.max(1, Math.round(sku.numberOfDoors)))
        : 2;
    const diagonalDoorWidth = diagonalWidth / diagonalDoorCount;
    const diagonalDoorHeight = Math.max(0.2, bodyHeight - 0.1);
    const angledWallFace = angledWallProfile ? triangleCornerFrontPose(bodyWidth, bodyDepth) : null;
    const diagonalFaceCenterX = angledWallFace?.x ?? bodyWidth / 4;
    const diagonalFaceCenterZ = angledWallFace?.z ?? bodyDepth / 4;
    const diagonalFaceNormal = angledWallProfile ? 0 : Math.SQRT1_2 * 0.045;
    const tangentOffset = diagonalDoorWidth / 2;
    const directions = diagonalDoorCount === 1 ? [0] : [-1, 1];
    for (const direction of directions) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(diagonalDoorWidth - 0.03, diagonalDoorHeight, 0.052),
        sku.glassDoor ? glassDoorMaterial : faceMaterial,
      );
      door.position.set(
        diagonalFaceCenterX + direction * Math.SQRT1_2 * tangentOffset + diagonalFaceNormal,
        0,
        diagonalFaceCenterZ - direction * Math.SQRT1_2 * tangentOffset + diagonalFaceNormal,
      );
      door.rotation.y = angledWallFace?.rotation ?? Math.PI / 4;
      door.userData = angledWallProfile
        ? { specialtyProfile: "angled-wall", angledWallDoor: true, flushPhysicalFace: true, cabinetFront: true }
        : { specialtyProfile: "diagonal-corner", diagonalDoor: direction === -1 ? "left" : "right", cabinetFront: true, flushPhysicalFace: true };
      if (sku.glassDoor) {
        door.userData = { ...door.userData, glassCabinetDoor: true, linkedGlassDoorAddon: true };
      }
      frontGroup.add(door);
      addShakerFrame(
        diagonalDoorWidth - 0.03,
        diagonalDoorHeight,
        door.position.x + (angledWallFace?.normalX ?? 0) * 0.034,
        door.position.y,
        door.position.z + (angledWallFace?.normalZ ?? 1) * 0.034,
        door.rotation.y,
	      Boolean(sku.glassDoor),
      );
      if (diagonalDoorCount === 1) {
        const pullLength = Math.min(Math.max(0.12, diagonalDoorHeight * 0.28), 0.86);
        const normalX = Math.sin(door.rotation.y);
        const normalZ = Math.cos(door.rotation.y);
        const hardwarePosition = normalizeDoorHardwareFramePosition(sku.hardwarePosition ?? sku.handleSide ?? "auto");
        const handleSide = hardwarePosition === "left" ? -1 : hardwarePosition === "right" ? 1 : sku.swing === "right" ? -1 : 1;
        const faceWidth = diagonalDoorWidth - 0.03;
        const pullOffset = doorHardwareOffsetFromFaceCenterIn(
          faceWidth / INCH,
          handleSide < 0 ? "left" : handleSide > 0 ? "right" : "center",
          profileFrameWidthIn,
        ) * INCH;
        const tangentX = Math.cos(door.rotation.y);
        const tangentZ = -Math.sin(door.rotation.y);
        const pull = new THREE.Mesh(new THREE.BoxGeometry(0.022, pullLength, 0.026), hardwareMaterial);
        pull.position.set(
          door.position.x + tangentX * pullOffset + normalX * 0.058,
          door.position.y - diagonalDoorHeight * 0.3,
          door.position.z + tangentZ * pullOffset + normalZ * 0.058,
        );
        pull.rotation.y = door.rotation.y;
        pull.userData = { cabinetHardware: true, cabinetPull: "door", diagonalDoorPull: true, verticalPull: true, pullEdge: hardwarePosition === "auto" || hardwarePosition === "paired" ? "opposite-hinge" : hardwarePosition, hingeSide: singleDoorHinge, handleSide: hardwarePosition === "auto" || hardwarePosition === "paired" ? singleDoorHinge === "left" ? "right" : "left" : hardwarePosition, hardwarePosition, frameWidthIn: profileFrameWidthIn, frameCenterInsetIn: profileFrameWidthIn / 2, dimensionalCabinetDetail: true };
        frontGroup.add(pull);
        for (const offset of [-1, 1] as const) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), hardwareMaterial);
          stem.rotation.set(Math.PI / 2, door.rotation.y, 0);
          stem.position.set(pull.position.x, pull.position.y + offset * pullLength * 0.34, pull.position.z - 0.018);
          stem.userData = { cabinetHardwareMount: true, diagonalDoorPullMount: true };
          frontGroup.add(stem);
        }
      }
    }
    if (sku.glassDoor) {
	      const shelfCount = Math.max(0, Math.min(4, Math.round(sku.adjustableShelfCount ?? 0)));
	      const shelfDepth = Math.max(0.08, bodyDepth * 0.28);
	      const shelfNormalX = angledWallFace?.normalX ?? Math.SQRT1_2;
	      const shelfNormalZ = angledWallFace?.normalZ ?? Math.SQRT1_2;
	      const shelfRecess = shelfDepth / 2 + 0.065;
	      for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
	        const shelf = new THREE.Mesh(
	          new THREE.BoxGeometry(Math.max(0.08, diagonalWidth * 0.72), 0.024, shelfDepth),
	          new THREE.MeshStandardMaterial({ color: "#d5c7ad", roughness: 0.62, metalness: 0.01 }),
	        );
	        shelf.position.set(
	          diagonalFaceCenterX - shelfNormalX * shelfRecess,
	          -diagonalDoorHeight / 2 + (diagonalDoorHeight * (shelfIndex + 1)) / (shelfCount + 1),
	          diagonalFaceCenterZ - shelfNormalZ * shelfRecess,
	        );
        shelf.rotation.y = angledWallFace?.rotation ?? Math.PI / 4;
        shelf.userData = { visibleThroughGlassDoor: true, diagonalGlassShelf: shelfIndex + 1 };
        frontGroup.add(shelf);
      }
    }
  } else if (specialty.kind === "triangle-corner") {
    // A WTC/BTC and the AW1230 angled-wall profile use the true triangular
    // hypotenuse: its full diagonal is the angled
    // front, not the shorter clipped face used by a diagonal wall corner.
    const triangleWidth = triangleCornerFrontWidth(bodyWidth, bodyDepth);
    const triangleDoorWidth = triangleWidth / 2;
    const triangleDoorHeight = Math.max(0.2, bodyHeight - 0.1);
    const triangleFace = triangleCornerFrontPose(bodyWidth, bodyDepth);
    const tangentOffset = triangleDoorWidth / 2;
    for (const direction of [-1, 1] as const) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(triangleDoorWidth - 0.03, triangleDoorHeight, 0.052), faceMaterial);
      door.position.set(
        triangleFace.x + direction * Math.SQRT1_2 * tangentOffset,
        0,
        triangleFace.z + direction * Math.SQRT1_2 * tangentOffset,
      );
      door.rotation.y = triangleFace.rotation;
      door.userData = { specialtyProfile: "triangle-corner", triangleDoor: direction === -1 ? "left" : "right", cabinetFront: true, flushPhysicalFace: true };
      frontGroup.add(door);
      addShakerFrame(
        triangleDoorWidth - 0.03,
        triangleDoorHeight,
        door.position.x + triangleFace.normalX * 0.034,
        door.position.y,
        door.position.z + triangleFace.normalZ * 0.034,
        door.rotation.y,
      );
    }
  } else if (specialty.kind === "l-corner") {
    // Preserve the restored 2D Lazy Susan L-outline: each door sits on one
    // exposed 12-inch leg, rather than introducing a diagonal front in 3D.
    const lShape = lCornerCarcassParts(bodyWidth, bodyDepth, lCornerLegRatio);
    const faceHeight = Math.max(0.2, bodyHeight - 0.1);
    const exposedFrontWidth = Math.max(0.2, bodyWidth - lShape.sideLeg.width);
    const backFrontZ = lShape.backLeg.z + lShape.backLeg.depth / 2 + 0.03;
    const backDoor = new THREE.Mesh(new THREE.BoxGeometry(exposedFrontWidth - 0.09, faceHeight, 0.052), faceMaterial);
    backDoor.position.set(bodyWidth / 2 - exposedFrontWidth / 2, 0, backFrontZ);
    backDoor.userData = { specialtyProfile: "l-corner", lCornerDoor: "back-leg", cabinetFront: true, flushPhysicalFace: true };
    frontGroup.add(backDoor);
    addShakerFrame(exposedFrontWidth - 0.09, faceHeight, backDoor.position.x, backDoor.position.y, backDoor.position.z + 0.034);

    const sideFrontX = lShape.sideLeg.x + lShape.sideLeg.width / 2 + 0.03;
    const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(lShape.sideLeg.depth - 0.09, faceHeight, 0.052), faceMaterial);
    sideDoor.position.set(sideFrontX, 0, lShape.sideLeg.z);
    sideDoor.rotation.y = Math.PI / 2;
    sideDoor.userData = { specialtyProfile: "l-corner", lCornerDoor: "side-leg", cabinetFront: true, flushPhysicalFace: true };
    frontGroup.add(sideDoor);
    addShakerFrame(lShape.sideLeg.depth - 0.09, faceHeight, sideDoor.position.x + 0.034, sideDoor.position.y, sideDoor.position.z, sideDoor.rotation.y);

    // LSB/ERB/BER base corners and WER wall easy-reach corners retain their two
    // physical face planes while the selected swing designates the operative
    // opening edge. Place one pull on that room-facing door, laterally opposite
    // its hinge.
	    const code = sku.masterCode.toUpperCase();
	    const hingeSelectableCorner =
	      (placement === "base" && (/^(?:LSB?|ERB|BER)[-_]?\d/.test(code) || /lazy\s*susan|easy\s*reach/i.test(sku.description ?? "")))
	      || (placement === "wall" && (/^WER[-_]?\d/.test(code) || /wall\s+easy\s+reach/i.test(sku.description ?? "")));
	    // Keep specialty corner doors on the same explicit hardware contract as
	    // ordinary doors. Older LSB/ERB geometry created its own pull here and
	    // bypassed the selected "None" setting, leaving one stray handle while
	    // every other cabinet correctly stayed push-to-open.
	    const cornerDoorPiece = hardwareStyle(surfaceTextures?.hardwareStyleId).doorPiece;
	    if (hingeSelectableCorner && cornerDoorPiece !== "none") {
      const hingeSide = sku.swing === "right" ? "right" as const : "left" as const;
      const hardwarePosition = normalizeDoorHardwareFramePosition(sku.hardwarePosition ?? sku.handleSide ?? "auto");
      const pullLength = Math.min(Math.max(0.12, faceHeight * 0.28), 0.86);
      // Base lazy-Susan pulls sit at the upper opening edge of their operative
      // door, unlike the lower-centered pull used on ordinary base doors.
    const raisedFloorWallCornerDoorPull = placement === "wall" && usesRaisedFloorWallDoorPull({
      placement: sku.placementType,
      mountBottom: sku.mountBottom,
      islandFace: sku.islandFace,
      islandCounterHeightWallCabinet: sku.islandCounterHeightWallCabinet,
    });
    const upperOpeningPullY = faceHeight / 2 - pullLength / 2 - 0.08;
    // Normal wall cabinets use the lower door rail for an ergonomic reach from
    // below. The only exception is wall cabinetry intentionally seated at the
    // floor/toe-kick datum, which follows the existing raised-pull convention.
    const bottomDoorRailClearance = Math.min(2.75 * INCH, Math.max(0, faceHeight - pullLength));
    const bottomDoorRailPullY = -faceHeight / 2 + bottomDoorRailClearance + pullLength / 2;
    const cornerDoorPullY = placement === "wall" && !raisedFloorWallCornerDoorPull
      ? bottomDoorRailPullY
      : upperOpeningPullY;
      const targets = hardwarePosition === "paired"
        ? [backDoor, sideDoor]
        : [hingeSide === "left" ? backDoor : sideDoor];
      for (const targetDoor of targets) {
        const targetWidth = targetDoor === backDoor ? exposedFrontWidth - 0.09 : lShape.sideLeg.depth - 0.09;
        const automaticSide = targetDoor === backDoor ? 1 : -1;
        const offset = hardwarePosition === "left" ? -1 : hardwarePosition === "right" ? 1 : automaticSide;
        const pullOffset = doorHardwareOffsetFromFaceCenterIn(
          targetWidth / INCH,
          offset < 0 ? "left" : offset > 0 ? "right" : "center",
          profileFrameWidthIn,
        ) * INCH;
        const pull = new THREE.Mesh(new THREE.BoxGeometry(0.022, pullLength, 0.026), hardwareMaterial);
        if (targetDoor === backDoor) {
          pull.position.set(backDoor.position.x + pullOffset, cornerDoorPullY, backDoor.position.z + 0.066);
        } else {
          pull.position.set(sideDoor.position.x + 0.066, cornerDoorPullY, sideDoor.position.z - pullOffset);
          pull.rotation.y = Math.PI / 2;
        }
        pull.userData = { cabinetHardware: true, cabinetPull: "door", lCornerHingeOppositePull: hardwarePosition === "auto" || hardwarePosition === "paired", verticalPull: true, pullEdge: raisedFloorWallCornerDoorPull ? "raised-door-rail" : hardwarePosition === "auto" || hardwarePosition === "paired" ? "opposite-hinge" : hardwarePosition, pullHeight: placement === "wall" && !raisedFloorWallCornerDoorPull ? "bottom-door-rail" : "upper-opening-edge", pullVerticalRail: placement === "wall" && !raisedFloorWallCornerDoorPull ? "bottom" : null, hingeSide, handleSide: hardwarePosition === "auto" || hardwarePosition === "paired" ? hingeSide === "left" ? "right" : "left" : hardwarePosition, hardwarePosition, frameWidthIn: profileFrameWidthIn, frameCenterInsetIn: profileFrameWidthIn / 2, dimensionalCabinetDetail: true };
        frontGroup.add(pull);
      }
    }
  } else if (specialty.kind === "corner-drawer") {
    // CDB36 retains its 36-by-36 plan footprint while its front exactly follows
    // the 2D Corner Drawer Base elevation: an 8% corner marker and a full-height
    // 92% stack of measured drawer rows—not a 24-inch blank panel plus a strip.
    const { cornerMarkerWidth, drawerStackWidth } = cornerDrawerFrontLayout(bodyWidth);
    const cornerMarker = new THREE.Mesh(
      new THREE.BoxGeometry(cornerMarkerWidth - 0.01, bodyHeight - 0.08, 0.045),
      trimMaterial,
    );
    cornerMarker.position.set(-bodyWidth / 2 + cornerMarkerWidth / 2 + 0.01, 0, 0.03);
    cornerMarker.userData = { specialtyProfile: "corner-drawer", cornerDrawerIndicator: true };
    frontGroup.add(cornerMarker);
    const rows = resolvedThreeDDrawerRows(sku, bodyHeight - 0.1, Math.max(1, drawerCount || 3));
    let rowTop = bodyHeight / 2 - 0.05;
    for (const row of rows) {
      const drawerWidth = drawerStackWidth / row.count;
      for (let column = 0; column < row.count; column++) {
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), 0.052), faceMaterial);
        drawer.position.set(-bodyWidth / 2 + cornerMarkerWidth + drawerWidth * (column + 0.5), rowTop - row.height / 2, 0.035);
        drawer.userData = { specialtyProfile: "corner-drawer", cornerDrawerFace: true, cabinetFront: true, cabinetDrawerFront: true, flushPhysicalFace: true };
        frontGroup.add(drawer);
        addDrawerReveal(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y);
        addShakerFrame(drawerWidth - 0.025, Math.max(0.08, row.height - 0.025), drawer.position.x, drawer.position.y, 0.066);
      }
      rowTop -= row.height;
    }
  } else if (specialty.kind === "end-return") {
    // BEC / BA has two full-height door planes fixed directly to the two
    // perpendicular exterior sides of the 24×24 body.
    const attachedFronts = baseEndAttachedFrontLayout(bodyWidth, bodyDepth);
    const faceHeight = Math.max(0.2, bodyHeight - 0.1);
    for (const face of attachedFronts.faces) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(attachedFronts.doorWidth, faceHeight, 0.05), faceMaterial);
      door.position.set(face.x, 0, face.z);
      door.rotation.y = face.rotation;
      door.userData = {
        specialtyProfile: "end-return",
        nonCornerEndReturnDoor: face.side,
        attachedEndFront: true,
        doorWidthIn: attachedFronts.doorWidth / INCH,
        referenceFaceSideIn: attachedFronts.sideLength / INCH,
        sharedExteriorApex: attachedFronts.apex,
        exteriorFaceRotation: face.rotation,
        flushPhysicalFace: true,
        cabinetFront: true,
      };
      frontGroup.add(door);
      const frameNormalX = Math.sin(door.rotation.y) * 0.031;
      const frameNormalZ = Math.cos(door.rotation.y) * 0.031;
      addShakerFrame(attachedFronts.doorWidth - 0.03, faceHeight, door.position.x + frameNormalX, door.position.y, door.position.z + frameNormalZ, door.rotation.y);
    }
			  } else if (specialty.kind === "blind-corner") {
				    const wallBlind = isWallBlindCornerCabinet(sku);
				    const layout = threeDBlindCornerFrontLayout(
				      bodyWidth,
				      wallBlind ? "right" : sku.swing === "left" ? "left" : "right",
				      sku.openingWidth,
			    );
			    const faceHeight = Math.max(0.2, bodyHeight - 0.1);
			    const integratedFillerWidth = wallBlind
			      ? Math.min(BLIND_CORNER_FILLER_WIDTH_IN * INCH, Math.max(0, layout.blindWidth - 0.08))
			      : 0;
			    const visibleBlindWidth = Math.max(0.08, layout.blindWidth - integratedFillerWidth);
		    const blindPanel = new THREE.Mesh(
		      new THREE.BoxGeometry(Math.max(0.08, visibleBlindWidth - 0.04), faceHeight, 0.038),
		      trimMaterial,
		    );
		    blindPanel.position.set(layout.blindX - integratedFillerWidth / 2, 0, 0);
	    blindPanel.userData = {
	      specialtyProfile: "blind-corner",
	      blindCornerBlindSide: layout.blindSide,
	      blindCornerFixedPanel: true,
	      cabinetFront: true,
		    };
		    frontGroup.add(blindPanel);
			    if (integratedFillerWidth > 0) {
			      const filler = new THREE.Mesh(
			        new THREE.BoxGeometry(integratedFillerWidth - 0.015, faceHeight, 0.046),
			        bodyMaterial,
			      );
			      filler.position.set(layout.doorX - layout.doorWidth / 2 - integratedFillerWidth / 2, 0, 0.012);
			      filler.userData = {
			        specialtyProfile: "blind-corner",
			        wallBlindCornerIntegratedFiller: true,
			        integratedCatalogFillerWidthIn: BLIND_CORNER_FILLER_WIDTH_IN,
			        immediatelyLeftOfDoor: true,
			        selectedFinishStructuralSurface: true,
			        cabinetFront: true,
			      };
			      frontGroup.add(filler);
			    }
		    const drawerFaceHeight = drawerCount > 0 ? Math.min(faceHeight * 0.24, 6 * INCH) : 0;
		    const doorFaceHeight = Math.max(0.2, faceHeight - drawerFaceHeight);
		    const door = new THREE.Mesh(
		      new THREE.BoxGeometry(Math.max(0.08, layout.doorWidth - 0.06), doorFaceHeight - 0.025, 0.052),
		      faceMaterial,
		    );
		    door.position.set(layout.doorX, -drawerFaceHeight / 2, 0.008);
	    door.userData = {
	      specialtyProfile: "blind-corner",
	      blindCornerDoorSide: layout.doorSide,
	      blindCornerExposedDoor: true,
	      cabinetFront: true,
	      flushPhysicalFace: true,
		    };
		    frontGroup.add(door);
		    addFaceShadow(layout.doorWidth - 0.06, doorFaceHeight - 0.025, door.position.x, door.position.y);
		    addShakerFrame(layout.doorWidth - 0.06, doorFaceHeight - 0.025, door.position.x, door.position.y);
		    addPull(layout.doorWidth - 0.06, doorFaceHeight - 0.025, door.position.x, door.position.y, false, 0.086, placement === "wall" ? "upper" : "lower", layout.doorSide);
		    if (drawerFaceHeight > 0) {
		      const drawer = new THREE.Mesh(
		        new THREE.BoxGeometry(Math.max(0.08, layout.doorWidth - 0.06), drawerFaceHeight - 0.025, 0.052),
		        faceMaterial,
		      );
		      drawer.position.set(layout.doorX, faceHeight / 2 - drawerFaceHeight / 2, 0.008);
		      drawer.userData = {
		        specialtyProfile: "blind-corner",
		        blindCornerExposedDrawer: true,
		        blindCornerDoorSide: layout.doorSide,
		        cabinetFront: true,
		        cabinetDrawerFront: true,
		      };
		      frontGroup.add(drawer);
		      addFaceShadow(layout.doorWidth - 0.06, drawerFaceHeight - 0.025, drawer.position.x, drawer.position.y);
		      addShakerFrame(layout.doorWidth - 0.06, drawerFaceHeight - 0.025, drawer.position.x, drawer.position.y);
		      addPull(layout.doorWidth - 0.06, drawerFaceHeight - 0.025, drawer.position.x, drawer.position.y, true, 0.086, placement === "wall" ? "upper" : "lower");
		    }
	  } else if (specialty.kind === "farmhouse-sink") {
    // FSB farmhouse bases carry their apron on the positive-Z local face. The
    // cabinet's resolved wall transform keeps that feature facing the room.
    //
    // A real FSB has NO top rail and NO false drawer front: the sink's apron
    // slab fills an open cutout at the TOP of the face and TWO DOORS fill the
    // lower face beneath it (see client/src/lib/farmhouseSinkBaseFace.ts). The
    // earlier front drew the apron mid-face, a false drawer front above it and
    // doors BESIDE it, which is why this base always looked wrong.
    const farmhouseFace = farmhouseSinkBaseFaceLayout(widthIn, bodyHeight / INCH, doorCount);
    const apronWidth = Math.max(0.3, farmhouseFace.apronWidthIn * INCH);
    const apronHeight = Math.max(0.22, farmhouseFace.apronZoneIn * INCH);
    const carcassTopY = bodyHeight / 2;
    const apronBottomY = carcassTopY - apronHeight;
    // An empty FSB needs a neutral built-in placeholder. Once a cabinet-owned,
    // source-verified Pelican sink is selected, its measured countertop basin,
    // visible apron, and selected faucet are rendered separately below. Keeping
    // both creates the 3D/2D mismatch by drawing two sinks on one base.
    if (!surfaceTextures?.suppressFarmhouseSinkPlaceholder) {
      const apronDepth = 0.066;
      const apron = new THREE.Mesh(
        new THREE.BoxGeometry(apronWidth, apronHeight, apronDepth),
        new THREE.MeshStandardMaterial({ color: "#ece9e1", roughness: 0.34, metalness: 0.04 }),
      );
      // The apron hangs from the top of the face and stands a hair proud of the
      // door slabs (about 3/8"), never recessed behind them.
      apron.position.set(0, carcassTopY - apronHeight / 2, 0.052 - apronDepth / 2);
      apron.userData = { specialtyProfile: "farmhouse-sink", farmhouseApronFront: true, cabinetFront: true };
      frontGroup.add(apron);
      const basinMaterial = new THREE.MeshStandardMaterial({ color: "#d5d8d9", roughness: 0.22, metalness: 0.62 });
      const basin = new THREE.Mesh(new THREE.BoxGeometry(apronWidth * 0.82, 0.055, Math.max(0.22, bodyDepth * 0.46)), basinMaterial);
      basin.position.set(0, bodyHeight / 2 + 0.016, bodyDepth * 0.08);
      basin.userData = { specialtyProfile: "farmhouse-sink", farmhouseSinkBasin: true, dimensionalApplianceDetail: true };
      cabinet.add(basin);
      const faucetMaterial = new THREE.MeshStandardMaterial({ color: "#9fa5aa", roughness: 0.16, metalness: 0.88 });
      const faucetPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, bodyHeight * 0.16, 14), faucetMaterial);
      faucetPost.position.set(0, bodyHeight / 2 + bodyHeight * 0.08, -bodyDepth * 0.12);
      faucetPost.userData = { specialtyProfile: "farmhouse-sink", farmhouseSinkFaucetPost: true, dimensionalApplianceDetail: true };
      cabinet.add(faucetPost);
      const faucetSpout = new THREE.Mesh(new THREE.TorusGeometry(bodyDepth * 0.11, 0.018, 8, 18, Math.PI), faucetMaterial);
      faucetSpout.rotation.x = Math.PI / 2;
      faucetSpout.position.set(0, bodyHeight / 2 + bodyHeight * 0.15, -bodyDepth * 0.015);
      faucetSpout.userData = { specialtyProfile: "farmhouse-sink", farmhouseSinkFaucetSpout: true, dimensionalApplianceDetail: true };
      cabinet.add(faucetSpout);
    }
    // Two doors (one on a very narrow base) below the apron, down to the toe
    // kick, separated from the apron by the standard 1/8" reveal.
    const farmhouseDoorTopY = apronBottomY - THREE_D_CABINET_FRONT_CENTER_GAP_IN * INCH;
    const farmhouseDoorBottomY = -bodyHeight / 2 + 0.04;
    const farmhouseDoorHeight = Math.max(0.2, farmhouseDoorTopY - farmhouseDoorBottomY);
    const farmhouseDoorCenterY = farmhouseDoorBottomY + farmhouseDoorHeight / 2;
    const farmhouseDoorColumns = threeDCabinetFrontColumnLayout(bodyWidth, farmhouseFace.doorCount);
    for (let index = 0; index < farmhouseFace.doorCount; index++) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(farmhouseDoorColumns.columnWidth, farmhouseDoorHeight, 0.045),
        faceMaterial,
      );
      door.position.set(farmhouseDoorColumns.centerX(index), farmhouseDoorCenterY, 0);
      door.userData = {
        specialtyProfile: "farmhouse-sink",
        farmhouseBaseDoor: index + 1,
        cabinetFront: true,
        flushPhysicalFace: true,
      };
      frontGroup.add(door);
      addFaceShadow(farmhouseDoorColumns.columnWidth, farmhouseDoorHeight, door.position.x, door.position.y);
      if (profileKind === "shaker" || profileKind === "raised" || doorProfile?.panelConstruction === "raised") {
        addShakerFrame(farmhouseDoorColumns.columnWidth, farmhouseDoorHeight, door.position.x, door.position.y);
      }
      addPull(
        farmhouseDoorColumns.columnWidth, farmhouseDoorHeight, door.position.x, door.position.y,
        false, 0.086, "lower", farmhouseFace.doorCount === 1 ? singleDoorHinge : null,
      );
    }
  } else if (specialty.kind === "face-pattern") {
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth - 0.1, bodyHeight - 0.1, 0.03),
      new THREE.MeshStandardMaterial({ color: "#382e26", roughness: 0.7 }),
    );
    recess.position.z = 0.018;
    recess.userData = { specialtyProfile: "face-pattern", pattern: specialty.pattern };
    frontGroup.add(recess);
    const barMaterial = new THREE.MeshStandardMaterial({ color: faceColor, map: doorTexture, roughness: 0.42 });
    const barCount = specialty.pattern === "slats" ? 5 : 4;
    for (let index = 0; index < barCount; index++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.055, bodyHeight - 0.14, 0.058), barMaterial);
      bar.position.set(-bodyWidth / 2 + 0.09 + (bodyWidth - 0.18) * (index / Math.max(1, barCount - 1)), 0, 0.052);
      if (specialty.pattern === "lattice" || specialty.pattern === "criss-cross") bar.rotation.z = index % 2 ? Math.PI / 4 : -Math.PI / 4;
      frontGroup.add(bar);
    }
  } else {
  const vanityComboFaceLayout = resolvedVanityComboFaceLayout(sku);
  const vanityFaceLayout = resolvedThreeDVanityFaceLayout(sku.layoutSpec);
  if (vanityComboFaceLayout) {
    // VDDB48 is a sourced 48-inch vanity combo: three drawers on each side,
    // two centered lower doors, and one long drawer front above the doors.
    // Keep this explicit by master SKU so VDB48 does not inherit the combo.
    const faceHeight = bodyHeight - 0.08;
    const centerFaceWidth = Math.max(0.2, bodyWidth * (23.5 / 48));
    const sideFaceWidth = Math.max(0.2, (bodyWidth - centerFaceWidth - 0.08) / 2);
    const longDrawerHeight = Math.min(6 * INCH, faceHeight * 0.22);
    const lowerFaceHeight = Math.max(0.2, faceHeight - longDrawerHeight);
    const sideDrawerHeight = lowerFaceHeight / vanityComboFaceLayout.sideDrawerCount;
    const centerDoorWidth = (centerFaceWidth - 0.025) / vanityComboFaceLayout.centerDoorCount;
    const centerX = 0;
    const leftSideX = -bodyWidth / 2 + sideFaceWidth / 2 + 0.04;
    const rightSideX = bodyWidth / 2 - sideFaceWidth / 2 - 0.04;
    const lowerTop = -faceHeight / 2 + lowerFaceHeight;
    const longDrawer = new THREE.Mesh(new THREE.BoxGeometry(centerFaceWidth, longDrawerHeight - 0.025, 0.048), faceMaterial);
    longDrawer.position.set(centerX, bodyHeight / 2 - 0.04 - longDrawerHeight / 2, 0.004);
    longDrawer.userData = { cabinetFront: true, cabinetDrawerFront: true, vanityComboLongDrawerFront: true, flushPhysicalFace: true };
    frontGroup.add(longDrawer);
    addDrawerReveal(centerFaceWidth, longDrawerHeight - 0.025, longDrawer.position.x, longDrawer.position.y);
    addShakerFrame(centerFaceWidth, longDrawerHeight - 0.025, longDrawer.position.x, longDrawer.position.y);
    addFaceShadow(centerFaceWidth, longDrawerHeight - 0.025, longDrawer.position.x, longDrawer.position.y);
    addPull(centerFaceWidth, longDrawerHeight - 0.025, longDrawer.position.x, longDrawer.position.y, true);

    for (const side of [-1, 1] as const) {
      const sideX = side === -1 ? leftSideX : rightSideX;
      for (let index = 0; index < vanityComboFaceLayout.sideDrawerCount; index++) {
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(sideFaceWidth, sideDrawerHeight - 0.025, 0.048), faceMaterial);
        drawer.position.set(sideX, lowerTop - sideDrawerHeight * (index + 0.5), 0.004);
        drawer.userData = { cabinetFront: true, cabinetDrawerFront: true, vanityComboSide: side === -1 ? "left" : "right", vanityDrawerFront: true, flushPhysicalFace: true };
        frontGroup.add(drawer);
        addDrawerReveal(sideFaceWidth, sideDrawerHeight - 0.025, drawer.position.x, drawer.position.y);
        addShakerFrame(sideFaceWidth, sideDrawerHeight - 0.025, drawer.position.x, drawer.position.y);
        addFaceShadow(sideFaceWidth, sideDrawerHeight - 0.025, drawer.position.x, drawer.position.y);
        addPull(sideFaceWidth, sideDrawerHeight - 0.025, drawer.position.x, drawer.position.y, true);
      }
    }

    for (let index = 0; index < vanityComboFaceLayout.centerDoorCount; index++) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(centerDoorWidth, lowerFaceHeight - 0.025, 0.045), faceMaterial);
      door.position.set(-centerFaceWidth / 2 + centerDoorWidth * (index + 0.5), -faceHeight / 2 + lowerFaceHeight / 2, 0);
      door.userData = { cabinetFront: true, vanityComboCenterDoor: index + 1, flushPhysicalFace: true };
      frontGroup.add(door);
      if (profileKind === "shaker") addShakerFrame(centerDoorWidth, lowerFaceHeight - 0.025, door.position.x, door.position.y);
      addFaceShadow(centerDoorWidth, lowerFaceHeight - 0.025, door.position.x, door.position.y);
      addPull(centerDoorWidth, lowerFaceHeight - 0.025, door.position.x, door.position.y, false, 0.086, "lower", index === 0 ? "right" : "left");
    }
  } else if (vanityFaceLayout) {
    const availableWidth = bodyWidth - 0.08;
    const drawerBankWidth = availableWidth * vanityFaceLayout.drawerBankRatio;
    const doorWidth = availableWidth - drawerBankWidth;
    const drawerX = vanityFaceLayout.drawerSide === 'left'
      ? -bodyWidth / 2 + 0.04 + drawerBankWidth / 2
      : bodyWidth / 2 - 0.04 - drawerBankWidth / 2;
    const doorX = vanityFaceLayout.drawerSide === 'left'
      ? bodyWidth / 2 - 0.04 - doorWidth / 2
      : -bodyWidth / 2 + 0.04 + doorWidth / 2;
    const faceHeight = bodyHeight - 0.08;
    const drawerHeight = faceHeight / vanityFaceLayout.drawerCount;
    for (let index = 0; index < vanityFaceLayout.drawerCount; index++) {
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(drawerBankWidth - 0.025, drawerHeight - 0.025, 0.048), faceMaterial);
      drawer.position.set(drawerX, bodyHeight / 2 - 0.04 - drawerHeight * (index + 0.5), 0.004);
      drawer.userData = { cabinetFront: true, cabinetDrawerFront: true, vanityDrawerFront: true, drawerSide: vanityFaceLayout.drawerSide, flushPhysicalFace: true };
      frontGroup.add(drawer);
      addDrawerReveal(drawerBankWidth - 0.025, drawerHeight - 0.025, drawer.position.x, drawer.position.y);
      addShakerFrame(drawerBankWidth - 0.025, drawerHeight - 0.025, drawer.position.x, drawer.position.y);
      addFaceShadow(drawerBankWidth - 0.025, drawerHeight - 0.025, drawer.position.x, drawer.position.y);
      addPull(drawerBankWidth - 0.025, drawerHeight - 0.025, drawer.position.x, drawer.position.y, true);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.03, faceHeight, 0.045), faceMaterial);
    door.position.set(doorX, 0, 0);
    door.userData = { cabinetFront: true, vanityDoorFront: true, drawerSide: vanityFaceLayout.drawerSide, flushPhysicalFace: true };
    frontGroup.add(door);
    if (profileKind === 'shaker') addShakerFrame(doorWidth - 0.03, faceHeight, door.position.x, door.position.y);
    addFaceShadow(doorWidth - 0.03, faceHeight, door.position.x, door.position.y);
    addPull(doorWidth - 0.03, faceHeight, door.position.x, door.position.y, false, 0.086, "lower", singleDoorHinge);
  } else {
		  const standardDoorCenterY = pantryLayout || (hasConfiguredOpening && sku.openingType === "bottom")
		    ? bodyHeight / 2 - 0.04 - doorHeight / 2
		    : -bodyHeight / 2 + 0.04 + doorHeight / 2;
		  const standardDoorZone = placement === "wall" || (placement === "tall" && standardDoorCenterY > 0)
		    ? "upper"
		    : "lower";
		  if (sku.glassDoor && doorCount > 0) {
	    const interior = new THREE.Mesh(
	      new THREE.BoxGeometry(Math.max(0.08, bodyWidth - 0.14), Math.max(0.08, doorHeight - 0.08), 0.018),
	      glassInteriorMaterial,
	    );
	    interior.position.set(0, wd18Layout ? bodyHeight / 2 - 0.04 - doorHeight / 2 : standardDoorCenterY, -0.028);
	    interior.userData = { glassCabinetInterior: true, selectedFinishInterior: true, visibleThroughGlassDoor: true };
	    frontGroup.add(interior);
	    const shelfCount = Math.max(0, Math.min(8, Math.round(sku.adjustableShelfCount ?? 0)));
	    for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
	      const shelf = new THREE.Mesh(
	        new THREE.BoxGeometry(Math.max(0.08, bodyWidth - 0.18), 0.024, 0.04),
	        glassInteriorMaterial,
	      );
	      shelf.position.set(
	        0,
	        interior.position.y - doorHeight / 2 + (doorHeight * (shelfIndex + 1)) / (shelfCount + 1),
	        -0.006,
	      );
	      shelf.userData = { glassCabinetShelf: shelfIndex + 1, visibleThroughGlassDoor: true, selectedFinishInterior: true };
	      frontGroup.add(shelf);
	    }
	  }
	  const standardDoorColumns = threeDCabinetFrontColumnLayout(bodyWidth, doorCount);
	  for (let i = 0; i < doorCount; i++) {
	    const doorWidth = standardDoorColumns.columnWidth;
	    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.045), sku.glassDoor ? glassDoorMaterial : faceMaterial);
	    door.position.set(
	      standardDoorColumns.centerX(i),
	      wd18Layout ? bodyHeight / 2 - 0.04 - doorHeight / 2 : standardDoorCenterY,
	      0,
	    );
	    door.userData = { cabinetFront: true, flushPhysicalFace: true, ...(sku.glassDoor ? { glassCabinetDoor: true, transparentGlassCenter: true } : {}), ...(wd18Layout ? { wd18UpperDoor: true } : {}) };
	    frontGroup.add(door);
	    if (!sku.glassDoor) addFaceShadow(doorWidth, doorHeight, door.position.x, door.position.y);
		    addPull(doorWidth, doorHeight, door.position.x, door.position.y, false, 0.086, standardDoorZone, doorCount === 1 ? singleDoorHinge : null);
	    if (sku.glassDoor || profileKind === "shaker") {
	      addShakerFrame(doorWidth, doorHeight, door.position.x, door.position.y, 0.036, 0, Boolean(sku.glassDoor));
	    } else if (profileKind === "raised" || doorProfile?.panelConstruction === "raised") {
	      addShakerFrame(doorWidth, doorHeight, door.position.x, door.position.y);
	    }
	  }
	  // Preserve the measured 1/8-inch door gap, but add enough contrast for the
	  // two-door wall face to remain legible at the normal 3D camera distance.
	  if (placement === "wall" && doorCount > 1) {
	    for (let i = 1; i < standardDoorColumns.columnCount; i++) {
	      const seam = new THREE.Mesh(
	        new THREE.BoxGeometry(standardDoorColumns.centerGap, doorHeight, 0.012),
	        shadowRevealMaterial,
	      );
	      seam.position.set(
	        standardDoorColumns.centerX(i) - standardDoorColumns.columnWidth / 2 - standardDoorColumns.centerGap / 2,
	        wd18Layout ? bodyHeight / 2 - 0.04 - doorHeight / 2 : standardDoorCenterY,
	        0.058,
	      );
	      seam.userData = { cabinetDoorSeam: true, wallCabinetDoorSeam: true, doorIndex: i - 1 };
	      frontGroup.add(seam);
	    }
	  }
		  const drawerRows = pantryLayout
    ? pantryLayout.rows.map(row => ({ count: row.count, height: row.height * INCH }))
    : wd18Layout
    ? wd18Layout.drawerHeights.map((heightIn) => ({ count: 1, height: heightIn * INCH }))
    : resolvedThreeDDrawerRows(
      sku,
      drawerHeight,
      drawerCount,
      placement === "base" && doorCount === 0 && drawerCount > 1,
    );
  const drawersAtBottom = hasConfiguredOpening || Boolean(wd18Layout);
  // Start at the TOP of the pantry's lower bank, retaining source row order.
  let drawerCursor = pantryLayout
    ? -bodyHeight / 2 + 0.04 + drawerHeight
    : drawersAtBottom ? -bodyHeight / 2 + 0.04 : bodyHeight / 2 - 0.04;
		  for (const row of drawerRows) {
		    const rowHeight = Math.max(0.08, row.height - 0.025);
		    const drawerColumns = threeDCabinetFrontColumnLayout(bodyWidth, row.count);
	    const drawerWidth = drawerColumns.columnWidth;
	    for (let column = 0; column < row.count; column++) {
	      const drawer = new THREE.Mesh(new THREE.BoxGeometry(drawerWidth, rowHeight, 0.048), faceMaterial);
	      const rowY = drawersAtBottom ? drawerCursor + row.height / 2 : drawerCursor - row.height / 2;
	      drawer.position.set(drawerColumns.centerX(column), rowY, 0.004);
	      drawer.userData = { cabinetFront: true, cabinetDrawerFront: true, ...(isStandardSinkBase ? { falseDrawerFront: true } : {}), ...(wd18Layout ? { wd18BottomDrawer: true } : {}), flushPhysicalFace: true };
	      frontGroup.add(drawer);
	      addDrawerReveal(drawerWidth, rowHeight, drawer.position.x, drawer.position.y);
	      addShakerFrame(drawerWidth, rowHeight, drawer.position.x, drawer.position.y);
	      addFaceShadow(drawerWidth, rowHeight, drawer.position.x, drawer.position.y);
      // A standard sink base may have a shallow false front above its doors,
      // but that face is not an operable drawer and must not receive a
      // horizontal handle. Its vertical door pulls remain unchanged above.
	      if (!isStandardSinkBase) addPull(drawerWidth, rowHeight, drawer.position.x, drawer.position.y, true);
    }
    drawerCursor += drawersAtBottom ? row.height : -row.height;
  }
  if (hasConfiguredOpening) {
    const availableOpeningWidth = Math.max(0.2, bodyWidth - 0.11);
    const availableOpeningHeight = Math.max(0.2, usableHeight - drawerHeight - (doorCount > 0 ? doorHeight : 0));
    // Cabinet Config is authoritative: a built-in appliance/opening can be
    // smaller than the surrounding box, never wider or taller than its explicit
    // opening envelope (for example, a 27-by-17 microwave bay).
    const openingWidth = Math.min(
      availableOpeningWidth,
      sku.openingWidth != null ? Math.max(0.2, numberValue(sku.openingWidth, availableOpeningWidth / INCH) * INCH) : availableOpeningWidth,
    );
    const openingHeight = Math.min(
      availableOpeningHeight,
      sku.openingHeight != null ? Math.max(0.2, numberValue(sku.openingHeight, availableOpeningHeight / INCH) * INCH) : availableOpeningHeight,
    );
    const opening = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth, openingHeight - 0.03, 0.052),
      new THREE.MeshStandardMaterial({ color: "#343a43", roughness: 0.5, metalness: 0.2 }),
    );
    const openingCenterY = sku.openingType === "bottom"
      ? -bodyHeight / 2 + 0.04 + openingHeight / 2
      : sku.openingType === "top"
        ? bodyHeight / 2 - 0.04 - openingHeight / 2
        : 0;
    const isWallMicrowave = isEnclosedWallMicrowaveCabinet(sku);
    if (!isWallMicrowave) {
      opening.position.set(0, openingCenterY, 0.006);
      opening.userData = {
        configuredOpening: true,
        openingType: sku.openingType,
        openingWidthIn: openingWidth / INCH,
        openingHeightIn: openingHeight / INCH,
      };
      frontGroup.add(opening);
    } else {
      // The source record owns the cabinet and microwave-bay envelope. Add only
      // an unbranded appliance face within that exact opening—not a substitute
      // cabinet, catalog image, or guessed manufacturer-specific dimensions.
      const microwaveHeight = Math.max(0.16, openingHeight - 0.03);
      const stainlessMaterial = new THREE.MeshPhysicalMaterial({
        color: "#8d969a",
        metalness: 0.86,
        roughness: 0.27,
        clearcoat: 0.12,
        clearcoatRoughness: 0.32,
      });
      const darkGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#11171c",
        metalness: 0.42,
        roughness: 0.16,
        clearcoat: 0.34,
        clearcoatRoughness: 0.16,
      });
      const trimMaterial = new THREE.MeshStandardMaterial({ color: "#313a40", roughness: 0.24, metalness: 0.78 });
      const faceDepth = 0.064;
      const face = new THREE.Mesh(new THREE.BoxGeometry(openingWidth, microwaveHeight, faceDepth), stainlessMaterial);
      face.position.set(0, openingCenterY, 0.012);
      face.userData = {
        configuredOpening: true,
        wallMicrowaveFront: true,
        microwaveFaceKind: "unbranded-stainless",
        openingType: sku.openingType,
        openingWidthIn: openingWidth / INCH,
        openingHeightIn: openingHeight / INCH,
        openingCenterYIn: openingCenterY / INCH,
        seatedInsideConfiguredOpening: true,
      };
      frontGroup.add(face);

      const inset = Math.min(0.075, Math.max(0.035, Math.min(openingWidth, microwaveHeight) * 0.075));
      const controlBandWidth = Math.min(Math.max(0.14, openingWidth * 0.16), Math.max(0.14, openingWidth * 0.26));
      const glassWidth = Math.max(0.12, openingWidth - inset * 2 - controlBandWidth - 0.018);
      const glassHeight = Math.max(0.1, microwaveHeight - inset * 2);
      const glassX = -openingWidth / 2 + inset + glassWidth / 2;
      const controlX = openingWidth / 2 - inset - controlBandWidth / 2;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(glassWidth, glassHeight, 0.018), darkGlassMaterial);
      glass.position.set(glassX, openingCenterY, faceDepth / 2 + 0.024);
      glass.userData = {
        wallMicrowaveGlass: true,
        openingWidthIn: openingWidth / INCH,
        openingHeightIn: openingHeight / INCH,
        seatedInsideConfiguredOpening: true,
      };
      frontGroup.add(glass);

      const controlBand = new THREE.Mesh(new THREE.BoxGeometry(controlBandWidth, glassHeight, 0.024), stainlessMaterial);
      controlBand.position.set(controlX, openingCenterY, faceDepth / 2 + 0.027);
      controlBand.userData = { wallMicrowaveControlBand: true, seatedInsideConfiguredOpening: true };
      frontGroup.add(controlBand);
      const display = new THREE.Mesh(
        new THREE.BoxGeometry(controlBandWidth * 0.62, Math.min(0.05, glassHeight * 0.16), 0.018),
        darkGlassMaterial,
      );
      display.position.set(controlX, openingCenterY + glassHeight * 0.27, faceDepth / 2 + 0.047);
      display.userData = { wallMicrowaveDisplay: true, seatedInsideConfiguredOpening: true };
      frontGroup.add(display);
      for (let index = 0; index < 3; index++) {
        const control = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16), trimMaterial);
        control.rotation.x = Math.PI / 2;
        control.position.set(controlX, openingCenterY + glassHeight * (0.02 - index * 0.2), faceDepth / 2 + 0.05);
        control.userData = { wallMicrowaveControl: true, controlIndex: index, seatedInsideConfiguredOpening: true };
        frontGroup.add(control);
      }
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(glassWidth * 0.58, openingWidth * 0.46), 0.032, 0.058),
        trimMaterial,
      );
      handle.position.set(glassX, openingCenterY + glassHeight * 0.28, faceDepth / 2 + 0.065);
      handle.userData = { wallMicrowaveHandle: true, handleOrientation: "horizontal", seatedInsideConfiguredOpening: true };
      frontGroup.add(handle);
    }
  }
  }
  }
  cabinet.add(frontGroup);
  // Every appliance needs a click target that resolves through its placement
  // root. Standard RANGE records already add a dedicated range envelope below;
  // this additionally covers legacy stove-coded appliances that otherwise only
  // expose decorative child meshes to the raycaster.
  if (isPlacedAppliance && !isFreestandingRange) {
    const selectionHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    selectionHitbox.userData = {
      applianceSelectionHitbox: true,
      cabinetFront: true,
      selectionOnly: true,
    };
    cabinet.add(selectionHitbox);
  }
  for (const bodyMesh of bodyMeshes) {
    // The L corner is built from two overlapping carcass legs. Their individual
    // edge overlays expose the internal construction seam as a false line that
    // projects into the room. The two door frames remain the visible seam.
    if (specialty.kind === "l-corner" || specialty.kind === "end-return") continue;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyMesh.geometry),
      new THREE.LineBasicMaterial({ color: "#332d25", transparent: true, opacity: 0.34 }),
    );
    edges.position.copy(bodyMesh.position);
    cabinet.add(edges);
  }
  const placementIdentity: ThreeDCabinetHit = {
    uid: sku.placementUid ?? null,
    masterCode: sku.masterCode,
    description: sku.description ?? null,
    distributorSkuId: sku.distributorSkuId,
  };
  applyThreeDPlacementIdentity(cabinet, placementIdentity);
  root.add(cabinet);

  if (!surfaceTextures?.suppressCountertop && shouldRenderCountertopOverSceneItem({
    placement: placement as PlacedCabinet["placement"],
    masterCode: sku.masterCode,
    description: sku.description ?? "",
    subCategory: sku.subCategory ?? null,
    category: sku.category ?? null,
    height: Number.isFinite(Number(sku.height)) ? Number(sku.height) : undefined,
    mountBottom: sku.mountBottom ?? null,
    applianceRole: sku.applianceRole ?? null,
    fillerPieceGroupId: sku.fillerPieceGroupId ?? null,
	    fillerTotalWidth: sku.fillerTotalWidth ?? null,
	    fillerPlacementMode: sku.fillerPlacementMode ?? null,
	    islandFace: sku.islandFace ?? null,
	  })) {
		    const countertopTexture = surfaceTextures?.countertop ?? null;
		    const mappedCountertopTexture = threeDTextureForCountertopMesh(countertopTexture, {
		      centerXIn: x,
		      centerZIn: z,
		      localWidthIn: bodyWidth / INCH,
		      localDepthIn: bodyDepth / INCH,
		      rotation,
		      slabWidthIn: Number(countertopTexture?.userData?.physicalWidthIn) || 138,
		      slabDepthIn: Number(countertopTexture?.userData?.physicalDepthIn) || 79,
		    });
		    const counterMaterial = new THREE.MeshPhysicalMaterial({
		      color: mappedCountertopTexture ? "#ffffff" : counterColor,
		      map: mappedCountertopTexture,
		      ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedCountertopTexture)),
		    });
		    counterMaterial.userData = {
		      selectedSurfaceRole: "countertop",
		      usesAuthoritativeProductImage: Boolean(mappedCountertopTexture),
		      worldSlabMapped: Boolean(mappedCountertopTexture?.userData?.worldSlabMapped),
		      materialOnlyNoGeometryChange: true,
		    };
    if (specialty.kind === "corner-drawer" || specialty.kind === "l-corner") {
      const counter = new THREE.Mesh(
        // An LSB/ERB or corner-drawer top follows the cabinet's true L
        // footprint: both wall-side edges flush, and both room-facing fronts
        // carried out by the same finished overhang as the adjoining runs.
        // This is the same outline `lCornerCountertopWorldPolygon` gives the
        // plan/takeoff and the shared `countertopSurfaces` 3D slab, so every
        // render path agrees on one corner-top geometry.
        lCornerCountertopWedgeGeometry(
          bodyWidth,
          bodyDepth,
          1.5 * INCH,
          lCornerLegRatio,
        ),
        counterMaterial,
      );
      counter.position.copy(cabinet.position);
      counter.rotation.y = rotation;
      counter.position.y = countertopCenterY;
      counter.userData = {
        specialtyProfile: specialty.kind,
        lCornerCountertop: true,
        completeLCornerCabinetTop: false,
        exactLCornerCountertopGeometry: true,
        coversCompleteCabinetTop: false,
        interiorNotchPreserved: true,
        frontOverhangIn: COUNTERTOP_FRONT_OVERHANG / INCH,
        wallSideReturnsFlush: true,
      };
      applyThreeDPlacementIdentity(counter, placementIdentity);
      root.add(counter);
    } else if (specialty.kind === "end-return") {
      const diagram = baseEndAttachedFrontLayout(bodyWidth, bodyDepth);
      const countertopSideLength = threeDCountertopDepthIn(diagram.sideLength / INCH) * INCH;
      const counter = new THREE.Mesh(
        baseEndDiagramGeometry(countertopSideLength, 1.5 * INCH),
        counterMaterial,
      );
      counter.position.copy(cabinet.position);
      counter.rotation.y = rotation;
      counter.position.y = countertopCenterY;
      counter.userData = {
        countertopDepthIn: threeDCountertopDepthIn(bodyDepth / INCH),
        endReturnCountertop: true,
        nonCornerEndReturnCountertop: true,
        diagramDefinedRearApexCountertop: true,
      };
      applyThreeDPlacementIdentity(counter, placementIdentity);
      root.add(counter);
    } else if (specialty.kind === "diagonal-corner") {
      const counter = new THREE.Mesh(
        diagonalCornerWedgeGeometry(
          bodyWidth,
          bodyDepth,
          1.5 * INCH,
          COUNTERTOP_FRONT_OVERHANG,
        ),
        counterMaterial,
      );
      counter.position.copy(cabinet.position);
      counter.rotation.y = rotation;
      counter.position.y = countertopCenterY;
      counter.userData = {
        diagonalCornerCountertop: true,
        exactDiagonalCornerGeometry: true,
        cornerFaceAngleDegrees: 45,
        frontOverhangIn: COUNTERTOP_FRONT_OVERHANG / INCH,
        wallSideReturnsFlush: true,
        // The two wall-side returns remain separate physical slab joins with
        // adjoining runs. They are intentional 45° miter seams, suitable for
        // an epoxy-filled field joint—not a fake overlapping or gap-filled top.
        epoxyMiterSeamAngleDegrees: 45,
        epoxyMiterSeamCompatible: true,
      };
      applyThreeDPlacementIdentity(counter, placementIdentity);
      root.add(counter);
    } else if (specialty.kind === "triangle-corner") {
      const counter = new THREE.Mesh(
        triangleCornerWedgeGeometry(bodyWidth + 0.12, bodyDepth + 0.12, 1.5 * INCH),
        counterMaterial,
      );
      counter.position.copy(cabinet.position);
      counter.rotation.y = rotation;
      counter.position.y = countertopCenterY;
      counter.userData = { triangleCornerCountertop: true };
      applyThreeDPlacementIdentity(counter, placementIdentity);
      root.add(counter);
    } else {
      const rearExtensionIn = Math.max(0, Number(sku.countertopRearExtensionIn) || 0);
      const countertopDepthIn = threeDSceneCountertopDepthIn(sku, bodyDepth / INCH) + rearExtensionIn;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, 1.5 * INCH, countertopDepthIn * INCH), counterMaterial);
      counter.position.copy(cabinet.position);
      counter.rotation.y = rotation;
      counter.translateZ((COUNTERTOP_FRONT_OVERHANG - rearExtensionIn * INCH) / 2);
      counter.position.y = countertopCenterY;
      counter.userData = {
        countertopDepthIn,
        ...(rearExtensionIn > 0 ? { countertopRearExtensionIn: rearExtensionIn, bridgesBlindCornerToWall: true } : {}),
        ...(sku.fillerPieceGroupId ? { installedFillerCountertop: true } : {}),
      };
      if (specialty.kind === "blind-corner") counter.userData = { ...counter.userData, blindCornerCountertop: true };
      if (isFloorDishwasher) counter.userData = { ...counter.userData, dishwasherCountertopSupport: true, floorApplianceSupport: true };
      applyThreeDPlacementIdentity(counter, placementIdentity);
      root.add(counter);

	    }
	  }

	  // Island tops are assembled as merged spans elsewhere, so they are excluded
	  // from the normal per-cabinet countertop branch above. Waterfall end panels
	  // are cabinet-owned and must therefore be built independently for every
	  // selected base, including an island end.
	  const waterfallSides: Array<-1 | 1> = placement === "base"
	    ? [sku.waterfallLeft ? -1 : null, sku.waterfallRight ? 1 : null].filter((side): side is -1 | 1 => side !== null)
	    : [];
	  if (waterfallSides.length > 0) {
	    const countertopTexture = surfaceTextures?.countertop ?? null;
	    const mappedCountertopTexture = threeDTextureForCountertopMesh(countertopTexture, {
	      centerXIn: x,
	      centerZIn: z,
	      localWidthIn: bodyWidth / INCH,
	      localDepthIn: bodyDepth / INCH,
	      rotation,
	      slabWidthIn: Number(countertopTexture?.userData?.physicalWidthIn) || 138,
	      slabDepthIn: Number(countertopTexture?.userData?.physicalDepthIn) || 79,
	    });
	    const waterfallMaterial = new THREE.MeshPhysicalMaterial({
	      color: mappedCountertopTexture ? "#ffffff" : counterColor,
	      map: mappedCountertopTexture,
	      ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedCountertopTexture)),
	    });
	    const rearExtensionIn = Math.max(0, Number(sku.countertopRearExtensionIn) || 0);
	    const waterfallDepthIn = threeDSceneCountertopDepthIn(sku, bodyDepth / INCH) + rearExtensionIn;
	    const waterfallTop = countertopCenterY + 0.75 * INCH;
	    const panelThickness = 1.5 * INCH;
	    for (const side of waterfallSides) {
	      const panel = new THREE.Mesh(
	        new THREE.BoxGeometry(panelThickness, waterfallTop, waterfallDepthIn * INCH),
	        waterfallMaterial,
	      );
	      panel.position.copy(cabinet.position);
	      panel.rotation.y = rotation;
	      // Sit outside the cabinet carcass so the slab is visible at the chosen
	      // island end. The panel owns the countertop's 1.5-inch side overhang,
	      // rather than being embedded within the cabinet body.
	      panel.translateX(side * (bodyWidth / 2 + panelThickness / 2));
	      panel.translateZ((COUNTERTOP_FRONT_OVERHANG - rearExtensionIn * INCH) / 2);
	      panel.position.y = waterfallTop / 2;
	      panel.userData = {
	        waterfallPanel: true,
	        waterfallSide: side === -1 ? "left" : "right",
	        selectedSurfaceRole: "countertop",
	        fullHeightToFloor: true,
	        islandWaterfall: Boolean(sku.islandFace),
	      };
	      applyThreeDPlacementIdentity(panel, placementIdentity);
	      root.add(panel);
	    }
	  }
}

export type ThreeDPlacedWall = "back" | "front" | "left" | "right";

/**
 * Plan rotation is measured clockwise on a screen whose Y axis points down.
 * Three.js rotation around +Y has the opposite handedness in the X/Z plane, so
 * explicit non-perimeter placements must mirror the saved angle before their
 * local +Z front can match the Plan cabinet front.
 */
export function threeDPlanRotation(planRotationRadians: number): number {
	const fullTurn = Math.PI * 2;
	return ((-planRotationRadians % fullTurn) + fullTurn) % fullTurn;
}

/** Resolves the room wall that owns a rectangular placed item from its 2D footprint. */
export function threeDPlacedWall(
  cabinet: PlacedCabinet,
  room: Pick<RoomData, "width" | "depth">,
  toleranceIn = 1.5,
): ThreeDPlacedWall | null {
  const footprint = normalizedThreeDFootprint(cabinet);
  const distances: Array<{ wall: ThreeDPlacedWall; distance: number }> = [
    { wall: "back", distance: Math.abs(cabinet.y) },
    { wall: "front", distance: Math.abs(room.depth - (cabinet.y + footprint.d)) },
    { wall: "left", distance: Math.abs(cabinet.x) },
    { wall: "right", distance: Math.abs(room.width - (cabinet.x + footprint.w)) },
  ];
  const nearest = distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest);
  // Interior/island cabinets retain their explicit user rotation. Only an item
  // seated at a room boundary has an unambiguous wall-facing direction.
  return nearest.distance <= toleranceIn ? nearest.wall : null;
}

/**
 * Legacy base and wall runs retain their 2D quarter-turn even when their saved
 * perpendicular offset is too large for a strict proximity match. Use that
 * intended wall only when it agrees with the nearest physical wall.
 */
export function threeDLegacyWallAnchor(
  cabinet: PlacedCabinet,
  room: Pick<RoomData, "width" | "depth">,
): ThreeDPlacedWall | null {
  const footprint = normalizedThreeDFootprint(cabinet);
  const distances: Array<{ wall: ThreeDPlacedWall; distance: number }> = [
    { wall: "back", distance: Math.abs(cabinet.y) },
    { wall: "front", distance: Math.abs(room.depth - (cabinet.y + footprint.d)) },
    { wall: "left", distance: Math.abs(cabinet.x) },
    { wall: "right", distance: Math.abs(room.width - (cabinet.x + footprint.w)) },
  ];
  const nearest = distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest);
  const quarterTurn = ((Math.round(Number(cabinet.rotation) / 90) % 4) + 4) % 4;
  const rotatedWall: ThreeDPlacedWall = ["back", "left", "front", "right"][quarterTurn] as ThreeDPlacedWall;
  if (nearest.distance <= 18 && nearest.wall === rotatedWall) return rotatedWall;
  return threeDPlacedWall(cabinet, room, 6);
}

/**
 * Local fronts are modeled on positive Z. Convert each 2D room-wall placement
 * to a world rotation that points those fronts into usable room space while the
 * cabinet/appliance back remains against the wall.
 */
export function threeDRoomFacingRotation(
		  cabinet: PlacedCabinet,
		  room?: (Pick<RoomData, "ceilingHeight"> & Partial<Pick<RoomData, "width" | "depth" | "peninsulaRuns" | "customWalls">>) | null,
		  fallbackRotation = 0,
	) {
	  if (cabinet.islandFace) {
	    const islandFacing = {
	      front: 0,
	      back: Math.PI,
	      left: -Math.PI / 2,
	      right: Math.PI / 2,
	    } as const;
	    return islandFacing[cabinet.islandFace];
	  }
		  // A cabinet seated on a known wall run (standard side, drawn wall or
		  // peninsula) faces into the room exactly as that run frame says. This is
		  // one rule for every wall kind; only run-less legacy records fall back to
		  // inferring a wall from their plan coordinates below.
		  const seatedRun = room && Number.isFinite(room.width) && Number.isFinite(room.depth)
		    ? seatedWallRunFrame(cabinet, room as RoomData)
		    : null;
		  const seatedKind = placedCornerGeometryKind(cabinet);
		  // Rectangular corner bodies (L, diagonal, triangle, corner-drawer) keep
		  // their authored two-leg plan turn below; every other seated body faces
		  // the room exactly as its run frame says, on every wall kind.
		  if (seatedRun && (seatedKind === "standard" || seatedKind === "blind-corner")) {
		    return threeDPlanRotation(seatedRun.facingRotation * Math.PI / 180);
		  }
  // A seated true-corner body keeps its two-leg plan turn, but a plan
  // rotation only names an axis (0 and 180 draw the same footprint). The run
  // it is seated on says which way that axis faces, on every wall kind, so a
  // corner upper on a drawn wall can never face the wall.
  if (seatedRun) {
    const savedTurn = ((Math.round(fallbackRotation * 180 / Math.PI) % 360) + 360) % 360;
    const facing = ((Math.round(seatedRun.facingRotation) % 360) + 360) % 360;
    const sameAxis = (((savedTurn - facing) % 180) + 180) % 180 === 0;
    return threeDPlanRotation((sameAxis ? facing : savedTurn) * Math.PI / 180);
  }
		  // A record that names one of this room's runs but sits off that run's
		  // axis keeps its authored plan turn rather than being re-homed onto
		  // whichever perimeter wall its coordinates happen to be nearest.
		  if (!seatedRun && cabinet.wallId && room && wallRunFrame(cabinet.wallId, room as RoomData)) return threeDPlanRotation(fallbackRotation);
		  // A locked 45° polygon-wall cabinet already carries its exact scene-facing
		  // angle. Do not infer a nearby rectangular wall and turn it back to 0°/90°.
		  const explicitAngle = ((Math.round(Number(cabinet.rotation)) % 360) + 360) % 360;
			  if (explicitAngle === 45 || explicitAngle === 135 || explicitAngle === 225 || explicitAngle === 315) return threeDPlanRotation(fallbackRotation);
	  if (!room || !Number.isFinite(room.width) || !Number.isFinite(room.depth)) return fallbackRotation;
  const kind = placedCornerGeometryKind(cabinet);
  // Every true corner body (L / lazy-Susan / easy-reach, diagonal, triangle,
  // corner-drawer) is authored with the wall corner at its local back-left and
  // its front toward the room, exactly like plan rotation 0 in the top-left
  // corner. Three.js turns the opposite way from the plan, so the ONE rule for
  // every corner kind on every wall (standard side, drawn 90° or 45° join) is
  // the same mirror a standard cabinet uses: threeDPlanRotation(plan turn).
  // A blind corner is rectangular; its front resolves from the wall below.
  if (kind !== "standard" && kind !== "blind-corner") return threeDPlanRotation(fallbackRotation);
  const facing: Record<ThreeDPlacedWall, number> = {
    back: 0,
    front: Math.PI,
    left: Math.PI / 2,
    right: -Math.PI / 2,
  };
  const resolvedRoom = room as Pick<RoomData, "width" | "depth">;
  const defaultWall = threeDPlacedWall(cabinet, resolvedRoom);
  // A cabinet and fitted filler can both touch two walls at the end of a run.
  // In that tie, preserve the saved 2D run axis: 90°/270° belongs to the nearest
  // left/right wall, while 0°/180° belongs to the nearest back/front wall. This
  // prevents a right-wall cabinet moved by the filler workflow from becoming a
  // front-wall cabinet merely because its final edge also touches the front wall.
  const savedQuarterTurn = ((Number(cabinet.rotation) % 360) + 360) % 360;
  const footprint = normalizedThreeDFootprint(cabinet);
  const leftDistance = Math.abs(cabinet.x);
  const rightDistance = Math.abs(resolvedRoom.width - (cabinet.x + footprint.w));
  const backDistance = Math.abs(cabinet.y);
  const frontDistance = Math.abs(resolvedRoom.depth - (cabinet.y + footprint.d));
  const sideWall: ThreeDPlacedWall = leftDistance <= rightDistance ? "left" : "right";
  const horizontalWall: ThreeDPlacedWall = backDistance <= frontDistance ? "back" : "front";
  const usesVerticalRun = savedQuarterTurn === 90 || savedQuarterTurn === 270;
  const intendedWall = usesVerticalRun ? sideWall : horizontalWall;
  const intendedWallDistance = usesVerticalRun ? Math.min(leftDistance, rightDistance) : Math.min(backDistance, frontDistance);
  const wall = intendedWallDistance <= 6 ? intendedWall : defaultWall;
  return wall ? facing[wall] : fallbackRotation;
}

export function threeDBlindCornerFrontLayout(bodyWidth: number, doorSide: "left" | "right", openingWidthIn?: number | null) {
	  const requestedOpening = Number(openingWidthIn) * INCH;
	  const doorWidth = Number.isFinite(requestedOpening) && requestedOpening > 0
	    ? Math.min(bodyWidth * 0.5, Math.max(bodyWidth * 0.2, requestedOpening))
	    : bodyWidth / 3;
  const blindWidth = bodyWidth - doorWidth;
  const doorOnRight = doorSide === "right";
  return {
    doorSide,
    blindSide: doorOnRight ? "left" as const : "right" as const,
    doorWidth,
    blindWidth,
    doorX: doorOnRight ? bodyWidth / 2 - doorWidth / 2 : -bodyWidth / 2 + doorWidth / 2,
    blindX: doorOnRight ? -bodyWidth / 2 + blindWidth / 2 : bodyWidth / 2 - blindWidth / 2,
  };
}

export function existingCabinetTransform(
  cabinet: PlacedCabinet,
  room?: (Pick<RoomData, "ceilingHeight"> & Partial<Pick<RoomData, "width" | "depth" | "peninsulaRuns" | "customWalls">>) | null,
) {
  // Placed coordinates are the top-left of the 2D rotation-aware footprint.
  // Using nominal width/depth here offsets rotated runs by up to half a cabinet,
  // producing artificial gaps in the 3D scene.
  const footprint = normalizedThreeDFootprint(cabinet);
  const width = numberValue(footprint.w, 24);
  const depth = numberValue(footprint.d, BASE_DEPTH);
  const savedRotation = Number(cabinet.rotation);
  const sharedKind = placedCornerGeometryKind(cabinet);
  const hasPlacedRoom = Number.isFinite(room?.width) && Number.isFinite(room?.depth);
  // A corner body seated on a wall run (its wallId/wallOffset name a run of
  // this room) already carries its exact two-leg rotation from the shared
  // corner seating, on every wall kind. Only a run-less legacy corner record
  // still infers its quarter turn from the nearest rectangular room corner.
  const seatedOnRun = hasPlacedRoom && seatedWallRunFrame(cabinet, room as RoomData) != null;
  const cornerTurn = hasPlacedRoom && !seatedOnRun && (sharedKind === "diagonal" || sharedKind === "triangle" || sharedKind === "l-shape" || sharedKind === "corner-drawer")
    ? cornerRotationForPlaced(cabinet, room as RoomData)
    : null;
  // The plan turn (seated rotation, or the inferred rectangle corner for a
  // legacy record) is mirrored once, for every corner kind, inside
  // threeDRoomFacingRotation. No per-kind pre-rotation here.
  const planRotation = cornerTurn ?? savedRotation;
  // 2D horizontal walls share a 0° rotation and vertical walls share 90°, which
  // is sufficient for a plan footprint but cannot distinguish back/front or
  // left/right in a 3D room. Resolve orientation from the placed wall so every
  // front projects into the room and every back sits against its wall.
  const savedRotationRadians = Number.isFinite(planRotation) ? planRotation * Math.PI / 180 : 0;
  const rotation = threeDRoomFacingRotation(cabinet, room, savedRotationRadians);
  const sharedElevation = elevationBox(cabinet, room);
  const explicitMountBottom = cabinet.mountBottom == null ? null : numberValue(cabinet.mountBottom, 0);
  const bottom = cabinet.islandFace && cabinet.mountBottomAdjusted !== true
    ? sharedElevation.bottom
    : cabinet.placement === "wall" || cabinet.placement === "appliance" || explicitMountBottom != null
      ? explicitMountBottom ?? sharedElevation.bottom
    : cabinet.placement === "baseTop"
      ? STD.BASE_HEIGHT - numberValue(cabinet.height, 6)
      : cabinet.placement === "underCabinet"
        ? WALL_BOTTOM - numberValue(cabinet.height, 6)
        : 0;
  // A locked 45° measured-wall placement stores the axis-aligned rotated-body
  // origin. Corner products use a square physical footprint, so recover the
  // rotated envelope center before creating their 3D body; otherwise an ERB36
  // looks offset from the same vertex it correctly occupies in the plan.
  const normalizedSavedRotation = ((Math.round(savedRotation) % 360) + 360) % 360;
  const lockedAngledCorner = Boolean(
    cabinet.wallId
    && cabinet.wallOffset != null
    && sharedKind !== "standard"
    && [45, 135, 225, 315].includes(normalizedSavedRotation),
  );
  const angledRadians = normalizedSavedRotation * Math.PI / 180;
  const rotatedBoundWidth = Math.abs(width * Math.cos(angledRadians)) + Math.abs(depth * Math.sin(angledRadians));
  const rotatedBoundDepth = Math.abs(width * Math.sin(angledRadians)) + Math.abs(depth * Math.cos(angledRadians));
  let x = cabinet.x + (lockedAngledCorner ? rotatedBoundWidth : width) / 2;
  let z = cabinet.y + (lockedAngledCorner ? rotatedBoundDepth : depth) / 2;
  // Older saved designs sometimes carry a small perpendicular gap even though
  // their end-run cabinet is intended to sit on the closest wall. Keep explicit
  // Move In/Move Out adjustments intact, but seat legacy end runs flush so their
  // backs do not float inside the room.
	const isPeninsulaCabinet = Boolean(room?.peninsulaRuns?.some((run) => run.id === cabinet.wallId));
	const preserveGlassStackerFrontDepth = Boolean(
	  cabinet.depthPositionAdjusted &&
	  cabinet.stackedOnCabinetUid &&
	  isStacker(cabinet) &&
	  isGlassDoorCabinet(cabinet),
	);
  // A Continuous Wall Builder run is an explicit measured segment, not a
  // legacy rectangular-room edge. A 45-degree base or appliance can happen to
  // be near the rectangular room's front/left boundary; re-seating it to that
  // unrelated wall changes its center independently of the adjoining cabinet
  // and creates a visible range-side gap in 3D. Its `wallId` + `wallOffset`
  // placement already describes the exact, authoritative wall plane.
  const isMeasuredWallCabinet = Boolean(hasPlacedRoom && seatedWallRunFrame(cabinet, room as RoomData));
  const legacyWall = hasPlacedRoom
    && !isPeninsulaCabinet
	    && !isMeasuredWallCabinet
	    && !cabinet.islandFace
	    && !preserveGlassStackerFrontDepth
	    && cabinet.placement === "wall"
    ? cabinetWall(cabinet, room as RoomData)
    : hasPlacedRoom
      && !isPeninsulaCabinet
      && !isMeasuredWallCabinet
      && !cabinet.islandFace
      && !cabinet.depthPositionAdjusted
      && cabinet.placement === "base"
      ? threeDLegacyWallAnchor(cabinet, room as Pick<RoomData, "width" | "depth">)
      : null;
  if (legacyWall === "left") x = width / 2;
  if (legacyWall === "right") x = (room as Pick<RoomData, "width">).width - width / 2;
  if (legacyWall === "back") z = depth / 2;
  if (legacyWall === "front") z = (room as Pick<RoomData, "depth">).depth - depth / 2;
  return { x, z, rotation, bottom };
}

/** One physical top per occupied peninsula: voids remain covered, and only the exposed far end may waterfall. */
/** Seating-bar edge: a small eased roundover. bevelOffset = -bevelSize keeps the outline at its true plan size. */
export const RAISED_BAR_EDGE_EASE_IN = 0.25;
export function threeDPeninsulaCountertopGeometry(surface: CountertopSurface, length: number, depth: number) {
  if (!surface.polygon || surface.polygon.length < 3) {
    return new THREE.BoxGeometry(length * INCH, STD.COUNTERTOP_THICKNESS * INCH, depth * INCH);
  }
  const shape = new THREE.Shape();
  surface.polygon.forEach((point, index) => {
    const x = (point.x - length / 2) * INCH;
    const y = (point.y - depth / 2) * INCH;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const eased = Boolean(surface.raisedBar);
  const ease = RAISED_BAR_EDGE_EASE_IN * INCH;
  const geometry = new THREE.ExtrudeGeometry(shape, eased ? {
    depth: (STD.COUNTERTOP_THICKNESS - 2 * RAISED_BAR_EDGE_EASE_IN) * INCH,
    bevelEnabled: true,
    bevelThickness: ease,
    bevelSize: ease,
    bevelOffset: -ease,
    bevelSegments: 3,
    steps: 1,
  } : {
    depth: STD.COUNTERTOP_THICKNESS * INCH,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -(eased ? (STD.COUNTERTOP_THICKNESS - 2 * RAISED_BAR_EDGE_EASE_IN) : STD.COUNTERTOP_THICKNESS) * INCH / 2);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Seating-bar corbels: iron L-brackets under the outward overhang, as in the
 * reference photos. Purely visual 3D; they never change the countertop outline,
 * overhang, price, or collision.
 */
export function raisedBarCorbelPlan(
  polygon: { x: number; y: number }[],
  normal: { x: number; y: number },
  overhangIn: number,
): { tangentIn: number; faceIn: number; armIn: number }[] {
  if (polygon.length < 3 || overhangIn <= 1.5) return [];
  // The strip polygon IS the overhang: its far edge is the outer edge, its near edge is the cabinet back.
  const proj = polygon.map((pt) => pt.x * normal.x + pt.y * normal.y);
  const far = Math.max(...proj);
  const tan = { x: -normal.y, y: normal.x };
  const edge = polygon.filter((_, i) => far - proj[i]! <= 1 / 16).map((pt) => pt.x * tan.x + pt.y * tan.y);
  if (edge.length < 2) return [];
  const lo = Math.min(...edge) + 3;
  const hi = Math.max(...edge) - 3;
  if (hi - lo < 6) return [];
  const count = Math.max(2, Math.round((hi - lo) / 24) + 1);
  const arm = Math.min(6, Math.max(3, overhangIn - 8));
  return Array.from({ length: count }, (_, i) => ({
    tangentIn: lo + ((hi - lo) * i) / (count - 1),
    faceIn: Math.min(...proj),
    armIn: arm,
  }));
}

/**
 * A miter changes a slab's plan area, not its physical front-to-back depth.
 * The 3D extrusion must retain the measured surface depth used to author its
 * local polygon. Deriving depth from area ÷ length recenters a 45°-cut slab
 * around the wrong axis and makes the return appear detached from its join.
 */
export function threeDPeninsulaCountertopPhysicalDepth(surface: CountertopSurface, length: number): number {
  const physicalDepth = Number(surface.depth);
  if (Number.isFinite(physicalDepth) && physicalDepth > 0) return physicalDepth;
  return Math.max(0.1, (surface.areaInches ?? length * 25.5) / Math.max(0.1, length));
}

export function addThreeDPeninsulaCountertops(
  root: THREE.Group,
  room: RoomData,
  placed: PlacedCabinet[],
  counterColor: string,
  countertopTexture?: THREE.Texture | null,
) {
  const surfaces = countertopSurfaces(placed, room).filter((surface) => Boolean(surface.peninsulaRunId));
  for (const surface of surfaces) {
    const run = room.peninsulaRuns?.find((candidate) => candidate.id === surface.peninsulaRunId);
    if (!run) continue;
    const isUnifiedAssembly = Boolean(surface.peninsulaRunIds && surface.peninsulaRunIds.length > 1);
    // Raised/extended slabs are rebuilt as world outlines (rotation 0), so their local length is their own width, not the run length.
    const usesOwnWidth = isUnifiedAssembly || (Boolean(surface.raisedBar) && Boolean(surface.polygon) && !(surface.rotation ?? 0));
    const length = Math.max(0.1, usesOwnWidth ? surface.width : surface.linearInches ?? run.length);
    const depth = threeDPeninsulaCountertopPhysicalDepth(surface, length);
    const planRotation = (surface.rotation ?? 0) * Math.PI / 180;
    const rotation = threeDPlanRotation(planRotation);
    const planTangent = { x: Math.cos(planRotation), z: Math.sin(planRotation) };
    const centerX = surface.x + surface.width / 2;
    const centerZ = surface.y + surface.depth / 2;
    const mappedTexture = countertopTexture ? threeDTextureForCountertopMesh(countertopTexture, {
      centerXIn: centerX, centerZIn: centerZ, localWidthIn: length, localDepthIn: depth, rotation,
      slabWidthIn: Number(countertopTexture.userData?.physicalWidthIn) || 138,
      slabDepthIn: Number(countertopTexture.userData?.physicalDepthIn) || 79,
    }) : null;
    const material = new THREE.MeshPhysicalMaterial({ color: mappedTexture ? "#ffffff" : counterColor, map: mappedTexture, ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedTexture)) });
    material.userData = { selectedSurfaceRole: "countertop", peninsulaContinuousSlab: true, materialOnlyNoGeometryChange: true };
    const slab = new THREE.Mesh(threeDPeninsulaCountertopGeometry(surface, length, depth), material);
    const finishedHeight = surface.countertopHeightIn ?? STD.COUNTERTOP_HEIGHT;
    slab.position.set(centerX * INCH, (finishedHeight - STD.COUNTERTOP_THICKNESS / 2) * INCH, centerZ * INCH);
    slab.rotation.y = rotation;
    const lowerWorktopExtensionIn = surface.raisedBar ? 0 : peninsulaLowerWorktopOppositeSideExtensionIn(run, room);
    slab.userData = {
      peninsulaCountertop: true,
      peninsulaRunId: run.id,
      peninsulaRunIds: surface.peninsulaRunIds ?? [run.id],
      unifiedPeninsulaAssembly: isUnifiedAssembly,
      runStartIn: surface.runStartIn ?? 0,
      physicalDepthIn: depth,
      lowerWorktopExtensionIn,
      seatingOverhangIn: surface.raisedBar ? 0 : peninsulaCountertopSeatingOverhang(run, room),
      ponyWallBarOverhangIn: surface.raisedBar ? 0 : peninsulaCountertopPonyWallBarOverhang(run, room),
      ponyWallBackExtensionIn: surface.raisedBar ? 0 : peninsulaCountertopPonyWallBackExtensionIn(run, room),
      raisedBar: Boolean(surface.raisedBar),
      raisedBarUsesSharedCountertopOutline: Boolean(surface.raisedBarUsesSharedCountertopOutline),
      raisedBarOverhangIn: surface.raisedBarOverhangIn ?? null,
      countertopHeightIn: finishedHeight,
      bridgesCabinetVoids: false,
      preservesRangeOpening: true,
      miteredStart: surface.miteredStart ?? false,
      miteredEnd: surface.miteredEnd ?? false,
    };
    root.add(slab);
    if (surface.raisedBar) {
      const barFrame = peninsulaRunEndpoints(run, room);
      const barFaceNormal = countertopRunFaceNormal(barFrame.radians, run.cabinetSide ?? "left");
      const barNormal = { x: -barFaceNormal.x, y: -barFaceNormal.y }; // brackets sit under the BACK overhang
      const barTan = { x: -barNormal.y, y: barNormal.x };
      const ironMaterial = new THREE.MeshStandardMaterial({ color: "#c9c5bd", roughness: 0.9, metalness: 0.0 });
      const barBottom = (surface.countertopHeightIn ?? STD.COUNTERTOP_HEIGHT) - STD.COUNTERTOP_THICKNESS;
      const barRadians = Math.atan2(barNormal.y, barNormal.x);
      // Step riser ("backsplash" of the lower top): a same-material vertical panel on the bar's near edge,
      // filling the gap from the lower worktop up to the raised bar. It sits inside the bar strip, never over the lower top.
      {
        const poly = countertopSurfacePlanPolygon(surface);
        const proj = poly.map((pt) => pt.x * barNormal.x + pt.y * barNormal.y);
        const near = Math.min(...proj);
        const edgeT = poly.filter((_, i) => proj[i]! - near <= 1 / 16).map((pt) => pt.x * barTan.x + pt.y * barTan.y);
        const lowerTop = STD.COUNTERTOP_HEIGHT;
        const riseIn = barBottom - lowerTop;
        if (edgeT.length >= 2 && riseIn > 0.25) {
          const lo = Math.min(...edgeT), hi = Math.max(...edgeT);
          const riserThick = 1.25;
          const riser = new THREE.Mesh(new THREE.BoxGeometry(riserThick * INCH, riseIn * INCH, (hi - lo) * INCH), slab.material);
          const rx = barNormal.x * (near + riserThick / 2) + barTan.x * ((lo + hi) / 2);
          const rz = barNormal.y * (near + riserThick / 2) + barTan.y * ((lo + hi) / 2);
          riser.position.set(rx * INCH, (lowerTop + riseIn / 2) * INCH, rz * INCH);
          riser.rotation.y = -Math.atan2(barNormal.y, barNormal.x);
          riser.userData = { raisedBarRiser: true, peninsulaRunId: run.id, visualOnly: true, materialOnlyNoGeometryChange: true };
          root.add(riser);
        }
      }
      (run.countertopRaisedBarCorbels ? raisedBarCorbelPlan(countertopSurfacePlanPolygon(surface), barNormal, surface.raisedBarOverhangIn ?? 15) : []).forEach((c, index) => {
        const corbel = new THREE.Group();
        const faceX = barNormal.x * c.faceIn + barTan.x * c.tangentIn;
        const faceZ = barNormal.y * c.faceIn + barTan.y * c.tangentIn;
        const thick = 0.75;
        const drop = 3;
        // Local +X points outward from the support face; the group is rotated to the overhang normal.
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.35 * INCH, drop * INCH, thick * INCH), ironMaterial);
        back.position.set(0.25 * INCH, (barBottom - drop / 2) * INCH, 0);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(c.armIn * INCH, 0.5 * INCH, thick * INCH), ironMaterial);
        arm.position.set((c.armIn / 2) * INCH, (barBottom - 0.25) * INCH, 0);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(c.armIn * 0.8, drop * 0.8) * INCH, 0.4 * INCH, 0.8 * INCH), ironMaterial);
        brace.position.set((c.armIn * 0.4) * INCH, (barBottom - drop * 0.4) * INCH, 0);
        brace.rotation.z = -Math.atan2(drop, c.armIn);
        corbel.add(back, arm); // diagonal brace removed: supports read as a quiet shadow-line, not hardware
        corbel.position.set(faceX * INCH, 0, faceZ * INCH);
        corbel.rotation.y = -barRadians;
        corbel.userData = { raisedBarCorbel: true, peninsulaRunId: run.id, index, visualOnly: true };
        root.add(corbel);
      });
      continue;
    }
    const terminalRun = surface.peninsulaTerminalRunId
      ? room.peninsulaRuns?.find((candidate) => candidate.id === surface.peninsulaTerminalRunId) ?? run
      : run;
    const reachesFarEnd = isUnifiedAssembly || (surface.runStartIn ?? 0) + length >= terminalRun.length - 0.01;
    if (!peninsulaCountertopWaterfallEnd(terminalRun, room) || !reachesFarEnd) continue;
    const terminalGeometry = peninsulaRunEndpoints(terminalRun, room);
    const terminalLength = terminalRun.length;
    const terminalOppositeSideExtension = peninsulaLowerWorktopOppositeSideExtensionIn(terminalRun, room);
    const terminalDepth = COUNTERTOP_DEPTH_IN + terminalOppositeSideExtension;
    const terminalCenter = wallPlacementAt(0, terminalLength, terminalDepth, terminalRun.id as WallSide, room, terminalRun.cabinetSide ?? "left");
    const terminalFootprint = placedFootprint({
      uid: `peninsula-waterfall-${terminalRun.id}`,
      cabinetId: 0,
      masterCode: "PENINSULA-WATERFALL",
      description: "Peninsula waterfall",
      placement: "base",
      x: terminalCenter.x,
      y: terminalCenter.y,
      width: terminalLength,
      depth: terminalDepth,
      height: STD.COUNTERTOP_THICKNESS,
      rotation: terminalCenter.rotation,
    });
    const terminalPlanTangent = { x: Math.cos(terminalGeometry.radians), z: Math.sin(terminalGeometry.radians) };
    const terminalFaceNormal = countertopRunFaceNormal(terminalGeometry.radians, terminalRun.cabinetSide ?? "left");
    const terminalRotation = threeDPlanRotation(terminalGeometry.radians);
    const terminalCenterX = terminalCenter.x + terminalFootprint.w / 2 - terminalFaceNormal.x * terminalOppositeSideExtension;
    const terminalCenterZ = terminalCenter.y + terminalFootprint.d / 2 - terminalFaceNormal.y * terminalOppositeSideExtension;
    const waterfall = new THREE.Mesh(new THREE.BoxGeometry(STD.COUNTERTOP_THICKNESS * INCH, STD.COUNTERTOP_HEIGHT * INCH, terminalDepth * INCH), material.clone());
    waterfall.position.set((terminalCenterX + terminalPlanTangent.x * (terminalLength / 2 + STD.COUNTERTOP_THICKNESS / 2)) * INCH, STD.COUNTERTOP_HEIGHT * INCH / 2, (terminalCenterZ + terminalPlanTangent.z * (terminalLength / 2 + STD.COUNTERTOP_THICKNESS / 2)) * INCH);
    waterfall.rotation.y = terminalRotation;
    waterfall.userData = { peninsulaWaterfall: true, peninsulaRunId: terminalRun.id, peninsulaRunIds: surface.peninsulaRunIds ?? [run.id], exposedFarEnd: true };
    root.add(waterfall);
  }
}

/**
 * Draws the authoritative continuous-wall countertop surfaces. At a verified
 * 45-degree return, `countertopSurfaces` has already cut the two base-supported
 * slabs to one shared fabricated seam and added the one physical wall-side
 * infill polygon required by the 11-inch corner holds. Rendering the surfaces
 * here keeps 3D, Plan, materials, and pricing on identical geometry without a
 * wall-side void or a free-gap countertop bridge.
 */
export function addThreeDMeasuredWallMiterCountertops(
  root: THREE.Group,
  room: RoomData,
  placed: PlacedCabinet[],
  counterColor: string,
  countertopTexture?: THREE.Texture | null,
) {
  const surfaces = countertopSurfaces(placed, room).filter((surface) => Boolean(surface.customWallId));
  for (const surface of surfaces) {
    const length = Math.max(0.1, surface.linearInches ?? surface.width);
    const depth = Math.max(0.1, surface.depth);
    const planRotation = (surface.rotation ?? 0) * Math.PI / 180;
    const rotation = threeDPlanRotation(planRotation);
    const centerX = surface.x + surface.width / 2;
    const centerZ = surface.y + surface.depth / 2;
    const mappedTexture = countertopTexture ? threeDTextureForCountertopMesh(countertopTexture, {
      centerXIn: centerX,
      centerZIn: centerZ,
      localWidthIn: length,
      localDepthIn: depth,
      rotation,
      slabWidthIn: Number(countertopTexture.userData?.physicalWidthIn) || 138,
      slabDepthIn: Number(countertopTexture.userData?.physicalDepthIn) || 79,
    }) : null;
    const material = new THREE.MeshPhysicalMaterial({
      color: mappedTexture ? "#ffffff" : counterColor,
      map: mappedTexture,
      ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedTexture)),
    });
    material.userData = {
      selectedSurfaceRole: "countertop",
      usesAuthoritativeProductImage: Boolean(mappedTexture),
      worldSlabMapped: Boolean(mappedTexture?.userData?.worldSlabMapped),
      materialOnlyNoGeometryChange: true,
    };
    const bridge = new THREE.Mesh(
      threeDPeninsulaCountertopGeometry(surface, length, depth),
      material,
    );
    bridge.position.set(centerX * INCH, (STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS / 2) * INCH, centerZ * INCH);
    bridge.rotation.y = rotation;
    bridge.userData = {
      measuredWallContinuousCountertop: true,
      measuredWallMiterCountertop: Boolean(surface.customWallMiterWallIds?.length),
      measuredWallCornerInfillCountertop: Boolean(surface.customWallCornerInfill),
      measuredWallSquareCornerCountertop: Boolean(surface.customWallSquareCornerWallIds?.length),
      customWallId: surface.customWallId,
      customWallMiterWallIds: surface.customWallMiterWallIds,
      customWallMiterVertexId: surface.customWallMiterVertexId,
      customWallSquareCornerWallIds: surface.customWallSquareCornerWallIds,
      customWallSquareCornerVertexId: surface.customWallSquareCornerVertexId,
      miterAngleDegrees: surface.customWallMiterWallIds?.length ? 45 : undefined,
      physicalMiterSeam: Boolean(surface.customWallMiterWallIds?.length),
      physicalSquareCornerSeam: Boolean(surface.customWallSquareCornerWallIds?.length),
      miteredStart: surface.miteredStart ?? false,
      miteredEnd: surface.miteredEnd ?? false,
    };
    root.add(bridge);
  }
}

/**
 * Standard rooms use the same resolved countertop surfaces as the Floor Plan,
 * materials list, and measured-wall renderer.  Rendering a slab per cabinet
 * leaves visible seams and can keep an obsolete corner contour after the
 * shared source has already combined a run into one physical piece.
 */
/**
 * True when a shared countertop surface physically sits over the cabinet —
 * the cabinet's plan centre lies inside the slab outline (small tolerance).
 * Free-standing cabinets (no wall seat) are snapped to a wall by the shared
 * surface builder; their slab lands on the wall instead of over the box, so
 * that slab covers nothing and the cabinet keeps its own top.
 */
export function countertopSurfaceCoversCabinet(surface: CountertopSurface, cabinet: PlacedCabinet): boolean {
  const { w, d } = rotatedSize(cabinet);
  const point = { x: cabinet.x + w / 2, y: cabinet.y + d / 2 };
  const polygon = countertopSurfacePlanPolygon(surface);
  if (polygon.length < 3) return false;
  const tolerance = 0.75;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersects) inside = !inside;
  }
  if (inside) return true;
  // Tolerate a centre that sits exactly on the outline (touching-run seams).
  const minX = Math.min(...polygon.map((v) => v.x)) - tolerance;
  const maxX = Math.max(...polygon.map((v) => v.x)) + tolerance;
  const minY = Math.min(...polygon.map((v) => v.y)) - tolerance;
  const maxY = Math.max(...polygon.map((v) => v.y)) + tolerance;
  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) return false;
  return polygon.length === 4 && !surface.polygon;
}

/** Standard-room shared slabs that actually sit over at least one counter-bearing base. */
export function threeDStandardCountertopSurfaces(
  room: RoomData,
  placed: PlacedCabinet[],
  island?: IslandZone | null,
  ponyWalls: PonyWall[] = [],
): CountertopSurface[] {
  const bases = placed.filter((cabinet) => bearsCountertop(cabinet));
  const all = countertopSurfaces(placed, room, island, ponyWalls);
  // A free-standing chain is one fabricated path from the Continuous Wall
  // Builder's code (leg slabs + the 45° corner infill). Keep the whole path when
  // any member cabinet is under it, so the small corner piece is not dropped.
  const coveredChains = new Set(
    all
      .filter((surface) => surface.freestandingMemberUids?.length && bases.some((cabinet) => countertopSurfaceCoversCabinet(surface, cabinet)))
      .map((surface) => surface.cabinetRunId ?? ""),
  );
  return all.filter((surface) => (
    !surface.peninsulaRunId && !surface.customWallId && surface.kind !== "island"
    && (
      bases.some((cabinet) => countertopSurfaceCoversCabinet(surface, cabinet))
      || Boolean(surface.cabinetRunId?.startsWith("corner-fill"))
      || (surface.freestandingMemberUids?.length ? coveredChains.has(surface.cabinetRunId ?? "") : false)
    )
  ));
}

export function addThreeDStandardCountertops(
  root: THREE.Group,
  room: RoomData,
  placed: PlacedCabinet[],
  counterColor: string,
  countertopTexture?: THREE.Texture | null,
  island?: IslandZone | null,
  ponyWalls: PonyWall[] = [],
) {
  const surfaces = threeDStandardCountertopSurfaces(room, placed, island, ponyWalls);
  for (const surface of surfaces) {
    // `linearInches` is the along-wall takeoff. On a side wall it is the Z run
    // length, not the slab's physical X width; use the plan surface dimensions.
    const length = Math.max(0.1, surface.width);
    const depth = Math.max(0.1, surface.depth);
    const rotation = threeDPlanRotation((surface.rotation ?? 0) * Math.PI / 180);
    const centerX = surface.x + surface.width / 2;
    const centerZ = surface.y + surface.depth / 2;
    const mappedTexture = countertopTexture ? threeDTextureForCountertopMesh(countertopTexture, {
      centerXIn: centerX,
      centerZIn: centerZ,
      localWidthIn: length,
      localDepthIn: depth,
      rotation,
      slabWidthIn: Number(countertopTexture.userData?.physicalWidthIn) || 138,
      slabDepthIn: Number(countertopTexture.userData?.physicalDepthIn) || 79,
    }) : null;
    const material = new THREE.MeshPhysicalMaterial({
      color: mappedTexture ? "#ffffff" : counterColor,
      map: mappedTexture,
      ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedTexture)),
    });
    material.userData = {
      selectedSurfaceRole: "countertop",
      usesAuthoritativeProductImage: Boolean(mappedTexture),
      worldSlabMapped: Boolean(mappedTexture?.userData?.worldSlabMapped),
      materialOnlyNoGeometryChange: true,
    };
    const slab = new THREE.Mesh(threeDPeninsulaCountertopGeometry(surface, length, depth), material);
    slab.position.set(centerX * INCH, (STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS / 2) * INCH, centerZ * INCH);
    slab.rotation.y = rotation;
    slab.userData = {
      standardRunCountertop: true,
      cabinetRunId: surface.cabinetRunId ?? null,
      physicalSharedSurface: true,
      preservesRangeOpening: true,
      bridgesCabinetVoids: false,
      sourcePolygonVertices: surface.polygon?.length ?? 4,
    };
    root.add(slab);
  }
}

type CrownPoint = { x: number; z: number };
type CrownEdgeKind = "front" | "left-return" | "right-return" | "diagonal-front";

export type ThreeDCrownPerimeterSegment = {
  ownerUid: string;
  kind: CrownEdgeKind;
  start: CrownPoint;
  end: CrownPoint;
  top: number;
  length: number;
  center: CrownPoint;
  rotation: number;
  diagonalCorner: boolean;
};

export type ThreeDCrownMiterJoint = {
  point: CrownPoint;
  top: number;
  firstDirection: CrownPoint;
  secondDirection: CrownPoint;
  ownerUids: [string, string];
  miterAngleDegrees: 45;
};

function measuredCrownSegment(
  ownerUid: string,
  kind: CrownEdgeKind,
  start: CrownPoint,
  end: CrownPoint,
  top: number,
  diagonalCorner: boolean,
): ThreeDCrownPerimeterSegment {
  return {
    ownerUid,
    kind,
    start,
    end,
    top,
    length: Math.hypot(end.x - start.x, end.z - start.z),
    center: { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
    rotation: -Math.atan2(end.z - start.z, end.x - start.x),
    diagonalCorner,
  };
}

function crownEndpointDirection(segment: ThreeDCrownPerimeterSegment, atStart: boolean): CrownPoint {
  const dx = atStart ? segment.end.x - segment.start.x : segment.start.x - segment.end.x;
  const dz = atStart ? segment.end.z - segment.start.z : segment.start.z - segment.end.z;
  const length = Math.hypot(dx, dz);
  return length > 1e-9 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
}

/**
 * Identifies the same two-piece exposed turns that the crown takeoff treats as
 * mitered corners. Straight cabinet joins and unsupported branch connections
 * deliberately receive no visible miter seam.
 */
export function threeDCrownMiterJoints(segments: ThreeDCrownPerimeterSegment[]): ThreeDCrownMiterJoint[] {
  const endpointTolerance = 0.25;
  const straightJoinDotProduct = 0.999;
  const nodes: Array<{
    point: CrownPoint;
    endpoints: Array<{ segmentIndex: number; ownerUid: string; direction: CrownPoint; top: number }>;
  }> = [];
  const addEndpoint = (point: CrownPoint, endpoint: { segmentIndex: number; ownerUid: string; direction: CrownPoint; top: number }) => {
    const node = nodes.find((candidate) => Math.hypot(candidate.point.x - point.x, candidate.point.z - point.z) <= endpointTolerance);
    if (node) node.endpoints.push(endpoint);
    else nodes.push({ point, endpoints: [endpoint] });
  };
  segments.forEach((segment, segmentIndex) => {
    addEndpoint(segment.start, { segmentIndex, ownerUid: segment.ownerUid, direction: crownEndpointDirection(segment, true), top: segment.top });
    addEndpoint(segment.end, { segmentIndex, ownerUid: segment.ownerUid, direction: crownEndpointDirection(segment, false), top: segment.top });
  });
  return nodes.flatMap((node) => {
    if (node.endpoints.length !== 2) return [];
    const [first, second] = node.endpoints;
    if (!first || !second || first.segmentIndex === second.segmentIndex || Math.abs(first.top - second.top) > endpointTolerance) return [];
    const dot = first.direction.x * second.direction.x + first.direction.z * second.direction.z;
    if (Math.abs(dot) >= straightJoinDotProduct) return [];
    return [{
      point: node.point,
      top: (first.top + second.top) / 2,
      firstDirection: first.direction,
      secondDirection: second.direction,
      ownerUids: [first.ownerUid, second.ownerUid],
      miterAngleDegrees: 45 as const,
    }];
  });
}

type CrownMiterEndpointTrim = {
  startTopShift: number;
  endTopShift: number;
};

/**
 * A sloped crown rail rises outward from the cabinet edge. At an exposed turn,
 * both rail tips must meet at one shared outer apex rather than extending past
 * it as two square-ended boards. Trim only the raised edge along each rail;
 * the cabinet-top edge stays at the measured exposed perimeter, so takeoff is
 * not changed.
 */
export function crownMiterEndpointTrims(
  segments: ThreeDCrownPerimeterSegment[],
  riseInches: number,
): CrownMiterEndpointTrim[] {
  const trims = segments.map(() => ({ startTopShift: 0, endTopShift: 0 }));
  const maxPhysicalShift = Math.max(0, riseInches);
  const boundedShift = (value: number) => Number.isFinite(value)
    ? Math.max(-maxPhysicalShift, Math.min(maxPhysicalShift, value))
    : 0;
  const endpointTolerance = 0.25;
  for (const joint of threeDCrownMiterJoints(segments)) {
    const endpoints = segments.flatMap((segment, segmentIndex) => [
      { segment, segmentIndex, atStart: true, point: segment.start },
      { segment, segmentIndex, atStart: false, point: segment.end },
    ]).filter((endpoint) =>
      Math.hypot(endpoint.point.x - joint.point.x, endpoint.point.z - joint.point.z) <= endpointTolerance,
    );
    if (endpoints.length !== 2) continue;
    const outward = endpoints.map(({ segment }) => {
      const length = Math.max(segment.length, 1e-6);
      const directionX = (segment.end.x - segment.start.x) / length;
      const directionZ = (segment.end.z - segment.start.z) / length;
      return { x: directionZ, z: -directionX };
    });
    const directions = endpoints.map(({ segment }) => {
      const length = Math.max(segment.length, 1e-6);
      return {
        x: (segment.end.x - segment.start.x) / length,
        z: (segment.end.z - segment.start.z) / length,
      };
    });
    const firstRaisedEdge = {
      x: joint.point.x + outward[0]!.x * riseInches,
      z: joint.point.z + outward[0]!.z * riseInches,
    };
    const secondRaisedEdge = {
      x: joint.point.x + outward[1]!.x * riseInches,
      z: joint.point.z + outward[1]!.z * riseInches,
    };
    const cross = directions[0]!.x * directions[1]!.z - directions[0]!.z * directions[1]!.x;
    if (Math.abs(cross) <= 1e-6) continue;
    const betweenRaisedEdges = {
      x: secondRaisedEdge.x - firstRaisedEdge.x,
      z: secondRaisedEdge.z - firstRaisedEdge.z,
    };
    const firstShift = (betweenRaisedEdges.x * directions[1]!.z - betweenRaisedEdges.z * directions[1]!.x) / cross;
    const secondShift = (betweenRaisedEdges.x * directions[0]!.z - betweenRaisedEdges.z * directions[0]!.x) / cross;
    const shifts = [firstShift, secondShift];
    endpoints.forEach((endpoint, index) => {
      const trim = trims[endpoint.segmentIndex]!;
      // A crown cut may project only within the physical profile rise. Nearly
      // parallel or stale saved edges can otherwise create a mathematically huge
      // intersection and a long molding spike hanging across the room.
      const shift = boundedShift(shifts[index]!);
      if (endpoint.atStart) trim.startTopShift = shift;
      else trim.endTopShift = shift;
    });
  }
  return trims;
}

/** The three exposed local edges of a WDC pentagon: two returns and its diagonal front. */
export function diagonalCornerCrownSegments(bodyWidth: number, bodyDepth: number) {
  const vertices = diagonalCornerFootprintVertices(bodyWidth, bodyDepth);
  return [
    measuredCrownSegment("diagonal-corner", "right-return", vertices[1]!, vertices[2]!, 0, true),
    measuredCrownSegment("diagonal-corner", "diagonal-front", vertices[2]!, vertices[3]!, 0, true),
    measuredCrownSegment("diagonal-corner", "left-return", vertices[3]!, vertices[4]!, 0, true),
  ];
}

function worldCrownEdges(cabinet: PlacedCabinet, room: RoomData): ThreeDCrownPerimeterSegment[] {
  const cornerKind = placedCornerGeometryKind(cabinet);
  // An easy-reach/lazy-Susan wall corner is physically a 24-by-24 L, even
  // when its catalog row carries the normal 12-inch wall depth. Crown must use
  // the same normalized body envelope as the rendered cabinet or it will stop
  // at the shallow catalog rectangle instead of meeting both adjoining runs.
  const cornerBody = cornerKind === "l-shape" ? threeDCornerBodyDimensions(cabinet) : null;
  const width = Math.max(0.125, cornerBody?.width ?? numberValue(cabinet.width, 24));
  const depth = Math.max(0.125, cornerBody?.depth ?? numberValue(cabinet.depth, WALL_DEPTH));
  const transform = existingCabinetTransform(cabinet, room);
  const box = elevationBox(cabinet, room);
  const top = box.bottom + box.height;
  const diagonalCorner = cornerKind === "diagonal";
  const lCorner = cornerKind === "l-shape";
  const lCornerParts = lCorner
    ? lCornerCarcassParts(width, depth, cabinet.placement === "wall" ? 0.5 : cornerLegRatioForPlaced(cabinet))
    : null;
  const localEdges = diagonalCorner
    ? diagonalCornerCrownSegments(width, depth).map(({ kind, start, end }) => ({ kind, start, end }))
    : lCornerParts
      ? [
          // Only the two room-facing legs and their short exposed end returns
          // receive crown. The two back edges are seated against the walls.
          { kind: "right-return" as const, start: { x: width / 2, z: -depth / 2 }, end: { x: width / 2, z: -depth / 2 + lCornerParts.legDepth } },
          { kind: "front" as const, start: { x: width / 2, z: -depth / 2 + lCornerParts.legDepth }, end: { x: -width / 2 + lCornerParts.legWidth, z: -depth / 2 + lCornerParts.legDepth } },
          { kind: "front" as const, start: { x: -width / 2 + lCornerParts.legWidth, z: -depth / 2 + lCornerParts.legDepth }, end: { x: -width / 2 + lCornerParts.legWidth, z: depth / 2 } },
          { kind: "left-return" as const, start: { x: -width / 2 + lCornerParts.legWidth, z: depth / 2 }, end: { x: -width / 2, z: depth / 2 } },
        ]
    : [
        { kind: "right-return" as const, start: { x: width / 2, z: -depth / 2 }, end: { x: width / 2, z: depth / 2 } },
        { kind: "front" as const, start: { x: width / 2, z: depth / 2 }, end: { x: -width / 2, z: depth / 2 } },
        { kind: "left-return" as const, start: { x: -width / 2, z: depth / 2 }, end: { x: -width / 2, z: -depth / 2 } },
      ];
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const toWorld = (point: CrownPoint): CrownPoint => ({
    x: transform.x + point.x * cos + point.z * sin,
    z: transform.z - point.x * sin + point.z * cos,
  });
  return localEdges.map((edge) => measuredCrownSegment(
    cabinet.uid,
    edge.kind,
    toWorld(edge.start),
    toWorld(edge.end),
    top,
    diagonalCorner,
  ));
}

type CrownFootprint = {
  ownerUid: string;
  top: number;
  points: CrownPoint[];
};

function worldCrownFootprints(cabinet: PlacedCabinet, room: RoomData): CrownFootprint[] {
  const cornerKind = placedCornerGeometryKind(cabinet);
  const cornerBody = cornerKind === "l-shape" ? threeDCornerBodyDimensions(cabinet) : null;
  const width = Math.max(0.125, cornerBody?.width ?? numberValue(cabinet.width, 24));
  const depth = Math.max(0.125, cornerBody?.depth ?? numberValue(cabinet.depth, WALL_DEPTH));
  const transform = existingCabinetTransform(cabinet, room);
  const box = elevationBox(cabinet, room);
  const localPointSets = cornerKind === "l-shape"
    ? (() => {
        // The coverage helper clips against convex polygons. Preserve the
        // physical L as its two overlapping rectangular carcass legs instead
        // of replacing it with a square that would hide crown at a valid run.
        const parts = lCornerCarcassParts(width, depth, cabinet.placement === "wall" ? 0.5 : cornerLegRatioForPlaced(cabinet));
        const rectangle = (part: { width: number; depth: number; x: number; z: number }) => [
          { x: part.x - part.width / 2, z: part.z - part.depth / 2 },
          { x: part.x + part.width / 2, z: part.z - part.depth / 2 },
          { x: part.x + part.width / 2, z: part.z + part.depth / 2 },
          { x: part.x - part.width / 2, z: part.z + part.depth / 2 },
        ];
        return [rectangle(parts.backLeg), rectangle(parts.sideLeg)];
      })()
    : [cornerKind === "diagonal"
    ? diagonalCornerFootprintVertices(width, depth)
    : [
        { x: -width / 2, z: -depth / 2 },
        { x: width / 2, z: -depth / 2 },
        { x: width / 2, z: depth / 2 },
        { x: -width / 2, z: depth / 2 },
      ]];
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  return localPointSets.map((localPoints) => ({
    ownerUid: cabinet.uid,
    top: box.bottom + box.height,
    points: localPoints.map((point) => ({
      x: transform.x + point.x * cos + point.z * sin,
      z: transform.z - point.x * sin + point.z * cos,
    })),
  }));
}

/**
 * Clips a crown edge against the occupied side of another upper footprint.
 * The edge is probed 1/4 inch outward from its owner, which absorbs legacy
 * one-eighth-inch placement drift without moving either cabinet. Convex polygon
 * clipping then preserves exact longitudinal boundaries, so a 12-to-24-inch
 * depth step keeps its full exposed 12-inch wrap.
 */
function crownEdgeCoveredByFootprint(edge: ThreeDCrownPerimeterSegment, blocker: CrownFootprint) {
  const seamTolerance = 0.25 + 1e-6;
  // Rule: crown lives only at a cabinet's own top and is never drawn below the
  // top of another cabinet. A neighbouring body whose top is at the same height
  // merges with this rail (its own edges take over); a neighbouring body that
  // is TALLER physically occupies the space the rail would pass through (e.g.
  // the refrigerator bridge beside a ceiling-height pantry), so it blocks too.
  // Only a body whose top is BELOW this rail leaves the edge exposed.
  if (edge.top > blocker.top + seamTolerance || edge.length <= 1e-6 || blocker.points.length < 3) return null;
  const dx = edge.end.x - edge.start.x;
  const dz = edge.end.z - edge.start.z;
  const outwardX = dz / edge.length;
  const outwardZ = -dx / edge.length;
  const probeStart = {
    x: edge.start.x + outwardX * seamTolerance,
    z: edge.start.z + outwardZ * seamTolerance,
  };
  let start = 0;
  let end = 1;
  for (let index = 0; index < blocker.points.length; index += 1) {
    const polygonStart = blocker.points[index]!;
    const polygonEnd = blocker.points[(index + 1) % blocker.points.length]!;
    const polygonDx = polygonEnd.x - polygonStart.x;
    const polygonDz = polygonEnd.z - polygonStart.z;
    const constant = polygonDx * (probeStart.z - polygonStart.z) - polygonDz * (probeStart.x - polygonStart.x);
    const slope = polygonDx * dz - polygonDz * dx;
    if (Math.abs(slope) <= 1e-9) {
      if (constant < -1e-6) return null;
      continue;
    }
    const boundary = -constant / slope;
    if (slope > 0) start = Math.max(start, boundary);
    else end = Math.min(end, boundary);
    if (end - start <= 1e-6) return null;
  }
  const endpointTolerance = seamTolerance / edge.length;
  if (start <= endpointTolerance) start = 0;
  if (end >= 1 - endpointTolerance) end = 1;
  start = Math.max(0, start);
  end = Math.min(1, end);
  return end - start > 1e-5 ? { start, end } : null;
}

/**
 * Resolves only the exposed top perimeter of complete upper runs. Cabinet backs
 * are never candidates. Collinear side edges at touching cabinet junctions
 * cancel one another; a partial overlap leaves only the depth-step wrap.
 */
export function threeDCrownPerimeterSegments(placed: PlacedCabinet[], room: RoomData) {
  // Crown follows the outside perimeter of the complete upper/tall run, at each
  // cabinet's OWN top (the refrigerator bridge hangs at its own mount height).
  // Edges come only from crown-eligible cabinets, but every upper/tall body is a
  // physical blocker: a ceiling-height pantry or refrigerator surround that
  // receives no crown itself must still stop the neighbouring run's return so
  // no rail is ever drawn through a cabinet box.
  const cabinets = crownEligibleCabinets(placed, room);
  const edges = cabinets.flatMap((cabinet) => worldCrownEdges(cabinet, room));
  const footprints = crownBlockingCabinets(placed, room).flatMap((cabinet) => worldCrownFootprints(cabinet, room));
  const exposed: ThreeDCrownPerimeterSegment[] = [];
  for (const edge of edges) {
	    const covered = footprints
      .filter((blocker) => blocker.ownerUid !== edge.ownerUid)
	      .map((blocker) => crownEdgeCoveredByFootprint(edge, blocker))
	      .filter((range): range is { start: number; end: number } => range != null)
	      .sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const range of covered) {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end + 1e-5) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
    }
    let cursor = 0;
    const visibleRanges: Array<{ start: number; end: number }> = [];
    for (const range of merged) {
      if (range.start > cursor + 1e-5) visibleRanges.push({ start: cursor, end: range.start });
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < 1 - 1e-5) visibleRanges.push({ start: cursor, end: 1 });
    const dx = edge.end.x - edge.start.x;
    const dz = edge.end.z - edge.start.z;
    for (const range of visibleRanges) {
      const start = { x: edge.start.x + dx * range.start, z: edge.start.z + dz * range.start };
      const end = { x: edge.start.x + dx * range.end, z: edge.start.z + dz * range.end };
      exposed.push(measuredCrownSegment(edge.ownerUid, edge.kind, start, end, edge.top, edge.diagonalCorner));
    }
  }
  return exposed;
}

function createAngledCrownRailGeometry(
  segment: ThreeDCrownPerimeterSegment,
  rise: number,
  thickness: number,
  trim: CrownMiterEndpointTrim,
) {
  const directionX = (segment.end.x - segment.start.x) / Math.max(segment.length, 1e-6);
  const directionZ = (segment.end.z - segment.start.z) / Math.max(segment.length, 1e-6);
  const outwardX = directionZ;
  const outwardZ = -directionX;
  const profileThickness = thickness / Math.SQRT2;
  const profilePoints = (x: number, z: number, topShift: number) => {
    const base = [x, segment.top * INCH, z];
    const slope = [outwardX * rise, rise, outwardZ * rise];
    const normal = [-outwardX * profileThickness, profileThickness, -outwardZ * profileThickness];
    const along = [directionX * topShift * INCH, 0, directionZ * topShift * INCH];
    return [
      base,
      [base[0] + slope[0] + along[0], base[1] + slope[1], base[2] + slope[2] + along[2]],
      [base[0] + slope[0] + normal[0] + along[0], base[1] + slope[1] + normal[1], base[2] + slope[2] + normal[2] + along[2]],
      [base[0] + normal[0], base[1] + normal[1], base[2] + normal[2]],
    ];
  };
  const start = profilePoints(segment.start.x * INCH, segment.start.z * INCH, trim.startTopShift);
  const end = profilePoints(segment.end.x * INCH, segment.end.z * INCH, trim.endTopShift);
  const positions = [...start, ...end].flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

export function addThreeDCrownMolding(
  root: THREE.Group,
  placed: PlacedCabinet[],
  room: RoomData,
  finishOverrides: Record<string, string> | undefined,
  fallbackColor: string,
) {
  const cabinetByUid = new Map(placed.map((cabinet) => [cabinet.uid, cabinet]));
  const segments = threeDCrownPerimeterSegments(placed, room);
  const crownProfileAngleRadians = Math.PI / 4;
  const crownProfileRise = 3 * INCH;
  const miterTrims = crownMiterEndpointTrims(segments, crownProfileRise / INCH);
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex]!;
    const cabinet = cabinetByUid.get(segment.ownerUid);
    if (!cabinet) continue;
    const railThickness = 0.075;
    const ownerGroup = root.children.find((node) => node.userData.placedUid === cabinet.uid);
    let ownerFinishMaterial: THREE.MeshStandardMaterial | null = null;
    ownerGroup?.traverse((node) => {
      if (ownerFinishMaterial || !(node instanceof THREE.Mesh)) return;
      const candidate = Array.isArray(node.material) ? node.material[0] : node.material;
      if (candidate instanceof THREE.MeshStandardMaterial && candidate.userData.selectedFinishSideSkin === true) {
        ownerFinishMaterial = candidate;
      }
    });
    // Sharing the owner cabinet's structural material keeps asynchronous sample
    // loading synchronized across its exposed side, toe kick, and crown.
    const material = ownerFinishMaterial
      ?? new THREE.MeshStandardMaterial({ color: finishOverrides?.[cabinet.uid] ?? fallbackColor, roughness: 0.58, metalness: 0.01 });
    const rail = new THREE.Mesh(
      createAngledCrownRailGeometry(
        segment,
        crownProfileRise,
        railThickness,
        miterTrims[segmentIndex] ?? { startTopShift: 0, endTopShift: 0 },
      ),
      material,
    );
    rail.userData = {
      crownMolding: true,
      continuousCabinetTrim: true,
      placementUid: segment.ownerUid,
      crownMoldingFront: segment.kind === "front" || segment.kind === "diagonal-front",
      crownMoldingReturn: segment.kind === "left-return" || segment.kind === "right-return",
      diagonalCornerCrown: segment.diagonalCorner,
      exposedTopEdge: true,
      segment: segment.kind,
      continuousRunOverlap: true,
      selectedFinishStructuralSurface: true,
      sharesOwnerCabinetFinishMaterial: Boolean(ownerFinishMaterial),
      angledCrownProfile: true,
      crownProfileAngleDegrees: 45,
      crownProfileRiseInches: crownProfileRise / INCH,
      crownProfileOutwardRunInches: crownProfileRise / INCH,
      isUprightCrownProfile: false,
      flushOutsideMiter: true,
    };
    root.add(rail);
  }
}

export type ThreeDContinuousToeKickSegment = {
  wallId: string;
  start: number;
  end: number;
  depth: number;
  memberUids: string[];
  includesInstalledFiller: boolean;
  anchorUid: string;
};

/**
 * Merges touching base cabinets and their installed fillers into one recessed
 * toe-kick board. It uses the same wallId/wallOffset path on standard rooms,
 * measured walls, and peninsulas; a true gap or a change in cabinet depth
 * remains a physical break rather than an invented bridge.
 */
export function threeDContinuousToeKickSegments(placed: PlacedCabinet[], room: RoomData): ThreeDContinuousToeKickSegment[] {
  const candidates = placed.flatMap((cabinet) => {
    if (cabinet.placement !== "base" || placedCornerGeometryKind(cabinet) !== "standard") return [];
    const wallId = cabinetWall(cabinet, room);
    if (!wallRunFrame(wallId, room)) return [];
    // A free-standing box in the middle of the room is only *nearest* to this
    // wall; it has no wall run, so it keeps its own toe kick instead of
    // projecting a board onto the wall it does not touch.
    if (!cabinet.wallId && !isAgainstWall(cabinet, wallId, room)) return [];
    const start = wallRunOffset(cabinet, wallId, room);
    const end = start + wallRunSpan(cabinet, wallId, room);
    const depth = Math.max(0, Number(cabinet.depth) || STD.BASE_DEPTH);
    return end > start + 0.001 ? [{ cabinet, wallId, start, end, depth, isFiller: isFillerItem(cabinet) }] : [];
  }).sort((left, right) => left.wallId.localeCompare(right.wallId) || left.depth - right.depth || left.start - right.start);

  const runs: ThreeDContinuousToeKickSegment[] = [];
  for (const candidate of candidates) {
    const last = runs.at(-1);
    const sameRun = last
      && last.wallId === candidate.wallId
      && Math.abs(last.depth - candidate.depth) <= 0.125
      && candidate.start <= last.end + 0.125;
    if (sameRun) {
      last.end = Math.max(last.end, candidate.end);
      last.memberUids.push(candidate.cabinet.uid);
      last.includesInstalledFiller ||= candidate.isFiller;
      continue;
    }
    runs.push({
      wallId: candidate.wallId,
      start: candidate.start,
      end: candidate.end,
      depth: candidate.depth,
      memberUids: [candidate.cabinet.uid],
      includesInstalledFiller: candidate.isFiller,
      anchorUid: candidate.cabinet.uid,
    });
  }
  return runs;
}

/** Renders the selected continuous toe-kick trim without altering cabinet or filler purchase data. */
export function addThreeDContinuousToeKicks(
  root: THREE.Group,
  segments: ThreeDContinuousToeKickSegment[],
  room: RoomData,
  finishOverrides: Record<string, string> | undefined,
  fallbackColor: string,
) {
  for (const segment of segments) {
    const frame = wallRunFrame(segment.wallId, room);
    if (!frame || segment.end <= segment.start + 0.001) continue;
    const length = segment.end - segment.start;
    const midpoint = segment.start + length / 2;
    // The board is recessed three inches from the cabinet face on its own run.
    const inset = Math.max(0, segment.depth - 3);
    const center = {
      x: frame.start.x + frame.tangent.x * midpoint + frame.inward.x * inset,
      y: frame.start.y + frame.tangent.y * midpoint + frame.inward.y * inset,
    };
    const ownerGroup = root.children.find((node) => node.userData.placedUid === segment.anchorUid);
    let ownerFinishMaterial: THREE.MeshStandardMaterial | null = null;
    ownerGroup?.traverse((node) => {
      if (ownerFinishMaterial || !(node instanceof THREE.Mesh)) return;
      const candidate = Array.isArray(node.material) ? node.material[0] : node.material;
      if (candidate instanceof THREE.MeshStandardMaterial && candidate.userData.selectedFinishSideSkin === true) ownerFinishMaterial = candidate;
    });
    const material = ownerFinishMaterial
      ?? new THREE.MeshStandardMaterial({ color: finishOverrides?.[segment.anchorUid] ?? fallbackColor, roughness: 0.48, metalness: 0.01 });
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(length * INCH + 0.01, STD.TOE_KICK * INCH, 0.055),
      material,
    );
    board.position.set(center.x * INCH, STD.TOE_KICK * INCH / 2, center.y * INCH);
    board.rotation.y = threeDPlanRotation(frame.facingRotation * Math.PI / 180);
    board.userData = {
      continuousToeKick: true,
      continuousCabinetTrim: true,
      placementUid: segment.anchorUid,
      memberUids: [...segment.memberUids],
      wallId: segment.wallId,
      runStartIn: segment.start,
      runEndIn: segment.end,
      runLengthIn: length,
      toeKickHeightIn: STD.TOE_KICK,
      toeKickRecessIn: 3,
      includesInstalledFiller: segment.includesInstalledFiller,
      selectedFinishStructuralSurface: true,
      sharesOwnerCabinetFinishMaterial: Boolean(ownerFinishMaterial),
    };
    root.add(board);
  }
}

export type ThreeDGlassStackerRearSupportSpec = {
  stackerUid: string;
  parentUid: string;
  width: number;
  height: number;
  stackerDepth: number;
  gapDepth: number;
};

/**
 * Returns the concealed pack-out needed when a shallow glass stacker is seated
 * flush with the face of a deeper 24-inch upper. A same-finish rear filler hides
 * the chase while a simple 2x4-style frame supports the stacker from behind.
 */
export function threeDGlassStackerRearSupportSpecs(placed: PlacedCabinet[]): ThreeDGlassStackerRearSupportSpec[] {
  const byUid = new Map(placed.map((cabinet) => [cabinet.uid, cabinet]));
  return placed.flatMap((stacker) => {
    if (!stacker.stackedOnCabinetUid || !isStacker(stacker) || !isGlassDoorCabinet(stacker)) return [];
    const parent = byUid.get(stacker.stackedOnCabinetUid);
    if (!parent) return [];
    const parentDepth = Math.max(0, Number(parent.depth) || STD.WALL_DEPTH);
    const stackerDepth = Math.max(0, Number(stacker.depth) || STD.WALL_DEPTH);
    const gapDepth = parentDepth - stackerDepth;
    if (gapDepth <= 0.25) return [];
    return [{
      stackerUid: stacker.uid,
      parentUid: parent.uid,
      width: Math.max(0.125, Number(stacker.width) || Number(parent.width) || 24),
      height: Math.max(0.125, Number(stacker.height) || 12),
      stackerDepth,
      gapDepth,
    }];
  });
}

export function addThreeDGlassStackerRearSupports(
  root: THREE.Group,
  placed: PlacedCabinet[],
  room: RoomData,
  finishOverrides: Record<string, string> | undefined,
  fallbackColor: string,
) {
  const byUid = new Map(placed.map((cabinet) => [cabinet.uid, cabinet]));
  for (const support of threeDGlassStackerRearSupportSpecs(placed)) {
    const stacker = byUid.get(support.stackerUid);
    if (!stacker) continue;
    const transform = existingCabinetTransform(stacker, room);
    const box = elevationBox(stacker, room);
    const ownerGroup = root.children.find((node) => node.userData.placedUid === stacker.uid);
    let ownerFinishMaterial: THREE.MeshStandardMaterial | null = null;
    ownerGroup?.traverse((node) => {
      if (ownerFinishMaterial || !(node instanceof THREE.Mesh)) return;
      const candidate = Array.isArray(node.material) ? node.material[0] : node.material;
      if (candidate instanceof THREE.MeshStandardMaterial && candidate.userData.selectedFinishSideSkin === true) {
        ownerFinishMaterial = candidate;
      }
    });
    const material = ownerFinishMaterial
      ?? new THREE.MeshStandardMaterial({
        color: finishOverrides?.[stacker.uid] ?? fallbackColor,
        roughness: 0.62,
        metalness: 0,
      });
    const group = new THREE.Group();
    group.position.set(transform.x * INCH, 0, transform.z * INCH);
    group.rotation.y = transform.rotation;
    group.userData = {
      glassStackerRearSupport: true,
      stackerUid: support.stackerUid,
      parentUid: support.parentUid,
      concealedTwoByFourFrame: true,
      rearFillerPanel: true,
      gapDepthInches: support.gapDepth,
    };

    const rearPanelThickness = Math.min(0.75, support.gapDepth);
    const rearPanel = new THREE.Mesh(
      new THREE.BoxGeometry(support.width * INCH, support.height * INCH, rearPanelThickness * INCH),
      material,
    );
    rearPanel.position.set(
      0,
      (box.bottom + support.height / 2) * INCH,
      (-support.stackerDepth / 2 - support.gapDepth + rearPanelThickness / 2) * INCH,
    );
    rearPanel.userData = { glassStackerRearFiller: true, concealedSupport: true };
    group.add(rearPanel);

    // Close both exposed ends of the pack-out with thin, finish-matched filler
    // panels. The 2x4 rails remain concealed instead of showing as a beige box
    // beside the refrigerator upper when viewed from an open end of the run.
    const sidePanelThickness = Math.min(0.75, support.width / 2);
    for (const side of [-1, 1] as const) {
      const sidePanel = new THREE.Mesh(
        new THREE.BoxGeometry(sidePanelThickness * INCH, support.height * INCH, support.gapDepth * INCH),
        material,
      );
      sidePanel.position.set(
        side * (support.width / 2 - sidePanelThickness / 2) * INCH,
        (box.bottom + support.height / 2) * INCH,
        (-support.stackerDepth / 2 - support.gapDepth / 2) * INCH,
      );
      sidePanel.userData = {
        glassStackerRearFillerSide: side === -1 ? "left" : "right",
        concealedSupport: true,
        selectedFinishStructuralSurface: true,
      };
      group.add(sidePanel);
    }

    const railHeight = Math.min(3.5, support.height / 2);
    for (const verticalCenter of [box.bottom + railHeight / 2, box.bottom + support.height - railHeight / 2]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(support.width * INCH, railHeight * INCH, support.gapDepth * INCH),
        material,
      );
      rail.position.set(0, verticalCenter * INCH, (-support.stackerDepth / 2 - support.gapDepth / 2) * INCH);
      rail.userData = { glassStackerTwoByFourSupport: true, concealedSupport: true };
      group.add(rail);
    }
    group.userData.sharesOwnerCabinetFinishMaterial = Boolean(ownerFinishMaterial);
    root.add(group);
  }
}

/**
 * A hood must share the range center along its wall axis. Older plans can retain
 * a small manual x/y nudge from drag placement; preserving that offset makes the
 * hood float beside its cooktop in 3D even though both records represent one
 * range zone in the 2D plan.
 */
export function savedRangeHoodTransform(
  hood: PlacedCabinet,
  placed: PlacedCabinet[],
  room: RoomData,
) {
  const transform = existingCabinetTransform(hood, room);
  if (!/^HOOD[-_]?/i.test(hood.masterCode ?? "")) return transform;
  if (hood.rangeHoodPositionAdjusted) return transform;
  const hoodRotation = ((Number(hood.rotation) % 360) + 360) % 360;
  const range = placed.find((item) => {
    if (!/^RANGE[-_]?/i.test(item.masterCode ?? "")) return false;
    const rangeRotation = ((Number(item.rotation) % 360) + 360) % 360;
    return rangeRotation === hoodRotation;
  });
  if (!range) return transform;
  const rangeTransform = existingCabinetTransform(range, room);
  // A 90°/270° appliance sits on a left/right wall, so Z is the along-wall
  // center; otherwise X is the along-wall center.
  if (hoodRotation === 90 || hoodRotation === 270) return { ...transform, z: rangeTransform.z };
  return { ...transform, x: rangeTransform.x };
}

export function threeDWallDragGhostBox(candidate: PlacedCabinet, room: RoomData) {
  const transform = existingCabinetTransform(candidate, room);
  const footprint = placedFootprint(candidate);
  const box = elevationBox(candidate, room);
  return {
    position: { x: transform.x * INCH, y: (box.bottom + box.height / 2) * INCH, z: transform.z * INCH },
    size: {
      width: Math.max(0.125, footprint.w * INCH),
      height: Math.max(0.125, box.height * INCH),
      depth: Math.max(0.125, footprint.d * INCH),
    },
  };
}

/** When a saved range zone has both an old microwave placeholder and a true hood,
 * display the explicit hood above the cooktop instead of drawing both appliances
 * into the same 2D coordinate. */
export function shouldRenderSavedSceneCabinet(cabinet: PlacedCabinet, placed: PlacedCabinet[]) {
	if (cabinet.integratedWallBlindFiller) return false;
  if (!/^MW[-_]?/i.test(cabinet.masterCode ?? "")) return true;
  const microwaveRotation = ((Number(cabinet.rotation) % 360) + 360) % 360;
  const matchingRange = placed.some((item) => /^RANGE[-_]?/i.test(item.masterCode ?? "")
    && ((Number(item.rotation) % 360) + 360) % 360 === microwaveRotation);
  const matchingHood = placed.some((item) => /^HOOD[-_]?/i.test(item.masterCode ?? "")
    && ((Number(item.rotation) % 360) + 360) % 360 === microwaveRotation);
  return !(matchingRange && matchingHood);
}

/**
 * Older CDB saves sometimes stored only the accessible 24-inch leg depth.
 * The 2D corner-drawer drawing is nevertheless a full 36-by-36 L footprint,
 * so normalize before deriving either its scene body or its 2D-to-3D center.
 */
export function normalizedThreeDFootprint(cabinet: PlacedCabinet) {
  const cornerDrawer = /^cdb[-_]?\d/i.test(cabinet.masterCode) || /corner drawer base/i.test(cabinet.description ?? "");
  if (!cornerDrawer) return placedFootprint(cabinet);
  const size = Math.max(24, Number((cabinet.masterCode.match(/(\d{2})/) ?? [])[1]) || 36);
  return placedFootprint({ ...cabinet, width: size, depth: size });
}

/**
 * Three.js rotates a local cabinet box after its dimensions are applied, while
 * the 2D placed footprint is already expressed in world axes. Reuse the shared
 * 2D footprint for every corner family, then reverse a 90°/270° turn only for
 * the local mesh box. This keeps diagonal, L, blind, and end-return geometry
 * on the exact 2D envelope without double-applying rotation.
 */
export function threeDCornerBodyDimensions(cabinet: PlacedCabinet) {
  const sharedKind = placedCornerGeometryKind(cabinet);
  const isSharedCorner = sharedKind !== "standard";
  if (!isSharedCorner) return null;
  const footprint = normalizedThreeDFootprint(cabinet);
  const rotation = ((Number(cabinet.rotation) % 360) + 360) % 360;
  const quarterTurn = rotation === 90 || rotation === 270;
  return quarterTurn
    ? { width: footprint.d, depth: footprint.w }
    : { width: footprint.w, depth: footprint.d };
}

export function sinkFixtureTransform(sink: SinkFixture) {
  const planRotation = Number.isFinite(sink.planRotation) ? Number(sink.planRotation) * Math.PI / 180 : 0;
  return {
    x: (sink.x + sink.width / 2) * INCH,
    z: (sink.y + sink.depth / 2) * INCH,
    countertopTop: COUNTERTOP_TOP * INCH,
    rotation: threeDPlanRotation(planRotation),
  };
}

export function sinkFaucetTransform(sink: SinkFixture) {
  const sinkTransform = sinkFixtureTransform(sink);
  const sinkDepth = sink.sourceDepth ?? sink.depth;
  // New non-apron fixtures carry an explicit rear-deck datum. Preserve the
  // pre-Part-1 offset for legacy unowned/free fixtures until a linked restore
  // can safely derive their countertop relationship.
  const offset = sink.faucetRearDeckOffsetIn == null
    ? sinkDepth * 0.31
    : sinkDepth / 2 + sink.faucetRearDeckOffsetIn;
  const back = sink.wallSide === "bottom"
    ? { x: 0, z: offset * INCH }
    : sink.wallSide === "left"
      ? { x: -offset * INCH, z: 0 }
      : sink.wallSide === "right"
        ? { x: offset * INCH, z: 0 }
        : { x: 0, z: -offset * INCH };
  return {
    x: sinkTransform.x + back.x,
    z: sinkTransform.z + back.z,
    countertopTop: sinkTransform.countertopTop,
    back,
  };
}

function roundedRectangleContour(width: number, depth: number, radius: number, cornerSegments = 6) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const cornerRadius = Math.max(0.001, Math.min(radius, halfWidth * 0.46, halfDepth * 0.46));
  const corners = [
    { x: halfWidth - cornerRadius, z: halfDepth - cornerRadius, start: 0 },
    { x: -halfWidth + cornerRadius, z: halfDepth - cornerRadius, start: Math.PI / 2 },
    { x: -halfWidth + cornerRadius, z: -halfDepth + cornerRadius, start: Math.PI },
    { x: halfWidth - cornerRadius, z: -halfDepth + cornerRadius, start: Math.PI * 1.5 },
  ];
  return corners.flatMap((corner) => Array.from({ length: cornerSegments }, (_, index) => {
    const angle = corner.start + (index / cornerSegments) * Math.PI / 2;
    return new THREE.Vector2(
      corner.x + Math.cos(angle) * cornerRadius,
      corner.z + Math.sin(angle) * cornerRadius,
    );
  }));
}

/**
 * Build only the four sloped interior walls of a sink bowl. The top remains
 * genuinely open and the separately rendered floor sits at the measured bowl
 * depth, avoiding the sealed rounded box that previously looked like a flat lid.
 */
export function recessedSinkBowlGeometry(width: number, depth: number, height: number, radius: number) {
  const sideInset = Math.min(1.25 * INCH, width * 0.12, depth * 0.12);
  const bottomWidth = Math.max(width * 0.58, width - sideInset * 2);
  const bottomDepth = Math.max(depth * 0.58, depth - sideInset * 2);
  const topContour = roundedRectangleContour(width, depth, radius);
  const bottomContour = roundedRectangleContour(bottomWidth, bottomDepth, Math.max(0.025, radius * 0.66));
  const positions: number[] = [];
  const indices: number[] = [];
  topContour.forEach((point) => positions.push(point.x, 0, point.y));
  bottomContour.forEach((point) => positions.push(point.x, -height, point.y));
  for (let index = 0; index < topContour.length; index++) {
    const next = (index + 1) % topContour.length;
    const bottomIndex = index + topContour.length;
    const bottomNext = next + topContour.length;
    indices.push(index, next, bottomIndex, next, bottomNext, bottomIndex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { openSinkBowlGeometry: true, bottomWidth, bottomDepth, measuredDepth: height };
  return geometry;
}

function sinkInteriorStencilMaterial<T extends THREE.Material>(material: T, stencilRef: number): T {
  material.depthTest = false;
  material.depthWrite = false;
  material.stencilWrite = true;
  material.stencilRef = stencilRef;
  material.stencilFunc = THREE.EqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}

export function addSinkFixture(root: THREE.Group, sink: SinkFixture) {
  const width = sink.width * INCH;
  const depth = sink.depth * INCH;
  const { x: centerX, z: centerZ, countertopTop, rotation } = sinkFixtureTransform(sink);
  const rotatesFixture = Math.abs(rotation) > 1e-9;
  const fixtureRoot = new THREE.Group();
  fixtureRoot.position.set(centerX, 0, centerZ);
  fixtureRoot.rotation.y = rotation;
  fixtureRoot.userData = { sinkFixtureGroup: true, sinkUid: sink.uid, planRotation: sink.planRotation ?? 0 };
  if (rotatesFixture) root.add(fixtureRoot);
  const addFixtureNode = (node: THREE.Object3D) => {
    if (!rotatesFixture) {
      root.add(node);
      return;
    }
    node.position.x -= centerX;
    node.position.z -= centerZ;
    fixtureRoot.add(node);
  };
  const sinkStencilRef = 1 + Array.from(sink.uid || `${sink.x}:${sink.y}:${sink.width}:${sink.depth}`).reduce(
    (hash, character) => ((hash * 31) + character.charCodeAt(0)) % 254,
    0,
  );
  const stainlessSteel = new THREE.MeshPhysicalMaterial({ color: "#d3dade", metalness: 0.9, roughness: 0.17, clearcoat: 0.28, clearcoatRoughness: 0.2 });
  const brushedStainlessSteel = new THREE.MeshPhysicalMaterial({ color: "#c0c8cc", metalness: 0.7, roughness: 0.28, clearcoat: 0.18, clearcoatRoughness: 0.32 });
  const stainlessBasinInterior = sinkInteriorStencilMaterial(new THREE.MeshPhysicalMaterial({ color: "#b6c0c5", metalness: 0.58, roughness: 0.3, clearcoat: 0.2, clearcoatRoughness: 0.3, side: THREE.DoubleSide }), sinkStencilRef);
  const isGunmetalBlack = sink.surfaceFinish === "gunmetal-black";
  const isVitreousChina = sink.surfaceFinish?.startsWith("vitreous-china") === true;
  const vitreousChinaColor = sink.surfaceFinish === "vitreous-china-black"
    ? "#292827"
    : sink.surfaceFinish === "vitreous-china-bone"
      ? "#e6dcc4"
      : sink.surfaceFinish === "vitreous-china-grey"
        ? "#a7a5a0"
        : "#f6f5f0";
  const vitreousChina = new THREE.MeshPhysicalMaterial({ color: vitreousChinaColor, metalness: 0.01, roughness: 0.14, clearcoat: 0.52, clearcoatRoughness: 0.12 });
  const vitreousChinaInterior = sinkInteriorStencilMaterial(new THREE.MeshPhysicalMaterial({ color: vitreousChinaColor, metalness: 0.01, roughness: 0.16, clearcoat: 0.46, clearcoatRoughness: 0.15, side: THREE.DoubleSide }), sinkStencilRef);
  const gunmetalSteel = new THREE.MeshPhysicalMaterial({ color: "#25292c", metalness: 0.78, roughness: 0.24, clearcoat: 0.2, clearcoatRoughness: 0.3 });
  const brushedGunmetalSteel = new THREE.MeshPhysicalMaterial({ color: "#383d41", metalness: 0.7, roughness: 0.32, clearcoat: 0.14, clearcoatRoughness: 0.36 });
  const gunmetalBasinInterior = sinkInteriorStencilMaterial(new THREE.MeshPhysicalMaterial({ color: "#202427", metalness: 0.66, roughness: 0.36, clearcoat: 0.16, clearcoatRoughness: 0.38, side: THREE.DoubleSide }), sinkStencilRef);
  const steel = isVitreousChina ? vitreousChina : isGunmetalBlack ? gunmetalSteel : stainlessSteel;
  const brushedSteel = isGunmetalBlack ? brushedGunmetalSteel : brushedStainlessSteel;
  const basinInterior = isVitreousChina ? vitreousChinaInterior : isGunmetalBlack ? gunmetalBasinInterior : stainlessBasinInterior;
  const sourceBowlWidth = sink.bowlWidth ?? Math.max(0, sink.sourceWidth ?? sink.width) - 3;
  const sourceBowlDepth = sink.bowlDepth ?? Math.max(0, sink.sourceDepth ?? sink.depth) - 3;
  const measuredDoubleBowl = sink.bowlCount === 2;
  const bowlPlans = measuredDoubleBowl
    ? [0, 1].map((bowlIndex) => sinkPlanDimensions(
      sink.bowlWidths?.[bowlIndex] ?? sourceBowlWidth,
      sink.bowlDepths?.[bowlIndex] ?? sourceBowlDepth,
      sink.wallSide,
    ))
    : [sinkPlanDimensions(sourceBowlWidth, sourceBowlDepth, sink.wallSide)];
  const bowlDimensions = bowlPlans.map((bowlPlan) => ({
    width: Math.max(0.26, bowlPlan.width * INCH),
    depth: Math.max(0.24, bowlPlan.depth * INCH),
  }));
  const innerWidth = bowlDimensions[0].width;
  const innerDepth = bowlDimensions[0].depth;
  const bowlHeights = bowlDimensions.map((_, bowlIndex) => Math.max(0.12, (sink.bowlHeights?.[bowlIndex] ?? sink.bowlHeight ?? 10) * INCH));
  const bowlHeight = bowlHeights[0];
  // A verified two-bowl profile gives the physical dimensions of each bowl.
  // Preserve those two measurements rather than stretching one generic basin.
  const lateralIsX = sink.wallSide !== "left" && sink.wallSide !== "right";
  const asymmetricDoubleBowl = measuredDoubleBowl && (
    bowlDimensions[0].width !== bowlDimensions[1].width || bowlDimensions[0].depth !== bowlDimensions[1].depth
  );
  const availableDividerSpan = lateralIsX ? width - innerWidth * 2 : depth - innerDepth * 2;
  const bowlSeparation = measuredDoubleBowl
    ? Math.max((lateralIsX ? innerWidth : innerDepth) / 2 + 0.04, (lateralIsX ? innerWidth : innerDepth) / 2 + availableDividerSpan * 0.25)
    : 0;
  const asymmetricLayout = (() => {
    if (!asymmetricDoubleBowl) return null;
    const lateralSpan = lateralIsX ? width : depth;
    const firstBowlSpan = lateralIsX ? bowlDimensions[0].width : bowlDimensions[0].depth;
    const secondBowlSpan = lateralIsX ? bowlDimensions[1].width : bowlDimensions[1].depth;
    const dividerGap = 0.055;
    const edgeInset = Math.max(0, (lateralSpan - firstBowlSpan - secondBowlSpan - dividerGap) / 2);
    const firstCenter = -lateralSpan / 2 + edgeInset + firstBowlSpan / 2;
    const secondCenter = firstCenter + firstBowlSpan / 2 + dividerGap + secondBowlSpan / 2;
    return { bowlOffsets: [firstCenter, secondCenter], dividerOffset: firstCenter + firstBowlSpan / 2 + dividerGap / 2 };
  })();
  const bowlOffsets = asymmetricLayout?.bowlOffsets ?? (measuredDoubleBowl ? [-bowlSeparation, bowlSeparation] : [0]);
  const openingBounds = bowlOffsets.reduce((bounds, lateralOffset, bowlIndex) => {
    const dimensions = bowlDimensions[bowlIndex] ?? bowlDimensions[0];
    const localX = lateralIsX ? lateralOffset : 0;
    const localZ = lateralIsX ? 0 : lateralOffset;
    return {
      minX: Math.min(bounds.minX, localX - dimensions.width / 2),
      maxX: Math.max(bounds.maxX, localX + dimensions.width / 2),
      minZ: Math.min(bounds.minZ, localZ - dimensions.depth / 2),
      maxZ: Math.max(bounds.maxZ, localZ + dimensions.depth / 2),
    };
  }, { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minZ: Number.POSITIVE_INFINITY, maxZ: Number.NEGATIVE_INFINITY });
  const outerMinX = -width / 2;
  const outerMaxX = width / 2;
  const outerMinZ = -depth / 2;
  const outerMaxZ = depth / 2;
  const openingMinX = Math.max(outerMinX + 0.018, openingBounds.minX);
  const openingMaxX = Math.min(outerMaxX - 0.018, openingBounds.maxX);
  const openingMinZ = Math.max(outerMinZ + 0.018, openingBounds.minZ);
  const openingMaxZ = Math.min(outerMaxZ - 0.018, openingBounds.maxZ);
  const rimHeight = 0.045;
  const rimSegments = [
    { side: "back", width, depth: openingMinZ - outerMinZ, x: 0, z: (outerMinZ + openingMinZ) / 2 },
    { side: "front", width, depth: outerMaxZ - openingMaxZ, x: 0, z: (openingMaxZ + outerMaxZ) / 2 },
    { side: "left", width: openingMinX - outerMinX, depth: openingMaxZ - openingMinZ, x: (outerMinX + openingMinX) / 2, z: (openingMinZ + openingMaxZ) / 2 },
    { side: "right", width: outerMaxX - openingMaxX, depth: openingMaxZ - openingMinZ, x: (openingMaxX + outerMaxX) / 2, z: (openingMinZ + openingMaxZ) / 2 },
  ];
  rimSegments.forEach((segment) => {
    if (segment.width <= 0.004 || segment.depth <= 0.004) return;
    const rimSegment = new THREE.Mesh(
      new RoundedBoxGeometry(segment.width, rimHeight, segment.depth, 3, Math.min(0.028, segment.width * 0.18, segment.depth * 0.18)),
      steel,
    );
    rimSegment.position.set(centerX + segment.x, countertopTop + 0.018, centerZ + segment.z);
    rimSegment.renderOrder = 24;
    rimSegment.userData = { sinkRim: true, sinkRimFrameSegment: true, sinkRimSide: segment.side, sinkMaterial: isVitreousChina ? "vitreous-china" : isGunmetalBlack ? "gunmetal-black" : "stainless-steel", openSinkCutout: true, fixtureDetail: true };
    addFixtureNode(rimSegment);
  });
  const openingWidth = Math.max(0.04, openingMaxX - openingMinX);
  const openingDepth = Math.max(0.04, openingMaxZ - openingMinZ);
  const openingCenterX = centerX + (openingMinX + openingMaxX) / 2;
  const openingCenterZ = centerZ + (openingMinZ + openingMaxZ) / 2;
  const cutoutMaskMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthTest: false, depthWrite: false });
  cutoutMaskMaterial.stencilWrite = true;
  cutoutMaskMaterial.stencilRef = sinkStencilRef;
  cutoutMaskMaterial.stencilFunc = THREE.AlwaysStencilFunc;
  cutoutMaskMaterial.stencilFail = THREE.ReplaceStencilOp;
  cutoutMaskMaterial.stencilZFail = THREE.ReplaceStencilOp;
  cutoutMaskMaterial.stencilZPass = THREE.ReplaceStencilOp;
  const openingShadow = new THREE.Mesh(
    new RoundedBoxGeometry(openingWidth, 0.012, openingDepth, 3, Math.min(0.07, openingWidth * 0.08, openingDepth * 0.08)),
    cutoutMaskMaterial,
  );
  openingShadow.position.set(openingCenterX, countertopTop + 0.012, openingCenterZ);
  openingShadow.renderOrder = 18;
  openingShadow.userData = { sinkCountertopCutoutMask: true, openSinkCutout: true, fixtureDetail: true };
  addFixtureNode(openingShadow);
  const hasMeasuredDrainInset = Number.isFinite(sink.drainInsetRight) || Number.isFinite(sink.drainInsetBack);
  const documentedDrainPosition = (bowlX: number, bowlZ: number, sourceMeasuredBowlWidthIn: number, sourceMeasuredBowlDepthIn: number) => {
    if (!hasMeasuredDrainInset) return { x: bowlX, z: bowlZ + sourceMeasuredBowlDepthIn * INCH * 0.18 };
    // A source may specify only one datum.  The omitted axis remains centered;
    // do not invent a second offset or fall back to the generic drain position.
    const rightOffset = Number.isFinite(sink.drainInsetRight)
      ? (sourceMeasuredBowlWidthIn / 2 - (sink.drainInsetRight ?? 0)) * INCH
      : 0;
    const backOffset = Number.isFinite(sink.drainInsetBack)
      ? (sourceMeasuredBowlDepthIn / 2 - (sink.drainInsetBack ?? 0)) * INCH
      : 0;
    switch (sink.wallSide ?? "top") {
      case "bottom": return { x: bowlX - rightOffset, z: bowlZ + backOffset };
      case "left": return { x: bowlX - backOffset, z: bowlZ - rightOffset };
      case "right": return { x: bowlX + backOffset, z: bowlZ + rightOffset };
      default: return { x: bowlX + rightOffset, z: bowlZ - backOffset };
    }
  };
  bowlOffsets.forEach((lateralOffset, bowlIndex) => {
    const bowlX = centerX + (lateralIsX ? lateralOffset : 0);
    const bowlZ = centerZ + (lateralIsX ? 0 : lateralOffset);
    const bowlDimensionsForIndex = bowlDimensions[bowlIndex] ?? bowlDimensions[0];
    const sourceBowlWidthForIndex = sink.bowlWidths?.[bowlIndex] ?? sourceBowlWidth;
    const sourceBowlDepthForIndex = sink.bowlDepths?.[bowlIndex] ?? sourceBowlDepth;
    const bowlHeightForIndex = bowlHeights[bowlIndex] ?? bowlHeight;
    const bowlInnerWidth = bowlDimensionsForIndex.width;
    const bowlInnerDepth = bowlDimensionsForIndex.depth;
    const bowlRadius = Math.min(0.12, bowlInnerWidth * 0.09, bowlInnerDepth * 0.09);
    const bowlGeometry = recessedSinkBowlGeometry(bowlInnerWidth, bowlInnerDepth, bowlHeightForIndex, bowlRadius);
    const bowl = new THREE.Mesh(bowlGeometry, basinInterior);
    bowl.position.set(bowlX, countertopTop, bowlZ);
    bowl.renderOrder = 20;
    bowl.userData = { sinkBowl: true, recessedSinkBowl: true, openSinkBowl: true, visibleInteriorDepth: true, bowlDepthIn: bowlHeightForIndex / INCH, sinkMaterial: isVitreousChina ? "vitreous-china" : isGunmetalBlack ? "gunmetal-black" : "stainless-steel", fixtureDetail: true, pelicanProfileId: sink.pelicanProfileId, sinkBowlIndex: bowlIndex + 1 };
    addFixtureNode(bowl);
    const floorInset = bowlGeometry.userData as { bottomWidth: number; bottomDepth: number };
    const bowlFloorMaterial = isVitreousChina
      ? sinkInteriorStencilMaterial(vitreousChina.clone(), sinkStencilRef)
      : sinkInteriorStencilMaterial(brushedSteel.clone(), sinkStencilRef);
    const bowlFloor = new THREE.Mesh(
      new RoundedBoxGeometry(floorInset.bottomWidth, 0.025, floorInset.bottomDepth, 4, Math.min(0.08, floorInset.bottomWidth * 0.07, floorInset.bottomDepth * 0.07)),
      bowlFloorMaterial,
    );
    bowlFloor.position.set(bowlX, countertopTop - bowlHeightForIndex + 0.014, bowlZ);
    bowlFloor.renderOrder = 21;
    bowlFloor.userData = { sinkBowlFloor: true, visibleSinkBowlBottom: true, recessedDepthIn: bowlHeightForIndex / INCH, sinkMaterial: isVitreousChina ? "vitreous-china" : isGunmetalBlack ? "gunmetal-black" : "stainless-steel", fixtureDetail: true, pelicanProfileId: sink.pelicanProfileId, sinkBowlIndex: bowlIndex + 1 };
    addFixtureNode(bowlFloor);
    const drainRadius = Math.min(1.75 * INCH, bowlInnerWidth * 0.12, bowlInnerDepth * 0.12);
    const drainMaterial = sinkInteriorStencilMaterial(steel.clone(), sinkStencilRef);
    drainMaterial.color.set(isGunmetalBlack ? "#0d1012" : "#556168");
    drainMaterial.metalness = 0.66;
    drainMaterial.roughness = 0.34;
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(drainRadius * 0.82, drainRadius * 0.82, 0.022, 32), drainMaterial);
    const drainPosition = documentedDrainPosition(bowlX, bowlZ, sourceBowlWidthForIndex, sourceBowlDepthForIndex);
    drain.position.set(drainPosition.x, countertopTop - bowlHeightForIndex + 0.03, drainPosition.z);
    drain.renderOrder = 22;
    drain.userData = { sinkDrain: true, drainAtBowlBottom: true, fixtureDetail: true, sinkBowlIndex: bowlIndex + 1, documentedDrainInset: hasMeasuredDrainInset };
    addFixtureNode(drain);
    const drainRingMaterial = sinkInteriorStencilMaterial(brushedSteel.clone(), sinkStencilRef);
    const drainRing = new THREE.Mesh(new THREE.TorusGeometry(drainRadius, 0.012, 8, 32), drainRingMaterial);
    drainRing.rotation.x = Math.PI / 2;
    drainRing.position.set(drain.position.x, drain.position.y + 0.013, drain.position.z);
    drainRing.renderOrder = 23;
    drainRing.userData = { sinkDrainRing: true, drainAtBowlBottom: true, fixtureDetail: true, sinkBowlIndex: bowlIndex + 1 };
    addFixtureNode(drainRing);
    [0.62, 0.34].forEach((scale, strainerIndex) => {
      const strainerMaterial = sinkInteriorStencilMaterial(brushedSteel.clone(), sinkStencilRef);
      const strainerRing = new THREE.Mesh(new THREE.TorusGeometry(drainRadius * scale, 0.0055, 6, 28), strainerMaterial);
      strainerRing.rotation.x = Math.PI / 2;
      strainerRing.position.set(drain.position.x, drainRing.position.y + 0.002 + strainerIndex * 0.001, drain.position.z);
      strainerRing.renderOrder = 23;
      strainerRing.userData = { sinkDrainStrainer: true, drainAtBowlBottom: true, fixtureDetail: true, sinkBowlIndex: bowlIndex + 1 };
      addFixtureNode(strainerRing);
    });
  });
  if (sink.apronFront) {
    const exteriorHeight = Math.max((sink.exteriorHeight ?? (sink.bowlHeight ?? 10)) * INCH, bowlHeight + 0.025, 0.18);
    const apronThickness = Math.min(0.12, depth * 0.2);
    const side = sink.wallSide ?? "top";
    const isSourceMeasuredStainlessApron = sink.pelicanProfileId === "pelican-pl-ha135-r0-retrofit-stainless-farmhouse";
    const apronMaterial = isGunmetalBlack
      ? steel
      : isSourceMeasuredStainlessApron
        ? steel
        : new THREE.MeshStandardMaterial({ color: "#f4f3ef", roughness: 0.2, metalness: 0.02 });
    const apron = new THREE.Mesh(
      new RoundedBoxGeometry(
        side === "left" || side === "right" ? apronThickness : width,
        exteriorHeight,
        side === "left" || side === "right" ? depth : apronThickness,
        4,
        Math.min(0.04, apronThickness * 0.25),
      ),
      apronMaterial,
    );
    const edgeInset = Math.max(0, (side === "left" || side === "right" ? depth : width) / 2 - apronThickness / 2);
    // A sink against the top/left wall faces into the room (positive Z/X); a
    // sink against the bottom/right wall faces in the negative direction.
    const direction = side === "bottom" ? -1 : side === "left" || side === "right" ? 0 : 1;
    const sidewaysDirection = side === "left" ? 1 : side === "right" ? -1 : 0;
    apron.position.set(
      centerX + sidewaysDirection * edgeInset,
      countertopTop - exteriorHeight / 2 + 0.006,
      centerZ + direction * edgeInset,
    );
    apron.userData = { sinkApronFront: true, sinkApronMaterial: isGunmetalBlack ? "gunmetal-black" : isSourceMeasuredStainlessApron ? "stainless-steel" : "fireclay", fixtureDetail: true, pelicanProfileId: sink.pelicanProfileId };
    addFixtureNode(apron);
  }
  if (sink.type === "double" || measuredDoubleBowl) {
    const dividerMaterial = sinkInteriorStencilMaterial(steel.clone(), sinkStencilRef);
    const divider = new THREE.Mesh(
      new RoundedBoxGeometry(
        lateralIsX ? 0.055 : innerWidth * 0.88,
        0.19,
        lateralIsX ? innerDepth * 0.88 : 0.055,
        3,
        0.02,
      ),
      dividerMaterial,
    );
    divider.position.set(
      centerX + (lateralIsX ? (asymmetricLayout?.dividerOffset ?? 0) : 0),
      countertopTop - 0.11,
      centerZ + (lateralIsX ? 0 : (asymmetricLayout?.dividerOffset ?? 0)),
    );
    divider.renderOrder = 22;
    divider.userData = { sinkBowlDivider: true, visibleInsideSinkCutout: true, fixtureDetail: true };
    addFixtureNode(divider);
  }
  if (!sink.faucet || !sink.pelicanFaucetProfileId || sink.faucetOverallHeight == null || sink.faucetSpoutLength == null || sink.faucetSpoutHeight == null || !sink.faucetForm) return;
  const faucet = sinkFaucetTransform(sink);
  const faucetMaterial = new THREE.MeshStandardMaterial({
    color: sink.faucetFinish === "matte-black"
      ? "#24272a"
      : sink.faucetFinish === "brushed-gold"
        ? "#b28a42"
        : sink.faucetFinish === "chrome"
          ? "#d8dde0"
          : sink.faucetFinish === "oil-rubbed-bronze"
            ? "#4a3328"
            : "#c8d0d4",
    metalness: sink.faucetFinish === "matte-black" ? 0.7 : 0.88,
    roughness: sink.faucetFinish === "matte-black" ? 0.32 : sink.faucetFinish === "oil-rubbed-bronze" ? 0.27 : sink.faucetFinish === "brushed-gold" ? 0.24 : 0.14,
  });
  if (sink.faucetForm === "wall-mounted-bridge") {
    const mountHeightIn = sink.faucetWallMountHeightAboveCountertopIn;
    const centerSpreadIn = sink.faucetCenterSpread;
    if (!sink.requiresProjectSpecificMountHeight || !Number.isFinite(mountHeightIn) || mountHeightIn! <= 0 || !Number.isFinite(centerSpreadIn) || centerSpreadIn! <= 0) return;
    const backLength = Math.hypot(faucet.back.x, faucet.back.z) || 1;
    const forward = { x: -faucet.back.x / backLength, z: -faucet.back.z / backLength };
    const group = new THREE.Group();
    group.position.set(
      faucet.x + faucet.back.x * 0.42,
      countertopTop + mountHeightIn! * INCH,
      faucet.z + faucet.back.z * 0.42,
    );
    group.rotation.y = Math.atan2(forward.x, forward.z);
    group.userData = {
      wallMountedSinkFaucet: true,
      pelicanFaucetProfileId: sink.pelicanFaucetProfileId,
      centerSpreadIn,
      mountHeightAboveCountertopIn: mountHeightIn,
      overallHeightIn: sink.faucetOverallHeight,
      spoutReachIn: sink.faucetSpoutLength,
      spoutHeightIn: sink.faucetSpoutHeight,
      sourceMeasuredGeometry: true,
      installation: "wall-mounted-8-inch-center",
    };
    const spread = centerSpreadIn! * INCH;
    const plateMaterial = faucetMaterial.clone();
    for (const x of [-spread / 2, spread / 2]) {
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.38 * INCH, 0.38 * INCH, 0.045 * INCH, 4, 0.03 * INCH), plateMaterial);
      plate.position.set(x, 0, -0.025 * INCH);
      plate.userData = { wallMountedSinkFaucetEscutcheon: true, sourceMeasuredGeometry: true };
      group.add(plate);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * INCH, 0.07 * INCH, 0.58 * INCH, 16), faucetMaterial);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(x, 0.025 * INCH, 0.11 * INCH);
      handle.userData = { wallMountedSinkFaucetHandle: true, sourceMeasuredGeometry: true };
      group.add(handle);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * INCH, 0.055 * INCH, spread, 16), faucetMaterial);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0, 0.04 * INCH);
    bridge.userData = { wallMountedSinkFaucetBridge: true, sourceMeasuredGeometry: true };
    group.add(bridge);
    const overallHeight = Math.max(0.25, sink.faucetOverallHeight! * INCH);
    const reach = Math.max(0.1, sink.faucetSpoutLength! * INCH);
    const outletHeight = Math.max(0.08, sink.faucetSpoutHeight! * INCH);
    const spoutPath = new THREE.CurvePath<THREE.Vector3>();
    const mount = new THREE.Vector3(0, 0, 0.06 * INCH);
    const crest = new THREE.Vector3(0, overallHeight, 0.06 * INCH);
    const outlet = new THREE.Vector3(0, outletHeight, reach);
    spoutPath.add(new THREE.LineCurve3(mount, crest));
    spoutPath.add(new THREE.LineCurve3(crest, outlet));
    const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutPath, 32, 0.036 * INCH, 10, false), faucetMaterial);
    spout.userData = { sinkFaucetSpout: true, wallMountedSinkFaucetSpout: true, sourceMeasuredGeometry: true, pelicanFaucetProfileId: sink.pelicanFaucetProfileId };
    group.add(spout);
    const aerator = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * INCH, 0.05 * INCH, 0.15 * INCH, 16), faucetMaterial);
    aerator.position.set(0, outletHeight - 0.075 * INCH, reach);
    aerator.userData = { wallMountedSinkFaucetAerator: true, sourceMeasuredGeometry: true };
    group.add(aerator);
    addFixtureNode(group);
    return;
  }
  const backLength = Math.hypot(faucet.back.x, faucet.back.z) || 1;
  const forward = { x: -faucet.back.x / backLength, z: -faucet.back.z / backLength };
  const side = { x: -forward.z, z: forward.x };
  const overallHeight = Math.max(0.25, sink.faucetOverallHeight * INCH);
  const reach = Math.max(0.1, sink.faucetSpoutLength * INCH);
  const outletHeight = Math.max(0.08, sink.faucetSpoutHeight * INCH);
  const faucetForm = sink.faucetForm;
  const tubeRadius = faucetForm === "standard-arc" ? 0.027 : 0.032;
  const measuredApexHeight = Math.max(0.25, overallHeight - tubeRadius);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.11, 20), faucetMaterial);
  base.position.set(faucet.x, countertopTop + 0.055, faucet.z);
  base.userData = { sinkFaucetBase: true, sinkFaucet: true, faucetPlacement: "back", fixtureDetail: true };
  addFixtureNode(base);
  const articulatedJointPoints = faucetForm === "articulated-swing"
    ? [
      new THREE.Vector3(faucet.x + forward.x * reach * 0.24, countertopTop + overallHeight * 0.7, faucet.z + forward.z * reach * 0.24),
      new THREE.Vector3(faucet.x + forward.x * reach * 0.68, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.68),
    ]
    : [];
  const curve = faucetForm === "articulated-swing"
    ? (() => {
      const basePoint = new THREE.Vector3(faucet.x, countertopTop + 0.09, faucet.z);
      const outlet = new THREE.Vector3(faucet.x + forward.x * reach, countertopTop + outletHeight, faucet.z + forward.z * reach);
      const path = new THREE.CurvePath<THREE.Vector3>();
      path.add(new THREE.LineCurve3(basePoint, articulatedJointPoints[0]!));
      path.add(new THREE.LineCurve3(articulatedJointPoints[0]!, articulatedJointPoints[1]!));
      path.add(new THREE.LineCurve3(articulatedJointPoints[1]!, outlet));
      return path;
    })()
    : faucetForm === "pull-out"
    ? (() => {
      const basePoint = new THREE.Vector3(faucet.x, countertopTop + 0.09, faucet.z);
      const apex = new THREE.Vector3(faucet.x + forward.x * reach * 0.22, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.22);
      const outlet = new THREE.Vector3(faucet.x + forward.x * reach, countertopTop + outletHeight, faucet.z + forward.z * reach);
      const path = new THREE.CurvePath<THREE.Vector3>();
      path.add(new THREE.LineCurve3(basePoint, apex));
      path.add(new THREE.QuadraticBezierCurve3(apex, new THREE.Vector3(faucet.x + forward.x * reach * 0.75, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.75), outlet));
      return path;
    })()
    : faucetForm === "standard-arc"
      ? (() => {
        const basePoint = new THREE.Vector3(faucet.x, countertopTop + 0.09, faucet.z);
        const apex = new THREE.Vector3(faucet.x + forward.x * reach * 0.24, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.24);
        const outlet = new THREE.Vector3(faucet.x + forward.x * reach, countertopTop + outletHeight, faucet.z + forward.z * reach);
        const path = new THREE.CurvePath<THREE.Vector3>();
        path.add(new THREE.QuadraticBezierCurve3(basePoint, new THREE.Vector3(faucet.x, countertopTop + measuredApexHeight * 0.72, faucet.z), apex));
        path.add(new THREE.QuadraticBezierCurve3(apex, new THREE.Vector3(faucet.x + forward.x * reach * 0.72, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.72), outlet));
        return path;
      })()
      : (() => {
        const basePoint = new THREE.Vector3(faucet.x, countertopTop + 0.09, faucet.z);
        const apex = new THREE.Vector3(faucet.x + forward.x * reach * 0.08, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.08);
        const outlet = new THREE.Vector3(faucet.x + forward.x * reach, countertopTop + outletHeight, faucet.z + forward.z * reach);
        const path = new THREE.CurvePath<THREE.Vector3>();
        path.add(new THREE.QuadraticBezierCurve3(basePoint, new THREE.Vector3(faucet.x, countertopTop + measuredApexHeight * 0.72, faucet.z), apex));
        path.add(new THREE.QuadraticBezierCurve3(apex, new THREE.Vector3(faucet.x + forward.x * reach * 0.7, countertopTop + measuredApexHeight, faucet.z + forward.z * reach * 0.7), outlet));
        return path;
      })();
  const spout = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, tubeRadius, 10, false), faucetMaterial);
  spout.userData = { sinkFaucetSpout: true, sinkFaucetArc: true, faucetPlacement: "back", fixtureDetail: true, pelicanFaucetProfileId: sink.pelicanFaucetProfileId, faucetFinish: sink.faucetFinish, faucetForm };
  addFixtureNode(spout);
  if (faucetForm === "articulated-swing") {
    articulatedJointPoints.forEach((position, index) => {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), faucetMaterial);
      joint.position.copy(position);
      joint.userData = { sinkFaucetSwingJoint: true, fixtureDetail: true, swingJointIndex: index + 1, pelicanFaucetProfileId: sink.pelicanFaucetProfileId };
      addFixtureNode(joint);
    });
  }
  if (faucetForm !== "standard-arc") {
    const sprayHead = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.04, faucetForm === "pull-out" ? 0.17 : 0.23, 16), faucetMaterial);
    sprayHead.position.set(faucet.x + forward.x * reach, countertopTop + outletHeight, faucet.z + forward.z * reach);
    sprayHead.userData = { sinkFaucetSprayHead: true, fixtureDetail: true, pelicanFaucetProfileId: sink.pelicanFaucetProfileId, faucetForm };
    addFixtureNode(sprayHead);
  }
  const handleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 16), faucetMaterial);
  handleBase.position.set(faucet.x + side.x * 0.12, countertopTop + 0.14, faucet.z + side.z * 0.12);
  handleBase.userData = { sinkFaucetHandleBase: true, fixtureDetail: true };
  // `addFixtureNode` converts a rotated sink's world-space part into the
  // fixture group's local coordinates in place. Capture the intended handle
  // position before attaching the base so a 90°/270° sink cannot reuse its
  // already-local coordinates as though they were world coordinates.
  const handleWorldX = faucet.x + side.x * 0.145;
  const handleWorldZ = faucet.z + side.z * 0.145;
  addFixtureNode(handleBase);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.035), faucetMaterial);
  handle.position.set(handleWorldX, countertopTop + 0.29, handleWorldZ);
  handle.rotation.z = side.x * -0.32;
  handle.rotation.x = side.z * 0.32;
  handle.userData = { sinkFaucetHandle: true, fixtureDetail: true };
  addFixtureNode(handle);
}

/**
 * Exact wall-anchor transform for a persisted range-associated pot filler.
 * `forward` follows the range front into the room; the wall stays directly
 * behind the range even on a 45° custom wall.
 */
export function potFillerWallMountTransform(
  fixture: PotFillerFixture,
  range: PlacedCabinet,
  room: RoomData,
) {
  const rangeTransform = existingCabinetTransform(range, room);
  const depthIn = numberValue(normalizedThreeDFootprint(range).d, COUNTERTOP_DEPTH_IN);
  const forward = { x: Math.sin(rangeTransform.rotation), z: Math.cos(rangeTransform.rotation) };
  const wallOffset = depthIn / 2 + 0.03;
  return {
    x: (rangeTransform.x - forward.x * wallOffset) * INCH,
    y: (STD.RANGE_COOKING_SURFACE_HEIGHT + fixture.mountHeightAboveCooktopIn) * INCH,
    z: (rangeTransform.z - forward.z * wallOffset) * INCH,
    rotation: rangeTransform.rotation,
    reach: fixture.spoutReachIn * INCH,
    armDatum: fixture.armDatumIn * INCH,
  };
}

/** Render the documented deployed reach envelope, never an invented pivot angle. */
export function addPotFillerFixture(
  root: THREE.Group,
  fixture: PotFillerFixture,
  range: PlacedCabinet,
  room: RoomData,
) {
  const transform = potFillerWallMountTransform(fixture, range, room);
  const finishColor = fixture.finish === "matte-black"
    ? "#24272a"
    : fixture.finish === "brushed-gold"
      ? "#b28a42"
      : fixture.finish === "chrome"
        ? "#d8dde0"
        : "#c8d0d4";
  const material = new THREE.MeshStandardMaterial({
    color: finishColor,
    metalness: fixture.finish === "matte-black" ? 0.68 : 0.9,
    roughness: fixture.finish === "matte-black" ? 0.32 : fixture.finish === "brushed-gold" ? 0.24 : 0.16,
  });
  const group = new THREE.Group();
  group.position.set(transform.x, transform.y, transform.z);
  group.rotation.y = transform.rotation;
  group.userData = {
    potFillerFixture: true,
    fixtureUid: fixture.uid,
    rangeUid: fixture.rangeUid,
    mountingWallId: fixture.mountingWallId,
    pelicanProductId: fixture.pelicanProductId,
    pelicanCode: fixture.pelicanCode,
    pelicanProfileId: fixture.pelicanProfileId,
    finish: fixture.finish,
    spoutReachIn: fixture.spoutReachIn,
    overallSpanIn: fixture.overallSpanIn,
    armDatumIn: fixture.armDatumIn,
    fixtureHeightIn: fixture.fixtureHeightIn,
    outletDatumIn: fixture.outletDatumIn,
    mountHeightAboveCooktopIn: fixture.mountHeightAboveCooktopIn,
    sourceMeasuredGeometry: true,
    articulationState: "deployed-reach-envelope-not-an-invented-pivot-angle",
  };
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.055, 3, 0.025), material);
  plate.position.set(0, 0, -0.028);
  plate.userData = { potFillerWallPlate: true, sourceMeasuredGeometry: true };
  group.add(plate);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.115, 0.3, 20), material);
  valve.rotation.x = Math.PI / 2;
  valve.position.z = 0.12;
  valve.userData = { potFillerValveBody: true, sourceMeasuredGeometry: true };
  group.add(valve);
  const firstArmLength = Math.min(transform.armDatum, transform.reach);
  const secondArmLength = Math.max(0, transform.reach - firstArmLength);
  const addArm = (length: number, centerZ: number, segment: 1 | 2) => {
    if (length <= 0.001) return;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, length, 16), material);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = centerZ;
    arm.userData = { potFillerArm: true, sourceMeasuredGeometry: true, armSegment: segment, lengthIn: length / INCH };
    group.add(arm);
  };
  addArm(firstArmLength, 0.15 + firstArmLength / 2, 1);
  addArm(secondArmLength, 0.15 + firstArmLength + secondArmLength / 2, 2);
  [0.15, 0.15 + firstArmLength].forEach((z, index) => {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), material);
    joint.position.z = z;
    joint.userData = { potFillerSwingJoint: true, sourceMeasuredGeometry: true, swingJointIndex: index + 1 };
    group.add(joint);
  });
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.13, 16), material);
  outlet.position.set(0, -0.065, 0.15 + transform.reach);
  outlet.userData = { potFillerOutlet: true, sourceMeasuredGeometry: true, sourceOutletDatumIn: fixture.outletDatumIn };
  group.add(outlet);
  root.add(group);
  return group;
}

export function islandZoneTransform(island: { x: number; y: number; width: number; depth: number }) {
  return {
    x: (island.x + island.width / 2) * INCH,
    z: (island.y + island.depth / 2) * INCH,
    guideWidth: island.width * INCH,
    guideDepth: island.depth * INCH,
    counterTop: COUNTERTOP_H * INCH,
  };
}

export function ponyWallTransform(ponyWall: PonyWall, room?: Pick<RoomData, "width" | "depth" | "peninsulaRuns">) {
  const frame = room ? ponyWallPlanFrame(ponyWall, room) : null;
  const radians = frame?.radians ?? ((Number(ponyWall.rotation) || 0) * Math.PI) / 180;
  const width = frame?.width ?? ponyWall.width;
  const depth = frame?.depth ?? ponyWall.depth;
  const height = frame?.height ?? ponyWall.height;
  const center = frame
    ? (() => {
        const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
        const normal = { x: -tangent.y, y: tangent.x };
        // Attached frames begin at a centerline endpoint. Legacy free-standing
        // frames begin at their top-left corner and retain that original box
        // convention even when their optional rotation is present.
        const lateral = frame.attachedToPeninsula ? 0 : depth / 2;
        return {
          x: frame.start.x + tangent.x * width / 2 + normal.x * lateral,
          y: frame.start.y + tangent.y * width / 2 + normal.y * lateral,
        };
      })()
    : { x: ponyWall.x + width / 2, y: ponyWall.y + depth / 2 };
  return {
    x: center.x * INCH,
    y: height * INCH / 2,
    z: center.y * INCH,
    width: width * INCH,
    depth: depth * INCH,
    height: height * INCH,
    rotation: Math.abs(radians) <= 1e-12 ? 0 : -radians,
  };
}

export function furnitureTransform(furniture: Pick<PlacedFurniture, "x" | "y" | "rotation">, widthIn: number, depthIn: number) {
  return {
    x: (furniture.x + widthIn / 2) * INCH,
    z: (furniture.y + depthIn / 2) * INCH,
    rotation: (furniture.rotation || 0) * Math.PI / 180,
  };
}

export function bathroomFurnitureTransform(furniture: PlacedFurniture) {
  const frame = furniturePlanFrame(furniture)!;
  return { x: frame.centerX * INCH, z: frame.centerY * INCH, rotation: -frame.rotation * Math.PI / 180 };
}

export function addIslandZone(
  root: THREE.Group,
  island: NonNullable<Props["island"]>,
  placed: PlacedCabinet[],
  counterColor: string,
  countertopTexture?: THREE.Texture | null,
) {
  const transform = islandZoneTransform(island);
  const group = new THREE.Group();
  group.position.set(transform.x, 0, transform.z);
  group.userData = { island: true, islandWorkZone: true };
	  const guideGroup = new THREE.Group();
	  // Saved plan angles are clockwise with +Y pointing down; Three.js mirrors
	  // that handedness around its vertical axis.
	  guideGroup.rotation.y = threeDPlanRotation((Number(island.rotation ?? 0) * Math.PI) / 180);
  const guideMaterial = new THREE.MeshStandardMaterial({ color: "#d4a75a", roughness: 0.7, transparent: true, opacity: 0.7 });
  const guideThickness = 0.25 * INCH;
  const guideHeight = 0.08 * INCH;
  const back = new THREE.Mesh(new THREE.BoxGeometry(transform.guideWidth, guideHeight, guideThickness), guideMaterial);
  const front = new THREE.Mesh(new THREE.BoxGeometry(transform.guideWidth, guideHeight, guideThickness), guideMaterial);
  const left = new THREE.Mesh(new THREE.BoxGeometry(guideThickness, guideHeight, transform.guideDepth), guideMaterial);
  const right = new THREE.Mesh(new THREE.BoxGeometry(guideThickness, guideHeight, transform.guideDepth), guideMaterial);
  back.position.set(0, guideHeight / 2, -transform.guideDepth / 2);
  front.position.set(0, guideHeight / 2, transform.guideDepth / 2);
  left.position.set(-transform.guideWidth / 2, guideHeight / 2, 0);
  right.position.set(transform.guideWidth / 2, guideHeight / 2, 0);
  for (const edge of [back, front, left, right]) edge.userData = { islandGuide: true };
  guideGroup.add(back, front, left, right);
  group.add(guideGroup);
	  const slabs = islandCountertopVisibleRects(island, placed);
	  const raisedBarSlabs = islandRaisedBarRects(island, placed);
	  const waterfallSlabs = islandCountertopRects(island, placed);
	  slabs.forEach((slab, slabIndex) => {
    const mappedCountertopTexture = threeDTextureForCountertopMesh(countertopTexture ?? null, {
      centerXIn: slab.x + slab.width / 2,
      centerZIn: slab.y + slab.depth / 2,
      localWidthIn: slab.width,
      localDepthIn: slab.depth,
      rotation: 0,
      slabWidthIn: Number(countertopTexture?.userData?.physicalWidthIn) || 138,
      slabDepthIn: Number(countertopTexture?.userData?.physicalDepthIn) || 79,
    });
    const counterMaterial = new THREE.MeshPhysicalMaterial({
      color: mappedCountertopTexture ? "#ffffff" : counterColor,
      map: mappedCountertopTexture ?? null,
      ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedCountertopTexture)),
    });
    counterMaterial.userData = {
      selectedSurfaceRole: "countertop",
      usesAuthoritativeProductImage: Boolean(mappedCountertopTexture),
      worldSlabMapped: Boolean(mappedCountertopTexture?.userData?.worldSlabMapped),
      materialOnlyNoGeometryChange: true,
    };
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(slab.width * INCH, 1.5 * INCH, slab.depth * INCH),
      counterMaterial,
    );
    counter.position.set((slab.x + slab.width / 2) * INCH - transform.x, transform.counterTop, (slab.y + slab.depth / 2) * INCH - transform.z);
	    counter.rotation.y = threeDPlanRotation((Number(slab.rotation ?? 0) * Math.PI) / 180);
    counter.userData = { islandCountertop: true, islandCountertopSegment: slabIndex + 1, widthIn: slab.width, depthIn: slab.depth };
	    group.add(counter);
	  });
	  raisedBarSlabs.forEach((slab, slabIndex) => {
	    const planRadians = (Number(slab.rotation ?? 0) * Math.PI) / 180;
	    const barSide = island.raisedBarSide ?? "back";
	    const supportDepthIn = 4.5;
	    const localSupport = barSide === "back"
	      ? { x: 0, y: slab.depth / 2 - supportDepthIn / 2, width: slab.width, depth: supportDepthIn }
	      : barSide === "front"
	        ? { x: 0, y: -slab.depth / 2 + supportDepthIn / 2, width: slab.width, depth: supportDepthIn }
	        : barSide === "left"
	          ? { x: slab.width / 2 - supportDepthIn / 2, y: 0, width: supportDepthIn, depth: slab.depth }
	          : { x: -slab.width / 2 + supportDepthIn / 2, y: 0, width: supportDepthIn, depth: slab.depth };
	    const slabCenterXIn = slab.x + slab.width / 2;
	    const slabCenterZIn = slab.y + slab.depth / 2;
	    const supportXIn = slabCenterXIn + localSupport.x * Math.cos(planRadians) - localSupport.y * Math.sin(planRadians);
	    const supportZIn = slabCenterZIn + localSupport.x * Math.sin(planRadians) + localSupport.y * Math.cos(planRadians);
	    const support = new THREE.Mesh(
	      new THREE.BoxGeometry(localSupport.width * INCH, (42 - STD.COUNTERTOP_THICKNESS) * INCH, localSupport.depth * INCH),
	      new THREE.MeshPhysicalMaterial({ color: "#e9e2d4", roughness: 0.86, metalness: 0 }),
	    );
	    support.position.set(supportXIn * INCH - transform.x, ((42 - STD.COUNTERTOP_THICKNESS) / 2) * INCH, supportZIn * INCH - transform.z);
	    support.rotation.y = threeDPlanRotation(planRadians);
	    support.userData = { islandRaisedBarPonyWall: true, islandRaisedBarSegment: slabIndex + 1, supportHeightIn: 42 - STD.COUNTERTOP_THICKNESS, supportDepthIn };
	    group.add(support);
	    const mappedCountertopTexture = threeDTextureForCountertopMesh(countertopTexture ?? null, {
	      centerXIn: slab.x + slab.width / 2,
	      centerZIn: slab.y + slab.depth / 2,
	      localWidthIn: slab.width,
	      localDepthIn: slab.depth,
	      rotation: threeDPlanRotation(planRadians),
	      slabWidthIn: Number(countertopTexture?.userData?.physicalWidthIn) || 138,
	      slabDepthIn: Number(countertopTexture?.userData?.physicalDepthIn) || 79,
	    });
	    const material = new THREE.MeshPhysicalMaterial({ color: mappedCountertopTexture ? "#ffffff" : counterColor, map: mappedCountertopTexture ?? null, ...threeDPhysicalSurfaceProfile("countertop", Boolean(mappedCountertopTexture)) });
	    const counter = new THREE.Mesh(new THREE.BoxGeometry(slab.width * INCH, STD.COUNTERTOP_THICKNESS * INCH, slab.depth * INCH), material);
	    counter.position.set(slabCenterXIn * INCH - transform.x, (42 - STD.COUNTERTOP_THICKNESS / 2) * INCH, slabCenterZIn * INCH - transform.z);
	    counter.rotation.y = threeDPlanRotation(planRadians);
	    counter.userData = { islandRaisedBar: true, islandRaisedBarSegment: slabIndex + 1, countertopHeightIn: 42, raisedBarOverhangIn: island.raisedBarOverhang === 12 ? 12 : 15, widthIn: slab.width, depthIn: slab.depth };
	    group.add(counter);
	  });
	  const waterfallEnd = island.waterfallEnd;
	  const waterfallEnds = waterfallEnd === "both" ? (["left", "right"] as const) : waterfallEnd === "left" || waterfallEnd === "right" ? [waterfallEnd] : [];
	  if (waterfallEnds.length > 0 && waterfallSlabs.length > 0) {
	    const panelThickness = 1.5 * INCH;
	    const panelHeight = transform.counterTop + 0.75 * INCH;
	    const panelMaterial = new THREE.MeshPhysicalMaterial({
	      color: countertopTexture ? "#ffffff" : counterColor,
	      map: countertopTexture ?? null,
	      ...threeDPhysicalSurfaceProfile("countertop", Boolean(countertopTexture)),
	    });
	    // A waterfall is an end panel of its own physical slab—not the axis-aligned
	    // bounding box of every island slab. Resolve each end in the slab's rotated
	    // local X axis so a 45°/90° island keeps the cascade on its actual side,
	    // never across the cabinet fronts.
	    waterfallSlabs.forEach((slab, slabIndex) => {
	      const slabRotation = threeDPlanRotation((Number(slab.rotation ?? 0) * Math.PI) / 180);
	      const slabCenterX = (slab.x + slab.width / 2) * INCH - transform.x;
	      const slabCenterZ = (slab.y + slab.depth / 2) * INCH - transform.z;
	      waterfallEnds.forEach((end) => {
	        const panel = new THREE.Mesh(
	          new THREE.BoxGeometry(panelThickness, panelHeight, slab.depth * INCH),
	          panelMaterial.clone(),
	        );
	        panel.position.set(slabCenterX, panelHeight / 2, slabCenterZ);
	        panel.rotation.y = slabRotation;
	        panel.translateX((end === "left" ? -1 : 1) * slab.width * INCH / 2);
	        panel.userData = {
	          islandWaterfall: true,
	          waterfallEnd: end,
	          islandCountertopSegment: slabIndex + 1,
	          fullHeightToFloor: true,
	          usesActiveCountertopMaterial: true,
	        };
	        group.add(panel);
	      });
	    });
	  }
	  root.add(group);
}

export type ThreeDBacksplashSegment = {
  side: WallSide;
  start: number;
  end: number;
  bottom: number;
  top: number;
};

export type BacksplashHeightMode = "standard" | "full-height";
export const THREE_D_BACKSPLASH_TILE_SIZE_IN = 12;

/**
 * Backsplash follows the physical counter run, not a limited catalog subset.
 * Every ground-level base component under the countertop—including a filler or
 * panel—and every under-counter appliance such as a dishwasher carries the
 * adjoining wall backsplash. Tall appliances, wall-mounted hoods, and raised
 * appliances remain excluded.
 */
export function threeDSupportsBacksplash(cabinet: PlacedCabinet, room: RoomData) {
  const elevation = elevationBox(cabinet, room);
  const isAtCounterLevel = elevation.bottom <= 0.5 && elevation.bottom + elevation.height <= COUNTERTOP_TOP + 4;
  if (!isAtCounterLevel || isRangeHoodPlacement(cabinet)) return false;
  if (cabinet.placement === "base") return true;
  return cabinet.placement === "appliance";
}

export function threeDBacksplashTileTextureTransform(segment: ThreeDBacksplashSegment, moduleIn = THREE_D_BACKSPLASH_TILE_SIZE_IN) {
  const safeModuleIn = Math.max(0.125, moduleIn);
  return {
    repeatX: Math.max(0.001, (segment.end - segment.start) / safeModuleIn),
    repeatY: Math.max(0.001, (segment.top - segment.bottom) / safeModuleIn),
    offsetX: (segment.start / safeModuleIn) % 1,
    offsetY: (segment.bottom / safeModuleIn) % 1,
  };
}

function threeDWallRunSpan(cabinet: PlacedCabinet, side: WallSide, room: RoomData) {
	  // The shared run helpers retain the catalog-authoritative 36-inch BBC body
	  // for legacy saves that stored its reduced 33-inch box width.
	  const start = wallRunOffset(cabinet, side, room);
	  const span = wallRunSpan(cabinet, side, room);
	  return { start, end: start + span };
}

/**
 * True folded/diagonal corner cabinets are ground-level countertop supports on
 * both wall-facing legs, so the backsplash must wrap around the corner instead
 * of leaving the adjoining wall blank. Blind corners remain rectangular and
 * continue to support only their owning room wall. This adds wall coverage
 * only—it never changes the saved corner footprint, cabinet placement,
 * countertop, or camera.
 */
export function threeDBacksplashSupportSpans(cabinet: PlacedCabinet, side: WallSide, room: RoomData) {
  if (!threeDSupportsBacksplash(cabinet, room)) return [];
	const cornerKind = placedCornerGeometryKind(cabinet);
	const wrapsCornerLegs = cornerKind === "l-shape" || cornerKind === "diagonal" || cornerKind === "corner-drawer";
	if (!wrapsCornerLegs) {
		return cabinetWall(cabinet, room) === side ? [threeDWallRunSpan(cabinet, side, room)] : [];
  }
  const footprint = placedFootprint(cabinet);
  const wallToleranceIn = 0.5;
  if (side === "top" && cabinet.y <= wallToleranceIn) return [{ start: cabinet.x, end: cabinet.x + footprint.w }];
  if (side === "bottom" && cabinet.y + footprint.d >= room.depth - wallToleranceIn) return [{ start: cabinet.x, end: cabinet.x + footprint.w }];
  if (side === "left" && cabinet.x <= wallToleranceIn) return [{ start: cabinet.y, end: cabinet.y + footprint.d }];
  if (side === "right" && cabinet.x + footprint.w >= room.width - wallToleranceIn) return [{ start: cabinet.y, end: cabinet.y + footprint.d }];
  return [];
}

function mergeThreeDIntervals(intervals: Array<{ start: number; end: number }>) {
  const ordered = intervals
    .filter((interval) => interval.end - interval.start > 0.001)
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + 0.001) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

function subtractThreeDBacksplashRect(
  source: Omit<ThreeDBacksplashSegment, "side">,
  cut: Omit<ThreeDBacksplashSegment, "side">,
) {
  const overlapStart = Math.max(source.start, cut.start);
  const overlapEnd = Math.min(source.end, cut.end);
  const overlapBottom = Math.max(source.bottom, cut.bottom);
  const overlapTop = Math.min(source.top, cut.top);
  if (overlapEnd <= overlapStart || overlapTop <= overlapBottom) return [source];
  const pieces: Array<Omit<ThreeDBacksplashSegment, "side">> = [];
  if (source.start < overlapStart) pieces.push({ ...source, end: overlapStart });
  if (overlapEnd < source.end) pieces.push({ ...source, start: overlapEnd });
  if (source.bottom < overlapBottom) pieces.push({ start: overlapStart, end: overlapEnd, bottom: source.bottom, top: overlapBottom });
  if (overlapTop < source.top) pieces.push({ start: overlapStart, end: overlapEnd, bottom: overlapTop, top: source.top });
  return pieces.filter((piece) => piece.end - piece.start > 0.001 && piece.top - piece.bottom > 0.001);
}

export function threeDBacksplashSegments(
		placed: PlacedCabinet[],
		openings: WallOpening[],
		room: RoomData,
		heightMode: BacksplashHeightMode = "standard",
		countertopUpstandIn = 0,
) {
  const sides: WallSide[] = ["top", "bottom", "left", "right"];
  const countertopTop = COUNTERTOP_TOP;
  const tileBottom = countertopTop + (countertopUpstandIn === 2.5 || countertopUpstandIn === 3 ? countertopUpstandIn : 0);
  const ceilingTop = room.ceilingHeight ?? 96;
  const standardTop = Math.min(ceilingTop, countertopTop + 18);
  const segments: ThreeDBacksplashSegment[] = [];
  for (const side of sides) {
    const wallItems = placed.filter((cabinet) => !cabinet.islandFace && cabinetWall(cabinet, room) === side);
    const supportIntervals = mergeThreeDIntervals(placed.flatMap((cabinet) =>
      cabinet.islandFace ? [] : threeDBacksplashSupportSpans(cabinet, side, room),
    ));
		const rangeIntervals = mergeThreeDIntervals(wallItems.flatMap((cabinet) => {
			if (cabinet.islandFace || cabinetWall(cabinet, room) !== side || cabinet.placement !== "appliance") return [];
			return isRangeOrOven(cabinet.masterCode, cabinet.description) ? [threeDWallRunSpan(cabinet, side, room)] : [];
		}));
		const hoodIntervals = wallItems.flatMap((cabinet) => {
			if (!isRangeHoodPlacement(cabinet)) return [];
			const span = threeDWallRunSpan(cabinet, side, room);
      return [{ ...span, bottom: elevationBox(cabinet, room).bottom }];
    });
    const cuts = [
      ...openings.filter((opening) => opening.side === side).map((opening) => ({
        start: opening.offset,
        end: opening.offset + opening.width,
        bottom: opening.sill,
        top: opening.sill + opening.height,
      })),
	      ...placed.flatMap((cabinet) => {
	        if (cabinet.islandFace || cabinetWall(cabinet, room) !== side) return [];
	        const box = elevationBox(cabinet, room);
	        const raisedAppliance = cabinet.placement === "appliance" && box.bottom > countertopTop;
	        const floorTallAppliance = cabinet.placement === "appliance" && box.bottom <= 0.5 && !threeDSupportsBacksplash(cabinet, room);
	        if (cabinet.placement !== "wall" && cabinet.placement !== "tall" && !raisedAppliance && !floorTallAppliance) return [];
			const span = threeDWallRunSpan(cabinet, side, room);
	        return [{ ...span, bottom: box.bottom, top: box.bottom + box.height }];
	      }),
	    ];
		// These are the real countertop/range-supported wall runs. Use exactly the
		// same spans for display, elevation parity, and materials—never a room-wide
		// perimeter field that can paint an open wall or bare floor.
		const wallCabinetIntervals = mergeThreeDIntervals(wallItems
			.filter((cabinet) => cabinet.placement === "wall")
			.map((cabinet) => threeDWallRunSpan(cabinet, side, room)));
		const supportedIntervals = mergeThreeDIntervals([...supportIntervals, ...wallCabinetIntervals]);
	    const sourceSegments: Array<Omit<ThreeDBacksplashSegment, "side">> = supportedIntervals.map((interval) => ({
      ...interval,
      bottom: tileBottom,
      top: heightMode === "full-height" ? ceilingTop : standardTop,
    }));
    if (heightMode === "standard") {
      for (const range of rangeIntervals) {
        const matchingHoodBottom = hoodIntervals
          .filter((hood) => hood.end > range.start + 0.001 && hood.start < range.end - 0.001)
          .map((hood) => hood.bottom)
          .sort((a, b) => a - b)[0];
        if (matchingHoodBottom != null && matchingHoodBottom > standardTop + 0.001) {
          sourceSegments.push({ ...range, bottom: standardTop, top: Math.min(ceilingTop, matchingHoodBottom) });
        }
      }
    }
    for (const source of sourceSegments) {
      let visible: Array<Omit<ThreeDBacksplashSegment, "side">> = [source];
      for (const cut of cuts) visible = visible.flatMap((segment) => subtractThreeDBacksplashRect(segment, cut));
      segments.push(...visible.map((segment) => ({ side, ...segment })));
    }
  }
  return segments;
}

/**
 * The countertop rear upstand is a short continuous slab strip below wall tile.
 * It shares the same countertop-supported wall coverage and exact saved opening
 * cuts, but never turns an open wall or island edge into backsplash.
 */
export function threeDCountertopUpstandSegments(
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
  upstandIn: 0 | 2.5 | 3,
) {
  if (upstandIn !== 2.5 && upstandIn !== 3) return [];
  const upstandTop = COUNTERTOP_TOP + upstandIn;
	return threeDBacksplashSegments(placed, openings, room, "standard", 0)
    .map((segment) => ({ ...segment, top: Math.min(segment.top, upstandTop) }))
    .filter((segment) => segment.top - segment.bottom > 0.001);
}

export function threeDBacksplashTransform(segment: ThreeDBacksplashSegment, room: RoomData) {
  const center = (segment.start + segment.end) / 2;
  const centerY = (segment.bottom + segment.top) / 2;
  if (segment.side === "bottom") return { x: center, y: centerY, z: room.depth - 0.07, rotation: Math.PI };
  if (segment.side === "left") return { x: 0.07, y: centerY, z: center, rotation: Math.PI / 2 };
  if (segment.side === "right") return { x: room.width - 0.07, y: centerY, z: center, rotation: -Math.PI / 2 };
  return { x: center, y: centerY, z: 0.07, rotation: 0 };
}

function addThreeDBacksplash(
  root: THREE.Group,
  segments: ThreeDBacksplashSegment[],
  room: RoomData,
  sourceTexture: THREE.Texture,
) {
  for (const segment of segments) {
    const widthIn = segment.end - segment.start;
    const heightIn = segment.top - segment.bottom;
    const texture = sourceTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const moduleIn = Number(sourceTexture.userData?.backsplashModuleIn) || THREE_D_BACKSPLASH_TILE_SIZE_IN;
    const groutJointIn = Number(sourceTexture.userData?.backsplashGroutJointIn) || null;
    const patternKind = sourceTexture.userData?.backsplashPatternKind ?? "field-tile";
    const tileTransform = threeDBacksplashTileTextureTransform(segment, moduleIn);
    texture.repeat.set(tileTransform.repeatX, tileTransform.repeatY);
    texture.offset.set(tileTransform.offsetX, tileTransform.offsetY);
    texture.needsUpdate = true;
    const material = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: texture,
      side: THREE.DoubleSide,
      ...threeDPhysicalSurfaceProfile("backsplash", true),
    });
    material.userData = { selectedSurfaceRole: "backsplash", usesAuthoritativeProductImage: !sourceTexture.userData?.representativePreview, representativePreview: Boolean(sourceTexture.userData?.representativePreview), tileModuleIn: moduleIn, groutJointIn, backsplashPatternKind: patternKind, continuousTileField: true, materialOnlyNoGeometryChange: true };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthIn * INCH, heightIn * INCH), material);
    const transform = threeDBacksplashTransform(segment, room);
    mesh.position.set(transform.x * INCH, transform.y * INCH, transform.z * INCH);
    mesh.rotation.y = transform.rotation;
    mesh.receiveShadow = true;
    mesh.userData = { measuredBacksplash: true, ...segment, tileModuleIn: moduleIn, groutJointIn, backsplashPatternKind: patternKind, continuousTileField: true, clippedAroundSavedPlan: true };
    root.add(mesh);
  }
}

function addThreeDCountertopUpstands(
  root: THREE.Group,
  segments: ThreeDBacksplashSegment[],
  room: RoomData,
  sourceTexture: THREE.Texture | null,
  fallbackColor: string,
) {
  for (const segment of segments) {
    const widthIn = segment.end - segment.start;
    const heightIn = segment.top - segment.bottom;
    const texture = sourceTexture?.clone() ?? null;
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      const slabWidth = Number(sourceTexture?.userData?.physicalWidthIn) || 138;
      const slabDepth = Number(sourceTexture?.userData?.physicalDepthIn) || 79;
      texture.repeat.set(Math.max(0.001, widthIn / slabWidth), Math.max(0.001, heightIn / slabDepth));
      texture.offset.set((segment.start / slabWidth) % 1, (segment.bottom / slabDepth) % 1);
      texture.needsUpdate = true;
    }
    const material = new THREE.MeshPhysicalMaterial({
      color: texture ? "#ffffff" : fallbackColor,
      map: texture,
      side: THREE.DoubleSide,
      ...threeDPhysicalSurfaceProfile("countertop", Boolean(texture)),
    });
    material.userData = { selectedSurfaceRole: "countertop-upstand", usesAuthoritativeProductImage: Boolean(texture), materialOnlyNoGeometryChange: true };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthIn * INCH, heightIn * INCH), material);
    const transform = threeDBacksplashTransform(segment, room);
    const inset = 0.12 * INCH;
    mesh.position.set(
      transform.x * INCH + (segment.side === "left" ? inset : segment.side === "right" ? -inset : 0),
      transform.y * INCH,
      transform.z * INCH + (segment.side === "top" ? inset : segment.side === "bottom" ? -inset : 0),
    );
    mesh.rotation.y = transform.rotation;
    mesh.receiveShadow = true;
    mesh.userData = { countertopUpstand: true, ...segment, physicalHeightIn: heightIn, clippedAroundSavedPlan: true };
    root.add(mesh);
  }
}

function miteredPonyWallGeometry(corners: Array<{ x: number; z: number }>, height: number) {
  const positions = new Float32Array([
    corners[0]!.x * INCH, 0, corners[0]!.z * INCH,
    corners[1]!.x * INCH, 0, corners[1]!.z * INCH,
    corners[2]!.x * INCH, 0, corners[2]!.z * INCH,
    corners[3]!.x * INCH, 0, corners[3]!.z * INCH,
    corners[0]!.x * INCH, height * INCH, corners[0]!.z * INCH,
    corners[1]!.x * INCH, height * INCH, corners[1]!.z * INCH,
    corners[2]!.x * INCH, height * INCH, corners[2]!.z * INCH,
    corners[3]!.x * INCH, height * INCH, corners[3]!.z * INCH,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function addPonyWall(root: THREE.Group, ponyWall: PonyWall, room: RoomData, ponyWalls: PonyWall[]) {
  const footprint = ponyWallMiteredFootprint(ponyWall, ponyWalls, room);
  const transform = ponyWallTransform(ponyWall, room);
  const drywallFinished = ponyWall.peninsulaPlacement === "behind-cabinets" && ponyWall.finish === "drywall"
    || ponyWall.peninsulaRunId != null && ponyWall.peninsulaPlacement !== "behind-cabinets" && ponyWall.finish === "drywall";
  const drywallAppearance = drywallPonyWallAppearance(ponyWall);
  const material = new THREE.MeshStandardMaterial({ color: drywallFinished ? drywallAppearance.color : "#ede9e1", roughness: drywallFinished ? drywallAppearance.roughness : 0.86 });
  const hasMiteredJoin = footprint.miteredStart || footprint.miteredEnd;
  const wall = new THREE.Mesh(
    hasMiteredJoin
      ? miteredPonyWallGeometry(footprint.corners, footprint.frame.height)
      : new THREE.BoxGeometry(transform.width, transform.height, transform.depth),
    material,
  );
  if (hasMiteredJoin) {
    wall.position.set(footprint.frame.start.x * INCH, 0, footprint.frame.start.y * INCH);
  } else {
    wall.position.set(transform.x, transform.y, transform.z);
  }
  wall.rotation.y = transform.rotation;
  wall.userData = { ponyWallUid: ponyWall.uid, peninsulaRunId: ponyWall.peninsulaRunId ?? null, drywallFinished, peninsulaPlacement: ponyWall.peninsulaPlacement ?? null, drywallColor: drywallFinished ? drywallAppearance.color : null, drywallTexture: drywallFinished ? drywallAppearance.texture : null, miteredStart: footprint.miteredStart, miteredEnd: footprint.miteredEnd, continuousMiteredJoin: hasMiteredJoin };
  root.add(wall);
}

function addPelicanBathroomFixture(
  root: THREE.Group,
  furniture: PlacedFurniture,
  profile: VerifiedPelicanBathroomFixtureProfile,
) {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  const transform = bathroomFurnitureTransform(furniture);
  const group = new THREE.Group();
  group.position.set(transform.x, 0, transform.z);
  group.rotation.y = transform.rotation;
  group.userData = {
    furnitureUid: furniture.uid,
    furnitureDefId: furniture.defId,
    pelicanBathroomFixture: true,
    pelicanCode: profile.pelicanCode,
    fixtureKind: profile.kind,
    sourceEnvelopeIn: profile.footprintBasis ? null : { width: profile.widthIn, depth: profile.depthIn, height: profile.heightIn },
    visualOccupancyIn: profile.footprintBasis ? { width: profile.widthIn, depth: profile.depthIn } : null,
    mounting: profile.mounting ?? null,
    footprintBasis: profile.footprintBasis ?? "source-dimensions",
    sourceSpecificationUrl: profile.specificationUrl,
    drain: profile.drain,
    tubShape: profile.tubShape ?? null,
    toiletStyle: profile.toiletStyle ?? null,
    toiletFlushControl: profile.toiletFlushControl ?? null,
    toiletFlushTechnology: profile.toiletFlushTechnology ?? null,
  };
  const shellColor = profile.finish === "vitreous-china-matte-black" ? "#17191b" : "#f5f6f2";
  const shell = new THREE.MeshPhysicalMaterial({ color: shellColor, roughness: 0.24, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.18 });
  const water = new THREE.MeshPhysicalMaterial({ color: "#d8ebef", roughness: 0.08, metalness: 0, transmission: 0.08, transparent: true, opacity: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: profile.finish === "vitreous-china-matte-black" ? "#050607" : "#c7d1d4", roughness: 0.3 });
  const add = (mesh: THREE.Mesh, part: string) => {
    mesh.userData = { pelicanBathroomFixturePart: part, pelicanCode: profile.pelicanCode };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  if (profile.kind === "floor-tub-filler") {
    const filler = makePelicanTubFillerGroup(profile);
    for (const child of [...filler.children]) group.add(child);
  } else if (profile.kind === "shower-door" || profile.kind === "tub-door") {
    // Pelican publishes nominal width and exact overall / door heights. This
    // source-bounded glass plane deliberately does not invent a curb, wall,
    // track setback, or finished installation opening.
    const panelHeight = (profile.visiblePanelHeightIn ?? profile.heightIn) * INCH;
    const glass = new THREE.MeshPhysicalMaterial({ color: "#d8eef4", roughness: 0.05, metalness: 0, transmission: 0.68, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: "#77828a", roughness: 0.28, metalness: 0.85 });
    for (const x of [-width / 4, width / 4]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.006, panelHeight, Math.max(depth, 0.015)), glass);
      panel.position.set(x, panelHeight / 2, 0);
      add(panel, "shower-door-glass-panel");
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, 0.045), metal);
    rail.position.y = height - 0.0225;
    add(rail, "shower-door-rail");
  } else if (profile.kind === "shower-wall") {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, Math.max(depth, 0.02)), new THREE.MeshStandardMaterial({ color: "#e7e2dc", roughness: 0.72 }));
    panel.position.y = height / 2;
    add(panel, "shower-wall-panel");
  } else if (profile.kind === "toilet") {
    const toilet = makePelicanToiletGroup(profile);
    for (const child of [...toilet.children]) group.add(child);
  } else if (profile.kind === "bidet") {
    const baseHeight = height * 0.78;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.27, width * 0.36, baseHeight, 28), shell);
    pedestal.scale.z = Math.max(0.7, depth / width);
    pedestal.position.y = baseHeight / 2;
    add(pedestal, "bidet-pedestal");
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 30), dark);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(width * 0.67, depth * 0.43, 1);
    rim.position.y = height * 0.8;
    add(rim, "bidet-rim");
  } else if (profile.kind === "freestanding-tub" && (profile.tubShape === "rectangular" || profile.tubShape === "rounded-rectangular")) {
    // PL-02146's official top view is rectangular. This tapered hollow shell
    // stays within its measured exterior; wall thickness/radii are illustrative.
    const ring = (w: number, d: number, y: number) => {
      const radius = Math.min(w, d) * (profile.tubShape === "rounded-rectangular" ? 0.22 : 0.06);
      const points: THREE.Vector3[] = [];
      for (let corner = 0; corner < 4; corner++) {
        const cx = corner === 0 || corner === 3 ? w / 2 - radius : -w / 2 + radius;
        const cz = corner < 2 ? d / 2 - radius : -d / 2 + radius;
        for (let step = 0; step <= 8; step++) {
          const angle = (corner * 90 + step * 90 / 8) * Math.PI / 180;
          points.push(new THREE.Vector3(cx + radius * Math.cos(angle), y, cz + radius * Math.sin(angle)));
        }
      }
      return points;
    };
    const rings = [ring(width * 0.78, depth * 0.85, 0.008), ring(width, depth, height), ring(width * 0.89, depth * 0.93, height), ring(width * 0.65, depth * 0.78, height * 0.22)];
    const vertices: number[] = [];
    for (let level = 0; level < rings.length - 1; level++) {
      for (let i = 0; i < rings[level].length; i++) {
        const next = (i + 1) % rings[level].length;
        for (const point of [rings[level][i], rings[level + 1][i], rings[level + 1][next], rings[level][i], rings[level + 1][next], rings[level][next]]) vertices.push(point.x, point.y, point.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const rectangularMaterial = shell.clone();
    rectangularMaterial.side = THREE.DoubleSide;
    add(new THREE.Mesh(geometry, rectangularMaterial), "rectangular-freestanding-tub-shell");
    const well = new THREE.Mesh(new RoundedBoxGeometry(width * 0.65, height * 0.02, depth * 0.78, width * 0.03, 4), shell);
    well.position.y = height * 0.22;
    add(well, "rectangular-freestanding-tub-well");
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.032, width * 0.032, 0.016, 20), dark);
    drain.position.y = height * 0.24;
    add(drain, "freestanding-tub-drain");
  } else if (profile.kind === "freestanding-tub") {
    // The supplier documents a freestanding exterior envelope and drain only.
    // The nested acrylic shell, rim, well and drain below make the planning
    // silhouette legible without claiming an unprovided cross section.
    const outer = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0.008),
      new THREE.Vector2(0.30, 0.008),
      new THREE.Vector2(0.37, height * 0.16),
      new THREE.Vector2(0.46, height * 0.7),
      new THREE.Vector2(0.49, height * 0.97),
      new THREE.Vector2(0.47, height * 0.995),
      new THREE.Vector2(0.39, height * 0.995),
      new THREE.Vector2(0.36, height * 0.89),
      new THREE.Vector2(0.30, height * 0.33),
      new THREE.Vector2(0, height * 0.31),
    ], 64), shell);
    outer.scale.set(width, 1, depth);
    add(outer, "freestanding-tub-exterior");
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.48, Math.max(0.012, height * 0.055), 48), shell);
    foot.scale.set(width * 0.63, 1, depth * 0.63);
    foot.position.y = Math.max(0.006, height * 0.028);
    add(foot, "freestanding-tub-plinth");
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.013, 12, 64), shell);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(width * 0.88, depth * 0.88, 1);
    rim.position.y = height * 0.99;
    add(rim, "freestanding-tub-rim");
    const innerWell = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), shell);
    innerWell.rotation.x = -Math.PI / 2;
    innerWell.scale.set(width * 0.6, depth * 0.6, 1);
    innerWell.position.y = height * 0.312;
    add(innerWell, "freestanding-tub-well");
    const drainOffset = profile.drain === "left" ? -depth * 0.21 : profile.drain === "right" ? depth * 0.21 : 0;
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.025, width * 0.032), Math.max(0.025, width * 0.032), 0.016, 20), dark);
    drain.position.set(0, height * 0.32, drainOffset);
    add(drain, "freestanding-tub-drain");
  } else {
    // Alcove models retain the exact published exterior envelope and left/right
    // drain identity. The visible apron, raised rim and shallow inner well are
    // illustrative acrylic details, entirely inside that envelope.
    const apron = new THREE.Mesh(new RoundedBoxGeometry(width * 0.98, height * 0.84, depth * 0.12, Math.min(width, depth) * 0.035, 5), shell);
    apron.position.set(0, height * 0.42, depth * 0.43);
    add(apron, "alcove-tub-apron");
    const rearShell = new THREE.Mesh(new RoundedBoxGeometry(width * 0.98, height * 0.82, depth * 0.12, Math.min(width, depth) * 0.035, 5), shell);
    rearShell.position.set(0, height * 0.41, -depth * 0.43);
    add(rearShell, "alcove-tub-rear-shell");
    const leftEnd = new THREE.Mesh(new RoundedBoxGeometry(width * 0.12, height * 0.84, depth * 0.86, Math.min(width, depth) * 0.035, 5), shell);
    leftEnd.position.set(-width * 0.43, height * 0.42, 0);
    add(leftEnd, "alcove-tub-left-end");
    const rightEnd = leftEnd.clone();
    rightEnd.position.x = width * 0.43;
    add(rightEnd, "alcove-tub-right-end");
    const well = new THREE.Mesh(new RoundedBoxGeometry(width * 0.73, Math.max(0.02, height * 0.025), depth * 0.7, Math.min(width, depth) * 0.055, 6), water);
    well.position.y = height * 0.84;
    add(well, "alcove-tub-well");
    const drainOffset = profile.drain === "left" ? -width * 0.25 : profile.drain === "right" ? width * 0.25 : 0;
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.025, width * 0.032), Math.max(0.025, width * 0.032), 0.016, 20), dark);
    drain.position.set(drainOffset, height * 0.86, depth * 0.13);
    add(drain, "alcove-tub-drain");
  }
  root.add(group);
}

export function addFurniture(root: THREE.Group, furniture: PlacedFurniture, selected = false) {
  const def = FURNITURE_CATALOG.find((entry) => entry.id === furniture.defId);
  if (!def) return;
  // Planning zones belong to Floor Plan only. Preserve them in saved state,
  // but create no 3D floor fill, border, selection outline or raycast target.
  if (def.category === "bathroom-zone") return;
  const bathroomFixture = verifiedPelicanBathroomFixtureProfile(furniture.pelicanCode ?? def.pelicanCode);
  if (bathroomFixture) {
    addPelicanBathroomFixture(root, furniture, bathroomFixture);
    const fixtureGroup = root.children[root.children.length - 1];
    if (selected && fixtureGroup instanceof THREE.Group) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(bathroomFixture.widthIn * INCH * 1.06, Math.max(bathroomFixture.heightIn * INCH, 0.24) * 1.04, bathroomFixture.depthIn * INCH * 1.06)),
        new THREE.LineBasicMaterial({ color: "#a87f33", depthTest: false }),
      );
      outline.position.y = Math.max(bathroomFixture.heightIn * INCH, 0.24) / 2;
      outline.renderOrder = 50;
      outline.userData = { bathroomFixtureSelectionOutline: true, furnitureUid: furniture.uid };
      fixtureGroup.add(outline);
    }
    return;
  }
  const size = resolvedFurnitureDimensions(furniture, def)!;
  const width = size.w * INCH;
  const depth = size.d * INCH;
  const transform = furnitureTransform(furniture, def.w, def.d);
  const group = new THREE.Group();
  group.position.set(transform.x, 0, transform.z);
  group.rotation.y = transform.rotation;
  group.userData = { furnitureUid: furniture.uid, furnitureDefId: furniture.defId };
  const material = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 });
  if (def.category === "stool") {
    buildModernStool(group, def.id === "stool-bar" ? 30 : 25, width / INCH);
    root.add(group);
    return;
  }
  const height = def.height != null ? def.height * INCH : (def.category === "table" ? 2.5 : 1.5);
  const body = def.shape === "round"
    ? new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, height, 20), material)
    : new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  body.position.y = height / 2;
  group.add(body);
  root.add(group);
}

/** Modern backless stool: slim round padded seat, four tapered black-metal legs, and a foot ring. Visual only. */
export function buildModernStool(group: THREE.Group, seatHeightIn: number, diameterIn: number) {
  const d = Math.max(12, Math.min(diameterIn, 18));
  const seatMat = new THREE.MeshStandardMaterial({ color: "#d9d4cb", roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: "#26262a", roughness: 0.45, metalness: 0.5 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry((d / 2) * INCH, (d / 2) * INCH * 0.96, 2 * INCH, 28), seatMat);
  seat.position.y = (seatHeightIn - 1) * INCH;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry((d / 2 - 1) * INCH, (d / 2 - 1) * INCH, 0.4 * INCH, 28), metal);
  plate.position.y = (seatHeightIn - 2.2) * INCH;
  group.add(seat, plate);
  const legLen = seatHeightIn - 2.4;
  const top = (d / 2 - 2.5), bottom = (d / 2 + 1);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * INCH, 0.3 * INCH, legLen * INCH, 10), metal);
    const mx = ((top + bottom) / 2) * Math.cos(a), mz = ((top + bottom) / 2) * Math.sin(a);
    leg.position.set(mx * INCH, (legLen / 2) * INCH, mz * INCH);
    // splay outward toward the floor
    leg.rotation.set(Math.sin(a) * Math.atan((bottom - top) / legLen), 0, -Math.cos(a) * Math.atan((bottom - top) / legLen));
    group.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry((d / 2 + 0.2) * INCH, 0.3 * INCH, 8, 28), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = Math.min(11, seatHeightIn * 0.42) * INCH;
  group.add(ring);
  group.userData = { ...group.userData, modernStool: true, visualOnly: true };
}
export function openingTransform(opening: WallOpening, roomOrWidth: RoomData | number, legacyRoomDepth?: number) {
  const room = typeof roomOrWidth === "number" ? null : roomOrWidth;
  const roomWidth = typeof roomOrWidth === "number" ? roomOrWidth : roomOrWidth.width;
  const roomDepth = typeof roomOrWidth === "number" ? Number(legacyRoomDepth) : roomOrWidth.depth;
  const customWall = room?.customWalls?.find((wall) => wall.id === opening.side);
  const start = customWall && room?.vertices?.find((vertex) => vertex.id === customWall.startVertexId);
  const end = customWall && room?.vertices?.find((vertex) => vertex.id === customWall.endVertexId);
  if (customWall && start && end) {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > 0.001) {
      const tangentX = (end.x - start.x) / length;
      const tangentY = (end.y - start.y) / length;
      const centerOffset = Math.max(0, Math.min(length, opening.offset + opening.width / 2));
      const inset = 0.06;
      const side = customWallCabinetSide(room!, customWall.id);
      const leftNormal = { x: -tangentY, y: tangentX };
      const inward = side === "left" ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
      return {
        x: start.x + tangentX * centerOffset + inward.x * inset,
        z: start.y + tangentY * centerOffset + inward.y * inset,
        rotation: threeDPlanRotation(polygonWallAngle(customWall, room!.vertices!) + (side === "right" ? Math.PI : 0)),
      };
    }
  }
  const offset = opening.offset + opening.width / 2;
  if (opening.side === "bottom") return { x: offset, z: roomDepth - 0.06, rotation: Math.PI };
  if (opening.side === "left") return { x: 0.06, z: offset, rotation: Math.PI / 2 };
  if (opening.side === "right") return { x: roomWidth - 0.06, z: offset, rotation: -Math.PI / 2 };
  return { x: offset, z: 0.06, rotation: 0 };
}

/** A deterministic daylight view keeps windows visually useful in the planning scene. */
function windowSceneTexture(kind: WindowSceneKind = "daylight"): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#f7ead4");
  sky.addColorStop(0.46, "#dbe8e4");
  sky.addColorStop(0.47, "#b9cdbf");
  sky.addColorStop(1, "#8ea08e");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (kind === "privacy") {
    context.fillStyle = "rgba(245, 244, 238, 0.9)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(175, 180, 177, 0.36)";
    context.lineWidth = 10;
    for (let y = 18; y < canvas.height; y += 34) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y + 12);
      context.stroke();
    }
  } else if (kind === "suburban") {
    context.fillStyle = "#d9d0bd";
    context.fillRect(0, 300, canvas.width, 120);
    for (const building of [30, 190, 390, 535]) {
      const height = building % 3 === 0 ? 88 : 62;
      context.fillStyle = building % 2 ? "#b9ae9f" : "#c7bda9";
      context.fillRect(building, 300 - height, 105, height);
      context.fillStyle = "#6e7775";
      for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) {
        context.fillRect(building + 15 + col * 28, 320 - height + row * 28, 12, 15);
      }
    }
    context.fillStyle = "#7f8a7e";
    context.fillRect(0, 360, canvas.width, 60);
    context.fillStyle = "#d2c4a7";
    context.fillRect(0, 382, canvas.width, 8);
  }

  context.fillStyle = "rgba(255, 247, 216, 0.9)";
  context.beginPath();
  context.arc(500, 92, 42, 0, Math.PI * 2);
  context.fill();

  const distantHill = (y: number, color: string, height: number) => {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, canvas.height);
    context.lineTo(0, y + 24);
    for (let x = 0; x <= canvas.width; x += 40) {
      context.lineTo(x, y + Math.sin(x / 72) * height + Math.cos(x / 31) * 8);
    }
    context.lineTo(canvas.width, canvas.height);
    context.closePath();
    context.fill();
  };
  distantHill(242, "#8fa89a", 26);
  distantHill(285, "#6f8d74", 34);

  context.fillStyle = "#55735c";
  context.fillRect(0, 340, canvas.width, 80);
  for (const tree of [55, 125, 565, 615]) {
    context.fillStyle = "#4e6b55";
    context.fillRect(tree - 4, 272, 8, 70);
    context.beginPath();
    context.moveTo(tree, 220);
    context.lineTo(tree - 31, 292);
    context.lineTo(tree + 31, 292);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(tree, 245);
    context.lineTo(tree - 38, 316);
    context.lineTo(tree + 38, 316);
    context.closePath();
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData = { windowScene: true, windowSceneKind: kind, planningOnly: true };
  return texture;
}

export function windowPhotoCoverCrop(imageAspect: number, openingAspect: number): { repeatX: number; repeatY: number; offsetX: number; offsetY: number } {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0 || !Number.isFinite(openingAspect) || openingAspect <= 0) {
    return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
  }
  if (imageAspect > openingAspect) {
    const repeatX = openingAspect / imageAspect;
    return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 };
  }
  const repeatY = imageAspect / openingAspect;
  return { repeatX: 1, repeatY, offsetX: 0, offsetY: (1 - repeatY) / 2 };
}

function windowPhotoTexture(kind: WindowSceneKind, openingAspect: number): THREE.Texture | null {
  const url = windowSceneAssetUrl(kind);
  if (!url || typeof window === "undefined") return null;
  const texture = new THREE.TextureLoader().load(url, (loaded) => {
    const image = loaded.image as { width?: number; height?: number } | undefined;
    const crop = windowPhotoCoverCrop(Number(image?.width) / Number(image?.height), openingAspect);
    loaded.repeat.set(crop.repeatX, crop.repeatY);
    loaded.offset.set(crop.offsetX, crop.offsetY);
    loaded.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.userData = { windowScene: true, windowSceneKind: kind, realPhotograph: true, planningOnly: true };
  return texture;
}

export function windowMullionGrid(kind: WindowSceneKind, style: WindowGridStyle = "scene-default"): { columns: number; rows: number } {
  if (style === "none") return { columns: 0, rows: 0 };
  if (style === "1x0") return { columns: 1, rows: 0 };
  if (style === "2x0") return { columns: 2, rows: 0 };
  if (style === "3x0") return { columns: 3, rows: 0 };
  if (style === "0x1") return { columns: 0, rows: 1 };
  if (style === "0x2") return { columns: 0, rows: 2 };
  if (style === "0x3") return { columns: 0, rows: 3 };
  if (style === "1x1") return { columns: 1, rows: 1 };
  if (style === "2x1") return { columns: 2, rows: 1 };
  if (style === "2x2") return { columns: 2, rows: 2 };
  if (style === "3x2") return { columns: 3, rows: 2 };
  if (kind === "woodland") return { columns: 2, rows: 1 };
  if (kind === "coastal") return { columns: 1, rows: 2 };
  if (kind === "garden") return { columns: 1, rows: 0 };
  if (kind === "urban") return { columns: 2, rows: 2 };
  if (kind === "mountain") return { columns: 1, rows: 1 };
  if (kind === "night") return { columns: 2, rows: 1 };
  if (kind === "city-skyline") return { columns: 2, rows: 1 };
  if (kind === "desert") return { columns: 1, rows: 0 };
  if (kind === "snow") return { columns: 2, rows: 1 };
  if (kind === "seasonal-garden") return { columns: 1, rows: 1 };
  if (kind === "autumn-woodland") return { columns: 2, rows: 2 };
  return { columns: 1, rows: 1 };
}

export function addWallOpening(root: THREE.Group, opening: WallOpening, roomOrWidth: RoomData | number, legacyRoomDepth?: number, windowSceneKind: WindowSceneKind = DEFAULT_WINDOW_SCENE_KIND, windowFrameStyle: WindowFrameStyle = "white") {
  const { x, z, rotation } = openingTransform(opening, roomOrWidth, legacyRoomDepth);
  const group = new THREE.Group();
  group.position.set(x * INCH, (opening.sill + opening.height / 2) * INCH, z * INCH);
  group.rotation.y = rotation;
  group.userData = { openingUid: opening.uid, kind: opening.kind, label: opening.label };
  const width = opening.width * INCH;
  const height = opening.height * INCH;
  const isDoor = opening.kind === "door";
  const appearance = doorOpeningAppearance(opening);
  const isBifold = opening.kind === "door" && opening.doorStyle === "bifold";
  const effectiveWindowSceneKind = opening.windowSceneKind ?? windowSceneKind;
  const effectiveWindowFrameStyle = opening.windowFrameStyle ?? windowFrameStyle;
  const effectiveWindowConstructionStyle = opening.windowConstructionStyle ?? "picture";
  const effectiveWindowGridStyle = opening.windowGridStyle ?? "scene-default";
  const trimMaterial = new THREE.MeshStandardMaterial({ color: windowFrameColor(effectiveWindowFrameStyle), roughness: effectiveWindowFrameStyle === "wood" ? 0.62 : 0.5, metalness: effectiveWindowFrameStyle === "black" ? 0.08 : 0 });
  const openingDepth = 0.12;
  const trimWidth = Math.min(0.12, Math.max(0.055, width * 0.075));
  const backingMaterial = isDoor ? new THREE.MeshStandardMaterial({ color: appearance.color, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false }) : trimMaterial;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(width + trimWidth * 2, height + trimWidth * 2, 0.07), backingMaterial);
  backing.userData = { architecturalOpeningBacking: true };
  // A reach-in bi-fold is a room aperture, not a blank white wall behind its leaves.
  if (!isBifold) group.add(backing);
  const trimPieces = [
    [width + trimWidth * 2, trimWidth, 0, height / 2 + trimWidth / 2],
    [width + trimWidth * 2, trimWidth, 0, -height / 2 - trimWidth / 2],
    [trimWidth, height, -width / 2 - trimWidth / 2, 0],
    [trimWidth, height, width / 2 + trimWidth / 2, 0],
  ] as const;
  for (const [pieceWidth, pieceHeight, pieceX, pieceY] of trimPieces) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(pieceWidth, pieceHeight, openingDepth), trimMaterial);
    trim.position.set(pieceX, pieceY, openingDepth / 2);
    trim.userData = { architecturalOpeningTrim: true, openingKind: opening.kind };
    group.add(trim);
  }
  const isWindow = opening.kind === "window";
  if (isBifold) {
    // Generic room-door reference only: four leaves across the nominal opening.
    // This is not a MasterTrac SKU, hinge/swing specification, or rough-opening cut list.
    const leafWidth = (width - 0.08) / 4;
    const leafMaterial = new THREE.MeshStandardMaterial({ color: appearance.color, roughness: 0.6, transparent: true, opacity: appearance.opacity, depthWrite: false });
    for (let index = 0; index < 4; index += 1) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidth - 0.012, height - 0.08, 0.055), leafMaterial);
      leaf.position.set(-width / 2 + 0.04 + leafWidth * (index + 0.5), 0, 0.02);
      leaf.userData = { architecturalBifoldLeaf: index + 1 };
      group.add(leaf);
  }
  } else {
  const windowTexture = isWindow ? (windowPhotoTexture(effectiveWindowSceneKind, width / height) ?? windowSceneTexture(effectiveWindowSceneKind)) : null;
  const paneMaterial = isWindow && windowTexture
    ? new THREE.MeshBasicMaterial({ map: windowTexture, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: isWindow ? "#dbe8e4" : isDoor ? appearance.color : "#4a3528", roughness: 0.28, metalness: isWindow ? 0.12 : 0, ...(isDoor ? { transparent: true, opacity: appearance.opacity, depthWrite: false } : {}) });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, height - 0.08, 0.08), paneMaterial);
  pane.position.z = 0.01;
  if (isDoor) pane.userData = { architecturalDoorSlab: true, planningOpacity: appearance.opacity };
  group.add(pane);
  if (isWindow) {
    const muntin = new THREE.MeshStandardMaterial({ color: windowFrameColor(effectiveWindowFrameStyle), roughness: effectiveWindowFrameStyle === "wood" ? 0.62 : 0.45, metalness: effectiveWindowFrameStyle === "black" ? 0.08 : 0 });
    const grid = windowMullionGrid(effectiveWindowSceneKind, effectiveWindowGridStyle);
    const constructionGrid = windowConstructionGrid(effectiveWindowConstructionStyle);
    const resolvedGrid = { columns: Math.max(grid.columns, constructionGrid.columns), rows: Math.max(grid.rows, constructionGrid.rows) };
    const mullions: THREE.Mesh[] = [];
    for (let column = 1; column <= resolvedGrid.columns; column += 1) {
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.035, height - 0.05, 0.09), muntin);
      vertical.position.x = -width / 2 + (width * column) / (resolvedGrid.columns + 1);
      vertical.userData = { windowMuntin: "vertical", windowMuntinIndex: column };
      mullions.push(vertical);
    }
    for (let row = 1; row <= resolvedGrid.rows; row += 1) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(width - 0.05, 0.035, 0.09), muntin);
      horizontal.position.y = -height / 2 + (height * row) / (resolvedGrid.rows + 1);
      horizontal.userData = { windowMuntin: "horizontal", windowMuntinIndex: row };
      mullions.push(horizontal);
    }
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.08, height - 0.08, 0.018),
      new THREE.MeshPhysicalMaterial({ color: "#d9f0f2", transparent: true, opacity: 0.16, roughness: 0.055, metalness: 0.08, transmission: 0.12, ior: 1.46, thickness: 0.04, depthWrite: false, side: THREE.DoubleSide }),
    );
    glass.position.z = 0.062;
    glass.userData = { windowGlassReflection: true, windowSceneKind: effectiveWindowSceneKind, windowConstructionStyle: effectiveWindowConstructionStyle, windowGridStyle: effectiveWindowGridStyle, realPhotograph: Boolean(windowSceneAssetUrl(effectiveWindowSceneKind)) };
    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.08, width * 0.16), height * 0.88),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }),
    );
    reflection.position.set(-width * 0.22, height * 0.02, 0.075);
    reflection.rotation.z = -0.28;
    reflection.userData = { windowGlassHighlight: true, windowSceneKind: effectiveWindowSceneKind };
    const sill = new THREE.Mesh(new THREE.BoxGeometry(width + trimWidth * 2.7, trimWidth * 1.5, 0.2), trimMaterial);
    sill.position.set(0, -height / 2 - trimWidth * 0.85, 0.12);
    sill.userData = { architecturalWindowSill: true };
    group.add(...mullions, glass, reflection, sill);
  } else {
    const doorPanelMaterial = new THREE.MeshStandardMaterial({ color: isDoor ? appearance.color : "#6f503b", roughness: 0.54, ...(isDoor ? { transparent: true, opacity: appearance.opacity * 0.6, depthWrite: false } : {}) });
    const upperPanel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, height * 0.26, 0.035), doorPanelMaterial);
    const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, height * 0.43, 0.035), doorPanelMaterial);
    upperPanel.position.set(0, height * 0.19, 0.065);
    lowerPanel.position.set(0, -height * 0.2, 0.065);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshStandardMaterial({ color: "#c7b287", roughness: 0.28, metalness: 0.6 }));
    handle.position.set(width * 0.36, 0, 0.1);
    upperPanel.userData = { architecturalDoorPanel: "upper" };
    lowerPanel.userData = { architecturalDoorPanel: "lower" };
    handle.userData = { architecturalDoorHandle: true };
    group.add(upperPanel, lowerPanel, handle);
  }
  }
  if (isDoor && !isBifold) {
    const swing = roomDoorSwing(opening);
    const hingeX = swing.hinge === "left" ? -width / 2 : width / 2;
    const pivot = new THREE.Group();
    pivot.position.x = hingeX;
    pivot.rotation.y = -swing.sign * swing.angle * Math.PI / 180;
    pivot.userData = { architecturalDoorLeafPivot: true, openAngle: swing.angle, hinge: swing.hinge };
    for (const mesh of [...group.children]) {
      if (!mesh.userData.architecturalDoorSlab && !mesh.userData.architecturalDoorPanel && !mesh.userData.architecturalDoorHandle) continue;
      if (mesh.userData.architecturalDoorHandle) mesh.position.x = swing.sign * width * 0.36;
      mesh.position.x -= hingeX;
      pivot.add(mesh);
    }
    group.add(pivot);
  }
  root.add(group);
}

export function compactWallCodeDimensions(cabinet: Pick<PlacedCabinet, "masterCode" | "placement">) {
  if (cabinet.placement !== "wall") return null;
  // Compact wall codes are width-first: W3024 means 30" wide by 24" high.
  // Some imported catalog rows carried these values transposed, so the code is
  // authoritative for the W[width][height] family in the 3D scene.
  const match = (cabinet.masterCode ?? "").toUpperCase().match(/^W-?(\d{2})-?(\d{2})(?:[A-Z]+)?$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width >= 9 && height >= 9 ? { width, height } : null;
}

export function existingCabinetSku(cabinet: PlacedCabinet, room?: RoomData): SceneSku {
  // The shared saved-placement contract owns every corner family. The 3D
  // renderer receives its classification rather than re-inferring the shape.
  const sharedCornerKind = placedCornerGeometryKind(cabinet);
  const footprint = sharedCornerKind !== "standard" ? normalizedThreeDFootprint(cabinet) : null;
  const cornerBody = threeDCornerBodyDimensions(cabinet);
  const applianceCode = `${cabinet.masterCode ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const inferredAppliancePlacement = /^(?:fridge|range|hood|dw|wine|mw)/i.test(cabinet.masterCode ?? "");
  // Tall UOC / oven-pantry cabinets contain an oven but are not appliances.
  // Keep their configured tall enclosure in the oven-cabinet renderer. Sending
  // them through the appliance path turns the full cabinet into a freestanding
  // oven shape and causes the visible distorted tower regression.
  const isOvenTowerCabinet = cabinet.placement === "tall"
    && /\b(?:oven\s+(?:cabinet|tower|pantry)|universal\s+oven\s+cabinet)\b/i.test(`${cabinet.masterCode ?? ""} ${cabinet.description ?? ""}`);
  const placementType = cabinet.placement === "appliance" || (!isOvenTowerCabinet && (inferredAppliancePlacement || isRangeOrOven(cabinet.masterCode, cabinet.description)))
    ? "appliance"
    : cabinet.placement;
  const appliance = placementType === "appliance"
    ? APPLIANCES.find((item) => {
      const definition = item as typeof item & { id?: string; code?: string };
      const key = `${definition.masterCode ?? definition.id ?? definition.code ?? definition.key ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      return key === applianceCode;
    })
    : undefined;
  const codeDimensions = compactWallCodeDimensions(cabinet);
  return {
    placementUid: cabinet.uid,
    distributorSkuId: -(Math.abs(cabinet.cabinetId) || 1),
    cabinetId: cabinet.cabinetId,
    masterCode: cabinet.masterCode,
    description: cabinet.description,
    category: cabinet.category ?? null,
    masterTracShelfCut: cabinet.masterTracShelfCut,
    subCategory: cabinet.subCategory ?? null,
    applianceRole: cabinet.applianceRole ?? null,
    applianceProductId: cabinet.applianceProductId ?? null,
    applianceCatalogCode: cabinet.applianceCatalogCode ?? null,
    applianceCatalogName: cabinet.applianceCatalogName ?? null,
    applianceCatalogPrice: cabinet.applianceCatalogPrice ?? null,
    rangeTopImageUrl: cabinet.rangeTopImageUrl ?? null,
    rangeTopFinish: cabinet.rangeTopFinish ?? null,
    constructionMethod: cabinet.constructionMethod ?? null,
    placementType,
    // The placed record is primary. Older appliance records can lack one of
    // these dimensions, in which case use the same APPLIANCES definition that
    // created the 2D placement—never the generic 24/12-inch cabinet defaults.
    width: cornerBody?.width ?? footprint?.w ?? codeDimensions?.width ?? cabinet.width ?? appliance?.width,
    height: codeDimensions?.height ?? cabinet.height ?? appliance?.elevHeight ?? (placementType === "wall" ? STD.WALL_HEIGHT : placementType === "tall" ? STD.TALL_HEIGHT : STD.BASE_HEIGHT),
    depth: cornerBody?.depth ?? footprint?.d ?? cabinet.depth ?? appliance?.depth,
    numberOfDoors: cabinet.numberOfDoors ?? null,
    numberOfDrawers: cabinet.numberOfDrawers ?? null,
	    fixedShelfCount: cabinet.fixedShelfCount ?? null,
	    adjustableShelfCount: glassDoorShelfCount(cabinet) || cabinet.adjustableShelfCount || null,
	    glassDoor: isGlassDoorCabinet(cabinet),
    doorOrientation: cabinet.doorOrientation ?? null,
	    swing: resolveSwing(cabinet),
    handleSide: cabinet.handleSide === "left" || cabinet.handleSide === "right" ? cabinet.handleSide : null,
    mountBottom: cabinet.mountBottom ?? null,
    hardwarePosition: resolveCabinetHardwarePosition(cabinet),
    openingType: cabinet.openingType ?? null,
    openingWidth: cabinet.openingWidth ?? null,
    openingHeight: cabinet.openingHeight ?? null,
    doorHeight: cabinet.doorHeight ?? null,
    drawerHeight: cabinet.drawerHeight ?? null,
    drawerLayout: cabinet.drawerLayout ?? null,
    layoutSpec: cabinet.layoutSpec ?? null,
    ovenType: cabinet.ovenType ?? null,
    sourceOvenDrawerLayout: cabinet.sourceOvenDrawerLayout ?? null,
    graphicType: cabinet.customProfile ?? null,
    customProfile: cabinet.customProfile ?? null,
    facePattern: cabinet.facePattern ?? null,
    cornerType: sharedCornerKind === "diagonal" ? "diagonal" : sharedCornerKind === "l-shape" || sharedCornerKind === "corner-drawer" ? "l-shape" : cabinet.cornerType ?? null,
    cornerGeometryKind: sharedCornerKind,
    catalogImageUrl: cabinet.catalogImageUrl ?? appliance?.catalogImageUrl ?? null,
    decorativeEnd: cabinet.decorativeEnd ?? "none",
	    fillerPieceGroupId: cabinet.fillerPieceGroupId ?? null,
	    fillerTotalWidth: cabinet.fillerTotalWidth ?? null,
	    fillerPlacementMode: cabinet.fillerPlacementMode ?? null,
	    fillerMatchesFullOwnerEnvelope: cabinet.fillerMatchesFullOwnerEnvelope ?? null,
	    fillerMiterAngle: cabinet.fillerMiterAngle ?? null,
	    fillerMiteredEnd: cabinet.fillerMiteredEnd ?? null,
	    fillerTransitionKind: cabinet.fillerTransitionKind ?? null,
	    fillerTransitionPiece: cabinet.fillerTransitionPiece ?? null,
	    fillerTransitionNeighborUid: cabinet.fillerTransitionNeighborUid ?? null,
	    fillerTransitionRearWidthIn: cabinet.fillerTransitionRearWidthIn ?? null,
	    fillerTransitionFrontWidthIn: cabinet.fillerTransitionFrontWidthIn ?? null,
	    fillerTransitionStockWidthIn: cabinet.fillerTransitionStockWidthIn ?? null,
	    fillerIndependentCabinetSupport: cabinet.fillerIndependentCabinetSupport ?? null,
		    countertopRearExtensionIn: room ? blindCornerRearCountertopExtensionIn(cabinet, room) : 0,
	    islandFace: cabinet.islandFace ?? null,
	    islandCounterHeightWallCabinet: cabinet.islandCounterHeightWallCabinet ?? null,
	    islandWallCabinetBaseTreatment: cabinet.islandWallCabinetBaseTreatment ?? null,
	    waterfallLeft: cabinet.waterfallLeft ?? null,
	    waterfallRight: cabinet.waterfallRight ?? null,
	  };
}

export function threeDSceneInputDiagnostics(
  placed: PlacedCabinet[],
  doorSampleUrl: string | null | undefined,
  roomSceneReferenceUrl?: string | null,
) {
  const mapped = placed.map((cabinet) => existingCabinetSku(cabinet));
  return {
    cabinetCount: mapped.length,
    doorSampleUrl: doorSampleUrl ?? null,
    roomSceneReferenceUrl: roomSceneReferenceUrl ?? null,
    roomSceneRenderedAsGeometry: false,
    ovenTowerCount: mapped.filter((item) => Boolean(item.ovenType) || /(?:^|[-_])(UOC|OC|OVEN)|oven cabinet/i.test(`${item.masterCode} ${item.description ?? ""}`)).length,
    measuredDrawerCabinetCount: mapped.filter((item) => item.drawerLayout != null || item.drawerHeight != null).length,
    specialtyCabinetCount: mapped.filter((item) => item.graphicType != null || item.facePattern != null || item.cornerType != null).length,
    mapped,
  };
}

/**
 * Rendering-only compatibility repair for legacy saved refrigerator cap
 * fillers. The source plan stays untouched; this returns the exact same
 * verified filler envelope used by the regular Designer restore path.
 */
export function threeDRenderPlacements(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  return normalizeInstalledFillersToAdjacentCabinets(placed, room);
}

export type ThreeDDesignParityInput = Pick<Props,
  "roomOverride" | "placed" | "openings" | "sinks" | "potFillers" | "island" | "furniture" | "ponyWalls"
  | "catalogDoorSampleUrl" | "catalogFinishOverride" | "catalogFinishName"
  | "catalogCountertopName" | "catalogCountertopColor" | "initialPresentation"
>;

/**
 * A single auditable representation of the 2D entities and shared transforms
 * consumed by the deterministic 3D renderer. Raw source records are retained
 * beside their renderer inputs so that fields cannot silently disappear during
 * saved-design hydration or future geometry refactors.
 */
export function threeDDesignParitySnapshot({
  roomOverride,
  placed = [],
  openings = [],
  sinks = [],
  potFillers = [],
  island = null,
  furniture = [],
  ponyWalls = [],
  catalogDoorSampleUrl,
  catalogFinishOverride,
  catalogFinishName,
  catalogCountertopName,
  catalogCountertopColor,
  initialPresentation,
}: ThreeDDesignParityInput) {
  const room = roomOverride ?? { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
  return {
    room: { width: room.width, depth: room.depth, ceilingHeight: room.ceilingHeight },
    materials: {
      doorSampleUrl: catalogDoorSampleUrl ?? null,
      cabinetColor: catalogFinishOverride ?? null,
      cabinetName: catalogFinishName ?? null,
      countertopName: catalogCountertopName ?? null,
      countertopColor: catalogCountertopColor ?? null,
      presentation: initialPresentation ?? null,
    },
    cabinets: placed.map((source) => ({
      source,
      footprint: normalizedThreeDFootprint(source),
      transform: existingCabinetTransform(source, room),
      sku: existingCabinetSku(source, room),
      countertopSupported: shouldRenderCountertopOverSceneItem(source),
    })),
	    openings: openings.map((source) => ({ source, transform: openingTransform(source, room) })),
    sinks: sinks.map((source) => ({ source, transform: sinkFixtureTransform(source) })),
    potFillers: potFillers.map((source) => {
      const range = potFillerMountedRange(source, placed, room, island);
      return { source, rangeUid: range?.uid ?? null, transform: range ? potFillerWallMountTransform(source, range, room) : null };
    }),
    island: island ? { source: island, transform: islandZoneTransform(island) } : null,
    furniture: furniture.map((source) => {
      const definition = FURNITURE_CATALOG.find((entry) => entry.id === source.defId) ?? null;
      return {
        source,
        definition,
        transform: definition ? furnitureTransform(source, definition.w, definition.d) : null,
      };
    }),
    ponyWalls: ponyWalls.map((source) => ({ source, transform: ponyWallTransform(source, room) })),
  };
}

/**
 * Stable geometry-only signature for the exact saved Designer plan. Visual
 * material inputs are intentionally excluded: changing a door sample, surface
 * image, PBR profile, exposure, or quality tier must never move or substitute
 * any designed object.
 */
export function threeDExactPlanGeometryLock(input: ThreeDDesignParityInput) {
  const snapshot = threeDDesignParitySnapshot(input);
  return JSON.stringify({
    room: snapshot.room,
    cabinets: snapshot.cabinets.map(({ source, footprint, transform, sku, countertopSupported }) => ({
      uid: source.uid,
      cabinetId: source.cabinetId,
      masterCode: source.masterCode,
      footprint,
      transform,
      dimensions: { width: sku.width, depth: sku.depth, height: sku.height, mountBottom: sku.mountBottom },
      countertopSupported,
    })),
    openings: snapshot.openings.map(({ source, transform }) => ({ uid: source.uid, kind: source.kind, transform })),
    sinks: snapshot.sinks.map(({ source, transform }) => ({ uid: source.uid, type: source.type, transform })),
    potFillers: snapshot.potFillers.map(({ source, rangeUid, transform }) => ({ uid: source.uid, rangeUid, mountingWallId: source.mountingWallId, pelicanProductId: source.pelicanProductId, transform })),
    island: snapshot.island,
    furniture: snapshot.furniture,
    ponyWalls: snapshot.ponyWalls,
  });
}

/** Stable signature of the exact 2D inputs that must create a fresh WebGL scene. */
export function threeDSceneRevisionKey(
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  sinks: SinkFixture[],
  island: { x: number; y: number; width: number; depth: number } | null,
  furniture: PlacedFurniture[],
  ponyWalls: PonyWall[],
  doorSampleUrl: string | null | undefined,
  countertopMaterialKey?: string | null,
  catalogFinishColor?: string | null,
  potFillers: PotFillerFixture[] = [],
) {
  return JSON.stringify({ parity: threeDDesignParitySnapshot({
    roomOverride: room,
    placed,
    openings,
    sinks,
    potFillers,
    island,
    furniture,
    ponyWalls,
    catalogDoorSampleUrl: doorSampleUrl,
    catalogCountertopColor: countertopMaterialKey,
    catalogFinishOverride: catalogFinishColor,
  }), countertopMaterialKey: countertopMaterialKey ?? null });
}

export function threeDPlanSyncText({
  placed,
  openings,
  sinks,
  potFillers,
  island,
  furniture,
  ponyWalls,
}: Pick<Props, "placed" | "openings" | "sinks" | "potFillers" | "island" | "furniture" | "ponyWalls">) {
  const potFillerStatus = (potFillers?.length ?? 0) > 0 ? ` · ${potFillers!.length} pot fillers` : "";
  return `Plan sync: ${placed?.length ?? 0} cabinet items · ${openings?.length ?? 0} openings · ${sinks?.length ?? 0} sinks${potFillerStatus} · ${island ? 1 : 0} island · ${furniture?.length ?? 0} furniture · ${ponyWalls?.length ?? 0} pony walls`;
}

export function hasPersistedTwoDScene({
  placed,
  openings,
  sinks,
  potFillers,
  island,
  furniture,
  ponyWalls,
}: Pick<Props, "placed" | "openings" | "sinks" | "potFillers" | "island" | "furniture" | "ponyWalls">) {
  return Boolean(
    (placed?.length ?? 0) ||
    (openings?.length ?? 0) ||
    (sinks?.length ?? 0) ||
    (potFillers?.length ?? 0) ||
    island ||
    (furniture?.length ?? 0) ||
    (ponyWalls?.length ?? 0),
  );
}

export function threeDUsesAuthoritativePlanScene(
  roomOverride: RoomData | undefined,
  input: Pick<Props, "placed" | "openings" | "sinks" | "potFillers" | "island" | "furniture" | "ponyWalls">,
) {
  return Boolean(roomOverride) || hasPersistedTwoDScene(input);
}

export function rangeHoodSceneStatus(placed: PlacedCabinet[]) {
  const ranges = placed.filter((item) => /^RANGE-/.test(item.masterCode));
  const hasRange = ranges.length > 0;
  const hasRangeHood = placed.some((item) => /^HOOD-/.test(item.masterCode));
  const hasOverRangeMicrowave = placed.some((item) => {
    const source = `${item.masterCode ?? ""} ${item.description ?? ""}`.toLowerCase();
    const explicitlyOverRange = /over[-\s]?range\s+microwave|microwave\s+over[-\s]?range|\botr\b/.test(source);
    const isStandardOtrSku = /^mw[-_]?30\b/i.test(item.masterCode ?? "");
    return explicitlyOverRange || isStandardOtrSku;
  }) || ranges.some((range) => placed.some((item) => isMicrowaveOverRangePair(range, item)));
  return { hasRange, hasRangeHood, hasOverRangeMicrowave, needs2DPlacement: hasRange && !hasRangeHood && !hasOverRangeMicrowave };
}

/**
 * Auditable visibility inputs for the objects that can disappear in a dense
 * room render. The mesh builders consume these same placement and support
 * contracts, so a regression catches a missing hood, shifted tall appliance,
 * or unsupported counter run before a visual review is needed.
 */
export function threeDSceneVisibilityContract(placed: PlacedCabinet[], room: RoomData) {
  const hood = placed.find((item) => /^HOOD-/.test(item.masterCode)) ?? null;
  const tall = placed.filter((item) => item.placement === "tall" || /^(FRIDGE|WR|REP)/.test(item.masterCode));
  return {
    hood: hood
      ? {
        masterCode: hood.masterCode,
        transform: existingCabinetTransform(hood, room),
        geometry: rangeHoodGeometry(hood.width ?? 30, hood.depth ?? 18, hood.height ?? 18),
      }
      : null,
    tall: tall.map((item) => ({ masterCode: item.masterCode, transform: existingCabinetTransform(item, room) })),
    countertopSupport: placed
      .filter((item) => shouldRenderCountertopOverSceneItem(item))
      .map((item) => item.masterCode),
  };
}

export function resolvedThreeDCountertopFinish(
  initialPresentation: InteractiveRoomPresentation | undefined,
  catalogCountertopColor: string | null | undefined,
  scene: InteractiveRoomScene,
) {
  return initialPresentation?.countertopFinish
    ?? catalogCountertopColor
    ?? scene.materials?.defaults.countertop
    ?? "#e9e7e2";
}

export function threeDPresentationEmissionKey(cabinetFinish: string, countertopFinish: string) {
  return `${cabinetFinish}::${countertopFinish}`;
}

export function shouldEmitThreeDPresentation(previousKey: string | null, cabinetFinish: string, countertopFinish: string) {
  return previousKey !== threeDPresentationEmissionKey(cabinetFinish, countertopFinish);
}

export function resolvedThreeDWallHeights(room: RoomData | undefined, fallbackHeight: number): Record<WallSide, number> {
  const fallback = constrainedThreeDWallHeight(room?.ceilingHeight ?? fallbackHeight, fallbackHeight);
  return THREE_D_WALL_SIDES.reduce((heights, side) => {
    const selected = room?.wallCeilings?.[side]?.high;
    heights[side] = constrainedThreeDWallHeight(selected ?? fallback, fallback);
    return heights;
  }, {} as Record<WallSide, number>);
}

/** Changes one wall only; all other independent room-wall heights remain intact. */
export function updatedThreeDWallHeights(current: Record<WallSide, number>, side: WallSide, nextHeight: number): Record<WallSide, number> {
  return { ...current, [side]: nextHeight };
}

/** Resolves a rectangular or polygon room edge to the familiar Back, Left, Right, or Front control. */
export function threeDWallSideForEdge(start: { x: number; y: number }, end: { x: number; y: number }, room: Pick<RoomData, "width" | "depth">): WallSide {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  // room dimensions are persisted in inches, while the rendered polygon is in
  // Three.js feet. Compare like-for-like so the front and right edges do not
  // collapse into the back and left controls on every room.
  const renderedWidth = room.width * INCH;
  const renderedDepth = room.depth * INCH;
  // roomPolygon inverts plan Y for Three.js (front becomes negative Z), so
  // restore that sign before choosing between Back/top and Front/bottom.
  const renderedPlanY = -midY;
  if (Math.abs(dx) >= Math.abs(dy)) return renderedPlanY <= renderedDepth / 2 ? "top" : "bottom";
  return midX <= renderedWidth / 2 ? "left" : "right";
}

/** A rectangular room polygon is emitted clockwise as Back, Right, Front, Left. */
export function threeDWallSideForPolygonEdge(index: number, edgeCount: number, start: { x: number; y: number }, end: { x: number; y: number }, room: Pick<RoomData, "width" | "depth">): WallSide {
  if (edgeCount === 4) return (["top", "right", "bottom", "left"] as const)[index % 4];
  return threeDWallSideForEdge(start, end, room);
}

/**
 * Upper cabinets require a normal 96-inch room wall behind them, even when an
 * individual upper happens to end below that height. The preview never silently
 * changes a user-selected wall value; it uses this contract to surface a clear
 * warning instead.
 */
export function threeDUpperCabinetWallMinimums(placed: PlacedCabinet[], room: RoomData): Partial<Record<WallSide, number>> {
  const physicalToSide: Record<ThreeDPlacedWall, WallSide> = { back: "top", right: "right", front: "bottom", left: "left" };
  return placed.reduce((minimums, cabinet) => {
    if (cabinet.placement !== "wall") return minimums;
    const physicalWall = threeDPlacedWall(cabinet, room);
    if (!physicalWall) return minimums;
    const side = physicalToSide[physicalWall];
    const elevation = elevationBox(cabinet, room);
    const resolvedTop = elevation.bottom + elevation.height;
    const cabinetTop = Number.isFinite(resolvedTop) ? resolvedTop : 0;
    minimums[side] = Math.max(minimums[side] ?? 0, 96, cabinetTop);
    return minimums;
  }, {} as Partial<Record<WallSide, number>>);
}

type ThreeDViewerNavigationActions = {
  onZoom: (direction: "in" | "out") => void;
  onReset: () => void;
  onShare: () => void | Promise<void>;
  onPhotoRender?: () => void;
  onPan: (direction: "up" | "down" | "left" | "right") => void;
};

export function ThreeDViewerNavigationControls({ onZoom, onReset, onShare, onPhotoRender, onPan, className = "", testId = "three-d-viewer-navigation", compact = false, hidePan = false }: ThreeDViewerNavigationActions & { className?: string; testId?: string; compact?: boolean; hidePan?: boolean }) {
  if (compact) {
    const tap = "flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] shadow-sm transition hover:bg-slate-50 active:scale-95";
    return (
      <div data-testid={testId} aria-label="3D viewer zoom and pan controls" className={`flex-col items-center gap-1.5 rounded-lg border border-slate-300 bg-white/95 p-1.5 shadow-lg backdrop-blur ${className}`}>
        <button data-testid="three-d-zoom-in" type="button" onClick={() => onZoom("in")} aria-label="Zoom in for a closer cabinet view" title="Zoom in" className={tap}><Plus className="h-5 w-5" aria-hidden="true" /></button>
        <button data-testid="three-d-zoom-out" type="button" onClick={() => onZoom("out")} aria-label="Zoom out for a wider room view" title="Zoom out" className={tap}><Minus className="h-5 w-5" aria-hidden="true" /></button>
        <button data-testid="three-d-reset-view" type="button" onClick={onReset} aria-label="Reset 3D room view" title="Reset view" className={tap}><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
        <button data-testid="three-d-share-view" type="button" onClick={() => void onShare()} aria-label="Share the current 3D zoom and pan perspective" title="Share current view" className={tap}><Share2 className="h-4 w-4" aria-hidden="true" /></button>
        {onPhotoRender && <button data-testid="three-d-photo-render" type="button" onClick={onPhotoRender} aria-label="Create a final photo-quality image from this exact completed 3D view" title="Photo Quality — final review image" className="flex h-11 w-11 items-center justify-center rounded-md border border-[#1a2744] bg-[#1a2744] text-white shadow-sm transition hover:bg-[#24375f] active:scale-95"><Sparkles className="h-4 w-4" aria-hidden="true" /></button>}
        {!hidePan && (
          <div className="grid grid-cols-3 gap-1" aria-label="Pan the 3D room view">
            <span /><button data-testid="three-d-pan-up" type="button" onClick={() => onPan("up")} aria-label="Pan view up" title="Pan up" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] active:scale-95"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button><span />
            <button data-testid="three-d-pan-left" type="button" onClick={() => onPan("left")} aria-label="Pan view left" title="Pan left" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] active:scale-95"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
            <span className="flex items-center justify-center text-[9px] font-bold text-slate-500">PAN</span>
            <button data-testid="three-d-pan-right" type="button" onClick={() => onPan("right")} aria-label="Pan view right" title="Pan right" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] active:scale-95"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            <span /><button data-testid="three-d-pan-down" type="button" onClick={() => onPan("down")} aria-label="Pan view down" title="Pan down" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] active:scale-95"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button><span />
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-testid={testId} aria-label="3D viewer zoom and pan controls" className={`flex flex-col items-center gap-1 rounded-lg border border-slate-300 bg-white/95 p-1.5 shadow-lg backdrop-blur ${className}`}>
      <div className="flex gap-1"><button data-testid="three-d-zoom-in" type="button" onClick={() => onZoom("in")} aria-label="Zoom in for a closer cabinet view" title="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><Plus className="h-4 w-4" /></button><button data-testid="three-d-zoom-out" type="button" onClick={() => onZoom("out")} aria-label="Zoom out for a wider room view" title="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><Minus className="h-4 w-4" /></button><button data-testid="three-d-reset-view" type="button" onClick={onReset} aria-label="Reset 3D room view" title="Reset view" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#a87f33]/50 bg-[#fffaf1] text-[#765416] transition hover:bg-amber-100 active:scale-95"><RefreshCw className="h-4 w-4" /></button></div>
      <button data-testid="three-d-share-view" type="button" onClick={() => void onShare()} aria-label="Share the current 3D zoom and pan perspective" title="Share current view" className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-[#a87f33]/45 bg-[#fffaf1] px-2 text-[11px] font-semibold text-[#765416] transition hover:bg-amber-100 active:scale-95"><Share2 className="h-3.5 w-3.5" />Share View</button>
      {onPhotoRender && <button data-testid="three-d-photo-render" type="button" onClick={onPhotoRender} aria-label="Create a final photo-quality image from this exact completed 3D view" title="Photo Quality — final review image" className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-[#1a2744]/35 bg-[#1a2744] px-2 text-[11px] font-semibold text-white transition hover:bg-[#24375f] active:scale-95"><Sparkles className="h-3.5 w-3.5" />Photo Quality</button>}
      <div className="grid grid-cols-3 gap-1" aria-label="Pan the 3D room view"><span /><button data-testid="three-d-pan-up" type="button" onClick={() => onPan("up")} aria-label="Pan view up" title="Pan up" className="flex h-8 w-8 items-center justify-center rounded-t-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><ArrowUp className="h-4 w-4" /></button><span /><button data-testid="three-d-pan-left" type="button" onClick={() => onPan("left")} aria-label="Pan view left" title="Pan left" className="flex h-8 w-8 items-center justify-center rounded-l-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><ArrowLeft className="h-4 w-4" /></button><span className="flex h-8 w-8 items-center justify-center text-[9px] font-bold text-slate-500">PAN</span><button data-testid="three-d-pan-right" type="button" onClick={() => onPan("right")} aria-label="Pan view right" title="Pan right" className="flex h-8 w-8 items-center justify-center rounded-r-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><ArrowRight className="h-4 w-4" /></button><span /><button data-testid="three-d-pan-down" type="button" onClick={() => onPan("down")} aria-label="Pan view down" title="Pan down" className="flex h-8 w-8 items-center justify-center rounded-b-md border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95"><ArrowDown className="h-4 w-4" /></button><span /></div>
    </div>
  );
}

export function MobileThreeDViewerNavigation(actions: ThreeDViewerNavigationActions) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="three-d-mobile-navigation" className="absolute bottom-3 right-3 z-30 sm:hidden" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      {open && (
        <div data-testid="three-d-mobile-navigation-popup" role="dialog" aria-label="3D view controls" className="absolute bottom-[calc(0.5in+0.375rem)] right-0 w-[8.75rem] rounded-xl border border-slate-300 bg-white/98 p-2 shadow-xl backdrop-blur">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close 3D view controls" className="mb-1 ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-base font-bold text-[#1a2744] active:scale-95">×</button>
          <ThreeDViewerNavigationControls {...actions} testId="three-d-mobile-navigation-controls" className="border-0 bg-transparent p-0 shadow-none" />
        </div>
      )}
      <button type="button" data-testid="three-d-mobile-navigation-launcher" onClick={() => setOpen((current) => !current)} aria-label="Open 3D view controls" aria-expanded={open} className="flex h-[0.5in] w-[0.5in] items-center justify-center rounded-lg border border-[#a87f33]/60 bg-white/95 text-[#1a2744] shadow-lg backdrop-blur active:scale-95"><Move3D className="h-5 w-5" /></button>
    </div>
  );
}

export function InteractiveRoom3D({ scene, placed = [], crown = false, toeKick = false, roomOverride, openings = [], sinks = [], potFillers = [], island = null, islandFocusRequest = null, furniture = [], selectedFurnitureUid = null, onSelectFurniture, onRemoveFurniture, onRotateFurniture, onOpenFurnitureAttributes, ponyWalls = [], orderSummary, orderLines = [], initialPresentation, catalogFinishOverride, cabinetFinishPreviewOptions = [], cabinetFinishOverrides, cabinetDoorProfiles, cabinetDoorSampleUrls, cabinetFrontVisuals, catalogDoorSampleUrl, catalogRoomSceneUrl, catalogDoorProfile, windowSceneKind = DEFAULT_WINDOW_SCENE_KIND, windowFrameStyle = "white", hardwareStyleId = "none", hardwareAccent, onHardwareStyleChange, catalogFinishName, catalogFinishProductId, catalogIslandCabinetName, catalogIslandCabinetColor, catalogIslandCabinetProductId, catalogIslandDoorSampleUrl, catalogCountertopName, catalogCountertopProductId, catalogCountertopReferenceUrl, catalogIslandCountertopName, catalogIslandCountertopProductId, catalogIslandCountertopReferenceUrl, catalogFlooringName, catalogFlooringProductId, catalogFlooringReferenceUrl, catalogFlooringCategory, catalogFlooringSubCategory, catalogFlooringSize, catalogBacksplashName, catalogBacksplashProductId, catalogBacksplashReferenceUrl, catalogHardwareReferenceUrl, catalogHardwareName, savedDesignId, savedDesignRevision, canAffiliateGeminiImageTest = false, isCurrentPlanSaved = false, savedPlanFingerprintPayload = null, backsplashHeightMode = "standard", countertopBacksplashHeightIn = 0, catalogCountertopColor, catalogIslandCountertopColor, catalogCountertopImageUrl, catalogIslandCountertopImageUrl, catalogFlooringImageUrl, catalogBacksplashImageUrl, shareContext, catalogItems = [], catalogDragItem = null, catalogDropWall, onAddCatalogItem, onAddRangeHood, onSaveToAccount, onSyncCart, onPresentationChange, onRoomWallHeightChange, onRoomWallHeightsChange, onMoveCabinet, onMoveCabinetTo, selectedCabinetUid, attributesTargetUid = null, missingPriceUids, onSelectCabinet, onOpenCabinetEditor, onSelectOpening, onOpenWindowEditor, onOpenDoorEditor, onRequestFiller, onSnapGlassCabinetToFront, onRotateCabinet, onRemoveCabinet, showWallLayer, onToggleWallLayer, temporaryPreviewMessage, onClearTemporaryPreview, temporaryPreviewCounter, temporaryPreviewTransitionKey, fillerInsertionTransition, cabinetConfigHref, embedded = false, cutawayRoomWalls = false, hybridPlanUnderlay = false, className, onGeometryRendered }: Props) {
  const previewRootRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Keep the callback fresh without rebuilding the WebGL scene on every parent render.
  const onGeometryRenderedRef = useRef(onGeometryRendered);
  onGeometryRenderedRef.current = onGeometryRendered;
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const catalogRootRef = useRef<THREE.Group | null>(null);
  const attributesOutlineRef = useRef<THREE.BoxHelper | null>(null);
  const missingPriceOutlinesRef = useRef<THREE.BoxHelper[]>([]);
  const cameraViewRef = useRef<ThreeDCameraViewSnapshot | null>(null);
  const sharedCameraViewRef = useRef<ThreeDCameraShareView | null>(typeof window === "undefined" ? null : parseThreeDCameraShareView(new URLSearchParams(window.location.search).get(THREE_D_CAMERA_VIEW_QUERY_PARAM)));
  const pointerStartRef = useRef<{ x: number; y: number; button: number } | null>(null);
  const rightDragRef = useRef<{
    pointerId: number;
    uid: string;
    source: PlacedCabinet;
    startX: number;
    startY: number;
	    active: boolean;
	    preview: CabinetWallDragPreview | null;
	    targetAlong: number | null;
	    visualOrigins: Array<{ object: THREE.Object3D; x: number; z: number }>;
  } | null>(null);
  const rightDragGhostRef = useRef<THREE.LineSegments | null>(null);
  const suppressContextMenuRef = useRef(false);
  const lastEmittedPresentationRef = useRef<string | null>(null);
	  const [autoRotate, setAutoRotate] = useState(false);
	  const [resetKey, setResetKey] = useState(0);
	  const [cameraReadyKey, setCameraReadyKey] = useState(0);
	  const [cameraPreset, setCameraPreset] = useState<ThreeDCameraPreset>("presentation");
	  const [showRoomContext, setShowRoomContext] = useState(THREE_D_ROOM_CONTEXT_DEFAULT);
	  const [showSolidFrontWalls, setShowSolidFrontWalls] = useState(false);
  const [wallHeightIn, setWallHeightIn] = useState(() => constrainedThreeDWallHeight(roomOverride?.ceilingHeight ?? dimensions(scene.roomShape?.defaultDimensions).ceilingHeight));
  const [wallHeights, setWallHeights] = useState<Record<WallSide, number>>(() => resolvedThreeDWallHeights(roomOverride, wallHeightIn));
	  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const webglAutoRetriesRef = useRef(0);
  useEffect(() => {
    // A failed start used to be permanent until a page refresh. Contexts free up a moment
    // later, so retry automatically (twice) before asking the user to press Retry.
    if (!webglUnavailable || webglAutoRetriesRef.current >= 2) return;
    const timer = window.setTimeout(() => {
      webglAutoRetriesRef.current += 1;
      setWebglUnavailable(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [webglUnavailable]);
	  const [cabinetFinish, setCabinetFinish] = useState(initialPresentation?.cabinetFinish ?? "catalog");
	  const [cabinetPreviewFinishId, setCabinetPreviewFinishId] = useState<string | null>(null);
	  const [countertopFinish, setCountertopFinish] = useState(() => resolvedThreeDCountertopFinish(initialPresentation, catalogCountertopColor, scene));
  const [materialTransitioning, setMaterialTransitioning] = useState(false);
  const [temporaryPreviewFading, setTemporaryPreviewFading] = useState(false);
  const [photoRenderOpen, setPhotoRenderOpen] = useState(false);
  const [photoRenderUrl, setPhotoRenderUrl] = useState<string | null>(null);
  const [photoRenderReferenceUrl, setPhotoRenderReferenceUrl] = useState<string | null>(null);
  const [photoRenderReused, setPhotoRenderReused] = useState(false);
  const [photoRenderError, setPhotoRenderError] = useState<string | null>(null);
  const [pathTracePreview, setPathTracePreview] = useState<{ referenceUrl: string; renderUrl: string } | null>(null);
  const [pathTracePreviewError, setPathTracePreviewError] = useState<string | null>(null);
  const [pathTracePreviewBusy, setPathTracePreviewBusy] = useState(false);
  const [pathTracePreviewProgress, setPathTracePreviewProgress] = useState(0);
  const [geminiImageTest, setGeminiImageTest] = useState<{ referenceUrl: string | null; imageUrl: string } | null>(null);
  const [geminiImageTestError, setGeminiImageTestError] = useState<string | null>(null);
  const [geminiImageTestJobId, setGeminiImageTestJobId] = useState<number | null>(null);
  const [geminiRateLimitUntil, setGeminiRateLimitUntil] = useState<number | null>(null);
  const [geminiCooldownNow, setGeminiCooldownNow] = useState(() => Date.now());
  const [photoQualityLead, setPhotoQualityLead] = useState({ name: "", email: "", phone: "", followUpConsent: false });
  const [photoVerificationStatus, setPhotoVerificationStatus] = useState<"idle" | "pending" | "verified" | "provider_unavailable" | "failed">("idle");
  const [photoVerificationCode, setPhotoVerificationCode] = useState("");
  const [photoRenderDraft, setPhotoRenderDraft] = useState<{
    sceneSignature: string;
    sceneImageDataUrl: string;
    provenance: {
      contractVersion: "exact-plan-v1";
      designId: number;
      designRevision: string | null;
      planFingerprint: string;
      geometryLock: string;
      camera: { position: [number, number, number]; target: [number, number, number]; zoom: number };
      materials: Array<{ role: "cabinet" | "countertop" | "flooring" | "backsplash" | "faucet" | "sink"; productId: number | null; name: string | null; materialImageUrl: string | null }>;
      materialManifest: GeminiMaterialManifestEntry[];
      materialManifestWireVersion: typeof GEMINI_MATERIAL_MANIFEST_WIRE_VERSION;
      missingMaterialInputs: string[];
      sourceImageHash: string;
      generationMethod: "manual-final-review-image-service" | "manual-final-review-gpt-image-2-high-v2" | "manual-final-review-deterministic-webgl-v1" | "manual-final-review-gemini-nano-banana-v1";
    };
  } | null>(null);
  const { user } = useAuth();
  const isPhotoQualityTest = user?.role === "admin";
  const isAffiliateGeminiImageTest = !isPhotoQualityTest && canAffiliateGeminiImageTest && Boolean(savedDesignId) && isCurrentPlanSaved;
  const canUseGeminiImageTest = isPhotoQualityTest || isAffiliateGeminiImageTest;
  const utils = trpc.useUtils();
  const photoRenderMutation = trpc.designPhotoRenders.create.useMutation();
  const manualAiHandoffMutation = trpc.designPhotoRenders.prepareManualAiHandoff.useMutation();
  const startGeminiImageTestMutation = trpc.designPhotoRenders.startGeminiImageTest.useMutation();
  const pollGeminiImageTestMutation = trpc.designPhotoRenders.pollGeminiImageTest.useMutation();
  // Keep the mutation callback—not the mutable hook result—in the polling
  // effect dependencies. The hook result changes when a poll begins/ends;
  // depending on it restarts the effect and can mark an in-flight completion
  // response inactive before it reaches the completed-image dialog.
  const pollGeminiImageTest = pollGeminiImageTestMutation.mutateAsync;
  const savedGeminiImageTestQuery = trpc.designPhotoRenders.getSavedGeminiImageTest.useQuery(
    { designId: savedDesignId ?? 0 },
    { enabled: canUseGeminiImageTest && Boolean(savedDesignId) },
  );
  const geminiImageTestJobQuery = trpc.designPhotoRenders.getGeminiImageTestJob.useQuery(
    { designId: savedDesignId ?? 0 },
    // Administrator snapshots deliberately use designId 0. Query those too so
    // a completed image remains recoverable after a refresh or a remount.
    { enabled: canUseGeminiImageTest },
  );
  const latestCustomerReadyImageQuery = trpc.designPhotoRenders.getLatestCustomerReadyImage.useQuery(
    { designId: savedDesignId ?? 0 },
    { enabled: Boolean(user) && !isPhotoQualityTest && Boolean(savedDesignId), refetchInterval: 30_000 },
  );
  const requestPhotoVerificationMutation = trpc.designPhotoRenders.requestPhoneVerification.useMutation();
  const confirmPhotoVerificationMutation = trpc.designPhotoRenders.confirmPhoneVerification.useMutation();
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const room = roomOverride ?? { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const sceneItems = placed.map((item) => {
      const sku = existingCabinetSku(item, room);
      const transform = existingCabinetTransform(item, room);
      const meshKind = sku.applianceRole === "countertop-opening"
        ? /gas/i.test(sku.description ?? "") ? "cooktop-gas" : /induction/i.test(sku.description ?? "") ? "cooktop-induction" : /electric|smooth/i.test(sku.description ?? "") ? "cooktop-electric" : "cooktop-opening"
        : sku.placementType === "appliance" ? "appliance" : sku.placementType ?? "cabinet";
      return { uid: item.uid, code: item.masterCode, placement: item.placement, x: item.x, y: item.y, z: transform.z, width: Number(sku.width), depth: Number(sku.depth), height: Number(sku.height), mountBottom: sku.mountBottom, islandFace: item.islandFace ?? null, wallId: item.wallId ?? null, rotation: item.rotation ?? 0, mappedMeshKind: meshKind, skuPlacement: sku.placementType, applianceRole: sku.applianceRole ?? null };
    });
    const debugWindow = window as typeof window & { __cdDebug?: unknown; __cdDebugInstances?: Record<string, unknown> };
    const instanceKey = embedded ? "embedded" : "native";
    debugWindow.__cdDebugInstances = { ...(debugWindow.__cdDebugInstances ?? {}), [instanceKey]: {
      sceneItems,
      planItems: placed.map((item) => ({ uid: item.uid, code: item.masterCode, placement: item.placement, x: item.x, y: item.y, width: item.width, depth: item.depth, height: item.height, islandFace: item.islandFace ?? null, wallId: item.wallId ?? null })),
      elevationItems: placed.map((item) => ({ uid: item.uid, code: item.masterCode, placement: item.placement, width: item.width, height: item.height, mountBottom: item.mountBottom ?? null, islandFace: item.islandFace ?? null })),
    }};
    debugWindow.__cdDebug = debugWindow.__cdDebugInstances;
  }, [embedded, placed, roomOverride]);
  useEffect(() => {
    if (!temporaryPreviewTransitionKey || typeof window === "undefined") { setTemporaryPreviewFading(false); return; }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!threeDPreviewFadeAllowed(reducedMotion)) { setTemporaryPreviewFading(false); return; }
    setTemporaryPreviewFading(true);
    const frame = window.requestAnimationFrame(() => setTemporaryPreviewFading(false));
    return () => window.cancelAnimationFrame(frame);
  }, [temporaryPreviewTransitionKey]);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [workspacePanel, setWorkspacePanel] = useState<"catalog" | "view" | "finish" | "room" | "output" | null>(null);
  const [mobileCanvasToolsOpen, setMobileCanvasToolsOpen] = useState(false);
  const tabletTier = useTabletWorkspace();
  // Tablet overlay: the floating 3D row folds into one "Canvas" menu so the
  // page toolbar is the only bar over the room; fitted fillers collapse to a chip.
  const tabletOverlay = embedded && tabletTier.tablet;
  const [fillerChipOpen, setFillerChipOpen] = useState(false);
  useEffect(() => {
    if (!fillerChipOpen) return;
    const timer = window.setTimeout(() => setFillerChipOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, [fillerChipOpen]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogGroup, setCatalogGroup] = useState<ThreeDCatalogGroup>("All");
  const [draggedCatalogId, setDraggedCatalogId] = useState<string | null>(null);
	  const [catalogDragMeasurement, setCatalogDragMeasurement] = useState<{ item: InteractiveRoomCatalogItem; fit: WallGapFitPreview; wall: WallSide; freehand?: boolean } | null>(null);
  const [cabinetDragMeasurement, setCabinetDragMeasurement] = useState<{ cabinet: PlacedCabinet; preview: CabinetWallDragPreview } | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<{ uid: string | null; masterCode: string; description: string | null; distributorSkuId: number | null } | null>(null);
  // Show the selected cabinet's dimensions, placement and actions by default.
  // The owner can still collapse this dock when more 3D canvas is needed.
  const [selectedCabinetInspectorExpanded, setSelectedCabinetInspectorExpanded] = useState(true);
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  useEffect(() => {
    const hostSelection = threeDSelectionFromPlaced(selectedCabinetUid, placed);
    if (!hostSelection) {
      setSelectedCabinet(null);
      setMovePanelOpen(false);
      return;
    }
    setSelectedCabinet((current) => current?.uid === hostSelection.uid ? current : hostSelection);
  }, [placed, selectedCabinetUid]);
  useEffect(() => {
    // A selected closet board already has Move, Attributes, and Edit tower in
    // the host toolbar. On the tablet tier, start with the compact dock so the
    // room stays visible; Details still opens the full measured inspector.
    setSelectedCabinetInspectorExpanded(!(tabletOverlay && Boolean(masterTracProduct(selectedCabinet?.masterCode ?? ""))));
  }, [selectedCabinet?.uid, selectedCabinet?.masterCode, tabletOverlay]);
  const [moveIncrementText, setMoveIncrementText] = useState("1");
  const moveIncrementIn = normalizedThreeDCabinetMoveIncrement(moveIncrementText);
  const [cabinetMoveResult, setCabinetMoveResult] = useState<ThreeDCabinetMoveResult | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [doorTextureState, setDoorTextureState] = useState<"not-requested" | "loading" | "loaded" | "failed">("not-requested");
  const validSuggestions = useMemo(() => scene.suggestions.filter((entry) => entry.sku), [scene.suggestions]);
  const renderExistingDesign = threeDUsesAuthoritativePlanScene(roomOverride, { placed, openings, sinks, potFillers, island, furniture, ponyWalls });
  const upperCabinetWallMinimums = useMemo(
    () => roomOverride ? threeDUpperCabinetWallMinimums(placed, roomOverride) : {},
    [placed, roomOverride],
  );
  const rangeHoodStatus = useMemo(() => rangeHoodSceneStatus(placed), [placed]);
  // The active designer style is the customer’s catalog selection. Prefer its
  // resolved finish color over a sparse style-record color field from the scene
  // endpoint, then fall back to the server-derived catalog material.
	  const catalogFinish = resolvedCatalogFinish(scene, catalogFinishOverride);
	  const selectedCabinetPreviewFinish = cabinetFinishPreviewOptions.find((option) => option.id === cabinetPreviewFinishId) ?? null;
  // Saved-plan fallback scenes deliberately carry neutral material metadata.
  // The active 2D selected style remains authoritative for physical 3D face
  // geometry, so a Slate Echo Shaker never silently turns into a flat slab.
  const resolvedDoorProfile = resolvedThreeDDoorProfile(scene, catalogDoorProfile);
  // The supplied selected Cabinet Config sample is the authoritative finish when
  // a style has no explicit color field. It is applied to actual face panels,
  // while physical rails, stiles, carcasses, and skins remain constructed meshes.
  const activeDoorTexture = resolvedThreeDDoorSampleUrl("catalog", catalogDoorSampleUrl, renderExistingDesign);
  const visibleMaterialMode = threeDVisibleMaterialMode(activeDoorTexture, doorTextureState);
  const photoRenderDoorReference = threeDPhotoRenderDoorReferenceStatus(activeDoorTexture, doorTextureState);
  const geminiCooldownSeconds = geminiRateLimitUntil
    ? Math.max(0, Math.ceil((geminiRateLimitUntil - geminiCooldownNow) / 1_000))
    : 0;
  const geminiCooldownActive = geminiCooldownSeconds > 0;
  const geminiCooldownLabel = geminiCooldownSeconds >= 60
    ? `${Math.floor(geminiCooldownSeconds / 60)}m ${String(geminiCooldownSeconds % 60).padStart(2, "0")}s`
    : `${geminiCooldownSeconds}s`;
  const geminiQueuedRetryAt = geminiImageTestJobQuery.data?.status === "queued" && geminiImageTestJobQuery.data.nextRetryAt
    ? new Date(geminiImageTestJobQuery.data.nextRetryAt).getTime()
    : null;
  const geminiQueuedRetrySeconds = geminiQueuedRetryAt
    ? Math.max(0, Math.ceil((geminiQueuedRetryAt - geminiCooldownNow) / 1_000))
    : 0;
  const geminiQueuedRetryLabel = geminiQueuedRetrySeconds >= 60
    ? `${Math.floor(geminiQueuedRetrySeconds / 60)}m ${String(geminiQueuedRetrySeconds % 60).padStart(2, "0")}s`
    : `${geminiQueuedRetrySeconds}s`;
  const geminiAutomaticRetrySeconds = Math.max(geminiQueuedRetrySeconds, geminiCooldownSeconds);
  const geminiAutomaticRetryLabel = geminiAutomaticRetrySeconds >= 60
    ? `${Math.floor(geminiAutomaticRetrySeconds / 60)}m ${String(geminiAutomaticRetrySeconds % 60).padStart(2, "0")}s`
    : `${geminiAutomaticRetrySeconds}s`;
  // Validate the final compact wire manifest, rather than an editable draft.
  // This ensures browser-side success controls and the request use the same data.
  const geminiWireMaterialManifest = useMemo(() => photoRenderDraft
    ? serializeGeminiMaterialManifestForWire(photoRenderDraft.provenance.materialManifest)
    : [], [photoRenderDraft]);
  const geminiManifestValidationIssues = photoRenderDraft
    ? [
        ...photoRenderDraft.provenance.missingMaterialInputs.map((label) => `Missing exact swatch: ${label}`),
        ...geminiMaterialManifestWireValidationIssues(geminiWireMaterialManifest),
      ]
    : [];
  const geminiManifestValidationReason = geminiManifestValidationIssues.length > 0
    ? `Google image test blocked: ${geminiManifestValidationIssues.join("; ")}`
    : null;
  const geminiImageTestBlockingReason = geminiManifestValidationReason
    ? geminiManifestValidationReason
    : geminiImageTestJobId
      ? geminiAutomaticRetrySeconds > 0
        ? `Google will retry this image test automatically in ${geminiAutomaticRetryLabel}.`
        : "Google is generating this saved-plan test. Status checks continue automatically."
      : startGeminiImageTestMutation.isPending
        ? "Starting the Google image test for this locked saved plan…"
        : !photoRenderDraft
          ? "Open Final preview to prepare the locked saved-plan image for Google."
          : geminiCooldownActive
            ? `Google is rate-limited. Safe retry available in ${geminiCooldownLabel}.`
            : null;
  const geminiInferredMaterials = geminiInferredMaterialLabels(photoRenderDraft?.provenance.materialManifest);
  const photoRenderVisualReferences = photoRenderDraft?.provenance.materialManifest.map((reference) => ({
    id: reference.id,
    label: `${reference.role}: ${reference.label}`,
    url: reference.referenceSource === "locked-designer-jpeg" ? photoRenderReferenceUrl : reference.referenceUrl,
    description: reference.referenceSource === "locked-designer-jpeg"
      ? "No swatch — automatically render from the locked Designer image and saved description. Appearance is inferred, not a verified product match."
      : `Mapped to plan item${reference.itemIds.length === 1 ? "" : "s"} ${reference.itemIds.join(", ")}.`,
    missing: false,
  })) ?? (activeDoorTexture ? [{
    id: "door-sample",
    label: "Cabinet door/finish reference",
    url: activeDoorTexture,
    description: "Exact saved cabinet reference; no substitute or global recolour is permitted.",
    missing: false,
  }] : []);
  const photoRenderMissingReferences = photoRenderDraft?.provenance.missingMaterialInputs.map((label) => ({
    id: `missing:${label}`,
    label: `Missing exact swatch — ${label}`,
    url: null,
    description: "No exact saved reference was found; generation is blocked rather than using a blank or inferred substitute.",
    missing: true,
  })) ?? [];
  const photoRenderReviewReferences = [...photoRenderVisualReferences, ...photoRenderMissingReferences];
	  const resolvedCabinetFinish = selectedCabinetPreviewFinish?.color ?? catalogFinish;
	  const cabinetFinishLabel = selectedCabinetPreviewFinish?.name ?? catalogFinishName ?? scene.materials?.cabinet.publicName ?? scene.materials?.cabinet.name ?? scene.materials?.cabinet.finish ?? "Active catalog finish";
	  const cycleCabinetPreviewFinish = () => {
	    setCabinetPreviewFinishId((current) => nextThreeDCabinetFinishPreviewId(cabinetFinishPreviewOptions, current));
	  };
  const countertopFinishLabel = COUNTERTOP_FINISHES.find((option) => option.color === countertopFinish)?.name ?? "Custom countertop";
  const quoteMaterials = quoteMaterialDetails({
    cabinetPreview: cabinetFinishLabel,
    countertopPreview: countertopFinishLabel,
    catalogFinishName: catalogFinishName ?? scene.materials?.cabinet.publicName ?? scene.materials?.cabinet.name ?? scene.materials?.cabinet.finish,
    catalogCountertopName,
  });
  const visibleCatalogItems = useMemo(
    () => filteredThreeDCatalogItems(catalogItems, catalogGroup, catalogSearch),
    [catalogItems, catalogGroup, catalogSearch],
  );
  const shareMutation = trpc.roomLayouts.createShare.useMutation();
  const shareThumbnailMutation = trpc.roomLayouts.updateShareThumbnail.useMutation();
  const emailQuoteMutation = trpc.roomLayouts.emailQuote.useMutation();

  useEffect(() => {
    const nextGlobal = constrainedThreeDWallHeight(roomOverride?.ceilingHeight ?? dimensions(scene.roomShape?.defaultDimensions).ceilingHeight);
    setWallHeightIn(nextGlobal);
    setWallHeights(resolvedThreeDWallHeights(roomOverride, nextGlobal));
  }, [roomOverride?.ceilingHeight, roomOverride?.wallCeilings, scene.roomShape?.defaultDimensions]);

  const updateWallHeight = (value: unknown) => {
    const nextHeight = constrainedThreeDWallHeight(value, wallHeightIn);
    setWallHeightIn(nextHeight);
    const nextHeights = THREE_D_WALL_SIDES.reduce((heights, side) => ({ ...heights, [side]: nextHeight }), {} as Record<WallSide, number>);
    setWallHeights(nextHeights);
    onRoomWallHeightChange?.(nextHeight);
    onRoomWallHeightsChange?.(nextHeights);
  };

  const updateWallHeightForSide = (side: WallSide, value: unknown) => {
    const nextHeight = constrainedThreeDWallHeight(value, wallHeights[side]);
    setWallHeights((current) => {
      const nextHeights = updatedThreeDWallHeights(current, side, nextHeight);
      onRoomWallHeightsChange?.(nextHeights);
      return nextHeights;
    });
  };

	  useEffect(() => {
	    const nextCabinetFinish = "catalog";
    const nextCountertopFinish = resolvedThreeDCountertopFinish(initialPresentation, catalogCountertopColor, scene);
    setCabinetFinish((current) => current === nextCabinetFinish ? current : nextCabinetFinish);
    setCountertopFinish((current: string) => current === nextCountertopFinish ? current : nextCountertopFinish);
	  }, [scene, catalogCountertopColor, initialPresentation?.cabinetFinish, initialPresentation?.countertopFinish]);

	  useEffect(() => {
	    setCabinetPreviewFinishId((current) => current && cabinetFinishPreviewOptions.some((option) => option.id === current) ? current : null);
	  }, [cabinetFinishPreviewOptions]);

  useEffect(() => {
    setMaterialTransitioning(true);
    const timer = window.setTimeout(() => setMaterialTransitioning(false), 340);
    return () => window.clearTimeout(timer);
	  }, [cabinetFinish, cabinetPreviewFinishId, countertopFinish]);

  useEffect(() => {
    if (!onPresentationChange) return;
    const key = threeDPresentationEmissionKey(cabinetFinish, countertopFinish);
    if (!shouldEmitThreeDPresentation(lastEmittedPresentationRef.current, cabinetFinish, countertopFinish)) return;
    lastEmittedPresentationRef.current = key;
    onPresentationChange({ cabinetFinish, countertopFinish });
  }, [cabinetFinish, countertopFinish, onPresentationChange]);

	  useEffect(() => {
	    const controls = controlsRef.current;
	    if (!controls) return;
	    controls.autoRotate = autoRotate;
	    controls.update();
	  }, [autoRotate]);

	  useEffect(() => {
	    if (!islandFocusRequest || !island) return;
	    const camera = cameraRef.current;
	    const controls = controlsRef.current;
	    if (!camera || !controls) return;
	    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
	    const islandCenter = islandZoneTransform(island);
	    const target = new THREE.Vector3(islandCenter.x, Math.max(2.5, STD.BASE_HEIGHT * INCH * 0.78), islandCenter.z);
	    const maxSpan = Math.max(islandCenter.guideWidth, islandCenter.guideDepth, 2.5);
	    const distance = Math.max(4.5, maxSpan * 1.85);
	    // Plan Y grows toward the physical Front. The Back view therefore looks
	    // toward the island from negative Z; the Front uses positive Z.
	    const direction = islandFocusRequest.face === "back" ? -1 : 1;
	    const destination = new THREE.Vector3(target.x, Math.max(4.4, maxSpan * 1.18), target.z + direction * distance);
	    const startPosition = camera.position.clone();
	    const startTarget = controls.target.clone();
	    const apply = (progress: number) => {
	      const eased = 1 - Math.pow(1 - progress, 3);
	      camera.position.lerpVectors(startPosition, destination, eased);
	      controls.target.lerpVectors(startTarget, target, eased);
	      controls.update();
	    };
	    if (reducedMotion) {
	      apply(1);
	      return;
	    }
	    const durationMs = 420;
	    const startedAt = performance.now();
	    let frame = 0;
	    const animate = (now: number) => {
	      const progress = Math.min(1, (now - startedAt) / durationMs);
	      apply(progress);
	      if (progress < 1) frame = window.requestAnimationFrame(animate);
	    };
	    frame = window.requestAnimationFrame(animate);
	    return () => window.cancelAnimationFrame(frame);
	  }, [cameraReadyKey, island, islandFocusRequest?.key]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === previewRootRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    const element = previewRootRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      toast.error("Full-screen view is not available in this browser.");
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || (!scene.roomShape && !roomOverride)) return;
	    const room = roomOverride
	      ? { ...roomOverride, ceilingHeight: wallHeightIn }
	      : { ...dimensions(scene.roomShape?.defaultDimensions), ceilingHeight: wallHeightIn };
	    const renderedPlaced = renderExistingDesign ? threeDRenderPlacements(placed, room) : placed;

    const roomFrameKey = threeDCameraRoomFrameKey(room);
	    const canvasWidth = Math.max(280, mount.clientWidth);
	    const canvasHeight = Math.max(280, mount.clientHeight || 420);
	    const navigatorCapabilities = typeof navigator === "undefined"
	      ? null
	      : navigator as Navigator & { deviceMemory?: number };
	    const renderQuality = threeDRenderQualityProfile({
	      canvasWidth,
	      canvasHeight,
	      devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
	      coarsePointer: typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
	      hardwareConcurrency: navigatorCapabilities?.hardwareConcurrency ?? null,
	      deviceMemoryGb: navigatorCapabilities?.deviceMemory ?? null,
	    });
	    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
	    } catch {
	      // Some browsers refuse the first request (another tab or an earlier test may still
	      // hold graphics contexts). Retry with plainer settings before giving up.
	      try {
	        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
	      } catch {
	        // Last resort for Chrome with a restricted GPU: default options only.
	        try {
	          renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
	        } catch (error) {
	          console.warn("[3D] WebGL could not start", error);
	          setWebglUnavailable(true);
	          onGeometryRenderedRef.current?.();
	          return;
	        }
	      }
	    }
	    renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderQuality.pixelRatioCap));
	    renderer.setSize(canvasWidth, canvasHeight);
	    renderer.domElement.dataset.renderQuality = renderQuality.tier;
    renderer.shadowMap.enabled = true;
	    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	    renderer.outputColorSpace = THREE.SRGBColorSpace;
	    renderer.toneMapping = THREE.ACESFilmicToneMapping;
	    renderer.toneMappingExposure = 0.84;
	    mount.replaceChildren(renderer.domElement);

	    const threeScene = new THREE.Scene();
	    threeScene.background = new THREE.Color("#f6f3ed");
	    const pmremGenerator = new THREE.PMREMGenerator(renderer);
	    pmremGenerator.compileEquirectangularShader();
	    const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
	    threeScene.environment = environmentTarget.texture;
    const camera = new THREE.PerspectiveCamera(42, canvasWidth / canvasHeight, 0.1, 100);
    const maxSpan = Math.max(room.width, room.depth) * INCH;
    const cameraDistances = threeDCameraDistanceLimits(maxSpan);
    const sharedCameraView = sharedCameraViewRef.current ? constrainedThreeDCameraShareView(sharedCameraViewRef.current, cameraDistances) : null;
    const savedCameraView = cameraViewRef.current;
    const restoreCameraView = Boolean(sharedCameraView) || threeDShouldRestoreCameraView(savedCameraView, cameraPreset, resetKey, roomFrameKey);
    const restoredView = sharedCameraView ?? savedCameraView;
    camera.position.copy(restoreCameraView && restoredView ? restoredView.position : threeDCameraPresetPosition(cameraPreset, maxSpan));
    if (restoreCameraView && restoredView) camera.zoom = restoredView.zoom;
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    if (restoreCameraView && restoredView) controls.target.copy(restoredView.target);
    else controls.target.set(room.width * INCH * 0.5, 3.1, room.depth * INCH * 0.45);
    sharedCameraViewRef.current = null;
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.84;
    controls.panSpeed = 0.72;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minDistance = cameraDistances.minDistance;
    controls.maxDistance = cameraDistances.maxDistance;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.1;
    controls.update();

	    threeScene.add(new THREE.HemisphereLight("#fffaf2", "#718096", 0.92));
	    const keyLight = new THREE.DirectionalLight("#fff5e6", 1.5);
	    keyLight.position.set(maxSpan, maxSpan * 1.8, maxSpan * 0.8);
	    keyLight.castShadow = true;
	    keyLight.shadow.mapSize.set(renderQuality.shadowMapSize, renderQuality.shadowMapSize);
	    keyLight.shadow.camera.near = 0.1;
	    keyLight.shadow.camera.far = maxSpan * 4;
	    keyLight.shadow.camera.left = -maxSpan * 1.15;
	    keyLight.shadow.camera.right = maxSpan * 1.15;
	    keyLight.shadow.camera.top = maxSpan * 1.15;
	    keyLight.shadow.camera.bottom = -maxSpan * 1.15;
	    keyLight.shadow.bias = -0.00018;
	    keyLight.shadow.normalBias = 0.018;
	    threeScene.add(keyLight);
	    const fillLight = new THREE.DirectionalLight("#cfe0f4", 0.38);
	    fillLight.position.set(-maxSpan, maxSpan, maxSpan);
	    threeScene.add(fillLight);
	    const wallHeight = Math.max(...Object.values(wallHeights)) * INCH;
	    const warmLight = new THREE.PointLight("#ffdca6", 2.8, maxSpan * 3.2, 2);
    warmLight.position.set(room.width * INCH * 0.52, wallHeight * 0.76, room.depth * INCH * 0.48);
    threeScene.add(warmLight);

	    const materialDefaults = { ...(scene.materials?.defaults ?? { floor: "#b89778", countertop: "#e9e7e2", backsplash: "#d9d5cc", wall: "#efece6" }), countertop: countertopFinish };
	    const resolvedRoomWallAppearance = roomWallAppearance(roomOverride);
	    const hasRoomWallAppearance = Boolean(roomOverride?.wallAppearance);
	    const textureLoader = new THREE.TextureLoader();
	    const loadSurfaceTexture = (
	      source: ThreeDProductMaterialSource | null,
	      role: "countertop" | "flooring" | "backsplash",
	      widthIn: number,
	      depthIn: number,
	    ) => {
	      if (!source) return null;
	      const texture = source.proceduralFallback
	        ? threeDRepresentativeSurfaceTexture(role, source)
	        : textureLoader.load(source.url, (loadedTexture) => {
	        if (!source.curated && role === "flooring" && source.flooringPatternKind === "plank" && source.plankWidthIn && source.plankLengthIn) {
	          (loadedTexture as THREE.Texture<HTMLImageElement | HTMLCanvasElement>).image = normalizedThreeDPlankImage(
	            loadedTexture.image,
	            source.plankWidthIn,
	            source.plankLengthIn,
	            renderQuality.tier === "mobile" ? 768 : 1024,
	          );
	        } else if (role === "backsplash") {
	          (loadedTexture as THREE.Texture<HTMLImageElement | HTMLCanvasElement>).image = normalizedThreeDBacksplashTileImage(
	            loadedTexture.image,
	            renderQuality.tier === "mobile" ? 384 : 640,
	          );
	        } else if (!source.curated) {
	          (loadedTexture as THREE.Texture<HTMLImageElement | HTMLCanvasElement>).image = normalizedThreeDSurfaceImage(
	            loadedTexture.image,
	            role,
	            renderQuality.tier === "mobile" ? 768 : 1280,
	          );
	        }
	        if (role !== "flooring" && !source.curated) {
	          loadedTexture.repeat.set(1, 1);
	          loadedTexture.offset.set(0, 0);
	        }
	        loadedTexture.needsUpdate = true;
	      });
	      if (!texture) return null;
	      texture.colorSpace = THREE.SRGBColorSpace;
	      texture.anisotropy = Math.min(renderQuality.maxAnisotropy, renderer.capabilities.getMaxAnisotropy());
	      const transform = threeDProductSurfaceTextureTransform(role, source, widthIn, depthIn);
	      texture.wrapS = transform.wrap === "repeat" ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
	      texture.wrapT = transform.wrap === "repeat" ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
	      texture.repeat.set(transform.repeatX, transform.repeatY);
	      texture.offset.set(transform.offsetX, transform.offsetY);
	      texture.center.set(0.5, 0.5);
	      texture.rotation = transform.rotation;
	      texture.userData = {
	        selectedSurfaceRole: role,
	        authoritativeWebsiteProductImage: !source.proceduralFallback,
	        approvedMaterialSwatch: !source.proceduralFallback,
	        representativePreview: source.proceduralFallback,
	        curatedSurfaceKey: source.key,
	        curatedFromManufacturerSource: source.curated,
	        sourceProductName: source.sourceProductName,
	        physicalWidthIn: source.physicalWidthIn,
	        physicalDepthIn: source.physicalDepthIn,
	        flooringPatternKind: source.flooringPatternKind,
	        plankWidthIn: source.plankWidthIn,
	        plankLengthIn: source.plankLengthIn,
	        staggerOffsetsIn: source.staggerOffsetsIn,
	        backsplashPatternKind: source.backsplashPatternKind ?? null,
	        backsplashModuleIn: source.backsplashModuleIn ?? null,
	        backsplashGroutJointIn: source.backsplashGroutJointIn ?? null,
	        materialOnlyNoGeometryChange: true,
	      };
	      return texture;
	    };
	    const floorSource = threeDProductMaterialSource("flooring", catalogFlooringName, catalogFlooringImageUrl, {
	      productId: catalogFlooringProductId,
	      category: catalogFlooringCategory,
	      subCategory: catalogFlooringSubCategory,
	      size: catalogFlooringSize,
	    });
		    const countertopSource = threeDProductMaterialSource("countertop", catalogCountertopName, catalogCountertopImageUrl);
		    const islandCountertopSource = threeDProductMaterialSource(
		      "countertop",
		      catalogIslandCountertopName ?? catalogCountertopName,
		      catalogIslandCountertopImageUrl ?? catalogCountertopImageUrl,
		    );
	    const backsplashSource = threeDProductMaterialSource("backsplash", catalogBacksplashName, catalogBacksplashImageUrl, {
	      productId: catalogBacksplashProductId,
	    });
	    const floorTexture = loadSurfaceTexture(floorSource, "flooring", room.width, room.depth);
		    const countertopTexture = loadSurfaceTexture(countertopSource, "countertop", room.width, room.depth);
		    const islandCountertopTexture = loadSurfaceTexture(islandCountertopSource, "countertop", room.width, room.depth);
	    const backsplashTexture = loadSurfaceTexture(backsplashSource, "backsplash", room.width, 18);
	    const backsplashRoom = roomOverride ?? ({
	      width: room.width,
	      depth: room.depth,
	      ceilingHeight: wallHeightIn,
	    } as RoomData);
	    const backsplashSegments = backsplashTexture && renderExistingDesign
	      ? threeDBacksplashSegments(renderedPlaced, openings, backsplashRoom, backsplashHeightMode, countertopBacksplashHeightIn)
	      : [];
	    const countertopUpstandSegments = renderExistingDesign
	      ? threeDCountertopUpstandSegments(renderedPlaced, openings, backsplashRoom, countertopBacksplashHeightIn)
	      : [];
    // Measured room vertices are absolute inches. Starter-layout templates use
    // normalized points, so keep their conversion separate from the saved-plan
    // path to prevent a custom room's floor and walls from being rescaled.
    const polygon = roomOverride?.vertices?.length
      ? threeDMeasuredRoomPolygon(roomOverride, room.width, room.depth)
      : roomPolygon(activeThreeDRoomGeometry(roomOverride, scene.roomShape), room.width, room.depth);
	    const floorShape = new THREE.Shape(polygon);
	    const floorGeometry = normalizeThreeDPlanarUv(new THREE.ExtrudeGeometry(floorShape, { depth: 0.08, bevelEnabled: false }));
	    const floorMaterial = new THREE.MeshPhysicalMaterial({
	      color: floorTexture ? "#ffffff" : materialDefaults.floor,
	      map: floorTexture,
	      ...threeDPhysicalSurfaceProfile("flooring", Boolean(floorTexture)),
	    });
	    floorMaterial.userData = {
	      selectedSurfaceRole: "flooring",
	      usesAuthoritativeProductImage: Boolean(floorSource && !floorSource.proceduralFallback),
	      representativePreview: Boolean(floorSource?.proceduralFallback),
	      materialOnlyNoGeometryChange: true,
	    };
	    const floor = new THREE.Mesh(
	      floorGeometry,
	      floorMaterial,
	    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    threeScene.add(floor);
    if (hybridPlanUnderlay && roomOverride) {
      const underlayGeometry = new THREE.ShapeGeometry(floorShape);
      underlayGeometry.computeBoundingBox();
      const bounds = underlayGeometry.boundingBox;
      const positions = underlayGeometry.getAttribute("position");
      const uvs = underlayGeometry.getAttribute("uv");
      if (bounds) {
        const spanX = Math.max(bounds.max.x - bounds.min.x, 0.0001);
        const spanY = Math.max(bounds.max.y - bounds.min.y, 0.0001);
        for (let index = 0; index < positions.count; index++) {
          uvs.setXY(index, (positions.getX(index) - bounds.min.x) / spanX, 1 - (positions.getY(index) - bounds.min.y) / spanY);
        }
        uvs.needsUpdate = true;
      }
      const underlay = new THREE.Mesh(
        underlayGeometry,
        new THREE.MeshBasicMaterial({ map: hybridPlanTexture(hybridPlanUnderlayModel(roomOverride, placed, openings)), transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide }),
      );
      underlay.rotation.x = -Math.PI / 2;
      underlay.position.y = 0.008;
      underlay.userData = { hybridPlanUnderlay: true, source: "authoritative-saved-plan" };
      threeScene.add(underlay);
    }

    // Room walls must remain visible as context without ever becoming opaque
    // screens over cabinetry when a mobile orbit moves the camera through them.
	    const wallMaterial = new THREE.MeshStandardMaterial({ color: hasRoomWallAppearance ? resolvedRoomWallAppearance.color : materialDefaults.wall, roughness: hasRoomWallAppearance ? resolvedRoomWallAppearance.roughness : 0.82, side: THREE.DoubleSide, transparent: true, opacity: showRoomContext ? (cutawayRoomWalls && !showSolidFrontWalls ? THREE_D_DESIGNER_WALL_OPACITY : THREE_D_WALL_OPACITY) : 0, depthWrite: THREE_D_WALL_DEPTH_WRITE });
	    const measuredWallSegments = threeDMeasuredWallSegments(roomOverride);
	    const explicitWallSegments = measuredWallSegments.length
	      ? measuredWallSegments.map((segment) => ({
	          id: segment.id,
	          start: segment.start,
	          end: segment.end,
	          customWall: roomOverride?.customWalls?.find((wall) => wall.id === segment.id),
              interiorOnLeft: customWallCabinetSide(roomOverride!, segment.id) === "left",
	          length: segment.length,
	          rotationY: segment.rotationY,
	          heightIn: segment.heightIn,
        }))
	      : polygon.map((start, index) => ({
	          id: `room-wall-${index}`,
	          start,
	          end: polygon[(index + 1) % polygon.length],
          customWall: undefined,
          interiorOnLeft: true,
          length: start.distanceTo(polygon[(index + 1) % polygon.length]),
          rotationY: Math.atan2(polygon[(index + 1) % polygon.length].y - start.y, polygon[(index + 1) % polygon.length].x - start.x),
          heightIn: undefined,
	        }));
	    const miteredRoomWallOutlines = threeDMiteredRoomWallOutlines(explicitWallSegments, !roomOverride?.openWallPath);
	    const roomWallMeshes: Array<{ mesh: THREE.Mesh; start: THREE.Vector2; end: THREE.Vector2 }> = [];
	    explicitWallSegments.forEach(({ start, end, customWall, heightIn }, index) => {
	      const outline = miteredRoomWallOutlines[index];
	      if (!outline) return;
	      const side = threeDWallSideForPolygonEdge(index, explicitWallSegments.length, start, end, room);
	      const customWallHeight = heightIn ?? customWall?.height;
	      const sideWallHeight = (typeof customWallHeight === "number" ? customWallHeight : wallHeights[side]) * INCH;
	      const wall = new THREE.Mesh(threeDMiteredRoomWallGeometry(outline.corners, sideWallHeight), wallMaterial.clone());
	      wall.userData = {
	        roomWall: true,
	        physicalWallSide: side,
	        customWallId: customWall?.id ?? null,
	        wallHeightIn: typeof customWallHeight === "number" ? customWallHeight : wallHeights[side],
	        wallThicknessIn: ROOM_WALL_THICKNESS_IN,
	        miteredStart: outline.miteredStart,
	        miteredEnd: outline.miteredEnd,
	        roomWallColor: hasRoomWallAppearance ? resolvedRoomWallAppearance.color : materialDefaults.wall,
	        roomWallTexture: hasRoomWallAppearance ? resolvedRoomWallAppearance.texture : null,
	      };
	      threeScene.add(wall);
	      roomWallMeshes.push({ mesh: wall, start, end });
	    });
    // Keep the floor visually warm and uncluttered; physical room edges and
    // cabinet shadows provide scale better than a generic editor grid.
    const floorContact = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(room.width, room.depth) * INCH * 0.32, 48),
	      new THREE.MeshBasicMaterial({ color: "#51483f", transparent: true, opacity: 0.035, depthWrite: false }),
    );
    floorContact.rotation.x = -Math.PI / 2;
    // Use the actual wall endpoints; custom open-wall rooms can extend into
    // negative Z and should not have their contact shadow offset elsewhere.
    const fallbackWallBounds = { minX: 0, maxX: room.width * INCH, minZ: 0, maxZ: room.depth * INCH };
    const wallBounds = explicitWallSegments.reduce((bounds, segment) => ({
      minX: Math.min(bounds.minX, segment.start.x, segment.end.x),
      maxX: Math.max(bounds.maxX, segment.start.x, segment.end.x),
      minZ: Math.min(bounds.minZ, -segment.start.y, -segment.end.y),
      maxZ: Math.max(bounds.maxZ, -segment.start.y, -segment.end.y),
    }), explicitWallSegments.length
      ? { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minZ: Number.POSITIVE_INFINITY, maxZ: Number.NEGATIVE_INFINITY }
      : fallbackWallBounds);
    floorContact.position.set((wallBounds.minX + wallBounds.maxX) / 2, 0.006, (wallBounds.minZ + wallBounds.maxZ) / 2);
    floorContact.scale.set(1.35, 0.72, 1);
    floorContact.userData = { presentationContactShadow: true };
    threeScene.add(floorContact);

	    const catalogRoot = new THREE.Group();
		    const cursor = { back: 3, left: 3, right: 3, front: 3 };
		    const finish = resolvedCabinetFinish;
		    const visibleCabinetFinishOverrides = selectedCabinetPreviewFinish ? undefined : cabinetFinishOverrides;
	    const fittedFillerToeKickSuppressions = renderExistingDesign
	      ? threeDFittedFillerToeKickSuppressionUids(renderedPlaced)
	      : new Set<string>();
	    const continuousToeKickSegments = renderExistingDesign && toeKick
	      ? threeDContinuousToeKickSegments(renderedPlaced, room)
	      : [];
	    const continuousToeKickMemberUids = new Set(continuousToeKickSegments.flatMap((segment) => segment.memberUids));
	    const hasAnyDoorSample = Boolean(activeDoorTexture || Object.values(cabinetDoorSampleUrls ?? {}).some(Boolean));
	    setDoorTextureState(hasAnyDoorSample ? "loading" : "not-requested");
	    catalogRoot.userData.sceneInput = threeDSceneInputDiagnostics(renderedPlaced, activeDoorTexture, catalogRoomSceneUrl);
	    catalogRoot.userData.administrationVisualReference = {
      roomSceneUrl: catalogRoomSceneUrl ?? null,
      renderedAsBackdropOrGeometry: false,
	      purpose: "material-and-lighting-reference-only",
	    };
	    catalogRoot.userData.selectedSurfaceMaterialReferences = {
	      countertopImageUrl: catalogCountertopImageUrl ?? null,
	      flooringImageUrl: catalogFlooringImageUrl ?? null,
	      backsplashImageUrl: catalogBacksplashImageUrl ?? null,
	      backsplashRenderedOnMeasuredSurfaces: backsplashSegments.length,
	      backsplashHeightMode,
	      countertopBacksplashHeightIn,
	      countertopUpstandRenderedOnSupportedSurfaces: countertopUpstandSegments.length,
	      materialOnlyNoGeometryChange: true,
	    };
	    catalogRoot.userData.renderQuality = { ...renderQuality, geometryOrCameraChanges: false };
    let disposed = false;
    const updateDoorTextureState = (state: "loading" | "loaded" | "failed") => {
      if (!disposed) setDoorTextureState(state);
	    };
	    if (renderExistingDesign) {
	      const sharedStandardCountertopSurfaces = threeDStandardCountertopSurfaces(room, renderedPlaced, island, ponyWalls);
	      for (const cabinet of renderedPlaced) {
	        if (!shouldRenderSavedSceneCabinet(cabinet, renderedPlaced)) continue;
	        const baseSku = existingCabinetSku(cabinet, room);
	        const transitionFootprint = angledWallTransitionFootprint(cabinet, room, renderedPlaced);
        const sku = {
          ...baseSku,
          catalogImageUrl: resolvedPlacedCabinetFrontVisual(cabinet, cabinetFrontVisuals, baseSku.catalogImageUrl),
	          fillerTransitionFootprint: transitionFootprint,
        };
	        const cabinetFinish = resolvedPlacedCabinetFinish(cabinet, visibleCabinetFinishOverrides, finish);
        const cabinetDoorProfile = resolvedPlacedCabinetDoorProfile(cabinet, cabinetDoorProfiles, resolvedDoorProfile);
        const cabinetDoorTexture = resolvedPlacedCabinetDoorSampleUrl(cabinet, cabinetDoorSampleUrls, catalogDoorSampleUrl, renderExistingDesign);
	        const transform = /^HOOD[-_]?/i.test(cabinet.masterCode ?? "")
	          ? savedRangeHoodTransform(cabinet, renderedPlaced, room)
          : existingCabinetTransform(cabinet, room);
	        const hasExactFarmhouseFixture = sinks.some((sink) => (
	          sink.cabinetUid === cabinet.uid
	          && sink.type === "farmhouse"
	          && Boolean(sink.pelicanProfileId)
	        ));
		        // Every saved counter-bearing base is rendered once from
		        // `countertopSurfaces` below. That shared source preserves complete
		        // LSB/ERB tops, one uninterrupted slab per touching run, and real
		        // gaps at appliances without stacking a rectangular top per box.
		        // A base whose footprint no shared slab covers (free-standing box
		        // snapped to a wall by the run builder) keeps its own top.
		        const sharedCountertopSurface = bearsCountertop(cabinet)
		          && sharedStandardCountertopSurfaces.some((surface) => countertopSurfaceCoversCabinet(surface, cabinet));
		        addCabinet(catalogRoot, sku, null, cursor, room.width, room.depth, cabinetFinish, materialDefaults.countertop, cabinetDoorProfile ?? undefined, transform, cabinetDoorTexture, updateDoorTextureState, {
		          countertop: countertopTexture,
		          suppressCountertop: sharedCountertopSurface,
		          selectedToeKick: toeKick,
		          suppressContinuousBaseToeKick: continuousToeKickMemberUids.has(cabinet.uid),
		          suppressFittedFillerToeKick: fittedFillerToeKickSuppressions.has(cabinet.uid),
		          suppressFarmhouseSinkPlaceholder: hasExactFarmhouseFixture,
		          hardwareStyleId,
		          hardwareAccent,
	        });
	        if (cabinet.masterTracConceptStorage || cabinet.masterTracStorageItems) {
	          const fixedTopIn = renderedPlaced.find((board) => board.masterTracTowerId === cabinet.masterTracTowerId
	            && board.masterTracTowerBayIndex === cabinet.masterTracTowerBayIndex && board.masterTracTowerRole === "fixed-top")?.mountBottom;
		          addMasterTracConceptStorage(catalogRoot, cabinet, room, fixedTopIn ?? undefined);
		        }
		      }
	      if (toeKick && continuousToeKickSegments.length > 0) {
	        addThreeDContinuousToeKicks(catalogRoot, continuousToeKickSegments, room, visibleCabinetFinishOverrides, finish);
	      }
	      addThreeDStandardCountertops(catalogRoot, room, renderedPlaced, materialDefaults.countertop, countertopTexture, island, ponyWalls);
	      if (roomOverride) {
	        addThreeDMeasuredWallMiterCountertops(catalogRoot, roomOverride, renderedPlaced, materialDefaults.countertop, countertopTexture);
	        addThreeDPeninsulaCountertops(catalogRoot, roomOverride, renderedPlaced, materialDefaults.countertop, countertopTexture);
	      }
	      addThreeDGlassStackerRearSupports(catalogRoot, renderedPlaced, room, visibleCabinetFinishOverrides, finish);
	      if (crown) addThreeDCrownMolding(catalogRoot, renderedPlaced, room, visibleCabinetFinishOverrides, finish);
	    } else {
      for (const suggestion of validSuggestions) {
        if (!suggestion.sku) continue;
	        addCabinet(catalogRoot, suggestion.sku, suggestion.zone.wallKey, cursor, room.width, room.depth, finish, materialDefaults.countertop, resolvedDoorProfile ?? undefined, undefined, activeDoorTexture, updateDoorTextureState, { countertop: countertopTexture, selectedToeKick: toeKick, hardwareStyleId, hardwareAccent });
	      }
	    }
	    if (countertopUpstandSegments.length > 0) {
	      addThreeDCountertopUpstands(catalogRoot, countertopUpstandSegments, backsplashRoom, countertopTexture, materialDefaults.countertop);
	    }
	    if (backsplashTexture && backsplashSegments.length > 0) {
	      addThreeDBacksplash(catalogRoot, backsplashSegments, backsplashRoom, backsplashTexture);
	    }
	    for (const opening of openings) {
	      // The clear-view control must reveal the narrow reach-in behind its four
	      // architectural leaves. Keep every ordinary kitchen/window opening intact.
	      if (!showRoomContext && opening.kind === "door" && opening.doorStyle === "bifold") continue;
      addWallOpening(catalogRoot, opening, room, undefined, windowSceneKind, windowFrameStyle);
	    }
    for (const sink of sinks) addSinkFixture(catalogRoot, sink);
    for (const potFiller of potFillers) {
      const mountedRange = potFillerMountedRange(potFiller, placed, room, island);
      if (mountedRange) addPotFillerFixture(catalogRoot, potFiller, mountedRange, room);
    }
		    if (island) addIslandZone(
		      catalogRoot,
		      island,
		      placed,
		      catalogIslandCountertopColor ?? materialDefaults.countertop,
		      islandCountertopTexture,
		    );
	    for (const ponyWall of ponyWalls) addPonyWall(catalogRoot, ponyWall, room, ponyWalls);
    for (const furnitureItem of furniture) addFurniture(catalogRoot, furnitureItem, furnitureItem.uid === selectedFurnitureUid);
	    catalogRoot.traverse((node) => {
	      if (!(node instanceof THREE.Mesh)) return;
	      const material = Array.isArray(node.material) ? node.material[0] : node.material;
	      const transparent = Boolean(material?.transparent && material.opacity < 0.8);
	      node.castShadow = !transparent;
	      node.receiveShadow = !transparent;
	      node.userData = { ...node.userData, photorealShadowParticipant: !transparent };
	    });
	    threeScene.add(catalogRoot);
    catalogRootRef.current = catalogRoot;
	    rendererRef.current = renderer;
	    sceneRef.current = threeScene;
	    cameraRef.current = camera;
	    setCameraReadyKey((current) => current + 1);

	    let frame = 0;
	    let readyFrame = 0;
	    let firstFramePainted = false;
	    const render = () => {
	      frame = requestAnimationFrame(render);
	      controls.update();
	      if (cutawayRoomWalls && showRoomContext && !showSolidFrontWalls) {
	        for (const { mesh, start, end } of roomWallMeshes) {
	          (mesh.material as THREE.MeshStandardMaterial).opacity = threeDWallObscuresOrbitTarget(start, end, camera.position, controls.target)
	            ? THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY : THREE_D_DESIGNER_WALL_OPACITY;
	        }
	      }
	      renderer.render(threeScene, camera);
	      if (!firstFramePainted) {
	        firstFramePainted = true;
	        readyFrame = requestAnimationFrame(() => onGeometryRenderedRef.current?.());
	      }
	    };
    render();
    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(280, mount.clientWidth);
      const height = Math.max(280, mount.clientHeight || 420);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);
	    return () => {
	      disposed = true;
	      cancelAnimationFrame(frame);
	      cancelAnimationFrame(readyFrame);
	      resizeObserver.disconnect();
      cameraViewRef.current = {
        preset: cameraPreset,
        resetKey,
        roomFrameKey,
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom: camera.zoom,
      };
	      controls.dispose();
	      disposeObject(threeScene);
	      environmentTarget.dispose();
	      pmremGenerator.dispose();
	      renderer.dispose();
      // dispose() alone leaves the browser's WebGL context alive; Chrome caps live contexts, so after
      // many edits it refuses new ones ("device cannot start the 3D view"). Release it explicitly.
      try { renderer.forceContextLoss(); } catch { /* already lost */ }
      renderer.domElement.remove();
      if (rendererRef.current === renderer) rendererRef.current = null;
      if (sceneRef.current === threeScene) sceneRef.current = null;
      if (cameraRef.current === camera) cameraRef.current = null;
      if (controlsRef.current === controls) controlsRef.current = null;
      if (catalogRootRef.current === catalogRoot) catalogRootRef.current = null;
    };
  }, [scene, validSuggestions, placed, crown, toeKick, roomOverride, openings, sinks, potFillers, island, furniture, selectedFurnitureUid, ponyWalls, renderExistingDesign, resetKey, cameraPreset, showRoomContext, showSolidFrontWalls, cutawayRoomWalls, hybridPlanUnderlay, wallHeightIn, wallHeights, resolvedCabinetFinish, cabinetPreviewFinishId, cabinetFinishOverrides, cabinetDoorProfiles, cabinetDoorSampleUrls, cabinetFrontVisuals, countertopFinish, cabinetFinish, catalogDoorSampleUrl, catalogRoomSceneUrl, hardwareStyleId, hardwareAccent, catalogCountertopName, catalogCountertopProductId, catalogIslandCountertopName, catalogIslandCountertopProductId, catalogIslandCountertopColor, catalogFlooringName, catalogFlooringProductId, catalogFlooringCategory, catalogFlooringSubCategory, catalogFlooringSize, catalogBacksplashName, catalogBacksplashProductId, backsplashHeightMode, countertopBacksplashHeightIn, catalogCountertopImageUrl, catalogIslandCountertopImageUrl, catalogFlooringImageUrl, catalogBacksplashImageUrl]);

	  // A catalog filler has already passed geometry/collision validation before this
	  // cue runs. Animate only its visual group, so the final coordinates and the
	  // saved plan remain authoritative while the user sees it settle into the seam.
	  useEffect(() => {
	    if (!fillerInsertionTransition || typeof window === "undefined") return undefined;
	    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
	    const root = catalogRootRef.current;
	    if (!root) return undefined;
	    const requested = new Set(fillerInsertionTransition.uids);
	    const targets = root.children.filter((node) => requested.has(String(node.userData.placedUid)));
	    if (targets.length === 0) return undefined;

	    const origins = targets.map((target) => ({
	      target,
	      position: target.position.clone(),
	      scale: target.scale.clone(),
	    }));
	    for (const { target, position, scale } of origins) {
	      target.position.set(position.x, position.y - 0.045, position.z);
	      target.scale.set(scale.x * 0.9, scale.y * 0.9, scale.z * 0.9);
	    }
    const durationMs = 280;
    let frame = 0;
    let startedAt = 0;
    const animate = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      for (const { target, position, scale } of origins) {
        target.position.set(position.x, position.y - 0.045 * (1 - eased), position.z);
        target.scale.set(scale.x * (0.9 + 0.1 * eased), scale.y * (0.9 + 0.1 * eased), scale.z * (0.9 + 0.1 * eased));
      }
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      for (const { target, position, scale } of origins) {
        target.position.copy(position);
        target.scale.copy(scale);
      }
    };
	  }, [fillerInsertionTransition?.key]);

	  useEffect(() => {
    const root = catalogRootRef.current;
    const removeOutline = () => {
      const current = attributesOutlineRef.current;
      if (!current) return;
      current.parent?.remove(current);
      current.geometry.dispose();
      const materials = Array.isArray(current.material) ? current.material : [current.material];
      materials.forEach((material) => material.dispose());
      attributesOutlineRef.current = null;
    };
    removeOutline();
    if (!root || !attributesTargetUid) return undefined;
    const target = root.children.find((node) => node.userData.placedUid === attributesTargetUid);
    if (!target) return undefined;
    const outline = new THREE.BoxHelper(target, new THREE.Color("#d4a75a"));
    outline.name = "cabinet-attributes-target-outline";
    outline.userData = { cabinetAttributesTarget: true, placedUid: attributesTargetUid };
    outline.renderOrder = 1000;
    const materials = Array.isArray(outline.material) ? outline.material : [outline.material];
    materials.forEach((material) => {
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.98;
    });
    outline.update();
    root.add(outline);
    attributesOutlineRef.current = outline;
    return removeOutline;
  }, [attributesTargetUid, cameraReadyKey]);

  // Part 1: red outline on every placed cabinet with no price on the active
  // line. Shared by the Designer and the Continuous Wall Builder because both
  // render through this component.
  const missingPriceKey = missingPriceUids ? Array.from(missingPriceUids).sort().join("|") : "";
  useEffect(() => {
    const root = catalogRootRef.current;
    const removeOutlines = () => {
      for (const current of missingPriceOutlinesRef.current) {
        current.parent?.remove(current);
        current.geometry.dispose();
        const materials = Array.isArray(current.material) ? current.material : [current.material];
        materials.forEach((material) => material.dispose());
      }
      missingPriceOutlinesRef.current = [];
    };
    removeOutlines();
    if (!root || !missingPriceKey) return undefined;
    for (const uid of missingPriceKey.split("|")) {
      const target = root.children.find((node) => node.userData.placedUid === uid);
      if (!target) continue;
      const outline = new THREE.BoxHelper(target, new THREE.Color("#dc2626"));
      outline.name = "cabinet-price-missing-outline";
      outline.userData = { priceMissing: true, placedUid: uid };
      outline.renderOrder = 999;
      const materials = Array.isArray(outline.material) ? outline.material : [outline.material];
      materials.forEach((material) => {
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 0.98;
      });
      outline.update();
      root.add(outline);
      missingPriceOutlinesRef.current.push(outline);
    }
    return removeOutlines;
  }, [missingPriceKey, cameraReadyKey, placed]);
  const downloadImage = () => {
    const renderer = rendererRef.current;
    const threeScene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !threeScene || !camera) return;
    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    const { width: exportWidth, height: exportHeight } = THREE_D_EXPORT_SIZE;
    renderer.setPixelRatio(1);
    renderer.setSize(exportWidth, exportHeight, false);
    camera.aspect = exportWidth / exportHeight;
    camera.updateProjectionMatrix();
    renderer.render(threeScene, camera);
    const download = document.createElement("a");
    download.href = renderer.domElement.toDataURL("image/png");
    download.download = `cabinet-dealz-3d-room-${Date.now()}.png`;
    download.click();
    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(currentSize.x, currentSize.y, false);
    camera.aspect = currentSize.x / currentSize.y;
    camera.updateProjectionMatrix();
  };

  const captureShareThumbnail = (): string | null => {
    const renderer = rendererRef.current;
    const threeScene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !threeScene || !camera) return null;
    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    const exportWidth = 640;
    const exportHeight = 360;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(exportWidth, exportHeight, false);
      camera.aspect = exportWidth / exportHeight;
      camera.updateProjectionMatrix();
      renderer.render(threeScene, camera);
      return renderer.domElement.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
    } finally {
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      camera.aspect = currentSize.x / currentSize.y;
      camera.updateProjectionMatrix();
    }
  };

  const capturePhotoRenderReference = (): string | null => {
    const renderer = rendererRef.current;
    const threeScene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !threeScene || !camera) return null;
    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    const maximumAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const materialMaps: THREE.Texture[] = [];
    try {
      renderer.setPixelRatio(1);
      // This is an exact-scene offline capture, not an AI reference screenshot.
      // The larger locked canvas and supersampled material filtering are deliberately
      // separate from interactive mobile quality tiers while the scene and camera stay
      // untouched.
      renderer.setSize(2560, 1440, false);
      threeScene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.Material)) return;
          const candidate = material as THREE.MeshStandardMaterial;
          [candidate.map, candidate.normalMap, candidate.roughnessMap, candidate.metalnessMap].forEach((map) => {
            if (!map) return;
            map.anisotropy = maximumAnisotropy;
            map.needsUpdate = true;
            materialMaps.push(map);
          });
        });
      });
      camera.aspect = 2560 / 1440;
      camera.updateProjectionMatrix();
      // The Gemini layout source is a clear cabinet crop. The user-facing 3D
      // viewer stays unchanged; only these two offline capture frames exclude
      // the editor's room-wall planes so no transparent/ghost wall can mask a
      // glass stacker or be mistaken for an architectural wall in the result.
      return captureWithRoomWallsHidden(threeScene, () => {
        // Render twice to settle PBR textures, shadows, and the PMREM environment.
        renderer.render(threeScene, camera);
        renderer.render(threeScene, camera);
        return renderer.domElement.toDataURL("image/jpeg", 0.98);
      });
    } catch {
      return null;
    } finally {
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      camera.aspect = currentSize.x / currentSize.y;
      camera.updateProjectionMatrix();
      materialMaps.forEach((map) => { map.needsUpdate = true; });
    }
  };

  const GOOGLE_IMAGE_TEST_MAX_DATA_URL_CHARS = 650_000;

  /**
   * The exact 2560×1440 preview remains the on-screen reference. The Google
   * request gets the same camera and rendered scene resampled to its supported
   * 1K 16:9 input. Its transport encoding is progressively compressed until it
   * stays below the live browser gateway's safe request budget.
   */
  const compactGoogleImageTestInput = (dataUrl: string): Promise<string> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("The Google test image could not be prepared.")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.68, 0.58, 0.48, 0.38, 0.3]) {
        const compact = canvas.toDataURL("image/jpeg", quality);
        if (compact.length <= GOOGLE_IMAGE_TEST_MAX_DATA_URL_CHARS) {
          resolve(compact);
          return;
        }
      }
      reject(new Error("The locked Google test image is too large to send safely. Please try again after simplifying the active 3D view."));
    };
    image.onerror = () => reject(new Error("The locked Google test image could not be prepared."));
    image.src = dataUrl;
  });

  const createPathTracePreview = async () => {
    if (!isPhotoQualityTest || !IN_HOUSE_PATH_TRACE_ENABLED) return;
    if (!photoRenderDoorReference.ready) {
      toast.error(photoRenderDoorReference.message);
      return;
    }
    const sourceScene = sceneRef.current;
    const sourceCamera = cameraRef.current;
    const referenceUrl = captureShareThumbnail();
    const pathTraceRoom = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    if (!sourceScene || !sourceCamera || !referenceUrl) {
      toast.error("The current 3D view is still loading. Try the production-render test again in a moment.");
      return;
    }
    let renderer: THREE.WebGLRenderer | null = null;
    let pathTracer: WebGLPathTracer | null = null;
    let productionEnvironment: THREE.Texture | null = null;
    let denoiseMaterial: DenoiseMaterial | null = null;
    let denoiseQuad: FullScreenQuad | null = null;
    const convertedMaterials: THREE.Material[] = [];
    let contextLost = false;
    let copyMaterial: THREE.MeshBasicMaterial | null = null;
    const canvasIsBlack = (source: HTMLCanvasElement) => {
      const probe = document.createElement("canvas");
      probe.width = 64;
      probe.height = 36;
      const ctx = probe.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(source, 0, 0, probe.width, probe.height);
      const data = ctx.getImageData(0, 0, probe.width, probe.height).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
      return total / (data.length / 4 * 3) < 4;
    };
    setPathTracePreviewBusy(true);
    setPathTracePreviewProgress(0);
    setPathTracePreviewError(null);
    try {
      const canvas = document.createElement("canvas");
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      if (!renderer.capabilities.isWebGL2) throw new Error("This browser does not support the WebGL2 renderer required for the production-render test.");
      // Path tracing needs float render targets. Not every computer has them, so
      // when they are missing (or the result is black) the same scene is rendered
      // with the standard renderer the Designer itself uses.
      const canPathTrace = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
      renderer.getContext().canvas.addEventListener("webglcontextlost", () => { contextLost = true; });
      renderer.setPixelRatio(1);
      renderer.setSize(THREE_D_PATH_TRACE_PREVIEW.width, THREE_D_PATH_TRACE_PREVIEW.height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.84;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const pathTraceScene = sourceScene.clone(true);
      pathTraceScene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const compatibleMaterials = sourceMaterials.map(pathTraceCompatibleMaterial);
        compatibleMaterials.forEach((material) => convertedMaterials.push(material));
        node.material = Array.isArray(node.material) ? compatibleMaterials : compatibleMaterials[0];
      });
      const pathTraceCamera = sourceCamera.clone();
      pathTraceCamera.aspect = THREE_D_PATH_TRACE_PREVIEW.width / THREE_D_PATH_TRACE_PREVIEW.height;
      pathTraceCamera.updateProjectionMatrix();
      productionEnvironment = await new RGBELoader().loadAsync(THREE_D_PRODUCTION_HDRI_URL);
      productionEnvironment.mapping = THREE.EquirectangularReflectionMapping;
      pathTraceScene.environment = productionEnvironment;
      pathTraceScene.background = new THREE.Color("#f7f4ee");
      addThreeDProductionLightRig(
        pathTraceScene,
        pathTraceRoom.width * INCH,
        pathTraceRoom.depth * INCH,
        Math.max(...Object.values(wallHeights)) * INCH,
      );

      let usedStandardRender = false;
      try {
        if (!canPathTrace) throw new Error("float render targets unavailable");
        pathTracer = new WebGLPathTracer(renderer);
        pathTracer.bounces = THREE_D_PATH_TRACE_PREVIEW.bounces;
        pathTracer.multipleImportanceSampling = true;
        pathTracer.filterGlossyFactor = 0.24;
        pathTracer.minSamples = 1;
        pathTracer.renderDelay = 0;
        pathTracer.fadeDuration = 0;
        pathTracer.dynamicLowRes = false;
        pathTracer.rasterizeScene = false;
        pathTracer.renderToCanvas = false;
        pathTracer.tiles.set(2, 2);
        pathTracer.setScene(pathTraceScene, pathTraceCamera);
        for (let sample = 0; sample < THREE_D_PATH_TRACE_PREVIEW.samples; sample += 1) {
          pathTracer.renderSample();
          if ((sample + 1) % 8 === 0 || sample + 1 === THREE_D_PATH_TRACE_PREVIEW.samples) {
            setPathTracePreviewProgress(Math.round(((sample + 1) / THREE_D_PATH_TRACE_PREVIEW.samples) * 100));
          }
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        }
        denoiseMaterial = new DenoiseMaterial({
          map: pathTracer.target.texture,
          sigma: THREE_D_PATH_TRACE_PREVIEW.denoise.sigma,
          kSigma: THREE_D_PATH_TRACE_PREVIEW.denoise.kSigma,
          threshold: THREE_D_PATH_TRACE_PREVIEW.denoise.threshold,
        });
        denoiseQuad = new FullScreenQuad(denoiseMaterial);
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        renderer.clear();
        denoiseQuad.render(renderer);
        if (contextLost) throw new Error("graphics context was lost");
        if (canvasIsBlack(canvas)) {
          // Denoise pass produced nothing: show the raw path-traced samples instead.
          denoiseQuad.dispose();
          copyMaterial = new THREE.MeshBasicMaterial({ map: pathTracer.target.texture, toneMapped: false });
          denoiseQuad = new FullScreenQuad(copyMaterial);
          renderer.clear();
          denoiseQuad.render(renderer);
          if (canvasIsBlack(canvas)) {
            throw new Error("path-traced image was black");
          }
        }

      } catch (pathTraceFailure) {
        console.warn("[production-render-test] path tracing unavailable, using standard render", pathTraceFailure);
        if (contextLost) throw new Error("The browser reset its graphics session during the test. Close other 3D tabs and try again.");
        pathTracer?.dispose();
        pathTracer = null;
        denoiseQuad?.dispose();
        denoiseQuad = null;
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.clear();
        renderer.render(pathTraceScene, pathTraceCamera);
        usedStandardRender = true;
        if (canvasIsBlack(canvas)) throw new Error("The production-render test could not draw the scene on this browser. Nothing was saved.");
      }
      const renderUrl = canvas.toDataURL("image/jpeg", 0.98);
      if (usedStandardRender) toast.message("Rendered with the standard 3D renderer at 1920×1080 (path tracing is not available on this browser).");
      setPathTracePreview({ referenceUrl, renderUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The production-render test could not create a path-traced image.";
      setPathTracePreviewError(message);
      toast.error(message);
    } finally {
      pathTracer?.dispose();
      productionEnvironment?.dispose();
      denoiseQuad?.dispose();
      denoiseMaterial?.dispose();
      copyMaterial?.dispose();
      convertedMaterials.forEach((material) => material.dispose());
      renderer?.dispose();
      // dispose() alone leaves the browser graphics context open; release it so the
      // interactive 3D view can always create its own.
      renderer?.forceContextLoss();
      setPathTracePreviewBusy(false);
      setPathTracePreviewProgress(0);
    }
  };

  const zoomViewer = (direction: "in" | "out") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const roomDimensions = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    const maxSpan = Math.max(roomDimensions.width, roomDimensions.depth) * INCH;
    const currentDistance = camera.position.distanceTo(controls.target);
    const nextDistance = threeDViewerZoomDistance(currentDistance, threeDCameraDistanceLimits(maxSpan), direction);
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 0.000001) return;
    camera.position.copy(controls.target.clone().add(offset.normalize().multiplyScalar(nextDistance)));
    controls.update();
    setAutoRotate(false);
  };

  const panViewer = (direction: "up" | "down" | "left" | "right") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const step = threeDViewerPanStep(camera.position.distanceTo(controls.target));
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.000001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    if (right.lengthSq() < 0.000001) right.set(1, 0, 0);
    right.normalize();
    const delta = direction === "up" ? forward.multiplyScalar(step)
      : direction === "down" ? forward.multiplyScalar(-step)
        : direction === "left" ? right.multiplyScalar(-step)
          : right.multiplyScalar(step);
    camera.position.add(delta);
    controls.target.add(delta);
    controls.update();
    setAutoRotate(false);
  };

  const resetViewerNavigation = () => {
    setAutoRotate(false);
    setCameraPreset("presentation");
    setResetKey((current) => current + 1);
  };

  const preserveCurrentCameraView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const currentRoom = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    cameraViewRef.current = {
      preset: cameraPreset,
      resetKey,
      roomFrameKey: threeDCameraRoomFrameKey(currentRoom),
      position: camera.position.clone(),
      target: controls.target.clone(),
      zoom: camera.zoom,
    };
  };

  const inspectCabinetAtPoint = (clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const root = catalogRootRef.current;
    if (!renderer || !camera || !root) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "grab";
    const hitSelection = threeDCabinetHitFromIntersections(hits);
    if (!hitSelection) return null;
    const placedCabinet = hitSelection.uid ? placed.find((cabinet) => cabinet.uid === hitSelection.uid) ?? null : null;
    const selection = {
      ...hitSelection,
      description: placedCabinet?.description ?? hitSelection.description,
    };
    setSelectedCabinet(selection);
    if (selection.uid) onSelectCabinet?.(selection.uid);
    return selection;
  };

  const inspectOpeningAtPoint = (clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const root = catalogRootRef.current;
    if (!renderer || !camera || !root) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    return threeDOpeningHitFromIntersections(raycaster.intersectObjects(root.children, true));
  };

  const openDoorAtPoint = (clientX: number, clientY: number): boolean => {
    const hit = inspectOpeningAtPoint(clientX, clientY);
    if (hit?.kind !== "door" || !onOpenDoorEditor) return false;
    setSelectedCabinet(null);
    setMovePanelOpen(false);
    onSelectOpening?.(hit.uid);
    onOpenDoorEditor(hit.uid);
    return true;
  };

  const inspectFurnitureAtPoint = (clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const root = catalogRootRef.current;
    if (!renderer || !camera || !root) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = threeDFurnitureHitFromIntersections(raycaster.intersectObjects(root.children, true));
    if (!hit) return null;
    renderer.domElement.style.cursor = "pointer";
    setSelectedCabinet(null);
    onSelectFurniture?.(hit.uid);
    return hit;
  };

  const catalogDropTargetAtPoint = (clientX: number, clientY: number): ThreeDCatalogDropTarget | undefined => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const root = catalogRootRef.current;
    const room = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    if (!renderer || !camera || !room) return undefined;
    const bounds = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const intersections = root ? raycaster.intersectObjects(root.children, true) : [];
    const physicalWallHit = intersections.find((intersection) => threeDRoomWallSideFromObject(intersection.object) != null);
    const targetedWall = physicalWallHit ? threeDRoomWallSideFromObject(physicalWallHit.object) ?? catalogDropWall : catalogDropWall;
    const plane = threeDCatalogDropPlane(targetedWall, room);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return undefined;
    return threeDCatalogDropTargetFromIntersections(intersections, hit, room, targetedWall);
  };

  const requestCabinetMove = (direction: ThreeDCabinetMoveDirection) => {
    if (!selectedCabinet?.uid || !onMoveCabinet) return;
    preserveCurrentCameraView();
    setAutoRotate(false);
    let planDelta: ThreeDPlanMoveDelta | undefined;
    const selectedPlacedCabinet = placed.find((cabinet) => cabinet.uid === selectedCabinet.uid);
    if ((direction === "left" || direction === "right") && cameraRef.current && selectedPlacedCabinet) {
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRef.current.quaternion);
      const movementRoom = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
      planDelta = threeDScreenHorizontalPlanDelta(cabinetWall(selectedPlacedCabinet, movementRoom), direction, moveIncrementIn, cameraRight);
    }
    setCabinetMoveResult(onMoveCabinet(selectedCabinet.uid, direction, moveIncrementIn, planDelta));
  };

	const stopCabinetMoveControlEvent = (event: { stopPropagation: () => void }) => {
	  event.stopPropagation();
	};

	const claimCabinetMoveControlEvent = (event: { preventDefault: () => void; stopPropagation: () => void; nativeEvent?: { stopImmediatePropagation?: () => void } }) => {
	  event.preventDefault();
	  event.stopPropagation();
	  event.nativeEvent?.stopImmediatePropagation?.();
	};

  const clearRightDragGhost = () => {
    const ghost = rightDragGhostRef.current;
    if (!ghost) return;
    ghost.removeFromParent();
    ghost.geometry.dispose();
    const material = ghost.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
    rightDragGhostRef.current = null;
  };

  const updateRightDragGhost = (source: PlacedCabinet, preview: CabinetWallDragPreview | null, room: RoomData) => {
    clearRightDragGhost();
    const candidate = preview?.ghostCandidate ?? preview?.candidate;
    const renderedScene = sceneRef.current;
    if (!candidate || !renderedScene) return;
    const box = threeDWallDragGhostBox(candidate, room);
    const boxGeometry = new THREE.BoxGeometry(box.size.width, box.size.height, box.size.depth);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    boxGeometry.dispose();
    const valid = Boolean(preview?.candidate);
    const material = new THREE.LineBasicMaterial({ color: valid ? 0x059669 : 0xe11d48, transparent: true, opacity: 0.98, depthTest: false });
    const ghost = new THREE.LineSegments(edges, material);
    ghost.position.set(box.position.x, box.position.y, box.position.z);
    ghost.renderOrder = 1000;
    ghost.userData = { rightDragSnapGhost: true, placementUid: source.uid, valid };
    renderedScene.add(ghost);
    rightDragGhostRef.current = ghost;
  };

  const restoreRightDragVisual = (session: NonNullable<typeof rightDragRef.current>) => {
    session.visualOrigins.forEach(({ object, x, z }) => object.position.set(x, object.position.y, z));
  };

  const cabinetWallRunAtPoint = (clientX: number, clientY: number, wall: WallSide): number | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const room = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    if (!renderer || !camera || !room) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(threeDCatalogDropPlane(wall, room), hit)) return null;
    const horizontal = wall === "top" || wall === "bottom";
    return horizontal
      ? Math.max(0, Math.min(room.width, hit.x / INCH))
      : Math.max(0, Math.min(room.depth, hit.z / INCH));
  };

	const handleRoomPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
	  if ((event.target as Element | null)?.closest?.("[data-ui-overlay]")) return;
	  pointerStartRef.current = { x: event.clientX, y: event.clientY, button: event.button };
    if (event.button !== 2 || !onMoveCabinetTo) return;
    if ((onOpenDoorEditor && inspectOpeningAtPoint(event.clientX, event.clientY)?.kind === "door") || (onOpenWindowEditor && inspectOpeningAtPoint(event.clientX, event.clientY)?.kind === "window")) {
      rightDragRef.current = null;
      return;
    }
    const selection = inspectCabinetAtPoint(event.clientX, event.clientY);
    const source = selection?.uid ? placed.find((cabinet) => cabinet.uid === selection.uid) ?? null : null;
    const movementRoom = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    if (!source || !isWallRunDraggable(source, movementRoom)) return;
    const visualOrigins = (catalogRootRef.current?.children ?? [])
      .filter((object) => threeDCabinetHitFromObject(object)?.uid === source.uid)
      .map((object) => ({ object, x: object.position.x, z: object.position.z }));
	    rightDragRef.current = { pointerId: event.pointerId, uid: source.uid, source, startX: event.clientX, startY: event.clientY, active: false, preview: null, targetAlong: null, visualOrigins };
    if (controlsRef.current) controlsRef.current.enabled = false;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional on older browsers. */ }
    event.preventDefault();
  };

  const handleRoomPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = rightDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const travelPx = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (threeDRightPointerGesture(2, travelPx, true) !== "drag") return;
    session.active = true;
    event.preventDefault();
    event.stopPropagation();
    const room = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
    const wall = cabinetWall(session.source, room);
    const targetAlong = cabinetWallRunAtPoint(event.clientX, event.clientY, wall);
    restoreRightDragVisual(session);
	    if (targetAlong == null) {
	      session.preview = null;
	      session.targetAlong = null;
      setCabinetDragMeasurement(null);
      clearRightDragGhost();
      return;
    }
	    session.targetAlong = targetAlong;
	    const preview = cabinetWallDragPreview(session.source, room, placed, openings, targetAlong, { disableSnapping: event.shiftKey });
    session.preview = preview;
    setCabinetDragMeasurement(preview ? { cabinet: session.source, preview } : null);
    updateRightDragGhost(session.source, preview, room);
  };

  const finishRightDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false): boolean => {
    const session = rightDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return false;
    restoreRightDragVisual(session);
    clearRightDragGhost();
    if (controlsRef.current) controlsRef.current.enabled = true;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Pointer capture may already be released. */ }
    rightDragRef.current = null;
    setCabinetDragMeasurement(null);
    if (!session.active) return false;
    suppressContextMenuRef.current = true;
    window.setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
	    event.preventDefault();
	    event.stopPropagation();
	    if (!cancelled && session.targetAlong != null && Boolean(session.preview?.freehand) !== event.shiftKey) {
	      const room = roomOverride ?? dimensions(scene.roomShape?.defaultDimensions);
	      session.preview = cabinetWallDragPreview(session.source, room, placed, openings, session.targetAlong, { disableSnapping: event.shiftKey });
	    }
	    if (!cancelled && session.preview?.candidate) {
	      onMoveCabinetTo?.(session.uid, session.preview.candidate.x, session.preview.candidate.y, session.preview);
    } else if (!cancelled) {
      toast.error(session.preview ? threeDCabinetWallDragText(session.source, session.preview) : `${session.source.masterCode} has no valid same-wall snap at this position.`);
    }
    return true;
  };

		  const handleRoomPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
	    const start = pointerStartRef.current;
	    pointerStartRef.current = null;
	    if (finishRightDrag(event)) return;
	    if (start?.button === 2) return;
		    const travelPx = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : Number.POSITIVE_INFINITY;
		    if (threeDPointerSelectsCabinet("up", travelPx)) {
		      const furnitureSelection = inspectFurnitureAtPoint(event.clientX, event.clientY);
		      if (furnitureSelection) {
		        setMovePanelOpen(false);
		        event.preventDefault();
		        event.stopPropagation();
		        return;
		      }
		      if (openDoorAtPoint(event.clientX, event.clientY)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              const openingSelection = inspectOpeningAtPoint(event.clientX, event.clientY);
	      if (threeDTouchTapOpensWindow(event.pointerType, travelPx, openingSelection?.kind) && openingSelection && onOpenWindowEditor) {
	        onSelectOpening?.(openingSelection.uid);
	        onOpenWindowEditor(openingSelection.uid);
	        setMovePanelOpen(false);
	        event.preventDefault();
	        event.stopPropagation();
	        return;
	      }
	      inspectCabinetAtPoint(event.clientX, event.clientY);
	      setMovePanelOpen(false);
	    }
	  };

  const buildQuotePdf = async () => {
    const renderer = rendererRef.current;
    if (!renderer) throw new Error("3D renderer is not ready");
    try {
      const exportRoom = roomOverride
        ? { width: roomOverride.width, depth: roomOverride.depth }
        : dimensions(scene.roomShape?.defaultDimensions);
      const planCanvas = document.createElement("canvas");
      planCanvas.width = 1000;
      planCanvas.height = 720;
      const plan = planCanvas.getContext("2d");
      if (!plan) throw new Error("Could not prepare floor plan");
      const padding = 68;
      const scale = Math.min((planCanvas.width - padding * 2) / exportRoom.width, (planCanvas.height - padding * 2) / exportRoom.depth);
      const plotWidth = exportRoom.width * scale;
      const plotHeight = exportRoom.depth * scale;
      const offsetX = (planCanvas.width - plotWidth) / 2;
      const offsetY = (planCanvas.height - plotHeight) / 2;
      plan.fillStyle = "#faf8f4";
      plan.fillRect(0, 0, planCanvas.width, planCanvas.height);
      plan.fillStyle = "#ffffff";
      plan.fillRect(offsetX, offsetY, plotWidth, plotHeight);
      plan.strokeStyle = "#26384b";
      plan.lineWidth = 10;
      plan.strokeRect(offsetX, offsetY, plotWidth, plotHeight);
      plan.fillStyle = "#4a3822";
      plan.font = "600 27px sans-serif";
      plan.fillText("Top-down 2D floor plan", 38, 42);
      const planItems = renderExistingDesign ? placed : [];
      for (const item of planItems) {
        const footprint = placedFootprint(item);
        const x = offsetX + item.x * scale;
        const y = offsetY + item.y * scale;
        const width = footprint.w * scale;
        const depth = footprint.d * scale;
        plan.fillStyle = item.placement === "appliance" ? "#d7dee4" : item.placement === "wall" ? "#d8e3ec" : item.placement === "tall" ? "#d9c3a0" : "#b88f55";
        plan.fillRect(x, y, width, depth);
        plan.strokeStyle = "#4a3822";
        plan.lineWidth = 2;
        plan.strokeRect(x, y, width, depth);
        if (width > 34 && depth > 20) {
          plan.fillStyle = "#1e2934";
          plan.font = `${Math.max(11, Math.min(18, width / 4))}px sans-serif`;
          plan.fillText(item.masterCode, x + 4, y + Math.min(depth - 4, 18));
        }
      }
      plan.fillStyle = "#526174";
      plan.font = "18px sans-serif";
      plan.fillText(`${exportRoom.width}" × ${exportRoom.depth}" room · ${planItems.length} placed item${planItems.length === 1 ? "" : "s"}`, 38, planCanvas.height - 24);
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      pdf.setFontSize(20);
      pdf.text("Cabinet Dealz — 3D Room Quote", 40, 42);
      pdf.setFontSize(10);
      pdf.setTextColor(90);
      pdf.text(`Generated ${new Date().toLocaleString()} · Cabinet finish: ${quoteMaterials.cabinet} · Countertop: ${quoteMaterials.countertop}`, 40, 61);
      pdf.setFontSize(11);
      pdf.setTextColor(35);
      pdf.text("3D room view", 40, 78);
      pdf.addImage(renderer.domElement.toDataURL("image/png"), "PNG", 40, 88, 270, 189, undefined, "FAST");
      pdf.text("2D floor plan", 40, 300);
      pdf.addImage(planCanvas.toDataURL("image/png"), "PNG", 40, 310, 270, 194, undefined, "FAST");
      pdf.setTextColor(20);
      pdf.setFontSize(13);
      pdf.text("Itemized catalog quote", 340, 95);
      let y = 116;
      for (const line of orderLines.slice(0, 16)) {
        pdf.setFontSize(9);
        pdf.text(pdf.splitTextToSize(`${line.quantity} × ${line.label}${line.lineTotal == null ? " — Quote" : ` — $${line.lineTotal.toFixed(2)}`}`, 390), 340, y);
        y += 19;
      }
      pdf.setFontSize(14);
      pdf.text(`Catalog-priced subtotal: $${orderSummary?.subtotal.toFixed(2) ?? "0.00"}`, 340, Math.min(536, y + 12));
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text("Preview finishes are visual only. Final pricing is based on the orderable catalog selections in the design.", 40, 580);
      return pdf;
    } catch {
      toast.error("The PDF quote could not be created. Please try again.");
      return null;
    }
  };

  const exportPdf = async () => {
    const pdf = await buildQuotePdf();
    if (pdf) pdf.save(`cabinet-dealz-3d-quote-${Date.now()}.pdf`);
  };

  const printPdf = async () => {
    const pdf = await buildQuotePdf();
    if (!pdf) return;
    const printWindow = window.open(pdf.output("bloburl"), "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Your browser blocked the print window. Allow pop-ups and try again.");
      return;
    }
    window.setTimeout(() => printWindow.print(), 650);
  };

  const emailPdf = async () => {
    if (!orderSummary) {
      toast.error("Add catalog items before emailing a quote.");
      return;
    }
    const pdf = await buildQuotePdf();
    if (!pdf) return;
    try {
      const dataUri = pdf.output("datauristring") as string;
      const pdfBase64 = dataUri.slice(dataUri.indexOf(",") + 1);
      const { sentTo } = await emailQuoteMutation.mutateAsync({
        pdfBase64,
        itemCount: orderSummary.itemCount,
        subtotal: orderSummary.subtotal,
        cabinetFinish: quoteMaterials.cabinet,
        countertopFinish: quoteMaterials.countertop,
      });
      toast.success(`Quote sent to ${sentTo}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Quote email could not be sent.");
    }
  };

  const shareUrl = async (url: string, text: string) => {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
        toast.success("Link copied to clipboard.");
      } catch {
        // Native sharing remains available on devices where clipboard permission is denied.
      }
    }
    if (navigator.share) {
      await navigator.share({ title: "Cabinet Dealz 3D Room", text, url });
    } else if (!copied) {
      throw new Error("Clipboard access is unavailable.");
    }
  };

  const shareConfiguration = async (cameraView?: ThreeDCameraShareView) => {
    if (!shareContext || !roomOverride) {
      toast.error("Add your room and choose an active catalog door style before sharing.");
      return;
    }
    try {
      const thumbnailDataUrl = cameraView ? captureShareThumbnail() ?? undefined : undefined;
      const { token } = await shareMutation.mutateAsync({
        ...shareContext,
        room: { ...roomOverride },
        placed,
        openings,
        sinks,
        presentation: { cabinetFinish, countertopFinish },
        orderSummary,
        thumbnailDataUrl,
      });
      const url = new URL(`/api/shared-3d-view/${token}`, window.location.origin);
      const serializedView = cameraView ? serializeThreeDCameraShareView(cameraView) : "";
      if (serializedView) url.searchParams.set(THREE_D_CAMERA_VIEW_QUERY_PARAM, serializedView);
      await shareUrl(url.toString(), cameraView ? "View this Cabinet Dealz 3D room from the shared inspection perspective." : "View this Cabinet Dealz 3D room configuration.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not create the share link. Please try again.");
    }
  };

  const shareCurrentView = async () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      toast.error("The 3D view is still loading. Please try Share View again in a moment.");
      return;
    }
    const cameraView = { position: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom };
    const thumbnailDataUrl = captureShareThumbnail();
    if (window.location.pathname.startsWith("/3d/")) {
      try {
        const serializedView = serializeThreeDCameraShareView(cameraView);
        if (!serializedView) throw new Error("The current view could not be encoded.");
        const token = window.location.pathname.split("/").filter(Boolean).at(-1);
        if (!token) throw new Error("The shared room could not be identified.");
        const url = new URL(`/api/shared-3d-view/${token}`, window.location.origin);
        if (thumbnailDataUrl && token) {
          await shareThumbnailMutation.mutateAsync({ token, thumbnailDataUrl });
        }
        url.searchParams.set(THREE_D_CAMERA_VIEW_QUERY_PARAM, serializedView);
        await shareUrl(url.toString(), "View this Cabinet Dealz 3D room from the shared inspection perspective.");
      } catch (error) {
        if ((error as DOMException)?.name !== "AbortError") toast.error("Could not create the Share View link. Please try again.");
      }
      return;
    }
    await shareConfiguration(cameraView);
  };

  const shareSavedKitchenImage = async () => {
    if (!photoRenderUrl) return;
    try {
      await shareUrl(
        photoRenderUrl,
        "View my Cabinet Dealz kitchen image, prepared from my saved kitchen plan.",
      );
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        toast.error("Could not share this kitchen image. Please try again.");
      }
    }
  };

  const openPhotoRenderDialog = async () => {
    if (!user) {
      toast.error("Sign in to create a high-resolution 3D preview for your saved design.");
      return;
    }
    if (!renderExistingDesign || placed.length === 0 || temporaryPreviewMessage) {
      toast.error("Finish the current placement preview before creating a high-resolution 3D preview.");
      return;
    }
    if ((!savedDesignId || !isCurrentPlanSaved) && !isPhotoQualityTest) {
      toast.error("Save this design before creating a high-resolution 3D preview so the image remains tied to its exact plan.");
      return;
    }
    const reference = capturePhotoRenderReference();
    if (!reference) {
      toast.error("The 3D view is still loading. Please try the high-resolution preview again in a moment.");
      return;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      toast.error("The 3D view is still loading. Please try the high-resolution preview again in a moment.");
      return;
    }
    const geometryLock = threeDExactPlanGeometryLock({
      roomOverride,
      placed,
      openings,
      sinks,
      island,
      furniture,
      ponyWalls,
      catalogDoorSampleUrl,
      catalogFinishOverride,
      catalogFinishName,
      catalogCountertopName,
      catalogCountertopColor,
      initialPresentation,
    });
    const cameraSnapshot = {
      position: camera.position.toArray().map((value) => Number(value.toFixed(4))) as [number, number, number],
      target: controls.target.toArray().map((value) => Number(value.toFixed(4))) as [number, number, number],
      zoom: Number(camera.zoom.toFixed(4)),
    };
    const approvedMaterialUrl = (value: string | null | undefined) => {
      if (!value) return null;
      try {
        // Project storage assets are emitted as relative paths.  Do not expand
        // them against a temporary preview host (for example, `*.manus.space`),
        // because the protected final-render API correctly treats that host as
        // untrusted.  Use the permanent CabinetDealz material origin instead.
        const origin = value.startsWith("/manus-storage/")
          ? "https://www.cabinetdealz.com"
          : window.location.origin;
        return new URL(value, origin).toString();
      } catch {
        return null;
      }
    };
    const materialManifest: GeminiMaterialManifestEntry[] = [];
    // Missing swatches are resolved against the locked scene, not blockers.
    const missingMaterialInputs: string[] = [];
    const addManifestEntry = (entry: { id: string; role: string; label: string; itemIds: string[]; referenceUrl: string | null | undefined }) => {
      materialManifest.push(geminiMaterialReference(entry));
    };
    const cabinetManifestGroups = new Map<string, { label: string; referenceUrl: string | null; itemIds: string[] }>();
    for (const cabinet of placed) {
      if (cabinet.placement === "appliance" || isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode)) continue;
      const referenceUrl = approvedMaterialUrl(
        resolvedPlacedCabinetDoorSampleUrl(cabinet, cabinetDoorSampleUrls, catalogDoorSampleUrl, renderExistingDesign)
          ?? cabinetFrontVisuals?.[cabinet.uid],
      );
      const label = `${cabinet.masterCode}${cabinet.description ? ` — ${cabinet.description}` : ""}`;
      const key = `${label}|${referenceUrl ?? "missing"}`;
      const current = cabinetManifestGroups.get(key) ?? { label, referenceUrl, itemIds: [] };
      current.itemIds.push(cabinet.uid);
      cabinetManifestGroups.set(key, current);
    }
    // Identity is snapshot-local; keep long labels/URLs in their own fields,
    // not in the schema-bounded reference ID.
    let cabinetManifestIndex = 0;
    cabinetManifestGroups.forEach((entry) => addManifestEntry({ id: `cabinet:${cabinetManifestIndex++}`, role: "cabinet door/finish", ...entry }));
    addManifestEntry({ id: "surface:countertop", role: "countertop", label: catalogCountertopName ?? "Selected countertop", itemIds: ["surface:countertop"], referenceUrl: approvedMaterialUrl(catalogCountertopReferenceUrl ?? catalogCountertopImageUrl) });
    addManifestEntry({ id: "surface:flooring", role: "flooring", label: catalogFlooringName ?? "Selected flooring", itemIds: ["surface:flooring"], referenceUrl: approvedMaterialUrl(catalogFlooringReferenceUrl ?? catalogFlooringImageUrl) });
    addManifestEntry({ id: "surface:backsplash", role: "backsplash", label: catalogBacksplashName ?? "Selected backsplash", itemIds: ["surface:backsplash"], referenceUrl: approvedMaterialUrl(catalogBacksplashReferenceUrl ?? catalogBacksplashImageUrl) });
    if (hardwareStyleId !== "none") {
      const selectedHardware = hardwareStyle(hardwareStyleId);
      const hardwareReference = geminiHardwareReference(hardwareStyleId, placed.map((cabinet) => cabinet.uid), approvedMaterialUrl(catalogHardwareReferenceUrl ?? selectedHardware.referenceUrl), catalogHardwareName);
      if (hardwareReference) materialManifest.push(hardwareReference);
    }
    for (const sink of sinks) {
      addManifestEntry({ id: `sink:${sink.uid}`, role: "sink", label: sink.pelicanProductName ?? "Selected sink", itemIds: [sink.uid], referenceUrl: approvedMaterialUrl(sink.pelicanProductImage) });
      if (sink.pelicanFaucetProductId != null || sink.pelicanFaucetProductName) addManifestEntry({ id: `faucet:${sink.uid}`, role: "faucet", label: sink.pelicanFaucetProductName ?? "Selected faucet", itemIds: [sink.uid], referenceUrl: approvedMaterialUrl(sink.pelicanFaucetProductImage) });
    }
    for (const appliance of placed.filter((cabinet) => (cabinet as { placement?: string | null }).placement === "appliance" || isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode))) {
      addManifestEntry({ id: `appliance:${appliance.uid}`, role: "appliance", label: `${appliance.masterCode}${appliance.description ? ` — ${appliance.description}` : ""}`, itemIds: [appliance.uid], referenceUrl: approvedMaterialUrl(appliance.catalogImageUrl ?? (appliance.applianceProductId ? appliance.rangeTopImageUrl : null)) });
    }
    const materials = [
      { role: "cabinet" as const, productId: catalogFinishProductId ?? null, name: catalogFinishName ?? null, materialImageUrl: approvedMaterialUrl(catalogDoorSampleUrl) },
      { role: "countertop" as const, productId: catalogCountertopProductId ?? null, name: catalogCountertopName ?? null, materialImageUrl: approvedMaterialUrl(catalogCountertopImageUrl) },
      { role: "flooring" as const, productId: catalogFlooringProductId ?? null, name: catalogFlooringName ?? null, materialImageUrl: approvedMaterialUrl(catalogFlooringImageUrl) },
      { role: "backsplash" as const, productId: catalogBacksplashProductId ?? null, name: catalogBacksplashName ?? null, materialImageUrl: approvedMaterialUrl(catalogBacksplashImageUrl) },
      { role: "faucet" as const, productId: sinks.find((sink) => sink.pelicanFaucetProductId != null)?.pelicanFaucetProductId ?? null, name: sinks.find((sink) => sink.pelicanFaucetProductName)?.pelicanFaucetProductName ?? null, materialImageUrl: approvedMaterialUrl(sinks.find((sink) => sink.pelicanFaucetProductImage)?.pelicanFaucetProductImage) },
      { role: "sink" as const, productId: sinks.find((sink) => sink.pelicanProductId != null)?.pelicanProductId ?? null, name: sinks.find((sink) => sink.pelicanProductName)?.pelicanProductName ?? null, materialImageUrl: approvedMaterialUrl(sinks.find((sink) => sink.pelicanProductImage)?.pelicanProductImage) },
    ];
    const hash = async (value: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    const administratorSnapshot = isPhotoQualityTest && !isCurrentPlanSaved;
    const planFingerprint = await hash(administratorSnapshot
      ? JSON.stringify({ geometryLock, camera: cameraSnapshot, materials })
      : savedPlanFingerprintPayload ?? "");
    const hashCaptureBytes = async (dataUrl: string) => {
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    // Match the protected server-side validation: provenance covers the JPEG
    // bytes that will be stored, not the data-URL text wrapper.
    const sourceImageHash = await hashCaptureBytes(reference);
    const renderSpecification = {
      perimeterCabinets: {
        name: catalogFinishName ?? null,
        color: catalogFinishName ?? catalogFinishOverride ?? null,
        doorStyle: catalogDoorProfile?.doorStyle ?? null,
        productId: catalogFinishProductId ?? null,
        materialImageUrl: approvedMaterialUrl(catalogDoorSampleUrl),
      },
      islandCabinets: island ? {
        name: catalogIslandCabinetName ?? null,
        color: catalogIslandCabinetName ?? catalogIslandCabinetColor ?? null,
        doorStyle: catalogDoorProfile?.doorStyle ?? null,
        productId: catalogIslandCabinetProductId ?? null,
        materialImageUrl: approvedMaterialUrl(catalogIslandDoorSampleUrl),
      } : null,
      perimeterCountertop: catalogCountertopName ?? null,
      islandCountertop: island ? catalogIslandCountertopName ?? catalogCountertopName ?? null : null,
      hardware: hardwareStyleId === "none" ? "none" : hardwareStyleId,
      appliances: placed
        .filter((cabinet) => (cabinet as { placement?: string | null }).placement === "appliance" || isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode))
        .map((cabinet) => `${cabinet.masterCode}${cabinet.description ? ` — ${cabinet.description}` : ""}`),
      glassStackers: placed.filter((cabinet) => isStacker(cabinet) && isGlassDoorCabinet(cabinet) && cabinet.stackedOnCabinetUid).map((stacker) => {
        const parent = placed.find((cabinet) => cabinet.uid === stacker.stackedOnCabinetUid);
        const falseBack = parent ? Number(parent.depth) - Number(stacker.depth) > 0.25 : false;
        return {
          code: `${stacker.masterCode}${stacker.description ? ` — ${stacker.description}` : ""}`,
          parentCode: parent ? `${parent.masterCode}${parent.description ? ` — ${parent.description}` : ""}` : "its selected parent wall cabinet",
          frontFlush: Boolean(stacker.depthPositionAdjusted) || falseBack,
          falseBack,
        };
      }),
    };
    const provenance = {
      contractVersion: "exact-plan-v1" as const,
      // An administrator may explicitly test a locked current-design snapshot
      // without turning that test into a customer lead or saved-plan request.
      // Customer requests remain saved-design gated above and on the server.
      designId: administratorSnapshot ? 0 : savedDesignId ?? 0,
      designRevision: administratorSnapshot ? null : savedDesignRevision ?? null,
      planFingerprint,
      geometryLock,
      camera: cameraSnapshot,
      materials,
      materialManifest,
      materialManifestWireVersion: GEMINI_MATERIAL_MANIFEST_WIRE_VERSION,
      missingMaterialInputs,
      renderSpecification,
      sourceImageHash,
      generationMethod: "manual-final-review-deterministic-webgl-v1" as const,
    };
    const sceneSignature = await hash(JSON.stringify({
      designId: provenance.designId,
      designRevision: provenance.designRevision,
      geometryLock: provenance.geometryLock,
      camera: provenance.camera,
      materials: provenance.materials,
      generationMethod: provenance.generationMethod,
      backsplashHeightMode,
      countertopBacksplashHeightIn,
    }));
    setPhotoRenderDraft({ sceneSignature, sceneImageDataUrl: reference, provenance });
    setPhotoRenderReferenceUrl(reference);
    setPhotoRenderError(null);
    setPhotoVerificationCode("");
    setPhotoVerificationStatus("idle");
    if (!isPhotoQualityTest) {
      setPhotoQualityLead((current) => ({
        ...current,
        name: current.name || user?.name || "",
        email: current.email || user?.email || "",
      }));
    }
    setPhotoRenderOpen(true);
  };

  const saveCurrentPlanForGoogleTest = () => {
    if (!onSaveToAccount) {
      setGeminiImageTestError("Save the current kitchen plan, then reopen Final preview before running the Google test.");
      return;
    }
    onSaveToAccount();
    setPhotoRenderError(null);
    setPhotoRenderOpen(false);
    toast.info("Saving the current kitchen plan. Reopen Final preview after the save completes, then run the Google test.");
  };

  const createPhotoRender = async () => {
    if (!user) {
      toast.error("Sign in to create a high-resolution 3D preview for your saved design.");
      return;
    }
    if (!renderExistingDesign || placed.length === 0 || temporaryPreviewMessage) {
      toast.error("Finish the current placement preview before creating a high-resolution 3D preview.");
      return;
    }
    if (!photoRenderDraft) {
      toast.error("Review the locked 3D reference before confirming the final image.");
      return;
    }
    if (photoRenderDraft.provenance.missingMaterialInputs.length > 0) {
      toast.error(`Add exact saved references before generating: ${photoRenderDraft.provenance.missingMaterialInputs.join(", ")}`);
      return;
    }
    if (!isPhotoQualityTest && photoVerificationStatus !== "verified") {
      toast.error("Verify your mobile number for this exact saved kitchen plan before creating an image.");
      return;
    }
    const normalizedLead = {
      name: photoQualityLead.name.trim(),
      email: photoQualityLead.email.trim(),
      phone: photoQualityLead.phone.trim(),
      followUpConsent: photoQualityLead.followUpConsent,
    };
    if (!isPhotoQualityTest && (!normalizedLead.name || !/^\S+@\S+\.\S+$/.test(normalizedLead.email) || normalizedLead.phone.length < 7 || !normalizedLead.followUpConsent)) {
      toast.error("Enter your name, email, mobile number, and consent to follow up before requesting the high-resolution preview.");
      return;
    }
    setPhotoRenderError(null);
    try {
      if (!isPhotoQualityTest) {
        const result = await manualAiHandoffMutation.mutateAsync({
          sceneSignature: photoRenderDraft.sceneSignature,
          sceneImageDataUrl: photoRenderDraft.sceneImageDataUrl,
          provenance: photoRenderDraft.provenance,
        });
        setPhotoRenderOpen(false);
        toast.success(result.customerMessage);
      } else {
        const result = await photoRenderMutation.mutateAsync({
          sceneSignature: photoRenderDraft.sceneSignature,
          sceneImageDataUrl: photoRenderDraft.sceneImageDataUrl,
          provenance: photoRenderDraft.provenance,
          confirmation: true,
        });
        setPhotoRenderUrl(result.imageUrl);
        setPhotoRenderReused(result.reused);
        setPhotoRenderOpen(false);
        toast.success(result.reused ? "Your saved kitchen image is ready to open." : "Your kitchen image is ready and saved to this plan. We will email you a link to return here.");
        await latestCustomerReadyImageQuery.refetch();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo render could not be created. Please try again.";
      setPhotoRenderError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    const job = geminiImageTestJobQuery.data;
    if (job?.status === "completed" && job.imageUrl && geminiImageTestJobId === job.jobId) {
      setGeminiImageTest({ referenceUrl: photoRenderReferenceUrl, imageUrl: job.imageUrl });
      setGeminiImageTestJobId(null);
      setGeminiImageTestError(null);
      return;
    }
    if (job?.status === "queued" && job.nextRetryAt) {
      const retryAt = new Date(job.nextRetryAt).getTime();
      setGeminiImageTestJobId(job.jobId);
      setGeminiRateLimitUntil(retryAt);
      return;
    }
    if (job?.status === "pending") {
      const stale = Date.now() - new Date(job.startedAt).getTime() >= 5 * 60 * 1000;
      if (stale) {
        setGeminiImageTestJobId(null);
        setGeminiImageTestError("The earlier Google image test expired before it completed. You can start a new test.");
        return;
      }
      setGeminiImageTestJobId(job.jobId);
    }
    if (job?.status === "failed") {
      const message = job.errorMessage ?? "Google image test could not be completed. Please try again.";
      setGeminiImageTestError(message);
      if (message.toLowerCase().includes("rate-limit")) {
        setGeminiRateLimitUntil(new Date(job.startedAt).getTime() + 2 * 60 * 1_000);
      }
    }
  }, [geminiImageTestJobQuery.data]);

  useEffect(() => {
    if (!geminiRateLimitUntil) return;
    const interval = window.setInterval(() => setGeminiCooldownNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [geminiRateLimitUntil]);

  useEffect(() => {
    if (geminiRateLimitUntil && geminiCooldownNow >= geminiRateLimitUntil) setGeminiRateLimitUntil(null);
  }, [geminiCooldownNow, geminiRateLimitUntil]);

  useEffect(() => {
    if (!geminiImageTestJobId) return;
    let active = true;
    const check = async () => {
      try {
        const result = await pollGeminiImageTest({ jobId: geminiImageTestJobId });
        if (!active) return;
        if (result.status === "completed") {
          setGeminiImageTest({ referenceUrl: photoRenderReferenceUrl, imageUrl: result.imageUrl });
          setGeminiImageTestJobId(null);
          await utils.designPhotoRenders.getSavedGeminiImageTest.invalidate({ designId: savedDesignId ?? 0 });
          await utils.designPhotoRenders.getGeminiImageTestJob.invalidate({ designId: savedDesignId ?? 0 });
        } else if (result.status === "failed") {
          setGeminiImageTestError(result.message);
          setGeminiImageTestJobId(null);
          await utils.designPhotoRenders.getGeminiImageTestJob.invalidate({ designId: savedDesignId ?? 0 });
        } else if ("nextRetryAt" in result && result.nextRetryAt) {
          setGeminiRateLimitUntil(new Date(result.nextRetryAt).getTime());
        }
      } catch {
        if (active) setGeminiImageTestError("Checking Google image test status again. Your locked plan remains unchanged.");
      }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [geminiImageTestJobId, photoRenderReferenceUrl, pollGeminiImageTest, savedDesignId, utils]);

  const startGeminiImageTest = async () => {
    if (!canUseGeminiImageTest) return;
    if (geminiCooldownActive) return;
    if (!photoRenderDraft) {
      setGeminiImageTestError("The locked view is still preparing. Close Final preview, reopen it, then start the Google test.");
      return;
    }
    if (geminiManifestValidationReason) {
      setGeminiImageTestError(geminiManifestValidationReason);
      return;
    }
    setGeminiImageTestError(null);
    try {
      const googleImageInput = await compactGoogleImageTestInput(photoRenderDraft.sceneImageDataUrl);
      const requestProvenance = serializeGeminiImageTestProvenanceForWire(photoRenderDraft.provenance);
      const result = await startGeminiImageTestMutation.mutateAsync({
        sceneSignature: `${photoRenderDraft.sceneSignature}-gemini-test-v2`,
        sceneImageDataUrl: googleImageInput,
        provenance: requestProvenance,
        restartPending: Boolean(geminiImageTestJobId),
      });
      setGeminiImageTestJobId(result.jobId);
      await utils.designPhotoRenders.getGeminiImageTestJob.invalidate({ designId: photoRenderDraft.provenance.designId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Google image test could not be created. Please try again.";
      if (message.toLowerCase().includes("rate-limit")) {
        setGeminiRateLimitUntil(Date.now() + 2 * 60 * 1_000);
      }
      setGeminiImageTestError(message === "Failed to fetch"
        ? "The Google test request could not reach the server. Please refresh once and try again."
        : message);
    }
  };

  const openSavedGeminiImageTest = () => {
    const saved = savedGeminiImageTestQuery.data;
    if (!saved) return;
    setGeminiImageTest({ referenceUrl: null, imageUrl: saved.imageUrl });
  };

  const openCompletedGeminiImageTest = () => {
    const completed = geminiImageTestJobQuery.data;
    if (completed?.status !== "completed" || !completed.imageUrl) return;
    setGeminiImageTest({ referenceUrl: null, imageUrl: completed.imageUrl });
    setGeminiImageTestError(null);
  };

  const requestPhotoVerification = async () => {
    if (!photoRenderDraft) {
      toast.error("Review the locked 3D reference before requesting a verification code.");
      return;
    }
    const normalizedLead = {
      name: photoQualityLead.name.trim(),
      email: photoQualityLead.email.trim(),
      phone: photoQualityLead.phone.trim(),
      followUpConsent: photoQualityLead.followUpConsent,
    };
    if (!normalizedLead.name || !/^\S+@\S+\.\S+$/.test(normalizedLead.email) || normalizedLead.phone.length < 7 || !normalizedLead.followUpConsent) {
      toast.error("Enter your name, email, mobile number, and consent before requesting a verification code.");
      return;
    }
    setPhotoRenderError(null);
    try {
      const result = await requestPhotoVerificationMutation.mutateAsync({
        sceneSignature: photoRenderDraft.sceneSignature,
        provenance: photoRenderDraft.provenance,
        lead: { ...normalizedLead, followUpConsent: true },
      });
      setPhotoVerificationStatus(result.verificationStatus);
      if (result.verificationStatus === "verified") {
        toast.success("Your mobile number is already verified for this exact saved plan.");
      } else if (result.verificationStatus === "pending") {
        toast.success("Verification code sent. Enter it below to unlock the image.");
      } else {
        toast.error("Phone verification is not configured yet. Please contact Cabinet Dealz for assistance.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not send a verification code. Please try again.";
      setPhotoVerificationStatus("failed");
      setPhotoRenderError(message);
      toast.error(message);
    }
  };

  const confirmPhotoVerification = async () => {
    if (!photoRenderDraft || !/^\d{4,10}$/.test(photoVerificationCode.trim())) {
      toast.error("Enter the verification code from your text message.");
      return;
    }
    setPhotoRenderError(null);
    try {
      const result = await confirmPhotoVerificationMutation.mutateAsync({
        sceneSignature: photoRenderDraft.sceneSignature,
        code: photoVerificationCode.trim(),
      });
      setPhotoVerificationStatus(result.verificationStatus);
      if (result.canCreateImage) toast.success("Mobile number verified. Your locked image is ready to create.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not verify that code. Please try again.";
      setPhotoVerificationStatus("failed");
      setPhotoRenderError(message);
      toast.error(message);
    }
  };

  if (!scene.roomShape && !roomOverride) {
    return <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 text-center text-sm text-muted-foreground">Choose a room layout or open a saved design to generate the deterministic 3D preview.</div>;
  }
  if (webglUnavailable) {
    return <div data-testid="webgl-unavailable" className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 text-center text-sm text-muted-foreground"><p>{webglAutoRetriesRef.current < 2 ? "Starting the interactive 3D view…" : "The interactive 3D view could not start. Close other 3D tabs, then press Retry. Your 2D plan and elevation preview remain available."}</p><button type="button" className="rounded-md border bg-background px-3 py-1.5 text-sm font-semibold text-foreground" onClick={() => { webglAutoRetriesRef.current = 0; setWebglUnavailable(false); }}>Retry 3D view</button></div>;
  }
  const fillerNoticeEntries = threeDFillerMeasurementNoticeEntries(placed);
  const fillerNoticePieceCount = fillerNoticeEntries.reduce((total, entry) => total + entry.quantity, 0);
  const hasOverMaximumFiller = fillerNoticeEntries.some((entry) => entry.over);
  const frontDatumSnaps = threeDFrontDatumSnapIndicators(placed);

  const temporaryPreviewCounterText = threeDTemporaryPreviewCounterText(temporaryPreviewCounter);

  return (
    <section ref={previewRootRef} onDragOver={(event) => event.preventDefault()} className={`relative ${embedded ? "flex h-full min-h-0 flex-col" : ""} ${isFullscreen ? "h-screen w-screen overflow-y-auto bg-background p-3 sm:p-5" : ""} ${className ?? ""}`} aria-label="Interactive three-dimensional room preview">
	  {temporaryPreviewMessage && <div data-testid="three-d-temporary-preview" className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm backdrop-blur"><span>{temporaryPreviewMessage}</span>{temporaryPreviewCounterText && <span data-testid="three-d-temporary-preview-counter" className="shrink-0 rounded-full border border-amber-400 bg-white px-2 py-1 text-[11px] font-bold text-amber-900">{temporaryPreviewCounterText}</span>}{onClearTemporaryPreview && <button type="button" onClick={onClearTemporaryPreview} className="rounded border border-amber-400 bg-white px-2 py-1 text-[11px] font-bold text-amber-900 active:scale-95">Clear preview</button>}</div>}
      {!embedded && <div className="sticky top-0 z-30 mb-2 flex items-center justify-between gap-3 border-b bg-background/95 py-2 backdrop-blur">
        <div className="min-w-0"><p className="text-sm font-semibold">3D Designer</p><p className="truncate text-[11px] text-muted-foreground">{renderExistingDesign ? `${placed.length} cabinets · synchronized with your plan` : "Start placing catalog cabinets"}</p></div>
        <div className="flex shrink-0 gap-1">{onHardwareStyleChange && <ThreeDHandlesControl value={hardwareStyleId} onChange={onHardwareStyleChange} />}<Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setResetKey((current) => current + 1)}><Camera className="h-4 w-4" /></Button></div>
      </div>}
      <div className={`relative overflow-hidden rounded-xl border bg-[#f6f3ed] shadow-inner transition-opacity duration-300 touch-none ${embedded ? "min-h-[300px] flex-1" : isFullscreen ? "h-[calc(100vh-9rem)] min-h-[480px]" : "h-[58dvh] min-h-[400px] sm:h-[62vh]"} ${materialTransitioning ? "opacity-75" : "opacity-100"}`} onPointerDown={handleRoomPointerDown} onPointerMove={handleRoomPointerMove} onPointerUp={handleRoomPointerUp} onPointerCancel={(event) => { pointerStartRef.current = null; finishRightDrag(event, true); }} onDoubleClick={(event) => { if (openDoorAtPoint(event.clientX, event.clientY)) return; const openingSelection = inspectOpeningAtPoint(event.clientX, event.clientY); if (openingSelection?.kind === "window" && onOpenWindowEditor) { setMovePanelOpen(false); onSelectOpening?.(openingSelection.uid); onOpenWindowEditor(openingSelection.uid); return; } const selection = inspectCabinetAtPoint(event.clientX, event.clientY); if (selection?.uid && onOpenCabinetEditor) { setMovePanelOpen(false); onOpenCabinetEditor(selection.uid); } }} onContextMenu={(event) => { event.preventDefault(); const furnitureHit = inspectFurnitureAtPoint(event.clientX, event.clientY); if (furnitureHit && FURNITURE_CATALOG.find((item) => item.id === furnitureHit.defId)?.category === "bathroom-zone" && onOpenFurnitureAttributes) { onSelectFurniture?.(furnitureHit.uid); onOpenFurnitureAttributes(furnitureHit.uid); return; } if (suppressContextMenuRef.current || rightDragRef.current?.active) { suppressContextMenuRef.current = false; return; } if (openDoorAtPoint(event.clientX, event.clientY)) return; const openingSelection = inspectOpeningAtPoint(event.clientX, event.clientY); if (openingSelection?.kind === "window" && onOpenWindowEditor) { setMovePanelOpen(false); onSelectOpening?.(openingSelection.uid); onOpenWindowEditor(openingSelection.uid); return; } const selection = inspectCabinetAtPoint(event.clientX, event.clientY); if (selection?.uid && onOpenCabinetEditor) { setMovePanelOpen(false); onOpenCabinetEditor(selection.uid); return; } setMovePanelOpen(Boolean(selection?.uid && onMoveCabinet)); }} onDragOver={(event) => {
        event.preventDefault();
        const key = event.dataTransfer.getData("text/plain") || draggedCatalogId || "";
        const item = catalogItems.find((candidate) => `${candidate.category}:${candidate.id}` === key) ?? catalogDragItem;
        if (!item || !roomOverride || !item.width || item.width <= 0) { setCatalogDragMeasurement(null); return; }
        const target = catalogDropTargetAtPoint(event.clientX, event.clientY);
        const wall = target?.wall ?? catalogDropWall;
        if (!target || !wall) { setCatalogDragMeasurement(null); return; }
        const layer = item.placement === "wall" ? "wall" : "base";
	        const lowerTarget = !event.shiftKey && item.placement === "wall" && target.placementUid
          ? placed.find((cabinet) => cabinet.uid === target.placementUid) ?? null
          : null;
        const lowerSpot = lowerTarget
          ? selectedLowerCabinetWallPlacement(lowerTarget, roomOverride, item.width, item.depth ?? STD.WALL_DEPTH, item.height ?? STD.WALL_HEIGHT, placed, openings)
          : null;
        if (lowerSpot) {
          const targetWall = cabinetWall(lowerTarget!, roomOverride);
          const horizontal = targetWall === "top" || targetWall === "bottom";
          const snapStart = horizontal ? lowerSpot.x : lowerSpot.y;
          const exactGap = { side: targetWall, layer: "wall" as const, start: snapStart, length: item.width, center: snapStart + item.width / 2, isStandardSize: true, isFillerSize: false };
	          setCatalogDragMeasurement({ item, fit: { gap: exactGap, containsTarget: true, requiredSpan: item.width, availableSpan: item.width, shortage: 0, snapStart, snapEnd: snapStart + item.width, before: 0, after: 0, status: "valid" }, wall: targetWall, freehand: false });
          return;
        }
        const gaps = wallGaps(roomOverride, placed, openings, 0.5).filter((gap) => gap.side === wall && gap.layer === layer);
        const targetAlong = wall === "top" || wall === "bottom" ? target.x : target.y;
	        const fit = event.shiftKey ? wallGapFreehandPreview(gaps, targetAlong, item.width) : wallGapFitPreview(gaps, targetAlong, item.width);
	        setCatalogDragMeasurement(fit ? { item, fit, wall, freehand: event.shiftKey } : null);
	      }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCatalogDragMeasurement(null); }} onDrop={(event) => { event.preventDefault(); const key = event.dataTransfer.getData("text/plain"); const item = catalogItems.find((candidate) => `${candidate.category}:${candidate.id}` === key) ?? catalogDragItem; if (item) onAddCatalogItem?.(item, catalogDropTargetAtPoint(event.clientX, event.clientY), event.shiftKey); setDraggedCatalogId(null); setCatalogDragMeasurement(null); }}>
			        <div ref={mountRef} className="h-full w-full" />
			        {selectedFurnitureUid && (() => {
		          const item = furniture.find((candidate) => candidate.uid === selectedFurnitureUid);
		          const definition = FURNITURE_CATALOG.find((candidate) => candidate.id === item?.defId);
		          const profile = verifiedPelicanBathroomFixtureProfile(item?.pelicanCode ?? definition?.pelicanCode);
		          if (!item || !definition || definition.category === "bathroom-zone" || !profile) return null;
			          return <div data-testid="three-d-bathroom-fixture-canvas-actions" data-ui-overlay="bathroom-fixture-actions" className="absolute bottom-3 left-3 z-30 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white/95 p-2 text-xs shadow-lg backdrop-blur" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
			            <span className="min-w-0 max-w-32 truncate font-semibold text-[#1a2744]" title={profile?.pelicanCode ?? definition.name}>{profile?.pelicanCode ?? definition.name.split(" · ")[0]}</span>
			            {onRotateFurniture && <button type="button" data-testid="three-d-bathroom-rotate" onClick={() => onRotateFurniture(item.uid)} className="inline-flex min-h-10 items-center gap-1 rounded border border-[#1a2744]/35 px-2 font-semibold text-[#1a2744] hover:bg-slate-100 active:scale-95"><Rotate3D className="h-4 w-4" />Rotate 90°</button>}
			            {onRemoveFurniture && <button type="button" data-testid="three-d-bathroom-remove" onClick={() => { preserveCurrentCameraView(); onRemoveFurniture(item.uid); onSelectFurniture?.(null); }} className="inline-flex min-h-10 items-center gap-1 rounded border border-rose-300 px-2 font-semibold text-rose-700 hover:bg-rose-50 active:scale-95"><Trash2 className="h-4 w-4" />Remove</button>}
		          </div>;
			        })()}
			        {selectedCabinetPreviewFinish && <div data-testid="three-d-cabinet-color-preview-status" role="status" className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-[#d9c196] bg-[#fffaf1]/95 px-3 py-2 text-xs font-semibold text-[#614512] shadow-sm backdrop-blur"><span className="h-4 w-4 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: selectedCabinetPreviewFinish.color }} /><span className="truncate">Color check: {selectedCabinetPreviewFinish.name} · rear filler matches · not saved</span></div>}
		        {cabinetDragMeasurement && <div data-testid="three-d-cabinet-drag-highlight" aria-hidden="true" className={`pointer-events-none absolute inset-1 z-20 rounded-xl border-4 transition-colors ${cabinetDragMeasurement.preview.candidate ? "border-emerald-500 shadow-[inset_0_0_32px_rgba(16,185,129,0.2)]" : "border-rose-500 shadow-[inset_0_0_32px_rgba(244,63,94,0.2)]"}`} />}
		        {cabinetDragMeasurement && <div data-testid="three-d-cabinet-drag-measurement" role="status" aria-live="polite" className={`pointer-events-none absolute left-3 top-14 z-30 max-w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur ${cabinetDragMeasurement.preview.candidate ? "border-emerald-600 bg-emerald-50/95 text-emerald-950" : "border-rose-600 bg-rose-50/95 text-rose-950"}`}><span className="block text-[10px] font-bold uppercase tracking-wide">{cabinetDragMeasurement.preview.candidate ? (cabinetDragMeasurement.preview.freehand ? "Shift freehand position" : cabinetDragMeasurement.preview.snapped ? "Valid zero-gap snap" : "Valid drop position") : "Invalid cabinet position"} · {cabinetDragMeasurement.preview.wall} wall · 0&quot; overlap required</span><span>{threeDCabinetWallDragText(cabinetDragMeasurement.cabinet, cabinetDragMeasurement.preview)}</span></div>}
		        {cabinetDragMeasurement?.preview.fit.status === "valid" && <ThreeDRemainingSpaceLine before={cabinetDragMeasurement.preview.fit.before} after={cabinetDragMeasurement.preview.fit.after} />}
		        {catalogDragMeasurement && <div data-testid="three-d-catalog-drag-highlight" aria-hidden="true" className={`pointer-events-none absolute inset-1 z-20 rounded-xl border-4 transition-colors ${catalogDragMeasurement.fit.status === "valid" ? "border-emerald-500 shadow-[inset_0_0_32px_rgba(16,185,129,0.2)]" : "border-rose-500 shadow-[inset_0_0_32px_rgba(244,63,94,0.2)]"}`} />}
		        {catalogDragMeasurement && <div data-testid="three-d-catalog-drag-measurement" role="status" aria-live="polite" className={`pointer-events-none absolute left-3 top-14 z-30 max-w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur ${catalogDragMeasurement.fit.status === "valid" ? "border-emerald-600 bg-emerald-50/95 text-emerald-950" : "border-rose-600 bg-rose-50/95 text-rose-950"}`}><span className="block text-[10px] font-bold uppercase tracking-wide">{catalogDragMeasurement.fit.status === "valid" ? (catalogDragMeasurement.freehand ? "Shift freehand space" : "Valid snap space") : "Invalid drop space"} · {catalogDragMeasurement.wall} wall · 0&quot; overlap required</span><span>{threeDCatalogDragFitText(catalogDragMeasurement.item, catalogDragMeasurement.fit)}</span></div>}
		        {catalogDragMeasurement?.fit.status === "valid" && <ThreeDRemainingSpaceLine before={catalogDragMeasurement.fit.before} after={catalogDragMeasurement.fit.after} />}
		        {hybridPlanUnderlay && <div data-testid="three-d-plan-underlay-badge" className="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-[#d9c196] bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#634b20] shadow-sm backdrop-blur">3D over plan · same placement rules</div>}
	        {temporaryPreviewMessage && <div data-testid="three-d-preview-fade" aria-hidden="true" className={`pointer-events-none absolute inset-0 z-10 bg-background transition-opacity duration-200 motion-reduce:hidden ${temporaryPreviewFading ? "opacity-40" : "opacity-0"}`} />}
        {embedded && <><div className={`${THREE_D_EMBEDDED_TOOLBAR_CLASS} ${tabletOverlay ? "hidden" : "hidden sm:flex"}`} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>{onHardwareStyleChange && <ThreeDHandlesControl value={hardwareStyleId} onChange={onHardwareStyleChange} />}<button type="button" data-testid="three-d-add-cabinet" onClick={() => setWorkspacePanel("catalog")} className="inline-flex items-center gap-1.5 rounded-md bg-[#1a2744] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a2744]/85 active:scale-95"><Plus className="h-3.5 w-3.5" />Add cabinet</button>{cabinetFinishPreviewOptions.length > 1 && <button type="button" data-testid="three-d-cabinet-color-toggle" onClick={cycleCabinetPreviewFinish} aria-pressed={Boolean(selectedCabinetPreviewFinish)} className={`inline-flex max-w-52 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${selectedCabinetPreviewFinish ? "border-[#a87f33] bg-[#fff7e8] text-[#614512]" : "bg-background text-[#1a2744] hover:bg-muted"}`} title="Temporarily show every cabinet and rear filler in the next selected finish"><Palette className="h-3.5 w-3.5" /><span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: selectedCabinetPreviewFinish?.color ?? catalogFinish }} /><span className="truncate">Color: {selectedCabinetPreviewFinish?.name ?? "Plan colors"}</span></button>}<button type="button" data-testid="three-d-wall-heights" onClick={() => setWorkspacePanel("room")} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-muted active:scale-95" aria-label="Set individual wall heights"><Rotate3D className="h-3.5 w-3.5" />Wall heights</button><button type="button" data-testid="three-d-room-context-toggle" onClick={() => setShowRoomContext((current) => !current)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-muted active:scale-95" aria-pressed={showRoomContext} title={showRoomContext ? "Hide the room walls for an unobstructed cabinet view" : "Show the finished-thickness room walls and mitered corners"}><Eye className="h-3.5 w-3.5" />{showRoomContext ? "Hide room walls" : "Show room walls"}</button>{onToggleWallLayer && <button type="button" data-testid="three-d-toggle-wall-cabinets" onClick={onToggleWallLayer} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-muted active:scale-95" aria-pressed={showWallLayer}><PanelTop className="h-3.5 w-3.5" />{showWallLayer ? "Hide wall cabinets" : "Show wall cabinets"}</button>}</div><div data-testid="three-d-mobile-canvas-tools" className={`absolute right-3 top-3 z-20 flex items-start gap-1 ${tabletOverlay ? "" : "sm:hidden"}`} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>{onHardwareStyleChange && <ThreeDHandlesControl value={hardwareStyleId} onChange={onHardwareStyleChange} />}{!tabletOverlay && <button type="button" data-testid="three-d-add-cabinet-mobile" onClick={() => setWorkspacePanel("catalog")} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#1a2744] px-3 text-xs font-semibold text-white shadow-sm active:scale-95"><Plus className="h-4 w-4" />Add</button>}<div className="relative"><button type="button" data-testid="three-d-mobile-canvas-tools-trigger" onClick={() => setMobileCanvasToolsOpen((open) => !open)} aria-expanded={mobileCanvasToolsOpen} aria-label="Canvas controls" className="inline-flex h-11 w-11 items-center justify-center rounded-md border bg-background/95 text-[#1a2744] shadow-sm active:scale-95"><PanelTop className="h-4 w-4" /></button>{mobileCanvasToolsOpen && <div data-testid="three-d-mobile-canvas-tools-menu" className="absolute right-0 top-11 w-56 rounded-lg border bg-background/95 p-2 text-xs shadow-lg backdrop-blur">{cabinetFinishPreviewOptions.length > 1 && <button type="button" data-testid="three-d-mobile-cabinet-color-toggle" onClick={() => { cycleCabinetPreviewFinish(); setMobileCanvasToolsOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-semibold text-[#1a2744] hover:bg-muted" aria-pressed={Boolean(selectedCabinetPreviewFinish)}><Palette className="h-3.5 w-3.5" /><span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: selectedCabinetPreviewFinish?.color ?? catalogFinish }} /><span className="truncate">Color: {selectedCabinetPreviewFinish?.name ?? "Plan colors"}</span></button>}<button type="button" data-testid="three-d-mobile-wall-heights" onClick={() => { setWorkspacePanel("room"); setMobileCanvasToolsOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-semibold text-[#1a2744] hover:bg-muted"><Rotate3D className="h-3.5 w-3.5" />Move wall</button>{onToggleWallLayer && <button type="button" data-testid="three-d-mobile-toggle-wall-cabinets" onClick={() => { onToggleWallLayer(); setMobileCanvasToolsOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-semibold text-[#1a2744] hover:bg-muted" aria-pressed={showWallLayer}><PanelTop className="h-3.5 w-3.5" />{showWallLayer ? "Hide walls" : "Show walls"}</button>}{fillerNoticeEntries.length > 0 && <div data-testid="three-d-mobile-filler-notice" className={`mt-1 border-t px-2.5 pt-2 ${hasOverMaximumFiller ? "border-red-300 text-red-950" : "border-[#ead9b6] text-[#634b20]"}`}><p className="font-semibold">Fillers</p>{fillerNoticeEntries.map((label) => <p key={`${label.masterCode}-${label.installedWidth}-${label.maximum}-${label.over}`} className="mt-1 truncate font-medium">{label.masterCode} · {formatEighthInches(label.installedWidth)} installed · {formatEighthInches(label.maximum)} max{label.over ? " · OVER MAX" : ""}{label.quantity > 1 ? <> · ×{label.quantity}</> : null}</p>)}</div>}</div>}</div></div></>}
        {fillerNoticeEntries.length > 0 && tabletOverlay && <div data-testid="three-d-filler-notice-chip" className="absolute left-3 top-3 z-20" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => setFillerChipOpen((open) => !open)} aria-expanded={fillerChipOpen} className={`inline-flex h-11 items-center gap-1.5 rounded-full border bg-[#fffaf1]/95 px-3 text-xs font-semibold shadow-sm backdrop-blur active:scale-95 ${hasOverMaximumFiller ? "border-red-300 text-red-950" : "border-[#d9c196] text-[#634b20]"}`}>Fillers ({fillerNoticePieceCount})</button>
          {fillerChipOpen && <div className={`mt-1 w-56 rounded-lg border bg-[#fffaf1]/98 px-2.5 py-2 text-xs shadow-lg backdrop-blur ${hasOverMaximumFiller ? "border-red-300 text-red-950" : "border-[#d9c196] text-[#634b20]"}`}><p className="font-semibold">Fillers</p>{fillerNoticeEntries.map((label) => <p key={`${label.masterCode}-${label.installedWidth}-${label.maximum}-${label.over}`} className="mt-0.5 truncate font-medium">{label.masterCode} · {formatEighthInches(label.installedWidth)} installed · {formatEighthInches(label.maximum)} max{label.over ? " · OVER MAX" : ""}{label.quantity > 1 ? <> · ×{label.quantity}</> : null}</p>)}</div>}
        </div>}
        {fillerNoticeEntries.length > 0 && !tabletOverlay && <div data-testid="three-d-filler-notice" role="status" className={`pointer-events-none absolute left-3 top-3 z-20 hidden max-w-[calc(100%-10rem)] rounded-lg border px-2.5 py-2 text-xs shadow-sm backdrop-blur sm:block ${hasOverMaximumFiller ? "border-red-300 bg-red-50/95 text-red-950" : "border-[#d9c196] bg-[#fffaf1]/95 text-[#634b20]"}`}><p className="font-semibold">Fillers</p>{fillerNoticeEntries.map((label) => <p key={`${label.masterCode}-${label.installedWidth}-${label.maximum}-${label.over}`} className="mt-0.5 truncate font-medium">{label.masterCode} · {formatEighthInches(label.installedWidth)} installed · {formatEighthInches(label.maximum)} max{label.over ? " · OVER MAX" : ""}{label.quantity > 1 ? <> · ×{label.quantity}</> : null}</p>)}</div>}
	        {frontDatumSnaps.length > 0 && <div data-testid="three-d-45-degree-front-datum-snap" role="status" aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[calc(100%-11rem)] rounded-lg border border-emerald-500 bg-emerald-50/95 px-2.5 py-2 text-xs text-emerald-950 shadow-lg backdrop-blur">
	          <div className="flex items-start gap-1.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /><div><p className="font-bold uppercase tracking-wide">45° front datum snapped</p>{frontDatumSnaps.map((snap) => <p key={snap.groupId} className="mt-0.5 font-medium"><span className="font-bold">{snap.datumIn}&quot;</span> {snap.placement === "wall" ? "wall-cabinet" : "base/tall cabinet"} front · {snap.cabinetCodes[0]} ↔ {snap.cabinetCodes[1]}</p>)}</div></div>
	        </div>}
	        {materialTransitioning && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/25 backdrop-blur-[1px]"><span className="inline-flex items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#a87f33]" />Updating preview</span></div>}
        {renderExistingDesign && rangeHoodStatus.needs2DPlacement && <div data-testid="three-d-range-hood-status" className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur"><span>Add a range hood in the catalog to show it above this saved range.</span>{onAddRangeHood && <button type="button" onClick={onAddRangeHood} className="ml-1 font-semibold underline underline-offset-2">Add now</button>}</div>}
	        {tabletOverlay
	          ? <ThreeDViewerNavigationControls onZoom={zoomViewer} onReset={resetViewerNavigation} onShare={shareCurrentView} onPhotoRender={openPhotoRenderDialog} onPan={panViewer} compact hidePan={tabletTier.touch} testId="three-d-tablet-navigation" className="absolute bottom-3 right-3 z-20 flex" />
	          : <>
	            <ThreeDViewerNavigationControls onZoom={zoomViewer} onReset={resetViewerNavigation} onShare={shareCurrentView} onPhotoRender={openPhotoRenderDialog} onPan={panViewer} className="absolute bottom-3 right-3 z-20 hidden sm:flex" />
	            <MobileThreeDViewerNavigation onZoom={zoomViewer} onReset={resetViewerNavigation} onShare={shareCurrentView} onPhotoRender={openPhotoRenderDialog} onPan={panViewer} />
	          </>}
	      </div>
	      {selectedCabinet && (() => {
		        const line = threeDOrderLineForSelectedCabinet(orderLines, selectedCabinet);
		        const masterTracItem = masterTracProduct(selectedCabinet.masterCode);
		        const selectedPrice = line?.lineTotal ?? masterTracItem?.listEachUsd ?? null;
		        const description = threeDSelectedCabinetDescription(selectedCabinet);
		        const selectedPlacedCabinet = selectedCabinet.uid ? placed.find((cabinet) => cabinet.uid === selectedCabinet.uid) ?? null : null;
		        const selectedStackerParent = selectedPlacedCabinet?.stackedOnCabinetUid
		          ? placed.find((cabinet) => cabinet.uid === selectedPlacedCabinet.stackedOnCabinetUid) ?? null
		          : null;
		        const canSnapSelectedGlassToFront = Boolean(
		          onSnapGlassCabinetToFront &&
		          selectedPlacedCabinet &&
		          selectedStackerParent &&
		          isStacker(selectedPlacedCabinet) &&
		          isGlassDoorCabinet(selectedPlacedCabinet) &&
		          Number(selectedStackerParent.depth) - Number(selectedPlacedCabinet.depth) > 0.25,
		        );
		        const adminConfigHref = selectedPlacedCabinet ? cabinetConfigHref?.(selectedPlacedCabinet) ?? null : null;
	        const selectedWall = selectedPlacedCabinet && roomOverride ? cabinetWall(selectedPlacedCabinet, roomOverride) : null;
		        const wallFit = selectedPlacedCabinet && island && selectedPlacedCabinet.islandFace
		          ? islandFaceFitMeasure(selectedPlacedCabinet, island, placed)
		          : selectedPlacedCabinet && roomOverride && selectedWall
		            ? wallCabinetFitMeasure(selectedPlacedCabinet, roomOverride, placed, openings, selectedWall)
		            : null;
	        const wallFitText = threeDWallFitGuideText(wallFit);
	        const fittedFillerWidthText = selectedPlacedCabinet ? threeDFittedFillerWidthText(selectedPlacedCabinet) : null;
	        const refrigeratorBayProof = selectedPlacedCabinet && roomOverride && isRefrigerator(selectedPlacedCabinet)
	          ? refrigeratorBayVerificationMetrics(placed, selectedPlacedCabinet, roomOverride)
	          : null;
		        return <div data-testid="three-d-cabinet-attributes" className={threeDSelectedCabinetDockClass()}>
		          <button type="button" aria-label="Close cabinet attributes" onClick={() => { setSelectedCabinet(null); setMovePanelOpen(false); }} className="absolute right-1.5 top-1 z-10 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
		          <div data-testid="three-d-cabinet-attributes-compact" className={embedded && !selectedCabinetInspectorExpanded ? "flex min-w-0 items-center gap-2 pr-7" : "hidden"}>
		            <Info className="h-3.5 w-3.5 shrink-0 text-[#a87f33]" />
		            <p className="shrink-0 text-xs font-bold">{selectedCabinet.masterCode}</p>
		            <p data-testid="three-d-cabinet-description" className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={description}>{description}</p>
		            <span className={`shrink-0 text-xs font-semibold ${selectedPrice == null ? "text-rose-700" : "text-foreground"}`}>{selectedPrice == null ? "Unavailable" : `$${selectedPrice.toFixed(2)}${masterTracItem ? " 2022 List" : ""}`}</span>
		            <button type="button" data-testid="three-d-expand-cabinet-attributes" aria-expanded="false" onClick={() => setSelectedCabinetInspectorExpanded(true)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded border bg-white px-2 text-[11px] font-semibold text-[#1a2744] shadow-sm transition hover:bg-muted active:scale-95">Details <ChevronDown className="h-3.5 w-3.5" /></button>
		          </div>
		  <div className={`grid min-w-0 gap-1 pr-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto_auto] md:items-center ${embedded && !selectedCabinetInspectorExpanded ? "hidden" : ""}`}>
		            <div data-testid="three-d-cabinet-summary" className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-1.5">
		              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a87f33]" />
		              <div className="min-w-0">
		                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
		                  <p className="shrink-0 text-xs font-bold">{selectedCabinet.masterCode}</p>
		                  <p data-testid="three-d-cabinet-description" className="min-w-0 truncate text-muted-foreground" title={description}>{description}</p>
		                </div>
		                <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
		                  <span className="truncate">{masterTracItem ? `MasterTrac · ${masterTracItem.finish}` : `${scene.materials?.cabinet.doorStyle ?? "Catalog"} · ${scene.materials?.cabinet.doorPanelType ?? "panel"}`}</span>
		                  <span className={`font-semibold ${selectedPrice == null ? "text-rose-700" : "text-foreground"}`}>{selectedPrice == null ? "Unavailable" : `$${selectedPrice.toFixed(2)}${masterTracItem ? " · 2022 List reference" : ""}`}</span>
		                </div>
			                {selectedPlacedCabinet?.masterTracConceptStorage && <p className="mt-1 text-[10px] font-medium text-amber-800">Illustrative {selectedPlacedCabinet.masterTracConceptStorage.kind} in this bay · pictured configuration, not installation geometry. See reference SKU lines in Materials.</p>}
			                {selectedPlacedCabinet?.masterTracShelfCut && <p data-testid="three-d-mastertrac-cut" className="mt-1 text-[10px] font-semibold text-amber-800">Installed {selectedPlacedCabinet.masterTracShelfCut.installedWidthIn}″ from {selectedPlacedCabinet.masterTracShelfCut.stockWidthIn}″ purchased stock · {selectedPlacedCabinet.masterTracShelfCut.offcutIn}″ offcut. Field cut and template/rebore required.</p>}
		                {fittedFillerWidthText && <p data-testid="three-d-fitted-filler-width" className="mt-1 inline-flex max-w-full rounded border border-[#d9c196] bg-[#fffaf1] px-1.5 py-0.5 font-semibold text-[#634b20]">{fittedFillerWidthText}</p>}
		                {refrigeratorBayProof && <div data-testid="three-d-refrigerator-bay-proof" className={`mt-1 rounded border px-1.5 py-1 text-[10px] ${refrigeratorBayProof.hasLeftPanel && refrigeratorBayProof.hasRightPanel && refrigeratorBayProof.bridgeCenterOffset != null ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
		                  <div className="font-bold uppercase tracking-wide">Refrigerator dimensions · selected parts</div>
		                  <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-4">
		                    <div><dt className="uppercase opacity-70">Opening</dt><dd className="font-semibold">{formatEighthInches(refrigeratorBayProof.openingWidth)}</dd></div>
		                    <div><dt className="uppercase opacity-70">Left gap</dt><dd className="font-semibold">{refrigeratorBayProof.leftGap == null ? "Panel missing" : formatEighthInches(refrigeratorBayProof.leftGap)}</dd></div>
		                    <div><dt className="uppercase opacity-70">Right gap</dt><dd className="font-semibold">{refrigeratorBayProof.rightGap == null ? "Panel missing" : formatEighthInches(refrigeratorBayProof.rightGap)}</dd></div>
		                    <div><dt className="uppercase opacity-70">Cap center</dt><dd className="font-semibold">{refrigeratorBayProof.bridgeCenterOffset == null ? "Cap missing" : `${formatEighthInches(Math.abs(refrigeratorBayProof.bridgeCenterOffset))} offset`}</dd></div>
		                  </dl>
		                </div>}
		              </div>
		            </div>
		            {wallFitText && wallFit && <div data-testid="three-d-active-wall-clearance" role="status" aria-live="polite" className={`min-w-0 rounded border px-1.5 py-1 ${!wallFit.seated ? "border-amber-300 bg-amber-50 text-amber-900" : wallFit.status === "fits" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>
		              <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wide">Placement · 0&quot; overlap</span><span className="font-bold">{wallFit.status === "fits" ? "Fits" : wallFit.status === "overlap" ? "Overlap" : "Check"}</span></div>
		              <dl data-testid="three-d-cabinet-measurement-grid" className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-4">
		                <div className="min-w-0"><dt className="text-[9px] uppercase opacity-75">Opening</dt><dd className="truncate font-semibold">{formatEighthInches(wallFit.availableSpan)}</dd></div>
		                <div className="min-w-0"><dt className="text-[9px] uppercase opacity-75">Cabinet</dt><dd className="truncate font-semibold">{formatEighthInches(wallFit.requiredSpan)}</dd></div>
		                <div className="min-w-0"><dt className="text-[9px] uppercase opacity-75">Position</dt><dd className="truncate font-semibold">{formatEighthInches(wallFit.snapStart)}–{formatEighthInches(wallFit.snapEnd)}</dd></div>
		                <div className="min-w-0"><dt className="text-[9px] uppercase opacity-75">Remaining</dt><dd className="truncate font-semibold">{formatEighthInches(wallFit.before)} L · {formatEighthInches(wallFit.after)} R</dd></div>
		              </dl>
		              <span className="sr-only">{wallFitText}</span>
		            </div>}
		            {selectedCabinet.uid && onMoveCabinet && <div data-testid="three-d-selected-cabinet-dpad" data-ui-overlay="cabinet-move" aria-label="Move selected cabinet" onWheelCapture={claimCabinetMoveControlEvent} onContextMenu={claimCabinetMoveControlEvent} onPointerDown={stopCabinetMoveControlEvent} onPointerUp={stopCabinetMoveControlEvent} onClick={stopCabinetMoveControlEvent} className="pointer-events-auto relative z-30 flex shrink-0 items-end justify-start gap-1 rounded border bg-muted/30 p-0.5 md:justify-center">
                      <div className="grid grid-cols-3 gap-0.5">
		                <span />
		                <ThreeDCabinetMoveButton testId="three-d-move-up" direction="up" onMove={requestCabinetMove} className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-t-md border border-border bg-white shadow-sm active:scale-95" title={`Move up ${formatEighthInches(moveIncrementIn)}`}><ArrowUp className="h-4 w-4 text-[#1a2744]" /></ThreeDCabinetMoveButton>
		                <span />
		                <ThreeDCabinetMoveButton testId="three-d-move-left" direction="left" onMove={requestCabinetMove} className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-l-md border border-border bg-white shadow-sm active:scale-95" title={`Move left ${formatEighthInches(moveIncrementIn)}`}><ArrowLeft className="h-4 w-4 text-[#1a2744]" /></ThreeDCabinetMoveButton>
		                <button type="button" onClick={(event) => { event.stopPropagation(); preserveCurrentCameraView(); setAutoRotate(false); onRotateCabinet?.(selectedCabinet.uid!); }} className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-sm border border-[#1a2744] bg-[#1a2744] shadow-sm active:scale-95" title="Rotate 90 degrees"><Rotate3D className="h-4 w-4 text-white" /></button>
		                <ThreeDCabinetMoveButton testId="three-d-move-right" direction="right" onMove={requestCabinetMove} className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-r-md border border-border bg-white shadow-sm active:scale-95" title={`Move right ${formatEighthInches(moveIncrementIn)}`}><ArrowRight className="h-4 w-4 text-[#1a2744]" /></ThreeDCabinetMoveButton>
		                <span />
                        <ThreeDCabinetMoveButton testId="three-d-move-down" direction="down" onMove={requestCabinetMove} className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-b-md border border-amber-500 bg-amber-50 shadow-sm active:scale-95" title={`Move down ${formatEighthInches(moveIncrementIn)}`}><ArrowDown className="h-4 w-4 text-[#1a2744]" /></ThreeDCabinetMoveButton>
		                <span />
		              </div>
		              <label className="flex min-w-[92px] flex-col rounded border border-border bg-white px-1.5 py-1 text-[#1a2744] shadow-sm" title="Type an exact movement amount in inches, such as 2.5, 1/2, 1 3/8, or ¾">
		                <span className="text-[8px] font-bold uppercase tracking-wide">Move distance</span>
		                <span className="flex items-center gap-0.5">
		                  <input data-testid="three-d-move-increment" aria-label="Move distance in inches" type="text" inputMode="decimal" value={moveIncrementText} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setMoveIncrementText(event.currentTarget.value)} onBlur={() => setMoveIncrementText(String(moveIncrementIn))} onKeyDown={(event) => { if (event.key === "Enter") { setMoveIncrementText(String(moveIncrementIn)); event.currentTarget.blur(); } else if (event.key === "Escape") { setMoveIncrementText(String(moveIncrementIn)); event.currentTarget.blur(); } }} className="h-6 min-w-0 w-16 bg-transparent text-right text-[11px] font-bold tabular-nums outline-none" />
		                  <span className="text-[10px] font-bold" aria-hidden="true">&quot;</span>
		                </span>
		              </label>
		              {cabinetMoveResult && <p data-testid="three-d-cabinet-move-result" role="status" aria-live="polite" className={`max-w-36 text-[9px] font-semibold leading-tight ${cabinetMoveResult.status === "moved" ? "text-emerald-700" : "text-rose-700"}`}>{cabinetMoveResult.message}</p>}
		            </div>}
			            {selectedCabinet.uid && <div data-testid="three-d-cabinet-actions" className="flex min-w-0 items-center gap-1 overflow-x-auto pt-0.5 md:pt-0">
			              {embedded && <button type="button" data-testid="three-d-collapse-cabinet-attributes" aria-expanded="true" onClick={() => setSelectedCabinetInspectorExpanded(false)} className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border bg-white px-2 text-[11px] font-semibold text-[#1a2744] shadow-sm transition hover:bg-muted active:scale-95"><ChevronDown className="h-3.5 w-3.5 rotate-180" />Collapse</button>}
			              {canSnapSelectedGlassToFront && <button type="button" data-testid="three-d-glass-stacker-snap-to-front" onClick={() => { preserveCurrentCameraView(); setAutoRotate(false); setCabinetMoveResult(onSnapGlassCabinetToFront!(selectedCabinet.uid!)); }} className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-emerald-400 bg-emerald-50 px-2 font-semibold text-emerald-900 transition hover:bg-emerald-100 active:scale-95" title={`Align with the front of ${selectedStackerParent?.masterCode ?? "the deeper parent cabinet"}`}><Magnet className="h-3 w-3" />Snap to Front</button>}
			              {onOpenCabinetEditor && <button type="button" data-testid="three-d-edit-cabinet" onClick={() => onOpenCabinetEditor(selectedCabinet.uid!)} className="h-7 shrink-0 whitespace-nowrap rounded bg-[#1a2744] px-2 font-semibold text-white shadow-sm transition hover:bg-[#1a2744]/85 active:scale-95">{masterTracItem ? "Board elevation & SKU" : "Cabinet attributes"}</button>}
		              {onOpenCabinetEditor && !masterTracItem && <button type="button" data-testid="three-d-end-panel-treatment" onClick={() => onOpenCabinetEditor(selectedCabinet.uid!)} className="h-7 shrink-0 whitespace-nowrap rounded border border-[#8a651f]/30 bg-amber-50 px-2 font-semibold text-[#765416] transition hover:bg-amber-100 active:scale-95">End panels</button>}
			              {onRequestFiller && !masterTracItem && selectedPlacedCabinet && ["base", "wall", "tall"].includes(selectedPlacedCabinet.placement) && !fittedFillerWidthText && <button type="button" data-testid="three-d-add-filler" onClick={() => onRequestFiller(selectedCabinet.uid!)} className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-[#8a651f]/30 bg-amber-50 px-2 font-semibold text-[#765416] transition hover:bg-amber-100 active:scale-95"><Plus className="h-3 w-3" />Add filler</button>}
			              {onRequestFiller && !masterTracItem && selectedPlacedCabinet && fittedFillerWidthText && <button type="button" data-testid="three-d-edit-filler" onClick={() => onRequestFiller(selectedCabinet.uid!)} className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-[#8a651f]/30 bg-amber-50 px-2 font-semibold text-[#765416] transition hover:bg-amber-100 active:scale-95">Edit filler</button>}
		              {adminConfigHref && <a data-testid="three-d-admin-edit-config" href={adminConfigHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded border border-slate-300 bg-white px-2 font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95">Admin: Edit Config ↗</a>}
			              {onRemoveCabinet && <button type="button" data-testid="three-d-remove-cabinet" onClick={() => { preserveCurrentCameraView(); onRemoveCabinet(selectedCabinet.uid!); setSelectedCabinet(null); setMovePanelOpen(false); }} className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap px-1 font-medium text-red-700 underline-offset-4 hover:underline"><Trash2 className="h-3 w-3" />{fittedFillerWidthText ? "Remove filler" : "Remove"}</button>}
		            </div>}
		          </div>
		        </div>;
      })()}
      {selectedFurnitureUid && (() => {
        const selectedFurniture = furniture.find((item) => item.uid === selectedFurnitureUid) ?? null;
        if (!selectedFurniture) return null;
        const definition = FURNITURE_CATALOG.find((item) => item.id === selectedFurniture.defId) ?? null;
        if (definition?.category === "bathroom-zone") return null;
        const profile = verifiedPelicanBathroomFixtureProfile(selectedFurniture.pelicanCode ?? definition?.pelicanCode);
        const label = profile?.name ?? definition?.name ?? "Movable planning item";
        const kind = profile?.kind ? profile.kind.replace(/-/g, " ") : definition?.category ?? "fixture";
        return <div data-testid="three-d-furniture-attributes" className={threeDSelectedCabinetDockClass()}>
          <button type="button" aria-label="Close fixture attributes" onClick={() => onSelectFurniture?.(null)} className="absolute right-1.5 top-1 z-10 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
          <div className="flex min-w-0 items-center gap-1.5 pr-6">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#a87f33]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold" title={label}>{label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{profile?.footprintBasis ? `${formatEighthInches(profile.heightIn)} source height · floor-mounted · illustrative footprint` : profile ? `${formatEighthInches(profile.widthIn)} W × ${formatEighthInches(profile.depthIn)} D × ${formatEighthInches(profile.heightIn)} H` : kind}</p>
              {profile?.footprintBasis && <p className="text-[10px] leading-snug text-amber-800">Visual planning only — verify spout-to-basin fit, rough-in, mounting and hose clearance.</p>}
            </div>
            <div data-testid="three-d-furniture-actions" className="flex shrink-0 items-center gap-1">
              {onRotateFurniture && <button type="button" data-testid="three-d-rotate-furniture" onClick={() => onRotateFurniture(selectedFurniture.uid)} className="inline-flex h-7 items-center gap-1 rounded border bg-white px-2 text-[11px] font-semibold text-[#1a2744] shadow-sm transition hover:bg-muted active:scale-95"><Rotate3D className="h-3 w-3" />Rotate</button>}
              {onRemoveFurniture && <button type="button" data-testid="three-d-remove-furniture" onClick={() => { preserveCurrentCameraView(); onRemoveFurniture(selectedFurniture.uid); onSelectFurniture?.(null); }} className="inline-flex h-7 items-center gap-1 rounded px-1 font-medium text-red-700 underline-offset-4 transition hover:underline active:scale-95"><Trash2 className="h-3 w-3" />Remove</button>}
            </div>
          </div>
        </div>;
      })()}
      {!isPhotoQualityTest && latestCustomerReadyImageQuery.data && (
        <div data-testid="customer-image-ready-notice" role="status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-950">
          <div>
            <p className="text-sm font-bold">Your kitchen image is ready</p>
            <p className="text-xs">It is saved with this verified kitchen plan. We will also email you a link back to this plan.</p>
          </div>
          <Button type="button" size="sm" className="shrink-0" onClick={() => {
            setPhotoRenderReferenceUrl(null);
            setPhotoRenderReused(true);
            setPhotoRenderUrl(latestCustomerReadyImageQuery.data!.imageUrl!);
          }}>
            <Sparkles className="mr-1.5 h-4 w-4" />Open image
          </Button>
        </div>
      )}
      {!embedded && <>
        <div className="mt-2 flex snap-x gap-2 overflow-x-auto border-t pt-2" aria-label="3D designer action bar">
          <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 snap-start gap-1.5" onClick={() => setWorkspacePanel("catalog")}><Move3D className="h-4 w-4" />Catalog{catalogItems.length ? ` (${catalogItems.length})` : ""}</Button>
          <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 snap-start gap-1.5" onClick={() => setWorkspacePanel("view")}><Camera className="h-4 w-4" />View</Button>
	          <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 snap-start gap-1.5" onClick={() => setWorkspacePanel("finish")}><Sparkles className="h-4 w-4" />Finish</Button>
	          {cabinetFinishPreviewOptions.length > 1 && <Button type="button" size="sm" variant={selectedCabinetPreviewFinish ? "default" : "outline"} data-testid="three-d-cabinet-color-toggle" className="h-10 max-w-56 shrink-0 snap-start gap-1.5" onClick={cycleCabinetPreviewFinish}><Palette className="h-4 w-4" /><span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: selectedCabinetPreviewFinish?.color ?? catalogFinish }} /><span className="truncate">Color: {selectedCabinetPreviewFinish?.name ?? "Plan colors"}</span></Button>}
          <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 snap-start gap-1.5" onClick={() => setWorkspacePanel("room")}><Rotate3D className="h-4 w-4" />Room</Button>
          <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 snap-start gap-1.5" onClick={() => setWorkspacePanel("output")}><Share2 className="h-4 w-4" />Output</Button>
          {orderSummary && <Button type="button" size="sm" className="h-10 shrink-0 snap-start" onClick={() => setPricingOpen(true)}>${orderSummary.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Button>}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Tap a cabinet to edit or move it · Drag to orbit · Pinch or scroll to zoom</p>
      </>}
      <Sheet open={workspacePanel !== null} onOpenChange={(open) => { if (!open) setWorkspacePanel(null); }}>
        <SheetContent
          side="bottom"
          data-testid={workspacePanel === "room" ? "three-d-room-controls-sheet" : "three-d-workspace-sheet"}
          className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto overscroll-contain rounded-t-2xl px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[min(42rem,calc(100vw-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:px-5 sm:pb-5"
        >
          {workspacePanel === "catalog" && <>
            <SheetHeader><SheetTitle>Add from catalog</SheetTitle></SheetHeader>
            <p className="mt-2 text-sm text-muted-foreground">Browse the complete active cabinet catalog, then add an item to the active wall. It immediately joins this 3D room and the saved 2D plan.</p>
            <div data-testid="three-d-catalog-category-row" className="mt-4 flex h-10 min-h-10 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border bg-muted/30 p-1" aria-label="3D catalog categories">{THREE_D_CATALOG_GROUPS.map((group) => <button key={group} type="button" onClick={() => setCatalogGroup(group)} className={`h-8 shrink-0 rounded-md px-3 text-xs font-semibold leading-none transition-colors ${catalogGroup === group ? "bg-[#1a2744] text-white" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>{group}</button>)}</div>
            <Input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search cabinet name or code" className="mt-4" aria-label="Search 3D catalog" />
            <p className="mt-2 text-xs text-muted-foreground">{visibleCatalogItems.length} matching items</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {visibleCatalogItems.map((item, index) => <button key={`${item.category}-${item.id}-${item.masterCode}-${index}`} type="button" draggable onDragStart={(event) => { const key = `${item.category}:${item.id}`; event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("text/plain", key); setDraggedCatalogId(key); }} onDragEnd={() => setDraggedCatalogId(null)} onClick={() => { onAddCatalogItem?.(item); setWorkspacePanel(null); }} className="rounded-xl border bg-card p-3 text-left transition hover:border-[#a87f33] hover:bg-[#fffaf1]">
                <span className="block font-semibold">{item.masterCode}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.description ?? item.category}</span><span className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[#a87f33]">Add {item.category}</span>
              </button>) || <p className="col-span-full rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No matching catalog items.</p>}
            </div>
          </>}
          {workspacePanel === "view" && <>
            <SheetHeader><SheetTitle>3D view</SheetTitle></SheetHeader>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="3D camera presets">{([ ["presentation", "Perspective"], ["front", "Front"], ["wide", "Wide"], ["detail", "Detail"] ] as const).map(([preset, label]) => <Button key={preset} type="button" variant={cameraPreset === preset ? "default" : "outline"} onClick={() => { setCameraPreset(preset); setWorkspacePanel(null); }}>{label}</Button>)}</div>
            {cutawayRoomWalls && <Button type="button" className="mt-4" variant="outline" aria-pressed={showSolidFrontWalls} onClick={() => setShowSolidFrontWalls((current) => !current)}>{showSolidFrontWalls ? "Clear view (cut away front walls)" : "Show solid front walls"}</Button>}
            <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setShowRoomContext((current) => !current)}>{showRoomContext ? "Hide room walls" : "Show room walls"}</Button><Button type="button" variant="outline" onClick={() => setAutoRotate((current) => !current)}><Rotate3D className="mr-1.5 h-4 w-4" />{autoRotate ? "Pause rotation" : "Rotate room"}</Button><Button type="button" variant="outline" onClick={toggleFullscreen}>{isFullscreen ? "Exit full screen" : "Full screen"}</Button></div>
          </>}
	          {workspacePanel === "finish" && <>
	            <SheetHeader><SheetTitle>Preview finish</SheetTitle></SheetHeader>
	            <p className="mt-2 text-sm text-muted-foreground">Temporarily show every cabinet and concealed rear filler in one of the real catalog finishes selected for this plan. This color check does not change the saved design, cart, or order.</p>
	            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#d9c196] bg-[#fffaf1] p-3"><span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: catalogFinish }} /><div><p className="text-xs font-semibold text-[#4b3a20]">Active cabinet finish</p><p className="text-sm font-semibold text-[#382710]">{cabinetFinishLabel}</p></div></div>
	            {cabinetFinishPreviewOptions.length > 1 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Cabinet color check choices"><button type="button" onClick={() => setCabinetPreviewFinishId(null)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${selectedCabinetPreviewFinish ? "border-border bg-background" : "border-[#a87f33] bg-[#fff7e8]"}`}>Plan colors</button>{cabinetFinishPreviewOptions.map((option) => <button key={option.id} type="button" onClick={() => setCabinetPreviewFinishId(option.id)} className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${selectedCabinetPreviewFinish?.id === option.id ? "border-[#a87f33] bg-[#fff7e8]" : "border-border bg-background"}`}><span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: option.color }} /><span className="truncate">{option.name}</span></button>)}</div>}
            <p className="mt-5 text-xs font-semibold">Countertop preview</p><div className="mt-2 flex flex-wrap gap-2">{COUNTERTOP_FINISHES.map((option) => <button key={option.name} type="button" onClick={() => setCountertopFinish(option.color)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs ${countertopFinish === option.color ? "border-[#a87f33] bg-[#fff7e8]" : "border-border bg-background"}`}><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: option.color }} />{option.name}</button>)}</div>
          </>}
          {workspacePanel === "room" && <>
            <SheetHeader className="px-1 pb-0 pt-3 sm:px-0"><SheetTitle>Room controls</SheetTitle></SheetHeader>
            <label data-testid="three-d-wall-height-control" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#a87f33]/60 bg-[#fffaf1] p-2.5 text-sm font-semibold text-[#4b3a20]"><span>All wall height</span><span className="flex items-center gap-1"><Input aria-label="3D wall height in inches" type="number" min={1} max={120} step={1} value={wallHeightIn} onChange={(event) => updateWallHeight(event.target.value)} className="h-8 w-16 border border-[#d9c196] bg-background text-center font-semibold shadow-none" />in</span></label>
            <div data-testid="three-d-per-wall-height-controls" className="mt-2 grid grid-cols-2 gap-2" aria-label="Individual wall heights">{([ ["top", "Back"], ["left", "Left"], ["right", "Right"], ["bottom", "Front"] ] as const).map(([side, label]) => <label key={side} className={`flex items-center justify-between rounded-lg border p-2 text-xs font-semibold ${wallHeights[side] < (upperCabinetWallMinimums[side] ?? 0) ? "border-amber-300 bg-amber-50 text-amber-900" : ""}`}><span>{label}</span><Input aria-label={`${label} wall height in inches`} type="number" min={1} max={120} step={1} value={wallHeights[side]} onChange={(event) => updateWallHeightForSide(side, event.target.value)} className="h-8 w-14 text-center text-xs" /></label>)}</div>
            <p className="mt-3 px-1 text-xs text-muted-foreground">Changes apply to the room immediately.</p>
          </>}
          {workspacePanel === "output" && <>
            <SheetHeader><SheetTitle>Save, quote & share</SheetTitle></SheetHeader>
            {orderSummary && <div className="mt-4 flex items-center justify-between rounded-xl border border-[#d9c196] bg-[#fffaf1] p-3"><div><p className="text-sm font-semibold text-[#4b3a20]">Current design</p><p className="text-xs text-[#6e5d42]">{orderSummary.itemCount} items · {orderSummary.pricedLineCount} priced lines</p></div><p className="text-lg font-semibold text-[#382710]">${orderSummary.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>}
	            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><Button type="button" variant="outline" onClick={downloadImage}><Download className="mr-1.5 h-4 w-4" />Image</Button><Button type="button" variant="outline" onClick={exportPdf}><FileDown className="mr-1.5 h-4 w-4" />PDF</Button><Button type="button" variant="outline" onClick={printPdf}><Printer className="mr-1.5 h-4 w-4" />Print</Button><Button type="button" variant="outline" onClick={emailPdf} disabled={emailQuoteMutation.isPending || !orderSummary}><Mail className="mr-1.5 h-4 w-4" />Email</Button><Button data-testid="three-d-photo-render" type="button" title="High-resolution exact 3D preview" className="bg-[#1a2744] text-white hover:bg-[#24375f]" onClick={() => void openPhotoRenderDialog()} disabled={!renderExistingDesign || (!savedDesignId && !isPhotoQualityTest) || photoRenderMutation.isPending}><Sparkles className="mr-1.5 h-4 w-4" />Final preview</Button>{onSaveToAccount && <Button type="button" variant="outline" onClick={onSaveToAccount}><Save className="mr-1.5 h-4 w-4" />Save</Button>}{onSyncCart && <Button type="button" variant="outline" onClick={() => { onSyncCart(); setWorkspacePanel(null); }} disabled={!canSyncThreeDOrderToCart(orderLines)}><RefreshCw className="mr-1.5 h-4 w-4" />Sync cart</Button>}<Button type="button" onClick={() => void shareConfiguration()} disabled={!shareContext || !roomOverride || shareMutation.isPending}><Share2 className="mr-1.5 h-4 w-4" />Share</Button></div>
          </>}
        </SheetContent>
      </Sheet>
      <Sheet open={pricingOpen} onOpenChange={setPricingOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>Itemized design pricing</SheetTitle></SheetHeader>
          <p className="mt-2 text-sm text-muted-foreground">Only catalog-priced lines are included in the subtotal. Quote-only materials remain clearly marked.</p>
          <div className="mt-5 divide-y rounded-lg border">
	            {orderLines.length ? orderLines.map((line) => <div key={line.id} className="flex gap-3 p-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{line.label}</p>{line.detail && <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>}<p className="mt-1 text-xs text-muted-foreground">Qty {line.quantity}{line.unitPrice == null ? " · Quote required" : ` · $${line.unitPrice.toFixed(2)} each`}</p></div><p className="whitespace-nowrap font-semibold">{line.lineTotal == null ? "Quote required" : `$${line.lineTotal.toFixed(2)}`}</p></div>) : <p className="p-4 text-sm text-muted-foreground">No orderable cabinet lines have been added yet.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3"><span className="font-semibold">Catalog-priced subtotal</span><span className="text-lg font-semibold">${orderSummary?.subtotal.toFixed(2) ?? "0.00"}</span></div>
        </SheetContent>
      </Sheet>
	      <Dialog open={photoRenderOpen} onOpenChange={(open) => {
		    if (!open && (photoRenderMutation.isPending || manualAiHandoffMutation.isPending)) {
		      toast.message("Your final image request is already in progress. It cannot be cancelled after confirmation, but your locked plan remains unchanged.");
	          return;
	        }
	        setPhotoRenderOpen(open);
	        if (!open) { setPhotoRenderDraft(null); setPhotoRenderReferenceUrl(null); setPhotoRenderError(null); }
	      }}>
	        <DialogContent data-testid="photo-quality-mobile-scroll-dialog" className="flex max-h-[calc(100dvh-1rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
	          <div data-testid="photo-quality-mobile-scroll-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 sm:px-6 sm:pt-6">
	          <DialogHeader className="pr-7">
		          <DialogTitle>Request your photo-quality kitchen image</DialogTitle>
		          <DialogDescription>We create one locked reference package from your saved plan, selected CabinetDealz and Pelican products, and camera view. Your editable plan does not change.</DialogDescription>
	          </DialogHeader>
          {canUseGeminiImageTest && <section data-testid="gemini-image-test" className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><p className="font-semibold">Google/Gemini image test — locked plan</p><p className="mt-1">This sends the locked plan and selected-material names to Google Gemini. Affiliate results are saved automatically in this storefront’s Image Cabinet and become the selected door style’s newest primary room scene. It does not change pricing, customer image flow, or CRM.</p><Button type="button" size="sm" className="mt-2 bg-[#1a2744] text-white hover:bg-[#24375f]" onClick={() => void startGeminiImageTest()} disabled={Boolean(geminiManifestValidationReason) || startGeminiImageTestMutation.isPending || geminiCooldownActive} title={geminiImageTestBlockingReason ?? undefined}>{startGeminiImageTestMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}{startGeminiImageTestMutation.isPending ? "Starting Google image test…" : geminiCooldownActive ? `Try Google again in ${geminiCooldownLabel}` : geminiImageTestJobId ? "Start fresh Google image test" : "Run Google image test"}</Button>{geminiImageTestBlockingReason && <p data-testid="gemini-image-test-blocking-reason" role="status" className="mt-2 text-sky-900">{geminiImageTestBlockingReason}</p>}{geminiImageTestError && <p role="alert" className="mt-2 text-rose-800">{geminiImageTestError}</p>}</section>}
          {canUseGeminiImageTest && geminiInferredMaterials.length > 0 && <p data-testid="gemini-automatic-predictions" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><strong>Automatic predictions:</strong> No swatch for {geminiInferredMaterials.join("; ")}. Gemini will render these from the locked 3D view and descriptions. Appearance is inferred, not a verified product match. Supplied swatches stay exact.</p>}
          {canUseGeminiImageTest && photoRenderDraft && !geminiManifestValidationReason && geminiImageTestJobQuery.data?.status === "completed" && geminiImageTestJobQuery.data.imageUrl && <section data-testid="completed-gemini-image-test" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-950"><p className="font-semibold">Google image test is ready</p><p className="mt-1">The completed illustrative image is saved and can be reopened after a refresh. An affiliate result is also added to Image Cabinet and becomes this style’s newest primary room scene.</p><Button data-testid="open-completed-gemini-image-test" type="button" size="sm" className="mt-2 bg-[#1a2744] text-white hover:bg-[#24375f]" onClick={openCompletedGeminiImageTest}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Open completed Google image</Button></section>}
          {canUseGeminiImageTest && !geminiManifestValidationReason && savedGeminiImageTestQuery.data && <section data-testid="saved-gemini-image-test" className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><p className="font-semibold">Saved Google image test</p><p className="mt-1">Reopen the illustrative result saved for this exact plan revision after leaving the Designer page.</p><Button data-testid="open-saved-gemini-image-test" type="button" size="sm" className="mt-2 bg-[#1a2744] text-white hover:bg-[#24375f]" onClick={openSavedGeminiImageTest}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Open saved Google test</Button></section>}
		          <div className="space-y-2 rounded-lg border border-[#d9c196] bg-[#fffaf1] p-3 text-sm text-[#4b3a20]">
		            <p className="font-semibold">Your exact plan is protected before a photo-quality image is made.</p>
		            <p className="text-xs leading-relaxed">Cabinet locations, sizes, doors, fillers, appliances, openings, walls, islands, countertops, faucet, sink, flooring, backsplash, and camera framing are locked from your saved plan. Your selected CabinetDealz and Pelican product references are included in one review package. The saved 2D/3D plan and pricing remain authoritative.</p>
	          </div>
          {photoRenderReviewReferences.length > 0 && <section data-testid="photo-quality-selected-door-input" className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-[#1a2744]">Saved material inputs</p><p className="mt-1 text-[11px] leading-relaxed text-slate-600">Every card is keyed to the saved plan. Gemini may enhance realism but must not replace, recolor, move, add, or remove plan items.</p><div className="mt-3 grid grid-cols-1 gap-2">{photoRenderReviewReferences.map((reference) => <figure key={reference.id} className={`min-w-0 rounded border p-2 ${reference.missing ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>{reference.url ? <img src={reference.url} alt={reference.label} className="h-20 w-full rounded border bg-white object-contain" /> : <div role="img" aria-label={reference.label} className="flex h-20 items-center justify-center rounded border border-dashed border-amber-400 bg-amber-100 px-3 text-center text-[10px] font-semibold text-amber-950">Automatic appearance from locked 3D view</div>}<figcaption className="mt-1 text-[10px] font-semibold text-slate-700">{reference.label}</figcaption><p className="text-[9px] leading-snug text-slate-500">{reference.description}</p></figure>)}</div><p className="mt-3 text-[11px] font-semibold text-[#1a2744]">Manifest: {photoRenderDraft?.provenance.materialManifest.length ?? 0} exact references · {photoRenderDraft?.provenance.missingMaterialInputs.length ?? 0} missing</p>{photoRenderDraft?.provenance.missingMaterialInputs.length ? <p data-testid="photo-quality-missing-materials" role="alert" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-950">Generation blocked until these exact saved references are supplied: {photoRenderDraft.provenance.missingMaterialInputs.join(", ")}</p> : <p data-testid="photo-quality-materials-complete" className="mt-2 text-[11px] font-semibold text-emerald-800">Every visible saved-plan item has a reference: supplied swatches stay exact; missing swatches render automatically from the locked 3D view.</p>}<p data-testid="photo-quality-door-reference-status" className={`mt-3 text-[11px] font-semibold ${photoRenderDoorReference.ready ? "text-emerald-800" : "text-amber-800"}`}>{photoRenderDoorReference.message}</p></section>}
	          {catalogRoomSceneUrl && <div data-testid="photo-quality-room-scene-not-applied" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><strong>Style room-scene picture:</strong> catalog reference only. It is not sent as geometry, texture, or a substitute kitchen layout. This exact 3D preview does not use it to change lighting, cabinet materials, camera, or any kitchen object.</div>}
		          {isPhotoQualityTest ? <div data-testid="photo-quality-admin-test" className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><p><strong>Administrator test preview.</strong> Use the exact high-resolution 3D capture to confirm plan fidelity. No customer lead is created and no customer contact information is required.</p>{IN_HOUSE_PATH_TRACE_ENABLED ? <div className="rounded-md border border-sky-200 bg-white/70 p-2.5"><p className="font-semibold">Production render test — experimental</p><p className="mt-1">Creates a 1920×1080 WebGL2 path trace from a cloned current scene and camera, preserving loaded PBR material maps while adding a clone-only deterministic daylight and interior-light rig. It then applies a conservative final denoise pass. It does not use AI or the room-scene picture, does not save a customer render, and must be visually approved before any Photo Quality claim.</p><Button data-testid="path-trace-production-test" type="button" size="sm" className="mt-2 bg-[#1a2744] text-white hover:bg-[#24375f]" onClick={() => void createPathTracePreview()} disabled={pathTracePreviewBusy || !photoRenderDoorReference.ready}>{pathTracePreviewBusy ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}{pathTracePreviewBusy ? `Tracing exact scene… ${pathTracePreviewProgress}%` : "Run HD production render test"}</Button>{pathTracePreviewBusy && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100"><div className="h-full bg-[#1a2744]" style={{ width: `${pathTracePreviewProgress}%` }} /></div>}{pathTracePreviewError && <p role="alert" className="mt-2 text-rose-800">{pathTracePreviewError}</p>}</div> : <div data-testid="in-house-render-disabled" className="rounded-md border border-sky-200 bg-white/70 p-2.5"><p className="font-semibold">Photo-quality image</p><p className="mt-1">Use the Google image test for photo-quality results. The in-house browser render is switched off so it can never interfere with the 3D Designer.</p></div>}</div> : isAffiliateGeminiImageTest ? <div data-testid="photo-quality-affiliate-test" className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><p className="font-semibold">Affiliate saved-plan image</p><p>This Google image stays attached to this exact saved plan, is added automatically to this storefront’s Image Cabinet, and becomes the selected door style’s newest primary room scene. No customer lead, phone verification, pricing change, or CRM record is created.</p></div> : <div data-testid="photo-quality-contact-lead" className="space-y-3 rounded-lg border border-[#b7c8df] bg-[#f5f8fc] p-3"><div><p className="text-sm font-semibold text-[#1a2744]">Request your photo-quality kitchen image</p><p className="mt-1 text-xs leading-relaxed text-slate-700">After mobile verification, Cabinet Dealz sends your exact saved plan, selected materials, and Pelican fixture references to the review team as one AI reference package. We will email you when the finished image is attached back to this plan.</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-700">Name<Input value={photoQualityLead.name} onChange={(event) => setPhotoQualityLead((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></label><label className="space-y-1 text-xs font-semibold text-slate-700">Email<Input value={photoQualityLead.email} onChange={(event) => setPhotoQualityLead((current) => ({ ...current, email: event.target.value }))} type="email" autoComplete="email" /></label></div><label className="block space-y-1 text-xs font-semibold text-slate-700">Mobile phone<Input value={photoQualityLead.phone} onChange={(event) => setPhotoQualityLead((current) => ({ ...current, phone: event.target.value }))} type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 555-5555" /></label><label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"><input type="checkbox" checked={photoQualityLead.followUpConsent} onChange={(event) => setPhotoQualityLead((current) => ({ ...current, followUpConsent: event.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a2744]" />I agree that Cabinet Dealz may contact me about this kitchen design and photo-quality image request. Mobile-number verification protects the exact saved plan and confirmed follow-up information.</label></div>}
                  {!isPhotoQualityTest && !isAffiliateGeminiImageTest && <section data-testid="photo-quality-phone-verification" className="space-y-3 rounded-lg border border-[#b7c8df] bg-white p-3 text-sm text-[#1a2744]">
                    <div><p className="font-semibold">Step 1 — Verify your mobile number</p><p className="mt-1 text-xs leading-relaxed text-slate-700">We send a one-time code only after this exact saved kitchen plan and your follow-up consent are confirmed. The code is never stored in this plan.</p></div>
                    {photoVerificationStatus === "provider_unavailable" && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">Phone verification is being configured. A customer image cannot be created until this service is active.</p>}
		            {photoVerificationStatus === "verified" && <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">Mobile number verified for this exact saved plan. Send your plan to the render team and we will notify you in the Designer and by email when the finished image is attached here.</p>}
                    {photoVerificationStatus !== "verified" && photoVerificationStatus !== "provider_unavailable" && <>
                      {photoVerificationStatus === "pending" && <label className="block space-y-1 text-xs font-semibold text-slate-700">Verification code<Input value={photoVerificationCode} onChange={(event) => setPhotoVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code from text" disabled={requestPhotoVerificationMutation.isPending || confirmPhotoVerificationMutation.isPending} /></label>}
                      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void requestPhotoVerification()} disabled={requestPhotoVerificationMutation.isPending || confirmPhotoVerificationMutation.isPending}>{requestPhotoVerificationMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{photoVerificationStatus === "pending" ? "Send another code" : "Send verification code"}</Button>{photoVerificationStatus === "pending" && <Button type="button" size="sm" onClick={() => void confirmPhotoVerification()} disabled={!/^\d{4,10}$/.test(photoVerificationCode) || requestPhotoVerificationMutation.isPending || confirmPhotoVerificationMutation.isPending}>{confirmPhotoVerificationMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Verify code</Button>}</div>
                    </>}
                  </section>}
	          {photoRenderReferenceUrl && <div className="space-y-1"><p className="text-xs font-semibold text-muted-foreground">Locked Designer view to render</p><img src={photoRenderReferenceUrl} alt="Current locked Cabinet Dealz 3D camera view" className="h-28 w-full rounded-md border object-contain sm:h-36" /></div>}
		  {(photoRenderMutation.isPending || manualAiHandoffMutation.isPending) && <div role="status" className="rounded-md border border-[#b7c8df] bg-[#f2f7fd] px-3 py-2 text-xs text-[#1a2744]"><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Your kitchen image request was received. We are preparing the exact plan and Pelican reference package for review, then will notify you in the Designer and by email when the finished image is attached. Your editable Designer plan is unchanged.</div>}
	          {photoRenderError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"><p>{isPhotoQualityTest ? "The current 3D view differs from the saved kitchen plan. Save the plan and reopen Final preview before starting Google; no phone verification is required for this administrator test." : photoRenderError}</p>{isPhotoQualityTest ? <Button type="button" size="sm" variant="outline" className="mt-2 border-red-300 bg-white text-red-800" onClick={saveCurrentPlanForGoogleTest}><Save className="mr-1.5 h-3.5 w-3.5" />Save current plan and refresh</Button> : <Button type="button" size="sm" variant="outline" className="mt-2 border-red-300 bg-white text-red-800" onClick={() => void createPhotoRender()} disabled={photoRenderMutation.isPending || !photoRenderDraft}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Retry same locked view</Button>}</div>}
	          <div className="h-3 shrink-0" aria-hidden="true" />
	          </div>
		  <div data-testid="photo-quality-mobile-action-footer" className="shrink-0 border-t border-slate-200 bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">{(isPhotoQualityTest || isAffiliateGeminiImageTest) ? <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => setPhotoRenderOpen(false)}>Close preview</Button></div> : <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setPhotoRenderOpen(false)} disabled={photoRenderMutation.isPending || manualAiHandoffMutation.isPending}>Cancel</Button><Button type="button" className="flex-[2]" onClick={() => void createPhotoRender()} disabled={manualAiHandoffMutation.isPending || !photoRenderDraft || photoVerificationStatus !== "verified"} title={photoVerificationStatus !== "verified" ? "Verify the mobile number for this saved kitchen plan first" : undefined}>{manualAiHandoffMutation.isPending ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}Send plan to render team</Button></div>}</div>
	        </DialogContent>
	      </Dialog>
		      <Dialog open={photoRenderUrl !== null} onOpenChange={(open) => { if (!open) { setPhotoRenderUrl(null); setPhotoRenderReused(false); setPhotoRenderDraft(null); setPhotoRenderReferenceUrl(null); } }}>
		        <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>High-resolution 3D preview</DialogTitle><DialogDescription>{photoRenderReused ? "Reused from the same saved plan, materials, and camera—no new capture was created." : "A deterministic capture of the current exact Designer plan and camera view."}</DialogDescription></DialogHeader>{photoRenderUrl && <><div className="grid gap-4 md:grid-cols-2"><figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Locked Designer reference</figcaption>{photoRenderReferenceUrl ? <img src={photoRenderReferenceUrl} alt="Locked 3D Designer reference for exact preview review" className="max-h-[55dvh] w-full rounded-md border object-contain" /> : <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">The original locked reference is not available in this session.</div>}</figure><figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">High-resolution 3D preview</figcaption><img src={photoRenderUrl} alt="High-resolution 3D preview of the current locked Cabinet Dealz kitchen plan" className="max-h-[55dvh] w-full rounded-md border object-contain" /></figure></div><div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950"><strong>Exact 3D capture—not photo quality.</strong> This image intentionally remains the same locked Designer scene, camera, and loaded product materials at higher resolution. The saved 2D/3D plan and pricing remain authoritative.</div><div className="flex flex-wrap justify-end gap-2">{!isPhotoQualityTest && <Button type="button" variant="outline" onClick={() => void shareSavedKitchenImage()}><Share2 className="mr-1.5 h-4 w-4" />Share image</Button>}<a href={photoRenderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a2744] px-3 text-sm font-semibold text-white"><Download className="h-4 w-4" />Open or download</a></div></>}</DialogContent>
	      </Dialog>
	      <Dialog open={pathTracePreview !== null} onOpenChange={(open) => { if (!open) setPathTracePreview(null); }}>
	        <DialogContent data-testid="path-trace-production-result" className="max-w-5xl"><DialogHeader><DialogTitle>Production render test — exact scene</DialogTitle><DialogDescription>A 1920×1080 WebGL2 path-traced comparison from a cloned locked Three.js scene and the same camera. It preserves loaded PBR maps, adds a clone-only deterministic daylight and interior-light rig, converges to 256 samples, and uses a conservative final denoise pass. It is not yet Photo Quality and is not saved as a customer render.</DialogDescription></DialogHeader>{pathTracePreview && <><div className="grid gap-4 md:grid-cols-2"><figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Current Designer view</figcaption><img src={pathTracePreview.referenceUrl} alt="Current locked Designer view before the path-tracing test" className="max-h-[55dvh] w-full rounded-md border object-contain" /></figure><figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">HD path-traced exact-scene test</figcaption><img src={pathTracePreview.renderUrl} alt="Experimental HD exact-scene path-traced production render test" className="max-h-[55dvh] w-full rounded-md border object-contain" /></figure></div><div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950"><strong>What this test uses:</strong> the current exact geometry, camera, and loaded 3D materials, plus clone-only deterministic daylight and interior lighting. It does not use AI, substitute a catalog room scene, change products, or create a customer lead. Approve visual quality only after comparing both images.</div><div className="flex justify-end"><a href={pathTracePreview.renderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a2744] px-3 text-sm font-semibold text-white"><Download className="h-4 w-4" />Open HD image</a></div></>}</DialogContent>
	      </Dialog>
	      <Dialog open={geminiImageTest !== null} onOpenChange={(open) => { if (!open) setGeminiImageTest(null); }}>
	        <DialogContent data-testid="gemini-image-test-result" className="max-w-5xl"><DialogHeader><DialogTitle>Google/Gemini image test — locked saved plan</DialogTitle><DialogDescription>Illustrative output from the locked Designer JPEG. Affiliate results are stored in Image Cabinet and become the selected style’s newest primary room scene; the saved plan, price, and customer workflow remain authoritative.</DialogDescription></DialogHeader>{geminiImageTest && <><div className={`grid gap-4 ${geminiImageTest.referenceUrl ? "md:grid-cols-2" : ""}`}>{geminiImageTest.referenceUrl && <figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Locked Designer reference</figcaption><img src={geminiImageTest.referenceUrl} alt="Locked saved-plan Designer reference sent to Google image test" className="max-h-[55dvh] w-full rounded-md border object-contain" /></figure>}<figure className="min-w-0"><figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Google/Gemini illustrative test</figcaption><img src={geminiImageTest.imageUrl} alt="Google Gemini illustrative image test for the locked saved plan" className="max-h-[55dvh] w-full rounded-md border object-contain" /></figure></div>{!geminiImageTest.referenceUrl && <p className="mt-3 text-xs text-muted-foreground">The original in-session Designer capture is no longer open, but this saved Google test remains tied to the same locked plan revision.</p>}<div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950"><strong>Test only.</strong> Check whether Gemini kept the exact plan, camera, and selected materials. Items without swatches are automatically predicted from the locked 3D view and descriptions; their appearance is not a verified product match. Supplied swatches remain authoritative. This image is illustrative and may carry a provider watermark; it does not alter the saved plan or enable customer generation.</div><div className="flex justify-end"><a href={geminiImageTest.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a2744] px-3 text-sm font-semibold text-white"><Download className="h-4 w-4" />Open image</a></div></>}</DialogContent>
	      </Dialog>
    </section>
  );
}
