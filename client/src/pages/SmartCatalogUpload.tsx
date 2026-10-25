// ─── Smart Catalog Upload Wizard ─────────────────────────────────────────────
// A guided 4-step wizard for importing a distributor price sheet:
//   Step 1: Pick or create a distributor
//   Step 2: Pick or create a door style + upload door sample photo
//   Step 3: Drop the spreadsheet, map columns, dry-run preview
//   Step 4: Confirm & commit
//
// Uses: distributorAdmin.addDistributor, addDoorStyle, parseXlsxColumns,
//       importWithMapping (dryRun=true for preview, dryRun=false to commit)

import { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Palette,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  Upload,
  AlertTriangle,
  X,
  Image as ImageIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STEPS = [
  { id: 1, label: "Distributor", icon: Building2 },
  { id: 2, label: "Door Style", icon: Palette },
  { id: 3, label: "Spreadsheet", icon: FileSpreadsheet },
  { id: 4, label: "Confirm", icon: CheckCircle2 },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active ? "bg-primary text-primary-foreground" :
              done ? "bg-primary/10 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Distributor ──────────────────────────────────────────────────────
function Step1Distributor({ onNext }: { onNext: (id: number, name: string) => void }) {
  const { data: dists, isLoading } = trpc.distributorAdmin.adminList.useQuery();
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const utils = trpc.useUtils();

  const addMut = trpc.distributorAdmin.addDistributor.useMutation({
    onSuccess: (d) => {
      toast.success(`Distributor "${d.name}" created.`);
      utils.distributorAdmin.adminList.invalidate();
      setSelected(String(d.id));
      setCreating(false);
      setNewName(""); setNewBrand("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleNext() {
    const dist = dists?.find((d) => String(d.id) === selected);
    if (dist) onNext(dist.id, dist.brandName || dist.name);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Select a Distributor</h2>
        <p className="text-sm text-muted-foreground">Choose which distributor this catalog belongs to, or create a new one.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Spinner className="h-4 w-4" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          <Label>Distributor</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Choose a distributor…" />
            </SelectTrigger>
            <SelectContent>
              {(dists ?? []).map((d: { id: number; name: string; brandName: string | null }) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.brandName || d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!creating ? (
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Create new distributor
        </button>
      ) : (
        <div className="border border-border rounded-lg p-4 space-y-3 max-w-sm">
          <h3 className="font-medium text-sm">New Distributor</h3>
          <div>
            <Label className="text-xs">Company Name *</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Acme Cabinets" className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Brand Name (optional)</Label>
            <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Acme" className="h-8 text-sm mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!newName.trim() || addMut.isPending} onClick={() => addMut.mutate({ name: newName.trim(), brandName: newBrand.trim() || undefined })}>
              {addMut.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button disabled={!selected} onClick={handleNext}>
          Next: Door Style <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Door Style ───────────────────────────────────────────────────────
function Step2DoorStyle({
  distributorId, distributorName,
  onNext, onBack,
}: {
  distributorId: number; distributorName: string;
  onNext: (id: number, code: string, name: string) => void;
  onBack: () => void;
}) {
  const { data: styles, isLoading } = trpc.doorStyles.list.useQuery({ distributorId });
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const addStyleMut = trpc.distributorAdmin.addDoorStyle.useMutation({
    onSuccess: (d) => {
      toast.success(`Door style "${d.ourName}" created.`);
      utils.doorStyles.list.invalidate({ distributorId });
      setSelected(String(d.id));
      setCreating(false);
      setNewName(""); setNewCode("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleNext() {
    const style = styles?.find((s) => String(s.id) === selected);
    if (style) onNext(style.id, style.styleCode, style.ourName ?? style.styleCode);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Select a Door Style</h2>
        <p className="text-sm text-muted-foreground">Choose the door style for <strong>{distributorName}</strong>, or create a new one.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Spinner className="h-4 w-4" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          <Label>Door Style</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Choose a door style…" />
            </SelectTrigger>
            <SelectContent>
              {(styles ?? []).map((s: { id: number; ourName: string | null; styleCode: string }) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.ourName ?? s.styleCode} ({s.styleCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!creating ? (
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Create new door style
        </button>
      ) : (
        <div className="border border-border rounded-lg p-4 space-y-3 max-w-sm">
          <h3 className="font-medium text-sm">New Door Style for {distributorName}</h3>
          <div>
            <Label className="text-xs">Display Name *</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Silver Shaker" className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Style Code *</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. SS-GRY" className="h-8 text-sm mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!newName.trim() || !newCode.trim() || addStyleMut.isPending}
              onClick={() => addStyleMut.mutate({ distributorId, ourName: newName.trim(), styleCode: newCode.trim() })}>
              {addStyleMut.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Optional door photo */}
      {selected && (
        <div className="space-y-2 max-w-sm">
          <Label className="text-sm font-medium">Door Sample Photo (optional)</Label>
          <p className="text-xs text-muted-foreground">Upload a high-res door swatch. The 3D Designer uses it to render cabinet finish colors accurately.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          {photoPreview ? (
            <div className="relative inline-block">
              <img src={photoPreview} alt="Door sample" className="w-32 h-32 object-cover rounded-lg border border-border" />
              <button onClick={() => { setPhotoPreview(null); }} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 border border-dashed border-border rounded-lg px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <ImageIcon className="h-4 w-4" /> Upload door photo
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button disabled={!selected} onClick={handleNext}>Next: Spreadsheet <ArrowRight className="h-4 w-4 ml-1" /></Button>
      </div>
    </div>
  );
}

// ─── Step 3: Spreadsheet ──────────────────────────────────────────────────────
type DryRunResult = { created: number; updated: number; priced: number; skipped: number; aliasMatched: number; unmatchedCount: number; unmatchedCodes: string[]; previewRows: unknown[]; dryRun: boolean };

function Step3Spreadsheet({
  distributorId, styleId, styleCode,
  onNext, onBack,
}: {
  distributorId: number; styleId: number; styleCode: string;
  onNext: (fileBase64: string, filename: string, sheetName: string, skuColIdx: number, priceColIdx: number, styleId: number, dryResult: DryRunResult) => void;
  onBack: () => void;
}) {
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [skuColIdx, setSkuColIdx] = useState<number>(-1);
  const [priceColIdx, setPriceColIdx] = useState<number>(-1);
  const [colHeaders, setColHeaders] = useState<string[]>([]);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMut = trpc.distributorAdmin.parseXlsxColumns.useMutation({
    onSuccess: (d) => {
      const sheet = d.sheets[0];
      if (!sheet) return;
      setSheetName(sheet.name);
      const hdrs = sheet.columns.map((c: { label: string }) => c.label);
      setColHeaders(hdrs);
      setHeaders(hdrs);
      // Auto-detect SKU and price columns by role
      const skuIdx = sheet.columns.findIndex((c: { role: string }) => c.role === "sku");
      const priceIdx = sheet.columns.findIndex((c: { role: string }) => c.role === "priceStyle");
      setSkuColIdx(skuIdx >= 0 ? skuIdx : 0);
      setPriceColIdx(priceIdx >= 0 ? priceIdx : -1);
      setDryResult(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const previewMut = trpc.distributorAdmin.importWithMapping.useMutation({
    onSuccess: (r) => setDryResult(r),
    onError: (e) => toast.error(e.message),
  });

  function loadFile(file: File) {
    setFilename(file.name);
    setHeaders([]);
    setDryResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string).split(",")[1];
      setFileBase64(b64);
      parseMut.mutate({ fileBase64: b64, filename: file.name, distributorId });
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  function runPreview() {
    if (!fileBase64 || skuColIdx < 0 || priceColIdx < 0) return;
    const mapping = [
      { colIdx: skuColIdx, role: "sku" as const },
      { colIdx: priceColIdx, role: "priceStyle" as const, styleId },
    ];
    previewMut.mutate({
      fileBase64, filename, sheetName: sheetName || "",
      distributorId, columnMapping: mapping, dryRun: true,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Upload Spreadsheet</h2>
        <p className="text-sm text-muted-foreground">Drop your XLSX or CSV price list for style <strong>{styleCode}</strong>.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        {parseMut.isPending ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Spinner className="h-8 w-8" />
            <p className="text-sm">Parsing file…</p>
          </div>
        ) : filename ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            <p className="font-medium text-sm">{filename}</p>
            <p className="text-xs text-muted-foreground">{colHeaders.length || headers.length} columns detected · Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-10 w-10" />
            <p className="font-medium text-sm">Drop XLSX or CSV here, or click to browse</p>
          </div>
        )}
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="space-y-3 max-w-md">
          <h3 className="font-medium text-sm">Column Mapping</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">SKU / Model Code *</Label>
              <Select value={skuColIdx >= 0 ? String(skuColIdx) : ""} onValueChange={(v) => setSkuColIdx(Number(v))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Price Column *</Label>
              <Select value={priceColIdx >= 0 ? String(priceColIdx) : ""} onValueChange={(v) => setPriceColIdx(Number(v))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={runPreview} disabled={skuColIdx < 0 || priceColIdx < 0 || previewMut.isPending}>
            {previewMut.isPending ? <Spinner className="h-3.5 w-3.5 mr-1" /> : null}
            Preview Import
          </Button>
        </div>
      )}

      {/* Dry-run results */}
      {dryResult && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">Preview Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{dryResult.aliasMatched + dryResult.created + dryResult.updated}</div>
              <div className="text-xs text-muted-foreground">Matched</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{dryResult.priced}</div>
              <div className="text-xs text-muted-foreground">Prices</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{dryResult.unmatchedCount}</div>
              <div className="text-xs text-muted-foreground">Unmatched</div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-2xl font-bold">{dryResult.skipped}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
          </div>
          {dryResult.unmatchedCodes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="flex items-center gap-1 mb-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Unmatched codes (first {dryResult.unmatchedCodes.length}):</span>
              <span className="font-mono">{dryResult.unmatchedCodes.slice(0, 10).join(", ")}{dryResult.unmatchedCodes.length > 10 ? ` +${dryResult.unmatchedCodes.length - 10} more` : ""}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button
          disabled={!dryResult || (dryResult.aliasMatched + dryResult.created + dryResult.updated) === 0}
          onClick={() => { if (fileBase64 && dryResult) onNext(fileBase64, filename, sheetName, skuColIdx, priceColIdx, styleId, dryResult); }}
        >
          Next: Confirm <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Confirm & Commit ─────────────────────────────────────────────────
function Step4Confirm({
  distributorId, styleId, distributorName, styleName,
  fileBase64, filename, sheetName, skuColIdx, priceColIdx, dryResult,
  onBack,
}: {
  distributorId: number; styleId: number;
  distributorName: string; styleName: string;
  fileBase64: string; filename: string; sheetName: string;
  skuColIdx: number; priceColIdx: number;
  dryResult: DryRunResult;
  onBack: () => void;
}) {
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);

  const commitMut = trpc.distributorAdmin.importWithMapping.useMutation({
    onSuccess: (r) => { setResult(r); setDone(true); toast.success(`Import complete: ${r.priced} prices applied.`); },
    onError: (e) => toast.error(e.message),
  });

  if (done && result) {
    return (
      <div className="text-center space-y-6 py-8">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
        <div>
          <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
          <p className="text-muted-foreground">
            Successfully imported <strong>{filename}</strong> for <strong>{distributorName} — {styleName}</strong>.
          </p>
        </div>
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center"><div className="text-2xl font-bold text-emerald-600">{result.created + result.updated + result.aliasMatched}</div><div className="text-muted-foreground">Matched</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-blue-600">{result.priced}</div><div className="text-muted-foreground">Priced</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-muted-foreground">{result.unmatchedCount}</div><div className="text-muted-foreground">Unmatched</div></div>
        </div>
        <div className="flex justify-center gap-3">
          <Link href="/admin"><Button variant="outline">Back to Admin</Button></Link>
          <Button onClick={() => window.location.reload()}>Import Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Confirm Import</h2>
        <p className="text-sm text-muted-foreground">Review the summary and click Commit to apply the import.</p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground mb-1">Distributor</div><div className="font-medium">{distributorName}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">Door Style</div><div className="font-medium">{styleName}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">File</div><div className="font-medium">{filename}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">SKU Column</div><div className="font-medium">Col {skuColIdx + 1}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">Price Column</div><div className="font-medium">Col {priceColIdx + 1}</div></div>
        </div>
        <div className="flex gap-4 pt-2 border-t border-border text-sm">
          <span className="text-emerald-600 font-medium">{dryResult.created + dryResult.updated + dryResult.aliasMatched} matched</span>
          <span className="text-blue-600 font-medium">{dryResult.priced} prices</span>
          {dryResult.unmatchedCount > 0 && <span className="text-amber-600 font-medium">{dryResult.unmatchedCount} unmatched (skipped)</span>}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={commitMut.isPending}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button
          disabled={(dryResult.created + dryResult.updated + dryResult.aliasMatched) === 0 || commitMut.isPending}
          onClick={() => commitMut.mutate({ fileBase64, filename, sheetName, distributorId, columnMapping: [{ colIdx: skuColIdx, role: "sku" }, { colIdx: priceColIdx, role: "priceStyle", styleId }], dryRun: false })}
        >
          {commitMut.isPending ? <Spinner className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Commit {dryResult.created + dryResult.updated + dryResult.aliasMatched} rows
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SmartCatalogUpload() {
  const [step, setStep] = useState(1);
  const [distributorId, setDistributorId] = useState<number | null>(null);
  const [distributorName, setDistributorName] = useState("");
  const [styleId, setStyleId] = useState<number | null>(null);
  const [styleCode, setStyleCode] = useState("");
  const [styleName, setStyleName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [filename, setFilename] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [skuColIdx, setSkuColIdx] = useState(-1);
  const [priceColIdx, setPriceColIdx] = useState(-1);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Admin
          </button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold">Smart Catalog Upload</h1>
      </div>

      <StepBar current={step} />

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        {step === 1 && (
          <Step1Distributor onNext={(id, name) => { setDistributorId(id); setDistributorName(name); setStep(2); }} />
        )}
        {step === 2 && distributorId != null && (
          <Step2DoorStyle
            distributorId={distributorId} distributorName={distributorName}
            onBack={() => setStep(1)}
            onNext={(id, code, name) => { setStyleId(id); setStyleCode(code); setStyleName(name); setStep(3); }}
          />
        )}
        {step === 3 && distributorId != null && styleId != null && (
          <Step3Spreadsheet
            distributorId={distributorId} styleId={styleId} styleCode={styleCode}
            onBack={() => setStep(2)}
            onNext={(b64, fname, sname, skuIdx, priceIdx, _sid, dr) => {
              setFileBase64(b64); setFilename(fname);
              setSheetName(sname); setSkuColIdx(skuIdx); setPriceColIdx(priceIdx);
              setDryResult(dr); setStep(4);
            }}
          />
        )}
        {step === 4 && distributorId != null && styleId != null && dryResult != null && (
          <Step4Confirm
            distributorId={distributorId} styleId={styleId}
            distributorName={distributorName} styleName={styleName}
            fileBase64={fileBase64} filename={filename} sheetName={sheetName}
            skuColIdx={skuColIdx} priceColIdx={priceColIdx}
            dryResult={dryResult}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
