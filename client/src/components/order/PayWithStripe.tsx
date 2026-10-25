import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface PayWithStripeProps {
  orderRequestId: number;
  orderNumber: string;
}

/**
 * Redirects a submitted order to the Stripe-hosted payment page. The server
 * derives every line and amount from the persisted order snapshot; neither a
 * checkout total nor freight amount is accepted from the browser.
 */
export default function PayWithStripe({ orderRequestId, orderNumber }: PayWithStripeProps) {
  const checkout = trpc.orders.createStripeCheckout.useMutation({
    onSuccess: ({ url, amountCents }) => {
      toast.success("Secure Stripe Checkout is opening", {
        description: `Review the final ${formatCents(amountCents)} total on Stripe before paying.`,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => {
      toast.error("Secure checkout could not open", { description: error.message });
    },
  });

  return (
    <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/70 dark:bg-emerald-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-emerald-600" /> Secure payment
        </CardTitle>
        <CardDescription>
          Your order is ready. Payment is completed on Stripe’s secure hosted checkout page; card details never pass through CabinetDealz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-emerald-200/80 bg-background/70 px-3 py-2 text-xs text-muted-foreground dark:border-emerald-900/70">
          Stripe will show the server-calculated merchandise, verified shipping, and sales tax before you pay. Affiliate-only cost fees are never added to a customer checkout. A paid Stripe confirmation completes order <strong className="text-foreground">{orderNumber}</strong>.
        </div>
        <Button
          className="w-full gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
          onClick={() => checkout.mutate({ orderRequestId })}
          disabled={checkout.isPending}
        >
          {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {checkout.isPending ? "Opening secure checkout…" : "Proceed to secure payment"}
        </Button>
      </CardContent>
    </Card>
  );
}

export { formatCents };
