/**
 * Sinks in the measured Auto-Design build.
 *
 * Auto-Design already seats a source-priced sink base and one deck-mounted
 * faucet behind it. This module adds the missing half: the real Pelican sink.
 * The auto-designer offers the catalog's sinks in a pop-up next to the faucet
 * option, and a pick auto-places the sink — there is no manual placement step,
 * including for a second sink. The base is chosen from the same source-priced
 * catalog the build already uses, and the faucet is re-attached on the
 * countertop behind the basin (never inside it) afterwards.
 *
 * Pairing is decided from the product data, not from a hand-maintained list:
 *   - a farmhouse / apron-front sink pairs with the matching farmhouse (apron)
 *     sink base — the FSB family, never a standard SB,
 *   - an undermount or drop-in sink pairs with the smallest straight sink base
 *     whose nominal width clears the sink's published minimum cabinet width,
 *   - a bathroom vanity basin pairs with a vanity base and never with a kitchen
 *     sink base.
 * The only pairing left out is a size with no real base in the line, which the
 * pop-up reports instead of substituting another SKU.
 */
import {
  AUTO_DESIGN_SINK_BASE_WIDTHS,
  chooseSmallestPelicanSinkBase,
  parsePelicanPlanSize,
} from "./pelicanAutoPlace";
import type { AutoBuildCatalogCandidate } from "./autoDesignAutoBuild";
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  fixtureBelongsToCabinet,
  freeSegmentsOnWall,
  isSinkBaseCabinet,
  roomWallRunFrames,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  type WallSide,
} from "./design";
import { refrigeratorLimitIn } from "./autoDesignAnchors";
import { boundedWallPlacementAt } from "./designerBounds";
import { swapStandardSinkBaseForFarmSink } from "./farmSinkBaseSwap";
import { buildPelicanSinkOnCabinet, openPelicanSinkHost } from "./pelicanAutoPlace";
import {
  isVerifiedPelicanVanitySink,
  sinkBaseOpeningWidthIn,
  verifiedPelicanSinkFitsCabinet,
  verifiedPelicanSinkProfile,
} from "./pelicanFixtureProfiles";

/** One sink row from the existing Pelican catalog. Never invented locally. */
export type AutoDesignSinkProduct = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  imageUrl?: string | null;
  sellPrice?: number | null;
  size?: string | null;
};

export type AutoDesignSinkInstallation = "farmhouse" | "undermount" | "drop-in" | "vanity" | "other";

/** What the sink base must be for this sink, derived from the product data. */
export type SinkBasePairing = {
  kind: "farmhouse" | "regular" | "vanity";
  /** Smallest nominal base width the sink needs, in inches. */
  minimumWidthIn: number | null;
  /** Plain-sentence reason used in the pop-up and the PR notes. */
  reason: string;
};

export function catalogSinkInstallation(product: AutoDesignSinkProduct): AutoDesignSinkInstallation {
  const profile = verifiedPelicanSinkProfile(product.pelicanCode);
  if (profile) {
    if (isVerifiedPelicanVanitySink(product.pelicanCode)) return "vanity";
    if (profile.sinkType === "farmhouse" || profile.apronFront) return "farmhouse";
    return "undermount";
  }
  const text = `${product.name ?? ""} ${product.description ?? ""} ${product.subCategory ?? ""}`.toLowerCase();
  if (/vanity/.test(text)) return "vanity";
  if (/farm(?:house)?|apron/.test(text)) return "farmhouse";
  if (/drop[ -]?in|top[ -]?mount/.test(text)) return "drop-in";
  if (/under[ -]?mount/.test(text)) return "undermount";
  return "other";
}

/**
 * The base a sink pairs with. A verified profile carries the exact minimum
 * cabinet width; an unprofiled catalog row falls back to its published plan
 * size, and then to the nominal width step above it.
 */
