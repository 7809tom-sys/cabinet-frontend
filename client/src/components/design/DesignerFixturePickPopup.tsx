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

export type FixturePick = { sinkId: number | null; faucetId: number | null };

const MAX_VISIBLE = 12;

function priceLine(sellPrice: number | null | undefined): string {
  if (sellPrice === null || sellPrice === undefined) return "Price unavailable";
  return formatPrice(sellPrice);
}

function ProductThumb({ imageUrl, alt }: { imageUrl?: string | null; alt: string }) {
  if (!imageUrl) {
    return (
      <div
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded border border-[#e5e1d8] bg-[#f6f3ed]"
      />
    );
  }
  return (
    <img
      src={imageUrl}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded border border-[#e5e1d8] bg-[#fffdf9] object-contain"
    />
  );
}

type ProductButtonProps = {
  testId: string;
  selected: boolean;
  onSelect: () => void;
  imageUrl?: string | null;
  name: string;
  price: string;
};

function ProductButton({
  testId,
  selected,
  onSelect,
  imageUrl,
  name,
  price,
}: ProductButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onSelect}
      className={
        "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors " +
        (selected
          ? "border-[#244338] bg-[#f6f3ed]"
          : "border-[#e5e1d8] bg-[#fffdf9] hover:bg-[#f6f3ed]")
      }
    >
      <ProductThumb imageUrl={imageUrl} alt={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[#244338]">{name}</span>
        <span className="block text-xs text-neutral-600">{price}</span>
      </span>
    </button>
  );
}

export function DesignerFixturePickPopup(props: {
  open: boolean;
  sinkProducts: readonly AutoDesignSinkProduct[];
  faucetProducts: readonly AutoDesignFaucetProduct[];
  loading: boolean;
  initial?: FixturePick;
  onSave: (pick: FixturePick) => void;
  onDismiss: () => void;
}) {
  const { open, sinkProducts, faucetProducts, loading, initial, onSave, onDismiss } = props;

  const [sinkId, setSinkId] = useState<number | null>(initial?.sinkId ?? null);
  const [faucetId, setFaucetId] = useState<number | null>(initial?.faucetId ?? null);
  const [showAllSinks, setShowAllSinks] = useState(false);
  const [showAllFaucets, setShowAllFaucets] = useState(false);

  // Reset local selection whenever the popup opens.
  useEffect(() => {
    if (open) {
      setSinkId(initial?.sinkId ?? null);
      setFaucetId(initial?.faucetId ?? null);
      setShowAllSinks(false);
      setShowAllFaucets(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const deckFaucets = useMemo(
    () => faucetProducts.filter((f) => isAutoDesignDeckFaucet(f)),
    [faucetProducts],
  );

  const visibleSinks = showAllSinks ? sinkProducts : sinkProducts.slice(0, MAX_VISIBLE);
  const visibleFaucets = showAllFaucets ? deckFaucets : deckFaucets.slice(0, MAX_VISIBLE);

  const canSave = sinkId !== null || faucetId !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent
        data-testid="designer-fixture-pick-popup"
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Pick your faucet and sink</DialogTitle>
          <DialogDescription>
            Pick them now so the layout is planned around them. You can skip this and pick later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-label="Sink">
            <h3 className="mb-2 text-sm font-semibold text-[#244338]">Sink</h3>
            {loading ? (
              <p className="text-sm text-neutral-600">Loading the catalog…</p>
            ) : sinkProducts.length === 0 ? (
              <p className="text-sm text-neutral-600">No sinks in the catalog yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleSinks.map((sink) => (
                  <ProductButton
                    key={sink.id}
                    testId={`fixture-sink-${sink.id}`}
                    selected={sinkId === sink.id}
                    onSelect={() => setSinkId((prev) => (prev === sink.id ? null : sink.id))}
                    imageUrl={sink.imageUrl}
                    name={sink.name}
                    price={priceLine(sink.sellPrice)}
                  />
                ))}
                {sinkProducts.length > MAX_VISIBLE && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-[#244338]"
                    onClick={() => setShowAllSinks((v) => !v)}
                  >
                    {showAllSinks ? "Show fewer" : `Show all (${sinkProducts.length})`}
                  </Button>
                )}
              </div>
            )}
          </section>

          <section aria-label="Faucet">
            <h3 className="mb-2 text-sm font-semibold text-[#244338]">Faucet</h3>
            {loading ? (
              <p className="text-sm text-neutral-600">Loading the catalog…</p>
            ) : deckFaucets.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No deck-mounted faucets in the catalog yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleFaucets.map((faucet) => (
                  <ProductButton
                    key={faucet.id}
                    testId={`fixture-faucet-${faucet.id}`}
                    selected={faucetId === faucet.id}
                    onSelect={() =>
                      setFaucetId((prev) => (prev === faucet.id ? null : faucet.id))
                    }
                    imageUrl={faucet.imageUrl}
                    name={faucet.name}
                    price={priceLine(faucet.sellPrice)}
                  />
                ))}
                {deckFaucets.length > MAX_VISIBLE && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-[#244338]"
                    onClick={() => setShowAllFaucets((v) => !v)}
                  >
                    {showAllFaucets ? "Show fewer" : `Show all (${deckFaucets.length})`}
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="fixture-pick-skip"
            onClick={onDismiss}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            data-testid="fixture-pick-save"
            disabled={!canSave}
            className="bg-[#244338] text-white hover:bg-[#1c352c]"
            onClick={() => onSave({ sinkId, faucetId })}
          >
            Save picks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
