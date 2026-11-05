import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  Palette,
  Send,
  Truck,
} from "lucide-react";
import AdminOrderStripeBreakdown from "@/components/admin/AdminOrderStripeBreakdown";
import OrderFulfillmentTrail from "@/components/admin/OrderFulfillmentTrail";
import PalletPhotoPrompt from "@/components/admin/PalletPhotoPrompt";
import { describeAdminOrderList } from "@/lib/adminOrderReconciliation";
import { adminOrderPalletPhotos } from "@/lib/orderPalletPhoto";
import {
  ADMIN_ORDER_CARRIERS,
  ADMIN_ORDER_STATUS_COLORS,
  adminOrderCarrierOptions,
  adminOrderCarrierUsesOrderNumber,
  adminOrderShipment,
  adminOrderTrackingFieldLabel,
  adminOrderVerified,
  type AdminOrderRow,
} from "@/lib/adminOrderRow";

function copyPoSkus(lines: AdminOrderRow["lineItems"]) {
  const text = lines
    .filter((l) => l.poSku)
    .map((l) => `${l.qty}x  ${l.poSku}  — ${l.description}`)
    .join("\n");
  navigator.clipboard.writeText(text).then(() => toast.success("PO SKUs copied to clipboard"));
}

/**
 * Full-page admin order view. Every block here is the same content, actions and
 * mutations the quarter-page dialog used to render; only the container changed
 * (a route instead of a modal) plus the editable carrier/tracking controls.
 */
