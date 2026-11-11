import { useState } from "react";
import { AFFILIATE_AGREEMENT_DRAFT_BANNER, buildAffiliateAgreementText } from "@shared/affiliateAgreement";

export default function AffiliateAgreementPanel({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  const text = buildAffiliateAgreementText(version);
  return (
    <div className="rounded-xl border border-border p-4" data-testid="affiliate-agreement-panel">
      <p className="text-sm font-semibold text-amber-800">{AFFILIATE_AGREEMENT_DRAFT_BANNER}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Read the Affiliate Agreement before you pay. It is a separate document from the website Terms &amp; Conditions and from any warranty.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide the agreement" : "Show the full agreement"}
        </button>
        <a className="font-semibold underline underline-offset-4" href="/affiliate-agreement">
          Open the agreement page
        </a>
      </div>
      {open && (
        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed" data-testid="affiliate-agreement-text">
          {text}
        </pre>
      )}
    </div>
  );
}
