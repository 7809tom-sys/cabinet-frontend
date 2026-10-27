/**
 * Auto-placement for a second sink base and for Pelican sinks and faucets.
 *
 * The first catalog sink base still uses the Designer's existing window / active
 * wall path, including its overlap advisory. This module is the search used
 * when another sink would otherwise be dropped on top of that first one, and
 * when a Pelican sink or faucet is added from Surfaces & Fixtures.
 */
import {
  COLLISION_EPSILON_IN,
  STD,
  bearsCountertop,
  cabinetWall,
  freeSegmentsOnWall,
  hasCollision,
  isFarmSinkBasePaletteItem,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  placedFootprint,
  requiresRoomCornerPlacement,
  roomWallRunFrames,
  sinkBaseWindowPlacement,
  wallPlacementAt,
  type IslandFace,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  type WallSide,
} from "./design";
import { nextIslandFacePlacement } from "./islandScene";
import { pickAutoDesignSinkBase, type AutoBuildCatalogCandidate } from "./autoDesignAutoBuild";
import {
  isVerifiedPelicanVanityFaucet,
  isVerifiedPelicanVanitySink,
  pelicanSinkBaseKind,
  verifiedPelicanFaucetProfile,
  verifiedPelicanPotFillerProfile,
  verifiedPelicanSinkFitsCabinet,
  verifiedPelicanSinkProfile,
} from "./pelicanFixtureProfiles";

const SINK_BASE_WIDTHS = [21, 24, 27, 30, 33, 36, 39, 42, 45, 48] as const;
const ISLAND_FACES: IslandFace[] = ["front", "back", "left", "right"];

export type OpenSinkBasePlacement = {
  x: number;
  y: number;
  rotation: number;
  wallId?: string;
  wallOffset?: number;
  peninsulaSide?: "left" | "right";
  islandFace?: IslandFace;
  islandOffset?: number;
};

export type PelicanPlacedProduct = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  imageUrl?: string | null;
  size?: string | null;
  description?: string | null;
};

type SearchInput = {
  width: number;
  depth: number;
  height?: number;
  room: RoomData;
  placed: PlacedCabinet[];
  openings: WallOpening[];
  island: IslandZone | null;
  activeWall: WallSide | string;
  /** Additional sinks try the island before the next wall. The first sink tries the window, then walls, then the island. */
  preferIsland: boolean;
};

function probeAt(
  width: number,
  depth: number,
  height: number,
  spot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number },
): PlacedCabinet {
  return {
    uid: "pelican-sink-base-probe",
    cabinetId: 0,
    masterCode: "SB",
    description: "Sink Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

function insideRoom(cabinet: PlacedCabinet, room: RoomData): boolean {
  const footprint = placedFootprint(cabinet);
  return cabinet.x >= -COLLISION_EPSILON_IN
    && cabinet.y >= -COLLISION_EPSILON_IN
    && cabinet.x + footprint.w <= room.width + COLLISION_EPSILON_IN
    && cabinet.y + footprint.d <= room.depth + COLLISION_EPSILON_IN;
}

function acceptSpot(
  width: number,
  depth: number,
  height: number,
  spot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: "left" | "right" },
  placed: PlacedCabinet[],
  room: RoomData,
  extra?: Pick<OpenSinkBasePlacement, "islandFace" | "islandOffset">,
): OpenSinkBasePlacement | null {
  const probe = probeAt(width, depth, height, spot);
  if (extra?.islandFace) {
    probe.islandFace = extra.islandFace;
    probe.islandOffset = extra.islandOffset;
  }
  if (hasCollision(probe, placed) || !insideRoom(probe, room)) return null;
  return {
    x: spot.x,
    y: spot.y,
    rotation: spot.rotation,
    ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset ?? 0 } : {}),
    ...(spot.peninsulaSide ? { peninsulaSide: spot.peninsulaSide } : {}),
    ...extra,
  };
}

function wallIds(room: RoomData): string[] {
  return roomWallRunFrames(room)
    .filter((frame) => frame.kind !== "peninsula")
    .map((frame) => frame.id);
}

function wallHasSink(side: string, placed: PlacedCabinet[], room: RoomData): boolean {
  return placed.some((cabinet) => isSinkBaseCabinet(cabinet) && cabinetWall(cabinet, room) === side);
}

