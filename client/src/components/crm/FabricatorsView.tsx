// Fabricators: the countertop fabrication shops behind countertop quotes.
// Same shape as the Cabinet Shops view next to it - a state drop-down over a
// list - but the rows come from the fabrication_shops table (see fabShops router),
// not from CRM deals.

import { useMemo, useState } from "react";
import { Building2, ExternalLink, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FabricatorsView({ lang = "en" }: { lang?: "en" | "es" }) {
  const [state, setState] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = trpc.fabShops.list.useQuery(
    { state: state === "all" ? null : state },
    { retry: false },
  );

  const shops = data?.shops ?? [];
  const states = data?.states ?? [];
  const total = data?.total ?? 0;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter((shop: any) =>
      [shop.name, shop.city, shop.zip, shop.state, shop.phone, shop.email, shop.website]
        .filter(Boolean)
        .some((value: any) => String(value).toLowerCase().includes(needle)),
    );
  }, [shops, search]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        {lang === "es" ? "No se pudieron cargar los fabricantes." : "Couldn't load fabricators."} {error.message}
        <button type="button" className="ml-2 font-semibold underline" onClick={() => refetch()}>
          {lang === "es" ? "Reintentar" : "Retry"}
        </button>
      </div>
    );
  }

  if (!data?.ready) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Building2 className="h-4 w-4" />
          {lang === "es" ? "La lista de fabricantes no está creada todavía." : "The fabrication shop list is not set up yet."}
        </p>
        <p className="mt-1 text-muted-foreground">
          {lang === "es" ? "Ejecuta docs/sql/0291 en el editor SQL de TiDB." : "Run docs/sql/0291 in the TiDB SQL editor."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="h-9 w-[170px] bg-white" aria-label="Filter fabricators by state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states ({total})</SelectItem>
            {states.map(({ state: code, count }: { state: string; count: number }) => (
              <SelectItem key={code} value={code}>{code} ({count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 w-64 bg-white pl-8"
            placeholder={lang === "es" ? "Buscar fabricante" : "Search fabricators"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search fabricators"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {visible.length} {lang === "es" ? "fabricantes" : "shops"}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center text-sm text-muted-foreground">
          {lang === "es" ? "Ningún fabricante coincide." : "No fabricators match this filter."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Fabricator</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((shop: any) => (
                <tr key={shop.id} className="border-b align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{shop.name}</span>
                    {shop.website && (
                      <a
                        className="ml-2 inline-flex items-center gap-0.5 text-xs text-blue-700 underline underline-offset-2"
                        href={shop.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {!shop.isActive && <span className="ml-2 text-[10px] uppercase text-muted-foreground">inactive</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[shop.city, [shop.state, shop.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{shop.phone ?? "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {shop.googleRating ? Number(shop.googleRating).toFixed(1) : "-"}
                    {shop.reviewCount ? <span className="text-xs"> ({shop.reviewCount})</span> : null}
                  </td>
                  <td className="max-w-[18rem] px-3 py-2 text-muted-foreground">
                    <span className="line-clamp-2">{shop.sourceDoc ?? "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
