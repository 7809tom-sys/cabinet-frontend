import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  belowContractorFloorMessage,
  contractorFloorNote,
  contractorMarkupExample,
  contractorProcedureError,
  effectiveMarkupPercent,
  formatMarkupPercent,
  parseAffiliateMarkupPercent,
  parseOverrideMultiplier,
} from "@/lib/contractorAccessForm";
import { useContractorAccessProcedures } from "@/lib/contractorAccessProcedures";
import { affiliateMarkupQuery, setAffiliateMarkupInput } from "@/lib/contractorScope";

export function ContractorPricingCard({
  affiliateUserId,
  idPrefix = "contractor-markup",
  heading = "Contractor pricing",
}: {
  affiliateUserId?: number;
  idPrefix?: string;
  heading?: string;
}) {
  const api = useContractorAccessProcedures();
  const utils = api.useUtils();
  const markup = api.contractorAccess.affiliateMarkup.useQuery(affiliateMarkupQuery(affiliateUserId), { retry: false });
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const audience = affiliateUserId != null ? "admin" : "affiliate";
  const save = api.contractorAccess.setAffiliateMarkup.useMutation({
    onSuccess: (_result, input) => {
      setDraft(null);
      setError(null);
      setOverrideDraft(null);
      setOverrideReason("");
      toast.success(input.adminOverrideMultiplier !== undefined
        ? (input.adminOverrideMultiplier == null ? "Override cleared. Cost × 1.38 applies." : "Contractor override saved.")
        : input.markupPercent == null ? "Using the site default markup." : "Contractor markup saved.");
      void utils.contractorAccess.affiliateMarkup.invalidate();
    },
    onError: (mutationError) => {
      const message = contractorProcedureError(mutationError);
      setError(message);
      toast.error(message);
    },
  });

  if (markup.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading contractor pricing…</p>;
  }
  if (markup.error || !markup.data) {
    return (
      <section className="rounded-xl border border-border bg-card p-5" data-testid="contractor-pricing">
        <h2 className="text-xl font-bold">{heading}</h2>
        <p role="alert" className="mt-2 text-sm text-destructive">{contractorProcedureError(markup.error)}</p>
      </section>
    );
  }

  const value = draft ?? (markup.data.markupPercent == null ? "" : formatMarkupPercent(markup.data.markupPercent));
  const effective = effectiveMarkupPercent(value, markup.data.siteDefaultPercent);
  const parsed = value.trim() ? parseAffiliateMarkupPercent(value) : null;
  const inputId = `${idPrefix}-percent`;
  const overrideId = `${idPrefix}-override`;
  const minMarkupPercent = markup.data.minMarkupPercent ?? null;
  const floorWarning = parsed && parsed.ok ? belowContractorFloorMessage(parsed.value, minMarkupPercent) : null;
  const overrideValue = overrideDraft ?? (markup.data.adminOverrideMultiplier != null ? markup.data.adminOverrideMultiplier.toFixed(2) : "");

  function submitMarkup(markupPercent: number | null) {
    setError(null);
    save.mutate(setAffiliateMarkupInput(markupPercent, affiliateUserId));
  }

  /** Admin only: keep the saved markup, change only the store's floor override. */
  function submitOverride(multiplier: number | null) {
    setError(null);
    save.mutate(setAffiliateMarkupInput(markup.data?.markupPercent ?? null, affiliateUserId, { multiplier, reason: overrideReason }));
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3" data-testid="contractor-pricing">
      <div>
        <h2 className="text-xl font-bold">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {audience === "admin"
            ? "Set or clear this affiliate's markup over their cost (what they pay Cabinet Dealz) for their contractors."
            : "Set the markup you charge contractors over your cost (what you pay Cabinet Dealz). Leave it unset to use the site default."}
        </p>
      </div>
      <div className="space-y-1 max-w-xs">
        <Label htmlFor={inputId}>{audience === "admin" ? "Markup over their cost (%)" : "Markup over your cost (%)"}</Label>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={minMarkupPercent ?? 0}
          max={200}
          step="0.01"
          value={value}
          disabled={save.isPending}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
        />
        {value.trim() === "" ? (
          <p className="text-xs text-muted-foreground">Site default is {formatMarkupPercent(markup.data.siteDefaultPercent)}%.</p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="contractor-floor-note">{contractorFloorNote(markup.data, audience)}</p>
      {parsed && !parsed.ok ? <p role="alert" className="text-sm text-destructive">{parsed.message}</p> : null}
      {floorWarning ? <p role="alert" className="text-sm text-destructive">{floorWarning}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {effective != null ? (
        <p className="text-sm" data-testid="contractor-markup-example">{contractorMarkupExample(effective, audience)}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            const next = parseAffiliateMarkupPercent(value);
            if (!next.ok) {
              setError(next.message);
              return;
            }
            submitMarkup(next.value);
          }}
        >
          Save
        </Button>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={() => submitMarkup(null)}>
          Use site default
        </Button>
      </div>
      {audience === "admin" ? (
        <div className="space-y-2 border-t border-border pt-3" data-testid="contractor-override">
          <Label htmlFor={overrideId}>Admin override: lowest contractor price (× Cabinet Dealz cost)</Label>
          <p className="text-xs text-muted-foreground">
            Only Cabinet Dealz admins can go below cost × 1.38. The override can never go below cost × 1.15. Leave it clear to keep 1.38.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={overrideId}
              className="max-w-[8rem]"
              type="number"
              inputMode="decimal"
              min={1.15}
              max={1.38}
              step="0.01"
              placeholder="1.38"
              value={overrideValue}
              disabled={save.isPending}
              onChange={(event) => {
                setOverrideDraft(event.target.value);
                if (error) setError(null);
              }}
            />
            <Input
              className="max-w-xs"
              placeholder="Reason (optional)"
              maxLength={500}
              value={overrideReason}
              disabled={save.isPending}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => {
                const next = parseOverrideMultiplier(overrideValue);
                if (!next.ok) {
                  setError(next.message);
                  return;
                }
                submitOverride(next.value);
              }}
            >
              Save override
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending || markup.data.adminOverrideMultiplier == null}
              onClick={() => submitOverride(null)}
            >
              Clear override
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
