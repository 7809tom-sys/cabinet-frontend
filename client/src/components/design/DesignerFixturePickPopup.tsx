import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AutoDesignSinkProduct } from "@/lib/autoDesignSink";
import {
  isAutoDesignDeckFaucet,
  type AutoDesignFaucetProduct,
} from "@/lib/autoDesignFaucet";
import { formatPrice } from "@/lib/pelican";
import { ProductPhotoGrid, ProductPhotoTile } from "./ProductPhotoGrid";

export type FixturePick = { sinkId: number | null; faucetId: number | null };
export type FixturePickStep = "sink" | "faucet";

const MAX_VISIBLE = 12;

function priceLine(sellPrice: number | null | undefined): string {
  if (sellPrice === null || sellPrice === undefined) return "Price unavailable";
  return formatPrice(sellPrice);
}

export function DesignerFixturePickPopup(props: {
  open: boolean;
  /** Sink first. A picked sink closes this popup and the faucet popup opens next. */
  step: FixturePickStep;
  sinkProducts: readonly AutoDesignSinkProduct[];
  faucetProducts: readonly AutoDesignFaucetProduct[];
  loading: boolean;
  onPickSink: (sinkId: number) => void;
  onPickFaucet: (faucetId: number) => void;
  onDismiss: () => void;
}) {
  const { open, step, sinkProducts, faucetProducts, loading, onPickSink, onPickFaucet, onDismiss } = props;
  const deckFaucets = useMemo(
    () => faucetProducts.filter((faucet) => isAutoDesignDeckFaucet(faucet)),
    [faucetProducts],
  );
  const [showAll, setShowAll] = useState(false);
  const sinkStep = step === "sink";
  useEffect(() => { setShowAll(false); }, [step, open]);
  const visibleSinks = showAll ? sinkProducts : sinkProducts.slice(0, MAX_VISIBLE);
  const visibleFaucets = showAll ? deckFaucets : deckFaucets.slice(0, MAX_VISIBLE);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent
        data-testid="designer-fixture-pick-popup"
        data-step={step}
        className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{sinkStep ? "Pick your sink" : "Pick your faucet"}</DialogTitle>
          <DialogDescription>
            {sinkStep
              ? "Tap a sink. The faucet choices open next. You can skip this and pick later."
              : "Tap a faucet for the sink you just picked. You can skip this and pick later."}
          </DialogDescription>
        </DialogHeader>

        {sinkStep ? (
          <section aria-label="Sink">
            {loading ? (
              <p className="text-sm text-neutral-600">Loading the catalog…</p>
            ) : sinkProducts.length === 0 ? (
              <p className="text-sm text-neutral-600">No sinks in the catalog yet.</p>
            ) : (
              <ProductPhotoGrid testId="fixture-sink-grid" className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                {visibleSinks.map((sink) => (
                  <ProductPhotoTile
                    key={sink.id}
                    testId={`fixture-sink-${sink.id}`}
                    selected={false}
                    onSelect={() => onPickSink(sink.id)}
                    imageUrl={sink.imageUrl}
                    name={sink.name}
                    code={sink.pelicanCode}
                    price={priceLine(sink.sellPrice)}
                  />
                ))}
              </ProductPhotoGrid>
            )}
            {sinkProducts.length > MAX_VISIBLE && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 self-start text-[#244338]" onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Show fewer" : `Show all (${sinkProducts.length})`}
              </Button>
            )}
          </section>
        ) : (
          <section aria-label="Faucet">
            {loading ? (
              <p className="text-sm text-neutral-600">Loading the catalog…</p>
            ) : deckFaucets.length === 0 ? (
              <p className="text-sm text-neutral-600">No deck-mounted faucets in the catalog yet.</p>
            ) : (
              <ProductPhotoGrid testId="fixture-faucet-grid" className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                {visibleFaucets.map((faucet) => (
                  <ProductPhotoTile
                    key={faucet.id}
                    testId={`fixture-faucet-${faucet.id}`}
                    selected={false}
                    onSelect={() => onPickFaucet(faucet.id)}
                    imageUrl={faucet.imageUrl}
                    name={faucet.name}
                    code={faucet.pelicanCode}
                    price={priceLine(faucet.sellPrice)}
                  />
                ))}
              </ProductPhotoGrid>
            )}
            {deckFaucets.length > MAX_VISIBLE && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 self-start text-[#244338]" onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Show fewer" : `Show all (${deckFaucets.length})`}
              </Button>
            )}
          </section>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="fixture-pick-skip"
            onClick={onDismiss}
          >
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
