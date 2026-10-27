import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  validateVendorReferral,
  type VendorReferralDraft,
  type VendorReferralSubmitInput,
} from "@/lib/vendorReferralForm";

const EMPTY_DRAFT: VendorReferralDraft = {
  vendorName: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

// `vendorReferrals` ships in the paired cabinet-backend PR. Cast until AppRouter includes it.
function useVendorReferralApi() {
  return trpc as unknown as {
    vendorReferrals: {
      submit: {
        useMutation: (options?: {
          onSuccess?: (result: { id: number }) => void;
          onError?: (error: { message: string }) => void;
        }) => {
          mutate: (input: VendorReferralSubmitInput) => void;
          isPending: boolean;
        };
      };
    };
  };
}

export function ReferVendorForm() {
  const api = useVendorReferralApi();
  const [draft, setDraft] = useState<VendorReferralDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"vendorName" | "email" | "contact" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = api.vendorReferrals.submit.useMutation({
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      setError(null);
      setErrorField(null);
      setSuccess("Thanks. We received this vendor referral.");
      toast.success("Thanks. We received this vendor referral.");
    },
    onError: (mutationError) => {
      const message = mutationError.message || "Could not send this referral. Try again.";
      setSuccess(null);
      setError(message);
      setErrorField(null);
      toast.error(message);
    },
  });

  function update(field: keyof VendorReferralDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (success) setSuccess(null);
    if (error) {
      setError(null);
      setErrorField(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateVendorReferral(draft);
    if (!parsed.ok) {
      setSuccess(null);
      setError(parsed.message);
      setErrorField(parsed.field);
      return;
    }
    setError(null);
    setErrorField(null);
    submit.mutate(parsed.value);
  }

  const contactInvalid = errorField === "contact" || errorField === "email";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-xl border border-border bg-card p-5 space-y-4"
      data-testid="refer-vendor-form"
    >
      <div className="space-y-1">
        <h2 className="font-semibold">Please refer vendors to us.</h2>
        <p className="text-sm text-muted-foreground">
          Refer a vendor. Include an email, a phone number, or both.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="refer-vendor-name">
            Vendor name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="refer-vendor-name"
            name="vendorName"
            autoComplete="organization"
            required
            aria-required="true"
            aria-invalid={errorField === "vendorName"}
            value={draft.vendorName}
            onChange={(event) => update("vendorName", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refer-vendor-contact">Contact name</Label>
          <Input
            id="refer-vendor-contact"
            name="contactName"
            autoComplete="name"
            value={draft.contactName}
            onChange={(event) => update("contactName", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refer-vendor-email">Email</Label>
          <Input
            id="refer-vendor-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={contactInvalid}
            value={draft.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refer-vendor-phone">Phone</Label>
          <Input
            id="refer-vendor-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={errorField === "contact"}
            value={draft.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="refer-vendor-notes">Notes</Label>
          <Textarea
            id="refer-vendor-notes"
            name="notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </p>
      )}

      <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submit.isPending ? "Sending…" : "Send referral"}
      </Button>
    </form>
  );
}
