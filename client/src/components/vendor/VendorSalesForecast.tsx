import { trpc } from "@/lib/trpc";
import { materialsToCsv } from "@shared/salesForecast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePortalScopes } from "./usePortalScopes";

export function VendorSalesForecast(props: { distributorId?: number; approvedVendorLineId?: number }) {
  const portal = usePortalScopes(props);
  const query = trpc.salesForecast.vendorQuery.useQuery({
    distributorId: props.distributorId,
    approvedVendorLineId: props.approvedVendorLineId,
    page: 0,
    pageSize: 25,
  });

  if (portal.isLoading || query.isLoading) return <Spinner />;
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>;
  const data = query.data;
  if (!data) return <p className="text-sm text-muted-foreground">Forecast is unavailable.</p>;

  function download() {
    const csv = materialsToCsv(data!.materials);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vendor-sales-forecast.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Sales Forecast</h2>
          <p className="text-sm text-muted-foreground">
            Your products only, computed from saved designs when you open this page. Quantities include the age-based close rate. Customer names and other vendors&apos; items are not included. Estimated lines are marked.
          </p>
        </div>
        <Button variant="outline" onClick={download}>CSV</Button>
      </div>
      <p className="text-sm">{data.matched} designs include your products. Weighted quantities use the current close-rate brackets.</p>
      <p className="text-xs text-muted-foreground">Analytics still has the older saved-plan widget. This page is the forecast.</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-left">Description</th>
              <th className="px-2 py-1 text-left">Qty</th>
              <th className="px-2 py-1 text-left">Weighted</th>
              <th className="px-2 py-1 text-left">Designs</th>
              <th className="px-2 py-1 text-left">Your retail value</th>
            </tr>
          </thead>
          <tbody>
            {data.materials.map((row) => (
              <tr key={`${row.scope}:${row.sku}:${row.color}`} className="border-t">
                <td className="px-2 py-1 font-mono text-xs">{row.sku}{row.estimated ? " *" : ""}</td>
                <td className="px-2 py-1">{row.description}</td>
                <td className="px-2 py-1">{row.quantity}</td>
                <td className="px-2 py-1">{row.weightedQuantity}</td>
                <td className="px-2 py-1">{row.designCount}</td>
                <td className="px-2 py-1">{row.weightedRetailValue == null ? "—" : `$${row.weightedRetailValue.toFixed(2)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
