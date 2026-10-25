/**
 * IslandElevationView — front-elevation preview for island cabinets.
 *
 * Island cabinets live in room-space (p.x, p.y) and are NOT assigned to any
 * WallSide by cabinetWall(). Instead we detect them with isOnIsland() and
 * project them onto a virtual "front face" of the island rectangle.
 *
 * The island is always wider than it is deep, so the "front face" is the side
 * parallel to the island's width axis (horizontal). We sort island cabinets by
 * their x-coordinate and use (p.x - island.x) as posAlong so they line up
 * left-to-right across the island width.
 *
 * This component intentionally reuses the same CSS rendering primitives as
 * ElevationView (same colors, same door/drawer logic) without touching the
 * 4-wall model.
 */
import {
  PlacedCabinet, RoomData, STD, elevationBox,
  FinishColors, DEFAULT_FINISH_COLORS,
  type DoorPanelKind,
  countertopMaterial,
  isOnIsland, placedFootprint, bearsIslandCountertop,
  isSinkBaseCabinet, isFarmerSinkBase, isBlindCorner, resolveSwing, resolveCabinetHardwarePosition,
  isRangeOrOven, isStacker, wallCabinetTopLine, isCounterHeightIslandWallCabinet, islandWallCabinetBaseTreatment, isLightRailEligibleCabinet, usesRaisedFloorWallDoorPull,
	  DEFAULT_CEILING_HEIGHT,
	  type IslandZone, type IslandFace,
} from "@/lib/design";
import { inferredIslandFace, islandCountertopRect, islandFaceLength, islandOffsetForPlaced } from "@/lib/islandScene";
import { farmhouseSinkBaseFaceLayout } from "@/lib/farmhouseSinkBaseFace";
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
import { resolveConfiguredFaceCounts, resolveDoorDrawerCounts, cabinetDrawingType, isWallBlindCornerCabinet, type CabinetDrawingType } from "@/lib/cabinetGraphics";
import { useRef, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function islandFarmhouseSinkElevationGeometry(cabinetWidthIn: number) {
  const apronHeightIn = 8.5;
  const sideInsetIn = Math.min(1.5, Math.max(0.75, cabinetWidthIn * 0.04));
  return {
    apronHeightIn,
    apronBottomIn: STD.BASE_HEIGHT - apronHeightIn,
    sideInsetIn,
    apronWidthIn: Math.max(0, cabinetWidthIn - sideInsetIn * 2),
  };
}

// ─── Sub-components (copied from ElevationView for self-containment) ─────────

function RecessedPanel({
  inset, face, edge, raised, doorSampleUrl,
}: { inset: number; face: string; edge: string; raised?: boolean; doorSampleUrl?: string | null }) {
  return (
    <div
      className="absolute"
      style={{
        inset,
        boxShadow: raised
          ? `0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 ${edge}55, inset 0 1px 2px rgba(0,0,0,0.18)`
          : `inset 0 2px 4px rgba(0,0,0,0.24), 0 0 0 0.5px ${edge}66`,
        ...(doorSampleUrl
          ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}),
      }}
    />
  );
}

