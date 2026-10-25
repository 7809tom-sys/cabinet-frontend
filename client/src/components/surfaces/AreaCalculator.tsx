import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/pelican";
import { computeBoxes } from "@/lib/surfaceSelection";
import { Package } from "lucide-react";

export function AreaCalculator({
  label,
  areaSqft,
  sqftPerBox,
  wastePct,
  pricePerBox,
  onChange,
}: {
  label: string;
  areaSqft: number | null;
  sqftPerBox: number;
  wastePct: number;
  pricePerBox: number | null;
  onChange: (next: { areaSqft: number | null; sqftPerBox: number; wastePct: number }) => void;
}) {
  const boxes = computeBoxes(areaSqft, sqftPerBox, wastePct);
  const materialCost = boxes != null && pricePerBox != null ? boxes * pricePerBox : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4 text-[var(--color-gold)]" /> {label} coverage
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Area to cover (sq ft)</Label>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            value={areaSqft ?? ""}
            onChange={(e) =>
              onChange({
                areaSqft: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                sqftPerBox,
                wastePct,
              })
            }
            placeholder="e.g. 180"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sq ft per box</Label>
          <Input
            type="number"
            min={0.1}
            step={0.1}
            inputMode="decimal"
            value={sqftPerBox}
            onChange={(e) =>
              onChange({
                areaSqft,
                sqftPerBox: Math.max(0.1, Number(e.target.value) || 0.1),
                wastePct,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Waste %</Label>
          <Input
            type="number"
            min={0}
            max={50}
            step={1}
            inputMode="numeric"
            value={Math.round(wastePct * 100)}
            onChange={(e) =>
              onChange({
                areaSqft,
                sqftPerBox,
                wastePct: Math.min(0.5, Math.max(0, (Number(e.target.value) || 0) / 100)),
              })
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Boxes needed:{" "}
          <span className="font-bold text-foreground">{boxes ?? "—"}</span>
        </span>
        {materialCost != null && (
          <span className="text-muted-foreground">
            Est. material:{" "}
            <span className="font-bold text-[var(--color-navy)] dark:text-foreground">
              {formatPrice(materialCost)}
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Boxes = ceil(area × (1 + waste) ÷ sq ft per box). Adjust the per-box coverage to match the
        product spec — final quantities are confirmed at order.
      </p>
    </div>
  );
}
