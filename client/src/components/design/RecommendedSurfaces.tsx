import { useMemo } from "react";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import { flooringCartonFacts } from "@/lib/flooringCartonFacts";
import { pelicanSinkCatalogDescription, pelicanSinkCatalogName } from "@/lib/pelicanSinkCatalogDescriptions";
import {
  concatCatalogPages,
  isSelectableDesignerFlooringPlank,
  readDesignerRenderFlags,
} from "@/lib/designerTileMosaicCatalog";
import { floorCapableMosaics } from "@/lib/mosaicFloorTile";
import { surfaceRole } from "@/lib/pelican";
import { trpc } from "@/lib/trpc";
import type { SelectedSurface } from "./SurfacesPickerDialog";

/**
 * A recommended-surface "role" the Design Tool exposes as its own palette
 * section. Each maps to a real Pelican storefront category (and subCategory
 * where a category is shared, e.g. Sinks & Faucets). Kept in sync with the
 * server-side `surfaces.recommended` roleFilter.
 */
export type RecommendedRole =
  | "flooring"
  | "backsplash"
  | "countertop"
  | "sink"
  | "faucet"
  | "bathroom-sink"
  | "bathroom-faucet"
  | "toilet-bidet"
  | "bathtub"
  | "shower-door"
  | "shower-surround"
  | "shower-system"
  | "bathroom-accessory"
  // Shower designer. Pans are the shower floor, tiles are the wall/floor finish
  // reusing the existing Pelican mosaic rows, and niches/trays are wall fittings.
  | "shower-pan"
  | "shower-tile"
  | "shower-niche";

export const RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
}[] = [
  { role: "flooring", label: "Flooring" },
  { role: "backsplash", label: "Backsplash" },
  { role: "countertop", label: "Countertop" },
  { role: "sink", label: "Sink" },
  { role: "faucet", label: "Faucet" },
];

/**
 * Bathroom finishes are deliberately separate from bathroom fixtures. A bathroom
 * plan can therefore choose its counter, floor and wall tile without putting a
 * toilet or faucet in the "Surfaces" tab.
 */
export const BATHROOM_SURFACE_RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
}[] = [
  { role: "countertop", label: "Countertops" },
  { role: "flooring", label: "Flooring" },
  { role: "backsplash", label: "Wall Tile" },
];

/** Bathroom fixtures intentionally never share kitchen sink or faucet roles. */
export const BATHROOM_FIXTURE_RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
}[] = [
  { role: "bathroom-sink", label: "Vanity Sinks" },
  { role: "bathroom-faucet", label: "Vanity & Tub Faucets" },
  { role: "toilet-bidet", label: "Toilets & Bidets" },
  { role: "bathtub", label: "Bathtubs" },
  { role: "shower-pan", label: "Shower Pans (floors)" },
  { role: "shower-surround", label: "Shower Panels & Surrounds" },
  { role: "shower-tile", label: "Shower Tile" },
  { role: "shower-system", label: "Shower Heads & Faucets" },
  { role: "shower-door", label: "Glass Doors" },
  { role: "shower-niche", label: "Niches & Soap Trays" },
  // Accessories are their own group. The old role filter was putting towel bars
  // and accessory sets on the Bathtubs tab; they belong here, and only here.
  { role: "bathroom-accessory", label: "Other Bathroom Accessories" },
];

/** Backward-compatible alias for callers that previously requested all bathroom cards. */
export const BATHROOM_RECOMMENDED_SECTIONS = BATHROOM_FIXTURE_RECOMMENDED_SECTIONS;

export type BathroomPaletteMode = "surfaces" | "fixtures";

/** Roles whose choice already replaces the previous one (one countertop, one floor, one backsplash). */
const REPLACING_ROLES: ReadonlySet<RecommendedRole> = new Set<RecommendedRole>(["countertop", "flooring", "backsplash"]);
type RecItem = {
  id: number;
  pelicanCode?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
  subCategory: string | null;
  size: string | null;
  imageUrl: string | null;
  materialImageUrl: string | null;
  sellPrice: number | null;
  coverageSqFt?: number | string | null;
  piecesPerBox?: number | string | null;
  showInDesigner?: boolean | null;
  isActive?: boolean | null;
  designerRenderReady?: boolean | null;
  hasSwatch?: boolean | null;
  usableAsFloor?: boolean | number | null;
};

