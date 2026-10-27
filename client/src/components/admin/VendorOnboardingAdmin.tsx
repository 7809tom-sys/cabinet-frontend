import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useVendorOnboardingApi } from "@/lib/vendorOnboardingApi";
import {
  adminListInput,
  completedConflictHref,
  flagReasonLabel,
  type AdminListSelection,
} from "@/lib/vendorOnboarding";

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

export default function VendorOnboardingAdmin() {
  const api = useVendorOnboardingApi();
  const distributors = trpc.distributors.list.useQuery();
  const [distributorId, setDistributorId] = useState("all");
  const [importId, setImportId] = useState("all");
  const [status, setStatus] = useState<"exceptions" | "flagged" | "completed" | "matched">("exceptions");

  const selection = useMemo<AdminListSelection>(() => {
    const next: AdminListSelection = {};
    if (distributorId !== "all") next.distributorId = Number(distributorId);
    if (importId !== "all") next.importId = Number(importId);
    if (status !== "exceptions") next.status = status;
    return next;
  }, [distributorId, importId, status]);
  const queryInput = adminListInput(selection);
  const list = api.vendorOnboarding.adminList.useQuery(queryInput);

  const imports = list.data?.imports ?? [];
  const rows = list.data?.rows ?? [];

  return (
    <div className="space-y-4" data-testid="vendor-onboarding-admin">
      <div>
        <h2 className="text-lg font-semibold">Vendor onboarding</h2>
        <p className="text-sm text-muted-foreground">
          Flagged and completed spreadsheet rows. A completed row opens the Cabinet Conflicts editor for its review cabinet.
          That review cabinet is not a verified master. A matched row&apos;s cabinet id is the master and is not opened here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Distributor</span>
          <select
            aria-label="Distributor"
            className={selectClass}
            value={distributorId}
            onChange={(event) => {
              setDistributorId(event.target.value);
              setImportId("all");
            }}
          >
            <option value="all">All distributors</option>
            {(distributors.data ?? []).map((line) => (
              <option key={line.id} value={String(line.id)}>{line.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Import</span>
          <select
            aria-label="Import"
            className={selectClass}
            value={importId}
            onChange={(event) => setImportId(event.target.value)}
          >
            <option value="all">All imports</option>
            {imports.map((item) => (
              <option key={item.id} value={String(item.id)}>
                #{item.id} {item.fileName ?? "Untitled"} · {item.distributorName ?? `Line ${item.distributorId}`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            aria-label="Status"
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="exceptions">Flagged and completed</option>
            <option value="flagged">Flagged</option>
            <option value="completed">Completed</option>
            <option value="matched">Matched</option>
          </select>
        </label>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Loading onboarding rows…</p>}
      {list.error && <p role="alert" className="text-sm text-destructive">{list.error.message}</p>}

      {imports.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-1">Import</th>
                <th className="px-2 py-1">Distributor</th>
                <th className="px-2 py-1">File</th>
                <th className="px-2 py-1">Matched</th>
                <th className="px-2 py-1">Flagged</th>
                <th className="px-2 py-1">Completed</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-2 py-1">#{item.id}</td>
                  <td className="px-2 py-1">{item.distributorName ?? item.distributorId}</td>
                  <td className="px-2 py-1">{item.fileName ?? "—"}</td>
                  <td className="px-2 py-1">{item.matched}</td>
                  <td className="px-2 py-1">{item.flagged}</td>
                  <td className="px-2 py-1">{item.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !list.isLoading ? (
        <p className="text-sm text-muted-foreground">No onboarding rows for these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-1">SKU</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Distributor</th>
                <th className="px-2 py-1">Style</th>
                <th className="px-2 py-1">Price</th>
                <th className="px-2 py-1">Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = completedConflictHref(row);
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-2 py-1 font-mono text-xs">
                      {row.sku}
                      <div className="text-muted-foreground">Import {row.importId} · row {row.rowNumber}</div>
                    </td>
                    <td className="px-2 py-1">
                      {row.status}
                      {row.flagReason ? <div className="text-xs text-muted-foreground">{flagReasonLabel(row.flagReason)}</div> : null}
                    </td>
                    <td className="px-2 py-1">{row.distributorName ?? "—"}</td>
                    <td className="px-2 py-1">{row.style ?? "—"}{row.color ? ` · ${row.color}` : ""}</td>
                    <td className="px-2 py-1">{row.price ?? "—"}</td>
                    <td className="px-2 py-1">
                      {href ? (
                        <a className="font-medium underline" href={href}>Open in Cabinet Conflicts</a>
                      ) : row.status === "matched" && row.cabinetId != null ? (
                        <span>Master {row.masterCode ?? row.sku} (id {row.cabinetId})</span>
                      ) : (
                        "—"
                      )}
                      {row.status === "completed" && row.staysPublic ? (
                        <div className="text-xs text-muted-foreground">Stays public while the conflict review is open.</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
