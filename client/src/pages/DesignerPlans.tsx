import { useEffect } from "react";
import { Check, Loader2, Lock, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DESIGNER_SUBSCRIPTION_TIERS,
  designerSubscriptionTierChoices,
  formatTierAmount,
  type DesignerSubscriptionTier,
} from "@shared/designerSubscriptionTiers";
import { useDesignerSubscriptionProcedures } from "@/lib/designerSubscriptionProcedures";

const SIGN_IN_HREF = `/signin?returnTo=${encodeURIComponent("/plans")}`;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * /plans: the two yearly designer subscriptions Tom set on Nov 25, 2026.
 * Prices come only from shared/designerSubscriptionTiers.ts.
 */
export default function DesignerPlans() {
  const { isAuthenticated, loading } = useAuth();
  const api = useDesignerSubscriptionProcedures();
  const utils = api.useUtils();
  const mine = api.designerSubscription.mine.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const checkout = api.designerSubscription.startCheckout.useMutation({
    onSuccess: (result) => window.location.assign(result.url),
    onError: (error) => toast.error(error.message || "Stripe checkout could not start."),
  });
  const cancel = api.designerSubscription.cancel.useMutation({
    onSuccess: (result) => {
      const until = formatDate(result.accessUntil);
      toast.success(until ? `Cancelled. Your plan stays on until ${until}.` : "Cancelled.");
      void utils.designerSubscription.mine.invalidate();
    },
    onError: (error) => toast.error(error.message || "Could not cancel the plan."),
  });

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("subscription");
    if (status === "success") toast.success("Thanks! Your plan starts as soon as Stripe confirms the payment.");
    if (status === "cancelled") toast("Checkout was cancelled. You were not charged.");
  }, []);

  const current = mine.data && mine.data.status !== "cancelled" ? mine.data : null;
  const plans = designerSubscriptionTierChoices();

  function subscribe(tier: DesignerSubscriptionTier) {
    checkout.mutate({ tier });
  }

  return (
    <div className="container max-w-5xl py-12 md:py-16 space-y-10">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subscription plans</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold mt-2">Pick your plan</h1>
        <p className="mt-4 text-muted-foreground text-lg">Billed yearly. Cancel any time.</p>
      </div>

      {current ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-sm" data-testid="designer-plan-current">
          <p className="font-semibold">
            You have the {DESIGNER_SUBSCRIPTION_TIERS[current.tier].name} plan
            {current.status === "past_due" ? " (payment past due)" : ""}.
          </p>
          {current.cancelAtPeriodEnd ? (
            <p className="mt-1 text-muted-foreground">
              Cancelled. It stays on until {formatDate(current.currentPeriodEnd) ?? "the end of the paid year"}.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {current.currentPeriodEnd ? (
                <span className="text-muted-foreground">Renews {formatDate(current.currentPeriodEnd)}.</span>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel plan
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2" data-testid="designer-plan-picker">
        {plans.map((plan) => {
          const pending = checkout.isPending && checkout.variables?.tier === plan.id;
          return (
            <div
              key={plan.id}
              data-testid={`designer-plan-${plan.id}`}
              className={`relative flex flex-col rounded-2xl border p-6 md:p-8 ${plan.recommended ? "border-[var(--color-navy)] shadow-lg" : "border-border"}`}
            >
              {plan.recommended ? (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-gold)] px-3 py-1 text-xs font-bold text-[var(--color-navy)]">
                  Best value
                </span>
              ) : null}
              <h2 className="font-serif text-2xl font-bold">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-bold">{formatTierAmount(plan.amountCents)}</span>
                <span className="text-muted-foreground">/{plan.interval}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{plan.tagline}</p>
              <ul className="mt-6 space-y-2 text-sm flex-1">
                {plan.includes.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" /> {item}
                  </li>
                ))}
                {plan.excludes.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground line-through">
                    <Minus className="h-4 w-4" /> {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {loading ? null : !isAuthenticated ? (
                  <Button asChild className="w-full bg-[var(--color-navy)] text-white">
                    <a href={SIGN_IN_HREF}>Sign in to subscribe</a>
                  </Button>
                ) : current ? (
                  <Button className="w-full" variant="outline" disabled>
                    {current.tier === plan.id ? "Your plan" : "Cancel your plan first to switch"}
                  </Button>
                ) : (
                  <Button
                    className={`w-full gap-2 ${plan.recommended ? "bg-[var(--color-navy)] text-white" : ""}`}
                    variant={plan.recommended ? "default" : "outline"}
                    onClick={() => subscribe(plan.id)}
                    disabled={checkout.isPending}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {pending ? "Opening Stripe…" : `Subscribe for ${formatTierAmount(plan.amountCents)}/${plan.interval}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Card payment opens Stripe. Cabinet Dealz does not see the card number. Cancelling stops the next charge; your plan stays on until the end of the year already paid.
      </p>
    </div>
  );
}
