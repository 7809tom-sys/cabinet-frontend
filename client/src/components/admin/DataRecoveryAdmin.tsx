import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CabinetConfigHistoryPanel } from "@/components/admin/CabinetConfigHistoryPanel";
import { DatabaseBackup, ImageIcon, RotateCcw, Save, ShieldCheck, History, AlertTriangle } from "lucide-react";

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const when = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");

/**
 * Admin → Data Recovery.
 * One place to see every cabinet edited recently, what trace of that edit still
 * exists in the database, and to put it back: revert or replay logged field
 * changes, restore a whole cabinet from a snapshot, re-attach an image that was
 * uploaded but never saved onto the cabinet, and protect cabinets with manual
 * snapshots so the next problem is fully recoverable. Prices are never touched.
 */
export function DataRecoveryAdmin() {
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [openCabinetId, setOpenCabinetId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const scan = trpc.cabinetRecovery.scan.useQuery({ days }, { staleTime: 15_000 });

  const invalidateAll = () => {
    utils.cabinetRecovery.invalidate();
    utils.cabinetOverrides.configHistory.invalidate();
    utils.cabinets.invalidate();
  };

  const snapshotMany = trpc.cabinetRecovery.snapshotMany.useMutation({
    onSuccess: (r) => { toast.success(`Protected ${r.snapshots} cabinet${r.snapshots === 1 ? "" : "s"} with a snapshot`); invalidateAll(); },
    onError: (e) => toast.error(e.message),
  });
  const restoreImage = trpc.cabinetRecovery.restoreImage.useMutation({
    onSuccess: () => { toast.success("Image restored onto the cabinet"); invalidateAll(); },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = scan.data?.cabinets ?? [];
    const q = filter.trim().toUpperCase();
    return list.filter((c) => {
      if (q && !c.masterCode.toUpperCase().includes(q) && !(c.description ?? "").toUpperCase().includes(q)) return false;
      if (onlyProblems && !c.detailsLost && !c.imageCandidates.some((i) => !i.isCurrent)) return false;
      return true;
    });
  }, [scan.data, filter, onlyProblems]);

  const totals = scan.data?.totals;

  return (
    <div className="space-y-4" data-testid="data-recovery-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><DatabaseBackup className="h-5 w-5" /> Data Recovery</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Every cabinet edited in the chosen window, with everything the database still holds about that edit.
            Restore a field, a whole cabinet, or an uploaded image with one click. Every restore is logged and can itself be undone.
            Prices are never changed here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[150px]" data-testid="data-recovery-days"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Last 5 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-1"
            disabled={snapshotMany.isPending || rows.length === 0}
            onClick={() => snapshotMany.mutate({ cabinetIds: rows.map((r) => r.cabinetId) })}
            title="Store a full copy of every listed cabinet right now so it can be restored later"
            data-testid="data-recovery-protect-all"
          >
            <ShieldCheck className="h-4 w-4" /> Protect {rows.length} listed
          </Button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs" data-testid="data-recovery-totals">
          <Stat label="Cabinets edited" value={totals.cabinets} />
          <Stat label="With field history" value={totals.withLoggedChanges} />
          <Stat label="With distributor rules" value={totals.withDistributorRules} />
          <Stat label="With snapshots" value={totals.withSnapshots} />
          <Stat label="Images not attached" value={totals.withUnattachedImages} tone={totals.withUnattachedImages ? "warn" : undefined} />
          <Stat label="Details not recorded" value={totals.detailsLost} tone={totals.detailsLost ? "warn" : undefined} />
        </div>
      )}

      <div className="rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <b>What can and cannot be recovered.</b> Field-by-field history started on Sep 30, 2026 and now covers every admin edit surface, with a full
          snapshot taken before each save. Saves made before that only left a “saved on” timestamp, so their exact previous values cannot be rebuilt
          (they are marked <i>Details not recorded</i>). Images uploaded to the Media Library but never saved onto a cabinet are still in storage and can be re-attached below.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Filter by code or description…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" data-testid="data-recovery-filter" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyProblems} onCheckedChange={(v) => setOnlyProblems(v === true)} /> Only cabinets needing attention
        </label>
        <span className="text-xs text-muted-foreground">{rows.length} shown</span>
      </div>

      {scan.isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No cabinet edits found in the last {days} days.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs" data-testid="data-recovery-table">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2 font-medium">Cabinet</th>
                <th className="text-left p-2 font-medium">Last activity</th>
                <th className="text-left p-2 font-medium">What survived</th>
                <th className="text-left p-2 font-medium">Image</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const newestUnattached = c.imageCandidates.find((i) => !i.isCurrent);
                return (
                  <tr key={c.cabinetId} className="border-t border-border/60 align-top">
                    <td className="p-2">
                      <div className="font-mono font-medium">{c.masterCode}</div>
                      <div className="text-muted-foreground max-w-[260px] truncate" title={c.description ?? ""}>{c.description ?? "—"}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">{when(c.lastActivityAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {c.signals.map((s) => (
                          <Badge key={s} variant={s.startsWith("saved (details") || s.includes("not attached") ? "destructive" : "secondary"} className="text-[10px] font-normal">{s}</Badge>
                        ))}
                        {c.distributorRules.map((r) => (
                          <Badge key={`d-${r.distributorId}`} variant="outline" className="text-[10px] font-normal" title={r.fields.join(", ")}>
                            {r.distributorName ?? `Distributor ${r.distributorId}`}{r.fields.length ? ` · ${r.fields.length} field${r.fields.length === 1 ? "" : "s"}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">
                      {newestUnattached ? (
                        <div className="flex items-center gap-2">
                          <img src={newestUnattached.url} alt="" className="h-10 w-10 rounded object-contain bg-white border" />
                          <div>
                            <div className="text-muted-foreground">Uploaded {when(newestUnattached.uploadedAt)}</div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 gap-1 mt-1"
                              disabled={restoreImage.isPending}
                              onClick={() => restoreImage.mutate({ cabinetId: c.cabinetId, url: newestUnattached.url })}
                              title={`Set this upload ("${newestUnattached.label}") as the cabinet image`}
                            >
                              <ImageIcon className="h-3 w-3" /> Use this image
                            </Button>
                          </div>
                        </div>
                      ) : c.catalogImageUrl ? (
                        <img src={c.catalogImageUrl} alt="" className="h-10 w-10 rounded object-contain bg-white border" />
                      ) : (
                        <span className="text-muted-foreground">none</span>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setOpenCabinetId(c.cabinetId)} data-testid={`data-recovery-open-${c.masterCode}`}>
                        <History className="h-3.5 w-3.5" /> Restore…
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CabinetConfigHistoryPanel />

      {openCabinetId != null && (
        <CabinetRecoveryDialog cabinetId={openCabinetId} onClose={() => setOpenCabinetId(null)} onChanged={invalidateAll} />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`rounded-md border p-2 ${tone === "warn" ? "border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/20" : "border-border bg-muted/20"}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function CabinetRecoveryDialog({ cabinetId, onClose, onChanged }: { cabinetId: number; onClose: () => void; onChanged: () => void }) {
  const detail = trpc.cabinetRecovery.cabinetDetail.useQuery({ cabinetId });
  const scan = trpc.cabinetRecovery.scan.useQuery({ days: 90, cabinetId }, { staleTime: 15_000 });
  const [pickedFields, setPickedFields] = useState<Record<number, Set<string>>>({});
  const [withOverrides, setWithOverrides] = useState(false);
  const utils = trpc.useUtils();

  const done = (msg: string) => { toast.success(msg); utils.cabinetRecovery.cabinetDetail.invalidate({ cabinetId }); onChanged(); };
  const snapshot = trpc.cabinetRecovery.snapshot.useMutation({ onSuccess: () => done("Snapshot stored"), onError: (e) => toast.error(e.message) });
  const restore = trpc.cabinetRecovery.restoreSnapshot.useMutation({
    onSuccess: (r) => done(`Restored ${r.restoredFields} field${r.restoredFields === 1 ? "" : "s"}${r.restoredOverrides ? ` and ${r.restoredOverrides} distributor rule${r.restoredOverrides === 1 ? "" : "s"}` : ""} on ${r.masterCode}`),
    onError: (e) => toast.error(e.message),
  });
  const reapply = trpc.cabinetRecovery.reapplyLoggedEdits.useMutation({
    onSuccess: (r) => done(r.reapplied ? `Re-applied ${r.reapplied} logged edit${r.reapplied === 1 ? "" : "s"}: ${r.fields.join(", ")}` : "Nothing to re-apply — the cabinet already holds every logged value"),
    onError: (e) => toast.error(e.message),
  });
  const revert = trpc.cabinetOverrides.revertConfigChange.useMutation({
    onSuccess: (r) => done(`Reverted ${r.field} to ${fmt(r.restored)}`),
    onError: (e) => toast.error(e.message),
  });
  const restoreImage = trpc.cabinetRecovery.restoreImage.useMutation({ onSuccess: () => done("Image restored"), onError: (e) => toast.error(e.message) });

  const live = detail.data?.live;
  const images = scan.data?.cabinets?.[0]?.imageCandidates ?? [];

  const toggleField = (snapId: number, field: string) =>
    setPickedFields((prev) => {
      const next = new Set(prev[snapId] ?? []);
      if (next.has(field)) next.delete(field); else next.add(field);
      return { ...prev, [snapId]: next };
    });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="data-recovery-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Restore {live?.masterCode ?? `cabinet #${cabinetId}`}
          </DialogTitle>
          <DialogDescription>
            Pick what to put back. A fresh snapshot is stored before any restore so it can be undone from this same screen.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading || !detail.data ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-5 text-sm">
            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Current values</h3>
                <Button size="sm" variant="outline" className="gap-1" disabled={snapshot.isPending} onClick={() => snapshot.mutate({ cabinetId })} data-testid="data-recovery-snapshot-now">
                  <Save className="h-3.5 w-3.5" /> Snapshot now
                </Button>
              </div>
              <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {(["description", "category", "width", "height", "depth", "hingeSide", "placementType", "numberOfDoors", "numberOfDrawers", "showInCatalog", "showInDesigner", "configuredAt"] as const).map((f) => (
                  <div key={f}><span className="text-muted-foreground">{f}: </span>{f === "configuredAt" ? when(live?.[f] as Date | null) : fmt(live?.[f])}</div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-medium">Logged field changes (last 30 days, not yet reverted)</h3>
              {detail.data.changes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No field-level history for this cabinet. Its earlier saves only left a timestamp.</p>
              ) : (
                <>
                  <div className="overflow-x-auto mt-1">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1 pr-2">When</th><th className="text-left py-1 pr-2">Scope</th><th className="text-left py-1 pr-2">Field</th><th className="text-left py-1 pr-2">Before</th><th className="text-left py-1 pr-2">After</th><th className="text-left py-1 pr-2">By</th><th /></tr></thead>
                      <tbody>
                        {detail.data.changes.map((c) => (
                          <tr key={c.id} className="border-b border-border/60">
                            <td className="py-1 pr-2 whitespace-nowrap">{when(c.createdAt)}</td>
                            <td className="py-1 pr-2">{c.scope === "master" ? "Master" : `Distributor ${c.distributorId}`}</td>
                            <td className="py-1 pr-2 font-mono">{c.field}</td>
                            <td className="py-1 pr-2 max-w-[160px] truncate" title={fmt(c.oldValue)}>{fmt(c.oldValue)}</td>
                            <td className="py-1 pr-2 max-w-[160px] truncate font-medium" title={fmt(c.newValue)}>{fmt(c.newValue)}</td>
                            <td className="py-1 pr-2">{c.changedByName ?? "—"}</td>
                            <td className="py-1 text-right">
                              <Button size="sm" variant="ghost" className="h-6 px-2 gap-1" disabled={revert.isPending} onClick={() => revert.mutate({ id: c.id })} title="Put the value before this change back">
                                <RotateCcw className="h-3 w-3" /> Undo
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button size="sm" variant="secondary" className="mt-2 gap-1" disabled={reapply.isPending} onClick={() => reapply.mutate({ cabinetId })} title="If a later import or bulk tool overwrote this cabinet, put the newest logged value of each field back" data-testid="data-recovery-reapply">
                    <History className="h-3.5 w-3.5" /> Re-apply newest logged edits
                  </Button>
                </>
              )}
            </section>

            <section>
              <h3 className="font-medium">Snapshots</h3>
              {detail.data.snapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground">No snapshots yet. One is stored automatically before every save from now on; use “Snapshot now” to store one today.</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {detail.data.snapshots.map((s) => {
                    const picked = pickedFields[s.id] ?? new Set<string>();
                    return (
                      <li key={s.id} className="rounded-md border border-border p-2 text-xs" data-testid={`data-recovery-snapshot-${s.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <b>{when(s.createdAt)}</b> · <Badge variant="outline" className="text-[10px]">{s.reason}</Badge> · {s.takenByName ?? "system"} · {s.overrides.length} distributor rule{s.overrides.length === 1 ? "" : "s"}
                          </div>
                          <div className="flex items-center gap-2">
                            {s.diff.length === 0 ? (
                              <span className="text-muted-foreground">identical to current</span>
                            ) : (
                              <>
                                <Button
                                  size="sm" variant="outline" className="h-6 px-2"
                                  disabled={restore.isPending || picked.size === 0}
                                  onClick={() => restore.mutate({ snapshotId: s.id, fields: Array.from(picked), restoreOverrides: false })}
                                >
                                  Restore {picked.size} selected
                                </Button>
                                <Button
                                  size="sm" className="h-6 px-2"
                                  disabled={restore.isPending}
                                  onClick={() => restore.mutate({ snapshotId: s.id, restoreOverrides: withOverrides })}
                                  data-testid={`data-recovery-restore-all-${s.id}`}
                                >
                                  Restore all {s.diff.length}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {s.diff.length > 0 && (
                          <table className="w-full mt-2">
                            <thead className="text-muted-foreground"><tr><th className="w-6" /><th className="text-left py-0.5 pr-2">Field</th><th className="text-left py-0.5 pr-2">In snapshot</th><th className="text-left py-0.5 pr-2">Now</th></tr></thead>
                            <tbody>
                              {s.diff.map((d) => (
                                <tr key={d.field} className="border-t border-border/40">
                                  <td className="py-0.5"><Checkbox checked={picked.has(d.field)} onCheckedChange={() => toggleField(s.id, d.field)} /></td>
                                  <td className="py-0.5 pr-2 font-mono">{d.field}</td>
                                  <td className="py-0.5 pr-2 max-w-[220px] truncate font-medium" title={fmt(d.snapshotValue)}>{fmt(d.snapshotValue)}</td>
                                  <td className="py-0.5 pr-2 max-w-[220px] truncate text-muted-foreground" title={fmt(d.liveValue)}>{fmt(d.liveValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {detail.data.snapshots.some((s) => s.overrides.length > 0) && (
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <Checkbox checked={withOverrides} onCheckedChange={(v) => setWithOverrides(v === true)} /> “Restore all” also puts back the distributor rules stored in the snapshot
                </label>
              )}
            </section>

            {images.length > 0 && (
              <section>
                <h3 className="font-medium">Uploaded images for this code (last 90 days)</h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {images.map((i) => (
                    <div key={i.mediaId} className={`rounded-md border p-2 text-xs w-[150px] ${i.isCurrent ? "border-green-500/60" : "border-border"}`}>
                      <img src={i.url} alt="" className="h-20 w-full object-contain bg-white rounded" />
                      <div className="mt-1 truncate" title={i.label}>{i.label}</div>
                      <div className="text-muted-foreground">{when(i.uploadedAt)}</div>
                      {i.isCurrent ? (
                        <Badge variant="secondary" className="mt-1 text-[10px]">current</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 px-2 mt-1 w-full" disabled={restoreImage.isPending} onClick={() => restoreImage.mutate({ cabinetId, url: i.url })}>
                          Use this image
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataRecoveryAdmin;
