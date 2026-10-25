/**
 * PelicanCountertopPicker & PelicanSinkPicker
 *
 * Compact product grids that fetch real Pelican products via tRPC and let the
 * user select one. Replaces the old generic COUNTERTOP_MATERIALS dropdown and
 * SINK_PRESETS buttons in the Design Tool's right panel.
 *
 * Every picker shows ONE card per model, the same way the cabinet hardware
 * picker does: photo, collection line, a clean title and a dropdown for the
 * finish / gauge / slab / drain side. Each dropdown entry is an exact catalog
 * SKU, and the callbacks below still receive that original row, so compatibility
 * gates, fixture profiles and pricing are unchanged.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { verifiedPelicanSinkProfile } from "@/lib/pelicanFixtureProfiles";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Waves } from "lucide-react";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import type { SelectedSurface } from "./SurfacesPickerDialog";
import { PelicanConfigurationCard } from "./PelicanConfigurationCard";

export type RecItem = {
  id: number;
  pelicanCode?: string | null;
  slug: string;
  name: string;
  /** Source description; used only to title a grouped card cleanly. */
  description?: string | null;
  category: string;
  subCategory: string | null;
  size: string | null;
  imageUrl: string | null;
  sellPrice: number | null;
  unsupportedOverhangLimitIn?: number | null;
};

const NO_SELECTION: ReadonlySet<number> = new Set<number>();

function toSurface(p: RecItem): SelectedSurface {
  return {
    id: p.id,
    pelicanCode: p.pelicanCode,
    slug: p.slug,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    size: p.size,
    imageUrl: p.imageUrl,
    sellPrice: p.sellPrice,
    unsupportedOverhangLimitIn: p.unsupportedOverhangLimitIn ?? null,
  };
}

/** Keeps farmhouse/apron-front sink choices isolated from ordinary sink bases.
 * Only source-verified physical profiles are eligible for the Designer guide.
 */
export function compatibleFarmhouseSinkOptions(products: RecItem[], openingWidthIn: number): RecItem[] {
  return products.filter((product) => {
    const profile = verifiedPelicanSinkProfile(product.pelicanCode);
    return Boolean(
      profile
      && profile.sinkType === "farmhouse"
      && profile.minimumCabinetWidthIn <= openingWidthIn,
    );
  });
}

