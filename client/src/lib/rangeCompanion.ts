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
} from "@/lib/design";
import {
  bridgeMissingAtRangeWidthReason,
  microwaveBridgeClearsCeiling,
  overRangeBridgeCandidates,
  overRangeBridgeLabel,
  microwaveBridgeHeightPick,
  overRangeSettingTopLineIn,
} from "@/lib/overRangeCompanion";

/**
 * A source-backed proposal for an over-range microwave with its short bridge
 * cabinet. The proposal is deliberately separate from the placement mutation:
 * the caller must ask the user before adding anything and must run the normal
 * room-aware collision gate at commit time.
 */
export type RangeCompanionProposal = {
  /** The chosen enabled height's real SKU; null when no height can be added (see bridgeUnavailableReason). */
  bridge: DesignCabinet | null;
  microwave: DesignCabinet;
  bridgeSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  microwaveSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  microwaveMountBottom: number;
  bridgeMountBottom: number;
  /** The five bridge heights offered over the microwave, in order. */
  bridgeChoices: RangeBridgeHeightChoice[];
  /** The offered height `bridge` is; null when every one of the five is disabled. */
  bridgeHeightIn: number | null;
  /** Shown in the pop-up when `bridge` is null; nothing is added in that case. */
  bridgeUnavailableReason: string | null;
};

/** Tom's rule (Nov 8): the cabinet over the microwave is one of exactly these heights. */
export const RANGE_BRIDGE_HEIGHTS_IN = [12, 15, 18, 21, 24] as const;

