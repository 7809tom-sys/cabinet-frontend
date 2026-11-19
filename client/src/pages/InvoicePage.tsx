/**
 * Customer invoice, tracking and damage-report entry point (Tom, Nov 19 2026, PR 2).
 *
 * Two ways in: the link in the order email carries ?invoice=...&key=... (the email or
 * ZIP), or the customer types both on this page. The API verifies the pair against the
 * order itself and answers the same sentence for a wrong number and a wrong contact,
 * so this page never learns whether an invoice exists.
 *
 * Photos on an existing claim arrive as short-lived signed URLs from the API; this
 * page never builds storage URLs itself.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DamageClaimForm from "@/components/DamageClaimForm";

type InvoiceView = {
  invoiceNumber: string;
  orderNumber: string;
  status: string;
  placedAt: string | null;
  totals: { subtotal: string | null; shipping: string | null; total: string | null };
  items: Array<{ id: number; sku: string; name: string | null; quantity: number }>;
  tracking: Array<{
    id: number;
    carrier: string | null;
    trackingNumber: string | null;
    status: string;
    trackingUrl: string | null;
    estimatedDeliveryAt: string | null;
  }>;
  claims: Array<{ id: number; status: string; submittedAt: string | null; description: string; photos: string[] }>;
};

type LookupResponse = { ok: true; invoice: InvoiceView } | { ok: false; message: string };

function money(value: string | null): string {
  if (!value) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : value;
}

function day(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function InvoicePage() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [emailOrZip, setEmailOrZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);

  const prefilled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { invoice: params.get("invoice") ?? "", key: params.get("key") ?? "" };
  }, []);

  useEffect(() => {
    if (!prefilled.invoice || !prefilled.key) return;
    setInvoiceNumber(prefilled.invoice);
    setEmailOrZip(prefilled.key);
    void lookup(prefilled.invoice, prefilled.key);
    // Runs once for an emailed link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilled.invoice, prefilled.key]);

  async function lookup(number = invoiceNumber, key = emailOrZip) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/invoices/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceNumber: number.trim(), emailOrZip: key.trim() }),
      });
      const body = (await response.json()) as LookupResponse;
      if (body.ok) {
        setInvoice(body.invoice);
        return;
      }
      setInvoice(null);
      setError(body.message);
    } catch {
      setInvoice(null);
      setError("The invoice could not be loaded. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold text-[#1a2744]">Your invoice</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Track the shipment and report anything that arrived damaged. Use the invoice number and the email or ZIP that
        was on the order.
      </p>

      {!invoice ? (
        <form
          className="mt-6 space-y-4 rounded-lg border border-[#e5e0d6] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="invoice-number">Invoice number</Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="INV-1042"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoice-key">Email or ZIP on the order</Label>
            <Input
              id="invoice-key"
              value={emailOrZip}
              onChange={(event) => setEmailOrZip(event.target.value)}
              placeholder="you@example.com or 33013"
              autoComplete="email"
            />
          </div>
          {error && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !invoiceNumber.trim() || !emailOrZip.trim()}>
            {busy ? "Looking up…" : "View invoice"}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-[#e5e0d6] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#1a2744]">Invoice {invoice.invoiceNumber}</h2>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{invoice.status}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Order {invoice.orderNumber} · placed {day(invoice.placedAt)}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{money(invoice.totals.subtotal)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{money(invoice.totals.shipping)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">{money(invoice.totals.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-[#e5e0d6] p-4">
            <h2 className="text-lg font-semibold text-[#1a2744]">Shipping &amp; tracking</h2>
            {invoice.tracking.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No shipment has been booked yet. Tracking appears here as soon as the carrier is assigned.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {invoice.tracking.map((shipment) => (
                  <li key={shipment.id} className="rounded border border-[#e5e0d6] p-3 text-sm" data-testid="invoice-tracking-row">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-[#1a2744]">{shipment.carrier ?? "Carrier pending"}</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{shipment.status}</span>
                    </div>
                    {shipment.trackingNumber && (
                      <p className="mt-1 font-mono text-xs">{shipment.trackingNumber}</p>
                    )}
                    <p className="mt-1 text-muted-foreground">
                      {shipment.estimatedDeliveryAt ? `Estimated delivery ${day(shipment.estimatedDeliveryAt)}` : "No estimate yet"}
                      {shipment.trackingUrl ? (
                        <>
                          {" · "}
                          <a className="text-[#2563eb] underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                            Track with the carrier
                          </a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-[#e5e0d6] p-4">
            <h2 className="text-lg font-semibold text-[#1a2744]">Items on this invoice</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-1">SKU</th>
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#f0ece3]">
                    <td className="py-1.5 font-mono text-xs">{item.sku}</td>
                    <td className="py-1.5">{item.name ?? "—"}</td>
                    <td className="py-1.5 text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {invoice.claims.length > 0 && (
            <section className="rounded-lg border border-[#e5e0d6] p-4">
              <h2 className="text-lg font-semibold text-[#1a2744]">Claims on this invoice</h2>
              <ul className="mt-3 space-y-3">
                {invoice.claims.map((claim) => (
                  <li key={claim.id} className="rounded border border-[#e5e0d6] p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-[#1a2744]">Claim #{claim.id}</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{claim.status}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">Submitted {day(claim.submittedAt)}</p>
                    <p className="mt-1">{claim.description}</p>
                    {claim.photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {claim.photos.map((url) => (
                          <img key={url} src={url} alt="Damage evidence" className="h-16 w-16 rounded border object-cover" />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-[#e5e0d6] p-4">
            <h2 className="text-lg font-semibold text-[#1a2744]">Something arrived damaged?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the affected line items, add a photo or two, and tell us what happened. We answer within one
              business day.
            </p>
            {!claimOpen ? (
              <Button className="mt-3" data-testid="invoice-report-damage" onClick={() => setClaimOpen(true)}>
                Report damaged items
              </Button>
            ) : (
              <DamageClaimForm
                invoiceNumber={invoice.invoiceNumber}
                emailOrZip={emailOrZip}
                lines={invoice.items}
                onCancel={() => setClaimOpen(false)}
                onSubmitted={() => {
                  setClaimOpen(false);
                  void lookup(invoice.invoiceNumber, emailOrZip);
                }}
              />
            )}
          </section>

          <Button
            variant="outline"
            onClick={() => {
              setInvoice(null);
              setError(null);
            }}
          >
            Look up another invoice
          </Button>
        </div>
      )}
    </main>
  );
}