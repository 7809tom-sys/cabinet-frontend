import { Badge } from "@/components/ui/badge";
import type { AffiliateTierDashboard } from "@shared/affiliatePricingTier";

export function AffiliateTierCard({ tier }: { tier: AffiliateTierDashboard | null | undefined }) {
  const assigned = tier?.assigned === true && tier.tierName;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2" data-testid="affiliate-tier-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Your pricing tier</h2>
        {tier?.examplePlaceholder && <Badge variant="outline">Example placeholder</Badge>}
        {tier?.inactive && <Badge variant="secondary">Inactive</Badge>}
      </div>
      {assigned ? (
        <>
          <p className="font-serif text-2xl font-bold">{tier.tierName}</p>
          <p className="text-sm text-muted-foreground">{tier.summary}</p>
          {tier.volumeLabel && (
            <p className="text-sm text-muted-foreground">Volume threshold: {tier.volumeLabel}</p>
          )}
          {tier.examplePlaceholder && (
            <p className="text-sm text-amber-800">
              This tier is still an example. An administrator needs to set the real multiplier or discount before it represents a live buy price.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {tier?.summary ?? "No pricing tier assigned. Cabinet cost uses the platform affiliate markup until an administrator assigns a tier."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Your customer prices still add your own markup on top of this cost. Flooring and appliances use the 40/60 markup split instead of this cabinet tier.
      </p>
    </div>
  );
}