export type RangeBridgeHeightChoice = {
  heightIn: number;
  /** Where the bridge's top lands: the 72" datum plus the real box height. */
  topIn: number;
  /**
   * The selected line's real catalog row, or null when the choice is disabled.
   * A turned cabinet is its turned view (`turnedSideways`, width/height swapped).
   */
  bridge: DesignCabinet | null;
  /** True when this height is a single-door cabinet turned horizontal (W1836 over a 36" range). */
  turned: boolean;
  /** The picker label: "W3018", or "W1836 turned horizontal". Null when disabled. */
  label: string | null;
  disabledReason: string | null;
  disabledBy: "missing" | "ceiling" | null;
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
/**
 * One choice per offered height for a bridge as wide as the range, from the
 * same `overRangeBridgeCandidates` the build uses. A real W{range}{height}
 * bridge when the line sells any at the range width; otherwise a single-door
 * W{height}{range} turned horizontal for 12-21" (never 24": a W24 has two
 * doors). A choice is enabled only when that row exists and its top clears the
 * ceiling; otherwise it carries the reason.
 */
export function rangeBridgeHeightChoices(input: {
  rangeWidthIn: number;
  wallCatalog: readonly DesignCabinet[];
  ceilingIn?: number | null;
  lineName?: string | null;
}): RangeBridgeHeightChoice[] {
  const width = Number(input.rangeWidthIn);
  const w = Math.round(width);
  const ceiling = Number(input.ceilingIn);
  const line = input.lineName?.trim() ? `the ${input.lineName.trim()}` : "the selected door line's";
  const candidates = overRangeBridgeCandidates(width, input.wallCatalog);
  return RANGE_BRIDGE_HEIGHTS_IN.map((heightIn): RangeBridgeHeightChoice => {
    const bridge = candidates.byHeight.get(heightIn) ?? null;
    const topIn = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN + (bridge ? numberDimension(bridge.height) : heightIn);
    if (!bridge) {
      const reason = candidates.kind !== "turned"
        ? `W${w}${heightIn} is not in ${line} catalog.`
        : heightIn === 24
          ? `W${w}24 is not in ${line} catalog, and a two-door W24${w} cannot be turned horizontal.`
          : `Neither W${w}${heightIn} nor a single-door W${heightIn}${w} to turn horizontal is in ${line} catalog.`;
      return { heightIn, topIn, bridge: null, turned: false, label: null, disabledReason: reason, disabledBy: "missing" };
    }
    const label = overRangeBridgeLabel(bridge);
    if (!microwaveBridgeClearsCeiling(topIn - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN, ceiling)) {
      return { heightIn, topIn, bridge: null, turned: false, label: null, disabledReason: `${label} would end at ${topIn}″, past the ${ceiling}″ ceiling.`, disabledBy: "ceiling" };
    }
    return { heightIn, topIn, bridge, turned: bridge.turnedSideways === true, label, disabledReason: null, disabledBy: null };
  });
}

/** The preselected height: `microwaveBridgeHeightPick` over the enabled choices, as the build picks. */
export function preselectedRangeBridgeHeight(
  choices: readonly RangeBridgeHeightChoice[],
  upperTopLineIn: number | null,
  neighborHeightIn: number | null = null,
): number | null {
  return microwaveBridgeHeightPick(choices.filter((choice) => choice.bridge != null), upperTopLineIn, neighborHeightIn);
}

/** Why no bridge can go over this range: no SKU at the range width, or none that clears the ceiling. */
export function rangeBridgeUnavailableReason(choices: readonly RangeBridgeHeightChoice[], rangeWidthIn: number, lineName?: string | null): string {
  const width = Math.round(rangeWidthIn);
  return choices.every((choice) => choice.disabledBy === "missing")
    ? bridgeMissingAtRangeWidthReason(width, lineName)
    : `None of the ${width}″-wide bridges fits this room (see the heights above), so no cabinet can be added over the microwave.`;
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
export function rangeCompanionSummary(proposal: Pick<RangeCompanionProposal, "bridge" | "microwave" | "bridgeMountBottom"> & { bridgeUnavailableReason?: string | null }): string {
  const microwaveHeight = numberDimension(proposal.microwave.height);
  if (!proposal.bridge) return proposal.bridgeUnavailableReason ?? "No bridge cabinet can be added over this range.";
  const top = proposal.bridgeMountBottom + numberDimension(proposal.bridge.height);
  return `The ${microwaveHeight}″ ${proposal.microwave.masterCode} ends at the fixed ${proposal.bridgeMountBottom}″ bridge datum. The selected ${numberDimension(proposal.bridge.height)}″ ${overRangeBridgeLabel(proposal.bridge)} begins at ${proposal.bridgeMountBottom}″ and ends at ${top}″.`;
}

/** The detail line under the item list, written for the chosen height. */
export function rangeCompanionDetail(proposal: Pick<RangeCompanionProposal, "bridge" | "microwave" | "bridgeMountBottom" | "microwaveMountBottom">): string {
  const microwaveHeight = numberDimension(proposal.microwave.height);
  if (!proposal.bridge) return `The ${microwaveHeight}″ ${proposal.microwave.masterCode} would run from ${proposal.microwaveMountBottom}″ to ${proposal.bridgeMountBottom}″, but no real bridge is available above it, so nothing is added.`;
  const top = proposal.bridgeMountBottom + numberDimension(proposal.bridge.height);
  return `The ${microwaveHeight}″ ${proposal.microwave.masterCode} runs from ${proposal.microwaveMountBottom}″ to ${proposal.bridgeMountBottom}″. The selected real ${overRangeBridgeLabel(proposal.bridge)} begins at ${proposal.bridgeMountBottom}″ with no gap or trim and ends at ${top}″.`;
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
  // A disabled height is never applied, whether requested or preselected.
  const requested = bridgeChoices.find((choice) => choice.heightIn === options.bridgeHeightIn && choice.bridge != null);
  const neighbor = options.placed ? rangeAdjoiningUpperIn(range, options.placed, room) : null;
  // Without an adjoining upper yet, the wall-height setting is the neighbour,
  // exactly as the Auto Design build reads it.
  const upperTopLine = neighbor?.topIn ?? overRangeSettingTopLineIn(wallCabinetHeight, wallCabinets);
  const neighborHeight = neighbor?.heightIn ?? wallCabinetHeight;
  const preselected = requested?.heightIn ?? preselectedRangeBridgeHeight(bridgeChoices, upperTopLine, neighborHeight);
  const bridge = bridgeChoices.find((choice) => choice.heightIn === preselected)?.bridge ?? null;

  const microwaveWidth = numberDimension(microwave.width);
  const microwaveDepth = numberDimension(microwave.depth);
  const bridgeWidth = bridge ? numberDimension(bridge.width) : rangeWidth;
  const bridgeDepth = bridge ? numberDimension(bridge.depth) : microwaveDepth;
  const bridgeHeight = bridge ? numberDimension(bridge.height) : 0;
  if (!microwaveWidth || !microwaveDepth || !bridgeWidth || !bridgeDepth || (bridge && !bridgeHeight)) return null;

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
    bridgeHeightIn: bridge ? preselected : null,
    bridgeUnavailableReason: bridge ? null : rangeBridgeUnavailableReason(bridgeChoices, rangeWidth, options.lineName),
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
    ...(source.turnedSideways ? { turnedSideways: true } : {}),
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
    if (!proposal?.bridge) return candidate;
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
      ...(proposal.bridge.turnedSideways ? { turnedSideways: true } : {}),
      spiceStackParentUid: null,
      ...(proposal.bridgeSpot.wallId ? { wallId: proposal.bridgeSpot.wallId, wallOffset: proposal.bridgeSpot.wallOffset ?? 0 } : {}),
    };
  });
  return repaired ? { placed: next, repairedUids } : { placed, repairedUids };
}

export const rangeCompanionDimensions = numberDimension;
