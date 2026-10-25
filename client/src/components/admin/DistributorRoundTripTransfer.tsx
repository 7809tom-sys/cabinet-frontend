import { useMemo, useRef, useState } from "react";
import { Download, FileCheck2, Link2, Pencil, Save, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { buildDistributorRoundTripCsv, normalizeDistributorRoundTripCode, parseDistributorRoundTripCsv, splitRoundTripCodes } from "@shared/distributorRoundTrip";

export type DistributorRoundTripPreview = {
  errors: string[];
  rows: Array<{
    rowNumber: number;
    itemCode: string;
    resolvedMasterCode: string | null;
    replacementMasterCode: string | null;
    replacesMasterCode: boolean;
    aliases: string[];
    eligibleDistributorCodes: string[];
    aliasesToAdd: number;
    distributorLinksToAdd: number;
    errors: string[];
  }>;
  summary: {
    total: number;
    matched: number;
    masterCodesToReplace: number;
    aliasesToAdd: number;
    distributorLinksToAdd: number;
  };
};

export function filterDistributorRoundTripPreviewRows(
  rows: DistributorRoundTripPreview["rows"],
  query: string
) {
  const needle = query.trim().toUpperCase();
  if (!needle) return rows;
  return rows.filter((row) => [
    row.itemCode,
    row.resolvedMasterCode ?? "",
    row.replacementMasterCode ?? "",
    ...row.aliases,
    ...row.eligibleDistributorCodes,
  ].join(" ").toUpperCase().includes(needle));
}

export const DISTRIBUTOR_PREVIEW_PAGE_SIZE = 50;

export function paginateDistributorRoundTripPreviewRows<T>(rows: T[], requestedPage: number, pageSize = DISTRIBUTOR_PREVIEW_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const startIndex = rows.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  return { page, pageCount, startIndex, endIndex, rows: rows.slice(startIndex, endIndex) };
}

export type DistributorRoundTripInlineEdit = {
  itemCode: string;
  replacementMasterCode: string;
  aliases: string;
  eligibleDistributorCodes: string;
};

export function applyDistributorRoundTripInlineEdit(csv: string, rowNumber: number, edit: DistributorRoundTripInlineEdit): string {
  const parsed = parseDistributorRoundTripCsv(csv);
  if (parsed.errors.length > 0) throw new Error(parsed.errors.join(" "));
  if (!parsed.rows.some((row) => row.rowNumber === rowNumber)) throw new Error(`Could not find uploaded row ${rowNumber} to edit.`);
  return buildDistributorRoundTripCsv(parsed.rows.map((row) => row.rowNumber !== rowNumber ? row : {
    ...row,
    itemCode: normalizeDistributorRoundTripCode(edit.itemCode),
    replacementMasterCode: normalizeDistributorRoundTripCode(edit.replacementMasterCode) || null,
    aliases: splitRoundTripCodes(edit.aliases),
    eligibleDistributorCodes: splitRoundTripCodes(edit.eligibleDistributorCodes),
  }));
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Administrator-only catalog identity and distributor connection transfer. */
export function DistributorRoundTripTransfer() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<DistributorRoundTripPreview | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [editingRow, setEditingRow] = useState<(DistributorRoundTripInlineEdit & { rowNumber: number }) | null>(null);
  const [pendingEditedCsv, setPendingEditedCsv] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const previewMutation = trpc.distributorAdmin.roundTripPreview.useMutation({
    onSuccess: (result) => {
      if (pendingEditedCsv !== null) {
        setCsv(pendingEditedCsv);
        setEditingRow(null);
        setPendingEditedCsv(null);
        toast.success("Row corrected and the complete file was revalidated.");
      }
      setPreview(result as DistributorRoundTripPreview);
      setPreviewPage(1);
    },
    onError: (error) => { setPendingEditedCsv(null); toast.error(error.message); },
  });
  const commitMutation = trpc.distributorAdmin.roundTripCommit.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.rowsImported} rows: ${result.masterCodesReplaced} master codes replaced, ${result.aliasesAdded} aliases and ${result.distributorLinksAdded} eligible distributor links added.`);
      setPreview(null);
      setPreviewSearch("");
      setPreviewPage(1);
      setEditingRow(null);
      setPendingEditedCsv(null);
      setCsv("");
      setFileName("");
    },
    onError: (error) => toast.error(error.message),
  });

  async function downloadRoundTripTemplate() {
    setExporting(true);
    try {
      const result = await utils.distributorAdmin.roundTripExport.fetch();
      downloadCsv(result.csv, result.filename);
      toast.success(`Downloaded ${result.count} catalog records with aliases and eligible distributors.`);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not export distributor connections.");
    } finally {
      setExporting(false);
    }
  }

  function readCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose the CabinetDealz distributor connections CSV file.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("This connection file is too large. The maximum size is 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setFileName(file.name);
      setPreview(null);
      setPreviewSearch("");
      setPreviewPage(1);
      setEditingRow(null);
      setPendingEditedCsv(null);
    };
    reader.readAsText(file);
  }

  const hasBlockingErrors = Boolean(preview?.errors.length || preview?.rows.some((row) => row.errors.length));
  const hasUnreviewedEdits = Boolean(editingRow || pendingEditedCsv);
  const visiblePreviewRows = useMemo(
    () => filterDistributorRoundTripPreviewRows(preview?.rows ?? [], previewSearch),
    [preview?.rows, previewSearch]
  );
  const pagedPreviewRows = useMemo(
    () => paginateDistributorRoundTripPreviewRows(visiblePreviewRows, previewPage),
    [visiblePreviewRows, previewPage]
  );

  function startEditingRow(row: DistributorRoundTripPreview["rows"][number]) {
    setEditingRow({
      rowNumber: row.rowNumber,
      itemCode: row.itemCode,
      replacementMasterCode: row.replacementMasterCode ?? "",
      aliases: row.aliases.join("; "),
      eligibleDistributorCodes: row.eligibleDistributorCodes.join("; "),
    });
  }

  function revalidateEditedRow() {
    if (!editingRow) return;
    try {
      const editedCsv = applyDistributorRoundTripInlineEdit(csv, editingRow.rowNumber, editingRow);
      setPendingEditedCsv(editedCsv);
      previewMutation.mutate({ csv: editedCsv });
    } catch (error: any) {
      toast.error(error?.message ?? "Could not prepare the edited row for validation.");
    }
  }

  return (
    <Card className="border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-5 w-5 text-sky-700" /> Distributor connections — download & upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Download one round-trip CSV with the authoritative <strong className="text-foreground">item code</strong>, every recognized alias, and every eligible active distributor for each cabinet. Upload the same file to preview and add only reviewed aliases or eligible distributor links. To deliberately replace a master code, enter the new code in <strong className="text-foreground">ReplacementMasterCode</strong>; the former code stays as an alias so saved designs and orders continue to resolve. This workflow never changes prices, door styles, sellable SKUs, availability, or publication status.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={downloadRoundTripTemplate} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" /> {exporting ? "Preparing download…" : "Download connections CSV"}
          </Button>
          <input ref={fileRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={readCsvFile} />
          <Button type="button" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Upload connections CSV
          </Button>
        </div>

        {fileName && <p className="text-xs text-muted-foreground">Selected file: <span className="font-medium text-foreground">{fileName}</span></p>}
        {csv && !preview && (
          <Button type="button" variant="secondary" onClick={() => previewMutation.mutate({ csv })} disabled={previewMutation.isPending}>
            <FileCheck2 className="mr-2 h-4 w-4" /> {previewMutation.isPending ? "Checking file…" : "Preview changes"}
          </Button>
        )}

        {preview && (
          <div className="space-y-3 rounded-lg border border-sky-200 bg-white/80 p-4 dark:border-sky-900 dark:bg-slate-950/30">
            {preview.errors.length > 0 ? (
              <p className="text-sm font-medium text-destructive">{preview.errors.join(" ")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  <p><strong>{preview.summary.total}</strong> rows</p>
                  <p><strong>{preview.summary.matched}</strong> valid</p>
                  <p><strong>{preview.summary.masterCodesToReplace}</strong> master codes to replace</p>
                  <p><strong>{preview.summary.aliasesToAdd}</strong> aliases to add</p>
                  <p><strong>{preview.summary.distributorLinksToAdd}</strong> distributor links to add</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="distributor-preview-search">Find an item to verify</label>
                  <div className="flex max-w-2xl items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="distributor-preview-search" type="search" className="pl-9 pr-9" placeholder="Item code, master code, alias, or distributor" value={previewSearch} onChange={(event) => { setPreviewSearch(event.target.value); setPreviewPage(1); }} />
                      {previewSearch && <button type="button" aria-label="Clear preview search" onClick={() => { setPreviewSearch(""); setPreviewPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{visiblePreviewRows.length} of {preview.rows.length}</span>
                  </div>
                  <div className="max-h-64 overflow-auto rounded-md border" role="region" aria-label="Distributor connection upload preview">
                    <table className="w-full min-w-[780px] text-left text-xs">
                      <thead className="sticky top-0 bg-muted/95 text-muted-foreground"><tr><th className="p-2">Row</th><th className="p-2">Uploaded item</th><th className="p-2">Resolved master</th><th className="p-2">Replacement</th><th className="p-2">Aliases</th><th className="p-2">Eligible distributors</th><th className="p-2">Result</th><th className="p-2">Action</th></tr></thead>
                      <tbody>
                        {pagedPreviewRows.rows.map((row) => {
                          const isEditingThisRow = editingRow?.rowNumber === row.rowNumber;
                          return <tr key={row.rowNumber} className="border-t align-top"><td className="p-2 tabular-nums">{row.rowNumber}</td><td className="p-2 font-mono font-medium">{isEditingThisRow ? <Input aria-label={`Item code for row ${row.rowNumber}`} className="h-8 min-w-32 font-mono text-xs" value={editingRow.itemCode} onChange={(event) => setEditingRow((current) => current ? { ...current, itemCode: event.target.value } : current)} /> : row.itemCode}</td><td className="p-2 font-mono">{row.resolvedMasterCode ?? "Not found"}</td><td className="p-2 font-mono">{isEditingThisRow ? <Input aria-label={`Replacement master code for row ${row.rowNumber}`} className="h-8 min-w-32 font-mono text-xs" value={editingRow.replacementMasterCode} onChange={(event) => setEditingRow((current) => current ? { ...current, replacementMasterCode: event.target.value } : current)} /> : row.replacementMasterCode ?? "—"}</td><td className="p-2 font-mono">{isEditingThisRow ? <Input aria-label={`Aliases for row ${row.rowNumber}`} className="h-8 min-w-44 font-mono text-xs" value={editingRow.aliases} onChange={(event) => setEditingRow((current) => current ? { ...current, aliases: event.target.value } : current)} /> : row.aliases.join("; ") || "—"}</td><td className="p-2 font-mono">{isEditingThisRow ? <Input aria-label={`Eligible distributors for row ${row.rowNumber}`} className="h-8 min-w-44 font-mono text-xs" value={editingRow.eligibleDistributorCodes} onChange={(event) => setEditingRow((current) => current ? { ...current, eligibleDistributorCodes: event.target.value } : current)} /> : row.eligibleDistributorCodes.join("; ") || "—"}</td><td className={row.errors.length ? "p-2 text-destructive" : "p-2 text-emerald-700 dark:text-emerald-400"}>{row.errors.length ? row.errors.join(" ") : row.replacesMasterCode ? "Master code replacement ready" : "Ready"}</td><td className="p-2">{isEditingThisRow ? <div className="flex gap-1"><Button type="button" size="sm" aria-label={`Save and revalidate row ${row.rowNumber}`} disabled={previewMutation.isPending} onClick={revalidateEditedRow}><Save className="h-3.5 w-3.5" /><span className="sr-only">Save and revalidate</span></Button><Button type="button" size="sm" variant="outline" aria-label={`Cancel editing row ${row.rowNumber}`} disabled={previewMutation.isPending} onClick={() => setEditingRow(null)}><X className="h-3.5 w-3.5" /><span className="sr-only">Cancel</span></Button></div> : <Button type="button" size="sm" variant="outline" aria-label={`Edit row ${row.rowNumber}`} disabled={Boolean(editingRow) || previewMutation.isPending} onClick={() => startEditingRow(row)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}</td></tr>;
                        })}
                        {visiblePreviewRows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">No uploaded rows match “{previewSearch}”. Clear or change the search to review another item.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {visiblePreviewRows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-label="Preview table pagination"><span>Showing {pagedPreviewRows.startIndex + 1}–{pagedPreviewRows.endIndex} of {visiblePreviewRows.length} matching rows · Page {pagedPreviewRows.page} of {pagedPreviewRows.pageCount}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" aria-label="Previous preview page" disabled={pagedPreviewRows.page <= 1} onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}>Previous</Button><Button type="button" size="sm" variant="outline" aria-label="Next preview page" disabled={pagedPreviewRows.page >= pagedPreviewRows.pageCount} onClick={() => setPreviewPage((page) => Math.min(pagedPreviewRows.pageCount, page + 1))}>Next</Button></div></div>}
                  {editingRow && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Editing row {editingRow.rowNumber}. Save the row to revalidate the complete upload before import.</p>}
                </div>
                {preview.rows.some((row) => row.errors.length) && (
                  <div className="max-h-32 space-y-1 overflow-auto text-xs text-destructive">
                    {preview.rows.filter((row) => row.errors.length).map((row) => <p key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</p>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => { setPreview(null); setPreviewPage(1); setEditingRow(null); setPendingEditedCsv(null); }}>Choose another file</Button>
                  <Button type="button" disabled={hasBlockingErrors || hasUnreviewedEdits || commitMutation.isPending} onClick={() => commitMutation.mutate({ csv })}>
                    {commitMutation.isPending ? "Importing reviewed connections…" : hasUnreviewedEdits ? "Save and revalidate the edited row" : "Import aliases & eligible distributors"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        <Textarea className="min-h-24 font-mono text-xs" aria-label="Distributor connections CSV" placeholder="Paste a previously downloaded distributor connections CSV here, then choose Preview changes." value={csv} onChange={(event) => { setCsv(event.target.value); setFileName("Pasted CSV"); setPreview(null); setPreviewSearch(""); setPreviewPage(1); setEditingRow(null); setPendingEditedCsv(null); }} />
      </CardContent>
    </Card>
  );
}
