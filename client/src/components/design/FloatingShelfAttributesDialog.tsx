import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEighthInches, type PlacedCabinet } from "@/lib/design";

type Props = {
  shelf: PlacedCabinet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ceilingHeight: number;
  shelvesOnRun: number;
  onApply: (uid: string, bottomIn: number, lengthIn: number) => void;
  onDuplicate: (uid: string, bottomIn: number) => void;
  getDuplicateOverlapWarning?: (uid: string, bottomIn: number) => string | null;
  getNearestDuplicateClearHeight?: (uid: string, desiredBottomIn: number) => number | null;
  onRemove: (uid: string) => void;
};

const MIN_SHELF_LENGTH_IN = 6;

export function FloatingShelfAttributesDialog({ shelf, open, onOpenChange, ceilingHeight, shelvesOnRun, onApply, onDuplicate, getDuplicateOverlapWarning, getNearestDuplicateClearHeight, onRemove }: Props) {
  const maximumLength = useMemo(() => Math.max(MIN_SHELF_LENGTH_IN, Number(shelf?.nominalWidth ?? shelf?.width) || MIN_SHELF_LENGTH_IN), [shelf?.nominalWidth, shelf?.uid, shelf?.width]);
  const maximumBottom = useMemo(() => Math.max(0, ceilingHeight - Math.max(0.125, Number(shelf?.height) || 0.75)), [ceilingHeight, shelf?.height]);
  const [bottomText, setBottomText] = useState("54");
  const [lengthText, setLengthText] = useState(String(maximumLength));
  const previewRef = useRef<HTMLDivElement>(null);
  const previewPointerIdRef = useRef<number | null>(null);
  const previewBottomRef = useRef(54);
  const [snapNotice, setSnapNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!shelf) return;
    setBottomText(String(Math.round((Number(shelf.mountBottom) || 54) * 8) / 8));
    setLengthText(String(Math.round((Number(shelf.width) || maximumLength) * 8) / 8));
    setSnapNotice(null);
  }, [maximumLength, open, shelf?.mountBottom, shelf?.uid, shelf?.width]);

  if (!shelf) return null;
  const bottomIn = Math.round(Number(bottomText) * 8) / 8;
  const lengthIn = Math.round(Number(lengthText) * 8) / 8;
  const validBottom = Number.isFinite(bottomIn) && bottomIn >= 0 && bottomIn <= maximumBottom;
  const valid = validBottom && Number.isFinite(lengthIn) && lengthIn >= MIN_SHELF_LENGTH_IN && lengthIn <= maximumLength;
  const canDuplicate = validBottom && shelvesOnRun < 4;
  const shelfThickness = Math.max(0.125, Number(shelf.height) || 0.75);
  const originalBottom = Math.max(0, Math.min(maximumBottom, Number(shelf.mountBottom) || 54));
  const verticalPercent = (heightFromFloor: number) => Math.max(2, Math.min(94, 100 - ((heightFromFloor + shelfThickness) / Math.max(1, ceilingHeight)) * 100));
  const previewBottom = validBottom ? bottomIn : originalBottom;
  const overlapWarning = validBottom ? getDuplicateOverlapWarning?.(shelf.uid, previewBottom) ?? null : null;
  const canConfirmDuplicate = canDuplicate && !overlapWarning;
  previewBottomRef.current = previewBottom;
  const setPreviewBottom = (nextBottom: number, snapIfBlocked = false) => {
    const desired = Math.round(Math.max(0, Math.min(maximumBottom, nextBottom)) * 8) / 8;
    const nearestClear = snapIfBlocked ? getNearestDuplicateClearHeight?.(shelf.uid, desired) : null;
    const resolved = Math.round(Math.max(0, Math.min(maximumBottom, nearestClear ?? desired)) * 8) / 8;
    previewBottomRef.current = resolved;
    setBottomText(String(resolved));
    setSnapNotice(snapIfBlocked && nearestClear != null && Math.abs(resolved - desired) > 0.0001
      ? `Snapped to clear height: ${formatEighthInches(resolved)} from floor.`
      : null);
  };
  const updatePreviewBottomFromPointer = (clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return;
    setPreviewBottom(((rect.bottom - clientY) / rect.height) * ceilingHeight - shelfThickness);
  };
  const movePreviewBottomBy = (deltaIn: number) => setPreviewBottom(previewBottom + deltaIn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] overflow-y-auto sm:max-w-lg" data-testid="floating-shelf-attributes-dialog">
        <DialogHeader>
          <DialogTitle>Floating shelf placement</DialogTitle>
          <DialogDescription>
            Set the shelf bottom height from the finished floor and its installed length. Up to four shelves may share this wall span when their heights do not overlap.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/25 p-3 text-sm">
            <div><span className="block text-xs text-muted-foreground">Catalog shelf</span><strong>{shelf.masterCode}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Shelves on this span</span><strong>{shelvesOnRun} of 4</strong></div>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Bottom height from floor (inches)
            <Input aria-label="Shelf bottom height from floor" inputMode="decimal" step="0.125" min={0} max={maximumBottom} value={bottomText} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { setSnapNotice(null); setBottomText(event.target.value); }} />
            <span className="text-xs font-normal text-muted-foreground">0 to {formatEighthInches(maximumBottom)} in 1/8-inch steps.</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Shelf length (inches)
            <Input aria-label="Shelf length in inches" inputMode="decimal" step="0.125" min={MIN_SHELF_LENGTH_IN} max={maximumLength} value={lengthText} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setLengthText(event.target.value)} />
            <span className="text-xs font-normal text-muted-foreground">{formatEighthInches(MIN_SHELF_LENGTH_IN)} to the catalog maximum of {formatEighthInches(maximumLength)}. The shelf is never enlarged beyond its sellable length.</span>
          </label>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <strong>Duplicate shelf:</strong> uses this shelf’s currently installed length of {formatEighthInches(Number(shelf.width) || maximumLength)} at the bottom height entered above. The original shelf is unchanged.
          </p>
          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3" aria-label="Duplicate shelf placement preview">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">Live duplicate placement preview</div>
              <span className="text-[11px] text-amber-900 dark:text-amber-200">Same wall span · same {formatEighthInches(Number(shelf.width) || maximumLength)} length</span>
            </div>
            <div ref={previewRef} className="relative h-44 overflow-hidden rounded border border-slate-300 bg-white" aria-label={`Wall elevation from floor to ${formatEighthInches(ceilingHeight)}`}>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-500" />
              <span className="absolute bottom-1 left-2 text-[10px] font-medium text-slate-500">Floor 0″</span>
              <span className="absolute right-2 top-1 text-[10px] font-medium text-slate-500">Ceiling {formatEighthInches(ceilingHeight)}</span>
              <div className="absolute left-[14%] right-[14%] h-2 rounded bg-slate-700" style={{ top: `${verticalPercent(originalBottom)}%` }} />
              <span className="absolute left-[14%] text-[10px] font-medium text-slate-700" style={{ top: `calc(${verticalPercent(originalBottom)}% - 17px)` }}>Current shelf · bottom {formatEighthInches(originalBottom)}</span>
              <div
                role="slider"
                tabIndex={0}
                aria-label="Duplicate shelf preview height"
                aria-valuemin={0}
                aria-valuemax={maximumBottom}
                aria-valuenow={previewBottom}
                aria-valuetext={`${formatEighthInches(previewBottom)} from floor`}
                className={`absolute left-[14%] right-[14%] h-3 cursor-ns-resize touch-none rounded border-2 border-dashed shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${overlapWarning ? "border-red-700 bg-red-200/90 focus-visible:ring-red-700" : "border-amber-600 bg-amber-200/80 focus-visible:ring-amber-600"}`}
                style={{ top: `${verticalPercent(previewBottom)}%` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  previewPointerIdRef.current = event.pointerId;
                  setSnapNotice(null);
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  updatePreviewBottomFromPointer(event.clientY);
                }}
                onPointerMove={(event) => {
                  if (previewPointerIdRef.current !== event.pointerId) return;
                  updatePreviewBottomFromPointer(event.clientY);
                }}
                onPointerUp={(event) => {
                  if (previewPointerIdRef.current === event.pointerId) {
                    previewPointerIdRef.current = null;
                    setPreviewBottom(previewBottomRef.current, true);
                  }
                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
                }}
                onPointerCancel={() => { previewPointerIdRef.current = null; }}
                onKeyDown={(event) => {
                  const increment = event.shiftKey ? 1 : 0.125;
                  if (event.key === "ArrowUp" || event.key === "ArrowRight") { event.preventDefault(); movePreviewBottomBy(increment); }
                  if (event.key === "ArrowDown" || event.key === "ArrowLeft") { event.preventDefault(); movePreviewBottomBy(-increment); }
                  if (event.key === "Home") { event.preventDefault(); setPreviewBottom(0); }
                  if (event.key === "End") { event.preventDefault(); setPreviewBottom(maximumBottom); }
                }}
              />
              <span className={`pointer-events-none absolute right-[14%] text-[10px] font-semibold ${overlapWarning ? "text-red-800" : "text-amber-800"}`} style={{ top: `calc(${verticalPercent(previewBottom)}% - 17px)` }}>New duplicate · bottom {formatEighthInches(previewBottom)}</span>
            </div>
            {overlapWarning ? (
              <div role="alert" aria-live="polite" className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                {overlapWarning}
              </div>
            ) : (
              <p className="mt-2 text-[11px] font-medium text-emerald-700">Clear height — the duplicate shelf does not overlap another cabinet or shelf.</p>
            )}
            {snapNotice ? <p role="status" aria-live="polite" className="mt-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">{snapNotice}</p> : null}
            <p className="mt-2 text-[11px] text-slate-700">Drag the dashed shelf up or down to set its bottom height, or use the arrow keys for ⅛-inch steps (Shift + arrow moves 1 inch). On release, an overlapping shelf snaps to the nearest clear height. Up to four shelves may share this wall span at distinct clear heights.</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" onClick={() => { onRemove(shelf.uid); onOpenChange(false); }}>Remove shelf</Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" variant="outline" disabled={!canConfirmDuplicate} onClick={() => onDuplicate(shelf.uid, bottomIn)}>Confirm duplicate shelf</Button>
            <Button type="button" disabled={!valid} onClick={() => { onApply(shelf.uid, bottomIn, lengthIn); onOpenChange(false); }}>Apply shelf placement</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
