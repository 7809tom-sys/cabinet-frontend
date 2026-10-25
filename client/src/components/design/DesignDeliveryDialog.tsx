import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import type { CartItem } from "@/contexts/CartContext";

export type DeliveryAddress = { line1: string; line2: string; city: string; state: string; zip: string };

const STORAGE_KEY = "cd-design-delivery-address";
const EMPTY: DeliveryAddress = { line1: "", line2: "", city: "", state: "", zip: "" };

/** True only when every field a carrier needs is present. */
export function isCompleteDeliveryAddress(a: DeliveryAddress): boolean {
  return a.line1.trim().length > 2 && a.city.trim().length > 1 && /^[A-Za-z]{2}$/.test(a.state.trim()) && a.zip.trim().length >= 5;
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: number | null;
  designName: string | null;
  designTotal: number;
  lines: readonly CartItem[];
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
}

export function DesignDeliveryDialog({ open, onOpenChange, designId, designName, designTotal, lines, defaultName, defaultEmail, defaultPhone }: Props) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [address, setAddress] = useState<DeliveryAddress>(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }; } catch { return EMPTY; }
  });
  // The address a verification result applies to; editing any field invalidates it.
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const addressKey = JSON.stringify(address);

  useEffect(() => { setName((v) => v || defaultName); setPhone((v) => v || defaultPhone); }, [defaultName, defaultPhone]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, addressKey); } catch { /* storage unavailable */ } }, [addressKey]);

  const verify = trpc.location.verifyAddress.useMutation();
  const sync = trpc.crm.syncDesignQuoteToCrm.useMutation();
  const complete = isCompleteDeliveryAddress(address);
  const isVerified = verify.data?.verified === true && verifiedFor === addressKey;

  const freightInput = useMemo(() => ({
    // An unsaved plan deliberately has no freight-history design link.
    kitchenDesignId: designId ?? undefined,
    destinationZip: address.zip.trim().slice(0, 5),
    merchandiseSubtotalCents: Math.max(0, Math.round(designTotal * 100)),
    accessorials: { residential: true, liftgate: false },
    items: lines
      .filter((l) => l.productKind !== "surface" && l.unitPrice != null)
      .map((l) => ({ cabinetId: null, masterCode: l.masterCode, styleId: l.styleId > 0 ? l.styleId : null, distributorId: l.distributorId ?? null, qty: Math.max(1, Math.round(l.qty)), weightLbs: null })),
  }), [address.zip, designId, designTotal, lines]);

  // A shipping quote needs the complete address, so it is gated on that.
  const quote = trpc.freight.estimate.useQuery(freightInput, {
    enabled: open && complete && freightInput.items.length > 0,
    retry: false,
  });
  const shippingCents = quote.data?.available ? quote.data.totalCents : null;

  const set = (k: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [k]: k === "state" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value }));

  const runVerify = () => {
    const key = addressKey;
    verify.mutate(
      { line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, zip: address.zip },
      { onSuccess: () => setVerifiedFor(key) },
    );
  };

  const applySuggestion = () => {
    const n = verify.data?.normalized;
    if (!n) return;
    setAddress((a) => ({ ...a, line1: n.line1, city: n.city, state: n.state, zip: n.zip }));
    setVerifiedFor(null);
  };

  const save = () => {
    if (designId == null) { toast.error("Save the design first, then send it to the CRM."); return; }
    sync.mutate(
      {
        designId,
        contactName: name.trim() || null,
        contactEmail: defaultEmail || null,
        contactPhone: phone.trim() || null,
        designValue: Number(designTotal.toFixed(2)),
        shippingQuote: shippingCents != null ? shippingCents / 100 : null,
        address: { line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, zip: address.zip },
      },
      {
        onSuccess: (r) => {
          toast.success(r.verification.verified ? "Saved to the CRM with a verified address." : "Saved to the CRM. The address could not be verified yet.");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message || "Could not save to the CRM."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,560px)] max-h-[90vh] overflow-y-auto" data-testid="design-delivery-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery &amp; contact details</DialogTitle>
          <DialogDescription>
            Enter the full delivery address for an accurate shipping quote. It is verified, then saved with your design price to the CRM.
            {designName ? ` Design: ${designName}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">Full name<Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="text-xs font-medium">Phone<Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" /></label>
          <label className="text-xs font-medium sm:col-span-2">Email<Input value={defaultEmail} readOnly /></label>
          <label className="text-xs font-medium sm:col-span-2">Street address<Input value={address.line1} onChange={set("line1")} autoComplete="address-line1" /></label>
          <label className="text-xs font-medium sm:col-span-2">Apt / suite (optional)<Input value={address.line2} onChange={set("line2")} autoComplete="address-line2" /></label>
          <label className="text-xs font-medium">City<Input value={address.city} onChange={set("city")} autoComplete="address-level2" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium">State<Input value={address.state} onChange={set("state")} maxLength={2} autoComplete="address-level1" placeholder="FL" /></label>
            <label className="text-xs font-medium">ZIP<Input value={address.zip} onChange={set("zip")} inputMode="numeric" autoComplete="postal-code" /></label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!complete || verify.isPending} onClick={runVerify} data-testid="verify-address">
            {verify.isPending ? "Verifying…" : "Verify address"}
          </Button>
          {isVerified && <span className="flex items-center gap-1 text-xs font-medium text-emerald-700" data-testid="address-verified"><CheckCircle2 className="h-4 w-4" /> Address verified</span>}
          {!complete && <span className="text-xs text-muted-foreground">Street, city, state and ZIP are required.</span>}
        </div>

        {verify.data && !isVerified && verifiedFor === addressKey && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" role="alert" data-testid="address-warning">
            <div className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{verify.data.reason}</span></div>
            {verify.data.formatted && verify.data.normalized && (
              <button type="button" className="mt-1 font-semibold underline" onClick={applySuggestion}>Use suggested: {verify.data.formatted}</button>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1" data-testid="design-quote-summary">
          <div className="flex justify-between"><span>Kitchen design price</span><span className="font-semibold">{money(designTotal)}</span></div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Shipping</span>
            <span className="font-semibold">
              {!complete ? "Enter full address"
                : quote.isLoading ? "Quoting…"
                : shippingCents != null ? money(shippingCents / 100)
                : "Quoted when order is placed"}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-1"><span>Total</span><span className="font-semibold">{money(designTotal + (shippingCents ?? 0) / 100)}</span></div>
        </div>

        <Button type="button" className="w-full" disabled={!complete || sync.isPending || designId == null} onClick={save} data-testid="save-design-to-crm">
          {sync.isPending ? "Saving…" : "Save to CRM"}
        </Button>
        {designId == null && <p className="text-xs text-muted-foreground">Save your design first so it can be linked to the CRM.</p>}
      </DialogContent>
    </Dialog>
  );
}
