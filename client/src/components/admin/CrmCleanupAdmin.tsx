import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Preview = {
  snapshotId: number;
  planHash: string;
  expiresAt: string;
  deleteSupabaseAuth: boolean;
  countsByReason: Record<string, { users: number; orders: number; deals: number; children: number }>;
  childDeleteCounts: Record<string, number>;
  keepUsers: Array<{
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    reason: string;
    reasonLabel: string;
    hasRealPayment: boolean;
    hasSupabaseAuth: boolean;
    forced: boolean;
  }>;
  forcedUserIds: number[];
  deleteUsers: Array<{ id: number; name: string | null; email: string | null; role: string; reasonLabel: string; hasRealPayment: boolean }>;
  deleteOrders: Array<{ id: number; requestNumber: string; originatorName: string | null; originatorEmail: string | null; reasonLabel: string; hasRealPayment: boolean }>;
  deleteDeals: Array<{ id: number; title: string; contactName: string | null; contactEmail: string | null; reasonLabel: string; hasRealPayment: boolean }>;
  totals: {
    deleteUsers: number;
    keepUsers: number;
    authorizedKeeps: number;
    deleteOrders: number;
    keepOrders: number;
    deleteDeals: number;
    keepDeals: number;
    deleteChildren: number;
    keepChildren: number;
    supabaseAuthUsers: number;
  };
  paymentFlags: { users: number; orders: number; deals: number };
  preservedAffiliates: Array<{ id: number; storeName: string; contactName: string | null; userId: number | null }>;
  unlinkedAffiliates: Array<{ id: number; storeName: string; contactName: string | null; userId: number | null }>;
  warnings: string[];
  sampleTruncated: boolean;
};

const REASON_ORDER = [
  "example_email",
  "test_fake_name",
  "bulk_seeded",
  "no_real_activity",
  "design_example",
  "fake_order",
  "removed_from_keep",
] as const;

const REASON_LABEL: Record<string, string> = {
  example_email: "example.com email",
  test_fake_name: "test/fake name",
  bulk_seeded: "bulk-seeded pattern",
  no_real_activity: "no real activity",
  design_example: "design example",
  fake_order: "fake order",
  removed_from_keep: "removed from keep list",
};

function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PaymentFlag({ show }: { show: boolean }) {
  if (!show) return null;
  return <Badge variant="outline" className="border-amber-500 text-amber-700">Has payment</Badge>;
}

