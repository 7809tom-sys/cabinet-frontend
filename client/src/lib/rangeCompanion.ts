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
  adjoiningUpperIn,
  MICROWAVE_BRIDGE_HEIGHT_BY_NEIGHBOR_IN,
  microwaveBridgeHeightForNeighbor,
} from "@/lib/design";
import { bridgeFamilyGeometry, overRangeBridgeFor } from "@/lib/overRangeCompanion";

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
  /** The five bridge heights offered over the microwave, in order. */
  bridgeChoices: RangeBridgeHeightChoice[];
  /** The offered height `bridge` is; null when the line sells none of the five at this width. */
  bridgeHeightIn: number | null;
};

/** Tom's rule (Nov 8): the cabinet over the microwave is one of exactly these heights. */
export const RANGE_BRIDGE_HEIGHTS_IN = [12, 15, 18, 21, 24] as const;

export type RangeBridgeHeightChoice = {
  heightIn: number;
  /** Where the bridge's top lands: the 72" datum plus the real box height. */
  topIn: number;
  /** The selected line's real catalog row, or null when the choice is disabled. */
  bridge: DesignCabinet | null;
  disabledReason: string | null;
};

/** A frameless line sells 17-5/8" where a framed line sells 18"; both are the 18" choice. */
const BRIDGE_HEIGHT_MATCH_TOLERANCE_IN = 0.5;

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
/**
 * One choice per offered height for a bridge as wide as the range. A choice is
 * enabled only for a real selected-line SKU (W3012..W3024 for a 30" range)
 * whose top still clears the ceiling; otherwise it carries the reason.
 */
export function rangeBridgeHeightChoices(input: {
  rangeWidthIn: number;
  wallCatalog: readonly DesignCabinet[];
  ceilingIn?: number | null;
  lineName?: string | null;
}): RangeBridgeHeightChoice[] {
  const width = Number(input.rangeWidthIn);
  const ceiling = Number(input.ceilingIn);
  const line = input.lineName?.trim() ? `the ${input.lineName.trim()}` : "the selected door line's";
  const rows = input.wallCatalog
    .map((cabinet) => ({ cabinet, geometry: bridgeFamilyGeometry(cabinet) }))
    .filter((row): row is { cabinet: DesignCabinet; geometry: { width: number; height: number } } => (
      row.geometry != null && Math.abs(row.geometry.width - width) <= 0.01
    ));
  return RANGE_BRIDGE_HEIGHTS_IN.map((heightIn) => {
    const sku = `W${Math.round(width)}${heightIn}`;
    const bridge = rows
      .filter((row) => Math.abs(row.geometry.height - heightIn) <= BRIDGE_HEIGHT_MATCH_TOLERANCE_IN)
      .sort((left, right) => (
        Math.abs(left.geometry.height - heightIn) - Math.abs(right.geometry.height - heightIn)
        || left.cabinet.masterCode.localeCompare(right.cabinet.masterCode)
        || left.cabinet.id - right.cabinet.id
      ))[0]?.cabinet ?? null;
    const topIn = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN + (bridge ? numberDimension(bridge.height) : heightIn);
    if (!bridge) {
      return { heightIn, topIn, bridge: null, disabledReason: `${sku} is not in ${line} catalog.` };
    }
    if (Number.isFinite(ceiling) && ceiling > 0 && topIn > ceiling + 0.01) {
      return { heightIn, topIn, bridge: null, disabledReason: `${bridge.masterCode} would end at ${topIn}″, past the ${ceiling}″ ceiling.` };
    }
    return { heightIn, topIn, bridge, disabledReason: null };
  });
}

/**
 * The preselected height. A 30/36/42" neighbour maps to its 12/18/24" bridge
 * (Tom, Nov 8); 15" and 21" stay selectable but are never the default for those
 * three, so if the mapped SKU is unavailable the fallback stays among 12/18/24.
 * Any other neighbour height takes the tallest enabled choice whose top does not
 * pass the neighbours' top line (or the shortest, when every choice passes it).
 */
export function preselectedRangeBridgeHeight(
  choices: readonly RangeBridgeHeightChoice[],
  upperTopLineIn: number | null,
  neighborHeightIn: number | null = null,
): number | null {
  const enabled = choices.filter((choice) => choice.bridge != null);
  if (enabled.length === 0) return null;
  const mapped = microwaveBridgeHeightForNeighbor(neighborHeightIn);
  if (mapped != null && enabled.some((choice) => choice.heightIn === mapped)) return mapped;
  const mappedHeights = Object.values(MICROWAVE_BRIDGE_HEIGHT_BY_NEIGHBOR_IN);
  const mappedCandidates = enabled.filter((choice) => mappedHeights.includes(choice.heightIn));
  const candidates = mapped != null && mappedCandidates.length > 0 ? mappedCandidates : enabled;
  if (upperTopLineIn == null || !Number.isFinite(upperTopLineIn)) return candidates[candidates.length - 1]!.heightIn;
  const fitting = candidates.filter((choice) => choice.topIn <= upperTopLineIn + 0.01);
  return (fitting.length ? fitting[fitting.length - 1]! : candidates[0]!).heightIn;
}

