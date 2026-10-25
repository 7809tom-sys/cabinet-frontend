import { wallCabinetSkuDimensions } from "@/lib/design";

/** The source-backed cabinet fields the over-fridge picker needs. */
export type OverFridgeCatalogCabinet = {
  id: number;
  masterCode: string;
  width: string | null;
  height: string | null;
  depth: string | null;
};

export type OverFridgeDimensions = { width: number; height: number; depth: number };

/**
 * Read all three dimensions from the same catalog record. Stored catalog columns
 * are authoritative; the SKU parser is only a compatibility fallback for older
 * imported rows with an empty dimension field.
 */
export function overFridgeCatalogDimensions(cabinet: OverFridgeCatalogCabinet): OverFridgeDimensions | null {
  const sku = wallCabinetSkuDimensions(cabinet.masterCode);
  const storedWidth = Number.parseFloat(String(cabinet.width ?? ""));
  const storedHeight = Number.parseFloat(String(cabinet.height ?? ""));
  const storedDepth = Number.parseFloat(String(cabinet.depth ?? ""));
  const width = Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : sku?.width ?? 0;
  const height = Number.isFinite(storedHeight) && storedHeight > 0 ? storedHeight : sku?.height ?? 0;
  const depth = Number.isFinite(storedDepth) && storedDepth > 0 ? storedDepth : sku?.depth ?? 0;
  return width > 0 && height > 0 && depth > 0 ? { width, height, depth } : null;
}

function sameDimension(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.5;
}

/** Exact catalog match only—never silently substitutes a narrower cabinet. */
export function exactOverFridgeCabinet<T extends OverFridgeCatalogCabinet>(
  cabinets: readonly T[],
  wanted: OverFridgeDimensions,
): T | null {
  return cabinets
    .filter((cabinet) => {
      const dims = overFridgeCatalogDimensions(cabinet);
      return dims != null
        && sameDimension(dims.width, wanted.width)
        && sameDimension(dims.height, wanted.height)
        && sameDimension(dims.depth, wanted.depth);
    })
    .sort((a, b) => a.masterCode.localeCompare(b.masterCode))[0] ?? null;
}

/** Width buttons use catalog availability for the currently selected height/depth. */
export function availableOverFridgeWidths<T extends OverFridgeCatalogCabinet>(
  cabinets: readonly T[],
  height: number,
  depth: number,
): number[] {
  return Array.from(new Set(
    cabinets.flatMap((cabinet) => {
      const dims = overFridgeCatalogDimensions(cabinet);
      return dims != null && sameDimension(dims.height, height) && sameDimension(dims.depth, depth)
        ? [dims.width]
        : [];
    }),
  )).sort((a, b) => a - b);
}

/**
 * A non-selectable suggestion for an unavailable exact choice. The user must
 * choose an available size; this helper never feeds placement or the cart.
 */
export function closestOverFridgeSuggestion<T extends OverFridgeCatalogCabinet>(
  cabinets: readonly T[],
  wanted: OverFridgeDimensions,
): T | null {
  return cabinets
    .filter((cabinet) => {
      const dims = overFridgeCatalogDimensions(cabinet);
      return dims != null && sameDimension(dims.height, wanted.height) && sameDimension(dims.depth, wanted.depth);
    })
    .sort((a, b) => {
      const aDims = overFridgeCatalogDimensions(a)!;
      const bDims = overFridgeCatalogDimensions(b)!;
      const widthDelta = Math.abs(aDims.width - wanted.width) - Math.abs(bDims.width - wanted.width);
      return widthDelta || a.masterCode.localeCompare(b.masterCode);
    })[0] ?? null;
}