export function sinkBasePairing(product: AutoDesignSinkProduct): SinkBasePairing {
  const installation = catalogSinkInstallation(product);
  const profile = verifiedPelicanSinkProfile(product.pelicanCode);
  const parsed = parsePelicanPlanSize(product.size ?? null);
  const minimumWidthIn = profile?.minimumCabinetWidthIn ?? parsed?.width ?? null;
  if (installation === "vanity") {
    return {
      kind: "vanity",
      minimumWidthIn,
      reason: "Vanity basin — pairs with a vanity base, never a kitchen sink base.",
    };
  }
  if (installation === "farmhouse") {
    return {
      kind: "farmhouse",
      minimumWidthIn,
      reason: `${product.name} is an apron-front sink, so it pairs with the matching farmhouse (FSB) sink base of the same nominal width — never a standard SB.`,
    };
  }
  return {
    kind: "regular",
    minimumWidthIn,
    reason: minimumWidthIn != null
      ? `${product.name} is a standard undermount/drop-in sink; it pairs with the smallest straight sink base at or above its ${minimumWidthIn}″ minimum cabinet width.`
      : `${product.name} is a standard sink; it pairs with the nearest straight sink base width.`,
  };
}

export type SinkPairingRow = {
  pelicanCode: string | null;
  name: string;
  installation: AutoDesignSinkInstallation;
  baseKind: SinkBasePairing["kind"];
  minimumWidthIn: number | null;
  /** Base widths available in this line that can hold the sink. */
  baseWidthsIn: number[];
};

/**
 * The sink-to-base pairing table for the selected line, for the PR notes and the
 * pop-up's "pairs with" line. Widths come from the catalog the build will use.
 */
export function sinkPairingTable(
  products: readonly AutoDesignSinkProduct[],
  baseCatalog: readonly (AutoBuildCatalogCandidate & { width?: string | number | null })[],
): SinkPairingRow[] {
  return products.map((product) => {
    const pairing = sinkBasePairing(product);
    const minimumWidthIn = pairing.minimumWidthIn ?? 0;
    const widths = pairing.kind === "vanity"
      ? []
      : AUTO_DESIGN_SINK_BASE_WIDTHS.filter((width) => width + 0.1 >= minimumWidthIn
        && chooseSmallestPelicanSinkBase(baseCatalog, product, width) != null);
    return {
      pelicanCode: product.pelicanCode ?? null,
      name: product.name,
      installation: catalogSinkInstallation(product),
      baseKind: pairing.kind,
      minimumWidthIn: pairing.minimumWidthIn,
      baseWidthsIn: widths,
    };
  });
}

/** True when this candidate is a real Pelican sink the auto-designer can place. */
export function isAutoDesignSinkProduct(product: AutoDesignSinkProduct): boolean {
  if (!product?.id || !product.name) return false;
  const sub = (product.subCategory ?? "").toLowerCase();
  if (/accessor|disposal|vanity top/.test(sub)) return false;
  // A vanity basin or vanity top belongs to the bathroom workflow, never the
  // kitchen sink base the auto-designer offers here.
  if (sinkBasePairing(product).kind === "vanity") return false;
  const installation = catalogSinkInstallation(product);
  if (installation === "other") {
    // Only a verified profile may be placed without an explicit installation type.
    return Boolean(verifiedPelicanSinkProfile(product.pelicanCode));
  }
  return true;
}

/** Sinks that fit a sink base already in the plan (kind and opening width). */
export function sinksFittingExistingBase(
  products: readonly AutoDesignSinkProduct[],
  base: Pick<PlacedCabinet, "width" | "masterCode" | "description" | "subCategory">,
): AutoDesignSinkProduct[] {
  const openingWidthIn = sinkBaseOpeningWidthIn(base);
  const farmBase = /^fsb[-_]?\d/i.test(base.masterCode ?? "") || /farm(?:house)?/i.test(`${base.description ?? ""} ${base.subCategory ?? ""}`);
  return products.filter((product) => {
    if (!isAutoDesignSinkProduct(product)) return false;
    const pairing = sinkBasePairing(product);
    if (pairing.kind === "vanity") return false;
    if ((pairing.kind === "farmhouse") !== farmBase) return false;
    return (pairing.minimumWidthIn ?? 0) <= openingWidthIn + 0.001;
  });
}

/** The source-priced base record a picked sink auto-places into. */
export function sinkBaseForProduct<T extends AutoBuildCatalogCandidate & { width?: string | number | null }>(
  catalog: readonly T[],
  product: AutoDesignSinkProduct,
): T | null {
  const pairing = sinkBasePairing(product);
  if (pairing.kind === "vanity") return null;
  const minimumWidthIn = pairing.minimumWidthIn ?? 30;
  return chooseSmallestPelicanSinkBase(catalog, product, minimumWidthIn);
}

