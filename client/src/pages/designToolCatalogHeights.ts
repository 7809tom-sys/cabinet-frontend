import { isKneeDrawerItem, resolvedDesignCabinetDimensions, type DesignCabinet } from "@/lib/design";

export type HeightFilterPaletteType =
  | "base"
  | "vanity"
  | "corner"
  | "wall"
  | "wallht"
  | "tall"
  | "appliance"
  | "opening"
  | "closetparts"
  | "accessory"
  | "panel"
  | "furniture"
  | "surfaces";

export interface CatalogHeightOption {
  height: number;
  count: number;
  label: string;
}

const BASE_BOX_HEIGHT = 34.5;
const FILTERABLE_TYPES = new Set<HeightFilterPaletteType>(["base", "vanity", "corner", "wall", "wallht", "tall"]);

export function formatCatalogInchValue(dimension: number) {
  const whole = Math.floor(dimension);
  const fraction = dimension - whole;
  if (Math.abs(fraction - 0.5) < 0.01) return `${whole}½`;
  if (fraction < 0.01) return `${whole}`;
  return dimension.toFixed(2).replace(/\.?0+$/, "");
}

export function formatCatalogHeight(height: number) {
  return `${formatCatalogInchValue(height)}\"`;
}

export function catalogHeightForCabinet(
  cabinet: DesignCabinet,
  paletteType: HeightFilterPaletteType,
  isCornerBase: (cabinet: DesignCabinet) => boolean = () => false,
) {
  if (!FILTERABLE_TYPES.has(paletteType)) return null;
  // A vanity knee drawer is a 7-inch insert mounted above an open knee space;
  // it is not a 34½-inch floor-standing box.
  if (paletteType === "vanity" && isKneeDrawerItem(cabinet)) {
    const height = resolvedDesignCabinetDimensions(cabinet).height;
    return Number.isFinite(height) && height > 0 ? height : null;
  }
  if (paletteType === "base" || paletteType === "vanity" || (paletteType === "corner" && isCornerBase(cabinet))) {
    return BASE_BOX_HEIGHT;
  }
  const height = resolvedDesignCabinetDimensions(cabinet).height;
  return Number.isFinite(height) && height > 0 ? height : null;
}

export function catalogHeightOptions(
  cabinets: DesignCabinet[],
  paletteType: HeightFilterPaletteType,
  isCornerBase?: (cabinet: DesignCabinet) => boolean,
): CatalogHeightOption[] {
  if (!FILTERABLE_TYPES.has(paletteType)) return [];
  const counts = new Map<number, number>();
  for (const cabinet of cabinets) {
    const height = catalogHeightForCabinet(cabinet, paletteType, isCornerBase);
    if (height == null) continue;
    counts.set(height, (counts.get(height) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([height, count]) => ({ height, count, label: formatCatalogHeight(height) }));
}

export function filterCatalogByHeight(
  cabinets: DesignCabinet[],
  paletteType: HeightFilterPaletteType,
  selectedHeight: number | null,
  isCornerBase?: (cabinet: DesignCabinet) => boolean,
) {
  if (selectedHeight == null || !FILTERABLE_TYPES.has(paletteType)) return cabinets;
  return cabinets.filter((cabinet) => {
    const height = catalogHeightForCabinet(cabinet, paletteType, isCornerBase);
    return height != null && Math.abs(height - selectedHeight) < 0.01;
  });
}
