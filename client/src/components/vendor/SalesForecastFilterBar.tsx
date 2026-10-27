import { MISSING_CATEGORY_FILTER, MISSING_CATEGORY_LABEL, type ForecastFacets, type ForecastTimePreset } from "@shared/salesForecast";
import type { ForecastQueryState } from "@/lib/salesForecastQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRESETS: Array<{ id: ForecastTimePreset; label: string }> = [
  { id: "all", label: "All time" },
  { id: "2m", label: "Last 2 months" },
  { id: "3m", label: "Last 3 months" },
  { id: "custom", label: "Custom range" },
];

function MultiCheck(props: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium">{props.label}</legend>
      {props.options.length === 0 ? (
        <p className="text-xs text-muted-foreground">None in this forecast</p>
      ) : (
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
          {props.options.map((option) => {
            const checked = props.selected.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? props.selected.filter((value) => value !== option.value)
                      : [...props.selected, option.value];
                    props.onChange(next);
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export function SalesForecastFilterBar(props: {
  draft: ForecastQueryState;
  facets: ForecastFacets;
  showSuppliers?: boolean;
  showStatuses?: boolean;
  onChange: (next: ForecastQueryState) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { draft, facets } = props;
  const categories = [
    ...facets.categories.map((category) => ({ value: category, label: category })),
    ...(facets.missingCategory ? [{ value: MISSING_CATEGORY_FILTER, label: MISSING_CATEGORY_LABEL }] : []),
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="forecast-search" className="text-xs">Search SKU, product, or vendor</Label>
            <Input
              id="forecast-search"
              value={draft.query}
              placeholder="Name, SKU, or supplier"
              onChange={(event) => props.onChange({ ...draft, query: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="forecast-qty-min" className="text-xs">Quantity min</Label>
            <Input id="forecast-qty-min" inputMode="decimal" value={draft.qtyMin} onChange={(event) => props.onChange({ ...draft, qtyMin: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="forecast-qty-max" className="text-xs">Quantity max</Label>
            <Input id="forecast-qty-max" inputMode="decimal" value={draft.qtyMax} onChange={(event) => props.onChange({ ...draft, qtyMax: event.target.value })} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">Plan date</p>
          <p className="mb-2 text-xs text-muted-foreground">Uses the design&apos;s last save (updatedAt).</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={draft.preset === preset.id ? "default" : "outline"}
                onClick={() => props.onChange({ ...draft, preset: preset.id })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {draft.preset === "custom" && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="forecast-from" className="text-xs">Saved from</Label>
                <Input id="forecast-from" type="date" value={draft.savedFrom.slice(0, 10)} onChange={(event) => props.onChange({ ...draft, savedFrom: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="forecast-to" className="text-xs">Saved to</Label>
                <Input id="forecast-to" type="date" value={draft.savedTo.slice(0, 10)} onChange={(event) => props.onChange({ ...draft, savedTo: event.target.value })} />
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MultiCheck
            label="Product type"
            options={categories}
            selected={draft.categories}
            onChange={(categories) => props.onChange({ ...draft, categories })}
          />
          <MultiCheck
            label="Door style"
            options={facets.doorStyles.map((style) => ({ value: style, label: style }))}
            selected={draft.doorStyles}
            onChange={(doorStyles) => props.onChange({ ...draft, doorStyles })}
          />
          {props.showStatuses !== false && (
            <MultiCheck
              label="Status"
              options={facets.statuses.map((status) => ({ value: status, label: status }))}
              selected={draft.statuses}
              onChange={(statuses) => props.onChange({ ...draft, statuses })}
            />
          )}
          {props.showSuppliers && (
            <MultiCheck
              label="Vendor"
              options={facets.suppliers.map((supplier) => ({ value: supplier.scope, label: supplier.name }))}
              selected={draft.supplierScopes}
              onChange={(supplierScopes) => props.onChange({ ...draft, supplierScopes })}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={props.onApply}>Apply filters</Button>
          <Button type="button" variant="outline" onClick={props.onClear}>Clear filters</Button>
        </div>
      </CardContent>
    </Card>
  );
}
