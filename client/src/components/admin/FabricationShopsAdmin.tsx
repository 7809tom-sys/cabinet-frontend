// Admin "Fabrication Shops" tab: the countertop fabrication shop list, one state
// at a time, with the upload button. Countertop quotes are matched to these
// shops by ZIP (see the Countertop Quotes tab). Read-only list; nothing is sent.

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FabricationShopUploadDialog } from "@/components/admin/FabricationShopUploadDialog";
import { FabShopPastUploads } from "@/components/admin/FabShopPastUploads";

type Shop = {
  id: number; name: string; state: string; zip: string | null; zipSource: string | null; city: string | null; address: string | null;
  region: string | null; phone: string | null; website: string | null; googleRating: string | number | null; reviewCount: number | null; confidence: string | null;
};

export function filterFabShops(shops: readonly Shop[], search: string): Shop[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...shops];
  return shops.filter((shop) => [shop.name, shop.city, shop.zip, shop.region, shop.address, shop.phone].some((value) => (value ?? "").toLowerCase().includes(needle)));
}

export default function FabricationShopsAdmin() {
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = trpc.fabShops.list.useQuery(state === "all" ? undefined : { state });
  const shops = useMemo(() => filterFabShops((data?.shops ?? []) as Shop[], search), [data, search]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (error) return <div className="py-12 text-center text-destructive">Couldn't load fabrication shops: {error.message}</div>;

  return (
    <div className="space-y-4" data-testid="fab-shops-admin">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Filter fabrication shops by state"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states ({data?.total ?? 0})</SelectItem>
            {(data?.states ?? []).map((s: { state: string; count: number }) => <SelectItem key={s.state} value={s.state}>{s.state} ({s.count})</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, city or ZIP" className="h-9 max-w-xs" aria-label="Search fabrication shops" />
        <FabricationShopUploadDialog />
        <span className="text-sm text-muted-foreground">{shops.length} shown</span>
      </div>
      {data && !data.ready && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">The fabrication shop list isn't set up yet. Run docs/sql/0291 in the TiDB SQL editor, then reload. Countertop quotes keep working in the meantime.</p>
      )}
      <FabShopPastUploads />
      {data?.ready && shops.length === 0 && <p className="py-8 text-center text-muted-foreground">No fabrication shops{state !== "all" ? ` in ${state}` : ""} yet. Use Upload shops to add a state's list.</p>}
      {shops.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">Shop</th><th className="p-2">City</th><th className="p-2">ZIP</th><th className="p-2">Phone</th><th className="p-2">Rating</th><th className="p-2">Confidence</th></tr></thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id} className="border-t align-top">
                  <td className="p-2">
                    <div className="font-medium">{shop.name}</div>
                    {shop.website && <a href={shop.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Website <ExternalLink className="h-3 w-3" /></a>}
                  </td>
                  <td className="p-2">{shop.city ?? "—"}, {shop.state}{shop.region ? <div className="text-xs text-muted-foreground">{shop.region}</div> : null}</td>
                  <td className="p-2">{shop.zip ?? "—"}{shop.zipSource === "city" ? <div className="text-xs text-muted-foreground">from city</div> : null}</td>
                  <td className="p-2 whitespace-nowrap">{shop.phone ?? "—"}</td>
                  <td className="p-2">{shop.googleRating != null ? `${Number(shop.googleRating).toFixed(1)}${shop.reviewCount != null ? ` (${shop.reviewCount})` : ""}` : "—"}</td>
                  <td className="p-2">{shop.confidence ? <Badge variant="outline" className="capitalize">{shop.confidence}</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
