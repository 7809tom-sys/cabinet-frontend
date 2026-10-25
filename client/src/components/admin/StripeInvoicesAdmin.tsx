import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardCopy, ExternalLink, ReceiptText, RefreshCw } from "lucide-react";

export type StripeInvoiceStatus = "paid" | "refunded" | "partially_refunded" | "failed" | "pending";
export type ReceiptDelivery = "live_receipt_email" | "test_mode_not_emailed" | "not_requested";
export type InvoiceDelivery = "invoice_email_sent" | "invoice_created" | "test_mode_not_emailed" | "not_created";

export interface StripeInvoiceRow {
  id: number;
  livemode: boolean;
  stripeMode: "live" | "test";
  amountCents: number;
  amountRefundedCents: number;
  currency: string;
  status: StripeInvoiceStatus;
  occurredAt: Date | string;
  customerName: string | null;
  customerEmail: string | null;
  purpose: "order" | "affiliate_membership" | "other";
  description: string | null;
  lineItems: Array<{ description: string; quantity: number; amountCents: number }>;
  orderNumber: string | null;
  affiliateId: number | null;
  affiliateStoreName: string | null;
  affiliateInvoiceId: number | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  invoiceId: string | null;
  receiptEmail: string | null;
  receiptUrl: string | null;
  receiptEmailSent: boolean;
  receiptDelivery: ReceiptDelivery;
  invoiceEmailSent: boolean;
  invoiceDelivery: InvoiceDelivery;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  stripeDashboardUrl: string | null;
}

export interface StripeInvoiceSummary {
  total: number;
  paid: number;
  refunded: number;
  failed: number;
  receiptsSent: number;
  receiptsMissing: number;
}

export interface StripeInvoiceFilters {
  search: string;
  affiliateId: string;
  status: "all" | StripeInvoiceStatus;
  mode: "all" | "live" | "test";
  from: string;
  to: string;
}

interface AffiliateOption {
  id: number;
  storeName: string;
}

const emptySummary: StripeInvoiceSummary = {
  total: 0,
  paid: 0,
  refunded: 0,
  failed: 0,
  receiptsSent: 0,
  receiptsMissing: 0,
};

function money(cents: number, currency = "usd") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function when(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: StripeInvoiceStatus) {
  if (status === "partially_refunded") return "Partially refunded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function purposeLabel(row: StripeInvoiceRow) {
  if (row.purpose === "affiliate_membership") return "Affiliate membership";
  if (row.purpose === "order") return row.orderNumber ? `Order ${row.orderNumber}` : "Customer order";
  return "Other Stripe charge";
}

function receiptLabel(delivery: ReceiptDelivery) {
  if (delivery === "live_receipt_email") return "Receipt email sent";
  if (delivery === "test_mode_not_emailed") return "Not emailed — Stripe test mode";
  return "No receipt email on the charge";
}

function invoiceLabel(delivery: InvoiceDelivery) {
  if (delivery === "invoice_email_sent") return "Invoice email sent";
  if (delivery === "invoice_created") return "Invoice created, email not confirmed";
  if (delivery === "test_mode_not_emailed") return "Invoice not emailed — test mode";
  return "No Stripe invoice";
}

function primaryStripeId(row: StripeInvoiceRow) {
  return row.chargeId || row.paymentIntentId || row.invoiceId || row.checkoutSessionId || "—";
}

async function copyLink(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
  }
}

