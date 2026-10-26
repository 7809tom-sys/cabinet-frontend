import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";

export default function VendorInventoryAdmin() {
  const query = trpc.vendorInventory.adminList.useQuery();
  if (query.isLoading) return <Spinner />;
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>;
  const lines = query.data?.lines ?? [];
  const skus = query.data?.skus ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Vendor inventory</h2>
        <p className="text-sm text-muted-foreground">Read-only. On-hand quantities here do not change the public catalog availability flags.</p>
      </div>
      {lines.map((line) => {
        const rows = skus.filter((sku) => sku.distributorId === line.id);
        return (
          <section key={line.id} className="space-y-2">
            <h3 className="font-medium">{line.name}</h3>
            <p className="text-xs text-muted-foreground">
              Default lead time {line.leadTimeDays ?? "—"} days.
              Last sync {line.inventoryLastSyncAt ? new Date(line.inventoryLastSyncAt).toLocaleString() : "never"}
              {line.inventoryLastSyncSource ? ` (${line.inventoryLastSyncSource})` : ""}.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">SKU</th>
                    <th className="px-2 py-1 text-left">On hand</th>
                    <th className="px-2 py-1 text-left">Lead time</th>
                    <th className="px-2 py-1 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row) => (
                    <tr key={row.sku} className="border-t">
                      <td className="px-2 py-1 font-mono text-xs">{row.sku}</td>
                      <td className="px-2 py-1">{row.onHandQty ?? "—"}</td>
                      <td className="px-2 py-1">{row.leadTimeDays ?? line.leadTimeDays ?? "—"}</td>
                      <td className="px-2 py-1 text-xs">
                        {[row.outOfStock && "out of stock", row.backorder && "backorder", row.discontinued && "discontinued", row.conflictStatus === "conflict" && "conflict"].filter(Boolean).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 200 && <p className="text-xs text-muted-foreground">Showing 200 of {rows.length} SKUs.</p>}
          </section>
        );
      })}
    </div>
  );
}
