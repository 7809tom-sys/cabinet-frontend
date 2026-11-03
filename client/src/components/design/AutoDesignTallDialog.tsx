/**
 * The Auto-Design tall-cabinet pop-up.
 *
 * Tall oven / pantry cabinets (33" × 90" oven pantry, 30" × 84" double-oven
 * tower, plain pantry, utility tower) are real boxes, but a tall box replaces
 * a floor-and-upper span, so Auto-Design never drops one into a run unasked.
 * This pop-up lists the tall boxes the selected line actually sells, grouped by
 * kind, and a pick auto-places it in the first free span that respects the wall
 * ends, the refrigerator panel limit, the ceiling, and the cabinets already
 * seated. There is no drag or manual drop step.
 *
 * Roll-out trays, valances, moldings and panels are NOT tall boxes; they stay
 * add-on accessories and never appear here.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  groupTallProducts,
  type AutoDesignTallProduct,
} from "@/lib/autoDesignTallCabinets";

type Props = {
  open: boolean;
  products: readonly AutoDesignTallProduct[];
  /** Tall boxes already picked in this build. */
  picked: readonly AutoDesignTallProduct[];
  onCancel: () => void;
  onAdd: (product: AutoDesignTallProduct) => void;
  onRemove: (productId: number) => void;
  onDone: () => void;
};

export function AutoDesignTallDialog({ open, products, picked, onCancel, onAdd, onRemove, onDone }: Props) {
  const [kind, setKind] = useState<string>("all");
  const groups = useMemo(() => groupTallProducts(products), [products]);
  const visibleGroups = kind === "all" ? groups : groups.filter((group) => group.kind === kind);
  const pickedIds = new Set(picked.map((product) => product.id));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="auto-design-tall-dialog">
        <DialogHeader>
          <DialogTitle>Add a tall oven or pantry cabinet</DialogTitle>
          <DialogDescription>
            A tall cabinet takes the full floor-to-ceiling run, so Auto-Design places it only when you ask.
            Pick one and it is placed in the first free span — nothing is dragged or dropped.
            Roll-out trays, valances and trim are add-on accessories and are not boxes, so they are not listed here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {groups.length === 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="auto-design-tall-empty">
              This line's catalog has no source-priced tall oven or pantry cabinet, so none can be placed.
            </p>
          )}
          {groups.length > 1 && (
            <div className="flex flex-wrap gap-1.5" data-testid="auto-design-tall-kinds">
              <Button type="button" size="sm" variant={kind === "all" ? "default" : "outline"} data-testid="auto-design-tall-kind-all" onClick={() => setKind("all")}>
                All
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.kind}
                  type="button"
                  size="sm"
                  variant={kind === group.kind ? "default" : "outline"}
                  data-testid={`auto-design-tall-kind-${group.kind}`}
                  onClick={() => setKind(group.kind)}
                >
                  {group.label}
                </Button>
              ))}
            </div>
          )}
          {visibleGroups.map((group) => (
            <section key={group.kind} className="grid gap-2" data-testid={`auto-design-tall-group-${group.kind}`}>
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.products.map((product) => {
                  const isPicked = pickedIds.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-start justify-between gap-2 rounded-lg border p-2 ${isPicked ? "border-[#1a2744] bg-slate-50" : "border-border"}`}
                      data-testid={`auto-design-tall-option-${product.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{product.masterCode}</p>
                        <p className="text-xs text-muted-foreground">{`${product.widthIn}″ W × ${product.heightIn}″ H × ${product.depthIn}″ D`}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{product.description}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isPicked ? "outline" : "default"}
                        data-testid={`auto-design-tall-${isPicked ? "remove" : "add"}-${product.id}`}
                        onClick={() => (isPicked ? onRemove(product.id) : onAdd(product))}
                      >
                        {isPicked ? "Remove" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {picked.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="auto-design-tall-picked">
              Picked: {picked.map((product) => product.masterCode).join(", ")}. These are placed automatically when the kitchen is built.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="auto-design-tall-cancel" onClick={onCancel}>No tall cabinet</Button>
          <Button type="button" data-testid="auto-design-tall-done" onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
