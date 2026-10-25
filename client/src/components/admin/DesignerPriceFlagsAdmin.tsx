import { useState } from "react";
import { toast } from "sonner";
import { TriangleAlert, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

/**
 * Admin list of every Designer missing-price hit (Part 1 §3): code, store,
 * distributor line, style, design, how many times it was hit, and whether a
 * priced same-family alternative existed. Resolving a row only hides it here;
 * the catalog fix itself happens in Cabinet Config / price import.
 */
export default function DesignerPriceFlagsAdmin() {
  const [includeResolved, setIncludeResolved] = useState(false);
  const utils = trpc.useUtils();
  const list = trpc.designMissingPrice.adminList.useQuery({ includeResolved, limit: 300 });
  const equivalences = trpc.designMissingPrice.adminEquivalences.useQuery();
  const resolve = trpc.designMissingPrice.adminResolve.useMutation({
    onSuccess: () => { void utils.designMissingPrice.adminList.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const rows = list.data?.rows ?? [];
  return (
    <div className="space-y-6" data-testid="designer-price-flags-admin">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="h-5 w-5 text-red-600" /> Designer price flags
            {list.data && <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{list.data.openCount} open</span>}
          </CardTitle>
          <CardDescription>
            Every time a placed cabinet had no price on the active store/distributor line, the Designer logged it here (after trying its two-way alias group). Fix the price in Cabinet Config or the price import, then mark the row resolved.
          </CardDescription>
          <div className="pt-2">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} /> Show resolved rows
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No missing-price hits logged.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted text-left">
                  <tr>
                    {["Code", "Store", "Distributor line", "Style", "Design", "Codes tried", "Alt. available", "Hits", "First seen", "Last seen", ""].map((h) => (
                      <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={`border-b ${row.resolvedAt ? "text-muted-foreground" : ""}`}>
                      <td className="px-2 py-1.5 font-mono font-bold">{row.masterCode}</td>
                      <td className="px-2 py-1.5">{row.storeScope}</td>
                      <td className="px-2 py-1.5">{row.distributorName ?? (row.distributorId ? `#${row.distributorId}` : "—")}</td>
                      <td className="px-2 py-1.5">{row.styleId ?? "—"}</td>
                      <td className="px-2 py-1.5">{row.designId ?? "unsaved"}</td>
                      <td className="px-2 py-1.5 font-mono">{Array.isArray(row.triedCodes) ? (row.triedCodes as string[]).join(", ") : "—"}</td>
                      <td className="px-2 py-1.5">{row.alternativeAvailable == null ? "—" : row.alternativeAvailable ? "yes" : "no — catalog fix needed"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{row.hitCount}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{row.firstSeenAt ? new Date(row.firstSeenAt).toLocaleString() : "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.resolvedAt ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => resolve.mutate({ id: row.id, resolved: false })}><RotateCcw className="h-3 w-3" /> Reopen</Button>
                        ) : (
                          <Button size="sm" className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700" onClick={() => resolve.mutate({ id: row.id, resolved: true })}><CheckCircle2 className="h-3 w-3" /> Resolved</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-way code equivalence groups</CardTitle>
          <CardDescription>
            Codes in one group are the same cabinet under different distributor nomenclature (e.g. ERB36 ↔ BER36). The Designer resolves any member to whichever code the active line prices. Groups are built from Master SKU Aliases, cabinet aliases, and the explicit equivalence table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {equivalences.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {(equivalences.data?.groups ?? []).map((group) => (
                <li key={group.join("|")} className="rounded border bg-muted/40 px-2 py-1 font-mono">{group.join(" ↔ ")}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
