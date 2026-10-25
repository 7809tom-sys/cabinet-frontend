import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, FileText, Loader2, MapPin, PackageCheck, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CARRIER_OPTIONS,
  carrierNeedsTracking,
  isValidTrackingNumber,
  trackingUrl,
} from "@shared/vendorFulfillment";
import { printPackingSlip, printShippingLabels, shipToLines, totalPieces } from "@/lib/vendorShippingDocs";

type QueueOrder = inferRouterOutputs<AppRouter>["vendorFulfillment"]["queue"][number];
type Bucket = "ready" | "upcoming" | "shipped";

function bucketOf(order: QueueOrder): Bucket {
  if (order.shipment?.status === "shipped") return "shipped";
  return order.stage;
}

function when(value: Date | string | null | undefined): string {
  return value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
}

function ShipForm({ scope, order, onDone }: { scope: string; order: QueueOrder; onDone: () => void }) {
  const existing = order.shipment;
  const [carrier, setCarrier] = useState(existing?.carrier ?? "UPS");
  const [tracking, setTracking] = useState(existing?.trackingNumber ?? "");
  const [packages, setPackages] = useState(String(existing?.packageCount ?? 1));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const utils = trpc.useUtils();
  const markPrinted = trpc.vendorFulfillment.markLabelPrinted.useMutation({
    onSuccess: () => void utils.vendorFulfillment.queue.invalidate(),
  });
  const ship = trpc.vendorFulfillment.markShipped.useMutation({
    onSuccess: (result) => {
      toast.success(result.firstShip ? "Marked shipped. Tracking saved." : "Shipment details updated.");
      void utils.vendorFulfillment.queue.invalidate();
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });
  const needsTracking = carrierNeedsTracking(carrier);
  const packageCount = Math.max(1, Math.min(99, Number(packages) || 1));
  const trackingOk = tracking.trim() === "" ? !needsTracking : isValidTrackingNumber(tracking);
  const docs = {
    requestNumber: order.requestNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shipTo: order.shipTo,
    deliveryLocationType: order.deliveryLocationType,
    liftgateRequired: order.liftgateRequired,
    shipFrom: order.shipFrom,
    items: order.items,
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const ok = await printShippingLabels(docs, packageCount);
            if (!ok) return toast.error("This order has no complete ship-to address yet.");
            if (!existing?.labelPrintedAt) markPrinted.mutate({ scope, orderId: order.orderId });
          }}
        >
          <Printer className="mr-1.5 h-4 w-4" />
          Print shipping label{packageCount > 1 ? "s" : ""}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void printPackingSlip(docs, packageCount)}>
          <FileText className="mr-1.5 h-4 w-4" />
          Print packing slip
        </Button>
        {existing?.labelPrintedAt && <span className="text-xs text-muted-foreground">Label printed {when(existing.labelPrintedAt)}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Labels carry the ship-to address and order number. Buy postage with your own carrier account, then enter the tracking number below.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_90px]">
        <div className="space-y-1">
          <Label className="text-xs">Carrier</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger aria-label="Carrier" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CARRIER_OPTIONS.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tracking number{needsTracking ? "" : " (optional)"}</Label>
          <Input
            aria-label="Tracking number"
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            placeholder={needsTracking ? "1Z999AA10123456784" : "Not needed"}
            className={tracking.trim() && !trackingOk ? "border-destructive" : ""}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Packages</Label>
          <Input aria-label="Packages" type="number" min={1} max={99} value={packages} onChange={(event) => setPackages(event.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note for the order file (optional)</Label>
        <Textarea aria-label="Shipment note" rows={2} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} />
      </div>
      <Button
        type="button"
        disabled={ship.isPending || !trackingOk || (needsTracking && !tracking.trim())}
        onClick={() => ship.mutate({ scope, orderId: order.orderId, carrier, trackingNumber: tracking.trim() || null, packageCount, notes: notes.trim() || null })}
      >
        {ship.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-1.5 h-4 w-4" />}
        {existing?.status === "shipped" ? "Save changes" : "Mark shipped"}
      </Button>
    </div>
  );
}

