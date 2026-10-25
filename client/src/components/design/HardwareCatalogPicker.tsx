import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  catalogHardwareFinishAccent,
  catalogHardwareStyleId,
  isCatalogCabinetHardwareType,
  type CatalogHardwareSelection,
} from "@/lib/hardware";
import { trpc } from "@/lib/trpc";

const ALL_STYLES = "__all_hardware_styles__";
const ALL_TYPES = "__all_hardware_types__";

interface Props {
  value: CatalogHardwareSelection | null;
  onSelect: (selection: CatalogHardwareSelection) => void;
  onClear: () => void;
  affiliateSlug?: string | null;
  compact?: boolean;
}

/**
 * Regular Designer selector for a real Hardware Resources variant. It records
 * only the exact product reference and compatible visual proxy; current retail
 * pricing is intentionally re-read from the public catalog when the Designer
 * prepares its materials list and cart line.
 */
export function HardwareCatalogPicker({ value, onSelect, onClear, affiliateSlug, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [collection, setCollection] = useState<string | undefined>();
  const [productType, setProductType] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, number>>({});

  const input = useMemo(() => ({
    collection,
    productType,
    search: search.trim() || undefined,
    limit: 60,
    offset: 0,
    affiliateSlug: affiliateSlug?.trim() || undefined,
  }), [affiliateSlug, collection, productType, search]);
  const { data: filters } = trpc.hardware.configurationFilters.useQuery(undefined, { staleTime: 60_000 });
  const { data, isLoading, error } = trpc.hardware.listConfigurations.useQuery(input, { enabled: open });
  const supportedTypes = (filters?.productTypes ?? []).filter(isCatalogCabinetHardwareType);
  const visibleItems = (data?.items ?? []).filter((item) => isCatalogCabinetHardwareType(item.productType));

  const choose = (item: typeof visibleItems[number], variant: typeof visibleItems[number]["variants"][number]) => {
    const style = catalogHardwareStyleId(item.productType);
    if (!style) return;
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
    setOpen(false);
  };

  const selectedLabel = value ? `${value.collection} · ${value.finish}` : "Select real hardware";
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="designer-real-hardware-trigger"
        aria-label="Select real cabinet hardware"
        title={value ? `Real hardware: ${value.collection} ${value.sku} in ${value.finish}` : "Choose a Hardware Resources cabinet hardware item for the design preview"}
        onClick={() => setOpen(true)}
        className={`min-h-8 gap-1.5 ${compact ? "h-9 w-full justify-start" : "max-w-52"}`}
      >
        <span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: value ? catalogHardwareFinishAccent(value.finish) : "#b8bbc0" }} />
        <Wrench className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{selectedLabel}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto p-0 sm:rounded-xl">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 text-left">
            <DialogTitle>Select real cabinet hardware</DialogTitle>
            <DialogDescription>
              Select a Hardware Resources knob, pull, cup pull, tab pull, or T-knob. The exact finish, SKU, image, compatible visual proxy, and current catalog price apply across the regular Designer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="designer-real-hardware-search">Search hardware</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="designer-real-hardware-search" data-testid="designer-real-hardware-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Style, finish, or item number" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="designer-real-hardware-style">Style</Label>
                <Select value={collection ?? ALL_STYLES} onValueChange={(next) => setCollection(next === ALL_STYLES ? undefined : next)}>
                  <SelectTrigger id="designer-real-hardware-style" aria-label="Filter real cabinet hardware by style"><SelectValue placeholder="All styles" /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL_STYLES}>All styles</SelectItem>{filters?.collections.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="designer-real-hardware-type">Type</Label>
                <Select value={productType ?? ALL_TYPES} onValueChange={(next) => setProductType(next === ALL_TYPES ? undefined : next)}>
                  <SelectTrigger id="designer-real-hardware-type" aria-label="Filter real cabinet hardware by type"><SelectValue placeholder="All cabinet types" /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL_TYPES}>All cabinet types</SelectItem>{supportedTypes.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {value && <Card className="flex flex-wrap items-center gap-3 border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-3 text-sm">
              {value.imageUrl && <img src={value.imageUrl} alt="" className="h-12 w-12 rounded border bg-white object-contain p-1" />}
              <div className="min-w-0 flex-1"><strong className="block truncate">Selected: {value.collection} · {value.finish}</strong><span className="text-xs text-muted-foreground">{value.productType} · {value.sku}</span></div>
              <Button type="button" variant="outline" size="sm" onClick={onClear}>Use generic Handles instead</Button>
            </Card>}

            {error ? <Card className="p-5 text-sm text-destructive">Could not load available hardware. {error.message}</Card>
              : isLoading ? <Card className="p-5 text-sm text-muted-foreground">Loading real hardware…</Card>
                : visibleItems.length === 0 ? <Card className="p-5 text-sm text-muted-foreground">No cabinet hardware matches those filters. Appliance handles are intentionally excluded from cabinet-door selection.</Card>
                  : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleItems.map((item) => {
                      const selected = item.variants.find((variant) => variant.id === selectedVariantIds[item.configurationKey]) ?? item.variants[0];
                      if (!selected) return null;
                      return <Card key={item.configurationKey} className="flex overflow-hidden p-0">
                        <div className="h-28 w-28 shrink-0 bg-muted/30 p-2">{selected.imageUrl && <img src={selected.imageUrl} alt={`${item.collection} ${item.productType} in ${selected.finish}`} className="h-full w-full object-contain" />}</div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.collection} · {item.productType}</p>
                          <p className="line-clamp-2 text-xs font-semibold leading-4">{item.label}</p>
                          <Select value={String(selected.id)} onValueChange={(next) => setSelectedVariantIds((current) => ({ ...current, [item.configurationKey]: Number(next) }))}>
                            <SelectTrigger aria-label={`Choose finish for ${item.collection} ${item.label}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{item.variants.map((variant) => <SelectItem key={variant.id} value={String(variant.id)}>{variant.finish} · {variant.sku}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button type="button" size="sm" data-testid={`designer-real-hardware-select-${selected.id}`} className="mt-auto h-8" onClick={() => choose(item, selected)}>Use this finish</Button>
                        </div>
                      </Card>;
                    })}
                  </div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
