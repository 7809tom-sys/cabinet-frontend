import type { SinkFixture } from "./design";
import { surfaceRole } from "./pelican";
import {
  DEFAULT_PELICAN_KITCHEN_FAUCET,
  DEFAULT_PELICAN_VANITY_FAUCET,
  defaultPelicanKitchenFaucetProfile,
  defaultPelicanVanityFaucetProfile,
  isVerifiedPelicanVanityFaucet,
  verifiedPelicanFaucetProfile,
  verifiedPelicanPotFillerProfile,
} from "./pelicanFixtureProfiles";

/** A faucet row from the existing Pelican / surfaces catalog. Never invented locally. */
export type AutoDesignFaucetProduct = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  category?: string | null;
  subCategory?: string | null;
  imageUrl?: string | null;
  sellPrice?: number | null;
  slug?: string | null;
  size?: string | null;
  brand?: string | null;
  finish?: string | null;
};

export type AutoDesignFaucetGroup = {
  brand: string;
  products: AutoDesignFaucetProduct[];
};

const NAMED_FINISHES = ["Oil Rubbed Bronze", "Matte Black", "Brushed Nickel", "Brushed Gold", "Chrome"] as const;

export function catalogFaucetBrand(product: AutoDesignFaucetProduct): string {
  const explicit = product.brand?.trim();
  if (explicit) return explicit;
  const name = product.name?.trim() ?? "";
  if (/^stonecreek\b/i.test(name)) return "StoneCreek";
  if (/^pelican\b/i.test(name)) return "Pelican";
  if (/^PL-/i.test(product.pelicanCode?.trim() ?? "")) return "Pelican";
  const first = name.split(/\s+/).filter(Boolean)[0];
  return first || "Other";
}

export function catalogFaucetFinish(product: AutoDesignFaucetProduct): string | null {
  const explicit = product.finish?.trim();
  if (explicit) return explicit;
  const profile = verifiedPelicanFaucetProfile(product.pelicanCode);
  if (profile?.finish) {
    return profile.finish.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  const name = product.name ?? "";
  return NAMED_FINISHES.find((finish) => name.includes(finish)) ?? null;
}

export function isCatalogFaucet(product: AutoDesignFaucetProduct): boolean {
  return surfaceRole({
    category: product.category,
    subCategory: product.subCategory,
    name: product.name,
  }) === "faucet";
}

/** Deck-mounted kitchen faucet. Wall-mounted, vanity, and pot-filler fixtures stay off the sink deck. */
export function isAutoDesignDeckFaucet(product: AutoDesignFaucetProduct): boolean {
  if (!isCatalogFaucet(product)) return false;
  if (isVerifiedPelicanVanityFaucet(product.pelicanCode)) return false;
  if (verifiedPelicanPotFillerProfile(product.pelicanCode)) return false;
  const profile = verifiedPelicanFaucetProfile(product.pelicanCode);
  if (profile?.installation === "wall-mounted-8-inch-center") return false;
  if (/pot filler|wall[-\s]?mounted|vanity/i.test(product.name)) return false;
  return true;
}

/** First source-verified single-hole kitchen faucet, otherwise the first deck-mounted catalog faucet. */
export function defaultAutoDesignFaucet(products: readonly AutoDesignFaucetProduct[]): AutoDesignFaucetProduct | null {
  const deck = products.filter(isAutoDesignDeckFaucet);
  const verified = deck.filter((product) => verifiedPelicanFaucetProfile(product.pelicanCode)?.installation === "single-hole");
  const pool = (verified.length > 0 ? verified : deck)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
  return pool[0] ?? null;
}

export function groupFaucetsByBrand(products: readonly AutoDesignFaucetProduct[]): AutoDesignFaucetGroup[] {
  const groups = new Map<string, AutoDesignFaucetProduct[]>();
  for (const product of products) {
    if (!isAutoDesignDeckFaucet(product)) continue;
    const brand = catalogFaucetBrand(product);
    const list = groups.get(brand) ?? [];
    list.push(product);
    groups.set(brand, list);
  }
  return Array.from(groups.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([brand, list]) => ({
      brand,
      products: list.slice().sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id),
    }));
}

type FaucetSink = SinkFixture;

