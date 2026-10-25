import { surfaceRole } from "@/lib/pelican";

// Shared contract for the Surfaces & Fixtures wizard -> Design Tool hand-off.
//
// The wizard lets a customer choose their flooring, backsplash tile, countertop,
// sink and faucet (with square-footage/box math for the area-based items) BEFORE
// they open the Design Tool. We persist that choice to localStorage so the Design
// Tool can pre-select matching materials and pre-load the chosen fixtures.

export type SurfaceRole = "flooring" | "tile" | "countertop" | "sink" | "faucet";
export type CountertopScope = "perimeter" | "island" | "all";

export interface SurfacePick {
  id: number;
  slug: string;
  name: string;
  category: string;
  /** Which wizard slot this pick fills; set by the wizard when a product is chosen. */
  role?: SurfaceRole;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  sellPrice: number | null;
  /** Countertop assignment in the Designer. Legacy undefined selections apply to the whole design. */
  countertopScope?: CountertopScope;
  /** Supplier/fabricator-verified maximum unsupported countertop overhang. */
  unsupportedOverhangLimitIn?: number | null;
  /** Area entered by the user (sq ft) for area-priced roles. */
  areaSqft?: number | null;
  /** Editable coverage assumption (sq ft per box/package). */
  sqftPerBox?: number | null;
  /** Waste factor applied on top of area (e.g. 0.1 = 10%). */
  wastePct?: number | null;
  /** Computed package/box count = ceil(area * (1+waste) / sqftPerBox). */
  boxes?: number | null;
}

type CountertopSurfaceLike = {
  id: number;
  name: string;
  category: string;
  subCategory?: string | null;
  countertopScope?: CountertopScope;
};

/**
 * A design may retain several tile or flooring products in its quote, while a
 * single 3D surface can show only one material at a time. This explicit marker
 * preserves the owner's choice without deleting the other quote lines. Legacy
 * records without the marker keep their historical last-added display order.
 */
export type ThreeDActiveSurfaceLike = {
  id: number;
  threeDActive?: boolean;
};

export function activeThreeDSurface<T extends ThreeDActiveSurfaceLike>(surfaces: readonly T[]): T | null {
  return [...surfaces].reverse().find((surface) => surface.threeDActive === true)
    ?? surfaces.at(-1)
    ?? null;
}

/** Marks one already-selected product as the material rendered for its 3D role. */
export function setActiveThreeDSurface<T extends ThreeDActiveSurfaceLike>(surfaces: readonly T[], id: number): T[] {
  return surfaces.map((surface) => ({ ...surface, threeDActive: surface.id === id }));
}

type FinalMaterialSurfaceLike = ThreeDActiveSurfaceLike & {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
};

/**
 * A final kitchen has one installed flooring product and one installed backsplash
 * product. Replacing either must remove the prior material from the saved design,
 * cart, materials list, and 3D scene—not merely change a display marker. Distinct
 * perimeter and island countertop assignments intentionally remain independent.
 *
 * For legacy saved designs, an explicit 3D backsplash choice wins; otherwise the
 * most recently selected material is the final installed selection.
 */
export function normalizeFinalMaterialSelections<T extends FinalMaterialSurfaceLike>(surfaces: readonly T[]): T[] {
  const activeFloor = [...surfaces].reverse().find((surface) => surfaceRole(surface) === "flooring") ?? null;
  const activeBacksplash = activeThreeDSurface(surfaces.filter((surface) => surfaceRole(surface) === "backsplash"));

  return surfaces.flatMap((surface) => {
    const role = surfaceRole(surface);
    if (role === "flooring" && surface.id !== activeFloor?.id) return [];
    if (role === "backsplash") {
      if (surface.id !== activeBacksplash?.id) return [];
      return [{ ...surface, threeDActive: true } as T];
    }
    return [surface];
  });
}

/**
 * Refresh saved Design Tool surface selections from the verified Designer query.
 * Records omitted by that query are no longer active/published/priceable, so their
 * old saved amount must be cleared rather than reaching a new material list or cart.
 */
export type VerifiedSurfaceSelectionRecord = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  materialImageUrl?: string | null;
  coverageSqFt?: string | number | null;
  sellPrice: number | null;
};

type RefreshableSurfaceSelection = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  materialImageUrl?: string | null;
  coverageSqFt?: number | null;
  sellPrice: number | null;
};

