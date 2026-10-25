import { useState, type ReactNode } from "react";
import { Check, Waves } from "lucide-react";
import { formatPrice } from "@/lib/pelican";
import {
  pelicanDisplayVariant,
  pelicanUseLabel,
  type PelicanConfiguration,
  type PelicanGroupable,
} from "@shared/pelicanConfigurationGrouping";
import { PelicanFinishDot, PelicanVariantSelect } from "./PelicanVariantSelect";

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
  const [chosenId, setChosenId] = useState<number | null>(null);
  const variant = pelicanDisplayVariant(configuration, selectedIds, chosenId);
  const item = variant.item;
  const isSelected = selectedIds.has(item.id);
  const selectedElsewhere = !isSelected
    ? configuration.variants.find((entry) => selectedIds.has(entry.item.id))
    : undefined;
  const anySelected = isSelected || Boolean(selectedElsewhere);
  const image = item.imageUrl ?? configuration.variants.find((entry) => entry.item.imageUrl)?.item.imageUrl ?? null;
  const wording = isSelected ? "Selected" : actionLabel ?? pelicanUseLabel(configuration.optionLabel);
  const multiple = configuration.variants.length > 1;

  return (
    <div
      data-testid={`${testIdPrefix}-${configuration.key}`}
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        anySelected ? "border-[#a87f33] bg-[#a87f33]/5 ring-1 ring-[#a87f33]/40" : "border-border"
      }`}
    >
      <div className={`relative aspect-[4/3] w-full ${configuration.family === "quartz" ? "bg-muted" : "bg-white"}`}>
        {image ? (
          <img
            src={image}
            alt={`${configuration.label}${multiple ? ` in ${variant.label}` : ""}`}
            loading="lazy"
            className={`h-full w-full ${configuration.family === "quartz" ? "object-cover" : "object-contain p-1.5"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><Waves className="h-5 w-5" /></div>
        )}
        {anySelected && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#a87f33] text-white"><Check className="h-3 w-3" /></span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-1.5">
        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{configuration.eyebrow}</p>
        <p className="line-clamp-2 min-h-[1.9rem] text-[11px] font-semibold leading-snug text-foreground">{configuration.label}</p>
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
        {selectedElsewhere && (
          <p className="text-[10px] font-medium leading-snug text-[#8a6828]">In your design: {selectedElsewhere.label}</p>
        )}
        {note}
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[11px] font-bold text-[#1a2744] dark:text-foreground">{formatPrice(item.sellPrice)}</span>
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
