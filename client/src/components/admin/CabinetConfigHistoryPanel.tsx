import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { History, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const when = (d: Date | string) => new Date(d).toLocaleString();

/**
 * Cabinet configuration history for the last few days.
 * Shows every field an admin actually changed (old → new), whether it was a
 * master-row save or a single distributor's rule, who did it, and lets an
 * admin revert one change inside the revert window. Saves recorded before
 * the per-field log existed are listed as "saved" rows so real activity is
 * never hidden.
 */
export function CabinetConfigHistoryPanel({ cabinetId }: { cabinetId?: number }) {
  const [open, setOpen] = useState(true);
  const [showSaves, setShowSaves] = useState(true);
  const utils = trpc.useUtils();
  const history = trpc.cabinetOverrides.configHistory.useQuery(
    cabinetId ? { cabinetId } : undefined,
    { staleTime: 15_000 },
  );
  const revert = trpc.cabinetOverrides.revertConfigChange.useMutation({
    onSuccess: (r) => {
      toast.success(`Reverted ${r.field} to ${fmt(r.restored)}`);
      utils.cabinetOverrides.configHistory.invalidate();
      utils.cabinets.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const data = history.data;
  const changes = data?.changes ?? [];
  const saves = data?.saves ?? [];
  const days = data?.days ?? 5;
  const cabinetCount = new Set([...changes.map((c) => c.cabinetId), ...saves.map((s) => s.cabinetId)]).size;

  return (
    <div className="rounded-lg border border-border bg-muted/20" data-testid="cabinet-config-history">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Configuration history · last {days} days
          {data && (
            <Badge variant="secondary" className="text-[10px]">
              {cabinetCount} cabinet{cabinetCount === 1 ? "" : "s"} · {changes.length} field change{changes.length === 1 ? "" : "s"} · {saves.length} earlier save{saves.length === 1 ? "" : "s"}
            </Badge>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {history.isLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : changes.length === 0 && saves.length === 0 ? (
            <p className="text-xs text-muted-foreground">No configuration saves in the last {days} days.</p>
          ) : (
            <>
              {changes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left py-1 pr-2 font-medium">When</th>
                        <th className="text-left py-1 pr-2 font-medium">Cabinet</th>
                        <th className="text-left py-1 pr-2 font-medium">Scope</th>
                        <th className="text-left py-1 pr-2 font-medium">Field</th>
                        <th className="text-left py-1 pr-2 font-medium">Before</th>
                        <th className="text-left py-1 pr-2 font-medium">After</th>
                        <th className="text-left py-1 pr-2 font-medium">By</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.id} className={`border-b border-border/60 ${c.revertedAt ? "opacity-50" : ""}`}>
                          <td className="py-1 pr-2 whitespace-nowrap">{when(c.createdAt)}</td>
                          <td className="py-1 pr-2 font-mono">{c.masterCode}</td>
                          <td className="py-1 pr-2">
                            {c.scope === "master" ? (
                              <Badge variant="outline" className="text-[10px]">Master</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">{c.distributorName ?? `Distributor ${c.distributorId}`}</Badge>
                            )}
                          </td>
                          <td className="py-1 pr-2 font-mono">{c.field}</td>
                          <td className="py-1 pr-2 max-w-[180px] truncate" title={fmt(c.oldValue)}>{fmt(c.oldValue)}</td>
                          <td className="py-1 pr-2 max-w-[180px] truncate font-medium" title={fmt(c.newValue)}>{fmt(c.newValue)}</td>
                          <td className="py-1 pr-2">{c.changedByName ?? "—"}</td>
                          <td className="py-1 text-right">
                            {c.revertedAt ? (
                              <span className="text-muted-foreground">reverted</span>
                            ) : c.canRevert ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 gap-1"
                                disabled={revert.isPending}
                                onClick={() => revert.mutate({ id: c.id })}
                                title="Put the previous value back for this scope only"
                              >
                                <RotateCcw className="h-3 w-3" /> Revert
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {saves.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setShowSaves((v) => !v)}
                  >
                    {showSaves ? "Hide" : "Show"} {saves.length} earlier save{saves.length === 1 ? "" : "s"} (field-level details were not recorded before the change log existed)
                  </button>
                  {showSaves && (
                    <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto text-xs">
                      {saves.map((s, i) => (
                        <li key={`${s.scope}-${s.cabinetId}-${s.distributorId ?? "m"}-${i}`} className="flex flex-wrap gap-x-2">
                          <span className="whitespace-nowrap">{when(s.at)}</span>
                          <span className="font-mono">{s.masterCode}</span>
                          <span>{s.scope === "master" ? "master row saved" : `${s.distributorName ?? `Distributor ${s.distributorId}`} rule saved`}</span>
                          {s.byName && <span className="text-muted-foreground">by {s.byName}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
