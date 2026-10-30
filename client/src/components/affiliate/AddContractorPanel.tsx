import { useRef, useState, type FormEvent } from "react";
import { HardHat } from "lucide-react";
import { toast } from "sonner";
import { ContractorApplicationFields } from "@/components/contractor/ContractorApplicationFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AFFILIATE_CONTRACTOR_DUPLICATE_MESSAGE,
  AFFILIATE_CONTRACTOR_SUCCESS_MESSAGE,
  contractorAccountLabel,
  contractorProcedureError,
  contractorRequestStatusLabel,
  formatContractorAccessDate,
  validateAffiliateContractorDraft,
  type AffiliateContractorDraft,
} from "@/lib/contractorAccessForm";
import { useContractorAccessProcedures } from "@/lib/contractorAccessProcedures";
import { ContractorPricingCard } from "@/components/affiliate/ContractorPricingCard";

const EMPTY_DRAFT: AffiliateContractorDraft = {
  contractorName: "",
  contractorEmail: "",
  businessName: "",
  phone: "",
  licenseNumber: "",
};

export function AddContractorPanel() {
  const api = useContractorAccessProcedures();
  const utils = api.useUtils();
  const requests = api.contractorAccess.myAffiliateRequests.useQuery(undefined, { retry: false });
  const [draft, setDraft] = useState<AffiliateContractorDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"contractorName" | "contractorEmail" | "businessName" | "phone" | null>(null);
  const [notice, setNotice] = useState<{ message: string; duplicate: boolean } | null>(null);
  const [reviewError, setReviewError] = useState<{ id: number; message: string } | null>(null);
  const reviewTarget = useRef(0);

  const submit = api.contractorAccess.submitForContractor.useMutation({
    onSuccess: (result) => {
      const message = result.duplicate ? AFFILIATE_CONTRACTOR_DUPLICATE_MESSAGE : AFFILIATE_CONTRACTOR_SUCCESS_MESSAGE;
      setDraft(EMPTY_DRAFT);
      setError(null);
      setErrorField(null);
      setNotice({ message, duplicate: result.duplicate });
      if (result.duplicate) toast.message(message);
      else toast.success(message);
      void utils.contractorAccess.myAffiliateRequests.invalidate();
    },
    onError: (mutationError) => {
      const message = mutationError.message || "Could not send this contractor request.";
      setNotice(null);
      setError(message);
      setErrorField(null);
      toast.error(message);
    },
  });

  const review = api.contractorAccess.affiliateReview.useMutation({
    onSuccess: (_result, input) => {
      setReviewError(null);
      toast.success(input.decision === "approved" ? "Contractor approved." : "Contractor rejected.");
      void requests.refetch();
      void utils.contractorAccess.myAffiliateRequests.invalidate();
    },
    onError: (mutationError) => {
      const message = contractorProcedureError(mutationError);
      setReviewError({ id: reviewTarget.current, message });
      toast.error(message);
    },
  });

  function update(field: keyof AffiliateContractorDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (notice) setNotice(null);
    if (error) {
      setError(null);
      setErrorField(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateAffiliateContractorDraft(draft);
    if (!parsed.ok) {
      setNotice(null);
      setError(parsed.message);
      setErrorField(parsed.field);
      return;
    }
    setError(null);
    setErrorField(null);
    submit.mutate(parsed.value);
  }

  const rows = requests.data ?? [];

  return (
    <div className="max-w-3xl space-y-8" data-testid="add-contractor-panel">
      <div>
        <h1 className="font-serif text-2xl font-bold">Add a contractor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Request contractor access for someone you work with. You approve it before they get contractor tools.
        </p>
      </div>

      <ContractorPricingCard />

      <form className="grid gap-3 rounded-xl border border-border bg-card p-5" onSubmit={onSubmit} noValidate>
        <p className="text-sm text-muted-foreground">
          The contractor keeps their own login. This request does not change your affiliate account.
        </p>
        <div className="space-y-1">
          <Label htmlFor="add-contractor-name">Contractor name</Label>
          <Input
            id="add-contractor-name"
            autoComplete="name"
            value={draft.contractorName}
            onChange={(event) => update("contractorName", event.target.value)}
            aria-invalid={errorField === "contractorName"}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="add-contractor-email">Contractor email</Label>
          <Input
            id="add-contractor-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={draft.contractorEmail}
            onChange={(event) => update("contractorEmail", event.target.value)}
            aria-invalid={errorField === "contractorEmail"}
            required
          />
        </div>
        <ContractorApplicationFields
          idPrefix="add-contractor"
          businessName={draft.businessName}
          phone={draft.phone}
          licenseNumber={draft.licenseNumber}
          onBusinessNameChange={(value) => update("businessName", value)}
          onPhoneChange={(value) => update("phone", value)}
          onLicenseNumberChange={(value) => update("licenseNumber", value)}
        />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {notice ? (
          <p role="status" className={notice.duplicate ? "text-sm text-amber-800" : "text-sm text-emerald-700 dark:text-emerald-400"}>{notice.message}</p>
        ) : null}
        <Button type="submit" className="w-fit bg-[var(--color-navy,#1a2b4a)] text-white" disabled={submit.isPending}>
          {submit.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <HardHat className="h-4 w-4 mr-2" />}
          Add a contractor
        </Button>
      </form>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">My contractor requests</h2>
          <p className="text-sm text-muted-foreground">Status, dates, and whether that contractor has an account yet.</p>
        </div>
        {requests.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
        {requests.error ? <p className="text-sm text-destructive">{requests.error.message}</p> : null}
        {!requests.isLoading && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">You have not requested a contractor yet.</p>
        ) : null}
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{row.contractorName}</h3>
              <Badge variant="outline">{contractorRequestStatusLabel(row.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.contractorEmail} · {row.businessName} · {row.phone}</p>
            {row.licenseNumber ? <p className="text-sm">License {row.licenseNumber}</p> : null}
            <p className="text-sm">Requested {formatContractorAccessDate(row.createdAt)}</p>
            <p className="text-sm">{row.reviewedAt ? `Reviewed ${formatContractorAccessDate(row.reviewedAt)}` : "Not reviewed yet"}</p>
            <p className="text-sm">{contractorAccountLabel(row.hasAccount)}</p>
            {row.status === "pending" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => {
                    reviewTarget.current = row.id;
                    setReviewError(null);
                    review.mutate({ id: row.id, decision: "approved" });
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => {
                    reviewTarget.current = row.id;
                    setReviewError(null);
                    review.mutate({ id: row.id, decision: "rejected" });
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : null}
            {reviewError?.id === row.id ? <p role="alert" className="text-sm text-destructive">{reviewError.message}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
