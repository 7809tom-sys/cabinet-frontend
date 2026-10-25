export type CatalogConstructionFilter = "all" | "builder" | "plywood" | "furniture-board" | "soft-close";

export type CatalogStyleFacet = {
  id: number;
  styleCode: string;
  ourName: string | null;
  aliasName?: string | null;
  color?: string | null;
  finish?: string | null;
  boxConstruction?: string | null;
  drawerConstruction?: string | null;
  hardware?: string | null;
  isBuilderGrade?: boolean | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

/**
 * Returns the explicit manufacturer color when present, falling back to a
 * source finish only when the catalog has no discrete color field.
 */
export function styleColorLabel(style: Pick<CatalogStyleFacet, "color" | "finish">): string | null {
  const color = (style.color ?? "").trim();
  const finish = (style.finish ?? "").trim();
  // Catalog import stores some true display colors as hex swatch values. A
  // shopper-facing filter should expose the documented finish name, not hex.
  const label = /^#[0-9a-f]{3,8}$/i.test(color) ? finish : (color || finish);
  return label || null;
}

export function styleMatchesConstruction(
  style: CatalogStyleFacet,
  construction: CatalogConstructionFilter,
): boolean {
  if (construction === "all") return true;

  const box = normalized(style.boxConstruction);
  const drawer = normalized(style.drawerConstruction);
  const hardware = normalized(style.hardware);
  const combined = `${box} ${drawer} ${hardware}`;

  if (construction === "builder") {
    return Boolean(style.isBuilderGrade) || combined.includes("builder");
  }
  if (construction === "plywood") return box.includes("plywood") || drawer.includes("plywood");
  if (construction === "furniture-board") return box.includes("furniture board");
  return hardware.includes("soft-close") && !hardware.includes("non-soft-close");
}

/**
 * The public catalog can show one stocked door style at a time. These facets
 * narrow its style picker without changing supplier availability or price.
 */
export function filterCatalogStyles(
  styles: CatalogStyleFacet[],
  { color, construction }: { color: string | null; construction: CatalogConstructionFilter },
): CatalogStyleFacet[] {
  const requestedColor = normalized(color);
  return styles.filter((style) => {
    const styleColor = normalized(styleColorLabel(style));
    return (!requestedColor || styleColor === requestedColor)
      && styleMatchesConstruction(style, construction);
  });
}

export function catalogColorOptions(styles: CatalogStyleFacet[]): string[] {
  return Array.from(
    new Set(styles.map(styleColorLabel).filter((color): color is string => Boolean(color))),
  ).sort((a, b) => a.localeCompare(b));
}

export const CATALOG_CONSTRUCTION_OPTIONS: Array<{ value: CatalogConstructionFilter; label: string }> = [
  { value: "all", label: "Any construction" },
  { value: "builder", label: "Builder Grade" },
  { value: "plywood", label: "Plywood components" },
  { value: "furniture-board", label: "Furniture-board box" },
  { value: "soft-close", label: "Soft-close hardware" },
];

export const CATALOG_SORT_OPTIONS = [
  { value: "sku-asc", label: "SKU: A–Z" },
  { value: "width-asc", label: "Width: narrow to wide" },
  { value: "width-desc", label: "Width: wide to narrow" },
  { value: "height-asc", label: "Height: short to tall" },
  { value: "height-desc", label: "Height: tall to short" },
  { value: "type-asc", label: "Cabinet type" },
] as const;

export type CatalogSort = (typeof CATALOG_SORT_OPTIONS)[number]["value"];
