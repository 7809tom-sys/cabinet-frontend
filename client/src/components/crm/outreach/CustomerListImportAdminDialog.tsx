// Admin CRM: import a past-customer list (CSV or XLSX) with column mapping,
// preview, email validation and dedupe. Rows are sent in batches of 500 so
// files with tens of thousands of customers import without timing out.
// Importing sends no email; outreach is a separate, opt-in step.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readContactSpreadsheet, type SpreadsheetTable } from "@/lib/contactImportFile";
import {
  CONTACT_IMPORT_FIELDS,
  CONTACT_IMPORT_FIELD_LABELS,
  CONTACT_IMPORT_MAX_ROWS,
  chunkRows,
  guessContactColumnMapping,
  planContactImport,
  type ContactColumnMapping,
  type ContactImportField,
} from "@shared/crmContactImport";

const NONE = "__none__";

type Totals = { imported: number; duplicates: number; skipped: number; done: number; total: number };

export function CustomerListImportAdminDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [mapping, setMapping] = useState<ContactColumnMapping>({});
  const [sourceTag, setSourceTag] = useState("New Hampshire legacy");
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [finished, setFinished] = useState(false);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const startImport = trpc.crmOutreach.startImport.useMutation();
  const importBatch = trpc.crmOutreach.importBatch.useMutation();
  const finishImport = trpc.crmOutreach.finishImport.useMutation();

  const plan = useMemo(() => (table ? planContactImport(table.rows, mapping) : null), [table, mapping]);
  const rejectedCounts = useMemo(() => {
    const counts = { invalid_email: 0, missing_email: 0, duplicate_in_file: 0 };
    for (const row of plan?.rejected ?? []) counts[row.reason] += 1;
    return counts;
  }, [plan]);

  const reset = () => {
    setFileName(""); setTable(null); setMapping({}); setTotals(null); setFinished(false); setErrorLog([]);
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    reset();
    setReading(true);
    try {
      const parsed = await readContactSpreadsheet(file);
      if (parsed.rows.length > CONTACT_IMPORT_MAX_ROWS) throw new Error(`That file has ${parsed.rows.length.toLocaleString()} rows; the limit is ${CONTACT_IMPORT_MAX_ROWS.toLocaleString()}. Split it into smaller files.`);
      setFileName(file.name);
      setTable(parsed);
      setMapping(guessContactColumnMapping(parsed.headers));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      setReading(false);
    }
  };

  const setField = (field: ContactImportField, value: string) => {
    setMapping((current) => {
      const next = { ...current };
      if (value === NONE) delete next[field];
      else next[field] = Number(value);
      return next;
    });
  };

  const run = async () => {
    if (!plan || !plan.valid.length || !sourceTag.trim()) return;
    setRunning(true);
    setFinished(false);
    const batches = chunkRows(plan.valid);
    const progress: Totals = { imported: 0, duplicates: 0, skipped: 0, done: 0, total: plan.valid.length };
    setTotals({ ...progress });
    try {
      const { importId } = await startImport.mutateAsync({ sourceTag: sourceTag.trim(), fileName, totalRows: table?.rows.length ?? 0 });
      for (const batch of batches) {
        let attempt = 0;
        // Retry a failed batch twice; dedupe makes a retried batch safe.
        for (;;) {
          try {
            const result = await importBatch.mutateAsync({ importId, rows: batch });
            progress.imported += result.imported;
            progress.duplicates += result.duplicates.length;
            progress.skipped += result.skipped.length;
            break;
          } catch (error) {
            attempt += 1;
            if (attempt > 2) throw error;
          }
        }
        progress.done += batch.length;
        setTotals({ ...progress });
      }
      await finishImport.mutateAsync({ importId, clientSkipped: rejectedCounts.invalid_email + rejectedCounts.missing_email });
      setFinished(true);
      toast.success(`${progress.imported.toLocaleString()} customers imported.`);
      utils.crm.board.invalidate();
      utils.crmOutreach.status.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import stopped.";
      setErrorLog((log) => [...log, message]);
      toast.error(`${message} Rows already imported stay in the CRM; running the same file again skips them as duplicates.`);
    } finally {
      setRunning(false);
    }
  };

  const fileDuplicates = rejectedCounts.duplicate_in_file;
  const fileSkipped = rejectedCounts.invalid_email + rejectedCounts.missing_email;
  const preview = plan?.valid.slice(0, 25) ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!running) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-card"><Upload className="h-4 w-4 mr-1" />Import customer list</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import past customers (admin)</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or Excel file. Map the columns, check the preview, then import. Every row needs a valid email. Anyone already in the CRM (matched by email) is skipped as a duplicate. Importing sends no email.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="crm-import-file">File (.csv, .xlsx, .xls)</Label>
            <Input id="crm-import-file" type="file" accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={running} onChange={(event) => void readFile(event.target.files?.[0])} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="crm-import-tag">Source tag (saved on every contact)</Label>
            <Input id="crm-import-tag" value={sourceTag} maxLength={128} disabled={running} onChange={(event) => setSourceTag(event.target.value)} />
          </div>
        </div>
        {reading && <p className="text-sm text-muted-foreground" aria-live="polite">Reading the file…</p>}

        {table && (
          <>
            <div>
              <p className="text-sm font-semibold mb-2">Map columns · {fileName} · {table.rows.length.toLocaleString()} data rows</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CONTACT_IMPORT_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-32 shrink-0 text-xs">{CONTACT_IMPORT_FIELD_LABELS[field]}{field === "email" ? " *" : ""}</Label>
                    <Select value={mapping[field] != null ? String(mapping[field]) : NONE} onValueChange={(value) => setField(field, value)} disabled={running}>
                      <SelectTrigger className="h-8 bg-white" aria-label={`Column for ${CONTACT_IMPORT_FIELD_LABELS[field]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— not in file —</SelectItem>
                        {table.headers.map((header, index) => <SelectItem key={`${header}-${index}`} value={String(index)}>{header || `Column ${index + 1}`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {plan && (
              <div className="rounded border border-border bg-muted/30 p-3 text-sm" role="status">
                <strong>{plan.valid.length.toLocaleString()}</strong> ready to import ·{" "}
                <strong>{fileDuplicates.toLocaleString()}</strong> duplicate emails in the file ·{" "}
                <strong>{rejectedCounts.invalid_email.toLocaleString()}</strong> invalid emails ·{" "}
                <strong>{rejectedCounts.missing_email.toLocaleString()}</strong> with no email.
                {mapping.email == null && <p className="mt-1 text-destructive">Pick the Email column to continue.</p>}
              </div>
            )}

            {preview.length > 0 && (
              <div className="max-h-64 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-left">
                    <tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Phone</th><th className="p-2">City / State / ZIP</th><th className="p-2">Last purchase</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="p-2">{row.rowNumber}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.email}</td>
                        <td className="p-2">{row.phone ?? "—"}</td>
                        <td className="p-2">{[row.city, row.state, row.zip].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-2">{row.lastPurchaseDate ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan && plan.valid.length > preview.length && <p className="p-2 text-xs text-muted-foreground">First {preview.length} of {plan.valid.length.toLocaleString()} shown.</p>}
              </div>
            )}

            {plan && plan.rejected.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer">Rows that will be skipped ({plan.rejected.length.toLocaleString()})</summary>
                <ul className="mt-1 max-h-32 overflow-auto space-y-0.5 text-muted-foreground">
                  {plan.rejected.slice(0, 500).map((row) => <li key={`${row.rowNumber}-${row.reason}`}>Row {row.rowNumber}: {row.email || "(blank)"} — {row.reason === "invalid_email" ? "invalid email" : row.reason === "missing_email" ? "no email" : "duplicate in this file"}</li>)}
                </ul>
              </details>
            )}
          </>
        )}

        {totals && (
          <div className="space-y-1.5" aria-live="polite">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{finished ? "Import finished" : running ? "Importing…" : "Stopped"}</span>
              <span>{totals.done.toLocaleString()} / {totals.total.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={totals.total} aria-valuenow={totals.done}>
              <div className="h-full bg-[var(--color-gold,#d4a64a)] transition-[width]" style={{ width: `${totals.total ? Math.round((totals.done / totals.total) * 100) : 0}%` }} />
            </div>
            <p className="text-sm">
              <strong>{totals.imported.toLocaleString()}</strong> imported ·{" "}
              <strong>{(totals.duplicates + fileDuplicates).toLocaleString()}</strong> duplicates ({totals.duplicates.toLocaleString()} already in the CRM, {fileDuplicates.toLocaleString()} repeated in the file) ·{" "}
              <strong>{(totals.skipped + fileSkipped).toLocaleString()}</strong> skipped (no valid email)
            </p>
            {errorLog.map((line, i) => <p key={i} className="text-xs text-destructive">{line}</p>)}
          </div>
        )}

        <DialogFooter>
          {finished ? (
            <Button onClick={() => { setOpen(false); reset(); }}>Close</Button>
          ) : (
            <Button
              disabled={running || !plan?.valid.length || mapping.email == null || !sourceTag.trim()}
              onClick={() => void run()}
              className="bg-[var(--color-navy,#1a2b4a)] text-white"
            >
              {running ? "Importing…" : `Import ${plan?.valid.length ? plan.valid.length.toLocaleString() : ""} customers`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
