/**
 * The Auto-Design sink pop-up.
 *
 * Auto-Design already offers a faucet next to the sink base. This is its sink
 * twin: a pop-up, not an inline row, opened from the same place the faucet
 * chooser lives so the two fixtures stay together. Every card is a real Pelican
 * catalog sink (folded one card per model with its gauge/size selector), and
 * choosing one auto-places it — no drag, no manual drop, and the same for a
 * second sink.
 *
 * The card states the base the sink pairs with (farmhouse FSB for an
 * apron-front sink, the smallest straight base at or above its published
 * minimum cabinet width for an undermount/drop-in), so nobody has to guess.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import { PelicanConfigurationCard } from "./PelicanConfigurationCard";
import {
  catalogSinkInstallation,
  sinkBasePairing,
  type AutoDesignSinkProduct,
} from "@/lib/autoDesignSink";
import { verifiedPelicanSinkProfile } from "@/lib/pelicanFixtureProfiles";

type Props = {
  open: boolean;
  /** The sink base the build already seats, e.g. SB36. */
  sinkBaseLabel: string;
  products: readonly AutoDesignSinkProduct[];
  loading: boolean;
  catalogUnavailable: boolean;
  /** Already chosen in this design, so the pop-up can say what a second pick does. */
  placedSinkCount: number;
  onKeepDefault: () => void;
  onChoose: (product: AutoDesignSinkProduct, applyToAllSinks: boolean) => void;
};

const INSTALLATION_FILTERS = ["All", "Farmhouse", "Undermount / drop-in"] as const;
type InstallationFilter = (typeof INSTALLATION_FILTERS)[number];

function installationFilterFor(product: AutoDesignSinkProduct): InstallationFilter {
  return catalogSinkInstallation(product) === "farmhouse" ? "Farmhouse" : "Undermount / drop-in";
}

export function AutoDesignSinkDialog({
  open,
  sinkBaseLabel,
  products,
  loading,
  catalogUnavailable,
  placedSinkCount,
  onKeepDefault,
  onChoose,
}: Props) {
  const [filter, setFilter] = useState<InstallationFilter>("All");
  const visible = useMemo(() => {
    const rows = filter === "All" ? products : products.filter((product) => installationFilterFor(product) === filter);
    return groupPelicanConfigurations(rows as never);
  }, [filter, products]);

  const hasFarm = products.some((product) => installationFilterFor(product) === "Farmhouse");
  const hasStandard = products.some((product) => installationFilterFor(product) === "Undermount / drop-in");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onKeepDefault(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="auto-design-sink-dialog">
        <DialogHeader>
          <DialogTitle>Choose a sink</DialogTitle>
          <DialogDescription>
            Auto-Design seated {sinkBaseLabel} as the sink base. Pick a catalog sink and it is placed in the base
            automatically, centered in the opening — nothing is dragged or dropped.
            {placedSinkCount > 0 ? " Adding another sink places its own matching base, so no two basins share one cabinet." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5" data-testid="auto-design-sink-filters">
            {INSTALLATION_FILTERS.filter((name) => name === "All" || (name === "Farmhouse" ? hasFarm : hasStandard)).map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={filter === name ? "default" : "outline"}
                data-testid={`auto-design-sink-filter-${name === "All" ? "all" : name === "Farmhouse" ? "farmhouse" : "standard"}`}
                onClick={() => setFilter(name)}
              >
                {name}
              </Button>
            ))}
          </div>
          {loading && <p className="text-sm text-muted-foreground" data-testid="auto-design-sink-loading">Loading sinks from the Pelican catalog…</p>}
          {!loading && catalogUnavailable && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="auto-design-sink-unavailable">
              The sink catalog did not return any products. Keep the default to leave the generic basin in the measured base.
            </p>
          )}
          {!loading && !catalogUnavailable && visible.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="auto-design-sink-empty">No Pelican sinks matched this filter.</p>
          )}
          {visible.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="auto-design-sink-grid">
              {visible.map((configuration) => (
                <div key={configuration.key} className="min-w-0">
                  <PelicanConfigurationCard
                    configuration={configuration}
                    selectedIds={new Set<number>()}
                    actionLabel="Place this sink"
                    testIdPrefix="auto-design-sink-card"
                    note={<SinkPairingNote product={configuration.variants[0]!.item as unknown as AutoDesignSinkProduct} />}
                    onUse={(item) => onChoose(item as unknown as AutoDesignSinkProduct, false)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="auto-design-sink-keep" onClick={onKeepDefault}>
            Keep the default basin
          </Button>
          {placedSinkCount > 0 && visible.length > 0 && (
            <Button
              type="button"
              variant="outline"
              data-testid="auto-design-sink-apply-all"
              onClick={() => onChoose(visible[0]!.variants[0]!.item as unknown as AutoDesignSinkProduct, true)}
            >
              Use {visible[0]!.variants[0]!.item.pelicanCode ?? visible[0]!.label} on every sink
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SinkPairingNote({ product }: { product: AutoDesignSinkProduct }) {
  const pairing = sinkBasePairing(product);
  const profile = verifiedPelicanSinkProfile(product.pelicanCode);
  return (
    <span className="block space-y-0.5 text-[10px] leading-snug text-muted-foreground" data-testid={`auto-design-sink-pairing-${product.id}`}>
      <span className="block">
        {pairing.kind === "farmhouse"
          ? "Pairs with its matching farmhouse (FSB) base"
          : pairing.kind === "vanity"
            ? "Vanity basin — not a kitchen sink"
            : pairing.minimumWidthIn != null
              ? `Fits a straight sink base ${pairing.minimumWidthIn}″ or wider`
              : "Fits a straight sink base"}
      </span>
      {profile ? <span className="block">{`${profile.exteriorWidthIn}″ × ${profile.exteriorDepthIn}″ · source-verified`}</span> : null}
    </span>
  );
}