function withCatalogFaucet<T extends FaucetSink>(sink: T, product: AutoDesignFaucetProduct): T {
  const profile = verifiedPelicanFaucetProfile(product.pelicanCode);
  return {
    ...sink,
    faucet: true,
    autoDesignFaucet: true,
    faucetRearDeckOffsetIn: sink.faucetRearDeckOffsetIn ?? (sink.type === "farmhouse" ? undefined : 1.25),
    pelicanFaucetProductId: product.id,
    pelicanFaucetProductName: product.name,
    pelicanFaucetProductImage: product.imageUrl ?? undefined,
    pelicanFaucetProfileId: profile?.id,
    faucetOverallHeight: profile?.overallHeightIn,
    faucetSpoutLength: profile?.spoutLengthIn,
    faucetSpoutHeight: profile?.spoutHeightIn,
    faucetFinish: profile?.finish,
    faucetForm: profile?.profile,
    faucetCenterSpread: profile?.centerSpreadIn,
  };
}

/**
 * Gives a sink one deck-mounted faucet. A sink that already has a faucet product
 * is left alone. The faucet stays on the sink record, so moving or deleting the
 * sink moves or deletes it.
 */
export function ensureAutoDesignFaucet<T extends FaucetSink>(
  sink: T,
  product: AutoDesignFaucetProduct | null,
): { sink: T; attached: boolean } {
  if (sink.pelicanFaucetProductId != null) return { sink, attached: false };
  if (sink.faucet && sink.autoDesignFaucet && !product) return { sink, attached: false };
  if (sink.faucet && !product) return { sink: { ...sink, autoDesignFaucet: true }, attached: false };
  if (product) return { sink: withCatalogFaucet(sink, product), attached: true };
  return {
    sink: {
      ...sink,
      faucet: true,
      autoDesignFaucet: true,
      faucetRearDeckOffsetIn: sink.faucetRearDeckOffsetIn ?? (sink.type === "farmhouse" ? undefined : 1.25),
    },
    attached: true,
  };
}

/** Replaces the auto-placed faucet with the catalog product the user picked. */
export function applyChosenAutoDesignFaucet<T extends FaucetSink>(sink: T, product: AutoDesignFaucetProduct): T {
  return withCatalogFaucet(sink, product);
}

/** True when this sink already carries a faucet, catalog or default. */
export function sinkHasFaucet(sink: FaucetSink | null | undefined): boolean {
  return Boolean(sink && sink.faucet);
}

/**
 * True when this sink's faucet can actually be drawn: it has a form and the three
 * published dimensions the 3D assembly is built from.
 *
 * A bare `faucet: true` flag is not enough. `makeSink` sets it on every new sink
 * before any faucet has been chosen, so treating the flag alone as "already has a
 * faucet" would leave the sink with nothing to draw — which is exactly the bug this
 * rule exists to fix. A faucet that IS drawable is never touched.
 */
export function sinkHasRenderableFaucet(sink: FaucetSink | null | undefined): boolean {
  if (!sink || !sink.faucet) return false;
  return Boolean(
    sink.faucetForm
    && sink.faucetOverallHeight != null && sink.faucetOverallHeight > 0
    && sink.faucetSpoutLength != null && sink.faucetSpoutLength > 0
    && sink.faucetSpoutHeight != null && sink.faucetSpoutHeight > 0,
  );
}

/**
 * True when this sink needs nothing more: it already has a drawable faucet.
 * This is the "add-only" gate — anything it accepts is returned untouched.
 */
export function sinkFaucetIsSatisfied(sink: FaucetSink | null | undefined): boolean {
  return sinkHasRenderableFaucet(sink);
}

/** True when this sink's faucet is the built-in default (no catalog row chosen). */
export function sinkHasDefaultFaucet(sink: FaucetSink | null | undefined): boolean {
  return Boolean(sink && sink.faucet && sink.defaultFaucet === true);
}

export type FaucetAttachSource = "catalog" | "default" | "existing";

export type MandatoryFaucetResult<T extends FaucetSink> = {
  sinks: T[];
  /** "existing" when nothing changed: an existing faucet is never replaced. */
  source: FaucetAttachSource | "none";
  /** Sinks that gained a faucet on this pass. */
  attachedUids: string[];
  /** True when the built-in default fixture was used because no catalog row existed. */
  usedDefault: boolean;
  /** Plain-language notes, including the "no catalog faucet, used the default" report. */
  notes: string[];
};

