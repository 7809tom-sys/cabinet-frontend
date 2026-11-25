// Admin: upload a countertop fabrication shop list (CSV or XLSX, one state per
// file, e.g. "Countertop Fabrication Shops in Florida"). Columns are mapped in
// the browser, the server previews the import (new shops per state, how many
// have a ZIP, duplicates skipped), and nothing is written until "Import".

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
  FAB_SHOP_FIELDS,
  FAB_SHOP_FIELD_LABELS,
  FAB_SHOP_UPLOAD_MAX_ROWS,
  fabShopStateFromFileName,
  guessFabShopColumnMapping,
  mapFabShopRows,
  type FabShopColumnMapping,
  type FabShopField,
} from "@shared/fabricationShops";

const NONE = "__none__";

type Preview = {
  dryRun: boolean;
  inserted: number;
  toImport: number;
  byState: { state: string; toImport: number; duplicates: number; withZip: number }[];
  duplicates: { row: number; name: string; state: string; where: "in_file" | "in_list" }[];
  skipped: { row: number; name: string; reason: "missing_name" | "missing_state" | "hidden_brand" }[];
  zipFromCity: number;
  noZip: number;
};

const SKIP_LABELS: Record<Preview["skipped"][number]["reason"], string> = {
  missing_name: "no shop name",
  missing_state: "no state",
  hidden_brand: "left out (supplier name)",
};

export function FabricationShopUploadDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [mapping, setMapping] = useState<FabShopColumnMapping>({});
  const [defaultState, setDefaultState] = useState("");
  const [sourceDoc, setSourceDoc] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const importShops = trpc.fabShops.importShops.useMutation();

  const rows = useMemo(() => (table ? mapFabShopRows(table.rows, mapping) : []), [table, mapping]);

  const reset = () => { setFileName(""); setTable(null); setMapping({}); setDefaultState(""); setSourceDoc(""); setPreview(null); };

  const readFile = async (file?: File) => {
    if (!file) return;
    reset();
    setReading(true);
    try {
      const parsed = await readContactSpreadsheet(file);
      if (parsed.rows.length > FAB_SHOP_UPLOAD_MAX_ROWS) throw new Error(`That file has ${parsed.rows.length.toLocaleString()} rows; the limit is ${FAB_SHOP_UPLOAD_MAX_ROWS.toLocaleString()}. Split it by state.`);
      setFileName(file.name);
      setTable(parsed);
      setMapping(guessFabShopColumnMapping(parsed.headers));
      setDefaultState(fabShopStateFromFileName(file.name) ?? "");
      setSourceDoc(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      setReading(false);
    }
  };

  const setField = (field: FabShopField, value: string) => {
    setPreview(null);
    setMapping((current) => {
      const next = { ...current };
      if (value === NONE) delete next[field];
      else next[field] = Number(value);
      return next;
    });
  };

  const run = async (dryRun: boolean) => {
    try {
      const result = (await importShops.mutateAsync({ rows, sourceDoc: sourceDoc.trim() || fileName, defaultState: defaultState.trim() || null, dryRun })) as Preview;
      setPreview(result);
      if (!dryRun) {
        toast.success(`Imported ${result.inserted} fabrication shop${result.inserted === 1 ? "" : "s"}.`);
        await utils.fabShops.list.invalidate();
        await utils.fabShops.imports.invalidate();
        await utils.fabShops.forQuotes.invalidate();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The upload failed.");
    }
  };

  const imported = preview != null && !preview.dryRun;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="fab-shops-upload"><Upload className="mr-1 h-3.5 w-3.5" /> Upload shops</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Upload a fabrication shop list</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">CSV or XLSX, one state per file. The state and ZIP are read from each address. You'll see a preview by state before anything is added. A shop already on the list (same name in the same ZIP or city, or the same website in the same city) is skipped. Nothing is ever sent to a shop.</p>
        <Input type="file" accept=".csv,.xlsx,.xls,.txt" disabled={reading} onChange={(event) => readFile(event.target.files?.[0])} aria-label="Fabrication shop list file" />
        {table && (
          <div className="space-y-3">
            <div className="text-sm">{fileName}: {table.rows.length.toLocaleString()} rows</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">State for rows without one</Label><Input value={defaultState} onChange={(e) => { setDefaultState(e.target.value); setPreview(null); }} placeholder="e.g. FL" /></div>
              <div><Label className="text-xs">Source (saved on each shop)</Label><Input value={sourceDoc} onChange={(e) => setSourceDoc(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FAB_SHOP_FIELDS.map((field) => (
                <div key={field}>
                  <Label className="text-xs">{FAB_SHOP_FIELD_LABELS[field]}</Label>
                  <Select value={mapping[field] != null ? String(mapping[field]) : NONE} onValueChange={(value) => setField(field, value)}>
                    <SelectTrigger className="h-8" aria-label={`Column for ${FAB_SHOP_FIELD_LABELS[field]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>(not in file)</SelectItem>
                      {table.headers.map((header, index) => <SelectItem key={index} value={String(index)}>{header || `Column ${index + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
        {preview && (
          <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="fab-shops-preview">
            <div className="font-medium">{imported ? `Imported ${preview.inserted} shops.` : `${preview.toImport} new shops to import · ${preview.duplicates.length} duplicates skipped · ${preview.skipped.length} rows skipped`}</div>
            <div className="text-xs text-muted-foreground">{preview.zipFromCity} shops have no ZIP in their address and use another shop's ZIP in the same city. {preview.noZip} have no ZIP at all and only match quotes in their state.</div>
            <table className="w-full text-xs">
              <thead><tr className="text-left"><th>State</th><th>New</th><th>With ZIP</th><th>Duplicates skipped</th></tr></thead>
              <tbody>{preview.byState.map((s) => <tr key={s.state}><td>{s.state}</td><td>{s.toImport}</td><td>{s.withZip}</td><td>{s.duplicates}</td></tr>)}</tbody>
            </table>
            {preview.duplicates.length > 0 && (
              <details><summary className="cursor-pointer text-xs">Duplicates ({preview.duplicates.length})</summary>
                <ul className="text-xs">{preview.duplicates.slice(0, 50).map((d) => <li key={d.row}>Row {d.row}: {d.name} ({d.state}) — {d.where === "in_list" ? "already on the list" : "repeated in file"}</li>)}</ul>
              </details>
            )}
            {preview.skipped.length > 0 && (
              <details><summary className="cursor-pointer text-xs">Skipped rows ({preview.skipped.length})</summary>
                <ul className="text-xs">{preview.skipped.slice(0, 50).map((s) => <li key={s.row}>Row {s.row}: {s.name || "(blank)"} — {SKIP_LABELS[s.reason]}</li>)}</ul>
              </details>
            )}
          </div>
        )}
        <DialogFooter>
          {!imported && (
            <Button variant="outline" disabled={!rows.length || mapping.name == null || importShops.isPending} onClick={() => run(true)}>Preview</Button>
          )}
          {preview?.dryRun && preview.toImport > 0 && (
            <Button disabled={importShops.isPending} onClick={() => run(false)}>Import {preview.toImport} shops</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
