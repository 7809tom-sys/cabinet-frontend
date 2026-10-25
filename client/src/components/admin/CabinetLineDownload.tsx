import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Package, ChevronDown, ChevronRight } from "lucide-react";

export default function CabinetLineDownload() {
  const [styleId, setStyleId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const utils = trpc.useUtils();

  // Load door styles for the picker.
  const { data: styles = [] } = trpc.doorStyles.list.useQuery();

  // Load ALL cabinets for the selected style (limit 500 to get everything).
  const { data: cabinetsResult, isLoading: loadingCabs } = trpc.cabinets.listForStyle.useQuery(
    { styleId: styleId ?? 0, limit: 500 },
    { enabled: styleId != null }
  );
  const cabinets = cabinetsResult?.items ?? [];

  // Group cabinets by category for the checklist accordion.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof cabinets>();
    for (const c of cabinets) {
      const key = c.category ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cabinets]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Select / deselect all in a group.
  function toggleGroupSelect(ids: number[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(cabinets.map((c) => c.id)));
  }
  function selectNone() {
    setSelectedIds(new Set());
  }

  function download() {
    if (!styleId) return;
    setDownloading(true);
    utils.cabinets.cabinetLineExport
      .fetch({
        styleId,
        cabinetIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
      })
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
      .finally(() => setDownloading(false));
  }

  const selectedStyle = styles.find((s) => s.id === styleId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Download cabinet line by style
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground max-w-xl">
          Pick a door style, check off the cabinets you want, and download an Excel file with
          descriptions, dimensions, pricing, and catalog image URLs for every selected cabinet.
        </p>

        {/* Style picker */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={styleId != null ? String(styleId) : ""}
            onValueChange={(v) => {
              setStyleId(Number(v));
              setSelectedIds(new Set());
              setOpenGroups(new Set());
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a door style…" />
            </SelectTrigger>
            <SelectContent>
              {styles.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.ourName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {styleId != null && (
            <Button
              onClick={download}
              disabled={downloading || loadingCabs}
              className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
            >
              {downloading ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download{selectedIds.size > 0 ? ` ${selectedIds.size} selected` : " all"}
            </Button>
          )}
        </div>

        {/* Cabinet checklist */}
        {styleId != null && (
          <div className="space-y-2">
            {loadingCabs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Spinner className="h-4 w-4" /> Loading cabinets for {selectedStyle?.ourName}…
              </div>
            ) : cabinets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No cabinets available for this style.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 pb-1">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} of {cabinets.length} selected
                  </span>
                  <button
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={selectAll}
                  >
                    Select all
                  </button>
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={selectNone}
                  >
                    Clear
                  </button>
                </div>

                <div className="rounded-md border border-border divide-y divide-border max-h-[480px] overflow-y-auto">
                  {grouped.map(([category, items]) => {
                    const ids = items.map((c) => c.id);
                    const allSel = ids.every((id) => selectedIds.has(id));
                    const someSel = ids.some((id) => selectedIds.has(id));
                    const open = openGroups.has(category);
                    return (
                      <div key={category}>
                        {/* Group header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 cursor-pointer select-none">
                          <Checkbox
                            checked={allSel ? true : someSel ? "indeterminate" : false}
                            onCheckedChange={() => toggleGroupSelect(ids)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span
                            className="flex-1 text-sm font-medium"
                            onClick={() => toggleGroup(category)}
                          >
                            {category}
                          </span>
                          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                          <button onClick={() => toggleGroup(category)} className="text-muted-foreground">
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Cabinet rows */}
                        {open && (
                          <div className="divide-y divide-border/50">
                            {items.map((c) => (
                              <label
                                key={c.id}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedIds.has(c.id)}
                                  onCheckedChange={() => {
                                    setSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(c.id)) next.delete(c.id);
                                      else next.add(c.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-sm font-mono text-primary w-24 shrink-0">
                                  {c.masterCode}
                                </span>
                                <span className="text-sm text-muted-foreground truncate">
                                  {c.description}
                                </span>
                                <span className="text-xs text-muted-foreground/60 shrink-0 ml-auto">
                                  {c.width}&quot;W
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
