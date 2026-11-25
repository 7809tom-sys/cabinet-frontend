import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { formatPrice } from "@/lib/pelican";
import {
  pelicanDisplayVariant,
  pelicanUseLabel,
  type PelicanConfiguration,
  type PelicanGroupable,
} from "@shared/pelicanConfigurationGrouping";
import { bathroomFixtureCardImage } from "@/lib/bathroomFixtureCatalog";
import { pelicanToiletCatalogPhoto } from "@/lib/pelicanToiletCatalogPhotos";
import { FlooringCartonFacts } from "./FlooringCartonFacts";
import { pelicanSinkCatalogDescription } from "@/lib/pelicanSinkCatalogDescriptions";
import { PelicanCadDownloads } from "@/components/pelican/PelicanCadDownloads";
import { PelicanFinishDot, PelicanVariantSelect } from "./PelicanVariantSelect";
import { customerFacingProductName, ProductPhoto } from "./ProductPhotoGrid";

import { useDesignerPricesHidden } from "@/lib/designerPriceVisibility";
/**
 * One Pelican model as a card, the same way the Hardware picker shows one
 * hardware model: product photo, small collection line, a clean title, a
 * dropdown for the finish / size / drain side, and a single action that records
 * the exact SKU chosen in the dropdown.
 *
 * Presentation only. `onUse` always receives the original catalog row of the
 * chosen variant, so pricing, fixture profiles and saved designs are unchanged.
 */
export function PelicanConfigurationCard<T extends PelicanGroupable>({
  configuration,
  selectedIds,
  onUse,
  actionLabel,
  note,
  testIdPrefix = "pelican-card",
}: {
  configuration: PelicanConfiguration<T>;
  selectedIds: ReadonlySet<number>;
  onUse: (variantItem: T, configuration: PelicanConfiguration<T>) => void;
  /** Overrides the default "Use this finish" wording, e.g. "Place in 3D". */
  actionLabel?: string;
  note?: ReactNode;
  testIdPrefix?: string;
}) {
  const hidePrices = useDesignerPricesHidden();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const variant = pelicanDisplayVariant(configuration, selectedIds, chosenId);
  const item = variant.item;
  const isSelected = selectedIds.has(item.id);
  const selectedElsewhere = !isSelected
    ? configuration.variants.find((entry) => selectedIds.has(entry.item.id))
    : undefined;
  const anySelected = isSelected || Boolean(selectedElsewhere);
  const image = bathroomFixtureCardImage(item.pelicanCode, item.imageUrl)
    ?? configuration.variants.map((entry) => bathroomFixtureCardImage(entry.item.pelicanCode, entry.item.imageUrl)).find(Boolean)
    ?? pelicanToiletCatalogPhoto(item.pelicanCode)
    ?? null;
  const wording = isSelected ? "Selected" : actionLabel ?? pelicanUseLabel(configuration.optionLabel);
  const multiple = configuration.variants.length > 1;
  const displayLabel = customerFacingProductName(configuration.label);

  return (
    <div
      data-testid={`${testIdPrefix}-${configuration.key}`}
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        anySelected ? "border-[#a87f33] bg-[#a87f33]/5 ring-1 ring-[#a87f33]/40" : "border-border"
      }`}
    >
      {/* The photo is a tap target too, the same as a door style tile. It runs
          the same action as the button below, so nothing about the choice changes. */}
      <button
        type="button"
        data-testid={`${testIdPrefix}-photo-${item.id}`}
        // A pointer shortcut for the button below: kept out of the tab order
        // and the accessibility tree so assistive tech hears one action.
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => onUse(item, configuration)}
        className={`relative block aspect-[4/3] w-full touch-manipulation transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4a75a] ${configuration.family === "quartz" ? "bg-muted" : "bg-white"}`}
      >
        <ProductPhoto
          imageUrl={image}
          name={`${displayLabel}${multiple ? ` in ${variant.label}` : ""}`}
          fit={configuration.family === "quartz" ? "cover" : "contain"}
        />
        {anySelected && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#a87f33] text-white"><Check className="h-3 w-3" /></span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-1.5">
        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{customerFacingProductName(configuration.eyebrow)}</p>
        <p className="line-clamp-2 min-h-[1.9rem] text-[11px] font-semibold leading-snug text-foreground">{displayLabel}</p>
        {multiple ? (
          <PelicanVariantSelect configuration={configuration} value={variant} onChange={setChosenId} compact />
        ) : (
          <p className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground">
            <PelicanFinishDot swatch={variant.swatch} />
            <span className="truncate">{variant.label !== "Standard" ? variant.label : item.size ?? ""}</span>
          </p>
        )}
        <p className="truncate text-[9px] text-muted-foreground">
          {item.pelicanCode}{item.size && multiple ? ` · ${item.size}` : ""}
        </p>
        <PelicanCadDownloads pelicanCode={item.pelicanCode} compact />
        {pelicanSinkCatalogDescription(item.pelicanCode) && (
          <p data-testid={`${testIdPrefix}-catalog-description-${item.id}`} className="line-clamp-4 text-[10px] leading-snug text-muted-foreground">
            {pelicanSinkCatalogDescription(item.pelicanCode)}
          </p>
        )}
        <FlooringCartonFacts product={item} testId={`flooring-carton-facts-${item.id}`} />
        {selectedElsewhere && (
          <p className="text-[10px] font-medium leading-snug text-[#8a6828]">In your design: {selectedElsewhere.label}</p>
        )}
        {note}
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[11px] font-bold text-[#1a2744] dark:text-foreground">{hidePrices ? null : formatPrice(item.sellPrice)}</span>
          <button
            type="button"
            aria-pressed={isSelected}
            aria-label={`${wording}: ${configuration.label}${multiple ? ` — ${variant.label}` : ""}`}
            data-testid={`${testIdPrefix}-use-${item.id}`}
            onClick={() => onUse(item, configuration)}
            className={`inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors ${
              isSelected ? "bg-[#a87f33]/15 text-[#6e5320] hover:bg-[#a87f33]/25" : "bg-[#1a2744] text-white hover:bg-[#243660]"
            }`}
          >
            {isSelected ? <Check className="h-3 w-3" /> : null}
            <span className="truncate">{wording}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
