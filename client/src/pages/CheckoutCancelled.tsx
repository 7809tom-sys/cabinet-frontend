import { ArrowLeft, CircleAlert, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/** Stripe cancellation never changes the saved submitted order or charges a card. */
export default function CheckoutCancelled() {
  return (
    <div className="container flex min-h-[55vh] max-w-xl items-center justify-center py-10">
      <section className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
          <CircleAlert className="h-7 w-7 text-amber-600" />
        </div>
        <div className="mb-2 flex justify-center"><ShieldCheck className="h-4 w-4 text-emerald-600" /></div>
        <h1 className="font-serif text-2xl font-bold">Checkout cancelled</h1>
        <p className="mt-3 text-muted-foreground">
          No payment was made. Your submitted order has not changed, so you can return to the cart and begin secure checkout again when you are ready.
        </p>
        <Button asChild className="mt-6">
          <Link href="/cart"><ArrowLeft className="mr-2 h-4 w-4" /> Return to cart</Link>
        </Button>
      </section>
    </div>
  );
}