export function refreshVerifiedSurfaceSelections<T extends RefreshableSurfaceSelection>(
  selections: readonly T[],
  verifiedRecords: readonly VerifiedSurfaceSelectionRecord[],
): T[] {
  const verifiedById = new Map(verifiedRecords.map((record) => [record.id, record]));
  return selections.map((selection) => {
    const record = verifiedById.get(selection.id);
    // The server only returns active, Designer-available items with a positive
    // authorized price base. Preserve the design selection as evidence, but remove
    // its stale sell price and 3D swatch when it no longer passes that gate.
    if (!record) {
      if (selection.sellPrice == null && (selection.materialImageUrl ?? null) == null) return selection;
      return { ...selection, sellPrice: null, materialImageUrl: null } as T;
    }
    const coverage = Number(record.coverageSqFt);
    const next = {
      ...selection,
      pelicanCode: record.pelicanCode ?? null,
      name: record.name,
      category: record.category,
      subCategory: record.subCategory ?? null,
      size: record.size ?? null,
      materialImageUrl: record.materialImageUrl?.trim() || null,
      coverageSqFt: Number.isFinite(coverage) && coverage > 0 ? coverage : null,
      sellPrice: record.sellPrice,
    } as T;
    if (
      next.pelicanCode === (selection.pelicanCode ?? null) &&
      next.name === selection.name &&
      next.category === selection.category &&
      next.subCategory === (selection.subCategory ?? null) &&
      next.size === (selection.size ?? null) &&
      next.materialImageUrl === (selection.materialImageUrl ?? null) &&
      next.coverageSqFt === (selection.coverageSqFt ?? null) &&
      next.sellPrice === selection.sellPrice
    ) return selection;
    return next;
  });
}

export function isCountertopSurfacePick(surface: Pick<CountertopSurfaceLike, "category" | "subCategory" | "name">): boolean {
  const text = `${surface.category} ${surface.subCategory ?? ""} ${surface.name}`.toLowerCase();
  return text.includes("countertop") || text.includes("quartz slab");
}

/** Legacy unscoped countertop picks remain whole-design selections until a separate island material is chosen. */
export function activeCountertopForScope<T extends CountertopSurfaceLike>(
  surfaces: readonly T[],
  scope: "perimeter" | "island",
): T | null {
  const countertops = surfaces.filter(isCountertopSurfacePick);
  if (scope === "perimeter") {
    return [...countertops].reverse().find((surface) => surface.countertopScope !== "island") ?? null;
  }
  return [...countertops].reverse().find((surface) => surface.countertopScope === "island" || surface.countertopScope === "all")
    ?? activeCountertopForScope(surfaces, "perimeter");
}

/** Assign exactly one product to a countertop scope while preserving the other scope's independent choice. */
export function setCountertopSurfaceForScope<T extends CountertopSurfaceLike>(
  surfaces: readonly T[],
  item: T,
  scope: "perimeter" | "island",
): T[] {
  const nonCountertops = surfaces.filter((surface) => !isCountertopSurfacePick(surface));
  const countertops = surfaces.filter(isCountertopSurfacePick);
	if (scope === "perimeter") {
	  const explicitIsland = [...countertops].reverse().find((surface) => surface.countertopScope === "island") ?? null;
	  if (!explicitIsland || explicitIsland.id === item.id) {
	    return [...nonCountertops, { ...item, countertopScope: "all" }];
	  }
	  return [...nonCountertops, { ...explicitIsland, countertopScope: "island" } as T, { ...item, countertopScope: "perimeter" }];
  }
	const perimeter = activeCountertopForScope(countertops, "perimeter");
	if (perimeter?.id === item.id) {
	  return [...nonCountertops, { ...item, countertopScope: "all" }];
	}
	const preservedPerimeter = perimeter ? [{ ...perimeter, countertopScope: "perimeter" } as T] : [];
	return [...nonCountertops, ...preservedPerimeter, { ...item, countertopScope: "island" }];
}

/** Remove an explicit assignment while retaining the other scope and allowing the island to inherit the perimeter. */
export function clearCountertopSurfaceScope<T extends CountertopSurfaceLike>(
  surfaces: readonly T[],
  scope: "perimeter" | "island",
): T[] {
  return surfaces.flatMap((surface) => {
    if (!isCountertopSurfacePick(surface)) return [surface];
    if (surface.countertopScope === "all") {
      return [{ ...surface, countertopScope: scope === "island" ? "perimeter" : "island" }];
    }
    if (scope === "island" && surface.countertopScope === "island") return [];
    if (scope === "perimeter" && surface.countertopScope !== "island") return [];
    return [surface];
  });
}

export interface SurfaceSelection {
  v: 1;
  savedAt: number;
  picks: Partial<Record<SurfaceRole, SurfacePick>>;
  layout: "l-shape" | "u-shape" | "galley" | "island" | "straight";
  /** Optional last generated preview image URL. */
  previewUrl?: string | null;
}

// A distinct localStorage key used ONLY as the explicit hand-off signal to the
// Design Tool. The wizard writes this key exclusively when the customer clicks
// "I'm ready to design my kitchen" — never automatically. The Design Tool
// consumes it once (and clears it) so opening /design on its own never pulls in
// stale wizard picks. The saved *profile* (persisted server-side + under
// SURFACE_SELECTION_KEY) is separate and is NOT auto-applied.
export const SURFACE_HANDOFF_KEY = "cd_surface_handoff";