export function FarmhouseSinkSelectionGuide({
  baseCode,
  openingWidthIn,
  products,
  isLoading,
  onSelect,
  onBrowseAll,
}: {
  baseCode: string;
  openingWidthIn: number;
  products: RecItem[];
  isLoading: boolean;
  onSelect: (item: SelectedSurface) => void;
  onBrowseAll: () => void;
}) {
  // Compatibility is decided per exact SKU first; only then are the surviving
  // SKUs folded into one card per sink model.
  const configurations = useMemo(
    () => groupPelicanConfigurations(compatibleFarmhouseSinkOptions(products, openingWidthIn)).slice(0, 6),
    [products, openingWidthIn],
  );

  return (
    <section data-testid="farmhouse-sink-selection-guide" className="mt-4 overflow-hidden rounded-lg border border-[#8fb7d7] bg-[#f4f9fd]">
      <div className="border-b border-[#c8deef] px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Waves className="mt-0.5 h-4 w-4 shrink-0 text-[#276b9b]" />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[#173a56]">Sink Selection Guide</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-[#355f7b]">
              {baseCode} is a farmhouse / apron-front sink base. Only source-verified apron-front sinks that fit this {openingWidthIn}&quot; base opening can be selected.
            </p>
          </div>
        </div>
      </div>
      <div className="p-2.5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : configurations.length > 0 ? (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#4a718a]">Compatible verified farmhouse sinks</p>
            <div className="grid grid-cols-2 gap-2">
              {configurations.map((configuration) => (
                <PelicanConfigurationCard
                  key={configuration.key}
                  configuration={configuration}
                  selectedIds={NO_SELECTION}
                  onUse={(item) => onSelect(toSurface(item))}
                  testIdPrefix="farmhouse-sink-card"
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[#4a718a]">Choose a sink first, then select a matching faucet or finish without one.</p>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-[#9ec0d8] bg-white/70 px-3 py-3 text-center">
            <p className="text-[11px] font-semibold text-[#244b67]">No verified farmhouse sinks are currently linked to this base.</p>
            <p className="mt-1 text-[10px] leading-snug text-[#55758c]">This prevents an unverified or standard sink from being shown on an apron-front base.</p>
            <button type="button" onClick={onBrowseAll} className="mt-2 text-[11px] font-semibold text-[#276b9b] underline underline-offset-2">Browse sink catalog</button>
          </div>
        )}
      </div>
    </section>
  );
}

const COUNTERTOP_CARD_LIMIT = 8;

export function PelicanCountertopPicker({
  selectedSurfaces,
  onSelect,
  onBrowseAll,
}: {
  selectedSurfaces: SelectedSurface[];
  onSelect: (item: SelectedSurface) => void;
  onBrowseAll: () => void;
}) {
  // Slabs are sold as separate SKUs per size ("3cm" and "3cm Super Jumbo", Left
  // and Right cuts), so request the whole palette and fold it into color cards.
  const { data, isLoading } = trpc.surfaces.recommended.useQuery({ role: "countertop", limit: 60 });
  const items = (data ?? []) as RecItem[];
  const configurations = useMemo(() => groupPelicanConfigurations(items), [items]);
  const selectedIds = useMemo(() => new Set(selectedSurfaces.map((s) => s.id)), [selectedSurfaces]);
  const [expanded, setExpanded] = useState(false);
  const selectedSummary = selectedSurfaces.length === 0
    ? "Choose a countertop"
    : selectedSurfaces.length === 1
      ? selectedSurfaces[0].name
      : `${selectedSurfaces.length} countertops selected`;

  return (
    <div className="overflow-hidden rounded-lg border border-[#d9c196]/70 bg-[#fffdf9]">
      <div className="flex min-h-12 items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="countertop-material-options"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#fbf5e8]"
        >
          <Waves className="h-4 w-4 shrink-0 text-[#a87f33]" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-foreground">Countertop choices</span>
            <span className="block truncate text-[10px] text-muted-foreground">{selectedSummary}</span>
          </span>
          <ChevronRight className={`h-4 w-4 shrink-0 text-[#8a6828] transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onBrowseAll}
          className="shrink-0 border-l border-[#d9c196]/70 px-2 text-[10px] font-semibold text-[#8a6828] transition-colors hover:bg-[#f7edd9]"
        >
          Browse all
        </button>
      </div>
      {expanded && (
        <div id="countertop-material-options" className="border-t border-[#d9c196]/70 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pelican Quartz Slabs</span>
            <span className="text-[10px] text-muted-foreground">Pick a slab size, then use it</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          ) : configurations.length === 0 ? (
            <button
              type="button"
              onClick={onBrowseAll}
              className="w-full rounded-lg border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground hover:border-[#a87f33]/50 hover:text-foreground transition-colors"
            >
              No countertops available — browse the full catalog
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {configurations.slice(0, COUNTERTOP_CARD_LIMIT).map((configuration) => (
                  <PelicanConfigurationCard
                    key={configuration.key}
                    configuration={configuration}
                    selectedIds={selectedIds}
                    onUse={(item) => onSelect(toSurface(item))}
                    testIdPrefix="countertop-card"
                  />
                ))}
              </div>
              {configurations.length > COUNTERTOP_CARD_LIMIT && (
                <button
                  type="button"
                  onClick={onBrowseAll}
                  className="mt-2 w-full text-center text-[11px] font-semibold text-[#8a6828] underline underline-offset-2"
                >
                  Browse all {configurations.length} quartz colors
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const SINK_CARD_LIMIT = 8;

export function PelicanSinkPicker({
  selectedSurfaces,
  onSelect,
  onBrowseAll,
}: {
  selectedSurfaces: SelectedSurface[];
  onSelect: (item: SelectedSurface) => void;
  onBrowseAll: () => void;
}) {
  const { data, isLoading } = trpc.surfaces.recommended.useQuery({ role: "sink", limit: 200 });
  // Only source-verified sinks are eligible, and that test runs on the exact SKU
  // before sinks are folded into one card per model.
  const configurations = useMemo(
    () => groupPelicanConfigurations(((data ?? []) as RecItem[]).filter((item) => Boolean(verifiedPelicanSinkProfile(item.pelicanCode)))),
    [data],
  );
  const selectedIds = useMemo(() => new Set(selectedSurfaces.map((s) => s.id)), [selectedSurfaces]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Verified Pelican Sinks
        </span>
        <button
          type="button"
          onClick={onBrowseAll}
          className="flex items-center gap-0.5 text-[10px] font-medium text-[#a87f33] hover:text-[#8a6828] transition-colors"
        >
          Browse all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : configurations.length === 0 ? (
        <button
          type="button"
          onClick={onBrowseAll}
          className="w-full rounded-lg border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground hover:border-[#a87f33]/50 hover:text-foreground transition-colors"
        >
          No sinks available — browse the full catalog
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {configurations.slice(0, SINK_CARD_LIMIT).map((configuration) => (
              <PelicanConfigurationCard
                key={configuration.key}
                configuration={configuration}
                selectedIds={selectedIds}
                onUse={(item) => onSelect(toSurface(item))}
                testIdPrefix="sink-card"
              />
            ))}
          </div>
          {configurations.length > SINK_CARD_LIMIT && (
            <button
              type="button"
              onClick={onBrowseAll}
              className="w-full text-center text-[11px] font-semibold text-[#8a6828] underline underline-offset-2"
            >
              Browse all {configurations.length} verified sinks
            </button>
          )}
        </>
      )}
    </div>
  );
}


/**
 * Sink-mounted faucets are selectable fixtures rather than material surfaces.
 * This chooser carries the exact catalog record through to the Design Tool so
 * the chosen code, image, price, and source-measured fixture profile persist.
 * It deliberately accepts only records that the server already determined are
 * active, priced, and valid for this kitchen or vanity workflow.
 *
 * A faucet that is sold in several finishes (PL-8237 in Brushed Gold, Brushed
 * Nickel, Chrome, Matte Black) is one card with a finish dropdown, like the
 * cabinet hardware picker; choosing a finish still returns that finish's exact
 * catalog row.
 */
export function PelicanFaucetPicker({
  faucets,
  isLoading,
  kind,
  onSelect,
}: {
  faucets: RecItem[];
  isLoading: boolean;
  kind: "kitchen" | "vanity";
  onSelect: (item: RecItem) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const configurations = useMemo(
    () => groupPelicanConfigurations(faucets.filter((item) => Boolean(item.imageUrl) && (item.sellPrice ?? 0) > 0)),
    [faucets],
  );
  const quickChoices = configurations.slice(0, 6);
  const visibleConfigurations = showAll ? configurations : quickChoices;
  const label = kind === "vanity" ? "vanity faucets" : "kitchen faucets";

  return (
    <section data-testid="pelican-faucet-picker" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Verified Pelican {kind === "vanity" ? "Vanity" : "Kitchen"} Faucets
        </span>
        {!isLoading && configurations.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            aria-expanded={showAll}
            className="text-[10px] font-semibold text-[#8a6828] underline underline-offset-2 transition-colors hover:text-[#5e451a]"
          >
            {showAll ? "Show fewer faucets" : `Show all ${configurations.length} faucets`}
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : configurations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
          No source-priced, measured Pelican {label} are available for this fixture workflow.
        </div>
      ) : (
        <>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Choose a finish, then use it to attach that exact Pelican finish, image, price, and measured fixture profile.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {visibleConfigurations.map((configuration) => (
              <PelicanConfigurationCard
                key={configuration.key}
                configuration={configuration}
                selectedIds={NO_SELECTION}
                onUse={(item) => onSelect(item)}
                testIdPrefix="faucet-card"
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
