import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function CabinetSpreadsheetAdmin() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [xlsxBase64, setXlsxBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null);
  const utils = trpc.useUtils();

  // ── Download ────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  function downloadSpreadsheet() {
    setExporting(true);
    utils.cabinets.adminExport
      .fetch()
      .then(({ xlsx, filename, count }) => {
        const byteChars = atob(xlsx);
        const byteNums = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteNums], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${count} cabinets → ${filename}`);
      })
      .catch((e) => toast.error(e?.message ?? "Export failed"))
      .finally(() => setExporting(false));
  }

  // ── File pick ───────────────────────────────────────────────────────────────
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      // FileReader gives us a data-URL like "data:...;base64,<b64>"
      const dataUrl = String(reader.result ?? "");
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      setXlsxBase64(b64);
    };
    reader.readAsDataURL(f);
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const importMut = trpc.cabinets.adminImport.useMutation({
    onSuccess: (r) => {
      setResult(r);
      if (r.errors.length === 0) {
        toast.success(`Import complete — ${r.updated} updated, ${r.skipped} skipped.`);
      } else {
        toast.warning(`Import done with ${r.errors.length} issue(s) — see details below.`);
      }
      setXlsxBase64("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setImporting(false),
  });

  function runImport() {
    if (!xlsxBase64) return;
    setImporting(true);
    setResult(null);
    importMut.mutate({ xlsx: xlsxBase64 });
  }

  return (
    <div className="space-y-6">
      {/* ── Download card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Download cabinet spreadsheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground max-w-xl">
            Downloads every cabinet as one row in an Excel workbook (.xlsx). Editable columns:
            description, category, sub-category, placement type, dimensions (W/H/D), doors,
            drawers, hinge side, corner flag, corner side, graphic type, and active status.
            The <strong>masterCode</strong> column is the lookup key — do not change it.
          </p>
          <Button
            onClick={downloadSpreadsheet}
            disabled={exporting}
            className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
          >
            {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            Download cabinets.xlsx
          </Button>
        </CardContent>
      </Card>

      {/* ── Upload card ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload corrected spreadsheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Upload the corrected .xlsx file. Each row is matched by <strong>masterCode</strong>.
              Only rows whose data differs from the database will be updated — rows with an
              unknown masterCode are skipped and reported below.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {fileName ? fileName : "Choose .xlsx file…"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
            />
            <Button
              onClick={runImport}
              disabled={!xlsxBase64 || importing}
              className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
            >
              {importing ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Import
            </Button>
          </div>

          {/* ── Result summary ─────────────────────────────────────────────── */}
          {result && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {result.updated} updated
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  {result.skipped} skipped
                </Badge>
                {result.errors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
