import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { materialsToCsv } from "@shared/salesForecast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Download } from "lucide-react";

type SortKey = "sku" | "quantity" | "weightedQuantity" | "designCount" | "retailValue";

function listParam(value: string): string[] | undefined {
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function readInitial() {
  const params = new URLSearchParams(window.location.search);
  return {
    doorStyles: params.get("sfStyle") ?? "",
    colors: params.get("sfColor") ?? "",
    series: params.get("sfSeries") ?? "",
    supplierScopes: params.get("sfSupplier") ?? "",
    savedFrom: params.get("sfFrom") ?? "",
    savedTo: params.get("sfTo") ?? "",
    statuses: params.get("sfStatus") ?? "",
    customerTypes: params.get("sfRole") ?? "",
    page: Number(params.get("sfPage") ?? "0") || 0,
  };
}

function writeUrl(filters: ReturnType<typeof readInitial>) {
  const url = new URL(window.location.href);
  const set = (key: string, value: string) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  };
  set("sfStyle", filters.doorStyles);
  set("sfColor", filters.colors);
  set("sfSeries", filters.series);
  set("sfSupplier", filters.supplierScopes);
  set("sfFrom", filters.savedFrom);
  set("sfTo", filters.savedTo);
  set("sfStatus", filters.statuses);
  set("sfRole", filters.customerTypes);
  if (filters.page > 0) url.searchParams.set("sfPage", String(filters.page));
  else url.searchParams.delete("sfPage");
  window.history.replaceState({}, "", url.toString());
}

export default function SalesForecastAdmin() {
  const [draft, setDraft] = useState(readInitial);
  const [applied, setApplied] = useState(draft);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "weightedQuantity", dir: "desc" });
  const [designsOpen, setDesignsOpen] = useState(false);
  const [bracketDraft, setBracketDraft] = useState<{ minDays: string; maxDays: string; closePercent: string }[] | null>(null);

  const query = trpc.salesForecast.adminQuery.useQuery({
    doorStyles: listParam(applied.doorStyles),
    colors: listParam(applied.colors),
    series: listParam(applied.series),
    supplierScopes: listParam(applied.supplierScopes),
    savedFrom: applied.savedFrom || null,
    savedTo: applied.savedTo || null,
    statuses: listParam(applied.statuses),
    customerTypes: listParam(applied.customerTypes),
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

  const rows = useMemo(() => {
    const materials = query.data?.materials ?? [];
    const copy = [...materials];
    copy.sort((a, b) => {
      const av = a[sort.key] ?? 0;
      const bv = b[sort.key] ?? 0;
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [query.data?.materials, sort]);

  const bracketRows = bracketDraft ?? (brackets.data ?? []).map((row) => ({
    minDays: String(row.minDays),
    maxDays: row.maxDays == null ? "" : String(row.maxDays),
    closePercent: String(row.closePercent),
  }));

  function applyFilters(next = draft) {
    const pageReset = { ...next, page: next === draft ? 0 : next.page };
    setApplied(pageReset);
    setDraft(pageReset);
    writeUrl(pageReset);
  }

  function downloadCsv() {
    if (!query.data) return;
    const csv = materialsToCsv([
      ...query.data.materials,
      ...query.data.unassigned.map((row) => ({ ...row, supplierName: row.supplierName ?? "Unassigned" })),
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sales Forecast</h2>
        <p className="text-sm text-muted-foreground">
          Live takeoff from saved designs. Age is days since the design was last saved. An empty status filter leaves ordered and lost designs out of the projection and counts them below. Close-rate percents are placeholders until you edit them.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {([
            ["doorStyles", "Door styles"],
            ["colors", "Colors"],
            ["series", "Series"],
            ["supplierScopes", "Suppliers (dist:id or pelican)"],
            ["statuses", "Statuses"],
            ["customerTypes", "Customer types"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input value={draft[key]} placeholder="Comma-separated" onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            </div>
          ))}
          <div>
            <Label className="text-xs">Saved from</Label>
            <Input type="date" value={draft.savedFrom} onChange={(event) => setDraft({ ...draft, savedFrom: event.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Saved to</Label>
            <Input type="date" value={draft.savedTo} onChange={(event) => setDraft({ ...draft, savedTo: event.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => applyFilters()}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? <Spinner /> : query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{data.matched}</strong> of <strong>{data.scanned}</strong> designs match.
              Excluded from the projection: {data.excluded.ordered} ordered, {data.excluded.lost} lost.
              Included: {data.excluded.included}.
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
                    ["retailValue", "Retail"],
                  ] as const).map(([key, label]) => (
                    <th key={key} className="px-3 py-2 text-left">
                      <button type="button" className="font-medium" onClick={() => setSort({ key, dir: sort.key === key && sort.dir === "desc" ? "asc" : "desc" })}>{label}</button>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.scope}:${row.sku}:${row.color}`} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{row.sku}{row.estimated ? " *" : ""}</td>
                    <td className="px-3 py-2">{row.quantity}</td>
                    <td className="px-3 py-2">{row.weightedQuantity}</td>
                    <td className="px-3 py-2">{row.designCount}</td>
                    <td className="px-3 py-2">{row.retailValue == null ? "—" : `$${row.retailValue.toFixed(2)}`}</td>
                    <td className="px-3 py-2">{row.supplierName ?? row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">* Estimated takeoff. Unassigned lines are in the CSV and listed below. They are not sent to a vendor.</p>
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
                    {" "}— {design.customerName || "No customer"} — {design.styleName} / {design.color} — {new Date(design.updatedAt).toLocaleDateString()} — {Math.round(design.weight * 100)}%
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
          <p className="text-sm text-muted-foreground">Placeholder defaults until you save your own. Day 90 stays in 61–90. The open-ended band starts at day 91. Rates are 0–100 and bands cannot overlap. Age uses the design&apos;s last save.</p>
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
