import type { MouseEvent, KeyboardEvent } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/pelican";
import {
  pelicanVariantMenuLabel,
  type PelicanConfiguration,
  type PelicanGroupable,
  type PelicanVariant,
} from "@shared/pelicanConfigurationGrouping";

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

/** Small colour dot for metal and wall-panel finishes; omitted when a variant has no finish colour. */
export function PelicanFinishDot({ swatch }: { swatch: string | null }) {
  if (!swatch) return null;
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: swatch }} />;
}

/**
 * Finish / size / drain selector for one Pelican model, styled like the
 * Hardware picker's finish dropdown. Every entry is an exact catalog SKU; the
 * selector only chooses which one the card shows and records. It can sit inside
 * a clickable card: clicks and keys stop here instead of toggling the card.
 */
export function PelicanVariantSelect<T extends PelicanGroupable>({
  configuration,
  value,
  onChange,
  compact = false,
}: {
  configuration: PelicanConfiguration<T>;
  value: PelicanVariant<T>;
  onChange: (itemId: number) => void;
  compact?: boolean;
}) {
  if (configuration.variants.length < 2) return null;
  return (
    <div onClick={stop} onKeyDown={stop} className="min-w-0">
      <Select value={String(value.item.id)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger
          aria-label={`Choose ${configuration.optionLabel.toLowerCase()} for ${configuration.label}`}
          data-testid={`pelican-variant-select-${configuration.key}`}
          className={`w-full gap-1.5 ${compact ? "h-7 px-2 text-[11px]" : "h-8 text-xs"}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {configuration.variants.map((variant) => (
            <SelectItem key={variant.item.id} value={String(variant.item.id)}>
              <span className="flex items-center gap-1.5">
                <PelicanFinishDot swatch={variant.swatch} />
                <span>{pelicanVariantMenuLabel(configuration, variant, formatPrice)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