function toSurface(p: RecItem, installedAs?: "flooring"): SelectedSurface {
  const facts = flooringCartonFacts(p);
  return {
    id: p.id,
    pelicanCode: p.pelicanCode ?? null,
    slug: p.slug,
    name: pelicanSinkCatalogName(p.pelicanCode) ?? p.name,
    category: p.category,
    subCategory: p.subCategory,
    size: p.size,
    imageUrl: p.imageUrl,
    materialImageUrl: p.materialImageUrl,
    description: pelicanSinkCatalogDescription(p.pelicanCode) ?? p.description ?? null,
    sellPrice: p.sellPrice,
    coverageSqFt: facts?.sqFtPerBox ?? null,
    piecesPerBox: facts?.piecesPerBox ?? null,
    ...readDesignerRenderFlags(p),
    ...(installedAs ? { installedAs } : {}),
  };
}

/** One role's recommended row: a short, curated grid of real Pelican products. */
/**
 * One category in the Fixtures / Surfaces sidebar.
 *
 * The sidebar is a list of destinations, not an accordion: a category never
 * expands inline, it opens the Bathroom Fixtures popup on that category's tab.
 * The popup is the single place to browse and pick.
 *
 * Each row is compact: the name and its count share one line, and the name wraps
 * rather than truncating, so a long family ("Shower Panels & Surrounds") reads in
 * full instead of collapsing to "Shower & Tub Do…". There is no chevron and no
 * second browse affordance — the row itself is the link.
 */
function RecommendedCategoryRow({
  role,
  label,
  count,
  loading,
  selectedCount,
  onOpenCategory,
}: {
  role: RecommendedRole;
  label: string;
  count: number | null;
  loading: boolean;
  selectedCount: number;
  onOpenCategory: (role: RecommendedRole) => void;
}) {
  const countLabel = loading ? "…" : count == null ? null : String(count);
  return (
    <button
      type="button"
      data-testid={`recommended-category-${role}`}
      data-category-role={role}
      title={label}
      onClick={() => onOpenCategory(role)}
      className="block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-sm leading-snug text-foreground transition-colors hover:border-[#a87f33]/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744]"
    >
      {/* One line: name then count. `break-words` lets a long name wrap onto a
          second line instead of being cut off. */}
      <span className="font-semibold break-words">{label}</span>
      {countLabel !== null && <span className="ml-1 font-normal text-muted-foreground">({countLabel})</span>}
      {selectedCount > 0 && (
        <span className="ml-1 text-[11px] font-normal text-[#a87f33]">· {selectedCount} selected</span>
      )}
    </button>
  );
}

/** How many products this category currently offers, for the sidebar count. */
function useCategoryCount(role: RecommendedRole, affiliateSlug: string | null | undefined) {
  // Flooring reads its own full palette; every other family reads one role.
  // `trpc.surfaces` resolves to the generated client's error branch under this
  // repo's current typing, so the calls are made through a typed alias rather
  // than adding a second copy of that known noise.
  // Same call shape the sections already use; kept in one helper so a category
  // row can show its own count without threading a query down from the parent.
  const surfaces = (trpc as any).surfaces;
  const flooring = surfaces.recommended.useQuery(
    { role: "flooring", limit: 500, affiliateSlug: affiliateSlug ?? undefined },
    { enabled: role === "flooring" },
  );
  const recommended = surfaces.recommended.useQuery(
    { role, limit: 200, affiliateSlug: affiliateSlug ?? undefined },
    { enabled: role !== "flooring" },
  );
  // Flooring's count has to include the mosaics that are explicitly usable as
  // floor tile, exactly as the old inline grid did; otherwise the row reports a
  // smaller family than the popup opens.
  const mosaicCatalog = (trpc as any).pelican.byCategory.useQuery(
    { category: "Tile & Mosaic", scope: "catalog", affiliateSlug: affiliateSlug ?? undefined, limit: 200, offset: 0 },
    { enabled: role === "flooring" },
  );
  const mosaicPage2 = (trpc as any).pelican.byCategory.useQuery(
    { category: "Tile & Mosaic", scope: "catalog", affiliateSlug: affiliateSlug ?? undefined, limit: 200, offset: 200 },
    { enabled: role === "flooring" && (mosaicCatalog.data?.total ?? 0) > 200 },
  );
  if (role !== "flooring") {
    return {
      count: recommended.data ? groupPelicanConfigurations(recommended.data as RecItem[]).length : null,
      loading: recommended.isLoading,
    };
  }
  const rows = [
    ...((flooring.data ?? []) as RecItem[]).filter((item) => isSelectableDesignerFlooringPlank(item)),
    ...floorCapableMosaics(concatCatalogPages<RecItem>([
      mosaicCatalog.data?.items as RecItem[] | undefined,
      mosaicPage2.data?.items as RecItem[] | undefined,
    ])),
  ];
  return {
    count: flooring.data ? groupPelicanConfigurations(rows).length : null,
    loading: flooring.isLoading || mosaicCatalog.isLoading,
  };
}

