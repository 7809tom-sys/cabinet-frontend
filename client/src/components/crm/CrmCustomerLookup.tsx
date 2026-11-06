import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CUSTOMER_IDENTIFIER_HINT,
  CUSTOMER_LOOKUP_COPY,
  parseCustomerIdentifier,
} from "@shared/crmCustomerLookup";
import { CustomerLinkedDesigns } from "@/components/crm/CustomerLinkedDesigns";
import { lookupHeading, useCustomerLookup, type CustomerLookupResult } from "@/lib/crmCustomerLookupProcedures";

/**
 * Staff quick lookup. A customer phones in, staff type the customer number (or
 * paste the CRM link) and either land in their plan straight away or see just
 * that customer's linked designs to pick from. There is no browse-all step: the
 * number is matched on the deal row, so a customer with no linked design gets a
 * plain "no design linked" instead of the whole account.
 */
export function CrmCustomerLookup({
  enabled = true,
  onOpen,
  openInNewTab = false,
  previewResult = null,
}: {
  enabled?: boolean;
  /** Called with the designer URL. Default navigates the current tab. */
  onOpen?: (url: string) => void;
  openInNewTab?: boolean;
  /**
   * Dev preview only: answer a lookup without the server, so the three states can
   * be rendered and screenshotted. Never passed by the CRM.
   */
  previewResult?: ((dealId: number) => CustomerLookupResult | null) | null;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  // The URL already opened, so remounting or refetching cannot navigate twice.
  const openedRef = useRef<string | null>(null);
  const parsed = submitted != null ? parseCustomerIdentifier(submitted) : null;
  const lookup = useCustomerLookup();
  const live = lookup.useQuery(
    { identifier: submitted ?? "" },
    { enabled: enabled && previewResult == null && submitted != null && parsed?.dealId != null, retry: false, refetchOnWindowFocus: false },
  );
  const preview = previewResult != null && parsed?.dealId != null ? previewResult(parsed.dealId) : null;
  const query = previewResult != null
    ? { data: preview ?? undefined, isFetching: false, error: null }
    : live;

  const open = (url: string) => {
    if (onOpen) {
      onOpen(url);
      return;
    }
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(url);
  };

  const result = query.data;
  const autoOpenUrl = result?.ok && result.outcome === "one" ? result.openUrl : null;
  // One linked design: nobody should have to confirm what is already unambiguous.
  useEffect(() => {
    if (!autoOpenUrl) return;
    if (openedRef.current === autoOpenUrl) return;
    openedRef.current = autoOpenUrl;
    open(autoOpenUrl);
    // `open` is stable for a given render; the dependency is the URL itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenUrl]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = text.trim();
    if (!next) return;
    setSubmitted(next);
  };

  const reset = () => {
    setText("");
    setSubmitted(null);
  };

  const invalid = submitted != null && parsed?.dealId == null;

  return (
    <div className="rounded-lg border border-border bg-card p-3" data-testid="crm-customer-lookup">
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <label className="min-w-40 flex-1 text-xs font-semibold text-muted-foreground">
          Find a customer
          <Input
            className="mt-1 h-9"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={CUSTOMER_IDENTIFIER_HINT}
            aria-label="Customer number"
            inputMode="numeric"
            data-testid="crm-customer-lookup-input"
          />
        </label>
        <Button type="submit" size="sm" className="h-9" disabled={!enabled || !text.trim() || query.isFetching} data-testid="crm-customer-lookup-submit">
          <Search className="mr-1 h-4 w-4" />Open design
        </Button>
        {submitted != null ? (
          <Button type="button" size="sm" variant="ghost" className="h-9" onClick={reset} aria-label="Clear lookup">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </form>
      {submitted == null ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{CUSTOMER_LOOKUP_COPY.prompt}</p>
      ) : invalid ? (
        <p className="mt-2 text-xs text-destructive" data-testid="crm-customer-lookup-invalid">{CUSTOMER_LOOKUP_COPY.notAnIdentifier}</p>
      ) : query.isFetching ? (
        <p className="mt-2 text-xs text-muted-foreground">Looking up customer {parsed?.dealId}…</p>
      ) : query.error ? (
        <p className="mt-2 text-xs text-destructive" data-testid="crm-customer-lookup-error">
          The lookup is not available on this server yet.
        </p>
      ) : result ? (
        <LookupResult result={result} onOpen={open} />
      ) : null}
    </div>
  );
}

function LookupResult({ result, onOpen }: { result: CustomerLookupResult; onOpen: (url: string) => void }) {
  if (!result.ok) {
    return (
      <div className="mt-2 space-y-1" data-testid="crm-customer-lookup-miss">
        <p className="text-xs text-muted-foreground">{CUSTOMER_LOOKUP_COPY.notFound} (#{result.dealId ?? result.identifier})</p>
      </div>
    );
  }
  if (result.outcome === "none") {
    return (
      <div className="mt-2 space-y-1" data-testid="crm-customer-lookup-empty">
        <p className="text-xs font-medium">{lookupHeading(result)}</p>
        <p className="text-xs text-muted-foreground">{CUSTOMER_LOOKUP_COPY.none}</p>
        <p className="text-[11px] text-muted-foreground">{CUSTOMER_LOOKUP_COPY.noneHint}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2" data-testid="crm-customer-lookup-hit" data-outcome={result.outcome}>
      <p className="text-xs font-medium">
        {lookupHeading(result)}
        {result.contactEmail ? <span className="font-normal text-muted-foreground"> · {result.contactEmail}</span> : null}
      </p>
      {result.outcome === "several" ? <p className="text-xs text-muted-foreground">{CUSTOMER_LOOKUP_COPY.several}</p> : null}
      <CustomerLinkedDesigns
        designs={result.designs.map((design) => ({
          id: design.id,
          name: design.name,
          thumbnailUrl: design.thumbnailUrl,
          assistLabel: design.assistLabel,
          linkKind: design.linkKind,
          // "Open this design" is the only link here; it routes through `onOpen`
          // so the CRM can open in place (or a new tab) instead of navigating.
          href: null,
        }))}
        showLinkNote={false}
        showLinkSource
        testId="crm-customer-lookup-designs"
        actions={(design) => (
          <button
            type="button"
            className="text-xs font-semibold text-primary underline"
            onClick={() => onOpen(result.designs.find((row) => row.id === design.id)!.designUrl)}
            data-testid={`crm-customer-lookup-open-${design.id}`}
          >
            {result.outcome === "one" ? "Open their design" : "Open this design"}
          </button>
        )}
      />
    </div>
  );
}
