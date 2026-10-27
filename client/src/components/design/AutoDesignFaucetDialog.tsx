import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/pelican";
import {
  catalogFaucetFinish,
  groupFaucetsByBrand,
  type AutoDesignFaucetProduct,
} from "@/lib/autoDesignFaucet";

type Props = {
  open: boolean;
  sinkLabel: string;
  sinkCount: number;
  products: readonly AutoDesignFaucetProduct[];
  loading: boolean;
  catalogUnavailable: boolean;
  onKeepDefault: () => void;
  onChoose: (product: AutoDesignFaucetProduct, applyToAll: boolean) => void;
};

export function AutoDesignFaucetDialog({
  open,
  sinkLabel,
  sinkCount,
  products,
  loading,
  catalogUnavailable,
  onKeepDefault,
  onChoose,
}: Props) {
  const [brand, setBrand] = useState("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const groups = useMemo(() => groupFaucetsByBrand(products), [products]);
  const brands = groups.map((group) => group.brand);
  const visible = brand === "All" ? groups : groups.filter((group) => group.brand === brand);
  const selected = products.find((product) => product.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onKeepDefault(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="auto-design-faucet-dialog">
        <DialogHeader>
          <DialogTitle>Choose a faucet</DialogTitle>
          <DialogDescription>
            Auto-Design placed a faucet on the countertop behind {sinkLabel}, centered on the sink. Pick a catalog faucet to replace the default, or keep it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {brands.length > 1 && (
            <div className="flex flex-wrap gap-1.5" data-testid="auto-design-faucet-brands">
              {["All", ...brands].map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={brand === name ? "default" : "outline"}
                  data-testid={`auto-design-faucet-brand-${name}`}
                  onClick={() => setBrand(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          )}
          {loading && <p className="text-sm text-muted-foreground" data-testid="auto-design-faucet-loading">Loading faucets from the catalog…</p>}
          {!loading && catalogUnavailable && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="auto-design-faucet-unavailable">
              The faucet catalog did not return any products. Keep the default to leave the deck-mounted faucet in place without a priced catalog selection.
            </p>
          )}
          {!loading && !catalogUnavailable && visible.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="auto-design-faucet-empty">No deck-mounted faucets were returned for this brand.</p>
          )}
          {visible.map((group) => (
            <section key={group.brand} data-testid={`auto-design-faucet-group-${group.brand}`} className="grid gap-2">
              <h3 className="text-sm font-semibold">{group.brand}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.products.map((product) => {
                  const finish = catalogFaucetFinish(product);
                  const active = product.id === selectedId;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      data-testid={`auto-design-faucet-option-${product.id}`}
                      onClick={() => setSelectedId(product.id)}
                      className={`flex gap-3 rounded-lg border p-2 text-left ${active ? "border-[#1a2744] bg-slate-50" : "border-border hover:bg-muted/40"}`}
                    >
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-contain bg-white" />
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">No image</span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{product.name}</span>
                        {finish && <span className="mt-1 block text-xs text-muted-foreground">{finish}</span>}
                        <span className="mt-1 block text-xs font-semibold">
                          {product.sellPrice != null ? formatPrice(product.sellPrice) : "Price unavailable"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="auto-design-faucet-keep" onClick={onKeepDefault}>Keep default</Button>
          <div className="flex flex-wrap gap-2">
            {sinkCount > 1 && (
              <Button
                type="button"
                variant="outline"
                data-testid="auto-design-faucet-apply-all"
                disabled={!selected}
                onClick={() => selected && onChoose(selected, true)}
              >
                Apply to all sinks
              </Button>
            )}
            <Button
              type="button"
              data-testid="auto-design-faucet-use"
              disabled={!selected}
              onClick={() => selected && onChoose(selected, false)}
            >
              Use this faucet
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
