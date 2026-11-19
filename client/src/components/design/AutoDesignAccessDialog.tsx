import { useState } from "react";
import { Lock, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLoginUrl } from "@/const";
import { useAutoDesignAccessProcedures } from "@/lib/autoDesignAccessProcedures";
import { autoDesignAccessConfig } from "@/lib/autoDesignAccessFlag";
import {
  PHONE_INPUT_ERROR,
  freeDesignsPhrase,
  formatUsd,
  normalizePhoneE164,
  type AutoDesignRunBlockReason,
} from "@shared/autoDesignAccess";
import { autoDesignCreditCopy } from "@shared/autoDesignCredit";

interface Props {
  open: boolean;
  reason: AutoDesignRunBlockReason | null;
  message: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the phone is verified so the caller can refetch status. */
  onVerified: () => void;
}

/**
 * Shown when the Auto Design gate refuses a run. Browsing stays open; this only
 * explains what is needed to RUN Auto Design: sign in, verify a mobile number
 * (one free design per number), or subscribe. The credit copy states the
 * store-fee policy: the full fee is credited, store cuts are never passed on.
 */
export function AutoDesignAccessDialog({ open, reason, message, onOpenChange, onVerified }: Props) {
  const api = useAutoDesignAccessProcedures();
  const config = autoDesignAccessConfig();
  const requestCode = api.requestPhoneCode.useMutation();
  const confirmCode = api.confirmPhoneCode.useMutation();
  const checkout = api.startCheckout.useMutation();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const phoneE164 = normalizePhoneE164(phone);

  async function sendCode() {
    if (!phoneE164) { toast.error(PHONE_INPUT_ERROR); return; }
    try {
      await requestCode.mutateAsync({ phone: phoneE164 });
      setCodeSent(true);
      toast.success("Code sent. Check your text messages.");
    } catch (error) {
      toast.error((error as Error).message || "We could not send a verification code.");
    }
  }

  async function verify() {
    if (!phoneE164 || !code.trim()) return;
    try {
      await confirmCode.mutateAsync({ phone: phoneE164, code: code.trim() });
      toast.success("Mobile number verified.");
      onVerified();
    } catch (error) {
      toast.error((error as Error).message || "We could not verify that code.");
    }
  }

  async function subscribe() {
    try {
      const result = await checkout.mutateAsync({ returnPath: window.location.pathname + window.location.search });
      window.location.assign(result.url);
    } catch (error) {
      toast.error((error as Error).message || "Checkout could not start.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="auto-design-access-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Run Auto Design</DialogTitle>
          <DialogDescription>{message ?? "Auto Design needs an active subscription."}</DialogDescription>
        </DialogHeader>

        {reason === "sign_in" && (
          <Button onClick={() => window.location.assign(getLoginUrl())}>Sign in or create an account</Button>
        )}

        {reason === "verify_phone" && (
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2"><Phone className="h-4 w-4" /> Mobile number</label>
            <Input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234" />
            {phone && !phoneE164 && <p className="text-xs text-red-600">{PHONE_INPUT_ERROR}</p>}
            {!codeSent ? (
              <Button disabled={!phoneE164 || requestCode.isPending} onClick={sendCode}>Text me a code</Button>
            ) : (
              <div className="flex gap-2">
                <Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
                <Button disabled={!code.trim() || confirmCode.isPending} onClick={verify}>Verify</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{config.freeDesignsPerPhone > 0 ? `${freeDesignsPhrase(config.freeDesignsPerPhone)} per mobile number. ` : ""}Message and data rates may apply.</p>
          </div>
        )}

        {reason === "subscribe" && (
          <Button disabled={checkout.isPending} onClick={subscribe}>Subscribe for {formatUsd(config.accessFeeCents)}</Button>
        )}

        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1" data-testid="auto-design-credit-copy">
          {autoDesignCreditCopy(config.accessFeeCents).map((line) => <li key={line}>{line}</li>)}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep browsing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
