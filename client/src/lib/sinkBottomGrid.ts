/**
 * Pelican sinks ship with a matching stainless bottom grid, sold as its own
 * accessory SKU named "<sink model> Bottom Grid". Many grids serve several
 * sink models and name each one, for example
 * "PL-VS7030/PL-VS3070 Bottom Grid" or "PL-HA108/PL-HA108 ADA Bottom Grid".
 *
 * A grid protects the bowl and is a real purchasable part the customer expects
 * to see on the quote. It sits inside the basin, so it is a cart line only and
 * must never become a room geometry object or change the 3D scene.
 */

/** "PL-HA126ADA" -> "PL-HA126"; a genuine model code is returned unchanged. */
function baseGridModel(token: string): string {
  return /^PL-[A-Z0-9]+ADA$/.test(token) ? token.slice(0, -3) : token;
}

/** The sink models a grid name covers, or null when the row is not a grid. */
export function bottomGridSinkModels(productName: string | null | undefined): string[] | null {
  const text = (productName ?? "").trim();
  // A retired grid is named "PL-FC3018SB (old) Bottom Grid"; it still covers the
  // same sink, so a sink whose only grid is the old one still gets an offer.
  const match = text.match(/^(.*?)\s*(?:\(old\)\s+)?bottom\s+grid\b/i);
  if (!match) return null;
  const models = Array.from(
    match[1]!.matchAll(/PL-[A-Z0-9]+/gi),
    (entry) => baseGridModel(entry[0].toUpperCase()),
  );
  return models.length > 0 ? Array.from(new Set(models)) : null;
}

/** True when this catalog row is a bottom-grid accessory rather than a sink. */
export function isBottomGridProduct(product: { name?: string | null; subCategory?: string | null }): boolean {
  return Boolean(bottomGridSinkModels(product.name));
}

/**
 * "PL-FC3018SB 18g" -> "PL-FC3018SB"; "PL-HA108 ADA R0 18g" -> "PL-HA108".
 * Pelican puts gauge, radius, and ADA tokens after the model, so the model is
 * the first code-shaped token.
 */
export function sinkModelCode(code: string | null | undefined): string | null {
  const match = (code ?? "").trim().match(/^(PL-[A-Z0-9]+)/i);
  return match ? match[1]!.toUpperCase() : null;
}

/**
 * Pick the grids that fit the chosen sink.
 *
 * Several grids serve more than one model, so a match is any grid whose name
 * lists the sink's model. A grid naming a retired model with an "(old)" suffix
 * is only used when no current grid is on file.
 */
export function bottomGridsForSink<T extends { id: number; name?: string | null; sellPrice?: number | null; isActive?: boolean | null }>(
  sinkCode: string | null | undefined,
  grids: readonly T[],
): T[] {
  const model = sinkModelCode(sinkCode);
  if (!model) return [];
  const matching = grids.filter((grid) => (bottomGridSinkModels(grid.name) ?? []).includes(model));
  const priced = matching.filter((grid) => grid.isActive !== false && (grid.sellPrice ?? 0) > 0);
  if (priced.length === 0) return [];
  const current = priced.filter((grid) => !/\(old\)/i.test(grid.name ?? ""));
  return current.length > 0 ? current : priced;
}