function orderedWalls(room: RoomData, activeWall: string, placed: PlacedCabinet[], preferIsland: boolean): string[] {
  const ids = wallIds(room);
  const empty = ids.filter((id) => !wallHasSink(id, placed, room));
  const occupied = ids.filter((id) => wallHasSink(id, placed, room));
  const activeFirst = (list: string[]) => {
    const index = list.indexOf(activeWall);
    if (index <= 0) return list;
    return [list[index]!, ...list.slice(0, index), ...list.slice(index + 1)];
  };
  if (preferIsland) return [...activeFirst(empty), ...activeFirst(occupied)];
  const rest = [...empty, ...occupied].filter((id) => id !== activeWall);
  return [activeWall, ...rest];
}

function firstClearWallSpan(
  side: string,
  input: SearchInput,
): OpenSinkBasePlacement | null {
  const height = input.height ?? STD.BASE_HEIGHT;
  const segments = freeSegmentsOnWall(
    side as WallSide,
    input.room,
    input.placed,
    input.openings,
    input.width,
    0,
    "base",
    false,
    undefined,
    input.depth,
  );
  for (const segment of segments) {
    if (segment.length + COLLISION_EPSILON_IN < input.width) continue;
    const spot = wallPlacementAt(segment.start, input.width, input.depth, side as WallSide, input.room);
    const accepted = acceptSpot(input.width, input.depth, height, spot, input.placed, input.room);
    if (accepted) return accepted;
  }
  return null;
}

function firstClearIslandFace(input: SearchInput): OpenSinkBasePlacement | null {
  if (!input.island) return null;
  const height = input.height ?? STD.BASE_HEIGHT;
  const probe = probeAt(input.width, input.depth, height, { x: input.island.x, y: input.island.y, rotation: 0 });
  for (const face of ISLAND_FACES) {
    const placed = nextIslandFacePlacement(probe, input.island, face, input.placed);
    if (!placed) continue;
    const accepted = acceptSpot(
      input.width,
      input.depth,
      height,
      {
        x: placed.x,
        y: placed.y,
        rotation: placed.rotation,
        ...(placed.wallId ? { wallId: placed.wallId } : {}),
        ...(placed.wallOffset != null ? { wallOffset: placed.wallOffset } : {}),
        ...(placed.peninsulaSide === "left" || placed.peninsulaSide === "right"
          ? { peninsulaSide: placed.peninsulaSide }
          : {}),
      },
      input.placed,
      input.room,
      {
        islandFace: placed.islandFace ?? face,
        ...(placed.islandOffset != null ? { islandOffset: placed.islandOffset } : {}),
      },
    );
    if (accepted) return accepted;
  }
  return null;
}

/**
 * First open sink-base footprint that does not overlap a cabinet or the room
 * boundary. Returns null when every candidate is blocked — the caller must
 * not fall back to an overlapping window or wall origin.
 */
export function findOpenSinkBasePlacement(input: SearchInput): OpenSinkBasePlacement | null {
  const height = input.height ?? STD.BASE_HEIGHT;
  if (input.preferIsland) {
    const island = firstClearIslandFace(input);
    if (island) return island;
  } else {
    const windowSpot = sinkBaseWindowPlacement(
      input.activeWall as WallSide,
      input.room,
      input.width,
      input.depth,
      height,
      input.placed,
      input.openings,
    )?.spot ?? null;
    if (windowSpot) {
      const accepted = acceptSpot(input.width, input.depth, height, windowSpot, input.placed, input.room);
      if (accepted) return accepted;
    }
  }
  for (const side of orderedWalls(input.room, String(input.activeWall), input.placed, input.preferIsland)) {
    const spot = firstClearWallSpan(side, input);
    if (spot) return spot;
  }
  if (!input.preferIsland) return firstClearIslandFace(input);
  return null;
}

export function parsePelicanPlanSize(size: string | null | undefined): { width: number; depth: number } | null {
  if (!size) return null;
  const match = size.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const width = Number(match[1]);
  const depth = Number(match[2]);
  if (!(width > 0) || !(depth > 0)) return null;
  return { width, depth };
}

/** Smallest straight catalog sink base that can hold this Pelican sink. Farmhouse is never substituted for a standard sink. */
export function chooseSmallestPelicanSinkBase<T extends AutoBuildCatalogCandidate & { width?: string | number | null }>(
  catalog: readonly T[],
  item: { pelicanCode?: string | null; name?: string | null; description?: string | null },
  minimumWidthIn: number,
): T | null {
  const kind = pelicanSinkBaseKind(item) === "farmhouse" ? "farmhouse" : "regular";
  for (const width of SINK_BASE_WIDTHS) {
    if (width + 0.1 < minimumWidthIn) continue;
    const row = pickAutoDesignSinkBase(catalog, width, kind);
    if (row) return row;
  }
  return null;
}

