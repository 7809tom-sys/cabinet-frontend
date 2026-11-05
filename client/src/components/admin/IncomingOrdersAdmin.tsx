import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Package, Trash2, ExternalLink, BookOpen, Download } from "lucide-react";
import AdminOrderStripeBreakdown, { AdminOrderListIdentity, AdminOrderListTotal } from "@/components/admin/AdminOrderStripeBreakdown";
import OrderFulfillmentTrail from "@/components/admin/OrderFulfillmentTrail";
import {
  ADMIN_ORDER_STATUS_COLORS,
  adminOrderShipment,
  adminOrderVerified,
  type AdminOrderLine,
  type AdminOrderRow,
  type AdminOrderStatus,
} from "@/lib/adminOrderRow";

type Status = AdminOrderStatus;
type EnrichedLine = AdminOrderLine;
type OrderRow = AdminOrderRow;

const STATUS_COLORS = ADMIN_ORDER_STATUS_COLORS;

function copyPoSkus(lines: EnrichedLine[]) {
  const text = lines
    .filter((l) => l.poSku)
    .map((l) => `${l.qty}x  ${l.poSku}  — ${l.description}`)
    .join("\n");
  navigator.clipboard.writeText(text).then(() => toast.success("PO SKUs copied to clipboard"));
}

