import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ChevronDown, ChevronRight, Copy, Package, Trash2, Send, Building2, Palette, CheckCircle2, Truck, MapPin, Download, BookOpen } from "lucide-react";

type Status = "draft" | "submitted" | "confirmed" | "cancelled";

type EnrichedLine = {
  cabinetId: number | null;
  masterCode: string;
  rawCode?: string;
  description: string;
  qty: number;
  unitPrice: number | null;
  linePrice: number | null;
  doorStyle?: string | null;
  styleId?: number | null;
  tier?: string | null;
  matched: boolean;
  poSku: string | null;
  distributorName?: string | null;
  colorFinish?: string | null;
};

type OrderRow = {
  id: number;
  requestNumber: string;
  originatorName: string | null;
  originatorEmail: string | null;
  originatorPhone: string | null;
  status: Status;
  tier: string;
  styleName: string | null;
  totalAmount: string | null;
  taxState?: string | null;
  taxRate?: string | null;
  taxAmount?: string | null;
  itemCount: number;
  notes: string | null;
  lineItems: EnrichedLine[];
  createdAt: Date;
  distributorId?: number | null;
  distributorName?: string | null;
  deliveryMethod?: "ship" | "pickup";
  sentToDistributorAt?: Date | null;
  sentToDistributorEmail?: string | null;
  qboInvoiceId?: string | null;
  qboSyncedAt?: Date | null;
  orderKind?: string | null;
  projectLabel?: string | null;
};

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  confirmed: "bg-green-500/20 text-green-700 dark:text-green-400",
  cancelled: "bg-destructive/20 text-destructive",
};

function copyPoSkus(lines: EnrichedLine[]) {
  const text = lines
    .filter((l) => l.poSku)
    .map((l) => `${l.qty}x  ${l.poSku}  — ${l.description}`)
    .join("\n");
  navigator.clipboard.writeText(text).then(() => toast.success("PO SKUs copied to clipboard"));
}