/**
 * The Design Tool's "Surfaces" palette panel: recommended real Pelican products
 * for flooring, backsplash, countertop, sink and faucet, each as its own
 * section. Tapping a card adds/removes it from the design's selected surfaces
 * (which flow to the cart and satisfy the 3D View readiness gate). A "Browse
 * all" link opens the full Surfaces & Fixtures catalog dialog.
 */
export function RecommendedSurfaces({
  selected,
  onToggle,
  onBrowseAll,
  roomType = "kitchen",
  limit = 8,
  onPlaceBathroomFixture,
  bathroomPaletteMode = "surfaces",
  affiliateSlug,
  categoryCounts,
}: {
  selected: SelectedSurface[];
  onToggle: (item: SelectedSurface, role: RecommendedRole) => void;
  /** Opens the catalog popup on this category's tab. The sidebar never expands. */
  onBrowseAll: (role: RecommendedRole) => void;
  roomType?: string;
  limit?: number;
  /** Clicking a source-measured toilet, bidet, or tub places it into the active bathroom plan. */
  onPlaceBathroomFixture?: (item: SelectedSurface) => void;
  /** Keeps bathroom finishes in Surfaces and products in the dedicated Fixtures tab. */
  bathroomPaletteMode?: BathroomPaletteMode;
  affiliateSlug?: string | null;
  /** Pre-resolved counts for a capture harness; production leaves this unset. */
  categoryCounts?: Partial<Record<RecommendedRole, number>>;
}) {
  const selectedByRole = useMemo(() => {
    const counts = new Map<RecommendedRole, number>();
    for (const item of selected) {
      const role = surfaceRole(item) as RecommendedRole;
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return counts;
  }, [selected]);
  const isBathroom = roomType === "bathroom";
  const sections = isBathroom
    ? bathroomPaletteMode === "fixtures"
      ? BATHROOM_FIXTURE_RECOMMENDED_SECTIONS
      : BATHROOM_SURFACE_RECOMMENDED_SECTIONS
    : RECOMMENDED_SECTIONS;

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        {isBathroom
          ? bathroomPaletteMode === "fixtures"
            ? "Pick a category to open the Bathroom Fixtures catalog. Every fixture is browsed and chosen there, so nothing expands in this list."
            : "Pick a category to open the Bathroom Surfaces catalog. Every surface is browsed and chosen there."
          : "Pick a category to open the catalog. Everything is browsed and chosen there."}
      </p>
      {sections.map((s) => (
        <CategoryRow
          key={s.role}
          role={s.role}
          label={s.label}
          selectedCount={selectedByRole.get(s.role) ?? 0}
          onBrowseAll={onBrowseAll}
          affiliateSlug={affiliateSlug}
          injectedCount={categoryCounts?.[s.role]}
        />
      ))}
      {limit < 0 && null}
    </div>
  );
}

/** A row that resolves its own count, so the sidebar never fetches for categories it does not show. */
function CategoryRow({
  role,
  label,
  selectedCount,
  onBrowseAll,
  affiliateSlug,
  injectedCount,
}: {
  role: RecommendedRole;
  label: string;
  selectedCount: number;
  onBrowseAll: (role: RecommendedRole) => void;
  affiliateSlug: string | null | undefined;
  /** Pre-resolved count. Only a capture harness passes this; production reads tRPC. */
  injectedCount?: number | null;
}) {
  const live = useCategoryCount(role, affiliateSlug);
  const count = injectedCount ?? live.count;
  const loading = live.loading;
  return (
    <RecommendedCategoryRow
      role={role}
      label={label}
      count={count}
      loading={loading}
      selectedCount={selectedCount}
      onOpenCategory={onBrowseAll}
    />
  );
}

