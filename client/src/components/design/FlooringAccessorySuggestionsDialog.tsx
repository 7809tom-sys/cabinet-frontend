import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/pelican";
import type { SelectedSurface } from "./SurfacesPickerDialog";

export function FlooringAccessorySuggestionsDialog({
  floor,
  accessories,
  isLoading,
  selectedAccessoryIds,
  onAddAccessory,
  onOpenChange,
}: {
  floor: SelectedSurface | null;
  accessories: SelectedSurface[];
  isLoading: boolean;
  selectedAccessoryIds: ReadonlySet<number>;
  onAddAccessory: (item: SelectedSurface) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = floor != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,760px)] max-w-[760px] p-0">
        <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle>Complete your {floor?.name ?? "floor"} floor</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            These are optional, exact source-family transition pieces. Nothing is added until you select <strong>Add to design</strong>; trim remains a separately priced material line and never replaces your floor.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[58vh] overflow-y-auto px-5 py-4 sm:px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking exact Pelican flooring matches…</p>
          ) : accessories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">No exact source match found</p>
              <p className="mt-1 text-xs leading-relaxed">Pelican’s published names do not prove a compatible transition for this exact floor variant. Browse Flooring Trim &amp; Transitions if you need a specific accessory.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {accessories.map((accessory) => {
                const alreadyAdded = selectedAccessoryIds.has(accessory.id);
                return (
                  <article key={accessory.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex gap-3 p-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
                        {accessory.imageUrl ? (
                          <img src={accessory.imageUrl} alt={accessory.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Floor trim</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">{accessory.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{accessory.pelicanCode ?? "Pelican code on file"}</p>
                        {accessory.size && <p className="text-[11px] text-muted-foreground">{accessory.size}</p>}
                        <p className="mt-1 text-sm font-bold text-foreground">{formatPrice(accessory.sellPrice)}</p>
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2.5">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9 w-full"
                        disabled={alreadyAdded}
                        aria-label={alreadyAdded ? `${accessory.name} already added` : `Add ${accessory.name} to design`}
                        onClick={() => onAddAccessory(accessory)}
                      >
                        {alreadyAdded ? "Added to design" : "Add to design"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border px-5 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Skip accessories</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
