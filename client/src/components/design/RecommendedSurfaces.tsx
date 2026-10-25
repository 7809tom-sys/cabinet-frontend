import { useCallback, useMemo, useState } from "react";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import { PelicanConfigurationCard } from "./PelicanConfigurationCard";
import { verifiedPelicanBathroomFixtureProfile, pelicanBathroomFixturePlacementText } from "@/lib/pelicanBathroomFixtureProfiles";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  | "bathroom-accessory";

export const RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
  blurb: string;
}[] = [
  { role: "flooring", label: "Flooring", blurb: "Pelican planks & flooring" },
  { role: "backsplash", label: "Backsplash", blurb: "Pelican tile & mosaic" },
  { role: "countertop", label: "Countertop", blurb: "Pelican quartz slabs" },
  { role: "sink", label: "Sink", blurb: "StoneCreek sinks" },
  { role: "faucet", label: "Faucet", blurb: "StoneCreek faucets" },
];

/**
 * Bathroom finishes are deliberately separate from bathroom fixtures. A bathroom
 * plan can therefore choose its counter, floor and wall tile without putting a
 * toilet or faucet in the "Surfaces" tab.
 */
export const BATHROOM_SURFACE_RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
  blurb: string;
}[] = [
  { role: "countertop", label: "Countertops", blurb: "Pelican quartz vanity & counter surfaces" },
  { role: "flooring", label: "Flooring", blurb: "Pelican flooring for the bathroom floor" },
  { role: "backsplash", label: "Wall Tile", blurb: "Pelican wall tile & mosaic" },
];

/** Bathroom fixtures intentionally never share kitchen sink or faucet roles. */
export const BATHROOM_FIXTURE_RECOMMENDED_SECTIONS: {
  role: RecommendedRole;
  label: string;
  blurb: string;
}[] = [
  { role: "bathroom-sink", label: "Vanity Sinks", blurb: "Pelican bath basins & vanity tops" },
  { role: "bathroom-faucet", label: "Vanity & Tub Faucets", blurb: "Pelican bathroom faucet lines" },
  { role: "toilet-bidet", label: "Toilets & Bidets", blurb: "Pelican toilet and bidet fixtures" },
  { role: "bathtub", label: "Bathtubs", blurb: "Pelican acrylic soaking & skirted tubs" },
  { role: "shower-door", label: "Shower & Tub Doors", blurb: "Pelican enclosure doors" },
  { role: "shower-surround", label: "Shower Walls", blurb: "Pelican shower wall systems" },
  { role: "shower-system", label: "Shower Systems", blurb: "Pelican valves & systems" },
  { role: "bathroom-accessory", label: "Other Bathroom Accessories", blurb: "Pelican bath & shower accessory lines" },
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
};

function toSurface(p: RecItem): SelectedSurface {
  return {
    id: p.id,
    pelicanCode: p.pelicanCode ?? null,
    slug: p.slug,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    size: p.size,
    imageUrl: p.imageUrl,
    materialImageUrl: p.materialImageUrl,
    sellPrice: p.sellPrice,
  };
}