function OrderDetailDialog({
  order,
  open,
  onClose,
}: {
  order: OrderRow;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const syncToQbo = trpc.qbo.syncOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced to QuickBooks — Invoice #${data.invoiceId}`);
      utils.orders.adminListWithPoSkus.invalidate();
    },
    onError: (e) => toast.error(e.message || "QBO sync failed"),
  });
  const confirm = trpc.orders.confirm.useMutation({
    onSuccess: () => {
      toast.success("Order confirmed");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendToDistributor = trpc.orders.sendToDistributor.useMutation({
    onSuccess: (res) => {
      toast.success(`Order sent to ${res.distributorName} (${res.sentTo})`);
      utils.orders.adminListWithPoSkus.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // Color/finish per line, de-duplicated, for the build-sheet summary.
  const colorFinishes = Array.from(
    new Set(order.lineItems.map((l) => l.colorFinish).filter((v): v is string => !!v))
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            Order {order.requestNumber}
            <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-4 text-sm border rounded-lg p-4 bg-muted/30">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Customer</p>
            <p className="font-medium">{order.originatorName || "—"}</p>
            <p className="text-muted-foreground">{order.originatorEmail || ""}</p>
            <p className="text-muted-foreground">{order.originatorPhone || ""}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Order Info</p>
            <p><span className="text-muted-foreground">Style:</span> {order.styleName || "—"}</p>
            <p><span className="text-muted-foreground">Tier:</span> {order.tier}</p>
            <p><span className="text-muted-foreground">Subtotal:</span> {order.totalAmount ? `$${order.totalAmount}` : "—"}</p>
            {order.taxState && order.taxAmount && (
              <p>
                <span className="text-muted-foreground">Tax ({order.taxState}{order.taxRate ? ` · ${(parseFloat(order.taxRate) * 100).toFixed(2).replace(/\.?0+$/, "")}%` : ""}):</span>{" "}
                ${order.taxAmount}
              </p>
            )}
            {order.taxState && order.taxAmount && (
              <p className="font-semibold">
                <span className="text-muted-foreground font-normal">Grand Total:</span>{" "}
                ${(parseFloat(order.totalAmount ?? "0") + parseFloat(order.taxAmount)).toFixed(2)}
              </p>
            )}
            <p><span className="text-muted-foreground">Date:</span> {new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Fulfillment / distributor build-sheet block (admin-only) */}
        <div className="grid grid-cols-2 gap-4 text-sm border rounded-lg p-4 bg-primary/5 border-primary/20">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Distributor
            </p>
            <p className="font-medium">{order.distributorName || "— (no matched SKUs)"}</p>
            <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
              {order.deliveryMethod === "pickup" ? (
                <><MapPin className="h-3.5 w-3.5" /> Local pickup</>
              ) : (
                <><Truck className="h-3.5 w-3.5" /> Ship</>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Cabinet Color / Finish
            </p>
            {colorFinishes.length ? (
              colorFinishes.map((c, i) => <p key={i} className="font-medium">{c}</p>)
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          {order.sentToDistributorAt && (
            <div className="col-span-2 text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent {new Date(order.sentToDistributorAt).toLocaleString()} to {order.sentToDistributorEmail}
            </div>
          )}
        </div>

        {order.notes && (
          <div className="text-sm border rounded-lg p-3 bg-amber-500/5 border-amber-500/20">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Notes</p>
            <p>{order.notes}</p>
          </div>
        )}

        {/* PO SKU table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Line Items — PO SKUs</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => copyPoSkus(order.lineItems)}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy PO SKUs
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 text-center">Qty</TableHead>
                  <TableHead>PO SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lineItems.map((l, i) => (
                  <TableRow key={i} className={!l.matched ? "opacity-60" : ""}>
                    <TableCell className="text-center font-mono font-semibold">{l.qty}</TableCell>
                    <TableCell>
                      {l.poSku ? (
                        <span className="font-mono text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {l.poSku}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground italic">
                          {l.masterCode || l.rawCode || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.description}
                      {!l.matched && (
                        <Badge variant="destructive" className="ml-2 text-xs">unmatched</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {l.unitPrice != null ? `$${l.unitPrice.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {l.linePrice != null ? `$${l.linePrice.toFixed(2)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {order.lineItems.some((l) => !l.poSku) && (
            <p className="text-xs text-muted-foreground mt-2">
              * Lines without a PO SKU are unmatched or missing a door style assignment.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t flex-wrap">
          {/* QBO sync */}
          {order.qboInvoiceId ? (
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 mr-auto">
              <CheckCircle2 className="h-3.5 w-3.5" />
              QBO Invoice #{order.qboInvoiceId}
              {order.qboSyncedAt && <span className="text-muted-foreground">· {new Date(order.qboSyncedAt).toLocaleDateString()}</span>}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950 mr-auto"
              onClick={() => syncToQbo.mutate({ orderId: order.id })}
              disabled={syncToQbo.isPending}
            >
              {syncToQbo.isPending ? <Spinner className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              Sync to QuickBooks
            </Button>
          )}
          {order.status === "submitted" && (
            <Button
              variant="outline"
              onClick={() => confirm.mutate({ id: order.id })}
              disabled={confirm.isPending}
              className="gap-2"
            >
              {confirm.isPending && <Spinner className="h-4 w-4" />}
              Confirm Order
            </Button>
          )}
          {(order.status === "submitted" || order.status === "confirmed") && (
            <Button
              onClick={() => sendToDistributor.mutate({ id: order.id })}
              disabled={sendToDistributor.isPending}
              className="gap-2"
            >
              {sendToDistributor.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {order.sentToDistributorAt ? "Re-send to Distributor" : "Send to Distributor"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function IncomingOrdersAdmin() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
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
    statusFilter !== "all" ? { status: statusFilter as Status } : undefined
  );

  const utils = trpc.useUtils();
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
            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Order summary row */}
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <CardTitle className="text-sm font-mono font-semibold flex-1">
                      {order.requestNumber}
                      {order.orderKind === "sample" && <Badge variant="secondary" className="ml-2">Sample</Badge>}
                    </CardTitle>
                    <Badge className={`text-xs ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground hidden sm:block">
                      {order.originatorName || order.originatorEmail || "Guest"}
                    </span>
                    <span className="text-sm font-medium">
                      {order.totalAmount ? `$${order.totalAmount}` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailOrder(order);
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
                </CardHeader>

                {/* Expanded line items */}
                {isExpanded && (
                  <CardContent className="pt-0 pb-3 px-4">
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
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      {detailOrder && (
        <OrderDetailDialog
          order={detailOrder}
          open={!!detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
