import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  MISSING_CATEGORY_LABEL,
  filterForecastMaterials,
  forecastProductEditTarget,
  formatVendorCost,
  formatWeightedQuantity,
  materialsToCsv,
  savedRangeForPreset,
  sumForecastMaterials,
  validateVendorForecastPercent,
  type ForecastFacets,
  type MaterialTotal,
} from "@shared/salesForecast";
import { applyForecastQuery, emptyForecastQuery, optionalNumber, readForecastQuery, type ForecastQueryState } from "@/lib/salesForecastQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { SalesForecastFilterBar } from "./SalesForecastFilterBar";
import { usePortalScopes } from "./usePortalScopes";

type VendorRateRow = {
  vendorScope: string;
  closePercent: number | string | null;
  setByName: string | null;
  setAt: string | Date | null;
};

const EMPTY_FACETS: ForecastFacets = { categories: [], doorStyles: [], statuses: [], suppliers: [], missingCategory: false };

function readInitial(): ForecastQueryState {
  return readForecastQuery(new URLSearchParams(window.location.search), "vf");
}

function writeUrl(state: ForecastQueryState) {
  const next = applyForecastQuery(new URLSearchParams(window.location.search), "vf", state);
  const url = new URL(window.location.href);
  url.search = next.toString();
  window.history.replaceState({}, "", url.toString());
}

