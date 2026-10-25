import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Truck, Mail, MapPin } from "lucide-react";

type FulfillmentMode = "email" | "netsuite_email" | "netsuite_api";
type ShippingRuleMode = "live" | "fixed" | "threshold";

type ShippingZipRate = { zipPrefix: string; feeCents: number };

function parseZipRateLines(value: string): ShippingZipRate[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^(\d{3,5})\s*(?:=|,|:)\s*\$?([\d,]+(?:\.\d{1,2})?)$/);
      if (!match) return [];
      const feeCents = Math.round(Number(match[2].replace(/,/g, "")) * 100);
      return Number.isInteger(feeCents) && feeCents >= 0 ? [{ zipPrefix: match[1], feeCents }] : [];
    });
}

function zipRateLines(value: ShippingZipRate[] | null | undefined): string {
  return (value ?? []).map((rate) => `${rate.zipPrefix} = ${(rate.feeCents / 100).toFixed(2)}`).join("\n");
}

const MODE_HELP: Record<FulfillmentMode, string> = {
  email: "Email a purchase order (PDF-style text) plus a NetSuite-ready CSV to the distributor.",
  netsuite_email:
    "Same email delivery, framed as a NetSuite import — the attached CSV maps to a NetSuite Sales Order import.",
  netsuite_api:
    "Direct NetSuite API push (opt-in, coming soon). Until credentials are provided, we email the NetSuite CSV as a fallback.",
};

/**
 * Admin editor for a supply line's ORDER ROUTING + PICKUP settings:
 *  - orderEmail / ccEmails: where confirmed POs are sent (Send to Distributor)
 *  - fulfillmentMode: email vs netsuite_email vs netsuite_api (stub)
 *  - pickup: enabled, ZIP, address, radius (miles) — offered when the delivery
 *    ZIP is within the radius of the pickup/warehouse ZIP.
 */