export function requestSurfaceHandoff(sel: SurfaceSelection): void {
  try {
    localStorage.setItem(SURFACE_HANDOFF_KEY, JSON.stringify(sel));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function takeSurfaceHandoff(): SurfaceSelection | null {
  try {
    const raw = localStorage.getItem(SURFACE_HANDOFF_KEY);
    if (!raw) return null;
    localStorage.removeItem(SURFACE_HANDOFF_KEY); // consume once
    const obj = JSON.parse(raw);
    if (obj && obj.v === 1 && obj.picks) return obj as SurfaceSelection;
  } catch {
    /* corrupt — ignore */
  }
  return null;
}

export const SURFACE_SELECTION_KEY = "cd_surface_selection";

export const DEFAULT_SQFT_PER_BOX: Record<SurfaceRole, number> = {
  flooring: 20,
  tile: 10,
  countertop: 0,
  sink: 0,
  faucet: 0,
};

export const DEFAULT_WASTE_PCT = 0.1;

export function computeBoxes(
  areaSqft: number | null | undefined,
  sqftPerBox: number | null | undefined,
  wastePct: number | null | undefined
): number | null {
  if (!areaSqft || areaSqft <= 0) return null;
  const per = sqftPerBox && sqftPerBox > 0 ? sqftPerBox : 1;
  const waste = wastePct != null && wastePct >= 0 ? wastePct : 0;
  return Math.ceil((areaSqft * (1 + waste)) / per);
}

export function saveSurfaceSelection(sel: SurfaceSelection): void {
  try {
    localStorage.setItem(SURFACE_SELECTION_KEY, JSON.stringify(sel));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadSurfaceSelection(): SurfaceSelection | null {
  try {
    const raw = localStorage.getItem(SURFACE_SELECTION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.v === 1 && obj.picks) return obj as SurfaceSelection;
  } catch {
    /* corrupt — ignore */
  }
  return null;
}

export function clearSurfaceSelection(): void {
  try {
    localStorage.removeItem(SURFACE_SELECTION_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Map a Pelican pick onto the Design Tool's built-in material palettes ─────
// The Design Tool renders plan/elevation views from a small curated palette of
// material ids (see client/src/lib/design.ts). We can't render an arbitrary
// product photo into that 2D engine, so we pick the closest palette entry by
// keyword. The exact product (name/price/photo) is still carried in the saved
// selection and surfaced in the design's Surfaces & Fixtures panel.

export function guessFlooringMaterialId(pick: SurfacePick | undefined): string | null {
  if (!pick) return null;
  const s = `${pick.name} ${pick.subCategory ?? ""}`.toLowerCase();
  if (/(walnut|espresso|dark)/.test(s)) return "walnut-hardwood";
  if (/(white oak|natural oak|light)/.test(s)) return "white-oak";
  if (/(oak|hickory|maple|wood|hardwood)/.test(s)) return "oak-hardwood";
  if (/(vinyl|lvp|lvt|spc|plank)/.test(s)) return "luxury-vinyl";
  if (/(herringbone)/.test(s)) return "herringbone-tile";
  if (/(chevron)/.test(s)) return "chevron-wood";
  if (/(black|slate|charcoal)/.test(s)) return "black-tile";
  if (/(gray|grey|porcelain)/.test(s)) return "gray-tile";
  if (/(concrete)/.test(s)) return "concrete";
  if (/(tile|ceramic|marble)/.test(s)) return "white-tile";
  return "luxury-vinyl";
}

export function guessBacksplashMaterialId(pick: SurfacePick | undefined): string | null {
  if (!pick) return null;
  const s = `${pick.name} ${pick.subCategory ?? ""}`.toLowerCase();
  if (/(hex)/.test(s)) return /(marble)/.test(s) ? "marble-hex" : "white-hex";
  if (/(mosaic)/.test(s)) return "black-mosaic";
  if (/(zellige|blue)/.test(s)) return "blue-zellige";
  if (/(terracotta|clay)/.test(s)) return "terracotta";
  if (/(herringbone)/.test(s)) return "herringbone-wood";
  if (/(gray|grey)/.test(s)) return "gray-subway";
  if (/(large|slab|panel)/.test(s)) return "white-large";
  if (/(subway|brick|tile|marble|ceramic|porcelain)/.test(s)) return "white-subway";
  return "white-subway";
}

export function guessCountertopMaterialId(pick: SurfacePick | undefined): string | null {
  if (!pick) return null;
  const s = `${pick.name} ${pick.subCategory ?? ""}`.toLowerCase();
  if (/(calacatta|carrara|marble)/.test(s)) return "carrara-marble";
  if (/(black|nero|charcoal|midnight)/.test(s)) return "black-granite";
  if (/(sand|beige|cream|tan|gold|oro)/.test(s)) return "sand-quartz";
  if (/(concrete|gray|grey)/.test(s)) return "concrete-gray";
  if (/(butcher|wood|oak|walnut)/.test(s)) return "butcher-block";
  return "white-quartz";
}
