import { Button } from "@/components/ui/button";
import type { ComposedCheckoutShipping, ShippingRulesQuote } from "@shared/shippingRules";
import { formatKnownShippingWithPending } from "@shared/shippingRules";

export function ShippingRulesBreakdown({
  rules,
  composed,
  showActions = false,
  estimateBusy = false,
  manualBusy = false,
  estimateSent = false,
  manualSent = false,
  onRequestEstimate,
  onRequestManualQuote,
}: {
  rules: ShippingRulesQuote;
  composed?: ComposedCheckoutShipping | null;
  showActions?: boolean;
  estimateBusy?: boolean;
  manualBusy?: boolean;
  estimateSent?: boolean;
  manualSent?: boolean;
  onRequestEstimate?: () => void;
  onRequestManualQuote?: () => void;
}) {
  if (rules.categories.length === 0) return null;
  const knownCents = composed?.knownShippingCents ?? rules.knownRuleShippingCents;
  const pendingLabels = composed?.pendingLabels ?? rules.pendingLabels;
  return (
    <div className="space-y-2" data-testid="shipping-rules-breakdown">
      {rules.categories.filter((row) => row.path !== "existing").map((row) => (
        <div key={row.category} className="rounded-md border border-border bg-background p-3 text-sm" data-testid={`shipping-rule-${row.category}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{row.label}</p>
            <p className={`shrink-0 font-semibold ${row.pendingLabel ? "text-amber-800" : ""}`}>{row.displayAmount}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{row.policy}</p>
        </div>
      ))}
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm" data-testid="shipping-rules-known-total">
        <span className="font-medium">Known shipping</span>
        <span className="font-semibold text-right">{formatKnownShippingWithPending(knownCents, pendingLabels)}</span>
      </div>
      {pendingLabels.length > 0 && (
        <p className="text-xs text-amber-800" data-testid="shipping-pending-note">
          Pending shipping is quoted separately and is not included in the total as $0.
        </p>
      )}
      {showActions && (
        <div className="flex flex-col gap-2 pt-1">
          {rules.canRequestEstimate && (
            <Button
              type="button"
              variant="outline"
              className="bg-background"
              disabled={estimateBusy || estimateSent}
              onClick={onRequestEstimate}
              data-testid="request-shipping-estimate"
            >
              {estimateSent ? "Estimate requested" : estimateBusy ? "Requesting estimate…" : "Request a shipping estimate"}
            </Button>
          )}
          {rules.canRequestManualQuote && (
            <Button
              type="button"
              variant="outline"
              className="bg-background"
              disabled={manualBusy || manualSent}
              onClick={onRequestManualQuote}
              data-testid="request-manual-shipping-quote"
            >
              {manualSent ? "Invoice sent for a manual quote" : manualBusy ? "Sending invoice…" : "Send this invoice for a manual quote"}
            </Button>
          )}
          {rules.canRequestEstimate && (
            <p className="text-xs text-muted-foreground">
              Requesting an estimate emails the team and marks the order awaiting a shipping estimate. You can still place or save the order with shipping shown as pending.
            </p>
          )}
          {rules.canRequestManualQuote && (
            <p className="text-xs text-muted-foreground">
              A manual quote sends the whole invoice to the team. Payment is not taken until they send the quote back.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
