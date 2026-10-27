import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { usePortalScopes } from "./usePortalScopes";
import { fileToCsv } from "./spreadsheetFile";

export function VendorPricing(props: { distributorId?: number; approvedVendorLineId?: number }) {
  const portal = usePortalScopes(props);
  const scope = portal.scope;
  const list = trpc.vendorInventory.list.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ sku: string; wholesale: number; disposition: string; message?: string }[] | null>(null);
  const previewUpload = trpc.vendorInventory.previewWholesale.useMutation({
    onSuccess: (result) => setPreview(result.preview),
    onError: (error) => toast.error(error.message),
  });
  const setWholesale = trpc.vendorInventory.setWholesale.useMutation({
    onSuccess: (result) => {
      if (result.disposition === "queue") toast.success("Increase sent for admin approval. The live price is unchanged.");
      else if (result.disposition === "apply") toast.success("Wholesale price saved");
      else toast.success("Price unchanged");
      void list.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  if (portal.isLoading || list.isLoading) return <Spinner />;
  if (!scope || !list.data) return <p className="text-sm text-muted-foreground">Pricing is unavailable for this account.</p>;
  const multiplier = list.data.multiplierBps / 10000;
  const products = list.data.products.filter((row) => row.sku.toLowerCase().includes(search.toLowerCase()));

  async function applyPreview() {
    if (!preview || !scope || !list.data) return;
    const bySku = new Map(list.data.products.map((row) => [row.sku.trim().toUpperCase(), row]));
    for (const row of preview) {
      if (row.disposition === "unknown" || row.disposition === "blocked" || row.disposition === "noop") continue;
      const product = bySku.get(row.sku.trim().toUpperCase());
      if (!product) continue;
      await setWholesale.mutateAsync({ scope, table: product.table, id: product.id, wholesale: row.wholesale });
    }
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Pricing</h2>
        <p className="text-sm text-muted-foreground">
          Enter your wholesale price. Retail is wholesale × {multiplier.toFixed(2)} (the site-wide homeowner multiplier, {list.data.multiplierBps} bps).
          Effective {list.data.multiplierEffectiveAt ? new Date(list.data.multiplierEffectiveAt).toLocaleString() : "when pricing settings were last saved"}.
          {list.data.wholesaleIncreaseRequiresApproval
            ? " Increases wait for admin approval. Decreases and a first price apply now."
            : " Increases apply immediately under the current setting."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search SKU" value={search} onChange={(event) => setSearch(event.target.value)} />
        <input type="file" accept=".csv,.xlsx,.xls" className="text-sm" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            previewUpload.mutate({ scope, csv: await fileToCsv(file) });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not read that file");
          }
        }} />
      </div>
      {preview && (
        <div className="rounded-lg border p-3 text-sm">
          <p>{preview.filter((row) => row.disposition === "apply").length} apply now, {preview.filter((row) => row.disposition === "queue").length} need approval, {preview.filter((row) => row.disposition === "unknown").length} unknown SKUs.</p>
          <Button className="mt-2" size="sm" onClick={() => void applyPreview()}>Apply reviewed rows</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-left">Wholesale</th>
              <th className="px-2 py-1 text-left">Retail</th>
              <th className="px-2 py-1 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 150).map((row) => (
              <PriceRow key={`${row.table}:${row.id}`} row={row} locked={row.conflictStatus === "conflict"} onSave={(wholesale) => setWholesale.mutate({ scope, table: row.table, id: row.id, wholesale })} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceRow({
  row,
  locked,
  onSave,
}: {
  row: { sku: string; vendorWholesale: string | null; retail: number | null; conflictStatus: string | null };
  locked: boolean;
  onSave: (wholesale: number) => void;
}) {
  const [value, setValue] = useState(row.vendorWholesale ?? "");
  return (
    <tr className="border-t">
      <td className="px-2 py-1 font-mono text-xs">{row.sku}{locked ? " · conflict review" : ""}</td>
      <td className="px-2 py-1"><Input className="h-8 w-28" disabled={locked} value={value} onChange={(event) => setValue(event.target.value)} /></td>
      <td className="px-2 py-1">{row.retail == null ? "—" : `$${row.retail.toFixed(2)}`}</td>
      <td className="px-2 py-1"><Button size="sm" variant="outline" disabled={locked} onClick={() => onSave(Number(value))}>Save</Button></td>
    </tr>
  );
}
