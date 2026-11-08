/**
 * One decision table for what may be placed on a sink base, and what that
 * placement bills.
 *
 * The Designer used to answer these questions from the ROOM TYPE: inside a
 * bathroom it assumed every sink base was a vanity and filtered the catalog to
 * `bathroom-vanity-sink` rows only. A farmhouse / apron-front ("Farmer") sink
 * base lives in that same room, but its legal fixture is an apron-front kitchen
 * sink, so every row was filtered out and the step had nothing to place. The
 * same room-type guess also decided the faucet family, so an apron base offered
 * vanity faucets.
 *
 * The answer now comes from the BASE itself:
 *   - a farmhouse / apron-front base (FSB)     → apron-front sinks, kitchen faucets
 *   - a vanity base, or any base in a bathroom → vanity basins, vanity faucets
 *   - every other sink base                    → standard kitchen sinks and faucets
 *
 * Placement is a pure function of (base, room, product, faucet) so the manual
 * dialog, the seeded default, and the tests all take exactly one path.
 */
import {
  isFarmSinkBasePaletteItem,
  isSinkBaseCabinet,
  makeSinkForCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type SinkType,
} from "./design";
import {
  isPelicanSinkCompatibleWithBase,
  sinkBaseOpeningWidthIn,
  verifiedPelicanFaucetProfile,
  verifiedPelicanSinkFitsCabinet,
  verifiedPelicanSinkProfile,
} from "./pelicanFixtureProfiles";
import {
  isBathroomVanityFaucetRow,
  isBathroomVanitySinkRow,
  vanitySinkFitsVanityWidth,
} from "./bathroomVanityCatalog";
import { isAutoFilledFaucet, withDefaultFaucet } from "./autoDesignFaucet";
import { DEFAULT_VANITY_BASIN_SKU, resolveSinkFinish } from "./bathroomSinkFinish";

export type SinkFamily = "vanity" | "farmhouse" | "standard";
export type FaucetFamily = "vanity" | "kitchen";

type SinkBaseIdentity = Pick<PlacedCabinet, "masterCode" | "description" | "subCategory" | "category"> & {
  placement?: string | null;
  width?: number | string | null;
  depth?: number | string | null;
};

/** A catalog row the sink step may place. Its id survives into the cart line. */
export type SinkBaseProductRow = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  category?: string | null;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  sellPrice?: number | null;
  slug?: string | null;
  bathroomFixtureTags?: string | null;
};

export type SinkBaseSinkRow = SinkBaseProductRow;
export type SinkBaseFaucetRow = SinkBaseProductRow;

/** A base sold as a vanity sink base (VSD30, "30\" Vanity Sink Base"). */
export function isVanitySinkBaseLabel(base: SinkBaseIdentity | null | undefined): boolean {
  if (!base) return false;
  const text = `${base.masterCode ?? ""} ${base.category ?? ""} ${base.subCategory ?? ""} ${base.description ?? ""}`;
  if (/\bvanity\b/i.test(text)) return true;
  return /^(?:ADA-)?VSD?[-_ ]?\d/i.test(base.masterCode ?? "");
}

/**
 * The fixture family this exact sink base accepts. A farmhouse base always wins
 * over the room: an apron-front base is a farmhouse base in every room.
 */
export function sinkFamilyForBase(base: SinkBaseIdentity | null | undefined, roomType?: string | null): SinkFamily {
  if (!base) return roomType === "bathroom" ? "vanity" : "standard";
  if (isFarmSinkBasePaletteItem(base)) return "farmhouse";
  if (roomType === "bathroom") return "vanity";
  if (isVanitySinkBaseLabel(base)) return "vanity";
  return "standard";
}
/** The faucet family that belongs with this sink base. */
export function faucetFamilyForBase(base: SinkBaseIdentity | null | undefined, roomType?: string | null): FaucetFamily {
  return sinkFamilyForBase(base, roomType) === "vanity" ? "vanity" : "kitchen";
}

/**
 * The catalog role the sink step must read.
 *
 * `vanity-sink` is a bathroom-only server role. An apron-front base needs the
 * ordinary sink rows even when it stands in a bathroom, or the step is empty.
 */