/** One role's recommended row: a short, curated grid of real Pelican products. */
function RecommendedRow({
  role,
  label,
  blurb,
  limit,
  open,
  onOpenChange,
  selectedIds,
  onToggle,
  onBrowseAll,
  onPlaceBathroomFixture,
}: {
  role: RecommendedRole;
  label: string;
  blurb: string;
  limit: number;
  open: boolean;
  onOpenChange: () => void;
  selectedIds: Set<number>;
  onToggle: (item: SelectedSurface, role: RecommendedRole) => void;
  onBrowseAll: (role: RecommendedRole) => void;
  onPlaceBathroomFixture?: (item: SelectedSurface) => void;
}) {
  // Pelican sells every finish, gauge, slab size and drain side as its own SKU.
  // Request the whole role (the server caps it at 200), fold the SKUs into one
  // card per model, and show the first `limit` models: the same one-card,
  // choose-a-finish pattern as the cabinet hardware picker.
  const { data, isLoading } = trpc.surfaces.recommended.useQuery({ role, limit: 200 });
  const configurations = useMemo(() => groupPelicanConfigurations((data ?? []) as RecItem[]), [data]);
  const visible = configurations.slice(0, limit);
  const useVariant = (variantItem: RecItem, configuration: (typeof configurations)[number]) => {
    const item = toSurface(variantItem);
    const tubFiller = role === "bathroom-faucet" && verifiedPelicanBathroomFixtureProfile(item.pelicanCode)?.kind === "floor-tub-filler";
    if ((role === "toilet-bidet" || role === "bathtub" || tubFiller) && onPlaceBathroomFixture) {
      onPlaceBathroomFixture(item);
      return;
    }
    // Choosing another finish of a model that is already in the design swaps it
    // instead of adding a second copy of the same product to the quote.
    if (!REPLACING_ROLES.has(role)) {
      for (const sibling of configuration.variants) {
        if (sibling.item.id !== item.id && selectedIds.has(sibling.item.id)) onToggle(toSurface(sibling.item as RecItem), role);
      }
    }
    onToggle(item, role);
  };
  return (
    <div className="space-y-1.5">
      <div className="sticky top-0 z-10 -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 border-b border-border bg-background/95 px-1 py-1 backdrop-blur">
        <button
          type="button"
          data-testid={`recommended-section-toggle-${role}`}
          aria-expanded={open}
          aria-controls={`recommended-section-${role}`}
          onClick={onOpenChange}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744]"
        >
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="truncate text-[10px] font-normal normal-case text-muted-foreground/70">· {blurb}</span>
          {!isLoading && <span className="ml-auto shrink-0 text-[10px] font-normal normal-case text-muted-foreground">({configurations.length})</span>}
        </button>
        <button
          type="button"
          onClick={() => onBrowseAll(role)}
          className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-[#a87f33] hover:text-[#8a6828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] transition-colors"
        >
          Browse all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {open && <div id={`recommended-section-${role}`}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <button
            type="button"
            onClick={() => onBrowseAll(role)}
            className="w-full rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground hover:border-[#a87f33]/50 hover:text-foreground transition-colors"
          >
            No recommendations available — browse the full catalog
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map((configuration) => {
              const first = configuration.variants[0]!.item;
              const tubFiller = role === "bathroom-faucet" && verifiedPelicanBathroomFixtureProfile(first.pelicanCode)?.kind === "floor-tub-filler";
              const placeable = role === "toilet-bidet" || role === "bathtub" || tubFiller;
              return (
                <PelicanConfigurationCard
                  key={configuration.key}
                  configuration={configuration}
                  selectedIds={selectedIds}
                  onUse={useVariant}
                  actionLabel={placeable && onPlaceBathroomFixture ? "Place in 3D" : undefined}
                  note={tubFiller ? <p className="text-[10px] font-medium leading-snug text-emerald-700">Floor-mounted · place in 3D</p> : undefined}
                  testIdPrefix={`recommended-${role}`}
                />
              );
            })}
          </div>
        )}
      </div>}
    </div>
  );
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
}: {
  selected: SelectedSurface[];
  onToggle: (item: SelectedSurface, role: RecommendedRole) => void;
  onBrowseAll: (role: RecommendedRole) => void;
  roomType?: string;
  limit?: number;
  /** Clicking a source-measured toilet, bidet, or tub places it into the active bathroom plan. */
  onPlaceBathroomFixture?: (item: SelectedSurface) => void;
  /** Keeps bathroom finishes in Surfaces and products in the dedicated Fixtures tab. */
  bathroomPaletteMode?: BathroomPaletteMode;
}) {
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const [openRoles, setOpenRoles] = useState<Set<RecommendedRole>>(() => new Set());
  const toggleRole = useCallback((role: RecommendedRole) => {
    setOpenRoles((current) => {
      const next = new Set(current);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);
  const isBathroom = roomType === "bathroom";
  const sections = isBathroom
    ? bathroomPaletteMode === "fixtures"
      ? BATHROOM_FIXTURE_RECOMMENDED_SECTIONS
      : BATHROOM_SURFACE_RECOMMENDED_SECTIONS
    : RECOMMENDED_SECTIONS;

  return (
    <div className="space-y-4">
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        {isBathroom
          ? bathroomPaletteMode === "fixtures"
            ? "Pelican bathroom fixtures only. Tap a source-measured toilet, bidet, or tub to place it in Floor Plan and 3D; vanity basins and faucets install through a compatible vanity base."
            : "Pelican bathroom surfaces only. Choose countertop, flooring, or wall tile; bathroom fixtures are in the Fixtures tab."
          : "Recommended Pelican surfaces & fixtures. Tap to add to your design — they appear in your quote and unlock the 3D View. Tap again to remove."}
      </p>
      {sections.map((s) => (
        <RecommendedRow
          key={s.role}
          role={s.role}
          label={s.label}
          blurb={s.blurb}
          limit={limit}
          open={openRoles.has(s.role)}
          onOpenChange={() => toggleRole(s.role)}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onBrowseAll={onBrowseAll}
          onPlaceBathroomFixture={onPlaceBathroomFixture}
        />
      ))}
    </div>
  );
}
