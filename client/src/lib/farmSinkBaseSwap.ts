import {
  isFarmSinkBasePaletteItem,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  resolvedDesignCabinetDimensions,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "./design";

/** Requested apron-front sink width (inches) seated by the swap. */
export const FARM_SINK_SWAP_WIDTH_IN = 33;
/** Plan depth of the generic apron-front sink; a verified product can replace it afterwards. */
export const FARM_SINK_SWAP_DEPTH_IN = 21;

export type FarmSinkSwapResult =
  | { ok: true; cabinet: PlacedCabinet; sink: SinkFixture; removedSinkUids: string[]; fromCode: string; toCode: string }
  | { ok: false; reason: string };

/**
 * Finds the real catalog FSB record that matches a standard sink base. Matching is
 * exact (same width and depth) and only looks inside the supplied pool, which the
 * Designer already scopes to the active distributor line and door style. Nothing
 * is invented or substituted: no match means no swap.
 */
export function matchingFarmSinkBase(
  base: Pick<PlacedCabinet, "width" | "depth" | "masterCode" | "description" | "subCategory">,
  pool: readonly DesignCabinet[],
): DesignCabinet | null {
  const matches = pool.filter((candidate) => {
    if (candidate.placement !== "base" || !isFarmSinkBasePaletteItem(candidate)) return false;
    const dims = resolvedDesignCabinetDimensions(candidate);
    return Math.abs(dims.width - base.width) <= 0.01 && Math.abs(dims.depth - base.depth) <= 0.01;
  });
  return matches.sort((a, b) => a.masterCode.localeCompare(b.masterCode))[0] ?? null;
}

/**
 * Swaps a standard sink base for the matching FSB and seats an apron-front sink
 * in it. The cabinet keeps its uid, wall ownership, position, and rotation, so the
 * shared countertop, collision, and 45-degree code treat it exactly as before.
 */
export function swapStandardSinkBaseForFarmSink(
  cabinet: PlacedCabinet,
  pool: readonly DesignCabinet[],
  sinks: readonly SinkFixture[],
  room: RoomData,
  fixtureBelongsToCabinet: (fixture: SinkFixture, cabinet: PlacedCabinet) => boolean,
): FarmSinkSwapResult {
  if (!isSinkBaseCabinet(cabinet) || cabinet.placement !== "base") {
    return { ok: false, reason: "Select a standard sink base first." };
  }
  if (isFarmSinkBasePaletteItem(cabinet)) {
    return { ok: false, reason: `${cabinet.masterCode} is already a farm sink base.` };
  }
  if (cabinet.width + 0.01 < FARM_SINK_SWAP_WIDTH_IN) {
    return { ok: false, reason: `A ${FARM_SINK_SWAP_WIDTH_IN}\" farmhouse sink needs a base at least ${FARM_SINK_SWAP_WIDTH_IN}\" wide; ${cabinet.masterCode} is ${cabinet.width}\".` };
  }
  const farm = matchingFarmSinkBase(cabinet, pool);
  if (!farm) {
    return { ok: false, reason: `No ${cabinet.width}\" farm sink base (FSB) exists in this line, so ${cabinet.masterCode} was left as is. Nothing was substituted.` };
  }
  const dims = resolvedDesignCabinetDimensions(farm);
  const swapped: PlacedCabinet = {
    ...cabinet,
    cabinetId: farm.id,
    masterCode: farm.masterCode,
    description: farm.description,
    category: farm.category ?? null,
    subCategory: farm.subCategory ?? null,
    width: dims.width,
    nominalWidth: dims.width,
    depth: dims.depth,
    nominalDepth: dims.depth,
    height: dims.height,
    nominalHeight: dims.height,
    numberOfDoors: farm.numberOfDoors,
    numberOfDrawers: farm.numberOfDrawers,
    catalogImageUrl: farm.catalogImageUrl ?? null,
    graphicType: undefined,
  } as PlacedCabinet;
  const removedSinkUids = sinks.filter((sink) => fixtureBelongsToCabinet(sink, cabinet)).map((sink) => sink.uid);
  const sink: SinkFixture = {
    ...makeSinkForCabinet("farmhouse", swapped, room, { width: FARM_SINK_SWAP_WIDTH_IN, depth: FARM_SINK_SWAP_DEPTH_IN }),
    apronFront: true,
    faucet: true,
  };
  return { ok: true, cabinet: swapped, sink, removedSinkUids, fromCode: cabinet.masterCode, toCode: farm.masterCode };
}
