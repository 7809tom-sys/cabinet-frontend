import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CountertopInvoiceGate, CountertopQuoteInvoiceOption } from "@/lib/countertopInvoiceGate";

/**
 * Pick a saved/won countertop quote to bill on this deal invoice as one slab
 * line. When the deal has no shipping info, the line is blocked and a small
 * form collects the shipping address on the deal.
 */
export function CountertopQuoteInvoicePicker({
  dealId,
  quotes,
  shippingMessage,
  value,
  onChange,
  gate,
  onShippingSaved,
}: {
  dealId: number;
  quotes: CountertopQuoteInvoiceOption[];
  shippingMessage: string | null;
  value: number | null;
  onChange: (id: number | null) => void;
  gate: CountertopInvoiceGate;
  onShippingSaved: () => void;
}) {
  const [address, setAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "" });
  const saveShipping = trpc.crm.setDealShippingAddress.useMutation({
    onSuccess: (result: { shippingAddressVerified: boolean }) => {
      toast.success(result.shippingAddressVerified ? "Shipping address saved and verified." : "Shipping address saved (not verified).");
      onShippingSaved();
    },
    onError: (error: { message: string }) => toast.error(error.message || "Could not save the shipping address."),
  });
  if (quotes.length === 0) return null;
  const selected = quotes.find((q) => q.id === value) ?? null;
  const addressReady = address.line1.trim() && address.city.trim() && address.state.trim().length === 2 && address.zip.trim().length >= 5;

  return (
    <div className="rounded-md border border-border p-2.5 space-y-2" data-testid="crm-invoice-countertop-quote">
      <Label className="text-sm font-medium">Countertop quote (billed by the slab)</Label>
      <Select value={value == null ? "none" : String(value)} onValueChange={(next) => onChange(next === "none" ? null : Number(next))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No countertop quote</SelectItem>
          {quotes.map((q) => (
            <SelectItem key={q.id} value={String(q.id)}>
              #{q.id} · {q.contactEmail} · {q.status}{q.slabs ? ` · ${q.slabs} slab${q.slabs === 1 ? "" : "s"}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.line && <p className="text-xs"><span className="text-muted-foreground">Line:</span> {selected.line.description}</p>}
      {selected?.slabSizeWarning && <p className="text-[11px] text-amber-700">Check before sending: {selected.slabSizeWarning}.</p>}
      {!gate.ok && gate.reason === "missing_line" && <p className="text-[11px] text-amber-700">{gate.message}</p>}
      {!gate.ok && gate.reason === "missing_shipping" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-2" data-testid="crm-invoice-shipping-required">
          <p className="text-xs text-amber-900">{shippingMessage ?? gate.message}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Shipping street" placeholder="Street" className="col-span-2" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
            <Input aria-label="Shipping unit" placeholder="Apt / unit (optional)" className="col-span-2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
            <Input aria-label="Shipping city" placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Shipping state" placeholder="ST" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} />
              <Input aria-label="Shipping ZIP" placeholder="ZIP" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!addressReady || saveShipping.isPending}
            onClick={() => saveShipping.mutate({ dealId, address: { ...address, line2: address.line2.trim() || null } })}
          >
            {saveShipping.isPending ? "Saving…" : "Save shipping address"}
          </Button>
        </div>
      )}
    </div>
  );
}