export default function AdminOrderDetailPage({ order, onBack }: { order: AdminOrderRow; onBack: () => void }) {
  const utils = trpc.useUtils();
  // Local form state so the two new fields accept typing; they start from what
  // the order already has saved and follow a refetch that brings a new value.
  const [carrier, setCarrier] = useState(order.shipmentCarrier ?? "");
  const [tracking, setTracking] = useState(order.shipmentTracking ?? "");
  // The pallet photo prompt appears after a successful "mark shipped" and can be
  // reopened from the shipment section, so a photo can be added a day later.
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  useEffect(() => {
    setCarrier((current) => current || order.shipmentCarrier || "");
    setTracking((current) => current || order.shipmentTracking || "");
  }, [order.id, order.shipmentCarrier, order.shipmentTracking]);

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
      onBack();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendToDistributor = trpc.orders.resendDistributorEmail.useMutation({
    onSuccess: (res) => {
      if (res.status === "sent") toast.success(`Email sent to ${res.sentTo}`);
      else if (res.status === "no_email") toast.error(res.error || "No order email set");
      else toast.error(res.error || "Distributor email was not sent");
      utils.orders.adminListWithPoSkus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markVerified = trpc.orders.markVerified.useMutation({
    onSuccess: () => { toast.success("Order verified"); utils.orders.adminListWithPoSkus.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const markShipped = trpc.orders.markShipped.useMutation({
    onSuccess: () => {
      toast.success("Shipment saved");
      utils.orders.adminListWithPoSkus.invalidate();
      // Ask for the pallet photo right after the order is marked shipped.
      setPhotoPromptOpen(true);
    },
    onError: (e) => toast.error(e.message),
  });
  const markSigned = trpc.orders.markSigned.useMutation({
    onSuccess: () => { toast.success("Order marked signed"); utils.orders.adminListWithPoSkus.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = trpc.orders.adminMarkPaid.useMutation({
    onSuccess: () => { toast.success("Order marked paid. The CRM deal moves to New Sale."); utils.orders.adminListWithPoSkus.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // Color/finish per line, de-duplicated, for the build-sheet summary.
  const colorFinishes = Array.from(
    new Set(order.lineItems.map((l) => l.colorFinish).filter((v): v is string => !!v))
  );
  const customer = describeAdminOrderList(order);
  const verified = adminOrderVerified(order);
  const shipment = adminOrderShipment(order);
  const savedCarrier = shipment.carrier;
  const savedTracking = shipment.tracking;
  const carrierOptions = adminOrderCarrierOptions(savedCarrier);
  const palletPhotos = adminOrderPalletPhotos(order);
  const trackingDirty = (carrier || "").trim() !== (savedCarrier ?? "") || (tracking || "").trim() !== (savedTracking ?? "");
  // The carrier and tracking fields unlock once the order is verified. After it
  // ships they stay editable so tracking can be corrected a day later.
  const canEditShipment = verified;

  // `orders.uploadPalletPhoto` ships in the cabinet-backend draft. Calling it
  // through trpc would break the bundle until it exists, so the prompt reports
  // that the attachment cannot be stored yet instead of dropping the photo.
  const uploadPalletPhoto = async () => ({ url: null as string | null });
  const palletPhotoUnavailable =
    "Photo capture works, but attaching it to the order needs the backend photo upload (orders.uploadPalletPhoto) that is still in review.";

  const saveShipment = () => {
    markShipped.mutate({
      id: order.id,
      carrier: carrier.trim() || undefined,
      tracking: tracking.trim() || undefined,
    });
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background" data-testid="admin-order-full-page">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack} data-testid="admin-order-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Incoming Orders
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Order {order.requestNumber}</h1>
            <Badge className={ADMIN_ORDER_STATUS_COLORS[order.status]}>{order.status}</Badge>
            {order.orderKind === "sample" && <Badge variant="secondary">Sample</Badge>}
            {verified && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700" data-testid="admin-order-verified-badge">
                Verified
              </Badge>
            )}
            {shipment.shipped && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700" data-testid="admin-order-shipped-badge">
                Shipped
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice breakdown for {customer.customerName || order.requestNumber}, including shipping and the Stripe charge.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        {/* Customer info */}
        <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
            <p className="font-medium">{customer.customerName || order.originatorName || "—"}</p>
            <p className="text-muted-foreground">{order.originatorEmail || ""}</p>
            <p className="text-muted-foreground">{order.originatorPhone || ""}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Order Info</p>
            <p><span className="text-muted-foreground">Style:</span> {order.styleName || "—"}</p>
            <p><span className="text-muted-foreground">Tier:</span> {order.tier}</p>
            <p><span className="text-muted-foreground">Ship to:</span> {customer.shippingLocation || "Shipping location not recorded"}</p>
            <p><span className="text-muted-foreground">Date:</span> {new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Fulfillment / distributor build-sheet block (admin-only) */}
        <div className="grid gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Distributor
            </p>
            <p className="font-medium">{order.distributorName || "— (no matched SKUs)"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              {order.deliveryMethod === "pickup" ? (
                <><MapPin className="h-3.5 w-3.5" /> Local pickup</>
              ) : (
                <><Truck className="h-3.5 w-3.5" /> Ship</>
              )}
            </p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3.5 w-3.5" /> Cabinet Color / Finish
            </p>
            {colorFinishes.length ? (
              colorFinishes.map((c, i) => <p key={i} className="font-medium">{c}</p>)
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          {order.sentToDistributorAt && !order.distributorEmailSentAt && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 sm:col-span-2 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent {new Date(order.sentToDistributorAt).toLocaleString()} to {order.sentToDistributorEmail}
            </div>
          )}
        </div>

        <OrderFulfillmentTrail order={order} />

        {order.notes && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
            <p>{order.notes}</p>
          </div>
        )}

        <AdminOrderStripeBreakdown order={order} />

        {/* Shipment: saved tracking plus the editable carrier/tracking fields */}
        <section className="space-y-3 rounded-lg border p-4" data-testid="admin-order-shipment">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Shipment</h3>
            {shipment.shipped ? (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700" data-testid="admin-order-shipment-shipped">
                Shipped{shipment.shippedAt ? ` ${new Date(shipment.shippedAt).toLocaleString()}` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="admin-order-shipment-not-shipped">Not shipped</Badge>
            )}
          </div>

          <div className="text-sm" data-testid="admin-order-saved-tracking">
            <p>
              <span className="text-muted-foreground">{adminOrderTrackingFieldLabel(savedCarrier)}:</span>{" "}
              {savedTracking ? (
                shipment.trackingUrl ? (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                  >
                    {savedTracking}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono">{savedTracking}</span>
                )
              ) : (
                <span className="text-muted-foreground">not recorded</span>
              )}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Carrier:</span> {savedCarrier ?? "not recorded"}
            </p>
            {savedCarrier && adminOrderCarrierUsesOrderNumber(savedCarrier) && (
              <p className="mt-1 text-xs text-muted-foreground">
                US Cabinet Depot does not issue a tracking number; this field holds their order number.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-order-carrier" className="text-xs">Carrier</Label>
              <Select
                value={carrier}
                onValueChange={setCarrier}
                disabled={!canEditShipment}
              >
                <SelectTrigger id="admin-order-carrier" className="w-full" aria-label="Carrier" data-testid="admin-order-carrier">
                  <SelectValue placeholder="Choose a carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carrierOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-order-tracking" className="text-xs">{adminOrderTrackingFieldLabel(carrier)}</Label>
              <Input
                id="admin-order-tracking"
                data-testid="admin-order-tracking"
                value={tracking}
                disabled={!canEditShipment}
                placeholder={adminOrderCarrierUsesOrderNumber(carrier) ? "US Cabinet Depot order number" : "Tracking number"}
                onChange={(event) => setTracking(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={saveShipment}
              disabled={!canEditShipment || markShipped.isPending || !trackingDirty}
              className="gap-2"
              data-testid="admin-order-save-shipment"
            >
              {markShipped.isPending && <Spinner className="h-4 w-4" />}
              {shipment.shipped ? "Save shipment details" : "Save and mark shipped"}
            </Button>
            {!canEditShipment && (
              <p className="text-xs text-muted-foreground" data-testid="admin-order-shipment-locked">
                Verify the order before entering a carrier or tracking number.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The four standard carriers are {ADMIN_ORDER_CARRIERS.join(", ")}. A carrier already saved on the order stays selectable.
          </p>

          {/* Pallet photo: prompt after shipping, and reopenable later. */}
          {photoPromptOpen ? (
            <PalletPhotoPrompt
              onSkip={() => setPhotoPromptOpen(false)}
              onUpload={uploadPalletPhoto}
              uploadUnavailableReason={palletPhotoUnavailable}
            />
          ) : (
            <div className="space-y-2" data-testid="admin-order-pallet-photos">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> Pallet photos
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setPhotoPromptOpen(true)}
                  data-testid="admin-order-add-pallet-photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {palletPhotos.length ? "Add another photo" : "Add pallet photo"}
                </Button>
              </div>
              {palletPhotos.length ? (
                <ul className="flex flex-wrap gap-3">
                  {palletPhotos.map((photo) => (
                    <li key={photo.url}>
                      <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={photo.url}
                          alt={`Pallet photo for order ${order.requestNumber}`}
                          className="h-32 w-auto rounded-md border object-cover"
                          data-testid="admin-order-pallet-photo"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="admin-order-no-pallet-photo">
                  No pallet photo yet. Take one when the pallet is ready to leave.
                </p>
              )}
            </div>
          )}
        </section>

        {/* PO SKU table */}
        <div>
          <div className="mb-2 flex items-center justify-between">
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
          <div className="overflow-hidden rounded-lg border">
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
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold text-primary">
                          {l.poSku}
                        </span>
                      ) : (
                        <span className="font-mono text-xs italic text-muted-foreground">
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
            <p className="mt-2 text-xs text-muted-foreground">
              * Lines without a PO SKU are unmatched or missing a door style assignment.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-2">
          {/* QBO sync */}
          {order.qboInvoiceId ? (
            <div className="mr-auto flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              QBO Invoice #{order.qboInvoiceId}
              {order.qboSyncedAt && <span className="text-muted-foreground">· {new Date(order.qboSyncedAt).toLocaleDateString()}</span>}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mr-auto gap-1.5 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
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
          {!order.paidAt && (
            <Button variant="outline" onClick={() => markPaid.mutate({ id: order.id })} disabled={markPaid.isPending}>
              Mark paid
            </Button>
          )}
          <Button variant="outline" onClick={() => markVerified.mutate({ id: order.id })} disabled={markVerified.isPending}>
            Mark verified
          </Button>
          <Button variant="outline" onClick={() => markSigned.mutate({ id: order.id, signerName: order.signerName ?? undefined })} disabled={markSigned.isPending}>
            Mark signed
          </Button>
          {(order.status === "submitted" || order.status === "confirmed") && (
            <Button
              onClick={() => sendToDistributor.mutate({ id: order.id })}
              disabled={sendToDistributor.isPending}
              className="gap-2"
            >
              {sendToDistributor.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {order.distributorEmailStatus === "sent" || order.sentToDistributorAt ? "Resend" : "Send to Distributor"}
            </Button>
          )}
        </div>

      </main>
    </div>
  );
}
