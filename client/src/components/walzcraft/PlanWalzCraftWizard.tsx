import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import WalzCraftDoorPicker from "@/pages/WalzCraftDoorPicker";
import type { ShadeColor } from "@shared/walzcraftDoorTemplates";

/** Entry point for the WalzCraft color wizard on the Designer floor plan. */
export function PlanWalzCraftWizardButton({ onShade }: { onShade: (shade: ShadeColor) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="plan-walzcraft-wizard"
        onClick={() => setOpen(true)}
        className="rounded-md border-2 border-[#d7a46c] bg-[#fffdf9] px-3 py-1.5 text-xs font-semibold text-[#244338] shadow-sm hover:bg-[#d7a46c]/20"
      >
        WalzCraft color
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>WalzCraft color</DialogTitle>
            <DialogDescription>
              Pick a color family, then one of its four shades. That shade becomes the door color.
            </DialogDescription>
          </DialogHeader>
          <WalzCraftDoorPicker embedded onShadeChosen={onShade} />
        </DialogContent>
      </Dialog>
    </>
  );
}
