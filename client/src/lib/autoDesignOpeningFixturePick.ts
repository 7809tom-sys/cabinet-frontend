/**
 * Rule 1: the designer-open pop-up is the one chance to pick a sink and faucet.
 * If the shopper already chose one (or both) there, Auto Design must apply that
 * choice after the layout is built and must not ask again at the end.
 */

export type OpeningFixturePick = { sinkId: number | null; faucetId: number | null };

export type PostBuildFixturePrompts = {
  /** True when no sink was chosen at open, so the post-build sink question is still needed. */
  askSink: boolean;
  /** True when no faucet was chosen at open, so the post-build faucet question is still needed. */
  askFaucet: boolean;
};

export function postBuildFixturePrompts(pick: OpeningFixturePick | null | undefined): PostBuildFixturePrompts {
  return {
    askSink: pick?.sinkId == null,
    askFaucet: pick?.faucetId == null,
  };
}

export function productFromOpeningPick<T extends { id: number }>(
  products: readonly T[],
  productId: number | null | undefined,
): T | null {
  if (productId == null) return null;
  return products.find((product) => product.id === productId) ?? null;
}

import { sinkFaucetIsSatisfied } from "./autoDesignFaucet";

/**
 * True when this Auto Design run already has a sink on the measured sink base.
 * A second post-build placement must be skipped so the Designer does not crash
 * by drawing two sinks or two faucets on the same base.
 */
export function sinkAlreadyPlacedOnBase(
  sinks: readonly { cabinetUid?: string | null }[],
  sinkBaseUid: string | null | undefined,
): boolean {
  if (!sinkBaseUid) return false;
  return sinks.some((sink) => sink.cabinetUid === sinkBaseUid);
}

/** True when this sink already carries a drawable faucet, so a later fill must not add another. */
export function faucetAlreadyPlacedOnSink(sink: Parameters<typeof sinkFaucetIsSatisfied>[0]): boolean {
  return sinkFaucetIsSatisfied(sink);
}

/**
 * After a full run the plan should keep exactly one sink on the measured base,
 * with its faucet, never a second copy appended at the end.
 */
export function keepExistingAutoDesignSinkAndFaucet<T extends { cabinetUid?: string | null }>(
  sinks: readonly T[],
  sinkBaseUid: string | null | undefined,
): T[] {
  if (!sinkBaseUid) return [...sinks];
  const onBase = sinks.filter((sink) => sink.cabinetUid === sinkBaseUid);
  if (onBase.length > 0) return [onBase[0]!];
  return sinks.length > 0 ? [sinks[0]!] : [];
}
