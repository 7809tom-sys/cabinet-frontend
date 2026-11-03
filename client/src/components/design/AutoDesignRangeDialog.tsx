/**
 * The Auto-Design range pop-up.
 *
 * The measured build always seats a range at the range center the person
 * entered, but without a pick it silently used the first RANGE-30 palette row,
 * so the appliance finish was never a choice. This pop-up is the same pattern as
 * the sink and tall-cabinet choosers: one card per range the catalog offers, and
 * the pick is auto-placed at that measured center — nothing is dragged. The
 * auto-placed corner boxes on the range wall then follow the real range width.
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AutoDesignApplianceChoice } from "@/lib/autoDesignTallCabinets";

type Props = {
  open: boolean;
  choices: readonly AutoDesignApplianceChoice[];
  selected: AutoDesignApplianceChoice | null;
  onKeepDefault: () => void;
  onChoose: (choice: AutoDesignApplianceChoice) => void;
};

export function AutoDesignRangeDialog({ open, choices, selected, onKeepDefault, onChoose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onKeepDefault(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="auto-design-range-dialog">
        <DialogHeader>
          <DialogTitle>Choose a range</DialogTitle>
          <DialogDescription>
            Auto-Design seats the range at the range center you entered. Pick the appliance and it is placed there
            automatically, and the corner cabinets on that wall are planned around its real width.
          </DialogDescription>
        </DialogHeader>
        {choices.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="auto-design-range-empty">
            The appliance palette has no range for this room type, so Auto-Design keeps the generic 30″ range.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="auto-design-range-grid">
            {choices.map((choice) => {
              const active = selected?.key === choice.key;
              return (
                <button
                  key={choice.key}
                  type="button"
                  data-testid={`auto-design-range-option-${choice.key}`}
                  onClick={() => onChoose(choice)}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-left ${active ? "border-[#1a2744] bg-slate-50" : "border-border hover:bg-muted/40"}`}
                >
                  {choice.imageUrl ? (
                    <img src={choice.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-contain bg-white" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">No photo</span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{choice.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{choice.widthIn}″ wide · {choice.masterCode}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="auto-design-range-keep" onClick={onKeepDefault}>
            Keep the current range
          </Button>
          {selected && (
            <Button type="button" variant="outline" data-testid="auto-design-range-use" onClick={() => onChoose(selected)}>
              Use {selected.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
