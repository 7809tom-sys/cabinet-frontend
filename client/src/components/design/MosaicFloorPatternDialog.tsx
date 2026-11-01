import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MOSAIC_FLOOR_PATTERNS,
  mosaicFloorPatternDegrees,
  mosaicFloorPatternOrStraight,
  type MosaicFloorPattern,
} from "@/lib/mosaicFloorTile";
import type { SelectedSurface } from "./SurfacesPickerDialog";

export function MosaicFloorPatternControl({
  value,
  onChange,
  testId = "mosaic-floor-pattern",
}: {
  value: MosaicFloorPattern | null | undefined;
  onChange?: (pattern: MosaicFloorPattern) => void;
  testId?: string;
}) {
  const selected = mosaicFloorPatternOrStraight(value);
  return (
    <div data-testid={testId} className="space-y-2" role="group" aria-label="Mosaic floor pattern">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mosaic floor pattern</p>
        <p className="text-[11px] leading-snug text-muted-foreground">Straight (90°) is the default. Diagonal turns the sheet 45° and keeps one continuous mosaic, with no sheet seams.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MOSAIC_FLOOR_PATTERNS.map((pattern) => {
          const pressed = selected === pattern.id;
          return (
            <button
              key={pattern.id}
              type="button"
              data-testid={`${testId}-${pattern.id}`}
              aria-pressed={pressed}
              disabled={!onChange}
              onClick={() => onChange?.(pattern.id)}
              className={`h-8 rounded-md border px-2.5 text-[11px] font-semibold ${pressed ? "border-[#a87f33] bg-[#a87f33]/10 text-[#1a2744]" : "border-border bg-background text-[#1a2744] hover:bg-muted"}`}
            >
              {pattern.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MosaicFloorPatternDialog({
  floor,
  pattern,
  onChange,
  onOpenChange,
}: {
  floor: SelectedSurface | null;
  pattern: MosaicFloorPattern | null | undefined;
  onChange: (pattern: MosaicFloorPattern) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = mosaicFloorPatternOrStraight(pattern);
  return (
    <Dialog open={floor != null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="mosaic-floor-pattern-dialog" className="w-[min(94vw,480px)] max-w-[480px]">
        <DialogHeader>
          <DialogTitle>How should this mosaic be laid on the floor?</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {floor?.name ?? "This mosaic"} stays available as a wall backsplash. For this room&apos;s floor, choose a pattern. Straight (90°) is already selected. The sheet stays one continuous mosaic either way.
          </DialogDescription>
        </DialogHeader>
        <MosaicFloorPatternControl value={selected} onChange={onChange} testId="mosaic-floor-pattern-dialog-options" />
        <p className="text-[11px] text-muted-foreground" data-testid="mosaic-floor-pattern-degrees">
          {mosaicFloorPatternDegrees(selected) === 45
            ? "Diagonal (45°) rotates the sheet texture 45°."
            : "Straight (90°) keeps the sheet square to the walls."}
        </p>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Use this pattern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
