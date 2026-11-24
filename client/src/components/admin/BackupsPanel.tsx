import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Database, ExternalLink, FolderOpen, Github, HardDrive, BookOpen } from "lucide-react";
import {
  BACKUP_RUNBOOK_URL, STATUS_STYLES, TIMEZONE_CHOICES, backupRunsToCsv, datePart, flashDrivePath, formatBytes, formatDuration,
  scopeLabel, timePart, type BackupRunRow,
} from "./backupsFormat";

export type BackupSettingsView = {
  dailyTime: string; timezone: string; retentionDays: number; updatedAt: string | Date | null; updatedByName: string | null;
};
export type BackupSummaryView = { lastSuccessAt: string | Date | null; health: { level: "ok" | "amber" | "red"; message: string } };

export type BackupsPanelProps = {
  /** True when the backup tables are not in the database yet. Shows a friendly message, not an error. */
  needsDatabaseUpdate?: boolean;
  unavailableMessage?: string;
  loading?: boolean;
  runs: BackupRunRow[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  settings: BackupSettingsView | null;
  summary: BackupSummaryView | null;
  saving?: boolean;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (status: string) => void;
  onSaveSettings: (s: { dailyTime: string; timezone: string; retentionDays: number }) => void;
};

const LINKS = [
  { icon: Database, title: "TiDB Cloud console", href: "https://tidbcloud.com/", note: "Check the last backup time and retention under Data > Backup." },
  { icon: HardDrive, title: "Supabase dashboard", href: "https://supabase.com/dashboard/projects", note: "Check the project is active and Storage buckets site-media and private-files exist." },
] as const;

function HealthBanner({ summary, zone }: { summary: BackupSummaryView | null; zone: string }) {
  if (!summary) return null;
  const level = summary.health.level;
  const styles = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-red-300 bg-red-50 text-red-900",
  }[level];
  const Icon = level === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div role="status" data-testid="backup-health" data-level={level} className={`flex items-start gap-3 rounded-lg border p-4 ${styles}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{level === "ok" ? "Backups are current" : level === "amber" ? "Warning: backup is overdue" : "Alert: backups have stopped"}</p>
        <p className="text-sm">
          {summary.lastSuccessAt ? `Last successful backup: ${datePart(summary.lastSuccessAt, zone)} ${timePart(summary.lastSuccessAt, zone)}. ` : ""}
          {level === "ok" ? "" : summary.health.message}
        </p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button" size="sm" variant="outline"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
      }}
    >
      <ClipboardCopy className="mr-1 h-4 w-4" />{copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function BackupsPanel(props: BackupsPanelProps) {
  const { runs, settings, summary } = props;
  const zone = settings?.timezone ?? "America/New_York";
  const [draft, setDraft] = useState<{ dailyTime: string; timezone: string; retentionDays: string } | null>(null);
  const form = draft ?? (settings ? { dailyTime: settings.dailyTime, timezone: settings.timezone, retentionDays: String(settings.retentionDays) } : null);
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));
  const drivePath = flashDrivePath(runs);

  const retention = Number(form?.retentionDays);
  const settingsError = !form ? "" :
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.dailyTime) ? "Pick a valid time." :
    !Number.isInteger(retention) || retention < 30 || retention > 365 ? "Keep between 30 and 365 days." : "";

  function exportCsv() {
    const blob = new Blob([backupRunsToCsv(runs, zone)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backup-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Backups</h2>
        <p className="text-sm text-muted-foreground">Where backups live, whether last night's ran, and when they run. Any administrator can change the schedule.</p>
      </div>

      {props.needsDatabaseUpdate ? (
        <div role="status" data-testid="backup-needs-update" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Needs a database update</p>
          <p className="text-sm">{props.unavailableMessage || "The backup tables are not in the database yet. Ask Tom to run the backup SQL (docs/sql/0285_backup_runs.tidb.sql), then reload this page."}</p>
        </div>
      ) : (
        <HealthBanner summary={summary} zone={zone} />
      )}

      <section aria-label="Where to check" className="grid gap-3 md:grid-cols-2">
        {LINKS.map(({ icon: Icon, title, href, note }) => (
          <Card key={title}><CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4" />{title}</div>
            <p className="text-sm text-muted-foreground">{note}</p>
            <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={href} target="_blank" rel="noreferrer">Open <ExternalLink className="h-3 w-3" /></a>
          </CardContent></Card>
        ))}
        <Card><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 font-medium"><Github className="h-4 w-4" />GitHub</div>
          <p className="text-sm text-muted-foreground">Check the latest commit on main.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a className="inline-flex items-center gap-1 text-primary underline" href="https://github.com/7809tom-sys/cabinet-frontend" target="_blank" rel="noreferrer">cabinet-frontend <ExternalLink className="h-3 w-3" /></a>
            <a className="inline-flex items-center gap-1 text-primary underline" href="https://github.com/7809tom-sys/cabinet-backend" target="_blank" rel="noreferrer">cabinet-backend <ExternalLink className="h-3 w-3" /></a>
          </div>
        </CardContent></Card>
        <Card><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 font-medium"><FolderOpen className="h-4 w-4" />Flash drive folder</div>
          <p className="text-sm text-muted-foreground">A browser cannot open a local drive. Check that today's dated folder exists with SUMMARY.txt saying success.</p>
          <div className="flex items-center gap-2">
            <code data-testid="backup-drive-path" className="rounded bg-muted px-2 py-1 text-sm">{drivePath}</code>
            <CopyButton text={drivePath} />
          </div>
        </CardContent></Card>
        <Card className="md:col-span-2"><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4" />Backup runbook</div>
          <p className="text-sm text-muted-foreground">Step-by-step instructions for TiDB, Supabase, GitHub, the flash drive and the off-site master drive.</p>
          <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={BACKUP_RUNBOOK_URL} target="_blank" rel="noreferrer">Open docs/BACKUPS.md <ExternalLink className="h-3 w-3" /></a>
        </CardContent></Card>
      </section>

      <section aria-label="Backup schedule">
        <Card><CardContent className="space-y-3 p-4">
          <h3 className="font-semibold">Backup schedule</h3>
          {!form ? (
            <p className="text-sm text-muted-foreground" data-testid="backup-settings-unavailable">Schedule settings are not available yet.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">The PC checks every 15 minutes and backs up once the time below has passed each day. A change here takes effect without touching the PC.</p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm">Daily time
                  <Input type="time" className="mt-1 w-32" value={form.dailyTime} onChange={(e) => setDraft({ ...form, dailyTime: e.target.value })} />
                </label>
                <label className="text-sm">Time zone
                  <select className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm" value={form.timezone} onChange={(e) => setDraft({ ...form, timezone: e.target.value })}>
                    {[...new Set([form.timezone, ...TIMEZONE_CHOICES])].map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
                <label className="text-sm">Keep days (30–365)
                  <Input type="number" min={30} max={365} className="mt-1 w-28" value={form.retentionDays} onChange={(e) => setDraft({ ...form, retentionDays: e.target.value })} />
                </label>
                <Button disabled={!!settingsError || props.saving || !draft} onClick={() => { props.onSaveSettings({ dailyTime: form.dailyTime, timezone: form.timezone, retentionDays: retention }); setDraft(null); }}>
                  {props.saving ? "Saving…" : "Save schedule"}
                </Button>
              </div>
              {settingsError && draft ? <p className="text-sm text-red-700" role="alert">{settingsError}</p> : null}
              <p className="text-xs text-muted-foreground" data-testid="backup-last-changed">
                {settings?.updatedAt ? `Last changed by ${settings.updatedByName || "an administrator"} on ${datePart(settings.updatedAt, zone)} ${timePart(settings.updatedAt, zone)}.` : "Using the default schedule (3:00 AM Eastern, keep 90 days). Not changed yet."}
              </p>
            </>
          )}
        </CardContent></Card>
      </section>

      <section aria-label="Backup log" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Backup log</h3>
          <div className="flex items-center gap-2">
            <select aria-label="Filter by status" className="h-9 rounded-md border bg-background px-2 text-sm" value={props.statusFilter} onChange={(e) => props.onStatusFilterChange(e.target.value)}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>
            <Button variant="outline" size="sm" disabled={!runs.length} onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="backup-log-table">
            <thead className="bg-muted/60 text-left">
              <tr>
                {["Date", `Time (${zone})`, "What was backed up", "Status", "Files", "Size", "Duration", "Machine", "Error"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {props.loading ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : props.needsDatabaseUpdate ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">The backup log appears here after the database update.</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={9} data-testid="backup-log-empty" className="px-3 py-6 text-center text-muted-foreground">No backups recorded yet. Once the PC runs its first backup, it shows up here.</td></tr>
              ) : runs.map((r) => {
                const st = STATUS_STYLES[r.status];
                return (
                  <tr key={r.id} className="border-t align-top" data-testid="backup-log-row">
                    <td className="whitespace-nowrap px-3 py-2">{datePart(r.startedAt, zone)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{timePart(r.startedAt, zone)}</td>
                    <td className="px-3 py-2">{scopeLabel(r.scope)}</td>
                    <td className="px-3 py-2"><Badge className={st.className}>{st.label}</Badge></td>
                    <td className="px-3 py-2 text-right">{r.fileCount.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatBytes(r.totalBytes)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDuration(r.startedAt, r.finishedAt)}</td>
                    <td className="px-3 py-2">{r.machineName || "—"}</td>
                    <td className="max-w-xs px-3 py-2 text-red-800">{r.errorSummary || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>{props.total.toLocaleString()} run{props.total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)}>Previous</Button>
            <span>Page {props.page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={props.page >= pages} onClick={() => props.onPageChange(props.page + 1)}>Next</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
