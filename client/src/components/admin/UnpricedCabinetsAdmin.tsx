import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { CabinetImage } from "@/components/CabinetImage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Link2, Pencil, RefreshCw, Search, Trash2, Unlink2 } from "lucide-react";
import { cabinetFrontEndQuickEditUrl, distributorLineLabels } from "@shared/cabinetConfigReview";

type UnpricedCabinet = {
  id: number;
  masterCode: string | null;
  description: string | null;
  category: string | null;
  width: string | null;
  height: string | null;
  catalogImageUrl: string | null;
  isActive: boolean | null;
  supplierSkuCount: number;
  distributorNames: string | null;
};

const PAGE_SIZE = 100;

/**
 * Keeps price corrections separate from invalid, unlinked product cleanup.
 * A record is removable only when it has no distributor SKU and no live order,
 * cart, or saved-layout reference; the server rechecks all of those guards.
 */
export default function UnpricedCabinetsAdmin() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch } = trpc.cabinets.adminListUnpricedCabinets.useQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    unlinkedOnly,
  });

  const deleteUnlinked = trpc.cabinets.adminDeleteUnlinkedUnpricedCabinet.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.masterCode} deleted — it had no distributor link or valid price.`);
      utils.cabinets.adminListUnpricedCabinets.invalidate();
      utils.cabinets.adminListCabinetConfig.invalidate();
      utils.cabinets.adminListAttentionDistributors.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = (data?.rows ?? []) as UnpricedCabinet[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(0);
  };

  const toggleUnlinkedOnly = () => {
    setUnlinkedOnly((value) => !value);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold">Unpriced Items</h2>
        <Badge variant="secondary">{total} require action</Badge>
        <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
        <strong>Catalog truth:</strong> every sellable master needs a positive published supplier price. Items with a distributor link stay here until a price is entered. Items with <strong>no distributor link</strong> are invalid catalog records and can be deleted from this tab.
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            aria-label="Search unpriced item name or SKU"
            placeholder="Search unpriced item name or SKU…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
          />
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={applySearch}>Search</Button>
        <Button
          size="sm"
          variant={unlinkedOnly ? "default" : "outline"}
          className="h-9 gap-1.5"
          onClick={toggleUnlinkedOnly}
          aria-pressed={unlinkedOnly}
        >
          <Unlink2 className="h-3.5 w-3.5" />
          {unlinkedOnly ? "Showing unlinked only" : "Show unlinked only"}
        </Button>
      </div>

      {error ? (
        <div className="space-y-3 py-12 text-center text-sm">
          <p className="text-destructive">Couldn’t load unpriced items: {error.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No unpriced items match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Code</th>
                <th className="w-16 px-2 py-2 text-center text-xs font-medium text-muted-foreground">Preview</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="w-48 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Distributor status</th>
                <th className="hidden w-20 px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:table-cell">W×H</th>
                <th className="w-32 px-3 py-2 text-center text-xs font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const linkedLines = distributorLineLabels(row.distributorNames);
                const isUnlinked = Number(row.supplierSkuCount) === 0;
                return (
                  <tr key={row.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-primary">{row.masterCode ?? "—"}</span></td>
                    <td className="px-2 py-2.5">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 p-0.5">
                        <CabinetImage cabinet={row} className="h-full w-full object-contain" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-xs text-foreground">{row.description ?? "No description"}</span>
                      {row.category && <span className="block text-[10px] text-muted-foreground">{row.category}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {isUnlinked ? (
                        <Badge variant="outline" className="border-rose-300 text-rose-700"><Unlink2 className="mr-1 h-3 w-3" />No distributor link</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="outline" className="border-amber-300 text-amber-700"><Link2 className="mr-1 h-3 w-3" />Price required</Badge>
                          <div className="flex flex-wrap gap-1">
                            {linkedLines.map((line) => <Badge key={line} variant="secondary" className="px-1.5 py-0 text-[10px]">{line}</Badge>)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground sm:table-cell">
                      {row.width ? `${parseFloat(row.width)}″` : "—"}×{row.height ? `${parseFloat(row.height)}″` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isUnlinked ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" disabled={deleteUnlinked.isPending}>
                              <Trash2 className="h-3 w-3" />
                              Delete item
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {row.masterCode ?? "this unlinked item"}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This record has no distributor SKU connection and no valid price. Deleting it removes the invalid master and its aliases/overrides. The server will block deletion if a cart, order, or saved design now references it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep item</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteUnlinked.mutate({ id: row.id })}>
                                Delete unlinked item
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : row.masterCode ? (
                        <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
                          <a href={cabinetFrontEndQuickEditUrl(row.masterCode, row.id)} target="_blank" rel="noopener noreferrer" title="Enter a price on a linked distributor line">
                            <Pencil className="h-3 w-3" />
                            Add price
                          </a>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages} ({total} total)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
