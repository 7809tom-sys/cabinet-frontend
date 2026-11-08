import type { CartItem } from "@/contexts/CartContext";
import { buildSurfaceCartLines } from "@/lib/surfaceCartLines";
import { isCartableBathroomFixtureSurface } from "@/lib/cartableBathroomFixture";
import { faucetCartQuantities } from "@/lib/sinkBaseSelection";
import type { SinkFixture } from "@/lib/design";

/**
 * Reconcile a design's cart against what is actually placed in it.
 *
 * This is the rule the owner stated: the cart, quote and order must match exactly
 * what is placed in the design. Removing or replacing an item in the design removes
 * it from the cart. Adding from the popup does not count until the item is placed.
 * A default (non-chosen) faucet is never billed.
 *
 * The designer already has all the facts this needs:
 * - `selectedSurfaces` is the design's PRODUCT SELECTION (what the shopper picked);
 * - `sinks` / `furniture` / `potFillers` are the PLACEMENTS (what is actually in the
 *   room). A placement is the only thing that makes a fixture billable.
 *
 * This module turns those two lists into the fixture-quantity map the cart builder
 * reads, so "selected but not placed" lands at zero instead of the default of one.
 */
export type FixtureSurfacePick = {
  id: number;
  pelicanCode?: string | null;
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
  sellPrice?: number | null;
};

export type PlacementIdentity = {
  /** Exact Pelican catalog product id this placement came from. */
  pelicanProductId?: number | null;
};

/**
 * Quantity per Pelican product, counting ONLY real placements.
 *
 * Every selected fixture pick starts at zero, then each placement adds one. A pick
 * that no placement owns therefore stays at zero and `buildSurfaceCartLines` drops
 * it (`qty === 0` continues). Area materials are not seeded, so flooring, tile and
 * countertops keep being bought from the selection as before.
 */
export function fixtureQuantitiesFromPlacements(input: {
  selected: readonly FixtureSurfacePick[];
  furniture?: readonly PlacementIdentity[];
  /** Sinks are their own fixture family: the basin and the faucet it carries. */
  sinks?: readonly Pick<SinkFixture, "pelicanProductId" | "pelicanFaucetProductId">[];
  potFillers?: readonly { pelicanProductId?: number | null }[];
  /**
   * Pot-filler product ids that exist in the design but are not currently valid.
   * They are seeded at zero so a deleted or unmounted filler cannot bill.
   */
  zeroedPotFillerIds?: readonly (number | null | undefined)[];
}): Map<number, number> {
  const quantities = new Map<number, number>();
  for (const productId of input.zeroedPotFillerIds ?? []) {
    if (productId != null) quantities.set(productId, 0);
  }

  // 1. Everything selected that is a fixture starts at zero.
  for (const pick of input.selected) {
    if (isCartableBathroomFixtureSurface(pick)) quantities.set(pick.id, 0);
  }

  // 2. A real placement is the only thing that increments.
  const bump = (productId: number | null | undefined) => {
    if (productId == null) return;
    quantities.set(productId, (quantities.get(productId) ?? 0) + 1);
  };
  for (const fixture of input.furniture ?? []) bump(fixture.pelicanProductId);
  for (const filler of input.potFillers ?? []) bump(filler.pelicanProductId);

  // 3. A sink placement bills its basin, and bills its faucet only when the
  //    shopper actually chose one. A filled-in default faucet is drawn, never
  //    billed — `faucetCartQuantities` encodes that rule and returns zero for it.
  for (const sink of input.sinks ?? []) {
    // The basin is billed by its own product id, which the sink placement owns.
    bump((sink as { pelicanProductId?: number | null }).pelicanProductId);
  }
  faucetCartQuantities((input.sinks ?? []) as SinkFixture[]).forEach((quantity, productId) => {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  });

  return quantities;
}

/**
 * The design's final cart lines, built on the same basis the designer uses.
 *
 * `lines` is what the cart, quote and order must equal. Anything the previous cart
 * held that is not in here is an orphan.
 */
export function cartLinesForDesign(input: {
  selected: readonly FixtureSurfacePick[];
  areas?: Parameters<typeof buildSurfaceCartLines>[2];
  tier: Parameters<typeof buildSurfaceCartLines>[1];
  furniture?: readonly PlacementIdentity[];
  sinks?: readonly SinkFixture[];
  potFillers?: readonly { pelicanProductId?: number | null }[];
}): CartItem[] {
  const quantities = fixtureQuantitiesFromPlacements(input);
  return buildSurfaceCartLines([...input.selected] as Parameters<typeof buildSurfaceCartLines>[0], input.tier, input.areas ?? null, quantities) as CartItem[];
}

/** Stable key for comparing a cart line against a design line. */
export function cartLineKey(line: Pick<CartItem, "masterCode" | "styleId" | "tier">): string {
  return `${line.masterCode}::${line.styleId}::${line.tier}`;
}

export type CartReconciliation = {
  /** Lines the design says should be there. */
  expected: CartItem[];
  /** Lines that must be removed: they are not in the design. */
  orphans: CartItem[];
  /** Design lines that were missing from the cart. */
  missing: CartItem[];
  /** True when the cart already equals the design. */
  matches: boolean;
};

/**
 * Compare a cart snapshot against the design, so the reason for each removed line
 * can be reported rather than silently dropped.
 */
export function reconcileCartWithDesign(cart: readonly CartItem[], expected: readonly CartItem[]): CartReconciliation {
  const expectedKeys = new Map<string, CartItem>();
  for (const line of expected) expectedKeys.set(cartLineKey(line), line);
  const cartKeys = new Set(cart.map((line) => cartLineKey(line)));
  const orphans = cart.filter((line) => {
    const wanted = expectedKeys.get(cartLineKey(line));
    // A line survives only if the design still has it with the same quantity.
    return !wanted || wanted.qty !== line.qty;
  });
  const missing = expected.filter((line) => !cartKeys.has(cartLineKey(line)));
  return {
    expected: [...expected],
    orphans,
    missing,
    matches: orphans.length === 0 && missing.length === 0,
  };
}
