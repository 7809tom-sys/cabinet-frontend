import type { DragEvent, ReactNode } from "react";
import { FileText, Plus } from "lucide-react";
import { CabinetImage } from "@/components/CabinetImage";
import { GlassPolicyBadge } from "@/components/GlassPolicyBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DesignCabinet } from "@/lib/design";

export type CatalogPaletteCardProps = {
  cabinet: DesignCabinet;
  description: string;
  /** Preformatted one-line size, e.g. 24"W × 17.63"H × 13½"D. Empty hides the line. */
  sizeLabel: string;
  sizeTestId?: string;
  finishSwatchUrl?: string | null;
  finishName?: string | null;
  showGlass?: boolean;
  placeHint?: ReactNode;
  placementDetailText?: string;
  showPlacementHint?: boolean;
  priceNotice?: string | null;
  cardTestId?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onPlace: () => void;
  onOpenSpecs?: () => void;
  specsTestId?: string;
  specsAriaLabel?: string;
  specsTitle?: string;
};

/**
 * Designer catalog row. The SKU and the width × height × depth line get the
 * full card width. Finish, add, and spec actions sit on a row underneath so
 * a 240px sidebar or a narrow drawer cannot clip the code or the size.
 */
export function CatalogPaletteCard({
  cabinet,
  description,
  sizeLabel,
  sizeTestId,
  finishSwatchUrl,
  finishName,
  showGlass = false,
  placeHint,
  placementDetailText,
  showPlacementHint = false,
  priceNotice,
  cardTestId,
  draggable = false,
  onDragStart,
  onDragEnd,
  onPlace,
  onOpenSpecs,
  specsTestId,
  specsAriaLabel,
  specsTitle = "View specifications",
}: CatalogPaletteCardProps) {
  const sku = cabinet.displayMasterCode ?? cabinet.masterCode;
  const placeLabel = placementDetailText ?? `Place ${sku}${sizeLabel ? `, ${sizeLabel}` : ""}`;
  const descriptionTitle = description.trim();

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={placementDetailText}
      data-testid={cardTestId}
      data-catalog-palette-card={cabinet.masterCode}
      className="group flex w-full min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <button
        type="button"
        onClick={onPlace}
        aria-label={placeLabel}
        className="flex w-full min-w-0 flex-col items-stretch gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex w-full min-w-0 items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <CabinetImage cabinet={cabinet} className="h-full w-auto max-w-full" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              data-testid={`catalog-card-sku-${cabinet.masterCode}`}
              className="block whitespace-normal break-words font-mono text-[11px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
            >
              {sku}
            </span>
            <span
              data-testid={`catalog-card-description-${cabinet.masterCode}`}
              title={descriptionTitle || undefined}
              className="block truncate text-[10px] leading-snug text-muted-foreground"
            >
              {description}
            </span>
            {showGlass ? <GlassPolicyBadge masterCode={cabinet.masterCode} glassIncluded={cabinet.glassIncluded} className="mt-0.5" /> : null}
            {placeHint ? <span className="mt-0.5 block text-[9px] font-medium leading-snug text-primary/70">{placeHint}</span> : null}
          </span>
        </span>
        {sizeLabel ? (
          <span
            data-testid={sizeTestId ?? `catalog-card-size-${cabinet.masterCode}`}
            title={sizeLabel}
            className="block w-full whitespace-nowrap text-[10px] font-medium leading-tight tracking-tight text-foreground"
          >
            {sizeLabel}
          </span>
        ) : null}
        {showPlacementHint ? (
          <span className="text-[9px] font-medium leading-snug text-emerald-700">
            Hover for dimensions &amp; flush-seam clearance
          </span>
        ) : null}
        {priceNotice ? (
          <span
            data-testid={`appliance-price-pending-${cabinet.masterCode}`}
            className="text-[9px] font-medium leading-snug text-amber-700"
          >
            {priceNotice}
          </span>
        ) : null}
      </button>
      <span className="flex items-center gap-1">
        {finishSwatchUrl ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onPlace}
            className="inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={finishName ? `${finishName} finish` : "selected finish"}
          >
            <img
              src={finishSwatchUrl}
              alt=""
              title={finishName ?? undefined}
              loading="lazy"
              className="h-5 w-5 rounded-sm border border-[#a07d4a]/40 object-cover"
            />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          onClick={onPlace}
          aria-label={`Add ${sku}`}
          className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
        {onOpenSpecs ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid={specsTestId}
                aria-label={specsAriaLabel ?? `View specifications for ${sku}`}
                title={specsTitle}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSpecs();
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#b98d3e]/60 bg-white text-[#634b20] transition hover:bg-[#fff4d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] active:scale-95"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{specsTitle}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
}
