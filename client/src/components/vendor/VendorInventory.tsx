import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { usePortalScopes } from "./usePortalScopes";
import { fileToCsv } from "./spreadsheetFile";

export function VendorInventory(props: { distributorId?: number; approvedVendorLineId?: number }) {
  const portal = usePortalScopes(props);
  const scope = portal.scope;
  const utils = trpc.useUtils();
  const list = trpc.vendorInventory.list.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ applicable: { sku: string; quantityOnHand?: number | null; leadTimeDays?: number | null; notes?: string | null; discontinued?: boolean | null; backorder?: boolean | null; minimumOrderQty?: number | null; restockDate?: string | null; outOfStock?: boolean | null }[]; unknown: { sku: string; message: string }[] } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lead, setLead] = useState("");
  const update = trpc.vendorInventory.updateInventory.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (error) => toast.error(error.message),
  });
  const previewUpload = trpc.vendorInventory.previewInventory.useMutation({
    onSuccess: (result) => setPreview(result),
    onError: (error) => toast.error(error.message),
  });
  const apply = trpc.vendorInventory.applyInventory.useMutation({
    onSuccess: (result) => {
      toast.success(`Updated ${result.applied} SKUs. ${result.unknown.length} unknown SKUs were not created.`);
      setPreview(null);
      void list.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const createKey = trpc.vendorInventory.createKey.useMutation({
    onSuccess: (result) => setToken(result.token),
    onError: (error) => toast.error(error.message),
  });
  const keys = trpc.vendorInventory.listKeys.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const revoke = trpc.vendorInventory.revokeKey.useMutation({
    onSuccess: () => void utils.vendorInventory.listKeys.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const setLeadTime = trpc.vendorInventory.setDefaultLeadTime.useMutation({
    onSuccess: () => toast.success("Default lead time saved"),
    onError: (error) => toast.error(error.message),
  });

  if (portal.isLoading || list.isLoading) return <Spinner />;
  if (!scope) return <p className="text-sm text-muted-foreground">Choose a vendor to manage inventory.</p>;
  const products = (list.data?.products ?? []).filter((row) => row.sku.toLowerCase().includes(search.toLowerCase()) || row.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inventory</h2>
        <p className="text-sm text-muted-foreground">
          On-hand quantity, lead time, discontinued, backorder, minimum order, restock date, and out of stock. These fields stay inside the portal. The public catalog availability display is unchanged. Default lead time: {list.data?.defaultLeadTimeDays ?? "—"} days.
        </p>
      </div>
      {portal.scopes.length > 1 && (
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={scope} onChange={(event) => portal.setScope(event.target.value)}>
          {portal.scopes.map((item) => <option key={item.scope} value={item.scope}>{item.label}</option>)}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search SKU" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Input className="max-w-[8rem]" placeholder="Lead days" value={lead} onChange={(event) => setLead(event.target.value)} />
        <Button variant="outline" disabled={scope === "pelican"} onClick={() => setLeadTime.mutate({ scope, leadTimeDays: Number(lead) })}>Save default lead time</Button>
        <label className="inline-flex items-center">
          <input type="file" accept=".csv,.xlsx,.xls" className="text-sm" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const csv = await fileToCsv(file);
              previewUpload.mutate({ scope, csv });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not read that file");
            }
          }} />
        </label>
      </div>
      {preview && (
        <div className="rounded-lg border p-3 text-sm">
          <p>{preview.applicable.length} rows ready. {preview.unknown.length} unknown SKUs will be reported and not created.</p>
          <ul className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
            {preview.unknown.map((row) => <li key={row.sku}>{row.sku}: {row.message}</li>)}
          </ul>
          <Button className="mt-2" size="sm" disabled={apply.isPending} onClick={() => apply.mutate({ scope, rows: preview.applicable, source: "upload" })}>Apply upload</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-left">On hand</th>
              <th className="px-2 py-1 text-left">Lead</th>
              <th className="px-2 py-1 text-left">MOQ</th>
              <th className="px-2 py-1 text-left">Restock</th>
              <th className="px-2 py-1 text-left">Flags</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 150).map((row) => (
              <InventoryRow key={`${row.table}:${row.id}`} scope={scope} row={row} onSave={(patch) => update.mutate({ scope, table: row.table, id: row.id, patch })} />
            ))}
          </tbody>
        </table>
      </div>
      <section className="space-y-2">
        <h3 className="font-semibold">Inventory sync key</h3>
        <p className="text-sm text-muted-foreground">The key is shown once. The server stores only its hash. POST JSON or CSV to /api/vendor-inventory/sync with Authorization: Bearer. About 30 requests a minute per key, per server process.</p>
        <Button variant="outline" onClick={() => createKey.mutate({ scope })}>Generate key</Button>
        {token && <p className="break-all rounded bg-muted p-2 font-mono text-xs">{token}</p>}
        <ul className="text-sm">
          {(keys.data ?? []).map((key) => (
            <li key={key.id} className="flex items-center gap-2">
              <span className="font-mono">{key.keyPrefix}…</span>
              {key.revokedAt ? <span className="text-muted-foreground">revoked</span> : <Button size="sm" variant="ghost" onClick={() => revoke.mutate({ scope, id: key.id })}>Revoke</Button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InventoryRow({
  scope,
  row,
  onSave,
}: {
  scope: string;
  row: {
    sku: string;
    onHandQty: number | null;
    leadTimeDays: number | null;
    minimumOrderQty: number | null;
    restockDate: string | null;
    discontinued: boolean;
    backorder: boolean;
    outOfStock: boolean;
    conflictStatus: string | null;
    inventoryNotes: string | null;
  };
  onSave: (patch: { onHandQty: number; leadTimeDays: number | null; minimumOrderQty: number | null; restockDate: string | null; discontinued: boolean; backorder: boolean; outOfStock: boolean; inventoryNotes: string | null }) => void;
}) {
  const [qty, setQty] = useState(row.onHandQty == null ? "" : String(row.onHandQty));
  const [lead, setLead] = useState(row.leadTimeDays == null ? "" : String(row.leadTimeDays));
  const [moq, setMoq] = useState(row.minimumOrderQty == null ? "" : String(row.minimumOrderQty));
  const [restock, setRestock] = useState(row.restockDate ?? "");
  const [discontinued, setDiscontinued] = useState(row.discontinued);
  const [backorder, setBackorder] = useState(row.backorder);
  const [outOfStock, setOutOfStock] = useState(row.outOfStock);
  void scope;
  return (
    <tr className="border-t">
      <td className="px-2 py-1 font-mono text-xs">{row.sku}{row.conflictStatus === "conflict" ? " · conflict" : ""}</td>
      <td className="px-2 py-1"><Input className="h-8 w-20" value={qty} onChange={(event) => setQty(event.target.value)} /></td>
      <td className="px-2 py-1"><Input className="h-8 w-16" value={lead} onChange={(event) => setLead(event.target.value)} /></td>
      <td className="px-2 py-1"><Input className="h-8 w-16" value={moq} onChange={(event) => setMoq(event.target.value)} /></td>
      <td className="px-2 py-1"><Input className="h-8 w-32" type="date" value={restock} onChange={(event) => setRestock(event.target.value)} /></td>
      <td className="px-2 py-1 text-xs">
        <label className="mr-2"><input type="checkbox" checked={discontinued} onChange={(event) => setDiscontinued(event.target.checked)} /> Disc.</label>
        <label className="mr-2"><input type="checkbox" checked={backorder} onChange={(event) => setBackorder(event.target.checked)} /> BO</label>
        <label className="mr-2"><input type="checkbox" checked={outOfStock} onChange={(event) => setOutOfStock(event.target.checked)} /> OOS</label>
        <Button size="sm" variant="outline" onClick={() => onSave({
          onHandQty: Number(qty || 0),
          leadTimeDays: lead === "" ? null : Number(lead),
          minimumOrderQty: moq === "" ? null : Number(moq),
          restockDate: restock || null,
          discontinued,
          backorder,
          outOfStock,
          inventoryNotes: row.inventoryNotes,
        })}>Save</Button>
      </td>
    </tr>
  );
}