function LinkActions({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="text-xs text-muted-foreground">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
        <a href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-1 h-3 w-3" /> {label}
        </a>
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyLink(href)} aria-label={`Copy ${label} link`}>
        <ClipboardCopy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function StripeInvoicesView({
  embedded = false,
  rows,
  summary,
  affiliates,
  filters,
  onChange,
  onSync,
  syncing = false,
  loading = false,
  error = null,
  lockAffiliate = false,
}: {
  embedded?: boolean;
  rows: StripeInvoiceRow[];
  summary: StripeInvoiceSummary;
  affiliates: AffiliateOption[];
  filters: StripeInvoiceFilters;
  onChange: (next: StripeInvoiceFilters) => void;
  onSync?: () => void;
  syncing?: boolean;
  loading?: boolean;
  error?: string | null;
  lockAffiliate?: boolean;
}) {
  return (
    <div className="space-y-4" data-embedded={embedded ? "true" : "false"}>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ReceiptText className="h-5 w-5" /> Stripe invoices
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Every Stripe charge recorded for Cabinet Dealz, including orders placed through an affiliate and
              affiliate membership payments. Receipt email is sent by Stripe only in live mode when the charge has a
              receipt address. Test-mode charges are listed here but Stripe does not email them.
            </CardDescription>
          </div>
          {onSync && (
            <Button type="button" variant="outline" onClick={onSync} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Stripe"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Payments" value={String(summary.total)} />
            <Summary label="Paid" value={String(summary.paid)} />
            <Summary label="Receipts emailed" value={String(summary.receiptsSent)} />
            <Summary label="Receipts missing" value={String(summary.receiptsMissing)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Input
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Search name, email, order, Stripe id"
              aria-label="Search Stripe payments"
              className="xl:col-span-2"
            />
            {!lockAffiliate && (
              <Select value={filters.affiliateId} onValueChange={(affiliateId) => onChange({ ...filters, affiliateId })}>
                <SelectTrigger aria-label="Filter by affiliate">
                  <SelectValue placeholder="All affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All affiliates</SelectItem>
                  <SelectItem value="none">No affiliate</SelectItem>
                  {affiliates.map((affiliate) => (
                    <SelectItem key={affiliate.id} value={String(affiliate.id)}>
                      {affiliate.storeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filters.status} onValueChange={(status) => onChange({ ...filters, status: status as StripeInvoiceFilters["status"] })}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="partially_refunded">Partially refunded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.mode} onValueChange={(mode) => onChange({ ...filters, mode: mode as StripeInvoiceFilters["mode"] })}>
              <SelectTrigger aria-label="Filter by Stripe mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Live and test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filters.from} aria-label="From date" onChange={(event) => onChange({ ...filters, from: event.target.value })} />
            <Input type="date" value={filters.to} aria-label="To date" onChange={(event) => onChange({ ...filters, to: event.target.value })} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No Stripe payments match these filters. Use Sync from Stripe to pull historical charges, including ones the webhook missed.
          </CardContent>
        </Card>
      ) : (
        <Card className={embedded ? undefined : undefined}>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>What it was for</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead>Receipt / invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">{when(row.occurredAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-semibold">{money(row.amountCents, row.currency)}</div>
                      <div className="text-xs uppercase text-muted-foreground">{row.currency}</div>
                      {row.amountRefundedCents > 0 && (
                        <div className="text-xs text-muted-foreground">Refunded {money(row.amountRefundedCents, row.currency)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "failed" ? "destructive" : row.status === "paid" ? "default" : "outline"} className="capitalize">
                        {statusLabel(row.status)}
                      </Badge>
                      <div className="mt-1">
                        <Badge variant="outline">{row.stripeMode === "live" ? "Live" : "Test"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.customerName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.customerEmail || "No email"}</div>
                    </TableCell>
                    <TableCell>
                      {row.affiliateStoreName || (row.affiliateId ? `Affiliate #${row.affiliateId}` : "House / none")}
                      {row.affiliateInvoiceId ? (
                        <div className="text-xs text-muted-foreground">Membership invoice #{row.affiliateInvoiceId}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="font-medium">{purposeLabel(row)}</div>
                      {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
                      {row.lineItems.slice(0, 3).map((item, index) => (
                        <div key={`${row.id}-line-${index}`} className="text-xs text-muted-foreground">
                          {item.quantity} × {item.description}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      <div className="break-all font-mono text-xs">{primaryStripeId(row)}</div>
                      <div className="mt-1">
                        <LinkActions href={row.stripeDashboardUrl} label="Dashboard" />
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[14rem]">
                      <div className="text-xs font-medium">{receiptLabel(row.receiptDelivery)}</div>
                      <div className="text-xs text-muted-foreground">
                        receipt_email: {row.receiptEmail || "not set"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{invoiceLabel(row.invoiceDelivery)}</div>
                      <div className="mt-2 space-y-1">
                        <LinkActions href={row.receiptUrl} label="Receipt" />
                        <LinkActions href={row.hostedInvoiceUrl || row.invoicePdfUrl} label="Invoice" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

type ListInput = {
  search?: string;
  affiliateId?: number;
  unassignedOnly?: boolean;
  status?: StripeInvoiceFilters["status"];
  mode?: StripeInvoiceFilters["mode"];
  from?: string;
  to?: string;
  limit?: number;
};

type SyncResult = {
  accounts: Array<{ mode: "live" | "test"; charges: number; created: number; upserted: number; truncated: boolean }>;
};

function useStripeInvoiceApi() {
  return trpc as unknown as {
    stripeInvoices: {
      adminList: {
        useQuery: (input: ListInput) => {
          data?: { rows: StripeInvoiceRow[]; summary: StripeInvoiceSummary };
          isLoading: boolean;
          isError: boolean;
          error: { message: string } | null;
        };
      };
      syncFromStripe: {
        useMutation: (options: {
          onSuccess?: (result: SyncResult) => void;
          onError?: (error: { message: string }) => void;
        }) => { mutate: () => void; isPending: boolean };
      };
    };
    useUtils: () => { stripeInvoices: { adminList: { invalidate: () => Promise<void> } } };
    affiliates: { adminList: { useQuery: () => { data?: AffiliateOption[] } } };
  };
}

export default function StripeInvoicesAdmin({
  embedded = false,
  affiliateId,
  lockAffiliate = false,
}: {
  embedded?: boolean;
  affiliateId?: number;
  lockAffiliate?: boolean;
}) {
  const api = useStripeInvoiceApi();
  const utils = api.useUtils();
  const { data: affiliateList } = api.affiliates.adminList.useQuery();
  const [filters, setFilters] = useState<StripeInvoiceFilters>({
    search: "",
    affiliateId: affiliateId ? String(affiliateId) : "all",
    status: "all",
    mode: "all",
    from: "",
    to: "",
  });
  const activeAffiliate = lockAffiliate ? (affiliateId ? String(affiliateId) : "all") : filters.affiliateId;
  const queryInput = useMemo<ListInput>(() => {
    const input: ListInput = { limit: 200, status: filters.status, mode: filters.mode };
    if (filters.search.trim()) input.search = filters.search.trim();
    if (activeAffiliate === "none") input.unassignedOnly = true;
    else if (activeAffiliate !== "all") input.affiliateId = Number(activeAffiliate);
    if (filters.from) input.from = filters.from;
    if (filters.to) input.to = filters.to;
    return input;
  }, [activeAffiliate, filters]);
  const list = api.stripeInvoices.adminList.useQuery(queryInput);
  const sync = api.stripeInvoices.syncFromStripe.useMutation({
    onSuccess: async (result) => {
      const created = result.accounts.reduce((sum, account) => sum + account.created, 0);
      const modes = result.accounts.map((account) => account.mode).join(" and ") || "Stripe";
      toast.success(`Synced ${modes} payments`, { description: `${created} new payment record${created === 1 ? "" : "s"}.` });
      await utils.stripeInvoices.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <StripeInvoicesView
      embedded={embedded}
      rows={list.data?.rows ?? []}
      summary={list.data?.summary ?? emptySummary}
      affiliates={(affiliateList ?? []).map((affiliate) => ({ id: affiliate.id, storeName: affiliate.storeName }))}
      filters={{ ...filters, affiliateId: activeAffiliate }}
      onChange={setFilters}
      onSync={() => sync.mutate()}
      syncing={sync.isPending}
      loading={list.isLoading}
      error={list.isError ? list.error?.message ?? "Stripe payments could not be loaded." : null}
      lockAffiliate={lockAffiliate}
    />
  );
}
