import {
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  isRangeOrOven,
  isMicrowaveOverRangePair,
  isOverRangeMicrowave,
  mountedMicrowaveOverRangeSpot,
	OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  wallCeilingMin,
  cabinetWall,
  wallPlacementAt,
  wallRunOffset,
	wallRunSpan,
} from "@/lib/design";
import { overRangeBridgeFor } from "@/lib/overRangeCompanion";

/**
 * A source-backed proposal for an over-range microwave with its short bridge
 * cabinet. The proposal is deliberately separate from the placement mutation:
 * the caller must ask the user before adding anything and must run the normal
 * room-aware collision gate at commit time.
 */
export type RangeCompanionProposal = {
  bridge: DesignCabinet;
  microwave: DesignCabinet;
  bridgeSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  microwaveSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  microwaveMountBottom: number;
  bridgeMountBottom: number;
};

/** Every short wall cabinet above an over-range microwave begins at this datum. */
export const OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM;

function numberDimension(value: string | number | null | undefined): number {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function wallCeilingFor(range: PlacedCabinet, room: RoomData): number | null {
  const wall = cabinetWall(range, room);
  return wall ? wallCeilingMin(room, wall) : null;
}

/**
 * Finds the selected-line short wall cabinet that sits directly on a centered
 * over-range microwave. The wall-height preference drives one of the real
 * W3012/W3015/W3018/W3021/W3024 solid-wall selections; WSC30 is intentionally
 * excluded as a spice box.
 *
 * The size comes from `overRangeBridgeFor` in `overRangeCompanion.ts` — the same
 * selector the mandatory build pass uses. It matches the RANGE width first and
 * then the height tolerantly (a frameless line sells 17⅝" where a framed line
 * sells 18"), so this prompt can never offer a different bridge than the build
 * places.
 */
export function rangeCompanionProposal(
  range: PlacedCabinet,
  room: RoomData,
  wallCabinets: DesignCabinet[],
  appliancePalette: DesignCabinet[],
  wallCabinetHeight: number = 30,
): RangeCompanionProposal | null {
  const rangeWidth = Number(range.width);
  if (!Number.isFinite(rangeWidth) || rangeWidth <= 0) return null;

  const microwave = appliancePalette.find((item) => (
    item.placement === "appliance"
    && /^MW[-_]?\d/i.test(item.masterCode)
    && Math.abs(numberDimension(item.width) - rangeWidth) <= 0.01
  )) ?? null;
  if (!microwave) return null;

  const microwaveHeight = numberDimension(microwave.height);
  if (!microwaveHeight) return null;
  const microwaveBottom = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN - microwaveHeight;
  const bridge = overRangeBridgeFor({
    rangeWidthIn: rangeWidth,
    wallCabinetHeightIn: wallCabinetHeight,
    wallCatalog: wallCabinets,
    ceilingIn: wallCeilingFor(range, room),
  });
  if (!bridge) return null;

  const microwaveWidth = numberDimension(microwave.width);
  const microwaveDepth = numberDimension(microwave.depth);
  const bridgeWidth = numberDimension(bridge.width);
  const bridgeDepth = numberDimension(bridge.depth);
  const bridgeHeight = numberDimension(bridge.height);
  if (!microwaveWidth || !microwaveDepth || !bridgeWidth || !bridgeDepth || !bridgeHeight) return null;

  const microwaveSpot = mountedMicrowaveOverRangeSpot({ width: microwaveWidth, depth: microwaveDepth }, range, room);
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const bridgeStart = rangeStart + rangeWidth / 2 - bridgeWidth / 2;
  const bridgeSpot = wallPlacementAt(bridgeStart, bridgeWidth, bridgeDepth, side, room);

  // The bridge starts at the fixed 72-inch microwave datum. The 16-inch MW-30
  // finishes exactly at that line, so the real W30 bridge rests on it without a
  // gap. Its 12/15/18/21/24-inch height then ends at 84/87/90/93/96 inches.
  return {
    bridge,
    microwave,
    bridgeSpot,
    microwaveSpot,
    microwaveMountBottom: microwaveBottom,
    bridgeMountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN,
  };
}

function normalizedCode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Repairs an old automatic WSC30-above-MW arrangement when—and only when—it is
 * directly centered over a real MW-30/range pair. WSC30 remains untouched
 * everywhere else, including an intentional separate spice stack. The legacy
 * record is overwritten with the selected, source-backed W30 bridge so its
 * original WSC30 SKU can no longer appear in the invoice or material list.
 */
export function repairLegacyWscMicrowaveBridges(
  placed: PlacedCabinet[],
  room: RoomData,
  wallCabinets: DesignCabinet[],
  appliancePalette: DesignCabinet[],
  wallCabinetHeight: number,
): { placed: PlacedCabinet[]; repairedUids: string[] } {
  let repaired = false;
  const repairedUids: string[] = [];
  const next = placed.map((candidate) => {
    if (candidate.placement !== "wall" || normalizedCode(candidate.masterCode) !== "WSC30") return candidate;
    const side = cabinetWall(candidate, room);
    const candidateCenter = wallRunOffset(candidate, side, room) + wallRunSpan(candidate, side, room) / 2;
    const microwave = placed.find((item) => (
      isOverRangeMicrowave(item)
      && cabinetWall(item, room) === side
      && Math.abs(wallRunOffset(item, side, room) + wallRunSpan(item, side, room) / 2 - candidateCenter) <= 0.5
      && placed.some((range) => isRangeOrOven(range.masterCode, range.description) && isMicrowaveOverRangePair(item, range))
    ));
    if (!microwave) return candidate;
    const range = placed.find((item) => isRangeOrOven(item.masterCode, item.description) && isMicrowaveOverRangePair(microwave, item));
    if (!range) return candidate;
    // If an actual source-backed bridge is already aligned to this microwave,
    // WSC30 may be an intentionally separate item and is left alone.
    const alreadyHasBridge = placed.some((item) => (
      item.uid !== candidate.uid
      && item.overRangeMicrowaveBridge === true
      && cabinetWall(item, room) === side
      && Math.abs(wallRunOffset(item, side, room) + wallRunSpan(item, side, room) / 2 - candidateCenter) <= 0.5
    ));
    if (alreadyHasBridge) return candidate;
    const proposal = rangeCompanionProposal(range, room, wallCabinets, appliancePalette, wallCabinetHeight);
    if (!proposal) return candidate;
    repaired = true;
    repairedUids.push(candidate.uid);
    return {
      ...candidate,
      cabinetId: proposal.bridge.id,
      masterCode: proposal.bridge.masterCode,
      description: proposal.bridge.description,
      category: proposal.bridge.category,
      subCategory: proposal.bridge.subCategory,
      placement: "wall" as const,
      x: proposal.bridgeSpot.x,
      y: proposal.bridgeSpot.y,
      width: Number(proposal.bridge.width),
      depth: Number(proposal.bridge.depth),
      height: Number(proposal.bridge.height),
      rotation: proposal.bridgeSpot.rotation,
      numberOfDoors: proposal.bridge.numberOfDoors,
      numberOfDrawers: proposal.bridge.numberOfDrawers,
      catalogImageUrl: proposal.bridge.catalogImageUrl ?? null,
      mountBottom: proposal.bridgeMountBottom,
      mountBottomAdjusted: true,
      overRangeMicrowaveBridge: true,
      spiceStackParentUid: null,
      ...(proposal.bridgeSpot.wallId ? { wallId: proposal.bridgeSpot.wallId, wallOffset: proposal.bridgeSpot.wallOffset ?? 0 } : {}),
    };
  });
  return repaired ? { placed: next, repairedUids } : { placed, repairedUids };
}

export const rangeCompanionDimensions = numberDimension;
