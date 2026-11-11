import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildSalesRepAgreementText, SALES_REP_AGREEMENT_VERSION } from "@shared/salesRepAgreement";
import { repFeeCheckoutAvailable, defaultCommissionSettings, SALES_REP_FEE_TODO } from "@shared/salesRepCommission";
import { useMembershipProgramProcedures } from "@/lib/membershipProgramProcedures";

export default function SalesRepApply() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", state: "FL", businessName: "" });
  const [accepted, setAccepted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const api = useMembershipProgramProcedures();
  const settings = api.salesRepProgram.commissionSettings.useQuery(undefined, { retry: false });
  const fee = settings.data ?? defaultCommissionSettings();
  const apply = api.salesRepProgram.apply.useMutation({
    onSuccess: () => setSent(true),
    onError: (error) => toast.error(error.message || "The application could not be sent."),
  });

  if (sent) {
    return (
      <div className="container max-w-2xl py-16">
        <h1 className="font-serif text-3xl font-bold">Application received</h1>
        <p className="mt-4 text-muted-foreground">
          An admin has to approve you before you count as a sales rep. After approval, finish Job Boarding: your information, the non-compete, Form W-9, and a government ID. That packet is the salesperson onboarding flow. This page does not collect a tax id.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-12 space-y-6">
      <div>
        <h1 className="font-serif text-4xl font-bold">Become an authorized sales rep</h1>
        <p className="mt-3 text-muted-foreground">
          Sales reps are 1099 independent contractors, not employees of Cabinet Dealz. Approval is required. Reps for this program are expected in Florida and Wisconsin.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!accepted) {
            toast.error("Read and accept the Sales Rep Agreement before submitting.");
            return;
          }
          apply.mutate({
            ...form,
            agreementVersion: `sales-rep-agreement@${SALES_REP_AGREEMENT_VERSION}`,
            agreementAcceptedAt: new Date().toISOString(),
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="rep-name">Full name</Label>
          <Input id="rep-name" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-email">Email</Label>
          <Input id="rep-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-phone">Phone</Label>
          <Input id="rep-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-state">State</Label>
          <select id="rep-state" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}>
            <option value="FL">Florida</option>
            <option value="WI">Wisconsin</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-business">Business name</Label>
          <Input id="rep-business" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{SALES_REP_FEE_TODO}</p>
          {repFeeCheckoutAvailable(fee) ? (
            <p className="mt-2">A rep fee checkout is on for ${fee.repFeeUsd}. It is still a separate step from this application.</p>
          ) : (
            <p className="mt-2">Rep fee checkout is off. No card is charged on this page.</p>
          )}
        </div>
        <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide the Sales Rep Agreement" : "Show the Sales Rep Agreement"}
        </button>
        {open && <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{buildSalesRepAgreementText()}</pre>}
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
          <span>I agree to the Sales Rep Agreement (sales-rep-agreement@{SALES_REP_AGREEMENT_VERSION}).</span>
        </label>
        <Button type="submit" className="bg-[var(--color-navy)] text-white" disabled={apply.isPending || !accepted}>
          {apply.isPending ? "Sending…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}
