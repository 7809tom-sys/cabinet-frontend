/**
 * MissingImagesAdmin — shows every active cabinet that has no catalogImageUrl.
 *
 * Features:
 *  - Per-row checkbox + Select All header checkbox
 *  - Sticky bulk action bar when rows are selected
 *  - Bulk Assign Image: opens a single MediaPicker dialog that assigns the
 *    chosen image to ALL selected cabinets at once via adminBulkFixCabinetImages
 *  - Single Fix Image: per-row button opens the same dialog for one cabinet
 *  - image_missing conflict flags are auto-cleared on assignment
 */

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ImageOff,
  Search,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  CheckCircle2,
  Images,
  X,
} from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaPicker";

const PAGE_SIZE = 50;

type MissingItem = {
  id: number;
  masterCode: string;
  description: string;
  category: string;
  subCategory: string | null;
  conflictStatus: string;
  catalogImageUrl: string | null;
};

// ─── Assign Image Dialog ──────────────────────────────────────────────────────
// Used for both single-row and bulk assignment. When `items` has >1 entry
// the dialog title and confirmation copy reflect the bulk operation.
function AssignImageDialog({
  items,
  open,
  onOpenChange,
  onDone,
}: {
  items: MissingItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const utils = trpc.useUtils();
  const isBulk = items.length > 1;

  // Single-item mutation
  const fixOne = trpc.cabinets.adminFixCabinetImage.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.conflictCleared
          ? `Image assigned and conflict flag cleared for ${items[0]?.masterCode}`
          : `Image assigned to ${items[0]?.masterCode}`
      );
      utils.cabinets.adminListMissingImages.invalidate();
      onDone();
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Bulk mutation
  const fixBulk = trpc.cabinets.adminBulkFixCabinetImages.useMutation({
    onSuccess: (data) => {
      const cleared =
        data.conflictsCleared > 0
          ? ` (${data.conflictsCleared} conflict flag${data.conflictsCleared !== 1 ? "s" : ""} cleared)`
          : "";
      toast.success(`Image assigned to ${data.updated} cabinet${data.updated !== 1 ? "s" : ""}${cleared}`);
      utils.cabinets.adminListMissingImages.invalidate();
      onDone();
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Bulk assign failed: ${err.message}`),
  });

  const isPending = fixOne.isPending || fixBulk.isPending;

  const handleSave = useCallback(() => {
    if (!imageUrl.trim()) {
      toast.error("Please select or upload an image first.");
      return;
    }
    if (isBulk) {
      fixBulk.mutate({ ids: items.map((i) => i.id), imageUrl: imageUrl.trim() });
    } else {
      fixOne.mutate({ id: items[0].id, imageUrl: imageUrl.trim() });
    }
  }, [imageUrl, isBulk, items, fixBulk, fixOne]);

  // Reset image when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (!v) setImageUrl("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBulk ? (
              <Images className="h-5 w-5 text-amber-500" />
            ) : (
              <ImagePlus className="h-5 w-5 text-amber-500" />
            )}
            {isBulk
              ? `Bulk Assign Image — ${items.length} cabinets`
              : `Fix Image — ${items[0]?.masterCode}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary of selected items */}
          {isBulk ? (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1 max-h-36 overflow-y-auto">
              <p className="font-medium text-foreground mb-2">
                The selected image will be assigned to all {items.length} cabinets below:
              </p>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono font-medium text-foreground shrink-0">
                    {item.masterCode}
                  </span>
                  <span className="truncate">{item.description}</span>
                  {item.conflictStatus === "image_missing" && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      Flag
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">{items[0]?.description}</p>
              <p className="text-muted-foreground mt-0.5">
                {items[0]?.category}
                {items[0]?.subCategory ? ` / ${items[0].subCategory}` : ""}
              </p>
              {items[0]?.conflictStatus === "image_missing" && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  Image Missing — conflict flag active
                </Badge>
              )}
            </div>
          )}

          <MediaPicker
            value={imageUrl}
            onChange={setImageUrl}
            label="Catalog Image"
            placeholder="Select from library or upload a new image"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!imageUrl.trim() || isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isBulk ? `Assign to ${items.length} Cabinets` : "Assign Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MissingImagesAdmin() {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Dialog state: null = closed, array of items = open
  const [assignTargets, setAssignTargets] = useState<MissingItem[] | null>(null);

  const { data, isLoading, refetch } = trpc.cabinets.adminListMissingImages.useQuery(
    { page, pageSize: PAGE_SIZE, search: search || undefined },
    {}
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Derived selection helpers
  const pageIds = useMemo(() => items.map((i) => i.id), [items]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  // The MissingItem objects for currently selected ids (from current page)
  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(0);
    setSelectedIds(new Set());
  }, [searchInput]);

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPageSelected) {
      // Deselect all on this page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all on this page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDone = () => {
    setSelectedIds(new Set());
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <ImageOff className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Cabinets Missing Catalog Images</p>
          <p className="text-amber-800">
            These active cabinets have no catalog image. Select one or more rows and
            click <strong>Assign Image to Selected</strong>, or use the per-row{" "}
            <strong>Fix Image</strong> button for individual cabinets.
          </p>
        </div>
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by code or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          Search
        </Button>
        {!isLoading && (
          <span className="text-sm text-muted-foreground ml-auto">
            {total} cabinet{total !== 1 ? "s" : ""} missing an image
          </span>
        )}
      </div>

      {/* ── Sticky bulk action bar ── */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} cabinet{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            className="gap-1.5 ml-auto"
            onClick={() => setAssignTargets(selectedItems)}
            disabled={selectedItems.length === 0}
          >
            <Images className="h-4 w-4" />
            Assign Image to Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-blue-700 hover:text-blue-900"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="font-medium text-foreground">All cabinets have catalog images!</p>
          <p className="text-sm">
            No missing images found{search ? " for this search" : ""}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allPageSelected}
                    // indeterminate state when some but not all are selected
                    data-state={
                      somePageSelected && !allPageSelected ? "indeterminate" : undefined
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Code</th>
                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">
                  Status
                </th>
                <th className="text-right px-4 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(item.id)}
                        aria-label={`Select ${item.masterCode}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      {item.masterCode}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {item.category}
                      {item.subCategory ? (
                        <span className="text-xs ml-1 text-muted-foreground/70">
                          / {item.subCategory}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {item.conflictStatus === "image_missing" ? (
                        <Badge variant="destructive" className="text-xs">
                          Image Missing
                        </Badge>
                      ) : item.conflictStatus === "conflict" ? (
                        <Badge variant="destructive" className="text-xs">
                          Conflict
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                        >
                          No Image
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50"
                        onClick={() => setAssignTargets([item as MissingItem])}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Fix Image
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => {
                setPage((p) => p - 1);
                setSelectedIds(new Set());
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => {
                setPage((p) => p + 1);
                setSelectedIds(new Set());
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Assign Image dialog (single or bulk) */}
      {assignTargets && (
        <AssignImageDialog
          items={assignTargets}
          open={!!assignTargets}
          onOpenChange={(v) => !v && setAssignTargets(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