function DoorFront({
  kind, edge, face, doors, drawers, isWall, doorSampleUrl, drawerSampleUrl, cabinetType, blindOnLeft, cabinetHeightIn, facePattern, frameInsetPx, farmhouseSinkBase = false, cabinetWidthIn,
}: {
  kind: DoorPanelKind; edge: string; face: string;
  doors: number; drawers: number; isWall: boolean;
  doorSampleUrl?: string | null;
  drawerSampleUrl?: string | null;
  cabinetType: CabinetDrawingType | null;
  blindOnLeft: boolean;
  cabinetHeightIn: number;
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  frameInsetPx?: number | null;
  farmhouseSinkBase?: boolean;
  cabinetWidthIn?: number;
}) {
  void drawerSampleUrl; // reserved for future drawer-front photo rendering in island view
  // A real farmhouse (apron-front) sink base has no top rail and no false drawer
  // front: the apron fills the top of the face (drawn as an overlay) and two
  // doors fill the lower face beneath it.
  if (farmhouseSinkBase && !isWall) {
    const fsbFace = farmhouseSinkBaseFaceLayout(cabinetWidthIn ?? 36, cabinetHeightIn, doors);
    const colPct = 100 / fsbFace.doorCount;
    return (
      <div data-farmhouse-base-face="true" className="absolute inset-0">
        <div data-farmhouse-apron-zone="true" className="absolute left-0 right-0 top-0" style={{ height: `${fsbFace.apronZonePct}%` }} />
        {Array.from({ length: fsbFace.doorCount }).map((_, i) => (
          <div
            key={`island-fsb-door-${i}`}
            data-farmhouse-base-door={i + 1}
            className="absolute"
            style={{ left: `${colPct * i}%`, width: `${colPct}%`, top: `${fsbFace.apronZonePct}%`, bottom: 0 }}
          >
            <DoorFront
              kind={kind} edge={edge} face={face} doors={1} drawers={0} isWall={false}
              doorSampleUrl={doorSampleUrl} drawerSampleUrl={drawerSampleUrl} cabinetType={null}
              blindOnLeft={blindOnLeft} cabinetHeightIn={fsbFace.doorZoneIn} frameInsetPx={frameInsetPx}
            />
          </div>
        ))}
      </div>
    );
  }
  // Face-pattern override: render specialty open-front pattern instead of door panels
  const activeFacePattern = facePattern || (cabinetType === "face-pattern" ? "slats" : null);
  if (activeFacePattern) {
    const barColor = `color-mix(in srgb, ${face} 70%, #000000)`;
    const bgColor = `color-mix(in srgb, ${face} 40%, #000000)`;
    const stroke = `${edge}99`;
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ border: `3px solid ${stroke}`, borderRadius: 2 }} />
        {activeFacePattern === "slats" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="island-slats" x="0" y="0" width="10%" height="100%" patternUnits="objectBoundingBox">
                <rect x="15%" y="0" width="70%" height="100%" fill={barColor} />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.25" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#island-slats)" />
          </svg>
        )}
        {activeFacePattern === "criss-cross" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="island-xpat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="20" y2="20" stroke={barColor} strokeWidth="2.5" />
                <line x1="20" y1="0" x2="0" y2="20" stroke={barColor} strokeWidth="2.5" />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.2" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#island-xpat)" />
          </svg>
        )}
        {activeFacePattern === "lattice" && (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="island-lattice" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="8" y1="0" x2="8" y2="16" stroke={barColor} strokeWidth="2" />
                <line x1="0" y1="8" x2="16" y2="8" stroke={barColor} strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="5%" y="5%" width="90%" height="90%" fill={bgColor} opacity="0.2" />
            <rect x="5%" y="5%" width="90%" height="90%" fill="url(#island-lattice)" />
          </svg>
        )}
        {activeFacePattern === "open" && (
          <div className="absolute" style={{ left: "5%", right: "5%", top: "5%", bottom: "5%", background: bgColor, opacity: 0.35, borderRadius: 2 }} />
        )}
      </div>
    );
  }
  const railBevel: React.CSSProperties = {
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 ${edge}55, inset 1px 0 0 rgba(255,255,255,0.2), inset -1px 0 0 ${edge}44`,
  };
  switch (kind) {
    case "slab":
      return (
        <div
          className="absolute inset-[1.5px] rounded-[2px]"
          style={{
            ...(doorSampleUrl ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 3px rgba(0,0,0,0.14), 0 0 0 1px ${edge}44`,
          }}
        />
      );
    case "double-shaker":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <div className="absolute left-[6px] right-[6px] top-[6px] bottom-[50.5%]">
            <RecessedPanel inset={0} face={face} edge={edge} doorSampleUrl={doorSampleUrl} />
          </div>
          <div className="absolute left-[6px] right-[6px] top-[50.5%] bottom-[6px]">
            <RecessedPanel inset={0} face={face} edge={edge} doorSampleUrl={doorSampleUrl} />
          </div>
        </div>
      );
    case "raised":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={6} face={face} edge={edge} raised doorSampleUrl={doorSampleUrl} />
        </div>
      );
    case "beaded":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <div
            className="absolute inset-[5px] rounded-[1px]"
            style={{
              boxShadow: `inset 0 2px 4px rgba(0,0,0,0.24), 0 0 0 0.5px ${edge}66`,
              ...(doorSampleUrl
                ? { backgroundImage: `url(${doorSampleUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
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
          <RecessedPanel inset={5} face={face} edge={edge} doorSampleUrl={doorSampleUrl} />
        </div>
      );
    case "slim-shaker":
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={frameInsetPx ?? 4} face={face} edge={edge} doorSampleUrl={doorSampleUrl} />
        </div>
      );
    case "shaker":
    default:
      return (
        <div className="absolute inset-0" style={railBevel}>
          <RecessedPanel inset={6} face={face} edge={edge} doorSampleUrl={doorSampleUrl} />
        </div>
      );
  }
}

export function IslandHardwareOverlay({
  doors, drawers, doorPiece, drawerPiece, accent, hardwarePosition, swing, faceWidthIn, frameStileIn, raisedDoorPullOnRail = false, doorBandStartPct,
}: {
  doors: number; drawers: number;
  doorPiece: "knob" | "pull" | "none";
  drawerPiece: "knob" | "pull" | "cup" | "none";
  accent: string;
  hardwarePosition?: "auto" | "left" | "center" | "right" | "paired" | "top-center" | null;
  swing?: "left" | "right" | "double" | "none" | null;
  faceWidthIn: number;
  frameStileIn?: number | null;
  raisedDoorPullOnRail?: boolean;
  /** Doors start this many percent below the top of the face (farmhouse sink apron zone). */
  doorBandStartPct?: number;
}) {
  const metal = `linear-gradient(135deg, color-mix(in srgb, ${accent} 55%, #ffffff) 0%, ${accent} 38%, color-mix(in srgb, ${accent} 70%, #000000) 72%, color-mix(in srgb, ${accent} 88%, #ffffff) 100%)`;
  const metalShadow = "0 1px 1.5px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.55)";
  const normalizedDoorPosition = normalizeDoorHardwareFramePosition(hardwarePosition);
  const piece = (kind: "knob" | "pull" | "cup", key: string, topPct: number, isDoor?: boolean, index = 0) => {
    const requestedSide = isDoor ? normalizedDoorPosition : null;
    const topCenteredDoorPull = Boolean(isDoor && requestedSide === "top-center");
    const raisedWallDoorPull = Boolean(isDoor && raisedDoorPullOnRail);
    const horizontalTopRailPull = topCenteredDoorPull && !raisedWallDoorPull;
    const hSide = horizontalTopRailPull
      ? "center"
      : requestedSide === "auto" && isDoor && doors === 1
      ? swing === "left" ? "right" : swing === "right" ? "left" : "right"
      : requestedSide;
    const pairedDoorPull = Boolean(isDoor && doors > 1 && (hSide === "auto" || hSide === "paired"));
    const physicalWidthIn = Math.max(0, faceWidthIn);
    const doorWidthIn = pairedDoorPull ? physicalWidthIn / 2 : physicalWidthIn;
    const horizontalPosition = pairedDoorPull
      ? (index === 0 ? "right" : "left")
      : hSide === "left" || hSide === "right"
        ? hSide
        : swing === "right" ? "left" : "right";
    const centerFromLeftIn = pairedDoorPull
      ? (index === 0 ? 0 : doorWidthIn) + doorHardwareCenterFromLeftIn(doorWidthIn, horizontalPosition, frameStileIn)
      : doorHardwareCenterFromLeftIn(doorWidthIn, horizontalPosition, frameStileIn);
    const leftPos = physicalWidthIn > 0 ? `${(centerFromLeftIn / physicalWidthIn) * 100}%` : "50%";
    const requestedStile = Number(frameStileIn);
    const edgeInsetIn = Math.min(
      Number.isFinite(requestedStile) && requestedStile > 0 ? requestedStile / 2 : FRAMED_STILE_CENTER_IN,
      doorWidthIn / 2,
    );
    const measuredHardwareData = isDoor ? {
      "data-hardware-center-in": centerFromLeftIn,
      "data-hardware-edge-inset-in": edgeInsetIn,
    } : {};
    if (kind === "knob") {
      return (
        <div key={key} className="absolute rounded-full"
          {...measuredHardwareData}
          style={{ left: leftPos, top: `${topPct}%`, width: 5, height: 5, marginLeft: -2.5, background: metal, boxShadow: metalShadow, zIndex: 8 }}
        />
      );
    }
    if (kind === "pull") {
      const pullStyle = horizontalTopRailPull
        ? { left: "30%", right: "30%", top: `${topPct}%`, height: 3, marginTop: -1.5, background: metal, boxShadow: metalShadow, zIndex: 8 }
        : isDoor
        ? { left: leftPos, top: `${topPct}%`, width: 3, height: "24%", marginLeft: -1.5, transform: "translateY(-50%)", background: metal, boxShadow: metalShadow, zIndex: 8, borderRadius: 2 }
        : { left: "30%", right: "30%", top: `${topPct}%`, height: 3, background: metal, boxShadow: metalShadow, zIndex: 8 };
      return <div key={key} className="absolute" data-cabinet-hardware={isDoor ? "door-pull" : "drawer-pull"} data-hardware-orientation={horizontalTopRailPull ? "horizontal" : isDoor ? "vertical" : "horizontal"} data-hardware-position={raisedWallDoorPull ? "raised-door-rail" : topCenteredDoorPull ? "top-center" : hSide ?? "center"} {...measuredHardwareData} style={pullStyle} />;
    }
    if (kind === "cup") {
      return (
        <div key={key} className="absolute"
          style={{ left: "25%", right: "25%", top: `${topPct}%`, height: 5, marginTop: -2.5, background: metal, borderRadius: "0 0 50% 50%", boxShadow: metalShadow, zIndex: 8 }}
        />
      );
    }
    return null;
  };
  const items: React.ReactNode[] = [];
  if (doors > 0 && doorPiece !== "none") {
    const bandStart = doorBandStartPct != null && doorBandStartPct > 0 && doorBandStartPct < 100 ? doorBandStartPct : 0;
    const topPct = raisedDoorPullOnRail || normalizedDoorPosition === "top-center" ? bandStart + (100 - bandStart) * 0.13 : bandStart + (100 - bandStart) * 0.5;
    const visibleDoorPieces = normalizedDoorPosition === "paired" || (normalizedDoorPosition === "auto" && doors > 1)
      ? Math.min(doors, 2)
      : 1;
    for (let index = 0; index < visibleDoorPieces; index++) {
      items.push(piece(doorPiece as "knob" | "pull", `door-${index}`, topPct, true, index));
    }
  }
  if (drawers > 0 && drawerPiece !== "none") {
    const drawerH = 100 / (drawers + (doors > 0 ? 1 : 0));
    for (let i = 0; i < drawers; i++) {
      const topPct = (doors > 0 ? drawerH : 0) + drawerH * i + drawerH / 2;
      items.push(piece(drawerPiece as "knob" | "pull" | "cup", `drawer-${i}`, topPct));
    }
  }
  return <>{items}</>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  room: RoomData;
  cabinets: PlacedCabinet[];
	  island: IslandZone;
  /** Which face of the island to show. Defaults to "front" (the side closest to the room top wall). */
  face?: IslandFace;
  selectedUid: string | null;
  /** Island cabinet currently controlled by an open Attributes panel. */
  attributesTargetUid?: string | null;
  onSelect: (uid: string | null) => void;
  countertopMaterialId?: string | null;
  finish?: FinishColors;
  crown?: boolean;
  toeKick?: boolean;
  batten?: boolean;
  lightRail?: boolean;
  panelKind?: DoorPanelKind;
  hardwareStyleId?: HardwareStyleId | null;
  /** Optional source-selected real hardware finish tint for the existing proxy. */
  hardwareAccent?: string;
  finishFor?: (cab: PlacedCabinet) => FinishColors;
  panelKindFor?: (cab: PlacedCabinet) => DoorPanelKind;
  doorSampleUrlFor?: (cab: PlacedCabinet) => string | null;
  drawerSampleUrlFor?: (cab: PlacedCabinet) => string | null;
  frameInsetFor?: (cab: PlacedCabinet) => number | null;
  frameMetricsFor?: (cab: PlacedCabinet) => { stileInches?: number | null; railInches?: number | null } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CROWN_HEIGHT_IN = 3.5;
const TOE_KICK_HEIGHT_IN = 4.5;
const LIGHT_RAIL_HEIGHT_IN = 1.5;
const BATTEN_WIDTH_IN = 1.5;
const OVERHANG_IN = 1.5;
const THICKNESS_IN = 1.5;
const TOL = 2;

// ─── Component ────────────────────────────────────────────────────────────────

export function IslandElevationView({
  room, cabinets, island, face = "front", selectedUid, attributesTargetUid = null, onSelect,
  countertopMaterialId = null,
  finish = DEFAULT_FINISH_COLORS,
  crown = false, toeKick = false, batten = false, lightRail = false,
  panelKind = "shaker", hardwareStyleId = null, hardwareAccent = "#1a2744",
  finishFor, panelKindFor, doorSampleUrlFor, drawerSampleUrlFor, frameInsetFor, frameMetricsFor,
}: Props) {
  const { t } = useLanguage();
  const hw = resolveHardwareStyle(hardwareStyleId);
  const ref = useRef<HTMLDivElement>(null);
  const [ppi, setPpi] = useState(4);
  const PADDING = 40;

	  // Every island face behaves like a wall run in this elevation.
	  const planSpan = islandFaceLength(island, face);
  // Use the room ceiling height for the wall box height.
  const WALL_TOTAL_HEIGHT = room.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;

	  const faceCabinets = cabinets.filter((cabinet) => isOnIsland(cabinet, island) && inferredIslandFace(cabinet, island) === face);

  // Sort by x position. For back view, mirror left-to-right so the viewer
  // sees the back of the island from outside (left = right when viewed from behind).
	  const reverseFace = face === "back" || face === "right";
	  const sorted = [...faceCabinets].sort((a, b) => {
    const order: Record<string, number> = { tall: 0, base: 1, appliance: 1, wall: 2 };
    const byType = (order[a.placement] ?? 1) - (order[b.placement] ?? 1);
    if (byType !== 0) return byType;
    // Back view: reverse x order so it reads naturally from the back
	    const aOffset = islandOffsetForPlaced(a, island, face);
	    const bOffset = islandOffsetForPlaced(b, island, face);
		    return reverseFace ? bOffset - aOffset : aOffset - bOffset;
		  });

	  // Island setup owns the current waterfall choice. Legacy per-cabinet flags
	  // are still respected below only when no island-level choice has been made.
	  const zoneWaterfallEnd = island.waterfallEnd ?? "none";
	  const zoneWaterfallEnds = zoneWaterfallEnd === "both"
	    ? (["left", "right"] as const)
	    : zoneWaterfallEnd === "left" || zoneWaterfallEnd === "right"
	      ? [zoneWaterfallEnd]
	      : [];

  // posAlong: offset from the island's left edge.
  // For back view, mirror: posAlong = island.right - cabinet.right
	  const sizeAlong = (p: PlacedCabinet) => {
	    const footprint = placedFootprint(p);
	    return face === "front" || face === "back" ? footprint.w : footprint.d;
	  };
	  const posAlong = (p: PlacedCabinet) => {
	    const offset = islandOffsetForPlaced(p, island, face);
	    return reverseFace ? planSpan - offset - sizeAlong(p) : offset;
	  };
	  const explicitIslandTop = islandCountertopRect(island, cabinets);

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

  const renderCabinetBox = (p: PlacedCabinet) => {
    const fp = placedFootprint(p);
    const cabSizeAlong = fp.w;
    const cabPosAlong = posAlong(p);
    const { bottom, height } = elevationBox(p, room);
    const isWall = p.placement === "wall";
    const isAppliance = p.placement === "appliance";
    const isSelected = p.uid === selectedUid;
    const isAttributesTarget = p.uid === attributesTargetUid;
    const cabFinish = finishFor ? finishFor(p) : finish;
    const cabPanelKind = panelKindFor ? panelKindFor(p) : panelKind;
    const cabDoorSampleUrl = !isAppliance && doorSampleUrlFor ? doorSampleUrlFor(p) : null;
    const cabDrawerSampleUrl = !isAppliance && drawerSampleUrlFor ? (drawerSampleUrlFor(p) ?? cabDoorSampleUrl) : cabDoorSampleUrl;
    const cabFrameInset = !isAppliance && frameInsetFor ? frameInsetFor(p) : null;
    const cabFrameMetrics = !isAppliance && frameMetricsFor ? frameMetricsFor(p) : null;
    const cabFrameStileIn = cabPanelKind === "slim-shaker"
      ? cabFrameMetrics?.stileInches ?? 1
      : undefined;
    const faceFill = isAppliance
      ? "linear-gradient(115deg, #eef1f5 0%, #d3d9e1 22%, #c2c9d4 52%, #d9dee6 78%, #c8cfd8 100%)"
      : `linear-gradient(180deg, color-mix(in srgb, ${cabFinish.face} 88%, #ffffff) 0%, ${cabFinish.face} 40%, ${cabFinish.face} 62%, color-mix(in srgb, ${cabFinish.face} 90%, #000000) 100%)`;
    const edgeColor = isAppliance ? "#6b7280" : cabFinish.edge;
    const resolvedCounts = !isAppliance ? resolveDoorDrawerCounts(p) : { doors: 0, drawers: 0 };
    const cabType: CabinetDrawingType | null = !isAppliance ? cabinetDrawingType(p) : null;
    const hasConfiguredOpening = p.openingType != null || cabType === "microwave-base";
    const configuredDisplayCounts = resolveConfiguredFaceCounts({
      numberOfDoors: p.numberOfDoors,
      numberOfDrawers: p.numberOfDrawers,
      hasConfiguredOpening,
      inferredDoors: resolvedCounts.drawers > 0 && resolvedCounts.doors === 0 ? 0 : (resolvedCounts.doors || doorCountForCabinet(p)),
      inferredDrawers: isWall ? 0 : (resolvedCounts.drawers || displayDrawerCount(p)),
    });
    // A farmhouse sink base has two doors and NO drawer faces under its apron.
    const farmhouseFace = !isAppliance && !isWall && isFarmerSinkBase(p)
      ? farmhouseSinkBaseFaceLayout(cabSizeAlong, height, configuredDisplayCounts.doors)
      : null;
    const displayCounts = farmhouseFace
      ? { doors: farmhouseFace.doorCount, drawers: 0 }
      : configuredDisplayCounts;
    const isBlind = isBlindCorner(p.masterCode, p.description);
    const blindLeft = isBlind ? (isWallBlindCornerCabinet(p) || cabPosAlong <= 2) : true;

    return (
      <div
        key={p.uid}
        onClick={(e) => { e.stopPropagation(); onSelect(p.uid); }}
        className={`absolute cursor-pointer ${isAttributesTarget ? "z-20" : ""}`}
        style={{
          left: cabPosAlong * ppi,
          width: cabSizeAlong * ppi,
          bottom: bottom * ppi,
          height: height * ppi,
          background: faceFill,
          border: isAttributesTarget ? "3px solid #a87f33" : isSelected ? "2px solid #1a2744" : `1px solid ${edgeColor}`,
          borderRadius: 2,
          boxShadow: isAttributesTarget
            ? "0 0 0 5px rgba(212,167,90,0.62), 0 0 18px rgba(212,167,90,0.48), 0 6px 14px rgba(15,23,42,0.28), inset 0 0 0 2px rgba(255,255,255,0.75)"
            : isSelected
            ? "0 0 0 3px rgba(212,167,90,0.55), 0 6px 14px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 10px rgba(0,0,0,0.16)"
            : "0 3px 7px rgba(15,23,42,0.20), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 9px rgba(0,0,0,0.14)",
          transition: "left 80ms ease-out",
          zIndex: 2,
        }}
        title={`${p.masterCode} — ${p.description}`}
        data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}
      >
        <div className="w-full h-full relative">
          {isAttributesTarget && <span data-testid="island-cabinet-attributes-target" className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 rounded-full border border-amber-200 bg-[#1a2744] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm motion-safe:animate-pulse">Editing</span>}
          {!isAppliance && (
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
              cabinetWidthIn={cabSizeAlong}
              facePattern={p.facePattern ?? null}
              frameInsetPx={cabPanelKind === "slim-shaker" ? cabFrameInset ?? 4 : undefined}
              farmhouseSinkBase={Boolean(farmhouseFace)}
            />
          )}
          {!isAppliance && hw.id !== "none" && (
            <IslandHardwareOverlay
              doors={displayCounts.doors}
              drawers={displayCounts.drawers}
              doorPiece={hw.doorPiece}
              drawerPiece={hw.drawerPiece}
              accent={hardwareAccent}
              hardwarePosition={resolveCabinetHardwarePosition(p)}
              raisedDoorPullOnRail={usesRaisedFloorWallDoorPull(p)}
              swing={resolveSwing(p)}
              faceWidthIn={cabSizeAlong}
              frameStileIn={cabFrameStileIn}
              doorBandStartPct={farmhouseFace ? farmhouseFace.apronZonePct : undefined}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
            <span className="text-[8px] font-bold truncate px-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
              style={{ color: isAppliance ? "#1a2744" : cabFinish.label }}>
              {p.masterCode}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#dde6f0] to-[#eef1f5] select-none touch-none"
      onClick={() => onSelect(null)}
    >
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
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: 0,
            height: PADDING,
            background: "repeating-linear-gradient(90deg, #d8bd97 0px, #cbae86 3px, #d8bd97 6px, #d2b389 9px), linear-gradient(180deg, #d8bd97 0%, #c2a271 100%)",
            borderTop: "3px solid #8a6f49",
            boxShadow: "inset 0 6px 10px -6px rgba(0,0,0,0.35)",
          }}
        />
        {/* Contact shadow */}
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

        {/* Wall box */}
        <div
          className="absolute"
          style={{
            width: wallPxW,
            height: wallPxH,
            left: 0,
            bottom: PADDING,
            background: "linear-gradient(to bottom, #f7f9fc 0%, #eef2f7 100%)",
            borderLeft: "2px solid #1a2744",
            borderRight: "2px solid #1a2744",
            borderTop: "2px solid #1a2744",
          }}
        >
          <div className="absolute left-0 right-0 bottom-0 border-b-[3px] border-[#1a2744]" />

          {/* Recessed support for ordinary bases and island wall cabinets set
              to the matching toe-kick treatment. */}
          {sorted
            .filter((p) => {
              if (p.cabinetId === 0) return false;
              const islandWall = isCounterHeightIslandWallCabinet(p);
              return (toeKick && (p.placement === "base" || p.placement === "tall")) || (islandWall && islandWallCabinetBaseTreatment(p) === "toe-kick");
            })
            .map((p) => {
              const cabSizeAlong = sizeAlong(p);
              const cabPosAlong = posAlong(p);
              const cabFinish = finishFor ? finishFor(p) : finish;
              return (
                <div
                  key={`tk-${p.uid}`}
                  data-selected-toe-kick-finish={toeKick ? "true" : "false"}
                  className="absolute"
                  style={{
                    left: cabPosAlong * ppi,
                    width: cabSizeAlong * ppi,
                    bottom: 0,
                    height: Math.max(2, TOE_KICK_HEIGHT_IN * ppi),
                    background: toeKick
                      ? `linear-gradient(180deg, color-mix(in srgb, ${cabFinish.face} 88%, #ffffff) 0%, ${cabFinish.face} 65%, ${cabFinish.edge} 100%)`
                      : `linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 60%, #1e1e1e 100%)`,
                    borderTop: toeKick ? `1px solid ${cabFinish.edge}` : "1px solid rgba(0,0,0,0.85)",
                    zIndex: 4,
                  }}
                />
              );
            })}

          {/* Full-depth furniture plinth selected for a counter-height island wall cabinet. */}
          {sorted
            .filter((p) => p.cabinetId !== 0 && isCounterHeightIslandWallCabinet(p) && islandWallCabinetBaseTreatment(p) === "base-molding")
            .map((p) => {
              const cabSizeAlong = sizeAlong(p);
              const cabPosAlong = posAlong(p);
              const cabFinish = finishFor ? finishFor(p) : finish;
              return <div key={`base-molding-${p.uid}`} data-island-wall-base-molding="true" className="absolute" style={{ left: cabPosAlong * ppi, width: cabSizeAlong * ppi, bottom: 0, height: Math.max(2, TOE_KICK_HEIGHT_IN * ppi), background: `linear-gradient(180deg, color-mix(in srgb, ${cabFinish.face} 88%, #ffffff) 0%, ${cabFinish.face} 70%, ${cabFinish.edge} 100%)`, borderTop: `1px solid color-mix(in srgb, ${cabFinish.face} 70%, #ffffff)`, zIndex: 4 }} />;
            })}

          {/* Floor contact shadows */}
          {sorted
            .filter((p) => (p.placement === "base" || p.placement === "tall" || p.placement === "appliance" || isCounterHeightIslandWallCabinet(p)) && p.cabinetId !== 0)
            .map((p) => {
              const cabSizeAlong = sizeAlong(p);
              const cabPosAlong = posAlong(p);
              return (
                <div
                  key={`floorshadow-${p.uid}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: cabPosAlong * ppi - 2,
                    width: cabSizeAlong * ppi + 4,
                    bottom: -2,
                    height: Math.max(4, 4 * ppi),
                    background: "radial-gradient(ellipse at center bottom, rgba(15,23,42,0.30) 0%, rgba(15,23,42,0.12) 55%, transparent 80%)",
                    zIndex: 0,
                  }}
                />
              );
            })}

          {/* Cabinet boxes */}
          {sorted.map((p) => renderCabinetBox(p))}

          {/* Duplicate per-cabinet countertop slab removed — the merged-spans
              renderer below handles the countertop correctly when a material
              is selected. The per-cabinet fallback was causing an unwanted
              warm/orange stripe at the top of every base cabinet. */}

          {/* Merged countertop spans for bases and intentional counter-height shallow island wall faces. */}
	          {countertopMaterialId && (() => {
            const mat = countertopMaterial(countertopMaterialId);
            const isBridgeable = (p: PlacedCabinet) =>
              bearsIslandCountertop(p) ||
              (p.placement === "appliance" && /^(DW|WINE)[-_]?\d/i.test(p.masterCode ?? ""));
            const spans = sorted
              .filter(isBridgeable)
              .map((p) => {
                const cabSizeAlong = sizeAlong(p);
                const cabPosAlong = posAlong(p);
                return { start: cabPosAlong, end: cabPosAlong + cabSizeAlong };
              })
              .sort((a, b) => a.start - b.start);
            if (spans.length === 0) return null;
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
                    key={`ctr${i}`}
                    className="absolute z-20 pointer-events-none rounded-[1px]"
                    style={{
                      left: (r.start - OVERHANG_IN) * ppi,
                      width: (r.end - r.start + OVERHANG_IN * 2) * ppi,
                      // Flush on top of 34.5" base cabinets; slab extends up 1.5" to 36".
                      bottom: STD.BASE_HEIGHT * ppi,
                      height: THICKNESS_IN * ppi,
                      background: mat.speckle
                        ? `linear-gradient(180deg, color-mix(in srgb, ${mat.fill} 80%, #ffffff) 0%, ${mat.fill} 45%, color-mix(in srgb, ${mat.fill} 90%, #000000) 100%)`
                        : `linear-gradient(180deg, color-mix(in srgb, ${mat.fill} 82%, #ffffff) 0%, ${mat.fill} 55%, color-mix(in srgb, ${mat.fill} 88%, #000000) 100%)`,
                      borderTop: `1px solid color-mix(in srgb, ${mat.fill} 60%, #ffffff)`,
                      borderBottom: `1px solid ${mat.edge}`,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.55)",
                    }}
                  />
                ))}
              </>
            );
	          })()}

	          {/* Island-level waterfall ends use the same saved choice as Island setup
	              and 3D. Legacy per-cabinet flags remain a fallback for older plans. */}
	          {countertopMaterialId && (() => {
	            const mat = countertopMaterial(countertopMaterialId);
	            const waterfallHeight = (STD.BASE_HEIGHT + THICKNESS_IN) * ppi;
	            const panelWidth = Math.max(2, THICKNESS_IN * ppi);
	            const commonStyle = {
	              bottom: 0,
	              height: waterfallHeight,
	              width: panelWidth,
	              background: `linear-gradient(90deg, color-mix(in srgb, ${mat.fill} 78%, #ffffff) 0%, ${mat.fill} 48%, color-mix(in srgb, ${mat.fill} 88%, #000000) 100%)`,
	              borderLeft: `1px solid ${mat.edge}`,
	              borderRight: `1px solid ${mat.edge}`,
	              boxShadow: "inset 1px 0 rgba(255,255,255,0.35), 1px 0 2px rgba(0,0,0,0.2)",
	              zIndex: 19,
	            } as const;

	            if (zoneWaterfallEnds.length > 0) {
	              if (face === "front" || face === "back") {
	                return zoneWaterfallEnds.map((physicalEnd) => {
	                  // Looking at the back reverses the apparent left/right edge.
	                  const displayedEnd = face === "back"
	                    ? (physicalEnd === "left" ? "right" : "left")
	                    : physicalEnd;
	                  return (
	                    <div
	                      key={`zone-waterfall-${physicalEnd}-${face}`}
	                      data-testid={`zone-waterfall-${physicalEnd}-${face}`}
	                      className="absolute pointer-events-none"
	                      style={{
	                        ...commonStyle,
	                        left: displayedEnd === "left"
	                          ? -OVERHANG_IN * ppi
	                          : planSpan * ppi + OVERHANG_IN * ppi - panelWidth,
	                      }}
	                    />
	                  );
	                });
	              }

	              // On an end elevation, the selected end is a full exposed vertical
	              // countertop face rather than a thin edge in the long elevation.
	              const endMatchesFace = zoneWaterfallEnds.includes(face);
	              return endMatchesFace ? (
	                <div
	                  key={`zone-waterfall-${face}-elevation`}
	                  data-testid={`zone-waterfall-${face}-elevation`}
	                  className="absolute pointer-events-none"
	                  style={{
	                    bottom: 0,
	                    left: -OVERHANG_IN * ppi,
	                    width: planSpan * ppi + OVERHANG_IN * 2 * ppi,
	                    height: waterfallHeight,
	                    background: `linear-gradient(90deg, color-mix(in srgb, ${mat.fill} 78%, #ffffff) 0%, ${mat.fill} 48%, color-mix(in srgb, ${mat.fill} 88%, #000000) 100%)`,
	                    borderLeft: `1px solid ${mat.edge}`,
	                    borderRight: `1px solid ${mat.edge}`,
	                    boxShadow: "inset 1px 0 rgba(255,255,255,0.35), 1px 0 2px rgba(0,0,0,0.2)",
	                    zIndex: 19,
	                  }}
	                />
	              ) : null;
	            }

	            return sorted
	              .filter((p) => p.placement === "base" && (p.waterfallLeft || p.waterfallRight))
	              .flatMap((p) => {
	                const cabSizeAlong = sizeAlong(p);
	                const cabPosAlong = posAlong(p);
	                return [
	                  p.waterfallLeft ? (
	                    <div key={`waterfall-left-${p.uid}`} className="absolute pointer-events-none" style={{ ...commonStyle, left: (cabPosAlong - OVERHANG_IN) * ppi }} />
	                  ) : null,
	                  p.waterfallRight ? (
	                    <div key={`waterfall-right-${p.uid}`} className="absolute pointer-events-none" style={{ ...commonStyle, left: (cabPosAlong + cabSizeAlong + OVERHANG_IN) * ppi - panelWidth }} />
	                  ) : null,
	                ].filter(Boolean);
	              });
	          })()}

	          {/* Crown molding */}
          {crown && sorted.filter((p) => p.placement === "wall").map((p) => {
            const cabSizeAlong = sizeAlong(p);
            const cabPosAlong = posAlong(p);
            const { bottom, height } = elevationBox(p, room);
            const cabF = finishFor ? finishFor(p) : finish;
            return (
              <div
                key={`crown-${p.uid}`}
                className="absolute"
                style={{
                  left: cabPosAlong * ppi - 2,
                  width: cabSizeAlong * ppi + 4,
                  bottom: (bottom + height) * ppi,
                  height: Math.max(3, CROWN_HEIGHT_IN * ppi),
                  background: cabF.face,
                  borderTop: `1.5px solid ${cabF.edge}`,
                  borderRadius: "2px 2px 0 0",
                  zIndex: 3,
                }}
              />
            );
          })}

          {/* Light rail */}
          {lightRail && sorted.filter((p) => isLightRailEligibleCabinet(p, room)).map((p) => {
            const cabSizeAlong = sizeAlong(p);
            const cabPosAlong = posAlong(p);
            const { bottom } = elevationBox(p, room);
            const cabF = finishFor ? finishFor(p) : finish;
            return (
              <div
                key={`lr-${p.uid}`}
                data-testid="light-rail-strip"
                className="absolute"
                style={{
                  left: cabPosAlong * ppi - 1,
                  width: cabSizeAlong * ppi + 2,
                  bottom: (bottom - LIGHT_RAIL_HEIGHT_IN) * ppi,
                  height: Math.max(2, LIGHT_RAIL_HEIGHT_IN * ppi),
                  background: cabF.face,
                  borderBottom: `1px solid ${cabF.edge}`,
                  borderRadius: "0 0 2px 2px",
                  zIndex: 3,
                }}
              />
            );
          })}

          {/* Batten seam strips */}
          {batten && sorted
            .filter((p) => p.cabinetId !== 0)
            .map((p, i, arr) => {
              if (i === arr.length - 1) return null;
              const next = arr[i + 1];
              const pAlong = posAlong(p);
              const pSize = sizeAlong(p);
              const nextAlong = posAlong(next);
              const pEnd = pAlong + pSize;
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
                />
              );
            })}

          {/* Faucet above sink base */}
          {sorted.filter((p) => isSinkBaseCabinet(p)).map((p) => {
            const cabSizeAlong = sizeAlong(p);
            const cabPosAlong = posAlong(p);
            const centerX = (cabPosAlong + cabSizeAlong / 2) * ppi;
            const riserH = 8 * ppi;
            const spoutW = 4 * ppi;
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
                <rect x={svgW / 2 - riserThick / 2} y={0} width={riserThick} height={riserH} fill="#8a9bb0" rx={1} />
                <rect x={svgW / 2 - spoutW} y={riserH * 0.15} width={spoutW} height={spoutThick} fill="#8a9bb0" rx={1} />
                <circle cx={svgW / 2 - spoutW} cy={riserH * 0.15 + spoutThick / 2} r={Math.max(2, 2 * ppi)} fill="#6b7d90" />
                <circle cx={svgW / 2 + knobR * 1.2} cy={riserH * 0.5} r={knobR} fill="#c0ccd8" stroke="#8a9bb0" strokeWidth={1} />
              </svg>
            );
          })}

          {/* Apron-front (farmhouse) sink rendering for FSB-* cabinets */}
          {sorted.filter((p) => isFarmerSinkBase(p)).map((p) => {
            const cabSizeAlong = sizeAlong(p);
            const cabPosAlong = posAlong(p);
            // A farmhouse sink is installed through the counter: only its shallow
            // ceramic apron covers the upper face. The styled cabinet and its toe
            // kick remain visible underneath, exactly as in wall elevations.
            const geometry = islandFarmhouseSinkElevationGeometry(cabSizeAlong);
            const apronH = geometry.apronHeightIn;
            const apronBottom = geometry.apronBottomIn;
            const sideInset = geometry.sideInsetIn;
            const apronPxH = apronH * ppi;
            const apronPxW = geometry.apronWidthIn * ppi;
            const apronLeft = (cabPosAlong + sideInset) * ppi;
            const apronBottomPx = apronBottom * ppi;
            const basinW = apronPxW * 0.78;
            const basinH = apronPxH * 0.42;
            const basinLeft = (apronPxW - basinW) / 2;
            const basinBottom = apronPxH * 0.08;
            return (
              <div
                key={`apron-${p.uid}`}
                className="absolute pointer-events-none"
                data-farm-sink-apron="true"
                data-farm-sink-mounted="countertop"
                style={{ left: apronLeft, width: apronPxW, bottom: apronBottomPx, height: apronPxH, zIndex: 6 }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, #f8f9fb 0%, #eef1f5 35%, #e4e8ee 70%, #d8dce4 100%)",
                    borderTop: "1.5px solid #c8cdd6",
                    borderLeft: "1px solid #d0d4dc",
                    borderRight: "1px solid #d0d4dc",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.08), inset 0 -1px 3px rgba(0,0,0,0.06)",
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    left: basinLeft, width: basinW, bottom: basinBottom, height: basinH,
                    background: "linear-gradient(180deg, #c8cdd6 0%, #b8bec9 40%, #a8aebb 100%)",
                    borderRadius: "3px 3px 6px 6px",
                    boxShadow: "inset 0 3px 8px rgba(0,0,0,0.22), inset 0 1px 3px rgba(0,0,0,0.15), 0 0 0 1px #9aa0ad",
                  }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: "50%", bottom: "12%",
                      width: Math.max(4, 2.5 * ppi), height: Math.max(4, 2.5 * ppi),
                      marginLeft: -(Math.max(4, 2.5 * ppi) / 2),
                      borderRadius: "50%", background: "#7a8090",
                      border: "1px solid #5a6070",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {sorted.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm text-center px-6">
              No island cabinets placed yet. Add base cabinets to the island zone in Bird's-Eye view.
            </div>
          )}
        </div>
      </div>

      {/* Island label pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-[#1a2744] bg-white/80 px-3 py-1 rounded-full shadow-sm">
        Island — {face === "back" ? "Back" : "Front"} View ({Math.round(island.width)}" wide)
      </div>
    </div>
  );
}
