import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import type { PublicVendorQuote, ShippingQuoteRequestItem } from "./cartShippingQuote";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ShippingQuoteResults({ quotes }: { quotes: readonly PublicVendorQuote[] }) {
  if (quotes.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="shipping-quote-results">
      {quotes.map((quote) => {
        const option = quote.options[0];
        return (
          <div key={`${quote.vendorScope}-${quote.itemIndexes.join("-")}`} className="rounded-md border border-border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{quote.vendorName}</p>
              {quote.ok && quote.sourceLabel && (
                <Badge variant={quote.estimate ? "outline" : "secondary"}>
                  {quote.estimate ? "estimate" : quote.sourceLabel}
                </Badge>
              )}
            </div>
            {quote.ok && option ? (
              <p className="mt-1 text-foreground">
                {option.carrier ? `${option.carrier} · ` : ""}{option.method} · {money(option.costCents)}
                {option.transitDays != null ? ` · ${option.transitDays} transit day${option.transitDays === 1 ? "" : "s"}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">{quote.error || "No shipping quote was returned."}</p>
            )}
            {quote.note && <p className="mt-1 text-xs text-muted-foreground">{quote.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function ShippingQuoteBox({
  items,
  className = "",
  onQuoted,
}: {
  items: ShippingQuoteRequestItem[];
  className?: string;
  onQuoted?: (quotes: PublicVendorQuote[]) => void;
}) {
  const [zip, setZip] = useState("");
  const quote = trpc.shippingQuotes.getShippingQuote.useMutation();
  useEffect(() => {
    if (quote.data) onQuoted?.(quote.data.vendors);
  }, [quote.data, onQuoted]);
  const ready = /^\d{5}$/.test(zip) && items.length > 0;
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`} data-testid="shipping-quote-box">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Shipping quote</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="shipping-quote-disclaimer">
        This shipping quote is informational. Checkout still uses the full delivery address, and this amount is not added to the Stripe total.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="shipping-quote-zip">Destination ZIP</Label>
          <Input
            id="shipping-quote-zip"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            placeholder="5-digit ZIP"
            onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-32"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || quote.isPending}
          onClick={() => quote.mutate({ destinationZip: zip, items })}
        >
          {quote.isPending ? "Getting quote…" : "Get shipping quote"}
        </Button>
      </div>
      {quote.error && <p className="mt-2 text-xs text-destructive">{quote.error.message}</p>}
      {quote.data && <div className="mt-3"><ShippingQuoteResults quotes={quote.data.vendors} /></div>}
    </div>
  );
}

export function VendorShippingQuoteCard({
  isAdmin,
  vendorLineId,
  distributorId,
}: {
  isAdmin: boolean;
  vendorLineId?: number | null;
  distributorId?: number | null;
}) {
  const utils = trpc.useUtils();
  const input = isAdmin
    ? { ...(vendorLineId ? { vendorLineId } : {}), ...(distributorId ? { distributorId } : {}) }
    : {};
  const config = trpc.shippingQuotes.vendorConfig.useQuery(input);
  const save = trpc.shippingQuotes.saveVendorConfig.useMutation({
    onSuccess: () => {
      toast.success("Shipping quote settings saved");
      void utils.shippingQuotes.vendorConfig.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const test = trpc.shippingQuotes.testQuote.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const [draft, setDraft] = useState<null | {
    serviceCodes: string;
    freightClass: string;
    shipFromZip: string;
    provider: "none" | "http" | "pelican" | "carrier_ltl";
    quoteUrl: string;
    authHeaderName: string;
    secret: string;
    vendorEnabled: boolean;
    adminEnabled: boolean;
  }>(null);
  const current = config.data;
  const form = draft ?? (current ? {
    serviceCodes: current.serviceCodes.join(", "),
    freightClass: current.freightClass ?? "",
    shipFromZip: current.shipFromZip ?? "",
    provider: current.provider,
    quoteUrl: current.quoteUrl ?? "",
    authHeaderName: current.authHeaderName ?? "",
    secret: "",
    vendorEnabled: current.vendorEnabled,
    adminEnabled: current.adminEnabled,
  } : null);
  const [testZip, setTestZip] = useState("");

  if (config.isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading shipping quote settings…</CardContent></Card>;
  if (config.error || !form || !current) {
    return <Card><CardContent className="p-6 text-sm text-destructive">{config.error?.message ?? "Shipping quote settings could not be loaded."}</CardContent></Card>;
  }

  return (
    <Card data-testid="vendor-shipping-quote-card">
      <CardHeader>
        <CardTitle>Shipping codes and live quote</CardTitle>
        <CardDescription>
          Service codes, freight class, and ship-from ZIP travel with a live quote request. A saved HTTPS endpoint is used first when an administrator has enabled it. Posted zip, flat, and free-freight rules stay authoritative when the live call is off or fails. The secret is stored encrypted and is never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Service codes</Label>
            <Input value={form.serviceCodes} onChange={(event) => setDraft({ ...form, serviceCodes: event.target.value })} placeholder="GROUND, LTL" />
          </div>
          <div className="space-y-1">
            <Label>Freight class</Label>
            <Input value={form.freightClass} maxLength={8} onChange={(event) => setDraft({ ...form, freightClass: event.target.value })} placeholder="70" />
          </div>
          <div className="space-y-1">
            <Label>Ship-from ZIP</Label>
            <Input value={form.shipFromZip} inputMode="numeric" maxLength={5} onChange={(event) => setDraft({ ...form, shipFromZip: event.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="33760" />
          </div>
          <div className="space-y-1">
            <Label>Live quote source</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.provider}
              onChange={(event) => setDraft({ ...form, provider: event.target.value as typeof form.provider })}
            >
              <option value="none">Posted rates only</option>
              <option value="http">Vendor quote API</option>
              <option value="pelican">Pelican named adapter</option>
              <option value="carrier_ltl">Saved carrier / LTL account</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Quote URL</Label>
            <Input value={form.quoteUrl} onChange={(event) => setDraft({ ...form, quoteUrl: event.target.value })} placeholder="https://vendor.example/shipping-quote" />
          </div>
          <div className="space-y-1">
            <Label>Auth header name</Label>
            <Input value={form.authHeaderName} onChange={(event) => setDraft({ ...form, authHeaderName: event.target.value })} placeholder="Authorization" />
          </div>
          <div className="space-y-1">
            <Label>Auth secret</Label>
            <Input type="password" value={form.secret} autoComplete="new-password" onChange={(event) => setDraft({ ...form, secret: event.target.value })} placeholder={current.hasSecret ? "Saved. Leave blank to keep it." : "Enter the secret once"} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.vendorEnabled} onCheckedChange={(checked) => setDraft({ ...form, vendorEnabled: checked })} />
            <Label>Vendor enables live quotes</Label>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch checked={form.adminEnabled} onCheckedChange={(checked) => setDraft({ ...form, adminEnabled: checked })} />
              <Label>Administrator enables customer quotes</Label>
            </div>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">{current.adminEnabled ? "An administrator has enabled this live quote." : "An administrator still needs to enable this live quote."}</p>
          )}
        </div>
        {current.customApiUrl && (
          <p className="text-xs text-muted-foreground">
            Custom Shipping API on file: {current.customApiUrl}. Customer quotes use it when that connection is enabled and an administrator has allowed it{current.customApiAdminEnabled ? " (allowed now)" : " (not allowed yet)"}.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({
              ...(isAdmin && vendorLineId ? { vendorLineId } : {}),
              ...(isAdmin && distributorId ? { distributorId } : {}),
              serviceCodes: form.serviceCodes.split(",").map((code) => code.trim()).filter(Boolean),
              freightClass: form.freightClass.trim() || null,
              shipFromZip: form.shipFromZip.trim() || null,
              provider: form.provider,
              quoteUrl: form.quoteUrl.trim() || null,
              authHeaderName: form.authHeaderName.trim() || null,
              secret: form.secret,
              vendorEnabled: form.vendorEnabled,
              ...(isAdmin ? { adminEnabled: form.adminEnabled } : {}),
            })}
          >
            {save.isPending ? "Saving…" : "Save shipping quote"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor="vendor-test-quote-zip">Test ZIP</Label>
            <Input id="vendor-test-quote-zip" className="w-32" inputMode="numeric" maxLength={5} value={testZip} onChange={(event) => setTestZip(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="30301" />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!/^\d{5}$/.test(testZip) || test.isPending}
            onClick={() => test.mutate({
              ...(isAdmin && vendorLineId ? { vendorLineId } : {}),
              ...(isAdmin && distributorId ? { distributorId } : {}),
              destinationZip: testZip,
            })}
          >
            {test.isPending ? "Testing…" : "Test quote"}
          </Button>
        </div>
        {test.data && <ShippingQuoteResults quotes={test.data.vendors} />}
      </CardContent>
    </Card>
  );
}

export function PelicanCatalogWeightCompare() {
  const compare = trpc.shippingQuotes.comparePelicanCatalogWeights.useMutation({
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Compare saved profile weights with Pelican&apos;s public catalog. This check does not change any weight.</p>
        <Button type="button" size="sm" variant="outline" className="bg-background" disabled={compare.isPending} onClick={() => compare.mutate()}>
          {compare.isPending ? "Comparing…" : "Compare catalog weights"}
        </Button>
      </div>
      {compare.data && (
        <div className="mt-3 space-y-2">
          <p>{compare.data.quartzNote}</p>
          <p>{compare.data.mismatches.length} mismatch{compare.data.mismatches.length === 1 ? "" : "es"} in the first {compare.data.pagesRead} catalog page{compare.data.pagesRead === 1 ? "" : "s"} ({compare.data.catalogSkus} SKUs).</p>
          {compare.data.mismatches.slice(0, 12).map((row) => (
            <p key={row.pelicanCode}>{row.pelicanCode}: profile {row.profileWeightLbs ?? "—"} lb, catalog {row.catalogWeightLbs} lb</p>
          ))}
        </div>
      )}
    </div>
  );
}
