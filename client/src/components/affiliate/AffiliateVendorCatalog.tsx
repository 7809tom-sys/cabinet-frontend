import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { buildAffiliateCatalogVendors } from "@shared/affiliateStorefrontControls";

export default function AffiliateVendorCatalog({
  vendorKey,
  vendorLabel,
  affiliateId,
  isAdmin,
  onShowAllVendors,
}: {
  vendorKey: string;
  vendorLabel: string;
  affiliateId?: number;
  isAdmin: boolean;
  onShowAllVendors: () => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"all" | "shown" | "hidden">("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ownBranding = trpc.affiliates.myBranding.useQuery(undefined, { enabled: !isAdmin });
  const adminBranding = trpc.affiliates.adminBranding.useQuery(
    { affiliateId: affiliateId ?? 0 },
    { enabled: Boolean(isAdmin && affiliateId) },
  );
  const distributorSelections = (isAdmin ? adminBranding.data : ownBranding.data)?.distributorSelections;
  const resolvedLabel = useMemo(() => {
    const nav = buildAffiliateCatalogVendors(distributorSelections
      ? distributorSelections.map((row) => ({ id: row.id, name: row.name, publicName: row.publicName, selected: row.selected }))
      : null);
    return nav.vendors.find((vendor) => vendor.key === vendorKey)?.label ?? vendorLabel;
  }, [distributorSelections, vendorKey, vendorLabel]);
  const scope = isAdmin && affiliateId ? { affiliateId } : {};
  const query = trpc.affiliates.catalogProducts.useQuery({
    vendorKey,
    search,
    visibility,
    limit: 40,
    offset,
    ...scope,
  });
  const invalidate = () => utils.affiliates.catalogProducts.invalidate();
  const setProducts = trpc.affiliates.setCatalogProductVisibility.useMutation({
    onSuccess: () => { toast.success("Storefront catalog updated"); invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const setVendor = trpc.affiliates.setVendorCatalogVisibility.useMutation({
    onSuccess: () => { toast.success("Storefront catalog updated"); setSelected(new Set()); invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const products = query.data?.products ?? [];
  const pageKeys = products.map((product) => product.key);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));
  const busy = setProducts.isPending || setVendor.isPending;

  const apply = (keys: string[], shown: boolean) => {
    if (keys.length === 0) return;
    setProducts.mutate({ vendorKey, productKeys: keys, shown, ...scope });
  };

  const summary = useMemo(() => {
    if (!query.data) return "";
    return `${query.data.shownCount} shown · ${query.data.hiddenCount} hidden`;
  }, [query.data]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={onShowAllVendors}>
            My Catalog
          </button>
          <h1 className="text-2xl font-semibold">{resolvedLabel}</h1>
          <p className="text-sm text-muted-foreground">Choose which products appear on your storefront. Everything is shown until you hide it. {summary}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setOffset(0); }}
          placeholder="Search this catalog"
          className="w-56"
        />
        {(["all", "shown", "hidden"] as const).map((value) => (
          <Button key={value} type="button" size="sm" variant={visibility === value ? "default" : "outline"} onClick={() => { setVisibility(value); setOffset(0); }}>
            {value === "all" ? "All" : value === "shown" ? "Shown" : "Hidden"}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy || pageKeys.length === 0} onClick={() => setSelected(allPageSelected ? new Set() : new Set(pageKeys))}>
          {allPageSelected ? "Clear selection" : "Select all"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => apply(Array.from(selected), true)}>Show selected</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => apply(Array.from(selected), false)}>Hide selected</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setVendor.mutate({ vendorKey, shown: true, ...scope })}>Show all</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setVendor.mutate({ vendorKey, shown: false, ...scope })}>Hide all</Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        {products.map((product) => (
          <div key={product.key} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
            <input
              type="checkbox"
              aria-label={`Select ${product.name}`}
              checked={selected.has(product.key)}
              onChange={(event) => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(product.key);
                  else next.delete(product.key);
                  return next;
                });
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="truncate text-xs text-muted-foreground">{product.sku} · {product.detail}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Show on my storefront
              <Switch
                checked={product.shown}
                disabled={busy}
                onCheckedChange={(shown) => apply([product.key], shown)}
                aria-label={`Show ${product.name} on my storefront`}
              />
            </label>
          </div>
        ))}
        {query.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading catalog…</p>}
        {!query.isLoading && products.length === 0 && <p className="p-4 text-sm text-muted-foreground">No products match this filter.</p>}
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 40))}>Previous</Button>
        <span className="text-xs text-muted-foreground">{query.data ? `${offset + 1}–${Math.min(offset + products.length, query.data.total)} of ${query.data.total}` : ""}</span>
        <Button type="button" size="sm" variant="outline" disabled={!query.data || offset + products.length >= query.data.total} onClick={() => setOffset((value) => value + 40)}>Next</Button>
      </div>
    </div>
  );
}
