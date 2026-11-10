/**
 * A refrigerator already on the plan is a FIXED ANCHOR for Auto-Design.
 *
 * Placing a refrigerator must never block the measured build: instead of moving
 * it, re-sizing it, or refusing to build, the build keeps the appliance exactly
 * where the person put it, reserves its floor space, and designs the base runs,
 * corners, tall boxes and wall cabinets around it. The refrigerator surround
 * (end panels and the cabinet above) still gets built around the appliance, but
 * a surround piece that cannot fit — a corner-side panel with no wall left, or a
 * panel where a cabinet already stands — is omitted and named instead of moving
 * the refrigerator.
 */
import {
  appendCollisionFreePlacements,
  cabinetWall,
  isPanelItem,
  isRefrigerator,
  refrigeratorEndPanelConflictDetail,
  wallLength,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  wallLabelToEngineWallId,
  autoDesignWallNameByEngineId,
  type AutoDesignMeasurement,
  type AutoDesignOriginCorner,
  type AutoDesignRunDirection,
  type WallLabel,
} from "./autoDesignAutoBuild";
import { buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { isRefrigeratorAppliance, type RefrigeratorLike } from "./autoDesignAvailability";

/** The refrigerator this build adopts as a fixed anchor, or null. */
export function anchoredRefrigeratorOf(
  items: readonly PlacedCabinet[],
): PlacedCabinet | null {
  return items.find((item) => isRefrigerator(item) || isRefrigeratorAppliance(item as RefrigeratorLike)) ?? null;
}

/** True when a placed item is the fixed refrigerator anchor. */
export function isAnchoredRefrigerator(
  item: RefrigeratorLike & { placement?: string | null },
  anchorUid: string | null | undefined,
): boolean {
  if (!anchorUid) return false;
  return item.uid === anchorUid;
}

/**
 * The anchor measurement for a refrigerator that is already placed, expressed in
 * the Auto-Design wall-label datum. Null when the appliance does not stand on a
 * wall this build can name (then it stays a plain obstacle).
 */
export function refrigeratorAnchorMeasurement(input: {
  refrigerator: PlacedCabinet;
  room: RoomData;
  originCorner: AutoDesignOriginCorner;
  runDirection: AutoDesignRunDirection;
}): AutoDesignMeasurement | null {
  const wallId = cabinetWall(input.refrigerator, input.room);
  const label = autoDesignWallNameByEngineId(input.room, input.originCorner, input.runDirection)[wallId] as WallLabel | undefined;
  if (!label) return null;
  const ref = wallLabelToEngineWallId(label, input.room, input.originCorner, input.runDirection);
  if (!ref) return null;
  const start = wallRunOffset(input.refrigerator, wallId, input.room);
  const centerFromPhysicalStart = start + wallRunSpan(input.refrigerator, wallId, input.room) / 2;
  // The label datum may run from the far physical end of the wall.
  const centerOffsetIn = ref.startCorner === "start"
    ? centerFromPhysicalStart
    : ref.frame.length - centerFromPhysicalStart;
  if (!Number.isFinite(centerOffsetIn) || centerOffsetIn < 0) return null;
  return { wallLabel: label, centerOffsetIn };
}

export type AnchoredRefrigeratorBay = {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  /** Full physical span the base and upper runs must leave for the bay. */
  reservation: { wall: string; start: number; end: number } | null;
  notes: string[];
};

/** The span the appliance alone occupies, used when no surround can be built. */
export function refrigeratorFloorReservation(
  refrigerator: PlacedCabinet,
  room: RoomData,
): { wall: string; start: number; end: number } | null {
  const wall = cabinetWall(refrigerator, room);
  if (!wall) return null;
  const start = wallRunOffset(refrigerator, wall, room);
  const end = start + wallRunSpan(refrigerator, wall, room);
  return end > start ? { wall, start, end } : null;
}

function panelIsInsideRun(panel: PlacedCabinet, wall: string, room: RoomData): boolean {
  const runLength = wallLength(wall as never, room);
  const start = panel.wallId === wall && Number.isFinite(Number(panel.wallOffset))
    ? Number(panel.wallOffset)
    : wallRunOffset(panel, wall, room);
  return start >= -0.05 && start + wallRunSpan(panel, wall, room) <= runLength + 0.05;
}

/**
 * Build the refrigerator bay around a refrigerator that is already placed,
 * without moving it. The appliance keeps its exact plan position and floor
 * space; the panels and the cabinet above are fitted around it, and any piece
 * that cannot fit is omitted with a plain note.
 */
export function buildAnchoredRefrigeratorBay(input: {
  placed: readonly PlacedCabinet[];
  refrigerator: PlacedCabinet;
  room: RoomData;
  caps: readonly DesignCabinet[];
  endPanels: readonly DesignCabinet[];
  styleId: number | null;
  makeUid: () => string;
  wallCabinetHeightIn?: number;
  framelessLine?: boolean;
}): AnchoredRefrigeratorBay {
  const { room, refrigerator } = input;
  const wall = cabinetWall(refrigerator, room);
  const floorReservation = refrigeratorFloorReservation(refrigerator, room);
  const notes: string[] = [];
  const bay = buildMandatoryAutoDesignRefrigeratorBay({
    refrigerator,
    room,
    caps: input.caps,
    endPanels: input.endPanels,
    styleId: input.styleId,
    makeUid: input.makeUid,
    wallCabinetHeightIn: input.wallCabinetHeightIn,
    framelessLine: input.framelessLine,
  });
  if (!bay.ok) {
    notes.push(`The refrigerator surround was not added: ${bay.message} The refrigerator itself stays exactly where it is.`);
    return { placed: [...input.placed], additions: [], reservation: floorReservation, notes };
  }

  const frame = wallRunFrame(wall, room);
  const others = input.placed.filter((item) => item.uid !== refrigerator.uid);
  const additions: PlacedCabinet[] = [];
  let working = [...input.placed];
  let start = floorReservation?.start ?? bay.reservation.start;
  let end = floorReservation?.end ?? bay.reservation.end;
  for (const addition of bay.additions) {
    if (isPanelItem(addition)) {
      if (frame && !panelIsInsideRun(addition, wall, room)) {
        notes.push(`${addition.masterCode} was not added on the closed corner side of the refrigerator; the refrigerator stays where it is.`);
        continue;
      }
      if (refrigeratorEndPanelConflictDetail(addition, others, refrigerator.uid, room)) {
        notes.push(`${addition.masterCode} was not added because a cabinet already stands at that side of the refrigerator; the refrigerator stays where it is.`);
        continue;
      }
      working = [...working, addition];
      additions.push(addition);
    } else {
      const accepted = appendCollisionFreePlacements(working, [addition], room);
      if (accepted.rejected.some((item) => item.uid === addition.uid)) {
        notes.push(`${addition.masterCode} above the refrigerator was not added because that space is already occupied; the refrigerator stays where it is.`);
        continue;
      }
      working = accepted.placed;
      additions.push(addition);
    }
    const pieceStart = addition.wallId === wall && Number.isFinite(Number(addition.wallOffset))
      ? Number(addition.wallOffset)
      : wallRunOffset(addition, wall, room);
    start = Math.min(start, pieceStart);
    end = Math.max(end, pieceStart + wallRunSpan(addition, wall, room));
  }
  if (Number(refrigerator.depth) > 24.05) {
    notes.push(`The refrigerator's 24" end panels finish at the panel line; the appliance keeps its wall position and floor space.`);
  }
  return {
    placed: working,
    additions,
    reservation: end > start ? { wall, start, end } : floorReservation,
    notes,
  };
}
