import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contractorMarkupExample,
  contractorProcedureError,
  effectiveMarkupPercent,
  formatMarkupPercent,
  parseAffiliateMarkupPercent,
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
  const audience = affiliateUserId != null ? "admin" : "affiliate";
  const save = api.contractorAccess.setAffiliateMarkup.useMutation({
    onSuccess: (_result, input) => {
      setDraft(null);
      setError(null);
      toast.success(input.markupPercent == null ? "Using the site default markup." : "Contractor markup saved.");
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

  function submitMarkup(markupPercent: number | null) {
    setError(null);
    save.mutate(setAffiliateMarkupInput(markupPercent, affiliateUserId));
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3" data-testid="contractor-pricing">
      <div>
        <h2 className="text-xl font-bold">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {audience === "admin"
            ? "Set or clear this affiliate's markup over cost for their contractors."
            : "Set the markup you charge over CabinetDealz cost. Leave it unset to use the site default."}
        </p>
      </div>
      <div className="space-y-1 max-w-xs">
        <Label htmlFor={inputId}>Markup over cost (%)</Label>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={0}
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
      {parsed && !parsed.ok ? <p role="alert" className="text-sm text-destructive">{parsed.message}</p> : null}
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
    </section>
  );
}
