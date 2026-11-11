import { AFFILIATE_OPERATOR_NOTICE } from "@shared/affiliateOperatorNotice";

/** Plain notice. It is not the website Terms & Conditions and it is not a warranty. */
export default function AffiliateOperatorNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "rounded-lg border border-border bg-muted/40 p-4 text-sm" : "rounded-xl border border-border bg-muted/40 p-5"} data-testid="affiliate-operator-notice">
      <p className="font-semibold">Before you pay</p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>{AFFILIATE_OPERATOR_NOTICE.independent}</li>
        <li>{AFFILIATE_OPERATOR_NOTICE.paidOnCompletion}</li>
      </ul>
    </aside>
  );
}
