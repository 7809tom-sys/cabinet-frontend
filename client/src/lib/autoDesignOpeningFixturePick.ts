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
