import { doorOpeningAppearance } from "@/lib/doorOpeningAppearance";
import {
  PlacedCabinet, RoomData, STD, elevationBox, WallOpening,
  FinishColors, DEFAULT_FINISH_COLORS, CROWN_HEIGHT_IN, TOE_KICK_HEIGHT_IN, BATTEN_WIDTH_IN, LIGHT_RAIL_HEIGHT_IN,
  type DoorPanelKind, type WallSide, cabinetWall, blindCornerDoorSide,
  countertopMaterial, roomCeiling, bearsCountertop, isBaseHeightAppliance, isSinkBaseCabinet, isFarmerSinkBase, isFillerItem, fillerWidthRange, formatEighthInches,
  wallCeiling, wallCeilingIsSloped, wallLength, wallRunOffset, wallRunSpan, wallRunFrame, wallPlacementAt,
  backsplashMaterial, isStacker, isBridgeOverRange, resolveSwing,
  isRangeOrOven, wallCabinetTopLine, isBlindCorner, placedFootprint, crownEligibleCabinets, isLightRailEligibleCabinet, usesRaisedFloorWallDoorPull,
	  flooringMaterial, normalizeInstalledFillersToAdjacentCabinets, normalizeRefrigeratorBayUppers, applianceAppearanceImage, applianceElevationPresentation, rangeVisualAppearance, resolveCabinetHardwarePosition, isWd18CountertopDrawerCabinet, wd18CountertopFaceLayout,
	  isGlassDoorCabinet, glassDoorShelfCount, kitchenCrestGenericOpenEndShelfCount,
} from "@/lib/design";
import { crownTopRuns, formatCrownTop } from "@/lib/crownTopRuns";
import { threeDBacksplashSupportSpans } from "./InteractiveRoom3D";
import {
  type HardwareStyleId,
  hardwareStyle as resolveHardwareStyle,
  doorCountForCabinet,
  drawerCountForCabinet,
  displayDrawerCount,
  doorHardwareCenterFromLeftIn,
  FRAMED_STILE_CENTER_IN,
  normalizeDoorHardwareFramePosition,
} from "@/lib/hardware";
import { resolveConfiguredFaceCounts, resolveDoorDrawerCounts, cabinetDrawingType, isWallBlindCornerCabinet, threeDrawerBaseRowHeights, type CabinetDrawingType, type CabinetLike } from "@/lib/cabinetGraphics";
import { toeKickHeightForElevation } from "@/lib/elevationToeKick";
import { drawerPanelInsetPx, elevationFrameInsetPx, isShakerElevationStyle, shakerFacePanelGeometry } from "@/lib/elevationFrameGeometry";
import { isCustomCabinetProfile } from "@/lib/customCabinetProfiles";
import { resolveCustomCabinetRender } from "@/lib/customCabinetRender";
import { pantryDrawerFrontLayout } from "@/lib/pantryDrawerLayout";
import { farmhouseSinkBaseFaceLayout } from "@/lib/farmhouseSinkBaseFace";
import { createContext, useContext, useRef, useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { masterTracFinishColor, masterTracProduct } from "@/lib/closet";

interface Props {
  room: RoomData;
  cabinets: PlacedCabinet[];
  selectedUid: string | null;
  /** Cabinet currently controlled by an open Attributes panel. */
  attributesTargetUid?: string | null;
  onSelect: (uid: string | null) => void;
  // Which physical wall run to view, in plan terms. A run may be a cardinal
  // side or a drawn wall id. Back-compat: "front" maps to bottom, "back" to top.
  wall: WallSide | string | "front" | "back";
  // Optional: lets the user flip the displayed wall straight from the elevation
  // panel (a compact Back/Front/Left/Right switcher) instead of going back to
  // the top toolbar. When omitted, the switcher is hidden.
  onSelectWall?: (side: string) => void;
  // When set, draw a thin colored countertop band on top of the base run at the
  // 36" counter line, colored by the chosen material. null/undefined = no band.
  countertopMaterialId?: string | null;
  // When set, draw a backsplash texture between the countertop (36") and wall
  // cabinet bottom (54"). null/undefined = no backsplash drawn.
  backsplashMaterialId?: string | null;
  openings?: WallOpening[];
  finish?: FinishColors;
  crown?: boolean;
  toeKick?: boolean;
  batten?: boolean;
  lightRail?: boolean;
  panelKind?: DoorPanelKind;
  // Optional per-cabinet finish + door-panel resolvers for TWO-TONE designs.
  // When provided, each cabinet draws in its own finish/panel; otherwise the
  // single `finish`/`panelKind` props apply to every cabinet.
  finishFor?: (cab: PlacedCabinet) => FinishColors;
  panelKindFor?: (cab: PlacedCabinet) => DoorPanelKind;
  // Optional per-cabinet door sample image URL resolver. When provided, the
  // real door photo is rendered as a background texture on each cabinet face.
  doorSampleUrlFor?: (cab: PlacedCabinet) => string | null;
  // Optional per-cabinet drawer sample image URL resolver. When provided, the
  // drawer front photo is rendered on drawer fronts instead of the door photo.
  drawerSampleUrlFor?: (cab: PlacedCabinet) => string | null;
  // Optional per-cabinet frame inset resolver. Returns the px inset from the door
  // edge to the recessed panel, derived from the style's stileWidth in inches.
  // When omitted, each door style uses its built-in default inset.
  frameInsetFor?: (cab: PlacedCabinet) => number | null;
  /** Verified per-style frame dimensions in inches. Blank fields retain the neutral profile. */
  frameMetricsFor?: (cab: PlacedCabinet) => { stileInches?: number | null; railInches?: number | null } | null;
  // When this elevation is rendered inside a horizontally-mirrored container
  // (the left half of CornerView), set `mirror` so text labels are counter-
  // flipped to stay readable. `hideSwitcher` removes the inner wall picker so
  // CornerView can show its own corner picker instead.
  mirror?: boolean;
  hideSwitcher?: boolean;
  // Decorative hardware spec to draw on the fronts (knob / pull / cup). When
  // omitted or "none", no hardware is drawn.
  hardwareStyleId?: HardwareStyleId | null;
  /** Optional source-selected real hardware finish tint for the existing proxy. */
  hardwareAccent?: string;
  // Corner cabinets that physically wrap THIS corner but are owned by the
  // adjoining wall. CornerView injects them so a lazy-Susan / diagonal / blind
  // corner unit is drawn on BOTH walls, pinned to the seam (corner end of the
  // wall = posAlong 0). These are render-only ghosts of the real placed cabinet.
  seamCabinets?: PlacedCabinet[];
  // Optional: when provided, the elevation supports horizontal drag-to-reorder.
  // The callback receives the uid and the new plan-space x/y coordinate.
  onMove?: (uid: string, x: number, y: number) => void;
  // Optional: when provided, a WALL cabinet can be nudged UP/DOWN in the
  // elevation (drag vertically or Arrow Up/Down). The callback receives the uid
  // and the new mountBottom (inches from floor to the box bottom).
  onMoveVertical?: (uid: string, mountBottom: number) => void;
  // When true, cabinets cannot be dragged (locked layout).
  moveLocked?: boolean;
  // When set, renders the floor strip with the selected flooring material pattern
  // (staggered planks for hardwood/LVP, tile grid, etc.). null/undefined = default wood.
  flooringMaterialId?: string | null;
  // Flooring layout pattern: how planks are arranged.
  flooringPattern?: import("@/lib/design").FlooringLayoutPattern;
  /** Hide cabinet and appliance master codes in customer-facing protected documents. */
  showProductCodes?: boolean;
}

export type ElevationTrimRun = { start: number; end: number; level: number; anchorUid: string };

/** Merge only edge-touching cabinet intervals; true openings remain open. */
export function mergedElevationTrimRuns(
  intervals: Array<{ start: number; end: number; level: number; uid: string }>,
  contactToleranceIn = 0.125,
): ElevationTrimRun[] {
  const ordered = [...intervals].sort((a, b) => a.level - b.level || a.start - b.start);
  const runs: ElevationTrimRun[] = [];
  for (const interval of ordered) {
    const last = runs.at(-1);
    if (last && Math.abs(last.level - interval.level) <= contactToleranceIn && interval.start <= last.end + contactToleranceIn) {
      last.end = Math.max(last.end, interval.end);
      continue;
    }
    runs.push({ start: interval.start, end: interval.end, level: interval.level, anchorUid: interval.uid });
  }
  return runs;
}

const ShakerFaceMetricsContext = createContext({
  widthIn: 24,
  heightIn: 34.5,
  doorHeightIn: 34.5,
  drawerHeightIn: 6,
  doorCount: 1,
  drawerCount: 1,
  frameMetrics: null as { stileInches?: number | null; railInches?: number | null } | null,
});

const GlassDoorRenderContext = createContext({
  enabled: false,
  face: "#f3f1ec",
  shelfCount: 0,
});

/** Base end cabinets are end-of-run returns, never room-corner clip paths. */
export function isBaseEndAngleCabinet(cabinet: CabinetLike, customProfile?: string | null): boolean {
  const drawingType = cabinetDrawingType(cabinet);
  // `customProfile` is the placed-cabinet copy of Cabinet Config's graphicType.
  // Existing BA/BEC placements can therefore carry either legacy `end-angle`
  // or refreshed `base_end_return` metadata even when their stored cabinet
  // description/subcategory predates the new End Cabinet category.
  return (
    customProfile === "end-angle" ||
    customProfile === "end-return" ||
    customProfile === "base_end_return" ||
    drawingType === "end-angle" ||
    drawingType === "end-return"
  );
}

/**
 * Older saved WDC records predate the Cabinet Config corner field and therefore
 * retain `cornerType: null`. WDC is the master family for a wall diagonal
 * corner, so normalize that legacy omission before resolving an elevation.
 * This mirrors the persisted-cabinet normalization already used by plan and
 * 3D geometry; no per-design correction is permitted.
 */
export function normalizeElevationCabinetConfig(cabinet: CabinetLike): CabinetLike {
  const isWallDiagonalCorner = /^WDC[-_]?\d/i.test(cabinet.masterCode ?? "");
  if (isWallDiagonalCorner && !cabinet.cornerType) {
    return { ...cabinet, cornerType: "diagonal" };
  }
  return cabinet;
}

/** Refrigerator end panels are exposed architectural skins: floor to top, no toe kick. */
export function isRefrigeratorEndPanel(cabinet: Pick<PlacedCabinet, "placement" | "masterCode" | "description">): boolean {
  return cabinet.placement === "tall" && /(?:REPV|FRIDGE.*PANEL|REFRIGERATOR.*PANEL|END.*PANEL)/i.test(`${cabinet.masterCode ?? ""} ${cabinet.description ?? ""}`);
}

/** Architectural refrigerator skins stay behind adjacent cabinet faces and do not cast a broad overlap shadow. */
export function refrigeratorEndPanelRenderStyle(): { zIndex: number; boxShadow: string } {
  return { zIndex: 1, boxShadow: "inset 0 0 0 1px color-mix(in srgb, #000000 18%, transparent)" };
}

/**
 * Resolves the saved Cabinet Config contract before drawing an elevation face.
 * A configured generic drawing can inform style, but the elevation always uses
 * the rule's vector profile and physical dimensions. Standard cabinets keep
 * their normal door/drawer geometry.
 */
export function resolveElevationFacePresentation(
  cabinet: CabinetLike,
  customProfile?: string | null,
  genericDrawingUrl?: string | null,
  isAppliance = false,
) {
  const normalizedCabinet = normalizeElevationCabinetConfig(cabinet);
  const isEndAngle = !isAppliance && isBaseEndAngleCabinet(normalizedCabinet, customProfile);
  // Preserve the exact authored end-cabinet type. An angled front and a two-face
  // end return are different Cabinet Config rules and must not be normalized.
  const configuredDrawingType = cabinetDrawingType({
    ...normalizedCabinet,
    graphicType: customProfile ?? normalizedCabinet.graphicType ?? null,
  });
	  const cabinetType = isAppliance
    ? null
    : isEndAngle
	      ? configuredDrawingType
	      : cabinetDrawingType(normalizedCabinet);
	  const glassDoorCabinet = isGlassDoorCabinet({
	    ...normalizedCabinet,
	    customProfile,
	  });
  // BA/BEC end returns have a meaningful measured 2D face, so their catalog
  // line drawings remain reference images only. They must not replace the live
  // textured elevation with a floating white thumbnail.
	  const renderMode = resolveCustomCabinetRender(
	    glassDoorCabinet ? null : customProfile,
    isEndAngle ? null : genericDrawingUrl,
    isAppliance,
  );
  return { cabinetType, isEndAngle, renderMode };
}

/**
 * Farmhouse sinks mount through the countertop rather than replacing the whole
 * base box. Their visible ceramic apron drops roughly 8.5" below the counter,
 * leaving the cabinet doors and recessed toe kick visible beneath it.
 */
export function farmhouseSinkElevationGeometry(cabinetWidthIn: number) {
  const apronDropIn = 8.5;
  const countertopTopIn = STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS;
  const apronBottomIn = STD.BASE_HEIGHT - apronDropIn;
  const sideInsetIn = Math.min(1.5, Math.max(0.75, cabinetWidthIn * 0.04));
  const apronWidthIn = Math.max(0, cabinetWidthIn - sideInsetIn * 2);
  const apronHeightIn = countertopTopIn - apronBottomIn;
  const basinHeightIn = Math.min(2.8, apronHeightIn * 0.3);
  return {
    apronBottomIn,
    apronHeightIn,
    apronWidthIn,
    basinHeightIn,
    basinTopInsetIn: 1.35,
    basinWidthIn: apronWidthIn * 0.76,
    sideInsetIn,
  };
}

export function ElevationView({
  room, cabinets, selectedUid, attributesTargetUid = null, onSelect, wall, onSelectWall, countertopMaterialId = null, backsplashMaterialId = null, openings = [],
  finish = DEFAULT_FINISH_COLORS, crown = false, toeKick = false, batten = false, lightRail = false,
  panelKind = "shaker", mirror = false, hideSwitcher = false,
  hardwareStyleId = null, hardwareAccent = "#1a2744",
  finishFor, panelKindFor, doorSampleUrlFor, drawerSampleUrlFor, seamCabinets = [],
  frameInsetFor, frameMetricsFor,
  onMove, onMoveVertical, moveLocked = false,
  flooringMaterialId = null,
  flooringPattern = "random-stagger",
  showProductCodes = true,
}: Props) {
  const { t } = useLanguage();
  const hw = resolveHardwareStyle(hardwareStyleId);
  // Counter-flip transform for text so labels read correctly when this whole
  // elevation sits inside a scaleX(-1) container.
  const textFlip: React.CSSProperties | undefined = mirror ? { transform: "scaleX(-1)" } : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const wallInnerRef = useRef<HTMLDivElement>(null);
  const [ppi, setPpi] = useState(4);
  const PADDING = 40;

  // Rendering mode toggle: "realistic" (staggered planks, veining, metallic faucet)
  // Always realistic — no simplified/cartoon mode.
  const realistic = true;
  const toggleRenderMode = useCallback(() => { /* no-op: simplified mode removed */ }, []);

  // Elevation drag state
  const [dragUid, setDragUid] = useState<string | null>(null);
  const dragOffset = useRef(0); // offset in px along the wall axis
  // Vertical (mount-height) drag: which axis the current gesture is resolving
  // and the starting pointer-Y + starting mountBottom so we can compute a delta.
  const dragAxis = useRef<"along" | "vertical" | null>(null);
  const vDragStartY = useRef(0);
  const vDragStartBottom = useRef(0);
  const capturedPointerId = useRef<number | null>(null);

  // Normalize legacy "front"/"back" to a shared room wall-run identity.
  const side: string =
    wall === "front" ? "bottom" : wall === "back" ? "top" : (wall as WallSide);
  const wallFrame = wallRunFrame(side, room);

  // Resolve this wall's ceiling (flat or sloped). The wall box is drawn to the
  // HIGH end so a sloped ceiling has room; the slope itself is drawn as an
  // overlay below the box top. heightLeft/heightRight are the ceiling heights at
  // the visually LEFT and RIGHT ends of this elevation. `wallCeilingAt` works in
  // plan order (start->end); when this view is mirrored (CornerView left wall)
  // the on-screen left/right are swapped, so we flip them back for display.
  // One shared lookup for every wall kind: the room ceiling, or a drawn
  // wall's own shorter height (never taller than the ceiling).
  const customWall = room.customWalls?.find((candidate) => candidate.id === side);
  const wc = wallCeiling(room, side as WallSide);
  const sloped = wallCeilingIsSloped(room, side as WallSide);
  const ceilHigh = wc.high;
  // Plan-order start/end heights.
  const startH = (wc.slopeFrom ?? "start") === "start" ? wc.high : wc.low;
  const endH = (wc.slopeFrom ?? "start") === "start" ? wc.low : wc.high;
  const heightLeft = mirror ? endH : startH;
  const heightRight = mirror ? startH : endH;
  // Wall height shown in the elevation tracks the room's real ceiling height,
  // drawn to the high end so a 9ft/10ft (or sloped) ceiling shows more wall.
  const WALL_TOTAL_HEIGHT = ceilHigh;
  const WALL_LABELS: Record<WallSide, string> = {
    top: t("plan_wall_back"), bottom: t("plan_wall_front"), left: t("plan_wall_left"), right: t("plan_wall_right"),
  };
  const wallLabel = WALL_LABELS[side as WallSide] ?? customWall?.label?.trim() ?? `Wall ${(room.customWalls?.findIndex((candidate) => candidate.id === side) ?? -1) + 1}`;
  const planSpan = wallLength(side as WallSide, room);

  // Normalize the refrigerator bay at render time too. A legacy plan can stay
  // live in local React state through an HMR refresh or a direct elevation view
  // before DesignTool's restore normalizer runs. Repair its cap-filler owner as
  // well, so a stale floor-height filler cannot render beside the bridge.
  const elevationCabinets = normalizeInstalledFillersToAdjacentCabinets(
    normalizeRefrigeratorBayUppers(cabinets, room),
    room,
  );

  // Only show cabinets that actually sit on the wall being viewed, so other
  // walls' cabinets don't bleed into this elevation.
  const onThisWall = elevationCabinets.filter((c) => cabinetWall(c, room) === side);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const availW = el.clientWidth - PADDING * 2;
      const availH = el.clientHeight - PADDING * 2;
      const fitPpi = Math.min(availW / planSpan, availH / WALL_TOTAL_HEIGHT);
      setPpi(Math.max(1.5, Math.min(fitPpi, 7)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [planSpan, WALL_TOTAL_HEIGHT]);

  const wallPxW = planSpan * ppi;
  const wallPxH = WALL_TOTAL_HEIGHT * ppi;

  const sorted = [...onThisWall].sort((a, b) => {
    const order: Record<string, number> = { tall: 0, base: 1, appliance: 1, wall: 2 };
    return (order[a.placement] ?? 1) - (order[b.placement] ?? 1);
  });
  const crownRuns = mergedElevationTrimRuns(crownEligibleCabinets(sorted, room)
    .map((p) => {
      const start = wallRunOffset(p, side, room);
      const { bottom, height } = elevationBox(p, room);
      return { start, end: start + wallRunSpan(p, side, room), level: bottom + height, uid: p.uid };
    }));
  const toeKickRuns = mergedElevationTrimRuns(sorted
    .filter((p) => {
      const { bottom } = elevationBox(p, room);
      return p.fillerMatchesFullOwnerEnvelope !== true
        && toeKickHeightForElevation(p.placement, bottom, TOE_KICK_HEIGHT_IN) > 0
        && p.cabinetId !== 0;
    })
    .map((p) => {
      const start = wallRunOffset(p, side, room);
      return { start, end: start + wallRunSpan(p, side, room), level: 0, uid: p.uid };
    }));

  // Openings on the wall being viewed.
  const viewOpenings = openings.filter((o) => o.side === side);

  // Draw a single cabinet/appliance face box. Shared by the main run and by the
  // seam (corner) cabinets injected from CornerView. When `seam` is set the box
  // is pinned to the corner end of the wall (posAlong 0), drawn as a render-only
  // ghost of a corner cabinet that physically wraps this corner.
  const renderCabinetBox = (p: PlacedCabinet, seam = false) => {
    // Blind corner cabinets: always use the full nominal width along the wall,
    // regardless of stored depth (which may be stale/wrong from old saves).
    const sizeAlong = wallRunSpan(p, side, room);
    const posAlong = seam ? 0 : wallRunOffset(p, side, room);
    const { bottom: rawBottom, height: rawHeight } = elevationBox(p, room);
    const masterTracBoard = masterTracProduct(p.masterCode);
    if (masterTracBoard?.placeable && masterTracBoard.shape) {
      const selected = p.uid === selectedUid;
      const shelfDrag = !seam && !moveLocked && masterTracBoard.shape === "shelf" && p.placement === "wall" && !!onMoveVertical;
      return <div
        key={seam ? `${p.uid}-seam` : p.uid}
        data-testid="mastertrac-elevation-board"
        data-tower-id={p.masterTracTowerId ?? undefined}
        role="button"
        tabIndex={0}
        aria-label={`${p.masterCode} ${masterTracBoard.description}, ${masterTracBoard.finish}, ${sizeAlong} by ${rawHeight} inches${p.masterTracShelfCut ? `, installed cut from ${p.masterTracShelfCut.stockWidthIn} inch stock` : ""}, bottom ${rawBottom} inches`}
        onPointerDown={shelfDrag ? (event) => {
          event.stopPropagation();
          onSelect(p.uid);
          setDragUid(p.uid);
          const rect = event.currentTarget.getBoundingClientRect();
          dragOffset.current = event.clientX - rect.left;
          dragAxis.current = null;
          vDragStartY.current = event.clientY;
          vDragStartBottom.current = rawBottom;
          if (wallInnerRef.current) {
            wallInnerRef.current.setPointerCapture(event.pointerId);
            capturedPointerId.current = event.pointerId;
          }
        } : undefined}
        onClick={(event) => { event.stopPropagation(); onSelect(p.uid); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(p.uid); } }}
        className={`absolute border border-stone-500/60 focus-visible:outline-2 focus-visible:outline-amber-600 ${shelfDrag ? "cursor-ns-resize touch-none" : "cursor-pointer"}`}
        style={{
          left: posAlong * ppi,
          bottom: rawBottom * ppi,
          width: Math.max(1, sizeAlong * ppi),
          height: Math.max(1, rawHeight * ppi),
          backgroundColor: masterTracFinishColor(masterTracBoard.finish),
          boxShadow: selected ? "0 0 0 2px #c79130" : "inset 0 1px 0 rgba(255,255,255,.32)",
          zIndex: masterTracBoard.shape === "panel" ? 5 : 6,
        }}
        title={`${p.masterCode} · ${masterTracBoard.description} · ${masterTracBoard.finish}${p.masterTracShelfCut ? ` · cut ${p.masterTracShelfCut.stockWidthIn}″ stock to ${p.masterTracShelfCut.installedWidthIn}″ installed` : ""} · ${rawBottom}″ bottom${shelfDrag ? " · drag up/down to adjust elevation" : ""}`}
      />;
    }
    const isWall = p.placement === "wall";
    const refrigeratorEndPanel = isRefrigeratorEndPanel(p);
    const fullOwnerEnvelopeFiller = isFillerItem(p) && p.fillerMatchesFullOwnerEnvelope === true;
    // Toe kick is physical cabinet geometry: raise every floor-level base/tall
    // face above the recessed 4.5-inch zone, independent of the optional trim
    // BOM setting.
    const isBaseOrTall = p.placement === "base" || p.placement === "tall";
    // Refrigerator end panels are exposed architectural skins, not toe-kicked
    // cabinets. They must visibly run from the floor to the refrigerator top.
    const toeOffset = refrigeratorEndPanel || fullOwnerEnvelopeFiller
      ? 0
      : toeKickHeightForElevation(p.placement, rawBottom, TOE_KICK_HEIGHT_IN);
    const bottom = rawBottom + toeOffset;
    const height = rawHeight - toeOffset;
    // FRIDGE-* and all other appliances render as plain steel/gray appliance boxes.
    // They are NOT cabinet faces — the refrigerator is the appliance itself.
    const isAppliance = p.placement === "appliance" || /^(RANGE|FRIDGE)-/i.test(p.masterCode ?? "");
    const isFreestandingRange = isAppliance && /^RANGE[-_]?/i.test(p.masterCode ?? "");
    const rangeAppearance = isFreestandingRange ? rangeVisualAppearance(p) : null;
    // A range body ends flush with the 34½-inch countertop. Rear-control
    // models also have a real, visible backguard that rises above that line;
    // front-control models remain a single countertop-height chassis.
    const rangeChassisHeight = Math.max(0, STD.RANGE_COOKING_SURFACE_HEIGHT - bottom);
    const hasRangeBackguard = isFreestandingRange && rangeAppearance?.backPanel === "raised";
    const displayedHeight = isFreestandingRange
      ? Math.max(0, (hasRangeBackguard ? STD.RANGE_BACKGUARD_TOP : STD.RANGE_COOKING_SURFACE_HEIGHT) - bottom)
      : height;
    const applianceVisualUrl = isAppliance && applianceElevationPresentation(p.masterCode) === "photo"
      ? applianceAppearanceImage(p.masterCode, p.catalogImageUrl)
      : null;
    const isSelected = p.uid === selectedUid;
    const isAttributesTarget = p.uid === attributesTargetUid;
    const isDragging = p.uid === dragUid;
    const cabFinish = finishFor ? finishFor(p) : finish;
    const cabPanelKind = panelKindFor ? panelKindFor(p) : panelKind;
    // Resolve the door sample image URL for this cabinet (real door photo).
    const cabDoorSampleUrl = !isAppliance && doorSampleUrlFor ? doorSampleUrlFor(p) : null;
    // Resolve the drawer sample image URL (used for drawer fronts only).
    // Falls back to the door sample if no separate drawer photo is set.
    const cabDrawerSampleUrl = !isAppliance && drawerSampleUrlFor ? (drawerSampleUrlFor(p) ?? cabDoorSampleUrl) : cabDoorSampleUrl;
    // Resolve per-style frame inset (px) for this cabinet.
    const cabFrameInset = !isAppliance && frameInsetFor ? frameInsetFor(p) : null;
    const cabFrameMetrics = !isAppliance && frameMetricsFor ? frameMetricsFor(p) : null;
	    const kitchenCrestGenericShelfCount = kitchenCrestGenericOpenEndShelfCount(p);
	    // KitchenCrest's OE630/OE636/OE642 line art is square-front open shelving.
	    // Keep the existing source record and dimensions, but do not let a stale
	    // curved profile change that verified generic form in the elevation.
	    const customProfile = kitchenCrestGenericShelfCount != null
	      ? "curved-open-shelf"
	      : p.customProfile ?? null;
    const facePresentation = resolveElevationFacePresentation(p, customProfile, p.genericDrawingUrl, isAppliance);
    const cabType: CabinetDrawingType | null = facePresentation.cabinetType;
    const isEndAngle = facePresentation.isEndAngle;
    const customRenderMode = facePresentation.renderMode;
    const showProfileFallback = customRenderMode === "vector-profile" && !isEndAngle;
    // Face fill: clean cabinet-box background behind the vector face geometry.
    // Product photos are intentionally not tiled into elevations because their
    // embedded seams create false drawer and rail lines at small drawing scales.
    const faceFill = isAppliance
      ? rangeAppearance?.finish === "black"
        ? "linear-gradient(160deg, #303841 0%, #171d23 20%, #0d1217 56%, #202932 100%)"
        : rangeAppearance?.finish === "black-stainless"
          ? "linear-gradient(160deg, #626a72 0%, #30363d 28%, #151a20 58%, #4d555e 100%)"
          : rangeAppearance?.finish === "white"
            ? "linear-gradient(160deg, #ffffff 0%, #f1f3f5 38%, #d9dde1 100%)"
            : "linear-gradient(160deg, #f4f6f9 0%, #dde2ea 18%, #c8cfd9 45%, #d4dae4 72%, #bec6d2 100%)"
      : `linear-gradient(180deg, color-mix(in srgb, ${cabFinish.face} 97%, #ffffff) 0%, ${cabFinish.face} 20%, ${cabFinish.face} 80%, color-mix(in srgb, ${cabFinish.face} 92%, #000000) 100%)`;
    const edgeColor = isAppliance ? (rangeAppearance?.finish === "black" ? "#070a0e" : "#6b7280") : cabFinish.edge;
    // Use the richer description-driven door/drawer counts for accurate rendering.
    // Microwave bases are explicitly zero-door Cabinet Config records; their
    // resolver returns those authored counts without applying a width fallback.
    const resolvedCounts = !isAppliance ? resolveDoorDrawerCounts(p) : { doors: 0, drawers: 0 };
    // An authored appliance-opening record owns its face layout. Its numeric
    // Config counts include meaningful zeroes, so do not let a generic width
    // heuristic add a door when the Config says there are none.
    const hasConfiguredOpening = p.openingType != null || cabType === "microwave-base";
    const configuredCounts = {
      doors: Math.max(0, p.numberOfDoors ?? 0),
      drawers: Math.max(0, p.numberOfDrawers ?? 0),
    };
    const inferredDoors = resolvedCounts.drawers > 0 && resolvedCounts.doors === 0 ? 0 : (resolvedCounts.doors || doorCountForCabinet(p));
    const inferredDrawers = isWall ? 0 : (resolvedCounts.drawers || displayDrawerCount(p));
    // An explicit Cabinet Config value, including zero, always wins. A configured
    // appliance opening with an omitted legacy count also stays open instead of
    // allowing generic description or width heuristics to invent cabinet faces.
    const configuredDisplayCounts = resolveConfiguredFaceCounts({
      numberOfDoors: p.numberOfDoors,
      numberOfDrawers: p.numberOfDrawers,
      hasConfiguredOpening,
      inferredDoors,
      inferredDrawers,
    });
    // WDC is the configured two-door wall-diagonal family. Older saved records
    // may still carry supplier zeroes in their face-count fields, so normalize
    // those historic placements to the same contract as a fresh Cabinet Config
    // placement instead of drawing a generic single-door wall cabinet.
    const isLegacyWdcDiagonal = /^WDC[-_]?\d/i.test(p.masterCode ?? "") && cabType === "diagonal-corner";
	    // A farmhouse sink base has two doors and NO drawer faces under its apron.
	    const isFarmhouseSinkBaseFace = !isAppliance && !isWall && isFarmerSinkBase(p);
	    const farmhouseFace = isFarmhouseSinkBaseFace
	      ? farmhouseSinkBaseFaceLayout(sizeAlong, height, configuredDisplayCounts.doors)
	      : null;
	    const displayCounts = farmhouseFace
      ? { doors: farmhouseFace.doorCount, drawers: 0 }
      : isWd18CountertopDrawerCabinet(p)
      ? { doors: 1, drawers: 2 }
      : isLegacyWdcDiagonal
	        ? { doors: Math.max(2, configuredDisplayCounts.doors), drawers: 0 }
	        : configuredDisplayCounts;
	    const isGlassDoor = isGlassDoorCabinet(p);
	    const visibleGlassShelfCount = glassDoorShelfCount(p);
    // DEBUG: log O-code cabinets to diagnose oven-tall rendering
    if (p.masterCode && (/^O\d/i.test(p.masterCode) || /^UOC\d/i.test(p.masterCode))) {
      console.log('[EV-OVEN]', p.masterCode, '| category:', p.category, '| subCategory:', p.subCategory, '| placement:', p.placement, '| cabType:', cabType, '| ovenType:', p.ovenType);
    }
    // For blind corner cabinets, determine which side the blind (corner) portion
    // is on. If the cabinet's start is near position 0 (wall start), the corner
    // is on the left. If its end is near planSpan (wall end), the corner is on
    // the right. This drives the door flip so the door faces the exposed side.
    const isBlind = p.cornerType === "blind-corner" || isBlindCorner(p.masterCode, p.description);
    // The shared physical rule (the one that sets the saved door swing) decides first: a blind base is
    // seated at its 3-6 in blind pull, so "within 2 in of the wall start" misses a corner seated at 6 in
    // and drew the hidden panel on the exposed side. It returns null in the middle of a wall, where the
    // legacy near-start test keeps its exact behavior.
    const physicalDoorSide = isBlind && !seam && !isWallBlindCornerCabinet(p) ? blindCornerDoorSide(p, room) : null;
    const blindLeft = isBlind
      ? (isWallBlindCornerCabinet(p) || (physicalDoorSide ? physicalDoorSide === "right" : posAlong <= 2))
      : true;
    const canDrag = !seam && !moveLocked && !!onMove && !isAppliance;

    const installedFillerWidth = isFillerItem(p) ? Math.min(Math.abs(Number(p.width)), Math.abs(Number(p.depth))) : null;
    const fillerRange = isFillerItem(p) ? fillerWidthRange(p) : null;
    const showFillerMeasurement = !seam && installedFillerWidth != null && installedFillerWidth > 0;
    const fillerExceedsMaximum = showFillerMeasurement && fillerRange != null && installedFillerWidth > fillerRange.max + 0.001;

    return (
      <div
        key={seam ? `${p.uid}-seam` : p.uid}
        onPointerDown={canDrag ? (e) => {
          e.stopPropagation();
          onSelect(p.uid);
          setDragUid(p.uid);
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          dragOffset.current = e.clientX - rect.left;
          // Vertical-drag bookkeeping (only meaningful for wall cabinets): record
          // where the pointer started and the box's current bottom so a vertical
          // drag can adjust mount height. The gesture's dominant axis is decided
          // on the first move.
          dragAxis.current = null;
          vDragStartY.current = e.clientY;
          vDragStartBottom.current = bottom;
          // Capture on the WALL container so pointermove fires there (not on
          // the tiny cabinet div which mobile browsers isolate after capture).
          if (wallInnerRef.current) {
            wallInnerRef.current.setPointerCapture(e.pointerId);
            capturedPointerId.current = e.pointerId;
          }
        } : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(p.uid);
        }}
        className={`absolute overflow-hidden ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isAttributesTarget ? "z-20" : ""}`}
        style={{
          left: posAlong * ppi,
          width: sizeAlong * ppi,
          bottom: bottom * ppi,
          height: displayedHeight * ppi,
          // The outer container carries the face fill as its background so that
          // no interior/wall color bleeds through at the top or bottom of the
          // cabinet face. DoorFront renders on top with the door/drawer details.
          background: isFreestandingRange ? "transparent" : faceFill,
          border: "none",
          borderRadius: 0,
          // Drop shadow lifts the cabinet face off the wall so even light-colored
          // finishes read as 3D objects rather than flat rectangles. The shadow
          // simulates overhead room lighting (slightly right+bottom biased).
          // When selected, the gold inner glow is added on top of the shadow.
          boxShadow: refrigeratorEndPanel
            ? refrigeratorEndPanelRenderStyle().boxShadow
            : isAttributesTarget
              ? "2px 3px 8px rgba(0,0,0,0.22), -1px 0 4px rgba(0,0,0,0.10), inset 0 0 0 3px rgba(212,167,90,1), inset 0 0 14px rgba(212,167,90,0.48), 0 0 0 4px rgba(212,167,90,0.50)"
            : isSelected
              ? "2px 3px 8px rgba(0,0,0,0.22), -1px 0 4px rgba(0,0,0,0.10), inset 0 0 0 2px rgba(212,167,90,0.85), inset 0 0 8px rgba(212,167,90,0.30)"
              : "2px 3px 8px rgba(0,0,0,0.22), -1px 0 4px rgba(0,0,0,0.10)",
          opacity: seam ? 0.96 : isDragging ? 0.85 : undefined,
          transition: isDragging ? undefined : "left 80ms ease-out",
          // A refrigerator panel is a narrow enclosure skin in the seam. The
          // adjacent cabinet face paints above it if a legacy layout overlaps
          // by a fraction, keeping the panel from covering cabinet doors.
          zIndex: isDragging ? 10 : refrigeratorEndPanel ? refrigeratorEndPanelRenderStyle().zIndex : 2,
        }}
        title={`${p.masterCode} — ${p.description}`}
        data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}
      >
        <div className="w-full h-full relative">
          {isAttributesTarget && <span data-testid="elevation-cabinet-attributes-target" className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 rounded-full border border-amber-200 bg-[#1a2744] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm motion-safe:animate-pulse">Editing</span>}
          {showFillerMeasurement && installedFillerWidth != null && (
            <span data-testid={fillerExceedsMaximum ? "elevation-filler-overmaximum" : "elevation-filler-measurement"} role={fillerExceedsMaximum ? "alert" : "status"} className={`pointer-events-none absolute left-1/2 top-0 z-30 inline-flex -translate-x-1/2 -translate-y-[calc(100%+5px)] items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.86)] ${fillerExceedsMaximum ? "border-red-200 bg-red-700" : "border-violet-200 bg-violet-800"}`} title={fillerExceedsMaximum ? `Installed filler width ${formatEighthInches(installedFillerWidth)} exceeds catalog maximum ${formatEighthInches(fillerRange!.max)}` : `Installed filler width ${formatEighthInches(installedFillerWidth)}; catalog maximum ${formatEighthInches(fillerRange?.max ?? installedFillerWidth)}`}>
              FILLER {formatEighthInches(installedFillerWidth)} · MAX {formatEighthInches(fillerRange?.max ?? installedFillerWidth)}{fillerExceedsMaximum ? " · OVER MAX" : ""}
            </span>
          )}
          {/* Always render the DoorFront panel structure so the face frame is
              visible. When a door sample image is available, it's applied as the
              background of individual door/drawer panels (not the full face). */}
          {!isAppliance && !showProfileFallback && !refrigeratorEndPanel && (
            <DoorFront
              kind={cabPanelKind}
              edge={edgeColor}
              face={cabFinish.face}
              doors={displayCounts.doors}
              drawers={displayCounts.drawers}
              isWall={isWall}
              doorSampleUrl={cabDoorSampleUrl}
              drawerSampleUrl={cabDrawerSampleUrl}
              cabinetType={cabType}
              blindOnLeft={blindLeft}
              cabinetHeightIn={height}
              cabinetWidthIn={sizeAlong}
              faceFillOverride={faceFill}
              ovenType={p.ovenType ?? null}
              openingType={p.openingType ?? null}
              doorHeight={p.doorHeight ?? null}
              drawerHeight={p.drawerHeight ?? null}
              doorOrientation={p.doorOrientation ?? null}
              layoutSpec={p.layoutSpec ?? null}
              drawerLayout={p.drawerLayout ?? null}
              masterCode={p.masterCode}
	              graphicType={customProfile}
	              category={cabType === "pantry" ? "Tall" : undefined}
	              placementType={p.placement}
	              description={p.description}
	              numberOfDoors={displayCounts.doors}
	              numberOfDrawers={displayCounts.drawers}
              facePattern={p.facePattern ?? null}
	              shelfCount={visibleGlassShelfCount}
	              glassDoor={isGlassDoor}
              frameInsetPx={cabFrameInset ?? undefined}
              frameMetrics={cabFrameMetrics ?? undefined}
              farmhouseSinkBase={Boolean(farmhouseFace)}
            />
          )}
          {showProfileFallback && (
            <CustomProfileFace
              profile={customProfile ?? "standard"}
              face={cabFinish.face}
              edge={edgeColor}
              kind={cabPanelKind}
	              fixedShelves={kitchenCrestGenericShelfCount ?? p.fixedShelfCount ?? 0}
	              adjustableShelves={p.adjustableShelfCount ?? 0}
	              squareOpenEndShelf={kitchenCrestGenericShelfCount != null}
              doorSampleUrl={cabDoorSampleUrl}
              drawerSampleUrl={cabDrawerSampleUrl}
              faceWidthIn={p.width}
              faceHeightIn={p.height}
            />
          )}
          {applianceVisualUrl && (
            <img
              src={applianceVisualUrl}
              alt={p.description || p.masterCode}
              className="absolute inset-0 h-full w-full object-fill bg-transparent"
              draggable={false}
              style={{ zIndex: 3 }}
            />
          )}
          {!isAppliance && cabType !== "range-hood-front" && hw.id !== "none" && (() => {
            const overlay = (faceWidthIn: number) => (
              <HardwareOverlay
                doors={displayCounts.doors}
                drawers={displayCounts.drawers}
                doorPiece={hw.doorPiece}
                drawerPiece={hw.drawerPiece}
                accent={hardwareAccent}
                hardwarePosition={resolveCabinetHardwarePosition(p)}
                raisedDoorPullOnRail={usesRaisedFloorWallDoorPull(p)}
                swing={resolveSwing(p)}
                isWall={isWall}
                faceWidthIn={faceWidthIn}
                frameStileIn={cabFrameMetrics?.stileInches}
                frameRailIn={cabFrameMetrics?.railInches}
                cabinetHeightIn={height}
                doorBandStartPct={farmhouseFace ? farmhouseFace.apronZonePct : undefined}
                pantryLayout={pantryDrawerFrontLayout({ ...p, placementType: p.placement, graphicType: customProfile, numberOfDoors: displayCounts.doors, numberOfDrawers: displayCounts.drawers }, height)}
              />
            );
            // A blind corner has one operating door: the exposed 60% of its face. The other 40% is the
            // hidden blind panel in the room corner. Hardware measured on the whole face landed on that
            // panel, so the overlay is confined to the same visible-door box DoorFront draws.
            if (cabType === "blind-corner") {
              return (
                <div
                  data-blind-door-hardware={blindLeft ? "left" : "right"}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={blindLeft ? { right: 0, width: "60%" } : { left: 0, width: "60%" }}
                >
                  {overlay(sizeAlong * 0.6)}
                </div>
              );
            }
            return overlay(sizeAlong);
          })()}
          {/* Appliance-specific detail overlays */}
          {!applianceVisualUrl && isAppliance && /^FRIDGE-/i.test(p.masterCode ?? "") && (
            <>
              {/* Fridge body: two-door french-door style split at 65% from bottom */}
              {/* Bottom freezer drawer line */}
              <div className="absolute left-0 right-0" style={{ bottom: "35%", height: 2, background: "rgba(80,90,110,0.55)" }} />
              {/* Center vertical divider for upper fridge doors */}
              <div className="absolute top-0" style={{ left: "50%", width: 2, bottom: "35%", background: "rgba(80,90,110,0.55)", transform: "translateX(-50%)" }} />
              {/* Left door handle — vertical bar near right edge of left door */}
              <div
                className="absolute rounded-full"
                style={{
                  left: "calc(50% - 10px)",
                  top: "8%",
                  width: 4,
                  bottom: "38%",
                  background: "linear-gradient(90deg, #8a9ab0 0%, #c8d4e0 40%, #a0b0c4 100%)",
                  boxShadow: "1px 0 2px rgba(0,0,0,0.30), -1px 0 1px rgba(255,255,255,0.25)",
                  borderRadius: 3,
                }}
              />
              {/* Right door handle — vertical bar near left edge of right door */}
              <div
                className="absolute rounded-full"
                style={{
                  left: "calc(50% + 6px)",
                  top: "8%",
                  width: 4,
                  bottom: "38%",
                  background: "linear-gradient(90deg, #8a9ab0 0%, #c8d4e0 40%, #a0b0c4 100%)",
                  boxShadow: "1px 0 2px rgba(0,0,0,0.30), -1px 0 1px rgba(255,255,255,0.25)",
                  borderRadius: 3,
                }}
              />
              {/* Freezer drawer handle — horizontal bar centered */}
              <div
                className="absolute"
                style={{
                  left: "20%",
                  right: "20%",
                  bottom: "calc(35% + 6px)",
                  height: 4,
                  background: "linear-gradient(180deg, #8a9ab0 0%, #c8d4e0 40%, #a0b0c4 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.30), 0 -1px 1px rgba(255,255,255,0.25)",
                  borderRadius: 3,
                }}
              />
            </>
          )}
          {!applianceVisualUrl && isAppliance && /^(DW|WINE)-/i.test(p.masterCode ?? "") && (
            <>
              {/* Dishwasher / wine cooler: control panel strip at top */}
              <div className="absolute left-0 right-0 top-0" style={{ height: "12%", background: "linear-gradient(180deg, #b0bac8 0%, #8a96a8 100%)", borderBottom: "1px solid rgba(60,70,90,0.4)" }} />
              {/* Door handle — horizontal bar below control panel */}
              <div
                className="absolute"
                style={{
                  left: "15%",
                  right: "15%",
                  top: "14%",
                  height: 4,
                  background: "linear-gradient(180deg, #8a9ab0 0%, #c8d4e0 40%, #a0b0c4 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.30), 0 -1px 1px rgba(255,255,255,0.25)",
                  borderRadius: 3,
                }}
              />
            </>
          )}
          {!applianceVisualUrl && isAppliance && /^MW[-_]?/i.test(p.masterCode ?? "") && (
            <div data-microwave-front="true" className="absolute inset-[5%] overflow-hidden rounded-sm" style={{ background: "linear-gradient(145deg, #e8edf1 0%, #aeb8c3 26%, #f5f7f9 62%, #8f9aa6 100%)", border: "1px solid #657180", boxShadow: "inset 0 1px 0 rgba(255,255,255,.75), 0 1px 2px rgba(0,0,0,.24)" }}>
              <div data-microwave-vent="true" className="absolute inset-x-[8%] top-[7%] h-[9%]" style={{ background: "repeating-linear-gradient(90deg, #4b5662 0 2px, transparent 2px 5px)", opacity: 0.72 }} />
              <div data-microwave-glass="true" className="absolute left-[8%] top-[22%] bottom-[17%] w-[65%] rounded-sm" style={{ background: "linear-gradient(145deg, #09131d 0%, #263746 40%, #0a1118 100%)", border: "2px solid #6e7b88", boxShadow: "inset 0 0 12px rgba(126,180,220,.2)" }} />
              <div data-microwave-control-panel="true" className="absolute right-[7%] top-[23%] bottom-[18%] w-[14%] rounded-sm" style={{ background: "linear-gradient(180deg, #cbd3dc, #8995a1)", border: "1px solid #687583" }}>
                <div className="absolute left-[22%] right-[22%] top-[10%] h-[12%] rounded-sm" style={{ background: "#0d1a25" }} />
                {["34%", "50%", "66%"].map((top) => <div key={top} className="absolute left-1/2 h-[7%] w-[38%] -translate-x-1/2 rounded-full" style={{ top, background: "#526170" }} />)}
              </div>
              <div data-microwave-handle="true" className="absolute left-[16%] right-[30%] bottom-[8%] h-[6%] rounded-full" style={{ background: "linear-gradient(180deg, #6e7b88, #d5dbe1 45%, #667381)", boxShadow: "0 1px 2px rgba(0,0,0,.35)" }} />
            </div>
          )}
          {!applianceVisualUrl && isAppliance && /^RANGE-/i.test(p.masterCode ?? "") && (
            <>
              {/* The lower chassis aligns exactly with adjacent 34½-inch bases.
                  Rear-control models receive a separate raised backguard, while
                  front-control ranges keep every control on the chassis face. */}
              <div
                data-range-chassis="true"
                data-range-finish={rangeAppearance?.finish ?? "stainless"}
                data-range-fuel={rangeAppearance?.fuel ?? "electric"}
                data-range-control-position={rangeAppearance?.controlPosition ?? "rear"}
                className="absolute inset-x-0 bottom-0"
                style={{
                  height: `${Math.min(100, (rangeChassisHeight / Math.max(displayedHeight, 0.01)) * 100)}%`,
                  background: faceFill,
                  border: "1px solid rgba(42,52,64,0.58)",
                }}
              >
                <div data-range-cooktop-edge="true" className="absolute inset-x-0 top-0" style={{ height: 4, background: "rgba(38,48,60,0.42)" }} />
                <div
                  className="absolute left-[15%] right-[15%]"
                  style={{
                    top: rangeAppearance?.controlPosition === "front" ? "30%" : "21%",
                    height: 4,
                    background: "linear-gradient(180deg, #8a9ab0 0%, #c8d4e0 40%, #a0b0c4 100%)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.30), 0 -1px 1px rgba(255,255,255,0.25)",
                    borderRadius: 3,
                  }}
                />
                <div className="absolute" style={{ left: "10%", right: "10%", top: rangeAppearance?.controlPosition === "front" ? "43%" : "33%", bottom: "11%", background: "rgba(30,40,60,0.35)", border: "1px solid rgba(80,90,110,0.40)", borderRadius: 2 }} />
                {rangeAppearance?.controlPosition === "front" && (
                  <div data-range-front-control-panel="true" className="absolute inset-x-0 top-0" style={{ height: "23%", background: rangeAppearance.finish === "black" ? "linear-gradient(180deg, #343b44 0%, #10151b 100%)" : rangeAppearance.finish === "black-stainless" ? "linear-gradient(180deg, #59616a 0%, #1c2229 100%)" : rangeAppearance.finish === "white" ? "linear-gradient(180deg, #f9fafb 0%, #d9dde1 100%)" : "linear-gradient(180deg, #abb5c0 0%, #707b88 100%)", borderBottom: "2px solid rgba(42,52,64,0.7)" }} />
                )}
                {(rangeAppearance?.fuel === "gas" ? ["14%", "31%", "50%", "69%", "86%"] : ["18%", "34%", "66%", "82%"]).map((left, index) => (
                  <div key={index} data-range-control={rangeAppearance?.fuel === "gas" ? "gas-knob" : "electric-control"} data-range-control-position={rangeAppearance?.controlPosition ?? "rear"} className="absolute rounded-full" style={{ left: `calc(${left} - ${rangeAppearance?.fuel === "gas" ? 6 : 5}px)`, top: rangeAppearance?.controlPosition === "front" ? "7%" : "6%", width: rangeAppearance?.fuel === "gas" ? 12 : 10, height: rangeAppearance?.fuel === "gas" ? 12 : 10, border: "1px solid rgba(50,60,72,0.85)", background: rangeAppearance?.fuel === "gas" ? "radial-gradient(circle at 35% 28%, #f0f2f4 0%, #7e8792 58%, #2d343c 100%)" : "radial-gradient(circle at 35% 30%, #e4e8eb 0%, #8994a0 65%, #5f6976 100%)" }} />
                ))}
                {rangeAppearance?.controlPosition === "front" && (
                  <div data-range-front-control-display="true" className="absolute" style={{ left: "42%", right: "42%", top: "8%", height: "8%", background: "linear-gradient(180deg, #111820, #28333e)", border: "1px solid rgba(210,220,230,0.25)", borderRadius: 2 }} />
                )}
              </div>
              {hasRangeBackguard && (
                <div data-range-rear-backguard="true" className="absolute inset-x-[8%] top-0" style={{ height: `${Math.max(0, ((STD.RANGE_BACKGUARD_TOP - STD.RANGE_COOKING_SURFACE_HEIGHT) / Math.max(displayedHeight, 0.01)) * 100)}%`, background: rangeAppearance?.finish === "black" ? "linear-gradient(180deg, #343b44 0%, #10151b 100%)" : rangeAppearance?.finish === "black-stainless" ? "linear-gradient(180deg, #59616a 0%, #1c2229 100%)" : rangeAppearance?.finish === "white" ? "linear-gradient(180deg, #f9fafb 0%, #d9dde1 100%)" : "linear-gradient(180deg, #abb5c0 0%, #707b88 100%)", border: "1px solid rgba(42,52,64,0.7)", borderBottom: "2px solid rgba(42,52,64,0.7)" }}>
                  <div data-range-rear-control-display="true" className="absolute" style={{ left: "29%", right: "29%", top: "20%", height: "28%", background: "linear-gradient(180deg, #111820, #28333e)", border: "1px solid rgba(210,220,230,0.25)", borderRadius: 2 }} />
                </div>
              )}
            </>
          )}
          {!applianceVisualUrl && isAppliance && /^HOOD-/i.test(p.masterCode ?? "") && (
            <>
              {/* Measured 2D hood: chimney, canopy, and baffle lines. */}
              <div className="absolute" style={{ left: "34%", right: "34%", top: 0, height: "38%", background: "linear-gradient(90deg, #9ba7b4, #e8edf2 45%, #929eab)", border: "1px solid #697684" }} />
              <div className="absolute" style={{ left: "8%", right: "8%", top: "32%", height: "42%", clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0 100%)", background: "linear-gradient(180deg, #f3f6f8, #aab5c0 78%, #778491)", border: "1px solid #667483" }} />
              <div className="absolute" style={{ left: "18%", right: "18%", top: "61%", height: 3, background: "#4d5965", boxShadow: "0 4px 0 #4d5965, 0 8px 0 #4d5965" }} />
            </>
          )}
          {showProductCodes && !applianceVisualUrl && <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
            <span className="text-[8px] font-bold truncate px-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" style={{ color: isAppliance ? "#1a2744" : cabFinish.label, ...textFlip }}>
              {p.masterCode}
            </span>
          </div>}
        </div>
      </div>
    );
  };

  const handleWallPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragUid) return;
    const cabinet = cabinets.find((c) => c.uid === dragUid);
    if (!cabinet) return;
    const wallEl = wallInnerRef.current;
    if (!wallEl) return;
    const wallRect = wallEl.getBoundingClientRect();
    // Decide the gesture axis once, from the first meaningful movement. Vertical
    // adjustment is only offered for WALL cabinets with an onMoveVertical hook.
    const canVertical = cabinet.placement === "wall" && !!onMoveVertical;
    if (dragAxis.current == null) {
      const dy = Math.abs(e.clientY - vDragStartY.current);
      const alongClient = e.clientX;
      const alongStart = wallRect.left + dragOffset.current;
      const dAlong = Math.abs(alongClient - alongStart);
      if (canVertical && dy > dAlong && dy > 3) dragAxis.current = "vertical";
      else if (dAlong > 3) dragAxis.current = "along";
    }
    // ── Vertical (mount-height) drag ─────────────────────────────────────────
    if (dragAxis.current === "vertical" && canVertical && onMoveVertical) {
      // Screen Y grows downward but mount height grows upward, so invert dy.
      const dyIn = (vDragStartY.current - e.clientY) / ppi;
      const { height } = elevationBox(cabinet, room);
      const maxBottom = Math.max(0, WALL_TOTAL_HEIGHT - height);
      let nextBottom = vDragStartBottom.current + dyIn;
      nextBottom = Math.max(0, Math.min(maxBottom, nextBottom));
      // Snap to the standard mount line (54") and the upper-run top line so it
      // is easy to line back up with neighbors.
      const SNAP_IN = 1.5;
      for (const guide of [STD.WALL_MOUNT_BOTTOM]) {
        if (Math.abs(nextBottom - guide) <= SNAP_IN) nextBottom = guide;
      }
      onMoveVertical(dragUid, Math.round(nextBottom * 10) / 10);
      return;
    }
    if (!onMove) return;
    const sizeAlong = wallRunSpan(cabinet, side, room);
    const planSpanLen = wallLength(side as WallSide, room);
    const pxAlong = e.clientX - wallRect.left - dragOffset.current;
    let newAlong = pxAlong / ppi;
    newAlong = Math.max(0, Math.min(newAlong, planSpanLen - sizeAlong));

    // Neighbours on the SAME wall that occupy the SAME vertical band as the
    // dragged cabinet (so a wall cabinet can slide freely over a base cabinet,
    // but two base cabinets block each other). Appliances/cabinets that are
    // intentionally allowed to overlap (e.g. a bridge over a microwave, a sink
    // over a sink base, a stacker over its host) are excluded so they don't
    // block the slide.
    const dBox = elevationBox(cabinet, room);
    const dTop = dBox.bottom + dBox.height;
    const bandOverlap = (o: PlacedCabinet) => {
      const oBox = elevationBox(o, room);
      const oTop = oBox.bottom + oBox.height;
      // Two boxes share a vertical band if their [bottom, top] ranges overlap.
      return dBox.bottom < oTop - 0.01 && oBox.bottom < dTop - 0.01;
    };
    const others = cabinets.filter(
      (c) =>
        c.uid !== dragUid &&
        cabinetWall(c, room) === side &&
        bandOverlap(c) &&
        !isStacker(c) &&
        !isStacker(cabinet) &&
        !isBridgeOverRange(cabinet, c) &&
        !isBridgeOverRange(c, cabinet),
    );

    // Build the free interval [lo, hi] the dragged cabinet's START may occupy so
    // it never overlaps a same-band neighbour. We pick the interval that
    // contains the raw target; if the target lands inside a neighbour, clamp to
    // the nearest free edge (this makes the cabinet STOP against its neighbour
    // rather than passing through).
    const SNAP = 2;
    let lo = 0;
    let hi = planSpanLen - sizeAlong;
    for (const o of others) {
      const oAlong = wallRunOffset(o, side, room);
      const oSize = wallRunSpan(o, side, room);
      const leftLimit = oAlong - sizeAlong; // start must be <= this to sit left of o
      const rightLimit = oAlong + oSize; // start must be >= this to sit right of o
      const center = newAlong + sizeAlong / 2;
      const oCenter = oAlong + oSize / 2;
      if (center <= oCenter) {
        // dragged cabinet is to the LEFT of this neighbour → cap the high edge
        hi = Math.min(hi, leftLimit);
      } else {
        // to the RIGHT → raise the low edge
        lo = Math.max(lo, rightLimit);
      }
    }
    if (lo <= hi) {
      newAlong = Math.max(lo, Math.min(newAlong, hi));
    }
    // Gentle magnet: if we're within SNAP of a neighbour edge, sit flush.
    for (const o of others) {
      const oAlong = wallRunOffset(o, side, room);
      const oSize = wallRunSpan(o, side, room);
      if (Math.abs(newAlong + sizeAlong - oAlong) <= SNAP) newAlong = oAlong - sizeAlong;
      if (Math.abs(newAlong - (oAlong + oSize)) <= SNAP) newAlong = oAlong + oSize;
    }
    newAlong = Math.max(0, Math.min(newAlong, planSpanLen - sizeAlong));
    const spot = wallPlacementAt(newAlong, cabinet.width, cabinet.depth, side as WallSide, room, cabinet.peninsulaSide);
    onMove(dragUid, spot.x, spot.y);
  };

  const handleWallPointerUp = (e?: React.PointerEvent) => {
    if (capturedPointerId.current != null && wallInnerRef.current) {
      try { wallInnerRef.current.releasePointerCapture(capturedPointerId.current); } catch { /* already released */ }
      capturedPointerId.current = null;
    }
    setDragUid(null);
    dragAxis.current = null;
  };

  // ── Keyboard nudging ───────────────────────────────────────────────────────
  // With a cabinet selected, Arrow Left/Right move it ALONG the wall and Arrow
  // Up/Down change its mount height (wall cabinets only). Shift = coarse (3"),
  // otherwise fine (0.5"). Disabled while the layout is locked.
  useEffect(() => {
    if (moveLocked || !selectedUid) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/select or contenteditable.
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
      if (tgt && tgt.isContentEditable) return;
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      const cab = cabinets.find((c) => c.uid === selectedUid);
      if (!cab || cabinetWall(cab, room) !== side) return;
      const step = e.shiftKey ? 3 : 0.5;
      // Horizontal (along-wall) nudge.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!onMove) return;
        e.preventDefault();
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const sizeAlong = wallRunSpan(cab, side, room);
        const planSpanLen = wallLength(side as WallSide, room);
        const cur = wallRunOffset(cab, side, room);
        const next = Math.max(0, Math.min(planSpanLen - sizeAlong, cur + dir * step));
        const spot = wallPlacementAt(next, cab.width, cab.depth, side as WallSide, room, cab.peninsulaSide);
        onMove(cab.uid, spot.x, spot.y);
        return;
      }
      // Vertical (mount-height) nudge — wall cabinets only.
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && cab.placement === "wall" && onMoveVertical) {
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? 1 : -1;
        const { bottom, height } = elevationBox(cab, room);
        const maxBottom = Math.max(0, WALL_TOTAL_HEIGHT - height);
        const next = Math.max(0, Math.min(maxBottom, bottom + dir * step));
        onMoveVertical(cab.uid, Math.round(next * 10) / 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveLocked, selectedUid, cabinets, room, side, onMove, onMoveVertical, WALL_TOTAL_HEIGHT]);

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden select-none touch-none"
      style={{ background: "linear-gradient(180deg, #e8e4de 0%, #f0ece6 40%, #ede9e3 100%)" }}
      onClick={() => onSelect(null)}
    >
      {/* Centering wrapper: positions the wall + floor assembly in the vertical
          center of the viewport so it doesn't float to the bottom on tall/narrow
          mobile screens. */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: wallPxW,
          height: wallPxH + PADDING,
        }}
      >
        {/* Floor plane */}
        {(() => {
          const fm = flooringMaterial(flooringMaterialId);
          if (!realistic) {
            // Simplified: flat color strip, no pattern
            return (
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  bottom: 0,
                  height: PADDING,
                  background: fm.fill,
                  borderTop: `2px solid color-mix(in srgb, ${fm.fill} 50%, #000000)`,
                }}
              />
            );
          }
          // Realistic: staggered plank joints
          const plankW = Math.max(12, fm.tileW * ppi * 0.7);
          const plankH = Math.max(6, Math.min(PADDING / 2.5, fm.tileH * ppi * 0.15));

          let bgImage: string;
          let bgSize: string | undefined;
          const g = fm.grout;

          if (fm.pattern === "hardwood" || fm.pattern === "plank") {
            const offset = Math.round(plankW / 3);
            const h2 = plankH * 2;
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${plankW}' height='${h2}'>`
              + `<rect x='0' y='0' width='${plankW}' height='${h2}' fill='none'/>`
              + `<line x1='0' y1='0' x2='${plankW}' y2='0' stroke='${g}' stroke-width='0.7' opacity='0.6'/>`
              + `<line x1='0' y1='${plankH}' x2='${plankW}' y2='${plankH}' stroke='${g}' stroke-width='0.7' opacity='0.6'/>`
              + `<line x1='0' y1='0' x2='0' y2='${plankH}' stroke='${g}' stroke-width='0.5' opacity='0.5'/>`
              + `<line x1='${offset}' y1='${plankH}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='0.5' opacity='0.5'/>`
              + `</svg>`;
            bgImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            bgSize = `${plankW}px ${h2}px`;
          } else if (fm.pattern === "tile-stagger") {
            const offset = Math.round(plankW / 2);
            const h2 = plankH * 2;
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${plankW}' height='${h2}'>`
              + `<rect x='0' y='0' width='${plankW}' height='${h2}' fill='none'/>`
              + `<line x1='0' y1='0' x2='${plankW}' y2='0' stroke='${g}' stroke-width='0.8'/>`
              + `<line x1='0' y1='${plankH}' x2='${plankW}' y2='${plankH}' stroke='${g}' stroke-width='0.8'/>`
              + `<line x1='0' y1='0' x2='0' y2='${plankH}' stroke='${g}' stroke-width='0.6'/>`
              + `<line x1='${offset}' y1='${plankH}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='0.6'/>`
              + `</svg>`;
            bgImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            bgSize = `${plankW}px ${h2}px`;
          } else if (fm.pattern === "tile-grid" || fm.pattern === "tile-diagonal") {
            const tw = Math.max(10, plankW * 0.8);
            const th = Math.max(8, plankH * 1.2);
            bgImage = `repeating-linear-gradient(0deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(90deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${tw}px)`;
            bgSize = undefined;
          } else if (fm.pattern === "herringbone" || fm.pattern === "chevron") {
            const angle = fm.pattern === "chevron" ? 60 : 45;
            bgImage = `repeating-linear-gradient(${angle}deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${plankH}px), repeating-linear-gradient(-${angle}deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${plankH}px)`;
            bgSize = undefined;
          } else {
            bgImage = "none";
            bgSize = undefined;
          }

          const grainOverlay = (fm.pattern === "hardwood" || fm.pattern === "plank")
            ? ", repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)"
            : "";

          return (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                bottom: 0,
                height: PADDING,
                background: `linear-gradient(180deg, color-mix(in srgb, ${fm.fill} 92%, #ffffff) 0%, ${fm.fill} 35%, color-mix(in srgb, ${fm.fill} 88%, #000000) 100%)`,
                backgroundImage: bgImage !== "none" ? bgImage + grainOverlay : grainOverlay || undefined,
                backgroundSize: bgSize,
                borderTop: `2px solid color-mix(in srgb, ${fm.fill} 50%, #000000)`,
                boxShadow: "inset 0 6px 12px -4px rgba(0,0,0,0.35)",
              }}
            />
          );
        })()}
        {/* Soft contact shadow where the wall/cabinets meet the floor (realistic only). */}
        {realistic && (
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: PADDING - 2,
              height: 8,
              left: 0,
              width: wallPxW,
              background: "linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0) 100%)",
            }}
          />
        )}
        <div
          ref={wallInnerRef}
          className="absolute"
          onPointerMove={handleWallPointerMove}
          onPointerUp={handleWallPointerUp}
          onPointerLeave={handleWallPointerUp}
          style={{
            width: wallPxW,
            height: wallPxH,
            left: 0,
            bottom: PADDING,
            background: "linear-gradient(180deg, #f2ede7 0%, #ede8e2 50%, #e8e3dd 100%)",
            borderLeft: "2px solid #1a2744",
            borderRight: "2px solid #1a2744",
            borderTop: "2px solid #1a2744",
          }}
        >
        <div className="absolute left-0 right-0 bottom-0 border-b-[3px] border-[#1a2744]" />
        {/* Sloped ceiling overlay: when this wall has an angled ceiling, shade the
            dead space above the slope line (outside the room) and draw the slope
            as a solid ceiling line. The wall box height equals the HIGH end, so
            the slope drops from the high corner down to (ceilHigh-low) above the
            box bottom on the low side. */}
        {sloped && (() => {
          const W = wallPxW;
          const H = wallPxH;
          // y from the TOP of the box for each end (0 = box top = high ceiling).
          const yLeft = (ceilHigh - heightLeft) * ppi;
          const yRight = (ceilHigh - heightRight) * ppi;
          return (
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible"
              width={W}
              height={H}
              style={{ left: 0, top: 0 }}
            >
              {/* Dead space above the ceiling (outside the room). */}
              <polygon
                points={`0,0 ${W},0 ${W},${yRight} 0,${yLeft}`}
                fill="#c9d2de"
                opacity={0.85}
              />
              {/* Hatch to read clearly as "outside / above ceiling". */}
              <polygon
                points={`0,0 ${W},0 ${W},${yRight} 0,${yLeft}`}
                fill="url(#slopeHatch)"
              />
              <defs>
                <pattern id="slopeHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#8a98ad" strokeWidth="1" opacity="0.5" />
                </pattern>
              </defs>
              {/* The sloped ceiling line itself. */}
              <line x1={0} y1={yLeft} x2={W} y2={yRight} stroke="#1a2744" strokeWidth={3} />
            </svg>
          );
        })()}
        {/* Ceiling line label so the chosen ceiling height is visible at a glance.
            Shows both ends when the ceiling is sloped. */}
        <div className="absolute -top-[14px] right-0 text-[9px] font-medium text-[#1a2744]/70" style={textFlip}>
          {sloped
            ? t("dt_ev_ceiling_slope", { hi: Math.round(ceilHigh), lo: Math.round(Math.min(heightLeft, heightRight)) })
            : WALL_TOTAL_HEIGHT < roomCeiling(room) - 0.001
              ? t("dt_ev_wall_top", { n: Math.round(WALL_TOTAL_HEIGHT), c: Math.round(roomCeiling(room)) })
              : t("dt_ev_ceiling", { n: Math.round(WALL_TOTAL_HEIGHT) })}
        </div>
        {/* Countertop band: a thin colored slab sitting on top of the base run,
            its top edge on the 36" counter line, colored by the chosen material.
            Drawn as one band PER CONTIGUOUS RUN of base cabinets + dishwasher-height
            appliances (DW-*). Tall appliances like the refrigerator are excluded so
            the counter breaks at the fridge but bridges over the dishwasher. */}
        {countertopMaterialId && (() => {
          const mat = countertopMaterial(countertopMaterialId);
          const THICKNESS_IN = 1.5;
          const OVERHANG_IN = 0.75; // a little nosing past the cabinet faces
          const TOL = 1.5; // inches: treat near-touching base cabinets as one run
          // The countertop runs over base cabinets AND bridges over the
          // DISHWASHER (a DW tucks UNDER the counter). It must BREAK at the
          // RANGE (a slide-in/free-standing range has its own cooktop surface,
          // no counter over it) and at the FRIDGE (full-height, tall). So only
          // DW-* appliances are bridgeable here — RANGE and FRIDGE are excluded.
          const isBridgeable = (p: PlacedCabinet) => bearsCountertop(p) || isBaseHeightAppliance(p);
          // Base-cabinet spans along this wall, sorted by start position.
          const spans = sorted
            .filter(isBridgeable)
            .map((p) => {
              const sizeAlong = wallRunSpan(p, side, room);
              const posAlong = wallRunOffset(p, side, room);
              return { start: posAlong, end: posAlong + sizeAlong };
            })
            .sort((a, b) => a.start - b.start);
          // Refrigerator end panels belong to the refrigerator column. A counter
          // can meet an OUTSIDE panel face, but it must never overhang through the
          // panel toward the refrigerator opening.
          const refrigeratorPanels = sorted
            .filter((p) => p.placement === "tall" && /(?:REPV|FRIDGE.*PANEL|REFRIGERATOR.*PANEL|END.*PANEL)/i.test(`${p.masterCode ?? ""} ${p.description ?? ""}`))
            .map((p) => {
              const sizeAlong = wallRunSpan(p, side, room);
              const posAlong = wallRunOffset(p, side, room);
              return { start: posAlong, end: posAlong + sizeAlong };
            });
          if (spans.length === 0) return null;
          // Merge adjacent/overlapping spans into contiguous runs; a gap larger
          // than TOL (e.g. where the fridge sits) breaks the counter.
          const runs: { start: number; end: number }[] = [];
          for (const s of spans) {
            const last = runs[runs.length - 1];
            if (last && s.start <= last.end + TOL) {
              last.end = Math.max(last.end, s.end);
            } else {
              runs.push({ start: s.start, end: s.end });
            }
          }
          return (
            <>
              {runs.map((r, i) => (
                <div
                  key={`ct${i}`}
                  className="absolute z-20 pointer-events-none rounded-[1px]"
                  style={{
                    left: (r.start - (refrigeratorPanels.some((panel) => Math.abs(panel.end - r.start) <= TOL) ? 0 : OVERHANG_IN)) * ppi,
                    width: (r.end - r.start + (refrigeratorPanels.some((panel) => Math.abs(panel.end - r.start) <= TOL) ? 0 : OVERHANG_IN) + (refrigeratorPanels.some((panel) => Math.abs(panel.start - r.end) <= TOL) ? 0 : OVERHANG_IN)) * ppi,
                    bottom: Math.ceil(STD.BASE_HEIGHT * ppi),
                    height: THICKNESS_IN * ppi,
                    ...(realistic ? {
                      background: mat.speckle
                        ? `linear-gradient(180deg, color-mix(in srgb, ${mat.fill} 80%, #ffffff) 0%, ${mat.fill} 45%, color-mix(in srgb, ${mat.fill} 90%, #000000) 100%)`
                        : `linear-gradient(180deg, color-mix(in srgb, ${mat.fill} 82%, #ffffff) 0%, ${mat.fill} 55%, color-mix(in srgb, ${mat.fill} 88%, #000000) 100%)`,
                      backgroundImage: mat.speckle
                        ? `repeating-linear-gradient(135deg, transparent 0px, transparent 8px, ${mat.speckle}22 9px, transparent 10px, transparent 22px, ${mat.speckle}18 23px, transparent 24px)`
                        : undefined,
                      borderTop: `1px solid color-mix(in srgb, ${mat.fill} 60%, #ffffff)`,
                      borderBottom: `1px solid ${mat.edge}`,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.1)",
                    } : {
                      background: mat.fill,
                      borderTop: `1px solid ${mat.edge}`,
                      borderBottom: `1px solid ${mat.edge}`,
                    }),
                  }}
                  title={t("dt_ev_countertop", { material: mat.name })}
                />
              ))}
            </>
          );
        })()}

        {/* Waterfall countertop panels: vertical slabs on the left/right side of
            a base cabinet, same material as the countertop, running from the floor
            to the countertop top (36" + 1.5" thickness). Only drawn when a
            countertop material is selected and the cabinet has waterfallLeft/Right. */}
        {countertopMaterialId && (() => {
          const mat = countertopMaterial(countertopMaterialId);
          const SLAB_THICKNESS_IN = 1.5; // same as countertop thickness
          const WATERFALL_TOP = STD.COUNTERTOP_HEIGHT + 1.5; // top of countertop
          const panels: React.ReactNode[] = [];
          for (const p of sorted) {
            if (p.placement !== "base") continue;
            if (!p.waterfallLeft && !p.waterfallRight) continue;
            const sizeAlong = wallRunSpan(p, side, room);
            const posAlong = wallRunOffset(p, side, room);
            const panelStyle: React.CSSProperties = {
              position: "absolute",
              bottom: 0,
              height: WATERFALL_TOP * ppi,
              width: SLAB_THICKNESS_IN * ppi,
              background: mat.speckle
                ? `linear-gradient(90deg, color-mix(in srgb, ${mat.fill} 80%, #ffffff) 0%, ${mat.fill} 45%, color-mix(in srgb, ${mat.fill} 90%, #000000) 100%)`
                : `linear-gradient(90deg, color-mix(in srgb, ${mat.fill} 82%, #ffffff) 0%, ${mat.fill} 55%, color-mix(in srgb, ${mat.fill} 88%, #000000) 100%)`,
              borderLeft: `1px solid color-mix(in srgb, ${mat.fill} 60%, #ffffff)`,
              borderRight: `1px solid ${mat.edge}`,
              boxShadow: "2px 0 4px rgba(0,0,0,0.20), inset 1px 0 0 rgba(255,255,255,0.45)",
              borderRadius: 1,
              zIndex: 19,
              pointerEvents: "none",
            };
            if (p.waterfallLeft) {
              panels.push(
                <div
                  key={`wf-l-${p.uid}`}
                  className="absolute"
                  style={{ ...panelStyle, left: (posAlong - SLAB_THICKNESS_IN) * ppi }}
                  title={`Waterfall Left — ${mat.name}`}
                />
              );
            }
            if (p.waterfallRight) {
              panels.push(
                <div
                  key={`wf-r-${p.uid}`}
                  className="absolute"
                  style={{ ...panelStyle, left: (posAlong + sizeAlong) * ppi }}
                  title={`Waterfall Right — ${mat.name}`}
                />
              );
            }
          }
          return panels.length > 0 ? <>{panels}</> : null;
        })()}

        {/* Backsplash: spans the FULL wall width (corner to corner), 18" tall
            by default. Only stretches taller behind a range (exposed wall above
            the range gets tiled up to wall cabinet bottom line). Wall cabinets/
            microwave/bridge render on top at higher z-index. */}
        {backsplashMaterialId && (() => {
          const bsMat = backsplashMaterial(backsplashMaterialId);
          const BACKSPLASH_BOTTOM = STD.COUNTERTOP_HEIGHT; // 36" — sits on top of the countertop surface
          const BACKSPLASH_STD_HEIGHT = 18; // standard backsplash is 18" tall
          const BACKSPLASH_DEFAULT_TOP = BACKSPLASH_BOTTOM + BACKSPLASH_STD_HEIGHT; // 55.5"
          // Behind a range, stretch backsplash up to wall cabinet bottom (54")
          // or the full wall-cabinet top line if no wall cab sits above.
          const BACKSPLASH_RANGE_TOP = wallCabinetTopLine(room); // 84" on 8ft ceiling

	          // A selected backsplash exists only behind a real countertop/range
	          // support on this solid wall. Use the same base/filler/dishwasher
	          // support spans as 3D so an open wall, peninsula room-side, or bare
	          // floor can never receive a floating field of tile.
	          const runs = elevationCabinets
	            .flatMap((cabinet) => threeDBacksplashSupportSpans(cabinet, side as WallSide, room))
	            .sort((left, right) => left.start - right.start)
	            .reduce<{ start: number; end: number }[]>((merged, run) => {
	              const previous = merged[merged.length - 1];
	              if (previous && run.start <= previous.end + 0.01) previous.end = Math.max(previous.end, run.end);
	              else merged.push({ ...run });
	              return merged;
	            }, []);

          // Identify range positions on this wall for the taller stretch zone.
          const rangeSpans = sorted
            .filter((p) => isRangeOrOven(p.masterCode, p.description))
            .map((p) => {
              const sizeAlong = wallRunSpan(p, side, room);
              const posAlong = wallRunOffset(p, side, room);
              return { start: posAlong, end: posAlong + sizeAlong };
            });

          // Window openings on this wall — backsplash wraps around them
          const winOpenings = viewOpenings.filter((o) => o.kind === "window");
          const tileWPx = Math.max(8, (bsMat.pattern === "subway" ? 16 : bsMat.pattern === "mosaic" ? 5 : 12) * ppi / 12);
          const tileHPx = Math.max(6, (bsMat.pattern === "subway" ? 8 : bsMat.pattern === "mosaic" ? 5 : 12) * ppi / 12);
          // Subway tiles use a staggered brick-lay SVG (offset every other row by
          // half tile width) for realism instead of a simple grid.
          let bgImage: string | undefined;
          let bgSize: string | undefined;
          if (bsMat.pattern === "subway") {
            const tw = tileWPx;
            const th = tileHPx;
            const offset = Math.round(tw / 2);
            const h2 = th * 2;
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
              + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
              + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${bsMat.grout}' stroke-width='1'/>`
              + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${bsMat.grout}' stroke-width='1'/>`
              + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${bsMat.grout}' stroke-width='1'/>`
              + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${bsMat.grout}' stroke-width='1'/>`
              + `</svg>`;
            bgImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            bgSize = `${tw}px ${h2}px`;
          } else if (bsMat.pattern === "mosaic") {
            bgImage = `repeating-linear-gradient(0deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileHPx}px), repeating-linear-gradient(90deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileWPx}px)`;
          } else if (bsMat.pattern === "large-format") {
            bgImage = `repeating-linear-gradient(0deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileHPx * 2}px), repeating-linear-gradient(90deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileWPx * 2}px)`;
          } else if (bsMat.pattern === "herringbone") {
            bgImage = `repeating-linear-gradient(45deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileHPx}px), repeating-linear-gradient(-45deg, ${bsMat.grout} 0px, ${bsMat.grout} 1px, transparent 1px, transparent ${tileHPx}px)`;
          } else if (bsMat.pattern === "hexagon") {
            bgImage = `radial-gradient(circle at 50% 50%, ${bsMat.grout} 1px, transparent 1px)`;
          }

          // Build segments: standard 18" height across the wall, with taller
          // sections behind the range. Window openings are cut out.
          const segments: { left: number; width: number; bottom: number; height: number }[] = [];

          // Helper: does a horizontal position fall within a range span?
          const rangeTopAt = (x: number): number => {
            for (const rs of rangeSpans) {
              if (x >= rs.start && x < rs.end) return BACKSPLASH_RANGE_TOP;
            }
            return BACKSPLASH_DEFAULT_TOP;
          };

          for (const run of runs) {
            const runStart = run.start;
            const runEnd = run.end;

            // Split the run into sub-runs by range boundaries so each sub-run
            // has a uniform top height.
            const breakpoints = new Set<number>([runStart, runEnd]);
            for (const rs of rangeSpans) {
              if (rs.start > runStart && rs.start < runEnd) breakpoints.add(rs.start);
              if (rs.end > runStart && rs.end < runEnd) breakpoints.add(rs.end);
            }
            const bps = Array.from(breakpoints).sort((a, b) => a - b);

            for (let bi = 0; bi < bps.length - 1; bi++) {
              const segStart = bps[bi];
              const segEnd = bps[bi + 1];
              const segTop = rangeTopAt((segStart + segEnd) / 2);

              // Find windows that overlap this sub-segment
              const overlapping = winOpenings.filter(
                (o) => o.offset < segEnd && (o.offset + o.width) > segStart
              );

              if (overlapping.length === 0) {
                // No windows — simple rectangle
                segments.push({
                  left: segStart * ppi,
                  width: (segEnd - segStart) * ppi,
                  bottom: BACKSPLASH_BOTTOM * ppi,
                  height: (segTop - BACKSPLASH_BOTTOM) * ppi,
                });
              } else {
                // Sort windows by offset
                const wins = [...overlapping].sort((a, b) => a.offset - b.offset);
                const minSill = Math.min(...wins.map((w) => w.sill));
                // Below-window strip
                if (minSill > BACKSPLASH_BOTTOM) {
                  segments.push({
                    left: segStart * ppi,
                    width: (segEnd - segStart) * ppi,
                    bottom: BACKSPLASH_BOTTOM * ppi,
                    height: (minSill - BACKSPLASH_BOTTOM) * ppi,
                  });
                }
                // Left of first window
                if (wins[0].offset > segStart) {
                  segments.push({
                    left: segStart * ppi,
                    width: (wins[0].offset - segStart) * ppi,
                    bottom: minSill * ppi,
                    height: (segTop - minSill) * ppi,
                  });
                }
                // Between windows
                for (let wi = 0; wi < wins.length - 1; wi++) {
                  const gapStart = wins[wi].offset + wins[wi].width;
                  const gapEnd = wins[wi + 1].offset;
                  if (gapEnd > gapStart) {
                    segments.push({
                      left: gapStart * ppi,
                      width: (gapEnd - gapStart) * ppi,
                      bottom: minSill * ppi,
                      height: (segTop - minSill) * ppi,
                    });
                  }
                }
                // Right of last window
                const lastWin = wins[wins.length - 1];
                if (lastWin.offset + lastWin.width < segEnd) {
                  segments.push({
                    left: (lastWin.offset + lastWin.width) * ppi,
                    width: (segEnd - (lastWin.offset + lastWin.width)) * ppi,
                    bottom: minSill * ppi,
                    height: (segTop - minSill) * ppi,
                  });
                }
                // Above each window (sill+height to segTop)
                for (const w of wins) {
                  const wTop = w.sill + w.height;
                  if (wTop < segTop) {
                    const wLeft = Math.max(segStart, w.offset);
                    const wRight = Math.min(segEnd, w.offset + w.width);
                    segments.push({
                      left: wLeft * ppi,
                      width: (wRight - wLeft) * ppi,
                      bottom: wTop * ppi,
                      height: (segTop - wTop) * ppi,
                    });
                  }
                }
              }
            }
          }
          return (
            <>
	              {segments.map((seg, i) => (
	                <div
	                  key={`bs${i}`}
	                  data-testid="elevation-backsplash-segment"
	                  data-backsplash-field-coverage="supported"
	                  className="absolute pointer-events-none"
                  style={{
                    left: seg.left,
                    width: seg.width,
                    bottom: seg.bottom,
                    height: seg.height,
                    background: bsMat.fill,
                    backgroundImage: realistic ? bgImage : undefined,
                    backgroundSize: realistic ? (bgSize ?? (bsMat.pattern === "hexagon" ? `${tileWPx}px ${tileHPx}px` : undefined)) : undefined,
                    borderTop: `1px solid ${bsMat.grout}`,
                    borderBottom: `1px solid ${bsMat.grout}`,
                    opacity: 0.85,
                    zIndex: 1,
                  }}
                  title={`Backsplash: ${bsMat.name}`}
                />
              ))}
            </>
          );
        })()}

        {/* Floor contact shadow: a soft dark strip along the bottom of each
            base/tall run so cabinets read as sitting ON the floor rather than
            floating. Drawn BEHIND the cabinet boxes. */}
        {sorted
          .filter((p) => (p.placement === "base" || p.placement === "tall" || p.placement === "appliance") && p.cabinetId !== 0)
          .map((p) => {
            const sizeAlong = wallRunSpan(p, side, room);
            const posAlong = wallRunOffset(p, side, room);
            return (
              <div
                key={`floorshadow-${p.uid}`}
                className="absolute pointer-events-none"
                style={{
                  left: posAlong * ppi - 2,
                  width: sizeAlong * ppi + 4,
                  bottom: -2,
                  height: Math.max(4, 4 * ppi),
                  background: "radial-gradient(ellipse at center bottom, rgba(15,23,42,0.30) 0%, rgba(15,23,42,0.12) 55%, transparent 80%)",
                  zIndex: 0,
                }}
              />
            );
          })}

        {sorted.map((p) => renderCabinetBox(p))}

        {/* Corner cabinets that wrap this corner from the adjoining wall, drawn
            pinned to the seam so a lazy-Susan / diagonal / blind unit shows on
            BOTH walls of the corner view. */}
        {seamCabinets.map((p) => renderCabinetBox(p, true))}

        {/* Duplicate per-cabinet countertop slab removed — the contiguous-run
            countertop renderer above (lines 583-645) already handles the slab
            correctly when a material is selected. The per-cabinet fallback was
            causing an unwanted warm/orange stripe at the top of every base
            cabinet even when no countertop material was chosen. */}

        {/* Faucet: drawn above sink base cabinets (SB-*). Shows a vertical
            riser + horizontal spout + aerator + handle knob sitting on top of
            the countertop so the faucet is visible in Front View even though
            the sink bowl is cut into the counter.
            Skipped when sinkTopType is a range top (gas/electric/smooth-top). */}
        {sorted.filter((p) =>
          isSinkBaseCabinet(p) &&
          p.sinkTopType !== "gas" && p.sinkTopType !== "electric" && p.sinkTopType !== "induction" && p.sinkTopType !== "smooth-top" &&
          // Only show faucet when a sink has been explicitly assigned (sinkTopType === "sink")
          // or when a faucet product was selected. Unassigned SB-* cabinets show no faucet.
          (p.sinkTopType === "sink" || p.faucetProductId != null || p.sinkTopProductId != null)
        ).map((p) => {
          const sizeAlong = wallRunSpan(p, side, room);
          const posAlong = wallRunOffset(p, side, room);
          const centerX = (posAlong + sizeAlong / 2) * ppi;
          const riserH = 8 * ppi;          // 8" riser above countertop
          const spoutW = 4 * ppi;          // 4" horizontal spout arm
          const spoutThick = Math.max(2, 1.5 * ppi);
          const riserThick = Math.max(2, 1.5 * ppi);
          const knobR = Math.max(3, 1.5 * ppi);
          const svgW = spoutW + knobR * 3;
          const svgH = riserH + knobR * 2 + 4;
          return (
            <svg
              key={`faucet-${p.uid}`}
              className="absolute pointer-events-none"
              style={{
                left: centerX - svgW / 2,
                bottom: (STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS) * ppi,
                width: svgW,
                height: svgH,
                overflow: "visible",
                zIndex: 26,
              }}
            >
              {realistic ? (
                <>
                  <defs>
                    <linearGradient id={`faucet-metal-${p.uid}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a8b8c8" />
                      <stop offset="35%" stopColor="#d0dce6" />
                      <stop offset="60%" stopColor="#b8c8d4" />
                      <stop offset="100%" stopColor="#8a9aaa" />
                    </linearGradient>
                  </defs>
                  <ellipse cx={svgW / 2} cy={svgH - 1} rx={riserThick * 1.5} ry={riserThick * 0.5} fill="#7a8a9a" opacity={0.5} />
                  <rect x={svgW / 2 - riserThick / 2} y={svgH - riserH} width={riserThick} height={riserH} fill={`url(#faucet-metal-${p.uid})`} rx={riserThick * 0.3} />
                  <path
                    d={`M ${svgW / 2} ${svgH - riserH} Q ${svgW / 2} ${svgH - riserH - spoutThick * 1.5} ${svgW / 2 - spoutW * 0.4} ${svgH - riserH - spoutThick * 0.8}`}
                    stroke="#a0b0c0" strokeWidth={spoutThick} fill="none" strokeLinecap="round"
                  />
                  <rect x={svgW / 2 - spoutW} y={svgH - riserH - spoutThick * 0.3} width={spoutW * 0.65} height={spoutThick * 0.8} fill={`url(#faucet-metal-${p.uid})`} rx={spoutThick * 0.3} />
                  <rect x={svgW / 2 - spoutW - 1} y={svgH - riserH - spoutThick * 0.1} width={Math.max(3, spoutThick * 0.6)} height={Math.max(3, spoutThick * 1.2)} fill="#5a6a7a" rx={1} />
                  <rect x={svgW / 2 + riserThick * 0.3} y={svgH - riserH * 0.55} width={knobR * 2.2} height={spoutThick * 0.6} fill="#b8c8d8" rx={spoutThick * 0.2} stroke="#8a9aaa" strokeWidth={0.5} />
                  <circle cx={svgW / 2 + riserThick * 0.3} cy={svgH - riserH * 0.55 + spoutThick * 0.3} r={Math.max(2, spoutThick * 0.35)} fill="#8a9aaa" />
                </>
              ) : (
                <>
                  {/* Simplified: basic line-art faucet */}
                  <rect x={svgW / 2 - riserThick / 2} y={svgH - riserH} width={riserThick} height={riserH} fill="#9ca3af" />
                  <rect x={svgW / 2 - spoutW * 0.6} y={svgH - riserH - spoutThick * 0.5} width={spoutW * 0.6} height={spoutThick} fill="#9ca3af" />
                  <circle cx={svgW / 2 + riserThick} cy={svgH - riserH * 0.5} r={knobR * 0.7} fill="#d1d5db" stroke="#9ca3af" strokeWidth={1} />
                </>
              )}
            </svg>
          );
        })}

        {/* Range Top / Cooktop: the burner surface is always 34½" above finished floor.
            Its visible face extends down into the base zone rather than above that line. */}
        {sorted.filter((p) =>
          (isSinkBaseCabinet(p) && (p.sinkTopType === "gas" || p.sinkTopType === "electric" || p.sinkTopType === "induction" || p.sinkTopType === "smooth-top"))
          || (p.placement === "appliance" && p.applianceRole === "countertop-opening")
        ).map((p) => {
          const sizeAlong = wallRunSpan(p, side, room);
          const posAlong = wallRunOffset(p, side, room);
          // The top of this 3½-inch elevation face is the shared 34½" cooking
          // surface. Its body extends below that exact physical surface line.
          const COOKTOP_THICKNESS = 3.5; // inches — visible front face of cooktop
          const panelW = sizeAlong * ppi;
          const panelH = COOKTOP_THICKNESS * ppi;
          const panelLeft = posAlong * ppi;
          const panelBottom = (STD.RANGE_COOKING_SURFACE_HEIGHT - COOKTOP_THICKNESS) * ppi;
          const isGas = p.sinkTopType === "gas" || /\bgas\b/i.test(p.description ?? "");
          const isBlackGlass = p.rangeTopFinish === "black-glass";
          const isSmooth = isBlackGlass || p.sinkTopType === "smooth-top" || p.sinkTopType === "induction" || /induction|smooth|electric/i.test(p.description ?? "");
          // Burner layout: 4 burners in a single row (since the panel is thin/wide)
          const burnerR = Math.max(3, Math.min(panelH * 0.32, panelW / 14));
          const burnerPositions = [
            { cx: panelW * 0.2, cy: panelH * 0.45 },
            { cx: panelW * 0.4, cy: panelH * 0.45 },
            { cx: panelW * 0.6, cy: panelH * 0.45 },
            { cx: panelW * 0.8, cy: panelH * 0.45 },
          ];
          return (
            <svg
              key={`rangetop-${p.uid}`}
              className="absolute pointer-events-none"
              style={{
                left: panelLeft,
                bottom: panelBottom,
                width: panelW,
                height: panelH,
                zIndex: 22,
              }}
            >
              <defs>
                <linearGradient id={`ss-grad-${p.uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e2e6ec"/>
                  <stop offset="40%" stopColor="#c8cdd6"/>
                  <stop offset="100%" stopColor="#a8aebb"/>
                </linearGradient>
                <linearGradient id={`bg-grad-${p.uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a1a1a"/>
                  <stop offset="100%" stopColor="#2a2a2a"/>
                </linearGradient>
              </defs>
              {/* Cooktop face panel */}
              <rect x={0} y={0} width={panelW} height={panelH}
                fill={isSmooth ? `url(#bg-grad-${p.uid})` : `url(#ss-grad-${p.uid})`}
                rx={1} />
              <rect x={0} y={0} width={panelW} height={panelH}
                fill="none" stroke={isSmooth ? "#444" : "#8a9099"} strokeWidth={1.5} rx={1} />
              {/* Control knobs: small dots along the front (bottom edge) */}
              {[0.2, 0.4, 0.6, 0.8].map((xr, i) => (
                <circle key={`knob-${i}`} cx={panelW * xr} cy={panelH * 0.82} r={Math.max(1.5, panelH * 0.08)}
                  fill={isSmooth ? "#555" : "#6b7280"} />
              ))}
              {/* Burners / coils */}
              {burnerPositions.map((b, i) => (
                <g key={i}>
                  {isGas ? (
                    <>
                      <circle cx={b.cx} cy={b.cy} r={burnerR} fill="none" stroke="#666" strokeWidth={Math.max(1, burnerR * 0.2)} />
                      <circle cx={b.cx} cy={b.cy} r={burnerR * 0.5} fill="none" stroke="#666" strokeWidth={Math.max(0.8, burnerR * 0.15)} />
                      <circle cx={b.cx} cy={b.cy} r={burnerR * 0.12} fill="#555" />
                    </>
                  ) : isSmooth ? (
                    <>
                      <circle cx={b.cx} cy={b.cy} r={burnerR} fill="#111" stroke="#444" strokeWidth={0.8} />
                      <circle cx={b.cx} cy={b.cy} r={burnerR * 0.6} fill="none" stroke="#333" strokeWidth={Math.max(0.5, burnerR * 0.1)} />
                    </>
                  ) : (
                    <>
                      <circle cx={b.cx} cy={b.cy} r={burnerR} fill="none" stroke="#c0392b" strokeWidth={Math.max(1, burnerR * 0.22)} />
                      <circle cx={b.cx} cy={b.cy} r={burnerR * 0.6} fill="none" stroke="#c0392b" strokeWidth={Math.max(1, burnerR * 0.18)} />
                    </>
                  )}
                </g>
              ))}
            </svg>
          );
        })}
        {/* Apron-front (farmhouse) sink: a ceramic basin that sits through the
            countertop with its apron visibly dropping over the upper cabinet face.
            The cabinet doors and recessed toe kick remain visible below. */}
        {sorted.filter((p) => isFarmerSinkBase(p)).map((p) => {
          const sizeAlong = wallRunSpan(p, side, room);
          const posAlong = wallRunOffset(p, side, room);
          const geometry = farmhouseSinkElevationGeometry(sizeAlong);
          const apronPxH = geometry.apronHeightIn * ppi;
          const apronPxW = geometry.apronWidthIn * ppi;
          const apronLeft = (posAlong + geometry.sideInsetIn) * ppi;
          const apronBottomPx = geometry.apronBottomIn * ppi;
          // Only a shallow interior is visible in front elevation. The white
          // apron is the primary feature; the dark basin must not consume the
          // entire cabinet face as it did in the generic sink graphic.
          const basinW = geometry.basinWidthIn * ppi;
          const basinH = geometry.basinHeightIn * ppi;
          const basinLeft = (apronPxW - basinW) / 2;
          const basinBottom = apronPxH - basinH - geometry.basinTopInsetIn * ppi;
          return (
            <div
              key={`apron-${p.uid}`}
              className="absolute pointer-events-none"
              data-farm-sink-apron="true"
              data-farm-sink-mounted="countertop"
              style={{
                left: apronLeft,
                width: apronPxW,
                bottom: apronBottomPx,
                height: apronPxH,
                zIndex: 23,
              }}
            >
              {realistic ? (
                <>
                  {/* Realistic: fireclay apron with ceramic sheen */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(180deg, #fafbfc 0%, #f2f4f7 20%, #eaecf0 50%, #e2e5ea 75%, #dce0e6 100%)",
                      borderTop: "2px solid #c0c6cf",
                      borderLeft: "1.5px solid #cdd2da",
                      borderRight: "1.5px solid #cdd2da",
                      borderBottom: "1px solid #b8bec8",
                      borderRadius: "2px 2px 4px 4px",
                      boxShadow: "inset 0 2px 8px rgba(0,0,0,0.06), inset 0 -2px 4px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.12)",
                    }}
                  />
                  <div
                    className="absolute left-[8%] right-[8%]"
                    style={{
                      top: "18%",
                      height: 1,
                      background: "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 20%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.06) 80%, transparent 100%)",
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: basinLeft,
                      width: basinW,
                      bottom: basinBottom,
                      height: basinH,
                      background: "linear-gradient(180deg, #b8c0cc 0%, #a8b0bc 30%, #98a0ac 60%, #909aaa 100%)",
                      borderRadius: "3px 3px 8px 8px",
                      boxShadow: "inset 0 4px 10px rgba(0,0,0,0.28), inset 0 1px 4px rgba(0,0,0,0.18), 0 0 0 1.5px #8a94a4",
                    }}
                  >
                    <div
                      className="absolute"
                      style={{
                        left: "50%",
                        bottom: "12%",
                        width: Math.max(5, 3 * ppi),
                        height: Math.max(5, 3 * ppi),
                        marginLeft: -(Math.max(5, 3 * ppi) / 2),
                        borderRadius: "50%",
                        background: "radial-gradient(circle, #4a5060 0%, #5a6575 40%, #6a7585 70%, #7a8595 100%)",
                        border: "1.5px solid #3a4555",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.15)",
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Simplified: plain white apron with simple basin */}
                  <div className="absolute inset-0" style={{ background: "#f0f2f5", border: "1.5px solid #c0c6cf", borderRadius: 2 }} />
                  <div
                    className="absolute"
                    style={{
                      left: basinLeft,
                      width: basinW,
                      bottom: basinBottom,
                      height: basinH,
                      background: "#b0b8c4",
                      borderRadius: 4,
                      border: "1px solid #8a94a4",
                    }}
                  >
                    <div
                      className="absolute"
                      style={{
                        left: "50%",
                        bottom: "12%",
                        width: Math.max(5, 3 * ppi),
                        height: Math.max(5, 3 * ppi),
                        marginLeft: -(Math.max(5, 3 * ppi) / 2),
                        borderRadius: "50%",
                        background: "#5a6575",
                      }}
                    />
                  </div>
                </>
              )}
              {/* Apron label */}
              {apronPxH > 20 && (
                <div
                  className="absolute inset-0 flex items-end justify-center pointer-events-none"
                  style={{ paddingBottom: basinBottom + basinH + 2, zIndex: 2 }}
                >
                  <span style={{ fontSize: Math.max(7, ppi * 1.8), color: "#8a9bb0", fontWeight: 500, letterSpacing: "0.03em" }}>
                    {p.masterCode}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Crown molding: one continuous band per edge-touching upper run. */}
        {crown && crownRuns.map((run) => {
          const anchor = sorted.find((p) => p.uid === run.anchorUid)!;
          const cabF = finishFor ? finishFor(anchor) : finish;
          return (
            <div
              key={`crown-run-${run.anchorUid}-${run.start}`}
              data-testid="continuous-crown-run"
              data-visible-crown-miter="45"
              className="absolute"
              style={{
                left: run.start * ppi - 2,
                width: (run.end - run.start) * ppi + 4,
                bottom: run.level * ppi,
                height: Math.max(3, CROWN_HEIGHT_IN * ppi),
                background: cabF.face,
                borderTop: `1.5px solid ${cabF.edge}`,
                borderRadius: "2px 2px 0 0",
                clipPath: "polygon(0 0, 100% 0, calc(100% - 4px) 100%, 4px 100%)",
                zIndex: 3,
              }}
              title={t("dt_ev_crown")}
            />
          );
        })}

        {/* Crown-top badge per upper run on this wall; amber when another run on
            the same wall finishes at a different height. */}
        {crownTopRuns(sorted, room).filter((run) => run.wallId === side).map((run) => (
          <div
            key={`crown-top-badge-${run.start}-${run.top}`}
            data-testid="crown-top-badge"
            data-crown-top={run.top}
            data-crown-mismatch={run.mismatch ? "true" : undefined}
            className={`pointer-events-none absolute z-[6] inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-extrabold leading-none shadow ${
              run.mismatch ? "border-amber-300 bg-amber-500 text-white" : "border-slate-300 bg-slate-800 text-white"
            }`}
            style={{
              left: ((run.start + run.end) / 2) * ppi,
              bottom: (run.top + CROWN_HEIGHT_IN) * ppi + 3,
            }}
            title={run.mismatch
              ? `Crown top ${formatCrownTop(run.top)} — another run on this wall finishes at ${run.otherTops.map(formatCrownTop).join(", ")}.`
              : `Crown top ${formatCrownTop(run.top)}`}
          >
            {run.mismatch ? "\u26A0 " : ""}CROWN {formatCrownTop(run.top)}
          </div>
        ))}
        {/* Light rail: slim valance strip under the bottom edge of each wall
            cabinet (hides under-cabinet lighting). */}
        {lightRail && sorted.filter((p) => isLightRailEligibleCabinet(p, room)).map((p) => {
          const sizeAlong = wallRunSpan(p, side, room);
          const posAlong = wallRunOffset(p, side, room);
          const { bottom } = elevationBox(p, room);
          const cabF = finishFor ? finishFor(p) : finish;
          return (
            <div
              key={`lightrail-${p.uid}`}
              data-testid="light-rail-strip"
              className="absolute"
              style={{
                left: posAlong * ppi + 1,
                width: sizeAlong * ppi - 2,
                bottom: (bottom - LIGHT_RAIL_HEIGHT_IN) * ppi,
                height: Math.max(2, LIGHT_RAIL_HEIGHT_IN * ppi),
                background: cabF.face,
                borderBottom: `1px solid ${cabF.edge}`,
                borderRadius: "0 0 2px 2px",
                zIndex: 3,
              }}
              title={t("dt_ev_light_rail")}
            />
          );
        })}

        {/* Physical toe kick: one recessed strip per edge-touching floor run. */}
        {toeKickRuns.map((run) => {
          const toeH = Math.max(3, TOE_KICK_HEIGHT_IN * ppi);
          return (
            <div
              key={`toe-run-${run.anchorUid}-${run.start}`}
              data-testid="continuous-toe-kick-run"
              className="absolute"
              style={{
                left: run.start * ppi + 4,
                width: Math.max(1, (run.end - run.start) * ppi - 8),
                bottom: 0,
                height: toeH,
                // Recessed toe kick: darker than the cabinet face, set back from
                // the front plane. Top shadow simulates the overhang of the base
                // cabinet above it.
                // Fixed dark color — real toe kicks are always painted/stained
                // near-black to hide dirt and visually recede under the cabinet.
                background: toeKick
                  ? `linear-gradient(180deg, ${finish.face} 0%, ${finish.edge} 100%)`
                  : `linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 60%, #1e1e1e 100%)`,
                boxShadow: `inset 0 4px 8px rgba(0,0,0,0.70), inset 0 -1px 0 rgba(255,255,255,0.06)`,
                borderTop: `1.5px solid rgba(0,0,0,0.85)`,
                borderRadius: "0 0 1px 1px",
                zIndex: 4,
              }}
              data-selected-toe-kick-finish={toeKick ? "true" : "false"}
              title={t("dt_ev_toe_kick")}
            />
          );
        })}

        {/* Batten molding: slim vertical strip covering the seam between two
            edge-to-edge cabinets on this wall. */}
        {batten && sorted
          .filter((p) => p.cabinetId !== 0)
          .map((p, i, arr) => {
            if (i === arr.length - 1) return null;
            const next = arr[i + 1];
            const pAlong = wallRunOffset(p, side, room);
            const pSize = wallRunSpan(p, side, room);
            const nextAlong = wallRunOffset(next, side, room);
            const pEnd = pAlong + pSize;
            // Only draw where the two cabinets actually touch (within 1.5").
            if (Math.abs(nextAlong - pEnd) > 1.5) return null;
            const { bottom, height } = elevationBox(p, room);
            const nextBox = elevationBox(next, room);
            const top = Math.max(bottom + height, nextBox.bottom + nextBox.height);
            const base = Math.min(bottom, nextBox.bottom);
            const widthPx = Math.max(3, BATTEN_WIDTH_IN * ppi);
            const cabF = finishFor ? finishFor(p) : finish;
            return (
              <div
                key={`batten-${p.uid}`}
                className="absolute"
                style={{
                  left: pEnd * ppi - widthPx / 2,
                  width: widthPx,
                  bottom: base * ppi,
                  height: (top - base) * ppi,
                  background: cabF.edge,
                  borderRadius: "2px",
                  boxShadow: "0 0 0 0.5px rgba(0,0,0,0.15)",
                  zIndex: 5,
                }}
                title={t("dt_ev_batten")}
              />
            );
          })}

        {/* Doors & windows on this wall, drawn at their sill height */}
        {viewOpenings.map((o) => {
          const isDoor = o.kind === "door";
          const isOpening = o.kind === "opening";
          const isBifold = isDoor && o.doorStyle === "bifold";
          // A cased opening is a hole in the wall: render it as an open gap
          // (light recessed fill, dashed casing) with no door slab or glazing.
          return (
            <div
              key={`ev-${o.uid}`}
              className="absolute flex items-center justify-center overflow-hidden"
              style={{
                left: o.offset * ppi,
                width: o.width * ppi,
                bottom: o.sill * ppi,
                height: o.height * ppi,
                background: isDoor
                  ? doorOpeningAppearance(o).color
                  : isOpening
                  ? "linear-gradient(to bottom, #f3f4f6 0%, #e2e5e9 100%)"
                  : "linear-gradient(to bottom, rgba(160,205,235,0.85) 0%, rgba(126,180,214,0.85) 100%)",
                border: isOpening ? "2px dashed #5a6770" : "2px solid #1a2744",
                borderRadius: 2,
                zIndex: 5,
              }}
              title={`${o.label} (${Math.round(o.width)}" × ${Math.round(o.height)}")`}
            >
              {o.kind === "window" && (
                <div className="absolute inset-1 border border-[#1a2744]/40">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#1a2744]/40" />
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-[#1a2744]/40" />
                </div>
              )}
              {isBifold && <div data-testid="elevation-bifold-panels" className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => <div key={index} className="h-full w-1/4 border-x border-[#694d34]/60 bg-gradient-to-r from-[#ad7e54] via-[#bf9267] to-[#ad7e54]" />)}
              </div>}
              <span className={`relative text-[8px] font-bold drop-shadow ${isOpening ? "text-[#3a4047]" : "text-white"}`}>
                {isBifold ? "Bi-fold" : isDoor ? t("dt_ev_door") : isOpening ? t("dt_ev_open") : t("dt_ev_window")}
              </span>
            </div>
          );
        })}
            </div>
      </div>{/* end centering wrapper */}
      {/* Wall switcher: flip the displayed wall straight from the elevation
          panel. Falls back to a static label when no handler is provided. */}
      {hideSwitcher ? null : onSelectWall ? (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-1 bg-white/85 px-1.5 py-1 rounded-full shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dt_ev_wall")}</span>
          {((["top", "left", "bottom", "right"] as WallSide[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onSelectWall(w)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                w === side
                  ? "bg-[#1a2744] text-white"
                  : "text-[#1a2744] hover:bg-[#1a2744]/10"
              }`}
            >
              {WALL_LABELS[w]}
            </button>
          )))}
          {(room.customWalls ?? []).map((custom, index) => (
            <button
              key={custom.id}
              type="button"
              onClick={() => onSelectWall(custom.id)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                custom.id === side
                  ? "bg-[#1a2744] text-white"
                  : "text-[#1a2744] hover:bg-[#1a2744]/10"
              }`}
            >
              {custom.label?.trim() || `Wall ${index + 1}`}
            </button>
          ))}
        </div>
      ) : (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-[#1a2744] bg-white/80 px-3 py-1 rounded-full">
          {t("dt_ev_wall_elevation", { wall: wallLabel })}
        </div>
      )}


      {sorted.length === 0 && viewOpenings.length === 0 && seamCabinets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm text-center px-6" style={textFlip}>
          {t("dt_ev_empty", { wall: wallLabel.toLowerCase() })}
        </div>
      )}
    </div>
  );
}

// Decorative-hardware overlay. Draws the chosen hardware on a single front box:
// a door region (top) plus a stacked drawer region split into N equal drawers.
// Pieces are tiny CSS shapes positioned by percentage so they scale with zoom.
//   knob → small filled circle   pull → short horizontal bar   cup → half-moon
export function HardwareOverlay({
  doors, drawers, doorPiece, drawerPiece, accent, hardwarePosition, swing, isWall = false, faceWidthIn, frameStileIn, frameRailIn, cabinetHeightIn, raisedDoorPullOnRail = false, pantryLayout, doorBandStartPct,
}: {
  doors: number;
  drawers: number;
  doorPiece: "knob" | "pull" | "none";
  drawerPiece: "knob" | "pull" | "cup" | "none";
  accent: string;
  hardwarePosition?: "auto" | "left" | "center" | "right" | "paired" | "top-center" | null;
  swing?: "left" | "right" | "double" | "none" | null;
  isWall?: boolean;
  faceWidthIn: number;
  frameStileIn?: number | null;
  frameRailIn?: number | null;
  cabinetHeightIn?: number | null;
  raisedDoorPullOnRail?: boolean;
  pantryLayout?: ReturnType<typeof pantryDrawerFrontLayout>;
  /** Doors start this many percent below the top of the face (farmhouse sink apron zone). */
  doorBandStartPct?: number;
}) {
  // Brushed-metal sheen: diagonal light streak over accent color with crisp
  // top highlight and soft drop shadow so pieces read as real metal hardware.
  const metal = `linear-gradient(135deg, color-mix(in srgb, ${accent} 55%, #ffffff) 0%, ${accent} 38%, color-mix(in srgb, ${accent} 70%, #000000) 72%, color-mix(in srgb, ${accent} 88%, #ffffff) 100%)`;
  const metalShadow = "0 2px 4px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.45)";
  const normalizedDoorPosition = normalizeDoorHardwareFramePosition(hardwarePosition);
  // For door hardware (knobs), position on the handle side (opposite of hinge).
  // Drawers always center their hardware.
  const piece = (kind: "knob" | "pull" | "cup", key: string, topPct: number, isDoor?: boolean, index = 0, drawerColumns = 1) => {
    // Drawer hardware is an authoritative center-only construction rule. Door
    // fronts retain their individual Attributes choice, including paired pulls.
    const requestedPosition = isDoor ? normalizedDoorPosition : "center";
    const topCenteredDoorPull = Boolean(isDoor && requestedPosition === "top-center");
    const raisedWallDoorPull = Boolean(isDoor && raisedDoorPullOnRail);
    const horizontalTopRailPull = Boolean(topCenteredDoorPull && !raisedWallDoorPull);
    const position = horizontalTopRailPull
      ? "center"
      : requestedPosition === "auto" && isDoor && doors === 1
      ? swing === "left" ? "right" : swing === "right" ? "left" : "right"
      : requestedPosition;
    const pairedDoorPull = Boolean(isDoor && doors > 1 && (position === "auto" || position === "paired"));
    const physicalWidthIn = Math.max(0, faceWidthIn);
    const doorWidthIn = pairedDoorPull ? physicalWidthIn / 2 : physicalWidthIn;
    const horizontalPosition = pairedDoorPull
      ? (index === 0 ? "right" : "left")
      : position === "left" || position === "right" || position === "center"
        ? position
        : swing === "right" ? "left" : "right";
    const centerFromLeftIn = pairedDoorPull
      ? (index === 0 ? 0 : doorWidthIn) + doorHardwareCenterFromLeftIn(doorWidthIn, horizontalPosition, frameStileIn)
      : doorHardwareCenterFromLeftIn(doorWidthIn, horizontalPosition, frameStileIn);
    const leftPos = !isDoor && drawerColumns > 1 ? `${((index + 0.5) / drawerColumns) * 100}%` : physicalWidthIn > 0 ? `${(centerFromLeftIn / physicalWidthIn) * 100}%` : "50%";
    const requestedStile = Number(frameStileIn);
    const edgeInsetIn = Math.min(
      Number.isFinite(requestedStile) && requestedStile > 0 ? requestedStile / 2 : FRAMED_STILE_CENTER_IN,
      doorWidthIn / 2,
    );
    const measuredHardwareData = isDoor ? {
      "data-hardware-center-in": centerFromLeftIn,
      "data-hardware-edge-inset-in": horizontalPosition === "center" ? undefined : edgeInsetIn,
    } : {};
    if (kind === "knob") {
      return (
        <div
          key={key}
          className="absolute rounded-full"
          {...measuredHardwareData}
          style={{ left: leftPos, top: `${topPct}%`, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, background: metal, boxShadow: metalShadow, zIndex: 8 }}
        />
      );
    }
    if (kind === "pull") {
      // Door pulls are vertical at the opening edge. Drawer pulls remain
      // horizontal and centered under the authoritative drawer hardware rule.
      const pullStyle = horizontalTopRailPull
        ? { left: "25%", right: "25%", top: `${topPct}%`, height: 5, marginTop: -2.5, background: metal, boxShadow: metalShadow, zIndex: 8, borderRadius: 3 }
        : isDoor
        ? { left: leftPos, top: `${topPct}%`, width: 5, height: `${verticalDoorPullHeightPct}%`, marginLeft: -2.5, transform: "translateY(-50%)", background: metal, boxShadow: metalShadow, zIndex: 8, borderRadius: 3 }
        : drawerColumns > 1
        ? { left: `${((index + 0.25) / drawerColumns) * 100}%`, width: `${50 / drawerColumns}%`, top: `${topPct}%`, height: 5, marginTop: -2.5, background: metal, boxShadow: metalShadow, zIndex: 8, borderRadius: 3 }
        : { left: "25%", right: "25%", top: `${topPct}%`, height: 5, marginTop: -2.5, background: metal, boxShadow: metalShadow, zIndex: 8, borderRadius: 3 };
      return (
        <div
          key={key}
          className="absolute"
          data-cabinet-hardware={isDoor ? "door-pull" : "drawer-pull"}
          data-hardware-orientation={horizontalTopRailPull ? "horizontal" : isDoor ? "vertical" : "horizontal"}
          data-hardware-position={raisedWallDoorPull ? "raised-door-rail" : topCenteredDoorPull ? "top-center" : position}
          {...measuredHardwareData}
          style={pullStyle as React.CSSProperties}
        />
      );
    }
    // cup pull: a half-moon bin pull — always centered (drawers only)
    return (
      <div
        key={key}
        className="absolute"
        style={{
          left: drawerColumns > 1 ? `${((index + 0.3) / drawerColumns) * 100}%` : "30%", right: drawerColumns > 1 ? undefined : "30%", width: drawerColumns > 1 ? `${40 / drawerColumns}%` : undefined, top: `${topPct}%`, height: 7,
          borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
          border: `2px solid ${accent}`, borderTop: "none",
          background: `linear-gradient(180deg, transparent 0%, color-mix(in srgb, ${accent} 35%, transparent) 100%)`,
          boxShadow: "0 2px 3px rgba(0,0,0,0.35)", zIndex: 8,
        }}
      />
    );
  };

  const pieces: React.ReactNode[] = [];
  // Drawers stack from the top; doors fill the remainder below. When both are
  // present retain the typical base layout unless a source-backed pantry owns its bands.
  const hasDrawers = drawers > 0 && drawerPiece !== "none";
  const hasDoors = doors > 0 && doorPiece !== "none";
  // Vertical share for the drawer band (rest goes to doors). All-drawer = 100%.
  const drawerBand = hasDrawers ? (hasDoors ? 45 : 100) : 0;
  const pantryFaceHeight = pantryLayout ? pantryLayout.doorHeight + pantryLayout.drawerHeight : 0;
  const pantryDoorPct = pantryLayout && pantryFaceHeight > 0 ? (pantryLayout.doorHeight / pantryFaceHeight) * 100 : null;
  // Match the generic 3D vertical pull limit (0.12–0.86 feet) for pantry doors.
  // The legacy 24%-of-the-whole-tall-cabinet bar could extend above the door.
  const verticalDoorPullHeightPct = pantryLayout && pantryFaceHeight > 0
    ? (Math.min(Math.max(0.12 * 12, pantryLayout.doorHeight * 0.28), 0.86 * 12) / pantryFaceHeight) * 100
    : 24;

  if (hasDrawers) {
    if (pantryLayout && pantryDoorPct != null) {
      let rowTop = pantryDoorPct;
      pantryLayout.rows.forEach((row, rowIndex) => {
        const rowPct = (row.height / pantryFaceHeight) * 100;
        for (let column = 0; column < row.count; column++) {
          pieces.push(piece(drawerPiece as "knob" | "pull" | "cup", `dr-${rowIndex}-${column}`, rowTop + rowPct / 2, false, column, row.count));
        }
        rowTop += rowPct;
      });
    } else {
      for (let i = 0; i < drawers; i++) {
        // Ordinary bases keep their existing top drawer band.
        const sliceH = drawerBand / drawers;
        const center = sliceH * i + sliceH / 2;
        pieces.push(piece(drawerPiece as "knob" | "pull" | "cup", `dr-${i}`, center, false));
      }
    }
  }
  if (hasDoors) {
    // Knob/pull near the bottom inner corner of the door band — positioned on
    // the handle side (opposite of the hinge).
    // Bar pulls: position near the bottom 20% of the door (like real kitchens).
    // Knobs: position near the top 15% of the door (near the handle side corner).
    const fixedDoorBandStart = doorBandStartPct != null && doorBandStartPct > 0 && doorBandStartPct < 100 ? doorBandStartPct : null;
    const doorHeightPct = pantryDoorPct ?? (fixedDoorBandStart != null ? 100 - fixedDoorBandStart : 100 - drawerBand);
    const doorBandTop = pantryDoorPct == null ? (fixedDoorBandStart ?? drawerBand) : 0;
    const resolvedCabinetHeight = Number(cabinetHeightIn);
    const resolvedRail = Number(frameRailIn ?? frameStileIn);
    const topRailCenterPct = Number.isFinite(resolvedCabinetHeight) && resolvedCabinetHeight > 0
      ? (resolvedRail > 0 ? resolvedRail : 3) / 2 / (resolvedCabinetHeight * (doorHeightPct / 100)) * doorHeightPct
      : doorHeightPct * 0.06;
    const requestedDoorTop = raisedDoorPullOnRail || normalizedDoorPosition === "top-center"
      ? doorBandTop + topRailCenterPct
      : doorBandTop + doorHeightPct * (doorPiece === "knob" ? 0.15 : isWall ? 0.76 : 0.24);
    const isVerticalDoorPull = doorPiece === "pull" && (normalizedDoorPosition !== "top-center" || raisedDoorPullOnRail);
    const doorTop = pantryLayout && isVerticalDoorPull
      ? Math.min(doorBandTop + doorHeightPct - verticalDoorPullHeightPct / 2 - topRailCenterPct, Math.max(doorBandTop + verticalDoorPullHeightPct / 2 + topRailCenterPct, requestedDoorTop))
      : requestedDoorTop;
    const visibleDoorPieces = normalizedDoorPosition === "paired" || (normalizedDoorPosition === "auto" && doors > 1)
      ? Math.min(doors, 2)
      : 1;
    for (let i = 0; i < visibleDoorPieces; i++) {
      pieces.push(piece(doorPiece as "knob" | "pull", `do-${i}`, doorTop, true, i));
    }
  }

  return <>{pieces}</>;
}

// One door/drawer face panel rendered in the chosen door style. Used both for
// the door region and for each individual drawer front so a drawer base reads
// as a real stack of drawer fronts rather than one big door.
export function StylePanel({ kind, edge, face, drawer = false, doorSampleUrl, drawerSampleUrl, frameInsetPx, faceWidthIn, faceHeightIn }: { kind: DoorPanelKind; edge: string; face: string; drawer?: boolean; doorSampleUrl?: string | null; drawerSampleUrl?: string | null; frameInsetPx?: number; faceWidthIn?: number; faceHeightIn?: number }) {
  const inheritedFace = useContext(ShakerFaceMetricsContext);
  // Apply the selected real sample to the individual front. Drawers prefer their
  // dedicated sample image, then fall back to the selected door sample.
  const effectiveDoorUrl = drawer ? (drawerSampleUrl ?? doorSampleUrl) : doorSampleUrl;
  // Drawers always read as a slim single recessed front regardless of the door
  // style (drawer fronts don't get raised/beaded treatments in this model),
  // except slab which stays flat.
  if (drawer) {
    const isShaker = isShakerElevationStyle(kind);
    // Apply the photo (drawer sample preferred, door sample as fallback) when available.
    const photoStyle: React.CSSProperties = effectiveDoorUrl
      ? { backgroundImage: `url(${effectiveDoorUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
      : {};
    if (kind === "slab") {
      return (
        <div
          className="absolute inset-[1.5px] rounded-[1.5px]"
          style={{
            ...photoStyle,
            border: `1px solid ${edge}55`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 2px rgba(0,0,0,0.18)`,
          }}
        />
      );
    }
    // Shaker / framed styles preserve their shared physical profile. Slim
    // Shaker uses its one-inch rails and stiles; ordinary Shaker remains 3-inch.
    const sideInset = drawerPanelInsetPx(elevationFrameInsetPx(kind, frameInsetPx), isShaker, kind);
    const railInset = isShaker ? sideInset : Math.max(3, Math.min(6, Math.round(sideInset * 0.5)));
    const physicalGeometry = isShaker
      ? shakerFacePanelGeometry(faceWidthIn ?? inheritedFace.widthIn / inheritedFace.drawerCount, faceHeightIn ?? inheritedFace.drawerHeightIn, inheritedFace.frameMetrics ?? undefined, kind)
      : null;
    return (
      <div
        className={`absolute inset-[1.5px] ${isShaker ? "" : "rounded-[1.5px]"}`}
        style={{
          border: `1px solid ${edge}66`,
          boxShadow: `inset 1px 1px 0 rgba(255,255,255,0.35), inset -1px -1px 1px rgba(0,0,0,0.20)`,
          ...(effectiveDoorUrl
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10)), url(${effectiveDoorUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundBlendMode: "soft-light, normal",
              }
            : {}),
        }}
      >
        <div
          className={`absolute ${isShaker ? "" : "rounded-[1px]"}`}
          style={{
            left: physicalGeometry ? `${physicalGeometry.horizontalInsetPercent}%` : sideInset,
            right: physicalGeometry ? `${physicalGeometry.horizontalInsetPercent}%` : sideInset,
            top: physicalGeometry ? `${physicalGeometry.verticalInsetPercent}%` : railInset,
            bottom: physicalGeometry ? `${physicalGeometry.verticalInsetPercent}%` : railInset,
            ...(effectiveDoorUrl
              ? { backgroundImage: `url(${effectiveDoorUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(180deg, color-mix(in srgb, ${face} 87%, #000) 0%, color-mix(in srgb, ${face} 95%, #000) 100%)` }),
            border: `1px solid ${edge}44`,
            boxShadow: `inset 0 2px 3px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.20)`,
          }}
        />
      </div>
    );
  }
  return <DoorFront kind={kind} edge={edge} face={face} doorSampleUrl={effectiveDoorUrl} frameInsetPx={frameInsetPx} />;
}

// Lightweight door-front detail overlay that reflects the active door style so a
// placed cabinet visibly changes appearance when the user switches styles. When
// `drawers` > 0 it splits the face into a top drawer band (one front per drawer)
// and a door region below, so drawer bases show their real drawer fronts.
export function CustomProfileFace({
  profile,
  face,
  edge,
  kind,
  fixedShelves,
  adjustableShelves,
  doorSampleUrl,
  drawerSampleUrl,
  faceWidthIn,
  faceHeightIn,
  squareOpenEndShelf = false,
}: {
  profile: string;
  face: string;
  edge: string;
  kind: DoorPanelKind;
  fixedShelves: number;
  adjustableShelves: number;
  doorSampleUrl?: string | null;
  drawerSampleUrl?: string | null;
  faceWidthIn?: number;
  faceHeightIn?: number;
  /** Verified KitchenCrest OE6 line art uses square, not bowed, shelf fronts. */
  squareOpenEndShelf?: boolean;
}) {
  const shelfCount = Math.max(2, fixedShelves || adjustableShelves || 3);
  const rail = `color-mix(in srgb, ${face} 68%, #000)`;
  const cavity = `color-mix(in srgb, ${face} 30%, #000)`;
  const shelves = Array.from({ length: shelfCount }, (_, index) => (
    <div
      key={index}
      className="absolute left-[5%] right-[5%] h-[2px]"
      style={{ top: `${((index + 1) / (shelfCount + 1)) * 100}%`, background: rail }}
    />
  ));

  if (profile === "wine-rack") {
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ border: `3px solid ${edge}`, background: cavity }}>
        <svg className="absolute inset-[5%] h-[90%] w-[90%]" preserveAspectRatio="none" viewBox="0 0 100 100">
          {Array.from({ length: 8 }, (_, index) => (
            <g key={index}>
              <line x1={index * 15 - 20} y1="100" x2={index * 15 + 40} y2="0" stroke={rail} strokeWidth="4" />
              <line x1={index * 15 - 20} y1="0" x2={index * 15 + 40} y2="100" stroke={rail} strokeWidth="4" />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (profile === "hood-wall-chimney" || profile === "hood-insert") {
    const chimney = profile === "hood-wall-chimney";
    return (
      <div className="absolute inset-0 flex items-end justify-center" style={{ background: "linear-gradient(180deg,#f2f4f7,#aeb7c3)" }}>
        <div
          className="mb-[7%] bg-slate-400 shadow-inner"
          style={{ width: chimney ? "48%" : "84%", height: chimney ? "68%" : "34%", clipPath: chimney ? "polygon(28% 0,72% 0,88% 65%,100% 100%,0 100%,12% 65%)" : undefined }}
        />
      </div>
    );
  }

  if (profile === "knee-drawer") {
    return (
      <div className="absolute inset-0" style={{ background: cavity, border: `3px solid ${edge}` }}>
        <div
          className="absolute left-[4%] right-[4%] top-[4%] h-[21%]"
          style={{
            border: `2px solid ${rail}`,
            background: face,
            ...(drawerSampleUrl
              ? { backgroundImage: `url(${drawerSampleUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : {}),
          }}
        />
        <div className="absolute left-[8%] right-[8%] top-[32%] bottom-[6%]" style={{ borderTop: `2px solid ${rail}`, background: "rgba(0,0,0,0.16)" }} />
      </div>
    );
  }

  if (profile === "open-shelf-side-door") {
    return (
      <div className="absolute inset-0" style={{ border: `3px solid ${edge}`, background: cavity }}>
        <div className="absolute left-0 top-0 bottom-0 w-[62%]" style={{ borderRight: `3px solid ${rail}` }}>{shelves}</div>
        <div className="absolute right-0 top-0 bottom-0 w-[38%]" style={{ background: face }}>
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={`${edge}99`} doorSampleUrl={doorSampleUrl} faceWidthIn={(faceWidthIn ?? 24) * 0.38} faceHeightIn={faceHeightIn ?? 34.5} />
        </div>
      </div>
    );
  }

  if (profile === "wall_angle") {
    // AW1230/AW1236/AW1242: one angled wall-end design at 30, 36, or 42 inches
    // high. The SKU supplies shelf count; every height keeps one side-hinged door
    // and the same 45-degree exposed-end casing instead of a split WDC face.
    return (
      <div data-cabinet-profile="angled-wall" className="absolute inset-0 overflow-hidden" style={{ border: `3px solid ${edge}`, background: cavity }}>
        <div className="absolute left-0 top-0 bottom-0 w-[60%]" style={{ borderRight: `2px solid ${rail}` }}>
          {shelves}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-[40%]" style={{ background: face, borderLeft: `2px solid ${edge}` }}>
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={`${edge}99`} doorSampleUrl={doorSampleUrl} faceWidthIn={(faceWidthIn ?? 12) * 0.4} faceHeightIn={faceHeightIn ?? 30} />
        </div>
        <div className="absolute left-[4%] right-[4%] top-[3%] h-[2px]" style={{ background: rail, transform: "rotate(-8deg)", transformOrigin: "left center" }} />
      </div>
    );
  }

  const isCurved = profile === "curved-open-shelf" && !squareOpenEndShelf;
  return (
    <div
      data-cabinet-profile={squareOpenEndShelf ? "kitchencrest-square-open-end-shelf" : profile}
      data-open-shelf-count={squareOpenEndShelf ? shelfCount : undefined}
      className="absolute inset-0 overflow-hidden"
      style={{ border: `3px solid ${edge}`, background: cavity, borderTopRightRadius: isCurved ? "42% 16%" : 0, borderBottomRightRadius: isCurved ? "42% 16%" : 0 }}
    >
      {shelves}
      {profile === "pullout-tower" && <div className="absolute top-[4%] bottom-[4%] left-1/2 w-[3px] -translate-x-1/2" style={{ background: rail }} />}
    </div>
  );
}

export function DoorFront({ kind, edge, face, doors, drawers, isWall, doorSampleUrl, drawerSampleUrl, cabinetType, blindOnLeft, cabinetHeightIn, cabinetWidthIn, faceFillOverride, ovenType, openingType, doorHeight, drawerHeight, doorOrientation, layoutSpec, drawerLayout, masterCode, graphicType, category, placementType, description, numberOfDoors, numberOfDrawers, facePattern, shelfCount, glassDoor, frameInsetPx, frameMetrics, farmhouseSinkBase = false }: { kind: DoorPanelKind; edge: string; face: string; doors?: number; drawers?: number; isWall?: boolean; doorSampleUrl?: string | null; drawerSampleUrl?: string | null; cabinetType?: CabinetDrawingType | null; blindOnLeft?: boolean; cabinetHeightIn?: number; cabinetWidthIn?: number; faceFillOverride?: string; ovenType?: "single" | "double" | null; openingType?: "top" | "middle" | "bottom" | null; doorHeight?: number | null; drawerHeight?: number | null; doorOrientation?: "side-by-side" | "stacked" | null; layoutSpec?: string | null; drawerLayout?: string | null; masterCode?: string | null; graphicType?: string | null; category?: string | null; placementType?: string | null; description?: string | null; numberOfDoors?: number | null; numberOfDrawers?: number | null; facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null; shelfCount?: number | null; glassDoor?: boolean; frameInsetPx?: number; frameMetrics?: { stileInches?: number | null; railInches?: number | null }; farmhouseSinkBase?: boolean }) {
  const drawerCount = drawers ?? 0;
  const doorCount = doors ?? 0;
  const stroke = `${edge}99`;
  const faceWidth = cabinetWidthIn ?? 24;
  const faceHeight = cabinetHeightIn ?? 34.5;
  const doorPanelProps = (count = 1, heightPercent = 100) => ({
    faceWidthIn: faceWidth / Math.max(1, count),
    faceHeightIn: faceHeight * (heightPercent / 100),
  });
  const drawerPanelProps = (count = 1, heightPercent = 100) => ({
    faceWidthIn: faceWidth / Math.max(1, count),
    faceHeightIn: faceHeight * (heightPercent / 100),
  });
  const inheritedDoorHeightIn = cabinetType === "oven-tall"
    ? doorHeight ?? faceHeight * 0.2
    : faceHeight;
  const inheritedDrawerHeightIn = cabinetType === "oven-tall"
    ? drawerHeight ?? 5
    : faceHeight / Math.max(1, drawerCount);
  // The face fill (cabinet face frame color) is applied as a full-bleed background
  // on this component's root so the outer container can be transparent (no box).
  // Photorealistic face frame: strong top-light highlight (simulates overhead room
  // lighting), rich mid-tone body, subtle bottom shadow for depth.
  const faceBackground = faceFillOverride ?? `linear-gradient(180deg, color-mix(in srgb, ${face} 96%, #ffffff) 0%, ${face} 30%, ${face} 70%, color-mix(in srgb, ${face} 90%, #000000) 100%)`;

  // Helper: wrap content in a root div that carries the face-frame background.
  // This keeps the outer cabinet container transparent (no visible box).
  const withFace = (children: React.ReactNode) => (
    <div className="absolute inset-0" style={{ background: faceBackground }}>
      <ShakerFaceMetricsContext.Provider value={{ widthIn: faceWidth, heightIn: faceHeight, doorHeightIn: inheritedDoorHeightIn, drawerHeightIn: inheritedDrawerHeightIn, doorCount: Math.max(1, doorCount), drawerCount: Math.max(1, drawerCount), frameMetrics: frameMetrics ?? null }}>
        <GlassDoorRenderContext.Provider value={{ enabled: Boolean(glassDoor), face, shelfCount: Math.max(0, Math.round(shelfCount ?? 0)) }}>
          {children}
        </GlassDoorRenderContext.Provider>
      </ShakerFaceMetricsContext.Provider>
    </div>
  );

  // ─── SPECIALTY TYPE: FARMHOUSE (APRON-FRONT) SINK BASE ────────────────
  // A real FSB has no top rail and no false drawer front. The sink's apron fills
  // the open cutout at the TOP of the face (drawn as an overlay by the wall and
  // island elevations) and two doors fill the lower face beneath it.
  if (farmhouseSinkBase && !isWall) {
    const fsbFace = farmhouseSinkBaseFaceLayout(faceWidth, faceHeight, doorCount);
    const fsbColW = 100 / fsbFace.doorCount;
    return withFace(
      <div data-farmhouse-base-face="true" className="absolute inset-0">
        <div
          data-farmhouse-apron-zone="true"
          className="absolute left-0 right-0 top-0"
          style={{ height: `${fsbFace.apronZonePct}%` }}
        />
        {Array.from({ length: fsbFace.doorCount }).map((_, i) => (
          <div
            key={`fsb-door-${i}`}
            data-farmhouse-base-door={i + 1}
            className="absolute"
            style={{ left: `${fsbColW * i}%`, width: `${fsbColW}%`, top: `${fsbFace.apronZonePct}%`, bottom: 0 }}
          >
            {i > 0 && (
              <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />
            )}
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={faceWidth / fsbFace.doorCount} faceHeightIn={fsbFace.doorZoneIn} />
          </div>
        ))}
      </div>,
    );
  }
  // ─── SPECIALTY TYPE: RANGE HOOD FRONT (RHF30/RHF36) ───────────────────
  // The supplier's catalog image is a shallow wood cabinet front: a lower
  // fascia beneath two doors that slope back toward the wall. It is NOT a
  // stainless hood appliance and it is not a rectangular two-door wall box.
  if (cabinetType === "range-hood-front") {
    const doorHeight = 63;
    return withFace(
      <div data-range-hood-front="true" className="absolute inset-0 overflow-hidden">
        <div
          data-range-hood-front-doors="sloped-pair"
          className="absolute left-[3%] right-[3%] top-[4%] overflow-hidden"
          style={{ height: `${doorHeight}%`, clipPath: "polygon(13% 0, 87% 0, 98% 100%, 2% 100%)" }}
        >
          <div className="absolute inset-0 flex">
            <div className="relative h-full w-1/2">
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall frameInsetPx={frameInsetPx} faceWidthIn={faceWidth / 2} faceHeightIn={faceHeight * (doorHeight / 100)} />
            </div>
            <div className="relative h-full w-1/2 border-l" style={{ borderColor: stroke }}>
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall frameInsetPx={frameInsetPx} faceWidthIn={faceWidth / 2} faceHeightIn={faceHeight * (doorHeight / 100)} />
            </div>
          </div>
        </div>
        <div data-range-hood-front-lower-fascia="true" className="absolute bottom-[4%] left-[5%] right-[5%] h-[24%]" style={{ border: `2px solid ${stroke}`, background: face }} />
        <div data-range-hood-front-fascia-rail="true" className="absolute left-[3%] right-[3%] top-[69%] h-[2px]" style={{ background: edge, boxShadow: "0 1px 1px rgba(255,255,255,.42)" }} />
        <div data-range-hood-front-top-cornice="true" className="absolute left-[2%] right-[2%] top-[1%] h-[3px]" style={{ background: edge, boxShadow: "0 2px 0 color-mix(in srgb, var(--background, #fff) 60%, transparent)" }} />
      </div>,
    );
  }

  // ─── SPECIALTY TYPE: FACE PATTERN ────────────────────────────────────
  // Specialty open-front cabinets (wine racks, plate racks, etc.).
  // MUST run before layoutSpec so rack cabinets are never overridden by a
  // generic layout spec that might be present on the same record.
  const activeFacePattern = facePattern || (cabinetType === "face-pattern" ? "slats" : null);
  if (activeFacePattern) {
    const barColor = `color-mix(in srgb, ${face} 70%, #000000)`;
    const bgColor = `color-mix(in srgb, ${face} 40%, #000000)`;
    return withFace(
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ border: `3px solid ${stroke}`, borderRadius: 2 }} />
        {activeFacePattern === "slats" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="slats-pattern" x="0" y="0" width="10%" height="100%" patternUnits="objectBoundingBox">
                <rect x="15%" y="0" width="70%" height="100%" fill={barColor} />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.25" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#slats-pattern)" />
          </svg>
        )}
        {activeFacePattern === "criss-cross" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="xpattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="20" y2="20" stroke={barColor} strokeWidth="2.5" />
                <line x1="20" y1="0" x2="0" y2="20" stroke={barColor} strokeWidth="2.5" />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.2" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#xpattern)" />
          </svg>
        )}
        {activeFacePattern === "lattice" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="lattice-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="8" y1="0" x2="8" y2="16" stroke={barColor} strokeWidth="2" />
                <line x1="0" y1="8" x2="16" y2="8" stroke={barColor} strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.2" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#lattice-pattern)" />
          </svg>
        )}
        {activeFacePattern === "open" && (
          <div
            className="absolute"
            style={{ left: "5%", right: "5%", top: "5%", bottom: "5%", background: bgColor, opacity: 0.35, borderRadius: 2 }}
          />
        )}
      </div>
    );
  }

  // ─── LAYOUT SPEC: Exact admin-defined section rendering ──────────────
  // When a layoutSpec is present, render exactly as defined: each section
  // is a row with a type (door/drawer/shelf), count-across, and height.
  // Sections are stored top-to-bottom in the array; we render them as
  // CSS flex-column so the first section is at the top of the cabinet face.
  if (layoutSpec) {
    let spec: { baseType?: string; sections?: Array<{ type: string; count: number; height: number }>; vanity?: { drawerSide: 'left' | 'right'; drawerCount: number; drawerBankRatio: number } } | null = null;
    try { spec = JSON.parse(layoutSpec); } catch { /* ignore */ }
    if (spec?.vanity) {
      const drawerSide = spec.vanity.drawerSide === 'right' ? 'right' : 'left';
      const drawerCount = Math.max(1, spec.vanity.drawerCount || 1);
      const drawerBank = Math.min(0.55, Math.max(0.28, spec.vanity.drawerBankRatio || 0.4));
      const drawerHeightPct = 100 / drawerCount;
      const drawerBankFace = (
        <div className="relative h-full" style={{ width: `${drawerBank * 100}%` }}>
          {Array.from({ length: drawerCount }).map((_, index) => (
            <div key={index} className="relative" style={{ height: `${drawerHeightPct}%` }}>
              {index > 0 && <div className="absolute inset-x-0 top-0" style={{ height: 2, background: stroke }} />}
              <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(1, drawerHeightPct)} />
            </div>
          ))}
        </div>
      );
      const doorBankFace = (
        <div className="relative h-full flex-1">
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(1, 100)} />
        </div>
      );
      return withFace(
        <div className="absolute inset-0 flex">
          {drawerSide === 'left' ? drawerBankFace : doorBankFace}
          <div className="h-full shrink-0" style={{ width: 2, background: stroke }} />
          {drawerSide === 'left' ? doorBankFace : drawerBankFace}
        </div>
      );
    }
    if (spec && Array.isArray(spec.sections) && spec.sections.length > 0) {
      const totalH = spec.sections.reduce((s, r) => s + (r.height || 0), 0);
      return withFace(
        <div className="absolute inset-0 flex flex-col">
          {spec.sections.map((section, idx) => {
            const pct = totalH > 0 ? (section.height / totalH) * 100 : (100 / spec!.sections!.length);
            const count = Math.max(1, section.count || 1);
            const colW = 100 / count;
            const isDrawer = section.type === 'drawer';
            const isDoor = section.type === 'door';
            return (
              <div
                key={idx}
                className="relative overflow-hidden"
                style={{ height: `${pct}%`, flexShrink: 0 }}
              >
                {/* Rail between sections */}
                {idx > 0 && (
                  <div className="absolute left-0 right-0 top-0" style={{ height: 2, background: stroke, zIndex: 1 }} />
                )}
                {isDrawer ? (
                  // Drawer row: count-across drawer fronts
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: count }).map((_, ci) => (
                      <div key={ci} className="relative h-full" style={{ width: `${colW}%` }}>
                        {ci > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                        <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(count, pct)} />
                      </div>
                    ))}
                  </div>
                ) : isDoor ? (
                  // Door row: count-across door panels
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: count }).map((_, ci) => (
                      <div key={ci} className="relative h-full" style={{ width: `${colW}%` }}>
                        {ci > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                        <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(count, pct)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Open shelf: empty recessed area
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 100%)`,
                      boxShadow: `inset 0 2px 4px rgba(0,0,0,0.25)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }
  }

  // ─── SPECIALTY TYPE: OVEN TALL ────────────────────────────────────────
  // Oven tall cabinets (O-code): Uses admin-configured openingType, doorHeight,
  // doorCount, and drawerCount to render accurately. Falls back to legacy
  // percentages only when admin data is missing.
  if (cabinetType === "oven-tall") {
    const totalH = cabinetHeightIn ?? 84;
    const isDouble = ovenType === "double";
    // Use admin-configured opening position (default: middle for oven-tall)
    const oPos = openingType ?? "middle";
    // Use admin-configured door count (default: 2 for oven-tall)
    const ovenDoorCount = Math.max(1, doorCount || 2);
    // Use admin-configured drawer count (default: 3 single / 1 double)
    const ovenDrawerCount = drawerCount > 0 ? drawerCount : (isDouble ? 1 : 3);
    // Calculate percentages from doorHeight if provided, otherwise use legacy defaults
    let upperDoorPct: number;
    let openingPct: number;
    let drawerAreaPct: number;
    if (doorHeight && doorHeight > 0) {
      // doorHeight is the height of the door section in inches
      upperDoorPct = (doorHeight / totalH) * 100;
      // Estimate drawer height: ~5" per drawer
      const drawerInches = ovenDrawerCount * 5;
      drawerAreaPct = (drawerInches / totalH) * 100;
      openingPct = 100 - upperDoorPct - drawerAreaPct;
      // Clamp opening to at least 15%
      if (openingPct < 15) {
        openingPct = 15;
        drawerAreaPct = 100 - upperDoorPct - openingPct;
      }
    } else {
      upperDoorPct = 20;
      openingPct = isDouble ? 62 : 50;
      drawerAreaPct = 100 - upperDoorPct - openingPct;
    }
    const drawerH = ovenDrawerCount > 0 ? drawerAreaPct / ovenDrawerCount : 0;
    const ovenImgUrl = isDouble
      ? "/manus-storage/legacy-cdn/oven-double-front-n2DaWbuTecczH4YKk7fJbo.webp"
      : "/manus-storage/legacy-cdn/oven-single-front-U843ihaYrWbB8xwKsMyngZ.webp";

    // Render based on opening position
    if (oPos === "top") {
      // Opening at top, doors below, drawers at bottom
      return withFace(
        <>
          {/* Appliance opening at top */}
          <div className="absolute left-0 right-0 top-0" style={{ height: `${openingPct}%`, background: "#1a1a1a", overflow: "hidden" }}>
            <img src={ovenImgUrl} alt="Oven" className="w-full h-full object-cover" />
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${openingPct}%`, height: 2, background: stroke }} />
          {/* Doors below opening */}
          <div className="absolute left-0 right-0" style={{ top: `${openingPct}%`, height: `${upperDoorPct}%` }}>
            {Array.from({ length: ovenDoorCount }).map((_, i) => (
              <div key={`oven-door-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(100 / ovenDoorCount) * i}%`, width: `${100 / ovenDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={false} frameInsetPx={frameInsetPx} {...doorPanelProps(ovenDoorCount, upperDoorPct)} />
              </div>
            ))}
          </div>
          {ovenDrawerCount > 0 && <div className="absolute left-0 right-0" style={{ top: `${openingPct + upperDoorPct}%`, height: 2, background: stroke }} />}
          {/* Drawers at bottom */}
          {Array.from({ length: ovenDrawerCount }).map((_, i) => (
            <div key={`oven-drw-${i}`} className="absolute left-0 right-0" style={{ top: `${openingPct + upperDoorPct + drawerH * i}%`, height: `${drawerH}%` }}>
              {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
              <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(1, drawerH)} />
            </div>
          ))}
        </>
      );
    } else if (oPos === "bottom") {
      // Doors at top, drawers in middle, opening at bottom
      return withFace(
        <>
          {/* Doors at top */}
          <div className="absolute left-0 right-0 top-0" style={{ height: `${upperDoorPct}%` }}>
            {Array.from({ length: ovenDoorCount }).map((_, i) => (
              <div key={`oven-door-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(100 / ovenDoorCount) * i}%`, width: `${100 / ovenDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={false} frameInsetPx={frameInsetPx} {...doorPanelProps(ovenDoorCount, upperDoorPct)} />
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct}%`, height: 2, background: stroke }} />
          {/* Drawers in middle */}
          {Array.from({ length: ovenDrawerCount }).map((_, i) => (
            <div key={`oven-drw-${i}`} className="absolute left-0 right-0" style={{ top: `${upperDoorPct + drawerH * i}%`, height: `${drawerH}%` }}>
              {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
              <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(1, drawerH)} />
            </div>
          ))}
          {ovenDrawerCount > 0 && <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct + drawerAreaPct}%`, height: 2, background: stroke }} />}
          {/* Opening at bottom */}
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct + drawerAreaPct}%`, bottom: 0, background: "#1a1a1a", overflow: "hidden" }}>
            <img src={ovenImgUrl} alt="Oven" className="w-full h-full object-cover" />
          </div>
        </>
      );
    } else {
      // Default 'middle': doors on top, opening in middle, drawers at bottom
      return withFace(
        <>
          {/* Doors at top */}
          <div className="absolute left-0 right-0 top-0" style={{ height: `${upperDoorPct}%` }}>
            {Array.from({ length: ovenDoorCount }).map((_, i) => (
              <div key={`oven-door-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(100 / ovenDoorCount) * i}%`, width: `${100 / ovenDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={false} frameInsetPx={frameInsetPx} {...doorPanelProps(ovenDoorCount, upperDoorPct)} />
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct}%`, height: 2, background: stroke }} />
          {/* Opening in middle */}
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct}%`, height: `${openingPct}%`, background: "#1a1a1a", overflow: "hidden" }}>
            <img src={ovenImgUrl} alt={isDouble ? "Double oven" : "Single oven"} className="w-full h-full object-cover" />
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct + openingPct}%`, height: 2, background: stroke }} />
          {/* Drawers at bottom */}
          {Array.from({ length: ovenDrawerCount }).map((_, i) => (
            <div key={`oven-drw-${i}`} className="absolute left-0 right-0" style={{ top: `${upperDoorPct + openingPct + drawerH * i}%`, height: `${drawerH}%` }}>
              {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
              <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(1, drawerH)} />
            </div>
          ))}
        </>
      );
    }
  }

  const pantryDrawerLayout = pantryDrawerFrontLayout({
    masterCode,
    graphicType,
    category,
    placementType,
    description,
    numberOfDoors: numberOfDoors ?? doorCount,
    numberOfDrawers: numberOfDrawers ?? drawerCount,
    doorHeight,
    drawerHeight,
    drawerLayout,
    openingType,
    ovenType,
  }, faceHeight);

  // ─── SPECIALTY TYPE: PANTRY (tall cabinet) ───────────────────────────
  // Pantry cabinets split at ~54" from floor into upper and lower sections.
  // Uses admin-configured doorCount to determine layout:
  //   - 2 doors total → 1 top + 1 bottom (stacked, for narrow pantries like 18")
  //   - 4 doors total → 2 top + 2 bottom (side-by-side, for wider pantries)
  //   - fallback: 4 doors (classic pantry layout)
  if (pantryDrawerLayout) {
      const upperDoorPct = Math.max(0, Math.min(100, (pantryDrawerLayout.doorHeight / faceHeight) * 100));
      const upperDoorWidthPct = 100 / pantryDrawerLayout.doorCount;
      let previousDrawerHeight = 0;
      let drawerNumber = 0;
      return withFace(
        <>
          <div
            data-pantry-door-count={pantryDrawerLayout.doorCount}
            data-pantry-door-height-in={pantryDrawerLayout.doorHeight}
            className="absolute left-0 right-0 top-0"
            style={{ height: `${upperDoorPct}%` }}
          >
            {Array.from({ length: pantryDrawerLayout.doorCount }).map((_, index) => (
              <div
                key={`pantry-upper-door-${index}`}
                data-pantry-upper-doors="true"
                className="absolute top-0 bottom-0"
                style={{ left: `${upperDoorWidthPct * index}%`, width: `${upperDoorWidthPct}%` }}
              >
                {index > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(pantryDrawerLayout.doorCount, upperDoorPct)} />
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${upperDoorPct}%`, height: 2, background: stroke }} />
          {pantryDrawerLayout.rows.map((row, rowIndex) => {
            const rowPct = Math.max(0, (row.height / faceHeight) * 100);
            const rowTopPct = upperDoorPct + previousDrawerHeight;
            previousDrawerHeight += rowPct;
            const drawerWidthPct = 100 / row.count;
            return Array.from({ length: row.count }).map((_, columnIndex) => {
              drawerNumber += 1;
              return (
                <div
                  key={`pantry-bottom-drawer-${rowIndex}-${columnIndex}`}
                  data-pantry-bottom-drawer="true"
                  data-pantry-drawer-number={drawerNumber}
                  data-pantry-drawer-row={rowIndex}
                  data-pantry-drawer-height-in={row.height}
                  className="absolute"
                  style={{ top: `${rowTopPct}%`, height: `${rowPct}%`, left: `${drawerWidthPct * columnIndex}%`, width: `${drawerWidthPct}%` }}
                >
                  {(rowIndex > 0 || columnIndex > 0) && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
                  {columnIndex > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                  <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(row.count, rowPct)} />
                </div>
              );
            });
          })}
        </>,
      );
  }

  if (cabinetType === "pantry") {
    const totalH = cabinetHeightIn ?? 84; // default 84" if not provided
    const splitIn = 54; // split point in inches from floor
    // Clamp split so it's always between 20% and 80% of the cabinet height
    const splitPct = Math.min(80, Math.max(20, (splitIn / totalH) * 100));
    // Determine doors per section from admin-configured doorCount
    const totalDoors = doorCount > 0 ? doorCount : 4; // fallback to 4 for classic pantry
    const doorsPerSection = Math.max(1, Math.round(totalDoors / 2));
    const colW = 100 / doorsPerSection;
    return withFace(
      <>
        {/* Bottom section: doors from floor to 54" */}
        <div className="absolute left-0 right-0 bottom-0" style={{ height: `${splitPct}%` }}>
          {Array.from({ length: doorsPerSection }).map((_, i) => (
            <div
              key={`pantry-bot-${i}`}
              className="absolute top-0 bottom-0"
              style={{ left: `${colW * i}%`, width: `${colW}%` }}
            >
              {i > 0 && (
                <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />
              )}
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(doorsPerSection, splitPct)} />
            </div>
          ))}
        </div>
        {/* Horizontal rail at the split point */}
        <div
          className="absolute left-0 right-0"
          style={{ bottom: `${splitPct}%`, height: 2, background: stroke }}
        />
        {/* Top section: doors from 54" to top */}
        <div className="absolute left-0 right-0 top-0" style={{ height: `${100 - splitPct}%` }}>
          {Array.from({ length: doorsPerSection }).map((_, i) => (
            <div
              key={`pantry-top-${i}`}
              className="absolute top-0 bottom-0"
              style={{ left: `${colW * i}%`, width: `${colW}%` }}
            >
              {i > 0 && (
                <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />
              )}
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(doorsPerSection, 100 - splitPct)} />
            </div>
          ))}
        </div>
      </>
    );
  }

  // ─── SPECIALTY TYPE: SINK BASE ─────────────────────────────────────────
  // Sink bases have a narrow false tilt-out panel at the top (for the tip-out
  // tray) and two doors below. The false front is thinner than a normal drawer.
  if (cabinetType === "sink-base") {
    // Sink bases retain standard base-cabinet face proportions: a 20% top
    // drawer/tilt-out row and 80% door region. The sink changes hardware, not
    // the height of the doors.
    const falseFrontPct = 20;
    const cols = Math.max(1, doorCount || 2);
    const colW = 100 / cols;
    return withFace(
      <>
        {/* false front (tilt-out tray) */}
        <div data-sink-base-false-front="true" className="absolute left-0 right-0 top-0" style={{ height: `${falseFrontPct}%` }}>
          <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} faceWidthIn={cabinetWidthIn ?? 24} faceHeightIn={(cabinetHeightIn ?? 34.5) * (falseFrontPct / 100)} />
        </div>
        {/* rail between false front and doors */}
        <div className="absolute left-0 right-0" style={{ top: `${falseFrontPct}%`, height: 2, background: stroke }} />
        {/* door region: N side-by-side doors */}
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={`sink-door-${i}`}
            className="absolute"
            style={{ left: `${colW * i}%`, width: `${colW}%`, top: `${falseFrontPct}%`, bottom: 0 }}
          >
            {i > 0 && (
              <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />
            )}
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={(cabinetWidthIn ?? 24) / cols} faceHeightIn={(cabinetHeightIn ?? 34.5) * ((100 - falseFrontPct) / 100)} />
          </div>
        ))}
      </>
    );
  }

  // ─── SPECIALTY TYPE: MICROWAVE BASE ────────────────────────────────────
  // BMC30 is configured as zero doors, one top microwave opening, and one
  // bottom drawer. It must never fall through to the standard door-base face.
  if (cabinetType === "microwave-base") {
    const totalHeightIn = cabinetHeightIn ?? 34.5;
    const configuredDrawerIn = drawerHeight ?? 12;
    const drawerPct = Math.max(24, Math.min(48, (configuredDrawerIn / totalHeightIn) * 100));
    const openingPct = 100 - drawerPct;
    return withFace(
      <>
        <div
          data-microwave-base-opening="true"
          className="absolute left-0 right-0 top-0 overflow-hidden"
          style={{ height: `${openingPct}%`, background: "linear-gradient(180deg, #111827 0%, #030712 80%, #1f2937 100%)", boxShadow: "inset 0 0 0 2px rgba(15,23,42,0.72), inset 0 -4px 9px rgba(0,0,0,0.75)" }}
        >
          <div className="absolute left-[9%] right-[9%] top-[15%] bottom-[14%] rounded-[2px]" style={{ border: "1px solid rgba(148,163,184,0.52)", background: "linear-gradient(180deg, rgba(55,65,81,0.7), rgba(15,23,42,0.92))", boxShadow: "inset 0 1px 4px rgba(255,255,255,0.10)" }} />
          <div className="absolute left-[12%] right-[12%] bottom-[8%] h-px" style={{ background: "rgba(203,213,225,0.38)" }} />
        </div>
        <div className="absolute left-0 right-0" style={{ top: `${openingPct}%`, height: 2, background: stroke }} />
        <div data-microwave-base-drawer="true" className="absolute left-0 right-0 bottom-0" style={{ height: `${drawerPct}%` }}>
          <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} {...drawerPanelProps(1, drawerPct)} />
        </div>
      </>,
    );
  }

  // ─── SPECIALTY TYPE: GLASS DOOR ────────────────────────────────────────
	  // Catalog glass-door cabinets use the same measured, selected-finish frame
	  // renderer as upgraded standard doors. The shared glass context supplies the
	  // transparent center, matching interior finish, and visible shelf levels.
	  if (cabinetType === "glass-door") {
    const numDoors = Math.max(1, doorCount);
    const doorWidthPct = 100 / numDoors;
    return withFace(
      <>
        {Array.from({ length: numDoors }).map((_, i) => (
	          <div
	            key={`glass-${i}`}
	            className="absolute top-0 bottom-0"
	            style={{ left: `${doorWidthPct * i}%`, width: `${doorWidthPct}%` }}
	          >
	            <SingleDoorPanel
	              kind={kind}
	              edge={edge}
	              face={face}
	              stroke={stroke}
	              doorSampleUrl={doorSampleUrl}
	              isWall={isWall}
	              frameInsetPx={frameInsetPx}
	              {...doorPanelProps(numDoors, 100)}
	            />
	          </div>
        ))}
      </>
    );
  }

  // ─── SPECIALTY TYPE: BLIND CORNER ──────────────────────────────────────
  // Blind corner cabinets: show the visible door portion (typically one door)
  // with a subtle blind panel indicator on the hidden side. The door
  // automatically flips to the EXPOSED side (away from the wall corner).
  if (cabinetType === "blind-corner") {
    // The visible face is typically ~60% of the width; the blind portion is hidden.
    const visiblePct = 60;
    // blindOnLeft defaults to true (blind on left, door on right).
    // When false, the corner is on the right so we flip: door on left, blind on right.
    const bLeft = blindOnLeft !== false;
    const integratedWbcFiller = isWallBlindCornerCabinet({ masterCode, description: null });
    const integratedFillerPct = integratedWbcFiller ? Math.min(35, (3 / Math.max(3, faceWidth)) * 100) : 0;
    const blindPct = Math.max(0, 100 - visiblePct - integratedFillerPct);
    return withFace(
      <>
        {/* Blind (hidden) portion: subtle hatched/darker area */}
        <div
          className="absolute top-0 bottom-0"
          style={bLeft ? { left: 0, width: `${integratedWbcFiller ? blindPct : 100 - visiblePct}%` } : { right: 0, width: `${100 - visiblePct}%` }}
        >
          <div
            className="absolute inset-[2px] rounded-[1px]"
            style={{
              background: `repeating-linear-gradient(135deg, ${face}22 0px, ${face}22 3px, ${edge}33 3px, ${edge}33 4px)`,
              boxShadow: `inset 0 0 4px rgba(0,0,0,0.15)`,
            }}
          />
        </div>
        {integratedWbcFiller && bLeft && (
          <div
            data-wbc-integrated-filler="left-of-door"
            className="absolute top-0 bottom-0"
            style={{
              left: `${blindPct}%`,
              width: `${integratedFillerPct}%`,
              background: face,
              borderLeft: `1px solid ${stroke}`,
              borderRight: `2px solid ${stroke}`,
            }}
          />
        )}
        {/* Visible door portion */}
        <div
          className="absolute top-0 bottom-0"
          style={bLeft ? { left: `${100 - visiblePct}%`, width: `${visiblePct}%` } : { left: 0, width: `${visiblePct}%` }}
        >
          <div className={`absolute top-0 bottom-0 ${bLeft ? 'left-0' : 'right-0'}`} style={{ width: 2, background: stroke }} />
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={faceWidth * (visiblePct / 100)} faceHeightIn={faceHeight} />
        </div>
      </>
    );
  }

  // ─── SPECIALTY TYPE: BASE END CORNER / END RETURN ──────────────────────
  // BEC-24 has a 24x24 footprint and two 12-inch faces meeting at a 90-degree
  // return. The left/front face stays square to the elevation; the right face
  // is deliberately foreshortened, so this never reads as a flat 24-inch box
  // or a 36-inch diagonal/lazy-Susan room corner.
  if (cabinetType === "end-return") {
    return withFace(
      <div data-bec-end-return-face="true" className="absolute inset-0 overflow-hidden">
        <div data-bec-front-face="12in" className="absolute top-[3%] bottom-[3%] left-[3%]" style={{ width: "49%" }}>
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={12} faceHeightIn={cabinetHeightIn ?? 34.5} />
        </div>
        <div
          data-bec-return-face="12in"
          className="absolute top-[5%] bottom-[5%]"
          style={{
            left: "52%",
            width: "43%",
            transform: "skewY(-4deg)",
            transformOrigin: "left center",
            boxShadow: `inset 2px 0 0 ${edge}99, -2px 0 3px rgba(0,0,0,0.18)`,
          }}
        >
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={12} faceHeightIn={cabinetHeightIn ?? 34.5} />
        </div>
        <div data-bec-return-seam="true" className="absolute top-[2%] bottom-[2%]" style={{ left: "51%", width: 2, background: `${edge}bb`, boxShadow: "1px 0 1px rgba(255,255,255,0.38)" }} />
        <div className="absolute left-[3%] right-[5%] top-[2%] h-px" style={{ background: `${edge}88` }} />
      </div>,
    );
  }

  // ─── SPECIALTY TYPE: BASE END CABINET, 45° ANGLED FRONT ─────────────────
  // BEC-24 is a 24-by-24 end cabinet, not a room corner. Its single 45-degree
  // front plane is approximately 17 inches wide and carries two equal 8.45-inch
  // doors which meet on the center seam.
  if (cabinetType === "end-angle") {
    return withFace(
      <div data-bec-angled-end-face="true" data-bec-45-angle="true" className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[3%] bottom-[3%] left-[3%] right-[3%] overflow-hidden"
          style={{
            clipPath: "polygon(0 5%, 100% 0, 100% 100%, 0 95%)",
            boxShadow: `inset 0 0 0 2px ${edge}aa, inset 0 -2px 4px rgba(0,0,0,0.14)`,
          }}
        >
          <div data-bec-angled-left-door="8.45in" className="absolute left-0 top-0 bottom-0" style={{ width: "50%" }}>
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={8.45} faceHeightIn={cabinetHeightIn ?? 34.5} />
          </div>
          <div data-bec-angled-right-door="8.45in" className="absolute right-0 top-0 bottom-0" style={{ width: "50%" }}>
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={8.45} faceHeightIn={cabinetHeightIn ?? 34.5} />
          </div>
          <div data-bec-angled-center-seam="true" className="absolute top-[3%] bottom-[3%]" style={{ left: "50%", width: 2, background: `${edge}cc`, boxShadow: "1px 0 1px rgba(255,255,255,0.42)" }} />
        </div>
      </div>,
    );
  }

  // ─── SPECIALTY TYPE: TRIANGLE CORNER ──────────────────────────────────
  // Triangle corner cabinets (WTC/BTC): right-triangle footprint, single door
  // on the hypotenuse (angled) face. In elevation view we show a full-width
  // door panel with diagonal shadow strips on both sides to suggest the
  // right-triangle geometry.
  if (cabinetType === "triangle-corner") {
    return withFace(
      <>
        {/* Left corner shadow — suggests the receding left leg */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ width: "12%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${face} 60%, #000) 0%, transparent 100%)`,
              opacity: 0.45,
            }}
          />
        </div>
        {/* Right corner shadow — suggests the receding right leg */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{ width: "12%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(225deg, color-mix(in srgb, ${face} 60%, #000) 0%, transparent 100%)`,
              opacity: 0.45,
            }}
          />
        </div>
        {/* Single door panel on the angled hypotenuse face */}
        <div
          className="absolute"
          style={{ left: "12%", right: "12%", top: "3%", bottom: "3%" }}
        >
          <div
            className="absolute inset-[1.5px] rounded-[2px]"
            style={{
              background: doorSampleUrl ? `url(${doorSampleUrl}) center/cover` : face,
              mixBlendMode: doorSampleUrl ? "multiply" : undefined,
              boxShadow: `inset 0 2px 4px rgba(0,0,0,0.15), 0 0 0 0.5px ${edge}66`,
            }}
          />
        </div>
      </>
    );
  }

  // ─── SPECIALTY TYPE: DIAGONAL CORNER ──────────────────────────────────
  // Diagonal corner cabinets (DCW, WDC, DCB): angled front face with door(s).
  // In elevation view, we show the angled face as a slightly narrower door
  // with angled side indicators to suggest the 45° geometry.
  if (cabinetType === "diagonal-corner") {
    const dCount = Math.max(1, doorCount || 1);
    const doorSlice = 70 / dCount; // doors occupy ~70% of width (angled face)
    const visibleShelves = Math.max(0, Math.min(4, shelfCount ?? 0));
    return withFace(
      <>
        {/* Left angled indicator */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ width: "15%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, transparent 50%, color-mix(in srgb, ${face} 85%, #000) 50%)`,
              opacity: 0.4,
            }}
          />
        </div>
        {/* Right angled indicator */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{ width: "15%" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(225deg, transparent 50%, color-mix(in srgb, ${face} 85%, #000) 50%)`,
              opacity: 0.4,
            }}
          />
        </div>
        {/* Door panel(s) on the angled face (center area) */}
        {Array.from({ length: dCount }).map((_, i) => (
          <div
            data-diagonal-corner-door="true"
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * doorSlice}%`,
              width: `${doorSlice - 2}%`,
              top: "3%",
              bottom: "3%",
            }}
          >
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={faceWidth * ((doorSlice - 2) / 100)} faceHeightIn={faceHeight * 0.94} />
            {glassDoor && (
              <div
                data-diagonal-corner-glass="true"
                className="absolute inset-[12%]"
                style={{
                  background: "linear-gradient(145deg, rgba(226,244,249,0.58), rgba(79,113,125,0.28))",
                  border: `1px solid ${edge}88`,
                  boxShadow: "inset 0 0 12px rgba(255,255,255,0.32)",
                }}
              />
            )}
            {Array.from({ length: visibleShelves }).map((_, shelfIndex) => (
              <div
                key={`diagonal-shelf-${shelfIndex}`}
                className="absolute left-[14%] right-[14%] h-px"
                style={{
                  top: `${((shelfIndex + 1) / (visibleShelves + 1)) * 100}%`,
                  background: `${edge}66`,
                  boxShadow: "0 1px 0 rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
        ))}
      </>
    );
  }
  // ─── SPECIALTY TYPE: L-CORNER ───────────────────────────────────────
  // L-corner cabinets (lazy Susan, easy-reach): one door per wall face.
  // Each wall elevation shows a single door filling the full face width.
  // The CornerView seam-ghost mechanism ensures the cabinet appears on
  // BOTH walls — one door on the Back wall, one door on the Left wall.
  if (cabinetType === "l-corner") {
    return withFace(
      <>
        {/* Single door panel filling the full face — this wall's door face */}
        <div data-l-corner-return-face="true" className="absolute top-[3%] bottom-[3%] left-[3%] right-[3%]">
          <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={faceWidth * 0.94} faceHeightIn={faceHeight * 0.94} />
        </div>
        {/* Subtle corner-return shadow strip on the right edge to hint at the
            L-shape — the door wraps around the corner */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{ width: "6%", background: `linear-gradient(to left, ${edge}55, transparent)`, opacity: 0.6 }}
        />
      </>
    );
  }
  // ─── SPECIALTY TYPE: APPLIANCE GARAGE ──────────────────────────────────
  // Tambour/roll-up slat pattern.
  if (cabinetType === "appliance-garage") {
    return withFace(
      <div
        className="absolute inset-[1.5px] rounded-[2px]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, color-mix(in srgb, ${face} 95%, #fff) 0px, color-mix(in srgb, ${face} 95%, #fff) 4px, color-mix(in srgb, ${face} 80%, #000) 4px, color-mix(in srgb, ${face} 80%, #000) 5px)`,
          boxShadow: `inset 0 2px 4px rgba(0,0,0,0.20), 0 0 0 0.5px ${edge}66`,
        }}
      />
    );
  }

  // ─── SPECIALTY TYPE: CORNER DRAWER BASE ─────────────────────────────────
  // Corner drawer bases (CDB-*): L-shaped footprint with stacked drawers on
  // the main visible face. Renders as a full-height drawer stack (like a
  // drawer base) but with a small corner indicator on the left edge.
  if (cabinetType === "corner-drawer-base") {
    const dCount = Math.max(1, drawerCount || 3);
    const sliceH = 100 / dCount;
    return withFace(
      <>
        {/* Corner indicator: subtle angled mark on left edge */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ width: "8%" }}
        >
          <div
            className="absolute inset-[2px] rounded-[1px]"
            style={{
              background: `repeating-linear-gradient(135deg, ${face}22 0px, ${face}22 3px, ${edge}33 3px, ${edge}33 4px)`,
              boxShadow: `inset 0 0 3px rgba(0,0,0,0.12)`,
            }}
          />
        </div>
        {/* Main drawer stack */}
        <div className="absolute top-0 bottom-0" style={{ left: "8%", right: 0 }}>
          {Array.from({ length: dCount }).map((_, i) => (
            <div
              key={`cdb-drw-${i}`}
              className="absolute left-0 right-0"
              style={{ top: `${sliceH * i}%`, height: `${sliceH}%` }}
            >
              {i > 0 && (
                <div className="absolute left-0 right-0 top-0" style={{ height: 2, background: stroke }} />
              )}
                            <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} faceWidthIn={faceWidth * 0.92} faceHeightIn={faceHeight / dCount} />
            </div>
          ))}
        </div>
      </>
    );
  }
  // ─── APPLIANCE OPENING (non-oven-tall) ──────────────────────────────────
  // For cabinets with openingType set (e.g. MW3042 microwave wall cabinets)
  // that are NOT classified as oven-tall, render based on admin config.
  if (openingType && (cabinetType as string) !== "oven-tall") {
    const totalH = cabinetHeightIn ?? 34.5;
    const oPos = openingType;
    // `0` is a valid authored count: a configured opening can have no doors at
    // all (e.g. BMC30). Never coerce that zero into generic two-door geometry.
    const cabDoorCount = Math.max(0, doorCount);
    const cabDrawerCount = drawerCount;
    // Calculate door height percentage
    let doorPct: number;
    if (cabDoorCount === 0) {
      doorPct = 0;
    } else if (doorHeight && doorHeight > 0) {
      doorPct = (doorHeight / totalH) * 100;
    } else {
      doorPct = cabDoorCount > 0 ? 40 : 0;
    }
    // Drawer height: use admin config drawerHeight if available, otherwise ~5" per drawer
    const drawerInches = drawerHeight && drawerHeight > 0 ? drawerHeight * cabDrawerCount : cabDrawerCount * 5;
    const drawerPct = totalH > 0 ? (drawerInches / totalH) * 100 : 0;
    const openingPct = Math.max(15, 100 - doorPct - drawerPct);

    if (oPos === "top") {
      // Opening at top, doors below
      return withFace(
        <>
          <div className="absolute left-0 right-0 top-0" style={{ height: `${openingPct}%`, background: "#1a1a1a" }} />
          <div className="absolute left-0 right-0" style={{ top: `${openingPct}%`, height: 2, background: stroke }} />
          <div className="absolute left-0 right-0" style={{ top: `${openingPct}%`, height: `${doorPct}%` }}>
            {Array.from({ length: cabDoorCount }).map((_, i) => (
              <div key={`mw-door-${i}`} data-config-opening-door="true" className="absolute top-0 bottom-0" style={{ left: `${(100 / cabDoorCount) * i}%`, width: `${100 / cabDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(cabDoorCount, doorPct)} />
              </div>
            ))}
          </div>
          {cabDrawerCount > 0 && (
            <>
              <div className="absolute left-0 right-0" style={{ top: `${openingPct + doorPct}%`, height: 2, background: stroke }} />
              {Array.from({ length: cabDrawerCount }).map((_, i) => {
                const sliceH = drawerPct / cabDrawerCount;
                return (
                  <div key={`mw-drw-${i}`} data-config-opening-drawer="true" className="absolute left-0 right-0" style={{ top: `${openingPct + doorPct + sliceH * i}%`, height: `${sliceH}%` }}>
                    {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
                    <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} {...drawerPanelProps(1, sliceH)} />
                  </div>
                );
              })}
            </>
          )}
        </>
      );
    } else if (oPos === "bottom") {
      // Doors at top, opening at bottom
      return withFace(
        <>
          <div className="absolute left-0 right-0 top-0" style={{ height: `${doorPct}%` }}>
            {Array.from({ length: cabDoorCount }).map((_, i) => (
              <div key={`mw-door-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(100 / cabDoorCount) * i}%`, width: `${100 / cabDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(cabDoorCount, doorPct)} />
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${doorPct}%`, height: 2, background: stroke }} />
          {cabDrawerCount > 0 && (
            <>
              {Array.from({ length: cabDrawerCount }).map((_, i) => {
                const sliceH = drawerPct / cabDrawerCount;
                return (
                  <div key={`mw-drw-${i}`} className="absolute left-0 right-0" style={{ top: `${doorPct + sliceH * i}%`, height: `${sliceH}%` }}>
                    {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
                    <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} {...drawerPanelProps(1, sliceH)} />
                  </div>
                );
              })}
              <div className="absolute left-0 right-0" style={{ top: `${doorPct + drawerPct}%`, height: 2, background: stroke }} />
            </>
          )}
          <div className="absolute left-0 right-0" style={{ top: `${doorPct + drawerPct}%`, bottom: 0, background: "#1a1a1a" }} />
        </>
      );
    } else {
      // Middle: doors on top, opening in middle, drawers at bottom
      return withFace(
        <>
          <div className="absolute left-0 right-0 top-0" style={{ height: `${doorPct}%` }}>
            {Array.from({ length: cabDoorCount }).map((_, i) => (
              <div key={`mw-door-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(100 / cabDoorCount) * i}%`, width: `${100 / cabDoorCount}%` }}>
                {i > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} {...doorPanelProps(cabDoorCount, doorPct)} />
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ top: `${doorPct}%`, height: 2, background: stroke }} />
          <div className="absolute left-0 right-0" style={{ top: `${doorPct}%`, height: `${openingPct}%`, background: "#1a1a1a" }} />
          {cabDrawerCount > 0 && (
            <>
              <div className="absolute left-0 right-0" style={{ top: `${doorPct + openingPct}%`, height: 2, background: stroke }} />
              {Array.from({ length: cabDrawerCount }).map((_, i) => {
                const sliceH = drawerPct / cabDrawerCount;
                return (
                  <div key={`mw-drw-${i}`} className="absolute left-0 right-0" style={{ top: `${doorPct + openingPct + sliceH * i}%`, height: `${sliceH}%` }}>
                    {i > 0 && <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: stroke }} />}
                    <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} {...drawerPanelProps(1, sliceH)} />
                  </div>
                );
              })}
            </>
          )}
        </>
      );
    }
  }

  // ─── STANDARD: DRAWERS + DOORS ─────────────────────────────────────────
  // When a cabinet has drawers, draw the drawer stack + (optional) door region.
  if (drawerCount > 0) {
    const hasDoors = doorCount > 0;
    if (hasDoors) {
      const wd18Layout = wd18CountertopFaceLayout(
        { masterCode, placement: isWall ? "wall" : null, numberOfDrawers: drawerCount },
        cabinetHeightIn ?? 60,
      );
      if (wd18Layout) {
        const totalHeight = Math.max(1, cabinetHeightIn ?? 60);
        const doorPct = (wd18Layout.doorHeight / totalHeight) * 100;
        let drawerTopPct = doorPct;
        return withFace(
          <>
            <div data-wd18-upper-door="true" className="absolute left-0 right-0 top-0" style={{ height: `${doorPct}%` }}>
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={cabinetWidthIn ?? 18} faceHeightIn={wd18Layout.doorHeight} />
            </div>
            <div className="absolute left-0 right-0" style={{ top: `${doorPct}%`, height: 2, background: stroke }} />
            {wd18Layout.drawerHeights.map((drawerHeightIn, index) => {
              const top = drawerTopPct;
              const heightPct = (drawerHeightIn / totalHeight) * 100;
              drawerTopPct += heightPct;
              return (
                <div key={`wd18-drawer-${index}`} data-wd18-bottom-drawer="true" className="absolute left-0 right-0" style={{ top: `${top}%`, height: `${heightPct}%` }}>
                  {index > 0 && <div className="absolute left-0 right-0 top-0" style={{ height: 2, background: stroke }} />}
                  <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} faceWidthIn={cabinetWidthIn ?? 18} faceHeightIn={drawerHeightIn} />
                </div>
              );
            })}
          </>,
        );
      }
      // STANDARD BASE: always exactly ONE row of drawers at the top (20% of face),
      // with drawerCount drawers side-by-side in that row.
      // Below that is the door region split into doorCount side-by-side doors.
      const DRAWER_ROW_PCT = 20; // 6" of 30" face = 20%
      const drawerColW = drawerCount > 0 ? 100 / drawerCount : 100;
      const cols = Math.max(1, doorCount);
      const colW = 100 / cols;
      void drawerLayout; // drawerLayout not used for standard base — always one row

      return withFace(
        <>
          {/* single drawer row: drawerCount side-by-side drawers at 20% height */}
          <div className="absolute left-0 right-0" style={{ top: 0, height: `${DRAWER_ROW_PCT}%` }}>
            {Array.from({ length: Math.max(1, drawerCount) }).map((_, ci) => (
              <div key={ci} className="absolute top-0 bottom-0" style={{ left: `${drawerColW * ci}%`, width: `${drawerColW}%` }}>
                {ci > 0 && <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />}
                <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} faceWidthIn={(cabinetWidthIn ?? 24) / Math.max(1, drawerCount)} faceHeightIn={(cabinetHeightIn ?? 34.5) * (DRAWER_ROW_PCT / 100)} />
              </div>
            ))}
          </div>
          {/* rail between the drawer row and the doors */}
          <div className="absolute left-0 right-0" style={{ top: `${DRAWER_ROW_PCT}%`, height: 2, background: stroke }} />
          {/* door region: N side-by-side doors */}
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={`bdoor-${i}`}
              className="absolute"
              style={{ left: `${colW * i}%`, width: `${colW}%`, top: `${DRAWER_ROW_PCT}%`, bottom: 0 }}
            >
              {i > 0 && (
                <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: stroke }} />
              )}
              <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={(cabinetWidthIn ?? 24) / cols} faceHeightIn={(cabinetHeightIn ?? 34.5) * 0.8} />
            </div>
          ))}
        </>
      );
    }
    // Drawer-only bases share the same family rules as thumbnails, selected
    // details, and final 3D: 2-DB is 50/50; 3-DB is 6in over equal lower rows.
    const availableDrawerFaceIn = Math.max(1, (cabinetHeightIn ?? 34.5) - (isWall ? 0 : 4.5));
    const verifiedThreeDrawerRows = threeDrawerBaseRowHeights(
      { masterCode, numberOfDrawers: drawerCount },
      availableDrawerFaceIn,
      drawerCount,
    );
    const allDrawerRowHeights: number[] = verifiedThreeDrawerRows
      ? verifiedThreeDrawerRows.map((height) => (height / availableDrawerFaceIn) * 100)
      : Array.from({ length: drawerCount }, () => 100 / drawerCount);
    return withFace(
      <>
        {Array.from({ length: drawerCount }).map((_, i) => {
          const top = allDrawerRowHeights.slice(0, i).reduce((s, h) => s + h, 0);
          return (
            <div
              key={`drw-${i}`}
              className="absolute left-0 right-0"
              style={{ top: `${top}%`, height: `${allDrawerRowHeights[i]}%` }}
            >
              {i > 0 && (
                <div className="absolute left-0 right-0 top-0" style={{ height: 2, background: stroke }} />
              )}
              <StylePanel kind={kind} edge={edge} face={face} drawer doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} frameInsetPx={frameInsetPx} faceWidthIn={cabinetWidthIn ?? 24} faceHeightIn={verifiedThreeDrawerRows?.[i] ?? availableDrawerFaceIn / drawerCount} />
            </div>
          );
        })}
      </>
    );
  }
  void isWall;
  // For multi-door cabinets, split the face into N side-by-side door panels
  // separated by a center stile. Each panel gets its own style treatment.
  const numDoors = Math.max(1, doorCount);
  if (numDoors > 1) {
    const doorWidthPct = 100 / numDoors;
    return withFace(
      <>
        {Array.from({ length: numDoors }).map((_, i) => (
          <div
            key={`door-${i}`}
            className="absolute top-0 bottom-0"
            style={{ left: `${doorWidthPct * i}%`, width: `${doorWidthPct}%` }}
          >
            {/* stile between doors */}
            {i > 0 && (
              <div
                className="absolute top-0 bottom-0 left-0"
                style={{ width: 2, background: stroke }}
              />
            )}
            <SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={(cabinetWidthIn ?? 24) / numDoors} faceHeightIn={cabinetHeightIn ?? 34.5} />
          </div>
        ))}
      </>
    );
  }
  return withFace(<SingleDoorPanel kind={kind} edge={edge} face={face} stroke={stroke} doorSampleUrl={doorSampleUrl} isWall={isWall} frameInsetPx={frameInsetPx} faceWidthIn={cabinetWidthIn ?? 24} faceHeightIn={cabinetHeightIn ?? 34.5} />);
}

// A recessed center panel with real depth: darkened, top-shadowed fill inside a
// beveled reveal. Reused by every framed door style. `inset` is the px gap from
// the door edge to the panel (i.e. the rail width). `depth` tunes how deep the
// panel reads. `raised` adds a central raised field (cathedral/raised-panel).
function RecessedPanel({ inset, horizontalInset, verticalInset, face, edge, raised = false, doorSampleUrl, isWall }: { inset: number; horizontalInset?: string; verticalInset?: string; face: string; edge: string; raised?: boolean; doorSampleUrl?: string | null; isWall?: boolean; frameInsetPx?: number }) {
  // For wall cabinets the door-sample photo often includes a drawer front at the
  // top (it's a base-cabinet door+drawer combo shot). Anchor to the bottom of
  // the image so only the door panel portion is visible.
  const samplePos = isWall ? "center 80%" : "center";
  const panelBg = doorSampleUrl
    ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover" as const, backgroundPosition: samplePos }
    : { background: `linear-gradient(180deg, color-mix(in srgb, ${face} 78%, #000) 0%, color-mix(in srgb, ${face} 88%, #000) 45%, color-mix(in srgb, ${face} 96%, #000) 100%)` };
  return (
    <div
      className="absolute"
      style={{
        inset,
        ...(horizontalInset ? { left: horizontalInset, right: horizontalInset } : {}),
        ...(verticalInset ? { top: verticalInset, bottom: verticalInset } : {}),
        // Sharp 90° corners for shaker/framed panel — no border-radius.
        // Deep reveal groove: strong top shadow (rail overhang), bright bottom
        // lip (light bouncing off the panel floor), dark left shadow (side rail
        // overhang), subtle right highlight. This makes the panel read as truly
        // recessed into the face frame.
        boxShadow: `inset 0 3.5px 7px rgba(0,0,0,0.42), inset 3px 0 5px rgba(0,0,0,0.18), inset 0 -1.5px 0 rgba(255,255,255,0.28), inset -2px 0 3px rgba(255,255,255,0.12), 0 0 0 0.5px ${edge}80`,
        ...panelBg,
      }}
    >
      {raised && (
        <div
          className="absolute inset-[3px]"
          style={{
            // Raised field: lighter at top (catches overhead light), slightly
            // darker at bottom. Strong bevel shadow on all 4 edges makes it
            // read as a real raised wood panel.
            background: doorSampleUrl ? undefined : `linear-gradient(180deg, color-mix(in srgb, ${face} 96%, #fff) 0%, color-mix(in srgb, ${face} 98%, #fff) 35%, ${face} 65%, color-mix(in srgb, ${face} 92%, #000) 100%)`,
            ...(doorSampleUrl ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover" as const, backgroundPosition: "center" as const } : {}),
            boxShadow: `0 2px 4px rgba(0,0,0,0.32), inset 1.5px 1.5px 0 rgba(255,255,255,0.40), inset -1.5px -1.5px 2px rgba(0,0,0,0.24)`,
          }}
        />
      )}
    </div>
  );
}

// Renders a single door panel in the chosen style. Used by DoorFront for each
// individual door in a multi-door cabinet. Each framed style uses a beveled
// outer rail (light top-left / dark bottom-right) plus a RecessedPanel so the
// door reads as a real 3D door rather than flat outlines.
export function SingleDoorPanel({ kind, edge, face, stroke, doorSampleUrl, isWall, frameInsetPx, faceWidthIn, faceHeightIn }: { kind: DoorPanelKind; edge: string; face: string; stroke: string; doorSampleUrl?: string | null; isWall?: boolean; frameInsetPx?: number; faceWidthIn?: number; faceHeightIn?: number }) {
  const inheritedFace = useContext(ShakerFaceMetricsContext);
	const glassDoor = useContext(GlassDoorRenderContext);
  void stroke;
  // Beveled outer rail applied to the whole door face (shared by framed styles).
  // Strong bevel on the outer rail: bright top-left highlight (light hits the
  // top rail and left stile), dark bottom-right shadow (underside of bottom rail
  // and right stile). Makes the face frame read as real routed wood.
  // Shaker/framed doors use sharp 90° corners — no border-radius on the face frame.
  const railBevel: React.CSSProperties = {
    boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.38), inset -2px -2px 2px rgba(0,0,0,0.28)`,
    borderRadius: 0,
    backgroundColor: face,
    ...(doorSampleUrl
      ? {
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10)), url(${doorSampleUrl})`,
          backgroundSize: "cover",
          backgroundPosition: isWall ? "center 80%" : "center",
          backgroundBlendMode: "soft-light, normal",
        }
      : {}),
  };
  // Per-style frame inset: how many px from the door edge to the recessed panel.
  // Derived from the style's stileWidth (in inches) scaled to px at ~4px/in.
  // Fallback defaults: slim-shaker=4px (1in), shaker/raised/beaded=12px (3in), double-shaker=12px, inset=5px.
  const resolvedInset = (fi: number) => elevationFrameInsetPx(kind, frameInsetPx) ?? fi;
  const shakerGeometry = shakerFacePanelGeometry(faceWidthIn ?? inheritedFace.widthIn / inheritedFace.doorCount, faceHeightIn ?? inheritedFace.doorHeightIn, inheritedFace.frameMetrics ?? undefined, kind);
	if (glassDoor.enabled) {
	  const paneLeft = `${shakerGeometry.horizontalInsetPercent}%`;
	  const paneTop = `${shakerGeometry.verticalInsetPercent}%`;
	  const shelves = Math.max(0, Math.min(8, glassDoor.shelfCount));
	  return (
	    <div data-glass-door-frame="true" className="absolute inset-0" style={railBevel}>
	      <div
	        data-glass-door-pane="true"
	        className="absolute overflow-hidden"
	        style={{
	          left: paneLeft,
	          right: paneLeft,
	          top: paneTop,
	          bottom: paneTop,
	          background: `linear-gradient(180deg, color-mix(in srgb, ${glassDoor.face} 76%, #000000) 0%, color-mix(in srgb, ${glassDoor.face} 64%, #000000) 100%)`,
	          border: `1px solid ${edge}88`,
	          boxShadow: `inset 0 3px 7px rgba(0,0,0,0.28)`,
	        }}
	      >
	        <div data-glass-cabinet-interior="true" className="absolute inset-0" style={{ backgroundColor: glassDoor.face, opacity: 0.88 }} />
	        {Array.from({ length: shelves }).map((_, index) => (
	          <div
	            key={index}
	            data-glass-cabinet-shelf={index + 1}
	            className="absolute left-[3%] right-[3%]"
	            style={{
	              top: `${((index + 1) / (shelves + 1)) * 100}%`,
	              height: 3,
	              background: glassDoor.face,
	              borderTop: "1px solid rgba(255,255,255,0.52)",
	              borderBottom: "1px solid rgba(0,0,0,0.32)",
	              boxShadow: "0 2px 3px rgba(0,0,0,0.20)",
	            }}
	          />
	        ))}
	        <div
	          data-transparent-glass="true"
	          className="absolute inset-0"
	          style={{
	            background: "linear-gradient(145deg, rgba(239,250,253,0.38) 0%, rgba(176,211,222,0.13) 47%, rgba(255,255,255,0.22) 48%, rgba(111,151,166,0.12) 100%)",
	            boxShadow: "inset 0 0 10px rgba(255,255,255,0.22)",
	          }}
	        />
	      </div>
	    </div>
	  );
	}
  switch (kind) {
    case "slab":
      // Flat modern door: no panel, just a machined edge + soft top highlight.
      // When a door sample is available, use it as the slab face.
      return (
        <div
          className="absolute inset-[1.5px] rounded-[2px]"
          style={{
            ...(doorSampleUrl ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover", backgroundPosition: isWall ? "center 80%" : "center" } : {}),
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 3px rgba(0,0,0,0.14), 0 0 0 1px ${edge}44`,
          }}
        />
      );
    case "double-shaker":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <div className="absolute" style={{ left: resolvedInset(6), right: resolvedInset(6), top: resolvedInset(6), bottom: "50.5%" }}>
            <RecessedPanel inset={0} face={face} edge={edge} doorSampleUrl={doorSampleUrl} isWall={isWall} />
          </div>
          <div className="absolute" style={{ left: resolvedInset(6), right: resolvedInset(6), top: "50.5%", bottom: resolvedInset(6) }}>
            <RecessedPanel inset={0} face={face} edge={edge} doorSampleUrl={doorSampleUrl} isWall={isWall} />
          </div>
        </div>
      );
    case "raised":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={resolvedInset(6)} face={face} edge={edge} raised doorSampleUrl={doorSampleUrl} isWall={isWall} />
        </div>
      );
    case "beaded":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <div
            className="absolute"
            style={{
              inset: resolvedInset(5),
              boxShadow: `inset 0 2px 4px rgba(0,0,0,0.24), 0 0 0 0.5px ${edge}66`,
              ...(doorSampleUrl
                ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover", backgroundPosition: isWall ? "center 80%" : "center" }
                : { backgroundImage: `repeating-linear-gradient(90deg, color-mix(in srgb, ${face} 90%, #000) 0px, color-mix(in srgb, ${face} 90%, #000) 2px, color-mix(in srgb, ${face} 78%, #000) 2.5px, color-mix(in srgb, ${face} 90%, #000) 3px, color-mix(in srgb, ${face} 90%, #000) 4px)` }),
            }}
          />
        </div>
      );
    case "inset":
      return (
        <div
          className="absolute inset-[2px] rounded-[2px]"
          style={{ boxShadow: `0 0 0 1px ${edge}77, inset 1px 1px 0 rgba(255,255,255,0.22), inset -1px -1px 1px rgba(0,0,0,0.18)` }}
        >
          <RecessedPanel inset={resolvedInset(5)} face={face} edge={edge} doorSampleUrl={doorSampleUrl} isWall={isWall} />
        </div>
      );
    case "slim-shaker":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={resolvedInset(3)} face={face} edge={edge} doorSampleUrl={doorSampleUrl} isWall={isWall} />
        </div>
      );
    case "shaker":
    default:
      // Keep the actual measured five-piece Shaker geometry while carrying the
      // selected real door sample across both the rails and recessed center.
      // Each individual door panel receives its own sample crop, preventing a
      // single photo from spanning through neighboring cabinet doors.
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={0} horizontalInset={`${shakerGeometry.horizontalInsetPercent}%`} verticalInset={`${shakerGeometry.verticalInsetPercent}%`} face={face} edge={edge} doorSampleUrl={doorSampleUrl} isWall={isWall} />
        </div>
      );
  }
}
