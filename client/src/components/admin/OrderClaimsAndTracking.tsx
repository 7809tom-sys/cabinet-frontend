/**
 * Admin: claims review and customer shipment tracking on the order detail
 * (Tom, Nov 19 2026, PR 4 part 2c).
 *
 * Both panels are self-contained: they fetch their own data through the adminClaims
 * and adminTracking routers, so the order screen only has to render them. Neither
 * touches the cost or margin table.
 *
 * The claims panel renders nothing when the order has no claims, so an undamaged order
 * looks exactly as it did before.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CLAIM_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  replacement_credit: "Replacement / credit",
  resolved: "Resolved",
};

const CLAIM_TRANSITIONS: Record<string, string[]> = {
  submitted: ["under_review", "resolved"],
  under_review: ["replacement_credit", "resolved"],
  replacement_credit: ["resolved"],
  resolved: ["under_review"],
};

const TRACKING_STATUSES = ["pending", "in_transit", "delivered", "exception"] as const;

export function OrderClaimsPanel({ orderId }: { orderId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.adminClaims.listForOrder.useQuery({ orderId });
  const setStatus = trpc.adminClaims.setStatus.useMutation({
    onSuccess: () => void utils.adminClaims.listForOrder.invalidate({ orderId }),
  });

  if (isLoading) return null;
  const claims = data?.claims ?? [];
  if (claims.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-[#e5e0d6] bg-white" data-testid="admin-order-claims">
      <header className="flex items-baseline justify-between border-b border-[#f0ece3] px-4 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a2744]">Damage claims</h2>
        <span className="text-xs text-muted-foreground">{claims.length} on this order</span>
      </header>
      <ul className="divide-y divide-[#f0ece3]">
        {claims.map((claim) => (
          <li key={claim.id} className="px-4 py-3 text-sm" data-testid="admin-order-claim-row">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-[#1a2744]">Claim #{claim.id} · invoice {claim.invoiceNumber}</span>
              <span className="text-xs uppercase tracking-wide text-[#a87f33]">{CLAIM_STATUS_LABELS[claim.status] ?? claim.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {claim.contactEmail}
              {claim.submittedAt ? " · " + new Date(claim.submittedAt).toLocaleString() : ""}
              {claim.discoveredStage ? " · " + claim.discoveredStage : ""}
            </p>
            <p className="mt-2">{claim.description}</p>
            <ul className="mt-2 space-y-0.5 text-xs">
              {claim.items.map((item, index) => (
                <li key={claim.id + "-" + index}>
                  <span className="font-mono">{item.sku || "(no sku)"}</span> × {item.damagedQuantity}
                  {item.notes ? " — " + item.notes : ""}
                </li>
              ))}
            </ul>
            {claim.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {claim.photos.map((url, index) => (
                  <a key={url + index} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={"Claim evidence " + (index + 1)} className="h-16 w-16 rounded border object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(CLAIM_TRANSITIONS[claim.status] ?? []).map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ claimId: claim.id, status: next as never })}
                >
                  Move to {CLAIM_STATUS_LABELS[next] ?? next}
                </Button>
              ))}
              {claim.resolutionNote && (
                <span className="text-xs text-muted-foreground">{claim.resolutionNote}</span>
              )}
            </div>
            {setStatus.error && <p className="mt-1 text-xs text-red-700">{setStatus.error.message}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrderTrackingEditor({ orderId }: { orderId: number }) {
  const utils = trpc.useUtils();
  const { data } = trpc.adminTracking.list.useQuery({ orderId });
  const invalidate = () => void utils.adminTracking.list.invalidate({ orderId });
  const create = trpc.adminTracking.create.useMutation({ onSuccess: invalidate });
  const update = trpc.adminTracking.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.adminTracking.remove.useMutation({ onSuccess: invalidate });

  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [eta, setEta] = useState("");
  const [status, setStatus] = useState<string>("pending");

  const shipments = data?.shipments ?? [];

  return (
    <section className="mt-4" data-testid="admin-order-tracking">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer shipments</p>
        <Button size="sm" variant="outline" onClick={() => setOpen((current) => !current)}>
          {open ? "Close" : "+ Add shipment"}
        </Button>
      </div>

      {shipments.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing on the customer invoice yet. Add each pallet or freight load as its own row.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {shipments.map((shipment) => (
            <li key={shipment.id} className="rounded border border-[#e5e0d6] px-3 py-2 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-[#1a2744]">{shipment.carrier ?? "Carrier pending"}</span>
                <select
                  className="rounded border border-input bg-background px-1 py-0.5 text-xs"
                  value={shipment.status}
                  onChange={(event) => update.mutate({ id: shipment.id, status: event.target.value as never })}
                >
                  {TRACKING_STATUSES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <p className="mt-0.5 font-mono">{shipment.trackingNumber ?? "no number"}</p>
              <p className="mt-0.5 text-muted-foreground">
                {shipment.estimatedDeliveryAt ? "ETA " + new Date(shipment.estimatedDeliveryAt).toLocaleDateString() : "no ETA"}
                {shipment.trackingUrl ? " · " : ""}
                {shipment.trackingUrl && (
                  <a className="text-[#2563eb] underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">carrier link</a>
                )}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-6 px-2 text-xs text-red-700"
                onClick={() => remove.mutate({ id: shipment.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form
          className="mt-2 space-y-2 rounded border border-[#e5e0d6] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              {
                orderId,
                carrier: carrier || undefined,
                trackingNumber: trackingNumber || undefined,
                trackingUrl: trackingUrl || undefined,
                estimatedDeliveryAt: eta || undefined,
                status: status as never,
              },
              {
                onSuccess: () => {
                  setCarrier("");
                  setTrackingNumber("");
                  setTrackingUrl("");
                  setEta("");
                  setOpen(false);
                },
              },
            );
          }}
        >
          <Input placeholder="Carrier (e.g. Estes)" value={carrier} onChange={(event) => setCarrier(event.target.value)} />
          <Input placeholder="Tracking / PRO number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />
          <Input placeholder="Tracking URL (https://…)" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} />
          <Input type="date" value={eta} onChange={(event) => setEta(event.target.value)} />
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {TRACKING_STATUSES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={create.isPending}>Save shipment</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {create.error && <p className="text-xs text-red-700">{create.error.message}</p>}
        </form>
      )}
    </section>
  );
}