export function sinkCatalogRoleForBase(base: SinkBaseIdentity | null | undefined, roomType?: string | null): "vanity-sink" | "sink" {
  return sinkFamilyForBase(base, roomType) === "vanity" ? "vanity-sink" : "sink";
}

/** The matching faucet catalog role. */
export function faucetCatalogRoleForBase(base: SinkBaseIdentity | null | undefined, roomType?: string | null): "vanity-faucet" | "faucet" {
  return faucetFamilyForBase(base, roomType) === "vanity" ? "vanity-faucet" : "faucet";
}

/** True when this row may be placed on this base. Exact SKU first, then fit. */
export function sinkRowFitsBase(row: SinkBaseSinkRow, base: SinkBaseIdentity | null | undefined, roomType?: string | null): boolean {
  if (!base) return false;
  const profile = verifiedPelicanSinkProfile(row.pelicanCode);
  if (!profile) return false;
  const openingWidthIn = sinkBaseOpeningWidthIn({ width: Number(base.width ?? 0) });
  if (!verifiedPelicanSinkFitsCabinet(profile, openingWidthIn)) return false;
  switch (sinkFamilyForBase(base, roomType)) {
    case "vanity":
      return isBathroomVanitySinkRow(row) && vanitySinkFitsVanityWidth(row, openingWidthIn);
    case "farmhouse":
      // An apron-front base takes only an apron-front sink. A vanity basin and a
      // standard undermount both fail here and never reach the picker.
      return profile.sinkType === "farmhouse" || profile.apronFront === true;
    default:
      return isPelicanSinkCompatibleWithBase(row, "standard");
  }
}

/** The rows the sink step may show for this base, in the order given. */
export function sinkRowsForBase<T extends SinkBaseSinkRow>(
  rows: readonly T[],
  base: SinkBaseIdentity | null | undefined,
  roomType?: string | null,
): T[] {
  if (!base) return [];
  return rows.filter((row) => sinkRowFitsBase(row, base, roomType));
}

/** True when this faucet row belongs to the family this base uses. */
export function faucetRowFitsBase(row: SinkBaseFaucetRow, base: SinkBaseIdentity | null | undefined, roomType?: string | null): boolean {
  if (!verifiedPelicanFaucetProfile(row.pelicanCode)) return false;
  const vanityFaucet = isBathroomVanityFaucetRow(row);
  return faucetFamilyForBase(base, roomType) === "vanity" ? vanityFaucet : !vanityFaucet;
}

/** The faucet rows the step may show for this base. */
export function faucetRowsForBase<T extends SinkBaseFaucetRow>(
  rows: readonly T[],
  base: SinkBaseIdentity | null | undefined,
  roomType?: string | null,
): T[] {
  if (!base) return [];
  return rows.filter((row) => faucetRowFitsBase(row, base, roomType));
}

/** The option set a placed sink base exposes. Identical for every sink base. */
export const SINK_BASE_CONFIG_OPTIONS = [
  "select",
  "move",
  "rotate",
  "attributes",
  "sink",
  "faucet",
  "door-finish",
  "delete",
] as const;

export type SinkBaseConfigOption = (typeof SINK_BASE_CONFIG_OPTIONS)[number];

export type SinkBaseConfig = {
  /** True for every sink base, farmhouse included. */
  selectable: boolean;
  sinkFamily: SinkFamily;
  faucetFamily: FaucetFamily;
  /** The exact options the side panel and canvas offer this sink base. */
  options: SinkBaseConfigOption[];
  /** This base may be swapped for its matching FSB. Never true for an FSB. */
  swapToFarmSinkBase: boolean;
};

/**
 * The configuration surface of a placed sink base.
 *
 * A farmhouse / apron-front base is a sink base like any other: it is selectable,
 * it opens the same Attributes dialog, it offers the same sink and faucet steps,
 * the same door/finish controls, and the same delete action. Only the sink and
 * faucet FAMILIES differ, because those are real product families.
 */
export function sinkBaseConfig(base: SinkBaseIdentity | null | undefined, roomType?: string | null): SinkBaseConfig {
  const isSinkBase = Boolean(base && isSinkBaseCabinet(base));
  return {
    selectable: isSinkBase,
    sinkFamily: sinkFamilyForBase(base, roomType),
    faucetFamily: faucetFamilyForBase(base, roomType),
    options: isSinkBase ? [...SINK_BASE_CONFIG_OPTIONS] : [],
    swapToFarmSinkBase: isSinkBase && !isFarmSinkBasePaletteItem(base!),
  };
}

