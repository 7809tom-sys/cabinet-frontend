import type { ImageGenerationSummary } from "@/components/imageCustomer/imageGenerationTypes";

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ImageGenerationsReport({
  summary,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  summary: ImageGenerationSummary;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          From
          <input className="mt-1 block h-9 rounded-md border bg-background px-2" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} />
        </label>
        <label className="text-sm">
          To
          <input className="mt-1 block h-9 rounded-md border bg-background px-2" type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
        </label>
      </div>
      {!summary.schemaReady ? (
        <p className="text-sm text-muted-foreground">The image ledger is not installed yet. Apply SQL 0228 in TiDB, then refresh.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md border px-3 py-2">Internal images: {summary.internalCount}</span>
            <span className="rounded-md border px-3 py-2">Customers: {summary.customers.length}</span>
            <span className={`rounded-md border px-3 py-2 ${summary.unlinkedCount > 0 ? "border-destructive text-destructive" : ""}`}>
              Missing a customer: {summary.unlinkedCount}
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Kind</th>
                  <th className="p-2">Succeeded</th>
                  <th className="p-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {summary.customers.length === 0 ? (
                  <tr><td className="p-2 text-muted-foreground" colSpan={4}>No customer images in this range.</td></tr>
                ) : summary.customers.map((row) => (
                  <tr key={`${row.customerKind}:${row.customerId}`} className="border-t">
                    <td className="p-2">{row.name || row.email || `#${row.customerId}`}</td>
                    <td className="p-2">{row.customerKind === "crm" ? "CRM contact" : "Account"}</td>
                    <td className="p-2">{row.succeeded}</td>
                    <td className="p-2">{row.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.unlinked.length > 0 && (
            <div className="rounded-md border border-destructive p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">These customer-purpose images have no customer. Internal catalog work is counted separately and is not listed here.</p>
              <ul className="text-sm space-y-1">
                {summary.unlinked.map((row) => (
                  <li key={row.id}>#{row.id} {row.imageType} · {row.status} · {when(row.createdAt)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
