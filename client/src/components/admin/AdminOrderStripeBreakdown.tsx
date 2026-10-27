import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_ORDER_NOT_AVAILABLE,
  ADMIN_ORDER_SHIPPING_NOT_RECORDED,
  buildAdminOrderBreakdown,
  describeAdminOrderList,
  formatOrderMoney,
  type AdminOrderBreakdown,
  type AdminOrderMoneyInput,
} from "@/lib/adminOrderReconciliation";

function moneyOrUnavailable(cents: number | null): string {
  return formatOrderMoney(cents);
}

function shippingAmountLabel(breakdown: AdminOrderBreakdown): string {
  const amount = formatOrderMoney(breakdown.shippingCents);
  if (!breakdown.shippingRecorded) return `${amount} · ${ADMIN_ORDER_SHIPPING_NOT_RECORDED}`;
  return breakdown.shippingCarrier ? `${amount} · ${breakdown.shippingCarrier}` : amount;
}

function ShippingWarning({ testId }: { testId: string }) {
  return (
    <p role="status" data-testid={testId} className="text-xs font-medium text-amber-800">
      Warning: shipping was not recorded. $0.00 is included so this total does not hide a missing freight charge.
    </p>
  );
}

export function StripeReconciliationStatus({ breakdown }: { breakdown: AdminOrderBreakdown }) {
  if (breakdown.reconciliation.status === "reconciled") {
    return (
      <Badge data-testid="admin-stripe-reconciled" className="border-transparent bg-green-600 text-white">
        Reconciled with Stripe
      </Badge>
    );
  }
  if (breakdown.reconciliation.status === "mismatch") {
    const difference = formatOrderMoney(Math.abs(breakdown.reconciliation.differenceCents));
    return (
      <p
        role="alert"
        data-testid="admin-stripe-mismatch"
        className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
      >
        Order total and the Stripe charge differ by {difference}.
      </p>
    );
  }
  return <span data-testid="admin-stripe-reconciliation-unavailable">{ADMIN_ORDER_NOT_AVAILABLE}</span>;
}

export function AdminOrderListIdentity({ order }: { order: AdminOrderMoneyInput }) {
  const identity = describeAdminOrderList(order);
  return (
    <div className="min-w-0 flex-1" data-testid="admin-order-list-identity">
      <p className="truncate text-sm font-medium" data-testid="admin-order-customer" title={identity.customerName ?? undefined}>
        {identity.customerName ?? ADMIN_ORDER_NOT_AVAILABLE}
      </p>
      <p
        className="truncate text-xs text-muted-foreground"
        data-testid="admin-order-ship-to"
        title={identity.shippingLocation ?? undefined}
      >
        {identity.shippingLocationDisplay ?? "Shipping location not recorded"}
      </p>
    </div>
  );
}

export function AdminOrderListTotal({ order }: { order: AdminOrderMoneyInput }) {
  const breakdown = buildAdminOrderBreakdown(order);
  const identity = describeAdminOrderList(order);
  return (
    <div className="shrink-0 text-right" data-testid="admin-order-list-money">
      <p className="text-xs" data-testid="admin-order-list-shipping">
        <span className="text-muted-foreground">Shipping </span>
        <span className={breakdown.shippingRecorded ? "font-medium" : "font-semibold text-amber-800"}>{shippingAmountLabel(breakdown)}</span>
      </p>
      {!breakdown.shippingRecorded && <ShippingWarning testId="admin-order-list-shipping-warning" />}
      <p className="text-sm font-semibold tabular-nums" data-testid="admin-order-list-total">
        <span className="mr-1 text-[11px] font-normal text-muted-foreground">Order total</span>
        {moneyOrUnavailable(breakdown.orderTotalCents)}
      </p>
      <div className="mt-1 flex justify-end">
        <StripeReconciliationStatus breakdown={breakdown} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground" data-testid="admin-order-list-receipt">{identity.receiptLabel}</p>
    </div>
  );
}

export default function AdminOrderStripeBreakdown({ order }: { order: AdminOrderMoneyInput }) {
  const breakdown = buildAdminOrderBreakdown(order);
  const identity = describeAdminOrderList(order);
  return (
    <section data-testid="admin-order-stripe-breakdown" aria-label="Order breakdown" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Order breakdown</h3>
        <p className="text-[11px] text-muted-foreground" data-testid="admin-order-detail-receipt">{identity.receiptLabel}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Customer price</TableHead>
              <TableHead className="text-right">
                <span className="block">Distributor cost</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-700">Admin only</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="block">Margin</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-700">Admin only</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.lines.map((line, index) => (
              <TableRow key={`${line.code ?? "line"}-${index}`}>
                <TableCell className="font-mono text-sm">{line.code ?? ADMIN_ORDER_NOT_AVAILABLE}</TableCell>
                <TableCell className="text-sm">{line.name ?? ADMIN_ORDER_NOT_AVAILABLE}</TableCell>
                <TableCell className="text-center font-mono">{line.qty ?? ADMIN_ORDER_NOT_AVAILABLE}</TableCell>
                <TableCell className="text-right font-mono text-sm">{moneyOrUnavailable(line.customerCents)}</TableCell>
                <TableCell className="text-right font-mono text-sm" data-testid="admin-order-distributor-cost">
                  {moneyOrUnavailable(line.distributorCostCents)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm" data-testid="admin-order-margin">
                  {moneyOrUnavailable(line.marginCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-amber-800">
        Admin only. Distributor cost is our true cost and is already included in the customer price. It is not an extra charge.
      </p>
      <dl className="space-y-1.5 rounded-lg border p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium tabular-nums">{moneyOrUnavailable(breakdown.subtotalCents)}</dd>
        </div>
        <div data-testid="admin-order-detail-shipping">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className={`font-medium tabular-nums ${breakdown.shippingRecorded ? "" : "text-amber-800"}`}>{shippingAmountLabel(breakdown)}</dd>
          </div>
          {!breakdown.shippingRecorded && <ShippingWarning testId="admin-order-detail-shipping-warning" />}
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Sales tax</dt>
          <dd className="font-medium tabular-nums">{moneyOrUnavailable(breakdown.taxCents)}</dd>
        </div>
        {breakdown.discountCents != null && (
          <div className="flex justify-between gap-3" data-testid="admin-order-discount">
            <dt className="text-muted-foreground">Discounts</dt>
            <dd className="font-medium tabular-nums">−{formatOrderMoney(breakdown.discountCents)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t pt-2">
          <dt className="font-semibold">Order total</dt>
          <dd className="font-semibold tabular-nums" data-testid="admin-order-total">{moneyOrUnavailable(breakdown.orderTotalCents)}</dd>
        </div>
      </dl>
      <div className="space-y-2 rounded-lg border border-dashed p-3 text-sm" data-testid="admin-order-stripe-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Stripe</h4>
          <StripeReconciliationStatus breakdown={breakdown} />
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Amount Stripe charged</span>
          <span className="font-medium tabular-nums" data-testid="admin-stripe-charge">{moneyOrUnavailable(breakdown.stripeChargeCents)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Stripe fee</span>
          <span className="font-medium tabular-nums" data-testid="admin-stripe-fee">{moneyOrUnavailable(breakdown.stripeFeeCents)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Net payout</span>
          <span className="font-medium tabular-nums" data-testid="admin-stripe-net">{moneyOrUnavailable(breakdown.stripeNetCents)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          The Stripe fee is deducted from the payout. It is not added to the customer total.
        </p>
      </div>
    </section>
  );
}
