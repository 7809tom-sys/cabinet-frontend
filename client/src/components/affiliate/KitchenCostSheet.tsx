import { Input } from "@/components/ui/input";
import type { KitchenCostSheetDescription } from "@shared/kitchenCostSheet";
import "./KitchenCostSheet.css";

export type KitchenCostRow = {
  description: KitchenCostSheetDescription;
  materialQuantity: number;
  materialUnitCost: number;
  laborQuantity: number;
  laborUnitCost: number;
};

const money = (value: number) => `$${value.toFixed(2)}`;

export function KitchenCostSheet({ rows, onChange }: {
  rows: KitchenCostRow[];
  onChange: (index: number, patch: Partial<KitchenCostRow>) => void;
}) {
  return (
    <div className="kitchen-cost-sheet rounded-md border border-border bg-background" data-testid="kitchen-cost-sheet">
      <div className="kitchen-cost-sheet-heading bg-muted/50 text-muted-foreground" aria-hidden="true">
        <span>Description</span><span>Material</span><span>Labor</span>
      </div>
      {rows.map((row, index) => (
        <div className="kitchen-cost-sheet-row" key={row.description} data-testid="kitchen-cost-row">
          <h3 className="kitchen-cost-sheet-description">{row.description}</h3>
          {(["material", "labor"] as const).map((type) => {
            const quantityKey = `${type}Quantity` as const;
            const unitCostKey = `${type}UnitCost` as const;
            const label = type === "material" ? "Material" : "Labor";
            return (
              <div className="kitchen-cost-sheet-costs" key={type} role="group" aria-label={`${row.description} ${type}`}>
                <span className="kitchen-cost-sheet-cost-label text-muted-foreground">{label}</span>
                <label className="kitchen-cost-sheet-field">
                  <span className="text-muted-foreground">Qty</span>
                  <Input type="number" inputMode="numeric" min="0" step="1" value={row[quantityKey]}
                    aria-label={`${row.description} ${type} quantity`}
                    onKeyDown={(event) => { if ([".", ",", "e", "E", "-", "+"].includes(event.key)) event.preventDefault(); }}
                    onBlur={(event) => { event.currentTarget.value = String(row[quantityKey]); }}
                    onChange={(event) => {
                      const quantity = Math.max(0, Math.trunc(Number(event.target.value) || 0));
                      if (event.target.value && Number(event.target.value) !== quantity) event.target.value = String(quantity);
                      onChange(index, { [quantityKey]: quantity });
                    }} />
                </label>
                <label className="kitchen-cost-sheet-field">
                  <span className="text-muted-foreground">Price / unit</span>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" value={row[unitCostKey]}
                    aria-label={`${row.description} ${type} price per unit`}
                    onChange={(event) => onChange(index, { [unitCostKey]: Number(event.target.value) || 0 })} />
                </label>
                <div className="kitchen-cost-sheet-field kitchen-cost-sheet-total">
                  <span className="text-muted-foreground">Total</span>
                  <output aria-label={`${row.description} ${type} total`} className="tabular-nums">
                    {money(row[quantityKey] * row[unitCostKey])}
                  </output>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
