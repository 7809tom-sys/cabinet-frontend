import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE = 100;

/**
 * Exactly which cabinets are ON and OFF for one distributor line + door style
 * (for example a Skyline line in Gray). A row is ON only when it is available,
 * published, and approved; anything else is OFF.
 */
export function CabinetAvailabilityPanel() {
  const [distributorId, setDistributorId] = useState<number | undefined>();
  const [styleId, setStyleId] = useState<number | undefined>();
  const [state, setState] = useState<"all" | "on" | "off">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: distributors } = trpc.distributors.list.useQuery();
  const { data: styles } = trpc.cabinets.adminAvailabilityStyles.useQuery(
    { distributorId: distributorId! },
    { enabled: distributorId != null },
  );
  const { data, isLoading } = trpc.cabinets.adminAvailabilityList.useQuery({
    distributorId,
    styleId,
    state,
    search: search || undefined,
    page,
    limit: PAGE,
  });
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE));

  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-testid="cabinet-availability-panel">
      <div>
        <h3 className="text-sm font-semibold">Availability by distributor and door style</h3>
        <p className="text-[11px] text-muted-foreground">
          Choose a distributor line and a door style to see exactly which cabinets are ON and OFF. A cabinet is ON only when it is available, published and approved.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={distributorId ? String(distributorId) : "__all__"}
          onValueChange={(v) => { setDistributorId(v === "__all__" ? undefined : Number(v)); setStyleId(undefined); setPage(0); }}
        >
          <SelectTrigger className="h-8 text-sm w-52" data-testid="availability-distributor"><SelectValue placeholder="All distributors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All distributors</SelectItem>
            {(distributors ?? []).map((d: { id: number; name: string }) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={styleId ? String(styleId) : "__all__"}
          onValueChange={(v) => { setStyleId(v === "__all__" ? undefined : Number(v)); setPage(0); }}
          disabled={distributorId == null}
        >
          <SelectTrigger className="h-8 text-sm w-52" data-testid="availability-style"><SelectValue placeholder="All door styles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All door styles</SelectItem>
            {(styles ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={(v) => { setState(v as "all" | "on" | "off"); setPage(0); }}>
          <SelectTrigger className="h-8 text-sm w-32" data-testid="availability-state"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ON and OFF</SelectItem>
            <SelectItem value="on">ON only</SelectItem>
            <SelectItem value="off">OFF only</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8 text-sm w-56"
          placeholder="Cabinet code or name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(0); } }}
        />
        <Button size="sm" variant="outline" className="h-8" onClick={() => { setSearch(searchInput); setPage(0); }}>Search</Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs" data-testid="availability-counts">
        <Badge variant="secondary">{(data?.onCount ?? 0).toLocaleString()} ON</Badge>
        <Badge variant="outline">{(data?.offCount ?? 0).toLocaleString()} OFF</Badge>
        <span className="text-muted-foreground self-center">{isLoading ? "Loading…" : `${(data?.total ?? 0).toLocaleString()} shown in this filter`}</span>
      </div>
      <div className="max-h-96 overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left">
            <tr><th className="p-1.5">Cabinet</th><th className="p-1.5">Distributor</th><th className="p-1.5">Door style</th><th className="p-1.5">Vendor SKU</th><th className="p-1.5">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = r.isAvailable && r.isPublished && r.status === "approved";
              const why = !r.isAvailable ? "Unavailable" : !r.isPublished ? "Unpublished" : r.status !== "approved" ? r.status : "";
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-1.5"><span className="font-mono font-semibold">{r.masterCode}</span> <span className="text-muted-foreground">{r.description?.slice(0, 50)}</span></td>
                  <td className="p-1.5">{r.distributor}</td>
                  <td className="p-1.5">{r.style}</td>
                  <td className="p-1.5 font-mono">{r.distributorSku}</td>
                  <td className="p-1.5">{on ? <Badge>ON</Badge> : <Badge variant="destructive">OFF{why ? ` · ${why}` : ""}</Badge>}</td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No cabinets match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span>Page {page + 1} of {pages}</span>
        <Button size="sm" variant="outline" className="h-7" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
