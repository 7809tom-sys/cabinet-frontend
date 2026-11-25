// "Past uploads" on the Fabrication Shops tab: one row per upload (the Source
// text saved on each shop), with an Undo import button. Undo removes only the
// shops saved with exactly that Source and the quote matches pointing at them.

import { useState } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatQuoteDateCT } from "@/components/admin/countertopQuoteDisplay";

export type FabShopUpload = {
  sourceDoc: string;
  shops: number;
  firstCreatedAt: string | null;
  lastCreatedAt: string | null;
  quoteMatches: number;
  quoteMatchesFollowedUp: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The confirm text for undoing one upload. */
export function undoImportPrompt(upload: Pick<FabShopUpload, "sourceDoc" | "shops" | "quoteMatches">): string {
  return `Remove ${plural(upload.shops, "shop")} from "${upload.sourceDoc}" and ${plural(upload.quoteMatches, "quote match", "quote matches")}? This can't be undone.`;
}

export function FabShopPastUploads() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.fabShops.imports.useQuery();
  const undo = trpc.fabShops.undoImport.useMutation();
  const [pending, setPending] = useState<FabShopUpload | null>(null);
  const uploads = ((data?.imports ?? []) as FabShopUpload[]);

  async function confirmUndo() {
    const upload = pending;
    if (!upload) return;
    try {
      const result = (await undo.mutateAsync({ sourceDoc: upload.sourceDoc, confirmCount: upload.shops })) as { deletedShops: number; deletedQuoteMatches: number };
      toast.success(`Removed ${plural(result.deletedShops, "shop")} and ${plural(result.deletedQuoteMatches, "quote match", "quote matches")}.`);
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not undo that upload.");
    } finally {
      await Promise.all([utils.fabShops.imports.invalidate(), utils.fabShops.list.invalidate(), utils.fabShops.forQuotes.invalidate()]);
    }
  }

  if (isLoading || !data?.ready || uploads.length === 0) return null;

  return (
    <div className="rounded-md border" data-testid="fab-shops-past-uploads">
      <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">Past uploads</div>
      <ul className="divide-y text-sm">
        {uploads.map((upload) => (
          <li key={upload.sourceDoc} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="min-w-0 flex-1 break-words font-medium">{upload.sourceDoc}</span>
            <span className="text-muted-foreground">{plural(upload.shops, "shop")}</span>
            {upload.quoteMatches > 0 && (
              <span className="text-muted-foreground">
                {plural(upload.quoteMatches, "quote match", "quote matches")}
                {upload.quoteMatchesFollowedUp > 0 ? ` (${upload.quoteMatchesFollowedUp} followed up)` : ""}
              </span>
            )}
            <span className="text-muted-foreground">{formatQuoteDateCT(upload.lastCreatedAt) ?? "—"}</span>
            <Button size="sm" variant="outline" onClick={() => setPending(upload)} disabled={undo.isPending}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo import
            </Button>
          </li>
        ))}
      </ul>
      <AlertDialog open={pending != null} onOpenChange={(open) => { if (!open && !undo.isPending) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this upload?</AlertDialogTitle>
            <AlertDialogDescription>{pending ? undoImportPrompt(pending) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undo.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={undo.isPending}
              onClick={(event) => { event.preventDefault(); void confirmUndo(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {undo.isPending ? "Removing…" : "Undo import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
