import {
  fixtureIsOnCabinetFootprint,
  isSinkBaseCabinet,
  type PlacedCabinet,
  type SinkFixture,
} from "./design";
import { isBathroomVanityCabinet } from "./bathroomVanityCatalog";

/**
 * A bathroom vanity is sold with a basin and a faucet that live as `SinkFixture`
 * children of the cabinet, not as separate plan items. Deleting the vanity has to
 * take those children with it, and has to take their catalog rows out of the cart
 * — otherwise the design looks empty while the quote still bills a sink and tap.
 */
export type CabinetFixtureRemoval = {
  /** Fixtures installed in this cabinet. */
  sinks: SinkFixture[];
  /** Catalog product ids those fixtures bill (basin and its faucet). */
  productIds: number[];
};

/**
 * A fixture belongs to a cabinet by exact ownership (`cabinetUid`) or, for a
 * legacy fixture saved before that field existed, by its center sitting inside
 * the cabinet's own floor footprint.
 *
 * The footprint fallback is deliberately narrow. A wall cabinet hangs over the
 * same plan rectangle as the base below it, so treating its footprint as
 * ownership would delete the base's sink whenever the upper was removed. Only a
 * sink base or a bathroom vanity — cabinets a basin is actually installed in —
 * may claim a fixture by footprint.
 */
export function cabinetFixtureRemoval(
  cabinet: PlacedCabinet,
  sinks: readonly SinkFixture[],
): CabinetFixtureRemoval {
  const ownsByFootprint = isSinkBaseCabinet(cabinet) || isBathroomVanityCabinet(cabinet);
  const owned = sinks.filter((sink) => (
    sink.cabinetUid === cabinet.uid
    || (ownsByFootprint && fixtureIsOnCabinetFootprint(sink, cabinet))
  ));
  const productIds = new Set<number>();
  for (const sink of owned) {
    if (typeof sink.pelicanProductId === "number") productIds.add(sink.pelicanProductId);
    if (typeof sink.pelicanFaucetProductId === "number") productIds.add(sink.pelicanFaucetProductId);
  }
  return { sinks: owned, productIds: Array.from(productIds) };
}

/**
 * Selected-surface rows to drop from the cart once these fixtures are gone.
 *
 * A product only leaves the cart when nothing left in the design still uses it:
 * two vanities sharing one faucet keep the faucet while the other sink stands.
 * Rows the shopper never selected are ignored, so a materials-list entry cannot
 * be deleted by a fixture that never billed it.
 */
export function surfaceIdsToDropWithFixtures(input: {
  removedSinks: readonly SinkFixture[];
  remainingSinks: readonly SinkFixture[];
  selectedSurfaceIds: readonly number[];
}): number[] {
  const stillBilled = new Set<number>();
  for (const sink of input.remainingSinks) {
    if (typeof sink.pelicanProductId === "number") stillBilled.add(sink.pelicanProductId);
    if (typeof sink.pelicanFaucetProductId === "number") stillBilled.add(sink.pelicanFaucetProductId);
  }
  const selected = new Set(input.selectedSurfaceIds);
  const drop = new Set<number>();
  for (const sink of input.removedSinks) {
    for (const id of [sink.pelicanProductId, sink.pelicanFaucetProductId]) {
      if (typeof id !== "number") continue;
      if (stillBilled.has(id)) continue;
      if (!selected.has(id)) continue;
      drop.add(id);
    }
  }
  return Array.from(drop);
}

/**
 * True when this plan still holds a cabinet that carries a countertop. Deleting
 * the last one leaves a countertop quote line over nothing, so the bathroom
 * delete path drops it at the same time.
 */
export function planSupportsCountertop(
  placed: readonly PlacedCabinet[],
  island: { width: number; depth: number } | null | undefined,
): boolean {
  if (island) return true;
  return placed.some((cabinet) => (
    cabinet.placement === "base" || cabinet.placement === "tall" || cabinet.placement === "baseTop"
  ));
}