function isVanitySinkBase(cabinet: PlacedCabinet): boolean {
  const text = `${cabinet.masterCode ?? ""} ${cabinet.description ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.category ?? ""}`;
  return /vanity/i.test(text) || /^(?:ADA-)?VSD?[-_ ]?\d/i.test(cabinet.masterCode ?? "");
}

/**
 * A sink base whose fixture is still the generic default (or missing) can take
 * a Pelican sink. A base that already has a Pelican product is left alone.
 */
export function openPelicanSinkHost(
  item: PelicanPlacedProduct,
  placed: PlacedCabinet[],
  sinks: SinkFixture[],
): PlacedCabinet | null {
  const vanity = isVerifiedPelicanVanitySink(item.pelicanCode);
  const kind = pelicanSinkBaseKind(item);
  const profile = verifiedPelicanSinkProfile(item.pelicanCode);
  const hosts = placed.filter((cabinet) => {
    if (!isSinkBaseCabinet(cabinet) || requiresRoomCornerPlacement(cabinet)) return false;
    if (vanity) return isVanitySinkBase(cabinet);
    if (isVanitySinkBase(cabinet)) return false;
    if (isFarmSinkBasePaletteItem(cabinet) !== (kind === "farmhouse")) return false;
    if (profile && !verifiedPelicanSinkFitsCabinet(profile, Number(cabinet.width) || 0)) return false;
    const fixture = sinks.find((sink) => sink.cabinetUid === cabinet.uid);
    return !fixture?.pelicanProductId;
  });
  return hosts[0] ?? null;
}

export function buildPelicanSinkOnCabinet(
  item: PelicanPlacedProduct,
  cabinet: PlacedCabinet,
  room: RoomData,
): SinkFixture {
  const profile = verifiedPelicanSinkProfile(item.pelicanCode);
  const parsed = parsePelicanPlanSize(item.size);
  const width = profile?.exteriorWidthIn ?? parsed?.width ?? 30;
  const depth = profile?.exteriorDepthIn ?? parsed?.depth ?? 18;
  const type = profile?.sinkType === "farmhouse" || pelicanSinkBaseKind(item) === "farmhouse" ? "farmhouse" : "single";
  const sink = makeSinkForCabinet(type, cabinet, room, { width, depth });
  return {
    ...sink,
    faucet: false,
    pelicanProductId: item.id,
    pelicanProductName: item.name,
    pelicanProductImage: item.imageUrl ?? undefined,
    ...(profile ? {
      pelicanProfileId: profile.id,
      bowlWidth: profile.bowlWidthIn,
      bowlDepth: profile.bowlDepthIn,
      bowlHeight: profile.bowlHeightIn,
      bowlCount: profile.bowlCount ?? 1,
      bowlWidths: profile.bowlWidthsIn,
      bowlDepths: profile.bowlDepthsIn,
      bowlHeights: profile.bowlHeightsIn,
      drainInsetRight: profile.drainInsetRightIn,
      drainInsetBack: profile.drainInsetBackIn,
      exteriorHeight: profile.exteriorHeightIn,
      apronFront: profile.apronFront,
      surfaceFinish: profile.surfaceFinish,
    } : {}),
  };
}

export type PelicanFaucetPlan =
  | { ok: true; sinkUid: string; patch: Partial<SinkFixture>; message: string }
  | { ok: false; message: string };

function sinkCenter(sink: SinkFixture): { x: number; y: number } {
  return { x: sink.x + sink.width / 2, y: sink.y + sink.depth / 2 };
}

function nearestSink(sinks: SinkFixture[], origin: { x: number; y: number } | null): SinkFixture | null {
  if (!sinks.length) return null;
  if (!origin) return sinks[0] ?? null;
  return [...sinks].sort((left, right) => {
    const a = sinkCenter(left);
    const b = sinkCenter(right);
    const da = (a.x - origin.x) ** 2 + (a.y - origin.y) ** 2;
    const db = (b.x - origin.x) ** 2 + (b.y - origin.y) ** 2;
    return da - db;
  })[0] ?? null;
}

/**
 * Deck / top-mount (single-hole) faucets sit on the counter behind the basin.
 * Wall-mounted 8-inch-center faucets and pot fillers are not dropped onto that
 * deck. There is no side-mount installation in the verified Pelican profiles.
 */
