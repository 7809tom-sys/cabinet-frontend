import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Tag,
  RefreshCw,
  Save,
  Wand2,
  Search,
  XCircle,
  ShieldAlert,
} from "lucide-react";

type FlaggedRow = {
  id: number;
  masterCode: string;
  original: string;
  suggested: string;
  matchedBrands: string[];
};

/** Highlight brand names in a description string */
function HighlightedText({ text, brands }: { text: string; brands: string[] }) {
  if (!brands.length) return <span>{text}</span>;
  const pattern = brands
    .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(re);
  // reset lastIndex after split
  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = brands.some((b) => b.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark
            key={i}
            className="bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded px-0.5 font-semibold not-italic"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

export default function DescriptionCleanupAdmin() {
  const utils = trpc.useUtils();
  const { data: flagged, isLoading, refetch } = trpc.cabinets.adminListFlaggedDescriptions.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");

  const saveMut = trpc.cabinets.adminSaveCleanedDescriptions.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.updated} description${r.updated !== 1 ? "s" : ""} updated`);
      setChecked({});
      setEdited({});
      refetch();
      utils.cabinets.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows: FlaggedRow[] = flagged ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.masterCode.toLowerCase().includes(q) ||
        r.original.toLowerCase().includes(q) ||
        r.matchedBrands.some((b) => b.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const checkedIds = rows.filter((r) => checked[r.id]).map((r) => r.id);
  const highCount = rows.filter((r) => r.matchedBrands.length > 1).length;
  const medCount = rows.filter((r) => r.matchedBrands.length === 1).length;

  function handleSave() {
    const payload = checkedIds.map((id) => {
      const row = rows.find((r) => r.id === id)!;
      return { id, description: (edited[id] ?? row.suggested).trim() };
    });
    if (!payload.length) {
      toast.error("Check at least one item to save");
      return;
    }
    saveMut.mutate(payload);
  }

  function fixAll() {
    const payload = rows.map((r) => ({
      id: r.id,
      description: (edited[r.id] ?? r.suggested).trim(),
    }));
    saveMut.mutate(payload);
  }

  function checkAll() {
    const next: Record<number, boolean> = {};
    filtered.forEach((r) => { next[r.id] = true; });
    setChecked(next);
  }

  function uncheckAll() {
    setChecked({});
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Spinner className="h-4 w-4" /> Scanning descriptions for brand names…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">All descriptions are clean</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">No brand names found in any cabinet description.</p>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-scan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-red-800 dark:text-red-200">
              {rows.length} cabinet description{rows.length !== 1 ? "s" : ""} contain brand names
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              Generic cabinet descriptions should never include supplier or model names.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {highCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200">
                <AlertTriangle className="h-3 w-3" /> {highCount} critical
              </span>
            )}
            {medCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200">
                <Tag className="h-3 w-3" /> {medCount} flagged
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-red-200 dark:border-red-800">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
            disabled={saveMut.isPending}
            onClick={fixAll}
          >
            {saveMut.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
            Fix all {rows.length} automatically
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-scan
          </Button>
        </div>
      </div>

      {/* Search + bulk actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Filter by code, description, or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={checkAll}>Check all</Button>
        <Button variant="outline" size="sm" onClick={uncheckAll}>Uncheck all</Button>
        <Button
          size="sm"
          disabled={!checkedIds.length || saveMut.isPending}
          onClick={handleSave}
          className="gap-1.5"
        >
          {saveMut.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          Save {checkedIds.length > 0 ? `(${checkedIds.length})` : "selected"}
        </Button>
      </div>

      {search && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {rows.length} flagged descriptions
        </p>
      )}

      {/* Row list */}
      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {filtered.map((row) => {
          const isChecked = !!checked[row.id];
          const currentText = edited[row.id] ?? row.suggested;
          const isHighSeverity = row.matchedBrands.length > 1;
          return (
            <div
              key={row.id}
              className={[
                "p-4 space-y-2 transition-colors",
                isHighSeverity ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-400",
                isChecked
                  ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                  : isHighSeverity
                  ? "bg-red-50/30 dark:bg-red-950/10"
                  : "bg-amber-50/20 dark:bg-amber-950/5",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [row.id]: !!v }))}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">
                      {row.masterCode}
                    </code>
                    {isHighSeverity && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full border border-red-200">
                        <AlertTriangle className="h-2.5 w-2.5" /> Critical — multiple brands
                      </span>
                    )}
                    {row.matchedBrands.map((b) => (
                      <Badge
                        key={b}
                        variant="outline"
                        className={`text-[10px] gap-1 ${
                          isHighSeverity
                            ? "border-red-300 text-red-700 dark:text-red-400"
                            : "border-amber-300 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <Tag className="h-2.5 w-2.5" /> {b}
                      </Badge>
                    ))}
                  </div>

                  {/* Original with highlights */}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Original: </span>
                    <HighlightedText text={row.original} brands={row.matchedBrands} />
                  </div>

                  {/* Editable cleaned description */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0 mt-1.5">
                      Clean:
                    </span>
                    <textarea
                      className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[2.5rem]"
                      rows={2}
                      value={currentText}
                      onChange={(e) => setEdited((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      onClick={() => setChecked((prev) => ({ ...prev, [row.id]: true }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer save */}
      {checkedIds.length > 0 && (
        <div className="flex justify-end">
          <Button disabled={saveMut.isPending} onClick={handleSave} className="gap-1.5">
            {saveMut.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save {checkedIds.length} description{checkedIds.length !== 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
