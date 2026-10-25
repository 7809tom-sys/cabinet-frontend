import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ChevronsDown } from "lucide-react";

export type SelectedCabinetDropActionsProps = {
  countertopLabel: string;
  countertopTitle: string;
  floorLabel: string;
  floorTitle: string;
  onDropToCountertop: () => void;
  onDropToFloor: () => void;
  touch?: boolean;
};

export function SelectedCabinetDropActions({
  countertopLabel,
  countertopTitle,
  floorLabel,
  floorTitle,
  onDropToCountertop,
  onDropToFloor,
  touch = false,
}: SelectedCabinetDropActionsProps) {
  return (
    <div
      className={touch ? "mt-3 flex flex-wrap gap-2" : "flex shrink-0 items-center gap-1"}
      data-testid={touch ? "selected-cabinet-drop-actions-touch" : "selected-cabinet-drop-actions"}
    >
      <Button
        variant="outline"
        size="sm"
        className={touch ? "h-9 min-w-[150px] flex-1 gap-1 px-3 text-[11px]" : "h-7 gap-1 px-2 text-[11px]"}
        title={countertopTitle}
        onClick={onDropToCountertop}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        {countertopLabel}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={touch ? "h-9 min-w-[120px] flex-1 gap-1 px-3 text-[11px]" : "h-7 gap-1 px-2 text-[11px]"}
        title={floorTitle}
        onClick={onDropToFloor}
      >
        <ChevronsDown className="h-3.5 w-3.5" />
        {floorLabel}
      </Button>
    </div>
  );
}
