import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export type TrackedOrder = {
  id: number;
  requestNumber: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  styleName: string | null;
  createdAt: string | Date;
  timeline: Array<{ key: string; label: string; done: boolean; at: string | null; detail: string | null }>;
  lines: Array<{ description: string; code: string | null; qty: number; unitPrice: number | null; linePrice: number | null }>;
  invoice: {
    merchandise: number;
    tax: number | null;
    freight: number;
    total: number | null;
    qboInvoiceId: string | null;
  };
};

function when(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "Pending";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function OrderTrackingPanel({
  previewOrders = null,
  heading = "Your orders",
}: {
  previewOrders?: TrackedOrder[] | null;
  heading?: string;
}) {
  const query = trpc.orderTracking.list.useQuery(undefined, { enabled: previewOrders == null, retry: false });
  const orders = previewOrders ?? query.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{heading}</h2>
        <p className="text-sm text-muted-foreground mt-1">Placed, sent to the distributor, shipped, and delivered. Invoice totals stay with the order.</p>
      </div>
      {previewOrders == null && query.isLoading ? <p className="text-sm text-muted-foreground">Loading orders…</p> : null}
      {previewOrders == null && query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
      {!query.isLoading && orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{order.requestNumber || `Order ${order.id}`}</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.customerName || order.customerEmail || "Your order"}
                    {order.styleName ? ` · ${order.styleName}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">{order.status}</Badge>
              </div>
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {order.timeline.map((step) => (
                  <li key={step.key} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                        {step.done ? <Check className="h-3.5 w-3.5" /> : "·"}
                      </span>
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{when(step.at)}</p>
                    {step.detail ? <p className="mt-1 text-xs break-words">{step.detail}</p> : null}
                  </li>
                ))}
              </ol>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line, index) => (
                      <tr key={`${order.id}-${index}`} className="border-t border-border">
                        <td className="py-2 pr-3">
                          <div>{line.description}</div>
                          {line.code ? <div className="text-xs text-muted-foreground">{line.code}</div> : null}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{line.qty}</td>
                        <td className="py-2 text-right tabular-nums">{money(line.linePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Merchandise</dt><dd className="font-medium tabular-nums">{money(order.invoice.merchandise)}</dd></div>
                <div><dt className="text-muted-foreground">Freight</dt><dd className="font-medium tabular-nums">{money(order.invoice.freight)}</dd></div>
                <div><dt className="text-muted-foreground">Tax</dt><dd className="font-medium tabular-nums">{money(order.invoice.tax)}</dd></div>
                <div><dt className="text-muted-foreground">Invoice total</dt><dd className="font-semibold tabular-nums">{money(order.invoice.total)}</dd></div>
              </dl>
              {order.invoice.qboInvoiceId ? <p className="text-xs text-muted-foreground">Invoice {order.invoice.qboInvoiceId}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export const SAMPLE_TRACKED_ORDERS: TrackedOrder[] = [
  {
    id: 1042,
    requestNumber: "CD-1042",
    status: "confirmed",
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    styleName: "Shaker White",
    createdAt: "2026-10-01T12:00:00.000Z",
    timeline: [
      { key: "placed", label: "Placed", done: true, at: "2026-10-01T12:05:00.000Z", detail: null },
      { key: "sent_to_distributor", label: "Sent to distributor", done: true, at: "2026-10-02T15:00:00.000Z", detail: "orders@mill.com" },
      { key: "shipped", label: "Shipped", done: true, at: "2026-10-04T18:00:00.000Z", detail: "UPS · 1Z999" },
      { key: "delivered", label: "Delivered", done: false, at: null, detail: null },
    ],
    lines: [
      { description: "Base cabinet 36", code: "B36", qty: 2, unitPrice: 420, linePrice: 840 },
      { description: "Wall cabinet 30", code: "W3030", qty: 3, unitPrice: 260, linePrice: 780 },
    ],
    invoice: { merchandise: 1620, tax: 113.4, freight: 185, total: 1918.4, qboInvoiceId: "INV-1042" },
  },
];