/** The measured default basin for a family, used when nothing is chosen yet. */
function defaultSinkDimensions(family: SinkFamily): { width: number; depth: number } | undefined {
  if (family !== "vanity") return undefined;
  // PL-3099 Pearl Series is a 20 7/8" × 15 5/8" vanity basin, so the seeded
  // basin fits a 21" vanity top instead of overhanging it.
  const profile = verifiedPelicanSinkProfile("PL-3099 White");
  return profile
    ? { width: profile.exteriorWidthIn, depth: profile.exteriorDepthIn }
    : { width: 20.875, depth: 15.625 };
}

export type SinkPlacementResult =
  | { ok: true; sink: SinkFixture; billableFaucetProductId: number | null }
  | { ok: false; reason: string };

/**
 * Places exactly one sink on exactly one sink base.
 *
 * A missing product is not a refusal: the Designer still seats the measured
 * default basin for the family, so a sink base never ends up with no sink. The
 * faucet rule is enforced here — a catalog faucet the shopper chose is billable,
 * the filled-in default is drawn but carries no cart line.
 */
export function placeSinkOnBase(input: {
  base: PlacedCabinet | null | undefined;
  room: RoomData;
  roomType?: string | null;
  product: SinkBaseSinkRow | null;
  faucet?: SinkBaseFaucetRow | null;
}): SinkPlacementResult {
  const { base, room, product, faucet } = input;
  if (!base || base.placement !== "base") return { ok: false, reason: "Select a sink base first." };
  if (!isSinkBaseCabinet(base)) return { ok: false, reason: `${base.masterCode} is not a sink base.` };
  const family = sinkFamilyForBase(base, input.roomType);

  const profile = product ? verifiedPelicanSinkProfile(product.pelicanCode) : null;
  if (product && !profile) {
    return { ok: false, reason: `${product.name} is not a source-verified Pelican sink, so it cannot be measured and drawn.` };
  }
  if (profile && !verifiedPelicanSinkFitsCabinet(profile, sinkBaseOpeningWidthIn(base))) {
    return { ok: false, reason: `${profile.name} requires a sink base at least ${profile.minimumCabinetWidthIn}" wide.` };
  }
  if (product && !sinkRowFitsBase(product, base, input.roomType)) {
    return {
      ok: false,
      reason: family === "farmhouse"
        ? `${product.name} is not an apron-front sink. A farmhouse sink base takes only an apron-front sink.`
        : `${product.name} does not fit this ${base.masterCode} sink base.`,
    };
  }

  const measured = makeSinkForCabinet(
    (family === "farmhouse" ? "farmhouse" : "single") as SinkType,
    base,
    room,
    profile ? { width: profile.exteriorWidthIn, depth: profile.exteriorDepthIn } : defaultSinkDimensions(family),
  );

  const withProduct: SinkFixture = product
    ? {
      ...measured,
      pelicanProductId: product.id,
      pelicanProductName: product.name,
      pelicanProductImage: product.imageUrl ?? undefined,
      ...(profile ? {
        pelicanProfileId: profile.id,
        bowlShape: profile.basinShape,
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
    }
    : { ...measured, faucet: false };

  // The seeded default has no catalog product, so nothing above has set a
  // finish. Copy the measured vanity basin's own porcelain finish onto it and,
  // on a vanity, refuse anything that would draw as a kitchen sink. This is the
  // source of the stainless sink the owner saw on a vanity.
  const defaultBasinProfile = family === "vanity" ? verifiedPelicanSinkProfile(DEFAULT_VANITY_BASIN_SKU) : null;
  const finishForFamily = resolveSinkFinish(withProduct.surfaceFinish, family);
  const withFinish: SinkFixture = {
    ...withProduct,
    surfaceFinish: finishForFamily,
    bathroomVanitySink: family === "vanity" ? true : undefined,
    ...(!product && defaultBasinProfile ? {
      pelicanProfileId: defaultBasinProfile.id,
      bowlShape: defaultBasinProfile.basinShape,
      bowlWidth: defaultBasinProfile.bowlWidthIn,
      bowlDepth: defaultBasinProfile.bowlDepthIn,
      bowlHeight: defaultBasinProfile.bowlHeightIn,
      bowlCount: defaultBasinProfile.bowlCount ?? 1,
      exteriorHeight: defaultBasinProfile.exteriorHeightIn,
      apronFront: defaultBasinProfile.apronFront,
    } : {}),
  };

  const faucetProfile = faucet ? verifiedPelicanFaucetProfile(faucet.pelicanCode) : null;
  if (faucet && !faucetProfile) {
    return { ok: false, reason: `${faucet.name} is not a source-verified Pelican faucet, so it cannot be drawn.` };
  }
  const sink: SinkFixture = faucet && faucetProfile
    ? {
      ...withFinish,
      faucet: true,
      autoDesignFaucet: true,
      // A shopper's pick: not auto-filled, so it is billed.
      faucetAutoFilled: undefined,
      defaultFaucet: undefined,
      pelicanFaucetProductId: faucet.id,
      pelicanFaucetProductName: faucet.name,
      pelicanFaucetProductImage: faucet.imageUrl ?? undefined,
      pelicanFaucetProfileId: faucetProfile.id,
      faucetOverallHeight: faucetProfile.overallHeightIn,
      faucetSpoutLength: faucetProfile.spoutLengthIn,
      faucetSpoutHeight: faucetProfile.spoutHeightIn,
      faucetFinish: faucetProfile.finish,
      faucetForm: faucetProfile.profile,
      faucetCenterSpread: faucetProfile.centerSpreadIn,
      faucetRearDeckOffsetIn: withFinish.faucetRearDeckOffsetIn ?? (withFinish.type === "farmhouse" ? undefined : 1.25),
    }
    // Nothing chosen: draw the family's standard Pelican faucet and mark it so it
    // never reaches the cart, quote, or order totals.
    : withDefaultFaucet(withFinish, family === "vanity");

  return {
    ok: true,
    sink,
    billableFaucetProductId: isAutoFilledFaucet(sink) ? null : (sink.pelicanFaucetProductId ?? null),
  };
}

/** The measured basin a freshly placed sink base is seeded with. */
export function autoSeedSinkForBase(input: {
  base: PlacedCabinet;
  room: RoomData;
  roomType?: string | null;
}): SinkFixture {
  const placement = placeSinkOnBase({ ...input, product: null, faucet: null });
  if (placement.ok) return placement.sink;
  // Last-resort fallback: a bare sink with no profile. It still has to be
  // porcelain on a vanity, or the renderer would draw the kitchen stainless
  // basin the owner reported.
  const family = sinkFamilyForBase(input.base, input.roomType);
  return {
    ...makeSinkForCabinet("single", input.base, input.room),
    faucet: true,
    surfaceFinish: resolveSinkFinish(undefined, family),
  };
}

/**
 * Faucet quantities for the cart, quote, and order totals.
 *
 * Only a faucet the shopper chose is counted. A faucet the Designer filled in to
 * complete the drawing is seeded at zero so a stale surface row cannot bill it,
 * and is never incremented.
 */
export function faucetCartQuantities(sinks: readonly SinkFixture[]): Map<number, number> {
  const quantities = new Map<number, number>();
  const chosenIds = new Set<number>();
  for (const sink of sinks) {
    if (sink.pelicanFaucetProductId == null || isAutoFilledFaucet(sink)) continue;
    chosenIds.add(sink.pelicanFaucetProductId);
  }
  for (const sink of sinks) {
    if (sink.pelicanFaucetProductId == null) continue;
    if (isAutoFilledFaucet(sink) && !chosenIds.has(sink.pelicanFaucetProductId) && !quantities.has(sink.pelicanFaucetProductId)) {
      quantities.set(sink.pelicanFaucetProductId, 0);
    }
  }
  for (const sink of sinks) {
    if (sink.pelicanFaucetProductId == null || isAutoFilledFaucet(sink)) continue;
    quantities.set(sink.pelicanFaucetProductId, (quantities.get(sink.pelicanFaucetProductId) ?? 0) + 1);
  }
  return quantities;
}
