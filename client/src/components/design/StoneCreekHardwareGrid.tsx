import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  catalogHardwareStyleId,
  isCatalogCabinetHardwareType,
  type CatalogHardwareSelection,
} from "@/lib/hardware";
import { formatPrice } from "@/lib/pelican";
import { trpc } from "@/lib/trpc";

/** Customer-facing brand for the cabinet hardware line. The supplier name is never shown. */
export const STONE_CREEK_HARDWARE_LABEL = "Stone Creek Hardware";

/** Supplier names that must never reach a customer, even if one appears in imported catalog text. */
const HIDDEN_SUPPLIER_NAMES = /\b(hardware\s+resources|line\s*dl)\b/gi;

export function stoneCreekHardwareText(value: string | null | undefined): string {
  return (value ?? "").replace(HIDDEN_SUPPLIER_NAMES, STONE_CREEK_HARDWARE_LABEL).replace(/\s{2,}/g, " ").trim();
}

type HardwareVariant = { id: number; sku: string; finish: string; imageUrl: string | null; unitPriceCents: number | null };
type HardwareConfiguration = { collection: string; productType: string; configurationKey: string; label: string; variants: HardwareVariant[] };

/**
 * The Hardware tab of the Surfaces & Fixtures panel. It lists the same real
 * cabinet hardware catalog the Designer's hardware picker reads (knobs, pulls,
 * cup pulls, tab pulls, T-knobs; appliance handles excluded), labeled as
 * Stone Creek Hardware. Choosing a finish applies it to the design exactly like
 * the existing hardware picker does. Prices follow the route's hide-prices rule.
 */
export function StoneCreekHardwareGrid({
  open,
  search,
  affiliateSlug,
  value,
  onSelect,
  hidePrices,
}: {
  open: boolean;
  search: string;
  affiliateSlug?: string | null;
  value: CatalogHardwareSelection | null;
  onSelect: (selection: CatalogHardwareSelection) => void;
  hidePrices: boolean;
}) {
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, number>>({});
  const { data, isLoading, error } = trpc.hardware.listConfigurations.useQuery(
    {
      search: search.trim() || undefined,
      limit: 60,
      offset: 0,
      affiliateSlug: affiliateSlug?.trim() || undefined,
    },
    { enabled: open },
  );
  const items = ((data?.items ?? []) as HardwareConfiguration[]).filter((item) => isCatalogCabinetHardwareType(item.productType));

  if (error) {
    return <div className="py-14 text-center text-sm text-destructive">Could not load {STONE_CREEK_HARDWARE_LABEL}. Please try again.</div>;
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="py-14 text-center text-sm text-muted-foreground">No {STONE_CREEK_HARDWARE_LABEL} items match your search.</div>;
  }

  return (
    <div data-testid="stone-creek-hardware-grid" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const variant = item.variants.find((v) => v.id === selectedVariantIds[item.configurationKey])
          ?? item.variants.find((v) => v.id === value?.vendorProductId)
          ?? item.variants[0];
        if (!variant) return null;
        const isSelected = value?.vendorProductId === variant.id;
        const title = `${stoneCreekHardwareText(item.collection)} ${item.productType}`.trim();
        const choose = () => {
          if (!catalogHardwareStyleId(item.productType)) return;
          onSelect({
            vendorProductId: variant.id,
            sku: variant.sku,
            collection: item.collection,
            productType: item.productType,
            configurationKey: item.configurationKey,
            configurationLabel: item.label,
            finish: variant.finish,
            imageUrl: variant.imageUrl,
          });
        };
        return (
          <div
            key={item.configurationKey}
            data-testid={`stone-creek-hardware-card-${variant.id}`}
            className={`flex flex-col overflow-hidden rounded-lg border bg-white transition ${isSelected ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/40" : "border-border"}`}
          >
            <div className="aspect-square bg-muted/30 p-3">
              {variant.imageUrl && (
                <img
                  src={variant.imageUrl}
                  alt={`${STONE_CREEK_HARDWARE_LABEL} ${title} in ${variant.finish}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-gold)]">{STONE_CREEK_HARDWARE_LABEL}</p>
              <p className="text-xs font-semibold leading-4">{title}</p>
              <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{stoneCreekHardwareText(item.label)}</p>
              {item.variants.length > 1 ? (
                <Select
                  value={String(variant.id)}
                  onValueChange={(next) => setSelectedVariantIds((current) => ({ ...current, [item.configurationKey]: Number(next) }))}
                >
                  <SelectTrigger aria-label={`Choose finish for ${STONE_CREEK_HARDWARE_LABEL} ${title}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {item.variants.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.finish} · {v.sku}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[11px] text-muted-foreground">{variant.finish} · {variant.sku}</p>
              )}
              {!hidePrices && (
                <p className="text-sm font-bold text-[var(--color-navy)]">
                  {variant.unitPriceCents != null ? formatPrice(variant.unitPriceCents / 100) : "Price unavailable"}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className="mt-auto h-8 gap-1 text-xs"
                data-testid={`stone-creek-hardware-select-${variant.id}`}
                onClick={choose}
              >
                {isSelected ? <><Check className="h-3.5 w-3.5" /> Selected</> : "Use this finish"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
