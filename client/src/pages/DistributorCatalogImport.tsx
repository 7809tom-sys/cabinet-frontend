// ─── Demo Back Office › Products & Catalog › Spreadsheet catalog import ──────
// Client-side only: parse a CSV, validate rows, then show the catalog
// populating (lines → door styles → items) with a progress bar and a real
// elapsed-time counter. The last import is kept in localStorage; door-style
// pictures are local previews only.

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { CheckCircle2, Circle, Download, FileSpreadsheet, ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEMO_DISTRIBUTOR } from "@/lib/demoDistributor";
import {
  IMPORT_COPY,
  SAMPLE_CSV_PATH,
  formatElapsed,
  importCatalogCsv,
  summarizeImport,
  type ImportError,
  type ImportSummary,
} from "@/lib/demoCatalogImport";

const STORAGE_KEY = "demo-distributor-catalog-import";
const STEP_MS = 350; // per line / door style
const ITEM_TICK_MS = 60;
const ITEMS_PER_TICK = 6;

/** Real elapsed time between start() and stop(); ticks every 100 ms while running. */
export function useElapsedTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsedMs(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, [running]);
  const start = useCallback(() => {
    startedAt.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  }, []);
  const stop = useCallback(() => {
    if (startedAt.current != null) setElapsedMs(Date.now() - startedAt.current);
    setRunning(false);
  }, []);
  const reset = useCallback(() => {
    startedAt.current = null;
    setElapsedMs(0);
    setRunning(false);
  }, []);
  return { elapsedMs, running, start, stop, reset };
}

type Phase = "idle" | "lines" | "styles" | "items" | "done" | "failed";