/**
 * How many distinct sink base widths this line sells. The pop-up uses it to say
 * why a sink cannot be placed instead of offering a base that does not exist.
 */
export function availableSinkBaseWidths(baseCatalog: readonly DesignCabinet[]): number[] {
  return AUTO_DESIGN_SINK_BASE_WIDTHS.filter((width) => baseCatalog.some((row) => (
    isSinkBaseCabinet(row) && Math.abs((Number(row.width) || 0) - width) < 0.1
  )));
}

/** Sinks whose verified profile cannot fit the narrowest base the line sells. */
export function sinksWithoutBase(
  products: readonly AutoDesignSinkProduct[],
  baseCatalog: readonly DesignCabinet[],
): AutoDesignSinkProduct[] {
  return products.filter((product) => isAutoDesignSinkProduct(product)
    && sinkBasePairing(product).kind !== "vanity"
    && sinkBaseForProduct(baseCatalog as never, product) == null);
}

/** Re-export so callers do not have to reach into pelicanAutoPlace for one constant. */
export { AUTO_DESIGN_SINK_BASE_WIDTHS };

/** Sinks from a catalog list that the auto-designer pop-up can offer. */
export function autoDesignSinkProductsPresent(products: readonly AutoDesignSinkProduct[]): AutoDesignSinkProduct[] {
  return products.filter((product) => isAutoDesignSinkProduct(product) && sinkBasePairing(product).kind !== "vanity");
}

/** True when the sink profile is source-verified, so the 3D mesh is measured geometry. */
export function hasVerifiedSinkGeometry(product: AutoDesignSinkProduct): boolean {
  return Boolean(verifiedPelicanSinkProfile(product.pelicanCode));
}

/** A fit check used by the pop-up to hide sinks this line cannot base. */
export function sinkFitsBaseWidth(product: AutoDesignSinkProduct, widthIn: number): boolean {
  const profile = verifiedPelicanSinkProfile(product.pelicanCode);
  if (!profile) return true;
  return verifiedPelicanSinkFitsCabinet(profile, widthIn);
}

/**
 * The sink base the measured build should seat once a sink is picked.
 *
 * The admin's measured width and style stay authoritative unless the sink
 * cannot sit in them: an apron-front sink switches the build to the farmhouse
 * base, and a sink wider than the measured base widens it to the smallest
 * source-priced base that fits. Nothing is ever narrowed.
 */
export function resolveAutoDesignSinkBase(input: {
  product: AutoDesignSinkProduct | null;
  measuredWidthIn: number;
  measuredKind: "regular" | "farmhouse";
  baseCatalog: readonly DesignCabinet[];
}): { widthIn: number; kind: "regular" | "farmhouse"; changed: boolean; note: string | null } {
  const measured = input.measuredKind;
  const product = input.product;
  if (!product || !isAutoDesignSinkProduct(product)) {
    return { widthIn: input.measuredWidthIn, kind: measured, changed: false, note: null };
  }
  const pairing = sinkBasePairing(product);
  if (pairing.kind === "vanity") {
    return { widthIn: input.measuredWidthIn, kind: measured, changed: false, note: null };
  }
  const kind: "regular" | "farmhouse" = pairing.kind === "farmhouse" ? "farmhouse" : "regular";
  const minimum = pairing.minimumWidthIn ?? input.measuredWidthIn;
  let widthIn = Math.max(input.measuredWidthIn, minimum);
  if (sinkBaseForProduct(input.baseCatalog as never, product) == null) {
    const widened = AUTO_DESIGN_SINK_BASE_WIDTHS.find((width) => width >= widthIn
      && sinkBaseForProduct(input.baseCatalog as never, product) != null
      && sinkFitsBaseWidth(product, width));
    if (widened != null) widthIn = widened;
  }
  const changed = kind !== measured || Math.abs(widthIn - input.measuredWidthIn) > 0.001;
  const note = !changed
    ? null
    : kind !== measured
      ? `${product.name} is an apron-front sink, so the build uses the matching ${kind === "farmhouse" ? "farmhouse (FSB)" : "regular"} sink base at ${widthIn}″.`
      : `${product.name} needs at least ${minimum}″, so the sink base was widened from ${input.measuredWidthIn}″ to ${widthIn}″.`;
  return { widthIn, kind, changed, note };
}

