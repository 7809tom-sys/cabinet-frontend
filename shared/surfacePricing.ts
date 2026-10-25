export type SurfacePriceSource = {
  listPrice: string | null;
  yourCost: string | null;
};

export type AuthorizedSurfacePriceBasis = {
  amount: number;
  kind: "landed_cost" | "supplier_list";
};

/**
 * Return the verified source price basis for a public surface product.
 * A positive landed cost is preferred. Legacy imports sometimes contain a
 * literal zero cost alongside a valid supplier list price; that placeholder
 * must not create a $0 sell price or hide the item from public catalog results.
 */
export function authorizedSurfacePriceBasis(product: SurfacePriceSource): AuthorizedSurfacePriceBasis | null {
  const cost = Number(product.yourCost);
  if (Number.isFinite(cost) && cost > 0) return { amount: cost, kind: "landed_cost" };

  const list = Number(product.listPrice);
  if (Number.isFinite(list) && list > 0) return { amount: list, kind: "supplier_list" };

  return null;
}

export function positiveAuthorizedSurfaceBase(product: SurfacePriceSource): number | null {
  return authorizedSurfacePriceBasis(product)?.amount ?? null;
}
