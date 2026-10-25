// AffiliatePayoutSetup.tsx
// Full 1099-NEC independent contractor payout onboarding flow.
// Steps: 1) W-9 (link to tax tab) 2) Bank/ACH info 3) ID documents 4) E-signature consent
// Business rule: ID documents can only be REPLACED, never deleted standalone.

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2, Circle, AlertCircle, Lock, Upload, Eye, EyeOff,
  Building2, CreditCard, FileText, PenLine, ShieldCheck, Info,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

type Props = { affiliateId: number; storeName: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function StepIndicator({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${active ? "border-[var(--color-gold)] bg-[var(--color-gold)]/5" : done ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? "bg-green-500 text-white" : active ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span className={`text-sm font-medium ${active ? "text-foreground" : done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

// ─── Bank Info Form ────────────────────────────────────────────────────────────
function BankInfoForm({ onSaved }: { onSaved: () => void }) {
  const [bankName, setBankName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [showAccount, setShowAccount] = useState(false);

  const saveMut = trpc.affiliates.savePayoutBankInfo.useMutation({
    onSuccess: (d) => {
      toast.success(`Bank info saved. Account ending in ${d.maskedAccount.slice(-4)}.`);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{9}$/.test(routing)) { toast.error("Routing number must be exactly 9 digits."); return; }
    if (account.length < 4) { toast.error("Account number must be at least 4 digits."); return; }
    saveMut.mutate({ bankName, bankRoutingNumber: routing, bankAccountNumber: account, bankAccountType: accountType });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Your banking information is stored securely and used only for ACH direct deposit of your commissions. This information is visible only to Cabinet Dealz administrators.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Chase, Bank of America" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="routing">Routing Number (9 digits)</Label>
          <Input id="routing" value={routing} onChange={e => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="123456789" required className="mt-1 font-mono" />
        </div>
        <div>
          <Label htmlFor="account">Account Number</Label>
          <div className="relative mt-1">
            <Input
              id="account"
              type={showAccount ? "text" : "password"}
              value={account}
              onChange={e => setAccount(e.target.value.replace(/\D/g, ""))}
              placeholder="Account number"
              required
              className="pr-10 font-mono"
            />
            <button type="button" onClick={() => setShowAccount(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="accountType">Account Type</Label>
          <Select value={accountType} onValueChange={v => setAccountType(v as "checking" | "savings")}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={saveMut.isPending} className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90 text-white">
        {saveMut.isPending ? <><Spinner className="h-4 w-4 mr-2" />Saving…</> : "Save Bank Information"}
      </Button>
    </form>
  );
}

// ─── ID Document Upload ────────────────────────────────────────────────────────
type DocType = "ssn_card" | "dl_front" | "dl_back";
function IdDocUpload({ docType, label, uploaded, onUploaded }: { docType: DocType; label: string; uploaded: boolean; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const uploadMut = trpc.affiliates.uploadPayoutIdDoc.useMutation({
    onSuccess: () => {
      toast.success(`${label} uploaded successfully.`);
      setReplacing(false);
      onUploaded();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or PDF file."); return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    const base64 = await fileToBase64(file);
    uploadMut.mutate({ docType, fileBase64: base64, mimeType: file.type });
  }

  const showUploadArea = !uploaded || replacing;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {uploaded && !replacing ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {uploaded && !replacing && (
          <Button variant="outline" size="sm" onClick={() => setReplacing(true)} className="text-xs h-7">
            Replace
          </Button>
        )}
      </div>

      {showUploadArea && (
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFile} />
          {preview ? (
            <div className="relative rounded border overflow-hidden h-32">
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
              {uploadMut.isPending && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Spinner className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploadMut.isPending}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-[var(--color-gold)] hover:text-foreground transition-colors"
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm">Click to upload {label}</span>
              <span className="text-xs">JPG, PNG, WebP or PDF · Max 10 MB</span>
            </button>
          )}
          {replacing && (
            <Button variant="ghost" size="sm" onClick={() => { setReplacing(false); setPreview(null); }} className="mt-2 text-xs">
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── E-Signature Consent ───────────────────────────────────────────────────────
function ConsentForm({ onSigned }: { onSigned: () => void }) {
  const [legalName, setLegalName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const signMut = trpc.affiliates.signPayoutConsent.useMutation({
    onSuccess: () => {
      toast.success("Consent signed. Your payout setup is complete pending admin review.");
      onSigned();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed space-y-2">
        <p className="font-semibold">Independent Contractor Acknowledgment & 1099-NEC Consent</p>
        <p>By signing below, I acknowledge and agree that:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>I am an independent contractor, not an employee of Cabinet Dealz.</li>
          <li>I am responsible for paying all applicable federal, state, and local taxes on my commission income.</li>
          <li>Cabinet Dealz will issue a Form 1099-NEC for any calendar year in which my total commissions equal or exceed $600.</li>
          <li>The banking and identity information I have provided is accurate and belongs to me.</li>
          <li>I consent to receiving my 1099-NEC electronically via my affiliate dashboard.</li>
        </ul>
      </div>

      <div>
        <Label htmlFor="legalName">Type your full legal name to sign</Label>
        <Input
          id="legalName"
          value={legalName}
          onChange={e => setLegalName(e.target.value)}
          placeholder="Your full legal name"
          className="mt-1 font-medium"
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox id="agree" checked={agreed} onCheckedChange={v => setAgreed(!!v)} className="mt-0.5" />
        <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
          I have read and agree to the Independent Contractor Acknowledgment above. I understand that typing my name constitutes a legally binding electronic signature.
        </Label>
      </div>

      <Button
        onClick={() => signMut.mutate({ legalName })}
        disabled={!agreed || legalName.trim().length < 2 || signMut.isPending}
        className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90 text-white"
      >
        {signMut.isPending ? <><Spinner className="h-4 w-4 mr-2" />Signing…</> : <><PenLine className="h-4 w-4 mr-2" />Sign & Submit</>}
      </Button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AffiliatePayoutSetup({ storeName }: Props) {
  const statusQ = trpc.affiliates.getPayoutSetupStatus.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();

  function refetch() { utils.affiliates.getPayoutSetupStatus.invalidate(); }

  if (statusQ.isLoading) {
    return <div className="flex items-center justify-center py-16"><Spinner className="h-7 w-7" /></div>;
  }

  const s = statusQ.data;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Payout Setup</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Complete all four steps to unlock commission payouts. Your information is reviewed by our team within 1–2 business days.
        </p>
      </div>

      {/* Payout ready banner */}
      {s?.payoutReady && (
        <div className="rounded-xl border border-green-500/40 bg-green-50 dark:bg-green-950/20 p-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-300">Payout Setup Complete</p>
            <p className="text-sm text-green-700 dark:text-green-400">Your account is verified and commissions will be paid via ACH direct deposit.</p>
          </div>
        </div>
      )}

      {/* Progress checklist */}
      <div className="grid gap-2 sm:grid-cols-2">
        <StepIndicator step={1} label="Tax Info (W-9)" done={!!s?.w9Done} active={!s?.w9Done} />
        <StepIndicator step={2} label="Bank / ACH Info" done={!!s?.bankDone} active={!!s?.w9Done && !s?.bankDone} />
        <StepIndicator step={3} label="Identity Documents" done={!!s?.idDone} active={!!s?.bankDone && !s?.idDone} />
        <StepIndicator step={4} label="E-Signature Consent" done={!!s?.consentSigned} active={!!s?.idDone && !s?.consentSigned} />
      </div>

      <Accordion type="multiple" defaultValue={["bank", "id", "consent"]} className="space-y-3">
        {/* Step 1: W-9 */}
        <AccordionItem value="w9" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s?.w9Done ? "bg-green-500" : "bg-muted"}`}>
                {s?.w9Done ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-muted-foreground">1</span>}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Tax Info (W-9)</p>
                <p className="text-xs text-muted-foreground">{s?.w9Done ? "Verified" : "Required for 1099-NEC reporting"}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {s?.w9Done ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" /> W-9 verified. No action needed.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Please complete your W-9 tax information in the Tax Info tab first.</p>
                <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("affiliate-nav", { detail: "tax" }))}>
                  <FileText className="h-4 w-4 mr-2" /> Go to Tax Info (W-9)
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Step 2: Bank Info */}
        <AccordionItem value="bank" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s?.bankDone ? "bg-green-500" : "bg-muted"}`}>
                {s?.bankDone ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-muted-foreground">2</span>}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Bank / ACH Information</p>
                <p className="text-xs text-muted-foreground">
                  {s?.bankDone
                    ? `${s.bankName ?? "Bank"} · ${s.maskedAccountNumber ?? "****"} · ${s.bankAccountType ?? ""}`
                    : "Routing number, account number, account type"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {s?.bankDone ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Bank account verified by Cabinet Dealz.
                </div>
                <p className="text-xs text-muted-foreground">To update your bank info, submit new information below. This will reset verification and require admin re-approval.</p>
                <BankInfoForm onSaved={refetch} />
              </div>
            ) : (
              <BankInfoForm onSaved={refetch} />
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Step 3: ID Documents */}
        <AccordionItem value="id" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s?.idDone ? "bg-green-500" : "bg-muted"}`}>
                {s?.idDone ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-muted-foreground">3</span>}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Identity Documents</p>
                <p className="text-xs text-muted-foreground">
                  {s?.idDone ? "Verified" : `${[s?.ssnCardUploaded && "SSN card", s?.dlFrontUploaded && "DL front", s?.dlBackUploaded && "DL back"].filter(Boolean).join(", ") || "No documents uploaded yet"}`}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <div className="rounded-lg border border-blue-300/50 bg-blue-50 dark:bg-blue-950/20 p-3 flex gap-2 text-sm text-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Upload your Social Security card and both sides of your driver's license. Documents are stored securely and are only accessible to Cabinet Dealz administrators for verification. <strong>Documents can be replaced but not deleted.</strong></span>
            </div>
            {s?.idDone && (
              <div className="rounded-lg border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Identity verified by Cabinet Dealz.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-1">
              <IdDocUpload docType="ssn_card" label="Social Security Card (front)" uploaded={!!s?.ssnCardUploaded} onUploaded={refetch} />
              <IdDocUpload docType="dl_front" label="Driver's License (front)" uploaded={!!s?.dlFrontUploaded} onUploaded={refetch} />
              <IdDocUpload docType="dl_back" label="Driver's License (back)" uploaded={!!s?.dlBackUploaded} onUploaded={refetch} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 4: E-Signature */}
        <AccordionItem value="consent" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s?.consentSigned ? "bg-green-500" : "bg-muted"}`}>
                {s?.consentSigned ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-muted-foreground">4</span>}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">E-Signature & 1099-NEC Consent</p>
                <p className="text-xs text-muted-foreground">
                  {s?.consentSigned
                    ? `Signed as "${s.payoutConsentName}" on ${s.payoutConsentSignedAt ? new Date(s.payoutConsentSignedAt).toLocaleDateString() : "—"}`
                    : "Independent contractor acknowledgment"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {s?.consentSigned ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Signed as <strong className="mx-1">"{s.payoutConsentName}"</strong>
                {s.payoutConsentSignedAt && ` on ${new Date(s.payoutConsentSignedAt).toLocaleDateString()}`}.
              </div>
            ) : (
              <ConsentForm onSigned={refetch} />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Pending admin review notice */}
      {!s?.payoutReady && (s?.w9Done || s?.bankDone || s?.idDone || s?.consentSigned) && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Pending Admin Review</p>
            <p className="text-amber-700 dark:text-amber-400">Our team will review your submitted information within 1–2 business days. You will be notified when your payout account is approved.</p>
          </div>
        </div>
      )}

      {/* Lock notice for unstarted */}
      {!s?.payoutReady && !s?.w9Done && !s?.bankDone && !s?.idDone && !s?.consentSigned && (
        <div className="rounded-lg border border-border p-4 flex gap-3 text-sm text-muted-foreground">
          <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Commissions are held until payout setup is complete</p>
            <p>Complete all four steps above to unlock ACH direct deposit of your earned commissions.</p>
          </div>
        </div>
      )}
    </div>
  );
}
