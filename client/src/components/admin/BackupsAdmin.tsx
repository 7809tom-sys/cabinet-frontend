import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BackupsPanel, type BackupSettingsView, type BackupSummaryView } from "./BackupsPanel";
import type { BackupRunRow } from "./backupsFormat";

const PAGE_SIZE = 25;

export default function BackupsAdmin() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const utils = trpc.useUtils();
  const runsQuery = trpc.backups.listRuns.useQuery(
    { page, pageSize: PAGE_SIZE, ...(status ? { status: status as BackupRunRow["status"] } : {}) },
    { refetchInterval: 60_000 },
  );
  const settingsQuery = trpc.backups.getSettings.useQuery();
  const summaryQuery = trpc.backups.summary.useQuery(undefined, { refetchInterval: 60_000 });
  const save = trpc.backups.updateSettings.useMutation({
    onSuccess: async (result) => {
      if ((result as { needsDatabaseUpdate?: boolean }).needsDatabaseUpdate) toast.error("The backup tables are not in the database yet.");
      else toast.success("Backup schedule saved.");
      await Promise.all([utils.backups.getSettings.invalidate(), utils.backups.summary.invalidate()]);
    },
    onError: (e) => toast.error("Could not save the schedule", { description: e.message }),
  });

  const runs = runsQuery.data as { needsDatabaseUpdate?: boolean; message?: string; rows?: BackupRunRow[]; total?: number } | undefined;
  const settings = settingsQuery.data as ({ needsDatabaseUpdate?: boolean } & Partial<BackupSettingsView>) | undefined;
  const summary = summaryQuery.data as ({ needsDatabaseUpdate?: boolean } & Partial<BackupSummaryView>) | undefined;
  const needs = !!(runs?.needsDatabaseUpdate || settings?.needsDatabaseUpdate || summary?.needsDatabaseUpdate);

  return (
    <BackupsPanel
      loading={runsQuery.isLoading}
      needsDatabaseUpdate={needs}
      unavailableMessage={runs?.message}
      runs={runs?.rows ?? []}
      total={runs?.total ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      statusFilter={status}
      settings={!needs && settings?.dailyTime ? (settings as BackupSettingsView) : null}
      summary={!needs && summary?.health ? (summary as BackupSummaryView) : null}
      saving={save.isPending}
      onPageChange={setPage}
      onStatusFilterChange={(s) => { setStatus(s); setPage(1); }}
      onSaveSettings={(s) => save.mutate(s)}
    />
  );
}