export default function CrmCleanupAdmin() {
  const utils = trpc.useUtils();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [keepUserIds, setKeepUserIds] = useState<number[] | null>(null);
  const [alsoDeleteUserIds, setAlsoDeleteUserIds] = useState<number[]>([]);
  const [deleteSupabaseAuth, setDeleteSupabaseAuth] = useState(false);
  const [addId, setAddId] = useState("");
  const [extraDeleteId, setExtraDeleteId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [lastAuditId, setLastAuditId] = useState<number | null>(null);

  const audits = trpc.crmCleanup.audits.useQuery(undefined, { retry: false });

  const buildPreview = trpc.crmCleanup.preview.useMutation({
    onSuccess: (data) => {
      const next = data as Preview;
      setPreview(next);
      setKeepUserIds(next.keepUsers.map((user) => user.id));
      setDeleteSupabaseAuth(next.deleteSupabaseAuth);
      setConfirmText("");
      toast.success("Preview ready. Nothing was deleted.");
    },
    onError: (error) => toast.error("Could not build preview", { description: error.message }),
  });

  const confirm = trpc.crmCleanup.confirm.useMutation({
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setPreview(null);
      setConfirmText("");
      audits.refetch();
      toast.success(`Cleanup finished. Audit #${result.auditId}`);
    },
    onError: (error) => toast.error("Cleanup was not run", { description: error.message }),
  });

  function requestPreview(next?: { keep?: number[]; alsoDelete?: number[]; supabase?: boolean }) {
    const keep = next?.keep ?? keepUserIds ?? undefined;
    buildPreview.mutate({
      keepUserIds: keep ?? undefined,
      alsoDeleteUserIds: next?.alsoDelete ?? alsoDeleteUserIds,
      deleteSupabaseAuth: next?.supabase ?? deleteSupabaseAuth,
    });
  }

  function parseId(value: string): number | null {
    const id = Number(value.trim());
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("Enter a positive user id.");
      return null;
    }
    return id;
  }

  async function downloadCsv() {
    if (!preview) return;
    try {
      const file = await utils.crmCleanup.csv.fetch({ snapshotId: preview.snapshotId });
      downloadText(file.filename, file.csv, "text/csv;charset=utf-8");
    } catch (error) {
      toast.error("CSV was not downloaded", { description: error instanceof Error ? error.message : "Try building a new preview." });
    }
  }

  async function downloadBackup(auditId: number) {
    try {
      const backup = await utils.crmCleanup.backup.fetch({ auditId });
      downloadText(`crm-cleanup-backup-${auditId}.json`, JSON.stringify(backup, null, 2), "application/json");
    } catch (error) {
      toast.error("Backup was not downloaded", { description: error instanceof Error ? error.message : "Backup unavailable." });
    }
  }

  const paymentTotal = preview ? preview.paymentFlags.users + preview.paymentFlags.orders + preview.paymentFlags.deals : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CRM cleanup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Builds a read-only plan for test customers, fake incoming orders, and the child rows those records would leave behind.
            Nothing is deleted until you confirm the exact preview. The signed-in admin and the last admin cannot be deleted.
            The authorized keep list stays under ten people.
          </p>
          <Button onClick={() => requestPreview()} disabled={buildPreview.isPending}>
            {buildPreview.isPending ? <Spinner className="h-4 w-4" /> : "Build read-only preview"}
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            Preview #{preview.snapshotId} is read-only and expires {new Date(preview.expiresAt).toLocaleString()}. Hash {preview.planHash.slice(0, 12)}.
            {preview.sampleTruncated ? " The tables below are a sample. The CSV has every row." : ""}
          </div>

          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-1">
              {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REASON_ORDER.map((reason) => {
              const count = preview.countsByReason[reason] ?? { users: 0, orders: 0, deals: 0, children: 0 };
              const total = count.users + count.orders + count.deals + count.children;
              return (
                <Card key={reason}>
                  <CardContent className="py-4">
                    <p className="text-sm font-medium">{REASON_LABEL[reason]}</p>
                    <p className="text-2xl font-semibold">{total}</p>
                    <p className="text-xs text-muted-foreground">{count.users} users · {count.orders} orders · {count.deals} deals · {count.children} child rows</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-lg border px-4 py-3 text-sm space-y-1">
            <p><strong>{preview.totals.deleteUsers}</strong> users, <strong>{preview.totals.deleteOrders}</strong> incoming orders, <strong>{preview.totals.deleteDeals}</strong> CRM deals, and <strong>{preview.totals.deleteChildren}</strong> child rows will be deleted.</p>
            <p><strong>{preview.totals.keepUsers}</strong> users stay, including <strong>{preview.totals.authorizedKeeps}</strong> on the authorized keep list. <strong>{preview.totals.keepOrders}</strong> orders and <strong>{preview.totals.keepDeals}</strong> deals stay.</p>
            <p className="text-amber-800">
              Payment safety flag: {paymentTotal} delete-row{paymentTotal === 1 ? "" : "s"} {paymentTotal === 1 ? "has" : "have"} a real payment, paid order, or Stripe record
              ({preview.paymentFlags.users} users, {preview.paymentFlags.orders} orders, {preview.paymentFlags.deals} deals). This flag does not block deletion.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Keep list ({preview.keepUsers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Add or remove by user id, then the preview is rebuilt. Forced accounts stay even if removed.</p>
              <div className="space-y-2">
                {preview.keepUsers.map((user) => (
                  <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{user.name || "Unnamed user"}</span>
                        <Badge variant="secondary">#{user.id}</Badge>
                        <Badge variant="outline">{user.reasonLabel}</Badge>
                        <PaymentFlag show={user.hasRealPayment} />
                        {user.hasSupabaseAuth && <Badge variant="outline">Supabase auth</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email || "No email"} · {user.role}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={user.forced || buildPreview.isPending}
                      onClick={() => {
                        const keep = (keepUserIds ?? []).filter((id) => id !== user.id);
                        setKeepUserIds(keep);
                        requestPreview({ keep });
                      }}
                    >
                      {user.forced ? "Protected" : "Remove"}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={addId} onChange={(event) => setAddId(event.target.value)} placeholder="Add user id to keep" />
                <Button
                  variant="outline"
                  disabled={buildPreview.isPending}
                  onClick={() => {
                    const id = parseId(addId);
                    if (id == null) return;
                    const keep = Array.from(new Set([...(keepUserIds ?? []), id]));
                    const alsoDelete = alsoDeleteUserIds.filter((existing) => existing !== id);
                    setKeepUserIds(keep);
                    setAlsoDeleteUserIds(alsoDelete);
                    setAddId("");
                    requestPreview({ keep, alsoDelete });
                  }}
                >
                  Add to keep list
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={extraDeleteId} onChange={(event) => setExtraDeleteId(event.target.value)} placeholder="Also delete user id" />
                <Button
                  variant="outline"
                  disabled={buildPreview.isPending}
                  onClick={() => {
                    const id = parseId(extraDeleteId);
                    if (id == null) return;
                    const keep = (keepUserIds ?? []).filter((existing) => existing !== id);
                    const alsoDelete = Array.from(new Set([...alsoDeleteUserIds, id]));
                    setKeepUserIds(keep);
                    setAlsoDeleteUserIds(alsoDelete);
                    setExtraDeleteId("");
                    requestPreview({ keep, alsoDelete });
                  }}
                >
                  Mark user for deletion
                </Button>
              </div>
              {alsoDeleteUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">Extra delete ids: {alsoDeleteUserIds.join(", ")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Affiliates</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Kept affiliate links stay attached. Affiliate records themselves are not deleted. A deleted user is unlinked instead.</p>
              {preview.preservedAffiliates.map((row) => (
                <p key={row.id}>Keep link: {row.storeName} ({row.contactName || "no contact"}) → user #{row.userId}</p>
              ))}
              {preview.unlinkedAffiliates.map((row) => (
                <p key={row.id}>Unlink only: {row.storeName} ({row.contactName || "no contact"}) from user #{row.userId}</p>
              ))}
              {preview.preservedAffiliates.length === 0 && preview.unlinkedAffiliates.length === 0 && <p>No affiliate user links are in this plan.</p>}
            </CardContent>
          </Card>

          <RecordTable
            title={`Users to delete (${preview.totals.deleteUsers})`}
            rows={preview.deleteUsers.map((user) => ({
              id: user.id,
              primary: user.name || "Unnamed user",
              secondary: user.email || user.role,
              reason: user.reasonLabel,
              payment: user.hasRealPayment,
            }))}
          />
          <RecordTable
            title={`Incoming orders to delete (${preview.totals.deleteOrders})`}
            rows={preview.deleteOrders.map((order) => ({
              id: order.id,
              primary: order.requestNumber,
              secondary: `${order.originatorName || "No name"} · ${order.originatorEmail || "No email"}`,
              reason: order.reasonLabel,
              payment: order.hasRealPayment,
            }))}
          />
          <RecordTable
            title={`CRM deals to delete (${preview.totals.deleteDeals})`}
            rows={preview.deleteDeals.map((deal) => ({
              id: deal.id,
              primary: deal.title,
              secondary: `${deal.contactName || "No contact"} · ${deal.contactEmail || "No email"}`,
              reason: deal.reasonLabel,
              payment: deal.hasRealPayment,
            }))}
          />

          {Object.keys(preview.childDeleteCounts).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Child rows to delete</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(preview.childDeleteCounts).map(([table, count]) => (
                  <Badge key={table} variant="outline">{table}: {count}</Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
            <Checkbox
              id="delete-supabase-auth"
              checked={deleteSupabaseAuth}
              disabled={buildPreview.isPending}
              onCheckedChange={(checked) => {
                const supabase = checked === true;
                setDeleteSupabaseAuth(supabase);
                requestPreview({ supabase });
              }}
            />
            <label htmlFor="delete-supabase-auth" className="text-sm leading-5">
              Also delete matching Supabase auth users for the deleted accounts ({preview.totals.supabaseAuthUsers} linked).
              This is off unless you check it, and it is stored in the preview snapshot.
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadCsv}>Download CSV of deletes and keeps</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={confirm.isPending}>Confirm deletion</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete preview #{preview.snapshotId}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes only the ids in this preview, after writing a server-side backup. If CRM data changed, the delete is rejected.
                    Type DELETE to continue. Payment flags do not block this.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="Type DELETE" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "DELETE" || confirm.isPending}
                    onClick={(event) => {
                      if (confirmText !== "DELETE") {
                        event.preventDefault();
                        return;
                      }
                      confirm.mutate({
                        snapshotId: preview.snapshotId,
                        confirmation: "DELETE",
                        deleteSupabaseAuth: preview.deleteSupabaseAuth,
                      });
                    }}
                  >
                    Delete this snapshot
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Audit log</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {lastAuditId && (
            <Button variant="outline" size="sm" onClick={() => downloadBackup(lastAuditId)}>Download backup for audit #{lastAuditId}</Button>
          )}
          {audits.isLoading ? <Spinner className="h-4 w-4" /> : (audits.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No cleanup has been confirmed yet.</p>
          ) : (
            (audits.data ?? []).map((audit) => (
              <div key={audit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div>
                  <p>Audit #{audit.id} · {audit.status} · {audit.actorName || audit.actorEmail || `user #${audit.actorUserId}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(audit.createdAt).toLocaleString()}
                    {audit.supabaseOptIn ? ` · Supabase removed ${audit.supabaseDeleted}, failed ${audit.supabaseFailed}` : ""}
                    {audit.errorMessage ? ` · ${audit.errorMessage}` : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadBackup(audit.id)}>Download backup</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecordTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: number; primary: string; secondary: string; reason: string; payment: boolean }>;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{row.primary}</span>
              <span className="text-muted-foreground"> · #{row.id} · {row.secondary}</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{row.reason}</Badge>
              <PaymentFlag show={row.payment} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