export default function DistributorFulfillmentEditor({ glassOnly = false }: { glassOnly?: boolean }) {
  const utils = trpc.useUtils();
  const { data: dists, isLoading } = trpc.distributorAdmin.adminList.useQuery();

  const [selectedId, setSelectedId] = useState<string>("");
  const [orderEmail, setOrderEmail] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [mode, setMode] = useState<FulfillmentMode>("email");
  const [netsuiteAccountId, setNetsuiteAccountId] = useState("");
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupZip, setPickupZip] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupRadiusMiles, setPickupRadiusMiles] = useState("100");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseAddress, setWarehouseAddress] = useState("");
  const [warehouseZips, setWarehouseZips] = useState("");
  const [shippingRuleMode, setShippingRuleMode] = useState<ShippingRuleMode>("live");
  const [flatFreightDollars, setFlatFreightDollars] = useState("");
  const [freeFreightThresholdDollars, setFreeFreightThresholdDollars] = useState("");
  const [zipRateLinesDraft, setZipRateLinesDraft] = useState("");
  const [shippingExceptions, setShippingExceptions] = useState("");
  const [glassIncluded, setGlassIncluded] = useState(false);

  const selected = useMemo(
    () => dists?.find((d) => String(d.id) === selectedId),
    [dists, selectedId]
  );
  const { data: glassCatalog, isLoading: glassCatalogLoading } = trpc.distributorAdmin.glassPolicyCatalog.useQuery(
    { distributorId: Number(selectedId) || -1 },
    { enabled: Boolean(selectedId) },
  );

  useEffect(() => {
    if (!selected) return;
    setOrderEmail(selected.orderEmail ?? "");
    setCcEmails(selected.ccEmails ?? "");
    setMode(((selected.fulfillmentMode as FulfillmentMode) ?? "email") || "email");
    setNetsuiteAccountId(selected.netsuiteAccountId ?? "");
    setPickupEnabled(Boolean(selected.pickupEnabled));
    setPickupZip(selected.pickupZip ?? "");
    setPickupAddress(selected.pickupAddress ?? "");
    setPickupRadiusMiles(String(selected.pickupRadiusMiles ?? 100));
    setWarehouseName(selected.warehouseName ?? "");
    setWarehouseAddress(selected.warehouseAddress ?? "");
    setWarehouseZips((selected.warehouseZips ?? []).join(", "));
    setShippingRuleMode((selected.shippingRuleMode as ShippingRuleMode) ?? "live");
    setFlatFreightDollars(selected.shippingFlatFreightFeeCents != null ? (selected.shippingFlatFreightFeeCents / 100).toFixed(2) : "");
    setFreeFreightThresholdDollars(selected.shippingFreeFreightThresholdCents != null ? (selected.shippingFreeFreightThresholdCents / 100).toFixed(2) : "");
    setZipRateLinesDraft(zipRateLines(selected.shippingZipRates));
    setShippingExceptions(selected.shippingExceptions ?? "");
    setGlassIncluded(Boolean(selected.glassIncluded));
  }, [selected]);

  const save = trpc.distributorAdmin.updateFulfillment.useMutation({
    onSuccess: () => {
      toast.success("Fulfillment settings saved.");
      utils.distributorAdmin.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not save settings"),
  });

  const radiusNum = Number(pickupRadiusMiles);
  const radiusValid = Number.isFinite(radiusNum) && radiusNum >= 1 && radiusNum <= 1000;
  const shippingZips = warehouseZips.split(/[\s,]+/).map((zip) => zip.trim()).filter(Boolean);
  const warehouseZipsValid = shippingZips.length > 0 && shippingZips.every((zip) => /^\d{5}$/.test(zip));
  const zipRates = parseZipRateLines(zipRateLinesDraft);
  const flatFreightFeeCents = flatFreightDollars.trim() === "" ? null : Math.round(Number(flatFreightDollars) * 100);
  const freeFreightThresholdCents = freeFreightThresholdDollars.trim() === "" ? null : Math.round(Number(freeFreightThresholdDollars) * 100);
  const hasConfiguredFixedRule = zipRates.length > 0 || (flatFreightFeeCents != null && Number.isInteger(flatFreightFeeCents) && flatFreightFeeCents >= 0);
  const shippingRuleValid = shippingRuleMode === "live" || hasConfiguredFixedRule;
  const canSave = Boolean(selectedId) && !save.isPending && warehouseZipsValid && shippingRuleValid && (!pickupEnabled || radiusValid);

  return (
    <Card data-testid={glassOnly ? "glass-policy-admin" : "distributor-fulfillment-admin"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" /> {glassOnly ? "Distributor glass policy audit" : "Distributor fulfillment & pickup"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {glassOnly
            ? "Choose a distributor once to confirm whether its PG, GD, and terminal-G cabinets include glass or require a separate glass purchase. The audit below updates automatically for the whole distributor."
            : "Set where confirmed orders are emailed for each supply line, whether a NetSuite-ready CSV is used, and whether local pickup is offered near the warehouse."}
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Loading lines…
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-w-sm">
              <Label>Cabinet line</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a line…" />
                </SelectTrigger>
                <SelectContent>
                  {dists?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.code} — {d.brandName || d.name}
                      {d.orderEmail ? "" : "  (no order email)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedId && (
              <>
                {!glassOnly && <>
                {/* Order routing */}
                <div className="rounded-lg border p-4 space-y-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Order routing
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Order-intake email</Label>
                      <Input
                        type="email"
                        value={orderEmail}
                        onChange={(e) => setOrderEmail(e.target.value)}
                        placeholder="orders@distributor.com"
                        maxLength={320}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CC emails (comma-separated)</Label>
                      <Input
                        value={ccEmails}
                        onChange={(e) => setCcEmails(e.target.value)}
                        placeholder="affiliate@x.com, sales@y.com"
                        maxLength={1024}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Delivery method</Label>
                      <Select value={mode} onValueChange={(v) => setMode(v as FulfillmentMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email (PO + CSV)</SelectItem>
                          <SelectItem value="netsuite_email">NetSuite CSV import (email)</SelectItem>
                          <SelectItem value="netsuite_api">NetSuite API (opt-in, coming soon)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{MODE_HELP[mode]}</p>
                    </div>
                    {(mode === "netsuite_email" || mode === "netsuite_api") && (
                      <div className="space-y-1.5">
                        <Label>NetSuite account ID (optional)</Label>
                        <Input
                          value={netsuiteAccountId}
                          onChange={(e) => setNetsuiteAccountId(e.target.value)}
                          placeholder="e.g. 1234567"
                          maxLength={64}
                        />
                        {mode === "netsuite_api" && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Direct API push is not active yet — orders still send by email with the CSV attached.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Warehouse and shipping policy */}
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-start gap-2">
                    <Truck className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Distributor warehouse & shipping rule</p>
                      <p className="text-xs text-muted-foreground">This overlay controls fulfillment origin and the freight policy shown in cart and on the invoice. Catalog identity, images, dimensions, and prices remain master-controlled.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Warehouse name</Label>
                      <Input value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Dallas distribution center" maxLength={128} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Warehouse ZIPs <span className="text-destructive">*</span></Label>
                      <Input value={warehouseZips} onChange={(event) => setWarehouseZips(event.target.value)} placeholder="75001, 30301" />
                      <p className="text-xs text-muted-foreground">One or more five-digit origins, separated by commas. The nearest origin is used.</p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Warehouse address or service region</Label>
                      <Input value={warehouseAddress} onChange={(event) => setWarehouseAddress(event.target.value)} placeholder="123 Warehouse Rd, Dallas, TX 75001" maxLength={512} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Shipping rule</Label>
                      <Select value={shippingRuleMode} onValueChange={(value) => setShippingRuleMode(value as ShippingRuleMode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="live">Live carrier quote</SelectItem>
                          <SelectItem value="fixed">Fixed freight by ZIP / all locations</SelectItem>
                          <SelectItem value="threshold">Fixed freight with free-freight threshold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {shippingRuleMode !== "live" && <div className="space-y-1.5">
                      <Label>Default freight ($)</Label>
                      <Input type="number" min="0" step="0.01" value={flatFreightDollars} onChange={(event) => setFlatFreightDollars(event.target.value)} placeholder="299.00" />
                    </div>}
                    {shippingRuleMode === "threshold" && <div className="space-y-1.5">
                      <Label>Free freight at order total ($)</Label>
                      <Input type="number" min="0" step="0.01" value={freeFreightThresholdDollars} onChange={(event) => setFreeFreightThresholdDollars(event.target.value)} placeholder="5000.00" />
                    </div>}
                  </div>
                  {shippingRuleMode !== "live" && <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>ZIP / zone overrides</Label>
                      <Textarea value={zipRateLinesDraft} onChange={(event) => setZipRateLinesDraft(event.target.value)} placeholder={"750 = 199.00\n90210 = 249.00"} className="min-h-24 font-mono text-sm" />
                      <p className="text-xs text-muted-foreground">Optional. Use a 3–5 digit ZIP prefix and freight dollars. The most specific match wins.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Exceptions / customer message</Label>
                      <Textarea value={shippingExceptions} onChange={(event) => setShippingExceptions(event.target.value)} placeholder="Remote areas, liftgate, appointment delivery, or surcharge policy." className="min-h-24" maxLength={2000} />
                    </div>
                  </div>}
                  {!warehouseZipsValid && <p className="text-xs text-destructive">Enter at least one five-digit warehouse ZIP.</p>}
                  {!shippingRuleValid && <p className="text-xs text-destructive">A fixed or threshold rule needs a default freight amount or a valid ZIP override.</p>}
                </div>
                </>}

                {/* Glass policy */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Glass policy</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Applies to every glass nomenclature in this line: codes ending in PG, GD, or G, including glass stackers. This distributor overlay never changes the master cabinet identity, dimensions, or image.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {glassIncluded ? "Glass included" : "Glass purchased separately"}
                      </span>
                      <Switch
                        checked={glassIncluded}
                        onCheckedChange={setGlassIncluded}
                        aria-label="Glass included in glass cabinet pricing"
                      />
                    </div>
                  </div>
                  <p className={glassIncluded ? "text-xs text-emerald-700 dark:text-emerald-300" : "text-xs text-amber-700 dark:text-amber-300"}>
                    {glassIncluded
                      ? "The listed cabinet or door price includes the glass insert."
                      : "The listed cabinet or door price does not include the glass insert; the Designer and cart will flag it for separate purchase."}
                  </p>
                  <div className="rounded-md bg-muted/45 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold">Automatic glass-nomenclature audit</p>
                        <p className="text-[11px] text-muted-foreground">All PG, GD, and terminal-G cabinets from this distributor. The policy above applies to every row automatically.</p>
                      </div>
                      {!glassCatalogLoading && <div className="flex gap-1.5 text-[10px]">
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                          {glassCatalog?.filter((item) => item.offered).length ?? 0} offered
                        </Badge>
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                          {glassCatalog?.filter((item) => !item.offered).length ?? 0} not offered
                        </Badge>
                      </div>}
                    </div>
                    {glassCatalogLoading ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="h-3.5 w-3.5" /> Auditing glass nomenclature…</div>
                    ) : glassCatalog && glassCatalog.length > 0 ? (
                      <div className="mt-3 max-h-56 overflow-auto rounded border bg-background">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
                            <tr><th className="px-2 py-1.5">Code</th><th className="px-2 py-1.5">Glass cabinet status</th><th className="px-2 py-1.5">Glass policy</th></tr>
                          </thead>
                          <tbody>
                            {glassCatalog.map((item) => (
                              <tr key={item.cabinetId} className="border-t">
                                <td className="px-2 py-1.5"><div className="font-mono font-medium">{item.masterCode}</div><div className="max-w-64 truncate text-muted-foreground">{item.description}</div></td>
                                <td className="px-2 py-1.5"><Badge variant="outline" className={item.offered ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" : "border-muted-foreground/30 text-muted-foreground"}>{item.offered ? "Offered" : "Not offered"}</Badge></td>
                                <td className="px-2 py-1.5 text-muted-foreground">{glassIncluded ? "Included" : "Separate purchase"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">No PG, GD, or terminal-G cabinet rows are currently linked to this distributor.</p>
                    )}
                  </div>
                </div>

                {!glassOnly && <>
                {/* Pickup */}
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Local pickup
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pickupEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
                    </div>
                  </div>
                  {pickupEnabled && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Pickup ZIP</Label>
                        <Input
                          value={pickupZip}
                          onChange={(e) => setPickupZip(e.target.value)}
                          placeholder="Defaults to warehouse ZIP"
                          maxLength={16}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Pickup address</Label>
                        <Input
                          value={pickupAddress}
                          onChange={(e) => setPickupAddress(e.target.value)}
                          placeholder="123 Warehouse Rd, City, ST"
                          maxLength={512}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Radius (miles)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          value={pickupRadiusMiles}
                          onChange={(e) => setPickupRadiusMiles(e.target.value)}
                        />
                        {!radiusValid && (
                          <p className="text-xs text-destructive">Enter 1–1000 miles.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </>}

                <div className="flex items-center gap-3">
                  <Button
                    disabled={glassOnly ? !selectedId || save.isPending : !canSave}
                    onClick={() =>
                      save.mutate(glassOnly ? {
                        distributorId: Number(selectedId),
                        glassIncluded,
                      } : {
                        distributorId: Number(selectedId),
                        orderEmail: orderEmail.trim(),
                        ccEmails: ccEmails.trim(),
                        fulfillmentMode: mode,
                        netsuiteAccountId: netsuiteAccountId.trim(),
                        pickupEnabled,
                        pickupZip: pickupZip.trim(),
                        pickupAddress: pickupAddress.trim(),
                        pickupRadiusMiles: radiusValid ? radiusNum : 100,
                        warehouseName: warehouseName.trim(),
                        warehouseAddress: warehouseAddress.trim(),
                        warehouseZips: shippingZips,
                        shippingRuleMode,
                        shippingFlatFreightFeeCents: flatFreightFeeCents,
                        shippingFreeFreightThresholdCents: freeFreightThresholdCents,
                        shippingZipRates: zipRates,
                        shippingExceptions: shippingExceptions.trim(),
                        glassIncluded,
                      })
                    }
                  >
                    {save.isPending && <Spinner className="mr-2 h-4 w-4" />}
                    {glassOnly ? "Save glass policy" : "Save settings"}
                  </Button>
                  {glassOnly && (
                    <p className="text-xs text-muted-foreground">One saved setting applies to every audited glass cabinet for this distributor.</p>
                  )}
                  {!glassOnly && selected && !selected.orderEmail && !orderEmail.trim() && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                      No order email — Send to Distributor will be blocked
                    </Badge>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
