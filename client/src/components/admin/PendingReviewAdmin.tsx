import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, Eye, EyeOff, RefreshCw, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type PendingItem = {
  skuId: number;
  cabinetId: number;
  masterCode: string | null;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  distributorId: number;
  distributorBrandName: string | null;
  styleId: number;
  styleName: string | null;
  styleCode: string | null;
  platformSku: string | null;
  distributorSku: string | null;
  listPrice: string | null;
  isAvailable: boolean | null;
  isPublished: boolean | null;
};

const PAGE_SIZE = 100;

function formatPrice(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Groups items by masterCode so we can show one row per cabinet with style badges */
function groupByCabinet(items: PendingItem[]) {
  const map = new Map<string, { item: PendingItem; styles: PendingItem[] }>();
  for (const item of items) {
    const key = `${item.cabinetId}`;
    if (!map.has(key)) {
      map.set(key, { item, styles: [] });
    }
    map.get(key)!.styles.push(item);
  }
  return Array.from(map.values());
}

export default function PendingReviewAdmin() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [rolloutFilter, setRolloutFilter] = useState<"all" | "rollout" | "other">("all");
  const [offset, setOffset] = useState(0);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const utils = trpc.useUtils();

  const isRollout =
    rolloutFilter === "rollout" ? true : rolloutFilter === "other" ? false : undefined;

  const { data, isLoading, refetch } = trpc.cabinets.adminListPendingReview.useQuery({
    search: search || undefined,
    category: category || undefined,
    isRollout,
    limit: PAGE_SIZE,
    offset,
  });

  const items: PendingItem[] = (data?.items ?? []) as PendingItem[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE);

  const grouped = useMemo(() => groupByCabinet(items), [items]);

  const bulkPublishMutation = trpc.cabinets.adminBulkPublishSkus.useMutation({
    onSuccess: (result) => {
      toast.success(`Published ${result.updated} SKU${result.updated !== 1 ? "s" : ""}`);
      setSelectedSkuIds(new Set());
      utils.cabinets.adminListPendingReview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const allSkuIds = items.map((i) => i.skuId);
  const allSelected = allSkuIds.length > 0 && allSkuIds.every((id) => selectedSkuIds.has(id));
  const someSelected = selectedSkuIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedSkuIds(new Set());
    } else {
      setSelectedSkuIds(new Set(allSkuIds));
    }
  }

  function toggleCabinet(styles: PendingItem[]) {
    const ids = styles.map((s) => s.skuId);
    const allChecked = ids.every((id) => selectedSkuIds.has(id));
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function publishSelected() {
    if (selectedSkuIds.size === 0) return;
    bulkPublishMutation.mutate({ skuIds: Array.from(selectedSkuIds), isPublished: true });
  }

  function publishAll() {
    if (allSkuIds.length === 0) return;
    bulkPublishMutation.mutate({ skuIds: allSkuIds, isPublished: true });
  }

  const isRolloutCode = (code: string | null) =>
    /(\d+RS|FH\d+RS)$/i.test(code ?? "");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Pending Review</h2>
        <Badge variant="secondary" className="ml-1">{total} unpublished SKUs</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        These items were imported from the Capital/USCD spec book but are not yet visible to customers.
        <strong className="text-foreground"> Rollout shelf items (1RS/2RS/3RS)</strong> are flagged for your review.
        Select items and click <strong className="text-foreground">Publish Selected</strong> to make them live.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search code or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setSearch(searchInput); setOffset(0); }
            }}
          />
        </div>
        <Select value={category || "__all__"} onValueChange={(v) => { setCategory(v === "__all__" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            <SelectItem value="Base">Base</SelectItem>
            <SelectItem value="Wall">Wall</SelectItem>
            <SelectItem value="Tall">Tall</SelectItem>
            <SelectItem value="Vanity">Vanity</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rolloutFilter} onValueChange={(v) => { setRolloutFilter(v as "all" | "rollout" | "other"); setOffset(0); }}>
          <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="rollout">🔄 Rollout shelf only</SelectItem>
            <SelectItem value="other">Other items only</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8" onClick={() => { setSearch(searchInput); setOffset(0); }}>
          Search
        </Button>
        <Button
          size="sm"
          variant={viewMode === "grouped" ? "default" : "outline"}
          className="h-8 gap-1"
          onClick={() => setViewMode(viewMode === "grouped" ? "flat" : "grouped")}
        >
          {viewMode === "grouped" ? "Grouped" : "Flat"}
        </Button>
      </div>

      {/* Bulk actions */}
      {someSelected && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedSkuIds.size} SKU{selectedSkuIds.size !== 1 ? "s" : ""} selected</span>
          <Button
            size="sm"
            className="h-7 gap-1.5 ml-auto"
            onClick={publishSelected}
            disabled={bulkPublishMutation.isPending}
          >
            {bulkPublishMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Publish Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={() => setSelectedSkuIds(new Set())}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Publish all on current page */}
      {!someSelected && items.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
            onClick={publishAll}
            disabled={bulkPublishMutation.isPending}
          >
            {bulkPublishMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Publish All {items.length} on This Page
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          No pending items — everything is published!
        </div>
      ) : viewMode === "grouped" ? (
        /* ── Grouped view: one row per cabinet ── */
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2 w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-28">Code</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Description</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-20 hidden sm:table-cell">W×H</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-32">Supplier</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Styles (SKUs)</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ item, styles }, i) => {
                const isRollout = isRolloutCode(item.masterCode);
                const allStylesSelected = styles.every((s) => selectedSkuIds.has(s.skuId));
                const someStylesSelected = styles.some((s) => selectedSkuIds.has(s.skuId));
                return (
                  <tr
                    key={item.cabinetId}
                    className={cn(
                      "border-b border-border last:border-0",
                      i % 2 === 0 ? "bg-background" : "bg-muted/20",
                      isRollout && "bg-amber-50/50"
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={allStylesSelected}
                        data-state={someStylesSelected && !allStylesSelected ? "indeterminate" : undefined}
                        onCheckedChange={() => toggleCabinet(styles)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-primary">{item.masterCode}</span>
                        {isRollout && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-600">RS</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-foreground line-clamp-1">{item.description}</span>
                      {item.category && (
                        <span className="text-[10px] text-muted-foreground block">{item.category}{item.subCategory ? ` › ${item.subCategory}` : ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {item.width ? `${parseFloat(item.width)}"` : "—"}×{item.height ? `${parseFloat(item.height)}"` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium text-amber-700">{item.distributorBrandName ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {styles.slice(0, 8).map((s) => (
                          <Badge
                            key={s.skuId}
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1 py-0 cursor-pointer",
                              selectedSkuIds.has(s.skuId) && "bg-primary/10 border-primary text-primary"
                            )}
                            onClick={() => {
                              setSelectedSkuIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.skuId)) next.delete(s.skuId); else next.add(s.skuId);
                                return next;
                              });
                            }}
                          >
                            {s.styleCode ?? s.styleName}
                            {s.listPrice ? ` ${formatPrice(s.listPrice)}` : ""}
                          </Badge>
                        ))}
                        {styles.length > 8 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                            +{styles.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 gap-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => {
                          const ids = styles.map((s) => s.skuId);
                          bulkPublishMutation.mutate({ skuIds: ids, isPublished: true });
                        }}
                        disabled={bulkPublishMutation.isPending}
                      >
                        <Eye className="h-3 w-3" />
                        Publish
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Flat view: one row per SKU ── */
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2 w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-28">Platform SKU</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Description</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-24">Style</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-24">List Price</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-32">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.skuId}
                  className={cn(
                    "border-b border-border last:border-0 cursor-pointer",
                    i % 2 === 0 ? "bg-background" : "bg-muted/20",
                    selectedSkuIds.has(item.skuId) && "bg-primary/5",
                    isRolloutCode(item.masterCode) && "bg-amber-50/50"
                  )}
                  onClick={() => {
                    setSelectedSkuIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.skuId)) next.delete(item.skuId); else next.add(item.skuId);
                      return next;
                    });
                  }}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSkuIds.has(item.skuId)}
                      onCheckedChange={() => {
                        setSelectedSkuIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.skuId)) next.delete(item.skuId); else next.add(item.skuId);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-primary">{item.platformSku}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs">{item.description}</span>
                    {isRolloutCode(item.masterCode) && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-amber-400 text-amber-600">RS</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">{item.styleCode ?? item.styleName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">{formatPrice(item.listPrice)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-amber-700">{item.distributorBrandName ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {currentPage + 1} of {totalPages} ({total} total SKUs)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
