// Pure helpers for the admin Backups tab. No React, no network, so they are easy to test.

export type BackupRunRow = {
  id: number;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  machineName: string;
  destination: string;
  scope: string[];
  status: "running" | "success" | "partial" | "failed";
  fileCount: number;
  totalBytes: number;
  snapshotFolder: string;
  errorSummary: string;
};

export const DEFAULT_BACKUP_TIMEZONE = "America/New_York";
export const BACKUP_RUNBOOK_URL = "https://github.com/7809tom-sys/cabinet-backend/blob/main/docs/BACKUPS.md";
export const DEFAULT_FLASH_DRIVE_PATH = "E:\\CabinetDealzBackups";

export const SCOPE_LABELS: Record<string, string> = {
  supabase_storage: "Supabase files",
  database: "Database dump",
  code: "Code mirror",
};

export function scopeLabel(scope: string[]): string {
  if (!scope.length) return "—";
  return scope.map((s) => SCOPE_LABELS[s] ?? s).join(", ");
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(start: string | Date, end: string | Date | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function datePart(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function timePart(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

export const STATUS_STYLES: Record<BackupRunRow["status"], { label: string; className: string }> = {
  success: { label: "Success", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
  running: { label: "Running", className: "bg-blue-100 text-blue-800 border-blue-200" },
};

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function backupRunsToCsv(rows: BackupRunRow[], timeZone: string): string {
  const header = ["Date", `Time (${timeZone})`, "What was backed up", "Status", "Files", "Size (bytes)", "Duration", "Machine", "Snapshot folder", "Error"];
  const lines = rows.map((r) => [
    datePart(r.startedAt, timeZone), timePart(r.startedAt, timeZone), scopeLabel(r.scope), STATUS_STYLES[r.status]?.label ?? r.status,
    r.fileCount, r.totalBytes, formatDuration(r.startedAt, r.finishedAt), r.machineName, r.snapshotFolder, r.errorSummary,
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

/** Pick the drive path to show: the newest run's destination, else the default. */
export function flashDrivePath(rows: BackupRunRow[]): string {
  return rows.find((r) => r.destination)?.destination || DEFAULT_FLASH_DRIVE_PATH;
}

export const TIMEZONE_CHOICES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "UTC",
];
