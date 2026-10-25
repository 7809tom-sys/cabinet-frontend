import { CheckCircle2, CircleAlert, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CheckoutSuccess() {
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session_id")?.trim() ?? "";
  const checkout = trpc.orders.stripeCheckoutStatus.useQuery(
    { sessionId },
    {
      enabled: sessionId.length >= 8,
      retry: false,
      refetchInterval: (query) => query.state.data?.paid ? false : 1500,
      refetchIntervalInBackground: true,
    },
  );

  if (!sessionId) {
    return (
      <CheckoutPanel icon={<CircleAlert className="h-7 w-7 text-amber-600" />} title="Checkout session missing">
        Return to your cart and start secure checkout again.
      </CheckoutPanel>
    );
  }

  if (checkout.isLoading || (checkout.data?.paymentPending && !checkout.data.paid)) {
    return (
      <CheckoutPanel icon={<Loader2 className="h-7 w-7 animate-spin text-[var(--color-navy)]" />} title="Confirming your Stripe payment">
        Stripe is confirming this payment with CabinetDealz. Please do not submit payment again; this page updates automatically.
      </CheckoutPanel>
    );
  }

  if (checkout.error || !checkout.data) {
    return (
      <CheckoutPanel icon={<CircleAlert className="h-7 w-7 text-destructive" />} title="We could not confirm this checkout yet">
        The payment session cannot be found. If you completed payment, please contact CabinetDealz support with your Stripe receipt.
      </CheckoutPanel>
    );
  }

  const affiliateOnlyFeeCents = checkout.data.breakdown.damageFeeCents
    + checkout.data.breakdown.techFeeCents
    + checkout.data.breakdown.cardFeeCents;

  return (
    <CheckoutPanel icon={<CheckCircle2 className="h-7 w-7 text-emerald-600" />} title="Payment confirmed">
      <p>
        Stripe confirmed order <strong>{checkout.data.requestNumber}</strong>. Your payment total was <strong>{formatCents(checkout.data.amountCents)}</strong>.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 p-4 text-left text-sm">
        <dt className="text-muted-foreground">Merchandise</dt><dd className="text-right font-medium">{formatCents(checkout.data.breakdown.merchandiseCents)}</dd>
        <dt className="text-muted-foreground">Verified shipping</dt><dd className="text-right font-medium">{formatCents(checkout.data.breakdown.freightCents)}</dd>
        <dt className="text-muted-foreground">Sales tax</dt><dd className="text-right font-medium">{formatCents(checkout.data.breakdown.salesTaxCents)}</dd>
        {affiliateOnlyFeeCents > 0 && <><dt className="text-muted-foreground">Approved affiliate fees</dt><dd className="text-right font-medium">{formatCents(affiliateOnlyFeeCents)}</dd></>}
      </dl>
      <Button asChild className="mt-6">
        <Link href="/catalog"><ReceiptText className="mr-2 h-4 w-4" /> Continue shopping</Link>
      </Button>
    </CheckoutPanel>
  );
}

function CheckoutPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="container flex min-h-[55vh] max-w-xl items-center justify-center py-10">
      <section className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">{icon}</div>
        <div className="mb-2 flex justify-center"><ShieldCheck className="h-4 w-4 text-emerald-600" /></div>
        <h1 className="font-serif text-2xl font-bold">{title}</h1>
        <div className="mt-3 text-muted-foreground">{children}</div>
      </section>
    </div>
  );
}