export default function IncomingOrdersAdmin() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [qboOpen, setQboOpen] = useState(false);
  const [qboFromDate, setQboFromDate] = useState("");
  const [qboToDate, setQboToDate] = useState("");
  const [qboStatus, setQboStatus] = useState<string>("all");
  const [qboFetch, setQboFetch] = useState(false);

  const { data: qboData, isFetching: qboFetching } = trpc.orders.exportQBO.useQuery(
    {
      fromDate: qboFromDate || undefined,
      toDate: qboToDate || undefined,
      status: qboStatus !== "all" ? (qboStatus as Status) : undefined,
    },
    { enabled: qboFetch }
  );

  useEffect(() => {
    if (!qboFetch || qboFetching || !qboData) return;
    if (!qboData.csv) {
      toast.error("No orders found for the selected filters.");
      setQboFetch(false);
      return;
    }
    const blob = new Blob([qboData.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = qboData.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${qboData.count} order${qboData.count === 1 ? "" : "s"} to ${qboData.filename}`);
    setQboFetch(false);
    setQboOpen(false);
  }, [qboFetch, qboFetching, qboData]);

  const handleQboExport = () => setQboFetch(true);

  const { data: orders, isLoading, error, refetch } = trpc.orders.adminListWithPoSkus.useQuery(
    statusFilter !== "all" ? { status: statusFilter as Status } : undefined,
    { refetchInterval: 20000, refetchOnWindowFocus: true },
  );
  const utils = trpc.useUtils();
  const backfill = trpc.orders.backfillCrmSales.useMutation({
    onSuccess: (result) => {
      const preview = result.preview;
      const summary = `${preview.moveToNewSale} to move to New Sale, ${preview.createNewSale} New Sale to create, ${preview.createQualified} qualified to create`;
      if (result.dryRun) toast.message(`CRM backfill preview: ${summary}. Nothing was changed.`);
      else {
        toast.success(`CRM backfill applied: ${summary}.`);
        utils.orders.adminListWithPoSkus.invalidate();
      }
    },
    onError: (e) => toast.error(e.message || "CRM backfill failed"),
  });

  const deleteOrder = trpc.orders.adminDelete.useMutation({
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deleted} order${res.deleted === 1 ? "" : "s"}`);
      utils.orders.adminListWithPoSkus.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not delete order"),
  });
  const deleteAllOrders = trpc.orders.adminDeleteAll.useMutation({
    onSuccess: (res) => {
      toast.success(`Cleared ${res.deleted} order${res.deleted === 1 ? "" : "s"}`);
      utils.orders.adminListWithPoSkus.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not clear orders"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Failed to load orders.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const rows = (orders ?? []) as OrderRow[];
  const visibleRows = rows.filter((order) => kindFilter === "all" || (order.orderKind ?? "standard") === kindFilter);

  // The order itself opens on its own page. The list tab is remembered in the
  // URL so Back from the order returns to this exact tab.
  const openOrder = (id: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "orders");
    navigate(`/admin/orders/${id}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Incoming Orders</h2>
          <p className="text-sm text-muted-foreground">
            Each line item shows the PO SKU in{" "}
            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              distributor-style-partno
            </span>{" "}
            format (e.g. <span className="font-mono text-xs text-primary">usd-sw-3db24</span>).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* QuickBooks CSV Export */}
          <Popover open={qboOpen} onOpenChange={setQboOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950">
                <BookOpen className="h-3.5 w-3.5" />
                Export to QuickBooks
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-green-600" />
                    QuickBooks CSV Export
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Downloads a Sales Receipt CSV ready for import into QuickBooks Online or Desktop.
                  </p>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">From Date (optional)</Label>
                    <Input type="date" value={qboFromDate} onChange={(e) => setQboFromDate(e.target.value)} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">To Date (optional)</Label>
                    <Input type="date" value={qboToDate} onChange={(e) => setQboToDate(e.target.value)} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Status Filter</Label>
                    <Select value={qboStatus} onValueChange={setQboStatus}>
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full gap-2 bg-green-700 hover:bg-green-800 text-white"
                  size="sm"
                  onClick={handleQboExport}
                  disabled={qboFetching}
                >
                  {qboFetching ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {qboFetching ? "Generating..." : "Download CSV"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  In QuickBooks: go to <strong>Import Data</strong> → <strong>Sales Receipts</strong> and upload the downloaded file.
                </p>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate({ apply: false })}
          >
            Preview CRM backfill
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate({ apply: true })}
          >
            Apply CRM backfill
          </Button>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="sample">Sample orders</SelectItem>
              <SelectItem value="standard">Standard orders</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  {statusFilter === "all" ? "Clear all" : `Clear ${statusFilter}`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {statusFilter === "all" ? "all orders" : `all \u201c${statusFilter}\u201d orders`}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes {rows.length} order{rows.length === 1 ? "" : "s"} and cannot be undone.
                    Use this to clear out test orders.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      deleteAllOrders.mutate(
                        statusFilter === "all" ? undefined : { status: statusFilter as Status }
                      )
                    }
                  >
                    Delete {rows.length}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No orders found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((order) => {
            const isExpanded = expandedId === order.id;
            const verified = adminOrderVerified(order);
            const shipment = adminOrderShipment(order);
            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Order summary row */}
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    <div className="flex w-full min-w-0 items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <CardTitle className="shrink-0 text-sm font-mono font-semibold">
                        {order.requestNumber}
                        {order.orderKind === "sample" && <Badge variant="secondary" className="ml-2">Sample</Badge>}
                      </CardTitle>
                      <AdminOrderListIdentity order={order} />
                      {(order.imageGeneratedCount ?? 0) > 0 && (
                        <Badge variant="outline" className="text-xs" data-testid="order-list-image-generated">
                          Image generated · {order.imageGeneratedCount}
                          {order.lastImageGeneratedAt ? ` · ${new Date(order.lastImageGeneratedAt).toLocaleString()}` : ""}
                        </Badge>
                      )}
                      <AdminOrderListTotal order={order} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrder(order.id);
                        }}
                      >
                        View
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete order ${order.requestNumber}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete order {order.requestNumber}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the order and all of its line items. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteOrder.mutate({ ids: [order.id] })}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {/* Status / fulfillment columns. These were always in the data;
                        they now carry their own labels instead of relying on the
                        single flex line that used to clip them out of view. */}
                    <div
                      className="grid w-full min-w-0 gap-x-4 gap-y-1 pl-7 text-xs sm:grid-cols-2 lg:grid-cols-4"
                      data-testid={`order-list-status-row-${order.id}`}
                    >
                      <div className="min-w-0" data-testid="order-list-status">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                        <Badge className={`mt-0.5 text-xs ${STATUS_COLORS[order.status]}`}>{order.status}</Badge>
                        {order.orderRailStatus && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={order.orderRailStatus}>
                            {order.orderRailStatus.replaceAll("_", " ")}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0" data-testid="order-list-progress">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Verified / Paid</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={verified ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}
                            data-testid="order-list-verified"
                          >
                            {verified ? "Verified" : "Not verified"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={order.paidAt ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}
                            data-testid="order-list-paid"
                          >
                            {order.paidAt ? "Paid" : "Not paid"}
                          </Badge>
                        </div>
                      </div>
                      <div className="min-w-0" data-testid="order-list-shipment">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shipped · carrier / tracking</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={shipment.shipped ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}
                            data-testid="order-list-shipped"
                          >
                            {shipment.shipped ? "Shipped" : "Not shipped"}
                          </Badge>
                          <span className="text-muted-foreground" data-testid="order-list-carrier">
                            {shipment.carrier ?? "No carrier"}
                          </span>
                          {shipment.tracking ? (
                            shipment.trackingUrl ? (
                              <a
                                href={shipment.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                                data-testid="order-list-tracking"
                                title={shipment.tracking}
                              >
                                {shipment.tracking}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : (
                              <span className="truncate font-mono" data-testid="order-list-tracking" title={shipment.tracking}>
                                {shipment.tracking}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground" data-testid="order-list-tracking">No tracking</span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0" data-testid="order-list-ordered">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ordered</p>
                        <p className="mt-0.5 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded line items */}
                {isExpanded && (
                  <CardContent className="pt-0 pb-3 px-4 space-y-3">
                    <OrderFulfillmentTrail order={order} />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} ·{" "}
                        {order.styleName || "No style"} · {order.tier}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => copyPoSkus(order.lineItems)}
                      >
                        <Copy className="h-3 w-3" />
                        Copy PO SKUs
                      </Button>
                    </div>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-10 text-center text-xs">Qty</TableHead>
                            <TableHead className="text-xs">PO SKU</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-right text-xs">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.lineItems.map((l, i) => (
                            <TableRow key={i} className={!l.matched ? "opacity-60" : ""}>
                              <TableCell className="text-center font-mono text-sm font-bold py-2">
                                {l.qty}
                              </TableCell>
                              <TableCell className="py-2">
                                {l.poSku ? (
                                  <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {l.poSku}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-muted-foreground italic">
                                    {l.masterCode || "—"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-2">{l.description}</TableCell>
                              <TableCell className="text-right font-mono text-xs py-2">
                                {l.linePrice != null ? `$${l.linePrice.toFixed(2)}` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-3">
                      <AdminOrderStripeBreakdown order={order} />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
