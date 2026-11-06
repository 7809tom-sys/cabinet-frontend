import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import {
  DEFAULT_MASTER_ORDER_SORT,
  DIRECT_ONLY_AFFILIATE,
  MASTER_ORDERS_PAGE_SIZE,
  ORDER_STATUS_BUCKETS,
  ORDER_STATUS_BUCKET_LABELS,
  buildOrderStatusRow,
  countOrderStatuses,
  filterOrderStatusRows,
  isOrderStuck,
  nextMasterOrderSort,
  orderStatusAffiliates,
  orderStatusAgeDays,
  orderStatusBucket,
  orderStatusDistributors,
  orderStatusStepCaption,
  paginateMasterOrders,
  sortMasterOrders,
  type MasterOrderSortKey,
  type OrderStatusBucket,
  type OrderStatusRow,
  type OrderStatusSource,
  type OrderStatusStep,
} from "@/lib/orderStatusReport";
import { downloadMasterOrdersCsv } from "@/lib/masterOrdersCsv";
import { formatCentralDate } from "@/lib/orderStatusActor";
import type { AdminOrderRow } from "@/lib/adminOrderRow";

const ALL = "__all__";

/** One dot in the chain: green with who/when when done, gray while waiting. */
function StatusDot({ step }: { step: OrderStatusStep }) {
  const caption = orderStatusStepCaption(step);
  const sub = step.done
    ? [caption.replace(`${step.label} `, ""), step.detail].filter(Boolean).join(" · ")
    : "Waiting";
  return (
    <li
      className="flex min-w-0 items-start gap-1"
      data-testid={`status-dot-${step.key}`}
      data-done={step.done ? "true" : "false"}
      title={caption}
    >
      <span
        aria-hidden
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${step.done ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
      />
      <span className="min-w-0">
        <span className={`block truncate text-[11px] font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
          {step.label}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground" data-testid={`status-dot-sub-${step.key}`}>{sub}</span>
      </span>
    </li>
  );
}

function money(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = Math.floor(Math.abs(cents) / 100).toLocaleString("en-US");
  return `${cents < 0 ? "-" : ""}$${dollars}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}

const PAYMENT_STYLES: Record<string, string> = {
  paid: "border-emerald-300 text-emerald-700",
  unpaid: "border-amber-300 text-amber-700",
  refunded: "border-red-300 text-red-700",
};

type Column = {
  key: MasterOrderSortKey | null;
  label: string;
  align?: "right";
  className?: string;
};

/** The column order asked for: Order #, Date, Affiliate, Customer, Dealer, Distributor, Total, Cost, Margin, Payment, Status. */
const COLUMNS: Column[] = [
  { key: "orderNumber", label: "Order #" },
  { key: "createdAt", label: "Date" },
  { key: "affiliate", label: "Affiliate" },
  { key: "customer", label: "Customer" },
  { key: "dealer", label: "Dealer" },
  { key: "distributor", label: "Distributor" },
  { key: "totalCents", label: "Total", align: "right" },
  { key: "distributorCostCents", label: "Cost", align: "right" },
  { key: "marginCents", label: "Margin", align: "right" },
  { key: "paymentStatus", label: "Payment" },
  { key: "status", label: "Status", className: "min-w-[30rem]" },
];

/** A sortable header button; the two admin-only money columns say so. */
function SortableHead({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: { key: MasterOrderSortKey; direction: "asc" | "desc" };
  onSort: (key: MasterOrderSortKey) => void;
}) {
  if (!column.key) return <TableHead>{column.label}</TableHead>;
  const active = sort.key === column.key;
  return (
    <TableHead className={column.align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column.key!)}
        data-testid={`master-orders-sort-${column.key}`}
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "font-semibold text-foreground" : "text-muted-foreground"} ${
          column.align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {column.label}
        {active && (sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}

/**
 * Admin → Sales & Orders → Master Orders.
 *
 * Every order on the system — every affiliate, dealer and distributor — in one
 * table with its money, payment state and status chain. The endpoint is the
 * admin-only list, so the restriction is enforced on the server; this component
 * is only reachable inside the admin panel.
 */
export default function MasterOrders() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.orders.adminListWithPoSkus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const [bucket, setBucket] = useState<OrderStatusBucket | "all">("all");
  const [distributor, setDistributor] = useState<string>(ALL);
  const [affiliate, setAffiliate] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stuck, setStuck] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(DEFAULT_MASTER_ORDER_SORT);
  const [page, setPage] = useState(1);

  const rows = useMemo<OrderStatusRow[]>(
    () => ((data ?? []) as AdminOrderRow[]).map((order) => buildOrderStatusRow(order as unknown as OrderStatusSource)),
    [data],
  );

  const counts = useMemo(() => countOrderStatuses(rows), [rows]);
  const distributors = useMemo(() => orderStatusDistributors(rows), [rows]);
  const affiliates = useMemo(() => orderStatusAffiliates(rows), [rows]);
  const stuckDays = Number(stuck) || 0;

  // The tiles count the whole board; only the table is filtered, so a tile keeps
  // telling you how much work is left after you click into it.
  const filtered = useMemo(
    () => filterOrderStatusRows(rows, {
      distributor: distributor === ALL ? "" : distributor,
      affiliate: affiliate === ALL ? "" : affiliate,
      from,
      to,
      status: bucket,
      stuckDays,
      search,
    }),
    [rows, distributor, affiliate, from, to, bucket, stuckDays, search],
  );

  const sorted = useMemo(() => sortMasterOrders(filtered, sort), [filtered, sort]);
  const paged = useMemo(() => paginateMasterOrders(sorted, page, MASTER_ORDERS_PAGE_SIZE), [sorted, page]);

  // Changing what is shown must not leave you on page 4 of 1.
  useEffect(() => { setPage(1); }, [bucket, distributor, affiliate, from, to, stuck, search]);

  const openOrder = (id: number) => navigate(`/admin/orders/${id}?tab=master-orders`);
  const hasFilters = bucket !== "all" || distributor !== ALL || affiliate !== ALL || Boolean(from) || Boolean(to) || Boolean(stuck) || Boolean(search);

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner className="h-7 w-7 text-primary" /></div>;
  }
  if (error) {
    return (
      <Card className="p-6" data-testid="master-orders-error">
        <p className="text-sm text-destructive">The order list could not be loaded: {error.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="master-orders">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Master Orders</h2>
          <p className="text-sm text-muted-foreground">
            Every order across all affiliates, dealers and distributors. Times are Central. Cost and margin are admin-only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground" data-testid="master-orders-total">{rows.length} orders</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadMasterOrdersCsv(sorted)}
            disabled={sorted.length === 0}
            data-testid="master-orders-export"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Count tiles. Click to filter; click the active tile to clear. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER_STATUS_BUCKETS.map((key) => {
          const active = bucket === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setBucket(active ? "all" : key)}
              aria-pressed={active}
              data-testid={`master-orders-tile-${key}`}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/50"
              }`}
            >
              <span className="block text-xs font-medium text-muted-foreground">{ORDER_STATUS_BUCKET_LABELS[key]}</span>
              <span className={`mt-1 block text-2xl font-semibold tabular-nums ${active ? "text-primary" : ""}`}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-7">
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="master-search" className="text-xs">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="master-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order #, customer, affiliate, dealer"
              className="pl-8"
              data-testid="master-orders-search"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="master-affiliate" className="text-xs">Affiliate</Label>
          <Select value={affiliate} onValueChange={setAffiliate}>
            <SelectTrigger id="master-affiliate" data-testid="master-orders-affiliate">
              <SelectValue placeholder="All affiliates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All affiliates</SelectItem>
              {affiliates.map((name) => (
                <SelectItem key={name} value={name}>
                  {name === DIRECT_ONLY_AFFILIATE ? "Direct (no affiliate)" : name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="master-distributor" className="text-xs">Distributor</Label>
          <Select value={distributor} onValueChange={setDistributor}>
            <SelectTrigger id="master-distributor" data-testid="master-orders-distributor">
              <SelectValue placeholder="All distributors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All distributors</SelectItem>
              {distributors.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="master-from" className="text-xs">Ordered from</Label>
          <Input id="master-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} data-testid="master-orders-from" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="master-to" className="text-xs">Ordered to</Label>
          <Input id="master-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} data-testid="master-orders-to" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="master-stuck" className="text-xs">Stuck (days)</Label>
          <Input
            id="master-stuck"
            type="number"
            min={0}
            inputMode="numeric"
            value={stuck}
            onChange={(event) => setStuck(event.target.value)}
            placeholder="Any"
            data-testid="master-orders-stuck"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {bucket !== "all" && (
          <Badge variant="secondary" data-testid="master-orders-active-bucket">{ORDER_STATUS_BUCKET_LABELS[bucket]}</Badge>
        )}
        {stuckDays > 0 && <Badge variant="outline" data-testid="master-orders-active-stuck">No step in {stuckDays}+ days</Badge>}
        <span className="text-muted-foreground" data-testid="master-orders-visible-count">
          {paged.total === 0 ? "No orders" : `${paged.from}–${paged.to} of ${paged.total}`}
        </span>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setBucket("all"); setDistributor(ALL); setAffiliate(ALL); setFrom(""); setTo(""); setStuck(""); setSearch(""); }}
            data-testid="master-orders-clear"
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {COLUMNS.map((column) => (
                <SortableHead key={column.label} column={column} sort={sort} onSort={(key) => setSort(nextMasterOrderSort(sort, key))} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => openOrder(row.id)}
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === "Enter") openOrder(row.id); }}
                data-testid={`master-orders-row-${row.id}`}
              >
                <TableCell className="font-mono text-sm font-medium">
                  {row.orderNumber}
                  {stuckDays > 0 && isOrderStuck(row, stuckDays) && (
                    <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700" data-testid={`master-orders-stuck-${row.id}`}>
                      {orderStatusAgeDays(row)}d
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm" data-testid={`master-orders-date-${row.id}`}>
                  {formatCentralDate(row.createdAt) ?? "—"}
                </TableCell>
                <TableCell className="text-sm" data-testid={`master-orders-affiliate-cell-${row.id}`}>
                  {row.affiliate ? (
                    <span title={row.affiliate}>
                      <span className="block">{row.affiliateName ?? "—"}</span>
                      {row.affiliateSite && <span className="block text-[11px] text-muted-foreground">{row.affiliateSite}</span>}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-sm">{row.customer ?? "—"}</TableCell>
                <TableCell className="text-sm" data-testid={`master-orders-dealer-${row.id}`}>{row.dealer ?? "—"}</TableCell>
                <TableCell className="text-sm">{row.distributor ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm" data-testid={`master-orders-total-${row.id}`}>{money(row.totalCents)}</TableCell>
                <TableCell className="text-right font-mono text-sm" data-testid={`master-orders-cost-${row.id}`}>{money(row.distributorCostCents)}</TableCell>
                <TableCell className="text-right font-mono text-sm" data-testid={`master-orders-margin-${row.id}`}>{money(row.marginCents)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={PAYMENT_STYLES[row.paymentStatus] ?? ""} data-testid={`master-orders-payment-${row.id}`}>
                    {row.paymentStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ol className="flex flex-wrap gap-x-3 gap-y-1">
                    {row.steps.map((step) => <StatusDot key={step.key} step={step} />)}
                  </ol>
                </TableCell>
              </TableRow>
            ))}
            {paged.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-sm text-muted-foreground" data-testid="master-orders-empty">
                  No orders match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paging */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-testid="master-orders-page-label">
          Page {paged.page} of {paged.pageCount} · {MASTER_ORDERS_PAGE_SIZE} per page
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={paged.page <= 1}
            data-testid="master-orders-prev"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(paged.pageCount, current + 1))}
            disabled={paged.page >= paged.pageCount}
            data-testid="master-orders-next"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        A green dot means the step is done and shows when and by whom. "Stuck" counts orders with no new step for that many days since
        their last one; signed orders are never counted as stuck. Rows fall into one tile each:
        {" "}{ORDER_STATUS_BUCKETS.map((key) => `${counts[key]} ${ORDER_STATUS_BUCKET_LABELS[key].toLowerCase()}`).join(", ")}.
        An order with no affiliate source shows "—" rather than a guess.
      </p>
    </div>
  );
}

/** Exported for row-level bucket checks in tests and callers. */
export function bucketOf(row: OrderStatusRow): OrderStatusBucket {
  return orderStatusBucket(row);
}
