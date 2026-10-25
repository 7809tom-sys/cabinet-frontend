const SOURCE_THREE_DRAWER_RENDER = /\/manus-storage\/frameless-(?:(?:three-drawer|oven-three-drawer|vanity-three-drawer)-source-proportions|pantry-(?:single|double)-door-three-drawers)_[a-z0-9]+\.webp$/i;

/**
 * Source-model image recipes use two 7-3/8-inch fronts and one 15-inch front.
 * This is a public product-diagram projection only. Shared masters, source SKU
 * data, saved Designer layouts, and non-AEF artwork are not mutated.
 */
export function aefProductDiagramCabinet<T extends { drawerLayout?: string | null }>(cabinet: T, reviewedImageUrl: string | null | undefined): T {
  if (!reviewedImageUrl || !SOURCE_THREE_DRAWER_RENDER.test(reviewedImageUrl)) return cabinet;
  return { ...cabinet, drawerLayout: JSON.stringify([{ count: 1, height: 7.375 }, { count: 1, height: 7.375 }, { count: 1, height: 15 }]) };
}