function productHref(row: MaterialTotal): string | null {
  const target = forecastProductEditTarget(row);
  if (!target) return null;
  const params = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  next.set("section", target.section);
  if (target.edit != null) next.set("edit", String(target.edit));
  if (target.sku) next.set("sku", target.sku);
  for (const key of ["as", "vendor"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return `/vendor?${next.toString()}`;
}

function percentNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function VendorSalesForecast(props: { distributorId?: number; approvedVendorLineId?: number }) {
  const { user } = useAuth();
  const portal = usePortalScopes(props);
  const [draft, setDraft] = useState(readInitial);
  const [applied, setApplied] = useState(draft);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();
  const range = savedRangeForPreset(applied.preset, new Date(), { from: applied.savedFrom, to: applied.savedTo });
  const query = trpc.salesForecast.vendorQuery.useQuery({
    distributorId: props.distributorId,
    approvedVendorLineId: props.approvedVendorLineId,
    query: applied.query.trim() || undefined,
    categories: applied.categories.length ? applied.categories : undefined,
    doorStyles: applied.doorStyles.length ? applied.doorStyles : undefined,
    statuses: applied.statuses.length ? applied.statuses : undefined,
    savedFrom: range.savedFrom,
    savedTo: range.savedTo,
    page: applied.page,
    pageSize: 25,
  });
  const saveRate = trpc.salesForecast.setVendorRate.useMutation({
    onSuccess: () => {
      toast.success("Forecast percentage saved");
      void query.refetch();
      void utils.salesForecast.vendorQuery.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const data = query.data;
  const materials = (data?.materials ?? []) as MaterialTotal[];
  const visible = useMemo(
    () => filterForecastMaterials(materials, { qtyMin: optionalNumber(applied.qtyMin), qtyMax: optionalNumber(applied.qtyMax) }),
    [materials, applied.qtyMin, applied.qtyMax],
  );
  const totals = sumForecastMaterials(visible);
  const rates = ((data as { vendorRates?: VendorRateRow[] } | undefined)?.vendorRates ?? []);
  const canEditRate = user?.role === "distributor";

  function applyFilters(next: ForecastQueryState = { ...draft, page: 0 }) {
    setDraft(next);
    setApplied(next);
    writeUrl(next);
  }

  function download() {
    const csv = materialsToCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vendor-sales-forecast.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function savePercent(scope: string) {
    const raw = (rateDrafts[scope] ?? "").trim();
    const percent = raw === "" ? null : Number(raw);
    const problem = validateVendorForecastPercent(percent);
    if (problem) {
      toast.error(problem);
      return;
    }
    saveRate.mutate({ scope, percent });
  }

  if ((portal.isLoading || query.isLoading) && !data) return <Spinner />;
  if (query.error && !data) return <p className="text-sm text-destructive">{query.error.message}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Forecast is unavailable.</p>;

  const facets = data.facets ?? EMPTY_FACETS;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Sales Forecast</h2>
          <p className="text-sm text-muted-foreground">
            Your products only, computed from saved designs when you open this page. Weighted quantity is quantity times the forecast percentage you enter. Customer names and other vendors&apos; items are not included. Estimated lines are marked.
          </p>
        </div>
        <Button variant="outline" onClick={download}>CSV</Button>
      </div>

      <SalesForecastFilterBar
        draft={draft}
        facets={facets}
        showSuppliers={false}
        onChange={setDraft}
        onApply={() => applyFilters()}
        onClear={() => applyFilters(emptyForecastQuery())}
      />

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <h3 className="text-sm font-semibold">Your forecast percentage</h3>
          <p className="text-xs text-muted-foreground">
            Enter 0–100 for your own lines. Weighted stays blank until you save one. Company close-rate brackets are not used.
          </p>
        </div>
        {(portal.scopes.length ? portal.scopes : rates.map((rate) => ({ scope: rate.vendorScope, label: rate.vendorScope }))).map((scope) => {
          const saved = rates.find((rate) => rate.vendorScope === scope.scope);
          const savedPercent = percentNumber(saved?.closePercent);
          const draftValue = rateDrafts[scope.scope] ?? (savedPercent == null ? "" : String(savedPercent));
          return (
            <div key={scope.scope} className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor={`vendor-rate-${scope.scope}`} className="text-xs">{scope.label}</Label>
                {canEditRate ? (
                  <Input
                    id={`vendor-rate-${scope.scope}`}
                    inputMode="decimal"
                    className="w-28"
                    placeholder="Not entered"
                    value={draftValue}
                    onChange={(event) => setRateDrafts((current) => ({ ...current, [scope.scope]: event.target.value }))}
                  />
                ) : (
                  <p className="text-sm">{savedPercent == null ? "Not entered" : `${savedPercent}%`}</p>
                )}
              </div>
              {canEditRate && (
                <Button type="button" size="sm" disabled={saveRate.isPending} onClick={() => savePercent(scope.scope)}>Save percentage</Button>
              )}
              <p className="text-xs text-muted-foreground">
                {savedPercent == null
                  ? "Not entered"
                  : `Set${saved?.setByName ? ` by ${saved.setByName}` : ""}${saved?.setAt ? ` on ${new Date(saved.setAt).toLocaleString()}` : ""}`}
              </p>
            </div>
          );
        })}
        {portal.scopes.length === 0 && rates.length === 0 && <p className="text-sm text-muted-foreground">Not entered</p>}
      </div>

      <p className="text-sm">
        Showing <strong>{visible.length}</strong> of <strong>{materials.length}</strong> products.
        {" "}<strong>{data.matched}</strong> designs include your products after these filters.
        {totals.missingCostRows > 0 ? ` ${totals.missingCostRows} products have no cost on file.` : ""}
        {totals.missingRateRows > 0 ? ` ${totals.missingRateRows} products have no forecast percentage.` : ""}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-left">Description</th>
              <th className="px-2 py-1 text-left">Product type</th>
              <th className="px-2 py-1 text-left">Qty</th>
              <th className="px-2 py-1 text-left">Forecast %</th>
              <th className="px-2 py-1 text-left">Weighted</th>
              <th className="px-2 py-1 text-left">Designs</th>
              <th className="px-2 py-1 text-left">Vendor cost</th>
              <th className="px-2 py-1 text-left">Weighted vendor cost</th>
              <th className="px-2 py-1 text-left">Product</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = productHref(row);
              return (
                <tr key={`${row.scope}:${row.sku}:${row.color}:${row.styleName}:${row.category}`} className="border-t">
                  <td className="px-2 py-1 font-mono text-xs">{row.sku}{row.estimated ? " *" : ""}</td>
                  <td className="px-2 py-1">{row.description}</td>
                  <td className="px-2 py-1">{row.categoryMissing ? MISSING_CATEGORY_LABEL : row.category}</td>
                  <td className="px-2 py-1">{row.quantity}</td>
                  <td className="px-2 py-1">{row.vendorRatePercent == null ? "Not entered" : `${row.vendorRatePercent}%`}</td>
                  <td className="px-2 py-1">{formatWeightedQuantity(row.weightedQuantity)}</td>
                  <td className="px-2 py-1">{row.designCount}</td>
                  <td className="px-2 py-1">{formatVendorCost(row.vendorCost)}</td>
                  <td className="px-2 py-1">{row.weightedVendorCost == null ? "Not entered" : formatVendorCost(row.weightedVendorCost)}</td>
                  <td className="px-2 py-1">
                    {href ? <a className="text-primary underline" href={href}>Edit product</a> : <span className="text-muted-foreground">No linked product</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr>
              <td className="px-2 py-1" colSpan={3}>Filtered totals</td>
              <td className="px-2 py-1">{totals.quantity}</td>
              <td className="px-2 py-1" />
              <td className="px-2 py-1">{formatWeightedQuantity(totals.weightedQuantity)}</td>
              <td className="px-2 py-1">{visible.length}</td>
              <td className="px-2 py-1">{formatVendorCost(totals.missingCostRows === visible.length && visible.length > 0 ? null : totals.vendorCost)}</td>
              <td className="px-2 py-1">{totals.weightedVendorCost == null ? "Not entered" : formatVendorCost(totals.weightedVendorCost)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Plans</h3>
        <p className="mb-2 text-xs text-muted-foreground">Filtered by the design&apos;s last save (updatedAt). Customer names are hidden.</p>
        <ul className="space-y-1 text-sm">
          {data.designs.map((design) => (
            <li key={design.id}>
              {design.name} — {design.styleName} / {design.color} — last saved {new Date(design.updatedAt).toLocaleDateString()} — {design.weight == null ? "Not entered" : `${Math.round(design.weight * 100)}%`}
            </li>
          ))}
          {data.designs.length === 0 && <li className="text-muted-foreground">No plans match these filters.</li>}
        </ul>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" disabled={applied.page === 0} onClick={() => applyFilters({ ...applied, page: applied.page - 1 })}>Previous</Button>
          <Button variant="outline" size="sm" disabled={data.designs.length < 25} onClick={() => applyFilters({ ...applied, page: applied.page + 1 })}>Next</Button>
        </div>
      </div>
    </div>
  );
}
