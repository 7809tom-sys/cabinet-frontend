import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  MISSING_CATEGORY_LABEL,
  filterForecastMaterials,
  formatVendorCost,
  formatWeightedQuantity,
  materialsToCsv,
  savedRangeForPreset,
  sumForecastMaterials,
  type ForecastFacets,
  type MaterialTotal,
} from "@shared/salesForecast";
import { applyForecastQuery, emptyForecastQuery, optionalNumber, readForecastQuery, type ForecastQueryState } from "@/lib/salesForecastQuery";
import { SalesForecastFilterBar } from "@/components/vendor/SalesForecastFilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Download } from "lucide-react";

type SortKey = "sku" | "quantity" | "weightedQuantity" | "designCount" | "vendorCost";
type VendorRateRow = {
  vendorScope: string;
  closePercent: number | string | null;
  setByName: string | null;
  setAt: string | Date | null;
};

const EMPTY_FACETS: ForecastFacets = { categories: [], doorStyles: [], statuses: [], suppliers: [], missingCategory: false };

function readInitial(): ForecastQueryState {
  return readForecastQuery(new URLSearchParams(window.location.search), "sf");
}

function writeUrl(filters: ForecastQueryState) {
  const next = applyForecastQuery(new URLSearchParams(window.location.search), "sf", filters);
  const url = new URL(window.location.href);
  url.search = next.toString();
  window.history.replaceState({}, "", url.toString());
}

function percentNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function SalesForecastAdmin() {
  const [draft, setDraft] = useState(readInitial);
  const [applied, setApplied] = useState(draft);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "weightedQuantity", dir: "desc" });
  const [designsOpen, setDesignsOpen] = useState(false);
  const [bracketDraft, setBracketDraft] = useState<{ minDays: string; maxDays: string; closePercent: string }[] | null>(null);
  const range = savedRangeForPreset(applied.preset, new Date(), { from: applied.savedFrom, to: applied.savedTo });

  const query = trpc.salesForecast.adminQuery.useQuery({
    query: applied.query.trim() || undefined,
    doorStyles: applied.doorStyles.length ? applied.doorStyles : undefined,
    colors: applied.colors.filter(Boolean).length ? applied.colors.filter(Boolean) : undefined,
    series: applied.series.filter(Boolean).length ? applied.series.filter(Boolean) : undefined,
    categories: applied.categories.length ? applied.categories : undefined,
    supplierScopes: applied.supplierScopes.length ? applied.supplierScopes : undefined,
    savedFrom: range.savedFrom,
    savedTo: range.savedTo,
    statuses: applied.statuses.length ? applied.statuses : undefined,
    customerTypes: applied.customerTypes.filter(Boolean).length ? applied.customerTypes.filter(Boolean) : undefined,
    page: applied.page,
    pageSize: 25,
  });
  const brackets = trpc.salesForecast.brackets.useQuery();
  const saveBrackets = trpc.salesForecast.saveBrackets.useMutation({
    onSuccess: () => {
      toast.success("Close-rate brackets saved");
      void brackets.refetch();
      void query.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const materials = (query.data?.materials ?? []) as MaterialTotal[];
  const rows = useMemo(() => {
    const filtered = filterForecastMaterials(materials, { qtyMin: optionalNumber(applied.qtyMin), qtyMax: optionalNumber(applied.qtyMax) });
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const aMissing = av == null;
      const bMissing = bv == null;
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [materials, applied.qtyMin, applied.qtyMax, sort]);
  const totals = sumForecastMaterials(rows);
  const rates = ((query.data as { vendorRates?: VendorRateRow[] } | undefined)?.vendorRates ?? []);

  const bracketRows = bracketDraft ?? (brackets.data ?? []).map((row) => ({
    minDays: String(row.minDays),
    maxDays: row.maxDays == null ? "" : String(row.maxDays),
    closePercent: String(row.closePercent),
  }));

  function applyFilters(next: ForecastQueryState = { ...draft, page: 0 }) {
    setApplied(next);
    setDraft(next);
    writeUrl(next);
  }

  function downloadCsv() {
    if (!query.data) return;
    const csv = materialsToCsv([
      ...rows,
      ...((query.data.unassigned ?? []) as MaterialTotal[]).map((row) => ({ ...row, supplierName: row.supplierName ?? "Unassigned" })),
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-forecast.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const data = query.data;
  const facets = data?.facets ?? EMPTY_FACETS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sales Forecast</h2>
        <p className="text-sm text-muted-foreground">
          Live takeoff from saved designs. Plan dates use the design&apos;s last save (updatedAt). Weighted quantity uses the percentage entered by that vendor. An empty status filter leaves ordered and lost designs out of the projection and counts them below.
        </p>
      </div>

      <SalesForecastFilterBar
        draft={draft}
        facets={facets}
        showSuppliers
        onChange={setDraft}
        onApply={() => applyFilters()}
        onClear={() => applyFilters(emptyForecastQuery())}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {([
          ["colors", "Colors"],
          ["series", "Series"],
          ["customerTypes", "Customer types"],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <Label className="text-xs">{label}</Label>
            <Input
              value={draft[key].join(", ")}
              placeholder="Comma-separated"
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value.split(",").map((item) => item.trim()) })}
            />
          </div>
        ))}
      </div>

      {query.isLoading ? <Spinner /> : query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Showing <strong>{rows.length}</strong> of <strong>{materials.length}</strong> products.
              {" "}<strong>{data.matched}</strong> of <strong>{data.scanned}</strong> designs match.
              Excluded from the projection: {data.excluded.ordered} ordered, {data.excluded.lost} lost.
              Included: {data.excluded.included}.
              {totals.missingCostRows > 0 ? ` ${totals.missingCostRows} products have no vendor cost on file.` : ""}
            </p>
            <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {([
                    ["sku", "SKU"],
                    ["quantity", "Qty"],
                    ["weightedQuantity", "Weighted qty"],
                    ["designCount", "Designs"],
                    ["vendorCost", "Vendor cost"],
                  ] as const).map(([key, label]) => (
                    <th key={key} className="px-3 py-2 text-left">
                      <button type="button" className="font-medium" onClick={() => setSort({ key, dir: sort.key === key && sort.dir === "desc" ? "asc" : "desc" })}>{label}</button>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left">Product type</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-left">Vendor %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rate = rates.find((item) => item.vendorScope === row.scope);
                  const savedPercent = percentNumber(rate?.closePercent);
                  return (
                    <tr key={`${row.scope}:${row.sku}:${row.color}:${row.styleName}:${row.category}`} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}{row.estimated ? " *" : ""}</td>
                      <td className="px-3 py-2">{row.quantity}</td>
                      <td className="px-3 py-2">{formatWeightedQuantity(row.weightedQuantity)}</td>
                      <td className="px-3 py-2">{row.designCount}</td>
                      <td className="px-3 py-2">{formatVendorCost(row.vendorCost)}</td>
                      <td className="px-3 py-2">{row.categoryMissing ? MISSING_CATEGORY_LABEL : row.category}</td>
                      <td className="px-3 py-2">{row.supplierName ?? row.scope}</td>
                      <td className="px-3 py-2">
                        {savedPercent == null && row.vendorRatePercent == null
                          ? "Not entered"
                          : `${row.vendorRatePercent ?? savedPercent}%`}
                        {rate?.setByName || rate?.setAt ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {rate?.setByName ? `Set by ${rate.setByName}` : "Set"}
                            {rate?.setAt ? ` ${new Date(rate.setAt).toLocaleString()}` : ""}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="px-3 py-2">Filtered totals</td>
                  <td className="px-3 py-2">{totals.quantity}</td>
                  <td className="px-3 py-2">{formatWeightedQuantity(totals.weightedQuantity)}</td>
                  <td className="px-3 py-2">{rows.length}</td>
                  <td className="px-3 py-2">{formatVendorCost(totals.missingCostRows === rows.length && rows.length > 0 ? null : totals.vendorCost)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">* Estimated takeoff. Vendor cost is vendorWholesale. Rows without that cost say &quot;No cost on file&quot; and are not filled in from retail. Unassigned lines are in the CSV and listed below. They are not sent to a vendor.</p>
          {data.unassigned.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Unassigned</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.unassigned.map((row) => <li key={row.sku}>{row.sku} — {row.description} — qty {row.quantity}</li>)}
              </ul>
            </div>
          )}
          <div>
            <Button variant="outline" size="sm" onClick={() => setDesignsOpen((open) => !open)}>
              {designsOpen ? "Hide" : "Show"} matching designs
            </Button>
            {designsOpen && (
              <ul className="mt-3 space-y-1 text-sm">
                {data.designs.map((design) => (
                  <li key={design.id}>
                    <a className="text-primary underline" href={`/design?load=${design.id}`}>{design.name}</a>
                    {" "}— {design.customerName || "No customer"} — {design.styleName} / {design.color} — last saved {new Date(design.updatedAt).toLocaleDateString()} — {design.weight == null ? "Not entered" : `${Math.round(design.weight * 100)}%`}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" disabled={applied.page === 0} onClick={() => applyFilters({ ...applied, page: applied.page - 1 })}>Previous</Button>
              <Button variant="outline" size="sm" disabled={data.designs.length < 25} onClick={() => applyFilters({ ...applied, page: applied.page + 1 })}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Close-rate brackets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">These company brackets are no longer used to weight the forecast. Each vendor enters their own percentage on their Sales Forecast page. The values here are kept for reference only.</p>
          {bracketRows.map((row, index) => (
            <div key={index} className="grid grid-cols-4 gap-2">
              <Input aria-label="Min days" value={row.minDays} onChange={(event) => {
                const next = [...bracketRows];
                next[index] = { ...row, minDays: event.target.value };
                setBracketDraft(next);
              }} />
              <Input aria-label="Max days" placeholder="open" value={row.maxDays} onChange={(event) => {
                const next = [...bracketRows];
                next[index] = { ...row, maxDays: event.target.value };
                setBracketDraft(next);
              }} />
              <Input aria-label="Close percent" value={row.closePercent} onChange={(event) => {
                const next = [...bracketRows];
                next[index] = { ...row, closePercent: event.target.value };
                setBracketDraft(next);
              }} />
              <Button variant="ghost" onClick={() => setBracketDraft(bracketRows.filter((_, item) => item !== index))}>Remove</Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBracketDraft([...bracketRows, { minDays: "0", maxDays: "", closePercent: "50" }])}>Add bracket</Button>
            <Button disabled={saveBrackets.isPending} onClick={() => saveBrackets.mutate({
              brackets: bracketRows.map((row) => ({
                minDays: Number(row.minDays),
                maxDays: row.maxDays.trim() === "" ? null : Number(row.maxDays),
                closePercent: Number(row.closePercent),
              })),
            })}>Save brackets</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
