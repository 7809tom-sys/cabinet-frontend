import { useState, useRef, useCallback, useMemo } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Link2,
  ArrowRight,
  RefreshCw,
  Search,
  X,
  Layers,
  Tag,
  Sparkles,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DistributorRoundTripTransfer } from "./DistributorRoundTripTransfer";

const VALID_CATEGORIES = ["Base", "Wall", "Tall", "ADA", "Vanity", "Accessory"] as const;

// ─── RecognitionPanel: resolve unknown categories & unmatched codes ──────────

function RecognitionPanel({
  unknownCategories,
  unmatchedCodes,
  distributorId,
  onAliasResolved,
  onCodeAssigned,
}: {
  unknownCategories: string[];
  unmatchedCodes: string[];
  distributorId: number | null;
  onAliasResolved: (raw: string, platform: string) => void;
  onCodeAssigned: (code: string, cabinetId: number, label: string) => void;
}) {
  const [aliasSelections, setAliasSelections] = useState<Record<string, string>>({});
  const [savedAliases, setSavedAliases] = useState<Set<string>>(new Set());
  const [assignedCodes, setAssignedCodes] = useState<Set<string>>(new Set());
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState<Record<string, string>>({});
  const saveAliasMut = trpc.distributorAdmin.adminSaveCategoryAlias.useMutation();

  const pendingCategories = unknownCategories.filter((c) => !savedAliases.has(c));
  const pendingCodes = unmatchedCodes.filter((c) => !assignedCodes.has(c));

  if (pendingCategories.length === 0 && pendingCodes.length === 0) return null;

  return (
    <div className="space-y-3 mb-3">
      {/* Unknown category aliases */}
      {pendingCategories.length > 0 && (
        <div className="rounded-lg border border-blue-300 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-700 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            <Tag className="h-4 w-4" />
            {pendingCategories.length} unknown categor{pendingCategories.length !== 1 ? "ies" : "y"} — save aliases to auto-map on future imports
          </p>
          <div className="space-y-2">
            {pendingCategories.map((raw) => (
              <div key={raw} className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                  {raw}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={aliasSelections[raw] ?? ""}
                  onValueChange={(v) => setAliasSelections((p) => ({ ...p, [raw]: v }))}
                >
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue placeholder="Pick category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs px-3"
                  disabled={!aliasSelections[raw] || saveAliasMut.isPending}
                  onClick={async () => {
                    const platform = aliasSelections[raw];
                    if (!platform) return;
                    try {
                      await saveAliasMut.mutateAsync({
                        rawCategory: raw,
                        platformCategory: platform,
                        distributorId: distributorId ?? null,
                      });
                      setSavedAliases((p) => new Set(Array.from(p).concat(raw)));
                      onAliasResolved(raw, platform);
                      toast.success(`Alias saved: "${raw}" → ${platform}`);
                    } catch (e: any) {
                      toast.error(`Failed to save alias: ${e?.message ?? "Unknown error"}`);
                    }
                  }}
                >
                  Save Alias
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched master codes */}
      {pendingCodes.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-700 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">
            <Sparkles className="h-4 w-4" />
            {pendingCodes.length} unmatched code{pendingCodes.length !== 1 ? "s" : ""} — assign to master cabinets to resolve all matching rows at once
          </p>
          <div className="space-y-2">
            {pendingCodes.slice(0, 20).map((code) => (
              <div key={code} className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-700">
                  {code}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Popover
                  open={openPopover === code}
                  onOpenChange={(o) => setOpenPopover(o ? code : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border border-dashed border-orange-400 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                      <Search className="h-3 w-3" />
                      Assign master…
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <p className="text-xs text-muted-foreground mb-1.5">Search and pick the master cabinet for <span className="font-mono font-medium">{code}</span></p>
                    <UnmatchedCodeSearch
                      code={code}
                      q={searchQ[code] ?? ""}
                      onQChange={(v) => setSearchQ((p) => ({ ...p, [code]: v }))}
                      onSelect={(cabId, label) => {
                        setAssignedCodes((p) => new Set(Array.from(p).concat(code)));
                        setOpenPopover(null);
                        onCodeAssigned(code, cabId, label);
                        toast.success(`"${code}" → ${label} — all matching rows updated`);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
            {pendingCodes.length > 20 && (
              <p className="text-xs text-muted-foreground">…and {pendingCodes.length - 20} more. Use the per-row assign buttons in the table below for the rest.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UnmatchedCodeSearch({
  code,
  q,
  onQChange,
  onSelect,
}: {
  code: string;
  q: string;
  onQChange: (v: string) => void;
  onSelect: (cabinetId: number, label: string) => void;
}) {
  const { data: results, isFetching } = trpc.genericCabinets.searchForMatch.useQuery(
    { q: q || code },
    { enabled: true }
  );
  return (
    <div>
      <Input
        autoFocus
        placeholder="Search cabinets…"
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        className="h-7 text-xs mb-1.5"
      />
      {isFetching && <p className="py-2 text-center text-xs text-muted-foreground">Searching…</p>}
      {!isFetching && results && results.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">No results</p>
      )}
      <ul className="max-h-48 overflow-auto space-y-0.5">
        {results?.map((cab) => (
          <li key={cab.id}>
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={() => onSelect(cab.id, cab.masterCode)}
            >
              <span className="font-mono font-medium">{cab.masterCode}</span>
              {cab.description && (
                <span className="ml-1.5 text-muted-foreground">{cab.description}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── BulkAssignBar: floating action bar for multi-row cabinet assignment ───────

function BulkAssignBar({
  selectedCount,
  onAssign,
  onClear,
}: {
  selectedCount: number;
  onAssign: (cabinetId: number, label: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: results, isFetching } = trpc.genericCabinets.searchForMatch.useQuery(
    { q: q || "" },
    { enabled: open && q.length > 0 }
  );

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 rounded-lg border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700 px-4 py-2.5 shadow-sm mb-2">
      <Layers className="h-4 w-4 text-violet-700 dark:text-violet-300 shrink-0" />
      <span className="text-sm font-medium text-violet-900 dark:text-violet-200">
        {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" className="ml-auto gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
            <Search className="h-3.5 w-3.5" />
            Assign Cabinet to All Selected
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="end">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Search and pick a cabinet — it will be assigned to all {selectedCount} selected row{selectedCount !== 1 ? "s" : ""}.
          </p>
          <Input
            autoFocus
            placeholder="Search cabinets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-7 text-xs mb-1.5"
          />
          {q.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">Type to search…</p>
          )}
          {q.length > 0 && isFetching && (
            <p className="py-2 text-center text-xs text-muted-foreground">Searching…</p>
          )}
          {q.length > 0 && !isFetching && results && results.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">No results</p>
          )}
          <ul className="max-h-52 overflow-auto space-y-0.5">
            {results?.map((cab) => (
              <li key={cab.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onAssign(cab.id, cab.masterCode);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="font-mono font-medium">{cab.masterCode}</span>
                  {cab.description && (
                    <span className="ml-1.5 text-muted-foreground">{cab.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-violet-700 dark:text-violet-300 hover:text-violet-900"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
}

// ─── MatchDropdown: per-row cabinet search/override ─────────────────────────

function MatchDropdown({
  rowNum,
  defaultCode,
  defaultLabel,
  matchHow,
  overrideCabinetId,
  onSelect,
  onClear,
}: {
  rowNum: number;
  defaultCode: string;
  defaultLabel: string | null;
  matchHow: string;
  overrideCabinetId: number | undefined;
  onSelect: (cabinetId: number, label: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useMemo(() => q, [q]);
  const { data: results, isFetching } = trpc.genericCabinets.searchForMatch.useQuery(
    { q: debouncedQ || defaultCode },
    { enabled: open }
  );

  const isOverridden = overrideCabinetId != null;
  const label = isOverridden
    ? results?.find((r) => r.id === overrideCabinetId)?.masterCode ?? `Cabinet #${overrideCabinetId}`
    : defaultLabel ?? defaultCode;

  const badgeClass =
    matchHow === "exact" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    : matchHow === "alias" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    : matchHow === "override" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
    : "bg-destructive/10 text-destructive";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${badgeClass}`}
          title="Click to change cabinet match"
        >
          <span className="max-w-[120px] truncate">{label}</span>
          <Search className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="mb-1.5 flex items-center gap-1">
          <Input
            autoFocus
            placeholder="Search cabinets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-7 text-xs"
          />
          {isOverridden && (
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              title="Clear override"
              onClick={() => { onClear(); setOpen(false); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isFetching && <p className="py-2 text-center text-xs text-muted-foreground">Searching…</p>}
        {!isFetching && results && results.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No results</p>
        )}
        <ul className="max-h-48 overflow-auto space-y-0.5">
          {results?.map((cab) => (
            <li key={cab.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground ${
                  (isOverridden ? overrideCabinetId : undefined) === cab.id ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
                onClick={() => { onSelect(cab.id, cab.masterCode); setOpen(false); setQ(""); }}
              >
                <span className="font-mono">{cab.masterCode}</span>
                {cab.description && (
                  <span className="ml-1.5 text-muted-foreground truncate">{cab.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ─── StyleSearchDropdown: global style search for column mapping ───────────────

const PLATFORM_CATEGORIES = ["Base", "Wall", "Tall", "ADA", "Vanity", "Accessory", "Corner", "Specialty"] as const;

function StyleSearchDropdown({
  distributorId,
  value,
  onSelect,
}: {
  distributorId: number;
  value: { id: number; styleCode: string; ourName: string } | null;
  onSelect: (style: { id: number; styleCode: string; ourName: string; isNew: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // "create" sub-panel state
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating2, setCreating2] = useState(false); // submitting spinner

  const createStyleMut = trpc.distributorAdmin.adminCreateStyleForDistributor.useMutation();
  const addStyleMut = trpc.distributorAdmin.addDoorStyle.useMutation();
  const { data: allStyles, isFetching } = trpc.distributorAdmin.adminAllStyles.useQuery(
    undefined,
    { enabled: open }
  );
  const filtered = allStyles?.filter((s) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    return s.styleCode.toLowerCase().includes(lq) || s.ourName.toLowerCase().includes(lq);
  }) ?? [];

  function resetCreate() {
    setCreating(false);
    setNewCode("");
    setNewName("");
    setCreating2(false);
  }

  async function handleCreate() {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) return;
    setCreating2(true);
    try {
      const res = await addStyleMut.mutateAsync({ distributorId, styleCode: code, ourName: name });
      onSelect({ id: res.id, styleCode: code, ourName: name, isNew: true });
      setOpen(false);
      resetCreate();
      toast.success(`Door style "${code} — ${name}" created and assigned.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create style");
      setCreating2(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetCreate(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border transition-colors hover:bg-accent ${
            value ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300" : "border-dashed border-muted-foreground/40 text-muted-foreground"
          }`}
        >
          {value ? (
            <span className="max-w-[160px] truncate">{value.styleCode} — {value.ourName}</span>
          ) : (
            <span>Assign style…</span>
          )}
          <Search className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {creating ? (
          /* ── Create new door style sub-panel ── */
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Create new door style</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Style code (e.g. HD)</label>
              <Input
                autoFocus
                placeholder="Style code…"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="h-7 text-xs font-mono"
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Display name (e.g. Haven Dune)</label>
              <Input
                placeholder="Display name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7 text-xs"
                maxLength={80}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <div className="flex gap-1.5 pt-0.5">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                disabled={!newCode.trim() || !newName.trim() || creating2}
                onClick={handleCreate}
              >
                {creating2 ? <Spinner className="h-3 w-3 mr-1" /> : null}
                Create & assign
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={resetCreate}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ── Search panel ── */
          <>
            <Input
              autoFocus
              placeholder="Search all styles…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-7 text-xs mb-1.5"
            />
            {isFetching && <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>}
            <ul className="max-h-48 overflow-auto space-y-0.5">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground ${
                      value?.id === s.id ? "bg-accent text-accent-foreground font-medium" : ""
                    }`}
                    onClick={async () => {
                      setOpen(false);
                      setQ("");
                      if (s.distributorId === distributorId) {
                        onSelect({ id: s.id, styleCode: s.styleCode, ourName: s.ourName, isNew: false });
                      } else {
                        // Clone style for this distributor
                        try {
                          const res = await createStyleMut.mutateAsync({ sourceStyleId: s.id, distributorId });
                          onSelect({ id: res.id, styleCode: s.styleCode, ourName: s.ourName, isNew: res.created });
                        } catch {
                          onSelect({ id: s.id, styleCode: s.styleCode, ourName: s.ourName, isNew: false });
                        }
                      }
                    }}
                  >
                    <span className="font-mono">{s.styleCode}</span>
                    <span className="ml-1.5 text-muted-foreground">{s.ourName}</span>
                    {s.distributorId !== distributorId && (
                      <span className="ml-1.5 text-xs text-blue-500 dark:text-blue-400">(from {s.distributorName ?? "other"})</span>
                    )}
                  </button>
                </li>
              ))}
              {!isFetching && filtered.length === 0 && (
                <li className="py-2 text-center text-xs text-muted-foreground">No styles found</li>
              )}
            </ul>
            {/* Always show "Create new" at the bottom */}
            <div className="border-t mt-1.5 pt-1.5">
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1.5 font-medium"
                onClick={() => { setCreating(true); setQ(""); }}
              >
                <span className="text-base leading-none">+</span>
                Create new door style for this distributor
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── CSV import helpers ────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "create-info": "New item",
  "update-info": "Update",
  "price-only": "Price only",
  error: "Error",
};
const ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  "create-info": "default",
  "update-info": "secondary",
  "price-only": "outline",
  error: "destructive",
};

// ─── XLSX column-mapping types ─────────────────────────────────────────────────

type ParsedColumn = {
  colIdx: number;
  rawHeader: string;
  label: string;
  role: string;
  styleId: number | null;
  styleCode: string | null;
  styleLabel: string | null;
  sampleValues: string[];
};

type ParseResult = inferRouterOutputs<AppRouter>["distributorAdmin"]["parseXlsxColumns"];
type ImportResult = inferRouterOutputs<AppRouter>["distributorAdmin"]["importWithMapping"];

const ROLE_LABELS: Record<string, string> = {
  sku: "SKU / Item Code",
  category: "Category",
  subCategory: "Sub-Category",
  description: "Description",
  dimensions: "Dimensions",
  dimWidth: "Width (inches)",
  dimHeight: "Height (inches)",
  dimDepth: "Depth (inches)",
  weight: "Weight (lbs)",
  assemble: "Assembled (0/1)",
  priceStyle: "Price (door style)",
  ignore: "Ignore",
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function DistributorImport() {
  // ── shared state ──────────────────────────────────────────────────────────
  const [distributorId, setDistributorId] = useState<string>("");
  const utils = trpc.useUtils();
  const { data: dists } = trpc.distributorAdmin.adminList.useQuery();

  // ── PDF converter state ────────────────────────────────────────────────────
  type PdfStep = "upload" | "converting" | "done";
  const [pdfStep, setPdfStep] = useState<PdfStep>("upload");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [pdfResult, setPdfResult] = useState<{ xlsxBase64: string; filename: string; rowCount: number; styleCodes: string[] } | null>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const pdfConvertMut = trpc.distributorAdmin.pdfToXlsx.useMutation({
    onSuccess: (data) => {
      setPdfResult(data);
      setPdfStep("done");
    },
    onError: (e) => {
      toast.error(`PDF conversion failed: ${e.message}`);
      setPdfStep("upload");
    },
  });

  function onPdfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a PDF file.");
      return;
    }
    setPdfFilename(f.name);
    setPdfStep("converting");
    setPdfResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1] ?? "";
      pdfConvertMut.mutate({ fileBase64: b64, filename: f.name });
    };
    reader.readAsDataURL(f);
  }

  function downloadPdfXlsx() {
    if (!pdfResult) return;
    const bytes = Uint8Array.from(atob(pdfResult.xlsxBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfResult.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${pdfResult.filename}`);
  }

  function loadPdfXlsxIntoImport() {
    if (!pdfResult || !distributorId) {
      toast.error("Select a distributor first, then use \"Open in Import\" again.");
      return;
    }
    setXlsxFilename(pdfResult.filename);
    setXlsxFileBase64(pdfResult.xlsxBase64);
    setXlsxStep("upload");
    setParseResult(null);
    setXlsxResult(null);
    parseMut.mutate({
      fileBase64: pdfResult.xlsxBase64,
      filename: pdfResult.filename,
      distributorId: Number(distributorId),
    });
    // Switch to xlsx tab
    const xlsxTrigger = document.querySelector<HTMLButtonElement>('[data-value="xlsx"]');
    xlsxTrigger?.click();
    toast.info("PDF converted — review column mapping before committing.");
  }

  // ── CSV import state ──────────────────────────────────────────────────────
  const [styleId, setStyleId] = useState<string>("");
  const [csv, setCsv] = useState<string>("");
  const csvFileRef = useRef<HTMLInputElement>(null);
  const { data: styles } = trpc.distributorAdmin.adminStyles.useQuery(
    { distributorId: Number(distributorId) },
    { enabled: Boolean(distributorId) }
  );
  type PreviewData = inferRouterOutputs<AppRouter>["distributorAdmin"]["importPreview"];
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const previewMut = trpc.distributorAdmin.importPreview.useMutation({
    onSuccess: (data) => setPreview(data),
    onError: (e) => toast.error(e.message),
  });
  const commitMut = trpc.distributorAdmin.importCommit.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Imported: ${r.created} created, ${r.updated} updated, ${r.priced} priced, ${r.skipped} skipped.`
      );
      setPreview(null);
      setCsv("");
    },
    onError: (e) => toast.error(e.message),
  });

  // ── XLSX import state ─────────────────────────────────────────────────────
  type XlsxStep = "upload" | "mapping" | "preview" | "done";
  const [xlsxStep, setXlsxStep] = useState<XlsxStep>("upload");
  const [xlsxFileBase64, setXlsxFileBase64] = useState<string>("");
  const [xlsxFilename, setXlsxFilename] = useState<string>("");
  const [xlsxSheetName, setXlsxSheetName] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ParsedColumn[]>([]);
  const [xlsxResult, setXlsxResult] = useState<ImportResult | null>(null);
  // Per-row cabinet match overrides: rowNum → cabinetId (admin-selected)
  const [matchOverrides, setMatchOverrides] = useState<Record<number, number>>({});
  // Per-cell inline edits: "rowNum:field" → corrected string value
  // field is one of: "dimensions", "price:<styleCode>"
  const [cellEdits, setCellEdits] = useState<Record<string, string>>({});
  // Bulk-assign: set of selected rowNums (only error rows are selectable)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const xlsxFileRef = useRef<HTMLInputElement>(null);

  const parseMut = trpc.distributorAdmin.parseXlsxColumns.useMutation({
    onSuccess: (data) => {
      setParseResult(data);
      const firstSheet = data.sheets[0];
      if (firstSheet) {
        setXlsxSheetName(firstSheet.name);
        setColumnMapping(firstSheet.columns as ParsedColumn[]);
      }
      setXlsxStep("mapping");
    },
    onError: (e) => toast.error(`Parse failed: ${e.message}`),
  });

  const xlsxPreviewMut = trpc.distributorAdmin.importWithMapping.useMutation({
    onSuccess: (data) => {
      setXlsxResult(data);
      setXlsxStep("preview");
    },
    onError: (e) => toast.error(`Preview failed: ${e.message}`),
  });

  const xlsxCommitMut = trpc.distributorAdmin.importWithMapping.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Import complete: ${data.created} created, ${data.updated} updated, ${data.priced} price rows upserted, ${data.skipped} skipped.`
      );
      setXlsxStep("done");
      setXlsxResult(data);
    },
    onError: (e) => toast.error(`Commit failed: ${e.message}`),
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  const [exporting, setExporting] = useState(false);
  function downloadMasterCatalog() {
    setExporting(true);
    utils.distributorAdmin.catalogExport
      .fetch()
      .then(({ csv, filename, count }) => {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${count} cabinets to ${filename}`);
      })
      .catch((e) => toast.error(e?.message ?? "Export failed"))
      .finally(() => setExporting(false));
  }

  function downloadTemplate() {
    utils.distributorAdmin.importTemplate.fetch().then(({ csv }) => {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cabinet-dealz-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setPreview(null);
    };
    reader.readAsText(f);
  }

  const onXlsxFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (!distributorId) {
        toast.error("Please select a distributor first.");
        return;
      }
      setXlsxFilename(f.name);
      setXlsxStep("upload");
      setParseResult(null);
      setXlsxResult(null);
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1] ?? "";
        setXlsxFileBase64(b64);
        parseMut.mutate({
          fileBase64: b64,
          filename: f.name,
          distributorId: Number(distributorId),
        });
      };
      reader.readAsDataURL(f);
    },
    [distributorId, parseMut]
  );

  function updateColRole(colIdx: number, newRole: string) {
    setColumnMapping((prev) =>
      prev.map((c) =>
        c.colIdx === colIdx ? { ...c, role: newRole } : c
      )
    );
  }

  function updateColStyle(colIdx: number, newStyleId: string) {
    const style = parseResult?.distributorStyles.find(
      (s) => String(s.id) === newStyleId
    );
    setColumnMapping((prev) =>
      prev.map((c) =>
        c.colIdx === colIdx
          ? {
              ...c,
              role: "priceStyle",
              styleId: style ? style.id : null,
              styleCode: style?.styleCode ?? null,
              styleLabel: style?.ourName ?? null,
            }
          : c
      )
    );
  }

  function runXlsxImport(dryRun: boolean) {
    const mappingInput = columnMapping.map((c) => ({
      colIdx: c.colIdx,
      role: c.role as
        | "sku"
        | "category"
        | "subCategory"
        | "description"
        | "dimensions"
        | "priceStyle"
        | "assemble"
        | "weight"
        | "ignore",
      styleId: c.styleId ?? undefined,
    }));
    // Convert matchOverrides keys to strings for z.record
    const overridesForPayload: Record<string, number> = {};
    for (const [k, v] of Object.entries(matchOverrides)) {
      overridesForPayload[String(k)] = v;
    }
    const payload = {
      fileBase64: xlsxFileBase64,
      filename: xlsxFilename,
      sheetName: xlsxSheetName,
      distributorId: Number(distributorId),
      columnMapping: mappingInput,
      matchOverrides: overridesForPayload,
      cellEdits: Object.keys(cellEdits).length > 0 ? cellEdits : undefined,
      dryRun,
    };
    if (dryRun) {
      xlsxPreviewMut.mutate(payload);
    } else {
      xlsxCommitMut.mutate(payload);
    }
  }

  function resetXlsx() {
    setXlsxStep("upload");
    setXlsxFileBase64("");
    setXlsxFilename("");
    setXlsxSheetName("");
    setParseResult(null);
    setColumnMapping([]);
    setXlsxResult(null);
    setMatchOverrides({});
    setCellEdits({});
    setSelectedRows(new Set());
    if (xlsxFileRef.current) xlsxFileRef.current.value = "";
  }

  const canRunCsv = Boolean(distributorId) && csv.trim().length > 0;
  const priceStyleCols = columnMapping.filter(
    (c) => c.role === "priceStyle" && c.styleId != null
  );
  const skuCol = columnMapping.find((c) => c.role === "sku");

  // Bulk-assign derived helpers
  const errorRowNums = (xlsxResult?.previewRows ?? []).filter((r) => {
    const issues = (r as any).issues as Array<{ severity: string }> | undefined;
    return issues ? issues.some((i) => i.severity === "error") : (r as any).severity === "error";
  }).map((r) => r.rowNum);
  const allErrorRowsSelected =
    errorRowNums.length > 0 && errorRowNums.every((n) => selectedRows.has(n));
  const someErrorRowsSelected = errorRowNums.some((n) => selectedRows.has(n));
  function toggleAllErrorRows() {
    if (allErrorRowsSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(errorRowNums));
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Master catalog export ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Master catalog export
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground max-w-xl">
            Download every cabinet as one row (code, description, category,
            sub-category, dimensions, doors/drawers, graphic type, and how many
            supply lines carry it). Review and mark corrections, then re-import
            via the panel below.
          </p>
          <Button
            onClick={downloadMasterCatalog}
            disabled={exporting}
            className="shrink-0"
          >
            {exporting ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download master catalog (CSV)
          </Button>
        </CardContent>
      </Card>

      <DistributorRoundTripTransfer />

      {/* ── Import tabs ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Distributor product import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Distributor picker — shared across both tabs */}
          <div className="max-w-xs">
            <label className="text-sm font-medium">
              Distributor line <span className="text-destructive">*</span>
            </label>
            <Select
              value={distributorId}
              onValueChange={(v) => {
                setDistributorId(v);
                setStyleId("");
                setPreview(null);
                resetXlsx();
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a distributor" />
              </SelectTrigger>
              <SelectContent>
                {(dists ?? []).map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.brandName ? ` (${d.brandName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="xlsx">
            <TabsList>
              <TabsTrigger value="xlsx">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> XLSX / Excel
              </TabsTrigger>
              <TabsTrigger value="csv">CSV / paste</TabsTrigger>
              <TabsTrigger value="pdf">
                <Upload className="mr-1.5 h-4 w-4" /> PDF → Excel
              </TabsTrigger>
            </TabsList>

            {/* ── XLSX tab ─────────────────────────────────────────────────── */}
            <TabsContent value="xlsx" className="space-y-5 pt-2">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {(["upload", "mapping", "preview", "done"] as XlsxStep[]).map(
                  (s, i) => (
                    <span key={s} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowRight className="h-3 w-3" />}
                      <span
                        className={
                          xlsxStep === s
                            ? "font-semibold text-foreground"
                            : xlsxStep === "done" ||
                              (["upload", "mapping", "preview"] as XlsxStep[]).indexOf(
                                xlsxStep
                              ) >
                                (["upload", "mapping", "preview"] as XlsxStep[]).indexOf(s)
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                        }
                      >
                        {s === "upload"
                          ? "1. Upload"
                          : s === "mapping"
                          ? "2. Map columns"
                          : s === "preview"
                          ? "3. Preview"
                          : "4. Done"}
                      </span>
                    </span>
                  )
                )}
              </div>

              {/* Step 1: Upload */}
              <div>
                <input
                  ref={xlsxFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={onXlsxFile}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={!distributorId || parseMut.isPending}
                    onClick={() => xlsxFileRef.current?.click()}
                  >
                    {parseMut.isPending ? (
                      <Spinner className="mr-1.5 h-4 w-4" />
                    ) : (
                      <Upload className="mr-1.5 h-4 w-4" />
                    )}
                    {xlsxFilename
                      ? `Re-upload (${xlsxFilename})`
                      : "Upload XLSX / Excel file"}
                  </Button>
                  {xlsxFilename && (
                    <span className="text-sm text-muted-foreground">
                      {xlsxFilename}
                    </span>
                  )}
                  {(xlsxStep === "mapping" ||
                    xlsxStep === "preview" ||
                    xlsxStep === "done") && (
                    <Button variant="ghost" size="sm" onClick={resetXlsx}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Start over
                    </Button>
                  )}
                </div>
                {!distributorId && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    Select a distributor above before uploading.
                  </p>
                )}
              </div>

              {/* Sheet selector (if multiple sheets) */}
              {parseResult && parseResult.sheets.length > 1 && (
                <div className="max-w-xs">
                  <label className="text-sm font-medium">Sheet</label>
                  <Select
                    value={xlsxSheetName}
                    onValueChange={(v) => {
                      setXlsxSheetName(v);
                      const sheet = parseResult.sheets.find((s) => s.name === v);
                      if (sheet) setColumnMapping(sheet.columns as ParsedColumn[]);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {parseResult.sheets.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 2: Column mapping */}
              {(xlsxStep === "mapping" ||
                xlsxStep === "preview" ||
                xlsxStep === "done") &&
                columnMapping.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Column mapping
                      </h3>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {priceStyleCols.length} price column
                          {priceStyleCols.length !== 1 ? "s" : ""} mapped
                        </span>
                        {skuCol ? (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            SKU: col {skuCol.colIdx + 1}
                          </span>
                        ) : (
                          <span className="text-destructive font-medium">
                            No SKU column!
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Col</th>
                            <th className="px-3 py-2 text-left">Header</th>
                            <th className="px-3 py-2 text-left">Role</th>
                            <th className="px-3 py-2 text-left">
                              Door style (if price)
                            </th>
                            <th className="px-3 py-2 text-left">Sample</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columnMapping.map((col) => (
                            <tr
                              key={col.colIdx}
                              className={`border-t ${
                                col.role === "ignore"
                                  ? "opacity-40"
                                  : col.role === "priceStyle" && col.styleId
                                  ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                                  : col.role === "sku"
                                  ? "bg-blue-50/30 dark:bg-blue-950/10"
                                  : ""
                              }`}
                            >
                              <td className="px-3 py-1.5 text-muted-foreground text-xs">
                                {col.colIdx + 1}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-xs max-w-[140px] truncate">
                                {col.label}
                              </td>
                              <td className="px-3 py-1.5">
                                <Select
                                  value={col.role}
                                  onValueChange={(v) =>
                                    updateColRole(col.colIdx, v)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(ROLE_LABELS).map(
                                      ([v, label]) => (
                                        <SelectItem
                                          key={v}
                                          value={v}
                                          className="text-xs"
                                        >
                                          {label}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-1.5">
                                {col.role === "priceStyle" ? (
                                  <StyleSearchDropdown
                                    distributorId={Number(distributorId)}
                                    value={col.styleId ? { id: col.styleId, styleCode: col.styleCode ?? "", ourName: col.styleLabel ?? "" } : null}
                                    onSelect={(s) => {
                                      setColumnMapping((prev) =>
                                        prev.map((c) =>
                                          c.colIdx === col.colIdx
                                            ? { ...c, role: "priceStyle", styleId: s.id, styleCode: s.styleCode, styleLabel: s.ourName }
                                            : c
                                        )
                                      );
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-muted-foreground max-w-[160px] truncate">
                                {col.sampleValues.slice(0, 2).join(", ") ||
                                  "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Validation warnings */}
                    {!skuCol && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                        <AlertTriangle className="inline mr-1 h-3.5 w-3.5" />
                        No SKU / Item Code column mapped. Please assign one
                        column the "SKU / Item Code" role.
                      </div>
                    )}
                    {priceStyleCols.filter((c) => !c.styleId).length > 0 && (
                      <div className="rounded-md border border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="inline mr-1 h-3.5 w-3.5" />
                        {priceStyleCols.filter((c) => !c.styleId).length}{" "}
                        price column(s) have no door style assigned — they will
                        be skipped.
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        disabled={
                          !skuCol ||
                          xlsxPreviewMut.isPending ||
                          xlsxStep === "done"
                        }
                        variant="outline"
                        onClick={() => runXlsxImport(true)}
                      >
                        {xlsxPreviewMut.isPending ? (
                          <Spinner className="mr-1.5 h-4 w-4" />
                        ) : null}
                        Preview import
                      </Button>
                    </div>
                  </div>
                )}

              {/* Step 3: Preview results */}
              {xlsxStep === "preview" && xlsxResult && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Preview results</h3>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="default">{xlsxResult.created} new</Badge>
                    <Badge variant="secondary">
                      {xlsxResult.updated} update
                    </Badge>
                    <Badge variant="outline">
                      {xlsxResult.priced} price rows
                    </Badge>
                    {xlsxResult.skipped > 0 && (
                      <Badge variant="destructive">
                        {xlsxResult.skipped} skipped
                      </Badge>
                    )}
                    {xlsxResult.aliasMatched > 0 && (
                      <Badge
                        variant="outline"
                        className="border-blue-400 text-blue-700 dark:text-blue-300"
                      >
                        <Link2 className="mr-1 h-3 w-3" />
                        {xlsxResult.aliasMatched} alias match
                        {xlsxResult.aliasMatched !== 1 ? "es" : ""}
                      </Badge>
                    )}
                    {xlsxResult.unmatchedCount > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700 dark:text-amber-300"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {xlsxResult.unmatchedCount} unmatched
                      </Badge>
                    )}
                  </div>

                  {xlsxResult.unmatchedCount > 0 && (
                    <div className="rounded-md border border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-medium mb-1">
                        {xlsxResult.unmatchedCount} SKU(s) could not be
                        matched and will be skipped (no Description+Category
                        to create new cabinets):
                      </p>
                      <p className="font-mono">
                        {xlsxResult.unmatchedCodes.slice(0, 20).join(", ")}
                        {xlsxResult.unmatchedCount > 20 ? " …" : ""}
                      </p>
                    </div>
                  )}

                  {/* Validation summary banner — live count subtracts rows resolved via MatchDropdown */}
                  {(() => {
                    const totalErrors: number = ("errorCount" in xlsxResult ? (xlsxResult as any).errorCount : 0) as number;
                    const errorRows = xlsxResult.previewRows.filter((r) => (r as any).severity === "error");
                    const resolvedErrors = errorRows.filter((r) => matchOverrides[r.rowNum] != null).length;
                    const remaining = Math.max(0, totalErrors - resolvedErrors);
                    if (remaining === 0 && totalErrors > 0) {
                      return (
                        <div className="rounded-md border border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                          <p className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            All {totalErrors} unmatched row{totalErrors !== 1 ? "s" : ""} resolved — ready to commit.
                          </p>
                        </div>
                      );
                    }
                    if (remaining > 0) {
                      return (
                        <div className="rounded-md border border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                          <p className="font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            {remaining} unmatched row{remaining !== 1 ? "s" : ""} need to be resolved — use the search boxes below to assign each code to a cabinet.
                          </p>
                          {resolvedErrors > 0 && (
                            <p className="text-xs opacity-75">{resolvedErrors} of {totalErrors} resolved so far.</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {("warningCount" in xlsxResult && (xlsxResult as any).warningCount > 0 && !((xlsxResult as any).errorCount > 0)) && (
                    <div className="rounded-md border border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        {(xlsxResult as any).warningCount} row{(xlsxResult as any).warningCount !== 1 ? "s" : ""} have warnings — review before committing.
                      </p>
                    </div>
                  )}

                  {/* Recognition panel — resolve unknown categories & unmatched codes */}
                  <RecognitionPanel
                    unknownCategories={(xlsxResult as any).unknownCategories ?? []}
                    unmatchedCodes={(xlsxResult as any).unmatchedCodes ?? []}
                    distributorId={distributorId ? Number(distributorId) : null}
                    onAliasResolved={(_raw, _platform) => {
                      // Alias saved — user can re-run preview to see updated matches
                    }}
                    onCodeAssigned={(code, cabinetId, _label) => {
                      // Apply the assignment to all rows with this code
                      setMatchOverrides((prev) => {
                        const next = { ...prev };
                        (xlsxResult?.previewRows ?? []).forEach((row) => {
                          if ((row as any).rawCode === code || (row as any).code === code) {
                            next[row.rowNum] = cabinetId;
                          }
                        });
                        return next;
                      });
                    }}
                  />

                  {/* Bulk-assign action bar — shown when rows are selected */}
                  <BulkAssignBar
                    selectedCount={selectedRows.size}
                    onAssign={(cabinetId, label) => {
                      setMatchOverrides((prev) => {
                        const next = { ...prev };
                        selectedRows.forEach((rowNum) => {
                          next[rowNum] = cabinetId;
                        });
                        return next;
                      });
                      toast.success(`Assigned "${label}" to ${selectedRows.size} row${selectedRows.size !== 1 ? "s" : ""}`);
                      setSelectedRows(new Set());
                    }}
                    onClear={() => setSelectedRows(new Set())}
                  />

                  {xlsxResult.previewRows.length > 0 && (
                    <div className="max-h-72 overflow-auto rounded-md border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-muted/80 uppercase text-muted-foreground">
                          <tr>
                            <th className="w-10 px-3 py-2">
                              <Checkbox
                                checked={allErrorRowsSelected}
                                data-state={someErrorRowsSelected && !allErrorRowsSelected ? "indeterminate" : undefined}
                                onCheckedChange={toggleAllErrorRows}
                                aria-label="Select all unmatched rows"
                              />
                            </th>
                            <th className="px-3 py-2">Row</th>
                            <th className="px-3 py-2">Code</th>
                            <th className="px-3 py-2">Match</th>
                            <th className="px-3 py-2">Action</th>
                            <th className="px-3 py-2">Styles priced</th>
                            <th className="px-3 py-2">Issues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {xlsxResult.previewRows.map((r) => {
                            const severity = (r as any).severity as "ok" | "warning" | "error" | undefined;
                            const issues = (r as any).issues as Array<{ field: string; message: string; severity: string }> | undefined;
                            const isErrorRow = issues
                              ? issues.some((i) => i.severity === "error")
                              : severity === "error";
                            const isSelected = selectedRows.has(r.rowNum);
                            const rowClass = [
                              "border-t",
                              isSelected
                                ? "bg-violet-50 dark:bg-violet-950/20"
                                : severity === "error"
                                ? "bg-destructive/5 text-destructive"
                                : severity === "warning"
                                ? "bg-amber-50/40 dark:bg-amber-950/10"
                                : "",
                            ].filter(Boolean).join(" ");
                            return (
                              <tr key={r.rowNum} className={rowClass}>
                                <td className="px-3 py-1.5">
                                  {isErrorRow ? (
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        setSelectedRows((prev) => {
                                          const next = new Set(prev);
                                          if (checked) next.add(r.rowNum);
                                          else next.delete(r.rowNum);
                                          return next;
                                        });
                                      }}
                                      aria-label={`Select row ${r.rowNum}`}
                                    />
                                  ) : null}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {severity === "error" && <AlertTriangle className="inline mr-1 h-3 w-3 text-destructive" />}
                                  {severity === "warning" && <AlertTriangle className="inline mr-1 h-3 w-3 text-amber-500" />}
                                  {r.rowNum}
                                </td>
                                <td className="px-3 py-1.5 font-mono">
                                  {r.code}
                                  {r.matchHow === "alias" && r.resolvedCode && (
                                    <span className="ml-1.5 text-blue-600 dark:text-blue-400">→ {r.resolvedCode}</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <MatchDropdown
                                    rowNum={r.rowNum}
                                    defaultCode={r.resolvedCode ?? r.code}
                                    defaultLabel={r.resolvedCode}
                                    matchHow={matchOverrides[r.rowNum] != null ? "override" : r.matchHow}
                                    overrideCabinetId={matchOverrides[r.rowNum]}
                                    onSelect={(cabinetId) => {
                                      setMatchOverrides((prev) => ({ ...prev, [r.rowNum]: cabinetId }));
                                    }}
                                    onClear={() => {
                                      setMatchOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[r.rowNum];
                                        return next;
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <Badge
                                    variant={
                                      r.action === "error"
                                        ? "destructive"
                                        : r.action === "create"
                                        ? "default"
                                        : r.action === "update"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {r.action}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {r.stylesPriced}
                                  {(r as any).missingPriceCount > 0 && (
                                    <span className="ml-1 text-amber-500">({(r as any).missingPriceCount} missing)</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 max-w-[260px]">
                                  {issues && issues.length > 0 ? (
                                    <ul className="space-y-1">
                                      {issues.map((iss, i) => {
                                        const editKey = `${r.rowNum}:${iss.field}`;
                                        const isEditable = iss.field === "dimensions" || iss.field.startsWith("price:");
                                        const currentVal = cellEdits[editKey] ?? "";
                                        if (isEditable) {
                                          return (
                                            <li key={i} className="flex flex-col gap-0.5">
                                              <span className={iss.severity === "error" ? "text-destructive text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>
                                                {iss.severity === "error" ? "✗" : "⚠"} {iss.message}
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <input
                                                  type="text"
                                                  className="h-6 w-28 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                                  placeholder={iss.field === "dimensions" ? "e.g. 12x30x12" : "e.g. 149.99"}
                                                  value={currentVal}
                                                  onChange={(e) =>
                                                    setCellEdits((prev) => ({ ...prev, [editKey]: e.target.value }))
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                      e.currentTarget.blur();
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    if (currentVal.trim()) {
                                                      runXlsxImport(true);
                                                    }
                                                  }}
                                                />
                                                {currentVal && (
                                                  <button
                                                    type="button"
                                                    className="text-muted-foreground hover:text-foreground"
                                                    title="Clear edit"
                                                    onClick={() => {
                                                      setCellEdits((prev) => {
                                                        const next = { ...prev };
                                                        delete next[editKey];
                                                        return next;
                                                      });
                                                    }}
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                )}
                                              </div>
                                            </li>
                                          );
                                        }
                                        return (
                                          <li key={i} className={iss.severity === "error" ? "text-destructive text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>
                                            {iss.severity === "error" ? "✗" : "⚠"} {iss.message}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : r.warnings.length > 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400 text-xs">{r.warnings.join(" ")}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {(() => {
                      const totalErrors: number = ("errorCount" in xlsxResult ? (xlsxResult as any).errorCount : 0) as number;
                      const errorRows = xlsxResult.previewRows.filter((r) => (r as any).severity === "error");
                      const resolvedErrors = errorRows.filter((r) => matchOverrides[r.rowNum] != null).length;
                      const remaining = Math.max(0, totalErrors - resolvedErrors);
                      return (
                        <>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={xlsxCommitMut.isPending || remaining > 0}
                      title={remaining > 0 ? `Resolve ${remaining} unmatched row${remaining !== 1 ? "s" : ""} before committing` : ""}
                      onClick={() => runXlsxImport(false)}
                    >
                      {xlsxCommitMut.isPending ? (
                        <Spinner className="mr-1.5 h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      Commit import
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setXlsxStep("mapping")}
                    >
                      Back to mapping
                    </Button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Step 4: Done */}
              {xlsxStep === "done" && xlsxResult && (
                <div className="rounded-md border border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="h-5 w-5" /> Import complete
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="default">{xlsxResult.created} created</Badge>
                    <Badge variant="secondary">
                      {xlsxResult.updated} updated
                    </Badge>
                    <Badge variant="outline">
                      {xlsxResult.priced} price rows upserted
                    </Badge>
                    {xlsxResult.skipped > 0 && (
                      <Badge variant="destructive">
                        {xlsxResult.skipped} skipped
                      </Badge>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={resetXlsx}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Import
                    another file
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── PDF converter tab ─────────────────────────────────────── */}
            <TabsContent value="pdf" className="space-y-5 pt-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-medium">PDF Pricing Sheet Converter</p>
                <p className="text-xs">
                  Upload a distributor pricing PDF (e.g. US Cabinet Depot format). The system will extract the pricing table and produce a downloadable Excel file that you can then import using the XLSX tab.
                </p>
              </div>

              {/* Upload area */}
              {pdfStep === "upload" && (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-10 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => pdfFileRef.current?.click()}
                >
                  <input
                    ref={pdfFileRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={onPdfFile}
                  />
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Click to upload a PDF pricing sheet</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports the US Cabinet Depot / Capital Collection multi-style column format</p>
                  </div>
                </div>
              )}

              {/* Converting */}
              {pdfStep === "converting" && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Extracting table from <span className="font-mono">{pdfFilename}</span>…</p>
                  <p className="text-xs text-muted-foreground">This may take 10–30 seconds for large PDFs.</p>
                </div>
              )}

              {/* Done */}
              {pdfStep === "done" && pdfResult && (
                <div className="space-y-4">
                  <div className="rounded-md border border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="h-5 w-5" /> Conversion complete
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="default">{pdfResult.rowCount} cabinet rows</Badge>
                      <Badge variant="secondary">{pdfResult.styleCodes.length} style codes</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pdfResult.styleCodes.map((c) => (
                        <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Output file: <span className="font-mono">{pdfResult.filename}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={downloadPdfXlsx}>
                      <Download className="mr-1.5 h-4 w-4" /> Download Excel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={loadPdfXlsxIntoImport}
                      disabled={!distributorId}
                      title={!distributorId ? "Select a distributor first" : ""}
                    >
                      <ArrowRight className="mr-1.5 h-4 w-4" /> Open in Import
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPdfStep("upload"); setPdfResult(null); if (pdfFileRef.current) pdfFileRef.current.value = ""; }}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Convert another
                    </Button>
                  </div>

                  {!distributorId && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                      Select a distributor above to use "Open in Import" and feed this file directly into the XLSX import flow.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── CSV tab ──────────────────────────────────────────────────── */}
            <TabsContent value="csv" className="space-y-4 pt-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-medium">Required CSV columns</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  <li>
                    <span className="font-mono">SKU</span> (or: Code, Item,
                    Model, Part #) — the distributor's own SKU or the platform
                    master code. Aliases are matched automatically.
                  </li>
                  <li>
                    <span className="font-mono">Door Style</span> (or: Style,
                    Style Code, Finish) — matched against this distributor's
                    door styles.
                  </li>
                  <li>
                    <span className="font-mono">List Price</span> and/or{" "}
                    <span className="font-mono">Your Cost</span>.
                  </li>
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">
                    Door style override{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional — applies to all rows)
                    </span>
                  </label>
                  <Select
                    value={styleId || "__percolumn__"}
                    onValueChange={(v) => {
                      setStyleId(v === "__percolumn__" ? "" : v);
                      setPreview(null);
                    }}
                    disabled={!distributorId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Use Door Style column per row" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__percolumn__">
                        Use Door Style column per row
                      </SelectItem>
                      {(styles ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.ourName}
                          {s.styleCode ? ` (${s.styleCode})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Download template
                </Button>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onCsvFile}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => csvFileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Upload CSV file
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">Or paste CSV</label>
                <Textarea
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="SKU,Door Style,List Price,Your Cost&#10;B-24,Shaker White,310.00,108.50&#10;W-30-30,Shaker White,182.00,63.70"
                  className="mt-1 h-32 font-mono text-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={!canRunCsv || previewMut.isPending}
                  onClick={() =>
                    previewMut.mutate({
                      distributorId: Number(distributorId),
                      styleId: styleId ? Number(styleId) : undefined,
                      csv,
                    })
                  }
                >
                  {previewMut.isPending ? (
                    <Spinner className="mr-1.5 h-4 w-4" />
                  ) : null}
                  Preview import
                </Button>
                {preview && preview.fatalErrors.length === 0 && (
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={commitMut.isPending}
                    onClick={() =>
                      commitMut.mutate({
                        distributorId: Number(distributorId),
                        styleId: styleId ? Number(styleId) : undefined,
                        csv,
                      })
                    }
                  >
                    {commitMut.isPending ? (
                      <Spinner className="mr-1.5 h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    )}
                    Commit import
                  </Button>
                )}
              </div>

              {/* CSV preview results */}
              {preview && (
                <div className="space-y-3">
                  {preview.fatalErrors.length > 0 && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      <div className="mb-1 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-4 w-4" /> Fix before
                        importing
                      </div>
                      <ul className="list-disc pl-5">
                        {preview.fatalErrors.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="default">
                      {preview.summary.toCreate} new
                    </Badge>
                    <Badge variant="secondary">
                      {preview.summary.toUpdate} update
                    </Badge>
                    <Badge variant="outline">
                      {preview.summary.priceOnly} price-only
                    </Badge>
                    {preview.summary.errors > 0 && (
                      <Badge variant="destructive">
                        {preview.summary.errors} error
                      </Badge>
                    )}
                    {"aliasMatched" in preview.summary &&
                      (preview.summary as { aliasMatched: number })
                        .aliasMatched > 0 && (
                        <Badge
                          variant="outline"
                          className="border-blue-400 text-blue-700 dark:text-blue-300"
                        >
                          <Link2 className="mr-1 h-3 w-3" />
                          {
                            (preview.summary as { aliasMatched: number })
                              .aliasMatched
                          }{" "}
                          alias match
                          {(preview.summary as { aliasMatched: number })
                            .aliasMatched !== 1
                            ? "es"
                            : ""}
                        </Badge>
                      )}
                    <span className="text-muted-foreground self-center">
                      {preview.summary.total} rows total
                    </span>
                  </div>

                  {preview.unknownHeaders.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Ignored columns:{" "}
                      <span className="font-mono">
                        {preview.unknownHeaders.join(", ")}
                      </span>
                    </p>
                  )}

                  <div className="max-h-80 overflow-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Style</th>
                          <th className="px-3 py-2">Action</th>
                          <th className="px-3 py-2">Changes</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map(
                          (r: PreviewData["rows"][number]) => (
                            <tr key={r.rowNumber} className="border-t">
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.rowNumber}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                <span>{r.masterCode || "—"}</span>
                                {"matchHow" in r &&
                                  (r as { matchHow: string }).matchHow ===
                                    "alias" && (
                                    <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">
                                      →{" "}
                                      {
                                        (
                                          r as {
                                            resolvedMasterCode: string;
                                          }
                                        ).resolvedMasterCode
                                      }
                                    </span>
                                  )}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {"resolvedStyleName" in r
                                  ? (
                                      r as {
                                        resolvedStyleName: string | null;
                                      }
                                    ).resolvedStyleName ?? (
                                      <span className="text-amber-600">
                                        —
                                      </span>
                                    )
                                  : "—"}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={ACTION_VARIANT[r.action]}>
                                  {ACTION_LABEL[r.action]}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {[
                                  ...r.fields,
                                  r.priceTouched ? "price" : null,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {r.errors.length > 0 && (
                                  <span className="text-destructive">
                                    {r.errors.join(" ")}
                                  </span>
                                )}
                                {r.warnings.length > 0 && (
                                  <span className="text-amber-600">
                                    {r.warnings
                                      .filter(
                                        (w: string) =>
                                          !w.startsWith("Matched via alias")
                                      )
                                      .join(" ")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