/**
 * HARD RULE (owner, Nov 5 2026): every build places a faucet at the sink.
 *
 * Mandatory like the over-range bridge. Every sink fixture in the plan gets exactly
 * one deck-mounted faucet, centered on the sink base, on the countertop, drawn in
 * 3D. Add-only:
 *
 *  - a sink that already has a faucet — a chosen catalog row, a previously
 *    auto-placed one, or the default fixture — is returned untouched;
 *  - nothing is deleted or replaced;
 *  - when the catalog has no usable faucet row, the built-in default fixture
 *    (`DEFAULT_PELICAN_KITCHEN_FAUCET`, real published dimensions) is used and
 *    reported in `notes`, never silently substituted.
 *
 * The faucet lives on the sink record, so it moves and deletes with the sink and is
 * serialized with the layout.
 */
export function ensureMandatorySinkFaucets<T extends FaucetSink>(
  sinks: readonly T[],
  catalogProducts: readonly AutoDesignFaucetProduct[],
  options: { bathroom?: boolean } = {},
): MandatoryFaucetResult<T> {
  const catalog = defaultAutoDesignFaucet(catalogProducts);
  const notes: string[] = [];
  const attachedUids: string[] = [];
  let usedDefault = false;
  let source: FaucetAttachSource | "none" = "none";

  const next = sinks.map((sink) => {
    // Add-only: an existing, DRAWABLE faucet is never replaced or removed. A bare
    // `faucet: true` with no dimensions draws nothing, so it still gets one.
    if (sinkFaucetIsSatisfied(sink)) {
      source = "existing";
      return sink;
    }
    const withFaucet = catalog
      ? withCatalogFaucet(sink, catalog)
      : withDefaultFaucet(sink, options.bathroom === true);
    if (!catalog) usedDefault = true;
    source = catalog ? "catalog" : "default";
    attachedUids.push(sink.uid);
    return withFaucet;
  });

  if (attachedUids.length > 0) {
    notes.push(catalog
      ? `${catalog.name} was placed at ${attachedUids.length === 1 ? "the sink" : `each of the ${attachedUids.length} sinks`}, centered on the sink base.`
      : (() => {
        const fallback = options.bathroom === true ? DEFAULT_PELICAN_VANITY_FAUCET : DEFAULT_PELICAN_KITCHEN_FAUCET;
        return `The selected line sells no faucet, so the default ${fallback.name} (${fallback.pelicanCode}) was placed at ${attachedUids.length === 1 ? "the sink" : `each of the ${attachedUids.length} sinks`}.`;
      })());
  }
  if (sinks.length === 0) notes.length = 0;

  return { sinks: next, source, attachedUids, usedDefault, notes };
}

/**
 * The built-in default fixture, applied to a sink with no catalog faucet.
 *
 * Additive like `withCatalogFaucet`, and it carries the published dimensions the
 * 3D assembly needs. `defaultFaucet` marks it so a later pass knows the row came
 * from the default and a real catalog pick can still replace it.
 */
export function withDefaultFaucet<T extends FaucetSink>(sink: T, bathroom = false): T {
  // A bathroom vanity gets the verified vanity faucet, never the 26" kitchen
  // pull-down the kitchen build uses.
  const profile = bathroom ? defaultPelicanVanityFaucetProfile() : defaultPelicanKitchenFaucetProfile();
  return {
    ...sink,
    faucet: true,
    autoDesignFaucet: true,
    defaultFaucet: true,
    faucetRearDeckOffsetIn: sink.faucetRearDeckOffsetIn ?? (sink.type === "farmhouse" ? undefined : 1.25),
    pelicanFaucetProfileId: profile.id,
    faucetOverallHeight: profile.overallHeightIn,
    faucetSpoutLength: profile.spoutLengthIn,
    faucetSpoutHeight: profile.spoutHeightIn,
    faucetFinish: profile.finish,
    faucetForm: profile.profile,
    faucetCenterSpread: profile.centerSpreadIn,
  };
}

/**
 * True when every sink in the plan has a faucet that can be drawn. Used by the
 * build and by the load pass to decide whether anything is left to do.
 */
export function everySinkHasFaucet(sinks: readonly FaucetSink[]): boolean {
  return sinks.every((sink) => sinkFaucetIsSatisfied(sink));
}

export function catalogFaucetSurface(product: AutoDesignFaucetProduct) {
  return {
    id: product.id,
    pelicanCode: product.pelicanCode ?? null,
    slug: product.slug ?? product.name,
    name: product.name,
    category: product.category ?? "Sinks & Faucets",
    subCategory: product.subCategory ?? "Faucets",
    size: product.size ?? null,
    imageUrl: product.imageUrl ?? null,
    sellPrice: product.sellPrice ?? null,
  };
}
