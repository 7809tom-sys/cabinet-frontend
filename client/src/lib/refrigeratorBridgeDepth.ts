/**
 * Owner rule (Tom, Nov 6 2026): whenever a refrigerator panel is used, the
 * cabinet above the refrigerator comes forward so its front sits flush with the
 * panel face.
 *
 * This is the DEPTH rule only: it moves a cabinet along the wall's inward
 * normal and never touches its height. The height rule (the cabinet's top lines
 * up with the other uppers) is decided in `autoDesignRefrigeratorBay`.
 *
 * It is its own module because four code paths seat that cabinet — the
 * Auto-Design bay, the refrigerator attributes pop-up, the option fitter, and
 * the load-time containment pass. Every one of them used to leave it at the wall
 * plane, and any pass that re-seats a wall cabinet from `wallPlacementAt()`
 * returns it to the wall. That is what left the bridge set back from its panels
 * in plan and in 3D.
 */
import {
  cabinetFrontIn,
  cabinetWall,
  isRefrigerator,
  isRefrigeratorEndPanel,
  seatCabinetFrontIn,
  wallRunFrame,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

/** Sub-1/16 inch catalog noise is not a depth difference. */
export const REFRIGERATOR_BRIDGE_FACE_EPSILON_IN = 1 / 16;

/** The finished front plane of a refrigerator bay: its end panels, else the appliance. */
export function refrigeratorBayFaceIn(
  placed: readonly PlacedCabinet[],
  refrigeratorUid: string,
  room: RoomData,
): { wallId: WallSide; faceIn: number } | null {
  const refrigerator = placed.find((item) => item.uid === refrigeratorUid && isRefrigerator(item));
  if (!refrigerator) return null;
  const wallId = cabinetWall(refrigerator, room) as WallSide;
  if (!wallRunFrame(wallId, room)) return null;
  const panelFronts = placed
    .filter((item) => item.refrigeratorAssemblyId === refrigeratorUid
      && (item.refrigeratorAssemblyRole === "left-panel"
        || item.refrigeratorAssemblyRole === "right-panel"
        || isRefrigeratorEndPanel(item)))
    .map((panel) => cabinetFrontIn(panel, wallId, room))
    .filter((front) => front > 0);
  const faceIn = panelFronts.length ? Math.min(...panelFronts) : cabinetFrontIn(refrigerator, wallId, room);
  return { wallId, faceIn };
}

/**
 * The depth rule. An over-refrigerator cabinet whose front is set back from the
 * bay's finished face is pulled forward until the two are flush. A cabinet deeper
 * than the panel is the caller's cut-back case (so it can name the cut), and is
 * left alone here.
 */
export function pullRefrigeratorBridgeFlush(input: {
  cabinet: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  refrigeratorUid: string;
  room: RoomData;
}): PlacedCabinet {
  if (input.cabinet.refrigeratorAssemblyRole !== "bridge") return input.cabinet;
  const bay = refrigeratorBayFaceIn(input.placed, input.refrigeratorUid, input.room);
  if (!bay) return input.cabinet;
  const depth = Math.max(0, Number(input.cabinet.depth) || 0);
  if (depth <= 0 || depth > bay.faceIn + REFRIGERATOR_BRIDGE_FACE_EPSILON_IN) return input.cabinet;
  if (Math.abs(cabinetFrontIn(input.cabinet, bay.wallId, input.room) - bay.faceIn) <= REFRIGERATOR_BRIDGE_FACE_EPSILON_IN) {
    return input.cabinet;
  }
  return {
    ...seatCabinetFrontIn(input.cabinet, bay.wallId, bay.faceIn, input.room),
    depthPositionAdjusted: true,
  };
}

/**
 * The depth rule for a whole plan, run after every pass that can re-seat a wall
 * cabinet. Only a bridge that is set back moves, so a flush bay is untouched and
 * a cabinet deeper than its panel is left for the cut-back pass to explain.
 */
export function normalizeRefrigeratorBridgeDepth(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet[] {
  const bridgeUids = placed
    .filter((item) => item.refrigeratorAssemblyRole === "bridge" && item.refrigeratorAssemblyId != null)
    .map((item) => item.uid);
  if (!bridgeUids.length) return placed as PlacedCabinet[];
  let changed = false;
  const next = placed.map((item) => {
    if (item.refrigeratorAssemblyRole !== "bridge" || !item.refrigeratorAssemblyId) return item;
    const pulled = pullRefrigeratorBridgeFlush({
      cabinet: item,
      placed,
      refrigeratorUid: item.refrigeratorAssemblyId,
      room,
    });
    if (pulled === item) return item;
    changed = true;
    return pulled;
  });
  return changed ? next : placed as PlacedCabinet[];
}
