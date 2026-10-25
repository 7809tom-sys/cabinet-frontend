import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEighthInches, type PlacedCabinet } from "@/lib/design";
import { isRequiredBlindCornerFillerGroupId } from "@/lib/blindCornerRequiredFiller";
import type { SmallGapFillerPlacementMode } from "@/lib/smallGapFiller";

export type FillerAttributesDialogProps = {
  filler: PlacedCabinet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measuredOpening: number | null;
  onApply: (mode: SmallGapFillerPlacementMode, sizeIn: number) => void;
  onResizeStandalone: (uid: string, sizeIn: number) => void;
  onRemove: (uid: string) => void;
};

const MIN_FILLER_IN = 0.125;

function currentFillerSize(filler: PlacedCabinet | null) {
  if (!filler) return 0;
  const grouped = Number(filler.fillerTotalWidth);
  return Number.isFinite(grouped) && grouped > 0 ? grouped : Math.max(MIN_FILLER_IN, Number(filler.width) || MIN_FILLER_IN);
}

export function FillerAttributesDialog({
  filler,
  open,
  onOpenChange,
  measuredOpening,
  onApply,
  onResizeStandalone,
  onRemove,
}: FillerAttributesDialogProps) {
  const currentSize = useMemo(() => currentFillerSize(filler), [filler]);
  const [sizeText, setSizeText] = useState(String(currentSize));
  useEffect(() => setSizeText(String(currentSize)), [currentSize, filler?.uid, open]);

  if (!filler) return null;
  const requiredBlindCorner = isRequiredBlindCornerFillerGroupId(filler.fillerPieceGroupId);
  const linkedOpening = measuredOpening != null && measuredOpening >= MIN_FILLER_IN;
  const maxSize = linkedOpening
    ? measuredOpening
    : Math.max(currentSize, Number(filler.nominalWidth) || Number(filler.width) || 3);
  const parsedSize = Math.round(Number(sizeText) * 8) / 8;
  const validSize = Number.isFinite(parsedSize) && parsedSize >= MIN_FILLER_IN && parsedSize <= maxSize + 0.001;
  const apply = (mode: SmallGapFillerPlacementMode) => {
    if (!validSize || requiredBlindCorner) return;
    if (linkedOpening) onApply(mode, parsedSize);
    else onResizeStandalone(filler.uid, parsedSize);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] overflow-y-auto sm:max-w-lg" data-testid="filler-attributes-dialog">
        <DialogHeader>
          <DialogTitle>Filler attributes</DialogTitle>
          <DialogDescription>
            {requiredBlindCorner
              ? "This 3-inch filler is required by its blind-corner cabinet and stays attached to that cabinet."
              : linkedOpening
                ? `Edit the complete filler group in its measured ${formatEighthInches(measuredOpening)} opening.`
                : "Edit this standalone filler. Its start edge stays fixed while its size changes."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/25 p-3 text-sm">
            <div><span className="block text-xs text-muted-foreground">Catalog item</span><strong>{filler.masterCode}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Current installed size</span><strong>{formatEighthInches(currentSize)}</strong></div>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Filler size in inches
            <Input
              aria-label="Filler size in inches"
              inputMode="decimal"
              step="0.125"
              min={MIN_FILLER_IN}
              max={maxSize}
              value={sizeText}
              disabled={requiredBlindCorner}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setSizeText(event.target.value)}
            />
            <span className="text-xs font-normal text-muted-foreground">Allowed: {formatEighthInches(MIN_FILLER_IN)} to {formatEighthInches(maxSize)} in 1/8-inch steps.</span>
          </label>

          {!requiredBlindCorner && linkedOpening && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Filler placement">
              <Button type="button" variant="outline" disabled={!validSize} onClick={() => apply("left")}>All on left</Button>
              <Button type="button" variant="outline" disabled={!validSize || parsedSize < 1} onClick={() => apply("split")}>Split left / right</Button>
              <Button type="button" variant="outline" disabled={!validSize} onClick={() => apply("right")}>All on right</Button>
            </div>
          )}

          {!requiredBlindCorner && linkedOpening && parsedSize > 3 && parsedSize <= 6 && Number.isInteger(parsedSize * 4) && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950" data-testid="filler-auto-split-guidance">
              <p className="font-semibold">Auto-split this opening</p>
              <p className="mt-1 text-xs leading-5">Divide the {formatEighthInches(parsedSize)} opening into two equal catalog-valid fillers ({formatEighthInches(parsedSize / 2)} each). A full 6-inch opening becomes two 3-inch fillers.</p>
              <Button type="button" className="mt-2" disabled={!validSize} onClick={() => apply("split")}>Auto-split into two fillers</Button>
            </div>
          )}

          {!requiredBlindCorner && !linkedOpening && (
            <Button type="button" disabled={!validSize} onClick={() => apply("right")}>Apply size</Button>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={requiredBlindCorner} onClick={() => { onRemove(filler.uid); onOpenChange(false); }}>Remove filler</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
