import type { SinkFixture } from "./design";
import { surfaceRole } from "./pelican";
import {
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
