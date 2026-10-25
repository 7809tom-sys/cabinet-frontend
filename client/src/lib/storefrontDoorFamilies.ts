export type StorefrontDoorVariant = {
  styleId: number;
  styleCode?: string | null;
  name?: string | null;
  doorStyle?: string | null;
  doorPanelType?: string | null;
  boxConstruction?: string | null;
  finish?: string | null;
  color?: string | null;
  woodSpecies?: string | null;
  roomSceneImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  featured?: boolean;
  featuredDistributor?: boolean;
  featuredSortOrder?: number;
};

export type StorefrontDoorFamily<T extends StorefrontDoorVariant = StorefrontDoorVariant> = {
  key: string;
  label: string;
  variants: T[];
  featured: boolean;
  featuredSortOrder: number;
  selected: T;
};

function normalized(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Derives the merchandising family from catalog metadata, never from a style
 * name or SKU. The token checks intentionally use profile/construction fields.
 */
export function doorFamilyKey(variant: StorefrontDoorVariant): string {
  const profile = normalized(variant.doorStyle, variant.doorPanelType, variant.boxConstruction);
  if (profile.includes("slim")) return "slim-shaker";
  if (profile.includes("double")) return "double-shaker";
  if (profile.includes("glass")) return "glass";
  if (profile.includes("slab") || profile.includes("flat panel")) return "slab";
  if (profile.includes("raised")) return "raised-panel";
  if (profile.includes("shaker")) return "shaker";

  const fallback = (variant.doorPanelType || variant.doorStyle || variant.boxConstruction || "other-profile")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return fallback || "other-profile";
}

export function doorFamilyLabel(key: string, variants: readonly StorefrontDoorVariant[]): string {
  const labels: Record<string, string> = {
    "slim-shaker": "Slim Shaker",
    "double-shaker": "Double Shaker",
    shaker: "Shaker",
    slab: "Slab",
    "raised-panel": "Raised Panel",
    glass: "Glass",
  };
  if (labels[key]) return labels[key];
  const source = variants[0]?.doorPanelType || variants[0]?.doorStyle || "Other Door Profile";
  return titleCase(source);
}

function variantName(variant: StorefrontDoorVariant) {
  return (variant.name || variant.color || variant.finish || variant.styleCode || "").trim().toLowerCase();
}

function hasImage(variant: StorefrontDoorVariant) {
  return Boolean(variant.roomSceneImageUrl || variant.doorSampleImageUrl || variant.thumbnailImageUrl);
}

function cleanCatalogValue(value: string | null | undefined) {
  return value?.replace(/\s*\([^)]*\)\s*$/, "").trim() || "";
}

function isHex(value: string) {
  return /^#?[0-9a-f]{6}$/i.test(value.trim());
}

function isMatching(value: string) {
  return /^matching(?:\s+(?:colour|color))?$/i.test(value.trim());
}

/** A screenshot or door-only image is not a room-scene representative. */
export function hasGenuineRoomScene(variant: StorefrontDoorVariant) {
  const url = variant.roomSceneImageUrl?.toLowerCase() || "";
  return Boolean(url) && !/(screenshot|screen[_-]?shot|door[_-]?only|door[-_]?sample)/i.test(url);
}

export function familyImageUrl(variant: StorefrontDoorVariant) {
  if (hasGenuineRoomScene(variant)) return variant.roomSceneImageUrl || variant.doorSampleImageUrl || variant.thumbnailImageUrl;
  return variant.doorSampleImageUrl || variant.thumbnailImageUrl || variant.roomSceneImageUrl;
}

function finishKey(variant: StorefrontDoorVariant) {
  return (variant.color || variant.finish || variant.woodSpecies || variant.name || variant.styleCode || "unlabeled-finish")
    .trim()
    .toLowerCase();
}

/**
 * Groups every available catalog style into one family tile. All variants are
 * retained; the default is a featured variant, then an imaged variant, then a
 * stable name order. Duplicate finish labels are retained as separate styles
 * when the catalog carries distinct style IDs.
 */
export function groupStorefrontDoorFamilies<T extends StorefrontDoorVariant>(variants: readonly T[]): StorefrontDoorFamily<T>[] {
  const groups = new Map<string, T[]>();
  for (const variant of variants) {
    const key = doorFamilyKey(variant);
    const group = groups.get(key) ?? [];
    group.push(variant);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => {
        const roomSceneDelta = Number(hasGenuineRoomScene(b)) - Number(hasGenuineRoomScene(a));
        if (roomSceneDelta !== 0) return roomSceneDelta;
        const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDelta !== 0) return featuredDelta;
        const imageDelta = Number(hasImage(b)) - Number(hasImage(a));
        if (imageDelta !== 0) return imageDelta;
        return variantName(a).localeCompare(variantName(b)) || a.styleId - b.styleId;
      });
      const selected = sorted[0];
      return {
        key,
        label: doorFamilyLabel(key, group),
        variants: sorted,
        featured: group.some((variant) => Boolean(variant.featured)),
        featuredSortOrder: Math.min(...group.map((variant) => variant.featuredSortOrder ?? 999)),
        selected,
      };
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.featuredSortOrder - b.featuredSortOrder || a.label.localeCompare(b.label));
}

export function familyFinishLabel<T extends StorefrontDoorVariant>(variant: T) {
  const finish = cleanCatalogValue(variant.finish);
  const color = cleanCatalogValue(variant.color);
  const wood = cleanCatalogValue(variant.woodSpecies);
  const name = cleanCatalogValue(variant.name);
  if (isMatching(finish) || isMatching(color)) return "Matching colour";
  if (finish && !isHex(finish) && !isMatching(finish)) return finish;
  if (color && !isHex(color) && !isMatching(color)) return color;
  if (wood && !isHex(wood) && !isMatching(wood) && !/^(solid|painted|unfinished)/i.test(wood)) return wood;
  if (name && !isHex(name)) return name;
  return "Colour name unavailable";
}

export function familyFinishKey<T extends StorefrontDoorVariant>(variant: T) {
  return `${finishKey(variant)}:${variant.styleId}`;
}