export function DistributorCatalogImport() {
  const timer = useElapsedTimer();
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState({ lines: 0, styles: 0, items: 0 });
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const runId = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };
  useEffect(() => clearTimers, []);

  const animate = useCallback((s: ImportSummary) => {
    const id = runId.current;
    const at = (ms: number, fn: () => void) => timeouts.current.push(setTimeout(() => { if (runId.current === id) fn(); }, ms));
    let t = 0;
    setPhase("lines");
    for (let i = 1; i <= s.lineCount; i++) { t += STEP_MS; const n = i; at(t, () => setShown((v) => ({ ...v, lines: n }))); }
    at(t, () => setPhase("styles"));
    for (let i = 1; i <= s.doorStyleCount; i++) { t += STEP_MS; const n = i; at(t, () => setShown((v) => ({ ...v, styles: n }))); }
    at(t, () => setPhase("items"));
    for (let n = ITEMS_PER_TICK; n < s.itemCount + ITEMS_PER_TICK; n += ITEMS_PER_TICK) {
      t += ITEM_TICK_MS;
      const c = Math.min(n, s.itemCount);
      at(t, () => setShown((v) => ({ ...v, items: c })));
    }
    at(t + ITEM_TICK_MS, () => {
      setPhase("done");
      timer.stop();
    });
  }, [timer]);

  const run = useCallback((text: string) => {
    const result = importCatalogCsv(text);
    setErrors(result.errors);
    if (result.missingColumns.length || result.rows.length === 0) {
      setPhase("failed");
      setMessage(result.missingColumns.length ? `Missing column${result.missingColumns.length > 1 ? "s" : ""}: ${result.missingColumns.join(", ")}` : "No usable rows were found.");
      timer.stop();
      return;
    }
    const s = summarizeImport(result.rows);
    setSummary(s);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ summary: s, errors: result.errors.length }));
    } catch {
      /* ignore */
    }
    animate(s);
  }, [animate, timer]);

  const begin = () => {
    runId.current++;
    clearTimers();
    timer.reset();
    timer.start();
    setMessage(null);
    setErrors([]);
    setSummary(null);
    setShown({ lines: 0, styles: 0, items: 0 });
    setPhase("lines");
  };

  const loadSample = async () => {
    begin();
    try {
      const res = await fetch(SAMPLE_CSV_PATH);
      run(await res.text());
    } catch {
      setPhase("failed");
      setMessage("Could not read the sample file.");
      timer.stop();
    }
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    begin();
    if (!/\.csv$/i.test(file.name)) {
      setPhase("failed");
      setMessage(IMPORT_COPY.csvOnly);
      timer.stop();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => run(String(reader.result ?? ""));
    reader.onerror = () => { setPhase("failed"); setMessage("Could not read that file."); timer.stop(); };
    reader.readAsText(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => readFile(e.target.files?.[0]);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); };

  const total = summary ? summary.lineCount + summary.doorStyleCount + summary.itemCount : 0;
  const progress = phase === "done" ? 100 : total ? Math.round(((shown.lines + shown.styles + shown.items) / total) * 100) : 0;
  const busy = phase === "lines" || phase === "styles" || phase === "items";
  const styles = summary?.lines.flatMap((l) => l.doorStyles.map((s) => ({ ...s, line: l.name }))) ?? [];
  const picturesDone = styles.length > 0 && styles.every((s) => pictures[`${s.line}|${s.name}`]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4" style={{ color: DEMO_DISTRIBUTOR.primaryColor }} aria-hidden /> {IMPORT_COPY.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{IMPORT_COPY.body}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a href={SAMPLE_CSV_PATH} download="distributor-catalog-sample.csv">
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" aria-hidden /> {IMPORT_COPY.download}</Button>
          </a>
          <Button size="sm" className="gap-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} onClick={loadSample} disabled={busy}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> {IMPORT_COPY.loadSample}
          </Button>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm ${dragging ? "border-[#0f4c5c] bg-[#f3f8f9]" : "border-muted"}`}
        >
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span>{IMPORT_COPY.drop}</span>
          <span className="text-xs text-muted-foreground">{IMPORT_COPY.csvOnly}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label={IMPORT_COPY.upload} onChange={onPick} />
        </label>

        {phase !== "idle" && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="h-2 flex-1" aria-label="Import progress" />
              <span className="w-28 text-right text-sm tabular-nums" data-testid="import-elapsed">
                {phase === "done" ? IMPORT_COPY.loadedIn(formatElapsed(timer.elapsedMs)) : formatElapsed(timer.elapsedMs)}
              </span>
            </div>
            {busy && <p className="text-xs text-muted-foreground">{IMPORT_COPY.stages[phase as "lines" | "styles" | "items"]}…</p>}
            {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
            {summary && (
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <p><span className="text-2xl font-semibold tabular-nums">{shown.lines}</span> / {summary.lineCount} lines</p>
                <p><span className="text-2xl font-semibold tabular-nums">{shown.styles}</span> / {summary.doorStyleCount} door styles</p>
                <p><span className="text-2xl font-semibold tabular-nums">{shown.items}</span> / {summary.itemCount} items</p>
              </div>
            )}
            {summary && shown.lines > 0 && (
              <ul className="space-y-1 text-sm">
                {summary.lines.slice(0, shown.lines).map((l) => (
                  <li key={l.name}>
                    <span className="font-medium">{l.name}</span>
                    {shown.styles > 0 && <span className="text-muted-foreground"> · {l.doorStyles.map((s) => `${s.name}${s.code ? ` (${s.code})` : ""}`).join(", ")} · {l.items} items</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="import-errors">
            <p className="font-medium">{IMPORT_COPY.badRows(errors.length)}</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {errors.slice(0, 10).map((e) => <li key={e.rowNumber}>Row {e.rowNumber}: {e.reason}</li>)}
            </ul>
          </div>
        )}

        {phase === "done" && summary && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">{IMPORT_COPY.checklistTitle}</p>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {summary.lineCount} lines created</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {summary.doorStyleCount} door styles created</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {summary.itemCount} items with sizes and prices</li>
              <li className="flex items-center gap-2">
                {picturesDone ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}
                <span className="font-medium">{IMPORT_COPY.remaining}</span>
              </li>
            </ul>
            <ul className="grid gap-3 sm:grid-cols-3">
              {styles.map((s) => {
                const key = `${s.line}|${s.name}`;
                return (
                  <li key={key} className="rounded-md border p-2 text-xs">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground">{s.line}</p>
                    <label className="mt-2 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded bg-muted">
                      {pictures[key] ? <img src={pictures[key]} alt={`${s.name} door (your picture)`} className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-muted-foreground"><ImagePlus className="h-5 w-5" aria-hidden /> Add picture</span>}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label={`Add a picture for ${s.name}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPictures((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{IMPORT_COPY.demoNote}</p>
      </CardContent>
    </Card>
  );
}
