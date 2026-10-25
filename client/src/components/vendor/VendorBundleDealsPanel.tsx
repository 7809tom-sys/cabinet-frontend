import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  PackageOpen, Trash2, LayoutGrid, DollarSign, Eye, EyeOff, MapPin, Lock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function VendorBundleDealsPanel({ distributorId, distributorName }: { distributorId?: number; distributorName?: string }) {
  const utils = trpc.useUtils();
  const bundles = trpc.priceShop.listBundleDeals.useQuery(
    distributorId ? { distributorId } : undefined,
    { enabled: !!distributorId },
  );
  const toggleMut = trpc.priceShop.toggleBundlePublished.useMutation({
    onSuccess: () => { utils.priceShop.listBundleDeals.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.priceShop.deleteBundleDeal.useMutation({
    onSuccess: () => {
      utils.priceShop.listBundleDeals.invalidate();
      toast.success("Kitchen Package deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteId, setDeleteId] = useState<number | null>(null);

  if (!distributorId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Select a supply line to manage kitchen packages.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <PackageOpen className="h-5 w-5" /> Kitchen Packages
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create pre-designed kitchen packages featuring your cabinet lines. Packages are automatically locked to{" "}
          <span className="font-medium text-foreground">{distributorName ?? "your supply line"}</span> styles.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-1.5 w-fit">
          <Lock className="h-3 w-3" />
          Kitchen packages you create will only feature {distributorName ?? "your"} cabinet styles
        </div>
      </div>

      {bundles.isLoading ? (
        <div className="p-6 text-center text-muted-foreground">
          <PackageOpen className="h-8 w-8 mx-auto mb-2 animate-pulse opacity-40" />
          Loading kitchen packages…
        </div>
      ) : !bundles.data || bundles.data.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed border-border">
          <PackageOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <h3 className="font-semibold text-foreground mb-1">No Kitchen Packages Yet</h3>
          <p className="text-sm max-w-sm mx-auto">
            Open the Design Tool, create a kitchen layout with your cabinet styles, then use More → "Save as Kitchen Package" to create your first kitchen package.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{bundles.data.length} kitchen package{bundles.data.length !== 1 ? "s" : ""} total</p>

          {bundles.data.map((bundle) => (
            <div
              key={bundle.id}
              className={`rounded-lg border p-4 flex gap-3 items-start transition-colors ${
                bundle.isPublished ? "border-border bg-card" : "border-dashed border-muted-foreground/30 bg-muted/20"
              }`}
            >
              {/* Floor plan image or icon */}
              <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {bundle.floorPlanImageUrl ? (
                  <img src={bundle.floorPlanImageUrl} alt={bundle.name} className="w-full h-full object-contain bg-white p-1" />
                ) : bundle.heroImageUrl ? (
                  <img src={bundle.heroImageUrl} alt={bundle.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <MapPin className="h-5 w-5 text-muted-foreground/40" />
                    <span className="text-[9px] text-muted-foreground/40">
                      {bundle.roomWidthInches && bundle.roomDepthInches
                        ? `${Math.round(bundle.roomWidthInches / 12)}' × ${Math.round(bundle.roomDepthInches / 12)}'`
                        : "No plan"}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground leading-tight">{bundle.name}</span>
                  <Badge
                    variant={bundle.isPublished ? "default" : "secondary"}
                    className={`text-[10px] shrink-0 ${bundle.isPublished ? "bg-green-600 text-white" : ""}`}
                  >
                    {bundle.isPublished ? <><Eye className="h-2.5 w-2.5 mr-1" />Published</> : <><EyeOff className="h-2.5 w-2.5 mr-1" />Unpublished</>}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  {bundle.styleName && <span>{bundle.styleName}</span>}
                  {bundle.cabinetCount > 0 && (
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="h-3 w-3" />{bundle.cabinetCount} cabinets
                    </span>
                  )}
                  {bundle.homeownerPrice && (
                    <span className="flex items-center gap-1 text-[#d4a75a] font-semibold">
                      <DollarSign className="h-3 w-3" />
                      {parseFloat(bundle.homeownerPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{bundle.isPublished ? "Live" : "Hidden"}</span>
                  <Switch
                    checked={bundle.isPublished}
                    onCheckedChange={(checked) => {
                      toggleMut.mutate({ id: bundle.id, published: checked });
                      toast.info(checked ? `"${bundle.name}" published` : `"${bundle.name}" unpublished`);
                    }}
                    disabled={toggleMut.isPending}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteId(bundle.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Kitchen Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the kitchen package. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (deleteId !== null) deleteMut.mutate({ id: deleteId });
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
