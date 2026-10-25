import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, History, Undo2, XCircle, Pencil } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type Request = inferRouterOutputs<AppRouter>["masterChanges"]["list"][number];

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
function when(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function ChangeTable({ changes, edited, onEdit }: {
  changes: Request["changes"];
  edited?: Record<string, string>;
  onEdit?: (field: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="px-2 py-1.5 font-medium">Field</th>
            <th className="px-2 py-1.5 font-medium">Current (live)</th>
            <th className="px-2 py-1.5 font-medium">Proposed</th>
            {onEdit && <th className="px-2 py-1.5 font-medium">Edit</th>}
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.field} className="border-t border-border/60">
              <td className="px-2 py-1.5 font-mono">{c.field}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{fmt(c.currentValue)}</td>
              <td className="px-2 py-1.5 font-medium text-foreground">{fmt(c.proposedValue)}</td>
              {onEdit && (
                <td className="px-2 py-1">
                  <Input
                    className="h-7 text-xs"
                    value={edited?.[c.field] ?? fmt(c.proposedValue).replace(/^—$/, "")}
                    onChange={(e) => onEdit(c.field, e.target.value)}
                    aria-label={`Edited value for ${c.field}`}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Coerce edited text back to the proposed value's type. */
function coerce(sample: unknown, text: string): unknown {
  const t = text.trim();
  if (t === "") return null;
  if (typeof sample === "boolean") return /^(yes|true|1)$/i.test(t);
  if (typeof sample === "number") {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return t;
}

function PendingCard({ req }: { req: Request }) {
  const utils = trpc.useUtils();
  const refresh = () => {
    utils.masterChanges.list.invalidate();
    utils.masterChanges.counts.invalidate();
    utils.cabinets.adminListCabinetConfig.invalidate();
    utils.design.placeableCabinets.invalidate();
  };
  const approve = trpc.masterChanges.approve.useMutation({
    onSuccess: () => { toast.success(`Approved — ${req.masterCode} master updated for all distributors.`); refresh(); },
    onError: (e) => toast.error(`Approve failed: ${e.message}`),
  });
  const applyOne = trpc.masterChanges.applyToDistributor.useMutation({
    onSuccess: () => { toast.success(`Applied to one distributor only. Master unchanged.`); refresh(); },
    onError: (e) => toast.error(`Apply failed: ${e.message}`),
  });
  const reject = trpc.masterChanges.reject.useMutation({
    onSuccess: () => { toast.success("Request rejected."); refresh(); },
    onError: (e) => toast.error(`Reject failed: ${e.message}`),
  });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [applyDistributor, setApplyDistributor] = useState<string>("");
  const busy = approve.isPending || applyOne.isPending || reject.isPending;
  const warningCount = req.affectedDistributors.reduce((n, d) => n + d.warnings.length, 0);

  const editedValues = () => {
    const out: Record<string, unknown> = {};
    for (const c of req.changes) {
      if (c.field in edited) out[c.field] = coerce(c.proposedValue, edited[c.field]);
    }
    return out;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm" data-testid={`master-change-${req.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-semibold">{req.masterCode}</span>
            <Badge variant="outline">#{req.id}</Badge>
            {req.cabinetCategory && <Badge variant="secondary">{req.cabinetCategory}</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{req.cabinetDescription ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted by <strong className="text-foreground">{req.submittedByName ?? `user ${req.submittedBy}`}</strong> on {when(req.createdAt)}
            {" · "}from{" "}
            <strong className="text-foreground">{req.sourceDistributorName ?? "no distributor context"}</strong>
          </p>
        </div>
        {warningCount > 0 && (
          <Badge className="bg-amber-500 text-black hover:bg-amber-500">
            <AlertTriangle className="mr-1 h-3 w-3" /> {warningCount} fit warning{warningCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="mt-3">
        <ChangeTable changes={req.changes} />
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Distributors this would change ({req.affectedDistributors.length})
        </p>
        {req.affectedDistributors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No distributor currently carries this cabinet.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {req.affectedDistributors.map((d) => (
              <li
                key={d.id}
                className={
                  "rounded-md border px-2 py-1.5 text-xs " +
                  (d.warnings.length ? "border-amber-400/70 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-background")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{d.name}</span>
                  {d.warnings.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                </div>
                {d.warnings.map((w, i) => (
                  <p key={i} className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">{w}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={() => approve.mutate({ id: req.id })} disabled={busy} data-testid="approve-all">
          {approve.isPending ? <Spinner className="h-4 w-4" /> : <><CheckCircle2 className="mr-1 h-4 w-4" />Approve (all)</>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEdited({}); setEditOpen(true); }} disabled={busy}>
          <Pencil className="mr-1 h-4 w-4" />Edit then approve
        </Button>
        <div className="flex items-center gap-1">
          <Select value={applyDistributor} onValueChange={setApplyDistributor}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Apply to this distributor only">
              <SelectValue placeholder="Apply to one distributor…" />
            </SelectTrigger>
            <SelectContent>
              {req.affectedDistributors.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !applyDistributor}
            onClick={() => applyOne.mutate({ id: req.id, distributorId: Number(applyDistributor) })}
          >
            {applyOne.isPending ? <Spinner className="h-4 w-4" /> : "Apply to this distributor only"}
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
          <XCircle className="mr-1 h-4 w-4" />Reject
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject master change #{req.id}</DialogTitle></DialogHeader>
          <Label htmlFor={`reject-note-${req.id}`} className="text-xs">Note (required)</Label>
          <Textarea id={`reject-note-${req.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why this should not change the master…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!note.trim() || reject.isPending}
              onClick={() => reject.mutate({ id: req.id, note: note.trim() }, { onSuccess: () => setRejectOpen(false) })}
            >
              {reject.isPending ? <Spinner className="h-4 w-4" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit then approve — {req.masterCode}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Adjust any proposed value before it is applied to the master for all distributors. Leave a field blank to clear it.</p>
          <ChangeTable changes={req.changes} edited={edited} onEdit={(f, v) => setEdited((e) => ({ ...e, [f]: v }))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: req.id, editedValues: editedValues() as never, note: Object.keys(edited).length ? "Edited before approval" : undefined },
                  { onSuccess: () => setEditOpen(false) },
                )
              }
            >
              {approve.isPending ? <Spinner className="h-4 w-4" /> : "Approve with edits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryRow({ req, undoWindowDays }: { req: Request; undoWindowDays: number }) {
  const utils = trpc.useUtils();
  const undo = trpc.masterChanges.undo.useMutation({
    onSuccess: () => {
      toast.success(`Undone — ${req.masterCode} restored to the values that were live before.`);
      utils.masterChanges.list.invalidate();
      utils.masterChanges.counts.invalidate();
      utils.cabinets.adminListCabinetConfig.invalidate();
      utils.design.placeableCabinets.invalidate();
    },
    onError: (e) => toast.error(`Undo failed: ${e.message}`),
  });
  const statusBadge: Record<string, string> = {
    approved: "bg-emerald-600 text-white hover:bg-emerald-600",
    applied_to_distributor: "bg-sky-600 text-white hover:bg-sky-600",
    rejected: "bg-zinc-500 text-white hover:bg-zinc-500",
    undone: "bg-amber-600 text-white hover:bg-amber-600",
  };
  const applied = Object.entries(req.appliedValues);
  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-xs" data-testid={`master-history-${req.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{req.masterCode}</span>
        <Badge variant="outline">#{req.id}</Badge>
        <Badge className={statusBadge[req.status] ?? ""}>{req.status.replace(/_/g, " ")}</Badge>
        {req.withinRevertWindow && req.status !== "rejected" && req.status !== "undone" && (
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">within {undoWindowDays}-day revert window</Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {req.reviewedByName ?? "—"} · {when(req.reviewedAt)}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Submitted by {req.submittedByName ?? `user ${req.submittedBy}`} ({when(req.createdAt)})
        {req.sourceDistributorName ? ` from ${req.sourceDistributorName}` : ""}
        {req.reviewNote ? ` · note: ${req.reviewNote}` : ""}
        {req.undoneAt ? ` · undone ${when(req.undoneAt)}` : ""}
      </p>
      {applied.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {applied.map(([k, v]) => (
            <li key={k} className="rounded bg-muted px-1.5 py-0.5">
              <span className="font-mono">{k}</span>: <span className="text-muted-foreground">{fmt(req.previousValues[k])}</span> → <strong>{fmt(v)}</strong>
            </li>
          ))}
        </ul>
      )}
      {req.status === "rejected" && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {req.changes.map((c) => (
            <li key={c.field} className="rounded bg-muted px-1.5 py-0.5 line-through opacity-70">
              <span className="font-mono">{c.field}</span>: {fmt(c.currentValue)} → {fmt(c.proposedValue)}
            </li>
          ))}
        </ul>
      )}
      {req.canUndo && (
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={() => undo.mutate({ id: req.id })} disabled={undo.isPending} data-testid="undo-master-change">
            {undo.isPending ? <Spinner className="h-4 w-4" /> : <><Undo2 className="mr-1 h-4 w-4" />Undo</>}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MasterChangesAdmin() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [filter, setFilter] = useState("");
  const { data: counts } = trpc.masterChanges.counts.useQuery();
  const { data: pending, isLoading: pendingLoading } = trpc.masterChanges.list.useQuery({ status: "pending" });
  const { data: history, isLoading: historyLoading } = trpc.masterChanges.list.useQuery({ status: "history" }, { enabled: tab === "history" });
  const undoWindowDays = counts?.undoWindowDays ?? 5;

  const match = (r: Request) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.masterCode.toLowerCase().includes(q) ||
      (r.cabinetDescription ?? "").toLowerCase().includes(q) ||
      (r.submittedByName ?? "").toLowerCase().includes(q) ||
      (r.sourceDistributorName ?? "").toLowerCase().includes(q)
    );
  };
  const pendingList = useMemo(() => (pending ?? []).filter(match), [pending, filter]);
  const historyList = useMemo(() => (history ?? []).filter(match), [history, filter]);
  const revertList = useMemo(
    () => historyList.filter((r) => r.withinRevertWindow && (r.status === "approved" || r.status === "applied_to_distributor")),
    [historyList],
  );

  return (
    <div className="space-y-4" data-testid="master-changes-admin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Master Changes</h2>
          <p className="max-w-2xl text-xs text-muted-foreground">
            “Save as master” in Cabinet Config files a request here instead of changing the shared cabinet. The
            current master value stays live for every distributor until a request is approved. Prices are never
            part of a request.
          </p>
        </div>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by code, description, submitter, distributor…"
          className="h-9 w-72 text-sm"
          aria-label="Filter master change requests"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "history")}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending {counts?.pending ? <Badge className="ml-1.5 bg-amber-500 text-black hover:bg-amber-500">{counts.pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1 h-4 w-4" />History {counts?.recentApproved ? <Badge variant="secondary" className="ml-1.5">{counts.recentApproved} in {undoWindowDays}d</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-4 w-4" /> Loading…</div>
          ) : pendingList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No pending master change requests.
            </div>
          ) : (
            pendingList.map((req) => <PendingCard key={req.id} req={req} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Revert window — approved in the last {undoWindowDays} days ({revertList.length})
            </h3>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-4 w-4" /> Loading…</div>
            ) : revertList.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing approved in the last {undoWindowDays} days.</p>
            ) : (
              <div className="space-y-2">{revertList.map((req) => <HistoryRow key={req.id} req={req} undoWindowDays={undoWindowDays} />)}</div>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">All reviewed requests ({historyList.length})</h3>
            {!historyLoading && historyList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviewed requests yet.</p>
            ) : (
              <div className="space-y-2">{historyList.map((req) => <HistoryRow key={req.id} req={req} undoWindowDays={undoWindowDays} />)}</div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
