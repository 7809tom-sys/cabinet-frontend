import {
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  bridgeHeightForWallHeight,
  cabinetWall,
  isMicrowaveOverRangePair,
  isOverRangeMicrowave,
  isRangeOrOven,
  mountedMicrowaveOverRangeSpot,
	OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  wallPlacementAt,
  wallRunOffset,
	wallRunSpan,
} from "@/lib/design";

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

function bridgeCandidateForRange(
  range: Pick<PlacedCabinet, "width">,
  wallCabinets: DesignCabinet[],
  wallCabinetHeight: number,
): DesignCabinet | null {
  const rangeWidth = Number(range.width);
  if (!Number.isFinite(rangeWidth) || rangeWidth <= 0) return null;
  const requiredBridgeHeight = bridgeHeightForWallHeight(wallCabinetHeight);

  const eligible = wallCabinets.filter((cabinet) => {
    const width = numberDimension(cabinet.width);
    const height = numberDimension(cabinet.height);
    const identity = `${cabinet.masterCode} ${cabinet.description} ${cabinet.subCategory ?? ""}`.toLowerCase();
    // The bridge is an actual, selected-line, solid W30 wall cabinet: exactly
    // W3012, W3015, W3018, W3021, or W3024. WSC30 is a six-inch spice cabinet
    // and can never be used here; neither can glass, refrigerator, or open-box
    // specialty wall products.
    const isSpiceCabinet = /^wsc[-_]?30$/i.test(cabinet.masterCode) || /\bspice\b/.test(identity);
    const isNonBridgeSpecialty = /\brefrigerator\b|\bglass\b|\bopen\s+box\b/.test(identity);
    const normalizedCode = cabinet.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isApprovedMicrowaveBridge = /^W30(?:12|15|18|21|24)$/.test(normalizedCode);
    return cabinet.placement === "wall"
      && Math.abs(rangeWidth - 30) <= 0.01
      && Math.abs(width - 30) <= 0.01
      && Math.abs(height - requiredBridgeHeight) <= 0.01
      && !isSpiceCabinet
      && !isNonBridgeSpecialty
      && isApprovedMicrowaveBridge;
  });

  // Keep the catalog identity and authorized price intact. A deterministic code
  // order only resolves duplicate selected-line products with the same real size.
  return eligible.sort((left, right) => {
    return left.masterCode.localeCompare(right.masterCode) || left.id - right.id;
  })[0] ?? null;
}

/**
 * Finds the selected-line short wall cabinet that sits directly on a centered
 * over-range microwave. The wall-height preference drives one of the real
 * W3012/W3015/W3018/W3021/W3024 solid-wall selections; WSC30 is intentionally
 * excluded as a spice box.
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
  const bridge = bridgeCandidateForRange(
    range,
    wallCabinets,
    wallCabinetHeight,
  );
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