export type AdditionalSinkBaseFit = {
  cabinet: DesignCabinet;
  wallId: string;
  alongIn: number;
  widthIn: number;
};

/**
 * What a picked sink does to the plan. Every branch auto-places the basin; the
 * person never drags one.
 */
export type AutoDesignSinkPlan =
  | {
    kind: "reuse";
    /** Sink base that already exists and takes the basin. */
    hostUid: string;
    hostCode: string;
    sink: SinkFixture;
  }
  | {
    kind: "swap-base";
    /** Standard sink base replaced by its matching farmhouse base. */
    hostUid: string;
    fromCode: string;
    toCode: string;
    cabinet: PlacedCabinet;
    removedSinkUids: string[];
    sink: SinkFixture;
  }
  | {
    kind: "add-base";
    cabinet: DesignCabinet;
    wallId: string;
    alongIn: number;
  }
  | { kind: "blocked"; reason: string };

/**
 * Places a Pelican sink with no manual step.
 *
 * "replace" seats the basin in a sink base that already exists — the measured
 * one first. When the sink is an apron-front model and only a standard base is
 * there, the base is swapped for its matching farmhouse base instead of forcing
 * an apron sink into a standard box. "add" always seats another sink base and
 * centers a basin in it, so a second sink never stacks on the first.
 */
export function planAutoDesignSinkPlacement(input: {
  product: AutoDesignSinkProduct;
  mode: "replace" | "add";
  room: RoomData;
  placed: readonly PlacedCabinet[];
  sinks: readonly SinkFixture[];
  openings: readonly WallOpening[];
  baseCatalog: readonly DesignCabinet[];
  /** Kitchen walls the measured build owns, in run order. */
  wallIds: readonly string[];
}): AutoDesignSinkPlan {
  const { product, mode } = input;
  if (!isAutoDesignSinkProduct(product)) {
    return { kind: "blocked", reason: `${product.name} is not a sink the Designer can place.` };
  }
  const pairing = sinkBasePairing(product);
  if (pairing.kind === "vanity") {
    return { kind: "blocked", reason: `${product.name} is a vanity basin. Add a vanity base and use the vanity fixture picker; it is not a kitchen sink.` };
  }
  const placedProduct = {
    id: product.id,
    pelicanCode: product.pelicanCode ?? null,
    name: product.name,
    imageUrl: product.imageUrl ?? null,
    size: product.size ?? null,
  };
  if (mode === "replace") {
    const host = openPelicanSinkHost(placedProduct, [...input.placed], [...input.sinks]);
    if (host) {
      return {
        kind: "reuse",
        hostUid: host.uid,
        hostCode: host.masterCode,
        sink: buildPelicanSinkOnCabinet(placedProduct, host, input.room),
      };
    }
    if (pairing.kind === "farmhouse") {
      const standardBase = [...input.placed]
        .filter((cabinet) => isSinkBaseCabinet(cabinet) && !/^fsb[-_]?\d/i.test(cabinet.masterCode ?? ""))
        .find((cabinet) => Number(cabinet.width) + 0.01 >= (pairing.minimumWidthIn ?? 33));
      if (standardBase) {
        const swap = swapStandardSinkBaseForFarmSink(
          standardBase,
          input.baseCatalog,
          [...input.sinks],
          input.room,
          fixtureBelongsToCabinet,
        );
        if (swap.ok) {
          return {
            kind: "swap-base",
            hostUid: standardBase.uid,
            fromCode: swap.fromCode,
            toCode: swap.toCode,
            cabinet: swap.cabinet,
            removedSinkUids: swap.removedSinkUids,
            sink: buildPelicanSinkOnCabinet(placedProduct, swap.cabinet, input.room),
          };
        }
      }
    }
    const fallback = planAdditionalSinkBase({ ...input, product });
    if (!fallback) {
      return {
        kind: "blocked",
        reason: `No free span for the ${pairing.kind === "farmhouse" ? "farmhouse" : ""} sink base ${product.name} needs. Clear a wall run, then pick it again.`.replace(/\s+/g, " ").trim(),
      };
    }
    return {
      kind: "add-base",
      cabinet: fallback.cabinet,
      wallId: fallback.wallId,
      alongIn: fallback.alongIn,
    };
  }
  const extra = planAdditionalSinkBase({ ...input, product });
  if (!extra) {
    return {
      kind: "blocked",
      reason: `No free span for another ${product.name} sink base. Clear a wall run or remove a cabinet, then pick it again.`,
    };
  }
  return {
    kind: "add-base",
    cabinet: extra.cabinet,
    wallId: extra.wallId,
    alongIn: extra.alongIn,
  };
}

