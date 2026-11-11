import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { portalSignInHref } from "@/lib/portalSignIn";
import { membershipPlanChoices, formatPlanPrice } from "@shared/affiliateMembershipPlans";
import {
  AFFILIATE_AGREEMENT_VERSION,
  affiliateAgreementVersionLabel,
  checkoutAcknowledgementsValid,
} from "@shared/affiliateAgreement";
import { AFFILIATE_OPERATOR_NOTICE } from "@shared/affiliateOperatorNotice";
import AffiliateAgreementPanel from "@/components/affiliate/AffiliateAgreementPanel";
import AffiliateOperatorNotice from "@/components/affiliate/AffiliateOperatorNotice";
import { useMembershipProgramProcedures } from "@/lib/membershipProgramProcedures";

const NONE = "none";

export default function AffiliateMembershipCheckout() {
  const { isAuthenticated, loading } = useAuth();
  const plans = membershipPlanChoices();
  const [plan, setPlan] = useState<"monthly" | "annual">(plans[0]?.id ?? "monthly");
  const [operatorAccepted, setOperatorAccepted] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [repId, setRepId] = useState(NONE);
  const api = useMembershipProgramProcedures();
  const reps = api.salesRepProgram.approvedReps.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const publishedAgreement = api.legalPages.published.useQuery({ slug: "affiliate-agreement" }, { retry: false });
  const version = publishedAgreement.data?.versionLabel
    ?? affiliateAgreementVersionLabel(AFFILIATE_AGREEMENT_VERSION);
  const agreementBody = publishedAgreement.data?.render === "text" ? publishedAgreement.data.bodyText : null;
  const checkout = api.affiliateMembership.startCheckout.useMutation({
    onSuccess: (result) => {
      window.location.assign(result.url);
    },
    onError: (error) => toast.error(error.message || "Stripe checkout could not start."),
  });

  const signInHref = portalSignInHref({
    portal: "affiliate",
    pathname: "/affiliate/membership",
    search: "",
    storedRef: null,
  });

  function pay() {
    const acknowledged = checkoutAcknowledgementsValid({
      operatorNoticeAccepted: operatorAccepted,
      operatorNoticeAcceptedAt: operatorAccepted ? new Date().toISOString() : null,
      agreementAccepted,
      agreementAcceptedAt: agreementAccepted ? new Date().toISOString() : null,
      agreementVersion: version,
    });
    if (!acknowledged.ok) {
      toast.error(acknowledged.message);
      return;
    }
    checkout.mutate({
      plan,
      salesRepUserId: repId === NONE ? null : Number(repId),
      operatorNoticeAcceptedAt: acknowledged.operatorNoticeAcceptedAt,
      agreementAcceptedAt: acknowledged.agreementAcceptedAt,
      agreementVersion: acknowledged.agreementVersion,
    });
  }

  return (
    <div className="container max-w-3xl py-12 space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Affiliate membership</p>
        <h1 className="font-serif text-4xl font-bold mt-1">Choose a plan and pay by card</h1>
        <p className="mt-3 text-muted-foreground">
          Applying at <Link href="/pro-network" className="underline underline-offset-4">Join Our Pro Network</Link> stays free.
          This page is only the membership payment. Your shopping cart and quote requests are not part of this charge.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" data-testid="membership-plan-picker">
        {plans.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPlan(option.id)}
            className={`rounded-xl border p-5 text-left ${plan === option.id ? "border-[var(--color-navy)] bg-muted/40" : "border-border"}`}
          >
            <div className="text-sm font-semibold">{option.label}</div>
            <div className="mt-1 font-serif text-3xl font-bold">{formatPlanPrice(option.id)}</div>
            <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
          </button>
        ))}
      </div>

      <AffiliateOperatorNotice />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={operatorAccepted} onCheckedChange={(value) => setOperatorAccepted(value === true)} />
        <span>
          I understand both of these: {AFFILIATE_OPERATOR_NOTICE.independent} {AFFILIATE_OPERATOR_NOTICE.paidOnCompletion}
        </span>
      </label>

      <AffiliateAgreementPanel version={version} body={agreementBody} />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={agreementAccepted} onCheckedChange={(value) => setAgreementAccepted(value === true)} />
        <span>I have read the Affiliate Agreement ({version}) and I agree to it.</span>
      </label>

      <div className="space-y-2">
        <Label>Sales rep who sold this account</Label>
        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger aria-label="Sales rep">
            <SelectValue placeholder="No sales rep" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No sales rep</SelectItem>
            {(reps.data ?? []).map((rep) => (
              <SelectItem key={rep.userId} value={String(rep.userId)}>
                {rep.name}{rep.state ? ` (${rep.state})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Only approved sales reps are listed. The rep is saved on this payment.</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Card payment opens Stripe in test mode. Cabinet Dealz does not see the card number. Live membership charges stay off until Tom turns them on.
      </p>

      {loading ? null : !isAuthenticated ? (
        <Button asChild className="bg-[var(--color-navy)] text-white">
          <a href={signInHref}>Sign in to pay</a>
        </Button>
      ) : (
        <Button className="bg-[var(--color-navy)] text-white gap-2" onClick={pay} disabled={checkout.isPending || !operatorAccepted || !agreementAccepted}>
          {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {checkout.isPending ? "Opening Stripe…" : "Pay membership"}
        </Button>
      )}
    </div>
  );
}
