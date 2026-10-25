import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, PlusCircle, RefreshCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_UPLOAD_ROWS,
  parseUploadGrid,
  splitDelimited,
  type InvalidUploadRow,
  type UploadRow,
} from "@shared/vendorCodeUpload";

type Props = {
  /** Admins act on a named supply line; vendors are scoped by their account. */
  distributorId?: number;
  onDone?: () => void;
};

const TEMPLATE = "Code,Door,Price\nB24,Torino White,189.00\nW3030,Torino White,142.50\nSB36,Torino Grey,231.00\n";
const money = (n: number | null | undefined) => (n == null ? "-" : `$${n.toFixed(2)}`);

async function fileToGrid(file: File): Promise<string[][]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    // Loaded on demand so the spreadsheet reader never weighs down the portal.
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return [];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    return grid.map((r) => r.map((c) => String(c ?? "")));
  }
  return splitDelimited(await file.text());
}

export function VendorCodeUpload({ distributorId, onDone }: Props) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidUploadRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const scope = distributorId ? { distributorId } : {};

  const preview = trpc.vendorCodeUpload.preview.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const commit = trpc.vendorCodeUpload.commit.useMutation({
    onSuccess: (r) => {
      utils.distributorPortal.catalog.invalidate();
      utils.distributorPortal.myLine.invalidate();
      const bits = [r.added ? `${r.added} added` : "", r.updated ? `${r.updated} updated` : "", r.mastersCreated ? `${r.mastersCreated} new cabinet${r.mastersCreated === 1 ? "" : "s"}` : ""].filter(Boolean);
      toast.success(bits.length ? `Upload saved: ${bits.join(", ")}` : "Nothing needed to change");
      onDone?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const result = commit.data;
  const plan = preview.data;
  const busy = preview.isPending || commit.isPending;

  const load = (grid: string[][], label: string) => {
    const parsed = parseUploadGrid(grid);
    setRows(parsed.rows);
    setInvalid(parsed.invalid);
    setNotes(parsed.notes);
    setSource(label);
    setShowAll(false);
    commit.reset();
    if (parsed.rows.length === 0) {
      preview.reset();
      toast.error(parsed.invalid[0]?.message ?? "No rows found. Each row needs a code, a door name and a price.");
      return;
    }
    preview.mutate({ rows: parsed.rows, ...scope });
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      load(await fileToGrid(file), file.name);
    } catch (e) {
      toast.error(`Could not read that file${e instanceof Error ? `: ${e.message}` : "."}`);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "price-upload-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const problemRows = useMemo(() => (plan?.rows ?? []).filter((r) => r.action === "error"), [plan]);
  const visible = useMemo(() => {
    const all = plan?.rows ?? [];
    if (showAll) return all;
    // Problems first, then changes; unchanged rows stay out of the way.
    return [...all].sort((a, b) => rank(a) - rank(b)).filter((r) => r.action !== "unchanged").slice(0, 25);
  }, [plan, showAll]);
  const summary = plan?.summary;
  const canSave = !!summary && summary.added + summary.updated > 0 && !commit.isPending && !result;

  return (
    <Card data-testid="vendor-code-upload">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5" /> Upload by code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Three columns is all it takes: the cabinet <strong>code</strong>, the <strong>door name</strong> and the <strong>price</strong>.
          The code can be our master code or any alias we know. A code we don&apos;t recognise is added as a new cabinet and held for review
          before customers see it.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Choose file (.xlsx, .csv)
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <details className="rounded-md border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium">Or paste rows from a spreadsheet</summary>
          <div className="mt-3 space-y-2">
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder={"B24\tTorino White\t189.00\nW3030\tTorino White\t142.50"}
              className="font-mono text-xs"
              aria-label="Pasted rows: code, door, price"
            />
            <Button size="sm" variant="outline" disabled={!pasted.trim() || busy} onClick={() => load(splitDelimited(pasted), "pasted rows")}>
              Check pasted rows
            </Button>
          </div>
        </details>

        {source && (
          <p className="text-xs text-muted-foreground">
            Read {rows.length} row{rows.length === 1 ? "" : "s"} from {source}
            {invalid.length ? `; ${invalid.length} could not be read` : ""}. Up to {MAX_UPLOAD_ROWS} rows at a time.
            {notes.length ? ` ${notes.join(" ")}` : ""}
          </p>
        )}

        {invalid.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Rows we could not read</div>
            <ul className="space-y-0.5 text-xs">
              {invalid.slice(0, 10).map((r) => <li key={r.rowNumber}>Row {r.rowNumber}: {r.message}</li>)}
              {invalid.length > 10 && <li>…and {invalid.length - 10} more.</li>}
            </ul>
          </div>
        )}

        {summary && !result && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="gap-1"><PlusCircle className="h-3 w-3" /> {summary.added} to add</Badge>
              <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3" /> {summary.updated} price update{summary.updated === 1 ? "" : "s"}</Badge>
              {summary.unchanged > 0 && <Badge variant="outline">{summary.unchanged} already match</Badge>}
              {summary.newMasters > 0 && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> {summary.newMasters} new cabinet{summary.newMasters === 1 ? "" : "s"}</Badge>}
              {summary.viaAlias > 0 && <Badge variant="outline">{summary.viaAlias} matched by alias</Badge>}
              {summary.largeChanges > 0 && <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100"><AlertTriangle className="h-3 w-3" /> {summary.largeChanges} large price change{summary.largeChanges === 1 ? "" : "s"}</Badge>}
              {summary.errors > 0 && <Badge variant="destructive">{summary.errors} need attention</Badge>}
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-2">Row</th><th className="p-2">Code</th><th className="p-2">Door</th><th className="p-2">Price</th><th className="p-2">What happens</th></tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={`${r.rowNumber}-${r.code}-${r.door}`} className={r.action === "error" ? "bg-destructive/5" : r.largeChange ? "bg-amber-50" : ""}>
                      <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                      <td className="p-2 font-mono">{r.code}{r.masterCode && r.matchedVia === "alias" ? <span className="text-muted-foreground"> → {r.masterCode}</span> : null}</td>
                      <td className="p-2">{r.styleName ?? r.door}</td>
                      <td className="p-2 whitespace-nowrap">{r.action === "update" && r.oldPrice != null && r.newPrice != null ? `${money(r.oldPrice)} → ${money(r.newPrice)}` : money(r.newPrice ?? r.newCost)}</td>
                      <td className={`p-2 ${r.action === "error" ? "text-destructive" : r.largeChange ? "font-medium text-amber-900" : ""}`}>{r.message}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Everything in this file already matches your catalog.</td></tr>}
                </tbody>
              </table>
            </div>
            {(plan?.rows.length ?? 0) > visible.length && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAll(true)}>Show all {plan?.rows.length} rows</Button>
            )}
            {problemRows.length > 0 && <p className="text-xs text-muted-foreground">Rows that need attention are skipped; everything else is saved.</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!canSave} onClick={() => commit.mutate({ rows, ...scope })}>
                {commit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save {summary.added + summary.updated} change{summary.added + summary.updated === 1 ? "" : "s"}
              </Button>
              <span className="text-xs text-muted-foreground">New items stay in review until approved. Price changes to items that are already live take effect right away.</span>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/20" role="status">
            <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Upload saved</div>
            <div>{result.added} added · {result.updated} updated · {result.mastersCreated} new cabinet{result.mastersCreated === 1 ? "" : "s"} · {result.skipped} skipped</div>
            {result.failures.length > 0 && (
              <ul className="text-xs text-destructive">
                {result.failures.slice(0, 8).map((f) => <li key={f.rowNumber}>Row {f.rowNumber}: {f.message}</li>)}
              </ul>
            )}
            <Button size="sm" variant="outline" onClick={() => { setRows([]); setInvalid([]); setSource(null); setPasted(""); preview.reset(); commit.reset(); }}>Upload another file</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function rank(r: { action: string; largeChange?: boolean }): number {
  return r.action === "error" ? 0 : r.largeChange ? 1 : r.action === "add" ? 2 : r.action === "update" ? 3 : 4;
}