/**
 * The plan-base rectangle a new sink base occupies, for callers that need the
 * sink geometry before they commit the cabinet to the room.
 */
export function extraSinkBaseProbe(fit: AdditionalSinkBaseFit): PlacedCabinet {
  return probeBase(fit);
}

function probeBase(fit: AdditionalSinkBaseFit): PlacedCabinet {
  return {
    uid: `pelican-extra-sink-base-${fit.cabinet.id}`,
    cabinetId: fit.cabinet.id,
    masterCode: fit.cabinet.masterCode,
    description: fit.cabinet.description,
    category: fit.cabinet.category ?? null,
    subCategory: fit.cabinet.subCategory ?? null,
    placement: "base",
    x: 0,
    y: 0,
    width: fit.widthIn,
    depth: Number(fit.cabinet.depth) || STD.BASE_DEPTH,
    height: Number(fit.cabinet.height) || STD.BASE_HEIGHT,
    rotation: 0,
    wallId: fit.wallId,
    wallOffset: fit.alongIn,
  } as PlacedCabinet;
}

/**
 * Finds the next free span for a second (or later) sink base. It searches the
 * build's own walls in run order and refuses to overlap a cabinet, an opening,
 * a corner clearance, the refrigerator panel limit, or a wall end.
 */
export function planAdditionalSinkBase(input: {
  product: AutoDesignSinkProduct;
  baseCatalog: readonly DesignCabinet[];
  room: RoomData;
  placed: readonly PlacedCabinet[];
  openings: readonly WallOpening[];
  wallIds: readonly string[];
}): AdditionalSinkBaseFit | null {
  const base = sinkBaseForProduct(input.baseCatalog as never, input.product) as DesignCabinet | null;
  if (!base) return null;
  const widthIn = Number(base.width) || sinkBasePairing(input.product).minimumWidthIn || 30;
  const depthIn = Number(base.depth) || STD.BASE_DEPTH;
  const heightIn = Number(base.height) || STD.BASE_HEIGHT;
  const walls = input.wallIds.length > 0 ? [...input.wallIds] : roomWallRunFrames(input.room).map((frame) => frame.id);
  for (const wallId of walls) {
    const limit = refrigeratorLimitIn({ placed: [...input.placed], room: input.room, wallId });
    const segments = freeSegmentsOnWall(
      wallId as WallSide,
      input.room,
      [...input.placed],
      [...input.openings],
      widthIn,
      0,
      "base",
      false,
      undefined,
      depthIn,
    );
    for (const segment of segments) {
      if (segment.length + 0.001 < widthIn) continue;
      const start = segment.start;
      if (limit && start < limit.endIn && start + widthIn > limit.startIn) continue;
      const spot = boundedWallPlacementAt(start, widthIn, depthIn, wallId, input.room);
      if (!spot) continue;
      const probe = {
        uid: "auto-design-extra-sink-base-probe",
        cabinetId: base.id,
        masterCode: base.masterCode,
        description: base.description,
        placement: "base" as const,
        ...spot,
        width: widthIn,
        depth: depthIn,
        height: heightIn,
        wallId: spot.wallId ?? wallId,
        wallOffset: spot.wallOffset ?? start,
      } as PlacedCabinet;
      if (appendCollisionFreePlacements([...input.placed], [probe], input.room).rejected.length > 0) continue;
      return { cabinet: base, wallId, alongIn: spot.wallOffset ?? start, widthIn };
    }
  }
  return null;
}
