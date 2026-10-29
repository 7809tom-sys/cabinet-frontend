import { dim, type DesignCabinet } from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** Short answers the customer can pick before auto-design. Saving does not require one. */
export const KITCHEN_USE_OPTIONS = [
  { id: "baking", label: "Lots of baking" },
  { id: "everyday-cooking", label: "Everyday cooking" },
  { id: "entertaining", label: "Entertaining" },
  { id: "coffee-beverage", label: "Coffee / beverage" },
  { id: "kids-family", label: "Kids / family" },
  { id: "minimal-cooking", label: "Minimal cooking" },
] as const;

export type KitchenUseId = (typeof KITCHEN_USE_OPTIONS)[number]["id"];

export type KitchenUsageProfile = {
  uses: KitchenUseId[];
  skipped: boolean;
  acceptedSuggestionIds?: string[];
};

export const BAKING_ZONE_MIN_IN = 36;

export function emptyKitchenUsage(): KitchenUsageProfile {
  return { uses: [], skipped: true, acceptedSuggestionIds: [] };
}

export function normalizeKitchenUsage(value: KitchenUsageProfile | null | undefined): KitchenUsageProfile {
  if (!value) return emptyKitchenUsage();
  const allowed = new Set<string>(KITCHEN_USE_OPTIONS.map((option) => option.id));
  const uses = value.uses.filter((use): use is KitchenUseId => allowed.has(use));
  return {
    uses,
    skipped: value.skipped || uses.length === 0,
    acceptedSuggestionIds: value.acceptedSuggestionIds ?? [],
  };
}

export function usageIncludes(profile: KitchenUsageProfile | null | undefined, use: KitchenUseId): boolean {
  return normalizeKitchenUsage(profile).uses.includes(use);
}

/** Everyday cooking is the owner's "cook a lot / heavy cooking" answer. */
export function cooksALot(profile: KitchenUsageProfile | null | undefined): boolean {
  return usageIncludes(profile, "everyday-cooking");
}

export function bakesALot(profile: KitchenUsageProfile | null | undefined): boolean {
  return usageIncludes(profile, "baking");
}

type CatalogLike = {
  id?: number;
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
  width?: string | number | null;
  placement?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
};

function haystack(item: CatalogLike): string {
  return `${item.masterCode ?? ""} ${item.description ?? ""} ${item.subCategory ?? ""} ${item.category ?? ""}`.toLowerCase();
}

/** A pure drawer base. Door-and-drawer bases stay ordinary bases. */
export function isDrawerBaseCatalog(item: CatalogLike): boolean {
  const hay = haystack(item);
  if (/sink|corner|blind|trash|filler|panel|wine|spice/.test(hay)) return false;
  if ((item.numberOfDoors ?? 0) > 0) return false;
  return /drawer/.test(hay) || (item.numberOfDrawers ?? 0) > 0;
}

