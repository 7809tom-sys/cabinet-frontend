import { Link } from "wouter";
import { Box, ExternalLink, Layers3, PackagePlus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CabinetImage } from "@/components/CabinetImage";
import { GlassPolicyBadge } from "@/components/GlassPolicyBadge";
import { cabinetTypeLabel, type CabinetLike } from "@/lib/cabinetGraphics";
import {
  cabinetConfigurationSummary,
  cabinetDimensionSummary,
  suggestedAccessoryOptions,
  type CatalogQuickViewItem,
} from "@/lib/catalogQuickView";

type QuickViewCabinet = CabinetLike & CatalogQuickViewItem & {
  description: string | null;
  glassIncluded?: boolean | null;
};

type CabinetQuickViewDialogProps = {
  cabinet: QuickViewCabinet | null;
  catalogItems: QuickViewCabinet[];
  styleId?: number | null;
  open: boolean;
  accessoryLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCabinet: (cabinet: QuickViewCabinet) => void;
};

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function CabinetQuickViewDialog({
  cabinet,
  catalogItems,
  styleId,
  open,
  accessoryLoading = false,
  onOpenChange,
  onSelectCabinet,
}: CabinetQuickViewDialogProps) {
  if (!cabinet) return null;

  const configuration = cabinetConfigurationSummary(cabinet);
  const accessoryOptions = suggestedAccessoryOptions(cabinet, catalogItems);
  const productHref = styleId
    ? `/catalog/${cabinet.masterCode}?style=${styleId}`
    : `/catalog/${cabinet.masterCode}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="cabinet-quick-view-dialog"
        className="max-h-[min(90vh,48rem)] max-w-3xl overflow-y-auto p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4 pr-12 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {cabinet.masterCode}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {cabinetTypeLabel(cabinet)}
            </span>
          </div>
          <DialogTitle>Cabinet quick view</DialogTitle>
          <DialogDescription>
            Review the cabinet facts and selected-line accessories without leaving the catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-56 items-center justify-center rounded-xl border border-border bg-gradient-to-b from-white to-muted/40 p-5">
            <CabinetImage cabinet={cabinet} className="max-h-64 w-auto max-w-full" />
          </div>

          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-foreground">{cabinet.description}</p>
            <GlassPolicyBadge masterCode={cabinet.masterCode} glassIncluded={cabinet.glassIncluded} className="mt-2" />

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Exact dimensions</h3>
              </div>
              <p data-testid="cabinet-quick-view-dimensions" className="mt-2 text-sm font-medium text-foreground">
                {cabinetDimensionSummary(cabinet)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Cabinet box dimensions; verify appliance, wall, and filler clearances in the final design.
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2">
              <Fact label="Category" value={cabinet.category} />
              <Fact label="Cabinet type" value={cabinet.subCategory ?? cabinet.placementType ?? null} />
              <Fact label="Configuration" value={configuration.length ? configuration.join(" · ") : "See product detail"} />
              <Fact label="Placement" value={cabinet.placementType ? `${cabinet.placementType} placement` : null} />
            </dl>
          </div>
        </div>

        <section className="border-t border-border bg-muted/20 px-5 py-5 sm:px-6" aria-labelledby="quick-view-accessories-heading">
          <div className="flex items-start gap-2">
            <PackagePlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <h3 id="quick-view-accessories-heading" className="text-sm font-semibold text-foreground">Suggested accessory options</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Options are available in the selected cabinet line. Confirm the exact cut, color, and fit after adjoining cabinets and wall conditions are known.
              </p>
            </div>
          </div>

          {accessoryLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading style-matched accessory options…</p>
          ) : accessoryOptions.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="cabinet-quick-view-accessories">
              {accessoryOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectCabinet(option as QuickViewCabinet)}
                  className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Quick view ${option.masterCode}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Box className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-semibold text-primary">{option.masterCode}</span>
                    <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">{option.description || option.subCategory || "Accessory"}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{cabinetDimensionSummary(option)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">View</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
              No compatible accessory suggestions are currently published for this selected line.
            </p>
          )}
        </section>

        <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
          <Button asChild className="gap-2">
            <Link href={productHref}>
              Open full details <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