/** The upper beside the range's bridge span that sets the top line, with its height. */
export function rangeAdjoiningUpperIn(
  range: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  bridgeWidthIn?: number,
): { topIn: number; heightIn: number } | null {
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const rangeWidth = Number(range.width);
  const width = Number(bridgeWidthIn) > 0 ? Number(bridgeWidthIn) : rangeWidth;
  const start = rangeStart + rangeWidth / 2 - width / 2;
  return adjoiningUpperIn(side, start, start + width, placed, room, [range.uid], range);
}

/** The dialog sentence, written for the chosen height. */
export function rangeCompanionSummary(proposal: Pick<RangeCompanionProposal, "bridge" | "microwave" | "bridgeMountBottom">): string {
  const microwaveHeight = numberDimension(proposal.microwave.height);
  const top = proposal.bridgeMountBottom + numberDimension(proposal.bridge.height);
  return `The ${microwaveHeight}″ ${proposal.microwave.masterCode} ends at the fixed ${proposal.bridgeMountBottom}″ bridge datum. The selected ${numberDimension(proposal.bridge.height)}″ ${proposal.bridge.masterCode} begins at ${proposal.bridgeMountBottom}″ and ends at ${top}″.`;
}

/** The detail line under the item list, written for the chosen height. */
export function rangeCompanionDetail(proposal: Pick<RangeCompanionProposal, "bridge" | "microwave" | "bridgeMountBottom" | "microwaveMountBottom">): string {
  const microwaveHeight = numberDimension(proposal.microwave.height);
  const top = proposal.bridgeMountBottom + numberDimension(proposal.bridge.height);
  return `The ${microwaveHeight}″ ${proposal.microwave.masterCode} runs from ${proposal.microwaveMountBottom}″ to ${proposal.bridgeMountBottom}″. The selected real ${proposal.bridge.masterCode} begins at ${proposal.bridgeMountBottom}″ with no gap or trim and ends at ${top}″.`;
}

export function rangeCompanionProposal(
  range: PlacedCabinet,
  room: RoomData,
  wallCabinets: DesignCabinet[],
  appliancePalette: DesignCabinet[],
  wallCabinetHeight: number = 30,
  options: {
    /** The plan the range sits in; its uppers beside the range drive the preselected height. */
    placed?: readonly PlacedCabinet[];
    /** The height the person chose in the pop-up. Ignored when that choice is disabled. */
    bridgeHeightIn?: number | null;
    lineName?: string | null;
  } = {},
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
  const ceilingIn = wallCeilingFor(range, room);
  const bridgeChoices = rangeBridgeHeightChoices({ rangeWidthIn: rangeWidth, wallCatalog: wallCabinets, ceilingIn, lineName: options.lineName });
  const requested = bridgeChoices.find((choice) => choice.heightIn === options.bridgeHeightIn && choice.bridge != null);
  // The shared build selector sizes a bridge from the wall-height setting. Its
  // top stands in for the upper line when no upper adjoins the range yet, and
  // it is the fallback when the line sells none of the five at this width.
  const settingBridge = overRangeBridgeFor({
    rangeWidthIn: rangeWidth,
    wallCabinetHeightIn: wallCabinetHeight,
    wallCatalog: wallCabinets,
    ceilingIn,
  });
  const neighbor = options.placed ? rangeAdjoiningUpperIn(range, options.placed, room) : null;
  // Without an adjoining upper yet, the wall-height setting is the neighbour.
  const upperTopLine = neighbor?.topIn
    ?? (settingBridge ? OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN + numberDimension(settingBridge.height) : null);
  const neighborHeight = neighbor?.heightIn ?? wallCabinetHeight;
  const preselected = requested?.heightIn ?? preselectedRangeBridgeHeight(bridgeChoices, upperTopLine, neighborHeight);
  const chosen = bridgeChoices.find((choice) => choice.heightIn === preselected)?.bridge ?? null;
  const bridge = chosen ?? settingBridge;
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
    bridgeChoices,
    bridgeHeightIn: chosen ? preselected : null,
  };
}

/**
 * The placed record for an approved companion. The bridge carries exactly the
 * chosen catalog row (id, SKU, size), which is what the cart and quote bill.
 */
export function rangeCompanionPlacement(
  source: DesignCabinet,
  spot: RangeCompanionProposal["bridgeSpot"],
  mountBottom: number,
  uid: string,
  styleId: number | null,
): PlacedCabinet {
  return {
    uid,
    cabinetId: source.id,
    masterCode: source.masterCode,
    description: source.description,
    category: source.category,
    subCategory: source.subCategory,
    placement: source.placement,
    x: spot.x,
    y: spot.y,
    width: Number(source.width),
    depth: Number(source.depth),
    height: Number(source.height),
    rotation: spot.rotation,
    numberOfDoors: source.numberOfDoors,
    numberOfDrawers: source.numberOfDrawers,
    catalogImageUrl: source.catalogImageUrl ?? null,
    mountBottom,
    // A W30 microwave bridge is a named installation exception: it begins
    // at the owner's fixed 72-inch datum, not the ordinary 54-inch wall
    // cabinet datum. Preserve that value through save/restore normalization.
    ...(source.placement === "wall" ? { mountBottomAdjusted: true, overRangeMicrowaveBridge: true } : {}),
    styleId,
    ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset ?? 0 } : {}),
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
    const proposal = rangeCompanionProposal(range, room, wallCabinets, appliancePalette, wallCabinetHeight, { placed });
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