export function planPelicanFaucetAttachment(input: {
  item: PelicanPlacedProduct;
  sinks: SinkFixture[];
  placed: PlacedCabinet[];
  room: RoomData;
  selectedCabinetUid?: string | null;
}): PelicanFaucetPlan {
  const { item } = input;
  if (verifiedPelicanPotFillerProfile(item.pelicanCode)) {
    return {
      ok: false,
      message: `${item.name} is a wall-mounted pot filler. It belongs on the wall above a range, not on the sink. Select the range and use Add wall pot filler, then enter the measured height.`,
    };
  }
  const profile = verifiedPelicanFaucetProfile(item.pelicanCode);
  if (profile?.installation === "wall-mounted-8-inch-center" || profile?.requiresProjectSpecificMountHeight) {
    return {
      ok: false,
      message: `${item.name} is a wall-mounted faucet (8-inch centers). It mounts on the wall, not on the countertop behind the basin. Open the sink’s faucet step and enter the measured height from the finished counter to the wall mount.`,
    };
  }
  const vanityFaucet = isVerifiedPelicanVanityFaucet(item.pelicanCode);
  const eligible = input.sinks.filter((sink) => {
    const owner = input.placed.find((cabinet) => cabinet.uid === sink.cabinetUid);
    const sinkIsVanity = owner ? isVanitySinkBase(owner) : false;
    return vanityFaucet ? sinkIsVanity : !sinkIsVanity;
  });
  const selected = input.selectedCabinetUid
    ? input.placed.find((cabinet) => cabinet.uid === input.selectedCabinetUid) ?? null
    : null;
  const origin = selected ? { x: selected.x + selected.width / 2, y: selected.y + selected.depth / 2 } : null;
  const openHosts = eligible.filter((sink) => !sink.pelicanFaucetProfileId);
  const host = nearestSink(openHosts.length ? openHosts : eligible, origin);
  if (!host) {
    const counters = input.placed.filter((cabinet) => bearsCountertop(cabinet));
    const nearestCounter = selected && counters.some((cabinet) => cabinet.uid === selected.uid)
      ? selected
      : counters[0];
    if (vanityFaucet) {
      return { ok: false, message: `${item.name} is a vanity faucet. Add a vanity sink first; it mounts on that vanity counter, not on a kitchen sink.` };
    }
    if (nearestCounter) {
      return {
        ok: false,
        message: `Add a sink before this faucet. The nearest countertop is on ${nearestCounter.masterCode}. A deck-mounted faucet sits on the quartz or granite behind the sink, and this plan has no sink there yet.`,
      };
    }
    return {
      ok: false,
      message: "Add a sink first. A deck-mounted faucet sits on the countertop behind the sink, and this plan has no sink.",
    };
  }
  const owner = input.placed.find((cabinet) => cabinet.uid === host.cabinetUid);
  if (owner && host.type !== "farmhouse") {
    const deck = nonApronSinkDeckPlacement(owner, input.room, {
      width: host.sourceWidth ?? host.width,
      depth: host.sourceDepth ?? host.depth,
    });
    if (deck.applies && !deck.faucetCanFit) {
      return { ok: false, message: deck.reason ?? `${item.name} does not fit the rear deck behind this sink.` };
    }
  }
  const replaced = Boolean(host.pelicanFaucetProfileId);
  return {
    ok: true,
    sinkUid: host.uid,
    patch: {
      faucet: true,
      faucetRearDeckOffsetIn: host.faucetRearDeckOffsetIn ?? (host.type === "farmhouse" ? undefined : 1.25),
      pelicanFaucetProductId: item.id,
      pelicanFaucetProductName: item.name,
      pelicanFaucetProductImage: item.imageUrl ?? undefined,
      pelicanFaucetProfileId: profile?.id,
      faucetOverallHeight: profile?.overallHeightIn,
      faucetSpoutLength: profile?.spoutLengthIn,
      faucetSpoutHeight: profile?.spoutHeightIn,
      faucetFinish: profile?.finish,
      faucetForm: profile?.profile,
      faucetCenterSpread: profile?.centerSpreadIn,
      faucetWallMountHeightAboveCountertopIn: undefined,
      requiresProjectSpecificMountHeight: undefined,
    },
    message: replaced
      ? `${item.name} replaced the faucet on this sink. It sits on the countertop, centered behind the basin.`
      : `${item.name} placed on the countertop, centered behind the sink.`,
  };
}