export function isTrayDividerCatalog(item: CatalogLike): boolean {
  const code = `${item.masterCode ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hay = haystack(item);
  return /tray\s*divider|sheet\s*pan|baking\s*sheet|cutlery\s*divider/.test(hay) || /^B?T(?:RAY|D)\d/.test(code);
}

export function isMixerStorageCatalog(item: CatalogLike): boolean {
  return /mixer|appliance\s*garage|small\s*appliance|base\s*appliance/.test(haystack(item));
}

export function isTrashBaseCatalog(item: CatalogLike): boolean {
  return /trash|waste|recycl/.test(haystack(item));
}

export function isWineRackCatalog(item: CatalogLike): boolean {
  const code = `${item.masterCode ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /wine/.test(haystack(item)) || /WRC3015$/.test(code);
}

export function isCoffeeStationCatalog(item: CatalogLike): boolean {
  return /coffee|beverage|espresso|wine\s*fridge|beverage\s*center/.test(haystack(item));
}

export function isSpicePulloutCatalog(item: CatalogLike): boolean {
  const code = `${item.masterCode ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /spice/.test(haystack(item)) || /^WSC\d/.test(code) || /^B(?:9|12|15)(?:SP|PO)/.test(code);
}

export function isGlassDoorCatalog(item: CatalogLike): boolean {
  return item.placement === "wall" && /glass/.test(haystack(item));
}

export function firstCatalogMatch(catalog: readonly CatalogLike[], test: (item: CatalogLike) => boolean): CatalogLike | null {
  return catalog.find(test) ?? null;
}

type DrawerItem = {
  cabinet: CatalogLike;
  width: number;
  isFiller: boolean;
};

/** Swap the cabinet touching the range for a same-width drawer base when the line sells one. */
export function preferDrawerBasesBesideRange<T extends DrawerItem>(
  items: readonly T[],
  catalog: readonly CatalogLike[],
  rangeAtStart: boolean,
  rangeAtEnd: boolean,
): T[] {
  const swap = (item: T): T => {
    if (item.isFiller) return item;
    const drawer = catalog.find((candidate) => isDrawerBaseCatalog(candidate)
      && Math.abs(dim(candidate.width as string | null | undefined, Number(candidate.width) || 0) - item.width) <= 0.05);
    return drawer ? { ...item, cabinet: drawer } : item;
  };
  return items.map((item, index) => {
    if (rangeAtStart && index === 0) return swap(item);
    if (rangeAtEnd && index === items.length - 1) return swap(item);
    return item;
  });
}

export type UsageSuggestion = {
  id: string;
  use: KitchenUseId;
  title: string;
  description: string;
  masterCode?: string;
};

/**
 * Lightweight catalog suggestions for the uses other than the baking zone itself.
 * Baking drawer, tray, and mixer ideas are included when those SKUs exist.
 */
export function kitchenUsageSuggestions(
  profile: KitchenUsageProfile | null | undefined,
  catalog: readonly CatalogLike[],
): UsageSuggestion[] {
  const usage = normalizeKitchenUsage(profile);
  if (usage.skipped) return [];
  const suggestions: UsageSuggestion[] = [];
  const push = (use: KitchenUseId, id: string, title: string, description: string, match: CatalogLike | null) => {
    if (!usage.uses.includes(use) || !match?.masterCode) return;
    suggestions.push({ id: `usage:${id}`, use, title, description, masterCode: match.masterCode });
  };
  if (usage.uses.includes("baking")) {
    push("baking", "baking-drawer", "Drawer bases for baking tools", "A drawer base beside the baking counter keeps sheet pans and tools out of the heat above the range.", firstCatalogMatch(catalog, isDrawerBaseCatalog));
    push("baking", "baking-tray", "Tray divider in the baking zone", "The line sells a tray or sheet-pan divider. It belongs in the baking counter, not over the range.", firstCatalogMatch(catalog, isTrayDividerCatalog));
    push("baking", "baking-mixer", "Mixer storage", "A mixer or appliance-garage cabinet can sit at the end of the baking counter.", firstCatalogMatch(catalog, isMixerStorageCatalog));
  }
  push("everyday-cooking", "range-spice", "Spice pull-out beside the range", "Keep spices in a pull-out or drawer next to the range, not in the cabinet over the cooktop.", firstCatalogMatch(catalog, isSpicePulloutCatalog));
  push("entertaining", "wine-rack", "Wine rack", "Entertaining plans can use a wall wine rack such as WRC3015 when the line sells one.", firstCatalogMatch(catalog, isWineRackCatalog));
  push("coffee-beverage", "coffee-station", "Coffee or beverage station", "A beverage or coffee cabinet in this line can anchor a drink station away from the range.", firstCatalogMatch(catalog, isCoffeeStationCatalog));
  push("kids-family", "kid-drawers", "Low drawers for everyday dishes", "A drawer base in the prep zone keeps daily dishes within reach.", firstCatalogMatch(catalog, isDrawerBaseCatalog));
  if (usage.uses.includes("entertaining")) {
    push("entertaining", "glass-display", "Glass display near the hood", "Glass doors read well at the end of a run or beside the hood when the line sells them.", firstCatalogMatch(catalog, isGlassDoorCatalog));
  }
  return suggestions;
}

export type BakingZoneReport = {
  ok: boolean;
  widthIn: number;
  side: "toward-fridge" | "other" | "none";
  nearRange: boolean;
  nearFridge: boolean;
  message: string;
};

/**
 * The baking counter is uninterrupted base-cabinet frontage touching the range.
 * Fillers, appliances, and tall cabinets break it. 36 inches is the minimum.
 */
export function describeBakingZone(input: {
  range: { start: number; end: number };
  fridge: { start: number; end: number } | null;
  /** Base cabinets and fillers on the same wall, in any order. */
  pieces: readonly { start: number; end: number; kind: "base" | "filler" | "appliance" | "tall" }[];
}): BakingZoneReport {
  const measure = (direction: 1 | -1) => {
    let cursor = direction > 0 ? input.range.end : input.range.start;
    let width = 0;
    const ordered = [...input.pieces].sort((left, right) => left.start - right.start);
    const walk = direction > 0 ? ordered : [...ordered].reverse();
    for (const piece of walk) {
      const touches = direction > 0
        ? Math.abs(piece.start - cursor) <= 0.5
        : Math.abs(piece.end - cursor) <= 0.5;
      if (!touches) continue;
      if (piece.kind !== "base") break;
      width += piece.end - piece.start;
      cursor = direction > 0 ? piece.end : piece.start;
    }
    return width;
  };
  const right = measure(1);
  const left = measure(-1);
  const fridge = input.fridge;
  const towardFridge = fridge == null ? null : fridge.start >= input.range.end ? "right" as const : fridge.end <= input.range.start ? "left" as const : null;
  const towardWidth = towardFridge === "right" ? right : towardFridge === "left" ? left : 0;
  const best = Math.max(left, right);
  const minimum = kitchenRuleNumber("baking_zone_min_in");
  const ok = best >= minimum - 0.01;
  return {
    ok,
    widthIn: Math.round(best * 8) / 8,
    side: towardWidth >= minimum - 0.01 ? "toward-fridge" as const : best >= minimum - 0.01 ? "other" as const : "none" as const,
    nearRange: ok,
    nearFridge: towardWidth >= minimum - 0.01,
    message: ok
      ? `Baking counter is ${Math.round(best)}" of uninterrupted base beside the range${towardWidth >= minimum - 0.01 ? ", on the refrigerator side" : ""}.`
      : `Lots of baking needs at least ${minimum}" of uninterrupted counter beside the range. The longest clear base run touching the range is ${Math.round(best)}".`,
  };
}

export type { DesignCabinet };