function OrderCard({ scope, order }: { scope: string; order: QueueOrder }) {
  const [editing, setEditing] = useState(false);
  const bucket = bucketOf(order);
  const address = shipToLines(order);
  const link = trackingUrl(order.shipment?.carrier, order.shipment?.trackingNumber);
  return (
    <Card data-testid={`fulfillment-order-${order.orderId}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-semibold">{order.requestNumber}</p>
            <p className="text-xs text-muted-foreground">Paid {when(order.paidAt)} · {totalPieces(order.items)} piece{totalPieces(order.items) === 1 ? "" : "s"}</p>
          </div>
          {bucket === "ready" && <Badge className="bg-emerald-600">Ready to ship</Badge>}
          {bucket === "upcoming" && <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{order.stageLabel}</Badge>}
          {bucket === "shipped" && <Badge className="bg-sky-600"><CheckCircle2 className="mr-1 h-3 w-3" />Shipped {when(order.shipment?.shippedAt)}</Badge>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="text-sm">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><MapPin className="h-3 w-3" />Ship to</p>
            {address.length ? address.map((line, index) => <p key={index}>{line}</p>) : <p className="text-muted-foreground">No address on file</p>}
            {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {order.deliveryMethod === "pickup" ? "Customer pickup" : order.deliveryLocationType === "residential" ? "Residential" : "Business"}
              {order.liftgateRequired ? " · Liftgate required" : ""}
            </p>
          </div>
          <div className="text-sm">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Truck className="h-3 w-3" />Ship from</p>
            <p>{order.shipFrom || <span className="text-muted-foreground">Add your warehouse in Shipping</span>}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="p-2 text-left">Qty</th><th className="p-2 text-left">SKU</th><th className="p-2 text-left">Item</th></tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.sku}-${index}`} className="border-t">
                  <td className="p-2 tabular-nums">{item.qty}</td>
                  <td className="p-2 font-mono text-xs">{item.sku}</td>
                  <td className="p-2">{item.description}{item.doorStyle ? <span className="text-muted-foreground"> · {item.doorStyle}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bucket === "ready" && <ShipForm scope={scope} order={order} onDone={() => undefined} />}

        {bucket === "shipped" && order.shipment && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><span className="text-muted-foreground">Carrier</span> {order.shipment.carrier}</span>
              <span><span className="text-muted-foreground">Packages</span> {order.shipment.packageCount}</span>
              {order.shipment.trackingNumber && (
                <span className="font-mono text-xs">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                      {order.shipment.trackingNumber}<ExternalLink className="h-3 w-3" />
                    </a>
                  ) : order.shipment.trackingNumber}
                </span>
              )}
            </div>
            {order.shipment.notes && <p className="text-xs text-muted-foreground">{order.shipment.notes}</p>}
            {editing ? <ShipForm scope={scope} order={order} onDone={() => setEditing(false)} /> : (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>Correct tracking or carrier</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VendorFulfillmentQueue({
  approvedVendorLineId,
  distributorId,
}: {
  approvedVendorLineId?: number;
  distributorId?: number;
}) {
  const scopeInput = useMemo(() => ({ approvedVendorLineId, distributorId }), [approvedVendorLineId, distributorId]);
  const scopes = trpc.vendorFulfillment.scopes.useQuery(scopeInput);
  const [picked, setPicked] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("ready");
  const options = scopes.data ?? [];
  const scope = picked && options.some((option) => option.scope === picked) ? picked : options[0]?.scope ?? null;
  const queue = trpc.vendorFulfillment.queue.useQuery({ scope: scope ?? "pelican" }, { enabled: Boolean(scope), refetchInterval: 60_000 });

  const counts = useMemo(() => {
    const result: Record<Bucket, number> = { ready: 0, upcoming: 0, shipped: 0 };
    for (const order of queue.data ?? []) result[bucketOf(order)] += 1;
    return result;
  }, [queue.data]);

  // Land on the first tab that has work.
  useEffect(() => {
    if (!queue.data) return;
    if (counts[bucket] === 0) {
      const next = (["ready", "upcoming", "shipped"] as Bucket[]).find((name) => counts[name] > 0);
      if (next) setBucket(next);
    }
    // Only re-pick when the data set changes, never while the vendor browses tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.data]);

  if (scopes.isLoading) return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!scope) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        This account is not linked to a vendor catalog yet, so there are no orders to fulfill. Ask the platform administrator to link it.
      </CardContent></Card>
    );
  }

  const visible = (queue.data ?? []).filter((order) => bucketOf(order) === bucket);
  return (
    <div className="space-y-4" data-testid="vendor-fulfillment-queue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Order fulfillment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paid orders containing your items. Print the label, enter tracking and mark shipped. Orders unlock after the affiliate and distributor review steps finish.
          </p>
        </div>
        {options.length > 1 && (
          <Select value={scope} onValueChange={setPicked}>
            <SelectTrigger className="w-64" aria-label="Vendor"><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((option) => <SelectItem key={option.scope} value={option.scope}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={bucket} onValueChange={(value) => setBucket(value as Bucket)}>
        <TabsList>
          <TabsTrigger value="ready">Ready to ship ({counts.ready})</TabsTrigger>
          <TabsTrigger value="upcoming">Coming soon ({counts.upcoming})</TabsTrigger>
          <TabsTrigger value="shipped">Shipped ({counts.shipped})</TabsTrigger>
        </TabsList>
      </Tabs>

      {queue.isLoading && <Skeleton className="h-40 w-full" />}
      {queue.error && <p className="text-sm text-destructive">The queue could not be loaded: {queue.error.message}</p>}
      {!queue.isLoading && !queue.error && visible.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {bucket === "ready" ? "Nothing is waiting to ship right now." : bucket === "upcoming" ? "No paid orders are waiting on a review step." : "No shipments recorded yet."}
        </CardContent></Card>
      )}
      <div className="space-y-3">{visible.map((order) => <OrderCard key={order.orderId} scope={scope} order={order} />)}</div>
    </div>
  );
}
