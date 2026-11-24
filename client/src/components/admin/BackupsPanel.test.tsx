// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackupsPanel, type BackupsPanelProps } from "./BackupsPanel";
import { backupRunsToCsv, formatBytes, formatDuration, type BackupRunRow } from "./backupsFormat";

afterEach(() => cleanup());

const rows: BackupRunRow[] = [
  { id: 2, startedAt: "2026-11-23T08:00:00Z", finishedAt: "2026-11-23T08:12:30Z", machineName: "TOM-PC", destination: "F:\\CabinetDealzBackups", scope: ["supabase_storage", "database"], status: "success", fileCount: 1234, totalBytes: 5 * 1024 ** 3, snapshotFolder: "F:\\CabinetDealzBackups\\daily\\2026-11-23", errorSummary: "" },
  { id: 1, startedAt: "2026-11-22T08:00:00Z", finishedAt: "2026-11-22T08:01:00Z", machineName: "TOM-PC", destination: "F:\\CabinetDealzBackups", scope: ["supabase_storage"], status: "failed", fileCount: 0, totalBytes: 0, snapshotFolder: "", errorSummary: 'Supabase files failed, "403"' },
];

function props(over: Partial<BackupsPanelProps> = {}): BackupsPanelProps {
  return {
    runs: rows, total: 2, page: 1, pageSize: 25, statusFilter: "",
    settings: { dailyTime: "03:00", timezone: "America/New_York", retentionDays: 90, updatedAt: "2026-11-20T15:00:00Z", updatedByName: "Rich" },
    summary: { lastSuccessAt: "2026-11-23T08:12:30Z", health: { level: "ok", message: "Backups are current." } },
    onPageChange: vi.fn(), onStatusFilterChange: vi.fn(), onSaveSettings: vi.fn(),
    ...over,
  };
}

describe("BackupsPanel", () => {
  it("renders one row per run, newest first, with a labelled zone, status badges and the error", () => {
    render(<BackupsPanel {...props()} />);
    const body = screen.getAllByTestId("backup-log-row");
    expect(body).toHaveLength(2);
    expect(body[0].textContent).toContain("2026-11-23");
    expect(body[0].textContent).toContain("3:00 AM EST");
    expect(body[0].textContent).toContain("Supabase files, Database dump");
    expect(body[0].textContent).toContain("5.0 GB");
    expect(body[0].textContent).toContain("12m 30s");
    expect(body[0].textContent).toContain("Success");
    expect(body[1].textContent).toContain("Failed");
    expect(body[1].textContent).toContain("403");
    expect(screen.getByText("Time (America/New_York)")).toBeTruthy();
  });

  it("shows the empty state, not an error, when there are no runs", () => {
    render(<BackupsPanel {...props({ runs: [], total: 0 })} />);
    expect(screen.getByTestId("backup-log-empty").textContent).toContain("No backups recorded yet");
  });

  it("shows a friendly needs-database-update state instead of an error", () => {
    render(<BackupsPanel {...props({ needsDatabaseUpdate: true, runs: [], total: 0, settings: null, summary: null })} />);
    expect(screen.getByTestId("backup-needs-update").textContent).toContain("Needs a database update");
    expect(screen.queryByTestId("backup-health")).toBeNull();
    expect(screen.queryByText(/Failed query/i)).toBeNull();
  });

  it("shows amber and red warnings", () => {
    const { rerender } = render(<BackupsPanel {...props({ summary: { lastSuccessAt: "2026-11-21T08:00:00Z", health: { level: "amber", message: "No successful backup in 30 hours." } } })} />);
    expect(screen.getByTestId("backup-health").getAttribute("data-level")).toBe("amber");
    expect(screen.getByTestId("backup-health").textContent).toContain("30 hours");
    rerender(<BackupsPanel {...props({ summary: { lastSuccessAt: null, health: { level: "red", message: "No successful backup in 60 hours." } } })} />);
    expect(screen.getByTestId("backup-health").getAttribute("data-level")).toBe("red");
  });

  it("shows the drive path with a copy button and the check links", () => {
    render(<BackupsPanel {...props()} />);
    expect(screen.getByTestId("backup-drive-path").textContent).toBe("F:\\CabinetDealzBackups");
    expect(screen.getByText("Copy")).toBeTruthy();
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://tidbcloud.com/");
    expect(hrefs).toContain("https://supabase.com/dashboard/projects");
    expect(hrefs).toContain("https://github.com/7809tom-sys/cabinet-frontend");
    expect(hrefs).toContain("https://github.com/7809tom-sys/cabinet-backend");
    expect(hrefs.some((h) => h?.endsWith("docs/BACKUPS.md"))).toBe(true);
  });

  it("falls back to the default drive path when no run has reported one", () => {
    render(<BackupsPanel {...props({ runs: [], total: 0 })} />);
    expect(screen.getByTestId("backup-drive-path").textContent).toBe("E:\\CabinetDealzBackups");
  });

  it("shows who last changed the schedule, and saves only valid edits", () => {
    const onSave = vi.fn();
    render(<BackupsPanel {...props({ onSaveSettings: onSave })} />);
    expect(screen.getByTestId("backup-last-changed").textContent).toContain("Last changed by Rich");
    const save = screen.getByText("Save schedule") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const retention = screen.getByLabelText(/Keep days/) as HTMLInputElement;
    fireEvent.change(retention, { target: { value: "10" } });
    expect((screen.getByText("Save schedule") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("30 and 365");
    fireEvent.change(retention, { target: { value: "120" } });
    fireEvent.click(screen.getByText("Save schedule"));
    expect(onSave).toHaveBeenCalledWith({ dailyTime: "03:00", timezone: "America/New_York", retentionDays: 120 });
  });

  it("passes status filter and page changes up", () => {
    const onFilter = vi.fn(); const onPage = vi.fn();
    render(<BackupsPanel {...props({ total: 80, onStatusFilterChange: onFilter, onPageChange: onPage })} />);
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "failed" } });
    expect(onFilter).toHaveBeenCalledWith("failed");
    fireEvent.click(screen.getByText("Next"));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe("backup formatting and CSV", () => {
  it("formats sizes and durations", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatDuration("2026-11-23T08:00:00Z", "2026-11-23T09:05:00Z")).toBe("1h 5m");
    expect(formatDuration("2026-11-23T08:00:00Z", null)).toBe("—");
  });
  it("exports CSV with quoting", () => {
    const csv = backupRunsToCsv(rows, "America/New_York");
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Time (America/New_York)");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('"Supabase files failed, ""403"""');
  });
});

describe("Backups tab registration", () => {
  it("lives under the Operations group and is wrapped in the error boundary", () => {
    const src = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
    expect(src).toContain('{ value: "backups", label: "Backups" }');
    expect(src).toContain('<TabsContent value="backups" className="mt-6"><AdminTabErrorBoundary tabName="Backups"><BackupsAdmin /></AdminTabErrorBoundary></TabsContent>');
    const ops = src.slice(src.indexOf('id: "operations"'), src.indexOf('id: "settings"'));
    expect(ops).toContain('value: "backups"');
  });
});
